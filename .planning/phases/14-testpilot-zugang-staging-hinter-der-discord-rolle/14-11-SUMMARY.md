---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 11
subsystem: discord
tags: [discord.js, github-actions, jq, better-sqlite3, webhook]

# Dependency graph
requires:
  - phase: 14-05
    provides: "Kanal #test-pilots existiert live, nur fuer tester + flight-computer sichtbar"
  - phase: 14-07
    provides: "always-on Bot mit registerRoleSync(ctx)/reconcileRoles(ctx) als Vorbild fuer die Verdrahtung, GuildMembers-Intent bereits vorhanden"
provides:
  - "registerBugThreadXp(ctx) -- XP-Bonus je Fehlerbericht-Thread in #bug-reports, genau einmal, ueber Primaerschluessel-Sperre erzwungen (D-21)"
  - "Deploy-Ping-Schritt in deploy-staging.yml -- Commit-Betreffzeilen seit dem letzten Ausrollen, Kennung, Link (D-20)"
affects: ["14-12 (fuehrt WINDOWS.md-Eintraege zusammen, inkl. id 27 aus diesem Plan)", "jeder kuenftige Coolify-Deploy des Bots (D-21 wird erst mit dem naechsten Bot-Rollout live)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GitHub-Compare-API (owner/repo/compare/BEFORE...AFTER) statt `git log <vorher>..<jetzt>` gegen einen absichtlich flachen Checkout -- Vorbild fuer jeden kuenftigen Workflow-Schritt, der eine Commit-Spanne braucht, ohne fetch-depth 0 zu bezahlen"
    - "gsub(\"\\r\"; \"\") an JEDEM Punkt, an dem Text aus einer externen Quelle (GitHub-API) in eine Discord-Nachricht fliesst -- die CLAUDE.md-Falle '`.` trifft kein \\r' trat hier real auf und wurde durch eigenen Testlauf gefunden, nicht durch Zufall"

key-files:
  created:
    - discord/bot/src/bug-thread-xp.mjs
  modified:
    - discord/bot/src/db.mjs
    - discord/bot/src/index.mjs
    - .github/workflows/deploy-staging.yml

key-decisions:
  - "D-21 Bonusbetrag 50 XP, explizit aus der bestehenden Skala hergeleitet (config.mjs: 15-25 XP/Nachricht; leveling.mjs: 100 XP fuer Level 0->1) und im Kopfkommentar von bug-thread-xp.mjs begruendet, inklusive der beiden in D-21 verworfenen Alternativen (Dauer-Multiplikator, Ernennungs-Bonus)"
  - "Sperre gegen Doppelvergabe ist der Primaerschluessel thread_id in bug_xp_threads, nicht eine Code-Bedingung -- grantXp() laeuft VOR dem Eintrag, damit ein Fehlschlag beim Vergeben nie als vergeben verbucht wird (patch-watch.mjs-Regel)"
  - "D-20 Quelle ist die GitHub-Compare-API, nicht `git log`: der Checkout-Schritt ist absichtlich flach (Standardtiefe 1), fetch-depth 0 fuer JEDEN Vorschau-Build waere bei >300 MB .git teuer; die API kennt beide Staende unabhaengig von der lokalen Tiefe und braucht nur GITHUB_TOKEN, das der Job ohnehin hat"
  - "EIN Embed statt zwei (EN+DE wie patch-watch.mjs) -- Commit-Betreffzeilen sind keine uebersetzbaren Redaktionstexte; sie zu uebersetzen hiesse, Text zu erfinden, der so nicht committet wurde. Titel/Zusatztexte sind zweisprachig, die Betreffliste bleibt roh"
  - "gsub(\"\\r\";\"\") an ZWEI Stellen im Workflow-Schritt (Betreff aus der Compare-API UND die volle Beschreibung unmittelbar vor dem Versand) -- waehrend des eigenen Testlaufs real aufgetretener CRLF-Fund (siehe Deviations), nicht vorab spekuliert"

patterns-established:
  - "Ein neuer GitHub-Actions-Schritt, der mehrzeilige Bash-Strings baut, MUSS $'\\n' statt eingebetteter literaler Zeilenumbrueche im YAML-Quelltext verwenden -- ein Umbruch mitten in einer Variablenzuweisung unterschreitet die Einrueckung des `run: |`-Blocks und wirft den YAML-Parser aus dem Block-Skalar (python yaml.safe_load faengt das, `bash -n` allein nicht)"
  - "Beim lokalen Testen eines GitHub-Actions-Schritts: die Zeile mit `git`/`node` extrahieren (python -> yaml.safe_load -> steps[].run), `${{ github.* }}`-Ausdruecke durch env-Variablen ersetzen, gegen einen lokalen Wegwerf-Server (node:http) statt eines echten Webhooks fahren -- deckt reale Bugs auf (hier: CRLF), ohne die Live-Zielressource zu beruehren"

requirements-completed: [D-20, D-21]

coverage:
  - id: D1
    description: "XP-Bonus (50 XP) je Fehlerbericht-Thread in #bug-reports, genau einmal, unabhaengig von der Rolle tester; bug_xp_threads(thread_id PRIMARY KEY) als Sperre; kein neues Gateway-Intent"
    requirement: D-21
    verification:
      - kind: other
        ref: "node --check ueber alle drei Dateien + der im Plan vorgegebene automatisierte <verify>-Block (4 Textbausteine, Primaerschluessel-Regex, GatewayIntentBits-Abwesenheit) -- bestanden"
        status: pass
      - kind: other
        ref: "Sechs Faelle lokal gefahren (EventEmitter + echtes db.mjs/better-sqlite3, ctx.roles=null als Stellvertreter): neuer Thread (+50), zweiter ThreadCreate fuer denselben Thread (unveraendert), zweiter eigener Thread (+50 erneut, insgesamt 100), anderer Kanal (unveraendert), Bot-Neustart/newlyCreated=false (unveraendert), Bot-Ersteller (unveraendert) -- XP-Staende vorher/nachher siehe unten"
        status: pass
    human_judgment: true
    rationale: "Die vier Live-Nachweise aus dem Plan-<human-check> (echter Testthread in #bug-reports, /rank-Pruefung, Betreiber-Urteil ueber Ton/Laenge des Pings, Zweitkonto-Sichtbarkeitspruefung) verlangen echte Discord-Mutationen -- ausdruecklich verboten fuer diesen Ausfuehrungsagenten. Als WINDOWS.md id 27 (unrun-verify) verdrahtet, Plan 12 fuehrt zusammen."
  - id: D2
    description: "Deploy-Ping-Schritt in deploy-staging.yml NACH dem Deploy-Check: Commit-Betreffzeilen seit dem letzten Stand (GitHub-Compare-API, Fallback auf nur den aktuellen Betreff), verkuerzte Kennung, Link; Webhook statt Bot-Token; ::warning:: bei fehlendem Secret, roter Schritt bei Discord-Ablehnung"
    requirement: D-20
    verification:
      - kind: other
        ref: "der im Plan vorgegebene automatisierte <verify>-Block (DISCORD_TESTPILOT_WEBHOOK, git log, ::warning::, http_code, Reihenfolge nach dem Deploy-Check, kein secrets.DISCORD_TOKEN) -- bestanden"
        status: pass
      - kind: other
        ref: "python yaml.safe_load gegen die volle Datei (YAML-Syntax) + bash -n gegen den extrahierten run-Block (Bash-Syntax) -- beide gruen, nach einem gefundenen und behobenen YAML-Bruch (siehe Deviations)"
        status: pass
      - kind: other
        ref: "Lokaler Testlauf gegen einen Wegwerf-Webhook (node:http-Server) in vier Szenarien: (a) kein vorheriger Stand -> Fallback-Hinweistext, HTTP 204 Erfolgsfall; (b) Discord-Ablehnung HTTP 400 -> Schritt exit 1 mit Code+Antwort; (c) echte GitHub-Compare-API gegen dieses Repo (5 echte Commit-Betreffzeilen der letzten 5 Commits) -> korrekte Liste, CR-frei; (d) Truncation-Logik isoliert mit 15 synthetischen Eintraegen -> erste 10 + 'und 5 weitere · and 5 more'. Alle vier ROH-Nachrichten stehen unten"
        status: pass
    human_judgment: true
    rationale: "Der eigentliche Live-Ping in #test-pilots und das Betreiber-Urteil ueber Ton/Laenge/Quelltauglichkeit der Betreffzeilen (Plan-<human-check> Punkt 2+3) sind nur am naechsten echten staging-Deploy pruefbar -- ausserhalb dieser Ausfuehrung. Als WINDOWS.md id 27 verdrahtet."

# Metrics
duration: ~65min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 11: Testpilot-Perks -- XP-Bonus je Fehlerbericht-Thread und Deploy-Ping Summary

**registerBugThreadXp(ctx) vergibt 50 XP je neuem Thread in #bug-reports (genau einmal, ueber einen Primaerschluessel erzwungen), und ein neuer GitHub-Actions-Schritt postet nach jedem Vorschau-Ausrollen die Commit-Betreffzeilen seit dem letzten Stand ueber einen Kanal-Webhook nach #test-pilots -- lokal gegen einen Wegwerf-Server getestet, dabei ein echter CRLF-Bug aus der GitHub-API gefunden und behoben.**

## Performance

- **Duration:** ~65min
- **Completed:** 2026-08-18T12:28:57Z
- **Tasks:** 2/2
- **Files modified:** 4 (1 neu, 3 geaendert)

## Accomplishments

- **D-21 (Aufgabe 1):** `discord/bot/src/bug-thread-xp.mjs` (neu) -- `registerBugThreadXp(ctx)` haengt an `Events.ThreadCreate`, prueft der Reihe nach Elternkanal (Namensmuster `bug-reports`, keine feste ID), `newlyCreated`, Mensch statt Bot, dann die `bug_xp_threads`-Sperre. `grantXp(ctx, { member, guild, amount: 50, stats: { bugReports: 1 }, currentChannel: thread })` laeuft VOR dem Sperreintrag. Kein neues Gateway-Intent (`ThreadCreate` liegt unter dem bereits vorhandenen `Guilds`-Intent). Der Bonus haengt NICHT an der Rolle `tester`.
- `discord/bot/src/db.mjs`: Tabelle `bug_xp_threads(thread_id TEXT PRIMARY KEY, guild_id, user_id, granted_at)` plus `hasBugXp()`/`markBugXp()`. Der Primaerschluessel IST die Sperre.
- `discord/bot/src/index.mjs`: `registerBugThreadXp(ctx)` top-level registriert, neben `registerRoleSync(ctx)`.
- **D-20 (Aufgabe 2):** `.github/workflows/deploy-staging.yml` -- neuer Schritt "Deploy-Ping im Testpiloten-Kanal" NACH "Warten, bis die Vorschau den neuen Stand zeigt". Quelle der Commit-Betreffzeilen: GitHub-Compare-API (nicht `git log`, weil der Checkout absichtlich flach ist und ein volles `fetch-depth: 0` bei >300 MB `.git` fuer jeden Vorschau-Build teuer waere). Fallback auf nur den aktuellen Betreff (`git log -1`), wenn kein vorheriger Stand bestimmbar ist (erster Lauf, `workflow_dispatch`, `BEFORE==AFTER`, API-Fehler) -- mit sichtbarem, zweisprachigem Hinweistext. Bei mehr als zehn Betreffzeilen: erste zehn plus "… und N weitere · … and N more". `DISCORD_TESTPILOT_WEBHOOK` statt Bot-Token; fehlt das Secret, `::warning::` statt eines roten Laufs (dieselbe Bauform wie der bestehende Coolify-Schritt); lehnt Discord ab, HTTP-Code und Antwort werden ausgegeben und der Schritt wird rot.
- **Vier funktionale Testlaeufe** (siehe Deviations fuer den dabei gefundenen CRLF-Bug):
  1. Kein vorheriger Stand, Wegwerf-Webhook antwortet 204 -- Fallback-Hinweistext, sauberer Versand.
  2. Wegwerf-Webhook antwortet 400 -- Schritt gibt HTTP-Code + Antwort aus, `exit 1`, `::error::`.
  3. Echte GitHub-Compare-API gegen `cibakhun/sc-patch-archive` (mit `gh auth token`), reale Commit-Spanne der letzten 5 Commits -- 5 echte, CR-freie Betreffzeilen im Ping.
  4. Truncation-Logik isoliert mit 15 synthetischen Eintraegen -- erste 10 + "… und 5 weitere · … and 5 more".
- `npm run build && npm run gate`: 18/18 Schienen-A-Schritte gruen, 0 FEHLER, 4 vorbestehende WARNUNGEN (kein `<h1>` auf vier Konto-/Piloten-Seiten -- unveraendert seit vorherigen Plaenen, nicht durch diesen Plan beruehrt). `discord/bot` und `.github/workflows/` werden von `npm run gate` nicht geprueft (kein Eintrag in `scripts/lib/gate-registry.mjs`) -- separat via `node --check`, YAML-/Bash-Syntaxpruefung und die funktionalen Testlaeufe oben abgedeckt.

## XP-Staende vorher/nachher (lokaler Testlauf, sechs Faelle)

| Fall | Ereignis | XP vorher | XP nachher | Erwartung erfuellt |
|---|---|---|---|---|
| 1 | neuer Thread `t1` in `#bug-reports`, `newlyCreated=true` | 0 | 50 | ja |
| 2 | erneuter `ThreadCreate` fuer DENSELBEN Thread `t1` (simuliert Doppelzustellung) | 50 | 50 | ja -- unveraendert |
| 3 | zweiter, eigener Thread `t2` desselben Nutzers | 50 | 100 | ja -- erneut +50 |
| 4 | Thread `t3` in `#feedback` (anderer Kanal) | 0 | 0 | ja -- unveraendert |
| 5 | `newlyCreated=false` fuer Thread `t4` (Bot-Neustart-Simulation) | 0 | 0 | ja -- unveraendert |
| 6 | Ersteller ist ein Bot (Thread `t5`) | 0 | 0 | ja -- unveraendert |

Testaufbau: `node:events.EventEmitter` als Bot-Client-Stellvertreter, echtes `db.mjs`/`better-sqlite3` (temporaere SQLite-Datei), Fake-`guild.members.fetch()`. Fall 3 (Uebergang von 50 auf 100 XP) ueberschreitet `xpToNext(0)=100` und loeste den Level-Aufstiegs-Zweig in `award.mjs` aus, der in der Testumgebung wegen `ctx.roles=null` (Test-Stellvertreter, kein echter `RankRoles`) mit einer gefangenen Ausnahme endete -- **kein Fehler im produktiven Code**: `grantXp()` hatte die XP zu diesem Zeitpunkt bereits geschrieben (siehe Tabelle, 100 XP korrekt), der Fehler trat erst im nachgelagerten Rollenabgleich auf und wurde vom `try/catch` in `bug-thread-xp.mjs` protokolliert statt den Prozess zu stoeren. In Produktion ist `ctx.roles` ein echtes `RankRoles`-Objekt; dasselbe Nachschalt-Risiko besteht in identischer Form bereits im bestehenden `MessageCreate`-Pfad (`index.mjs`), der `grantXp()` ganz ohne eigenen `try/catch` aufruft -- außerhalb des Scopes dieses Plans (Rule-Scope-Boundary).

## Deploy-Ping-Testlaeufe (Rohtext der vier Szenarien)

**Szenario (a) -- kein vorheriger Stand, Erfolg (HTTP 204):**
```
description: "_Vorheriger Stand nicht ermittelbar — nur der aktuelle Commit. · Previous state not determinable — current commit only._

• docs(14-08): complete testpilot-echtes-tor plan

[→ staging.verse-base.com](https://staging.verse-base.com)"
```

**Szenario (b) -- Discord lehnt ab (HTTP 400):**
```
HTTP 400
Antwort: {"message":"simulated rejection","code":50035}
::error::Discord lehnt den Webhook-Post ab (HTTP 400). Webhook-URL in Discord pruefen (...).
EXIT_CODE=1
```

**Szenario (c) -- echte GitHub-Compare-API, 5 echte Commits dieses Repos:**
```
description: "• feat(14-08): mint() urteilt ueber gate_verdict statt user_roles
• feat(14-08): Ausnahmeliste aufzaehlen, begruenden, gegen echten Browser messen
• feat(14-08): stille Erneuerung des Testpilot-Ausweises (D-08)
• test(14-08): CI-Sonde um gate_verdict-Pfade und D-09-Ausfall erweitern
• docs(14-08): complete testpilot-echtes-tor plan

[→ staging.verse-base.com](https://staging.verse-base.com)"
```
(Verifiziert: `"\r" in desc` == `False` -- keine eingebetteten Wagenruecklaeufe in der tatsaechlich empfangenen Nachricht, nach dem Fix unten.)

**Szenario (d) -- Truncation bei 15 synthetischen Eintraegen:**
```
• commit betreff nr 1
… (Zeilen 2-9 ausgelassen)
• commit betreff nr 10
… und 5 weitere · … and 5 more
```

## Task Commits

1. **Aufgabe 1: XP je Fehlerbericht-Thread, genau einmal (D-21)** - `6e4421b` (feat)
2. **Aufgabe 2: Deploy-Ping mit den Commit-Betreffzeilen (D-20)** - `54e72cb` (feat)

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

## Files Created/Modified

- `discord/bot/src/bug-thread-xp.mjs` (neu) -- `registerBugThreadXp(ctx)`, `BUG_XP_AMOUNT = 50`
- `discord/bot/src/db.mjs` -- Tabelle `bug_xp_threads`, `hasBugXp()`, `markBugXp()`
- `discord/bot/src/index.mjs` -- `registerBugThreadXp(ctx)` verdrahtet
- `.github/workflows/deploy-staging.yml` -- Schritt "Deploy-Ping im Testpiloten-Kanal"

## Decisions Made

Siehe `key-decisions` im Frontmatter -- Kurzfassung: Bonusbetrag 50 XP begruendet aus der bestehenden Skala; Sperre ist ein Primaerschluessel, nicht Code-Logik; Deploy-Ping-Quelle ist die GitHub-Compare-API statt `git log` (Kostenabwaegung gegen `fetch-depth: 0`); ein Embed statt zwei EN/DE (Commit-Betreffzeilen sind keine uebersetzbaren Redaktionstexte); doppeltes `gsub("\r";"")` als direkte Reaktion auf einen im eigenen Testlauf gefundenen Fehler.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] YAML-Block-Skalar durch eingebettete literale Zeilenumbrueche gebrochen**

