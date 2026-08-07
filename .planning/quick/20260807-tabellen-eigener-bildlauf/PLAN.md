---
phase: 20260807-tabellen-eigener-bildlauf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - assets/mobile-ux.css
  - assets/scroll-affordance.js
  - assets/data-page.css
  - src/components/ItemFinderApp.astro
  - src/components/CraftingApp.astro
  - src/components/MiningApp.astro
  - src/components/MissionsApp.astro
  - src/components/RefineryFinder.astro
  - src/components/ItemListing.astro
  - src/components/CraftingListing.astro
  - src/components/ArmorSets.astro
  - src/i18n/itemText.ts
autonomous: false
requirements:
  - SCROLL-01   # Mausrad ueber der Ergebnisliste bewegt NUR die Ergebnisliste
  - SCROLL-02   # Mausrad daneben (Filterspalte, Kopf, Seitenrand) bewegt die Seite
  - SCROLL-03   # Kein Scroll-Chaining: overscroll-behavior contain auf jedem Kasten
  - SCROLL-04   # Filterspalte bleibt unabhaengig erreichbar und scrollbar
  - SCROLL-05   # Mobil faellt das Verhalten auf den alten Seitenfluss zurueck
  - SCROLL-06   # Jeder neue Kasten hat eine SICHTBARE Bildlaufleiste (Pflichteintrag)
  - SCROLL-07   # DE und EN verhalten sich identisch
  - SCROLL-08   # Tastatur erreicht jeden Kasten ohne fokussierbare Kinder

must_haves:
  truths:
    - "Auf /item-finder.html (DE und EN) bewegt das Mausrad ueber den Trefferkarten nur die Trefferkarten; window.scrollY der Seite bleibt dabei unveraendert."
    - "Auf denselben Seiten bewegt das Mausrad ueber der Filterspalte nur die Filterspalte, und ueber Kopfbereich oder Seitenrand die Seite."
    - "Am unteren Ende der Ergebnisliste laeuft das Weiterscrollen NICHT in die Seite ueber (kein Chaining)."
    - "Die Filterspalte des Item Finders ist auf jeder Fensterhoehe bis zur letzten Kategorie erreichbar, ohne die Ergebnisliste anzufassen."
    - "Jeder Bildlauf-Kasten zeigt eine sichtbare Bildlaufleiste — auch die drei Filterspalten, die heute schon scrollen und dabei nichts anzeigen."
    - "Unter 821 px Fensterbreite gibt es keinen Kasten: die Seite verhaelt sich wie heute (getComputedStyle(kasten).maxHeight === 'none')."
    - "Dieselben Saetze gelten Wort fuer Wort fuer die deutschen Pfade unter /de/."
    - "Die Blaetterung bzw. der Abschnitt UNTER der Liste ist ohne Scrollen durch die ganze Liste sichtbar."
  artifacts:
    - assets/mobile-ux.css
    - assets/scroll-affordance.js
    - assets/data-page.css
    - src/components/ItemFinderApp.astro
    - src/components/CraftingApp.astro
    - src/components/MiningApp.astro
    - src/components/MissionsApp.astro
    - src/components/RefineryFinder.astro
  key_links:
    - "assets/theme.css blendet mit `html, body, *{scrollbar-width:none!important}` JEDE Leiste aus. Ohne Eintrag in der Ausnahmeliste in assets/mobile-ux.css ist ein neuer Kasten unsichtbar scrollbar — der Pflichteintrag ist Teil der Mechanik, nicht Kosmetik."
    - "Kanonisch ist `assets/`, NICHT `public/assets/` — letzteres ist ein von scripts/_sync-assets.mjs erzeugter, gitignorierter Spiegel (aktuell nachweislich veraltet: data-page.css weicht ab)."
    - "Eine Zahl je Seite: `--vb-top` beschreibt alles, was ueber dem Kasten am Fenster klebt. Kasten UND Filterspalte lesen dieselbe Zahl — dadurch sind sie zwangslaeufig gleich hoch und beginnen auf derselben Linie."
    - "`--nav-h` kommt aus SiteNav (68/107/132 px je nach Zurueck-Zeile). Die drei Filterspalten rechnen heute mit festen 146px/162px und verrutschen, sobald die Zurueck-Zeile da ist — die Umstellung auf --vb-top behebt das nebenbei."
    - "Astro-Falle: in `<style is:inline>` ist `:global()` kein gueltiges CSS, der Browser verwirft die ganze Regel still. Alle Selektoren hier sind einfache Klassen — es wird an keiner Stelle gebraucht."
    - "versioned() haengt den sha1-Inhaltshash an theme.css / mobile-ux.css / data-page.css — der Cache-Bust laeuft von selbst. Dev-Falle: der Hash wird pro Prozess gemerkt, nach Asset-Aenderung Dev-Server neu starten."
---

<objective>
Auf allen Daten- und Durchsuchungsseiten bekommt die Ergebnisliste einen eigenen Bildlaufbereich
mit begrenzter Hoehe, damit Ergebnisse und Filter voneinander entkoppelt sind.

Purpose: Wortlaut der Meldung — man muss heute erst die komplette Ergebnisliste durchscrollen,
bevor die Seite weiterscrollt und die Filter sichtbar werden. Die Ergebnisliste ist der laengste
Teil der Seite und liegt zwischen dem Nutzer und allem, was darunter oder daneben steht.

Output: EINE Utility-Klasse `.vb-scrollbox` in assets/mobile-ux.css, je Seite EINE Zahl
(`--vb-top`), acht Kaesten, die drei heute unsichtbar scrollenden Filterspalten sichtbar gemacht,
und ein Pruefplan fuer DE und EN.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@assets/mobile-ux.css
@assets/theme.css
@assets/scroll-affordance.js
@assets/data-page.css
@src/components/ItemFinderApp.astro
@src/components/CraftingApp.astro
@src/components/MiningApp.astro
@src/components/MissionsApp.astro
@src/components/RefineryFinder.astro
@src/components/ItemListing.astro
@src/components/CraftingListing.astro
@src/components/ArmorSets.astro
@src/components/DataShell.astro
@src/layouts/Layout.astro
</context>

---

## Befund: was heute schon scrollt und was nicht

Gelesen wurden alle acht Komponenten samt der drei geteilten Asset-Dateien. Der Befund weicht in
zwei Punkten von der Ausgangsvermutung ab, und beide Abweichungen aendern den Plan.

| Ort | Ergebnisliste | Filterspalte | Bildlaufleiste sichtbar? |
|---|---|---|---|
| ItemFinderApp `.uif-results` | **kein** eigener Bildlauf | `.uif-sidebar` klebt (`top:4.6rem`), **ohne** max-height/overflow | — |
| CraftingApp `.cdb-grid` | **kein** eigener Bildlauf | `.cdb-sidebar` `max-height:calc(100vh - 162px); overflow:auto` | **nein** |
| CraftingApp `.calc-grid` (Rechner) | **kein** eigener Bildlauf | `.calc-sidebar` wie oben | **nein** |
| MiningApp `.mdb-grid` | **kein** eigener Bildlauf | `.mdb-sidebar` wie oben | **nein** |
| MissionsApp `.mx__grid` | **kein** eigener Bildlauf (432 Karten im DOM) | keine Spalte, klebende Leiste `.mx__bar` | — |
| RefineryFinder `.rff__list` / `.rff__scroll` | nur waagerecht (`.rff__scroll`) | Leiste `.rff__bar`, **nicht** klebend | nein |
| ItemListing / CraftingListing `.dp-tablewrap` | nur waagerecht, 100 Zeilen je Seite | keine | nein |
| ArmorSets | Dokument mit Sprungmarken, keine Liste | `.as-jump` oben, **nicht** klebend | — |

**Abweichung 1 — die eigentliche Wurzel im Item Finder.** `.uif-sidebar` klebt bei
`top: var(--uif-stick)`, hat aber weder `max-height` noch `overflow`. Ist die Filterspalte
hoeher als das Fenster — und das ist sie, sie traegt Suche, vier Chip-Gruppen und die volle
Kategorienliste —, dann nagelt `position: sticky` ihre OBERKANTE fest und der untere Teil ist
mit keiner Geste erreichbar, ausser man scrollt die ganze Seite. Das ist exakt der gemeldete
Ablauf. Ein Kasten um die Ergebnisse allein wuerde ihn nicht beheben.

**Abweichung 2 — drei Filterspalten scrollen heute schon unsichtbar.** `.cdb-sidebar`,
`.mdb-sidebar` und `.calc-sidebar` haben `overflow:auto` — und `assets/theme.css` blendet mit
`html, body, *{scrollbar-width:none!important}` jede Leiste der Seite aus. Sie stehen nicht in
der Ausnahmeliste in mobile-ux.css. Dasselbe gilt fuer `.cdb-res-list` und `.calc-mat-list`:
die bringen eigene `::-webkit-scrollbar`-Regeln mit, aber **ohne** `!important` — die globale
`display:none!important` gewinnt, die Regeln sind seit jeher tot. Das gehoert in dieselbe
Runde, weil es dieselbe Ursache hat.

**Abweichung 3 — kanonischer Ordner.** Die Zuarbeit nannte `public/assets/…`. Kanonisch ist
`assets/` im Wurzelverzeichnis; `public/assets/` ist ein von `scripts/_sync-assets.mjs` vor
jedem `dev`/`build` erzeugter, gitignorierter Spiegel. Nachgemessen: `assets/data-page.css`
(sha1 46c270cd) und `public/assets/data-page.css` (599783a3) weichen aktuell voneinander ab —
der Spiegel ist veraltet. **Jede Aenderung geht nach `assets/`.** Wer `public/assets/` anfasst,
verliert sie beim naechsten Build.

---

## Entscheidung: eine Utility-Klasse statt acht Einzelloesungen

### Warum EINE Klasse

