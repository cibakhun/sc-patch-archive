# Phase 14: Schiffs-Datenkarte entstapeln — Kontext

**Erhoben:** 2026-08-18
**Status:** Bereit zur Planung
**Herkunft:** Betreiber-Auftrag „die individuellen Ship-Datenkarten-Seiten
vereinfachen — es steht zwar alles da was man braucht, was ich gut finde,
aber es ist irgendwie zu viel und irgendwie komplett unübersichtlich",
plus Messung an der gebauten Seite (siehe „Erkenntnisse aus dem Bestand").

---

## Phasengrenze

**In dieser Phase:** Der Aufbau der Schiffs-Detailseite unterhalb des Heros —
`src/components/ShipDetail.astro`, ein Körper für DE und EN, 227 Seiten je
Sprache. Gruppierung der heute zehn gleichförmigen Panels zu Kapiteln, eine
Sprungleiste darüber, Tilgung der gemessenen Doppelungen, Rückbau der Balken
auf die eine Stelle, an der sie vergleichen.

**Nicht in dieser Phase:**

- **Der Hero bleibt unberührt.** Hologramm-Bühne, Video-/Bilder-/3D-Umschalter,
  Herstellerlogo, Chips, Merken-Knopf, Kennwerte-Leiste im heutigen Zustand —
  das trägt und wird nicht angefasst. Eine Ausnahme: fällt ein Kennwert durch
  die Entdopplung woanders weg, bleibt er *hier* stehen.
- **Keine Datenänderung.** Kein Feld wird neu erhoben, keine Zahl neu
  berechnet, keine Quelle angebunden. Diese Phase ordnet nur an, was schon da
  ist.
- **Die Schiffsübersicht `/schiffe`** (Filterkonsole, Kartenraster) ist nicht
  Gegenstand.
- **Reiter, Akkordeons, „mehr anzeigen"** — ausdrücklich verworfen, siehe D-01.

---

## Umsetzungsentscheidungen

### D-01 — Kapitel und Sprungleiste, nicht Reiter (Betreiber, 18.08.2026)

Die zehn `.sd__panel` werden zu wenigen Kapiteln gebündelt, die sich optisch
voneinander unterscheiden. Darüber steht eine Sprungleiste, die beim Scrollen
erreichbar bleibt.

⚠ **Gesperrt: Reiter, Akkordeons und jede Form von „hinter einem Klick".**
Der Betreiber hat ausdrücklich festgehalten, dass „alles steht da" die Stärke
dieser Seite ist. Eine Lösung, die Inhalt hinter eine Interaktion legt,
verletzt den Auftrag — auch wenn sie die Seite kürzer macht.

⚠ **Gesperrt: reine Zweispaltigkeit als Hauptmittel.** Vorgelegt und
verworfen: sie halbiert die Länge, heilt aber die Gleichförmigkeit nicht — und
„unübersichtlich" war die Hauptklage, nicht „lang". Zweispaltigkeit
*innerhalb* eines Kapitels ist erlaubt und erwünscht, wo sie zusammengehörige
Werte nebeneinanderstellt.

### D-02 — Balken nur, wo sie vergleichen (Betreiber, 18.08.2026)

Heute stehen 20 Balkenspuren auf der Seite. Es bleiben die des
**Leistungsprofils** — dort ist der Balken ein Perzentil gegen 227 Schiffe und
vergleicht wirklich etwas. Bei **Maßen** (L/B/H), **Tanks**, **Flugwerten** und
**Verteidigung** werden die Balken zu Zahlen.

Begründung, wörtlich zu behalten: Ein Balken, der Länge gegen Breite gegen
Höhe stellt, vergleicht drei Größen, die nichts miteinander zu tun haben. Er
sieht aus wie Daten und ist keine. Dieselben drei Zahlen stehen heute schon als
Text in der Bildunterschrift direkt darüber.

### D-03 — Die Doppelungen fallen, nicht die Information

Jeder Wert behält **einen** Ort. Wo ein Wert heute mehrfach steht, entscheidet
die Frage „wo sucht man ihn?", nicht „wo stand er zuerst". Fällt ein Wert an
seiner heutigen Stelle weg, muss belegt sein, dass er an seiner neuen Stelle
tatsächlich steht — die Erfolgsprüfung läuft gegen das gebaute `dist/`, nicht
gegen die Quelle.

### Claudes Ermessen

Frei zu entscheiden, solange D-01 bis D-03 gewahrt bleiben:

- **Zuschnitt und Zahl der Kapitel.** Vier ist die naheliegende Gliederung
  (Kaufen · Leistung · Ausstattung · Umfeld), aber nicht vorgeschrieben.
- **Wie die Kapitel sich optisch unterscheiden** — Gewicht, Breite, Grundton,
  Kopfzeilenformat. Nur „zehn gleiche Rahmen" ist ausgeschlossen.
- **Ob die Sprungleiste klebt, sich einklinkt oder im Hero sitzt.** Bedingung
  ist allein: beim Öffnen ohne Scrollen sichtbar, beim Scrollen erreichbar.
- **Was mit den zehn `.sd__code`-Zeilen geschieht** (heute 6× nur
  „Anvil Aerospace"). Kürzen, zusammenfassen oder streichen — alles zulässig,
  solange die *Stand*-Angaben je Datenquelle nachlesbar bleiben.
- **Ob die Beschreibung ihren Platz behält.** Sie steht heute ohne Rahmen und
  ohne Überschrift zwischen zwei Panels.

---

## Verbindliche Bezugsdokumente

**Nachgelagerte Agenten müssen diese vor Planung und Umsetzung lesen.**

### Hausregeln

- `CLAUDE.md` — insbesondere: vor jedem Push `npm run build && npm run gate`;
  bei Layout-Änderungen zusätzlich der Vorschau-Bau mit `STAGING=1`; bei
  sichtbaren Ergebnissen erst hinsehen, dann berichten; Sichturteile gehen als
  benannter Punkt nach `.planning/WINDOWS.md`.
- `docs/maschinelle-validierung.md` — die sieben Grundsätze für neue Tore. Ein
  neues `verify:*` muss in `scripts/lib/gate-registry.mjs` eingetragen werden
  (`verify:wiring` erzwingt das) **und einmal vorgeführt rot gewesen sein.**

### Der Körper

- `src/components/ShipDetail.astro` (2141 Zeilen) — Frontmatter bis Zeile 378,
  `<style is:inline>` ab 388, Markup ab 985, Skripte ab 1617.
- `src/pages/schiffe/[slug].astro` und `src/pages/de/schiffe/[slug].astro` — je
  27 Zeilen, reine Wrapper. **Eine Änderung im Körper landet in beiden Sprachen
  zugleich.**
- `src/i18n/ui.ts` — alle `ship.*`-Schlüssel. Jede neue sichtbare Zeichenkette
  braucht hier ihren DE- und EN-Eintrag.
- `src/lib/shipVisuals.ts` (`buildVisuals`) und `src/lib/shipExtras.ts`
  (`buildProfile`, `similarShips`) — liefern die Balkendaten. D-02 wird
  vermutlich hier ansetzen, nicht nur im Markup.

---

## Erkenntnisse aus dem Bestand

### Ausgangsmessung — Carrack, 1280 × 720, Dev-Server, 18.08.2026

| gemessen | Wert |
| --- | --- |
| Seitenhöhe | **5.554 px = 7,7 Bildschirme** |
| Blöcke unter dem Hero | 14 |
| `.sd__panel` | 10 |
| Balkenspuren (`.sd__gtrack` + `.sd__proftrack`) | 20 |
| `.sd__code`-Zeilen | 10, davon 6 nur „Anvil Aerospace" |
| Sprungmarken | **0** |

Blockhöhen in Scrollreihenfolge: Hero 540 · Kennwerte-Leiste 90 · Kaufen im
Verse 351 · Leistungsprofil 382 · Beschreibung 159 · Datenblatt 228 · Maße &
Fracht 556 · Bewaffnung 529 · Flugleistung 515 · Komponenten & Verteidigung 299
· Versicherung 238 · Lackierungen 268 · Varianten & Loaner 210 · Ähnliche
Schiffe 261 · Links 43 · Quellenzeile 49.

### Die Doppelungen, maschinell gezählt

Ausgelesen aus dem gerenderten DOM (Regex über „Zahl + Einheit", je Block
einmal gezählt):

| Wert | steht in |
| --- | --- |
| `126 m` | Hero-Zeile, Kennwerte-Leiste, Maße & Fracht, Ähnliche Schiffe — **4×** |
| `456 SCU` | Kennwerte-Leiste, Leistungsprofil, Maße & Fracht — **3×** |
| `140 m/s` | Kennwerte-Leiste, Leistungsprofil, Flugleistung — **3×** |
| `74 m` | Hero-Zeile, Maße & Fracht |
| `30 m` | Hero-Zeile, Maße & Fracht |
| `319.000 km/s` | Leistungsprofil, Flugleistung |
| `10,6 SCU` | Maße & Fracht, Flugleistung |

**Vom Zähler nicht erfasst, aber genauso doppelt:**

- **Das Panel „Datenblatt" ist zu 100 % redundant.** Alle sechs Felder stehen
  schon woanders: *Typ*, *Größe* und *Status* als Chips unter dem Titel,
  *Besatzung* in der Kennwerte-Leiste, *Preis (Pledge)* im Kauf-Panel,
  *Hersteller* als Logo im Hero und 6× in den `.sd__code`-Zeilen.
- `Hülle 88.000 HP` + `Schilde 144.000 HP` ergeben exakt die `232.000 HP`, die
  zwei Panels weiter oben als „Defense" im Leistungsprofil stehen.
- Der Kaufpreis `34.398.000 aUEC` steht in der Kennwerte-Leiste und als
  Preis-Held im Kauf-Panel.
- Die Quellenzeile am Fuß wiederholt alle „Stand"-Daten, die schon in den
  `.sd__code`-Zeilen der einzelnen Panels stehen.

### Geltende Muster und Fallen

- **Kein `detail.css` auf Schiffsseiten.** Im gebauten
  `dist/schiffe/anvl-carrack.html` stehen nur `fonts.css`, `mobile-ux.css`,
  `theme.css`. Die site-weite Falle `section{padding:clamp(3rem,7vw,5.5rem) …}`
  (`detail.css:65`) greift hier **nicht** — und die lokale Regel
  `*{margin:0;padding:0}` (`ShipDetail.astro:404`) neutralisiert sie
  zusätzlich. ⚠ Wer diese Zeile anfasst oder das Stilblatt umhängt, holt die
  Falle zurück; sie hat in diesem Projekt schon zwei Layouts zerlegt.
- **Alles liegt in `<style is:inline>`.** Darin verpufft `:global()` still —
  dort normales CSS schreiben.
- **Ein Ausdruck auf oberster Ebene** verschluckt in Astro 5.18 das schließende
  Tag; Ausweg ist `set:text` / `set:html`.
- **Die Sperrklinken-Regel** (`docs/maschinelle-validierung.md`, Grundsatz 5):
  die gemessene Seitenhöhe wandert nur nach unten; nach oben nur per Commit,
  dessen Botschaft die Ursache nennt.

### Anschlussstellen

- `.sd{max-width:var(--maxw);margin:0 auto;padding:1.8rem clamp(1rem,3vw,2.5rem) 4rem}`
  — die eine Spalte, in der heute alles untereinander steht (Zeile 730).
- `.sd__panel` (Zeile 739) — der Einheitsrahmen: `border:1px solid var(--line)`,
  `border-top:2px solid var(--accent)`.
- `.holo__bar` (Zeile 718 ff.) — die Kennwerte-Leiste unter dem Hero; bei
  ≤ 760 px zweispaltig.
- `.sd__g` / `.sd__grow` / `.sd__gtrack` / `.sd__gfill` — die generische
  Balkenzeile, die an vier Stellen wiederverwendet wird und nach D-02 an drei
  davon verschwindet.

---

## Konkrete Vorgaben

1. **Messen vor und nach.** Die Ausgangswerte oben sind der Bezug. Die
   Schlussmessung läuft an derselben Seite, derselben Breite, demselben
   Werkzeug.
2. **Nicht nur die Carrack.** Die Carrack ist gut gefüllt. Mindestens ein
   karges Schiff (viele Panels fallen mangels Daten weg) und ein sehr großes
   muss mitgeprüft werden — sonst kippt die Kapitelgliederung dort, wo drei von
   vier Kapiteln leer sind.
3. **DE und EN in einem Schritt** — ein Körper, aber die Sichtprüfung gilt erst
   für beide.
4. **360 px** ist die untere Prüfbreite. Eine Sprungleiste, die dort bricht,
   ist nicht fertig.
5. **Die Entdopplung wird maschinell belegt**, nicht behauptet: ein Skript, das
   die sieben Werte im gebauten HTML zählt, ist die Abnahme für
   Erfolgskriterium 1 — und muss vor der Umsetzung einmal vorgeführt rot sein.
