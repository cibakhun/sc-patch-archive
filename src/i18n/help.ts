// Werkzeug-Hilfe — EIGENER Katalog, bewusst getrennt von src/i18n/ui.ts.
// ---------------------------------------------------------------------------
// Zweck: Zweck- und Bedienungstexte fuer die zwoelf Werkzeuge (Phase
// 01.2-werkzeuge-erklaeren), in zwei Stufen:
//   Stufe 1 — <werkzeug>.title / .purpose / .step1..step5 (Zweck-Abschnitt)
//   Stufe 2 — <werkzeug>.ctl.<art> (ein Satz je Bedienelement-ART)
// Dazu drei gemeinsame Bedientexte (ui.elements/.elementsOff/.bubbleLabel).
//
// Vorbild fuer Aufbau und Kopfkommentar: src/i18n/itemText.ts — eigenes
// i18n-Modul neben ui.ts, weil ui.ts mit 841 Zeilen schon gross genug ist
// (CONTEXT.md, Claude's Discretion).
//
// UNTERSCHIED zu useTranslations() aus ui.ts: dort faellt t() bei einem
// fehlenden Schluessel sichtbar auf Englisch zurueck (ui.ts:11/794) — genau
// das ist bei Hilfetexten verboten (DOC-04). useHelp() hier wirft deshalb
// stattdessen, und assertHelpParity() bricht bereits den Build ab, bevor
// eine Seite ueberhaupt gerendert wird.
//
// Tonfall (D-04/D-06): anredefrei, kein Du, kein Sie, erklaert die SEITE,
// nicht das Spiel. Kein Hinweis auf die Herkunft der Daten — durchgesetzt
// von `npm run audit:site`.
import type { Locale } from './ui';

/**
 * Schluessel, deren Wert in DE und EN ABSICHTLICH byte-gleich ist (z. B. ein
 * Eigenname). assertHelpParity() akzeptiert Gleichheit NUR fuer Schluessel in
 * dieser Liste — sonst gilt Gleichheit als vergessene Uebersetzung. Aktuell
 * leer; kuenftige Plaene tragen hier ein, was sie bewusst gleich lassen.
 */
const SAME_IN_BOTH = new Set<string>([]);

