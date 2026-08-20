---
phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle
reviewed: 2026-08-18T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - nginx/gate.js
  - nginx/default.conf
  - Dockerfile
  - supabase/migrations/20260818000000_discord_tester_gate.sql
  - supabase/migrations/20260818001000_gate_verdict.sql
  - supabase/migrations/20260818002000_block_discord_signup.sql
  - src/pages/gate.astro
  - src/components/account/AuthLogin.astro
  - assets/account-lite.js
  - discord/bot/src/role-sync.mjs
  - discord/bot/src/role-reconcile.mjs
  - scripts/verify-gate.mjs
  - scripts/check-gate.mjs
  - .github/workflows/deploy-staging.yml
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
fixed_at: 2026-08-18T19:30:00Z
fix_status: fixed_ci_proven_cr01_pending_deploy
fixes:
  - id: CR-01
    status: fixed
    commit: 5af641d
    proof: "menschliche Bestaetigung gegen die lebende Anlage aussteht -- braucht deployten Bot, siehe WINDOWS.md ids 21/22"
  - id: CR-02
    status: fixed
    commit: 98d4526
    proof: "CI-Lauf 32165782075 (probe-gate-e2e.yml, Zweig claude/staging-tester-role-access-308ebf) -- gruen, echter njs-Container"
  - id: WR-01
    status: fixed
    commit: e8cda21
    proof: "CI-Lauf 32165782075, Schritt 'Zusicherungen — CI-Rauchtest-Bypass gegen den echten njs-Container (CR-02/WR-01)': 3/3 Zusicherungen bestanden (200/302/302), FEHLER: 0"
  - id: WR-02
    status: fixed
    commit: 138b86c
    proof: "node --check + npm run gate (19/19), kein weiterer Nachweis noetig"
  - id: IN-01
    status: not_fixed
    reason: "Optional, geringe Prioritaet lt. Fix-Vorschlag -- kein Blocker fuer den Rollout, nicht Teil dieses Fix-Auftrags (nur CR-01, CR-02, WR-01, WR-02 in Scope)."
---

# Phase 14: Code Review Report — Testpilot-Zugang (Discord-Rolle hinter staging)

**Reviewed:** 2026-08-18
**Depth:** deep (Cross-File-Analyse über nginx/njs, Postgres-Migrationen, Discord-Bot und CI)
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Das Gesamtbild ist ungewöhnlich sorgfältig: fail-closed-Pfade in `nginx/gate.js` sind konsequent durchgezogen, die Sperrliste schlägt in `gate_verdict()` nachweislich vor jeder Rolle, `handle_new_user()` bleibt trotz `SET search_path TO ''` korrekt (alle Referenzen sind qualifiziert, `pg_catalog` ist immer implizit durchsucht), und der bereits einmal gefundene `ON CONFLICT`-Bug (Deckung nur eines von zwei Unique-Indizes) wurde in der zweiten Migration korrekt vermieden — die dortige `INSERT` schreibt `discord_user_id` gar nicht mit.

Die Prüfung deckt aber zwei Befunde auf, die beide dieselbe Kategorie treffen: ein Ereignis wird verpasst, und der Mirror driftet, ohne dass ein einziges der bestehenden Tore (`verify-gate.mjs`, `check-gate.mjs`, die drei Sonden-Workflows `probe-njs.yml`/`probe-gate-e2e.yml`) das messen könnte. Beide sind funktional, keine Stilfragen — der eine sperrt vermutlich jeden neu verknüpfenden Testpiloten trotz vorhandener Rolle aus, der andere lässt die eigens für den CI-Rauchtest gebaute Umgehung (T-14-56/57/58) vermutlich nie greifen, weil sie njs nie erreicht.

## Critical Issues

### CR-01: Erste Discord-Verknüpfung mit bereits vergebener Testpilot-Rolle wird trotzdem abgewiesen

