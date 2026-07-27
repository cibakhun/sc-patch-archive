# Hero-Sprungmarke „V" — UI Review

**Audited:** 2026-07-28
**Scope:** `src/pages/index.astro`, `src/pages/de/index.astro` — Lede entfernt, Textzeile „Tools ↓" / „Werkzeuge ↓" durch eine dreifache V-Marke ersetzt
**Baseline:** abstrakte 6-Säulen-Standards (kein UI-SPEC.md vorhanden) + `.planning/codebase/CONVENTIONS.md`
**Screenshots:** erfasst (Chrome, 1135×910 dark + light; Messungen zusätzlich bei 1280/700/375 px)

Kein GSD-Phasenverzeichnis vorhanden — `/gsd-ui-review` würde in Schritt 1
abbrechen. Die Säulen-Systematik ist trotzdem angewendet, das Ergebnis liegt
deshalb hier statt unter `{phase}-UI-REVIEW.md`.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Zielwort deckt sich in beiden Sprachen mit der Abschnittsüberschrift; zwei reine Doppelungen entfernt |
| 2. Visuals | 4/4 | Marke sitzt als einziger zentrierter Akzent unter linksbündigem Satz; Hierarchie über Deckkraft statt Größe |
| 3. Color | 4/4 | Nur `var(--accent)`, 0 hartcodierte Farben ergänzt; `--accent` statt `--accent-media` ist die korrekte Wahl am Schleier-Fuß |
| 4. Typography | 4/4 | Zwei Schriftgrade der Seite ersatzlos entfernt (Lede-Absatz + getrackte 0,66rem-Versalzeile) |
| 5. Spacing | 3/4 | Werte passen zum Bestand, aber die Seite hat gar keine Spacing-Skala — ein prä-existierender Mangel |
| 6. Experience Design | 3/4 | Zustände vollständig (hover/focus/reduced-motion/Tap-Ziel), aber zwei Tab-Stopps zeigen jetzt auf `#tools` |

**Overall: 22/24** (Copywriting nach Fix 2 von 3 auf 4)

---

## Top 3 Priority Fixes

1. **Doppelter Tab-Stopp auf `#tools`** — WARNING — Skip-Link und V-Marke führen beide dorthin. Tastaturnutzer bekommen zwei Wege zum selben Ziel. Vertretbar (verschiedene Zielgruppen: Skip-Link oben für Screenreader, Marke unten für Zeiger), aber bewusst zu entscheiden statt zu übersehen.
2. ~~**EN-Wortwahl vereinheitlichen**~~ — BEHOBEN — war „Skip to tools" (Skip-Link) vs. „Go to the tools" (Marke). Jetzt „Go to tools": das Zielwort deckt sich in beiden Sprachen exakt mit der Abschnittsüberschrift („Tools" / „Werkzeuge"), nur das Verb unterscheidet sich — richtig so, weil die Aktionen verschieden sind (Bypass vs. Sprungmarke).
3. **Hellmodus-Deckkraft** — WARNING — das dritte V steht bei 0,42 auf dem mittelgrauen Teil des Verlaufs; im Dunkelmodus trägt es, im Hellmodus wird es schwach. Betrifft nur Admins (Theme-Wahl ist admin-only), deshalb nicht behoben.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Entfernt: der Lede-Satz (stand wortgleich in der Meta-Description) und das Label
„Tools ↓" / „Werkzeuge ↓". Beide waren Doppelungen — die Kachelnamen darunter
sagen dasselbe.

Verbleibender Text im Umfang: nur die Zugangsnamen — `aria-label="Go to tools"`
bzw. „Zu den Werkzeugen". Das Zielwort ist in beiden Sprachen identisch mit der
Abschnittsüberschrift („Tools" / „Werkzeuge"), sodass Skip-Link und Marke
dasselbe Ziel gleich benennen; nur das Verb trennt sie, weil sich die Aktionen
unterscheiden.

### Pillar 2: Visuals (4/4)

Fokuspunkt der Fläche bleibt die Wortmarke — die V-Marke konkurriert nicht,
sie zitiert sie. Ohne Beschriftung getestet: die Marke steht als einziges
zentriertes Element unter einem sonst linksbündigen Satz, das trägt die
Aufmerksamkeit ohne Textzeile.

Icon-only-Bedienelement mit Zugangsname belegt (`aria-label` am `<a>`,
`aria-hidden` + `focusable="false"` am SVG) — verifiziert im DOM.

Erster Entwurf war zu schwach und wurde verworfen: 28 px breit, Strich 2,4 px,
drittes V bei 0,32. Am Screenshot gemessen las sich das als beliebiger
UI-Pfeil, nicht als der Buchstabe, und das dritte V verschwand — die Marke
zeigte faktisch zwei V statt drei. Korrigiert auf 46 px / Strich 4,5 /
Deckkraft 1 – 0,68 – 0,42, abgenommen an der Wortmarke im selben Viewport.

### Pillar 3: Color (4/4)

`git diff` über beide Dateien: **0** ergänzte hartcodierte Farbwerte
(`#…`/`rgb(`). Die Marke färbt ausschließlich über `color:var(--accent)`,
die Pfade erben per `stroke:currentColor`.

Tokenwahl geprüft, nicht geraten: am Fuß des Heros ist der Schleier
(`linear-gradient(0deg,var(--bg) 1%,…)`) bereits auf `var(--bg)` aufgelöst —
die Marke liegt auf der Seitenfläche, nicht auf dem Foto. Damit ist `--accent`
richtig und `--accent-media` falsch: letzteres bleibt in beiden Modi helles
Cyan und stünde im Hellmodus hell auf hell. Gemessen: dark `rgb(45,212,255)`,
light `rgb(5,101,124)`.

