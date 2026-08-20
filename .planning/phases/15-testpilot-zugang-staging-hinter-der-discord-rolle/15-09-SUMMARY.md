---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 09
subsystem: infra
tags: [njs, nginx, gate-registry, playwright, ci, verify, check-deployed]

# Dependency graph
requires:
  - phase: 14-08
    provides: "nginx/gate.js mint() gegen gate_verdict(); 7 GATE-AUSNAHME-Zeilen im Format '# GATE-AUSNAHME: <pfad> — <anlass>' in nginx/default.conf, gemessen gegen einen echten Browser-Mitschnitt von /gate.html"
  - phase: 14-11
    provides: "Deploy-Ping-Schritt in .github/workflows/deploy-staging.yml (GitHub Compare API, DISCORD_TESTPILOT_WEBHOOK) — dieser Plan aendert dieselbe Datei erneut und musste dessen Form kennen, um sie intakt zu lassen"
provides:
  - "scripts/verify-gate.mjs (Schiene A, npm run verify:gate): friert die 7-Eintrag-Ausnahmeliste als Tor ein — jede Ausnahme hat einen Anlass, deckt genau die Ressourcen von dist/gate.html, kein erfundener Eintrag, Torseite bleibt ungepaart/ohne /_astro/-Buendel, kein Geheimnis in nginx/gate.js, $vb_gate_on-Schalter in der Form, auf die der Dockerfile-sed zielt"
  - "scripts/check-gate.mjs (Schiene C, npm run check:gate): misst die AUSGELIEFERTE Zugriffskontrolle gegen ein --base <url> — gesperrt/offen, /build.json-Kennung (D-07), ein gewuerfelter Bypass-Wert kommt nicht durch"
  - "nginx/gate.js check(): Bypass-Kopfzeile X-VB-Gate-Bypass gegen VB_GATE_BYPASS, vollstaendig aus wenn die Variable fehlt/leer ist"
  - "scripts/browser-smoke.mjs reicht SMOKE_GATE_BYPASS an newContext()/robots.txt-Abruf durch, ohne den lokalen Modus (astro preview, keine Variable gesetzt) zu veraendern"
  - ".github/workflows/deploy-staging.yml wuerfelt den Bypass je Lauf (openssl rand -hex 32), gibt ihn nirgends aus, und laesst check-gate.mjs nach dem Rauchtest und vor dem Push gegen denselben Container laufen"
affects: ["14-12 (npm run check:gate ist eine explizite must_have-Zusicherung dieses Plans; verkabelte Registry-Eintraege muessen im Konzept stehen)"]

tech-stack:
  added: []
  patterns:
    - "Zwei Prüfer fuer denselben Gegenstand, bewusst auf verschiedenen Schienen: verify-gate.mjs (Schiene A, Text gegen dist/+nginx-Dateien, kein Netz) und check-gate.mjs (Schiene C, echte HTTP-Antworten gegen ein laufendes --base) — ein einzelner Pruefer haette nur die Haelfte belegen koennen (verify-gate kann NIE einen HTTP-Status sehen, check-gate kann NIE im Bau-Container laufen)"
    - "Ein Pruefer leitet seine Stichproben aus vorhandenen Quellen ab (dist/, nginx/default.conf) statt eine dritte, selbst gepflegte Pfadliste zu fuehren — dieselbe Regel wie scripts/lib/sync-exclusions.mjs, hier auf 'welche URLs pruefen' statt 'welche Ausnahmen gelten' angewandt"
    - "Ein Pruefschluessel statt eines Dauerschluessels: env-Variable, die es im ausgelieferten Container NIE gibt, je CI-Lauf frisch gewuerfelt, voller Laengenvergleich ohne Kurzschluss (dieselbe safeEqual()-Funktion wiederverwendet, die die Cookie-Signatur schuetzt) — ein negativer Nachweis (ein geratener Wert oeffnet NICHT) ist Teil der Pruefung, nicht nur der positive"
    - "Funktionaler Test gegen einen unabhaengig implementierten node:http-Testwerkstand als Ersatz fuer einen lokal nicht verfuegbaren Docker-Container (Muster aus 14-01/14-08 fortgesetzt) — der Werkstand liest dieselbe Ausnahmeliste UND dist/, ruft aber nicht den Code des zu pruefenden Skripts auf, damit die Probe nicht tautologisch wird"