- **Found during:** Aufgabe 2, erster `python -c "yaml.safe_load(...)"`-Lauf nach dem ersten Entwurf des Workflow-Schritts
- **Issue:** Drei Bash-Zuweisungen im neuen Schritt enthielten literale Zeilenumbrueche mitten im YAML-Quelltext (z. B. `LINES="$LINES\n… und $REST weitere..."` als echter Zeilenumbruch statt Escape-Sequenz). Der `run: |`-Block-Skalar in YAML verlangt, dass JEDE Fortsetzungszeile mindestens so weit eingerueckt ist wie die erste Inhaltszeile -- die eingebetteten Fortsetzungszeilen begannen bei Spalte 0 und rissen den Parser aus dem Block-Skalar, was der Datei ab Zeile ~273 einen falschen Aufbau gab (`bash -n` allein haette das NICHT gefunden, da die extrahierte Bash-Syntax fuer sich genommen gueltig war -- erst `python yaml.safe_load` gegen die GANZE Datei deckte es auf).
- **Fix:** Alle drei Stellen auf `$'\n'`-ANSI-C-Quoting umgestellt (`LINES="${LINES}"$'\n'"… und $REST weitere..."` etc.), keine literalen Zeilenumbrueche mehr im YAML-Quelltext.
- **Files modified:** `.github/workflows/deploy-staging.yml`
- **Verification:** `python -c "import yaml; yaml.safe_load(...)"` -> `YAML OK`; `bash -n` gegen den extrahierten `run`-Block -> `bash syntax OK`.
- **Committed in:** `54e72cb` (Aufgabe-2-Commit; der Fehler trat vor jedem Commit auf, kein separater Fix-Commit noetig)

