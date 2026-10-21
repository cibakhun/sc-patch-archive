// Hangar-Bühne: EIN Schiff steht auf einer Landeplattform in einer belebten
// Halle, der Besucher dreht es frei und wechselt über das Karussell der
// Seite (components/hangar/HangarPage.astro, Szene in HangarApp.astro). Gegenstück zu holo-viewer.js:
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
// hall.id wählt in HALL_DROP die Spielteile, die der Viewer beim Laden aus
// der Halle schneidet (ohne id: keine). hall.furniture sind die Möbel als
// eigene Datei im selben Modellraum; das Telefon lädt sie nicht, dort bringt
// hall.patch nur Ergänzung und Füllung (siehe swapHallDetail). hall.lift ist
// der Schachtbausatz unter dem Schiffsfeld (HALL_SHAFT) samt Lampenliste.
// hall.workshop bringt Gerät und Boden-Decals aus anderen Spielhallen samt
// deren Anordnung um das Landefeld (placeWorkshop).
//
// CREW: liegt ein Crew-Modell vor (opts.crew), stehen echte Figuren statt
// der gebauten Arbeiter an den Arbeitsplätzen.
//
// API:  initHangar(container, { reduceMotion, hall?: { id, url, room, floor?, bytes?, lights?, probes?, lite?: { url, bytes? }, furniture?: { url, bytes? }, patch?: { url, bytes? }, lift?: { url, json, bytes? }, workshop?: { url, json, bytes?, boden?: { url, bytes? } } }, crew?: { url }, sound?: false }) -> Promise<{
//         show(url, { maker, tex? }) -> Promise<void>, setLivery(key), fit([{ port, item, url }]) -> Promise<n>,
//         paint({ cols, base } | null) -> n, setSound(on), sound() -> { on, can },
//         resetView(), onProgress(fn), dispose(),
//         project(points) -> [{ x, y, d } | null], focus(point | null), setCover(px), onFrame(fn) }>
// project/focus/setCover/onFrame sind die Naht zur Oberfläche um die Szene
// (Hardpoint-Marker der Ausstattungs-Tabs, src/components/hangar/): Punkte im
// Modellraum der .glb, siehe .planning/notes/hangar-naht.md.
// three.js liegt selbst gehostet unter /vendor/three (Import-Map der Seite).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── Bildlook ─────────────────────────────────────────────────────────────
// 20.10.2026, Krisz: „besseres licht (nicht mehr, qualitativ besser also
// künstlerisch qualitativ) colorgrading“. Die Kurve bleibt ACES (three), so
// hell und so tief wie bisher: AgX (Blender) lief im Vergleich an derselben
// Rohaufnahme der Halle flau, die Tiefen grau, das Schiff blass. Darauf ein
// Look (LOOK) im wahrnehmungsnahen Raum (Gamma 2,2), wie ein Coloristen-Pass:
// Tiefen einen Hauch kühl, Lichter einen Hauch warm (warmes Hallenlicht,
// kalter Schacht), etwas mehr Sättigung in Tiefen und Mitten (Lack, Gelb der
// Geräte; zum Weiß hin aus, damit der helle Boden nicht gelb wird) und eine
// sanfte S-Kurve für Tiefe. Gestimmt an einer Rohaufnahme der Halle (Stufe
// hoch, Belichtung als Log-Bild) gegen das bisherige Bild: mittlere
// Helligkeit 0,468 → 0,462, Sättigung 0,016 → 0,038.
// Gilt für die Nachbearbeitung (OutputPass) und für die Stufen ohne sie
// (Tonabbildung im Material) gleich: three ruft CustomToneMapping.
// exposure: Faktor vor der Kurve (1 = toneMappingExposure allein);
// slope/offset/power wie ASC CDL je Kanal (R, G, B), sat Sättigung um die
// Helligkeit, curve Anteil der S-Kurve; shadow/high: Tönung der Tiefen und
// Lichter (Faktoren, nach der Abbildung), balance: Helligkeit (0..1), an der
// beide sich treffen. Alle neutral (1, 0, 1, 1, 0, 1, 1) ergibt genau ACES.
const LOOK = /* hall-look */ { "exposure": 1, "slope": [1.02, 1, 0.98], "offset": [-0.01, -0.005, 0.01], "power": [1, 1, 1], "sat": 1.2, "curve": 0.18, "shadow": [0.95, 1, 1.06], "high": [1.02, 1, 0.97], "balance": 0.35 } /* /hall-look */;
const v3 = (a) => `vec3( ${a.map((x) => Number(x).toFixed(4)).join(', ')} )`;
const f1 = (x) => Number(x).toFixed(4);
const LOOK_GLSL = /* glsl */ `
vec3 CustomToneMapping( vec3 color ) {
  color = ACESFilmicToneMapping( color * ${f1(LOOK.exposure)} );
  vec3 g = pow( color, vec3( 1.0 / 2.2 ) );
  g = pow( max( g * ${v3(LOOK.slope)} + ${v3(LOOK.offset)}, vec3( 0.0 ) ), ${v3(LOOK.power)} );
  float y = dot( g, vec3( 0.2126, 0.7152, 0.0722 ) ), w = clamp( ( y - 0.6 ) / 0.4, 0.0, 1.0 );
  g = y + ( 1.0 + ${f1(LOOK.sat - 1)} * ( 1.0 - w * w ) ) * ( g - y );
  g += ${f1(LOOK.curve)} * ( g * g * ( 3.0 - 2.0 * g ) - g );
  color = pow( clamp( g, 0.0, 1.0 ), vec3( 2.2 ) );
  y = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
  return clamp( color * mix( ${v3(LOOK.shadow)}, ${v3(LOOK.high)}, smoothstep( 0.0, ${f1(2 * LOOK.balance)}, sqrt( y ) ) ), 0.0, 1.0 );
}`;
const LOOK_HOOK = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
const LOOK_ON = THREE.ShaderChunk.tonemapping_pars_fragment.includes(LOOK_HOOK);
if (LOOK_ON) THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(LOOK_HOOK, LOOK_GLSL);
else console.warn('[hangar] Bildlook: Einhängepunkt fehlt (three.js geändert?), ACES bleibt');

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
// Aufzug (HALL_LIFT): Fahrzeiten ab und auf; Tiefe des Felds unten, in
// Modellmetern der Halle unter dem Schiffsboden. Im Schacht wird es mit der
// Tiefe dunkel, ab LIFT_DARK fast schwarz; die Leuchtstreifen des Felds und
// die Lichter am Schiff leuchten weiter.
const LIFT_DOWN_MS = 1900;
const LIFT_UP_MS = 2800;
const LIFT_DEPTH = 26;
const LIFT_DARK = 22;
const liftShade = (d) => 1 - 0.92 * THREE.MathUtils.smoothstep(d, 0.5, LIFT_DARK);
// Schachtlampen aus dem Spiel (HALL_SHAFT): Stärke der Spiellampen auf
// unsere Lichtskala, Einschalten bei Fahrtbeginn, Wirkung auf Schiff und
// Crew (deren Abdunkelung nimmt das Licht an ihrer Stelle zurück)
const PIT_GAIN = 30;
const PIT_FADE_MS = 300;
const PIT_SHIP = 1.5;
// Lichtregie im Schacht während der Fahrt (eigene Inszenierung auf den
// Spielteilen, Farben aus den Spiellampen). Kalt gegen die warme Halle:
// Dunst in der Farbe der Nebellampe des Spiels, der über der Plattform
// dicht liegt und nach oben ausdünnt, so verlieren sich die Wände zur
// Plattform hin; ein Grundlicht in zwei Farben (von oben ein Rest des
// Hallenlichts, von unten das Blau), damit Rippen und Kanten der fast
// schwarzen Wände ihre Form zeigen, dazu ein Kantenlicht; die Lampen des
// Schachts auf dem hellen Feld schwächer als auf den Wänden, damit die
// Plattform eine warme Bühne bleibt und nicht ausbrennt. Die orangen
// Warnlichter färben den Dunst im Takt, ein Lauflicht in ihrem Orange
// zieht knapp über der Plattform rundum die Wände entlang und fährt mit,
// die Fluter stehen als Lichtkegel im Dunst. Abgestimmt an Bildern der
// Fahrt (16.10.2026), steil von oben und schräg.
const SHAFT_HAZE = [0.227, 0.584, 1];
const SHAFT_SPILL = [0.5, 0.39, 0.28];   // Hallenlicht aus der Öffnung (warm)
const SHAFT_FILL = 2;            // Grundlicht auf die Wände
const SHAFT_FILL_FIELD = 0.08;   // davon auf das Feld
const SHAFT_FIELD = 0.55;        // Schachtlampen auf dem Feld (auf den Wänden 1)
const SHAFT_HAZE_K = 0.006;      // Dunst je Meter Blickweg, überall im Schacht
const SHAFT_HAZE_LAYER = 0.07;   // dazu je Meter in der Schicht über der Plattform
const SHAFT_HAZE_H = 8;          // Höhe dieser Schicht (auf 1/e)
const SHAFT_HAZE_MAX = 0.6;      // höchstens so viel Dunst
const SHAFT_HAZE_LUM = 0.08;     // Helligkeit des Dunsts (linear)
const SHAFT_HAZE_WARN = 0.03;    // Orange der Warnlichter im Dunst, im Takt
const SHAFT_RIM = 0.03;          // Kantenlicht der Wände (Dunst gespiegelt)
const SHAFT_RUN = [1, 0.171, 0]; // Lauflicht: Farbe der Warnlampen
const SHAFT_RUN_GAIN = 9;
const SHAFT_RUN_SPEED = 16;      // m/s rundum
const SHAFT_RUN_GAP = 12;        // m zwischen den Lichtpunkten
const SHAFT_BEAM = 0.09;         // Lichtkegel der Fluter
const SHAFT_TINT = [0.82, 0.92, 1.06];   // Schiff und Crew tief im Schacht: kühler

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

// Rechnen in Häppchen (15.10.2026): Die Aufbereitung beim Laden (Halle,
// Schiffsmaße, Crew, Lichtgitter) hielt den Hauptfaden am Stück an, allein
// die Halle 1,4 s (Desktop), auf schwachen Geräten das Drei- bis Vierfache:
// die Seite fror ein. Die langen Schleifen rufen dafür zwischen ihren Teilen
// und alle 16 384 Ecken bzw. Dreiecke `await pause()`; pause gibt dem
// Browser das Wort, sobald seit dem letzten Mal `ms` Rechenzeit vergangen
// sind. Ohne pause (Vorgabe) am Stück.
const noPause = async () => {};
function slicer(ms, yieldFn) {
  let t = performance.now();
  return async () => {
    if (performance.now() - t < ms) return;
    await yieldFn();
    t = performance.now();
  };
}
const nextTask = () => new Promise((r) => setTimeout(r, 0));

// Eingebettete Bilder direkt und Bild für Bild (15.10.2026). GLTFLoader
// macht aus jedem Bild einer GLB Blob, Objekt-URL und fetch, alle im selben
// Zug, sobald die Datei da ist: beim Schiff 188 Bilder, bei vierfach
// gedrosselter CPU ein Block von 1 s, in der Halle noch zwei. Hier geht der
// Blob ohne URL und fetch an createImageBitmap (dekodiert wie zuvor außerhalb
// des Hauptfadens, Optionen wie ImageBitmapLoader), eins nach dem anderen
// über alle Dateien; nach `ms` Rechenzeit ist der Browser dran. Bilder mit
// URI und Browser ohne ImageBitmap gehen den Weg des Loaders.
function embeddedImages(ms) {
  const pause = slicer(ms, nextTask);
  let turn = Promise.resolve();
  return (parser) => {
    const load = parser.loadImageSource.bind(parser);
    parser.loadImageSource = (i, loader) => {
      const def = parser.json.images[i];
      if (parser.sourceCache[i] !== undefined || def.bufferView === undefined || !loader.isImageBitmapLoader) return load(i, loader);
      const go = (turn = turn.then(pause));
      const p = go
        .then(() => parser.getDependency('bufferView', def.bufferView))
        .then((view) => createImageBitmap(new Blob([view], { type: def.mimeType }), { ...loader.options, colorSpaceConversion: 'none' }))
        .then((bitmap) => {
          const t = new THREE.Texture(bitmap);
          t.needsUpdate = true;
          if (def.extras && typeof def.extras === 'object') Object.assign(t.userData, def.extras);
          t.userData.mimeType = def.mimeType;
          return t;
        });
      parser.sourceCache[i] = p;
      return p;
    };
    return { name: 'hg_embedded_images' };
  };
}

// Spielteile, die in der Halle nicht stehen sollen, je Halle (Schlüssel wie
// in hangar-assets.json) und je Teil mit Anlass. Die Halle kommt nach
// Material zusammengelegt, ein Knoten je Material: Ein einzelnes Teil lässt
// sich nicht ausblenden, nur aus den Dreiecken schneiden. Es fällt nur, was
// als ganzes Teil (gemeinsame Ecken auf 5 mm) in `reach` liegt und mit
// mindestens einer Ecke in `seen` (im Raum, nicht hinter der Wand). Reicht
// ein Teil über `reach` hinaus (Boden, Wand, Galerie), bleibt es ganz;
// so entsteht kein Loch, und jede Baustufe der Halle trifft dieselbe Regel.
// Modellraum der Halle (glTF-Achsen, Meter). Der Block ist JSON:
// verify:hangar-hall liest ihn aus dem ausgelieferten Viewer und prüft am
// ausgelieferten GLB, dass jeder Eintrag noch mindestens `min` Dreiecke
// trifft, sonst ist er ein Zombie.
const HALL_DROP = /* hall-drop */ {
  "revelyork-single": [
    {
      "why": "Ausgangs-Wandstück (Trennwand mit Türrahmen, Leitungen und zwei Stangen bis unter die Galerie) stand frei vor der Stirnwand; Betreiber am 08.10.2026: „random zeug, kann weg“",
      "reach": [[27.9, 0.9, -20.1], [29.5, 17.2, 4.1]],
      "seen": [[27.9, 0.9, -20.1], [29.5, 17.2, -1.5]],
      "min": 5000
    }
  ]
} /* /hall-drop */;

// Schneidet die Teile eines HALL_DROP-Eintrags aus den Indexpuffern der
// Halle, vor dem Hochladen. Liefert je Eintrag { why, tris, parts }.
async function dropHallParts(model, list, pause = noPause) {
  const out = [];
  if (!list?.length) return out;
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const meshes = [], uses = new Map();
  model.traverse((n) => {
    if (!n.isMesh || !n.geometry.index) return;
    meshes.push(n);
    uses.set(n.geometry, (uses.get(n.geometry) || 0) + 1);
  });
  const M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), v = new THREE.Vector3();
  const bb = new THREE.Box3(), rb = new THREE.Box3(), lb = new THREE.Box3();
  for (const d of list) {
    const [r0, r1] = d.reach, [s0, s1] = d.seen;
    rb.min.fromArray(r0); rb.max.fromArray(r1);
    // Ecke -> Nummer über die Lage (5 mm), damit Teile über Material- und
    // Knotengrenzen zusammenhängen; Union-Find über diese Nummern
    const ids = new Map(), par = [], seen = [];
    const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const work = [];
    for (const mesh of meshes) {
      const g = mesh.geometry;
      // geteilte Geometrie (Einrichtung, mehrfach gestellt) und Gruppen bleiben unberührt
      if (uses.get(g) > 1 || g.groups.length) continue;
      M.multiplyMatrices(toModel, mesh.matrixWorld);
      if (!g.boundingBox) g.computeBoundingBox();
      if (!bb.copy(g.boundingBox).applyMatrix4(M).intersectsBox(rb)) continue;
      const P = g.attributes.position, kid = new Int32Array(P.count).fill(-1);
      // erst grob im Knotenraum gegen reach, dorthin gedreht, dann genau
      lb.copy(rb).applyMatrix4(Mi.copy(M).invert());
      const raw = !P.isInterleavedBufferAttribute && !P.normalized && P.itemSize === 3 ? P.array : null;
      const { min: a, max: b } = lb;
      let any = false;
      for (let i = 0; i < P.count; i++) {
        if (!(i & 16383)) await pause();
        if (raw) {
          const x = raw[i * 3], y = raw[i * 3 + 1], z = raw[i * 3 + 2];
          if (x < a.x || x > b.x || y < a.y || y > b.y || z < a.z || z > b.z) continue;
        }
        v.fromBufferAttribute(P, i).applyMatrix4(M);
        if (v.x < r0[0] || v.x > r1[0] || v.y < r0[1] || v.y > r1[1] || v.z < r0[2] || v.z > r1[2]) continue;
        const k = (Math.round(v.x * 200) + 65536) * 17179869184 + (Math.round(v.y * 200) + 65536) * 131072 + (Math.round(v.z * 200) + 65536);
        let id = ids.get(k);
        if (id === undefined) { id = par.length; par.push(id); seen.push(0); ids.set(k, id); }
        if (v.x >= s0[0] && v.x <= s1[0] && v.y >= s0[1] && v.y <= s1[1] && v.z >= s0[2] && v.z <= s1[2]) seen[id] = 1;
        kid[i] = id;
        any = true;
      }
      if (any) work.push({ g, kid });
      await pause();
    }
    // Dreiecke ganz in reach verbinden; ragt eines hinaus, hält es seine
    // Ecken in reach fest (das Teil reicht weiter und bleibt)
    const anchors = [];
    for (const { g, kid } of work) {
      const I = g.index.array;
      for (let t = 0; t + 2 < I.length; t += 3) {
        if (!(t % 49152)) await pause();
        const a = kid[I[t]], b = kid[I[t + 1]], c = kid[I[t + 2]];
        if (a >= 0 && b >= 0 && c >= 0) { const r = find(a); par[find(b)] = r; par[find(c)] = r; }
        else { if (a >= 0) anchors.push(a); if (b >= 0) anchors.push(b); if (c >= 0) anchors.push(c); }
      }
      await pause();
    }
    const held = new Set(anchors.map(find)), shown = new Set();
    for (let i = 0; i < seen.length; i++) if (seen[i]) shown.add(find(i));
    const gone = new Set();
    let tris = 0;
    for (const { g, kid } of work) {
      const I = g.index.array, keep = new I.constructor(I.length);
      let n = 0;
      for (let t = 0; t + 2 < I.length; t += 3) {
        if (!(t % 49152)) await pause();
        const a = kid[I[t]];
        if (a >= 0 && kid[I[t + 1]] >= 0 && kid[I[t + 2]] >= 0) {
          const r = find(a);
          if (!held.has(r) && shown.has(r)) { gone.add(r); tris++; continue; }
        }
        keep[n++] = I[t]; keep[n++] = I[t + 1]; keep[n++] = I[t + 2];
      }
      if (n < I.length) g.setIndex(new THREE.BufferAttribute(keep.slice(0, n), 1));
      await pause();
    }
    out.push({ why: d.why, tris, parts: gone.size });
  }
  return out;
}

// Schiffsfeld als Aufzug (14.10.2026). Das Spiel bringt Schiffe heute über
// einen Bodenaufzug in den Hangar herauf. Diese Halle stammt aus dem alten
// Hangarmodul und hatte keinen; ihr Schiffsfeld mit den gepunkteten Platten
// ist aber ein eigenes Bodenmodul: An seinem Rand (Modellraum, Meter, x/z)
// endet jedes Bodendreieck. cutHallLift nimmt die Dreiecke darin aus der
// Halle in eine eigene Gruppe, die beim Schiffswechsel ab- und auffährt, und
// das Schiff steht auf der Mitte des Felds statt auf der Raummitte.
// verify:hangar-hall liest den Eintrag aus dem ausgelieferten Viewer und
// prüft am ausgelieferten GLB, dass kein Bodendreieck den Rand kreuzt und
// das Feld mindestens `min` Dreiecke trägt.
const HALL_LIFT = /* hall-lift */ {
  "revelyork-single": { "from": [16, -120], "to": [48, -24], "y": [-0.3, 1.2], "min": 50000 }
} /* /hall-lift */;

// Feld in der Hallenmitte (18.10.2026). Krisz: „unser platform ist nicht
// mittig“. Wände, Decke, Galerie und die Rahmenlinie im Boden stehen um
// x = 36, das Schiffsfeld des Spiels aber bei x 16..48, 4 m daneben (bis
// zur Wand links 16 m, rechts 24 m). Der Boden besteht aus 8 m breiten
// Modulen; zwischen den Feldenden (`z`) endet jedes Bodendreieck bei x 48
// und 56. Das Feld rückt um `field` m in x zur Mitte, die Bodenstreifen
// daneben tauschen die Plätze (`strips`: [x von, bis, um m]): Der Streifen
// mit Nischen und Rundplatten am Feldrand (48..56) rückt mit, die ersten
// 4 m des schlichten Bodens dahinter (56..60) füllen die Lücke auf der
// anderen Seite. Bei x 60 endet nicht jedes Dreieck, dort wird geteilt
// (shiftHallFloor). `y`: so hoch reicht, was mitwandert (ein Rollwagen
// der Halle steht auf dem Streifen). Einrichtung mit Bezugspunkt auf einem
// Streifen und Spiellampen darin und im Feld wandern mit.
// verify:hangar-hall [13] liest den Block und prüft ihn am ausgelieferten
// GLB: Feld danach in der Raummitte, vorher und nachher dieselbe Breite
// ohne Überlappung, an den Feldenden kein Dreieck über der Kante, je
// Streifen mindestens `min` Dreiecke.
const HALL_SHIFT = /* hall-shift */ {
  "revelyork-single": { "field": 4, "z": [-120, -24], "y": [-0.3, 8], "strips": [[48, 56, 4], [56, 60, -40]], "min": [55000, 18000] }
} /* /hall-shift */;

// Das Feld, wie es steht: HALL_LIFT, um HALL_SHIFT.field verschoben
function liftField(h) {
  const L = HALL_LIFT[h.id], d = HALL_SHIFT[h.id]?.field || 0;
  return L && d ? { ...L, from: [L.from[0] + d, L.from[1]], to: [L.to[0] + d, L.to[1]] } : L;
}

// Ein Punkt im Modellraum der Halle (Spiellampe), dorthin, wo sein Boden
// nach HALL_SHIFT liegt
function hallShiftPoint(h, p) {
  const S = HALL_SHIFT[h.id], L = HALL_LIFT[h.id];
  if (!S || !L || p[1] < S.y[0] || p[1] > S.y[1] || p[2] < S.z[0] || p[2] >= S.z[1]) return p;
  let d = 0;
  if (p[0] >= L.from[0] && p[0] < L.to[0] && p[2] >= L.from[1] && p[2] < L.to[1]) d = S.field;
  else for (const [a, b, by] of S.strips) if (p[0] >= a && p[0] < b) d = by;
  return d ? [p[0] + d, p[1], p[2]] : p;
}

// Mitte des Schiffsfelds (mit Aufzug) oder des Raums, im Modellraum
function hallSpot(h) {
  const c = h.room.center, L = liftField(h);
  return L ? [(L.from[0] + L.to[0]) / 2, c[1], (L.from[1] + L.to[1]) / 2] : c;
}

// Liefert { group, tris, parts } oder null. Teilt die Ecken mit der Halle
// (ein Puffer auf der Grafikkarte), nur die Dreiecksliste ist geteilt.
async function cutHallLift(model, L, skip, pause = noPause) {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const e = 0.01, box = new THREE.Box3(new THREE.Vector3(L.from[0] - e, L.y[0], L.from[1] - e), new THREE.Vector3(L.to[0] + e, L.y[1], L.to[1] + e));
  // wie dropHallParts: geteilte Geometrie und Gruppen bleiben unberührt
  const meshes = [], uses = new Map();
  model.traverse((n) => {
    if (!n.isMesh) return;
    uses.set(n.geometry, (uses.get(n.geometry) || 0) + 1);
    if (!n.geometry.index || n.geometry.groups.length) return;
    for (let p = n; p; p = p.parent) if (skip.has(p)) return;
    meshes.push(n);
  });
  const group = new THREE.Group(), M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), v = new THREE.Vector3(), bb = new THREE.Box3(), lb = new THREE.Box3();
  let tris = 0;
  for (const mesh of meshes) {
    await pause();
    const g = mesh.geometry;
    if (uses.get(g) > 1) continue;
    M.multiplyMatrices(toModel, mesh.matrixWorld);
    if (!g.boundingBox) g.computeBoundingBox();
    if (!bb.copy(g.boundingBox).applyMatrix4(M).intersectsBox(box)) continue;
    // erst grob im Knotenraum (dorthin gedrehter Kasten), dann genau
    const P = g.attributes.position, inside = new Uint8Array(P.count);
    const raw = !P.isInterleavedBufferAttribute && !P.normalized && P.itemSize === 3 ? P.array : null;
    const { min: a, max: b } = lb.copy(box).applyMatrix4(Mi.copy(M).invert());
    for (let i = 0; i < P.count; i++) {
      if (!(i & 16383)) await pause();
      if (raw) {
        const x = raw[i * 3], y = raw[i * 3 + 1], z = raw[i * 3 + 2];
        if (x < a.x || x > b.x || y < a.y || y > b.y || z < a.z || z > b.z) continue;
      }
      inside[i] = box.containsPoint(v.fromBufferAttribute(P, i).applyMatrix4(M)) ? 1 : 0;
    }
    const I = g.index.array, keep = new I.constructor(I.length), cut = new I.constructor(I.length);
    let n = 0, m = 0;
    for (let t = 0; t + 2 < I.length; t += 3) {
      if (!(t % 49152)) await pause();
      const a = I[t], b = I[t + 1], c = I[t + 2];
      if (inside[a] && inside[b] && inside[c]) { cut[m++] = a; cut[m++] = b; cut[m++] = c; } else { keep[n++] = a; keep[n++] = b; keep[n++] = c; }
    }
    if (!m) continue;
    const lg = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) lg.setAttribute(k, a);
    lg.setIndex(new THREE.BufferAttribute(cut.slice(0, m), 1));
    lg.boundingBox = g.boundingBox.clone(); lg.boundingSphere = g.boundingSphere?.clone() ?? null;
    g.setIndex(new THREE.BufferAttribute(keep.slice(0, n), 1));
    const part = new THREE.Mesh(lg, mesh.material);
    part.matrixAutoUpdate = false;
    part.matrix.copy(M);
    group.add(part);
    tris += m / 3;
  }
  return tris ? { group, tris, parts: group.children.length } : null;
}

// Bodenstreifen umsetzen (HALL_SHIFT). Ein Dreieck ganz in einem Streifen
// bekommt eigene, verschobene Ecken in seiner Geometrie; eins über einer
// Streifenkante wird dort geteilt, die Teile wandern mit ihrem Streifen
// oder bleiben. So kommt kein Zeichenbefehl dazu, nur Ecken. Teilen andere
// Meshes die Ecken (das Feld aus cutHallLift), bekommen sie die neuen
// Puffer mit. Einrichtung mit Bezugspunkt auf einem Streifen wandert mit.
// Die Hallenmeshes haben zusammen rund 1,8 Mio. Ecken; die beiden Läufe
// darüber sind darum eigene Funktionen ohne await (die Engine übersetzt
// sie dann ganz), pause kommt zwischen ihren Häppchen.
// Liefert { moved: Dreiecke je Streifen, split, furniture } oder null.
const SHIFT_CHUNK = 16384;
// Ecken i0..i1: x im Modellraum für die im Höhen- und Tiefenband (ok = 1)
function shiftScanCorners(pa, m, X, ok, i0, i1, y0, y1, z0, z1) {
  for (let i = i0; i < i1; i++) {
    const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (wy < y0 || wy > y1 || wz < z0 || wz > z1) continue;
    X[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    ok[i] = 1;
  }
}
// Dreiecke t0..t1: ganz im Band und nicht ganz links von lo oder rechts von
// hi. Ihre Nummern kommen nach hits ab h; liefert das neue h.
function shiftScanTris(I, X, ok, t0, t1, lo, hi, hits, h) {
  for (let t = t0; t < t1; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    if (!(ok[a] & ok[b] & ok[c])) continue;
    const xa = X[a], xb = X[b], xc = X[c];
    if ((xa <= lo && xb <= lo && xc <= lo) || (xa >= hi && xb >= hi && xc >= hi)) continue;
    hits[h++] = t;
  }
  return h;
}
async function shiftHallFloor(model, S, skip, furn, pause = noPause) {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const [y0, y1] = S.y, [z0, z1] = S.z, e = 0.01;
  const cuts = [...new Set(S.strips.flatMap(([a, b]) => [a, b]))].sort((p, q) => p - q);
  const box = new THREE.Box3(new THREE.Vector3(cuts[0], y0, z0 - e), new THREE.Vector3(cuts[cuts.length - 1], y1, z1 + e));
  const stripOf = (lo, hi) => S.strips.findIndex(([a, b]) => lo >= a - e && hi <= b + e);
  const meshes = [], uses = new Map(), owners = new Map();
  model.traverse((n) => {
    if (!n.isMesh) return;
    uses.set(n.geometry, (uses.get(n.geometry) || 0) + 1);
    for (const a of Object.values(n.geometry.attributes)) owners.set(a, [...(owners.get(a) || []), n.geometry]);
    if (!n.geometry.index || n.geometry.groups.length) return;
    for (let p = n; p; p = p.parent) if (skip.has(p)) return;
    meshes.push(n);
  });
  const moved = S.strips.map(() => 0), M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), bb = new THREE.Box3(), v = new THREE.Vector3();
  let split = 0;
  for (const mesh of meshes) {
    await pause();
    const g = mesh.geometry, P = g.attributes.position;
    if (uses.get(g) > 1 || !(P.array instanceof Float32Array) || P.isInterleavedBufferAttribute || P.normalized) continue;
    M.multiplyMatrices(toModel, mesh.matrixWorld);
    if (!g.boundingBox) g.computeBoundingBox();
    if (!bb.copy(g.boundingBox).applyMatrix4(M).intersectsBox(box)) continue;
    const n0 = P.count, X = new Float32Array(n0), ok = new Uint8Array(n0);
    for (let i = 0; i < n0; i += SHIFT_CHUNK) {
      await pause();
      shiftScanCorners(P.array, M.elements, X, ok, i, Math.min(n0, i + SHIFT_CHUNK), y0, y1, z0 - e, z1 + e);
    }
    const I = g.index.array, T = I.length / 3, hits = new Int32Array(T);
    let nh = 0;
    for (let t = 0; t < T; t += SHIFT_CHUNK) {
      await pause();
      nh = shiftScanTris(I, X, ok, t, Math.min(T, t + SHIFT_CHUNK), cuts[0] + e, cuts[cuts.length - 1] - e, hits, nh);
    }
    if (!nh) continue;
    // Verschiebung je Streifen im Knotenraum
    Mi.copy(M).invert();
    const o0 = new THREE.Vector3().applyMatrix4(Mi);
    const shift = S.strips.map(([, , by]) => new THREE.Vector3(by, 0, 0).applyMatrix4(Mi).sub(o0));
    // neue Ecken hinter den alten: Kopien (copy: alte Ecke, Streifen; remap
    // je Streifen alte → neue Nummer) und Teilecken (part: [a, b, c,
    // Gewichte, Streifen oder -1]). sub: Dreieck, Streifen (-2 geteilt),
    // bei geteilten die Vielecke als Nummern in part
    const remap = S.strips.map(() => null), copy = [], part = [], sub = [];
    const corner = (i, s) => {
      const r = (remap[s] ??= new Int32Array(n0).fill(-1));
      if (r[i] < 0) { r[i] = n0 + copy.length / 2; copy.push(i, s); }
    };
    let extra = 0;
    for (let h = 0; h < nh; h++) {
      if (!(h % SHIFT_CHUNK)) await pause();
      const t = hits[h], a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      const lo = Math.min(X[a], X[b], X[c]), hi = Math.max(X[a], X[b], X[c]);
      const s = stripOf(lo, hi);
      if (s >= 0) { sub.push(t, s, null); corner(a, s); corner(b, s); corner(c, s); moved[s]++; continue; }
      // an jeder Kante dazwischen teilen: Ecken als Gewichte über a, b, c
      let ps = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
      const xw = (w) => w[0] * X[a] + w[1] * X[b] + w[2] * X[c];
      for (const k of cuts) {
        if (!(lo < k - e && hi > k + e)) continue;
        const next = [];
        for (const poly of ps) {
          const L = [], R = [];
          for (let q = 0; q < poly.length; q++) {
            const p0 = poly[q], p1 = poly[(q + 1) % poly.length], x0 = xw(p0) - k, x1 = xw(p1) - k;
            (x0 < 0 ? L : R).push(p0);
            if ((x0 < 0) !== (x1 < 0)) {
              const f = x0 / (x0 - x1), w = p0.map((u, r) => u + (p1[r] - u) * f);
              L.push(w); R.push(w);
            }
          }
          for (const q of [L, R]) if (q.length >= 3) next.push(q);
        }
        ps = next;
      }
      if (!ps.length) continue;
      const polys = ps.map((poly) => {
        const xs = poly.map(xw), s2 = stripOf(Math.min(...xs), Math.max(...xs));
        if (s2 >= 0) moved[s2]++;
        return poly.map((w) => { part.push([a, b, c, w, s2]); return part.length - 1; });
      });
      sub.push(t, -2, polys);
      split++;
      extra += polys.reduce((q, ids) => q + ids.length - 2, 0) - 1;
    }
    if (!copy.length && !part.length) continue;
    // Teilecken stehen hinter den Kopien
    const nc = copy.length / 2, n1 = n0 + nc + part.length, base = n0 + nc;
    // Puffer verlängern: alte Ecken bleiben, die neuen hängen dahinter
    for (const [name, A] of Object.entries(g.attributes)) {
      await pause();
      const k = A.itemSize, B = new THREE.BufferAttribute(new A.array.constructor(n1 * k), k, A.normalized);
      const pos = name === 'position', src = A.isInterleavedBufferAttribute ? null : A.array, dst = B.array;
      if (src) {
        dst.set(src.subarray(0, n0 * k));
        for (let j = 0; j < nc; j++) {
          const i = copy[j * 2], s = copy[j * 2 + 1], o = (n0 + j) * k;
          for (let r = 0; r < k; r++) dst[o + r] = src[i * k + r];
          if (pos) { const d = shift[s]; dst[o] += d.x; dst[o + 1] += d.y; dst[o + 2] += d.z; }
        }
      } else {
        for (let i = 0; i < n0; i++) for (let r = 0; r < k; r++) B.setComponent(i, r, A.getComponent(i, r));
        for (let j = 0; j < nc; j++) for (let r = 0; r < k; r++) B.setComponent(n0 + j, r, A.getComponent(copy[j * 2], r));
      }
      for (let j = 0; j < part.length; j++) {
        const [a, b, c, w, s] = part[j];
        for (let r = 0; r < k; r++) {
          let val = A.getComponent(a, r) * w[0] + A.getComponent(b, r) * w[1] + A.getComponent(c, r) * w[2];
          if (pos && s >= 0) val += shift[s].getComponent(r);
          B.setComponent(base + j, r, val);
        }
      }
      for (const og of owners.get(A) || []) og.setAttribute(name, B);
    }
    // Dreiecksliste: die alte, darin die gewanderten umgezeigt; ein geteiltes
    // Dreieck nimmt sein erstes Teil auf, die übrigen hängen hinten an
    const J = new (n1 > 65535 ? Uint32Array : I.constructor)(I.length + extra * 3);
    J.set(I);
    let o = I.length;
    for (let q = 0; q < sub.length; q += 3) {
      const t = sub[q], s = sub[q + 1];
      if (s >= 0) { const r = remap[s]; for (let u = 0; u < 3; u++) J[t * 3 + u] = r[I[t * 3 + u]]; continue; }
      let first = true;
      for (const ids of sub[q + 2]) for (let u = 1; u + 1 < ids.length; u++) {
        const at = first ? t * 3 : o;
        J[at] = base + ids[0]; J[at + 1] = base + ids[u]; J[at + 2] = base + ids[u + 1];
        if (first) first = false; else o += 3;
      }
    }
    g.setIndex(new THREE.BufferAttribute(J, 1));
    // Hülle: die alten Ecken bleiben im Puffer, also nur die neuen dazu
    const Q = g.attributes.position;
    for (let i = n0; i < n1; i++) g.boundingBox.expandByPoint(v.fromBufferAttribute(Q, i));
    g.boundingSphere = g.boundingBox.getBoundingSphere(g.boundingSphere ?? new THREE.Sphere());
    for (const og of owners.get(Q) || []) if (og !== g) { og.boundingBox = g.boundingBox.clone(); og.boundingSphere = g.boundingSphere.clone(); }
  }
  // Einrichtung: Bezugspunkt auf einem Streifen
  let furniture = 0;
  for (const f of furn) {
    const A = f.userData.anchor;
    if (!(A[2] >= z0 && A[2] < z1)) continue;
    const s = S.strips.findIndex(([a, b]) => A[0] >= a && A[0] < b);
    if (s < 0) continue;
    const by = S.strips[s][2];
    Mi.multiplyMatrices(toModel, f.parent.matrixWorld).invert();
    f.position.add(new THREE.Vector3(by, 0, 0).applyMatrix4(Mi).sub(new THREE.Vector3().applyMatrix4(Mi)));
    f.userData.anchor = [A[0] + by, A[1], A[2]];
    furniture++;
  }
  model.updateMatrixWorld(true);
  return moved.some((q) => q) ? { moved, split, furniture } : null;
}

// Aufzugsschacht aus dem Spiel (15.10.2026). Fährt das Feld ab, öffnet sich
// darunter der Schacht des mittleren persönlichen Hangars: der Bausatz aus
// hangar_medtop_001 (public/hangar/lift/<kit>.glb und .json, PC-Auftrag
// .planning/notes/hangar-schacht.md) mit Wand 40 m, Rippe 8 m, Ecke,
// Randleiste 16 m und zwei Warnlampen. Das Spiel reiht die Teile um seine
// 56 × 88 m; hier stehen sie nach denselben Regeln um das Feld der Halle:
// eine Ecke in jeder Schachtecke, die Längswand aus Wand, Rippe und Wand,
// die Querwand aus Rippe, Wand und Rippe. Deren Wand steht mittig, ihre
// Enden stecken hinter den Längswänden, wie im Spiel hinter den Ecken.
// Randleisten laufen rundum. `long`/`cross`: [Teil, Anfang] entlang der Wand
// in Metern ab ihrer linken Innenecke (von der Schachtmitte aus gesehen);
// `lamps`: die Warnlampe light_0 auf jeder Rippenmitte. Ihre Höhe kommt aus
// den Spiellampen. Tief ist der Schacht wie im Spiel (Rand 4 m, Wand 32 m,
// also 36 m); höhere Schiffe bekommen darüber Lagen aus den Oberteilen
// (20 m), so wie der Bausatz sie stapelt.
// verify:hangar-hall [11] liest den Block aus dem ausgelieferten Viewer und
// prüft ihn gegen die Schachtdatei und das Feld aus HALL_LIFT.
const HALL_SHAFT = /* hall-shaft */ {
  "revelyork-single": { "kit": "medtop", "long": [["wall", 4], ["rib", 44], ["wall", 52]], "cross": [["wall", -4], ["rib", 4], ["rib", 20]], "lamps": { "long": [48], "cross": [8, 24] } }
} /* /hall-shaft */;
// Lagen über der Wand: Oberteile von Wand, Rippe und Ecke (der Bausatz
// trennt sie bei 12 m Höhe: Unterteil 12 m, Oberteil 20 m)
const SHAFT_SPLIT = 12;
const SHAFT_WEAR_BREAK = 0.9;   // wie stark die Helligkeit der Wear-Karte die Maskengrenze ausfranst
// Rand der Öffnung. Die Randleiste des Spiels ist unter dem Hallenboden
// eine 3 m tiefe Nische (Decke 0,25 m unter dem Boden, Sohle 3,75 m), und
// darin liegt das Schachttor, wenn es offen ist: Flügel und Stirnplatten
// schieben sich aus ihr über die Öffnung. Die Bodenplatte der Halle ist am
// Schnitt des Felds offen (in der Halle schließt das Feld an) und bekommt
// an der Öffnung ihre Stirn (shaftEdge).
// 16.10.2026 (Krisz: „zu dünn, ... als wäre es aus papier“): Von oben sah
// man durch die offene Platte in die Nische. Damals wurde die Nische 0,5 m
// flach und die Stirn 1 m hoch. 18.10. abends (Krisz: „das was den schaft
// zu macht kommt einfach so aus der wand heraus“): Das Tor schob sich so
// aus der Stirn und der flachen Rückwand. Jetzt ist die Nische wieder so
// tief wie im Spiel, die Stirn reicht nur bis an ihre Decke, und nach hinten
// wird es dunkel (SHAFT_POCKET, hgPocket im Hallenshader): Unter den Boden
// fällt kaum Licht, das Tor kommt aus einem dunklen Schlitz.
const SHAFT_RIM_DEPTH = 3;      // Nische so tief (wie im Spiel)
const SHAFT_SLOT_LIP = 0.25;    // Stirn der Bodenplatte bis an die Decke der Nische
const SHAFT_POCKET = [0.1, 1.8, 3.3, 0.2];   // hinter der Wandebene: dunkel von .. bis (m), dahinter (Wand der Nische) keine Wirkung; Rest-Licht
const SHAFT_EDGE_GAP = 0.02;   // Stirn so weit hinter der Wandebene: Die Plattform fährt davor vorbei
const SHAFT_RIMS = { rim: ['z'], rim_8: ['z'], rim_corner: ['x', 'z'] };   // Tiefenachsen der Randleisten

// Teile eines Schachtbausatzes als einfache Geometrien je Material, im
// Bezugssystem des Teils: Lage, Normale, Abdunkelung aus dem Spiel
// (Rotkanal der Eckfarben, wie die Halle). `band`: nur das Oberteil, auf
// 0 heruntergesetzt.
function shaftPieces(node, band) {
  node.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert(), M = new THREE.Matrix4(), v = new THREE.Vector3();
  const out = [];
  node.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, U = g.attributes.uv;
    if (!P || !N) return;
    M.multiplyMatrices(inv, m.matrixWorld);
    const nm = new THREE.Matrix3().getNormalMatrix(M), n = new THREE.Vector3();
    const pos = new Float32Array(P.count * 3), nor = new Float32Array(P.count * 3), sh = new Float32Array(P.count);
    // Texturkoordinaten des Spiels und die Mischmaske der Wear-Schicht
    // (COLOR_0.a: 1 Grundlack, 0 Abnutzung), seit Schacht-Tiefe 17.10.2026
    const uv = U ? new Float32Array(P.count * 2) : null, wear = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(M);
      if (band) v.y -= SHAFT_SPLIT;
      pos.set([v.x, v.y, v.z], i * 3);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      nor.set([n.x, n.y, n.z], i * 3);
      sh[i] = C ? C.getX(i) : 1;
      wear[i] = C && C.itemSize === 4 ? 1 - C.getW(i) : 0;
      if (uv) { uv[i * 2] = U.getX(i); uv[i * 2 + 1] = U.getY(i); }
    }
    const I = g.index ? g.index.array : Uint32Array.from({ length: P.count }, (_, i) => i);
    let idx = I;
    if (band) {
      // nur Dreiecke, deren Mitte über der Trennung liegt
      const keep = [];
      for (let t = 0; t + 2 < I.length; t += 3) {
        const y = (pos[I[t] * 3 + 1] + pos[I[t + 1] * 3 + 1] + pos[I[t + 2] * 3 + 1]) / 3;
        if (y > 0) keep.push(I[t], I[t + 1], I[t + 2]);
      }
      idx = Uint32Array.from(keep);
    }
    if (idx.length) out.push({ mat: m.material, pos, nor, sh, wear, idx, uv });
  });
  return out;
}

// Randleiste mit Nische bis SHAFT_RIM_DEPTH: im Bezugssystem des Teils
// (y ab 0 bis h, Wand bei <= 0 auf den Achsen `axes`) rückt, was tiefer
// hinter der Wandebene liegt, auf diese Tiefe vor, die Decke mit; die obere
// Lippe tritt hinter die Stirn der Bodenplatte zurück. Unten der Sockel
// (y 0) bleibt, wie er ist, und die untere Lippe vorn auch.
function rimShallow(parts, axes, h) {
  const lip = SHAFT_EDGE_GAP + 0.02;
  for (const p of parts) for (let i = 0; i < p.pos.length; i += 3) {
    const y = p.pos[i + 1], top = y > h - 0.3;
    if (y < 0.05) continue;
    for (const ax of axes) {
      const j = i + (ax === 'x' ? 0 : 2), c = p.pos[j];
      if (c < -0.01) p.pos[j] = Math.max(c, -SHAFT_RIM_DEPTH);
      else if (c <= 0.01 && top) p.pos[j] = -lip;
    }
  }
  return parts;
}

// Baut den Schacht im Schachtraum: Ursprung in der Feldmitte auf
// Bodenhöhe, x quer (Feldbreite), z längs, y oben. Liefert { group, pit,
// tris, parts, depth, fit(tiefe) }: fit legt Lagen dazu oder nimmt sie weg,
// bis der Schacht mindestens so tief ist (je Material ein Mesh, also ein
// Zeichenbefehl).
function buildShaft(kit, info, L, lay) {
  const node = (r) => kit.getObjectByName(r);
  const size = (r) => info.modules?.[r]?.size;
  for (const r of ['wall', 'wall_upper', 'rib', 'corner', 'rim', 'rim_corner', 'light_0', 'light_1']) if (!node(r)) throw new Error(`Schacht ${lay.kit}: Teil ${r} fehlt`);
  const hx = (L.to[0] - L.from[0]) / 2, hz = (L.to[1] - L.from[1]) / 2;
  const wallH = size('wall')[1], bandH = size('wall_upper')[1], rimL = size('rim')[0], rim8 = size('rim_8')?.[0] ?? 0;
  const depth0 = info.shaft?.depth ?? 36, rimY = -(depth0 - wallH);
  const lampY = (() => {
    const ys = (info.lights || []).filter((l) => l.node === 'light_0').map((l) => l.pos[1]);
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : rimY - 5.4;
  })();
  const cache = new Map();
  const piece = (r, band = false) => {
    const k = `${r}|${band}`;
    if (!cache.has(k)) cache.set(k, SHAFT_RIMS[r] ? rimShallow(shaftPieces(node(r), band), SHAFT_RIMS[r], size(r).at(-1)) : shaftPieces(node(r), band));
    return cache.get(k);
  };
  // die vier Wände, je mit linker Innenecke und Drehung um y
  const sides = [
    { len: 2 * hx, kind: 'cross', o: [-hx, -hz], rot: 0 },
    { len: 2 * hz, kind: 'long', o: [hx, -hz], rot: -Math.PI / 2 },
    { len: 2 * hx, kind: 'cross', o: [hx, hz], rot: Math.PI },
    { len: 2 * hz, kind: 'long', o: [-hx, hz], rot: Math.PI / 2 },
  ];
  const place = (s, a, y) => {
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    return new THREE.Matrix4().makeRotationY(s.rot).setPosition(s.o[0] + a * c, y, s.o[1] - a * sn);
  };
  const BAND = { wall: 'wall_upper', rib: 'rib', corner: 'corner' };
  function layout(bands) {
    const list = [];   // [Teile, Matrix]
    const full = rimY - bands * bandH - wallH;
    for (const s of sides) {
      list.push([piece('corner'), place(s, 0, full)], [piece('rim_corner'), place(s, 0, rimY)]);
      for (let b = 0; b < bands; b++) list.push([piece('corner', true), place(s, 0, rimY - (b + 1) * bandH)]);
      for (const [r, a] of lay[s.kind]) {
        list.push([piece(r), place(s, a, full)]);
        for (let b = 0; b < bands; b++) list.push([r === 'wall' ? piece(BAND.wall) : piece(BAND[r], true), place(s, a, rimY - (b + 1) * bandH)]);
      }
      for (const a of lay.lamps[s.kind]) list.push([piece('light_0'), place(s, a, lampY)]);
      let a = 0;
      for (; a + rimL <= s.len + 1e-3; a += rimL) list.push([piece('rim'), place(s, a, rimY)]);
      if (rim8) for (; a + rim8 <= s.len + 1e-3; a += rim8) list.push([piece('rim_8'), place(s, a, rimY)]);
    }
    return list;
  }
  // je Material ein Mesh, die Teile mit ihren Matrizen hineingeschrieben
  function merge(list) {
    const by = new Map();
    for (const [parts, M] of list) for (const p of parts) {
      if (!by.has(p.mat)) by.set(p.mat, []);
      by.get(p.mat).push([p, M]);
    }
    const meshes = [], v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    let tris = 0;
    for (const [mat, items] of by) {
      let nv = 0, ni = 0;
      for (const [p] of items) { nv += p.pos.length / 3; ni += p.idx.length; }
      const withUv = items.every(([p]) => p.uv);
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), sh = new Uint8Array(nv * 3), idx = new Uint32Array(ni), uv = withUv ? new Float32Array(nv * 2) : null;
      let ov = 0, oi = 0;
      for (const [p, M] of items) {
        nm.getNormalMatrix(M);
        const cnt = p.pos.length / 3;
        for (let i = 0; i < cnt; i++) {
          v.fromArray(p.pos, i * 3).applyMatrix4(M).toArray(pos, (ov + i) * 3);
          n.fromArray(p.nor, i * 3).applyMatrix3(nm).normalize().toArray(nor, (ov + i) * 3);
          // hgShade: R Abdunklung, G Abnutzung (Wear-Maske), B wie R
          const k = (ov + i) * 3, d = Math.round(Math.min(1, Math.max(0, p.sh[i])) * 255);
          sh[k] = d; sh[k + 1] = Math.round(Math.min(1, Math.max(0, p.wear[i])) * 255); sh[k + 2] = d;
        }
        if (uv) uv.set(p.uv, ov * 2);
        for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + ov;
        ov += cnt; oi += p.idx.length;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('hgShade', new THREE.BufferAttribute(sh, 3, true));
      if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeBoundingBox(); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = `shaft:${mat.name}`;
      mesh.userData.noUv = !uv;
      // Das Material liest seine Karten über die Koordinaten des Spiels
      if (uv) mat.userData.shaftUv = true;
      meshes.push(mesh);
      tris += ni / 3;
    }
    return { meshes, tris, parts: list.length };
  }
  // group: hängt in der Halle; pit: der Schacht, sichtbar nur, solange das
  // Feld abgefahren ist (in Ruhe deckt es ihn zu). Die Ecklampen light_1
  // stehen auf dem Hallenboden an den Feldecken und bleiben stehen.
  const group = new THREE.Group(), pit = new THREE.Group();
  group.name = 'shaft'; pit.name = 'shaft:pit';
  group.add(pit);
  const rest = merge(sides.map((s) => [piece('light_1'), place(s, 0, 0)]));
  for (const m of rest.meshes) group.add(m);
  const sh = { group, pit, tris: 0, restTris: rest.tris, parts: 0, bands: -1, depth: depth0, depth0, hx, hz, rimY, lampY, materials: new Set(rest.meshes.map((m) => m.material)) };
  let walls = [];
  sh.fit = (d) => {
    const bands = Math.max(0, Math.ceil((d - depth0 - 0.05) / bandH));
    if (bands === sh.bands) return false;
    for (const m of walls) { m.geometry.dispose(); pit.remove(m); }
    const r = merge(layout(bands));
    walls = r.meshes;
    for (const m of walls) { pit.add(m); sh.materials.add(m.material); }
    Object.assign(sh, { tris: r.tris, parts: r.parts, bands, depth: depth0 + bands * bandH });
    return true;
  };
  sh.fit(depth0);
  // Beiwerk (SHAFT_DECO) auf die Wände der Grundtiefe; bleibt beim Vertiefen
  // stehen wie die Lampen, deren Höhe ebenfalls aus dem Spiel kommt
  const deco = shaftDecoList(kit, info, hx, hz, lay);
  if (deco.length) {
    const r = merge(deco);
    for (const m of r.meshes) { m.material.userData.deco = true; pit.add(m); sh.materials.add(m.material); }
    Object.assign(sh, { decoTris: r.tris, decoParts: r.parts });
  }
  return sh;
}

// Schachttor aus dem Spiel (18.10.2026, Krisz: „wenn die platform
// runterfährt soll auch das loch oder die schacht oben zugehen damit man
// das nicht sieht dass das schiff einfach nur dahinploppt“): das Tor des
// mittleren Hangars (public/hangar/lift/medtop-tor.glb und .json, PC-Auftrag
// .planning/notes/hangar-schachttor.md). Je Seite drei Flügel, die sich in
// der Mitte treffen, zwei Stirnplatten an den Enden, darunter Riegel,
// Zahnstangen und Zylinder; jedes Teil mit seiner Bahn aus door_close und
// door_open (keys, Zeit in Spielsekunden). Das Spiel öffnet 56 × 88 m, unser
// Feld ist 32 × 96 m. Quer bleibt das Spielmaß: Die zwei inneren Flügel je
// Seite decken genau ±16,2 m, und sie fahren im Spiel erst ab 16,5 m in die
// Mitte, vorher liegen sie unter unserem Hallenboden. Längs streckt sich
// das Tor um 96/88 auf die Feldlänge. Ein Teil zählt, wenn es irgendwann
// mehr als HALL_GATE.reach ins Feld reicht und offen ganz draußen liegt. So
// fallen die äußeren Flügel weg (0,1 m im Feld) und die vier Eckstücke: Zwei
// erreichen das Feld nie, die zwei an den Enden schieben sich beim Öffnen
// 10 m hinein und stünden unserer Plattform im Weg.
// Materialien mit denselben Karten werden eins, ihre Grundfarbe geht als
// Abdunkelung in hgShade: Die vier Lacke des Tors teilen eine Karte und
// unterscheiden sich nur in der Helligkeit. Je Material ein BatchedMesh,
// jedes Teil darin eine Instanz, die gatePose längs ihrer Bahn schiebt.
// `ms`: so lange dauert hier eine Bahn des Spiels (dort 12,5 s mal 1,2).
// Eine Nacht lief alles im Takt des Spiels, 15 s je Bahn und Fahrt; Krisz
// am 21.10.2026: „gesamt animation ist viel zu langsam“. Seitdem wieder
// der flotte Takt, und die Aufnahmen sind auf ihn geschnitten
// (build-hangar-sound.mjs, SND_HIT). `clear`: so weit bleibt die
// Oberkante des Schiffs unter dem Tor; `lead`: so lange vor dem Halt der
// Plattform deckt das Tor das Feld schon ganz. Die Fahrt hinab dauert
// dafür, wo nötig, länger als LIFT_DOWN_MS (liftDownMs):
// Bis 18.10. war das Tor erst nach dem Halt zu, unten sah man das Feld mit
// Schiff und Gerät im offenen Schacht (Krisz, Bild 20:28; gewünscht war
// „während die Plattform runterfährt, schließt sich der Schacht“).
// verify:hangar-hall [15] rechnet dieselbe Auswahl gegen die Dateien in dist/.
const HALL_GATE = /* hall-gate */ { "reach": 0.25, "ms": 1300, "clear": 0.4, "lead": 200 } /* /hall-gate */;
const GATE_BLEND_MS = 250;   // kehrt das Tor unterwegs um: so lange von der Lage auf die neue Bahn
const GATE_SLACK_MS = 80;    // die Oberkante des neuen Schiffs kommt erst so lange nach dem offenen Tor
const GATE_GLOW = 2.5;       // Leuchtstreifen in den Mittelflügeln
// Finish des Tors (20.10.2026, Krisz: „in der mitte die zylinder sind
// verbuggt iwi, ganze tor was oben schacht zu macht hat nicht den selben
// finish wie der rest“). Am Render aus seinem Blickwinkel drei Ursachen:
// Das Metall des Tors (metal_a_046: Kolben, Dichtleisten, Flanken der
// Flügel) ist im Spiel blankes Metall mit Grundfarbe 0,55. Auf 0,4 Metall
// gedeckelt wurde es heller Lack und leuchtete in der Fuge als weiße
// Klötze; es nimmt jetzt die Einstellung der Bodenplatten der Halle
// (Stahlgrau). Unter dem Boden lag das Tor im vollen Hallenlicht, obwohl
// über ihm nur ein Schlitz offen ist: Es dunkelt mit der Tiefe unter dem
// Hallenboden auf das Restlicht der Nische (GATE_SLOT, ab .. bis in m).
// Und die Lacke tragen im Export eine glatte Einheitskarte (ein Grau,
// flache Normalen), während Boden und Feld daneben Kratzer und Flecken
// zeigen: Das Tor bekommt die Schmutzkarte des weißen Hallenlacks
// (metal_white_03, auch auf dem Feld), im Raum des Teils projiziert, damit
// sie mitfährt (GATE_GRIME: Kachel in m wie im Spiel, Verstärkung). Die
// Wear-Karte des Schachts war am Render zu fleckig, das Tor sah aus wie
// Beton.
const GATE_SLOT = [0.3, 1.2];
const GATE_GRIME = [4, 2];
// Oberseite wie der Hallenboden (20.10.2026 abends, Krisz: „warum kannst du
// das schliess tor gleiches finish und material undso als den rest des
// bodens machen“). Am Render lag neben dem glatten, spiegelnden Boden ein
// stumpfes Grau: Die Lacke des Tors (paint_b_*) sind im Spiel matt, der
// Boden (metal_white_03) ist glatter Lack mit Kratzern. Die Lacke nehmen
// jetzt Farbe, Karten und Glätte des Bodens; die Streifen bleiben so viel
// dunkler wie im Spiel (hgShade), der blaue Lack behält seine Farbe. Die
// Karte liegt im Maßstab des Bodens (4 m je Kachel, am Hallenmodell
// gemessen) von oben auf jedem Teil, gerechnet im geschlossenen Stand,
// damit sie mitfährt und die zwei Flügel in der Mitte aneinanderpassen.
const GATE_FLOOR = { re: /_mtl_paint_b_/, tile: 4 };
// Lackfarben des Tors: Die Lacke paint_b_* sind Palettenlacke, das Spiel
// färbt sie mit der Palette am Tor (info.palette, 19.10.2026: Hellgrau,
// Dunkelgrau, Dunkelblau). Der Export trug die Palette des Behälters (fast
// schwarz, linear 0,007 bis 0,032); bis dahin hob GATE_PAINT sie zu einem
// stumpfen Grau an (Krisz 19.10. 13:37: „textur mässig undso passts auch
// nicht“). Jetzt tragen sie die Farbe des Spiels, die übrigen Materialien
// ihre eigene Tönung wie im Schacht.
const GATE_PALETTE = ['', 'primary', 'secondary', 'tertiary'];
// Offen liegt jedes Teil so tief in der Nische unter dem Boden, dass es ganz
// im dunklen Teil liegt (SHAFT_POCKET), und nicht tiefer. Die Stirnplatten
// lagen in der Mündung, ihre Front sah aus wie ein Stück Wand, aus dem sie
// dann herausfuhren (Krisz, 18.10. abends). Im Spiel deckt dort ein
// Rahmenstück die Mündung, das in unser Feld nicht passt. Ihre Bahn wird
// dafür vom geschlossenen Stand aus gestreckt. Die Flügel lagen offen wie im
// Spiel 12 m hinter unserer Wand (der Spielschacht ist 56 m breit, unser
// Feld 32 m), hinter der Rückwand der Nische; ihre Bahn endet seit 19.10.
// hier (buildGate).
const GATE_STOW = SHAFT_POCKET[1] + 0.2;

// Zwischen den Stützstellen einer Bahn monoton kubisch (Fritsch-Carlson,
// wie PCHIP) statt geradlinig (20.10.2026, Krisz: „smoother animation“):
// Geradlinig sprang das Tempo an jeder Stützstelle, beim Tor alle 43 ms, bei
// der Plattform alle 60 bis 90 ms; man sah es als leises Stottern. Kubisch
// ist das Tempo stetig; monoton heißt, kein Teil schießt über eine
// Stützstelle hinaus (etwa in die Wand der Nische), flache Abschnitte bleiben
// flach. Durch die Stützstellen selbst geht die Bahn wie vorher.
// Steigung der Spalte j an Stützstelle n von keys ([t, …], aufsteigend)
function pchipSlope(keys, n, j) {
  const c = keys[n], p = keys[n - 1], q = keys[n + 1];
  const h0 = p ? c[0] - p[0] : 0, h1 = q ? q[0] - c[0] : 0;
  const d0 = h0 > 1e-9 ? (c[j] - p[j]) / h0 : null, d1 = h1 > 1e-9 ? (q[j] - c[j]) / h1 : null;
  if (d0 === null && d1 === null) return 0;
  if (d0 === null || d1 === null) {
    // Rand: aus den nächsten zwei Abschnitten, ohne Vorzeichenwechsel
    const d = d0 ?? d1, r = d0 === null ? keys[n + 2] : keys[n - 2], h = d0 === null ? h1 : h0;
    const h2 = r ? Math.abs(r[0] - (d0 === null ? q[0] : p[0])) : 0;
    if (!(h2 > 1e-9)) return d;
    const e = d0 === null ? (r[j] - q[j]) / h2 : (p[j] - r[j]) / h2;
    let m = ((2 * h + h2) * d - h * e) / (h + h2);
    if (Math.sign(m) !== Math.sign(d)) m = 0;
    else if (Math.sign(d) !== Math.sign(e) && Math.abs(m) > Math.abs(3 * d)) m = 3 * d;
    return m;
  }
  if (d0 * d1 <= 0) return 0;
  const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
  return (w1 + w2) / (w1 / d0 + w2 / d1);
}
// Wert der Spalte j im Abschnitt keys[i-1]..keys[i] bei f (0..1)
function pchipAt(keys, i, f, j) {
  const a = keys[i - 1], b = keys[i], h = b[0] - a[0];
  if (!(h > 1e-9)) return b[j];
  const f2 = f * f, f3 = f2 * f;
  return (2 * f3 - 3 * f2 + 1) * a[j] + (f3 - 2 * f2 + f) * h * pchipSlope(keys, i - 1, j)
    + (3 * f2 - 2 * f3) * b[j] + (f3 - f2) * h * pchipSlope(keys, i, j);
}
// Lage einer Bahn ([t, x, y, z], aufsteigend) zur Zeit tau, nach out
function gateAt(keys, tau, out) {
  if (tau <= keys[0][0]) return out.set(keys[0][1], keys[0][2], keys[0][3]);
  let i = 1;
  while (i < keys.length - 1 && keys[i][0] < tau) i++;
  const a = keys[i - 1], b = keys[i];
  if (tau >= b[0]) return out.set(b[1], b[2], b[3]);
  const f = (tau - a[0]) / (b[0] - a[0] || 1);
  return out.set(pchipAt(keys, i, f, 1), pchipAt(keys, i, f, 2), pchipAt(keys, i, f, 3));
}
// Drehung einer Bahn ([t, qx, qy, qz, qw], aufsteigend) zur Zeit tau, nach out
const GATE_Q = new THREE.Quaternion();
function gateRot(keys, tau, out) {
  if (tau <= keys[0][0]) return out.fromArray(keys[0], 1);
  let i = 1;
  while (i < keys.length - 1 && keys[i][0] < tau) i++;
  const a = keys[i - 1], b = keys[i], f = Math.min(1, (tau - a[0]) / (b[0] - a[0] || 1));
  return out.fromArray(a, 1).slerp(GATE_Q.fromArray(b, 1), f);
}

// Materialien mit denselben Karten legen Tor und Rand zusammen: eins (das
// hellste) je Schlüssel, die übrigen behalten ihre Helligkeit über die
// Abdunkelung (hgShade ist ein Wert, ein farbiger Lack wie der blaue des
// Tors bleibt darum für sich)
const matLum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const matHue = (c) => { const hi = Math.max(c.r, c.g, c.b); return hi > 0 && (hi - Math.min(c.r, c.g, c.b)) / hi > 0.3 ? `|${c.getHexString()}` : ''; };
const matKey = (m) => [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.emissiveMap].map((t) => t?.uuid ?? '-').join('|') + `|${m.alphaTest}|${m.transparent}|${m.side}|${m.metalness}|${m.roughness}${matHue(m.color)}`;

// Baut das Tor im Schachtraum (sh aus buildShaft; inner: Öffnung des Spiels
// [quer, längs]). Liefert { group, parts, batches, used, dropped, tris, T,
// ease, bottom, … }: parts je Teil die Bahnen und die Instanzen, ease die
// Fahrkurve der Plattform aus dem Spiel (0..1 über die Zeit 0..1) oder null.
function buildGate(scene, info, sh, inner) {
  const sz = (2 * sh.hz) / (inner?.[1] ?? 88), T = Math.max(info.anim?.close?.s ?? 0, info.anim?.open?.s ?? 0);
  if (!(sz > 0) || !(T > 0)) throw new Error('Schachttor: Öffnung oder Dauer fehlt');
  // Wie weit ein Teil an der Stelle p ins Feld reicht (< 0: gar nicht)
  const into = (lo, hi, p) => Math.min(
    Math.min(p[0] + hi[0], sh.hx) - Math.max(p[0] + lo[0], -sh.hx),
    Math.min((p[2] + hi[2]) * sz, sh.hz) - Math.max((p[2] + lo[2]) * sz, -sh.hz));
  const parts = [], dropped = [];
  let bottom = 0;
  for (const p of info.parts || []) {
    const node = scene.getObjectByName(p.node), keys = p.keys;
    const pieces = node ? shaftPieces(node, false) : [];
    if (!pieces.length || !(keys?.close?.length > 1) || !(keys?.open?.length > 1)) { dropped.push(`${p.node} fehlt`); continue; }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const q of pieces) for (let i = 0; i < q.pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], q.pos[i + a]); hi[a] = Math.max(hi[a], q.pos[i + a]); }
    const reach = Math.max(...[...keys.close, ...keys.open].map((k) => into(lo, hi, [k[1], k[2], k[3]])));
    const open = keys.open.at(-1);
    if (reach < HALL_GATE.reach) { dropped.push(`${p.node} nie im Feld`); continue; }
    if (into(lo, hi, [open[1], open[2], open[3]]) >= 0) { dropped.push(`${p.node} offen im Feld`); continue; }
    bottom = Math.min(bottom, keys.close.at(-1)[2] + lo[1]);
    // Zylinder kippen um ihren Ursprung (keysRot, dieselben Zeiten wie keys)
    const R = p.keysRot, rot = R?.close?.length > 1 && R.open?.length > 1 ? { close: R.close, open: R.open } : null;
    parts.push({ node: p.node, keys, rot, pieces, lo, hi, at: new THREE.Vector3(open[1], open[2], open[3]), snap: new THREE.Vector3(), q: new THREE.Quaternion(), snapQ: new THREE.Quaternion(), ids: [] });
  }
  if (!parts.length) throw new Error(`Schachttor: kein Teil reicht ins Feld (${dropped.join(', ')})`);
  // Zylinder an der Mittelfuge Stirn an Stirn (20.10.2026 abends, Krisz:
  // „zylinder buggen immernoch ineinander“). Je Fuge zwei Rohre gleichen
  // Querschnitts (außen 0,8 m, innen 0,55 m); geschlossen ragt das eine im
  // Spiel 0,55 m über die Fuge in das andere. Dort liegt das unter den
  // Flügeln, hier sah man es im letzten Spalt: Wand in Wand, und wo die
  // Flächen gleich übereinander liegen, flimmerten sie. Jedes Teil mit
  // Drehung endet geschlossen jetzt an der Fuge (Ebene 0 seiner Fahrachse);
  // die ganze Bahn rückt um das Stück nach außen, gedreht wird um die
  // eigene Achse wie vorher.
  const seam = [];
  for (const u of parts) {
    if (!u.rot) continue;
    const c = u.keys.close.at(-1), o = u.keys.close[0];
    const ax = Math.abs(o[1] - c[1]) >= Math.abs(o[3] - c[3]) ? 0 : 2, from = Math.sign(o[ax + 1] - c[ax + 1]);
    if (!from) continue;
    const over = -from * (c[ax + 1] + (from > 0 ? u.lo[ax] : u.hi[ax]));
    if (over < 0.01) continue;
    for (const ks of [u.keys.close, u.keys.open]) for (const q of ks) q[ax + 1] += from * over;
    u.at.set(u.keys.open.at(-1)[1], u.keys.open.at(-1)[2], u.keys.open.at(-1)[3]);
    seam.push(`${u.node} ${over.toFixed(2)} m`);
  }
  // Offen zu flach in der Nische (GATE_STOW): Bahn längs der Fahrachse ab
  // dem geschlossenen Stand strecken, bis die Innenkante tief genug liegt
  const stowed = [];
  for (const u of parts) {
    const c = u.keys.close.at(-1), o = u.keys.close[0];
    const ax = Math.abs(o[1] - c[1]) >= Math.abs(o[3] - c[3]) ? 0 : 2, k = ax === 0 ? 1 : sz, half = ax === 0 ? sh.hx : sh.hz;
    const run = (o[ax + 1] - c[ax + 1]) * k;
    if (Math.abs(run) < 0.5) continue;
    const edge = (run > 0 ? o[ax + 1] + u.lo[ax] : -(o[ax + 1] + u.hi[ax])) * k, behind = edge - half;
    if (behind >= GATE_STOW) continue;
    const f = 1 + (GATE_STOW - behind) / Math.abs(run);
    for (const ks of [u.keys.close, u.keys.open]) for (const q of ks) q[ax + 1] = c[ax + 1] + (q[ax + 1] - c[ax + 1]) * f;
    u.at.set(u.keys.open.at(-1)[1], u.keys.open.at(-1)[2], u.keys.open.at(-1)[3]);
    stowed.push(`${u.node} +${(GATE_STOW - behind).toFixed(2)} m`);
  }
  // Offen zu tief: Die Flügel und was mit ihnen fährt liegen im Spiel offen
  // 12 m hinter unserer Wand, hinter der Rückwand der Nische, und schossen
  // beim Schließen in 0,08 s durch sie hindurch (19.10.2026, Krisz:
  // „siehstr du wie es einfach aus dem nichts erscheint?“). Jede Bahn endet
  // darum GATE_STOW hinter der Wandebene: Offen liegt alles dunkel in der
  // Nische bereit wie die Stirnplatten und fährt von dort aus.
  const cut = [];
  for (const u of parts) {
    const c = u.keys.close.at(-1), o = u.keys.close[0];
    const ax = Math.abs(o[1] - c[1]) >= Math.abs(o[3] - c[3]) ? 0 : 2, k = ax === 0 ? 1 : sz, half = ax === 0 ? sh.hx : sh.hz;
    const run = (o[ax + 1] - c[ax + 1]) * k;
    if (Math.abs(run) < 0.5) continue;
    const lim = run > 0 ? (half + GATE_STOW) / k - u.lo[ax] : -(half + GATE_STOW) / k - u.hi[ax];
    let most = 0;
    for (const ks of [u.keys.close, u.keys.open]) for (const q of ks) {
      const v = run > 0 ? Math.min(q[ax + 1], lim) : Math.max(q[ax + 1], lim);
      most = Math.max(most, Math.abs(q[ax + 1] - v) * k);
      q[ax + 1] = v;
    }
    if (most < 0.01) continue;
    u.at.set(u.keys.open.at(-1)[1], u.keys.open.at(-1)[2], u.keys.open.at(-1)[3]);
    cut.push(`${u.node} −${most.toFixed(2)} m`);
  }
  // Deckt das Tor auf der Bahn dir zur Zeit t das Feld ganz? Jede Zelle
  // (0,25 m) unter einem Teil, das bis an den Boden reicht (wie
  // verify:hangar-hall [15])
  const CELL = 0.25, nx = Math.round((2 * sh.hx) / CELL), nz = Math.round((2 * sh.hz) / CELL), cells = new Uint8Array(nx * nz), at = new THREE.Vector3(), at2 = new THREE.Vector3();
  const floor = (u, p) => p.y + u.hi[1] >= -0.5;
  const full = (dir, t) => {
    cells.fill(0);
    for (const u of parts) {
      gateAt(u.keys[dir], t, at);
      if (!floor(u, at)) continue;
      const i0 = Math.max(0, Math.ceil((at.x + u.lo[0] + sh.hx) / CELL - 0.5)), i1 = Math.min(nx - 1, Math.floor((at.x + u.hi[0] + sh.hx) / CELL - 0.5));
      const j0 = Math.max(0, Math.ceil(((at.z + u.lo[2]) * sz + sh.hz) / CELL - 0.5)), j1 = Math.min(nz - 1, Math.floor(((at.z + u.hi[2]) * sz + sh.hz) / CELL - 0.5));
      for (let j = j0; j <= j1; j++) cells.fill(1, j * nx + i0, j * nx + i1 + 1);
    }
    return cells.indexOf(0) < 0;
  };
  // Ab wann das Tor das Feld ganz deckt: früheste Zeit der Schließbahn, zu
  // der es full ist. Riegel, die danach noch fahren, zählen so nicht mit.
  const times = [...new Set(parts.flatMap((u) => u.keys.close.map((k) => k[0])))].sort((a, b) => a - b);
  let cover = 0;
  for (const t of times) if (full('close', t)) { cover = t; break; }
  // Alle vier Seiten zugleich (19.10.2026, Krisz: „wenn der platform
  // runterfährt und die schacht zu geht kommen erst die 2 kurzen seiten und
  // erst dann die 2 langen. alle sollen gleichzeitig starten aber die gesamt
  // länge von der animation hat gepasst“). Im Spiel fahren alle Teile ab 0
  // los, die Flügel kommen aber aus 28 m und liegen bis zu unserer Wand bei
  // 16 m unter dem Boden: Beim Schließen sah man erst die Stirnplatten (0,94
  // bis 4,2 s der Bahn), dann die Flügel (4,2 bis 11,25 s), beim Öffnen
  // umgekehrt. Je Seite (Teile mit derselben Fahrachse und -richtung) und
  // Bahn wird die Zeit deshalb umgelegt: Der Abschnitt, in dem Teile der
  // Seite bis an den Boden in Nische oder Feld fahren, solange es nicht
  // zwischen zwei Stützstellen ganz gedeckt ist (die Riegel rasten danach
  // ein), wird auf den aller Seiten zusammen gedehnt; davor und danach
  // läuft der Rest der Bahn gerafft. Anfang und Ende des Wechsels bleiben,
  // wie sie waren, so auch cover (wie bisher an den Stützstellen des Spiels
  // gemessen). Seit die Bahnen in der Nische enden (cut), beginnt der
  // Abschnitt dort: Alle Seiten fahren zugleich aus ihr los.
  const sides = new Map(), sync = [], N = 500;
  for (const u of parts) {
    const c = u.keys.close.at(-1), o = u.keys.close[0], ax = Math.abs(o[1] - c[1]) >= Math.abs(o[3] - c[3]) ? 1 : 3;
    if (Math.abs(o[ax] - c[ax]) < 0.5) continue;
    const k = `${ax === 1 ? 'x' : 'z'}${o[ax] > c[ax] ? '+' : '-'}`;
    if (!sides.has(k)) sides.set(k, []);
    sides.get(k).push(u);
  }
  for (const dir of ['close', 'open']) {
    const kt = [...new Set(parts.flatMap((u) => u.keys[dir].map((k) => k[0])))].sort((a, b) => a - b), kf = kt.map((t) => full(dir, t));
    const sealed = (t) => { let j = 0; while (j < kt.length - 2 && kt[j + 1] <= t) j++; return kf[j] && kf[j + 1]; };
    const ts = Array.from({ length: N + 1 }, (_, i) => (T * i) / N), ss = ts.map(sealed), span = new Map();
    for (const [k, us] of sides) {
      let a = Infinity, b = -Infinity;
      for (const u of us) for (let i = 0; i < N; i++) {
        if (ss[i] && ss[i + 1]) continue;
        gateAt(u.keys[dir], ts[i], at); gateAt(u.keys[dir], ts[i + 1], at2);
        if (at.distanceTo(at2) < 1e-4 || !floor(u, at) || Math.max(into(u.lo, u.hi, at.toArray()), into(u.lo, u.hi, at2.toArray())) <= -GATE_STOW - 0.05) continue;
        a = Math.min(a, ts[i]); b = Math.max(b, ts[i + 1]);
      }
      if (b > a) span.set(k, [a, b]);
    }
    if (span.size < 2) continue;
    const S = Math.min(...[...span.values()].map((s) => s[0])), E = Math.max(...[...span.values()].map((s) => s[1]));
    for (const [k, [a, b]] of span) {
      const w = (t) => (t <= a ? (a > 0 ? (t * S) / a : S) : t <= b ? S + ((t - a) * (E - S)) / (b - a) : E + ((t - b) * (T - E)) / (T - b));
      // Was auf null Zeit gerafft würde (S = 0 oder E = T), fällt weg: Dort
      // steht die Seite in der Nische, und die Zylinder klappten sonst mit
      // einem Bild in die Lage bei a oder b um
      const keep = ([t]) => !((t < a && S <= 0) || (t > b && E >= T));
      for (const u of sides.get(k)) {
        const ks = u.keys[dir].filter(keep).map(([t, x, y, z]) => [w(t), x, y, z]);
        for (const t of [a, b]) { gateAt(u.keys[dir], t, at); ks.push([w(t), at.x, at.y, at.z]); }
        u.keys = { ...u.keys, [dir]: ks.sort((p, q) => p[0] - q[0]) };
        if (u.rot) {
          const rs = u.rot[dir].filter(keep).map(([t, ...q]) => [w(t), ...q]), q = new THREE.Quaternion();
          for (const t of [a, b]) rs.push([w(t), ...gateRot(u.rot[dir], t, q).toArray()]);
          u.rot = { ...u.rot, [dir]: rs.sort((p, q) => p[0] - q[0]) };
        }
      }
      sync.push(`${dir === 'close' ? 'zu' : 'auf'} ${k} ${a.toFixed(2)}–${b.toFixed(2)}`);
    }
    sync.push(`${dir === 'close' ? 'zu' : 'auf'} alle ${S.toFixed(2)}–${E.toFixed(2)} s`);
  }
  // Palettenlacke in der Farbe des Spiels (GATE_PALETTE)
  const pal = info.palette, lacke = [];
  for (const u of parts) for (const q of u.pieces) {
    const e = pal?.entries?.[GATE_PALETTE[pal.layers?.[q.mat.name.split('_mtl_').pop()] ?? 0]];
    if (!e?.linear || q.mat.userData.gatePal) continue;
    q.mat.color.setRGB(e.linear[0], e.linear[1], e.linear[2]);
    q.mat.userData.gatePal = true;
    lacke.push(q.mat.name.split('_mtl_').pop());
  }
  // Materialien zusammenlegen (matKey)
  const lum = matLum, keyOf = matKey;
  const groups = new Map();
  for (const u of parts) for (const q of u.pieces) {
    const k = keyOf(q.mat);
    if (!groups.has(k)) groups.set(k, { mat: q.mat, inst: 0, vert: 0, idx: 0, mats: new Set() });
    const g = groups.get(k);
    g.mats.add(q.mat.name);
    if (lum(q.mat.color) > lum(g.mat.color)) g.mat = q.mat;
    g.inst++; g.vert += q.pos.length / 3; g.idx += q.idx.length;
  }
  const group = new THREE.Group(), batches = [];
  group.name = 'shaft:gate';
  group.scale.set(1, 1, sz);
  for (const g of groups.values()) {
    const b = new THREE.BatchedMesh(g.inst, g.vert, g.idx, g.mat);
    b.name = `gate:${g.mat.name}`;
    b.frustumCulled = false; b.sortObjects = false;
    b.castShadow = false; b.receiveShadow = false;
    g.b = b;
    group.add(b);
    batches.push(b);
  }
  let tris = 0;
  for (const u of parts) for (const q of u.pieces) {
    const g = groups.get(keyOf(q.mat)), n = q.pos.length / 3, k = Math.min(1, lum(q.mat.color) / Math.max(1e-6, lum(g.mat.color)));
    const geo = new THREE.BufferGeometry(), sh3 = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = Math.round(Math.min(1, Math.max(0, q.sh[i] * k)) * 255);
      sh3[i * 3] = d; sh3[i * 3 + 1] = Math.round(Math.min(1, Math.max(0, q.wear[i])) * 255); sh3[i * 3 + 2] = d;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(q.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(q.nor, 3));
    // Lacke im Maßstab des Hallenbodens (GATE_FLOOR), je Fläche aus der
    // Richtung, in die sie zeigt; im geschlossenen Stand und längs gestreckt.
    // Entscheidend ist das Material der Gruppe: Der ungefärbte Lack
    // (paint_c_notint, ein Drittel der Oberseite) teilt die Karten mit
    // paint_b und zeichnet mit dessen Material.
    let uv = q.uv ?? new Float32Array(n * 2);
    if (GATE_FLOOR.re.test(g.mat.name)) {
      const c = u.keys.close.at(-1), s = 1 / GATE_FLOOR.tile;
      uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const x = q.pos[i * 3] + c[1], y = q.pos[i * 3 + 1] + c[2], z = (q.pos[i * 3 + 2] + c[3]) * sz;
        const ax = Math.abs(q.nor[i * 3]), ay = Math.abs(q.nor[i * 3 + 1]), az = Math.abs(q.nor[i * 3 + 2]);
        uv[i * 2] = (ay >= ax && ay >= az ? x : ax >= az ? z : x) * s;
        uv[i * 2 + 1] = (ay >= ax && ay >= az ? z : y) * s;
      }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('hgShade', new THREE.BufferAttribute(sh3, 3, true));
    geo.setIndex(new THREE.BufferAttribute(q.idx, 1));
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    u.ids.push({ b: g.b, iid: g.b.addInstance(g.b.addGeometry(geo)) });
    tris += q.idx.length / 3;
  }
  // addGeometry hat kopiert; gatePose braucht nur Bahnen, Lage und Exemplare
  for (const u of parts) u.pieces = null;
  // Fahrkurve der Plattform (door_close: 0 bis −36 m), auf 0..1 gebracht;
  // nur wenn sie stetig steigt
  const pad = info.anim?.pad?.down?.keys, ps = info.anim?.pad?.down?.s;
  let ease = null;
  if (Array.isArray(pad) && pad.length > 2 && ps > 0) {
    const depth = pad.at(-1)[1], f = pad.map(([t, y]) => [t / ps, y / depth]);
    if (depth < 0 && f.every((v, i) => i === 0 || (v[0] > f[i - 1][0] && v[1] >= f[i - 1][1]))) {
      // monoton kubisch wie die Bahnen des Tors (pchipAt)
      ease = (k) => {
        if (k <= 0) return 0;
        if (k >= 1) return 1;
        let i = 1;
        while (i < f.length - 1 && f[i][0] < k) i++;
        const a = f[i - 1], b = f[i];
        return pchipAt(f, i, (k - a[0]) / (b[0] - a[0]), 1);
      };
    }
  }
  // cover: ab hier auf der Bahn zu ist das Feld ganz gedeckt (danach rasten nur noch die Riegel ein)
  const G = { group, parts, batches, used: parts.length, dropped, seam, stowed, cut, sync, lacke, turn: parts.filter((u) => u.rot).length, tris, T, cover: cover || T, ease, bottom, sz, mats: [...groups.values()].map((g) => [...g.mats].map((n) => n.split('_mtl_').pop()).join('+')), state: 'open', run: null, pend: null, wait: [], v: new THREE.Vector3(), q: new THREE.Quaternion(), one: new THREE.Vector3(1, 1, 1), M: new THREE.Matrix4() };
  gatePose(G, 'open', T);
  return G;
}

// Alle Teile auf ihre Bahn `dir` zur Zeit tau; blend < 1: von snap dorthin
function gatePose(G, dir, tau, blend = 1) {
  for (const u of G.parts) {
    gateAt(u.keys[dir], tau, G.v);
    if (blend < 1) G.v.lerpVectors(u.snap, G.v, blend);
    u.at.copy(G.v);
    if (u.rot) {
      gateRot(u.rot[dir], tau, G.q);
      if (blend < 1) G.q.slerpQuaternions(u.snapQ, G.q, blend);
      u.q.copy(G.q);
      G.M.compose(G.v, G.q, G.one);
    } else G.M.makeTranslation(G.v.x, G.v.y, G.v.z);
    for (const id of u.ids) id.b.setMatrixAt(id.iid, G.M);
  }
}

// Fester Rand um die Öffnung (19.10.2026, Krisz: „es soll so aussehen wie
// ein element was da fest verbaut ist und soll halt ein glaubhaftes
// mechanismus sein“). Im Spiel liegt zwischen Schachtkante und Hallenboden
// ein 4 m breiter Gitterstegring, bündig mit dem Boden, darin Landeleuchten
// und an den Stirnseiten der Schriftzug des Hangars; das Tor kommt aus der
// Fuge zwischen Plattformkante und Steg (public/hangar/lift/medtop-rand.glb,
// PC-Befund in .planning/notes/hangar-schachttor.md). Hier liegt er rund um
// unser Feld, der Hallenboden darunter wird ausgespart (hgCut im
// Hallenshader). Die Teile kommen je Art von einem Exemplar des Spiels und
// werden wie die Wände des Schachts je Seite gereiht: im Bezugssystem ihrer
// Seite (a entlang, w nach außen ab der Schachtkante) genommen und auf
// unsere Seite gestellt. `long`/`cross`: [Knoten, an a] je Seite, `lights`:
// [Knoten, an a] auf jeder Seite ihrer Art, `corner`: an jedem Seitenanfang,
// `once`: [Knoten, an a] nur auf der Seite des Exemplars. Die Warnlampen
// der Ecken stehen schon im Schacht (light_1).
// verify:hangar-hall [16] liest den Block und prüft ihn an den Dateien.
const HALL_RAND = /* hall-rand */ {
  "width": 4,
  "corner": ["rand_stegecke_2", "rand_landeleuchte_2"],
  "long": [["rand_steg_1", 0], ["rand_steg_1", 24], ["rand_steg_1", 48], ["rand_steg_1", 72]],
  "cross": [["rand_steg_5", 0], ["rand_steg_7", 24], ["rand_logo_0", 16]],
  "lights": { "long": [["rand_landeleuchte_3", 12], ["rand_landeleuchte_3", 24], ["rand_landeleuchte_3", 36], ["rand_landeleuchte_3", 48], ["rand_landeleuchte_3", 60], ["rand_landeleuchte_3", 72], ["rand_landeleuchte_3", 84]], "cross": [["rand_landeleuchte_22", 7], ["rand_landeleuchte_22", 25]] },
  "once": [["rand_bodenleuchte_0", 11.9], ["rand_bodenleuchte_1", 20.2]]
} /* /hall-rand */;
const RAND_GLOW = 2.5;   // Leuchtkraft der Lande- und Bodenleuchten im Steg

// Seiten eines Schachts mit halben Maßen hx, hz: Anfang o (linke Innenecke
// von der Mitte gesehen), t entlang, n nach außen; wie shaftSides
const randSide = (hx, hz) => shaftSides(hx, hz).map((s) => ({ ...s, kind: s.n[0] ? 'long' : 'cross' }));
// Seite des Spiels, auf der ein Exemplar liegt (Mitte c im Schachtraum des
// Spiels, gx, gz halbe Öffnung): bei Ecken die, an deren Anfang es liegt
function randSideOf(c, gx, gz) {
  const S = randSide(gx, gz);
  let best = 0, bd = Infinity;
  S.forEach((s, i) => {
    const a = (c[0] - s.o[0]) * s.t[0] + (c[2] - s.o[1]) * s.t[1], w = (c[0] - s.o[0]) * s.n[0] + (c[2] - s.o[1]) * s.n[1];
    // außen (w >= 0), entlang so nah wie möglich in [−4, len]
    const d = (w < -0.5 ? 100 : 0) + Math.max(0, -4 - a) + Math.max(0, a - s.len);
    if (d < bd) { bd = d; best = i; }
  });
  return S[best];
}

// Baut den Rand im Schachtraum (sh aus buildShaft; inner: Öffnung des
// Spiels [quer, längs]). Liefert { group, meshes, materials, tris, parts }
// oder wirft, wenn ein Knoten fehlt.
function buildRand(scene, info, sh, inner) {
  const gx = (inner?.[0] ?? 56) / 2, gz = (inner?.[1] ?? 88) / 2, ours = randSide(sh.hx, sh.hz);
  const cache = new Map();
  // Stücke eines Exemplars im Bezugssystem seiner Seite: [a, y, w]
  const local = (name) => {
    if (cache.has(name)) return cache.get(name);
    const node = scene.getObjectByName(name);
    if (!node) throw new Error(`Rand: Knoten ${name} fehlt`);
    const pieces = shaftPieces(node, false);
    const b = new THREE.Box3().setFromObject(node), c = b.getCenter(new THREE.Vector3()).toArray();
    const s = randSideOf(c, gx, gz);
    for (const p of pieces) {
      for (let i = 0; i < p.pos.length; i += 3) {
        const x = p.pos[i] - s.o[0], z = p.pos[i + 2] - s.o[1];
        p.pos[i] = x * s.t[0] + z * s.t[1]; p.pos[i + 2] = x * s.n[0] + z * s.n[1];
        const nx = p.nor[i], nz = p.nor[i + 2];
        p.nor[i] = nx * s.t[0] + nz * s.t[1]; p.nor[i + 2] = nx * s.n[0] + nz * s.n[1];
      }
    }
    let a0 = Infinity;
    for (const p of pieces) for (let i = 0; i < p.pos.length; i += 3) a0 = Math.min(a0, p.pos[i]);
    const out = { pieces, a0, side: s };
    cache.set(name, out);
    return out;
  };
  // Seitenteil an a (Anfang des Exemplars an a; Ecken, Leuchten und
  // Schriftzug: deren Mitte, siehe at)
  const list = [];   // [Stücke, Seite, Verschiebung entlang]
  const put = (name, s, da) => list.push([local(name).pieces, s, da]);
  const mid = (name) => { const L = local(name); let lo = Infinity, hi = -Infinity; for (const p of L.pieces) for (let i = 0; i < p.pos.length; i += 3) { lo = Math.min(lo, p.pos[i]); hi = Math.max(hi, p.pos[i]); } return (lo + hi) / 2; };
  for (const s of ours) {
    for (const n of HALL_RAND.corner) put(n, s, 0);
    for (const [n, a] of HALL_RAND[s.kind]) put(n, s, /steg/.test(n) ? a - local(n).a0 : a - mid(n));
    for (const [n, a] of HALL_RAND.lights[s.kind]) put(n, s, a - mid(n));
  }
  for (const [n, a] of HALL_RAND.once) {
    const L = local(n), s = ours.find((q) => q.t[0] === L.side.t[0] && q.t[1] === L.side.t[1]);
    put(n, s, a - mid(n));
  }
  // je Material ein Mesh (zusammengelegt wie beim Tor, matKey);
  // Seitenrahmen zurück in den Schachtraum
  const by = new Map();
  for (const [pieces, s, da] of list) for (const p of pieces) {
    const k = matKey(p.mat);
    if (!by.has(k)) by.set(k, { mat: p.mat, items: [] });
    const g = by.get(k);
    if (matLum(p.mat.color) > matLum(g.mat.color)) g.mat = p.mat;
    g.items.push([p, s, da]);
  }
  const group = new THREE.Group(), meshes = [];
  group.name = 'shaft:rand';
  let tris = 0;
  for (const { mat, items } of by.values()) {
    let nv = 0, ni = 0;
    for (const [p] of items) { nv += p.pos.length / 3; ni += p.idx.length; }
    const withUv = items.every(([p]) => p.uv);
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), shd = new Uint8Array(nv * 3), idx = new Uint32Array(ni), uv = withUv ? new Float32Array(nv * 2) : null;
    let ov = 0, oi = 0;
    for (const [p, s, da] of items) {
      const cnt = p.pos.length / 3, f = Math.min(1, matLum(p.mat.color) / Math.max(1e-6, matLum(mat.color)));
      for (let i = 0; i < cnt; i++) {
        const j = i * 3, k = (ov + i) * 3, a = p.pos[j] + da, w = p.pos[j + 2];
        pos[k] = s.o[0] + a * s.t[0] + w * s.n[0]; pos[k + 1] = p.pos[j + 1]; pos[k + 2] = s.o[1] + a * s.t[1] + w * s.n[1];
        nor[k] = p.nor[j] * s.t[0] + p.nor[j + 2] * s.n[0]; nor[k + 1] = p.nor[j + 1]; nor[k + 2] = p.nor[j] * s.t[1] + p.nor[j + 2] * s.n[1];
        const d = Math.round(Math.min(1, Math.max(0, p.sh[i] * f)) * 255);
        shd[k] = d; shd[k + 1] = Math.round(Math.min(1, Math.max(0, p.wear[i])) * 255); shd[k + 2] = d;
      }
      if (uv) uv.set(p.uv, ov * 2);
      for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + ov;
      ov += cnt; oi += p.idx.length;
    }
    // eine ungültige Lage zeichnete das ganze Mesh nicht, still
    if (!pos.every(Number.isFinite)) throw new Error(`Rand: ${mat.name} mit ungültiger Lage`);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('hgShade', new THREE.BufferAttribute(shd, 3, true));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = `rand:${mat.name}`;
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.userData.noUv = !uv;
    group.add(mesh);
    meshes.push(mesh);
    tris += ni / 3;
  }
  return { group, meshes, materials: meshes.map((m) => m.material), tris, parts: list.length, width: HALL_RAND.width };
}

// Beiwerk des Spiels im Schacht (Schacht-Tiefe Teil B, 17.10.2026): je Art
// ein Knoten im Bausatz, die Exemplare in info.deco (Lage im Schachtraum des
// Spiels, Drehung q, Maßstab), über dieselbe Abbildung wie die Lampen auf
// diesen Schacht. Was über y −0,5 liegt, steht auf dem Hallenboden und
// bleibt weg, ebenso ein Exemplar ohne Drehung; verify:hangar-hall [11]
// zählt mit derselben Regel. Doppelte mit Rippen und Ecken gibt es im
// Bausatz vom 17.10.2026 nicht (geprüft beim Einbau). Die Leitlinien am
// Rand sind Markierungen einer anderen Marke (Atlas mit Schriftzug) und
// warten auf ein Sichturteil.
const SHAFT_DECO = /* shaft-deco */ ["deco_leuchte_0", "deco_lichtrahmen_0"] /* /shaft-deco */;
const SHAFT_DECO_GLOW = [1.5, 0.8];   // Leuchtkraft der Lichtrahmen und des Leuchtenglases während der Fahrt
function shaftDecoList(kit, info, hx, hz, lay) {
  const map = shaftMap(info, hx, hz, lay), list = [];
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  for (const d of info.deco || []) {
    if (!SHAFT_DECO.includes(d.node)) continue;
    const node = kit.getObjectByName(d.node);
    if (!node) continue;
    const parts = shaftPieces(node, false);
    for (const e of d.at || []) {
      if (!(e.at?.[1] < -0.5) || !(Array.isArray(e.q) && e.q.length === 4)) continue;
      q.set(e.q[0], e.q[1], e.q[2], e.q[3]);
      M.compose(v.fromArray(map(e.at)), q, s.setScalar(e.scale ?? 1));
      list.push([parts, M.clone()]);
    }
  }
  return list;
}

// Die vier Ränder der Öffnung im Schachtraum: Anfang, Richtung entlang,
// Richtung nach außen (vom Schacht weg), Länge
const shaftSides = (hx, hz) => [
  { o: [hx, -hz], t: [0, 1], n: [1, 0], len: 2 * hz },
  { o: [-hx, hz], t: [0, -1], n: [-1, 0], len: 2 * hz },
  { o: [hx, hz], t: [-1, 0], n: [0, 1], len: 2 * hx },
  { o: [-hx, -hz], t: [1, 0], n: [0, -1], len: 2 * hx },
];

// Bodenplatte der Halle am Rand des Felds: die Unterseiten, die außen an
// der Feldkante ansetzen (Schachtraum, `at` sein Ursprung im Modellraum).
// Liefert die Höhe, an der die meiste Kantenlänge hängt, als Dicke `t`,
// dazu ihr Material und ihr Texturmaß quer zur Kante und entlang (UV an
// der Kante, je Meter entlang, je Meter nach außen), oder null.
async function hallSlab(model, L, at, skip, pause = noPause) {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert(), M = new THREE.Matrix4();
  const hx = (L.to[0] - L.from[0]) / 2, hz = (L.to[1] - L.from[1]) / 2, E = 0.05, sides = shaftSides(hx, hz);
  const Y0 = at[1] - 3, Y1 = at[1] - 0.35;   // Unterseite tiefer als die des Felds (0,3 m)
  // je Rand ein schmaler Kasten um die Kante: nur Dreiecke mit einer Ecke darin
  const strips = sides.map((s) => new THREE.Box3().setFromPoints([
    new THREE.Vector3(at[0] + s.o[0] - E, Y0, at[2] + s.o[1] - E),
    new THREE.Vector3(at[0] + s.o[0] + s.t[0] * s.len + E, Y1, at[2] + s.o[1] + s.t[1] * s.len + E),
  ]).expandByVector(new THREE.Vector3(E, 0, E)));
  const band = strips.reduce((b, k) => b.union(k), new THREE.Box3());
  const bb = new THREE.Box3(), Mi = new THREE.Matrix4(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), W = new THREE.Vector3();
  const meshes = [];
  model.traverse((n) => {
    if (!n.isMesh || !n.geometry.index || n.geometry.groups.length || !n.geometry.attributes.uv || Array.isArray(n.material)) return;
    for (let p = n; p; p = p.parent) if (skip.has(p)) return;
    meshes.push(n);
  });
  const by = new Map();
  for (const mesh of meshes) {
    await pause();
    const g = mesh.geometry, P = g.attributes.position, U = g.attributes.uv, I = g.index.array;
    M.multiplyMatrices(toModel, mesh.matrixWorld);
    const flip = M.determinant() < 0 ? -1 : 1;   // gespiegelt: Umlaufsinn kehrt sich um
    if (!g.boundingBox) g.computeBoundingBox();
    if (!bb.copy(g.boundingBox).applyMatrix4(M).intersectsBox(band)) continue;
    // wie cutHallLift: erst die Ecken grob im Knotenraum (dorthin gedrehte
    // Kästen), dann genau die Dreiecke, die mit einer Ecke an der Kante
    // liegen (die Platten reichen 8 m nach außen)
    const raw = !P.isInterleavedBufferAttribute && !P.normalized && P.itemSize === 3 ? P.array : null;
    Mi.copy(M).invert();
    const nb = strips.map((k) => k.clone().applyMatrix4(Mi)).filter((k) => !raw || k.intersectsBox(g.boundingBox)).map((k) => [k.min.x, k.min.y, k.min.z, k.max.x, k.max.y, k.max.z]);
    if (!nb.length) continue;
    // die Höhe zuerst: Boden und Wände fallen dort schon heraus
    const ylo = Math.min(...nb.map((k) => k[1])), yhi = Math.max(...nb.map((k) => k[4])), nk = nb.length;
    const near = new Uint8Array(P.count);
    let found = 0;
    for (let i = 0; i < P.count; i++) {
      if (!(i & 16383)) await pause();
      if (raw) {
        const y = raw[i * 3 + 1];
        if (y < ylo || y > yhi) continue;
        const x = raw[i * 3], z = raw[i * 3 + 2];
        for (let j = 0; j < nk; j++) {
          const k = nb[j];
          if (x >= k[0] && x <= k[3] && y >= k[1] && y <= k[4] && z >= k[2] && z <= k[5]) { near[i] = 1; found++; break; }
        }
      } else if (strips.some((k) => k.containsPoint(A.fromBufferAttribute(P, i).applyMatrix4(M)))) { near[i] = 1; found++; }
    }
    if (!found) continue;
    for (let t = 0; t + 2 < I.length; t += 3) {
      if (!(t % 49152)) await pause();
      const ia = I[t], ib = I[t + 1], ic = I[t + 2];
      if (!near[ia] && !near[ib] && !near[ic]) continue;
      A.fromBufferAttribute(P, ia).applyMatrix4(M); B.fromBufferAttribute(P, ib).applyMatrix4(M); C.fromBufferAttribute(P, ic).applyMatrix4(M);
      if (A.y > Y1 || A.y < Y0 || Math.abs(B.y - A.y) > 0.01 || Math.abs(C.y - A.y) > 0.01) continue;
      // nach unten gewandt
      N.subVectors(B, A).cross(W.subVectors(C, A)).multiplyScalar(flip);
      if (N.y > -0.99 * N.length() || N.y > -1e-6) continue;
      const q = [A, B, C].map((v) => [v.x - at[0], v.z - at[2]]);
      for (const s of sides) {
        const off = s.n[0] ? s.n[0] * s.o[0] : s.n[1] * s.o[1];   // Abstand der Kante von der Mitte
        const pa = q.map(([x, z]) => (x - s.o[0]) * s.t[0] + (z - s.o[1]) * s.t[1]), pc = q.map(([x, z]) => x * s.n[0] + z * s.n[1] - off);
        if ((pc[0] + pc[1] + pc[2]) / 3 < E) continue;   // außen am Feld
        let len = 0;
        for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
          if (Math.abs(pc[i]) < E && Math.abs(pc[j]) < E && Math.min(pa[i], pa[j]) > -E && Math.max(pa[i], pa[j]) < s.len + E) len += Math.abs(pa[j] - pa[i]);
        }
        if (len < 0.5) continue;
        const k = Math.round((at[1] - A.y) * 100);
        const e = by.get(k) ?? { len: 0, best: 0 };
        e.len += len;
        if (len > e.best) {
          // UV(a, c) = U0 + Ga a + Gc c aus den drei Ecken
          const da1 = pa[1] - pa[0], dc1 = pc[1] - pc[0], da2 = pa[2] - pa[0], dc2 = pc[2] - pc[0], det = da1 * dc2 - da2 * dc1;
          if (Math.abs(det) > 1e-6) {
            const uv = [ia, ib, ic].map((i) => [U.getX(i), U.getY(i)]);
            const grad = [0, 1].map((c) => {
              const d1 = uv[1][c] - uv[0][c], d2 = uv[2][c] - uv[0][c];
              const ga = (d1 * dc2 - d2 * dc1) / det, gc = (da1 * d2 - da2 * d1) / det;
              return [uv[0][c] - ga * pa[0] - gc * pc[0], ga, gc];
            });
            Object.assign(e, { best: len, mat: mesh.material, grad });
          }
        }
        by.set(k, e);
      }
    }
  }
  let top = null;
  for (const [k, e] of by) if (e.mat && (!top || e.len > top.len)) top = { t: k / 100, ...e };
  return top;
}

// Stirn der Bodenplatte rund um die Öffnung, im Material der Platte: ihre
// Unterseite an der Kante hochgeklappt (dasselbe Texturmaß, an der Kante
// nahtlos), SHAFT_EDGE_GAP hinter der Wandebene, von der Oberkante bis an
// die Decke der Nische (SHAFT_SLOT_LIP, 2 cm darunter, damit keine Fuge
// bleibt): Darunter ist der Schlitz, aus dem das Tor fährt. Je Rand
// 8-m-Stücke (Licht und Spiegelung je Bildpunkt).
function shaftEdge(slab, hx, hz) {
  const pos = [], nor = [], uv = [], g = SHAFT_EDGE_GAP, [Ua, Ub] = slab.grad, t = slab.t, b = Math.min(t, SHAFT_SLOT_LIP + 0.02);
  for (const s of shaftSides(hx, hz)) {
    const n = Math.ceil((s.len + 2 * g) / 8);
    for (let i = 0; i < n; i++) {
      const a0 = -g + (s.len + 2 * g) * i / n, a1 = -g + (s.len + 2 * g) * (i + 1) / n;
      const at = (a, y) => {
        pos.push(s.o[0] + s.t[0] * a + s.n[0] * g, y, s.o[1] + s.t[1] * a + s.n[1] * g);
        nor.push(-s.n[0], 0, -s.n[1]);
        // hochgeklappt: Höhe y über der Unterseite entspricht y + t nach außen
        uv.push(Ua[0] + Ua[1] * a + Ua[2] * (y + t), Ub[0] + Ub[1] * a + Ub[2] * (y + t));
      };
      // zur Schachtmitte gewandt
      for (const [a, y] of [[a0, 0], [a1, -b], [a1, 0], [a0, 0], [a0, -b], [a1, -b]]) at(a, y);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // Abdunkelung aus dem Spiel (hgShade) neutral: Trägt das Material sie,
  // läse der Shader ein fehlendes Attribut als Schwarz
  geo.setAttribute('hgShade', new THREE.BufferAttribute(new Uint8Array(pos.length).fill(255), 3, true));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, slab.mat);
  mesh.name = 'shaft:edge';
  return mesh;
}

// Lampen des Spielschachts auf diesem Schacht: an derselben Wand im selben
// Abstand zur Wand, entlang der Wand nach dem Bausatz (Rippe auf Rippe, Ecke
// auf Ecke, dazwischen anteilig); Lampen an der Plattform anteilig auf dem
// Feld. Liefert je Lampe { pos, dir, cosO, col, kind, r } im Schachtraum;
// kind als Bits: 1 blinkt, 2 an der Plattform (fährt mit), 4 nur auf die
// Wände (die Bodenstrahler hängen einen Meter über der Plattform unten; ohne
// Verdeckung gleißten sie darauf als helle Bahnen).
// Farbe aus Farbe mal Farbtemperatur, wie im Spiel (useTemperature).
const kelvin = (t) => {
  // Näherung nach Tanner Helland, 1000 bis 40 000 K
  const k = Math.min(400, Math.max(10, t / 100));
  const r = k <= 66 ? 255 : 329.698727446 * Math.pow(k - 60, -0.1332047592);
  const g = k <= 66 ? 99.4708025861 * Math.log(k) - 161.1195681661 : 288.1221695283 * Math.pow(k - 60, -0.0755148492);
  const b = k >= 66 ? 255 : k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  return [r, g, b].map((c) => Math.min(1, Math.max(0, c / 255)));
};
// Abbildung Spielschacht -> dieser Schacht für Lampen und Beiwerk: Lage im
// Schachtraum des Spiels (x quer, z längs, y ab Hallenboden) auf hier, `pad`
// für Teile an der Plattform
function shaftMap(info, hx, hz, lay) {
  const g = info.shaft?.inner ? [info.shaft.inner[0] / 2, info.shaft.inner[1] / 2] : [28, 44];
  // Stützstellen entlang der Wände (Spiel -> hier): Ecken, Eckkanten, Rippen
  const ribs = (kind, half, gh) => (lay.lamps[kind] || []).map((a) => a - half).filter((c) => Math.abs(c) < half - 4);
  const anchors = (gh, h, ours) => {
    const game = { 28: [-20, 0, 20], 44: [0] }[gh] ?? [0];
    const mine = ours.length === game.length ? ours : game.map((c) => c * h / gh);
    return [[-gh, -h], [-(gh - 4), -(h - 4)], ...game.map((c, i) => [c, mine[i]]), [gh - 4, h - 4], [gh, h]].sort((p, q) => p[0] - q[0]);
  };
  const crossA = anchors(g[0], hx, [...ribs('cross', hx, g[0]), 0].sort((p, q) => p - q));
  const longA = anchors(g[1], hz, ribs('long', hz, g[1]));
  const along = (c, A) => {
    if (c <= A[0][0]) return A[0][1] + (c - A[0][0]);
    for (let i = 1; i < A.length; i++) if (c <= A[i][0]) {
      const [x0, y0] = A[i - 1], [x1, y1] = A[i];
      return y0 + (c - x0) * (y1 - y0) / (x1 - x0 || 1);
    }
    return A[A.length - 1][1] + (c - A[A.length - 1][0]);
  };
  return ([x, y, z], pad) => {
    if (pad) return [x * hx / g[0], y, along(z, longA)];
    const dx = g[0] - Math.abs(x), dz = g[1] - Math.abs(z), sx = Math.sign(x) || 1, sz = Math.sign(z) || 1;
    if (dx < 6 && dz < 6) return [sx * (hx - dx), y, sz * (hz - dz)];
    if (dx <= dz) return [sx * (hx - dx), y, along(z, longA)];
    return [along(x, crossA), y, sz * (hz - dz)];
  };
}
function shaftLights(info, sh, lay) {
  const map = shaftMap(info, sh.hx, sh.hz, lay);
  const out = [];
  for (const l of info.lights || []) {
    const st = l.states?.emergency ?? l, I = st.intensity ?? l.intensity ?? 0;
    if (!(I > 0.05) || !(l.radius > 0) || l.role === 'fog') continue;
    const p = map(l.pos, l.attach === 'pad');
    const t = l.useTemperature ? kelvin(st.temperature ?? l.temperature ?? 6500) : [1, 1, 1];
    const c = (st.color ?? l.color ?? [1, 1, 1]).map((v, i) => v * t[i] * I);
    const spot = l.type === 'Projector' && l.dir?.length === 3 && l.angle;
    const style = st.lightStyle ?? l.anim?.style ?? 0;
    out.push({
      role: l.role, pos: p, dir: spot ? l.dir : [0, 0, 0], cosO: spot ? Math.cos((l.angle / 2) * Math.PI / 180) : -2,
      col: c, r: l.radius, kind: (l.attach === 'pad' ? 2 : 0) + (style ? 1 : 0) + (l.role === 'base' ? 4 : 0),
    });
  }
  return out;
}
// Licht einer Lampe auf einer Fläche (Lage p, Normale n), wie im Shader
// (hgPit): mit dem Quadrat der Entfernung schwächer (3 m Kern, sonst
// gleißt es, wo eine Lampe knapp über der Plattform hängt), am Radius weich
// auf null; Kegel zur Mitte hin weich, ohne harten Rand
function pitLight(L, p, n, out, k = 1) {
  const dx = L.pos[0] - p[0], dy = L.pos[1] - p[1], dz = L.pos[2] - p[2], d2 = dx * dx + dy * dy + dz * dz;
  const q = d2 / (L.r * L.r);
  if (q >= 1 || d2 < 1e-6) return;
  const d = Math.sqrt(d2), lx = dx / d, ly = dy / d, lz = dz / d;
  const nl = Math.max(0, n[0] * lx + n[1] * ly + n[2] * lz);
  let cone = 1;
  if (L.cosO > -1) {
    const cd = -(lx * L.dir[0] + ly * L.dir[1] + lz * L.dir[2]);
    cone = THREE.MathUtils.smoothstep(cd, L.cosO, L.cosO + (1 - L.cosO) * 0.7);
  }
  const f = k * cone * (1 - q * q) ** 2 / (d2 + 9) * nl;
  out[0] += L.col[0] * f; out[1] += L.col[1] * f; out[2] += L.col[2] * f;
}
// Höchstens n Lampen für den Shader. Gleiche Art und nah beieinander (unter
// 6 m, Strahler in ähnlicher Richtung) wird eine: Farben addiert, Lage und
// Richtung nach Stärke gemittelt, der weitere Kegel und der größere Radius.
// So werden etwa die beiden Fluter, die das Spiel an jeder Stelle doppelt
// setzt (eng und hell, weit und schwächer), ein Licht. Die Warnlichter
// immer, dann nach Reichweite mal Helligkeit. Vorn stehen die Lampen, die
// auch das Feld trifft (fest am Schacht, nicht nur für Wände): `field`
// zählt sie, der Shader des Felds rechnet nur sie.
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function pitPack(list, n) {
  const groups = [];
  for (const L of list) {
    const spot = L.cosO > -1;
    const g = groups.find((q) => q.kind === L.kind && (q.cosO > -1) === spot
      && Math.hypot(q.pos[0] - L.pos[0], q.pos[1] - L.pos[1], q.pos[2] - L.pos[2]) < 6
      && (!spot || q.dir[0] * L.dir[0] + q.dir[1] * L.dir[1] + q.dir[2] * L.dir[2] > 0.8));
    const w = lum(L.col);
    if (!g) { groups.push({ ...L, pos: [...L.pos], dir: [...L.dir], col: [...L.col], w, n: 1 }); continue; }
    const t = w / (g.w + w || 1);
    g.pos = g.pos.map((v, i) => v + (L.pos[i] - v) * t);
    if (spot) {
      const d = g.dir.map((v, i) => v * g.w + L.dir[i] * w), m = Math.hypot(...d) || 1;
      g.dir = d.map((v) => v / m);
      g.cosO = Math.min(g.cosO, L.cosO);
    }
    g.col = g.col.map((v, i) => v + L.col[i]);
    g.r = Math.max(g.r, L.r); g.w += w; g.n++;
    if (!g.role.split('+').includes(L.role)) g.role += `+${L.role}`;
  }
  const score = (g) => (g.kind === 1 ? 1e9 : 0) + g.w * g.r * g.r;
  const onField = (g) => g.kind === 0;
  const lights = groups.sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, n));
  lights.sort((a, b) => onField(b) - onField(a));
  return { lights, field: lights.filter(onField).length, groups: groups.length };
}

// Ergänzung aus der vollen Stufe (10.10.2026). Der leichteren Stufe fehlen
// zwei Drittel des Glases: die Abdeckungen der Kabelrinnen an den
// Seitenwänden und der Bodenkanäle, die hinteren Scheiben der vier
// Glassäulen, die Kabine an der Südwand, sechs Glaskörper hoch an den
// Seitenwänden; dazu die Rohre in den Glassäulen. Ohne sie liegen Kabel und
// Kanäle blank, und durch die Türsymbole der Glassäulen sieht man schwarz.
// Die Möbeldatei bringt diese Materialien ganz aus der vollen Stufe mit, als
// Knoten mit extras[HALL_DETAIL] (scripts/build-hall-furniture.mjs). Hier
// fallen dafür die Teile der leichteren Stufe mit denselben Materialien, und
// die Ergänzung nimmt deren Material (kein Shader doppelt).
// Dazu die Füllung (extras[HALL_FILL]): was die leichtere Stufe an einer
// Stelle ganz weglässt, etwa eine Holzblende auf einem Deckenkasten. Sie
// kommt nur dazu, mit dem Material der leichteren Stufe gleichen Namens.
// Beide bringen aus der Möbeldatei nur Name und Faktoren ihres Materials
// mit, keine Texturen. Am Telefon, ohne Möbel, kommen dieselben Knoten aus
// einer eigenen kleinen Datei (hall.patch, Marke hall-patch unten).
// verify:hangar-hall liest beide Schlüssel aus dem ausgelieferten Viewer und
// prüft Möbel- und Telefon-Datei dagegen.
const HALL_DETAIL = /* hall-detail */ 'detail';
const HALL_FILL = /* hall-fill */ 'fill';
function swapHallDetail(model, extra) {
  const names = new Set();
  const detail = [], fill = [];
  extra.traverse((n) => {
    if (n.userData?.[HALL_DETAIL]) n.traverse((o) => { if (o.isMesh) { detail.push(o); names.add(o.material.name); } });
    else if (n.userData?.[HALL_FILL]) n.traverse((o) => { if (o.isMesh) fill.push(o); });
  });
  if (!detail.length && !fill.length) return null;
  // Ein Material gibt es doppelt, wenn es Teile mit und ohne Eckfarben
  // tragen (der Loader klont es dann mit vertexColors): gesucht wird nach
  // Name und Eckfarben, so bekommt jedes Teil das seines Gegenstücks, auch
  // für die Abdunkelung aus dem Spiel weiter unten.
  const key = (o) => `${o.material.name}|${o.geometry.attributes.color ? 1 : 0}`;
  const byName = new Map(), gone = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (!byName.has(key(o))) byName.set(key(o), o.material);
    if (names.has(o.material.name)) gone.push(o);
  });
  const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  let cut = 0, added = 0;
  for (const o of gone) { cut += tris(o.geometry); o.removeFromParent(); o.geometry.dispose(); }
  for (const o of detail) { added += tris(o.geometry); o.material = byName.get(key(o)) ?? o.material; }
  let filled = 0;
  for (const o of fill) { filled += tris(o.geometry); o.material = byName.get(key(o)) ?? o.material; }
  return { materials: names.size, added, cut, parts: gone.length, filled };
}

// Möbel der Halle, die auf dem festen Rand stünden (HALL_RAND, 19.10.2026):
// Die Kisten der Halle standen neben dem Feld, wo jetzt der Gittersteg
// liegt. Was am Boden steht und in den Rand reicht, ohne im Feld zu stehen,
// rückt senkrecht zur Feldkante, an der es liegt, hinaus, bis es frei
// steht; käme es so nicht mehr in die Halle, bleibt es weg. F: das Feld
// (Modellraum der Halle, nach HALL_SHIFT), rim: Breite des Rands.
function clearRandFurniture(model, furn, F, rim, room, floorY) {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert(), b = new THREE.Box3(), c = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  const x0 = F.from[0], x1 = F.to[0], z0 = F.from[1], z1 = F.to[1], GAP = 0.3;
  const rx = [room.center[0] - room.halfW + GAP, room.center[0] + room.halfW - GAP], rz = [room.center[2] - room.halfL + GAP, room.center[2] + room.halfL - GAP];
  const out = { moved: [], dropped: [] };
  for (const n of furn) {
    b.setFromObject(n).applyMatrix4(toModel);
    if (b.isEmpty() || b.min.y > floorY + 0.5) continue;
    if (b.max.x <= x0 - rim || b.min.x >= x1 + rim || b.max.z <= z0 - rim || b.min.z >= z1 + rim) continue;
    if (b.min.x >= x0 && b.max.x <= x1 && b.min.z >= z0 && b.max.z <= z1) continue;
    // die Feldkante, hinter der seine Mitte am weitesten liegt
    b.getCenter(c);
    const side = [c.x - x1, x0 - c.x, c.z - z1, z0 - c.z];
    const k = side.indexOf(Math.max(...side));
    const d = [x1 + rim + GAP - b.min.x, x0 - rim - GAP - b.max.x, z1 + rim + GAP - b.min.z, z0 - rim - GAP - b.max.z][k];
    const dx = k < 2 ? d : 0, dz = k < 2 ? 0 : d;
    if (b.min.x + dx < rx[0] || b.max.x + dx > rx[1] || b.min.z + dz < rz[0] || b.max.z + dz > rz[1]) { out.dropped.push(n); continue; }
    const A = n.userData.anchor;
    n.parent.worldToLocal(model.localToWorld(p0.set(A[0], A[1], A[2])));
    n.parent.worldToLocal(model.localToWorld(p1.set(A[0] + dx, A[1], A[2] + dz)));
    n.position.add(p1.sub(p0));
    n.userData.anchor = [A[0] + dx, A[1], A[2] + dz];
    out.moved.push(`${n.name || '?'} ${Math.abs(d).toFixed(1)} m`);
  }
  for (const n of out.dropped) n.removeFromParent();
  return out;
}

// Einrichtung zusammenlegen (2026-10-08). Der Build stellt jedes Möbel als
// eigenen Knoten mit Bezugspunkt (extras.anchor, Modellraum der Halle): 137
// Möbel mit 585 Primitiven, also so viele Draw-Calls, im AO-Pass noch einmal
// so viele. Hier wird je Material ein Mesh daraus, im Modellraum der Halle.
// Jedes Möbel behält seinen Eckenbereich und Bezugspunkt; scaleFurniture
// hält es damit in Originalgröße, wenn die Halle mit großen Schiffen wächst.
// Liefert [{ mesh, pieces: [[von, bis, ax, ay, az], …], s, base }] und
// nimmt die zusammengelegten Meshes aus ihren Knoten.
async function mergeFurniture(model, nodes, pause = noPause) {
  if (!nodes.length) return [];
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const groups = new Map();
  for (const n of nodes) {
    const A = n.userData.anchor;
    n.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || o.geometry.groups.length || o.morphTargetInfluences || !o.geometry.attributes.position) return;
      const g = o.geometry, names = Object.keys(g.attributes).sort();
      const key = `${o.material.uuid}|${names}`;
      let e = groups.get(key);
      if (!e) groups.set(key, (e = { material: o.material, names, parts: [], verts: 0, idx: 0 }));
      e.parts.push({ o, g, A });
      e.verts += g.attributes.position.count;
      e.idx += g.index ? g.index.count : g.attributes.position.count;
    });
  }
  const M = new THREE.Matrix4(), N = new THREE.Matrix3(), v = new THREE.Vector3();
  const out = [];
  for (const e of groups.values()) {
    const index = e.verts > 65535 ? new Uint32Array(e.idx) : new Uint16Array(e.idx);
    // Lage, Normale und Tangente werden gedreht (Float32), der Rest
    // (UV, später Vertexfarben) kommt unverändert in seinem Typ mit
    const arrays = {};
    for (const name of e.names) {
      const a0 = e.parts[0].g.attributes[name];
      const raw = !/^(position|normal|tangent)$/.test(name) && e.parts.every(({ g }) => {
        const a = g.attributes[name];
        return !a.isInterleavedBufferAttribute && a.itemSize === a0.itemSize && a.normalized === a0.normalized && a.array.constructor === a0.array.constructor;
      });
      arrays[name] = { size: a0.itemSize, raw, normalized: raw && a0.normalized, arr: raw ? new a0.array.constructor(e.verts * a0.itemSize) : new Float32Array(e.verts * a0.itemSize) };
    }
    const pieces = [];
    let vo = 0, io = 0;
    for (const { o, g, A } of e.parts) {
      M.multiplyMatrices(toModel, o.matrixWorld);
      N.getNormalMatrix(M);
      const count = g.attributes.position.count;
      for (const name of e.names) {
        const src = g.attributes[name], { arr, size, raw } = arrays[name];
        if (name === 'position' || name === 'normal') {
          // direkt gerechnet (0,8 Mio. Ecken), Matrizen spaltenweise
          const pos = name === 'position', m = pos ? M.elements : N.elements;
          const sa = !src.isInterleavedBufferAttribute && !src.normalized && src.itemSize === 3 ? src.array : null;
          for (let i = 0, j = vo * 3; i < count; i++, j += 3) {
            let x, y, z;
            if (sa) { x = sa[i * 3]; y = sa[i * 3 + 1]; z = sa[i * 3 + 2]; } else { v.fromBufferAttribute(src, i); x = v.x; y = v.y; z = v.z; }
            if (pos) {
              arr[j] = m[0] * x + m[4] * y + m[8] * z + m[12];
              arr[j + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
              arr[j + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
            } else {
              const nx = m[0] * x + m[3] * y + m[6] * z, ny = m[1] * x + m[4] * y + m[7] * z, nz = m[2] * x + m[5] * y + m[8] * z;
              const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
              arr[j] = nx / l; arr[j + 1] = ny / l; arr[j + 2] = nz / l;
            }
          }
        } else if (name === 'tangent') {
          for (let i = 0, j = vo * 4; i < count; i++, j += 4) {
            v.fromBufferAttribute(src, i).transformDirection(M);
            arr[j] = v.x; arr[j + 1] = v.y; arr[j + 2] = v.z; arr[j + 3] = src.getW(i);
          }
        } else if (raw) arr.set(src.array.subarray(0, count * size), vo * size);
        else for (let i = 0; i < count; i++) for (let c = 0; c < size; c++) arr[(vo + i) * size + c] = src.getComponent(i, c);
      }
      if (g.index) {
        const I = g.index.array;
        for (let t = 0; t < g.index.count; t++) index[io + t] = I[t] + vo;
        io += g.index.count;
      } else {
        for (let t = 0; t < count; t++) index[io + t] = vo + t;
        io += count;
      }
      pieces.push([vo, vo + count, A[0], A[1], A[2]]);
      vo += count;
      o.removeFromParent();
      await pause();
    }
    const geo = new THREE.BufferGeometry();
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    for (const name of e.names) geo.setAttribute(name, new THREE.BufferAttribute(arrays[name].arr, arrays[name].size, arrays[name].normalized));
    // Hülle für jedes s ≤ 1: Jede Ecke wandert auf ihren Bezugspunkt zu,
    // bleibt also im Quader aus Ecken und Bezugspunkten
    geo.computeBoundingBox();
    for (const p of pieces) geo.boundingBox.expandByPoint(v.set(p[2], p[3], p[4]));
    geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(geo, e.material);
    mesh.name = `furniture:${e.material.name}`;
    model.add(mesh);
    out.push({ mesh, pieces, s: 1, base: null });
  }
  return out;
}

// Möbel in Originalgröße: s = 1/k (k = Maßstab der Halle), jedes um seinen
// Bezugspunkt; gerechnet und hochgeladen wird nur, wenn sich s ändert.
function scaleFurniture(list, s) {
  for (const f of list) {
    if (f.s === s) continue;
    const P = f.mesh.geometry.attributes.position, pos = P.array;
    const base = f.base || (f.base = pos.slice());
    for (const [i0, i1, ax, ay, az] of f.pieces) {
      for (let i = i0 * 3; i < i1 * 3; i += 3) {
        pos[i] = ax + (base[i] - ax) * s;
        pos[i + 1] = ay + (base[i + 1] - ay) * s;
        pos[i + 2] = az + (base[i + 2] - az) * s;
      }
    }
    P.needsUpdate = true;
    f.s = s;
  }
}

// Werkstatt (16.10.2026). Krisz: „das ganzer hangar sieht iwi so steril aus,
// es wirkt nicht wie ein flugzeughangar, es fehlt öl, cracks auf dem boden,
// beton, werkzeuge, schläuche, fuel, diagnosegeräte“. Die Revel-&-York-
// Deluxe ist im Spiel ein sauberer Ausstellungsraum: keine Abnutzung, keine
// Boden-Decals, Möbel nur an den Wänden. Gerät und Abnutzung kommen aus
// anderen Spielhallen (PC-Auftrag .planning/notes/hangar-werkstatt.md):
// hall.workshop.url bringt die Requisiten (Knoten prop_*), hall.workshop.boden
// die Boden-Decals (decal_*), die json dazu die Anordnung um das Landefeld
// der Spielhalle (layout). placeWorkshop überträgt sie aufs Schiffsfeld: über
// dem Feld anteilig, daneben mit demselben Abstand zum Feldrand in Metern.
// Requisiten über dem Feld fallen weg (dort steht das Schiff, und das Feld
// fährt); Decals dort fahren mit dem Aufzug. Wo die Halle schon etwas stehen
// hat (floorGrid), rückt ein Requisit bis 3 m weiter oder fällt weg. Das
// Budget je Stufe zählt Materialien, also Zeichenbefehle nach dem
// Zusammenlegen (mergeFurniture).
const WORK_BUDGET = { hoch: { props: 96, decals: 24 }, mittel: { props: 40, decals: 16 }, niedrig: { props: 0, decals: 10 } };
const WORK_CELL = 0.5;          // Raster der Bodenbelegung, m
const WORK_BAND = [0.12, 2.4];  // belegt ist, was so hoch über dem Boden liegt, m
const WORK_EDGE = 1;            // Requisiten mindestens so weit vom Feldrand, m
const WORK_LIFT = 0.004;        // Decals so hoch über dem Boden, m (dazu polygonOffset)
const WORK_MOVE = 3;            // so weit darf ein Requisit ausweichen, m
const WORK_FLOOR = 0.35;        // höher oder tiefer im Spiel: an der Wand, auf einem Regal, in einer Rinne
const WORK_WALL = 1.5;          // Abstand zur Hallenwand beim Stauchen der Anordnung, m
// Was Krisz genannt hat, kommt zuerst ins Budget (Rolle aus info.props)
const WORK_FIRST = ['diagnose', 'schlauch', 'treibstoff', 'gasflasche', 'werkzeug', 'generator', 'kabeltrommel', 'wagen'];
// Beidseitig und ohne Ausstanzen (18.10.2026). Krisz: „das rohr ist
// durchsichtig“. Der Luftschlauch ist im Export eine einzelne Stofflage mit
// Normalen nach außen: Von der offenen Seite her fehlte die Innenwand, man
// sah durch die Windungen auf den Boden. Dazu stanzt sein Material Risse
// aus (MASK); die Lage ist überall sonst deckend.
const WORK_TWO_SIDED = /airduct_hose/i;
// Spuren auf dem Feld: [Knoten, Bruchteil der halben Feldbreite, der halben
// Feldlänge]. Im Spiel ist das Landefeld Asphalt ohne Decals, und Risse,
// Schutt und große Öllachen kennt die Anordnung gar nicht (im Spiel kaum in
// Hallen). Unser Feld ist der helle Lack der Ausstellungshalle, und auf ihm
// steht das Schiff, wo man hinsieht: Dort liegen diese Spuren so, dass ein
// kleines Schiff sie nicht verdeckt. Sie fahren mit dem Aufzug; im Budget
// kommen sie zuerst. Öl liegt seit dem 18.10.2026 nicht mehr hier, sondern
// nach Schiffsgröße unter dem Schiff (WORK_DIENST.spuren); Krisz: die große
// Lache in der Feldmitte sah aus wie verschüttete Tinte.
// verify:hangar-hall [12] liest den Block und prüft jeden Knoten an der
// ausgelieferten Bodendatei.
const WORK_FIELD = /* work-field */ [
  ["decal_riss_0", 0.66, 0.28], ["decal_riss_1", -0.68, 0.4],
  ["decal_betonschutt_0", 0.62, -0.38], ["decal_riss_1", 0.48, -0.66], ["decal_riss_0", -0.5, -0.6],
  ["decal_kratzer_0", -0.35, 0.12], ["decal_abrieb_1", 0.32, -0.12], ["decal_betonschutt_0", -0.62, 0.7], ["decal_reifenspur_0", 0.2, 0.75]
] /* /work-field */;
// Feldboden aus dem Spiel (17.10.2026): Krisz vermisst Beton. Im Spiel ist
// das Landefeld der Aufzug selbst, Asphalt mit Rutschschutz, abgenutzt zu
// beschädigtem Beton; die Bodendatei trägt beide Schichten als eigene
// Knoten (`floors`, Kachel aus info.floors). Auf dem Feld tragen die
// Materialien `mats` (Platten, Bänder, Fugen) die Karten des gewählten
// Bodens statt des Lacks, auf die Fläche projiziert wie die zerfallenen
// Hallen-UVs (boxProject); Leisten und Lampen bleiben. Gewählt ist `pick`
// ("lack": der helle Lack der Halle bleibt), die Seite schaltet mit
// ?boden=beton, ?boden=asphalt oder ?boden=lack um (Vergleich). Krisz
// wählte erst Beton, am selben Abend (17.10.2026) wieder den Lack.
// verify:hangar-hall [12] prüft die Knoten und die Materialien im Feld.
const WORK_PAD = /* work-pad */ { "mats": "mtl_(metal_dotty_01_016|metal_white_03)$", "floors": { "beton": "floor_asphalt_wear", "asphalt": "floor_asphalt" }, "pick": "lack" } /* /work-pad */;
// Wartungsplatz am Schiff (18.10.2026). Krisz: „die assets sind allgemein
// zu wenige, und sind nicht belivable plaziert“; Öl und Gerät nach der
// Schiffsgröße, Gerät an Arbeitsplätzen gruppiert, Schläuche und Kabel zu
// Generator oder Treibstoff, die Bedeutung der Requisiten gespeichert
// (Katalog, public/hangar/props/katalog.json, PC-Auftrag
// .planning/notes/hangar-katalog.md). Je Schiff neu um seinen Umriss
// gestellt und mit dem Aufzug gefahren (layDienst), das Gerät in
// Originalgröße aus dem Gerätesatz (scripts/build-hangar-dienst.mjs liest
// diesen Block und packt genau diese Knoten).
// stationen: Arbeitsplätze; `wo` sagt, wo am Schiff: ["seite", ±1 (+x oder
// -x), Lage längs als Bruchteil der halben Länge (+ zum Bug)] oder ["ende",
// ±1 (Bug oder Heck), Lage quer als Bruchteil der halben Breite]; der Platz
// rückt von außen an den Rumpf heran, bis er an ihn stößt (DIENST_CLEAR,
// Grundriss von unten: shipUnder), unter Flügeln nur mit Kopffreiheit.
// `sonst`: weitere Stellen, falls die erste nicht ins Feld passt (das Gerät
// fährt mit dem Aufzug, große Schiffe lassen dort kaum Platz). glieder:
// [Knoten, x, z, Drehung, Höhe] im Platz: z zeigt vom Schiff weg, Drehung 0
// heißt Vorderseite des Spiels (-z) zum Schiff. `ab` und `bis` (m, größte
// Ausdehnung des Schiffs): Der Platz steht nur an Schiffen dieser Größe;
// `frei` (m): so weit bleibt er von jedem Teil des Rumpfs, auch von hohen
// (Frachtzone hinter dem Heck statt unter den Triebwerken).
// Krisz am 18.10.2026: am Carrack wirkte der Platz winzig; das Gerät bleibt
// in Originalgröße, große Schiffe bekommen mehr und größeres Gerät des
// Spiels (Gabelstapler, Container, Frachtwagen, Schweißkran, große
// Schlauchtrommel am Bodenanschluss), Plätze an beiden Enden doppelt, und
// Leitungen von jedem. Die Zusammensetzungen folgen den Arbeitsplätzen
// des Katalogs (Diagnose mit Kabeltrommel 7 und Kisten mit Kabeltrommel 4
// stehen im Spiel auf dem Landefeld, Gasflasche neben Feuerlöscher in 71 %).
// Fahrzeuge unter 10 m (Bikes, Rover, Nox, X1, Dragonfly, Fury, Storm) bekommen
// nur Werkzeug, Treibstoff, Diagnose, Werkbank und Kegel: Generator,
// Kistenstapel, zweite Diagnose und Leiter waren größer als das Fahrzeug,
// es stand in einem Haufen Gerät (19.10.2026).
// leitungen: Schlauch oder Kabel aus dem Satz, vom Gerät ([Platz, x, z,
// Höhe] im Platz) über den Boden unter den Rumpf ([Bruchteil quer, längs]);
// das Spiel verlegt keine Leitung zum Schiff, die Stücke sind seine.
// spuren: Öl unter dem Schiff, [Knoten, Bruchteil quer, längs, Kante als
// Bruchteil der Schiffsbreite (DIENST_SPUR begrenzt sie in m), Drehung],
// meist unter dem Heck, wo die Triebwerke sitzen und eine Lache knapp
// dahinter (von hinten zu sehen); oder an einem Platz, [Knoten, Platz, x, z,
// Kante in m, Drehung] wie ein Glied (verschütteter Treibstoff). verify:hangar-hall [14]
// prüft jeden Knoten am Gerätesatz und am Katalog.
const WORK_DIENST = /* work-dienst */ {
  "stationen": [
    { "name": "strom", "ab": 10, "wo": ["seite", 1, -0.3], "sonst": [["ende", -1, 0.55]], "glieder": [
      ["prop_energie_generator_mobile_1_b", 0, 0.15, 0], ["prop_kabel_cable_reel_6_a", 2.9, 0.2, 0], ["prop_kabel_cable_terminal_6_a", -2.35, -0.15, 15],
      ["prop_licht_light_portable_tripod_1_base_a", -2.9, 1.1, 200], ["prop_sicherheit_tool_fire_extinguisher_1_a", 1.9, 1.0, -30]] },
    { "name": "treibstoff", "wo": ["seite", -1, -0.3], "sonst": [["ende", -1, -0.55]], "glieder": [
      ["prop_schlauch_hose_reel_2_a", 0, 0, 0], ["prop_treibstoff_cell_fuel_1_a", 1.25, 0.15, 0], ["prop_treibstoff_cell_fuel_1_a", 1.55, 0.3, 40],
      ["prop_treibstoff_cell_fuel_1_a", 1.3, 0.5, 75], ["prop_treibstoff_cell_fuel_1_a", 1.6, 0.75, 10], ["prop_treibstoff_cell_fuel_1_a", 1.95, 0.5, 120],
      ["prop_sicherheit_tool_fire_extinguisher_1_a", -1.15, 0.05, 25], ["prop_sicherheit_cone_1_a", -0.8, -1.5, 10], ["prop_sicherheit_cone_1_a", 1.0, -1.6, -20],
      ["prop_reinigung_tool_mop_1_bucket_a", 2.6, -0.7, 30], ["prop_reinigung_tool_mop_1_a", 2.85, -0.45, 70]] },
    { "name": "diagnose", "wo": ["seite", -1, 0.35], "sonst": [["ende", 1, -0.5]], "glieder": [
      ["prop_diagnose_console_diagnostic_2_a", 0, 0, 0], ["prop_kabel_cable_reel_7_a", -1.25, 0.2, 15], ["prop_licht_light_work_light_1_a", 1.25, 0.35, 0],
      ["prop_diagnose_computer_1_a", -2.45, 0.35, 10]] },
    { "name": "werkzeug", "wo": ["seite", 1, 0.35], "sonst": [["ende", 1, 0.5]], "glieder": [
      ["prop_werkzeug_cabinet_tool_1_a", 0, 0, 0], ["prop_werkzeug_storage_toolbox_a", 1.3, -0.15, 25], ["prop_werkzeug_tool_welder_a", -1.45, 0.1, -15],
      ["prop_treibstoff_tank_gas_1_005x005x005_a", -2.15, 0.35, 0], ["prop_licht_light_work_light_2_a", -2.9, 0.5, 0],
      ["prop_transport_trolley_creeper_a", 2.7, -0.9, 80], ["prop_werkzeug_tool_socket_set_1_a", 1.15, -0.95, 35],
      ["prop_werkzeug_tool_socket_set_closed_1_a", 0.45, -0.75, -10], ["prop_werkzeug_bag_toolbox_1_a", 1.9, -1.5, 30],
      ["prop_werkzeug_tool_manual_1_pliers_a", 1.9, -1.48, -110, 0.26], ["prop_werkzeug_tool_manual_1_screwdriver_a", 1.51, -1.49, -141],
      ["prop_werkzeug_tool_manual_1_ratchet_a", 0.59, -1.24, 60], ["prop_werkzeug_tool_allenkey_1_a", 2.35, -1.2, 20]] },
    { "name": "werkbank", "wo": ["seite", -1, -0.75], "sonst": [["ende", -1, -0.75], ["seite", 1, -0.75]], "glieder": [
      ["prop_werkzeug_workbench_mobile_1_a", 0, 0.2, 90], ["prop_werkzeug_tool_socket_set_closed_1_a", -1.35, 0.3, 15, 1.215],
      ["prop_werkzeug_tool_tester_1_b", -0.45, 0.05, 80, 1.215], ["prop_werkzeug_tool_manual_1_ratchet_a", 0.3, 0.25, 100, 1.215],
      ["prop_werkzeug_tool_manual_1_screwdriver_a", 0.55, 0.05, 160, 1.215], ["prop_werkzeug_tool_socket_set_1_a", 1.3, 0.35, -12, 1.215],
      ["prop_lager_drum_dry_1_a", 2.8, 0.35, 0], ["prop_sicherheit_tool_fire_extinguisher_1_a", -2.7, 0.1, 30]] },
    { "name": "lager", "ab": 10, "wo": ["ende", -1, 0.3], "sonst": [["ende", -1, -0.3], ["ende", 1, 0]], "glieder": [
      ["prop_lager_crate_dry_2_0125x0125x0125_a", 0, 0.3, 7], ["prop_lager_crate_dry_2_0125x0125x0125_a", -0.1, -1.1, -89],
      ["prop_lager_crate_metal_2_01x005x0025_a", -0.3, -1.0, 80, 1.25], ["prop_lager_crate_dry_1_0125x0125x00625_a", 1.15, 1.25, 4],
      ["prop_lager_drum_dry_1_a", -1.35, 0.75, 0], ["prop_lager_drum_dry_1_a", -1.8, 0.35, 0], ["prop_kabel_cable_reel_4_a", 0.4, 1.95, 180],
      ["prop_transport_trolley_pallet_1_a", 2.3, -0.2, 90], ["prop_lager_crate_stack_1_025x0125x00625_a", -3.4, 0.9, 90],
      ["prop_transport_prop_dumper_transport_pallet_a", 5.0, 0.5, 4], ["prop_lager_crate_dry_2_0125x0125x0125_a", 4.6, 0.15, 10, 0.25],
      ["prop_lager_crate_metal_2_01x005x0025_a", 5.45, 0.95, 85, 0.25], ["prop_lager_box_plastic_4_weapon_005x010x005_a", -3.85, -0.55, 2],
      ["prop_lager_box_plastic_4_weapon_closed_005x010x0025_a", -3.8, -0.55, -3, 0.5], ["prop_lager_box_plastic_4_ammo_0025x005x0025_a", -2.95, -0.5, 14]] },
    { "name": "leiter-klein", "ab": 10, "bis": 30, "wo": ["seite", 1, 0.75], "sonst": [["seite", -1, 0.75]], "glieder": [
      ["prop_heben_ladder_step_1_a", 0, 0, 0]] },
    { "name": "leiter", "ab": 30, "wo": ["seite", 1, 0.75], "sonst": [["seite", -1, 0.75], ["seite", 1, 0.55]], "glieder": [
      ["prop_heben_ladder_mobile_1_b", 0, 0.2, 0], ["prop_sicherheit_cone_1_a", -0.9, -0.6, 0], ["prop_sicherheit_cone_1_a", 0.9, -0.6, 25]] },
    { "name": "transport", "ab": 30, "wo": ["ende", -1, -0.8], "sonst": [["ende", 1, 0.75], ["ende", -1, 0.85]], "glieder": [
      ["prop_transport_machine_forklift_1_b", 0, 0.6, 90], ["prop_transport_machine_forklift_1_extension_console_a", 3.3, 0.4, 0],
      ["prop_transport_prop_dumper_transport_pallet_a", -3.9, 0.5, 0], ["prop_lager_crate_dry_2_0125x0125x0125_a", -4.3, 0.15, 5, 0.25],
      ["prop_lager_crate_dry_1_0125x0125x00625_a", -3.5, 1.15, -8, 0.25]] },
    { "name": "tankstelle", "ab": 60, "wo": ["seite", -1, 0.05], "sonst": [["seite", -1, -0.1], ["ende", -1, -0.35]], "glieder": [
      ["prop_schlauch_hose_reel_1_065x045x045_a", 0, 0.8, 0], ["prop_schlauch_hose_floor_1_socket_a", -4.6, 0.6, 0],
      ["prop_treibstoff_tank_gas_2_025x0125x0125_a", 4.7, 0.1, 0], ["prop_treibstoff_tank_gas_2_025x0125x0125_a", 4.7, 1.55, 4],
      ["prop_sicherheit_tool_fire_extinguisher_1_a", 3.0, -1.0, 20], ["prop_sicherheit_cone_1_a", -2.6, -1.4, 0], ["prop_sicherheit_cone_1_a", 2.4, -1.6, 30]] },
    { "name": "schweiss", "ab": 60, "wo": ["seite", 1, -0.7], "sonst": [["ende", -1, 0.7], ["seite", 1, -0.55]], "glieder": [
      ["prop_werkzeug_crane_welding_arm_1_a", 0, 1.5, 0], ["prop_treibstoff_tank_gas_2_025x0125x0125_a", 4.2, 0.4, 90],
      ["prop_treibstoff_tank_gas_1_005x005x005_a", -3.6, 0.2, 0], ["prop_treibstoff_tank_gas_1_005x005x005_a", -3.95, 0.75, 0],
      ["prop_sicherheit_tool_fire_extinguisher_1_a", -3.3, 1.2, 40], ["prop_werkzeug_tool_welder_a", 2.4, -1.4, -25]] },
    { "name": "lager-gross", "ab": 60, "wo": ["ende", -1, -0.45], "sonst": [["ende", -1, 0.65], ["ende", 1, -0.6]], "glieder": [
      ["prop_lager_storage_container_1_025x05x025_a", -1.4, 1.0, 0], ["prop_lager_storage_container_1_025x05x025_a", 1.4, 1.0, 0],
      ["prop_lager_storage_container_1_025x05x025_a", -1.4, 1.0, 0, 2.5], ["prop_lager_crate_stack_1_025x0125x00625_a", 4.0, 0.6, 0],
      ["prop_transport_prop_dumper_transport_pallet_a", -4.7, 0.2, 0], ["prop_lager_crate_dry_2_0125x0125x0125_a", -4.9, -0.1, 3, 0.25],
      ["prop_lager_crate_metal_2_01x005x0025_a", -4.4, 0.75, 85, 0.25], ["prop_transport_trolley_pallet_1_a", 1.0, -2.6, 90],
      ["prop_lager_crate_multipurpose_1_0125x0125x0125_a", -1.58, -3.2, -98], ["prop_lager_crate_multipurpose_1_0125x0125x0125_a", -0.08, -2.83, 177]] },
    { "name": "fracht", "ab": 60, "wo": ["ende", 1, 0.55], "sonst": [["ende", 1, -0.55], ["ende", -1, 0.9]], "glieder": [
      ["prop_transport_trolley_cargo_1_a", 0, 1.2, 90], ["prop_lager_crate_dry_2_0125x0125x0125_a", -4.6, 0.4, 12],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", -4.4, 1.8, -6], ["prop_lager_crate_dry_1_0125x0125x00625_a", -4.5, 1.1, 0, 1.25]] },
    { "name": "strom-bug", "ab": 60, "wo": ["seite", -1, 0.7], "sonst": [["seite", -1, 0.55], ["ende", 1, -0.8]], "glieder": [
      ["prop_energie_generator_mobile_1_b", 0, 0.15, 0], ["prop_kabel_cable_reel_6_a", 2.9, 0.2, 0], ["prop_kabel_cable_terminal_6_a", -2.35, -0.15, 15],
      ["prop_licht_light_portable_tripod_1_base_a", -2.9, 1.1, 200]] },
    { "name": "werkzeug-heck", "ab": 60, "wo": ["seite", -1, -0.6], "sonst": [["seite", -1, -0.45], ["ende", -1, 0.1]], "glieder": [
      ["prop_werkzeug_cabinet_tool_1_a", 0, 0, 0], ["prop_werkzeug_storage_toolbox_a", 1.3, -0.15, 25], ["prop_licht_light_work_light_2_a", -1.6, 0.4, 0],
      ["prop_transport_trolley_creeper_a", 2.6, -0.9, 95], ["prop_werkzeug_tool_socket_set_1_a", 1.05, -0.95, 35],
      ["prop_werkzeug_tool_manual_1_ratchet_a", 1.7, -1.35, 65], ["prop_werkzeug_tool_manual_1_pliers_a", 2.0, -1.6, 140],
      ["prop_werkzeug_bag_toolbox_2_a", -0.95, -0.9, -20]] },
    { "name": "diagnose-bug", "ab": 10, "wo": ["ende", 1, 0.3], "sonst": [["seite", 1, 0.55], ["ende", 1, -0.3]], "glieder": [
      ["prop_diagnose_console_diagnostic_1_a", 0, 0, 0], ["prop_kabel_cable_reel_7_a", 1.3, 0.25, -10], ["prop_licht_light_work_light_1_a", -1.3, 0.35, 0]] },
    { "name": "frachtzone", "ab": 60, "frei": 6, "wo": ["ende", -1, 0], "sonst": [["ende", -1, 0.4], ["ende", 1, 0]], "glieder": [
      ["prop_lager_storage_container_1_025x05x025_a", -6.0, 2.6, 0], ["prop_lager_storage_container_1_025x05x025_a", -3.3, 2.6, 0],
      ["prop_lager_storage_container_1_025x05x025_a", -0.6, 2.6, 0], ["prop_lager_storage_container_1_025x05x025_a", -6.0, 2.6, 0, 2.5],
      ["prop_lager_storage_container_1_025x05x025_a", -3.3, 2.6, 0, 2.5], ["prop_transport_machine_forklift_1_b", 3.6, 1.2, -70],
      ["prop_transport_trolley_cargo_1_a", 8.8, 2.8, 0], ["prop_transport_prop_dumper_transport_pallet_a", 3.4, 5.4, 6],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", 3.0, 5.1, 2, 0.25], ["prop_lager_crate_dry_1_0125x0125x00625_a", 3.9, 6.0, -4, 0.25],
      ["prop_transport_trolley_pallet_1_a", -9.2, 1.4, 15], ["prop_sicherheit_cone_1_a", -4.0, -1.4, 0], ["prop_sicherheit_cone_1_a", 0.2, -1.6, 20],
      ["prop_sicherheit_cone_1_a", 4.4, -1.4, -10]] },
    { "name": "vorfeld", "ab": 60, "frei": 4, "wo": ["ende", 1, -0.35], "sonst": [["ende", 1, 0.35], ["ende", 1, 0]], "glieder": [
      ["prop_lager_crate_stack_1_025x0125x00625_a", -2.2, 0.8, 90], ["prop_lager_crate_stack_1_025x0125x00625_a", -2.2, 2.6, 90],
      ["prop_transport_prop_dumper_transport_pallet_a", 1.4, 0.9, 0], ["prop_lager_crate_dry_2_0125x0125x0125_a", 1.0, 0.6, 8, 0.25],
      ["prop_lager_crate_metal_2_01x005x0025_a", 1.9, 1.5, 90, 0.25], ["prop_lager_drum_dry_1_a", 3.6, 0.4, 0], ["prop_lager_drum_dry_1_a", 4.2, 0.8, 0],
      ["prop_lager_drum_dry_1_a", 3.7, 1.1, 0], ["prop_licht_light_portable_tripod_1_base_a", -4.6, 0.3, 160],
      ["prop_sicherheit_tool_fire_extinguisher_1_a", 5.2, 0.0, 30], ["prop_sicherheit_cone_1_a", -1.0, -1.3, 0], ["prop_sicherheit_cone_1_a", 2.6, -1.3, 15]] },
    { "name": "kegel-links", "wo": ["ende", 1, -0.9], "sonst": [["ende", 1, -0.6]], "glieder": [
      ["prop_sicherheit_cone_1_a", 0, 0, 0], ["prop_sicherheit_cone_1_a", 1.1, -0.2, 30], ["prop_sicherheit_cone_1_closed_a", 0.5, 0.8, 70]] },
    { "name": "kegel-rechts", "wo": ["ende", 1, 0.9], "sonst": [["ende", 1, 0.6]], "glieder": [
      ["prop_sicherheit_cone_1_a", 0, 0, 0], ["prop_sicherheit_cone_1_a", -1.1, -0.2, -30]] }
  ],
  "leitungen": [
    { "name": "strom", "node": "prop_kabel_maintenance_cable_1_a", "von": ["strom", -1.0, -0.75, 0.55], "nach": [0.45, -0.25] },
    { "name": "treibstoff", "node": "prop_schlauch_maintenance_hose_1_a", "von": ["treibstoff", 0, -0.5, 0.45], "nach": [-0.4, -0.15] },
    { "name": "daten", "node": "prop_kabel_maintenance_cable_1_a", "von": ["diagnose", 0.2, -0.6, 0.6], "nach": [-0.25, 0.4] },
    { "name": "tankstelle", "node": "prop_schlauch_maintenance_hose_1_a", "von": ["tankstelle", -4.6, 0.1, 0.15], "nach": [-0.3, 0.05] },
    { "name": "strom-bug", "node": "prop_kabel_maintenance_cable_1_a", "von": ["strom-bug", -1.0, -0.75, 0.55], "nach": [-0.35, 0.55] },
    { "name": "daten-bug", "node": "prop_kabel_maintenance_cable_1_a", "von": ["diagnose-bug", 0.2, -0.6, 0.6], "nach": [0.3, 0.5] }
  ],
  "spuren": [
    ["decal_oel_1", 0.12, -0.6, 0.11, 20], ["decal_oel_1", -0.2, -0.72, 0.08, 200], ["decal_oel_0", -0.42, -0.25, 0.06, 70],
    ["decal_oel_0", 0.25, 0.2, 0.05, 130], ["decal_oel_2", 0.03, -0.35, 0.07, 0], ["decal_oel_0", -0.12, -1.03, 0.06, 40],
    ["decal_oel_2", "treibstoff", 1.55, -0.55, 1.3, 25], ["decal_oel_1", "strom", 0.9, -0.95, 0.8, 110],
    ["decal_oel_2", "tankstelle", -1.8, -1.2, 2.2, 60], ["decal_oel_1", "schweiss", 1.2, -0.6, 1.6, 15],
    ["decal_oel_0", "transport", 0.6, -0.9, 1.4, 160], ["decal_oel_1", "lager-gross", -0.6, -2.2, 1.8, 95], ["decal_oel_0", "frachtzone", 3.4, -0.2, 1.6, 40]
  ]
} /* /work-dienst */;
// Raster des Grundrisses von unten (m); Abstand des Geräts zum Rumpf
// waagrecht und Kopffreiheit darüber, wo es unter einen Flügel ragt (m);
// Abstand zum Feldrand (m); Kante der Ölspuren (m); Schritt beim
// Heranrücken an den Rumpf (m)
const DIENST_CELL = 0.5;
const DIENST_CLEAR = [0.7, 0.5];
const DIENST_EDGE = 0.6;
const DIENST_SPUR = [0.5, 3.5];
const DIENST_STEP = 0.25;
const DIENST_OVER = 3;          // Grundriss so weit über den Kasten hinaus, m
// Hallendeko (21.10.2026). Krisz: „mehr assets auch für hintergrund also
// nicht alles muss um das schiff direkt herumstehen, wir dekorieren mal
// bisschen das hangar, also nicht nur bisschen sondern heavy“, platziert
// mit der Bedeutung aus dem Katalog. Zonen an den Längswänden und an den
// Stirnseiten, zusammengesetzt wie die Arbeitsplätze des Katalogs (`aus`:
// der Platz in public/hangar/props/katalog.json, den die Zone aufgreift):
// Fracht, Gas, Munition vor der Nische, Werkstatt und Energie an der
// Westwand; Leitstand, Sanität und Lager an der Galerie; Lager, Transport,
// Lüftung und Tankstelle an der Ostwand; Fracht am Hallentor. Fest in der
// Halle (fährt nicht mit dem Aufzug), in Originalgröße wie die Werkstatt:
// Wächst die Halle mit großen Schiffen, rückt die Zone an ihren Bezugspunkt
// auf der Wand. Gepackt wie der Wartungsplatz, in einem eigenen Satz
// (node scripts/build-hangar-dienst.mjs deko -> deko.glb).
// halle: nur in dieser Halle (Koordinaten ihres Modells). `wand`: w
// (Westwand, x klein), o (Ostwand, x groß), n (Hallentor, z klein), s
// (Galerie, z groß); `at` [x, z]: Bezugspunkt auf der Wandlinie im Modell.
// glieder: [Knoten, x, z, Drehung, Höhe] im Platz wie beim Wartungsplatz,
// nur zeigt z zur Wand (z = 0 ist die Wand, die Halle liegt bei z < 0) und
// x nach rechts, mit dem Rücken zur Wand gesehen; Drehung 0 heißt
// Vorderseite des Spiels (-z) zur Halle; Höhe: steht auf einem anderen
// Glied (Container, Kisten auf der Palette). spuren: [Knoten, x, z, Kante
// in m, Drehung]. stufe: mittel steht ab mittel, hoch nur auf hoch
// (niedrig hat keine Requisiten). Was im Grundriss (floorGrid) auf Halle
// oder Einrichtung stößt, fällt weg, mit allem, was darauf steht, und die
// Konsole nennt es; das Übrige belegt den Grundriss, die Werkstatt danach
// weicht ihm aus. verify:hangar-hall [17] prüft Knoten, Abstände, Stapel
// und Kosten.
const WORK_DEKO = /* work-deko */ {
  "halle": "revelyork-single",
  "zonen": [
    { "name": "fracht-west", "stufe": "mittel", "aus": "lager+transport", "wand": "w", "at": [3.5, -116], "glieder": [
      ["prop_lager_storage_container_1_025x05x025_a", -4.6, -1.66, 90], ["prop_lager_storage_container_1_025x05x025_a", 0.5, -1.66, 90],
      ["prop_lager_storage_container_1_025x05x025_a", -4.6, -1.66, 90, 2.5], ["prop_lager_storage_container_1_025x05x025_a", 5, -2.9, 0],
      ["prop_transport_prop_dumper_transport_pallet_a", -5.4, -5, 0], ["prop_lager_crate_dry_2_0125x0125x0125_a", -6.03, -5, 0, 0.25],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", -4.775, -5, 0, 0.25], ["prop_lager_crate_metal_4_0125x0125x0125_a_yellow", -5.4, -5, 12, 1.5],
      ["prop_transport_machine_forklift_1_b", 0.6, -6, 180], ["prop_transport_trolley_pallet_1_a", -2.4, -4.6, 90],
      ["prop_lager_crate_stack_1_03x025x0125_a", 5, -7.3, 0]], "spuren": [["decal_reifenspur_0", 0.6, -8.6, 3.2, 90], ["decal_oel_0", -1.4, -6.6, 1.1, 40]] },
    { "name": "gas-west", "stufe": "mittel", "aus": "kabel+reinigung+sicherheit+treibstoff", "wand": "w", "at": [3.5, -99], "glieder": [
      ["prop_treibstoff_tank_gas_3_05x025x025_a", -4.2, -1.64, 0], ["prop_treibstoff_tank_gas_3_05x025x025_a", 1, -1.64, 0],
      ["prop_treibstoff_tank_gas_2_025x0125x0125_a", 5.3, -1.05, 0], ["prop_treibstoff_tank_gas_2_025x0125x0125_a", 5.3, -1.05, 0, 1.28],
      ["prop_treibstoff_cell_fuel_1_a", 4.4, -2.5, 0], ["prop_treibstoff_cell_fuel_1_a", 4.75, -2.45, 30],
      ["prop_treibstoff_cell_fuel_1_a", 5.1, -2.6, 60], ["prop_treibstoff_cell_fuel_1_a", 4.6, -2.85, 15],
      ["prop_treibstoff_cell_fuel_1_a", 4.95, -2.9, 80], ["prop_treibstoff_tank_gas_1_0125x0125x0125_a", 6.2, -3.4, 10],
      ["prop_sicherheit_tool_fire_extinguisher_1_a", -6.7, -3.3, 20], ["prop_sicherheit_barrier_caution_005x005x0125_a", -4.5, -4.8, 0],
      ["prop_sicherheit_barrier_caution_005x005x0125_a", -1.6, -4.8, 0], ["prop_sicherheit_barrier_caution_005x005x0125_a", 1.3, -4.8, 0],
      ["prop_sicherheit_sign_warning_1_freestanding_a", -6.6, -4.6, -20]], "spuren": [["decal_pfuetze_1", -1.2, -3.4, 1.4, 0]] },
    { "name": "munition-west", "stufe": "hoch", "aus": "munition", "wand": "w", "at": [3.5, -73], "glieder": [
      ["prop_munition_rack_torpedo_1_a", -13.3, -2.6, 0], ["prop_munition_crate_torpedo_1_07x0075x0075_a", -12.7, -5.5, 0],
      ["prop_munition_crate_torpedo_1_05x0075x0075_a", -12.7, -5.5, 0, 0.77], ["prop_munition_crate_torpedo_1_03x0075x0075_open_a", -12, -6.6, 0],
      ["prop_munition_uee_lawless_prop_missilestack_large", -10.3, -2.4, 0], ["prop_munition_ammo_box_1_pallet_250x125x025_a", 13, -1, 0],
      ["prop_munition_ammo_box_1_ballistic_1x05x025_a", 12.45, -1.25, 0, 0.25],
      ["prop_munition_ammo_box_1_ballistic_1x05x025_a", 13.55, -1.25, 0, 0.25],
      ["prop_munition_ammo_box_1_ballistic_1x05x025_a", 12.45, -0.72, 0, 0.25],
      ["prop_munition_ammo_box_1_ballistic_open_1x05x025_a", 13.55, -0.72, 0, 0.25], ["prop_munition_uee_lawless_prop_ammocrate_01", 10.6, -1.05, 0],
      ["prop_munition_crate_weapon_2_015x0075x0075_a", 15.2, -1.05, 90], ["prop_munition_crate_weapon_2_015x0075x0075_a", 15.2, -1.05, 90, 0.75],
      ["prop_munition_prop_component_display_dumper_c", 13, -3.6, 0], ["prop_munition_uee_lawless_prop_missilestack_large", 9.8, -4, 0],
      ["prop_munition_ammo_box_1_closed_a", 15, -3.4, 80]] },
    { "name": "werkstatt-west", "stufe": "mittel", "aus": "energie+werkzeug", "wand": "w", "at": [3.5, -46], "glieder": [
      ["prop_werkzeug_workbench_table_1_light_a", -2.8, -0.81, 0], ["prop_werkzeug_tool_drawer_1_a", -5.2, -0.72, 0],
      ["prop_werkzeug_tool_drawer_1_a", -0.4, -0.72, 0], ["prop_werkzeug_cabinet_tool_1_a", 1.2, -0.92, 0],
      ["prop_energie_generator_mobile_1_d", 4.6, -1.14, 0], ["prop_heben_ladder_freestanding_0065x0025x06_b", 7.4, -0.48, 0],
      ["prop_werkzeug_workbench_mobile_1_a", -2.8, -3.4, 90], ["prop_werkzeug_tool_welder_a", 3.4, -3, -25],
      ["prop_luft_heater_freestanding_1_a", 6.6, -3.3, 200], ["prop_heben_ladder_step_1_a", 0.6, -2.6, 15],
      ["prop_licht_light_portable_tripod_1_base_a", -6.4, -3.2, 140], ["prop_kabel_cable_reel_7_a", 2, -4.6, 60]], "spuren": [["decal_oel_0", 4.6, -2.7, 1, 30], ["decal_abrieb_0", -2.8, -5.3, 2.4, 0]] },
    { "name": "energie-west", "stufe": "mittel", "aus": "energie+luft+reinigung+sicherheit+treibstoff", "wand": "w", "at": [3.5, -24], "glieder": [
      ["prop_energie_generator_oxygen_1_a", 8.6, -2.2, 0], ["prop_energie_generator_mining_1_a", 5.4, -1.25, 0],
      ["prop_energie_generator_standing_1_a", 3.1, -1.17, 0], ["prop_diagnose_server_rack_1_a", -0.4, -0.9, 0],
      ["prop_diagnose_server_rack_1_a", -4, -0.9, 0], ["prop_lager_cell_power_1_rack_a", -8.4, -1.42, 0],
      ["prop_kabel_cable_terminal_1_floor_a", 1.8, -2.3, 0], ["prop_kabel_cable_reel_6_a", -2, -3.4, 15], ["prop_kabel_cable_floor_1_a", 2.8, -4, 90],
      ["prop_licht_light_portable_tripod_1_base_a", -6, -4, 160]], "spuren": [["decal_oel_1", 5.4, -2.9, 1.2, 70]] },
    { "name": "leitstand-galerie", "stufe": "hoch", "aus": "diagnose+kabel", "wand": "s", "at": [19, -1.75], "glieder": [
      ["prop_diagnose_server_rack_1_a", -8, -0.9, 0], ["prop_diagnose_server_rack_1_a", -4.4, -0.9, 0],
      ["prop_diagnose_console_diagnostic_1_a", -0.5, -1.2, 0], ["prop_diagnose_console_diagnostic_1_a", 1, -1.2, 0],
      ["prop_diagnose_computer_1_a", 2.6, -0.95, 0], ["prop_kabel_cable_reel_7_a", 3.6, -2.4, 20],
      ["prop_diagnose_console_diagnostic_2_a", -3, -3.6, 160], ["prop_lager_salvage_shelf_1_a", 6, -0.5, 0],
      ["prop_lager_salvage_shelf_1_b", 6.8, -0.5, 0], ["prop_lager_salvage_shelf_1_a", 7.6, -0.5, 0], ["prop_lager_salvage_shelf_1_a", 8.4, -0.5, 0],
      ["prop_reinigung_trash_piles_1_c", 7.4, -1.7, 10], ["prop_lager_crate_multipurpose_1_0125x0125x0125_a", 10.6, -1.1, 5],
      ["prop_lager_crate_dry_1_0125x0125x00625_a", 10.6, -1.1, -3, 1.26]] },
    { "name": "sanitaet-galerie", "stufe": "hoch", "aus": "sicherheit+transport", "wand": "s", "at": [45, -1.75], "glieder": [
      ["prop_sicherheit_canister_medical_1_stand_b", 0, -0.65, 0], ["prop_transport_prop_dumper_int_transport_pallet_a", 2.2, -0.85, 0],
      ["prop_sicherheit_medical_canister_1_a", -1.1, -0.5, 0], ["prop_sicherheit_medical_canister_1_a", -1.55, -0.55, 20],
      ["prop_sicherheit_tool_fire_extinguisher_1_a", -2.3, -0.5, 0], ["prop_lager_crate_metal_4_0125x0125x0125_a_yellow", 2, -2.6, -8]] },
    { "name": "lager-galerie", "stufe": "hoch", "aus": "lager", "wand": "s", "at": [56, -1.75], "glieder": [
      ["prop_lager_crate_stack_1_03x025x0125_a", -4.6, -2, 0], ["prop_lager_crate_stack_1_03x025x0125_a", -1.6, -2, 0],
      ["prop_lager_crate_stack_1_025x0125x00625_a", 1, -1.7, 0], ["prop_lager_drum_dry_1_a", 2.5, -0.6, 0],
      ["prop_lager_drum_dry_1_a", 3.05, -0.65, 0], ["prop_lager_drum_dry_1_a", 2.75, -1.15, 0],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", 4.6, -0.95, 0], ["prop_lager_crate_multipurpose_1_0125x0125x0125_a", 4.6, -0.95, 8, 1.25],
      ["prop_transport_trolley_cargo_4_a", 5.9, -3.6, -12], ["prop_lager_box_plastic_4_weapon_005x010x005_a", -4.5, -4.2, 0],
      ["prop_lager_box_plastic_4_weapon_005x010x005_a", -3.4, -4.2, 0], ["prop_lager_box_plastic_4_weapon_005x010x005_a", -4, -4.2, 0, 0.5],
      ["prop_lager_box_plastic_4_ammo_0025x005x0025_a", -2.4, -4, 30], ["prop_lager_box_plastic_4_ammo_0025x005x0025_a", -2, -4.5, 75]] },
    { "name": "lager-ost", "stufe": "hoch", "aus": "lager+reinigung", "wand": "o", "at": [68.5, -24], "glieder": [
      ["prop_lager_salvage_shelf_1_a", -10, -0.5, 0], ["prop_lager_salvage_shelf_1_b", -9.2, -0.5, 0], ["prop_lager_salvage_shelf_1_a", -8.4, -0.5, 0],
      ["prop_lager_salvage_shelf_1_a", -7.6, -0.5, 0], ["prop_lager_salvage_shelf_1_b", -6.8, -0.5, 0], ["prop_lager_salvage_shelf_1_a", -6, -0.5, 0],
      ["prop_reinigung_trash_piles_1_c", -8.5, -1.7, 10], ["prop_lager_crate_stack_1_025x0125x00625_a", -3.5, -1.7, 0],
      ["prop_lager_crate_stack_1_025x0125x00625_a", -1.6, -1.7, 0], ["prop_lager_crate_weapon_4_015x0075x0075_a", 0.8, -0.8, 0],
      ["prop_lager_crate_weapon_4_015x0075x0075_a", 0.8, -0.8, 0, 0.75], ["prop_lager_crate_weapon_4_015x0075x0075_a", 2.4, -0.8, 0],
      ["prop_transport_trolley_mobile_1_a", 5, -3.2, 90], ["prop_lager_drum_dry_1_a", 8.6, -0.6, 0], ["prop_lager_drum_dry_1_a", 9.2, -0.8, 0],
      ["prop_reinigung_trash_bag_pile_1_h", 9.6, -3.4, 30]] },
    { "name": "transport-ost", "stufe": "hoch", "aus": "transport", "wand": "o", "at": [68.5, -73], "glieder": [
      ["prop_transport_trolley_cargo_1_a", -12.5, -4, 0], ["prop_transport_machine_forklift_1_extension_console_a", -9, -1, 0],
      ["prop_transport_machine_forklift_1_a", 12, -3.5, 10], ["prop_transport_forklift_standing_1_a", 14.8, -1.2, 0],
      ["prop_transport_machine_forklift_1_extension_tank_a", 9.6, -1, 0], ["prop_kabel_cable_reel_6_a", 9.4, -2.6, 40]], "spuren": [["decal_reifenspur_0", 12, -6.6, 3, 90]] },
    { "name": "luft-ost", "stufe": "hoch", "aus": "schlauch", "wand": "o", "at": [68.5, -99], "glieder": [
      ["prop_schlauch_lt_sm_airduct_fan_a", -4.2, -0.95, 0], ["prop_schlauch_lt_airduct_hose_straight_8m_a", 0.4, -1.05, 0],
      ["prop_schlauch_lt_airduct_hose_corner_1m_a", 5.05, -1, 0], ["prop_luft_heater_freestanding_1_a", -1.5, -2.6, 170],
      ["prop_luft_heater_freestanding_1_a", 2, -2.7, 190], ["prop_energie_generator_mobile_1_b", 0.4, -4.4, 0],
      ["prop_reinigung_tank_water_3_waste_0125x0125x0125_a", -6.1, -0.95, 0], ["prop_reinigung_tank_water_3_waste_0125x0125x0125_a", -6.1, -2.3, 5],
      ["prop_reinigung_tool_mop_1_bucket_a", -4, -2.6, 0], ["prop_reinigung_tool_mop_1_a", -3.3, -2.45, 30],
      ["prop_reinigung_trash_piles_1_a", -6, -4.2, 20]] },
    { "name": "tankstelle-ost", "stufe": "hoch", "aus": "sicherheit+treibstoff", "wand": "o", "at": [68.5, -116], "glieder": [
      ["prop_treibstoff_tank_gas_3_05x025x025_a", -5.4, -1.64, 0], ["prop_treibstoff_tank_gas_3_05x025x025_a", -0.2, -1.64, 0],
      ["prop_schlauch_hose_reel_1_065x045x045_b", 5, -3.7, 90], ["prop_schlauch_hose_floor_1_socket_a", -2, -4.2, 0],
      ["prop_schlauch_hose_floor_1_a", -1.2, -5, 90], ["prop_treibstoff_cell_fuel_1_a", -6.6, -3.2, 0],
      ["prop_treibstoff_cell_fuel_1_a", -6.3, -3.35, 40], ["prop_treibstoff_cell_fuel_1_a", -6.55, -3.6, 70],
      ["prop_treibstoff_cell_fuel_1_a", -6.9, -3.5, 20], ["prop_sicherheit_tool_fire_extinguisher_1_a", -7.6, -3.25, 0],
      ["prop_sicherheit_barrier_caution_005x005x0125_a", -6, -5.6, 0], ["prop_sicherheit_barrier_caution_005x005x0125_a", -3.4, -6.2, 0],
      ["prop_sicherheit_cone_2_a", -5, -6.9, 0], ["prop_sicherheit_cone_2_a", -2.2, -7.2, 30], ["prop_sicherheit_cone_2_a", 0.4, -7, 0]], "spuren": [["decal_oel_2", -2.2, -5.2, 2.4, 20]] },
    { "name": "tor-west", "stufe": "mittel", "aus": "lager+transport", "wand": "n", "at": [16, -136], "glieder": [
      ["prop_lager_storage_container_1_025x05x025_a", 5.2, -2.9, 0], ["prop_lager_storage_container_1_025x05x025_a", 2.6, -2.9, 0],
      ["prop_lager_storage_container_1_025x05x025_a", 5.2, -2.9, 0, 2.5], ["prop_lager_crate_stack_1_03x025x0125_a", -1, -2.1, 0],
      ["prop_transport_prop_dumper_transport_pallet_a", -4, -1.7, 0], ["prop_lager_crate_dry_2_0125x0125x0125_a", -4.63, -1.7, 0, 0.25],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", -3.37, -1.7, 0, 0.25], ["prop_transport_trolley_pallet_1_a", -4, -4.35, 0],
      ["prop_kabel_cable_reel_6_a", -7.5, -0.9, 0], ["prop_transport_machine_forklift_1_extension_tank_a", -6.4, -2.2, 0]], "spuren": [["decal_reifenspur_0", -4, -7, 3, 0]] },
    { "name": "tor-ost", "stufe": "hoch", "aus": "kabel+transport", "wand": "n", "at": [56, -136], "glieder": [
      ["prop_lager_cell_power_1_rack_a", -4.5, -1.42, 0], ["prop_energie_generator_mobile_1_b", 0, -0.9, 0],
      ["prop_heben_ladder_mobile_1_b", 3.4, -1.6, 0], ["prop_lager_crate_stack_1_025x0125x00625_a", 5.5, -1.7, 0],
      ["prop_sicherheit_cone_2_a", -5, -4, 0], ["prop_sicherheit_cone_2_a", -3, -4, 0], ["prop_sicherheit_cone_2_a", -1, -4, 0],
      ["prop_licht_light_portable_tripod_1_base_a", -1.5, -3, 200]] },
    { "name": "munition-ausgabe-west", "stufe": "hoch", "aus": "munition", "wand": "w", "at": [3.5, -73], "glieder": [
      ["prop_munition_crate_torpedo_1_07x0075x0075_a", -5, -9, 0], ["prop_munition_crate_torpedo_1_05x0075x0075_a", -5, -9, 0, 0.77],
      ["prop_munition_crate_torpedo_1_03x0075x0075_open_a", -5.6, -10.2, 0], ["prop_munition_uee_lawless_prop_missilestack_large", 1, -9.4, 90],
      ["prop_munition_ammo_box_1_pallet_125x125x025_a", 4.6, -9.6, 0], ["prop_munition_ammo_box_1_ballistic_05x025x025_a", 4.35, -9.95, 0, 0.25],
      ["prop_munition_ammo_box_1_ballistic_05x025x025_a", 4.85, -9.95, 0, 0.25],
      ["prop_munition_ammo_box_1_ballistic_05x025x025_a", 4.35, -9.6, 0, 0.25],
      ["prop_munition_ammo_box_1_ballistic_05x025x025_a", 4.85, -9.6, 0, 0.25],
      ["prop_munition_ammo_box_1_ballistic_05x025x025_a", 4.35, -9.25, 0, 0.25],
      ["prop_munition_ammo_box_1_ballistic_05x025x025_a", 4.6, -9.6, 90, 0.5]], "spuren": [["decal_abrieb_0", -1.8, -9.6, 3, 0]] },
    { "name": "werkinsel-west", "stufe": "mittel", "aus": "werkzeug", "wand": "w", "at": [3.5, -36], "glieder": [
      ["prop_werkzeug_workbench_mobile_1_a", 0, -9.6, 90], ["prop_werkzeug_tool_welder_a", -3.4, -9, 30],
      ["prop_licht_light_work_light_1_a", 3.2, -8.5, 0], ["prop_transport_trolley_creeper_1_a", -0.8, -7.3, 80],
      ["prop_werkzeug_bag_toolbox_2_a", 2.7, -10.9, 20], ["prop_werkzeug_storage_toolbox_a", -2.2, -10.9, -30],
      ["prop_kabel_cable_reel_7_a", 4.6, -10.3, 30]], "spuren": [["decal_oel_1", -2.4, -8.4, 1, 50]] },
    { "name": "frachtinsel-west", "stufe": "mittel", "aus": "lager+transport", "wand": "w", "at": [3.5, -59], "glieder": [
      ["prop_transport_prop_dumper_transport_pallet_a", 0, -9.8, 0], ["prop_lager_crate_dry_2_0125x0125x0125_a", -0.625, -10.425, 0, 0.25],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", 0.625, -10.425, 0, 0.25], ["prop_lager_crate_dry_2_0125x0125x0125_a", -0.625, -9.175, 0, 0.25],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", 0.625, -9.175, 0, 0.25], ["prop_lager_crate_metal_4_0125x0125x0125_a_yellow", 0, -9.8, 8, 1.5],
      ["prop_transport_trolley_pallet_1_a", 2.3, -9.7, 0], ["prop_transport_prop_dumper_transport_pallet_a", -3.1, -9.8, 0],
      ["prop_lager_crate_weapon_4_015x0075x0075_a", -3.1, -10.175, 0, 0.25], ["prop_lager_crate_weapon_4_015x0075x0075_a", -3.1, -9.425, 0, 0.25],
      ["prop_lager_crate_weapon_4_015x0075x0075_a", -3.1, -9.8, 0, 1]], "spuren": [["decal_reifenspur_0", 2.3, -7, 3, 90]] },
    { "name": "ladeinsel-ost", "stufe": "hoch", "aus": "lager+transport", "wand": "o", "at": [68.5, -73], "glieder": [
      ["prop_transport_prop_dumper_transport_pallet_a", -2, -9.2, 0], ["prop_lager_crate_dry_2_0125x0125x0125_a", -2.625, -9.825, 0, 0.25],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", -1.375, -9.825, 0, 0.25], ["prop_lager_crate_dry_2_0125x0125x0125_a", -2.625, -8.575, 0, 0.25],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", -1.375, -8.575, 0, 0.25], ["prop_lager_crate_metal_4_0125x0125x0125_a_yellow", -2, -9.2, -6, 1.5],
      ["prop_lager_crate_stack_1_03x025x0125_a", 2.4, -9, 90], ["prop_transport_trolley_pallet_1_a", -4.7, -9.2, 0]] },
    { "name": "werkplatz-ost", "stufe": "hoch", "aus": "energie+werkzeug", "wand": "o", "at": [68.5, -48], "glieder": [
      ["prop_energie_generator_oxygen_1_a", -1, -2.2, 0], ["prop_werkzeug_workbench_table_1_light_a", 6.6, -0.41, 0],
      ["prop_werkzeug_tool_drawer_1_a", 9, -0.32, 0], ["prop_werkzeug_tool_drawer_1_a", 4.2, -0.32, 0],
      ["prop_werkzeug_cabinet_tool_1_a", -7.4, -0.52, 0], ["prop_heben_ladder_mobile_1_b", -5, -3.6, 90],
      ["prop_werkzeug_tool_welder_a", 5.4, -2.6, -20], ["prop_energie_generator_mobile_1_d", -8, -6.4, 90],
      ["prop_kabel_cable_floor_1_a", -1, -6.4, 0], ["prop_kabel_cable_reel_6_a", 2.6, -4.6, 20]], "spuren": [["decal_oel_0", 0.6, -6.6, 1.6, 20]] },
    { "name": "containerlager-galerie", "stufe": "hoch", "aus": "lager+transport", "wand": "s", "at": [19, -1.75], "glieder": [
      ["prop_lager_storage_container_1_025x05x025_a", -8, -11.5, 90], ["prop_lager_storage_container_1_025x05x025_a", -8, -11.5, 90, 2.5],
      ["prop_lager_storage_container_1_025x05x025_a", -8, -14.2, 90], ["prop_transport_machine_forklift_1_b", -1.6, -12.8, 250],
      ["prop_transport_prop_dumper_transport_pallet_a", 3.6, -11.6, 0], ["prop_lager_crate_dry_2_0125x0125x0125_a", 2.975, -12.225, 0, 0.25],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", 4.225, -12.225, 0, 0.25], ["prop_lager_crate_dry_2_0125x0125x0125_a", 2.975, -10.975, 0, 0.25],
      ["prop_lager_crate_dry_2_0125x0125x0125_a", 4.225, -10.975, 0, 0.25], ["prop_lager_crate_dry_1_0125x0125x00625_a", 3.6, -11.6, 6, 1.5]], "spuren": [["decal_reifenspur_0", -1.6, -8.6, 3.2, 0]] },
    { "name": "fahrzeugplatz-galerie", "stufe": "hoch", "aus": "transport", "wand": "s", "at": [56, -1.75], "glieder": [
      ["prop_transport_trolley_cargo_1_a", -4, -12.2, 90], ["prop_transport_trolley_mobile_1_a", 5, -10.2, 0],
      ["prop_transport_machine_forklift_1_a", 6, -15.2, 160]], "spuren": [["decal_reifenspur_0", 1, -15, 3.2, 90]] }
  ]
} /* /work-deko */;
// Drehung des Platzes je Wand (Grad um y): z des Platzes zeigt zur Wand
const DEKO_WAND = { w: -90, o: 90, n: 180, s: 0 };

// Grundriss des Schiffs von unten für den Wartungsplatz: je Zelle
// (DIENST_CELL) die tiefste Höhe des Rumpfs darüber, Infinity, wo nichts
// ist. Im Raum des Schiffs (Mitte, Boden 0) über ±hw × ±hl und DIENST_OVER
// darüber hinaus (der Kasten ohne Ausreißer schneidet Flügelspitzen ab:
// Beim Gladius reichen sie gut 0,5 m weiter); kleine Dreiecke
// zählen mit ihrer tiefsten Ecke, große über Kanten und Zellmitten mit der
// Höhe ihrer Ebene. Mit pause in Häppchen (slicer).
async function shipUnder(root, hw, hl, pause = noPause) {
  const C = DIENST_CELL, M = DIENST_OVER, x0 = -hw - M, z0 = -hl - M;
  const nx = Math.ceil((2 * (hw + M)) / C), nz = Math.ceil((2 * (hl + M)) / C);
  const low = new Float32Array(nx * nz).fill(Infinity);
  const cell = (i, j, y) => { if (i >= 0 && j >= 0 && i < nx && j < nz && y < low[j * nx + i]) low[j * nx + i] = y; };
  const put = (x, z, y) => cell(Math.floor((x - x0) / C), Math.floor((z - z0) / C), y);
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((n) => { if (n.isMesh && n.visible && n.geometry.attributes.position) meshes.push(n); });
  for (const mesh of meshes) {
    await pause();
    const g = mesh.geometry, P = g.attributes.position, m = mesh.matrixWorld.elements, n = P.count;
    const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
    const raw = !P.isInterleavedBufferAttribute && !P.normalized && P.itemSize === 3 ? P.array : null;
    for (let i = 0; i < n; i++) {
      const x = raw ? raw[i * 3] : P.getX(i), y = raw ? raw[i * 3 + 1] : P.getY(i), z = raw ? raw[i * 3 + 2] : P.getZ(i);
      X[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
      Y[i] = m[1] * x + m[5] * y + m[9] * z + m[13];
      Z[i] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    const I = g.index?.array, T = I ? I.length : n;
    const edge = (a, b) => {
      const k = Math.ceil(Math.hypot(X[b] - X[a], Z[b] - Z[a]) / (C * 0.5)) || 1;
      for (let s = 0; s <= k; s++) put(X[a] + ((X[b] - X[a]) * s) / k, Z[a] + ((Z[b] - Z[a]) * s) / k, Y[a] + ((Y[b] - Y[a]) * s) / k);
    };
    for (let t = 0; t + 2 < T; t += 3) {
      if (!(t % 49152)) await pause();
      const a = I ? I[t] : t, b = I ? I[t + 1] : t + 1, c = I ? I[t + 2] : t + 2;
      const i0 = Math.floor((Math.min(X[a], X[b], X[c]) - x0) / C), i1 = Math.floor((Math.max(X[a], X[b], X[c]) - x0) / C);
      const j0 = Math.floor((Math.min(Z[a], Z[b], Z[c]) - z0) / C), j1 = Math.floor((Math.max(Z[a], Z[b], Z[c]) - z0) / C);
      if (i1 - i0 <= 1 && j1 - j0 <= 1) {
        const y = Math.min(Y[a], Y[b], Y[c]);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cell(i, j, y);
        continue;
      }
      edge(a, b); edge(b, c); edge(c, a);
      const d = (X[b] - X[a]) * (Z[c] - Z[a]) - (X[c] - X[a]) * (Z[b] - Z[a]);
      if (Math.abs(d) < 1e-6) continue;
      for (let j = Math.max(0, j0); j <= Math.min(nz - 1, j1); j++) {
        const pz = z0 + (j + 0.5) * C;
        for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
          const px = x0 + (i + 0.5) * C;
          const wa = ((X[b] - px) * (Z[c] - pz) - (X[c] - px) * (Z[b] - pz)) / d;
          const wb = ((X[c] - px) * (Z[a] - pz) - (X[a] - px) * (Z[c] - pz)) / d;
          if (wa >= 0 && wb >= 0 && wa + wb <= 1) cell(i, j, wa * Y[a] + wb * Y[b] + (1 - wa - wb) * Y[c]);
        }
      }
    }
  }
  return { x0, z0, nx, nz, C, low };
}

// Leitung biegen: src liegt längs z (Ursprung beliebig, box: ihr Kasten),
// pts die Punkte des Wegs. Längs wird auf den Weg verteilt, quer bleibt der
// Querschnitt (x zur Seite, y nach oben, die Unterseite auf dem Weg).
// Liefert eine Geometrie mit eigenen Ecken und Normalen, Rest geteilt.
function bendAlong(src, box, pts) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const N = 128, S = curve.getSpacedPoints(N);
  const up = new THREE.Vector3(0, 1, 0), T = [], X = [], U = [];
  let prev = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= N; i++) {
    const t = new THREE.Vector3().subVectors(S[Math.min(N, i + 1)], S[Math.max(0, i - 1)]).normalize();
    const x = new THREE.Vector3().crossVectors(up, t);
    if (x.lengthSq() < 1e-6) x.copy(prev); else x.normalize();
    prev = x;
    T.push(t); X.push(x); U.push(new THREE.Vector3().crossVectors(t, x));
  }
  const P = src.attributes.position, Nn = src.attributes.normal, n = P.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const cx = (box.min.x + box.max.x) / 2, z0 = box.min.z, L = Math.max(1e-6, box.max.z - box.min.z);
  const p = new THREE.Vector3(), t = new THREE.Vector3(), x = new THREE.Vector3(), u = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const f = THREE.MathUtils.clamp((P.getZ(i) - z0) / L, 0, 1) * N, k = Math.min(N - 1, Math.floor(f)), w = f - k;
    p.lerpVectors(S[k], S[k + 1], w); t.lerpVectors(T[k], T[k + 1], w).normalize();
    x.lerpVectors(X[k], X[k + 1], w).normalize(); u.lerpVectors(U[k], U[k + 1], w).normalize();
    const lx = P.getX(i) - cx, ly = P.getY(i) - box.min.y;
    pos[i * 3] = p.x + x.x * lx + u.x * ly; pos[i * 3 + 1] = p.y + x.y * lx + u.y * ly; pos[i * 3 + 2] = p.z + x.z * lx + u.z * ly;
    const a = Nn.getX(i), b = Nn.getY(i), c = Nn.getZ(i);
    nor[i * 3] = x.x * a + u.x * b + t.x * c; nor[i * 3 + 1] = x.y * a + u.y * b + t.y * c; nor[i * 3 + 2] = x.z * a + u.z * b + t.z * c;
  }
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(src.attributes)) g.setAttribute(k, a);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(src.index);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return { geo: g, length: curve.getLength() };
}

// Belegung des Hallenbodens im Modellraum: je Zelle (WORK_CELL) 1, wenn
// Halle oder Einrichtung dort im Band WORK_BAND über dem Boden etwas hat.
// Kanten werden abgeschritten (senkrechte Wände haben im Grundriss keine
// Fläche), Flächen über die Zellmitten geprüft.
async function floorGrid(model, room, floorY, skip, pause = noPause) {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const C = WORK_CELL, x0 = room.center[0] - room.halfW, z0 = room.center[2] - room.halfL;
  const nx = Math.ceil((2 * room.halfW) / C), nz = Math.ceil((2 * room.halfL) / C);
  const cells = new Uint8Array(nx * nz);
  const y0 = floorY + WORK_BAND[0], y1 = floorY + WORK_BAND[1];
  const mark = (x, z) => {
    const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C);
    if (i >= 0 && j >= 0 && i < nx && j < nz) cells[j * nx + i] = 1;
  };
  const edge = (ax, az, bx, bz) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (C * 0.5)) || 1;
    for (let s = 0; s <= n; s++) mark(ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n);
  };
  const meshes = [];
  model.traverse((n) => {
    if (!n.isMesh || !n.geometry.attributes.position) return;
    for (let p = n; p; p = p.parent) if (skip.has(p)) return;
    meshes.push(n);
  });
  const M = new THREE.Matrix4(), bb = new THREE.Box3();
  const band = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x0 + nx * C, y1, z0 + nz * C));
  let tris = 0;
  for (const mesh of meshes) {
    await pause();
    const g = mesh.geometry, P = g.attributes.position;
    M.multiplyMatrices(toModel, mesh.matrixWorld);
    if (!g.boundingBox) g.computeBoundingBox();
    if (!bb.copy(g.boundingBox).applyMatrix4(M).intersectsBox(band)) continue;
    const m = M.elements, n = P.count, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
    const raw = !P.isInterleavedBufferAttribute && !P.normalized && P.itemSize === 3 ? P.array : null;
    for (let i = 0; i < n; i++) {
      const x = raw ? raw[i * 3] : P.getX(i), y = raw ? raw[i * 3 + 1] : P.getY(i), z = raw ? raw[i * 3 + 2] : P.getZ(i);
      X[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
      Y[i] = m[1] * x + m[5] * y + m[9] * z + m[13];
      Z[i] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    const I = g.index?.array, T = I ? I.length : n;
    for (let t = 0; t + 2 < T; t += 3) {
      if (!(t % 49152)) await pause();
      const a = I ? I[t] : t, b = I ? I[t + 1] : t + 1, c = I ? I[t + 2] : t + 2;
      if (Math.max(Y[a], Y[b], Y[c]) < y0 || Math.min(Y[a], Y[b], Y[c]) > y1) continue;
      tris++;
      edge(X[a], Z[a], X[b], Z[b]); edge(X[b], Z[b], X[c], Z[c]); edge(X[c], Z[c], X[a], Z[a]);
      const d = (X[b] - X[a]) * (Z[c] - Z[a]) - (X[c] - X[a]) * (Z[b] - Z[a]);
      if (Math.abs(d) < C * C) continue;
      const i0 = Math.max(0, Math.floor((Math.min(X[a], X[b], X[c]) - x0) / C)), i1 = Math.min(nx - 1, Math.floor((Math.max(X[a], X[b], X[c]) - x0) / C));
      const j0 = Math.max(0, Math.floor((Math.min(Z[a], Z[b], Z[c]) - z0) / C)), j1 = Math.min(nz - 1, Math.floor((Math.max(Z[a], Z[b], Z[c]) - z0) / C));
      const sg = Math.sign(d);
      for (let j = j0; j <= j1; j++) {
        const pz = z0 + (j + 0.5) * C;
        for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + 0.5) * C;
          if (sg * ((X[b] - X[a]) * (pz - Z[a]) - (Z[b] - Z[a]) * (px - X[a])) >= 0
            && sg * ((X[c] - X[b]) * (pz - Z[b]) - (Z[c] - Z[b]) * (px - X[b])) >= 0
            && sg * ((X[a] - X[c]) * (pz - Z[c]) - (Z[a] - Z[c]) * (px - X[c])) >= 0) cells[j * nx + i] = 1;
        }
      }
    }
  }
  // Rechteck [x ± hx] × [z ± hz]: ganz im Raum und frei / als belegt eintragen
  const span = (x, z, hx, hz) => [Math.floor((x - hx - x0) / C), Math.floor((x + hx - x0) / C), Math.floor((z - hz - z0) / C), Math.floor((z + hz - z0) / C)];
  const free = (x, z, hx, hz) => {
    const [i0, i1, j0, j1] = span(x, z, hx, hz);
    if (i0 < 0 || j0 < 0 || i1 >= nx || j1 >= nz) return false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (cells[j * nx + i]) return false;
    return true;
  };
  const fill = (x, z, hx, hz) => {
    const [i0, i1, j0, j1] = span(x, z, hx, hz);
    for (let j = Math.max(0, j0); j <= Math.min(nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) cells[j * nx + i] = 1;
  };
  // Gedrehtes Rechteck (Halbmaße hx, hz, Drehung a um y wie makeRotationY):
  // frei, wenn keine belegte Zellmitte darin liegt (Hallendeko)
  const freeRot = (x, z, hx, hz, a) => {
    const ca = Math.cos(a), sa = Math.sin(a), ex = Math.abs(ca) * hx + Math.abs(sa) * hz, ez = Math.abs(sa) * hx + Math.abs(ca) * hz;
    const [i0, i1, j0, j1] = span(x, z, ex, ez);
    if (i0 < 0 || j0 < 0 || i1 >= nx || j1 >= nz) return false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!cells[j * nx + i]) continue;
      const dx = x0 + (i + 0.5) * C - x, dz = z0 + (j + 0.5) * C - z;
      if (Math.abs(dx * ca - dz * sa) <= hx && Math.abs(dx * sa + dz * ca) <= hz) return false;
    }
    return true;
  };
  let used = 0;
  for (const v of cells) used += v;
  return { free, freeRot, fill, tris, share: used / cells.length };
}

// Spielboden für das Feld (WORK_PAD, `which` aus ?boden=) aus der
// Bodendatei: { name, mat, tile } mit der Kachel in m je UV-Einheit aus
// info.floors, oder null (Lack)
const padPick = (which) => (which === 'lack' || Object.hasOwn(WORK_PAD.floors, which ?? '') ? which : WORK_PAD.pick);
function padFloor(scene, info, which) {
  const name = WORK_PAD.floors[padPick(which)];
  let mat = null;
  if (name) scene?.getObjectByName(name)?.traverse((o) => { if (!mat && o.isMesh) mat = o.material; });
  if (!mat) return null;
  const f = (info.floors || []).find((e) => e.node === name || e.wearNode === name);
  return { name, mat, tile: f?.tiling?.[0] || 4 };
}

// Requisiten und Decals aus der Werkstattdatei an ihre Plätze (siehe oben).
// scenes: die geladenen GLBs (Requisiten, Boden), info: die json, L: das
// Schiffsfeld (HALL_LIFT), budget: WORK_BUDGET der Stufe, grid: floorGrid.
// rim: so breit liegt der feste Rand um das Feld (HALL_RAND, 0 ohne); was
// neben dem Feld steht oder liegt, rückt um ihn nach außen, damit der
// Gittersteg frei bleibt wie im Spiel.
// Liefert { nodes, field, stats }: nodes (Requisiten und Decals neben dem
// Feld) hängen mit Bezugspunkt (userData.anchor) im Modell, für
// mergeFurniture; field (Decals auf dem Feld) für die Aufzugsgruppe.
function placeWorkshop(model, scenes, info, L, room, floorY, budget, grid, rim = 0) {
  const R = THREE.MathUtils.DEG2RAD;
  const kit = new Map();
  for (const s of scenes) s?.traverse((n) => { if (/^(prop|decal)_/.test(n.name) && !kit.has(n.name)) kit.set(n.name, n); });
  const cx = (L.from[0] + L.to[0]) / 2, cz = (L.from[1] + L.to[1]) / 2, hx = (L.to[0] - L.from[0]) / 2, hz = (L.to[1] - L.from[1]) / 2;
  const decalInfo = new Map((info.decals || []).map((d) => [d.node, d])), propInfo = new Map((info.props || []).map((q) => [q.node, q]));
  const stats = { source: info.layout?.source || null, rim, props: 0, decals: 0, field: 0, inField: 0, blocked: 0, moved: 0, overBudget: 0, missing: 0, raised: 0 };
  // Maße je Knoten im eigenen Raum (Ursprung unten mittig), Materialien
  const box = new THREE.Box3(), meta = new Map();
  const metaOf = (name) => {
    if (meta.has(name)) return meta.get(name);
    const c = kit.get(name).clone();
    c.position.set(0, 0, 0); c.quaternion.identity(); c.scale.set(1, 1, 1);
    c.updateMatrixWorld(true);
    box.setFromObject(c);
    const mats = new Set();
    c.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) mats.add(m); });
    const e = { size: box.getSize(new THREE.Vector3()), centre: box.getCenter(new THREE.Vector3()), low: box.min.y, mats };
    meta.set(name, e);
    return e;
  };
  // Anordnung: aus dem Spiel, sonst eine schlichte Aufstellung (Requisiten
  // an den Längsseiten zum Feld gewandt, Decals verstreut auf und neben dem
  // Feld); die Konsole sagt, welche es ist.
  let items = (info.layout?.items || []).filter((it) => {
    if (!kit.has(it.node)) { stats.missing++; return false; }
    if (Math.abs(it.y ?? 0) > WORK_FLOOR) { stats.raised++; return false; }
    return true;
  });
  // Spuren aufs Feld (WORK_FIELD), Kantenlänge wie meist in der Anordnung
  const edge = (n) => { const a = items.filter((it) => it.node === n).map((it) => it.at[3] ?? 1).sort((p, q) => p - q); return a.length ? a[a.length >> 1] : 1; };
  const fieldSpots = WORK_FIELD.filter(([n]) => kit.has(n)).map(([n, u, v], i) => ({ node: n, frac: [u, v], at: [0, 0, (i * 137.5) % 360, edge(n)] }));
  stats.missing += WORK_FIELD.length - fieldSpots.length;
  let pad = info.layout?.pad?.size;
  if (!items.length) {
    stats.source = null;
    pad = [2 * hx, 2 * hz];
    const names = [...kit.keys()];
    let side = 1, along = [-0.5 * hz, -0.5 * hz];
    for (const n of names.filter((n) => n.startsWith('prop_'))) {
      const s = metaOf(n).size, k = side > 0 ? 0 : 1;
      items.push({ node: n, at: [side * (hx + WORK_EDGE + 1.5 + s.z / 2), along[k] + s.x / 2, side > 0 ? -90 : 90, 1] });
      along[k] += s.x + 1.5;
      side = -side;
    }
    const spots = names.filter((n) => n.startsWith('decal_'));
    for (let i = 0; i < spots.length * 3; i++) {
      const u = ((i * 0.618034) % 1) * 2 - 1, v = ((i * 0.414214 + 0.27) % 1) * 2 - 1;
      items.push({ node: spots[i % spots.length], at: [u * (hx + 6), v * (hz + 6), (i * 137) % 360, 1] });
    }
  }
  if (!pad) pad = [2 * hx, 2 * hz];
  items.push(...fieldSpots);
  let px = pad[0] / 2, pz = pad[1] / 2;
  const turn = (px > pz) !== (hx > hz);
  if (turn) [px, pz] = [pz, px];
  // Über dem Feld anteilig; daneben in Metern vom Feldrand, gestaucht, wenn
  // die Spielhalle auf dieser Seite tiefer ist als unsere bis zur Wand
  const deep = (sign, a) => Math.max(1, ...items.map((it) => {
    const v = turn ? (a ? -it.at[0] : it.at[1]) : it.at[a];
    return Math.sign(v) === sign ? Math.abs(v) - (a ? pz : px) : 0;
  })) + 1;
  const wall = (sign, a) => (a ? (sign > 0 ? room.center[2] + room.halfL - (cz + hz) : cz - hz - (room.center[2] - room.halfL)) : (sign > 0 ? room.center[0] + room.halfW - (cx + hx) : cx - hx - (room.center[0] - room.halfW))) - WORK_WALL;
  // Mit Rand zählt der Abstand ab seiner Außenkante, hier wie in der
  // Anordnung des Spiels (dort liegt derselbe Steg um die Öffnung, pad)
  const squeeze = [[0, 1], [1, 1], [0, -1], [1, -1]].reduce((o, [a, sg]) => ({ ...o, [`${a}${sg}`]: Math.min(1, Math.max(0, wall(sg, a) - rim) / Math.max(1, deep(sg, a) - rim)) }), {});
  const axis = (v, p, h, a) => (Math.abs(v) <= p ? (v * h) / p : Math.sign(v) * (h + rim + Math.max(0, Math.abs(v) - p - rim) * squeeze[`${a}${Math.sign(v)}`]));
  const rx = hx + rim, rz = hz + rim;   // Außenkante des Rands
  // Budget: zuerst, was Krisz genannt hat (Gerät nach WORK_FIRST, die Spuren
  // auf dem Feld), dann die häufigsten Knoten, solange ihre Materialien reinpassen
  const allow = new Set();
  for (const kind of ['prop_', 'decal_']) {
    const limit = kind === 'prop_' ? budget.props : budget.decals, mats = new Set(), count = new Map();
    if (!limit) continue;
    for (const it of items) if (it.node.startsWith(kind)) count.set(it.node, (count.get(it.node) || 0) + 1);
    const rank = (n) => { const r = kind === 'prop_' ? WORK_FIRST.indexOf(propInfo.get(n)?.rolle) : WORK_FIELD.findIndex(([f]) => f === n); return r < 0 ? 99 : r; };
    for (const [n] of [...count].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])) {
      const add = [...metaOf(n).mats].filter((m) => !mats.has(m));
      if (!metaOf(n).mats.size || mats.size + add.length > limit) continue;
      for (const m of add) mats.add(m);
      allow.add(n);
    }
  }
  const nodes = [], field = [];
  for (const it of items) {
    if (!allow.has(it.node)) { stats.overBudget++; continue; }
    let [x, z, r = 0, s = 1] = it.at;
    if (it.frac) { x = it.frac[0] * hx; z = it.frac[1] * hz; } else {
      if (turn) { [x, z] = [z, -x]; r += 90; }
      x = axis(x, px, hx, 0); z = axis(z, pz, hz, 1);
    }
    const e = metaOf(it.node), decal = it.node.startsWith('decal_');
    // Grundriss als achsparalleler Kasten um den gedrehten Fußabdruck
    const di = decalInfo.get(it.node), unit = decal && di?.size && Math.abs(e.size.x - 1) < 0.05 && Math.abs(e.size.z - 1) < 0.05;
    const sx = (unit ? di.size[0] : 1) * s, sz = (unit ? di.size[1] : 1) * s;
    const c = Math.abs(Math.cos(r * R)), sn = Math.abs(Math.sin(r * R));
    const fx = ((e.size.x * sx) * c + (e.size.z * sz) * sn) / 2, fz = ((e.size.x * sx) * sn + (e.size.z * sz) * c) / 2;
    const onField = Math.abs(x) < hx && Math.abs(z) < hz;
    if (decal) {
      // ganz auf dem Feld (fährt mit) oder ganz daneben, nie über dem Rand
      if (onField) {
        x = fx < hx ? THREE.MathUtils.clamp(x, fx - hx, hx - fx) : 0;
        z = fz < hz ? THREE.MathUtils.clamp(z, fz - hz, hz - fz) : 0;
      } else if (Math.abs(x) < rx + fx && Math.abs(z) < rz + fz) {
        if (rx - Math.abs(x) > rz - Math.abs(z)) z = (Math.sign(z) || 1) * (rz + fz); else x = (Math.sign(x) || 1) * (rx + fx);
      }
    } else {
      if (onField) { stats.inField++; continue; }
      // vom Feldrand weg (Normale der nächsten Kante), dann längs
      const out = hx - Math.abs(x) > hz - Math.abs(z) ? [0, Math.sign(z) || 1] : [Math.sign(x) || 1, 0];
      const ok = (qx, qz) => (Math.abs(qx) >= rx + WORK_EDGE + fx || Math.abs(qz) >= rz + WORK_EDGE + fz) && grid.free(cx + qx, cz + qz, fx + 0.1, fz + 0.1);
      let at = null;
      for (let d = 0; d <= WORK_MOVE && !at; d += 0.5) {
        for (const t of d ? [d, -d] : [0]) {
          for (const n of [0, 0.5, 1, 1.5, 2, 2.5, 3].filter((q) => q <= WORK_MOVE)) {
            const qx = x + out[0] * n + out[1] * t, qz = z + out[1] * n + out[0] * t;
            if (ok(qx, qz)) { at = [qx, qz]; break; }
          }
          if (at) break;
        }
      }
      if (!at) { stats.blocked++; continue; }
      if (at[0] !== x || at[1] !== z) stats.moved++;
      [x, z] = at;
      grid.fill(cx + x, cz + z, fx, fz);
    }
    // Ursprung unten mittig (so bestellt); liegt er anders, gleicht der Kasten es aus
    const n = kit.get(it.node).clone(), ox = e.centre.x * sx, oz = e.centre.z * sz, cr = Math.cos(r * R), sr = Math.sin(r * R);
    n.position.set(cx + x - (ox * cr + oz * sr), floorY - e.low * s + (decal ? WORK_LIFT : 0), cz + z + ox * sr - oz * cr);
    n.rotation.set(0, r * R, 0);
    n.scale.set(sx, s, sz);
    n.userData.anchor = [cx + x, floorY, cz + z];
    n.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = true;
      if (!decal) for (const m of [].concat(o.material)) if (WORK_TWO_SIDED.test(m.name)) { m.side = THREE.DoubleSide; m.alphaTest = 0; }
      if (decal) for (const m of [].concat(o.material)) {
        m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
        if (m.transparent) m.depthWrite = false;
        m.userData.workDecal = true;
      }
    });
    model.add(n);
    if (decal && onField) { field.push(n); stats.field++; } else nodes.push(n);
    if (decal) stats.decals++; else stats.props++;
  }
  return { nodes, field, stats };
}

// Hallen-UVs prüfen: Ist bei einem Material der Großteil der Dreiecke ohne
// UV-Fläche (zerquantisierte Spiel-UVs, scripts/lib/uv-islands.mjs), erscheint
// die Textur als Schmiere und Streifen. Dann wird sie im Shader würfelförmig
// aus der Objektlage projiziert, im Maßstab der heilen Dreiecke desselben
// Materials. Ein sauberer Export schaltet das von selbst ab.
async function hallUvStats(model, pause = noPause) {
  const st = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const meshes = [];
  model.traverse((n) => { if (n.isMesh) meshes.push(n); });
  for (const n of meshes) {
    await pause();
    const g = n.geometry, P = g.attributes.position, U = g.attributes.uv, I = g.index;
    if (!U || !I) continue;
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
  }
  // Median je Material über selectRank statt Sortieren mit Vergleichsfunktion
  for (const e of st.values()) {
    await pause();
    const r = Float64Array.from(e.r), mid = r.length >> 1;
    if (r.length) selectRank(r, mid, 0, r.length - 1);
    e.share = e.tris ? e.deg / e.tris : 0;
    e.mPerUv = r[mid] || 2;
  }
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

// Legt die Verdeckung des GTAO-Passes aufs Bild, vorher je Pixel den Median
// der 3×3 Nachbarn (McGuire, „A fast, small-radius GPU median filter“). Die
// Verdeckung sieht Normalen und Tiefe nur einmal je Pixel, ohne die
// Kantenglättung des Bildes: Leisten und Rillen schmaler als ein Pixel trifft
// sie mal und mal nicht, und jeder Treffer wurde ein dunkler Punkt (an den
// runden Zierleisten der Halle eine gepunktete Körnung). Der Median nimmt
// Punkte und ein Pixel breite Striche heraus und lässt Ecken, Fugen und den
// Schatten unter dem Schiff stehen, die viele Pixel breit sind. Ersetzt
// Kopie und Überblendung des Passes (dessen Ausgabe dafür aus) durch einen Zug.
// Seit 2026-10-15 rechnet der Pass in halber Auflösung (buildComposer): Der
// Median läuft dort in ein eigenes Ziel, das Bild liest es weich vergrößert.
function aoMedianPass(ao, Pass, FullScreenQuad) {
  const vertexShader = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }';
  const med = new THREE.ShaderMaterial({
    uniforms: { tAO: { value: null } },
    vertexShader,
    fragmentShader: `uniform sampler2D tAO;
#define s2(a, b) t = a; a = min(a, b); b = max(t, b);
#define mn3(a, b, c) s2(a, b); s2(a, c);
#define mx3(a, b, c) s2(b, c); s2(a, c);
#define mnmx3(a, b, c) mx3(a, b, c); s2(a, b);
#define mnmx4(a, b, c, d) s2(a, b); s2(c, d); s2(a, c); s2(b, d);
#define mnmx5(a, b, c, d, e) s2(a, b); s2(c, d); mn3(a, c, e); mx3(b, d, e);
#define mnmx6(a, b, c, d, e, f) s2(a, d); s2(b, e); s2(c, f); mn3(a, b, c); mx3(d, e, f);
float aoAt( ivec2 p, ivec2 hi ) { return texelFetch( tAO, clamp( p, ivec2( 0 ), hi ), 0 ).r; }
void main() {
	ivec2 hi = textureSize( tAO, 0 ) - 1, p = ivec2( gl_FragCoord.xy );
	float v0 = aoAt( p + ivec2( -1, -1 ), hi ), v1 = aoAt( p + ivec2( 0, -1 ), hi ), v2 = aoAt( p + ivec2( 1, -1 ), hi );
	float v3 = aoAt( p + ivec2( -1, 0 ), hi ), v4 = aoAt( p, hi ), v5 = aoAt( p + ivec2( 1, 0 ), hi );
	float v6 = aoAt( p + ivec2( -1, 1 ), hi ), v7 = aoAt( p + ivec2( 0, 1 ), hi ), v8 = aoAt( p + ivec2( 1, 1 ), hi );
	float t;
	mnmx6( v0, v1, v2, v3, v4, v5 );
	mnmx5( v1, v2, v3, v4, v6 );
	mnmx4( v2, v3, v4, v7 );
	mnmx3( v3, v4, v8 );
	gl_FragColor = vec4( v4, 0.0, 0.0, 1.0 );
}`,
    depthTest: false, depthWrite: false,
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, tMed: { value: null }, intensity: { value: 1 } },
    vertexShader,
    fragmentShader: `uniform sampler2D tDiffuse;
uniform sampler2D tMed;
uniform float intensity;
varying vec2 vUv;
void main() {
	vec4 c = texture2D( tDiffuse, vUv );
	gl_FragColor = vec4( c.rgb * mix( 1.0, texture2D( tMed, vUv ).r, intensity ), c.a );
}`,
    depthTest: false, depthWrite: false,
  });
  const medRT = new THREE.WebGLRenderTarget(1, 1, { format: THREE.RedFormat, depthBuffer: false });
  class AoMedianPass extends Pass {
    constructor() { super(); this.material = mat; this.medMaterial = med; this.quad = new FullScreenQuad(med); }
    render(renderer, writeBuffer, readBuffer) {
      const src = ao.pdRenderTarget;
      if (medRT.width !== src.width || medRT.height !== src.height) medRT.setSize(src.width, src.height);
      med.uniforms.tAO.value = src.texture;
      this.quad.material = med;
      renderer.setRenderTarget(medRT);
      this.quad.render(renderer);
      mat.uniforms.tDiffuse.value = readBuffer.texture;
      mat.uniforms.tMed.value = medRT.texture;
      mat.uniforms.intensity.value = ao.blendIntensity;
      this.quad.material = mat;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
    }
    dispose() { mat.dispose(); med.dispose(); medRT.dispose(); this.quad.dispose(); }
  }
  return new AoMedianPass();
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
    diffuseColor.rgb = col * diffuse;
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
// Erst bei Bedarf gemalt: die Kisten gehören zur gebauten Halle, und das
// Rauschen auf der Leinwand kostete beim Laden auch dann, wenn die echte
// Halle sie nie zeigte.
let crateMats = null;
const crateMaterials = () => (crateMats ??= ['#3f5a3a', '#5a4630', '#2f4660', '#6a6f75'].map((c) =>
  new THREE.MeshStandardMaterial({ map: crateTexture(c), roughness: 0.75, metalness: 0.2 })));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function crateStack() {
  const g = new THREE.Group();
  const box = new THREE.BoxGeometry(1.25, 1.25, 1.25);
  const layout = [[0, 0, 0], [1.3, 0, 0.1], [0.65, 1.25, 0.05], [-0.2, 0, 1.35], [1.1, 0, 1.4], [0.4, 1.25, 1.35]];
  const mats = crateMaterials();
  layout.forEach(([x, y, z], i) => {
    const m = mesh(box, mats[i % mats.length], x, y + 0.625, z);
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
  tr.add(mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), crateMaterials()[2], 0, 1.15, 0));
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

// Gerät, um das die Crew herumgeht (20.10.2026, Krisz' Bild: ein Arbeiter
// lief mitten durch die Werkbank): Rechtecke { x, z, ex, ez } in Weltmetern,
// Abstand schon eingerechnet. clearOf rückt einen Punkt an den nächsten Rand,
// detour führt einen geschlossenen Weg um die Rechtecke: Schneidet ein
// Abschnitt eines, geht er über dessen Ecken auf der Seite, die weniger unter
// den Rumpf führt (hull(x, z): Rumpf dort tiefer als CREW_HEAD), bei
// Gleichstand außen (weiter von der Schiffsmitte); die neuen Abschnitte
// werden wieder geprüft.
const CREW_GAP = 0.35;   // m vom Gerät bis zur Mitte des Arbeiters
const CREW_HEAD = 1.9;   // m: tiefer hängender Rumpf ist im Weg
function clearOf(p, blocks) {
  for (let n = 0; n < 4; n++) {
    let moved = false;
    for (const r of blocks) {
      const dx = p.x - r.x, dz = p.z - r.z;
      if (Math.abs(dx) >= r.ex || Math.abs(dz) >= r.ez) continue;
      if (r.ex - Math.abs(dx) < r.ez - Math.abs(dz)) p.x = r.x + Math.sign(dx || 1) * r.ex;
      else p.z = r.z + Math.sign(dz || 1) * r.ez;
      moved = true;
    }
    if (!moved) break;
  }
  return p;
}
// Anteil (0..1), an dem der Abschnitt a→b ins Innere von r tritt, sonst Infinity
function segHit(a, b, r) {
  const e = 1e-3, dx = b.x - a.x, dz = b.z - a.z;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, a.x - (r.x - r.ex + e)], [dx, r.x + r.ex - e - a.x], [-dz, a.z - (r.z - r.ez + e)], [dz, r.z + r.ez - e - a.z]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return Infinity; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return Infinity; t0 = Math.max(t0, t); } else { if (t < t0) return Infinity; t1 = Math.min(t1, t); }
  }
  return t0 < t1 ? t0 : Infinity;
}
function detour(points, blocks, hull = null) {
  if (!blocks.length) return points;
  // Weg unter dem Rumpf in m, alle 0,25 m abgetastet
  const under = (line) => {
    if (!hull) return 0;
    let m = 0;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], n = Math.ceil(a.distanceTo(b) / 0.25);
      for (let k = 0; k < n; k++) if (hull(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n)) m += 0.25;
    }
    return m;
  };
  const pts = points.map((p) => clearOf(p.clone(), blocks)), out = [];
  const around = (a, b, depth) => {
    let hit = null, tMin = Infinity;
    for (const r of blocks) { const t = segHit(a, b, r); if (t < tMin) { tMin = t; hit = r; } }
    if (!hit || depth > 8) return;
    const dx = b.x - a.x, dz = b.z - a.z;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => new THREE.Vector3(hit.x + sx * (hit.ex + 0.02), 0, hit.z + sz * (hit.ez + 0.02)));
    const side = (p) => dx * (p.z - a.z) - dz * (p.x - a.x);
    const sides = [corners.filter((p) => side(p) > 0), corners.filter((p) => side(p) <= 0)].filter((s) => s.length);
    const along = (p, q) => (p.x - a.x) * dx + (p.z - a.z) * dz - ((q.x - a.x) * dx + (q.z - a.z) * dz);
    const ways = sides.map((c) => c.map((p) => clearOf(p, blocks.filter((r) => r !== hit))).sort(along));
    const outer = (c) => c.reduce((sum, p) => sum + Math.hypot(p.x, p.z), 0) / c.length;
    const cost = ways.map((c) => under([a, ...c, b]));
    const via = ways.length < 2 ? ways[0] : Math.abs(cost[0] - cost[1]) > 0.1 ? ways[cost[0] < cost[1] ? 0 : 1] : ways[outer(ways[0]) >= outer(ways[1]) ? 0 : 1];
    let prev = a;
    for (const c of via) { around(prev, c, depth + 1); out.push(c); prev = c; }
    around(prev, b, depth + 1);
  };
  for (let i = 0; i < pts.length; i++) { out.push(pts[i]); around(pts[i], pts[(i + 1) % pts.length], 0); }
  return out;
}

// Zerlegt die echte Crew-Figur in Glieder für das Arbeitergerüst.
// Die Figur steht in Metern, Y oben, blickt in -Z, Arme nach vorn unten
// zusammengeführt (so kommt sie aus dem Build). Ergebnis: Gelenkname ->
// [[Geometrie im Gelenkraum, Material]]. Mit pause in Häppchen (slicer).
async function rigCrew(model, pause = noPause) {
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
  // Schulter und Hände je Seite einmal (je Dreieck neu angelegt: 0,1 Mio. Vektoren)
  const SH = { [-1]: sh(-1), 1: sh(1) }, HD = { [-1]: hd(-1), 1: hd(1) };
  const meshes = [];
  model.traverse((n) => { if (n.isMesh) meshes.push(n); });
  for (const n of meshes) {
    await pause();
    const g = (n.geometry.index ? n.geometry.toNonIndexed() : n.geometry.clone());
    g.applyMatrix4(n.matrixWorld);
    g.rotateY(Math.PI);                       // Blick nach +Z wie das Gerüst
    const P = g.attributes.position;
    const isArm = /arm/i.test(n.material.name || '');
    for (let t = 0; t < P.count; t += 3) {
      if (!(t % 12288)) await pause();
      c.set(0, 0, 0);
      for (let k = 0; k < 3; k++) c.x += P.getX(t + k) / 3, c.y += P.getY(t + k) / 3, c.z += P.getZ(t + k) / 3;
      const side = c.x < 0 ? 'L' : 'R', sx = c.x < 0 ? -1 : 1;
      let key;
      const nearArm = distSeg(c, SH[sx], HD[sx]) < 0.085 && (c.z > 0.12 || Math.abs(c.x) > 0.2);
      if (isArm || (nearArm && c.y > 0.75)) {
        // Ober- oder Unterarm: Abstand von der Schulter nach dem Geradebiegen
        a.subVectors(c, SH[sx]).applyQuaternion(rot[side]);
        key = (-a.y > 0.3 ? 'el' : 'sh') + side;
      } else if (c.y > 1.56 && Math.abs(c.x) < 0.14) key = 'neck';
      else if (c.y < 0.92) key = (c.y < 0.48 ? 'kn' : 'hip') + side;
      else key = 'body';
      tri[key].push(g, t, n.material);
    }
  }
  const out = {};
  for (const [key, list] of Object.entries(tri)) {
    await pause();
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
function buildLife(scene, reduceMotion, withStage = true) {
  const root = new THREE.Group(); scene.add(root);
  const crew = [];
  for (let i = 0; i < 8; i++) { const w = worker(i); root.add(w.root); crew.push(w); }
  // Gerät, Schlepper, Drohne, Schweißfunken und Kran gehören zur gebauten
  // Halle. In der echten Halle wären sie Selbstgebautes und blieben verborgen;
  // sie entstehen erst, wenn die gebaute Halle wirklich gebraucht wird.
  let props = null, tugV = null, dr = null, welder = null, welder2 = null;
  let crane = null, beam = null, trolley = null, rope = null, hook = null;
  let L = null; // aktuelle Anordnung
  // Gerät des Wartungsplatzes (setBlocks, vor layout): je Platz ein Rechteck,
  // dazu der Rumpf (hull), damit der Umweg nicht unter ihn führt
  let blocks = [], hull = null;
  const v = new THREE.Vector3();
  function addStage() {
    if (props) return;
    props = {
      crates: crateStack(), crates2: crateStack(), tanks: fuelTanks(), bench: workbench(), bench2: workbench(),
      cart: toolCart(), stair: boardingStair(), barrels: barrels(), spool: cableSpool(), barrels2: barrels(),
    };
    for (const p of Object.values(props)) root.add(p);
    tugV = tug(); root.add(tugV);
    welder = sparks(); root.add(welder.pts); root.add(welder.flash);
    welder2 = sparks(40); root.add(welder2.pts); root.add(welder2.flash);
    dr = drone(); root.add(dr.g);
    // Portalkran an der Decke: Träger fährt quer, Haken hängt am Seil
    crane = new THREE.Group();
    beam = mesh(new THREE.BoxGeometry(1, 1.2, 1), M.yellow); crane.add(beam);
    trolley = mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), M.dark); crane.add(trolley);
    rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), M.rubber); crane.add(rope);
    hook = mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16, Math.PI * 1.4), M.steel); crane.add(hook);
    root.add(crane);
    if (L) layout(L.S, L.ship);
  }
  if (withStage) addStage();

  function layout(S, ship) {
    const R = PAD_R * S;           // Plattformrand in Metern
    const D = DOOR_ANGLE;          // Torrichtung
    const ring = R + 3;            // Laufweg um die Plattform
    const place = (o, r, a, face = a + Math.PI) => { o.position.copy(polar(r, a)); o.rotation.y = face; };
    const halfW = ship ? Math.min(ship.halfW + 1.5, R - 1.5) : R * 0.5;
    if (props) {
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
      props.stair.position.set(-halfW, 0.3, ship ? ship.len * 0.1 : 0);
      props.stair.rotation.y = -Math.PI / 2;
      // Die Bordtreppe stand neben jedem Schiff, ohne zu dessen Einstieg zu
      // passen — eher störend als belebend.
      props.stair.visible = false;
      props.bench.updateMatrixWorld(); props.bench2.updateMatrixWorld();
    }
    const benchPos = (b, side) => b.localToWorld(new THREE.Vector3(side, 0, 0.9));
    L = {
      S, R, ring, ship,
      // Rundweg um die Plattform, mit Abstecher zum Tor, um das Gerät herum
      loop: pathOf(detour([0, 1, 2, 3, 4, 5, 6, 7].map((i) => polar(ring, D + (i / 8) * Math.PI * 2 + 0.2)), blocks, hull)),
      doorRun: pathOf(detour([polar(ring, D + 0.25), polar(HALL_R * S * 0.85, D + 0.12), polar(HALL_R * S * 0.85, D - 0.12), polar(ring, D - 0.25), polar(R + 5.5, D - 0.9)], blocks, hull)),
      cartRun: pathOf(detour([polar(R + 2, D - 0.2), polar(R + 2, D + 1.2), polar(R + 4, D + 1.8), polar(R + 4, D - 0.6)], blocks, hull)),
      tugRun: pathOf([0, 1, 2, 3, 4, 5].map((i) => polar(R + 10 + S * 2, D + 0.5 + (i / 6) * Math.PI * 2))),
      weldAt: props ? benchPos(props.bench, 0.3) : null,
      weldAt2: props ? benchPos(props.bench2, -0.3) : null,
      shipTop: ship ? ship.height + 0.3 : 3,
      shipLen: ship ? ship.len : 10,
      shipHalfW: halfW,
    };
    // Kran über die ganze Halle
    if (crane) {
      beam.scale.set(HALL_R * S * 1.8, 1, 1);
      crane.position.y = HALL_H * S - 3;
    }
  }

  // Echte Hangar-Crew (Modell aus scripts/build-hangar-assets.mjs): die Figur
  // kommt als starre Teile ohne Skelett. Sie wird hier einmal in Glieder
  // zerlegt (Rumpf, Kopf, Ober-/Unterarm, Ober-/Unterschenkel) und auf das
  // Gelenkgerüst der gebauten Arbeiter gehängt — so laufen, schweißen und
  // hämmern echte Figuren mit denselben Bewegungen.
  let rigged = false;
  // Leistungsstufe: Schatten der Crew (nur hoch) und wie viele gehen
  let castOn = true, count = crew.length;
  function setShadows(on) {
    castOn = on;
    root.traverse((n) => { if (n.userData.crewPart) n.castShadow = on; });
  }
  function setCount(n) {
    count = Math.min(n, crew.length);
    crew.forEach((w, i) => { w.root.visible = i < count; });
  }
  // Die echte Figur als EIN Mesh je Arbeiter: Die Gelenke des Gerüsts sind
  // seine Knochen, jedes Dreieck hängt mit Gewicht 1 an seinem Glied, und
  // Farbe, Rauheit, Metall und Leuchten der sieben Spielmaterialien stehen
  // je Ecke (crewGeometry, crewShader). Bis 2026-10-15 war jedes Glied je
  // Material ein eigenes Mesh: 256 Zeichenaufrufe je Durchgang (Bild,
  // Umgebungsverdeckung, zwei Schattenkarten), gut die Hälfte des Bildes.
  // Jetzt 8, bei gleichem Bild. setCrew baut verborgen, showCrew tauscht,
  // wenn die Programme übersetzt sind (prepare).
  let crewMeshes = [];
  // in drei Zügen (Gliedern, Zusammenlegen, Arbeiter), dazwischen der Browser
  async function setCrew(model) {
    const segs = await rigCrew(model, slicer(12, nextTask));
    await nextTask();
    const geo = crewGeometry(segs);
    await nextTask();
    const base = Object.values(segs).flat()[0]?.[1];
    if (!geo || !base) return;
    crewMeshes = crew.map((w, i) => {
      // eigenes Material je Arbeiter (gleiches Programm): Wer mit dem
      // Aufzug in den Schacht fährt, dunkelt allein ab
      const mat = crewMaterial(base);
      const bones = CREW_JOINTS.map((k) => w[k]);
      const m = new THREE.SkinnedMesh(geo, mat);
      m.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())), new THREE.Matrix4());
      // feste Hülle um die stehende Figur samt ausgestreckter Arme
      m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.4);
      m.castShadow = castOn; m.receiveShadow = true;
      m.userData.crewPart = true;
      m.visible = false;
      w.root.add(m);
      w.root.userData.mats = [mat];
      // leicht unterschiedliche Statur, damit es keine Klonarmee wird
      w.root.scale.setScalar(0.95 + ((i * 37) % 9) / 100);
      return m;
    });
  }
  function showCrew() {
    if (!crewMeshes.length) return;
    crew.forEach((w, i) => {
      // die eigenen Grundkörper weichen, Werkzeug in der Hand bleibt
      w.root.traverse((n) => {
        if (!n.isMesh || n === crewMeshes[i]) return;
        let p = n.parent, inHand = false;
        while (p) { if (p === w.hand) { inHand = true; break; } p = p.parent; }
        if (!inHand) n.visible = false;
      });
      crewMeshes[i].visible = true;
    });
    rigged = true;
  }

  // Rollen der acht Arbeiter. Ohne das Gerät der gebauten Halle schweißt und
  // hämmert niemand ins Leere: wer dort an Werkbank oder Kisten arbeitete,
  // steht mit dem Tablet am Schiff oder geht mit um.
  const roles = ['loop', 'loop', 'door', 'weld', 'push', 'tablet', 'weld2', 'hammer'];
  const bareRoles = ['loop', 'loop', 'door', 'tablet', 'push', 'tablet', 'tablet', 'loop'];
  const tabletAt = [0, 0, 0, -0.95, 0, 0.35, 1.55, 0];
  const offs = [0, 0.5, 0, 0, 0, 0, 0, 0.25];
  const tmp = new THREE.Vector3();

  // hold: Der Aufzug fährt. Wer geht, bleibt stehen, bis er wieder oben
  // ist: auf dem Feld fährt man still mit, daneben läuft niemand in den
  // offenen Schacht. Die Wege laufen deshalb auf einer eigenen Uhr.
  let walkT = 0;
  function update(dt, t, hold = false) {
    if (!L) return;
    if (!hold) walkT += dt;
    crew.forEach((w, i) => {
      if (i >= count) return;
      const role = (props ? roles : bareRoles)[i];
      const speed = 1.35;
      if (role === 'loop' || role === 'door' || role === 'push') {
        const p = role === 'loop' ? L.loop : role === 'door' ? L.doorRun : L.cartRun;
        const sp = role === 'push' ? 0.9 : speed;
        const d = reduceMotion ? p.total * (offs[i] + i * 0.13) : walkT * sp + p.total * (offs[i] + i * 0.13);
        const yaw = p.at(d, tmp);
        w.root.position.copy(tmp); w.root.rotation.y = yaw;
        if (reduceMotion || hold) poseStand(w); else poseWalk(w, d * 3.2, role === 'push' ? 0.7 : 1);
        if (role === 'push' && props?.cart.visible) {
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
        w.root.position.copy(clearOf(polar(L.R + 1.5, DOOR_ANGLE + Math.PI + (props ? 0.35 : tabletAt[i])), blocks));
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
    if (!props) return;
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

  // Rechtecke in Weltmetern ({ x, z, ex, ez }); mit Abstand für Schultern.
  // Überlappende fasst es zu einem zusammen, sonst läge die Ecke des einen
  // im anderen. Gilt ab dem nächsten layout.
  function setBlocks(list, under = null) {
    hull = under;
    const rs = list.map((r) => [r.x - r.ex - CREW_GAP, r.x + r.ex + CREW_GAP, r.z - r.ez - CREW_GAP, r.z + r.ez + CREW_GAP]);
    const meet = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
    for (let merged = true; merged;) {
      merged = false;
      for (let i = 0; i < rs.length && !merged; i++) for (let j = i + 1; j < rs.length && !merged; j++) {
        if (!meet(rs[i], rs[j])) continue;
        const a = rs[i], b = rs[j];
        rs[i] = [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3])];
        rs.splice(j, 1);
        merged = true;
      }
    }
    blocks = rs.map(([x0, x1, z0, z1]) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, ex: (x1 - x0) / 2, ez: (z1 - z0) / 2 }));
  }

  return { layout, update, root, setCrew, showCrew, crewMeshes: () => crewMeshes, addStage, setShadows, setCount, isRigged: () => rigged, setBlocks };
}

// Gelenke des Arbeitergerüsts in der Folge der Knochen (worker(), rigCrew())
const CREW_JOINTS = ['body', 'neck', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'hipR', 'knR'];
// Alle Glieder in eine Geometrie (geteilt von allen Arbeitern): Lage und
// Normale im Raum ihres Gelenks, Knochen = Gelenk, dazu je Ecke die Werte
// ihres Materials aus dem Spiel (Farbe linear, Rauheit, Metall, Leuchten).
function crewGeometry(segs) {
  let n = 0;
  for (const parts of Object.values(segs)) for (const [g] of parts) n += g.attributes.position.count;
  if (!n) return null;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const pbr = new Float32Array(n * 2), emi = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  let o = 0;
  for (const [key, parts] of Object.entries(segs)) {
    const j = CREW_JOINTS.indexOf(key);
    if (j < 0) continue;
    for (const [g, m] of parts) {
      const P = g.attributes.position, N = g.attributes.normal;
      const e = (m.emissive ?? new THREE.Color(0)).clone().multiplyScalar(m.emissiveIntensity ?? 1);
      for (let v = 0; v < P.count; v++, o++) {
        pos[o * 3] = P.getX(v); pos[o * 3 + 1] = P.getY(v); pos[o * 3 + 2] = P.getZ(v);
        nor[o * 3] = N.getX(v); nor[o * 3 + 1] = N.getY(v); nor[o * 3 + 2] = N.getZ(v);
        col[o * 3] = m.color.r; col[o * 3 + 1] = m.color.g; col[o * 3 + 2] = m.color.b;
        pbr[o * 2] = m.roughness ?? 1; pbr[o * 2 + 1] = m.metalness ?? 0;
        emi[o * 3] = e.r; emi[o * 3 + 1] = e.g; emi[o * 3 + 2] = e.b;
        si[o * 4] = j; sw[o * 4] = 1;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, o * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, o * 3), 3));
  geo.setAttribute('crewPbr', new THREE.BufferAttribute(pbr.subarray(0, o * 2), 2));
  geo.setAttribute('crewE', new THREE.BufferAttribute(emi.subarray(0, o * 3), 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si.subarray(0, o * 4), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw.subarray(0, o * 4), 4));
  return geo;
}
const crewShader = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 crewPbr;\nattribute vec3 crewE;\nvarying vec2 vCrewPbr;\nvarying vec3 vCrewE;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvCrewPbr = crewPbr; vCrewE = crewE;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vCrewPbr;\nvarying vec3 vCrewE;')
    .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vCrewE;')
    .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('= roughness;', '= vCrewPbr.x;'))
    .replace('#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment.replace('= metalness;', '= vCrewPbr.y;'));
};
// Ein Material für die ganze Figur: Farbe aus den Ecken (mal Weiß, beim
// Abdunkeln im Schacht mal f), Rauheit, Metall und Leuchten aus den Ecken
function crewMaterial(base) {
  const m = base.clone();
  m.name = 'crew';
  m.vertexColors = true;
  m.color.set(0xffffff);
  m.roughness = 1; m.metalness = 1;
  m.onBeforeCompile = crewShader;
  return m;
}

// Bringt den Wert vom Rang r (aufsteigend) in a[lo..hi] an die Stelle r,
// kleinere davor, größere dahinter (Hoare-Teilung, Pivot Median aus drei)
function selectRank(a, r, lo, hi) {
  while (lo < hi) {
    const m = (lo + hi) >> 1, x0 = a[lo], x1 = a[m], x2 = a[hi];
    const x = x0 < x1 ? (x1 < x2 ? x1 : x0 < x2 ? x2 : x0) : (x0 < x2 ? x0 : x1 < x2 ? x2 : x1);
    let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < x) i++;
      while (x < a[j]) j--;
      if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
    }
    if (r <= j) hi = j;
    else if (r >= i) lo = i;
    else return;
  }
}

// Hüllquader ohne Ausreißer: manche Modelle tragen einzelne Splitter weit
// abseits des Rumpfs (Exportreste). Ein strenger Quader liesse das Schiff
// darum über der Plattform schweben; gezählt wird deshalb vom 0,5. bis zum
// 99,5. Perzentil je Achse. Mit pause in Häppchen (slicer).
async function robustBox(root, pause = noPause) {
  // Stichprobe je Teil wie gehabt; sortiert wird in typisierten Feldern ohne
  // Vergleichsfunktion (beim Gladius gut 0,4 s weniger beim Einfahren).
  const parts = [], v = new THREE.Vector3();
  let cap = 0;
  root.traverse((n) => {
    const pos = n.isMesh && n.geometry.attributes.position;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 40000));
    parts.push([n, pos, step]);
    cap += Math.ceil(pos.count / step);
  });
  if (!cap) return new THREE.Box3().setFromObject(root);
  const xs = new Float64Array(cap), ys = new Float64Array(cap), zs = new Float64Array(cap);
  let k = 0;
  for (const [n, pos, step] of parts) {
    await pause();
    for (let i = 0; i < pos.count; i += step) {
      if (!(k & 16383)) await pause();
      v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
      xs[k] = v.x; ys[k] = v.y; zs[k] = v.z; k++;
    }
  }
  // Nur die beiden Ränge, nicht ganz sortiert (selectRank): dieselben Werte,
  // beim Schiff 1,7 Mio. Ecken je Achse in einem Bruchteil der Zeit
  const q = (a) => {
    const lo = Math.floor(k * 0.005), hi = Math.ceil(k * 0.995) - 1;
    selectRank(a, lo, 0, k - 1);
    selectRank(a, hi, lo, k - 1);
    return [a[lo], a[hi]];
  };
  await pause();
  const [x0, x1] = q(xs);
  await pause();
  const [y0, y1] = q(ys);
  await pause();
  const [z0, z1] = q(zs);
  return new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
}

function disposeObject(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) [].concat(n.material).forEach((m) => m.dispose());
  });
}

// ─── Dampf ────────────────────────────────────────────────────────────────
// 20.10.2026, Krisz: „effekte wie zb dampf, rauch, geräusche wenn dampf
// kommt … yk belivebality“. Dampf steigt, wo Mechanik unter Druck arbeitet:
// aus der Mittelfuge, wenn das Schachttor einrastet, als warmer Schwaden
// aus dem Schacht, wenn es aufgeht, und in Stößen an den Kanten des Felds,
// wenn die Plattform oben einrastet oder unten losfährt (fx in
// initHangar). Jedes Teilchen ist ein zur Kamera gedrehtes Viereck; seine
// Bahn rechnet der Shader aus Startpunkt, Geschwindigkeit und Alter, der
// Prozessor schreibt nur beim Ausstoß ein paar Zahlen in einen Ringpuffer.
// Ist nichts in der Luft, zeichnet er nichts.
// Bahn: Der Stoß bremst in der Luft (STEAM_DRAG, 1/s), danach treibt der
// Dampf mit seiner Steiggeschwindigkeit nach oben (aV.w: Lebensdauer).
const STEAM_DRAG = 2.2;
// Farbe (linear, vor der Belichtung): oben im Licht der Halle, unten im
// eigenen Schatten, kühl wie das Streulicht der weißen Wände
const STEAM_LIT = [1.5, 1.47, 1.43];
const STEAM_SHADE = [0.62, 0.66, 0.72];
const STEAM_VS = /* glsl */ `
attribute vec4 aP;   // Start (Welt, m), Geburt (s)
attribute vec4 aV;   // Stoß (m/s), Lebensdauer (s)
attribute vec4 aS;   // Größe am Anfang und am Ende (m), Zufall, Deckkraft
attribute vec2 aR;   // Steiggeschwindigkeit (m/s), Wirbel (m)
uniform float uTime;
varying vec2 vUv, vUp;
varying float vA, vSeed, vAge, vY;
void main() {
  float age = uTime - aP.w, k = age / aV.w;
  vUv = position.xy + 0.5;
  vSeed = aS.z; vAge = k; vA = 0.0; vY = 0.0;
  if (k < 0.0 || k >= 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float d = (1.0 - exp(-${STEAM_DRAG.toFixed(1)} * age)) / ${STEAM_DRAG.toFixed(1)};
  vec3 p = aP.xyz + aV.xyz * d;
  p.y += aR.x * max(0.0, age - d);
  float w = aR.y * k;
  p.x += sin(age * 1.7 + aS.z * 40.0) * w;
  p.z += cos(age * 1.3 + aS.z * 23.0) * w;
  float s = mix(aS.x, aS.y, 1.0 - (1.0 - k) * (1.0 - k));
  float a = aS.z * 6.2832 + age * (aS.z - 0.5) * 0.8;
  vec2 c = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy * s;
  // Oben der Welt in den Achsen des gedrehten Vierecks (Licht von oben)
  vec2 u = normalize(vec2(viewMatrix[1][0], viewMatrix[1][1]) + vec2(0.0, 1e-4));
  vUp = vec2(dot(u, vec2(cos(a), sin(a))), dot(u, vec2(-sin(a), cos(a))));
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += c;
  gl_Position = projectionMatrix * mv;
  // Höhe des Bildpunkts über dem Boden (Ecken über die Achsen der Kamera)
  vY = p.y + c.x * viewMatrix[1][0] + c.y * viewMatrix[1][1];
  // rasch da, lang verweht; dünner, je größer er wird: Der Dampf mischt
  // sich mit Luft, die Menge im Ballen bleibt, die Dichte fällt mit der
  // Fläche (sonst wachsen dichte Wattebäusche heran)
  vA = aS.w * smoothstep(0.0, 0.04, k) * (1.0 - smoothstep(0.35, 1.0, k)) * aS.x / s;
}`;
const STEAM_FS = /* glsl */ `
uniform vec3 uLit, uShade;
uniform float uFloor;
varying vec2 vUv, vUp;
varying float vA, vSeed, vAge, vY;
float sHash(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float sNoise(vec2 x) {
  vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r0 = dot(q, q);
  if (r0 >= 1.0 || vA <= 0.0) discard;
  // Schleier statt Ballen: weich nach außen (Gauß), innen Schlieren aus
  // verzerrtem Rauschen, die mit dem Alter aufreißen. Ein ausgefranster
  // Umriss mit dunkler Unterseite las sich als Wattewolke (Render 20.10.)
  vec2 o = vec2(vSeed * 37.0, vSeed * 11.0 - vAge * 0.9);
  vec2 wq = vUv * 2.3 + o + 0.8 * vec2(sNoise(vUv * 1.7 + o.yx), sNoise(vUv * 1.7 - o));
  float n = 0.5 * sNoise(wq) + 0.3 * sNoise(wq * 2.1 - o) + 0.2 * sNoise(wq * 4.3 + o.yx);
  float dens = exp(-3.2 * r0) * (1.0 - smoothstep(0.75, 1.0, r0));
  dens *= clamp(0.25 + 1.5 * n * n - vAge * 0.45 * (1.0 - n), 0.0, 1.0);
  // Licht von oben (Hallendecke), schwach: Dampf streut das Licht nach allen Seiten
  vec3 col = mix(uShade, uLit, clamp(0.7 + 0.25 * dot(q, vUp) + (n - 0.5) * 0.4, 0.0, 1.0));
  float a = dens * vA * smoothstep(uFloor - 0.05, uFloor + 0.5, vY);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;
}`;
function buildSteam(max) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const A = {};
  for (const [k, w] of [['aP', 4], ['aV', 4], ['aS', 4], ['aR', 2]]) {
    A[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * w), w);
    A[k].setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(k, A[k]);
  }
  // alle schon verweht
  for (let i = 0; i < max; i++) { A.aP.array[i * 4 + 3] = -1e5; A.aV.array[i * 4 + 3] = 1; }
  g.instanceCount = max;
  const u = {
    uTime: { value: 0 }, uFloor: { value: 0 },
    uLit: { value: new THREE.Color(...STEAM_LIT) }, uShade: { value: new THREE.Color(...STEAM_SHADE) },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'steam', uniforms: u, vertexShader: STEAM_VS, fragmentShader: STEAM_FS,
    transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'steam';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.visible = false;
  let n = 0, until = -1, dirty = false;
  return {
    mesh,
    get until() { return until; },
    // t: Geburt (s, Uhr der Bühne); p Start, v Stoß (m/s); life s; s0, s1 m;
    // a Deckkraft; rise m/s; swirl m
    puff(t, p, v, life, s0, s1, a, rise = 0.6, swirl = 0.5) {
      const i = n++ % max;
      A.aP.array.set([p[0], p[1], p[2], t], i * 4);
      A.aV.array.set([v[0], v[1], v[2], life], i * 4);
      A.aS.array.set([s0, s1, Math.random(), a], i * 4);
      A.aR.array.set([rise, swirl], i * 2);
      until = Math.max(until, t + life);
      dirty = true;
    },
    frame(t) {
      u.uTime.value = t;
      mesh.visible = t < until;
      if (!dirty) return;
      for (const k in A) A[k].needsUpdate = true;
      dirty = false;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

// ─── Geräusche ────────────────────────────────────────────────────────────
// Die Originalklänge des Hangars (Krisz 20.10.2026 abends, nach drei
// abgelehnten Fassungen aus einem Synthesizer im Browser: „okay nehme die
// audios und mache die animation passend dazu“), seit 21.10.2026 auf den
// flotten Takt geschnitten (Krisz: „gesamt animation ist viel zu langsam“,
// „dampf sound ist super crappy“), ohne Warnton („mach diesen alarm sound
// aus“). Die Dateien liegen in public/hangar/ton
// (scripts/build-hangar-sound.mjs: Stücke der Aufnahmen aneinander, Pegel),
// die Seite gibt Ordner und Version mit (hall.lift.sound). Jeder Klang
// sitzt, wo das Spiel ihn auslöst, nur kürzer:
// - Plattform: Anfahren und Fahrschleife (SND_FADE eingeblendet) beim
//   Losfahren; SND_HIT vor dem Stillstand der Halt, die Schleife blendet
//   dabei aus. Sein Schlag ist der Stillstand.
// - Tor: auf und zu je der Anlauf vom Anfang der Aufnahme, dann ihr Ende;
//   der Anschlag (SND_HIT) fällt auf das Ende der Bahn. Kehrt das Tor
//   unterwegs um, setzt die andere Aufnahme so ein, dass ihr Anschlag
//   wieder auf das Ende fällt.
// Dampf bleibt still: Der mittlere Hangar hat keinen eigenen Klang dafür,
// und die aus anderen Hangars und von Türen passten nicht (Krisz, s. o.).
// Den Warnton des Spiels hat Krisz nach dem Hören verworfen (s. o.).
// Aus der Tiefe und unter dem geschlossenen Tor klingt die Plattform leiser
// und dumpfer (space). Geladen wird erst, wenn der Ton an ist und die Seite
// berührt wurde (Regel der Browser); kein Nachhall dazu, die Aufnahmen
// tragen ihren Raum.
const SND_VOL = 0.5;        // Gesamtlautstärke
const SND_FILES = ['platte-start', 'platte-lauf', 'platte-halt', 'tor-auf', 'tor-zu'];
// Fahrschleife: zwischen start und start + len periodisch (build-hangar-sound.mjs gibt beides aus)
const SND_LOOP = { start: 0.5, len: 4.202222 };
// Schlag der geschnittenen Klänge, s nach ihrem Anfang: Halt beim
// Stillstand, Tor beim Ende der Bahn (build-hangar-sound.mjs schneidet sie
// so und prüft die Werte hier, verify:hangar [16] hält das Tor am Takt)
const SND_HIT = { 'platte-halt': 0.7, 'tor-auf': 1.3, 'tor-zu': 1.3 };
const SND_FADE = 0.4;       // s Ein- und Ausblenden der Fahrschleife (im Spiel 1 s bei 12,5 s Fahrt)
function hangarSound(src = null) {
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  let ctx = null, out = null, pad = null, on = true, buf = null, loading = null, ride = null, gate = null;
  // alles, was gerade klingt oder angesetzt ist: hush() blendet es aus, sonst
  // spielte nach dem Verbergen ein halber Torklang weiter, sobald die Seite
  // wiederkommt (der Zeitgeber steht derweil still)
  const shots = new Set();
  const keep = (s, g) => {
    const h = { s, g };
    shots.add(h);
    s.onended = () => { g.disconnect(); shots.delete(h); };
    return h;
  };
  function make() {
    if (ctx) return ctx;
    if (!AC || !src?.dir) return null;
    try { ctx = new AC(); } catch { return null; }
    // Begrenzer am Ende: Tor und Fahrt zugleich dürfen nicht übersteuern
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -8; lim.knee.value = 4; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
    out = ctx.createGain();
    out.gain.value = on ? SND_VOL : 0;
    out.connect(lim).connect(ctx.destination);
    // Plattform: eigener Weg mit Tiefpass, für Tiefe und Tor (space)
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = 0.5;
    lp.connect(g).connect(out);
    pad = { lp, g };
    return ctx;
  }
  function load() {
    if (loading || !make()) return;
    const v = src.v ? `?v=${src.v}` : '';
    loading = Promise.all(SND_FILES.map((n) => fetch(`${src.dir}${n}.mp3${v}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((a) => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no)))
      .then((b) => [n, b], () => [n, null])))
      .then((all) => {
        buf = Object.fromEntries(all);
        const miss = all.filter(([, b]) => !b).map(([n]) => n);
        if (miss.length) console.warn(`[hangar] Ton: ${miss.join(', ')} nicht geladen`);
      });
  }
  const live = () => !!ctx && on && ctx.state === 'running' && !!buf;
  // Puffer abspielen: Ziel, Lautstärke, ab Sekunde, in Sekunden ab jetzt
  function play(name, dest, gain = 1, offset = 0, at = 0) {
    const b = buf?.[name];
    if (!b || offset >= b.duration) return null;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = b;
    g.gain.value = gain;
    s.connect(g).connect(dest);
    s.start(ctx.currentTime + 0.005 + at, offset);
    return keep(s, g);
  }
  function fadeOut(h, sec) {
    if (!h) return;
    const t = ctx.currentTime;
    h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0, t + sec);
    try { h.s.stop(t + sec + 0.05); } catch { /* schon aus */ }
  }
  return {
    // nach einer Berührung der Seite (pointerdown, keydown)
    unlock() {
      if (!on || !make()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      load();
    },
    set(v) {
      on = !!v;
      if (on) this.unlock();
      if (!ctx) return;
      out.gain.setTargetAtTime(on ? SND_VOL : 0, ctx.currentTime, 0.05);
      // aus: nichts läuft stumm weiter; wieder an, setzt fx.frame Fahrt und Tor an der Stelle an
      if (!on) this.hush();
    },
    get on() { return on; },
    get live() { return live(); },
    get riding() { return !!ride; },
    get gating() { return !!gate; },
    // Seite verborgen: anhalten. Was lief, verstummt; die Bewegung läuft
    // derweil nach der Uhr weiter, also setzt fx.frame Fahrt und Tor beim
    // Wiederkommen an der richtigen Stelle neu an (rideOn, gate).
    pause(hidden) {
      if (!ctx) return;
      if (hidden) { this.hush(); ctx.suspend().catch(() => {}); } else if (on) ctx.resume().catch(() => {});
    },
    hush() {
      if (!ctx) return;
      for (const h of shots) fadeOut(h, 0.05);
      shots.clear();
      ride = null; gate = null;
    },
    // Plattform fährt los: Anfahren und die Schleife, SND_FADE eingeblendet
    rideStart() {
      if (!live()) return;
      if (ride) for (const h of [ride.loop, ride.start]) fadeOut(h, 0.15);
      ride = { start: play('platte-start', pad.lp, 1) };
      this.rideOn(SND_FADE);
    },
    // Schleife sicherstellen (nach Umkehr, Wiederkommen, Einschalten)
    rideOn(fade = 0.3) {
      if (!live()) return;
      if (ride?.loop) return;
      const b = buf['platte-lauf'];
      if (!b) return;
      const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime + 0.005;
      s.buffer = b; s.loop = true;
      s.loopStart = SND_LOOP.start; s.loopEnd = SND_LOOP.start + SND_LOOP.len;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade);
      s.connect(g).connect(pad.lp);
      s.start(t, SND_LOOP.start + Math.random() * SND_LOOP.len);
      ride = { ...(ride ?? {}), loop: keep(s, g) };
    },
    // Halt (SND_HIT vor dem Stillstand, late ms zu spät): Schlag beim
    // Stillstand, Schleife und Anfahren blenden aus
    rideHalt(late = 0) {
      if (ride) { for (const h of [ride.loop, ride.start]) fadeOut(h, SND_FADE); ride = null; }
      if (live()) play('platte-halt', pad.lp, 1, Math.max(0, late) / 1000);
    },
    // Tor auf oder zu, die Bahn endet in left s: Der Anschlag fällt dorthin
    // (nach einer Umkehr setzt die Aufnahme mitten drin ein)
    gate(dir, left) {
      if (gate) { fadeOut(gate, 0.12); gate = null; }
      if (!live()) return;
      const name = dir === 'open' ? 'tor-auf' : 'tor-zu', offset = SND_HIT[name] - left;
      gate = play(name, out, 1, Math.max(0, offset), Math.max(0, -offset));
      if (gate && offset > 0.05) { const t = ctx.currentTime; gate.g.gain.setValueAtTime(0, t); gate.g.gain.linearRampToValueAtTime(1, t + 0.08); }
      if (gate) { const h = gate; h.s.addEventListener('ended', () => { if (gate === h) gate = null; }); }
    },
    gateDone() { gate = null; },
    // je Bild: Tiefe der Plattform 0..1, Tor über ihr geschlossen 0..1
    space(depth, cover) {
      if (!pad) return;
      const m = Math.min(1, 0.5 * depth + 0.5 * cover * Math.min(1, depth * 4)), t = ctx.currentTime;
      pad.lp.frequency.setTargetAtTime(250 + 17750 * Math.pow(1 - m, 2.5), t, 0.1);
      pad.g.gain.setTargetAtTime(1 - 0.45 * m, t, 0.1);
    },
    dispose() { if (ctx) ctx.close().catch(() => {}); ctx = null; pad = null; buf = null; loading = null; ride = null; gate = null; shots.clear(); },
  };
}

// Leistungsstufen (Krisz, 2026-10-15: „auf komplett potato flüssig“). hoch
// ist das volle Bild; mittel lässt Nachbearbeitung (Umgebungsverdeckung,
// Lichtschein), Bodenspiegelung des Schiffs und Crew-Schatten weg, hat
// weniger echte Lampen (die übrigen gehen ins Lichtgitter) und zeichnet die
// Schatten nur neu, wenn sich das Schiff bewegt; niedrig dazu ohne Möbel,
// Texturen höchstens 512 px, eine Schattenlampe, vier statt acht Arbeiter,
// höchstens 30 Bilder je Sekunde und ohne Kantenglättung. Inhalt bleibt aus
// dem Spiel, es fällt nur weg oder wird kleiner.
export const QUALITY_LEVELS = ['niedrig', 'mittel', 'hoch'];
// Grafikchips nach Name (WEBGL_debug_renderer_info). Schwach: Software,
// Intel HD/UHD ohne Iris/Xe/Arc, ältere Mali, Adreno bis 5xx, PowerVR, alte
// Radeon (HD, R5/R7) und GeForce der GT-Reihe bzw. vor der 900er. Mittel:
// Iris/Xe, integrierte Radeon, GeForce MX und GTX 700, Mali-G6x/G7x, Adreno 6xx.
const GPU_WEAK = /swiftshader|llvmpipe|softpipe|software|basic render|intel.*\b(u?hd)\b(?!.*(iris|xe|arc))|mali-(4\d\d|t\d+|g[1-5]\d)\b|adreno\D*[1-5]\d\d\b|powervr|radeon\s*(\(tm\)\s*)?(hd|r[5-7]\b)|geforce\s*(gt\s|gts\s|[89]\d{3}\b|gtx\s*[4-6]\d\d\b)/i;
const GPU_MID = /iris|intel.*\b(xe|arc\(tm\) graphics)\b|radeon\s*(\(tm\)\s*)?(graphics|vega|\d{3}m\b)|geforce\s*(mx|gtx\s*7\d\d\b)|mali-g[67]\d\b|adreno\D*6\d\d\b/i;
// Am Telefon reicht für hoch nur ein starker Chip
const GPU_PHONE_STRONG = /apple|adreno\D*([7-9]\d\d)\b|immortalis|mali-g7\d\d|xclipse/i;
// gpu: Name des Chips, small: Telefon (schmal oder Touch), forced: Stufe
// aus ?grafik= oder der Einstellung, memory/cores: navigator.deviceMemory
// und hardwareConcurrency (fehlen in Safari und Firefox).
export function pickQuality({ gpu = '', small = false, forced = null, memory = null, cores = null } = {}) {
  if (QUALITY_LEVELS.includes(forced)) return { level: forced, why: 'gewählt' };
  const g = String(gpu || '');
  const out = (level, why) => ({ level, why });
  if (GPU_WEAK.test(g)) return out('niedrig', `Grafikchip ${g}`);
  if (memory && memory <= 2) return out('niedrig', `${memory} GB Speicher`);
  if (GPU_MID.test(g)) return out('mittel', `Grafikchip ${g}`);
  if (memory && memory <= 4) return out('mittel', `${memory} GB Speicher`);
  // Wenige Kerne zählen nur, wenn der Chip nichts verrät (ein starker Chip zeichnet die Aufrufe der hohen Stufe auch dann)
  if (cores && cores <= 4 && !g) return out('mittel', `${cores} Kerne`);
  if (small && !GPU_PHONE_STRONG.test(g)) return out('mittel', g ? `Telefon, Grafikchip ${g}` : 'Telefon');
  return out('hoch', g ? `Grafikchip ${g}` : 'unbekannter Grafikchip');
}
const gpuName = (gl) => {
  try {
    const x = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch { return ''; }
};

export async function initHangar(container, opts = {}) {
  const reduceMotion = !!opts.reduceMotion;
  const W = () => container.clientWidth || 1;
  const H = () => container.clientHeight || 1;
  // Echte Halle aus dem Spiel: Dann wird die gebaute Halle gar nicht erst
  // gemalt (sie wiche ohnehin), und das Bild erscheint erst, wenn Halle und
  // Schiff übersetzt und hochgeladen sind — ohne Zwischenstand, der springt.
  const REAL = !!(opts.hall?.url && opts.hall.room);
  // Telefon: schmal oder Touch
  const SMALL = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  // Leistungsstufe beim Start (pickQuality). Q0 legt fest, was beim Laden
  // entsteht (Lampen, Schattenkarten, Möbel, Texturgröße, Kantenglättung);
  // level kann danach nur sinken (adapt in frame()).
  const device = { small: SMALL, forced: opts.quality, memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency };
  let pick = pickQuality({ ...device, gpu: opts.gpu });
  const rank = (l) => QUALITY_LEVELS.indexOf(l);
  // Bildschärfe: startet bei der Pixeldichte des Geräts, gedeckelt je Stufe,
  // und gibt stufenweise nach, wenn das Bild ruckelt (adapt in frame()).
  const PR_CAP = { hoch: 2, mittel: 1.5, niedrig: 1 };

  const renderer = new THREE.WebGLRenderer({ antialias: pick.level !== 'niedrig', powerPreference: 'high-performance' });
  // Ohne Namen von der Seite: aus dem eigenen Zeichenkontext, nur abwärts
  if (opts.gpu == null && pick.why !== 'gewählt') {
    const p2 = pickQuality({ ...device, gpu: gpuName(renderer.getContext()) });
    if (rank(p2.level) <= rank(pick.level)) pick = p2;
  }
  const Q0 = pick.level, FORCED = pick.why === 'gewählt';
  // Wartungsplatz am Schiff, wo die Stufe Requisiten hat (loadRealHall)
  const DIENST_ON = REAL && !!opts.hall?.workshop?.dienst && (WORK_BUDGET[SMALL ? 'niedrig' : Q0]?.props ?? 0) > 0;
  let level = Q0;
  // Stand der Schattenkarten unter hoch (shadowsDue); leer = neu zeichnen
  let shadowSig = '';
  let pixelRatio = Math.min(window.devicePixelRatio || 1, PR_CAP[Q0]);
  // Im Leerlauf zeichnet die Bühne mit pixelRatio · pixelScale (frame())
  let pixelScale = 1;
  console.info(`[hangar] Leistungsstufe ${Q0} (${pick.why})`);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = LOOK_ON ? THREE.CustomToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  // PCF ausdrücklich: three r185 stellt PCFSoft beim ersten Zeichnen der
  // Schatten von selbst auf PCF um. Was vorher übersetzt wurde (prepare),
  // gälte dann der alten Art und würde neu übersetzt.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Schattenkarten einmal je Bild (frame setzt needsUpdate). Von selbst
  // zeichnete three.js sie bei jedem Zeichnen der Szene neu, auch im
  // Normalen-Pass der Umgebungsverdeckung: 1100 der 2600 Draw-Calls eines
  // Bildes (2026-10-08).
  renderer.shadowMap.autoUpdate = false;
  // unsichtbar, bis Halle und Schiff fertig sind (reveal)
  if (REAL) renderer.domElement.style.opacity = '0';
  container.appendChild(renderer.domElement);
  // Mit echter Halle bleibt die Leinwand ohnehin bis reveal() verborgen: Der
  // Aufbau gibt dann zwischen seinen großen Schritten dem Browser das Wort
  // (am Stück 0,5 s bei vierfach gedrosselter CPU, 15.10.2026). Nur vor den
  // Steuerelementen: danach könnten Ereignisse auf Späteres zugreifen.
  const breathe = () => (REAL ? nextTask() : undefined);
  await breathe();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080b);
  scene.fog = new THREE.Fog(0x07080b, 40, 110);
  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;
  await breathe();

  // Echte Halle: { group, room, mats, floorY, furniture }; lastInfo = Maße
  // des aktuellen Schiffs
  let realHall = null;
  let lastInfo = null;
  // Freiraum der Kamera in der echten Halle (measureFree, vor frame())
  let camFree = null, freeDirty = false;
  // Gebaute Halle (Plattform, Wände, Boden, Staub): nur ohne echte Halle oder
  // wenn diese nicht lädt. Ihre Leinwandtexturen kosteten beim Laden sonst
  // Sekunden, obwohl die echte Halle sie sofort verdeckte.
  let hall = null, anim = [], floor = null, floorTex = null, dust = null;
  function buildStage() {
    if (hall) return;
    ({ hall, anim } = buildHall(reduceMotion));
    scene.add(hall);
    floorTex = floorTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floor = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6, metalness: 0.35, color: 0xb8bcc6 })
    );
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);
    dust = dustCloud();
    scene.add(dust.pts);
    life.addStage();
    life.root.visible = true;
    if (lastInfo) scaleWorld(lastInfo);
  }

  // Licht: Himmel, Hauptstrahler mit Schatten, warmes Gegenlicht, Fülllicht.
  // decay 0: die Halle wächst mit dem Schiff, die Helligkeit soll es nicht.
  const hemi = new THREE.HemisphereLight(0xc8d6ff, 0x1a1c22, 0.6);
  scene.add(hemi);
  const key = new THREE.SpotLight(0xffffff, 3.2, 0, Math.PI / 4.2, 0.5, 0);
  key.castShadow = true;
  // Ersatzbühne ohne Spielhalle: auf schwachen Geräten ein Viertel des Schattenspeichers.
  key.shadow.mapSize.setScalar(SMALL || Q0 === 'niedrig' ? 2048 : 4096);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xffb86b, 2.0, 0, Math.PI / 5, 0.6, 0);
  scene.add(rim, rim.target);
  const doorLight = new THREE.DirectionalLight(0x7fb0ff, 0.9);
  scene.add(doorLight, doorLight.target);
  const fill = new THREE.DirectionalLight(0x8fb4ff, 0.5);
  scene.add(fill);

  // Dampf und Geräusche der Mechanik (fx): ohne Bewegung (reduceMotion)
  // fährt nichts, also auch kein Dampf; die niedrige Stufe mit weniger
  // Teilchen (Füllrate: große, durchscheinende Flächen)
  const steamK = Q0 === 'niedrig' ? 0.5 : Q0 === 'mittel' ? 0.75 : 1;
  const steam = reduceMotion ? null : buildSteam(Math.round(160 * steamK));
  if (steam) scene.add(steam.mesh);
  const sound = hangarSound(opts.hall?.lift?.sound ?? null);
  if (opts.sound === false) sound.set(false);
  const unlockSound = () => sound.unlock();
  document.addEventListener('pointerdown', unlockSound, { capture: true, passive: true });
  document.addEventListener('keydown', unlockSound, { capture: true });
  const life = buildLife(scene, reduceMotion, !REAL);
  // In der echten Halle werfen die Arbeiter keinen Schatten (sie laufen: die
  // Karten müssten sonst jedes Bild neu, in hoch 315 Aufrufe und 2 ms
  // Prozessorzeit je Bild mit der Gladius), in der niedrigen Stufe gehen
  // vier statt acht
  if (Q0 !== 'hoch' || REAL) life.setShadows(false);
  if (Q0 === 'niedrig') life.setCount(4);
  await breathe();
  // die Crew erscheint mit der Halle, nicht vorher im Leeren
  life.root.visible = !REAL;
  if (!REAL) buildStage();

  const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 4000);
  let S = 1, span = 14;
  // camLimit: in der echten Halle darf die Kamera nicht durch die Wand
  // (Kugel um das Ziel; was in die Halle ragt, hält keepFree() fern)
  let camLimit = Infinity;
  const wantDist = () => span * 1.45 * Math.min(2.2, Math.max(1, 1.3 / (W() / H()))) + 6;
  const homeDist = () => Math.min(camLimit, wantDist());
  // Shift-Optik (setCover): Am Telefon liegt der Titelblock der Seite samt
  // Knöpfen über dem oberen Teil der Bühne (390 x 844: 319 von 523 px). Das
  // Bild rückt dann nach unten wie bei einem verschobenen Objektiv:
  // gerechnet wird ein um lensS höheres Gesamtbild, gezeigt sein oberer
  // Teil. Bildwinkel und Kamera bleiben, nur der Ausschnitt wandert.
  let coverTop = 0, lensS = 0, lensLive = false, baseFov = 38, lensFit = null;
  // Passt ein großes Schiff (C2, Carrack) nicht mit Abstand in die Halle,
  // weitet sich der Blickwinkel, statt das Schiff anzuschneiden.
  // fovGlide { a, t0, dur }: Beim Schiffswechsel gleitet er mit der
  // Kamerafahrt vom alten Wert her. Sonst sprang das ganze Bild beim Tausch
  // unter geschlossenem Tor (Gladius -> 300i: 38 auf 41,5 Grad; Krisz,
  // 20.10.2026: „poppen“).
  let fovGlide = null;
  const inOut3 = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const fitFov = (now = performance.now()) => {
    const d = wantDist(), k = 1 + lensS;
    baseFov = d > camLimit ? Math.min(64, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) * d / camLimit))) : 38;
    if (fovGlide) {
      const t = Math.min(1, (now - fovGlide.t0) / fovGlide.dur);
      baseFov = THREE.MathUtils.lerp(fovGlide.a, baseFov, inOut3(t));
      if (t >= 1) fovGlide = null;
    }
    camera.fov = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * k));
    camera.aspect = W() / (H() * k);
    // beide rechnen die Projektion neu
    if (lensS > 0) camera.setViewOffset(W(), H() * k, 0, 0, W(), H());
    else camera.clearViewOffset();
  };
  const homePos = () => HOME_DIR.clone().multiplyScalar(homeDist()).add(controls.target);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // nie unter den Boden
  // Kein Umlauf (Krisz, 2026-10-18: keine automatische Kameradrehung): die
  // Kamera bewegt nur, wer sie zieht, zoomt oder die Ansicht zuruecksetzt.
  controls.autoRotate = false;
  camera.position.copy(homePos());
  controls.update();
  let touched = false;
  // Bildtakt (frame): bis activeUntil die volle Rate, sonst die des Leerlaufs.
  // seen: letzte Zeigerbewegung über der Bühne; mit activeUntil das Maß für
  // Leerlauf und Ruhe (frame()).
  let activeUntil = 0, dragging = false, seen = performance.now();
  const wake = (ms) => { activeUntil = Math.max(activeUntil, performance.now() + ms); };
  // Ziel kam aus focus(): ein Punkt am Schiff, der mit dem Schiff wandert
  let onPoint = false;
  controls.addEventListener('start', () => { touched = true; dragging = true; fly = null; });
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
    const e = inOut3(k);
    controls.target.lerpVectors(fly.ta, fly.tb, e);
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(fly.a.radius, fly.b.radius, e),
      THREE.MathUtils.lerp(fly.a.phi, fly.b.phi, e),
      THREE.MathUtils.lerp(fly.a.theta, fly.b.theta, e));
    camera.position.setFromSpherical(s).add(controls.target);
    if (k >= 1) fly = null;
  };
  // Das Schiff wechselt die Standhöhe (die Halle kam nach dem Schiff). Ein
  // mit focus() gezielter Punkt sinkt mit, samt laufendem Flug. Startansicht
  // und ein nur gedrehter Blick zielen auf eine feste Höhe über dem Boden,
  // die für die echte Halle gilt; die bleiben stehen.
  function settleShip(y) {
    if (!current) return;
    const dy = y - current.group.userData.baseY;
    current.group.userData.baseY = y;
    if (!onPoint || !dy) return;
    if (fly) { fly.ta.y += dy; fly.tb.y += dy; }
    else { controls.target.y += dy; camera.position.y += dy; }
  }
  controls.addEventListener('end', () => {
    // die Dämpfung läuft nach dem Loslassen noch etwa eine Sekunde
    dragging = false;
    wake(1500);
  });

  // Echte Halle: wird geladen, sobald die Bühne steht. room = Innenraum im
  // Modellraum (Bodenmitte, halbe Breite/Länge, Höhe).
  // Maßstab der echten Halle: Originalgröße, solange Schiff samt Gerät
  // hineinpasst; das Gerät steht bis PAD_R*S + 9 m von der Mitte.
  // Dazu muss die Kamera im Umlauf drinbleiben: ihr waagrechter Abstand
  // (0,94 x Entfernung) bleibt unter 90 % der halben Breite, und der
  // Mindestabstand fürs ganze Schiff (span * 1.1 + 4) soll darin Platz haben.
  const camRoom = (room, k) => (0.9 * Math.min(room.halfW, room.halfL) * k) / 0.94;
  // Mit Aufzug steht das Schiff ganz auf dem Feld, mit 1 m Rand.
  const liftScale = () => {
    const L = realHall?.liftL;
    return L && lastInfo ? Math.max((2 * lastInfo.halfW + 2) / (L.to[0] - L.from[0]), (lastInfo.len + 2) / (L.to[1] - L.from[1])) : 0;
  };
  const realHallScale = (room) => Math.max(1, (PAD_R * S + 9) / room.halfW, (span * 1.15) / (2 * room.halfL),
    (span * 1.1 + 4) / camRoom(room, 1), liftScale());

  // Einrichtung und Deko stehen in Originalgröße: gelegt für den Maßstab kk
  // (1/kk im Modell der Halle), im Ruhezustand kk = k. propGlide { a, t0,
  // dur }: Beim Schiffswechsel wachsen sie erst mit der Halle mit, dann
  // gleiten sie, während Tor und Aufzug fahren, langsam auf Originalgröße,
  // gleichmäßig im Verhältnis (geometrisch). Sonst schrumpften sie im
  // stillstehenden Bild auf einen Schlag (Gladius -> Carrack: k 1 auf 3,9,
  // Kisten auf ein Viertel); in 0,7 s mit der Kamerafahrt sah man sie
  // noch schrumpfen.
  // Unterwegs (part) rechnet die Einrichtung reihum je Bild höchstens
  // PROP_VERTS Ecken neu: alle auf einmal wären auf hoch 930 000 Ecken
  // (11 MB Upload) in jedem Bild der Fahrt.
  const PROP_GLIDE_MS = 2400, PROP_VERTS = 200000;
  let propGlide = null, propK = 1, furnAt = 0;
  function layProps(kk, part = false) {
    propK = kk;
    const F = realHall.furniture;
    if (!part) scaleFurniture(F, 1 / kk);
    else {
      for (let n = 0, j = 0; j < F.length && n < PROP_VERTS; j++, furnAt = (furnAt + 1) % F.length) {
        const f = F[furnAt];
        if (f.s === 1 / kk) continue;
        scaleFurniture([f], 1 / kk);
        n += f.mesh.geometry.attributes.position.count;
      }
    }
    if (realHall.deko) layDeko(realHall.deko, kk);
  }
  const propStep = (now) => {
    const t = Math.min(1, (now - propGlide.t0) / propGlide.dur);
    const b = hallRoot.scale.x;
    layProps(t >= 1 ? b : propGlide.a * Math.pow(b / propGlide.a, inOut3(t)), t < 1);
    if (t >= 1) propGlide = null;
  };

  // Halle, Licht, Nebel und Kamera auf die Schiffsgröße einstellen.
  // hold: Einrichtung und Deko bleiben, wie sie liegen (Schiffswechsel auf
  // dem Aufzug, show() setzt dann propGlide)
  function scaleWorld(shipInfo, hold = false) {
    lastInfo = shipInfo;
    span = Math.max(shipInfo.len, shipInfo.halfW * 2, 6);
    S = Math.max(1, span / 16);
    if (hall) {
      hall.scale.setScalar(S);
      floor.scale.setScalar(HALL_R * S * 1.02);
      floorTex.repeat.set((HALL_R * S * 2) / 8, (HALL_R * S * 2) / 8); // Kachel 4 m (Textur = 2x2 Platten)
    }
    scene.fog.near = HALL_R * S * 1.1; scene.fog.far = HALL_R * S * 3.2;
    if (realHall) {
      const k = realHallScale(realHall.room);
      hallRoot.scale.setScalar(k);
      hallNoTileInvK.value = 1 / k;
      if (!hold) { propGlide = null; layProps(k); }
      if (realHall.dienst) layDienst(realHall.dienst, shipInfo, k);
      // Kein Dunst im hellen Innenraum: erst die Stirnwände verschwimmen leicht.
      scene.fog.near = realHall.room.halfL * k * 1.2; scene.fog.far = realHall.room.halfL * k * 4;
      scaleLamps();
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
    if (dust) {
      dust.pts.scale.set(dw, shipInfo.height * 1.8 + 4, dw);
      dust.pts.material.size = 0.035 * Math.max(1, span / 14);
    }
    life.setBlocks([...(realHall?.dienst?.blocks ?? []), ...(realHall?.deko?.blocks ?? [])], realHall?.dienst?.hull ?? null);
    life.layout(S, shipInfo);
  }

  const draco = new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco).register(embeddedImages(8));
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // ─── Laden ohne Einfrieren ──────────────────────────────────────────────
  // Die Seite fror beim Laden ein (Krisz, 2026-10-07). Gemessen: Fast alle
  // Zeit steckte im Übersetzen der Shader, und zwar doppelt — erst für das
  // direkte Bild, dann beim Zuschalten der Nachbearbeitung noch einmal für
  // das Zwischenbild ohne Tonwertabbildung. Dazu jede Kartenkombination ein
  // eigener Shader (97 Programme), alle Texturen in einem einzigen Bild
  // hochgeladen. Jetzt: Kartensätze vereinheitlicht, übersetzt wird einmal,
  // im Hintergrund (KHR_parallel_shader_compile) und für den Weg, auf dem
  // gezeichnet wird; Texturen gehen in Häppchen hoch; gezeigt wird erst danach.

  // Fortschritt über alles, was vor dem ersten Bild da sein muss: Schiff und
  // Halle (bis 90 %), der Rest ist Übersetzen und Hochladen.
  const prog = new Map();          // Schlüssel -> [geladen, gesamt]
  let progressFn = null;
  function report() {
    if (!progressFn) return;
    let a = 0, b = 0;
    for (const [l, t] of prog.values()) { a += l; b += t; }
    progressFn(b ? Math.min(90, Math.round((a / b) * 90)) : 0);
  }
  // my: Marke des show(), das lädt. Ein überholtes show() lädt zu Ende,
  // meldet aber keinen Fortschritt mehr: der Balken gehört dem gewählten Schiff.
  const fetchGltf = (url, key = 'ship', guess = 8e6, my = null) => new Promise((resolve, reject) => {
    loader.load(url, resolve, (e) => {
      if (my !== null && my !== token) return;
      prog.set(key, [e.loaded, e.total || Math.max(guess, e.loaded)]);
      report();
    }, reject);
  });

  // Gleiche Merkmale, gleiches Programm: three.js übersetzt für jede
  // Kombination von Karten ein eigenes Shaderprogramm. Fehlende Karten
  // bekommen deshalb ein neutrales Pixel, das am Bild nichts ändert (weiß;
  // flache Normale mit Stärke 0; Leuchten bleibt schwarz, weil die
  // Leuchtfarbe schwarz bleibt). Übrig bleiben nur die Arten (deckend,
  // ausgestanzt, durchsichtig) und die Seiten.
  const PIXEL = new Map();
  const pixel = (rgb, srgb = false) => {
    const k = rgb.join() + (srgb ? 's' : '');
    if (!PIXEL.has(k)) {
      const t = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.userData.neutral = true;
      t.needsUpdate = true;
      PIXEL.set(k, t);
    }
    return PIXEL.get(k);
  };
  function unifyMaps(m) {
    if (m.type !== 'MeshStandardMaterial') return;
    const white = pixel([255, 255, 255]), whiteS = pixel([255, 255, 255], true);
    if (!m.map) m.map = whiteS;
    if (!m.normalMap) { m.normalMap = pixel([128, 128, 255]); m.normalScale.set(0, 0); }
    if (!m.roughnessMap) m.roughnessMap = white;
    if (!m.metalnessMap) m.metalnessMap = white;
    if (!m.emissiveMap) m.emissiveMap = whiteS;
    if (!m.aoMap) m.aoMap = white;
    m.needsUpdate = true;
  }
  const isNeutral = (t) => !!t?.userData?.neutral;
  // Doppelseitig Durchsichtiges zeichnet three.js in zwei Zügen (Rück-, dann
  // Vorderseite) und ermittelt vor jedem Zug das Shaderprogramm neu. Decals
  // und Relief liegen flach auf dem Rumpf: ein Zug genügt. Nur diese, nach
  // Namen (die doppelseitig durchsichtigen Materialien der zehn texturierten
  // Schiffe und der Halle, 18.10.2026): Glas ist dort einseitig, aber eine
  // gewölbte Hülle (Leuchtschalen der Triebwerke, künftiges Glas) braucht
  // beide Züge.
  const ONE_PASS = /decal|pom|emblem|graphic|livery|stitch|trim|nernies/i;
  const onePass = (m) => { if (m.transparent && m.side === THREE.DoubleSide && ONE_PASS.test(m.name)) m.forceSinglePass = true; };

  // Vor dem ersten Bild: Shader im Hintergrund übersetzen und Texturen in
  // Häppchen von höchstens ~6 ms hochladen, dazwischen kommt der Browser zum
  // Zug. Übersetzt wird mit dem Zwischenbild der Nachbearbeitung als Ziel,
  // sobald es sie gibt: Ziel mit/ohne Tonwertabbildung sind zwei Programme.
  const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'];
  const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0));
  let composerReady = Promise.resolve();
  // Spiellampen stehen (true) oder kommen nicht (false); vorher wird nichts übersetzt
  let lampsReady = Promise.resolve(false);
  // Spiegelungssonde aus dem Spiel ({ tex, name }) oder null
  let probeReady = Promise.resolve(null);
  // Übersetzen, ohne die Seite anzuhalten. Mit KHR_parallel_shader_compile
  // (Chrome/Edge unter Windows) läuft es in Hintergrundfäden, und
  // compileAsync wartet ohne zu blockieren. Ohne die Erweiterung blockiert
  // jedes Programm bei seinem ersten Gebrauch: dann eins nach dem anderen,
  // jedes in einer eigenen Aufgabe, statt alle am Stück im ersten Bild.
  const PARALLEL = renderer.extensions.has('KHR_parallel_shader_compile');
  const linked = new WeakSet();
  // target: Zielbild beim späteren Zeichnen (null = Leinwand); world: die
  // Szene, deren Lichter mitzählen (Vollbildpässe zeichnen ohne Lichter).
  async function compileFor(root, target, world = scene) {
    const prev = renderer.getRenderTarget();
    if (PARALLEL) {
      renderer.setRenderTarget(target);
      let p;
      try { p = renderer.compileAsync(root, camera, world); } finally { renderer.setRenderTarget(prev); }
      await p;
      return;
    }
    const items = [], seen = new Set();
    root.traverse((n) => {
      if (n.isMesh) for (const m of [].concat(n.material)) if (!seen.has(m)) { seen.add(m); items.push([n, m]); }
    });
    for (const [n, m] of items) {
      const plain = !(n.isInstancedMesh || n.isSkinnedMesh || n.isBatchedMesh);
      renderer.setRenderTarget(target);
      try { renderer.compile(plain ? new THREE.Mesh(n.geometry, m) : n, camera, world); } finally { renderer.setRenderTarget(prev); }
      let fresh = false;
      for (const pr of renderer.properties.get(m).programs?.values() ?? []) {
        if (linked.has(pr)) continue;
        linked.add(pr);
        pr.getUniforms();
        fresh = true;
      }
      if (fresh) await yieldToBrowser();
    }
  }
  // Laden läuft (prepare, show): Nachregeln (adapt) misst dann nicht, und
  // eine Sekunde danach auch nicht, weil Übersetzen und Hochladen nachhallen
  let busy = 0, quietAt = 0, busyAt = 0;
  const busyStart = () => { if (!busy) busyAt = performance.now(); busy++; };
  const busyEnd = () => { busy = Math.max(0, busy - 1); quietAt = performance.now() + 1000; };
  async function prepare(root) {
    busyStart();
    try {
      await composerReady;
      const tex = new Set();
      root.traverse((n) => {
        if (n.isMesh) for (const m of [].concat(n.material)) {
          for (const k of TEX_SLOTS) if (m[k]) tex.add(m[k]);
          for (const t of m.userData.hgTex ?? []) tex.add(t);   // Karten nur im Shader (Wear-Schicht)
        }
      });
      if (TEX_MAX) await shrinkTextures(tex);
      const compiled = compileFor(root, composer ? composer.readBuffer : null);
      let t0 = performance.now();
      for (const t of tex) {
        renderer.initTexture(t);
        if (performance.now() - t0 > 6) { await yieldToBrowser(); t0 = performance.now(); }
      }
      await compiled;
    } finally { busyEnd(); }
  }
  // Niedrige Stufe: Texturen höchstens TEX_MAX px an der längeren Kante,
  // verkleinert vor dem Hochladen (ein Viertel des Grafikspeichers je
  // halbierter Kante, kürzeres Hochladen). Dasselbe Bild aus dem Spiel, nur
  // kleiner; je Bildquelle einmal, auch wenn mehrere Texturen sie teilen.
  const TEX_MAX = Q0 === 'niedrig' ? 512 : 0;
  const shrunk = new WeakMap();
  async function shrinkTextures(tex) {
    const jobs = [];
    for (const t of tex) {
      const src = t.source, im = src?.data, w = im?.width || 0, h = im?.height || 0;
      if (!im || Math.max(w, h) <= TEX_MAX || t.isDataTexture || t.isCompressedTexture) continue;
      if (!shrunk.has(src)) {
        const k = TEX_MAX / Math.max(w, h), nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k));
        shrunk.set(src, (async () => {
          let out = null;
          try {
            out = await createImageBitmap(im, { resizeWidth: nw, resizeHeight: nh, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
            if (out.width !== nw) { out.close(); out = null; }   // Größe nicht unterstützt
          } catch { out = null; }
          if (!out) {
            try {
              out = document.createElement('canvas');
              out.width = nw; out.height = nh;
              out.getContext('2d').drawImage(im, 0, 0, nw, nh);
            } catch { return; }
          }
          src.data = out;
          if (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) im.close();
        })());
      }
      jobs.push(shrunk.get(src).then(() => { t.needsUpdate = true; }));
    }
    await Promise.all(jobs);
  }

  // Lampen der Halle aus dem Spiel (Licht-Entities des socpak, vom Build als
  // <halle>.lights.json neben das GLB gelegt; Richtungen dort schon nach glTF
  // gedreht, Flächenlichter an ihrer Fläche ausgerichtet). Fehlt die Datei,
  // bleibt es beim Bühnenlicht.
  // Jede Lampe kostet im Fragment-Shader jedes Hallenpixels. Deshalb werden
  // benachbarte Flächenlichter zu einer Gruppe zusammengelegt, und es brennen
  // nur die, die im Blickfeld (Boden um die Plattform, Schiff, Wände) am
  // meisten beitragen.
  // Gegen das Einfrieren beim Laden (Krisz, 2026-10-07): Die Lampen kommen
  // parallel zur Halle und stehen, bevor irgendetwas übersetzt wird. Jede
  // Lampe ist Teil jedes Shaderprogramms; kämen sie danach, würde alles neu
  // übersetzt. Dafür ersetzen sie das Bühnenlicht ganz, statt dazuzukommen.
  const GAME_LAMPS = true, HALL_PROBE = true;
  // Festes Budget: Die beiden Hauptstrahler unter der Decke tragen am
  // Boden um das Schiff 98 % des Lichts (Bewertung wie lampScore, mit den
  // Wänden 94 %), die nächsten vier sind Spots an der Rückwand; alle sechs
  // zusammen 97 %. Mehr Lampen kosten jedes Bild, ohne dass man es sieht.
  // Unter hoch weniger: Was nicht brennt, geht ins Lichtgitter (buildHallVolume).
  const MAX_LIGHTS = Q0 === 'niedrig' ? 2 : SMALL ? 3 : Q0 === 'mittel' ? 4 : 6;
  // So viele Spots über der Plattform werfen den Schatten des Schiffs (und
  // der Halle, renderHallShadows: dieselben Strahler, in derselben Folge)
  const SHADOW_LAMPS = SMALL || Q0 === 'niedrig' ? 1 : 2;
  // Kantenlänge der Schattenkarten (Schiff und Halle)
  const SHADOW_SIZE = SMALL || Q0 === 'niedrig' ? 1024 : 2048;
  // Unter dieser Reichweite (m) ist ein Flächenlicht nur Glimmen an seiner
  // Leuchte (Bodenleuchten: 0,1 m). Zusammengelegt würde daraus eine Lampe
  // mit Metern Reichweite, die es im Spiel nicht gibt.
  const LAMP_MIN_RADIUS = 1;
  // Spielstärke -> three.js (Candela bei decay 2), am Render abgeglichen:
  // bei 1,5 lesen sich Boden und Wände klar, ab 4,5 brennt der Boden weiß aus.
  const HALL_LIGHT_SCALE = 2;
  const DEG = Math.PI / 180;
  // Flächenlicht ≈ Halbraum vor der Fläche, weich auslaufend; ein Stück vor
  // die Fläche gesetzt, damit direkt davor kein gleißender Fleck entsteht.
  const AREA_HALF = 80 * DEG, AREA_OFFSET = 0.6;
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Gerichtet strahlen Spots und ausgerichtete Flächenlichter; Punktlichter rundum
  const aimed = (l) => !!l.dir && (l.type === 'spot' || l.type === 'area');

  function clusterAreaLights(list, reach = 5) {
    const cl = [];
    for (const l of [...list].sort((a, b) => b.intensity - a.intensity)) {
      const c = cl.find((q) => Math.hypot(q.pos[0] - l.pos[0], q.pos[1] - l.pos[1], q.pos[2] - l.pos[2]) < reach
        && (q.seed && l.dir ? dot3(q.seed, l.dir) > 0.7 : !q.seed && !l.dir));
      const w = l.intensity, col = l.color || [1, 1, 1];
      if (!c) {
        cl.push({ type: 'area', pos: [...l.pos], seed: l.dir, dsum: l.dir ? l.dir.map((v) => v * w) : null, color: [...col], intensity: w, m: [l] });
        continue;
      }
      const sum = c.intensity + w;
      for (let i = 0; i < 3; i++) {
        c.pos[i] = (c.pos[i] * c.intensity + l.pos[i] * w) / sum;
        c.color[i] = (c.color[i] * c.intensity + col[i] * w) / sum;
        if (c.dsum) c.dsum[i] += l.dir[i] * w;
      }
      c.intensity = sum;
      c.m.push(l);
    }
    for (const c of cl) {
      c.dir = c.dsum ? (() => { const n = Math.hypot(...c.dsum) || 1; return c.dsum.map((v) => v / n); })() : null;
      c.radius = Math.max(...c.m.map((l) => (l.radius || 0) + Math.hypot(l.pos[0] - c.pos[0], l.pos[1] - c.pos[1], l.pos[2] - c.pos[2])));
    }
    return cl;
  }

  // Beitrag einer Lampe an Messpunkten (Modellraum), wie three.js ihn rechnet
  function lampScore(l, pts) {
    const R = l.radius || 30;
    const cosO = Math.cos(l.type === 'spot' ? Math.min(89, (l.angle || 60) / 2) * DEG : AREA_HALF);
    let s = 0;
    for (const [x, y, z, w] of pts) {
      const dx = x - l.pos[0], dy = y - l.pos[1], dz = z - l.pos[2], d = Math.hypot(dx, dy, dz);
      if (d >= R) continue;
      let cone = 1;
      if (aimed(l)) {
        const c = (l.dir[0] * dx + l.dir[1] * dy + l.dir[2] * dz) / (d || 1);
        if (c <= cosO) continue;
        cone = l.type === 'spot' ? Math.min(1, (c - cosO) / 0.15) : c;
      }
      s += w * l.intensity * cone * (1 - (d / R) ** 4) ** 2 / Math.max(1, d * d);
    }
    return s;
  }

  // Licht der übrigen Spiellampen als Lichtgitter. Echt brennen nur die
  // sechs oben; die übrigen gut 300 im Raum (Wandleuchten, Eck-Lichtsäulen,
  // Spots über der Stirnwand, Galerie) trugen nichts bei, und jede Wand
  // stand im selben flachen Grau aus Halbkugel und Umgebungskugel. Hier
  // wird ihr Licht einmal beim Laden auf ein Gitter im Modellraum gerechnet,
  // je Zelle als Würfel aus sechs Richtungen (Helligkeit je ±x, ±y, ±z und
  // eine Lichtfarbe), so wie three.js die echten Lampen rechnet (Stärke mal
  // HALL_LIGHT_SCALE, 1/d² bis zur Reichweite, Kegel), nur ohne Schatten.
  // Der Hallenshader liest es als Streulicht: zwei Abrufe je Bildpunkt statt
  // einer Lampe je Spiellampe. Wände, Boden und Decke liegen achsparallel,
  // für sie ist der Würfel genau. Lampen außerhalb des Raums bleiben
  // draußen, ohne Schatten schienen sie sonst durch die Wand.
  const VOL_STEP = 2;   // Gitterweite in Modellmetern
  const VOL_SOFT = 1;   // m: näher wird keine Lampe heller (Leuchte statt Punkt)
  const VOL_GAIN = 1;   // Stärke gegen die echten Lampen, am Render abgeglichen
  const hallVol = {
    a: { value: null }, b: { value: null }, on: { value: 0 },
    min: { value: new THREE.Vector3() }, at: null, inv: { value: 1 / VOL_STEP }, res: { value: new THREE.Vector3(1, 1, 1) },
  };
  async function buildHallVolume(list, room, f, pause = noPause) {
    const { center: c, halfW, halfL, height } = room;
    const x0 = c[0] - halfW, y0 = f - 1, z0 = c[2] - halfL;
    const nx = Math.round((2 * halfW) / VOL_STEP) + 1, ny = Math.ceil((height + 1) / VOL_STEP) + 1, nz = Math.round((2 * halfL) / VOL_STEP) + 1;
    const N = nx * ny * nz, face = new Float32Array(N * 6), rgb = new Float32Array(N * 3);
    const lo = [x0 - 0.5, y0 - 0.5, z0 - 0.5], hi = [x0 + 2 * halfW + 0.5, f + height + 0.5, z0 + 2 * halfL + 0.5];
    const soft = VOL_SOFT * VOL_SOFT;
    let used = 0;
    for (const l of list) {
      await pause();
      if (!l.pos.every((v, i) => v >= lo[i] && v <= hi[i])) continue;
      const R = l.radius || 30, R4 = R ** 4, I = l.intensity * HALL_LIGHT_SCALE * VOL_GAIN;
      const col = l.color || [1, 1, 1], lum = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2];
      // Kegel wie bei den echten Lampen: Spot mit Halbschatten 0,5, Flächenlicht weich bis zur Achse
      const spot = l.type === 'spot', dir = aimed(l) ? l.dir : null;
      const half = spot ? Math.min(89, (l.angle || 60) / 2) * DEG : AREA_HALF;
      const cosO = Math.cos(half), cosI = Math.cos(spot ? half * 0.5 : 0);
      const [px, py, pz] = l.pos;
      const i0 = Math.max(0, Math.floor((px - R - x0) / VOL_STEP)), i1 = Math.min(nx - 1, Math.ceil((px + R - x0) / VOL_STEP));
      const j0 = Math.max(0, Math.floor((py - R - y0) / VOL_STEP)), j1 = Math.min(ny - 1, Math.ceil((py + R - y0) / VOL_STEP));
      const k0 = Math.max(0, Math.floor((pz - R - z0) / VOL_STEP)), k1 = Math.min(nz - 1, Math.ceil((pz + R - z0) / VOL_STEP));
      used++;
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = px - (x0 + i * VOL_STEP), dy = py - (y0 + j * VOL_STEP), dz = pz - (z0 + k * VOL_STEP);
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1, w = 1 - (d2 * d2) / R4;
        let E = (I / (d2 + soft)) * w * w;
        if (dir) {
          const cs = -(dir[0] * dx + dir[1] * dy + dir[2] * dz) / d;
          if (cs <= cosO) continue;
          const t = Math.min(1, (cs - cosO) / (cosI - cosO));
          E *= t * t * (3 - 2 * t);
        }
        if (E < 1e-4) continue;
        // Richtung zur Lampe: Eine Fläche mit Normale +x empfängt, was von +x kommt
        const n = (k * ny + j) * nx + i, e = (E * lum) / d, lx = dx * e, ly = dy * e, lz = dz * e;
        if (lx > 0) face[n * 6] += lx; else face[n * 6 + 1] -= lx;
        if (ly > 0) face[n * 6 + 2] += ly; else face[n * 6 + 3] -= ly;
        if (lz > 0) face[n * 6 + 4] += lz; else face[n * 6 + 5] -= lz;
        rgb[n * 3] += E * col[0]; rgb[n * 3 + 1] += E * col[1]; rgb[n * 3 + 2] += E * col[2];
      }
    }
    // zwei RGBA-Halbfloat-Texturen: A = +x −x +y −y, B = +z −z und die
    // Lichtfarbe als Rot und Blau je Helligkeit (Grün folgt daraus)
    const A = new Uint16Array(N * 4), B = new Uint16Array(N * 4), h = THREE.DataUtils.toHalfFloat;
    for (let n = 0; n < N; n++) {
      if (!(n & 4095)) await pause();
      for (let s = 0; s < 4; s++) A[n * 4 + s] = h(face[n * 6 + s]);
      B[n * 4] = h(face[n * 6 + 4]); B[n * 4 + 1] = h(face[n * 6 + 5]);
      const r = rgb[n * 3], g = rgb[n * 3 + 1], b = rgb[n * 3 + 2], L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      B[n * 4 + 2] = h(L > 1e-6 ? r / L : 1); B[n * 4 + 3] = h(L > 1e-6 ? b / L : 1);
    }
    const tex = (arr) => {
      const t = new THREE.Data3DTexture(arr, nx, ny, nz);
      t.type = THREE.HalfFloatType; t.format = THREE.RGBAFormat;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.unpackAlignment = 1; t.needsUpdate = true;
      return t;
    };
    return { a: tex(A), b: tex(B), min: [x0, y0, z0], res: [nx, ny, nz], used };
  }

  // Halle samt Lampen: hallRoot steht ab dem Start in der Szene (die Leinwand
  // ist bis zum ersten Bild verborgen) und trägt erst die Lampen, dann das
  // Modell, beide im Modellraum der Halle verschoben (Bodenmitte = Ursprung).
  const hallRoot = new THREE.Group();
  let hallLamps = null, shadowLamps = [], hallFailed = false;
  // Lampen aus <halle>.lights.json setzen; true, sobald sie stehen (dann ohne
  // Bühnenlicht), false ohne Datei oder bei einem Fehler.
  async function loadHallLights(h) {
    if (!GAME_LAMPS || !h?.lights) return false;
    let d = null;
    try { const r = await fetch(h.lights); d = r.ok ? await r.json() : null; } catch { return false; }
    // Vor v 2 standen die Richtungen noch im Z-oben-Raum des Spiels. Ist die
    // Halle schon gescheitert, steht die gebaute mit ihrem Bühnenlicht.
    if ((d?.v || 1) < 2 || hallFailed) return false;
    // Umgebungslichter des Spiels hellen nur flächig auf: das übernimmt die
    // Umgebungskugel aus der Halle.
    const all = (d.lights || []).filter((l) => Array.isArray(l.pos) && l.intensity > 0 && l.type !== 'ambient'
      && !(l.type === 'area' && (l.radius || 0) < LAMP_MIN_RADIUS));
    // Lampen im Boden von Feld und Streifen wandern mit (HALL_SHIFT)
    for (const l of all) l.pos = hallShiftPoint(h, l.pos);
    if (!all.length) return false;
    const cand = [...all.filter((l) => l.type !== 'area'), ...clusterAreaLights(all.filter((l) => l.type === 'area'))];
    // Messpunkte: Boden und Schiff um die Plattform (doppelt), dazu die Wände
    const { center: c, halfW, halfL, height } = h.room, f = Number.isFinite(h.floor) ? h.floor : c[1], o = hallSpot(h);
    const pts = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) pts.push([o[0] + i * halfW * 0.22, f + 0.2, o[2] + j * halfL * 0.18, 2]);
    for (const y of [1.5, 4]) pts.push([o[0], f + y, o[2], 4]);
    for (const y of [3, height * 0.3, height * 0.6]) for (const t of [-0.6, 0, 0.6]) {
      pts.push([c[0] - halfW + 1, f + y, c[2] + t * halfL, 1], [c[0] + halfW - 1, f + y, c[2] + t * halfL, 1]);
      pts.push([c[0] + t * halfW, f + y, c[2] - halfL + 1, 1], [c[0] + t * halfW, f + y, c[2] + halfL - 1, 1]);
    }
    for (const l of cand) l.score = lampScore(l, pts);
    cand.sort((a, b) => b.score - a.score);
    const lamps = new THREE.Group();
    lamps.position.set(-o[0], -f, -o[2]);
    for (const l of cand.slice(0, MAX_LIGHTS)) {
      const col = new THREE.Color().setRGB(...(l.color || [1, 1, 1]));
      const I = l.intensity * HALL_LIGHT_SCALE, dist = l.radius || 0;
      let light;
      if (aimed(l)) {
        const spot = l.type === 'spot';
        light = new THREE.SpotLight(col, I, dist, spot ? Math.min(89, (l.angle || 60) / 2) * DEG : AREA_HALF, spot ? 0.5 : 1, 2);
        const p = spot ? l.pos : l.pos.map((v, i) => v + l.dir[i] * AREA_OFFSET);
        light.position.set(...p);
        light.target.position.set(p[0] + l.dir[0], p[1] + l.dir[1], p[2] + l.dir[2]);
        lamps.add(light.target);
      } else {
        light = new THREE.PointLight(col, I, dist, 2);
        light.position.set(...l.pos);
      }
      light.userData.base = { I, dist };
      light.userData.src = l;
      lamps.add(light);
    }
    // Den Schatten unter dem Schiff werfen die Spots, die die Plattform am
    // stärksten treffen, nicht mehr das Bühnenlicht: Er fällt wie im Spiel
    // von der Decke. Einer allein reicht nicht, die übrigen Lampen und das
    // Streulicht der hellen Halle hellen ihn sonst fast ganz auf.
    const pad = [[o[0], f + 0.2, o[2], 1]];
    shadowLamps = lamps.children
      .filter((q) => q.isSpotLight && q.userData.src.type === 'spot')
      .map((q) => [q, lampScore(q.userData.src, pad)]).filter(([, sc]) => sc > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, SHADOW_LAMPS).map(([q]) => q);
    for (const L of shadowLamps) {
      L.castShadow = true;
      L.shadow.mapSize.setScalar(SHADOW_SIZE);
      L.shadow.bias = -0.0004;
      L.shadow.normalBias = 0.04;
    }
    hallRoot.add(lamps);
    if (!hallRoot.parent) scene.add(hallRoot);
    hallLamps = lamps;
    // Die übrigen als Lichtgitter, ohne die echten und ihre Gruppen
    const lit = new Set(cand.slice(0, MAX_LIGHTS).flatMap((l) => l.m || [l]));
    const t0 = performance.now();
    const vol = await buildHallVolume(all.filter((l) => !lit.has(l)), h.room, f, slicer(12, nextTask));
    // in Häppchen gerechnet: scheiterte die Halle derweil, bleibt die gebaute samt Bühnenlicht
    if (hallFailed) { vol.a.dispose(); vol.b.dispose(); return false; }
    hallVol.a.value = vol.a; hallVol.b.value = vol.b;
    // Ecke im Modellraum merken: Die Halle verschiebt Lampen und Gitter beim
    // Einhängen um ihre eigene Lage (ohne floor im Manifest gelotet)
    hallVol.at = vol.min;
    hallVol.min.value.fromArray(vol.min).add(lamps.position);
    hallVol.res.value.set(...vol.res);
    hallVol.on.value = 1;
    console.info(`[hangar] Lichtgitter ${vol.res.join('x')} aus ${vol.used} Spiellampen, ${Math.round(performance.now() - t0)} ms`);
    // Das Bühnenlicht geht ganz: Auf null gedreht stünde es weiter in jedem
    // Shader und kostete jedes Pixel.
    scene.remove(key, rim, fill, doorLight);
    scaleLamps();
    hallStage();
    const n = lamps.children.filter((q) => q.isLight).length;
    console.info(`[hangar] ${n} Lampen aus ${all.length} Spiellampen (${cand.length} nach Gruppierung) gesetzt`);
    return true;
  }

  // Ohne Halle keine Hallenlampen: Das Bühnenlicht der gebauten Halle kehrt zurück.
  function dropHallLamps() {
    if (!hallLamps) return;
    hallLamps.removeFromParent();
    hallLamps = null; shadowLamps = [];
    scene.add(key, rim, fill, doorLight);
  }

  // Lampen wachsen mit der Halle: Reichweite mal k, Stärke mal k², damit die
  // Beleuchtungsstärke (I/d²) bei jedem Maßstab gleich bleibt.
  function scaleLamps() {
    if (!hallLamps) return;
    const k = hallRoot.scale.x;
    for (const q of hallLamps.children) if (q.isLight) { q.intensity = q.userData.base.I * k * k; q.distance = q.userData.base.dist * k; }
    // Schattenkegel nur so weit, dass er das Schiff deckt: Der volle Kegel
    // des Spiels (bis 150°) gäbe einen groben, verwaschenen Schatten.
    hallRoot.updateMatrixWorld(true);
    for (const L of shadowLamps) {
      const p = L.getWorldPosition(new THREE.Vector3());
      const axis = L.target.getWorldPosition(new THREE.Vector3()).sub(p).normalize();
      const toPad = p.clone().negate(), d = toPad.length();
      const off = Math.acos(THREE.MathUtils.clamp(axis.dot(toPad.normalize()), -1, 1));
      L.shadow.focus = THREE.MathUtils.clamp((off + Math.atan((span * 0.6 + 2) / d)) / L.angle, 0.05, 1);
      L.shadow.camera.near = Math.max(0.5, d * 0.5);
      L.shadow.camera.updateProjectionMatrix();
    }
    renderHallShadows();
  }

  // Tiefenkarten der stillstehenden Halle aus den Schattenstrahlern (hallStat).
  // Ohne Schiff, Crew, Glas und alles Durchscheinende der Szene (auch das
  // Glas der Möbeldatei: Die Scheiben hoch an den Seitenwänden warfen sonst
  // Keile auf die Wand). Die ersten 2 m vor der Lampe fehlen, sonst läge
  // alles im Schatten ihrer eigenen Leuchte. Der Kegel reicht nur so weit,
  // wie der Strahler den Boden der Halle trifft (am Rand des Spielkegels von
  // 150° wäre die Karte zu grob). Die Decke (oberhalb von 70 % der
  // Hallenhöhe) wirft keinen Schatten: Ihr Rand schattete das obere Drittel
  // der Seitenwände in harten Keilen ab, die ohne das Streulicht der weißen
  // Halle viel zu dunkel blieben.
  const HALL_STAT_SIZE = SHADOW_SIZE, HALL_STAT_NEAR = 2, HALL_STAT_TOP = 0.7;
  const statRT = [], statCam = new THREE.PerspectiveCamera(90, 1, 1, 100);
  const statClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  // Versatz nach Neigung: Flächen, die das Licht streifend trifft (die großen
  // oberen Wandpaneele, Planen der Kisten), schatteten sich sonst selbst in
  // feinen Bogenmustern ab.
  const statMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, clippingPlanes: [statClip],
    polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const statBias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const statTarget = (size) => {
    const rt = new THREE.WebGLRenderTarget(size, size, { format: THREE.RedFormat });
    rt.depthTexture = new THREE.DepthTexture(size, size);
    rt.depthTexture.compareFunction = THREE.LessEqualCompare;
    rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.LinearFilter;
    return rt;
  };
  let statK = 0;
  function renderHallShadows() {
    const k = hallRoot.scale.x;
    if (!realHall?.model || !hallLamps || statK === k) return;
    statK = k;
    const t0 = performance.now();
    const lamps = hallLamps.children.filter((q) => shadowLamps.includes(q)).slice(0, 2);
    const { center: c, halfW, halfL, height } = realHall.room, f = realHall.floorY, o = realHall.spot;
    statClip.constant = (c[1] - f + HALL_STAT_TOP * height) * k;
    const corners = [];
    for (const x of [-halfW, halfW]) for (const z of [-halfL, halfL]) corners.push(new THREE.Vector3((c[0] - o[0] + x) * k, (c[1] - f) * k, (c[2] - o[2] + z) * k));
    const hide = [current?.group, leaving?.group, life.root].filter((o) => o && o.visible);
    const clear = (m) => m.transparent || m.transmission > 0 || /glass/i.test(m.name) || m.userData.workDecal;
    scene.traverse((o) => {
      if (o.visible && ((o.isMesh && [].concat(o.material).some(clear)) || o.isPoints || o.isLine || o.isSprite)) hide.push(o);
    });
    // Ohne das Schiffsfeld: Unter der offenen Luke, wenn es abgefahren ist,
    // leuchten die Strahler darüber hinein. In Ruhelage fehlt ihm nur der
    // Schatten seiner eigenen 2 cm hohen Leisten.
    if (realHall.lift?.visible) hide.push(realHall.lift);
    // das Gerät am Schiff steht je Schiff anders: keine festen Schatten
    if (realHall.dienst?.group.visible) hide.push(realHall.dienst.group);
    if (realHall.shaft?.pit.visible) hide.push(realHall.shaft.pit);
    if (realHall.shaft?.edge?.visible) hide.push(realHall.shaft.edge);
    // Auch das Tor nicht: Wächst die Halle (großes Schiff), kommen die Karten
    // beim Tausch unter geschlossenem Tor neu. Es lag dann als Deckel in
    // ihnen, das Feld fuhr in dessen Schatten herauf und wurde erst beim
    // Einrasten hell (Gladius -> Carrack, ein Bild).
    if (realHall.shaft?.gate?.group.visible) hide.push(realHall.shaft.gate.group);
    for (const o of hide) o.visible = false;
    const bg = scene.background, shadowUpd = renderer.shadowMap.needsUpdate, clip = renderer.localClippingEnabled;
    scene.background = null; scene.overrideMaterial = statMat;
    renderer.shadowMap.needsUpdate = false; renderer.localClippingEnabled = true;
    const p = new THREE.Vector3(), t = new THREE.Vector3(), d = new THREE.Vector3(), K = new THREE.Matrix4().makeScale(k, k, k);
    lamps.forEach((L, i) => {
      L.getWorldPosition(p); L.target.getWorldPosition(t);
      d.subVectors(t, p).normalize();
      let half = 0;
      for (const q of corners) half = Math.max(half, d.angleTo(q.clone().sub(p)));
      half = Math.min(half + 2 * DEG, L.angle, 75 * DEG);
      statCam.fov = 2 * half / DEG; statCam.near = HALL_STAT_NEAR * k; statCam.far = Math.max(L.distance || 0, 150 * k);
      statCam.position.copy(p);
      statCam.up.set(0, 1, 0);
      if (Math.abs(d.y) > 0.99) statCam.up.set(0, 0, -1);
      statCam.lookAt(t);
      statCam.updateProjectionMatrix(); statCam.updateMatrixWorld();
      const rt = statRT[i] ??= statTarget(HALL_STAT_SIZE);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, statCam);
      hallStat.map[i].value = rt.depthTexture;
      hallStat.mat[i].value.copy(statBias).multiply(statCam.projectionMatrix).multiply(statCam.matrixWorldInverse).multiply(K);
    });
    renderer.setRenderTarget(null);
    scene.background = bg; scene.overrideMaterial = null;
    renderer.shadowMap.needsUpdate = shadowUpd; renderer.localClippingEnabled = clip;
    for (const o of hide) o.visible = true;
    hallStat.n.value = lamps.length;
    console.info(`[hangar] Hallenschatten aus ${lamps.length} Strahlern (${HALL_STAT_SIZE}², ${Math.round(performance.now() - t0)} ms)`);
  }

  // Licht in der echten Halle. Mit Spiellampen gibt es kein Bühnenlicht
  // mehr (loadHallLights nimmt es aus der Szene): Raum- und Schattenlicht
  // kommen von den Lampen, das Streulicht aus der Umgebungskugel, die
  // Halbkugel hellt nur noch neutral auf. Ohne Lampen bleibt das
  // Bühnenlicht; das warme Gegenlicht dann nur als Kante, sonst legt es eine
  // orange Pfütze vor den Bug.
  const HALL_KEY = 8, HALL_HEMI = 0.35, HALL_HEMI_WITH_ENV = 0.12;
  function hallStage() {
    if (!realHall) return;
    const env = !!realHall.envOn;
    if (hallLamps) {
      hemi.color.set(0xffffff); hemi.groundColor.set(0x9a9a9a);
      hemi.intensity = env ? HALL_HEMI_WITH_ENV : HALL_HEMI * 0.5;
      return;
    }
    hemi.intensity = env ? HALL_HEMI_WITH_ENV : HALL_HEMI;
    key.intensity = HALL_KEY;
    key.castShadow = true;
    rim.intensity = 3;
    fill.intensity = 0.2;
    doorLight.intensity = 0.3;
  }

  // Spiegelungen und Umgebungslicht aus der echten Halle: eine Umgebungskugel
  // über der Plattform aus der leeren Halle gerendert, wie die
  // Reflexionssonden im Spiel. Ersetzt die Ersatzhalle als Umgebung.
  // Einmal genügt: Halle und Lampen wachsen mit demselben Faktor (Stärke mal
  // k², siehe scaleLamps), die Kugel von 2,5 m · k aus bleibt dieselbe.
  // Beim Aufnehmen bleiben Nebel und Umgebung eingeschaltet (der Nebel weit
  // weg, als Umgebung die feste Ersatzkugel gleicher Größe), sonst bräuchte
  // die Aufnahme für jedes Hallenmaterial ein eigenes Shaderprogramm, das
  // mitten im Laden übersetzt wird; die Hallenmaterialien spiegeln dabei
  // kaum (0,05), es schaukelt sich nichts auf.
  // Die Kugel trägt damit nur das direkte Licht der sechs Lampen; dass die
  // weiße Halle es mehrfach zurückwirft und im Spiel 350 weitere Lampen
  // brennen, gleicht die volle Stärke aus (am Render: 0,8 ließ Wände und
  // Decke grau, darüber verflacht das Bild wieder).
  const HALL_ENV = 1;      // envMapIntensity der Hallenmaterialien mit Sonde
  let hallEnv = null;
  // Die Umgebung hängt an jedem Hallenmaterial selbst, nicht nur an der
  // Szene: three nimmt für Materialien ohne eigene envMap die Stärke aus
  // scene.environmentIntensity und übergeht envMapIntensity (r185,
  // WebGLRenderer.setProgram). Dieselbe Kugel wie scene.environment, also
  // dasselbe Shaderprogramm.
  const setHallEnv = (tex) => { for (const m of realHall.mats) if (m.isMeshStandardMaterial) m.envMap = tex; };
  function captureHallEnv(force = false) {
    if (!realHall || !HALL_PROBE) return;
    if (hallEnv && !force) return;
    const k = hallRoot.scale.x;
    const hide = [current?.group, leaving?.group, life.root].filter((o) => o && o.visible);
    for (const o of hide) o.visible = false;
    const fog = scene.fog, { near, far } = fog;
    fog.near = 1e7; fog.far = 2e7;
    // die Kugel ohne Spiegelbild des Schiffs (es ist ausgeblendet, das Bild noch vom letzten Mal)
    const reflOn = hallRefl.on.value;
    hallRefl.on.value = 0;
    const gain = new Map();
    for (const m of realHall.mats) { gain.set(m, m.envMapIntensity); m.envMapIntensity = Math.min(m.envMapIntensity, 0.05); }
    scene.environment = envRT.texture;
    setHallEnv(envRT.texture);
    const pm = new THREE.PMREMGenerator(renderer);
    // Schatten ohne Schiff und Crew, wie die Aufnahme sie sieht
    renderer.shadowMap.needsUpdate = true;
    const rt = pm.fromScene(scene, 0, 0.1, Math.max(realHall.room.halfL, realHall.room.height) * k * 4, { size: 256, position: new THREE.Vector3(0, 2.5 * k, 0) });
    pm.dispose();
    // Die Karten sind jetzt die ohne Schiff: im nächsten Bild neu
    shadowSig = '';
    fog.near = near; fog.far = far;
    for (const [m, g] of gain) m.envMapIntensity = g;
    hallRefl.on.value = reflOn;
    for (const o of hide) o.visible = true;
    hallEnv?.dispose();
    hallEnv = rt;
    scene.environment = rt.texture;
    setHallEnv(rt.texture);
    const { center: c, halfW, halfL, height } = realHall.room, f = realHall.floorY, o = realHall.spot;
    hallBox.min.value.set(c[0] - o[0] - halfW, c[1] - f, c[2] - o[2] - halfL);
    hallBox.max.value.set(c[0] - o[0] + halfW, c[1] + height - f, c[2] - o[2] + halfL);
    hallBox.pos.value.set(0, 2.5, 0);
    hallBox.on.value = 1;
    if (!realHall.envOn) {
      realHall.envOn = true;
      for (const m of realHall.mats) m.envMapIntensity = HALL_ENV * (m.userData.envGain ?? 1);
      hallStage();
    }
  }

  // Spiegelungssonde aus dem Spiel (<halle>.probes.json und Equirect-HDR,
  // PC-Lauf „Hallensonden“): im Spiel mit allen Lampen der Halle aufgenommen,
  // nicht nur mit den sechs, die hier brennen. Genommen wird die Sonde, deren
  // Box die Plattform enthält (sonst die nächste); sie ersetzt die selbst
  // aufgenommene Kugel. Fehlt sie, bleibt es bei der Aufnahme.
  // PROBE_GAIN: Helligkeit der Sonde gegen die Lampen, die mit
  // HALL_LIGHT_SCALE laufen; am Render abzugleichen, sobald es sie gibt.
  const PROBE_GAIN = 1;
  async function loadHallProbe(h) {
    if (!HALL_PROBE || !h?.probes) return null;
    try {
      const r = await fetch(h.probes);
      if (!r.ok) return null;
      const list = ((await r.json()).probes || []).filter((p) => p.spec && Array.isArray(p.pos));
      if (!list.length) return null;
      const c = h.room.center, f = Number.isFinite(h.floor) ? h.floor : c[1], o = hallSpot(h);
      const pad = [o[0], f + 2.5, o[2]];
      const d2 = (p) => p.pos.reduce((q, v, i) => q + (v - pad[i]) ** 2, 0);
      const holds = (p) => Array.isArray(p.box) && p.pos.every((v, i) => Math.abs(pad[i] - v) <= p.box[i]);
      const pick = [...list].sort((a, b) => (holds(b) - holds(a)) || ((b.priority ?? 0) - (a.priority ?? 0)) || (d2(a) - d2(b)))[0];
      const u = new URL(h.probes, location.href);
      const { HDRLoader } = await import('three/addons/loaders/HDRLoader.js');
      const tex = await new HDRLoader().loadAsync(u.pathname.replace(/\.json$/, '/') + pick.spec + u.search);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return { tex, name: pick.name };
    } catch (e) {
      console.warn('[hangar] Sonde nicht geladen', e);
      return null;
    }
  }
  // Über eine Hilfsszene mit der Sonde als Hintergrund, nicht über
  // fromEquirectangular: Dort hinge die Größe der Kugel an der Bildbreite,
  // eine andere als 256 übersetzte jedes Material neu.
  function useHallProbe({ tex, name }) {
    const sky = new THREE.Scene();
    sky.background = tex;
    sky.backgroundIntensity = PROBE_GAIN;
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(sky, 0, 0.1, 10, { size: 256 });
    pm.dispose();
    tex.dispose();
    hallEnv?.dispose();
    hallEnv = rt;
    scene.environment = rt.texture;
    setHallEnv(rt.texture);
    hallBox.on.value = 0;
    realHall.envOn = true;
    realHall.probe = name;
    for (const m of realHall.mats) m.envMapIntensity = HALL_ENV * (m.userData.envGain ?? 1);
    hallStage();
    console.info(`[hangar] Spiegelungssonde ${name} aus dem Spiel`);
  }

  // Rauheit nur nach unten begrenzen: spiegelglatte Stellen bündeln das
  // Hauptlicht sonst zu einem gleißenden Fleck vor dem Schiff (die Lampen
  // sind Punkte, im Spiel haben sie eine Fläche). Für das Licht der Lampen
  // gilt die Grenze überall. Die Spiegelung der Halle darf auf dem Boden so
  // glatt werden, wie das Spiel ihn angibt: Bodenplatten, gepunktete Platten
  // und Holzstege sind dort glatter Lack (Glätte 225 bis 249 von 255, also
  // Rauheit 0,02 bis 0,12; PC-Befund 2026-10-12 in
  // .planning/notes/hallen-relief.md). Ein Relief haben sie im Spiel nicht,
  // ihre Tiefe kommt aus der Spiegelung. Die Spiegelgrenze von 0,1 hält die
  // kleinen Deckenleuchten als weiche Lichtflecken statt als Funkeln. Für
  // alle Hallenmaterialien derselbe Shader und derselbe Schlüssel, damit
  // sie sich ihre Shaderprogramme teilen (ohne echte Karte greift die Grenze
  // nie: deren Rauheit liegt ohnehin darüber).
  const HALL_ROUGH_MIN = 0.34, HALL_GLOSS_MIN = 0.1;
  const HALL_GLOSS = /mtl_(metal_white_03|metal_dotty_01_016|wood_largeplank_020)$/i;
  // Spiegelungen heller als das: Leuchten in der Umgebungskugel. Gekappt,
  // sonst glüht jede einzelne auf glattem Boden als Stern auf.
  const HALL_ENV_MAX = 2;
  //
  // Dazu ohne sichtbare Wiederholung: Die Schmutzkarte der großen Flächen
  // kachelt im Spiel alle 4 m, zweimal je 8-m-Wandpaneel, und jedes Paneel
  // zeigte dieselben Flecken an denselben Stellen. Hier wird dieselbe
  // Karte je Stelle der Halle anders versetzt abgetastet (Quilez, „texture
  // repetition“, Variante 3): zwei Abtastungen, gewählt und überblendet nach
  // einem weichen Rauschen über die Lage im Modell. Kein neues Bild, nur
  // andere Versätze. Schalter je Material (hgNoTile), damit alle Materialien
  // bei einem Programm bleiben.
  const HALL_NO_TILE = /plastic_white01|metal_white_0[23]|wall_(white|blue)_tint|wall_whitepaint|metal_dotty/i;
  // Rauschzelle in Modellmetern; über eine Zelle wechselt der Versatz einige
  // Male, also mehrmals je 8-m-Paneel (am Render: mit 16 m standen auf
  // Nachbarpaneelen oft noch dieselben Flecken).
  const HALL_NO_TILE_CELL = 8;
  const HALL_NO_TILE_GLSL = `uniform float hgNoTile;
varying vec3 vHgP;
float hgHash( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
float hgNoise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( hgHash( i ), hgHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( hgHash( i + vec3( 0.0, 1.0, 0.0 ) ), hgHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
		mix( mix( hgHash( i + vec3( 0.0, 0.0, 1.0 ) ), hgHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( hgHash( i + vec3( 0.0, 1.0, 1.0 ) ), hgHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}
varying vec3 vHgN;
vec4 hgNoTileSample( sampler2D s, vec2 uv ) {
	float l = hgNoise( vHgN / ${HALL_NO_TILE_CELL.toFixed(1)} ) * 8.0;
	float ia = floor( l ), f = fract( l );
	vec2 oa = sin( vec2( 3.0, 7.0 ) * ia ), ob = sin( vec2( 3.0, 7.0 ) * ( ia + 1.0 ) );
	vec2 dx = dFdx( uv ), dy = dFdy( uv );
	vec4 a = textureGrad( s, uv + oa, dx, dy ), b = textureGrad( s, uv + ob, dx, dy );
	return mix( a, b, smoothstep( 0.2, 0.8, f - 0.1 * dot( a.rgb - b.rgb, vec3( 1.0 ) ) ) );
}
uniform highp sampler3D hgVolA, hgVolB;
uniform vec3 hgVolMin, hgVolRes;
uniform float hgVolInv, hgVolOn;
// Lichtgitter (buildHallVolume): eine halbe Zelle vor der Fläche gelesen,
// je Achse die Seite, in die die Normale zeigt, gewichtet mit n².
vec3 hgVolume( vec3 p, vec3 n ) {
	vec3 uvw = ( ( p + n * ( 0.5 / hgVolInv ) - hgVolMin ) * hgVolInv + 0.5 ) / hgVolRes;
	vec4 a = texture( hgVolA, uvw ), b = texture( hgVolB, uvw );
	vec3 q = n * n;
	float l = q.x * ( n.x > 0.0 ? a.x : a.y ) + q.y * ( n.y > 0.0 ? a.z : a.w ) + q.z * ( n.z > 0.0 ? b.x : b.y );
	return l * vec3( b.z, ( 1.0 - 0.2126 * b.z - 0.0722 * b.w ) / 0.7152, b.w );
}`;
  // Lage im Hallenmodell: Welt durch k. Die Knoten der Halle haben je eigene
  // Achsen, gleiche Teile in zwei Knoten bekämen im Knotenraum dasselbe
  // Rauschen. Ein Wert für alle Hallenmaterialien, scaleWorld setzt ihn.
  const hallNoTileInvK = { value: 1 };
  // Nische unter dem Hallenboden rund um die Öffnung (Torschlitz): x, z
  // halbe Feldmaße, z an, w Sohle der Nische (Modellmeter, Feldmitte 0)
  const hallPocket = { value: new THREE.Vector4(0, 0, 0, 0) };
  // Ausgesparter Hallenboden unter dem Rand (buildRand): innen halbe
  // Feldmaße, außen halbe Maße bis zur Außenkante des Stegs (Modellmeter,
  // Feldmitte 0); z = 0: aus. Nur die Materialien der Halle (userData.cut):
  // alles bis 4,5 cm über dem Boden (die Fasen der Bodenplatten reichen bis
  // 3,9 cm hinauf und lägen sonst als Strichlinien auf dem Steg) und ihre
  // waagrechten Flächen bis 6 cm; was auf dem Boden steht, bleibt darüber.
  const hallCut = { value: new THREE.Vector4(0, 0, 0, 0) };
  const HALL_CUT_GLSL = `uniform vec4 hgCut;
uniform float hgCutOn;
void hgCutOut( vec3 p ) {
	if ( hgCutOn < 0.5 || hgCut.z <= 0.0 || p.y > 0.06 || p.y < -0.3 ) return;
	vec2 q = abs( p.xz );
	if ( q.x > hgCut.z || q.y > hgCut.w || ( q.x < hgCut.x && q.y < hgCut.y ) ) return;
	vec3 fn = cross( dFdx( p ), dFdy( p ) );
	if ( p.y < 0.045 || abs( fn.y ) > 0.9 * length( fn ) ) discard;
}`;
  // In den Tiefenkarten der Halle (statMat) fehlt der Boden dort ebenso,
  // sonst läge der Steg im Schatten eines Bodens, den man nicht mehr sieht
  statMat.onBeforeCompile = (sh) => {
    sh.uniforms.hgInvK = hallNoTileInvK; sh.uniforms.hgCut = hallCut; sh.uniforms.hgCutOn = { value: 1 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float hgInvK;\nvarying vec3 vHgP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 hgPos = vec4( position, 1.0 );\n#ifdef USE_BATCHING\nhgPos = batchingMatrix * hgPos;\n#endif\n#ifdef USE_INSTANCING\nhgPos = instanceMatrix * hgPos;\n#endif\nvHgP = ( modelMatrix * hgPos ).xyz * hgInvK;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHgP;\n' + HALL_CUT_GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\thgCutOut( vHgP );');
  };
  const HALL_POCKET_GLSL = `uniform vec4 hgPocket;
// Unter dem Boden hinter der Schachtwand fällt kaum Licht hinein: in der
// Nische nach hinten dunkel (nicht schwarz, sonst liest sie sich als Loch),
// so kommt das Tor aus einem dunklen Schlitz.
// Hinter der Rückwand der Nische (SHAFT_POCKET[2]) keine Wirkung mehr.
float hgPocketK( vec3 p ) {
	if ( hgPocket.z < 0.5 || p.y > -0.08 || p.y < hgPocket.w ) return 1.0;
	float d = max( abs( p.x ) - hgPocket.x, abs( p.z ) - hgPocket.y );
	return d > ${SHAFT_POCKET[2].toFixed(2)} ? 1.0 : mix( 1.0, ${SHAFT_POCKET[3].toFixed(2)}, smoothstep( ${SHAFT_POCKET[0].toFixed(2)}, ${SHAFT_POCKET[1].toFixed(2)}, d ) );
}`;
  // Weg des Aufzugs (Modellmeter): Die Materialien des Schiffsfelds ziehen
  // ihn für das Rauschen ab, damit das Plattenbild mitfährt statt unterwegs
  // zu wechseln; alle übrigen lesen 0.
  const hallLiftY = { value: 0 }, hallLiftNo = { value: 0 };
  // Lampen des Aufzugsschachts (shaftLights, pitPack): je Lampe drei vec4
  // im Shader von Schacht und Feld, gerechnet nur unter dem Boden und nur
  // solange das Feld abgefahren ist (hgPitK.x > 0). Wie viele, gibt der Platz
  // für Uniforms her: Das Hallenprogramm belegt 145 Vektoren (Ecken- und
  // Pixelshader zusammen gezählt am übersetzten Programm, Stufe hoch,
  // 16.10.2026), die Lichtregie (hgSh*) nach ihren Deklarationen 8 dazu;
  // Telefone haben oft nur 256, dort bleiben so 22 Lampen und 37 Vektoren
  // Luft. Je Bildpunkt im Schacht kostet jede Lampe; darum hoch 29 (alle
  // Fluter, Warnlichter, die seitlichen der Plattform, die Bodenstrahler
  // paarweise), mittel 20, niedrig 10.
  const PIT_N = Math.max(0, Math.min(Q0 === 'niedrig' ? 10 : Q0 === 'mittel' ? 20 : 29, Math.floor((renderer.capabilities.maxFragmentUniforms - 190) / 3)));
  const hallPit = {
    a: { value: Array.from({ length: Math.max(1, PIT_N) }, () => new THREE.Vector4()) },   // Lage, 1/r²
    b: { value: Array.from({ length: Math.max(1, PIT_N) }, () => new THREE.Vector4()) },   // Richtung, cos halber Kegel (-2: rundum)
    c: { value: Array.from({ length: Math.max(1, PIT_N) }, () => new THREE.Vector4()) },   // Farbe mal Stärke, Art (shaftLights)
    k: { value: new THREE.Vector3() },       // x an (0..1), y Weg der Plattform (Modellmeter)
    blink: { value: new THREE.Vector2(1, 1) },   // Warnlicht am Schacht, an der Plattform
    field: 0,   // so viele Lampen vorn treffen auch das Feld (pitPack); steht vor dem Übersetzen fest
  };
  // Wie pitLight; pads 0: ohne die Lampen der Plattform und die nur für
  // Wände (das Feld selbst, das ohnehin nur die vorderen HG_PIT_C rechnet)
  const HALL_PIT_GLSL = `uniform vec4 hgPitA[ HG_PIT_N ];
uniform vec4 hgPitB[ HG_PIT_N ];
uniform vec4 hgPitC[ HG_PIT_N ];
uniform vec3 hgPitK;
uniform vec2 hgPitBlink;
vec3 hgPit( vec3 p, vec3 n, float pads ) {
	vec3 sum = vec3( 0.0 );
	for ( int i = 0; i < HG_PIT_C; i ++ ) {
		vec4 c = hgPitC[ i ];
		float walls = step( 3.5, c.w ), kd = c.w - 4.0 * walls, pad = step( 1.5, kd );
		if ( max( pad, walls ) > pads ) continue;
		vec4 a = hgPitA[ i ], b = hgPitB[ i ];
		vec3 d = a.xyz + vec3( 0.0, pad * hgPitK.y, 0.0 ) - p;
		float d2 = dot( d, d ), q = d2 * a.w;
		if ( q >= 1.0 ) continue;
		float w = 1.0 - q * q;
		vec3 l = d * inversesqrt( max( d2, 1e-4 ) );
		float cone = b.w < -1.0 ? 1.0 : smoothstep( b.w, b.w + ( 1.0 - b.w ) * 0.7, dot( -l, b.xyz ) );
		float k = kd - 2.0 * pad < 0.5 ? 1.0 : ( pad > 0.5 ? hgPitBlink.y : hgPitBlink.x );
		sum += c.rgb * ( k * cone * w * w / ( d2 + 9.0 ) * max( dot( n, l ), 0.0 ) );
	}
	return sum * hgPitK.x;
}`;
  // Lichtregie (SHAFT_*): Grundlicht, Lauflicht und Dunst im Schacht, nur
  // während der Fahrt (hgPitK.x). Lage p im Schachtraum wie hgPit.
  const hallShaft = {
    a: { value: new THREE.Vector4() },   // hx, hz, Tiefe des Spielschachts (depth0), Grundlicht
    b: { value: new THREE.Vector4() },   // Dunstfarbe (linear), Dunst je m überall
    c: { value: new THREE.Vector4() },   // Lauflicht Farbe mal Stärke, Takt der Warnlichter
    d: { value: new THREE.Vector4() },   // Warnorange im Dunst, Dunst höchstens
    e: { value: new THREE.Vector4(1, 0, 0, 0) },   // 1/Abstand der Lauflichter (geht rundum auf), Weg, Helligkeit des Dunsts, Kantenlicht
    f: { value: new THREE.Vector4() },   // Schachtlampen auf dem Feld, frei; Dunstschicht: je m, Höhe
    g: { value: new THREE.Vector4() },   // Hallenlicht aus der Öffnung (rgb), Grundlicht aufs Feld
    beam: { value: new THREE.Vector4() },   // Kegel und Lichthöfe: an, Plattform (y), Stärke der Kegel, frei
  };
  const HALL_SHAFT_GLSL = `uniform vec4 hgShA, hgShB, hgShC, hgShD, hgShE, hgShF, hgShG;
uniform float hgShInvK;
// Lage entlang der Schachtwände, rundum (Ostwand, Nord, West, Süd)
float hgShS( vec2 q ) {
	float hx = hgShA.x, hz = hgShA.y;
	if ( abs( q.x ) * hz > abs( q.y ) * hx ) return q.x > 0.0 ? q.y + hz : 3.0 * hz + 2.0 * hx - q.y;
	return q.y > 0.0 ? 2.0 * hz + hx - q.x : 4.0 * hz + 3.0 * hx + q.x;
}
// Licht im Schacht ohne die Lampen: Grundlicht von oben warm (nimmt mit der
// Tiefe ab), von unten blau (nimmt zu), je nach Normale n; über der
// Plattform ihr Schein an den Wänden, darin das Lauflicht
vec3 hgShLight( vec3 p, vec3 n, float walls ) {
	float deep = clamp( -p.y / hgShA.z, 0.0, 1.0 ), up = 0.5 + 0.5 * n.y, top = 1.0 - deep;
	vec3 fill = ( hgShG.rgb * ( up * top * top ) + hgShB.rgb * ( ( 1.0 - 0.7 * up ) * ( 0.3 + 0.7 * deep ) ) ) * hgShA.w;
	float h = p.y - hgPitK.y, hb = h - 1.6;
	float glow = exp( - max( h, 0.0 ) / 6.0 ) * step( -0.5, h );
	// max: ein Kosinus knapp unter -1 machte pow sonst zu NaN
	float run = pow( max( 0.5 + 0.5 * cos( 6.2832 * ( hgShS( p.xz ) - hgShE.y ) * hgShE.x ), 0.0 ), 6.0 );
	return ( fill * mix( hgShG.w, 1.0, walls ) + walls * hgShC.rgb * ( 0.1 * glow + exp( - hb * hb * 0.5 ) * ( 0.15 + run ) ) ) * hgPitK.x;
}
// Kantenlicht: Flächen, die schräg zum Blick stehen, spiegeln den hellen
// Dunst (Fresnel, ohne Lampen), so zeichnen sich Rippen und Kanten der
// dunklen Wände ab; tiefer etwas stärker
vec3 hgShRim( vec3 p, vec3 n ) {
	float f = 1.0 - max( dot( n, normalize( cameraPosition * hgShInvK - p ) ), 0.0 );
	return hgShB.rgb * ( f * f * f * hgShE.w * ( 0.5 + 0.5 * clamp( -p.y / hgShA.z, 0.0, 1.0 ) ) * hgPitK.x );
}
// Dunst auf dem Blickweg unter dem Hallenboden: dünn überall, dazu eine
// Schicht über der Plattform, nach oben exp(-Höhe/H) (geschlossen
// integriert, eine Rechnung je Bildpunkt)
vec3 hgShHaze( vec3 col, vec3 p ) {
	vec3 c = cameraPosition * hgShInvK;
	float y0 = min( c.y, 0.0 ), len = length( p - c ) * ( c.y > 0.0 ? clamp( -p.y / max( c.y - p.y, 1e-3 ), 0.0, 1.0 ) : 1.0 );
	float H = hgShF.w, yp = hgPitK.y, dy = abs( y0 - p.y );
	float e0 = exp( - max( y0 - yp, 0.0 ) / H ), e1 = exp( - max( p.y - yp, 0.0 ) / H );
	float layer = dy > 0.05 ? len * H * abs( e1 - e0 ) / dy : len * e1;
	float a = ( 1.0 - exp( - len * hgShB.w - layer * hgShF.z ) ) * hgShD.w * hgPitK.x;
	return mix( col, hgShB.rgb * hgShE.z + hgShD.rgb * hgShC.w, a );
}`;
  // Lichtkegel der Fluter im Dunst und Lichthöfe um die Warnlampen: je ein
  // Mesh (zwei Zeichenbefehle), additiv, ohne Tiefe zu schreiben; im
  // Schachtraum unter sh.pit, also nur während der Fahrt. Kegel aus den
  // Flutern des Spiels (Lage und Richtung wie shaftLights, Paare vereint),
  // schmaler als ihr Lichtkegel: Im Dunst sieht man den hellen Kern.
  function shaftFx(sh, all, beams) {
    const out = [];
    const u = { hgBm: hallShaft.beam };
    if (beams) {
      const spots = pitPack(all.filter((q) => q.cosO > -1 && /^flood_(key|cool)/.test(q.role) && !(q.kind & 2)), 64).lights;
      const SEG = 18, pos = [], col = [], tt = [], idx = [];
      const d = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3();
      const wmax = Math.max(...spots.map((g) => lum(g.col)), 1e-6);
      for (const g of spots) {
        d.fromArray(g.dir).normalize();
        up.set(Math.abs(d.y) > 0.9 ? 1 : 0, Math.abs(d.y) > 0.9 ? 0 : 1, 0);
        a.crossVectors(d, up).normalize(); b.crossVectors(d, a).normalize();
        const half = Math.min(Math.acos(g.cosO), THREE.MathUtils.degToRad(13));
        // bis zum Grund des Spielschachts (depth0), höchstens 48 m: Die
        // steilen Fluter enden am Grund (34 bis 40 m), die flachen an der
        // Grenze. Ein für hohe Schiffe vertiefter Schacht (fit) lässt die
        // Kegel, wo sie sind; sie laufen zur Spitze ohnehin auf null aus
        const len = Math.min(d.y < -0.05 ? (g.pos[1] + sh.depth0) / -d.y : g.r * 0.4, g.r * 0.6, 48);
        const c = g.col.map((v) => v / Math.max(...g.col, 1e-6) * Math.sqrt(lum(g.col) / wmax));
        const o = pos.length / 3;
        for (const [t, r] of [[0, 0.25], [1, Math.tan(half) * len]]) {
          for (let i = 0; i < SEG; i++) {
            const w = (i / SEG) * Math.PI * 2, cs = Math.cos(w) * r, sn = Math.sin(w) * r;
            pos.push(g.pos[0] + d.x * len * t + a.x * cs + b.x * sn, g.pos[1] + d.y * len * t + a.y * cs + b.y * sn, g.pos[2] + d.z * len * t + a.z * cs + b.z * sn);
            col.push(...c); tt.push(t);
          }
        }
        for (let i = 0; i < SEG; i++) { const j = (i + 1) % SEG; idx.push(o + i, o + SEG + i, o + j, o + j, o + SEG + i, o + SEG + j); }
      }
      if (spots.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        geo.setAttribute('hgT', new THREE.Float32BufferAttribute(tt, 1));
        geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
        // vT begrenzt: Mit Kantenglättung wird der Wert am Rand des Dreiecks
        // fortgeschrieben und liegt an der Spitze über 1; pow einer negativen
        // Zahl ist NaN, und das schwärzte über den Schein das ganze Bild
        const mat = new THREE.ShaderMaterial({
          uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: `attribute vec3 color;
attribute float hgT;
varying vec3 vCol, vN, vV;
varying float vT, vY;
void main() {
	vec4 wp = modelMatrix * vec4( position, 1.0 );
	vCol = color; vT = hgT; vY = position.y;
	vN = normalize( mat3( modelMatrix ) * normal ); vV = cameraPosition - wp.xyz;
	gl_Position = projectionMatrix * viewMatrix * wp;
}`,
          fragmentShader: `uniform vec4 hgBm;
varying vec3 vCol, vN, vV;
varying float vT, vY;
void main() {
	float f = abs( dot( normalize( vN ), normalize( vV ) ) );
	float a = f * f * f * pow( clamp( 1.0 - vT, 0.0, 1.0 ), 1.6 ) * smoothstep( 0.0, 0.1, vT ) * smoothstep( 0.0, 5.0, vY - hgBm.y ) * hgBm.x * hgBm.z;
	gl_FragColor = vec4( max( vCol * a, 0.0 ), 1.0 );
}`,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'shaft:beams'; mesh.frustumCulled = false; mesh.renderOrder = 2;
        out.push(mesh);
      }
    }
    // Lichthöfe um die Warnlampen am Schacht (ihre Gehäuse bringt der
    // Bausatz mit); die orangen der Plattform nicht: Deren Gehäuse fehlen
    // dem Feld, ein Lichthof stünde dort auf blankem Boden
    const glow = all.filter((q) => (q.kind & 1) && !(q.kind & 2));
    if (glow.length) {
      const pos = [], off = [], idx = [];
      for (const q of glow) {
        const o = pos.length / 3;
        for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(...q.pos); off.push(x, y); }
        idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('hgO', new THREE.Float32BufferAttribute(off, 2));
      geo.setIndex(idx); geo.computeBoundingSphere();
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...u, hgBlink: hallPit.blink }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute vec2 hgO;
uniform vec2 hgBlink;
varying vec2 vO;
varying float vK;
void main() {
	vec4 mv = modelViewMatrix * vec4( position, 1.0 );
	mv.xy += hgO * ${(2.4).toFixed(1)} * length( modelMatrix[ 0 ].xyz );
	vO = hgO; vK = hgBlink.x;
	gl_Position = projectionMatrix * mv;
}`,
        fragmentShader: `uniform vec4 hgBm;
varying vec2 vO;
varying float vK;
void main() {
	float r2 = dot( vO, vO );
	float a = ( exp( - r2 * 5.0 ) * 0.5 + exp( - r2 * 40.0 ) ) * vK * hgBm.x;
	gl_FragColor = vec4( vec3( ${SHAFT_RUN.map((v) => v.toFixed(3)).join(', ')} ) * a, 1.0 );
}`,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'shaft:glow'; mesh.frustumCulled = false; mesh.renderOrder = 3;
      out.push(mesh);
    }
    return out;
  }
  // Trägt ein Schachtmaterial keine Texturkoordinaten (Bausatz vor
  // Schacht-Tiefe, 17.10.2026), gelten seine Karten mit ihrem Mittelwert
  // (oberste Mip-Stufe), so wie sie aus der Ferne wirken.
  const HG_MEAN = (t) => `textureLod( ${t}, vec2( 0.5 ), 16.0 )`;
  // Spiegelung auf den Raumkasten projiziert: Die Umgebungskugel ist an
  // einer Stelle aufgenommen (2,5 m über der Plattform). Ohne Projektion
  // spiegelt jede Platte dasselbe, als läge der Raum unendlich weit weg;
  // mit ihr trifft der Spiegelstrahl die Wand, die von der Platte aus dort
  // steht, und die Kugel wird in Richtung dieses Punkts gelesen. Kasten in
  // Modellmetern ab der Bodenmitte (wie vHgP), gesetzt von captureHallEnv.
  const hallBox = { on: { value: 0 }, min: { value: new THREE.Vector3() }, max: { value: new THREE.Vector3() }, pos: { value: new THREE.Vector3() } };
  // Spiegelbild des Schiffs im Boden: Die Umgebungskugel ist ohne es
  // aufgenommen, ein glatter Boden spiegelte sonst unter dem Schiff die
  // Wand dahinter. Im Spiel leistet das die Bildschirmspiegelung. Hier
  // zeichnet eine an der Bodenebene gespiegelte Kamera nur das Schiff in
  // ein halb so großes Bild (renderMirror); der Boden liest es dort, wo es
  // etwas zeigt, statt der Kugel. hallRefl.mat bildet einen Bodenpunkt im
  // Modellraum (vHgP) auf dieses Bild ab.
  const hallRefl = { tex: { value: null }, on: { value: 0 }, mat: { value: new THREE.Matrix4() } };
  const hallEnvMax = { value: HALL_ENV_MAX };
  // Schatten von Halle und Einrichtung aus den Deckenstrahlern, die auch den
  // Schatten des Schiffs werfen (renderHallShadows): je Strahler eine
  // Tiefenkarte, einmal je Hallenmaßstab gezeichnet, weil Halle und Möbel
  // stillstehen. Die Schattenkarten von three.js bleiben dem Schiff und der
  // Crew, eng um das Schiff; der Hallenshader nimmt für dieselben Strahler
  // zusätzlich diese Karten. hgStatMat bildet vHgP (Modellmeter) auf die
  // Karte ab.
  const hallStat = { n: { value: 0 }, map: [{ value: null }, { value: null }], mat: [{ value: new THREE.Matrix4() }, { value: new THREE.Matrix4() }] };
  // Ein leerer sampler2DShadow bindet bei three.js keine Textur, und jeder
  // Zeichenaufruf der Halle fällt aus (am Telefon, mit nur einem Strahler,
  // blieb sie schwarz). Bis zur Karte steht deshalb ein geleertes 1×1 da.
  const statEmpty = statTarget(1);
  renderer.setRenderTarget(statEmpty); renderer.clear(); renderer.setRenderTarget(null);
  hallStat.map[0].value = hallStat.map[1].value = statEmpty.depthTexture;
  const HALL_STAT_GLSL = `uniform float hgStatN;
uniform sampler2DShadow hgStat0, hgStat1;
uniform mat4 hgStatMat0, hgStatMat1;
float hgStatLook( sampler2DShadow m, mat4 M, vec3 p ) {
	vec4 c = M * vec4( p, 1.0 );
	if ( c.w <= 0.0 ) return 1.0;
	vec3 q = c.xyz / c.w;
	if ( any( lessThan( q, vec3( 0.0 ) ) ) || any( greaterThan( q, vec3( 1.0 ) ) ) ) return 1.0;
	vec2 t = 0.75 / vec2( textureSize( m, 0 ) );
	q.z -= 5e-5;
	return 0.25 * ( texture( m, vec3( q.xy - t, q.z ) ) + texture( m, vec3( q.xy + vec2( t.x, - t.y ), q.z ) )
		+ texture( m, vec3( q.xy + vec2( - t.x, t.y ), q.z ) ) + texture( m, vec3( q.xy + t, q.z ) ) );
}
float hgStatShadow( const in int i, const in vec3 wn ) {
	vec3 p = vHgP + wn * 0.06;
	if ( i == 0 ) return hgStatN > 0.5 ? hgStatLook( hgStat0, hgStatMat0, p ) : 1.0;
	return hgStatN > 1.5 ? hgStatLook( hgStat1, hgStatMat1, p ) : 1.0;
}`;
  const HALL_ENV_GLSL = `#ifdef USE_ENVMAP
uniform float hgBoxOn, hgEnvMax, hgReflOn;
uniform sampler2D hgRefl;
uniform mat4 hgReflMat;
uniform vec3 hgBoxMin, hgBoxMax, hgBoxPos;
vec3 hgBoxDir( vec3 d ) {
	vec3 q = vec3( abs( d.x ) < 1e-5 ? 1e-5 : d.x, abs( d.y ) < 1e-5 ? 1e-5 : d.y, abs( d.z ) < 1e-5 ? 1e-5 : d.z );
	vec3 tF = max( ( hgBoxMax - vHgP ) / q, ( hgBoxMin - vHgP ) / q );
	float t = min( min( tF.x, tF.y ), tF.z );
	return t > 0.0 ? vHgP + d * t - hgBoxPos : d;
}
vec3 getIBLIrradiance( const in vec3 normal ) {
	#ifdef ENVMAP_TYPE_CUBE_UV
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
		return PI * envMapColor.rgb * envMapIntensity;
	#else
		return vec3( 0.0 );
	#endif
}
vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
	#ifdef ENVMAP_TYPE_CUBE_UV
		vec3 reflectVec = reflect( - viewDir, normal );
		reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
		reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
		if ( hgBoxOn > 0.5 ) reflectVec = hgBoxDir( reflectVec );
		vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
		vec3 rad = envMapColor.rgb * min( 1.0, hgEnvMax / max( dot( envMapColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 ) );
		if ( hgReflOn > 0.5 ) {
			// nur auf glattem Boden (Ebene y = 0, nach oben gewandt)
			vec3 wn = transformDirectionByInverseViewMatrix( normal, viewMatrix );
			float onFloor = smoothstep( 0.8, 0.95, wn.y ) * ( 1.0 - smoothstep( 0.15, 0.4, abs( vHgP.y ) ) ) * ( 1.0 - smoothstep( 0.12, 0.35, roughness ) );
			if ( onFloor > 0.0 ) {
				vec4 c = hgReflMat * vec4( vHgP.x, 0.0, vHgP.z, 1.0 );
				vec4 r = texture2D( hgRefl, c.xy / c.w + wn.xz * 0.04 );
				rad = mix( rad, r.rgb, r.a * onFloor );
			}
		}
		return rad * envMapIntensity;
	#else
		return vec3( 0.0 );
	#endif
}
#endif`;
  const HALL_LIGHTS_BEGIN = (() => {
    const a = 'getSpotLightInfo( spotLight, geometryPosition, directLight );';
    const src = THREE.ShaderChunk.lights_fragment_begin;
    // Ohne die Stelle (andere three.js-Fassung) bleibt es bei three.js allein
    if (!src.includes(a)) return '#include <lights_fragment_begin>';
    return src.replace(a, `${a}
		#if ( UNROLLED_LOOP_INDEX < 2 )
		directLight.color *= hgStatShadow( UNROLLED_LOOP_INDEX, transformNormalByInverseViewMatrix( geometryNormal, viewMatrix ) );
		#endif`);
  })();
  const hallShader = (m) => (sh) => {
    sh.uniforms.hgNoTile = { value: m.userData.noTile ? 1 : 0 };
    sh.uniforms.hgShadeOn = m.userData.hgShadeU = { value: m.userData.hgShade ? 1 : 0 };
    sh.uniforms.hgInvK = hallNoTileInvK;
    sh.uniforms.hgPocket = hallPocket;
    sh.uniforms.hgCut = hallCut;
    sh.uniforms.hgCutOn = { value: m.userData.cut ? 1 : 0 };
    sh.uniforms.hgLiftY = m.userData.lift ? hallLiftY : hallLiftNo;
    sh.uniforms.hgBoxOn = hallBox.on; sh.uniforms.hgBoxMin = hallBox.min; sh.uniforms.hgBoxMax = hallBox.max; sh.uniforms.hgBoxPos = hallBox.pos;
    sh.uniforms.hgRoughMin = { value: m.userData.gloss ? HALL_GLOSS_MIN : HALL_ROUGH_MIN };
    sh.uniforms.hgEnvMax = hallEnvMax;
    sh.uniforms.hgReflOn = hallRefl.on; sh.uniforms.hgRefl = hallRefl.tex; sh.uniforms.hgReflMat = hallRefl.mat;
    sh.uniforms.hgStatN = hallStat.n; sh.uniforms.hgStat0 = hallStat.map[0]; sh.uniforms.hgStat1 = hallStat.map[1];
    sh.uniforms.hgStatMat0 = hallStat.mat[0]; sh.uniforms.hgStatMat1 = hallStat.mat[1];
    sh.uniforms.hgVolA = hallVol.a; sh.uniforms.hgVolB = hallVol.b; sh.uniforms.hgVolOn = hallVol.on;
    sh.uniforms.hgVolMin = hallVol.min; sh.uniforms.hgVolInv = hallVol.inv; sh.uniforms.hgVolRes = hallVol.res;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float hgInvK;\nuniform float hgLiftY;\nuniform float hgShadeOn;\nattribute vec3 hgShade;\nvarying vec3 vHgP;\nvarying vec3 vHgN;\nvarying float vHgShade;')
      // im BatchedMesh (Wartungsplatz) dazu die Matrix des Stücks
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 hgPos = vec4( position, 1.0 );\n#ifdef USE_BATCHING\nhgPos = batchingMatrix * hgPos;\n#endif\nvHgP = ( modelMatrix * hgPos ).xyz * hgInvK;\nvHgN = vHgP - vec3( 0.0, hgLiftY, 0.0 );\nvHgShade = hgShadeOn > 0.5 ? hgShade.r : 1.0;');
    // Unter dem Boden (das abgefahrene Schiffsfeld) wird es mit der Tiefe
    // dunkel wie in liftShade; was selbst leuchtet, bleibt hell.
    // Im Schacht und auf dem abgefahrenen Feld dazu die Schachtlampen.
    // Auf dem Feld (lift) klingen sie auf den letzten 3 m unter der Kante
    // aus: Sonst lag das Schachtlicht oben noch voll auf dem Licht der
    // Halle und brach beim Einrasten auf einen Schlag weg, die Schatten
    // unter dem Schiff sprangen dunkler (Krisz, 20.10.2026: „poppen“).
    const pit = PIT_N > 0 && (m.userData.shaft || m.userData.lift);
    if (sh.fragmentShader.includes('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;')) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `if ( vHgP.y < -0.05 ) outgoingLight = ( outgoingLight - totalEmissiveRadiance ) * ( 1.0 - 0.92 * smoothstep( 0.5, ${LIFT_DARK.toFixed(1)}, -vHgP.y ) ) + totalEmissiveRadiance;${pit ? `
	if ( vHgP.y < -0.05 && hgPitK.x > 0.0 ) {
		vec3 hgWn = inverseTransformDirection( normal, viewMatrix );
		outgoingLight += material.diffuseColor * ( hgPit( vHgP, hgWn, ${m.userData.shaft ? '1.0' : '0.0'} )${m.userData.shaft ? '' : ' * hgShF.x'} + hgShLight( vHgP, hgWn, ${m.userData.shaft ? '1.0' : '0.0'} ) )${m.userData.shaft ? ' + hgShRim( vHgP, hgWn )' : ''}${m.userData.lift ? ' * smoothstep( 0.05, 3.0, - vHgP.y )' : ''};
	}` : ''}
	outgoingLight = ( outgoingLight - totalEmissiveRadiance ) * hgPocketK( vHgP ) + totalEmissiveRadiance;${pit ? `
	if ( vHgP.y < -0.05 && hgPitK.x > 0.0 ) outgoingLight = hgShHaze( outgoingLight, vHgP );` : ''}
	#include <opaque_fragment>`);
    }
    if (pit) {
      sh.uniforms.hgPitA = hallPit.a; sh.uniforms.hgPitB = hallPit.b; sh.uniforms.hgPitC = hallPit.c;
      sh.uniforms.hgPitK = hallPit.k; sh.uniforms.hgPitBlink = hallPit.blink;
      sh.uniforms.hgShA = hallShaft.a; sh.uniforms.hgShB = hallShaft.b; sh.uniforms.hgShC = hallShaft.c;
      sh.uniforms.hgShD = hallShaft.d; sh.uniforms.hgShE = hallShaft.e; sh.uniforms.hgShF = hallShaft.f;
      sh.uniforms.hgShG = hallShaft.g; sh.uniforms.hgShInvK = hallNoTileInvK;
      // feste Schleifenlänge je Programm (der Übersetzer rollt sie aus): der
      // Schacht alle, das Feld nur die vorderen
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n#define HG_PIT_N ${PIT_N}\n#define HG_PIT_C ${m.userData.shaft ? PIT_N : hallPit.field}\n${HALL_PIT_GLSL}\n${HALL_SHAFT_GLSL}`);
    }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHgShade;\nuniform float hgRoughMin;\n' + HALL_NO_TILE_GLSL + '\n' + HALL_STAT_GLSL + '\n' + HALL_POCKET_GLSL + '\n' + HALL_CUT_GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\thgCutOut( vHgP );')
      .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vHgShade;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
	vec4 sampledDiffuseColor = hgNoTile > 0.5 ? hgNoTileSample( map, vMapUv ) : texture2D( map, vMapUv );
	diffuseColor *= sampledDiffuseColor;
#endif`)
      .replace('#include <envmap_physical_pars_fragment>', HALL_ENV_GLSL)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = max(roughnessFactor, hgRoughMin);')
      // Lampenlicht mit der Grenze für alle, Spiegelung mit der des Materials
      // Die Schattenstrahler sind die ersten Spots (three.js reiht Lampen mit
      // Schatten vorn ein, in Szenenreihenfolge wie renderHallShadows).
      .replace('#include <lights_fragment_begin>', `float hgRoughRefl = material.roughness;
	material.roughness = max( material.roughness, ${HALL_ROUGH_MIN.toFixed(2)} );
${HALL_LIGHTS_BEGIN}
	material.roughness = hgRoughRefl;
	if ( hgVolOn > 0.5 ) irradiance += hgVolume( vHgP, transformNormalByInverseViewMatrix( geometryNormal, viewMatrix ) );`);
    if (m.userData.shaft && !m.userData.shaftUv) {
      sh.fragmentShader = sh.fragmentShader
        .replace(/vec4 sampledDiffuseColor = [^;]*;/, `vec4 sampledDiffuseColor = ${HG_MEAN('map')};`)
        .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', HG_MEAN('roughnessMap')))
        .replace('#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment.replace('texture2D( metalnessMap, vMetalnessMapUv )', HG_MEAN('metalnessMap')));
    }
    // Wear-Schicht des Spiels (Schachtlack): Wo COLOR_0.a abfällt (hgShade.g),
    // zeigt sich die zweite Schicht; ihre eigene Helligkeit franst die
    // Grenze aus, so wie im Spiel die Abnutzung an Kanten und Flächen sitzt.
    const W = m.userData.hgWear;
    if (W && m.userData.shaftUv) {
      sh.uniforms.hgWearMap = { value: W.map }; sh.uniforms.hgWearCol = { value: W.color }; sh.uniforms.hgWearRough = { value: W.roughness };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vHgWear;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHgWear = hgShade.g;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHgWear;\nuniform sampler2D hgWearMap;\nuniform vec3 hgWearCol;\nuniform float hgWearRough;')
        .replace('diffuseColor *= sampledDiffuseColor;', `vec4 hgWc = texture2D( hgWearMap, vMapUv );
	float hgWm = smoothstep( 0.3, 0.7, vHgWear + ( dot( hgWc.rgb, vec3( 0.3333 ) ) - 0.5 ) * ${SHAFT_WEAR_BREAK.toFixed(2)} );
	diffuseColor.rgb = mix( diffuseColor.rgb * sampledDiffuseColor.rgb, hgWearCol * hgWc.rgb, hgWm );
	diffuseColor.a *= sampledDiffuseColor.a;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix( roughnessFactor, hgWearRough, hgWm );');
    }
    // Schachttor (GATE_SLOT, GATE_GRIME): Schmutz aus zwei Abtastungen in
    // verschiedenem Maßstab (sonst sähe man die Kachel auf 64 m Flügel),
    // bezogen auf den Mittelwert der Karte (oberste Mip-Stufe), also im
    // Mittel so hell wie vorher; im Raum des Teils vor batchingMatrix.
    // Dunkler Schmutz ist rauer. Unter dem Boden dunkel wie im Schlitz.
    const Gr = m.userData.hgGrime;
    // Lack wie der Hallenboden (GATE_FLOOR): das Rauschen gegen sichtbare
    // Wiederholung (hgNoTile) liest die Lage im geschlossenen Stand aus den
    // Kachelkoordinaten, sonst wanderten die Flecken mit der Fahrt
    if (m.userData.gateFloor) sh.vertexShader = sh.vertexShader.replace('vHgShade = hgShadeOn > 0.5 ? hgShade.r : 1.0;', `vHgShade = hgShadeOn > 0.5 ? hgShade.r : 1.0;
vHgN = vec3( uv.x, 0.0, uv.y ) * ${GATE_FLOOR.tile.toFixed(1)};`);
    if (m.userData.gate) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight = ( outgoingLight - totalEmissiveRadiance ) * mix( 1.0, ${SHAFT_POCKET[3].toFixed(2)}, smoothstep( ${GATE_SLOT[0].toFixed(2)}, ${GATE_SLOT[1].toFixed(2)}, - vHgP.y ) ) + totalEmissiveRadiance;
	#include <opaque_fragment>`);
    if (m.userData.gate && Gr) {
      sh.uniforms.hgGrimeMap = { value: Gr };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vHgGrUv;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
	{ vec3 gn = abs( normal ); vHgGrUv = ( gn.x > gn.y && gn.x > gn.z ? position.zy : ( gn.y > gn.z ? position.xz : position.xy ) ) / ${GATE_GRIME[0].toFixed(2)}; }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vHgGrUv;\nuniform sampler2D hgGrimeMap;')
        .replace('#include <color_fragment>', `#include <color_fragment>
	float hgGrM = max( dot( textureLod( hgGrimeMap, vec2( 0.5 ), 16.0 ).rgb, vec3( 0.3333 ) ), 0.01 );
	float hgGr = dot( texture2D( hgGrimeMap, vHgGrUv ).rgb + texture2D( hgGrimeMap, vHgGrUv * 0.37 + 0.31 ).rgb, vec3( 0.1667 ) ) / hgGrM;
	hgGr = max( 1.0 + ${GATE_GRIME[1].toFixed(2)} * ( hgGr - 1.0 ), 0.0 );
	diffuseColor.rgb *= hgGr;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = clamp( roughnessFactor * ( 2.0 - hgGr ), 0.0, 1.0 );');
    }
  };
  const hallKey = () => 'hall-v2';
  const gateKey = (m) => () => `hall-v2|gate${m.userData.hgGrime ? '|grime' : ''}${m.userData.gateFloor ? '|floor' : ''}`;
  const pitKey = () => (PIT_N ? `hall-v2|pit${hallPit.field}` : 'hall-v2');
  const shaftKey = (m) => () => `hall-v2|shaft${m.userData.shaftUv ? '|uv' : ''}${m.userData.hgWear ? '|wear' : ''}`;

  // Wartungsplatz am Schiff (WORK_DIENST). Die Materialien des Gerätesatzes
  // wie die der Halle (gedämpfte Lackfarbe, Metall und Rauheit begrenzt wie
  // in der Schleife oben, Leuchten, Hallenshader) und wie das Schiffsfeld mit
  // dem Aufzugsweg (userData.lift: im Schacht dunkel, Schachtlampen).
  // dienst_flach trägt Farbe, Rauheit und Metall je Ecke (dienstTint,
  // dienstPbr, aus _TINT und _RM der Datei).
  //
  // Schichten (S, aus dienstSchichten): Die Ecke nennt ihre Zeile der
  // Schichttafel (dienstSlot, 0 = keine), dazu Texturkoordinaten und die
  // Vertexfarbe des Spiels (dienstVc). Wie LayerBlend im Spiel mischt die
  // Blend-Karte die vier Grundschichten (r, g, b legen Schicht 2, 3, 4 über
  // die erste); die Abnutzungskarte legt, wo die Vertexfarbe Abnutzung
  // zulässt (r), die Abnutzungsschicht darüber: zuerst in ihren dunklen
  // Kratzern, je höher r, desto weiter; b verschattet (Ecken, Fugen). Die
  // erste Grundschicht trägt ihr Muster (Detailkarte als Faktor um ihre
  // mittlere Farbe, Normalenkarte, beide mit ihrer Kachelung), wo die Karte
  // eines hat. Welcher Kanal was trägt, sagt das Spiel für diese Shader
  // nicht: r, g, b nach der Reihenfolge des Namens (Wear-Dirt-AO), b sieht
  // aus wie Verschattung (PC-Befund 21.10.2026). Schmutz (g) bleibt aus.
  // Texturen mit Ableitungen von außerhalb der Verzweigung (textureGrad):
  // die Zeile wechselt von Dreieck zu Dreieck.
  const DIENST_WEAR_EDGE = 0.06, DIENST_AO = 0.9;
  const dienstShader = (m, S) => {
    const hall = hallShader(m);
    return (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 dienstTint;\nattribute vec2 dienstPbr;\nvarying vec3 vDienstTint;\nvarying vec2 vDienstPbr;' + (S ? '\nattribute vec2 dienstUv;\nattribute float dienstSlot;\nattribute vec4 dienstVc;\nvarying vec2 vDienstUv;\nflat varying float vDienstSlot;\nvarying vec4 vDienstVc;' : ''))
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvDienstTint = dienstTint; vDienstPbr = dienstPbr;' + (S ? ' vDienstUv = dienstUv; vDienstSlot = dienstSlot; vDienstVc = dienstVc;' : ''));
      hall(sh);
      if (S) { sh.uniforms.dienstTafel = { value: S.tafel }; sh.uniforms.dienstKarten = { value: S.karten }; }
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDienstTint;\nvarying vec2 vDienstPbr;' + (S ? `
varying vec2 vDienstUv;
flat varying float vDienstSlot;
varying vec4 vDienstVc;
uniform highp sampler2D dienstTafel;
uniform highp sampler2DArray dienstKarten;
vec4 dienstMix( int s, int o, vec3 b ) {
	vec4 c = texelFetch( dienstTafel, ivec2( o, s ), 0 );
	c = mix( c, texelFetch( dienstTafel, ivec2( o + 1, s ), 0 ), b.r );
	c = mix( c, texelFetch( dienstTafel, ivec2( o + 2, s ), 0 ), b.g );
	return mix( c, texelFetch( dienstTafel, ivec2( o + 3, s ), 0 ), b.b );
}
vec4 dienstKarte( float k, float t, vec2 dx, vec2 dy ) {
	return textureGrad( dienstKarten, vec3( vDienstUv * t, k ), dx * t, dy * t );
}
mat3 dienstTbn( vec3 q0, vec3 q1, vec2 st0, vec2 st1, vec3 N ) {
	vec3 q1p = cross( q1, N ), q0p = cross( N, q0 );
	vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
	float det = max( dot( T, T ), dot( B, B ) );
	return mat3( T * ( det == 0.0 ? 0.0 : inversesqrt( det ) ), B * ( det == 0.0 ? 0.0 : inversesqrt( det ) ), N );
}` : ''))
        .replace('diffuseColor.rgb *= vHgShade;', (S ? `vec3 dTint = vDienstTint; float dMet = vDienstPbr.y;
	int dS = int( vDienstSlot + 0.5 );
	vec4 dL = vec4( -1.0 );
	vec2 dUx = dFdx( vDienstUv ), dUy = dFdy( vDienstUv );
	vec3 dQx = dFdx( - vViewPosition ), dQy = dFdy( - vViewPosition );
	if ( dS > 0 ) {
		vec4 dK = texelFetch( dienstTafel, ivec2( 8, dS ), 0 );
		dL = texelFetch( dienstTafel, ivec2( 9, dS ), 0 );
		vec3 dB = dK.x >= 0.0 ? dienstKarte( dK.x, dK.y, dUx, dUy ).rgb : vec3( 0.0 );
		vec4 dC = dienstMix( dS, 0, dB ), dA = dC;
		float dW = 0.0;
		if ( dK.z >= 0.0 ) {
			dW = 1.0 - smoothstep( vDienstVc.r - ${DIENST_WEAR_EDGE.toFixed(2)}, vDienstVc.r + ${DIENST_WEAR_EDGE.toFixed(2)}, dienstKarte( dK.z, 1.0, dUx, dUy ).r );
			dA = dienstMix( dS, 4, dB );
		}
		if ( dL.x >= 0.0 ) dC.rgb *= clamp( pow( dienstKarte( dL.x, dL.z, dUx, dUy ).rgb, vec3( 2.2 ) ) / max( texelFetch( dienstTafel, ivec2( 10, dS ), 0 ).rgb, vec3( 0.01 ) ), 0.25, 2.0 );
		dTint = mix( dC.rgb, dA.rgb, dW ) * mix( 1.0, vDienstVc.b, ${DIENST_AO.toFixed(2)} * dK.w );
		dMet = mix( dC.a, dA.a, dW );
	}
	diffuseColor.rgb *= vHgShade * dTint;` : 'diffuseColor.rgb *= vHgShade * vDienstTint;'))
        .replace('roughnessFactor = max(roughnessFactor, hgRoughMin);', `roughnessFactor = max( max( vDienstPbr.x, ${S ? 'dMet' : 'vDienstPbr.y'} > 0.4 ? 0.45 : 0.65 ), hgRoughMin );`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n\tmetalnessFactor = min( ${S ? 'dMet' : 'vDienstPbr.y'}, 0.4 );`);
      if (S) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	if ( dL.y >= 0.0 ) normal = normalize( dienstTbn( dQx, dQy, dUx * dL.z, dUy * dL.z, normal ) * ( dienstKarte( dL.y, dL.z, dUx, dUy ).xyz * 2.0 - 1.0 ) );`);
    };
  };
  // Schichttafel und Kartenraster des Gerätesatzes (build-hangar-dienst.mjs):
  // Tafel als Gleitkommatextur (Zeile je Material), Karten als Texturliste
  async function dienstSchichten(x, url) {
    if (!x?.tafel?.length || !x.namen?.length) return null;
    try {
      const n = x.namen.length, px = x.px, cols = x.spalten, rows = x.tafel.length / (x.texel * 4);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = new URL(`${x.karten}?v=${x.sha}`, new URL(url, location.href)).href; });
      const W = px * cols, H = px * Math.ceil(n / cols);
      if (img.width !== W || img.height !== H) throw new Error(`Kartenraster ${img.width}×${img.height}, erwartet ${W}×${H}`);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
      const src = cx.getImageData(0, 0, W, H).data, buf = new Uint8Array(px * px * 4 * n);
      // Karte i aus dem Raster (Spalte i % cols, Reihe i / cols) als Ebene i
      for (let i = 0; i < n; i++) for (let y = 0; y < px; y++) {
        const o = ((Math.floor(i / cols) * px + y) * W + (i % cols) * px) * 4;
        buf.set(src.subarray(o, o + px * 4), (i * px + y) * px * 4);
      }
      const karten = new THREE.DataArrayTexture(buf, px, px, n);
      karten.wrapS = karten.wrapT = THREE.RepeatWrapping;
      karten.minFilter = THREE.LinearMipmapLinearFilter; karten.magFilter = THREE.LinearFilter;
      karten.generateMipmaps = true; karten.anisotropy = maxAniso; karten.needsUpdate = true;
      const data = new Float32Array((rows + 1) * x.texel * 4);
      data.set(x.tafel, x.texel * 4);   // Zeile 0 bleibt leer: keine Schichten
      const tafel = new THREE.DataTexture(data, x.texel, rows + 1, THREE.RGBAFormat, THREE.FloatType);
      tafel.minFilter = tafel.magFilter = THREE.NearestFilter; tafel.needsUpdate = true;
      return { karten, tafel, rows, maps: n };
    } catch (e) {
      console.warn('[hangar] Wartungsplatz ohne Schichten', e);
      return null;
    }
  }
  function dienstMaterial(m, S = null) {
    // Spuren (decal_*) und durchsichtige Aufkleber der Requisiten liegen auf
    // Boden und Gehäuse: vorgezogen, ohne Schatten zu werfen
    const flat = m.name === 'dienst_flach', sticker = /decal/i.test(m.name), decal = /^decal_/i.test(m.name) || (sticker && m.transparent);
    m.envMapIntensity = 0.05;
    if (m.isMeshStandardMaterial) m.envMap = envRT.texture;
    if (!m.transparent && !m.emissiveMap && m.color) m.color.multiplyScalar(/white|plastic|marble/i.test(m.name) ? 0.58 : 0.78);
    // COLOR_0 kommt als dienstVc in den Shader, nicht als Vertexfarbe
    if (flat) { m.roughness = 1; m.metalness = 1; m.vertexColors = false; }
    else if (m.metalness > 0.4) { m.metalness = 0.4; if (!m.roughnessMap) m.roughness = Math.max(m.roughness, 0.45); }
    else if (!m.roughnessMap) m.roughness = Math.max(m.roughness, 0.65);
    if (m.roughnessMap) m.roughness = Math.max(m.roughness, 1);
    if (/light|glow/i.test(m.name) && !/glass/i.test(m.name) && m.map) {
      m.emissive.set(0xffffff); m.emissiveMap = m.emissiveMap || m.map; m.emissiveIntensity = 5;
    } else if (m.emissiveMap) m.emissiveIntensity = 4;
    for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = maxAniso;
    if (sticker) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
    if (decal && m.transparent) m.depthWrite = false;
    m.userData.workDecal = decal;
    m.userData.lift = true;
    m.onBeforeCompile = flat ? dienstShader(m, S) : hallShader(m);
    m.customProgramCacheKey = flat ? () => `${pitKey()}|dienst${S ? '|schichten' : ''}` : pitKey;
    unifyMaps(m);
    onePass(m);
    return decal;
  }

  // Gerätesatz (scripts/build-hangar-dienst.mjs) in BatchedMeshes, eines je
  // Material: ein Zeichenbefehl für alle Stücke darin, gleich wie viele.
  // Jedes Stück aus WORK_DIENST (Glied eines Platzes, Leitung, Spur) ist je
  // Material eine Instanz; Leitungen haben eigene Geometrie (layDienst biegt
  // sie je Schiff). Die Gruppe hängt im Modell an der Feldmitte auf dem
  // Boden, im Maßstab 1/k: darin sind es Meter wie in der Welt.
  // Teile je Knoten des Satzes: Geometrie je Material, Hülle und Maße
  function kitParts(kitScene, S) {
    const parts = new Map();
    const flatAttrs = [['position', 'position'], ['normal', 'normal'], ['dienstTint', '_tint'], ['dienstPbr', '_rm'], ...(S ? [['dienstUv', 'uv'], ['dienstSlot', '_slot'], ['dienstVc', 'color']] : [])];
    for (const node of kitScene.children) {
      const list = [], box = new THREE.Box3();
      node.traverse((n) => {
        if (!n.isMesh) return;
        const g = n.geometry, m = n.material, flat = m.name === 'dienst_flach';
        const geo = new THREE.BufferGeometry();
        for (const [k, a] of flat ? flatAttrs : [['position', 'position'], ['normal', 'normal'], ['uv', 'uv']]) {
          if (!g.attributes[a]) throw new Error(`${node.name}: ${m.name} ohne ${a}`);
          geo.setAttribute(k, g.attributes[a]);
        }
        geo.setIndex(g.index);
        geo.computeBoundingBox();
        box.union(geo.boundingBox);
        list.push({ mat: m, geo });
      });
      if (list.length) parts.set(node.name, { parts: list, box, size: box.getSize(new THREE.Vector3()), centre: box.getCenter(new THREE.Vector3()) });
    }
    return parts;
  }
  // Je Material ein BatchedMesh (mat: Material vorbereiten, liefert, ob es
  // ein Aufkleber ist) und je Stück (uses) seine Instanzen darin, u.ids
  function kitBatches(uses, parts, name, mat) {
    // Größe je Material: Instanzen, Ecken und Indizes (geteilte Geometrie einmal)
    const need = new Map(), once = new Set();
    for (const u of uses) for (const p of parts.get(u.node).parts) {
      if (!need.has(p.mat)) need.set(p.mat, { inst: 0, vert: 0, idx: 0 });
      const e = need.get(p.mat), own = u.kind === 'leitung';
      e.inst++;
      if (own || !once.has(p.geo)) { if (!own) once.add(p.geo); e.vert += p.geo.attributes.position.count; e.idx += p.geo.index.count; }
    }
    const group = new THREE.Group(), batches = new Map();
    group.name = name;
    for (const [m, e] of need) {
      const decal = mat(m);
      const b = new THREE.BatchedMesh(e.inst, e.vert, e.idx, m);
      b.name = `${name}:${m.name}`;
      b.castShadow = !decal; b.receiveShadow = true;
      b.userData.geo = new Map();
      group.add(b);
      batches.set(m, b);
    }
    for (const u of uses) {
      u.ids = parts.get(u.node).parts.map((p) => {
        const b = batches.get(p.mat), map = b.userData.geo;
        let gid = u.kind === 'leitung' ? b.addGeometry(p.geo) : map.get(p.geo);
        if (gid === undefined) { gid = b.addGeometry(p.geo); map.set(p.geo, gid); }
        return { b, gid, iid: b.addInstance(gid), p };
      });
    }
    const tris = uses.reduce((sum, u) => sum + parts.get(u.node).parts.reduce((q, p) => q + p.geo.index.count / 3, 0), 0);
    return { group, batches, tris };
  }
  function buildDienst(kitScene, S = null) {
    const D = WORK_DIENST, parts = kitParts(kitScene, S);
    const uses = [];
    let missing = 0;
    const use = (u) => { if (parts.has(u.node)) uses.push(u); else missing++; };
    D.stationen.forEach((st, si) => st.glieder.forEach(([node, x, z, r = 0, y = 0]) => use({ kind: 'glied', st: si, node, x, z, r, y })));
    D.leitungen.forEach((l, li) => use({ kind: 'leitung', li, node: l.node }));
    D.spuren.forEach((a) => use({ kind: 'spur', node: a[0], a }));
    const { group, batches, tris } = kitBatches(uses, parts, 'dienst', (m) => dienstMaterial(m, m.name === 'dienst_flach' ? S : null));
    return { group, uses, parts, batches, missing, tris, sig: '', schichten: S ? { rows: S.rows, maps: S.maps } : null };
  }

  // Hallendeko (WORK_DEKO) aus ihrem Satz, wie der Wartungsplatz je Material
  // ein BatchedMesh, aber fest in der Halle: ohne Aufzugsweg und
  // Schachtlampen, mit den Schatten der Hallenlampen wie die Einrichtung.
  // Einmal je Halle gestellt (grid: floorGrid, belegt danach auch die
  // Fläche der Deko); layDeko setzt die Matrizen je Maßstab k.
  function dekoMaterial(m, S) {
    const flat = m.name === 'dienst_flach', decal = dienstMaterial(m, flat ? S : null);
    m.userData.lift = false;
    m.customProgramCacheKey = flat ? () => `hall-v2|dienst${S ? '|schichten' : ''}` : hallKey;
    return decal;
  }
  function buildDeko(kitScene, S, grid, floorY, stufe) {
    const parts = kitParts(kitScene, S), uses = [], gone = [], R = THREE.MathUtils.DEG2RAD;
    let missing = 0, zones = 0;
    const ext = (e, a, sc = 1) => [(Math.abs(Math.cos(a)) * e.size.x + Math.abs(Math.sin(a)) * e.size.z) * sc / 2, (Math.abs(Math.sin(a)) * e.size.x + Math.abs(Math.cos(a)) * e.size.z) * sc / 2];
    WORK_DEKO.zonen.forEach((zn, zi) => {
      if (zn.stufe === 'hoch' && stufe !== 'hoch') return;
      const th = DEKO_WAND[zn.wand] * R, c = Math.cos(th), s = Math.sin(th), [ax, az] = zn.at, own = [];
      const at = (x, z) => [ax + x * c + z * s, az - x * s + z * c];
      for (const [node, x, z, r = 0, y = 0] of zn.glieder) {
        const e = parts.get(node);
        if (!e) { missing++; continue; }
        const a = th + r * R, [ex, ez] = ext(e, a);
        own.push({ kind: 'glied', zone: zi, node, at: at(x, z), a, y, sc: 1, ex, ez, hx: e.size.x / 2, hz: e.size.z / 2, top: y + e.size.y });
      }
      for (const [node, x, z, edge, r = 0] of zn.spuren ?? []) {
        const e = parts.get(node);
        if (!e) { missing++; continue; }
        const a = th + r * R, sc = edge / Math.max(e.size.x, e.size.z, 1e-3), [ex, ez] = ext(e, a, sc);
        own.push({ kind: 'spur', zone: zi, node, at: at(x, z), a, y: WORK_LIFT, sc, ex, ez, top: WORK_LIFT });
      }
      // Was im Band des Grundrisses auf Halle oder Einrichtung stößt, fällt
      // weg; dazu, was darauf steht (seine Mitte über dem Weggefallenen)
      const hit = own.filter((q) => q.kind === 'glied' && grid && q.y < WORK_BAND[1] && q.top > WORK_BAND[0] && !grid.freeRot(q.at[0], q.at[1], q.hx, q.hz, q.a));
      const on = (q, b) => q.y > 0.05 && Math.abs(q.at[0] - b.at[0]) < b.ex && Math.abs(q.at[1] - b.at[1]) < b.ez;
      for (let more = true; more;) {
        more = false;
        for (const q of own) if (!hit.includes(q) && hit.some((b) => on(q, b))) { hit.push(q); more = true; }
      }
      for (const q of hit) gone.push(`${zn.name}: ${q.node.replace(/^prop_/, '')}`);
      const keep = own.filter((q) => !hit.includes(q));
      if (grid) for (const q of keep) if (q.kind === 'glied' && q.y < 0.05) grid.fill(q.at[0], q.at[1], q.ex, q.ez);
      uses.push(...keep);
      if (keep.length) zones++;
    });
    const { group, batches, tris } = kitBatches(uses, parts, 'deko', (m) => dekoMaterial(m, S));
    // Schatten wie die Einrichtung: aus den Hallenlampen (renderHallShadows), nicht vom Schiffslicht
    for (const b of batches.values()) b.castShadow = false;
    return { group, uses, parts, batches, missing, gone, tris, zones, floorY, k: 0, blocks: [] };
  }
  // Matrizen der Deko im Modell für den Maßstab k der Halle: jedes Stück
  // um den Bezugspunkt seiner Zone auf der Wand in 1/k, also in Metern wie
  // in der Welt. Dazu die Grundflächen für Crew (blocks, Weltmeter).
  function layDeko(d, k) {
    if (d.k === k) return;
    d.k = k;
    const M = new THREE.Matrix4(), R = new THREE.Matrix4(), S0 = new THREE.Matrix4(), T0 = new THREE.Matrix4();
    for (const u of d.uses) {
      const e = d.parts.get(u.node), [ax, az] = WORK_DEKO.zonen[u.zone].at;
      T0.makeTranslation(-e.centre.x, -e.box.min.y, -e.centre.z);
      M.makeTranslation(ax + (u.at[0] - ax) / k, d.floorY + u.y / k, az + (u.at[1] - az) / k)
        .multiply(R.makeRotationY(u.a)).multiply(S0.makeScale(u.sc / k, 1 / k, u.sc / k)).multiply(T0);
      for (const id of u.ids) id.b.setMatrixAt(id.iid, M);
    }
    for (const b of d.batches.values()) { b.computeBoundingBox(); b.computeBoundingSphere(); }
    d.group.updateWorldMatrix(true, false);
    d.blocks = dekoBoxes(d, 0).map((b) => ({ x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, ex: (b.max.x - b.min.x) / 2, ez: (b.max.z - b.min.z) / 2 }));
  }
  // Hüllquader der stehenden Stücke in der Welt, um m größer (Kamera, Crew)
  function dekoBoxes(d, m) {
    const k = d.k || 1, out = [];
    d.group.updateWorldMatrix(true, false);
    for (const u of d.uses) {
      if (u.kind !== 'glied') continue;
      const [ax, az] = WORK_DEKO.zonen[u.zone].at, e = d.parts.get(u.node);
      const x = ax + (u.at[0] - ax) / k, z = az + (u.at[1] - az) / k, y = d.floorY + u.y / k;
      out.push(new THREE.Box3(new THREE.Vector3(x - u.ex / k, y, z - u.ez / k), new THREE.Vector3(x + u.ex / k, y + e.size.y / k, z + u.ez / k)).applyMatrix4(d.group.matrixWorld).expandByScalar(m));
    }
    return out;
  }

  // Plätze, Leitungen und Spuren um das Schiff (info: Maße, info.under:
  // Grundriss von unten), im Feld des Aufzugs. Je Platz die Stellen aus
  // `wo` und `sonst`, längs etwas verschoben, falls besetzt; an jeder rückt
  // er von außen an den Rumpf heran, bis er an ihn stößt (DIENST_CLEAR), und
  // bleibt an der letzten freien Stelle im Feld. Passt keine, fehlt er (die
  // Konsole sagt welcher).
  const DIENST_SHIFT = [0, 0.15, -0.15, 0.3, -0.3];
  function layDienst(d, info, k) {
    const L = realHall.liftL, o = realHall.spot, fc = [(L.from[0] + L.to[0]) / 2, (L.from[1] + L.to[1]) / 2];
    d.group.scale.setScalar(1 / k);
    d.group.position.set(fc[0], realHall.floorY + lift.y, fc[1]);
    const sx = (o[0] - fc[0]) * k, sz = (o[2] - fc[1]) * k;
    const FX = ((L.to[0] - L.from[0]) * k) / 2 - DIENST_EDGE, FZ = ((L.to[1] - L.from[1]) * k) / 2 - DIENST_EDGE;
    const W = info.halfW, Lh = info.len / 2, U = info.under, [CH, CV] = DIENST_CLEAR;
    const sig = `${k.toFixed(4)}|${W}|${Lh}|${info.height}|${!!U}`;
    // gleiche Maße, aber ein anderes Schiff (eigener Grundriss): neu stellen
    if (sig === d.sig && U === d.under) { info.dienstTop = d.top; return; }
    d.sig = sig; d.under = U;
    // frei vom Rumpf: um den Kasten (cx, cz, ex, ez) bis Höhe top
    const clear = (cx, cz, ex, ez, top) => {
      if (!U) return Math.abs(cx) - ex - CH >= W || Math.abs(cz) - ez - CH >= Lh;
      const { x0, z0, nx, nz, C, low } = U;
      const ci = Math.floor((cx - x0) / C), cj = Math.floor((cz - z0) / C);
      if (ci >= 0 && cj >= 0 && ci < nx && cj < nz && low[cj * nx + ci] < Infinity) return false;
      const i0 = Math.max(0, Math.floor((cx - ex - CH - x0) / C)), i1 = Math.min(nx - 1, Math.floor((cx + ex + CH - x0) / C));
      const j0 = Math.max(0, Math.floor((cz - ez - CH - z0) / C)), j1 = Math.min(nz - 1, Math.floor((cz + ez + CH - z0) / C));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (low[j * nx + i] < top + CV) return false;
      return true;
    };
    // Kästen eines Platzes (im Schiffsraum) an der Stelle A, Drehung th
    const M = new THREE.Matrix4(), R = new THREE.Matrix4(), T0 = new THREE.Matrix4(), S0 = new THREE.Matrix4();
    const glieder = d.uses.filter((u) => u.kind === 'glied');
    const boxes = (si, ax, az, th) => glieder.filter((u) => u.st === si).map((u) => {
      const e = d.parts.get(u.node), c = Math.cos(th), s = Math.sin(th), r = th + u.r * DEG;
      const ex = (Math.abs(Math.cos(r)) * e.size.x + Math.abs(Math.sin(r)) * e.size.z) / 2, ez = (Math.abs(Math.sin(r)) * e.size.x + Math.abs(Math.cos(r)) * e.size.z) / 2;
      return { u, x: ax + u.x * c + u.z * s, z: az - u.x * s + u.z * c, r, ex, ez, top: u.y + e.size.y };
    });
    // nur die Plätze für diese Schiffsgröße (ab/bis, größte Ausdehnung)
    const span = Math.max(info.len, 2 * W), fits = (st) => span >= (st.ab ?? 0) && span < (st.bis ?? Infinity);
    const taken = [], placed = new Map(), report = [];
    WORK_DIENST.stationen.forEach((st, si) => {
      const own = glieder.filter((u) => u.st === si);
      if (!own.length || !fits(st)) return;
      const fr = st.frei ?? 0;   // Abstand zu jedem Teil des Rumpfs, auch hoch oben
      // Ausdehnung zum Schiff hin (z im Platz, ungedreht)
      const zmin = Math.min(...boxes(si, 0, 0, 0).map((q) => q.z - q.ez));
      let best = null;
      for (const [kind, side, f0] of [st.wo, ...(st.sonst ?? [])]) {
        const th = kind === 'seite' ? (side * Math.PI) / 2 : side > 0 ? 0 : Math.PI, ox = Math.sin(th), oz = Math.cos(th);
        const reach = kind === 'seite' ? W : Lh;
        for (const df of DIENST_SHIFT) {
          const f = f0 + df, bx = kind === 'seite' ? 0 : f * W, bz = kind === 'seite' ? f * Lh : 0;
          for (let dist = reach + DIENST_OVER + CH + fr - zmin; dist >= -zmin; dist -= DIENST_STEP) {
            const ax = bx + ox * dist, az = bz + oz * dist, q = boxes(si, ax, az, th);
            if (!q.every((b) => clear(b.x, b.z, b.ex, b.ez, b.top) && (!fr || clear(b.x, b.z, b.ex + fr, b.ez + fr, Infinity)))) break;
            const inField = q.every((b) => Math.abs(b.x + sx) + b.ex <= FX && Math.abs(b.z + sz) + b.ez <= FZ);
            const free = q.every((b) => taken.every((t) => Math.abs(b.x - t.x) >= b.ex + t.ex + 0.4 || Math.abs(b.z - t.z) >= b.ez + t.ez + 0.4));
            if (inField && free) best = { q, ax, az, th, at: `${kind === 'seite' ? `Seite ${side > 0 ? '+x' : '-x'}` : side > 0 ? 'Bug' : 'Heck'} ${f.toFixed(2)}` };
          }
          if (best) break;
        }
        if (best) break;
      }
      report.push(best ? `${st.name} ${best.at}` : `${st.name} fehlt`);
      if (!best) return;
      taken.push(...best.q);
      placed.set(st.name, best);
    });
    // Für die Crew: je Platz die Grundfläche aller Stücke als Rechteck in
    // Weltmetern (die Gruppe steht im Maßstab 1/k im Modell: Meter wie dort)
    d.group.updateWorldMatrix(true, false);
    const wsc = d.group.getWorldScale(new THREE.Vector3()).x;
    d.blocks = [...placed.values()].map((p) => {
      const x0 = Math.min(...p.q.map((b) => b.x - b.ex)), x1 = Math.max(...p.q.map((b) => b.x + b.ex));
      const z0 = Math.min(...p.q.map((b) => b.z - b.ez)), z1 = Math.max(...p.q.map((b) => b.z + b.ez));
      const c = d.group.localToWorld(new THREE.Vector3((x0 + x1) / 2 + sx, 0, (z0 + z1) / 2 + sz));
      return { x: c.x, z: c.z, ex: ((x1 - x0) / 2) * wsc, ez: ((z1 - z0) / 2) * wsc };
    });
    // und wo der Rumpf tiefer als CREW_HEAD hängt (Grundriss U, sonst Kasten)
    const inv = d.group.matrixWorld.clone().invert(), hv = new THREE.Vector3();
    d.hull = (x, z) => {
      hv.set(x, 0, z).applyMatrix4(inv);
      const lx = hv.x - sx, lz = hv.z - sz;
      if (!U) return Math.abs(lx) < W && Math.abs(lz) < Lh;
      const i = Math.floor((lx - U.x0) / U.C), j = Math.floor((lz - U.z0) / U.C);
      return i >= 0 && j >= 0 && i < U.nx && j < U.nz && U.low[j * U.nx + i] < CREW_HEAD / wsc;
    };
    // Höchstes Gerät: Bei flachen Fahrzeugen (Nox 1,3 m) ist der Werkzeugschrank
    // (2,3 m) höher als das Schiff, und es fährt mit; das Schachttor wartet auf beides
    d.top = Math.max(0, ...[...placed.values()].flatMap((p) => p.q.map((b) => b.top)));
    info.dienstTop = d.top;
    // Glieder: Matrix und Sichtbarkeit
    const show = (u, on) => { for (const id of u.ids) id.b.setVisibleAt(id.iid, on); };
    for (const u of glieder) {
      const p = placed.get(WORK_DIENST.stationen[u.st].name), b = p?.q.find((q) => q.u === u);
      show(u, !!b);
      if (!b) continue;
      const e = d.parts.get(u.node);
      T0.makeTranslation(-e.centre.x, -e.box.min.y, -e.centre.z);
      M.makeTranslation(b.x + sx, u.y, b.z + sz).multiply(R.makeRotationY(b.r)).multiply(T0);
      for (const id of u.ids) id.b.setMatrixAt(id.iid, M);
    }
    // Leitungen: vom Gerät auf den Boden, in einem Bogen unter den Rumpf
    let lines = 0;
    for (const u of d.uses.filter((q) => q.kind === 'leitung')) {
      const l = WORK_DIENST.leitungen[u.li], [stn, lx, lz, h] = l.von, p = placed.get(stn);
      show(u, !!p);
      if (!p) continue;
      const c = Math.cos(p.th), s = Math.sin(p.th), e = d.parts.get(u.node);
      const a = new THREE.Vector3(p.ax + lx * c + lz * s, h, p.az - lx * s + lz * c);
      // Ziel unter dem Rumpf: von der genannten Stelle zur Schiffsmitte, bis Rumpf darüber ist
      let tx = l.nach[0] * W, tz = l.nach[1] * Lh;
      const covered = (x, z) => {
        if (!U) return Math.abs(x) < W && Math.abs(z) < Lh;
        const i = Math.floor((x - U.x0) / U.C), j = Math.floor((z - U.z0) / U.C);
        return i >= 0 && j >= 0 && i < U.nx && j < U.nz && U.low[j * U.nx + i] < 3;
      };
      for (let t = 0; t < 1 && !covered(tx, tz); t += 0.05) { tx *= 0.95; tz *= 0.95; }
      const end = new THREE.Vector3(tx, 0, tz), dir = new THREE.Vector3(end.x - a.x, 0, end.z - a.z).normalize();
      const drop = new THREE.Vector3(a.x + dir.x * 0.6, 0, a.z + dir.z * 0.6);
      const chord = drop.distanceTo(end), want = Math.min(e.size.z, chord * 1.15);
      const sag = want > chord ? Math.sqrt((3 * chord * (want - chord)) / 8) : 0, side = u.li % 2 ? 1 : -1;
      const mid = new THREE.Vector3().lerpVectors(drop, end, 0.5).add(new THREE.Vector3(-dir.z * sag * side, 0, dir.x * sag * side));
      const pts = [a, new THREE.Vector3(a.x + dir.x * 0.25, h * 0.35, a.z + dir.z * 0.25), drop, mid, end].map((v) => v.add(new THREE.Vector3(sx, 0, sz)));
      for (const id of u.ids) {
        const bent = bendAlong(id.p.geo, e.box, pts);
        id.b.setGeometryAt(id.gid, bent.geo);
        id.b.setMatrixAt(id.iid, M.identity());
      }
      lines++;
    }
    // Spuren unter dem Schiff (Kante nach Schiffsbreite) oder an einem Platz (Kante in m)
    let spots = 0;
    for (const u of d.uses.filter((q) => q.kind === 'spur')) {
      const e = d.parts.get(u.node), a = u.a, p = typeof a[1] === 'string' ? placed.get(a[1]) : null;
      show(u, typeof a[1] !== 'string' || !!p);
      if (typeof a[1] === 'string' && !p) continue;
      let x, z, r, edge;
      if (p) {
        const c = Math.cos(p.th), sn = Math.sin(p.th);
        edge = a[4]; x = p.ax + a[2] * c + a[3] * sn + sx; z = p.az - a[2] * sn + a[3] * c + sz; r = p.th + (a[5] ?? 0) * DEG;
      } else {
        edge = THREE.MathUtils.clamp(a[3] * 2 * W, ...DIENST_SPUR); x = a[1] * W + sx; z = a[2] * Lh + sz; r = (a[4] ?? 0) * DEG;
      }
      const sc = edge / Math.max(e.size.x, e.size.z, 1e-3);
      x = THREE.MathUtils.clamp(x, edge / 2 - FX, FX - edge / 2); z = THREE.MathUtils.clamp(z, edge / 2 - FZ, FZ - edge / 2);
      T0.makeTranslation(-e.centre.x, -e.box.min.y, -e.centre.z);
      M.makeTranslation(x, WORK_LIFT, z).multiply(R.makeRotationY(r)).multiply(S0.makeScale(sc, 1, sc)).multiply(T0);
      for (const id of u.ids) id.b.setMatrixAt(id.iid, M);
      spots++;
    }
    // Ein Material, dessen Stücke alle fehlen (Gerät nur großer Schiffe),
    // kostet keinen Zeichenbefehl: das BatchedMesh geht ganz aus
    const live = new Map();
    for (const u of d.uses) for (const id of u.ids) if (id.b.getVisibleAt(id.iid)) live.set(id.b, (live.get(id.b) ?? 0) + id.p.geo.index.count / 3);
    for (const b of d.batches.values()) { b.visible = live.has(b); b.computeBoundingBox(); b.computeBoundingSphere(); }
    const tris = [...live.values()].reduce((a, v) => a + v, 0);
    shadowSig = '';
    console.info(`[hangar] Wartungsplatz bei ${span.toFixed(0)} m: ${placed.size} von ${WORK_DIENST.stationen.filter(fits).length} Plätzen (${report.join(', ')}), ${lines} Leitungen, ${spots} Spuren, höchstes Gerät ${d.top.toFixed(2)} m; ${live.size} von ${d.batches.size} Meshes, ${Math.round(tris)} Dreiecke${U ? `, Grundriss ${U.nx} × ${U.nz} Zellen in ${U.ms} ms` : ', ohne Grundriss (Kasten)'}${d.missing ? `, ${d.missing} ohne Knoten` : ''}`);
  }

  // Halle steht (true) oder ist gescheitert (false); das erste Schiff wartet darauf
  let hallSettled = Promise.resolve(false);
  function loadRealHall(h) {
    // Möbel als eigene Datei (am Rechner neben der leichteren Stufe), parallel
    // zur Halle; scheitert sie, steht die Halle ohne. Am Telefon steht hier
    // die Telefon-Datei: nur Ergänzung und Füllung, dieselben Knoten.
    const furnReady = h.furniture?.url
      ? fetchGltf(h.furniture.url, 'furniture', h.furniture.bytes || 4e6).then((g) => g.scene, (e) => {
        console.warn('[hangar] Einrichtung nicht geladen', e);
        prog.delete('furniture');
        return null;
      })
      : Promise.resolve(null);
    // Schachtbausatz (HALL_SHAFT) mit Lampenliste, parallel; ohne ihn fährt
    // das Feld wie bisher ins Dunkle
    const shaftReady = h.lift?.url && h.lift.json && HALL_SHAFT[h.id] && HALL_LIFT[h.id]
      ? Promise.all([
        fetchGltf(h.lift.url, 'lift', h.lift.bytes || 4e5),
        fetch(h.lift.json).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${h.lift.json}: ${r.status}`)))),
      ]).then(([g, info]) => ({ kit: g.scene, info }), (e) => {
        console.warn('[hangar] Schacht nicht geladen', e);
        prog.delete('lift');
        return null;
      })
      : Promise.resolve(null);
    // Schachttor (buildGate) mit seinen Bahnen, parallel; ohne es oder ohne
    // Fahrt (reduceMotion) bleibt der Schacht beim Wechsel offen wie bisher
    const G0 = h.lift?.gate;
    const gateReady = G0?.url && G0.json && !reduceMotion
      ? Promise.all([
        fetchGltf(G0.url, 'gate', G0.bytes || 7e5),
        fetch(G0.json).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${G0.json}: ${r.status}`)))),
      ]).then(([g, info]) => ({ scene: g.scene, info }), (e) => {
        console.warn('[hangar] Schachttor nicht geladen', e);
        prog.delete('gate');
        return null;
      })
      : Promise.resolve(null);
    // Fester Rand um die Öffnung (buildRand), parallel; ohne ihn bleibt der
    // Hallenboden bis an das Feld
    const R0 = h.lift?.rand;
    const randReady = R0?.url && R0.json
      ? Promise.all([
        fetchGltf(R0.url, 'rand', R0.bytes || 7e5),
        fetch(R0.json).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${R0.json}: ${r.status}`)))),
      ]).then(([g, info]) => ({ scene: g.scene, info }), (e) => {
        console.warn('[hangar] Rand nicht geladen', e);
        prog.delete('rand');
        return null;
      })
      : Promise.resolve(null);
    // Werkstatt (placeWorkshop), parallel; am Telefon und auf niedrig nur die
    // Bodendatei, ohne sie steht die Halle wie bisher
    const WB = WORK_BUDGET[SMALL ? 'niedrig' : Q0] ?? WORK_BUDGET.niedrig, W = h.workshop;
    const workReady = W?.url && W.json
      ? Promise.all([
        WB.props > 0 ? fetchGltf(W.url, 'workshop', W.bytes || 6e6).then((g) => g.scene) : null,
        W.boden?.url && WB.decals > 0 ? fetchGltf(W.boden.url, 'workshop-floor', W.boden.bytes || 2e6).then((g) => g.scene) : null,
        fetch(W.json).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${W.json}: ${r.status}`)))),
      ]).then(([props, boden, info]) => ({ scenes: [props, boden], info }), (e) => {
        console.warn('[hangar] Werkstatt nicht geladen', e);
        prog.delete('workshop'); prog.delete('workshop-floor');
        return null;
      })
      : Promise.resolve(null);
    // Gerätesatz für den Wartungsplatz am Schiff, wo die Stufe Requisiten hat
    const dienstReady = W?.dienst?.url && WB.props > 0 && HALL_LIFT[h.id]
      ? fetchGltf(W.dienst.url, 'dienst', W.dienst.bytes || 3.5e6).then(async (g) => ({ scene: g.scene, schichten: await dienstSchichten(g.asset?.extras?.dienst?.schichten, W.dienst.url) }), (e) => {
        console.warn('[hangar] Wartungsplatz nicht geladen', e);
        prog.delete('dienst');
        return null;
      })
      : Promise.resolve(null);
    // Satz der Hallendeko (WORK_DEKO), nur für die Halle, deren Koordinaten er trägt
    const dekoReady = W?.deko?.url && WB.props > 0 && HALL_LIFT[h.id] && WORK_DEKO.halle === h.id
      ? fetchGltf(W.deko.url, 'deko', W.deko.bytes || 4e6).then(async (g) => ({ scene: g.scene, schichten: await dienstSchichten(g.asset?.extras?.deko?.schichten, W.deko.url) }), (e) => {
        console.warn('[hangar] Hallendeko nicht geladen', e);
        prog.delete('deko');
        return null;
      })
      : Promise.resolve(null);
    hallSettled = fetchGltf(h.url, 'hall', h.bytes || 1.1e7).then(async (gltf) => {
      const model = gltf.scene;
      const c = h.room.center, o = hallSpot(h);
      model.position.set(-o[0], -c[1], -o[2]);
      // Der begehbare Boden liegt im Modell nicht auf 0 (beim Deluxe-Hangar
      // knapp 1 m darüber) — sonst versinken Schiff, Gerät und Crew darin.
      // Die Höhe misst der Build (floor im Manifest); fehlt sie, wird hier
      // senkrecht nach unten gelotet (kostet bei 700 000 Dreiecken spürbar).
      model.updateMatrixWorld(true);
      let floorY = c[1];
      if (Number.isFinite(h.floor)) {
        model.position.y = -h.floor;
        floorY = h.floor;
      } else {
        const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), ys = [];
        for (const [x, z] of [[0, 0], [6, 4], [-6, -4], [4, -8], [-8, 6], [10, 10], [-10, -10]]) {
          rc.set(new THREE.Vector3(x, 3, z), down);
          const hit = rc.intersectObject(model, true)[0];
          if (hit) ys.push(hit.point.y);
        }
        if (ys.length >= 3) {
          ys.sort((p, q) => p - q);
          model.position.y -= ys[Math.floor(ys.length / 2)];
          floorY += ys[Math.floor(ys.length / 2)];
        }
      }
      // Einrichtung in Originalgröße: Für große Schiffe wächst die Halle mit,
      // Kisten und Spinde sollen es nicht. Der Build stellt jedes Möbel als
      // eigenen Knoten mit Bezugspunkt (extras.anchor), in der vollen Stufe
      // oder als eigene Datei (h.furniture). Nach dem Schnitt legt
      // mergeFurniture sie je Material zusammen; scaleWorld hält sie mit
      // scaleFurniture bei 1/k.
      const furn = [];
      model.traverse((n) => { if (Array.isArray(n.userData?.anchor)) furn.push(n); });
      // In Häppchen (siehe slicer): Die Halle hängt erst nach prepare() in
      // der Szene, zwischendurch zeichnet also nichts eine halb fertige.
      const pause = slicer(12, nextTask);
      await nextTask();
      const t0 = performance.now();
      for (const r of await dropHallParts(model, HALL_DROP[h.id], pause)) {
        const ms = Math.round(performance.now() - t0);
        if (r.tris) console.info(`[hangar] Halle: ${r.tris} Dreiecke in ${r.parts} Teilen entfernt (${r.why.split(' (')[0]}), ${ms} ms`);
        else console.warn(`[hangar] Halle: Ausnahme trifft nichts mehr: ${r.why}`);
      }
      await pause();
      // Schiffsfeld als Aufzug, vor der Einrichtung (die bleibt stehen)
      const L = HALL_LIFT[h.id], t2 = performance.now();
      const lift = L ? await cutHallLift(model, L, new Set(furn), pause) : null;
      if (lift) {
        model.add(lift.group);
        console.info(`[hangar] Aufzug: ${lift.tris} Dreiecke in ${lift.parts} Teilen aus dem Schiffsfeld, ${Math.round(performance.now() - t2)} ms`);
      } else if (L) console.warn('[hangar] Aufzug: Schiffsfeld trifft keine Dreiecke');
      // Die Möbeldatei teilt den Modellraum der Halle; der Schnitt gilt nur der Halle
      const extra = await furnReady;
      await pause();
      if (extra) {
        const det = swapHallDetail(model, extra);
        if (det) console.info(`[hangar] Halle: ${det.added} Dreiecke Glas und Rohre aus der vollen Stufe statt ${det.cut} (${det.materials} Materialien), ${det.filled} Dreiecke Füllung`);
        model.add(extra);
        extra.traverse((n) => { if (Array.isArray(n.userData?.anchor)) furn.push(n); });
        await pause();
      }
      // Feld und Bodenstreifen in die Hallenmitte (HALL_SHIFT): nach der
      // Möbeldatei (ihre Füllung liegt im Boden), vor dem Zusammenlegen.
      // F ist das Feld, wie es danach steht.
      const S = lift ? HALL_SHIFT[h.id] : null, F = S ? liftField(h) : L;
      if (S) {
        const t7 = performance.now();
        lift.group.position.x = S.field;
        const sh = await shiftHallFloor(model, S, new Set([lift.group, ...furn]), furn, pause);
        if (sh) console.info(`[hangar] Feldmitte: Feld um ${S.field} m, ${sh.moved.map((q, i) => `Streifen ${S.strips[i][0]}..${S.strips[i][1]} um ${S.strips[i][2]} m ${q}`).join(', ')} Dreiecke, ${sh.split} geteilt, ${sh.furniture} Möbel mit; ${Math.round(performance.now() - t7)} ms`);
        else console.warn('[hangar] Feldmitte: Streifen treffen keine Dreiecke');
        await pause();
      }
      // Fester Rand um das Feld: Möbel darauf rücken hinaus (clearRandFurniture)
      if (lift && h.lift?.rand) {
        const cr = clearRandFurniture(model, furn, F, HALL_RAND.width, h.room, floorY);
        for (const n of cr.dropped) furn.splice(furn.indexOf(n), 1);
        if (cr.moved.length || cr.dropped.length) console.info(`[hangar] Rand: ${cr.moved.length} Möbel vom Steg gerückt (${cr.moved.join(', ') || '–'}), ${cr.dropped.length} weggelassen (${cr.dropped.map((n) => n.name).join(', ') || '–'})`);
      }
      const t1 = performance.now();
      const furniture = await mergeFurniture(model, furn, pause);
      for (const n of furn) {
        let left = false;
        n.traverse((o) => { if (o.isMesh) left = true; });
        if (!left) n.removeFromParent();
      }
      if (extra && !extra.children.length) extra.removeFromParent();
      if (furniture.length) {
        const tris = furniture.reduce((sum, f) => sum + f.mesh.geometry.index.count / 3, 0);
        console.info(`[hangar] Einrichtung: ${furn.length} Möbel in ${furniture.length} Meshes, ${tris} Dreiecke, ${Math.round(performance.now() - t1)} ms`);
      }
      await pause();
      // Werkstatt um das Feld, nach der Einrichtung (sie belegt den Boden
      // mit), davor die Hallendeko (buildDeko): Sie belegt den Grundriss,
      // die Werkstatt weicht ihr aus. Eingehängt wird die Deko erst nach
      // den Hallenmaterialien unten, wie der Wartungsplatz.
      const work = L ? await workReady : null;
      const dekoKit = L ? await dekoReady : null;
      let grid = null, gridOk = true, deko = null;
      if ((work || dekoKit) && WB.props > 0) {
        try {
          grid = await floorGrid(model, h.room, floorY, new Set([lift?.group].filter(Boolean)), pause);
        } catch (e) {
          console.warn('[hangar] Grundriss der Halle nicht gemessen', e);
          gridOk = false;
        }
      }
      if (dekoKit && gridOk) {
        const t8 = performance.now();
        try {
          deko = buildDeko(dekoKit.scene, dekoKit.schichten, grid, floorY, SMALL ? 'niedrig' : Q0);
          const n = deko.uses.filter((u) => u.kind === 'glied').length;
          console.info(`[hangar] Hallendeko: ${deko.zones} Zonen, ${n} Requisiten, ${deko.uses.length - n} Spuren, ${Math.round(deko.tris)} Dreiecke in ${deko.batches.size} Meshes, ${dekoKit.schichten ? `${dekoKit.schichten.rows} Schichtzeilen` : 'ohne Schichten'}; weggelassen ${deko.gone.length}${deko.gone.length ? ` (${deko.gone.join(', ')})` : ''}${deko.missing ? `, ${deko.missing} ohne Knoten` : ''}; ${Math.round(performance.now() - t8)} ms`);
        } catch (e) {
          console.warn('[hangar] Hallendeko nicht gebaut', e);
          deko = null;
        }
        await pause();
      }
      if (work && gridOk) {
        const t6 = performance.now();
        try {
          const w = placeWorkshop(model, work.scenes, work.info, F, h.room, floorY, WB, grid, h.lift?.rand ? HALL_RAND.width : 0);
          model.updateMatrixWorld(true);
          const merged = await mergeFurniture(model, w.nodes, pause);
          // Bezugspunkte der Feld-Decals in den Raum der Aufzugsgruppe
          if (lift) for (const n of w.field) n.userData.anchor = n.userData.anchor.map((q, i) => q - lift.group.position.getComponent(i));
          const ride = lift && w.field.length ? await mergeFurniture(lift.group, w.field, pause) : [];
          for (const n of [...w.nodes, ...w.field]) {
            let left = false;
            n.traverse((o) => { if (o.isMesh) left = true; });
            if (!left) n.removeFromParent();
          }
          // Decals bleiben in Originalgröße (scaleFurniture), sperren der Kamera aber keinen Raum
          for (const f of merged) f.flat = !!f.mesh.material.userData.workDecal;
          furniture.push(...merged);
          const st = w.stats, tri = [...merged, ...ride].reduce((sum, f) => sum + f.mesh.geometry.index.count / 3, 0);
          console.info(`[hangar] Werkstatt: ${st.props} Requisiten, ${st.decals} Decals (${st.field} auf dem Feld) in ${merged.length + ride.length} Meshes, ${tri} Dreiecke; Anordnung ${st.source ? `aus ${st.source}` : 'eigene (keine aus dem Spiel)'}; ${st.moved} ausgewichen, ${st.rim} m Rand frei; weggelassen: ${st.inField} im Feld, ${st.blocked} verstellt, ${st.raised} nicht am Boden, ${st.overBudget} über dem Budget (${WB.props}/${WB.decals}), ${st.missing} ohne Knoten; ${grid ? `Boden ${Math.round(grid.share * 100)} % belegt (${grid.tris} Dreiecke); ` : ''}${Math.round(performance.now() - t6)} ms`);
        } catch (e) {
          console.warn('[hangar] Werkstatt nicht aufgestellt', e);
        }
        await pause();
      }
      // Abdunkelung aus dem Spiel: Im Spiel tragen die Wandmaterialien
      // %VERTCOLORS, ihr COLOR_0 ist Grau (R = G = B) und dunkelt die
      // Paneele verschieden ab. Als eigenes Attribut (hgShade, der Hallen-
      // shader nimmt den Rotkanal): Vertexfarben wären je Material ein
      // eigenes Shaderprogramm.
      let shaded = 0, padded = 0;
      model.traverse((n) => {
        if (!n.isMesh || !n.geometry.attributes.color) return;
        n.geometry.setAttribute('hgShade', n.geometry.attributes.color);
        n.geometry.deleteAttribute('color');
        for (const m of [].concat(n.material)) { m.vertexColors = false; m.userData.hgShade = true; }
        shaded++;
      });
      // Der Schalter hängt am Material: Teilt eine Geometrie ohne Farben
      // ein solches Material, bekommt sie eine helle Abdunkelung (1), sonst
      // läse der Shader einen beliebigen Wert und färbte sie schwarz.
      model.traverse((n) => {
        if (!n.isMesh || n.geometry.attributes.hgShade || ![].concat(n.material).some((m) => m.userData.hgShade)) return;
        n.geometry.setAttribute('hgShade', new THREE.BufferAttribute(new Uint8Array(n.geometry.attributes.position.count * 3).fill(255), 3, true));
        padded++;
      });
      if (shaded) console.info(`[hangar] Halle: ${shaded} Meshes mit Abdunkelung aus dem Spiel${padded ? `, ${padded} ohne eigene auf hell gesetzt` : ''}`);
      await pause();
      const uvStats = await hallUvStats(model, pause);
      await pause();
      const boxed = new Set(), seen = new Set();
      model.traverse((n) => {
        if (!n.isMesh) return;
        // Editor-Raster (grau-gelbes Platzhaltergitter) liegt als Deckel
        // unter der echten Decke und verdeckt sie; im Spiel unsichtbar.
        if ([].concat(n.material).every((m) => /grid_grayyellow/i.test(m.name))) { n.visible = false; return; }
        n.receiveShadow = true;
        n.castShadow = false;
        for (const m of [].concat(n.material)) {
          if (seen.has(m)) continue;
          seen.add(m);
          // Aufkleber (Logos, Symbole, Torbeschriftung) liegen deckungsgleich
          // auf Wand und Tor. Wächst die Halle für große Schiffe (Carrack
          // 3,9-fach, Javelin 13-fach), reicht die Tiefe dafür nicht mehr:
          // Logo und Wand flimmerten um dieselben Pixel, in der Ferne fehlten
          // Logos ganz. Zwei Tiefenstufen zur Kamera hin; mehr ließe sie durch
          // Leisten davor scheinen. Laufspuren (leakings) kämpfen nicht.
          if (/decal/i.test(m.name)) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
          // Weißer Innenraum: die Reflexe der Ersatzhalle dämpfen. Spiegelndes
          // Metall (Bodenplatten, Verkleidung) spiegelte sie sonst als flache
          // blaue Flächen, glatter Kunststoff als Gleißen.
          // Die Ersatzhalle als Umgebung macht den Raum gleichmäßig hell:
          // in der echten Halle fast ganz zurücknehmen, Licht kommt von den Lampen.
          // (Greift nur mit eigener envMap, siehe setHallEnv.)
          m.envMapIntensity = 0.05;
          if (m.isMeshStandardMaterial) m.envMap = envRT.texture;
          // Die Lackschichten der Halle liefern reinweiße Grundfarben, die
          // im Spiel erst Tönung und Schmutz abdunkeln: ohne das ist jede
          // Wand ein Leuchtkasten.
          if (!m.transparent && !m.emissiveMap && m.color) m.color.multiplyScalar(/white|plastic|marble/i.test(m.name) ? 0.58 : 0.78);
          if (/metal_grey/i.test(m.name)) {
            // Bodenplatten: gebürstetes Stahlgrau statt der hellen Glanzkarte,
            // die der Export als Farbe liefert; spiegelt ein wenig die Halle.
            m.color.multiplyScalar(0.5); m.metalness = 0.7; m.roughness = m.roughnessMap ? 1 : 0.42; m.envMapIntensity = 0.45;
            // mit der Umgebungskugel der Halle: etwas weniger, sonst spiegelt
            // der Boden die helle Decke als weißen Schleier
            m.userData.envGain = 0.75;
          } else if (m.metalness > 0.4) { m.metalness = 0.4; if (!m.roughnessMap) m.roughness = Math.max(m.roughness, 0.45); }
          else if (!m.roughnessMap) m.roughness = Math.max(m.roughness, 0.65);
          // Rauheit aus der Glätte des Spiels: die Karte entscheidet, der
          // Faktor darf sie nicht pauschal stumpf machen.
          if (m.roughnessMap) m.roughness = Math.max(m.roughness, 1);
          m.userData.noTile = !!m.map && HALL_NO_TILE.test(m.name);
          m.userData.gloss = !!m.roughnessMap && HALL_GLOSS.test(m.name);
          m.userData.cut = true;
          m.onBeforeCompile = hallShader(m);
          m.customProgramCacheKey = hallKey;
          // Leuchtleisten und Lampen sollen leuchten, nicht nur hell sein.
          // Nicht alle bringen ihre Leuchtkarte mit: dann leuchtet die Farbkarte.
          if (/light|glow/i.test(m.name) && !/glass/i.test(m.name) && m.map) {
            m.emissive.set(0xffffff); m.emissiveMap = m.emissiveMap || m.map; m.emissiveIntensity = 5;
          } else if (m.emissiveMap) m.emissiveIntensity = 4;
          for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = maxAniso;
          const us = uvStats.get(m);
          if (us && us.share > 0.4 && !boxed.has(m) && !/decal|logo|glow|leak/i.test(m.name)) { boxProject(m, us.mPerUv); boxed.add(m); m.userData.boxUv = us.mPerUv; }
          unifyMaps(m);
          onePass(m);
        }
      });
      if (boxed.size) console.info(`[hangar] ${boxed.size} Hallenmaterialien projiziert (UVs zerfallen)`);
      // Das Schiffsfeld bekommt Abzüge seiner Materialien (gleiches Programm,
      // gleiche Einstellung), die den Aufzugsweg kennen (hallLiftY); die
      // Materialien aus WORK_PAD tragen dazu die Karten des Spielbodens
      if (lift) {
        const own = new Map(), pad = work ? padFloor(work.scenes[1], work.info, opts.pad) : null, padMats = new RegExp(WORK_PAD.mats, 'i');
        for (const part of lift.group.children) {
          const m = part.material;
          if (!seen.has(m)) continue;
          if (!own.has(m)) {
            const c = m.clone();
            c.userData.lift = true;
            c.onBeforeCompile = hallShader(c);
            c.customProgramCacheKey = pitKey;
            if (pad && padMats.test(m.name)) {
              // Karten, Farbe und Rauheit des Spielbodens; spiegelt nicht
              for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) c[k] = pad.mat[k] ?? null;
              c.normalScale.copy(pad.mat.normalScale); c.color.copy(pad.mat.color);
              c.roughness = pad.mat.roughness; c.metalness = 0; c.envMapIntensity = 0.05;
              c.userData.gloss = false; c.userData.noTile = !!c.map;
              for (const t of [c.map, c.normalMap]) if (t) t.anisotropy = maxAniso;
              unifyMaps(c);
              boxProject(c, pad.tile);
              c.userData.pad = pad.name;
            } else if (m.userData.boxUv) boxProject(c, m.userData.boxUv);
            own.set(m, c);
          }
          part.material = own.get(m);
        }
        const skinned = [...own.values()].filter((c) => c.userData.pad).length;
        if (pad) console.info(`[hangar] Feldboden: ${pad.name} (Kachel ${pad.tile} m) auf ${skinned} Materialien des Felds`);
        else if (work) console.info(`[hangar] Feldboden: Lack${padPick(opts.pad) === 'lack' ? ' (gewählt)' : ' (Spielboden fehlt in der Bodendatei)'}`);
      }
      // Der Schacht darunter, im Schachtraum (Feldmitte auf dem Boden); seine
      // Materialien wie die der Halle, ohne deren Abdunkelung der weißen
      // Grundfarben (der Bausatz bringt seine Tönung mit)
      let shaft = null;
      const kit = lift ? await shaftReady : null;
      if (kit) {
        const t3 = performance.now(), lay = HALL_SHAFT[h.id];
        try {
          shaft = buildShaft(kit.kit, kit.info, F, lay);
          const wearMats = new Map();
          kit.kit.getObjectByName('wear_0')?.traverse((n) => { if (n.isMesh && n.material?.map) wearMats.set(n.material.name, n.material); });
          shaft.group.position.set(o[0], floorY, o[2]);
          hallPocket.value.set(shaft.hx, shaft.hz, 1, shaft.rimY - 0.2);
          shaft.group.traverse((n) => { if (n.isMesh) { n.receiveShadow = false; n.castShadow = false; } });
          for (const m of shaft.materials) {
            m.envMapIntensity = 0.05;
            if (m.isMeshStandardMaterial) m.envMap = envRT.texture;
            if (m.metalness > 0.4) m.metalness = 0.4;
            // flache Normalenkarte ohne Koordinaten: weg (unifyMaps gibt die neutrale)
            if (!m.userData.shaftUv) m.normalMap = null;
            // Wear-Schicht: Karten auf dem Knoten wear_0, Material <Name>_wear
            const wm = wearMats.get(`${m.name}_wear`);
            if (wm && m.userData.shaftUv) {
              m.userData.hgWear = { map: wm.map, color: wm.color.clone(), roughness: wm.roughness };
              m.userData.hgTex = [wm.map];
            }
            m.userData.hgShade = true; m.userData.shaft = true;
            // Die Vertexfarbe des Bausatzes steckt in hgShade (buildShaft legt
            // kein color an). Mit vertexColors läse der Shader ein fehlendes
            // Attribut als Schwarz: Die Wände nähmen dann kein Licht an, nur
            // die Spiegelung (so bis 16.10.2026).
            m.vertexColors = false;
            if (m.userData.deco) {
              // Beiwerk: Das Glas der Leuchten leuchtet mit seiner Karte, die
              // Lichtrahmen sind Decals, die selbst leuchten (Atlas als Schein)
              if (m.transparent || /light_atlas/i.test(m.name)) {
                m.transparent = true; m.depthWrite = false;
                m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
                if (m.map) { m.emissiveMap = m.map; m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = SHAFT_DECO_GLOW[0]; }
              } else if (m.emissiveMap) m.emissiveIntensity = SHAFT_DECO_GLOW[1];
            } else if (/glow/i.test(m.name)) {
              // Lampenglas leuchtet in der Farbe der Warnlichter, nur bei Fahrt
              m.emissiveMap = null; m.emissive.setRGB(1, 0.17, 0); m.emissiveIntensity = 0;
              shaft.glow = m;
            }
            m.onBeforeCompile = hallShader(m);
            m.customProgramCacheKey = shaftKey(m);
            unifyMaps(m);
          }
          const all = shaftLights(kit.info, shaft, lay), pk = pitPack(all, PIT_N);
          shaft.lights = pk.lights; shaft.all = all; hallPit.field = pk.field;
          pk.lights.forEach((q, i) => {
            hallPit.a.value[i].set(q.pos[0], q.pos[1], q.pos[2], 1 / (q.r * q.r));
            hallPit.b.value[i].set(q.dir[0], q.dir[1], q.dir[2], q.cosO);
            hallPit.c.value[i].set(q.col[0] * PIT_GAIN, q.col[1] * PIT_GAIN, q.col[2] * PIT_GAIN, q.kind);
          });
          // unbenutzte Plätze: Radius 0 (1/r² groß), trifft nichts
          for (let i = pk.lights.length; i < PIT_N; i++) { hallPit.a.value[i].set(0, 1e4, 0, 1e6); hallPit.c.value[i].set(0, 0, 0, 0); }
          // Lichtregie: Dunst in der Farbe der Nebellampe des Spiels, Lauflicht
          // mit einem Abstand, der rundum aufgeht
          const fog = (kit.info.lights || []).find((l) => l.role === 'fog');
          const haze = fog?.states?.emergency?.color ?? fog?.color ?? SHAFT_HAZE;
          const around = 4 * (shaft.hx + shaft.hz);
          // Verlauf nach der Tiefe des Spielschachts: Wächst er für ein hohes
          // Schiff (fit), bleiben die Lagen darunter im vollen Blau, und der
          // Schacht sieht nicht je nach vorigem Schiff anders aus
          hallShaft.a.value.set(shaft.hx, shaft.hz, shaft.depth0, SHAFT_FILL);
          hallShaft.b.value.set(haze[0], haze[1], haze[2], SHAFT_HAZE_K);
          hallShaft.f.value.set(SHAFT_FIELD, 0, SHAFT_HAZE_LAYER, SHAFT_HAZE_H);
          hallShaft.g.value.set(...SHAFT_SPILL, SHAFT_FILL_FIELD);
          hallShaft.beam.value.z = SHAFT_BEAM;
          hallShaft.c.value.set(SHAFT_RUN[0] * SHAFT_RUN_GAIN, SHAFT_RUN[1] * SHAFT_RUN_GAIN, SHAFT_RUN[2] * SHAFT_RUN_GAIN, 0);
          hallShaft.d.value.set(SHAFT_RUN[0] * SHAFT_HAZE_WARN, SHAFT_RUN[1] * SHAFT_HAZE_WARN, SHAFT_RUN[2] * SHAFT_HAZE_WARN, SHAFT_HAZE_MAX);
          hallShaft.e.value.set(Math.round(around / SHAFT_RUN_GAP) / around, 0, SHAFT_HAZE_LUM, SHAFT_RIM);
          shaft.around = around;
          // Kegel und Lichthöfe neben dem Schacht (fit baut sh.pit neu), sichtbar mit ihm
          shaft.fx = new THREE.Group(); shaft.fx.name = 'shaft:fx'; shaft.fx.visible = false;
          for (const fx of shaftFx(shaft, all, Q0 !== 'niedrig')) shaft.fx.add(fx);
          shaft.group.add(shaft.fx);
          // Stirn der Bodenplatte an der Öffnung, sichtbar mit dem Schacht
          // (in Ruhe deckt das Feld sie zu), im Material der Halle
          const t4 = performance.now(), slab = await hallSlab(model, F, [o[0], floorY, o[2]], new Set([lift.group]), pause), t5 = performance.now();
          if (slab) {
            shaft.edge = shaftEdge(slab, shaft.hx, shaft.hz);
            shaft.edge.visible = false;
            shaft.group.add(shaft.edge);
          }
          shaft.pit.visible = false;
          // Schachttor: Materialien wie die der Halle (es liegt im Boden und
          // nimmt das Hallenlicht, nicht die Schachtlampen), sichtbar mit dem
          // Schacht (in der Bildschleife)
          const gk = await gateReady;
          if (gk) {
            try {
              const G = buildGate(gk.scene, gk.info, shaft, kit.info.shaft?.inner);
              // Gleichnamige Materialien des Schachts tragen dieselben Karten
              // (verify:hangar-hall [15] vergleicht die Bilder): deren Texturen
              // statt einer zweiten Kopie im Grafikspeicher
              const twins = new Map();
              kit.kit.traverse((n) => { if (n.isMesh) for (const m of [].concat(n.material)) twins.set(m.name, m); });
              let shared = 0, steel = 0;
              // Schmutz (GATE_GRIME): die Karte des weißen Hallenlacks, schon geladen
              const white = [...seen].filter((h) => h.map && /mtl_metal_white_03$/i.test(h.name));
              const grime = (white.find((h) => /kit_master/i.test(h.name)) ?? white[0])?.map ?? null;
              if (grime) grime.anisotropy = maxAniso;
              // Boden der Halle (GATE_FLOOR): glatter weißer Lack mit Kratzern
              const floorM = white.find((h) => h.userData.gloss && /kit_master/i.test(h.name)) ?? white.find((h) => h.userData.gloss) ?? null;
              let floored = 0;
              for (const b of G.batches) {
                const m = b.material, twin = twins.get(m.name);
                if (twin) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k] && twin[k] && !isNeutral(twin[k]) && m[k] !== twin[k]) { m[k].dispose(); m[k] = twin[k]; shared++; }
                m.envMapIntensity = 0.05;
                if (m.isMeshStandardMaterial) m.envMap = envRT.texture;
                // Metall wie die Bodenplatten der Halle (GATE_SLOT)
                if (m.metalness > 0.4) { m.color.multiplyScalar(0.5); m.metalness = 0.7; m.userData.envGain = 0.75; steel++; }
                m.vertexColors = false; m.userData.hgShade = true;
                if (/glow/i.test(m.name) && m.emissiveMap) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = GATE_GLOW; }
                for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = maxAniso;
                m.userData.gate = true; m.userData.hgGrime = grime;
                if (floorM && GATE_FLOOR.re.test(m.name)) {
                  // farbige Lacke (der blaue) behalten ihre Farbe, die grauen nehmen die des Bodens
                  if (!matHue(m.color)) m.color.copy(floorM.color);
                  for (const k of ['map', 'roughnessMap', 'metalnessMap', 'normalMap']) m[k] = floorM[k];
                  m.metalness = floorM.metalness; m.roughness = floorM.roughness;
                  if (m.normalScale && floorM.normalScale) m.normalScale.copy(floorM.normalScale);
                  m.userData.gloss = floorM.userData.gloss; m.userData.noTile = floorM.userData.noTile;
                  m.userData.envGain = floorM.userData.envGain;
                  m.userData.gateFloor = true; m.userData.hgGrime = null;
                  floored++;
                }
                m.onBeforeCompile = hallShader(m);
                m.customProgramCacheKey = gateKey(m);
                unifyMaps(m);
              }
              G.group.visible = false;
              shaft.group.add(G.group);
              shaft.gate = G;
              console.info(`[hangar] Schachttor: ${G.used} Teile, ${G.tris} Dreiecke, ${G.batches.length} Materialien (${G.mats.join(', ')}), Lack aus der Palette ${gk.info.palette?.name ?? "(keine)"}: ${G.lacke.join(', ') || 'keiner'}, ${G.turn} drehen (an der Fuge: ${G.seam.join(', ') || 'keiner verschoben'}), ${steel} Metall wie die Bodenplatten, ${floored} Lack wie der Hallenboden, Schmutz ${grime ? 'wie der Hallenlack' : 'fehlt'}, längs ×${G.sz.toFixed(3)}, Unterkante ${G.bottom.toFixed(2)} m, deckt ab ${G.cover.toFixed(2)} von ${G.T} s; offen tiefer in der Nische: ${G.stowed.join(', ') || 'keins'}; offen nicht hinter der Nische: ${G.cut.join(', ') || 'keins'}; Seiten zugleich: ${G.sync.join(', ') || 'keine'}; ${shared} Karten vom Schacht; ohne ${G.dropped.join(', ') || 'keins'}; Fahrkurve ${G.ease ? 'aus dem Spiel' : 'eigene'}`);
            } catch (e) {
              console.warn('[hangar] Schachttor nicht gebaut', e);
            }
          }
          // Fester Rand: Gitterstegring um das Feld, in Ruhe sichtbar; der
          // Hallenboden darunter ist ausgespart (hgCut), die Stirn der
          // Bodenplatte an der Feldkante übernimmt die Innenkante des Stegs
          const rk = await randReady;
          if (rk) {
            try {
              const R = buildRand(rk.scene, rk.info, shaft, kit.info.shaft?.inner);
              // Materialien wie die der Halle (der Rand liegt im Boden und
              // nimmt das Hallenlicht; die des Schachts nähmen nur die
              // Schachtlampen und lägen in Ruhe schwarz), Karten gleichnamiger
              // Schachtmaterialien statt einer zweiten Kopie (verify:hangar-hall
              // [16] vergleicht die Bilder)
              const twins = new Map();
              kit.kit.traverse((n) => { if (n.isMesh) for (const m of [].concat(n.material)) twins.set(m.name, m); });
              let shared = 0;
              const own = new Set();
              for (const mesh of R.meshes) {
                const m = mesh.material, twin = twins.get(m.name);
                if (own.has(m)) continue;
                own.add(m);
                if (twin) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k] && twin[k] && !isNeutral(twin[k]) && m[k] !== twin[k]) { m[k].dispose(); m[k] = twin[k]; shared++; }
                m.envMapIntensity = 0.05;
                if (m.isMeshStandardMaterial) m.envMap = envRT.texture;
                if (m.metalness > 0.4) m.metalness = 0.4;
                m.vertexColors = false; m.userData.hgShade = true;
                if (/glow/i.test(m.name) && (m.emissiveMap || m.map)) { m.emissiveMap = m.emissiveMap || m.map; m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = RAND_GLOW; }
                if (m.transparent) { m.depthWrite = false; }
                for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = maxAniso;
                m.onBeforeCompile = hallShader(m);
                m.customProgramCacheKey = hallKey;
                unifyMaps(m);
              }
              shaft.group.add(R.group);
              shaft.rand = R;
              // Hallenboden aus: zwischen Feldkante und Außenkante des Stegs
              hallCut.value.set(shaft.hx + 0.005, shaft.hz + 0.005, shaft.hx + R.width - 0.01, shaft.hz + R.width - 0.01);
              if (shaft.edge) { shaft.group.remove(shaft.edge); shaft.edge.geometry.dispose(); shaft.edge = null; }
              console.info(`[hangar] Rand: ${R.parts} Teile, ${R.tris} Dreiecke, ${R.meshes.length} Materialien (${R.meshes.filter((x) => x.userData.noUv).length} ohne Texturkoordinaten), ${shared} Karten vom Schacht, ${R.width} m breit um das Feld; Hallenboden darunter ausgespart`);
            } catch (e) {
              console.warn('[hangar] Rand nicht gebaut', e);
            }
          }
          model.add(shaft.group);
          console.info(`[hangar] Schacht: ${shaft.tris + shaft.restTris} Dreiecke in ${shaft.parts + 4} Teilen, ${shaft.depth} m tief; Beiwerk ${shaft.decoParts ?? 0} Teile, ${shaft.decoTris ?? 0} Dreiecke; ${pk.lights.length} von ${pk.groups} Lampengruppen, ${pk.field} davon auch aufs Feld (${all.length} Lampen aus dem Spiel, Platz für ${PIT_N}); Rand: ${slab ? `Bodenplatte ${slab.t} m (${slab.mat.name}) mit Stirn` : 'keine Bodenplatte gefunden, ohne Stirn'}, Nische ${SHAFT_RIM_DEPTH} m unter ${SHAFT_SLOT_LIP} m Lippe, dunkel nach hinten (Suche ${Math.round(t5 - t4)} ms); ${Math.round(performance.now() - t3)} ms`);
        } catch (e) {
          console.warn('[hangar] Schacht nicht gebaut', e);
          shaft = null;
        }
      }
      // Hallendeko: steht fest, Matrizen je Maßstab in scaleWorld (layDeko)
      if (deko) model.add(deko.group);
      // Wartungsplatz (buildDienst): fährt mit dem Feld, gestellt je Schiff in scaleWorld
      let dienst = null;
      const dienstKit = lift ? await dienstReady : null;
      if (dienstKit) {
        try {
          dienst = buildDienst(dienstKit.scene, dienstKit.schichten);
          model.add(dienst.group);
        } catch (e) {
          console.warn('[hangar] Wartungsplatz nicht gebaut', e);
          dienst = null;
        }
      }
      // Die Lampen stehen schon (oder kommen nie): erst übersetzen und
      // hochladen, dann einhängen, in denselben Modellraum wie die Lampen.
      await lampsReady;
      await prepare(model);
      if (hallLamps) {
        hallLamps.position.copy(model.position);
        hallVol.min.value.fromArray(hallVol.at).add(model.position);
      }
      hallRoot.add(model);
      if (!hallRoot.parent) scene.add(hallRoot);
      const mats = new Set();
      model.traverse((n) => { if (n.isMesh) for (const m of [].concat(n.material)) mats.add(m); });
      realHall = { group: hallRoot, model, room: h.room, spot: o, mats, floorY, furniture, lift: lift?.group ?? null, liftL: lift ? F : null, shaft, dienst, deko };
      // Dampf gleich mit übersetzen: sein erster Stoß soll nicht ruckeln
      if (steam && lift) prepare(steam.mesh).catch(() => {});
      // Stand vorher die gebaute Halle, weicht sie (in der echten Halle gibt
      // es nur Spielinhalte).
      if (hall) { hall.visible = false; floor.visible = false; dust.pts.visible = false; }
      // Hinter den Wänden ist dunkel: Durch die feinen Spalte, die schon die
      // Spielgeometrie hat (Nähte, Schlitze im Nordtor, Symbole der
      // Glassäulen, deren Innenleben die dichte Stufe weglässt), leuchtete
      // der hellgraue Hintergrund als weiße Punkte und Flecken. Das
      // Innenleben der Glassäulen bringt die Möbeldatei aus der vollen Stufe
      // (swapHallDetail), am Telefon die Telefon-Datei. Der Dunst bleibt
      // hellgrau.
      scene.background = new THREE.Color(0x1e2024);
      scene.fog.color.set(0x9aa0a8);
      // Bühnenlicht statt Raumlicht: das Schiff steht im Lichtkegel, die Halle
      // tritt zurück — sonst ist das helle Innere eine einzige weiße Fläche.
      // Bodenfarbe der Halbkugel = Rücklicht vom hellen Boden: Ohne sie
      // bleibt die nach unten gewandte Decke ein schwarzes Loch.
      hemi.color.set(0xffefdc); hemi.groundColor.set(0x8a8178);
      key.angle = 0.5; key.penumbra = 0.75;
      hallStage();
      renderer.toneMappingExposure = 0.9;
      settleShip(0.02);
      if (lastInfo) scaleWorld(lastInfo);
      camFree = null; freeDirty = true;
      const probe = await probeReady;
      if (probe) useHallProbe(probe); else captureHallEnv(true);
      // die Kamera stand womöglich für die gebaute (größere) Halle
      if (fly) fly.b.radius = Math.min(fly.b.radius, homeDist());
      else if (!touched) camera.position.copy(homePos());
      else camera.position.sub(controls.target).clampLength(controls.minDistance, controls.maxDistance).add(controls.target);
      prog.delete('hall'); prog.delete('furniture'); prog.delete('lift'); prog.delete('workshop'); prog.delete('workshop-floor'); prog.delete('dienst'); prog.delete('deko');
      return true;
    }).catch((e) => {
      // ohne echte Halle die gebaute
      console.warn('[hangar] Halle nicht geladen', e);
      prog.delete('hall'); prog.delete('furniture'); prog.delete('lift'); prog.delete('workshop'); prog.delete('workshop-floor'); prog.delete('dienst'); prog.delete('deko');
      hallFailed = true;
      dropHallLamps();
      buildStage();
      return false;
    });
  }

  // Umgebungsverdeckung (GTAO) nur in der echten Halle: erst sie setzt
  // Ecken, Fugen und den Boden unter dem Schiff ab. Nachgeladen, damit die
  // gebaute Halle ohne die Zusatzpässe auskommt. Mit echter Halle gleich zu
  // Beginn, parallel zum Laden: Halle und Schiff werden dann von vornherein
  // für das Zwischenbild übersetzt.
  let composer = null, aoPromise = null;
  function enableAO() {
    if (!renderer.capabilities.isWebGL2) return Promise.resolve();
    return (aoPromise ??= buildComposer());
  }
  async function buildComposer() {
    try {
      const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { UnrealBloomPass }, { OutputPass }, { Pass, FullScreenQuad }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/GTAOPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/postprocessing/Pass.js'),
      ]);
      // Eigenes Ziel mit 4-fach-MSAA: der Composer umgeht sonst die
      // Kantenglättung des Renderers, und jede Kante treppt.
      const rt = new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, samples: 4 });
      // Mit Tiefenbild: Die Verdeckung liest die Tiefe des Bildes, statt die
      // Szene ein zweites Mal für Normalen und Tiefe zu zeichnen (ao unten)
      rt.depthTexture = new THREE.DepthTexture(W(), H());
      // Die Szene zeichnet immer in rt (readBuffer), das zweite Ziel des
      // Composers nimmt nur Vollbild-Pässe auf (Verdeckung aufs Bild, Schein)
      // und braucht weder Kantenglättung noch Tiefe. Als Kopie von rt hatte
      // es beides, und jeder Pass dorthin wurde einmal mehr aufgelöst: 10 %
      // der Arbeit des Chips (2026-10-18, voll ausgelastet gemessen).
      const flat = new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, depthBuffer: false });
      const c = new EffectComposer(renderer, flat);
      c.renderTarget2.dispose();
      c.renderTarget2 = c.readBuffer = rt;
      // Zwei Pässe tauschen je Bild (aoMix, Ausgabe): Die Szene landet so
      // immer in rt. Fiele ein Tausch weg, zeichnete sie sonst ohne Tiefe.
      const composeOnce = c.render.bind(c);
      c.render = (dt) => {
        if (c.readBuffer !== rt) c.swapBuffers();
        composeOnce(dt);
      };
      c.setPixelRatio(pixelRatio * pixelScale);
      c.setSize(W(), H());
      c.addPass(new RenderPass(scene, camera));
      // Verdeckung in einem Viertel der Auflösung je Achse (2026-10-18; vorher
      // halb, seit 2026-10-15): Verdeckung und Entrauschen rechnen je Pixel
      // rund 80 Texturzugriffe (36 Tiefen für die Horizonte, 16 × 3 fürs
      // Entrauschen) und kosteten in halber Auflösung 22 % der Arbeit des
      // Chips; ein Viertel sparte 19 %. Im Bildvergleich bei fester Kamera
      // weichere Säume an Schiffskanten und Bodenleisten, sonst gleich (0,49
      // von 255 im Mittel, zwei Aufnahmen desselben Stands 0,22).
      const AO_DIV = 4;
      const ao = new GTAOPass(scene, camera, Math.max(1, Math.round(W() / AO_DIV)), Math.max(1, Math.round(H() / AO_DIV)));
      const aoSize = ao.setSize.bind(ao);
      ao.setSize = (w, h) => aoSize(Math.max(1, Math.round(w / AO_DIV)), Math.max(1, Math.round(h / AO_DIV)));
      // Normalen aus der Tiefe des Bildes statt aus einem eigenen Durchgang
      // (2026-10-18): Der zeichnete die ganze Szene noch einmal, mit der
      // Gladius 326 Aufrufe und 2 ms Prozessorzeit je Bild.
      ao.setGBuffer(rt.depthTexture);
      ao.normalRenderTarget.dispose();
      // Der Pass rechnet nur die Verdeckung; aufs Bild legt sie aoMedianPass
      // (ohne Ausgabe schreibt er nichts ins Zielbild, also auch kein Tausch).
      ao.output = GTAOPass.OUTPUT.Off;
      ao.needsSwap = false;
      ao.blendIntensity = 1;
      ao.updateGtaoMaterial({ radius: 2.5, distanceExponent: 1.4, thickness: 2, scale: 1.2, samples: 16 });
      // Halbmesser in Pixeln des Passes: 3 im Viertel = 12 Bildpunkte (gemessen so)
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 3, rings: 2, samples: 16 });
      c.addPass(ao);
      const aoMix = aoMedianPass(ao, Pass, FullScreenQuad);
      c.addPass(aoMix);
      // Lichtschein um Lampen, Leuchtleisten und Triebwerke: nur was
      // deutlich heller als Weiß ist, damit helle Wände nicht mitglühen.
      c.addPass(new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.25, 0.35, 6));
      const bloom = c.passes[c.passes.length - 1];
      // Ein einziger ungültiger Bildpunkt (NaN, unendlich) verschmiert in der
      // Unschärfe des Scheins über das ganze Bild, und es wird schwarz (so
      // beim Schiffswechsel am 16.10.2026). Vor dem Schein darum aussortieren:
      // per Bitprüfung (Exponent voll), denn isnan und min/max kürzen
      // Übersetzer weg oder deuten sie je nach Gerät anders; und vor dem
      // Filtern, denn der Schein liest das Bild in halber Größe, und ein
      // gefilterter Wert aus einem NaN ist je nach Gerät NaN oder riesig.
      // Darum die vier Nachbarn einzeln holen und selbst mischen (so wie die
      // Filterung). Dazu oben begrenzt, weit über jeder Lampe (Leuchtflächen
      // bis 6): Manche Geräte machen beim Glätten der Kanten aus NaN einen
      // Riesenwert. Ein solcher Punkt bleibt ein Punkt und gibt keinen Schein.
      const hp = bloom.materialHighPassFilter, TEXEL = 'vec4 texel = texture2D( tDiffuse, vUv );', MAIN = 'void main() {';
      if (hp.fragmentShader.includes(TEXEL) && hp.fragmentShader.split(MAIN).length === 2) hp.fragmentShader = hp.fragmentShader.replace(MAIN, `vec4 hgOk( ivec2 q ) {
			vec4 t = texelFetch( tDiffuse, clamp( q, ivec2( 0 ), textureSize( tDiffuse, 0 ) - 1 ), 0 );
			return mix( clamp( t, 0.0, 512.0 ), vec4( 0.0 ), equal( floatBitsToUint( t ) & 0x7f800000u, uvec4( 0x7f800000u ) ) );
		}
		${MAIN}`).replace(TEXEL, `vec2 st = vUv * vec2( textureSize( tDiffuse, 0 ) ) - 0.5, w = fract( st );
			ivec2 c = ivec2( floor( st ) );
			vec4 texel = mix( mix( hgOk( c ), hgOk( c + ivec2( 1, 0 ) ), w.x ), mix( hgOk( c + ivec2( 0, 1 ) ), hgOk( c + 1 ), w.x ), w.y );`);
      else console.warn('[hangar] Schein: Eingang nicht begrenzt (three.js geändert?)');
      c.addPass(new OutputPass());
      // Rauschen von ±½ Stufe des 8-Bit-Bilds nach der Umrechnung in sRGB
      // (20.10.2026): Ohne es treppten sanfte Verläufe in Bänder, der Dunst
      // im Schacht, die dunklen Ecken der Halle, der Schein um die Lampen.
      // Dreiecksverteilt (zwei Zufallswerte), fest je Bildpunkt.
      const outPass = c.passes[c.passes.length - 1], OETF = 'gl_FragColor = sRGBTransferOETF( gl_FragColor );';
      if (outPass.material.fragmentShader.split(OETF).length === 2) outPass.material.fragmentShader = outPass.material.fragmentShader.replace(OETF, `${OETF}
				vec2 hgD = fract( sin( vec2( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ), dot( gl_FragCoord.xy, vec2( 39.3468, 11.1357 ) ) ) ) * 43758.5453 );
				gl_FragColor.rgb += ( hgD.x + hgD.y - 1.0 ) / 255.0;`);
      else console.warn('[hangar] Ausgabe: kein Dither (three.js geändert?)');
      // Die Shader der Pässe jetzt übersetzen, solange das Laden ohnehin läuft
      // (die Verdeckung ist darunter der schwerste), dann ein Probebild für
      // die übrigen kleinen. Vollbildpässe zeichnen ohne Lichter.
      const quad = new THREE.Group(), plane = new THREE.PlaneGeometry(2, 2);
      for (const m of [ao.gtaoMaterial, ao.pdMaterial, aoMix.material, aoMix.medMaterial,
        bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial]) {
        if (m) quad.add(new THREE.Mesh(plane, m));
      }
      await compileFor(quad, rt, quad);
      plane.dispose();
      c.render();
      composer = c;
    } catch { /* ohne Verdeckung weiter */ }
  }

  let current = null;      // { group, model, born, mat, info, lift? }
  let leaving = null;      // { group, t0, c }
  // Aufzug: y in Modellmetern (≤ 0 unter dem Boden); wer auf das Ende der
  // Fahrt wartet, steht in wait (auch wenn die Fahrt unterwegs umkehrt)
  const lift = { y: 0, from: 0, to: 0, t0: 0, dur: 0, wait: [] };
  // delay: fährt erst so viel später los (wartet auf das Tor)
  function liftTo(y, ms, delay = 0) {
    return new Promise((done) => {
      lift.wait.push(done);
      if (Math.abs(y - lift.y) < 1e-4) { lift.dur = 0; lift.y = y; settleLift(); return; }
      // fährt sie schon dorthin (Weiterklicken während der Fahrt hinab),
      // bleibt die Fahrt, wie sie ist: Neu angesetzt finge die Kurve wieder
      // bei null an, die Plattform stockte, und jeder Klick verlängerte sie
      if (lift.dur > 0 && Math.abs(y - lift.to) < 1e-4) return;
      // fährt sie schon und kehrt nur um oder ändert das Ziel (schnelles
      // Weiterklicken), rastet nichts neu aus: kein zweites Anfahren (fx.liftGo)
      const moving = lift.dur > 0 && lift.going;
      lift.from = lift.y; lift.to = y; lift.t0 = performance.now() + delay; lift.dur = ms;
      lift.going = moving;
      // neue Fahrt, neuer Halt (SND_HIT vor dem Stillstand); war er schon, holt fx.frame die Schleife wieder
      lift.halted = false;
      lift.last = { from: lift.from, to: y, t0: lift.t0, dur: ms };
    });
  }
  // Fahrkurve: mit Tor die der Spielplattform (sanft wie ein Sinus), sonst
  // ease-in-out kubisch; liftEaseInv sucht die Zeit zu einem Wegstück
  const liftEase = (k) => realHall?.shaft?.gate?.ease?.(k) ?? (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const liftEaseInv = (f) => {
    let a = 0, b = 1;
    for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (liftEase(m) < f) a = m; else b = m; }
    return (a + b) / 2;
  };
  // Schachttor (buildGate): geht zu, sobald die Oberkante des alten Schiffs
  // unter ihm ist, und auf, bevor die des neuen es erreicht. G.run: die
  // laufende Bahn (Richtung, Beginn, Startzeit auf der Bahn, überblendet?);
  // G.pend: Schließen wartet auf freie Bahn unter dem Tor. Wer wartet, steht
  // in G.wait und kommt frei, sobald das Tor steht, auch nach einer Umkehr.
  const gateOf = () => (reduceMotion ? null : realHall?.shaft?.gate ?? null);
  // Höhe des Felds, bei der die Oberkante des Schiffs (oder des höheren
  // Geräts am Wartungsplatz, layDienst) HALL_GATE.clear unter dem Tor ist
  const gateClearY = (G, info) => G.bottom - HALL_GATE.clear - Math.max(info.height, info.dienstTop ?? 0) / hallRoot.scale.x;
  function gateSettle(G) {
    const w = G.wait;
    G.wait = [];
    for (const f of w) f();
  }
  function gateStart(G, dir, t0 = performance.now()) {
    let tau0 = 0, snap = false;
    if (G.run) {
      // Umkehr unterwegs: weiter ab der Stelle der neuen Bahn, die der Lage
      // am nächsten kommt; den Rest überblendet gatePose
      for (const u of G.parts) { u.snap.copy(u.at); u.snapQ.copy(u.q); }
      let best = Infinity;
      for (let i = 0; i <= 125; i++) {
        const tau = (G.T * i) / 125;
        let d = 0;
        for (const u of G.parts) d += gateAt(u.keys[dir], tau, G.v).distanceTo(u.at);
        if (d < best) { best = d; tau0 = tau; }
      }
      snap = true;
    }
    G.run = { dir, t0, tau0, snap };
    // Rest der Bahn; nach einer Umkehr steht das Tor frühestens nach
    // GATE_BLEND_MS (gateFrame), dorthin gehört auch der Anschlag des Tons
    const rest = ((G.T - tau0) * HALL_GATE.ms) / G.T;
    fx.gateGo(dir, snap ? Math.max(rest, GATE_BLEND_MS) : rest, performance.now() - t0);
  }
  function gateClose(info) {
    const G = gateOf();
    if (!G) return null;
    return new Promise((done) => {
      G.wait.push(done);
      if (G.run?.dir === 'close') return;
      if (G.state === 'closed' && !G.run) { gateSettle(G); return; }
      G.pend = { y: gateClearY(G, info), t: performance.now() };
    });
  }
  function gateOpen() {
    const G = gateOf();
    if (!G) return null;
    G.pend = null;
    return new Promise((done) => {
      G.wait.push(done);
      if (G.run?.dir === 'open') return;
      if (G.state === 'open' && !G.run) { gateSettle(G); return; }
      gateStart(G, 'open');
    });
  }
  function gateFrame(now) {
    const G = gateOf();
    if (!G) return;
    if (G.pend && lift.y <= G.pend.y) {
      // ab dem Augenblick, in dem die Oberkante unter dem Tor war, nicht erst
      // ab diesem Bild (bei wenigen Bildern je Sekunde ginge es sonst zu spät zu)
      const L = lift.last, f = L && L.to < L.from ? (G.pend.y - L.from) / (L.to - L.from) : -1;
      const t = f >= 0 && f <= 1 ? Math.min(now, Math.max(G.pend.t, L.t0 + L.dur * liftEaseInv(f))) : now;
      G.pend = null;
      gateStart(G, 'close', t);
    }
    const r = G.run;
    if (!r) return;
    const tau = Math.min(G.T, r.tau0 + ((now - r.t0) * G.T) / HALL_GATE.ms);
    const b = r.snap ? Math.min(1, (now - r.t0) / GATE_BLEND_MS) : 1;
    gatePose(G, r.dir, tau, b);
    if (tau >= G.T && b >= 1) {
      G.run = null;
      G.state = r.dir === 'close' ? 'closed' : 'open';
      fx.gateStop(r.dir, now - (r.t0 + ((G.T - r.tau0) * HALL_GATE.ms) / G.T));
      gateSettle(G);
    }
  }
  // Fahrt hinab: mit Tor so lange, dass es das Feld HALL_GATE.lead vor dem
  // Halt ganz deckt. Es beginnt, wenn die Oberkante des Schiffs darunter ist
  // (bei kc der Fahrzeit), und braucht bis zum Decken G.cover der Bahn.
  function liftDownMs(info, to) {
    const G = gateOf();
    if (!G || !(to < lift.y)) return LIFT_DOWN_MS;
    const kc = liftEaseInv(Math.min(1, Math.max(0, (gateClearY(G, info) - lift.y) / (to - lift.y))));
    return Math.max(LIFT_DOWN_MS, ((G.cover * HALL_GATE.ms) / G.T + HALL_GATE.lead) / Math.max(0.25, 1 - kc));
  }
  // Auffahrt: mit Tor erst auf, dann hinauf. Die Oberkante des Schiffs
  // erreicht das Tor erst, wenn es offen ist; die Fahrt beginnt dafür so
  // viel später wie nötig.
  function liftUp(info) {
    const G = gateOf();
    if (!G) return liftTo(0, LIFT_UP_MS);
    gateOpen();
    const left = G.run ? ((G.T - Math.min(G.T, G.run.tau0 + ((performance.now() - G.run.t0) * G.T) / HALL_GATE.ms)) * HALL_GATE.ms) / G.T + (G.run.snap ? GATE_BLEND_MS : 0) : 0;
    const y0 = lift.y, yc = gateClearY(G, info);
    const reach = y0 < yc ? LIFT_UP_MS * liftEaseInv((yc - y0) / -y0) : 0;
    return liftTo(0, LIFT_UP_MS, Math.max(0, left + GATE_SLACK_MS - reach));
  }
  function settleLift() {
    const w = lift.wait;
    lift.wait = [];
    for (const f of w) f();
  }
  // Dampf und Geräusche zur Mechanik (buildSteam, hangarSound): Anlässe aus
  // frame (Plattform fährt los, rastet ein) und gateStart/gateFrame (Tor
  // läuft, rastet ein). Kam ein Anlass verspätet an (Seite verborgen, dann
  // holte frame die Fahrt nach), bleibt er stumm und ohne Dampf.
  // Lage in der Halle: das Feld liegt mittig um den Ursprung (wie die Crew,
  // die mitfährt), Maße mal Hallenmaßstab k; Dampf nur in der Nähe des
  // Schiffs, das Feld reicht weit hinter die Kamera.
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Höchstens ein Anlass je Art in so vielen ms (20.10.2026, Krisz: „wenn ich
  // den pfeil spamme der das nächste schiff ruft spammt auch dampfgeräusch
  // undso“): Jeder Klick kehrte Plattform und Tor um, und jede Umkehr setzte
  // Zischen, Schlag und Dampf neu an, bis sie sich stapelten.
  const FX_GAP = { liftGo: 1800, liftStop: 1200, vapour: 2500, seam: 1800, gateStop: 900 };
  const fxLast = new Map();
  const fxOk = (key) => {
    const now = performance.now();
    if (now - (fxLast.get(key) ?? -1e9) < FX_GAP[key]) return false;
    fxLast.set(key, now);
    return true;
  };
  const fx = {
    field() {
      const L = realHall?.liftL;
      if (!L || !steam) return null;
      const k = hallRoot.scale.x, hx = (L.to[0] - L.from[0]) * k / 2, hz = (L.to[1] - L.from[1]) * k / 2;
      const zl = Math.min(hz, ((current?.info.len ?? 20) / 2 + 7) * Math.max(1, k * 0.6));
      return { k, hx, hz, zl };
    },
    // Stoß an den Langseiten des Felds: aus dem Spalt zwischen Feld und
    // Boden nach außen und oben; n je Seite, Stärke w
    edges(t, n, w) {
      const F = this.field();
      if (!F) return;
      const { k, hx, zl } = F;
      n = Math.max(2, Math.round(n * steamK));
      for (const sx of [-1, 1]) for (let i = 0; i < n; i++) {
        // unregelmäßig: Lage, Zeit, Größe und Wucht streuen, sonst steht
        // eine Reihe gleicher Ballen am Rand
        // klein und dicht aus dem Spalt, rasch breit und dünn
        const z = ((i + rnd(-0.3, 1.3)) / n * 2 - 1) * zl, b = t + rnd(0, 0.3) * rnd(0, 1), f = rnd(0.55, 1.25);
        steam.puff(b, [sx * (hx + rnd(-0.2, 0.3) * k), rnd(0.05, 0.25) * k, z], [sx * rnd(3, 6) * w * k * f, rnd(1.5, 3.5) * w * k * f, rnd(-1, 1) * k],
          rnd(1.8, 3) * (0.7 + 0.3 * w), rnd(0.4, 1) * k, rnd(3, 6) * k * (0.6 + 0.4 * w), rnd(0.7, 0.95) * w, rnd(0.5, 0.9) * k, rnd(0.4, 0.9) * k);
        // flach über den Boden nach außen rollend
        if (i % 2 === 0) steam.puff(b + 0.08, [sx * (hx + 0.4 * k), 0.25 * k, z], [sx * rnd(1.5, 2.6) * w * k, rnd(0.05, 0.2) * k, rnd(-0.4, 0.4) * k],
          rnd(3, 4), rnd(1, 1.6) * k, rnd(5, 8) * k * (0.6 + 0.4 * w), rnd(0.3, 0.4) * w, 0.1 * k, 0.6 * k);
      }
    },
    // Mittelfuge des Tors: beim Einrasten quillt der Dampf hoch
    seam(t, n) {
      const F = this.field();
      if (!F) return;
      const { k, zl } = F;
      n = Math.max(3, Math.round(n * steamK));
      for (let i = 0; i < n; i++) {
        const z = ((i + rnd(-0.4, 1.4)) / n * 2 - 1) * zl, f = rnd(0.5, 1.3);
        steam.puff(t + rnd(0, 0.25) * rnd(0, 1), [rnd(-0.4, 0.4) * k, rnd(0.05, 0.2) * k, z], [rnd(-1.2, 1.2) * k, rnd(3, 5.5) * k * f, rnd(-0.5, 0.5) * k],
          rnd(1.6, 2.8), rnd(0.35, 0.9) * k, rnd(3.5, 6.5) * k, rnd(0.7, 0.95), rnd(0.4, 0.8) * k, rnd(0.3, 0.8) * k);
      }
    },
    // Schwaden aus dem Schacht, solange das Tor aufgeht (warme Luft von unten)
    vapour(t, n, ms) {
      const F = this.field();
      if (!F) return;
      const { k, hx, zl } = F;
      n = Math.max(3, Math.round(n * steamK));
      for (let i = 0; i < n; i++) {
        const z = rnd(-1, 1) * zl, f = i / n;
        steam.puff(t + f * ms / 1000 * 0.55, [rnd(-1, 1) * hx * (0.15 + 0.6 * f), -0.6 * k, z], [rnd(-0.4, 0.4) * k, rnd(1, 1.8) * k, rnd(-0.4, 0.4) * k],
          rnd(3.5, 5), rnd(2, 3) * k, rnd(6, 10) * k, rnd(0.14, 0.22), 0.6 * k, 1 * k);
      }
    },
    // Klänge: siehe hangarSound. Anfahren und Fahrschleife beim Losfahren;
    // der Halt kommt aus frame, SND_HIT vor dem Stillstand.
    liftGo(dir, late) {
      if (late > 400 || !fxOk('liftGo')) return;
      sound.rideStart();
      if (dir === 'down') this.edges((performance.now() - T0) / 1000, 6, 0.55);
    },
    liftHalt(dir, late) {
      if (late > 400) { sound.hush(); return; }
      sound.rideHalt(late);
    },
    liftStop(dir, late) {
      if (late > 400 || !fxOk('liftStop')) return;
      if (dir === 'up') this.edges((performance.now() - T0) / 1000, 18, 1);
    },
    // ms: Rest der Bahn ab dem Einsatz, late: so lange läuft sie schon. Der
    // Anschlag der Aufnahme fällt auf das Ende der Bahn.
    gateGo(dir, ms, late) {
      sound.gate(dir, (ms - Math.max(0, late)) / 1000);
      if (late > 400 || dir !== 'open' || !fxOk('vapour')) return;
      this.vapour((performance.now() - T0) / 1000, 30, ms);
    },
    gateStop(dir, late) {
      sound.gateDone();
      if (late > 400 || !fxOk('gateStop')) return;
      if (dir === 'close' && fxOk('seam')) this.seam((performance.now() - T0) / 1000, 40);
    },
    // je Bild: Teilchen auf die Uhr; der Ton folgt der Mechanik. Fehlt er zu
    // einem laufenden Tor oder einer Fahrt (Seite war verborgen, Ton eben
    // eingeschaltet, Klänge erst jetzt geladen), setzt er dort ein, wo die
    // Bewegung steht.
    frame(now, t) {
      if (steam) steam.frame(t);
      const G = realHall?.shaft?.gate;
      let cover = 0;
      if (G?.run) {
        const r = G.run, tau = Math.min(G.T, Math.max(0, r.tau0 + ((now - r.t0) * G.T) / HALL_GATE.ms));
        cover = r.dir === 'close' ? tau / G.T : 1 - tau / G.T;
        if (!sound.gating && sound.live && now >= r.t0 && tau < G.T) sound.gate(r.dir, Math.max(((G.T - tau) * HALL_GATE.ms) / G.T, r.snap ? r.t0 + GATE_BLEND_MS - now : 0) / 1000);
      } else if (G?.state === 'closed') cover = 1;
      if (lift.going && !lift.halted && !sound.riding && sound.live) sound.rideOn();
      sound.space(THREE.MathUtils.clamp(-lift.y / 36, 0, 1), cover);
    },
  };
  // Tiefe für ein Schiff, in Modellmetern der Halle
  // Mit Schacht fährt das Feld mindestens auf seinen Grund (36 m wie im
  // Spiel); braucht ein Schiff mehr, wächst er mit (fit, nur nach unten).
  const liftDepth = (info) => {
    const d = LIFT_DEPTH + info.height / hallRoot.scale.x, sh = realHall?.shaft;
    if (!sh) return d;
    sh.fit(Math.max(d, sh.depth));
    return Math.max(d, sh.depth0);
  };
  // Schachtlicht an einer Stelle der Schachtachse (Höhe y im Schachtraum),
  // als Helligkeit gemittelt über oben und die vier Seiten: hebt dort die
  // Abdunkelung von Schiff und Crew auf. Ohne die Lampen der Plattform.
  const PIT_NORMALS = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  const pitOut = [0, 0, 0], pitP = [0, 0, 0];
  function pitAt(y) {
    const sh = realHall?.shaft, on = hallPit.k.value.x;
    if (!sh?.lights || !on) return 0;
    pitOut.fill(0); pitP[1] = y;
    const bx = hallPit.blink.value.x;
    for (const q of sh.lights) {
      if (q.kind & 2) continue;
      for (const n of PIT_NORMALS) pitLight(q, pitP, n, pitOut, (q.kind & 1 ? bx : 1) / PIT_NORMALS.length);
    }
    return lum(pitOut) * PIT_GAIN * on;
  }
  const pitState = { t0: 0 };
  // Abdunkeln im Schacht: Farbe und Spiegelung je Material, die Lichter
  // (Leuchtkarten) bleiben. Die Materialien gehören dem Objekt allein.
  // cool (0..1) färbt dazu zum Dunst des Schachts hin (SHAFT_TINT).
  const dimTint = new THREE.Color();
  function dimIn(dim, f, cool = 0) {
    if (dim.f === f && dim.cool === cool) return;
    dim.f = f; dim.cool = cool;
    dimTint.setRGB(...SHAFT_TINT.map((v) => 1 + (v - 1) * cool));
    for (const [m, b] of dim.base) {
      m.color.copy(b.c).multiplyScalar(f).multiply(dimTint);
      m.envMapIntensity = b.e * f;
    }
  }
  function dimOf(mats) {
    const base = new Map();
    for (const m of mats) if (m?.color && !base.has(m)) base.set(m, { c: m.color.clone(), e: m.envMapIntensity ?? 1 });
    return { f: 1, cool: 0, base };
  }
  // wie weit unten (0..1), solange die Schachtlampen an sind
  const shaftCool = (y) => THREE.MathUtils.smoothstep(-y, 0.5, LIFT_DARK) * hallPit.k.value.x;
  let homeTgt = null;      // Blickziel der Startansicht des aktuellen Schiffs
  let frameFn = null;
  // Zeichenkontext verloren (Treiber zurückgesetzt, Grafikspeicher voll):
  // three.js hält ihn zur Rückgabe offen (preventDefault in WebGLRenderer),
  // die Seite erfährt beides über onLost(true/false). Was beim Laden einmal
  // gezeichnet wurde (Umgebungskugeln, Hallenschatten), ist im neuen Kontext
  // leer; neu aufbauen muss es die Seite.
  let lostFn = null;
  renderer.domElement.addEventListener('webglcontextlost', () => lostFn?.(true));
  renderer.domElement.addEventListener('webglcontextrestored', () => lostFn?.(false));
  let token = 0;
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

  // Erstes Bild: Halle und Schiff erscheinen zusammen, die Leinwand blendet
  // auf. Wartet das Schiff zu lange auf die Halle, kommt es allein.
  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    life.root.visible = !REAL || life.isRigged();
    const el = renderer.domElement;
    if (!reduceMotion) el.style.transition = 'opacity .45s ease-out';
    el.style.opacity = '1';
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function show(url, o = {}) {
    wake(1500);
    busyStart();
    try { return await showShip(url, o); } finally { busyEnd(); }
  }
  // Material eines Teils mit echtem Lack herrichten (Schiff und getauschte
  // Bordwaffe gleich). false: das Teil bleibt unsichtbar.
  function dressTextured(n) {
    const m = n.material;
    // POM-Decals sind im Spiel reine Relief-Schichten über dem Rumpf
    // (Nieten, Plattenkanten), deren Farbbild nie sichtbar ist. Als
    // eigene Fläche gezeichnet, liegen sie als weiße Splitter auf dem Lack.
    if (/(^|_)pom(_|$)|pom_?decal/i.test(m.name || '')) { n.visible = false; return false; }
    // Schichtmaterialien, die der Export nicht auflösen konnte, kommen
    // ohne Bild und tiefschwarz an — als Loch im Rumpf. Dunkles Metall
    // ist im Spiel fast immer, was dort sitzt.
    if (!m.map && m.color.r + m.color.g + m.color.b < 0.06) {
      m.color.setHex(0x3a3d42); m.metalness = 0.6; m.roughness = 0.45;
    }
    m.envMapIntensity = 0.9;
    for (const t of [m.map, m.normalMap, m.emissiveMap]) if (t) t.anisotropy = maxAniso;
    unifyMaps(m);
    onePass(m);
    return true;
  }
  async function showShip(url, o) {
    const my = ++token;
    makerCode = o.maker || '';
    prog.delete('ship');
    // Mit Aufzug fährt das alte Schiff gleich ab, das neue lädt derweil.
    // Das Tor schließt darüber, sobald es unten frei ist (gateClose)
    const lowered = realHall?.lift && current && !reduceMotion ? liftTo(-liftDepth(current.info), liftDownMs(current.info, -liftDepth(current.info))) : null;
    const covered = lowered ? gateClose(current.info) : null;
    if (lowered) current.lift = true;
    // Echter Lack, wenn es ihn gibt; scheitert er, die Geometrie-Fassung.
    let gltf = null, textured = false;
    if (o.tex) {
      try { gltf = await fetchGltf(o.tex, 'ship', 9e6, my); textured = true; } catch { gltf = null; }
      if (my !== token) { if (gltf) disposeObject(gltf.scene); return; }
    }
    // Kommt gar kein Modell, fährt das alte wieder herauf
    if (!gltf) {
      try { gltf = await fetchGltf(url, 'ship', 3e6, my); } catch (e) { if (lowered && my === token) liftUp(current.info); throw e; }
    }
    if (my !== token) { disposeObject(gltf.scene); return; }   // überholt

    const model = gltf.scene;
    const mat = paintMaterial();
    const hull = [];       // [mesh, Originalmaterial] — Rumpfteile, die der Shader-Lack übermalen darf
    model.traverse((n) => {
      if (!n.isMesh) return;
      n.castShadow = true;
      n.receiveShadow = true;
      if (textured) {
        if (dressTextured(n) && !n.material.transparent) hull.push([n, n.material]);
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
    const box = await robustBox(wrap, slicer(12, nextTask));
    if (my !== token) { disposeObject(gltf.scene); mat.dispose(); return; }   // überholt
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    wrap.position.set(-center.x, -box.min.y, -center.z);
    // Grundriss von unten für den Wartungsplatz (layDienst)
    const tu = performance.now(), under = (realHall ? realHall.dienst : DIENST_ON) ? await shipUnder(wrap, size.x / 2, size.z / 2, slicer(12, nextTask)) : null;
    if (under) under.ms = Math.round(performance.now() - tu);
    if (my !== token) { disposeObject(gltf.scene); mat.dispose(); return; }   // überholt
    // Lack-Uniforms im Objektraum des Modells (Z oben, Meter)
    const u = mat.userData.u;
    u.uZ.value.set(box.min.y, box.max.y);
    u.uHalfW.value = size.x / 2;
    u.uPanel.value = THREE.MathUtils.clamp(Math.max(size.x, size.z) / 14, 1.2, 9);
    applyPaint(mat, paintFor(makerCode, liveryKey));

    const ship = new THREE.Group();
    ship.add(wrap);
    const drop = () => { if (textured) for (const m of new Set(hull.map(([, x]) => x))) for (const k of TEX_SLOTS) if (m[k] && !isNeutral(m[k])) m[k].dispose(); mat.dispose(); disposeObject(ship); };
    await prepare(ship);
    if (my !== token) { drop(); return; }
    if (REAL && !revealed) {
      await Promise.race([hallSettled, sleep(6000)]);
      if (my !== token) { drop(); return; }
    }
    if (lowered) {
      // getauscht wird unten und unter geschlossenem Tor
      await Promise.all([lowered, covered]);
      if (my !== token) { drop(); return; }
    }
    const info = { len: size.z, halfW: size.x / 2, height: size.y, under };
    // Blick des alten Schiffs, gemessen an dessen Startentfernung
    const camAim = current ? aimNow() : null;
    const k0 = hallRoot.scale.x, fov0 = baseFov;
    // Auf dem Aufzug (up) steht das alte Schiff da schon unter dem Tor.
    const up = !!(realHall?.lift && !reduceMotion);
    scaleWorld(info, !!current && up);
    // Die Halle wächst oder schrumpft mit dem Schiff (realHallScale). Die
    // Kamera geht im selben Verhältnis um die Hallenmitte mit, dann steht
    // das Bild beim Tausch still, und die Fahrt unten gleitet von dort zur
    // neuen Ansicht. Sonst sprang die ganze Halle unter geschlossenem Tor
    // auf die neue Größe (Krisz, 20.10.2026: „poppen“).
    if (current && up && hallRoot.scale.x !== k0) {
      const kr = hallRoot.scale.x / k0;
      camera.position.multiplyScalar(kr); controls.target.multiplyScalar(kr);
      propGlide = { a: propK, t0: performance.now(), dur: PROP_GLIDE_MS };
    }
    // auf der gebauten Plattform schwebt es knapp darüber, in der echten Halle steht es
    ship.userData.baseY = realHall ? 0.02 : 0.3 * S + 0.25;
    ship.position.y = ship.userData.baseY;
    const tgt = new THREE.Vector3(0, Math.max(1.2, size.y * 0.45 + 0.3), 0);
    if (!current) {
      onPoint = false;
      controls.target.copy(tgt); camera.position.copy(HOME_DIR.clone().multiplyScalar(homeDist()).add(tgt));
    } else {
      // Der Blick bleibt beim Wechsel (Betreiber 18.10.2026: „die kamera
      // soll sich nicht reseten“): Richtung und Höhenwinkel wie zuletzt,
      // auch ohne Ziehen, der Zoom im Verhältnis zur Startentfernung des
      // Schiffs. Steckt die Kamera dann im neuen Rumpf, schiebt keepFree()
      // sie hinaus, wie beim Drehen.
      const off = camAim.pos.clone().sub(camAim.tgt);
      const r = THREE.MathUtils.clamp(camAim.rel * homeDist(), controls.minDistance, controls.maxDistance);
      onPoint = false;
      flyTo(tgt, off.setLength(r).add(tgt), 700);
      if (!reduceMotion && Math.abs(baseFov - fov0) > 0.01) { fovGlide = { a: fov0, t0: performance.now(), dur: 700 }; fitFov(); }
    }

    if (leaving) { scene.remove(leaving.group); release(leaving.c); leaving = null; }
    // Auf dem Aufzug kommt es von unten herauf; das alte steht unten und geht.
    if (current) {
      if (up) { scene.remove(current.group); release(current); }
      else leaving = { group: current.group, t0: performance.now(), c: current, y0: current.group.position.y, r0: current.group.rotation.y };
    }
    if (up) {
      lift.dur = 0; lift.y = -liftDepth(info); lift.regroup = true;
      liftUp(info);
    }
    scene.add(ship);
    homeTgt = tgt;
    camFree = null; freeDirty = true;
    const mats = [mat], clear = [];
    ship.traverse((n) => {
      if (!n.material) return;
      mats.push(...[].concat(n.material));
      if (n.isMesh && [].concat(n.material).some((m) => m.transparent)) clear.push(n);
    });
    current = { group: ship, model, born: performance.now(), mat, info, hull: textured ? hull : null, lift: up, dim: dimOf(mats), clear };
    if (textured) wearPaint(current, liveryKey !== 'werk');
    prog.delete('ship');
    reveal();
    if (progressFn) progressFn(100);
  }

  // Echter Lack <-> Shader-Lack auf dem Rumpf eines texturierten Schiffs.
  function wearPaint(c, on) {
    for (const [n, orig] of c.hull) n.material = on ? c.mat : orig;
  }
  // Ein Schiff freigeben — samt der Materialien, die gerade nicht hängen.
  function release(c) {
    unfit(c);
    if (c.hull) {
      wearPaint(c, false);
      // texturierte Fassung: ~200 Bilder je Schiff, die sonst im Grafikspeicher blieben
      c.group.traverse((n) => {
        if (n.material) for (const m of [].concat(n.material)) for (const t of [m.map, m.normalMap, m.emissiveMap, m.aoMap, m.roughnessMap, m.metalnessMap]) if (t && !isNeutral(t)) t.dispose();
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
    fadePaint(paintFor(makerCode, k));
  }
  // Shader-Lack auf neue Toene: gleitet, ausser direkt nach dem Laden.
  function fadePaint(p) {
    const u = current.mat.userData.u;
    fade.from = [u.uPrim.value.clone(), u.uSec.value.clone(), u.uAcc.value.clone()];
    fade.to = p; fade.t0 = performance.now();
    u.uPattern.value = p.pattern;
    if (reduceMotion || performance.now() - current.born < 300) { applyPaint(current.mat, p); fade.to = null; }
  }

  // Layout-Werkstatt: Lackierung aus der Palette des Spiels. p = { cols, base },
  // je [Haupt, Zweit, Akzent] als #rrggbb, oder null fuer den Serienlack.
  // Echter Lack: Die Palettenmaterialien tragen den Serienton als Grundfarbe
  // (baseColorFactor = linear(Serienton), am Gladius exakt); welche das sind,
  // sagt dieser Ton, bestaetigt durch extras.palette_tint, wo der Build es
  // mitgibt. Sie bekommen den neuen Ton, Texturen und Muster bleiben. Die
  // Geometrie-Fassung nimmt die drei Toene in den Shader-Lack.
  // Gilt fuer das geladene Schiff; die Oberflaeche ruft es nach jedem show().
  // Liefert die Zahl umgefaerbter Materialien (Shader-Lack: 1).
  function paint(p) {
    const on = p && p.cols?.length === 3 && p.base?.length === 3 ? p : null;
    if (!current) return 0;
    wake(800);
    if (!current.hull) {
      fadePaint(on ? { cols: on.cols.map((c) => new THREE.Color(c)), pattern: 0 } : paintFor(makerCode, liveryKey));
      return 1;
    }
    const map = hullTint(current, on?.base);
    if (!map) return 0;
    for (const [m, t] of map) m.color.copy(on ? new THREE.Color(on.cols[t.slot]) : t.c0);
    return map.size;
  }
  // Palettenmaterialien des echten Lacks: Material -> { slot 0..2, Serienfarbe }.
  // Einmal je Schiff, beim ersten paint() mit Serienpalette. Traegt das Modell
  // Lackkanaele (extras.palette_tint, nur an der eigenen Palette des Schiffs,
  // nicht an Halterungen, Sitzen, Beibooten), zaehlt nur ein Material mit
  // passendem Kanal: eine weisse Serienpalette (Avenger Titan) traefe sonst
  // jedes reine Texturmaterial.
  function hullTint(c, base) {
    if (c.tint || !base) return c.tint ?? null;
    const want = base.map((h) => new THREE.Color(h));
    const near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 3e-3;
    const mats = new Set();
    for (const [, orig] of c.hull) for (const m of [].concat(orig)) if (m?.color) mats.add(m);
    const tagged = [...mats].some((m) => m.userData?.palette_tint != null);
    const map = new Map();
    for (const m of mats) {
      const pt = m.userData?.palette_tint;
      const slot = want.findIndex((w, i) => (tagged ? pt === i + 1 : true) && near(w, m.color));
      if (slot >= 0) map.set(m, { slot, c0: m.color.clone() });
    }
    c.tint = map;
    return map;
  }

  // Layout-Werkstatt: getauschte Bordwaffen am Schiff. Die Web-Fassung trägt
  // jede Serienwaffe als eigene Knoten (extras swap/item/inst/anchor, siehe
  // markSwapParts in scripts/build-hangar-assets.mjs). fit() blendet die
  // eines Ports aus und setzt das Modell der gewählten Waffe an jede ihrer
  // Wurzeln (anchor: Matrix im Modellraum der .glb). Ports ohne Tauschteile
  // und Waffen ohne Modell bleiben, wie sie sind; die Marker der Oberfläche
  // zeigen den Tausch dann weiter allein.
  // list: [{ port, item, url }]; [] stellt die Serie wieder her.
  const weaponTpl = new Map();   // url -> Promise<Object3D>, geteilt über Schiffe
  function loadWeapon(url) {
    if (!weaponTpl.has(url)) {
      const p = new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)).then(async (g) => {
        const tpl = g.scene;
        tpl.traverse((n) => {
          if (!n.isMesh) return;
          n.castShadow = true; n.receiveShadow = true;
          dressTextured(n);
        });
        await prepare(tpl);
        return tpl;
      });
      p.catch(() => weaponTpl.delete(url));
      weaponTpl.set(url, p);
    }
    return weaponTpl.get(url);
  }
  function swapParts(c) {
    if (c.parts) return c.parts;
    c.parts = new Map();
    c.model.traverse((n) => {
      const u = n.userData;
      if (typeof u?.swap !== 'string' || !Array.isArray(u.anchor)) return;
      const k = `${u.swap}|${u.item ?? 0}`;
      if (!c.parts.has(k)) c.parts.set(k, { nodes: [], anchors: new Map(), added: [] });
      const p = c.parts.get(k);
      p.nodes.push(n);
      if (!p.anchors.has(u.inst ?? 0)) p.anchors.set(u.inst ?? 0, new THREE.Matrix4().fromArray(u.anchor));
    });
    return c.parts;
  }
  function unfit(c) {
    for (const p of c.parts?.values() ?? []) {
      for (const n of p.nodes) n.visible = true;
      for (const o of p.added) o.removeFromParent();
      p.added = [];
    }
  }
  let fitTok = 0;
  async function fit(list = []) {
    const c = current, my = ++fitTok;
    if (!c) return 0;
    const parts = swapParts(c);
    const want = list.filter((f) => f?.url && parts.has(`${f.port}|${f.item ?? 0}`));
    const tpls = await Promise.all(want.map((f) => loadWeapon(f.url).catch(() => null)));
    if (my !== fitTok || current !== c) return 0;
    unfit(c);
    let n = 0;
    want.forEach((f, i) => {
      const tpl = tpls[i];
      if (!tpl) return;
      const p = parts.get(`${f.port}|${f.item ?? 0}`);
      for (const nd of p.nodes) nd.visible = false;
      for (const a of p.anchors.values()) {
        const o = tpl.clone(true);
        o.matrixAutoUpdate = false;
        o.matrix.copy(a);
        o.userData.fitted = f.port;
        c.model.add(o);
        p.added.push(o);
        n++;
      }
    });
    c.model.updateMatrixWorld(true);
    shadowSig = '';
    wake(800);
    return n;
  }

  // Blick, auf den die Kamera gerade zuläuft (im Flug dessen Ziel), und ihr
  // Zoom als Anteil der Startentfernung; auf einem Hardpoint der Zoom von
  // vor dem Fokus
  let pointRel = 1;
  function aimNow() {
    const tgt = fly ? fly.tb.clone() : controls.target.clone();
    const pos = fly ? new THREE.Vector3().setFromSpherical(fly.b).add(fly.tb) : camera.position.clone();
    return { tgt, pos, rel: onPoint ? pointRel : pos.distanceTo(tgt) / homeDist() };
  }
  function resetView() {
    touched = false; onPoint = false;
    // nach focus() steht das Ziel auf einem Hardpoint, nicht auf der Schiffsmitte
    const t = homeTgt ? homeTgt.clone() : controls.target.clone();
    flyTo(t, HOME_DIR.clone().multiplyScalar(homeDist()).add(t));
  }

  // Schnittstelle für die Oberfläche um die Szene (Hardpoint-Marker, Fokus).
  // Punkte liegen im Modellraum der .glb (glTF-Achsen, Meter), demselben Raum
  // wie ship-hardpoints.json nach (x, z, -y). Nur der Viewer kennt die
  // Drehung, Zentrierung und Ein-/Ausfahrt, darum rechnet er hier um.
  const projV = new THREE.Vector3();
  function project(points, out = []) {
    out.length = points.length;
    // Im Schacht (Aufzug nicht oben) zeigt die Oberfläche keine Marker
    const m = current && current.group.visible && !(current.lift && lift.y < -0.05) ? current.model.matrixWorld : null;
    const w = W(), h = H();
    for (let i = 0; i < points.length; i++) {
      if (!m) { out[i] = null; continue; }
      const p = points[i];
      projV.set(p[0], p[1], p[2]).applyMatrix4(m);
      const d = projV.distanceTo(camera.position);
      projV.project(camera);
      out[i] = projV.z > 1 ? null : { x: (projV.x + 1) * 0.5 * w, y: (1 - projV.y) * 0.5 * h, d };
    }
    return out;
  }
  function focus(p) {
    if (!current) return;
    if (!p) { resetView(); return; }
    // Ziel aus der Ruhelage: waehrend der Einfahrt schwebt und dreht die
    // Gruppe noch, das Ziel laege sonst bis zu 18 % der Spannweite daneben.
    // baseY gilt zur Zeit des Aufrufs; eine beim Platzieren gemerkte Matrix
    // waere nach einem Hallenwechsel falsch. Wechselt die Halle erst danach,
    // nimmt settleShip() das Ziel mit (.planning/notes/hangar-naht.md).
    const g = current.group, y = g.position.y, ry = g.rotation.y;
    g.position.y = g.userData.baseY; g.rotation.y = 0; g.updateMatrixWorld(true);
    const tgt = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(current.model.matrixWorld);
    g.position.y = y; g.rotation.y = ry; g.updateMatrixWorld(true);
    // Von aussen durch den Hardpoint schauen, nicht durch den Rumpf: Richtung
    // von der Schiffsmitte durch den Punkt, mit der aktuellen Ansicht
    // gemischt. Bauchtuerme duerfen flach von der Seite gesehen werden, aber
    // mindestens ~10 Grad ueber dem Boden.
    const view = camera.position.clone().sub(controls.target).normalize();
    const out = tgt.clone().sub(homeTgt ?? controls.target);
    out.y = Math.max(out.y, 0);
    const dir = out.lengthSq() > 1e-4 ? out.normalize().multiplyScalar(0.7).add(view.multiplyScalar(0.3)) : view;
    dir.y = Math.max(dir.normalize().y, 0.17);
    const r = THREE.MathUtils.clamp(span * 0.62, controls.minDistance, controls.maxDistance);
    if (!onPoint) pointRel = aimNow().rel;
    touched = true; onPoint = true;
    flyTo(tgt, dir.normalize().multiplyScalar(r).add(tgt), 700);
  }

  // Nachregeln: Ruckelt das Bild, gibt erst die Bildschärfe in Stufen nach
  // (bis Pixeldichte 1), dann die Leistungsstufe (hoch -> mittel ->
  // niedrig), zuletzt in der niedrigen Stufe die Bildschärfe bis 0,6.
  // Gemessen wird der Median der Bildabstände über je zwei Sekunden, erst
  // nach dem ersten Bild und nicht während des Ladens (busy); einzelne
  // Aussetzer über einer Sekunde (Tabwechsel) zählen nicht. Bis 2026-10-15
  // zählten Bilder über 100 ms gar nicht: Unter 10 Bildern je Sekunde regelte
  // die Seite also nie nach. Nie wieder hoch: kein Pendeln.
  const PR_FLOOR = 1, PR_FLOOR_LOW = 0.6;
  // Bildtakt (2026-10-15). Bis dahin zeichnete die Seite so oft, wie der
  // Schirm Bilder zeigt (an einem 144-Hz-Schirm 144 je Sekunde), auch wenn
  // niemand hinsah; mit der Seite allein lief eine RTX 30x0 Ti bei 75 %.
  // Jetzt höchstens 60 je Sekunde, solange jemand dreht, zoomt oder ein
  // Schiff wechselt, im Leerlauf (Crew, Staub) 24: 24 statt 30 Bilder
  // sparten 23 % der Arbeit des Chips (2026-10-18, RTX 3070 Ti, zwei Läufe,
  // gemessen noch mit dem damaligen Umlauf). Ist das Fenster nicht
  // vorn (Spiel, anderes Programm), zeichnet die Bühne nur, solange der
  // Zeiger über ihr fährt; verborgen oder aus dem Bild gar nicht. fpsCap
  // deckelt beides (niedrige Stufe: 30).
  const FPS_ACTIVE = 60, FPS_IDLE = 24, BG_HOVER = 3000;
  let fpsCap = Q0 === 'niedrig' ? 30 : 0, due = 0, capNow = 0;
  let focused = document.hasFocus(), hoverUntil = 0;
  const frameD = [];
  let frameSum = 0, lastNow = 0;
  // Leerlauf und Ruhe (2026-10-18, Wahl des Betreibers für „great
  // performance"): Ab IDLE_MS ohne Zeigerbewegung über der Bühne und ohne
  // Bewegung, die jemand auslöst (activeUntil), zeichnet sie mit IDLE_SCALE
  // der Bildschärfe: rund 20 % weniger Arbeit des Chips im Leerlauf (RTX
  // 3070 Ti, Gladius, zwei Läufe im Wechsel). Ab REST_MS + REST_EASE (bis
  // 2026-10-18 lief dort der Umlauf aus) zeichnet sie nichts (Grafikprozess des Browsers
  // 2,7 % statt 16 %), bis der Zeiger über sie fährt oder die Seite etwas
  // zeigt (wake). Die volle Schärfe kehrt schon beim Überfahren zurück, also
  // bevor jemand zieht: Das Umstellen legt die Zielbilder neu an (längstes
  // Bild dabei 21 ms, so lang wie die üblichen Ausreißer).
  const IDLE_MS = 2000, IDLE_SCALE = 0.75, REST_MS = 20000, REST_EASE = 1500;
  function applyPixels() {
    renderer.setPixelRatio(pixelRatio * pixelScale);
    composer?.setPixelRatio(pixelRatio * pixelScale);
  }
  function setPixels(pr) {
    if (Math.abs(pr - pixelRatio) < 1e-3) return;
    pixelRatio = pr;
    applyPixels();
    qualityFn?.(quality());
  }
  function adapt(now, cap) {
    const d = now - lastNow;
    lastNow = now;
    // anderer Takt (Leerlauf, Bedienen): die Abstände davor zählen nicht
    if (cap !== capNow) { capNow = cap; frameD.length = 0; frameSum = 0; return; }
    if (!revealed || busy || now < quietAt || !visible) { frameD.length = 0; frameSum = 0; return; }
    if (d <= 0 || d > 1000) return;
    frameD.push(d); frameSum += d;
    if (frameSum < 2000) return;
    frameD.sort((a, b) => a - b);
    const med = frameD[frameD.length >> 1];
    frameD.length = 0; frameSum = 0;
    // 40 Bilder je Sekunde und mehr: bleibt; im 30er-Takt ab 40 ms
    if (med < Math.max(25, 1200 / cap)) return;
    // Von Hand gewählt (?grafik=, Grafik-Schalter): die Stufe bleibt, nur die Bildschärfe gibt nach
    if (med < 50 && pixelRatio > PR_FLOOR) setPixels(Math.max(PR_FLOOR, pixelRatio - 0.25));
    else if (level !== 'niedrig') { if (!FORCED) stepDown(med); }
    else if (pixelRatio > PR_FLOOR_LOW) setPixels(Math.max(PR_FLOOR_LOW, pixelRatio - 0.2));
  }
  // Eine Stufe tiefer, solange die Seite läuft. Was beim Laden entstand
  // (Lampen, Schattenkarten, Texturgröße, Möbel), bleibt; es fällt weg, was
  // jedes Bild kostet.
  let qualityFn = null, dropping = null;
  function stepDown(ms) {
    const i = rank(level);
    if (i <= 0) return;
    const from = level;
    level = QUALITY_LEVELS[i - 1];
    console.info(`[hangar] Leistungsstufe ${from} → ${level} (Bildzeit ${Math.round(ms)} ms)`);
    if (level !== 'hoch') {
      life.setShadows(false);
      // Ohne Nachbearbeitung zeichnet das Bild auf die Leinwand, mit anderen
      // Programmen: die erst im Hintergrund übersetzen, dann umschalten
      if (composer && !dropping) {
        dropping = compileFor(scene, null).catch(() => {}).then(() => {
          // samt den Zielen der Pässe (Verdeckung, Leuchten): die gibt
          // composer.dispose() nicht frei
          for (const ps of composer?.passes ?? []) ps.dispose?.();
          composer?.dispose();
          composer = null;
          mirrorRT?.dispose(); mirrorRT = null;
          hallRefl.on.value = 0;
        });
      }
    }
    if (level === 'niedrig') { life.setCount(4); fpsCap = 30; }
    shadowSig = '';
    setPixels(Math.min(pixelRatio, PR_CAP[level]));
    qualityFn?.(quality());
  }
  const quality = () => ({ level, start: Q0, why: pick.why, forced: FORCED, pixelRatio, levels: QUALITY_LEVELS.slice() });
  // Schattenkarten in der echten Halle nur neu, wenn sich etwas bewegt, das
  // Schatten wirft: das Schiff (Ein- und Ausfahrt, Aufzug), der
  // Hallenmaßstab. Die Crew wirft dort keinen. Die gebaute Halle (ohne
  // Spieldaten) hat laufende Teile mit Schatten: dort jedes Bild.
  function shadowsDue() {
    if (!realHall) return true;
    const g = current?.group, l = leaving?.group;
    const sig = `${g ? `${g.id}:${g.visible}:${g.position.y.toFixed(3)}:${g.rotation.y.toFixed(3)}` : '-'}|${l ? `${l.id}:${l.position.y.toFixed(3)}:${l.rotation.y.toFixed(3)}` : '-'}|${hallRoot.scale.x}`;
    if (sig === shadowSig) return false;
    shadowSig = sig;
    return true;
  }

  // Uhr der Bühne (s): aus dem Zeitstempel, den der Browser jedem Bild
  // mitgibt (frame), nicht aus dem Augenblick, in dem das Skript läuft. Der
  // schwankt um das, was vorher im selben Bild zu tun war, und jede Bewegung
  // mit ihm (20.10.2026).
  const T0 = performance.now();
  let raf = 0, visible = true, last = 0;
  // Takt des Schirms (20.10.2026): Median der Abstände zwischen den
  // Bildaufrufen des Browsers. Gezeichnet wird in ganzen Vielfachen davon;
  // 24 Bilder je Sekunde an einem 60-Hz-Schirm hießen abwechselnd jedes
  // zweite und dritte Bild, und so ruckelten Crew und Warnlichter im
  // Leerlauf (Krisz: „smoother animation“). paced() nimmt das Vielfache am
  // nächsten zum Wunschtakt, im Zweifel das schnellere: an 60 Hz im Leerlauf
  // 30 statt 24, an 144 Hz 24 im Leerlauf und 72 beim Bedienen.
  let vsMs = 1000 / 60, vsLast = 0;
  const vsD = [];
  function vsync(ts) {
    const d = ts - vsLast;
    vsLast = ts;
    if (!(d > 3 && d < 45)) return;
    vsD.push(d);
    if (vsD.length < 40) return;
    vsD.sort((a, b) => a - b);
    vsMs = vsD[vsD.length >> 1];
    vsD.length = 0;
  }
  const paced = (fps) => vsMs * Math.max(1, Math.floor(1000 / vsMs / fps + 0.25));
  // Freiraum der Kamera (2026-10-10). Ihre Grenze war eine Kugel um das
  // Ziel (camRoom), die Halle ist keine: Ganz herausgezoomt fuhr die Kamera
  // bei 16 bis 32 Grad Höhe in Balkone und Kabeltrassen der Seitenwände (das
  // Bild war grau), bei hohen Schiffen in die Deckenkästen, und ganz tief
  // stand sie auf 15 bis 17 m in einem Kistenstapel. Darum misst die
  // Seite vom Ziel der Startansicht aus je Richtung den Abstand zur ersten
  // Fläche der Halle: sechs kleine Bilder, eins je Würfelseite, ohne Möbel,
  // Schiff und Crew. Die Kamera bleibt davor, mit Rand, wie der Federarm
  // einer Spielkamera, und zwar über einen Kegel von 3 Grad um ihre
  // Richtung, damit auch eine Kante knapp neben dem Strahl nicht ins Bild
  // ragt. Möbel zählen als ihr Hüllquader: Hinter einer Kiste darf sie
  // stehen (sonst spränge sie ganz tief im Umlauf 19 m nach vorn), in ihr
  // nicht; dort geht sie zum näheren Ausgang. Was der Nutzer an Abstand will,
  // bleibt gemerkt: Ist der Weg wieder frei, gleitet sie dorthin zurück.
  const FREE_N = 128;
  // Würfelseiten: Blickrichtung und Oben; rechts ist Blick × Oben
  const FREE_FACES = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, 1], [0, -1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0]].map((a) => {
    const f = new THREE.Vector3(a[0], a[1], a[2]), u = new THREE.Vector3(a[3], a[4], a[5]);
    return { f, u, r: new THREE.Vector3().crossVectors(f, u) };
  });
  let freeBusy = false, camWant = 0, camRef = 0;
  const camLast = new THREE.Vector3(), freeV = new THREE.Vector3();
  const freeA = new THREE.Vector3(), freeB = new THREE.Vector3(), freeS = new THREE.Vector3();
  // Sechs Bilder um o, eins je Würfelseite: je Pixel der Abstand zur ersten
  // Fläche unter root (last: zur letzten, dafür wird die Tiefe auf 0
  // gelöscht und die größere gewinnt), ohne skip und ohne Punkte, Linien und
  // Sprites; nichts getroffen heißt far (last: 0). poses: Lagen, die
  // nacheinander in dieselben Bilder gehen (je eine Funktion, die sie
  // einnimmt). Rendertarget und Material bleiben je Art für die nächste
  // Messung.
  const cubeKit = {};
  function cubeDist(kind, o, root, skip, last, near, far, poses = [null]) {
    const N = FREE_N;
    const kit = cubeKit[kind] || (cubeKit[kind] = {
      rt: new THREE.WebGLRenderTarget(N, N * 6),
      cam: new THREE.PerspectiveCamera(90, 1),
      // Abstand zu o als 24 Bit, Alpha 0 heißt: nichts getroffen
      mat: new THREE.ShaderMaterial({
        uniforms: { uO: { value: new THREE.Vector3() }, uFar: { value: 1 } },
        vertexShader: 'varying vec3 vW;\nvoid main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'uniform vec3 uO;\nuniform float uFar;\nvarying vec3 vW;\nvoid main() { float d = floor( clamp( distance( vW, uO ) / uFar, 0.0, 1.0 ) * 16777215.0 ); float r = floor( d / 65536.0 ); float g = floor( ( d - r * 65536.0 ) / 256.0 ); gl_FragColor = vec4( r, g, d - r * 65536.0 - g * 256.0, 255.0 ) / 255.0; }',
        side: THREE.DoubleSide,
        depthFunc: last ? THREE.GreaterDepth : THREE.LessEqualDepth,
      }),
    });
    const { rt, mat, cam } = kit;
    cam.near = near; cam.far = far; cam.updateProjectionMatrix();
    cam.position.copy(o);
    mat.uniforms.uO.value.copy(o); mat.uniforms.uFar.value = far;
    const off = [];
    const hide = (n) => { if (n?.visible) { n.visible = false; off.push(n); } };
    for (const c of scene.children) if (c !== root) hide(c);
    for (const n of skip) hide(n);
    root.traverse((n) => { if (n.isPoints || n.isLine || n.isSprite) hide(n); });
    const keep = { bg: scene.background, fog: scene.fog, om: scene.overrideMaterial, rt: renderer.getRenderTarget(), ac: renderer.autoClear, cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha() };
    try {
      scene.background = null; scene.fog = null; scene.overrideMaterial = mat;
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(rt);
      if (last) renderer.state.buffers.depth.setClear(0);
      renderer.clear();
      if (last) renderer.state.buffers.depth.setClear(1);
      for (const pose of poses) {
        pose?.();
        FREE_FACES.forEach((s, i) => {
          cam.up.copy(s.u);
          cam.lookAt(o.x + s.f.x, o.y + s.f.y, o.z + s.f.z);
          cam.updateMatrixWorld();
          rt.viewport.set(0, i * N, N, N);
          renderer.setRenderTarget(rt);
          renderer.render(scene, cam);
        });
      }
    } finally {
      renderer.state.buffers.depth.setClear(1);
      renderer.setRenderTarget(keep.rt);
      renderer.autoClear = keep.ac;
      renderer.setClearColor(keep.cc, keep.ca);
      scene.background = keep.bg; scene.fog = keep.fog; scene.overrideMaterial = keep.om;
      for (const n of off) n.visible = true;
    }
    const buf = new Uint8Array(N * N * 6 * 4);
    return renderer.readRenderTargetPixelsAsync(rt, 0, 0, N, N * 6, buf).then(() => {
      const dist = new Float32Array(N * N * 6);
      for (let j = 0; j < dist.length; j++) dist[j] = buf[j * 4 + 3] ? (buf[j * 4] * 65536 + buf[j * 4 + 1] * 256 + buf[j * 4 + 2]) / 16777215 * far : last ? 0 : far;
      return dist;
    });
  }
  // Die Halle vom Ziel der Startansicht aus, ohne Möbel
  function measureFree() {
    // gemessen wird die Einrichtung in Originalgröße, also nach propGlide
    if (propGlide) return;
    freeDirty = false;
    if (!realHall || !homeTgt || freeBusy) return;
    const hall = realHall, k = hall.group.scale.x, o = homeTgt.clone(), t0 = performance.now();
    freeBusy = true;
    let p;
    // Aufzug in Ruhelage: Der Schacht ist kein Platz für die Kamera
    const ly = hall.lift?.position.y ?? 0;
    if (hall.lift) hall.lift.position.y = 0;
    try { p = cubeDist('hall', o, hall.group, [...(hall.furniture ?? []).map((f) => f.mesh), ...(hall.deko ? [hall.deko.group] : [])], false, 0.02 * k, Math.max(controls.maxDistance, 1) * 1.6 + 10 * k); } catch (e) { p = Promise.reject(e); }
    if (hall.lift) hall.lift.position.y = ly;
    p.then((dist) => {
      // Inzwischen anderes Schiff oder andere Halle: neu messen
      if (hall === realHall && homeTgt && homeTgt.equals(o) && hall.group.scale.x === k && propK === k) {
        const boxes = furnitureBoxes(hall.furniture ?? [], 0.6 * k), deko = hall.deko ? dekoBoxes(hall.deko, 0.6 * k) : [];
        camFree = { o, dist, m: 0.6 * k, boxes: [...boxes, ...deko] };
        console.info(`[hangar] Freiraum der Kamera gemessen (6 × ${FREE_N}², ${Math.round(performance.now() - t0)} ms), ${boxes.length} Möbel und ${deko.length} Stücke der Hallendeko als Quader`);
      } else freeDirty = true;
    }).catch((e) => console.warn('[hangar] Freiraum der Kamera nicht gemessen', e)).finally(() => { freeBusy = false; });
  }
  // Hülle des Schiffs (2026-10-11). Die Kamera darf bis auf span · 0,45 an
  // ihr Ziel heran, und ganz hereingezoomt streifte sie Flügelspitzen,
  // Leitwerk und Kanzel (die Nahebene schnitt sie an), um einen Hardpoint
  // gedreht stand sie zwischen Rumpf und Fahrwerk. Darum misst die Seite vom
  // Blickziel aus je Richtung den Abstand zur fernsten Fläche des Schiffs in
  // Ruhelage, für ein neues Ziel gleich, wenn die Kamerafahrt dorthin
  // beginnt. Die Kamera bleibt mit Rand dahinter: Ein Schiff ist kein Raum,
  // um den fährt sie außen herum.
  const SHIP_M = 0.35;
  // Ohne echte Halle schwebt das Schiff um bis zu so viel über und unter
  // seiner Ruhelage (Carrack 1,1 m); gemessen wird dann über fünf Höhen
  const shipBob = () => (reduceMotion || realHall ? 0 : 0.009 * span);
  let shipFree = null, shipBusy = false;
  const aim = () => (fly ? fly.tb : controls.target);
  // am Ziel einer Fahrt steht es nur bis auf Rundung (lerpVectors)
  const sameAim = (a, b) => a.distanceToSquared(b) < 1e-8;
  const shipStale = () => current && !shipBusy && (!shipFree || shipFree.c !== current || shipFree.y !== current.group.userData.baseY || shipFree.b !== shipBob() || !sameAim(shipFree.o, aim()));
  function measureShip() {
    const c = current, g = c.group, y = g.userData.baseY, b = shipBob(), o = aim().clone(), t0 = performance.now();
    // Ruhelage wie in focus(): während der Einfahrt schwebt und dreht es noch.
    // Schwebt es, die fernste Fläche über die ganze Höhe: Ein fester Rand
    // reicht nicht, eine flach geschnittene Fläche wandert auf der Linie
    // zum Ziel um ein Vielfaches der Höhe.
    const pose = [g.position.y, g.rotation.y, g.visible];
    g.rotation.y = 0; g.visible = true;
    const at = (h) => () => { g.position.y = y + b * h; g.updateMatrixWorld(true); };
    const poses = (b > 0 ? [-1, -0.5, 0, 0.5, 1] : [0]).map(at);
    shipBusy = true;
    let p;
    try { p = cubeDist('ship', o, g, [], true, 0.01, Math.max(controls.maxDistance, span) * 2, poses); } catch (e) { p = Promise.reject(e); }
    [g.position.y, g.rotation.y, g.visible] = pose; g.updateMatrixWorld(true);
    p.then((dist) => {
      if (current !== c || g.userData.baseY !== y) return;
      shipFree = { o, dist, c, y, b };
      // Läuft die Fahrt noch, endet sie gleich außerhalb statt danach zu springen
      if (fly && sameAim(o, fly.tb)) {
        const d = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, fly.b.phi, fly.b.theta));
        fly.b.radius = Math.max(fly.b.radius, Math.min(shipNeed(fly.tb, d), controls.maxDistance));
      }
      console.info(`[hangar] Hülle des Schiffs gemessen (6 × ${FREE_N}²${b > 0 ? `, ${poses.length} Höhen` : ''}, ${Math.round(performance.now() - t0)} ms)`);
    }).catch((e) => {
      // nicht jedes Bild neu versuchen: erst wieder für ein anderes Ziel
      shipFree = { o, dist: null, c, y, b };
      console.warn('[hangar] Hülle des Schiffs nicht gemessen', e);
    }).finally(() => { shipBusy = false; });
  }
  // Wo steht das Schiff in der Startansicht im Bild? Je Kamerahöhe (0 bis
  // 80 Grad) über den ganzen Umlauf die oberste und unterste Stelle der
  // Hülle, als Tangens zur Blickachse: Ruhelage, Abstand der Startansicht.
  // 6000 Punkte x 36 Richtungen je Höhenstufe; mit 2500 Punkten und 24
  // Richtungen lag die C2 bei 30 Grad 30 px tiefer als gerechnet. Eine Stufe
  // rechnet erst, wenn die Kamera bei ihr steht: am Telefon dreht man nur
  // waagerecht, gebraucht werden dort 10 und 20 Grad.
  const LENS_EL = [0, 10, 20, 30, 40, 50, 60, 70, 80].map(THREE.MathUtils.degToRad);
  const LENS_M = 8;   // Pixel Luft zum unteren Bühnenrand
  const lensV = new THREE.Vector3();
  function shipFit() {
    const c = current, g = c.group, y = g.userData.baseY, d = homeDist(), o = homeTgt ?? controls.target;
    if (lensFit && lensFit.c === c && lensFit.y === y && Math.abs(lensFit.d - d) < 1e-3 * d && lensFit.o.equals(o)) return lensFit;
    const pose = [g.position.y, g.rotation.y], t0 = performance.now();
    g.position.y = y; g.rotation.y = 0; g.updateMatrixWorld(true);
    const meshes = [];
    let n = 0;
    g.traverse((m) => { if (m.isMesh && m.geometry?.attributes.position) { meshes.push(m); n += m.geometry.attributes.position.count; } });
    const step = Math.max(1, Math.round(n / 6000)), P = [], v = new THREE.Vector3();
    for (const m of meshes) {
      const a = m.geometry.attributes.position;
      for (let i = 0; i < a.count; i += step) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).sub(o); P.push(v.x, v.y, v.z); }
    }
    [g.position.y, g.rotation.y] = pose; g.updateMatrixWorld(true);
    lensFit = { c, y, d, o: o.clone(), P, top: [], bot: [], ms: performance.now() - t0, told: false };
    return lensFit;
  }
  function fitAt(f, i) {
    if (f.top[i] !== undefined) return;
    const t0 = performance.now(), P = f.P, d = f.d, ce = Math.cos(LENS_EL[i]), se = Math.sin(LENS_EL[i]);
    let hi = -Infinity, lo = Infinity;
    for (let k = 0; k < 36; k++) {
      // Kamera bei o + d * (ce sa, se, ce ca), Blick f zum Ziel, oben u
      const sa = Math.sin(k * Math.PI / 18), ca = Math.cos(k * Math.PI / 18);
      const fx = -ce * sa, fy = -se, fz = -ce * ca, ux = -se * sa, uy = ce, uz = -se * ca;
      for (let j = 0; j < P.length; j += 3) {
        const z = d + P[j] * fx + P[j + 1] * fy + P[j + 2] * fz;
        if (z < 0.1) continue;
        const t = (P[j] * ux + P[j + 1] * uy + P[j + 2] * uz) / z;
        if (t > hi) hi = t;
        if (t < lo) lo = t;
      }
    }
    // ohne Punkte vor der Kamera zählt das Ziel selbst
    f.top[i] = Number.isFinite(hi) ? hi : 0; f.bot[i] = Number.isFinite(lo) ? lo : 0;
    f.ms += performance.now() - t0;
  }
  // Verschiebung für den Augenblick: das Schiff mittig in den freien Teil
  // unter dem Titel. Ist es höher als der freie Teil (von oben gesehen,
  // kleine Telefone), rückt es nur so weit, dass unten LENS_M Luft bleibt,
  // und reicht oben unter den Titel; reicht es schon ohne Verschiebung
  // tiefer, bleibt sie 0.
  function lensWant() {
    if (!coverTop) return 0;
    const h = H();
    if (!current) return Math.min(0.5, coverTop / h);
    const f = shipFit(), N = LENS_EL.length, off = lensV.subVectors(camera.position, controls.target);
    const el = THREE.MathUtils.clamp(Math.asin(off.y / Math.max(1e-6, off.length())), 0, LENS_EL[N - 1]);
    const i = Math.min(N - 2, Math.floor(el / LENS_EL[1])), a = (el - LENS_EL[i]) / LENS_EL[1];
    fitAt(f, i); fitAt(f, i + 1);
    if (!f.told) {
      f.told = true;
      console.info(`[hangar] Lage des Schiffs im Bild gerechnet (${f.P.length / 3} Punkte, 2 von ${N} Höhen, ${Math.round(f.ms)} ms)`);
    }
    const t = Math.tan(THREE.MathUtils.degToRad(baseFov / 2));
    const y0 = (h / 2) * (1 - (f.top[i] + (f.top[i + 1] - f.top[i]) * a) / t);
    const y1 = (h / 2) * (1 - (f.bot[i] + (f.bot[i + 1] - f.bot[i]) * a) / t);
    return (Math.max(0, Math.min((coverTop + h) / 2 - (y0 + y1) / 2, h - LENS_M - y1)) * 2) / h;
  }
  // Abstand in Richtung d (Einheitsvektor) aus den sechs Bildern
  function freeRay(d, dist = camFree.dist) {
    const ax = Math.abs(d.x), ay = Math.abs(d.y), az = Math.abs(d.z);
    const i = ax >= ay && ax >= az ? (d.x > 0 ? 0 : 1) : ay >= az ? (d.y > 0 ? 2 : 3) : (d.z > 0 ? 4 : 5);
    const s = FREE_FACES[i], df = d.dot(s.f), N = FREE_N;
    const px = Math.min(N - 1, Math.max(0, Math.floor((d.dot(s.r) / df + 1) * 0.5 * N)));
    const py = Math.min(N - 1, Math.max(0, Math.floor((d.dot(s.u) / df + 1) * 0.5 * N)));
    return dist[(i * N + py) * N + px];
  }
  // ... über einen Kegel von 3 Grad (Mitte, je sechs Strahlen bei 1,5 und 3
  // Grad), der kleinste (pick = Math.max: der größte)
  function freeCone(d, dist = camFree.dist, pick = Math.min) {
    let best = freeRay(d, dist);
    freeA.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize();
    freeB.crossVectors(d, freeA);
    for (const t of [0.026, 0.052]) for (let j = 0; j < 6; j++) {
      const a = (j + (t > 0.03 ? 0.5 : 0)) * Math.PI / 3;
      freeS.copy(d).addScaledVector(freeA, Math.cos(a) * t).addScaledVector(freeB, Math.sin(a) * t).normalize();
      best = pick(best, freeRay(freeS, dist));
    }
    return best;
  }
  // Hüllquader je Möbel in der Welt, um den Rand m größer. Die Ecken in
  // Originalgröße merkt sich jedes Mesh einmal (box0), danach rechnet
  // scaleFurniture-gleich: Bezugspunkt + (Ecke - Bezugspunkt) * s.
  function furnitureBoxes(list, m) {
    const out = [];
    for (const f of list) {
      if (f.flat) continue;
      if (!f.box0) {
        const P = f.base || f.mesh.geometry.attributes.position.array;
        f.box0 = f.pieces.map(([i0, i1]) => {
          const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
          for (let i = i0 * 3; i < i1 * 3; i += 3) for (let a = 0; a < 3; a++) { b[a] = Math.min(b[a], P[i + a]); b[a + 3] = Math.max(b[a + 3], P[i + a]); }
          return b;
        });
      }
      f.mesh.updateWorldMatrix(true, false);
      f.pieces.forEach(([, , ax, ay, az], j) => {
        const b = f.box0[j], A = [ax, ay, az];
        const box = new THREE.Box3(
          new THREE.Vector3(...[0, 1, 2].map((a) => A[a] + (b[a] - A[a]) * f.s)),
          new THREE.Vector3(...[0, 1, 2].map((a) => A[a] + (b[a + 3] - A[a]) * f.s)));
        out.push(box.applyMatrix4(f.mesh.matrixWorld).expandByScalar(m));
      });
    }
    return out;
  }
  const hallOk = (p) => {
    freeV.subVectors(p, camFree.o);
    const D = freeV.length();
    return D < 1e-3 || D <= freeCone(freeV.divideScalar(D)) - camFree.m;
  };
  const inBox = (p) => camFree.boxes.find((b) => b.containsPoint(p));
  const freeOk = (p) => hallOk(p) && !inBox(p);
  // Ein- und Austritt der Linie t + s·d durch den Quader b (s ab t)
  function boxSpan(t, d, b) {
    let s0 = -Infinity, s1 = Infinity;
    for (const a of ['x', 'y', 'z']) {
      if (Math.abs(d[a]) < 1e-9) continue;
      const u = (b.min[a] - t[a]) / d[a], v = (b.max[a] - t[a]) / d[a];
      s0 = Math.max(s0, Math.min(u, v)); s1 = Math.min(s1, Math.max(u, v));
    }
    return [s0, s1];
  }
  // Das Blickziel selbst muss nur vor der ersten Fläche liegen, ohne Rand
  // und Kegel: ein Hardpoint knapp über dem Boden wäre sonst nie frei, und
  // die Grenze fiele im Fokus darauf ganz aus
  const targetOk = (p) => {
    freeV.subVectors(p, camFree.o);
    const D = freeV.length();
    return (D < 1e-3 || D <= freeRay(freeV.divideScalar(D))) && !inBox(p);
  };
  // Abstand, den die Kamera in Richtung d vom Ziel t mindestens braucht, um
  // außerhalb des Schiffs zu stehen (0: kein Schiff in dieser Richtung).
  // Innerhalb des 3-Grad-Kegels zählt die fernste Fläche voll, weiter außen
  // (sieben Ringe bis 34 Grad) weniger: Eine Fläche im Winkel a verlangt nur
  // L mit L + 1,2 · L · a = ihr Abstand, also um 1,2 · L je Bogenmaß weniger,
  // geschlossen gelöst, damit nichts von Bild zu Bild nachpendelt. So gleitet
  // die Kamera beim Drehen um einen Hardpoint vor dem Rumpf hinaus, statt bis
  // zu 7 m zu springen.
  const SHIP_RINGS = [5, 9, 13, 18, 23, 28, 34].map((g, i) => ({
    a: g * Math.PI / 180, c: Math.cos(g * Math.PI / 180), s: Math.sin(g * Math.PI / 180),
    j: Array.from({ length: 12 }, (_, j) => [Math.cos((j + (i % 2) * 0.5) * Math.PI / 6), Math.sin((j + (i % 2) * 0.5) * Math.PI / 6)]),
  }));
  function shipNeed(t, d) {
    if (!shipFree?.dist || shipFree.c !== current || !sameAim(shipFree.o, t)) return 0;
    const dist = shipFree.dist, f = freeCone(d, dist, Math.max);
    let need = f > 0 ? f + SHIP_M : 0;
    freeA.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize();
    freeB.crossVectors(d, freeA);
    for (const r of SHIP_RINGS) for (const [cb, sb] of r.j) {
      freeS.copy(d).multiplyScalar(r.c).addScaledVector(freeA, cb * r.s).addScaledVector(freeB, sb * r.s);
      const g = freeRay(freeS, dist);
      if (g > 0) need = Math.max(need, (g + SHIP_M) / (1 + 1.2 * r.a));
    }
    return need;
  }
  // Nach controls.update(): Steckt die Kamera im Schiff oder streift es, geht
  // sie auf der Linie vom Blickziel nach außen hinter seine fernste Fläche.
  // Steht sie dann nicht frei in der Halle, geht sie auf der Linie zum
  // Blickziel zum ersten freien Punkt von ihr aus; steht sie bei freier
  // Halle in einem Möbel, zum näheren Ausgang (nach außen nur, wenn es dort
  // frei ist). Ist die Linie nirgends frei, bleibt sie.
  const keepD = new THREE.Vector3(), keepQ = new THREE.Vector3();
  const keepAt = (t, x) => keepQ.copy(t).addScaledVector(keepD, x);
  function keepFree() {
    const c = camera.position, t = controls.target;
    let L = keepD.subVectors(c, t).length();
    if (L < 1e-6) return;
    keepD.divideScalar(L);
    const need = shipNeed(t, keepD);
    if (L < need) { L = Math.min(need, controls.maxDistance); c.copy(keepAt(t, L)); }
    if (!camFree || freeOk(c) || !targetOk(t)) return;
    const b = hallOk(c) && inBox(c);
    if (b) {
      const [s0, s1] = boxSpan(t, keepD, b), out = s1 + 1e-3;
      if (out - L < L - s0 && out <= controls.maxDistance && freeOk(keepAt(t, out))) { c.copy(keepQ); return; }
    }
    let lo = -1, hi = L;
    for (let i = 1; i <= 48; i++) {
      const x = L * (1 - i / 48);
      if (freeOk(keepAt(t, x))) { lo = x; break; }
      hi = x;
    }
    if (lo < 0) return;
    for (let i = 0; i < 12; i++) {
      const x = (lo + hi) / 2;
      if (freeOk(keepAt(t, x))) lo = x; else hi = x;
    }
    c.copy(keepAt(t, lo));
  }

  // Spiegelbild für den Boden (hallRefl): die Kamera an der Bodenebene
  // gespiegelt, mit schräger Nahebene in der Ebene (three.js Reflector),
  // dazu Halle und Crew ausgeblendet, alle Lampen an, also dieselben
  // Shaderprogramme wie im Bild. Die Crew sind 256 Teile, ihr Spiegelbild
  // aber nur ein Fleck an den Füßen: Mit ihr kostete das Spiegelbild 425
  // Zeichenaufrufe je Bild (Gladius, +25 %), ohne sie etwa so viele, wie
  // das Schiff Teile hat. Erst mit dem Composer: Ohne ihn zeichnet das Bild
  // direkt auf den Schirm, mit anderen Programmen. Am Telefon nicht, dort
  // zählt jeder Zeichenaufruf, und unter der hohen Stufe auch nicht.
  const MIRROR = !SMALL, MIRROR_SCALE = 0.5;
  let mirrorRT = null;
  const mirrorCam = new THREE.PerspectiveCamera();
  const mN = new THREE.Vector3(0, 1, 0), mO = new THREE.Vector3(), mC = new THREE.Vector3(), mT = new THREE.Vector3();
  const mR = new THREE.Matrix4(), mK = new THREE.Matrix4(), mPlane = new THREE.Plane(), mClip = new THREE.Vector4(), mQ = new THREE.Vector4();
  const mSize = new THREE.Vector2(), mClear = new THREE.Color();
  const mBias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  function renderMirror() {
    hallRefl.on.value = 0;
    if (!MIRROR || level !== 'hoch' || !composer || !realHall?.model || !realHall.envOn || !current) return;
    camera.updateMatrixWorld();
    mC.setFromMatrixPosition(camera.matrixWorld);
    if (mC.y <= 0.01) return;
    renderer.getDrawingBufferSize(mSize);
    const w = Math.max(1, Math.round(mSize.x * MIRROR_SCALE)), h = Math.max(1, Math.round(mSize.y * MIRROR_SCALE));
    if (!mirrorRT) mirrorRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    else if (mirrorRT.width !== w || mirrorRT.height !== h) mirrorRT.setSize(w, h);
    mR.extractRotation(camera.matrixWorld);
    mirrorCam.position.copy(mC).reflect(mN);
    mT.set(0, 0, -1).applyMatrix4(mR).add(mC).reflect(mN);
    mirrorCam.up.set(0, 1, 0).applyMatrix4(mR).reflect(mN);
    mirrorCam.lookAt(mT);
    mirrorCam.updateMatrixWorld();
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    mPlane.setFromNormalAndCoplanarPoint(mN, mO).applyMatrix4(mirrorCam.matrixWorldInverse);
    mClip.set(mPlane.normal.x, mPlane.normal.y, mPlane.normal.z, mPlane.constant);
    const e = mirrorCam.projectionMatrix.elements;
    mQ.set((Math.sign(mClip.x) + e[8]) / e[0], (Math.sign(mClip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    mClip.multiplyScalar(2 / mClip.dot(mQ));
    e[2] = mClip.x; e[6] = mClip.y; e[10] = mClip.z + 1; e[14] = mClip.w;
    mirrorCam.projectionMatrixInverse.copy(mirrorCam.projectionMatrix).invert();
    const k = hallRoot.scale.x;
    hallRefl.mat.value.copy(mBias).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse).multiply(mK.makeScale(k, k, k));
    const model = realHall.model, crew = life.root, crewOn = crew.visible, bg = scene.background, alpha = renderer.getClearAlpha();
    // Ohne die durchsichtigen Teile des Schiffs (Decals, Relief): mit der
    // Gladius 40 der 169 Aufrufe, 41 der 60 Shaderwechsel und 1,3 ms
    // Prozessorzeit je Bild (gemessen vor onePass)
    const clear = current.clear.filter((n) => n.visible);
    renderer.getClearColor(mClear);
    model.visible = false; crew.visible = false; scene.background = null;
    for (const n of clear) n.visible = false;
    // Schattenkarten bleiben die des letzten Bilds (gleich darauf neu)
    renderer.shadowMap.needsUpdate = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(mirrorRT);
    renderer.clear();
    renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(null);
    renderer.setClearColor(mClear, alpha);
    model.visible = true; crew.visible = crewOn; scene.background = bg;
    for (const n of clear) n.visible = true;
    hallRefl.tex.value = mirrorRT.texture;
    hallRefl.on.value = 1;
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const now = typeof ts === 'number' ? ts : performance.now();
    vsync(now);
    // ohne Bild auch kein Ton: Die Bewegung läuft nach der Uhr weiter, ohne
    // Bilder blieben aber Halt und Umkehr aus, die Fahrschleife liefe fort.
    // Beim Wiederkommen setzt fx.frame Fahrt und Tor an der Stelle neu an.
    if (!visible) { sound.hush(); return; }
    // vor dem ersten Bild ist die Leinwand unsichtbar: nichts zu zeichnen
    if (REAL && !revealed) return;
    if (!focused && now > hoverUntil) { sound.hush(); return; }
    // Bewegung, die jemand auslöst oder verfolgt: volle Rate. Auch solange
    // ein Wechsel läuft (busy) und das Feld unten auf das neue Schiff wartet:
    // Sonst fiel die Bühne dort nach IDLE_MS auf IDLE_SCALE der Schärfe und
    // mit der Auffahrt wieder zurück, Verdeckung und Spiegel in anderer
    // Auflösung (20.10.2026, Krisz: „beleuchtungsprobleme (poppen)“). Ein
    // Laden, das hängt, hält sie nicht länger als 60 s wach.
    if ((busy && now - busyAt < 60000) || dragging || fly || fovGlide || propGlide || lift.dur || realHall?.shaft?.gate?.run || leaving || fade.to || (current && now - current.born < 1600) || (steam && last < steam.until)) wake(300);
    // Ruhe: nichts zu zeichnen
    const quiet = now - Math.max(seen, activeUntil);
    if (quiet > REST_MS + REST_EASE) return;
    const cap = Math.min(fpsCap || FPS_ACTIVE, now < activeUntil ? FPS_ACTIVE : FPS_IDLE);
    // im Raster des Schirms (paced); die halbe Bildzeit Spielraum fängt das
    // Zittern der Zeitstempel
    const iv = paced(cap);
    if (now < due - vsMs / 2) return;
    due = Math.max(due + iv, now + iv / 2);
    const t = (now - T0) / 1000;
    const dt = Math.min(0.1, t - last); last = t;
    const scale = quiet > IDLE_MS ? IDLE_SCALE : 1;
    if (scale !== pixelScale) { pixelScale = scale; applyPixels(); }
    for (const f of anim) f(t);
    life.update(dt, t, !!realHall?.lift && (lift.y !== 0 || lift.dur > 0));
    if (dust && !reduceMotion) dust.update(t);
    if (lift.dur) {
      // Aufzug: fährt sanft an und bremst sanft (liftEase); vor t0 steht er
      const k = Math.min(1, Math.max(0, (now - lift.t0) / lift.dur)), dir = lift.to > lift.from ? 'up' : 'down';
      if (k > 0 && !lift.going) { lift.going = true; fx.liftGo(dir, now - lift.t0); }
      const halt = lift.t0 + lift.dur - SND_HIT['platte-halt'] * 1000;
      if (lift.going && !lift.halted && now >= halt) { lift.halted = true; fx.liftHalt(dir, now - halt); }
      lift.y = lift.from + (lift.to - lift.from) * liftEase(k);
      if (k >= 1) {
        const late = now - lift.t0 - lift.dur;
        lift.dur = 0; lift.y = lift.to; lift.going = false;
        fx.liftStop(dir, late);
        settleLift();
      }
    }
    gateFrame(now);
    fx.frame(now, t);
    if (realHall?.lift) {
      realHall.lift.position.y = lift.y;
      if (realHall.dienst) realHall.dienst.group.position.y = realHall.floorY + lift.y;
      hallLiftY.value = lift.y;
      const sh = realHall.shaft;
      if (sh) {
        // Schacht nur, solange das Feld unterwegs oder unten ist; die Lampen
        // gehen mit der Fahrt an. Warnlichter: am Schacht (Spielstil 5) weich
        // an und aus im Sekundentakt, an der Plattform (Stil 2) ein Puls alle
        // zwei Sekunden; beides nachempfunden, die Spielkurven fehlen im Export.
        const active = lift.dur > 0 || lift.y < -1e-3;
        // Ist das Tor zu, sieht niemand hinein: Schacht, Feld und das Schiff
        // darunter kosten dann nichts (der Tausch wartet oft aufs Laden)
        const sealed = sh.gate?.state === 'closed' && !sh.gate.run;
        sh.pit.visible = active && !sealed;
        // Das Tor liegt sichtbar in seiner Nische, solange man in den Schacht
        // sieht (19.10.2026, Krisz: „siehstr du wie es einfach aus dem nichts
        // erscheint?“). Bis dahin kam es erst mit dem Schließen ins Bild: Die
        // Stirnplatten, offen in der Nische an den Enden (GATE_STOW), tauchten
        // dort mit einem Bild auf und verschwanden nach dem Öffnen ebenso. In
        // Ruhe deckt das Feld den Schacht, dann bleibt es aus.
        if (sh.gate) sh.gate.group.visible = active || !!sh.gate.run || sh.gate.state === 'closed';
        realHall.lift.visible = !sealed;
        if (realHall.dienst) realHall.dienst.group.visible = !sealed;
        if (!active) pitState.t0 = 0;
        else if (!pitState.t0) pitState.t0 = now;
        const on = active ? Math.min(1, (now - pitState.t0) / PIT_FADE_MS) : 0;
        const bx = 0.5 + 0.5 * Math.cos(t * Math.PI * 2), by = Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI), 4);
        hallPit.k.value.set(on, lift.y, 0);
        hallPit.blink.value.set(bx, by);
        if (sh.fx) sh.fx.visible = active && !sealed;
        if (sh.edge) sh.edge.visible = active && !sealed;
        // Lichtregie nur unterwegs nachführen (in Ruhe rechnet sie nichts)
        if (active || hallShaft.beam.value.x) {
          hallShaft.c.value.w = bx;
          hallShaft.e.value.y = (t * SHAFT_RUN_SPEED) % (sh.around || 1);
          hallShaft.beam.value.x = on; hallShaft.beam.value.y = lift.y;
        }
        if (sh.glow) sh.glow.emissiveIntensity = on * (0.4 + 5.6 * bx);
      }
      // Wer auf dem Schiffsfeld steht, fährt mit; festgelegt in Ruhelage und
      // unten beim Tausch, damit niemand unterwegs an den Rand springt
      const L = realHall.liftL, k = hallRoot.scale.x, hx = (L.to[0] - L.from[0]) * k / 2, hz = (L.to[1] - L.from[1]) * k / 2;
      const pick = lift.y === 0 || lift.regroup;
      lift.regroup = false;
      for (const w of life.root.children) {
        const u = w.userData;
        if (pick) u.ride = Math.abs(w.position.x) < hx && Math.abs(w.position.z) < hz;
        if (!u.ride) {
          // stand vorher auf dem Feld und jetzt daneben: zurück auf den Boden
          if (u.dim && (u.dim.f !== 1 || u.dim.cool)) { dimIn(u.dim, 1); w.position.y = 0; }
          continue;
        }
        w.position.y = lift.y * k;
        if (u.mats) dimIn(u.dim ??= dimOf(u.mats), Math.min(1, liftShade(-lift.y - 0.9 / k) + PIT_SHIP * pitAt(lift.y + 0.9 / k)), shaftCool(lift.y + 0.9 / k));
      }
    }
    if (current) {
      const g = current.group;
      if (current.lift) {
        // steht auf dem Aufzug und fährt mit ihm, im Schacht abgedunkelt
        const k = hallRoot.scale.x;
        g.position.y = g.userData.baseY + lift.y * k;
        g.rotation.y = 0;
        g.visible = !(realHall?.shaft?.gate?.state === 'closed' && !realHall.shaft.gate.run);
        const yc = lift.y + current.info.height / 2 / k;
        dimIn(current.dim, Math.min(1, liftShade(-yc) + PIT_SHIP * pitAt(yc)), shaftCool(yc));
      } else {
        // Einfahrt: senkt sich aus der Höhe auf die Plattform und dreht ein,
        // setzt weich auf (ease-out quint), solange das alte noch abhebt
        const k = reduceMotion ? 1 : Math.min(1, Math.max(0, now - current.born - 120) / 1100);
        const e = 1 - Math.pow(1 - k, 5);
        g.position.y = g.userData.baseY + shipBob() * Math.sin(t * 1.1) + (1 - e) * span * 0.18;
        g.rotation.y = (1 - e) * -0.45;
        g.visible = reduceMotion || now - current.born > 60;
      }
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
    if (freeDirty) measureFree();
    if (shipStale()) measureShip();
    // camWant: der Abstand, den der Nutzer will. OrbitControls dreht und
    // zoomt schon im Zeiger- oder Mausradereignis, also zwischen zwei
    // Bildern: Drehen lässt ihn, Hineinzoomen setzt ihn auf den neuen
    // Abstand, Herauszoomen mindestens darauf. Die Kamera gleitet zu ihm
    // zurück, sobald der Weg frei ist; die Grenze greift danach erneut.
    const flying = !!fly;
    if (!flying) {
      const r = camera.position.distanceTo(controls.target);
      if (!camRef) camWant = r;
      else if (!camera.position.equals(camLast)) {
        const q = r / camRef;
        if (q < 0.9999) camWant = r; else if (q > 1.0001) camWant = Math.max(camWant, r);
      }
      if (Math.abs(camWant - r) > 1e-3) camera.position.sub(controls.target).setLength(r + (camWant - r) * (reduceMotion ? 1 : Math.min(1, dt * 5))).add(controls.target);
    }
    if (fly) flyStep(now);
    if (fovGlide) fitFov(now);
    if (propGlide) propStep(now);
    controls.update(dt);
    // eine Kamerafahrt legt den Abstand fest, mit dem sie ankommt
    camWant = THREE.MathUtils.clamp(flying ? camera.position.distanceTo(controls.target) : camWant, controls.minDistance, controls.maxDistance);
    keepFree();
    // Shift-Optik folgt Höhe, Schiff und Titel weich; im ersten Bild sitzt sie
    const lw = lensWant();
    if (Math.abs(lw - lensS) > 1e-4) {
      lensS = reduceMotion || !lensLive ? lw : lensS + (lw - lensS) * Math.min(1, dt * 6);
      fitFov();
    }
    lensLive = true;
    camLast.copy(camera.position);
    camRef = camera.position.distanceTo(controls.target);
    adapt(now, cap);
    renderMirror();
    renderer.shadowMap.needsUpdate = shadowsDue();
    if (composer) composer.render(); else renderer.render(scene, camera);
    if (frameFn) frameFn();
  }

  scaleWorld({ len: 14, halfW: 6, height: 4 });
  if (REAL) {
    lampsReady = loadHallLights(opts.hall);
    probeReady = loadHallProbe(opts.hall);
    // Nachbearbeitung nur in der hohen Stufe
    composerReady = Q0 === 'hoch' ? lampsReady.then(() => enableAO()) : lampsReady.then(() => {});
    // Am Telefon und in der niedrigen Stufe die leichtere Halle, wenn die
    // Seite eine mitgibt (gleicher Modellraum, also dieselben Lampen und
    // Sonden), und keine Möbel; Glas, Rohre und Füllung kommen dort aus der
    // Telefon-Datei (60 KB statt 4 MB).
    loadRealHall(SMALL || Q0 === 'niedrig' ? { ...opts.hall, ...(opts.hall.lite?.url ? opts.hall.lite : {}), furniture: /* hall-patch */ opts.hall.patch ?? null } : opts.hall);
  }
  // Crew aus dem Spiel; in der echten Halle zeigt sich ohne sie niemand
  // (die gebauten Figuren wären Selbstgebautes)
  if (opts.crew?.url) {
    fetchGltf(opts.crew.url, 'crew', 2e5).then(async (g) => {
      g.scene.traverse((n) => { if (n.isMesh) for (const m of [].concat(n.material)) unifyMaps(m); });
      await life.setCrew(g.scene);
      // nur die neuen Figuren, nicht die gebauten Arbeiter, die gleich weichen
      const parts = life.crewMeshes();
      await prepare({ traverse: (f) => parts.forEach((o) => o.traverse(f)), traverseVisible: (f) => parts.forEach((o) => o.traverseVisible(f)) });
      life.showCrew();
      if (REAL) life.root.visible = revealed;
    }).catch(() => { /* gebaute Arbeiter bleiben */ }).finally(() => prog.delete('crew'));
  }
  frame();

  const ro = new ResizeObserver(() => {
    wake(500);
    renderer.setSize(W(), H());
    composer?.setSize(W(), H());
    fitFov();
    if (!touched) camera.position.sub(controls.target).setLength(homeDist()).add(controls.target);
  });
  ro.observe(container);
  const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; });
  io.observe(container);
  const onVis = () => { visible = !document.hidden; sound.pause(document.hidden); };
  document.addEventListener('visibilitychange', onVis);
  const onFocus = () => { focused = document.hasFocus(); if (focused) wake(500); };
  const onBlur = () => { focused = false; hoverUntil = 0; };
  const onHover = (e) => {
    const now = performance.now();
    if (!focused) hoverUntil = now + BG_HOVER;
    const r = container.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom) seen = now;
  };
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointermove', onHover, { passive: true });

  return {
    show,
    setLivery,
    paint,
    fit,
    resetView,
    project,
    focus,
    // Die obersten px der Bühne verdeckt die Oberfläche (Titelblock am
    // Telefon): das Schiff rückt in den freien Teil darunter; 0 = mittig.
    setCover(px) { coverTop = Math.max(0, Number(px) || 0); wake(300); },
    // Leistungsstufe: { level, start, why, pixelRatio, levels }; onQuality
    // meldet jede Änderung (Nachregeln)
    quality,
    onQuality(fn) { qualityFn = fn; },
    onFrame(fn) { frameFn = fn; },
    onProgress(fn) { progressFn = fn; },
    // fn(true): Zeichenkontext verloren, fn(false): wieder da
    onLost(fn) { lostFn = fn; },
    // Geräusche an/aus (Schalter auf der Bühne); sound(): { on, can }. Ohne
    // Bewegung (reduceMotion) fährt nichts, dann gibt es auch nichts zu hören.
    setSound(on) { sound.set(on); },
    sound: () => ({ on: sound.on, can: !reduceMotion && !!(window.AudioContext || window.webkitAudioContext) }),
    dispose() {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', unlockSound, { capture: true });
      document.removeEventListener('keydown', unlockSound, { capture: true });
      sound.dispose();
      steam?.dispose();
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointermove', onHover);
      controls.dispose();
      disposeObject(scene);
      envRT.dispose();
      hallEnv?.dispose();
      mirrorRT?.dispose();
      for (const rt of [...statRT, statEmpty]) { rt.depthTexture.dispose(); rt.dispose(); }
      statMat.dispose();
      hallVol.a.value?.dispose(); hallVol.b.value?.dispose();
      for (const ps of composer?.passes ?? []) ps.dispose?.();
      composer?.dispose();
      for (const k of Object.values(cubeKit)) { k.rt.dispose(); k.mat.dispose(); }
      draco.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
