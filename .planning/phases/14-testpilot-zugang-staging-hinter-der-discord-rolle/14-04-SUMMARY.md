---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 04
subsystem: auth
tags: [supabase-auth, discord-oauth, implicit-flow, gotrue, astro]

requires:
  - phase: 14-01
    provides: "gate.astro (Torseite, SDK-frei, inline CSS/JS), nginx/gate.js (Mint-Endpunkt /_gate/mint)"
  - phase: 14-03
    provides: "D-02-Riegel in public.handle_new_user() -- live, blockt unbekannte Discord-Konten mit einem handgeschriebenen Meldungstext"
provides:
  - "Discord-Anmeldeknopf in AuthLogin.astro (DE+EN, gleichrangig neben E-Mail/Passwort, D-01)"
  - "Discord-Anmeldeknopf als Hauptweg auf gate.astro, SDK-frei, ueber dem weiterhin funktionsfaehigen E-Mail-Formular (D-04 bleibt gewahrt)"
  - "D-02-Absage-Erkennung an ZWEI Stellen (eigener Meldungstext ODER GoTrue-Generic-Wrapper), niemals Rohtext aus error_description"
  - "Fragment-Haergiene (T-14-23): access_token/error werden nach dem Auslesen per history.replaceState aus der Adresszeile entfernt"
  - "Zwei WINDOWS.md-Eintraege (id 18: Identitaets-Verknuepfungs-Einstellung im Supabase-Dashboard unauffindbar/ungeklaert; id 19: vier Durchlaeufe des Discord-Anmeldewegs als Sichtpunkt)"
affects: [14-08, 14-09, 14-12]

tech-stack:
  added: []
  patterns:
    - "OAuth-Rueckruf auf die eigene Seite statt auf eine dritte Zielseite: vermeidet, dass ein #error=...-Fragment auf einer Zwischenstation (hier: das Dashboard-Skript, das ohne Sitzung sofort weiterleitet) verlorengeht, bevor es gelesen wird."
    - "Zweigleisige Fehlererkennung fuer eine Datenbank-Ausnahme hinter GoTrue: sowohl auf den eigenen, im Trigger formulierten Text als auch auf GoTrues bekannten generischen Wrapper (\"Database error saving new user\", error_code unexpected_failure) pruefen, solange nicht LIVE bewiesen ist, welche Form tatsaechlich durchkommt."

key-files:
  created: []
  modified:
    - src/components/account/AuthLogin.astro
    - src/pages/gate.astro
    - .planning/WINDOWS.md

key-decisions:
  - "AuthLogin.astro: redirectTo zeigt auf die Login-Seite selbst (location.origin + location.pathname + location.search), NICHT auf /account/ wie im Plan-Actiontext woertlich genannt. Grund: account-dashboard.ts leitet ohne Sitzung per location.replace() sofort zu login.html weiter -- dabei ginge ein #error=...-Fragment aus einer abgewiesenen Discord-Anmeldung verloren, bevor irgendein Code es lesen koennte, und die D-02-Absage waere nie sichtbar. Der Ruecksprung auf sich selbst behandelt Erfolg (bestehender getSession()-Zweig leitet weiter) und Fehler (neuer Block) an derselben Stelle. Rule-1-Fix (Korrektheit vor woertlicher Plananweisung), dokumentiert."
  - "D-02-Erkennung matcht auf ZWEI Formen (eigener Text 'kein Konto auf verse-base.com' ODER GoTrue-Generic 'Database error saving new user'/error_code unexpected_failure), weil WINDOWS.md id 16 (aus Plan 14-03) offen laesst, welche Form beim echten Discord-OAuth-Ruecklauf ankommt. Fuer den pessimistischen Fall gebaut; kommt der eigene Text durch, greift derselbe Zweig ebenfalls."
  - "Kein Rohtext aus error_description/error_code wird je angezeigt -- nur handgeschriebene Konstanten, sowohl bei Treffer als auch beim allgemeinen Fallback."

requirements-completed: [D-01, D-03, D-11]

duration: ~50min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 04: Discord als zweiter Anmeldeweg -- Konto und Torseite Summary

**Discord-Anmeldeknopf gleichrangig neben E-Mail/Passwort in AuthLogin.astro und als Hauptweg auf gate.astro; beide erkennen den D-02-Riegel aus Plan 03 sowohl am eigenen Meldungstext als auch am GoTrue-Generic-Wrapper und zeigen nie einen Rohtext aus der Datenbank.**

## Performance

