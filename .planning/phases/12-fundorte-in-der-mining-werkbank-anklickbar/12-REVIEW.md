---
phase: 12-fundorte-in-der-mining-werkbank-anklickbar
reviewed: 2026-08-15T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - assets/mining-workbench.js
  - src/components/MiningWorkbench.astro
  - src/i18n/help.ts
  - scripts/probes/mining-locview-messung.mjs
  - scripts/probes/README.md
  - tests/e2e/helpers/mining-dom.js
  - tests/e2e/mining-shortlist.test.js
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-08-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Geprüft wurde ausschließlich der Diff gegen `e20c56c` (Fundort-Ansicht in der
Mining-Werkbank: Erz-Ansicht ⇄ Fundort-Ansicht, `?fundort=`-Tieflink,
Kachel-Markierung, Spurenerz-Dämpfung).

Der geänderte Code ist ungewöhnlich sorgfältig gebaut und macht die neun
projektspezifischen Prüfpunkte im Auftrag fast durchgängig richtig:

- **Klick-Vorrang** (Nadel vor Zeile) ist korrekt über die Reihenfolge der
  `closest()`-Abfragen gelöst, nie über `stopPropagation()`, und durch
  `T-12-03`/`T-12-12`/`T-12-13` in `tests/e2e/mining-shortlist.test.js`
  end-to-end nachgewiesen — ein Nadelklick öffnet nie die Fundort-Ansicht.
- **Stationszeilen bleiben inert**: `row2()` bekommt für `#wb-refs` nie das
  achte `opts`-Argument, also nie `data-loc`/`data-ore`; `T-12-11` prüft das
  explizit gegen eine echte Stationszeile.
- **`?fundort=`** wird gegen die vorhandenen `locIndex`-Schlüssel
  abgeglichen, setzt `S.selLoc` auf den KANONISCHEN (nie den eingegebenen)
  Wert, fällt bei Nichttreffer still auf die Erz-Ansicht zurück und schreibt
  den rohen Parameterwert nachweislich nirgends ins Markup (`T-12-16` /
  `T-12-17`, inklusive eines `<script>`-Payloads als Gegenprobe).
- **Chance statt Erwartungswert** in der Fundort-Ansicht: Sortierung, Balken
  und rechter Zahlenwert hängen dort ausschließlich an `ch`, die Erz-Ansicht
  bleibt unangetastet bei `ef` — durch `T-12-04` erzwungen.
- **Spurendämpfung** läuft ausschließlich über `color`/`opacity`, nie über
  `background` — sowohl in der Zeile selbst als auch beim Abzeichen (letzteres
  über tokenisiertes `var(--muted)`, das bereits über die Theme-Schicht
  mitzieht statt eine eigene `build-light-overrides.mjs`-Regel zu brauchen).
- **DE/EN-Parität**: `backToOre`/`trace` stehen in beiden `S_DE`/`S_EN`, durch
  `assertMiningLangParity()` erzwungen; dieselbe Parität gilt für die beiden
  geänderten `help.ts`-Texte.
- **Zustandshaltung**: `view`/`selLoc` sind bewusst von `save()` ausgenommen,
  ein Neuladen ohne Parameter fällt sauber auf die Erz-Ansicht zurück; ein
  unbekannt gewordener `S.selLoc` degradiert in `renderLocation()` graceful
  (siehe IN-01 unten zur Erreichbarkeit dieses Zweigs).
- **Die Messsonde** `scripts/probes/mining-locview-messung.mjs` kann echt rot
  werden (`process.exitCode = 1` bei Fehlschlag ODER bei übersprungenen
  Messpunkten) und rechnet mit belegten, nicht großzügig gewählten
  Schwellwerten (WCAG 4,5:1, nicht die entspannte 3:1-Marke für großen Text).

Zwei Befunde bleiben trotzdem stehen — beide WARNING, kein BLOCKER:

## Warnings

