# Phase 2: Schrift- und Bewegungsskala - Research

**Researched:** 2026-08-08
**Domain:** CSS-Token-Architektur (Typografie + UI-Bewegung) in einem handgeschriebenen, unbundlten Astro-Projekt
**Confidence:** HIGH (fast alles ist mit `grep`/Node-Skripten am echten Bestand gemessen, kein Rätselraten)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Site-weit, nicht nur Kopfleiste und Startseite.** Die Roadmap formuliert enger, aber
  die 139 Werte liegen ohnehin site-weit. Eine Skala, die nur zwei Bereiche abdeckt, driftet beim
  nächsten Umbau sofort wieder auseinander. — **Reversibility:** costly — die Umstellung berührt
  sehr viele Dateien; ein Rückweg wäre ein zweiter Massendurchlauf.
- **D-02: `rem` statt `px`.** Einzige Variante, die die im Browser eingestellte Schriftgröße
  respektiert. Heute ist beides gemischt, es wird also ohnehin vereinheitlicht.
- **D-03: Die Bewegungsskala umfasst NUR Bedienübergänge** (die kurzen Dauern, ~0,15–0,25 s).
  Ambiente bleibt unangetastet — die langen Animationen sind je Seite bewusst unterschiedlich
  gestimmt, und Vereinheitlichung würde die Designwelten einebnen. Das trifft auch
  Erfolgskriterium 3 genau: es spricht vom Bruch im *Bewegungsverhalten*, nicht von der Ambiente.
- **D-04: Die drei fast identischen Kurven werden auf EINE zusammengeführt.** Sie sind über die
  Zeit entstandene Varianten desselben Gedankens, kein gewollter Unterschied.
- **D-05: Einrasten ist erlaubt — kleine optische Verschiebungen sind ausdrücklich in Ordnung.**
  Jeder heutige Wert wandert auf die nächste Stufe; einzelne Texte werden 1–2 px größer oder
  kleiner. Eine Skala mit 139 Stufen wäre keine Skala, sondern dieselbe Streuung mit Namen.

### Claude's Discretion
- Anzahl und Verhältnis der Stufen (aus der gemessenen Verteilung ableiten, nicht erfinden)
- Benennung der Token
- Ob die Umstellung per Codemod oder von Hand läuft — bei byte-gleichen Fundstellen ist ein
  Skript vertretbar, muss aber überprüfbar sein (Vorbild: `scripts/strip-cursorglow.mjs`)
- Welche der drei Kurven die überlebende wird
- Reihenfolge der umgestellten Bereiche

### Deferred Ideas (OUT OF SCOPE)
- Ambiente-Animationen in die Skala holen — bewusst abgewählt (D-03).
- Abstände/Spacing als eigene Skala — nicht besprochen, wäre eine eigene Phase.
- Der Hellmodus-Generator so erweitern, dass er auch externe CSS-Dateien sieht — berührt
  THEME-02 und ist ein eigenes Vorhaben.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TYPO-01 | Schriftgrade und Laufweiten der Kopfleiste und der Startseite folgen einer gemeinsamen Skala statt seitenlokaler Einzelwerte | Vollständige Ist-Erhebung (95 Dateien, 1968 font-size + 865 letter-spacing) liefert die Grundgesamtheit; Pattern 1 liefert einen konkreten Token-Vorschlag samt px→rem-Umrechnung (18px-Basis, Pitfall 2); Pitfall 1 warnt vor Unterschätzung des Umfangs |
| TYPO-02 | Übergangsdauern und Beschleunigungskurven sind über die Startseite hinweg vereinheitlicht | Ist-Erhebung von `transition`/`animation` (458/210 Deklarationen); mechanische Ambiente-vs-UI-Regel (`animation`+`infinite` = Ambiente, kurze `transition` = UI, Scroll-Reveal = Sonderfall) in Pitfall 3 und State of the Art |
| TYPO-03 | Kopfleiste und Startseite lesen sich als ein zusammenhängendes Bewegungsbild, nicht als zwei unabhängige Zustände | Pitfall 6 dokumentiert den laufzeitgemessenen Kopplungsmechanismus (`measureMorph()`) und die nötige Nachmessung; Architectural Responsibility Map weist die Sichtprüfung explizit dem Menschen zu |
| THEME-02 | Kein generierter `:root[data-theme="light"]`-Block wird von Hand verändert; Hellwerte entstehen über `npm run theme` | Pattern 1/Architecture Patterns klären exakt, was die drei Theme-Skripte anfassen (nur `src/**/*.astro`, nur Farbwerte) — neue Typografie-/Bewegungstoken in `assets/theme.css` oder mit `--font-`/`--dur`/`--ease`-Namen sind für alle drei Skripte unsichtbar, unabhängig vom Namen (siehe Korrektur zur SKIP-Regex-Annahme in Pattern 1/Summary) |
| SYNC-01 | Jede Änderung an einer Startseiten- oder Layout-Datei trifft die EN- und die DE-Fassung im selben Arbeitsschritt | `src/pages/index.astro` und `src/pages/de/index.astro` sind beide 389/390 Zeilen und tragen dieselben Regeln — jede Migration muss beide Dateien in einem Schritt anfassen; Don't-Hand-Roll und Pitfall 1 verweisen auf das bestehende `verify-fx.mjs`/`verify-help.mjs`-Muster als Vorbild für eine Paritätsprüfung |
</phase_requirements>

## Summary

Diese Phase ist kein Design-Problem, sondern ein **Erhebungs- und Massendurchlauf-Problem**. Der
Scout-Befund aus `02-CONTEXT.md` (414 `font-size` in 12 Dateien) war bewusst unvollständig — die
echte Zahl ist **1968 `font-size`-Deklarationen in 95 Dateien** (89 `.astro`-Komponenten + 6
`assets/*.css`), dazu **865 `letter-spacing`** in denselben Dateien und **458 `transition`** in 63
Dateien. Der Löwenanteil sitzt in gescopten `<style>`-Blöcken von `.astro`-Dateien, die Astro beim
Build in gehashte Bundles unter `dist/_astro/*.css` auslagert — nicht inline im HTML. Ein
Prüfskript, das nur `dist/**/*.html` durchsucht, sieht praktisch nichts von alledem (siehe Pitfall 6).

