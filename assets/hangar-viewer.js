// Hangar-Bühne: EIN Schiff steht beleuchtet auf einer Plattform in einer
// Halle, der Besucher dreht es frei und wechselt über das Karussell der
// Seite (components/hangar/HangarApp.astro). Gegenstück zu holo-viewer.js:
// dieselben Modelle (/holo/*.glb, Draco), aber als massiver, lackloser
// Metallrumpf unter Hallenlicht statt als Hologramm.
//
// API:  initHangar(container, { reduceMotion }) -> Promise<{
//         show(url) -> Promise<void>, onProgress(fn), dispose() }>
// three.js liegt selbst gehostet unter /vendor/three (Import-Map der Seite).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Jedes Schiff wird auf diese Ausdehnung (laengste Achse, Welteinheiten)
// gebracht: die Halle bleibt dieselbe, ob 5-m-Fahrzeug oder Grosskampfschiff.
// Die echte Laenge steht in den Werten daneben.
const SHIP_SPAN = 10;
const PAD_R = 6.4;

// Bodentextur: Plattenfugen + Markierungen, einmal auf eine Leinwand gemalt.
function floorTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#16191f';
  g.fillRect(0, 0, S, S);
  // leichtes Rauschen, damit die Fläche nicht wie Plastik wirkt
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(0,0,0,.55)';
  g.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    const p = (i / 4) * S;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,.05)';
  g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const p = (i / 4) * S + 3;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Gefahrenstreifen für den Plattformrand.
function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1a1a';
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#c9971f';
  for (let x = -32; x < 256; x += 32) {
    g.beginPath();
    g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(24, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Umgebungslicht für die Metallreflexe: eine kleine Ersatzhalle aus
// Leuchtbalken, einmal per PMREM vorgefiltert. Kein HDR-Download nötig.
function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x0b0d12);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const lit = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
  // Deckenbalken
  for (let i = -2; i <= 2; i++) {
    const m = new THREE.Mesh(box, lit(0xffffff, 6));
    m.scale.set(30, 0.4, 1.4);
    m.position.set(0, 14, i * 6);
    env.add(m);
  }
  // seitliche, warme und kalte Flächen
  const left = new THREE.Mesh(box, lit(0x8fb4ff, 1.4));
  left.scale.set(0.5, 8, 30); left.position.set(-18, 5, 0); env.add(left);
  const right = new THREE.Mesh(box, lit(0xffc27a, 1.1));
  right.scale.set(0.5, 8, 30); right.position.set(18, 5, 0); env.add(right);
  const floor = new THREE.Mesh(box, lit(0x22262e, 1));
  floor.scale.set(60, 0.2, 60); floor.position.set(0, -1, 0); env.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.04);
  pm.dispose();
  box.dispose();
  env.traverse((o) => o.material?.dispose?.());
  return rt;
}

