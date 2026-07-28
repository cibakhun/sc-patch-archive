// Vorbedingungen der e2e-Suite (laeuft als `pretest:e2e`, siehe package.json).
//
// Warum ueberhaupt: ein Teil der Tests prueft das GEBAUTE Ergebnis, nicht die
// Quelle — layout.test.js liest dist/ schon beim Import, db.test.js vergleicht
// den public/assets-Spiegel. In einem frischen Checkout gibt es beides nicht,
// und der Lauf starb mit einem nackten ENOENT auf eine Datei, die nie jemand
// von Hand anlegt. Das las sich wie ein kaputter Test, war aber nur ein
// fehlender Build.
//
// Bewusst KEIN `npm run build` an dieser Stelle: der Build braucht ~3 Minuten,
// und ihn an jeden Testlauf zu haengen macht die schnelle Rueckmeldung kaputt,
// die der eigentliche Zweck der Suite ist. Stattdessen: klar sagen, was fehlt.
import { existsSync } from 'node:fs';

const NEEDED = [
  ['dist/index.html', 'die gebaute Seite (layout.test.js liest dist/ direkt)'],
  ['dist/assets/universal-items.json', 'die Item-DB im Build (db.test.js 15)'],
  ['public/assets/universal-items.json', 'der public/assets-Spiegel (db.test.js 14)'],
  ['assets/universal-items.json', 'die kanonische Item-DB (in git, sollte da sein)'],
];

const missing = NEEDED.filter(([p]) => !existsSync(p));
if (!missing.length) process.exit(0);

console.error('\nDie e2e-Suite braucht einen Build. Es fehlt:\n');
for (const [p, why] of missing) console.error(`  ${p}\n      ${why}`);
console.error('\n  npm run build\n');
console.error('Danach laeuft `npm run test:e2e` durch.\n');
process.exit(1);
