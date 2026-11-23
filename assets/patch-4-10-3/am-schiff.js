// Ein Schiffsmodell der Halle mit dem geaenderten Teil in Rot. Licht und Blickwinkel wie die Schiffsbilder der
// Chronik (scripts/render-hangar-cards.mjs: Raumlicht, ACES, schraeg von vorn), damit das Modell das ruhende Bild
// ohne Sprung abloest.
//
// API:
//   vorladen(schiffe)  holt und zerlegt Modelle und Raumlicht ohne WebGL, solange die Buehne naht
//   buehne(host, { eilig }) -> { zeige(schiff), dispose }
//     eilig: alles in einem Zug auf die GPU, ohne auf Bilder zu warten (scripts/render-am-schiff.mjs)
//   schiff: { modell, hardpoints, bauteil, punkte }
//     hardpoints: Namen der Einbauorte; ihre Netze im Modell (glTF-Extras „swap“) werden rot
//     bauteil:    Modell des Bauteils, wenn es im Rumpf sitzt und kein eigenes Netz hat (Radar);
//                 es steht rot an punkte[0] und wird ueber dem Rumpf gezeichnet
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ROT = new THREE.Color(0xff4b3e);
const BLICK = { az: 140, el: 18, fov: 30 };
/* Anteil der Buehne, den das Schiff in Ruhe fuellt; das Pendeln braucht Rand. */
const FUELLUNG = 0.8;
/* Arbeit je Bild beim Hochladen: Hauptfaden in ms, an die GPU in Bytes. Mehr Bytes stauen sich im GPU-Prozess;
   dann wartet jeder Aufruf, der eine Antwort braucht, und kein Bild wird fertig. */
const BUDGET = 5;
const BYTES = 6e6;

/* Jede Kombination belegter Kartenplaetze ist fuer three.js ein eigenes GPU-Programm (Carrack: 49). Fehlende Karten
   werden darum mit neutralen 1x1-Karten gefuellt: weiss multipliziert nichts weg, die flache Normale kippt nichts. */
const NEUTRAL = { map: 0xffffff, roughnessMap: 0xffffff, metalnessMap: 0xffffff, aoMap: 0xffffff, emissiveMap: 0xffffff, normalMap: 0x8080ff };
const neutraleKarten = new Map();
const neutral = (platz) => {
  if (!neutraleKarten.has(platz)) {
    const c = NEUTRAL[platz];
    const t = new THREE.DataTexture(new Uint8Array([c >> 16, (c >> 8) & 255, c & 255, 255]), 1, 1);
    t.needsUpdate = true;
    neutraleKarten.set(platz, t);
  }
  return neutraleKarten.get(platz);
};
const materialien = (wurzel) => {
  const mats = new Set();
  wurzel.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) mats.add(m); });
  return mats;
};
function einheitlich(wurzel) {
  const mats = [...materialien(wurzel)].filter((m) => m.isMeshStandardMaterial);
  const plaetze = Object.keys(NEUTRAL).filter((p) => mats.some((m) => m[p]));
  for (const m of mats) for (const p of plaetze) if (!m[p]) { m[p] = neutral(p); m.needsUpdate = true; }
}

/* Rot statt Farbkarte, Normal- und Rauheitskarten bleiben: das Teil behaelt seine Form und Oberflaeche. */
const rot = (m) => {
  const k = m.clone();
  k.color.copy(ROT);
  if (k.map) k.map = neutral('map');
  k.metalness = Math.min(k.metalness, 0.25);
  return k;
};
const einfaerben = (o) => {
  o.material = Array.isArray(o.material) ? o.material.map(rot) : rot(o.material);
};

/* Der GLTFLoader loest seine Abhaengigkeiten in einem Schwall auf (Carrack: Bilder bis 35 ms). Jede Abhaengigkeit
   wartet darum auf eine eigene Aufgabe; dazwischen zeichnet die Seite. */
const warte = [];
const kanal = new MessageChannel();
kanal.port1.onmessage = () => { warte.shift()?.(); if (warte.length) kanal.port2.postMessage(0); };
const takt = () => new Promise((r) => { if (warte.push(r) === 1) kanal.port2.postMessage(0); });
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/gltf/'));
loader.register((parser) => {
  const roh = parser.getDependency.bind(parser);
  parser.getDependency = (typ, i) => takt().then(() => roh(typ, i));
  return { name: 'takt' };
});

