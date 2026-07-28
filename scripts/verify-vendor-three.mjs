// Haelt das vendorte three.js an der Version fest, die package.json meint.
//
// Ausgangslage: public/vendor/three/ ist eine HANDKOPIE (Bundle + fuenf Addons
// + Draco-Decoder, ~1,7 MB) und wird per Import-Map vom Schiffs-Datenblatt
// geladen. three steht gleichzeitig als devDependency in package.json — aber
// nichts verband beides. Ein `npm update three` haette die Kopie stillschweigend
// veralten lassen, und umgekehrt haette niemand gemerkt, wenn die Kopie von
// einer ganz anderen Version stammt als die Addons daneben.
//
// Die Version steht im minifizierten Bundle: three exportiert sie als
// `<lokalerName> as REVISION`. Ueber den Alias findet man die Zuweisung
// (`Xr="185"`) — kein Stempel neben der Datei, der selbst wieder veralten
// koennte, sondern die Angabe aus dem Bundle selbst.
//
// npm-Version 0.185.1 <-> REVISION "185": three zaehlt die Minor-Stelle als
// Revision, die Patch-Stelle laeuft ohne Revisionswechsel.
import { readFileSync, existsSync } from 'node:fs';

const CORE = 'public/vendor/three/three.core.min.js';
const REQUIRED_FILES = [
  'public/vendor/three/three.module.min.js',
  'public/vendor/three/three.core.min.js',
  'public/vendor/three/addons/controls/OrbitControls.js',
  'public/vendor/three/addons/loaders/GLTFLoader.js',
  'public/vendor/three/addons/loaders/DRACOLoader.js',
  'public/vendor/three/addons/utils/BufferGeometryUtils.js',
  'public/vendor/three/addons/utils/SkeletonUtils.js',
];

const problems = [];

for (const f of REQUIRED_FILES) {
  if (!existsSync(f)) problems.push(`fehlt: ${f}`);
}

/** REVISION aus dem minifizierten Bundle lesen (ueber den Export-Alias). */
function vendoredRevision() {
  const code = readFileSync(CORE, 'utf8');
  const alias = /([A-Za-z_$][\w$]*) as REVISION/.exec(code);
  if (!alias) return null;
  const name = alias[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assign = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(code);
  return assign ? assign[1] : null;
}

/** Erwartete Revision aus der devDependency: "^0.185.1" -> "185". */
function declaredRevision() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const range = pkg.devDependencies?.three;
  if (!range) return null;
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(range);
  return m ? m[2] : null;
}

if (existsSync(CORE)) {
  const have = vendoredRevision();
  const want = declaredRevision();
  if (!have) problems.push(`REVISION nicht aus ${CORE} lesbar — Bundle-Format geaendert?`);
  else if (!want) problems.push('package.json nennt keine three-devDependency');
  else if (have !== want) {
    problems.push(
      `Versionen laufen auseinander: vendort r${have}, package.json will r${want}.\n` +
      '      Kopie erneuern aus node_modules/three/build + examples/jsm,\n' +
      '      ODER die devDependency auf die vendorte Version zuruecksetzen.',
    );
  } else {
    console.log(`vendortes three: r${have} — deckt sich mit package.json ✓`);
  }
}

if (problems.length) {
  console.error('\nVendortes three.js passt nicht:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}
