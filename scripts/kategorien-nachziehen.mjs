// kategorien-nachziehen.mjs — zieht die Kategorie-Ordnung am committeten
// assets/universal-items.json nach (UX-Audit IA B6/V7, Krisz 24.11.2026).
//
// Die Regeln selbst stehen in scripts/lib/kategorie-ordnung.mjs, und
// build-universal-db.mjs wendet sie bei jedem Neubau an. Ein Neubau braucht
// aber die Spielinstallation und die Fremdquellen von dem Stand, aus dem der
// Katalog gebaut wurde (siehe prune-short-name-stubs.mjs); deshalb hier
// derselbe Schritt am fertigen Katalog, sonst nichts. Das Skript ist
// idempotent: ein zweiter Lauf aendert nichts mehr.
//
// Aufruf: node scripts/kategorien-nachziehen.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kategorieFuer } from './lib/kategorie-ordnung.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = resolve(ROOT, 'assets', 'universal-items.json');
const DRY = process.argv.includes('--dry');

const db = JSON.parse(readFileSync(DB, 'utf8'));
if (!Array.isArray(db.items)) {
  console.error('FEHLER: assets/universal-items.json traegt keine Item-Liste.');
  process.exit(1);
}

const wechsel = new Map(); // "alt -> neu" -> Anzahl
let geaendert = 0;
for (const it of db.items) {
  const neu = kategorieFuer(it.category || 'Other', it.name);
  if (neu === it.category) continue;
  const k = `${it.category || '(leer)'} -> ${neu}`;
  wechsel.set(k, (wechsel.get(k) || 0) + 1);
  it.category = neu;
  geaendert++;
}

console.log(`Katalog: ${db.items.length} Items geprueft, ${geaendert} neu eingeordnet.`);
for (const [k, n] of [...wechsel].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
const rest = db.items.filter((i) => i.category === 'Other').length;
console.log(`Bleiben „Other“: ${rest}`);

if (DRY) {
  console.log('--dry: nichts geschrieben.');
} else if (geaendert) {
  writeFileSync(DB, JSON.stringify(db));
  console.log('OK:', DB);
} else {
  console.log('Nichts zu tun.');
}
