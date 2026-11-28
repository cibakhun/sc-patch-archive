// Items in 3D: Betrachter für ein einzelnes Item (Rüstungsteil) im Dialog
// der Item- und Blueprint-Seite (src/components/Item3d.astro) und der
// Items-Werkbank, die im selben Dialog nacheinander verschiedene Items
// zeigt (data-i3d-model wechselt), dazu mehrere Teile auf einmal: andere
// Farben nebeneinander oder ein ganzes Set getragen (data-i3d-modelle und
// data-i3d-art, siehe auftrag()). Wird erst
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
// Mehrere Teile nebeneinander eher von vorn, damit keins das nächste
// verdeckt (wie im Prototyp).
const YAW_REIHE = THREE.MathUtils.degToRad(12);
// Abstand zwischen Teilen nebeneinander: ein Fünftel des breitesten.
const LUECKE = 0.2;

/**
 * Was der Dialog zeigen soll: data-i3d-modelle (Adressen, durch Leerzeichen
 * getrennt) mit data-i3d-art „nebeneinander“ (andere Farben) oder sonst
 * „getragen“ (ein Set: jedes Teil sitzt, wo es am Körper sitzt); ohne
 * data-i3d-modelle das eine Modell aus data-i3d-model. Der Schlüssel sagt,
 * ob schon dasselbe geladen ist.
 * @param {DOMStringMap} ds
 */
export function auftrag(ds) {
  const urls = String(ds.i3dModelle || ds.i3dModel || '').split(/\s+/).filter(Boolean);
  const art = urls.length < 2 ? 'einzeln' : ds.i3dArt === 'nebeneinander' ? 'nebeneinander' : 'getragen';
  return { urls, art, schluessel: `${art} ${urls.join(' ')}` };
}

/**
 * Stellt die geladenen Teile in eine Gruppe und rückt deren Mitte in den
 * Ursprung. Getragen und einzeln bleibt jedes Teil, wo es im Modell steht
 * (Rüstung sitzt so am Körper); nebeneinander reihen sie sich nach rechts,
 * lange Teile (Waffen) untereinander, damit man sie von der Seite sieht.
 * @param {THREE.Object3D[]} szenen
 * @param {'einzeln'|'getragen'|'nebeneinander'} art
 */
export function anordnen(szenen, art) {
  const boxen = szenen.map((s) => {
    s.position.set(0, 0, 0);
    s.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(s);
  });
  const lang = boxen.length > 0 && boxen.every(istLang);
  if (art === 'nebeneinander') {
    const achse = lang ? 'y' : 'x';
    const luecke = LUECKE * Math.max(...boxen.map((b) => b.max[achse] - b.min[achse]));
    let lauf = 0;
    szenen.forEach((s, i) => {
      const b = boxen[i];
      if (lang) {
        s.position.y = lauf - b.max.y;
        lauf -= b.max.y - b.min.y + luecke;
      } else {
        s.position.x = lauf - b.min.x;
        lauf += b.max.x - b.min.x + luecke;
      }
    });
  }
  const gruppe = new THREE.Group();
  for (const s of szenen) gruppe.add(s);
  gruppe.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gruppe);
  const mitte = box.getCenter(new THREE.Vector3());
  gruppe.position.sub(mitte);
  box.translate(mitte.negate());
  return { gruppe, box, lang, reihe: art === 'nebeneinander' };
}

const offen = new WeakMap(); // Dialog -> Betrachter

/** Öffnet (oder zeigt wieder) den Betrachter in diesem Dialog. */
export function zeige(dialog) {
  let b = offen.get(dialog);
  const a = auftrag(dialog.dataset);
  if (!b) {
    b = baue(dialog, a);
    offen.set(dialog, b);
  } else if (b.kaputt || b.modell !== a.schluessel) {
    // Nach einem Ladefehler (Netz weg, Ablage kurz nicht erreichbar) oder
    // für ein anderes Item oder andere Teile (Werkbank) neu laden;
    // Zeichenfläche, Licht und Steuerung bleiben. Was geladen ist, bleibt
    // sonst stehen.
    b.lade(a);
  }
  b?.weiter();
}

