# Arbeitsregeln für dieses Projekt

Kurz, verbindlich, und aus bezahlten Fehlern abgeleitet. Das Konzept dahinter
steht in [`docs/maschinelle-validierung.md`](docs/maschinelle-validierung.md).

## Liefern

**Vor JEDEM Push:**

```bash
npm run build && npm run gate
```

Beides muss grün sein. Keine Ausnahme — auch nicht bei „nur eine Kleinigkeit"
oder reinen Doku-Commits. `npm run gate` ist dieselbe Kette, die im Dockerfile
über das Auslieferungs-Image entscheidet: Reißt sie, entsteht **kein Image**,
und die Seite bleibt stumm auf dem alten Stand. Ein Push ohne grünes Tor sieht
aus wie geliefert und ist es nicht.

**Berührt die Änderung Tore, SEO, Sitemaps oder das Layout, zusätzlich einmal
als Vorschau bauen:**

```powershell
$env:STAGING = '1'; npm run build; npm run gate
```

CI baut immer so. Der Unterschied ist nicht kosmetisch — er hat schon einen
Build gerissen, der lokal grün war (leere Sitemaps, site-weites `noindex`,
Zähl-Host aus der CSP genommen). Jeder Lauf nennt in seiner Kopfzeile, welches
Artefakt er geprüft hat.

**Nach Datenläufen** (`datamine:*`, `sync:*`): zusätzlich `npm run gate:data`.

**Fertig-Meldung erst, wenn die ausgelieferte Seite den neuen Stand zeigt:**

```bash
npm run check:staging
```

Nicht bei „committet", nicht bei „gemergt", nicht bei „CI grün". staging hat
schon vier Stunden den Vortagsstand ausgeliefert, während alle Commits an Ort
und Stelle lagen, und Coolify hing an anderem Tag 20 Minuten in der
Warteschlange.

`main` bleibt tabu ohne ausdrückliche Ansage. Fertige, geprüfte Arbeit geht
ohne Nachfrage auf `staging` — das ist der Normalabschluss.

## Prüfungen bauen

Wer ein neues Prüfskript anlegt, trägt es in
[`scripts/lib/gate-registry.mjs`](scripts/lib/gate-registry.mjs) ein.
`verify:wiring` erzwingt das und hat schon zweimal seinen eigenen Erbauer
gefangen.

Sieben Grundsätze, ausführlich in § 4 des Konzepts:

1. **Vorgeführt rot.** Jedes neue Tor wird einmal absichtlich gebrochen, und
   die Meldung wird protokolliert. Ein Tor, das nie rot war, ist Dekoration —
   drei Zusicherungen dieses Projekts waren nachweislich unfälschbar grün,
   bis jemand die Gegenprobe gefahren hat.
2. **Selbstauskunft.** Das Tor druckt, *wie viele* Einheiten es geprüft hat,
   und reißt unter einer Klinke. Sonst ist ein leerlaufender Wächter von einem
   echten nicht zu unterscheiden.
3. **FEHLER blockt, WARNUNG nicht.** Ein Befund wird erst FEHLER, wenn die
   Handlungsanweisung dahinter immer richtig ist. Verzug einer Fremdquelle
   (Wiki, UEX) ist nie FEHLER. Fehlalarme sind teurer als Lücken.
4. **Torfähigkeit vor Verkabelung.** Schiene A hat kein git, kein Netz, keine
   `Data.p4k`. Wer eines davon braucht, gehört auf Schiene B oder C — und muss
   es im Registry-Eintrag unter `env` erklären.
5. **Sperrklinken statt Momentwerte.** Untergrenzen wandern nur nach oben;
   nach unten nur per Commit, dessen Botschaft die Ursache nennt.
6. **Ausnahmen benannt, mit Zombie-Wächter.** Jede Ausnahme trägt ihren
   Anlass; verliert sie ihn, reißt das Tor. Ausnahmen sind Schulden.
7. **Gegen das Artefakt prüfen — und wissen, welches.** `dist/` statt Quelle,
   das laufende Image statt `dist/`, die ausgelieferte Seite statt des Images.

## Umgebung (Windows)

- `npm.cmd` statt `npm` in PowerShell.
- Git-Bash-Forks sind kaputt → PowerShell + `git -C <pfad>`.
- Der Vorschau-Server im Worktree serviert dessen **eigenes** `dist/`.
- `.` trifft kein `\r` — bei Regex über Dateien CRLF bedenken.

## Sonst

- Datenherkunft (Data.p4k, DataCore, scmdb, „datamined") taucht **nirgends**
  im sichtbaren Text auf; `audit:site` erzwingt das als FEHLER.
- Sichturteile („trägt das Motiv noch?") entscheidet kein Skript. Sie gehen
  als benannter Punkt nach `.planning/WINDOWS.md` an den Betreiber.
- Bei sichtbaren Ergebnissen: erst hinsehen (Screenshot/Render), dann
  berichten. Kennzahlen messen die Untergrenze, nicht die Güte.