**File:** `supabase/migrations/20260818000000_discord_tester_gate.sql:253-313` (Funktion `sync_discord_identity`, insb. Zeile 273-276), zusammen mit `discord/bot/src/role-sync.mjs:54-94` (`writeIsTester`) und `discord/bot/src/role-reconcile.mjs:51-104` (`reconcileRoles`)

**Konkretes Fehlerszenario:**
1. Ein Discord-Mitglied bekommt die Rolle „Test Pilots" (Admin-Handlung im Discord-Server). `role-sync.mjs`s `GuildMemberUpdate`-Handler feuert `writeIsTester(supabase, newMember.id, true)` — der PATCH auf `discord_role_state?discord_user_id=eq.<id>` trifft **null Zeilen**, weil dieses Discord-Konto noch nie mit einem verse-base.com-Konto verknüpft wurde (`role-sync.mjs:80-86`: „Normalfall: kein verknuepftes Konto — kein Fehler"). Der Rollenzustand geht damit **verloren**, nicht nur verzögert — es gibt zu diesem Zeitpunkt gar keine Zeile, in die er geschrieben werden könnte.
2. Genau dieser Nutzer folgt danach dem in D-01/D-02 vorgesehenen, favorisierten Weg: Konto per E-Mail anlegen (oder vorhandenes nutzen) und Discord verknüpfen (`AuthLogin.astro`/`gate.astro`, Discord-Knopf). `sync_discord_identity()` feuert `AFTER INSERT ON auth.identities` und legt die `discord_role_state`-Zeile **neu an**: `insert into public.discord_role_state (user_id, discord_user_id) values (...) on conflict (user_id) do update set discord_user_id = excluded.discord_user_id;` — `is_tester` wird dabei **nicht gesetzt**, die Spalte bekommt also den Tabellen-Default `false`. Die Funktion hat keinerlei Möglichkeit, den tatsächlichen Discord-Rollenstand zu erfragen (reine SQL-Funktion, kein Netzzugriff).
3. `gate_verdict()` (`supabase/migrations/20260818001000_gate_verdict.sql:45-54`) prüft ausschließlich `discord_role_state.is_tester = true` — liefert `allowed:false, grund:'kein-testpilot'`, **obwohl der Nutzer die Rolle in diesem Moment tatsächlich trägt**.
4. Der Zustand korrigiert sich erst, wenn (a) ein Admin die Rolle für dieses Mitglied noch einmal entzieht und neu vergibt (löst ein weiteres `GuildMemberUpdate` aus, das jetzt eine Zeile zum Patchen vorfindet), oder (b) der Bot neu startet und `reconcileRoles()` (`role-reconcile.mjs`) beim nächsten `ClientReady` läuft — dieser Vollabgleich iteriert aber nur über **bereits existierende** `discord_role_state`-Zeilen (`fetchMirrorRows`, Zeile 29-44: `discord_user_id=not.is.null`), holt also exakt diesen erst frisch angelegten Fall nach, aber eben erst beim nächsten Neustart, nicht „sofort beim naechsten Aufruf" (D-08, wörtlich zitiert im Kopfkommentar der Migration).

Da D-01 Discord explizit zum **Hauptweg** macht, ist die Reihenfolge „Rolle im Discord bekommen → sich zum ersten Mal über Discord anmelden/verknüpfen" der **Normalfall für praktisch jeden neuen Testpiloten**, nicht ein Rand­fall. Das trifft damit vermutlich jede erste Anmeldung, bis der Bot zufällig neu gestartet wird oder ein Admin die Rolle erneut umschaltet.

Kein bestehendes Tor deckt das: `probe-gate-e2e.yml` prüft `gate_verdict()`-Antwortformen ausschließlich über feste Mock-Tokens (Zeile 100-106) und `check-gate.mjs`/`verify-gate.mjs` kennen keine Discord-Rollenlogik. `.planning/WINDOWS.md` id 34 prüft nur Rolle-geben/-nehmen an einem **bereits verknüpften** Konto sowie den Bot-Ausfall-Vollabgleich — nicht den hier beschriebenen Erstverknüpfungsfall.

