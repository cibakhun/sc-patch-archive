# Phase 17: Der Hangar — Kontext

**Erhoben:** 2026-08-20
**Status:** Bereit zur Planung — **zwei Betreiberentscheidungen offen** (siehe
zuletzt), ohne die kein Plan geschrieben werden darf.
**Herkunft:** Betreiber-Befund vom 20.08.2026 nach der Lieferung von D-01
(*„wir kommen dem ganzen immer näher, sind aber noch weit entfernt … noch
meilen weit weg davon"*), danach drei Attrappen vorgelegt
(`.planning/sketches/014-schiff-als-bildschirm/`), gewählt: **C — „Hangar"**.

⚠ **Phasennummer gegenprüfen.** Zum Zeitpunkt der Anlage war 17 frei, lokal
und auf `origin/staging`. Eine Parallelsitzung
(`claude/staging-tester-role-access-308ebf`) ist aktiv und hat am 20.08. schon
zweimal auf staging gedrückt. Vor jedem Merge `.planning/phases/` beider Seiten
vergleichen — git meldet die Kollision nie, die Verzeichnisnamen sind
verschieden.

---

## Phasengrenze

**In dieser Phase:** Die Schiffs-Detailseite hört auf, ein Raster aus Spalten
zu sein. Sie wird **ein Raum**: der Rumpf steht darin, die Werte hängen als
Beschriftung an ihren Stellen, und die Systemwahl ist eine **Blende**, die
umschaltet, *was beschriftet ist* — keine Navigation, die irgendwohin führt.

**Nicht in dieser Phase:**

- **Keine Datenänderung.** `holo-meshes.json` und `ship-hardpoints.json`
  bleiben unangetastet; alles Nötige liegt vor.
- **Keine anderen Seitentypen.** Items, Crafting, Missionen bleiben, wie sie
  sind. Reichweite bleibt die Schiffsseite (Fortschreibung aus Phase 16).
- **Die Schiffsübersicht `/schiffe`** ist nicht Gegenstand.
- **Kein neues Bedienmodell für die Auswahl selbst.** Marker anklicken →
  Detailkarte bleibt, wie es seit Welle 4 der Phase 16 funktioniert.

---

## Was am 20.08. tatsächlich geliefert wurde — und was nicht

D-01 ist eingelöst: über 454 Schiffsseiten gemessen `.sd__chapter` 0,
`.sd__jump` 0, je Seite genau eine `.holo__rail`, Rail-Anker und `.holo__sys`
in Bijektion. Die **Doppelung** ist weg.

Das Motiv ist es nicht. Gemessen am Versprechen aus 013 („das Schiff IST die
Navigation"):

| Versprechen | Ist-Zustand |
| --- | --- |
| Das Schiff ist die Navigation | Navigiert wird über die Liste links; das Schiff illustriert die Auswahl |
| Die Konsole ist der Bildschirm | Sie ist ein 450-px-Band; darunter beginnt sofort ein Dokument |
| Das Schiff ist der Gegenstand | Titel und Herstellerlogo liegen **auf** dem Rumpf |
| Acht Gruppen in einer Konsole | Vier davon haben mit dem Rumpf nichts zu tun; er wartet daneben |

Diese Phase greift die ersten drei Zeilen an. Die vierte ist Attrappe **B**
(„Das Schiff antwortet") und bleibt als eigener Vorschlag liegen — B und C
schließen sich nicht aus, aber sie in einer Phase zu bauen wäre zweimal
Neuland gleichzeitig.

---

## ⚠⚠ Zwei bindende Punkte stehen dem Entwurf im Weg

Genau die Prüfung, die in Phase 16 gefehlt hat und fünf Wellen gekostet hat:
**bevor geplant wird, nachsehen, was ein älteres Tor festschreibt.**

`16-UI-SPEC.md § 3a` bindet drei Punkte, `scripts/probes/schiffskonsole-messung.mjs`
belegt sie am gerenderten Bildpunkt. Zwei davon verletzt C direkt.

### P-2 — „kein Dauer-Label, nur der gewählte/überfahrene Marker trägt Text"

C besteht ausschließlich aus Dauer-Labels. Der Widerspruch ist wörtlich und
vollständig.

**Der Anlass hinter P-2 war gemessen, nicht gefühlt:** mit eingeschalteten
Labels bedeckten acht Textkästen mehr Fläche als das Schiff. Der Grund war
aber die **Platzierung** — die Kästen saßen *an den Markern, auf dem Rumpf*.
C setzt sie in die **Randspalten**, mit Führungslinie zum Rumpf, und lässt den
Rumpf selbst frei. Der Buchstabe von P-2 verbietet C; sein Anlass trifft C
nicht.

**Die Zahl entscheidet, ob das trägt.** Gemessen am gebauten `dist/`, alle 227
Schiffe, 826 Schiff-Gruppen-Paare:

| gleichzeitig zu beschriften | Median | P90 | max | Gruppen über 5 |
| --- | --- | --- | --- | --- |
| **je Port** | 5 | 9 | **20** (drak-ironclad-assault / prop) | 381 von 826 |
| **je Art** | 2 | 5 | **5** (aegs-avenger-stalker / core) | **0 von 826** |

Je Port ist C nicht baubar: 20 Beschriftungen sind eine Tapete, keine
Raumbeschriftung, und 46 % aller Gruppen lägen über fünf. **Je Art überschreitet
kein einziges Schiff-Gruppen-Paar die Fünf.** Das ist kein Schätzwert und keine
Obergrenze mit Reserve — es ist das Maximum über den gesamten Bestand.

Die Konsole zeigt für `prop`/`other` heute bereits Stückzahl-Listen
(„3× Haupttriebwerk", `sysKindCounts`) statt Einzelport-Zeilen. C erweitert
dieses Verfahren auf alle Gruppen: **Marker je Port, Beschriftung je Art.**

**Vorgeschlagene Neufassung von P-2:** *Kein Text auf dem Rumpf. Im Raum
höchstens fünf Beschriftungen gleichzeitig, ausschließlich in den Randspalten,
jede mit Führungslinie. Einzelport-Text nur bei Auswahl oder Zeigerkontakt.*
Der letzte Satz ist P-2 unverändert — die Detailkarte bleibt.

### P-1 — „das Schiff füllt ≥ 70 % der kürzeren Bühnenkante"

In C **ist** die Bühne das Fenster. Bei 1280×900 ist die kürzere Kante die
Höhe, und ein 2,13:1 flaches Schiff wie die Carrack kann sie nie zu 70 %
füllen, egal wie groß es skaliert wird. Am 20.08. einmal gebaut und gemessen:
mit `height:calc(100dvh - 182px)` fällt der Füllgrad bei 1440×900 auf **54,6 %**
(Bühne 870×718, Schiff 836×392). Der Umbau wurde deshalb zurückgenommen; er
liegt als **Ledger id 40** beim Betreiber.

**P-1 ist ein Stellvertreter.** Der Anlass aus Welle 1 war nicht „das Schiff
soll groß sein", sondern: *bei 860 px füllte das Schiff ein Viertel der Bühne,
die Marker waren 2–3 Bildpunkte groß und **nicht auffindbar**.* Gemessen wurde
der Füllgrad, gemeint war die Auffindbarkeit.

⚠ **Die Messgröße, die das direkt sagen würde, existiert — taugt aber nicht.**
`e-markergroesse` in derselben Sonde meldet fest `melde(..., true, ...)`: ein
Bericht, kein Urteil. Und die Zahlen sind ungeeicht — sie liefert für die
Carrack bei 1280 „Durchmesser min 919,6 px" auf einer **710 px breiten** Bühne.
Das kann nicht die sichtbare Marke sein; gemessen wird die Sprite-Fläche
(`sp.userData.base`, `assets/holo-viewer.js` Z. 1063–1084), und die ist
überwiegend durchsichtig. Als Klinke ist der Wert erst nach Eichung brauchbar.

**Damit ist P-1 heute die einzige Sicherung gegen unauffindbare Marker.** Wer
sie lockert, muss vorher die Ersatzsicherung bauen — sonst fällt eine
Zusicherung ersatzlos weg, und genau das darf nach `CLAUDE.md` Grundsatz 5
nicht stillschweigend passieren.

---

## Was die Tore festschreiben, das C anfasst

Geprüft am Quelltext, nicht vermutet:

| Tor / Zusicherung | schreibt fest | C bricht es? |
| --- | --- | --- |
| `verify:shipcard` [2] | genau 1 `.holo__rail`, 1–8 `.holo__sys` mit ids aus `SYS_IDS`; 0 `.sd__chapter`, 0 `.sd__jump` | **nein**, wenn die Blende die Klasse `.holo__rail` behält |
| `verify:shipcard` [3] | Bijektion Rail-Anker ↔ `sys-id` | **nein** |
| `verify:shipcard` [4] | `.holo__sys-ct` je `.holo__sys` genau eins | **nein** |
| `verify:shipcard` [5] | `.sd__proftrack` nur mit `sys-rank` | ⚠ **ja**, falls „Leistung" die Balken verliert — dann muss die Kopplung mitwandern |
| `verify:shipcard` [6] | Entdopplung: ein Zahl+Einheit-Token gehört genau EINER Region (`div.sd` **und** `section.holo`) | ⚠⚠ **ja**, wenn die schwebenden Beschriftungen **Kopien** sind. Sie müssen wie heute per `appendChild` **verschoben** werden, nicht dupliziert |
| `verify:shipconsole` [2] | Portgruppen-Verteilung (Welle-1-Klinke 4=179 3=20 2=22 1=6) | **nein** |
| `verify:shipconsole` [4] | P-3: Zähl-Chip == Portzahl, > 0 | **nein**, die Blende führt die Zählungen weiter |
| `verify:shipconsole` [5] | D-02: kein `hidden`, kein `<template>`, echte Anker, Text nicht leer | ⚠⚠ **ja**. Absolut positionierte Beschriftungen stapeln ohne Skript aufeinander |
| `verify:shipconsole` [6] | Textbestand-Klinke min 3.224 Bytes je Seite | **nein**, solange die Abschnitte im ausgelieferten HTML stehen |
| `verify:layers` | Kontrast am gerenderten Bildpunkt | ⚠ **neu zu messen**: Beschriftung über gerendertem Rumpf ist eine neue Kontrastlage |
| Sonde P-1 | Füllgrad ≥ 70 % | ⚠⚠ **ja**, siehe oben |
| Sonde P-2 | 0 Dauer-Labels | ⚠⚠ **ja**, siehe oben |

**Der schwerste Posten ist `verify:shipconsole` [5], nicht die Optik.** D-02
verlangt, dass die Seite ohne JavaScript eine lesbare Liste ist — bei ~17.000
indexierbaren Seiten und Zulauf fast nur aus der Suche
(⭐ 30 Tage: bing 67 / ddg 38 / chatgpt 10 / google 7) ist das keine
Barrierefreiheits-Kür, sondern die Existenzgrundlage. Der Raum darf deshalb
**nur der Skriptzustand** sein: ohne Skript stehen die Abschnitte gestapelt und
vollständig da, und erst das Skript hebt sie an ihre Plätze im Raum — dasselbe
Verfahren wie heute beim Umhängen in die Auslesung, nur mit Zielkoordinaten
statt einem Zielbehälter.

---

## Vorgeschlagene Wellenfolge

1. **Ersatzsicherung vor Lockerung.** `e-markergroesse` eichen (was misst der
   Wert wirklich, und was ist die Untergrenze, unter der eine Marke nicht mehr
   zu treffen ist) und als **Urteil** scharfschalten. Erst danach darf P-1
   fallen. Einmal vorgeführt rot.
2. **Beschriftung je Art.** `sysKindCounts` von `prop`/`other` auf alle Gruppen
   ausdehnen; Klinke „höchstens 5 gleichzeitige Beschriftungen" als Tor, gegen
   alle 826 Schiff-Gruppen-Paare gemessen.
3. **Der Raum, ohne Skript zuerst.** Gestapelter Zustand bauen und mit
   `javaScriptEnabled:false` belegen, **bevor** die Positionierung entsteht.
   D-02 ist die Vorbedingung, nicht die Nacharbeit.
4. **Platzierung im Raum.** Randspalten links/rechts, Führungslinien,
   Kollisionsauflösung zwischen den Beschriftungen; Kontrast am Bildpunkt
   gegen `verify:layers` messen.
5. **Blende statt Rail.** Die Rail wandert nach unten und wird zur
   Ebenenschaltung. Klasse und Anker bleiben — sonst reißen `verify:shipcard`
   [2]/[3] ohne Not.
6. **Sichtrunde**, DE und EN, 1280×900 und 360×740, beide Farbmodi.

---

## Offen beim Betreiber — ohne diese zwei Antworten kein Plan

1. **P-1 (Ledger id 40).** Fällt die Füllgrad-Klinke zugunsten einer
   Auffindbarkeits-Klinke? Ohne Antwort ist C nicht baubar: jede fensterhohe
   Bühne reißt sie bei flachen Schiffen rechnerisch, obwohl das Schiff darin
   größer aussieht als je zuvor.
2. **P-2.** Wird die Neufassung oben angenommen — kein Text auf dem Rumpf,
   höchstens fünf Beschriftungen in den Randspalten, Einzelport-Text weiterhin
   nur bei Auswahl?

Beides sind Sichturteile mit Messunterbau, keine Skriptbefunde. Sie gehören
nach `CLAUDE.md` an den Betreiber und nicht in eine Planentscheidung.
