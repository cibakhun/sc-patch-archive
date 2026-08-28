// build-wikelo-trades.mjs — assembliert assets/wikelo-trades.json +
// assets/wikelo-trades.meta.json (Wikelos Tauschliste fuer WikeloEmporium).
// AUS DEM EIGENEN Extrakt, kein Live-Tracker-Scrape mehr. Quellen:
//   assets/wikelo-gamefiles.json (maschinell, gitignored, Build-EINGABE —
//     Angebote/Mengen/Favor, aus scripts/datamine-wikelo.mjs)
//   assets/wikelo-curated.json   (kuratiert, git-getrackt — img/comps/rep/cat,
//     getrennt gehalten und von diesem Skript NIE ueberschrieben)
// Schluessel der Zusammenfuehrung ist ausschliesslich die Vertrags-`id`
// (32-stelliger Hex-String), NIEMALS der Anzeigename — drei der Vertraege
// (die ATLS-Farbvarianten) tragen `titel: null` (Phase 20, Pitfall 1).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const A = resolve(__dirname, '..', 'assets');
const GAMEFILES = resolve(A, 'wikelo-gamefiles.json');
const OUT = resolve(A, 'wikelo-trades.json');
const META_OUT = resolve(A, 'wikelo-trades.meta.json');
const rd = (n) => JSON.parse(readFileSync(resolve(A, n), 'utf8'));

if (!existsSync(GAMEFILES)) {
  console.error('FEHLER: assets/wikelo-gamefiles.json fehlt — zuerst "npm run datamine:wikelo" laufen lassen.');
  process.exit(1);
}
const game = rd('wikelo-gamefiles.json');
const curated = rd('wikelo-curated.json'); // kuratierte Zusatzfelder (getrennt, wird NIE überschrieben)

const FAVOR_KLASSE = 'Carryable_1H_CY_banu_favour_Wikelo'; // EXAKTE Gleichheit — der
// verwandte Klassenname "..._Wikelo_special" ist der Polaris Bit, keine Favor-Zeile.
const DEFAULT_CAT = 'misc'; // bewusster Rueckfall, keine Ratung — die Spieldaten
// fuehren keine Filterkategorie.

const curatedById = new Map(Object.entries(curated.trades || {}));

// Abbruchbedingung (Eingabepruefung, ASVS V5): eine kuratierte id ohne
// Treffer im aktuellen Bestand wird namentlich genannt statt still
// ignoriert — sie heisst entweder "Vertrag aus dem Spiel entfernt" oder
// "Schluessel gebrochen", beides braucht eine Entscheidung.
const bekannteIds = new Set(game.contracts.map((c) => c.id));
const verwaist = [...curatedById.keys()].filter((id) => !bekannteIds.has(id));
if (verwaist.length) {
  console.error(
    `FEHLER: ${verwaist.length} kuratierte id(s) in assets/wikelo-curated.json ohne Treffer im aktuellen Bestand: ${verwaist.join(', ')}`,
  );
  process.exit(1);
}

let namensueberschreibungen = 0;
let mengenbereiche = 0;
let mitKuratierterKategorie = 0;

const trades = game.contracts.map((c) => {
  const cur = curatedById.get(c.id) || {};

  const favorOrder = c.orders.find((o) => o.klasse === FAVOR_KLASSE);
  const favor = favorOrder?.min ?? null;
  const mats = c.orders
    .filter((o) => o.klasse !== FAVOR_KLASSE)
    .map((o) => {
      // o.max ist NIE < o.min in den heutigen Spieldaten (132/285 Zeilen
      // fuehren max:0 als Sentinel fuer "keine Bandbreite", 153/285 max===min,
      // 0/285 max>min). Ein Vergleich auf reine Ungleichheit (o.max !== o.min)
      // wuerde die max:0-Zeilen faelschlich als Bereich "1–0×" ausgeben —
      // deshalb ausschliesslich auf ECHTE Bandbreite (max groesser als min)
      // pruefen, nicht auf blosse Ungleichheit.
      if (o.max != null && o.max > o.min) {
        mengenbereiche++;
        return `${o.min}–${o.max}× ${o.name}`;
      }
      return `${o.min}× ${o.name}`; // "×" (Multiplikationszeichen), nicht "x" — bestehende Konvention
    });

  const fallbackName = c.rewardItems.length === 1 ? c.rewardItems[0] : (c.titel ?? c.debugName);
  const name = cur.name ?? fallbackName;
  if (cur.name != null && cur.name !== fallbackName) namensueberschreibungen++;
  if (cur.cat != null) mitKuratierterKategorie++;

  const card = { id: c.id, cat: cur.cat ?? DEFAULT_CAT, name };
  if (cur.get) card.get = cur.get;
  if (favor != null) card.favor = favor;
  card.mats = mats;
  if (cur.img) card.img = cur.img;
  if (cur.comps) card.comps = cur.comps;
  if (cur.rep) card.rep = cur.rep;
  return card;
});

const gameVersion = game.gameVersion;
const patch = gameVersion?.match(/\d+\.\d+\.\d+/)?.[0] ?? null;

const meta = {
  generator: 'scripts/build-wikelo-trades.mjs',
  generatedAt: new Date().toISOString(),
  gameVersion,
  patch,
  entryCount: trades.length,
  contractCount: game.counts?.contracts ?? null,
  orderLineCount: game.counts?.orderLines ?? null,
  curatedCount: curatedById.size,
  // curatedReviewedAt beantwortet eine ANDERE Frage als gameVersion: wann
  // wurde die kuratierte Overlay-Datei (Bild/Ausstattung/Reputationstext)
  // zuletzt gegen den Bestand gehalten — nicht, gegen welchen Client
  // ausgelesen wurde. Bleibt deshalb bestehen.
  curatedReviewedAt: curated.reviewedAt ?? null,
  // reviewedVersion/reviewedAt sind mit Phase 20 (D-04) entfallen: ihr
  // einziger Leser war die HANDPFLEGE-Zeile in verify-datastand.mjs, die
  // Wikelo jetzt als maschinellen Datenstand (STANDS, Feld gameVersion)
  // fuehrt. Ein Feld ohne Leser ist eine Behauptung ohne Pruefung.
};

writeFileSync(OUT, JSON.stringify(trades) + '\n', 'utf8');
writeFileSync(META_OUT, JSON.stringify(meta, null, 2) + '\n', 'utf8');

const materialzeilen = trades.reduce((n, t) => n + t.mats.length, 0);
const mitFavor = trades.filter((t) => t.favor != null).length;
const mitBild = trades.filter((t) => t.img).length;
const mitComps = trades.filter((t) => t.comps).length;
const mitRep = trades.filter((t) => t.rep).length;
const aufMiscRueckfall = trades.filter((t) => t.cat === DEFAULT_CAT && !curatedById.get(t.id)?.cat).length;

console.log(`wikelo-trades.json: ${trades.length} Vertraege, ${game.counts?.orderLines ?? '?'} Warenposten gesamt, ${materialzeilen} Materialzeilen`);
console.log(`  Favor: ${mitFavor} Karten | Mengenbereiche (max != min): ${mengenbereiche}`);
console.log(`  Kuration: ${mitBild} mit Bild | ${mitComps} mit comps | ${mitRep} mit rep | ${mitKuratierterKategorie} mit kuratierter Kategorie | ${aufMiscRueckfall} auf dem misc-Rueckfall`);
console.log(`  Namensueberschreibungen durch Kuration: ${namensueberschreibungen}`);
console.log(`  kuratierte id(s) ohne Treffer im Bestand: ${verwaist.length ? verwaist.join(', ') : '—'}`);
