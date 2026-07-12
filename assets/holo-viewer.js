// Interaktiver 3D-Holo-Viewer v2 für die Schiffs-Datenblätter.
// Eingebettet in der Hangar-Bühne (kein Toggle-Popup mehr): lädt das
// Draco-glTF von FleetYards, rendert es als Hologramm (Cyan-Emissive,
// Scanlines, Projektions-Kegel, Materialisierungs-Sweep) und legt die
// Komponenten-Marker aus src/data/holo-markers.json darüber — Positionen
// stammen aus den Spieldateien (COMPILED_BONES), im Buildstep aufs Mesh
// kalibriert. Keine Auto-Rotation: OrbitControls, Hover + Klick auf Marker.
//
// API:  initHolo(container, cfg) -> Promise<{ dispose, setFilter, select }>
//   cfg = { url, ports:[{k,p:[x,y,z],g,dim}], mesh:{c,s}, ax:[len,lat],
//           onProgress(p), onSelect(i|null), debug, reduceMotion }
// three.js liegt selbst gehostet unter /vendor/three (Import-Map der Seite).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GROUP_COLOR = {
  core: 0x2dd4ff,
  prop: 0x6ea8ff,
  arms: 0xd4af37,
  other: 0xa78bfa,
};

// Marker-Textur: Ziel-Reticle (Eck-Klammern + Ring + Kern) statt generischem
// Glüh-Punkt — Cockpit-HUD-Look. hollow = gestrichelt für geschätzte Positionen.
function markerTexture(colorHex, hollow) {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const col = `#${colorHex.toString(16).padStart(6, '0')}`;
  const cx = S / 2, cy = S / 2;

  // weicher Glow-Untergrund
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, S / 2);
  glow.addColorStop(0, col + (hollow ? '30' : '55'));
  glow.addColorStop(0.5, col + '18');
  glow.addColorStop(1, col + '00');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);

  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Eck-Klammern eines Ziel-Quadrats
  const r = 40, arm = 15;
  g.lineWidth = 7;
  if (hollow) g.setLineDash([9, 8]);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * r, y = cy + sy * r;
    g.beginPath();
    g.moveTo(x - sx * arm, y);
    g.lineTo(x, y);
    g.lineTo(x, y - sy * arm);
    g.stroke();
  }
  g.setLineDash([]);

  // dünner Innenring
  g.lineWidth = 4;
  g.globalAlpha = 0.75;
  g.beginPath();
  g.arc(cx, cy, 20, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;

  // Kern
  if (hollow) {
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, 7, 0, Math.PI * 2);
    g.stroke();
  } else {
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, 11);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.5, col);
    core.addColorStop(1, col + '00');
    g.fillStyle = core;
    g.beginPath();
    g.arc(cx, cy, 11, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function initHolo(container, cfg) {
  const W = () => container.clientWidth || 800;
  const H = () => container.clientHeight || 480;
  const reduceMotion = cfg.reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.localClippingEnabled = true;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.05, 500);
  camera.position.set(2.55, 1.05, 2.55);

  scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x0a1220, 1.1));
  const key = new THREE.DirectionalLight(0x7fe4ff, 2.2);
  key.position.set(3, 4, 2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x2dd4ff, 1.4);
  rim.position.set(-3, 1.5, -3);
  scene.add(rim);

  const draco = new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      loader.load(
        cfg.url,
        resolve,
        (e) => {
          if (cfg.onProgress && e.total) cfg.onProgress(Math.round((e.loaded / e.total) * 100));
          else if (cfg.onProgress) cfg.onProgress(Math.min(99, Math.round(e.loaded / 250000)));
        },
        reject
      );
    });
  } catch (err) {
    // Fehlpfad sauber aufräumen — sonst stapelt jeder Retry einen toten
    // Canvas (der neue rendert geclippt darunter) und leakt WebGL-Kontexte
    renderer.dispose();
    renderer.domElement.remove();
    throw err;
  }

  // Materialisierungs-Sweep: Clipping-Ebene wandert von unten nach oben
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), reduceMotion ? 1e6 : -1.6);
  const uTime = { value: 0 };
  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x102b3a,
    emissive: 0x2dd4ff,
    emissiveIntensity: 0.3,
    metalness: 0.15,
    roughness: 0.5,
    transparent: true,
    opacity: 0.97,
    clippingPlanes: [clipPlane],
  });
  // Scanline-Schimmer (screen-space, dezent) — klassischer Holo-Look
  holoMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance *= 0.86 + 0.14 * (0.5 + 0.5 * sin(gl_FragCoord.y * 0.55 - uTime * 2.6));`
      );
  };

  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) o.material = holoMat; });

  // Gruppe: Modell + Marker teilen dieselbe Normalisierung (zentrieren,
  // auf Einheitsgröße skalieren) — Markerkoordinaten bleiben Mesh-Raum.
  const rig = new THREE.Group();
  rig.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = 2.4 / maxDim;
  rig.position.copy(center).multiplyScalar(-s);
  rig.scale.setScalar(s);
  scene.add(rig);

  /* ---------- Textur-Cache (Marker + Boden-Glow teilen sich Texturen) ---------- */
  const texCache = new Map();
  const texFor = (color, hollow) => {
    const k = `${color}:${hollow}`;
    if (!texCache.has(k)) texCache.set(k, markerTexture(color, hollow));
    return texCache.get(k);
  };

  /* ---------- Projektions-Kegel + Boden-Glow ---------- */
  const coneH = 1.15;
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(Math.max(size.x, size.z) * 0.5, maxDim * 0.06, coneH / s, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x2dd4ff, transparent: true, opacity: 0.045,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  cone.position.set(center.x, box.min.y - (coneH / s) * 0.5, center.z);
  rig.add(cone);
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texFor(0x2dd4ff, false), color: 0x2dd4ff, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  disc.scale.set(maxDim * 0.7, maxDim * 0.18, 1);
  disc.position.set(center.x, box.min.y - coneH / s, center.z);
  rig.add(disc);

  /* ---------- Komponenten-Marker ---------- */
  const markers = [];
  const baseScale = maxDim * 0.034;
  for (const [i, port] of (cfg.ports ?? []).entries()) {
    const color = GROUP_COLOR[port.g] ?? 0x2dd4ff;
    const mat = new THREE.SpriteMaterial({
      map: texFor(color, !!port.dim),
      color,
      transparent: true,
      opacity: port.dim ? 0.7 : 0.92,
      depthTest: false, // Holo-Stil: Marker scheinen durch den Rumpf
      blending: THREE.AdditiveBlending,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.set(port.p[0], port.p[1], port.p[2]);
    sp.scale.setScalar(baseScale * (port.g === 'core' ? 1.15 : 1));
    sp.renderOrder = 20;
    sp.userData = { i, port, base: baseScale * (port.g === 'core' ? 1.15 : 1) };
    rig.add(sp);
    markers.push(sp);
  }

  // Startsichtbarkeit je Gruppe (Standard: nur core+arms; Rest per Filter zu)
  if (cfg.defaultOn && cfg.defaultOn.length) {
    const vis = new Set(cfg.defaultOn);
    for (const sp of markers) sp.visible = vis.has(sp.userData.port.g);
  }

  /* ---------- Dauerhafte Beschriftungen (Marker mit port.lab) ---------- */
  // DOM-Labels, jeden Frame aus 3D auf den Bildschirm projiziert — mit
  // Leader-Line zum Marker (wie im Mockup). Nur Kern-Komponenten tragen ein lab.
  const labelLayer = document.createElement('div');
  labelLayer.className = 'holo-lbllayer';
  container.appendChild(labelLayer);
  const labels = [];
  for (const sp of markers) {
    if (!sp.userData.port.lab) continue;
    const el = document.createElement('div');
    el.className = 'holo-lbl';
    el.textContent = sp.userData.port.lab;
    labelLayer.appendChild(el);
    labels.push({ sp, el, shown: true });
  }
  const _lblV = new THREE.Vector3();
  let labelsOn = true;

  /* ---------- Debug: Achsen, BBox, Yaw-Flip (Taste F) ---------- */
  if (cfg.debug) {
    const axes = new THREE.AxesHelper(maxDim * 0.7);
    rig.add(axes);
    if (cfg.mesh) {
      const bb = new THREE.Box3(
        new THREE.Vector3(...cfg.mesh.c.map((c2, k) => c2 - cfg.mesh.s[k] / 2)),
        new THREE.Vector3(...cfg.mesh.c.map((c2, k) => c2 + cfg.mesh.s[k] / 2))
      );
      const helper = new THREE.Box3Helper(bb, 0xff4488);
      rig.add(helper);
    }
    let flippedState = false;
    addEventListener('keydown', (ev) => {
      if (ev.key !== 'f' || !cfg.ax || !cfg.mesh) return;
      flippedState = !flippedState;
      console.log('[holo-debug] yaw-flip:', flippedState);
      for (const sp of markers) {
        const p = [...sp.userData.port.p];
        if (flippedState) for (const k of cfg.ax) p[k] = 2 * cfg.mesh.c[k] - p[k];
        sp.position.set(p[0], p[1], p[2]);
      }
    });
    console.log('[holo-debug] model bbox size', size.toArray(), 'center', center.toArray(),
      'markers', markers.length, '— Taste F: Marker-Yaw-Flip (rot=X grün=Y blau=Z)');
  }

  /* ---------- Controls: keine Auto-Rotation, Rechtsklick-Ziehen = verschieben ---------- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = false;
  controls.enablePan = true;              // Rechtsklick/Zwei-Finger: Modell verschieben
  controls.screenSpacePanning = true;     // in Bildschirmebene schieben (intuitiver)
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  // Kontextmenü auf dem Canvas unterdrücken, damit Rechtsklick-Ziehen läuft
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // Kamera so setzen, dass das GANZE Modell ins Bild passt — auch sehr große
  // oder sehr breite Schiffe (Bounding-Sphere gegen vertikales UND horizontales
  // Sichtfeld gefittet), inkl. Neuanpassung bei Größenänderung.
  const fitSphere = new THREE.Box3().setFromObject(rig).getBoundingSphere(new THREE.Sphere());
  function fitCamera(margin = 1.18) {
    const r = fitSphere.radius * margin;
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const dist = r / Math.sin(Math.min(vFov, hFov) / 2);
    let dir = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.7, 0.32, 0.7);
    dir.normalize();
    controls.target.copy(fitSphere.center);
    camera.position.copy(fitSphere.center).addScaledVector(dir, dist);
    camera.near = Math.max(0.01, dist - r * 2.2);
    camera.far = dist + r * 2.5;
    camera.updateProjectionMatrix();
    controls.minDistance = r * 0.5;
    controls.maxDistance = dist * 2.2;
    controls.update();
  }
  fitCamera();

  /* ---------- Hover / Klick ---------- */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let hoverIdx = null;
  let selectIdx = null;

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(markers.filter((m) => m.visible), false);
    return hits.length ? hits[0].object.userData.i : null;
  }
  let downAt = null;
  renderer.domElement.addEventListener('pointermove', (ev) => {
    if (ev.buttons) return; // während des Orbit-Drags kein Hover-Raycast
    const i = pick(ev);
    if (i !== hoverIdx) {
      hoverIdx = i;
      renderer.domElement.style.cursor = i != null ? 'pointer' : 'grab';
    }
  });
  renderer.domElement.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    // Klick nur, wenn kein Drag (OrbitControls) dazwischen lag
    if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 6) return;
    const i = pick(ev);
    selectIdx = i;
    cfg.onSelect?.(i);
  });

  /* ---------- Render-Loop ---------- */
  // Pausiert, wenn die Bühne aus dem Viewport gescrollt ist (Akku/GPU) —
  // rAF drosselt nur bei verstecktem Tab, nicht bei unsichtbarem Element.
  let alive = true;
  let inView = true;
  const vio = new IntersectionObserver((es) => {
    inView = es.some((e) => e.isIntersecting);
  }, { threshold: 0.02 });
  vio.observe(container);
  const clock = new THREE.Clock();
  let matDone = reduceMotion;
  let nextFlicker = 2.5;
  (function tick() {
    if (!alive) return;
    if (!inView) { requestAnimationFrame(tick); return; }
    clock.getDelta();
    const t = clock.elapsedTime;
    // reduced motion: statisches Hologramm — kein laufender Schimmer
    if (!reduceMotion) uTime.value = t;
    // Materialisierung: Ebene von unten nach oben (1.2 s)
    if (!matDone) {
      clipPlane.constant = Math.min(1.6, -1.6 + t * 2.7);
      if (clipPlane.constant >= 1.6) matDone = true;
    }
    // gelegentliches Holo-Flackern
    if (!reduceMotion && t > nextFlicker) {
      holoMat.emissiveIntensity = 0.18 + Math.random() * 0.2;
      if (t > nextFlicker + 0.08) {
        holoMat.emissiveIntensity = 0.3;
        nextFlicker = t + 2.5 + Math.random() * 4;
      }
    }
    // Marker: Hover/Select-Puls
    for (const sp of markers) {
      const { i, base } = sp.userData;
      let sc = base;
      if (i === selectIdx) sc = base * (1.25 + (reduceMotion ? 0 : Math.sin(t * 5) * 0.09));
      else if (i === hoverIdx) sc = base * 1.35;
      sp.scale.setScalar(sc);
    }
    controls.update();
    renderer.render(scene, camera);
    // Labels aus 3D auf den Bildschirm projizieren (nach dem Render, damit die
    // Kamera aktuell ist) — nur für sichtbare, vor der Kamera liegende Marker
    if (labelsOn && labels.length) {
      const w = W(), h = H();
      for (const L of labels) {
        if (!L.sp.visible) { if (L.shown) { L.el.style.display = 'none'; L.shown = false; } continue; }
        L.sp.getWorldPosition(_lblV).project(camera);
        if (_lblV.z > 1) { if (L.shown) { L.el.style.display = 'none'; L.shown = false; } continue; }
        if (!L.shown) { L.el.style.display = ''; L.shown = true; }
        L.el.style.left = ((_lblV.x * 0.5 + 0.5) * w).toFixed(1) + 'px';
        L.el.style.top = ((-_lblV.y * 0.5 + 0.5) * h).toFixed(1) + 'px';
      }
    }
    requestAnimationFrame(tick);
  })();

  // sobald der Nutzer selbst dreht/schiebt, seine Ansicht nicht mehr überschreiben
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  const ro = new ResizeObserver(() => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
    // Bis zur ersten Interaktion bei jedem Layout neu einpassen (auch spätes
    // Layout), damit das ganze Modell garantiert im Bild ist — danach nicht mehr.
    if (!userMoved && W() > 0 && H() > 0) fitCamera();
  });
  ro.observe(container);

  return {
    setFilter(groups) {
      const vis = new Set(groups);
      for (const sp of markers) sp.visible = vis.has(sp.userData.port.g);
      // Labels sofort mit-schalten (nicht auf den nächsten Frame warten —
      // der Render-Loop kann pausiert sein, wenn die Bühne aus dem Bild ist)
      for (const L of labels) {
        if (!L.sp.visible) { L.el.style.display = 'none'; L.shown = false; }
      }
      if (selectIdx != null && !vis.has(cfg.ports[selectIdx].g)) {
        selectIdx = null;
        cfg.onSelect?.(null);
      }
    },
    select(i) {
      selectIdx = i;
    },
    setLabels(on) {
      labelsOn = on;
      labelLayer.style.display = on ? '' : 'none';
    },
    dispose() {
      alive = false;
      ro.disconnect();
      vio.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}