Die gute Nachricht: der bestehende Hell/Dunkel-Token-Mechanismus ist für diese Phase **kein
Hindernis**. `assets/theme.css` wird von KEINEM Skript beschrieben — die drei `npm run theme`-Skripte
(`build-light-palettes.mjs`, `tokenize-theme-colors.mjs`, `build-light-overrides.mjs`) durchsuchen
ausschließlich `src/**/*.astro` und schreiben nie in `assets/*.css`. Und selbst innerhalb der
`.astro`-Dateien gilt: die Skripte fassen nur Werte an, die als CSS-Farbe geparst werden können.
Ein `--fs-4: 0.94rem` oder `--dur-fast: 150ms` ist für sie unsichtbar, unabhängig vom Namen.
`assets/theme.css` (bereits site-weit über `Layout.astro` geladen, VOR jedem Seiten-CSS) ist damit
der sichere, naheliegende Ort für die neuen Tokens.

Die zweite gute Nachricht betrifft den größten befürchteten Risikopunkt: die scroll-verknüpfte
Wortmarken-Wandlung aus Phase 1 (MARK-03/MARK-06) berechnet ihre Transformation **zur Laufzeit per
`getComputedStyle`/`getBoundingClientRect`** (`SiteNav.astro`, Funktion `measureMorph()`), nicht aus
fest verdrahteten Zahlen. Skalierung, horizontale und vertikale Wegstrecke ergeben sich aus dem
tatsächlich gerenderten Schriftgrad von `.hero__mark h1` und `.snav__brand span` — ändert sich einer
der beiden Werte durch die neue Skala, rechnet der Code beim nächsten `remeasure()` automatisch neu.
Das Risiko ist real, aber kleiner als befürchtet: der gefährliche Fall ist nicht „Wert geändert",
sondern „Messung feuert nicht neu" oder „die 55/75-%-Fortschrittsmarken aus Phase 1 passen nicht
mehr, weil sich die Zeitachse der Wandlung durch die neue Bewegungsskala ändert".

**Primary recommendation:** Neue Tokens in `assets/theme.css` (eigener neuer Abschnitt, ähnliche
Kommentar-Konvention wie die drei bestehenden Schichten), Ist-Erhebung und Snap-Mapping per
Node-Skript nach dem Vorbild `scripts/strip-cursorglow.mjs` (Sollzahlen, `--dry`, `--only`,
Zwei-Pass), Prüfung gegen `dist/**/*.html` UND `dist/_astro/*.css` gemeinsam — und die
Umfangsschätzung der Roadmap (2 Pläne) im Planning-Schritt explizit gegenprüfen, weil die
gemessene Grundgesamtheit rund 4,7× größer ist als der Scout annahm.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schriftgrad-/Laufweiten-Tokens (Werte) | CDN/Static (assets/theme.css, ausgeliefert von nginx) | — | Reine Werte-Deklaration, kein Verhalten; muss vor jedem Seiten-CSS geladen sein |
| Anwendung der Tokens auf Selektoren | Browser/Client (gescopte `<style>` in `.astro`, kompiliert zu `dist/_astro/*.css`) | — | Astro kompiliert Komponenten-CSS zu statischen, gecachten Bundles — es gibt keine Server-Rendering-Stufe, die hier eingreift |
| Scroll-verknüpfte Maßstabsberechnung (Hero↔Leiste) | Browser/Client (Inline-Skript in `SiteNav.astro`) | — | Läuft bewusst zur Laufzeit per `getComputedStyle`, damit sie den echten gerenderten Wert nimmt statt eine Zahl zu duplizieren |
| Bewegungsskala für UI-Übergänge (Dauer/Kurve) | Browser/Client (CSS `transition`) | — | Rein deklaratives CSS, keine JS-Steuerung nötig außer bei bereits bestehenden Spezialfällen (Menü-Choreografie, Scroll-Reveal) |
| Verifikation der Skala gegen den gebauten Stand | Build/CI (Node-Skript gegen `dist/`) | — | Folgt dem etablierten Muster `verify-fx.mjs`/`verify-help.mjs`: prüft den AUSGELIEFERTEN Zustand, nicht die Quelle |
| Sichtprüfung „kein Bruch im Bewegungsverhalten" (Erfolgskriterium 3) | Mensch (Browser) | — | Kein Automat kann „liest sich als ein Bild" beurteilen; gehört als `checkpoint:human-verify` in den Plan |

## Standard Stack

Diese Phase führt **keine neue Bibliothek** ein. Das Projekt hat sich bewusst gegen ein
CSS-Framework/Bundler für `assets/` entschieden (`REQUIREMENTS.md` § Out of Scope) — die Skala
entsteht als eigene CSS-Custom-Property-Schicht plus einem Node-Massendurchlaufskript, beides im
bestehenden Stil des Repos.

### Core
| Werkzeug | Version | Zweck | Warum Standard hier |
|---------|---------|---------|--------------|
| CSS Custom Properties (`--fs-*`, `--dur-*`, `--ease-*`) | — (native) | Token-Schicht für Schriftgrad, Laufweite, Übergangsdauer, Kurve | Bereits das Muster für Farbe (`--bg`, `--accent` …) und Schrift-Familie (`--font-display` …) in `assets/theme.css`/`detail.css`; kein neues Konzept nötig |
| Node.js (`node:fs`, `node:path`, kein externes Paket) | vorhandene Projekt-Node-Version | Ist-Erhebung + codemod + Prüfskript | Exaktes Vorbild `scripts/strip-cursorglow.mjs`, `scripts/tokenize-theme-colors.mjs`, `scripts/verify-fx.mjs` — alle ohne Fremdabhängigkeit |

### Supporting
| Werkzeug | Version | Zweck | Wann einsetzen |
|---------|---------|---------|-------------|
| `node --test` (eingebauter Node-Test-Runner) | vorhanden (`tests/e2e/**/*.test.js`) | Automatisierte Zusicherungen gegen `dist/` | Für die maschinell prüfbaren Teile von TYPO-01/02 (z. B. DE/EN-Zeichenzahl-Paritäten), NICHT für Erfolgskriterium 3 |