**Fix:** Zwei unabhängige Wege, je nach Aufwand:
1. Minimal-invasiv: `sync_discord_identity()` fragt beim Anlegen der Zeile aktiv den Bot (z. B. über einen internen Endpunkt/eine Edge Function mit dem Bot-Token) nach dem aktuellen Rollenstand für `new.provider_id` und setzt `is_tester` gleich mit — einmaliger Aufruf bei Verknüpfung, kein Widerspruch zu D-08 (das nur den Seitenaufruf-Fall ausschließt).
2. Ohne Netzzugriff aus SQL: der Bot bekommt einen dritten Trigger-Punkt — ein periodischer (z. B. minütlicher) Soft-Reconcile statt nur beim Start, oder ein expliziter „hole den aktuellen Rollenstand nach, sobald `discord_role_state.discord_user_id` neu gesetzt wird"-Mechanismus (z. B. über ein `NOTIFY`/Listen-Muster oder ein periodisches Poll auf frisch angelegte, noch nicht abgeglichene Zeilen).
Ohne einen dieser beiden Wege bleibt der aktuelle Zustand: der von D-01 favorisierte Weg funktioniert für den Erstfall nicht.

**Behoben:** Commit `5af641d`. Weg 2 gewählt (periodischer Nachlauf), Weg 1
verworfen — ein SQL-Trigger kann Discord grundsätzlich nicht fragen (reine
SQL-Funktion, kein Netzzugriff), das gilt unabhängig vom Umweg über einen
internen Endpunkt. `discord/bot/src/role-reconcile.mjs` bekommt
`startPeriodicReconcile(ctx)`: dieselbe `reconcileRoles()`-Funktion wie beim
Start läuft jetzt zusätzlich alle 2 Minuten für alle Gilden, mit einem
Laufflag gegen Überlappung. In `discord/bot/src/index.mjs` NACH dem
Start-Vollabgleich in `ClientReady` verdrahtet (registriert erst dort, damit
der erste periodische Tick nicht sofort auf den gerade gelaufenen
Start-Abgleich obendrauf feuert — kein Abgleich-Sturm beim Boot). D-08
(Rollenentzug wirkt sofort) bleibt unverändert der `GuildMemberUpdate`-Pfad
in `role-sync.mjs`; das ist im Kopfkommentar von `role-reconcile.mjs`
ausdrücklich festgehalten, damit niemand diesen Pfad später zugunsten des
periodischen Passes „wegoptimiert". **Menschliche Bestätigung ausstehend:**
der reale Nachweis (Rolle geben, dann verknüpfen, ohne Bot-Neustart bis zu 2
Minuten warten, Zugriff funktioniert) braucht einen mit dem neuen Code
deployten Bot — dieselbe Einschränkung wie bei den bereits in WINDOWS.md
ids 21/22 verdrahteten Live-Nachweisen aus Plan 07. `node --check` auf
beiden geänderten Dateien bestanden, `npm run build && npm run gate`
19/19 grün (normal und mit `STAGING=1`).

### CR-02: `VB_GATE_BYPASS` fehlt in der nginx-`env`-Direktive — der CI-Rauchtest-Bypass erreicht njs vermutlich nie

**File:** `Dockerfile:88-92`, zusammenspielend mit `nginx/gate.js:171-183` (`check()`) und `.github/workflows/deploy-staging.yml:113-136`

