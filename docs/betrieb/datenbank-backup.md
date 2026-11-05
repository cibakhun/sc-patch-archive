# Datenbank-Backup der Live-Anlage

> **Betriebsanleitung.** Wie die Supabase-Datenbank von Live gesichert wird,
> wie man eine Sicherung prüft und zurückspielt, und was ausdrücklich nicht
> gesichert ist. Stand 05.11.2026. Konkrete Zugangsdaten, Passwörter und
> Schlüssel stehen nirgends in diesem Repo, auch nicht hier.

**Zustand:** implementiert und gegen einen Nachbau mit erfundenen Daten
wiederhergestellt; **gegen Live noch nicht gelaufen**. Dafür fehlen die
Schritte unter [Einrichtung](#einrichtung-einmalig-betreiber), die nur der
Betreiber machen kann (Rolle freischalten, Schlüssel, privates Repo).

---

## Warum

Live (`verse-base`, Ref `trgjhmbnodoarnfmlcqx`) läuft auf dem Free-Plan.
Supabase legt dort **kein einziges Backup** an; erst ab Pro gibt es tägliche
Sicherungen für 7 Tage, und Storage-Dateien sind auch dann nicht dabei
(Plan „Supabase: Staging und Production trennen", 04.11.2026). Ein Fehler in
einer Migration, ein versehentliches `delete` oder ein Problem bei Supabase
hätte bis jetzt alle Konten, Profile, Layouts und Nachrichten gekostet.

Umfang (04.11.2026, nur lesend gemessen): eine kleine Datenbank im
zweistelligen MB-Bereich mit Daten in `public`, `private`, `auth` und
`storage`, zwei öffentliche Buckets (Avatare, Banner), leerer Vault,
Postgres 17.6. Genaue Zählungen stehen im Bericht jedes Laufs, also nur im
privaten Backup-Repo.

## Was gesichert wird — und was nicht

Eine **Datenbanksicherung** ist nicht dasselbe wie eine **Sicherung aller
Dienste**. Diese Anleitung deckt die Datenbank und die Storage-Dateien ab.

| Gesichert (in jedem Archiv) | Woher |
|---|---|
| Alle Tabellen, Views, Funktionen, Trigger, Indizes, Constraints in `public` und `private` | `schema.sql` (Supabase-CLI) |
| RLS-Policies und alle Rechte (Tabellen, Spalten, Funktionen, Standardrechte) | `schema.sql` |
| Alle Daten, auch `auth.users`, `auth.identities` (Discord), Passwort-Hashes, zweite Faktoren, `storage.objects`, Bucket-Einstellungen | `data.sql` |
| Eigene Trigger auf `auth.users`/`auth.identities`, Policies auf `storage.objects`, `direct_messages` in der Realtime-Publikation | `zusatz.sql` (lässt die CLI aus, siehe unten) |
| Eigene Rollen (`vb_backup`) und Rolleneinstellungen (`statement_timeout` von anon/authenticated) | `roles.sql` |
| Migrationshistorie | `history_schema.sql`, `history_data.sql` |
| Die Dateien in Supabase Storage (Avatare, Banner) | `storage/` |
| Objekt- und Rechteliste, Zeilenzahlen, Prüfsummen | `katalog.json`, `manifest.json` |

| **Nicht** gesichert — muss bei einem Neuaufbau von Hand oder aus dem Repo kommen | Wo es steht |
|---|---|
| Auth-Einstellungen: Site URL, Redirect-Liste, Discord-Anbieter (Client-ID/Secret), SMTP, Rate Limits, MFA-Schalter | Supabase-Dashboard; was die Seite voraussetzt: `supabase/config.toml` (Kommentarblock `[auth]`) |
| Edge Functions | Quelltext in `supabase/functions/`, Einstellungen in `supabase/config.toml` |
| Secrets der Functions (Stripe, Discord-Bot, …) | Supabase-Dashboard / Passwortmanager |
| API-Schlüssel und JWT-Secret des Projekts | entstehen neu mit jedem Projekt |
| Coolify-Variablen, Stripe-Webhook, Discord-App, DNS | jeweiliger Dienst |
| Vault-Einträge | heute 0; würden mit dem Projektschlüssel verschlüsselt und wären in einem neuen Projekt nicht lesbar |

## Aufbau

```
 GitHub Actions (privates Repo cibakhun/verse-base-backup, täglich 02:17 UTC)
   │  Skripte aus diesem Repo, auf einen Commit angeheftet
   │
   ├─ 1 sichern.sh ── Session-Pooler ──▶ Live-Datenbank   (Rolle vb_backup: nur lesen)
   │       └─ Storage-Dateien über die öffentlichen Bucket-Adressen (kein Schlüssel)
   ├─ 2 wiederherstellen-probe.sh ──▶ frischer lokaler Supabase-Stack auf dem Läufer
   │       └─ verify-backup.mjs: Objekt für Objekt, Recht für Recht, Zeile für Zeile
   ├─ 3 verschluesseln.sh ── age an den öffentlichen Schlüssel des Betreibers
   │
   └─▶ Artefakt im privaten Repo: verse-base-<zeit>.tar.gz.age (+ .sha256, bericht.md)
        30 Tage (Mo–Sa) bzw. 90 Tage (So, manuelle Läufe)
```

**Warum so (und nicht anders):**

- **GitHub Actions in einem privaten Repo**: läuft ohne den VerseBase-Server,
  ohne Coolify und ohne Website-Deploy; kostet nichts (2.000 Freiminuten im
  Monat, ein Lauf braucht etwa 5 Minuten); GitHub ist schon heute der Ort des
  Codes. Privat, weil dieses Repo öffentlich ist: Logs und Artefakte hier
  könnte jeder lesen. Das Live-Secret liegt nur im privaten Repo.
- **Offizielles Verfahren**: Dump mit den Skripten der Supabase-CLI
  (`supabase db dump --dry-run`, Doku „Backup and Restore using the CLI"),
  ausgeführt in `supabase/postgres` derselben Version wie Live. Die Aufrufe
  und Ausschlüsse (etwa `-x storage.buckets_vectors -x storage.vector_indexes`
  beim Datendump) sind die der Anleitung. Am erzeugten Skript ändern sich
  zwei Dinge: `--role "postgres"` fällt weg, weil die Nur-Lese-Rolle nicht zu
  `postgres` wechseln darf (sie könnte sonst schreiben), und die
  `export PG…`-Zeilen fallen weg, weil die Verbindung samt Passwort aus der
  Umgebung kommt (so steht das Passwort in keiner Befehlszeile).
- **Nur-Lese-Rolle `vb_backup`** (Migration `20261105000000_backup_leserolle.sql`):
  `pg_read_all_data` plus `BYPASSRLS` (sonst bricht `pg_dump` an jeder Tabelle
  mit RLS ab), jede Sitzung read-only, höchstens 2 Verbindungen, 10 Minuten
  Abfragegrenze. Gemessen: `INSERT`, `DELETE`, `UPDATE auth.users`,
  `CREATE TABLE` werden abgewiesen, auch wenn die Sitzung read-only abschaltet.
- **age** (öffentlicher Schlüssel): CI kann verschlüsseln, aber nicht
  entschlüsseln. Wer das Artefakt, das Repo oder den GitHub-Zugang erwischt,
  hat nur Chiffrat. Den privaten Schlüssel hat nur der Betreiber.
- **Probe in jedem Lauf**: ein Dump, der durchlief, beweist nichts. Erst die
  Wiederherstellung zeigt, ob er vollständig ist. Ohne grüne Probe entsteht
  kein Archiv, und der Lauf ist rot.

### Intervall und Aufbewahrung

Täglich, weil die Datenbank klein ist (Archiv rund 0,1–1 MB, Lauf rund
5 Minuten) und ein Tag der größte Verlust ist, den man bei der heutigen Nutzung
hinnehmen kann. 30 Tage für die täglichen Archive, damit
ein spät bemerkter Fehler (falsche Migration, still gelöschte Zeilen) noch
vor dem Fehler zurückgeholt werden kann; 90 Tage für den Sonntagslauf und für
jeden manuellen Lauf (vor einer Live-Migration manuell starten). Das ergibt
höchstens etwa 43 Archive, weit unter den 500 MB Artefaktspeicher des
kostenlosen Plans. Die Fristen begrenzen auch, wie lange gelöschte Konten in
Sicherungen weiterleben (Datenschutz): nach 90 Tagen ist ein gelöschtes
Konto aus allen Archiven verschwunden.

### Was jeder Lauf prüft

| Prüfung | rot, wenn … |
|---|---|
| Verbindung | Benutzer gehört nicht zur Live-Ref (falsches Projekt) |
| `verify-backup inhalt` | eine Tabelle der Quelle fehlt im Dump · eine Tabelle hat Zeilen, der Dump keine · eine eigene Tabelle fehlt in `schema.sql` · ein eigener Trigger, eine Storage-Policy oder die Realtime-Publikation fehlt in `zusatz.sql` · weniger als 10 Konten (Klinke) |
| Storage | eine Datei lässt sich nicht laden oder hat eine andere Größe als in der Datenbank |
| Wiederherstellung | eine einzige SQL-Anweisung schlägt fehl (eine Transaktion) |
| `verify-backup vergleich` | eine Datei hat nicht mehr die sha256 aus dem Manifest · ein Objekt, ein Recht, eine Policy fehlt oder ist anders · ein Recht zu viel · andere Zeilenzahl oder anderer Inhalt in einer Tabelle · ein Sequenzstand weicht ab |
| Storage zurück | eine hochgeladene Datei kommt mit anderer sha256 zurück |
| Verschlüsselung | das fertige Archiv lässt sich mit dem Wegwerf-Schlüssel des Laufs nicht zum identischen Klartext öffnen |

Die Sonde `.github/workflows/probe-backup.yml` fährt denselben Lauf in diesem
Repo gegen eine erfundene Quelle (aus `supabase/migrations/`, drei Probekonten,
zwei Bilder), bei jeder Änderung an den Backup-Skripten **und an den
Migrationen**: eine neue Migration, die die Wiederherstellung bricht, fällt
dort auf, bevor der nächste Live-Lauf es tut. Sie meldet sich zusätzlich mit
einem Probekonto am wiederhergestellten Auth-Dienst an und führt jede Stufe
des Vergleichs einmal absichtlich rot vor (Prüfsumme der Sicherung, Inhalt
der Probe, Katalog). Die erfundene Quelle trägt dafür auch je einen eigenen
Enum-, Domain-, Composite- und Range-Typ und ein Aggregat.

---

## Einrichtung (einmalig, Betreiber)

Etwa 15 Minuten. Reihenfolge einhalten; bis Schritt 5 erledigt ist, läuft
nichts gegen Live.

1. **Schlüssel erzeugen (PC).** `winget install --id FiloSottile.age`, dann
   in einem Ordner außerhalb jedes Repos:
   ```powershell
   age-keygen -o verse-base-backup.key
   ```
   Die Zeile `Public key: age1…` ist der öffentliche Schlüssel. Die Datei
   `verse-base-backup.key` ist der private: in den Passwortmanager (als
   Notiz) **und** auf einen USB-Stick. Nie in ein Repo, nie in eine Cloud
   ohne Passwortmanager, nie in einen Chat. Ohne sie ist jedes Archiv
   wertlos.
2. **Privates Repo anlegen**: `cibakhun/verse-base-backup`, **Private**, ohne
   Inhalt. Dem Claude-GitHub-Zugang Zugriff geben, falls die App nur auf
   ausgewählte Repos darf.
3. **Rolle freischalten (Supabase, SQL-Editor von verse-base).** Die
   Migration `20261105000000_backup_leserolle.sql` legt `vb_backup` ohne
   Anmeldung an; ist sie noch nicht eingespielt, zuerst sie. Dann ein langes
   Zufallspasswort aus dem Passwortmanager:
   ```sql
   alter role vb_backup with login password '<zufallspasswort>';
   ```
4. **Secret und Variable im privaten Repo** (Settings → Secrets and
   variables → Actions):
   - Secret `VB_BACKUP_DB_URL`: die **Session-Pooler**-Adresse aus dem
     Dashboard (Connect → Session pooler), Benutzer durch `vb_backup` ersetzt:
     `postgresql://vb_backup.trgjhmbnodoarnfmlcqx:<passwort>@<pooler-host>:5432/postgres`
     (die direkte Adresse geht nicht: GitHub-Läufer haben kein IPv6).
   - Variable `VB_AGE_EMPFAENGER`: der öffentliche Schlüssel `age1…` aus
     Schritt 1 (mehrere durch Leerzeichen, z. B. ein zweiter Notfallschlüssel).
   - optional Secret `HEALTHCHECK_URL`, siehe [Wächter](#wächter-gegen-stille-ausfälle).
5. **Workflow anlegen**: `scripts/backup/vorlage-backup-repo.yml` als
   `.github/workflows/live-backup.yml` ins private Repo, `QUELLE_SHA` auf den
   Commit von `staging`, auf dem `probe-backup.yml` grün war. Wer die Datei
   anlegt, bekommt die E-Mails zu fehlgeschlagenen Zeitplan-Läufen —
   deshalb am besten der Betreiber selbst. Unabhängig davon öffnet jeder
   rote Lauf ein Issue im privaten Repo.
6. **Erster Lauf**: Actions → „Live-Datenbank sichern" → Run workflow
   (Aufbewahrung 90). Muss grün werden; der Bericht steht in der
   Zusammenfassung des Laufs.
7. **Schlüsselprobe (PC)**, einmal jetzt und danach monatlich: das Artefakt
   des Laufs herunterladen, entpacken, dann
   ```powershell
   age -d -i verse-base-backup.key -o klar.tar.gz verse-base-<zeit>.tar.gz.age
   Get-FileHash klar.tar.gz -Algorithm SHA256   # = zweite Zeile der .sha256-Datei
   tar -tzf klar.tar.gz                          # listet data.sql, schema.sql, …
   Remove-Item klar.tar.gz
   ```
   Erst danach gilt die Sicherung als wiederherstellbar: die Probe im Lauf
   beweist den Inhalt, diese Probe beweist den Schlüssel.

### Skripte aktualisieren

`QUELLE_SHA` im privaten Repo nur anheben, wenn `probe-backup.yml` auf dem
neuen Commit grün war. Die Action-Versionen der Vorlage prüft
`verify:supply-chain` mit denselben Regeln wie die Workflows hier; hebt
Dependabot sie in `probe-backup.yml` an, die Vorlage beim nächsten Anheben
von `QUELLE_SHA` mitziehen.

---

## Wiederherstellen

> **Nie in Live zurückspielen ohne ausdrückliche Freigabe des Betreibers.**
> Claude spielt nie selbstständig in Live zurück. Jede Wiederherstellung geht
> zuerst in die Probe (Abschnitt C) oder in ein neues Projekt (Abschnitt A).

Gebraucht wird eine Linux-Umgebung mit Docker, Node 22, `age` und der
Supabase-CLI 3.0.0 (auf dem PC: WSL mit Docker Desktop). Alle Befehle aus
dem Wurzelordner dieses Repos.

**Archiv holen und öffnen:** privates Repo → Actions → letzter grüner Lauf →
Artefakt `live-backup-<nr>` herunterladen, entpacken.

```bash
sha256sum -c <(head -1 verse-base-<zeit>.tar.gz.age.sha256)          # Archiv unversehrt
age -d -i verse-base-backup.key verse-base-<zeit>.tar.gz.age > klar.tar.gz
sha256sum klar.tar.gz                                                 # = Zeile 2 der .sha256
mkdir sicherung && tar xzf klar.tar.gz -C sicherung
```

### A) Ernstfall: Live-Projekt verloren oder unbrauchbar

1. Erst die Probe (C) mit genau diesem Archiv — sie zeigt in einer Minute,
   ob es vollständig zurückkommt.
2. Neues Supabase-Projekt anlegen (Frankfurt, Postgres 17). Auf Free sind
   höchstens zwei Projekte aktiv.
3. Einspielen, mit der Session-Pooler-Adresse und dem `postgres`-Passwort
   des **neuen** Projekts:
   ```bash
   cat scripts/backup/vorbereitung.sql sicherung/roles.sql sicherung/schema.sql \
       sicherung/zusatz.sql sicherung/history_schema.sql sicherung/data.sql \
       sicherung/history_data.sql \
     | psql --single-transaction -v ON_ERROR_STOP=1 "$NEUE_DB_URL"
   ```
   `vorbereitung.sql` muss zuerst laufen: ohne sie bekommen anon und
   authenticated im neuen Projekt Vollzugriff auf jede Tabelle (Gegenprobe 1
   unten: 119 Rechte zu viel).
4. Storage-Dateien, mit dem Service-/Secret-Key des **neuen** Projekts:
   ```bash
   VB_ZIEL_SCHLUESSEL='<key neues projekt>' \
     node scripts/backup/dateien.mjs hochladen sicherung https://<neue-ref>.supabase.co
   ```
   Die Live-Adresse weist das Skript ab (ein upsert dort ersetzte aktuelle
   Avatare durch alte); nur mit Freigabe des Betreibers und
   `VB_LIVE_FREIGEGEBEN=1`.
5. Vergleich mit der Quelle (Katalog und erneuter Dump des neuen Projekts,
   wie in `wiederherstellen-probe.sh`, dann
   `node scripts/verify-backup.mjs vergleich sicherung <probe-ordner>`).
6. Was nicht in der Datenbank steht (Tabelle oben): Auth-Einstellungen und
   Discord-Anbieter, Edge Functions (`supabase functions deploy --project-ref
   <neue-ref>`) samt Secrets, `vb_backup`-Passwort neu, neue Ref und Schlüssel
   in `scripts/lib/supabase-ziel.mjs`, Coolify und Bot, Stripe-Webhook.
   Alle Nutzer müssen sich neu anmelden (neues JWT-Secret).
7. Bekannte Stelle: `20261030140000_profile_columns_checked` bindet Avatar-
   und Banner-Adressen an den alten Storage-Host. Die Zeilen kommen zurück,
   zeigen aber auf das alte Projekt; Host per Migration umstellen (Phase 4
   der Supabase-Trennung).

### B) Einzelne Zeilen zurückholen (Live läuft weiter)

Für ein versehentliches Löschen oder eine Migration, die Daten verdorben hat:

```bash
VB_STACK_BEHALTEN=1 scripts/backup/wiederherstellen-probe.sh sicherung
# druckt die Adresse der laufenden Probe-Datenbank; dort die Zeilen lesen,
# z. B. psql "<adresse>" -c "select … from public.hangar_layouts where …"
```

Aus den gelesenen Zeilen ein gezieltes SQL für Live schreiben. Das Einspielen
in Live ist eine Produktionsänderung: nur mit Freigabe. Danach den Stack
stoppen (der Befehl steht in der Ausgabe).

### C) Probe (abgeschottet, jederzeit)

```bash
scripts/backup/wiederherstellen-probe.sh sicherung
```

Startet einen lokalen Supabase-Stack ohne Migrationen und ohne jeden
Live-Zugang, spielt die Sicherung ein, vergleicht und löscht ihn wieder.

---

## Wenn ein Lauf rot ist

Es entsteht dann kein Archiv; das letzte grüne bleibt das aktuelle.

1. Issue im privaten Repo öffnen → Link zum Lauf → Schritt, der rot ist.
2. Häufige Ursachen:
   - **Verbindung**: Passwort von `vb_backup` geändert, Pooler-Adresse
     anders, Projekt pausiert (Free pausiert nach 7 Tagen ohne Aktivität).
   - **`Format geaendert`**: neue Supabase-CLI-Version; `SUPABASE_CLI` in der
     Vorlage festhalten oder Skript anpassen, Sonde laufen lassen.
   - **`fehlt in der Probe` / `nur in der Probe`**: die Wiederherstellung
     bringt etwas nicht mit. Das ist der Fall, für den die Probe da ist —
     Ursache klären, nicht die Prüfung lockern. Neue Ausnahmen nur benannt
     (`AUSNAHMEN` in `verify-backup.mjs`).
   - **Klinke**: weniger als 10 Konten — falsche Datenbank oder echter
     Datenverlust. Sofort ansehen, ältere Archive nicht verfallen lassen
     (Lauf mit 90 Tagen manuell, Artefakte vorher herunterladen).
3. Lauf manuell neu starten, sobald behoben.

## Wächter gegen stille Ausfälle

Ein roter Lauf meldet sich (E-Mail von GitHub, Issue). Ein Lauf, der **gar
nicht startet** (Zeitplan aus, Repo deaktiviert), meldet sich nicht von
selbst. Zwei Wege, beide offen:

- **Healthchecks.io** (kostenlos, Server in der EU): bekommt nur einen Ping
  ohne Daten und schickt eine E-Mail, wenn 26 Stunden keiner kam. URL als
  Secret `HEALTHCHECK_URL` eintragen; die Vorlage pingt Start, Erfolg und
  Fehler. Braucht ein Konto des Betreibers.
- **Monatliche Schlüsselprobe** (Schritt 7) sieht zugleich, ob es ein
  frisches Archiv gibt.

## Kosten und Pflege

- 0 €: GitHub Free (privates Repo, rund 150 von 2.000 Actions-Minuten im
  Monat, rund 20 von 500 MB Artefaktspeicher), age und CLI sind frei.
- Pflege: monatlich Schlüsselprobe (5 Minuten); `QUELLE_SHA` anheben, wenn
  sich die Skripte ändern; Rotes klären.
- Supabase Pro (25 $/Monat) brächte tägliche Backups mit Wiederherstellung im
  Dashboard, aber keine Kopie außerhalb von Supabase und keine Storage-Dateien
  — es ersetzt diese Sicherung nicht, es ergänzt sie.

## Offene Risiken

- **Gegen Live noch nicht gelaufen.** Bewiesen ist der Ablauf gegen einen
  Nachbau aus den Repo-Migrationen; der erste Live-Lauf zeigt, ob Live davon
  abweicht (etwa Handarbeit im SQL-Editor). Dafür ist der Vergleich da.
- **Nutzerdaten auf GitHub-Läufern**: der Klartext liegt während des Laufs
  auf einer GitHub-VM (US-Anbieter, gelöscht nach dem Lauf); abgelegt wird
  nur Chiffrat. Ob das in der Datenschutzerklärung als Auftragsverarbeitung
  genannt werden muss, entscheidet der Betreiber.
- **Ein Schlüssel**: geht `verse-base-backup.key` verloren, sind alle
  Archive verloren. Gegenmittel: zweite Kopie offline, optional zweiter
  Empfänger.
- **Lokaler Stack ≠ gehostetes Projekt**: die Probe läuft gegen die
  Auth-/Storage-Versionen der CLI, nicht gegen die von Live. Ein Ernstfall
  in ein neues gehostetes Projekt kann an einer Stelle abweichen, die die
  Probe nicht sieht; Schritt 1 in A verringert das, beseitigt es nicht.
- **Zweiter Faktor**: ob TOTP-Geheimnisse in einem neuen Projekt
  weiterhin gelten, ist ungeprüft; notfalls neu einrichten.
- **Pause auf Free**: pausiert Live, schlägt der Lauf fehl (gewollt).

---

## Gegenproben (vorgeführt rot, 05.11.2026)

Gegen den Nachbau, jede einmal absichtlich gebrochen:

| # | Bruch | Meldung |
|---|---|---|
| 1 | ohne `vorbereitung.sql` zurückgespielt | 119 FEHLER, z. B. `rechte_funktionen: nur in der Probe: public.gate_verdict() {…anon=X…,authenticated=X…}` |
| 2a | `zusatz.sql` leer | `Trigger auth.users.on_auth_user_created: fehlt in zusatz.sql`, `Policy storage.objects.profile_images_owner_delete: fehlt in zusatz.sql` |
| 2b | dasselbe, bis zur Probe durchgereicht | `trigger: fehlt in der Probe …`, `policies: fehlt in der Probe …` |
| 3 | eine Zeile aus `data.sql` entfernt | `data.sql: sha256 weicht vom Manifest ab`, `public.favorites: Dump 3 Zeilen, Probe 2` |
| 4 | `vb_backup` ohne `BYPASSRLS` | `pg_dump: … query would be affected by row-level security policy for table "audit_log_entries"` |
| 5 | Klinke 10 Konten gegen 3 | `auth.users: 3 Konten im Dump, Klinke 10 — leere oder falsche Datenbank?` |
| 6 | falsche Projekt-Ref | `Benutzer vb_backup gehoert nicht zum Projekt trgjhmbnodoarnfmlcqx — falsche Datenbank?` |
| 7 | Zeile nur im Dump der Probe entfernt (Sonde, jeder Lauf) | `public.favorites: Inhalt der Probe weicht ab (2 statt 3 Zeilen oder andere Werte)` |
| 8 | Enum nur im Katalog der Probe entfernt (Sonde, jeder Lauf) | `typen: fehlt in der Probe oder ist dort anders: private.vb_probe_stufe …` |
| 9 | `vb_backup` mit anderer Verbindungsgrenze, an `authenticated` vererbt bzw. auf dem Umweg über `pg_read_all_data` in `authenticated` gesteckt, Migration erneut | `vb_backup hat unerwartete Attribute (… connlimit=5)`, `… hat 1 Mitglieder (Soll: 0, 0, 0)` bzw. `… steckt in 1 weiteren Rollen …` |
| 10 | Verschlüsselung: Selbstprobe weicht ab | `entschluesseltes Archiv weicht ab …`, kein Archiv bleibt liegen |
| 11 | `hochladen` gegen die Live-Adresse | `… ist Live — nie ohne Freigabe des Betreibers zurueckspielen` |

Dazu `verify:supply-chain` mit unangehefteter Action in der Vorlage: rot.
Grün danach: 584 Katalogobjekte in 20 Kategorien gleich, 56 Tabellen mit
gleichem Inhalt, 9 Sequenzstände, 2 Dateien mit gleicher sha256, Anmeldung
eines Probekontos am wiederhergestellten Auth-Dienst, ganzer Lauf 44 s.
