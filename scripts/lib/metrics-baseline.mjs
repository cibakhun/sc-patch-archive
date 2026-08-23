/* ============================================================
   metrics-baseline.mjs — die Klinken der Bestandszahlen.

   Gelesen von scripts/verify-metrics.mjs. Bauform bewusst wie
   scripts/lib/sync-exclusions.mjs: eine Datei, in der jede Zeile ihren
   ANLASS mitfuehrt. Eine nackte Zahl ohne Herkunft ist nach einem Jahr
   unantastbar — niemand traut sich, sie zu aendern, und niemand weiss,
   warum sie so hoch ist.

   REGELN:
     'min'   darf wachsen, nicht fallen. `toleranzProzent` nur dort, wo
             die Zahl naturgemaess atmet (Preiszeilen kommen und gehen
             mit den Shops).
     'exakt' jede Aenderung ist eine Entscheidung und braucht einen
             Commit, dessen Botschaft sie begruendet.

   NACHZIEHEN: Waechst ein Bestand, meldet das Tor nichts — die Zahl hier
   darf dann gelegentlich per bewusstem Commit angehoben werden (der Diff
   zeigt die Entwicklung). Faellt ein Bestand, ist die Klinke NICHT die
   Stellschraube: erst die Ursache klaeren. Ein gesenkter Wert ohne
   Ursachensatz ist genau die stille Schrumpfung, gegen die es das Tor
   gibt (siehe den -834-Items-Vorfall im Kopf von verify-metrics.mjs).

   Alle Startwerte sind am 09.08.2026 gegen den Stand `fa3591b` gemessen
   (npm run build, 17.361 Seiten), nicht geschaetzt.
   ============================================================ */

