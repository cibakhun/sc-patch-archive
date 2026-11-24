// Items in 3D, Massenlauf: backt alle Items einer Liste zu Web-Modellen.
// Läuft auf dem Rechner mit Spielinstallation (Schiene C), nicht im Tor.
//
//   node scripts/item3d/batch.mjs --p4k <Data.p4k> --list items-armor.json --out <ordner> [--workers 6]
//   node scripts/item3d/batch.mjs --raw <rohOrdner> --out <ordner>    (Probe ohne Spiel)
//   node scripts/item3d/batch.mjs --p4k … --list … --out … --zensus <datei.jsonl>
//                                 (nur Merkmale je Item, nichts backen; ~30 s)
//
// Optionen: --only id,id  --limit N  --tex 1024  --lod 1  --cache-mb 400
// Ausgabe:  <out>/m/<id>.<hash>.glb   Netz + Material (Bilder verlinkt)
//           <out>/t/<hash>.webp       Bilder, nach Inhalt benannt (Farbvarianten teilen)
//           <out>/manifest.jsonl      eine Zeile je fertigem Item
//           <out>/fehler.jsonl        übersprungene oder gescheiterte Items
// Beide Protokolle tragen je Zeile die Zeit (zeit, ms): manifest.mjs lässt
// ein Modell weg, wenn sein Item danach gescheitert ist (alter Erfolg, neuer
// Fehlschlag), bis ein späterer Erfolg es wieder freigibt.
// Jede Zeile des Manifests trägt die Befunde des Items (merk: Merkmal ->
// Dreiecke) und halt (ein Merkmal ist unbekannt oder ein Fehler, siehe
// scripts/lib/item3d-merkmale.mjs); manifest.mjs lässt solche Items weg.
// Ein abgebrochener Lauf setzt beim nächsten Start fort; unveränderte Items
// (gleiche Eingaben, gleiche Backfassung, gleiche Merkmal-Tabelle) werden
// übersprungen. REPO lenkt die Pakete (sharp, gltf-transform) um.
import { isMainThread, Worker, parentPort, workerData } from 'node:worker_threads';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, statSync, truncateSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = fileURLToPath(new URL('.', import.meta.url));
const libUrl = (p) => pathToFileURL(join(HIER, '..', 'lib', p)).href;
const sha = (b, n = 16) => createHash('sha256').update(b).digest('hex').slice(0, n);
// Quellen-Kennung: jede gelesene Datei mit ihrer Kennung im Archiv
const quellenKennung = (prov, liste) => sha(liste.map((k) => `${k}=${prov.kennung(k)}`).join('\n'), 12);
let p4kMod = null;
// Protokollzeilen (manifest.jsonl, fehler.jsonl) lesen: dieselbe Regel für
// Planung und Abschlussbericht; eine kaputte Zeile zählt nicht. zeilenAlle
// gibt jede Zeile (fehler.jsonl: maßgeblich ist je Item die jüngste Zeit),
// zeilen je Item die letzte.
const zeilenAlle = (f) => {
  const rows = [];
  if (!existsSync(f)) return rows;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const r = JSON.parse(line); if (r && typeof r.id === 'string') rows.push(r); } catch {}
  }
  return rows;
};
const zeilen = (f) => new Map(zeilenAlle(f).map((r) => [r.id, r]));
// Ein abgebrochener Lauf kann eine halbe letzte Zeile hinterlassen; ohne
// Kürzung klebte die nächste Zeile daran und ginge mit verloren.
const fehlerZeile = (OUT, o) => appendFileSync(join(OUT, 'fehler.jsonl'), `${JSON.stringify({ ...o, zeit: Date.now() })}\n`);
const zeilenendeHeilen = (f) => {
  if (!existsSync(f)) return;
  const b = readFileSync(f);
  if (!b.length || b[b.length - 1] === 0x0a) return;
  truncateSync(f, b.lastIndexOf(0x0a) + 1);
};
const openP4kFuer = (P) => p4kMod.openP4k(P);

if (isMainThread) await main(); else await worker();

