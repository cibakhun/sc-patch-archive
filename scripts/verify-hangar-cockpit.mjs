/* ============================================================
   verify-hangar-cockpit.mjs — Tor gegen den Blick durch das Schiff
   (Schiene A).

   WARUM ES DEN GIBT: Krisz, 29.10.2026, Gladius auf staging: „siehst wie
   das schiff von innen hohl ist?“ Durch die Haube sah man neben und hinter
   dem Sitz durch das Schiff hindurch in die Halle. Ursache: Das Spiel
   zeichnet Rumpf und Cockpit zweiseitig (MtlFlags Bit 0x2 im .mtl), der
   Export trug das nie nach doubleSided; der Viewer zeichnet einseitige
   Flaechen von innen nicht. Behoben im Bau (cleanMaterials twoSided,
   dropInterior behaelt Innenraum hinter Glas), Notiz
   .planning/notes/hangar-cockpit-hohl.md. Faellt das bei einem Neubau
   wieder weg (Zusammenfuehren, anderer Bauweg, neues Schiff), sieht die
   Seite gut aus, bis jemand in genau dieses Cockpit schaut.

   Dieses Tor liest das ARTEFAKT: die StageConfig von dist/de/hangar.html
   (models[id][1], die Werkslack-Datei, die der Viewer laedt) und jede
   dieser Dateien aus dist/. Je Datei misst scripts/lib/cockpit-rays.mjs
   160 Strahlen durch das Haubenglas und zaehlt „durch“: hinter der ersten
   Flaeche eine Rueckseite und dahinter bis 30 m nichts, was der Viewer
   zeichnet.

   KLINKE je Schiff: scripts/lib/hangar-cockpit-klinke.json traegt je
   Schiff die hoechstens erlaubten Strahlen „durch“ und den Fingerabdruck
   der gemessenen Datei. Gleicher Fingerabdruck und gleiche Fassung der
   Messung (WERKZEUG und die Regel des Viewers, was er verbirgt) → der
   Wert gilt ohne neue Messung (die Rechnung ist deterministisch); sonst
   wird gemessen, mit allen Kernen.
   Ueber DECKEL Prozent steht ein Schiff nur mit benannter Ausnahme
   (Feld ausnahme am Eintrag: warum man dort durch das Schiff sieht und
   das stimmt, etwa offene Rippen der Vanduul). Faellt es darunter, ist
   die Ausnahme ein Zombie.

   ZUSICHERUNGEN
     [1] Jedes Schiff der Seite mit Werkslack-Datei liegt in dist/, und es
         sind mindestens KLINKE_SCHIFFE.
     [2] Je Schiff: durch hoechstens Klinke + TOL Strahlen (FEHLER),
         ueber der Klinke innerhalb TOL ist WARNUNG. Ueber DECKEL Prozent
         nur mit benannter Ausnahme (FEHLER), eine Ausnahme unter DECKEL
         ist ein Zombie (FEHLER). Ein Schiff ohne Klinke ist WARNUNG
         (nachziehen), ein Klinkeneintrag ohne Schiff ein Zombie (FEHLER).
     [3] Schiffe mit mehr als 10 % durch: hoechstens die Klinke ueber10.

   NACHZIEHEN (nach einem Neubau, damit das Tor wieder ohne Messung
   auskommt):
     node scripts/verify-hangar-cockpit.mjs --nachziehen
   schreibt Fingerabdruecke, senkt Werte, streicht Zombies und
   Ausnahmen, die keinen Anlass mehr haben. Ein Wert steigt nur mit
   Begruendung, ein Schiff ueber DECKEL nur mit Ausnahme:
     node scripts/verify-hangar-cockpit.mjs --nachziehen --anlass "<warum>"
     node scripts/verify-hangar-cockpit.mjs --nachziehen --ausnahme <schiff>="<warum>"
   (Anlass und Ausnahme stehen dann am Eintrag; Grundsatz 5: nach oben nur
   per Commit, dessen Botschaft die Ursache nennt). Danach das Tor ohne
   Schalter laufen lassen.
   ============================================================ */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { measure, WERKZEUG } from './lib/cockpit-rays.mjs';

// Hilfsfaden: misst die Dateien aus workerData.part und meldet je Schiff
if (!isMainThread) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const { isDamageMesh } = await import(pathToFileURL(workerData.viewer).href);
  for (const { id, file } of workerData.part) {
    const r = measure(await io.read(file), { verborgen: isDamageMesh });
    parentPort.postMessage({ id, r });
  }
} else await main();

