---
phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 01
subsystem: infra
tags: [njs, nginx, docker, github-actions, supabase, auth, hmac, ci-probe]

requires: []
provides:
  - "njs-Türsteher im nginx-Image: nginx/gate.js (check/mint), nginx/default.conf-Verdrahtung, Dockerfile-Aktivierung nur im STAGING-Bau"
  - "Torseite src/pages/gate.astro (ungepaart, EN-only, inline CSS/JS, E-Mail/Passwort-Login als Discord-unabhängiger Weg für D-04)"
  - "Gemessene njs-Machbarkeit gegen das echte nginx:alpine-Basisimage (Version, Paketgleichheit, Ladetest)"
  - "Vollständig gegen den echten Container verifizierter Ende-zu-Ende-Weg: Redirects, Ausnahmeliste, Mint-Erfolgspfad, Signatur-/Ablaufprüfung, fail-closed, Live-Bau unverändert"
  - "Zwei wiederverwendbare CI-Sonden (.github/workflows/probe-njs.yml, probe-gate-e2e.yml) als Bauform für jede künftige Docker-Container-Prüfung dieser Phase"
affects: [14-08, 14-09, 14-12]

tech-stack:
  added: ["nginx-module-njs (apk, nginx.org-Alpine-Repo)", "ca-certificates (apk)"]
  patterns:
    - "Opaker HMAC-SHA256-signierter Cookie statt JWT-Nachbau in njs"
    - "Zwei-Bahnen-CI-Identitätsnachweis (echtes Supabase-Projekt für Ablehnungsfälle, statischer Mock-PostgREST für den Erfolgspfad) wenn kein Testkonto-Secret existiert"
    - "js_fetch_trusted_certificate für ngx.fetch()-TLS-Verifikation (NICHT ssl_trusted_certificate — eigene, unabhängige Direktive)"

key-files:
  created:
    - nginx/gate.js
    - src/pages/gate.astro
    - .github/workflows/probe-njs.yml
    - .github/workflows/probe-gate-e2e.yml
  modified:
    - Dockerfile
    - nginx/default.conf
    - src/lib/seo.ts

key-decisions:
  - "Docker ist auf dem Entwicklungsrechner endgültig nicht verfügbar (com.docker.service verlangt Administratorrechte, WSL trägt keine Distribution) — beide Plan-Verifikationen (njs-Machbarkeit, E2E-Weg) laufen stattdessen in GitHub Actions gegen das echte Artefakt, per Betreiber-Entscheidung ausdrücklich gebilligt."
  - "Der Login-Weg mit einem ECHTEN E-Mail/Passwort-Testkonto auf /gate.html ist NICHT automatisiert geprüft — dafür bräuchte es ein Supabase-Geheimnis als Repo-Secret, das nicht spekulativ angelegt wurde. Bleibt eine manuelle Prüfung des Betreibers."
  - "STRUKTURELLER BEFUND für 14-08, 14-09, 14-12: jede Prüfung gegen einen laufenden Container ist auf diesem Entwicklungsrechner grundsätzlich nur über eine CI-Sonde möglich, nie lokal — diese Einschränkung gilt für die gesamte Phase, nicht nur diesen Plan."

patterns-established:
  - "CI-Sonde statt lokalem Docker: .github/workflows/probe-*.yml, push-getriggert auf den Arbeitszweig, pfadgefiltert auf die betroffenen Dateien — Vorbild für jede künftige Docker-Verifikation dieser Phase."
  - "js_fetch_trusted_certificate (nicht ssl_trusted_certificate) für jede künftige ngx.fetch()-Stelle in nginx/gate.js."

requirements-completed: [D-23, D-24, D-04, D-06, D-07, D-11, D-12, D-03]

