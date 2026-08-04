---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-03T20:41:32.977Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01.4 | deviation | scripts/datamine-vehicles.mjs |  | turrets[].payloadTypes bleibt leer (Turm-eigene Port-Typen liegen ausserhalb der auflösbaren Ship-Ports) und 9 Fahrzeuge mit Punktverteidigungs-Turmgruppe zeigen Stationszahl ohne aufgeloeste Waffe/DPS — Struktur ist eine ehrliche Teilantwort, nicht stillschweigend aufgefuellt (siehe 01.4-02-SUMMARY, Feld turrets[]) | open |  | 2026-08-03T20:41:32.977Z |  |

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
  }
]
````