const vorrat = new Map();
const holen = (url) => {
  if (!vorrat.has(url)) vorrat.set(url, loader.loadAsync(url));
  return vorrat.get(url);
};

/* Raumlicht: RoomEnvironment durch den PMREMGenerator, einmal vorab gerechnet (scripts/render-am-schiff.mjs).
   Im Browser kostete dieselbe Rechnung kalt 0,6 s Stillstand. Datei: gzip, RGB als Halbfloat, Atlas 384x512. */
const UMGEBUNG = { url: new URL('./raum-umgebung.bin', import.meta.url), w: 384, h: 512 };
let umgebungsDaten = null;
const umgebung = () => umgebungsDaten ??= fetch(UMGEBUNG.url).then(async (r) => {
  if (!r.ok) throw new Error(`am-schiff: ${UMGEBUNG.url} ${r.status}`);
  let roh = new Uint8Array(await r.arrayBuffer());
  if (roh[0] === 0x1f && roh[1] === 0x8b) roh = new Uint8Array(await new Response(new Blob([roh]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const rgb = new Uint16Array(roh.buffer, roh.byteOffset, roh.byteLength / 2);
  const rgba = new Uint16Array(UMGEBUNG.w * UMGEBUNG.h * 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgba[i] = rgb[j]; rgba[i + 1] = rgb[j + 1]; rgba[i + 2] = rgb[j + 2]; rgba[i + 3] = 0x3c00;
  }
  return rgba;
});
const umgebungsTextur = (daten) => {
  const t = new THREE.DataTexture(daten, UMGEBUNG.w, UMGEBUNG.h, THREE.RGBAFormat, THREE.HalfFloatType);
  t.mapping = THREE.CubeUVReflectionMapping;
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
};

/* Ring um ein Bauteil im Rumpf: duenner Strich in Rot, ohne Leuchten. */
let ringMaterial = null;
const ringTextur = () => {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.strokeStyle = '#ff4b3e';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/* Ein Schiff zum Zeigen, einmal je Modell: Glas, einheitliche Kartenplaetze, rotes Teil. Ohne WebGL. */
const bereit = new Map();
const vorbereiten = (s) => {
  if (!bereit.has(s.modell)) bereit.set(s.modell, (async () => {
    const wurzel = (await holen(s.modell)).scene;
    wurzel.traverse((o) => {
      if (!o.isMesh) return;
      // Glas halb durchsichtig wie auf den Schiffsbildern, sonst steht vor jedem Cockpit eine graue Scheibe.
      for (const m of [].concat(o.material)) if (m.transmission > 0 || m.transparent) { m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.35); m.depthWrite = false; }
    });
    einheitlich(wurzel);
    // three.js haengt die Extras eines Knotens mit mehreren Primitiven an die Gruppe, nicht ans Netz.
    const orte = new Set(s.hardpoints);
    const teile = [];
    wurzel.traverse((o) => { if (orte.has(o.userData.swap)) o.traverse((n) => { if (n.isMesh) teile.push(n); }); });
    teile.forEach(einfaerben);
    wurzel.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(wurzel);
    const ausdehnung = box.getSize(new THREE.Vector3());
    const laenge = Math.max(ausdehnung.x, ausdehnung.y, ausdehnung.z);
    let innen = null;
    if (s.bauteil) {
      const teil = (await holen(s.bauteil)).scene.clone();
      einheitlich(teil);
      teil.traverse((n) => { if (n.isMesh) einfaerben(n); });
      teil.updateWorldMatrix(true, true);
      const mitte = new THREE.Box3().setFromObject(teil).getCenter(new THREE.Vector3());
      teil.position.fromArray(s.punkte[0]).sub(mitte);
      ringMaterial ??= new THREE.SpriteMaterial({ map: ringTextur(), transparent: true, depthTest: false, depthWrite: false });
      const ring = new THREE.Sprite(ringMaterial);
      ring.position.fromArray(s.punkte[0]);
      ring.scale.setScalar(laenge * 0.05);
      innen = new THREE.Group();
      innen.add(teil, ring);
    }
    if (!teile.length && !innen) throw new Error(`am-schiff: ${s.modell} ohne Netz fuer ${s.hardpoints.join(', ')}`);
    return { wurzel, innen, mitte: box.getCenter(new THREE.Vector3()), laenge, rad: ausdehnung.length() / 2, aufGpu: false };
  })());
  return bereit.get(s.modell);
};

/* Erst das eine, dann das andere Schiff: das erste ist so frueh wie moeglich fertig. */
export async function vorladen(schiffe) {
  await umgebung();
  for (const s of schiffe) await vorbereiten(s);
}

export function buehne(host, { eilig = false } = {}) {
  const naechstesBild = () => (eilig ? Promise.resolve() : new Promise((r) => requestAnimationFrame(() => r())));
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const leinwand = renderer.domElement;
  leinwand.className = 'amschiff__leinwand';
  host.appendChild(leinwand);

  /* Das Bauteil im Rumpf steht in einer eigenen Szene, die nach dem Rumpf ohne dessen Tiefe gezeichnet wird. */
  const scene = new THREE.Scene();
  const vorn = new THREE.Scene();
  for (const sz of [scene, vorn]) {
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-1, 2, 1.5);
    const rim = new THREE.DirectionalLight(0xffd7a0, 1.2);
    rim.position.set(2, 1, -2);
    sz.add(key, rim);
    // Nichts in der Szene bewegt sich, nur die Kamera: die Weltmatrizen einmal beim Einsetzen statt in jedem Bild.
    sz.matrixWorldAutoUpdate = false;
    sz.updateMatrixWorld(true);
  }
  let env = null;

  const kamera = new THREE.PerspectiveCamera(BLICK.fov, 16 / 9, 0.1, 5000);
  const steuer = new OrbitControls(kamera, leinwand);
  steuer.enableDamping = true;
  steuer.enablePan = false;
  // Senkrecht wischen scrollt die Seite weiter; nur waagrecht dreht das Modell.
  leinwand.style.touchAction = 'pan-y';
  /* Das Modell pendelt um den Blick der Schiffsbilder, statt ganz zu drehen: das Teil bleibt im Bild. Wer zieht, uebernimmt. */
  let angefasst = false;
  steuer.addEventListener('start', () => { angefasst = true; });
  let blick = null;

  let gezeigt = null;
  let laeuft = false;
  let pause = false;
  let sichtbar = false;
  let uhr = 0;
  let auftrag = 0;

  /* Nur bei echter Aenderung: jedes Setzen der Leinwandgroesse legt ihren Bildspeicher neu an. */
  const groesse = () => {
    const w = host.clientWidth, h = host.clientHeight;
    const alt = renderer.getSize(new THREE.Vector2());
    if (!w || !h || (alt.x === w && alt.y === h)) return;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(() => { if (pause) return; groesse(); zeichne(); });
  ro.observe(host);
  const io = new IntersectionObserver((e) => { sichtbar = e[0].isIntersecting; if (sichtbar) start(); });
  io.observe(host);

  function zeichne() {
    if (!gezeigt) return;
    renderer.clear();
    renderer.render(scene, kamera);
    if (gezeigt.innen) { renderer.clearDepth(); renderer.render(vorn, kamera); }
  }

  let zuletzt = 0;
  function schleife(jetzt) {
    if (!sichtbar || !gezeigt || pause) { laeuft = false; return; }
    uhr += Math.min(0.05, (jetzt - (zuletzt || jetzt)) / 1000);
    zuletzt = jetzt;
    if (!angefasst && !ruhig) stelle(blick, Math.sin(uhr * 0.22) * 18);
    steuer.update();
    zeichne();
    requestAnimationFrame(schleife);
  }
  function start() {
    if (laeuft || pause || !gezeigt || !sichtbar) return;
    laeuft = true;
    zuletzt = 0;
    requestAnimationFrame(schleife);
  }
  steuer.addEventListener('change', () => { if (!laeuft && !pause) zeichne(); });

  function stelle(b, pendel, k = kamera) {
    const a = THREE.MathUtils.degToRad(BLICK.az + pendel), e = THREE.MathUtils.degToRad(BLICK.el);
    k.position.copy(b.ziel).addScaledVector(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)), b.abstand);
    k.lookAt(b.ziel);
  }

  /* Abstand und Bildmitte aus den Eckpunkten des Netzes, nicht aus dem Huellkasten:
     dessen Ecken ragen unter Perspektive weit ueber den Rumpf, das Schiff stuende klein in der Mitte. */
  /* Mit einer Kopie der Kamera: das gezeigte Schiff bleibt im Blick, bis das neue fertig ist. */
  function einpassen(wurzel, mitte, rad) {
    const k = kamera.clone();
    const pkt = [];
    let gesamt = 0;
    wurzel.traverse((o) => { if (o.isMesh) gesamt += o.geometry.attributes.position.count; });
    const schritt = Math.max(1, Math.ceil(gesamt / 8000));
    const v = new THREE.Vector3();
    wurzel.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let n = 0; n < pos.count; n += schritt) pkt.push(v.fromBufferAttribute(pos, n).applyMatrix4(o.matrixWorld).clone());
    });
    const b = { ziel: mitte.clone(), abstand: rad / Math.sin(THREE.MathUtils.degToRad(BLICK.fov / 2)) };
    for (let runde = 0; runde < 4; runde++) {
      stelle(b, 0, k);
      k.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pkt) {
        v.copy(p).project(k);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const tiefe = v.copy(b.ziel).project(k).z;
      b.ziel.copy(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, tiefe).unproject(k));
      b.abstand *= Math.max((x1 - x0) / 2, (y1 - y0) / 2) / FUELLUNG;
    }
    return b;
  }

  /* Ein Schiff auf die GPU, ohne ein Bild zu verlieren. Je Bild hoechstens BUDGET ms Hauptfaden und BYTES an Daten,
     und erst weiter, wenn die GPU das Vorige abgearbeitet hat (Zaun): Texturen; Programme, je Bild hoechstens ein neues
     (three.js baut eines in rund 5 ms), uebersetzt parallel (KHR_parallel_shader_compile) und erst nach dem Linken
     abgefragt; Netze in Gruppen in ein Bildpunkt-Feld. */
  const gl = renderer.getContext();
  let zaun = null;
  const gpuFrei = () => {
    if (!zaun) return true;
    if (gl.getSyncParameter(zaun, gl.SYNC_STATUS) !== gl.SIGNALED) return false;
    gl.deleteSync(zaun);
    zaun = null;
    return true;
  };
  async function aufGpu(z, nr) {
    if (z.aufGpu) return true;
    const paare = [[z.wurzel, scene], ...(z.innen ? [[z.innen, vorn]] : [])];
    const gruppen = paare.map(([g]) => g);
    let t0 = performance.now(), bytes = 0;
    const bild = async () => {
      if (eilig) { t0 = performance.now(); bytes = 0; return nr === auftrag; }
      if (!bytes) {
        await naechstesBild();
        t0 = performance.now();
        return nr === auftrag;
      }
      /* Ein Bildpunkt auf der Leinwand: erst wenn sie etwas zeigt, reicht ANGLE (D3D11) die Arbeit an die GPU weiter,
         sonst meldet der Zaun bis zu 0,8 s lang nicht. */
      renderer.setScissorTest(true);
      renderer.setScissor(0, 0, 1, 1);
      renderer.clear();
      renderer.setScissorTest(false);
      zaun ??= gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      // Meldet ein Treiber nie (ohne Bildschirm, Software-GL), geht es nach einer halben Sekunde trotzdem weiter.
      for (let n = 0; n < 30; n++) { await naechstesBild(); if (gpuFrei() || nr !== auftrag) break; }
      if (zaun) { gl.deleteSync(zaun); zaun = null; }
      t0 = performance.now();
      bytes = 0;
      return nr === auftrag;
    };
    const weiter = async () => (performance.now() - t0 < BUDGET && bytes < BYTES) || bild();

    const texturen = new Set();
    for (const g of gruppen) for (const m of materialien(g)) for (const v of Object.values(m)) if (v && v.isTexture) texturen.add(v);
    for (const t of texturen) {
      const b = (t.image?.width ?? 1) * (t.image?.height ?? 1) * 4 * 1.34;
      if (bytes && bytes + b > BYTES && !(await bild())) return false;
      renderer.initTexture(t);
      bytes += b;
      if (!(await weiter())) return false;
    }

    if (bytes && !(await bild())) return false;

    /* Ein Programm nach dem anderen: erst wenn das vorige gelinkt ist, kommt das naechste. Liefen mehrere zugleich,
       wartete jede Rueckfrage an die GPU (Uniforms abfragen, auch das Anlegen des naechsten) bis 190 ms. */
    for (const [g, sz] of paare) {
      const dinge = [];
      g.traverse((o) => { if (o.material) dinge.push(o); });
      for (const o of dinge) {
        const vorher = new Set(renderer.info.programs);
        renderer.compile(o, kamera, sz);
        for (const p of renderer.info.programs) {
          if (vorher.has(p)) continue;
          if (!eilig) do if (!(await bild())) return false; while (!p.isReady());
          p.getUniforms();
          p.getAttributes();
        }
        if (!(await weiter())) return false;
      }
    }

    // Netze: erst nach dem Ausblenden der Leinwand zeichnen, solange noch ein anderes Schiff darauf steht.
    if (gezeigt && !eilig) { await new Promise((r) => setTimeout(r, 550)); if (nr !== auftrag) return false; }
    pause = true;
    const netze = [];
    for (const g of gruppen) g.traverse((o) => { if (o.isMesh) { netze.push(o); o.userData.sichtbar = o.visible; o.visible = false; } });
    const probe = new THREE.Scene();
    probe.environment = env;
    probe.add(...scene.children.filter((c) => c.isLight).map((l) => l.clone()), ...gruppen);
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    renderer.setViewport(0, 0, 1, 1);
    for (const o of netze) o.frustumCulled = false;
    let i = 0;
    while (i < netze.length) {
      if (!(await bild())) break;
      while (i < netze.length && performance.now() - t0 < BUDGET && bytes < BYTES) {
        const stapel = [];
        for (let b = 0; i < netze.length && b < BYTES / 4; i++) {
          const o = netze[i];
          stapel.push(o);
          o.visible = o.userData.sichtbar;
          for (const a of [...Object.values(o.geometry.attributes), o.geometry.index]) if (a) { b += a.array.byteLength; bytes += a.array.byteLength; }
        }
        renderer.render(probe, kamera);
        for (const o of stapel) o.visible = false;
      }
    }
    for (const o of netze) { o.visible = o.userData.sichtbar; o.frustumCulled = true; }
    renderer.setScissorTest(false);
    probe.remove(...gruppen);
    renderer.setViewport(0, 0, ...renderer.getSize(new THREE.Vector2()).toArray());
    pause = false;
    if (nr !== auftrag) return false;
    z.aufGpu = true;
    // Das erste volle Bild in einem eigenen Bild.
    return bild();
  }

  async function zeige(s) {
    const nr = ++auftrag;
    const [z, daten] = await Promise.all([vorbereiten(s), umgebung()]);
    if (nr !== auftrag) return false;
    // Klick, Renderer, Umgebung und Einpassen je in einem eigenen Bild.
    await naechstesBild();
    if (!env) {
      env = umgebungsTextur(daten);
      scene.environment = vorn.environment = env;
      renderer.initTexture(env);
      await naechstesBild();
    }
    if (nr !== auftrag) return false;
    groesse();
    const neu = einpassen(z.wurzel, z.mitte, z.rad);
    if (!(await aufGpu(z, nr))) return false;

    if (gezeigt) { scene.remove(gezeigt.wurzel); if (gezeigt.innen) vorn.remove(gezeigt.innen); }
    gezeigt = z;
    scene.add(z.wurzel);
    if (z.innen) vorn.add(z.innen);
    scene.updateMatrixWorld(true);
    vorn.updateMatrixWorld(true);
    angefasst = false;
    uhr = 0;
    blick = neu;
    kamera.near = z.rad / 100;
    kamera.far = z.rad * 100;
    kamera.updateProjectionMatrix();
    stelle(blick, 0);
    steuer.target.copy(blick.ziel);
    steuer.minDistance = blick.abstand * 0.45;
    steuer.maxDistance = blick.abstand * 1.6;
    steuer.update();
    zeichne();
    start();
    // Eingeblendet wird erst im naechsten Bild: das erste volle Zeichnen und das Ueberblenden nicht im selben.
    await naechstesBild();
    return nr === auftrag;
  }

  function dispose() {
    auftrag++;
    io.disconnect();
    ro.disconnect();
    steuer.dispose();
    renderer.dispose();
    leinwand.remove();
  }

  return { zeige, dispose };
}
