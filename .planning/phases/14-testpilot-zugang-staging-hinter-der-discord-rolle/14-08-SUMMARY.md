---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 08
subsystem: infra
tags: [njs, nginx, gate_verdict, postgrest, ci-probe, hmac]

# Dependency graph
requires:
  - phase: 14-01
    provides: "njs-Tuersteher (nginx/gate.js, nginx/default.conf), Cookie-Format {sub, exp}, Mint-Vertrag (bis hier noch gegen user_roles), CI-Sondenform probe-gate-e2e.yml"
  - phase: 14-02
    provides: "public.gate_verdict() -- security definer, parameterlos, Sperrliste vor admin vor tester, schreibt last_staging_seen"
  - phase: 14-07
    provides: "public.discord_role_state wird per Push gefuellt (Bot noch nicht deployed) -- die Datenquelle, aus der gate_verdict() is_tester liest"
provides:
  - "nginx/gate.js mint() urteilt ueber EINEN Aufruf auf rpc/gate_verdict statt eines direkten user_roles-Blicks -- Testpilot, Sperrliste, Admin, Ausfallverhalten in einem Codepfad"
  - "nginx/default.conf: 7 GATE-AUSNAHME-Eintraege im Format '# GATE-AUSNAHME: <pfad> -- <anlass>', gemessen gegen einen echten Browser-Mitschnitt von /gate.html"
  - "assets/account-lite.js: stille Erneuerung des Ausweises ueber vb_gate_exp, mit demselben localStorage-Riegel wie ensureSession(), Aussetzen/Nachholen bei visibilitychange"
  - "probe-gate-e2e.yml erweitert: gate_verdict-Antwortpfade (Testpilot/Sperrliste/gesperrter Admin/kein Testpilot) und eine D-09-Ausfallsimulation (Container mit unerreichbarer VB_SUPABASE_URL) gegen den echten Container"
affects: [14-09, 14-10, 14-12]

tech-stack:
  added: []
  patterns:
    - "Promise.race gegen einen setTimeout-Zeitgeber fuer einen Netzaufruf-Zeitueberlauf in njs -- ngx.fetch() kennt keine eigene Zeitueberlauf-Option"
    - "Drei-Zustands-Rueckgabe (ok/locked/failed) statt eines blossen Boolean, wenn 'nicht erneut versuchen bei echtem Fehler' UND 'nicht aufgeben bei blosser Riegel-Kollision zwischen Tabs' beide gelten muessen"
    - "nginx-Kommentarmarker flush-links (Spalte 0) als maschinenlesbarer Anker, wenn der umgebende Code eingerueckt ist -- das Pruefskript verlangt exakt das, nicht die uebliche Bloecke-Einrueckung"

key-files:
  created: []
  modified:
    - nginx/gate.js
    - nginx/default.conf
    - assets/account-lite.js
    - .github/workflows/probe-gate-e2e.yml

key-decisions:
  - "mint() unterscheidet HTTP 401/403 von PostgREST (Token selbst abgelehnt -> 403 kein-zugang) von jedem anderen unklaren Ausgang (5xx, Zeitueberlauf, Netzfehler, unlesbare/fremdgeformte Antwort -> 503 urteil-unklar/supabase-*) -- beide fuehren NIE zu einem Ausweis, aber nur die zweite Gruppe ist im Sinne von D-09 'ein Ausfall', die erste ist eine echte Ablehnung."
  - "In assets/account-lite.js unterscheidet mintGatePass() 'locked' (ein anderer Tab stellt gerade aus -> spaeter erneut pruefen, das Cookie ist vermutlich laengst erneuert) von 'failed' (echtes Scheitern -> NICHT weiterprobieren, wie der Plan es verlangt). Eine reine ok/failed-Unterscheidung haette einen durch den Riegel blockierten Tab dauerhaft ohne eigenen Erneuerungs-Zeitplan zurueckgelassen."
  - "Die CI-Sonde testet die vier gate_verdict()-Antwortformen (Testpilot/Sperrliste/gesperrter Admin/kein Testpilot) ueber einen erweiterten Mock-PostgREST (Bahn B), NICHT gegen echte Supabase-Testkonten mit echtem is_tester/tester_blocklist-Zustand -- dafuer existiert kein Repo-Secret und keins wurde spekulativ angelegt. Das prueft gate.js' eigene Antwort-VERARBEITUNG vollstaendig; die SQL-seitige Reihenfolge (Sperrliste schlaegt admin) bleibt Plan-02-Code-Review plus ein offener Punkt fuer die Sichtrunde des Betreibers -- derselbe Musterentscheid wie in 14-01-SUMMARY.md (Bahn A/B) und 14-02-SUMMARY.md (coverage D4-D6)."

