# Phase 20: Wikelos Angebote kommen aus dem Bestand — Pattern Map

**Kartiert:** 2026-08-28
**Analysierte Dateien:** 9 (2 neu, 7 geändert)
**Analoge gefunden:** 9 / 9

## File Classification

| Neu/Geändert | Rolle | Datenfluss | Nächstes Analog | Trefferqualität |
|---|---|---|---|---|
| `scripts/build-wikelo-trades.mjs` (NEU) | build-time generator (utility) | batch/transform (merge) | `scripts/build-mining-db.mjs` | exakt |
| `assets/wikelo-curated.json` (NEU) | config/Database (kuratierte Zulieferdatei) | file-I/O (statisches JSON) | `assets/mining-curated.json` | exakt |
| `scripts/datamine-wikelo.mjs` (unverändert, nur Referenz) | build-time extractor | file-I/O/transform | — (bereits fertig) | n/a |
| `assets/wikelo-trades.json` (Ausgabe, wird build-generiert) | Database/Storage | batch/transform-Ausgabe | `assets/mining-db.json` (Ausgabe von `build-mining-db.mjs`) | exakt |
| `assets/wikelo-trades.meta.json` (Ausgabe, wird build-generiert) | Database/Storage (Meta) | batch/transform-Ausgabe | `assets/dismantling-items.meta.json` (Begleitdatei-Muster) | rollen-match |
| `scripts/lib/metrics-baseline.mjs` (erweitert) | config (Sperrklinken-Liste) | batch (statische Werte) | Abschnitt „Fahrzeuge" (`fahrzeuge`, Zeile 72) in derselben Datei | exakt |
| `scripts/verify-datastand.mjs` (erweitert) | build-time gate/verifier | request-response (CLI-Prüfung) | Zeile „Zerlegung" (Begleitdatei-Fall) in derselben Datei | exakt |
| `scripts/verify-metrics.mjs` (erweitert, ABLESER) | build-time gate/verifier | batch (Ableser-Funktionen) | `fahrzeuge: () => rd('src/data/vehicles.json').vehicles?.length` in derselben Datei | exakt |
| `src/components/topics/wikelo-emporium.astro` (Copy-Text-Fix) | component (Astro-Seite) | request-response (SSR) | unverändert, nur zwei Textstellen | n/a (kein Analog nötig) |
| `package.json` (Skript-Verkabelung) | config | — | Zeile `sync:mining` (Kette aus mehreren `datamine-*` + `build-*` Skripten) | exakt |
| `scripts/lib/gate-registry.mjs` (optionaler Eintrag, falls neues Prüfskript entsteht) | config (Gate-Verzeichnis) | — | Eintrag `verify:mining` (Rail A, Anlass-Kommentare) | rollen-match |

## Pattern Assignments

### `scripts/build-wikelo-trades.mjs` (NEU — build-time generator)

**Analog:** `scripts/build-mining-db.mjs` (vollständig gelesen, 152 Zeilen)

