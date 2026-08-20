---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 12
subsystem: infra
tags: [gate-registry, docs, windows-ledger, ci-cd, discord]

# Dependency graph
requires:
  - phase: 14-04
    provides: "Discord-Anmeldeweg (D-01/D-02/D-11) live im Code"
  - phase: 14-06
    provides: "Trockenlauf-/Entzugs-Skripte fuer D-16, sicherer Vorschaumodus geprueft"
  - phase: 14-08
    provides: "verify:gate (Schiene A) in der Registry"
  - phase: 14-09
    provides: "check:gate (Schiene C) in der Registry, Rauchtest-Bypass"
  - phase: 14-10
    provides: "Testpilot-Perks (Abzeichen, Zustimmungsschalter, Uebersicht, Namensnennung)"
  - phase: 14-11
    provides: "Deploy-Ping + XP-Bonus, beide code-fertig, noch nicht deployed"
provides:
  - "docs/maschinelle-validierung.md beschreibt jetzt verify:gate (Schiene A) und check:gate (Schiene C) an der Stelle, an der die Datei ihre Schienen aufzaehlt"
  - "Volle Torkette zweifach BESTAETIGT gruen: normaler Bau (Live-Build, 19/19, 535,1s) und Vorschau-Bau (STAGING=1, 19/19, 355,1s), dazu test:e2e (312/312) und verify:wiring einzeln"
  - "15 scattered WINDOWS.md-Eintraege der Phase (ids 14-28) zu 9 ortsbezogenen Eintraegen konsolidiert (ids 15, 20 unveraendert + 7 neue ids 29-35) -- eine Runde, die der Betreiber in einer Sitzung abarbeiten kann"
  - "Aufgabe 2 (scharfschalten + ausrollen) ausdruecklich NICHT ausgefuehrt -- Precondition unmet, dokumentiert als Checkpoint unten"
