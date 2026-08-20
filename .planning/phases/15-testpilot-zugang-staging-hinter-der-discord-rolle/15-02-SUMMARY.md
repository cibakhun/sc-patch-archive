---
phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 02
subsystem: database
tags: [supabase, postgres, rls, security-definer, plpgsql, discord-oauth, triggers]

requires:
  - phase: 14-01
    provides: "njs-Türsteher (nginx/gate.js), Cookie-Format ({sub, exp}), Mint-Endpunkt-Vertrag (heute noch direkt gegen user_roles)"
provides:
  - "public.discord_role_state — Bot-Spiegel des Discord-Rollenstands, RLS mit genau einer select-Politik"
  - "public.tester_blocklist — Sofort-Rauswurf (D-10), RLS ohne jede Client-Politik"
  - "public.profiles.is_tester / public.profiles.tester_credit — Spiegelspalte (D-19) und Zustimmungsschalter (D-22)"
  - "guard_is_tester() — Schreibsperre-Trigger, sperrt Client-Writes auf is_tester=true"
  - "sync_discord_identity() — Trigger auf auth.identities, koppelt die verifizierte Discord-ID serverseitig (D-03)"
  - "public.gate_verdict() — Torurteil in einem Aufruf, security definer, parameterlos, nur authenticated"
  - "public.tester_overview() — Admin-Übersicht wer die Rolle trägt und wann zuletzt auf staging (D-13)"
  - "public.public_profiles um is_tester erweitert — gegen die AKTUELL lebende Definition, nicht die Urfassung"
  - "public.tester_credits — schmale Namensnennungs-View (D-22)"
affects: [14-08, 14-09, 14-10, 14-12]

tech-stack:
  added: []
  patterns:
    - "security-definer-Funktionen mit auth.uid()-only-Identität (kein Parameter) für jedes Torurteil — verhindert, dass ein Aufrufer das Urteil über ein fremdes Konto erfragt"
    - "ON CONFLICT-Ziel muss JEDEN unique-Constraint der Zieltabelle berücksichtigen, den der INSERT beschreibt — ein Ziel, das nur den Primärschlüssel nennt, fängt Verletzungen anderer unique-Indizes nicht ab; inneres BEGIN/EXCEPTION/END fängt sie stattdessen ab"
    - "CREATE OR REPLACE VIEW gegen die JÜNGSTE Migration bauen, die das Objekt zuletzt definiert hat, nicht gegen seine Urfassung — die Spaltenliste ist nur anhängbar (Name/Typ/Position bestehender Spalten sind unveränderlich)"

key-files:
  created:
    - supabase/migrations/20260818000000_discord_tester_gate.sql
    - supabase/migrations/20260818001000_gate_verdict.sql
  modified: []

key-decisions:
  - "sync_discord_identity(): eine doppelte Discord-Kopplung (zwei Konten, dieselbe discord_user_id) scheitert weiterhin, aber mit einer sprechenden Meldung statt der rohen Constraint-Verletzung (Kandidat a von drei vorgelegten Optionen). Kandidat b (die ältere Zeile stillschweigend entkoppeln) wurde bewusst verworfen — das wäre eine Entscheidung über ein FREMDES Konto gewesen, die dem Betreiber gehört, nicht dieser Migration."
  - "foreign_key_violation und jede andere unerwartete Ausnahme in sync_discord_identity() werfen nur noch eine WARNING, keine Exception mehr — ein Spiegel-Eintrag ist nie wichtiger als eine funktionierende Anmeldung, und der Trigger sitzt AFTER INSERT auf der von Supabase verwalteten Tabelle auth.identities, wo jede unbehandelte Ausnahme die gesamte Identitäts-Anlage zurückrollt."
  - "Beide Migrationen wurden über die Supabase Management API angewendet (apply_migration, Namen `discord_tester_gate` und `gate_verdict`), NICHT über `supabase db push`. Der CLI-Weg ist in diesem Projekt strukturell kaputt: die 24 bereits live angewandten Migrationen tragen Namen/Zeitstempel, die mit keiner Datei in supabase/migrations/ (11 Dateien) übereinstimmen — sie liefen alle über dieselbe Management-API, nie über die CLI. `supabase migration repair --status reverted` über alle 24 wäre falsch und gefährlich (markierte Angewandtes als zurückgenommen). Diese beiden Migrationen folgen deshalb bewusst demselben, bereits etablierten Weg statt eines Wegs, der für dieses Projekt nie funktioniert hat."

