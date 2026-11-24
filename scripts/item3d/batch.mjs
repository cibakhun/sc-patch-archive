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
// Jede Zeile des Manifests trägt die Befunde des Items (merk: Merkmal ->
// Dreiecke) und halt (ein Merkmal ist unbekannt oder ein Fehler, siehe
// scripts/lib/item3d-merkmale.mjs); manifest.mjs lässt solche Items weg.
// Ein abgebrochener Lauf setzt beim nächsten Start fort; unveränderte Items
// (gleiche Eingaben, gleiche Backfassung, gleiche Merkmal-Tabelle) werden
// übersprungen. REPO lenkt die Pakete (sharp, gltf-transform) um.
import { isMainThread, Worker, parentPort, workerData } from 'node:worker_threads';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, statSync } from 'node:fs';
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
  if (!OUT || (!P4K && !RAW)) { console.error('Aufruf: --p4k <Data.p4k> --list <json> --out <ordner>  |  --raw <rohOrdner> --out <ordner>'); process.exit(2); }
  const { BAKE_VERSION, makeP4kProvider, makeDirProvider } = await import(pathToFileURL(join(HIER, 'bake.mjs')).href);
  if (!RAW) p4kMod = await import(libUrl('p4k.mjs'));
  // Die Tabelle gehört zur Eingabe: ordnet sie ein Merkmal neu ein, ändern
  // sich die Befunde, also wird neu gebacken.
  const TABELLE = sha(readFileSync(join(HIER, '..', 'lib', 'item3d-merkmale.mjs')), 8);
  mkdirSync(join(OUT, 'm'), { recursive: true });
  mkdirSync(join(OUT, 't'), { recursive: true });
  const t0 = Date.now();
  const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s]`, ...a);

  // ─── Items und Paletten auflösen ──────────────────────────────────────
  let items = [], refs = {};
  if (RAW) {
    const info = JSON.parse(readFileSync(join(RAW, 'info.json'), 'utf8'));
    items = info.items.filter((it) => !it.missing).map((it) => ({ id: it.id, guid: it.guid, record: it.record, geo: it.geo }));
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
      if (!rec) { appendFileSync(join(OUT, 'fehler.jsonl'), `${JSON.stringify({ id: it.id, fehler: 'kein Record' })}\n`); continue; }
      if (/(^|\.)test_/i.test(rec.name)) { appendFileSync(join(OUT, 'fehler.jsonl'), `${JSON.stringify({ id: it.id, fehler: `Testeintrag ${rec.name}` })}\n`); continue; }
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

  // Eingabe-Kennung: ändert sich Geometrie, Palette oder Backfassung, wird neu gebacken
  for (const it of items) {
    const used = [];
    (function walk(o, d = 0) { if (!o || typeof o !== 'object' || d > 40) return; if (o.__ref && refs[o.__ref]) used.push(refs[o.__ref]); for (const v of Object.values(o)) walk(v, d + 1); })([it.geo, it.kids ?? []]);
    it.in = sha(JSON.stringify([BAKE_VERSION, TABELLE, opts.tex, opts.lod, it.geo, it.kids?.length ? it.kids : undefined, used]), 12);
  }
  const done = new Map();
  if (existsSync(join(OUT, 'manifest.jsonl'))) {
    for (const line of readFileSync(join(OUT, 'manifest.jsonl'), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const r = JSON.parse(line); done.set(r.id, r); } catch {}
    }
  }
  // Fertig ist ein Item nur, wenn Record-Eingabe UND Quellen unverändert
  // sind: jede Datei, die sein Bau gelesen hat (Netz, Material, Schichten,
  // Bilder), mit ihrer Kennung im Archiv. Ein Patch, der nur ein Material oder
  // Bild ändert, backt so neu, statt das alte Modell stehen zu lassen.
  // Einträge ohne Quellenliste (älterer Bäcker) gelten als veraltet.
  let quellenAlt = 0;
  let todo;
  if (ZENSUS) todo = items.slice();
  else {
    let prov = null;
    const kennung = (liste) => {
      if (!prov) prov = RAW ? makeDirProvider(RAW) : makeP4kProvider(openP4kFuer(P4K));
      return quellenKennung(prov, liste);
    };
    todo = items.filter((it) => {
      if (FORCE && ONLY.includes(it.id)) return true;
      const d = done.get(it.id);
      if (!(d?.in === it.in && existsSync(join(OUT, d.file)))) return true;
      if (!d.quellen || kennung(d.quellen) !== d.q) { quellenAlt++; return true; }
      return false;
    });
  }
  if (ZENSUS) writeFileSync(ZENSUS, '');
  if (LIMIT) todo = todo.slice(0, LIMIT);
  log(`${items.length} Items, ${items.length - todo.length} schon fertig, ${todo.length} zu backen${quellenAlt ? ` (davon ${quellenAlt} mit geänderten oder ungeprüften Quellen)` : ''}, ${WORKERS} Arbeiter`);
  if (!todo.length) return summary();

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

  let fertig = 0, fehler = 0;
  const startBake = Date.now();
  await new Promise((resolveAll) => {
    let alive = 0;
    const spawn = () => {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { P4K, RAW, OUT, refs, opts, ZENSUS } });
      alive++;
      const next = () => { const job = queue.shift(); if (job) w.postMessage(job); else w.postMessage(null); };
      w.on('message', (m) => {
        if (m.ready) return next();
        if (m.groupDone) return next();
        if (m.zensus) { appendFileSync(ZENSUS, `${JSON.stringify(m.zensus)}\n`); fertig++; if (fertig % 200 === 0) log(`Zählung ${fertig}/${todo.length}`); return; }
        if (m.ok) {
          appendFileSync(join(OUT, 'manifest.jsonl'), `${JSON.stringify(m.ok)}\n`);
          fertig++;
        } else {
          appendFileSync(join(OUT, 'fehler.jsonl'), `${JSON.stringify(m.fail)}\n`);
          fehler++;
        }
        const n = fertig + fehler, per = (Date.now() - startBake) / n;
        const eta = Math.round(((todo.length - n) * per) / 60000);
        log(`[${n}/${todo.length}] ${m.ok ? `${m.ok.id}  ${m.ok.kb} KB  ${m.ok.tris} Dr.  ${(m.ok.ms / 1000).toFixed(1)} s${m.ok.halt ? '  ANGEHALTEN' : ''}` : `FEHLT ${m.fail.id}: ${m.fail.fehler}`}  (noch ~${eta} min)`);
      });
      w.on('error', (e) => { log('Arbeiter-Fehler:', e.stack ?? e.message); });
      w.on('exit', () => { alive--; if (!alive) resolveAll(); });
    };
    for (let i = 0; i < Math.min(WORKERS, queue.length); i++) spawn();
  });
  if (ZENSUS) { log(`Zählung fertig: ${fertig} Items -> ${ZENSUS}`); return; }
  summary();

  function summary() {
    const rows = new Map();
    for (const line of readFileSync(join(OUT, 'manifest.jsonl'), 'utf8').split('\n')) { if (line.trim()) { const r = JSON.parse(line); rows.set(r.id, r); } }
    const tex = new Set(); let glb = 0;
    for (const r of rows.values()) { glb += r.glbKb; for (const h of r.tex) tex.add(h); }
    let texBytes = 0;
    for (const h of tex) { const f = join(OUT, 't', `${h}.webp`); if (existsSync(f)) texBytes += statSync(f).size; }
    const halt = [...rows.values()].filter((r) => r.halt);
    log(`fertig: ${rows.size} Items im Bestand (dieser Lauf ${fertig} neu, ${fehler} ohne Modell, ${halt.length} angehalten)`);
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
  const writeOnce = (file, data) => { if (existsSync(file)) return; const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`; writeFileSync(tmp, data); try { renameSync(tmp, file); } catch { /* gleichzeitig geschrieben: gleicher Inhalt */ } };
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
