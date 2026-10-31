/* ============================================================
   verify-hangar-crew.mjs — Tor fuer die Hangar-Crew (Schiene A).

   WARUM ES DEN GIBT: Seit dem 30.10.2026 (Krisz: „die npcs sind super
   duper basic … bau npcs komplett aus“) laeuft im Hangar die Deckcrew
   des Spiels mit Skelett, Farbstellungen und Spielanimationen
   (scripts/build-hangar-crew.mjs -> public/hangar/npc/crew.glb, Modul
   assets/hangar-crew.js). Die Teile haengen nur ueber Namen zusammen:
   Clipnamen im Ablauf des Moduls gegen den Kopf der Datei, Knochennamen
   der Spuren gegen das Skelett, Einhaengepunkte des Materials gegen die
   Shader von three.js, Arbeitsplaetze gegen den Viewer. Reisst eine
   Stelle, steht die Crew still in Bindehaltung, laeuft ohne Farben oder
   fehlt ganz — und jede Aufnahme eines anderen Schiffs sieht gut aus.

   Dieses Tor liest das ARTEFAKT: die StageConfig von dist/de/hangar.html
   (opts.crew), die Figur aus dist/ (Draco entpackt), das ausgelieferte
   Modul und den ausgelieferten Viewer. Fuer [1] dazu das Manifest
   src/data/hangar-crew.json.

   ZUSICHERUNGEN
     [1] Die Seite gibt Figur und Modul mit (opts.crew.url mit der Version
         des Manifests, opts.crew.module), beide liegen in dist/, die
         Datei ist die des Manifests (Groesse, Inhaltshash).
     [2] Figur: ein Netz mit Haut, Gelenke = Knochenliste des Kopfs,
         jede Ecke an hoechstens 4 Knochen mit Summe 1, Teilmaterial jeder
         Ecke in der Farbtafel, Texturkoordinaten im Atlas; Farbtafel
         passt zu Stellungen x Teilmaterialien; Obergrenzen fuer Bytes,
         Dreiecke und Knochen (Leistung: acht Figuren zugleich).
     [3] Animationsblock: Kopf CRW1, so viele Clips wie der Kopf nennt,
         jede Spur an einem Knochen der Liste, Bilder steigend und in der
         Clipdauer, Drehungen Einheitsquaternionen; Bahnen der Wurzel
         gleichmaessig abgetastet.
     [4] Jeder Clip, den das ausgelieferte Modul spielen kann, steht in
         der Datei; was mit Dauer laeuft, ist dort eine Schleife.
     [5] Jeder Einhaengepunkt des Materials steht im Shader von three.js
         (MeshStandardMaterial), sonst fehlten Farben oder Normale still.
     [6] Wege: im Raster des Moduls fuehrt jeder gefundene Weg nur ueber
         freie Zellen und um Rumpf und Geraet herum (Probelauf). Steht eine
         Figur mitten auf der Strecke, haelt der Weg um sie herum mindestens
         ABSTAND Meter (Mitte zu Mitte; darunter laufen zwei Figuren
         ineinander, Krisz 30.10.2026: „npcs glitchen ineinander“).
     [7] Verkabelung im ausgelieferten Viewer: Arbeitsplaetze aus dem
         Wartungsplatz, Aufstandspunkte, Uebergabe an die Crew, Ladezweig.
     [8] Klinken fuer Clips und Farbstellungen.

   VORGEFUEHRT ROT (30.10.2026): Clip gearLook im Ablauf des Moduls zu
   gearLok verschrieben und den Ladezweig im Viewer umbenannt:
     verify-hangar-crew: 2 FEHLER
       · [4] Clip gearLok fehlt in /hangar/npc/crew.glb: CLIPS in
         scripts/build-hangar-crew.mjs und WORK in assets/hangar-crew.js
         passen nicht zusammen
       · [7] im Viewer fehlt: Ladezweig (opts.crew.module, crewRig, useRig)
   Abstand um stehende Figuren (30.10.2026, abends): AVOID_R im
   ausgelieferten Modul auf 0.3 gesetzt:
       · [6] 68 Wege fuehren naeher als 0.55 m an einer stehenden Figur
         vorbei (naechster 0.05 m): AVOID_R in assets/hangar-crew.js
   ============================================================ */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import * as THREE from 'three';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PAGE = join('de', 'hangar.html');
