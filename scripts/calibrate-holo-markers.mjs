// Holo-Marker-Kalibrierung: legt die extrahierten Hardpoint-Positionen
// (ship-hardpoints.json, CryEngine-Schiffsraum) über das jeweilige
// FleetYards-Holo-Mesh und schreibt FINALE Mesh-Raum-Koordinaten pro Schiff.
// Der Client bekommt fertige Positionen — die ganze Kalibrier-Komplexität
// bleibt im Buildstep.
//
// Verfahren (numerisch validiert, siehe Branch-Historie):
//  1. Granulare StarFab-Holos (~10 Schiffe) tragen die hardpoint_*-Locator
//     selbst -> Positionen direkt aus dem Szenengraph (perfekte Ausrichtung).
//  2. Alle anderen: Achs-Permutation erkennen (CTM: fy=[x,z,-y] bzw.
//     StarFab: fy=[-y,z,-x]) über "2 von 3 Extent-Verhältnissen stimmen
//     überein" gegen die echte Hull-AABB; Skala = Median der Verhältnisse;
//     Translation = Center-Align pro Achse. Bug-Richtung GEOMETRISCH per
//     Slab-Test: Draco-Vertices dekodieren (draco3d), Querschnittsfläche an
//     beiden Enden der Längsachse vergleichen — der Bug läuft spitz zu
//     (Corsair: 27 m² Bug vs. 662 m² Heck, eindeutig). Validierung Corsair:
//     exakt (Nasenspitze auf den Zentimeter), Gladius: <1 m.
//
// Usage:  node scripts/calibrate-holo-markers.mjs [--only slug1,slug2]
// Cache:  .cache/holo-gltf/<slug>.gltf  (gitignored, einmalig ~2 GB)
// Output: src/data/holo-markers.json
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import draco3d from 'draco3d';

// Draco-Modul-Verwaltung: Emscripten-Heap wächst pro Decode und wird nie
// kleiner — nach N Decodes frisches Modul, Decodes strikt serialisiert
// (parallele Decodes im selben Modul sprengen den Heap).
let dracoMod = null;
let dracoUses = 0;
let dracoLock = Promise.resolve();
function withDraco(fn) {
  const run = dracoLock.then(async () => {
    if (!dracoMod || dracoUses >= 12) {
      dracoMod = await draco3d.createDecoderModule({});
      dracoUses = 0;
    }
    dracoUses++;
    try {
      return fn(dracoMod);
    } catch (err) {
      // WASM-Abort macht das Modul unbrauchbar -> beim nächsten Decode frisch
      dracoMod = null;
      throw err;
    }
  });
  dracoLock = run.catch(() => {});
  return run;
}

const HARDPOINTS = new URL('../src/data/ship-hardpoints.json', import.meta.url);
const EXTRAS = new URL('../src/data/ship-extras.json', import.meta.url);
const OUT = new URL('../src/data/holo-markers.json', import.meta.url);
const CACHE = new URL('../.cache/holo-gltf/', import.meta.url);
mkdirSync(CACHE, { recursive: true });

const snap = JSON.parse(readFileSync(HARDPOINTS, 'utf8'));
const extras = JSON.parse(readFileSync(EXTRAS, 'utf8')).extras;

let only = null;
{
  const ix = process.argv.findIndex((a) => a === '--only' || a.startsWith('--only='));
  if (ix !== -1) {
    const a = process.argv[ix];
    const val = a.includes('=') ? a.slice(a.indexOf('=') + 1) : process.argv[ix + 1];
    if (!val || val.startsWith('--')) {
      console.error('--only braucht eine Slug-Liste (z. B. --only drak-corsair,aegs-gladius)');
      process.exit(1);
    }
    only = new Set(val.split(','));
  }
}

/* ---------- Mini-Mat4 (Spalten-major, wie glTF) ---------- */
function mat4Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function trsToMat4(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const applyM = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];