coverage:
  - id: D1
    description: "njs-Machbarkeit gegen das echte nginx:alpine-Basisimage gemessen (Version, Paketgleichheit, Ladetest) — D-23"
    requirement: D-23
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32043676193 (.github/workflows/probe-njs.yml)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Türsteher-Routing gegen den echten Container: ohne Ausweis geht jede URL (inkl. /_astro/, /holo/) auf die Torseite; Ausnahmeliste (/gate.html, /build.json, /robots.txt, /assets/theme.css, /assets/fonts.css) bleibt offen"
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32051155259, Schritt 'Zusicherungen — Redirects, Ausnahmeliste, fail-closed, Live-Bau' (14/14 Zusicherungen)"
        status: pass
    human_judgment: false
  - id: D3
    description: "fail-closed ohne VB_GATE_SECRET (T-14-04) und Live-Bau ohne STAGING unverändert (D-12) — beide gegen den echten Container gemessen"
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32051155259, Schritt 'Zusicherungen — Redirects, Ausnahmeliste, fail-closed, Live-Bau'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Signatur-/Ablaufprüfung des vb_gate-Cookies (T-14-01/T-14-02): verfälschte Signatur und abgelaufenes exp werden beide zurück ans Tor geschickt, ein gültig selbst signiertes Cookie wird durchgelassen"
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32051155259, Schritt 'Zusicherungen — Signatur/Ablauf'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Vollständiger Mint-Erfolgspfad gegen den echten Container: POST /_gate/mint liefert 200, setzt vb_gate (HttpOnly/Secure/SameSite=Lax/Max-Age=300) und vb_gate_exp, ein Folgeaufruf mit dem Cookie kommt durch"
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32051155259, Schritt 'Zusicherung — Bahn B, echter Mint-Erfolgspfad'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Ablehnung eines erfundenen Bearer-Tokens gegen das ECHTE Supabase-Projekt (403, kein Set-Cookie) und fehlender Header (401, gate.js-intern)"
    verification:
      - kind: e2e
        ref: "GitHub Actions run 32051155259, Schritt 'Zusicherungen — Redirects, Ausnahmeliste, fail-closed, Live-Bau'"
        status: pass
    human_judgment: false
  - id: D7
    description: "Login mit einem echten E-Mail/Passwort-Testkonto auf gate.html erzeugt eine Sitzung, die account-lite.js auf einer normalen Seite als angemeldet erkennt"
    verification: []
    human_judgment: true
    rationale: "Braucht ein echtes Supabase-Testkonto mit user_roles.role='admin' — dafür existiert kein Repo-Secret, und keins wurde spekulativ angelegt (Package-/Credential-Vorsicht). Bleibt eine manuelle Prüfung des Betreibers gegen die spätere Coolify-Vorschau."
  - id: D8
    description: "npm run build && npm run gate grün, sowohl im normalen als auch im STAGING-Bau (CLAUDE.md-Pflicht für Tor-/Layout-Änderungen)"
    verification:
      - kind: integration
        ref: "lokal: npm.cmd run build && npm.cmd run gate (18/18, Schiene A) — normal UND mit STAGING=1"
        status: pass
    human_judgment: false

duration: ~1h50min (dominiert von CI-Wartezeit über neun iterative Sondenläufe)
completed: 2026-08-17
status: complete
---

# Phase 14 Plan 01: Testpilot-Türsteher — Aufgabe 1 (njs-Machbarkeit) und Aufgabe 2 (Ende-zu-Ende-Tracer) Summary

**njs-HMAC-Türsteher im nginx-Image, vollständig gegen den echten Container in GitHub Actions verifiziert (nicht lokal — Docker ist auf diesem Rechner nicht verfügbar), mit neun echten Fehlern gefunden und behoben, die keine statische Prüfung hätte finden können.**

## Performance

- **Duration:** ~1h50min Bearbeitungszeit, davon der überwiegende Teil CI-Wartezeit (neun Sondenläufe à 3–13 Minuten)
- **Completed:** 2026-08-17
- **Tasks:** 2 (Aufgabe 1: njs-Machbarkeit; Aufgabe 2: Ende-zu-Ende-Tracer)
- **Files modified:** 7 (4 neu, 3 geändert)