**Konkretes Fehlerszenario:**
nginx entfernt beim Start alle geerbten Umgebungsvariablen außer `TZ`, sofern sie nicht per `env <NAME>;`-Direktive explizit freigegeben werden (dokumentiertes nginx-Kernverhalten, `ngx_set_environment()` baut `environ` bereits während `ngx_init_cycle()` neu auf — **vor** jedem Worker-Fork). njs' `process.env` liest exakt diese (bereits bereinigte) Prozessumgebung; unbenannte Variablen sind für `process.env` unsichtbar, unabhängig davon, ob sie per `docker run -e ...` gesetzt wurden.

Das Dockerfile gibt genau drei Variablen frei:
```
sed -i "/^events {/i env VB_GATE_SECRET;" /etc/nginx/nginx.conf && \
sed -i "/^events {/i env VB_SUPABASE_URL;" /etc/nginx/nginx.conf && \
sed -i "/^events {/i env VB_SUPABASE_ANON_KEY;" /etc/nginx/nginx.conf && \
```
`VB_GATE_BYPASS` — die vierte, in `nginx/gate.js:179-183` gelesene Variable (`process.env.VB_GATE_BYPASS`) — fehlt in dieser Liste vollständig. Im CI-Rauchtest (`deploy-staging.yml:115-116`) wird der Container mit `docker run ... -e VB_GATE_BYPASS="$GATE_BYPASS" ...` gestartet — dieser Wert würde nginx beim Start abgeschnitten, `check()` sähe `bypass = ''` und der `if (bypass)`-Zweig bliebe für **jeden** Aufruf tot. Jede Leitseite, die `browser-smoke.mjs` mit `X-VB-Gate-Bypass: $GATE_BYPASS` abruft, würde weiterhin mit 302 auf `/gate.html` antworten statt mit 200 — der Rauchtest-Schritt in `deploy-staging.yml` (Zeile 113-136) würde dadurch fehlschlagen und der nachfolgende `docker push`-Schritt (Zeile 138-141) nie erreicht.

Diese Lesart wird durch die eigene Historie der Phase gestützt: `15-09-SUMMARY.md` (Zeile 190) hält ausdrücklich fest, dass „der Rauchtest-Bypass ... lokal regressionsfrei geprüft, aber NICHT gegen einen echten, scharf gestellten Container verifiziert" ist (Docker fehlt lokal). Der zitierte „grüne CI-Lauf 32133474158" (35 Zusicherungen) lief laut `.planning/WINDOWS.md` id 35 gegen einen **erweiterten Mock-PostgREST**, nicht gegen den echten njs-Container. Auch `probe-gate-e2e.yml` — die einzige Sonde, die den echten Container mit echtem `nginx-module-njs` real hochfährt und minutiös gegen `docker run -e VB_GATE_SECRET=...` testet — erwähnt `VB_GATE_BYPASS` an keiner einzigen Stelle. Es gibt damit **keinen** bestehenden Nachweis, dass diese konkrete Variable jemals in einem echten njs-Prozess ankam.

`check-gate.mjs`s Zusicherung 4 (siehe WR-01 unten) kann diesen Fehler strukturell nicht aufdecken, weil sie nur den **Negativfall** (geratener Wert soll scheitern) prüft, nie den Positivfall (der echte, vom CI-Lauf selbst gesetzte Wert soll durchkommen).

Wichtig zur Einordnung: dies ist **kein** Sicherheitsloch für echte Besucher — `VB_GATE_BYPASS` wird auf dem von Coolify betriebenen Vorschau-Container laut eigenem Kommentar „nie gesetzt" (der Weg existiert dort nicht), das Tor bliebe für reale Nutzer also unverändert scharf. Der Schaden ist operativ: der eigens für T-14-56/57/58 gebaute Umgehungsmechanismus funktioniert im schlimmsten Fall nie, wodurch entweder (a) jeder künftige `deploy-staging.yml`-Lauf am Rauchtest-Schritt scheitert und nichts mehr auf staging ausgeliefert wird, oder (b) falls `browser-smoke.mjs` Redirects stillschweigend toleriert, der Rauchtest grün meldet, ohne je etwas Sinnvolles geprüft zu haben (Silent-Wrongness).

