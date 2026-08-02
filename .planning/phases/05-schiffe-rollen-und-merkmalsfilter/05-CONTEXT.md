# Phase 5: Schiffe — Rollen- und Merkmalsfilter - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Die Schiffsübersicht (`/schiffe.html` EN, `/de/schiffe.html` DE) bekommt Filter, die die
Fachsprache des Spiels sprechen. Heute filtert sie über 8 Grobtypen aus der Wiki-API;
künftig über CIG-eigene Rollen aus den Spieldateien.

**In dieser Phase:** neue Datengewinnung aus dem DataCore, Filterkonsole der Übersichtsseite,
Kartenbeschriftung, Zusammenführung der beiden Sprachkopien zu einem Körper.

**Nicht in dieser Phase:** Schiffs-Datenblatt (`ShipDetail.astro`), Suchindex, Vergleichs-
funktion, Konto-/Favoritenbindung.

</domain>

<decisions>
## Implementation Decisions

### Datengrundlage

- **D-01:** Die Filterwerte stammen ausschließlich aus `Data.p4k` → `Game2.dcb`. Zwei Felder
  je Schiff: `VehicleComponentParams.vehicleCareer` (Beruf) und `.vehicleRole` (Rolle) —
  beides Lokalisierungsschlüssel, deren DE- und EN-Text **CIG selbst** in
  `Localization/<sprache>/global.ini` liefert. Keine Ableitung aus Marketingtext, keine
  Wiki-Foci, keine eigene Kategorisierung.
  — **Reversibility:** reversible — eigene JSON-Datei, die Seite fällt ohne sie auf den
  heutigen Typ zurück.

- **D-02:** Ausgabe in eine **neue** Datei `src/data/vehicle-roles.json`, geschrieben von
  einem neuen `scripts/datamine-vehicle-roles.mjs`. **Nicht** in `vehicles.json` einpflegen —
  die wird von `npm run sync:vehicles` aus der Wiki-API neu erzeugt und würde eingetragene
  Felder überschreiben. Das ist exakt der Grund, aus dem `vehicles-en.json` bereits getrennt
  liegt (siehe Kommentar in `src/i18n/vehicleText.ts`).
  — **Reversibility:** costly — Änderung der Ablage später zieht Sync-Skript, Content-Schema
  und beide Seitenhüllen nach.

- **D-03:** Join über den Record-Namen: `EntityClassDefinition.AEGS_Sabre` → `aegs-sabre` →
  unsere `id`. Verifiziert: **223 von 227**. Die 4 Fehltreffer sind alle der ATLS
  (Frachtexoskelett, liegt nicht unter `/spaceships/`). Diese 4 müssen im Ergebnis **benannt**
  sein, nicht stillschweigend leer — die Seite darf nicht so tun, als hätte sie 227 Rollen.

### Filterkonsole — drei Achsen

- **D-04:** Achse 1 **Beruf** (`vehicleCareer`), 7 tragende Werte als Grobfilter:
  Kampf · Transport · Erkundung · Unterstützung · Industrie · Wettkampf · Mehrzweck.
  Altwerte (`@procedural_text_null`, `@item_ShipFocus_*`, versehentliche `@vehicle_class_*`
  im Career-Feld) werden beim Datamine normalisiert, nicht in der Oberfläche.