patterns-established:
  - "Jede ON CONFLICT-Klausel gegen ALLE unique-Constraints der Zieltabelle prüfen, die der INSERT tatsächlich beschreibt — nicht nur gegen den Primärschlüssel, gegen den sie geschrieben ist."
  - "Vor jedem CREATE OR REPLACE VIEW/FUNCTION auf ein bestehendes Objekt: die jüngste Migration suchen, die es zuletzt definiert hat. Keine Repo-Datei ist ein Beleg über die lebende Anlage (15-CONTEXT.md, Commit c56ee5f) — aber unter den Repo-Dateien selbst gilt trotzdem: die jüngste zählt, nicht die erste."
  - "Migrationen dieses Projekts werden über die Supabase Management API angewendet, benannt ohne Datei-Zeitstempel (z. B. `discord_tester_gate` statt `20260818000000_discord_tester_gate`) — nicht über `supabase db push`. Künftige Pläne mit Datenbank-Migrationen sollten denselben Weg gehen, nicht den CLI-Weg neu versuchen."

requirements-completed: [D-03, D-05, D-08, D-10, D-13, D-19, D-22]

coverage:
  - id: D1
    description: "public.discord_role_state und public.tester_blocklist auf dem echten Projekt (trgjhmbnodoarnfmlcqx) angelegt, RLS aktiv, Kommentare gesetzt"
    requirement: D-10
    verification:
      - kind: integration
        ref: "Management API list_tables auf public, nach dem Anwenden (Koordinator, 17.08.2026): discord_role_state rls_enabled=true, tester_blocklist rls_enabled=true, je 0 Zeilen, Kommentar gesetzt"
        status: pass
    human_judgment: false
  - id: D2
    description: "profiles.is_tester und profiles.tester_credit existieren auf dem echten Projekt"
    requirement: D-19
    verification: []
    human_judgment: true
    rationale: "Direkter Lesezugriff (execute_sql) war in der Anwendungssitzung gesperrt. Die Existenz ist eine ZWINGENDE logische Folge — public_profiles und tester_credits wählen beide Spalten aus, und ihre CREATE-OR-REPLACE-Anweisungen sind nicht gescheitert —, aber das ist ein Schluss, keine Messung. Braucht eine echte Abfrage gegen die Anlage, sobald Lesezugriff besteht."
  - id: D3
    description: "public.public_profiles wurde gegen die AKTUELL lebende Spaltenliste ersetzt (presence erhalten, is_tester als 16. Spalte am Ende) statt gegen ihre Urfassung, die presence nicht kennt"
    requirement: D-19
    verification: []
    human_judgment: true
    rationale: "Logisch zwingend aus dem Verhalten von CREATE OR REPLACE VIEW (nur Anhängen ans Ende erlaubt, der Lauf wäre sonst mit 'cannot change name of view column' abgebrochen, ist aber nicht abgebrochen) statt direkt gegengelesen — derselbe Sperrgrund wie D2."
  - id: D4
    description: "guard_is_tester(): ein normales Nutzerkonto kann is_tester nicht auf true setzen, tester_credit dagegen schon"
    requirement: D-22
    verification: []
    human_judgment: true
    rationale: "Braucht eine echte, angemeldete Nutzersitzung — weder Executor noch Koordinator hatten in dieser Sitzung eine. Für die Sichtrunde des Betreibers vorgesehen, sobald die Vorschau-Umgebung steht (Plan 08/12)."
  - id: D5
    description: "anon darf public.gate_verdict() nicht ausführen"
    requirement: D-04
    verification: []
    human_judgment: true
    rationale: "Braucht einen Aufruf ohne Sitzung gegen die echte Anlage; nicht in dieser Sitzung durchgeführt. Für dieselbe Sichtrunde vorgesehen."
  - id: D6
    description: "sync_discord_identity(): eine doppelte Discord-Kopplung liefert die sprechende Meldung statt der rohen Constraint-Verletzung"
    requirement: D-03
    verification: []
    human_judgment: true
    rationale: "Braucht zwei echte Konten, die denselben Discord-Account koppeln — Testszenario, kein automatisierter Check in dieser Sitzung möglich. Für dieselbe Sichtrunde vorgesehen."

duration: ~65min aktive Ausführung (erster bis letzter Migrations-Commit) zzgl. mehrerer Koordinator-Gegenlese-Runden vor dem Anwenden
completed: 2026-08-17
status: complete
---