export const HELP = {
  de: {
    // -- Gemeinsame Bedientexte (alle zwoelf Werkzeuge) --
    'ui.elements': 'Elemente erklären',
    'ui.elementsOff': 'Erklärung beenden',
    'ui.bubbleLabel': 'Erklärung',

    // -- Item Finder --
    'itemfinder.title': 'Wie funktioniert der Item Finder?',
    'itemfinder.purpose':
      'Durchsucht alle Gegenstände des Spiels und zeigt zu jedem Größe, Werte und Bezugsquellen.',
    'itemfinder.step1': 'Suchbegriff eingeben oder Filter in der Seitenleiste wählen.',
    'itemfinder.step2': 'Nach Fundart, Größe, Panzerungsklasse oder Seltenheit einschränken.',
    'itemfinder.step3': 'Ergebnisse sortieren oder zwischen Einzelteilen und Sets wechseln.',
    'itemfinder.step4': 'Auf eine Karte klicken für Details, Werte und Fundorte.',
    'itemfinder.ctl.search': 'Freitextsuche über Namen und Beschreibung.',
    'itemfinder.ctl.kind': 'Schränkt auf eine Fundart ein, etwa kaufbar, Loot oder nur Katalog.',
    'itemfinder.ctl.size': 'Schränkt auf eine Größenklasse ein.',
    'itemfinder.ctl.weight': 'Schränkt auf eine Panzerungsklasse ein.',
    'itemfinder.ctl.rarity': 'Schränkt auf eine Seltenheitsstufe ein.',
    'itemfinder.ctl.category': 'Wählt eine Kategorie aus der Liste.',
    'itemfinder.ctl.view': 'Wechselt zwischen Einzelteilen und vollständigen Sets.',
    'itemfinder.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',

    // -- Crafting --
    'crafting.title': 'Wie funktioniert die Crafting-Datenbank?',
    'crafting.purpose':
      'Zeigt zu jedem Blueprint die Zutaten, die Craft-Zeit und woher er stammt — dazu ein Rechner, der ausrechnet, welche Items sich am besten zerlegen lassen.',
    'crafting.step1': 'Suchbegriff eingeben oder nach Kategorie und Ressource filtern.',
    'crafting.step2': 'Nur Blueprints mit Missions-Quelle oder im eigenen Besitz anzeigen.',
    'crafting.step3': 'Ergebnisse sortieren oder zwischen Raster und Liste wechseln.',
    'crafting.step4': 'Blueprints im Planer sammeln für die gemeinsame Einkaufsliste.',
    'crafting.ctl.filter': 'Öffnet die Filterleiste auf schmalen Bildschirmen.',
    'crafting.ctl.search': 'Freitextsuche über Blueprint-Namen und Ressourcen.',
    'crafting.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',
    'crafting.ctl.view': 'Wechselt zwischen Raster- und Listenansicht.',
    'crafting.ctl.planner': 'Öffnet den Planer mit der gesammelten Einkaufsliste.',
    'crafting.ctl.category': 'Schränkt auf eine oder mehrere Kategorien ein.',
    'crafting.ctl.resource': 'Schränkt auf eine oder mehrere Ressourcen ein.',
    'crafting.ctl.size': 'Schränkt auf eine oder mehrere Bauteilgrößen ein. Blueprints ohne hinterlegte Größe bleiben ausgeblendet, solange hier etwas angehakt ist.',
    'crafting.ctl.grade': 'Schränkt auf eine oder mehrere Güteklassen (A bis D) ein.',
    'crafting.ctl.flags': 'Zeigt nur Blueprints mit Missions-Quelle oder im eigenen Besitz.',

    // -- Mining --
    // Beschrieb bis 11.08.2026 das abgeloeste Werkzeug: Sortierung, Raster/
    // Liste, Methoden- und Typfilter, „Fundorte nach Himmelskoerper" — nichts
    // davon gibt es in der Werkbank noch. Die ctl-Schluessel heissen jetzt wie
    // die Bedienelemente, an denen sie haengen.
    // Seit 12.08.2026 OHNE Ausrüstung und ohne Brechbarkeit: die stehen im
    // Fracturing-Rechner auf einer eigenen Seite. Die Schlüssel .laser,
    // .modules, .gadget, .mass, .verdict und .breakable sind deshalb hier
    // weggefallen und weiter unten unter `fracturing.ctl.*` wieder da.
    'mining.title': 'Wie funktioniert die Mining-Werkbank?',
    'mining.purpose':
      'Ein Erz anklicken — Fundorte, beste Stationen und der Refinery-Ertrag stehen sofort daneben.',
    'mining.step1': 'Links ein Erz anklicken. Die Zahl auf der Kachel ist seine Scan-Signatur.',
    'mining.step2': 'In der Mitte die Fundorte des gewählten Erzes nach Ergiebigkeit ablesen, darunter die Stationen mit dem besten Ertrag.',
    'mining.step3': 'Unten die Station wählen — sie wird in der Ertrags-Rangliste rechts daneben hervorgehoben.',
    'mining.step4': 'Mit dem Anheft-Knopf auf einer Kachel ein Erz in die Signaturenliste rechts heften; die Nadel in einer Fundort-Zeile legt das Paar in die Fundort-Merkliste darunter — beide Listen stehen gleichzeitig sichtbar untereinander.',
    'mining.step5': 'Der Knopf oben rechts an dieser Spalte legt sie in ein eigenes, frei verschiebbares Fenster. In Chrome, Edge und Opera bleibt es über allen anderen Fenstern liegen — auch neben dem laufenden Spiel, sofern das im randlosen Fenstermodus läuft.',
    'mining.ctl.search': 'Freitextsuche über Mineralnamen und Fundorte.',
    'mining.ctl.system': 'Schränkt die Kacheln auf ein Sternsystem ein.',
    'mining.ctl.tiles': 'Alle Erze auf einen Blick. Klick wählt aus, die Zahl ist die Scan-Signatur, der Knopf rechts heftet an die Signaturenliste.',
    'mining.ctl.pinbtn': 'Heftet das gewählte Erz an die Signaturenliste rechts — dasselbe wie der Knopf auf der Kachel, nur größer.',
    'mining.ctl.pins': 'Nachschlagewerk: die angehefteten Erze mit ihrer Signatur mal Clustergröße, zum Vergleichen mit dem, was der Scanner im Spiel nennt.',
    'mining.ctl.presets': 'Benannte Zusammenstellungen — ein Preset hält Signaturen UND Fundorte zugleich: auswählen, umbenennen, mit der aktuellen Auswahl überschreiben oder einzelne Einträge entfernen; Löschen fragt zurück. Mit Konto gespeichert und auf jedem Gerät verfügbar.',
    'mining.ctl.popout': 'Legt diese Spalte in ein eigenes, frei verschiebbares Fenster. In Chrome, Edge und Opera bleibt es über allen anderen Fenstern liegen — auch neben dem laufenden Spiel, sofern das im randlosen Fenstermodus läuft. Andere Browser bekommen ein normales Extrafenster. Schließen legt die Liste zurück in die Spalte.',
    'mining.ctl.station': 'Die Station, deren Ertrag in der Rangliste hervorgehoben wird.',
    'mining.ctl.fracturing': 'Führt zum Fracturing-Rechner: dort steht, ob der Brocken mit deiner Ausrüstung bricht.',
    'mining.ctl.locpin': 'Die ganze Zeile öffnet diesen Fundort; die Nadel rechts heftet ihn zusätzlich an die Fundort-Merkliste darunter.',
    'mining.ctl.shortlist': 'Die angehefteten Fundorte über alle Erze hinweg, als „Erz — Fundort". Klick öffnet den Fundort, das × löst ihn.',

    // -- Fracturing-Rechner --
    'fracturing.title': 'Wie funktioniert der Fracturing-Rechner?',
    'fracturing.purpose':
      'Sagt für jedes Erz, ob der Brocken mit der eingestellten Ausrüstung aufgeht — und zeigt die Rechnung dahinter Schritt für Schritt.',
    'fracturing.step1': 'Rechts die Ausrüstung setzen: Laser, Module, Gadget und die Größe des Brockens.',
    'fracturing.step2': 'Links ein Erz wählen. Punkt und Verhältniszahl auf jeder Kachel gelten sofort für diese Ausrüstung.',
    'fracturing.step3': 'In der Mitte das Urteil ablesen — bis 1,00 geht nichts, ab 1,30 ist es zuverlässig.',
    'fracturing.step4': 'Der Rechenweg darunter zeigt, an welchem Schritt es hängt: Laserschaden, Widerstand, wirksamer Schaden, nötiger Schaden.',
    'fracturing.ctl.search': 'Freitextsuche über die Erznamen.',
    'fracturing.ctl.system': 'Schränkt die Kacheln auf ein Sternsystem ein.',
    'fracturing.ctl.breakable': 'Zeigt nur Erze, die mit der eingestellten Ausrüstung zuverlässig brechen.',
    'fracturing.ctl.tiles': 'Alle Erze mit ihrem Verhältnis für die aktuelle Ausrüstung. Klick wählt eines aus.',
    'fracturing.ctl.verdict': 'Verhältnis von wirksamem zu nötigem Schaden. Ab 1,00 grenzwertig, ab 1,30 zuverlässig.',
    'fracturing.ctl.math': 'Die vier Schritte der Rechnung mit den eingesetzten Zahlen und dem jeweiligen Zwischenergebnis.',
    'fracturing.ctl.laser': 'Der Mining-Laser. Bestimmt den Schaden und die Zahl der Modulplätze.',
    'fracturing.ctl.modules': 'Bis zu drei Module, je nach Laser. Sie verändern Schaden und Widerstand.',
    'fracturing.ctl.gadget': 'Ein Gadget verändert den Widerstand des Gesteins.',
    'fracturing.ctl.mass': 'Die angenommene Masse des Brockens — sie bestimmt, wie viel Schaden nötig ist.',

    // -- Patch-Archiv --
    'archive.title': 'Wie funktioniert das Patch-Archiv?',
    'archive.purpose':
      'Verzeichnet alle Alpha-Versionen als Zeitleiste, gegliedert in Ären, mit Suche über Namen und Themen.',
    'archive.step1': 'Suchbegriff eingeben oder eine Ära in der Leiste anklicken.',
    'archive.step2': 'Nach Major- oder Point-Releases filtern.',
    'archive.step3': 'Auf der Zeitleiste zu einem Patch scrollen oder springen.',
    'archive.step4': 'Auf eine Karte klicken für die volle Patch-Seite mit allen Themen.',
    'archive.ctl.era': 'Zeigt, welche Ära gerade im Sichtfeld ist.',
    'archive.ctl.search': 'Freitextsuche über Versionsnummer, Codename und Themen.',
    'archive.ctl.chips': 'Schränkt die Zeitleiste auf Major- oder Point-Releases ein.',
    'archive.ctl.count': 'Zählt, wie viele Patches die aktuelle Auswahl zeigt.',

    // -- Missionen --
    'missions.title': 'Wie funktioniert die Missionsdatenbank?',
    'missions.purpose':
      'Zeigt alle Missionsangebote mit Belohnung, Reputation, Auftraggeber und Ort — gebündelt zu Missionen.',
    'missions.step1': 'Suchbegriff eingeben oder nach Typ, Auftraggeber, Fraktion, Gilde oder Ort filtern.',
    'missions.step2': 'Nur Missionen mit Blueprints oder nach Rechtslage einschränken.',
    'missions.step3': 'Ergebnisse sortieren nach Name, Belohnung oder Anzahl der Angebote.',
    'missions.step4': 'Auf eine Karte klicken für Details, Belohnung und Reputation.',
    'missions.ctl.search': 'Freitextsuche über Titel, Auftraggeber, Fraktion und Ort.',
    'missions.ctl.select': 'Schränkt die Liste auf einen Wert dieser Auswahlliste ein.',
    'missions.ctl.blueprint': 'Zeigt nur Missionen, die Blueprints abwerfen können.',
    'missions.ctl.legal': 'Schränkt auf legale oder illegale Missionen ein.',
    'missions.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',

    // -- Rüstungssets --
    'armorsets.title': 'Wie funktioniert die Rüstungs-Sets-Seite?',
    'armorsets.purpose':
      'Zeigt zu jedem Rüstungs-Set alle Teile nach Hersteller, mit Kennzahlen zu Sets und Vollständigkeit.',
    'armorsets.step1': 'Zu einem Hersteller springen oder die Seite durchscrollen.',
    'armorsets.step2': 'Jedes Set zeigt seine Teile nach Körperzone gegliedert.',
    'armorsets.step3': 'Ein unterstrichener Teilname führt zum Item-Datenblatt.',
    'armorsets.step4': 'Die Kennzahlen oben zeigen Gesamtzahl, Teile und vollständige Sets.',
    'armorsets.ctl.keys': 'Zählt Sets, Teile, vollständige Sets und den Datenstand.',
    'armorsets.ctl.jump': 'Springt direkt zu den Sets eines Herstellers.',

    // -- Wikelo's Emporium --
    'wikelo.title': "Wie funktioniert Wikelo's Emporium?",
    'wikelo.purpose':
      'Zeigt alle Tauschgeschäfte des Banu-Händlers: was zu liefern ist und was es dafür gibt.',
    'wikelo.step1': 'Nach Kategorie filtern — Schiffe, Waffen, Rüstung oder Sonstiges.',
    'wikelo.step2': 'Jede Karte zeigt links, was verlangt wird, rechts, was es gibt.',
    'wikelo.step3': 'Unterstrichene Gegenstände zeigen ihre Bezugsquellen beim Anklicken.',
    'wikelo.step4': 'Weiter unten stehen die drei Stationen und der Patch-Verlauf.',
    'wikelo.ctl.filter': 'Schränkt die Handelskarten auf eine Kategorie ein.',
    'wikelo.ctl.grid': 'Das Raster aller Handelsgeschäfte des aktuellen Filters.',

    // -- Schiffe --
    'ships.title': 'Wie funktioniert der Schiffskatalog?',
    'ships.purpose':
      'Zeigt alle Schiffe und Fahrzeuge mit Werten, Bauteilen und beiden Preisen — Pledge und Ingame.',
    'ships.step1': 'Schiffs- oder Herstellernamen ins Suchfeld eingeben.',
    'ships.step2': 'Nach Hersteller, Beruf, Rolle, Größe, Signatur, Merkmal oder Bauteil filtern.',
    'ships.step3': 'Ergebnisse nach Name, Preis, Fracht oder Crew sortieren.',
    'ships.step4': 'Auf eine Karte klicken für das volle Datenblatt.',
    'ships.ctl.search': 'Freitextsuche über Schiffs- und Herstellernamen.',
    'ships.ctl.select': 'Schränkt die Flotte auf einen Wert dieser Auswahlliste ein.',
    'ships.ctl.sort': 'Legt die Sortierung der Ergebnisse fest.',

    // -- Precision Jump --
    'precisionjump.title': 'Wie funktioniert der Precision-Jump-Rechner?',
    'precisionjump.purpose':
      'Berechnet, wo der Quantenflug zwischen zwei Ankern zu unterbrechen ist, um im gewünschten Aaron-Halo-Band anzukommen.',
    'precisionjump.step1': 'Startort wählen.',
    'precisionjump.step2': 'Ziel-QT-Marker wählen.',
    'precisionjump.step3': 'Das gewünschte Halo-Band wählen.',
    'precisionjump.step4': 'Den angezeigten Auslösewert im Spiel ablesen und dort abbrechen.',
    'precisionjump.ctl.route': 'Legt Startort und Ziel-QT-Marker der Route fest.',
    'precisionjump.ctl.swap': 'Tauscht Startort und Ziel.',
    'precisionjump.ctl.band': 'Wählt das Aaron-Halo-Band, das die Route treffen soll.',
    'precisionjump.ctl.reset': 'Setzt die Route auf die Standardwerte zurück.',
    'precisionjump.ctl.table': 'Klappt eine Tabelle mit weiteren Werten auf.',

    // -- Refinery-Tracker --
    'refinerytracker.title': 'Wie funktioniert der Refinery-Tracker?',
    'refinerytracker.purpose':
      'Verfolgt laufende Refinery-Aufträge bis zur Abholung — anders als der Refinery-Finder vergleicht er nicht vorab, sondern begleitet Aufträge, die schon laufen.',
    'refinerytracker.step1': 'Raffinerie, Methode und Erze eines laufenden Auftrags eintragen.',
    'refinerytracker.step2': 'Bearbeitungszeit und Kosten aus dem Ingame-Terminal übernehmen.',
    'refinerytracker.step3': 'Den Countdown verfolgen und den Auftrag bei Fertigstellung abholen.',
    'refinerytracker.step4': 'Abgeholte Aufträge in der Historie mit dem echten Verkaufserlös abschließen.',
    'refinerytracker.ctl.stats': 'Zeigt Kennzahlen zu laufenden und abgeschlossenen Aufträgen.',
    'refinerytracker.ctl.active': 'Die laufenden Aufträge mit Countdown bis zur Fertigstellung.',
    'refinerytracker.ctl.station': 'Wählt die Raffinerie-Station des Auftrags.',
    'refinerytracker.ctl.method': 'Wählt die Refining-Methode des Auftrags.',
    'refinerytracker.ctl.ores': 'Trägt die Erze des Auftrags mit Roh- und Ausbeute-SCU ein.',
    'refinerytracker.ctl.duration': 'Legt die Bearbeitungszeit des Auftrags aus dem Terminal fest.',
    'refinerytracker.ctl.preview': 'Zeigt Ausbeute, geschätzten Wert und Fertigstellungszeit vorab.',
    'refinerytracker.ctl.history': 'Abgeschlossene Aufträge mit Gewinn und eintragbarem Verkaufserlös.',
  },
  en: {
    // -- Shared control copy (all eleven tools) --
    'ui.elements': 'Explain elements',
    'ui.elementsOff': 'Stop explaining',
    'ui.bubbleLabel': 'Explanation',

    // -- Item Finder --
    'itemfinder.title': 'How does the Item Finder work?',
    'itemfinder.purpose':
      'Searches every item in the game and shows size, stats and where to get it for each one.',
    'itemfinder.step1': 'Type a search term or pick filters in the sidebar.',
    'itemfinder.step2': 'Narrow down by availability, size, armor class or rarity.',
    'itemfinder.step3': 'Sort the results or switch between individual pieces and sets.',
    'itemfinder.step4': 'Click a card for details, stats and where to find it.',
    'itemfinder.ctl.search': 'Free-text search across name and description.',
    'itemfinder.ctl.kind': 'Narrows down to an availability type, such as purchasable, loot or catalog only.',
    'itemfinder.ctl.size': 'Narrows down to a size class.',
    'itemfinder.ctl.weight': 'Narrows down to an armor class.',
    'itemfinder.ctl.rarity': 'Narrows down to a rarity tier.',
    'itemfinder.ctl.category': 'Picks a category from the list.',
    'itemfinder.ctl.view': 'Switches between individual pieces and complete sets.',
    'itemfinder.ctl.sort': 'Sets the sort order of the results.',

    // -- Crafting --
    'crafting.title': 'How does the crafting database work?',
    'crafting.purpose':
      'Shows every blueprint’s ingredients, craft time and source — plus a calculator that works out which items are most efficient to dismantle.',
    'crafting.step1': 'Type a search term or filter by category and resource.',
    'crafting.step2': 'Show only blueprints with a mission source or already owned.',
    'crafting.step3': 'Sort the results or switch between grid and list view.',
    'crafting.step4': 'Collect blueprints in the planner for a shared shopping list.',
    'crafting.ctl.filter': 'Opens the filter sidebar on narrow screens.',
    'crafting.ctl.search': 'Free-text search across blueprint names and resources.',
    'crafting.ctl.sort': 'Sets the sort order of the results.',
    'crafting.ctl.view': 'Switches between grid and list view.',
    'crafting.ctl.planner': 'Opens the planner with the collected shopping list.',
    'crafting.ctl.category': 'Narrows down to one or more categories.',
    'crafting.ctl.resource': 'Narrows down to one or more resources.',
    'crafting.ctl.size': 'Narrows down to one or more component sizes. Blueprints without a recorded size stay hidden while anything is ticked here.',
    'crafting.ctl.grade': 'Narrows down to one or more grades (A through D).',
    'crafting.ctl.flags': 'Shows only blueprints with a mission source or already owned.',

    // -- Mining --
    // Since 12/08/2026 without gear and without breakability — those live in
    // the fracturing calculator on its own page (`fracturing.ctl.*` below).
    'mining.title': 'How does the mining workbench work?',
    'mining.purpose':
      'Pick an ore — locations, best stations and refinery yield stand right beside it.',
    'mining.step1': 'Click an ore on the left. The number on the tile is its scan signature.',
    'mining.step2': 'Read the selected ore’s locations by yield in the middle, with the stations that pay best underneath.',
    'mining.step3': 'Pick a station along the bottom — it gets highlighted in the yield ranking beside it.',
    'mining.step4': 'Hit the pin button on an ore tile to pin it to the signature list on the right; the pin on a location row puts the pair into the location shortlist underneath — both lists stay visible at the same time, stacked.',
    'mining.step5': 'The button at the top right of that column moves it into its own free-floating window. In Chrome, Edge and Opera it stays on top of every other window — next to the running game too, as long as that runs in borderless windowed mode.',
    'mining.ctl.search': 'Free-text search across mineral names and locations.',
    'mining.ctl.system': 'Narrows the tiles down to one star system.',
    'mining.ctl.tiles': 'Every ore at a glance. Click selects, the number is the scan signature, the button on the right pins it to the signature list.',
    'mining.ctl.pinbtn': 'Pins the selected ore to the signature list on the right — same as the button on its tile, only bigger.',
    'mining.ctl.pins': 'Reference table: the pinned ores with their signature times cluster size, to compare against what the scanner calls out in-game.',
    'mining.ctl.presets': 'Named sets — one preset holds signatures AND locations together: pick, rename, overwrite with the current selection, or remove single entries; deleting asks for confirmation. Saved to your account and available on every device.',
    'mining.ctl.popout': 'Moves this column into its own free-floating window. In Chrome, Edge and Opera it stays on top of every other window — next to the running game too, as long as that runs in borderless windowed mode. Other browsers get a plain extra window. Closing it puts the lists back into the column.',
    'mining.ctl.fracturing': 'Leads to the fracturing calculator: it says whether your gear cracks the rock.',

    // -- Fracturing calculator --
    'fracturing.title': 'How does the fracturing calculator work?',
    'fracturing.purpose':
      'Tells you for every ore whether the rock opens up with the gear you set — and shows the sum behind it step by step.',
    'fracturing.step1': 'Set your gear on the right: laser, modules, gadget and how big the rock is.',
    'fracturing.step2': 'Pick an ore on the left. The dot and ratio on every tile already apply to that gear.',
    'fracturing.step3': 'Read the verdict in the middle — nothing moves below 1.00, from 1.30 it is reliable.',
    'fracturing.step4': 'The maths underneath shows which step decides it: laser damage, resistance, effective damage, damage needed.',
    'fracturing.ctl.search': 'Free-text search across the ore names.',
    'fracturing.ctl.system': 'Narrows the tiles down to one star system.',
    'fracturing.ctl.breakable': 'Shows only ores the configured gear cracks reliably.',
    'fracturing.ctl.tiles': 'Every ore with its ratio for the current gear. Click selects one.',
    'fracturing.ctl.verdict': 'Ratio of effective to required damage. Marginal from 1.00, reliable from 1.30.',
    'fracturing.ctl.math': 'The four steps of the sum with the numbers put in and each intermediate result.',
    'fracturing.ctl.laser': 'The mining laser. Sets the damage and the number of module slots.',
    'fracturing.ctl.modules': 'Up to three modules, depending on the laser. They change damage and resistance.',
    'fracturing.ctl.gadget': 'A gadget changes the resistance of the rock.',
    'fracturing.ctl.mass': 'The assumed mass of the rock — it sets how much damage is needed.',
    'mining.ctl.station': 'The station whose yield is highlighted in the ranking.',
    'mining.ctl.locpin': 'The whole row opens this location; the pin on the right additionally pins it to the shortlist below.',
    'mining.ctl.shortlist': 'The pinned locations across every ore, as “Ore — Location”. Click opens the location, the × unpins it.',

    // -- Patch Archive --
    'archive.title': 'How does the patch archive work?',
    'archive.purpose':
      'Lists every alpha release as a timeline, grouped into eras, with search across names and topics.',
    'archive.step1': 'Type a search term or click an era in the bar.',
    'archive.step2': 'Filter down to major or point releases.',
    'archive.step3': 'Scroll or jump to a patch on the timeline.',
    'archive.step4': 'Click a card for the full patch page with all its topics.',
    'archive.ctl.era': 'Shows which era is currently in view.',
    'archive.ctl.search': 'Free-text search across version number, codename and topics.',
    'archive.ctl.chips': 'Narrows the timeline down to major or point releases.',
    'archive.ctl.count': 'Counts how many patches the current selection shows.',

    // -- Missions --
    'missions.title': 'How does the mission database work?',
    'missions.purpose':
      'Shows every mission offer with reward, reputation, contractor and location — grouped into missions.',
    'missions.step1': 'Type a search term or filter by type, contractor, faction, guild or location.',
    'missions.step2': 'Narrow down to missions with blueprints or by legality.',
    'missions.step3': 'Sort the results by name, reward or number of offers.',
    'missions.step4': 'Click a card for details, reward and reputation.',
    'missions.ctl.search': 'Free-text search across title, contractor, faction and location.',
    'missions.ctl.select': 'Narrows the list down to a value from this dropdown.',
    'missions.ctl.blueprint': 'Shows only missions that can drop blueprints.',
    'missions.ctl.legal': 'Narrows down to lawful or unlawful missions.',
    'missions.ctl.sort': 'Sets the sort order of the results.',

    // -- Armor Sets --
    'armorsets.title': 'How does the armor sets page work?',
    'armorsets.purpose':
      'Shows every armor set’s parts grouped by manufacturer, with key figures on sets and completeness.',
    'armorsets.step1': 'Jump to a manufacturer or scroll through the page.',
    'armorsets.step2': 'Each set shows its parts grouped by body slot.',
    'armorsets.step3': 'An underlined part name links to its item page.',
    'armorsets.step4': 'The figures at the top show total count, parts and complete sets.',
    'armorsets.ctl.keys': 'Counts sets, parts, complete sets and the data date.',
    'armorsets.ctl.jump': 'Jumps straight to a manufacturer’s sets.',

    // -- Wikelo's Emporium --
    'wikelo.title': "How does Wikelo's Emporium work?",
    'wikelo.purpose':
      'Shows every trade the Banu merchant offers: what to deliver and what it pays out.',
    'wikelo.step1': 'Filter by category — ships, weapons, armor or misc.',
    'wikelo.step2': 'Each card shows what is requested on the left, what it pays on the right.',
    'wikelo.step3': 'Click an underlined item to see where to get it.',
    'wikelo.step4': 'Further down are the three stations and the patch history.',
    'wikelo.ctl.filter': 'Narrows the trade cards down to a category.',
    'wikelo.ctl.grid': 'The grid of all trades in the current filter.',

    // -- Ships --
    'ships.title': 'How does the ship catalog work?',
    'ships.purpose':
      'Shows every ship and vehicle with stats, components and both prices — pledge and in-game.',
    'ships.step1': 'Type a ship or manufacturer name into the search field.',
    'ships.step2': 'Filter by manufacturer, career, role, size, signature, feature or component.',
    'ships.step3': 'Sort the results by name, price, cargo or crew.',
    'ships.step4': 'Click a card for the full data sheet.',
    'ships.ctl.search': 'Free-text search across ship and manufacturer names.',
    'ships.ctl.select': 'Narrows the fleet down to a value from this dropdown.',
    'ships.ctl.sort': 'Sets the sort order of the results.',

    // -- Precision Jump --
    'precisionjump.title': 'How does the Precision Jump calculator work?',
    'precisionjump.purpose':
      'Works out where to cut quantum travel between two anchors to land in the Aaron Halo band you want.',
    'precisionjump.step1': 'Pick a departure point.',
    'precisionjump.step2': 'Pick a destination QT marker.',
    'precisionjump.step3': 'Pick the Halo band you want to hit.',
    'precisionjump.step4': 'Read the displayed trigger value in game and cut the drive there.',
    'precisionjump.ctl.route': 'Sets the departure point and destination QT marker for the route.',
    'precisionjump.ctl.swap': 'Swaps departure point and destination.',
    'precisionjump.ctl.band': 'Picks the Aaron Halo band the route should hit.',
    'precisionjump.ctl.reset': 'Resets the route to its default values.',
    'precisionjump.ctl.table': 'Expands a table with further values.',

    // -- Refinery Tracker --
    'refinerytracker.title': 'How does the Refinery Tracker work?',
    'refinerytracker.purpose':
      'Tracks refinery work orders through to collection — unlike the Refinery Finder, it does not compare stations upfront, it follows orders already underway.',
    'refinerytracker.step1': 'Log a running order’s refinery, method and ores.',
    'refinerytracker.step2': 'Copy the processing time and cost from the in-game terminal.',
    'refinerytracker.step3': 'Watch the countdown and collect the order once it is ready.',
    'refinerytracker.step4': 'Close out collected orders in the history with the real sale proceeds.',
    'refinerytracker.ctl.stats': 'Shows key figures for active and completed orders.',
    'refinerytracker.ctl.active': 'The active orders with a countdown to completion.',
    'refinerytracker.ctl.station': 'Picks the refinery station for the order.',
    'refinerytracker.ctl.method': 'Picks the refining method for the order.',
    'refinerytracker.ctl.ores': 'Logs the order’s ores with raw and yield SCU.',
    'refinerytracker.ctl.duration': 'Sets the order’s processing time from the terminal.',
    'refinerytracker.ctl.preview': 'Previews yield, estimated value and completion time.',
    'refinerytracker.ctl.history': 'Completed orders with profit and a place to record the sale value.',
  },
} as const;

