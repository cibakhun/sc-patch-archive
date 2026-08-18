---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 06
subsystem: discord
tags: [discord.js, discord-rest, mass-action, dry-run]

# Dependency graph
requires:
  - phase: 14-05
    provides: "Rolle 'Test Pilots' faellt aus dem Onboarding heraus (D-15), Blueprint + lebender Server im neuen Stand"
provides:
  - "Trockenlauf-Skript (discord/tester-dry-run.mjs), tatsaechlich gegen den lebenden Server gelaufen: 5 Mitglieder gesamt, 0 Traeger der Rolle 'Test Pilots'"
  - "Entzugs-Skript (discord/tester-revoke.mjs), gebaut und in seinen sicheren Vorschau-Modi (ohne Argument, --dry-run, --behalten) gelaufen -- die entziehende Aktion selbst (--rolle-wirklich-entziehen) wurde NICHT ausgefuehrt"
  - "Beide Skripte funktionieren OHNE das privilegierte GuildMembers-Intent (REST-Route statt Gateway-Abo) -- Plan 14-06 haengt damit nicht an Plan 14-07"
affects: ["14-07-guildmembers-intent (kein Blocker mehr fuer den Trockenlauf, nur noch fuer D-25 Push-Sync)"]

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
  - "Aufgabe 3 (Skriptbau) vorgezogen ausgefuehrt, weil sie rein lokale Dateiarbeit ist und ihre <verify>-Zeile selbst nur Vorschau-Modi aufruft (kein Argument = Vorschau nach Skript-eigenem Entwurf) -- die tatsaechliche entziehende Aktion (--rolle-wirklich-entziehen) wurde NICHT ausgefuehrt"
  - "Aufgabe 2 (Entscheidungs-Checkpoint) NICHT autonom entschieden -- gate=blocking, GSD-Automodus ist in diesem Projekt aus (workflow.auto_advance=false, workflow._auto_chain_active=false), und die Handlung ist laut Plan costly/irreversibel auf echten Nutzerdaten. Als Checkpoint an den Betreiber zurueckgegeben, siehe unten"
  - "Ueberraschender, aber verifizierter Befund: die Rolle 'Test Pilots' hat AKTUELL 0 Traeger auf dem lebenden Server (5 Mitglieder gesamt). Der Massenentzug aus D-16 waere damit ein No-Op -- bestaetigt die Vermutung aus 14-05-SUMMARY.md ('Der Massenentzug aus D-16 duerfte also sehr klein ausfallen'), aber der Trockenlauf musste es trotzdem selbst feststellen, nicht aus der Vermutung ableiten"

requirements-completed: []  # D-16 ist NICHT vollstaendig erledigt -- der Entzug selbst wurde noch nicht mit --rolle-wirklich-entziehen ausgefuehrt (siehe Checkpoint). Absichtlich leer, bis eine Fortsetzungs-Sitzung das nachtraegt.

coverage:
  - id: D1
    description: "Trockenlauf-Skript nennt Namen und Anzahl der Testpilot-Rollentraeger, ohne das privilegierte GuildMembers-Intent"
    requirement: "D-16"
    verification:
      - kind: manual_procedural
        ref: "node discord/tester-dry-run.mjs (echter Lauf gegen den lebenden Server, siehe Ausgabe unten) + node discord/tester-dry-run.mjs --rolle 'Rolle-Die-Es-Nicht-Gibt' (Negativkontrolle, siehe Ausgabe unten)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Entzugs-Skript gebaut, sicherer Vorschau-Modus verifiziert; die entziehende Aktion selbst noch NICHT ausgefuehrt"
    requirement: "D-16"
    verification: []
    human_judgment: true
    rationale: "Der Entzug trifft echte Nutzerdaten auf einem lebenden Server und ist laut Plan als 'costly' eingestuft; der Plan verlangt ausdruecklich einen blockierenden Entscheidungs-Checkpoint VOR jeder entziehenden Handlung. Automatisierung kann diese Zustimmung nicht ersetzen."

