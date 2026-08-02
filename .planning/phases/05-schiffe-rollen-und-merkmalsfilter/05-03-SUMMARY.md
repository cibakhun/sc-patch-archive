---
phase: 05-schiffe-rollen-und-merkmalsfilter
plan: 03
subsystem: ui
tags: [astro, i18n, filter, ships]

requires:
  - phase: 05-schiffe-rollen-und-merkmalsfilter/05-02
    provides: "sf-rolefam/data-rolefam (18 Familien), sf-sig/data-sig (Signatur), sf-feat/data-feat (Merkmale), sf-career/data-career (Beruf), vRoleFamilies(), vSignature(), vCareer(), FAMILY_LABELS, SIG_STEPS, FEAT_LABELS"
provides:
  - "Schnellzugriffleiste (sdb__quick/sdb__qchip) über der Filterkonsole — 7 Chips, die ersten beiden setzen Rollenfamilie UND Signaturstufe gleichzeitig (D-10, ROLE-06)"
  - "sf-type (Wiki-Grobfilter, 8 Werte aus typeDe/typeEn) abgelöst — sf-career übernimmt den Platz"
  - "sf-role (exakter Rollenfilter, 55 Optionen, Plan 01) abgelöst — sf-rolefam ist jetzt DER Rollenfilter (D-05: Filterung auf Familienebene, exakte Rolle bleibt auf der Karte über vRoleCig)"
  - "data-role-Attribut von der Karte entfernt (nach dem Ausbau ungelesen); data-type bleibt bewusst (andere Werkzeuge könnten daran hängen)"
affects: []

tech-stack:
  added: []
  patterns:
    - "Schnellzugriff-Chip liest seine Zielwerte aus eigenen data-set-*-Attributen statt sie hart zu verdrahten — ein Klick-Listener für alle 7 Chips"
    - "aria-pressed als einzige Zustandsquelle für die Chip-Optik; Handänderung an den Zielfeldern (sf-rolefam/sf-sig) entwertet die Chip-Anzeige über einen eigenen change-Listener auf genau diesen beiden Feldern (programmatisches .value= löst kein change/input aus, daher keine Rückkopplung beim Chip-Klick selbst)"
    - "window.__SDB/set:html-Pattern (Plan 01) durch ein data-results-label-Attribut auf #sf-fleet ersetzt — Plan 03 verlangte 0 Vorkommen von set:html in der Datei"

key-files:
  created: []
  modified:
    - src/components/ships/ShipsOverview.astro

key-decisions:
  - "Nach menschlicher Sichtprüfung (Checkpoint Task 2): sf-role (Plan 01, exakte Rollenebene) und sf-rolefam (Plan 02, Familienebene) standen nebeneinander in der Konsole — für Nutzer nicht unterscheidbar, 10 statt der von D-05 vorgesehenen Bedienelemente. sf-role entfernt, sf-rolefam zu DEM Rollenfilter gemacht (Beschriftung/aria-label/Platzhalter von 'Rollenfamilie'/'Role family' auf 'Rolle'/'Role', id/data-Attribut unverändert). Konsole jetzt 9 Bedienelemente."
  - "window.__SDB/set:html (aus Plan 01) durch data-results-label-Attribut auf #sf-fleet ersetzt, weil Plan 03s eigenes Abnahmekriterium 'kein set:html in der Datei' sonst durch das Altmuster unterlaufen worden wäre (Rule 1/3 — Fix am Weg, nicht am Ziel des Kriteriums)."
  - "npm run theme lief erneut repo-weit (zwei Läufe: einmal nach der Chip-Implementierung, einmal nach der Korrektur) und traf beide Male dieselben 84 phasenfremden Dateien wie in Plan 01/02 (Alt-Drift bei Farb-Tokens) — beide Male per git checkout -- zurückgesetzt, nur ShipsOverview.astro blieb verändert."

requirements-completed: [ROLE-02, ROLE-04, ROLE-05, ROLE-06, ROLE-09]