function buildHall(scene, reduceMotion) {
  const anim = [];
  const floorTex = floorTexture();
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(80, 64),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.35, color: 0xb8bcc6 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Landeplattform: flache Scheibe, Gefahrenring, Leuchtkante.
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(PAD_R, PAD_R + 0.25, 0.22, 96),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.4, metalness: 0.7 })
  );
  pad.position.y = 0.11;
  pad.receiveShadow = true;
  scene.add(pad);
  const hazard = new THREE.Mesh(
    new THREE.RingGeometry(PAD_R - 0.55, PAD_R - 0.2, 128),
    new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6, metalness: 0.2 })
  );
  hazard.rotation.x = -Math.PI / 2;
  hazard.position.y = 0.225;
  hazard.receiveShadow = true;
  scene.add(hazard);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xf5a623, transparent: true, opacity: 0.85 });
  const glow = new THREE.Mesh(new THREE.TorusGeometry(PAD_R + 0.12, 0.035, 8, 160), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.21;
  scene.add(glow);
  if (!reduceMotion) anim.push((t) => { glowMat.opacity = 0.65 + 0.25 * Math.sin(t * 1.6); });

  // Rückwand-Bögen: Rippen im Halbkreis hinter dem Schiff, dazwischen
  // Leuchtstreifen. Geben der Halle Tiefe, ohne den Blick zu verstellen.
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.7, metalness: 0.5 });
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x9fc3ff });
  const ribGeo = new THREE.BoxGeometry(1.1, 18, 1.1);
  const stripGeo = new THREE.BoxGeometry(0.12, 12, 0.12);
  const R = 30;
  for (let i = 0; i < 18; i++) {
    const a = Math.PI * 0.15 + (i / 17) * Math.PI * 1.7; // offen zur Kamera hin
    const x = Math.sin(a) * R, z = -Math.cos(a) * R;
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(x, 9, z);
    rib.lookAt(0, 9, 0);
    scene.add(rib);
    const a2 = a + (Math.PI * 1.7) / 34;
    const s = new THREE.Mesh(stripGeo, stripMat);
    s.position.set(Math.sin(a2) * (R - 0.4), 7, -Math.cos(a2) * (R - 0.4));
    scene.add(s);
  }
  // Rückwand selbst: dunkler Zylinder, innen sichtbar
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.8, R + 0.8, 26, 72, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x0f1218, roughness: 0.9, metalness: 0.2, side: THREE.BackSide })
  );
  wall.position.y = 13;
  scene.add(wall);

  // Deckenstrahler-Leisten
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(22, 0.25, 0.6), barMat);
    bar.position.set(0, 21, i * 5.5);
    scene.add(bar);
  }

  // Licht: kühler Himmel, Hauptstrahler mit Schatten, warmes Gegenlicht.
  scene.add(new THREE.HemisphereLight(0xc8d6ff, 0x1a1c22, 0.55));
  const key = new THREE.SpotLight(0xffffff, 900, 70, Math.PI / 5, 0.5, 1.6);
  key.position.set(9, 22, 12);
  key.target.position.set(0, 1.5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 8;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xffb86b, 500, 60, Math.PI / 6, 0.6, 1.6);
  rim.position.set(-12, 12, -14);
  rim.target.position.set(0, 2, 0);
  scene.add(rim, rim.target);
  const fill = new THREE.DirectionalLight(0x8fb4ff, 0.6);
  fill.position.set(-10, 6, 10);
  scene.add(fill);

  return anim;
}

// Hüllquader ohne Ausreißer: manche Modelle tragen einzelne Splitter weit
// abseits des Rumpfs (Exportreste). Ein strenger Quader liesse das Schiff
// darum über der Plattform schweben und zu klein werden; gezählt wird
// deshalb vom 0,5. bis zum 99,5. Perzentil je Achse.
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
    const lo = a[Math.floor(a.length * 0.005)], hi = a[Math.ceil(a.length * 0.995) - 1];
    return [lo, hi];
  };
  const [x0, x1] = q(xs), [y0, y1] = q(ys), [z0, z1] = q(zs);
  return new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
}

