---
phase: 20-wikelos-angebote-kommen-aus-dem-bestand
reviewed: 2026-08-28T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - scripts/build-wikelo-trades.mjs
  - scripts/probes/wikelo-kuration-zuordnung.mjs
  - scripts/lib/metrics-baseline.mjs
  - scripts/verify-metrics.mjs
  - scripts/verify-datastand.mjs
  - scripts/lib/gate-registry.mjs
  - src/components/topics/wikelo-emporium.astro
  - assets/wikelo-curated.json
  - assets/wikelo-trades.meta.json
  - package.json
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-28
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 20 ersetzt die 100 % handgepflegte Wikelo-Tauschliste durch eine Merge aus
maschinellem Extrakt (`wikelo-gamefiles.json`, gitignored) und kuratiertem Overlay
(`wikelo-curated.json`, git-getrackt). Die Grundarchitektur ist solide: Schlüssel
ist ausschließlich die Vertrags-`id`, die Merge-Skripte überschreiben die Kuration
nie, die Gates lesen ausschließlich committete Dateien (`wikelo-trades.meta.json`),
`entryCount` und `contractCount`/`orderLineCount` sind sauber getrennte Kennzahlen,
und die Provenance-Regel (kein "Spieldaten"/"DataCore"/"datamined" im sichtbaren
Text) wird eingehalten.

Zwei Befunde sind jedoch ernst genug, um vor dem Liefern behoben zu werden:

1. Die Zuordnungs-Sonde (`wikelo-kuration-zuordnung.mjs`) verletzt in Stufe 2
   genau die beidseitige Eindeutigkeit, die laut Kopfkommentar "ausdrücklich
   verboten" ist — ein einzelner Vertrag kann über zwei verschiedene Schlüssel
   (Titel und Belohnungsname) an zwei verschiedene Handeinträge gebunden werden,
   ohne dass das als Kollision erkannt wird.
2. `build-wikelo-trades.mjs` übernimmt `contractCount`/`orderLineCount` — genau
   die Zahlen, die die Sperrklinke in `verify-metrics.mjs` gegen stille
   Bestandsschrumpfung absichert — ungeprüft aus der (gitignored, im Build
   nicht nachvollziehbaren) `wikelo-gamefiles.json`, obwohl das Skript die
   Rohdaten (`game.contracts`) selbst vollständig vorliegen hat, um sie
   gegenzurechnen.

## Critical Issues

### CR-01: Stufe 2 der Zuordnungs-Sonde kann denselben Vertrag zwei Handeinträgen zuordnen (Bijektionsbruch)

**File:** `scripts/probes/wikelo-kuration-zuordnung.mjs:115-164`
**Issue:**
`stufe2()` registriert einen Vertrag unter **mehreren** Schlüsseln gleichzeitig
— `norm(c.titel)` UND `norm(r)` für jedes `r` aus `c.rewardItems` (Zeilen
118-125). `schluesselAufloesen()` (Zeilen 140-164) prüft Eindeutigkeit aber nur
**pro Schlüssel**, nicht über den gesamten Stufenlauf hinweg: Wenn Vertrag `C`
unter Schlüssel `"titelX"` mit genau einem Handeintrag `E1` kollisionsfrei
matcht UND unter Schlüssel `"rewardY"` (ein anderer Reward-Name desselben
Vertrags) mit einem anderen Handeintrag `E2` ebenfalls kollisionsfrei matcht,
werden **zwei** `paare`-Einträge für denselben Vertrag `C` erzeugt — bevor die
Löschung aus `offeneVertraege`/`offeneHand` überhaupt greift (die läuft erst
NACH der kompletten Schlüsselschleife, Zeilen 159-162).

