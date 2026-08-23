---
phase: 18-missionen-wissen-wo-sie-spielen
verified: 2026-08-23T21:30:00Z
status: human_needed
score: 8/8 Erfolgskriterien maschinell belegt (Kriterium 4 nur teilweise — Sichturteil offen)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "S-1 (WINDOWS id 45): Region-Zeile einer Missions-Detailseite und das Filterfeld #mx-loc ansehen — wirkt 'Hurston'/'Stanton (System)' glaubwürdig als Planeten-/Systemebene oder wie eine Stationsangabe?"
    expected: "Betreiber-Urteil, ob die Grobheit der Ortsangabe (D-02) ehrlich wirkt"
    why_human: "Sichturteil, CLAUDE.md: 'trägt das Motiv noch' entscheidet kein Skript"
  - test: "S-2 (WINDOWS id 46): Englische Slot-Art-Chips (Location/Destination/Pickup Location/Dropoff Location) auf einer deutschen Missions-Detailseite ansehen"
    expected: "Betreiber-Urteil, ob englische Marken in der deutschen Fassung verständlich sind oder eigene deutsche Beschriftungen nötig wären"
    why_human: "Bewusste Sprachentscheidung, kein Skripturteil"
  - test: "S-3 (WINDOWS id 47): Ortsfeld #mx-loc mit 49 Einträgen (vorher 7) auf /missionen und /de/missionen ansehen"
    expected: "Betreiber-Urteil, ob die flache Liste noch bedienbar ist oder eine Gruppierung nach System braucht"
    why_human: "UX-Bedienbarkeitsurteil, kein Skripturteil"
  - test: "S-4 (WINDOWS id 48): Beliebige Missions-Detailseite ansehen — geänderte Chip-Beschriftung ({TargetName} -> Target Name) site-weit"
    expected: "Betreiber-Urteil, ob die neue Lesbarkeit trägt"
    why_human: "Sichturteil über eine site-weite Nebenwirkung außerhalb D-01..D-04"
---

# Phase 18: Missionen wissen, wo sie spielen — Verification Report

**Phase Goal:** Die Missionsseite zieht zwei Kanten, die in den Quelldaten bereits
vorliegen und beim Einlesen bisher verworfen wurden: wo eine Mission spielt (D-01/D-02),
und welcher Art eine Ortsangabe im Missionstext ist (D-03) — plus eine Patch-Kennung an
jedem Datenstand mit Verzugstor (D-04).
**Verified:** 2026-08-23T21:30:00Z (gegen den unabhängig gebauten, aktuellen `dist/`-Stand;
kein neuer Build in dieser Prüfung)
**Status:** human_needed
**Re-verification:** No — initial verification

## Zusammenfassung

Alle vier Entscheidungen (D-01 bis D-04) sind im Bestand umgesetzt, maschinell belegt und
mit eigenen Läufen gegengeprüft — nicht nur aus den SUMMARYs übernommen. Der ursprüngliche
ROADMAP-Zielwert von Erfolgskriterium 1 (≥800) ist nicht nur erreicht, sondern mit
**1.180/1.347 (87,6 %)** deutlich übertroffen, nachdem eine vierte, in Welle 1 nicht
vorgesehene Ortsquelle in Welle 2 nachgezogen wurde. Sieben der acht ROADMAP-Erfolgskriterien
sind vollständig maschinell verifizierbar und wurden von mir unabhängig nachgemessen, nicht
nur aus den SUMMARYs zitiert. Kriterium 4 ist so weit maschinell belegt, wie es das sein
kann (Katalog sauber, keine Duplikate, keine Rohbezeichner) — die eigentliche
Glaubwürdigkeitsfrage bleibt eine der vier offenen Sichturteile, die bewusst dem Betreiber
vorbehalten sind (WINDOWS id 45-48). Deshalb lautet der Gesamtstatus **human_needed**, nicht
**passed** — Task-Vollständigkeit ist gegeben, aber die Phase ist erst mit diesen vier
Entscheidungen wirklich abgeschlossen.

## Goal Achievement

### Die acht ROADMAP-Erfolgskriterien (eigene Messung)