### Alternatives Considered
| Statt | Könnte man nehmen | Trade-off |
|------------|-----------|----------|
| Handgeschriebenes Node-Skript für die Ist-Erhebung | PostCSS + `postcss-value-parser` | Exakteres CSS-Parsing (kein Regex-Fallstrick bei fehlendem Semikolon vor `}`), aber neue Abhängigkeit in einem Projekt, das bewusst ohne Build-Tooling für `assets/` auskommt — abgelehnt |
| CSS Custom Properties für die Skala | Sass/Less-Variablen | Bräuchten einen Präprozessor-Build-Schritt, den es hier nicht gibt (Astro kompiliert nur `.astro`-Komponenten, nicht `assets/*.css`) — nicht einsetzbar ohne neue Tool-Kette |
| `clamp()` für fluide Überschriften beibehalten | Alles auf feste `rem`-Stufen zwingen | Die 313 `clamp()`-Deklarationen sind absichtlich responsiv (Vw-Anteil) — sie in feste Stufen zu pressen würde die Fluid-Typografie der Hero-/Sektions-Überschriften zerstören; sie brauchen eigene, auf der Skala aufbauende `clamp()`-Tokens, keine Ersetzung durch feste Werte |

**Installation:** Keine — reine CSS/Node-Änderung im Bestand, keine `npm install`-Zeile nötig.

## Package Legitimacy Audit

**Nicht anwendbar.** Diese Phase installiert keine externen Pakete (siehe `Standard Stack` oben —
alles läuft mit Bordmitteln: native CSS Custom Properties und Node-Bordbibliotheken). Der Gate
entfällt ersatzlos.

## Architecture Patterns

### System Architecture Diagram

```
Quelle (Autorenzeit)                  Build (Astro)                    Ausgeliefert (Browser)
─────────────────────                 ──────────────                   ──────────────────────

assets/theme.css  ──────loaded first──────────────────────────────►  <link> im <head>
  └─ NEU: § 4 Typo/Motion-Tokens                                        (theme.css, ungebündelt,
     --fs-1..--fs-N, --ls-1..--ls-N,                                     eigene URL, ?v=sha1)
     --dur-fast/--dur-base, --ease-ui
                                                                          │
src/**/*.astro                                                           │ Custom Properties
  ├─ gescoptes <style>  ──────Astro-Compiler────►  dist/_astro/*.css     │ vererben sich auf
  │    (font-size: var(--fs-N))                     (gehashter Bundle,   │ alle Selektoren, die
  │                                                   NICHT im HTML)     │ var(--fs-N) referenzieren
  ├─ <style is:inline>  ──────unverändert─────────►  dist/**/*.html      │
  │    (bleibt wörtlich im <head>/<body>)             (inline <style>)  │
  └─ style={`font-size:${x}rem`} (32 dynamische     ──────────────────►  dist/**/*.html
       Stellen, z. B. Topic-Auto-Fit)                                    (Laufzeit-Wert, NICHT
                                                                           Teil der Skala-Prüfung)
                                                                          │
SiteNav.astro <script is:inline>                                         │
  measureMorph() liest zur LAUFZEIT                ◄──── getComputedStyle┘
  getComputedStyle(.hero__mark h1).fontSize                (im Browser, nach DOMContentLoaded
  getComputedStyle(.snav__brand span).fontSize                + document.fonts.ready)
  → berechnet --s (Skalierfaktor), --dx/--dy
  → schreibt CSS-Variablen auf .hero__mark / #topbar

Verifikation (nach npm run build):
  scripts/verify-typo-motion.mjs (neu, Vorbild verify-fx.mjs)
    ├─ durchsucht dist/**/*.html      (is:inline-Stile, Inline style=)
    └─ durchsucht dist/_astro/*.css   (gescopte Komponenten-Stile — HIER liegt der Löwenanteil)
    → Soll/Ist gegen die im Skript hart codierte Werteliste der Skala
```

### Recommended Project Structure
```
assets/
├── theme.css              # + neuer Abschnitt: Typografie- und Bewegungs-Tokens (Werte)
scripts/
├── audit-typo-motion.mjs  # NEU: Ist-Erhebung (Zähl-/Verteilungsbericht, --dry-artig, schreibt nichts)
├── migrate-typo-motion.mjs# NEU: Codemod nach strip-cursorglow-Vorbild (Sollzahlen, --dry, --only)
└── verify-typo-motion.mjs # NEU: Prüfung gegen dist/ (HTML + _astro/*.css), Vorbild verify-fx.mjs
```

### Pattern 1: Token-Schicht in `assets/theme.css`, nicht in Einzeldateien
**Was:** Ein neuer, klar abgegrenzter Abschnitt in `assets/theme.css` (nach dem bestehenden Muster
der drei Schichten GRUND/EFFEKT/MEDIEN) mit den Schriftgrad-, Laufweiten-, Dauer- und
Kurven-Tokens.
**Wann einsetzen:** Für JEDEN site-weiten Wert (D-01 verlangt site-weit). Seitenlokale
`:root{}`-Blöcke bleiben für Farbidentität reserviert, wie bisher.
**Beispiel (Namenskonvention, an bestehende Tokens angelehnt):**
```css
/* Source: eigener Entwurf nach dem Muster von assets/theme.css §1-3 */
:root {
  /* --- Typografie: aus der gemessenen Verteilung (siehe unten), 18px-Basis --- */
  --fs-1: 0.56rem;   /* ~10.1px – Mikro-Labels, kbd */
  --fs-2: 0.61rem;   /* ~11.0px */
  --fs-3: 0.67rem;   /* ~12.0px */
  --fs-4: 0.72rem;   /* ~13.0px */
  --fs-5: 0.78rem;   /* ~14.0px */
  --fs-6: 0.83rem;   /* ~15.0px */
  --fs-7: 0.89rem;   /* ~16.0px – Fließtext-nah */
  --fs-8: 1rem;      /* 18.0px – Basis (html { font-size:112.5% } macht 1rem = 18px!) */
  --fs-9: 1.11rem;   /* ~20.0px */
  --fs-10: 1.33rem;  /* ~24.0px */
  --fs-11: 1.67rem;  /* ~30.0px */
  --fs-12: 2.22rem;  /* ~40.0px */

  /* --- Laufweite: 0.02em-Raster deckt die gemessene Verteilung fast lückenlos --- */
  --ls-1: 0.02em; --ls-2: 0.04em; --ls-3: 0.06em; --ls-4: 0.08em;
  --ls-5: 0.1em;  --ls-6: 0.12em; --ls-7: 0.14em; --ls-8: 0.16em;
  --ls-9: 0.2em;  --ls-10: 0.3em;

  /* --- Bewegung: NUR Bedienübergänge (D-03) --- */
  --dur-fast: 150ms;
  --dur-base: 200ms;
  --dur-slow: 250ms;
  --ease-ui: cubic-bezier(0.2, 0.7, 0.3, 1); /* Fusion der drei Fast-Duplikate, D-04 */
}
```
**Kritisch:** `html { font-size: 112.5%; }` steht in `src/layouts/Layout.astro` (Zeile 240) —
`1rem` ist auf dieser Seite effektiv **18px**, nicht 16px. Jede Umrechnung px→rem in dieser Phase
MUSS durch 18 teilen, nicht durch 16. [VERIFIED: repo]

