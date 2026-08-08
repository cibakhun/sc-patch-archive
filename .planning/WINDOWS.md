---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 2
total_count: 4
last_updated: 2026-08-08T15:35:00.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01.4 | deviation | scripts/datamine-vehicles.mjs |  | turrets[].payloadTypes bleibt leer (Turm-eigene Port-Typen liegen ausserhalb der auflösbaren Ship-Ports) und 9 Fahrzeuge mit Punktverteidigungs-Turmgruppe zeigen Stationszahl ohne aufgeloeste Waffe/DPS — Struktur ist eine ehrliche Teilantwort, nicht stillschweigend aufgefuellt (siehe 01.4-02-SUMMARY, Feld turrets[]) | open |  | 2026-08-03T20:41:32.977Z |  |
| 2 | 01.2 | unrun-verify | .planning/phases/01.2-werkzeuge-erklaeren/01.2-05-PLAN.md |  | Sichtrunde aus Plan 05 Task 2 (12 Punkte + Annahmen A2/A4) nicht vom Executor durchgefuehrt — brauchte ein angemeldetes Konto und eine menschliche Bewertung von Optik/Tastatur/Kostenfreiheit; alle sechs maschinellen Laeufe sind gruen (verify-help --complete 11/11, audit:site 0 Fehler, audit:csp sauber, verify:fx gruen, verify: 0 gebrochene Verweise) | fixed | Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen: A2 (Platzierung Ruestungssets + Precision Jump) bestaetigt, A4 verneint (abgemeldete Besucher brauchen den Zweck des Refinery-Trackers nicht), WR-01 (mobile Erstbesuch-Hilfe) und WR-03 (Esc-Kollision) ausdruecklich als in Ordnung bewertet — kein Nachbau | 2026-08-06T18:10:31.000Z | 2026-08-08T00:00:00.000Z |
| 3 | 02 | unrun-verify | .planning/phases/02-schrift-und-bewegungsskala/02-02-PLAN.md |  | Sichtrunde Phase 2 (Erfolgskriterium 3, scroll-verknuepfte Wortmarken-Wandlung nach der TYPO-01/02/03-Umstellung auf Kopfleiste+Startseite) noch nicht durchgefuehrt -- braucht ein menschliches Urteil im Browser, kein Skript kann 'liest sich als ein Bewegungsbild' entscheiden (02-RESEARCH.md Architectural Responsibility Map). Fuenf Punkte, DE+EN, 1280px UND 360px, beide Farbmodi: (1) Landung ungescrollt -- Wortmarke bei Mittelpunkt 657,30 wie in 01-SUMMARY.md gemessen; (2) langsam bis ans Seitenende scrollen und zurueck -- Massstab fertig bei ~55% des Weges, Ueberlappung beginnt bei ~75%, Schriftzug blendet im letzten Fuenftel auf (Marken aus 01-SUMMARY.md); (3) Gegenprobe Choreografie-Tempo -- muss sich identisch wie vor Plan 01/02 anfuehlen, weil --fs-10=1rem/--ls-15=0.18em maschinell unveraendert sind (verify:typo Zusicherung 4, tests/e2e/typo-motion-morph.test.js); (4) Kopfleiste+Kachelreihen+Werkzeugkarten+Patch-Block wirken als EINE Bewegungssprache auf 150/200/300ms + einer Kurve -- Gegenprobe: Scroll-Reveal (0.6s) bleibt UNVERAENDERT (D-03/FX-07), fuehlt es sich schneller an, hat der Durchlauf zu viel erwischt; (5) bei 360px zeigt die Kopfleiste nur das Monogramm (MARK-07), kein Fund. Wird in Plan 07 mit der Schluss-Sichtrunde zusammengefuehrt; bis dahin ist Phase 2 nicht abnehmbar. Alle maschinellen Vorlaeufe gruen: verify:typo, verify:fx, verify:help, npm run test:e2e (215/215 inkl. des neuen Regressionstests). | fixed | Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen (DE+EN): Wandlung stetig ohne Sprung, Tempo unveraendert, Kopfleiste und Seiteninhalt als eine Bewegungssprache; Gegenprobe haelt -- Scroll-Reveal fuehlt sich unveraendert an, die Ambiente wurde nicht erwischt | 2026-08-08T00:00:00.000Z | 2026-08-08T13:00:00.000Z |
| 4 | 02 | deviation | assets/archive.css | 291 | 02-03: letter-spacing des grossgeschriebenen Mono-Labels .mast__title-kicker war 0.5em, vom Codemod als Ausreisser gefunden (56% Abweichung zur naechsten Skalenstufe, der groesste Einrast-Fund der ganzen Phase) und nach D-05-Praezedenz von Hand auf var(--ls-20)=0.32em gesetzt -- vom Plan (02-03-PLAN.md) nicht namentlich vorhergesehen. Ob das Label nach der spuerbar schmaleren Laufweite noch ausreichend 'gespreizt' wirkt, ist ein Sichturteil (siehe 02-03-SUMMARY.md). | open |  | 2026-08-08T15:35:00.000Z |  |

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
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "02",
    "file": ".planning/phases/02-schrift-und-bewegungsskala/02-02-PLAN.md",
    "line": null,
    "description": "Sichtrunde Phase 2 (Erfolgskriterium 3, scroll-verknuepfte Wortmarken-Wandlung nach der TYPO-01/02/03-Umstellung auf Kopfleiste+Startseite) noch nicht durchgefuehrt -- braucht ein menschliches Urteil im Browser, kein Skript kann 'liest sich als ein Bewegungsbild' entscheiden (02-RESEARCH.md Architectural Responsibility Map). Fuenf Punkte, DE+EN, 1280px UND 360px, beide Farbmodi: (1) Landung ungescrollt -- Wortmarke bei Mittelpunkt 657,30 wie in 01-SUMMARY.md gemessen; (2) langsam bis ans Seitenende scrollen und zurueck -- Massstab fertig bei ~55% des Weges, Ueberlappung beginnt bei ~75%, Schriftzug blendet im letzten Fuenftel auf (Marken aus 01-SUMMARY.md); (3) Gegenprobe Choreografie-Tempo -- muss sich identisch wie vor Plan 01/02 anfuehlen, weil --fs-10=1rem/--ls-15=0.18em maschinell unveraendert sind (verify:typo Zusicherung 4, tests/e2e/typo-motion-morph.test.js); (4) Kopfleiste+Kachelreihen+Werkzeugkarten+Patch-Block wirken als EINE Bewegungssprache auf 150/200/300ms + einer Kurve -- Gegenprobe: Scroll-Reveal (0.6s) bleibt UNVERAENDERT (D-03/FX-07), fuehlt es sich schneller an, hat der Durchlauf zu viel erwischt; (5) bei 360px zeigt die Kopfleiste nur das Monogramm (MARK-07), kein Fund. Wird in Plan 07 mit der Schluss-Sichtrunde zusammengefuehrt; bis dahin ist Phase 2 nicht abnehmbar. Alle maschinellen Vorlaeufe gruen: verify:typo, verify:fx, verify:help, npm run test:e2e (215/215 inkl. des neuen Regressionstests).",
    "status": "fixed",
    "reason": "Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen (DE+EN): Wandlung stetig ohne Sprung, Tempo unveraendert, Kopfleiste und Seiteninhalt als eine Bewegungssprache; Gegenprobe haelt -- Scroll-Reveal fuehlt sich unveraendert an, die Ambiente wurde nicht erwischt",
    "recorded_at": "2026-08-08T00:00:00.000Z",
    "resolved_at": "2026-08-08T13:00:00.000Z"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "02",
    "file": "assets/archive.css",
    "line": 291,
    "description": "02-03: letter-spacing des grossgeschriebenen Mono-Labels .mast__title-kicker war 0.5em, vom Codemod als Ausreisser gefunden (56% Abweichung zur naechsten Skalenstufe, der groesste Einrast-Fund der ganzen Phase) und nach D-05-Praezedenz von Hand auf var(--ls-20)=0.32em gesetzt -- vom Plan (02-03-PLAN.md) nicht namentlich vorhergesehen. Ob das Label nach der spuerbar schmaleren Laufweite noch ausreichend 'gespreizt' wirkt, ist ein Sichturteil (siehe 02-03-SUMMARY.md).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T15:35:00.000Z",
    "resolved_at": null
  }
]
````
