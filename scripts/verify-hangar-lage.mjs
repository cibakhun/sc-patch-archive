/* ============================================================
   verify-hangar-lage.mjs — Tor gegen Innenräume außerhalb des Rumpfs,
   Innenräume neben dem Pilotensitz und lose Teile neben dem Rumpf
   (Schiene A).

   WARUM ES DEN GIBT: Krisz, 30.10.2026: „am ende sollen innenräüme auch
   dabei sein, und jedes schiff soll komplett angeschaut werden, innen und
   aussen“. Röntgenbilder zeigten Innenräume, die oben oder hinten aus dem
   Rumpf ragten (41 Schiffe), Container 8,5 m hinter dem Cockpit (Gladius:
   der Export setzte jeden interior_*-Container an den Schiffsursprung) und
   Teile, die frei neben dem Rumpf hingen (Hornet-Flügelwaffen,
   Feuerlöscherschrank über dem Avenger). Behoben im Bau (#269: Container
   an ihren Platz, heile Ablöseteile bleiben), Notizen
   .planning/notes/hangar-innenlage.md und hangar-inseln.md. Rutscht das
   bei einem Neubau zurück (anderer Bauweg, neues Schiff, neue
   Spielfassung), sieht die Seite von außen gut aus, bis jemand einsteigt.

   Dieses Tor liest das ARTEFAKT: die StageConfig von dist/de/hangar.html.
   Je Schiff die Werkslack-Datei (models[id][1]), je Innenraum
   opts.interior[pfad] mit Datei und Metadaten (Sitze) aus dist/. Die
   Rechnung steht in scripts/lib/hangar-lage.mjs (dieselbe wie in den
   Werkzeugen measure-hangar-innenlage und measure-hangar-inseln), mit der
   Regel des ausgelieferten Viewers, was er nicht zeichnet (hiddenMaterial:
   POM-Decals, Schadensnetze, Platzhalterwand).

   KLINKE je Schiff: scripts/lib/hangar-lage-klinke.json trägt je Schiff
   die erlaubten Werte und den Fingerabdruck der gemessenen Dateien. Gleicher
   Fingerabdruck und gleiche Fassung der Rechnung → der Wert gilt ohne neue
   Messung (die Rechnung ist deterministisch); sonst wird gemessen, mit
   allen Kernen (alle Schiffe: gut 2 Minuten auf 4 Kernen).

   ZUSICHERUNGEN
     [1] Jedes Schiff der Seite mit Werkslack-Datei liegt in dist/ (mindestens
         KLINKE_SCHIFFE), jeder Innenraum mit Datei und Metadaten (mindestens
         KLINKE_INNEN), und jeder gehört zu einem Schiff der Seite.
     [2] Innenraum außerhalb des Rumpfs: je Schiff höchstens Klinke + TOL_PP
         Prozentpunkte der Dreiecke (FEHLER). Über DECKEL Prozent nur mit
         benannter Ausnahme (FEHLER), eine Ausnahme unter DECKEL ist ein
         Zombie (FEHLER). Innenräume ab DECKEL: höchstens die Klinke aussen1.
     [3] Pilotensitz: Ein Innenraum mit Dreiecken hat am Pilotensitz
         mindestens SITZ_MIN Dreiecke bis SITZ_R (FEHLER: der Container sitzt
         neben dem Cockpit). Innenräume ohne Dreiecke (ihr Cockpit ist Teil
         des Rumpfs, die Datei trägt nur Lichter) zählen nur mit.
         Ein Innenraum mit Dreiecken ohne Sitz in den Metadaten braucht eine
         benannte Ausnahme (FEHLER: dann prüft nichts, ob er am Cockpit
         liegt), eine Ausnahme mit Sitz ist ein Zombie (FEHLER).
         Sitze mit Innenraum: mindestens die Klinke sitzOk.
     [4] Lose Teile: Ein Schiff mit Teilen, die getrennt außerhalb des
         Hüllquaders seines Rumpfs hängen, braucht eine benannte Ausnahme
         (FEHLER); mehr Inseln oder weiter draußen als seine Klinke ist
         FEHLER, eine Ausnahme ohne Insel ein Zombie (FEHLER). Schiffe mit
         losen Teilen: höchstens die Klinke mitInseln.

   NACHZIEHEN (nach einem Neubau, damit das Tor wieder ohne Messung
   auskommt):
     node scripts/verify-hangar-lage.mjs --nachziehen
   schreibt Fingerabdrücke, senkt Werte, streicht Zombies und Ausnahmen
   ohne Anlass. Ein Wert steigt nur mit Begründung, eine neue Ausnahme nur
   benannt:
     node scripts/verify-hangar-lage.mjs --nachziehen --anlass "<warum>"
     node scripts/verify-hangar-lage.mjs --nachziehen --ausnahme innen:<schiff>="<warum>"
     node scripts/verify-hangar-lage.mjs --nachziehen --ausnahme inseln:<schiff>="<warum>"
     node scripts/verify-hangar-lage.mjs --nachziehen --ausnahme sitz:<schiff>="<warum>"
   Was Nachziehen nicht heilen kann (fehlende Dateien, Klinke der Zahl der
   Schiffe, Innenraum neben dem Sitz, Schiff ohne Messung), bricht es ab,
   statt es in die Klinke zu schreiben.
   (Grundsatz 5: nach oben nur per Commit, dessen Botschaft die Ursache
   nennt). Danach das Tor ohne Schalter laufen lassen.
   ============================================================ */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { WERKZEUG, SITZ_MIN, SITZ_R, readGeometry, sceneNodes, hullSpans, judge, seatCheck, pickSeat, islands } from './lib/hangar-lage.mjs';