async function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const P4K = flag('--p4k', null), RAW = flag('--raw', null), LIST = flag('--list', null), OUT = flag('--out', null);
  const ONLY = (flag('--only', '') || '').split(',').filter(Boolean);
  // --erzwingen: die --only-Items neu backen, auch wenn ihr Eingabe-Hash passt
  // (Korrektur im Backen, die den Hash nicht berührt).
  const FORCE = argv.includes('--erzwingen'); if (FORCE) argv.splice(argv.indexOf('--erzwingen'), 1);
  const LIMIT = Number(flag('--limit', 0));
  // --zensus <datei>: nichts backen, je Item die Merkmale aller gezeichneten
  // Teilmaterialien als Zeile in <datei> (jsonl); setzt nicht fort.
  const ZENSUS = flag('--zensus', null);
  const opts = { tex: Number(flag('--tex', 1024)), lod: Number(flag('--lod', 1)), cacheMb: Number(flag('--cache-mb', 400)) };
  const WORKERS = Number(flag('--workers', Math.max(1, Math.min(6, cpus().length - 2))));
  if (!Number.isInteger(WORKERS) || WORKERS < 1) { console.error('--workers braucht eine ganze Zahl ab 1'); process.exit(2); }
  if (!OUT || (!P4K && !RAW)) { console.error('Aufruf: --p4k <Data.p4k> --list <json> --out <ordner>  |  --raw <rohOrdner> --out <ordner>'); process.exit(2); }
  const { BAKE_VERSION, makeP4kProvider, makeDirProvider } = await import(pathToFileURL(join(HIER, 'bake.mjs')).href);
  if (!RAW) p4kMod = await import(libUrl('p4k.mjs'));
  // Die Tabelle gehört zur Eingabe: ordnet sie ein Merkmal neu ein, ändern
  // sich die Befunde, also wird neu gebacken.
  const TABELLE = sha(readFileSync(join(HIER, '..', 'lib', 'item3d-merkmale.mjs')), 8);
  mkdirSync(join(OUT, 'm'), { recursive: true });
  mkdirSync(join(OUT, 't'), { recursive: true });
  zeilenendeHeilen(join(OUT, 'manifest.jsonl'));
  zeilenendeHeilen(join(OUT, 'fehler.jsonl'));
  const t0 = Date.now();
  const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s]`, ...a);

  // Eine Zählung schreibt nie ins Bauprotokoll (ein Fehlschlag dort sperrte
  // ein gebautes Modell). Was sie nicht zählen konnte, auch ein Item ohne
  // Record, steht in ohneZaehlung und macht sie rot; Testeinträge des Spiels
  // sind ausdrücklich ausgenommen und werden nur genannt.
  const ohneZaehlung = [], testeintraege = [];
  const aufloesFehler = (o) => { if (ZENSUS) ohneZaehlung.push(o.id); else fehlerZeile(OUT, o); };

  // ─── Items und Paletten auflösen ──────────────────────────────────────
  let items = [], refs = {};
  if (RAW) {
    const info = JSON.parse(readFileSync(join(RAW, 'info.json'), 'utf8'));
    if (ZENSUS) for (const it of info.items) if (it.missing && (!ONLY.length || ONLY.includes(it.id))) ohneZaehlung.push(it.id);
    items = info.items.filter((it) => !it.missing).map((it) => ({ id: it.id, guid: it.guid, t: it.t, record: it.record, geo: it.geo }));
    refs = info.refs ?? {};
  } else {
    const { openP4k } = await import(libUrl('p4k.mjs'));
    const { openDataCore } = await import(libUrl('datacore.mjs'));
    const list = JSON.parse(readFileSync(LIST, 'utf8'));
    const p4k = openP4k(P4K);
    log('p4k', p4k.entryCount, 'Einträge');
    let db = openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i));
    log('DataCore', db.records.length, 'Records');
    const refIds = new Set();
    let byName = null;
    for (const it of list) {
      if (ONLY.length && !ONLY.includes(it.id)) continue;
      const rec = db.recordById.get(it.guid);
      if (!rec) { aufloesFehler({ id: it.id, fehler: 'kein Record' }); continue; }
      if (/(^|\.)test_/i.test(rec.name)) { if (ZENSUS) testeintraege.push(it.id); else fehlerZeile(OUT, { id: it.id, fehler: `Testeintrag ${rec.name}` }); continue; }
      const obj = db.readRecord(rec, { typed: true, maxDepth: 10 });
      const geo = (obj?.Components ?? []).find((c) => c?.__type === 'SGeometryResourceParams') ?? null;
      (function walk(o, d = 0) { if (!o || typeof o !== 'object' || d > 40) return; if (o.__ref && o.name) refIds.add(o.__ref); for (const v of Object.values(o)) walk(v, d + 1); })(geo);
      // Waffen: das Serienmagazin hängt mit im Modell (wie im Spiel beim
      // Ansehen). Port -> Knoten aus dem Port-Container, Klasse aus der Serienausstattung.
      const kids = [];
      if (it.t === 'WeaponPersonal') {
        const comps = obj?.Components ?? [];
        const entries = comps.find((c) => c?.__type === 'SEntityComponentDefaultLoadoutParams')?.loadout?.entries ?? [];
        const ports = comps.find((c) => c?.__type === 'SItemPortContainerComponentParams')?.Ports ?? [];
        for (const e of entries) {
          if (!/magazine/i.test(e.itemPortName ?? '') || !(e.entityClassName || e.entityClassReference?.__ref)) continue;
          const port = ports.find((p) => p.Name === e.itemPortName);
          const h = port?.AttachmentImplementation?.Helper?.Helper;
          if (!h?.Name) continue;
          if (!byName) { byName = new Map(); for (const r of db.records) byName.set(r.name.toLowerCase(), r); }
          const krec = e.entityClassReference?.__ref ? db.recordById.get(e.entityClassReference.__ref) : byName.get(`entityclassdefinition.${e.entityClassName.toLowerCase()}`);
          if (!krec) continue;
          const kobj = db.readRecord(krec, { typed: true, maxDepth: 10 });
          const kgeo = (kobj?.Components ?? []).find((c) => c?.__type === 'SGeometryResourceParams') ?? null;
          if (!kgeo) continue;
          (function walk(o, d = 0) { if (!o || typeof o !== 'object' || d > 40) return; if (o.__ref && o.name) refIds.add(o.__ref); for (const v of Object.values(o)) walk(v, d + 1); })(kgeo);
          kids.push({ port: e.itemPortName, helper: h.Name, offset: h.Offset ?? null, record: krec.name, geo: kgeo });
        }
      }
      items.push({ id: it.id, guid: it.guid, t: it.t, record: rec.name, geo, kids });
    }
    for (const g of refIds) {
      const r = db.recordById.get(g);
      if (r) refs[g] = { name: r.name, data: db.readRecord(r, { typed: true, maxDepth: 8 }) };
    }
    db = null;
    p4k.close();
    log(items.length, 'Items aufgelöst,', Object.keys(refs).length, 'Paletten');
  }
  if (ONLY.length) items = items.filter((it) => ONLY.includes(it.id));

  // Eingabe-Kennung: ändert sich Geometrie, Palette, Record-Name (wählt die
  // Ausführung), Item-Art (Waffenpfad) oder Backfassung, wird neu gebacken
  for (const it of items) {
    const used = [];
    (function walk(o, d = 0) { if (!o || typeof o !== 'object' || d > 40) return; if (o.__ref && refs[o.__ref]) used.push(refs[o.__ref]); for (const v of Object.values(o)) walk(v, d + 1); })([it.geo, it.kids ?? []]);
    it.in = sha(JSON.stringify([BAKE_VERSION, TABELLE, opts.tex, opts.lod, it.record ?? null, it.t ?? null, it.geo, it.kids?.length ? it.kids : undefined, used]), 12);
  }
  const done = zeilen(join(OUT, 'manifest.jsonl'));
  // Vorhanden heißt: Modell UND alle seine Bilder liegen im Ausgabeordner.
  const dateienDa = (d) => existsSync(join(OUT, d.file)) && (d.tex ?? []).every((h) => existsSync(join(OUT, 't', `${h}.webp`)));
  // Fertig ist ein Item nur, wenn Record-Eingabe UND Quellen unverändert
  // sind: jede Datei, die sein Bau gelesen hat (Netz, Material, Schichten,
  // Bilder), mit ihrer Kennung im Archiv. Ein Patch, der nur ein Material oder
  // Bild ändert, backt so neu, statt das alte Modell stehen zu lassen.
  // Einträge ohne Quellenliste (älterer Bäcker) gelten als veraltet.
  // Ebenso ein Item, das nach seinem letzten Erfolg gescheitert ist (dieselbe
  // Regel wie in manifest.mjs, das sein altes Modell dann sperrt): erst ein
  // neuer Erfolg gibt es wieder frei.
  let quellenAlt = 0, nachFehler = 0;
  let todo;
  if (ZENSUS) todo = items.slice();
  else {
    const gescheitert = new Map();
    for (const f of zeilenAlle(join(OUT, 'fehler.jsonl'))) gescheitert.set(f.id, Math.max(gescheitert.get(f.id) ?? 0, Number(f.zeit) || 0));
    let prov = null;
    const kennung = (liste) => {
      if (!prov) prov = RAW ? makeDirProvider(RAW) : makeP4kProvider(openP4kFuer(P4K));
      return quellenKennung(prov, liste);
    };
    todo = items.filter((it) => {
      if (FORCE && ONLY.includes(it.id)) return true;
      const d = done.get(it.id);
      if (!(d?.in === it.in && dateienDa(d))) return true;
      if ((gescheitert.get(it.id) ?? 0) > (Number(d.zeit) || 0)) { nachFehler++; return true; }
      if (!d.quellen || kennung(d.quellen) !== d.q) { quellenAlt++; return true; }
      return false;
    });
  }
  if (ZENSUS) writeFileSync(ZENSUS, '');
  if (LIMIT) todo = todo.slice(0, LIMIT);
  let fertig = 0, fehler = 0, abgestuerzt = 0, verloren = 0;
  const grund = [quellenAlt && `${quellenAlt} mit geänderten oder ungeprüften Quellen`, nachFehler && `${nachFehler} nach einem Fehlschlag`].filter(Boolean);
  log(`${items.length} Items, ${items.length - todo.length} schon fertig, ${todo.length} zu ${ZENSUS ? 'zählen' : 'backen'}${grund.length ? ` (davon ${grund.join(', ')})` : ''}, ${WORKERS} Arbeiter`);
  if (testeintraege.length) log(`${testeintraege.length} Testeinträge ausgelassen: ${testeintraege.slice(0, 10).join(', ')}${testeintraege.length > 10 ? ' …' : ''}`);
  if (!todo.length) return abschluss();

  // Nach Grundmodell gruppieren, damit Bilder im Zwischenspeicher bleiben
  const keyOf = (it) => {
    const g = it.geo?.Geometry, subs = g?.SubGeometry ?? [];
    const male = subs.find((s) => /(^|\s)male(\s|$)/i.test(s.Tags || ''));
    return (male ?? g)?.Geometry?.Geometry?.path?.toLowerCase() ?? `~${it.id}`;
  };
  const groups = new Map();
  for (const it of todo) { const k = keyOf(it); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  const queue = [...groups.values()].sort((a, b) => b.length - a.length);
  log(`${queue.length} Grundmodelle`);

  const startBake = Date.now();
  // Ein Arbeiter, der mitten in einer Gruppe endet (Absturz, Speicher), darf
  // ihre unbestätigten Items nicht verschlucken: das laufende Item wird als
  // Fehler vermerkt, der Rest der Gruppe neu eingeplant, ein Ersatz gestartet.
  // Was danach noch fehlt, macht den Lauf rot (Exit 1), statt „fertig“ zu melden.
  const ERSATZ_MAX = 20;
  let ersatz = 0;
  await new Promise((resolveAll) => {
    let alive = 0;
    const spawn = () => {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { P4K, RAW, OUT, refs, opts, ZENSUS } });
      alive++;
      let job = null; const bestaetigt = new Set();
      const next = () => { job = queue.shift() ?? null; bestaetigt.clear(); w.postMessage(job); };
      w.on('message', (m) => {
        if (m.ready) return next();
        if (m.groupDone) return next();
        const id = m.zensus?.id ?? m.ok?.id ?? m.fail?.id;
        if (id) bestaetigt.add(id);
        if (m.zensus) { appendFileSync(ZENSUS, `${JSON.stringify(m.zensus)}\n`); fertig++; if (fertig % 200 === 0) log(`Zählung ${fertig}/${todo.length}`); return; }
        if (m.ok) {
          appendFileSync(join(OUT, 'manifest.jsonl'), `${JSON.stringify({ ...m.ok, tab: TABELLE, zeit: Date.now() })}\n`);
          fertig++;
        } else {
          // Die Zählung schreibt nicht ins Bauprotokoll; ihr fehlt das Item,
          // und der Lauf endet rot.
          if (ZENSUS) ohneZaehlung.push(m.fail.id); else fehlerZeile(OUT, m.fail);
          fehler++;
        }
        const n = fertig + fehler, per = (Date.now() - startBake) / n;
        const eta = Math.round(((todo.length - n) * per) / 60000);
        log(`[${n}/${todo.length}] ${m.ok ? `${m.ok.id}  ${m.ok.kb} KB  ${m.ok.tris} Dr.  ${(m.ok.ms / 1000).toFixed(1)} s${m.ok.halt ? '  ANGEHALTEN' : ''}` : `FEHLT ${m.fail.id}: ${m.fail.fehler}`}  (noch ~${eta} min)`);
      });
      w.on('error', (e) => { log('Arbeiter-Fehler:', e.stack ?? e.message); });
      w.on('exit', (code) => {
        alive--;
        const offen = job ? job.filter((it) => !bestaetigt.has(it.id)) : [];
        if (offen.length) {
          const [lief, ...rest] = offen;
          abgestuerzt++;
          log(`Arbeiter endete (Code ${code}) während ${lief.id}; ${rest.length} weitere Items der Gruppe neu eingeplant`);
          if (ZENSUS) ohneZaehlung.push(lief.id); else fehlerZeile(OUT, { id: lief.id, fehler: `Arbeiter endete beim Backen (Code ${code})` });
          fehler++;
          if (rest.length) queue.unshift(rest);
          if (ersatz < ERSATZ_MAX) { ersatz++; spawn(); }
        }
        if (!alive) { for (const g of queue) verloren += g.length; queue.length = 0; resolveAll(); }
      });
    };
    for (let i = 0; i < Math.min(WORKERS, queue.length); i++) spawn();
  });
  abschluss();

  function unvollstaendig() {
    if (!abgestuerzt && !verloren && !ohneZaehlung.length) return false;
    log(`UNVOLLSTÄNDIG: ${[abgestuerzt && `${abgestuerzt} Arbeiter mitten in der Arbeit beendet`, verloren && `${verloren} Items nie gebacken`, ohneZaehlung.length && `${ohneZaehlung.length} Items ohne Zählung (${ohneZaehlung.slice(0, 10).join(', ')}${ohneZaehlung.length > 10 ? ' …' : ''})`].filter(Boolean).join(', ')}`);
    process.exitCode = 1;
    return true;
  }
  // „fertig“ nur, wenn nichts fehlt; sonst steht dort UNVOLLSTÄNDIG. Gilt
  // auch, wenn nichts zu tun war (etwa jedes Item ohne Record).
  function abschluss() {
    if (ZENSUS) { if (!unvollstaendig()) log(`Zählung fertig: ${fertig} Items -> ${ZENSUS}`); return; }
    summary(unvollstaendig());
  }

  function summary(offen = false) {
    const rows = zeilen(join(OUT, 'manifest.jsonl'));
    const tex = new Set(); let glb = 0;
    for (const r of rows.values()) { glb += r.glbKb; for (const h of r.tex ?? []) tex.add(h); }
    let texBytes = 0;
    for (const h of tex) { const f = join(OUT, 't', `${h}.webp`); if (existsSync(f)) texBytes += statSync(f).size; }
    const halt = [...rows.values()].filter((r) => r.halt);
    log(`${offen ? 'Stand (Lauf UNVOLLSTÄNDIG)' : 'fertig'}: ${rows.size} Items im Bestand (dieser Lauf ${fertig} neu, ${fehler} ohne Modell, ${halt.length} angehalten)`);
    if (halt.length) log(`angehalten (manifest.mjs lässt sie weg): ${halt.slice(0, 20).map((r) => r.id).join(', ')}${halt.length > 20 ? ' …' : ''}`);
    log(`Größe: Netze ${(glb / 1024).toFixed(0)} MB, Bilder ${(texBytes / 1048576).toFixed(0)} MB (${tex.size} Bilder, geteilt), zusammen ${((glb * 1024 + texBytes) / 1073741824).toFixed(2)} GB`);
  }
}

async function worker() {
  const { P4K, RAW, OUT, refs, opts, ZENSUS } = workerData;
  const bakeMod = await import(pathToFileURL(join(HIER, 'bake.mjs')).href);
  let provider;
  if (RAW) provider = bakeMod.makeDirProvider(RAW);
  else { const { openP4k } = await import(libUrl('p4k.mjs')); provider = bakeMod.makeP4kProvider(openP4k(P4K)); }
  const baker = await bakeMod.createBaker({ provider, refs, tex: opts.tex, lod: opts.lod, cacheMb: opts.cacheMb });
  // Inhaltsbenannte Dateien: liegt das Ziel nach einem gescheiterten
  // Umbenennen da, hat ein anderer Arbeiter denselben Inhalt geschrieben;
  // fehlt es, ist das ein echter Fehler und geht an das Item.
  const writeOnce = (file, data) => {
    if (existsSync(file)) return;
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    writeFileSync(tmp, data);
    try { renameSync(tmp, file); } catch (e) {
      try { unlinkSync(tmp); } catch {}
      if (!existsSync(file)) throw e;
    }
  };
  parentPort.on('message', async (job) => {
    if (!job) { process.exit(0); }
    for (const it of job) {
      const t = Date.now();
      try {
        if (ZENSUS) { const z = await baker.bake(it, { zensus: true }); parentPort.postMessage({ zensus: { id: it.id, t: it.t ?? null, skipped: z.skipped ?? null, halt: z.halt ?? null, merk: z.merk ?? {}, diag: z.diag } }); continue; }
        const r = await baker.bake(it);
        if (r.skipped) { parentPort.postMessage({ fail: { id: it.id, fehler: r.skipped, merk: r.merk, diag: r.diag } }); continue; }
        const { glb, images } = bakeMod.splitImages(r.glb, (b) => sha(b, 16));
        for (const im of images) writeOnce(join(OUT, 't', `${im.hash}.${im.ext}`), im.data);
        const file = `m/${it.id}.${sha(glb, 8)}.glb`;
        writeOnce(join(OUT, file), glb);
        const kb = Math.round((glb.length + images.reduce((s, im) => s + im.data.length, 0)) / 1024);
        parentPort.postMessage({ ok: { id: it.id, guid: it.guid, t: it.t ?? null, file, tex: images.map((im) => im.hash), glbKb: Math.round(glb.length / 1024), kb, tris: r.tris, verts: r.verts, sets: r.sets, which: r.which, palette: r.palette, colors: r.colors ?? undefined, in: it.in, quellen: r.quellen, q: quellenKennung(provider, r.quellen ?? []), ms: Date.now() - t, halt: r.halt, spiegel: r.spiegel, merk: r.merk, missingTex: r.diag?.missingTex?.length ? r.diag.missingTex : undefined } });
      } catch (e) {
        parentPort.postMessage({ fail: { id: it.id, fehler: String(e?.stack ?? e).split('\n').slice(0, 3).join(' | ') } });
      }
    }
    parentPort.postMessage({ groupDone: true });
  });
  parentPort.postMessage({ ready: true });
}
