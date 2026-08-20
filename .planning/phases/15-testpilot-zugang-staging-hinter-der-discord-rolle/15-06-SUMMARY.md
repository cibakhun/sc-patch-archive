---
phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 06
subsystem: discord
tags: [discord.js, discord-rest, mass-action, dry-run]

# Dependency graph
requires:
  - phase: 14-05
    provides: "Rolle 'Test Pilots' faellt aus dem Onboarding heraus (D-15), Blueprint + lebender Server im neuen Stand"
provides:
  - "Trockenlauf-Skript (discord/tester-dry-run.mjs), tatsaechlich gegen den lebenden Server gelaufen (18.08.2026): 5 Mitglieder gesamt, 0 Traeger der Rolle 'Test Pilots' -- unabhaengig vom Betreiber selbst nachgefahren, identisches Ergebnis"
  - "Entzugs-Skript (discord/tester-revoke.mjs), fertig gebaut und in seinen sicheren Vorschau-Modi (ohne Argument, --dry-run, --behalten) verifiziert"
  - "Beide Skripte funktionieren OHNE das privilegierte GuildMembers-Intent (REST-Route statt Gateway-Abo) -- Plan 14-06 haengt damit nicht an Plan 14-07"
  - "D-16-Vollzug bewusst auf 14-12 vertagt (Betreiberentscheidung 18.08.2026) und in WINDOWS.md #20 verdrahtet -- vor dem Scharfschalten erneut messen, dann entscheiden"
