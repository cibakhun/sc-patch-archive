// Hangar-Crew mit Skelett und Spielanimationen (30.10.2026, Krisz: „die npcs
// sind super duper basic … animationstechnisch, aussehen technisch, und was
// die so machen können … bau npcs komplett aus“).
//
// Die Figur kommt aus scripts/build-hangar-crew.mjs (public/hangar/npc/crew.glb):
// Deckcrew-Montur des Spiels als EIN Netz mit Haut (90 Knochen), dazu im
// Kopf der Datei (asset.extras.crew) die Clips, die Farbtafel der 20
// Farbstellungen und die Knochennamen. Die Animationen stehen als Block im
// Accessor „crew-anim“ (Aufbau dort beschrieben), hier werden daraus
// three.js-Clips.
//
// Material: Schichtmischung des Spiels (LayerBlend_V2) im Shader. Die
// Mischkarte (RGB) wählt zwischen vier Schichten, jede mit eigener Farbe,
// Metall und Rauheit aus der Farbtafel (Zeile = Teilmaterial + Stellung × 31,
// Teilmaterial je Ecke in TEXCOORD_1); die Detailkarte trägt die Normale
// (RG), die Abnutzungsmaske (B) und die Verdeckung (A). Abnutzung mischt je
// Schicht zur Verschleißschicht des Spiels.
//
// Verhalten: Jede Figur hat einen Auftrag (Arbeitsplatz am Gerät, Fahrwerk
// prüfen, Rundgang mit Blick aufs Schiff, Gespräch zu zweit, Einweisen am
// Bug), geht auf einem Weg um Rumpf und Gerät dorthin (Raster, A*), dreht
// sich mit den Drehanimationen des Spiels ein und spielt dort die Clips des
// Spiels. Fährt der Aufzug, bleibt stehen, wer geht; wer arbeitet, arbeitet
// weiter (auf dem Feld fährt er mit, das macht der Viewer).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const NAV_CELL = 0.4;        // Raster der Wege, m
const NAV_MARGIN = 1.5;      // über den Feldrand hinaus begehbar, m
const STAND_OFF = 0.42;      // Abstand der Figur vor der Front eines Geräts, m
const WALK_ACC = 1.6;        // m/s² beim Anlaufen und Abbremsen
const TURN_RATE = 2.6;       // rad/s, Drehung beim Gehen
const FADE = 0.35;           // s, Überblendung zwischen Clips

const sanitize = THREE.PropertyBinding.sanitizeNodeName;
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ─── Clips aus dem Block ─────────────────────────────────────────────────
function readClips(meta, bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'CRW1') throw new Error('crew-anim: unbekannter Kopf');
  const n = dv.getUint16(4, true), names = Object.keys(meta.clips), out = new Map();
  let o = 8;
  for (let c = 0; c < n; c++) {
    const info = meta.clips[names[c]], nt = dv.getUint16(o, true), tracks = [];
    o += 2;
    for (let k = 0; k < nt; k++) {
      const bone = sanitize(meta.joints[bytes[o]]), kind = bytes[o + 1], m = dv.getUint16(o + 2, true);
      o += 4;
      const times = new Float32Array(m);
      for (let i = 0; i < m; i++) times[i] = dv.getUint16(o + i * 2, true) / info.fps;
      o += m * 2;
      if (kind === 0) {
        const v = new Float32Array(m * 4);
        for (let i = 0; i < m * 4; i++) v[i] = dv.getInt16(o + i * 2, true) / 32767;
        o += m * 8;
        tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, v));
      } else {
        const v = new Float32Array(m * 3);
        for (let i = 0; i < m * 3; i++) v[i] = dv.getFloat32(o + i * 4, true);
        o += m * 12;
        tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, v));
      }
    }
    out.set(names[c], new THREE.AnimationClip(names[c], info.dur, tracks));
  }
  return out;
}