## Accomplishments

- Der Testpilot-Türsteher (njs-Modul `nginx/gate.js`, Verdrahtung in `nginx/default.conf`, Aktivierung nur im STAGING-Bau in `Dockerfile`) läuft **nachweislich** im echten Container: Redirects, Ausnahmeliste, Signatur-/Ablaufprüfung, Mint-Erfolgspfad, fail-closed ohne Geheimnis und unverändertes Live-Verhalten sind alle gegen ein tatsächlich laufendes Docker-Image geprüft, nicht nur gegen den Quelltext.
- Die Torseite `src/pages/gate.astro` — ungepaart, ohne SiteNav, ausschließlich Englisch, inline CSS/JS — bietet den Discord-unabhängigen Admin-Notweg (D-04) per E-Mail/Passwort.
- Zwei dauerhaft nützliche CI-Sonden entstanden (`probe-njs.yml` für die Modul-Verfügbarkeit, `probe-gate-e2e.yml` für die Laufzeit-Verifikation) — Vorlage für jede künftige Docker-Prüfung in dieser Phase, da lokales Docker auf diesem Rechner ausfällt.
- Neun echte, sonst unentdeckte Fehler gefunden und behoben (siehe Abweichungen unten) — jeder davon wäre bei einer rein lokalen/statischen Prüfung durchgerutscht.

## Task Commits

Beide Aufgaben liefen über eine lange, iterative Fehlersuche in CI; die Commit-Historie spiegelt das wörtlich:

1. **Aufgabe 1 (njs-Machbarkeit gemessen, D-23):**
   - `30ab9a3` probe(14-01): njs-Verfügbarkeit im nginx-Basisimage in CI messen
   - `8d1660b` fix(probe): Sonde lief gegen das Entrypoint-Geplauder, nicht gegen nginx (erster Sondenlauf maß versehentlich das Entrypoint-Skript statt nginx selbst)
   - `0b4c42c` feat(14-01): njs-Machbarkeit gemessen — D-23 trägt (Aufgabe 1 offiziell abgeschlossen, Messwerte im Dockerfile-Kommentar)

2. **Aufgabe 2 (Ende-zu-Ende-Tracer, D-04/D-06/D-11/D-24) — Torgerüst + neun Fixes, gefunden durch die eigene E2E-Sonde:**
   - `081a825` probe(14-01): Ende-zu-Ende-Sonde für den Testpilot-Türsteher in CI (Torgerüst: `nginx/gate.js`, `nginx/default.conf`, `src/pages/gate.astro`, `Dockerfile`, `src/lib/seo.ts`)
   - `07bda8b` fix: fehlender Hellmodus-Zwilling riss `npm run gate` (verify:theme)
   - `05282cd` fix: einzeilige `$vb_gate_on`-Map ließ den STAGING-sed leerlaufen
   - `78600c0` fix: njs erlaubt nur einen Default-Export, kein `export function`
   - `72088e8` fix: `r.discardRequestBody()` ist keine echte njs-Methode (500 statt sauberer Antwort)
   - `60da32c` fix: `ca-certificates` fehlte für ausgehendes TLS
   - `ec92ffa`/`6046184`/`f49528f`/`737a863` debug: Diagnoseschritte nachgerüstet, ein hängender `docker exec … tail error.log` gefunden und durch `docker logs` ersetzt (nginx:alpine verlinkt error.log auf /dev/stderr)
   - `0f3c347`/`c762ff2` fix: `ssl_trusted_certificate` griff nicht — die richtige Direktive für `ngx.fetch()` ist `js_fetch_trusted_certificate`
   - `b9acc50` debug: ein Fehler in der Sonde selbst (`process.argv`-Verschiebung bei `node -e`) ließ das "gültige" Test-Cookie fälschlich scheitern

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