async function main() {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const DIST = join(ROOT, 'dist');
  const PAGE = join('de', 'hangar.html');
  const KLINKE_FILE = join(ROOT, 'scripts', 'lib', 'hangar-cockpit-klinke.json');
  // 29.10.2026, erster Stand nach dem Neubau (pc/hangar-cockpit): alle 231
  // Schiffe der Seite mit Werkslack (Freelancer und Andromeda frei seit #246)
  const KLINKE_SCHIFFE = 231;
  // Spiel einer Neuberechnung: 3 von 160 Strahlen (2 %). Mehr ist ein
  // Rueckfall, kein Rauschen (Gladius vor dem Fix: 10, Wolf: 76).
  const TOL = 3;
  // Schiff ohne Klinke: ab hier rot
  const DECKEL = 10;

  const argv = process.argv.slice(2);
  const NACHZIEHEN = argv.includes('--nachziehen');
  const anlassAt = argv.indexOf('--anlass');
  const ANLASS = anlassAt >= 0 ? argv[anlassAt + 1] : null;
  const AUSNAHME = Object.fromEntries(argv.flatMap((a, i) => (a === '--ausnahme' && argv[i + 1]?.includes('=') ? [argv[i + 1].split(/=(.*)/s).slice(0, 2)] : [])));

  const findings = [], warnings = [];
  const say = (s) => console.log(s);
  const fail = (s) => findings.push(s);
  const warn = (s) => warnings.push(s);
  const sollIst = (soll, ist) => say(`    Soll: ${soll}\n    Ist:  ${ist}`);
  const pathOf = (u) => decodeURI(String(u).split('?')[0]);
  const pct = (r) => (r.rays ? (100 * r.durch) / r.rays : 0);

  say(`verify-hangar-cockpit: prueft ${join('dist', PAGE)} und jede Werkslack-Datei, die sie laedt (Messung ${WERKZEUG})`);
  if (!existsSync(join(DIST, PAGE))) {
    console.error(`\nverify-hangar-cockpit: ${join('dist', PAGE)} fehlt — erst bauen (npm run build)\n`);
    process.exit(1);
  }
  const html = readFileSync(join(DIST, PAGE), 'utf8');
  const sm = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(html);
  const stage = sm ? JSON.parse(sm[1]) : null;
  const models = stage?.models ?? null;
  if (!models) {
    console.error(`\nverify-hangar-cockpit: ${PAGE} ohne StageConfig (#hg-stage)\n`);
    process.exit(1);
  }
  // Was der Viewer nicht zeichnet, zaehlt nicht: isDamageMesh aus dem
  // ausgelieferten Viewer (Schadensnetze, PR #246), dieselbe Regel wie dort
  const viewer = stage.viewer ? join(DIST, pathOf(stage.viewer).replace(/^\//, '')) : null;
  let damage = null;
  try { damage = viewer && existsSync(viewer) ? (await import(pathToFileURL(viewer).href)).isDamageMesh : null; } catch (e) { fail(`der Viewer ${stage.viewer} laedt nicht als Modul (${e.message})`); }
  if (typeof damage !== 'function') fail('der ausgelieferte Viewer exportiert isDamageMesh nicht: Dann zaehlt dieses Tor Schadensnetze mit, die der Viewer verbirgt');
  const klinke = existsSync(KLINKE_FILE) ? JSON.parse(readFileSync(KLINKE_FILE, 'utf8')) : { schiffe: {} };
  const K = klinke.schiffe ?? {};

  // ---- [1] ----
  say('\n[1] Jedes Schiff der Seite mit Werkslack-Datei liegt in dist/');
  const ships = Object.entries(models).filter(([, m]) => m[1]).map(([id, m]) => ({ id, file: join(DIST, pathOf(m[1]).replace(/^\//, '')) }));
  const missing = ships.filter((s) => !existsSync(s.file));
  const ohne = Object.entries(models).filter(([, m]) => !m[1]).map(([id]) => id);
  sollIst(`mindestens ${KLINKE_SCHIFFE} Schiffe mit Werkslack, jede Datei in dist/`, `${ships.length} mit Werkslack (ohne: ${ohne.join(', ') || 'keins'}), ${missing.length} Dateien fehlen`);
  for (const s of missing) fail(`[1] ${s.id}: ${s.file} fehlt in dist/`);
  if (ships.length < KLINKE_SCHIFFE) fail(`[1] nur ${ships.length} Schiffe mit Werkslack auf der Seite (Klinke ${KLINKE_SCHIFFE})`);

  // ---- [2] ----
  say('\n[2] Kein Blick durch das Schiff in die Halle: Strahlen „durch“ je Schiff gegen seine Klinke');
  const here = ships.filter((s) => existsSync(s.file));
  for (const s of here) s.sha = createHash('sha256').update(readFileSync(s.file)).digest('hex').slice(0, 16);
  // Fassung = Messung plus Regel des Viewers, was er verbirgt: aendert sich
  // eins, gilt kein Wert aus der Klinke mehr ohne neue Messung
  const FASSUNG = `${WERKZEUG}, verborgen ${createHash('sha256').update(String(damage)).digest('hex').slice(0, 8)}`;
  const known = klinke.werkzeug === FASSUNG;
  const res = new Map();
  for (const s of here) if (known && K[s.id]?.sha === s.sha && K[s.id].gemessen) res.set(s.id, K[s.id].gemessen);
  const todo = here.filter((s) => !res.has(s.id));
  if (todo.length) {
    const n = Math.max(1, Math.min(availableParallelism(), todo.length, 8));
    const t0 = Date.now();
    await Promise.all(Array.from({ length: n }, (_, w) => new Promise((ok, no) => {
      const part = todo.filter((_, i) => i % n === w).map(({ id, file }) => ({ id, file }));
      const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { part, viewer } });
      wk.on('message', ({ id, r }) => res.set(id, { rays: r.rays ?? 0, durch: r.durch ?? 0, hohl: r.hohl ?? 0, glas: r.glass ?? 0 }));
      wk.on('error', no);
      wk.on('exit', (c) => (c ? no(new Error(`Messung endete mit ${c}`)) : ok()));
    })));
    say(`    ${todo.length} Schiffe gemessen (${n} Kerne, ${((Date.now() - t0) / 1000).toFixed(0)} s), ${here.length - todo.length} per Fingerabdruck aus der Klinke${known ? '' : ` (Klinke von ${klinke.werkzeug ?? '—'}, jetzt ${FASSUNG}: alle neu)`}`);
  } else say(`    alle ${here.length} Schiffe per Fingerabdruck aus der Klinke (keine Datei geaendert)`);

  const over = [], soft = [], neu = [], sinkt = [];
  for (const s of here) {
    const r = res.get(s.id), k = K[s.id];
    if (!r) { fail(`[2] ${s.id}: keine Messung`); continue; }
    if (!r.rays) continue; // kein Haubenglas
    if (pct(r) > DECKEL && !k?.ausnahme) fail(`[2] ${s.id}: ${r.durch} von ${r.rays} Strahlen gehen durch das Schiff in die Halle (${pct(r).toFixed(0)} %, ohne benannte Ausnahme hoechstens ${DECKEL} %): zweiseitig aus den MtlFlags (cleanMaterials twoSided) und Innenraum hinter Glas (dropInterior) im Bau pruefen, im Viewer ansehen; stimmt der Durchblick, Ausnahme mit --nachziehen --ausnahme ${s.id}="<warum>"`);
    if (k?.ausnahme && pct(r) <= DECKEL) fail(`[2] ${s.id}: Ausnahme „${k.ausnahme}“ ohne Anlass, nur noch ${pct(r).toFixed(0)} % durch: mit --nachziehen streichen`);
    if (!k) { neu.push(s.id); continue; }
    if (r.durch > k.durch + TOL) over.push({ ...s, r, k });
    else if (r.durch > k.durch) soft.push({ ...s, r, k });
    else if (r.durch < k.durch) sinkt.push(s.id);
  }
  const zombies = Object.keys(K).filter((id) => !here.some((s) => s.id === id));
  const glas = here.filter((s) => res.get(s.id)?.rays);
  const mittel = glas.length ? glas.reduce((a, s) => a + pct(res.get(s.id)), 0) / glas.length : 0;
  const ausn = here.filter((s) => K[s.id]?.ausnahme);
  sollIst(`kein Schiff mehr als ${TOL} Strahlen ueber seiner Klinke, keins ueber ${DECKEL} % ohne benannte Ausnahme, keine Klinke ohne Schiff`,
    `${glas.length} Schiffe mit Haubenglas, durch im Mittel ${mittel.toFixed(1)} %; ${over.length} ueber der Klinke, ${soft.length} knapp darueber, ${neu.length} ohne Klinke, ${zombies.length} Klinken ohne Schiff, ${sinkt.length} koennen sinken; Ausnahmen ${ausn.length}${ausn.length ? ` (${ausn.map((s) => s.id).join(', ')})` : ''}`);
  const top = glas.map((s) => ({ id: s.id, r: res.get(s.id) })).sort((a, b) => b.r.durch - a.r.durch).slice(0, 5);
  say(`    am meisten durch: ${top.map((x) => `${x.id} ${x.r.durch}/${x.r.rays}`).join(', ')}`);
  for (const o of over) fail(`[2] ${o.id}: ${o.r.durch} von ${o.r.rays} Strahlen gehen durch das Schiff in die Halle, Klinke ${o.k.durch}: zweiseitig aus den MtlFlags (cleanMaterials twoSided) oder Innenraum hinter Glas (dropInterior) beim Neubau verloren? Im Viewer ansehen; begruendet anheben nur mit --nachziehen --anlass`);
  for (const o of soft) warn(`[2] ${o.id}: ${o.r.durch} Strahlen durch, Klinke ${o.k.durch} (innerhalb ${TOL})`);
  for (const id of zombies) fail(`[2] Klinke ${id} ohne Schiff auf der Seite: mit --nachziehen streichen`);
  if (neu.length) warn(`[2] ${neu.length} Schiffe ohne Klinke (${neu.slice(0, 6).join(', ')}${neu.length > 6 ? ', …' : ''}): --nachziehen`);
  if (todo.length && !NACHZIEHEN) warn(`[2] ${todo.length} Schiffe neu gemessen: mit --nachziehen die Fingerabdruecke eintragen, dann kommt das Tor ohne Messung aus`);

  // ---- [3] ----
  say('\n[3] Schiffe mit mehr als 10 % durch');
  const ueber10 = glas.filter((s) => pct(res.get(s.id)) > 10).map((s) => s.id);
  sollIst(`hoechstens ${klinke.ueber10 ?? '—'}`, `${ueber10.length}${ueber10.length ? ` (${ueber10.join(', ')})` : ''}`);
  if (klinke.ueber10 != null && ueber10.length > klinke.ueber10) fail(`[3] ${ueber10.length} Schiffe mit mehr als 10 % durch, Klinke ${klinke.ueber10}`);

  say('\n[Selbstauskunft]');
  say(`    Schiffe: ${here.length}   mit Haubenglas: ${glas.length}   gemessen: ${todo.length}   aus der Klinke: ${here.length - todo.length}   Strahlen: ${glas.reduce((a, s) => a + res.get(s.id).rays, 0)}   durch: ${glas.reduce((a, s) => a + res.get(s.id).durch, 0)}`);

  if (NACHZIEHEN) {
    const steigt = [], ohne = [], gestrichen = [];
    const schiffe = {};
    for (const s of here) {
      const r = res.get(s.id); if (!r) continue;
      const k = K[s.id];
      let durch = r.durch, angehoben = k?.angehoben;
      if (k && r.durch > k.durch) { if (ANLASS) angehoben = ANLASS; else { steigt.push(`${s.id} ${k.durch} → ${r.durch}`); durch = k.durch; } }
      if (k && r.durch < k.durch) angehoben = undefined;
      const ueber = r.rays && (100 * durch) / r.rays > DECKEL;
      const ausnahme = ueber ? AUSNAHME[s.id] ?? k?.ausnahme : undefined;
      if (ueber && !ausnahme) ohne.push(`${s.id} ${durch}/${r.rays}`);
      if (!ueber && k?.ausnahme) gestrichen.push(s.id);
      schiffe[s.id] = { sha: s.sha, durch, gemessen: r, ...(ausnahme ? { ausnahme } : {}), ...(angehoben ? { angehoben } : {}) };
    }
    let u10 = ueber10.length;
    if (klinke.ueber10 != null && u10 > klinke.ueber10 && !ANLASS) { steigt.push(`ueber10 ${klinke.ueber10} → ${u10}`); u10 = klinke.ueber10; }
    if (steigt.length || ohne.length) {
      console.error(`\nverify-hangar-cockpit: nicht nachgezogen.${steigt.length ? ` ${steigt.length} Werte stiegen (${steigt.join(', ')}): Ursache klaeren, anheben nur mit --anlass "<warum>".` : ''}${ohne.length ? ` ${ohne.length} Schiffe ueber ${DECKEL} % ohne Ausnahme (${ohne.join(', ')}): im Viewer ansehen, stimmt es, --ausnahme <schiff>="<warum>".` : ''}\n`);
      process.exit(1);
    }
    const ordered = Object.fromEntries(Object.keys(schiffe).sort().map((id) => [id, schiffe[id]]));
    writeFileSync(KLINKE_FILE, `${JSON.stringify({ werkzeug: FASSUNG, ueber10: u10, schiffe: ordered }, null, 1)}\n`);
    say(`\nverify-hangar-cockpit: Klinke nachgezogen (${Object.keys(ordered).length} Schiffe, ${zombies.length} gestrichen, ${sinkt.length} gesunken, Ausnahmen ${Object.values(ordered).filter((e) => e.ausnahme).length}${gestrichen.length ? `, Ausnahme gestrichen: ${gestrichen.join(', ')}` : ''}${ANLASS ? `, Anlass: ${ANLASS}` : ''}). Jetzt das Tor ohne Schalter laufen lassen.\n`);
    process.exit(0);
  }

  if (warnings.length) { say(`\nverify-hangar-cockpit: ${warnings.length} WARNUNG`); for (const w of warnings) say(`  · ${w}`); }
  if (findings.length) {
    console.error(`\nverify-hangar-cockpit: ${findings.length} FEHLER\n`);
    for (const f of findings) console.error(`  · ${f}`);
    console.error('');
    process.exit(1);
  }
  say('\nverify-hangar-cockpit: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
}