// Bahn der Wurzel (x, z, Gierwinkel) zur Zeit t, im Raum der Figur bei Clipbeginn
function rootAt(root, t, out) {
  if (!root) return out.set(0, 0, 0);
  const dt = root[1][0] - root[0][0], f = Math.max(0, Math.min(root.length - 1, t / dt)), i = Math.min(root.length - 2, Math.floor(f)), k = f - i;
  const a = root[i], b = root[i + 1];
  return out.set(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
}

// ─── Material ────────────────────────────────────────────────────────────
const CREW_GLSL = /* glsl */ `
uniform highp sampler2D crewTab;
uniform float crewVar;
uniform float crewWear;
flat varying float vCrewSub;
vec3 crewLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
`;
function crewMaterial(src, tab, rows, variant, wear) {
  const m = new THREE.MeshStandardMaterial({ name: 'crew', map: src.map, normalMap: src.normalMap, roughness: 1, metalness: 1 });
  m.map.colorSpace = THREE.NoColorSpace;
  m.normalMap.colorSpace = THREE.NoColorSpace;
  // Grün zeigt im Spiel bildabwärts (geprüft an der Rotation der Normalenkarte:
  // so ist sie fast wirbelfrei), wie die Ableitungen von three.js die
  // Bitangente legen (+v)
  m.normalScale.set(1, 1);
  const u = { crewTab: { value: tab }, crewVar: { value: variant }, crewWear: { value: wear } };
  m.userData.crew = u;
  m.userData.hgTex = [tab];
  m.customProgramCacheKey = () => `hangar-crew-${rows}`;
  m.onBeforeCompile = (sh) => {
    const miss = [...CREW_ANCHORS.vertex.filter((a) => !sh.vertexShader.includes(a)), ...CREW_ANCHORS.fragment.filter((a) => !sh.fragmentShader.includes(a))];
    if (miss.length) console.warn(`[hangar] Crew-Material: Einhängepunkte fehlen (${miss.join(', ')})`);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 crewSub;\nflat varying float vCrewSub;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrewSub = crewSub.x;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${CREW_GLSL}`)
      .replace('#include <map_fragment>', /* glsl */ `
        int crewRow = int(crewVar + 0.5) * ${rows} + int(vCrewSub + 0.5);
        vec3 crewBl = texture2D(map, vMapUv).rgb;
        vec4 crewDet = texture2D(normalMap, vNormalMapUv);
        // Abnutzung: wo die Maske über der Schwelle liegt, die Verschleißschicht
        float crewW = smoothstep(1.0 - crewWear - 0.08, 1.0 - crewWear + 0.08, crewDet.b);
        vec4 crewL[4]; float crewR[4];
        for (int i = 0; i < 4; i++) {
          vec4 b0 = texelFetch(crewTab, ivec2(i * 2, crewRow), 0), b1 = texelFetch(crewTab, ivec2(i * 2 + 1, crewRow), 0);
          vec4 w0 = texelFetch(crewTab, ivec2(8 + i * 2, crewRow), 0), w1 = texelFetch(crewTab, ivec2(9 + i * 2, crewRow), 0);
          crewL[i] = vec4(mix(crewLin(b0.rgb), crewLin(w0.rgb), crewW), mix(b0.a, w0.a, crewW));
          crewR[i] = mix(b1.r, w1.r, crewW);
        }
        vec4 crewC = mix(mix(mix(crewL[3], crewL[2], crewBl.b), crewL[1], crewBl.g), crewL[0], crewBl.r);
        float crewRough = mix(mix(mix(crewR[3], crewR[2], crewBl.b), crewR[1], crewBl.g), crewR[0], crewBl.r);
        vec4 crewK = texelFetch(crewTab, ivec2(16, crewRow), 0);
        int crewKind = int(crewK.a * 255.0 + 0.5);
        vec3 crewGlow = crewKind == 1 ? crewLin(crewK.rgb) * texelFetch(crewTab, ivec2(17, crewRow), 0).r * 25.5 : vec3(0.0);
        diffuseColor.rgb *= crewC.rgb;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * crewRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * crewC.a;')
      .replace('#include <normal_fragment_maps>', /* glsl */ `
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec3 mapN = vec3((crewDet.rg * 2.0 - 1.0) * normalScale, 0.0);
          mapN.z = sqrt(saturate(1.0 - dot(mapN.xy, mapN.xy)));
          normal = normalize(tbn * mapN);
        #endif`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += crewGlow;')
      .replace('#include <aomap_fragment>', /* glsl */ `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= crewDet.a;
        reflectedLight.indirectSpecular *= mix(1.0, crewDet.a, 0.7);`);
  };
  return m;
}

// ─── Wegeraster ──────────────────────────────────────────────────────────
// Belegt: Gerät (Rechtecke, Abstand schon drin) und wo der Rumpf tiefer als
// Kopfhöhe hängt (hull), eine Zelle breiter. clear: Abstand zur nächsten
// belegten Zelle (Zellen), toHull: zum Rumpf und welche Rumpfzelle.
function buildNav(area, blocks, hull) {
  const C = NAV_CELL, x0 = area.x0, z0 = area.z0, nx = Math.max(2, Math.ceil((area.x1 - x0) / C)), nz = Math.max(2, Math.ceil((area.z1 - z0) / C));
  const N = nx * nz, cells = new Uint8Array(N), hullC = new Uint8Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * C, z = z0 + (j + 0.5) * C;
    if (hull?.(x, z)) hullC[j * nx + i] = 1;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let h = 0;
    for (let dj = -1; dj <= 1 && !h; dj++) for (let di = -1; di <= 1 && !h; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < nx && b < nz && hullC[b * nx + a]) h = 1;
    }
    cells[j * nx + i] = h;
  }
  for (const r of blocks) {
    const i0 = Math.max(0, Math.floor((r.x - r.ex - x0) / C)), i1 = Math.min(nx - 1, Math.floor((r.x + r.ex - x0) / C));
    const j0 = Math.max(0, Math.floor((r.z - r.ez - z0) / C)), j1 = Math.min(nz - 1, Math.floor((r.z + r.ez - z0) / C));
    // jede Zelle, die das Rechteck berührt
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * nx + i] = 1;
  }
  // Abstände (Breitensuche, 4er-Nachbarschaft)
  const bfs = (seed) => {
    const d = new Uint16Array(N).fill(65535), src = new Int32Array(N).fill(-1), q = new Int32Array(N);
    let h = 0, t = 0;
    for (let k = 0; k < N; k++) if (seed[k]) { d[k] = 0; src[k] = k; q[t++] = k; }
    while (h < t) {
      const k = q[h++], i = k % nx, j = (k - i) / nx;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const m = b * nx + a;
        if (d[m] !== 65535) continue;
        d[m] = d[k] + 1; src[m] = src[k]; q[t++] = m;
      }
    }
    return { d, src };
  };
  const clear = bfs(cells).d, toHull = bfs(hullC);
  const cell = (x, z) => {
    const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C);
    return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i;
  };
  const free = (x, z) => { const k = cell(x, z); return k >= 0 && !cells[k]; };
  const centre = (k, out = new THREE.Vector3()) => out.set(x0 + ((k % nx) + 0.5) * C, 0, z0 + (Math.floor(k / nx) + 0.5) * C);
  // frei zwischen a und b: jede Zelle, durch die die Strecke geht
  // (Rasterlauf nach Amanatides und Woo)
  const sight = (a, b) => {
    let i = Math.floor((a.x - x0) / C), j = Math.floor((a.z - z0) / C);
    const i1 = Math.floor((b.x - x0) / C), j1 = Math.floor((b.z - z0) / C);
    const dx = b.x - a.x, dz = b.z - a.z, si = Math.sign(dx), sj = Math.sign(dz);
    const tdx = si ? C / Math.abs(dx) : Infinity, tdz = sj ? C / Math.abs(dz) : Infinity;
    let tx = si ? ((si > 0 ? x0 + (i + 1) * C : x0 + i * C) - a.x) / dx : Infinity;
    let tz = sj ? ((sj > 0 ? z0 + (j + 1) * C : z0 + j * C) - a.z) / dz : Infinity;
    for (let n = 0; n < nx + nz + 4; n++) {
      if (i < 0 || j < 0 || i >= nx || j >= nz || cells[j * nx + i]) return false;
      if (i === i1 && j === j1) return true;
      if (tx < tz) { tx += tdx; i += si; } else { tz += tdz; j += sj; }
    }
    return true;
  };
  // nächste freie Zelle (bis 4 Zellen weit)
  const near = (p) => {
    const k = cell(p.x, p.z);
    if (k >= 0 && !cells[k]) return k;
    let best = -1, bd = Infinity;
    const i0 = Math.floor((p.x - x0) / C), j0 = Math.floor((p.z - z0) / C);
    for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
      const a = i0 + di, b = j0 + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || cells[b * nx + a]) continue;
      const d = di * di + dj * dj;
      if (d < bd) { bd = d; best = b * nx + a; }
    }
    return best;
  };
  // Weg a -> b: A* über die Zellen (8er-Nachbarschaft, keine Ecken schneiden),
  // dann gestrafft (Sichtlinien). null, wenn keiner da ist.
  const gScore = new Float32Array(N), came = new Int32Array(N), stamp = new Uint32Array(N);
  let run = 0;
  const route = (a, b) => {
    const s = near(a), g = near(b);
    if (s < 0 || g < 0) return null;
    run++;
    const open = [s], gi = g % nx, gj = (g - gi) / nx;
    const hcost = (k) => { const i = k % nx, j = (k - i) / nx, dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
    const f = new Map([[s, hcost(s)]]);
    stamp[s] = run; gScore[s] = 0; came[s] = -1;
    let found = false, steps = 0;
    while (open.length && steps++ < 60000) {
      let bi = 0;
      for (let q = 1; q < open.length; q++) if (f.get(open[q]) < f.get(open[bi])) bi = q;
      const k = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (k === g) { found = true; break; }
      const i = k % nx, j = (k - i) / nx;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a2 = i + di, b2 = j + dj;
        if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue;
        const m = b2 * nx + a2;
        if (cells[m] || (di && dj && (cells[j * nx + a2] || cells[b2 * nx + i]))) continue;
        const ng = gScore[k] + (di && dj ? 1.4142 : 1);
        if (stamp[m] === run && ng >= gScore[m]) continue;
        const fresh = stamp[m] !== run || !f.has(m);
        stamp[m] = run; gScore[m] = ng; came[m] = k;
        f.set(m, ng + hcost(m));
        if (fresh) open.push(m);
      }
    }
    if (!found) return null;
    const ks = [];
    for (let k = g; k >= 0; k = came[k]) ks.push(k);
    ks.reverse();
    const raw = [a.clone().setY(0), ...ks.slice(1, -1).map((k) => centre(k)), b.clone().setY(0)];
    const out = [raw[0]];
    for (let i = 0; i < raw.length - 1;) {
      let j = raw.length - 1;
      while (j > i + 1 && !sight(raw[i], raw[j])) j--;
      out.push(raw[j]); i = j;
    }
    return out;
  };
  return { nx, nz, x0, z0, cells, clear, toHull, cell, free, centre, sight, route };
}