**2. [Rule 1 - Bug] Commit-Betreffzeilen aus der GitHub-API mit eingebettetem `\r`**

- **Found during:** Aufgabe 2, funktionaler Testlauf (c) gegen die echte GitHub-Compare-API
- **Issue:** Die GitHub-API liefert `commit.message` mit `\r\n`-Zeilenenden. `split("\n")[0]` liess ein `\r` am Ende jeder Betreffzeile stehen -- exakt die in `CLAUDE.md` benannte Falle ("`.` trifft kein `\r`"), hier aber am `split`, nicht an einem Regex-`.`. Erst sichtbar geworden, weil der Testlauf gegen einen ECHTEN Wegwerf-Webhook lief und den empfangenen Rumpf byte-genau (nicht nur die eigene Vorschau-Ausgabe) protokollierte -- eine reine Trockenpruefung des jq-Filters ohne Webhook-Empfang haette es vermutlich ebenfalls gezeigt, aber die END-to-END-Pruefung war der tatsaechliche Fundweg.
- **Fix:** `gsub("\r"; "")` VOR dem `split("\n")[0]` beim Einlesen des API-Betreffs, UND zusaetzlich `gsub("\r"; "")` auf die volle `description` unmittelbar vor dem finalen `jq -n`-Aufbau (Verteidigung an zwei Punkten: Quelle und letzter Sammelpunkt vor dem Versand).
- **Files modified:** `.github/workflows/deploy-staging.yml`
- **Verification:** Direkter Byte-Test des empfangenen Webhook-Rumpfs (`"\r" in desc` in Python) -> `False`, nach dem Fix. Vor dem Fix: `True`.
- **Committed in:** `54e72cb` (Aufgabe-2-Commit; beide Fixes vor dem Commit angewendet)