affects: ["jede kuenftige Sitzung, die diese Phase abschliessen will", "der Betreiber-Checkpoint fuer den staging-Deploy"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ledger-Konsolidierung ueber die pure parseLedger/renderLedger-API aus broken-windows.cjs statt Handbearbeitung der Markdown-Tabelle: garantiert eine reparsebare Datei (Rueckles-Pruefung vor dem Schreiben), neue IDs beginnen beim historischen Maximum+1 statt bei der ersten freigewordenen Nummer, um bestehende woertliche id-Verweise in SUMMARY.md-Dateien nicht auf falschen Inhalt zeigen zu lassen"

key-files:
  created: []
  modified:
    - docs/maschinelle-validierung.md
    - .planning/WINDOWS.md

key-decisions:
  - "Aufgabe 2 (staging-Ausrollen) bewusst NICHT ausgefuehrt: die Precondition (fuenf Coolify-Umgebungsvariablen ueber zwei Anwendungen) ist laut Betreiber noch nicht bestaetigt. Kein Push nach staging in dieser Sitzung -- Rueckfallregel der Ausfuehrungsvorgabe (Precondition-Nichterfuellung wird NIE automatisch als erfuellt behandelt, auch nicht im Automatikmodus)."
  - "WINDOWS.md-Konsolidierung: 13 der 15 scattered Phase-14-Eintraege (ids 14, 16-19, 21-28) durch 7 neue, ortsbezogene Eintraege ersetzt (ids 29-35); ids 15 und 20 unveraendert gelassen (bereits atomar/einzeln abhakbar). Das ist eine Abweichung vom woertlichen Plantext, der ein automatisiertes <verify> mit GENAU 5 neuen Zeilen erwartet -- diese Zahl war zum Planzeitpunkt korrekt, wurde aber durch die eigenstaendige Ledger-Eintragspflicht der Plaene 03/04/07/08/09/10/11 ueberholt, bevor Plan 12 lief (15 statt 0 vorbestehende Zeilen). Die Konsolidierungsvorgabe der Ausfuehrungsanweisung (\"in EINE workable Runde, gruppiert nach Ort\") hat Vorrang vor der jetzt stale automatisierten Zeilenzahl-Pruefung. Ausfuehrlich unten unter Deviations."

requirements-completed: []

# Coverage metadata
coverage:
  - id: D1
    description: "Die volle Torkette laeuft gruen in beiden Bauarten (normal und STAGING=1), mit protokollierten Kopfzeilen"
    verification:
      - kind: other
        ref: "npm run build && npm run gate — 19/19 Schritte gruen, 535,1s, Kopfzeile 'Artefakt: Live-Build'"
        status: pass
      - kind: other
        ref: "STAGING=1 npm run build && npm run gate — 19/19 Schritte gruen, 355,1s, Kopfzeile 'Artefakt: Vorschau-Build (STAGING=1) — site-weit noindex, Sitemaps absichtlich leer'"
        status: pass
      - kind: other
        ref: "npm run test:e2e — 312/312 Tests, 44 Suiten, 0 fail; npm run verify:wiring — alle 6 Zusicherungen erfuellt"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/maschinelle-validierung.md beschreibt verify:gate und check:gate an der Stelle, wo die Datei ihre Schienen aufzaehlt (§5), inkl. Begruendung fuer Schiene C bei check:gate"
    verification:
      - kind: other
        ref: "node -e Check aus 14-12-PLAN.md Aufgabe 1 <automated>: beide Strecken-Namen im Dokument gefunden (Soll 2, Ist 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "staging-Deploy, Scharfschalten des Tors, Belege an der ausgelieferten Seite (Aufgabe 2)"
    verification: []
    human_judgment: true
    rationale: "Precondition (fuenf Coolify-Umgebungsvariablen ueber Vorschau- und Bot-Container) ist unbestaetigt. Kein Push, keine Ausfuehrung — der Betreiber muss die Variablen setzen (oder ihr Vorhandensein bestaetigen) und danach den D-16-Trockenlauf neu fahren lassen, bevor diese Aufgabe angegangen werden kann. Siehe Checkpoint-Abschnitt unten."
  - id: D4
    description: "Fuenf (tatsaechlich: sieben, siehe key-decisions) neue, benannte WINDOWS.md-Eintraege fuer die Sichtpunkte der Phase, gruppiert nach Ort statt nach liefernder Plannummer, Kopfzaehler fortgeschrieben"
    verification:
      - kind: other
        ref: "bw.parseLedger()-Rueckles-Pruefung vor dem Schreiben (Rundtrip-Test), danach node -e Zaehl-Check: total 22 / offen 14 / gelegt 8 / gewaiverd 0, alle 9 phase-14-Zeilen offen"
        status: pass
    human_judgment: true
    rationale: "Ob die neun konsolidierten Eintraege wirklich 'in einer Sitzung abarbeitbar' sind, ist ein Urteil des Betreibers, der sie tatsaechlich abarbeitet — nicht maschinell pruefbar."

# Metrics
duration: ~35min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 12: Torkette bestaetigt, Ausrollen blockiert, Sichturteile gebuendelt Summary

**Beide Bauarten der Torkette zweifach vorgefuehrt gruen (19/19 normal, 19/19 mit STAGING=1), das Konzept-Dokument um die zwei phase-14-eigenen Pruefstrecken nachgezogen, und die 15 verstreuten Sichtpunkte der Phase zu neun ortsbezogenen WINDOWS.md-Eintraegen zusammengefuehrt — das eigentliche Scharfschalten (Aufgabe 2, staging-Deploy) blieb ausdruecklich AUS, weil die noetigen Coolify-Umgebungsvariablen unbestaetigt sind.**

## Performance

- **Duration:** ~35 min aktive Ausfuehrung
- **Started:** 2026-08-18T15:03:48Z
- **Completed:** 2026-08-18T15:35:36Z
- **Tasks:** 3 im Plan (Aufgabe 1 ausgefuehrt, Aufgabe 2 blockiert/nicht ausgefuehrt, Aufgabe 3 ausgefuehrt mit dokumentierter Abweichung)
- **Files modified:** 2 (docs/maschinelle-validierung.md, .planning/WINDOWS.md)

## Accomplishments

- **Aufgabe 1 (vollstaendig):** `npm run build && npm run gate` — 19/19 Schritte gruen in 535,1s, Kopfzeile `Artefakt: Live-Build`. Derselbe Lauf mit `STAGING=1` — ebenfalls 19/19 gruen in 355,1s, Kopfzeile `Artefakt: Vorschau-Build (STAGING=1) — site-weit noindex, Sitemaps absichtlich leer`. `npm run test:e2e` einzeln: 312/312 Tests, 44 Suiten, 0 Fehlschlaege. `npm run verify:wiring` einzeln: alle 6 Zusicherungen erfuellt (23 Pruefskripte im Bestand, Bijektion Datei<->Verzeichnis, Schienen-Verkabelung 18/2/3, keine Zombie-Umgebungsmarken). `git diff` ueber `scripts/` zeigt keine gesenkte Klinke (keine Aenderung an `scripts/` in diesem Plan). `docs/maschinelle-validierung.md` beschreibt jetzt `verify:gate` (Schiene A, Ausnahmeliste-Pruefung) und `check:gate` (Schiene C, mit expliziter Begruendung fuer die Schienen-Wahl: misst per `fetch()` gegen die tatsaechlich laufende Domain, kann strukturell nicht auf Schiene A).
- **Aufgabe 2 (bewusst nicht ausgefuehrt):** Precondition (`VB_GATE_SECRET`/`VB_SUPABASE_URL`/`VB_SUPABASE_ANON_KEY` im Vorschau-Container, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` im Bot-Container) ist laut Betreiber-Ansage unbestaetigt. Kein Push nach `staging`, kein Dateiwechsel fuer diese Aufgabe. Auch der als "nur Lesen" beschriebene erste Schritt (`node discord/tester-dry-run.mjs`) konnte in dieser Sitzung nicht gefahren werden — der Zugriff auf `discord/.env` (Bot-Token) ist in dieser Ausfuehrungsumgebung durch die Berechtigungssperre blockiert (`Permission ... denied` beim Leseversuch), unabhaengig von der Coolify-Frage. Siehe Checkpoint-Abschnitt unten fuer den vollstaendigen Stand.
- **Aufgabe 3 (ausgefuehrt, mit dokumentierter Abweichung vom woertlichen Plantext):** Die Plaene 03/04/07/08/09/10/11 hatten bereits eigenstaendig 15 WINDOWS.md-Eintraege fuer diese Phase angelegt (ids 14-28), bevor Plan 12 lief — der urspruengliche Plantext ging noch davon aus, dass Plan 12 als Erster fuenf neue Eintraege anlegt. Statt zusaetzlich fuenf weitere (jetzt 20 Zeilen insgesamt) anzuhaengen, wurden die 13 am meisten ueberlappenden Eintraege zu sieben neuen, nach ORT statt nach liefernder Plannummer sortierten Eintraegen zusammengefuehrt (ids 29-35): E-Mail-Anmeldung, Discord-Anmeldeweg+Torseite, Piloten-Profil-Abzeichen, Konto/Uebersicht/Namensnennung, Deploy-Ping+XP im Testpiloten-Kanal, Bot-Rollenabgleich nach dem naechsten Bot-Deploy, Zugriffskontrolle gegen den echten Container nach dem naechsten staging-Deploy. Zwei bereits atomare Eintraege (id 15: Navigators-Sichtbarkeit, id 20: D-16-Trockenlauf vor dem Entzug) blieben unveraendert. Ergebnis: 9 statt 20 offene Phase-14-Zeilen, jede einzeln abhakbar, jede mit "was gebaut/was maschinell belegt/was der Mensch entscheiden soll". Kopfzaehler bijektiv bestaetigt (total 22, offen 14, gelegt 8, gewaiverd 0) durch eine Rueckles-Pruefung (`bw.parseLedger()` gegen die selbst geschriebene Datei) vor dem eigentlichen Schreiben.

## Task Commits

1. **Aufgabe 1: Die volle Torkette in beiden Bauarten, plus das Konzept nachziehen** — `dcf3f2a` (docs)
2. **Aufgabe 2: Auf staging ausrollen und an der ausgelieferten Seite belegen** — NICHT ausgefuehrt, kein Commit (Precondition unmet)
3. **Aufgabe 3: Die Sichturteile an den Betreiber uebergeben** — `411c128` (docs)

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

## Files Created/Modified

- `docs/maschinelle-validierung.md` — Nachtrag in §5 (Zielarchitektur): `verify:gate` (Schiene A) und `check:gate` (Schiene C) beschrieben, mit Begruendung fuer die Schienen-Zuordnung von `check:gate`.
- `.planning/WINDOWS.md` — 13 scattered Phase-14-Eintraege (ids 14, 16-19, 21-28) durch 7 neue, ortsbezogene Eintraege ersetzt (ids 29-35); ids 15/20 unveraendert; Kopfzaehler fortgeschrieben (open 14, total 22).

## Decisions Made

- **Aufgabe 2 bewusst nicht ausgefuehrt** — siehe `key-decisions` oben und Checkpoint-Abschnitt unten. Kein Push nach `staging`, keine Ausfuehrung des D-16-Trockenlaufs, keine Entzugsentscheidung.
- **WINDOWS.md-Konsolidierung statt fuenf weiterer Anhaenge** — siehe `key-decisions` oben, ausfuehrliche Begruendung unter Deviations.

## Deviations from Plan

### Auto-fixed / dokumentierte Abweichungen

**1. [Rule 4 — im Kern eine Anpassung an eine ueberholte Planannahme, nicht an neue Architektur] WINDOWS.md-Konsolidierung statt fuenf zusaetzlicher Anhaenge**

- **Found during:** Aufgabe 3, vor dem ersten Schreibzugriff auf `.planning/WINDOWS.md`
- **Issue:** `14-12-PLAN.md` Aufgabe 3 geht davon aus, dass Plan 12 als Erster fuenf neue Phase-14-Eintraege anlegt, und das automatisierte `<verify>` zaehlt woertlich `zeilen.length!==5` gegen alle Zeilen mit `| 14 |` im Ledger. Tatsaechlich hatten die Plaene 03, 04, 07, 08, 09, 10 und 11 bereits **15** eigene Eintraege angelegt (ids 14-28), jeweils mit dem etablierten `unrun-verify`-Muster, bevor Plan 12 lief. Ein woertlicher Vollzug (fuenf weitere Zeilen anhaengen) haette 20 ueberlappende, teils redundante Zeilen ergeben — exakt das Problem, das die Ausfuehrungsanweisung ("Consolidate them into ONE coherent round the operator can actually work through in one sitting — grouped by where he has to be... not by which plan produced them") beheben sollte.
- **Fix:** 13 der 15 vorbestehenden Eintraege wurden inhaltlich VOLLSTAENDIG in sieben neue, nach Ort gruppierte Eintraege uebernommen (nichts geht verloren — jeder "was gebaut/was maschinell belegt/was der Mensch entscheiden soll"-Absatz der alten Eintraege steht im neuen Eintrag). Zwei bereits atomare Eintraege (id 15, id 20) blieben unveraendert. Die Transformation lief ueber die pure `parseLedger`/`renderLedger`-API aus `broken-windows.cjs` (nicht per Hand an der Markdown-Tabelle), inklusive einer Rueckles-Pruefung vor dem Schreiben. Neue IDs beginnen bei 29 (ein Schritt hinter dem historischen Maximum 28) statt bei der ersten freigewordenen Nummer, damit bestehende woertliche Verweise wie "WINDOWS.md id 27" (in `14-11-SUMMARY.md`) nicht spaeter auf unrelated neuen Inhalt zeigen.
- **Files modified:** `.planning/WINDOWS.md`
- **Verification:** `bw.parseLedger()` gegen die frisch geschriebene Datei bestanden (bijektive Kopfzaehler); `node "$HOME/.claude/gsd-core/bin/gsd-tools.cjs" windows status` bestaetigt open=14/total=22 uebereinstimmend. Das WOERTLICHE `<verify>` aus Aufgabe 3 wurde zusaetzlich gegen die konsolidierte Datei gefahren und schlaegt erwartungsgemaess fehl (Ist 9 statt Soll 5) — dokumentiert hier statt stillschweigend uebergangen.
- **Committed in:** `411c128`

---

**Total deviations:** 1 dokumentiert (Rule 4, Anpassung an eine durch vorangegangene Plaene ueberholte Planannahme)
**Impact on plan:** Die tatsaechliche Absicht der Aufgabe (fuenf — hier: neun — benannte, einzeln abhakbare Sichtrunden mit vollstaendiger Beschreibung, Kopfzaehler bijektiv) ist erfuellt. Die woertliche Zeilenzahl (9 statt 5) ist es nicht, weil das im Plan angenommene "Nullstand"-Szenario durch die Eintragspraxis der Plaene 03-11 ueberholt war, bevor Plan 12 lief. Kein Scope-Creep — die zusaetzlichen vier Eintraege (Discord-Server-Entscheidung id 15, D-16-Trockenlauf id 20 unveraendert, Bot-Deploy-Nachweise id 34, staging-Deploy-Nachweise id 35) bilden echte, eigenstaendige Konzepte ab, die beim woertlichen Vollzug entweder verlorengegangen oder in einen falschen Eintrag gequetscht worden waeren.

## Issues Encountered

- **Aufgabe 2 blockiert von Anfang an.** Die im Plan genannte Precondition (fuenf Coolify-Umgebungsvariablen ueber Vorschau- und Bot-Container) ist laut der Ausfuehrungsvorgabe fuer diese Sitzung ausdruecklich unbestaetigt — "the operator has the list and has not confirmed". Selbst der als reines Lesen beschriebene erste Schritt (`node discord/tester-dry-run.mjs`, D-16-Neumessung) war in dieser Sitzung technisch nicht moeglich: der Leseversuch auf `discord/.env` (Bot-Token) wurde von der Berechtigungssperre dieser Ausfuehrungsumgebung abgewiesen. Beides zusammen macht Aufgabe 2 vollstaendig unausfuehrbar in dieser Sitzung — kein Teilfortschritt, keine Datei geaendert, kein Commit fuer diese Aufgabe.
- **Automatisiertes `<verify>` aus Aufgabe 3 jetzt strukturell veraltet** — siehe Deviation 1 oben. Dieselbe Klasse Befund wie bereits in `14-03-SUMMARY.md` dokumentiert ("das automatisierte `<verify>` ... ist jetzt strukturell veraltet"): ein Plan-Verifikationsschritt, der auf einer Annahme beruht, die sich waehrend der Phasenausfuehrung durch andere Plaene ueberholt hat. Ersatzverifikation ist die Rueckles-Pruefung des Ledgers selbst (bijektive Kopfzaehler) plus die inhaltliche Vollstaendigkeitspruefung (jede alte Beschreibung ist wortgetreu in einem neuen Eintrag wiederzufinden).

## User Setup Required

**Fuer Aufgabe 2 (blockierend, siehe Checkpoint unten):**

| Was | Wo |
|---|---|
| `VB_GATE_SECRET`, `VB_SUPABASE_URL`, `VB_SUPABASE_ANON_KEY` | Coolify, Vorschau-Container (staging.verse-base.com) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Coolify, Bot-Container |

**Fuer die vollen Perks aus Plan 11 (nicht blockierend fuer Aufgabe 2, aber ohne sie bleiben D-20/D-21 wirkungslos):**

| Was | Wo |
|---|---|
| `DISCORD_TESTPILOT_WEBHOOK` (Repo-Secret) | GitHub -> Settings -> Secrets and variables -> Actions (Anleitung in `14-11-SUMMARY.md`) |
| Bot-Neurollout | Coolify (traegt sonst weiterhin den alten Code ohne `bug-thread-xp.mjs`/`role-sync.mjs`-Nachweise) |

## Next Phase Readiness

- **Phase 14 ist technisch fertig (12 von 12 Plaenen abgeschlossen), NICHT als „Complete" markiert** — dieselbe Konvention wie bereits bei den Phasen 1.2, 2, 3, 9, 10 und 12 (Mining) verwendet. Grund: neun offene WINDOWS.md-Eintraege (ids 15, 20, 29-35) UND das eigentliche Scharfschalten (Aufgabe 2 dieses Plans) stehen aus.
- **Blocker fuer den Abschluss der Phase:** Aufgabe 2 (staging-Ausrollen) — siehe Checkpoint-Abschnitt unten fuer den vollstaendigen, aktuellen Stand und was genau fehlt.
- **Offener Punkt ausserhalb des Ledgers** (aus dem Plantext uebernommen, an den Betreiber weitergereicht): Die Rolle "Test Pilots" traegt derzeit niemand (Trockenlauf 18.08.2026: 0 Traeger bei 5 gelesenen Mitgliedern). Der Entzug wurde deshalb vertagt statt ausgefuehrt (WINDOWS.md id 20). Wem sie gegeben werden soll, ist bewusst Handarbeit des Betreibers (D-16/D-17) — ohne diesen Schritt steht eine gesperrte Vorschau da, die ausser dem Betreiber selbst niemand betreten kann, sobald Aufgabe 2 einmal laeuft.

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `docs/maschinelle-validierung.md` (Nachtrag §5 bestaetigt per grep: `verify:gate`, `check:gate` beide vorhanden)
- FOUND: `.planning/WINDOWS.md` (9 phase-14-Zeilen bestaetigt: `grep -nE "^\| [0-9]+ \| 14 \|"`, ids 15/20/29/30/31/32/33/34/35)
- FOUND: commit `dcf3f2a` (Aufgabe 1) im Verlauf des Zweigs `claude/staging-tester-role-access-308ebf`
- FOUND: commit `411c128` (Aufgabe 3) im selben Zweig
- `npm run build && npm run gate`: 19/19 gruen (Live-Build, 535,1s)
- `STAGING=1 npm run build && npm run gate`: 19/19 gruen (Vorschau-Build, 355,1s)
- `npm run test:e2e`: 312/312, `npm run verify:wiring`: alle Zusicherungen erfuellt
- `.planning/WINDOWS.md` roundtrip-geparst (`bw.parseLedger`): total 22, offen 14, gelegt 8, gewaiverd 0 — bijektiv mit Kopfzaehler
- Aufgabe 2 als NICHT ausgefuehrt dokumentiert, kein Commit dafuer behauptet