| # | Kriterium | Status | Selbst erhobener Messwert |
|---|---|---|---|
| 1 | ≥800/1.347 Familien mit Ortsangabe | ✓ ÜBERTROFFEN | `node -e` gegen `src/data/missions.json`: `meta.counts.mitOrt` = **1180**, `missions.length` = **1347** (147,5 % des Zielwerts). Sonde `node scripts/probes/missionsorte-messung.mjs` bestätigt denselben Wert unabhängig. |
| 2 | Filterzahl = gezählte Kante, gegen das gebaute `dist/` | ✓ VERIFIZIERT | Eigener Abgleich `dist/missionen.html` `data-loc`-Attribute gegen `missions.json`: `stanton1` (Hurston) **387 Karten = 387 Familien**; `stantonstar` (Stanton (System)) **141 Karten = 141 Familien** — exakte Übereinstimmung, zwei unabhängige Kennungen geprüft |
| 3 | Slot-Arten unterscheidbar (nicht mehr alle `{Address}`) | ✓ VERIFIZIERT | `node -e` über alle 1.347 Missionsdatensätze: literales `{Address}` kommt **0-mal** vor (vorher 932). `meta.counts.ortsarten` = 6, `slotArten` zeigt PlayLocation/Destination/PickupLocation/DropoffLocation getrennt gezählt |
| 4 | Ortsangabe als Planeten-/Systemebene erkennbar, keine Station; Sichturteil bestätigt | ⚠️ TEILWEISE (maschinell erschöpft, Sichturteil offen) | Katalog `node -e`: **49 Einträge, 0 Namens-Duplikate, 0 rohe Bezeichner** (`Stanton1`/`StantonStar`/`PyroStar` kommen in `localities[].name` nicht mehr vor; Systemebene trägt durchgängig `(System)`). Die eigentliche „wirkt das glaubwürdig"-Frage ist WINDOWS id 45 (S-1), **offen** — bewusst kein Skripturteil |
| 5 | Alle Datenstände nennen ihre Patch-Kennung; Tor reißt bei Verzug | ✓ VERIFIZIERT | Eigener Abgleich aller sechs maschinellen Bestände: `missions.json` `sc-alpha-4.9.0@12344265`, `mining-db.json`/`universal-items.json`/`refinery-data.json` `4.9.0-live.12344265`, `crafting-db.json`/`dismantling-items.meta.json` `PUBLIC-4.9.0-12344265` — alle auf CL 12344265. `wikelo-trades.meta.json` `reviewedVersion: "4.9.0"` (bewusst ohne CL, Handpflege). `npm run verify:datastand` selbst ausgeführt: **grün**, alle 8 Zusicherungen bestanden |
| 6 | Kein Herkunftshinweis im sichtbaren Text | ✓ VERIFIZIERT | `npm run audit:site` selbst ausgeführt gegen das vorhandene `dist/`: **FEHLER: 0**, WARNUNGEN: 4 (unabhängig, Bildgrößen), 17.364 Seiten geprüft |
| 7 | DE/EN deckungsgleich, beide Farbmodi | ✓ VERIFIZIERT (strukturell) | Eigene Zählung der vier Slot-Art-Chips über je 1.347 Detailseiten `dist/missionen/` vs. `dist/de/missionen/`: `Location` 672/672, `Destination` 230/230, `Pickup Location` 75/75, `Dropoff Location` 56/56 — exakt gleich. Ob die englischen Marken in der deutschen Fassung *inhaltlich* passend sind, ist WINDOWS id 46 (S-2), offen |
| 8 | `npm run build && npm run gate` grün, normal UND `STAGING=1`; jedes neue Tor vorgeführt rot, in `gate-registry.mjs` eingetragen | ✓ VERIFIZIERT | Laut Auftrag unabhängig unmittelbar vor dieser Prüfung gefahren: 23/23 grün. Registry-Eintrag `verify:datastand` in `scripts/lib/gate-registry.mjs` Z. 243-245 und `package.json` Z. 36 selbst gefunden. `npm run verify:wiring` von mir separat ausgeführt: **ALLE ZUSICHERUNGEN ERFÜLLT**, 27 Prüfskripte über der Untergrenze 24. Rot-Vorführung siehe eigener Abschnitt unten |

**Ergebnis:** 7/8 vollständig maschinell VERIFIZIERT, 1/8 (Kriterium 4) maschinell so weit wie
möglich belegt mit einer bewusst offenen, dem Betreiber vorbehaltenen Restfrage.

### D-01 bis D-04: Liefert der Code, was die Entscheidung verlangt?