Acht Kaesten in sechs Dateien mit je eigener Hoehenrechnung waeren acht Stellen, an denen der
Pflichteintrag fuer die Bildlaufleiste vergessen werden kann — und genau das ist bei den drei
Filterspalten bereits passiert. Die Klasse `.vb-scrollbox` steht deshalb **unmittelbar neben**
der bestehenden Ausnahmeliste (Abschnitt 5c) in `assets/mobile-ux.css`. Wer den Kasten
hinschreibt, sieht drei Zeilen darunter, warum er ohne Eintrag unsichtbar waere.

Warum `assets/mobile-ux.css` und nicht `assets/theme.css` oder `assets/data-page.css`:

| Datei | Geladen von | Passt? |
|---|---|---|
| `assets/theme.css` | Layout.astro, also jede Seite | Nein — laut eigenem Kopfkommentar „keine Layout-Regeln, nur Farbwerte" |
| `assets/data-page.css` | nur DataShell (~17.000 Verzeichnisseiten) | Nein — Item Finder, Crafting, Mining, Missionen laden sie nicht |
| `assets/mobile-ux.css` | Layout.astro, also jede Seite — **auch die DataShell-Seiten**, denn DataShell rendert in Layout | **Ja** — und der Pflichteintrag steht bereits darin |
| Neue Datei `assets/scrollbox.css` | muesste in Layout verlinkt werden | Nein — dritte blockierende Stylesheet-Anfrage auf ~26.000 Seiten fuer ~30 Zeilen |

Der Name der Datei sagt „mobile", der Inhalt laengst nicht mehr nur: Abschnitt 5c wurde am
31.07. ausdruecklich entgated, weil die Bildlaufleisten auch am Desktop fehlten. Der neue
Abschnitt reiht sich dort ein und begruendet das im Kopf.

### Die Hoehenrechnung: eine Zahl je Seite

```
max-height: calc(100dvh - var(--vb-top) - var(--vb-air))
```

* `--vb-top` — alles, was UEBER dem Kasten dauerhaft am Fenster klebt: die feste Site-Nav
  (`var(--nav-h, 68px)`, mit Zurueck-Zeile 107 px, mobil 132 px) plus die klebende Filter-
  oder Kopfleiste der jeweiligen Seite. Das ist die einzige Zahl, die eine Komponente kennen
  muss.
* `--vb-air` — Luft unter dem Kasten, Rueckfall 5rem. Nicht Kosmetik: eine Unterkante buendig
  mit dem Fensterrand liest sich als Seitenende. Die 5rem lassen die Blaetterung bzw. den
  naechsten Abschnitt angeschnitten stehen und beantworten damit im ersten Bild die Frage,
  die der Kasten sonst aufwirft.
* `100dvh`, nicht `100vh`: `dvh` misst den tatsaechlich sichtbaren Bereich. Eine
  `100vh`-Zeile steht als Rueckfall unmittelbar davor (Doppel-Deklaration, aeltere Browser
  nehmen die erste, neuere die zweite).

**Kasten und Filterspalte lesen dieselbe `--vb-top`.** Dadurch sind sie zwangslaeufig gleich
hoch und beginnen auf derselben Linie — das laesst sich nicht auseinanderpflegen. Die
Filterspalte bekommt allerdings weniger Luft nach unten (`1rem` statt `5rem`): sie braucht
keinen Ausblick auf das, was darunter steht, sondern Hoehe.

Nebenwirkung, die eigenstaendig ein Fehler war: `.cdb-sidebar`, `.mdb-sidebar` und
`.calc-sidebar` rechnen heute mit festen `top:146px` / `max-height:calc(100vh - 162px)`. Die
146 sind 68 px Nav plus Filterleiste — sobald die Nav ihre Zurueck-Zeile traegt, ist sie 107
oder 132 px hoch und die Filterspalte verschwindet zu 39 bzw. 64 px dahinter. Mit `--vb-top`
auf `--nav-h` ist das erledigt.

### Das Mobil-Verhalten: unter 821 px gibt es keinen Kasten

Gewaehlt: **Rueckfall auf den alten Seitenfluss unterhalb 821 px**, nicht ein grosszuegiger
Grenzwert. Vier Gruende, in dieser Reihenfolge:

1. **Das gemeldete Problem existiert dort nicht.** Mobil sind `.cdb-sidebar` und
   `.mdb-sidebar` ausfahrende Panels (`position:fixed`, `data-offcanvas`) — die Filter sind
   einen Tipp entfernt, nicht eine Ergebnisliste entfernt. Beim Item Finder steht die
   Filterspalte ueber den Ergebnissen statt daneben.
2. **Die Rechnung geht nicht auf.** Auf einem 667-px-Fenster bleiben nach Nav und Filterleiste
   ~430 px; abzueglich Luft ~360 px, also zwei Karten. Ein Kasten, der zwei Karten zeigt, ist
   kein Kasten, sondern ein Schlitz.
3. **Verschachtelter Bildlauf auf Touch trifft auf zwei bestehende Mechanismen.**
   `assets/scroll-lock.js` friert den Rumpf mit `position:fixed` ein, sobald ein Panel offen
   ist; `assets/offcanvas.js` deutet einen Wisch nach links als Schliessen. Ein zusaetzlicher
   Bildlaufbereich in derselben Flaeche ist eine Gestenkollision ohne Gegenwert.
4. **821 px ist bereits die Zahl des Hauses.** Regel 1 in mobile-ux.css, `isDrawerMode()` in
   offcanvas.js, die Panel-Umschaltung in Crafting und Mining — alle bei 820. Eine zweite
   Grenze einzufuehren waere eine Zahl mehr, die auseinanderlaufen kann.

Ausnahme mit eigener Grenze: der Item Finder schaltet sein Layout bei **900 px** um
(`.uif-sidebar{position:static}`). Dort wird der Kasten in genau diesem bestehenden
`@media (max-width: 900px)`-Block wieder abgeschaltet — zwei Zeilen, direkt neben den anderen
900er-Regeln.

`overscroll-behavior: contain` steht dagegen **ausserhalb** der Medienabfrage, auf jeder
Breite. Es schadet einem Element ohne eigenen Bildlauf nicht und wirkt sofort, sobald doch
einer entsteht — etwa bei den kleinen Listen in der Filterspalte, die auch mobil scrollen.

### Was NICHT gemacht wird, und warum

**`.vb-scrollbox` kommt NICHT in `SEL_DRAG` von assets/scroll-affordance.js.** Das Ziehen mit
gedrueckter Maustaste setzt `cursor: grab` auf die ganze Flaeche. Ueber einem Raster aus
anklickbaren Karten sagt das die Unwahrheit: dort wird geklickt, nicht geschoben. Die
Klick-Unterdrueckung (`data-dragged`) waere zwar da, aber der Zeiger verspricht das Falsche.
Waagerechte Kaesten sind ein anderer Fall — dort gibt es nichts zu klicken und die Leiste ist
ein 8-px-Streifen am unteren Rand.

**`.vb-scrollbox` kommt NICHT in `SEL_FADE`.** Die dortige Maske ist waagerecht
(`linear-gradient(90deg, …)`) und wuerde am rechten Rand ausblenden statt am unteren. Die
senkrechte Kante bekommt eine eigene Liste (`SEL_VFADE`, Task 7) und eine eigene Klasse
(`is-more-y`). **Regel: ein Kasten wird fuer hoechstens EINE Achse eingetragen** — sonst
muessten sich zwei Masken ueberlagern (`mask-composite`), und genau dieser Fall tritt bei
`.dp-tablewrap` auf, das beide Achsen scrollt. Deshalb bleibt `.dp-tablewrap` aus der
waagerechten Liste heraus (so ist es heute schon) und bekommt nur die senkrechte.

**ArmorSets bekommt keinen Kasten.** Die Seite ist kein Ergebnisraster, sondern ein Dokument
aus verschachtelten Abschnitten mit Sprungmarken (`#mfr-…`) und einer eigenen
`scroll-margin-top`-Regel aus mobile-ux.css. Ein Kasten waere die ganze Seite. Das Beduerfnis
dahinter — „ich komme an die Navigation nicht heran, ohne alles durchzuscrollen" — ist
dasselbe und wird dort mit dem passenden Mittel beantwortet: `.as-jump` wird klebend. Das ist
kein verkleinerter Umfang, sondern dieselbe Absicht mit dem Mittel, das die Seitenform
zulaesst.

---

<tasks>

<task type="tracer">
  <name>Task 1: Fundament — die Klasse .vb-scrollbox und der Pflichteintrag</name>
  <files>assets/mobile-ux.css</files>
  <reversibility rating="reversible">Reines CSS in einer Datei, ohne Aufrufer. Zurueckdrehen = Abschnitt loeschen.</reversibility>
  <action>
Neuer Abschnitt **„5d) Eigener Bildlaufbereich fuer Ergebnislisten"** unmittelbar NACH dem
bestehenden Abschnitt 5c (der Ausnahmeliste fuer die waagerechten Kaesten, heute Zeilen
~435–529) und VOR dem Abschnitt zum Schieben mit der Maus. Die Platzierung ist Absicht und
gehoert als Satz in den Kopfkommentar: der Pflichteintrag steht dadurch in Sichtweite.

Kopfkommentar (deutsch, ohne Umlaute — so haelt es diese Datei durchgehend) haelt fest:
warum es die Klasse gibt (Ergebnisliste und Filter entkoppeln), was `--vb-top` und `--vb-air`
bedeuten, warum die Grenze bei 821 px liegt (die vier Gruende aus dem Entscheidungsabschnitt,
knapp), und dass jeder neue Kasten in die Leisten-Gruppe darunter eingetragen werden MUSS,
weil assets/theme.css sonst seine Leiste ausblendet.

Drei Regelgruppen:

