---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 4
total_count: 5
last_updated: 2026-08-08T15:14:22.195Z
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
| 4 | 02 | deviation | assets/archive.css | 291 | 02-03: letter-spacing des grossgeschriebenen Mono-Labels .mast__title-kicker war 0.5em, vom Codemod als Ausreisser gefunden (56% Abweichung zur naechsten Skalenstufe, der groesste Einrast-Fund der ganzen Phase) und nach D-05-Praezedenz von Hand auf var(--ls-20)=0.32em gesetzt -- vom Plan (02-03-PLAN.md) nicht namentlich vorhergesehen. Ob das Label nach der spuerbar schmaleren Laufweite noch ausreichend 'gespreizt' wirkt, ist ein Sichturteil (siehe 02-03-SUMMARY.md). | fixed | Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen: /archiv.html (Aera-Ueberschriften, 56 Prozent Laufweiten-Verschiebung), /item-finder.html (Kicker-Zeile 27 Prozent, FX-Schalter-Tooltip 0 auf 150 ms) und /pilot (zwei Ueberschriften 8-11 Prozent) alle in Ordnung; die stehende Gegenprobe haelt ebenfalls -- Scroll-Reveal fuehlt sich unveraendert an, der Durchlauf hat die Ambiente auch nach rund 2.100 Ersetzungen nicht erwischt | | 2026-08-08T14:00:00.000Z |
| 5 | 02 | unrun-verify | .planning/phases/02-schrift-und-bewegungsskala/02-07-PLAN.md |  | Schluss-Sichtrunde Phase 2 (site-weit, nach Abschluss aller sieben Plaene) noch nicht durchgefuehrt -- id 3 deckte nur den engeren Umfang von Plan 02 (Kopfleiste+Startseite) ab und ist dafuer bereits vom Betreiber abgenommen (08.08.2026); dieser Eintrag ist die BREITERE Runde ueber die uebrigen ~92 site-weit umgestellten Dateien aus den Plaenen 03-06. Fuenf Bloecke, je DE+EN, beide Farbmodi, 1280px UND 360px: (1) die fuenf Punkte aus Plan 02 (Landung/Scrollweg/Choreografie-Gegenprobe/Bewegungssprache/Farbmodi+360px) gelten unveraendert, jetzt gegen den vollstaendig umgestellten Stand pruefen. (2) Eingerastete Ausreisser ueber 6% Abweichung, mit den TATSAECHLICH GEMESSENEN (nicht den im Plan geschaetzten) Werten aus den Summaries: assets/account-dossier.css 9px x2 (Zeile 147/221) -> var(--fs-1), 9.09% (02-03-SUMMARY D6); assets/account-dossier.css 64px -> var(--fs-19), 11.11% -- die vom Plan mitgenannten 58px/40px liegen mit 0.69%/1.01% UNTER der Schwelle und sind keine echten Ausreisser (02-03-SUMMARY Deviations); assets/archive.css:1041 1.7rem -> var(--fs-15), 6.25% (02-03-SUMMARY D6); src/components/ItemFinderPage.astro letter-spacing 0.44em -> var(--ls-20)=0.32em, 27% Abweichung, plus das gekoppelte text-indent im selben Schritt (02-04-SUMMARY, zweitgroesster Ausreisser der Phase nach archive.css:291/id 4); src/components/FxToggle.astro vier Sichtbarkeits-Uebergaenge 0ms -> ~150ms (var(--dur-fast)), Tooltip-Timing auf Maus UND Tastatur (:focus-visible) gegenpruefen (02-04-SUMMARY); src/components/ShipDetail.astro .holo__title h1 + .sd__cargonum je 1.7rem -> var(--fs-15), 6.25% (02-04-SUMMARY); src/components/pilot/PilotPage.astro:477 2.8rem -> var(--fs-18), 7.69% UND :637 2rem -> var(--fs-16), 11.11% (02-06-SUMMARY, korrigiert von der im Plan geschaetzten -10.7%/-9.1%); src/components/topics/mining.astro:71 .sh-icon 2.4rem -> var(--fs-17), 9.09% (02-06-SUMMARY). (3) Konto-Ansichten hinter Anmeldung (/account/*, /pilot/<handle>, /refinery.html) -- AccountDashboard/AccountShell/FriendsManager/ProfileCard/RefineryDashboard aus 02-06 eingeschlossen; derselbe offene Punkt wie Phase 1.2 (WINDOWS.md id 2, dort bereits abgenommen) und gehoert mit ihm zusammen erledigt. (4) Gegenprobe D-03 (Ambiente unveraendert): /sc-4-9-0.html (Staub-Partikel) und /sc-4-2-0.html (Regen/Blitz) sowie /archiv.html (Aeren-Wechsel) -- fuehlt sich die langsame Bewegung dort weiterhin unveraendert an, wie mechanisch durch verify:typo Zusicherung 3 belegt (02-05-SUMMARY D7). (5) 22 Themen-Koerper aus 02-06, insbesondere wikelo-emporium.astro (41 Ersetzungen) und mining.astro (24 Ersetzungen inkl. der eingerasteten .sh-icon-Stelle). Alle maschinellen Vorlaeufe gruen: verify:typo (6/6 Zusicherungen inkl. der neuen Zusicherung 6 aus 02-07), verify:fx (7/7), verify:help (11/11), test:e2e (215/215), audit:site (0 FEHLER), audit:csp (10/10). | fixed | Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen: /archiv.html (Aera-Ueberschriften, 56 Prozent Laufweiten-Verschiebung), /item-finder.html (Kicker-Zeile 27 Prozent, FX-Schalter-Tooltip 0 auf 150 ms) und /pilot (zwei Ueberschriften 8-11 Prozent) alle in Ordnung; die stehende Gegenprobe haelt ebenfalls -- Scroll-Reveal fuehlt sich unveraendert an, der Durchlauf hat die Ambiente auch nach rund 2.100 Ersetzungen nicht erwischt | | 2026-08-08T14:00:00.000Z |

## Phase 2 Bilanz (Schrift- und Bewegungsskala, Plaene 01-07)

Zahlen aus `node scripts/audit-typo-motion.mjs` gegen den nach Plan 06 erreichten
Bestand (96 Dateien: `src/**/*.astro` + `assets/*.css`), Grundlage fuer das Abhaken
von TYPO-01/02 in `REQUIREMENTS.md`:

- **Umgestellte Dateien:** 96 (3 im Tracer Plan 01 -- SiteNav.astro + beide
  index.astro --, 6 `assets/*.css` in Plan 03, 28 Komponenten/Layouts in Plan 04,
  19 Patch-Koerper in Plan 05, 40 in Plan 06 -- 5 Seitenpaare+404, 22 Themen-Koerper,
  5 Konto-Ansichten, PilotPage, ShipsOverview)
- **Token-Verweise (jetzt aus der Skala gelesen):** 3.141 (1.625 `font-size` +
  856 `letter-spacing` + 660 Bedienuebergang-Teile, je auf `var(--fs-*)`/
  `var(--ls-*)`/`var(--dur-*)`/`var(--ease-ui)`)
- **Begruendete Ausnahmen (getrennt ausgewiesen, kein Rest):** 527 (313 `clamp()`-
  Formeln, 19 `em`-Schriftgrade, 4 Hero-Ausnahme-Fundstellen, 5 `letter-spacing:
  normal`, 169 Ambiente-Uebergaenge >350ms/Scroll-Reveal, 13 `transition: none`,
  4 sonstige Nicht-Werte wie `font-size: inherit`/`112.5%`-Wurzelwert)
- **Skalenpflichtiger Rest:** 0 (site-weit, `audit-typo-motion.mjs` UND die neue
  Zusicherung 6 aus `verify-typo-motion.mjs`, Plan 07)
- **Eingerastete Ausreisser ueber 6% Abweichung (von Hand entschieden):** 11
  (2x `account-dossier.css` 9px, 1x `account-dossier.css` 64px, 1x `archive.css`
  1.7rem, 1x `archive.css` letter-spacing 0.5em = id 4, 1x `ItemFinderPage.astro`
  letter-spacing 0.44em, 2x `ShipDetail.astro` 1.7rem, 2x `PilotPage.astro`
  2.8rem/2rem, 1x `mining.astro` 2.4rem -- Ort und gemessener Wert je Stelle in
  id 5 oben; `FxToggle.astro`s vier 0ms->~150ms-Uebergaenge sind KEINE
  prozentualen Abweichungen und separat in id 5 gelistet, nicht mitgezaehlt)

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
    "status": "fixed",
    "reason": "Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen: /archiv.html (Aera-Ueberschriften, 56 Prozent Laufweiten-Verschiebung), /item-finder.html (Kicker-Zeile 27 Prozent, FX-Schalter-Tooltip 0 auf 150 ms) und /pilot (zwei Ueberschriften 8-11 Prozent) alle in Ordnung; die stehende Gegenprobe haelt ebenfalls -- Scroll-Reveal fuehlt sich unveraendert an, der Durchlauf hat die Ambiente auch nach rund 2.100 Ersetzungen nicht erwischt",
    "recorded_at": "2026-08-08T15:35:00.000Z",
    "resolved_at": "2026-08-08T14:00:00.000Z"
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "02",
    "file": ".planning/phases/02-schrift-und-bewegungsskala/02-07-PLAN.md",
    "line": null,
    "description": "Schluss-Sichtrunde Phase 2 (site-weit, nach Abschluss aller sieben Plaene) noch nicht durchgefuehrt -- id 3 deckte nur den engeren Umfang von Plan 02 (Kopfleiste+Startseite) ab und ist dafuer bereits vom Betreiber abgenommen (08.08.2026); dieser Eintrag ist die BREITERE Runde ueber die uebrigen ~92 site-weit umgestellten Dateien aus den Plaenen 03-06. Fuenf Bloecke, je DE+EN, beide Farbmodi, 1280px UND 360px: (1) die fuenf Punkte aus Plan 02 (Landung/Scrollweg/Choreografie-Gegenprobe/Bewegungssprache/Farbmodi+360px) gelten unveraendert, jetzt gegen den vollstaendig umgestellten Stand pruefen. (2) Eingerastete Ausreisser ueber 6% Abweichung, mit den TATSAECHLICH GEMESSENEN (nicht den im Plan geschaetzten) Werten aus den Summaries: assets/account-dossier.css 9px x2 (Zeile 147/221) -> var(--fs-1), 9.09% (02-03-SUMMARY D6); assets/account-dossier.css 64px -> var(--fs-19), 11.11% -- die vom Plan mitgenannten 58px/40px liegen mit 0.69%/1.01% UNTER der Schwelle und sind keine echten Ausreisser (02-03-SUMMARY Deviations); assets/archive.css:1041 1.7rem -> var(--fs-15), 6.25% (02-03-SUMMARY D6); src/components/ItemFinderPage.astro letter-spacing 0.44em -> var(--ls-20)=0.32em, 27% Abweichung, plus das gekoppelte text-indent im selben Schritt (02-04-SUMMARY, zweitgroesster Ausreisser der Phase nach archive.css:291/id 4); src/components/FxToggle.astro vier Sichtbarkeits-Uebergaenge 0ms -> ~150ms (var(--dur-fast)), Tooltip-Timing auf Maus UND Tastatur (:focus-visible) gegenpruefen (02-04-SUMMARY); src/components/ShipDetail.astro .holo__title h1 + .sd__cargonum je 1.7rem -> var(--fs-15), 6.25% (02-04-SUMMARY); src/components/pilot/PilotPage.astro:477 2.8rem -> var(--fs-18), 7.69% UND :637 2rem -> var(--fs-16), 11.11% (02-06-SUMMARY, korrigiert von der im Plan geschaetzten -10.7%/-9.1%); src/components/topics/mining.astro:71 .sh-icon 2.4rem -> var(--fs-17), 9.09% (02-06-SUMMARY). (3) Konto-Ansichten hinter Anmeldung (/account/*, /pilot/<handle>, /refinery.html) -- AccountDashboard/AccountShell/FriendsManager/ProfileCard/RefineryDashboard aus 02-06 eingeschlossen; derselbe offene Punkt wie Phase 1.2 (WINDOWS.md id 2, dort bereits abgenommen) und gehoert mit ihm zusammen erledigt. (4) Gegenprobe D-03 (Ambiente unveraendert): /sc-4-9-0.html (Staub-Partikel) und /sc-4-2-0.html (Regen/Blitz) sowie /archiv.html (Aeren-Wechsel) -- fuehlt sich die langsame Bewegung dort weiterhin unveraendert an, wie mechanisch durch verify:typo Zusicherung 3 belegt (02-05-SUMMARY D7). (5) 22 Themen-Koerper aus 02-06, insbesondere wikelo-emporium.astro (41 Ersetzungen) und mining.astro (24 Ersetzungen inkl. der eingerasteten .sh-icon-Stelle). Alle maschinellen Vorlaeufe gruen: verify:typo (6/6 Zusicherungen inkl. der neuen Zusicherung 6 aus 02-07), verify:fx (7/7), verify:help (11/11), test:e2e (215/215), audit:site (0 FEHLER), audit:csp (10/10).",
    "status": "fixed",
    "reason": "Betreiber hat am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen: /archiv.html (Aera-Ueberschriften, 56 Prozent Laufweiten-Verschiebung), /item-finder.html (Kicker-Zeile 27 Prozent, FX-Schalter-Tooltip 0 auf 150 ms) und /pilot (zwei Ueberschriften 8-11 Prozent) alle in Ordnung; die stehende Gegenprobe haelt ebenfalls -- Scroll-Reveal fuehlt sich unveraendert an, der Durchlauf hat die Ambiente auch nach rund 2.100 Ersetzungen nicht erwischt",
    "recorded_at": "2026-08-08T15:14:22.195Z",
    "resolved_at": "2026-08-08T14:00:00.000Z"
  }
]
````