key-files:
  created:
    - scripts/verify-gate.mjs
    - scripts/check-gate.mjs
  modified:
    - scripts/lib/gate-registry.mjs
    - scripts/verify-wiring.mjs
    - package.json
    - nginx/gate.js
    - scripts/browser-smoke.mjs
    - .github/workflows/deploy-staging.yml

key-decisions:
  - "Zusicherung 3 (Zombie-Waechter) von verify-gate.mjs braucht eine breitere 'Deckungs'-Basis als nur die direkten link/script/img/source-Treffer aus dist/gate.html: die vier .woff2-Schriftdateien unter /assets/fonts/ werden nie DIREKT von gate.html angefordert, sondern erst transitiv ueber @font-face in assets/fonts.css — ohne das eigene Nachladen der von gate.html verlinkten .css-Dateien haette die 7. (legitime) Ausnahme wie ein erfundener Eintrag ausgesehen. Gegen den echten Build gemessen, nicht angenommen."
  - "Zusicherung 1 (Anlass-Pflicht) erkennt GATE-AUSNAHME-Zeilen BREIT (nur der Zeilenanfang muss stimmen), nicht nur vollstaendig wohlgeformte. Ein eng gefasster Regex haette einen beschaedigten Anlass einfach aus der Zaehlung verschwinden lassen, statt ihn als 'zu kurz' zu meldeen — genau die Luecke, vor der Grundsatz 1 warnt (ein Tor, das nie wirklich pruefen kann, WEIL sein eigenes Muster den Bruch verdeckt)."
  - "check-gate.mjs fuehrt keine eigene Pfadliste: gesperrte Stichproben werden aus dist/ ABGELEITET (drei Leitseiten + eine Datei je /_astro/ und /holo/), offene aus demselben GATE-AUSNAHME-Text, den verify-gate.mjs liest. Zwei unabhaengig gepflegte Listen waeren genau die Sorte Pruefer, die gruen meldet und nichts misst (T-14-60)."
  - "Der Bypass-Kopfzeilenname (X-VB-Gate-Bypass) ist an GENAU EINER Stelle im Kommentar von nginx/gate.js festgelegt und wandert unveraendert in scripts/browser-smoke.mjs (extraHTTPHeaders) und scripts/check-gate.mjs (Zusicherung 4) — ein Name, kein Risiko des Auseinanderlaufens."
  - "Docker ist auf diesem Rechner nicht verfuegbar (wie in 14-01/14-08 dokumentiert): check-gate.mjs und der Bypass wurden funktional gegen einen eigens gebauten node:http-Testwerkstand geprueft, NICHT gegen den im Plan vorgegebenen echten Container (docker build/run). Der Werkstand ist bewusst UNABHAENGIG implementiert (eigene Ausnahmelisten-Auswertung, ruft check-gate.mjs's Code nicht auf), damit die Probe nicht tautologisch wird. Der Nachweis gegen den echten Vorschau-Container steht aus — WINDOWS.md id 28, Plan 12 sieht die Zusammenfuehrung ausdruecklich vor (must_have 'npm run check:gate gegen die echte Adresse')."

patterns-established:
  - "Wiring-Luecke: ein Schiene-C-Pruefer, dessen Dateiname nicht auf verify-*/audit-* passt (wie schon check-deployed.mjs), MUSS in scripts/verify-wiring.mjs's PRUEFER_AUSSER_DER_REIHE eingetragen werden — sonst scannt die Bijektionspruefung die Datei nie, und die Registrierungspflicht ist wirkungslos, obwohl verify:wiring formal gruen bleibt."

requirements-completed: [D-06, D-07, D-12]