**1. Die Klasse.** `overscroll-behavior: contain` steht ausserhalb der Medienabfrage. Innerhalb
`@media (min-width: 821px)`: die Doppel-Deklaration `max-height` mit `100vh` und danach
`100dvh`, jeweils minus `var(--vb-top, 12rem)` minus `var(--vb-air, 5rem)`; dazu
`overflow-y: auto`, `scrollbar-gutter: stable` und `padding-block: 3px`. Die letzten beiden
brauchen je einen Halbsatz Begruendung: die Rinne wird dauerhaft reserviert, sonst springt das
Raster um 8 px zur Seite, sobald ein Filter die Liste unter die Kastenhoehe drueckt; der
Innenabstand faengt den Hover-Hub der Karten (`translateY(-2px)` plus Schatten) ab, der an
Ober- und Unterkante sonst abgeschnitten wird.

**2. Der Pflichteintrag, senkrechte Ausfuehrung.** Eine eigene Gruppe, NICHT die von 5c
erweitern: dort steht `height: 8px` fuer die waagerechte Leiste und ein Verlauf an der rechten
Kante — beides waere hier falsch. Selektorliste: `.vb-scrollbox`, `.uif-sidebar`,
`.cdb-sidebar`, `.mdb-sidebar`, `.calc-sidebar`. Eigenschaften: `scrollbar-width: thin
!important`, dazu `scrollbar-color` aus `color-mix(in srgb, var(--tone-1, var(--accent)) 55%,
transparent) transparent`. `--tone-1` zuerst, weil die Verzeichnisseiten ihren Leitton dort
fuehren und im Crafting-Zweig `--accent` die falsche Farbe waere; ausserhalb von `.dp` ist
`--tone-1` nicht gesetzt und der Rueckfall greift. Dazu die `::-webkit-scrollbar`-Gruppe mit
`display: block !important`, `width: 8px !important`, `height: 8px !important` (fuer
`.dp-tablewrap`, das beide Achsen scrollt) und transparentem Hintergrund, sowie
`::-webkit-scrollbar-thumb` mit derselben `color-mix`-Farbe und `border-radius: 999px`.

Das `!important` ist Pflicht und braucht einen Satz: `assets/theme.css` setzt
`*{scrollbar-width:none!important}` und `*::-webkit-scrollbar{display:none!important}`. Ohne
`!important` verliert jede Regel hier — das ist am 31.07. schon einmal passiert und in 5c
dokumentiert.

**3. Kleine Kaesten in den Filterspalten.** Selektorliste `.cdb-res-list`, `.calc-mat-list`,
`.cbm__mis`, `.mm__terms`, `.cdb-plan-shop`: `overscroll-behavior: contain` (auf jeder Breite)
und dieselbe Leisten-Gruppe, aber mit `width: 6px`. Begruendungssatz: diese Listen bringen in
CraftingApp.astro eigene `::-webkit-scrollbar`-Regeln mit, aber ohne `!important` — sie sind
seit jeher wirkungslos, die Gruppe hier ersetzt sie. Die alten Regeln in der Komponente
bleiben unangetastet, um den Diff klein zu halten.

Keine Hex-Werte (Regel 2 der Datei), keine Aenderung an bestehenden Regeln.
  </action>
  <verify>
    <automated>cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/gsd-staging-local-review-dc5792" &amp;&amp; test $(grep -cE '^\.vb-scrollbox[ ,{:]' assets/mobile-ux.css) -ge 3 &amp;&amp; test $(grep -cE '^\.uif-sidebar[,{]' assets/mobile-ux.css) -ge 1 &amp;&amp; test $(grep -cE '^\.cdb-res-list[,{]' assets/mobile-ux.css) -ge 1 &amp;&amp; test $(grep -c 'min-width: 821px' assets/mobile-ux.css) -ge 1 &amp;&amp; test $(grep -c 'scrollbar-gutter: stable' assets/mobile-ux.css) -ge 1 &amp;&amp; test $(grep -c '100dvh' assets/mobile-ux.css) -ge 1 &amp;&amp; test $(grep -c 'scrollbar-width: thin !important' assets/mobile-ux.css) -ge 2 &amp;&amp; node -e "const s=require('fs').readFileSync('assets/mobile-ux.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;if(o!==c){console.error('Klammern unpaarig',o,c);process.exit(1)}" &amp;&amp; node -e "const s=require('fs').readFileSync('assets/mobile-ux.css','utf8');if(/#[0-9a-fA-F]{3,8}\b/.test(s.split('5d)')[1]||'')){console.error('Hex-Wert im neuen Abschnitt');process.exit(1)}" &amp;&amp; echo TASK1_OK</automated>
  </verify>
  <done>assets/mobile-ux.css traegt Abschnitt 5d mit der Klasse, der senkrechten Leisten-Gruppe fuer Kasten und Filterspalten und der 6-px-Gruppe fuer die kleinen Listen; Klammern paarig, keine Hex-Werte, keine bestehende Regel angefasst.</done>
</task>

<task type="auto">
  <name>Task 2: Item Finder — Filterspalte erreichbar machen, Ergebnisse in den Kasten</name>
  <files>src/components/ItemFinderApp.astro</files>
  <reversibility rating="reversible">Nur CSS im inline-Block plus eine Klasse im Markup.</reversibility>
  <action>
Der Item Finder ist der Ort, an dem die Meldung entstanden ist, und der einzige, an dem der
Kasten allein nicht reicht — hier fehlt der Filterspalte der eigene Bildlauf ganz.

**a) `--vb-top` auf `.uif-container`.** Neben dem bestehenden `--uif-stick: 4.6rem` eine zweite
Zeile: `--vb-top: calc(var(--uif-stick) + 3.8rem)`. Die 3.8rem sind die Hoehe der klebenden
`.uif-header` (Trefferzahl, Ansichtsumschalter, Sortierung) als **Startwert** — er wird in
Task 9 nachgemessen und korrigiert. Dazu ein Kommentar: `--uif-stick` ist bereits der Abstand
unter der festen Nav, `--nav-h` darf hier deshalb NICHT noch einmal addiert werden.

**b) `.uif-sidebar` bekommt den eigenen Bildlauf.** An die bestehende Regel:
`max-height: calc(100dvh - var(--uif-stick) - 1rem)`, `overflow-y: auto`,
`overscroll-behavior: contain`. Begruendender Kommentarblock daneben — das ist der Kern des
gemeldeten Fehlers und darf nicht als Kosmetik gelesen werden: eine klebende Spalte, die
hoeher ist als das Fenster, nagelt ihre Oberkante fest, und der untere Teil (hier: die
gesamte Kategorienliste) ist mit keiner Geste erreichbar, ausser man scrollt die ganze Seite
an der Ergebnisliste vorbei. `1rem` statt `--vb-air`, weil die Filterspalte Hoehe braucht und
keinen Ausblick auf das, was darunter steht.

**c) Der Kasten.** Im Markup bekommt `<div class="uif-results" id="uif-results-grid">` die
zusaetzliche Klasse `vb-scrollbox`. Kein weiteres CSS noetig — die Klasse rechnet mit
`--vb-top` vom Container.

**d) Der Ausschalter bei 900 px.** Im bestehenden `@media (max-width: 900px)`-Block, direkt bei
den anderen `.uif-sidebar`-Regeln: fuer `.uif-sidebar` und `.uif-results` je
`max-height: none` und `overflow-y: visible`. Kommentar: die geteilte Regel schaltet bei
821 px ab, der Item Finder stapelt aber schon bei 900 — zwischen beiden Zahlen stuende sonst
ein Kasten in einem gestapelten Layout.

Nichts an `.uif-header`, `.uif-pagination`, am Modal oder an `.uif-table-wrapper` aendern. Der
Klebepunkt der Kopfleiste bleibt, wie er ist: `.uif-main` wird NICHT zum Bildlaufbehaelter,
sonst klebte die Kopfleiste am Kasten statt am Fenster.
  </action>
  <verify>
    <automated>cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/gsd-staging-local-review-dc5792" &amp;&amp; test $(grep -c 'uif-results vb-scrollbox' src/components/ItemFinderApp.astro) -eq 1 &amp;&amp; test $(grep -c '\-\-vb-top' src/components/ItemFinderApp.astro) -ge 1 &amp;&amp; test $(grep -c 'overscroll-behavior: contain' src/components/ItemFinderApp.astro) -ge 1 &amp;&amp; test $(grep -c 'max-height: none' src/components/ItemFinderApp.astro) -ge 1 &amp;&amp; test $(grep -c 'uif-main { flex-grow: 1; min-width: 0; }' src/components/ItemFinderApp.astro) -eq 1 &amp;&amp; echo TASK2_OK</automated>
  </verify>
  <done>Die Filterspalte des Item Finders ist bis zur letzten Kategorie erreichbar, ohne die Seite zu scrollen; die Trefferkarten liegen im Kasten; unter 900 px ist beides aus; `.uif-main` ist unveraendert.</done>
</task>

<task type="auto">
  <name>Task 3: Crafting-DB und Zerlege-Rechner — zwei Layouts, dieselbe Zahl</name>
  <files>src/components/CraftingApp.astro</files>
  <reversibility rating="reversible">CSS im inline-Block plus zwei Klassen im Markup.</reversibility>
  <action>
Zwei Layouts in einer Datei: `.cdb-layout` (Blueprint-Datenbank) und `.calc-layout`
(Zerlege-Rechner). Beide bekommen dieselbe Behandlung; die Werte sind identisch, weil beide
unter derselben klebenden `.cdb-bar` sitzen.

**a) Tokens.** An `.cdb-layout` und an `.calc-layout` je
`--vb-top: calc(var(--nav-h, 68px) + 4.4rem)`. Die 4.4rem sind `.cdb-bar` (Innenabstand
2 × .7rem plus ~2rem Bedienelemente) als Startwert fuer Task 9.

