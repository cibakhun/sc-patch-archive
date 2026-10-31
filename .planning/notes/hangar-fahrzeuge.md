# Hangar-Fahrzeuge: Fahrzeugwerkstatt in der Westnische

Stand 2026-10-23. Die Westnische der Halle wird zur Werkstatt für
Bodenfahrzeuge, mit einem Tor in der Rückwand. Der PC liefert die
Requisiten dafür im Format des Gerätekatalogs (`public/hangar/props/katalog.json`,
eine GLB je Kategorie, Materialien samt Schichten); Einbau, Packen und
Sichtprüfung in der Halle macht die Cloud.

## Auftrag PC

- **F1 Kategorie `fahrzeug`:** RSI Ursa Rover, Tumbril Cyclone, Greycat ROC
  und Greycat PTV als stehende Requisiten, geschlossen, Räder am Boden,
  Standardlack. Ursprung unten mittig, Front −z. Je Fahrzeug höchstens
  25 000 Dreiecke, so wenige Materialien wie möglich (Ziel 4 oder weniger),
  kein Innenraum. Kommt eines nicht sauber heraus: ein anderes kleines
  Bodenfahrzeug (Mule, STV, Cyclone-Variante) und hier sagen.
- **F2 Kategorie `tor`:** ein geschlossenes Fahrzeugtor aus dem Spiel, etwa
  4 bis 7 m breit und 4 bis 6 m hoch, mit Rahmen, flache Rückseite zum
  Anstellen an eine Wand, höchstens 6 000 Dreiecke.
- **F3:** Reifen und Räder als Lagerteile und eine Hebebühne für Fahrzeuge,
  wenn es sie als Requisiten gibt; sonst hier festhalten, dass nicht.
- Bestehende Katalogeinträge bleiben unverändert. Branch `pc/hangar-fahrzeuge`
  von `origin/staging`, Push ohne PR.

## Befund PC

=== Katalog v3 + Werkstatt · 365 Requisiten in 24 Kategorien (vorher 355 in 21) · neu `fahrzeug` 4, `tor` 1, `reifen` 5 · Branch `pc/hangar-fahrzeuge` ===

Geändert sind `scripts/extract-hangar-katalog.mjs` (feste Auswahl der Werkstatt,
Fahrzeug- und Tor-Export) und `buildKatalog` in `scripts/build-hangar-assets.mjs`
(Materialien der Werkstatt, Bau-Reihenfolge). Neu sind
`public/hangar/props/fahrzeug.glb` (2 094 084 Bytes), `tor.glb` (166 220),
`reifen.glb` (730 860), 45 Karten unter `schichten/` und in `katalog.json` 50
Materialwerte und 16 Schichtdateien.

**Was gleich bleibt.** Die 21 bisherigen Kategorie-Dateien, `boden.glb` und alle
bisherigen Karten unter `schichten/` sind byte-gleich. In `katalog.json` sind
die 355 bisherigen Requisiten, Arbeitsplätze, Leitungen, Zonen, Boden,
Fundorte, Schiffe, alle 1 059 bisherigen Materialwerte und Schichtdateien
unverändert (Feld für Feld verglichen); dazu kommen die neuen Einträge und
`hinweise.werkstatt`. `dienst.glb` und `deko.glb` habe ich nur neu gepackt,
weil ihr Fingerabdruck auf `katalog.json` zeigt (Tor [14]); Bytezahl und
Schichtkarten sind gleich geblieben.

**Wie der Auszug auswählt.** Die Werkstatt ist eine feste Liste (Fahrzeuge,
Tor, Reifen), nicht aus dem Inventar gezogen. Im Inventar zählen die Stücke
wie vorher; sonst änderten sich Nachbarn und Zonen des Bestands (ein erster
Versuch hat das gezeigt: Nachbar einer Leiter, zwei Zonen). Läuft der Auszug
ein zweites Mal auf dem eigenen Katalog, wählt er nichts dazu, und der Bau
kommt byte-gleich heraus (geprüft, samt `dienst.glb` und `deko.glb`).

Maße: Breite × Höhe × Tiefe in Metern (x, y, z im GLB), Ursprung unten
mittig, Front −z. Bytes: der Knoten allein mit seinen Karten gepackt, wie in
der Kategorie-Datei.

### F1. `fahrzeug`

| Knoten | Fahrzeug | Maße | Dreiecke | Stufe | Materialien (eigene) | Bytes |
|---|---|---|---|---|---|---|
| `prop_fahrzeug_rsi_ursa_rover` | RSI Ursa Rover | 5,49 × 3,23 × 7,62 | 15 536 | LOD 3 | 16 (4) | 221 428 |
| `prop_fahrzeug_tmbl_cyclone` | Tumbril Cyclone | 3,76 × 2,31 × 5,67 | 24 213 | LOD 4, Reifen ausgedünnt | 9 (4) | 951 556 |
| `prop_fahrzeug_grin_roc` | Greycat ROC | 3,78 × 2,95 × 7,53 | 12 044 | LOD 3 | 11 (4) | 445 340 |
| `prop_fahrzeug_grin_ptv` | Greycat PTV | 2,15 × 1,82 × 3,22 | 15 862 | LOD 1 | 3 (3) | 235 792 |