// Obergrenzen je Figur (acht laufen zugleich, jede ein Zeichenaufruf)
const CAP = { bytes: 2.4e6, tris: 30000, bones: 100 };
// 30.10.2026, erster Stand: 39 Clips, 20 Farbstellungen der Deckcrew
const KLINKE = { clips: 39, variants: 20, umgehen: 60 };
// Schulterbreite: Mitte zu Mitte darunter durchdringen sich zwei Figuren
const ABSTAND = 0.55;

const findings = [];
const say = (s) => console.log(s);
const fail = (s) => findings.push(s);
const sollIst = (soll, ist) => say(`    Soll: ${soll}\n    Ist:  ${ist}`);
const pathOf = (u) => decodeURI(String(u).split('?')[0]);
const fromUrl = (u) => join(DIST, pathOf(u).replace(/^\//, ''));

say(`verify-hangar-crew: prueft ${join('dist', PAGE)}, die Figur, das Crew-Modul und den Viewer daraus`);
if (!existsSync(join(DIST, PAGE))) {
  console.error(`\nverify-hangar-crew: ${join('dist', PAGE)} fehlt — erst bauen (npm run build)\n`);
  process.exit(1);
}
const html = readFileSync(join(DIST, PAGE), 'utf8');
const sm = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(html);
const stage = sm ? JSON.parse(sm[1]) : null;
if (!stage) fail(`${PAGE}: keine StageConfig (#hg-stage)`);
const crew = stage?.opts?.crew ?? null;
const manifest = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'hangar-crew.json'), 'utf8'));

// ---- [1] ----
say('\n[1] Die Seite gibt Figur und Modul mit, beide in dist/, die Figur ist die des Manifests');
const glbFile = crew?.url ? fromUrl(crew.url) : null, modFile = crew?.module ? fromUrl(crew.module) : null;
const glbBuf = glbFile && existsSync(glbFile) ? readFileSync(glbFile) : null;
const hash = glbBuf ? createHash('sha256').update(glbBuf).digest('hex').slice(0, 8) : null;
sollIst(`url ${manifest.url}?v=${manifest.v} (${manifest.bytes} B), module /assets/hangar-crew.js?v=…`,
  `url ${crew?.url ?? '—'}${glbBuf ? ` (${glbBuf.length} B, Inhalt ${hash})` : ' (fehlt)'}, module ${crew?.module ?? '—'}${modFile && existsSync(modFile) ? '' : ' (fehlt)'}`);
if (!crew?.url || pathOf(crew.url) !== manifest.url || !crew.url.endsWith(`?v=${manifest.v}`)) fail(`[1] opts.crew.url ist ${crew?.url ?? 'leer'}, nicht ${manifest.url}?v=${manifest.v} (HangarApp.astro liest src/data/hangar-crew.json)`);
if (!glbBuf) fail(`[1] ${crew?.url ?? manifest.url} fehlt in dist/`);
else if (glbBuf.length !== manifest.bytes || hash !== manifest.v) fail(`[1] dist${manifest.url} ist nicht die Datei des Manifests (${glbBuf.length} B, Inhalt ${hash}): scripts/build-hangar-crew.mjs neu laufen lassen`);
if (!crew?.module || !/\/assets\/hangar-crew\.js\?v=\w+/.test(crew.module)) fail(`[1] opts.crew.module fehlt oder ist unversioniert (${crew?.module ?? 'leer'}): Dann laedt die Seite die starre Figur`);
else if (!existsSync(modFile)) fail(`[1] ${pathOf(crew.module)} fehlt in dist/`);