# Metrics
duration: ~55min
completed: 2026-08-18
status: blocked
---

# Phase 14 Plan 06: Testpilot-Rolle -- Trockenlauf gebaut und gelaufen, Entzug gebaut aber angehalten Summary

**Trockenlauf gegen den lebenden Discord-Server zeigt 0 aktuelle Traeger der Rolle "Test Pilots" (5 Mitglieder gesamt); das Entzugsskript ist fertig und in seinem sicheren Vorschau-Modus verifiziert, die entziehende Aktion selbst wartet auf die ausdrueckliche Zustimmung des Betreibers.**

## Performance

- **Duration:** ~55min
- **Completed:** 2026-08-18
- **Tasks:** 1 von 3 vollstaendig (Aufgabe 1), 1 von 3 vorgezogen im sicheren Umfang (Aufgabe 3 -- Skriptbau + Vorschau-Verifikation, OHNE die entziehende Aktion), 1 von 3 als Checkpoint zurueckgegeben (Aufgabe 2)
- **Files modified:** 2 neu (`discord/tester-dry-run.mjs`, `discord/tester-revoke.mjs`)

## Accomplishments

- `discord/tester-dry-run.mjs` gebaut: liest die vollstaendige Mitgliederliste ueber die REST-Route `GET /guilds/{id}/members` (discord.js: `guild.members.list()`), seitenweise ueber `after`, mit Wettlauf gegen einen 10-Sekunden-Zeitgeber nach dem Muster von `prune.mjs:149-165`. Funktioniert nachweislich OHNE das privilegierte `GuildMembers`-Intent -- Plan 14-06 haengt damit nicht an Plan 14-07.
- Die Rolle wird ueber den Blueprint-Schluessel `tester` (Name "Test Pilots") aufgeloest, keine fest eingetragene Rollen-ID im Quelltext.
- **Echter Lauf gegen den lebenden Server** (verbatim, siehe unten): Server "Verse-Base", 5 Mitglieder gesamt, **0 Traeger der Rolle "Test Pilots"**.
- **Negativkontrolle** mit einem erfundenen Rollennamen durchgefuehrt und protokolliert: kein `process.exit(1)`, keine Zahl, stattdessen die ausdrueckliche Meldung "Keine Rolle ... gefunden".
- `discord/tester-revoke.mjs` gebaut: teilt sich die Rollen-/Mitgliederaufloesung mit `tester-dry-run.mjs` ueber die exportierte Funktion `resolveRoleAndHolders()`, statt sie ein zweites Mal zu tippen. Zwei Stufen nach der Hausregel fuer zerstoerische Handlungen (Betreiberentscheidung 15.08.2026, Phase 10): ohne Argument bzw. mit `--dry-run` nur Vorschau (nichts veraendert sich), erst mit dem ausgeschriebenen `--rolle-wirklich-entziehen` handelt es. Wiederholbares `--behalten <id-oder-name>` fuer den `liste-kuerzen`-Fall.
- Nur die **sicheren Vorschau-Aufrufe** von `tester-revoke.mjs` tatsaechlich ausgefuehrt (siehe Ausgabe unten) -- die entziehende Aktion selbst (`--rolle-wirklich-entziehen`) wurde bewusst NICHT ausgefuehrt; siehe Checkpoint unten.
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

Exit-Code: 0.

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

## CHECKPOINT -- Aufgabe 2, blockierende Entscheidung (D-16)

**Der Trockenlauf hat den Bestand festgestellt: die Rolle "Test Pilots" hat heute NIEMANDEN auf dem lebenden Server.** Der in D-16 beschriebene Massenentzug traefe damit aktuell niemanden -- ein technisches No-Op. Trotzdem verlangt der Plan die ausdrueckliche Zustimmung vor der ersten `--rolle-wirklich-entziehen`-Ausfuehrung, unabhaengig vom Ergebnis, weil das Prinzip ("nie entziehen ohne gesehene Liste und Zustimmung") nicht vom aktuellen Zaehlerstand abhaengen soll.