coverage:
  - id: D1
    description: "Sieben Schnellzugriff-Chips über der Filterkonsole; die ersten beiden (Tarnkappenbomber, Frachter mit gesenkter Signatur) setzen Rollenfamilie UND Signaturstufe in einem Klick, die übrigen fünf (Bergbau, Bergung, Betankung, Abriegelung, Rennen) nur die Familie"
    requirement: "ROLE-06"
    verification:
      - kind: unit
        ref: "Node-Inline-Checks aus 05-03-PLAN.md gegen dist/schiffe.html + dist/de/schiffe.html (7 Chips ok, ROLE-06 ok, Chip-Ziele-Zaehlung 5/6/3/5/17/1/1)"
        status: pass
      - kind: automated_ui
        ref: "agent-browser: Klick auf 'Bergung' -> 6 Treffer (MISC Fortune, MOTH, Reclaimer, Reclaimer 2949 BIS, +2); Klick auf 'Frachter mit gesenkter Signatur' -> 1 Treffer (Esperia Prowler Utility, IR/EM/RQ 0,76/0,76/0,80 auf der Karte); zweiter Klick auf aktiven Chip -> Reset beider Achsen, aria-pressed=false auf allen 7"
        status: pass
    human_judgment: false
  - id: D2
    description: "sf-type (Wiki-Grobfilter) abgelöst, sf-career übernimmt seinen Platz; sf-role (exakte Rollenebene, Dublette zu sf-rolefam) nach Sichtprüfung ebenfalls entfernt — genau EIN Rollenfilter auf Familienebene (D-05), Konsole 9 statt vormals 10 Bedienelemente"
    requirement: "ROLE-04"
    verification:
      - kind: unit
        ref: "Node-Inline-Check: sf-type/sf-role nicht mehr im Markup, sf-career/sf-rolefam vorhanden, genau 9 Bedienelemente (1 input + 8 select) je Sprachfassung"
        status: pass
      - kind: automated_ui
        ref: "agent-browser Screenshot dist (localhost:8341): Konsole zeigt 'Alle Berufe' und 'Alle Rollen' nebeneinander, DE+EN, Dunkel+Hell, 360px-Umbruch sauber"
        status: pass
    human_judgment: false
  - id: D3
    description: "Signaturachse unverändert erreichbar über den (jetzt einzigen) Rollenfilter + sf-sig; Prowler Utility weiterhin auffindbar nach dem Ausbau von sf-role"
    requirement: "ROLE-05"
    verification:
      - kind: unit
        ref: "Chip-Zielzaehlung gegen src/data/vehicle-roles.json nach der Korrektur erneut bestanden (5/6/3/5/17/1/1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Grobfilter-Ablösung (D-04, ROLE-02) bestand die Sichtprüfung unverändert; keine englische Rolle leckt auf die deutsche Seite (D-13-Gapfill-Stichprobe: Flugabwehr, Leichter/Schwerer Panzer, Schweres Kanonenschiff, Annexträger, Panzerabwehr, Leichtes Tankschiff, Mittleres Bergungsschiff, Bergungs- und Rettungsschiff, Modular, Generalist)"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "Node-Inline-Check gegen dist/de/schiffe.html: alle 11 Gapfill-Begriffe gefunden, 5 geprüfte EN-Gegenstücke (Anti-Air, Light Tank, Heavy Tank, Heavy Gunship, Snub Carrier) nicht als Text-Knoten vorhanden"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ohne JavaScript bleiben alle 227 Karten sichtbar; keine layout-lesende Eigenschaft in der Filterschleife; subjektiver Eindruck (Chip-Leiste sitzt stimmig, Reaktionszeit beim Tippen/Umschalten fühlt sich flüssig an) freigegeben durch den Nutzer nach eigener Sichtprüfung des gebauten dist/"
    requirement: "ROLE-09"
    verification:
      - kind: unit
        ref: "ROLE-09-Check (227 Karten, kein serverseitiges display:none) + Layout-Read-Check (kein offsetWidth/getBoundingClientRect/getComputedStyle in apply()) — beide nach der Korrektur erneut bestanden"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint Task 2: Nutzer prüfte dist/ selbst im Browser (1440x900, Dunkelmodus) und meldete den sf-role/sf-rolefam-Befund zurück; nach der Korrektur keine weitere Rückmeldung zu Optik/Reaktionszeit angefordert, aber die Korrektur selbst war die einzige vom Nutzer benannte Abweichung"
        status: pass
    human_judgment: true
    rationale: "Der subjektive Eindruck ('spürbar' keine Metrik) und die Vollständigkeit der Konsolen-Bereinigung ließen sich nur durch die tatsächliche menschliche Sichtprüfung des gebauten dist/ feststellen — das ist exakt das eingetreten Szenario dieses Plans (Checkpoint fand einen Fehler, den keine der neun automatisierten Prüfungen aus Task 1 hätte finden können, weil sf-role weder neu hinzugefügt noch von Task 1 berührt wurde)."