Das ist exakt der Fall, gegen den die Stufenordnung laut Kopfkommentar gebaut
ist ("greedy 'erster gewinnt' ist ausdrücklich verboten, weil er genau die
Fehlzuordnung erzeugt"): hier gewinnt nicht "der erste", sondern beide
Zuordnungen laufen unbemerkt durch. Folgen:

- In der Konsolenausgabe erscheinen zwei Zeilen unter "Stufe:
  belohnungsname-exakt", die denselben Vertrag zwei unterschiedlichen
  Handeinträgen zuordnen, ohne als Kollision markiert zu werden (Zeilen
  229-237 loggen einfach beide `paare`-Einträge).
- Mit `--schreiben` (Zeilen 267-287) wird `trades[z.vertrag.id]` für denselben
  Vertrag zweimal gesetzt — die zweite Zuweisung überschreibt die erste
  **kommentarlos**, ohne Fehlermeldung. Genau der Vertrag, der laut Konsole
  "korrekt" doppelt zugeordnet wurde, landet je nach Iterationsreihenfolge mit
  dem falschen kuratierten Bild/Kategorie in `wikelo-curated.json`.

Da diese Sonde laut Kopfkommentar der Beleg dafür ist, dass die Kuration
korrekt zugeordnet wurde (Basis für reale Karten-Bilder), untergräbt dieser
Bruch genau die Garantie, die die dreistufige Architektur geben soll.

**Fix:**
```js
function schluesselAufloesen(name, nachSchluesselVertrag, nachSchluesselHand) {
  const paare = [];
  const kollisionen = [];
  const genutzteVertraege = new Set();
  const genutzteHandIdx = new Set();
  const alleSchluessel = new Set([...nachSchluesselVertrag.keys(), ...nachSchluesselHand.keys()]);
  for (const k of alleSchluessel) {
    const vs = nachSchluesselVertrag.get(k) || [];
    const hs = nachSchluesselHand.get(k) || [];
    if (!vs.length || !hs.length) continue;
    if (vs.length === 1 && hs.length === 1) {
      const [v] = vs;
      const [h] = hs;
      // Beidseitige Eindeutigkeit gilt fuer die GESAMTE Stufe, nicht nur je
      // Schluessel -- ein Vertrag mit mehreren Schluesseln (Titel + mehrere
      // Rewardnamen) darf nicht zweimal gewinnen.
      if (genutzteVertraege.has(v.id) || genutzteHandIdx.has(h)) {
        kollisionen.push({
          stufe: name,
          schluessel: k,
          vertraege: [vertragBezeichnung(v)],
          handEintraege: [handName(offeneHand.get(h))],
        });
        continue;
      }
      genutzteVertraege.add(v.id);
      genutzteHandIdx.add(h);
      paare.push({ vertrag: v, handIdx: h, handEintrag: offeneHand.get(h) });
    } else {
      kollisionen.push({ stufe: name, schluessel: k, vertraege: vs.map(vertragBezeichnung), handEintraege: hs.map((i) => handName(offeneHand.get(i))) });
    }
  }
  for (const p of paare) {
    offeneVertraege.delete(p.vertrag.id);
    offeneHand.delete(p.handIdx);
  }
  return { name, paare, kollisionen };
}
```
(Stufe 1 ist von diesem Muster nicht betroffen, da dort jeder Vertrag nur unter
genau einem Materialien-Schlüssel registriert wird; Stufe 3 prüft die
Kandidatenlisten bereits beidseitig pro Kandidatenpaar. Nur Stufe 2 registriert
einen Vertrag unter mehreren Schlüsseln gleichzeitig.)

### CR-02: `contractCount`/`orderLineCount` werden ungeprüft aus der gitignored Rohdatei übernommen — genau die Zahlen, die die Sperrklinke gegen stille Schrumpfung absichern

**File:** `scripts/build-wikelo-trades.mjs:98-99`
**Issue:**
```js
contractCount: game.counts?.contracts ?? null,
orderLineCount: game.counts?.orderLines ?? null,
```
Diese beiden Felder werden 1:1 aus dem Selbstauskunfts-Feld `game.counts` der
**gitignored** `wikelo-gamefiles.json` übernommen — einer Datei, die dieses
Skript selbst nicht erzeugt (sie kommt aus `scripts/datamine-wikelo.mjs`) und
deren `counts`-Feld hier nicht gegen die tatsächlich verarbeiteten Daten
gegengerechnet wird. Genau diese beiden Zahlen sind es, die
`verify-metrics.mjs` als `wikeloVertraege`/`wikeloWarenposten` gegen die
Sperrklinke hält (`scripts/lib/metrics-baseline.mjs:151-173`) — die
Schutzmechanik, die laut Kopfkommentar von `verify-metrics.mjs` speziell dafür
gebaut wurde, dass ein fehlerhafter Datenlauf den Bestand still verkleinert,
ohne dass es auffällt (der "-834-Items-Vorfall").

`build-wikelo-trades.mjs` hat an dieser Stelle bereits `game.contracts`
vollständig vorliegen (Zeile 53, `game.contracts.map(...)`) — die Anzahl der
tatsächlich verarbeiteten Verträge (`game.contracts.length`, identisch mit
`trades.length`/`entryCount`) und die Summe aller Order-Zeilen
(`game.contracts.reduce((n,c) => n + c.orders.length, 0)`) ließen sich hier
direkt und unabhängig vom Selbstauskunfts-Feld berechnen bzw. dagegen
verifizieren. Stattdessen wird der obere Zahl blind vertraut. Weicht
`game.counts.contracts`/`orderLines` in `datamine-wikelo.mjs` künftig von der
tatsächlichen Vertrags-/Order-Zeilenzahl ab (z. B. weil dort vor der Zählung
gefiltert oder dedupliziert wird, während `game.contracts` selbst mehr/weniger
Einträge trägt), meldet die Sperrklinke fälschlich "Bestand ok", während
`entryCount` (korrekt aus `trades.length` berechnet) bereits abweicht — exakt
der stille Ausfallmodus, den `verify-metrics.mjs` verhindern soll, nur diesmal
verursacht durch dieses Skript selbst statt durch den Datenlauf.

Aktuell stimmen `entryCount` (69) und `contractCount` (69) in
`wikelo-trades.meta.json` zufällig überein — das beweist nicht, dass der Pfad
sicher ist, nur dass er bei diesem einen Lauf nicht gerissen ist.

**Fix:**
```js
const contractCountIst = game.contracts.length;
const orderLineCountIst = game.contracts.reduce((n, c) => n + c.orders.length, 0);
if (game.counts?.contracts !== contractCountIst || game.counts?.orderLines !== orderLineCountIst) {
  console.error(
    `FEHLER: Bestandszahlen in wikelo-gamefiles.json (counts.contracts=${game.counts?.contracts}, ` +
    `counts.orderLines=${game.counts?.orderLines}) weichen von der tatsaechlich verarbeiteten Menge ` +
    `(${contractCountIst} Vertraege, ${orderLineCountIst} Order-Zeilen) ab — Extraktion pruefen, ` +
    'nicht die Zahl blind uebernehmen.',
  );
  process.exit(1);
}
// ...
const meta = {
  // ...
  contractCount: contractCountIst,
  orderLineCount: orderLineCountIst,
  // ...
};
```

## Warnings

### WR-01: Keine Laufzeitprüfung, dass `o.max >= o.min` — die Mengenbereich-Logik verlässt sich auf eine unbewiesene Dateninvariante

**File:** `scripts/build-wikelo-trades.mjs:61-72`
**Issue:** Der Kommentar begründet die Bereichs-Erkennung (`o.max > o.min` statt
`o.max !== o.min`) explizit mit einer Momentaufnahme der heutigen Daten
("132/285 max:0 ... 0/285 max>min"). Das ist eine Beobachtung, keine
Zusicherung — es gibt keine Assertion, die einen künftigen Fall `o.max <
o.min` abfängt. Träte er ein, würde die Zeile klammheimlich nur `o.min`
anzeigen und den anomalen `max`-Wert stillschweigend verschlucken, ohne
Fehlermeldung — im Widerspruch zum sonst in dieser Datei gelebten
Grundsatz "eine kuratierte id ohne Treffer ... wird namentlich genannt statt
still ignoriert" (Zeilen 36-39).
**Fix:**
```js
if (o.max != null && o.max < o.min) {
  console.error(`FEHLER: Order-Zeile "${o.name}" in Vertrag ${c.id} hat max (${o.max}) < min (${o.min}) — Dateninvariante gebrochen.`);
  process.exit(1);
}
```
vor der bestehenden `mengenbereiche`-Logik ergänzen.

### WR-02: Inkonsistente Truthy-Prüfung statt `!= null` bei `cur.get`/`cur.comps`/`cur.rep`

**File:** `scripts/build-wikelo-trades.mjs:80, 84-85`
**Issue:** `if (favor != null)` (Zeile 81) prüft korrekt gegen `null`/`undefined`
und lässt `0` als gültigen Wert durch. Direkt daneben prüfen `if (cur.get)`,
`if (cur.comps)` und `if (cur.rep)` (Zeilen 80, 84-85) nur auf Truthy — eine
kuratierte leere Zeichenkette (`get: ""`) oder ein bewusst leeres
Komponenten-Array (`comps: []`, um "kein Loadout" von "nicht kuratiert" zu
unterscheiden) würde still als "nicht gesetzt" behandelt statt als kuratierter
Wert übernommen. Aktuell tritt der Fall in `wikelo-curated.json` nicht auf,
aber die Inkonsistenz zur Nachbarzeile ist ein Wartungsrisiko — ein späterer
Kurator, der `comps: []` einträgt, bekommt keine Fehlermeldung und keine
Wirkung.
**Fix:** Einheitlich `!= null` verwenden, z. B. `if (cur.get != null) card.get
= cur.get;`.

## Info

### IN-01: Stufe 3 verwirft Handeinträge, deren Name vollständig aus STOPWORDS besteht, ohne das im Kollisionsbericht kenntlich zu machen

**File:** `scripts/probes/wikelo-kuration-zuordnung.mjs:170-172`
**Issue:** `if (!nameTokens.length) continue;` überspringt Handeinträge, deren
Name nach Abzug von `STOPWORDS` (`set`, `military`, `spec`) leer ist, komplett
— sie tauchen nur indirekt in "Offen gebliebene Handeinträge" auf, ohne dass
ersichtlich wird, dass Stufe 3 sie gar nicht erst versucht hat. Kein
Zuordnungsfehler, aber die Selbstauskunft ist an dieser Stelle weniger
transparent als bei den übrigen Ausschlusspfaden des Skripts.
**Fix:** Optional einen eigenen Diagnosezähler ("von STOPWORDS vollständig
konsumiert") in der Abschlussausgabe ergänzen.

---

_Reviewed: 2026-08-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