// Gibt Geometrie, Materialien und Texturen eines entfernten Modells frei;
// sonst sammelte die Werkbank mit jedem gezeigten Item Grafikspeicher an.
// Texturen kommen in Browsern mit createImageBitmap als ImageBitmap; deren
// Bilddaten gibt dispose() nicht frei, das tut erst close(). Jede Textur und
// jedes Bild nur einmal, auch wenn Materialien sie teilen.
function raeume(obj) {
  const texturen = new Set();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    for (const mat of [].concat(o.material || [])) {
      for (const k of Object.keys(mat)) if (mat[k]?.isTexture) texturen.add(mat[k]);
      mat.dispose();
    }
  });
  const bilder = new Set();
  for (const t of texturen) {
    const bild = t.source?.data;
    if (typeof ImageBitmap !== 'undefined' && bild instanceof ImageBitmap) bilder.add(bild);
    t.dispose();
  }
  for (const b of bilder) b.close();
}

function baue(dialog, start) {
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
    const yaw = huelle.lang ? YAW_LANG : huelle.reihe ? YAW_REIHE : YAW;
    const richtung = new THREE.Vector3(Math.sin(yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(yaw) * Math.cos(PITCH));
    const r = abstand(huelle.box, richtung);
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
  let modell = null;
  // Jeder Ladevorgang hat seine Nummer; Rückrufe eines überholten (das Item
  // wechselte, während es noch lud) verwerfen ihr Ergebnis still.
  let nr = 0;

  // Laden: ein Entpacker-Arbeiter je Teil, höchstens zwei; danach werden sie
  // beendet. Mehrere Teile erscheinen erst zusammen, und scheitert eins,
  // scheitert die Ansicht (ein halbes Set wäre irreführend).
  const lade = (a) => {
    const meins = ++nr;
    modell = a.schluessel;
    kaputt = false;
    for (const alt of [...halter.children]) {
      halter.remove(alt);
      raeume(alt);
    }
    huelle = null;
    zurueck.hidden = true;
    delete dialog.dataset.i3dBereit;
    dirty = true;
    const aktuell = () => meins === nr;
    const fehler = () => {
      kaputt = true;
      melde(d.fail);
      dialog.dataset.i3dBereit = 'fehler';
    };
    if (!a.urls.length) { fehler(); return; }
    const draco = new DRACOLoader().setDecoderPath(DRACO_PFAD).setWorkerLimit(Math.min(2, a.urls.length));
    const loader = new GLTFLoader().setDRACOLoader(draco);
    melde(d.loading);
    // Fortschritt erst, wenn jedes Teil seine Größe genannt hat.
    const stand = a.urls.map(() => null);
    const fortschritt = () => {
      if (!aktuell() || stand.some((x) => !x)) return;
      let geladen = 0;
      let gesamt = 0;
      for (const [l, t] of stand) { geladen += l; gesamt += t; }
      melde(`${d.loading} ${Math.min(99, Math.round((geladen / gesamt) * 100))} %`);
    };
    const teil = (url, i) => new Promise((ok, nein) => loader.load(
      url,
      (gltf) => ok(gltf.scene),
      (e) => { if (e.total) { stand[i] = [e.loaded, e.total]; fortschritt(); } },
      nein,
    ));
    Promise.allSettled(a.urls.map(teil)).then((erg) => {
      draco.dispose();
      const szenen = erg.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      if (!aktuell() || szenen.length < erg.length) {
        for (const s of szenen) raeume(s);
        if (aktuell()) fehler();
        return;
      }
      for (const s of szenen) s.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      const lage = anordnen(szenen, a.art);
      halter.add(lage.gruppe);
      huelle = lage;
      zurueck.hidden = false;
      melde(null);
      ansichtZurueck();
      dialog.dataset.i3dBereit = '1';
    });
  };
  lade(start);

  return {
    get kaputt() { return kaputt; },
    get modell() { return modell; },
    lade,
    weiter() {
      groesse();
      dirty = true;
      if (!raf) raf = requestAnimationFrame(tick);
    },
  };
}
