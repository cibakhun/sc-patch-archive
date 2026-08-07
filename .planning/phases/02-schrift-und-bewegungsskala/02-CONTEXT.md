# Phase 2: Schrift- und Bewegungsskala - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning
**Source:** discuss-phase-Lauf vom 08.08.2026, fünf Entscheidungen vom Betreiber.

<domain>
## Phase Boundary

Eine benannte Skala für Schriftgrade und eine gemeinsame Bewegungssprache für
Bedienübergänge — **site-weit**, nicht nur auf Kopfleiste und Startseite.

**Ausdrücklich NICHT in dieser Phase:** Ambiente-Animationen (Ken Burns, Parallaxe,
Sternendrift, Regen/Blitz) bleiben unverändert — Dauern, Kurven und Stimmung. Farben,
Abstände und Layout sind nicht Gegenstand; es geht um Schriftgrade und Übergänge.

</domain>

<measured_state>
## Gemessener Ist-Zustand (08.08.2026)

Über `src/components/SiteNav.astro`, beide `index.astro` und alle `assets/*.css`:

| | |
|---|---|
| `font-size`-Angaben | **414**, davon **139 verschiedene Werte** |
| Einheiten | gemischt — `11px`, `14px`, `0.7rem`, `.82rem`, sogar `14.5px` |
| Übergangsdauern | **139** Angaben, **34 verschiedene** |
| Beschleunigungskurven | **11 verschiedene** |

Häufigste Schriftgrade: `11px` (22×), `14px` (19×), `0.7rem` (15×), `12px` (14×), `13px` (12×), `10px` (12×).
Häufigste Dauern: `0.2s` (19×), dann Ambiente-Werte `2s` (15×), `15s` (13×), `16s` (8×), `25s` (6×);
kurze Bedienwerte `0.15s` (6×), `0.18s` (6×), `0.25s` (6×).
Kurven: `linear` (130×, überwiegend Ambiente), `ease-out` (21×), `ease-in-out` (9×), dazu die drei
fast identischen `cubic-bezier(0.16, 1, 0.3, 1)` (6×), `cubic-bezier(.2,.7,.3,1)` (4×),
`cubic-bezier(0.2, 0.7, 0.25, 1)` (4×).

⚠ Die Zahlen stammen aus 12 Dateien. Der Planer muss den echten Umfang site-weit erheben —
inline-`<style>` in `.astro` ist hier nicht mitgezählt und macht den Löwenanteil aus.

</measured_state>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` § „Phase 2" — Ziel und die drei Erfolgskriterien
- `.planning/REQUIREMENTS.md` — TYPO-01, TYPO-02, TYPO-03; dazu **THEME-02** (kein generierter
  Hellmodus-Block von Hand verändert) und **SYNC-01** (jede Änderung trifft EN und DE im selben Schritt)
- `.planning/phases/01-wortmarken-wandlung/01-SUMMARY.md` — die scroll-verknüpfte Wandlung
- `assets/theme.css` — die bestehende Token-Schicht (heute nur Farben)

</canonical_refs>

<code_context>
## Existing Code Insights

### Wiederverwendbar
- **`assets/theme.css` als Token-Ort** — es gibt bereits eine Token-Schicht, sie trägt heute nur
  Farben (`--text` ist eine Farbe, keine Schriftgröße). Die Skala kann sich dort anlagern.
- **`scripts/strip-cursorglow.mjs`** — Vorbild für einen überprüfbaren Massendurchlauf mit
  Soll-Zahlen; `scripts/verify-fx.mjs` und `scripts/verify-help.mjs` sind Vorbilder für ein
  bleibendes Prüfskript gegen den GEBAUTEN Stand.

### Fallen (dokumentiert, nicht neu zu entdecken)
- ⚠ **`assets/theme.css` ist GENERIERT** (`npm run theme`). Handänderungen an
  `:root[data-theme="light"]` werden still verworfen. Neue Token gehören an eine Stelle, die der
  Generator nicht überschreibt — oder der Generator muss mitziehen.
- ⚠ **Die Theme-Generatoren sehen NUR inline-`<style>` in `.astro`**, nicht externe CSS-Dateien.
  Wer Token einführt, muss wissen, welche Seite woher liest.
- ⚠ **`:global()` in `<style is:inline>` verpufft** — der Browser wirft die ganze Regel still weg.
  Dort normales CSS schreiben.
- ⚠ **Hero-Überschrift und Kopfleisten-Wortmarke sind aufeinander eingestimmt** (Phase 1,
  scroll-verknüpfte Wandlung, MARK-03/MARK-06). Ihre Schriftgrade zu verschieben kann die
  Wandlung sichtbar brechen. Der Planer muss sie gesondert behandeln und die Wandlung nach der
  Umstellung nachweisen — nicht nur behaupten.
- ⚠ **DE/EN-Seitenpaare werden von Hand doppelt gepflegt.** `verify-fx.mjs` und `verify-help.mjs`
  vergleichen bereits 8.677 Paare; eine einseitige Umstellung würde dort auffallen — das ist ein
  Sicherheitsnetz, kein Freibrief.
- ⚠ Beim Umrechnen px→rem: `14.5px` und ähnliche krumme Werte zeigen, dass nicht alles auf einem
  Raster liegt. D-05 erlaubt das Einrasten — aber der Planer soll die Ausreißer benennen, nicht
  stillschweigend runden.

</code_context>

<specifics>
## Specific Ideas

- Die Skala soll aus der **gemessenen Verteilung** entstehen, nicht aus einem Lehrbuch-Verhältnis:
  die tatsächlich häufigen Werte (10, 11, 12, 13, 14 px) liegen dicht beieinander, ein
  aggressives modulares Verhältnis würde sie auf zu wenige Stufen zwingen.
- Erfolgskriterium 3 („kein Bruch im Bewegungsverhalten beim Scrollen über die Startseite") ist
  eine **Sichtprüfung**, kein Skript. Sie gehört als menschlicher Prüfpunkt in den Plan.

</specifics>

<deferred>
## Deferred Ideas

- Ambiente-Animationen in die Skala holen — bewusst abgewählt (D-03).
- Abstände/Spacing als eigene Skala — nicht besprochen, wäre eine eigene Phase.
- Der Hellmodus-Generator so erweitern, dass er auch externe CSS-Dateien sieht — berührt
  THEME-02 und ist ein eigenes Vorhaben.

</deferred>

---

*Phase: 2-schrift-und-bewegungsskala*
*Context gathered: 2026-08-08*
