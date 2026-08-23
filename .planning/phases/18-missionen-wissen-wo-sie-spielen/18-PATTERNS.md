# Phase 18: Missionen wissen, wo sie spielen - Pattern Map

**Gemappt:** 2026-08-23
**Analysierte Dateien:** 7 (5 zu erweitern, 1 neu, 1 unveraendert als Referenz)
**Analoga gefunden:** 7 / 7

## File Classification

| Neue/geänderte Datei | Rolle | Datenfluss | Nächstes Analog | Trefferqualität |
|---|---|---|---|---|
| `scripts/datamine-missions.mjs` (D-01/D-02/D-03, erweitert) | Datamine-Skript (Erzeuger) | Batch (p4k -> JSON) | sich selbst — bestehende `starmap`/`localities`-Bloecke (Zeile 197-212) sind das Muster für die Erweiterung | exakt (dieselbe Datei) |
| `scripts/build-universal-db.mjs` (D-04, Kennung ergänzen) | Erzeuger | Batch (mehrere JSON-Quellen -> JSON) | `scripts/datamine-missions.mjs:34-58` (patchLabel-Ermittlung) | exakt (Muster bereits zweimal im Projekt) |
| `scripts/datamine-crafting.mjs` (D-04, `dismantling-items.json` bekommt Kennung + Hülle) | Erzeuger | Batch, teilweise In-Place-Update | `scripts/datamine-crafting.mjs` selbst — `version`-Feld für `crafting-db.json` (Zeile 484) ist die Vorlage für dieselbe Behandlung von `dismantling-items.json` | exakt (dieselbe Datei, gleiches Muster auf Nachbarfeld) |
| `scripts/build-universal-db.mjs` (Leser, Zeile 219-229 an neue `dismantling-items.json`-Form anpassen) | Erzeuger (liest fremde Datei) | Batch, Transform | dieselbe Datei, `readJson(...items.json)`-Aufruf für UEX (Zeile ~186) als Vorbild für den Objekt-Zugriff (`.items` statt Roh-Array) | rollengleich |
| `assets/crafting-app.js` (Client-Fetch, Zeile 1300-1313 an neue Form anpassen) | Client-Skript (Fetch + Transform) | request-response (fetch), In-Memory-Transform | dieselbe Datei, `initCalc()`/`setupCalc()` | exakt (dieselbe Datei) |
| `scripts/verify-datastand.mjs` (NEU, D-04-Tor) | Verify-Skript (Prüftor) | Batch, read-only (Schiene A) + best-effort Schiene B | `scripts/verify-mining.mjs` | rollengleich, sehr nah (gleiches FEHLER/WARNUNG-Muster, gleicher `build_manifest.id`-Best-effort-Block) |
| `scripts/lib/gate-registry.mjs` (neuer Eintrag `verify:datastand`) | Config (Registry) | CRUD (Array-Eintrag ergänzen) | bestehender Eintrag `verify:mining` (Zeile 218-235) | exakt |
| `src/lib/missions.ts` (`PH_TITLE`-Wörterbuch erweitern, D-03) | Utility (Formatierung/SEO) | Transform | dieselbe Datei, bestehendes `PH_TITLE` (Zeile 181-198) | exakt (dieselbe Datei) |

## Pattern Assignments

### `scripts/datamine-missions.mjs` (Erzeuger, D-01/D-02/D-03)

**Analog:** dieselbe Datei — die drei Änderungen docken an drei bereits existierende Stellen an.

