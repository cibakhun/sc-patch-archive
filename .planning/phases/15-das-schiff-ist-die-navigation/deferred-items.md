# Deferred Items — Phase 15

Funde, die WAEHREND dieser Phase entdeckt, aber NICHT von der aktuellen
Task/Welle verursacht wurden (Scope-Grenze, siehe Executor-Regeln). Nicht
angefasst, hier nur protokolliert.

## `#holoact` ("Hologramm aktivieren") ist trotz `hidden` sichtbar unter 820px

**Gefunden:** 15-01, Task 3 (S-0-Bildschirmfotos, 18.08.2026).
**Datei:** `src/components/ShipDetail.astro` Z. 1334 (Markup), Kollision mit
`assets/mobile-ux.css` (globale Mobil-Regel).

**Befund:** `#holoact` traegt das `hidden`-Attribut und *keinen*
Klick-Listener (bestaetigt, `grep -n "holoact" src/components/ShipDetail.astro`
findet nur die eine Markup-Zeile) — laut `15-UI-SPEC.md` Detailvertrag Punkt 10
("Bekannte Fallstricke") soll er bereits inert/unsichtbar sein. Das stimmt
NICHT: `assets/mobile-ux.css` traegt eine sitweite Regel
`@media(max-width:820px){button,[role="button"],summary{display:inline-flex;...}}`
(Touch-Zielgroessen-Reset). Autor-CSS mit einer `display`-Deklaration schlaegt
IMMER die UA-Regel `[hidden]{display:none}` (unabhaengig von Spezifitaet,
andere Kaskadenebene) — derselbe Fallstrick, den `assets/account-dossier.css`
Z. 48-54 bereits kennt und dort mit `.dsr [hidden]{display:none!important}`
absichert. `#holoact` hat diese Absicherung nicht.

**Sichtbare Folge:** unter 820px zeigt jede Schiffsseite mit Hologramm-Daten
einen funktionslosen "HOLOGRAMM AKTIVIEREN"/"ACTIVATE HOLOGRAM"-Knopf mittig
auf der Buehne (Bildschirmfoto: `carrack-anvl-carrack_en_360_A-unselektiert`,
15-01 Task 3). Klick tut nichts.

**Warum nicht in dieser Welle behoben:** Weder Markup noch die CSS-Regel
gehoeren zu den Dateien dieses Tasks (P-1/P-2/P-3); die Regel in
`mobile-ux.css` ist site-weit und wirkt auf JEDEN Knopf mit `hidden`, ein
Fix dort braucht eine eigene Gegenprobe ueber alle betroffenen Seiten.
Ausserdem: `15-01-PLAN.md` <artifacts_this_phase_produces> listet
`.holo__activate`/`#holoact` bereits unter "Getilgt, nicht neu" — der Knopf
wird laut `15-UI-SPEC.md` Detailvertrag Punkt 7 in einer spaeteren Welle
(Ladeausloeser Klick->Scroll, D-04) ohnehin ERSATZLOS ENTFERNT. Ein
Zwischen-Fix waere Arbeit an Markup, das in Kuerze verschwindet.

**Empfehlung:** beim Umsetzen von Detailvertrag Punkt 7 den Knopf entfernen
wie dort beschrieben — kein separater Fix noetig, kein Blocker.

**Korrektur (15-02):** die urspruengliche Einschaetzung "voraussichtlich
15-02" hat sich nicht bestaetigt — `15-02-PLAN.md`s beide Tasks beruehren
ausschliesslich Pruefskripte (`scripts/verify-shipconsole.mjs`,
`scripts/lib/gate-registry.mjs`, `package.json`, `scripts/verify-shipcard.mjs`),
kein Markup und kein CSS. Detailvertrag Punkt 7 (Ladeausloeser Klick->Scroll,
D-04) ist noch nicht umgesetzt. Weiterhin offen, weiterhin kein Blocker —
faellt bei der Umsetzung von Punkt 7 in einer spaeteren Welle (voraussichtlich
15-03 oder 15-04) ohnehin ersatzlos weg.

---

## Nachtrag des Orchestrators (18.08.2026) — was der erweiterte Scan über Phase 14 aussagt

`X-holo-dims-hud` ist als Ausnahme sachlich in Ordnung: eine Kurzanzeige
unmittelbar am gerenderten Objekt ist etwas anderes als ein zweiter
Dateneintrag im Fließtext, und die Begründung nennt Anlass, Fundstelle und
Zombie-Wächter. **Aber sie hat eine Nebenwirkung, die im Protokoll stehen muss:**