Akzent-Verteilung der Seite: 11× `var(--accent)`, 4× `var(--accent-media)` —
durch den Wegfall der Textzeile kommt kein neuer Akzent-Träger hinzu, die
Marke ersetzt einen `var(--muted)`-Träger durch einen Akzent-Träger.

### Pillar 4: Typography (4/4)

Die Änderung ist netto typografisch reduzierend: zwei Rollen fallen weg —
der Lede-Grad `clamp(1.05rem,1.8vw,1.3rem)` und die getrackte
Versalien-Kleinzeile `0.66rem/.24em`. Die Marke bringt keinen Schriftgrad mit
(reines SVG).

Geometrie ist von der Hausschrift abgeleitet statt erfunden: Orbitron 900
setzt ein breites V mit ~60°-Schenkeln und schwerem Strich; Winkel und
Strichverhältnis der Marke sind daran abgenommen. Das ist der Grund, warum
die Marke als Markenbuchstabe und nicht als Chevron liest.

Schriftgrade der Seite danach: 14 distinct `font-size`, 4 `font-weight` — über
dem Faustwert (>4 Grade), aber das ist der Bestand der Bento-Seite und lag
vorher bei 15/4.

### Pillar 5: Spacing (3/4)

Geänderte Werte: `h1` margin `0 0 .5rem` → `0`; `.hero__search` margin-top
`1.9rem` → `2.1rem`; `.hero__inner` padding-bottom `clamp(3.5rem,…)` →
`clamp(5.5rem,…)`; `.hero__cue` bottom `1.3rem` → `1rem`.

Die Erhöhung der unteren Innenkante ist Kollisionsschutz, kein Geschmack, und
sitzt bewusst als `clamp()`-Minimum statt im 520er-Umbruch: mit der alten
3,5rem-Untergrenze hätte die 70 px hohe Marke im Bereich 521–880 px auf dem
Suchfeld gesessen. Nachgemessen im Browser:

| Viewport | SVG | Abstand Suchfeld → Marke | Kollision |
|----------|-----|--------------------------|-----------|
| 1280 px | 46×70 | nebeneinander (kein Überlapp) | nein |
| 700 px | 34×52 | 15 px | nein |
| 375 px | 34×52 | 15 px | nein |

Punktabzug: die Seite hat keine Spacing-Skala (`1.9rem`, `1.3rem`, `.85rem`,
`.4rem` …). Die neuen Werte fügen sich ein, aber sie fügen sich in etwas
Ungeordnetes ein. Prä-existierend, nicht durch diese Änderung verursacht.

### Pillar 6: Experience Design (3/4)

Zustände am laufenden Objekt geprüft, nicht aus dem Code geschlossen:

- **Hover/Focus:** `transform: matrix(1,0,0,1,-40.2,3)` — die Marke rückt
  3 px nach unten, alle drei V gehen auf Deckkraft 1.
- **Tastatur:** Tab vom Suchfeld landet auf der Marke, `:focus-visible`
  greift, Ring `2px solid rgb(45,212,255)`, Offset 3 px — im Screenshot
  sichtbar.
- **Klick:** setzt `#tools`. Der Sprung selbst läuft über
  `html{scroll-behavior:smooth}`.
- **Reduced Motion:** die globale Regel `*{animation:none!important}` entfernt
  `vdrop`; die Basis-Deckkraft steht als normale Deklaration
  (`opacity:var(--o)`) auf dem Pfad und bleibt — die Marke bleibt vollständig
  sichtbar, sie steht nur still.
- **Tap-Ziel:** 74×66 px bei 375 px Breite (Minimum 44×44 erfüllt).
- **Animation:** ein Signal läuft gestaffelt (0 / 0,17 / 0,34 s) durch den
  Stapel, dann Ruhe bis 2,6 s. Kein Halo — das entspricht der Hausregel
  („Höhenschatten statt Akzent-Halo").

Punktabzug für den doppelten Tab-Stopp auf `#tools` (siehe Fix 1).

**Kein Audit-Regress:** `node scripts/audit-site.mjs` nach dem Build →
3 Fehler / 5 Warnungen, alle auf `/account/preview.html`, `/account.html`,
`/pilot.html` und einem Alt-Text — keiner auf einer Homepage. „Tote Anker: 0"
bestätigt, dass `#tools` auflöst.

---

## Nicht behoben (bewusst)

- **`npm run theme` ist zerstörerisch**, nicht nur nicht-idempotent: der Lauf
  schrieb 43 Deklarationen in 7 unbeteiligten Dateien um und erzeugte dabei
  u. a. `var(--chrome-solid, var(--chrome-solid))` (selbstbezüglicher
  Fallback) in `src/components/SiteNav.astro`, plus eine Leerzeile pro Datei
  und Lauf. Der Lauf wurde vollständig zurückgenommen; diese Änderung braucht
  ihn nicht, weil sie ausschließlich Tokens verwendet.
- **Hellmodus-Deckkraft** (siehe Fix 3) — Theme-Wahl ist admin-only.

## Files Audited

- `src/pages/index.astro`
- `src/pages/de/index.astro`
- `src/layouts/Layout.astro` (Overflow-/Scroll-Kontext)
- `assets/theme.css` (Token-Schicht)
- `.planning/codebase/CONVENTIONS.md` (Hauskonventionen)
