---
status: complete
date: 2026-08-07
branch: claude/separate-scroll-table-page-3c289b
commits: [a05176a, 7a6824e, 3b28e29, e8fd093, 9ce50d3, 145a9b6, ffd8eea]
---

# Tabellen mit eigenem Bildlauf — Zusammenfassung

## Was der Nutzer wollte

Auf den Daten-/Durchsuchungsseiten sollte das Mausrad **über der Ergebnisliste** nur
die Liste bewegen und **daneben** die Seite. Ausgangsbeschwerde: um an die unteren
Filter zu kommen, musste erst die komplette Ergebnisliste durchgescrollt werden.

## Die eigentliche Ursache (Abweichung von der Ausgangsvermutung)

`.uif-sidebar` (Item Finder) klebte bei `top: 4.6rem`, hatte aber **weder
`max-height` noch `overflow`**. Eine klebende Spalte, die höher ist als das Fenster,
nagelt ihre Oberkante fest — ihr unterer Teil (die ganze Kategorienliste) war nur
erreichbar, indem man die Seite an der Ergebnisliste vorbeischob. Ein Kasten um die
Ergebnisse allein hätte das nicht behoben; die Filterspalte brauchte ihren eigenen.

Zweiter Fund derselben Ursache: `.cdb-sidebar`, `.mdb-sidebar`, `.calc-sidebar`,
`.cdb-res-list` und `.calc-mat-list` scrollten längst — nur **unsichtbar**, weil
`assets/theme.css` jede Bildlaufleiste der Seite mit `!important` ausblendet und sie
nicht in der Ausnahmeliste standen. Mitbehoben.

## Mechanik

Eine Utility-Klasse `.vb-scrollbox` in `assets/mobile-ux.css` (Abschnitt 5d), direkt
neben der bestehenden Ausnahmeliste — wer den Kasten hinschreibt, sieht drei Zeilen
darunter, warum er ohne Eintrag unsichtbar wäre.

```
max-height: calc(100dvh - var(--vb-top) - var(--vb-air));   /* 100vh als Rückfall davor */
overscroll-behavior: contain;                               /* kein Scroll-Chaining */
```

* `--vb-top` — eine Zahl je Seite: feste Nav (`--nav-h`) plus eigene klebende Leiste.
  **Kasten und Filterspalte lesen dieselbe Zahl** → zwangsläufig gleich hoch.
  Nebenwirkung: die verdrahteten `146px`/`162px` der drei Filterspalten sind weg,
  die verrutschten, sobald die Nav ihre Zurück-Zeile trug.
* `--vb-air` — 5 rem Luft, damit Blätterung/nächster Abschnitt angeschnitten sichtbar
  bleiben und der Kasten nicht als Seitenende gelesen wird.
* Unter **821 px** (Item Finder: 900 px) gibt es keinen Kasten — mobil sind die Filter
  ein Off-Canvas-Tipp entfernt, die Rechnung ergäbe ~360 px, und verschachtelter
  Bildlauf kollidiert mit `scroll-lock.js`/`offcanvas.js`.
* Senkrechte weiche Unterkante über `SEL_VFADE`/`is-more-y` in
  `assets/scroll-affordance.js` — eigene Liste, weil die bestehende Maske waagerecht
  ist. Regel: ein Kasten steht für höchstens EINE Achse in den Kantenlisten.

## Geänderte Dateien