// Hilfsfaden: misst die Schiffe aus workerData.part und meldet je Schiff
if (!isMainThread) {
  const { hiddenMaterial } = await import(pathToFileURL(workerData.viewer).href);
  const verborgen = (name) => !!hiddenMaterial(name);
  for (const s of workerData.part) parentPort.postMessage({ id: s.id, r: await measureShip(s, verborgen) });
} else await main();

async function measureShip({ hull, inner, meta }, verborgen) {
  const nodes = sceneNodes(await readGeometry(hull));
  const isl = islands(nodes, { verborgen });
  const r = { inseln: (isl?.inseln ?? []).map((c) => ({ tris: c.tris, aussenM: c.aussenM, material: c.materialien[0] ?? '?' })) };
  if (!inner) return r;
  // den groben Innenraum im Rumpf (extras.interior) nicht als Rumpf zählen
  const hullNodes = nodes.filter((n) => !n.getExtras()?.interior);
  const innerNodes = sceneNodes(await readGeometry(inner));
  const spans = hullSpans(hullNodes, verborgen);
  if (!spans) return { ...r, innen: { tris: 0, aussenPct: 0, maxM: 0 }, sitz: null };
  const j = judge(spans, innerNodes, { verborgen });
  const seat = pickSeat((JSON.parse(readFileSync(meta, 'utf8')).spots ?? []).filter((s) => s.kind === 'seat'));
  const sz = seat ? seatCheck(seat, innerNodes, hullNodes, { verborgen }) : null;
  return { ...r, innen: { tris: j.tris, aussenPct: j.aussenPct, maxM: j.maxM }, sitz: sz && { name: sz.name, nah: sz.nah, abstand: sz.abstand, ok: sz.ok } };
}

