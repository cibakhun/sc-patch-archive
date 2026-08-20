---
phase: 16
slug: das-schiff-ist-die-navigation
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-18
---

# Phase 16 — UI Design Contract

> Design-Vertrag für „Das Schiff ist die Navigation". Diese Phase baut
> `src/components/ShipDetail.astro` (EIN Körper für DE und EN, 227 Seiten je
> Sprache) zur Konsole um: Systemwahl links, gerendertes Mesh in der Mitte,
> Auslesung daneben. Dieser Vertrag ist **kein Neubau** — er verkabelt,
> benennt und begrenzt einen Mechanismus, der zu über 80 % bereits im Bestand
> existiert (`public/assets/holo-viewer.js`, `HOLO_GRP_ORDER`, `setFilter()`,
> `onSelect()`, `.holo__layers`/`.holo__panel`). Jede Zahl und jeder
> Selektorname unten ist entweder aus dem gelesenen Quelltext zitiert oder als
> bewusste Ermessensentscheidung markiert — nichts ist geschätzt.
>
> **Gilt weiter, unverändert von dieser Phase:**
> `.planning/phases/14-schiffs-datenkarte-entstapeln/14-UI-SPEC.md` bleibt die
> Design-Grundlage für alles, was NICHT die Konsole ist (Kennwerte-Leiste,
> verbleibende Kapitel, Farb-/Typografie-/Abstands-Basis). Dieser Vertrag
> wiederholt daraus nur, was sich durch die Konsole ändert.

---

## Blickführung

1. **Kennwerte-Leiste** (`.holo__bar`, unverändert) bleibt der erste
   verlässliche Fixpunkt — Länge, Besatzung, Fracht, Tempo, Preis.
2. **Die Konsole ist jetzt der zweite Blickfang, nicht mehr die vier
   Kapitel.** Rail → Bühne → Auslesung liegen in EINEM Blickfeld, ohne
   Scrollen (Höhenbudget siehe Detailvertrag Punkt 1). Das ist die
   wörtliche Umsetzung von D-01: „die Konsole IST die Seite."
3. **Innerhalb der Konsole führt die Auswahl, nicht die Fläche.** Beim Laden
   ist bereits ein System aktiv (kein Leerzustand, siehe Detailvertrag
   Punkt 2) — das Auge findet sofort eine Handvoll Marker, keinen
   Punkthaufen aus bis zu 130 Hardpoints gleichzeitig.
4. **Darunter, in gewohnter Kapitel-Optik (Phase 14 unverändert):** Kaufen →
   Leistung → Kennwerte & Flug → Umfeld. Diese vier haben KEINE Position am
   Schiff — sie stehen bewusst NACH der Konsole, nicht davor, weil sie die
   Frage „wo sitzt das" nie beantworten (siehe Detailvertrag Punkt 9).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — unverändert zu Phase 14, kein shadcn |
| Preset | not applicable |
| Component library | none — handgeschriebenes Astro-Markup, ES5-Vanilla-JS, three.js (bereits Projektabhängigkeit, `public/vendor/three/`) |
| Icon library | none als Paket — diese Phase führt **keine neuen Icon-Pfade** ein. Die Konsolen-Rail übernimmt `HOLO_GRP_ICON` (`src/lib/holoIcons.ts`, Zeilen 7–16: `core`/`arms`/`prop`/`other`), bereits vorhanden und bereits für `.holo__layer` verwendet |
| Font | unverändert: `var(--font-ui)` (Rajdhani) für UI-Chrome, `var(--font-body)` (Barlow) für Fließtext, `var(--font-display)` (Orbitron) für den Hero-`h1` |

Kein `npm install`, keine neue Abhängigkeit. `three.js` selbst ist seit der
Holo-Komponentenseite (`holo-components-page`) bereits Projektbestand.

---

## Spacing Scale

Weiterhin kein 4-px-Raster (dieselbe Feststellung wie 12- und 14-UI-SPEC.md).
Alle neuen Werte sind Nachbarn bereits vorhandener Werte, mit Fundstelle:

| Verwendungszweck | Gewählter Wert | Fundstelle / Begründung |
|---|---|---|
| Rail-Spaltenbreite (≥1100px) | `220px` | Nachbar von `.holo__layers{width:min(184px,44vw)}` (Zeile 547) — 184px reicht für ein SCHWEBENDES Panel, das das Modell nicht verdecken darf; die Rail ist jetzt eine DAUERHAFTE Spalte und trägt zusätzlich Marker-Zahlen bündig rechts, deshalb etwas breiter. Keine neue Größenordnung, derselbe Nachbarwert wie die vier Fundamente aus Phase 14 (2,2rem war dort ebenso „nächster Nachbar", kein erfundener Sprung) |
| Auslesung-Spaltenbreite (≥1100px) | `320px` | Nachbar von `.holo__panel{width:min(272px,86vw)}` (Zeile 637) — dieselbe Logik: die Auslesung ist jetzt dauerhaft sichtbar statt ein Overlay, das klein bleiben muss |
| Rail-/Auslesung-Innenabstand | `.2rem .2rem .25rem` (Rail-Außenrahmen) / `.44rem .55rem` (Rail-Zeile) / `.62rem .8rem .6rem` (Auslesung-Kopf) | **unverändert übernommen** aus `.holo__layers`/`.holo__layer`/`.holo__panel .hp__head` (Zeilen 548, 560, 643) — dieselben Innenwerte, nur der Außenrahmen wird vom Overlay zur festen Spalte |
| Mobile Chip-Reihe (D-03, <760px) | `.35rem .8rem` Zeilen-Innenabstand, `.55rem` Außenabstand | **unverändert übernommen** aus `14-UI-SPEC.md` Sprungleisten-Werten (dort exakt für denselben Zweck — kompakte, horizontal scrollbare Pillen — hergeleitet) |
| Bühnen-Mindesthöhe (Konsole) | `min-height:360px` | **unverändert übernommen** aus `.holo__stage{position:absolute;inset:0;min-height:360px}` (Zeile 478) |

Exceptions: `220px` und `320px` sind die einzigen neuen Zahlen — beide oben
mit Fundstelle begründet, keine verdeckt.

---

## Typography

**Keine neue Größe, kein neues Gewicht.** Die Konsole übernimmt exakt die
drei Rollen aus `14-UI-SPEC.md`:

| Role | Größe | Gewicht | Verwendung in dieser Phase |
|------|-------|---------|------------------------------|
| Label | `var(--fs-6)`=14,4px / `var(--fs-4)`=12,6px | 700, uppercase | Rail-Systemnamen (`.holo__layer-lb`, unverändert), Marker-Zahl-Chip (`.holo__layer-ct`, unverändert), Auslesung-Eyebrow (`.hp__eyebrow`, unverändert) |
| Body | `var(--fs-11)`=19,8px / `.9rem`=16,2px | 400/600 | Auslesung-Bauteilname (`.hp__name`, unverändert, `.9rem` 600), Gruppen-Zeilen in der Auslesung (NEU an dieser Stelle, siehe Detailvertrag Punkt 4 — wiederverwendet exakt `.z .l`/`.z .v` aus dem Muster, das bereits an `.arm__line`/`.sd__item` existiert) |
| Heading | `1.15rem`=20,7px | 800 | Auslesung-Kind-Titel (`.hp__kind`, unverändert aus `.holo__panel`) |

Vier Rollen wären mit „Display" dazugerechnet — bleibt bei drei, exakt wie
Phase 14. Kein neues Größenraster, keine neue Schriftfamilie.

---

## Color

**Vollständig aus dem Bestand übernommen — keine neue Farbe.** Die
Gruppenfarben stehen bereits in `GROUP_COLOR` (`public/assets/holo-viewer.js`
Zeilen 18–23) UND in `.holo__layer[data-g]`/`.holo__panel[data-g]`
(Zeilen 563–565, 640–642) — dieselbe Zuordnung gilt jetzt für die Rail UND
die Auslesung, nicht mehr nur für die Marker im Raum:

| System (Rail-Eintrag) | `--gc`-Wert | Fundstelle |
|---|---|---|
| Komponenten (`core`) | `var(--accent)` (Cyan `#2dd4ff`) | `GROUP_COLOR.core` + `.holo__panel` Default-`--gc` |
| Bewaffnung (`arms`) | `var(--gold)` | `GROUP_COLOR.arms` + `.holo__layer[data-g="arms"]`/`.holo__panel[data-g="arms"]` |
| Antrieb (`prop`) | `var(--accent-2)` (Stahlblau `#6ea8ff`) | `GROUP_COLOR.prop` + `[data-g="prop"]` |
| Sonstiges (`other`) | `#a78bfa` (Violett) | `GROUP_COLOR.other` + `[data-g="other"]` — bereits als Roh-Hex im Bestand, kein Token; diese Phase führt dafür KEIN neues Custom Property ein, um die 1:1-Übereinstimmung mit dem bestehenden Wert nicht zu gefährden |

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--bg)` | Bühne, Seitenfläche — unverändert |
| Secondary (30%) | `var(--surface)`/`var(--scrim-5)`/`var(--scrim-6)` (Rail-/Auslesung-Hintergrund, Blur+Scrim, unverändert aus `.holo__layers`/`.holo__panel`) | Rail- und Auslesung-Fläche |
| Accent (10%) | **je System verschieden**, Tabelle oben | Rail-Aktivzustand (Icon + Unterstrich/Rahmenoberkante), Auslesung-Rahmenoberkante + Eyebrow + Kind-Titel — **exakt dieselben Elemente**, die `.holo__layer[aria-pressed="true"]`/`.holo__panel` heute schon so einfärben. Zusätzlich: der 3D-Marker selbst (`GROUP_COLOR`, unverändert) |
| Destructive | nicht verwendet | keine löschende Handlung in dieser Phase |

Accent reserved for: Rail-Aktivzustand, Auslesung-Kopfzeile/Eyebrow/Kind,
3D-Marker-Farbe — vier Verwendungen, alle vier bereits heute exakt so
reserviert (nur bisher an schwebenden statt an dauerhaften Elementen). Gold
bleibt zusätzlich exklusiv für Geldwerte im Kapitelbereich (`14-UI-SPEC.md`,
unverändert) — die Bewaffnungs-Akzentfarbe „Gold" kollidiert nicht damit, sie
bestätigt denselben Sinn, den Phase 14 bereits für das Kapitel „Kaufen"
etabliert hat, auf einer weiteren Ebene (jetzt: System statt Kapitel).

---

## Copywriting Contract

| Element | Copy (DE) | Copy (EN) |
|---------|-----------|-----------|
| Primary CTA | **entfällt.** Die Rail ist Navigation/Filter, kein Call-to-Action | — |
| Rail-Systemnamen | wiederverwendet: `t('holo.grp.core')`=„Komponenten", `t('holo.grp.arms')`=„Bewaffnung", `t('holo.grp.prop')`=„Antrieb", `t('holo.grp.other')`=„Sonstiges" — **keine neuen Schlüssel** | „Components"/„Weapons"/„Propulsion"/„Other" |
| Rail-`aria-label` (NEU) | `ship.console.rail.aria` = „Systemwahl" | „System selection" |
| Auslesung-`aria-label` (NEU) | `ship.console.readout.aria` = „Auslesung" | „Readout" |
| Auslesung-Zählzeile (NEU, Gruppen-Zustand) | `ship.console.count` = „%n% am Schiff verortet" | „%n% located on the ship" |
| Bühne `aria-label` | wiederverwendet: `t('ship.holo.drag')` (unverändert, bereits auf `#holo3d`) | dito |
| Mobile Chip-Reihe `aria-label` (D-03) | wiederverwendet: `ship.console.rail.aria` (dieselbe Rail, nur andere Anordnung — kein zweiter Schlüssel) | dito |
| Kapitel-Titel „Kennwerte & Flug" (umbenannt von „Ausstattung"/`ship.ch.gear`) | **Empfehlung, kein Zwang:** bestehenden Schlüssel `ship.ch.gear` inhaltlich belassen (Text „Ausstattung"/„Specs" bleibt zutreffend für Maße/Fracht/Flugleistung/Verteidigungs-Kennzahlen), NICHT umbenennen — vermeidet einen unnötigen i18n-Zusatz für eine reine Um-Etikettierung |
| Verteidigungs-Unterabschnitt (NEU, ersetzt die alte Komponenten&Verteidigung-Unterüberschrift, deren Slot-Liste in die Konsole wandert) | `ship.defense.title` = „Verteidigung" | „Defense" |
| Entfallender Schlüssel | `holo.activate` („Hologramm aktivieren") wird mit dem Aktivieren-Knopf (D-04) funktionslos — **nicht neu übersetzen, als verwaist markieren**; Löschung liegt beim Executor, kein Blocker |
| Empty state | **kein neuer Text nötig.** Beim Laden ist immer ein System vorbelegt (Detailvertrag Punkt 2) — es gibt keinen sichtbaren „nichts ausgewählt"-Zustand der Konsole. Der einzige echte Leerfall (Schiff ganz ohne Hardpoint-Daten) tritt laut Bestandsaufnahme bei 0 von 227 Schiffen auf; Absicherung siehe UI Considerations |
| Error state | nicht anwendbar — kein neuer Netzwerkpfad; ein scheiterndes Mesh-Laden fällt auf den bestehenden Bild-Eskalationspfad zurück (`escalateNoImages()`, unverändert) |
| Destructive confirmation | nicht anwendbar |

---

## UI Considerations

> Shape-rooted Zustandsabdeckung für die neuen/umgebauten Elemente: Rail
> (`nav`), Bühne (`media` + `interactive-control`), Auslesung
> (`list-collection`), mobile Chip-Reihe (`nav`), No-JS-Auflistung
> (`static-content`/`list-collection`).

**Geprüfte Elemente (E1–E7):** E1 Rail (Systemwahl) · E2 Bühne
(Poster→Mesh-Übergabe) · E3 Marker (interaktives Steuerelement) · E4
Auslesung (Gruppen-/Einzelzustand) · E5 mobile Chip-Reihe (D-03) · E6
No-JS-Auflistung (D-02) · E7 nicht-räumliche Kapitel (unverändert aus
Phase 14, hier nur auf Reihenfolge/Verschiebung geprüft).

Applicable state considerations resolved: **16 covered, 3 backstop, 0
unresolved** (19 gesamt)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | E1, E4 | ✅ covered | Rail zeigt nur Systeme, für die `holoData.groups` (bereits gefiltert auf tatsächlich vorhandene Gruppen, `ShipDetail.astro` Zeile 377) Marker enthält — bei 0 vorhandenen Gruppen entfällt die Konsole komplett (siehe „zero-one-many" unten), niemals eine leere Rail. Auslesung ist beim Laden nie leer, da Punkt 2 immer ein System vorbelegt |
| empty | E6 | ✅ covered | Ohne JavaScript rendert JEDES vorhandene System als eigener Abschnitt in natürlicher Reihenfolge — kein Abschnitt wird per JS erzeugt oder nachgeladen (D-02, siehe Detailvertrag Punkt 6) |
| loading | E2 | ✅ covered | Poster (`.holo__ship`-Galeriebild oder `.holo__none`-Platzhaltertext) steht sofort; das Mesh lädt asynchron nach IntersectionObserver-Eintritt, mit demselben `data-loading`-Statustext-Mechanismus, der heute schon für den Klick-Pfad existiert (`stage.getAttribute('data-loading')`, unverändert) |
| loading | E1, E3, E4 | ✅ covered | Kein Nachladen für Rail/Marker/Auslesung selbst — alle Portdaten liegen bereits im SSG-Build vor (`#holodata`-JSON, unverändert), nur das 3D-Mesh selbst ist asynchron |
| error | E2 | ✅ covered | Scheitert das Mesh-Laden (`.catch` in `start()`, Zeile 2368 ff.), fällt der Stage-Zustand auf `showImg()` zurück — bestehender, unveränderter Pfad. Kein neuer Fehlertext nötig |
| error | E1, E4 | ✅ covered | Rail-Klick/`setFilter()`/Auslesung-Anzeige sind reine Client-Zustandswechsel ohne Netzwerkpfad — kein Fehlerzustand möglich |
| populated | E1–E4 | ✅ covered | Carrack-Normalfall: 4 Rail-Einträge, Bühne mit Mesh, Auslesung mit Gruppen-Summe (Belegt: Bewaffnung 7 Waffen + 14 Turmstationen) |
| partial | E1 | ✅ covered | Ein Schiff mit nur 2 von 4 Gruppen (z. B. kein `other`, keine `prop`-Hardpoints im Mesh erfasst) zeigt genau 2 Rail-Einträge — dieselbe `groups`-Filterung wie heute, unverändert |
| partial | E4 | ✅ covered | `np`/`est`-Vorbehalte bleiben in der Auslesung sichtbar (`hpnote`, unverändert aus `.holo__panel`) — ein System mit teils unverorteten Bauteilen zeigt den Hinweis pro betroffenem Eintrag, nicht pauschal fürs ganze System |
| overflow | E1 | ✅ covered | Rail hat strukturell maximal 4 Einträge (`HOLO_GRP_ORDER.length`) — kein Umbruch-/Kürzungsrisiko bei den Systemnamen (kürzeste/längste DE-Bezeichnung „Antrieb"/„Komponenten", beide einzeilig bei 220px Spaltenbreite, `var(--fs-6)`-Label) |
| overflow | E4 | 🧪 backstop | Die Bewaffnungs-Auslesung der Carrack (7 Waffen + 3 Turmgruppen à 14 Stationen, siehe `armStats`/`armament`) muss innerhalb 320px Spaltenbreite ohne horizontalen Überlauf lesbar bleiben — am gerenderten Bildpunkt nachweisen, ob die Auslesung einen eigenen vertikalen Bildlauf braucht (`.vb-scrollbox`-Muster, siehe Detailvertrag Punkt 10) |
| overflow | E6 | ✅ covered | Die No-JS-Auflistung hat keine feste Breite (volle `.sd`-Spaltenbreite wie die bisherigen Kapitel) — kein neues Überlaufrisiko gegenüber Phase 14 |
| zero-one-many | E1 | ✅ covered | 0 (kein Hardpoint-Mesh, praktisch 0 von 227 Schiffen, siehe Bestandsaufnahme) bis 4 Rail-Einträge. Bei 0: Konsole entfällt komplett, Bühne zeigt nur das statische Poster ohne Rail/Auslesung — Seite bleibt vollständig funktional über die verbleibenden Kapitel |
| zero-one-many | E3, E4 | 🧪 backstop | 6 (`argo-atls`, eigene Nachmessung) bis potenziell >20 Marker in einer einzelnen Gruppe (Carrack-Bewaffnung: 21) — genau die im Phasenziel benannte Kernfrage, siehe „Sichturteile" unten und Detailvertrag Punkt 3 |
| long-text | E1 | ✅ covered | Alle vier Systemnamen sind bereits übersetzte, kurze, feste Strings (`holo.grp.*`) — keine variable Länge |
| long-text | E4 | 🧪 backstop | Einzelne Bauteilnamen aus dem Loadout können lang werden (z. B. zusammengesetzte Turm-Ladungsbezeichnungen, siehe Phase-14-Fund „GEGENMASSNAHMEN") — dieselbe `hyphens:auto`/`overflow-wrap:anywhere`-Absicherung wie in `14-04-SUMMARY.md` dokumentiert MUSS auf die neue 320px-Auslesungsspalte übertragen werden, nicht nur auf die kapitelinternen Zweispalter |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | keine — shadcn nicht initialisiert | not required |
| Drittanbieter | keine | not required |

---

## Detailvertrag je Oberfläche

### 1. Layout-Architektur — drei Spalten, drei Breiten, die Rechnung zur 380-px-Frage

Die Konsole ersetzt NICHT `.holo` als Element — sie erweitert es. `.holo`
(Zeile 462, `height:clamp(540px,74vh,760px)`, randlos, KEIN `--maxw`) wird
zum Grid-Container:

```css
.holo{display:grid;grid-template-columns:220px 1fr 320px}
@media(max-width:1099px){.holo{grid-template-columns:220px 1fr}
  .holo__readout{grid-column:1/-1}} /* Auslesung faellt unter die Buehne */
@media(max-width:759px){.holo{grid-template-columns:1fr}
  .holo__rail{order:2} .holo__wrap{order:1} .holo__readout{order:3;grid-column:1}}
```

Alle drei Breakpoints (`1100px`/`760px`) sind **keine neuen Zahlen** —
`1100px` ist exakt `var(--maxw)` (Zeile 442) und der bereits etablierte
Zweispalten-Umbruch aus `14-04-PLAN.md` Task 1; `760px` ist die bereits
bestehende Tablet-Bruchkante von `.holo__bar`/`.holo` selbst (Zeilen 733,
774).

**Bühnenbreite gerechnet, nicht geschätzt** (Rail 220 + Auslesung 320, ohne
Ränder/Scrollbar-Feinkorrektur — dieselbe Genauigkeitsstufe wie Phase 14s
Höhenbudget-Rechnung):

| Breite | Spalten | Bühnenbreite | Rechnung |
|---|---|---|---|
| 1440px | 3 | **900px** | 1440 − 220 − 320 |
| 1280px | 3 | **740px** | 1280 − 220 − 320 |
| 1100px | 3 (untere Kante) | **560px** | 1100 − 220 − 320 |
| 900px | 2 (Auslesung unten) | **680px** | 900 − 220 |
| 760px | 2 (untere Kante) | **540px** | 760 − 220 |
| 414px | gestapelt (D-03), Rail wird Chip-Reihe unter der Bühne | **≈378px** | 414 − 2×18px Seitenabstand (`.sd{padding:…clamp(1rem,3vw,2.5rem)}`-Formel, bei 414px liegt `3vw`=12,4px UNTER der `1rem`=18px-Untergrenze → Klammer liefert 18px) |
| 360px (D-03, untere Prüfbreite) | gestapelt | **324px** | 360 − 2×18px |

**Das löst die im Phasenziel genannte „~380 px Bühnenbreite" auf:** sie ist
kein willkürlich gegriffener Wert, sondern die Bühnenbreite auf einem
verbreiteten Telefon-Viewport (~414px, iPhone-Klasse) NACH dem Stapeln aus
D-03, gerechnet mit dem bereits im Bestand vorhandenen Seitenabstand aus
`.sd`. Die untere Prüfbreite 360px liegt mit 324px noch enger — **beide
Werte sind Testpunkte für dasselbe Sichturteil**, siehe unten.

### 2. Vorbelegung — nie ein Leerzustand

Beim Laden ist IMMER das erste in `HOLO_GRP_ORDER` vorhandene System aktiv
(server-seitig entschieden, nicht durch einen Klick): `activeGroup =
holoData.groups[0]`. Das ist dieselbe Reihenfolge, die die Rail sowieso
zeigt (`HOLO_GRP_ORDER.filter(gr => present.has(gr))`, Zeile 377,
unverändert) — keine neue Priorisierung, keine geratene „interessanteste"
Gruppe. Die Auslesung zeigt beim Laden die GRUPPEN-Summe dieses Systems
(Punkt 4), noch keinen Einzel-Marker.

### 3. Marker-Sprache — wie 130 Hardpoints nicht zum Punkthaufen werden

Vier Maßnahmen, alle vier bereits im Bestand vorhanden oder direkte
Fortführung eines bestehenden Musters — **keine davon ist eine Neuerfindung**:

1. **Immer nur EINE Gruppe sichtbar, nie alle.** `viewer.setFilter([activeGroup])`
   (API bereits vorhanden, `holo-viewer.js` Zeile 851 — nimmt heute ein
   Array für Mehrfachauswahl, die Konsole übergibt ein Array mit genau
   einem Eintrag). Damit sinkt die maximale gleichzeitig sichtbare
   Markerzahl von potenziell 130 auf die größte EINZELGRUPPE eines Schiffs
   — bei der Carrack z. B. 21 (Bewaffnung: 7 Waffen + 14 Turmstationen,
   `k`-Aufschlüsselung siehe Bestandsaufnahme oben).
2. ⚠ **AUFGEHOBEN durch Punkt 3a/P-2** — der Spike vom 18.08.2026 hat die acht
   dauerhaften `core`-Labels als Ursache der Label-Leiter gemessen. Der
   folgende Absatz beschreibt den ALTEN Stand und gilt nicht mehr:
   ~~Dauerhafte Beschriftung bleibt exklusiv der `core`-Gruppe vorbehalten~~
   (bestehendes `lab`-Feld, `HoloPort.lab`, nur für `core`-Arten gesetzt,
   Zeilen 306/319/336, unverändert) — Bewaffnung/Antrieb/Sonstiges zeigen
   NUR den Marker-Punkt, keine dauerhaft eingeblendete Textbox. Ein
   Label erscheint dort ausschließlich bei Hover/Tap (bestehender
   `showPanel`/`onSelect`-Pfad). Bei 21 Bewaffnungs-Markern entstehen so
   21 Punkte, nicht 21 Textkästen.
3. **Trefferfläche bereits ausreichend groß.** `HIT_R=22` (`holo-viewer.js`
   Zeile 698) ergibt einen 44px-Trefferdurchmesser — erfüllt die
   Touch-Target-Anforderung bereits, KEINE Änderung nötig.
4. **Ko-lozierte Marker fächern bereits automatisch auf** (`ShipDetail.astro`
   Zeilen 346–365, Helix-Versatz für Bauteile auf demselben Bone-Punkt,
   unverändert) — betrifft laut Kommentar an der Fundstelle „real nur ~5
   Schiffe", kein neuer Mechanismus nötig.

**Was NEU ist:** die Auslesung gruppiert Einzel-Marker zu lesbaren Zeilen
(„6× CF-447 Rhino Repeater" statt 6 einzelner Zeilen), siehe Punkt 4 —
das nimmt der Bühne die Bürde, jede Information selbst lesbar zu machen; die
Bühne muss nur noch die RÄUMLICHE Frage beantworten, die Auslesung die
INHALTLICHE.

### 3a. Nachgeschärft aus dem Spike vom 18.08.2026 — drei bindende Punkte

> Dieser Abschnitt entstand NACH dem übrigen Vertrag. Er wurde am laufenden
> Viewer erhoben (gebautes `dist/`, echte Ansichtsbreiten, WebGL im
> kopflosen Chrome), nicht am Code gelesen. Wo er §3 widerspricht, gilt er.
>
> **Zwei eigene Fehlschlüsse aus demselben Spike, damit sie niemand wiederholt:**
> (a) Die Bühne per CSS zu verkleinern taugt als Messung NICHT — der Viewer
> misst seinen Container nicht neu, das Canvas bleibt breit, und man
> fotografiert eine 1280er-Darstellung durch ein schmales Fenster.
> Immer die echte Ansichtsbreite setzen und die Seite selbst umbrechen lassen.
> (b) Ausgelieferte Portkoordinaten dürfen NICHT gegen den Hüllkörper im
> Rohformat gehalten werden: für three.js werden die Achsen getauscht
> (CryEngine `+X Steuerbord, +Y Bug, +Z oben` → three.js Y-oben), das
> ausgelieferte `z` ist das rohe `y`. Richtig geprüft: **0 von 227 Schiffen**
> haben Ports außerhalb ihres Hüllkörpers. Die Daten sind einwandfrei.

**Der Befund.** Bei 860 px Ansichtsbreite (Canvas 860 × 557) rahmt die heutige
Kamera das Schiff auf **etwa ein Viertel der Bühnenbreite**. Die vier
Bewaffnungs-Marker der Carrack werden korrekt gerendert, an den richtigen
Stellen, in der richtigen Gruppenfarbe — sie sind bei dieser Distanz aber nur
2–3 Bildpunkte groß und am Bildschirm **nicht auffindbar**. Erst bei
dreifacher Bildpunktdichte und herangezoomt werden sie sichtbar.

Daraus die Zwickmühle, in der der heutige Viewer steckt:

| Zustand | Ergebnis am Bild |
| --- | --- |
| Labels aus | Marker praktisch unsichtbar |
| Labels an (`core`, 8 Stück) | acht Textkästen bedecken **mehr Fläche als das Schiff** |

Beides ist verträglich, solange das Hologramm ein Schauobjekt im Hero ist. Als
**Navigation** ist beides untauglich — und genau das soll es hier werden.

---

**P-1 (bindend) — Das Schiff füllt die Bühne.** Die Kamera wird so gesetzt,
dass die Hüllkurve des Schiffs mindestens **70 % der kürzeren Bühnenkante**
einnimmt, in jeder der drei Breiten aus Punkt 1. Es ist eine Konsole, kein
Vignettenbild. Der Ausgangswert ~25 % wird als Sperrklinke festgehalten und
darf nur nach oben wandern.

*Nachweis:* am gerenderten Bildpunkt messen, nicht aus der Kamerakonfiguration
ableiten. Ein brauchbares Verfahren ist die Spanne der projizierten
Portpositionen gegen die Canvas-Breite; ein Rückgriff auf `readPixels` braucht
`preserveDrawingBuffer` und ist deshalb nicht der erste Weg.

**P-2 (bindend) — Kein Dauer-Label. Punkt 2 aus §3 ist damit aufgehoben.**
Beschriftet wird **ausschließlich** der gewählte oder überfahrene Marker, für
ALLE Gruppen einschließlich `core`. Die acht dauerhaften `core`-Labels sind
die gemessene Ursache der Label-Leiter; sie verschwinden.

Damit die Marker ohne Label auffindbar bleiben, muss die Markerdarstellung bei
der Größe aus P-1 für sich lesbar sein — Größe, Kontrast und Trennung sind
Sache der Umsetzung, aber die Zusicherung lautet: **ein Marker ist ohne
Beschriftung als Marker erkennbar.** Das ist ein Sichturteil, siehe unten.

Das bestehende `lab`-Feld auf `HoloPort` bleibt in den Daten; es steuert
künftig nur noch, welcher Text beim Auswählen erscheint, nicht mehr, ob
dauerhaft eingeblendet wird.

**P-3 (bindend, zuerst zu klären) — Die Rail darf nichts anbieten, das die
Bühne nicht zeigen kann.** Gemessen am ausgelieferten `holodata` der Carrack:
es trägt **17 von 60 Hardpoints** — `core` 8, `arms` 4, `other` 5. Die Gruppe
`prop` fehlt vollständig; die zwölf `thruster_mav`, vier `thruster_vtol`, vier
`thruster_main` und zwei `thruster_retro` aus den Rohdaten sind herausgefiltert
und erscheinen nicht.

Eine linke Spalte, die „Antrieb" anbietet und dann eine leere Bühne zeigt, ist
schlimmer als gar kein Eintrag. Vor der Planung ist zu entscheiden — und im
Plan festzuhalten —, ob

- die Triebwerke in `holodata` aufgenommen werden (dann wächst die Portzahl je
  Schiff erheblich, und P-1/P-2 müssen bei dieser Dichte erneut belegt werden), **oder**
- die Rail nur Gruppen führt, die für das jeweilige Schiff tatsächlich Marker
  haben (dann ist die Rail je Schiff verschieden lang, und der Leerzustand aus
  Punkt 2 muss das abdecken).

Ein Eintrag ohne Marker ist in keinem Fall zulässig.

### 4. Die Auslesung — zwei Zustände, ein Bauteil

`.holo__panel` wird zu `.holo__readout`, verlässt die absolute
Overlay-Position und wird zur dritten Grid-Spalte. Zwei Inhaltszustände,
beide serverseitig vorgerechnet (keine Client-Berechnung):

**(a) Gruppen-Zustand** (Standard nach Systemwechsel, kein Marker angeklickt):
- Kopfzeile: Systemname (`holo.grp.*`) + `ship.console.count`
  („%n% am Schiff verortet", `n` = `holoData.ports.filter(p=>p.g===activeGroup).length`).
- Darunter EINE Liste, nach `k` (Art) gruppiert, mit Stückzahl —
  **wiederverwendet exakt das Muster von `armStats`/`armament`** für
  `arms` (bereits gruppierte Turm-/Pilotenzeilen, unverändert übernehmbar)
  bzw. von `slots` für `core` (bereits nach Bauteilart gruppiert,
  unverändert übernehmbar). Für `prop` und `other` gibt es **noch keine
  gruppierte Textdarstellung im Bestand** (siehe Detailvertrag Punkt 6) —
  hierfür ist eine NEUE, aber strukturell identische Aggregation nötig:
  `holoData.ports.filter(p=>p.g==='prop')`, gruppiert nach `k`
  (`thruster_main`/`thruster_retro`/`thruster_vtol`/`thruster_mav`), Anzahl
  + `t('holo.kind.'+k)` als Label — dieselbe Formel wie `armStats`, nur auf
  eine bisher nicht ausgeschriebene Gruppe angewendet.

**(b) Einzel-Zustand** (nach Marker-Klick, `onSelect`-Callback):
- **Wiederverwendet `showPanel()` fast unverändert** (Zeilen 2302–2334) —
  Kind-Icon, Name, Größe, Kategorie/Preis/Kauforte (Item-Finder-Anreicherung),
  Finder-Link, `np`/`est`-Vorbehaltstext. Einziger Unterschied: das Ziel ist
  jetzt `.holo__readout` (feste Spalte) statt `.holo__panel` (Overlay) —
  reines Umhängen des `hidden`-Togglings, keine neue Logik.
- Ein „Zurück zur Übersicht"-Weg ist NICHT extra nötig: Klick auf einen
  freien Bühnenbereich oder erneuter Rail-Klick auf dasselbe System setzt
  `selectIdx=null` (bestehendes Verhalten, `pointerup`-Handler Zeile 752)
  und die Auslesung fällt automatisch auf (a) zurück.

### 5. Die Rail

`.holo__layers` wird zu `.holo__rail`, verlässt die absolute
Overlay-Position (linke Grid-Spalte), UND wechselt von Mehrfachauswahl
(Checkbox-artig, `aria-pressed` toggle-je-Klick) zu Einfachauswahl
(Radio-artig): Klick auf einen Rail-Eintrag setzt `activeGroup` neu,
`aria-pressed="true"` nur auf dem aktiven Eintrag, alle anderen `"false"`
(nicht `.5` Deckkraft wie im alten Mehrfach-Muster — hier bedeutet
`"false"` „wählbar", nicht „ausgeblendet"). Icon (`HOLO_GRP_ICON`), Label
(`holo.grp.*`) und Zähl-Chip (`.holo__layer-ct`, Anzahl je Gruppe) bleiben
strukturell unverändert.

Der eingeklappte Zustand (`.holo__layers.is-collapsed`, mobil, Zeilen
759–761) entfällt — bei nur 4 Einträgen in einer festen Spalte (bzw.
horizontalen Chip-Reihe unter 760px) ist kein Einklappen mehr nötig; der
gesparte Platz war früher nötig, weil die Rail über dem Modell SCHWEBTE.

### 6. Ohne JavaScript — die Konsole als schlichte Liste (D-02)

**Harte Vorgabe, nicht verhandelbar (Konkrete Vorgabe 1+2 in `16-CONTEXT.md`):**
jedes System steht als eigener, sichtbarer Abschnitt im ausgelieferten HTML
— nicht per JS erzeugt, nicht per `hidden`-Attribut standardmäßig versteckt.

**Mechanismus:** dieselbe Zwei-Schicht-Architektur, die Phase 14 für die
Kapitel-Sprungleiste bereits gebaut hat (`.sd__jump`/`.sd__chapter`),
angewendet auf die Konsole:

1. **CSS-Grundzustand (kein JS nötig): gestapelte Liste.** Die vier Systeme
   rendern als vier `<section id="sys-core">` usw., in Dokumentreihenfolge
   INNERHALB von `.holo` — mit derselben Inhaltsstruktur wie der
   Gruppen-Zustand der Auslesung (Punkt 4a), nur ohne `hidden`. Die Rail ist
   in diesem Grundzustand eine reine Anker-Liste (`<a href="#sys-arms">`),
   exakt das bestehende `.sd__jump`-Muster (Phase 14, unverändert
   übernommen) — funktioniert vollständig ohne Skript.
2. **JS-Erweiterung (progressiv): dieselben Knoten werden umgehängt, nicht
   dupliziert.** Ein kleines Skript setzt beim Laden eine Klasse
   (`.holo.has-console`) und **verschiebt** (`appendChild`, keine
   `innerHTML`-Kopie) die vier `<section>`-Elemente in die Grid-Struktur
   (Rail-Klick zeigt/versteckt per `hidden`-Attribut). **Verbindlich:** kein
   Bauteil-Text darf zweimal im DOM stehen — eine Kopie würde sowohl das
   Seitengewicht unnötig verdoppeln als auch `verify:shipcard`s
   Entdopplungs-Scan auslösen (Punkt 9 unten).
3. **Kein Flackern.** Weil KEIN Inhalt per JS neu gerendert wird (nur
   verschoben/versteckt), gibt es kein „alle vier Panels blitzen auf, bevor
   JS sie versteckt" — das Umhängen passiert synchron im selben Tick wie
   das Setzen der Klasse, vor dem ersten Repaint (analog zum bestehenden
   `defaultMode`-Muster, das den Anfangszustand bereits serverseitig in die
   Klassenliste schreibt, Zeile 1237).

**Was das für die Marker-Interaktion bedeutet:** ohne JavaScript gibt es
keine anklickbaren 3D-Marker (D-04 verlangt ohnehin ein statisches Poster
ohne JS — Marker auf einem Foto funktionieren laut `013-konzepte/README.md`
grundsätzlich nicht). Die No-JS-Erfahrung ist also: Poster oben, darunter
vier lesbare Text-Abschnitte — identisch zur bisherigen Kapitel-Erfahrung
aus Phase 14, nur mit vier NEUEN Abschnitts-Überschriften statt der alten
Ausstattung-Unterüberschriften.

### 7. Die Bühne — Poster→Mesh-Übergabe ohne Startknopf (D-04)

**Wiederverwendet die bestehende Opacity-Überblendung fast unverändert:**
`.holo__stage.is-3d .holo__ship img{opacity:0}` /
`.holo__stage.is-3d .holo__3d{opacity:1}` (Zeilen 486–487) sorgen bereits
dafür, dass Poster und Mesh in DERSELBEN, fest dimensionierten Box
überblenden — kein Layout-Sprung, keine neue CSS-Regel nötig.

**Was sich ändert — zwei konkrete Codestellen:**

1. **`defaultMode` wird IMMER `'holo'`, sobald `holoAvail` wahr ist** (nicht
   mehr `hasVideo ? 'video' : hasGallery ? 'img' : 'holo'`, Zeile 400) — das
   Mesh ist der Standard-Blick der Konsole, Video/Bilder werden zur
   Zweitverwendung (siehe Punkt 8).
2. **Der Ladeauslöser wird von Klick auf Scroll umgestellt.** Heute lädt das
   Mesh entweder sofort (`if (defaultMode === 'holo') start(false)`, Zeile
   2397 — verletzt Erfolgskriterium 5 für Schiffe ohne Video/Bilder) oder
   erst nach Klick auf `#btn3d` (Zeile 2377). Beides entfällt zugunsten
   EINES `IntersectionObserver` auf `.holo` (Schwellwert klein, z. B. 0.1,
   analog zum bereits in `holo-viewer.js` Zeile 767 verwendeten Muster für
   die Render-Loop-Pause), der `start(false)` genau einmal auslöst, sobald
   die Bühne in den sichtbaren Bereich scrollt. Der `#holoact`-Knopf
   (Zeile 1304, ohnehin bereits funktionslos/`hidden`, siehe Fallstricke
   unten) wird ersatzlos entfernt.

⚠ **Fund, der die Planung braucht:** der Kommentar direkt über `.holo` in
`ShipDetail.astro` (Zeile 460 f., „Das Hologramm ist eingebettet (kein
Popup-Toggle mehr) und lädt lazy beim Scrollen") **beschreibt bereits das
Zielverhalten dieser Phase — der tatsächliche Code tut das noch nicht.**
Nicht von der vorhandenen Kommentierung täuschen lassen; der Ist-Zustand ist
oben aus dem JS selbst zitiert (Zeilen 2336–2398), nicht aus dem Kommentar.

### 8. Video/Bilder-Galerie — Zweitverwendung statt Bühnen-Modus (Ermessen)

Bewusste Design-Entscheidung, hier klar benannt statt stillschweigend
getroffen: Da D-04 „kein Startknopf" fürs Mesh verlangt und die Konsole per
Definition zeigt, WO etwas sitzt (nur das Mesh kann das), wird die Bühne
selbst zur reinen Mesh-Fläche. Das bestehende Marketing-Video und die
Foto-Galerie (`hasVideo`/`hasGallery`, `.holo__toggle`) verlieren ihren
Platz als GLEICHWERTIGER dritter/vierter Bühnen-Modus. **Empfehlung:** sie
wandern als kompakte Medien-Kachel in das bestehende Kapitel „Umfeld"
(`ch-context`, dort ohnehin schon der Ort für Lackierungen/Varianten-Bilder)
statt komplett zu verschwinden — keine Datenlöschung, nur ein neuer,
unaufdringlicherer Ort.

**Kleinstmögliche Alternative, falls diese Verschiebung im Planungsschritt
zu groß wirkt:** `.holo__toggle` bleibt exakt wie heute bestehen (Video/
Bilder/3D-Holo als Umschalter), NUR wird `defaultMode` weiterhin von
Video/Bilder-Verfügbarkeit bestimmt UND der Lade-Trigger für die
3D-Ansicht von Klick auf „Bühne im Blickfeld" umgestellt (Punkt 7,
zweiter Absatz bleibt gültig) — das erfüllt D-04 und Erfolgskriterium 5
ebenfalls, verzichtet aber auf „das Schiff IST die Navigation" als
Standardansicht. Diese Alternative ist der risikoärmere, kleinere Diff und
sollte im Plan explizit gegen die oben empfohlene Variante abgewogen
werden — beide sind mit diesem Vertrag vereinbar.

### 9. Die nicht-räumlichen Daten — ihr Ort unterhalb der Konsole

Keine Datenänderung, keine Streichung — nur Umzug innerhalb der
bestehenden vier Phase-14-Kapitel, mit EINER inhaltlichen Verschiebung:

| Bisheriger Ort (Phase 14) | Inhalt | Neuer Ort |
|---|---|---|
| `ch-buy` „Kaufen im Verse" | Preise, Mieten, Pledge | **unverändert**, bleibt eigenes Kapitel unter der Konsole |
| `ch-profile` „Leistungsprofil" | Perzentil-Balken (6 Metriken) | **unverändert**, inkl. der in Phase 14 Punkt 6 getroffenen Entscheidung (Rohwert nur bei Agilität/Feuerkraft/Verteidigung) |
| `ch-gear` „Ausstattung", Unterabschnitt „Maße & Fracht" | L×B×H, SCU, Tankkapazität (aggregiert, KEINE Einzelposition) | **bleibt in `ch-gear`** — hat keine Marker-Position, auch nicht im neuen Modell |
| `ch-gear`, Unterabschnitt „Bewaffnung" | `armStats`/`armament` | **wandert in die Konsole** als System „Bewaffnung" (Punkt 4) |
| `ch-gear`, Unterabschnitt „Flugleistung & Quantum" | SCM/Boost-Tempo, Pitch/Yaw/Roll, Quantum-Reichweite/Spool | **bleibt in `ch-gear`** — Ganzschiff-Kennzahlen ohne Einzelposition (der Quantenantrieb SELBST hat zwar eine Marker-Position unter „Komponenten", aber seine Reichweite/Spool-Zeit ist keine Eigenschaft dieser Position, sondern des ganzen Schiffs) |
| `ch-gear`, Unterabschnitt „Komponenten & Verteidigung" | Slot-Liste (Generatoren/Schilde/Kühler/Quantum/Radar) + Hülle/Schild-HP | Slot-Liste **wandert in die Konsole** als System „Komponenten"; Hülle/Schild-HP (aggregiert) **bleibt in `ch-gear`**, neuer Unterabschnitt „Verteidigung" (`ship.defense.title`, siehe Copywriting) |
| `ch-context` „Umfeld" | Versicherung, Lackierungen, Varianten/Loaner, Patch-Chronik | **unverändert**, zusätzlich optional Video/Bilder-Galerie (Punkt 8) |

`ch-gear` trägt danach drei statt vier Unterabschnitte (Maße & Fracht,
Flugleistung & Quantum, Verteidigung) — die kapitelinterne Zweispaltigkeit
aus `14-04-PLAN.md` (`.sd__ch2col`, ab 1100px) bleibt anwendbar, greift nur
auf einen kleineren Innenraum (Höhenbudget sinkt dadurch zusätzlich, siehe
Punkt 11).

### 10. Bekannte Fallstricke

- **`.holo__activate`/`#holoact` (Zeile 1304) ist heute bereits inert**
  (`hidden`-Attribut, kein Klick-Listener im gelesenen Skriptbereich) —
  nicht mit dem AKTIVEN `#btn3d`-Klick-Pfad verwechseln, der tatsächlich
  lädt. Beide Wege entfallen (Punkt 7), aber aus unterschiedlichen Gründen:
  `holoact` ist totes Markup, `btn3d`s Klick-Trigger ist aktiver Code, der
  ersetzt werden muss.
- **`*{margin:0;padding:0}` (Zeile 452, entspricht der in Phase 14 zitierten
  Zeile 404 — durch die Skript-Ergänzungen dieser Phase leicht
  verschoben)** neutralisiert weiterhin die site-weite
  `section`-Polsterungsfalle. Nicht anfassen.
- **`:global()` verpufft** in `<style is:inline>` — jede neue Regel oben ist
  bereits als normales CSS formuliert.
- **Bildlaufleisten-Allowlist, sechs Einträge in zwei Dateien**
  (`assets/mobile-ux.css` §5c: drei Regelgruppen; `assets/scroll-affordance.js`:
  `SEL_DRAG` + `SEL_FADE`) — `.sd__jump__in` steht bereits in beiden
  Dateien (Phase 14). Führt die Auslesung (Punkt 4/Backstop „overflow E4")
  oder die mobile Chip-Reihe (Punkt 5, <760px) einen eigenen Bildlauf-Kasten
  ein, MUSS dessen Selektor in beide Dateien eingetragen werden — sonst
  scrollt er per Wisch-Geste, ohne dass die Bildlaufleiste sichtbar ist
  (derselbe Fehler, der laut Projekt-Gedächtnis bereits fünf bestehende
  Kästen getroffen hat).
- **`gsd-tools windows append` crasht auf `.planning/WINDOWS.md`** (Frontmatter-Parser
  lässt das `\r` von CRLF stehen und verwirft die eigene `last_updated`-Zeile,
  bereits in `14-04-SUMMARY.md` dokumentiert) — die Datei direkt bearbeiten:
  Tabellenzeile UND JSON-Spiegelblock UND Kopfzeilen-Zähler (`open_count`,
  `total_count`, `last_updated`) in einem Schritt, sonst laufen Tabelle und
  JSON-Block auseinander.
- **`verify:shipcard`s Entdopplungs-Scan** (Zusicherung 6, `verify-shipcard.mjs`
  Zeilen 40–48) zerlegt heute NUR `div.sd` in Regionen. Die Konsole liegt
  AUSSERHALB von `.sd` (in `.holo`) — wird das nicht angepasst, sieht der
  Scanner eine reale Dopplung (z. B. „21 DPS" gleichzeitig in der
  Konsolen-Auslesung UND, falls versehentlich nicht entfernt, im alten
  `ch-gear`-Bewaffnungsabschnitt) NICHT, weil er dort gar nicht hinschaut —
  das wäre ein blinder Fleck, keine Entwarnung. Siehe Punkt 11.

### 11. Was mit `verify:shipcard` geschieht (Erfolgskriterium 8)

Konkrete Anpassungen, keine Neukonstruktion:

1. **`CHAPTER_IDS`** (`verify-shipcard.mjs` Zeile 79) bleibt unverändert
   `['ch-buy','ch-profile','ch-gear','ch-context']` — Punkt 9 dieses
   Vertrags hält bewusst genau diese vier IDs, nur mit verkleinertem
   `ch-gear`-Inhalt. **Keine Änderung an dieser Konstante nötig**, wenn die
   Empfehlung aus Punkt 9 umgesetzt wird.
2. **Neue Konstante nötig:** die vier Konsolen-System-IDs (`sys-core`,
   `sys-arms`, `sys-prop`, `sys-other`) brauchen eine eigene Bijektions-
   und Existenz-Prüfung, analog zu Zusicherung 2/3, aber gegen die Rail
   statt gegen `.sd__jump`.
3. **Entdopplungs-Region erweitern** (Fallstrick oben): der Scanner muss
   `.holo` mit in seine Regionsbildung aufnehmen, SONST kann er die unter
   Punkt 6 verbindliche „kein Text doppelt" Regel für die Konsole gar nicht
   prüfen — das ist keine Kür, sondern die Voraussetzung dafür, dass
   Erfolgskriterium 8 überhaupt etwas Sinnvolles behauptet.
4. **`.sd__panel`/`.sd__gtrack`-Nullzählungen bleiben unverändert gültig** —
   diese Phase führt keine dieser Klassen neu ein und entfernt keine
   bestehende Gegenprobe dafür.
5. **Vorführen, nicht nur behaupten** (Grundsatz 1 der Maschinellen
   Validierung): nach der Umstellung MUSS `verify:shipcard` einmal absichtlich
   gebrochen werden (z. B. ein Bewaffnungs-Wert versehentlich sowohl in der
   Konsole als auch im alten `ch-gear` belassen), um zu zeigen, dass die
   erweiterte Region den Fund tatsächlich meldet — bevor die grüne Marke
   irgendetwas wert ist.

### 12. Text-/Höhenbudget

Erfolgskriterium 3 verlangt: der indexierbare Text je Schiffsseite darf
NICHT unter die von Phase 14 gemessene Ausgangsmarke fallen (Phase 14 selbst
zitiert ~5 KB als 18.08.2026-Messwert für `anvl-carrack.html`). Diese Phase
bewegt größtenteils NUR Text (Bewaffnung/Komponenten wandern von `ch-gear`
in die Konsole, siehe Punkt 9) — netto **keine Streichung** vorgesehen,
eher ein leichter ANSTIEG, weil `prop`/`other` erstmals eine ausgeschriebene
Gruppen-Auflistung bekommen (Punkt 4a, letzter Absatz), die es im
Kapitel-Aufbau von Phase 14 so nicht gab. Die Sperrklinke aus Phase 14 bleibt
in Kraft und wandert nur nach oben (Grundsatz 5) — vor UND nach der
Umstellung messen, nicht annehmen.

Die 4.200-px-Höhenklinke aus Phase 14 gilt für den KAPITEL-Bereich (`.sd`)
und bleibt unverändert bestehen — sie sinkt tendenziell weiter, weil
`ch-gear` jetzt drei statt vier Unterabschnitte trägt. Die Konsole selbst
(`.holo`) hat ihre EIGENE, bereits bestehende Höhenklinke
(`clamp(540px,74vh,760px)`, unverändert) — diese Phase führt dafür keine
neue Zahl ein.

---

## Sichturteile (an `.planning/WINDOWS.md`, kein Skript)

Direkte Bearbeitung der Datei (siehe Fallstrick oben — `gsd-tools windows
append` NICHT verwenden). Alle Punkte gehören zu Phase 16 und sollten so früh
wie möglich beantwortet werden, weil laut Phasenziel die gesamte Phase an
Punkt 1 hängt:
**S-0 (zuerst, die Phase haengt daran) — Ist ein Marker ohne Beschriftung
als Marker erkennbar?** Nach P-1 fuellt das Schiff die Buehne, nach P-2 gibt es
keine Dauer-Labels mehr. Damit steht und faellt alles an der Frage, ob ein
unbeschrifteter Punkt bei dieser Groesse gefunden wird — am kargsten Schiff
(13 Ports) wie am dichtesten (130). Gemessen wurde am 18.08.2026 der
Ausgangszustand: bei ~25 % Bildanteil sind die Marker 2–3 Bildpunkte gross und
nicht auffindbar. Das ist die Latte, die geschlagen werden muss.


1. **Die tragende Frage der Phase:** Erkennt man bei ~380px Bühnenbreite
   (Detailvertrag Punkt 1, typischer Telefon-Viewport nach dem Stapeln aus
   D-03) auf einem drehbaren Mesh tatsächlich, wo ein Marker sitzt — bei der
   größten Einzelgruppe eines Schiffs (Carrack-Bewaffnung: 21 Marker,
   Detailvertrag Punkt 3)? Oder ist es ein Punktehaufen? Mitgeben: die
   gemessene Bühnenbreite in px zum Testzeitpunkt, ein Bildschirmfoto vor
   UND nach Auswahl eines einzelnen Markers, und ob das Drehen (Ziehen) am
   schmalen Viewport tatsächlich flüssig genug ist, um „suchend zu drehen"
   überhaupt praktikabel zu machen.
2. **Trägt die Rail-Einfachauswahl** (4 Systeme, Radio-artig) bei 1280×720
   als Navigationsmuster, oder wirkt der Wechsel von der bisherigen
   Mehrfachauswahl (`.holo__layers`, mehrere Gruppen gleichzeitig sichtbar)
   zur Einfachauswahl wie ein Rückschritt für Nutzer, die mehrere Systeme
   gleichzeitig vergleichen wollten?
3. **Wirkt die Auslesung bei ~320px Spaltenbreite** (Bewaffnungs-Zustand der
   Carrack, dichteste Gruppe) noch übersichtlich, oder kippt die Zeilenzahl
   (7 Waffen + 3 Turmgruppen) in eine unangenehm lange Liste, die einen
   eigenen Bildlauf braucht (Backstop „overflow E4")?
4. **Fühlt sich das größte geprüfte Schiff** (eigene Nachmessung gegen
   `src/data/ship-hardpoints.json`, 18.08.2026: `aegs-javelin` mit 123
   rohen Hardpoint-Einträgen — Rohzahl, NICHT die tatsächlich gerenderte
   Markerzahl nach Stock-Loadout-Join; diese muss am gebauten Stand
   nachgemessen werden) in der dichtesten Einzelgruppe noch bedienbar an,
   oder ist selbst EINE Gruppe bei diesem Schiff schon zu voll für die
   3-Spalten-Konsole?
5. **Trägt die Bühne ohne Video/Bilder-Standardmodus** (Detailvertrag
   Punkt 8, empfohlene Variante) noch genug visuelle Anziehungskraft, oder
   fehlt das kuratierte Marketing-Video beim ersten Blick auf die Seite
   spürbar?

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
