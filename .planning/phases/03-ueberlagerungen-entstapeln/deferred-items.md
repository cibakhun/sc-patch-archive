# Deferred Items — Phase 03 (Überlagerungen entstapeln)

Out-of-scope findings discovered during plan execution, deliberately NOT fixed
(Scope Boundary: only auto-fix issues directly caused by the current task's
changes).

## 03-03: Vereinzelter eingebetteter `\r` (ohne `\n`) in zwei Quelldateien

**Gefunden während:** Task 2 (21 defensive `.reveal`-Notregeln entfernen),
beim Nachvollzug einer ungewöhnlich großen `git diff`-Anzeige für
`src/components/pilot/PilotPage.astro`.

**Befund:** Mindestens zwei Quelldateien tragen an je einer Stelle einen
einzelnen `\r` (Carriage Return) OHNE folgendes `\n` mitten im Text — vermutlich
ein Artefakt eines früheren Editier-Werkzeugs (z. B. Zwischenablage von einem
Mac-Editor). Zeilenweise Werkzeuge, die auf `\r?\n` aufteilen, sehen dadurch
zwei eigentlich getrennte Zeilen als EIN Element:

- `src/pages/precision-jump.astro` (Zeile mit `max-width:74ch}` unmittelbar vor
  `</style>`) — **bestätigt vorbestehend**, unverändert seit mindestens
  `HEAD~4` in diesem Branch, an einer Stelle, die mit der `.reveal`-Notregel
  nichts zu tun hat (Task 2 hat diese Datei nur an der Notregel-Zeile
  angefasst, `afterBlank=1` dort bestätigt eine normale Leerzeile, kein
  Verschmelzen).
- `src/pages/de/precision-jump.astro` — dieselbe Stelle, dieselbe Ursache
  (DE/EN-Paar).

**Warum nicht blockierend:** In beiden Fällen ist `<style>`/`</style>` trotz
des eingebetteten `\r` korrekt gepaart (1 Öffnung, 1 Schließung je Datei) — CSS
behandelt `\r` als Whitespace-äquivalent, es entsteht keine kaputte
Verschachtelung. `npm.cmd run build`, `verify:layers`, `verify:typo`,
`verify:fx`, `verify:help`, `audit:site` (0 FEHLER) und `test:e2e` (225/225)
laufen mit dieser Datei unverändert grün.

**Warum trotzdem vermerkt:** `src/components/pilot/PilotPage.astro` trug
GENAU dasselbe Artefakt an EXAKT der Stelle, die Task 2 entfernen musste (der
`.reveal`-Regel unmittelbar vor `</style>`) — dort HAT das Verschmelzen
tatsächlich `</style>` mit entfernt (siehe Commit `bf77e77`, Rule-1-Fix). Die
zwei hier gefundenen Stellen in precision-jump.astro/de sind also kein
Einzelfall, sondern ein bekanntes, wiederkehrendes Editor-Artefakt in diesem
Bestand — ein künftiger zeilenweiser Codemod an einer dieser exakten Stellen
liefe in dasselbe Risiko.

**Empfehlung für eine spätere, eigene Aufräum-Passage:** die beiden `\r`
gegen ein normales `\n` ersetzen (oder ganz entfernen), damit zeilenweise
Werkzeuge diese Dateien korrekt aufteilen. Kein Verhaltensunterschied für
Nutzer zu erwarten (reines Whitespace-Artefakt).

**Status:** Nicht behoben (out of scope für 03-03). Kandidat für eine
kleine Hygiene-Passage, keine eigene Phase nötig.
