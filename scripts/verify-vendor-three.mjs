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
//
// Seit dem Befund zur Lieferkette (29.10.2026) reicht die Versionsnummer nicht
// mehr: eine Kopie kann "r185" tragen und trotzdem veraendert sein. Jede Datei
// unter public/vendor/three/ wird deshalb per SHA-256 mit ihrer Quelle in
// node_modules/three verglichen (build/ fuer das Bundle, examples/jsm/ fuer
// die Addons). node_modules kommt aus `npm ci` gegen das Lockfile, dessen
// Integritaets-Hashes npm beim Installieren prueft — damit ist die Kopie an
// genau das veroeffentlichte Paket gebunden.
//
// Ausnahmen (PATCHED) sind benannte, eigene Korrekturen. Jede traegt ihren
// Anlass und genau die Ersetzung, die sie vornimmt: geprueft wird, dass die
// Kopie mit dieser einen Ersetzung rueckgaengig gemacht WIEDER bitgleich zur
// Quelle ist. Faellt die Korrektur weg (Kopie erneuert, upstream behoben),
// reisst das Tor — eine Ausnahme ohne Anlass ist ein Zombie.
//
// Zeilenenden: unter Windows checkt git die .js-Dateien mit CRLF aus, npm
// liefert LF. Textdateien werden vor dem Hashen auf LF gebracht; Binaerdateien
// (.wasm) nicht.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const CORE = 'public/vendor/three/three.core.min.js';
const REQUIRED_FILES = [
  'public/vendor/three/three.module.min.js',
  'public/vendor/three/three.core.min.js',
  'public/vendor/three/addons/controls/OrbitControls.js',
  'public/vendor/three/addons/loaders/GLTFLoader.js',
  'public/vendor/three/addons/loaders/DRACOLoader.js',
  'public/vendor/three/addons/utils/BufferGeometryUtils.js',
  'public/vendor/three/addons/utils/SkeletonUtils.js',
  // Hangar: Umgebungsverdeckung in der echten Halle (nachgeladen)
  'public/vendor/three/addons/postprocessing/EffectComposer.js',
  'public/vendor/three/addons/postprocessing/RenderPass.js',
  'public/vendor/three/addons/postprocessing/GTAOPass.js',
  'public/vendor/three/addons/postprocessing/OutputPass.js',
  'public/vendor/three/addons/postprocessing/UnrealBloomPass.js',
  // Hangar: Spiegelungssonden der Halle aus dem Spiel (nachgeladen, falls da)
  'public/vendor/three/addons/loaders/HDRLoader.js',
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

// ---------------------------------------------------------------------------
// Bitgleichheit mit node_modules/three
// ---------------------------------------------------------------------------
const VENDOR = 'public/vendor/three';
const UPSTREAM = 'node_modules/three';
// Sperrklinke: so viele Dateien liegen heute in der Kopie. Nur nach oben;
// nach unten nur per Commit, der sagt, welches Addon wegfiel und warum.
const MIN_FILES = 25;

const PATCHED = {
  'addons/controls/OrbitControls.js': {
    why: 'Mittelklick-Ziehen mit zoomToCursor zoomte auf einen falschen Punkt (upstream uebergibt zweimal clientX)',
    upstream: '\t\tthis._updateZoomParameters( event.clientX, event.clientX );\n',
    patched:
      '\t\t// VerseBase-Patch: upstream übergibt hier zweimal clientX — mit\n' +
      '\t\t// zoomToCursor zoomt das Mittelklick-Ziehen dadurch auf einen falschen\n' +
      '\t\t// Punkt (y = x). Wheel/Pinch (Zeile ~1157/1426) machen es korrekt.\n' +
      '\t\tthis._updateZoomParameters( event.clientX, event.clientY );\n',
  },
};

const TEXT = /\.(m?js|json|css|html|txt|md)$/i;
const read = (f) => {
  const buf = readFileSync(f);
  return TEXT.test(f) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : buf;
};
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(relative(VENDOR, p).split(sep).join('/'));
  }
  return out;
}

/** addons/x.js -> examples/jsm/x.js, sonst build/<datei>. */
const upstreamOf = (rel) => join(UPSTREAM, rel.startsWith('addons/') ? `examples/jsm/${rel.slice(7)}` : `build/${rel}`);

let checked = 0;
let patchedOk = 0;
if (!existsSync(join(UPSTREAM, 'package.json'))) {
  problems.push(`${UPSTREAM} fehlt — erst \`npm ci\`, dann pruefen (im Docker-Build ist es immer da).`);
} else if (existsSync(VENDOR)) {
  const upVersion = JSON.parse(readFileSync(join(UPSTREAM, 'package.json'), 'utf8')).version;
  const files = walk(VENDOR).sort();
  for (const rel of files) {
    const src = upstreamOf(rel);
    if (!existsSync(src)) {
      problems.push(`${VENDOR}/${rel}: keine Quelle in ${src} — fremde Datei in der Kopie?`);
      continue;
    }
    checked++;
    const mine = read(join(VENDOR, rel));
    const theirs = read(src);
    const patch = PATCHED[rel];
    if (!patch) {
      if (sha(mine) !== sha(theirs)) {
        problems.push(
          `${VENDOR}/${rel} weicht von three ${upVersion} ab\n` +
          `      Kopie   ${sha(mine).slice(0, 16)}…\n` +
          `      Quelle  ${sha(theirs).slice(0, 16)}…  (${src})\n` +
          '      Absichtlich? Dann als benannte Ausnahme in PATCHED eintragen. Sonst aus der Quelle neu kopieren.',
        );
      }
      continue;
    }
    const text = mine.toString('utf8');
    if (sha(mine) === sha(theirs)) {
      problems.push(`Ausnahme ${rel} ist ein Zombie: die Kopie ist bitgleich zur Quelle, die Korrektur fehlt — Eintrag aus PATCHED entfernen oder die Korrektur wieder einspielen (${patch.why}).`);
    } else if (text.split(patch.patched).length !== 2) {
      problems.push(`Ausnahme ${rel}: die benannte Korrektur steht nicht genau einmal in der Kopie — PATCHED.patched an die Datei anpassen.`);
    } else if (sha(Buffer.from(text.replace(patch.patched, patch.upstream), 'utf8')) !== sha(theirs)) {
      problems.push(`Ausnahme ${rel}: ohne die benannte Korrektur ist die Kopie NICHT bitgleich zur Quelle — dort ist mehr veraendert als erklaert.`);
    } else {
      patchedOk++;
    }
  }
  if (files.length < MIN_FILES) {
    problems.push(`nur ${files.length} Dateien in ${VENDOR}, Klinke steht bei ${MIN_FILES} — fehlt ein Addon?`);
  }
  console.log(`vendortes three: ${checked} Dateien per SHA-256 gegen three ${upVersion} geprueft, ${patchedOk} davon als benannte Korrektur (Klinke ${MIN_FILES}).`);
}

for (const [rel] of Object.entries(PATCHED)) {
  if (!existsSync(join(VENDOR, rel))) problems.push(`Ausnahme ${rel}: Datei gibt es nicht mehr — Eintrag aus PATCHED entfernen.`);
}

if (problems.length) {
  console.error('\nVendortes three.js passt nicht:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}