**Imports & Kopf-Konvention** (`scripts/build-mining-db.mjs` Zeilen 1–20):
```javascript
// build-mining-db.mjs — assembliert assets/mining-db.json (Mineral-DB für MiningApp)
// AUS DEN EIGENEN Extrakten, kein scmdb-Fetch. Quellen:
//   assets/mining-locations-gamefiles.json (Fundorte je Mineral + Bodies + Methoden)
//   assets/mining-gamefiles.json           (rarity je Erz)
//   assets/mining-frozen.json               (rarity-Fallback für Edelsteine)
//   assets/mining-db.json (PREV)            (kuratiert: code/kind/weight_scu)
// game_version aus dem Client-build_manifest.id.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_P4K } from './lib/p4k.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const A = resolve(__dirname, '..', 'assets');
const OUT = resolve(A, 'mining-db.json');
const rd = (n) => JSON.parse(readFileSync(resolve(A, n), 'utf8'));
const locs = rd('mining-locations-gamefiles.json');
const game = rd('mining-gamefiles.json');
const frozen = rd('mining-frozen.json');
const curated = rd('mining-curated.json'); // kuratierte Attribute (getrennt, wird NIE überschrieben)
```
→ 1:1 übertragbar: `scripts/build-wikelo-trades.mjs` liest `wikelo-gamefiles.json` (maschinell) + `wikelo-curated.json` (kuratiert, „wird NIE überschrieben") und schreibt `assets/wikelo-trades.json`. Denselben `rd()`-Helfer und dieselbe `resolve(__dirname, '..', 'assets')`-Konvention übernehmen.

**game_version aus Client-Manifest** (Zeilen 40–43):
```javascript
let game_version = (frozen.frozen_from || '').replace(/^scmdb\s+/, '');
const bm = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
if (existsSync(bm)) { try { const d = JSON.parse(readFileSync(bm, 'utf8')).Data; game_version = `${(d.Branch || '').replace(/^sc-alpha-/, '')}-live.${d.RequestedP4ChangeNum}`; } catch { /* Fallback */ } }
```
Bei Wikelo einfacher: `datamine-wikelo.mjs` schreibt `gameVersion` bereits direkt in `wikelo-gamefiles.json` (siehe unten) — `build-wikelo-trades.mjs` muss das Manifest nicht selbst erneut lesen, sondern kann `game.gameVersion` aus dem Extrakt übernehmen.

**Kuratierte Overlay-Map + Merge, keyed by stabilem Schlüssel** (Zeilen 45, 86–110):
```javascript
const prevByName = new Map(Object.entries(curated.minerals || {}));
...
const minerals = matList.map((mat) => {
  const el = locByMat.get(mat) || { material: mat, methods: [], locations: [] };
  const prevM = prevByName.get(mat) || {};
  ...
  return {
    name: mat, code: prevM.code || null, kind: kind || null, weight_scu: prevM.weight_scu || null,
    method,
    ...
  };
})
```
→ Für Wikelo: `const curatedById = new Map(Object.entries(curated.trades || {}));` dann je Vertrag `const cur = curatedById.get(c.id) || {};` und `img: cur.img ?? null, comps: cur.comps ?? null, rep: cur.rep ?? null, cat: cur.cat ?? DEFAULT_CAT`.

**Selbstauskunft/Diagnose-Ausgabe am Skriptende** (Zeilen 143–151, Grundsatz 2 „Selbstauskunft"):
```javascript
writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
console.log(`mining-db.json: v${game_version} — ${minerals.length} Minerale, ${bodies.length} Bodies`);
console.log('  Methoden (Leitgroesse):', JSON.stringify(minerals.reduce((a, m) => ((a[m.method] = (a[m.method] || 0) + 1), a), {})));
...
console.log('  ohne weight_scu:', minerals.filter((m) => m.weight_scu == null).length + '/' + minerals.length + ' (kuratiertes Feld, steht nicht in den Spieldaten)');
console.log('  ohne Fundorte:', minerals.filter((m) => !m.locations.length).map((m) => m.name).join(', ') || '—');
if (dropped.length) console.log('  VERWORFEN (Physik da, aber weder Fundort noch Kuration):', dropped.join(', '));
```
→ Für Wikelo: nach dem Schreiben ausgeben, wie viele der 69 Verträge ein `img`/`comps`/`rep` aus der Kuration bekommen haben und welche `id`s in `wikelo-curated.json` KEINEN Treffer im aktuellen Bestand mehr haben (Anzeichen für einen entfernten Vertrag).

**Alternatives Einmisch-Muster (kürzer, falls der Merge simpler bleiben soll)** — `scripts/datamine-vehicles.mjs` Zeilen 818–828:
```javascript
const external = existsSync(EXTERNAL) ? JSON.parse(readFileSync(EXTERNAL, 'utf8')) : { vehicles: {}, overrides: {} };
...
for (const id of ids) {
  const v = buildVehicle(id);
  if (!v) continue;
  // Einmisch-Schleife (01.4-03): übernimmt ALLES, was die Fremddatei je Fahrzeug
  // führt, nicht eine feste Liste — bleibt so richtig, wenn die Liste aus Plan 02
  // schrumpft. ...
  const ext = external.vehicles?.[id] ?? {};
  out.push({ ...v, ...ext });
  builtIds.add(id);
}
```
Die RESEARCH.md empfiehlt explizit das `build-mining-db.mjs`-Muster (separates Skript) statt dieses inline-Musters — hier nur als Beleg für die `{ ...maschinell, ...kuratiert[id] }`-Schleifenform selbst, die in beiden Fällen identisch ist.

**Fachlicher Zusatzschritt, NUR bei Wikelo nötig — Favor-Zeile heraustrennen** (aus RESEARCH.md „Code Examples"):
```javascript
const FAVOR_KLASSE = 'Carryable_1H_CY_banu_favour_Wikelo';
const favorOrder = vertrag.orders.find((o) => o.klasse === FAVOR_KLASSE);
const favor = favorOrder?.min ?? null;
const mats = vertrag.orders
  .filter((o) => o.klasse !== FAVOR_KLASSE)
  .map((o) => `${o.min}× ${o.name}`); // "×" (Multiplikationszeichen), nicht "x" — bestehende Konvention
```
Kein Analog in `build-mining-db.mjs` nötig — dies ist reine Wikelo-Fachlogik, aber die Zeichenkonvention `×` (nicht `x`) MUSS aus `assets/wikelo-trades.json` (aktueller Bestand, s. u.) übernommen werden.

**Extraktions-Quelle, unverändert** — `scripts/datamine-wikelo.mjs` (vollständig gelesen, 188 Zeilen). Wichtigster Ausschnitt, das Ausgabeformat, das `build-wikelo-trades.mjs` als Eingabe liest (Zeilen 173–188):
```javascript
if (!REPORT) {
  const ziel = resolve(ROOT, 'assets', 'wikelo-gamefiles.json');
  ...
  writeFileSync(ziel, JSON.stringify({
    generator: 'scripts/datamine-wikelo.mjs',
    generatedAt: new Date().toISOString(),
    gameVersion,
    counts: { contracts: out.length, withOrders: mitOrders, orderLines: ordersGesamt },
    contracts: out.sort((a, b) => String(a.titel ?? a.debugName).localeCompare(String(b.titel ?? b.debugName), 'en')),
  }, null, 1) + '\n');
```
Jeder Vertrag trägt bereits `id` (stabiler 32-stelliger Hex-Schlüssel), `titel`, `orders[]` (`{klasse, name, min, max}`), `rewardItems[]`, `reputation[]` — das ist exakt das Feldset, das `build-wikelo-trades.mjs` als „maschinell" liest.

---

### `assets/wikelo-curated.json` (NEU)

**Analog:** `assets/mining-curated.json` (Kopf + Struktur vollständig gelesen)

**Format-Vorbild** (Kopfzeilen):
```json
{
  "source": "Kuratierte Mineral-Attribute (Code/Kind/Gewicht/Basis-Methode) — von Hand gepflegt. Von build-mining-db gelesen, nie überschrieben.",
  "minerals": {
    "Agricium": { "code": "AGRI", "kind": "Metal", "weight_scu": 1.2, "method": "ship" },
    ...
  }
}
```
→ Für Wikelo (Vorschlag der RESEARCH.md, Pattern 1):
```json
{
  "source": "Kuratierte Wikelo-Zusatzfelder (Bild/Ausstattung/Reputationstext) — von Hand gepflegt, keyed by Vertrags-id. Von build-wikelo-trades gelesen, nie überschrieben.",
  "trades": {
    "<32-stellige Vertrags-id>": { "img": "wk-....png", "comps": [ { "k": "pwr", "q": "1x", "n": "Radix", "s": "0", "cl": "Civilian", "g": "C" } ], "rep": "Very Good Customer", "cat": "ship" }
  }
}
```

**Feldformen von `comps`/`img`/`rep`, wörtlich aus dem aktuellen (noch handgepflegten) Bestand** — `assets/wikelo-trades.json` (erste 40 Einträge gelesen), z. B.:
```json
{"cat":"ship","name":"Pulse","favor":4,"mats":["—"],"img":"wk-pulse.jpg","comps":[{"k":"pwr","q":"1x","n":"Radix","s":"0","cl":"Civilian","g":"C"},{"k":"cooler","q":"1x","n":"Kelvid","s":"0","cl":"Civilian","g":"B"}]}
```
```json
{"cat":"ship","name":"L-21 Wolf (Military Spec)","favor":5,"mats":["—"],"rep":"Very Good Customer","img":"wk-wolf-mil.jpg","comps":[...]}
```
→ Diese exakten Feldnamen (`img`, `comps` mit Unterfeldern `k/q/n/s/cl/g`, `rep`) sind die kuratierten Felder, die in `wikelo-curated.json` unter `trades.<id>` wandern. `mats`/`favor`/`cat`(?)/`name` selbst kommen künftig aus den Spieldaten bzw. bleiben teils Diskussionspunkt (`cat`, s. RESEARCH.md Offene Frage 1).

---

### `scripts/lib/metrics-baseline.mjs` (erweitert — zwei neue Zeilen)

**Analog:** Abschnitt „Fahrzeuge" in derselben Datei (Zeilen 70–77) — zeigt die `regel: 'min'` + `anlass`-Form, die für die neuen Wikelo-Zeilen gebraucht wird:
```javascript
{
  id: 'fahrzeuge',
  wert: 227,
  regel: 'exakt',
  anlass:
    'Phase 01.4-03: 223 aus der Extraktion plus die vier ATLS-Varianten. Exakt statt Minimum, weil jede Aenderung an dieser Zahl einen Datamine-Beleg braucht — nach oben wie nach unten.',
},
```
Genaueres Vorbild für die `toleranzProzent`-Form (Wikelo braucht Toleranz, weil der Bestand patchweise rotiert) — `ruestungsSets` (Zeilen 63–68, `regel: 'min'`, kein `toleranzProzent`) plus die von RESEARCH.md bereits vorformulierten Zeilen:
```javascript
// Source: RESEARCH.md, Abschnitt "Code Examples" — bereit zum Einfügen
{
  id: 'wikeloVertraege',
  wert: 69,
  regel: 'min',
  toleranzProzent: 2, // Bestand rotiert patchweise (Register-Eintrag id 51: "Wikelo Inventory Updates")
  anlass:
    'Phase 20, Messlauf 28.08.2026 gegen gameVersion 4.10.0-live.12519617. ' +
    'Vorher handgepflegt (63 Eintraege, eingefroren auf Patch 4.8.1) und ohne ' +
    'Bestandsschutz — Register-Eintrag id 51.',
},
{
  id: 'wikeloWarenposten',
  wert: 285,
  regel: 'min',
  toleranzProzent: 2,
  anlass: 'Phase 20, Messlauf 28.08.2026 — 285 Warenposten ueber 68 von 69 Vertraegen.',
},
```

---

### `scripts/verify-metrics.mjs` (erweitert — ABLESER-Bijektion)

**Analog:** vorhandener `fahrzeuge`-Ableser (gleiche Datei, ABLESER-Objekt):
```javascript
fahrzeuge: () => rd('src/data/vehicles.json').vehicles?.length,
```
**Neue Zeilen** (aus RESEARCH.md, bereit zum Einfügen):
```javascript
wikeloVertraege: () => rd('assets/wikelo-gamefiles.json').counts?.contracts,
wikeloWarenposten: () => rd('assets/wikelo-gamefiles.json').counts?.orderLines,
```
Wichtig: liest bewusst `wikelo-gamefiles.json` (unmittelbarer Erzeuger-Output von `datamine-wikelo.mjs`), NICHT `wikelo-trades.json` — dieselbe Logik wie bei `items`/`fahrzeuge`.

---

### `scripts/verify-datastand.mjs` (erweitert — Wikelo von HANDPFLEGE nach STANDS)

**Analog:** Zeile „Zerlegung" in `STANDS` (bereits gelesen, Zeilen 62 area) — genau derselbe Begleitdatei-Fall (nacktes Array + eigene Meta-Datei):
```javascript
{
  id: 'Zerlegung',
  file: 'assets/dismantling-items.meta.json',
  get: (j) => j?.gameVersion,
  companion: { file: 'assets/dismantling-items.json', countField: 'itemCount' },
},
```
**Aktueller (zu ersetzender) HANDPFLEGE-Eintrag** (vollständig gelesen):
```javascript
const HANDPFLEGE = [
  {
    id: 'Wikelo',
    file: 'assets/wikelo-trades.meta.json',
    versionField: 'reviewedVersion',
    dateField: 'reviewedAt',
    companion: { file: 'assets/wikelo-trades.json', countField: 'entryCount' },
  },
];
```
**Neue STANDS-Zeile** (Vorbild „Zerlegung", 1:1 übertragen):
```javascript
{
  id: 'Wikelo',
  file: 'assets/wikelo-trades.meta.json',
  get: (j) => j?.gameVersion,
  companion: { file: 'assets/wikelo-trades.json', countField: 'entryCount' },
},
```
**KLINKEN-Ergänzung** — vorhandene Sperrklinken-Liste (vollständig gelesen):
```javascript
const KLINKEN = {
  Missionen: 12519617,
  Mining: 12519617,
  Crafting: 12519617,
  'Item-Katalog': 12519617,
  Refinery: 12519617,
  Zerlegung: 12519617,
};
```
→ neue Zeile ergänzen: `Wikelo: 12519617,`

**Aktuelles `wikelo-trades.meta.json`** (vollständig gelesen — zeigt die alten Felder, die wegfallen bzw. sich ändern):
```json
{
  "reviewedVersion": "4.10.0",
  "reviewedAt": "2026-08-27",
  "entryCount": 63,
  "note": "Handgepflegte Tauschliste fuer Wikelo's Emporium. ..."
}
```
→ künftig zusätzlich (oder statt `reviewedVersion`) ein `gameVersion`-Feld führen, das `verify-datastand.mjs`s `get: (j) => j?.gameVersion` liest (s. RESEARCH.md Offene Frage 2 — Empfehlung: beide Felder behalten).

---

### `package.json` (Skript-Verkabelung)

**Analog:** bestehende `sync:mining`-Kette (mehrere `datamine-*` + `build-*mjs` + `_sync-assets.mjs`):
```json
"sync:mining": "node scripts/datamine-mining.mjs && node scripts/datamine-locations.mjs && node scripts/datamine-gear.mjs && node scripts/build-mining-model.mjs && node scripts/build-mining-db.mjs && node scripts/_sync-assets.mjs",
```
**Vorhandene Wikelo-Zeile** (nur Extraktion, kein Build-Merge-Schritt):
```json
"datamine:wikelo": "node scripts/datamine-wikelo.mjs",
```
→ Nach Muster `sync:mining` entweder `datamine:wikelo` um `&& node scripts/build-wikelo-trades.mjs` erweitern, oder eine neue `sync:wikelo`-Kette anlegen, die beide Schritte verkettet (Planner entscheidet je nach Wiring-Vorgabe von `verify:wiring`).

---

### `scripts/lib/gate-registry.mjs` (nur falls ein NEUES Prüfskript entsteht)

**Analog:** Eintrag `verify:mining` (Rail A, mit `env`-Begründung und datiertem Anlass-Kommentar):
```javascript
{
  id: 'verify:mining',
  npm: 'verify:mining',
  script: 'scripts/verify-mining.mjs',
  rail: 'A',
  checks: 'die Mining-Daten sind in sich stimmig und kein interner Klassenname wird ausgeliefert; der Abstand zum installierten Client wird gemeldet, blockt aber nicht',
  env: 'Data.p4k nur als Pfadableitung: der Client-Abgleich haengt hinter existsSync(build_manifest.id) und wird ohne lokale Spielinstallation still uebersprungen — das Skript oeffnet das Archiv selbst nie',
},
```
RESEARCH.md hält fest, dass diese Phase „wahrscheinlich KEIN neues Prüfskript" braucht (die bestehenden `verify:metrics`/`verify:datastand` reichen). Falls der Planner doch eines vorsieht, MUSS es hier eingetragen werden — sonst reißt `verify:wiring`.

---

### `src/components/topics/wikelo-emporium.astro` (Copy-Text, kein neues Muster)

**Betroffene Stellen** (vollständig zitiert, Zeilen 338 und 407):
```
Zeile 338: "... {TRADES.length}{de ? ' Trades des Patches ' : ' trades in patch '}<b>4.8.1</b>{de ? ', direkt aus der Datendatei des Live-Trackers ' : ', taken straight from the data file of the live tracker '}..."
Zeile 407: "...{de ? ' (CC-BY-SA 4.0) · Trade-Daten: Live-Tracker ' : ' (CC-BY-SA 4.0) · trade data: live tracker '}<a href="https://wikelotrades.com/" ...>wikelotrades.com</a>{de ? ' (Patch 4.8.1, 04.06.2026) · Schiff-Loadouts: ' : ...}"
```
**Etablierte, audit-sichere Formulierung** (aus anderen Konsumenten, laut RESEARCH.md bereits Konvention in `src/components/MissionDetail.astro`, `ShipDetail.astro`): „aus den Spieldateien" (bzw. EN-Äquivalent) — OHNE technische Begriffe wie „DataCore". Datenimport bleibt unverändert:
```astro
import { matchItemName } from '../../lib/wikeloItemMatch';
import TRADES from '../../../assets/wikelo-trades.json';
import TRADES_META from '../../../assets/wikelo-trades.meta.json';
```
Kein struktureller Analog-Bedarf — nur Textänderung an den zwei zitierten Stellen; Import-Pfade und `TRADES.map(...)`-Struktur bleiben unangetastet (RESEARCH.md, Runtime State Inventory).

## Shared Patterns

### Kuratierte Zulieferdatei, „wird NIE überschrieben"
**Quelle:** `assets/mining-curated.json` + `scripts/build-mining-db.mjs` Zeile 20 (Kommentar)
**Anwenden auf:** `assets/wikelo-curated.json` + `scripts/build-wikelo-trades.mjs`
```javascript
const curated = rd('mining-curated.json'); // kuratierte Attribute (getrennt, wird NIE überschrieben)
```

### Einmisch-Schleife über stabilen Schlüssel, nicht über Anzeigenamen
**Quelle:** `scripts/datamine-vehicles.mjs` Zeilen 818–828 (`{ ...v, ...ext }`) bzw. das analoge `prevByName.get(mat)`-Muster in `build-mining-db.mjs`
**Anwenden auf:** `scripts/build-wikelo-trades.mjs` — Schlüssel MUSS die Vertrags-`id` sein (32-stelliger Hex-String), NICHT der Titel (drei der 69 Verträge haben `titel: null`, s. RESEARCH.md Pitfall 1).

### Sperrklinke + Ableser als Bijektion
**Quelle:** `scripts/lib/metrics-baseline.mjs` (`fahrzeuge`-Eintrag) + `scripts/verify-metrics.mjs` (ABLESER `fahrzeuge`)
**Anwenden auf:** die zwei neuen Zeilen `wikeloVertraege`/`wikeloWarenposten` in beiden Dateien — jede Baseline-Zeile braucht exakt einen Ableser, sonst reißt Zusicherung 2 in `verify-metrics.mjs`.

### Handpflege-Zeile → maschinelle STANDS-Zeile
**Quelle:** `scripts/verify-datastand.mjs`, Fall „Zerlegung" (`STANDS`, Begleitdatei-Muster)
**Anwenden auf:** die Wikelo-Zeile wandert aus `HANDPFLEGE` in `STANDS`, plus neue `KLINKEN.Wikelo`-Zeile.

### `×`-Zeichen-Konvention in Materialmengen
**Quelle:** `assets/wikelo-trades.json` (aktueller Bestand), z. B. `"50× MG Scrip"`, `"1× Carinite (Pure)"`
**Anwenden auf:** `build-wikelo-trades.mjs` beim Formatieren von `mats[]` — Multiplikationszeichen `×`, nicht `x` (s. RESEARCH.md Code-Beispiel).

## No Analog Found

Keine — alle betroffenen Dateien haben ein direktes oder rollen-gleiches Analog im Repo. Das ist der Kernbefund der RESEARCH.md: diese Phase überträgt ausschließlich bereits bewährte Muster (`build-mining-db.mjs` + `mining-curated.json`, Sperrklinken-Bijektion, Begleitdatei-STANDS-Zeile) auf eine neue Domäne.

## Metadata

**Analog-Suchbereich:** `scripts/*.mjs`, `scripts/lib/*.mjs`, `assets/*.json`, `src/components/topics/wikelo-emporium.astro`, `src/lib/wikeloItemMatch.ts`, `assets/wikelo-bridge.js`, `package.json`
**Gescannte Dateien:** 11 vollständig oder gezielt gelesen (`build-mining-db.mjs`, `mining-curated.json`, `datamine-wikelo.mjs`, `wikelo-trades.json`, `wikelo-trades.meta.json`, `datamine-vehicles.mjs` (Ausschnitt), `metrics-baseline.mjs` (Ausschnitte), `verify-metrics.mjs` (Kopf), `verify-datastand.mjs` (vollständig via awk/read), `gate-registry.mjs` (Ausschnitte), `wikelo-emporium.astro`/`wikeloItemMatch.ts`/`wikelo-bridge.js` (Ausschnitte), `package.json` (grep))
**Muster-Extraktionsdatum:** 2026-08-28