---

**Total deviations:** 2 auto-fixed (beide Rule 1, beide im selben neuen Workflow-Schritt, beide durch den eigenen funktionalen Testlauf gefunden statt spekuliert)
**Impact on plan:** Kein Scope Creep. Beide Fixes waren noetig, damit der neue Schritt syntaktisch gueltig ist bzw. keine sichtbar kaputten Zeichen in eine echte Discord-Nachricht schreibt -- beides Kernfunktionalitaet der Aufgabe, nicht zusaetzlicher Umfang.

## Issues Encountered

- **`discord/bot` hatte kein installiertes `node_modules`** (nur `discord/node_modules` fuer die Blueprint-Skripte existierte im Worktree). Fuer den funktionalen XP-Testlauf war `better-sqlite3` noetig, um `db.mjs` wirklich auszufuehren (nicht nur `node --check`). `npm ci --no-audit --no-fund` in `discord/bot/` nachgeholt -- alle Pakete sind bereits in `package.json`/`package-lock.json` deklariert und gepinnt (kein neuer, unverifizierter Paketname; die Rule-3-Ausnahme fuer Paketinstallationen betrifft neue/unbekannte Pakete, nicht das Nachziehen einer bereits gesperrten, projekteigenen Abhaengigkeit). `discord/bot/node_modules` bleibt git-ignoriert (`.gitignore` bestaetigt, `git status` zeigt es nicht).
- **Lokales `jq.exe` (scoop, natives Windows-Binary) fuegte beim reinen Anzeigen (Pretty-Print ohne `-c`, mehrzeilige `jq -r`-Ausgabe) zusaetzliche `\r`-Bytes zwischen JSON-/Zeilenstrukturen ein** -- ein reiner CRT-Text-Modus-Artefakt beim Schreiben in eine Pipe, spezifisch fuer diese lokale Windows-Testumgebung. Ausfuehrlich untersucht (Bytevergleich per `python -rb`), um sicherzustellen, dass es sich NICHT um den echten API-Bug (siehe Deviation 2) handelt, sondern um ein zusaetzliches, unabhaengiges lokales Test-Artefakt ohne Auswirkung auf den Ubuntu-CI-Runner (natives `jq`-ELF-Binary ohne CRT-Text-Modus-Uebersetzung). Betraf ausschliesslich Whitespace AUSSERHALB von JSON-String-Werten (harmlos fuer jeden JSON-Parser) -- nicht behoben, da kein echter Defekt.