**D-01/D-02 — Ortskante + Namenswörterbuch, Ansatzpunkt (Zeile 197-212):**
```javascript
// StarMap-Objekte: echte Ortsnamen
const starmap = new Map();
for (const r of byStruct('StarMapObject')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  starmap.set(r.id, loc(d?.displayName) ?? loc(d?.name) ?? shortName(r));
}

// Localities: Bereich -> konkrete Orte
const localities = new Map();
for (const r of byStruct('MissionLocality')) {
  const d = db.readRecord(r, { maxDepth: 1 });
  const key = shortName(r);
  const places = (d?.availableLocations ?? []).map((x) => (x?.__ref ? starmap.get(x.__ref) : null)).filter(Boolean);
  localities.set(r.id, { id: kebab(key), key, name: key, places: [...new Set(places)] });
}
```
`starmap` ist bereits da und indiziert genau die `StarMapObject`-Records, auf die
`locationMissionAvailable` zeigt. D-01 braucht keinen neuen Lookup, nur einen zweiten
Lesepfad am Broker-Einlesepunkt (Zeile 568):
```javascript
// Source: scripts/datamine-missions.mjs:568 (heutiger Stand, EIN Feld)
const locality = d.localityAvailable?.__ref ? localities.get(d.localityAvailable.__ref) : null;
```
→ bei `locality === null` zusätzlich `d.locationMissionAvailable?.__ref` gegen `starmap`
auflösen, den rohen Namen durchs neue `STARMAP_NAMES`-Wörterbuch schicken, `kebab()`
anwenden und gegen die bestehende `localities`-Map mergen (nicht überschreiben — siehe
Pitfall 1 in RESEARCH.md).

**D-02 — Kuratiertes Namenswörterbuch, zwei Vorbilder im selben Projekt (anderer
Namensraum, aber identisches Muster: `Record<string,string>`, Fallback-Kaskade):**
```javascript
// Source: scripts/datamine-locations.mjs:74-81 (LOC_NAMES)
const LOC_NAMES = {
  hpp_stanton1: 'Hurston', hpp_stanton1a: 'Arial', hpp_stanton1b: 'Aberdeen', /* ... */
  hpp_pyro1: 'Pyro I', /* ... */
};
function locName(recName, file) {
  let n = (recName || basename(file, '.xml')).replace(/^HarvestableProviderPreset\./, '');
  const low = n.toLowerCase();
  if (LOC_NAMES[low]) return LOC_NAMES[low];
  const M = { /* Sonderfälle */ };
  if (M[low]) return M[low];
  let m;
  if ((m = /^hpp_lagrange_([a-g])$/.exec(low))) return 'Lagrange ' + m[1].toUpperCase();
  // ... weitere Regex-Fallbacks vor dem letzten Rückfall
}
```
```javascript
// Source: scripts/datamine-stanton-anchors.mjs:47-58 (PLANET/MOON, näher am
// Zielnamensraum — Schlüssel sind Ziffernkürzel "1".."4", "1a".."4c")
const PLANET = {
  1: { key: 'hurston', name: 'Hurston', lg: 'HUR' },
  2: { key: 'crusader', name: 'Crusader', lg: 'CRU' },
  3: { key: 'arcCorp', name: 'ArcCorp', lg: 'ARC' },
  4: { key: 'microTech', name: 'microTech', lg: 'MIC' },
};
const MOON = {
  '1a': { key: 'arial', name: 'Arial' }, '1b': { key: 'aberdeen', name: 'Aberdeen' }, /* ... */
};
```
Empfohlene Form für D-02 (aus RESEARCH.md übernommen, noch nicht im Code):
`STARMAP_NAMES` mit Schlüsseln im Zielnamensraum (`stantonstar`, `stanton1` ...),
Fallback über die `MOON`-Tabelle aus `datamine-stanton-anchors.mjs` für Mond-Kürzel,
`humanize()` (bereits im Skript vorhanden, siehe Titelkaskade Zeile ~582) als letzter
Rückfall für den 1,8-%-Langschwanz.

**D-03 — Slot-Art erhalten statt kollabieren (Zeile 242-244):**
```javascript
// Source: scripts/datamine-missions.mjs:242-244 (heutiger Stand)
const TMPL_RE = /~mission\(([^)]*)\)/g;
const braces = (s) => String(s).replace(TMPL_RE, (_, t) => `{${t.split('|').pop()}}`);
```
`t.split('|').pop()` behält nur das letzte Segment (`Address`), verwirft
`Location`/`Destination`/`Pickup1`/`Dropoff1`. Ansatz: `t.split('|')[0]` statt `.pop()`
für den Anzeige-Token verwenden (Details/Abwägung: RESEARCH.md Pattern 3).

---

### `scripts/build-universal-db.mjs` (Erzeuger, D-04)

**Analog für die Kennungsermittlung:** `scripts/datamine-missions.mjs:34-58` (und
identisch `scripts/datamine-crafting.mjs:55-83`) — der Datei fehlt heute nur dieser
Block, obwohl sie bereits `openP4k`/`DEFAULT_P4K` importiert (Zeile 38: `import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';`).