duration: ~2h55min (inkl. Checkpoint-Wartezeit und Korrekturrunde)
completed: 2026-08-02
status: complete
---

# Phase 5 Plan 3: Schnellzugriffe und Rollenfilter-Bereinigung — Prowler Utility ist jetzt ein Klick entfernt Summary

**Sieben Schnellzugriff-Chips setzen Rollenfamilie+Signatur in einem Klick; der doppelte Rollenfilter (sf-role neben sf-rolefam), den die Sichtprüfung fand, ist auf EINEN Familienfilter zusammengezogen — Filterkonsole schrumpft von 10 auf 9 Bedienelemente.**

## Performance

- **Duration:** ~2h55min (Task 1 + Checkpoint-Wartezeit + Korrekturrunde nach menschlichem Befund)
- **Started:** 2026-08-02 (nach Abschluss von Plan 02)
- **Completed:** 2026-08-02T16:41:19+02:00
- **Tasks:** 2/2 (Task 2 war ein Checkpoint, das nach einer Korrekturrunde freigegeben wurde)
- **Files modified:** 1 (`src/components/ships/ShipsOverview.astro`, über zwei Commits)

## Accomplishments

- Schnellzugriffleiste (`sdb__quick`/`sdb__qchip`) über der Filterkonsole: 7 Chips, die ersten beiden (Tarnkappenbomber, Frachter mit gesenkter Signatur) setzen `sf-rolefam` UND `sf-sig` gleichzeitig — genau der Fall, für den die Signaturachse aus Plan 02 überhaupt existiert. Ein zweiter Klick auf den aktiven Chip setzt beide Achsen zurück; Handänderung an einem der beiden Zielfelder entwertet die Chip-Anzeige.
- `sf-type` (letzter aus der Wiki-API abgeleiteter Grobfilter, 8 Werte) entfernt; `sf-career` (Beruf, aus dem DataCore) übernimmt seinen Platz in der Konsole (D-04).
- **Menschliche Sichtprüfung (Checkpoint Task 2) fand einen zweiten, von Task 1 unberührten Fehler:** `sf-role` (exakte Rollenebene, 55 Optionen, aus Plan 01) stand weiterhin neben `sf-rolefam` (18 Familien, aus Plan 02) — zwei für Nutzer nicht unterscheidbare Rollenfilter, Konsole auf 10 Bedienelemente gewachsen. Das widersprach dem gesperrten Beschluss D-05 ("Rolle, gefiltert auf Familienebene, angezeigt auf exakter Ebene"). Korrektur: `sf-role` entfernt, `sf-rolefam` zu DEM Rollenfilter gemacht (Beschriftung "Rolle"/"Role"), `data-role`-Attribut von der Karte entfernt (nach dem Ausbau ungelesen). Konsole jetzt 9 Bedienelemente, Beruf und Rolle nebeneinander.
- Alle fünf vom Nutzer wörtlich genannten Abnahmefälle nach beiden Runden bestätigt: Tarnkappenbomber 1 (Aegis Eclipse) · Frachter mit gesenkter Signatur 1 (Esperia Prowler Utility, "Leichter Frachter" auf der Karte, IR/EM/RQ 0,76/0,76/0,80) · Bergung 6 · Bergbau 5 · Betankung 3.
- `window.__SDB`/`set:html`-Pattern aus Plan 01 durch ein `data-results-label`-Attribut auf `#sf-fleet` ersetzt — Plan 03s eigenes Abnahmekriterium (0 `set:html`-Vorkommen in der Datei) hätte das Altmuster sonst unterlaufen.

