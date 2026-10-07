// Hangar-Bühne: EIN Schiff steht auf einer Landeplattform in einer belebten
// Halle, der Besucher dreht es frei und wechselt über das Karussell der
// Seite (components/hangar/HangarApp.astro). Gegenstück zu holo-viewer.js:
// dieselben Modelle (/holo/*.glb, Draco), hier aber lackiert, unter
// Hallenlicht, umgeben von Arbeitern, Gerät und einem Tor zum All.
//
// MASSSTAB: alles in Metern. Die Modelle sind es von Haus aus (Gladius
// ~20 m, Polaris ~180 m), Menschen und Gerät haben echte Größe. Nur die
// HALLE wächst mit dem Schiff (Faktor S), damit eine Idris nicht in einer
// Jägergarage steht — ein Arbeiter neben ihr ist dann so klein, wie er wäre.
//
// LACK: Schiffe mit eigener Web-Fassung (/hangar/ships/*.glb, gebaut von
// scripts/build-hangar-assets.mjs) tragen den echten Werkslack samt Decals.
// Alle übrigen kommen als reine Geometrie (/holo/*.glb); ihr Lack entsteht
// im Shader aus der Lage im Modell (Objektraum, Meter): Herstellerfarben
// zweifarbig nach Höhe, Plattenfugen triplanar, Schmutz und blanke Stellen
// aus Rauschen. Wählbare Lackierungen tauschen nur Uniforms — beim echten
// Lack legt sich der Shader-Lack über den Rumpf, Glas und Decals bleiben.
//
// HALLE: liegt eine echte Halle vor (opts.hall), ersetzt sie nach dem Laden
// die gebaute Halle; bis dahin (und wenn sie scheitert) steht die gebaute.
//
// CREW: liegt ein Crew-Modell vor (opts.crew), stehen echte Figuren statt
// der gebauten Arbeiter an den Arbeitsplätzen.
//
// API:  initHangar(container, { reduceMotion, hall?: { url, room }, crew?: { url } }) -> Promise<{
//         show(url, { maker, tex? }) -> Promise<void>, setLivery(key),
//         resetView(), onProgress(fn), dispose() }>
// three.js liegt selbst gehostet unter /vendor/three (Import-Map der Seite).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Halle bei S = 1 (Schiff bis ~16 m Spannweite). Alle Hallenmaße unten
// beziehen sich auf diesen Grundriss; das Gerät rückt mit, bleibt aber
// in Originalgröße.
const PAD_R = 10;
const HALL_R = 34;
const HALL_H = 24;
// Richtung, aus der die Kamera anfangs schaut (vorn rechts oben). Das
// Hallentor liegt genau gegenüber, damit es hinter dem Schiff im Bild ist.
const HOME_DIR = new THREE.Vector3(0.64, 0.22, 0.74).normalize();   // flach wie im Hangar-Menü des Spiels
const DOOR_ANGLE = Math.atan2(-HOME_DIR.x, -HOME_DIR.z); // Winkel um Y, 0 = +Z
const DOOR_WIDTH = 1.15; // Bogenmaß der Toröffnung

// ─── Lackierungen ─────────────────────────────────────────────────────────
// [Hauptfarbe oben, Zweitfarbe unten, Akzent]. Werkslack je Hersteller;
// die übrigen sind Sonderlackierungen wie in einer Garage zum Durchprobieren.
const MAKER_PAINT = {
  AEGS: ['#5a646f', '#262b31', '#b3202a'],
  ANVL: ['#6e7462', '#363a31', '#d9a228'],
  DRAK: ['#8e7c56', '#3b3428', '#e0b414'],
  ORIG: ['#ecebe6', '#b49a68', '#1d2840'],
  RSI: ['#d9dee4', '#27364f', '#3d7fd6'],
  MISC: ['#8a988b', '#46524b', '#ececec'],
  CRUS: ['#e4e9ef', '#2c69b0', '#a7bfd9'],
  ARGO: ['#d8a21d', '#2b2b2b', '#151515'],
  MRAI: ['#e9eaec', '#1d1f24', '#e23b3b'],
  TMBL: ['#6b6b52', '#33352a', '#c7a43a'],
  ESPR: ['#4d3e31', '#1e1915', '#c8a15c'],
  CNOU: ['#cbc4b0', '#7c2f2c', '#2f2f2f'],
  GRIN: ['#d9b53c', '#3a3a3a', '#e8e8e8'],
  KRIG: ['#5a6670', '#d9dde0', '#d23c2c'],
  XNAA: ['#cfc8ab', '#6e5b3a', '#43b5a0'],
  GAMA: ['#9aa39a', '#4f5650', '#dcdcdc'],
  GLSN: ['#3e4f5f', '#1c242c', '#e6a33a'],
  BANU: ['#7d5a3c', '#3a2a1e', '#d4a24c'],
};
const DEFAULT_PAINT = ['#8d939c', '#3a3f46', '#f5a623'];
// pattern: 0 zweifarbig mit Zierlinie, 1 Tarnfleck, 2 Rennstreifen
// Nur was aus dem Spiel kommt: Schiffe mit exportiertem Werkslack tragen
// ihn, alle anderen eine schlichte, einheitliche Grundierung statt erfundener
// Hersteller- oder Sonderlackierungen.
export const LIVERIES = {
  werk: { colors: ['#8b9097', '#6c7178', '#6c7178'], pattern: 0 },
};

const PAINT_GLSL = /* glsl */ `
uniform vec3 uPrim, uSec, uAcc;
uniform float uPattern, uPanel;
uniform vec2 uZ;      // Höhenbereich des Rumpfs (Objektraum)
uniform float uHalfW; // halbe Breite
varying vec3 vPObj;
varying vec3 vNObj;
float pHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pHash(i), pHash(i + vec3(1,0,0)), f.x), mix(pHash(i + vec3(0,1,0)), pHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(pHash(i + vec3(0,0,1)), pHash(i + vec3(1,0,1)), f.x), mix(pHash(i + vec3(0,1,1)), pHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float pFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * pNoise(p); p *= 2.03; a *= 0.5; } return s; }
// Fugenlinie auf einer Ebene, kantenweich über fwidth, blendet aus, sobald
// eine Platte nur noch wenige Bildpunkte groß ist (kein Moiré aus der Ferne).
float pLine(vec2 q, float sz) {
  vec2 g = abs(fract(q / sz + vec2(0.0, step(0.5, fract(q.x / sz * 0.5)) * 0.5)) - 0.5) * sz;
  float d = min(g.x, g.y);
  float aa = length(fwidth(q));
  return (1.0 - smoothstep(0.007 * sz, 0.007 * sz + aa, d)) * (1.0 - smoothstep(sz * 0.05, sz * 0.16, aa));
}
`;

// Hallen-UVs prüfen: Ist bei einem Material der Großteil der Dreiecke ohne
// UV-Fläche (zerquantisierte Spiel-UVs, scripts/lib/uv-islands.mjs), erscheint
// die Textur als Schmiere und Streifen. Dann wird sie im Shader würfelförmig
// aus der Objektlage projiziert, im Maßstab der heilen Dreiecke desselben
// Materials. Ein sauberer Export schaltet das von selbst ab.
function hallUvStats(model) {
  const st = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  model.traverse((n) => {
    if (!n.isMesh) return;
    const g = n.geometry, P = g.attributes.position, U = g.attributes.uv, I = g.index;
    if (!U || !I) return;
    for (const grp of (g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }])) {
      const m = [].concat(n.material)[grp.materialIndex || 0];
      const e = st.get(m) || { tris: 0, deg: 0, r: [] };
      const tris = grp.count / 3, step = Math.max(1, Math.floor(tris / 4000));
      for (let t = 0; t < tris; t += step) {
        const k = grp.start + t * 3, i0 = I.getX(k), i1 = I.getX(k + 1), i2 = I.getX(k + 2);
        const ua = Math.abs((U.getX(i1) - U.getX(i0)) * (U.getY(i2) - U.getY(i0)) - (U.getX(i2) - U.getX(i0)) * (U.getY(i1) - U.getY(i0))) / 2;
        e.tris++;
        if (ua < 1e-9) { e.deg++; continue; }
        a.fromBufferAttribute(P, i0); b.fromBufferAttribute(P, i1); c.fromBufferAttribute(P, i2);
        const wa = b.sub(a).cross(c.sub(a)).length() / 2;
        if (wa > 1e-4 && ua > 1e-6) e.r.push(Math.sqrt(wa / ua));
      }
      st.set(m, e);
    }
  });
  for (const e of st.values()) { e.r.sort((x, y) => x - y); e.share = e.tris ? e.deg / e.tris : 0; e.mPerUv = e.r[e.r.length >> 1] || 2; }
  return st;
}