// ---- [2] ----
say('\n[2] Figur: Haut, Gewichte, Teilmaterialien, Atlas, Farbtafel, Obergrenzen');
let meta = null, doc = null;
const stat = { tris: 0, verts: 0, bones: 0, subs: 0 };
if (glbBuf) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  try { doc = await io.readBinary(new Uint8Array(glbBuf)); } catch (e) { fail(`[2] ${manifest.url} liest nicht (${e.message})`); }
  meta = doc?.getRoot().getAsset().extras?.crew ?? null;
  if (doc && !meta) fail('[2] der Kopf der Datei traegt kein asset.extras.crew (Clips, Knochen, Farbtafel)');
}
if (doc && meta) {
  const skins = doc.getRoot().listSkins(), prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  stat.bones = skins[0]?.listJoints().length ?? 0;
  if (skins.length !== 1 || prims.length !== 1) fail(`[2] erwartet ein Netz mit einer Haut, gefunden ${prims.length} Netze, ${skins.length} Haeute`);
  if (stat.bones !== meta.joints.length) fail(`[2] die Haut hat ${stat.bones} Gelenke, der Kopf nennt ${meta.joints.length}`);
  const names = skins[0]?.listJoints().map((j) => j.getName()) ?? [];
  const off = names.findIndex((n, i) => n !== meta.joints[i]);
  if (off >= 0) fail(`[2] Gelenk ${off} heisst ${names[off]}, der Kopf nennt ${meta.joints[off]}: Spuren trafen den falschen Knochen`);
  for (const [k, b] of Object.entries(meta.bones ?? {})) if (!meta.joints.includes(b) && k !== 'weaponR') fail(`[2] Knochen ${k} (${b}) fehlt im Skelett`);
  const p = prims[0];
  if (p) {
    const A = (n) => p.getAttribute(n);
    const pos = A('POSITION'), sub = A('TEXCOORD_1'), uv = A('TEXCOORD_0'), jn = A('JOINTS_0'), wt = A('WEIGHTS_0');
    for (const [n, a] of [['POSITION', pos], ['TEXCOORD_0', uv], ['TEXCOORD_1', sub], ['JOINTS_0', jn], ['WEIGHTS_0', wt], ['NORMAL', A('NORMAL')]]) if (!a) fail(`[2] Attribut ${n} fehlt`);
    stat.verts = pos?.getCount() ?? 0;
    stat.tris = (p.getIndices()?.getCount() ?? 0) / 3;
    if (pos && sub && uv && jn && wt) {
      const nSub = meta.subs.length, j = [0, 0, 0, 0], w = [0, 0, 0, 0], s2 = [0, 0], t2 = [0, 0];
      let badJ = 0, badW = 0, badS = 0, badU = 0;
      const used = new Set();
      for (let i = 0; i < stat.verts; i++) {
        jn.getElement(i, j); wt.getElement(i, w); sub.getElement(i, s2); uv.getElement(i, t2);
        if (j.some((x) => x >= stat.bones)) badJ++;
        if (Math.abs(w.reduce((a, x) => a + x, 0) - 1) > 0.02) badW++;
        const si = Math.round(s2[0]);
        if (!(si >= 0 && si < nSub) || Math.abs(s2[0] - si) > 0.05) badS++; else used.add(si);
        if (!(t2[0] >= -0.001 && t2[0] <= 1.001 && t2[1] >= -0.001 && t2[1] <= 1.001)) badU++;
      }
      stat.subs = used.size;
      if (badJ) fail(`[2] ${badJ} Ecken haengen an Knochen ausserhalb des Skeletts`);
      if (badW) fail(`[2] ${badW} Ecken: Gewichte summieren sich nicht zu 1`);
      if (badS) fail(`[2] ${badS} Ecken: Teilmaterial (TEXCOORD_1) nicht in der Farbtafel (${nSub} Zeilen je Stellung)`);
      if (badU) fail(`[2] ${badU} Ecken: Texturkoordinaten ausserhalb des Atlas`);
    }
  }
  const tab = meta.table, raw = tab ? Buffer.from(tab.data, 'base64') : null;
  const want = tab ? tab.cols * tab.rows * meta.variants.length * 4 : 0;
  if (!raw || raw.length !== want || tab.rows !== meta.subs.length) fail(`[2] Farbtafel: ${raw?.length ?? 0} B, erwartet ${want} (${tab?.cols} Spalten x ${tab?.rows} Teilmaterialien x ${meta.variants.length} Stellungen), Zeilen = Teilmaterialien ${meta.subs.length}`);
  const tex = doc.getRoot().listTextures();
  if (tex.length !== 2 || tex.some((t) => t.getMimeType() !== 'image/webp')) fail(`[2] erwartet zwei WebP-Karten (Mischung, Detail), gefunden ${tex.map((t) => t.getMimeType()).join(', ')}`);
  sollIst(`hoechstens ${CAP.bytes / 1e6} MB, ${CAP.tris} Dreiecke, ${CAP.bones} Knochen; jede Ecke stimmig`,
    `${(glbBuf.length / 1e6).toFixed(2)} MB, ${stat.tris} Dreiecke, ${stat.verts} Ecken, ${stat.bones} Knochen, ${stat.subs} von ${meta.subs.length} Teilmaterialien belegt, Farbtafel ${raw?.length ?? 0} B`);
  if (glbBuf.length > CAP.bytes) fail(`[2] ${manifest.url}: ${(glbBuf.length / 1e6).toFixed(2)} MB ueber der Obergrenze ${CAP.bytes / 1e6} MB`);
  if (stat.tris > CAP.tris) fail(`[2] ${stat.tris} Dreiecke je Figur, Obergrenze ${CAP.tris}`);
  if (stat.bones > CAP.bones) fail(`[2] ${stat.bones} Knochen, Obergrenze ${CAP.bones}`);
}

