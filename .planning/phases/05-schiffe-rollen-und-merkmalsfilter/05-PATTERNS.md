# Phase 5: Schiffe — Rollen- und Merkmalsfilter - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 7 (neu/geändert)
**Analogs found:** 7 / 7

## File Classification

| Neue/geänderte Datei | Rolle | Datenfluss | Nächster Analog | Trefferqualität |
|---|---|---|---|---|
| `scripts/datamine-vehicle-roles.mjs` | utility (Datamine-Skript) | batch (DataCore → JSON-Datei) | `scripts/datamine-ship-loadouts.mjs` | exakt |
| `src/data/vehicle-roles.json` | config (committete Momentaufnahme) | batch | `src/data/ship-loadouts.json` (Form) + `src/data/vehicles-en.json` (Trennungs-Rationale) | exakt |
| `src/i18n/vehicleText.ts` (Ergänzung) | utility (i18n-Map) | transform | bestehende `SIZE_EN`/`TYPE_EN`/`FOCI_EN`/`TURRET_EN`-Maps + `vType`/`vFoci`/`vRole`-Akzessoren in derselben Datei | exakt (gleiche Datei, Erweiterungsmuster) |
| `src/components/ships/ShipsOverview.astro` | component (Ein-Körper, DE+EN) | request-response (SSG) | `src/components/topics/crafting.astro` | exakt |
| `src/pages/schiffe.astro` (→ Hülle) | route | request-response (SSG) | `src/pages/topics/crafting.astro` | exakt |
| `src/pages/de/schiffe.astro` (→ Hülle) | route | request-response (SSG) | `src/pages/de/topics/crafting.astro` | exakt |
| Client-Filter-Skript (in `ShipsOverview.astro`) | utility (inline `<script is:inline>`) | event-driven (DOM) | inline `apply()`/`sort()` in aktuellem `src/pages/schiffe.astro` (Zeilen 338–403) | exakt |
| Verifikationsskript (Claude's Discretion) | test/utility | batch | `scripts/verify-hardpoints.mjs` (+ `scripts/verify-mining.mjs`) | exakt |
| `src/content.config.ts` (evtl. Zod-Erweiterung, falls Rollenfelder in die Collection wandern) | config | transform | bestehendes `vehicles`-Schema in derselben Datei | exakt (gleiche Datei) |

---

## Pattern Assignments

### `scripts/datamine-vehicle-roles.mjs` (utility, batch)

**Analog:** `scripts/datamine-ship-loadouts.mjs` (223 Zeilen, vollständig gelesen)

**Imports-Muster** (Zeilen 19–23):
```js
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
```
Für den Rollen-Datamine zusätzlich `Localization/german/global.ini` neben `english/global.ini` laden (D-01 fordert DE+EN aus CIG-eigenem `global.ini`) — die Vorlage lädt heute nur `english`; die neue Skript-Variante muss den `EN`-Map-Aufbau (Zeilen 39–41) für DE duplizieren.

**Record-Auswahl + Variantenfilter** (Zeilen 108–118), unverändert zu übernehmen:
```js
const isVariantJunk = (f) => /_ai_|_pu_|_test|_template|_dummy|_unmanned|_hijacked|_turretless|_debug|_showdown_scramble|_swarm|_simpod|_modifiers/i.test(f);
const shipRecs = db.records.filter((r) =>
  db.structs[r.structIndex]?.name === 'EntityClassDefinition' &&
  /\/(spaceships|groundvehicles)\/[^/]+\.xml$/i.test(norm(r.fileName)) && !isVariantJunk(norm(r.fileName)));

const recId = (r) => (r.name || '').replace(/^EntityClassDefinition\./, '').toLowerCase().replace(/_/g, '-');
```
Das ist exakt der in RESEARCH.md §2 verifizierte Join-Weg (`EntityClassDefinition.AEGS_Sabre` → `aegs-sabre`, 223/227).

**Lokalisierung** (Zeilen 39–41):
```js
const EN = new Map();
for (const line of iniEn.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) EN.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase(), line.slice(i + 1)); }
const loc = (k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = EN.get(k.slice(1).toLowerCase()); return v && !/^@|PLACEHOLDER|LOC_EMPTY/.test(v) ? v : null; };
```
(Hinweis: die Zeile enthält ein BOM-Replace-Muster — im Quellcode steht ein literales BOM-Zeichen im Regex, kein Fremdinhalt.)

**Feld-Extraktion für Rollen:** Es gibt keinen 1:1-Analog für das Lesen von `VehicleComponentParams.vehicleCareer`/`.vehicleRole` oder `SSCSignatureSystemParams.radarProperties.baseSignatureParams.signatures`, aber das generische Rekursions-Werkzeug ist bereits vorhanden und sollte wiederverwendet werden (Zeile 42–43):
```js
const findType = (o, rx) => { let r; (function w(x){ if(r!==undefined||!x||typeof x!=='object')return; if(x.__type&&rx.test(x.__type)){r=x;return;} for(const [k,v] of Object.entries(x)){ if(k==='__type')continue; if(v&&typeof v==='object')w(v);} })(o); return r; };
const findKey = (o, key) => { let r; (function w(x){ if(r!==undefined||!x||typeof x!=='object')return; if(x&&key in x){r=x[key];return;} for(const v of Object.values(x)) if(v&&typeof v==='object') w(v);})(o); return r; };
```
`findType(o, /VehicleComponentParams/i)` bzw. `/SSCSignatureSystemParams/i)` liefert die Sub-Objekte, aus denen `vehicleCareer`, `vehicleRole` und `radarProperties.baseSignatureParams.signatures` gelesen werden — analog zu `findType(o, /SEntityComponentDefaultLoadoutParams/i)` in Zeile 124.

**Ausgabe-Konvention** (Zeile 193, an neue Datei/Feldnamen anzupassen):
```js
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), source: 'DataCore Game2.dcb / SEntityComponentDefaultLoadoutParams', count: matched.length, ships: out }, null, 0));
```
→ Für `vehicle-roles.json`: Header-Felder `generatedAt`/`source`/`count` beibehalten (Konvention auch in `ship-loadouts.json`), Body-Key eher `vehicles` als `ships` (Konsistenz mit D-02/Content-Schema-Namen), plus explizites `unmatched: [...]` Array für die 4 ATLS-Einträge (D-03 verlangt Benennung statt stillem Leerlassen — kein Analog dafür nötig, `unmatched`-Array wird bereits Zeile 145/173 lokal geführt und muss nur mit in den Schreib-Aufruf).

**CLI-Argument-Parsing** (Zeilen 27–30), unverändert übernehmbar:
```js
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const AUDIT = argv.includes('--audit');
const ONLY = argOf('--ship');
```

**Audit/Log-Konsolen-Ausgabe** (Zeilen 153–190): Musterhaft für den Nachweis der Join-Rate (223/227) und der Verbundrollen-Zerlegung (D-06) — beim Schreiben der neuen Datei denselben `console.log`-Report-Stil verwenden (Abschnitts-Überschriften `=== … ===`, Top-N-Listen).

---

### `src/data/vehicle-roles.json` (config, batch-output)

**Analoge:** `src/data/ship-loadouts.json` (Schreib-Header-Form, Zeile 193 oben) und `src/data/vehicles-en.json` (Trennungs-Rationale — nicht gelesen, aber Kommentar in `vehicleText.ts` Zeilen 1–5 dokumentiert den Grund):
```
// Freitext-Daten (Beschreibung, Foci) + Enum-Felder (Größe/Status/Typ) pro
// Locale. EN-Beschreibungen liegen sync-sicher in src/data/vehicles-en.json
// (vehicles.json wird per API-Sync neu erzeugt und würde inline-Felder
// überschreiben).
```
Dieselbe Begründung trägt D-02: `vehicle-roles.json` bleibt getrennt von `vehicles.json`, weil `npm run sync:vehicles` Letztere aus der Wiki-API neu erzeugt.

**Erwartete Kopfstruktur** (aus dem Schreibaufruf oben abgeleitet):
```json
{ "generatedAt": "2026-08-02", "source": "DataCore Game2.dcb / VehicleComponentParams", "count": 223, "unmatched": ["argo-atls", "..."], "vehicles": { "<id>": { "career": "...", "role": "...", "roleFamilies": ["..."], "signature": {"ir":0.76,"em":0.76} } } }
```

---

### `src/i18n/vehicleText.ts` (Erweiterung, transform)

**Datei bereits vollständig gelesen** (167 Zeilen). Neue Maps folgen exakt dem bestehenden Muster:

**Map-Vorlage** (Zeilen 14–22, `SIZE_EN`):
```ts
const SIZE_EN: Record<string, string> = {
  Klein: 'Small',
  Mittel: 'Medium',
  'Groß': 'Large',
  Kapitalklasse: 'Capital',
  Beiboot: 'Snub',
  Fahrzeug: 'Vehicle',
};
```
→ D-13 („Deutsche Lücken füllen") wird als neue Map `ROLE_DE_GAPFILL: Record<string, string>` (Rohschlüssel wie `antiair`, `lighttank` → deutscher Text) nach demselben Muster ergänzt, plus `CAREER_DE`/`CAREER_EN`, `ROLE_EN` (analog zu `TYPE_EN`, Zeilen 31–40) und `FAMILY_DE`/`FAMILY_EN` für die 18 Rollenfamilien aus D-05.

**Akzessor-Muster** (Zeilen 122–161, `vType`/`vFoci`/`vRole`):
```ts
export function vType(d: VehicleData, lang: Locale): string | null {
  if (lang === 'en') return d.typeEn ? TYPE_EN[d.typeEn] ?? cap(d.typeEn) : null;
  return d.typeDe ?? null;
}
```
→ Neue Akzessoren `vCareer(d, lang)`, `vRoleCig(d, lang)` (D-11: ersetzt `vRole`/`fociDe` als Kartenbeschriftung, mit `fociDe`-Fallback für die 4 ATLS-Fälle), `vRoleFamily(d, lang)` (gibt Array zurück wegen D-06 Verbundrollen) folgen demselben `lang === 'en' ? … : …`-Zweig.

**Wichtig:** Die neuen Felder kommen NICHT aus der `vehicles`-Collection (`VehicleData`/`CollectionEntry<'vehicles'>`), sondern aus der separat geladenen `vehicle-roles.json` (D-02). Die Akzessor-Signatur muss daher entweder die Rollen-Datei zusätzlich importieren (wie `vehiclesEn` in Zeile 7) oder eine zweite Parameterquelle annehmen — Entscheidung liegt beim Planer/Implementierer, aber das Importmuster ist:
```ts
import vehiclesEn from '../data/vehicles-en.json';
```
→ analog: `import vehicleRoles from '../data/vehicle-roles.json';`

---

### `src/components/ships/ShipsOverview.astro` (component, Ein-Körper DE+EN)

**Analog:** `src/components/topics/crafting.astro` (Ausschnitt gelesen, Zeilen 1–80) + Hüllen `src/pages/topics/crafting.astro`, `src/pages/de/topics/crafting.astro` (vollständig gelesen).

**Lang-Ermittlung im Körper** (Zeilen 14–17 von `crafting.astro`):
```astro
---
import { localeFromPath } from '../../i18n/ui';
const lang = localeFromPath(Astro.url.pathname);
const de = lang === 'de';
---
```
Dieses Muster ist die Grundlage für D-12. `ShipsOverview.astro` läge unter `src/components/ships/`, Importpfad-Tiefe entsprechend anpassen (`../../i18n/ui` bleibt gleich, da gleiche Verzeichnistiefe wie `components/topics/`).

**Bedingter Text — Kurzform** überall im Körper (`{de ? 'Text DE' : 'Text EN'}`), siehe Zeilen 53, 61–66 von `crafting.astro`. Für Attribut-Text mit `set:text` (Astro-5.18-Falle, siehe unten).

**⚠ Astro-5.18-Compiler-Falle:** Der Kommentar am Dateikopf von `crafting.astro` (Zeilen 4–5) verweist ausdrücklich darauf:
```
// Ein Element auf OBERSTER Ebene darf keinen {ausdruck} als Kind haben —
// Astro 5.18 verschluckt sonst dessen schließendes Tag (siehe Sprungmarke).
```
Belegter Workaround im selben Körper (Zeile 50):
```astro
<a class="skip" href="#main" set:text={de ? 'Zum Inhalt springen' : 'Skip to content'} />
```
und (Zeile 73) `<Fragment set:html={...} />` für gemischten HTML/Text-Inhalt mit `&amp;`-Entities. **Für `ShipsOverview.astro` bedeutet das:** Jedes Element, das direkt (ohne umschließendes Geschwister-Element) auf oberster Template-Ebene steht und dessen einziger Kindinhalt ein `{ausdruck}` ist, muss `set:text={ausdruck}` statt `>{ausdruck}<` verwenden — betrifft voraussichtlich die Filterkonsolen-Labels/Chips, falls sie topLevel stehen (die Fleet-Grid-Karten selbst sind bereits von einem `<article>`-Wrapper umschlossen wie im heutigen `schiffe.astro`, dort unkritisch).

**Style-Block-Konvention** (Zeilen 28–31 von `crafting.astro`, exakt wie im heutigen `schiffe.astro` Zeilen 49–58):
```astro
<style is:inline>
:root{--bg:#...; ...}
/* Hellmodus — erzeugt von scripts/build-light-palettes.mjs. Nicht von Hand ändern. */
:root[data-theme="light"]{...}
</style>
```
**Kritische Folge für D-12 (Ein-Körper-Migration):** Der komplette `<style is:inline>`-Block aus `schiffe.astro`/`de/schiffe.astro` (heute je einmal pro Sprachkopie, Zeilen 49–215 in `schiffe.astro`) wandert **komplett** in `ShipsOverview.astro` — inklusive des generierten `:root[data-theme="light"] …`-Blocks. Dieser Block wird NICHT von Hand geschrieben; er entsteht aus dem dunklen `:root{...}`-Block über `npm run theme` (Generatoren `scripts/build-light-palettes.mjs` für den `:root`-Block und `scripts/build-light-overrides.mjs` für die punktuellen `:root[data-theme="light"] .selektor{...}`-Overrides am Dateiende, siehe Zeile 212–214 des heutigen `schiffe.astro`). Nach dem Verschieben des Stilblocks in den gemeinsamen Körper **muss `npm run theme` erneut laufen**, damit beide Generatoren den Block an seinem neuen Ort (einmal statt zweimal) korrekt wiederfinden und aktualisieren — sonst bleibt der alte, jetzt verwaiste Hellmodus-Block in den (dann gelöschten) Seiten-Kopien stehen bzw. fehlt im neuen Körper. Zusätzlich laut Projektgedächtnis: der `versioned()`-Sha1 memoisiert — nach Asset-/Stil-Änderung den Dev-Server neu starten.

**Mobil-CSS-Falle** (Kommentar Zeilen 166–170 im heutigen `schiffe.astro`):
```
/* Die Mobil-Kuerzung dieser Pille steht NICHT hier, sondern in
   assets/mobile-ux.css. Grund: src/pages/de/schiffe.astro ist eine eigene
   Kopie dieser Seite mit einer eigenen Kopie dieses CSS-Blocks — eine
   Aenderung hier greift nur auf der englischen Seite. */
```
Nach der Ein-Körper-Migration entfällt dieser Grund — sollte im neuen Körper als erledigt/obsolet vermerkt werden, aber `assets/mobile-ux.css`-Selektoren müssen weiterhin auf die (unveränderten) Klassennamen zeigen.

**Hüllen-Muster** (vollständig, `src/pages/topics/crafting.astro`, 15 Zeilen):
```astro
---
import DB from '../../../assets/crafting-db.json';
import { versioned } from '../../lib/assetVersion';
const total = DB.counts.blueprints;
const ver = DB.version;
const patch = (ver.match(/(\d+\.\d+)/) ?? [])[1] ?? '4.9';
import Layout from '../../layouts/Layout.astro';
import Body from '../../components/topics/crafting.astro';
---
<Layout title={`Crafting Database — Star Citizen ${patch} | VerseBase`} description={`...`} themeColor="#16161a" ogType="article" ogImage="/assets/t-craft-1.jpg" translated={true}>
<link slot="head" rel="stylesheet" href={versioned('assets/detail.css', '/assets/detail.css')} />
<Body />
</Layout>
```
DE-Hülle (`src/pages/de/topics/crafting.astro`) ist identisch bis auf Importpfad-Tiefe (`../../../` statt `../../`) und deutschen `title`/`description`. **Für `schiffe.astro`/`de/schiffe.astro`:** Layout-Aufruf-Parameter (`themeColor`, `ogImage`, `footer`, `hasEn`) aus dem heutigen `schiffe.astro` (Zeilen 41–48) übernehmen; `<Body />` ersetzt den kompletten `<main class="sdb">…</main>`-Body plus `<script is:inline>`-Block.

---

### Client-seitiges Filtern über `data-*`-Attribute (event-driven, DOM)

**Analog:** aktuelles Inline-Skript in `src/pages/schiffe.astro`, Zeilen 338–403 (wandert 1:1 in den neuen Körper).

**Card-Datenmodell** (Zeilen 268–280):
```astro
<article class="fcard"
  data-q={`${d.name} ${d.manufacturer ?? ''}`.toLowerCase()}
  data-maker={d.manufacturer ?? ''}
  data-type={vType(d, lang) ?? ''}
  data-status={d.statusEn ?? ''}
  data-archive={d.patches.length ? '1' : ''}
  ...
>
```
→ Neue Attribute nach demselben Muster: `data-career`, `data-role` (exakte Rolle), `data-rolefam` (D-06 Verbundrollen — **mehrere Werte pro Karte**, z. B. `data-rolefam="einsteiger leichter-frachter"` getrennt durch Leerzeichen, damit der Filter mit `indexOf`/`split` mehrere Familien pro Schiff matchen kann — kein direkter Analog im bestehenden Code, da `data-type`/`data-maker` heute nur EIN Wert pro Attribut führen; nächstliegendes Muster ist `data-q` als raumgetrennter Suchstring, Zeile 351–357 unten), `data-sig` (numerischer Signaturwert wie `data-pledge`/`data-cargo`, Zeilen 276–279, per `numAttr()` gelesen).

**Filter-Funktion `apply()`** (Zeilen 359–375):
```js
function apply() {
  var nq = norm(q.value).trim();
  var m = selMaker.value, t = selType.value, st = selStatus.value, ar = selArchive.value;
  var n = 0;
  cards.forEach(function (c) {
    var ok =
      (!nq || norm(c.getAttribute('data-q')).indexOf(nq) >= 0) &&
      (!m || c.getAttribute('data-maker') === m) &&
      (!t || c.getAttribute('data-type') === t) &&
      (!st || c.getAttribute('data-status') === st) &&
      (!ar || c.getAttribute('data-archive') === ar);
    c.style.display = ok ? '' : 'none';
    if (ok) n++;
  });
  count.textContent = n + ' results';
  empty.hidden = n !== 0;
}
```
→ Erweitern um `(!fam || c.getAttribute('data-rolefam').indexOf(fam) >= 0)` (Teilstring-Match für Mehrfachwerte, D-06) und `(!sig || Number(c.getAttribute('data-sig')) < sigThreshold)` (D-07/Claude's-Discretion Stufen-vs-Schieber).

**Numerische Attribut-Hilfsfunktion** (Zeile 354–357), wiederverwendbar für die Signaturzahl:
```js
var numAttr = function (el, name) {
  var v = parseFloat(el.getAttribute(name));
  return isNaN(v) ? -1 : v;
};
```

**Schnellzugriff-Chips (D-10):** Kein direkter Analog im bestehenden Filterskript — nächstliegendes Muster ist der Listener-Aufbau am Dateiende (Zeilen 389–393):
```js
[q, selMaker, selType, selStatus, selArchive].forEach(function (el) {
  el.addEventListener('input', apply);
  el.addEventListener('change', apply);
});
```
Chips würden Klick-Listener registrieren, die `selRole.value`/`selSig.value` direkt setzen und danach `apply()` aufrufen — gleiches Prinzip wie oben, kein neues Idiom nötig.

---

### Verifikationsskript (Claude's Discretion, batch/test)

**Analoge:** `scripts/verify-hardpoints.mjs` (vollständig gelesen, 141 Zeilen) und `scripts/verify-mining.mjs` (Name genannt, nicht zusätzlich gelesen — gleiches Verzeichnis/Muster).

**Aufbau-Muster** (aus `verify-hardpoints.mjs`):
- Lädt die Datamine-Ausgabe UND eine unabhängige Vergleichsquelle (dort `ship-hardpoints.json` vs. `vehicles.json`), Zeilen 15–17:
```js
const hp = JSON.parse(readFileSync(new URL('../src/data/ship-hardpoints.json', import.meta.url), 'utf8'));
const veh = JSON.parse(readFileSync(new URL('../src/data/vehicles.json', import.meta.url), 'utf8'));
const vById = new Map(veh.vehicles.map((v) => [v.id, v]));
```
- Baut Abweichungs-/Auffälligkeits-Listen und gibt sie in strukturierten Konsolen-Abschnitten aus (`=== A) … ===`, `=== B) … ===`), Zeilen 75–94.
- Schließt mit einer Ein-Zeilen-Zusammenfassung, Zeile 140.

**Für den neuen Vehicle-Roles-Verify:** Vergleichsbasis wäre `src/data/vehicle-roles.json` gegen `vehicles.json` (Join-Rate 223/227 wie in RESEARCH.md §2 belegt bestätigen) plus eine Prüfung, dass jede der 18 Familien aus D-05 mindestens 1 Schiff trägt und dass alle in D-06 genannten Verbundrollen tatsächlich in ≥2 Familien auftauchen. **Einhängung:** kein zentraler `npm run verify`-Sammelaufruf für diese Skript-Familie — `scripts/verify-hardpoints.mjs`, `scripts/verify-mining.mjs`, `scripts/verify-vendor-three.mjs`, `scripts/verify-item-prices.mjs` sind alle eigenständige `npm run verify:<name>`-Einträge in `package.json` (Zeilen 12, 20, 37); `npm run verify` (`scripts/_verify.mjs`) ist ein anderes, generisches Werkzeug (Link-/Asset-Integritätsprüfung über `dist/`, prüft NICHT Datamine-Snapshots). Der neue Verify gehört als eigener `"verify:vehicle-roles": "node scripts/verify-vehicle-roles.mjs"`-Eintrag neben die bestehenden Geschwister, nicht in `_verify.mjs`.

---

## Shared Patterns

### DataCore-Zugriff (P4k + Parser)
**Quelle:** `scripts/lib/p4k.mjs` (`openP4k`, `DEFAULT_P4K`), `scripts/lib/datacore.mjs` (`openDataCore`)
**Gilt für:** `datamine-vehicle-roles.mjs`
```js
const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
p4k.close();
const db = openDataCore(dcb);
```

### Ein-Körper DE+EN + Lang-Ermittlung
**Quelle:** `src/i18n/ui.ts` (`localeFromPath`), Muster in `src/components/topics/crafting.astro`
**Gilt für:** `ShipsOverview.astro` + beide `schiffe.astro`-Hüllen

### Hellmodus-Generierung — NIE von Hand anfassen
**Quellen:** `scripts/build-light-palettes.mjs` (generiert den `:root[data-theme="light"]{...}`-Block aus dem `:root{...}`-Block), `scripts/build-light-overrides.mjs` (generiert punktuelle `:root[data-theme="light"] .selektor{...}`-Overrides am Dateiende), Sammelbefehl `npm run theme`.
**Gilt für:** `ShipsOverview.astro` — nach dem Verschieben des Stilblocks aus den zwei Seiten-Kopien in den gemeinsamen Körper zwingend `npm run theme` neu laufen lassen; Dev-Server danach neu starten (Asset-Sha1-Memoisierung).

### Astro-5.18-Compiler-Falle
**Quelle:** Projektgedächtnis + belegter Workaround in `src/components/topics/crafting.astro` Zeile 50 (`set:text`) und Zeile 73 (`<Fragment set:html={...} />`).
**Gilt für:** `ShipsOverview.astro`, überall wo ein Element auf oberster Template-Ebene direkt einen `{ausdruck}` als einziges Kind hätte.

### Client-Filter über `data-*`-Attribute
**Quelle:** `src/pages/schiffe.astro` Zeilen 338–403 (`apply()`, `sort()`, `numAttr()`, `norm()`)
**Gilt für:** Filterkonsole in `ShipsOverview.astro`

---

## No Analog Found

| Datei/Aspekt | Rolle | Datenfluss | Grund |
|---|---|---|---|
| DE-Lokalisierung im Datamine (`Localization/german/global.ini` parallel zu `english`) | utility | batch | `datamine-ship-loadouts.mjs` lädt nur EN; die parallele DE-Ladung + Map ist neu zu bauen (Muster aus Zeilen 39–41 aber 1:1 duplizierbar) |
| Mehrwertiges `data-rolefam`-Attribut mit Teilstring-Match (Verbundrollen, D-06) | markup/event-driven | — | Bestehende `data-*`-Attribute im Filterskript sind alle einwertig; nächstliegend ist `data-q` als Suchstring-Muster, aber kein exakter Vorläufer für Mehrfach-Filterwerte |
| Schnellzugriff-Chips, die zwei Filterachsen gleichzeitig setzen (D-10) | component/event-driven | — | Keine existierende Chip-Leiste dieser Art auf `schiffe.astro`; muss aus dem bestehenden Listener-/`apply()`-Muster neu zusammengesetzt werden |

## Metadata

**Analog-Suchraum:** `scripts/`, `scripts/lib/`, `src/data/`, `src/i18n/`, `src/components/topics/`, `src/components/patches/`, `src/pages/`, `src/pages/de/`, `src/content.config.ts`
**Durchsuchte/gelesene Dateien:** `scripts/datamine-ship-loadouts.mjs`, `scripts/verify-hardpoints.mjs`, `src/i18n/vehicleText.ts`, `src/i18n/ui.ts` (Ausschnitt), `src/content.config.ts`, `src/pages/schiffe.astro`, `src/pages/de/schiffe.astro` (Ausschnitt), `src/components/topics/crafting.astro` (Ausschnitt), `src/pages/topics/crafting.astro`, `src/pages/de/topics/crafting.astro`, `package.json` (Skript-Sektion)
**Erhebungsdatum:** 2026-08-02
