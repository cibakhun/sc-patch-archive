---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 10
subsystem: ui
tags: [astro, supabase, postgrest, i18n]

requires:
  - phase: 14-02
    provides: "profiles.is_tester/tester_credit, guard_is_tester()-Trigger, public_profiles um is_tester erweitert, public.tester_credits-View, public.tester_overview() (admin-only RPC)"
provides:
  - "Testpilot-Abzeichen auf dem oeffentlichen Piloten-Profil (/pilot/<handle>), zweites Abzeichen nach RSI, eigene Farbe (D-19)"
  - "Zustimmungsschalter fuer die Namensnennung im Konto, Standard AUS, nur fuer is_tester=true sichtbar (D-22)"
  - "Testpiloten-Uebersicht im Konto, nur fuer admin-Konten, RPC-Aufruf unterbleibt fuer alle anderen vollstaendig (D-13)"
  - "Namensnennungs-Liste auf der Feedback-Seite, SDK-freier PostgREST-Lesezugriff auf tester_credits, leer wenn niemand zugestimmt hat (D-22)"
affects: [14-11, 14-12]

tech-stack:
  added: []
  patterns:
    - "Zustands-Toggle im Konto: DB-gelesenes Feld gesteuert (is_tester bestimmt Sichtbarkeit), Nutzer-Feld gesteuert (tester_credit ist Wert des Schalters) — beide im selben profileState-Objekt, aber mit ausdruecklich unterschiedlichem Sendeverhalten beim Speichern (Kommentar an der Speicherstelle traegt beide Faelle)"
    - "Admin-Gate ohne die is-admin-classList von account-lite.js: auf /account/-Seiten laeuft account-lite.js nicht (volles supabase-js), also direkte user_roles-Abfrage VOR jedem privilegierten RPC-Aufruf statt Fehlerabfangen nach dem Aufruf"
    - ":empty { display:none } fuer datengetriebene Abschnitte ohne Server-Vorwissen — uebernommen aus PilotPage.astro .pp-badges, hier fuer die Testpiloten-Namensliste auf der Feedback-Seite"

key-files:
  created: []
  modified:
    - src/components/pilot/PilotPage.astro
    - src/components/account/AccountDashboard.astro
    - src/scripts/account-dashboard.ts
    - src/components/FeedbackForm.astro

key-decisions:
  - "Testpilot-Badge-Farbe #ff5e1a uebernommen von C.craftOrange (discord/blueprint.mjs) -- dieselbe Auszeichnung traegt an beiden Orten dieselbe Farbe (D-19); Hellmodus-Gegenstueck #b1330a von Hand danebengesetzt (verify:theme bestaetigt: kein erzeugter Block beruehrt)"
  - "Admin-Uebersicht per direkter user_roles-Abfrage vor tester_overview() gegattert, nicht per account-lite.js-is-admin-Klasse -- die Klasse wird auf /account/-Seiten nie gesetzt, weil account-lite.js dort gar nicht laeuft (Praezedenz-Kommentar in FriendsManager/account-dashboard.ts)"
  - "Namensnennung auf der Feedback-Seite, NICHT auf der Unterstuetzen-Seite -- die sagt woertlich 'no perks in your account', eine Testpiloten-Liste dort liesse Tester wie Spender aussehen (Ermessensentscheidung aus dem Plan, hier vollzogen)"
  - "reveal-Klasse bewusst NICHT auf den neuen Testpiloten-Kasten der Feedback-Seite gesetzt -- Inhalt entsteht erst nach einem Fetch, ein IntersectionObserver auf einem anfangs display:none-Element (via :empty) haette unklares Zusammenspiel mit dem Reveal-System ergeben; die Zeile ist bewusst konservativ"

patterns-established:
  - "Rollenspiegel-Badges (is_tester-artige Felder): neues .pp-badge--<name> IMMER nach dem bestehenden .pp-badge--verified pushen, nie davor, sonst verdreht sich die etablierte Rangfolge der Nachweise"

requirements-completed: [D-13, D-19, D-22]