### WR-01: `locIndex` ist eine reine Objekt-Map ohne Schutz vor Prototyp-Namen

**File:** `assets/mining-workbench.js:39-48`, ausgewertet in `assets/mining-workbench.js:1167-1173`

**Issue:** `locIndex` wird als `{}` angelegt und ausschließlich über
`(locIndex[l0.p] || (locIndex[l0.p] = [])).push(...)` befüllt (Zeile 44).
Trüge ein Fundort in den Spieldaten jemals wörtlich den Namen `__proto__`,
würde `locIndex['__proto__']` NICHT eine neue Eigenschaft anlegen, sondern
über den geerbten `__proto__`-Accessor tatsächlich `Object.prototype`
zurückliefern (ein wahrheitswertig „truthy" Objekt) — der anschließende
`.push(...)`-Aufruf würde also eine Eigenschaft direkt auf
`Object.prototype` anlegen und damit **jede** spätere `for...in`-Schleife
im gesamten Skript-Kontext der Seite verunreinigen, nicht nur diese Datei.

Der Abgleich in `fromQueryLoc()` (Zeile 1172: `for (var p in locIndex) if
(p.toLowerCase() === key) …`) iteriert zudem über *alle* enumerierbaren
Eigenschaften von `locIndex` — bei einer verunreinigten `Object.prototype`
liefe diese Schleife über Eigenschaften, die gar keine echten Fundorte sind.

Die Angriffsfläche über den öffentlichen `?fundort=`-Parameter selbst ist
nicht gegeben (die Schleife *liest* nur vorhandene Schlüssel, sie schreibt
keine neuen), das Risiko hängt also an den Namen in den kuratierten
Spieldaten, nicht an Nutzereingaben. Es ist damit aktuell theoretisch
(kein Fundort heißt heute `__proto__`), aber unbewacht — genau die Art
Annahme, die dieses Projekt laut `.planning`-Historie schon einmal teuer
bezahlt hat (stille Datenannahmen statt geprüfter Garantien). `byName`
(vorbestehend, nicht Teil dieser Phase) trägt dieselbe Schwäche.

**Fix:**
```js
// statt var locIndex = {};
var locIndex = Object.create(null);
```
Das entschärft `__proto__`-Namenskollisionen vollständig, ohne die restliche
Logik (Iteration, `for...in`, `locIndex[l0.p] || (locIndex[l0.p] = [])`)
anzufassen — `Object.create(null)` verhält sich für alle bestehenden
Zugriffsmuster identisch, nur ohne geerbten Prototyp.

---

### WR-02: Neu verschachtelte interaktive Elemente (a11y-Regression)

**File:** `assets/mining-workbench.js:352` (Fundort-Zeile in `#wb-locs`), `assets/mining-workbench.js:567` (Merklisten-Zeile in `#wb-locpins`)

**Issue:** Phase 12 macht zwei bestehende Zeilentypen zusätzlich klickbar,
indem sie `role="button" tabindex="0"` auf den äußeren Container legt:

- Zeile 352: `<div class="wb__row2" data-loc="…" role="button"
  tabindex="0">` — diese Zeile trägt (weil `pinKey` gesetzt ist) bereits
  einen echten `<button data-locpin="…">` als Kind (row2(), Zeile 284-289).
- Zeile 567: `<div class="wb__pin-item" data-loc="…" role="button"
  tabindex="0">` — enthält ebenfalls einen echten `<button
  data-locpin="…">×</button>` als Kind.

Damit entsteht in beiden Fällen ein `role="button"`-Element, das ein
weiteres fokussierbares/interaktives Element (`<button>`) UMSCHLIESST —
ein klassischer „nested interactive controls"-Verstoß (WCAG 4.1.2, von
axe-core als `nested-interactive` geführt). Screenreader- und
Tastatur-Nutzung wird dadurch nicht falsch (die JS-Rangfolge fängt Klicks
korrekt ab, siehe `T-12-03`/`T-12-13`), kann aber inkonsistent sein: manche
Hilfstechnologien kündigen den äußeren „Button" an und blenden den
inneren de facto aus, andere lassen beide Tab-Stopps entstehen, was beim
Durchtabben zwei Ziele für ein und dieselbe Zeile erzeugt.