# Phase 14 Plan 02: Testpilot-Datenschicht — Rollenspiegel, Sperrliste, Torurteil Summary

**Zwei Postgres-Migrationen (Rollenspiegel/Sperrliste/Schreibsperre/öffentliche Sichten, plus `gate_verdict()`/`tester_overview()` als security-definer-Funktionen) live auf `trgjhmbnodoarnfmlcqx` angewandt über die Supabase Management API, nachdem eine Koordinator-Gegenlese vor dem Anwenden zwei echte Fehler fand, die kein Tor gemeldet hätte.**

## Performance

- **Duration:** ~65 min aktive Ausführung, zzgl. mehrerer Gegenlese-/Warteschleifen mit dem Koordinator vor dem tatsächlichen Anwenden
- **Started:** 2026-08-17T18:23:15Z (erster Task-Commit, `7876f79`)
- **Completed:** 2026-08-17 (Migrationen angewandt vom Koordinator über die Management API, mit ausdrücklicher Freigabe des Betreibers)
- **Tasks:** 3 (Aufgabe 1: Rollenspiegel/Sperrliste/Sichten; Aufgabe 2: gate_verdict()/tester_overview(); Aufgabe 3: [BLOCKING] Anwenden + Gegenprüfung)
- **Files modified:** 2 (beide neu)

## Accomplishments

- `public.discord_role_state` (Bot-Spiegel, RLS mit genau einer select-Politik) und `public.tester_blocklist` (Sofort-Rauswurf D-10, RLS ohne jede Client-Politik) live angelegt und gegengeprüft.
- `profiles.is_tester` (D-19, öffentliches Abzeichen) und `profiles.tester_credit` (D-22, Zustimmungsschalter) live ergänzt, mit `guard_is_tester()`-Schreibsperre nach dem Muster von `guard_rsi_verified`.
- `public.gate_verdict()` — das Torurteil in genau einem Aufruf (D-04/D-08/D-10/D-13): Sperrliste vor Admin-Kurzschluss vor Discord-Rolle, schreibt `last_staging_seen` bei jedem erlaubenden Urteil fort, parameterlos (Identität ausschließlich aus `auth.uid()`), nur für `authenticated` ausführbar.
- `public.tester_overview()` — die D-13-Übersicht, Rechteprüfung sitzt in der Funktion (klare Absage statt leerer Liste für Nicht-Admins).
- `public.public_profiles` um `is_tester` erweitert, `public.tester_credits` als schmale Namensnennungs-View neu angelegt (D-22).
- `sync_discord_identity()` koppelt die von Supabase geprüfte Discord-Identität serverseitig an den Spiegel (D-03), ohne die Identitäts-Anlage selbst zu gefährden.
- `public.user_roles` bleibt in beiden Dateien vollständig unangetastet (D-05).

## Task Commits

1. **Aufgabe 1: Rollenspiegel, Sperrliste, Spiegelspalten und öffentliche Sichten** — `7876f79` (feat), mit zwei nachträglichen Korrekturen aus der Koordinator-Gegenlese: `ca3c6f2` (fix, sync_discord_identity-Ausnahmebehandlung), `ece25b6` (fix, public_profiles-Spaltenliste)
2. **Aufgabe 2: gate_verdict()/tester_overview()** — `f52d78d` (feat)
3. **Aufgabe 3: [BLOCKING] Migrationen anwenden + gegenprüfen** — kein eigener Commit dieser Sitzung; angewandt vom Koordinator über die Management API (`apply_migration name="discord_tester_gate"`, `apply_migration name="gate_verdict"`, beide `{"success": true}` auf `trgjhmbnodoarnfmlcqx`), mit ausdrücklicher Betreiber-Freigabe

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

_Hinweis:_ die auf der Anlage geführten Migrationsnamen (`discord_tester_gate`, `gate_verdict`) tragen **keinen** Datei-Zeitstempel und stimmen damit nicht wörtlich mit den Dateinamen in `supabase/migrations/` überein — das ist kein Versehen, siehe „Migrationsweg" unten.

## Files Created/Modified

- `supabase/migrations/20260818000000_discord_tester_gate.sql` — `discord_role_state`, `tester_blocklist`, zwei `profiles`-Spalten, `guard_is_tester()`-Trigger, `public_profiles`-Erweiterung, `tester_credits`-View, `sync_discord_identity()`-Trigger auf `auth.identities`
- `supabase/migrations/20260818001000_gate_verdict.sql` — `gate_verdict()`, `tester_overview()`