## User Setup Required

**Ein neues Repo-Secret, noch NICHT hinterlegt** (aus `user_setup` der Plan-Frontmatter):

| Secret | Wert |
|---|---|
| `DISCORD_TESTPILOT_WEBHOOK` | Kanal-Webhook-URL fuer `#test-pilots` -- Discord-Client -> BUILD & FEEDBACK -> #test-pilots -> Kanal bearbeiten -> Integrationen -> Webhooks -> Neuer Webhook, Name "Vorschau-Stand", URL kopieren -> als Repo-Secret unter GitHub -> Settings -> Secrets and variables -> Actions hinterlegen |

Ohne dieses Secret laeuft der neue Workflow-Schritt weiterhin gruen durch (`::warning::` statt eines roten Laufs, wie im Plan gefordert) -- der Deploy-Ping bleibt aber bis zur Einrichtung aus.

**Kein Bot-Deploy noetig fuer D-21** in dem Sinne, dass der Code committet ist -- aber die laufende Coolify-Instanz des Bots faehrt weiterhin den ALTEN Stand (ohne `bug-thread-xp.mjs`), bis der Betreiber ausdruecklich ausrollt. Ausdruecklich NICHT Teil dieser Ausfuehrung (kritische Vorgabe: "Do NOT deploy the bot").