export type HelpKey = keyof (typeof HELP)['de'];

/**
 * useHelp(lang): strenger Zugriff OHNE Sprachrueckfall (DOC-04). Fehlt der
 * Schluessel in `lang` oder ist er leer, wirft h() — anders als t() aus
 * ui.ts, das in dieser Lage still auf Englisch zurueckfaellt.
 */
export function useHelp(lang: Locale) {
  return function h(key: HelpKey): string {
    const value = HELP[lang]?.[key];
    if (!value) {
      throw new Error(`useHelp: fehlender oder leerer Hilfe-Schluessel "${key}" fuer Sprache "${lang}"`);
    }
    return value;
  };
}

/**
 * assertHelpParity(): laeuft beim Modul-Laden (siehe Aufruf am Dateiende) und
 * damit bei jedem `astro build`. Bricht ab, wenn:
 *   - die Schluesselmengen von DE und EN auseinanderlaufen,
 *   - ein Wert leer oder nur Leerraum ist,
 *   - ein Wert in beiden Sprachen byte-gleich ist, ohne in SAME_IN_BOTH zu
 *     stehen (das waere sonst eine vergessene Uebersetzung, die stumm
 *     durchgeht).
 * Das ist die maschinelle Umsetzung von DOC-04: ein fehlender DE-Schluessel
 * SCHEITERT sichtbar, statt englisch zu rendern.
 */