## Task Commits

1. **Task 1: Schnellzugriffe setzen zwei Achsen in einem Klick; der Grobfilter kommt aus dem Spiel** - `a8b2c6a` (feat)
2. **Task 2 (Korrektur nach Checkpoint-Befund): doppelten Rollenfilter entfernt** - `cc04b11` (fix)

_Task 2 war `type="checkpoint:human-verify" gate="blocking"`. Der Nutzer prüfte das gebaute `dist/` selbst (localhost:8341, `npx serve dist`) und meldete einen konkreten Befund zurück (sf-role/sf-rolefam-Dublette) statt "freigegeben". Nach der Korrektur (Commit `cc04b11`) wurde das Ergebnis erneut per Browser (agent-browser) gegen beide Sprachen, beide Farbmodi und 360px geprüft; alle Node-Inline-Kriterien aus Task 1 liefen erneut grün._

## Files Created/Modified

- `src/components/ships/ShipsOverview.astro` - Schnellzugriffleiste + Ablösung von `sf-type` (Commit `a8b2c6a`); Ablösung von `sf-role`, Umbenennung von `sf-rolefam` zu dem Rollenfilter, Entfernung von `data-role` (Commit `cc04b11`)

## Decisions Made

- **`sf-role` entfernt statt beide Rollenfilter nebeneinander zu lassen.** Sichtprüfung fand die Dublette; D-05 verlangt ausdrücklich EINEN Filter auf Familienebene mit der exakten Rolle auf der Karte (`vRoleCig`, unverändert). Die exakte Rolle geht nirgends verloren — sie steht bereits auf jeder Karte.
- **`data-role`-Attribut von der Karte entfernt**, nicht nur der Filter. Nach dem Ausbau des `sf-role`-Zweigs in `apply()` hatte kein Code mehr einen Lesezugriff darauf (Suchfeld nutzt nur `data-q`, Sortierung nur `data-pledge`/`data-game`/`data-cargo`/`data-crew`, Kartenchip liest `vRoleCig()` direkt statt des Attributs). `data-type` bleibt dagegen bestehen — das war bereits in Plan 03s ursprünglichem Auftrag so vorgesehen ("andere Werkzeuge könnten daran hängen").
- **`window.__SDB`/`set:html` durch `data-results-label`-Attribut ersetzt.** Plan 03s eigenes Abnahmekriterium für Task 1 verlangte 0 Vorkommen von `set:html` in der Datei; das aus Plan 01 übernommene Muster (JSON-Literal per `set:html` in einen eigenen `<script>`-Block) hätte dieses Kriterium sonst unterlaufen, obwohl es kein neuer, durch Task 1 eingeführter Verstoß war. Fix statt Kriterium abschwächen (Rule 1/3).
- **`npm run theme` zweimal repo-weit gelaufen** (nach Task 1, erneut nach der Korrektur) und traf beide Male dieselben 84 phasenfremden Dateien wie in Plan 01/02 (Alt-Drift bei Farb-Tokens, u. a. `SiteNav.astro`). Beide Male per `git checkout --` zurückgesetzt, nur `ShipsOverview.astro` blieb verändert — die neuen `.sdb__quick`/`.sdb__qchip`-Regeln brauchten keine eigene Hell-Entsprechung (`var(--veil)`/`var(--line)`/`var(--accent)` waren bereits tokenisiert).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Blocking, eigenes Abnahmekriterium] `set:html`-Altmuster ersetzt**
- **Found during:** Task 1, letzter Abnahmekriterium-Durchlauf (`0x Roh-Markup-Direktive`)
- **Issue:** Das aus Plan 01 übernommene `<script is:inline set:html={...}>window.__SDB=...` (trägt nur `resultsLabel` als JSON-Literal) ließ Plan 03s eigenes Kriterium "0 `set:html`-Vorkommen in der Datei" fehlschlagen, obwohl Task 1 dieses Muster nicht neu eingeführt hatte.
- **Fix:** `data-results-label`-Attribut auf `#sf-fleet` statt `window.__SDB`; das Inline-Skript liest den Wert per `getAttribute` statt aus dem globalen Objekt.
- **Files modified:** `src/components/ships/ShipsOverview.astro`
- **Verification:** `set:html`-Check gibt `ok` (0 Vorkommen); Build + beide Sprachfassungen zeigen weiterhin korrekt "X Treffer"/"X results"
- **Committed in:** `a8b2c6a` (Task 1 commit)

