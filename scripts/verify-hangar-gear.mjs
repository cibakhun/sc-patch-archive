/* ============================================================
   verify-hangar-gear.mjs — Tor fuer das Fahrwerk im Hangar (Schiene A).

   WARUM ES DEN GIBT: Seit dem PC-Lauf „Hangar-Flotte“ (24./25.10.2026)
   steht ein Schiff im Hangar auf den Aufstandspunkten seines Fahrwerks
   statt auf dem tiefsten Punkt seines Huellquaders (Krisz 24.10.2026:
   „alle schiffe korrekt auf dem boden … mit deren landinggear“). Die
   Punkte stehen im Manifest, die Beine in der Geometrie-Fassung des
   Hangars (public/hangar/geo/). Baut der PC eine Datei neu und die Beine
   sitzen anders, oder haengt ein Teil in Flugstellung tief unter die
   Ebene, steht das Schiff still in der Luft oder im Boden. Sehen wuerde
   man es erst, wenn jemand genau dieses Schiff aufruft.

   Dieses Tor liest das ARTEFAKT: die StageConfig von dist/de/hangar.html
   (models, opts.gear), gearPlane aus dem ausgelieferten Viewer (dieselbe
   Ebene, auf die der Viewer das Schiff stellt) und jede Modelldatei, fuer
   die opts.gear einen Eintrag nennt, aus dist/. Fuer [4] dazu das
   Manifest src/data/hangar-assets.json (pose, why, below).

   ZUSICHERUNGEN
     [1] Jeder Eintrag in opts.gear gehoert zu einer Modelldatei, die die
         Seite laedt (Geometrie models[id][0] oder Werkslack models[id][1]),
         und die Datei liegt in dist/.
     [2] Aufstandspunkte: gearPlane findet eine Ebene (mindestens drei
         Punkte, nicht auf einer Linie, nicht steiler als GEAR_TILT_MAX).
     [3] Keine Ecke der Datei liegt tiefer als SINK unter dieser Ebene
         (dieselbe Grenze wie GEAR_SINK in HangarApp.astro), und die
         tiefste liegt hoechstens FLOAT_TOL darueber: Das Schiff steckt
         nicht im Boden und schwebt nicht. Ohne Fahrwerk (ground) dasselbe
         gegen die Hoehe ground, unten mit FLOAT_TOL statt SINK.
         Als WARNUNG je Aufstandspunkt: Der tiefste Fusspunkt im Umkreis
         FOOT_R liegt mehr als FOOT_WARN ueber der Ebene (ein Bein
         schwebt, die anderen tragen) oder fehlt. Zu beheben im Bau der
         Fassung, nicht durch ein anderes Aufstellen: Auf seinem tiefsten
         Punkt schwebte dasselbe Bein genauso.
     [4] Jedes Schiff der Seite ist zugeordnet: auf dem Fahrwerk oder
         waagrecht (opts.gear), sonst mit Grund aus dem Manifest (pose
         ein oder offen mit why, Teile in below tiefer als SINK). Ein
         Schiff mit pose aus ohne solche Teile, das die Seite nicht aufs
         Fahrwerk stellt, ist rot: Dann ist die Verkabelung verloren.
         Werkslack (models[id][1]) ohne Eintrag wird gezaehlt: Bis Teil C
         ist er ein anderer Export mit ungefederten Beinen und steht wie
         bisher.
     [5] Klinken fuer Schiffe auf dem Fahrwerk und waagrecht.
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PAGE = join('de', 'hangar.html');
// Wie tief ein Teil unter der Aufstandsebene haengen darf: GEAR_SINK in
// src/components/hangar/HangarApp.astro. Darunter verdeckt der Rumpf, was
// im Boden steckt (Hull A: Retro-Duesen 15 cm, Wolf: Fussplatten 15 cm).
const SINK = 0.2;
// Wie hoch die tiefste Ecke ueber dem Boden liegen darf: 5 cm, bei
// grossen Schiffen 0,1 % ihrer Laenge. Die Fassung ist dezimiert (rund
// 80 000 Dreiecke je Schiff) und mit Draco gepackt, ihr Fehler waechst mit
// der Groesse (Javelin, 345 m: tiefste Ecke 31 cm ueber dem tiefsten
// Punkt des Spiels).
const FLOAT_TOL = (len) => Math.max(0.05, 0.001 * len);
// Fusspunkt je Aufstandspunkt: tiefste Ecke im waagrechten Umkreis
const FOOT_R = 0.5, FOOT_WARN = 0.05;
// 25.10.2026, erster Stand: 127 Schiffe auf dem Fahrwerk, 47 waagrecht.
const KLINKE = { fahrwerk: 127, waagrecht: 47 };

const findings = [];
const say = (s) => console.log(s);
const fail = (s) => findings.push(s);
const sollIst = (soll, ist) => say(`    Soll: ${soll}\n    Ist:  ${ist}`);
const pathOf = (u) => decodeURI(String(u).split('?')[0]);
const fromUrl = (u) => join(DIST, pathOf(u).replace(/^\//, ''));
const cm = (m) => `${(m * 100).toFixed(1)} cm`;

say(`verify-hangar-gear: prueft ${join('dist', PAGE)}, ihren Viewer und die Modelldateien, die sie aufs Fahrwerk stellt`);
if (!existsSync(join(DIST, PAGE))) {
  console.error(`\nverify-hangar-gear: ${join('dist', PAGE)} fehlt — erst bauen (npm run build)\n`);
  process.exit(1);
}
const html = readFileSync(join(DIST, PAGE), 'utf8');
const sm = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(html);
const stage = sm ? JSON.parse(sm[1]) : null;
if (!stage) fail(`${PAGE}: keine StageConfig (#hg-stage)`);
const models = stage?.models ?? {};
const gear = stage?.opts?.gear ?? {};
const viewerFile = stage?.viewer ? fromUrl(stage.viewer) : null;
let gearPlane = null, TILT_MAX = null;
if (viewerFile && existsSync(viewerFile)) {
  try {
    const mod = await import(pathToFileURL(viewerFile).href);
    gearPlane = typeof mod.gearPlane === 'function' ? mod.gearPlane : null;
    TILT_MAX = mod.GEAR_TILT_MAX ?? null;
  } catch (e) { fail(`der Viewer ${stage.viewer} laedt nicht als Modul (${e.message})`); }
}
if (!gearPlane) fail('der ausgelieferte Viewer exportiert gearPlane nicht: Dann prueft dieses Tor eine andere Ebene als die, auf der das Schiff steht');
const manifest = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'hangar-assets.json'), 'utf8'));
const mGear = manifest.gear ?? {};
const deepest = (g) => Math.max(0, ...(g?.below ?? []).map((b) => b.depth));

// ---- [1] ----
say('\n[1] Jeder Eintrag in opts.gear gehoert zu einer Modelldatei der Seite, die Datei liegt in dist/');
const geoOf = new Map(Object.entries(models).flatMap(([id, m]) => [[pathOf(m[0]), id], ...(m[1] ? [[pathOf(m[1]), id]] : [])]));
const entries = Object.entries(gear);
const orphan = entries.filter(([p]) => !geoOf.has(p)).map(([p]) => p);
const missing = entries.filter(([p]) => geoOf.has(p) && !existsSync(fromUrl(p))).map(([p]) => p);
sollIst('0 Eintraege ohne Modelldatei der Seite, 0 Dateien fehlen', `${entries.length} Eintraege, ${orphan.length} ohne Modelldatei, ${missing.length} Dateien fehlen`);
for (const p of orphan) fail(`[1] opts.gear["${p}"]: die Seite laedt diese Datei nicht (HangarApp.astro)`);
for (const p of missing) fail(`[1] ${p} fehlt in dist/`);

// ---- [2] und [3] ----
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
// Ecken im Raum der Datei, wie der Viewer sie zeichnet: nur Knoten, die
// von der Szene aus erreichbar sind. Manche Fassungen tragen daneben lose
// Knoten, die einander im Kreis als Kind nennen (Hornet F7C-R, CSV-Cargo:
// Reste der Exportgruppen); die Szene erreicht sie nicht, GLTFLoader laedt
// sie nicht, getWorldMatrix liefe an ihnen endlos. Gezaehlt als WARNUNG.
const loose = [];
const mul = (a, b) => {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};
async function corners(file, id) {
  const doc = await io.read(file);
  const out = [], seen = new Set();
  const walk = (node, parent) => {
    if (seen.has(node)) return;
    seen.add(node);
    const m = mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    for (const prim of mesh?.listPrimitives() ?? []) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        out.push([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]);
      }
    }
    for (const child of node.listChildren()) walk(child, m);
  };
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) walk(node, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const lost = doc.getRoot().listNodes().length - seen.size;
  if (lost) loose.push(`${id} ${lost}`);
  return out;
}
say('\n[2] Die Aufstandspunkte ergeben eine brauchbare Ebene');
say('[3] Nichts steckt tiefer als SINK im Boden, die tiefste Ecke steht auf dem Boden');
const run = { fahrwerk: 0, waagrecht: 0, punkte: 0, ecken: 0, tief: [], schwebt: [], keineEbene: [], beine: [], maxSink: 0, maxTilt: 0 };
for (const [p, g] of entries) {
  const id = geoOf.get(p);
  if (!id || !existsSync(fromUrl(p))) continue;
  const pts = await corners(fromUrl(p), id);
  run.ecken += pts.length;
  if (!pts.length) { fail(`[3] ${p} traegt keine Ecken`); continue; }
  // ohne Spread: die Polaris hat über eine Million Ecken, mehr als der Aufrufstapel trägt
  const len = Math.max(...[0, 2].map((k) => pts.reduce((a, q) => Math.max(a, q[k]), -Infinity) - pts.reduce((a, q) => Math.min(a, q[k]), Infinity)));
  // Hoehe ueber dem Boden je Ecke: senkrecht zur Ebene y = a·x + b·z + c, oder ueber ground
  let up;
  if (Array.isArray(g.contacts)) {
    run.fahrwerk++;
    const pl = gearPlane?.(g.contacts);
    if (!pl) { run.keineEbene.push(id); fail(`[2] ${id}: gearPlane findet durch ${g.contacts.length} Aufstandspunkte keine Ebene (zu wenige, auf einer Linie oder steiler als ${TILT_MAX} Grad): Der Viewer stellt es auf den tiefsten Punkt, opts.gear behauptet Fahrwerk`); continue; }
    run.maxTilt = Math.max(run.maxTilt, pl.tilt);
    const k = 1 / Math.hypot(pl.a, 1, pl.b);
    up = (q) => (q[1] - (pl.a * q[0] + pl.b * q[2] + pl.c)) * k;
    for (const c of g.contacts) {
      run.punkte++;
      let foot = Infinity;
      for (const q of pts) if (Math.hypot(q[0] - c[0], q[2] - c[2]) < FOOT_R) foot = Math.min(foot, up(q));
      if (foot > FOOT_WARN) run.beine.push(`${id} ${foot === Infinity ? 'fehlt' : cm(foot)}`);
    }
  } else if (Number.isFinite(g.ground)) {
    run.waagrecht++;
    up = (q) => q[1] - g.ground;
  } else { fail(`[2] opts.gear["${p}"] nennt weder contacts noch ground`); continue; }
  let low = Infinity, at = null;
  for (const q of pts) { const h = up(q); if (h < low) { low = h; at = q; } }
  const sink = Array.isArray(g.contacts) ? SINK : FLOAT_TOL(len);
  run.maxSink = Math.max(run.maxSink, -low);
  if (-low > sink) { run.tief.push(`${id} ${cm(-low)}`); fail(`[3] ${id}: eine Ecke liegt ${cm(-low)} unter dem Boden (bei ${at.map((c) => c.toFixed(2)).join(' ')}), Grenze ${cm(sink)}: Das Teil steckt sichtbar im Boden. Teil in Landestellung bringen oder pose/below im Manifest pruefen (build-hangar-gear.mjs)`); }
  if (low > FLOAT_TOL(len)) { run.schwebt.push(`${id} ${cm(low)}`); fail(`[3] ${id}: die tiefste Ecke liegt ${cm(low)} ueber dem Boden (Grenze ${cm(FLOAT_TOL(len))} bei ${len.toFixed(0)} m): Das Schiff schwebt. Aufstandspunkte oder ground gehoeren nicht zu dieser Fassung`); }
}
if (loose.length) say(`    WARNUNG: ${loose.length} Dateien tragen Knoten, die die Szene nicht erreicht (${loose.join(', ')}); sie werden nicht gezeichnet. build-hangar-gear.mjs sollte sie beim Bau entfernen`);
if (run.beine.length) say(`    WARNUNG: ${run.beine.length} von ${run.punkte} Fusspunkten liegen mehr als ${cm(FOOT_WARN)} ueber dem Boden oder fehlen (${run.beine.join(', ')}); das Bein steht im Bau der Fassung anders als die Feder des Spiels`);
sollIst(`0 Ebenen fehlen, 0 Schiffe tiefer als ${cm(SINK)} im Boden (ohne Fahrwerk ${cm(0.05)}), 0 schweben`,
  `${run.fahrwerk} auf dem Fahrwerk mit ${run.punkte} Aufstandspunkten, ${run.waagrecht} waagrecht, ${run.ecken} Ecken gemessen; ${run.keineEbene.length} ohne Ebene, ${run.tief.length} im Boden${run.tief.length ? ` (${run.tief.slice(0, 4).join(', ')})` : ''}, ${run.schwebt.length} schweben${run.schwebt.length ? ` (${run.schwebt.slice(0, 4).join(', ')})` : ''}; tiefstes Teil ${cm(run.maxSink)}, steilste Lage ${run.maxTilt.toFixed(1)} Grad, ${run.punkte - run.beine.length} von ${run.punkte} Fusspunkten auf dem Boden`);

// ---- [4] ----
say('\n[4] Jedes Schiff der Seite steht auf dem Fahrwerk, waagrecht oder hat einen Grund');
const grund = { werkslack: 0, ein: 0, offen: 0, flugstellung: 0, ohneEintrag: [], verloren: [] };
for (const [id, m] of Object.entries(models)) {
  const g = mGear[id], on = gear[pathOf(m[0])];
  if (m[1] && !gear[pathOf(m[1])]) grund.werkslack++;
  if (on) continue;
  if (!g) { grund.ohneEintrag.push(id); fail(`[4] ${id}: kein gear-Eintrag im Manifest (scripts/build-hangar-gear.mjs)`); continue; }
  if ((g.pose === 'ein' || g.pose === 'offen') && typeof g.why === 'string' && g.why.length > 10) { grund[g.pose]++; continue; }
  if (g.pose === 'aus' && deepest(g) > SINK) { grund.flugstellung++; continue; }
  grund.verloren.push(id);
  fail(`[4] ${id}: pose ${g.pose}${g.pose === 'ein' || g.pose === 'offen' ? ' ohne Grund (why)' : `, tiefstes Teil in below ${cm(deepest(g))}`}, aber die Seite stellt es nicht aufs Fahrwerk (opts.gear in HangarApp.astro)`);
}
sollIst('0 Schiffe ohne Eintrag, 0 ohne Zuordnung',
  `${Object.keys(models).length} Schiffe; mit Grund: ${grund.ein} Fahrwerk eingefahren, ${grund.offen} ohne Export, ${grund.flugstellung} mit Teilen in Flugstellung; ${grund.werkslack} mit Werkslack (bis Teil C wie bisher); ${grund.ohneEintrag.length} ohne Eintrag, ${grund.verloren.length} ohne Zuordnung${grund.verloren.length ? ` (${grund.verloren.slice(0, 4).join(', ')})` : ''}`);

// ---- [5] ----
say('\n[5] Klinken');
sollIst(`mindestens ${KLINKE.fahrwerk} auf dem Fahrwerk, ${KLINKE.waagrecht} waagrecht`, `${run.fahrwerk} auf dem Fahrwerk, ${run.waagrecht} waagrecht`);
if (run.fahrwerk < KLINKE.fahrwerk) fail(`[5] nur ${run.fahrwerk} Schiffe auf dem Fahrwerk, Klinke ${KLINKE.fahrwerk}`);
if (run.waagrecht < KLINKE.waagrecht) fail(`[5] nur ${run.waagrecht} Fahrzeuge waagrecht, Klinke ${KLINKE.waagrecht}`);

say('\n[Selbstauskunft]');
say(`    Schiffe: ${Object.keys(models).length}   Fahrwerk: ${run.fahrwerk}   waagrecht: ${run.waagrecht}   Aufstandspunkte: ${run.punkte}   Ecken: ${run.ecken}   mit Grund: ${grund.ein + grund.offen + grund.flugstellung}   Werkslack: ${grund.werkslack}`);

if (findings.length) {
  console.error(`\nverify-hangar-gear: ${findings.length} FEHLER\n`);
  for (const f of findings) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
say('\nverify-hangar-gear: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