patterns-established:
  - "D-09-Ausfallsimulation mit einer nicht gerouteten Schwarzes-Loch-Adresse (10.255.255.1) statt einem sofort verweigernden Host -- prueft den EIGENEN 5s-Zeitueberlauf, nicht nur 'irgendein Netzfehler'."

requirements-completed: [D-06, D-08, D-09, D-10, D-13, D-03, D-04]

coverage:
  - id: D1
    description: "mint() ruft rpc/gate_verdict statt user_roles auf; kein Service-Schluessel im Modul; check() bleibt netzfrei (D-08)"
    requirement: D-08
    verification:
      - kind: unit
        ref: "node -e Substring-Pruefung aus 14-08-PLAN.md Aufgabe 1 <verify> -- lokal ausgefuehrt, bestanden"
        status: pass
    human_judgment: false
  - id: D2
    description: "Testpilot (is_tester=true, kein Admin) bekommt einen Ausweis (D-03); ein Sperrlisteneintrag entzieht ihn beim naechsten Ausstellen; ein gesperrter Admin bekommt ebenfalls keinen (D-10)"
    requirement: D-03
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32133474158, Schritt 'Zusicherungen — Plan 14-08: Testpilot, Sperrliste, blockierter Admin (Bahn B)' -- 9/9 Zusicherungen gruen (mock-tester->200+ok:true, mock-blocked->403+grund:gesperrt, mock-blocked-admin->403, mock-kein-testpilot->403+grund:kein-testpilot, kein Fall ausser dem erlaubenden setzt ein Cookie)"
        status: pass
    human_judgment: true
    rationale: "Gegen einen erweiterten Mock-PostgREST gemessen (gate.js' eigene Antwort-Verarbeitung fuer alle vier Urteilsformen), nicht gegen ein echtes Supabase-Testkonto mit echtem is_tester/tester_blocklist-Zustand -- dafuer existiert kein Repo-Secret. Die SQL-seitige Sperrliste-vor-admin-Reihenfolge in gate_verdict() (Plan 02, bereits live) ist Code-Review, nicht live nachgemessen. Fuer die Sichtrunde des Betreibers vorgesehen."
  - id: D3
    description: "Ein bereits gesetztes, gueltiges Cookie kommt weiter durch, waehrend VB_SUPABASE_URL unerreichbar ist; ein neues Ausstellen scheitert im selben Zustand mit 503, gemessen mit Zeit statt gehaengt (D-09)"
    requirement: D-09
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32133474158, Schritt 'Zusicherung — Plan 14-08 / D-09: Ausfall (vbgate-outage)' -- gueltiges Cookie 200, neues Ausstellen 503 nach 5s (10.255.255.1 als Schwarzes-Loch-Adresse, kein sofortiger Fehlschlag), kein Cookie bei Fehlschlag"
        status: pass
    human_judgment: false
  - id: D4
    description: "discord_role_state.last_staging_seen wird bei jedem erlaubenden Urteil fortgeschrieben (D-13)"
    requirement: D-13
    verification: []
    human_judgment: true
    rationale: "gate_verdict() (Plan 02, bereits live) schreibt last_staging_seen unbedingt bei jedem allowed:true per INSERT ... ON CONFLICT UPDATE -- durch Quelltext-Review der bereits angewandten Migration bestaetigt, nicht durch einen echten authentifizierten Aufruf gemessen (keine Bahn-A-Sitzung mit echtem Testkonto verfuegbar). Fuer die Sichtrunde des Betreibers vorgesehen, wie in 14-02-SUMMARY.md coverage D2/D3 bereits angelegt."
  - id: D5
    description: "Ausnahmeliste aufgezaehlt und je begruendet (D-06): 7 GATE-AUSNAHME-Eintraege, kein Sammelmuster ausser der einen erlaubten Schriftverzeichnis-Ausnahme, gegen einen echten Browser-Mitschnitt von /gate.html ohne Cookie gemessen"
    requirement: D-06
    verification:
      - kind: unit
        ref: "node -e Substring-/Regex-Pruefung aus 14-08-PLAN.md Aufgabe 2 <verify> -- 7 Anlaesse == 7 Bloecke, kein /assets/-Sammelmuster; playwright-core+Chrome gegen /gate.html auf lokalem Vorschau-Server (astro preview) protokolliert exakt 7 Anfragen, alle bereits in der Liste"
        status: pass
    human_judgment: false
  - id: D6
    description: "Roter Lauf: die theme.css-Ausnahme entfernt (simuliert) macht die Torseite sichtbar kaputt"
    requirement: D-06
    verification:
      - kind: manual_procedural
        ref: "playwright-core: /assets/theme.css-Antwort durch die HTML-Antwort von /gate.html ersetzt (bildet exakt nach, was das 302-Redirect-Verhalten der allgemeinen location / bei einer entfernten Ausnahme liefern wuerde) -- h1-Schriftgroesse 35.2px->16px, Buchstabenabstand 0.352px->normal, Knopftextfarbe rgb(5,7,13)->rgb(232,238,252) auf hellblauem Grund; Screenshots vor/nach verglichen"
        status: pass
    human_judgment: true
    rationale: "Docker/nginx nicht lokal verfuegbar -- die Simulation bildet das dokumentierte Redirect-Verhalten der Datei nach (HTML statt CSS, vom Browser wegen strikter MIME-Pruefung verworfen), ersetzt aber keinen echten nginx-Lauf ohne die Ausnahme. Ergebnis ist eindeutig (vier Kennzahlen kollabieren auf Browser-Vorgaben), aber die Methode ist eine Nachbildung, kein Originalbefund."
  - id: D7
    description: "Stille Erneuerung: kein Cookie -> kein Aufruf; mit Cookie -> genau ein Aufruf mit Bearer-Header, neues vb_gate_exp gesetzt; zwei Tabs -> genau ein Aufruf (Riegel); hidden -> ausgesetzt, visible -> genau ein Nachhol-Aufruf (D-08)"
    requirement: D-08
    verification:
      - kind: unit
        ref: "ad-hoc vm-Probe gegen den echten Quelltext von assets/account-lite.js (node:vm, Fake-DOM/localStorage/fetch) -- 5/5 Pruefpunkte bestanden, siehe Ausfuehrungs-Log dieser Sitzung (Skript nicht committet, reine Verifikation)"
        status: pass
    human_judgment: false
  - id: D8
    description: "npm run build && npm run gate gruen (18/18), sowohl normal als auch mit STAGING=1 (CLAUDE.md-Pflicht fuer Tor-Aenderungen)"
    requirement: D-04
    verification:
      - kind: integration
        ref: "lokal: npm.cmd run build && npm.cmd run gate -- 18/18 gruen, normal UND mit STAGING=1 (zwei vollstaendige Laeufe, nach allen drei Aufgaben)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Alle 18 bestehenden Zusicherungen aus Plan 01 (Redirects, Ausnahmeliste, Mint-Erfolgspfad, Signatur/Ablauf, fail-closed, Live-Bau unveraendert) bleiben gruen, nachdem mint() umgestellt wurde"
    requirement: D-04
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32133474158 -- alle bestehenden Schritte aus probe-gate-e2e.yml (Plan 01) unveraendert gruen, 0 FEHLER ueber alle Zusicherungs-Schritte"
        status: pass
    human_judgment: false