**b) Die drei festen Pixelwerte ausbauen.** `.cdb-sidebar` und `.calc-sidebar` tragen heute
`top:146px` und `max-height:calc(100vh - 162px)`. Beide werden zu `top: var(--vb-top)` und
`max-height: calc(100dvh - var(--vb-top) - 1rem)`, dazu `overscroll-behavior: contain`.
Kommentar mit dem Grund: die 146 waren 68 px Nav plus Leiste — sobald die Nav ihre
Zurueck-Zeile traegt, ist sie 107 px (mobil 132 px) hoch und die Filterspalte verschwand zu
39 bzw. 64 px dahinter. `--nav-h` kommt aus SiteNav und traegt diese Faelle bereits.

**c) Die Kaesten.** Im Markup:
`<div class="cdb-grid" id="cdb-grid">` → zusaetzlich `vb-scrollbox`;
`<div id="calc-results" class="calc-grid">` → zusaetzlich `vb-scrollbox`.

**d) Der Rechner-Ausschalter bleibt.** Der bestehende `@media(max-width:820px)`-Block setzt
`.calc-sidebar{position:static;max-height:none}` — das passt zur neuen Grenze und bleibt
unveraendert. Fuer `.cdb-sidebar` gilt weiter die Panel-Regel (`position:fixed; height:100%;
max-height:none`); auch die bleibt.

Nicht anfassen: die Zaehlzeile `.cdb-count-row` (sie darf mitscrollen, sie ist zwei Zeilen
hoch), das Modal, der Planer-Schub, `.cdb-res-list` (deren `overscroll-behavior` kommt aus
Task 1) und der von `scripts/build-light-overrides.mjs` erzeugte Block am Dateiende — es
kommen keine Farbwerte dazu, er muss nicht neu erzeugt werden.
  </action>
  <verify>
    <automated>cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/gsd-staging-local-review-dc5792" &amp;&amp; test $(grep -c 'cdb-grid vb-scrollbox' src/components/CraftingApp.astro) -eq 1 &amp;&amp; test $(grep -c 'calc-grid vb-scrollbox' src/components/CraftingApp.astro) -eq 1 &amp;&amp; test $(grep -c '\-\-vb-top' src/components/CraftingApp.astro) -ge 4 &amp;&amp; test $(grep -c 'top:146px' src/components/CraftingApp.astro) -eq 0 &amp;&amp; test $(grep -c '100vh - 162px' src/components/CraftingApp.astro) -eq 0 &amp;&amp; test $(grep -c 'overscroll-behavior:contain' src/components/CraftingApp.astro) -ge 2 &amp;&amp; test $(grep -c 'build-light-overrides' src/components/CraftingApp.astro) -eq 1 &amp;&amp; echo TASK3_OK</automated>
  </verify>
  <done>Blueprint-Raster und Rechner-Ergebnisse liegen je im Kasten; beide Filterspalten haengen an `--nav-h` statt an 146 px und ketten nicht mehr in die Seite; der generierte Hell-Block ist unberuehrt.</done>
</task>

<task type="auto">
  <name>Task 4: Mining-DB und Refinery-Finder</name>
  <files>src/components/MiningApp.astro, src/components/RefineryFinder.astro</files>
  <reversibility rating="reversible">CSS plus Klassen und drei Attribute im Markup.</reversibility>
  <action>
**MiningApp** — wortgleich zu Task 3, weil das Layout eine Kopie ist:
`.mdb-layout` bekommt `--vb-top: calc(var(--nav-h, 68px) + 4.4rem)`; `.mdb-sidebar` tauscht
`top:146px` / `max-height:calc(100vh - 162px)` gegen `top: var(--vb-top)` /
`max-height: calc(100dvh - var(--vb-top) - 1rem)` plus `overscroll-behavior: contain`; im
Markup bekommt `<div class="mdb-grid" id="mdb-grid">` die Klasse `vb-scrollbox`. Der
Panel-Block bei 820 px bleibt unveraendert.

**RefineryFinder** — zwei Besonderheiten, beide gehoeren dazu:

1. **Die Leiste `.rff__bar` klebt nicht.** Der Abschnitt sitzt mitten auf der Mining-Seite.
   Ein Kasten von fast Fensterhoehe waere dort nur erreichbar, wenn man ihn exakt ausrichtet.
   Deshalb `--vb-top: calc(var(--nav-h, 68px) + 6rem)` auf `.rff` — der Kasten nimmt damit
   rund drei Viertel der Fensterhoehe ein und ist ab dem Moment vollstaendig sichtbar, in dem
   man den Abschnitt anfaehrt. Der Wert wird in Task 9 angesehen.
2. **Die Matrix braucht eine klebende Kopfzeile.** `.rff__scroll` scrollt heute waagerecht mit
   klebender erster Spalte (`.rff__corner`, `.rff__rore`, `left:0`). Bekommt sie zusaetzlich
   einen senkrechten Bildlauf, waeren die Spaltenkoepfe nach drei Zeilen weg und die Zahlen
   ohne Bedeutung. Deshalb: `.rff__col` und `.rff__corner` zusaetzlich `position: sticky;
   top: 0`. `.rff__corner` klebt dann an beiden Achsen und braucht den hoechsten z-index der
   drei (heute 3; die Spaltenkoepfe bekommen 2, die Zeilenkoepfe behalten 2 — die Ecke geht
   auf 4). Die Kopfzellen brauchen zudem einen deckenden Hintergrund, sonst scheinen die
   Zahlen durch: `.rff__col` bekommt dieselbe Flaeche wie `.rff__corner`
   (`var(--bg-2, var(--veil-2))`).

Beide Kaesten im Markup: `.rff__list#rff-list` und `.rff__scroll#rff-matrix` bekommen
`vb-scrollbox`.

**Tastatur (SCROLL-08).** Beide Refinery-Kaesten enthalten KEIN fokussierbares Element — die
Erz-Zeilen sind `article`/`span`, die Matrix ist eine reine Tabelle. Ein Bildlaufbereich, den
die Tastatur nicht erreicht, ist nach WCAG 2.1.1 nicht bedienbar. Beide bekommen deshalb
`tabindex="0"`, `role="region"` und ein `aria-label`. Die Beschriftungen kommen aus dem
vorhandenen `S`-Objekt der Komponente — zwei neue Schluessel in BEIDEN Sprachbloecken, in der
Tonlage der Nachbarn (deutsch etwa „Erz-Liste, scrollbar" / „Yield-Matrix, scrollbar",
englisch entsprechend). Die Karten-Raster in Task 2/3/5 brauchen das NICHT: dort fuehrt die
Tabulatortaste ueber die Verweise in den Karten und scrollt den Kasten dabei von selbst.

Nichts an der Filterlogik im inline-`<script>` aendern; `.rff__row[hidden]`, `.rff__col[hidden]`
und `.rff__cell[hidden]` bleiben, wie sie sind.
  </action>
  <verify>
    <automated>cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/gsd-staging-local-review-dc5792" &amp;&amp; test $(grep -c 'mdb-grid vb-scrollbox' src/components/MiningApp.astro) -eq 1 &amp;&amp; test $(grep -c 'top:146px' src/components/MiningApp.astro) -eq 0 &amp;&amp; test $(grep -c '100vh - 162px' src/components/MiningApp.astro) -eq 0 &amp;&amp; test $(grep -c '\-\-vb-top' src/components/MiningApp.astro) -ge 3 &amp;&amp; test $(grep -c 'vb-scrollbox' src/components/RefineryFinder.astro) -eq 2 &amp;&amp; test $(grep -c 'tabindex="0"' src/components/RefineryFinder.astro) -eq 2 &amp;&amp; test $(grep -c 'role="region"' src/components/RefineryFinder.astro) -eq 2 &amp;&amp; test $(grep -c 'position:sticky' src/components/RefineryFinder.astro) -ge 2 &amp;&amp; node -e "const s=require('fs').readFileSync('src/components/RefineryFinder.astro','utf8');const m=s.match(/aria-label=\{S\.\w+\}/g)||[];if(m.length<2){console.error('aria-label nicht aus S:',m.length);process.exit(1)}" &amp;&amp; echo TASK4_OK</automated>
  </verify>
  <done>Mineral-Raster im Kasten und Filterspalte an `--nav-h`; Erz-Liste und Yield-Matrix im Kasten, Matrix mit klebender Kopfzeile und deckendem Hintergrund; beide Refinery-Kaesten per Tabulator erreichbar und in beiden Sprachen beschriftet.</done>
</task>

<task type="auto">
  <name>Task 5: Missionen — 432 Karten in den Kasten</name>
  <files>src/components/MissionsApp.astro</files>
  <reversibility rating="reversible">Zwei CSS-Zeilen und eine Klasse.</reversibility>
  <action>
Die Missionsseite rendert alle Karten serverseitig und filtert clientseitig ueber `hidden` —
die Liste ist damit die laengste der ganzen Seite und die klebende `.mx__bar` das einzige,
was sie ueberlebt.

`.mx__wrap` bekommt `--vb-top: calc(var(--nav-h, 68px) + 7.5rem)`. Der Wert ist hoeher als bei
Crafting und Mining, weil `.mx__bar` zweizeilig gebaut ist (Beschriftung ueber Feld) und
zusaetzlich `margin-bottom: 1.6rem` traegt. Startwert, wird in Task 9 nachgemessen.

Im Markup bekommt `<div class="mx__grid" id="mx-grid">` die Klasse `vb-scrollbox`.

Der `@media (max-width: 640px)`-Block, der `.mx__bar` auf `position: static` setzt, bleibt
unveraendert — der Kasten ist unterhalb 821 px ohnehin aus, die beiden Regeln koennen sich
nicht in die Quere kommen.

Der von `scripts/build-light-overrides.mjs` erzeugte Block am Dateiende bleibt unberuehrt: es
kommt kein Farbwert dazu.
  </action>
  <verify>
    <automated>cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/gsd-staging-local-review-dc5792" &amp;&amp; test $(grep -c 'mx__grid vb-scrollbox' src/components/MissionsApp.astro) -eq 1 &amp;&amp; test $(grep -c '\-\-vb-top' src/components/MissionsApp.astro) -ge 1 &amp;&amp; test $(grep -c 'max-width: 640px' src/components/MissionsApp.astro) -eq 1 &amp;&amp; test $(grep -c 'build-light-overrides' src/components/MissionsApp.astro) -eq 1 &amp;&amp; echo TASK5_OK</automated>
  </verify>
  <done>Die Missionsliste liegt im Kasten; die Filterleiste steht dauerhaft daneben statt hinter 432 Karten; die 640er-Regel und der generierte Hell-Block sind unberuehrt.</done>
