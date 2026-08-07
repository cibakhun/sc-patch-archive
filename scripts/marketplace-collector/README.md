# Spielermarkt-Sammler — Einrichtung auf einem Rechner

Der stündliche Mitschrieb des UEX-Spielermarkts läuft **nicht** in GitHub
Actions, sondern auf einem Rechner mit gewöhnlicher Anschluss-IP.

**Warum:** UEX steht hinter Cloudflare-Bot-Schutz und antwortet jedem
Rechenzentrums-Runner mit HTTP 403 und der Seite „Just a moment…". Gemessen am
02.08.2026 für alle Endpunkte, auch mit Browser-User-Agent. Das ist eine
IP-Sperre, kein fehlender Schlüssel — ein API-Token ändert daran nichts. Der
Zeitplan in `.github/workflows/track-marketplace.yml` ist deshalb bewusst aus
und bleibt es, bis der Zugang geklärt ist.

Diese Datei beschreibt den Wiederaufbau, falls der bisherige Rechner ausfällt.

## Warum ein eigenständiger Ordner

Der Sammler läuft **außerhalb** des Repo-Klons. Das Repo wechselt ständig den
Zweig und Arbeitsverzeichnisse werden aufgeräumt — davon soll der stündliche
Lauf nichts merken. Er bekommt darum eine eigene Kopie des Skripts und einen
schlanken Klon, der nur den Datenzweig trägt.

`run.ps1` hier im Bestand ist die **Vorlage**. Sie arbeitet relativ zu ihrem
eigenen Ort (`$PSScriptRoot`) und gehört zum Betrieb in den eigenständigen
Ordner kopiert, nicht aus `scripts/` heraus gestartet.

## Einrichten

```powershell
$basis = "$HOME\sc-marketplace-collector"
New-Item -ItemType Directory -Force "$basis\logs" | Out-Null
```

Skript und Vorlage aus dem Repo-Klon holen (Pfad anpassen):

```powershell
$repo = "$HOME\sc-patch-archive"
Copy-Item "$repo\scripts\track-marketplace.mjs"            "$basis\track-marketplace.mjs"
Copy-Item "$repo\scripts\marketplace-collector\run.ps1"    "$basis\run.ps1"
```

Schlanken Klon anlegen, der nur den Datenzweig trägt:

```powershell
git clone --single-branch --branch data/marketplace-log https://github.com/cibakhun/sc-patch-archive.git "$basis\store"
```

Einmal von Hand laufen lassen und ins Protokoll sehen:

```powershell
& "$basis\run.ps1"; Get-Content "$basis\logs\$(Get-Date -Format 'yyyy-MM').log" -Tail 20
```

Stündliche Aufgabe eintragen:

```powershell
$aktion  = New-ScheduledTaskAction -Execute (Get-Command pwsh).Source -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$basis\run.ps1`""
$ausloeser = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'VerseBase-Spielermarkt' -Action $aktion -Trigger $ausloeser -Description 'Stuendlicher UEX-Spielermarkt-Mitschrieb nach data/marketplace-log'
```

## Was der Lauf tut

Bestand holen → UEX abfragen → fortschreiben → zurückschreiben. Fällt UEX aus
oder ist der Rechner offline, passiert nichts Schlimmes: der Bestand bleibt
unberührt, der Lauf wird protokolliert, der nächste versucht es erneut. Ein
Commit entsteht nur, wenn sich wirklich etwas geändert hat.

## Nachsehen, ob er läuft

```powershell
Get-ScheduledTask -TaskName 'VerseBase-Spielermarkt' | Get-ScheduledTaskInfo
```

Oder von außen: der Zweig `data/marketplace-log` auf GitHub soll einen
Mitschrieb aus der letzten Stunde tragen.

```bash
git log -1 --format='%cr  %s' origin/data/marketplace-log
```

## Verwandtes

- `scripts/track-marketplace.mjs` — der Sammler selbst
- `.github/workflows/track-marketplace.yml` — der abgeschaltete Zeitplan, im
  Dateikopf der vollständige Cloudflare-Befund
- `docs/stand-2026-08-04.md` — Abschnitt 6, warum das hier gesichert wurde
