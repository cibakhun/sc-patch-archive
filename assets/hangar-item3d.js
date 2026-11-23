// Items in 3D: Betrachter für ein einzelnes Item (Rüstungsteil) im Dialog
// der Item- und Blueprint-Seite (src/components/Item3d.astro). Wird erst
// beim Klick auf „In 3D ansehen“ geladen und nur im Vorschau-Bau
// ausgeliefert: der Name beginnt mit hangar-, darum räumt
// scripts/_hangar-switch.mjs die Datei aus dem Live-Bau, und
// verify:hangar-schalter [2] reißt, wenn eine Live-Seite sie lädt.
//
// Das Modell kommt aus dem eigenen Speicher (src/lib/item3d.ts) als
// Draco-gepacktes glTF, die Texturen liegen als .webp daneben. Keine
// automatische Kamerafahrt (Regel aus dem Hangar): nur Ziehen, Zoomen,
// Verschieben und der Knopf „Ansicht zurücksetzen“. Gezeichnet wird nur,
// wenn sich etwas bewegt, und gar nicht, solange der Dialog zu ist.
//
// Alle sichtbaren Texte stehen als data-* am Dialog (DE/EN aus itemText.ts).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DRACO_PFAD = '/vendor/three/addons/libs/draco/gltf/';
// Erster Blick: leicht von rechts und von oben, wie im Prototyp.
const YAW = THREE.MathUtils.degToRad(25);
const PITCH = THREE.MathUtils.degToRad(8);
// Lange Teile (Waffen, Zielfernrohre: Mündung zeigt nach +Z) von der Seite,
// Mündung nach rechts, leicht von vorn; sonst sähe man in den Lauf.
const YAW_LANG = THREE.MathUtils.degToRad(-65);
const istLang = (box) => {
  const s = box.getSize(new THREE.Vector3());
  return s.z > 1.6 * Math.max(s.x, s.y);
};

const offen = new WeakMap(); // Dialog -> Betrachter

/** Öffnet (oder zeigt wieder) den Betrachter in diesem Dialog. */
export function zeige(dialog) {
  let b = offen.get(dialog);
  // Nach einem Ladefehler (Netz weg, Ablage kurz nicht erreichbar) beim
  // naechsten Oeffnen ganz neu anfangen; ein geladenes Modell bleibt.
  if (b?.kaputt) {
    b.weg();
    b = null;
  }
  if (!b) {
    b = baue(dialog);
    offen.set(dialog, b);
  }
  b?.weiter();
}

function baue(dialog) {
  const d = dialog.dataset;
  const buehne = dialog.querySelector('[data-i3d-stage]');
  const status = dialog.querySelector('[data-i3d-status]');
  const zurueck = dialog.querySelector('[data-i3d-reset]');
  const melde = (text) => {
    status.textContent = text ?? '';
    status.hidden = !text;
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    melde(d.noGl);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  buehne.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  scene.environment = pm.fromScene(env, 0.04).texture;
  scene.environmentIntensity = 0.9;
  env.dispose();
  pm.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc7ff, 1.2);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const halter = new THREE.Group();
  scene.add(halter);

  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.8;

  let dirty = true;
  let raf = 0;
  controls.addEventListener('change', () => { dirty = true; });
  const tick = () => {
    raf = 0;
    if (!dialog.open) return; // zu: nichts zeichnen, bis weiter() kommt
    if (controls.update() || dirty) {
      renderer.render(scene, cam);
      dirty = false;
    }
    raf = requestAnimationFrame(tick);
  };

  const groesse = () => {
    const w = buehne.clientWidth;
    const h = buehne.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    dirty = true;
  };
  const beobachter = new ResizeObserver(groesse);
  beobachter.observe(buehne);

  // Abstand so, dass alle acht Ecken der Hülle mit Rand ins Bild passen.
  let huelle = null;
  const abstand = (box, richtung) => {
    const ecken = [];
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) ecken.push(new THREE.Vector3(x, y, z));
    cam.near = 0.001;
    cam.far = 1000;
    cam.updateProjectionMatrix();
    const v = new THREE.Vector3();
    const reicht = (r) => {
      cam.position.copy(richtung).multiplyScalar(r);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      let m = 0;
      for (const p of ecken) {
        v.copy(p).project(cam);
        if (v.z < -1 || v.z > 1) return Infinity;
        m = Math.max(m, Math.abs(v.x), Math.abs(v.y));
      }
      return m;
    };
    let lo = 0.01;
    let hi = 200;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (reicht(mid) > 0.84) lo = mid; else hi = mid;
    }
    return hi;
  };
  const ansichtZurueck = () => {
    if (!huelle) return;
    groesse();
    const yaw = istLang(huelle) ? YAW_LANG : YAW;
    const richtung = new THREE.Vector3(Math.sin(yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(yaw) * Math.cos(PITCH));
    const r = abstand(huelle, richtung);
    controls.target.set(0, 0, 0);
    cam.position.copy(richtung).multiplyScalar(r);
    cam.near = r / 100;
    cam.far = r * 10;
    cam.updateProjectionMatrix();
    controls.minDistance = r * 0.15;
    controls.maxDistance = r * 3;
    controls.update();
    dirty = true;
  };
  zurueck.addEventListener('click', ansichtZurueck);
  let kaputt = false;

  // Laden: ein Entpacker-Arbeiter genügt für ein Teil; danach wird er beendet.
  const draco = new DRACOLoader().setDecoderPath(DRACO_PFAD).setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  melde(d.loading);
  loader.load(
    d.i3dModel,
    (gltf) => {
      draco.dispose();
      const s = gltf.scene;
      s.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      s.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(s);
      const mitte = box.getCenter(new THREE.Vector3());
      s.position.sub(mitte);
      box.translate(mitte.negate());
      halter.add(s);
      huelle = box;
      zurueck.hidden = false;
      melde(null);
      ansichtZurueck();
      dialog.dataset.i3dBereit = '1';
    },
    (e) => {
      if (e.total) melde(`${d.loading} ${Math.min(99, Math.round((e.loaded / e.total) * 100))} %`);
    },
    () => {
      draco.dispose();
      kaputt = true;
      melde(d.fail);
      dialog.dataset.i3dBereit = 'fehler';
    },
  );

  return {
    get kaputt() { return kaputt; },
    weiter() {
      groesse();
      dirty = true;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    weg() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      beobachter.disconnect();
      zurueck.removeEventListener('click', ansichtZurueck);
      controls.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete dialog.dataset.i3dBereit;
    },
  };
}