</task>

<task type="auto">
  <name>Task 6: Verzeichnisseiten — Kategorie-Tabellen und die Sets-Sprungmarken</name>
  <files>assets/data-page.css, src/components/ItemListing.astro, src/components/CraftingListing.astro, src/components/ArmorSets.astro, src/i18n/itemText.ts</files>
  <reversibility rating="reversible">CSS plus drei Attribute und ein i18n-Schluessel.</reversibility>
  <action>
Diese Seiten laufen nicht in SiteNav, sondern in der schlanken DataShell — es gibt dort KEINE
feste Nav, nur die klebende `.dp-bar` bei `top: 0`. `--nav-h` ist auf diesen ~17.000 Seiten
gar nicht definiert und faellt auf 68 px zurueck; das waere hier zu viel. Die Zahl wird
deshalb ausdruecklich gesetzt statt geerbt.

**a) `assets/data-page.css`.** An `.dp-main` (dort, wo bereits `max-width` und `padding`
stehen): `--vb-top: 4rem` und `--vb-air: 5rem`, mit Kommentar — die 4rem sind die klebende
`.dp-bar` (2 × .7rem Innenabstand plus Inhalt), NICHT eine Site-Nav; auf diesen Seiten gibt
es keine. Startwert fuer Task 9.

An `.dp-tablewrap` selbst wird NICHTS geaendert: `overflow-x: auto` bleibt, die Hoehe kommt
ueber die Klasse. Ein Kommentar an der Regel haelt fest, dass der Kasten hier beide Achsen
scrollt und deshalb aus der waagerechten Kanten-Liste (Abschnitt 5c in mobile-ux.css)
heraushaelt — eine Maske je Achse liesse sich nicht ueberlagern.

**b) `.dp-tablewrap` bekommt die Klasse — an beiden Aufrufstellen.** In `ItemListing.astro`
und `CraftingListing.astro` je `<div class="dp-tablewrap vb-scrollbox" tabindex="0"
role="region" aria-label={t('tableRegion')}>`. Beide Komponenten rendern 100 Zeilen je Seite;
mit dem Kasten ist die Blaetterung darunter ohne Scrollen erreichbar — genau das Beduerfnis
aus der Meldung. `tabindex`/`role`/`aria-label` hier trotz vorhandener Verweise in den
Zeilen: eine Kategorie kann ausschliesslich Eintraege ohne eigene Seite enthalten (dann sind
es `<span>`), und der Kasten waere fuer die Tastatur verloren.

**c) i18n.** In `src/i18n/itemText.ts` einen Schluessel `tableRegion` in BEIDEN Sprachbloecken
ergaenzen, in der Tonlage der vorhandenen `th*`-Schluessel (deutsch etwa „Tabelle, scrollbar",
englisch „Table, scrollable"). Beide Komponenten holen ihn ueber das bereits vorhandene
`t = itemT(lang)` — kein neues Prop, keine neue Signatur.

**d) ArmorSets bekommt KEINEN Kasten, sondern eine klebende Sprungleiste.** Begruendung steht
im Entscheidungsabschnitt; sie gehoert als Kommentar an die Regel. Im inline-`<style>` von
`ArmorSets.astro` bekommt `.as-jump`: `position: sticky`, `top: 0`, `z-index: 15`, einen
deckenden Hintergrund aus `var(--bg)` mit `backdrop-filter: blur(8px)` in der Machart der
`.dp-bar`, Innenabstand oben/unten statt des reinen `margin-bottom`, und eine Haarlinie
unten (`border-bottom: 1px solid var(--line-soft)`). Der z-index muss UNTER dem der `.dp-bar`
(20) liegen, damit die Brotkrumenleiste oben bleibt; darum 15. Die Hersteller-Navigation ist
damit von jeder Stelle der Seite aus erreichbar, ohne 20 Abschnitte zu durchscrollen.

`scroll-margin-top` fuer die `#mfr-…`-Marken kommt bereits aus mobile-ux.css (Abschnitt 6) —
dort steht der Wert allerdings hinter `@media (max-width: 820px)`. Mit einer nun klebenden
Sprungleiste am DESKTOP springt ein Anker unter die Leiste. Deshalb in ArmorSets.astro
zusaetzlich `:where([id])` — nein, kein Wildcard-Eingriff: gezielt
`.dp-sec[id] { scroll-margin-top: 7rem; }` (Brotkrumenleiste plus Sprungleiste), mit
Kommentar, warum es hier und nicht in mobile-ux.css steht (es betrifft genau diese eine Seite
und genau diese eine neue Leiste).

Keine Aenderung an `armorSets`, `setItemsBySlot`, der Seltenheits-Logik oder dem
Hell-Block.
  </action>
  <verify>
    <automated>cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/gsd-staging-local-review-dc5792" &amp;&amp; test $(grep -c 'dp-tablewrap vb-scrollbox' src/components/ItemListing.astro) -eq 1 &amp;&amp; test $(grep -c 'dp-tablewrap vb-scrollbox' src/components/CraftingListing.astro) -eq 1 &amp;&amp; test $(grep -c "tableRegion" src/components/ItemListing.astro) -eq 1 &amp;&amp; test $(grep -c "tableRegion" src/components/CraftingListing.astro) -eq 1 &amp;&amp; test $(grep -c "tableRegion" src/i18n/itemText.ts) -eq 2 &amp;&amp; test $(grep -c '\-\-vb-top' assets/data-page.css) -ge 1 &amp;&amp; test $(grep -c 'as-jump' src/components/ArmorSets.astro) -ge 3 &amp;&amp; test $(grep -c 'scroll-margin-top' src/components/ArmorSets.astro) -ge 1 &amp;&amp; node -e "const s=require('fs').readFileSync('assets/data-page.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;if(o!==c){console.error('Klammern unpaarig',o,c);process.exit(1)}" &amp;&amp; echo TASK6_OK</automated>
  </verify>
  <done>Beide Kategorie-Tabellen liegen im Kasten und sind per Tabulator erreichbar, in DE und EN beschriftet; die Sets-Seite behaelt ihren Dokumentfluss, ihre Hersteller-Navigation klebt und ihre Sprungmarken landen nicht darunter.</done>
</task>

<task type="auto">
  <name>Task 7: Die untere Kante — sichtbar machen, dass unten noch etwas kommt</name>
  <files>assets/scroll-affordance.js, assets/mobile-ux.css</files>
  <precondition>Task 1 bis 6 sind umgesetzt; es existieren Kaesten, an denen sich die Kante beobachten laesst.</precondition>
  <reversibility rating="reversible">Zusatzliste im Skript plus zwei CSS-Regeln; Wegnehmen laesst nur die Bildlaufleiste als Signal stehen.</reversibility>
  <action>
Die sichtbare Bildlaufleiste aus Task 1 ist das Hauptsignal und reicht in Chrome, Edge und
Firefox. Safari zeichnet Ueberlagerungs-Leisten, die im Ruhezustand nichts zeigen — dort ist
eine bis zur Kante durchlaufende Kartenreihe von einer abgeschnittenen nicht zu
unterscheiden. Diese Luecke schliesst eine zustandsbewusste weiche Kante nach unten, gebaut
wie die bestehende nach rechts.

**a) `assets/scroll-affordance.js`.** Neben `SEL_DRAG` und `SEL_FADE` eine dritte Liste
`SEL_VFADE = '.vb-scrollbox'`. Der Kopfkommentar der Datei bekommt einen Absatz: die
bestehende Kante ist WAAGERECHT (`is-more`, Maske `90deg`), diese ist SENKRECHT
(`is-more-y`, Maske `180deg`), und ein Kasten darf in hoechstens einer der beiden Listen
stehen — zwei Masken auf demselben Element liessen sich nur ueber `mask-composite`
ueberlagern, und genau darum steht `.dp-tablewrap` in keiner waagerechten Liste.

Umsetzung, so nah wie moeglich am Vorhandenen: eine Funktion `syncVFade(el)`, die
`el.classList.toggle('is-more-y', el.scrollHeight - el.clientHeight - el.scrollTop > 2)`
setzt — das Spiegelbild der vorhandenen `syncFade`. Ein zweites Feld `vfaders`, in `syncAll()`
mitgelaufen (damit `ResizeObserver` und `document.fonts.ready` beide Achsen versorgen), und in
`scan()` eine zweite Schleife analog zur `SEL_FADE`-Schleife mit dem Merkmal
`data-edgefade-y` als Doppellade-Riegel und einem passiven `scroll`-Zuhoerer. `scan()` wird
bereits ueber `window.VBScrollAffordance` von aussen erneut aufgerufen — dadurch bekommen auch
Kaesten, die erst spaeter entstehen, ihre Kante.

**b) `assets/mobile-ux.css`.** In Abschnitt 5d, direkt unter der Klasse:

```
[data-edgefade-y].is-more-y {
  -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 40px), transparent);
  mask-image: linear-gradient(180deg, #000 calc(100% - 40px), transparent);
}
```

Ohne `is-more-y` keine Maske — am Listenende behauptet nichts mehr, dass es weitergeht. Das
ist der ganze Unterschied zum pauschalen Verlauf, den Abschnitt 5c als „ehrlich ungenaue
Rueckfallebene" fuehrt: hier gibt es keine, weil ohne JS die Bildlaufleiste bleibt.