// ---- [3] ----
say('\n[3] Animationsblock: Kopf, Clips, Spuren an Knochen, Bilder, Drehungen, Bahnen');
const anim = { clips: 0, tracks: 0, keys: 0 };
if (doc && meta) {
  const acc = doc.getRoot().listAccessors().find((a) => a.getName() === 'crew-anim');
  const b = acc ? Buffer.from(acc.getArray().buffer, acc.getArray().byteOffset, acc.getArray().byteLength) : null;
  if (!b) fail('[3] kein Accessor „crew-anim“: Die Crew stuende in Bindehaltung');
  else if (b.toString('latin1', 0, 4) !== 'CRW1') fail(`[3] Kopf ${b.toString('latin1', 0, 4)} statt CRW1`);
  else {
    const names = Object.keys(meta.clips), n = b.readUInt16LE(4);
    if (n !== names.length) fail(`[3] der Block traegt ${n} Clips, der Kopf nennt ${names.length}`);
    if (b.readUInt16LE(6) !== meta.joints.length) fail(`[3] der Block zaehlt ${b.readUInt16LE(6)} Knochen, das Skelett ${meta.joints.length}`);
    let o = 8;
    for (let c = 0; c < n && o < b.length; c++) {
      const ci = meta.clips[names[c]], nt = b.readUInt16LE(o), last = Math.round(ci.dur * ci.fps) + 1;
      o += 2;
      let bad = 0;
      for (let k = 0; k < nt; k++) {
        const bone = b[o], kind = b[o + 1], m = b.readUInt16LE(o + 2);
        o += 4;
        if (bone >= meta.joints.length || kind > 1 || !m) bad++;
        let prev = -1;
        for (let i = 0; i < m; i++) { const f = b.readUInt16LE(o + i * 2); if (f < prev || f > last) bad++; prev = f; }
        o += m * 2;
        if (kind === 0) {
          for (let i = 0; i < m; i++) { let q = 0; for (let e = 0; e < 4; e++) q += (b.readInt16LE(o + (i * 4 + e) * 2) / 32767) ** 2; if (Math.abs(Math.sqrt(q) - 1) > 0.01) bad++; }
          o += m * 8;
        } else {
          for (let i = 0; i < m * 3; i++) if (!Number.isFinite(b.readFloatLE(o + i * 4))) bad++;
          o += m * 12;
        }
        anim.tracks++; anim.keys += m;
      }
      if (bad) fail(`[3] Clip ${names[c]}: ${bad} unstimmige Spuren oder Schluessel`);
      if (ci.root && !ci.root.every((r, i) => r.length === 4 && r.every(Number.isFinite) && (i === 0 || r[0] > ci.root[i - 1][0]))) fail(`[3] Clip ${names[c]}: Bahn der Wurzel nicht stimmig`);
      anim.clips++;
    }
    if (o !== b.length) fail(`[3] der Block endet bei ${o} von ${b.length} B: Aufbau verschoben`);
  }
  sollIst(`${Object.keys(meta.clips).length} Clips stimmig`, `${anim.clips} Clips, ${anim.tracks} Spuren, ${anim.keys} Schluessel`);
}