### Pattern 2: Bestehendes `--ease`/`--ease-out` in `assets/archive.css` ist ein Präzedenzfall — kein Neuland
**Was:** `assets/archive.css` (nur auf `/archiv.html` + `/de/archiv.html` geladen) definiert bereits
lokal `--ease: cubic-bezier(0.22, 0.61, 0.36, 1)` und `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` und
nutzt sie in ~20 `transition:`-Deklarationen. Das ist EINE der drei „fast identischen" Kurven aus
D-04 (`cubic-bezier(0.16, 1, 0.3, 1)`, 6× site-weit gezählt).
**Wann einsetzen:** Der Plan muss entscheiden, ob `archive.css`s eigene Zwei-Kurven-Lösung (eine
für Standardübergänge, eine für „Ease-Out" bei Reveal/Eintritt) auf den globalen Token verweist
(`--ease: var(--ease-ui)`) oder ob Archiv bewusst seine EIGENE, bereits vereinheitlichte Sprache
behält, weil `--ease` dort auch auf lange Übergänge (0.85s Farbwechsel bei Ären-Wechsel) angewendet
wird, die laut D-03 NICHT in die Bewegungsskala gehören (siehe Pitfall 3 unten). Empfehlung: Archiv
bleibt bei seinen eigenen `--ease`/`--ease-out`-Namen (Kollisionsgefahr mit einem globalen `--ease`
in `theme.css`, falls beide `:root` setzen — Quellreihenfolge entscheidet, `archive.css` lädt NACH
`theme.css` und würde einen gleichnamigen globalen Token in dessen Geltungsbereich überschreiben).
Falls ein globaler Name gewählt wird, MUSS er anders heißen als `--ease`/`--ease-out`
(z. B. `--ease-ui`), um diese Kollision zu vermeiden.

### Pattern 3: Massendurchlauf nach `strip-cursorglow.mjs`-Vorbild
**Was:** Ist-Erhebung → Sollzahl fixieren → Zwei-Pass-Codemod (erst validieren, dann schreiben) →
Prüfskript, das dauerhaft bleibt.
**Wann einsetzen:** Für jede Umstellung, bei der Fundstellen BYTEGLEICH sind (z. B. `font-size:
0.7rem` → `font-size: var(--fs-4)` überall dort, wo 0.7rem tatsächlich der nächstliegende
Skalenwert ist). Für alles andere (Ausreißer wie `14.5px`, dynamische `style={...}`-Werte,
Sonderfälle wie die Hero/Leiste-Kopplung) gilt: von Hand, mit Begründung im Plan — genau die im
`CONTEXT.md` als „Claude's Discretion" vermerkte Freiheit.

### Anti-Patterns to Avoid
- **Ein Regex ohne `}`-Fallback:** Minifiziertes/kompaktes CSS im Repo lässt oft das Semikolon vor
  der schließenden Klammer weg (`font-size:.7rem}.next{...}`). Ein Erhebungs-Skript, das nur bis
  zum nächsten `;` sucht, frisst dann die halbe nächste Regel mit — beim eigenen Erhebungslauf für
  diese Recherche hat genau das die ersten Zahlen verfälscht (siehe Methodik unten). Immer
  `[^;}]+[;}]` verwenden, nie nur `[^;]+;`.
- **`dist/**/*.html` als einzige Prüfquelle:** Erwischt nur `<style is:inline>` und rohe
  `style="…"`-Attribute. Der Löwenanteil (gescopte `<style>`-Blöcke) landet in
  `dist/_astro/*.css` — siehe Pitfall 6.
- **`clamp()`-Ausdrücke pauschal auf feste Stufen zwingen:** Die 313 `clamp()`-Deklarationen sind
  absichtlich fluid (enthalten `vw`). D-05 erlaubt Einrasten für STATISCHE Werte, nicht für
  responsive Formeln — ihr Min/Max kann auf Skalenwerte gesetzt werden, ihre Formel bleibt.

## Don't Hand-Roll

| Problem | Nicht selbst bauen | Stattdessen | Warum |
|---------|-------------|--------------|-----|
| CSS-Wertextraktion aus 95 Dateien | Ein einziges großes Regex, das jeden Sonderfall selbst abdeckt | Kleine, testbare Regex-Bausteine pro Eigenschaft (`font-size`, `letter-spacing`, `transition`, `animation`) + manuelle Stichprobe der Ausreißer | Ein CSS-Wert kann Kommentare, verschachtelte Klammern (`cubic-bezier(...)`, `clamp(...)`), fehlende Semikola und `!important` enthalten — die drei bestehenden Theme-Skripte lösen das bereits fein-granular (`parseTokens`, `soleColor`), nicht mit einem Universal-Regex |
| Skalen-Ratio-Berechnung | Ein Textbuch-Verhältnis (1.25, 1.333 …) blind auf die volle Spannweite anwenden | Die gemessene Verteilung selbst als Grundlage nehmen (dichteres Raster 10–19px effektiv, weiteres Raster darüber/darunter) | D-05/Specific Ideas verlangen das ausdrücklich — ein Lehrbuch-Verhältnis würde die dicht beieinanderliegenden, sehr häufigen Werte auf zu wenige Stufen zwingen |

**Key insight:** Das eigentliche Risiko dieser Phase ist nicht CSS-Kompetenz, sondern
Vollständigkeit — bei 95 Dateien und ~2800 Deklarationen (font-size + letter-spacing) reicht eine
Stichprobe nicht, und ein Codemod ohne Sollzahl-Zwang hinterlässt unbemerkt Reste.

## Common Pitfalls

### Pitfall 1: Der Scout hat nur 12 von 95 Dateien gesehen
**Was schiefgeht:** Ein Plan, der von „414 Deklarationen, 12 Dateien" ausgeht, unterschätzt den
Umfang um Faktor ~5 bei font-size und öffnet zusätzlich `letter-spacing` (865 Vorkommen) gar nicht
erst als eigene Dimension, obwohl TYPO-01 ausdrücklich „Schriftgrade UND Laufweiten" nennt.
**Warum es passiert:** Der ursprüngliche Scout hat nur `SiteNav.astro`, beide `index.astro` und
`assets/*.css` gezählt — die 83 übrigen `.astro`-Komponenten (Patch-Körper, Themen-Körper,
Werkzeug-Apps, Konto-Seiten) blieben außen vor.
**Wie vermeiden:** Die unten dokumentierten Ist-Zahlen als Planungsgrundlage nehmen, nicht die aus
`02-CONTEXT.md`. Zwei Pläne (wie in `ROADMAP.md` vorgesehen) sind für diesen Umfang eng — der
Planer sollte gegenprüfen, ob eine dritte Welle (z. B. „alle 19 Patch-Körper" als eigener,
mechanisch abgeschlossener Schritt) den Bau robuster macht, ähnlich wie Phase 1.1 ihre 41
Partikel-Schleifen in eine eigene Welle 2 gelegt hat.
**Warnzeichen:** Ein Plan, der „Kopfleiste und Startseite" als Dateiliste benennt, aber keine
Patch-/Themen-/Werkzeug-Komponenten erwähnt, obwohl D-01 site-weit verlangt.

### Pitfall 2: `html { font-size: 112.5%; }` — 1rem ist 18px, nicht 16px
**Was schiefgeht:** Jede Umrechnung, die von der Browser-Default-Annahme 16px ausgeht, verschiebt
JEDEN vorgeschlagenen Skalenwert um 12,5 % gegenüber dem, was tatsächlich im Browser ankommt.
**Warum es passiert:** `112.5%` steht in einem `<style is:inline>`-Block in `Layout.astro`
(Zeile 240) mit dem Kommentar „Lesbarkeits-Grundlage: 18px-Wurzel statt Browser-Default 16px" —
leicht zu übersehen, weil es nicht in `assets/theme.css` steht, wo man Basis-Metrik vermuten würde.
**Wie vermeiden:** Jede px→rem-Umrechnung in dieser Phase durch 18 teilen. Die Skala oben (Pattern 1)
ist bereits auf dieser Basis gerechnet.
**Warnzeichen:** Ein `--fs-8: 1rem` als „Basiswert 16px" bezeichnet, obwohl er im gerenderten
Ergebnis 18px sind.

### Pitfall 3: Nicht jede lange `transition:`-Dauer ist ein Bug — manche sind geschützte Ambiente
**Was schiefgeht:** Ein naiver Sweep, der „alle `transition`-Dauern auf die neue kurze Skala
zwingt", trifft auch die **Scroll-Reveal**-Übergänge (`.js .reveal { transition: opacity 0.7s
var(--ease-out), transform 0.8s var(--ease-out); }`, 27 Dateien mit `IntersectionObserver`,
0.5–2.6 s Dauer). Scroll-Reveal ist in `FX-07` (Phase 1.1, bereits abgeschlossen) ausdrücklich als
Ambiente-Effekt gelistet, der unverändert bleibt — genau wie Ken Burns und Parallaxe.
**Warum es passiert:** Scroll-Reveal benutzt die CSS-Eigenschaft `transition`, nicht `animation` —
eine reine „Eigenschaftsname"-Heuristik (`transition` = UI, `animation` = Ambiente) würde es
fälschlich als UI-Bedienübergang einsortieren.
**Wie vermeiden:** Siehe die mechanische Regel unten — Scroll-Reveal ist eine dritte, explizit zu
benennende Kategorie neben „Ambiente per `animation`" und „Bedienübergang per `transition`".
**Warnzeichen:** Eine Migration, die `.reveal`/`.node__card`/`.era`-Selektoren in `archive.css` oder
die 0.7s/0.9s/1.2s/2.6s-Übergänge in `detail.css`/`ShipDetail.astro`/Patch-Körpern anfasst.

### Pitfall 4: Gescopte `<style>` landen NICHT im HTML — sie landen in `dist/_astro/*.css`
**Was schiefgeht:** Ein Prüfskript, das `grep font-size dist/**/*.html` macht, meldet „0 Treffer"
und damit fälschlich Erfolg, während der eigentliche Bestand unverändert in einem gehashten Bundle
liegt.
**Warum es passiert:** Astro extrahiert normale (nicht `is:inline`) `<style>`-Blöcke aus
`.astro`-Komponenten in eigene CSS-Dateien mit Content-Hash im Namen
(`dist/_astro/item-finder.BE7g4rjD.css` u. ä.) — bereits dokumentiert für das Menü-Deck-CSS in der
Projekt-Erinnerung, hier bestätigt am Beispiel `.snav__brand`, das denselben Weg geht.
**Wie vermeiden:** Jedes Prüfskript für diese Phase MUSS sowohl `dist/**/*.html` (für
`is:inline`-Stile und rohe `style="…"`-Attribute) ALS AUCH `dist/_astro/*.css` (für den
Löwenanteil) durchsuchen.
**Warnzeichen:** Ein Prüfskript mit nur einem `walk('dist', '.html')` und keinem zweiten Durchlauf
über `.css`.

### Pitfall 5: 32 dynamische `style="font-size:…"`-Zuweisungen entziehen sich der Skala
**Was schiefgeht:** 24 Dateien (v. a. Themen-Körper wie `4-0-1-fight-for-pyro.astro`,
`CraftingApp.astro`) setzen `font-size` über ein Template-Literal in einem `style=`-Attribut,
vermutlich für automatische Größenanpassung an Textlänge. Diese Werte sind zur Build-Zeit nicht
bekannt und können nicht 1:1 auf einen der neuen Skalenwerte gemappt werden.
**Warum es passiert:** Auto-Fit-Logik (Text an verfügbaren Platz anpassen) braucht kontinuierliche
Werte, keine diskreten Stufen.
**Wie vermeiden:** Diese Stellen im Plan explizit als Ausnahme benennen (nicht stillschweigend
übergehen) — entweder auf den NÄCHSTGELEGENEN Skalenwert als Ober-/Untergrenze clampen, oder
bewusst von der Skalenpflicht ausnehmen und im Prüfskript auf eine Ausschlussliste setzen.
**Warnzeichen:** Ein Prüfskript, das nach der Migration bei diesen 24 Dateien fälschlich „Wert
außerhalb der Skala" meldet.

### Pitfall 6: Die Hero↔Leiste-Kopplung ist laufzeitgemessen — testen heißt: nach dem Bau ÖFFNEN, nicht nur lesen
**Was schiefgeht:** Weil `measureMorph()` `getComputedStyle`/`getBoundingClientRect` zur Laufzeit
liest, kann eine falsche Token-Zuordnung NICHT durch bloßes Lesen des CSS entdeckt werden — der
Fehler zeigt sich erst im gerenderten Zustand (z. B. wenn die neue `--fs-N`-Zuordnung von
`.hero__mark h1` oder `.snav__brand span` die vorher fein austarierten Fortschrittsmarken aus Phase
1 (`p=0.55` Maßstab fertig, `p=0.75` Überlappung beginnt, siehe `01-SUMMARY.md`) verschiebt.
**Warum es passiert:** Die Zahlen `0.55`/`0.75` in `01-SUMMARY.md` sind aus dem VORHERIGEN
Schriftgrad-Verhältnis empirisch gefunden — sie sind kein Naturgesetz, sondern an das damalige
Größenverhältnis von `.hero__mark h1` (`clamp(2.9rem,12vw,8.5rem)`) zu `.snav__brand`
(`font-size:1rem`) angepasst. Ändert sich eines der beiden (weil sie jetzt auf Skalenwerte
einrasten), ändert sich implizit auch das Verhältnis `fb/fa` in `--s` — die Wandlung bleibt
FUNKTIONAL korrekt (sie berechnet ja neu), aber die SUBJEKTIVE Choreografie (wann beginnt die
Überlappung, wie schnell schrumpft der Text) verschiebt sich.
**Wie vermeiden:** Nach der Umstellung dieselbe Messreihe wie in `01-SUMMARY.md` wiederholen
(Landung Desktop 1280px hell/dunkel, Fortschrittskurve, Kontrast über der Füllung) — nicht nur
behaupten, dass „die Wandlung noch funktioniert", sondern die konkreten Zahlen erneut ziehen und
gegen die alten Werte STELLEN, nicht nur auf „sieht noch gut aus" prüfen. Falls `.hero__mark h1`
NICHT auf die neue rem-Skala umgestellt wird (weil sie `clamp()`-fluid bleibt, siehe Pattern 1),
ist das Risiko ohnehin kleiner — dann ändert sich nur `.snav__brand` (aktuell exakt `1rem` = einer
der Skalenwerte, `--fs-8`), was eine 1:1-Fortführung ist.
**Warnzeichen:** Ein Plan, der Erfolgskriterium 3 als reine Sichtprüfung abhakt, ohne die
Fortschritts-Prozentwerte aus Phase 1 erneut zu messen.

## Code Examples

### Ist-Erhebung: robuste Werteextraktion (Lehre aus dieser Recherche)
```javascript
// Source: eigene Erhebung für diese Recherche — Fallstrick dokumentiert in
// "Anti-Patterns to Avoid" oben (fehlendes Semikolon vor `}` in kompaktem CSS)
const fsRe = /font-size\s*:\s*([^;}]+)[;}]/g;   // NICHT [^;]+; — frisst sonst die Folgeregel
```

### Laufzeit-Messung der Hero↔Leiste-Kopplung (bereits im Bestand, unverändert lassen)
```javascript
// Source: src/components/SiteNav.astro, Funktion measureMorph() (Zeile ~1810-1838)
var fa = parseFloat(getComputedStyle(markText).fontSize);
var fb = parseFloat(getComputedStyle(brandText).fontSize);
// ...
mark.style.setProperty('--s', (fb / fa).toFixed(4));
```
Dieser Code liest die Schriftgrade IMMER frisch — eine Token-Umstellung an `.hero__mark h1` oder
`.snav__brand span` erfordert hier KEINE Codeänderung, nur eine erneute Messreihe nach dem Bau
(Pitfall 6).

## State of the Art

| Vorher | Jetzt (diese Phase) | Wann geändert | Bedeutung |
|--------------|------------------|---------------|--------|
| 86 verschiedene tatsächlich gerenderte Schriftgrade (aus 262 Roh-Schreibweisen: `px`/`rem`/`em` gemischt), 30 verschiedene Laufweiten, kein einziger `font-size: var(...)`-Aufruf im ganzen Bestand | Eine benannte Skala mit ~10-12 Schriftgrad-Stufen und ~10 Laufweiten-Stufen, referenziert über `var(--fs-N)`/`var(--ls-N)` | Diese Phase | TYPO-01 |
| 45 verschiedene Übergangsdauer-Schreibweisen (u. a. `.2s`/`0.2s` als reine Notationsdopplung derselben Zahl), 13 Kurven-Schreibweisen, davon 3 fast identische `cubic-bezier`-Varianten | Ein fest benannter Satz `--dur-fast/--dur-base/--dur-slow` + `--ease-ui`, NUR für Bedienübergänge (Ambiente/Scroll-Reveal bleiben unverändert, D-03) | Diese Phase | TYPO-02 |

**Nicht betroffen (bewusst unverändert, Ambiente):**
- `animation`-Deklarationen mit `infinite` (Ken Burns `kb`/`kb2`/`kenburns`, Sternendrift
  `scrollx`, Flackern `flick`/`rgbs`, Puls-Effekte) — 210 Vorkommen, 61 distinct, D-03 schließt sie
  explizit aus.
- Scroll-Reveal-Übergänge (`.reveal`, `.node.lit`, Ära-Wechsel in `archive.css`) — technisch
  `transition:`, aber laut FX-07-Präzedenzfall Ambiente, siehe Pitfall 3.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Der vorgeschlagene konkrete Skalenwert-Satz (`--fs-1`…`--fs-12`, `--ls-1`…`--ls-10`, `--dur-fast/base/slow`, `--ease-ui`) ist ein Vorschlag aus der gemessenen Verteilung, keine verifizierte externe Norm — die exakte Stufenzahl und die genauen Zwischenwerte liegen laut `CONTEXT.md` in „Claude's Discretion" | Standard Stack, Pattern 1 | Gering — D-05 erlaubt Einrasten/Verschiebung ausdrücklich; eine andere Stufenzahl wäre gleichwertig zulässig, solange sie aus der Verteilung abgeleitet ist |
| A2 | Der Name `--ease-ui` (statt `--ease`) für den globalen Bedienübergang-Token wird empfohlen, um Kollision mit dem bereits lokal in `assets/archive.css` definierten `--ease`/`--ease-out` zu vermeiden — die tatsächliche Namenswahl liegt in „Claude's Discretion" (Benennung der Token) | Pattern 2 | Gering bis mittel — bei falscher Namenswahl überschreibt die Quellreihenfolge (archive.css lädt nach theme.css) den globalen Wert auf der Archiv-Seite lautlos; leicht zu übersehen, da keine Fehlermeldung entsteht |
| A3 | Die 32 dynamischen `style="font-size:…"`-Zuweisungen dienen einer Text-Autofit-Funktion — nicht im Detail nachvollzogen, ob es sich tatsächlich um Autofit oder einen anderen Zweck handelt | Pitfall 5 | Mittel — falls es sich um etwas anderes handelt (z. B. ein CMS-Feld für Schriftgröße), wäre die empfohlene Behandlung (Ausnahme von der Skalenpflicht) eventuell falsch |

**A1–A3 sind Einschätzungen/Empfehlungen dieser Recherche, keine unbelegten Tatsachenbehauptungen** —
die zugrunde liegenden Zahlen (Verteilung, Dateizahlen, Skript-Verhalten) sind alle
`[VERIFIED: repo]` per Grep/Node-Skript gegen den echten Bestand gemessen.

## Open Questions

1. **Reicht die Roadmap-Aufteilung in 2 Pläne für den gemessenen Umfang?**
   - Was wir wissen: 95 Dateien für font-size/letter-spacing, 63 Dateien für transition/animation,
     mit Überlappung. Phase 1.1 hat einen strukturell ähnlichen Massendurchlauf (Partikel-Schleifen
     über 41 Dateien) in eine EIGENE Welle gelegt statt sie mit dem Tracer zu vermischen.
   - Was unklar ist: Ob „02-01: Schriftskala erheben und zusammenführen" / „02-02: Übergangsdauern
     und Kurven vereinheitlichen" (aus `ROADMAP.md`) für ~2800 Deklarationen über 95+ Dateien
     realistisch in je einem Plan/einer Welle zu schaffen ist, oder ob eine dritte Welle (z. B.
     „Patch-/Themen-Körper" als eigener, mechanisch abgeschlossener Schritt, analog Phase 1.1
     Welle 2) sinnvoller ist.
   - Empfehlung: Der Planer sollte einen Tracer (EINE Seite/Komponente komplett, End-to-End bis
     `dist/`) von der Breite (alle 95 Dateien) trennen — genau das Muster, das in Phase 6/7/8
     wiederholt gut funktioniert hat.

2. **Soll `.hero__mark h1` (aktuell `clamp(2.9rem,12vw,8.5rem)`) auf die neue Skala umgestellt
   werden, oder bleibt sein `clamp()` unangetastet?**
   - Was wir wissen: Es ist eine der 313 fluiden `clamp()`-Deklarationen, keine der 1652 statischen.
     D-02 verlangt „rem statt px" — das ist hier bereits erfüllt (alle drei `clamp()`-Parameter sind
     `rem`). D-01 verlangt eine „benannte Skala" für „Schriftgrade und Laufweiten von Kopfleiste UND
     Startseite" — der Hero-Titel ist Teil der Startseite.
   - Was unklar ist: Ob „benannte Skala" bedeutet, dass auch die `clamp()`-Grenzen als
     `clamp(var(--fs-min), 12vw, var(--fs-max))` geschrieben werden müssen, oder ob eine Handvoll
     bewusst freistehender Fluid-Headline-Werte (Hero, große Sektions-Titel) außerhalb der
     Basis-Skala bleiben dürfen, weil sie ohnehin nur an ~5-6 Stellen vorkommen (19 Vorkommen von
     `clamp(1rem,1.6vw,1.25rem)` u. ä. sind schon selbst eine Mini-Skala von sich wiederholenden
     Werten).
   - Empfehlung: Im Plan explizit entscheiden und begründen, nicht stillschweigend eine der beiden
     Optionen wählen.

3. **Wird `assets/archive.css`s bestehende `--ease`/`--ease-out`-Lösung an die globale Skala
   angeglichen oder bleibt sie ihr eigenes System?**
   - Was wir wissen: Sie ist bereits intern konsistent (ein Token für Standard, eins für Ease-Out,
     ~20 Anwendungsstellen) und deckt sowohl kurze UI-Übergänge (0.2s-0.3s, Hover/Fokus) als auch
     lange Ambiente-Übergänge (0.85s Ären-Wechsel) mit DENSELBEN zwei Kurven-Tokens ab — eine
     Vermischung, die D-03 für die NEUE globale Skala explizit ausschließt (nur Bedienübergänge).
   - Was unklar ist: Ob eine Migration der kurzen `archive.css`-Übergänge auf den globalen Token bei
     gleichzeitigem Belassen der langen Übergänge auf dem lokalen `--ease`/`--ease-out` sauber
     trennbar ist, ohne die Seite optisch zu verändern (die Kurven-Werte selbst unterscheiden sich:
     `cubic-bezier(0.22, 0.61, 0.36, 1)` lokal vs. die drei site-weiten Kandidaten aus D-04).
   - Empfehlung: Archiv-Seite als eigenen, spät in der Reihenfolge behandelten Bereich einplanen,
     mit einer bewussten Entscheidung „übernimmt globalen Token" vs. „bleibt eigenständig, weil
     Ambiente+UI dort bereits verschmolzen sind".

## Environment Availability

Diese Phase hat keine externen Laufzeit-Abhängigkeiten (keine neue Datenbank, kein neuer Dienst,
kein neues CLI-Werkzeug) — reine Quelltext-/Build-Änderung im bestehenden Astro-Projekt.

| Abhängigkeit | Gebraucht für | Verfügbar | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (Projekt-Runtime) | Erhebungs-/Codemod-/Prüfskripte | ✓ | vorhandene Projekt-Version | — |
| `npm run build` (Astro) | Prüfung gegen `dist/` (Pitfall 4) | ✓ | vorhandene Projekt-Version | — |
| ripgrep/Grep-Werkzeug | Stichproben während der Planung | ✓ (in dieser Umgebung verfügbar) | — | Node-`readFileSync`+Regex funktioniert gleichwertig, siehe Methodik |

**Fehlende Abhängigkeiten:** keine.

## Security Domain

`security_enforcement` ist projektweit aktiv, aber diese Phase ändert ausschließlich statische
CSS-Werte (Schriftgrad, Laufweite, Übergangsdauer/-kurve) und ein bestehendes, unverändert
bleibendes Laufzeit-Messskript. Es entsteht keine neue Eingabeverarbeitung, kein neuer
Authentifizierungs-/Sitzungs-Code und keine neue Datenpersistenz.

### Applicable ASVS Categories

| ASVS-Kategorie | Trifft zu | Standard-Kontrolle |
|---------------|---------|-----------------|
| V2 Authentication | nein | unverändert |
| V3 Session Management | nein | unverändert |
| V4 Access Control | nein | unverändert |
| V5 Input Validation | nein | keine neue Nutzereingabe; die einzige „Eingabe" ist der Autor selbst (CSS-Quelltext) |
| V6 Cryptography | nein | unverändert |

### Known Threat Patterns for CSS-Token-Refactoring

| Muster | STRIDE | Standard-Gegenmaßnahme |
|---------|--------|---------------------|
| Kein Sicherheitsrisiko identifiziert — reine Präsentationsschicht ohne Nutzereingabe oder Serverzugriff | — | — |

## Sources

### Primary (HIGH confidence) — alles `[VERIFIED: repo]`, direkt am Bestand gemessen
- `assets/theme.css` (komplett gelesen) — Drei-Schichten-Aufbau, `:root`/`:root[data-theme='light']`
- `src/layouts/Layout.astro` (Ladereihenfolge der `<link>`-Tags, `html{font-size:112.5%}`)
- `src/components/SiteNav.astro` (komplett gelesen, insb. `measureMorph()`/`paintMorph()`,
  Zeilen ~1791-1897)
- `src/pages/index.astro` (`.hero__mark`-Regeln, Zeilen 107-322)
- `scripts/build-light-palettes.mjs`, `scripts/tokenize-theme-colors.mjs`,
  `scripts/build-light-overrides.mjs` (Geltungsbereich `glob('src/**/*.astro')`, SKIP-Verhalten,
  farbwertbasierte statt namensbasierte Erkennung)
