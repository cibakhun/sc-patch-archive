// Traegt im Hangar-Manifest die Fassung je Modell nach (scripts/lib/hangar-stand.mjs),
// ohne die Modelle neu zu bauen. build-hangar-assets tut dasselbe bei jedem Lauf;
// dieses Skript ist fuer einen Bestand, der vor dem Stempel gebaut wurde.
// Braucht das Launcher-Protokoll (Rechner mit dem Spiel).
//
// Aufruf: node scripts/hangar-stand.mjs   (npm run hangar:stand)
import { readFileSync, writeFileSync } from 'node:fs';
import { standNachtragen } from './lib/hangar-stand.mjs';

const MANIFEST = new URL('../src/data/hangar-assets.json', import.meta.url);
const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const { neu, offen } = standNachtragen(m);
if (offen.length) {
  console.error(`hangar-stand: keine Fassung im Launcher-Protokoll fuer CL ${offen.join(', ')} — nichts geschrieben`);
  process.exit(1);
}
writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n', 'utf8');
console.log(`hangar-stand: ${neu} Modelle mit Fassung ergaenzt`);