coverage:
  - id: D1
    description: "verify-gate.mjs friert die 7-Eintrag-Ausnahmeliste ein (6 Zusicherungen: Anlass-Pflicht, Deckung der Torseiten-Ressourcen, Zombie-Waechter, Eigenstaendigkeit der Torseite, kein Geheimnis im Modul, $vb_gate_on-Schalterform) — kein Netz/git/Kindprozess, laeuft im Bau-Container"
    requirement: D-06
    verification:
      - kind: unit
        ref: "node scripts/verify-gate.mjs gegen den echten Build — 7 Ausnahmen, 2 Ressourcen, alle sechs Zusicherungen gruen; drei vorgefuehrte rote Laeufe (Anlass gekuerzt, Ausnahmeblock entfernt, erfundener Eintrag) protokolliert, danach zurueckgesetzt"
        status: pass
    human_judgment: false
  - id: D2
    description: "check-gate.mjs misst die ausgelieferte Zugriffskontrolle: gesperrt/offen, /build.json-Kennung (D-07), gewuerfelter Bypass kommt nicht durch"
    requirement: D-07
    verification:
      - kind: unit
        ref: "node scripts/check-gate.mjs gegen einen eigens gebauten node:http-Testwerkstand (Docker lokal nicht verfuegbar) — normaler Lauf gruen (5 gesperrte, 7 offene Stichproben), zwei vorgefuehrte rote Laeufe (Tor komplett aus wie ohne STAGING=1; Bypass-Pruefung nimmt jeden Wert an), danach zurueckgesetzt"
        status: pass
    human_judgment: true
    rationale: "Docker ist auf diesem Rechner nicht verfuegbar (14-01/14-08). Der im Plan vorgegebene <verify>-Block (docker build/run gegen den echten Container) konnte nicht gefahren werden — nur funktional gegen einen unabhaengig implementierten Ersatz. Der Nachweis gegen den echten Vorschau-Container (Docker/CI) steht aus, WINDOWS.md id 28, Plan 12 fuehrt zusammen (must_have 'npm run check:gate gegen die echte Adresse')."
  - id: D3
    description: "Der Rauchtest kommt durchs Tor: nginx/gate.js pruefen eine Bypass-Kopfzeile gegen VB_GATE_BYPASS, der Weg existiert nur im CI-Pruef-Container (je Lauf gewuerfelt, nirgends gespeichert), scripts/browser-smoke.mjs reicht den Wert durch, deploy-staging.yml wuerfelt und verdrahtet ihn"
    requirement: D-12
    verification:
      - kind: unit
        ref: "npm run build && npm run gate: 19/19 gruen (Schiene A, verify:gate darunter), normal UND mit STAGING=1. YAML-Syntax (python yaml.safe_load) + Bash-Syntax (bash -n) des geaenderten Workflow-Schritts geprueft. node scripts/browser-smoke.mjs --only start gegen astro preview: regressionsfrei ohne und mit gesetzter SMOKE_GATE_BYPASS. Der im Plan vorgegebene <verify>-Block (node -e Substring-/Regex-Pruefung) bestanden."
        status: pass
    human_judgment: true
    rationale: "Der eigentliche Nachweis — Rauchtest gegen einen mit STAGING=1 gebauten Container ist mit Bypass gruen und OHNE Bypass rot (Seiten nicht erreichbar), beide Laeufe protokolliert — braucht Docker/CI und konnte hier nicht gefahren werden. Faellt mit demselben Grund unter WINDOWS.md id 28 wie D2."

duration: ~2h (mit einer Sitzungsunterbrechung dazwischen, gesichert per wip-Commit 192e351)
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 09: Zwei neue Tore und ein Rauchtest, der unter dem Türsteher weiterläuft Summary

**`verify:gate` (Schiene A) friert die 7-Eintrag-Ausnahmeliste des Testpilot-Tors als Tor ein, `check:gate` (Schiene C) misst die ausgelieferte Zugriffskontrolle statt sie zu behaupten, und `scripts/browser-smoke.mjs` kommt jetzt über einen je CI-Lauf gewürfelten, nirgends gespeicherten Bypass durchs eigene Tor — alle drei funktional geprüft und je nach Schiene entweder gegen den echten Build (verify:gate, `npm run gate` 19/19) oder gegen einen node:http-Testwerkstand, weil Docker auf diesem Rechner nicht verfügbar ist.**

## Performance