export const BASELINE = [
  // ---------------- Item-Katalog ----------------
  {
    id: 'items',
    wert: 9168,
    regel: 'min',
    toleranzProzent: 1,
    anlass:
      'Messlauf 09.08.2026. Die Kennzahl existiert wegen des Vorfalls im Juli 2026: sync:item-prices lief gegen eine veraltete externe global.ini und verkleinerte den Katalog um 834 Eintraege — Wochen unbemerkt.',
  },
  {
    id: 'itemsMitBezugsquelle',
    wert: 4574,
    regel: 'min',
    toleranzProzent: 1,
    anlass:
      'Messlauf 09.08.2026. Beim selben Vorfall verloren 319 Items ihre Bezugsquellen, ohne dass die Gesamtzahl der Items das allein gezeigt haette — deshalb eine eigene Klinke neben `items`.',
  },
  {
    id: 'itemsMitSpieldaten',
    wert: 6642,
    regel: 'min',
    toleranzProzent: 1,
    anlass:
      'Messlauf 09.08.2026. Faellt der Join zwischen Katalog und DataCore-Extraktion aus, bleiben die Items bestehen und verlieren nur ihre technischen Daten — sichtbar allein an dieser Zahl.',
  },
  {
    id: 'uexPreiszeilen',
    wert: 23705,
    regel: 'min',
    toleranzProzent: 5,
    anlass:
      'Messlauf 09.08.2026. Groessere Toleranz als der Rest: Shops und Terminals kommen und gehen mit jedem Patch, ein Rueckgang um wenige Prozent ist normale Bewegung, ein Einbruch nicht.',
  },
  {
    id: 'ruestungsSets',
    wert: 136,
    regel: 'min',
    anlass:
      'Messlauf 09.08.2026. Die Sets entstehen aus der Dreier-Kette in scripts/lib/armor-sets.mjs; reisst die Kette, faellt die Zahl auf 0 und /armor-sets.html ist leer, ohne dass etwas bricht.',
  },

  // ---------------- Fahrzeuge ----------------
  {
    id: 'fahrzeuge',
    wert: 227,
    regel: 'exakt',
    anlass:
      'Phase 01.4-03: 223 aus der Extraktion plus die vier ATLS-Varianten. Exakt statt Minimum, weil jede Aenderung an dieser Zahl einen Datamine-Beleg braucht — nach oben wie nach unten.',
  },
  {
    id: 'fahrzeugeMitBauteilen',
    wert: 223,
    regel: 'min',
    anlass:
      'Phase 07: Steckplatz-Groessen aus der Fahrzeug-Implementierungs-XML; 223 von 227 joinen (die vier ATLS haben keine). Faellt die Zahl, findet der Bauteil-Filter still weniger Schiffe.',
  },
  {
    id: 'fahrzeugeMitRolle',
    wert: 223,
    regel: 'min',
    anlass:
      'Phase 06 (ROLE-10), Stand 02.08.2026. Dieselbe Klinke prueft verify:vehicle-roles im eigenen Skript — hier gespiegelt, damit EIN Ort alle Bestaende der Seite zeigt.',
  },
  {
    id: 'fahrzeugeMitHardpoints',
    wert: 227,
    regel: 'min',
    anlass:
      'Grundlage der 3D-Hologramme (227/227). Faellt die Zahl, zeigen Schiffs-Datenblaetter still keine Marker mehr.',
  },

  // ---------------- Crafting / Bergbau ----------------
  {
    id: 'blueprints',
    wert: 1594,
    regel: 'min',
    anlass:
      'Phase 08, Messlauf 09.08.2026. 1.514 der Karten tragen eine Chip-Reihe; verify:crafting prueft deren Inhalt, aber nicht, ob ueberhaupt noch alle Karten da sind.',
  },
  {
    id: 'minerale',
    wert: 37,
    regel: 'min',
    anlass:
      'Messlauf 09.08.2026. verify:mining prueft die Stimmigkeit der Mineraldaten, nicht ihre Vollstaendigkeit — ein halbierter Datenlauf bliebe dort gruen.',
  },

  // ---------------- Missionen ----------------
  {
    id: 'missionenMitOrt',
    wert: 1150,
    regel: 'min',
    toleranzProzent: 2,
    anlass:
      'Phase 18 (Missionen wissen, wo sie spielen), Messlauf 23.08.2026, angehoben nach Betreiber-Auftrag E-1 (Plan 02, "vierte Ortsquelle"). Ausgangswert vor jedem Eingriff: 43 von 1.347 Familien mit Ortsangabe. Welle 1 (D-01, ContractPrerequisite_Location.locationAvailable): 609 — unter dem urspruenglichen ROADMAP-Zielwert 800, weil die dort gelesene Praereqisit-Sorte die SELTENERE der beiden im DataCore vorhandenen war. E-1 hat zusaetzlich `ContractPrerequisite_Locality.localityAvailable` (-> MissionLocality, ueber achtmal so oft vorkommend) sowie eine bislang ungelesene dritte Fundstelle (`subContracts[].additionalPrerequisites[]`) erschlossen: gemessen 1.180. Klinke auf 1150 (2% Toleranz unter dem gemessenen Wert), NICHT auf 1180 exakt, damit ein legitim schwankender Missionsbestand (neue Contracts je Patch) das Tor nicht bei jedem Patch reisst. Rueckbau der Ortskante faengt diese Klinke trotzdem, da 1150 weit ueber dem Ausgangswert 43 liegt.',
  },
  {
    id: 'missionsOrtsarten',
    wert: 4,
    regel: 'min',
    anlass:
      'Phase 18 (Missionen wissen, wo sie spielen), Plan 02, Task 3, Messlauf 23.08.2026. Ausgangszustand: alle vier Ortsarten (Spielort/Zielort/Abholort/Lieferort) fielen in `braces()` auf eine einzige Sammelmarke `{Address}` zusammen (932 Vorkommen in missions.json), womit die Frachtroute einer Liefermission nicht mehr rekonstruierbar war. Die Unterscheidung entsteht in EINER Zeile des Erzeugers (die Selektionsbedingung in `braces()`) — ihr Verlust braeche nichts sichtbar (die Seite baut weiter, sieht vollstaendig aus), waehrend Abhol- und Lieferstelle wieder ununterscheidbar waeren. Untergrenze 4, nicht der gemessene Ist-Wert (6): D-03 benennt vier Ortsarten als Ziel, mehr ist Zugewinn (z.B. ein Rueckfall auf das unbekannte erste Segment zaehlt als eigene Art), weniger ist Rueckbau.',
  },

  // ---------------- Der gebaute Stand ----------------
  // Warum ueberhaupt Seitenzahlen: getStaticPaths kann bei kaputter
  // Datenquelle eine LEERE Liste liefern. Der Build meldet dann keinen
  // Fehler, er baut einfach weniger Seiten — genau der Ausfallmodus,
  // gegen den dieses Tor gebaut ist.
  {
    id: 'seitenGesamt',
    wert: 17361,
    regel: 'min',
    toleranzProzent: 2,
    anlass:
      'Messlauf 09.08.2026 (Build fa3591b). Toleranz 2 %, weil einzelne Seiten legitim kommen und gehen; ein Einbruch bedeutet eine ausgefallene Datenquelle.',
  },
  {
    id: 'seitenItems',
    wert: 5386,
    regel: 'min',
    toleranzProzent: 2,
    anlass: 'Messlauf 09.08.2026 — der groesste Einzelbereich, gespeist aus assets/universal-items.json.',
  },
  {
    id: 'seitenMissionen',
    wert: 1347,
    regel: 'min',
    toleranzProzent: 2,
    anlass: 'Messlauf 09.08.2026 — aus der DataCore-Missionsextraktion.',
  },
  {
    id: 'seitenCrafting',
    wert: 1655,
    regel: 'min',
    toleranzProzent: 2,
    anlass: 'Messlauf 09.08.2026 — aus assets/crafting-db.json.',
  },
  {
    id: 'seitenSchiffe',
    wert: 227,
    regel: 'min',
    anlass: 'Messlauf 09.08.2026 — je Fahrzeug ein Datenblatt; deckt sich mit `fahrzeuge`.',
  },
  {
    id: 'seitenPatches',
    wert: 19,
    regel: 'min',
    anlass:
      'Messlauf 09.08.2026 — 19 Patch-Koerper. Waechst nur am Patch-Tag, und dann bewusst.',
  },
  {
    id: 'seitenThemen',
    wert: 22,
    regel: 'min',
    anlass: 'Messlauf 09.08.2026 — 22 Themen-Koerper.',
  },
  {
    id: 'sitemaps',
    wert: 6,
    regel: 'exakt',
    anlass:
      'Messlauf 09.08.2026: sitemap.xml als Index plus fuenf Teile (pages, items, crafting, missions, ships). Exakt, weil eine verschwundene Teil-Sitemap ganze Seitenbereiche aus dem Index nimmt, ohne dass die Seite selbst etwas merkt.',
  },
];