## Migrationsweg: Management API statt `supabase db push`

Dieses Projekt hat **kein** funktionierendes `supabase db push`. Die lebende Anlage führt 24 bereits angewandte Migrationen mit Namen wie `accounts_profiles_favorites` — ohne Datei-Zeitstempel, nie über die CLI eingespielt. `supabase/migrations/` im Repo enthält 11 Dateien mit davon völlig unabhängigen Zeitstempeln. Ein `supabase migration repair --status reverted` über alle 24, wie es die CLI bei einer Diskrepanz vorschlägt, wäre falsch und gefährlich gewesen — es hätte bereits Angewandtes als zurückgenommen markiert. Der Koordinator hat die beiden Migrationen dieses Plans deshalb bewusst über dieselbe Management API angewandt, über die auch die 24 vorherigen liefen (`apply_migration`, Namen ohne Zeitstempel: `discord_tester_gate`, `gate_verdict`), mit ausdrücklicher Freigabe des Betreibers — nicht aus Bequemlichkeit, sondern weil es der einzige Weg ist, der in diesem Projekt tatsächlich funktioniert. Künftige Migrationen dieser Phase sollten denselben Weg gehen.

## Decisions Made

- **`sync_discord_identity()`-Konfliktverhalten (Kandidat a):** eine doppelte Discord-Kopplung scheitert weiterhin (ein Discord-Account darf nur an ein Konto gebunden sein — die gewollte Invariante hinter dem `unique`-Index auf `discord_user_id`), aber mit einer sprechenden Meldung statt der rohen Postgres-Fehlermeldung. Kandidat b (die ältere Zeile stillschweigend entkoppeln) wurde bewusst nicht gewählt — das wäre eine Entscheidung über ein fremdes Konto, die dem Betreiber gehört.
- **Fehlerbehandlung asymmetrisch nach Risiko gewichtet:** die eine erwartbare, bedeutungsvolle Ausnahme (`unique_violation`, echter Geschäftsregel-Konflikt) wirft weiter; jede andere, strukturell unerwartete Ausnahme (`foreign_key_violation`, `others`) wirft nur noch eine `WARNING` — ein Spiegel-Eintrag darf nie eine funktionierende Anmeldung mitreißen.
- **Migrationsweg Management API statt CLI** (siehe eigener Abschnitt oben) — folgt dem bereits etablierten, einzig funktionierenden Weg dieses Projekts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `sync_discord_identity()` fing die falsche Eindeutigkeitsverletzung nicht ab**
- **Found during:** Koordinator-Review vor dem Anwenden (kein Tor — reines Gegenlesen)
- **Issue:** `discord_role_state.discord_user_id` trägt einen eigenen `unique`-Index, getrennt vom Primärschlüssel `user_id`. Der Insert schrieb `on conflict (user_id) do update`, das deckt nur Konflikte auf dem Primärschlüssel ab. Hielt ein ANDERES Konto bereits dieselbe `discord_user_id`, verletzte der Insert stattdessen den `unique`-Index auf `discord_user_id` — die `on conflict`-Klausel fing das nicht ab, die Ausnahme warf roh weiter. Da der Trigger `AFTER INSERT ON auth.identities` sitzt, hätte eine unbehandelte Ausnahme das Anlegen der gesamten Identität zurückgerollt: die Discord-Kopplung wäre mit einer unverständlichen Postgres-Meldung gescheitert, genau dann, wenn jemand seinen Discord-Account an ein zweites Konto hängt.
- **Fix:** `unique_violation` wird abgefangen und durch eine sprechende Meldung ersetzt (Kandidat a, siehe „Decisions Made"); `foreign_key_violation` und jede andere unerwartete Ausnahme werfen nur noch eine `WARNING`; `provider_id is null` wird vorab abgefangen (kein Insert-Versuch).
- **Files modified:** `supabase/migrations/20260818000000_discord_tester_gate.sql`
- **Verification:** `npm run build && npm run gate` erneut grün (18/18, Schiene A); manuelle Nachprüfung der PL/pgSQL-Semantik (ein `RAISE EXCEPTION` innerhalb eines `EXCEPTION WHEN`-Handlers wirft eine neue Ausnahme, die denselben Block nicht erneut durchläuft — als Kommentar an der Stelle festgehalten)
- **Committed in:** `ca3c6f2`

**2. [Rule 1 - Bug] `public.public_profiles` wurde gegen die Urfassung neu gebaut, nicht gegen die aktuell lebende Definition**
- **Found during:** Koordinator-Gegenlese unmittelbar vor dem Anwenden über die Management API (kein Tor)
- **Issue:** Abschnitt 5 baute die View gegen `20260723000000_public_profile_views.sql` (14 Spalten, endet auf `created_at`). Zwei spätere Migrationen (`20260725000000_add_last_seen_presence.sql`, `20260725110000_presence_two_signal.sql`) hatten die View seither neu erzeugt — die lebende Fassung hat 15 Spalten und endet auf eine berechnete `presence`-Spalte. `CREATE OR REPLACE VIEW` erlaubt nur Anhängen ans Ende; meine Fassung hätte `is_tester` an Position 13 gesetzt (wo live `org_name` steht) und `presence` ganz weggelassen. Zwei mögliche Folgen: entweder ein Abbruch mit „cannot change name of view column", oder — schlimmer, da `presence` zufällig die letzte Spalte der lebenden Fassung war — ein stillschweigender Spaltenverlust. `src/components/pilot/PilotPage.astro` fragt `presence` alle 40 Sekunden für die Live-Präsenzanzeige auf JEDEM öffentlichen Pilotenprofil ab, site-weit — ein Bruch auf der LIVE-Seite, nicht nur auf staging.
- **Fix:** die vollständige, aktuelle Definition aus `20260725110000_presence_two_signal.sql` wortgetreu übernommen (Zwei-Signal-`CASE`-Ausdruck für `presence` eingeschlossen), `is_tester` ganz am Ende angehängt, hinter `presence`. Warnkommentar mit allen drei Quelldateien ergänzt, damit ein künftiger Ersetzer von der jüngsten Fassung ausgeht, nicht von der ersten.
- **Files modified:** `supabase/migrations/20260818000000_discord_tester_gate.sql`
- **Verification:** `npm run build && npm run gate` erneut grün (18/18, Schiene A); Spaltenreihenfolge manuell gegen `20260725110000_presence_two_signal.sql` Zeile für Zeile verglichen
- **Committed in:** `ece25b6`

**3. [Rule 1 - Bug, Dokumentation] Kopfzeilen-Verweis auf `user_roles`-CHECK-Klausel war veraltet**
- **Found during:** dieselbe Koordinator-Gegenlese
- **Issue:** die Kopfzeile behauptete, `scripts/supabase-schema.sql` (Zeilen 68-91, `CHECK (role IN ('user','admin'))`) sei die lebende Wahrheit. Live gilt seit einer Migration `user_roles_allow_beta` (24.07.2026, im Repo nicht vorhanden) `role = ANY (ARRAY['user','admin','beta'])` — ein dritter erlaubter Wert. D-05 ändert das nicht (die Entscheidung trägt auf dem Primärschlüssel, nicht auf der Zahl der erlaubten Werte), der Dateiverweis war aber irreführend.
- **Fix:** Kommentar korrigiert, verweist jetzt auf den Primärschlüssel als eigentliche D-05-Grundlage statt auf eine veraltete Datei.
- **Files modified:** `supabase/migrations/20260818000000_discord_tester_gate.sql`
- **Committed in:** `ece25b6`

---

**Total deviations:** 3 auto-fixed (2 echte Bugs mit Live-Risiko, 1 irreführende Dokumentation) — alle drei wurden ausschließlich durch Gegenlesen gefunden, **kein Tor hätte sie gemeldet**. Das ist der eigentliche Befund dieses Plans: statische Prüfungen (die eingebetteten `<verify>`-Substring-Checks, `npm run gate`) bestätigen Textbausteine und Site-Verhalten, aber weder eine PL/pgSQL-Ausnahmebehandlungs-Lücke noch eine gegen die falsche Migrationshistorie gebaute View. Beide Fehler wurden gefunden und behoben, **bevor** irgendetwas auf der lebenden Datenbank angewandt wurde.
**Impact on plan:** alle drei Fixes waren notwendig, um die vom Plan geforderte Sicherheit/Korrektheit tatsächlich zu erreichen. Kein Scope-Creep — jeder Fix bleibt innerhalb der beiden Migrationsdateien, die der Plan ohnehin vorsah.

## Known Stubs

Keine Stubs im geschriebenen SQL. Drei Verhaltens-Zusicherungen sind aber **nicht** gegen die lebende Anlage geprüft (siehe „Issues Encountered" und `coverage` D4-D6 oben) — das sind offene Prüfpunkte, keine unfertigen Artefakte.

## Issues Encountered

- **Lesezugriff auf die Datenbank war in der Anwendungssitzung gesperrt** (`execute_sql` vom Berechtigungsprüfer abgewiesen). Die Existenz von `profiles.is_tester`/`profiles.tester_credit` sowie die korrekte Spaltenreihenfolge von `public_profiles` sind deshalb nur LOGISCH belegt (`public_profiles`/`tester_credits` hätten sonst nicht erstellt werden können; `CREATE OR REPLACE VIEW` hätte sonst mit „cannot change name of view column" abgebrochen), nicht direkt gegengelesen. Als offener Punkt (`coverage` D2/D3) vermerkt.
- **Drei Verhaltens-Zusicherungen brauchen eine echte Sitzung/echte Konten, die in dieser Ausführungssitzung nicht verfügbar waren:**
  1. Der vorgeführt-rote Nachweis zu `guard_is_tester()`: ein normales Nutzerkonto darf `is_tester` nicht auf `true` setzen, `tester_credit` dagegen schon.
  2. Dass `anon` `gate_verdict()` nicht ausführen darf.
  3. Der Kopplungsfall aus `ca3c6f2`: zwei Konten, dieselbe Discord-ID → sprechende Meldung statt roher Constraint-Verletzung.
  Alle drei sind für die Sichtrunde des Betreibers vorgesehen, sinnvollerweise gebündelt mit der Inbetriebnahme der Vorschau-Umgebung (Plan 08/12) — siehe `coverage` D4-D6.
- **`supabase db push` ist in diesem Projekt strukturell unbrauchbar** (siehe „Migrationsweg" oben) — kein Fehler dieser Sitzung, aber eine strukturelle Eigenschaft, die jede künftige Migration dieser Phase kennen muss.

## User Setup Required

None — diese Migrationen brauchen keine neuen Umgebungsvariablen oder Dashboard-Konfiguration. (Die drei `VB_GATE_SECRET`/`VB_SUPABASE_URL`/`VB_SUPABASE_ANON_KEY`-Variablen aus Plan 01 bleiben die einzige offene Coolify-Einrichtung dieser Phase.)

## Next Phase Readiness

- Die Datenschicht des Testpilot-Tors steht live: `gate_verdict()` kann ab sofort per PostgREST-RPC mit dem Nutzertoken aufgerufen werden, ohne Service-Schlüssel im nginx-Container — die Voraussetzung, die spätere Pläne (u. a. 14-08/14-09) brauchen, um `nginx/gate.js`s `mint()` von seinem heutigen direkten `user_roles`-Lesezugriff auf diesen einen RPC-Aufruf umzustellen.
- `public.tester_overview()` steht für die D-13-Übersicht bereit, sobald ein Plan eine Konto-Oberfläche dafür baut.
- **Drei offene Verhaltens-Prüfpunkte** (siehe `coverage` D4-D6) sind an den Betreiber übergeben, für die Sichtrunde nach Inbetriebnahme der Vorschau — kein Blocker für die Fortsetzung der Phase, aber vor dem endgültigen Abschluss dieser Phase nachzuholen.
- Kein Blocker für die Fortsetzung der Phase.

---
*Phase: 15-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-17*

## Self-Check: PASSED

Beide Migrationsdateien und diese SUMMARY.md gefunden; alle 4 zitierten Commit-Hashes (`7876f79`, `f52d78d`, `ca3c6f2`, `ece25b6`) im Verlauf des Zweigs `claude/staging-tester-role-access-308ebf` gefunden. `npm run build && npm run gate` zuletzt nach `ece25b6` grün (18/18, Schiene A). Anwendung auf die lebende Anlage vom Koordinator über die Management API bestätigt (`apply_migration` für `discord_tester_gate` und `gate_verdict`, beide `{"success": true}` auf `trgjhmbnodoarnfmlcqx`), gegengeprüft für `discord_role_state`/`tester_blocklist` via `list_tables`; die übrigen Zusicherungen (`coverage` D2-D6) sind als offene Punkte dokumentiert, nicht als erledigt behauptet.