- **Duration:** ~2h (mit einer Sitzungsunterbrechung — Arbeitsstand wurde per wip-Commit `192e351` gesichert, dann fortgesetzt)
- **Completed:** 2026-08-18
- **Tasks:** 3/3
- **Files modified:** 8 (2 neu, 6 geändert)

## Accomplishments

- **Aufgabe 1 (D-06):** `scripts/verify-gate.mjs` — sechs nummerierte Zusicherungen gegen `dist/` und die beiden nginx-Dateien, kein Netz/git/Kindprozess. Läuft in 0,1s als Teil von `npm run gate` (19/19 grün, Schiene A). Drei vorgeführte rote Läufe protokolliert (siehe unten), danach zurückgesetzt.
- **Aufgabe 2 (D-07):** `scripts/check-gate.mjs` — fünf nummerierte Zusicherungen gegen eine LAUFENDE Seite (`--base <url>`), leitet seine Stichproben aus `dist/` und der Ausnahmeliste ab statt eine eigene, zweite Liste zu führen. Zwei vorgeführte rote Läufe protokolliert, danach zurückgesetzt.
- **Aufgabe 3 (D-12):** `nginx/gate.js` `check()` prüft zusätzlich eine Bypass-Kopfzeile (`X-VB-Gate-Bypass`) gegen `VB_GATE_BYPASS` — vollständig aus, wenn die Variable fehlt/leer ist. `scripts/browser-smoke.mjs` reicht `SMOKE_GATE_BYPASS` durch, ohne den lokalen Modus zu verändern. `.github/workflows/deploy-staging.yml` würfelt den Wert je Lauf (`openssl rand -hex 32`), gibt ihn nirgends aus, und lässt `check-gate.mjs` nach dem Rauchtest und vor dem Push gegen denselben Container laufen. Der bestehende Schritt "Verify the preview is not indexable" und Plan 11s Deploy-Ping-Schritt bleiben unverändert.
- Dabei gefunden und behoben (Rule 1): doppelter Schrägstrich in der von der `/assets/fonts/`-Präfixausnahme abgeleiteten URL in `check-gate.mjs` (`ersteDatei()` normalisierte das Verzeichnis vor dem Anhängen nicht).
- Dabei gefunden und behoben (Rule 3, blockierend): `check-gate.mjs` folgt nicht dem Namensmuster `verify-*`/`audit-*` und wurde von `scripts/verify-wiring.mjs`'s Bijektionsprüfung deshalb GAR NICHT gescannt — ohne den Eintrag in `PRUEFER_AUSSER_DER_REIHE` (dieselbe Ausnahme, die `check-deployed.mjs` schon braucht) wäre die geforderte Registrierungspflicht wirkungslos gewesen, obwohl `verify:wiring` formal grün geblieben wäre.

## Task Commits

1. **Aufgabe 1: verify:gate — die Ausnahmeliste als Tor (Schiene A)** — `38dd487` (feat)
2. **Aufgabe 2: check:gate — die ausgelieferte Zugriffskontrolle (Schiene C)** — `192e351` (wip, Sitzungsunterbrechung) + `53c7aec` (feat, Registrierung + Wiring-Fix + Fehlerbehebung)
3. **Aufgabe 3: der Rauchtest kommt durchs Tor** — `bbb2fe0` (feat)

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

## Files Created/Modified

- `scripts/verify-gate.mjs` (neu) — Schiene A, 6 Zusicherungen, Klinken ≥6 Ausnahmen/≥2 Ressourcen
- `scripts/check-gate.mjs` (neu) — Schiene C, 5 Zusicherungen, Klinken ≥5 gesperrte/≥4 offene Stichproben, Flaggen `--base`/`--live`/`--weich`
- `scripts/lib/gate-registry.mjs` — zwei neue Einträge (`verify:gate` Schiene A ohne `env`, `check:gate` Schiene C mit `env`)
- `scripts/verify-wiring.mjs` — `check-gate.mjs` in `PRUEFER_AUSSER_DER_REIHE`, `MIN_SCRIPTS` 21→23
- `package.json` — `verify:gate`, `check:gate` (mit `--base https://staging.verse-base.com`-Vorgabe)
- `nginx/gate.js` — `check()` prüft zusätzlich `X-VB-Gate-Bypass` gegen `VB_GATE_BYPASS`
- `scripts/browser-smoke.mjs` — `SMOKE_GATE_BYPASS` an `newContext()`/`robots.txt`-Abruf durchgereicht, Kopfzeile nennt die Bedingung
- `.github/workflows/deploy-staging.yml` — Bypass je Lauf gewürfelt, `check-gate.mjs` nach dem Rauchtest verdrahtet