// keep: geteiltes Material, das den Abbau eines Schiffs überleben muss.
function disposeObject(o, keep = null) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) [].concat(n.material).forEach((m) => { if (m !== keep) m.dispose(); });
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
  scene.fog = new THREE.Fog(0x07080b, 28, 70);
  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;
  const anim = buildHall(scene, reduceMotion);

  const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 200);
  // Startblick schräg von vorn oben. Der Abstand wächst auf schmalen
  // Bühnen (Hochformat), damit die volle Spannweite im Bild bleibt.
  const HOME_DIR = new THREE.Vector3(0.62, 0.34, 0.71).normalize();
  const homeDist = () => 18.5 * Math.min(2.2, Math.max(1, 1.3 / (W() / H())));
  const homePos = () => HOME_DIR.clone().multiplyScalar(homeDist()).add(new THREE.Vector3(0, 2, 0));
  camera.position.copy(homePos());

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 40;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; // nie unter den Boden
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.6;
  controls.update();
  let idleTimer = 0, touched = false;
  controls.addEventListener('start', () => { touched = true; controls.autoRotate = false; clearTimeout(idleTimer); });
  controls.addEventListener('end', () => {
    clearTimeout(idleTimer);
    if (!reduceMotion) idleTimer = setTimeout(() => { controls.autoRotate = true; }, 6000);
  });

  const draco = new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const shipMat = new THREE.MeshStandardMaterial({
    color: 0x9097a3, metalness: 0.72, roughness: 0.38, envMapIntensity: 1.1,
  });

  let current = null;      // { group, born }
  let leaving = null;      // { group, t0 }
  let token = 0;
  let progressFn = null;

  async function show(url) {
    const my = ++token;
    const gltf = await new Promise((resolve, reject) => {
      loader.load(url, resolve, (e) => {
        if (!progressFn) return;
        progressFn(e.total ? Math.round((e.loaded / e.total) * 100) : Math.min(99, Math.round(e.loaded / 4000)));
      }, reject);
    });
    if (my !== token) { disposeObject(gltf.scene); return; }   // überholt

    const model = gltf.scene;
    model.traverse((n) => {
      if (!n.isMesh) return;
      n.material.dispose();
      n.material = shipMat;
      // Neu gerechnete Normalen: die mitgelieferten sind nach der Dezimierung
      // bei Großschiffen (Polaris, Idris) fleckig und spiegeln als Tarnmuster.
      // Für den Holo-Look fiel das nicht auf, unter Hallenlicht schon.
      n.geometry.computeVertexNormals();
      n.castShadow = true;
      n.receiveShadow = true;
    });
    // Die Achsdrehung Z-oben -> Y-oben steckt schon im Knoten der .glb
    // (build-holo-meshes.mjs); hier wird nichts mehr gedreht.
    const wrap = new THREE.Group();
    wrap.add(model);
    wrap.updateMatrixWorld(true);
    const box = robustBox(wrap);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = SHIP_SPAN / Math.max(size.x, size.y, size.z, 0.001);
    model.position.set(-center.x, -box.min.y, -center.z);
    const ship = new THREE.Group();
    ship.add(wrap);
    ship.scale.setScalar(s);
    ship.userData.baseY = 0.32;
    ship.position.y = ship.userData.baseY;
    // Kamera-Ziel auf halbe Rumpfhöhe, damit flache und hohe Schiffe gleich stehen.
    controls.target.set(0, Math.max(1.2, size.y * s * 0.45 + 0.3), 0);

    if (leaving) { scene.remove(leaving.group); disposeObject(leaving.group, shipMat); leaving = null; }
    if (current) { leaving = { group: current.group, t0: performance.now() }; }
    scene.add(ship);
    current = { group: ship, born: performance.now() };
    if (progressFn) progressFn(100);
  }

  function resetView() {
    touched = false;
    camera.position.copy(homePos());
    controls.update();
  }

  const clock = new THREE.Clock();
  let raf = 0, visible = true;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    const now = performance.now();
    for (const f of anim) f(t);
    if (current) {
      const g = current.group;
      const k = reduceMotion ? 1 : Math.min(1, (now - current.born) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      g.position.y = g.userData.baseY + (reduceMotion ? 0 : 0.12 * Math.sin(t * 1.1)) + (1 - e) * 3;
      g.rotation.y = (1 - e) * -0.6;
    }
    if (leaving) {
      const k = reduceMotion ? 1 : Math.min(1, (now - leaving.t0) / 400);
      leaving.group.position.y += 0.25 * k;
      leaving.group.scale.multiplyScalar(1 - 0.08 * k);
      if (k >= 1) { scene.remove(leaving.group); disposeObject(leaving.group, shipMat); leaving = null; }
    }
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  const ro = new ResizeObserver(() => {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    if (!touched) camera.position.sub(controls.target).setLength(homeDist()).add(controls.target);
  });
  ro.observe(container);
  const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; });
  io.observe(container);
  const onVis = () => { if (document.hidden) visible = false; else visible = true; };
  document.addEventListener('visibilitychange', onVis);

  return {
    show,
    resetView,
    onProgress(fn) { progressFn = fn; },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      controls.dispose();
      disposeObject(scene);
      shipMat.dispose();
      envRT.dispose();
      draco.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