Phase 14 hat Erfolgskriterium 1 („jeder der sieben doppelten Zahlwerte kommt
höchstens einmal vor") gegen eine **engere Regionsmenge** geprüft, als wir jetzt
kennen — `computeRegions()` sah damals nur `div.sd`, nicht `section.holo`. Die
Doppelung `L 126 m · B 74 m · H 30 m` in `.holo__dims` war also nicht etwa
erlaubt, sondern **außerhalb des Sichtfelds des Tors**. In der
Ausgangsmessung von `14-CONTEXT.md` steht sie sogar ausdrücklich drin: `126 m`
wurde dort mit vier Vorkommen gezählt, eines davon „Hero-Zeile".

Das ändert an Phase 14 nichts rückwirkend — die Zusicherung war nicht falsch,
nur schmaler als angenommen. Es ist aber genau der Fall, vor dem
`docs/maschinelle-validierung.md` Grundsatz 2 warnt: ein Tor, das weniger
prüft, als man glaubt, ist von einem vollständigen nicht zu unterscheiden,
solange niemand die Reichweite misst. Wer künftig eine Zusicherung dieser
Familie erweitert, sollte damit rechnen, dass Altbefunde auftauchen.

**Kein Blocker, keine Aufgabe** — nur eine Tatsache fürs Gedächtnis.

---

## Tote CSS-Regeln in `.sd__ch2col` seit 15-03 (Bewaffnung/Bauteilliste umgezogen)

**Gefunden:** 15-03, Task 1, beim Umzug von Bewaffnung und Bauteilliste aus
`ch-gear` in die Konsole.

**Befund:** Drei Zweispalter-Feinabstimmungen aus `14-04-PLAN.md`
(`.sd__ch2col .sd__slots{...}`, `.sd__ch2col .arm__scell span{...}`,
`.sd__ch2col .arm__sum{...}`, `src/components/ShipDetail.astro`
Z. rund 1071-1073/1093-1094) greifen ins Leere: `.sd__slots` und
`.arm__sum`/`.arm__list` stehen seit diesem Task nicht mehr innerhalb
eines `.sd__ch2col`-Kapitels (sie sind vollstaendig in `section.holo__sys`
gewandert) — die Selektoren treffen nichts mehr.

**Warum nicht in diesem Task entfernt:** Die Regeln dokumentieren
hart erarbeitete Hoehenbudget-Messungen aus Phase 14 (konkrete
Bildschirmfoto-Gegenproben gegen Wortumbrueche); sie zu loeschen war
nicht Teil der Task-1-Anweisung (SCHRITT 4 nennt nur den Markup-Umzug),
und ein Fehlgriff beim Loeschen historischer Kommentare waere teurer
als das harmlose tote CSS selbst. `npm run gate` sieht das nicht (kein
Tor prueft auf ungenutzte Selektoren).

**Empfehlung:** beim naechsten Eingriff in diesen CSS-Block (voraussichtlich
Welle 4, wenn `.sd__ch2col` fuer `ch-gear` ohnehin neu vermessen wird)
die drei Regeln entfernen oder explizit als historisch markieren.

---

## Sichtbefund des Orchestrators (20.08.2026) — Kollisionen bei 1280 px, MUSS in 15-05

Nach Welle 4 am gebauten `dist/` angesehen (`astro preview`, 1280 × 900, Carrack
DE). Bei **360 px ist alles in Ordnung** — die hochformatige Bühne trägt, die
Rail wird zur Chip-Reihe, die Marker sitzen sichtbar auf dem Rumpf.

**Bei 1280 px kollidiert die alte, absolut positionierte Hero-Chrome mit dem
neuen Drei-Spalten-Raster.** Kein Tor kann das sehen; alle 19 Schritte sind grün
und `verify:shipconsole --report` meldet 0 Befunde über acht Zusicherungen.

1. **`← SCHIFFE` liegt auf dem ersten Rail-Eintrag.** Der Zurück-Link und
   „KOMPONENTEN 8" stehen übereinander an derselben Stelle oben links.
2. **Die Brotkrume ist abgeschnitten.** Von „HANGAR // ANVIL AEROSPACE" ist nur
   noch `OSPACE` sichtbar — die Rail überdeckt den Anfang.
3. **`.holo__dims` liegt auf der Auslesung.** „L 126 M · B 74 M · H 30 M"
   überlagert die Zeile „8 am Schiff verortet" im rechten Kopf.
   ⚠ Zusammenhang: genau diese HUD-Anzeige trägt die benannte Ausnahme
   `X-holo-dims-hud` aus Welle 2. Wenn sie hier ohnehin umgezogen oder entfernt
   wird, sollte die Ausnahme mit überprüft werden — der Zombie-Wächter meldet
   sie sonst.
4. **`SCHILDGENERATOREN` wird rechts angeschnitten**, und die Auslesungsspalte
   läuft unten aus der Bühne heraus (die Radar-Karte ist gekappt).

**Warum das hierhergehört und nicht in einen Schnellfix:** die vier Punkte haben
dieselbe Ursache — Elemente, die für eine bildfüllende Hero-Bühne gedacht waren,
stehen jetzt in einem Raster mit drei Spalten. Sie einzeln zu verschieben ist
Flickwerk; sie gehören in einem Zug in das Raster überführt.

**Kein Blocker für die Sicherung von Welle 4** (die ist committet und grün),
aber ein **Blocker für staging**.