// ---- [4] [5] [6] Modul ----
let mod = null;
if (modFile && existsSync(modFile)) {
  try { mod = await import(pathToFileURL(modFile).href); } catch (e) { fail(`[4] ${pathOf(crew.module)} laedt nicht als Modul (${e.message})`); }
}
say('\n[4] Jeder Clip, den das Modul spielen kann, steht in der Datei; mit Dauer nur Schleifen');
if (mod && meta) {
  if (typeof mod.crewClips !== 'function') fail('[4] das Modul exportiert crewClips nicht mehr: Dann prueft dieses Tor die Abläufe nicht');
  else {
    const need = mod.crewClips(), missing = [], noLoop = [];
    for (const [name, u] of need) {
      if (!meta.clips[name]) missing.push(name);
      else if (u.timed && !meta.clips[name].loop) noLoop.push(name);
    }
    sollIst('0 fehlen, 0 mit Dauer ohne Schleife', `${need.size} Clips gebraucht, ${missing.length} fehlen${missing.length ? ` (${missing.join(', ')})` : ''}, ${noLoop.length} mit Dauer ohne Schleife${noLoop.length ? ` (${noLoop.join(', ')})` : ''}`);
    for (const n of missing) fail(`[4] Clip ${n} fehlt in ${manifest.url}: CLIPS in scripts/build-hangar-crew.mjs und WORK in assets/hangar-crew.js passen nicht zusammen`);
    for (const n of noLoop) fail(`[4] Clip ${n} laeuft mit Dauer, ist in der Datei aber keine Schleife: die Figur erstarrte bis zum Ende der Dauer`);
  }
}
say('\n[5] Jeder Einhaengepunkt des Materials steht im Shader von three.js');
if (mod) {
  const A = mod.CREW_ANCHORS, sh = THREE.ShaderLib.physical;
  if (!A) fail('[5] das Modul exportiert CREW_ANCHORS nicht mehr');
  else {
    const miss = [...A.vertex.filter((a) => !sh.vertexShader.includes(a)), ...A.fragment.filter((a) => !sh.fragmentShader.includes(a))];
    sollIst('0 fehlen', `${A.vertex.length + A.fragment.length} Stellen, ${miss.length} fehlen${miss.length ? ` (${miss.join(', ')})` : ''} (three.js ${THREE.REVISION})`);
    for (const a of miss) fail(`[5] ${a} steht nicht mehr im Shader von three.js ${THREE.REVISION}: assets/hangar-crew.js (crewMaterial) neu einhaengen`);
  }
}
say('\n[6] Wege: nur ueber freie Zellen, um Rumpf und Geraet herum (Probelauf)');
const wege = { gesucht: 0, gefunden: 0, schnitte: 0, umgehen: 0, umgangen: 0, zuNah: 0, naechster: Infinity };
if (mod?.buildNav && mod?.pathOf) {
  // Schiff 6 x 14 m (Rumpf tief), vier Geraete daneben, Feld 30 x 40 m
  const hull = (x, z) => Math.abs(x) < 3 && Math.abs(z) < 7;
  const blocks = [[-4.6, -2, 0.9, 0.7], [4.6, -3, 0.8, 1.1], [4.6, 3.5, 1.2, 0.7], [0, 9.5, 1.4, 1.0]].map(([x, z, ex, ez]) => ({ x, z, ex, ez }));
  const nav = mod.buildNav({ x0: -15, x1: 15, z0: -20, z1: 20 }, blocks, hull);
  const R = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const inBlock = (x, z) => hull(x, z) || blocks.some((r) => Math.abs(x - r.x) < r.ex && Math.abs(z - r.z) < r.ez);
  for (let k = 0; k < 120; k++) {
    let a, b;
    do a = new THREE.Vector3(-14 + R() * 28, 0, -19 + R() * 38); while (!nav.free(a.x, a.z));
    do b = new THREE.Vector3(-14 + R() * 28, 0, -19 + R() * 38); while (!nav.free(b.x, b.z));
    wege.gesucht++;
    const pts = nav.route(a, b);
    if (!pts) continue;
    wege.gefunden++;
    const p = mod.pathOf(pts), q = new THREE.Vector3();
    for (let d = 0; d <= p.total; d += 0.1) { p.at(d, q); if (inBlock(q.x, q.z)) { wege.schnitte++; break; } }
    // eine Figur steht mitten auf der geraden Strecke (frei, weit genug von a und b)
    const m = a.clone().lerp(b, 0.5);
    if (!nav.free(m.x, m.z) || m.distanceTo(a) < 2 || m.distanceTo(b) < 2) continue;
    wege.umgehen++;
    const um = nav.route(a, b, [m]);
    if (!um) continue;
    wege.umgangen++;
    const pu = mod.pathOf(um);
    let nah = Infinity;
    for (let d = 0; d <= pu.total; d += 0.05) { pu.at(d, q); nah = Math.min(nah, Math.hypot(q.x - m.x, q.z - m.z)); }
    wege.naechster = Math.min(wege.naechster, nah);
    if (nah < ABSTAND) wege.zuNah++;
  }
  sollIst('jeder Weg gefunden, 0 schneiden Rumpf oder Geraet', `${wege.gesucht} gesucht, ${wege.gefunden} gefunden, ${wege.schnitte} schneiden`);
  sollIst(`um eine Figur auf der Strecke: mindestens ${KLINKE.umgehen} Proben, keiner naeher als ${ABSTAND} m`,
    `${wege.umgehen} Proben, ${wege.umgangen} Wege gefunden, ${wege.zuNah} zu nah, naechster ${wege.naechster.toFixed(2)} m`);
  if (wege.umgehen < KLINKE.umgehen) fail(`[6] nur ${wege.umgehen} Proben mit einer Figur auf der Strecke (Klinke ${KLINKE.umgehen})`);
  if (wege.umgangen < wege.umgehen) fail(`[6] ${wege.umgehen - wege.umgangen} Wege um eine stehende Figur nicht gefunden`);
  if (wege.zuNah) fail(`[6] ${wege.zuNah} Wege fuehren naeher als ${ABSTAND} m an einer stehenden Figur vorbei (naechster ${wege.naechster.toFixed(2)} m): AVOID_R in assets/hangar-crew.js`);
  if (wege.gefunden < wege.gesucht) fail(`[6] ${wege.gesucht - wege.gefunden} von ${wege.gesucht} Wegen zwischen freien Stellen nicht gefunden`);
  if (wege.schnitte) fail(`[6] ${wege.schnitte} Wege fuehren durch Rumpf oder Geraet`);
} else if (mod) fail('[6] das Modul exportiert buildNav oder pathOf nicht mehr');