function boxProject(m, mPerUv) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uBoxScale = { value: 1 / mPerUv };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uBoxScale;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
  {
    vec3 bn = abs(normal);
    vec2 bu = (bn.x > bn.y && bn.x > bn.z ? position.zy : (bn.y > bn.z ? position.xz : position.xy)) * uBoxScale;
    #ifdef USE_MAP
      vMapUv = (mapTransform * vec3(bu, 1.0)).xy;
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv = (normalMapTransform * vec3(bu, 1.0)).xy;
    #endif
    #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv = (roughnessMapTransform * vec3(bu, 1.0)).xy;
    #endif
    #ifdef USE_METALNESSMAP
      vMetalnessMapUv = (metalnessMapTransform * vec3(bu, 1.0)).xy;
    #endif
    #ifdef USE_EMISSIVEMAP
      vEmissiveMapUv = (emissiveMapTransform * vec3(bu, 1.0)).xy;
    #endif
    #ifdef USE_AOMAP
      vAoMapUv = (aoMapTransform * vec3(bu, 1.0)).xy;
    #endif
  }`);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|box';
}

function paintMaterial() {
  const u = {
    uPrim: { value: new THREE.Color() }, uSec: { value: new THREE.Color() }, uAcc: { value: new THREE.Color() },
    uPattern: { value: 0 }, uPanel: { value: 1.4 }, uZ: { value: new THREE.Vector2(0, 1) }, uHalfW: { value: 1 },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.5, envMapIntensity: 1.0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPObj;\nvarying vec3 vNObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPObj = position;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvNObj = objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PAINT_GLSL + '\nfloat pRough; float pMetal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 p = vPObj; vec3 n = normalize(vNObj);
    float h = clamp((p.z - uZ.x) / max(uZ.y - uZ.x, 0.001), 0.0, 1.0);
    // Zweifarbig: Oberseite Hauptfarbe, Bauch Zweitfarbe, Grenze leicht
    // nach der Flächenneigung verschoben (Oberseiten bleiben hell).
    float top = smoothstep(0.30, 0.38, h + n.z * 0.10);
    vec3 col = mix(uSec, uPrim, top);
    if (uPattern < 0.5) {
      float band = 1.0 - smoothstep(0.006, 0.012, abs(h + n.z * 0.10 - 0.42));
      col = mix(col, uAcc, band * step(abs(n.z), 0.6));
    } else if (uPattern < 1.5) {
      float c = pFbm(p / (uPanel * 3.2));
      col = c < 0.42 ? uPrim : (c < 0.55 ? uSec : uAcc);
    } else {
      float sx = abs(p.x) / max(uHalfW, 0.001);
      float stripe = step(abs(sx - 0.10), 0.045) * step(0.25, n.z);
      float wide = step(sx, 0.035) * step(0.25, n.z);
      col = mix(col, uSec, wide);
      col = mix(col, uAcc, stripe);
    }
    // Plattenfugen triplanar
    vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
    float line = pLine(p.yz, uPanel) * w.x + pLine(p.xz, uPanel) * w.y + pLine(p.xy, uPanel) * w.z;
    // Schmutz (Bauch und Senken stärker), blanke Stellen als Abrieb
    float g = pFbm(p * 0.8 / uPanel);
    float grime = smoothstep(0.45, 0.85, g + (1.0 - h) * 0.25);
    float bare = smoothstep(0.80, 0.86, pFbm(p * 2.6 / uPanel + 7.0));
    col *= mix(1.0, 0.72, grime);
    col = mix(col, vec3(0.55, 0.57, 0.6), bare * 0.85);
    col *= mix(1.0, 0.55, line);
    diffuseColor.rgb = col;
    pRough = mix(0.42, 0.62, grime) + line * 0.25;
    pRough = mix(pRough, 0.28, bare);
    pMetal = mix(0.22, 0.9, bare);
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = pRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = pMetal;');
  };
  m.customProgramCacheKey = () => 'hangar-paint-v1';
  m.userData.u = u;
  return m;
}

// ─── Texturen (einmal auf Leinwand gemalt) ────────────────────────────────
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function noiseFill(g, w, h, base, amp) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amp;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}
// Boden: eine Kachel = 4 m, Plattenfugen, Ölflecken, Reifenspuren.
const floorTexture = () => canvasTex(1024, 1024, (g, S) => {
  noiseFill(g, S, S, '#1b1e24', 12);
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 30 + Math.random() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 5;
  for (let i = 0; i <= 2; i++) {
    const p = (i / 2) * S;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1.5;
  for (let i = 0; i <= 2; i++) {
    const p = (i / 2) * S + 4;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  // Nieten an den Plattenecken
  g.fillStyle = 'rgba(255,255,255,.08)';
  for (let x = 0; x <= 2; x++) for (let y = 0; y <= 2; y++) {
    for (const [dx, dy] of [[14, 14], [-14, 14], [14, -14], [-14, -14]]) {
      g.beginPath(); g.arc((x / 2) * S + dx, (y / 2) * S + dy, 3, 0, 7); g.fill();
    }
  }
});
const hazardTexture = () => canvasTex(256, 32, (g) => {
  g.fillStyle = '#161616'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#d29d1e';
  for (let x = -32; x < 288; x += 32) {
    g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.closePath(); g.fill();
  }
}, [24, 1]);
// Wand: Wellblechfelder, Farbband, Hallennummer. Wird um die Halle gewickelt.
const wallTexture = () => canvasTex(2048, 512, (g, w, h) => {
  noiseFill(g, w, h, '#20252d', 10);
  for (let x = 0; x < w; x += 8) {
    g.fillStyle = x % 16 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.18)';
    g.fillRect(x, 0, 4, h);
  }
  for (let x = 0; x < w; x += 256) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, 0, 6, h); }
  g.fillStyle = '#2d3a4a'; g.fillRect(0, h * 0.62, w, h * 0.1);
  g.fillStyle = '#c9971f'; g.fillRect(0, h * 0.72, w, h * 0.018);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h * 0.9, w, h * 0.1);
  g.font = 'bold 120px sans-serif'; g.fillStyle = 'rgba(233,237,245,.55)';
  g.fillText('HANGAR 07', 80, h * 0.5);
  g.font = 'bold 60px sans-serif'; g.fillStyle = 'rgba(201,151,31,.8)';
  g.fillText('BAY C', 1240, h * 0.5);
  g.font = 'bold 36px sans-serif'; g.fillStyle = 'rgba(233,237,245,.35)';
  for (let x = 160; x < w; x += 512) g.fillText('◀ EXIT', x + 900 > w ? x - 300 : x + 600, h * 0.85);
});
const crateTexture = (hue) => canvasTex(256, 256, (g, S) => {
  noiseFill(g, S, S, hue, 14);
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 12; g.strokeRect(6, 6, S - 12, S - 12);
  g.lineWidth = 6; g.beginPath(); g.moveTo(10, 10); g.lineTo(S - 10, S - 10); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(S * 0.18, S * 0.62, S * 0.64, S * 0.16);
  g.fillStyle = '#e9edf5'; g.font = 'bold 30px sans-serif'; g.fillText('SCU-1', S * 0.27, S * 0.74);
});
const starTexture = () => canvasTex(2048, 1024, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#02030a'); bg.addColorStop(1, '#0a1022');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const a = Math.random();
    g.fillStyle = `rgba(${200 + Math.random() * 55 | 0},${210 + Math.random() * 45 | 0},255,${a * a})`;
    const r = Math.random() < 0.02 ? 2.2 : Math.random() * 1.2;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, 7); g.fill();
  }
  // Nebelschleier
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * w, y = Math.random() * h * 0.7, r = 200 + Math.random() * 300;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${80 + Math.random() * 80 | 0},60,${150 + Math.random() * 100 | 0},.12)`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
});

// Umgebungslicht für die Reflexe: kleine Ersatzhalle, einmal per PMREM.
function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x0b0d12);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const lit = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
  for (let i = -2; i <= 2; i++) {
    const m = new THREE.Mesh(box, lit(0xffffff, 6));
    m.scale.set(30, 0.4, 1.4); m.position.set(0, 14, i * 6); env.add(m);
  }
  const left = new THREE.Mesh(box, lit(0x8fb4ff, 1.4));
  left.scale.set(0.5, 8, 30); left.position.set(-18, 5, 0); env.add(left);
  const right = new THREE.Mesh(box, lit(0xffc27a, 1.1));
  right.scale.set(0.5, 8, 30); right.position.set(18, 5, 0); env.add(right);
  const floor = new THREE.Mesh(box, lit(0x22262e, 1));
  floor.scale.set(60, 0.2, 60); floor.position.set(0, -1, 0); env.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.04);
  pm.dispose(); box.dispose();
  env.traverse((o) => o.material?.dispose?.());
  return rt;
}