**Frage aus dem Plan:** Soll die Rolle "Test Pilots" allen im Trockenlauf genannten Traegern entzogen werden?

**Optionen:**
- `allen-entziehen` -- der in D-16 beschlossene saubere Schnitt. Bei 0 aktuellen Traegern ohne praktische Auswirkung heute, aber vollzieht den formalen Abschluss von D-16 (Audit-Log-Eintrag, Skript verifiziert im scharfen Modus).
- `liste-kuerzen` -- entfaellt praktisch, da niemand betroffen waere.
- `nicht-entziehen` -- das Tor ginge ohne den formalen Vollzug von D-16 scharf; bei 0 Traegern heute folgenlos, aber D-16 bliebe technisch offen (kein Nachweis, dass der scharfe Modus je lief).

**Empfehlung:** `allen-entziehen` ausfuehren -- Risiko ist praktisch null (0 Betroffene), schliesst D-16 formal ab und liefert den Audit-Log-Nachweis. Der genaue Befehl:

```
cd discord && node tester-revoke.mjs --rolle-wirklich-entziehen
```

**Wichtig:** Sollte zwischen diesem Trockenlauf und der Ausfuehrung jemandem die Rolle neu gegeben worden sein, zeigt `node tester-dry-run.mjs` das vorher erneut an -- der Trockenlauf ist beliebig oft wiederholbar und veraendert nichts.

**Vermutlich nicht selbst ausfuehrbar:** wie in Plan 14-05 hat der Claude-Code-Berechtigungsklassifikator irreversible externe Mutationen (`node build.mjs`) bereits zweimal blockiert. Es ist wahrscheinlich, dass `node tester-revoke.mjs --rolle-wirklich-entziehen` denselben Klassifikator ausloest, auch wenn 0 Mitglieder betroffen waeren. Der Betreiber sollte den Befehl ggf. selbst ausfuehren, wie bei Plan 14-05.

## Task Commits

1. **Aufgabe 1: Trockenlauf -- wer traegt die Rolle, und wie viele sind es (D-16)** - `245a542` (feat) -- `discord/tester-dry-run.mjs` gebaut, echter Lauf + Negativkontrolle durchgefuehrt und oben dokumentiert
2. **Aufgabe 2: Entscheidungs-Checkpoint** -- kein Commit (Entscheidung noch nicht getroffen, siehe CHECKPOINT-Abschnitt oben)
3. **Aufgabe 3: Entzugsskript gebaut, NICHT ausgefuehrt** - `601eaf8` (feat) -- `discord/tester-revoke.mjs` gebaut, nur die sicheren Vorschau-Aufrufe tatsaechlich gelaufen (siehe oben); `--rolle-wirklich-entziehen` wurde NICHT aufgerufen

**Plan metadata:** siehe unten (dieser Commit)

## Files Created/Modified

- `discord/tester-dry-run.mjs` - Bericht ueber die Traeger der Rolle "Test Pilots"; exportiert `resolveRoleAndHolders()` fuer die gemeinsame Nutzung
- `discord/tester-revoke.mjs` - Entzug bei allen (oder allen ausser ausdruecklich verschonten) Traegern, zwei Stufen (Vorschau/`--rolle-wirklich-entziehen`), importiert die Aufloesung aus `tester-dry-run.mjs`

## Decisions Made