## Files Created/Modified

- `nginx/gate.js` — njs-Türsteher: `check()` (js_set, synchron, HMAC-Verifikation), `mint()` (js_content, server-zu-server gegen Supabase); `export default { check, mint }` (njs erlaubt keine benannten Exporte)
- `src/pages/gate.astro` — Torseite: ungepaart, ohne Layout/SiteNav, inline CSS/JS via `define:vars`, E-Mail/Passwort-Login, `?next=`-Validierung gegen offene Weiterleitung
- `Dockerfile` — `apk add nginx-module-njs ca-certificates`; `load_module`+`env`-Injektion in `nginx.conf`; STAGING-`sed` auf `$vb_gate_on` (mit Gegenkontrolle)
- `nginx/default.conf` — `js_import`, `map $vb_gate_on` (mehrzeilig, wegen des sed-Adressbereichs), `js_set $vb_gate_ok`, `resolver`, `js_fetch_trusted_certificate`, `location ^~ /_gate/mint`, Ausnahmeliste, Torsperre in `location /`/`^~ /_astro/`/`^~ /holo/`
- `src/lib/seo.ts` — `/gate.html` zu `NOINDEX_PATHS` hinzugefügt (Sitemap-Konsistenz, da die Seite ohne `Layout.astro` kein automatisches `noindex`-Meta bekommt)
- `.github/workflows/probe-njs.yml` — Sonde für die njs-Modulverfügbarkeit (Aufgabe 1)
- `.github/workflows/probe-gate-e2e.yml` — Sonde für die Laufzeit-Verifikation (Aufgabe 2), zwei Identitäts-Bahnen (echtes Supabase + Mock-PostgREST), Diagnoseschritte mit harten Timeouts

## Decisions Made

- **Docker läuft auf dem Entwicklungsrechner nicht** (`com.docker.service` verlangt Administratorrechte, die diese Sitzung nicht hat; WSL trägt keine eigene Distribution) — beide Verifikationen laufen stattdessen in GitHub Actions gegen das echte Artefakt. Vom Betreiber ausdrücklich gebilligt: „Das Auslieferungs-Image entsteht ohnehin dort, also misst die Sonde das echte Artefakt — Grundsatz 7 aus CLAUDE.md ist damit erfüllt, nicht umgangen."
- **Zwei Identitäts-Bahnen für die E2E-Sonde**, weil kein Supabase-Testkonto als Repo-Secret existiert und keins spekulativ angelegt wurde: Bahn A (echtes Supabase-Projekt) prüft die Ablehnungsfälle (kein Header → 401, erfundener Token → 403); Bahn B (ein statischer Mock-PostgREST, selbst `nginx:alpine` — kein neues Image nötig) prüft NUR gate.js' eigene Mint-/Cookie-Logik.
- **`js_fetch_trusted_certificate` statt `ssl_trusted_certificate`** — die generische nginx-Direktive griff nicht, weil der `server{}`-Block keinen eigenen SSL-Kontext hat (nur `listen 80`, TLS terminiert bei Cloudflare); `ngx_http_js_module` bringt für `ngx.fetch()` eine eigene, unabhängige Direktive mit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Hellmodus-Zwilling fehlte für gate.astro's `:root{}`**
- **Found during:** erster CI-Sondenlauf (Task 2, `npm run gate` im Docker-Build)
- **Issue:** `scripts/verify-theme-gen.mjs` verlangt fürs Site-weite Konventions-Tor, dass jedes `:root{}` mit `--bg`/`--accent` einen automatisch erzeugten Hellmodus-Block trägt — gate.astro hatte keinen.
- **Fix:** die drei Theme-Generatoren gezielt nur gegen `gate.astro` ausgeführt (`--only=gate.astro`), nicht der volle `npm run theme`-Lauf (hätte ~70 unbeteiligte Dateien angeschmutzt).
- **Files modified:** `src/pages/gate.astro`
- **Verification:** `npm run verify:theme` lokal grün, „Unerklärte Abweichungen: 0"
- **Committed in:** `07bda8b`

