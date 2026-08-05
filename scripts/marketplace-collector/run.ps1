# Spielermarkt-Mitschrieb — stuendlicher Lauf auf diesem Rechner.
#
# WARUM HIER UND NICHT IN GITHUB ACTIONS: UEX steht hinter Cloudflare-Bot-Schutz
# und antwortet jedem Rechenzentrums-Runner mit HTTP 403 und der Seite
# „Just a moment...". Gemessen am 02.08.2026 fuer alle Endpunkte, auch mit
# Browser-User-Agent. Von einer gewoehnlichen Anschluss-IP geht es problemlos.
#
# WARUM EIN EIGENSTAENDIGER ORDNER: Das Repo wechselt staendig den Zweig und
# Arbeitsverzeichnisse werden aufgeraeumt. Der Sammler soll davon nichts merken,
# darum liegt hier eine eigene Kopie des Skripts und ein schlanker Klon, der nur
# den Datenzweig traegt.
#
# WAS ER TUT: Bestand holen -> UEX abfragen -> fortschreiben -> zurueckschreiben.
# Faellt UEX aus oder ist der Rechner offline, passiert nichts Schlimmes: der
# Bestand bleibt unberuehrt, der Lauf wird protokolliert, der naechste versucht
# es erneut.

$ErrorActionPreference = 'Stop'
# WICHTIG: Ab PowerShell 7.4 laesst ErrorActionPreference='Stop' auch native
# Programme bei Rueckgabewert != 0 werfen. Hier ist ein Wert != 0 aber ein
# normales Ergebnis — `git diff --quiet` meldet 1, WENN es Aenderungen gibt, und
# der Sammler meldet 1, wenn UEX nicht erreichbar ist. Beides wollen wir selbst
# auswerten statt als Ausnahme zu behandeln.
$PSNativeCommandUseErrorActionPreference = $false
# Ohne das kommen die Umlaute und Gedankenstriche des Sammlers als „ÔÇö" im
# Protokoll an — die Aufgabenplanung startet ohne UTF-8-Konsole.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8

$base  = $PSScriptRoot
$store = Join-Path $base 'store'
$log   = Join-Path $base ("logs\{0}.log" -f (Get-Date -Format 'yyyy-MM'))

function Schreib($text) {
    $zeile = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $text
    Add-Content -Path $log -Value $zeile -Encoding UTF8
}

Schreib "--- Lauf gestartet ---"

try {
    # 1) Stand von GitHub holen. Schlaegt das fehl (offline), sammeln wir
    #    trotzdem lokal weiter — gepusht wird dann beim naechsten Mal.
    git -C $store pull --quiet --ff-only 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Schreib "WARN: pull fehlgeschlagen (offline?) — sammle lokal weiter" }

    # 2) Abrufen und fortschreiben.
    $env:MARKETPLACE_LOG = Join-Path $store 'marketplace-log.json'
    $ausgabe = & node (Join-Path $base 'track-marketplace.mjs') 2>&1
    $code = $LASTEXITCODE
    foreach ($z in $ausgabe) { Schreib "  $z" }

    if ($code -ne 0) {
        # Haeufigster Fall: UEX nicht erreichbar. Kein Grund zur Panik, aber
        # es steht im Protokoll, damit ein Dauerausfall auffaellt.
        Schreib "FEHLER: Sammler endete mit Code $code — nichts geschrieben."
        exit $code
    }

    # 3) Zurueckschreiben, aber nur wenn sich wirklich etwas geaendert hat.
    git -C $store add marketplace-log.json
    git -C $store diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Schreib "Keine Aenderung — nichts zu committen."
        exit 0
    }

    $stempel = Get-Date -Format 'yyyy-MM-dd HH:mm'
    git -C $store commit --quiet -m "chore(marketplace): Mitschrieb $stempel"
    if ($LASTEXITCODE -ne 0) {
        Schreib "FEHLER: commit fehlgeschlagen."
        exit 1
    }

    git -C $store push --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Schreib "Committet und hochgeladen."
    } else {
        # Commit liegt lokal, der naechste Lauf schiebt ihn mit hoch.
        Schreib "WARN: push fehlgeschlagen — Commit liegt lokal und geht spaeter mit."
    }
}
catch {
    Schreib "AUSNAHME: $($_.Exception.Message)"
    exit 1
}
