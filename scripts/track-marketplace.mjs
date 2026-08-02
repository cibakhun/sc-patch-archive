// track-marketplace.mjs — schreibt den UEX-Spielermarkt fort, damit wir spaeter
// entscheiden koennen, ob sich daraus ein belastbarer Item-Wert bilden laesst.
//
// WARUM UEBERHAUPT: Ladenpreise (items_prices) sind pro Terminal statisch und
// decken nur ~30 % des Katalogs ab. Die begehrten Loot-Stuecke (z. B. „ADP-mk4
// Arms Justified") verkauft kein NPC — die haben nur einen Spielerpreis, und der
// liegt um Groessenordnungen hoeher (Median ~1 Mio. UEC gegen ~5.000 aUEC im Laden).
//
// WARUM MITSCHREIBEN STATT DIREKT ANZEIGEN: /marketplace_listings liefert
// ANGEBOTSpreise, keine Abschluesse — was jemand verlangt, hat niemand bezahlt.
// Der eine echte Transaktions-Hinweis ist der Uebergang is_sold_out 0 -> 1:
// dann ist das Stueck zum zuletzt gesehenen Preis weggegangen. Genau diesen
// Uebergang kann nur eine Zeitreihe sehen, ein Schnappschuss nicht. Darum dieses
// Skript.
//
// GRENZEN DER QUELLE (gemessen 02.08.2026, nicht vergessen beim Auswerten):
//   - harte Obergrenze 500 Inserate; ?page/?offset/?limit aendern nichts.
//     Es ist ein rollendes Fenster der neuesten Anzeigen, kein Bestand.
//   - dadurch: verschwindet ein Inserat aus dem Fenster, ist das KEIN Verkauf —
//     es kann schlicht verdraengt worden sein. Nur is_sold_out zaehlt.
//   - 295 verschiedene Items in einem Abruf, gegen 6.814 preislose bei uns.
//   - viel Rauschen: von 1 UEC bis 1,5 Mrd.; dazwischen Schiffspakete und
//     Commodities, die gar keine Items im Sinne des Katalogs sind.
//
// DATENSPARSAMKEIT: user_name / user_username / user_avatar werden bewusst NICHT
// gespeichert. Fuer eine Preisreihe braucht es keine Personendaten.
//
// Die Ablage liegt absichtlich NICHT in src/data/ — das ist Seitendaten. Dies
// hier ist ein Forschungsdatensatz, den die Seite (noch) nicht liest.
//
// Aufruf: node scripts/track-marketplace.mjs   (npm run track:marketplace)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// MARKETPLACE_LOG erlaubt es der Action, den Bestand in einen separat
// ausgecheckten Datenzweig zu schreiben, ohne dass hier Pfade geraten werden.
const OUT = process.env.MARKETPLACE_LOG
  ? resolve(process.env.MARKETPLACE_LOG)
  : resolve(__dirname, '..', 'data', 'marketplace-log.json');