**c) Leistungsgatter, verbindlich.** `.mx__grid` traegt 432 Karten. Eine `mask-image` auf
einem Bildlaufbehaelter erzwingt eine eigene Zeichenebene, die bei jedem Bild neu
zusammengesetzt wird. Vor dem Abschliessen dieser Task auf `/missionen.html` im
Vorschau-Server messen: 3 Sekunden am Rad im Kasten scrollen und die Bildrate aufzeichnen.
Faellt sie unter 50 fps oder wird ein Ruckeln sichtbar, wird `.vb-scrollbox` in `SEL_VFADE`
durch die Aufzaehlung der Kaesten OHNE `.mx__grid` ersetzt (also
`.uif-results,.cdb-grid,.calc-grid,.mdb-grid,.rff__list,.rff__scroll,.dp-tablewrap`) und der
Messwert samt Entscheidung im SUMMARY festgehalten. Die Missionsliste behaelt dann ihre
Bildlaufleiste als alleiniges Signal — das ist der ehrliche Rueckfall, nicht ein stiller
Verzicht.
  </action>
  <verify>
    <automated>cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/gsd-staging-local-review-dc5792" &amp;&amp; node --check assets/scroll-affordance.js &amp;&amp; test $(grep -c 'SEL_VFADE' assets/scroll-affordance.js) -ge 2 &amp;&amp; test $(grep -c 'is-more-y' assets/scroll-affordance.js) -ge 1 &amp;&amp; test $(grep -c 'data-edgefade-y' assets/scroll-affordance.js) -ge 1 &amp;&amp; test $(grep -c 'scrollHeight' assets/scroll-affordance.js) -ge 2 &amp;&amp; test $(grep -c 'is-more-y' assets/mobile-ux.css) -ge 1 &amp;&amp; test $(grep -c '180deg' assets/mobile-ux.css) -ge 1 &amp;&amp; test $(grep -cE '^\[data-edgefade\]\.is-more' assets/mobile-ux.css) -eq 1 &amp;&amp; echo TASK7_OK</automated>
  </verify>
  <done>Jeder Kasten blendet seine Unterkante weich aus, solange dort noch etwas steht, und hoert damit auf, sobald das Ende erreicht ist; die waagerechte Kante ist unveraendert; die Bildrate der Missionsliste wurde gemessen und die Entscheidung festgehalten.</done>
</task>

<task type="auto">
  <name>Task 8: Vollbau, Audits und Nachweis am erzeugten HTML</name>
  <files>dist/ (nur gelesen)</files>
  <precondition>node_modules ist installiert; der Vollbau erzeugt ~17.400 Seiten und laeuft mehrere Minuten.</precondition>
  <reversibility rating="reversible">Reine Pruefung, keine Quelleaenderung.</reversibility>
  <action>
`npm.cmd run build`, danach `npm.cmd run audit:site` und `npm.cmd run audit:csp`. Der Build
laesst zuerst `scripts/_sync-assets.mjs` laufen — erst dadurch landen die geaenderten Dateien
aus `assets/` in `public/assets/` und damit in `dist`. Wer nur `npm.cmd run preview` startet,
sieht den ALTEN Stand; das ist der haeufigste Irrtum an dieser Stelle.

Beweisfuehrung am erzeugten HTML, nicht an der Quelle — nur dort zeigt sich, ob beide Sprachen
und alle Seitenfamilien tragen. Je einmal EN und einmal DE:

| Datei | erwartet |
|---|---|
| `dist/item-finder.html`, `dist/de/item-finder.html` | genau ein `uif-results vb-scrollbox` |
| `dist/topics/crafting.html`, `dist/de/topics/crafting.html` | je ein `cdb-grid vb-scrollbox` und ein `calc-grid vb-scrollbox` |
| `dist/topics/mining.html`, `dist/de/topics/mining.html` | ein `mdb-grid vb-scrollbox` und zwei `vb-scrollbox` im Refinery-Abschnitt, dazu zwei `role="region"` |
| `dist/missionen.html`, `dist/de/missionen.html` | genau ein `mx__grid vb-scrollbox` |
| eine `dist/items/category/*.html` und ihr `dist/de/…`-Zwilling | `dp-tablewrap vb-scrollbox` mit `tabindex="0"`, `aria-label` in der jeweiligen Sprache |
| eine `dist/crafting/category/*.html` und ihr DE-Zwilling | dasselbe |
| `dist/armor-sets.html`, `dist/de/armor-sets.html` | KEIN `vb-scrollbox` |

Zusaetzlich: die `aria-label`-Texte der DE- und EN-Fassung derselben Kategorieseite muessen
sich unterscheiden — sonst haengt der Schluessel am falschen Sprachobjekt. Und das erzeugte
`/assets/mobile-ux.css` muss die neuen Regeln enthalten (Beweis, dass der Spiegel frisch ist).

`audit:site` muss gruen bleiben: es erzwingt seit dem 04.08. als FEHLER, dass nirgends im
UI-Text auf die Datenherkunft hingewiesen wird — die neuen `aria-label` sind UI-Text und
duerfen nur „Tabelle", „Liste", „Matrix" und dergleichen sagen. `audit:csp` muss gruen
bleiben: es kommt keine externe Ressource dazu, das geaenderte Skript ist bereits verlinkt.

Weicht eine Familie ab, liegt der Fehler in Task 1–7 — dort beheben und neu bauen, nicht am
Aufrufer.
  </action>
  <verify>
    <automated>cd "G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/gsd-staging-local-review-dc5792" &amp;&amp; npm.cmd run build 2>&amp;1 | tail -3 &amp;&amp; npm.cmd run audit:site 2>&amp;1 | tail -5 &amp;&amp; npm.cmd run audit:csp 2>&amp;1 | tail -5 &amp;&amp; for f in dist/item-finder.html dist/de/item-finder.html; do test $(grep -o 'uif-results vb-scrollbox' "$f" | wc -l) -eq 1 || { echo "FAIL uif $f"; exit 1; }; done &amp;&amp; for f in dist/topics/crafting.html dist/de/topics/crafting.html; do test $(grep -o 'cdb-grid vb-scrollbox' "$f" | wc -l) -eq 1 || { echo "FAIL cdb $f"; exit 1; }; test $(grep -o 'calc-grid vb-scrollbox' "$f" | wc -l) -eq 1 || { echo "FAIL calc $f"; exit 1; }; done &amp;&amp; for f in dist/topics/mining.html dist/de/topics/mining.html; do test $(grep -o 'mdb-grid vb-scrollbox' "$f" | wc -l) -eq 1 || { echo "FAIL mdb $f"; exit 1; }; test $(grep -o 'vb-scrollbox' "$f" | wc -l) -eq 3 || { echo "FAIL rff $f"; exit 1; }; test $(grep -o 'role="region"' "$f" | wc -l) -eq 2 || { echo "FAIL region $f"; exit 1; }; done &amp;&amp; for f in dist/missionen.html dist/de/missionen.html; do test $(grep -o 'mx__grid vb-scrollbox' "$f" | wc -l) -eq 1 || { echo "FAIL mx $f"; exit 1; }; done &amp;&amp; test $(grep -o 'vb-scrollbox' dist/armor-sets.html | wc -l) -eq 0 &amp;&amp; test $(grep -o 'vb-scrollbox' dist/de/armor-sets.html | wc -l) -eq 0 &amp;&amp; test $(grep -c 'vb-scrollbox' dist/assets/mobile-ux.css) -ge 3 &amp;&amp; test $(grep -c 'is-more-y' dist/assets/scroll-affordance.js) -ge 1 &amp;&amp; node -e "const fs=require('fs'),p=require('path');const pick=d=>p.join(d,fs.readdirSync(d).find(f=>f.endsWith('.html')));for(const [en,de] of [['dist/items/category','dist/de/items/category'],['dist/crafting/category','dist/de/crafting/category']]){const a=fs.readFileSync(pick(en),'utf8'),b=fs.readFileSync(pick(de),'utf8');for(const [n,s] of [[en,a],[de,b]]){if(!/dp-tablewrap vb-scrollbox/.test(s)||!/tabindex=\"0\"/.test(s)){console.error('FAIL Kasten',n);process.exit(1)}}const la=(a.match(/aria-label=\"([^\"]*)\"/g)||[]).join('|'),lb=(b.match(/aria-label=\"([^\"]*)\"/g)||[]).join('|');if(la===lb){console.error('FAIL: DE und EN tragen dieselben aria-label',en);process.exit(1)}}console.log('LISTING_OK')" &amp;&amp; echo TASK8_OK</automated>
  </verify>
  <done>Bau gruen, `audit:site` und `audit:csp` gruen; alle sechs Seitenfamilien tragen den Kasten in DE und EN, die Sets-Seite bewusst nicht, die Beschriftungen sind sprachverschieden, und der Asset-Spiegel in dist ist frisch.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Acht Bildlauf-Kaesten und vier Filterspalten: Ergebnisliste und Filter sind entkoppelt, die
Bildlaufleisten sind sichtbar, kein Chaining, unter 821 px unveraendert.
  </what-built>
  <how-to-verify>
Zahlen messen die Untergrenze, nicht die Qualitaet — hier wird HINGESEHEN, in beiden Sprachen
und beiden Farbmodi. `npm.cmd run preview` (dieser Vorschau-Server bedient das in Task 8
gebaute `dist` — die Konfiguration muss den Absolutpfad dieses Worktrees nehmen, sonst wird
ein fremdes altes `dist` ausgeliefert). Browser-Automatisierung: Skill `agent-browser`.

**Kernprobe, an JEDEM der sieben Paare (EN-Pfad / DE-Pfad):**

| # | Seite EN | Seite DE | Kasten |
|---|---|---|---|
| 1 | `/item-finder.html` | `/de/item-finder.html` | Trefferkarten |
| 2 | `/topics/crafting.html` | `/de/topics/crafting.html` | Blueprint-Raster |
| 3 | `/topics/crafting.html` (Reiter Rechner) | dito DE | Rechner-Ergebnisse |
| 4 | `/topics/mining.html` | `/de/topics/mining.html` | Mineral-Raster |
| 5 | `/topics/mining.html#rff` | `/de/topics/mining.html#rff` | Erz-Liste und Matrix |
| 6 | `/missionen.html` | `/de/missionen.html` | Missionskarten |
| 7 | eine `/items/category/…html` | ihr `/de/…`-Zwilling | Kategorie-Tabelle |

