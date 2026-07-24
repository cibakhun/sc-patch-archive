# Item- & Blueprint-Seiten — die Datenschicht indexierbar machen

**Stand:** 24.07.2026 · **Branch:** `claude/item-finder-seo-indexing`

## Problem

Item Finder (`/item-finder.html`) und Crafting-Planer (`/topics/crafting.html`) laden
ihren Inhalt per `fetch()` aus `assets/universal-items.json` (7 MB) bzw.
`assets/crafting-db.json` (1,9 MB) und rendern ihn im Browser.

Für Suchmaschinen existierte dieser Inhalt damit **nicht**: keine einzige
indexierbare Item- oder Blueprint-URL, obwohl genau danach gesucht wird
(„star citizen \<item\> price", „where to buy \<item\>", „\<blueprint\> ingredients").
Der Crafting-Planer rendert immerhin die Karten-*Namen* serverseitig — Zutaten,
Mengen, Missions-Quellen und Item-Werte aber ebenfalls nur im Browser.

## Lösung in einem Satz

Dieselben Build-Daten fließen zusätzlich in **statische Detailseiten**, die über
eine krabbelbare Hierarchie (Verzeichnis → Kategorie → Datenblatt) und aus den
Apps heraus verlinkt sind.

```
/items.html                         Verzeichnis (alle Wurzeln + Blatt-Kategorien)
  /items/category/<cat>.html        Kategorie-Liste, 100 Zeilen/Seite, "-2", "-3" …
    /items/<id>.html                Item-Datenblatt
/crafting.html                      Blueprint-Verzeichnis
  /crafting/category/<cat>.html     Kategorie-Liste
    /crafting/<slug>.html           Blueprint-Seite
```

…jeweils gespiegelt unter `/de/…` mit `hreflang`-Paaren.

## Welche Items bekommen eine eigene URL?

`isIndexable()` in `src/lib/items.ts`: **Bezugsquelle ODER Spielwerte ODER
Fundort-Guide**. Das sind **5.086 von 9.788** Katalog-Einträgen.

Begründung: Eine Detailseite muss mindestens eine der drei Fragen beantworten
können, mit denen jemand ankommt — *wo kaufe ich das*, *was kann das*, *wo finde
ich das*. Die übrigen 4.702 Einträge (überwiegend die 947 Lackierungen sowie
Munitions-/Handelswaren-Platzhalter) tragen nur einen Namen; daraus entstünden
tausende fast identische Seiten ohne Antwort.

**Sie verschwinden trotzdem nicht aus dem Index:** die Kategorie-Listen führen
*alle* Einträge namentlich auf (nur ohne Link), und der Finder zeigt sie
unverändert. Wer die Schwelle ändern will, ändert genau diese eine Funktion —
die Sitemap, die Karten-Links im Finder (`hasPage()` in
`assets/item-finder-app.js`, gleiche Regel) und die Listen ziehen automatisch mit.

## Seitengewicht: eigene Hülle statt SiteNav

Die Massen-Seiten nutzen **nicht** `SiteNav`, sondern `DataShell.astro`.

| | SiteNav-Seite (z. B. Mission) | DataShell-Seite |
|---|---|---|
| Nav-Markup | ~18 KB | ~1,5 KB |
| inline-JS | ~19 KB | nur der Theme-Vorabgriff |
| CSS | inline pro Seite | eine externe `/assets/data-page.css` |

Bei ~14.000 generierten Seiten sind das ~500 MB Unterschied im `dist/`. Die Hülle
trägt dieselbe Identität (Palette, Typo, Hell/Dunkel, Sprachumschalter,
Rechtliches) und kommt ohne eigenes JavaScript aus.

**Farbpalette liegt inline in `DataShell.astro`** — `scripts/build-light-palettes.mjs`
erzeugt den Hellmodus nur aus inline-`:root`-Blöcken in `.astro`-Dateien;
eigenständige `.css`-Dateien sieht der Generator nicht. `data-page.css` enthält
deshalb **keinen einzigen Hex-Wert**, nur Tokens.

## Interne Verlinkung (das eigentliche SEO)

Eine Sitemap allein reicht nicht — ohne Links bekommen die Seiten kein Gewicht.

- **Finder-Karten sind echte `<a href>`** auf `/items/<id>.html`. Normaler
  Linksklick öffnet weiter das Modal (`preventDefault`), Strg-/Cmd-/Mittelklick
  und Crawler folgen dem `href`. Das Modal bekam einen „Detailseite öffnen"-Link.
- **Crafting-Karten**: der Kartenname ist ein Link auf `/crafting/<slug>.html`,
  gleiche Klick-Mechanik.
- **Item ↔ Blueprint**: Datenblatt verlinkt sein Rezept, Blueprint-Seite verlinkt
  das Item.
- **Blueprint ↔ Mission**: die Blueprint-Seite listet die droppenden Missionen
  (3.563 von 3.627 Referenzen treffen eine existierende Missions-Seite), die
  Missions-Seite verlinkt umgekehrt jeden Blueprint-Namen.
- **Nachbarn**: jedes Datenblatt zeigt bis zu 12 verwandte Items (gleiche
  Kategorie/Hersteller) — hält die Klicktiefe kurz.
- Item-Finder- und Crafting-Seite verlinken die beiden Verzeichnisse prominent.

## Sitemap

`/sitemap.xml` ist jetzt ein **Sitemap-Index** über fünf Teile:

| Teil | Inhalt |
|---|---|
| `/sitemap-pages.xml` | redaktionelle + statische Seiten |
| `/sitemap-ships.xml` | Schiffs-Datenblätter |
| `/sitemap-missions.xml` | Missions-Datenblätter |
| `/sitemap-items.xml` | Item-Datenblätter + Kategorie-Listen |
| `/sitemap-crafting.xml` | Blueprint-Seiten + Kategorien |

Vorteil gegenüber einer Datei: die Search Console meldet Indexierungsstand **pro
Bereich**. `robots.txt` zeigt unverändert auf `/sitemap.xml`.

Bausteine: `src/lib/sitemap.ts` (Inventare + XML). Der Glob für statische Seiten
kennt jetzt auch Unterverzeichnis-Indizes (`src/pages/items/index.astro` →
`/items.html`).

## Strukturierte Daten

Pro Seite: `WebSite` (aus `Layout`), **`ItemPage`** mit `dateModified` =
Snapshot-Datum und `name` = Item-/Blueprint-Name, sowie **`BreadcrumbList`**
(Startseite → Verzeichnis → Kategorie → Seite).

**Bewusst KEIN `Product`/`Offer`.** Google verlangt für Angebots-Markup eine
ISO-4217-Währung; `aUEC` ist keine. Ein `Product` ohne `offers` erzeugt nur
GSC-Warnungen, mit erfundener Währung falsche Daten. Die Preise stehen sichtbar
in der HTML-Tabelle — das ist, was die Suchanfrage beantwortet.

## nginx

`/items` und `/crafting` ohne `.html` sind dieselbe `format:'file'`-Falle wie
`/de` und `/account`: das Verzeichnis existiert (mit den Detailseiten), hat aber
keine `index.html`. Beide Formen (mit und ohne Schrägstrich, DE und EN) leiten
per 301 auf die Hub-Datei.

## Sprache

- Item-Namen: DE nutzt `game.nameDe` aus den Spieldaten, wenn vorhanden; der
  jeweils andere Name steht als Untertitel unter der H1.
- Beschreibungen: `descDe` vor `desc`.
- Einleitungssätze werden aus Daten **gebaut**, nie erfunden — ohne Preis kein
  Preissatz. Die deutsche Einordnung ist eine Nominalphrase („Name — Rakete von
  Vanduul"), weil das grammatische Geschlecht des Gattungsworts nicht in den
  Spieldaten steht und nicht geraten wird.
- Kategorie-Wurzeln werden übersetzt (`categoryLabel`), Blatt-Namen bleiben
  englische Spieldaten — wie im Finder.

## Wo was liegt

| Datei | Zweck |
|---|---|
| `src/lib/items.ts` | Typen, Katalog, Kategorien, Preise, URLs, `isIndexable()` |
| `src/lib/itemStats.ts` | Spielwerte → Label/Wert-Zeilen (spiegelt `item-finder-app.js`) |
| `src/lib/itemSeo.ts` | Titel, Meta-Description, Einleitungssätze |
| `src/lib/crafting.ts` | Blueprint-Typen, Slugs, Kategorien, Item-Join |
| `src/lib/sitemap.ts` | Sitemap-Inventare + XML |
| `src/i18n/itemText.ts` | **ein** Label-Katalog für Seiten *und* Finder-JS |
| `src/components/DataShell.astro` | schlanke Hülle |
| `src/components/ItemDetail.astro` / `ItemListing` / `ItemsHub` | Item-Seiten |
| `src/components/BlueprintDetail.astro` / `CraftingListing` / `CraftingHub` | Blueprint-Seiten |
| `assets/data-page.css` | Layoutregeln aller Datenseiten (nur Tokens) |

## Nach einem Daten-Refresh

Nichts zu tun: Seitenmenge, Kategorien, Slugs und Sitemap leiten sich vollständig
aus `universal-items.json` / `crafting-db.json` ab. Neue Items bekommen beim
nächsten Build ihre Seite, verschwundene fallen raus.

Zu bedenken bleibt nur: **verschwundene Items hinterlassen tote URLs**. Wer das
sauber halten will, braucht bei einem großen Katalog-Umbau eine Redirect- oder
410-Liste — bisher nicht nötig gewesen.