- **D-05:** Achse 2 **Rolle**, gefiltert auf **Familienebene**, angezeigt auf **exakter
  Ebene**. 18 Familien decken die 223 Schiffe ab:
  Jäger 63 · Frachttransport 35 · Erkundung 27 · Passagiere 17 · Rennen 17 · Einsteiger 12 ·
  Bodenkampf 11 · Kanonenschiff 9 · Medizin 7 · Bomber 6 · Truppentransport 6 · Bergung 6 ·
  Abriegelung 5 · Bergbau 5 · Großkampfschiff 5 · Daten & Wissenschaft 3 · Betankung 3 ·
  Mehrzweck 2.
  Der Filter „Bergung" findet alle drei Gewichtsklassen; die Karte zeigt weiterhin die exakte
  CIG-Rolle („Schweres Bergungsschiff").

- **D-06:** **Verbundrollen werden zerlegt.** `starterlightfreight` zählt sowohl als
  *Einsteiger* als auch als *Leichter Frachter*; ebenso `lightfreight_mediumfighter`,
  `heavyfighterbomber`, `startermining`, `starterpathfinder`, `starterlightfighter`,
  `startersalvage`, `mediumfreightgunshio` (CIG-Tippfehler, trotzdem gültig). Sonst findet
  „Frachttransport" die Starter-Frachter nicht.

- **D-07:** Achse 3 **Signatur** als eigener Filter. Quelle:
  `SSCSignatureSystemParams.radarProperties.baseSignatureParams.signatures` — reine
  CIG-Zahlen, 22 Schiffe unter 1,00. Beschriftet mit CIG-eigenen HUD-Begriffen
  (`hud_scanning_info_ir_signature` → „IR-Signatur" / „IR Signature", ebenso EM und
  RQ/CS). Der Wert steht auf der Karte, damit der Nutzer selbst urteilt.
  **Begründung für die Aufnahme:** nur so ist der Prowler Utility auffindbar — CIG nennt ihn
  im Rollenfeld „Leichter Frachter"; seine Tarnfähigkeit steht ausschließlich in diesen Zahlen.

- **D-08:** Das Wort „Tarnung"/„Stealth" wird **nicht** als Filtername für die Signaturzahlen
  benutzt, obwohl es im Spiel existiert (`hud_Label_Stealth`). Grund: CIG verknüpft das Wort
  nirgends mit diesen Zahlen — die Verknüpfung wäre unsere Behauptung. „Tarn-" trägt allein
  die CIG-Rolle (Tarnjäger 6, Tarnbomber 1). Der Signaturfilter heißt nach dem, was gemessen ist.

- **D-09:** Kleine Merkmalsleiste zusätzlich, aus vorhandenen CIG-Feldern:
  **Bewaffnet** (`dogfightEnabled`), **Frachtraum** (`cargoSCU > 0`), **Bodenfahrzeug**
  (`isGravlevVehicle` / `movementClass`). Vom Nutzer ausdrücklich gewünscht. Caveat für die
  Planung: überschneidet sich teils mit der Rolle — wenn ein Merkmal in der Praxis nichts
  aussiebt, was die Rolle nicht schon aussiebt, gehört es raus statt hinein.

### Bedienung

- **D-10:** **Schnellzugriff-Chips** über der Filterkonsole setzen Rolle + Signatur in einem
  Klick. Startbelegung: Tarnkappenbomber · Frachter mit gesenkter Signatur · Bergbau ·
  Bergung · Betankung · Abriegelung · Rennen. Zweck: die Kombinationsfähigkeit sichtbar
  machen, statt sie im Menü zu verstecken.

- **D-11:** Die exakte CIG-Rolle **ersetzt** `fociDe`/`vRole()` als Kartenbeschriftung.
  Begründung: die Wiki-Foci sind Mischsprache (`Bergung` neben `Salvage` neben
  `Medium Salvage`), enthalten Tippfehler (`Abrieglung`) und Dubletten
  (`Aufklärung + Aufklärung`). Für die 4 ATLS-Einträge ohne CIG-Rolle bleibt `fociDe` Rückfall.

### Sprachfassungen

- **D-12:** Die Übersichtsseite wird auf **EIN Körper** gezogen —
  `src/components/ships/ShipsOverview.astro`, die beiden Seiten unter `src/pages/` werden
  Hüllen mit `lang`-Parameter. Das ist das im Projekt etablierte Muster (Patches, Themen)
  und trägt den Class-A-Befund aus `CONCERNS.md` für dieses Seitenpaar ab.
  — **Reversibility:** costly — Rückbau auf zwei Kopien hieße, den doppelten Stilblock und
  das doppelte Skript wieder von Hand zu spalten.

- **D-13:** Fehlende deutsche CIG-Fassungen werden **von uns gefüllt**, nicht englisch
  durchgereicht. Betrifft u. a. `antiair`, `lighttank`, `heavytank`, `generalist`,
  `lightrefueling`, `mediumsalvage`, `recovery`, `modular`, `snubcarrier`, `antivehicle`,
  `heavydropship`, `starterlightfighter`, `lightfreight_mediumfighter`, `heavyfighterbomber`,
  `startermining`, `startersalvage`, `ALT:HeavyGunship`. Die Übersetzungstabelle gehört
  neben die bestehenden Maps in `src/i18n/vehicleText.ts`.

### Claude's Discretion

- Aufteilung der Familienzuordnung (Rolle → Familie): Datei-Ablage und Form frei, solange
  sie an einer Stelle steht und nicht über Seiten dupliziert wird.
- Optik der Filterkonsole innerhalb der bestehenden Sci-Fi-Sprache der Seite.
- Ob der Signaturfilter Stufen („unter 1,00 / unter 0,80") oder einen Schieber bekommt.
- Verifikationsskript für den Datamine (analog `verify-hardpoints.mjs`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diese Phase
- `.planning/phases/05-schiffe-rollen-und-merkmalsfilter/RESEARCH.md` — vollständige
  DataCore-Erhebung: Feldnamen, Wertelisten mit Zähler, Join-Rate, geprüfte **und verworfene**
  Spuren. §4 nennt namentlich die Fallstricke (Item-Ports als Sackgasse, `Controller_Salvage`
  am falschen Schiff, `Ground_Refueling_Port` ist Anschluss statt Fähigkeit).

### Datengewinnung (bestehende, erprobte Wege)
- `scripts/datamine-ship-loadouts.mjs` — Vorbild für Record-Auswahl, Varianten-Filter
  (`isVariantJunk`), ID-Join und Lokalisierung über `global.ini`. Der neue Datamine folgt
  diesem Aufbau.
- `scripts/lib/datacore.mjs` — eigener `Game2.dcb`-Parser, `openDataCore()`, `readRecord()`.
- `scripts/lib/p4k.mjs` — `openP4k()`, `DEFAULT_P4K` (per `SC_P4K` überschreibbar).

### Betroffene Seiten und Datenschicht
- `src/pages/schiffe.astro` / `src/pages/de/schiffe.astro` — die beiden Handkopien.
- `src/i18n/vehicleText.ts` — `vType`/`vSize`/`vStatus`/`vRole`/`vFoci`, plus der Kommentar,
  der erklärt, **warum** EN-Texte getrennt von `vehicles.json` liegen (D-02 stützt sich darauf).
- `src/content.config.ts` — Zod-Schema der `vehicles`-Collection.

### Projektregeln
- `.planning/PROJECT.md` — Kernwert „Spielgenaue Daten"; **Achtung:** führt „Neue Datenquellen
  oder Datamine-Ausbau" unter *Out of Scope* für den laufenden Meilenstein. Diese Phase bricht
  das auf ausdrücklichen Nutzerwunsch; PROJECT.md ist entsprechend nachzuziehen.
- `.planning/codebase/CONCERNS.md` — Class A: Auseinanderdriften der Sprachpaare (Grundlage D-12).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **DataCore-Pipeline**: `openP4k` + `openDataCore` laufen bereits produktiv; ein voller
  Record-Durchlauf über 360 Schiffe dauert im Test rund eine Minute. Kein neuer Unterbau nötig.
- **`isVariantJunk`-Filter** aus `datamine-ship-loadouts.mjs` — hält `_ai_`, `_test`,
  `_dummy`, Wrack- und Lehrvarianten heraus; wird unverändert übernommen.
- **`vehicleText.ts`-Map-Muster** — die bestehenden `SIZE_EN`/`STATUS_EN`/`FOCI_EN`-Tabellen
  sind die Vorlage für die Lückenfüllung aus D-13.
- **Ein-Körper-Muster** unter `src/components/patches/` und `src/components/topics/` — Vorlage
  für D-12.

### Established Patterns
- Statischer Astro-Build, `build.format: 'file'`; **kein Node in Produktion** — die Filterung
  läuft clientseitig über `data-*`-Attribute, wie schon heute in `schiffe.astro`.
- Handgeschriebenes CSS/JS, kein Bundler. Der Hellmodus entsteht generiert über `npm run theme`
  — die erzeugten Blöcke (`:root[data-theme="light"] …`) **nicht** von Hand anfassen.
- Datamine-Skripte schreiben eine committete Momentaufnahme nach `src/data/`; die Seite liest
  nur diese, nie eine Live-API.

### Integration Points
- `cards`-Modell in beiden Seiten (`data-type`, `data-maker`, …) — hier kommen die neuen
  `data-career`, `data-role`, `data-rolefam`, `data-sig` dazu.
- Die Filter-Funktion `apply()` im Inline-Skript ist der Ort für die neuen Achsen; sie muss
  Mehrfachwerte je Karte verkraften (Verbundrollen aus D-06 → mehrere Familien pro Schiff).
- `npm run verify` / `audit:site` als Einhängepunkt für eine Prüfung der Join-Rate.

</code_context>

<specifics>
## Specific Ideas

- Ausgangswunsch des Nutzers, wörtlich: Filter für „Stealth bomber", „stealth cargo (prowler
  utility)", und statt „industrial" die feineren „Salvage", „mining", „cargo hauling",
  „refueling". **Alle fünf sind Abnahmefälle** für diese Phase.
- Leitplanke, die der Nutzer im Gespräch gesetzt hat: *„wir sollten nur die Daten benutzen,
  die aus dem Spiel kommen."* Daraus folgt D-01 und die Zurückhaltung in D-08.
- Der Nutzer hat die anfängliche Empfehlung, die Signaturzahlen wegzulassen, nach Vorlage der
  Konsequenz (Prowler Utility unauffindbar) revidiert — die Zahlen sind drin, aber nüchtern
  beschriftet.

</specifics>

<deferred>
## Deferred Ideas

- **Schiffs-Datenblatt** (`ShipDetail.astro`, 2135 Zeilen) mit denselben Rollen/Signaturwerten
  anreichern — eigene Phase, hier bewusst ausgeklammert.
- **Suchindex** (`search-index.json.ts`) um Rollenbegriffe erweitern, damit Strg+K
  „Bergungsschiff" findet — eigene Phase.
- **Bergung / Betankung / Traktorstrahl als Merkmale** aus dem Standard-Loadout. Machbar, aber
  die naive Suche liefert Fehltreffer (RESEARCH.md §4); braucht einen eigenen Prüfdurchgang.
  Für diese Phase decken die CIG-Rollen *Bergung* (6) und *Betankung* (3) den Bedarf ab.
- **ATLS-Lücke schließen** — die 4 Einträge liegen im DataCore an anderer Stelle; Suche danach
  ist eigene Arbeit und für diese Phase nur zu *benennen*, nicht zu lösen.
- **Die übrigen 66 Sprachpaare** auf EIN Körper ziehen (Class-A-Befund insgesamt) — hier wird
  nur das Schiffs-Paar abgetragen.

</deferred>

---

*Phase: 05-schiffe-rollen-und-merkmalsfilter*
*Context gathered: 2026-08-02*