Je Seite, bei 1440 px Fensterbreite, mit Messwerten statt Eindruecken:

- **Rad ueber der Liste.** `window.scrollY` vorher notieren, 5 Radstufen ueber der Liste,
  `window.scrollY` nachher: muss **identisch** sein. `scrollTop` des Kastens muss gewachsen
  sein. *Gegenprobe:* dieselben 5 Stufen ueber der Filterspalte bzw. dem Kopfbereich —
  `window.scrollY` bzw. `scrollTop` der Filterspalte muessen sich dann bewegen.
- **Kein Chaining.** Kasten ans Ende scrollen, `window.scrollY` notieren, 5 weitere
  Radstufen: `window.scrollY` unveraendert. *Gegenprobe:* dieselbe Geste am unteren Rand der
  Seite (ausserhalb des Kastens) bewegt die Seite.
- **Filterspalte erreichbar** (Seiten 1–4): ohne die Ergebnisliste anzufassen bis zur letzten
  Kategorie bzw. zum Zuruecksetzen-Knopf scrollen und ihn anklicken. Auf `/item-finder.html`
  ist das die eigentliche Probe der Meldung — vorher war der untere Teil unerreichbar.
- **Bildlaufleiste sichtbar** an Kasten UND Filterspalte. Bildschirmfoto. *Gegenprobe:* auf
  `staging` (altem Stand) ist an derselben Stelle keine Leiste.
- **Untere Kante:** weich ausgeblendet, solange etwas folgt; am Listenende scharf. Wurde in
  Task 7 wegen der Bildrate auf `.mx__grid` verzichtet, gilt das dort nicht — den Vermerk aus
  dem SUMMARY hier gegenpruefen.
- **Was unter der Liste steht, ist im ersten Bild sichtbar:** Blaetterung (1, 7), Quellenkasten
  (6), naechster Abschnitt (2–5). Genau das war vorher hinter der ganzen Liste.
- **Tastatur:** auf Seite 5 und 7 mit der Tabulatortaste in den Kasten und mit den Pfeiltasten
  darin scrollen.
- **Beide Farbmodi** einmal umschalten: die Leistenfarbe muss in Hell wie Dunkel gegen den
  Kasten stehen; im Crafting-Zweig bernstein, im Item-Zweig violett (`--tone-1`).

**Hoehen ansehen und die Startwerte korrigieren.** `--vb-top` steht in Tasks 2–6 als
Schaetzung. Je Seite messen, ob die Unterkante des Kastens rund 5rem ueber dem Fensterrand
liegt und ob die klebende Leiste den Kasten oben nicht ueberdeckt. Abweichungen groesser als
1rem in der Komponente korrigieren, den gemessenen Wert im SUMMARY festhalten. Fenster mit
**800 px Hoehe** und mit **1200 px Hoehe** je einmal — die Rechnung muss in beiden aufgehen.

**Nav mit Zurueck-Zeile.** Ueber einen Verweis (nicht direkt) auf `/topics/mining.html`
springen, sodass die SiteNav ihre Zurueck-Zeile traegt (`--nav-h` = 107 px). Filterspalte und
Kasten muessen mitwandern und duerfen nicht hinter der Leiste verschwinden — das war der alte
`top:146px`-Fehler.

**Mobil-Rueckfall.** Bei **390 px** je Seite: `getComputedStyle(kasten).maxHeight` muss
`none` sein, die Seite scrollt wie bisher am Stueck. Auf 2, 4 den Filter-Schub oeffnen,
darin scrollen, per Wisch nach links schliessen — der Hintergrund darf sich dabei nicht
verschieben (scroll-lock). Bei **860 px** gegenpruefen, dass der Kasten dort schon da ist;
auf `/item-finder.html` bei 860 px dagegen NICHT (dessen eigene 900er-Grenze).

**Aufnahmen fuer das SUMMARY:** `/item-finder.html` EN und DE bei 1440 px, `/topics/mining.html`
DE bei 1440 px mit offenem Refinery-Abschnitt, `/missionen.html` EN bei 1440 px,
eine Kategorieseite DE bei 1440 px, `/item-finder.html` DE bei 390 px, und je eine Aufnahme
im Hellmodus von Crafting und Item Finder.
  </how-to-verify>
  <resume-signal>„freigegeben" tippen, oder die Abweichung mit Seite, Fensterbreite und Messwert benennen</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Build → Auslieferung | Drei geteilte Assets (`mobile-ux.css`, `scroll-affordance.js`, `data-page.css`) gehen auf ~26.000 Seiten mit; ein Fehler darin ist seitenweit |
| Browser → Seite | Neue Bildlaufbereiche fangen Rad-, Touch- und Tastaturereignisse ab, die bisher an die Seite gingen |
| Nutzer → Inhalt | Neue `aria-label`-Texte sind ausgelieferter UI-Text |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-scroll-01 | Denial of Service | `.vb-scrollbox` verschluckt den Seiten-Bildlauf | medium | mitigate | Der Kasten deckt nie die ganze Seite: `--vb-air` laesst 5rem frei, und Kopf, Filterspalte und Seitenrand bleiben normaler Seitenfluss. Die Kernprobe in Task 9 misst beide Richtungen mit `window.scrollY` — Rad daneben MUSS die Seite bewegen. Unter 821 px existiert der Kasten gar nicht. |
| T-scroll-02 | Denial of Service | Falsche `--vb-top` erzeugt einen Kasten ohne nutzbare Hoehe | medium | mitigate | Alle sieben Startwerte gelten ausdruecklich als Schaetzung und werden in Task 9 bei 800 px und 1200 px Fensterhoehe nachgemessen und korrigiert; die gemessenen Werte gehen ins SUMMARY. `100dvh` mit `100vh`-Rueckfall verhindert die Fehlmessung durch mobile Browserleisten. |
| T-scroll-03 | Denial of Service | Unsichtbare Bildlaufleiste — der Kasten wirkt wie ein Seitenende | high | mitigate | Ursache ist bekannt und benannt: `assets/theme.css` blendet mit `!important` jede Leiste aus. Der Pflichteintrag in Abschnitt 5d ist Teil derselben Task wie die Klasse, wird in Task 1 per Zaehlung geprueft, in Task 8 im erzeugten `dist/assets/mobile-ux.css` nachgewiesen und in Task 9 mit einem Bildschirmfoto belegt. Zusaetzlich die weiche Unterkante aus Task 7. |
| T-scroll-04 | Denial of Service | Tastatur erreicht einen Kasten ohne fokussierbare Kinder nicht (WCAG 2.1.1) | medium | mitigate | Die drei betroffenen Kaesten (`.rff__list`, `.rff__scroll`, `.dp-tablewrap`) bekommen `tabindex="0"`, `role="region"` und `aria-label`; Task 8 zaehlt sie im erzeugten HTML, Task 9 fasst sie mit der Tastatur an. Die Karten-Raster brauchen es nicht — sie enthalten Verweise. |
| T-scroll-05 | Information Disclosure | Neue `aria-label` nennen die Datenherkunft | high | mitigate | Site-weite Dauerregel; seit 04.08. erzwingt `scripts/audit-site.mjs` sie als FEHLER. Die Texte sagen ausschliesslich „Tabelle/Liste/Matrix, scrollbar". `npm.cmd run audit:site` ist das blockierende Tor in Task 8. |
| T-scroll-06 | Tampering | Cache liefert alte Assets gegen neues HTML | medium | mitigate | `versioned()` haengt den sha1-Inhaltshash an alle drei Dateien in `Layout.astro`/`DataShell.astro` — neuer Inhalt, neue URL. Dev-Falle: der Hash wird pro Prozess gemerkt; nach Asset-Aenderung Dev-Server neu starten. Nachweis im erzeugten `dist` in Task 8. |
| T-scroll-07 | Tampering | Aenderung landet im gitignorierten Spiegel `public/assets/` und geht verloren | high | mitigate | Kanonisch ist `assets/`; `scripts/_sync-assets.mjs` ueberschreibt den Spiegel vor jedem `dev`/`build`. Nachgemessen: die beiden `data-page.css` weichen bereits voneinander ab. Jede Task nennt ausschliesslich `assets/…`-Pfade; die Verify-Befehle greifen ebenfalls dort. |
| T-scroll-08 | Denial of Service | `mask-image` auf 432 Missionskarten kostet Bilder | medium | mitigate | Verbindliches Leistungsgatter in Task 7: 3 s Scrollmessung auf `/missionen.html`, unter 50 fps faellt `.mx__grid` aus `SEL_VFADE` und behaelt die Bildlaufleiste als Signal. Messwert und Entscheidung ins SUMMARY. |
| T-scroll-09 | Tampering | Gestenkollision mit `scroll-lock.js` / `offcanvas.js` auf Touch | low | mitigate | Konstruktiv ausgeschlossen: der Kasten existiert erst ab 821 px, `isDrawerMode()` greift bis 820 px. Gegenprobe bei 390 px in Task 9 (Schub oeffnen, darin scrollen, wischen, Hintergrund darf nicht springen). |
| T-scroll-10 | Tampering | Generierte Hell-Bloecke am Ende der Komponenten laufen aus dem Tritt | low | accept | Es kommt kein einziger Hex-Wert dazu — ausschliesslich Tokens und `color-mix`. `scripts/build-light-overrides.mjs` muss deshalb nicht laufen. Task 1 prueft die Hex-Freiheit des neuen Abschnitts maschinell, Tasks 3 und 5 pruefen, dass der generierte Block noch steht. |
| T-scroll-SC | Tampering | npm/pip/cargo installs | high | mitigate | Der Plan installiert NICHTS — keine neue Abhaengigkeit, keine externe Ressource, kein Paket. Die Legitimitaetspruefung entfaellt mangels Paketinstallation; `audit:csp` in Task 8 belegt, dass keine externe URL hinzukommt. |
</threat_model>