affects: ["14-07-guildmembers-intent (kein Blocker mehr fuer den Trockenlauf, nur noch fuer D-25 Push-Sync)", "14-12-ausrollen-und-abnahme (muss den erneuten Trockenlauf + die Entzugsentscheidung VOR dem Scharfschalten einreihen, siehe unten)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "guild.members.list({ limit, after }) -- REST-Route GET /guilds/{id}/members, seitenweise, OHNE GuildMembers-Intent (discord.js: Routes.guildMembers, verifiziert im Quelltext von node_modules/discord.js)"
    - "Geteilte Rollen-/Mitgliederaufloesung als exportierte Funktion (resolveRoleAndHolders) statt Duplikat -- tester-revoke.mjs importiert sie aus tester-dry-run.mjs"

key-files:
  created: [discord/tester-dry-run.mjs, discord/tester-revoke.mjs]
  modified: []

key-decisions:
  - "Aufgabe 1 vollstaendig ausgefuehrt: Skript gebaut, echter Lauf gegen den lebenden Server, Negativkontrolle mit unbekanntem Rollennamen -- alle drei Ausgaben unten verbatim"
  - "Aufgabe 3 vollstaendig ausgefuehrt: Entzugsskript gebaut, geteilte Aufloesung mit tester-dry-run.mjs, alle sicheren Vorschau-Modi tatsaechlich gelaufen. Die entziehende Aktion selbst (--rolle-wirklich-entziehen) wurde NICHT ausgefuehrt -- das ist beabsichtigt, siehe Aufgabe 2"
  - "Aufgabe 2 (Entscheidungs-Checkpoint) ist NICHT unbeantwortet, sondern bewusst VERTAGT -- vierte Antwort, die der Plan nicht vorsah (weder allen-entziehen noch liste-kuerzen noch nicht-entziehen). Betreiberentscheidung 18.08.2026: der Nullbefund von heute gilt nur fuer heute; vergibt der Betreiber die Rolle zwischenzeitlich, ist er veraltet. Kurz vor dem Scharfschalten des Tors (Plan 14-12) wird der Trockenlauf erneut gefahren und ERST DANN entschieden. Verdrahtet in WINDOWS.md #20 (kind unrun-verify, phase 14), nicht nur als Prosa-Notiz"
  - "Der Betreiber hat den Trockenlauf unabhaengig selbst nachgefahren und identisch bestaetigt (5 Mitglieder, 0 Traeger) -- die entscheidende Zeile dabei ist NICHT die Null, sondern die 5: sie belegt, dass die Mitgliederliste wirklich vollstaendig gelesen wurde und die Null aus einer echten Liste kommt, nicht aus einem verschluckten/leeren Abruf (exakt die Unterscheidung, vor der prune.mjs:149-165 warnt: 'Printing 0 members without it would be a lie'). Das Skript druckt diese Zahl von sich aus als eigene Zeile ('2 · Abgerufene Mitglieder gesamt') -- genau deshalb darf man der Null glauben"
  - "D-16 unterscheidet zwei Haelften, die beide festgehalten gehoeren: INHALTLICH ist der von D-16 gewuenschte Zustand heute bereits erreicht (niemand traegt die Rolle, und seit Plan 05 kann sie sich auch niemand mehr selbst nehmen -- Onboarding-Option entfernt, am lebenden Server bestaetigt). FORMAL ist D-16 noch nicht abgeschlossen, weil der bestaetigte Entzugslauf (--rolle-wirklich-entziehen) noch nie ausgefuehrt wurde -- das holt Plan 14-12 nach, unmittelbar vor dem Scharfschalten"

requirements-completed: []  # D-16 bewusst NICHT hier eingetragen -- der formale Vollzug (--rolle-wirklich-entziehen) fehlt noch und ist auf 14-12 vertagt (WINDOWS.md #20). Inhaltlich ist der Zustand von D-16 laut Trockenlauf bereits erreicht, siehe key-decisions.

coverage:
  - id: D1
    description: "Trockenlauf-Skript nennt Namen und Anzahl der Testpilot-Rollentraeger, ohne das privilegierte GuildMembers-Intent"
    requirement: "D-16"
    verification:
      - kind: manual_procedural
        ref: "node discord/tester-dry-run.mjs (echter Lauf gegen den lebenden Server, siehe Ausgabe unten, unabhaengig vom Betreiber selbst nachgefahren und identisch bestaetigt) + node discord/tester-dry-run.mjs --rolle 'Rolle-Die-Es-Nicht-Gibt' (Negativkontrolle, siehe Ausgabe unten)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Entzugs-Skript gebaut, alle sicheren Vorschau-Modi verifiziert; die entziehende Aktion selbst bewusst auf 14-12 vertagt (Betreiberentscheidung), nicht offen/unbeantwortet"
    requirement: "D-16"
    verification: []
    human_judgment: true
    rationale: "Der Entzug trifft echte Nutzerdaten auf einem lebenden Server und ist laut Plan als 'costly' eingestuft. Der Betreiber hat die im Plan vorgesehenen drei Optionen bewusst durch eine vierte ersetzt (vertagen + kurz vor dem Scharfschalten neu messen), weil ein heute erhobener Nullbefund durch eine zwischenzeitliche Rollenvergabe veralten kann. Automatisierung kann diese Zustimmung nicht vorwegnehmen -- der Vollzug ist WINDOWS.md #20 zugeordnet und liegt bei Plan 14-12."

# Metrics
duration: ~60min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 06: Testpilot-Rolle -- Trockenlauf gebaut und gelaufen, Entzug gebaut und bewusst vertagt Summary

**Trockenlauf gegen den lebenden Discord-Server (5 Mitglieder, 0 Traeger der Rolle "Test Pilots") vom Betreiber unabhaengig bestaetigt; das fertige Entzugsskript wartet bewusst bis kurz vor dem Scharfschalten des Tors, wo Plan 14-12 den Trockenlauf erneut fahren und dann entscheiden muss -- verdrahtet in WINDOWS.md #20.**

## Performance

- **Duration:** ~60min
- **Completed:** 2026-08-18
- **Tasks:** 3/3 abgeschlossen (Aufgabe 2 durch bewusste Vertagung statt einer der drei vorgesehenen Antworten aufgeloest)
- **Files modified:** 2 neu (`discord/tester-dry-run.mjs`, `discord/tester-revoke.mjs`)

## Accomplishments

- `discord/tester-dry-run.mjs` gebaut: liest die vollstaendige Mitgliederliste ueber die REST-Route `GET /guilds/{id}/members` (discord.js: `guild.members.list()`), seitenweise ueber `after`, mit Wettlauf gegen einen 10-Sekunden-Zeitgeber nach dem Muster von `prune.mjs:149-165`. Funktioniert nachweislich OHNE das privilegierte `GuildMembers`-Intent -- Plan 14-06 haengt damit nicht an Plan 14-07.
- Die Rolle wird ueber den Blueprint-Schluessel `tester` (Name "Test Pilots") aufgeloest, keine fest eingetragene Rollen-ID im Quelltext.
- **Echter Lauf gegen den lebenden Server** (verbatim, siehe unten): Server "Verse-Base", 5 Mitglieder gesamt, **0 Traeger der Rolle "Test Pilots"**. **Vom Betreiber unabhaengig nachgefahren, identisches Ergebnis.**
- **Warum man der Null glauben darf:** die entscheidende Zeile der Ausgabe ist nicht die Null der Traegerzahl, sondern die **5** bei "Abgerufene Mitglieder gesamt" -- sie belegt, dass wirklich die vollstaendige Mitgliederliste gelesen wurde (alle 5 Mitglieder des Servers), und die Null damit aus einer echten, vollstaendigen Liste kommt, nicht aus einem stillschweigend leeren oder verschluckten Abruf. Das ist exakt die Unterscheidung, vor der `prune.mjs:149-165` warnt ("Printing 0 members without it would be a lie") -- das Skript druckt diese Zahl von sich aus, unaufgefordert, als eigene Zeile, bevor es ueberhaupt zur Traegerzahl kommt.
- **Negativkontrolle** mit einem erfundenen Rollennamen durchgefuehrt und protokolliert: kein `process.exit(1)`, keine Zahl, stattdessen die ausdrueckliche Meldung "Keine Rolle ... gefunden".
- `discord/tester-revoke.mjs` gebaut: teilt sich die Rollen-/Mitgliederaufloesung mit `tester-dry-run.mjs` ueber die exportierte Funktion `resolveRoleAndHolders()`, statt sie ein zweites Mal zu tippen. Zwei Stufen nach der Hausregel fuer zerstoerische Handlungen (Betreiberentscheidung 15.08.2026, Phase 10): ohne Argument bzw. mit `--dry-run` nur Vorschau (nichts veraendert sich), erst mit dem ausgeschriebenen `--rolle-wirklich-entziehen` handelt es. Wiederholbares `--behalten <id-oder-name>` fuer den `liste-kuerzen`-Fall.
- Alle **sicheren Vorschau-Aufrufe** von `tester-revoke.mjs` tatsaechlich ausgefuehrt (siehe Ausgabe unten) -- die entziehende Aktion selbst (`--rolle-wirklich-entziehen`) wurde bewusst NICHT ausgefuehrt; siehe "D-16: bewusst vertagt" unten.
- `npm run build && npm run gate`: 18/18 Schienen-A-Schritte gruen, 0 FEHLER.
- Kein Eintrag in `scripts/lib/gate-registry.mjs` fuer beide neuen Skripte -- diese Registry bewacht `scripts/`, nicht `discord/` (wie `prune.mjs`/`audit.mjs`).

## Trockenlauf -- echte Ausgabe gegen den lebenden Server

```
$ node tester-dry-run.mjs

VerseBase · Testpilot-Trockenlauf  —  Verse-Base  (D-16)

── 1 · Server und Rolle ────────────────────────────────────────
  Server: Verse-Base (1528576072638271518)
  Rolle: "Test Pilots" (1536008562340532234)

── 2 · Abgerufene Mitglieder gesamt ────────────────────────────
  5

── 3 · Traeger der Rolle "Test Pilots" ─────────────────────────
  0 Traeger
  (niemand)

── Nichts wurde veraendert ─────────────────────────────────────
  Dies ist ein Bericht -- kein Mitglied wurde angefasst.
```

Exit-Code: 0. Vom Betreiber unabhaengig nachgefahren (eigener Lauf, 18.08.2026) -- identisches Ergebnis: Server "Verse-Base" (1528576072638271518), Rolle "Test Pilots" (1536008562340532234), 5 Mitglieder gesamt, 0 Traeger.

## Negativkontrolle -- unbekannter Rollenname

```
$ node tester-dry-run.mjs --rolle "Rolle-Die-Es-Nicht-Gibt"

VerseBase · Testpilot-Trockenlauf  —  Verse-Base  (D-16)

── 1 · Server und Rolle ────────────────────────────────────────
  Server: Verse-Base (1528576072638271518)
  ✗ Keine Rolle namens "Rolle-Die-Es-Nicht-Gibt" auf diesem Server gefunden.
  Keine Zahl -- eine unbekannte Rolle liefert keinen Befund.

── Nichts wurde veraendert ─────────────────────────────────────
  Dies ist ein Bericht -- es wurde nichts angefasst.
```

Exit-Code: 0 (bewusst -- ein Bericht ist kein Pruefer, siehe Aufgabe-1-Vorgabe).

## Entzugsskript -- Vorschau-Modi, tatsaechlich gelaufen (nichts veraendert)

```
$ node tester-revoke.mjs

VerseBase · Testpilot-Entzug  —  Verse-Base  ·  mode: VORSCHAU (nichts wird veraendert)

── Traeger der Rolle "Test Pilots" (0) ─────────────────────────
  (niemand -- nichts zu entziehen)

── Nichts wurde veraendert ─────────────────────────────────────
  0 Traeger wuerden entzogen (von 0 insgesamt, 0 verschont).
  Zum wirklichen Entziehen:  node tester-revoke.mjs --rolle-wirklich-entziehen
```

```
$ node tester-revoke.mjs --behalten "krisz22"

VerseBase · Testpilot-Entzug  —  Verse-Base  ·  mode: VORSCHAU (nichts wird veraendert)

── Traeger der Rolle "Test Pilots" (0) ─────────────────────────
  (niemand -- nichts zu entziehen)

── Ausdruecklich verschont ─────────────────────────────────────
  krisz22

── Nichts wurde veraendert ─────────────────────────────────────
  0 Traeger wuerden entzogen (von 0 insgesamt, 0 verschont).
  Zum wirklichen Entziehen:  node tester-revoke.mjs --rolle-wirklich-entziehen --behalten "krisz22"
```

Beide Aufrufe exit 0, beide unveraendert gegen den lebenden Server (nur Lesezugriff, keine `roles.remove`-Aufrufe ausgefuehrt).

## D-16: bewusst vertagt, nicht offen (Aufgabe 2)

Der Plan sah fuer den Entscheidungs-Checkpoint aus Aufgabe 2 drei Antworten vor: `allen-entziehen`, `liste-kuerzen`, `nicht-entziehen`. Der Betreiber hat eine **vierte** gewaehlt, die der Plan nicht vorgesehen hatte:

> **Vertagen und kurz vor dem Scharfschalten neu messen.**

**Begruendung:** die Null von heute (18.08.2026) gilt fuer heute. Vergibt der Betreiber die Rolle zwischenzeitlich an jemanden -- etwa weil ein erster Testpilot gebraucht wird, bevor das Tor scharf geht -- ist die Zahl veraltet. Ausgerechnet vor dem Scharfschalten des Tors soll niemand mit einer veralteten Zahl arbeiten.

**Damit ist Aufgabe 2 abgeschlossen, nicht offen.** Die Entscheidung selbst ist getroffen (vertagen); nur ihr Vollzug (der erneute Trockenlauf plus die dann faellige Entzugsentscheidung) liegt bewusst spaeter, unmittelbar vor dem Scharfschalten.

**Zwei Haelften von D-16, beide festgehalten:**

- **Inhaltlich ist der von D-16 gewuenschte Zustand heute bereits erreicht.** Niemand traegt die Rolle "Test Pilots" (0 von 5 Mitgliedern), und seit Plan 14-05 kann sich auch niemand mehr selbst die Rolle geben -- die Onboarding-Option ist entfernt, am lebenden Server bestaetigt (`15-05-SUMMARY.md`). Ein Bestandsentzug haette heute buchstaeblich niemanden getroffen.
- **Formal ist D-16 noch nicht abgeschlossen.** Der von D-16 verlangte bestaetigte Entzugslauf (`--rolle-wirklich-entziehen`) wurde nie ausgefuehrt -- weder heute (weil er ein No-Op waere und der Betreiber lieber kurz vor dem Scharfschalten neu misst) noch je zuvor. Dieser Vollzug ist jetzt Plan 14-12 zugeordnet.

**Verdrahtet, nicht nur notiert:** Eintrag `#20` in `.planning/WINDOWS.md` (Art `unrun-verify`, Phase `14`), der genau das festhaelt: vor dem Scharfschalten `node discord/tester-dry-run.mjs` erneut fahren, ERST DANN ueber den Entzug entscheiden. Siehe "Next Phase Readiness" unten fuer die Stelle in Plan 14-12, an der dieser Schritt einzureihen ist.

## Task Commits

1. **Aufgabe 1: Trockenlauf -- wer traegt die Rolle, und wie viele sind es (D-16)** - `245a542` (feat) -- `discord/tester-dry-run.mjs` gebaut, echter Lauf + Negativkontrolle durchgefuehrt und oben dokumentiert
2. **Aufgabe 2: Entscheidungs-Checkpoint** -- kein Code-Commit (reine Entscheidung); die Vertagung ist in `.planning/WINDOWS.md` (Eintrag #20) und in diesem Dokument festgehalten, siehe Commit unten
3. **Aufgabe 3: Entzugsskript gebaut** - `601eaf8` (feat) -- `discord/tester-revoke.mjs` gebaut, alle sicheren Vorschau-Aufrufe tatsaechlich gelaufen (siehe oben); `--rolle-wirklich-entziehen` bewusst nicht aufgerufen (Vertagung, siehe oben)

**Plan metadata:** siehe unten (dieser Commit, inkl. `.planning/WINDOWS.md` Eintrag #20)

## Files Created/Modified

- `discord/tester-dry-run.mjs` - Bericht ueber die Traeger der Rolle "Test Pilots"; exportiert `resolveRoleAndHolders()` fuer die gemeinsame Nutzung
- `discord/tester-revoke.mjs` - Entzug bei allen (oder allen ausser ausdruecklich verschonten) Traegern, zwei Stufen (Vorschau/`--rolle-wirklich-entziehen`), importiert die Aufloesung aus `tester-dry-run.mjs`
- `.planning/WINDOWS.md` - Eintrag #20 (Art `unrun-verify`, Phase 14): die Vertagung von D-16 verdrahtet, nicht nur notiert

## Decisions Made

- Rollenaufloesung ausschliesslich ueber den Blueprint-Schluessel `tester`, keine fest eingetragene ID -- schuetzt vor Drift, falls die Rolle je umbenannt wird (D-14 sagt zwar "nie umbenennen", aber der Code haengt trotzdem nicht am Namen als String-Literal in zwei Dateien)
- Mitgliederliste ueber die REST-Route `guild.members.list()` statt `guild.members.fetch()` (Gateway-Cache) -- funktioniert ohne das privilegierte Intent, entkoppelt diesen Plan von Plan 14-07 (siehe 15-RESEARCH.md Open Question 5)
- Geteilte Hilfsfunktion `resolveRoleAndHolders()` statt zweier unabhaengiger Implementierungen -- verhindert, dass Trockenlauf und Entzug je auseinanderlaufen
- **Betreiberentscheidung 18.08.2026 (Aufgabe 2): vertagen statt einer der drei geplanten Antworten** -- ein heute erhobener Nullbefund kann durch eine zwischenzeitliche Rollenvergabe veralten; vor dem Scharfschalten wird deshalb neu gemessen. Diese Entscheidung ist selbst final (Aufgabe 2 ist abgeschlossen), nur ihr Vollzug ist vertagt

## Deviations from Plan

### Auto-fixed Issues

None - keine technischen Abweichungen. Beide Skripte folgen der Plan-Vorgabe.

**Prozess-Abweichung, keine Auto-Fix-Regel:** Der Betreiber hat die Frage aus Aufgabe 2 mit einer vierten, im Plan nicht vorgesehenen Antwort beantwortet (vertagen statt allen-entziehen/liste-kuerzen/nicht-entziehen). Das ist eine explizite Betreiberentscheidung, keine automatische Abweichung nach den Deviation-Regeln -- dokumentiert oben unter "D-16: bewusst vertagt".

---

**Total deviations:** 0 technische Abweichungen; 1 dokumentierte Betreiberentscheidung ausserhalb der drei geplanten Optionen (siehe oben)
**Impact on plan:** Kein Scope Creep. Die Vertagung ist eine gueltige, verdrahtete Aufloesung des Checkpoints, kein offener Rest.

## Issues Encountered

Keine technischen Probleme. Der Nullbefund (0 aktuelle Traeger) ist kein Fehler, sondern das erwartete Ergebnis, wenn die Vermutung aus `15-05-SUMMARY.md` zutrifft -- und wurde vom Betreiber unabhaengig bestaetigt.

## User Setup Required

None fuer diesen Plan. Der naechste Schritt liegt bei Plan 14-12 (siehe unten), nicht bei einer sofortigen Handlung des Betreibers.

## Next Phase Readiness

- **Plan 14-06 ist vollstaendig abgeschlossen** (3/3 Aufgaben, Aufgabe 2 durch bewusste Vertagung statt einer der drei vorgesehenen Antworten).
- **D-16 bleibt als Requirement bewusst NICHT abgehakt** (`requirements-completed: []`), weil der formale Vollzug fehlt -- siehe "D-16: bewusst vertagt" oben fuer die inhaltliche/formale Unterscheidung.
- **WINDOWS.md #20** (Art `unrun-verify`, Phase 14) verdrahtet die Vertagung: vor dem Scharfschalten `node discord/tester-dry-run.mjs` erneut fahren, dann entscheiden.
- **⚠ AUSDRUECKLICHER HINWEIS FUER DEN EXECUTOR VON PLAN 14-12 (Ausrollen und Abnahme): dieser Schritt gehoert VOR das Scharfschalten, nicht danach.** Plan 14-12 rollt in Aufgabe 2 auf `staging` aus und stellt damit das Tor scharf. **Bevor** dieser Push passiert, muss:
  1. `node discord/tester-dry-run.mjs` erneut gefahren werden (frischer Bestand, nicht der Stand vom 18.08.2026 aus diesem Plan),
  2. das Ergebnis dem Betreiber vorgelegt werden (Namen + Anzahl),
  3. bei Traegern eine Entscheidung getroffen werden, ob entzogen wird (`node discord/tester-revoke.mjs --rolle-wirklich-entziehen`) -- **wahrscheinlich wieder ein Checkpoint**, aus denselben Gruenden wie hier (Berechtigungsklassifikator, echte Nutzerdaten).

  **Fundstelle in `15-12-PLAN.md`:** Aufgabe 3 traegt bereits einen `<human-check>`-Absatz, der davon ausgeht, der Entzug aus Plan 06 sei bereits erfolgt ("Die Rolle trägt nach dem Entzug aus Plan 06 niemand mehr. Wem soll sie gegeben werden?") -- diese Annahme stimmt nach der Vertagung nicht mehr und sollte korrigiert werden. Der am besten passende Ort fuer den obigen Drei-Schritt-Ablauf waere vor oder als Teil von **Aufgabe 2** ("Auf staging ausrollen und an der ausgelieferten Seite belegen"), weil genau dort der Push nach `staging` passiert, der das Tor scharf schaltet. Diese Aenderung wurde dem Koordinator gemeldet, NICHT selbst an `15-12-PLAN.md` vorgenommen (fremder Plan).
- Plan 14-07 (GuildMembers-Intent) ist NICHT mehr Voraussetzung fuer diesen Plan -- der Trockenlauf funktioniert bereits ohne das Intent. Plan 14-07 bleibt fuer D-25 (Push-Sync bei `guildMemberUpdate`) noetig.

---
*Phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: discord/tester-dry-run.mjs
- FOUND: discord/tester-revoke.mjs
- FOUND: .planning/phases/15-testpilot-zugang-staging-hinter-der-discord-rolle/15-06-SUMMARY.md
- FOUND: commit 245a542 (Aufgabe 1)
- FOUND: commit 601eaf8 (Aufgabe 3)
- FOUND: .planning/WINDOWS.md Eintrag #20 (kind unrun-verify, phase 14)
