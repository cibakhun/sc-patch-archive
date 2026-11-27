// Items in 3D: die Backliste aus dem ganzen Katalog.
//
//   node scripts/item3d/liste.mjs <liste.json> [--katalog assets/universal-items.json] [--spiel assets/items-gamefiles.json]
//
// Anlass (27.11.2026): Gebacken wurde bisher aus Hand-Listen, eine für
// Rüstung, eine für Waffen. Kleidung, Werkzeuge, Verbrauchsgüter und
// Sonstiges standen auf keiner, und niemand merkte es, weil eine Lücke ohne
// Liste keinen Fehler wirft. Darum gibt es keine Hand-Liste mehr: jedes Item
// des Katalogs bekommt hier genau ein Schicksal.
//
//   liste       gebacken wird (Record aus dem Katalog oder, wo der Katalog
//               keine Spieldaten führt, über den Namen aus dem Datenlauf)
//   ohneRecord  kein Record im Spiel zu finden (weder im Katalog noch über
//               den Namen, oder der Name trifft mehrere)
//
// Ob ein Item ein Modell hat, entscheidet der Bäcker, nicht diese Liste: Eine
// neue Art im Spiel wird gebacken, ohne dass jemand eine Liste anfasst; hat
// sie kein Modell (Lackierung, Charakter-Farbe, Schiffsregler), steht das je
// Item mit Grund im Bauprotokoll (fehler.jsonl) und im Befundbericht.
// Die Liste trägt den Fingerabdruck des Katalogs und die Zahl je Schicksal;
// manifest.mjs übernimmt beides in den Befundbericht, und das Tor
// verify:item3d-befunde prüft, dass die Zahlen den ganzen Katalog abdecken.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const KATALOG = flag('--katalog', resolve(ROOT, 'assets', 'universal-items.json'));
const SPIEL = flag('--spiel', resolve(ROOT, 'assets', 'items-gamefiles.json'));
const [ZIEL] = argv;
if (!ZIEL) { console.error('Aufruf: node scripts/item3d/liste.mjs <liste.json> [--katalog …] [--spiel …]'); process.exit(2); }

const katalogText = readFileSync(KATALOG, 'utf8');
const katalog = JSON.parse(katalogText).items;
// Ohne Datenlauf (items-gamefiles.json liegt nur dort, wo gebacken wird)
// fehlt die Namenssuche: Items ohne Spieldaten im Katalog bleiben dann ohne
// Record, und der Lauf sagt das laut.
let identitaet = [];
if (existsSync(SPIEL)) {
  const gf = JSON.parse(readFileSync(SPIEL, 'utf8'));
  identitaet = [...(gf.identity ?? []), ...(Array.isArray(gf.items) ? gf.items : Object.values(gf.items ?? {}))];
} else console.warn(`WARNUNG: ${SPIEL} fehlt, Items ohne Spieldaten im Katalog bleiben ohne Record (Datenlauf: npm run datamine:items)`);

// Namen wie der Katalog sie zusammenführt, nur ohne Groß/klein, Anführungszeichen und doppelte Leerzeichen
const norm = (s) => String(s ?? '').toLowerCase().replace(/[‘’“”"'`]/g, '').replace(/\s+/g, ' ').trim();
const nachName = new Map();
for (const r of identitaet) {
  if (!r?.id || !r?.name) continue;
  const k = norm(r.name);
  const l = nachName.get(k) ?? [];
  if (!l.some((x) => x.id === r.id)) l.push(r);
  nachName.set(k, l);
}

const liste = [], ohneRecord = {};
const zahl = { katalog: katalog.length, liste: 0, ohneRecord: 0 };
for (const it of katalog) {
  const g = it.game ?? null;
  let guid = g?.guid ?? null, t = g?.gameType ?? null, weg = 'katalog';
  if (!guid && g?.variants?.length) { ohneRecord[it.id] = `${g.variants.length} Ausführungen unter einem Namen`; zahl.ohneRecord++; continue; }
  if (!guid) {
    const treffer = nachName.get(norm(it.name)) ?? [];
    if (treffer.length === 1) { guid = treffer[0].id; t = treffer[0].gameType ?? null; weg = 'name'; }
    else { ohneRecord[it.id] = treffer.length ? `Name trifft ${treffer.length} Records` : 'kein Record'; zahl.ohneRecord++; continue; }
  }
  liste.push({ id: it.id, guid, t, kat: it.category ?? null, weg });
  zahl.liste++;
}

const fingerabdruck = createHash('sha256').update(katalogText).digest('hex').slice(0, 16);
writeFileSync(ZIEL, JSON.stringify({ katalog: fingerabdruck, zahl, liste, ohneRecord }));

const proArt = (o) => Object.entries(o.reduce((m, e) => ((m[e] = (m[e] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log(`Katalog ${zahl.katalog} Items (${fingerabdruck}): ${zahl.liste} zu backen (${liste.filter((e) => e.weg === 'name').length} über den Namen gefunden), ${zahl.ohneRecord} ohne Record -> ${ZIEL}`);
console.log(`  zu backen je Katalog-Bereich: ${proArt(liste.map((e) => (e.kat ?? 'Other').split(' / ')[0])).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`  ohne Record je Katalog-Bereich: ${proArt(Object.keys(ohneRecord).map((id) => (katalog.find((i) => i.id === id)?.category ?? 'Other').split(' / ')[0])).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (zahl.liste + zahl.ohneRecord !== zahl.katalog) { console.error('FEHLER: Schicksale decken den Katalog nicht ab'); process.exit(1); }
