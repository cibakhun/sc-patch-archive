/* ============================================================
   measure-hangar-cockpit.mjs — Durchblick durch die Haube.

   Anlass: Krisz, 29.10.2026, Gladius auf staging: „siehst wie das schiff
   von innen hohl ist?“ Hinter dem Sitz fehlte die Rückwand, der Blick
   ging durch das Glas bis an die Innenseite des Rumpfs. Die ist einseitig
   und von innen unsichtbar, also sah man durch das Schiff in die Halle.
   Notiz: .planning/notes/hangar-cockpit-hohl.md.

   Was es misst: je Schiff Strahlen von außen durch das Haubenglas hinein
   (Stichprobe flächengewichtet, Richtung zur Haubenmitte und nach unten,
   leicht gestreut, fester Startwert). Hinter dem Glas zählt die erste
   undurchsichtige Fläche:
     Vorderseite oder zweiseitig  → zu (man sieht etwas)
     Rückseite eines einseitigen  → hohl (man sieht hindurch)
     nichts bis 30 m              → frei (Glas auf beiden Seiten, oder hohl)
   Glas = Material mit glass/canopy/window im Namen und Alpha BLEND,
   ohne Scheinwerfer- und Lampengläser.

   Werkzeug, kein Tor (gate-registry: rail null): Es vergleicht Rohexport
   und Web-Fassung (PC) und zeigt, welche Schiffe betroffen sind.

     node scripts/measure-hangar-cockpit.mjs <ordner> [regex] [--json datei]
   ============================================================ */
import { readdirSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
const [dir, pat] = args;
if (!dir) { console.error('node scripts/measure-hangar-cockpit.mjs <ordner> [regex] [--json datei]'); process.exit(2); }
const only = pat ? new RegExp(pat) : null;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

const GLASS = /glass|canopy|window/i;
const NOT_GLASS = /headlight|light_glass|lamp|lens|bulb/i;
const RAYS = 160, REACH = 30, NEAR = 8;

function measure(doc) {
  // Dreiecke in Weltkoordinaten; Art: 0 einseitig, 1 zweiseitig, 2 Glas, 3 sonst durchsichtig
  const pos = [], kind = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const W = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue;
      const m = p.getMaterial(); const name = m?.getName() || '';
      const blend = m?.getAlphaMode() === 'BLEND';
      const k = blend && GLASS.test(name) && !NOT_GLASS.test(name) ? 2 : blend ? 3 : m?.getDoubleSided() ? 1 : 0;
      const P = p.getAttribute('POSITION'); const I = p.getIndices();
      const n = I ? I.getCount() : P.getCount();
      const v = new Float64Array(P.getCount() * 3); const e = [0, 0, 0];
      for (let i = 0; i < P.getCount(); i++) {
        P.getElement(i, e);
        v[3 * i] = W[0] * e[0] + W[4] * e[1] + W[8] * e[2] + W[12];
        v[3 * i + 1] = W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13];
        v[3 * i + 2] = W[2] * e[0] + W[6] * e[1] + W[10] * e[2] + W[14];
      }
      for (let i = 0; i + 2 < n; i += 3) {
        for (let j = 0; j < 3; j++) { const a = I ? I.getScalar(i + j) : i + j; pos.push(v[3 * a], v[3 * a + 1], v[3 * a + 2]); }
        kind.push(k);
      }
    }
  }
  const T = kind.length;
  const X = Float64Array.from(pos);
  const glass = []; for (let t = 0; t < T; t++) if (kind[t] === 2) glass.push(t);
  if (!glass.length) return { tris: T, glass: 0 };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of glass) for (let j = 0; j < 9; j++) { const k = j % 3; lo[k] = Math.min(lo[k], X[9 * t + j]); hi[k] = Math.max(hi[k], X[9 * t + j]); }
  // Kandidaten: Dreiecke um die Haube, mit Hüllkugel für den Schnelltest
  const near = [];
  for (let t = 0; t < T; t++) {
    let ok = false;
    for (let j = 0; j < 3 && !ok; j++) ok = [0, 1, 2].every((k) => X[9 * t + 3 * j + k] > lo[k] - NEAR && X[9 * t + 3 * j + k] < hi[k] + NEAR);
    if (ok) near.push(t);
  }
  const C = new Float64Array(near.length * 4);
  near.forEach((t, i) => {
    const b = 9 * t; const c = [0, 1, 2].map((k) => (X[b + k] + X[b + 3 + k] + X[b + 6 + k]) / 3);
    let r = 0; for (let j = 0; j < 3; j++) r = Math.max(r, Math.hypot(X[b + 3 * j] - c[0], X[b + 3 * j + 1] - c[1], X[b + 3 * j + 2] - c[2]));
    C.set([...c, r], 4 * i);
  });
  const area = glass.map((t) => { const b = 9 * t; const e1 = [X[b + 3] - X[b], X[b + 4] - X[b + 1], X[b + 5] - X[b + 2]], e2 = [X[b + 6] - X[b], X[b + 7] - X[b + 1], X[b + 8] - X[b + 2]];
    return Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2; });
  const total = area.reduce((a, b) => a + b, 0);
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ctr = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
  let zu = 0, hohl = 0, frei = 0;
  for (let s = 0; s < RAYS; s++) {
    let r = rnd() * total, g = 0; while (r > area[g] && g < area.length - 1) r -= area[g++];
    const b = 9 * glass[g]; let u = rnd(), w = rnd(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const p = [0, 1, 2].map((k) => X[b + k] + u * (X[b + 3 + k] - X[b + k]) + w * (X[b + 6 + k] - X[b + k]));
    let d = [0, 1, 2].map((k) => ctr[k] - p[k] + (rnd() - 0.5) * 0.6 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.3);
    const dl = Math.hypot(...d); d = d.map((x) => x / dl);
    const o = [0, 1, 2].map((k) => p[k] - d[k] * 0.3);
    let best = Infinity, bestT = -1, bestFront = false;
    for (let i = 0; i < near.length; i++) {
      const cx = C[4 * i] - o[0], cy = C[4 * i + 1] - o[1], cz = C[4 * i + 2] - o[2], cr = C[4 * i + 3];
      const along = cx * d[0] + cy * d[1] + cz * d[2];
      if (along < -cr || along > REACH + cr) continue;
      const qx = cy * d[2] - cz * d[1], qy = cz * d[0] - cx * d[2], qz = cx * d[1] - cy * d[0];
      if (qx * qx + qy * qy + qz * qz > cr * cr) continue;
      const t = near[i], q = 9 * t; // Möller–Trumbore
      const e1 = [X[q + 3] - X[q], X[q + 4] - X[q + 1], X[q + 5] - X[q + 2]], e2 = [X[q + 6] - X[q], X[q + 7] - X[q + 1], X[q + 8] - X[q + 2]];
      const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
      const a = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2]; if (Math.abs(a) < 1e-12) continue;
      const f = 1 / a; const sv = [o[0] - X[q], o[1] - X[q + 1], o[2] - X[q + 2]];
      const uu = f * (sv[0] * h[0] + sv[1] * h[1] + sv[2] * h[2]); if (uu < 0 || uu > 1) continue;
      const qv = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]];
      const vv = f * (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]); if (vv < 0 || uu + vv > 1) continue;
      const tt = f * (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]);
      if (tt <= 0.32 || tt >= REACH || kind[t] >= 2) continue; // vor dem Glas oder durchsichtig
      // a = -d·(e1×e2): a > 0 heißt, der Strahl sieht die Vorderseite
      if (tt < best - 0.02 || (Math.abs(tt - best) <= 0.02 && (a > 0 || kind[t] === 1))) { best = tt; bestT = t; bestFront = a > 0 || kind[t] === 1; }
    }
    if (bestT < 0) frei++;
    else if (bestFront) zu++;
    else hohl++;
  }
  return { tris: T, glass: glass.length, rays: RAYS, zu, hohl, frei, hohlPct: Math.round((100 * hohl) / RAYS) };
}

const files = readdirSync(dir).filter((f) => f.endsWith('.glb') && (!only || only.test(f))).sort();
const out = {};
for (const f of files) {
  const r = measure(await io.read(`${dir}/${f}`));
  out[f.replace(/\.glb$/, '')] = r;
  console.log(f.padEnd(44), r.glass ? `Glas ${String(r.glass).padStart(5)}  hohl ${String(r.hohlPct).padStart(3)} %  (zu ${r.zu}, hohl ${r.hohl}, frei ${r.frei} von ${r.rays})` : 'kein Haubenglas');
}
const withGlass = Object.values(out).filter((r) => r.glass);
console.log(`\n${files.length} Modelle, ${withGlass.length} mit Haubenglas, hohl im Mittel ${withGlass.length ? (withGlass.reduce((a, r) => a + r.hohlPct, 0) / withGlass.length).toFixed(1) : '-'} %`);
if (jsonFile) writeFileSync(jsonFile, JSON.stringify(out, null, 1));
