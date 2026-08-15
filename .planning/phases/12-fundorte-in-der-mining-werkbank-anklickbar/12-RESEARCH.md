# Phase 12: Fundorte in der Mining-Werkbank anklickbar - Research

**Recherchiert:** 2026-08-15
**Domäne:** Client-seitige Astro/Vanilla-JS-Werkbank (kein neues Werkzeug, keine neue Route)
**Konfidenz:** HIGH

<user_constraints>
## Nutzer-Vorgaben (aus 12-CONTEXT.md)

### Gesperrte Entscheidungen

- **D-01: Die ganze Fundort-Zeile ist das Klickziel**, nicht nur der Name.
  Die Anheft-Nadel bleibt ein eigener Klickbereich innerhalb der Zeile.
  `row2()` (`assets/mining-workbench.js:212`) rendert Fundort- **und**
  Stationszeilen; Stationszeilen dürfen **nicht** mitklickbar werden (der
  siebte Parameter `pinKey` wird nur vom Fundort-Aufruf übergeben).
- **D-02: Die Erzzeilen INNERHALB der Fundort-Ansicht sind ihrerseits
  klickbar** und führen zu diesem Erz. Zusätzlich immer ein Zurück-Pfeil im
  Kopf der Spalte.
- **D-03: Die Fundort-Merkliste rechts (`#wb-locpins`) trägt denselben
  Klick.** Die Merklistenzeile trägt bereits ein `data-locpin`-Element zum
  Lösen; die bestehende Vorrangordnung des delegierten Handlers darf nicht
  aufgeweicht werden.
- **D-04: Die Ansicht ist per Adresse aufrufbar** (`?fundort=<Name>`),
  dieselbe Mechanik wie das bestehende `?mineral=`. Reversibility: costly —
  die Adresse ist ab Auslieferung eine öffentliche Zusage.
- **D-05: Immer nach Abbaumethode gruppieren**, auch bei den 20 der 45
  Fundorte mit nur einer Methode. `methodLabel()` fasst `fps`/`hand`
  bewusst zu „Hand" zusammen — unverändert weiter gültig.
- **D-06: Rechts an der Erzzeile steht die CHANCE**, nicht der
  Erwartungswert. Balken und Sortierung folgen derselben Größe, relativ zur
  höchsten Chance DIESES Ortes. Bewusst asymmetrisch zur Erz-Ansicht
  (rangiert nach `eff`).
- **D-07: Spurenerze bleiben an ihrer sortierten Stelle**, gedämpft und mit
  Abzeichen „Spur", kein eigener Abschnitt. Schwelle: Höchstanteil ≤ 10 %
  (gemessen: 171 von 521 Paaren ≤10 %, 350 >50 %, nichts dazwischen).
- **D-08: Keine Scan-Signatur in der Erzzeile** — Spalte 3 leistet das
  bereits.
- **D-09: Die Kachelspalte hebt die Erze dieses Ortes hervor**, alle 37
  Kacheln bleiben stehen (kein Filter).
- **D-10: Die Fußzeile bleibt unverändert** (Stationswahl,
  Fracturing-Verweis) — gehört zum Werkzeug, nicht zur Ansicht.