Das Muster ist nicht neu erfunden — `.wb__tile` (Spalte 1, unverändert von
dieser Phase) hat exakt dieselbe Form (`role="button" tabindex="0"` auf dem
äußeren `div`, `<button class="wb__pin">` als Kind) und wurde offenbar
akzeptiert. Phase 12 verdoppelt diese Kompromisslösung aber auf zwei
weitere, neue Stellen, statt sie einmalig zu beheben oder bewusst als
Konvention festzuschreiben.

**Fix:** Entweder die Konvention explizit dokumentieren (ein Kommentar an
`row2()`, der begründet, warum verschachtelte Interaktivität hier in Kauf
genommen wird — analog zu den bereits vorhandenen Kommentaren zu
Klick-Vorrang), oder strukturell auflösen, z. B. indem der äußere
Container `role="button"` nur trägt, wenn KEIN `pinKey` gesetzt ist
(reine `[data-ore]`-Zeilen in der Fundort-Ansicht betrifft das ohnehin
nicht, dort gibt es keinen verschachtelten Button):
```js
// row2(): role/tabindex nur, wenn die Zeile KEINEN eigenen Button traegt
var attrs = pinKey
  ? o.attrs.replace(' role="button" tabindex="0"', '')
  : o.attrs;
```
oder äquivalent beim Aufrufer die `attrs`-Zusammensetzung von `pinKey`
abhängig machen.

## Info

### IN-01: Unerreichbarer Verteidigungszweig in `renderLocation()`

**File:** `assets/mining-workbench.js:427-438`

**Issue:** Der Kommentar (Zeile 427-430) begründet den Zweig damit, dass
`S.selLoc` „nach einem Datenlauf, der den Ort entfernt hat" ungültig
werden könnte. Alle drei tatsächlichen Schreibstellen von `S.selLoc` sind
aber bereits gegen `locIndex` bzw. `locPinValid()` (die auf derselben
Datenquelle basiert) geprüft, bevor sie zuschlagen:

- Klick auf `[data-loc]` (Zeile 1050 im `document.click`-Handler): der
  Wert kommt aus einem server-gerenderten `data-loc`-Attribut, das nur aus
  echten `locIndex`-Schlüsseln erzeugt wird.
- Klick auf eine Merklisten-Zeile (`renderLocPins()`): ebenfalls aus
  bereits über `locPinValid()` gefiltertem `S.locPins`.
- `fromQueryLoc()` (Zeile 1172): setzt `S.selLoc` ausdrücklich nur bei
  einem *Treffer* gegen `locIndex`.

Da die Werkbank ihre Daten einmalig inline lädt (kein Nachladen, kein
Hot-Swap zur Laufzeit), kann `locIndex[S.selLoc]` zum Zeitpunkt des
Aufrufs von `renderLocation()` in der aktuellen Code-Basis nie „leer"
werden, nachdem es einmal gültig gesetzt wurde. Der Zweig ist damit
faktisch totes Verteidigungscode — nicht falsch, aber ohne aktuell
erreichbaren Pfad und ohne Testfall, der ihn triggert.

**Fix:** Kein Handlungsbedarf im Sinne eines Bugs. Falls die Absicht
tatsächlich zukünftige Datenläufe zur Laufzeit ist, würde sich das mit
einem Kommentar klarer fassen lassen ("aktuell unerreichbar, Schutz für
eine denkbare künftige Nachlade-Funktion"), oder der Zweig ließe sich mit
einem einzigen `node:test`-Fall (`S.selLoc` manuell auf einen ungültigen
Wert setzen, `renderAll()` aufrufen) tatsächlich abdecken, statt
unbelegt zu bleiben.

---

_Reviewed: 2026-08-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