export function assertHelpParity(): void {
  const deKeys = Object.keys(HELP.de) as HelpKey[];
  const enKeys = Object.keys(HELP.en) as HelpKey[];
  const deSet = new Set<string>(deKeys);
  const enSet = new Set<string>(enKeys);

  const missingInEn = deKeys.filter((k) => !enSet.has(k));
  const missingInDe = enKeys.filter((k) => !deSet.has(k));
  if (missingInEn.length || missingInDe.length) {
    throw new Error(
      `assertHelpParity: Schluesselmengen von DE und EN weichen ab. ` +
        `Fehlt in EN: ${missingInEn.join(', ') || '—'}; fehlt in DE: ${missingInDe.join(', ') || '—'}`
    );
  }

  for (const key of deKeys) {
    const de = HELP.de[key];
    const en = HELP.en[key];
    if (!de || !de.trim()) throw new Error(`assertHelpParity: leerer DE-Wert bei Schluessel "${key}"`);
    if (!en || !en.trim()) throw new Error(`assertHelpParity: leerer EN-Wert bei Schluessel "${key}"`);
    if (de === en && !SAME_IN_BOTH.has(key)) {
      throw new Error(
        `assertHelpParity: "${key}" ist in DE und EN byte-gleich, steht aber nicht in SAME_IN_BOTH — ` +
          `vermutlich eine vergessene Uebersetzung.`
      );
    }
  }
}

assertHelpParity();