- `scripts/strip-cursorglow.mjs`, `scripts/verify-fx.mjs` (Massendurchlauf- und
  Prüfskript-Vorbilder)
- `.planning/phases/01-wortmarken-wandlung/01-SUMMARY.md` (Phase-1-Nachweise, Fortschrittsmarken)
- `assets/archive.css` (bestehende lokale `--ease`/`--ease-out`-Tokens, Scroll-Reveal-Muster)
- `dist/` (bereits vorhandener Build-Stand) — bestätigt, dass `.snav__brand` in
  `dist/_astro/item-finder.BE7g4rjD.css` liegt, nicht im HTML
- Eigene Node-Erhebungsskripte gegen `src/**/*.astro` + `assets/*.css` (95 Dateien, 1968
  `font-size`, 865 `letter-spacing`, 458 `transition`, 210 `animation`) — siehe Methodik unten

### Secondary (MEDIUM confidence)
- `.planning/phases/02-schrift-und-bewegungsskala/02-CONTEXT.md` — Nutzerentscheidungen D-01…D-05,
  als Vorgabe übernommen, aber die dort zitierten ABSOLUTEN Zahlen (414/139/34/11) sind vom Scout
  bewusst als unvollständig markiert und in dieser Recherche durch die vollständige Erhebung ersetzt