const OUT_DIR = dirname(OUT);
const BASE = 'https://api.uexcorp.space/2.0';
const TODAY = new Date().toISOString().slice(0, 10);

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`UEX ${path}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'ok') throw new Error(`UEX ${path}: status ${body.status}`);
  return body.data;
}

// Bestand laden. Fehlt oder ist er kaputt, fangen wir bei null an — aber wir
// ueberschreiben NIE einen lesbaren Bestand mit weniger Daten (siehe unten).
let store = { meta: {}, listings: {} };
if (existsSync(OUT)) {
  try {
    const parsed = JSON.parse(readFileSync(OUT, 'utf8'));
    if (parsed && typeof parsed.listings === 'object') store = parsed;
    else console.warn('WARN: Bestand hat unerwartete Form — beginne neu.');
  } catch (err) {
    // Lieber abbrechen als einen beschaedigten Bestand ueberschreiben.
    console.error('FEHLER: Bestand nicht lesbar:', err.message);
    console.error('Abbruch — bitte data/marketplace-log.json pruefen.');
    process.exit(1);
  }
}

let rows;
try {
  rows = await getJson('/marketplace_listings');
} catch (err) {
  // Zwei getrennte Zusagen, die nicht verwechselt werden duerfen:
  //   1. Der Bestand bleibt unberuehrt („last-good snapshot") — deshalb kein
  //      Schreibzugriff in diesem Zweig.
  //   2. Der Lauf gilt trotzdem als FEHLGESCHLAGEN (exit 1). Frueher war das
  //      exit 0, dadurch meldete ein Actions-Lauf gruen, obwohl er nichts
  //      geholt hatte — ein stiller Ausfall, der monatelang unbemerkt bliebe.
  console.error('UEX nicht erreichbar:', err.message);
  console.error('Bestand unveraendert gelassen — aber der Lauf zaehlt als Fehlschlag.');
  if (/HTTP 403/.test(err.message)) {
    console.error(
      'HTTP 403 heisst hier fast immer: Cloudflare-Bot-Schutz vor UEX. Gemessen am ' +
        '02.08.2026 antwortet die API JEDEM GitHub-Actions-Runner mit der Challenge-Seite ' +
        '„Just a moment…", auch mit Browser-User-Agent. Dieses Skript gehoert daher auf ' +
        'einen Rechner mit gewoehnlicher IP, nicht in eine Cloud-CI.'
    );
  }
  process.exit(1);
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

let neu = 0;
let preisAenderungen = 0;
let verkauft = 0;
const verkauftHeute = [];

for (const r of rows) {
  const id = String(r.id);
  if (!id || id === 'undefined') continue;

  const preis = num(r.price);
  const istVerkauft = Number(r.is_sold_out) === 1;
  const vorher = store.listings[id];

  if (!vorher) {
    store.listings[id] = {
      idItem: num(r.id_item) || null,
      idCategory: num(r.id_category) || null,
      title: String(r.title || '').trim(),
      operation: r.operation || null,
      currency: r.currency || null,
      quality: num(r.quality),
      firstSeen: TODAY,
      lastSeen: TODAY,
      // Nur bei Aenderung fortgeschrieben — haelt die Datei klein.
      prices: preis != null ? [{ d: TODAY, p: preis }] : [],
      soldOut: istVerkauft,
      soldOutAt: istVerkauft ? TODAY : null,
      soldOutPrice: istVerkauft ? preis : null,
      dateAdded: num(r.date_added),
      dateExpiration: num(r.date_expiration),
    };
    neu++;
    if (istVerkauft) verkauft++;
    continue;
  }

  vorher.lastSeen = TODAY;

  const letzter = vorher.prices.length ? vorher.prices[vorher.prices.length - 1].p : null;
  if (preis != null && preis !== letzter) {
    vorher.prices.push({ d: TODAY, p: preis });
    preisAenderungen++;
  }

  // DER interessante Uebergang: aus Wunschpreis wird Abschlusspreis.
  if (istVerkauft && !vorher.soldOut) {
    vorher.soldOut = true;
    vorher.soldOutAt = TODAY;
    // Zuletzt bekannter Preis — der Datensatz kann price beim Verkauf leeren.
    vorher.soldOutPrice = preis != null ? preis : letzter;
    verkauft++;
    verkauftHeute.push({ title: vorher.title, price: vorher.soldOutPrice });
  }
}

const alle = Object.values(store.listings);
store.meta = {
  source: 'UEX Corp (uexcorp.space) /2.0/marketplace_listings — Spieler-Inserate, ANGEBOTSpreise.',
  note: 'Rollendes Fenster von 500 Inseraten. Verschwinden != Verkauf; nur soldOut zaehlt als Abschluss-Hinweis.',
  firstRun: store.meta.firstRun || TODAY,
  lastRun: TODAY,
  runs: (store.meta.runs || 0) + 1,
  totalListings: alle.length,
  totalSold: alle.filter((l) => l.soldOut).length,
  distinctItems: new Set(alle.map((l) => l.idItem).filter(Boolean)).size,
};

// Deterministisch schreiben: Schluessel sortiert, damit git-Diffs lesbar bleiben.
const sortiert = {};
for (const k of Object.keys(store.listings).sort((a, b) => Number(a) - Number(b))) {
  sortiert[k] = store.listings[k];
}
store.listings = sortiert;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(store, null, 1));

console.log(`Lauf ${store.meta.runs} (${TODAY}) — ${rows.length} Inserate abgerufen`);
console.log(`  neu:              ${neu}`);
console.log(`  Preis geaendert:  ${preisAenderungen}`);
console.log(`  neu als verkauft: ${verkauftHeute.length}`);
for (const v of verkauftHeute.slice(0, 5)) {
  console.log(`     ${v.price != null ? Number(v.price).toLocaleString('de-DE') : '?'} UEC — ${v.title}`);
}
console.log(`  Bestand gesamt:   ${store.meta.totalListings} Inserate, davon ${store.meta.totalSold} verkauft`);
console.log(`  verschiedene Items: ${store.meta.distinctItems}`);
console.log('OK:', OUT);