- **D-11: Der Kopf der Mittelspalte zeigt** Ortsname, darunter Art · System
  und Anflugpunkte, links Zurück-Pfeil. Signaturkasten und großer
  Anheft-Knopf entfallen — ein Ort allein ist nicht anheftbar (nur Paare
  „Erz — Ort"). Ausdrücklich verworfen: den Anheft-Knopf mit
  „letztes Erz an diesem Ort" umzuwidmen.

### Claudes Ermessen

- Zustand beim Neuladen — Vorschlag: Adresse gewinnt (`?fundort=` öffnet die
  Ansicht), `localStorage` merkt sich die Ansicht **nicht**, wie `?mineral=`
  es heute hält.
- Bezeichner der Zustandsvariablen, Aufbau der Umschaltung (eigene
  Render-Funktion neben `renderDetail()` gegen Verzweigung innerhalb),
  Übergangsanimation, genaue Dämpfungswerte der Spurenzeilen.
- Wortlaut der deutschen und englischen Beschriftungen — die
  Build-Zeit-Paritätsprüfung fängt einseitige Schlüssel ohnehin ab.

### Zurückgestellte Ideen (AUSSER SCOPE)

- **Eigene Fundort-Seiten** (45 × DE/EN = 90 statische Seiten) — vorgelegt
  und vom Betreiber zugunsten der reinen Werkbank-Umschaltung verworfen.
  `?fundort=` (D-04) wäre die Brücke dorthin, falls später gebraucht.
- **Preis am Fundort** — bewusst draußen, scmdb zeigt auf seiner
  Fundort-Seite selbst keinen Preis.
- **Adernzahl je Erz und Fundort** — bräuchte eine Erweiterung der
  Extraktion, eigene Datenphase.
- **Salvage- und Debris-Vorkommen** je Fundort — anderes Sachgebiet.
- **Gruppenanteile im scmdb-Stil** — rechnen Derelict Salvage/Debris mit,
  diese Grundmenge führen wir nicht.

**Explizit NICHT in dieser Phase:** eigene Fundort-Seiten/-Routen, Preise,
Gruppenanteile im scmdb-Stil, Adernzahlen, Änderungen an der
Datenextraktion (`scripts/datamine-locations.mjs` bleibt unangetastet).
</user_constraints>

## Summary

Diese Phase braucht **keine neue Bibliothek, keinen neuen Datenlauf und keine
neue Datei**. Alles, was der Fundort-Ansicht fehlt, ist bereits im
ausgelieferten Payload vorhanden — nur nicht in der Richtung gespiegelt, in
der sie gebraucht wird. Der wichtigste Fund dieser Recherche korrigiert eine
Annahme aus `12-CONTEXT.md`: **`DB.bodies` muss NICHT an den Client gehen.**
Jede Zeile in `mining-db.json` → `bodies[].minerals[]` (Name, Chance,
Höchstanteil, Erwartungswert, Abbaumethode, Anflugpunkte) steht bereits
byte-identisch in `mining-db.json` → `minerals[].locations[]`, weil
`scripts/datamine-locations.mjs` beide Sichten aus derselben aggregierten
Menge baut (Zeilen 189-215) und `scripts/verify-mining.mjs` Zusicherung 9
(Zeilen 60-88) beide Sichten gegeneinander hält — ein Datenlauf, der sie
auseinanderlaufen lässt, bricht das Tor. Der bereits an den Client gesendete
`payload.minerals[].locs`-Baum (`MiningWorkbench.astro:94-100`) trägt Ort
(`p`), System (`s`), Art (`t`), Methode (`mi`), Chance (`ch`), Höchstanteil
(`ms`), Erwartungswert (`ef`) und Anflugpunkte (`pt`) — alles, was die
Fundort-Ansicht braucht. Ein Fundort-Index ("welche Erze gibt es an DIESEM
Ort?") lässt sich daraus **client-seitig in einer Schleife über die bereits
vorhandenen 37 Minerale** aufbauen, genau wie `byName` es heute schon für
Minerale tut (`assets/mining-workbench.js:27-28`). Das spart **~55 KB**
zusätzliches Inline-JSON pro Seite (gemessen, siehe unten) und eine zweite
Datenquelle, die mit der ersten synchron gehalten werden müsste.

Der zweite Fund betrifft die Klick-Mechanik: Diese Werkbank hat bereits **drei
funktionierende Präzedenzfälle** für "eine ganze Zeile ist klickbar, aber ein
verschachteltes Element in ihr hat eine eigene, konkurrierende Bedeutung" —
Kachel + Anheft-Knopf (`.wb__tile` / `.wb__pin`), Fundort-Zeile + Nadel
(`.wb__row2` / `.wb__lpin`), Preset-Zeile + Umbenennen-Stift
(`[data-pre-pick]` / `[data-pre-rename]`). Alle drei lösen den Konflikt über
**Reihenfolge im delegierten `document`-Click-Handler**, nicht über
`stopPropagation()`: die spezifischere `closest()`-Abfrage steht im Code vor
der allgemeineren, und ein `return` nach dem Treffer verhindert das
Durchfallen. Die neue Zeilen-Klickbarkeit (D-01) reiht sich in exakt dieses
Muster ein — kein neues Verfahren.

**Primäre Empfehlung:** `bodies[]` bleibt ungesendet; ein `locIndex` (Map
Ortsname → sortierte Erzliste) wird beim Laden aus `D.minerals` aufgebaut,
dieselben Formatierfunktionen (`pctSub`, `pctRight`, `locSub`, `methodLabel`)
werden für Fundort- UND Erz-Ansicht wiederverwendet, und der neue Klick reiht
sich unmittelbar nach dem bestehenden `[data-locpin]`-Zweig (Zeile 853-867) in
den delegierten Handler ein, bevor `[data-pin]` und `.wb__tile` geprüft werden.

## Architectural Responsibility Map

| Fähigkeit | Primäre Ebene | Sekundäre Ebene | Begründung |
|-----------|---------------|-----------------|------------|
| Fundort-Index (Ort → Erzliste) | Browser/Client (`mining-workbench.js`) | — | Daten liegen bereits im Payload; kein Server-/Build-Aufwand nötig, reine Ableitung zur Laufzeit |
| Ansichtsumschaltung (Erz ↔ Ort) | Browser/Client | — | Reiner UI-Zustand, kein Server-Zustand, kein Neuladen |
| Deep-Link `?fundort=` | Browser/Client (liest `location.search`) | Astro (liefert dieselbe Payload für jeden Aufruf) | Astro rendert immer die volle Werkbank; welcher Zweig aktiv ist, entscheidet erst der Client — identisch zum bestehenden `?mineral=`-Muster |
| Übersetzungstexte (DE/EN) | Astro (`S_DE`/`S_EN` in `MiningWorkbench.astro`) | — | Build-Zeit-Paritätsprüfung `assertMiningLangParity()` läuft bereits dort |
| Werkzeug-Hilfe (`data-help`) | Astro (`src/i18n/help.ts`) + Markup | `scripts/verify-help.mjs` (Gate) | Bestehender Vertrag, ein Text wird nur inhaltlich nachgezogen |
| Datengrundlage (Chance/Höchstanteil/Erwartungswert) | Build-Zeit (`scripts/datamine-locations.mjs` → `mining-db.json`) | `scripts/verify-mining.mjs` (Gate) | Explizit **unverändert** laut Phasengrenze — nur Lesezugriff |

Es gibt in dieser Phase **keine** Backend-/API-Ebene und **keine** neue
CDN/Static-Ebene — alles bleibt innerhalb der bereits gebauten
Astro-Insel + Vanilla-JS-Insel.

## Standard Stack

Keine neue Bibliothek, kein neues Paket. Die Werkbank ist bewusst
handgeschriebenes ES5-IIFE ohne Build-Schritt
(`.planning/codebase/CONVENTIONS.md` § "Module system": `assets/*.js` sind
die Ausnahme von ESM — "kein Build-Schritt — sie werden verbatim
ausgeliefert"). Diese Konvention gilt unverändert für die neue
Render-Funktion.

### Installation

Keine. `npm install` ist für diese Phase nicht nötig.

## Package Legitimacy Audit

**Nicht anwendbar.** Diese Phase installiert kein externes Paket. Kein
`npm view`, kein `package-legitimacy check` nötig.

## Architecture Patterns

### System Architecture Diagram

```
Build-Zeit (Astro, unverändert bis auf den payload-Umfang):
  assets/mining-db.json (bodies[] bleibt UNGENUTZT)
        │
        ▼  (nur minerals[] wird gemappt, wie heute)
  MiningWorkbench.astro
        │  baut payload = { minerals[].locs[], refineries, profiles, t, … }
        ▼
  <script id="wb-data" type="application/json">  (embedded JSON, ~75-80 KB/Seite)


Laufzeit (Browser, assets/mining-workbench.js):
  D.minerals[]  ──┬──▶ byName{}          (bereits vorhanden, Erz-Nachschlag)
                  └──▶ locIndex{}        (NEU: einmalig aus D.minerals abgeleitet,
                                           Ort-Name → sortierte {Erz,Chance,…}-Liste,
                                           Gruppierung nach mining-Methode zur
                                           Anzeigezeit, kein Netz, kein Payload-Zuwachs)

  Klick auf Fundort-Zeile (.wb__row2 in #wb-locs, AUSSERHALB der Nadel)
        │
        ▼
  S.view = 'loc'; S.selLoc = '<Ortsname>'   (neuer, nicht persistenter Zustand)
        │
        ▼
  renderLocation()  ersetzt den Inhalt der Mittelspalte:
    Kopf (Ortsname, Art · System, Anflugpunkte, Zurück-Pfeil)
    → Erzliste nach Methode gruppiert, jede Zeile klickbar (row2() wiederverwendet)
    → Klick auf eine Erzzeile:  S.sel = '<Erzname>'; S.view = 'ore'; renderDetail()
    → Zurück-Pfeil:             S.view = 'ore'; renderDetail()

  Deep-Link ?fundort=<Name> beim Laden (spiegelt fromQuery() für ?mineral=,
  Zeile 921-927): case-insensitive Abgleich GEGEN locIndex-Schlüssel (nie
  gegen den rohen Query-String rendern — Allow-List-Muster, s. Sicherheit)
```

### Recommended Project Structure

Keine neuen Dateien. Geänderte Dateien (bestätigt gegen den Code):

```
assets/mining-workbench.js        # locIndex-Aufbau, renderLocation(), Klick-/Deep-Link-Zweig
src/components/MiningWorkbench.astro  # Kopf-Markup-Gerüst der Ortsansicht, S_DE/S_EN, <style>
src/i18n/help.ts                  # mining.ctl.locpin nachziehen (DE+EN) — beschreibt heute nur die Nadel
tests/e2e/mining-shortlist.test.js    # neue Fälle (Zeilenklick, Rücksprung, Deep-Link, Merkliste)
tests/e2e/helpers/mining-dom.js       # Mock-DOM: neue IDs/Attribute registrieren (Präzedenz: 09-01/09-02/10-02 mussten das jedes Mal)
```

### Pattern 1: Ganze Zeile klickbar, verschachteltes Element bleibt eigenständig

**Was:** `row2()` (`assets/mining-workbench.js:212-225`) rendert bereits sowohl
Fundort- als auch Stationszeilen aus einem `.wb__row2`-Wrapper. Der optionale
7. Parameter `pinKey` ist **das etablierte Muster** für "nur diese Zeilenart
bekommt ein Zusatzelement" — Stationszeilen (`#wb-refs`) rufen `row2()` immer
sechsstellig auf, Fundortzeilen siebenstellig. Die Nadel selbst
(`.wb__lpin`, `data-locpin="…"`) sitzt als eigenes `<button>` INNERHALB des
`.wb__row2`-`<div>`.

**Wann verwenden:** Immer, wenn eine Zeile UND ein Element in ihr
unterschiedliche Klick-Bedeutungen tragen sollen, ohne `stopPropagation()`.

**Beleg (bereits im Code, 3 unabhängige Präzedenzfälle):**
```javascript
// assets/mining-workbench.js:849-875 — Reihenfolge ist die ganze Lösung.
// data-locpin (Nadel) MUSS vor data-pin geprüft werden (Kommentar Zeile 849-852);
// jeder Treffer endet mit `return`, kein Durchfallen zum naechsten Zweig.
var lp = t.closest('[data-locpin]');
if (lp) { /* … */ renderAll(); return; }
var pin = t.closest('[data-pin]');
if (pin) { /* … */ renderAll(); return; }
var tile = t.closest('.wb__tile');
if (tile) { S.sel = tile.getAttribute('data-min'); renderAll(); return; }
```
Dieselbe Reihenfolge-Lösung trägt bereits die Preset-Zeile:
`[data-pre-rename]` (Zeile 800) wird vor `[data-pre-pick]` (Zeile 806)
geprüft, obwohl beide Buttons in derselben `.wb__pre-item`-Zeile liegen.

**Für diese Phase:** Der neue Zeilen-Klick (D-01) muss **nach** dem
bestehenden `[data-locpin]`-Zweig eingefügt werden (die Nadel bleibt
vorrangig) und **vor** jedem generischeren Fallback. Ein neues
Daten-Attribut auf dem `.wb__row2`-Wrapper selbst (z. B. `data-loc="<Ortsname>"`,
analog zu `data-min` auf `.wb__tile`) macht die Zeile über
`t.closest('[data-loc]')` auffindbar, ohne die bestehende Nadel-Logik
anzufassen. Stationszeilen (`#wb-refs`) tragen dieses Attribut nicht — dieselbe
Abgrenzung wie beim `pinKey`-Parameter.

### Pattern 2: Fundort-Index client-seitig ableiten statt `DB.bodies` zu senden

**Was:** `byName` (Zeile 27-28) baut heute schon einen Index über `D.minerals`
beim Laden. Ein `locIndex` folgt demselben Muster: einmal über alle 37
Minerale und ihre `locs[]` iterieren (521 Paare, < 1 ms), pro `l.p`
(Ortsname) eine wachsende Liste `{name: m.name, ...l}` aufbauen.

**Wann verwenden:** Immer dann, wenn eine "Rückwärts-Sicht" auf bereits
gesendete Daten gebraucht wird und die Datenmenge klein genug ist (hier: 521
Paare), um sie ohne spürbare Kosten im Browser zu drehen.

**Byte-Messung (verifiziert am committeten `assets/mining-db.json`, 123.631
Bytes auf der Platte):**

| Option | Zusätzliches JSON im `<script id="wb-data">` | Client-Rechenaufwand |
|---|---|---|
| A — `DB.bodies` mitsenden | **+54.883 Bytes** minifiziert (`JSON.stringify(db.bodies).length`) — das Payload wächst von aktuell ~75-80 KB (nur `minerals` allein: 68.208 Bytes, plus `refineries` 1.565 + `refineryProfiles` 2.163 + Übersetzungen/Sonstiges) auf ~130-135 KB, **je Sprachseite** (DE und EN bauen getrennt) | keiner |
| B — `locIndex` aus `D.minerals` ableiten | **0 Bytes** — jedes Feld (`p`, `s`, `t`, `mi`, `ch`, `ms`, `ef`, `pt`) liegt bereits in `m.locations` (`MiningWorkbench.astro:94-100`) | 1 Schleife über 37 Minerale × ⌀14 Fundorte = 521 Iterationen beim Laden |

Option B ist strikt besser: keine zweite Wahrheit im Payload, keine
zusätzliche Bandbreite, kein Risiko, dass `bodies[]` und `minerals[]`
irgendwann auseinanderlaufen (genau die Klasse Fehler, gegen die
`verify-mining.mjs` Zusicherung 9 seit dem 15.08. wacht — die Historie dieser
Datei zeigt, dass genau das schon einmal passiert ist: "Bis 08/2026 wurden
beide getrennt aufgebaut … es fehlten 248 von 521 Paaren").

**Vollständigkeitsprüfung (verifiziert):** `bodies[].minerals[]` trägt
`name, chance, maxShare, eff, mining` — alle fünf Felder stehen 1:1 auch in
`minerals[].locations[]`. Zusätzlich trägt `bodies[]` `space` (bool),
`points` (dieselben Anflugpunkte wie `l.points`, bereits im Payload als `pt`),
und `best` (das ertragreichste Erz je Ort nach `chance`, mit `rarity`) — laut
`12-CONTEXT.md` D-11 wird `best` in dieser Phase **nicht gebraucht** (der
Kopf zeigt Ortsname/Art/System/Anflugpunkte, kein "bestes Erz"-Badge). Sollte
eine spätere Phase `best` doch brauchen, lässt es sich ebenfalls
client-seitig ableiten (`Math.max` über die gruppierte Liste) — auch dann
bleibt `DB.bodies` überflüssig.

**Gruppierung nach Methode (D-05):** `bodies[].methods[]` selbst wird
ebenfalls nicht gebraucht — die Menge der an einem Ort vorkommenden Methoden
lässt sich aus den `mi`-Werten der gruppierten Erzliste ableiten (`Set` über
alle Einträge). Verifiziert: **20 von 45 Fundorten haben genau 1 Methode, 25
haben genau 3** (nie 2) — die Gruppierung nach Methode ist für 20 Orte eine
Ein-Element-Liste, für 25 eine Drei-Element-Liste, nie etwas dazwischen.

### Pattern 3: Deep-Link spiegelt `?mineral=` — Allow-List, kein Rohtext-Rendering

**Was:** `?mineral=` (Zeile 921-927) liest den Query-Parameter, vergleicht ihn
case-insensitive gegen `byName`-Schlüssel und setzt `S.sel` nur bei
Übereinstimmung — der rohe Query-String wird **nie** ins DOM geschrieben.

```javascript
// assets/mining-workbench.js:920-927 — Vorlage für ?fundort=
var deepLinked = false;
(function fromQuery() {
  var want;
  try { want = new URLSearchParams(location.search).get('mineral'); } catch (e) { return; }
  if (!want) return;
  var key = want.trim().toLowerCase();
  for (var n in byName) if (n.toLowerCase() === key) { S.sel = n; deepLinked = true; return; }
})();
```

**Für `?fundort=`:** Derselbe Aufbau gegen `locIndex`-Schlüssel statt
`byName`. **Verifiziert: Ortsnamen sind global eindeutig** — kein Ortsname
kommt unter zwei verschiedenen Systemen vor (0 Kollisionen über alle 45
Bodies UND über alle 521 `minerals[].locations`-Paare geprüft). Der
case-insensitive Einzelvergleich ist damit sicher genug, ohne System als
Tie-Breaker zu brauchen.

**Scroll-Zentrierung:** Der bestehende `deepLinked`-Zweig (Zeile 936-949)
zentriert die angesprungene Kachel im `.wb__scroll`-Kasten der Erzliste über
eine `requestAnimationFrame`-Warteschleife (max. 20 Versuche), weil
`scrollHeight == clientHeight` im ersten Bild noch nicht stimmt (Rasterhöhe
kommt aus `clamp(…100vh…)`). Sollte `?fundort=` ebenfalls eine Liste
zentrieren müssen (z. B. falls eine Fundortliste an anderer Stelle scrollt),
gilt dieselbe Falle — **nicht über `offsetTop` rechnen**.

### Anti-Patterns to Avoid

- **`DB.bodies` an den Client senden:** verdoppelt das Inline-Payload nahezu
  ohne Gegenwert (siehe Pattern 2). `12-CONTEXT.md` nimmt das noch an —
  dieser Fund korrigiert es.
- **Neue Fundort-Route/-Seite:** von `12-CONTEXT.md` explizit ausgeschlossen
  (`.planning/notes/` „Zurückgestellte Ideen"), aber auch technisch unnötig:
  jede benötigte Information liegt bereits im Werkbank-Payload.
- **Panel NEBEN die Mittelspalte legen** statt sie zu ersetzen: `.wb__pane`
  trägt `overflow:hidden` (`MiningWorkbench.astro:454`,
  `assets/mobile-ux.css`-Kommentar Zeile 487-494 in `MiningWorkbench.astro`).
  Ein Element mit `position:absolute; left:calc(100% + …)` wird dadurch
  restlos weggeschnitten — bereits zweimal vorgeführt und zurückgenommen
  (Fundort-Merkliste-Recherche, Werkzeug-Hilfe-Box). Die Fundort-Ansicht muss
  den Inhalt der Mittelspalte **ersetzen**, nicht daneben treten.
- **Großen Anheft-Knopf (`#wb-pinsel`) für die Ortsansicht umwidmen:**
  `12-CONTEXT.md` D-11 verbietet das ausdrücklich ("ein gleich aussehender
  Knopf mit anderer Wirkung hat in Phase 10 ein Preset gekostet" — siehe
  10-REVIEW.md, der Umbenennen-`×`-vs-Löschen-`×`-Fund derselben Klasse).
  Ein Ort allein ist nicht anheftbar (nur Paare "Erz — Ort" sind es über
  `data-locpin`).
- **`stopPropagation()` zur Konfliktlösung Zeile/Nadel:** nirgends im
  Bestand verwendet; die Reihenfolge-Lösung (Pattern 1) ist der etablierte
  Weg und funktioniert ohne Event-Interna.
- **Chance/Höchstanteil/Erwartungswert in der Ortsansicht neu runden oder neu
  formatieren:** `nPct()`, `pctSub()`, `pctRight()`, `locSub()` sind bereits
  parametrisiert und werden von ZWEI Ansichten geteilt (Fundort-Zeile +
  Merkliste, siehe Kommentar Zeile 101-104 "O-3"). Eine dritte, eigene
  Formel in der Ortsansicht wäre ein drittes Formatierrisiko für dieselbe
  Zahl.

## Don't Hand-Roll

| Problem | Nicht selbst bauen | Stattdessen | Warum |
|---------|--------------------|--------------|-------|
| Chance/Höchstanteil/Erwartungswert-Aggregation je Ort | eigene Rundungs-/Aggregationslogik in der Ortsansicht | `l.ch`/`l.ms`/`l.ef` direkt aus `minerals[].locs` lesen, mit `pctSub()`/`pctRight()` formatieren | Die Aggregation (Mehrfach-Slot-Addition, Deposit-Wahrscheinlichkeits-Summe) ist ausschließlich in `scripts/datamine-locations.mjs:130-149` korrekt — jede clientseitige Neuberechnung würde raten |
| Groß-/Kleinschreibungs-tolerantes Namens-Matching für `?fundort=` | eigene Normalisierungsfunktion | dieselbe `.toLowerCase()`-Einzeiler-Schleife wie `?mineral=` (Zeile 925-926) | Ein zweites Matching-Verfahren für dieselbe Aufgabenklasse ist ein zweites Fehlerbild |
| Sortierung/Gruppierung der Ortsliste nach Methode | eigene Sortierfunktion | `methodLabel()` (Zeile 149-153) für die Beschriftung, `Set`/`Array.sort` für die drei- bzw. einwertige Gruppierung — kein neues Vokabular für "Hand"/"ROC"/"Schiff" | `methodLabel()` fasst `fps`+`hand` bewusst zusammen (Kommentar Zeile 144-148); eine zweite Methodenliste würde diese begründete Entscheidung stillschweigend umgehen |

**Kernaussage:** Diese Phase ist überwiegend eine **Wiederverwendungsaufgabe**,
keine neue Rechenlogik. Die einzige wirklich neue Berechnung ist der
`locIndex`-Aufbau selbst (eine Gruppierung, kein Aggregieren), und selbst der
folgt dem `byName`-Vorbild.

## Common Pitfalls

### Pitfall 1: Torlücke bei `verify-help.mjs` Zusicherung 6 — Mining teilt sich die Seite mit `refineryfinder`

**Was schiefgeht:** Die Mining-Seite trägt **zwei** Werkzeuge
(`data-tool-id="mining"` und `data-tool-id="refineryfinder"`,
`scripts/verify-help.mjs:70-75`). Zusicherung 6 zählte bis zum 11.08.2026 pro
**Seite**, nicht pro Werkzeug — als die Werkbank sämtliche `data-help`-Anker
verlor, hielten die drei Anker des Refinery-Finders die Seite trotzdem grün.
**Warum es passiert:** Ein neuer `data-help`-Anker in der Fundort-Ansicht
kann versehentlich außerhalb der Mining-Werkzeug-Grenze landen (die Grenze
läuft über Dokumentreihenfolge, vom ersten `data-tool-id="mining"` bis zum
nächsten `data-tool-id`), oder ein bestehender Anker (`hlp('locpin')` an
`#wb-locs`, `MiningWorkbench.astro:337`) verliert seinen Text-Bezug, weil die
Fundort-Zeile jetzt zwei Bedeutungen trägt (Anheften UND Navigieren) und der
Hilfetext nur die erste beschreibt.
**Wie vermeiden:** `mining.ctl.locpin` (`src/i18n/help.ts:99` DE, `:304` EN)
MUSS in DIESER Phase nachgezogen werden — er beschreibt die Fundort-Zeile
heute wörtlich als "Heftet einen Fundort an die Fundort-Merkliste … dieselbe
Nadel wie bei den Erzen" und wird mit D-01 falsch (die Zeile tut jetzt zwei
Dinge). Nach jedem Build: `node scripts/verify-help.mjs --complete`
(erwartet: 12 von 12 Werkzeuge, alle 6 Zusicherungen).
**Warnzeichen:** `verify:help` bleibt grün, obwohl der Hilfetext der
Fundort-Zeile objektiv falsch geworden ist — das Tor prüft NUR, dass ein
Anker existiert und nicht leer ist, nicht dass der Text stimmt. Gegenlesen
ist Pflicht, nicht optional.

### Pitfall 2: `.wb__pane{overflow:hidden}` schneidet jedes Overlay weg

**Was schiefgeht:** Ein Versuch, die Fundort-Ansicht als zusätzliches Panel
NEBEN die Mittelspalte zu legen (statt sie zu ersetzen), wird von
`overflow:hidden` an `.wb__pane` restlos unsichtbar gemacht — **bereits
zweimal vorgeführt** (Werkzeug-Hilfe-Box, Kommentar
`MiningWorkbench.astro:487-494`; Fundort-Merkliste-Recherche).
**Warum es passiert:** `.wb__pane` braucht `overflow:hidden` für die
angeschrägte Ecke (`.chamf::after`, Zeile 457-461) und die Glas-Optik.
**Wie vermeiden:** Die Fundort-Ansicht ersetzt den Inhalt der Mittelspalte
(`renderDetail()`-Gegenstück), sie tritt nie als zweites Element daneben.
**Warnzeichen:** Im gebauten HTML sichtbares, aber im Browser unsichtbares
Element — sofortiger Verdacht auf `overflow:hidden`-Beschnitt eines
Vorfahren.

### Pitfall 3: `build-light-overrides.mjs` deckt kein `background` ab

**Was schiefgeht:** Eine gedämpfte Spurenerz-Zeile (D-07) oder ein neues
"Spur"-Abzeichen, das über eine feste `background`-Fläche gedimmt wird,
bekommt beim automatischen Hellmodus-Lauf (`npm run theme`) **keine**
Entsprechung — der generierte `:root[data-theme="light"]`-Block bleibt für
diese Regel leer, die Fläche sieht im Hellmodus falsch aus, ohne dass ein Tor
das meldet.
**Warum es passiert:** `PROPS` in `scripts/build-light-overrides.mjs:85`
deckt nur `color, border-*-color, outline-color, text-decoration-color,
caret-color, fill, stroke` ab — `background`/`background-color` steht
**nicht** in der Liste (verifiziert am Code).
**Wie vermeiden:** Dämpfung über `color`/`opacity`/`currentColor` ausdrücken,
nicht über eine zweite `background`-Fläche — genau das Muster, das
`MiningWorkbench.astro` bereits an anderer Stelle für dieselbe Einschränkung
wählt (Kopfkommentar Zeile 40-42: "Zustandsfarben über `currentColor` +
`color`"). Alternativ: eine `color-mix(in srgb, var(--token) X%, transparent)`-Fläche
verwenden — solche Flächen sind Token-basiert und brauchen keine
Hellmodus-Entsprechung, weil sie sich mit dem darunterliegenden Token
automatisch mitändern.
**Warnzeichen:** `npm run theme` läuft grün, aber im Hellmodus sieht eine neu
gedämpfte Fläche identisch zum Dunkelmodus aus (zu dunkel/zu kontrastarm).

### Pitfall 4: Test-Mock-DOM kennt neue Markup-IDs/-Attribute nicht

**Was schiefgeht:** `tests/e2e/helpers/mining-dom.js` registriert Elemente
von Hand (`reg(mk('h2', 'wb-name'))` usw.) — ein neues `id=`/`data-*` im
produktiven Markup, das im Mock-DOM fehlt, lässt `document.getElementById()`
`null` liefern und `assets/mining-workbench.js` wirft (kein `$()===null`-Wächter
an jeder Stelle, siehe `renderPins()`-Kommentar Zeile 339-344 zur Guard-Pflicht).
**Warum es passiert:** **Dreimal in Folge** in den Vorgängerphasen (09-01,
09-02, 10-02) musste `mining-dom.js` nachträglich als Rule-3-Blocking-Deviation
gepatcht werden, weil neue IDs/Textschlüssel im Plan nicht in der Datei-Liste
standen (`chance`/`upTo`/`locPinsFull`-Platzhalter fehlten in 09-02;
`wb-scan`/`wb-tab-*` mussten in 10-02 umregistriert werden).
**Wie vermeiden:** `tests/e2e/helpers/mining-dom.js` explizit in die
Datei-Liste des Plans aufnehmen, nicht nur `assets/mining-workbench.js` und
`MiningWorkbench.astro` — Präzedenz aus allen drei Vorgängerplänen.
**Warnzeichen:** `node --test tests/e2e/mining-shortlist.test.js` schlägt mit
`Cannot read properties of null` fehl, sobald ein Testfall die neue
Fundort-Ansicht simuliert.

### Pitfall 5: Lost-Update und stiller Erfolg bei Preset-Schreibpfaden (bestehender Fund, nicht dieser Phase — aber berührbar)

**Was schiefgeht:** `preRemoveEntry()` berechnet das neue Array immer aus dem
zuletzt geladenen `presets`-Cache, nicht aus einer frischen Abfrage — zwei
rasche Klicks auf dasselbe Feld verlieren eine Entfernung (HIGH, siehe
`10-REVIEW.md` Abschnitt 3). `preDrop`/`preRemoveEntry`/`preRename` prüfen nur
`r.ok`, nie die Trefferzahl — ein `PATCH`/`DELETE`, das 0 Zeilen trifft
(Cross-Device-Race oder Presetname `"null"`), meldet trotzdem Erfolg (MEDIUM).
**Warum relevant für diese Phase:** Diese Phase fasst `S.locPins` und die
Merkliste (`renderLocPins()`) nicht strukturell an — D-03 erweitert nur ihre
Klickbarkeit —, aber jede neue Interaktion, die `renderAll()` bzw.
`preSave()`/`preRemoveEntry()` berührt, erbt diese bestehenden Lücken.
**Wie vermeiden:** Nicht Gegenstand dieser Phase (nicht im Scope laut
`ROADMAP.md` §12), aber **nicht erneut einführen**: falls die
Fundort-Ansicht einen neuen Preset-Schreibpfad öffnet (z. B. "alle Erze
dieses Ortes anheften"), muss er entweder denselben ungelösten
Lost-Update-Zustand bewusst in Kauf nehmen (dokumentiert) oder den bereits im
Code vorhandenen `preRmBusy`-Sperr-Mechanismus (Zeile 606,
Lost-Update-Fix-Kommentar) mitnutzen.
**Warnzeichen:** Zwei schnelle Klicks auf verschiedene Merklisten-Einträge
desselben Presets, eine Entfernung "kommt zurück".

### Pitfall 6: Größere Ortsansicht kostet Höhe — `--wb-chrome`/Falz-Zusage ist bereits knapp

**Was schiefgeht:** Die Werkbank hat eine gemessene, dokumentierte
Höhenbilanz (`--wb-chrome:236px`, `MiningWorkbench.astro:430`, Kommentar
Zeile 470-474: "bei 1080 rund 2 [px Luft]"). Ein neuer Kopfbereich in der
Ortsansicht (Name, Art · System, Anflugpunkte, Zurück-Pfeil) darf die
Kopfzeilenhöhe der Mittelspalte nicht signifikant über die des heutigen
Erz-Kopfs (`.wb__id`, Zeile 554) hinaus wachsen lassen, sonst reißt die
1080p-Falz-Zusage erneut (bereits einmal an der Fußzeile passiert, Notiz
`mining-werkbank-rigbalken.md`).
**Wie vermeiden:** Kopf der Ortsansicht strukturell an `.wb__id`/`.wb__idrow`
anlehnen (gleiche Padding-/Zeilenzahl), nicht als zusätzlicher Block
obendrauf.
**Warnzeichen:** Bei 1920×1080 (die für diese Werkbank gemessene
Referenzauflösung) läuft die Werkbank über die Fensterunterkante.

## Code Examples

### Bestehender `byName`-Index als Vorbild für `locIndex`

```javascript
// Source: assets/mining-workbench.js:27-28 (bestehend, Vorbild)
var byName = {};
for (var i = 0; i < D.minerals.length; i++) byName[D.minerals[i].name] = D.minerals[i];

// Analoges Muster für den Fundort-Index (neu, gleiche Stelle im Modul):
// var locIndex = {};
// for (var i = 0; i < D.minerals.length; i++) {
//   var m = D.minerals[i];
//   for (var j = 0; j < m.locs.length; j++) {
//     var l = m.locs[j];
//     (locIndex[l.p] = locIndex[l.p] || []).push({ name: m.name, rarity: m.rarity, /* ...l */ });
//   }
// }
```

### `row2()` — Signatur und der 7. Parameter als Muster

```javascript
// Source: assets/mining-workbench.js:208-225 (bestehend)
/* Siebter Parameter pinKey (optional): NUR der Fundort-Aufruf uebergibt
   ihn. Die drei Stations-Aufrufe (#wb-refs) und der Ersatzeintrag der
   gewaehlten Station bleiben sechsstellig — sie bekommen dadurch keinen
   Nadelknopf (D-05, Nebenbedingung 2 der Phase). */
function row2(main, sub, barPct, right, amber, mark, pinKey) { /* … */ }
```
Für die Erzliste innerhalb der Ortsansicht ist `row2()` ohne Änderung
wiederverwendbar (kein `pinKey`, weil dort kein Anheften stattfindet — nur
Navigation zum Erz).

### Deep-Link-Muster (`?mineral=` → Vorlage für `?fundort=`)

```javascript
// Source: assets/mining-workbench.js:920-927 (bestehend)
var deepLinked = false;
(function fromQuery() {
  var want;
  try { want = new URLSearchParams(location.search).get('mineral'); } catch (e) { return; }
  if (!want) return;
  var key = want.trim().toLowerCase();
  for (var n in byName) if (n.toLowerCase() === key) { S.sel = n; deepLinked = true; return; }
})();
```

### `verify-mining.mjs` Zusicherung 9 — die Garantie, auf der Pattern 2 aufbaut

```javascript
// Source: scripts/verify-mining.mjs:60-88 (bestehend)
// Diese Zusicherung haelt bodies[].minerals[] und minerals[].locations[]
// deckungsgleich. Solange sie gruen ist, ist ein client-seitig aus
// minerals[] abgeleiteter locIndex GARANTIERT identisch mit dem, was
// bodies[] enthaelt hätte.
const fwd = new Map(), bwd = new Map();
for (const m of db.minerals) for (const l of m.locations || []) fwd.set(`${m.name}||${l.location}`, l);
for (const b of db.bodies) for (const e of b.minerals || []) bwd.set(`${e.name}||${b.body}`, e);
// … onlyFwd/onlyBwd/valDiff-Prüfung, siehe Datei
```

## State of the Art

| Vorher (bis 08/2026) | Jetzt (seit 15.08.2026, Vorgängerphasen 9/10) | Wann geändert | Bedeutung für Phase 12 |
|---|---|---|---|
| Fundorte und Rückwärts-Sicht (`bodies[]`) getrennt aus zwei unabhängigen Läufen aufgebaut, konnten auseinanderlaufen | Beide Sichten aus EINER aggregierten Menge (`scripts/datamine-locations.mjs:189-215`), von `verify-mining.mjs` Zusicherung 9 gegeneinander gehalten | 14.-15.08.2026 (Fundort-Korrektur) | Macht Pattern 2 (client-seitige Ableitung statt `bodies[]`-Versand) sicher — die Garantie ist maschinell erzwungen, nicht nur historisch wahr |
| Mittelspalte zeigte Physik/Qualitätsstufen/"Steine mit diesem Erz" | Mittelspalte zeigt nur noch Fundorte + Beste Stationen (Phase 9, D-01) | 15.08.2026 | Die Mittelspalte ist bereits einspaltig und schlank — die neue Ortsansicht ersetzt genau diesen bereits verkleinerten Inhalt |
| Rechte Spalte hinter Reitern versteckt | Signaturen + Fundort-Merkliste gleichzeitig sichtbar gestapelt (Phase 10, D-03) | 15.08.2026 | D-03 dieser Phase (Merkliste trägt denselben Klick) baut auf einer bereits reiterlosen Spalte auf — kein Umbau nötig |

Keine externen Bibliotheken sind an dieser Recherche beteiligt — "State of
the Art" bezieht sich hier ausschließlich auf die eigene Codebasis-Historie.

## Assumptions Log

| # | Behauptung | Abschnitt | Risiko bei Irrtum |
|---|---|---|---|
| A1 | Ein neues Daten-Attribut (`data-loc` o. ä.) auf dem `.wb__row2`-Wrapper ist der richtige Mechanismus für die Zeilen-Klickbarkeit, statt z. B. `row2()` selbst um einen 8. Parameter zu erweitern | Pattern 1 | Gering — beides ist technisch gleichwertig; die konkrete Umsetzung ist laut `12-CONTEXT.md` "Claude's Ermessen" (Aufbau der Umschaltung) und liegt beim Planer, nicht bei dieser Recherche |
| A2 | Die Ortsansicht wird als eigene Render-Funktion (`renderLocation()`) neben `renderDetail()` gebaut, nicht als Verzweigung innerhalb `renderDetail()` | System-Diagramm | Gering — `12-CONTEXT.md` nennt genau diese Wahl bereits als vorgeschlagene Ermessensentscheidung; falls der Planer stattdessen verzweigt, ändert das nichts an den hier belegten Datenflüssen |

**Alle übrigen Aussagen dieser Recherche sind gegen den tatsächlichen Code,
die tatsächlichen Daten (`assets/mining-db.json`, per Node-Skript
nachgerechnet) oder gegen frühere Phasenartefakte verifiziert** — keine
Websuche, kein Trainingswissen ohne Gegenprobe im Bestand.

## Open Questions

1. **Exakter Name des neuen Zustandsfelds und der Ansichts-Umschaltung**
   - Was wir wissen: `S = { sel, pins, locPins, ref, q, sys }` (Zeile 67) ist
     der bestehende Zustand; ein neues Feld (z. B. `S.view`/`S.selLoc`) muss
     dort ergänzt werden. `12-CONTEXT.md` schlägt vor, dass die Ansicht NICHT
     in `localStorage` überlebt (wie `?mineral=` heute auch nicht) — ein
     Neuladen ohne `?fundort=` zeigt wieder das Erz.
   - Was unklar ist: ob `save()` (Zeile 82-86) das neue Feld überhaupt
     serialisieren soll, oder ob es bewusst außerhalb des gespeicherten
     Objekts bleibt.
   - Empfehlung: außerhalb `localStorage` halten (deckt sich mit der
     `?mineral=`-Präzedenz) — der Planer entscheidet den genauen Feldnamen.

2. **Genaue Dämpfungswerte der Spurenerz-Zeilen (D-07)**
   - Was wir wissen: Schwelle ist `maxShare ≤ 10` (gemessen, 171 von 521
     Paaren), gedämpft + Abzeichen "Spur", kein eigener Abschnitt.
   - Was unklar ist: der konkrete Opazitäts-/Farbwert der Dämpfung — laut
     `12-CONTEXT.md` explizit "Claude's Ermessen".
   - Empfehlung: `color-mix(in srgb, var(--muted) X%, transparent)` auf `.p`
     der Zeile, kein `background` (Pitfall 3).

3. **Reicht die vorhandene Scroll-Zentrierung (`deepLinked`-Warteschleife) für `?fundort=`, wenn die Ortsansicht selbst länger ist als ein Bildschirm?**
   - Was wir wissen: Ein Ort hat bis zu 17 Erzzeilen (gemessen); die
     Mittelspalte hat bereits `.wb__scroll` für die heutige Fundortliste
     eines Erzes (bis zu 27 Zeilen, laut Astro-Kommentar Zeile 312).
   - Was unklar ist: ob `?fundort=` selbst scrollen/zentrieren muss, oder ob
     ein einfaches "Ansicht oben öffnen" reicht, weil die Ortsansicht anders
     als die Kachel-Deep-Link-Situation ohnehin ganz oben in der Mittelspalte
     neu gezeichnet wird (kein Scrollen zu einer bestehenden Zeile nötig).
   - Empfehlung: vermutlich kein Zentrieren nötig (die Ansicht ersetzt den
     Spalteninhalt und beginnt bei `scrollTop:0`), aber der Planer sollte das
     explizit als Verifikationsschritt aufnehmen.

## Environment Availability

Nicht anwendbar — diese Phase hat keine externen Abhängigkeiten (Tools,
Dienste, Laufzeiten). Es ist eine reine Code-/Markup-/Text-Änderung an
bereits vorhandenen, bereits laufenden Dateien. `npm run build && npm run
gate` (lokal vorhandenes Node-Toolchain) reicht vollständig aus.

## Validation Architecture

Übersprungen — `workflow.nyquist_validation` steht in `.planning/config.json`
explizit auf `false`.

## Security Domain

`security_enforcement` ist aktiv (`security_asvs_level: 1`,
`security_block_on: "high"`).

### Anwendbare ASVS-Kategorien

| ASVS-Kategorie | Trifft zu | Standard-Kontrolle |
|---|---|---|
| V2 Authentifizierung | nein | Diese Phase ändert keinen Auth-Pfad; Preset-Schreibpfade (`VBAccount`) bleiben unangetastet |
| V3 Sitzungsverwaltung | nein | Keine Session-Logik betroffen |
| V4 Zugriffskontrolle | nein | Keine neue serverseitige Ressource, keine neue RLS-Politik |
| V5 Eingabevalidierung | **ja** | `?fundort=`-Query-Parameter: Allow-List-Abgleich gegen `locIndex`-Schlüssel VOR jeder Verwendung (Pattern 3) — niemals den Rohwert ins DOM schreiben. Jeder gerenderte Textwert (Ortsname, Erznamen aus der Ortsansicht) läuft weiterhin durch die bestehende `esc()`-Funktion (Zeile 89-93), die `&<>"` escaped |
| V6 Kryptografie | nein | Keine Kryptografie in dieser Phase |

### Bekannte Bedrohungsmuster für diesen Stack

| Muster | STRIDE | Standard-Gegenmaßnahme |
|---|---|---|
| Reflected-Content aus Query-Parameter (`?fundort=<Name>`) direkt ins Markup | Tampering / Information Disclosure | Allow-List-Abgleich gegen bekannte Ortsnamen (`locIndex`-Schlüssel) VOR jeder Nutzung — identisch zum bestehenden, bereits sicheren `?mineral=`-Muster. Der rohe `want`-Wert wird nie gerendert, nur als Vergleichsschlüssel benutzt |
| HTML-Injection über Erz-/Ortsnamen aus dem Katalog | Tampering | `esc()` escaped bei JEDER Ausgabe (bereits Testfall "T-09-01: HTML-Sonderzeichen … landen escaped" in `mining-shortlist.test.js`) — neue Render-Pfade müssen `esc()` ebenso konsequent verwenden wie `renderDetail()`/`renderLocPins()` es heute tun |
| Selektor-Injection über Attributwerte (`[data-loc="…"]`) | Tampering | Bestehendes Muster: Zugriff ausschließlich über `t.closest('[data-loc]')` (Attribut-Anwesenheit, keine Wertprüfung im Selektor) + `.getAttribute()` danach — genau das im `10-REVIEW.md` Abschnitt 5 als fehlerfrei bestätigte Verfahren für Preset-Namen. Kein Selektor darf einen Ortsnamen literal in einen CSS-Selektor-String einbauen |

## Sources

### Primär (HIGH confidence — direkt aus dem Bestand gelesen/gemessen)
- `assets/mining-workbench.js` (950 Zeilen, vollständig gelesen)
- `src/components/MiningWorkbench.astro` (816 Zeilen, vollständig gelesen)
- `assets/mining-db.json` — per Node-Skript nachgerechnet (45 Bodies, 6-17
  Erze/Body, 20/25-Methodenverteilung, 521 Paare, 171/350-Spuren-Split, 0
  Namenskollisionen)
- `scripts/verify-mining.mjs`, `scripts/datamine-locations.mjs` (vollständig
  gelesen)
- `scripts/verify-help.mjs`, `scripts/lib/gate-registry.mjs`,
  `scripts/run-gate.mjs` (vollständig gelesen)
- `scripts/build-light-overrides.mjs` (PROPS-Konstante, Zeile 85, verifiziert)
- `assets/theme.css`, `assets/mobile-ux.css` (Scrollbox-Registrierung per
  Klasse, `.wb__scroll` bereits generisch erfasst — kein neuer Eintrag nötig,
  solange neue Bildlaufkästen dieselbe Klasse tragen)
- `.planning/phases/09-mining-werkbank-fundort-merkliste/09-01-SUMMARY.md`,
  `09-02-SUMMARY.md`
- `.planning/phases/10-mining-presets-bedienbar-machen/10-02-SUMMARY.md`,
  `10-REVIEW.md`
- `.planning/notes/mining-werkbank-defekte.md`,
  `.planning/notes/signaturliste-anheften.md`
- `.planning/codebase/CONVENTIONS.md`, `CLAUDE.md`, `.planning/config.json`
- `tests/e2e/helpers/mining-dom.js`, `tests/e2e/mining-shortlist.test.js` (Struktur überflogen)

### Sekundär (MEDIUM confidence)
— keine; alle Aussagen dieser Recherche sind primär belegt.

### Tertiär (LOW confidence)
— keine; keine Websuche verwendet (Domäne ist reine Codebasis-Recherche
ohne externe Bibliothek).

## Metadata

**Confidence-Aufschlüsselung:**
- Standard-Stack: HIGH — keine neue Abhängigkeit, vollständig gegen
  `package.json`/`CONVENTIONS.md` geprüft
- Architektur: HIGH — jedes Muster ist ein bereits im Code laufender
  Präzedenzfall (Kachel/Nadel, Preset-Zeile/Stift, Fundort-Zeile/Nadel),
  keine Spekulation
- Datenmessung (Payload-Bytes, Fundort-Statistik): HIGH — per Node-Skript
  direkt am committeten `assets/mining-db.json` nachgerechnet, nicht
  geschätzt
- Fallstricke: HIGH — jeder Pitfall ist mit einer konkreten Vorgängerphase
  oder einem Codekommentar belegt, keine hypothetischen Risiken

**Recherchedatum:** 2026-08-15
**Gültig bis:** 30 Tage (stabile, interne Codebasis-Recherche ohne externe
Bibliotheksversionen) — außer `assets/mining-db.json` ändert sich durch einen
neuen `sync:mining`-Lauf vor der Umsetzung; in diesem Fall müssen die
Zahlenwerte (45 Bodies, 521 Paare, 171/350-Split) neu nachgerechnet werden.