**Fix:**
```
sed -i "/^events {/i env VB_GATE_SECRET;" /etc/nginx/nginx.conf && \
sed -i "/^events {/i env VB_SUPABASE_URL;" /etc/nginx/nginx.conf && \
sed -i "/^events {/i env VB_SUPABASE_ANON_KEY;" /etc/nginx/nginx.conf && \
sed -i "/^events {/i env VB_GATE_BYPASS;" /etc/nginx/nginx.conf && \
```
Anschließend `probe-gate-e2e.yml` (oder ein neuer, dedizierter Sonden-Schritt) um einen echten Positivtest ergänzen: Container mit `-e VB_GATE_BYPASS=<Wert>` starten und messen, dass eine gesperrte Stichprobe mit `X-VB-Gate-Bypass: <dieser Wert>` tatsächlich 200 statt 302 liefert — genau der Test, der heute an keiner Stelle existiert.

**Behoben:** Commit `98d4526`. Vierte `env VB_GATE_BYPASS;`-Zeile ergänzt;
die Gegenkontrolle prüft jetzt jede der vier `env`-Zeilen einzeln per Namen
(Schleife über eine feste Namensliste), statt nur `load_module` zu grep-en —
das war die eigentliche Lücke, die CR-02 unentdeckt ließ. `npm run build &&
npm run gate` 19/19 grün (normal und mit `STAGING=1`). Der reale Nachweis
gegen einen echten njs-Container liegt jetzt in `probe-gate-e2e.yml` (siehe
WR-01, derselbe Commit-Rahmen wie dort) — dieselbe Sonde, die die Analyse
oben als „einzige, die den echten Container hochfährt" benennt, bekommt in
Commit `e8cda21` einen eigenen Zusicherungsblock, der ausschließlich diesen
Fix (die vierte `env`-Zeile) beweist. **Real bewiesen:** CI-Lauf
[`32165782075`](https://github.com/cibakhun/sc-patch-archive/actions/runs/32165782075)
(`probe-gate-e2e.yml`, Zweig `claude/staging-tester-role-access-308ebf`,
6m10s, alle Schritte grün) — Schritt „Zusicherungen — CI-Rauchtest-Bypass
gegen den echten njs-Container (CR-02/WR-01)": `OK /schiffe.html mit
korrektem X-VB-Gate-Bypass — Soll 200 Ist 200`, FEHLER: 0. Der Bypass
erreicht njs jetzt nachweislich.

## Warnings

### WR-01: `check-gate.mjs` Zusicherung 4 prüft nur den Negativfall des Bypasses, nie den Positivfall

**File:** `scripts/check-gate.mjs:260-276`

**Issue:** Der Kommentar über der Funktion sagt es selbst offen: „seine eigene Zusicherung 4 wuerfelt einen FREMDEN Wert und misst, dass GENAU DER nicht durchkommt" (`deploy-staging.yml:130-131`). Das ist eine sinnvolle, aber einseitige Prüfung — sie kann feststellen, dass ein *falscher* Bypass-Wert abgelehnt wird, aber an **keiner Stelle** im gesamten geprüften Dateibestand wird gemessen, dass der *richtige*, vom CI-Lauf selbst per `openssl rand -hex 32` erzeugte Wert tatsächlich durchkommt. Genau diese Lücke ist der Grund, warum CR-02 unentdeckt bleiben konnte: kein Tor der Phase prüft den Erfolgsfall des Bypasses gegen einen echten njs-Prozess.

**Fix:** In `deploy-staging.yml`s Rauchtest-Schritt (oder in `check-gate.mjs` selbst, per neuem optionalen Flag) eine sechste Zusicherung ergänzen: `X-VB-Gate-Bypass: $GATE_BYPASS` (der echte, für DIESEN Lauf gültige Wert) gegen eine gesperrte Stichprobe senden und `200` statt `302` erwarten. Das schließt exakt die Lücke, die CR-02 heute unsichtbar hält.

**Behoben:** Commit `e8cda21`. `check-gate.mjs` bekam die vorgeschlagene
sechste Zusicherung als optionales `--bypass <wert>`-Flag (ohne das Flag
sichtbar „übersprungen", nicht still grün); `deploy-staging.yml` reicht
`$GATE_BYPASS` jetzt durch. Zusätzlich (über den Fix-Vorschlag hinaus, weil
`check-gate.mjs` selbst nur gegen `astro preview` ohne Tor lokal geprüft
werden kann): `probe-gate-e2e.yml` — die einzige Sonde mit einem echten,
aus dem Dockerfile gebauten njs-Container — bekommt `VB_GATE_BYPASS` am
`vbgate-mock`-Container und einen eigenen Zusicherungsblock (echter Wert
→ 200, falscher Wert → 302, kein Header → 302 unverändert). Das ist der
einzige Ort im gesamten Bestand, an dem CR-02s Fix gegen einen echten
Prozess bewiesen wird. **Real bewiesen:** CI-Lauf
[`32165782075`](https://github.com/cibakhun/sc-patch-archive/actions/runs/32165782075)
(`probe-gate-e2e.yml`, gepusht als Commit `77e3f71`, 6m10s Gesamtlaufzeit,
alle Schritte grün) — der neue Zusicherungsblock lieferte 3/3 bestanden
(200 fuer den echten Wert, 302 fuer einen falschen Wert, 302 ohne
Kopfzeile), `FEHLER: 0`. `gh run view --log` gegen genau diesen Lauf
gelesen, kein blosses „sollte gruen sein". Alle 18 `run:`-Blöcke in
`probe-gate-e2e.yml` und alle 8 in `deploy-staging.yml` wurden zusätzlich
lokal mit `bash -n` syntaktisch geprüft (bestanden), das YAML selbst mit
`yaml.safe_load`.

### WR-02: `account-lite.js` verwendet denselben localStorage-Schlüssel für zwei unabhängige Sperren — Session-Refresh und Gate-Mint-Dedupe

**File:** `assets/account-lite.js:12` (Konstante `LOCK`), `33-57` (`ensureSession`), `382-398` (`mintGatePass`)

**Konkretes Fehlerszenario:** `LOCK = 'sb-lite-refresh-lock'` wird für zwei konzeptionell verschiedene Zwecke wiederverwendet: (1) in `ensureSession()`, um parallele Token-Refreshes über mehrere Tabs zu verhindern, und (2) in `mintGatePass()`, um parallele `/_gate/mint`-Aufrufe zu verhindern. `mintGatePass()` setzt `localStorage.setItem(LOCK, String(now))` **bevor** es `ensureSession()` aufruft (Zeile 387-389). Fällt in genau diesem Moment auch das Zugriffstoken selbst innerhalb der 60-Sekunden-Schwelle unter `expiresIn(sess) > 60` (Zeile 36), sieht `ensureSession()` beim Lock-Check (Zeile 40-41) den von `mintGatePass()` **soeben selbst gesetzten** Lock als „ein anderer Tab refresht gerade" und überspringt den fälligen Refresh — es liefert stattdessen die (noch nicht abgelaufene, aber bald ablaufende) alte Sitzung zurück. Ist das Zugriffstoken zu diesem Zeitpunkt bereits *tatsächlich* abgelaufen (`expiresIn(sess) <= 0`), liefert `ensureSession()` `null` statt zu refreshen, `mintGatePass()` erhält `sess === null` und meldet `'failed'` — und laut eigenem Kommentar in `scheduleGateRenewal()` (Zeile 417-420) wird bei `'failed'` **bewusst nicht erneut versucht**: der Erneuerungs-Loop endet vollständig, der Nutzer landet beim nächsten Seitenaufruf unnötig auf der Torseite, obwohl ein regulärer Refresh in diesem Moment funktioniert hätte, wäre er nicht durch den fremden Lock blockiert worden.

Der Fall ist eng getaktet (Gate-Cookie läuft alle 5 Minuten ab, das Zugriffstoken typischerweise seltener) und daher selten, aber real und durch die Code-Struktur selbst herbeigeführt, nicht durch äußere Umstände.

**Fix:** Getrennte localStorage-Schlüssel für die beiden Sperren verwenden, z. B. `LOCK` (Session-Refresh) und ein neuer `GATE_MINT_LOCK = 'sb-lite-gate-mint-lock'` für `mintGatePass()`. Damit können sich die beiden Mechanismen nicht mehr gegenseitig blockieren.

**Behoben:** Commit `138b86c`. Exakt wie vorgeschlagen: neuer, eigenständiger
Schlüssel `GATE_MINT_LOCK = 'sb-lite-gate-mint-lock'`, `mintGatePass()` liest
und schreibt jetzt ausschließlich diesen statt `LOCK`. Der veraltete
Kommentar an `mintGatePass()` („derselbe Riegel wie ensureSession()")
richtiggestellt, damit er den neuen Zustand nicht mehr falsch beschreibt.
`node --check assets/account-lite.js` bestanden, `npm run build && npm run
gate` 19/19 grün.

## Info

### IN-01: `/_gate/mint` ist auf der Live-Domain unbedingt erreichbar, nicht hinter `$vb_gate_on` verriegelt

**File:** `nginx/default.conf:238-248`

**Issue:** Alle anderen Torfunktionen hängen an `$vb_gate_ok`, das auf der Live-Seite (`$vb_gate_on` fest „0") unbedingt durchlässt (D-12). Die `location ^~ /_gate/mint { js_content gate.mint; }` fragt aber gar keine Gate-Variable ab und ist damit auf **beiden** Domains (Live und staging) gleichermaßen erreichbar — auch auf `verse-base.com`, wo das Feature funktional nicht gebraucht wird. Kein Sicherheitsproblem (die Funktion prüft ausschließlich das eigene Bearer-Token des Aufrufers, kein Zugriff auf fremde Konten möglich), aber ein POST von einem regulären, angemeldeten Live-Nutzer gegen `/_gate/mint` würde `gate_verdict()`s Seiteneffekt `last_staging_seen` fortschreiben (`gate_verdict.sql:56-63`), obwohl der Aufruf nie etwas mit staging zu tun hatte — die D-13-Kennzahl „zuletzt auf staging gesehen" kann dadurch verunreinigt werden, und `mint()` setzt bei jedem POST unnötig ein für die Live-Seite folgenloses Cookie.

**Fix:** Optional, geringe Priorität: `location ^~ /_gate/mint` auf der Live-Seite mit `if ($vb_gate_on != "1") { return 404; }` (oder ähnlich) unterbinden, falls die Sauberkeit der `last_staging_seen`-Kennzahl wichtig ist. Kein Blocker für den Rollout.

**Behoben am 20.08.2026** (`90fda27`) — nachträglich, außerhalb des
ursprünglichen Fix-Auftrags (der umfasste nur CR-01, CR-02, WR-01, WR-02,
siehe `fixes` im Frontmatter). Anlass für die Nachholung: der Befund wird
überhaupt erst mit der Freigabe nach `main` wahr — heute antwortet
`verse-base.com/_gate/mint` mit 404, weil das Live-Image den Torcode noch
nicht kennt. Die Freigabe steht an, also wäre „optional" ab diesem Zeitpunkt
zu „unbemerkt eingetreten" geworden.

Umgesetzt als `if ($vb_gate_on != "1") { return 404; }` in der
`location ^~ /_gate/mint`. `if` in einer location ist berüchtigt; `return`
ist einer der zwei dokumentiert unbedenklichen Fälle — es beendet die
Anfrage, statt einen zweiten Inhaltsgeber zu erzeugen, und lässt das
Kopfzeilen-Erbe aus dem `server`-Block unberührt.

Der Riegel wäre für sich genommen Dekoration gewesen: auf staging ist das
Tor an, dort ändert er nichts, und CI hätte ihn nie angefasst. Deshalb zwei
Zusicherungen in der bestehenden D-12-Gegenprobe von `probe-gate-e2e.yml`,
gemessen an echten Containern (Lauf 32383722968, 16 Zusicherungen, 0 Fehler):

```
OK     /_gate/mint im Live-Bau — Soll 404 Ist 404
OK     /_gate/mint im Vorschau-Bau, ohne Kopfzeile — Soll 401 Ist 401
```

Die zweite ist die Klinke. Ein Riegel, der überall zumacht, sähe mit der
ersten Zeile allein wie ein bestandener Lauf aus und hätte in Wahrheit den
Ausstellungspunkt getötet — also das ganze Tor. Der Sollwert 401 ist nicht
geraten, sondern vorher an der laufenden staging-Seite abgeholt.

---

## Fix-Zusammenfassung (18.08.2026)

Alle vier in Scope stehenden Befunde (CR-01, CR-02, WR-01, WR-02) sind
behoben und je einzeln committet (`5af641d`, `98d4526`, `e8cda21`,
`138b86c`), jeweils mit den Detailangaben in der „Behoben"-Notiz direkt
unter dem betroffenen Befund oben. `npm run build && npm run gate` lief
zweimal grün (19/19, 0 FEHLER, dieselben 4 vorbestehenden Warnungen wie vor
dem Fix): normal und mit `$env:STAGING = '1'` (Vorschau-Bau).

**CR-01 braucht menschliche Bestätigung gegen die lebende Anlage** (Tabelle
"human_judgment" im Sinne der Verifizierungs-Strategie): der reale Nachweis
setzt einen mit dem neuen Code deployten Bot voraus und ist damit nicht aus
diesem Arbeitsschritt heraus zu erbringen — dieselbe Einschränkung, die
Plan 07 bereits für D3/D4 in `WINDOWS.md` ids 21/22 dokumentiert hat.

**CR-02 und WR-01 sind gegen einen echten njs-Container bewiesen, nicht nur
behauptet:** `probe-gate-e2e.yml` wurde um einen Zusicherungsblock erweitert
(Commit `e8cda21`), der genau diesen Fix gegen einen echten, aus dem
Dockerfile gebauten njs-Container misst — gemäß Fix-Auftrag der einzige Ort,
an dem sich das beweisen lässt (Docker ist auf dem Entwicklungsrechner nicht
verfügbar, siehe 14-01/14-08/15-09-SUMMARY.md). Der Arbeitszweig wurde
gepusht (Commit `77e3f71`), der dadurch ausgelöste Lauf
[`32165782075`](https://github.com/cibakhun/sc-patch-archive/actions/runs/32165782075)
ist **grün** (6m10s, alle 20 Schritte bestanden): der neue Schritt
„Zusicherungen — CI-Rauchtest-Bypass gegen den echten njs-Container
(CR-02/WR-01)" meldet `OK /schiffe.html mit korrektem X-VB-Gate-Bypass —
Soll 200 Ist 200`, `OK ... mit falschem Wert — Soll 302 Ist 302`, `OK ...
ohne Kopfzeile — Soll 302 Ist 302`, `FEHLER: 0` — gelesen per `gh run view
--log`, kein blosses „sollte grün sein".

WR-02 ist vollständig durch statische Prüfung (Syntax + Tor) abgedeckt,
kein ausstehender Nachweis.

---

_Reviewed: 2026-08-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Fixed: 2026-08-18_
_Fixer: Claude (gsd-code-fixer)_