/* ---------- glTF laden (Cache -> Netz), GLB-Container tolerieren ---------- */
async function loadGltf(slug, url) {
  const cacheFile = new URL(`${slug}.gltf`, CACHE);
  let buf;
  if (existsSync(cacheFile)) {
    buf = await readFile(cacheFile);
  } else {
    const res = await fetch(url, { headers: { 'User-Agent': 'sc-patch-archiv fan site (holo calibration, one-time)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    // Format VOR dem Cachen prüfen — eine 200er-HTML-Wartungsseite würde
    // sonst den Cache dauerhaft vergiften
    const head = buf.subarray(0, 4).toString('latin1');
    if (head !== 'glTF' && !/^\s*\{/.test(buf.subarray(0, 64).toString('utf8'))) {
      throw new Error('Antwort ist kein glTF/GLB (HTML-Fehlerseite?)');
    }
    await writeFile(cacheFile, buf);
  }
  if (buf.subarray(0, 4).toString('latin1') === 'glTF') {
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
    // BIN-Chunk (Typ 0x004E4942) direkt nach dem JSON-Chunk
    let bin = null;
    const p = 20 + jsonLen;
    if (p + 8 <= buf.length && buf.readUInt32LE(p + 4) === 0x004e4942) {
      bin = buf.subarray(p + 8, p + 8 + buf.readUInt32LE(p));
    }
    return { json, bin };
  }
  return { json: JSON.parse(buf.toString('utf8')), bin: null };
}

/* ---------- Draco: Haupt-Primitiv dekodieren (Bug-Richtungs-Slab-Test) ---------- */
function gltfBufferBytes(json, bin) {
  const uri = json.buffers?.[0]?.uri;
  if (uri?.startsWith('data:')) return Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
  return bin;
}
/** Vertices des größten Draco-Primitivs, welt-transformiert und gesampelt */
function mainPrimitiveVerts(json, bin, meshWorld) {
  const bytes = gltfBufferBytes(json, bin);
  if (!bytes) return null;
  let best = null;
  for (const [mi, mesh] of (json.meshes ?? []).entries()) {
    for (const prim of mesh.primitives ?? []) {
      const ext = prim.extensions?.KHR_draco_mesh_compression;
      if (!ext) continue;
      const bv = json.bufferViews[ext.bufferView];
      if (!best || bv.byteLength > best.bv.byteLength) best = { mi, ext, bv };
    }
  }
  if (!best) return null;
  const world = meshWorld.get(best.mi);
  if (!world) return null;
  const slice = bytes.subarray(best.bv.byteOffset ?? 0, (best.bv.byteOffset ?? 0) + best.bv.byteLength);

  return withDraco((M) => {
    const decoder = new M.Decoder();
    const dbuf = new M.DecoderBuffer();
    dbuf.Init(new Int8Array(slice.buffer, slice.byteOffset, slice.byteLength), slice.byteLength);
    const out = [];
    try {
      if (decoder.GetEncodedGeometryType(dbuf) !== M.TRIANGULAR_MESH) return null;
      const mesh = new M.Mesh();
      const st = decoder.DecodeBufferToMesh(dbuf, mesh);
      if (!st.ok()) { M.destroy(mesh); return null; }
      const att = decoder.GetAttributeByUniqueId(mesh, best.ext.attributes.POSITION);
      const n = mesh.num_points();
      const arr = new M.DracoFloat32Array();
      decoder.GetAttributeFloatForAllPoints(mesh, att, arr);
      const step = Math.max(1, Math.floor(n / 60000));
      for (let i = 0; i < n; i += step) {
        out.push(applyM(world, [arr.GetValue(i * 3), arr.GetValue(i * 3 + 1), arr.GetValue(i * 3 + 2)]));
      }
      M.destroy(arr);
      M.destroy(mesh);
    } finally {
      M.destroy(dbuf);
      M.destroy(decoder);
    }
    return out;
  });
}
/** Bug-Seite auf der Längsachse: Querschnittsfläche beider Enden vergleichen.
 *  Liefert +1 (Bug am Max-Ende), -1 (Bug am Min-Ende) oder 0 (uneindeutig). */
function noseSideBySlab(verts, lenAxis) {
  if (!verts || verts.length < 500) return 0;
  const oth = [0, 1, 2].filter((k) => k !== lenAxis);
  let lo = Infinity, hi = -Infinity;
  for (const p of verts) { lo = Math.min(lo, p[lenAxis]); hi = Math.max(hi, p[lenAxis]); }
  const cut = (hi - lo) * 0.14;
  const area = (a, b) => {
    const mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
    let n = 0;
    for (const p of verts) if (p[lenAxis] >= a && p[lenAxis] <= b) {
      n++;
      for (let j = 0; j < 2; j++) { mn[j] = Math.min(mn[j], p[oth[j]]); mx[j] = Math.max(mx[j], p[oth[j]]); }
    }
    return n < 20 ? 0 : (mx[0] - mn[0]) * (mx[1] - mn[1]);
  };
  const aMin = area(lo, lo + cut);
  const aMax = area(hi - cut, hi);
  if (!aMin || !aMax) return 0;
  const ratio = Math.min(aMin, aMax) / Math.max(aMin, aMax);
  if (ratio > 0.62) return 0; // kein klarer Taper -> keine Aussage
  return aMin < aMax ? -1 : 1;
}

/* ---------- Szenengraph: Welt-Transforms + AABBs ---------- */
function analyze(gltf) {
  const nodes = gltf.nodes ?? [];
  const world = new Array(nodes.length).fill(null);
  function walk(idx, parent) {
    world[idx] = mat4Mul(parent, trsToMat4(nodes[idx]));
    for (const c of nodes[idx].children ?? []) walk(c, world[idx]);
  }
  const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []) walk(r, IDENT);

  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  const meshWorld = new Map(); // mesh-Index -> Welt-Matrix (erster tragender Node)
  nodes.forEach((n, i) => {
    if (n.mesh === undefined || world[i] === null) return;
    if (!meshWorld.has(n.mesh)) meshWorld.set(n.mesh, world[i]);
    for (const prim of gltf.meshes[n.mesh].primitives ?? []) {
      const acc = gltf.accessors?.[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (const cx of [acc.min[0], acc.max[0]]) for (const cy of [acc.min[1], acc.max[1]]) for (const cz of [acc.min[2], acc.max[2]]) {
        const w = applyM(world[i], [cx, cy, cz]);
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); }
      }
    }
  });

  // native hardpoint_*-Locator (StarFab-Exporte): Namen normalisieren,
  // Origin-Stapel (nicht platzierte Locator) verwerfen, Erst-Treffer gewinnt
  const native = new Map();
  const normName = (s) => s.toLowerCase().replace(/\.\d+$/, '').replace(/^[0-9a-f]{6}_/, '');
  nodes.forEach((n, i) => {
    const nm = n.name ?? '';
    if (!/^(?:[0-9a-f]{6}_)?hardpoint_/i.test(nm) || world[i] === null) return;
    const key = normName(nm);
    const p = [world[i][12], world[i][13], world[i][14]];
    if (Math.hypot(...p) < 0.01) return; // am Origin gestapelt -> unbrauchbar
    if (!native.has(key)) native.set(key, p);
  });

  return {
    mesh: { mn, mx, size: mn.map((v, k) => mx[k] - v), center: mn.map((v, k) => (v + mx[k]) / 2) },
    meshWorld,
    native,
  };
}

/* ---------- Achs-Permutationen cry -> fy ---------- */
// Jede Permutation: fy[k] = sgn[k] * cry[axis[k]]; lenAxis = fy-Achse der Länge,
// noseSign = Vorzeichen der Bug-Richtung auf dieser Achse (cry +Y = Bug).
const PERMS = {
  // RSI-CTM-Konvention: x lateral, y hoch, z längs (Bug bei -Z)
  ctm: { axis: [0, 2, 1], sgn: [1, 1, -1], lenAxis: 2 },
  // StarFab/Blender-Konvention: x längs (Bug bei -X), y hoch, z lateral
  starfab: { axis: [1, 2, 0], sgn: [-1, 1, -1], lenAxis: 0 },
};
const applyPerm = (P, p) => [P.sgn[0] * p[P.axis[0]], P.sgn[1] * p[P.axis[1]], P.sgn[2] * p[P.axis[2]]];
// 180°-Yaw (Bug-Flip): Längs- UND Lateralachse spiegeln (bleibt eine Rotation)
function flipped(P) {
  const latAxis = [0, 1, 2].find((k) => k !== P.lenAxis && k !== 1);
  const sgn = [...P.sgn];
  sgn[P.lenAxis] *= -1;
  sgn[latAxis] *= -1;
  return { ...P, sgn };
}

/* ---------- Kalibrierung für ein Schiff ---------- */
function calibrate(ship, an, noseSide) {
  const hull = ship.hull ?? ship.bbox;
  const hullExt = [hull[1][0] - hull[0][0], hull[1][1] - hull[0][1], hull[1][2] - hull[0][2]];
  const hullCen = [0, 1, 2].map((k) => (hull[0][k] + hull[1][k]) / 2);

  // Permutation wählen: Extent-Verhältnisse (vorzeichenfrei) — die zwei
  // nächstliegenden Achsen müssen übereinstimmen (Pose-Differenzen wie
  // ausgeklappte Flügel verfälschen höchstens eine Achse)
  let bestP = null;
  for (const [name, P] of Object.entries(PERMS)) {
    const ratios = [0, 1, 2].map((k) => an.mesh.size[k] / hullExt[P.axis[k]]);
    const sorted = [...ratios].sort((a, b) => a - b);
    const pairSpread = Math.min(sorted[1] / sorted[0], sorted[2] / sorted[1]);
    // Median als Skala
    const s = sorted[1];
    const q = { name, P, s, ratios, pairSpread };
    if (!bestP || pairSpread < bestP.pairSpread) bestP = q;
  }
  let conf = bestP.pairSpread < 1.07 ? 'high' : 'low';
  let P = bestP.P;
  const s = bestP.s;

  // Bug-Richtung aus dem Slab-Test (Geometrie-Taper): erwartet wird der Bug
  // (cry +Y) am Ende sgn[lenAxis]. Widerspricht der Taper -> 180°-Yaw.
  // HOLO_NOSE=flip|noflip als Debug-Override.
  let noseChecked = false;
  if (process.env.HOLO_NOSE === 'flip') {
    P = flipped(P);
    noseChecked = true;
  } else if (process.env.HOLO_NOSE === 'noflip') {
    noseChecked = true;
  } else if (noseSide !== 0) {
    noseChecked = true;
    if (noseSide !== P.sgn[P.lenAxis]) {
      // Taper widerspricht der Export-Konvention: dem Taper folgen, aber als
      // Einzelsignal nicht mit voller Konfidenz ausliefern (Marker kriegen
      // dann das "geschätzt"-Styling statt eines stillen 180°-Fehlers).
      P = flipped(P);
      if (conf === 'high') conf = 'mid';
    }
  }
  if (!noseChecked && conf === 'high') conf = 'mid'; // Orientierung ungeprüft

  // Translation: Center-Align pro Achse (validiert: exakt auf Längs-/Hochachse)
  const permCen = applyPerm(P, hullCen);
  const t = [0, 1, 2].map((k) => an.mesh.center[k] - s * permCen[k]);

  return { P, s, t, conf, permName: bestP.name, ratios: bestP.ratios.map((r) => +r.toFixed(3)), noseChecked, flippedNose: P !== bestP.P };
}

/* ---------- Hauptlauf ---------- */
const out = {};
const report = [];
const slugs = Object.keys(snap.ships).filter((id) => extras[id]?.holo && (!only || only.has(id)));
console.log(`${slugs.length} Schiffe mit Holo + Hardpoint-Daten${only ? ' (gefiltert)' : ''}`);

let done = 0;
const CONC = 4;
async function work(slug) {
  const ship = snap.ships[slug];
  try {
    const { json: gltf, bin } = await loadGltf(slug, extras[slug].holo);
    const an = analyze(gltf);
    const r3 = (x) => Math.round(x * 1000) / 1000;

    // 1) native Locator, wenn ausreichend vorhanden (granulare StarFab-Holos).
    // Kern-Zählung über die bereits klassifizierten Kinds aus dem Snapshot —
    // keine dritte, eigene Namens-Regex-Variante pflegen.
    const nat = an.native;
    const CORE = new Set(['power', 'shield', 'cooler', 'quantum', 'radar']);
    const coreNative = ship.hp.filter((h) => CORE.has(h.k) && nat.has(h.n.toLowerCase())).length;
    if (nat.size >= 8 && coreNative >= 3) {
      const ports = [];
      for (const h of ship.hp) {
        const key = h.n.toLowerCase();
        const p = nat.get(key);
        if (p) ports.push({ n: h.n, k: h.k, p: p.map(r3), q: 'native' });
      }
      // native Nodes, die im cry-Set fehlen, trotzdem mitnehmen? Nein — das
      // cry-Set ist der Katalog; native dient nur als Positionsquelle.
      if (ports.length >= 5) {
        out[slug] = { mode: 'native', mesh: { c: an.mesh.center.map(r3), s: an.mesh.size.map(r3) }, ports };
        report.push({ slug, mode: 'native', n: ports.length });
        return;
      }
    }

    // 2) kalibriertes Mapping — Bug-Richtung geometrisch via Slab-Test.
    // Decode-Fehler (WASM-Heap) kosten nur die Bug-Prüfung, nicht das Schiff.
    const lenAxisGuess = calibrate(ship, an, 0).P.lenAxis;
    let noseSide = 0;
    try {
      const verts = await mainPrimitiveVerts(gltf, bin, an.meshWorld);
      noseSide = noseSideBySlab(verts, lenAxisGuess);
    } catch { /* noseSide 0 -> conf mid */ }
    const cal = calibrate(ship, an, noseSide);
    const ports = ship.hp.map((h) => {
      const pp = applyPerm(cal.P, h.p);
      return { n: h.n, k: h.k, p: pp.map((x, k2) => r3(cal.s * x + cal.t[k2])), q: 'mapped' };
    });
    out[slug] = {
      mode: 'mapped',
      conf: cal.conf,
      mesh: { c: an.mesh.center.map(r3), s: an.mesh.size.map(r3) },
      /** [Längsachse, Lateralachse] im Mesh-Raum (Debug-Yaw-Flip im Viewer) */
      ax: [cal.P.lenAxis, [0, 1, 2].find((k) => k !== cal.P.lenAxis && k !== 1)],
      ports,
    };
    report.push({ slug, mode: `mapped/${cal.permName}${cal.flippedNose ? '+yaw' : ''}${cal.noseChecked ? '' : '!nose'}`, conf: cal.conf, ratios: cal.ratios.join('/') });
  } catch (err) {
    report.push({ slug, mode: 'FEHLER', err: err.message });
  } finally {
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${slugs.length} …`);
  }
}

const queue = [...slugs];
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) await work(queue.shift());
}));

/* ---------- Report + Snapshot ---------- */
const native = report.filter((r) => r.mode === 'native').length;
const high = report.filter((r) => r.conf === 'high').length;
const mid = report.filter((r) => r.conf === 'mid').length;
const low = report.filter((r) => r.conf === 'low').length;
const errs = report.filter((r) => r.mode === 'FEHLER');
console.log(`\nnative: ${native} · mapped high: ${high} · mid(!nose): ${mid} · low: ${low} · Fehler: ${errs.length}`);
for (const r of report.filter((x) => x.conf === 'low' || x.mode === 'FEHLER')) {
  console.log(`  ${r.slug}: ${r.mode} ${r.err ?? `ratios=${r.ratios}`}`);
}

if (Object.keys(out).length < 50 && !only) {
  console.error('unter 50 Schiffen — Snapshot wird NICHT überschrieben (Fail-safe).');
  process.exit(1);
}
if (only) {
  // Teillauf: bestehenden Snapshot mergen statt ersetzen
  try {
    const prev = JSON.parse(readFileSync(OUT, 'utf8')).ships;
    for (const [k, v] of Object.entries(prev)) if (!out[k]) out[k] = v;
  } catch { /* erster Lauf */ }
}
await writeFile(OUT, JSON.stringify({
  fetchedAt: new Date().toISOString().slice(0, 10),
  source: 'ship-hardpoints.json (Data.p4k) auf FleetYards-Holo-Meshes kalibriert; granulare StarFab-Holos nativ',
  build: snap.build,
  count: Object.keys(out).length,
  ships: out,
}) + '\n', 'utf8');
console.log(`\nwrote src/data/holo-markers.json (${Object.keys(out).length} Schiffe)`);