```javascript
// Source: scripts/datamine-missions.mjs:48-58 — Muster fuer patchLabel
const bm = resolve(dirname(p4k.path), 'build_manifest.id');
if (existsSync(bm)) {
  try {
    const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data;
    patchLabel = d?.Branch && d?.RequestedP4ChangeNum
      ? `${d.Branch}@${d.RequestedP4ChangeNum}`
      : (d?.Branch ?? d?.Version ?? null);
  } catch { /* egal */ }
}
```

**Einbaupunkt für das Feld im db-Objekt** (Zeile ~380, `db`-Literal trägt bereits
`generatedAt`/`pricesAsOf`/`note`/`sources`/`counts` als Kopf-Felder — `gameVersion`
reiht sich dort ein, gleiche Ebene wie in `crafting-db.json`s `version`):
```javascript
// Source: scripts/build-universal-db.mjs:380-399 (heutiger db-Kopf, Ansatzpunkt)
generatedAt: new Date().toISOString().slice(0, 10),
pricesAsOf: uexDb.fetchedAt,
note: 'Keine fabrizierten Werte: ...',
sources: { /* ... */ },
counts,
sets: gameSets,
items: items.map((e) => { /* ... */ }),
```
→ `gameVersion: patchLabel` (Name so wählen, dass er zu `verify-datastand.mjs`s
Feldliste passt — RESEARCH.md schlägt `j.gameVersion` vor).

**Leser-Anpassung an die neue `dismantling-items.json`-Form (D-04-Formänderung, siehe
`datamine-crafting.mjs` unten):**
```javascript
// Source: scripts/build-universal-db.mjs:219-229 (heutiger Stand, erwartet Array)
const shopItems = readJson(resolve(ROOT, 'assets', 'dismantling-items.json'));
let snapRows = 0;
for (const it of shopItems) {
  if (isPlaceholder(it.name)) continue;
  /* ... */
}
```
→ bei Umhüllung auf `{ meta, items }`: `const shopItems = readJson(...).items;`

---

### `scripts/datamine-crafting.mjs` (Erzeuger, D-04 — `dismantling-items.json`)

**Vorhandenes Kennungsmuster im selben Skript, für `crafting-db.json` (`version`-Feld,
Zeile 484), als direktes Vorbild für dieselbe Behandlung von `dismantling-items.json`:**
```javascript
// Source: scripts/datamine-crafting.mjs:55-90 — patchLabel-Ermittlung (aufwendiger
// als das Muster in datamine-missions.mjs: Kanal aus Config/Tag, RequestedP4kVersion
// als Vorrang vor Branch@Changelist — beide Formen existieren im Projekt)
let dcbBuf, iniEn, patchLabel = null;
/* ... */
const bm = resolve(dirname(p4k.path), 'build_manifest.id');
if (existsSync(bm)) {
  try {
    const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data ?? {};
    const kanal = d.Config === 'live'
      ? 'LIVE'
      : (d.Tag && d.Tag !== 'no_tag' ? String(d.Tag).toUpperCase() : String(d.Config ?? 'LIVE').toUpperCase());
    patchLabel = d.RequestedP4kVersion
      ?? (d.Branch ? `${kanal}-${d.Branch.replace(/^sc-alpha-/, '')}-${d.RequestedP4ChangeNum ?? ''}`.replace(/-$/, '') : null);
  } catch { /* egal */ }
}
```
```javascript
// Source: scripts/datamine-crafting.mjs:484 — wo die Kennung in crafting-db.json landet
version: patchLabel ?? 'LIVE (Build unbekannt)',
```