// Polylinie, nach Weglänge abgelaufen
function pathOf(points) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-4) continue;
    segs.push({ a, b, len, at: total });
    total += len;
  }
  return {
    total, points,
    at(d, out) {
      d = Math.max(0, Math.min(total, d));
      const s = segs.find((x) => d <= x.at + x.len) ?? segs[segs.length - 1];
      if (!s) { out.x = points[0].x; out.z = points[0].z; return out; }
      const k = (d - s.at) / s.len;
      out.x = s.a.x + (s.b.x - s.a.x) * k; out.z = s.a.z + (s.b.z - s.a.z) * k;
      return out;
    },
  };
}

// ─── Arbeit je Platz ─────────────────────────────────────────────────────
// Welche Clips an welchem Gerät (Name des Platzes aus WORK_DIENST, Vorsilbe)
const STATION_WORK = [
  [/^diagnose/, 'konsole'], [/^werkzeug/, 'schrank'], [/^werkbank/, 'werkbank'], [/^strom/, 'schalttafel'],
  [/^(treibstoff|tankstelle)/, 'unten'], [/^schweiss/, 'schalttafel'],
  [/^(lager|fracht|transport|vorfeld)/, 'bestand'],
];
// Abläufe: [Clip, Dauer in s (Schleifen) oder null (einmal)], r: zufällige Wahl
const WORK = {
  konsole: (r) => [['pressC'], ['panel', 6 + r() * 5], [r() < 0.5 ? 'pressL' : 'pressR'], ['panelLook'], ['panel', 4 + r() * 4], ['pressC']],
  schrank: (r) => [['panel', 4 + r() * 3], ['panelFeel'], ['panel', 3 + r() * 3], ['panelLook'], ['panel', 3 + r() * 4]],
  schalttafel: (r) => [['panel', 5 + r() * 4], ['panelLook'], ['panel', 3 + r() * 3], ['pressC'], ['panel', 3 + r() * 3]],
  unten: (r) => [['panelDown'], ['panelLow', 5 + r() * 4], ['panelLowLook'], ['panelLow', 4 + r() * 4]],
  werkbank: (r) => [['benchIn'], ['bench', 10 + r() * 10], ['benchOut']],
  bestand: (r) => [['mobiIn'], ['mobi', 8 + r() * 8], ['mobiOut'], [r() < 0.5 ? 'crossarms' : 'hipslook']],
  fahrwerk: (r) => [['gearLook'], ['gear', 6 + r() * 6], ['area'], ['gearLook']],
  schauen: (r) => [[['crossarms', 'hipslook', 'idleA', 'fidget1'][Math.floor(r() * 4)]], ['idle', 4 + r() * 6], ['mobiIn'], ['mobi', 5 + r() * 6], ['mobiOut']],
  reden: (r) => [['idleA', 3 + r() * 3], [r() < 0.5 ? 'crossarms' : 'fidget2'], ['idleB', 3 + r() * 4], ['hipslook'], ['idleA', 2 + r() * 3]],
  einweisen: () => [['marshalIn'], ['marshal', 4.8], ['marshalHold'], ['idle', 2.5], ['marshalOut']],
};
// mit Ein- und Ausgang am Gerät (Wurzelbewegung der Spielclips)
const PANEL = new Set(['schrank', 'schalttafel', 'unten', 'konsole']);
// außerhalb der Abläufe gespielt (Gehen, Drehen, Verweilen, Ein- und Ausgang)
const MOVE_CLIPS = ['idle', 'idleA', 'idleB', 'walk', 'turnL', 'turnR', 'turn180', 'panelIn', 'panelOut', 'panel'];

