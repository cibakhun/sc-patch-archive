// Nur die Loose-Datei im Spielordner (Data/Localization/…) wird NICHT gelesen:
// dort liegt bei Krisz eine Community-Lokalisierung.
//
// Aufruf: node scripts/datamine-refinery-methods.mjs [--p4k <Pfad>]
//         (npm run datamine:refinery-methods; danach build:refinery-data)
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K, clientKennung } from './lib/p4k.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

const AUSBEUTE = ['Low Yield', 'Moderate Yield', 'High Yield'];
const KOSTEN = ['Low Cost', 'Moderate Cost', 'High Cost'];
const TEMPO = ['Slowest', 'Very Slow', 'Slow', 'Slightly Slow', 'Moderate Speed', 'Slightly Fast', 'Fast', 'Very Fast', 'Fastest'];

const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const ini = p4k.read(/^Data[\\/]Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
const kennung = clientKennung(p4k.path);
p4k.close();
if (!kennung) throw new Error('datamine-refinery-methods: build_manifest.id neben dem Data.p4k nennt keine Fassung — ohne Spielstand wird nichts geschrieben');

const werte = new Map();
for (const zeile of ini.split(/\r?\n/)) {
  const m = /^refinery_ui_ProcessingType_([A-Za-z]+?)(_Details,P|_Desc)?=(.*)$/.exec(zeile);
  if (!m) continue;
  const e = werte.get(m[1]) ?? {};
  if (!m[2]) e.name = m[3].trim();
  else if (m[2] === '_Details,P') e.details = m[3].replace(/\\n/g, '').trim();
  werte.set(m[1], e);
}

const stufe = (liste, wort, art, id) => {
  const i = liste.indexOf(wort);
  if (i < 0) throw new Error(`datamine-refinery-methods: ${id} nennt fuer ${art} „${wort}", bekannt sind: ${liste.join(', ')}`);
  return i + 1;
};
const methods = [];
for (const [id, e] of werte) {
  if (!e.name || !e.details) throw new Error(`datamine-refinery-methods: ${id} ohne Namen oder Wertung (${JSON.stringify(e)})`);
  const teile = e.details.split('//').map((t) => t.trim());
  if (teile.length !== 3) throw new Error(`datamine-refinery-methods: ${id} hat keine dreiteilige Wertung: „${e.details}"`);
  methods.push({
    id,
    name: e.name,
    yield: stufe(AUSBEUTE, teile[0], 'Ausbeute', id),
    cost: stufe(KOSTEN, teile[1], 'Kosten', id),
    speed: stufe(TEMPO, teile[2], 'Tempo', id),
  });
}
if (methods.length < 9) throw new Error(`datamine-refinery-methods: nur ${methods.length} Methoden gefunden (bisher 9) — Schluessel der Lokalisierung geaendert?`);
methods.sort((a, b) => b.yield - a.yield || a.cost - b.cost || b.speed - a.speed);

const out = {
  gameVersion: kennung,
  source: 'Raffinationsmethoden mit den Stufen, die das Spiel je Methode nennt',
  stufen: { yield: AUSBEUTE.length, cost: KOSTEN.length, speed: TEMPO.length },
  methods,
};
writeFileSync(resolve(ROOT, 'assets', 'refinery-methods.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`refinery-methods: ${methods.length} Methoden, Stand ${kennung}`);
for (const m of methods) console.log(`  ${m.name.padEnd(24)} Ausbeute ${m.yield}/3  Kosten ${m.cost}/3  Tempo ${m.speed}/9`);