duration: ~2h30min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 08: Aus dem Admin-Weg wird das echte Tor Summary

**`nginx/gate.js` urteilt jetzt ueber `gate_verdict()` statt eines direkten `user_roles`-Blicks — Testpiloten kommen durch, die Sperrliste schlaegt jede Rolle, eine Supabase-Stoerung entwertet keinen laufenden Ausweis und gibt keinen neuen aus; die Ausnahmeliste ist gemessen statt geraten, und der Ausweis erneuert sich still im Hintergrund. Alle bestehenden UND neuen Zusicherungen gegen den echten Container gruen (GitHub Actions run 32133474158).**

## Performance

- **Duration:** ~2h30min
- **Completed:** 2026-08-18
- **Tasks:** 3 (Aufgabe 1: gate_verdict()-Urteil; Aufgabe 2: gemessene Ausnahmeliste; Aufgabe 3: stille Erneuerung)
- **Files modified:** 4 (3 aus dem Plan, plus die CI-Sonde als Verifikationsinfrastruktur — ausdruecklich im Ausfuehrungsauftrag als "extend it, do not rebuild it" vorgesehen)

## Accomplishments

- `nginx/gate.js`s `mint()` ruft genau EINMAL `POST /rest/v1/rpc/gate_verdict` auf statt `GET /rest/v1/user_roles` — derselbe Codepfad traegt jetzt den Admin-Kurzschluss (D-04), die Testpilot-Rolle (D-03), die Sperrliste vor jeder Rolle (D-10) und die Fortschreibung von `last_staging_seen` (D-13), ohne dass `check()` einen einzigen Netzaufruf je Seitenaufruf bekommt (D-08).
- D-09s Ausfallverhalten ist nicht nur behauptet, sondern gegen einen echten Container mit einer nicht gerouteten Adresse gemessen: ein gueltiges Cookie kommt weiter durch, ein neues Ausstellen scheitert innerhalb von 5 Sekunden mit 503 — kein Haengen, kein Ausweis aus einem unklaren Ausgang.
- Die Ausnahmeliste in `nginx/default.conf` ist von einer Saat zu sieben gemessenen, je begruendeten Eintraegen geworden (`# GATE-AUSNAHME: <pfad> — <anlass>`), gegen einen echten Browser-Mitschnitt von `/gate.html` ohne Cookie abgeglichen — kein Eintrag zu viel, keiner zu wenig.
- `assets/account-lite.js` erneuert den Ausweis still im Hintergrund: 60 Sekunden vor dem im Cookie genannten Ablauf, mit demselben Riegel wie die bestehende Sitzungs-Erneuerung, ausgesetzt waehrend der Tab versteckt ist und genau einmal nachgeholt beim Zurueckkommen.
- Die CI-Sonde aus Plan 01 (die einzige Moeglichkeit, gegen einen laufenden Container zu pruefen — Docker ist auf diesem Rechner nicht verfuegbar) wurde erweitert, nicht neu gebaut: neue Zusicherungen fuer alle vier `gate_verdict()`-Antwortformen und ein fuenfter Container fuer die D-09-Ausfallsimulation. Lauf [32133474158](https://github.com/cibakhun/sc-patch-archive/actions/runs/32133474158): alle bestehenden UND alle neuen Zusicherungen gruen.

## Task Commits

1. **Aufgabe 1: Das echte Urteil — Testpiloten, Sperrliste, Ausfallverhalten** — `16a91dd` (feat)
2. **Aufgabe 2: Die Ausnahmeliste aufzaehlen und begruenden** — `2c5346f` (feat)
3. **Aufgabe 3: Stille Erneuerung — die kurze Laufzeit wird unsichtbar** — `162c15a` (feat)
4. **CI-Sonde erweitert (Verifikationsinfrastruktur, kein Plan-Task)** — `d675734` (test)

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

## Files Created/Modified

- `nginx/gate.js` — `mint()` auf `rpc/gate_verdict` umgestellt; 5s-Zeitueberlauf per `Promise.race`/`setTimeout`; jede Antwort ausser `allowed:true` fuehrt zu 503/403, nie zu einem Ausweis; Kopfkommentar dokumentiert explizit, warum das D-09 erfuellt
- `nginx/default.conf` — 7 `# GATE-AUSNAHME:`-Zeilen (flush-links, maschinenlesbar fuer Plan 09), gemessen gegen einen echten Browser-Mitschnitt
- `assets/account-lite.js` — stille Erneuerung ueber `vb_gate_exp`, `mintGatePass()` mit ok/locked/failed-Unterscheidung, `visibilitychange`-Aussetzen/Nachholen
- `.github/workflows/probe-gate-e2e.yml` — Mock-PostgREST antwortet jetzt je nach `Authorization`-Kopfzeile mit vier `gate_verdict()`-Antwortformen; fuenfter Container fuer die D-09-Ausfallsimulation; Pfadfilter um `assets/**` ergaenzt (account-lite.js wird jetzt in den Docker-Build hineingebaut)

## Decisions Made

Siehe `key-decisions` im Frontmatter — Kurzfassung: 401/403 von PostgREST wird als echte Ablehnung (403) von jedem anderen unklaren Ausgang (503, D-09) unterschieden; `mintGatePass()` unterscheidet einen bloss verzoegerten (`locked`, Tab-Riegel) von einem echten Fehlschlag (`failed`, keine weiteren Versuche); die vier `gate_verdict()`-Antwortformen werden ueber einen erweiterten Mock getestet, nicht gegen echte Testkonten (kein Repo-Secret vorhanden, keins spekulativ angelegt).

## Deviations from Plan

### Auto-fixed Issues

Keine Bugs im eigentlichen Sinn. Eine implementierungsseitige Ergaenzung ueber den Wortlaut des Plans hinaus, dokumentiert statt stillschweigend eingebaut:

**1. [Rule 2 - fehlende Robustheit] `mintGatePass()` mit drei statt zwei Zustaenden**

- **Found during:** Aufgabe 3, beim Entwurf des Tab-Riegels
- **Issue:** Der Plan verlangt "denselben Riegel wie `ensureSession()`" UND "schlaegt das Ausstellen fehl, nicht weiterprobieren". Eine einfache ok/failed-Unterscheidung haette beide Vorgaben woertlich erfuellt, aber einen durch den Riegel BLOCKIERTEN Tab (weil ein anderer Tab gerade ausstellt — kein echter Fehler) dauerhaft ohne eigenen Erneuerungs-Zeitplan zurueckgelassen: dieser Tab haette dann nie wieder von selbst erneuert, bis zum naechsten vollen Seitenaufruf.
- **Fix:** dritter Zustand `'locked'` fuehrt zu einem kurzen Nachpruef-Versuch (2s) statt zu endgueltiger Aufgabe; nur ein ECHTER Fehlschlag (`'failed'` — kein Token, 401/403/503, Netzfehler) stoppt die Erneuerung fuer diesen Zyklus, exakt wie der Plan es fuer den Fehlerfall verlangt.
- **Files modified:** `assets/account-lite.js`
- **Verification:** vm-Probe "Zwei Tabs, derselbe Riegel -> genau EIN Mint-Aufruf" bestanden
- **Committed in:** `162c15a`

---

**Total deviations:** 1 (Rule 2, robustness ergaenzt, kein Bug)
**Impact on plan:** Kein Scope-Creep — die Ergaenzung bleibt innerhalb von Aufgabe 3s eigener Datei und Zielsetzung, macht das explizit verlangte Verhalten (kein Doppelt-Ausstellen, kein Weiterprobieren bei echtem Fehler) robuster gegen eine Randbedingung, die der Plan nicht ausdruecklich behandelt.

## Known Stubs

Keine.

## Threat Flags

Keine neuen — alle in `<threat_model>` des Plans genannten Bedrohungen (T-14-48 bis T-14-55) sind durch die Umsetzung dieses Plans selbst adressiert, nicht neu aufgerissen.

## Issues Encountered

- **Docker ist auf diesem Rechner weiterhin nicht verfuegbar** (wie in 14-01-SUMMARY.md dokumentiert) — jede Pruefung gegen einen laufenden Container lief ueber die erweiterte CI-Sonde, nicht lokal. Lauf [32133474158](https://github.com/cibakhun/sc-patch-archive/actions/runs/32133474158) ist vollstaendig gruen.
- **Keine echten Supabase-Testkonten mit is_tester/admin/tester_blocklist-Zustand verfuegbar** — die vier `gate_verdict()`-Antwortformen sind gegen einen erweiterten Mock-PostgREST gepruft (gate.js' eigene Antwort-Verarbeitung, vollstaendig), nicht gegen die tatsaechliche SQL-Reihenfolge in der lebenden Datenbank. Diese Grenze ist im Kopfkommentar der CI-Sonde selbst benannt und deckt sich mit denselben offenen Punkten aus 14-01-SUMMARY.md (coverage D7) und 14-02-SUMMARY.md (coverage D4-D6) — alle fuer dieselbe Sichtrunde des Betreibers vorgesehen, sobald ein Testkonto verfuegbar ist.
- **Der rote Lauf fuer die theme.css-Ausnahme ist eine Nachbildung, kein Originalbefund** — ohne lokales nginx wurde das dokumentierte Redirect-Verhalten (HTML statt CSS, vom Browser wegen MIME-Pruefung verworfen) mit `playwright-core`-Routenabfangen nachgestellt, nicht ein echter Config-Entfernen-und-neu-Bauen-Zyklus gegen einen laufenden Container gefahren. Das Ergebnis (vier kollabierende Kennzahlen: Schriftgroesse, Buchstabenabstand, Knopftextfarbe) ist eindeutig, aber methodisch eine Simulation.

## User Setup Required

None — diese Aufgabe braucht keine neuen Umgebungsvariablen. Die drei `VB_GATE_SECRET`/`VB_SUPABASE_URL`/`VB_SUPABASE_ANON_KEY`-Variablen aus Plan 01 (noch nicht in Coolify gesetzt, siehe 14-01-SUMMARY.md) bleiben Voraussetzung dafuer, dass der Tuersteher auf der tatsaechlichen Vorschau-Umgebung ueberhaupt greift — unveraendert durch diesen Plan.

## Next Phase Readiness

- Der Tuersteher ist inhaltlich fertig: Testpilot, Sperrliste, Admin, Ausfallverhalten, Ausnahmeliste und stille Erneuerung sind alle implementiert und maschinell gegen den echten Container gepruft.
- Plan 09 kann die Ausnahmeliste jetzt einfrieren (`scripts/verify-gate.mjs`) — das Format `# GATE-AUSNAHME: <pfad> — <anlass>` ist stabil und maschinenlesbar, 7 Eintraege stehen.
- **Offener Punkt fuer die Sichtrunde des Betreibers** (nicht Blocker fuer die naechste Planaufgabe, aber vor dem Phasenabschluss nachzuholen): die vier `gate_verdict()`-Antwortformen und `last_staging_seen` gegen ein ECHTES Testkonto (is_tester/admin/tester_blocklist) verifizieren, sobald eins existiert — deckt sich mit den bereits offenen Punkten aus Plan 01/02.
- Kein Blocker fuer die Fortsetzung der Phase.

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

Alle 5 Artefaktdateien gefunden (`nginx/gate.js`, `nginx/default.conf`, `assets/account-lite.js`, `.github/workflows/probe-gate-e2e.yml`, diese SUMMARY.md). Alle 4 zitierten Commit-Hashes (`16a91dd`, `2c5346f`, `162c15a`, `d675734`) im Verlauf des Zweigs `claude/staging-tester-role-access-308ebf` gefunden. `npm run build && npm run gate` zuletzt gruen (18/18, Schiene A) sowohl normal als auch mit `STAGING=1`. GitHub-Actions-Lauf [32133474158](https://github.com/cibakhun/sc-patch-archive/actions/runs/32133474158) vollstaendig gruen gegen den echten Container (alle bestehenden UND alle neuen Zusicherungen).