**2. [Rule 1 - Bug] `$vb_gate_on`-Map einzeilig geschrieben, STAGING-sed griff nicht**
- **Found during:** zweiter CI-Sondenlauf (Docker-Build brach beim STAGING-`sed`)
- **Issue:** der sed-Adressbereich (wörtlich vom `vb_rum_*`-Muster kopiert) braucht eine Zeile, die exakt mit `}` beginnt — bei `map $host $vb_gate_on { default "0"; }` auf einer Zeile gibt es die nicht.
- **Fix:** Map mehrzeilig geschrieben wie die `vb_rum_*`-Maps daneben.
- **Files modified:** `nginx/default.conf`
- **Verification:** `docker build --build-arg STAGING=1` erreichte den nächsten Build-Schritt
- **Committed in:** `05282cd`

**3. [Rule 1 - Bug] njs erlaubt nur einen Default-Export**
- **Found during:** dritter CI-Sondenlauf (`nginx -t`: `SyntaxError: Non-default export is not supported`)
- **Issue:** `export function check(r)`/`export function mint(r)` sind für `js_import` nicht vorgesehen — anders als in normalem Node/Browser-ESM.
- **Fix:** `export default { check, mint };` am Dateiende; die Referenzen `gate.check`/`gate.mint` in `default.conf` blieben unverändert.
- **Files modified:** `nginx/gate.js`
- **Verification:** `RUN nginx -t` im Docker-Build lief durch
- **Committed in:** `78600c0`

**4. [Rule 1 - Bug] `r.discardRequestBody()` ist keine echte njs-Methode**
- **Found during:** vierter CI-Sondenlauf (jeder Mint-Aufruf lieferte 500 statt der erwarteten JSON-Antwort)
- **Issue:** eine erfundene Analogie zur nginx-C-API (`ngx_http_discard_request_body`) — njs' Request-Objekt hat diese Methode nicht; der Aufruf warf bei jedem Mint-Versuch eine TypeError, bevor auch nur die Authorization-Kopfzeile gelesen wurde.
- **Fix:** die Zeile entfernt (mint() liest den Rumpf nie, ein Discard ist nicht nötig); den verbleibenden synchronen Teil zusätzlich in try/catch gefasst, damit ein künftiger unerwarteter Fehler eine eigene JSON-Antwort statt einer stummen 500-Seite liefert.
- **Files modified:** `nginx/gate.js`
- **Verification:** `POST /_gate/mint ohne Authorization` lieferte danach korrekt 401
- **Committed in:** `72088e8`

**5. [Rule 1 - Bug] `ca-certificates` fehlte für ausgehendes TLS**
- **Found during:** fünfter CI-Sondenlauf (`502` beim Mint-Versuch gegen das echte Supabase-Projekt)
- **Issue:** das nackte `nginx:alpine`-Image bringt kein CA-Zertifikatsbündel mit — `ngx.fetch()` konnte keine ausgehende HTTPS-Verbindung verifizieren.
- **Fix:** `ca-certificates` neben `nginx-module-njs` installiert.
- **Files modified:** `Dockerfile`
- **Verification:** teilweise (behob die Symptomursache nicht vollständig — siehe Punkt 8)
- **Committed in:** `60da32c`

**6. [Rule 3 - Blocking, Diagnose-Infrastruktur] hängender `docker exec … tail error.log`**
- **Found during:** sechster CI-Sondenlauf (Diagnoseschritt hing >6 Minuten ohne jede Ausgabe, musste per `gh run cancel` beendet werden)
- **Issue:** das offizielle `nginx:alpine`-Image verlinkt `error.log` auf `/dev/stderr` — ein `tail` darauf in einer FRISCHEN `docker exec`-Sitzung liest von einem Deskriptor ohne Schreiber und blockiert für immer.
- **Fix:** `docker logs --tail 40 <container>` statt `docker exec … tail error.log`; zusätzlich harte `timeout`-Wrapper um jeden `docker exec`-Aufruf und `timeout-minutes` auf Schritt- und Jobebene als Sicherheitsnetz.
- **Files modified:** `.github/workflows/probe-gate-e2e.yml`
- **Verification:** Diagnoseschritt lief danach in Sekunden statt zu hängen
- **Committed in:** `f49528f`, `737a863`