## Decisions Made

Siehe `key-decisions` im Frontmatter — Kurzfassung: die Zombie-Wächter-Zusicherung in `verify-gate.mjs` musste die verlinkten `.css`-Dateien der Torseite selbst mit einlesen (transitive Ressourcen wie `.woff2`-Schriften), sonst hätte die legitime 7. Ausnahme wie ein erfundener Eintrag ausgesehen; `check-gate.mjs` führt keine eigene Pfadliste, sondern leitet aus `dist/` und derselben Ausnahmeliste ab, die `verify-gate.mjs` liest; der Bypass-Kopfzeilenname ist an einer Stelle festgelegt und wandert unverändert durch drei Dateien; Docker war lokal nicht verfügbar, daher funktionaler Test gegen einen unabhängig implementierten Testwerkstand statt gegen den echten Container.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doppelter Schrägstrich in der von `/assets/fonts/` abgeleiteten URL**

- **Found during:** Aufgabe 2, erster funktionaler Testlauf gegen den Testwerkstand
- **Issue:** `ersteDatei(dir)` hängte `${dir}/${entries[0]}` an, ohne einen bereits vorhandenen Endschrägstrich in `dir` zu entfernen — bei der `/assets/fonts/`-Präfixausnahme (die einzige mit Endschrägstrich) entstand `/assets/fonts//barlow-….woff2` statt `/assets/fonts/barlow-….woff2`.
- **Fix:** `dir.replace(/\/+$/, '')` vor dem Zusammenbauen.
- **Files modified:** `scripts/check-gate.mjs`
- **Verification:** Testwerkstand-Lauf zeigt jetzt `/assets/fonts/barlow-400-latin-ext.woff2` (einfacher Schrägstrich), Zusicherung 2 weiterhin grün.
- **Committed in:** `53c7aec`

**2. [Rule 3 - Blockierend] `check-gate.mjs` war von `verify:wiring`s Bijektionsprüfung gar nicht erfasst**

- **Found during:** Aufgabe 2, nach dem ersten `npm run verify:wiring`-Lauf nach der Registrierung
- **Issue:** `scripts/verify-wiring.mjs` erkennt Prüfskripte nur über das Namensmuster `verify-*.mjs`/`audit-*.mjs` plus eine explizite Ausnahmeliste `PRUEFER_AUSSER_DER_REIHE`. `check-gate.mjs` folgt keinem der beiden Muster (wie `check-deployed.mjs` vor ihm) und wurde deshalb NIE gescannt — die Bijektionsprüfung hätte nie gemeldet, wenn die Datei ohne Registry-Eintrag geblieben wäre, obwohl der Plan genau das als must_have verlangt ("Beide neuen Prüfer sind in scripts/lib/gate-registry.mjs eingetragen; verify:wiring bleibt grün").
- **Fix:** `check-gate.mjs` zu `PRUEFER_AUSSER_DER_REIHE` hinzugefügt, `MIN_SCRIPTS` von 21 auf 23 angehoben (2 neue Skripte, Sperrklinke wandert nur nach oben).
- **Files modified:** `scripts/verify-wiring.mjs`
- **Verification:** `npm run verify:wiring` — "Prüfskripte im Bestand: 23 Untergrenze: 23", alle sechs Zusicherungen grün.
- **Committed in:** `53c7aec`

**3. [Rule 1 - Bug] `env`-Feld des `check:gate`-Registry-Eintrags löste die eigene Zombie-Marken-Prüfung aus**