coverage:
  - id: D1
    description: "Testpilot-Abzeichen erscheint auf /pilot/<handle> fuer is_tester=true, nach dem RSI-Abzeichen, eigene Farbe, Hellmodus-Gegenstueck vorhanden"
    requirement: D-19
    verification:
      - kind: automated_ui
        ref: "npm run build && npm run verify:theme && npm run verify:layers (beide gruen); eingebetteter node-Check aus PLAN.md Aufgabe 1 (Klasse/Spalte/Beschriftungen/Hellmodus-Gegenstueck vorhanden)"
        status: pass
    human_judgment: true
    rationale: "Ob das Abzeichen neben RSI lesbar ist und die Rangfolge traegt (in beiden Farbmodi, an einem echten is_tester=true-Profil), ist ein Sichturteil -- geht laut Plan als benannter Punkt nach .planning/WINDOWS.md (Plan 12 fuehrt zusammen)."
  - id: D2
    description: "Zustimmungsschalter (tester_credit) im Konto: sichtbar nur bei is_tester=true, Standard AUS, wirkt in beide Richtungen beim Speichern/Laden; is_tester wird nie mitgesendet"
    requirement: D-22
    verification:
      - kind: automated_ui
        ref: "npm run build (TS/Astro kompiliert); eingebetteter node-Check aus PLAN.md Aufgabe 2 (tester_credit/tester_overview verdrahtet, >=4 Fundstellen im Dashboard)"
        status: pass
    human_judgment: true
    rationale: "Das tatsaechliche Umlegen des Schalters, Speichern, erneutes Laden und die Pruefung, dass is_tester nie im Netzwerk-Payload auftaucht, braucht ein echtes, angemeldetes Testpilot-Konto -- in dieser Ausfuehrungssitzung nicht verfuegbar (kein Login-Kontext)."
  - id: D3
    description: "Testpiloten-Uebersicht (tester_overview()) im Konto: nur fuer admin-Konten sichtbar, RPC-Aufruf wird fuer Nicht-Admins gar nicht erst abgesetzt, 'nie erschienen' als Wort statt Leerfeld"
    requirement: D-13
    verification:
      - kind: automated_ui
        ref: "npm run build; eingebetteter node-Check aus PLAN.md Aufgabe 2; manuelle Codepruefung des Gate-Ablaufs (user_roles-Select VOR rpc('tester_overview'), fruehes return bei Nicht-Admin)"
        status: pass
    human_judgment: true
    rationale: "Braucht ein echtes Admin-Konto UND ein echtes Nicht-Admin-Konto gegen die lebende Datenbank, um zu bestaetigen, dass der Aufruf fuer Nicht-Admins wirklich unterbleibt und die Karte fuer Admins die richtigen Zeilen zeigt -- nicht in dieser Sitzung verfuegbar."
  - id: D4
    description: "Namensnennungs-Liste auf der Feedback-Seite: fragt tester_credits (anon, SDK-frei), keine Client-Bedingung auf tester_credit, leer bei leerer Antwort/Fehler, verlinkt auf /pilot/<handle>"
    requirement: D-22
    verification:
      - kind: automated_ui
        ref: "npm run build && npm run audit:site && npm run verify:sync (alle gruen); eingebetteter node-Check aus PLAN.md Aufgabe 3 gegen dist/feedback.html und dist/de/feedback.html (tester_credits + :empty gefunden)"
        status: pass
    human_judgment: true
    rationale: "Der Vier-Zustandswechsel (is_tester=true/tester_credit=false -> nicht gelistet; nach Umlegen -> gelistet) braucht ein echtes Konto gegen die lebende Datenbank -- nicht in dieser Sitzung verfuegbar."

duration: ~55min aktive Ausfuehrung (drei Task-Commits) zzgl. mehrerer voller Gate-Laeufe (normal + STAGING=1)
completed: 2026-08-17
status: complete
---

# Phase 14 Plan 10: Testpilot-Perks auf der Seite — Abzeichen, Zustimmung, Übersicht, Namensnennung Summary

**Drei sichtbare Ergänzungen (Piloten-Profil-Abzeichen, Konto-Zustimmungsschalter samt Admin-Übersicht, Namensnennungs-Liste auf der Feedback-Seite) live gegen das in Plan 14-02 angelegte Schema verdrahtet — `npm run build && npm run gate` zweimal 18/18 grün (normal und `STAGING=1`).**

## Performance