**Ansatzpunkt für die Formänderung von `dismantling-items.json` (Zeile 495-514,
heutiger Stand — nacktes Array, In-Place-Update):**
```javascript
// Source: scripts/datamine-crafting.mjs:495-514 (heutiger Stand)
/* ---------------- dismantling-items.json aktualisieren ---------------- */
const dis = JSON.parse(readFileSync(OUT_DIS, 'utf8'));
/* ... updated/unchanged/unmatched zaehlen ... */
writeFileSync(OUT_DIS, JSON.stringify(dis, null, 2) + '\n');
console.log(`dismantling-items: ${updated} Rezepte aktualisiert, ${unchanged} unveraendert, ${unmatched.length} ohne Blueprint-Match`);
```
→ bei Entscheid für Weg (a) aus RESEARCH.md Pitfall 3 (`{ meta: {...}, items: [...] }`):
`const dis = JSON.parse(readFileSync(OUT_DIS, 'utf8')).items;` beim Lesen,
`writeFileSync(OUT_DIS, JSON.stringify({ meta: { gameVersion: patchLabel, generatedAt: ... }, items: dis }, null, 2) + '\n')`
beim Schreiben — UND `build-universal-db.mjs:219` sowie `assets/crafting-app.js:1300-1313`
(unten) im selben Zug anpassen.

---

### `assets/crafting-app.js` (Client-Fetch, D-04-Formänderung)

**Analog:** dieselbe Datei — Fetch + direkte Array-Nutzung.
```javascript
// Source: assets/crafting-app.js:1302-1313 (heutiger Stand, erwartet Array am
// Wurzelknoten)
function initCalc() {
  var dismantleUrl = (window.__CRAFT && window.__CRAFT.dismantleUrl) || '/assets/dismantling-items.json';
  fetch(dismantleUrl)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      ITEMS = data;
      setupCalc();
    })
    .catch(function (err) {
      console.error('Failed to load dismantling items:', err);
    });
}

function setupCalc() {
  DISMANTLE_NAMES = {};
  ITEMS.forEach(function (it, i) { DISMANTLE_NAMES[(it.name || '').toLowerCase()] = i; });
  /* ... */
}
```
→ bei Umhüllung: `ITEMS = data.items;` statt `ITEMS = data;` — einzige Änderung,
`setupCalc()` und alle nachfolgenden `ITEMS.forEach`/`ITEMS[i]`-Stellen bleiben unverändert,
da `ITEMS` weiterhin ein flaches Array ist.

---

### `scripts/verify-datastand.mjs` (NEU, D-04-Tor)

**Analog:** `scripts/verify-mining.mjs` — liefert sowohl den Kopfzeilen-/
Selbstauskunfts-Stil als auch den FEHLER/WARNUNG-Mechanismus und den
best-effort-Client-Abgleich.

**Kopf/Header-Aufbau (Zeile 1-17), Muster für Zweck-Kommentar + Aufrufzeile:**
```javascript
// Source: scripts/verify-mining.mjs:1-17
// verify-mining.mjs — Integritäts-/Konsistenz-Check der committeten Mining-Daten
// (assets/mining-model.json + mining-db.json). Braucht WEDER scmdb NOCH die Data.p4k —
// prüft nur, dass die generierten Daten in sich stimmig sind und die UI nicht bricht.
// Für den game-genauen 0-Diff-Cross-Check gegen scmdb: `node scripts/datamine-*.mjs --verify`.
//
//   node scripts/verify-mining.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_P4K } from './lib/p4k.mjs';

const A = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const rd = (n) => JSON.parse(readFileSync(resolve(A, n), 'utf8'));
const model = rd('mining-model.json');
const db = rd('mining-db.json');
const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };
```

**FEHLER-Sammlung (Grundsatz 3: Verzug einer Fremdquelle ist nie FEHLER) — Muster
`need()` + `fail.push()`, siehe z. B. game_version-Konsistenzprüfung:**
```javascript
// Source: scripts/verify-mining.mjs:39-42
need(model.game_version && db.game_version, 'game_version fehlt');
need(model.game_version === db.game_version, `game_version model(${model.game_version}) != db(${db.game_version})`);
need(!/4\.8/.test(model.game_version), `game_version ist noch 4.8: ${model.game_version}`);
```
Für `verify-datastand.mjs` analog: FEHLER nur, wenn zwei maschinell erzeugte
Kennungen (missions.json/mining-db.json/crafting-db.json/universal-items.json/
refinery-data.json) so weit auseinanderliegen, dass die Handlungsanweisung
("neu erzeugen") immer richtig ist. `wikelo-trades.json`s `reviewed_version`/
`reviewed_at` gehört NICHT in `fail`, sondern in einen separaten `warn`-Kanal
(reines `console.log`, siehe unten) — im Projekt gibt es kein fertiges
`warn.push()`-Array als Vorbild, `verify-mining.mjs` behandelt seinen einzigen
Soft-Fall (Client-Abgleich) als reines `console.log` ohne Sammel-Array:

