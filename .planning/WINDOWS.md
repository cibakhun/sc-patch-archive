---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-06T18:10:31.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01.4 | deviation | scripts/datamine-vehicles.mjs |  | turrets[].payloadTypes bleibt leer (Turm-eigene Port-Typen liegen ausserhalb der auflösbaren Ship-Ports) und 9 Fahrzeuge mit Punktverteidigungs-Turmgruppe zeigen Stationszahl ohne aufgeloeste Waffe/DPS — Struktur ist eine ehrliche Teilantwort, nicht stillschweigend aufgefuellt (siehe 01.4-02-SUMMARY, Feld turrets[]) | open |  | 2026-08-03T20:41:32.977Z |  |
| 2 | 01.2 | unrun-verify | .planning/phases/01.2-werkzeuge-erklaeren/01.2-05-PLAN.md |  | Sichtrunde aus Plan 05 Task 2 (12 Punkte + Annahmen A2/A4) nicht vom Executor durchgefuehrt — brauchte ein angemeldetes Konto und eine menschliche Bewertung von Optik/Tastatur/Kostenfreiheit; alle sechs maschinellen Laeufe sind gruen (verify-help --complete 11/11, audit:site 0 Fehler, audit:csp sauber, verify:fx gruen, verify: 0 gebrochene Verweise) | fixed | Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen: A2 (Platzierung Ruestungssets + Precision Jump) bestaetigt, A4 verneint (abgemeldete Besucher brauchen den Zweck des Refinery-Trackers nicht), WR-01 (mobile Erstbesuch-Hilfe) und WR-03 (Esc-Kollision) ausdruecklich als in Ordnung bewertet — kein Nachbau | 2026-08-06T18:10:31.000Z | 2026-08-08T00:00:00.000Z |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01.4",
    "file": "scripts/datamine-vehicles.mjs",
    "line": null,
    "description": "turrets[].payloadTypes bleibt leer (Turm-eigene Port-Typen liegen ausserhalb der auflösbaren Ship-Ports) und 9 Fahrzeuge mit Punktverteidigungs-Turmgruppe zeigen Stationszahl ohne aufgeloeste Waffe/DPS — Struktur ist eine ehrliche Teilantwort, nicht stillschweigend aufgefuellt (siehe 01.4-02-SUMMARY, Feld turrets[])",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-03T20:41:32.977Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "01.2",
    "file": ".planning/phases/01.2-werkzeuge-erklaeren/01.2-05-PLAN.md",
    "line": null,
    "description": "Sichtrunde aus Plan 05 Task 2 (12 Punkte + Annahmen A2/A4) nicht vom Executor durchgefuehrt — brauchte ein angemeldetes Konto und eine menschliche Bewertung von Optik/Tastatur/Kostenfreiheit; alle sechs maschinellen Laeufe sind gruen (verify-help --complete 11/11, audit:site 0 Fehler, audit:csp sauber, verify:fx gruen, verify: 0 gebrochene Verweise)",
    "status": "fixed",
    "reason": "Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen: A2 (Platzierung Ruestungssets + Precision Jump) bestaetigt, A4 verneint (abgemeldete Besucher brauchen den Zweck des Refinery-Trackers nicht), WR-01 (mobile Erstbesuch-Hilfe) und WR-03 (Esc-Kollision) ausdruecklich als in Ordnung bewertet — kein Nachbau",
    "recorded_at": "2026-08-06T18:10:31.000Z",
    "resolved_at": "2026-08-08T00:00:00.000Z"
  }
]
````