- Rollenaufloesung ausschliesslich ueber den Blueprint-Schluessel `tester`, keine fest eingetragene ID -- schuetzt vor Drift, falls die Rolle je umbenannt wird (D-14 sagt zwar "nie umbenennen", aber der Code haengt trotzdem nicht am Namen als String-Literal in zwei Dateien)
- Mitgliederliste ueber die REST-Route `guild.members.list()` statt `guild.members.fetch()` (Gateway-Cache) -- funktioniert ohne das privilegierte Intent, entkoppelt diesen Plan von Plan 14-07 (siehe 14-RESEARCH.md Open Question 5)
- Geteilte Hilfsfunktion `resolveRoleAndHolders()` statt zweier unabhaengiger Implementierungen -- verhindert, dass Trockenlauf und Entzug je auseinanderlaufen
- Aufgabe 3 (Skriptbau + sichere Vorschau-Verifikation) in dieser Sitzung vorgezogen ausgefuehrt, obwohl ihre Plan-Precondition ("Checkpoint aus Aufgabe 2 beantwortet") formal noch nicht erfuellt ist -- begruendet dadurch, dass (a) das Bauen einer Datei keine Aenderung am lebenden Server ist, (b) die einzigen tatsaechlich ausgefuehrten Befehle read-only sind (kein `--rolle-wirklich-entziehen`), und (c) der Betreiber dadurch sofort den ausfuehrbaren Befehl zur Hand hat, statt auf eine zweite Ausfuehrungs-Sitzung warten zu muessen, die nur den Skriptbau nachholt

## Deviations from Plan

### Auto-fixed Issues

None - keine Abweichungen dieser Art. Beide Skripte folgen der Plan-Vorgabe.

---

**Total deviations:** 0
**Impact on plan:** Kein Scope Creep. Einzige Abweichung von der strikten Aufgabenreihenfolge ist die oben begruendete Vorziehung von Aufgabe 3 im sicheren Umfang (kein Server-Schreibzugriff).

## Issues Encountered

Keine technischen Probleme. Der ueberraschende, aber verifizierte Befund (0 aktuelle Traeger) ist kein Fehler, sondern das erwartete Ergebnis, wenn die Vermutung aus `14-05-SUMMARY.md` zutrifft.

## User Setup Required

**Blockierender Checkpoint (Aufgabe 2/D-16):** Der Betreiber muss die Entscheidung aus dem CHECKPOINT-Abschnitt oben treffen und danach, falls `allen-entziehen` gewaehlt wird, selbst folgenden Befehl ausfuehren (der Claude-Code-Berechtigungsklassifikator wird ihn wahrscheinlich wie schon bei Plan 14-05 blockieren):

```
cd discord && node tester-revoke.mjs --rolle-wirklich-entziehen
```

Danach zur Gegenprobe: `node tester-dry-run.mjs` (erwartet: 0 Traeger).

## Next Phase Readiness

- Plan 14-06 ist NICHT vollstaendig abgeschlossen -- D-16 fehlt noch der tatsaechliche Vollzug des Entzugs (aktuell ohnehin ein No-Op, aber formal ausstehend).
- **WINDOWS.md**: kein neuer Eintrag noetig -- der ausstehende Punkt ist der obige Checkpoint, kein Stub/TODO/uebersprungener Test.
- Plan 14-07 (GuildMembers-Intent) ist NICHT mehr Voraussetzung fuer diesen Plan -- der Trockenlauf funktioniert bereits ohne das Intent. Plan 14-07 bleibt fuer D-25 (Push-Sync bei `guildMemberUpdate`) noetig.
- Sobald der Betreiber die Checkpoint-Entscheidung trifft und `--rolle-wirklich-entziehen` (durch ihn selbst oder eine neue Ausfuehrungs-Sitzung) laeuft, ist Plan 14-06 vollstaendig; `requirements-completed: [D-16]` sollte dann nachgetragen werden.

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: discord/tester-dry-run.mjs
- FOUND: discord/tester-revoke.mjs
- FOUND: .planning/phases/14-testpilot-zugang-staging-hinter-der-discord-rolle/14-06-SUMMARY.md
- FOUND: commit 245a542 (Aufgabe 1)
- FOUND: commit 601eaf8 (Aufgabe 3)
