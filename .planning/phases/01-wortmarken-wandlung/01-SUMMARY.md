---
phase: 1
status: complete
plans: ["01-01", "01-02"]
requirements: [MARK-01, MARK-02, MARK-03, MARK-04, MARK-05, MARK-06, MARK-07, MARK-08, MOTN-01, MOTN-02, MOTN-03, MOTN-04, THEME-01]
commit: 002e5a3
branch: feature/hero-wordmark-morph
---

# Phase 1 — Wortmarken-Wandlung: Zusammenfassung

## Was geliefert wurde

Die Startseite empfängt mit „VerseBase" oben mittig über dem Hero-Motiv. Die Kopfleiste trägt
am Seitenanfang keinen Schriftzug. Beim Runterscrollen wandert die Überschrift scroll-verknüpft
auf die Position der Leisten-Wortmarke zu, schrumpft auf deren Größe und übergibt ihr dort.

**Ein Commit statt zwei.** Die Roadmap sah zwei Pläne vor, aber Plan 01-01 allein hinterlässt
einen kaputten Zustand: die Kopfleisten-Wortmarke wäre verborgen, ohne dass das JS aus 01-02 sie
je wieder hereinholt. Ein atomarer Commit darf keinen kaputten Baum hinterlassen — deshalb
beides in `002e5a3`.

## Entwurfsentscheidungen, die der Aufbau erzwungen hat

**`.hero__mark` liegt ausserhalb von `.hero`.** Der Hero trägt `isolation:isolate` und damit
einen eigenen Stacking-Kontext. Darin könnte `z-index:9601` die Kopfleiste (9600) nie überholen;
der Schriftzug wäre auf dem letzten Stück hinter deren Füllung verschwunden. Als Kind von `body`
liegt er im Wurzel-Stacking-Kontext und kommt oben an.

**Der Maßstab läuft der Fahrt voraus.** Erste Fassung skalierte und verschob linear mit demselben
Fortschritt. Messung: die Überschrift überlappte die Kopfleiste ab `p≈0.5` noch in voller Größe —
halb auf dem dunklen Motiv, halb auf der Füllung. Im Hellmodus stand damit weiße Schrift auf
nahezu weißer Füllung. Jetzt ist der Maßstab bei `p=0.55` fertig, die Überlappung beginnt erst
bei `p=0.75`, und die Schrift ist dort bereits auf Leistengröße.

**Die Schriftfarbe folgt der Unterlage.** Über dem Hero ist Weiß in *beiden* Farbmodi richtig
(der Schleier bleibt dunkel), über der Leistenfüllung nicht. `color-mix` blendet zwischen
`--title-hi` und `--text` über. Gemessen im Hellmodus über der Füllung: 20:1 statt weiß auf weiß.

**Ziel und Maßstab werden gemessen, nicht geraten.** Mittelpunkt zu Mittelpunkt (halbe
Zeilenabstände verteilen sich symmetrisch, deshalb ist der Kastenmittelpunkt auch bei
unterschiedlicher Zeilenhöhe der richtige Bezug), Maßstab aus den Schriftgraden — Kastenhöhen
enthalten den Zeilenabstand und würden zu klein skalieren. Nachgemessen bei `resize`, nach
`document.fonts.ready` und bei `pageshow`.

## Zwei Fehler, die die Messung aufgedeckt hat

1. **Die Wandlung war still tot.** SiteNavs Inline-Skript steht im DOM *vor* dem Seiteninhalt —
   `document.querySelector('.hero__mark')` lieferte dort `null`. Behoben: Nachschlagen erst bei
   `DOMContentLoaded`.
2. **Das Monogramm war auf Mobil dauerhaft unsichtbar.** Ohne Wanderziel (unter 580 px) kehrte
   `paintMorph` zurück, bevor es `--brand-in` setzte — die Marke blieb bei Deckkraft 0, auch nach
   1200 px Scroll. Behoben: Rückfallrampe über 40–120 px.

## Nachweise (gemessen im gebauten `dist/`, nicht im Dev-Server)

| Prüfung | Ergebnis |
|---|---|
| Landung Desktop 1280 px, dunkel | Überschrift-Mittelpunkt (657, 30) = Wortmarke (657, 30) |
| Landung Desktop 1280 px, hell | identisch (657, 30) |
| Fortschritt | stetig 0 → 0.31 → 0.63 → 0.81 → 1.0, kein Umschaltpunkt |
| Übergabe der Deckkraft | Überschrift 1 → 0.78 → 0.31 → 0, Marke 0 → 0.22 → 0.69 → 1 |
| Kontrast hell, über der Füllung | 20:1 |
| Seitenanfang | Marke Deckkraft 0, genau eine sichtbare `h1` |
| Seite ohne Hero (`/de/archiv`) | Leiste ohne `snav--morph`, Marke Deckkraft 1 ab Bildpunkt 1 |
| 375 px | `span` `display:none` (Monogramm bleibt), Marke blendet über 40–120 px ein, Überschrift scrollt mit weg |
| Overlay offen | `html.is-locked`, Überschrift verdeckt, kein Zurückschnappen, nach Schließen wieder da |
| Animierte Eigenschaften | nur `transform`, `opacity`, `color` — keine Layout-Eigenschaft |
| Build | `npm run build`, 17364 Seiten, Exit 0 |

## Offen / nicht in dieser Phase

- **Reduzierte Bewegung wurde nicht im Browser gegengeprüft.** Der Prüfbrowser meldet
  `prefers-reduced-motion: false` und bietet keine Emulation. Der Pfad ist rein deklarativ
  (`position:absolute; transform:none`, Marke über `.scrolled`) und die Messung wird bei
  `noMotion.matches` übersprungen — aber es ist eine Ableitung aus dem Code, keine Messung.
- **`SYNC-02`** (wiederholbarer Nachweis der Deckungsgleichheit beider Sprachfassungen) gehört zu
  Phase 4. Für diese Phase wurde die Deckungsgleichheit von Hand geprüft: beide Dateien tragen
  dieselben Regeln an denselben Stellen.
- **Vorbestehender Fehler, nicht von dieser Phase verursacht:** der Astro-Dev-Server bricht bei
  `src/layouts/Layout.astro` mit `Unexpected ")"` in einem Inline-Skript ab
  (`script:...Layout.astro?id=0`). Der Produktionsbuild ist davon nicht betroffen. Die Datei wurde
  in dieser Phase nicht angefasst.