- **Found during:** Aufgabe 2, `npm run verify:wiring` nach der ersten Registrierung
- **Issue:** Der `env`-Text enthielt die Formulierung "Kein git, kein Kindprozess" — `verify-wiring.mjs`s Musterabgleich versteht keine Verneinung, er prüft nur, ob die Wörter "git"/"Kindprozess" im Text vorkommen. Da `check-gate.mjs` weder git noch `child_process` berührt, meldete Zusicherung 4 zwei Zombie-Marken.
- **Fix:** Formulierung ohne die auslösenden Schlüsselwörter ("Sonst berührt es nichts außerhalb der Umgebung …").
- **Files modified:** `scripts/lib/gate-registry.mjs`
- **Verification:** `npm run verify:wiring` — "undeklariert + Zombies — Soll: 0" erfüllt.
- **Committed in:** `53c7aec`

---

**Total deviations:** 3 auto-fixed (1× Rule 1 Bug in check-gate.mjs selbst, 1× Rule 3 blockierend in verify-wiring.mjs, 1× Rule 1 Bug in der Registry-Formulierung)
**Impact on plan:** Kein Scope-Creep. Alle drei Fixes waren nötig, damit die im Plan geforderten must_haves ("verify:wiring bleibt grün", korrekte Stichproben-URLs) tatsächlich zutreffen und nicht nur formal grün erscheinen.

## Known Stubs

Keine.

## Threat Flags

Keine neuen — alle in `<threat_model>` des Plans genannten Bedrohungen (T-14-56 bis T-14-61) sind durch die Umsetzung dieses Plans selbst adressiert:
- T-14-56 (CI-Bypass wird zur Hintertür): `VB_GATE_BYPASS` wird je Lauf gewürfelt, nirgends gespeichert, `check-gate.mjs` Zusicherung 4 misst gegen den Testwerkstand, dass ein geratener Wert nicht durchkommt.
- T-14-57 (Erraten des Bypass-Wertes): 32 Zufallsbytes, `safeEqual()` ohne Kurzschluss.
- T-14-58 (Bypass-Wert im CI-Protokoll): keine Zeile im geänderten Workflow-Schritt gibt ihn aus.
- T-14-59 (Prüfer meldet grün ohne zu messen): Selbstauskunft + Sperrklinken in beiden neuen Prüfern, fünf vorgeführte rote Läufe (drei verify-gate, zwei check-gate) protokolliert.
- T-14-60 (Ausnahmeliste und Prüferliste laufen auseinander): `check-gate.mjs` liest dieselbe Ausnahmeliste wie `verify-gate.mjs`, keine dritte Liste.
- T-14-61 (Rauchtest bleibt rot, blockiert Ausrollen): Bypass wurde in derselben Änderung eingeführt wie das scharfe Tor auf staging (Plan 08); beide Läufe (mit/ohne Wert) wurden geprüft — MIT Bypass grün (regressionsfrei gegen astro preview gemessen), OHNE Bypass gegen einen scharf gestellten Container siehe unten unter Issues Encountered.

## Issues Encountered

- **Docker ist auf diesem Rechner weiterhin nicht verfügbar** (wie in 14-01/14-08-SUMMARY.md dokumentiert). Der im Plan für Aufgabe 2 vorgegebene `<verify>`-Block (`docker build --build-arg STAGING=1 ... && docker run ... && node scripts/check-gate.mjs`) konnte nicht gefahren werden. Ersatzweise wurde ein eigens gebauter `node:http`-Testwerkstand verwendet (unabhängig implementiert — liest dieselbe GATE-AUSNAHME-Liste und `dist/`, ruft aber keinen Code aus `check-gate.mjs` selbst auf, damit die Probe nicht tautologisch wird): normaler Lauf grün (5 gesperrte, 7 offene Stichproben, über den Klinken), zwei vorgeführte rote Läufe (Tor komplett aus — simuliert einen Container ohne `STAGING=1`; eine Bypass-Prüfung, die jeden nicht-leeren Wert annimmt). Ebenso konnte der reale Rauchtest-Nachweis (grün MIT Bypass gegen einen scharf gestellten Container, rot OHNE) nicht gegen einen echten Container gefahren werden — nur regressionsfrei gegen `astro preview` (kein Tor dort). Als **WINDOWS.md id 28** (`unrun-verify`, phase 14) eingetragen. Plan 12 sieht die Zusammenführung ausdrücklich vor: sein must_have "Die ausgelieferte Vorschau sperrt wirklich — belegt mit `npm run check:gate` gegen die echte Adresse" ist genau dieser offene Nachweis.
- **Sitzungsunterbrechung mitten in Aufgabe 2**: der Ausführungsagent wurde vom Sitzungsgrenzwert unterbrochen, unmittelbar nachdem `scripts/check-gate.mjs` geschrieben, aber noch nicht registriert oder geprüft war. Der Koordinator hat den Stand per `wip`-Commit (`192e351`) gesichert (dieselbe Maßnahme wie bei `cc1bf3a` in Plan 01, Anlass: defektes Netzteil, siehe ROADMAP Phase 5). Die Fortsetzung hat den gesicherten Stand übernommen, registriert, geprüft und die verbleibenden zwei gefundenen Fehler behoben — kein Neuaufbau nötig.