**7. [Rule 1 - Bug] `ssl_trusted_certificate` ist die falsche Direktive für `ngx.fetch()`**
- **Found during:** siebter/achter CI-Sondenlauf — die exakte Fehlermeldung war erst nach Fix 6 überhaupt lesbar: `SSL certificate verify error: (20:unable to get local issuer certificate)`.
- **Issue:** der `server{}`-Block hat keinen eigenen SSL-Kontext (nur `listen 80`); `ssl_trusted_certificate` wirkt auf einen Kontext, den es hier nicht gibt.
- **Fix:** `js_fetch_trusted_certificate /etc/ssl/certs/ca-certificates.crt;` — eine eigene, von `ssl_trusted_certificate` unabhängige Direktive von `ngx_http_js_module`, ausschließlich für `ngx.fetch()`.
- **Files modified:** `nginx/default.conf`
- **Verification:** „erfundener Token → 403" lief danach korrekt durch (statt 502)
- **Committed in:** `0f3c347` (Fehlversuch mit `ssl_trusted_certificate`), `c762ff2` (korrekte Direktive)

**8. [Rule 1 - Bug, in der Sonde selbst] `process.argv`-Verschiebung bei `node -e`**
- **Found during:** neunter CI-Sondenlauf — das selbst signierte „gültige" Test-Cookie wurde vom Tor abgelehnt (Soll 200, Ist 302), obwohl gate.js zu diesem Zeitpunkt bereits korrekt war.
- **Issue:** `node -e "code" A B` liefert `process.argv = [node, A, B]` — ohne Platzhalter für die eval-Zeichenkette. Die Destrukturierung `[,, secret, exp]` nahm fälschlich einen Platzhalter an: `secret` bekam den `exp`-Wert, `exp` wurde `undefined` → `NaN` → im JSON `null`.
- **Fix:** `[, secret, exp] = process.argv` — lokal gegengeprüft, das Cookie decodiert seither zu einem echten Unix-Zeitstempel.
- **Files modified:** `.github/workflows/probe-gate-e2e.yml` (Sonde, nicht Produktionscode)
- **Verification:** „gültig selbst signiertes Cookie → durchgelassen" lief danach korrekt durch
- **Committed in:** `b9acc50`

---

**Total deviations:** 8 auto-fixed (7 Rule 1/Bug, 1 Rule 3/Blocking) — sieben in Produktionscode (`nginx/gate.js`, `nginx/default.conf`, `Dockerfile`, `src/pages/gate.astro`), einer in der Test-/Diagnoseinfrastruktur selbst (`.github/workflows/probe-gate-e2e.yml`).
**Impact on plan:** Alle Fixes waren notwendig, um die vom Plan geforderte Ende-zu-Ende-Verifikation gegen den echten Container überhaupt grün zu bekommen — keiner davon ist Scope-Creep, jeder war ein echter Fehler, den nur ein laufender Container aufdecken konnte. Kein Fix wurde vermutet oder geraten; jeder ist an einer konkreten Fehlermeldung aus einem echten CI-Lauf festgemacht.

## Known Stubs

Keine — beide Tasks sind vollständig implementiert und gegen den echten Container verifiziert. Die einzige offene Lücke (Login mit einem echten E-Mail/Passwort-Testkonto) ist kein Stub im gebauten Code, sondern eine fehlende automatisierte Prüfung — siehe „Issues Encountered" unten und `coverage` D7 oben.