**Best-effort-Block gegen den installierten Client, CI-sicher durch `existsSync`-
Gatter — WARNUNG-Äquivalent (kein `process.exit`, nur Meldung):**
```javascript
// Source: scripts/verify-mining.mjs:139-152 (identisch als Vorlage geeignet fuer
// den wikelo-trades.json-Verzugscheck, der laut RESEARCH.md ebenfalls nie FEHLER
// sein darf)
const bmPath = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
if (existsSync(bmPath)) {
  try {
    const d = JSON.parse(readFileSync(bmPath, 'utf8'))?.Data ?? {};
    const clientVersion = `${(d.Branch || '').replace(/^sc-alpha-/, '')}-live.${d.RequestedP4ChangeNum}`;
    need(model.game_version === clientVersion, `game_version (${model.game_version}) stimmt nicht mit dem installierten Client ueberein (${clientVersion})`);
  } catch {
    console.log('  (game_version-Abgleich uebersprungen: build_manifest.id nicht lesbar)');
  }
} else {
  console.log('  (game_version-Abgleich uebersprungen: keine lokale Spielinstallation gefunden)');
}
```

**Selbstauskunft + Abbruch am Ende (Grundsatz 2: druckt, wie viele Einheiten geprüft
wurden; Grundsatz FEHLER blockt):**
```javascript
// Source: scripts/verify-mining.mjs (letzte Zeilen)
if (fail.length) { console.error(`FAIL (${fail.length}):\n` + fail.slice(0, 40).join('\n')); process.exit(1); }
console.log(`OK — Mining-Daten konsistent: ${model.elements.length} Elemente, ${model.compositions.length} Komp., ${usableLasers.length} Laser, ${db.minerals.length} Minerale, ${db.bodies.length} Bodies, ${pipeCheckedNames.size} Namen ohne "|" geprueft · ${db.game_version}`);
```
→ `verify-datastand.mjs` druckt entsprechend z. B.
`OK — 5 Datenstaende geprueft, aeltester ${minLabel}, juengster ${maxLabel} (Toleranz ...), 1 Handpflege-Feld geprueft (wikelo)`.
Für die Kreuzvergleichs-Logik selbst gibt es **kein bestehendes Codebeispiel** im
Projekt (RESEARCH.md nennt es ausdrücklich als Skizze) — die Feldliste
(`missions.json:meta.patch`, `mining-db.json:game_version`,
`crafting-db.json:version`, `universal-items.json:gameVersion` (NEU),
`refinery-data.json:meta.gameVersion`) und die Regex-Reduktion auf die
Changelist-Zahl (`\d{6,}`) müssen neu geschrieben werden.

**CI-Tauglichkeit (Schiene A) — dieses Tor öffnet NIE die Data.p4k, nur committete
JSON-Dateien, also KEIN `env`-Feld für den Kreuzvergleichsteil nötig.** Für den
optionalen best-effort-Client-Abgleich (analog zum Block oben) gilt dieselbe
`env`-Formulierung wie bei `verify:mining` (siehe Registry-Eintrag unten).

---

### `scripts/lib/gate-registry.mjs` (neuer Eintrag)