### Tertiary (LOW confidence)
- Keine — es gab keinen Bedarf an externer Web-Recherche für diese Phase (keine neue Bibliothek,
  keine externe API)

### Methodik der Ist-Erhebung (für Nachvollziehbarkeit)
Node-Skripte (kein externes Paket) haben `src/**/*.astro` (rekursiv, exkl. `node_modules`/`dist`)
und `assets/*.css` mit den Regex `/font-size\s*:\s*([^;}]+)[;}]/g`,
`/letter-spacing\s*:\s*([^;}]+)[;}]/g`, `/transition\s*:\s*([^;}]+)[;}]/g` und
`/animation(?:-duration)?\s*:\s*([^;}]+)[;}]/g` durchsucht. Werte wurden nach `px`/`rem`/`em`
(Basis 18px, siehe Pitfall 2) in effektive Pixel umgerechnet und auf 0,01px genau gruppiert, um
Schreibweise-Duplikate (`.7rem` vs. `0.7rem`) von echten Wertunterschieden zu trennen. Die
Transition-Werte wurden zusätzlich auf Top-Level-Kommata gesplittet (mit Klammer-Tiefenzählung, um
`cubic-bezier(a,b,c,d)` nicht fälschlich zu teilen) und pro Teil auf Dauer- (`\d+(s|ms)`) und
Kurven-Muster (`cubic-bezier(...)` oder Schlüsselwort) untersucht.