`fahrzeug.glb` 2 094 084 Bytes. Alle vier kamen nach der Reparatur unten
sauber heraus; ein Ersatzfahrzeug war nicht nötig.

- **Quelle:** das ganze Fahrzeug über seine Entity samt Ausstattung (Räder,
  Sitze, Turm, Abbauarm) in Ruhelage: Türen, Rampe und Haube zu. Weg sind
  Relais, eingebaute Bauteile (Kühler, Kraftwerk, Lebenserhaltung),
  Schadensnetze, Armaturen; kein Innenraum. Gewählt ist je Fahrzeug die
  feinste Stufe unter 25 000 Dreiecken.
- **Räder am Boden:** Die Unterkante der Reifen ist bei allen vier die
  Unterkante des ganzen Fahrzeugs (`werkstatt.reifen.unterkante` = 0).
- **Front −z:** Spiel +Y, im Bild geprüft (Haube, Cockpit, Abbauarm vorn).
- **Standardlack:** die Palette der Entity (`palette` am Material): Ursa
  beige/dunkelbraun/orange, Cyclone khaki/grau/ocker, ROC weiß/blau/dunkel.
  Der PTV hat keine Palette, sein Weiß steckt in der eigenen Farbkarte.
  Lafette und Laser-Repeater des Ursa behalten ihre eigene Farbe (ihr
  Material hängt an einer anderen Palette).
- **Fehler im Export, behoben:** Steckt ein Item zweimal im Fahrzeug (Räder
  links und rechts), trägt beim zweiten Einbau mancher Knoten das Netz eines
  Geschwisters. Beim PTV hatte Rad 2 am Knoten `wheel` das Netz `damper`
  (Reifen fehlte, Nabe 20 cm zu tief), Rad 4 das Netz `bottom_a_arm`; der Ursa
  stand auf vier statt sechs Reifen. Der Auszug nimmt dann das Netz des
  gleichnamigen Knotens im gleichen Item (`werkstatt.netzRepariert`): Ursa 5
  (zwei Reifen, Lafette, Laufrohr, Knopf), PTV 2, ROC 1 (Laserspitze),
  Cyclone 0. Schon LOD 0 hat den Fehler, er liegt nicht an der Stufe.
- **Cyclone:** LOD 3 hat ohne die weggelassenen Teile 43 590 Dreiecke, davon
  24 006 Reifen; LOD 4 hat 29 484. Die Reifen (Stollenprofil) habe ich mit
  meshoptimizer von 15 360 auf 10 519 ausgedünnt, die Stollen bleiben. LOD 5
  (16 195) verliert die Stollen, darum nicht.
- **Ursa:** Der Turm ist ein Kugelturm vorn rechts an der Seite, nicht auf dem
  Dach. **ROC:** Der Abbauarm steht in Ruhelage schräg nach vorn links aus;
  er macht die Länge von 7,53 m.
- **Materialien:** Je Fahrzeug behalten höchstens drei Untermaterialien ihre
  eigene, nicht gekachelte Farb- oder Normalenkarte (die mit den meisten
  Dreiecken; gleiche Karte und gleiche Farbe teilen ein Material), dazu ein
  Glas. Das sind die „eigenen“ (`eigeneMaterialien`, je höchstens 4): sie
  brauchen auch im Deko-Pack einen eigenen Zeichenbefehl. Alle übrigen sind
  flach: gekachelte Schichtkarten oder einfarbig (Name endet auf `_flach`,
  Farbe = Mittelwert der Karte); `build-hangar-dienst.mjs` legt sie wie beim
  Wartungsplatz in ein Material. Insgesamt sind es 3 bis 16 Materialien; das
  Ziel 4 erreichen nur die eigenen. Der Ursa hat viele flache Untermaterialien
  (Laser-Repeater 5, Lafette 4); sie zusammenzulegen hieße die Farbe in die
  Vertexfarbe schreiben, die bei den Requisiten Abnutzung und Verschattung
  trägt.

### F2. `tor`

| Knoten | Tor | Maße | Dreiecke | Stufe | Materialien (eigene) | Bytes |
|---|---|---|---|---|---|---|
| `prop_tor_high_tech_garage_door_s` | kleines Garagentor der Hightech-Garagen | 5,26 × 4,06 × 0,65 | 3 036 | LOD 1 | 5 (3) | 159 356 |

- Zweiteiliges Garagentor, geschlossen, mit Rahmen: Sturz mit Kasten,
  Pfosten, Schwelle mit Führung. Die Geometrie gibt es nur als Entity mit
  Animation (.cga). Der Auszug nimmt sie aus dem Container eines Teileladens in
  Orison, in dem das Spiel sie aufstellt; die Ruhelage ist zu.