| Datei | Was |
|---|---|
| `assets/mobile-ux.css` | `.vb-scrollbox`, senkrechte Leisten-Gruppe, 6-px-Gruppe für die kleinen Listen, `is-more-y`-Maske |
| `assets/scroll-affordance.js` | `SEL_VFADE`, `syncVFade()`, Riegel `data-edgefade-y` |
| `assets/data-page.css` | `--vb-top: 4rem` auf `.dp-main` (DataShell hat keine SiteNav) |
| `src/components/ItemFinderApp.astro` | Filterspalte bekommt eigenen Bildlauf, `.uif-results` in den Kasten |
| `src/components/CraftingApp.astro` | `.cdb-grid`, `.calc-grid`, beide Spalten weg von 146 px |
| `src/components/MiningApp.astro`, `RefineryFinder.astro` | `.mdb-grid`, `.rff__list`, `.rff__scroll` |
| `src/components/MissionsApp.astro` | `.mx__grid` |
| `src/components/ItemListing.astro`, `CraftingListing.astro` | `.dp-tablewrap` + `role="region"`/`aria-label` |
| `src/components/ArmorSets.astro` | kein Kasten (Dokument mit Sprungmarken) — `.as-jump` klebend + `scroll-margin-top` |
| `src/i18n/itemText.ts` | Schlüssel `tableRegion` DE/EN |

## Nachgemessen (Chrome, 1440×860, echter Viewport)

`bewegtSichUm` = Weg des Kastens, `seiteBewegtSichDabei` = Weg der Seite dabei.

| Seite | Kasten | eigener Weg | Seite bewegt sich | Leiste |
|---|---|---|---|---|
| /item-finder (DE+EN) | `.uif-results` 619 von 7029 px | 1500 | **0** | thin |
| /item-finder | `.uif-sidebar` 757 von 1620 px | 863 | **0** | thin |
| /topics/crafting (DE+EN) | `.cdb-grid` 584 von 100404 px | 1500 | **0** | thin |
| /topics/crafting → Rechner | `.calc-mat-list` 178 von 1006 px | 828 | **0** | thin |
| /topics/mining (DE+EN) | `.mdb-grid` 584 von 1926 px | 1342 | **0** | thin |
| /topics/mining | `.rff__list` 555 von 1841 px | 1286 | **0** | thin |
| /de/missionen | `.mx__grid` 567 von 131897 px | 1500 | **0** | thin |
| /items/category/ammo (DE+EN) | `.dp-tablewrap` 704 von 4076 px | 1500 | **0** | thin |
| /crafting/category/… | `.dp-tablewrap` 704 von 786 px | 82 | **0** | thin |

Gegenprobe auf jeder Seite: `scrollingElement.scrollTop += 400` → **400** (die Seite
scrollt weiterhin normal).

Mobil 390×844: alle Kästen aus (`overflow-y: visible`, `max-height: none`,
`eigenerBildlauf: false`) — alter Seitenfluss.

Hellmodus: Leiste sichtbar, Daumen `srgb(0.392 0.231 0.710 / .55)`.

ArmorSets: `.as-jump` `position: sticky; top: 0; z-index: 15`, bei Scrollstand 2000
steht sie bei Fensterposition 0 → klebt.

Bau: 17.365 Seiten, `audit:site` FEHLER 0, `audit:csp` alles gedeckt.

## Offener Punkt (gemessen, nicht behoben)

`position: sticky` auf `.uif-sidebar`, `.cdb-sidebar`, `.mdb-sidebar` ist durch die
Deckelung **wirkungslos** geworden: die Zeile ist jetzt exakt so hoch wie die Spalte
(`.cdb-layout` 656 px, `.cdb-sidebar` 656 px → **Klebeweg 0**), also greift sticky nie.
Folge: die Spalte scrollt 1:1 mit der Seite und ihre Oberkante kann kurzzeitig unter
die 68 px hohe Nav rutschen (auf /item-finder bei Scrollstand 1100 um 34 px).

Der gemeldete Fehler ist damit behoben — die Filter sind vollständig erreichbar —,
aber die Spalte bleibt beim Weiterscrollen nicht mehr stehen. Eine echte Klebewirkung
zurückzuholen hieße, der Zeile künstlich Höhe zu geben (Leerraum neben den
Ergebnissen) oder das Zeilen-Layout neu zu schneiden. Das ist eine Design-Entscheidung,
keine Fehlerkorrektur — deshalb hier nur dokumentiert.