## User Setup Required

None — dieser Plan legt keine neuen dauerhaften Umgebungsvariablen an. `VB_GATE_BYPASS`/`SMOKE_GATE_BYPASS` existieren ausdrücklich NUR innerhalb eines einzelnen CI-Laufs (je Lauf gewürfelt, nie gespeichert) — kein Repo-Secret, kein Coolify-Eintrag. Die drei `VB_GATE_SECRET`/`VB_SUPABASE_URL`/`VB_SUPABASE_ANON_KEY`-Variablen aus Plan 01 (noch nicht in Coolify gesetzt) bleiben unverändert Voraussetzung für den Türsteher auf der echten Vorschau-Umgebung — von diesem Plan nicht berührt, und für den Rauchtest über den Bypass ohnehin nicht mehr nötig.

## Next Phase Readiness

- Beide neuen Prüfstrecken sind im Registry und in `npm run gate` (Schiene A) bzw. eigenständig aufrufbar (Schiene C) verdrahtet — `npm run verify:wiring` grün, `npm run build && npm run gate` grün (19/19), normal UND mit `STAGING=1`.
- Der Rauchtest-Bypass ist code-fertig und lokal regressionsfrei geprüft, aber NICHT gegen einen echten, scharf gestellten Container verifiziert (Docker fehlt lokal) — der nächste echte `staging`-Push (oder ein manueller `workflow_dispatch`-Lauf von `deploy-staging.yml`) ist der erste reale Nachweis.
- **Offener Punkt für Plan 12** (dessen must_have es ausdrücklich verlangt): `npm run check:gate` gegen die echte ausgelieferte Vorschau-Adresse fahren, sobald die drei `VB_GATE_SECRET`/`VB_SUPABASE_URL`/`VB_SUPABASE_ANON_KEY`-Variablen in Coolify gesetzt sind und ein echter Deploy gelaufen ist.
- Kein Blocker für die Fortsetzung der Phase — der nächste `staging`-Push liefert automatisch den echten Nachweis für beide offenen Punkte (WINDOWS.md id 28), weil `deploy-staging.yml` jetzt sowohl `check-gate.mjs` als auch den bypass-gestützten Rauchtest bei jedem Lauf ausführt.

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

Alle 8 Artefaktdateien gefunden (`scripts/verify-gate.mjs`, `scripts/check-gate.mjs`, `scripts/lib/gate-registry.mjs`, `scripts/verify-wiring.mjs`, `nginx/gate.js`, `scripts/browser-smoke.mjs`, `.github/workflows/deploy-staging.yml`, diese SUMMARY.md). Alle 4 zitierten Commit-Hashes (`38dd487`, `192e351`, `53c7aec`, `bbb2fe0`) im Verlauf des Zweigs `claude/staging-tester-role-access-308ebf` gefunden. `npm run build && npm run gate` zuletzt grün (19/19, Schiene A) sowohl normal als auch mit `STAGING=1`. `npm run verify:wiring` grün (23/23 Prüfskripte). WINDOWS.md id 28 eingetragen für den ausstehenden Nachweis gegen einen echten Docker-Container.