## Source Coverage Audit

| Quelle | Punkt | Abgedeckt von |
|---|---|---|
| USER | Ergebnisliste/Tabelle bekommt eigenen Bildlaufbereich mit begrenzter Hoehe | Tasks 2–6, acht Kaesten |
| USER | Rad ueber der Liste bewegt nur die Liste | Klasse in Task 1; Kernprobe Task 9 mit `window.scrollY` als Messwert |
| USER | Rad daneben bewegt die Seite | Kein Elternteil wird zum Bildlaufbehaelter (ausdruecklich in Task 2: `.uif-main` bleibt); Gegenprobe Task 9 |
| USER | `overscroll-behavior: contain` auf dem Container | Task 1, ausserhalb der Medienabfrage, damit auch die kleinen Listen es bekommen |
| USER (Wortlaut) | Erst die ganze Liste durchscrollen, bevor Filter sichtbar werden | Befund-Abweichung 1 (klebende Filterspalte ohne eigenen Bildlauf) + Task 2 b) — das ist die Wurzel, nicht nur ein Symptom |
| USER | Filterspalte bleibt unabhaengig erreichbar und scrollbar | Task 2 b) (fehlte ganz), Task 3 b), Task 4 (Mining) — alle vier Spalten an `--vb-top` |
| USER | Mobil nicht zu klein: Grenzwert grosszuegig ODER Rueckfall, mit Begruendung | Entscheidungsabschnitt „Das Mobil-Verhalten", vier Gruende; Rueckfall bei 821 px, Sonderfall 900 px im Item Finder; Probe bei 390 px und 860 px in Task 9 |
| USER | DE und EN muessen beide funktionieren; pruefen, ob je Feature EIN Koerper | Geprueft: alle acht Komponenten haben genau EINEN Koerper, die Seiten unter `src/pages/**` sind Huellen mit `lang`-Prop (`item-finder.astro`, `de/item-finder.astro`, `topics/crafting.astro`, `topics/mining.astro`, `missionen.astro`, `items/category/[slug].astro`, …). Eine CSS-Aenderung wirkt zwangslaeufig in beiden Sprachen. Nachweis trotzdem am erzeugten HTML: Task 8 prueft jedes Paar, Task 9 sieht jedes Paar an. `scripts/sync-style-blocks.mjs` betrifft nur `src/pages`-Paare und damit nichts hiervon. |
| DIRECTIVE | Komponenten und CSS wirklich lesen, Ist-Zustand feststellen | Abschnitt „Befund" mit Tabelle und drei Abweichungen |
| DIRECTIVE | EINE einheitliche Mechanik statt acht Einzelloesungen, begruendet | Abschnitt „Entscheidung", inkl. Datei-Vergleichstabelle |
| DIRECTIVE | Hoehenberechnung begruenden | Abschnitt „Die Hoehenrechnung", `--vb-top`/`--vb-air`, `100dvh` mit `100vh`-Rueckfall |
| DIRECTIVE | Registrierungspflicht in mobile-ux.css ausdruecklich nennen | Task 1 Gruppe 2 und 3; `key_links`; T-scroll-03; Nachweis in Task 8 |
| DIRECTIVE | scroll-affordance.js SEL_DRAG/SEL_FADE ausdruecklich behandeln | Abschnitt „Was NICHT gemacht wird" (beide begruendet abgelehnt) + Task 7 mit eigener Liste `SEL_VFADE` und der Ein-Achsen-Regel |
| DIRECTIVE | Atomare, einzeln commitbare Tasks mit Dateipfaden | 9 Tasks, je 1–5 Dateien, je eigenes Verify |
| DIRECTIVE | Konkrete CSS-Schnipsel | Task 1 (Klasse, Leisten-Gruppen), Task 7 (Maske als Codeblock), Tasks 2–6 mit exakten Eigenschaften und Werten |
| DIRECTIVE | Pruefplan mit URL, Klickweg, erwartetem Ergebnis, Gegenprobe fuer DE und EN | Task 9, sieben Seitenpaare, je Probe mit Gegenprobe und Messwert |
| DIRECTIVE | Keine Code-Aenderungen in dieser Runde, nur PLAN.md | Dieser Plan wurde geschrieben, keine Quelldatei angefasst |
| FACT (Zuarbeit) | theme.css ~41–55 blendet jede Leiste aus | Bestaetigt (Zeilen 41–55); Grundlage der Pflichtregistrierung |
| FACT (Zuarbeit) | mobile-ux.css ~439–520 fuehrt die Ausnahmeliste | Bestaetigt (Zeilen 486–519, fuenf Selektoren); neuer Abschnitt 5d schliesst direkt an |
| FACT (Zuarbeit) | scroll-affordance.js haelt SEL_DRAG/SEL_FADE, hat `vertInside` | Bestaetigt (Zeilen 20–23, 62/70–77/116). `vertInside` gilt nur fuer SEL_DRAG-Kaesten; unsere Kaesten stehen dort bewusst nicht, es entsteht keine Wechselwirkung |
| FACT (Zuarbeit) | `:global()` in `is:inline` verpufft | Bestaetigt als Falle; hier nicht einschlaegig — alle Selektoren sind einfache Klassen. Steht als Warnung in `key_links` |
| FACT (Zuarbeit) | Hand-verlinkte `/assets/*.css` brauchen den sha1-Cache-Bust | Bestaetigt: `Layout.astro` 215/221 und `DataShell.astro` 70 nutzen bereits `versioned()`; nichts zu tun, Dev-Falle in `key_links` |
| FACT (Zuarbeit) | scroll-lock.js / offcanvas.js — Wechselwirkung pruefen | Geprueft: `isDrawerMode()` greift nur bis 820 px und nur bei `position:fixed`. Der Kasten beginnt bei 821 px — konstruktiv ueberschneidungsfrei. T-scroll-09, Gegenprobe in Task 9 |
| KORREKTUR | Zuarbeit nennt `public/assets/…` | Kanonisch ist `assets/`; `public/assets/` ist gitignorierter Spiegel und aktuell nachweislich veraltet. T-scroll-07, alle Task-Pfade zeigen auf `assets/` |
| MEMORY | Fertiges ohne Nachfrage auf `staging`, Fertigmeldung erst wenn die ausgelieferte Seite den neuen Stand zeigt | Nach Freigabe in Task 9; `main` bleibt ohne ausdrueckliche Ansage tabu |
| MEMORY | Windows: `npm.cmd`, PowerShell, Vorschau-Server mit Absolutpfad | Tasks 8 und 9 |
| MEMORY | Erst hinsehen, dann berichten; bei DE/EN gilt „fertig" erst fuer beide | Task 9 als blockierender Checkpoint mit Aufnahmen in beiden Sprachen |

Keine offenen Punkte: jeder genannte Ort ist entweder mit einem Kasten versorgt (Item Finder,
Crafting-DB, Zerlege-Rechner, Mining-DB, Refinery-Finder, Missionen, ItemListing,
CraftingListing) oder ausdruecklich und begruendet mit dem passenderen Mittel (ArmorSets:
klebende Sprungleiste statt Kasten, siehe „Was NICHT gemacht wird").

<verification>
- `npm.cmd run build` gruen (~17.400 Seiten), `npm.cmd run audit:site` gruen, `npm.cmd run audit:csp` gruen
- `node --check assets/scroll-affordance.js` gruen; Klammern in `mobile-ux.css` und `data-page.css` paarig
- Kein Hex-Wert im neuen CSS-Abschnitt; die generierten Hell-Bloecke sind unveraendert vorhanden
- `dist`-Stichproben in DE und EN: sieben Seitenpaare mit Kasten, `armor-sets.html` bewusst ohne
- DE- und EN-Fassung derselben Kategorieseite tragen unterschiedliche `aria-label`
- `dist/assets/mobile-ux.css` und `dist/assets/scroll-affordance.js` enthalten die neuen Regeln (Spiegel frisch)
- Angesehen bei 1440 px, 860 px und 390 px, bei 800 px und 1200 px Fensterhoehe, in Hell und Dunkel
- Je Kasten gemessen: `window.scrollY` konstant beim Rad ueber der Liste, `scrollTop` waechst; Gegenprobe daneben bewegt die Seite
- Kein Chaining am Listenende (`window.scrollY` konstant)
- Bildrate der Missionsliste gemessen; Entscheidung zur Unterkante im SUMMARY festgehalten
</verification>

<success_criteria>
- Auf jeder der sieben Seitenfamilien bewegt das Rad ueber der Ergebnisliste nur die
  Ergebnisliste, daneben die Seite — in DE und EN, in Hell und Dunkel.
- Die Filter sind erreichbar, ohne die Ergebnisliste zu durchscrollen; im Item Finder ist die
  Filterspalte erstmals bis zur letzten Kategorie bedienbar.
- Am Listenende laeuft der Bildlauf nicht in die Seite ueber.
- Jeder Bildlauf-Kasten UND jede Filterspalte zeigt eine sichtbare Bildlaufleiste; die drei
  bisher unsichtbar scrollenden Filterspalten sind mitversorgt.
- Was unter der Liste steht (Blaetterung, naechster Abschnitt, Quellenkasten), ist im ersten
  Bild sichtbar.
- Unter 821 px verhaelt sich jede Seite wie vorher; der Filter-Schub auf Touch ist unveraendert.
- Kasten und Filterspalte haengen an `--nav-h` — die Zurueck-Zeile der Navigation verschiebt
  nichts mehr.
- Bau und beide Audits gruen; keine neue Abhaengigkeit, keine externe Ressource, kein Hex-Wert.
</success_criteria>

<output>
Create `.planning/quick/20260807-tabellen-eigener-bildlauf/SUMMARY.md` when done
</output>