## Metadata

**Confidence breakdown:**
- Standard-Stack: HIGH — keine neue Bibliothek, alle Muster direkt aus dem Bestand übernommen
- Architektur (Token-Ort, Generator-Sicherheit): HIGH — Skript-Quellcode gelesen, Geltungsbereich
  (`glob`) und Skip-Logik im Detail nachvollzogen, nicht nur der Kommentar zitiert
- Ist-Erhebung (Zahlen): HIGH — vollständiger Durchlauf über alle `.astro`/`assets/*.css`-Dateien,
  nicht stichprobenartig
- Skalenvorschlag (konkrete Stufenwerte): MEDIUM — aus der Verteilung sinnvoll abgeleitet, aber per
  `CONTEXT.md` ausdrücklich „Claude's Discretion", also kein festes Ergebnis dieser Recherche
- Phase-1-Hazard (Kopplungsrisiko): HIGH für den Mechanismus (Code gelesen), MEDIUM für die
  Handlungsempfehlung (erneute Messung nötig — Ausgang nicht vorab bekannt)

**Research date:** 2026-08-08
**Valid until:** Bis zur nächsten strukturellen Änderung an `SiteNav.astro`/`Layout.astro` oder an
den drei Theme-Skripten — CSS-Werteverteilungen selbst verändern sich nur durch neue Seiten, daher
großzügige Gültigkeit (~60 Tage), aber die Dateizahl sollte vor der Umsetzung mit einem erneuten
`git log --since` grob gegengeprüft werden, falls zwischen Recherche und Umsetzung viel Zeit vergeht.