- **Duration:** ~55 min aktive Ausführung (erster bis letzter Task-Commit), zzgl. mehrerer vollständiger Gate-Läufe zur Absicherung
- **Started:** 2026-08-17T21:3x (erster Task-Commit `4b979ff`)
- **Completed:** 2026-08-17T21:52:03+02:00 (letzter Task-Commit `12b02b6`)
- **Tasks:** 3 (Abzeichen; Zustimmungsschalter + Admin-Übersicht; Namensnennung)
- **Files modified:** 4

## Accomplishments

- `.pp-badge--tester` auf `/pilot/<handle>` — zweites Abzeichen nach RSI, Farbe `#ff5e1a` (identisch mit der Discord-Rolle `C.craftOrange`), handgeschriebenes Hellmodus-Gegenstück neben `.pp-badge--verified`.
- Zustimmungsschalter `pfTesterCredit` im Profil-Tab: nur sichtbar bei `is_tester=true`, Standard AUS, schreibt ausschließlich `tester_credit` — der Speicherpfad-Kommentar nennt jetzt beide ausgeschlossenen Felder (`rsi_verified` UND `is_tester`).
- Testpiloten-Übersichtskarte im Sicherheits-Tab: Admin-Status wird per direkter `user_roles`-Abfrage geprüft, **bevor** `tester_overview()` überhaupt aufgerufen wird — für Nicht-Admins bleibt der RPC-Aufruf vollständig aus.
- Namensnennungs-Abschnitt auf der Feedback-Seite (EIN Körper für DE/EN über `FeedbackForm.astro`): SDK-freier `fetch` gegen `public.tester_credits`, leer bei leerer Antwort/Fehler (`:empty { display:none }`), jeder Eintrag verlinkt auf `/pilot/<handle>`.

## Task Commits

1. **Aufgabe 1: Das Testpilot-Abzeichen im Piloten-Profil (D-19)** — `4b979ff` (feat)
2. **Aufgabe 2: Zustimmungsschalter und Testpiloten-Übersicht im Konto (D-22, D-13)** — `28f7de4` (feat)
3. **Aufgabe 3: Die Namensnennung selbst — die Liste der Zustimmenden (D-22)** — `12b02b6` (feat)

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

## Files Created/Modified

- `src/components/pilot/PilotPage.astro` — `COPY.testPilot` (DE/EN), Klasse `.pp-badge--tester` (dunkel + Hellmodus), Badge-Push nach `is_tester === true` direkt nach dem RSI-Badge
- `src/components/account/AccountDashboard.astro` — neue COPY-Schlüssel (Schalter-Text, Übersichts-Überschriften/Spalten), `data-tester-*`-Attribute am `#dash`, Subpanel `#pfTesterPanel` (im `profileForm`, initial `hidden`), Karte `#testerOverviewCard` (initial `hidden`, `<div>` nicht `<section>`)
- `src/scripts/account-dashboard.ts` — `is_tester`/`tester_credit` in `profileState`, Sichtbarkeits-Steuerung des Schalters, `tester_credit` im Speicherpfad (Payload + `Object.assign`), erweiterter Kommentar an der Speicherstelle, neuer Fire-and-forget-Block für die Admin-Übersicht (`user_roles`-Select → `rpc('tester_overview')` → Tabellen-Render oder verborgen bleiben)
- `src/components/FeedbackForm.astro` — `COPY.testersHeading`/`testersLede`, Container `#fbTesters` (leer im Markup), CSS `.fbx-testers`/`.fbx-testerchip` (nur Design-Token-Farben, kein neuer Hellmodus-Block nötig), zweites `<script>` mit dem PostgREST-Fetch gegen `tester_credits`

## Decisions Made

- Badge-Farbe von der Discord-Rolle übernommen (`C.craftOrange` → `#ff5e1a`), Hellmodus-Pendant `#b1330a` von Hand ergänzt, nicht generiert.
- Admin-Gate für die Übersicht per direkter `user_roles`-Abfrage statt der `is-admin`-Klasse aus `account-lite.js`, weil dieses Skript auf `/account/`-Seiten nicht lädt (dort läuft volles `supabase-js`) — die Klasse stünde dort nie zuverlässig zur Verfügung.
- Namensnennung auf der Feedback-Seite statt der Unterstützen-Seite (Ermessensentscheidung, bereits im Plan begründet: „no perks in your account“ dort würde Tester wie Spender aussehen lassen).
- `.fbx-testers` bewusst ohne `reveal`-Klasse: der Inhalt entsteht erst nach einem asynchronen Fetch, ein `IntersectionObserver` auf einem zunächst `:empty`/`display:none`-Element hätte ein unnötiges Interaktionsrisiko mit dem site-weiten Reveal-System eingeführt.