- **Maßstab:** Das Modell selbst ist 8,04 × 6,20 × 1,00 m, zu groß für 4 bis
  7 m Breite und 4 bis 6 m Höhe. Im Laden steht es im Maßstab 0,654; so ist
  es gebacken (`werkstatt.massstab`). Wer die Originalgröße will: Knoten mit
  1 / 0,654 skalieren.
- **Rückseite:** Beide Seiten sind gleich gebaut. Die Torblätter liegen 7 bis
  8 cm hinter der Rahmenebene; Sturz, Pfosten und Schwelle stehen bündig an
  der Wand. Rückseite = +z.
- **Verworfen**, damit niemand sucht: die Rolltore der Discount-Hangars (26 bis
  40 m, Schiffstore), das mittlere und große Hightech-Garagentor (12 m und
  mehr), das Außenposten-Garagentor (12 m), das geschlossene Raumtor
  `roomsm_door_10x01x04_a` (9 × 4,2 m), die Straßentore der Untergrund-Anlagen
  (9,2 × 4,1 m und 8,6 × 4,8 m, in LOD 1 noch 19 000 bis 21 000 Dreiecke), die
  6-m-Wandstücke mit Toröffnung (Rahmen ohne Blatt; das Blatt gibt es nur
  animiert), der Rollladen `roomlg_wall_atrium_shutter_straight_04x04x08_a`
  (zu, aber ohne Rahmen, 3,65 × 3,84 m) und der 6-m-Rollladen
  `roomsm_shutter_06x03x04_a` (steht in keinem Container, also nicht
  exportierbar).

### F3. `reifen` und Hebebühne

| Knoten | Teil | Maße | Dreiecke | Materialien (eigene) | Bytes |
|---|---|---|---|---|---|
| `prop_reifen_ptv_tire` | Ersatzreifen des PTV | 0,64 × 0,32 × 0,65 | 1 146 | 1 (1) | 141 872 |
| `prop_reifen_racetrack_tyre_1_a` | großer Reifen, 1,88 m | 0,60 × 1,88 × 1,88 | 2 448 | 4 (3) | 519 236 |
| `prop_reifen_landing_wheel_1_a` | Fahrwerksrad (Bergungsteil) | 0,47 × 0,45 × 0,47 | 2 268 | 1 (0) | 13 460 |
| `prop_reifen_landing_wheel_2_a` | Fahrwerksrad (Bergungsteil) | 0,34 × 0,34 × 0,34 | 4 348 | 1 (0) | 23 728 |
| `prop_reifen_landing_wheel_3_a` | Fahrwerksrad (Bergungsteil) | 0,47 × 0,18 × 0,47 | 3 296 | 1 (0) | 18 068 |

- Der große Reifen steht siebenmal in Stations-Hangars (Aufstellung, Stapel
  und Zone aus dem Spiel stehen am Eintrag), dazu als Haufen in einem
  Ausstellungsraum, dort gekippt in alle Richtungen. Seine Lauffläche hängt am
  Palettenkanal C, und das Spiel gibt diesem Stück keine Palette: Im GLB ist er
  weiß (Schichtfarbe). Ob er im Spiel dunkel erscheint, gibt der Datensatz
  nicht her; wer ihn dunkel will, tönt `materials[…].layers[0]` mit
  `paletteTint` 3.
- Der PTV-Reifen und die Fahrwerksräder stehen ohne Aufstellungsdaten
  (Quelle Archiv). Den PTV-Reifen stellt das Spiel zwar in Verteilzentren und
  Stations-Hangars auf, das Inventar führt ihn aber nicht als Requisit; ihn
  aufzunehmen hätte Nachbarn und Zonen des Bestands verschoben.
- Nach Sichtprüfung nicht darunter: `racetrack_tyre_seat_a` (der Reifenstapel
  als Sitz kommt als einzelner stehender Reifen heraus).
- **Eine Hebebühne für Fahrzeuge gibt es im Spiel nicht.** Gesucht in allen
  Geometrien und Entity-Klassen (lift, jack, hoist, ramp, car lift u. ä.). Es
  gibt nur die Scherenhubbühne für Personen (`prop_maschine_lift_scissor_1_a`)
  und die kleine Hubplattform (`prop_maschine_col_lift_platform_small_a`),
  beide schon im Katalog, dazu Frachtaufzüge und Wagenheber-Kisten.

### Prüfung

`npm run build && npm run gate`: 28 von 28 grün; mit `STAGING=1` ebenfalls
28 von 28 grün. Sichtprüfung als Render im lokalen Chrome (Fahrzeuge von vorn
und hinten, Tor von vorn, hinten und seitlich, Reifen einzeln); die Bilder
liegen nur auf dem PC.
