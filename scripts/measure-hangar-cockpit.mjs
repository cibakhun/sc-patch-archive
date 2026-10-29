/* ============================================================
   measure-hangar-cockpit.mjs — Durchblick durch die Haube.

   Anlass: Krisz, 29.10.2026, Gladius auf staging: „siehst wie das schiff
   von innen hohl ist?“ Hinter dem Sitz fehlte die Rückwand, der Blick
   ging durch das Glas bis an die Innenseite des Rumpfs. Die ist einseitig
   und von innen unsichtbar, also sah man durch das Schiff in die Halle.
   Notiz: .planning/notes/hangar-cockpit-hohl.md.

   Was es misst und wie: scripts/lib/cockpit-rays.mjs (dieselbe Rechnung
   wie das Tor scripts/verify-hangar-cockpit.mjs).

   Werkzeug (gate-registry: rail null): Es vergleicht Rohexport und
   Web-Fassung (PC) und zeigt je Schiff alle Zahlen; das Tor prueft die
   ausgelieferten Modelle gegen ihre Klinke.

     node scripts/measure-hangar-cockpit.mjs <ordner> [regex] [--json datei]
   ============================================================ */
import { readdirSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { measure } from './lib/cockpit-rays.mjs';

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
const [dir, pat] = args;
if (!dir) { console.error('node scripts/measure-hangar-cockpit.mjs <ordner> [regex] [--json datei]'); process.exit(2); }
const only = pat ? new RegExp(pat) : null;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

const files = readdirSync(dir).filter((f) => f.endsWith('.glb') && (!only || only.test(f))).sort();
const out = {};
for (const f of files) {
  const r = measure(await io.read(`${dir}/${f}`));
  out[f.replace(/\.glb$/, '')] = r;
  console.log(f.padEnd(44), r.glass ? `Glas ${String(r.glass).padStart(5)}  hohl ${String(r.hohlPct).padStart(3)} %  durch ${String(r.durchPct).padStart(3)} %  (zu ${r.zu}, hohl ${r.hohl} davon durch ${r.durch}, frei ${r.frei} von ${r.rays}; ${r.innen} Startpunkte auf Innenglas verworfen)` : 'kein Haubenglas');
}
const withGlass = Object.values(out).filter((r) => r.glass && r.hohlPct != null);
const mean = (k) => (withGlass.length ? (withGlass.reduce((a, r) => a + r[k], 0) / withGlass.length).toFixed(1) : '-');
console.log(`\n${files.length} Modelle, ${withGlass.length} mit Haubenglas, hohl im Mittel ${mean('hohlPct')} %, durch im Mittel ${mean('durchPct')} %`);
if (jsonFile) writeFileSync(jsonFile, JSON.stringify(out, null, 1));