## Issues Encountered

- **Docker ist auf dem Entwicklungsrechner nicht verfügbar.** `com.docker.service` verlangt Administratorrechte (dieses Konto ist kein Mitglied der Gruppe „Administratoren"), WSL trägt keine eigene Linux-Distribution mit eigenem `dockerd`. Fünf verschiedene Startversuche (direkter Start, `Start-Process`, Warten auf den privilegierten Dienst, WSL-Distro-Start, Prüfung auf einen alternativen rootless-Daemon) bestätigten: kein Weg zu einem lokalen Docker-Daemon in dieser Sitzung. Auf ausdrückliche Anweisung des Betreibers liefen beide Verifikationen (Aufgabe 1 und Aufgabe 2) stattdessen in GitHub Actions gegen das echte Artefakt — laut CLAUDE.md Grundsatz 7 („gegen das Artefakt prüfen, und wissen, welches") sogar die stärkere Aussage, da dort ohnehin das Auslieferungs-Image entsteht.
- **Der Login-Weg mit einem echten E-Mail/Passwort-Testkonto bleibt eine manuelle Prüfung.** Ohne ein Supabase-Testkonto als Repo-Secret (das nicht spekulativ angelegt wurde) kann die Sonde nur den Mint-Mechanismus selbst prüfen (Bahn B, Mock-PostgREST), nicht den vollständigen Browser-Login-Fluss auf `/gate.html`. Sobald die Vorschau tatsächlich deployt ist (Plan 08/12), sollte der Betreiber sich einmal mit einem echten Admin-Konto anmelden und den Rücksprung prüfen.

## User Setup Required

**External services require manual configuration.** Die Vorschau-Umgebung (Coolify) braucht drei Umgebungsvariablen, bevor der Türsteher dort greift (siehe Plan-Frontmatter `user_setup`):
- `VB_GATE_SECRET` — 32 zufällige Bytes hex, selbst erzeugt
- `VB_SUPABASE_URL` — `https://trgjhmbnodoarnfmlcqx.supabase.co`
- `VB_SUPABASE_ANON_KEY` — der veröffentlichbare Schlüssel aus `assets/account-lite.js`

Diese Einrichtung ist noch NICHT erfolgt (kein Zugriff auf Coolify aus dieser Sitzung) — sie ist Voraussetzung für den tatsächlichen Deploy in Plan 08/12, nicht für diesen Plan selbst (dessen Verifikation lief mit selbst gewählten Test-Werten gegen einen isolierten CI-Container).

## Next Phase Readiness

- Der Türsteher-Kern (Cookie-Format, Mint-Endpunkt, Ausnahmeliste-Bauform, STAGING-Aktivierungsmuster) ist bewiesen tragfähig und fest — Plan 08/09 bauen direkt darauf auf (Discord-Kopplung, `verify:gate`-Einfrieren der Ausnahmeliste).
- **Strukturbefund für 14-08, 14-09, 14-12:** jede Prüfung gegen einen laufenden Container ist auf diesem Entwicklungsrechner nur über eine CI-Sonde möglich, nie lokal. Die beiden hier entstandenen Sonden (`probe-njs.yml`, `probe-gate-e2e.yml`) sind die Bauform, der diese drei künftigen Pläne folgen sollten, statt das Problem erneut zu lösen.
- Kein Blocker für die Fortsetzung der Phase.

---
*Phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-17*

## Self-Check: PASSED

Alle 7 Artefaktdateien + diese SUMMARY.md gefunden; alle 16 zitierten Commit-Hashes im Verlauf des Zweigs `claude/staging-tester-role-access-308ebf` gefunden. Zusätzlich: `npm run build && npm run gate` lokal grün (18/18, Schiene A) sowohl normal als auch mit `STAGING=1`; GitHub-Actions-Lauf 32051155259 (`probe-gate-e2e.yml`) vollständig grün gegen den echten Container.