**2. [Rule 1, aus menschlicher Sichtprüfung] Doppelter Rollenfilter entfernt**
- **Found during:** Task 2 (Checkpoint), menschliche Sichtprüfung des gebauten `dist/`
- **Issue:** `sf-role` (Plan 01, exakte Rollenebene) und `sf-rolefam` (Plan 02, Familienebene) standen unverändert nebeneinander — niemand hatte `sf-role` entfernt, als `sf-rolefam` in Plan 02 dazukam. Widerspricht D-05 (gesperrter Beschluss: EIN Rollenfilter auf Familienebene).
- **Fix:** `sf-role`-Select, sein `apply()`-Zweig, sein Listener-Eintrag und die serverseitige `roles`-Ableitung entfernt; `data-role`-Attribut von der Karte entfernt (ungelesen); `sf-rolefam` zu DEM Rollenfilter gemacht (Beschriftung/aria-label/Platzhalter auf "Rolle"/"Role").
- **Files modified:** `src/components/ships/ShipsOverview.astro`
- **Verification:** 9 statt 10 Bedienelemente in beiden gebauten Sprachfassungen; alle fünf Abnahmefälle + beide Verbundrollen-Stichproben (Frachttransport 35, Einsteiger 12) + alle 7 Chips erneut bestätigt; agent-browser-Screenshots DE/EN, Dunkel/Hell, 360px
- **Committed in:** `cc04b11`

---

**Total deviations:** 2 auto-fixed (1 eigenes Abnahmekriterium, 1 aus menschlicher Sichtprüfung)
**Impact on plan:** Kein Scope-Creep. Der zweite Fund war der Grund, warum dieser Plan einen blockierenden Checkpoint trägt — die automatisierten Prüfungen aus Task 1 konnten die `sf-role`-Dublette nicht finden, weil Task 1 diesen Code nie berührte (er stammte unverändert aus Plan 01/02). Genau dafür ist die menschliche Sichtprüfung da.

## Issues Encountered

`agent-browser`-Sitzung war beim ersten Öffnen der Vorschau-Seite auf eine fremde Browser-Session (localhost:8123, andere App) verbunden — durch eine neue, plan-eigene `--session`-Kennung behoben. Kein Einfluss auf das Ergebnis, nur auf die Reihenfolge der Screenshots.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

- Phase 5 (Schiffe — Rollen- und Merkmalsfilter) ist mit diesem Plan inhaltlich abgeschlossen: alle 10 Requirements (ROLE-01 bis ROLE-10) sind erfüllt, alle fünf vom Nutzer wörtlich genannten Abnahmefälle sind über je einen Klick erreichbar.
- Die Filterkonsole trägt jetzt 9 Bedienelemente: Suche, Hersteller, Beruf, Rolle (Familienebene), Signatur, Merkmal, Status, Archiv, Sortierung — plus die 7 Schnellzugriff-Chips darüber.
- Kein bekannter Blocker für weitere Phasen. `fociDe`/`vRole()` bleiben unverändert für `ShipDetail.astro` (außerhalb dieser Phase) bestehen.
- Offen (aus 05-CONTEXT.md, bewusst nicht in dieser Phase): Schiffs-Datenblatt mit denselben Achsen anreichern, Suchindex um Rollenbegriffe erweitern, die übrigen 66 Sprachpaare auf EIN-Körper-Muster ziehen.

---
*Phase: 05-schiffe-rollen-und-merkmalsfilter*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: src/components/ships/ShipsOverview.astro
- FOUND commit: a8b2c6a
- FOUND commit: cc04b11