// Für die Prüfung (verify:hangar-crew): jeder Clip, den die Crew spielen
// kann, und ob er mit Dauer läuft (dann muss er im Spiel eine Schleife sein)
export function crewClips() {
  const out = new Map(MOVE_CLIPS.map((n) => [n, { timed: false }]));
  for (const f of Object.values(WORK)) for (const r of [() => 0, () => 0.99]) {
    for (const [clip, dur] of f(r)) out.set(clip, { timed: (out.get(clip)?.timed ?? false) || dur != null });
  }
  return out;
}
// Stellen in den Shadern von three.js, an denen das Material einhängt:
// fehlt eine (three.js geändert), fehlen Farben, Rauheit oder Normale
export const CREW_ANCHORS = {
  vertex: ['#include <common>', '#include <begin_vertex>'],
  fragment: ['#include <common>', '#include <map_fragment>', '#include <roughnessmap_fragment>', '#include <metalnessmap_fragment>', '#include <normal_fragment_maps>', '#include <emissivemap_fragment>', '#include <aomap_fragment>'],
};
export { buildNav, pathOf };

export async function crewRig(gltf, { reduceMotion = false, seed = 7 } = {}) {
  const meta = gltf.parser.json.asset?.extras?.crew;
  if (!meta) throw new Error('crew.glb ohne asset.extras.crew');
  const ai = gltf.parser.json.accessors.findIndex((a) => a.name === 'crew-anim');
  if (ai < 0) throw new Error('crew.glb ohne Animationsblock');
  const blob = (await gltf.parser.getDependency('accessor', ai)).array;
  const clips = readClips(meta, new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength));
  const info = meta.clips;
  // Farbtafel als Bild: Spalten COLS, Zeilen Stellungen × Teilmaterialien
  const raw = Uint8Array.from(atob(meta.table.data), (c) => c.charCodeAt(0));
  const rows = meta.table.rows, nVar = meta.variants.length;
  const tab = new THREE.DataTexture(raw, meta.table.cols, rows * nVar, THREE.RGBAFormat, THREE.UnsignedByteType);
  tab.magFilter = tab.minFilter = THREE.NearestFilter;
  tab.generateMipmaps = false; tab.colorSpace = THREE.NoColorSpace; tab.needsUpdate = true;
  let src = null;
  gltf.scene.traverse((n) => { if (n.isSkinnedMesh) src = n; });
  if (!src) throw new Error('crew.glb ohne Haut');
  const geo = src.geometry;
  if (geo.getAttribute('uv1')) { geo.setAttribute('crewSub', geo.getAttribute('uv1')); geo.deleteAttribute('uv1'); }

  const R = rng(seed);
  // Farbstellungen gemischt, keine doppelt, solange es reicht
  const order = [...Array(nVar).keys()].sort(() => R() - 0.5);
  const MAX = 8;
  const npcs = [];
  for (let i = 0; i < MAX; i++) {
    const model = cloneSkinned(gltf.scene);
    let mesh = null;
    model.traverse((n) => { if (n.isSkinnedMesh) mesh = n; });
    const mat = crewMaterial(src.material, tab, rows, order[i % nVar], 0.15 + R() * 0.35);
    mesh.material = mat;
    mesh.frustumCulled = true;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.6);
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.crewPart = true;
    const root = new THREE.Group();
    root.name = `crew-${i}`;
    root.add(model);
    root.userData.mats = [mat];
    // Statur: das Spiel streut die Größe kaum; leicht, damit es keine Klonarmee wird
    model.scale.setScalar(0.96 + R() * 0.07);
    const mixer = new THREE.AnimationMixer(model);
    npcs.push({
      i, root, model, mesh, mat, mixer, acts: new Map(), cur: null, rnd: rng(seed * 31 + i * 977),
      yaw: 0, speed: 0, vmax: 0, path: null, s: 0, steps: [], step: null, job: null, rootActs: [], wait: 0, busy: 0,
    });
  }
  let count = MAX, castOn = false, built = null, world = null, lastHold = false;
  const v = new THREE.Vector3(), w3 = new THREE.Vector3();

  const action = (n, name) => {
    let a = n.acts.get(name);
    if (!a) {
      a = n.mixer.clipAction(clips.get(name));
      a.setLoop(info[name].loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      n.acts.set(name, a);
    }
    return a;
  };
  // Clip spielen (Überblendung vom laufenden). root: Wurzelbewegung des
  // Spiels anwenden ('voll': Lage und Drehung, 'dreh': nur Drehung, k skaliert)
  function play(n, name, fade = FADE, root = null, k = 1) {
    const a = action(n, name);
    if (n.cur === a && info[name].loop) return a;
    a.reset();
    a.setEffectiveTimeScale(1).setEffectiveWeight(1);
    a.play();
    if (n.cur && n.cur !== a) a.crossFadeFrom(n.cur, fade, false);
    else a.fadeIn(fade);
    n.cur = a; n.curName = name;
    if (root && info[name].root) n.rootActs.push({ a, name, mode: root, k, last: 0 });
    return a;
  }
  function applyRoot(n) {
    for (let q = n.rootActs.length - 1; q >= 0; q--) {
      const r = n.rootActs[q], dur = info[r.name].dur, t = Math.min(r.a.time, dur);
      const p0 = rootAt(info[r.name].root, r.last, v), x0 = p0.x, z0 = p0.y, y0 = p0.z;
      const p1 = rootAt(info[r.name].root, t, w3);
      const dyaw = (p1.z - y0) * r.k;
      if (r.mode === 'voll') {
        // Schritt im Raum der Figur bei Clipbeginn; dessen Gier in der Welt
        // ist die jetzige ohne die seither gedrehte
        const lx = p1.x - x0, lz = p1.y - z0, c0 = Math.cos(n.yaw - y0 * r.k), s0 = Math.sin(n.yaw - y0 * r.k);
        n.root.position.x += (lx * c0 + lz * s0) * r.k;
        n.root.position.z += (-lx * s0 + lz * c0) * r.k;
      }
      n.yaw += dyaw;
      r.last = t;
      if (t >= dur - 1e-4 || !r.a.isRunning()) n.rootActs.splice(q, 1);
    }
  }

  // ─── Aufträge ──────────────────────────────────────────────────────────
  // Plätze je Anordnung: Gerät (je Platz eine Stelle vor der Front, sonst an
  // einer Seite), Fahrwerk (je Aufstandspunkt eine Stelle außen daneben),
  // Blick aufs Schiff und Treffpunkte (frei, 2 bis 7 m vom Rumpf), Bug.
  function plan(w) {
    const C = NAV_CELL, f = w.field ?? { x: 0, z: 0, ex: w.ship.halfW + 8, ez: w.ship.len / 2 + 8 };
    const area = { x0: f.x - f.ex - NAV_MARGIN, x1: f.x + f.ex + NAV_MARGIN, z0: f.z - f.ez - NAV_MARGIN, z1: f.z + f.ez + NAV_MARGIN };
    // ohne Rumpfgrundriss (noch nicht da): das Schiff als Rechteck, damit
    // niemand in der Feldmitte unter ihm steht
    const hull = w.hull ?? ((x, z) => Math.abs(x) < w.ship.halfW && Math.abs(z) < w.ship.len / 2);
    const nav = buildNav(area, w.blocks ?? [], hull);
    const ok = (p, need = 1) => { const k = nav.cell(p.x, p.z); return k >= 0 && !nav.cells[k] && nav.clear[k] >= need; };
    // genau: Stelle vor einem Gerät (liegt dichter am Gerät als das Raster
    // auflöst): in keinem Rechteck, und 0,2 m um sie kein tiefer Rumpf
    const inBlock = (p) => (w.blocks ?? []).some((r) => Math.abs(p.x - r.x) < r.ex - 0.05 && Math.abs(p.z - r.z) < r.ez - 0.05);
    const standAt = (p) => nav.cell(p.x, p.z) >= 0 && !inBlock(p) && ![[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]].some(([dx, dz]) => hull(p.x + dx, p.z + dz));
    const work = [];
    for (const st of w.stations ?? []) {
      const kind = STATION_WORK.find(([re]) => re.test(st.name))?.[1];
      if (!kind) continue;
      const fx = Math.sin(st.r), fz = Math.cos(st.r), sx = Math.cos(st.r), sz = -Math.sin(st.r);
      const cands = [
        { x: st.x - fx * (st.sz / 2 + STAND_OFF), z: st.z - fz * (st.sz / 2 + STAND_OFF), yaw: st.r },
        { x: st.x + sx * (st.sx / 2 + STAND_OFF), z: st.z + sz * (st.sx / 2 + STAND_OFF), yaw: st.r - Math.PI / 2 },
        { x: st.x - sx * (st.sx / 2 + STAND_OFF), z: st.z - sz * (st.sx / 2 + STAND_OFF), yaw: st.r + Math.PI / 2 },
      ];
      const c = cands.find((p) => standAt(p));
      if (!c) continue;
      const spot = { kind, name: st.name, x: c.x, z: c.z, yaw: wrapPi(c.yaw), low: st.h < 0.95 };
      // Eingang ans Gerät mit der Spielbewegung (panelIn: gut 1 m, 45° Drehung)
      if (PANEL.has(kind)) {
        const m = info.panelIn.move, ys = spot.yaw - info.panelIn.yaw, c0 = Math.cos(ys), s0 = Math.sin(ys);
        const s = { x: spot.x - (m[0] * c0 + m[1] * s0), z: spot.z - (-m[0] * s0 + m[1] * c0) };
        const mo = info.panelOut.move, c1 = Math.cos(spot.yaw), s1 = Math.sin(spot.yaw);
        const e = { x: spot.x + mo[0] * c1 + mo[1] * s1, z: spot.z - mo[0] * s1 + mo[1] * c1 };
        const P = (q) => new THREE.Vector3(q.x, 0, q.z);
        if (ok(s, 2) && nav.sight(P(s), P(spot))) spot.enter = { x: s.x, z: s.z, yaw: wrapPi(ys) };
        if (ok(e, 2) && nav.sight(P(spot), P(e))) spot.exit = true;
      }
      work.push(spot);
    }
    // Fahrwerk: außen neben jedem Aufstandspunkt, Blick auf ihn
    const gear = [];
    const fy = w.shipYaw ?? Math.PI, fc = Math.cos(fy), fs = Math.sin(fy);
    for (const q0 of w.feet ?? []) {
      // Aufstandspunkt im Schiffsraum -> Welt (Schiff um seine Mitte gedreht)
      const p = { x: q0.x * fc + q0.z * fs, z: -q0.x * fs + q0.z * fc }, out = Math.atan2(p.x, p.z);
      let best = null;
      for (const r of [1.0, 1.4, 1.9, 2.5]) for (let k = 0; k < 16; k++) {
        const a = out + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8), q = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
        if (!ok(q, 1)) continue;
        const score = -Math.abs(wrapPi(a - out)) - r * 0.5;
        if (!best || score > best.score) best = { ...q, score };
      }
      if (best) gear.push({ kind: 'fahrwerk', name: 'fahrwerk', x: best.x, z: best.z, yaw: Math.atan2(p.x - best.x, p.z - best.z) });
    }
    // freie Stellen mit Blick aufs Schiff (2 bis 7 m vom Rumpf, 1,2 m Luft)
    const open = [];
    const step = Math.max(1, Math.round(1.2 / C));
    for (let j = 0; j < nav.nz; j += step) for (let i = 0; i < nav.nx; i += step) {
      const k = j * nav.nx + i, dh = nav.toHull.d[k] * C;
      if (nav.cells[k] || nav.clear[k] < 3 || dh < 2 || dh > 7) continue;
      const p = nav.centre(k), h = nav.centre(nav.toHull.src[k] >= 0 ? nav.toHull.src[k] : k, new THREE.Vector3());
      open.push({ name: 'blick', x: p.x, z: p.z, yaw: Math.atan2(h.x - p.x, h.z - p.z), dh });
    }
    // Bug: auf der Schiffsachse vor dem Bug, 3 bis 7 m, Blick zum Schiff
    const by = w.shipYaw ?? Math.PI, bx = Math.sin(by), bz = Math.cos(by);
    let bow = null;
    for (let d = w.ship.len / 2 + 3; d < w.ship.len / 2 + 9 && !bow; d += 0.5) {
      for (const lat of [0, 0.8, -0.8, 1.6, -1.6]) {
        const q = { x: bx * d + bz * lat, z: bz * d - bx * lat };
        if (ok(q, 2)) { bow = { kind: 'einweisen', name: 'bug', x: q.x, z: q.z, yaw: Math.atan2(-bx, -bz) }; break; }
      }
    }
    return { nav, work, gear, open, bow, field: f };
  }

  const taken = new Map();   // Platzschlüssel -> Figur
  const keyOf = (s) => `${s.name}|${s.x.toFixed(1)}|${s.z.toFixed(1)}`;
  function release(n) { for (const [k, o] of taken) if (o === n) taken.delete(k); }
  const active = (n) => n.i < count;
  // Nächsten Auftrag wählen: meist Gerät, sonst Fahrwerk, Reden, Schauen.
  // snap: sofort dort, mitten im Ablauf (vor dem ersten Bild, beim Tausch)
  function pick(n, snap = false) {
    release(n);
    const P = built, r = n.rnd(), p = n.root.position;
    const freeOf = (list) => list.filter((s) => !taken.has(keyOf(s)) && s.name !== n.job?.name);
    // eher in der Nähe, aber nicht immer dasselbe
    const near = (list) => {
      if (!list.length) return null;
      if (snap) return list[Math.floor(n.rnd() * list.length)];
      const sc = list.map((s) => Math.hypot(s.x - p.x, s.z - p.z) * (0.5 + n.rnd()));
      return list[sc.indexOf(Math.min(...sc))];
    };
    let job = null;
    if (r < 0.6) job = near(freeOf(P.work));
    if (!job && r < 0.78) job = near(freeOf(P.gear));
    if (!job && r < 0.9 && !snap) {
      // zu zweit reden: mit einer Figur, die gerade frei wird
      const mate = npcs.find((o) => o !== n && active(o) && o.lingering && Math.hypot(o.root.position.x - p.x, o.root.position.z - p.z) < 25);
      const spot = mate && near(P.open.filter((s) => !taken.has(keyOf(s))));
      if (spot) { talk(n, mate, spot); return; }
    }
    if (!job) job = near(freeOf(P.open));
    // nichts frei: stehen bleiben, wo man ist (sofern dort frei)
    if (!job) job = P.nav.free(p.x, p.z) || !P.open.length ? { name: 'frei', x: p.x, z: p.z, yaw: n.yaw } : P.open[Math.floor(n.rnd() * P.open.length)];
    assign(n, job.kind ? job : { ...job, kind: 'schauen' }, snap);
  }
  function talk(a, b, spot) {
    const ang = a.rnd() * Math.PI * 2, dx = Math.sin(ang) * 0.62, dz = Math.cos(ang) * 0.62;
    taken.set(keyOf(spot), a);
    assign(a, { kind: 'reden', name: 'reden', x: spot.x + dx, z: spot.z + dz, yaw: Math.atan2(-dx, -dz) });
    release(b);
    taken.set(keyOf(spot), a);
    assign(b, { kind: 'reden', name: 'reden', x: spot.x - dx, z: spot.z - dz, yaw: Math.atan2(dx, dz) });
  }
  // Ablauf: hingehen, eindrehen, (Eingang), Arbeit, (Ausgang), kurz verweilen
  function assign(n, job, snap = false) {
    n.job = job; n.lingering = false;
    if (job.name !== 'frei' && job.name !== 'reden') taken.set(keyOf(job), n);
    const at = job.enter ?? job;
    const work = (job.steps ?? WORK[job.kind](n.rnd).map(([clip, dur]) => ({ clip, dur })));
    const lead = [];
    if (job.enter) lead.push({ clip: 'panelIn', root: 'voll' });
    // ohne Eingang steht man gleich an der Tafel
    else if (PANEL.has(job.kind) && job.kind !== 'unten') lead.push({ clip: 'panel', dur: 1.2 });
    const tail = job.enter && job.exit ? [{ clip: 'panelOut', root: 'voll' }] : [];
    n.steps = snap ? [...work, ...tail] : [{ go: at }, { face: at.yaw }, ...lead, ...work, ...tail];
    n.steps.push({ linger: 1.5 + n.rnd() * 3 });
    n.step = null;
    n.rootActs.length = 0;
    if (snap) {
      // gleich an der Arbeitsstelle (nach dem Eingang), Phase gestreut
      n.root.position.x = job.x; n.root.position.z = job.z; n.yaw = job.yaw;
      n.path = null; n.speed = 0;
      const loopAt = n.steps.findIndex((s) => s.dur);
      if (loopAt > 0 && !job.steps) n.steps.splice(0, loopAt);
      n.mixer.stopAllAction(); n.cur = null;
      const s0 = n.steps[0];
      if (s0?.clip) {
        const a = play(n, s0.clip, 0);
        if (info[s0.clip].loop) a.time = n.rnd() * info[s0.clip].dur;
      } else play(n, 'idle', 0).time = n.rnd() * info.idle.dur;
    }
  }

  // ─── Ablauf je Bild ───────────────────────────────────────────────────
  function next(n, hold) {
    const s = n.steps[0];
    if (!s) { pick(n); return; }
    if (s.go) {
      if (hold) return;   // fährt der Aufzug, geht niemand los
      n.steps.shift();
      const pts = built.nav.route(n.root.position, new THREE.Vector3(s.go.x, 0, s.go.z));
      if (!pts) { n.steps = [{ linger: 2 }]; return; }
      const path = pathOf(pts);
      if (path.total < 0.15) { n.root.position.x = s.go.x; n.root.position.z = s.go.z; return; }
      n.path = path; n.s = 0;
      // erst in die Richtung des Wegs drehen, dann gehen
      const p1 = path.at(Math.min(path.total, 0.6), v.set(0, 0, 0));
      n.steps.unshift({ face: Math.atan2(p1.x - n.root.position.x, p1.z - n.root.position.z) }, { walk: true });
      return;
    }
    n.steps.shift();
    if (s.walk) {
      n.step = { walk: true };
      n.vmax = info.walk.speed * (0.95 + n.rnd() * 0.12);
      play(n, 'walk', 0.45).setEffectiveTimeScale(0.05);
      return;
    }
    if (s.wait !== undefined) { n.step = { clip: n.curName, dur: s.wait, t: 0 }; return; }
    if (s.await) {
      // wartet, bis der Aufzug steht
      if (hold) { n.steps.unshift(s); n.step = { clip: n.curName, dur: 0.25, t: 0 }; }
      return;
    }
    if (s.face !== undefined) {
      const d = wrapPi(s.face - n.yaw);
      if (Math.abs(d) < 0.75) {
        n.step = { spin: s.face, t: 0 };
        if (!n.cur || n.curName === 'walk' || !info[n.curName].loop) play(n, 'idle', 0.4);
        return;
      }
      // Drehung des Spiels, auf den Winkel skaliert (links +, rechts −); Rest danach
      const name = d > 2.4 ? 'turn180' : d > 0 ? 'turnL' : 'turnR', full = info[name].yaw;
      play(n, name, 0.3, 'dreh', Math.min(1.3, d / full));
      n.steps.unshift({ face: s.face });
      n.step = { clip: name, t: 0 };
      return;
    }
    if (s.clip) {
      play(n, s.clip, s.fade ?? FADE, s.root ?? null);
      n.step = { clip: s.clip, dur: s.dur ?? null, t: 0 };
      return;
    }
    if (s.linger !== undefined) {
      n.step = { linger: s.linger, t: 0 };
      n.lingering = true;
      if (!n.cur || n.curName === 'walk' || !info[n.curName].loop) play(n, n.rnd() < 0.5 ? 'idleA' : 'idleB', 0.5);
    }
  }
  function tick(n, dt, hold) {
    const st = n.step;
    if (st.walk) {
      const p = n.path, left = p.total - n.s;
      // anlaufen, vor dem Ziel abbremsen; fährt der Aufzug: stehen bleiben
      const stopD = (n.vmax * n.vmax) / (2 * WALK_ACC);
      const want = hold ? 0 : left < stopD ? Math.max(0.25, n.vmax * Math.sqrt(left / stopD)) : n.vmax;
      n.speed = want > n.speed ? Math.min(want, n.speed + WALK_ACC * dt) : Math.max(want, n.speed - WALK_ACC * 1.5 * dt);
      n.s = Math.min(p.total, n.s + n.speed * dt);
      p.at(n.s, n.root.position);
      // Blick voraus, sanft nachgedreht
      if (left > 0.1) {
        const a = p.at(Math.min(p.total, n.s + 0.7), v.set(0, 0, 0)), d = wrapPi(Math.atan2(a.x - n.root.position.x, a.z - n.root.position.z) - n.yaw);
        n.yaw += Math.sign(d) * Math.min(Math.abs(d), TURN_RATE * dt * (0.4 + n.speed));
      }
      if (n.curName === 'walk') n.cur.setEffectiveTimeScale(Math.max(0.05, n.speed / info.walk.speed));
      if (hold && n.speed < 0.05 && n.curName === 'walk') play(n, 'idle', 0.5);
      else if (!hold && n.curName !== 'walk' && n.speed > 0.05) play(n, 'walk', 0.4);
      if (left < 0.02) { n.path = null; n.step = null; n.speed = 0; play(n, 'idle', 0.35); }
      return;
    }
    if (st.spin !== undefined) {
      st.t += dt;
      const d = wrapPi(st.spin - n.yaw);
      n.yaw += Math.sign(d) * Math.min(Math.abs(d), 1.8 * dt);
      if (Math.abs(d) < 0.01 || st.t > 1.5) n.step = null;
      return;
    }
    if (st.clip !== undefined) {
      st.t += dt;
      const end = st.dur ?? Math.max(0.2, info[st.clip].dur - FADE);
      // vor dem Losgehen auf den stehenden Aufzug warten (die Arbeit läuft weiter)
      if (st.t >= end && !(hold && n.steps[0]?.go)) n.step = null;
      return;
    }
    if (st.linger !== undefined) {
      st.t += dt;
      if (st.t >= st.linger && !hold) { n.lingering = false; n.step = null; pick(n); }
    }
  }

  // ─── Schnittstelle für buildLife ───────────────────────────────────────
  function layout(w) {
    const fresh = !built;
    world = w;
    built = plan(w);
    taken.clear();
    // vor dem ersten Bild oder unten im Schacht beim Tausch: gleich an den
    // neuen Platz, mitten in der Arbeit. Sonst geht jeder zum neuen Auftrag.
    const snap = fresh || w.snap || !w.visible || lastHold;
    for (const n of npcs) {
      if (!active(n)) { n.job = null; n.steps = []; continue; }
      if (snap || n.root.userData.ride || !built.nav.free(n.root.position.x, n.root.position.z)) {
        // der Erste weist am Bug ein, wenn das Schiff heraufkommt
        if (n.i === 0 && built.bow && !fresh && lastHold) {
          assign(n, { ...built.bow, steps: [{ clip: 'idle', dur: 0.3 }, { await: true }, ...WORK.einweisen(n.rnd).map(([clip, dur]) => ({ clip, dur }))] }, true);
        } else pick(n, true);
        n.root.rotation.y = n.yaw;
      } else {
        n.steps = []; n.step = null; n.path = null;
        if (n.curName === 'walk') play(n, 'idle', 0.4);
      }
    }
  }
  function update(dt, t, hold = false) {
    if (!built) return;
    lastHold = hold;
    for (const n of npcs) {
      if (!active(n)) continue;
      if (reduceMotion) {
        // ohne Bewegung: ein Bild aus der Arbeit, dann still
        if (!n.posed) { n.mixer.update(0.6); n.posed = true; n.root.rotation.y = n.yaw; }
        continue;
      }
      if (!n.step) next(n, hold);
      if (n.step) tick(n, dt, hold);
      n.mixer.update(dt);
      applyRoot(n);
      n.root.rotation.y = n.yaw;
    }
  }
  function setCount(k) {
    count = Math.min(k, MAX);
    for (const n of npcs) {
      n.root.visible = active(n);
      if (!active(n)) { release(n); n.job = null; n.steps = []; n.step = null; }
    }
  }
  function setShadows(on) {
    castOn = on;
    for (const n of npcs) n.mesh.castShadow = on;
  }
  return {
    roots: npcs.map((n) => n.root),
    meshes: npcs.map((n) => n.mesh),
    layout, update, setCount, setShadows,
    info: () => ({ count, shadows: castOn, clips: clips.size, variants: nVar, plan: built ? { work: built.work.length, gear: built.gear.length, open: built.open.length, bow: !!built.bow } : null }),
    // für Prüfungen: was jede Figur gerade tut
    debug: (i) => { const n = npcs[i]; return { job: n.job, step: n.step, steps: n.steps, cur: n.curName, roots: n.rootActs.map((r) => [r.name, r.mode, r.k, r.last]), yaw: n.yaw, p: n.root.position.toArray() }; },
    state: () => npcs.filter((n) => n.i < count).map((n) => ({ job: n.job?.kind ?? null, at: n.job?.name ?? null, clip: n.curName ?? null, x: +n.root.position.x.toFixed(2), z: +n.root.position.z.toFixed(2), yaw: +n.yaw.toFixed(2), walking: !!n.path })),
    world: () => world,
    // für Prüfbilder: Figur i in Clip name zur Zeit t
    pose(i, name, t = 0) {
      const n = npcs[i];
      n.mixer.stopAllAction(); n.cur = null; n.rootActs.length = 0;
      const a = action(n, name).reset().play();
      a.time = t; n.mixer.update(0);
    },
  };
}