- **Duration:** ~50min aktive Ausfuehrung (nach dem Betreiber-Checkpoint fuer Aufgabe 1, Provider-Einrichtung durch den Koordinator)
- **Completed:** 2026-08-18
- **Tasks:** 2 (Aufgabe 1: Discord-Provider einschalten [BLOCKING, checkpoint:human-action] -- vom Koordinator/Betreiber erledigt und mit einer echten `curl`-Weiterleitungsprobe belegt; Aufgabe 2: Discord-Knopf in AuthLogin.astro + gate.astro)
- **Files modified:** 3 (AuthLogin.astro, gate.astro, WINDOWS.md)

## Accomplishments

- Discord ist jetzt ein gleichberechtigter zweiter Anmeldeweg im Konto-Bereich (D-01): ein Knopf in voller Formularbreite unterhalb des E-Mail/Passwort-Formulars, in beiden Sprachfassungen (`dist/account/login.html`, `dist/de/account/login.html`).
- Auf der Torseite (`gate.astro`) ist Discord der Hauptweg -- der Knopf steht ueber dem E-Mail-Formular, das E-Mail-Formular bleibt vollstaendig funktionsfaehig (D-04, der Discord-unabhaengige Weg des Betreibers). SDK-frei umgesetzt: kein `/_astro/`-Buendel auf der Torseite (automatisiert geprueft).
- Der Weg zur Rolle (D-11, Link auf `DISCORD.invite`) stand bereits aus Plan 01 auf der Seite und ist unveraendert erhalten.
- Beide Stellen behandeln den D-02-Riegel aus Plan 03 an derselben Codestelle wie den Erfolgsfall: das URL-Fragment (`flowType: 'implicit'`) wird ausgelesen, sofort per `history.replaceState` entfernt (T-14-23), und ein `error`-Parameter wird gegen ZWEI moegliche Formen geprueft -- den eigenen, im Trigger formulierten Text und GoTrues bekannten generischen Wrapper ("Database error saving new user", `error_code=unexpected_failure") -- weil `.planning/WINDOWS.md` id 16 (aus Plan 14-03) offenlaesst, welche Form beim echten Discord-Ruecklauf tatsaechlich ankommt. Kein Rohtext aus `error_description` wird je angezeigt.
- Discord Client ID/Secret, `Server Members Intent`, die staging-Redirect-URL und der bestehende `AgencyOS`-Platzhalter-Fund im Client-ID-Feld wurden vom Koordinator eingerichtet und behoben (siehe Deviations); mit `curl` gegen `https://trgjhmbnodoarnfmlcqx.supabase.co/auth/v1/authorize?provider=discord` vierfach belegt: 302 statt Fehler, korrekte Client-ID, deckungsgleiche Callback-URL, minimale Scopes `email identify`.
- Zwei offene Punkte als benannte Eintraege in `.planning/WINDOWS.md` gefuehrt (id 18, id 19) statt stillschweigend als erledigt gezaehlt.

## Task Commits

1. **Aufgabe 1: Discord-Provider einschalten [BLOCKING]** -- kein eigener Executor-Commit; vom Koordinator/Betreiber in zwei fremden Oberflaechen (Discord Developer Portal, Supabase Dashboard) eingerichtet, mit einer echten `curl`-Weiterleitungsprobe belegt (siehe Deviations unten).
2. **Aufgabe 2: Discord-Knopf in AuthLogin.astro + gate.astro (D-01, D-11)** -- `a8962ab` (feat)

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

## Files Created/Modified

- `src/components/account/AuthLogin.astro` -- Discord-Knopf (`#discordBtn`) unterhalb des Formulars, `data-msg-discord-blocked`/`data-msg-oauth` am `<form>`-Element, Fragment-Fehlererkennung vor dem bestehenden `getSession()`-Aufruf, Klick-Handler ruft `supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + location.pathname + location.search } })`.
- `src/pages/gate.astro` -- Discord-Knopf (`#gateDiscordBtn`) ueber dem Formular, SDK-freier Klick-Handler (`location.href` auf `${SUPABASE_URL}/auth/v1/authorize?provider=discord&redirect_to=...`), `handleOauthReturn()`-IIFE liest `access_token`/`error` aus dem Fragment, legt die Sitzung in derselben Form wie `assets/account-lite.js` ab und mintet, oder zeigt die Absage-Anzeige (bei D-02-Treffer mit Link auf `https://verse-base.com/account/register.html`).
- `.planning/WINDOWS.md` -- zwei neue Eintraege (id 18, id 19, siehe unten).

## Decisions Made

- **redirectTo zeigt auf die Login-Seite selbst, nicht auf `/account/`** wie der Plan-Actiontext woertlich vorgab -- siehe `key-decisions` oben. Ohne diese Korrektur waere die D-02-Absage auf `/account/login.html` nie sichtbar geworden: `account-dashboard.ts` leitet ohne Sitzung sofort per `location.replace(D.login! + '?next=...')` weiter, und dieser Aufruf traegt keinen Hash -- ein `#error=...`-Fragment aus einer abgewiesenen Discord-Anmeldung waere dabei ersatzlos verworfen worden, bevor irgendein Code es haette lesen koennen. `gate.astro` folgte bereits demselben "Ruecksprung auf sich selbst"-Muster (aus dem Plan-Actiontext uebernommen); dieselbe Logik wurde fuer AuthLogin.astro als notwendige Korrektur uebernommen.
- **Zweigleisige D-02-Erkennung** statt Verlass auf einen einzelnen erwarteten Text -- WINDOWS.md id 16 belegt, dass unklar ist, ob GoTrue den im Trigger formulierten Text durchreicht oder generisch verpackt. Beide Formen fuehren zum selben handgeschriebenen Hinweis.
- **`innerHTML` statt `textContent` fuer die gate.astro-Absage mit Registrierungslink** -- ausschliesslich mit fest verdrahteten, eigenen Konstanten befuellt, nie mit `error_description`/`error_code`; kein XSS-Risiko, da kein Nutzereingabe-/Serverwert je in den Markup-String einfliesst.

## Deviations from Plan

### Koordinator-Vorarbeit vor Aufgabe 2 (kein Rule-Fall, Checkpoint-Erledigung)

**Aufgabe 1 wurde vom Koordinator/Betreiber ausgefuehrt, nicht vom Executor** (wie vom Plan verlangt -- `checkpoint:human-action`, `gate="blocking"`). Dabei zwei echte Befunde:

1. **[Befund] `Client ID` im Supabase-Dashboard trug `AgencyOS`** -- ein Ueberbleibsel einer fremden Integration, keine Discord-ID. Waere das stehen geblieben, waere jeder Discord-Anmeldeversuch mit "invalid client" gescheitert, ohne erkennbaren Grund fuer einen Nutzer. Vom Koordinator auf `1530625191011422330` korrigiert.
2. **[Befund] Redirect URLs im Supabase-Dashboard fehlte `https://staging.verse-base.com/**`** -- Bestand war nur `https://verse-base.com/**` und `http://localhost:4321/**`. Ohne diesen Eintrag haette Supabase jeden Ruecksprung zur Torseite abgewiesen. Vom Koordinator ergaenzt.
3. **[Ungeklaert, nicht behoben]** Die Einstellung zum Verknuepfen von Identitaeten bei gleicher E-Mail-Adresse konnte der Koordinator im Dashboard nicht lokalisieren -- als WINDOWS.md id 18 gefuehrt (siehe unten), NICHT als "ist an" behandelt.

Vierfach mit `curl` gegen `https://trgjhmbnodoarnfmlcqx.supabase.co/auth/v1/authorize?provider=discord` belegt: 302 statt Fehler (Provider aktiv), korrekte Client-ID, deckungsgleiche Callback-URL, Scopes `email+identify` (keine Ueberreichweite, D-03-konform).

### Auto-fixed Issues (Rule 1, Aufgabe 2)

**1. [Rule 1 - Bug] Plan-Actiontext haette die D-02-Absage auf AuthLogin.astro strukturell verhindert**
- **Found during:** Entwurf der `redirectTo`-Ziel-URL fuer Aufgabe 2
- **Issue:** Der Plan-Actiontext nennt `redirectTo: <Ursprung> + '/account/'` (das Dashboard). Das Dashboard-Skript (`account-dashboard.ts:113-120`) prueft `getSession()` und leitet OHNE Sitzung sofort per `location.replace(D.login! + '?next=...')` weiter -- ein Aufruf, der die URL VOLLSTAENDIG ersetzt, also auch das `#error=...`-Fragment einer abgewiesenen Discord-Anmeldung verwirft, bevor irgendein Code (auch nicht `AuthLogin.astro`, das dort gar nicht eingebunden ist) es lesen koennte. Ein woertlicher Bau haette D-02s Kern-Zusicherung ("Ein unbekanntes Discord-Konto sieht 'bitte erst regulaer registrieren' -- keinen nackten Serverfehler") auf dem Konto-Weg strukturell unerfuellbar gemacht.
- **Fix:** `redirectTo` auf `location.origin + location.pathname + location.search` (die Login-Seite selbst) gesetzt -- identisch zum bereits im Plan fuer `gate.astro` vorgegebenen "Ruecksprung auf sich selbst"-Muster. Erfolg und Fehler werden dadurch an derselben Stelle behandelt, ohne `account-dashboard.ts` anzufassen (bleibt ausserhalb `files_modified`).
- **Files modified:** `src/components/account/AuthLogin.astro`
- **Verification:** `npm run build` erzeugt `dist/account/login.html`/`dist/de/account/login.html` mit dem Discord-Knopf; das automatisierte Plan-`<verify>` bestand. Der echte Rundlauf (WINDOWS.md id 19) braucht ein menschliches Urteil und echte Discord-Konten -- vom Executor nicht durchfuehrbar.
- **Committed in:** `a8962ab`

## Known Stubs

Keine -- beide Codeaenderungen sind vollstaendig implementiert. Die Verknuepfung zwischen Discord-Identitaet und `discord_role_state` braucht in diesem Plan keinen eigenen Code (der Trigger `trg_sync_discord_identity` aus Plan 02, real bestaetigt in Plan 03, uebernimmt das serverseitig -- D-03).

## Issues Encountered

- **Der echte OAuth-Rundlauf durch drei fremde Systeme (Browser -> Discord -> Supabase -> Browser) ist im Bau nicht nachstellbar.** Kein Repo-Testkonto existiert, und keins wurde spekulativ angelegt (Package-/Credential-Vorsicht, dieselbe Linie wie in Plan 01). Als `.planning/WINDOWS.md` id 19 gefuehrt, mit allen vier vom Plan verlangten Durchlaeufen woertlich uebernommen.
- **Die Verknuepfungs-Einstellung fuer gleiche E-Mail-Adressen im Supabase-Dashboard bleibt ungeklaert.** Ist sie AUS, legt Supabase bei einem BEKANNTEN Nutzer, der sich per Discord anmeldet, ein NEUES Konto an -- der D-02-Riegel greift dann faelschlich fuer einen bereits registrierten Nutzer. Client-seitig nicht von einem echten unbekannten Konto unterscheidbar (derselbe Fehler, derselbe Text). Als `.planning/WINDOWS.md` id 18 gefuehrt.
- **WINDOWS.md id 16 (aus Plan 14-03) bleibt offen** -- ob der eigene Meldungstext oder GoTrues generischer Wrapper beim echten Ruecklauf ankommt, ist erst mit einem echten Discord-Signup-Versuch feststellbar (Teil des Rundlaufs in id 19). Der Code ist fuer BEIDE Formen gebaut; welche tatsaechlich zutrifft, aendert nichts am Verhalten.

## User Setup Required

Keins fuer diesen Plan direkt (Aufgabe 1 wurde bereits vom Koordinator/Betreiber erledigt). Offen bleibt die Klaerung der Identitaets-Verknuepfungs-Einstellung im Supabase-Dashboard (WINDOWS.md id 18) und der echte Anmelde-Rundlauf (WINDOWS.md id 19) -- beides Sichtpunkte fuer den Betreiber, keine Umgebungskonfiguration.

## Next Phase Readiness

- Discord ist als zweiter Anmeldeweg im Code fertig -- Konto UND Torseite, mit derselben D-02-Absage-Behandlung an beiden Stellen.
- `npm run build && npm run gate`: 18/18 gruen, sowohl normal als auch mit `STAGING=1` (CLAUDE.md-Pflicht fuer Tor-/Layout-Aenderungen erfuellt).
- `npm run audit:csp`: sauber -- keine neue Gegenstelle noetig, der OAuth-Sprung zu Discord ist eine Navigation und unterliegt der Richtlinie nicht; die einzige `connect-src`-relevante Gegenstelle (Supabase) stand bereits in der Richtlinie.
- Kein Blocker fuer die Fortsetzung der Phase. Zwei neue Sichtpunkte (WINDOWS.md id 18, id 19) sind an den Betreiber uebergeben, keiner davon blockiert die naechsten Plaene.

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

`src/components/account/AuthLogin.astro`, `src/pages/gate.astro` und diese SUMMARY.md auf der Platte gefunden; Commit `a8962ab` im Verlauf des Zweigs `claude/staging-tester-role-access-308ebf` gefunden (`git log --oneline -1 a8962ab`). `npm run build && npm run gate` zuletzt gruen (18/18, Schiene A, normal UND mit `STAGING=1`); `npm run audit:csp` sauber. WINDOWS.md-Eintraege id 18 und id 19 auf der Platte bestaetigt (`gsd-tools query windows.list` bzw. Datei-Grep).