## Next Phase Readiness

- Beide Perks (D-20, D-21) sind code-fertig, maschinell und lokal-funktional geprueft, aber NICHT live wirksam:
  - D-21 braucht den naechsten Bot-Deploy (Coolify).
  - D-20 braucht zusaetzlich das Repo-Secret `DISCORD_TESTPILOT_WEBHOOK`.
- **WINDOWS.md id 27** (neu, `unrun-verify`, phase 14) fasst die vier Live-Sichtpunkte aus dem Plan zusammen (Testthread-XP am echten Server, Deploy-Ping-Optik, Betreiber-Urteil ueber die Betreffzeilen als Ping-Quelle, Kanal-Unsichtbarkeit fuer ein Zweitkonto ohne Rolle) -- Plan 12 fuehrt laut Plan-Vorgabe zusammen.
- `npm run build && npm run gate`: 18/18 gruen, unveraendert gegenueber dem Stand vor diesem Plan (die geaenderten/neuen Dateien liegen ausserhalb der von `npm run gate` geprueften Baeume).

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: discord/bot/src/bug-thread-xp.mjs
- FOUND: discord/bot/src/db.mjs (bug_xp_threads, hasBugXp, markBugXp bestaetigt per grep)
- FOUND: discord/bot/src/index.mjs (registerBugThreadXp bestaetigt per grep)
- FOUND: .github/workflows/deploy-staging.yml (Deploy-Ping-Schritt bestaetigt per grep, YAML+Bash-Syntax geprueft)
- FOUND: commit 6e4421b (Aufgabe 1)
- FOUND: commit 54e72cb (Aufgabe 2)
- FOUND: .planning/WINDOWS.md id 27 (kind unrun-verify, phase 14)
- `npm run build && npm run gate`: 18/18 gruen