## Deviations from Plan

None — Plan exakt wie geschrieben ausgeführt. Die drei Aufgaben folgten den im Plan benannten Vorbildern (RSI-Badge-Muster, `#rsiVerifiedStatus`-Statusanzeige, `.pp-badges:empty`-Muster) ohne Abweichung.

## Issues Encountered

- **Transiente Build-Abbrüche während der Gate-Läufe** (`cygheap read copy failed`, `Cannot find module .../missionen.astro.mjs`): zweimal aufgetreten, beide Male beim `STAGING=1`-Bauversuch bzw. direkt danach. Ursache ist eine Ressourcen-/Fork-Erschöpfung dieser Ausführungsumgebung (Windows/Cygwin-Bash unter Last), nicht der Code — nach `rm -rf dist` und einem sauberen Neubau lief sowohl der normale als auch der `STAGING=1`-Bau + `npm run gate` je 18/18 grün durch. Kein Code-Fix nötig, hier dokumentiert, damit ein künftiger Leser den Ausschlag nicht dem Plan zuschreibt.
- **`gsd-tools windows append` schlägt fehl** — vorbestehender Parserfehler in `.planning/WINDOWS.md` (`Error: Ledger frontmatter line is not key: value: "last_updated: 2026-08-15T17:20:00.000Z\r"`, ein `\r` in der Frontmatter-Zeile). Nicht durch diesen Plan verursacht (Datei seit Phase 12 unverändert) und außerhalb des Scope Boundary dieses Plans (`files_modified` nennt `.planning/WINDOWS.md` nicht) — nicht repariert. Die vier offenen Sichtprüfungen (siehe `coverage` D1–D4 oben) stehen deshalb NUR in dieser SUMMARY, nicht zusätzlich im Ledger. Für einen künftigen Plan: `.planning/WINDOWS.md` Zeile 7 trägt ein CRLF-Zeilenende, der Rest der Datei vermutlich auch (dasselbe Muster, das CLAUDE.md unter „Sonst" als projektweite Falle nennt: „`.` trifft kein `\r`").

## User Setup Required

None — keine neuen Umgebungsvariablen oder Dashboard-Konfiguration. Die Migrationen aus Plan 02 sind bereits live.

## Next Phase Readiness

- Alle drei sichtbaren Perks aus diesem Plan sind verdrahtet und grün gebaut; der vierte Perk (Kanal + Deploy-Ping auf Discord) folgt in Plan 11.
- **Vier Sichtprüfungen bleiben offen** (siehe `coverage` D1–D4) — sie brauchen ein echtes, angemeldetes Testpilot-Konto bzw. ein Admin-Konto gegen die lebende Datenbank. Für die Zustandswechsel (Schalter an/aus, Abzeichen an/aus) ist explizit ausgeführtes Vor-/Nachher-Verhalten laut Plan-Verifikation gefordert — an den Betreiber übergeben, gebündelt mit Plan 12 (Schluss-Sichtrunde).
- Kein Blocker für die Fortsetzung der Phase.

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-17*

## Self-Check: PASSED

Alle vier geänderten Quelldateien und diese SUMMARY.md gefunden; alle drei Task-Commit-Hashes (`4b979ff`, `28f7de4`, `12b02b6`) im Verlauf des Zweigs `claude/staging-tester-role-access-308ebf` gefunden. `npm run build && npm run gate` zuletzt nach `12b02b6` zweimal 18/18 grün bestätigt (normaler Bau und `STAGING=1`-Vorschau-Bau, siehe „Issues Encountered" zu den zwei transienten Zwischenabbrüchen). Die vier offenen Sichtprüfungen (`coverage` D1–D4) sind als offene Punkte dokumentiert, nicht als erledigt behauptet.