// ─── Halle (Maße für S = 1, die Gruppe wird mit S skaliert) ────────────────
function buildHall(reduceMotion) {
  const hall = new THREE.Group();
  const anim = [];
  const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // Plattform: Scheibe, Gefahrenring, Leuchtkante, Bodenleuchten.
  const pad = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(PAD_R, PAD_R + 0.35, 0.3, 128),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.45, metalness: 0.7 })
  ));
  pad.position.y = 0.15; hall.add(pad);
  const hazard = new THREE.Mesh(
    new THREE.RingGeometry(PAD_R - 0.8, PAD_R - 0.3, 160),
    new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6, metalness: 0.2 })
  );
  hazard.rotation.x = -Math.PI / 2; hazard.position.y = 0.305; hazard.receiveShadow = true; hall.add(hazard);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xf5a623, transparent: true, opacity: 0.85 });
  const glow = new THREE.Mesh(new THREE.TorusGeometry(PAD_R + 0.18, 0.05, 8, 200), glowMat);
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.29; hall.add(glow);
  // Landelichter rund um den Rand, laufen im Kreis
  const beaconGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const beacons = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const b = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xffb340 }));
    b.position.set(Math.sin(a) * (PAD_R + 0.55), 0.12, Math.cos(a) * (PAD_R + 0.55));
    hall.add(b); beacons.push(b);
  }
  if (!reduceMotion) anim.push((t) => {
    glowMat.opacity = 0.65 + 0.25 * Math.sin(t * 1.6);
    const head = (t * 6) % 24;
    beacons.forEach((b, i) => {
      const d = (head - i + 24) % 24;
      b.material.color.setRGB(0.9, 0.45 + 0.45 * Math.max(0, 1 - d / 3), 0.12 + 0.5 * Math.max(0, 1 - d / 3));
      b.scale.setScalar(d < 1 ? 1.5 : 1);
    });
  });

  // Bodenmarkierung: Rollweg zum Tor
  const lane = new THREE.MeshBasicMaterial({ color: 0xc9971f, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.2), lane);
    m.rotation.x = -Math.PI / 2;
    const r = PAD_R + 2.5 + i * 2.6;
    for (const off of [-4, 4]) {
      const mm = m.clone();
      mm.position.set(Math.sin(DOOR_ANGLE) * r + Math.cos(DOOR_ANGLE) * off, 0.012, Math.cos(DOOR_ANGLE) * r - Math.sin(DOOR_ANGLE) * off);
      mm.rotation.z = -DOOR_ANGLE;
      hall.add(mm);
    }
  }

  // Wand: Zylindersegment mit Lücke fürs Tor, innen sichtbar, umwickelt mit
  // der Wandtextur. thetaStart in three zählt ab +Z gegen den Uhrzeigersinn
  // von oben gesehen — dieselbe Konvention wie DOOR_ANGLE (atan2(x, z)).
  const wallTex = wallTexture();
  // Innenseite (BackSide) spiegelt die Textur — negative Wiederholung dreht sie zurück.
  wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(-3, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8, metalness: 0.35, side: THREE.BackSide });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(HALL_R, HALL_R, HALL_H, 96, 1, true, DOOR_ANGLE + DOOR_WIDTH / 2, Math.PI * 2 - DOOR_WIDTH),
    wallMat
  );
  wall.position.y = HALL_H / 2; wall.receiveShadow = true; hall.add(wall);
  // Decke
  const ceil = new THREE.Mesh(
    new THREE.CircleGeometry(HALL_R, 64),
    new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.9, metalness: 0.3, side: THREE.BackSide })
  );
  ceil.rotation.x = -Math.PI / 2; ceil.position.y = HALL_H; hall.add(ceil);
  // Rippen (nicht im Torbereich), dazwischen Leuchtstreifen
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.7, metalness: 0.5 });
  const ribGeo = new THREE.BoxGeometry(1.4, HALL_H, 1.4);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x9fc3ff });
  const stripGeo = new THREE.BoxGeometry(0.15, HALL_H * 0.55, 0.15);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    let da = Math.abs(((a - DOOR_ANGLE + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < DOOR_WIDTH / 2 + 0.05) continue;
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(Math.sin(a) * (HALL_R - 0.7), HALL_H / 2, Math.cos(a) * (HALL_R - 0.7));
    rib.lookAt(0, HALL_H / 2, 0);
    hall.add(rib);
    const a2 = a + Math.PI / 24;
    da = Math.abs(((a2 - DOOR_ANGLE + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < DOOR_WIDTH / 2 + 0.05) continue;
    const s = new THREE.Mesh(stripGeo, stripMat);
    s.position.set(Math.sin(a2) * (HALL_R - 0.5), HALL_H * 0.42, Math.cos(a2) * (HALL_R - 0.5));
    hall.add(s);
  }

  // Tor: Rahmen, offene Torflügel, Kraftfeld, dahinter das All mit Planet.
  const doorW = 2 * HALL_R * Math.sin(DOOR_WIDTH / 2);
  const doorC = new THREE.Vector3(Math.sin(DOOR_ANGLE), 0, Math.cos(DOOR_ANGLE)).multiplyScalar(HALL_R * Math.cos(DOOR_WIDTH / 2));
  const doorRot = DOOR_ANGLE + Math.PI;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.5, metalness: 0.7 });
  const frame = new THREE.Group();
  frame.position.copy(doorC); frame.rotation.y = doorRot;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.8, HALL_H, 2.4), frameMat);
    post.position.set(sx * (doorW / 2 + 0.9), HALL_H / 2, 0); frame.add(post);
    // eingefahrener Torflügel
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.12, HALL_H * 0.86, 0.6), frameMat);
    leaf.position.set(sx * (doorW / 2 - doorW * 0.06), HALL_H * 0.43, 1.2); frame.add(leaf);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 3.6, HALL_H * 0.16, 2.4), frameMat);
  lintel.position.set(0, HALL_H * 0.92, 0); frame.add(lintel);
  const lintelLight = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0xffb340 }));
  lintelLight.position.set(0, HALL_H * 0.84 - 0.2, -1.25); frame.add(lintelLight);
  const fieldMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vUv;
      void main(){
        float edge = smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
        float ripple = 0.5 + 0.5 * sin(vUv.y * 90.0 - uT * 2.0 + sin(vUv.x * 20.0 + uT) * 2.0);
        float a = 0.05 + 0.06 * ripple + 0.25 * (1.0 - smoothstep(0.0, 0.05, vUv.y));
        gl_FragColor = vec4(vec3(0.35, 0.65, 1.0) * a * edge, 1.0);
      }`,
  });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(doorW, HALL_H * 0.84), fieldMat);
  field.position.set(0, HALL_H * 0.42, 0.2); frame.add(field);
  if (!reduceMotion) anim.push((t) => { fieldMat.uniforms.uT.value = t; });
  hall.add(frame);
  // All: weit draußen, ohne Nebel, damit es nicht im Hallendunst ersäuft.
  const space = new THREE.Group();
  space.position.copy(doorC).multiplyScalar(1.0);
  space.rotation.y = doorRot;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(HALL_R * 9, HALL_R * 4.5), new THREE.MeshBasicMaterial({ map: starTexture(), fog: false }));
  sky.position.set(0, HALL_R * 0.8, -HALL_R * 3.2); space.add(sky);
  const planetMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uSun: { value: new THREE.Vector3(-0.6, 0.35, 0.7).normalize() } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vV;
      void main(){
        float l = max(dot(vN, normalize(uSun)), 0.0);
        float band = 0.5 + 0.5 * sin(vN.y * 18.0 + sin(vN.x * 6.0) * 1.5);
        vec3 base = mix(vec3(0.12, 0.22, 0.38), vec3(0.32, 0.48, 0.62), band);
        float rim = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
        vec3 c = base * (0.05 + 1.1 * l) + vec3(0.35, 0.6, 1.0) * rim * (0.25 + l);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(HALL_R * 1.2, 64, 48), planetMat);
  planet.position.set(HALL_R * 1.2, -HALL_R * 0.55, -HALL_R * 2.8); space.add(planet);
  hall.add(space);
  // Ein Frachter zieht draußen vorbei (Lichtpunkte, nichts Detailliertes)
  const passer = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 1.6), new THREE.MeshBasicMaterial({ color: 0x1a2030, fog: false }));
  passer.add(pBody);
  for (const [x, c] of [[-3.1, 0xff3030], [3.1, 0x30ff60], [0, 0xffffff]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: c, fog: false }));
    l.position.set(x, 0.7, 0); passer.add(l);
  }
  space.add(passer);
  if (!reduceMotion) anim.push((t) => {
    const k = ((t * 0.02) % 1);
    passer.position.set(-HALL_R * 4 + k * HALL_R * 8, HALL_R * 0.5, -HALL_R * 2.2);
  });

  // Deckenstrahler mit sichtbarem Lichtkegel
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0.035, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 0.8), barMat);
    bar.position.set(0, HALL_H - 1.2, i * 6.5); hall.add(bar);
  }
  for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(7, HALL_H - 2, 32, 1, true), coneMat);
    cone.position.set(x, (HALL_H - 2) / 2, z); hall.add(cone);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.6, 16), barMat);
    lamp.position.set(x, HALL_H - 1.6, z); hall.add(lamp);
  }

  return { hall, anim };
}

// ─── Gerät und Requisiten (Originalgröße, Meter) ──────────────────────────
const M = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4a515c, roughness: 0.5, metalness: 0.75 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1d2128, roughness: 0.7, metalness: 0.5 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xd29d1e, roughness: 0.55, metalness: 0.3 }),
  red: new THREE.MeshStandardMaterial({ color: 0xa8282a, roughness: 0.5, metalness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.5, metalness: 0.2 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.95, metalness: 0 }),
  screen: new THREE.MeshBasicMaterial({ color: 0x4fc3ff }),
  warn: new THREE.MeshBasicMaterial({ color: 0xff8a1f }),
};
const CRATE_MATS = ['#3f5a3a', '#5a4630', '#2f4660', '#6a6f75'].map((c) =>
  new THREE.MeshStandardMaterial({ map: crateTexture(c), roughness: 0.75, metalness: 0.2 }));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function crateStack() {
  const g = new THREE.Group();
  const box = new THREE.BoxGeometry(1.25, 1.25, 1.25);
  const layout = [[0, 0, 0], [1.3, 0, 0.1], [0.65, 1.25, 0.05], [-0.2, 0, 1.35], [1.1, 0, 1.4], [0.4, 1.25, 1.35]];
  layout.forEach(([x, y, z], i) => {
    const m = mesh(box, CRATE_MATS[i % CRATE_MATS.length], x, y + 0.625, z);
    m.rotation.y = (Math.random() - 0.5) * 0.3; g.add(m);
  });
  return g;
}
function fuelTanks() {
  const g = new THREE.Group();
  const tank = new THREE.CylinderGeometry(0.8, 0.8, 3.2, 24);
  for (const x of [0, 1.8]) {
    const t = mesh(tank, M.white, x, 1.6 + 0.3, 0);
    g.add(t);
    const band = mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.25, 24), M.red, x, 2.6, 0); g.add(band);
    const foot = mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), M.dark, x, 0.15, 0); g.add(foot);
  }
  return g;
}
function workbench() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.08, 0.9), M.steel, 0, 0.92, 0));
  for (const [x, z] of [[-1.1, -0.38], [1.1, -0.38], [-1.1, 0.38], [1.1, 0.38]]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.92, 0.08), M.dark, x, 0.46, z));
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.35, 0.4), M.red, -0.7, 1.13, 0));    // Werkzeugkasten
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.05), M.dark, 0.6, 1.25, -0.3)); // Monitor
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.24), M.screen);
  scr.position.set(0.6, 1.25, -0.27); g.add(scr);
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), M.yellow, 1.6, 0.09, 0.2)); // Schweißgerät am Boden
  return g;
}
function toolCart() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.9, 0.6), M.red, 0, 0.6, 0));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(1.0, 0.02, 0.02), M.steel, 0, 0.3 + i * 0.2, 0.31));
  for (const [x, z] of [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), M.rubber, x, 0.07, z));
  const handle = mesh(new THREE.TorusGeometry(0.25, 0.025, 6, 16, Math.PI), M.steel, -0.6, 1.0, 0);
  handle.rotation.set(0, Math.PI / 2, Math.PI / 2); g.add(handle);
  return g;
}
function boardingStair() {
  const g = new THREE.Group();
  const steps = 8;
  for (let i = 0; i < steps; i++) g.add(mesh(new THREE.BoxGeometry(1.0, 0.06, 0.32), M.steel, 0, 0.3 + i * 0.28, -i * 0.3));
  for (const x of [-0.55, 0.55]) {
    const rail = mesh(new THREE.BoxGeometry(0.05, 0.05, steps * 0.42), M.yellow, x, 1.6, -steps * 0.15);
    rail.rotation.x = Math.atan2(0.28, 0.3); g.add(rail);
    const side = mesh(new THREE.BoxGeometry(0.06, 0.3, steps * 0.42), M.dark, x * 0.95, 1.2, -steps * 0.15);
    side.rotation.x = Math.atan2(0.28, 0.3); g.add(side);
  }
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.25, 2.8), M.dark, 0, 0.2, -1.2));
  for (const [x, z] of [[-0.55, 0], [0.55, 0], [-0.55, -2.4], [0.55, -2.4]]) g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), M.rubber, x, 0.06, z));
  return g;
}
function barrels() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 18);
  [[0, 0, M.yellow], [0.65, 0.1, M.steel], [0.3, 0.6, M.yellow], [-0.4, 0.55, M.red]].forEach(([x, z, m]) => g.add(mesh(geo, m, x, 0.45, z)));
  return g;
}
function cableSpool() {
  const g = new THREE.Group();
  const s = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 20), M.dark, 0, 0.7, 0); s.rotation.z = Math.PI / 2; g.add(s);
  const c = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.92, 20), M.rubber, 0, 0.7, 0); c.rotation.z = Math.PI / 2; g.add(c);
  return g;
}
// Schlepper: kleines Bodenfahrzeug mit Rundumlicht, fährt eine Runde.
function tug() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.6, 2.6), M.yellow, 0, 0.55, 0));
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.7, 1.0), M.dark, 0, 1.15, -0.5));
  for (const [x, z] of [[-0.8, 0.85], [0.8, 0.85], [-0.8, -0.85], [0.8, -0.85]]) {
    const w = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 16), M.rubber, x, 0.32, z); w.rotation.z = Math.PI / 2; g.add(w);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), M.warn.clone());
  beacon.position.set(0, 1.6, -0.5); g.add(beacon);
  g.userData.beacon = beacon;
  // Anhänger mit Kiste
  const tr = new THREE.Group();
  tr.add(mesh(new THREE.BoxGeometry(1.5, 0.15, 2.0), M.steel, 0, 0.45, 0));
  for (const [x, z] of [[-0.7, 0.7], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7]]) {
    const w = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12), M.rubber, x, 0.22, z); w.rotation.z = Math.PI / 2; tr.add(w);
  }
  tr.add(mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), CRATE_MATS[2], 0, 1.15, 0));
  tr.position.z = -2.6;
  g.add(tr);
  return g;
}

// ─── Arbeiter ──────────────────────────────────────────────────────────────
// Aus Grundkörpern, mit Gelenken (Hüfte/Knie/Schulter/Ellbogen). 1,78 m.
const SUIT = [0x3a4a5e, 0x5a4a3a, 0x3d4a3a, 0x4a4f57, 0x6a3a2a];
const HELMET = [0xe8e8e8, 0xd29d1e, 0xe8e8e8, 0x3d7fd6];
const skinMat = new THREE.MeshStandardMaterial({ color: 0xc89a7a, roughness: 0.7 });
const vestMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6, emissive: 0x3a1500 });
const stripeMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.3, emissive: 0x555a60 });
function limb(r, len, mat) {
  // Gelenkgruppe am oberen Ende, Glied hängt nach unten
  const j = new THREE.Group();
  const m = mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 10), mat, 0, -len / 2, 0);
  j.add(m);
  return j;
}
function worker(i) {
  const suit = new THREE.MeshStandardMaterial({ color: SUIT[i % SUIT.length], roughness: 0.8 });
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.95; root.add(body);
  const pelvis = mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), suit, 0, 0, 0); body.add(pelvis);
  const torso = mesh(new THREE.CapsuleGeometry(0.17, 0.32, 4, 10), suit, 0, 0.3, 0); torso.scale.set(1.1, 1, 0.75); body.add(torso);
  const vest = mesh(new THREE.CapsuleGeometry(0.175, 0.24, 4, 10), vestMat, 0, 0.33, 0); vest.scale.set(1.12, 1, 0.8); body.add(vest);
  const stripe = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14), stripeMat, 0, 0.28, 0); stripe.scale.set(1, 1, 0.72); body.add(stripe);
  const neck = new THREE.Group(); neck.position.y = 0.6; body.add(neck);
  neck.add(mesh(new THREE.SphereGeometry(0.11, 14, 10), skinMat, 0, 0.1, 0));
  const helmet = mesh(new THREE.SphereGeometry(0.125, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: HELMET[i % HELMET.length], roughness: 0.35 }), 0, 0.13, 0);
  neck.add(helmet);
  neck.add(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.02), M.screen, 0, 0.12, 0.11)); // Visier-Leuchtstreifen
  const mk = (x, y, r1, l1, r2, l2, mat) => {
    const a = limb(r1, l1, mat); a.position.set(x, y, 0); body.add(a);
    const b = limb(r2, l2, mat); b.position.y = -l1; a.add(b);
    return [a, b];
  };
  const [shL, elL] = mk(-0.23, 0.5, 0.055, 0.3, 0.05, 0.28, suit);
  const [shR, elR] = mk(0.23, 0.5, 0.055, 0.3, 0.05, 0.28, suit);
  const [hipL, knL] = mk(-0.1, -0.02, 0.075, 0.45, 0.065, 0.45, suit);
  const [hipR, knR] = mk(0.1, -0.02, 0.075, 0.45, 0.065, 0.45, suit);
  for (const k of [knL, knR]) k.add(mesh(new THREE.BoxGeometry(0.11, 0.08, 0.24), M.rubber, 0, -0.45, 0.05));
  const hand = new THREE.Group(); hand.position.y = -0.28; elR.add(hand);
  return { root, body, neck, shL, elL, shR, elR, hipL, knL, hipR, knR, hand };
}
// Haltungen: setzt die Gelenkwinkel aus einer Phase.
function poseWalk(w, ph, amp = 1) {
  const s = Math.sin(ph), c = Math.cos(ph);
  w.hipL.rotation.x = 0.5 * s * amp; w.hipR.rotation.x = -0.5 * s * amp;
  w.knL.rotation.x = Math.max(0, -c) * 0.8 * amp; w.knR.rotation.x = Math.max(0, c) * 0.8 * amp;
  w.shL.rotation.x = -0.4 * s * amp; w.shR.rotation.x = 0.4 * s * amp;
  w.elL.rotation.x = -0.3 * amp; w.elR.rotation.x = -0.3 * amp;
  w.body.position.y = 0.95 + Math.abs(c) * 0.03 * amp;
  w.body.rotation.x = 0.04; w.neck.rotation.x = 0;
}
function poseStand(w) {
  for (const j of [w.hipL, w.hipR, w.knL, w.knR, w.shL, w.shR, w.elL, w.elR]) j.rotation.set(0, 0, 0);
  w.body.position.y = 0.95; w.body.rotation.set(0, 0, 0); w.neck.rotation.set(0, 0, 0);
}
function poseKneel(w) {
  poseStand(w);
  w.body.position.y = 0.55;
  w.hipL.rotation.x = -1.5; w.knL.rotation.x = 1.6;
  w.hipR.rotation.x = -0.2; w.knR.rotation.x = 1.9;
  w.body.rotation.x = 0.25;
}

// Schwebstaub im Licht um das Schiff: weiche Punkte, die langsam treiben.
// Lebt im Einheitswürfel und wird mit der Schiffsgröße gestreckt.
function dustCloud(count = 700) {
  const geo = new THREE.BufferGeometry();
  const base = new Float32Array(count * 3), pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = Math.random() - 0.5; base[i * 3 + 1] = Math.random(); base[i * 3 + 2] = Math.random() - 0.5;
    seed[i] = Math.random() * 100;
  }
  pos.set(base);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ color: 0xfff1dc, size: 0.06, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const update = (t) => {
    for (let i = 0; i < count; i++) {
      const k = seed[i];
      pos[i * 3] = base[i * 3] + 0.02 * Math.sin(t * 0.13 + k);
      pos[i * 3 + 1] = (base[i * 3 + 1] + t * 0.004 * (0.5 + (k % 1))) % 1;
      pos[i * 3 + 2] = base[i * 3 + 2] + 0.02 * Math.cos(t * 0.11 + k * 1.3);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { pts, update };
}

// Schweißfunken: kleine Partikelwolke, die aus einem Punkt sprüht.
function sparks(count = 60) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), vel = [], life = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffc46a, size: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  for (let i = 0; i < count; i++) { vel.push(new THREE.Vector3()); life[i] = Math.random(); }
  const flash = new THREE.PointLight(0x9fd0ff, 0, 6, 2);
  const update = (dt, on) => {
    flash.intensity = on ? 0.4 + Math.random() * 0.8 : 0;
    for (let i = 0; i < count; i++) {
      life[i] -= dt * 1.6;
      if (life[i] <= 0 && on) {
        life[i] = 0.4 + Math.random() * 0.6;
        pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 0;
        vel[i].set((Math.random() - 0.5) * 2.4, Math.random() * 2.2, (Math.random() - 0.2) * 2.4);
      }
      if (life[i] > 0) {
        vel[i].y -= 9.8 * dt;
        pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
        if (pos[i * 3 + 1] < -0.9) { pos[i * 3 + 1] = -0.9; vel[i].y *= -0.3; vel[i].x *= 0.5; vel[i].z *= 0.5; }
      } else { pos[i * 3 + 1] = -99; }
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { pts, flash, update };
}

// Inspektionsdrohne: kreist um das Schiff, tastet es mit einem Lichtfächer ab.
function drone() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), M.dark));
  const rotors = [];
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.04, 0.05), M.steel, x / 2, 0, z / 2));
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 16), new THREE.MeshBasicMaterial({ color: 0x9aa6bd, transparent: true, opacity: 0.35 }));
    r.position.set(x, 0.06, z); g.add(r); rotors.push(r);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4fc3ff }));
  eye.position.set(0, -0.1, 0.22); g.add(eye);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
  blink.position.set(0, 0.1, -0.25); g.add(blink);
  const scan = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  scan.position.y = -0.5; g.add(scan);
  return { g, rotors, blink, scan };
}

// Weg aus Punkten (geschlossen), gleichmäßig abgelaufen.
function pathOf(points) {
  const segs = []; let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const len = a.distanceTo(b); segs.push({ a, b, len, at: total }); total += len;
  }
  return {
    total,
    at(d, out) {
      d = ((d % total) + total) % total;
      const s = segs.find((x) => d <= x.at + x.len) || segs[segs.length - 1];
      const k = s.len ? (d - s.at) / s.len : 0;
      out.copy(s.a).lerp(s.b, k);
      return Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z);
    },
  };
}
const polar = (r, a, y = 0) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);

// Zerlegt die echte Crew-Figur in Glieder für das Arbeitergerüst.
// Die Figur steht in Metern, Y oben, blickt in -Z, Arme nach vorn unten
// zusammengeführt (so kommt sie aus dem Build). Ergebnis: Gelenkname ->
// [[Geometrie im Gelenkraum, Material]].
function rigCrew(model) {
  model.updateMatrixWorld(true);
  // Gelenke des Gerüsts in Weltlage (siehe worker()): Körper 0,95, Hals 1,55,
  // Schulter ±0,23/1,45, Ellbogen 0,30 tiefer, Hüfte ±0,1/0,93, Knie 0,45 tiefer.
  const BODY = new THREE.Vector3(0, 0.95, 0), NECK = new THREE.Vector3(0, 1.55, 0);
  const tri = { body: [], neck: [], shL: [], elL: [], shR: [], elR: [], hipL: [], knL: [], hipR: [], knR: [] };
  const sh = (sx) => new THREE.Vector3(0.22 * sx, 1.47, 0.02);     // Schulter der Figur (nach der Wende)
  const hd = (sx) => new THREE.Vector3(0.04 * sx, 0.88, 0.33);     // Hände vorn zusammen
  const rot = { L: null, R: null };
  for (const k of ['L', 'R']) {
    const sx = k === 'L' ? -1 : 1;
    rot[k] = new THREE.Quaternion().setFromUnitVectors(hd(sx).sub(sh(sx)).normalize(), new THREE.Vector3(0, -1, 0));
  }
  const c = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3();
  const distSeg = (p, s0, s1) => {
    b.subVectors(s1, s0); const t = THREE.MathUtils.clamp(a.subVectors(p, s0).dot(b) / b.lengthSq(), 0, 1);
    return q.copy(s0).addScaledVector(b, t).distanceTo(p);
  };
  model.traverse((n) => {
    if (!n.isMesh) return;
    const g = (n.geometry.index ? n.geometry.toNonIndexed() : n.geometry.clone());
    g.applyMatrix4(n.matrixWorld);
    g.rotateY(Math.PI);                       // Blick nach +Z wie das Gerüst
    const P = g.attributes.position;
    const isArm = /arm/i.test(n.material.name || '');
    for (let t = 0; t < P.count; t += 3) {
      c.set(0, 0, 0);
      for (let k = 0; k < 3; k++) c.x += P.getX(t + k) / 3, c.y += P.getY(t + k) / 3, c.z += P.getZ(t + k) / 3;
      const side = c.x < 0 ? 'L' : 'R', sx = c.x < 0 ? -1 : 1;
      let key;
      const nearArm = distSeg(c, sh(sx), hd(sx)) < 0.085 && (c.z > 0.12 || Math.abs(c.x) > 0.2);
      if (isArm || (nearArm && c.y > 0.75)) {
        // Ober- oder Unterarm: Abstand von der Schulter nach dem Geradebiegen
        a.subVectors(c, sh(sx)).applyQuaternion(rot[side]);
        key = (-a.y > 0.3 ? 'el' : 'sh') + side;
      } else if (c.y > 1.56 && Math.abs(c.x) < 0.14) key = 'neck';
      else if (c.y < 0.92) key = (c.y < 0.48 ? 'kn' : 'hip') + side;
      else key = 'body';
      tri[key].push(g, t, n.material);
    }
  });
  const out = {};
  for (const [key, list] of Object.entries(tri)) {
    // nach Material bündeln
    const byMat = new Map();
    for (let i = 0; i < list.length; i += 3) {
      const g = list[i], t = list[i + 1], m = list[i + 2];
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push(g, t);
    }
    out[key] = [];
    for (const [mat, refs] of byMat) {
      const nTri = refs.length / 2;
      const pos = new Float32Array(nTri * 9), nor = new Float32Array(nTri * 9);
      for (let i = 0; i < refs.length; i += 2) {
        const g = refs[i], t = refs[i + 1], o = (i / 2) * 9;
        const gp = g.attributes.position, gn = g.attributes.normal;
        for (let k = 0; k < 3; k++) {
          pos[o + k * 3] = gp.getX(t + k); pos[o + k * 3 + 1] = gp.getY(t + k); pos[o + k * 3 + 2] = gp.getZ(t + k);
          if (gn) { nor[o + k * 3] = gn.getX(t + k); nor[o + k * 3 + 1] = gn.getY(t + k); nor[o + k * 3 + 2] = gn.getZ(t + k); }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const side = key.endsWith('L') ? 'L' : 'R', sx = side === 'L' ? -1 : 1;
      if (key.startsWith('sh') || key.startsWith('el')) {
        const s0 = sh(sx);
        geo.translate(-s0.x, -s0.y, -s0.z);
        geo.applyQuaternion(rot[side]);
        // Gerüstschulter sitzt bei ±0,23 — leicht nach außen, damit die Arme frei hängen
        geo.translate(sx * 0.02, 0, 0);
        if (key.startsWith('el')) geo.translate(0, 0.3, 0);
      } else if (key.startsWith('hip')) geo.translate(-0.1 * sx, -0.93, 0);
      else if (key.startsWith('kn')) geo.translate(-0.1 * sx, -0.48, 0);
      else if (key === 'neck') geo.translate(-NECK.x, -NECK.y, -NECK.z);
      else geo.translate(-BODY.x, -BODY.y, -BODY.z);
      if (!gnHas(refs)) geo.computeVertexNormals();
      out[key].push([geo, mat]);
    }
  }
  return out;
}
const gnHas = (refs) => !!refs[0]?.attributes.normal;

// Die belebte Halle: Gerät, Arbeiter, Drohne, Kran. layout(S, ship) rückt
// alles an die aktuelle Plattform, update(dt, t) bewegt es.
function buildLife(scene, reduceMotion) {
  const root = new THREE.Group(); scene.add(root);
  const props = {
    crates: crateStack(), crates2: crateStack(), tanks: fuelTanks(), bench: workbench(), bench2: workbench(),
    cart: toolCart(), stair: boardingStair(), barrels: barrels(), spool: cableSpool(), barrels2: barrels(),
  };
  for (const p of Object.values(props)) root.add(p);
  const tugV = tug(); root.add(tugV);
  const crew = [];
  for (let i = 0; i < 8; i++) { const w = worker(i); root.add(w.root); crew.push(w); }
  const welder = sparks(); root.add(welder.pts); root.add(welder.flash);
  const welder2 = sparks(40); root.add(welder2.pts); root.add(welder2.flash);
  const dr = drone(); root.add(dr.g);
  // Portalkran an der Decke: Träger fährt quer, Haken hängt am Seil
  const crane = new THREE.Group();
  const beam = mesh(new THREE.BoxGeometry(1, 1.2, 1), M.yellow); crane.add(beam);
  const trolley = mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), M.dark); crane.add(trolley);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), M.rubber); crane.add(rope);
  const hook = mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16, Math.PI * 1.4), M.steel); crane.add(hook);
  root.add(crane);

  let L = null; // aktuelle Anordnung
  const v = new THREE.Vector3();

  function layout(S, ship) {
    const R = PAD_R * S;           // Plattformrand in Metern
    const D = DOOR_ANGLE;          // Torrichtung
    const ring = R + 3;            // Laufweg um die Plattform
    const place = (o, r, a, face = a + Math.PI) => { o.position.copy(polar(r, a)); o.rotation.y = face; };
    // Gerät auf die linke und hintere Seite, damit es dem Startblick
    // (vorn rechts) nicht vor das Schiff rückt.
    place(props.crates, R + 6, D + 0.9);
    place(props.crates2, R + 8, D - 1.1);
    place(props.tanks, R + 6.5, D + 1.6);
    place(props.bench, R + 5, D - 0.55);
    place(props.bench2, R + 5.5, D + 2.3);
    place(props.cart, R + 4, D - 0.3);
    place(props.barrels, R + 7, D - 1.7);
    place(props.barrels2, R + 5, D + 0.35);
    place(props.spool, R + 4.5, D + 1.25);
    // Treppe steht am Schiff, auf der Plattform, quer zur Bordwand
    const halfW = ship ? Math.min(ship.halfW + 1.5, R - 1.5) : R * 0.5;
    props.stair.position.set(-halfW, 0.3, ship ? ship.len * 0.1 : 0);
    props.stair.rotation.y = -Math.PI / 2;
    // Die Bordtreppe stand neben jedem Schiff, ohne zu dessen Einstieg zu
    // passen — eher störend als belebend.
    props.stair.visible = false;

    const benchPos = (b, side) => b.localToWorld(new THREE.Vector3(side, 0, 0.9));
    props.bench.updateMatrixWorld(); props.bench2.updateMatrixWorld();
    L = {
      S, R, ring,
      // Rundweg um die Plattform, mit Abstecher zum Tor
      loop: pathOf([0, 1, 2, 3, 4, 5, 6, 7].map((i) => polar(ring, D + (i / 8) * Math.PI * 2 + 0.2))),
      doorRun: pathOf([polar(ring, D + 0.25), polar(HALL_R * S * 0.85, D + 0.12), polar(HALL_R * S * 0.85, D - 0.12), polar(ring, D - 0.25), polar(R + 5.5, D - 0.9)]),
      cartRun: pathOf([polar(R + 2, D - 0.2), polar(R + 2, D + 1.2), polar(R + 4, D + 1.8), polar(R + 4, D - 0.6)]),
      tugRun: pathOf([0, 1, 2, 3, 4, 5].map((i) => polar(R + 10 + S * 2, D + 0.5 + (i / 6) * Math.PI * 2))),
      weldAt: benchPos(props.bench, 0.3),
      weldAt2: benchPos(props.bench2, -0.3),
      shipTop: ship ? ship.height + 0.3 : 3,
      shipLen: ship ? ship.len : 10,
      shipHalfW: halfW,
    };
    // Kran über die ganze Halle
    beam.scale.set(HALL_R * S * 1.8, 1, 1);
    crane.position.y = HALL_H * S - 3;
  }

  // Echte Hangar-Crew (Modell aus scripts/build-hangar-assets.mjs): die Figur
  // kommt als starre Teile ohne Skelett. Sie wird hier einmal in Glieder
  // zerlegt (Rumpf, Kopf, Ober-/Unterarm, Ober-/Unterschenkel) und auf das
  // Gelenkgerüst der gebauten Arbeiter gehängt — so laufen, schweißen und
  // hämmern echte Figuren mit denselben Bewegungen.
  let rigged = false;
  function setCrew(model) {
    const segs = rigCrew(model);
    crew.forEach((w, i) => {
      w.root.updateMatrixWorld(true);
      // die eigenen Grundkörper weichen, Werkzeug in der Hand bleibt
      const own = [];
      w.root.traverse((n) => { if (n.isMesh) own.push(n); });
      for (const n of own) {
        let p = n.parent, inHand = false;
        while (p) { if (p === w.hand) { inHand = true; break; } p = p.parent; }
        if (!inHand) n.visible = false;
      }
      for (const [joint, parts] of Object.entries(segs)) {
        for (const [geo, mat] of parts) {
          const m = new THREE.Mesh(geo, mat);
          m.castShadow = true; m.receiveShadow = true;
          w[joint].add(m);
        }
      }
      // leicht unterschiedliche Statur, damit es keine Klonarmee wird
      w.root.scale.setScalar(0.95 + ((i * 37) % 9) / 100);
    });
    rigged = true;
  }

  // Rollen der acht Arbeiter
  const roles = ['loop', 'loop', 'door', 'weld', 'push', 'tablet', 'weld2', 'hammer'];
  const offs = [0, 0.5, 0, 0, 0, 0, 0, 0];
  const tmp = new THREE.Vector3();

  function update(dt, t) {
    if (!L) return;
    crew.forEach((w, i) => {
      const role = roles[i];
      const speed = 1.35;
      if (role === 'loop' || role === 'door' || role === 'push') {
        const p = role === 'loop' ? L.loop : role === 'door' ? L.doorRun : L.cartRun;
        const sp = role === 'push' ? 0.9 : speed;
        const d = reduceMotion ? p.total * (offs[i] + i * 0.13) : t * sp + p.total * (offs[i] + i * 0.13);
        const yaw = p.at(d, tmp);
        w.root.position.copy(tmp); w.root.rotation.y = yaw;
        if (reduceMotion) poseStand(w); else poseWalk(w, d * 3.2, role === 'push' ? 0.7 : 1);
        if (role === 'push' && props.cart.visible) {
          w.shL.rotation.x = w.shR.rotation.x = -1.2; w.elL.rotation.x = w.elR.rotation.x = -0.3;
          props.cart.position.copy(tmp).add(v.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.9));
          props.cart.rotation.y = yaw + Math.PI / 2;
        }
        // Wer die Plattform betritt, wird außen herum gelenkt (Abstand zum Rumpf)
      } else if (role === 'weld' || role === 'weld2') {
        const at = role === 'weld' ? L.weldAt : L.weldAt2;
        const bench = role === 'weld' ? props.bench : props.bench2;
        w.root.position.copy(at); w.root.rotation.y = bench.rotation.y + Math.PI;
        poseKneel(w);
        w.shR.rotation.x = -1.3; w.elR.rotation.x = -0.4;
        w.shL.rotation.x = -0.9; w.elL.rotation.x = -0.8;
        const sp = role === 'weld' ? welder : welder2;
        w.root.updateMatrixWorld();
        w.hand.getWorldPosition(sp.pts.position);
        sp.flash.position.copy(sp.pts.position);
        // schweißt in Schüben, nicht ununterbrochen
        const on = !reduceMotion && Math.sin(t * (role === 'weld' ? 0.9 : 1.3) + i) > -0.2;
        sp.update(Math.min(dt, 0.05), on);
      } else if (role === 'tablet') {
        // steht am Bug, schaut abwechselnd aufs Tablet und zum Schiff
        w.root.position.copy(polar(L.R + 1.5, DOOR_ANGLE + Math.PI + 0.35));
        w.root.lookAt(0, 0, 0);
        poseStand(w);
        w.shR.rotation.x = -0.9; w.elR.rotation.x = -0.9; w.shL.rotation.x = -0.7; w.elL.rotation.x = -1.0;
        w.neck.rotation.x = reduceMotion ? 0.4 : 0.25 + 0.25 * Math.sin(t * 0.4);
        w.neck.rotation.y = reduceMotion ? 0 : 0.4 * Math.sin(t * 0.23);
      } else if (role === 'hammer') {
        w.root.position.copy(props.crates.position).add(v.set(Math.sin(props.crates.rotation.y), 0, Math.cos(props.crates.rotation.y)).multiplyScalar(-1.2));
        w.root.rotation.y = props.crates.rotation.y;
        poseStand(w);
        w.body.rotation.x = 0.35; w.hipL.rotation.x = w.hipR.rotation.x = -0.3; w.knL.rotation.x = w.knR.rotation.x = 0.5; w.body.position.y = 0.88;
        const k = reduceMotion ? 0 : Math.pow(Math.max(0, Math.sin(t * 3.0)), 3);
        w.shR.rotation.x = -2.2 + k * 1.4; w.elR.rotation.x = -0.6;
        w.shL.rotation.x = -0.8;
      }
    });
    // Schlepper
    const td = reduceMotion ? 0 : t * 2.4;
    const yaw = L.tugRun.at(td, tmp);
    tugV.position.copy(tmp); tugV.rotation.y = yaw;
    tugV.userData.beacon.material.color.setHex(Math.sin(t * 8) > 0 ? 0xff8a1f : 0x331a05);
    // Drohne: Kreisbahn über dem Rumpf, tastet ihn ab
    const da = reduceMotion ? 0.8 : t * 0.25;
    const dr0 = Math.max(L.shipLen * 0.45, 4);
    dr.g.position.set(Math.sin(da) * dr0, L.shipTop + 1.5 + (reduceMotion ? 0 : Math.sin(t * 1.3) * 0.3), Math.cos(da) * dr0);
    dr.g.rotation.y = da + Math.PI / 2;
    dr.rotors.forEach((r) => { r.rotation.y += dt * 60; });
    dr.blink.visible = Math.sin(t * 6) > 0.6;
    const sh = L.shipTop + 1.5;
    dr.scan.scale.set(sh * 0.35, sh, sh * 0.35);
    dr.scan.position.y = -sh / 2;
    dr.scan.material.opacity = reduceMotion ? 0.02 : 0.012 + 0.014 * (0.5 + 0.5 * Math.sin(t * 2));
    // Kran fährt langsam hin und her, Haken pendelt sanft
    const cz = reduceMotion ? 0 : Math.sin(t * 0.05) * HALL_R * L.S * 0.6;
    crane.children[0].position.set(0, 0, cz);
    const tx = reduceMotion ? 0 : Math.sin(t * 0.08) * HALL_R * L.S * 0.5;
    trolley.position.set(tx, -0.9, cz);
    // kurzes Seil: der Haken hängt hoch, nie quer durchs Bild vor dem Schiff
    const ropeLen = Math.min(4 * L.S, Math.max(2, (HALL_H * L.S - 3) - L.shipTop - 4));
    rope.scale.y = ropeLen; rope.position.set(tx, -1.2 - ropeLen / 2, cz);
    hook.position.set(tx + (reduceMotion ? 0 : Math.sin(t * 0.7) * 0.15), -1.4 - ropeLen, cz);
  }

  return { layout, update, root, crane, props, tug: tugV, drone: dr.g, setCrew, isRigged: () => rigged };
}

// Hüllquader ohne Ausreißer: manche Modelle tragen einzelne Splitter weit
// abseits des Rumpfs (Exportreste). Ein strenger Quader liesse das Schiff
// darum über der Plattform schweben; gezählt wird deshalb vom 0,5. bis zum
// 99,5. Perzentil je Achse.
function robustBox(root) {
  const xs = [], ys = [], zs = [], v = new THREE.Vector3();
  root.traverse((n) => {
    const pos = n.isMesh && n.geometry.attributes.position;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 40000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
      xs.push(v.x); ys.push(v.y); zs.push(v.z);
    }
  });
  if (!xs.length) return new THREE.Box3().setFromObject(root);
  const q = (a) => {
    a.sort((p, r) => p - r);
    return [a[Math.floor(a.length * 0.005)], a[Math.ceil(a.length * 0.995) - 1]];
  };
  const [x0, x1] = q(xs), [y0, y1] = q(ys), [z0, z1] = q(zs);
  return new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
}

function disposeObject(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) [].concat(n.material).forEach((m) => m.dispose());
  });
}

export async function initHangar(container, opts = {}) {
  const reduceMotion = !!opts.reduceMotion;
  const W = () => container.clientWidth || 1;
  const H = () => container.clientHeight || 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080b);
  scene.fog = new THREE.Fog(0x07080b, 40, 110);
  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;

  const { hall, anim } = buildHall(reduceMotion);
  scene.add(hall);
  const floorTex = floorTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6, metalness: 0.35, color: 0xb8bcc6 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // Licht: Himmel, Hauptstrahler mit Schatten, warmes Gegenlicht, Fülllicht.
  // decay 0: die Halle wächst mit dem Schiff, die Helligkeit soll es nicht.
  const hemi = new THREE.HemisphereLight(0xc8d6ff, 0x1a1c22, 0.6);
  scene.add(hemi);
  const key = new THREE.SpotLight(0xffffff, 3.2, 0, Math.PI / 4.2, 0.5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xffb86b, 2.0, 0, Math.PI / 5, 0.6, 0);
  scene.add(rim, rim.target);
  const doorLight = new THREE.DirectionalLight(0x7fb0ff, 0.9);
  scene.add(doorLight, doorLight.target);
  const fill = new THREE.DirectionalLight(0x8fb4ff, 0.5);
  scene.add(fill);

  const life = buildLife(scene, reduceMotion);
  const dust = dustCloud();
  scene.add(dust.pts);

  const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 4000);
  let S = 1, span = 14;
  // camLimit: in der echten Halle darf die Kamera nicht durch die Wand
  let camLimit = Infinity;
  const wantDist = () => span * 1.45 * Math.min(2.2, Math.max(1, 1.3 / (W() / H()))) + 6;
  const homeDist = () => Math.min(camLimit, wantDist());
  // Passt ein großes Schiff (C2, Carrack) nicht mit Abstand in die Halle,
  // weitet sich der Blickwinkel, statt das Schiff anzuschneiden.
  const fitFov = () => {
    const d = wantDist();
    const fov = d > camLimit ? Math.min(64, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) * d / camLimit))) : 38;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  };
  const homePos = () => HOME_DIR.clone().multiplyScalar(homeDist()).add(controls.target);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // nie unter den Boden
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.5;
  camera.position.copy(homePos());
  controls.update();
  let idleTimer = 0, touched = false;
  controls.addEventListener('start', () => { touched = true; fly = null; controls.autoRotate = false; clearTimeout(idleTimer); });
  // Kamerafahrt statt Sprung: Ziel und Abstand gleiten, die Richtung läuft
  // auf der Kugel um das Schiff herum (nicht quer hindurch).
  let fly = null;          // { a: Spherical, b: Spherical, ta, tb, t0, dur }
  const sph = (pos, tgt) => new THREE.Spherical().setFromVector3(pos.clone().sub(tgt));
  function flyTo(tgt, pos, dur = 900) {
    if (reduceMotion) { controls.target.copy(tgt); camera.position.copy(pos); fly = null; return; }
    const a = sph(camera.position, controls.target), b = sph(pos, tgt);
    // kürzester Weg um die Hochachse
    const d = ((b.theta - a.theta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    b.theta = a.theta + d;
    fly = { a, b, ta: controls.target.clone(), tb: tgt.clone(), t0: performance.now(), dur };
  }
  const flyStep = (now) => {
    const k = Math.min(1, (now - fly.t0) / fly.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    controls.target.lerpVectors(fly.ta, fly.tb, e);
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(fly.a.radius, fly.b.radius, e),
      THREE.MathUtils.lerp(fly.a.phi, fly.b.phi, e),
      THREE.MathUtils.lerp(fly.a.theta, fly.b.theta, e));
    camera.position.setFromSpherical(s).add(controls.target);
    if (k >= 1) fly = null;
  };
  controls.addEventListener('end', () => {
    clearTimeout(idleTimer);
    if (!reduceMotion) idleTimer = setTimeout(() => { controls.autoRotate = true; }, 6000);
  });

  // Echte Halle: wird geladen, sobald die Bühne steht. room = Innenraum im
  // Modellraum (Bodenmitte, halbe Breite/Länge, Höhe).
  let realHall = null;     // { group, room }
  let lastInfo = null;
  // Maßstab der echten Halle: Originalgröße, solange Schiff samt Gerät
  // hineinpasst; das Gerät steht bis PAD_R*S + 9 m von der Mitte.
  // Dazu muss die Kamera im Umlauf drinbleiben: ihr waagrechter Abstand
  // (0,94 x Entfernung) bleibt unter 90 % der halben Breite, und der
  // Mindestabstand fürs ganze Schiff (span * 1.1 + 4) soll darin Platz haben.
  const camRoom = (room, k) => (0.9 * Math.min(room.halfW, room.halfL) * k) / 0.94;
  const realHallScale = (room) => Math.max(1, (PAD_R * S + 9) / room.halfW, (span * 1.15) / (2 * room.halfL),
    (span * 1.1 + 4) / camRoom(room, 1));

  // Halle, Licht, Nebel und Kamera auf die Schiffsgröße einstellen.
  function scaleWorld(shipInfo) {
    lastInfo = shipInfo;
    span = Math.max(shipInfo.len, shipInfo.halfW * 2, 6);
    S = Math.max(1, span / 16);
    hall.scale.setScalar(S);
    floor.scale.setScalar(HALL_R * S * 1.02);
    floorTex.repeat.set((HALL_R * S * 2) / 8, (HALL_R * S * 2) / 8); // Kachel 4 m (Textur = 2x2 Platten)
    scene.fog.near = HALL_R * S * 1.1; scene.fog.far = HALL_R * S * 3.2;
    if (realHall) {
      const k = realHallScale(realHall.room);
      realHall.group.scale.setScalar(k);
      // Kein Dunst im hellen Innenraum: erst die Stirnwände verschwimmen leicht.
      scene.fog.near = realHall.room.halfL * k * 1.2; scene.fog.far = realHall.room.halfL * k * 4;
    }
    key.position.set(9 * S, HALL_H * S * 0.92, 12 * S);
    key.target.position.set(0, shipInfo.height * 0.4, 0);
    key.shadow.camera.near = 4 * S; key.shadow.camera.far = 60 * S;
    key.shadow.camera.updateProjectionMatrix();
    rim.position.set(-12 * S, 12 * S, -14 * S); rim.target.position.set(0, shipInfo.height * 0.5, 0);
    doorLight.position.copy(polar(HALL_R * S, DOOR_ANGLE, HALL_H * S * 0.4));
    fill.position.set(-10 * S, 6 * S, 10 * S);
    camera.far = HALL_R * S * 6; camera.updateProjectionMatrix();
    controls.minDistance = Math.max(4, span * 0.45);
    controls.maxDistance = HALL_R * S * 0.95;
    camLimit = Infinity;
    if (realHall) {
      camLimit = camRoom(realHall.room, realHallScale(realHall.room));
      controls.maxDistance = Math.max(controls.minDistance, camLimit);
      camera.far = Math.max(realHall.room.halfL, realHall.room.height) * realHallScale(realHall.room) * 4;
      camera.updateProjectionMatrix();
    }
    fitFov();
    // Staub füllt den Raum um das Schiff bis über den Rumpf; Punktgröße in
    // Welteinheiten mitstrecken, sonst wird er bei großen Schiffen zu Sand.
    const dw = span * 1.3;
    dust.pts.scale.set(dw, shipInfo.height * 1.8 + 4, dw);
    dust.pts.material.size = 0.035 * Math.max(1, span / 14);
    life.layout(S, shipInfo);
  }

  const draco = new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Lampen der Halle aus dem Spiel (Licht-Entities des socpak, vom Build als
  // <halle>.lights.json neben das GLB gelegt). Fehlt die Datei, bleibt es beim
  // Bühnenlicht. Die stärksten MAX_LIGHTS kommen in die Szene, ohne Schatten:
  // jede Lampe kostet im Fragment-Shader, Schatten wirft weiter das Hauptlicht.
  const MAX_LIGHTS = 24;
  // Spielstärke -> three.js (physikalisch, Candela). Vorläufig; wird an der
  // ersten echten Lampenliste per Render abgeglichen.
  const HALL_LIGHT_SCALE = 40;
  function loadHallLights(h, model) {
    fetch(h.url.replace(/\.glb(\?.*)?$/, '.lights.json$1')).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const all = (d?.lights || []).filter((l) => Array.isArray(l.pos) && l.intensity > 0);
      if (!all.length) return;
      all.sort((a, b) => b.intensity * (b.radius || 1) - a.intensity * (a.radius || 1));
      const lamps = new THREE.Group();
      for (const l of all.slice(0, MAX_LIGHTS)) {
        const col = new THREE.Color().setRGB(...(l.color || [1, 1, 1]));
        const dist = l.radius || 0;
        const light = l.type === 'spot'
          ? new THREE.SpotLight(col, l.intensity * HALL_LIGHT_SCALE, dist, THREE.MathUtils.degToRad(Math.min(89, (l.angle || 60) / 2)), 0.5, 2)
          : new THREE.PointLight(col, l.intensity * HALL_LIGHT_SCALE, dist, 2);
        light.position.set(...l.pos);
        if (light.isSpotLight) {
          const dir = l.dir || [0, -1, 0];
          light.target.position.set(l.pos[0] + dir[0], l.pos[1] + dir[1], l.pos[2] + dir[2]);
          lamps.add(light.target);
        }
        lamps.add(light);
      }
      model.add(lamps);
      realHall.lamps = lamps;
      // Mit echten Lampen tritt das Bühnenlicht zurück, das Hauptlicht bleibt
      // für den Schatten unter dem Schiff.
      hemi.intensity *= 0.5; fill.intensity = 0; doorLight.intensity = 0;
      console.info(`[hangar] ${lamps.children.filter((c) => c.isLight).length} von ${all.length} Spiellampen gesetzt`);
    }).catch(() => { /* ohne Lampen weiter mit Bühnenlicht */ });
  }

  function loadRealHall(h) {
    loader.load(h.url, (gltf) => {
      const model = gltf.scene;
      const c = h.room.center;
      model.position.set(-c[0], -c[1], -c[2]);
      // Der begehbare Boden liegt im Modell nicht auf 0 (beim Deluxe-Hangar
      // knapp 1 m darüber) — sonst versinken Schiff, Gerät und Crew darin.
      // Senkrecht nach unten loten und den Boden auf 0 legen.
      model.updateMatrixWorld(true);
      const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), ys = [];
      for (const [x, z] of [[0, 0], [6, 4], [-6, -4], [4, -8], [-8, 6], [10, 10], [-10, -10]]) {
        rc.set(new THREE.Vector3(x, 3, z), down);
        const hit = rc.intersectObject(model, true)[0];
        if (hit) ys.push(hit.point.y);
      }
      if (ys.length >= 3) {
        ys.sort((a, b) => a - b);
        model.position.y -= ys[Math.floor(ys.length / 2)];
      }
      const uvStats = hallUvStats(model);
      const boxed = new Set();
      model.traverse((n) => {
        if (!n.isMesh) return;
        // Editor-Raster (grau-gelbes Platzhaltergitter) liegt als Deckel
        // unter der echten Decke und verdeckt sie; im Spiel unsichtbar.
        if ([].concat(n.material).every((m) => /grid_grayyellow/i.test(m.name))) { n.visible = false; return; }
        n.receiveShadow = true;
        n.castShadow = false;
        for (const m of [].concat(n.material)) {
          // Weißer Innenraum: die Reflexe der Ersatzhalle dämpfen. Spiegelndes
          // Metall (Bodenplatten, Verkleidung) spiegelte sie sonst als flache
          // blaue Flächen, glatter Kunststoff als Gleißen.
          // Die Ersatzhalle als Umgebung macht den Raum gleichmäßig hell:
          // in der echten Halle fast ganz zurücknehmen, Licht kommt von den Lampen.
          m.envMapIntensity = 0.05;
          // Die Lackschichten der Halle liefern reinweiße Grundfarben, die
          // im Spiel erst Tönung und Schmutz abdunkeln: ohne das ist jede
          // Wand ein Leuchtkasten.
          if (!m.transparent && !m.emissiveMap && m.color) m.color.multiplyScalar(/white|plastic|marble/i.test(m.name) ? 0.58 : 0.78);
          if (/metal_grey/i.test(m.name)) {
            // Bodenplatten: gebürstetes Stahlgrau statt der hellen Glanzkarte,
            // die der Export als Farbe liefert; spiegelt ein wenig die Halle.
            m.color.multiplyScalar(0.5); m.metalness = 0.7; m.roughness = m.roughnessMap ? 1 : 0.42; m.envMapIntensity = 0.45;
          } else if (m.metalness > 0.4) { m.metalness = 0.4; if (!m.roughnessMap) m.roughness = Math.max(m.roughness, 0.45); }
          else if (!m.roughnessMap) m.roughness = Math.max(m.roughness, 0.65);
          // Rauheit aus der Glätte des Spiels: die Karte entscheidet, der
          // Faktor darf sie nicht pauschal stumpf machen.
          if (m.roughnessMap) {
            m.roughness = Math.max(m.roughness, 1);
            // Nur nach unten begrenzen: spiegelglatte Stellen bündeln das
            // Hauptlicht sonst zu einem gleißenden Fleck vor dem Schiff.
            m.onBeforeCompile = (sh) => {
              sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = max(roughnessFactor, 0.34);');
            };
            m.customProgramCacheKey = () => 'hall-rough-min';
          }
          // Leuchtleisten und Lampen sollen leuchten, nicht nur hell sein.
          // Nicht alle bringen ihre Leuchtkarte mit: dann leuchtet die Farbkarte.
          if (/light|glow/i.test(m.name) && !/glass/i.test(m.name) && m.map) {
            m.emissive.set(0xffffff); m.emissiveMap = m.emissiveMap || m.map; m.emissiveIntensity = 5;
          } else if (m.emissiveMap) m.emissiveIntensity = 4;
          for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = maxAniso;
          const us = uvStats.get(m);
          if (us && us.share > 0.4 && !boxed.has(m) && !/decal|logo|glow|leak/i.test(m.name)) { boxProject(m, us.mPerUv); boxed.add(m); }
        }
      });
      if (boxed.size) console.info(`[hangar] ${boxed.size} Hallenmaterialien projiziert (UVs zerfallen)`);
      const group = new THREE.Group();
      group.add(model);
      scene.add(group);
      realHall = { group, room: h.room };
      loadHallLights(h, model);
      // die gebaute Halle weicht; Gerät, Crew, Schlepper und Drohne bleiben
      hall.visible = false;
      floor.visible = false;
      life.crane.visible = false;
      // gemalte Behälter wirken vor echten Wänden wie Spielzeug
      // Nur Spielinhalte in der echten Halle: alles selbst Gebaute weicht
      for (const p of Object.values(life.props)) p.visible = false;
      life.tug.visible = false;
      life.drone.visible = false;
      // Schwebender Staub ist selbst gebaut und liest sich vor den hellen
      // Wänden als weiße Pixelfehler
      dust.pts.visible = false;
      scene.background = new THREE.Color(0x9aa0a8);
      scene.fog.color.set(0x9aa0a8);
      // Bühnenlicht statt Raumlicht: das Schiff steht im Lichtkegel, die Halle
      // tritt zurück — sonst ist das helle Innere eine einzige weiße Fläche.
      // Bodenfarbe der Halbkugel = Rücklicht vom hellen Boden: Ohne sie
      // bleibt die nach unten gewandte Decke ein schwarzes Loch.
      hemi.color.set(0xffefdc); hemi.groundColor.set(0x8a8178);
      hemi.intensity = 0.35;
      key.intensity = 8; key.angle = 0.5; key.penumbra = 0.75;
      rim.intensity = 3;
      doorLight.intensity = 0.3;
      fill.intensity = 0.2;
      renderer.toneMappingExposure = 0.9;
      enableAO();
      if (current) { current.group.userData.baseY = 0.02; }
      if (lastInfo) scaleWorld(lastInfo);
      // die Kamera stand womöglich für die gebaute (größere) Halle
      if (fly) fly.b.radius = Math.min(fly.b.radius, homeDist());
      else if (!touched) camera.position.copy(homePos());
      else camera.position.sub(controls.target).clampLength(controls.minDistance, controls.maxDistance).add(controls.target);
    }, undefined, () => { /* gebaute Halle bleibt stehen */ });
  }

  // Umgebungsverdeckung (GTAO) nur in der echten Halle: erst sie setzt
  // Ecken, Fugen und den Boden unter dem Schiff ab. Nachgeladen, damit die
  // gebaute Halle ohne die Zusatzpässe auskommt.
  let composer = null;
  async function enableAO() {
    if (composer || !renderer.capabilities.isWebGL2) return;
    try {
      const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/GTAOPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]);
      // Eigenes Ziel mit 4-fach-MSAA: der Composer umgeht sonst die
      // Kantenglättung des Renderers, und jede Kante treppt.
      const rt = new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, samples: 4 });
      const c = new EffectComposer(renderer, rt);
      c.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      c.setSize(W(), H());
      c.addPass(new RenderPass(scene, camera));
      const ao = new GTAOPass(scene, camera, W(), H());
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 1;
      ao.updateGtaoMaterial({ radius: 2.5, distanceExponent: 1.4, thickness: 2, scale: 1.2, samples: 16 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      c.addPass(ao);
      // Lichtschein um Lampen, Leuchtleisten und Triebwerke: nur was
      // deutlich heller als Weiß ist, damit helle Wände nicht mitglühen.
      c.addPass(new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.25, 0.35, 6));
      c.addPass(new OutputPass());
      composer = c;
    } catch { /* ohne Verdeckung weiter */ }
  }

  let current = null;      // { group, born, mat, info }
  let leaving = null;      // { group, t0, c }
  let token = 0;
  let progressFn = null;
  let liveryKey = 'werk';
  let makerCode = '';
  const fade = { from: null, to: null, t0: 0 };

  function paintFor(maker, key) {
    const lv = LIVERIES[key] || LIVERIES.werk;
    const cols = lv.colors || MAKER_PAINT[maker] || DEFAULT_PAINT;
    return { cols: cols.map((c) => new THREE.Color(c)), pattern: lv.pattern };
  }
  function applyPaint(mat, p) {
    const u = mat.userData.u;
    u.uPrim.value.copy(p.cols[0]); u.uSec.value.copy(p.cols[1]); u.uAcc.value.copy(p.cols[2]);
    u.uPattern.value = p.pattern;
  }

  const fetchGltf = (url) => new Promise((resolve, reject) => {
    loader.load(url, resolve, (e) => {
      if (!progressFn) return;
      progressFn(e.total ? Math.round((e.loaded / e.total) * 100) : Math.min(99, Math.round(e.loaded / 4000)));
    }, reject);
  });

  async function show(url, o = {}) {
    const my = ++token;
    makerCode = o.maker || '';
    // Echter Lack, wenn es ihn gibt; scheitert er, die Geometrie-Fassung.
    let gltf = null, textured = false;
    if (o.tex) {
      try { gltf = await fetchGltf(o.tex); textured = true; } catch { gltf = null; }
      if (my !== token) { if (gltf) disposeObject(gltf.scene); return; }
    }
    if (!gltf) gltf = await fetchGltf(url);
    if (my !== token) { disposeObject(gltf.scene); return; }   // überholt

    const model = gltf.scene;
    const mat = paintMaterial();
    const hull = [];       // [mesh, Originalmaterial] — Rumpfteile, die der Shader-Lack übermalen darf
    model.traverse((n) => {
      if (!n.isMesh) return;
      n.castShadow = true;
      n.receiveShadow = true;
      if (textured) {
        const m = n.material;
        // POM-Decals sind im Spiel reine Relief-Schichten über dem Rumpf
        // (Nieten, Plattenkanten), deren Farbbild nie sichtbar ist. Als
        // eigene Fläche gezeichnet, liegen sie als weiße Splitter auf dem Lack.
        if (/(^|_)pom(_|$)|pom_?decal/i.test(m.name || '')) { n.visible = false; return; }
        // Schichtmaterialien, die der Export nicht auflösen konnte, kommen
        // ohne Bild und tiefschwarz an — als Loch im Rumpf. Dunkles Metall
        // ist im Spiel fast immer, was dort sitzt.
        if (!m.map && m.color.r + m.color.g + m.color.b < 0.06) {
          m.color.setHex(0x3a3d42); m.metalness = 0.6; m.roughness = 0.45;
        }
        m.envMapIntensity = 0.9;
        for (const t of [m.map, m.normalMap, m.emissiveMap]) if (t) t.anisotropy = maxAniso;
        if (!m.transparent) hull.push([n, m]);
        return;
      }
      n.material.dispose();
      n.material = mat;
      // Neu gerechnete Normalen: die mitgelieferten sind nach der Dezimierung
      // bei Großschiffen (Polaris, Idris) fleckig.
      n.geometry.computeVertexNormals();
    });
    // Die Achsdrehung Z-oben -> Y-oben steckt schon im Knoten der .glb.
    // Bug in -Z, die Startansicht kommt von +Z: einmal umdrehen, damit der
    // Besucher dem Schiff ins Gesicht schaut und das Tor dahinter liegt.
    const turn = new THREE.Group();
    turn.rotation.y = Math.PI;
    turn.add(model);
    const wrap = new THREE.Group();
    wrap.add(turn);
    wrap.updateMatrixWorld(true);
    const box = robustBox(wrap);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    wrap.position.set(-center.x, -box.min.y, -center.z);
    // Lack-Uniforms im Objektraum des Modells (Z oben, Meter)
    const u = mat.userData.u;
    u.uZ.value.set(box.min.y, box.max.y);
    u.uHalfW.value = size.x / 2;
    u.uPanel.value = THREE.MathUtils.clamp(Math.max(size.x, size.z) / 14, 1.2, 9);
    applyPaint(mat, paintFor(makerCode, liveryKey));

    const ship = new THREE.Group();
    ship.add(wrap);
    const info = { len: size.z, halfW: size.x / 2, height: size.y };
    scaleWorld(info);
    // auf der gebauten Plattform schwebt es knapp darüber, in der echten Halle steht es
    ship.userData.baseY = realHall ? 0.02 : 0.3 * S + 0.25;
    ship.position.y = ship.userData.baseY;
    const tgt = new THREE.Vector3(0, Math.max(1.2, size.y * 0.45 + 0.3), 0);
    if (!touched) {
      const pos = HOME_DIR.clone().multiplyScalar(homeDist()).add(tgt);
      if (current) flyTo(tgt, pos); else { controls.target.copy(tgt); camera.position.copy(pos); }
    } else {
      // vom Nutzer gewählter Blick bleibt, nur der Abstand passt sich an
      const off = camera.position.clone().sub(controls.target);
      const r = THREE.MathUtils.clamp(off.length() * Math.max(0.6, Math.min(1.6, span / Math.max(1, current?.info.len ?? span))), controls.minDistance, controls.maxDistance);
      flyTo(tgt, off.setLength(r).add(tgt), 700);
    }

    if (leaving) { scene.remove(leaving.group); release(leaving.c); leaving = null; }
    if (current) { leaving = { group: current.group, t0: performance.now(), c: current, y0: current.group.position.y, r0: current.group.rotation.y }; }
    scene.add(ship);
    current = { group: ship, born: performance.now(), mat, info, hull: textured ? hull : null };
    if (textured) wearPaint(current, liveryKey !== 'werk');
    if (progressFn) progressFn(100);
  }

  // Echter Lack <-> Shader-Lack auf dem Rumpf eines texturierten Schiffs.
  function wearPaint(c, on) {
    for (const [n, orig] of c.hull) n.material = on ? c.mat : orig;
  }
  // Ein Schiff freigeben — samt der Materialien, die gerade nicht hängen.
  function release(c) {
    if (c.hull) {
      wearPaint(c, false);
      // texturierte Fassung: ~200 Bilder je Schiff, die sonst im Grafikspeicher blieben
      c.group.traverse((n) => {
        if (n.material) for (const m of [].concat(n.material)) for (const t of [m.map, m.normalMap, m.emissiveMap, m.aoMap, m.roughnessMap, m.metalnessMap]) t?.dispose();
      });
    }
    c.mat.dispose();
    disposeObject(c.group);
  }

  function setLivery(k) {
    if (!LIVERIES[k]) return;
    liveryKey = k;
    if (!current) return;
    if (current.hull) wearPaint(current, k !== 'werk');
    const p = paintFor(makerCode, k);
    const u = current.mat.userData.u;
    fade.from = [u.uPrim.value.clone(), u.uSec.value.clone(), u.uAcc.value.clone()];
    fade.to = p; fade.t0 = performance.now();
    u.uPattern.value = p.pattern;
    if (reduceMotion) { applyPaint(current.mat, p); fade.to = null; }
  }

  function resetView() {
    touched = false;
    flyTo(controls.target.clone(), homePos());
    if (!reduceMotion) controls.autoRotate = true;
  }

  const clock = new THREE.Clock();
  let raf = 0, visible = true, last = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, t - last); last = t;
    const now = performance.now();
    for (const f of anim) f(t);
    life.update(dt, t);
    if (!reduceMotion) dust.update(t);
    if (current) {
      const g = current.group;
      // Einfahrt: senkt sich aus der Höhe auf die Plattform und dreht ein,
      // setzt weich auf (ease-out quint), solange das alte noch abhebt
      const k = reduceMotion ? 1 : Math.min(1, Math.max(0, now - current.born - 120) / 1100);
      const e = 1 - Math.pow(1 - k, 5);
      g.position.y = g.userData.baseY + (reduceMotion || realHall ? 0 : 0.03 * span * Math.sin(t * 1.1) * 0.3) + (1 - e) * span * 0.18;
      g.rotation.y = (1 - e) * -0.45;
      g.visible = reduceMotion || now - current.born > 60;
      if (fade.to) {
        const f = Math.min(1, (now - fade.t0) / 450);
        const u = current.mat.userData.u;
        u.uPrim.value.copy(fade.from[0]).lerp(fade.to.cols[0], f);
        u.uSec.value.copy(fade.from[1]).lerp(fade.to.cols[1], f);
        u.uAcc.value.copy(fade.from[2]).lerp(fade.to.cols[2], f);
        if (f >= 1) fade.to = null;
      }
    }
    if (leaving) {
      // Ausfahrt: hebt ab (ease-in) und dreht weg, ohne zu schrumpfen
      const k = reduceMotion ? 1 : Math.min(1, (now - leaving.t0) / 520);
      const e = k * k * k;
      leaving.group.position.y = leaving.y0 + e * (leaving.c.info.height + span * 0.9);
      leaving.group.rotation.y = leaving.r0 + e * 0.35;
      if (k >= 1) { scene.remove(leaving.group); release(leaving.c); leaving = null; }
    }
    if (fly) flyStep(now);
    controls.update();
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  scaleWorld({ len: 14, halfW: 6, height: 4 });
  if (opts.hall?.url && opts.hall.room) loadRealHall(opts.hall);
  if (opts.crew?.url) loader.load(opts.crew.url, (g) => life.setCrew(g.scene), undefined, () => { /* gebaute Arbeiter bleiben */ });
  frame();

  const ro = new ResizeObserver(() => {
    renderer.setSize(W(), H());
    composer?.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    fitFov();
    if (!touched) camera.position.sub(controls.target).setLength(homeDist()).add(controls.target);
  });
  ro.observe(container);
  const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; });
  io.observe(container);
  const onVis = () => { visible = !document.hidden; };
  document.addEventListener('visibilitychange', onVis);

  return {
    show,
    setLivery,
    resetView,
    onProgress(fn) { progressFn = fn; },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      controls.dispose();
      disposeObject(scene);
      envRT.dispose();
      composer?.dispose();
      draco.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