**Analog:** bestehender `verify:mining`-Eintrag (Zeile 218-235), direkt darüber
angeordnet, da beide Torarten (Konsistenz + Client-Abgleich) sich decken:
```javascript
// Source: scripts/lib/gate-registry.mjs:218-235 (bestehender Eintrag, Vorlage)
{
  id: 'verify:mining',
  npm: 'verify:mining',
  script: 'scripts/verify-mining.mjs',
  rail: 'A',
  checks: 'die Mining-Daten sind in sich stimmig, kein interner Klassenname wird ausgeliefert, und der Datenstand passt zum installierten Client',
  env: 'Data.p4k nur als Pfadableitung: der Client-Abgleich haengt hinter existsSync(build_manifest.id) und wird ohne lokale Spielinstallation still uebersprungen — das Skript oeffnet das Archiv selbst nie',
  // SCHARF seit 11.08.2026. ...
},
```
→ neuer Eintrag (Vorschlag, Platzierung direkt danach, weil beide dieselbe
Torfamilie „Datenstand vs. Client" bilden):
```javascript
{
  id: 'verify:datastand',
  npm: 'verify:datastand',
  script: 'scripts/verify-datastand.mjs',
  rail: 'A',
  checks: 'die Patch-Kennungen der committeten Datenstaende (Missionen, Mining, Crafting, Item-Finder, Refinery) liegen nicht zu weit auseinander; wikelo-trades.json meldet Handpflege-Verzug als WARNUNG',
  env: 'kein git, kein Netz, kein Kindprozess, keine Data.p4k — liest ausschliesslich committete JSON-Dateien; daher KEIN env-Eintrag fuer den Kreuzvergleichsteil noetig (nur der optionale best-effort-Client-Abgleich haengt wie bei verify:mining hinter existsSync(build_manifest.id))',
},
```
Header-Kommentar der Registry-Datei (Zeile 31-47) nennt die Feldpflicht ausdrücklich:
`env` ist PFLICHT, sobald ein Schiene-A-Skript git/Kindprozess/Netz berührt — der
Kreuzvergleichsteil tut das nicht, daher reicht ein erklärender Kommentar statt
eines scharfen `env`-Strings, analog zu `verify:gate`/`verify:windows` oben in
derselben Datei (Zeile 100-124: `// Kein env-Feld: kein git, kein Netz, kein
Kindprozess — liest ausschliesslich Textdateien.`).

---

### `src/lib/missions.ts` (`PH_TITLE`, D-03)

**Analog:** dieselbe Datei — vollständiger bestehender Aufbau als Vorlage für die
Erweiterung um die vier Slot-Arten aus D-03.
```typescript
// Source: src/lib/missions.ts:181-198 (voller heutiger Bestand von PH_TITLE)
const PH_TITLE: Record<string, string> = {
  // Bounty-/Vermissten-Familien: das Spiel setzt einen NPC-Namen ein
  targetname: 'Target',
  last: 'Target', // {Last} = Nachname des Ziels
  // Orts-Slots, die nicht schon selbst lesbar sind ({Location} bleibt via Split)
  defendlocationwrapperlocation: 'Location',
  address: 'Location',
  racetype: 'Race',
  // Rang-/Frachtklassen-/Lohn-Slots: ersatzlos — der Satz traegt ohne sie
  reputationrank: '',
  cargogradetoken: '',
  reward: '',
  // Recovery-/Delivery-Familien tragen den ganzen Titel im Token
  timesensitiverecovertitle: 'Time-Sensitive Recovery',
  recoverstashtitle: 'Stash Recovery',
  recoverstashstealtitle: 'Stash Recovery',
  localdeliverydrugprodtitle: 'Local Delivery',
  // Einzelfall "{Title} ({Item})" (mission-station-wastedisposal, Typ maintenance)
  title: 'Maintenance',
  item: '',
};
```
Verwendung (Zeile ~200-210), zeigt, wie der Schlüssel gebildet wird (klein
geschrieben, ohne Sonderbehandlung von Groß-/Kleinschreibung):
```typescript
// Source: src/lib/missions.ts:seoTitle()
export function seoTitle(title: string): string {
  return String(title)
    .replace(/\{([^}]*)\}/g, (_, t) => PH_TITLE[t.toLowerCase()] ?? deCamel(t))
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,:–—-]+|[\s,:–—-]+$/g, '');
}
```
→ D-03 fügt Einträge für die vier (evtl. mehr) neuen Token aus dem geänderten
`braces()` hinzu, z. B. `location: 'Location'`, `destination: 'Destination'`,
`pickup1: 'Pickup'`, `dropoff1: 'Dropoff'` — der bestehende `address: 'Location'`-
Eintrag bleibt als Fallback stehen (RESEARCH.md, Pattern 3), da nicht jede
Vorkommensstelle zwingend zwei Pipe-Segmente hat. Die Anzeige-Komponenten
(`MissionsApp.astro`/`MissionDetail.astro`) übernehmen den Chip-Text unverändert
(`titleParts()`/`parts()` splitten nur auf `{...}`, ohne eigene Übersetzung) —
dort ist **keine Änderung** nötig, nur `PH_TITLE` für die SEO-Texte.

---

## Shared Patterns

### Patch-Kennung ermitteln (bereits zweimal im Projekt erprobt)
**Quelle:** `scripts/datamine-missions.mjs:48-58` (einfache Form) bzw.
`scripts/datamine-crafting.mjs:55-90` (Form mit Kanal-Ableitung aus `Config`/`Tag`).
**Anwenden auf:** `build-universal-db.mjs`, `datamine-crafting.mjs` (für
`dismantling-items.json`).
```javascript
const bm = resolve(dirname(p4k.path), 'build_manifest.id');
if (existsSync(bm)) {
  try {
    const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data;
    patchLabel = d?.Branch && d?.RequestedP4ChangeNum
      ? `${d.Branch}@${d.RequestedP4ChangeNum}`
      : (d?.Branch ?? d?.Version ?? null);
  } catch { /* egal */ }
}
```

### FEHLER-vs-WARNUNG-Trennung (Grundsatz 3 aus CLAUDE.md)
**Quelle:** `scripts/verify-mining.mjs` — `need()`/`fail.push()` für FEHLER,
reines `console.log()` (kein Array, kein Exit-Code-Einfluss) für Soft-Befunde wie
den best-effort-Client-Abgleich. `wikelo-trades.json`s Verzug gehört in den
`console.log`-Zweig, nie in `fail`.
**Anwenden auf:** `verify-datastand.mjs`.

### Tor-Registrierung
**Quelle:** `scripts/lib/gate-registry.mjs`, Eintrag `verify:mining` (Zeile
218-235) inkl. Kopfkommentar (Zeile 1-48) zu Schienen und `env`-Pflicht.
**Anwenden auf:** neuer `verify:datastand`-Eintrag, direkt nach `verify:mining`.
`verify:wiring` erzwingt den Eintrag maschinell — ohne ihn bleibt das Tor ein
„Streuner" und `npm run gate` läuft nicht rot, wenn es fehlschlägt.

### Kuratierte Kürzel-Übersetzung am Erzeuger
**Quelle:** `scripts/datamine-locations.mjs:74-95` (`LOC_NAMES` + Regex-Fallback-
Kaskade), `scripts/datamine-stanton-anchors.mjs:47-58` (`PLANET`/`MOON`).
**Anwenden auf:** neues `STARMAP_NAMES`-Wörterbuch in `datamine-missions.mjs` (D-02)
— Übersetzung gehört an den Erzeuger, nicht in die Anzeige-Komponente.

## Kein Analog gefunden

| Datei/Ausschnitt | Rolle | Datenfluss | Grund |
|---|---|---|---|
| Kreuzvergleichs-Logik in `verify-datastand.mjs` (Toleranzvergleich mehrerer Changelist-Zahlen) | Verify-Skript, Kernlogik | Batch, Vergleich | Kein bestehendes Tor im Projekt vergleicht mehrere unabhängige Datenstände GEGENEINANDER — alle bisherigen Tore (`verify:mining`) vergleichen einen Datenstand gegen den EINEN installierten Client. RESEARCH.md liefert nur eine Skizze, kein Codebeispiel. Muss neu geschrieben werden, orientiert an der Feldliste aus dem Code-Beispiel „Empfohlene Ergaenzung" in `18-RESEARCH.md`. |
| `reviewed_version`/`reviewed_at`-Feld für `wikelo-trades.json` | Config/Metadatenfeld in Handpflege-JSON | — | Keine vergleichbare Handpflege-Kennung existiert im Projekt bereits (alle anderen Datenstände sind maschinell erzeugt). Neu zu entwerfen, RESEARCH.md Pitfall 4 als Grundlage. |

## Metadata

**Analog-Suchbereich:** `scripts/*.mjs`, `scripts/lib/*.mjs`, `assets/*.js`,
`src/lib/missions.ts`, `src/data/*.json` (nur gelesen, nicht als Analog gezählt)
**Durchsuchte Dateien:** ~12 (gezielt per Grep/Read, keine Breitensuche nötig —
RESEARCH.md hatte die Kandidaten bereits benannt)
**Datum der Extraktion:** 2026-08-23