| Entscheidung | Verlangt | Befund |
|---|---|---|
| **D-01** — Ortskante wird gezogen | `locationMissionAvailable` zusätzlich zu `localityAvailable` lesen, Ziel ≥800 | **Übertroffen.** Welle 1 baute die geplante Zwei-Quellen-Kaskade, maß aber nur 366/1.347 (unter dem strukturellen Deckel von 432, weil 915 Familien ausschließlich aus Contract-Einträgen ohne Broker-Felder bestehen) und ergänzte eigenständig eine dritte Quelle (`ContractPrerequisite_Location`, Rule-2-Fund) auf 609. Der Betreiber beauftragte danach die Suche nach einer vierten Quelle; Welle 2 fand und integrierte `ContractPrerequisite_Locality` (inkl. bislang ungelesener `subContracts`-Ebene) und erreichte **1.180/1.347**. Selbst nachgemessen und bestätigt |
| **D-02** — Ortsangabe ehrlich grob | Katalog auf Planeten-/Systemebene, keine Stationsgenauigkeit vortäuschen | **Umgesetzt.** `STARMAP_NAMES`-Kernwörterbuch + dreistufige Auflösung (kuratiert → spielintern über `StarMapObject.name` → `humanize()`-Rückfall); Systemebene trägt durchgängig `(System)`. Zusätzlich zwei vom Betreiber beauftragte Erweiterungen: E-2 (Katalog-Dedup — `Pyro (System)` vs. `PyroSolarSystem` vs. bloßes `Pyro` fallen in einen Eintrag zusammen) und E-3 (Langschwanz: 57 → 49 Einträge, keine rohen Kürzel wie `Pyro2 Outpost col m trdp indy 001` mehr sichtbar). Selbst nachgemessen: 49 Einträge, 0 Duplikate, 0 Rohbezeichner |
| **D-03** — Slot-Art bleibt erhalten | Abhol-/Liefer-/Ziel-/Spielort im Missionstext unterscheidbar | **Umgesetzt.** `braces()` erkennt die Ortsform selektiv über das letzte Trennsegment (`ORT_FORM`), `SLOT_NAMES` beschriftet lesbar; die 47 übrigen Markensorten bleiben unverändert. Selbst nachgemessen: literales `{Address}` kommt 0-mal mehr vor (vorher 932); 6 unterschiedene Ortsarten in `meta.counts.slotArten` |
| **D-04** — Jeder Datenstand nennt seinen Patch | Alle Bestände tragen eine Kennung; Tor meldet Verzug; `wikelo-trades.json` bekommt Handpflege-Kennung statt gelogener Changelist, Verzug dort WARNUNG nie FEHLER | **Umgesetzt.** Alle sechs maschinellen Bestände auf CL 12344265, `wikelo-trades.meta.json` trägt `reviewedVersion`/`reviewedAt` ohne Changelist. `scripts/verify-datastand.mjs` (259 Zeilen, 8 Zusicherungen) selbst ausgeführt: grün. Zusicherung 8 des Tors selbst bestätigt „Handpflege und Client-Abgleich (beide WARNUNG, nie FEHLER)" |

### Gesperrte Sackgasse: `CraftingQualityLocationOverrideRecord`

Grep über `scripts/` und `src/` nach `CraftingQualityLocationOverrideRecord`: **0 Treffer.**
Die in der ROADMAP ausdrücklich gesperrte Ort↔Fertigung-Kante (12 Einträge, alle mit leerem
Verteilungssatz) wurde in dieser Phase nicht angefasst — bestätigt.

### Rot-Vorführung des Tors `verify:datastand`

Nach CLAUDE.md Grundsatz 1 wurde geprüft, ob die Rot-Vorführung nachvollziehbar protokolliert
ist — nicht nur behauptet.

- `18-04-SUMMARY.md` dokumentiert **sieben** Eingriffe (fünf FEHLER-Klassen + ein
  Zombie-Wächter-Test + eine WARNUNG-Demo), jeweils mit `git hash-object`-Prüfsumme
  vorher/nachher und wörtlich zitierter Meldung.
- **Eigener Beleg, dass die Rücknahme wirklich griff:** Ich habe `git hash-object` für alle
  sieben betroffenen Dateien im aktuellen Arbeitsbaum selbst berechnet. Alle sieben Werte
  stimmen exakt mit den in der SUMMARY-Tabelle notierten „vorher"-Prüfsummen überein (z. B.
  `assets/refinery-data.json` → `67ac21384eca71f48105a44d43ce0a9660715f19`,
  `scripts/verify-datastand.mjs` → `ec2a4a4bf1a4b8b3880bfaec09cb4a9bd24e2355`). `git status`
  zeigt einen sauberen Arbeitsbaum. Das ist die verlangte Gegenprobe: die Eingriffe haben die
  Dateien nachweislich verändert und die Rücknahme führt exakt zum committeten Ausgangsstand
  zurück — nicht bloß behauptet.
- `npm run verify:datastand` selbst ausgeführt (aktueller, unveränderter Stand): grün, 0
  Ausnahmen, 0 Warnungen — bestätigt, dass das Tor im Ruhezustand tatsächlich durchläuft.