// ---- [7] ----
say('\n[7] Verkabelung im ausgelieferten Viewer');
const viewerFile = stage?.viewer ? fromUrl(stage.viewer) : null;
const viewer = viewerFile && existsSync(viewerFile) ? readFileSync(viewerFile, 'utf8') : '';
const NAHT = [
  ['Arbeitsplaetze aus dem Wartungsplatz (layDienst: d.spots, d.boxes, d.field)', /d\.spots\s*=[\s\S]{0,600}d\.boxes\s*=[\s\S]{0,300}d\.field\s*=/],
  ['Aufstandspunkte in der Schiffs-info (feet)', /const info = \{[^}]*\bfeet\b/],
  ['Plaetze an die Crew (setBlocks mit crewPlaces)', /life\.setBlocks\([^;]*crewPlaces\(/],
  ['Uebergabe in buildLife (useRig -> rigLayout -> rig.layout)', /function useRig\([\s\S]{0,600}rigLayout\(\)[\s\S]{0,800}function rigLayout\(\)[\s\S]{0,800}rig\.layout\(/],
  ['Ladezweig (opts.crew.module, crewRig, useRig)', /opts\.crew\?\.module[\s\S]{0,400}crewRig\([\s\S]{0,400}life\.useRig\(/],
];
const torn = NAHT.filter(([, re]) => !re.test(viewer));
if (viewer && !/if \(rig\) \{[\s\S]{0,200}rig\.update\(dt, t, hold\)/.test(viewer)) torn.push(['update an die Crew (if (rig) { rig.update(…) })']);
sollIst(`${NAHT.length + 1} Stellen`, `${NAHT.length + 1 - torn.length} gefunden${torn.length ? `, fehlt: ${torn.map(([n]) => n).join('; ')}` : ''}`);
if (!viewer) fail(`[7] Viewer ${stage?.viewer ?? '—'} fehlt in dist/`);
for (const [n] of torn) fail(`[7] im Viewer fehlt: ${n}`);

// ---- [8] ----
say('\n[8] Klinken');
const nClips = meta ? Object.keys(meta.clips).length : 0, nVar = meta?.variants.length ?? 0;
sollIst(`mindestens ${KLINKE.clips} Clips, ${KLINKE.variants} Farbstellungen`, `${nClips} Clips, ${nVar} Farbstellungen`);
if (nClips < KLINKE.clips) fail(`[8] nur ${nClips} Clips, Klinke ${KLINKE.clips}`);
if (nVar < KLINKE.variants) fail(`[8] nur ${nVar} Farbstellungen, Klinke ${KLINKE.variants}`);

say('\n[Selbstauskunft]');
say(`    Figur: ${glbBuf ? (statSync(glbFile).size / 1e6).toFixed(2) : '—'} MB, ${stat.tris} Dreiecke, ${stat.bones} Knochen   Clips: ${anim.clips} (${anim.tracks} Spuren, ${anim.keys} Schluessel)   Farbstellungen: ${nVar}   Wege: ${wege.gefunden}/${wege.gesucht}, um Figur ${wege.umgangen}/${wege.umgehen}   Viewer-Stellen: ${NAHT.length + 1}`);

if (findings.length) {
  console.error(`\nverify-hangar-crew: ${findings.length} FEHLER\n`);
  for (const f of findings) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
say('\nverify-hangar-crew: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
