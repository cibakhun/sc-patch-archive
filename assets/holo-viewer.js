// Echter 3D-Holo-Viewer für die Schiffs-Datenblätter.
// Lädt das Draco-komprimierte glTF von FleetYards (CORS: *) erst auf Klick
// und rendert es als Hologramm: Cyan-Material, Auto-Rotation, OrbitControls.
// three.js liegt selbst gehostet unter /vendor/three (Import-Map der Seite).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export async function initHolo(container, url, onProgress) {
  const W = () => container.clientWidth || 800;
  const H = () => container.clientHeight || 480;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.05, 500);
  camera.position.set(2.7, 1.15, 2.7);

  scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x0a1220, 1.1));
  const key = new THREE.DirectionalLight(0x7fe4ff, 2.2);
  key.position.set(3, 4, 2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x2dd4ff, 1.4);
  rim.position.set(-3, 1.5, -3);
  scene.add(rim);

  const draco = new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco);

  const gltf = await new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        else if (onProgress) onProgress(Math.min(99, Math.round(e.loaded / 250000)));
      },
      reject
    );
  });

  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x102b3a,
    emissive: 0x2dd4ff,
    emissiveIntensity: 0.28,
    metalness: 0.15,
    roughness: 0.5,
    transparent: true,
    opacity: 0.97,
  });
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh) {
      o.material = holoMat;
    }
  });

  // zentrieren + auf Einheitsgröße skalieren
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = 2.4 / maxDim;
  model.position.sub(center).multiplyScalar(s);
  model.scale.setScalar(s);
  scene.add(model);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 0.7;
  controls.enablePan = false;
  controls.minDistance = 1.4;
  controls.maxDistance = 7;

  let alive = true;
  const ro = new ResizeObserver(() => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
  });
  ro.observe(container);

  (function tick() {
    if (!alive) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();

  return {
    dispose() {
      alive = false;
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