- Alle neun zitierten Commit-Hashes (`8975071`, `68dbaef`, `8b9206b`, `8741bd7`, `403e766`,
  `c0069e8`, `0125ef5`, `2b779dc`, `67ce98a`, `09ee22f`) existieren nachweislich in der
  Git-Historie (`git show -s` für jeden erfolgreich).

**Befund: Die Rot-Vorführung ist nachvollziehbar und mit unabhängig reproduzierbaren
Prüfsummen belegt — kein Dekorationsbefund nach Grundsatz 1.**

### Regression: `npm run gate:data` an `verify:items`

Die SUMMARYs aller vier Wellen behaupten, der Fehlschlag von `npm run gate:data` an
`verify:items` (Meldung „1 Orte nicht mehr live" in den UEX-Preiszeilen von
`assets/universal-items.json`) sei vorbestehend und phasenfremd. Geprüft statt übernommen:

- Selbst ausgeführt: `npm run verify:items` → Exit-Code **1**, Meldung „ANPASSUNG NÖTIG: 1
  Orte nicht mehr live" bestätigt reproduzierbar.
- Die Quelle des Befunds ist `scripts/verify-item-prices.mjs` — ein reiner
  UEX-Live-Preis/Standort-Abgleich für den Item-Katalog, der naturgemäß mit der Zeit driftet
  (Marktpreise ändern sich), unabhängig von jedem Code-Änderungsdatum.
- **18-01-SUMMARY.md** (der allererste Plan dieser Phase, `files_modified` ausschließlich
  Missionsdateien: `scripts/probes/missionsorte-messung.mjs`,
  `scripts/datamine-missions.mjs`, `src/data/missions.json`, `scripts/verify-metrics.mjs`,
  `scripts/lib/metrics-baseline.mjs`, `scripts/probes/README.md` — **keine** Item-/Preis-Datei)
  dokumentiert denselben Fehlschlag bereits am 23.08.2026 vor dem allerersten Commit dieser
  Phase.
- Damit ist belegt: der Befund existierte, bevor Phase 18 überhaupt eine Datei berührte — er
  ist tatsächlich vorbestehend und phasenfremd, nicht nur behauptet.
- Die ROADMAP verlangt für Erfolgskriterium 8 ausdrücklich nur `npm run build && npm run
  gate` (Schiene A), nicht `gate:data` (Schiene B) — der rote Zustand von `gate:data` ist
  damit kein Blocker für den Phasenabschluss, sondern ein separat zu behebender,
  phasenunabhängiger Datenlaufbefund.

### Anti-Pattern-Scan

Grep über die zentralen phase-modifizierten Dateien (`scripts/datamine-missions.mjs`,
`scripts/verify-datastand.mjs`, `scripts/verify-metrics.mjs`,
`scripts/lib/metrics-baseline.mjs`, `src/lib/missions.ts`, `src/components/MissionsApp.astro`,
`src/components/MissionDetail.astro`, `scripts/probes/missionsorte-messung.mjs`,
`scripts/build-universal-db.mjs`, `scripts/datamine-crafting.mjs`) nach
`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`: keine echten Schuldenmarker gefunden — die einzigen
Treffer sind legitime, bereits vorbestehende Konstantennamen für Spieldaten-Leerwerte
(`@LOC_PLACEHOLDER` als Set-Eintrag, `PLACEHOLDER`-Regex zur Erkennung fehlender
Bezeichnungen) — kein 🛑 Blocker.

### Datenqualität — eigene Stichproben

- `dist/missionen.html` `<select id="mx-loc">`: 50 `<option>`-Einträge (49 Katalogeinträge +
  1 Default), enthält `Hurston`, enthält **keinen** rohen `Stanton1`/`StantonStar`-Bezeichner.
- Ortskatalog vollständig ausgegeben und durchgesehen: keine internen Kürzel mehr sichtbar
  (`Aberdeen`, `Klescher Rehabilitation Facility`, `Region A`–`Region D`, `Pyro And Nyx` usw.
  statt Rohbezeichner) — auch die neun verbleibenden „Rückfall"-Einträge sind lesbare
  Wortfolgen, keine Kürzel.
- `npm run verify:windows`: Register lesbar, 47 Einträge geprüft, 0 CRLF-Reste.

## Human Verification Required

Vier Sichturteile stehen bewusst offen (WINDOWS.md id 45-48) — sie sind nach CLAUDE.md
ausdrücklich Betreiber-Entscheidungen, kein Skripturteil, und dieselbe Handhabung wie bei
den Phasen 1.2, 2, 3, 9, 10, 12, 14, 16 und 17 dieses Projekts:

### 1. S-1 — Trägt die Ortsangabe als Planeten-/Systemebene? (id 45)

**Test:** Region-Zeile einer Missions-Detailseite UND das Filterfeld `#mx-loc` auf
`/missionen` bzw. `/de/missionen` ansehen: wirkt „Hurston" bzw. „Stanton (System)"
glaubwürdig als Planeten-/Systemebene, oder liest es sich wie eine Stationsangabe? DE+EN,
beide Farbmodi, 1920×1080 UND 1280×720.
**Expected:** Betreiber-Urteil zu Erfolgskriterium 4.
**Why human:** Kein Skript kann „liest sich glaubwürdig" entscheiden.

### 2. S-2 — Englische Slot-Art-Chips in der deutschen Fassung (id 46)

**Test:** Vier Ortsarten-Chips (Location/Destination/Pickup Location/Dropoff Location) im
Fließtext einer deutschen Missions-Detailseite ansehen.
**Expected:** Betreiber-Urteil, ob englische Marken in beiden Sprachfassungen verständlich
sind, oder ob deutsche Beschriftungen (z. B. Abholort/Lieferort) nötig wären.
**Why human:** Bewusste Sprachentscheidung mit Ermessensspielraum.

### 3. S-3 — Bedienbarkeit des Ortsfilters mit 49 Einträgen (id 47)

**Test:** `#mx-loc` auf `/missionen` bzw. `/de/missionen` mit jetzt 49 Einträgen (vorher 7)
als flache Liste ansehen.
**Expected:** Betreiber-Urteil, ob eine Gruppierung nach System (Stanton/Pyro/Nyx) nötig
wird.
**Why human:** UX-Bedienbarkeitsurteil.

### 4. S-4 — Site-weite Chip-Beschriftung ({TargetName} → Target Name) (id 48)

**Test:** Eine beliebige Missions-Detailseite ansehen — Marken erscheinen jetzt lesbar statt
in Binnengroßschreibung.
**Expected:** Betreiber-Urteil zur site-weiten Nebenwirkung.
**Why human:** Sichturteil außerhalb des engeren D-01..D-04-Umfangs.

## Gaps Summary

Keine Lücken im Sinne von „fehlend oder unwirksam umgesetzt". Alle vier Entscheidungen
(D-01..D-04) sind im Bestand vorhanden, wirksam verdrahtet und maschinell mehrfach belegt —
selbst nachgemessen, nicht nur aus den SUMMARYs übernommen. Der einzige Grund, warum diese
Prüfung nicht mit „passed" schließt, ist die bewusste Auslagerung von vier Sichturteilen an
den Betreiber (Konsequenz aus CLAUDE.md: „Sichturteile entscheidet kein Skript") — das ist
projektüblich (Phasen 1.2, 2, 3, 9, 10, 12, 14, 16, 17 folgen demselben Muster) und kein
technischer Mangel.

---

## Urteil: ZIEL ERREICHT (mit vier offenen Sichturteilen für den Betreiber)

**Begründung:** Alle vier Entscheidungen der ROADMAP (D-01 bis D-04) sind im Code umgesetzt
und von mir unabhängig gegen den Bestand nachgemessen — nicht aus den SUMMARYs übernommen.
Erfolgskriterium 1 ist nicht nur erreicht, sondern mit 1.180/1.347 deutlich übertroffen
(ursprünglicher Zielwert 800 war eine Fehlrechnung, korrekt als solche erkannt und über eine
vierte, real im Spiel vorhandene Datenquelle nachgebessert). Erfolgskriterien 2, 3, 5, 6, 7
und 8 sind vollständig maschinell verifiziert. Die Rot-Vorführung des neuen Tors
`verify:datastand` ist mit unabhängig reproduzierbaren Prüfsummen belegt, keine Dekoration.
Die gesperrte Sackgasse `CraftingQualityLocationOverrideRecord` ist nachweislich unangetastet
geblieben. Der `gate:data`-Fehlschlag an `verify:items` ist als vorbestehend und phasenfremd
bestätigt (er existierte bereits vor dem ersten Commit dieser Phase). Einzig Kriterium 4 trägt
eine Restfrage, die laut CLAUDE.md ausdrücklich kein Skript entscheiden darf — dafür stehen
die vier Sichturteile (WINDOWS id 45-48) beim Betreiber an. Die Phase ist damit technisch
fertig und inhaltlich korrekt; der Abschluss wartet auf die menschliche Abnahme dieser vier
Punkte, exakt wie bei den neun vorangegangenen Phasen mit demselben Muster.

---

*Verified: 2026-08-23T21:30:00Z*
*Verifier: Claude (gsd-verifier)*
