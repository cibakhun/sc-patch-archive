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
  const uYmin = { value: -1 }, uYmax = { value: 1 };   // Welt-Höhenspanne (für Scan-Sweep)
  const uScale = { value: renderer.domElement.height * 0.5 };   // Punktgröße-Skala (Funken)
  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x0c2838,
    emissive: 0x2dd4ff,
    emissiveIntensity: 0.34,
    metalness: 0.1,
    roughness: 0.65,
    transparent: true,
    opacity: 1.0,
    clippingPlanes: [clipPlane],
  });
  // Echter Holo-Look direkt im Material:
  //  · Fresnel-Rand — Hologramme leuchten an den Kanten am hellsten
  //  · weltfeste Scanbänder + feine Interlace-Linien (Star-Wars-Projektion)
  //  · heller Scan-Sweep, der langsam nach oben durchs Modell wandert
  //  · Flackern + zur Fläche hin leicht durchscheinend (geisterhaft)
  holoMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uYmin = uYmin;
    sh.uniforms.uYmax = uYmax;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoloW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vHoloW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uYmin;\nuniform float uYmax;\nvarying vec3 vHoloW;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float holoFres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.6);
        float holoScan = 0.5 + 0.5 * sin(vHoloW.y * 130.0 - uTime * 3.2);
        float holoFine = 0.5 + 0.5 * sin(vHoloW.y * 430.0 + uTime * 1.1);
        float holoSpan = max(0.001, uYmax - uYmin);
        float sweepY = uYmin + holoSpan * fract(uTime * 0.11);
        float holoSweep = smoothstep(holoSpan * 0.04, 0.0, abs(vHoloW.y - sweepY));
        float holoFlick = 0.94 + 0.06 * sin(uTime * 41.0) * sin(uTime * 12.7);
        totalEmissiveRadiance *= (0.58 + 0.26 * holoScan + 0.1 * holoFine) * holoFlick;
        totalEmissiveRadiance += vec3(0.45, 0.95, 1.0) * holoFres * 0.6;
        totalEmissiveRadiance += vec3(0.7, 0.98, 1.0) * holoSweep * 0.65;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float holoEdge = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 1.6);
        gl_FragColor.a *= clamp(0.82 + 0.18 * holoEdge, 0.0, 1.0);`);
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
  // Welt-Höhenspanne (Modell ist um den Ursprung zentriert) -> Scan-Sweep-Grenzen
  uYmin.value = -(size.y * s) / 2;
  uYmax.value = (size.y * s) / 2;

  /* ---------- Textur-Cache (Marker + Boden-Glow teilen sich Texturen) ---------- */
  const texCache = new Map();
  const texFor = (color, hollow) => {
    const k = `${color}:${hollow}`;
    if (!texCache.has(k)) texCache.set(k, markerTexture(color, hollow));
    return texCache.get(k);
  };

  /* ---------- Projektor: Aura · Kegel · Emitter-Pad · Ringe · Staub ---------- */
  // Weiche Radial-Textur für Glows/Partikel (weißer Kern -> transparent).
  const softTex = (() => {
    const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(160,235,255,0.65)');
    gr.addColorStop(1, 'rgba(90,210,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const baseY = box.min.y;                 // Fuß des Modells (Projektor-Ursprung)
  const coneH = 1.15;
  const emitY = baseY - coneH / s;         // Emitter-Ebene unter dem Modell

  // Ambiente Aura hinter dem Modell — ersetzt fehlendes Bloom durch additive Halo
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softTex, color: 0x2dd4ff, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  aura.scale.setScalar(maxDim * 1.35);
  aura.position.copy(center);
  aura.renderOrder = -2;
  rig.add(aura);

  // Projektions-Lichtschacht: vom Emitter (unten, schmal) zum Modell (oben, weit)
  // fächernde Strahlen — wie R2-D2s Projektor, aber mit Unterwasser-Kaustik:
  // gekreuzte wandernde Wellen lassen die Strahlen flirren wie Sonnenlicht,
  // das durchs Wasser fällt. vUv.y = 0 am Emitter, 1 am Modell.
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){
        float h = vUv.y, a = vUv.x;
        // vom Emitter (unten) hell, nach oben ausdünnend; unten weich einblenden
        float vfade = smoothstep(0.0, 0.05, h) * smoothstep(1.0, 0.12, h);
        // fächernde Strahlen (radiale Schäfte), langsam wandernd
        float rays = 0.5 + 0.5 * sin(a * 6.2831 * 20.0 + sin(uTime * 0.25 + h * 2.5) * 1.6);
        rays = pow(rays, 4.0);
        // Unterwasser-Kaustik: zwei gekreuzte, wandernde Wellenlagen -> flirrendes Netz
        float c1 = sin(a * 74.0 + uTime * 1.15 + h * 6.0);
        float c2 = sin(a * 41.0 - uTime * 0.85 + h * 11.0);
        float caustic = pow(clamp(0.5 + 0.5 * c1 * c2, 0.0, 1.0), 1.7);
        // Holo-Flackern direkt im Strahl: schnelles Zittern + hochlaufende Scan-Bänder
        // (flach gehalten, damit der Strahl PROMINENT bleibt und nicht wegdimmt)
        float flick = 0.87 + 0.13 * sin(uTime * 34.0) * sin(uTime * 9.3);
        float bands = 0.8 + 0.2 * sin(h * 60.0 - uTime * 7.5);
        float intensity = vfade * (0.45 + 0.75 * rays) * (0.55 + 0.7 * caustic) * flick * bands;
        vec3 col = mix(vec3(0.3, 0.84, 1.0), vec3(0.72, 1.0, 1.0), caustic);
        gl_FragColor = vec4(col * intensity, intensity * 0.92);
      }`,
  });
  const cone = new THREE.Mesh(
    // schmaler Deckel -> die Strahlen bündeln sich zur Mitte (statt breit zu fächern)
    new THREE.CylinderGeometry(Math.max(size.x, size.z) * 0.23, maxDim * 0.025, coneH / s, 72, 1, true),
    beamMat
  );
  cone.position.set(center.x, baseY - (coneH / s) * 0.5, center.z);
  rig.add(cone);

  // Gefüllter Kern-Strahl: die Trichter-Wände allein wirken hohl -> ein zur
  // Kamera gerichteter Lichtschacht füllt die Mitte (unten schmal + hell am
  // Emitter, nach oben weit + weicher). Textur = gefüllter Kegel mit Verlauf.
  const beamTex = (() => {
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) {
      const ft = y / (S - 1);                 // 0 oben (Modell) .. 1 unten (Emitter)
      const halfW = 0.05 + (1 - ft) * 0.45;   // oben weit, unten schmal
      // unten heller; oben WEICH ausblenden -> kein harter Schnitt unterm Schiff
      const topFade = Math.max(0, Math.min(1, ft / 0.3));
      const vB = (0.35 + 0.65 * ft) * topFade * topFade * (3 - 2 * topFade);
      for (let x = 0; x < S; x++) {
        const fx = (x / (S - 1) - 0.5) / halfW;
        let a = Math.max(0, 1 - Math.abs(fx)); a = a * a * vB;
        const i = (y * S + x) * 4;
        d[i] = 190; d[i + 1] = 244; d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255) | 0;
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const coreBeam = new THREE.Sprite(new THREE.SpriteMaterial({
    map: beamTex, color: 0x9fe9ff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  coreBeam.scale.set(Math.max(size.x, size.z) * 0.5, coneH / s, 1);
  coreBeam.position.set(center.x, (baseY + emitY) / 2, center.z);
  rig.add(coreBeam);

  // Emitter-Pad: heller Kern am Projektor-Ursprung
  const pad = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softTex, color: 0xc4f4ff, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pad.scale.set(maxDim * 0.5, maxDim * 0.17, 1);
  pad.position.set(center.x, emitY, center.z);
  rig.add(pad);

  // Pulsierende Ringe auf der Emitter-Ebene (Projektor „arbeitet")
  const ringGeo = new THREE.RingGeometry(0.9, 1.0, 60);
  const ringMax = Math.max(size.x, size.z) * 0.62;
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0x2dd4ff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(center.x, emitY + 0.002 * (i + 1) / s, center.z);
    m.userData.phase = i / 3;
    m.visible = false; // erst durch die Animation (kein Bewegungs-Effekt bei reduceMotion)
    rig.add(m); rings.push(m);
  }

  // Holo-Funken NUR im Strahl-Kegel: steigen vom Emitter im schmalen Strahl auf
  // (kein separates Flimmern rund um den Rumpf). Radius wächst mit der Höhe wie
  // der Kegel, jeder Funke funkelt mit eigener Phase.
  const DUST_N = reduceMotion ? 0 : 95;
  let dust = null;
  if (DUST_N) {
    const pg = new THREE.BufferGeometry();
    const pos = new Float32Array(DUST_N * 3), spd = new Float32Array(DUST_N);
    const aPh = new Float32Array(DUST_N), aSz = new Float32Array(DUST_N);
    const aAng = new Float32Array(DUST_N), aRad = new Float32Array(DUST_N);
    const beamR = Math.max(size.x, size.z) * 0.2;          // Strahl-Radius oben (am Rumpf)
    const bot = emitY, top = baseY + size.y * 0.06;        // Emitter -> knapp in den Rumpf
    for (let i = 0; i < DUST_N; i++) {
      const y = bot + Math.random() * (top - bot);
      aAng[i] = Math.random() * Math.PI * 2;
      aRad[i] = Math.sqrt(Math.random()) * beamR;          // max. Radius am Deckel
      const f = (y - bot) / (top - bot), rr = aRad[i] * (0.06 + f);   // Kegel: unten schmal
      pos[i * 3] = center.x + Math.cos(aAng[i]) * rr;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = center.z + Math.sin(aAng[i]) * rr;
      spd[i] = (0.05 + Math.random() * 0.16) * size.y;
      aPh[i] = Math.random() * 6.2831;
      aSz[i] = 0.5 + Math.random() * 1.3;
    }
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('aPh', new THREE.BufferAttribute(aPh, 1));
    pg.setAttribute('aSz', new THREE.BufferAttribute(aSz, 1));
    dust = new THREE.Points(pg, new THREE.ShaderMaterial({
      uniforms: { uTime, uScale, uTex: { value: softTex }, uSize: { value: maxDim * s * 0.016 }, uBot: { value: bot }, uTop: { value: top } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime; uniform float uScale; uniform float uSize; uniform float uBot; uniform float uTop;
        attribute float aPh; attribute float aSz; varying float vTw; varying float vFade;
        void main(){
          vTw = 0.5 + 0.5 * sin(uTime * 3.1 + aPh);
          float f = (position.y - uBot) / (uTop - uBot);
          vFade = smoothstep(0.0, 0.14, f) * smoothstep(1.0, 0.75, f);  // an beiden Enden weich aus
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * aSz * (0.35 + vTw) * (uScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D uTex; varying float vTw; varying float vFade;
        void main(){
          float a = texture2D(uTex, gl_PointCoord).a;
          gl_FragColor = vec4(vec3(0.72, 0.94, 1.0), a * (0.16 + 0.5 * vTw) * vFade);
        }`,
    }));
    dust.userData = { spd, top, bot, cx: center.x, cz: center.z, aAng, aRad };
    rig.add(dust);
  }

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
    // Kern-Komponenten größer als die vielen Waffen-Marker -> klare Hierarchie,
    // Cluster wirken ruhiger, die wichtigen Ports fallen auf.
    const scl = baseScale * (port.g === 'core' ? 1.3 : port.g === 'arms' ? 0.92 : 1);
    sp.scale.setScalar(scl);
    sp.renderOrder = port.g === 'core' ? 22 : 20;
    sp.userData = { i, port, base: scl };
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
  // Drei Ebenen, bewusst gestapelt:
  //  1. leaderSvg  — Leader-Linien, UNTER den Chips (Linie verschwindet sauber
  //     unter dem Kasten)
  //  2. Text-Chips — dazwischen
  //  3. nodeSvg    — Positions-Knoten, ÜBER allem: der Punkt, der das Bauteil
  //     markiert, wird NIE von einem Chip verdeckt.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const leaderSvg = document.createElementNS(SVGNS, 'svg');
  leaderSvg.setAttribute('class', 'holo-leaders');
  const nodeSvg = document.createElementNS(SVGNS, 'svg');
  nodeSvg.setAttribute('class', 'holo-nodes');
  labelLayer.appendChild(leaderSvg);
  container.appendChild(labelLayer);
  const labels = [];
  for (const sp of markers) {
    if (!sp.userData.port.lab) continue;
    const el = document.createElement('div');
    el.className = 'holo-lbl';
    el.textContent = sp.userData.port.lab;
    labelLayer.appendChild(el);
    const line = document.createElementNS(SVGNS, 'line');
    const node = document.createElementNS(SVGNS, 'circle');
    node.setAttribute('r', '3');
    leaderSvg.appendChild(line);
    nodeSvg.appendChild(node);
    // mx/my: projizierte Marker-Position · ax/ay: Ankerpunkt (mittig über Marker)
    // cx/cy: geglättete Kastenmitte (bleibt über Frames erhalten -> kein Springen)
    // occ: Bauteil auf der abgewandten Modellhälfte -> Beschriftung ausgeblendet
    labels.push({ sp, el, line, node, shown: true, init: false, occ: false, w: 0, h: 0, mx: 0, my: 0, ax: 0, ay: 0, cx: 0, cy: 0 });
  }
  labelLayer.appendChild(nodeSvg); // zuletzt -> Knoten liegen über den Chips
  const _lblV = new THREE.Vector3();
  const _lblW = new THREE.Vector3();   // Marker-Weltposition
  const _lblViz = new THREE.Vector3(); // Marker im Kameraraum (Tiefentest)
  const _cenViz = new THREE.Vector3(); // Modellmitte im Kameraraum
  let labelsOn = true;
  let leadW = 0, leadH = 0;

  // Beschriftungen aus 3D projizieren und entzerren. Kernidee gegen Zappeln:
  // die Kastenmitte (cx,cy) bleibt über Frames ERHALTEN und wird nur sanft zum
  // Ankerpunkt (mittig über dem Marker) gezogen — kein Neu-Lösen pro Frame. X
  // bleibt am Marker (nur vertikal entzerrt), damit jede Beschriftung genau über
  // ihrem Bauteil steht und die Leader-Linie kurz und eindeutig bleibt.
  const LBL_LEAD = 22;   // Standabstand Kasten über Marker (px)
  const LBL_GAP = 5;     // Mindestabstand zwischen Kästen (px)
  const LBL_EASE = 0.2;  // Nachziehen zum Anker (kleiner = ruhiger, träger)
  function hideLabel(L) {
    if (!L.shown) return;
    L.el.style.display = 'none'; L.line.style.display = 'none'; L.node.style.display = 'none';
    L.shown = false; L.init = false; // beim Wiedereinblenden direkt am Anker starten
  }
  function layoutLabels() {
    const w = W(), h = H();
    if (w !== leadW || h !== leadH) { const vb = `0 0 ${w} ${h}`; leaderSvg.setAttribute('viewBox', vb); nodeSvg.setAttribute('viewBox', vb); leadW = w; leadH = h; }
    // Modellmitte in den Kameraraum -> Tiefen-Referenz. Kamera blickt entlang -Z,
    // "hinten" (abgewandte Hälfte) = deutlich weiter weg als die Mitte.
    _cenViz.copy(fitSphere.center).applyMatrix4(camera.matrixWorldInverse);
    const cz = _cenViz.z, span = fitSphere.radius;
    const vis = [];
    for (const L of labels) {
      if (!L.sp.visible) { hideLabel(L); continue; }
      L.sp.getWorldPosition(_lblW);
      _lblViz.copy(_lblW).applyMatrix4(camera.matrixWorldInverse);
      // Rückseiten-Cull mit Hysterese (kein Flackern nahe der Mittelebene):
      // ausblenden, wenn klar hinter der Mitte; erst wieder zeigen, wenn klar davor.
      if (L.occ) { if (_lblViz.z > cz + span * 0.04) L.occ = false; }
      else { if (_lblViz.z < cz - span * 0.04) L.occ = true; }
      if (L.occ) { hideLabel(L); continue; }
      _lblV.copy(_lblW).project(camera);
      if (_lblV.z > 1) { hideLabel(L); continue; }
      if (!L.shown) { L.el.style.display = ''; L.line.style.display = ''; L.node.style.display = ''; L.shown = true; }
      if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
      L.mx = (_lblV.x * 0.5 + 0.5) * w;
      L.my = (-_lblV.y * 0.5 + 0.5) * h;
      L.ax = L.mx;                       // Anker: horizontal am Marker …
      L.ay = L.my - LBL_LEAD - L.h / 2;  // … vertikal knapp darüber
      if (!L.init) { L.cx = L.ax; L.cy = L.ay; L.init = true; }
      else { L.cx += (L.ax - L.cx) * LBL_EASE; L.cy += (L.ay - L.cy) * LBL_EASE; }
      vis.push(L);
    }
    // Jeden Frame auflösen — zwei Ziele, Chip-Überlappung hat Vorrang:
    //  (1) Chips sanft von fremden Positions-Knoten wegschieben, damit die
    //      Punkte frei bleiben (nur vertikal, X bleibt am Marker).
    //  (2) Chip-Überlappungen voll auflösen (nie sichtbar überlappt).
    // Ruhe kommt aus den erhaltenen, sanft nachgezogenen Positionen; die
    // Push-Richtung ist an die Reihenfolge gebunden (kein Auf/Ab-Flackern).
    for (let pass = 0; pass < 20; pass++) {
      let moved = false;
      for (let a = 0; a < vis.length; a++) {
        const L = vis[a];
        for (let b = 0; b < vis.length; b++) {
          if (b === a) continue;
          const padX = L.w / 2 + 4, padY = L.h / 2 + 4;
          const ndx = vis[b].mx - L.cx, ndy = vis[b].my - L.cy;
          if (Math.abs(ndx) < padX && Math.abs(ndy) < padY) {
            // Auf kürzestem Weg vom Knoten weg (Knoten unter der Mitte -> Chip hoch,
            // sonst runter). Voll auflösen, damit die Punkte frei bleiben.
            const push = padY - Math.abs(ndy) + 0.5;
            L.cy += ndy >= 0 ? -push : push;
            moved = true;
          }
        }
      }
      for (let a = 0; a < vis.length; a++) for (let b = a + 1; b < vis.length; b++) {
        const A = vis[a], B = vis[b];
        const dy = A.cy - B.cy;
        const ox = (A.w + B.w) / 2 + LBL_GAP - Math.abs(A.cx - B.cx);
        const oy = (A.h + B.h) / 2 + LBL_GAP - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          const push = oy / 2 + 0.5;
          const up = dy < 0 || (dy === 0 && a < b); // A oberhalb -> A hoch, B runter
          if (up) { A.cy -= push; B.cy += push; } else { A.cy += push; B.cy -= push; }
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const L of vis) {
      L.cx = Math.max(L.w / 2 + 2, Math.min(w - L.w / 2 - 2, L.cx));
      L.cy = Math.max(L.h / 2 + 2, Math.min(h - L.h / 2 - 2, L.cy));
      L.el.style.left = L.cx.toFixed(1) + 'px';
      L.el.style.top = L.cy.toFixed(1) + 'px';
      // Leader vom Marker bis zum Kastenrand (Segment an der Box abgeschnitten)
      const dx = L.mx - L.cx, dy = L.my - L.cy;
      const t = Math.min(1, Math.min(dx ? (L.w / 2) / Math.abs(dx) : Infinity, dy ? (L.h / 2) / Math.abs(dy) : Infinity));
      const ex = L.cx + dx * t, ey = L.cy + dy * t;
      L.line.setAttribute('x1', ex.toFixed(1)); L.line.setAttribute('y1', ey.toFixed(1));
      L.line.setAttribute('x2', L.mx.toFixed(1)); L.line.setAttribute('y2', L.my.toFixed(1));
      L.node.setAttribute('cx', L.mx.toFixed(1)); L.node.setAttribute('cy', L.my.toFixed(1));
      // Zuordnung betonen: Beschriftung des gehoverten/gewählten Markers leuchtet
      const active = (L.sp.userData.i === hoverIdx || L.sp.userData.i === selectIdx);
      L.el.classList.toggle('is-active', active);
      L.line.classList.toggle('is-active', active);
      L.node.classList.toggle('is-active', active);
      L.node.setAttribute('r', active ? '4.8' : '3.4');
    }
  }

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

  /* ---------- Hover / Klick ----------
     Bildschirm-Distanz statt Ray: geklumpte Marker bleiben einzeln erreichbar
     (großzügiger Trefferradius), und wiederholtes Klicken auf denselben Klumpen
     schaltet der Reihe nach durch alle darunterliegenden Marker. */
  const HIT_R = 22;               // Trefferradius in px (großzügig, leicht zu treffen)
  const _pp = new THREE.Vector3();
  let hoverIdx = null;
  let selectIdx = null;
  let cycleKey = '', cycleAt = 0;

  function candidatesAt(px, py) {
    const rect = renderer.domElement.getBoundingClientRect();
    const out = [];
    for (const m of markers) {
      if (!m.visible) continue;
      m.getWorldPosition(_pp).project(camera);
      if (_pp.z > 1) continue; // hinter der Kamera
      const sx = (_pp.x * 0.5 + 0.5) * rect.width;
      const sy = (-_pp.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d <= HIT_R) out.push({ i: m.userData.i, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  }
  function relXY(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    return [ev.clientX - rect.left, ev.clientY - rect.top];
  }
  // Text-Chip unter dem Zeiger? (Chips sind pointer-events:none -> das Event
  // erreicht den Canvas; wir treffen sie über ihr Rechteck. So bleibt Ziehen
  // zum Drehen auch ÜBER einem Chip möglich, und der Chip ist trotzdem klickbar.)
  function labelAt(clientX, clientY) {
    for (const L of labels) {
      if (!L.shown) continue;
      const r = L.el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return L.sp.userData.i;
    }
    return null;
  }
  let downAt = null;
  renderer.domElement.addEventListener('pointermove', (ev) => {
    if (ev.buttons) return; // während des Orbit-Drags kein Hover-Pick
    let i = labelAt(ev.clientX, ev.clientY);      // Chip hat Vorrang (großes Ziel)
    if (i == null) { const c = candidatesAt(...relXY(ev)); i = c.length ? c[0].i : null; }
    if (i !== hoverIdx) {
      hoverIdx = i;
      renderer.domElement.style.cursor = i != null ? 'pointer' : 'grab';
    }
  });
  renderer.domElement.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    // Klick nur, wenn kein Drag (OrbitControls) dazwischen lag
    if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 6) return;
    // Chip angeklickt -> genau diese Komponente wählen (kein Durchschalten)
    const li = labelAt(ev.clientX, ev.clientY);
    if (li != null) { selectIdx = li; cycleKey = ''; cfg.onSelect?.(li); return; }
    const c = candidatesAt(...relXY(ev));
    if (!c.length) { selectIdx = null; cycleKey = ''; cfg.onSelect?.(null); return; }
    // Klumpen-ID aus den enthaltenen Markern (stabil sortiert) -> gleicher
    // Klumpen + erneuter Klick = nächster Marker; anderer Klumpen = Neustart.
    const key = c.map((x) => x.i).slice().sort((a, b) => a - b).join(',');
    if (key === cycleKey) cycleAt = (cycleAt + 1) % c.length;
    else { cycleKey = key; cycleAt = 0; }
    selectIdx = c[cycleAt].i;
    cfg.onSelect?.(selectIdx);
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
    const dt = clock.getDelta();
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
      holoMat.emissiveIntensity = 0.22 + Math.random() * 0.18;
      if (t > nextFlicker + 0.08) {
        holoMat.emissiveIntensity = 0.34;
        nextFlicker = t + 2.5 + Math.random() * 4;
      }
    }
    // Projektor lebt: pulsierende Ringe, aufsteigender Staub, atmende Aura
    if (!reduceMotion) {
      for (const m of rings) {
        const ph = (t * 0.32 + m.userData.phase) % 1;
        const sc = ringMax * (0.12 + ph);
        m.scale.set(sc, sc, sc);
        m.material.opacity = 0.5 * (1 - ph) * (1 - ph);
        m.visible = true;
      }
      if (dust) {
        const g = dust.geometry.attributes.position, arr = g.array, ud = dust.userData, sp = ud.spd;
        const span = ud.top - ud.bot;
        for (let i = 0; i < sp.length; i++) {
          let y = arr[i * 3 + 1] + sp[i] * dt;
          if (y > ud.top) y = ud.bot + (y - ud.top);
          // Radius folgt dem Kegel (unten schmal, oben weit) -> Funken bleiben im Strahl
          const rr = ud.aRad[i] * (0.06 + (y - ud.bot) / span);
          arr[i * 3] = ud.cx + Math.cos(ud.aAng[i]) * rr;
          arr[i * 3 + 1] = y;
          arr[i * 3 + 2] = ud.cz + Math.sin(ud.aAng[i]) * rr;
        }
        g.needsUpdate = true;
      }
      aura.material.opacity = 0.08 + 0.035 * Math.sin(t * 1.7);
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
    // Kamera aktuell ist), entzerren und mit Leader-Linien verbinden.
    if (labelsOn && labels.length) layoutLabels();
    requestAnimationFrame(tick);
  })();

  // sobald der Nutzer selbst dreht/schiebt, seine Ansicht nicht mehr überschreiben
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  const ro = new ResizeObserver(() => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
    uScale.value = renderer.domElement.height * 0.5;   // Funken-Größe an neue Auflösung koppeln
    // Bis zur ersten Interaktion bei jedem Layout neu einpassen (auch spätes
    // Layout), damit das ganze Modell garantiert im Bild ist — danach nicht mehr.
    if (!userMoved && W() > 0 && H() > 0) fitCamera();
  });
  ro.observe(container);

  return {
    setFilter(groups) {
      const vis = new Set(groups);
      for (const sp of markers) sp.visible = vis.has(sp.userData.port.g);
      // Labels + Leader sofort mit-schalten (nicht auf den nächsten Frame
      // warten — der Render-Loop kann pausiert sein, wenn die Bühne aus dem Bild ist)
      for (const L of labels) { if (!L.sp.visible) hideLabel(L); }
      cycleKey = '';
      if (selectIdx != null && !vis.has(cfg.ports[selectIdx].g)) {
        selectIdx = null;
        cfg.onSelect?.(null);
      }
    },
    select(i) {
      selectIdx = i;
      if (i == null) cycleKey = '';
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
