---
phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 05
subsystem: discord
tags: [discord.js, discord-blueprint, onboarding, permissions]

# Dependency graph
requires: []
provides:
  - "Discord-Rolle `tester` (\"Test Pilots\") fällt aus dem nativen Onboarding heraus (D-15) — nicht mehr selbst wählbar"
  - "Privater Kanal #test-pilots in BUILD & FEEDBACK, sichtbar nur für `tester` und `flight-computer` (D-18)"
  - "Rollendefinition `tester` zeichengenau unverändert (D-14)"
  - "Live-Server trägt den neuen Stand (build.mjs vom Betreiber ausgeführt, node audit.mjs vorher/nachher belegt)"
affects: [14-06-massenentzug-bestandstraeger, 14-07-guildmembers-intent, "D-20 deploy-ping"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Channel-Overwrite-Muster von STAFF_VIEW übernommen (everyone deny ViewChannel, benannte Rollen allow) statt Neuerfindung"

key-files:
  created: []
  modified: [discord/blueprint.mjs]

key-decisions:
  - "D-14 wörtlich umgesetzt: nur der Kommentar über der Rollendefinition wurde korrigiert, die Objekt-Zeile selbst blieb Zeichen für Zeichen unverändert (git diff zeigt das)"
  - "D-15 vollständig umgesetzt inkl. Nebenfunde: neben der genannten Onboarding-Zeile (402) auch zwei weitere Stellen korrigiert, die die Rolle noch als selbst wählbar beschrieben (start-here-Seed \"Your roles\", Onboarding-Kopfkommentar)"
  - "D-18 mit flight-computer-Mitsicht: der Bot braucht die gleiche Sicht wie tester, sonst postet der künftige Deploy-Ping (D-20) ins Leere — im Plan bereits so vorgegeben, hier bestätigt umgesetzt"
  - "Kein renames{}-Eintrag, keine neue Kategorie — beides ausdrücklich geprüft und unterlassen"
  - "Aufgabe 2 (Live-Anwendung) wurde NICHT vom Executor ausgeführt, sondern vom Betreiber selbst, nachdem der Claude-Code-Berechtigungsklassifikator node build.mjs zweimal blockiert hatte (siehe Deviations) — der Executor hat keinen Umweg gesucht"
  - "Navigators (Moderatoren) sehen #test-pilots nicht — wörtlich korrekte Umsetzung von D-18, aber vermutlich nicht die Absicht; als offene Betreiberentscheidung dokumentiert (WINDOWS.md #15), nicht eigenmächtig geändert"

patterns-established:
  - "Bei Onboarding-Textänderungen: alle Fundstellen suchen, die die Rolle als selbst wählbar beschreiben, nicht nur die im Plan genannte Zeile — grep nach dem Rollennamen deckt das zuverlässig ab"

requirements-completed: [D-14, D-15, D-18]

coverage:
  - id: D1
    description: "Blueprint geändert: Onboarding-Eintrag für `tester` entfernt (D-15), Rollendefinition `tester` unverändert (D-14), privater Kanal `test-pilots` mit korrekten Overwrites angelegt (D-18)"
    requirement: "D-14, D-15, D-18"
    verification:
      - kind: other
        ref: "node -e Assertions gegen discord/blueprint.mjs (4 Zusicherungen: Rollendefinition, Onboarding-roles-Array, Kanal-Schlüssel, drei Overwrite-Einträge) — Kommandozeile in 15-05-PLAN.md Task 1 <verify>, Regex einer Zusicherung korrigiert (siehe Deviations)"
        status: pass
      - kind: other
        ref: "npm run validate (discord/, offline Blueprint-Prüfung)"
        status: pass
      - kind: other
        ref: "npm run build && npm run gate (Projektwurzel, Schiene A, 18/18)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Blueprint auf den lebenden VerseBase-Discord-Server angewendet: #test-pilots existiert, Onboarding zeigt nur noch 2 Optionen, Rollenbestand unverändert, Einladungscode unverändert"
    requirement: "D-14, D-15, D-18"
    verification:
      - kind: manual_procedural
        ref: "node audit.mjs vorher (%TEMP%\\vb-audit-vorher.txt) gegen nachher (%TEMP%\\vb-audit-nachher.txt) — vom Betreiber ausgeführt und von der Koordinator-Sitzung gegengelesen, nicht vom Ausführungs-Agenten selbst"
        status: pass
    human_judgment: true
    rationale: "Live-Mutation eines externen Dienstes (Discord-API) außerhalb dieses Repos. Der Claude-Code-Berechtigungsklassifikator hat node build.mjs im Ausführungs-Agenten zweimal hart blockiert; der Betreiber hat den Lauf deshalb selbst gefahren. Die Verifikation stammt aus einem Vorher/Nachher-Diff von node audit.mjs, das der Betreiber bzw. die Koordinator-Sitzung ausgeführt hat, nicht aus einem automatisierten Test in diesem Repo."

# Metrics
duration: ~2h35min (zwei Checkpoints: Berechtigungssperre + Betreiber-Baulauf)
completed: 2026-08-17
status: complete
---

# Phase 14 Plan 05: Testpilot-Rolle aus dem Onboarding, privater Kanal Summary

**Discord-Rolle „Test Pilots" fällt aus dem selbst wählbaren Onboarding heraus und bekommt einen eigenen, nur für sie sichtbaren Kanal — Blueprint geändert UND auf dem lebenden Server angewendet.**

## Performance

- **Duration:** ~2h35min (inkl. zweier Checkpoints — Berechtigungssperre des Bash-Klassifikators, dann Warten auf den vom Betreiber selbst gefahrenen `build.mjs`-Lauf)
- **Completed:** 2026-08-17T23:34:00Z
- **Tasks:** 2/2 (Task 2 vom Betreiber ausgeführt, nicht vom Executor — siehe Deviations)
- **Files modified:** 1 (`discord/blueprint.mjs`)

## Accomplishments

- D-15 vollzogen: die Onboarding-Option „Test pilot · Testpilot" (`roles: ['tester']`) ist aus dem Prompt „Where should we ping you?" entfernt — sowohl im Blueprint als auch, mit dem Betreiber-Baulauf, am lebenden Server (`node audit.mjs` zeigt danach 2 statt 3 Optionen).
- D-18 vollzogen: neuer privater Textkanal `#test-pilots` in `BUILD & FEEDBACK`, zwischen `#feedback` und `#tools`. Sichtbarkeit: `@everyone` verliert `ViewChannel`, `tester` und `flight-computer` bekommen sie — der Bot kann den künftigen Deploy-Ping (D-20) dort also absetzen.
- D-14 belegt: die Rollendefinition `{ key: 'tester', name: 'Test Pilots', ... }` blieb zeichengenau unverändert (`git diff` zeigt für diese Zeile keine Änderung); nur der erklärende Kommentar darüber wurde an den neuen Stand angepasst.
- Zwei zusätzliche Textstellen korrigiert, die die Rolle noch als selbst wählbar beschrieben (nicht nur die im Plan namentlich genannte Zeile 402/616/622): der `start-here`-Seed „Your roles" listete „test pilot" noch unter den Onboarding-Pings, und der Kopfkommentar über `export const onboarding` sprach von „pings, test invites, and language". Beide zweisprachig korrigiert.
- Live-Anwendung durch den Betreiber (`node build.mjs`, nachdem der Bash-Berechtigungsklassifikator dem Ausführungs-Agenten den Befehl zweimal verweigert hatte): `#test-pilots` angelegt, alle übrigen Rollen/Kanäle nur aktualisiert, Einladungscode `czWY7r34aN` unverändert (kein stiller Website-Link-Tod, siehe `discord/README.md` „Two things the swap leaves behind" — hier war es kein Swap, aber derselbe Mechanismus hätte bei Einladungsverlust zugeschlagen).
- Gegenprobe `node audit.mjs` vorher/nachher (Details unten) bestätigt: genau die zwei geplanten Befunde behoben, ein vorbestehender, plangemäß unberührter Befund (`#support`) unverändert, sonst kein Drift.
- Offener Befund dokumentiert statt eigenmächtig behoben: Navigators (Moderatoren) sehen `#test-pilots` nicht (siehe „Offene Betreiberentscheidung" unten, WINDOWS.md #15).

## Vorher/Nachher — `node audit.mjs`

| | Vorher (`%TEMP%\vb-audit-vorher.txt`) | Nachher (`%TEMP%\vb-audit-nachher.txt`) |
|---|---|---|
| Bilanz | 1 Fehler · 2 Warnungen · 12 Notizen | 0 Fehler · 1 Warnung · 12 Notizen |
| `✗ missing channel: test-pilots (in BUILD & FEEDBACK)` | Fehler | → `✓ test-pilots` |
| `! prompt "Where should we ping you? · Wobei sollen wir dich pingen?" — 3 options ≠ 2` | Warnung | → `✓ prompt ... (2 options)` |
| `! 1 channel(s) on the server aren't in the blueprint: support [GuildText]` | Warnung (vorbestehend, 17.08.2026 stillgelegter #support-Kanal, `build.mjs` löscht keine Kanäle) | unverändert Warnung — **richtig so**, nicht Teil dieses Plans |

Rollenbestand: 12 Blueprint-Rollen vorher UND nachher unverändert vorhanden, Hierarchie stimmt, keine handgemachten Streurollen. Niemandem wurde die Rolle `tester` genommen oder gegeben — das ist Plan 14-06.

Einladungscode: `czWY7r34aN` (permanent, an `#welcome`) — vorher und nachher identisch. `discord/README.md` dokumentiert, dass `build.mjs` bei Verlust einer Einladung eine NEUE mit anderem Code anlegt, während der Code fest in `src/consts.ts` steht; ein stiller Website-Link-Tod ist hier ausdrücklich NICHT eingetreten.

### Rechtezeile des neuen Kanals (Abschnitt 5 der Bestandsaufnahme)

| Kanal | new member | Prospect (lvl 5) | Citizen (lvl 15) | Navigator (mod) | bot |
|---|---|---|---|---|---|
| `test-pilots` | — | — | — | **—** | post/media |
| `staff-chat` (Vergleich) | — | — | — | post/media | post/media |

`tester` und `flight-computer` sind in dieser Tabelle nicht als eigene Spalte geführt (das Skript zeigt Rang-/Bot-Spalten), aber die Overwrites im Blueprint und die Kanalliste bestätigen: `everyone` verliert `ViewChannel`, `tester` und `flight-computer` bekommen sie. Der Unterschied zu `staff-chat` ist genau der im Befund unten beschriebene: Navigators sind bei den Flight-Deck-Kanälen mit dabei, bei `test-pilots` nicht.

## Offene Betreiberentscheidung — Navigators sehen #test-pilots nicht

D-18 verlangt „nur für Testpiloten sichtbar" und ist damit **wörtlich korrekt** umgesetzt: die `overwrites` lassen ausschließlich `tester` und `flight-computer` herein, `Fleet Command` kommt nur über `Administrator` hinein (keine eigene Überschreibung), und `Navigators` (Moderatoren) haben gar keinen Zugriff — weder Lesen noch Aufräumen.

Bei den vier `FLIGHT DECK`-Kanälen (`staff-chat`, `mod-log`, `bot-config`, `community-updates`) haben Navigators dagegen Zugang (`STAFF_VIEW`). Die Formulierung in D-18 meinte mit hoher Wahrscheinlichkeit „nicht für die Allgemeinheit", nicht „auch nicht für die Moderation" — aber das ist eine Vermutung, keine belegte Absicht, und wurde deshalb **nicht eigenmächtig geändert**.

Bei 5 Mitgliedern heute folgenlos; sobald in `#test-pilots` moderiert werden muss (Spam, ein Streit, etwas zu Löschendes), ist es eine echte Lücke — ein Navigator kann den Kanal nicht einmal sehen. Als offener Punkt in `.planning/WINDOWS.md` (Eintrag #15, `kind: unrun-verify`) festgehalten. Falls gewünscht, wäre die Behebung eine Ein-Zeilen-Ergänzung des Overwrite-Objekts: `navigators: { allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }` nach dem Muster von `STAFF_VIEW`.

## Task Commits

1. **Task 1: Rolle aus dem Onboarding nehmen, Testpiloten-Kanal anlegen (D-14, D-15, D-18)** - `c386965` (feat) — Blueprint-Änderung, `npm run build && npm run gate` 18/18 grün
2. **Task 2: Den Blueprint auf den lebenden Server anwenden und gegenprüfen** — **kein eigener Commit**, weil dieser Task keine Repo-Datei ändert (nur externer API-Aufruf). Ausgeführt vom Betreiber, nicht vom Ausführungs-Agenten (siehe Deviations). Beleg: `node audit.mjs` vorher/nachher, siehe oben.

**Plan metadata:** siehe unten (dieser Commit)

## Files Created/Modified

- `discord/blueprint.mjs` - Onboarding-Option entfernt, Kanal `test-pilots` mit Overwrites ergänzt, drei Kommentar-/Seed-Textstellen sprachlich an D-15 angepasst

## Decisions Made

- D-14 wörtlich umgesetzt (siehe key-decisions oben)
- D-15 vollständig umgesetzt inkl. zwei zusätzlicher, im Plan nicht namentlich genannter Fundstellen
- D-18 mit flight-computer-Mitsicht für den künftigen Deploy-Ping
- Kein renames{}-Eintrag, keine neue Kategorie
- Navigators-Sichtbarkeit bewusst NICHT ergänzt — als offene Betreiberentscheidung dokumentiert statt eigenmächtig entschieden

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in der Plan-eigenen `<verify>`-Regex] `flight-computer`-Zusicherung fälschlich unquotiert erwartet**

- **Found during:** Task 1, Ausführung der automatisierten `<verify>`-Prüfung
- **Issue:** Die Prüfregel `/flight-computer:\s*\{\s*allow:/` erwartet den Objektschlüssel ohne Anführungszeichen. Gültiges JavaScript verlangt bei einem Bindestrich im Schlüsselnamen aber zwingend Anführungszeichen (`'flight-computer': { allow: [...] }`) — exakt die Form, die das bestehende Vorbild `STAFF_VIEW` im selben File bereits verwendet und die der Plan ausdrücklich als Vorbild nennt. Gegenprobe: dieselbe Regex gegen den unveränderten `STAFF_VIEW`-Block angewendet schlägt ebenfalls fehl — der Fehler liegt im Prüfskript, nicht in der Implementierung.
- **Fix:** Für die eigene Verifikation die Regex auf `/'?flight-computer'?:\s*\{\s*allow:/` erweitert (optionale Anführungszeichen). Das PLAN.md selbst wurde nicht verändert; die inhaltliche Zusicherung (drei Rechteeinträge im neuen Kanal) ist unverändert erfüllt.
- **Files modified:** keine (nur die lokal ausgeführte Prüfformel)
- **Verification:** Korrigierte Prüfung lief grün: „Blueprint: D-14 unveraendert, D-15 entfernt, D-18 angelegt (3 Rechteeintraege geprueft, Pruefregex fuer den zitierten Hyphen-Schluessel korrigiert)"
- **Committed in:** n/a (keine Codeänderung nötig)

---

**Total deviations:** 1 auto-fixed (Rule 1, Prüfskript-Bug, keine Implementierungsänderung)
**Impact on plan:** Kein Scope Creep. Die eigentliche Blueprint-Änderung entspricht exakt der Plan-Vorgabe.

## Issues Encountered

**Task 2 konnte nicht vom Ausführungs-Agenten selbst durchgeführt werden.** Zwei Blockaden nacheinander, beide korrekt nicht umgangen:

1. **Fehlende Zugangsdaten:** `discord/.env` existierte im Arbeitszweig zunächst nicht (Precondition des Plans unerfüllt) → Checkpoint an den Betreiber zurückgegeben, kein Ausführungsversuch.
2. **Nach Bereitstellung von `discord/.env` und `discord/node_modules` durch den Betreiber:** `node build.mjs` wurde vom Claude-Code-Berechtigungsklassifikator zweimal hart blockiert („Blocked by classifier"), unabhängig vom Token — eine irreversible Änderung an einem lebenden externen Dienst (Discord-API) außerhalb des Repos. Laut eigener Anweisung ist eine Autorisierung durch eine andere Agenten-Nachricht (auch eine Koordinator-Nachricht) keine Genehmigung durch das echte Berechtigungssystem; ein Umweg über ein anderes Werkzeug wäre ein Versuch gewesen, genau das zu umgehen, was die Sperre verhindern soll. Der Ausführungs-Agent hat deshalb angehalten und den Befund gemeldet, statt einen Workaround zu suchen.

Der Betreiber hat `node build.mjs` daraufhin selbst aus `discord/` heraus ausgeführt. Die Gegenprobe (`node audit.mjs` vorher/nachher) wurde ebenfalls außerhalb des Ausführungs-Agenten durchgeführt und in dieser Zusammenfassung als Beleg aufgenommen (siehe Tabelle oben), nicht selbst erzeugt.

**Token-Geheimhaltung:** Der `DISCORD_TOKEN`-Wert wurde zu keinem Zeitpunkt vom Ausführungs-Agenten gelesen oder ausgegeben — weder in Logs noch in dieser Zusammenfassung, wie vom Betreiber verlangt.

## User Setup Required

None - `discord/.env` und `discord/node_modules` sind bereits vom Betreiber im Arbeitszweig eingerichtet (git-ignoriert, `git status` vor jedem Commit dieses Plans geprüft und leer).

## Next Phase Readiness

- Der Blueprint UND der lebende Server tragen den neuen Stand — Plan 14-06 (Trockenlauf + Massenentzug bei Bestandsträgern) kann darauf aufsetzen.
- **Nebenbefund für 14-06:** Der Server hat aktuell nur 5 Mitglieder; die Bestandsaufnahme listet die Rollen des Eigentümers (`krisz22`: she/her, they/them, Fleet Command, Announcement Pings, ask me, Patch Pings, he/him, English, Drifter) — `Test Pilots` ist NICHT darunter. Der Massenentzug aus D-16 dürfte also sehr klein ausfallen. Der Trockenlauf in 14-06 muss die tatsächliche Zahl trotzdem selbst am lebenden Server feststellen, nicht aus dieser Beobachtung ableiten.
- Offener Punkt für den Betreiber: Navigators-Sichtbarkeit auf `#test-pilots` (WINDOWS.md #15) — blockiert 14-06 nicht, sollte aber vor echtem Moderationsbedarf entschieden werden.
- `GuildMembers`-Intent bleibt bewusst aus (Plan 14-07), `audit.mjs` hat das in beiden Läufen nicht als Fehler behandelt.

---
*Phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-17*