async function main() {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const DIST = join(ROOT, 'dist');
  const PAGE = join('de', 'hangar.html');
  const KLINKE_FILE = join(ROOT, 'scripts', 'lib', 'hangar-lage-klinke.json');
  // 31.10.2026, Stand nach #276 (Komponenten an ihren Ports): alle 231
  // Schiffe der Seite mit Werkslack, 217 begehbare Innenräume
  const KLINKE_SCHIFFE = 231, KLINKE_INNEN = 217;
  // Spiel eines Neubaus (Dezimierung trifft andere Dreiecke): 0,3
  // Prozentpunkte. Mehr ist ein Rückfall (Gladius vor #269: 0 % außen, aber
  // 8,5 m neben dem Sitz; Cutlass Black vor #269: 9 %).
  const TOL_PP = 0.3;
  // Innenraum ohne Ausnahme: ab hier rot
  const DECKEL = 1;
  // weiter draußen als die Klinke, bevor eine bekannte Insel rot wird (Voxel 0,5 m)
  const TOL_M = 0.5;

  const argv = process.argv.slice(2);
  const NACHZIEHEN = argv.includes('--nachziehen');
  const anlassAt = argv.indexOf('--anlass');
  const ANLASS = anlassAt >= 0 ? argv[anlassAt + 1] : null;
  const AUSNAHME = { innen: {}, inseln: {}, sitz: {} };
  argv.forEach((a, i) => {
    const m = a === '--ausnahme' ? /^(innen|inseln|sitz):([^=]+)=(.+)$/s.exec(argv[i + 1] ?? '') : null;
    if (m) AUSNAHME[m[1]][m[2]] = m[3];
  });

  const findings = [], warnings = [], hart = [];
  const say = (s) => console.log(s);
  const fail = (s) => findings.push(s);
  // FEHLER, die --nachziehen nicht heilen kann: es bricht dann ab
  const failHart = (s) => { findings.push(s); hart.push(s); };
  const warn = (s) => warnings.push(s);
  const sollIst = (soll, ist) => say(`    Soll: ${soll}\n    Ist:  ${ist}`);
  const pathOf = (u) => decodeURI(String(u).split('?')[0]);
  const inDist = (u) => join(DIST, pathOf(u).replace(/^\//, ''));
  const list = (a, k = 6) => `${a.slice(0, k).join(', ')}${a.length > k ? ', …' : ''}`;

  say(`verify-hangar-lage: prueft ${join('dist', PAGE)}, jede Werkslack-Datei und jeden Innenraum, die sie laedt (Rechnung ${WERKZEUG})`);
  if (!existsSync(join(DIST, PAGE))) {
    console.error(`\nverify-hangar-lage: ${join('dist', PAGE)} fehlt — erst bauen (npm run build)\n`);
    process.exit(1);
  }
  const html = readFileSync(join(DIST, PAGE), 'utf8');
  const sm = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(html);
  const stage = sm ? JSON.parse(sm[1]) : null;
  if (!stage?.models) {
    console.error(`\nverify-hangar-lage: ${PAGE} ohne StageConfig (#hg-stage)\n`);
    process.exit(1);
  }
  // Was der Viewer nicht zeichnet, zählt nicht: hiddenMaterial aus dem
  // ausgelieferten Viewer, dieselbe Regel wie dort
  const viewer = stage.viewer ? inDist(stage.viewer) : null;
  let vm = null;
  try { vm = viewer && existsSync(viewer) ? await import(pathToFileURL(viewer).href) : null; } catch (e) { failHart(`der Viewer ${stage.viewer} laedt nicht als Modul (${e.message})`); }
  if (typeof vm?.hiddenMaterial !== 'function' || typeof vm?.isDamageMesh !== 'function') {
    console.error('\nverify-hangar-lage: der ausgelieferte Viewer exportiert hiddenMaterial oder isDamageMesh nicht: Dann zaehlt dieses Tor Flaechen mit, die der Viewer verbirgt (POM-Decals, Schadensnetze, Platzhalterwand)\n');
    process.exit(1);
  }
  const klinke = existsSync(KLINKE_FILE) ? JSON.parse(readFileSync(KLINKE_FILE, 'utf8')) : { schiffe: {} };
  const K = klinke.schiffe ?? {};

  // ---- [1] ----
  say('\n[1] Jedes Schiff der Seite mit Werkslack-Datei und jeder Innenraum liegt in dist/');
  const interior = stage.opts?.interior ?? {};
  const ships = Object.entries(stage.models).filter(([, m]) => m[1]).map(([id, m]) => {
    const inf = interior[pathOf(m[1])];
    return { id, hull: inDist(m[1]), ...(inf ? { inner: inDist(inf.url), meta: inDist(inf.meta) } : {}) };
  });
  const hullPaths = new Set(Object.values(stage.models).filter((m) => m[1]).map((m) => pathOf(m[1])));
  const waise = Object.keys(interior).filter((p) => !hullPaths.has(p));
  const fehlt = ships.flatMap((s) => [s.hull, s.inner, s.meta].filter((f) => f && !existsSync(f)).map((f) => `${s.id}: ${f.slice(DIST.length + 1)}`));
  const mitInnen = ships.filter((s) => s.inner);
  sollIst(`mindestens ${KLINKE_SCHIFFE} Schiffe mit Werkslack und ${KLINKE_INNEN} Innenraeume, jede Datei in dist/, kein Innenraum ohne Schiff`,
    `${ships.length} Schiffe, ${mitInnen.length} mit Innenraum, ${fehlt.length} Dateien fehlen, ${waise.length} Innenraeume ohne Schiff`);
  for (const f of fehlt) failHart(`[1] ${f} fehlt in dist/`);
  for (const p of waise) failHart(`[1] Innenraum zu ${p}, aber kein Schiff der Seite laedt diese Datei: Der Viewer findet ihn nie (opts.interior ist nach dem Pfad der Werkslack-Datei geschluesselt)`);
  if (ships.length < KLINKE_SCHIFFE) failHart(`[1] nur ${ships.length} Schiffe mit Werkslack auf der Seite (Klinke ${KLINKE_SCHIFFE})`);
  if (mitInnen.length < KLINKE_INNEN) failHart(`[1] nur ${mitInnen.length} Innenraeume auf der Seite (Klinke ${KLINKE_INNEN})`);

  // ---- Messung oder Klinke ----
  const here = ships.filter((s) => [s.hull, s.inner, s.meta].every((f) => !f || existsSync(f)));
  for (const s of here) {
    const h = createHash('sha256');
    for (const f of [s.hull, s.inner, s.meta]) if (f) h.update(readFileSync(f));
    s.sha = h.digest('hex').slice(0, 16);
  }
  // Fassung = Rechnung plus Regel des Viewers, was er verbirgt: ändert sich
  // eins, gilt kein Wert aus der Klinke mehr ohne neue Messung
  const FASSUNG = `${WERKZEUG}, verborgen ${createHash('sha256').update(String(vm.hiddenMaterial)).update(String(vm.isDamageMesh)).digest('hex').slice(0, 8)}`;
  const known = klinke.werkzeug === FASSUNG;
  const res = new Map();
  for (const s of here) if (known && K[s.id]?.sha === s.sha && K[s.id].gemessen) res.set(s.id, K[s.id].gemessen);
  const todo = here.filter((s) => !res.has(s.id));
  say('');
  if (todo.length) {
    // große Schiffe zuerst verteilen, damit kein Faden am Ende allein rechnet
    const size = (s) => [s.hull, s.inner].reduce((a, f) => a + (f ? readFileSync(f).length : 0), 0);
    const order = todo.map((s) => ({ s, b: size(s) })).sort((a, b) => b.b - a.b).map((x) => x.s);
    const n = Math.max(1, Math.min(availableParallelism(), order.length, 4));
    const t0 = Date.now();
    await Promise.all(Array.from({ length: n }, (_, w) => new Promise((ok, no) => {
      const part = order.filter((_, i) => i % n === w).map(({ id, hull, inner, meta }) => ({ id, hull, inner, meta }));
      const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { part, viewer }, resourceLimits: { maxOldGenerationSizeMb: 4096 } });
      wk.on('message', ({ id, r }) => res.set(id, r));
      wk.on('error', no);
      wk.on('exit', (c) => (c ? no(new Error(`Messung endete mit ${c}`)) : ok()));
    })));
    say(`    ${todo.length} Schiffe gemessen (${n} Kerne, ${((Date.now() - t0) / 1000).toFixed(0)} s), ${here.length - todo.length} per Fingerabdruck aus der Klinke${known ? '' : ` (Klinke von ${klinke.werkzeug ?? '—'}, jetzt ${FASSUNG}: alle neu)`}`);
  } else say(`    alle ${here.length} Schiffe per Fingerabdruck aus der Klinke (keine Datei geaendert)`);
  const zombies = Object.keys(K).filter((id) => !here.some((s) => s.id === id));
  for (const id of zombies) fail(`Klinke ${id} ohne Schiff auf der Seite: mit --nachziehen streichen`);
  const neu = here.filter((s) => !K[s.id]).map((s) => s.id);
  if (neu.length) warn(`${neu.length} Schiffe ohne Klinke (${list(neu)}): --nachziehen`);
  if (todo.length && !NACHZIEHEN) warn(`${todo.length} Schiffe neu gemessen: mit --nachziehen die Fingerabdruecke eintragen, dann kommt das Tor ohne Messung aus`);

  // ---- [2] ----
  say('\n[2] Innenraum ausserhalb des Rumpfs: Anteil der Dreiecke je Schiff gegen seine Klinke');
  const innen = here.filter((s) => res.get(s.id)?.innen);
  const over2 = [], soft2 = [];
  for (const s of innen) {
    const r = res.get(s.id).innen, k = K[s.id];
    if (r.aussenPct >= DECKEL && !k?.ausnahmeInnen) fail(`[2] ${s.id}: ${r.aussenPct} % des Innenraums liegen ausserhalb des Rumpfs (bis ${r.maxM} m, ohne benannte Ausnahme unter ${DECKEL} %): Lage der Container im Bau pruefen (placeContainers, Offset aus den Container-Daten), mit measure-hangar-innenlage --versatz und im Roentgenbild ansehen; stimmt es, Ausnahme mit --nachziehen --ausnahme innen:${s.id}="<warum>"`);
    if (k?.ausnahmeInnen && r.aussenPct < DECKEL) fail(`[2] ${s.id}: Ausnahme „${k.ausnahmeInnen}“ ohne Anlass, nur noch ${r.aussenPct} % ausserhalb: mit --nachziehen streichen`);
    if (k?.aussenPct == null) continue;
    if (r.aussenPct > k.aussenPct + TOL_PP) over2.push(`${s.id}: ${r.aussenPct} % ausserhalb, Klinke ${k.aussenPct} %`);
    else if (r.aussenPct > k.aussenPct) soft2.push(`${s.id} ${k.aussenPct} → ${r.aussenPct} %`);
  }
  const ab1 = innen.filter((s) => res.get(s.id).innen.aussenPct >= DECKEL);
  const ausn2 = innen.filter((s) => K[s.id]?.ausnahmeInnen).map((s) => s.id);
  const triIn = innen.reduce((a, s) => a + res.get(s.id).innen.tris, 0);
  sollIst(`kein Innenraum mehr als ${TOL_PP} Prozentpunkte ueber seiner Klinke, keiner ab ${DECKEL} % ohne benannte Ausnahme, ab ${DECKEL} % hoechstens ${klinke.aussen1 ?? '—'}`,
    `${innen.length} Innenraeume, ${triIn} Dreiecke; ${over2.length} ueber der Klinke, ${soft2.length} knapp darueber; ab ${DECKEL} %: ${ab1.length}${ab1.length ? ` (${ab1.map((s) => `${s.id} ${res.get(s.id).innen.aussenPct} %`).join(', ')})` : ''}; Ausnahmen ${ausn2.length}`);
  for (const o of over2) fail(`[2] ${o}: Container beim Neubau verrutscht? Roentgenbild ansehen; begruendet anheben nur mit --nachziehen --anlass`);
  for (const o of soft2) warn(`[2] ${o} (innerhalb ${TOL_PP} Prozentpunkte)`);
  if (klinke.aussen1 != null && ab1.length > klinke.aussen1) fail(`[2] ${ab1.length} Innenraeume ab ${DECKEL} % ausserhalb, Klinke ${klinke.aussen1}`);

  // ---- [3] ----
  say(`\n[3] Pilotensitz: Innenraum mit Dreiecken liegt am Sitz (mindestens ${SITZ_MIN} Dreiecke bis ${SITZ_R} m)`);
  const mitSitz = innen.filter((s) => res.get(s.id).sitz);
  const leer = mitSitz.filter((s) => !res.get(s.id).innen.tris).map((s) => s.id);
  const daneben = mitSitz.filter((s) => res.get(s.id).innen.tris && !res.get(s.id).sitz.ok);
  const sitzOk = mitSitz.filter((s) => res.get(s.id).sitz.ok).length;
  const ohneSitz = innen.filter((s) => !res.get(s.id).sitz && res.get(s.id).innen.tris).map((s) => s.id);
  const ausn3 = innen.filter((s) => K[s.id]?.ausnahmeSitz).map((s) => s.id);
  sollIst(`jeder Innenraum mit Dreiecken am Pilotensitz, ohne Sitzangabe nur mit benannter Ausnahme, mindestens ${klinke.sitzOk ?? '—'} Sitze mit Innenraum`,
    `${mitSitz.length} Innenraeume mit Sitz: ${sitzOk} am Sitz, ${daneben.length} daneben, ${leer.length} ohne Dreiecke (Cockpit im Rumpf: ${list(leer, 4)}); mit Dreiecken ohne Sitzangabe ${ohneSitz.length}${ohneSitz.length ? ` (${ohneSitz.join(', ')})` : ''}; Ausnahmen ${ausn3.length}`);
  for (const id of ohneSitz) if (!K[id]?.ausnahmeSitz) fail(`[3] ${id}: Innenraum mit ${res.get(id).innen.tris} Dreiecken, aber kein Sitz in den Metadaten: Dann prueft nichts, ob er am Cockpit liegt. Sitze im Bau pruefen (spots kind seat aus den Helfern hardpoint_*seat*); fehlen sie im Spiel, Ausnahme mit --nachziehen --ausnahme sitz:${id}="<warum>"`);
  for (const id of ausn3) if (!ohneSitz.includes(id)) fail(`[3] ${id}: Ausnahme „${K[id].ausnahmeSitz}“ ohne Anlass, der Innenraum hat einen Sitz oder keine Dreiecke mehr: mit --nachziehen streichen`);
  for (const s of daneben) { const z = res.get(s.id).sitz; failHart(`[3] ${s.id}: am Pilotensitz ${z.name} nur ${z.nah} Dreiecke des Innenraums bis ${SITZ_R} m (naechstes ${z.abstand ?? '—'} m): Der Container sitzt neben dem Cockpit (Gladius vor #269: 8,5 m dahinter). Lage im Bau pruefen (placeContainers), beim Einsteigen ansehen`); }
  if (klinke.sitzOk != null && sitzOk < klinke.sitzOk) fail(`[3] nur ${sitzOk} Sitze mit Innenraum, Klinke ${klinke.sitzOk}`);

  // ---- [4] ----
  say('\n[4] Lose Teile: getrennte Teile ausserhalb des Huellquaders des Rumpfs, je Schiff gegen seine Klinke');
  const lose = here.filter((s) => res.get(s.id)?.inseln?.length);
  const maxM = (r) => Math.max(0, ...r.inseln.map((c) => c.aussenM));
  for (const s of here) {
    const r = res.get(s.id), k = K[s.id];
    if (!r) { failHart(`[4] ${s.id}: keine Messung`); continue; }
    const n = r.inseln.length;
    if (n && !k?.ausnahmeInseln) fail(`[4] ${s.id}: ${n} lose Teile neben dem Rumpf (${r.inseln.map((c) => `${c.tris} Dr. ${c.aussenM} m draussen, ${c.material}`).join('; ')}) ohne benannte Ausnahme: mit measure-hangar-inseln ${s.id} (am PC --roh mit Knotenpfad) suchen, welches Teil der Bau weglaesst oder falsch setzt; stimmt es, Ausnahme mit --nachziehen --ausnahme inseln:${s.id}="<warum>"`);
    if (!n && k?.ausnahmeInseln) fail(`[4] ${s.id}: Ausnahme „${k.ausnahmeInseln}“ ohne Anlass, kein loses Teil mehr: mit --nachziehen streichen`);
    if (n && k?.inseln != null && (n > k.inseln || maxM(r) > (k.inselM ?? 0) + TOL_M)) fail(`[4] ${s.id}: ${n} lose Teile bis ${maxM(r)} m draussen, Klinke ${k.inseln} bis ${k.inselM} m: neues loses Teil beim Neubau? Ansehen; begruendet anheben nur mit --nachziehen --anlass`);
  }
  const ausn4 = here.filter((s) => K[s.id]?.ausnahmeInseln).map((s) => s.id);
  sollIst(`kein Schiff mit losem Teil ohne benannte Ausnahme, keins ueber seiner Klinke, hoechstens ${klinke.mitInseln ?? '—'} Schiffe mit losen Teilen`,
    `${here.length} Ruempfe, ${lose.length} mit losen Teilen (${lose.map((s) => `${s.id} ${res.get(s.id).inseln.length}`).join(', ') || 'keins'}); Ausnahmen ${ausn4.length}`);
  if (klinke.mitInseln != null && lose.length > klinke.mitInseln) fail(`[4] ${lose.length} Schiffe mit losen Teilen, Klinke ${klinke.mitInseln}`);

  say('\n[Selbstauskunft]');
  say(`    Schiffe: ${here.length}   Innenraeume: ${innen.length}   gemessen: ${todo.length}   aus der Klinke: ${here.length - todo.length}   Innenraum-Dreiecke: ${triIn}   Sitze am Innenraum: ${sitzOk}   lose Teile: ${lose.reduce((a, s) => a + res.get(s.id).inseln.length, 0)} an ${lose.length} Schiffen`);

  if (NACHZIEHEN) {
    const steigt = [], ohne = [], gestrichen = [];
    const schiffe = {};
    for (const s of here) {
      const r = res.get(s.id); if (!r) continue;
      const k = K[s.id], e = { sha: s.sha, gemessen: r };
      let angehoben = k?.angehoben;
      const nimm = (feld, ist, alt) => {
        if (alt == null || ist <= alt) return ist;
        if (ANLASS) { angehoben = ANLASS; return ist; }
        steigt.push(`${s.id} ${feld} ${alt} → ${ist}`);
        return alt;
      };
      if (r.innen) {
        e.aussenPct = nimm('aussen', r.innen.aussenPct, k?.aussenPct);
        const aus = e.aussenPct >= DECKEL ? AUSNAHME.innen[s.id] ?? k?.ausnahmeInnen : undefined;
        if (e.aussenPct >= DECKEL && !aus) ohne.push(`innen:${s.id} ${e.aussenPct} %`);
        if (!aus && k?.ausnahmeInnen) gestrichen.push(`innen:${s.id}`);
        if (aus) e.ausnahmeInnen = aus;
      }
      if (r.innen?.tris && !r.sitz) {
        const aus = AUSNAHME.sitz[s.id] ?? k?.ausnahmeSitz;
        if (!aus) ohne.push(`sitz:${s.id}`);
        else e.ausnahmeSitz = aus;
      } else if (k?.ausnahmeSitz) gestrichen.push(`sitz:${s.id}`);
      if (r.inseln.length) {
        e.inseln = nimm('inseln', r.inseln.length, k?.inseln ?? (k ? 0 : null));
        e.inselM = nimm('inselM', maxM(r), k?.inselM ?? (k ? 0 : null));
        const aus = AUSNAHME.inseln[s.id] ?? k?.ausnahmeInseln;
        if (!aus) ohne.push(`inseln:${s.id} ${r.inseln.length}`);
        else e.ausnahmeInseln = aus;
      } else if (k?.ausnahmeInseln) gestrichen.push(`inseln:${s.id}`);
      if (angehoben) e.angehoben = angehoben;
      schiffe[s.id] = e;
    }
    const sinkt = (feld, ist, alt) => { if (alt == null || ist <= alt) return ist; if (ANLASS) return ist; steigt.push(`${feld} ${alt} → ${ist}`); return alt; };
    const aussen1 = sinkt('aussen1', ab1.length, klinke.aussen1);
    const mitInseln = sinkt('mitInseln', lose.length, klinke.mitInseln);
    let sitzK = sitzOk;
    if (klinke.sitzOk != null && sitzOk < klinke.sitzOk) { if (ANLASS) sitzK = sitzOk; else { steigt.push(`sitzOk ${klinke.sitzOk} → ${sitzOk}`); sitzK = klinke.sitzOk; } }
    if (hart.length) {
      console.error(`\nverify-hangar-lage: nicht nachgezogen, ${hart.length} FEHLER, die keine Klinke heilt:\n`);
      for (const f of hart) console.error(`  · ${f}`);
      console.error('');
      process.exit(1);
    }
    if (steigt.length || ohne.length) {
      console.error(`\nverify-hangar-lage: nicht nachgezogen.${steigt.length ? ` ${steigt.length} Werte stiegen (${steigt.join(', ')}): Ursache klaeren, anheben nur mit --anlass "<warum>".` : ''}${ohne.length ? ` ${ohne.length} ohne Ausnahme (${ohne.join(', ')}): ansehen, stimmt es, --ausnahme innen:<schiff>="<warum>", --ausnahme inseln:<schiff>="<warum>" bzw. --ausnahme sitz:<schiff>="<warum>".` : ''}\n`);
      process.exit(1);
    }
    const ordered = Object.fromEntries(Object.keys(schiffe).sort().map((id) => [id, schiffe[id]]));
    writeFileSync(KLINKE_FILE, `${JSON.stringify({ werkzeug: FASSUNG, aussen1, sitzOk: sitzK, mitInseln, schiffe: ordered }, null, 1)}\n`);
    say(`\nverify-hangar-lage: Klinke nachgezogen (${Object.keys(ordered).length} Schiffe, ${zombies.length} gestrichen, Ausnahmen innen ${Object.values(ordered).filter((e) => e.ausnahmeInnen).length}, ohne Sitz ${Object.values(ordered).filter((e) => e.ausnahmeSitz).length}, lose Teile ${Object.values(ordered).filter((e) => e.ausnahmeInseln).length}${gestrichen.length ? `, Ausnahme gestrichen: ${gestrichen.join(', ')}` : ''}${ANLASS ? `, Anlass: ${ANLASS}` : ''}). Jetzt das Tor ohne Schalter laufen lassen.\n`);
    process.exit(0);
  }

  if (warnings.length) { say(`\nverify-hangar-lage: ${warnings.length} WARNUNG`); for (const w of warnings) say(`  · ${w}`); }
  if (findings.length) {
    console.error(`\nverify-hangar-lage: ${findings.length} FEHLER\n`);
    for (const f of findings) console.error(`  · ${f}`);
    console.error('');
    process.exit(1);
  }
  say('\nverify-hangar-lage: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
}
