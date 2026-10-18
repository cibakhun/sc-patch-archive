# Hangar: Schachttor aus dem Spiel (2026-10-18)

Auslöser für die PC-Sitzung: **„Hangar-Schachttor“**. Anlass: Krisz
2026-10-18 16:47: „wenn die platform runterfährt soll auch das loch oder
die schacht oben zugehen damit man das nicht sieht dass das schiff einfach
nur dahinploppt“. Heute fährt das Feld mit dem alten Schiff ab, unten
verschwindet es und das neue steht da, alles bei offenem Schacht.

Im Spiel gibt es dafür ein Tor: Der Bausatz `hangar_medtop_001` nennt
neben der Plattform die Entity
`objects/buildingsets/human/hightech/delta/int/hangar/elev/ht_hangar_ship_elev_door_med_a.cga`
mit den Animationen `door_close` (`ht_hangar_ship_elev_door_med_door_close.caf`)
und `door_open` (`ht_hangar_ship_elev_door_med_a_door_open.caf`), je 450
Bilder bei 30 Bildern/s, `DoorAnimationSpeed` 1,2. Die Sequenzen heißen
`sq_hngr_medtop_doorclose_paddown` und `sq_hngr_medtop_dooropen_padup`
(siehe `public/hangar/lift/medtop.json`, `motion`). Die Geometrie des
Tors fehlt im Export von `hangar-schacht.md`; `medtop.glb` hat nur
Wand, Rippe, Ecke, Leisten, Lampen.

Regel 10-07 gilt: Tor, Texturen und Bewegung kommen aus dem Spiel.
Licht, Ablauf und Tempo der Fahrt macht die Cloud.

## Stand Cloud

- Schacht im Viewer: Spielbausatz medtop (HALL_SHAFT), auf unser Feld
  32 × 96 m gereiht (Modellraum x 16…48 vor der Mittung, z −120…−24).
  Das medtop-Feld ist 56 × 88 m; das Tor wird auf unser Feld gestreckt
  oder aus seinen Flügeln neu gereiht, wie die Wände.
- Fahrt heute: ab 1,9 s, auf 2,8 s. Mit Tor, wie Krisz es will (16:57):
  „Während die Plattform mit dem alten Schiff runterfährt, schließt sich
  der Schacht oben, das Schiff wird verdeckt getauscht, dann geht der
  Schacht wieder auf und während dessen das neue Schiff fährt hoch.“ Die
  Bewegungen überlappen: Das Tor geht zu, solange die Plattform noch
  sinkt, und auf, während sie schon steigt.
- Grafikbudget: Krisz will die Seite neben Star Citizen offen haben
  (2026-10-15: die Hangarseite allein lastete seine Grafikkarte zu 75 %
  aus). Der Schacht bekam dafür rund 10 Zeichenbefehle und 60 000
  Dreiecke (`hangar-schacht.md`); das Tor höchstens die Hälfte davon,
  rund 6 Zeichenbefehle und 30 000 Dreiecke, nur während des Wechsels
  gezeichnet.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. In `hangar_medtop_001.socpak` die Tor-Entity
   (`ht_hangar_ship_elev_door_med_a.cga`) finden: Zahl der Exemplare,
   Lage und Drehung je Exemplar im Raum der Schachtlichter
   (`lights[].pos`: Schachtmitte auf Hallenboden = 0, x quer 56 m,
   z längs 88 m, y oben). Steht das Tor auf Bodenhöhe, unter der
   Bodenkante oder tiefer im Schacht?
3. Das Tor exportieren und packen wie den Schacht (Draco, WebP ≤ 1024 px,
   Schichtmaterialien wie in `<lift>.layers.json`, COLOR_0 behalten),
   zusammen ≤ 2 MB, nach `public/hangar/lift/medtop-tor.glb`:
   - jeder bewegte Teil (Flügel, Lamelle, Abdeckung) als eigener Knoten,
     benannt `gate_<n>`, in **geschlossener** Stellung, im Raum aus
     Punkt 2;
   - feste Teile des Tors (Rahmen, Schienen, Antrieb) als `gate_frame_<n>`;
   - nur die beste LOD, die unter 30 000 Dreiecken bleibt.
4. Die Bewegung aus beiden `.caf` lesen: je Knoten Lage und Drehung in
   geschlossener und offener Stellung, dazu die Kurve (Schlüsselbilder
   oder 31 Stützstellen über die Dauer). Geht die `.caf` nicht zu
   lesen, wenigstens die offene Stellung aus der Ruhelage der Entity
   und das im Bericht sagen. Wenn derselbe Leser die Plattform
   (Bone `anim_pad001` in `ht_hangar_ship_elev_med_door_close.caf`)
   schafft, deren Kurve auch; sonst weglassen.
5. Den Ablauf aus den beiden Sequenzen: wann das Tor relativ zur
   Plattform losgeht und fertig ist (Spuren, Ereignisse, Zeiten), wörtlich
   mit Quelle. Steht es nicht drin, „nicht in den Daten“.
6. Daneben `public/hangar/lift/medtop-tor.json`:
   `{ v: 1, source, place: [ { pos, rot } ], parts: [ { node, size,
   tris, closed: { pos, quat }, open: { pos, quat } } ], anim: { close:
   { s, keys: [ [t, …] ] }, open: { … }, pad?: { … } }, order: { …
   wörtlich mit Quelle } }`. Im Manifest `src/data/hangar-assets.json`
   unter `lift.medtop` ein Eintrag `gate: { url, json, bytes, v }`.
7. Selbstauskunft: gefundene Exemplare, exportierte Knoten mit Dreiecken,
   Materialien und Bytes, gelesene Schlüsselbilder je Knoten, die übliche
   Kopfzeile. Keine Bilder und keine Roh-Exporte committen (das Repo ist
   öffentlich); die Bilder rendert die Cloud.
8. Vor dem Push `npm run build && npm run gate`; auf den Branch, ohne PR.
   Einbau, Merge nach staging und die Bildfolge vorher/nachher macht die
   Cloud.

## Befund PC

PC-Lauf 2026-10-18. Neue Skripte:
- `scripts/extract-hangar-tor.mjs`;
- `scripts/lib/ivo-caf.mjs`, ein Leser für IVO-Animationen;
- dazu `buildTor()` in `scripts/build-hangar-assets.mjs`.

**2. Exemplare.** In `hangar_medtop_001` gibt es **ein** Tor: die Entity `LoadingPlatformLoadingGate` mit `ht_hangar_ship_elev_door_med_a.cga`.
- Container-Lage (0, 0, −50). Im Schachtraum ist das **(0, 0, 0)**, ohne Drehung.
- Das Tor steht **auf Bodenhöhe**: Die Flügel liegen mit ihrer Oberkante in der Bodenebene, die vier Eckstücke 2 m darunter.
- Im Spielmodell gibt es keinen festen Rahmen in der gewählten Stufe. Der feste Knoten `…_non_merged001` hat nur in LOD0 Dreiecke (104). Deshalb gibt es kein `gate_frame_*`.

**3. Export.** `public/hangar/lift/medtop-tor.glb` hat 0,60 MB, die JSON 34 KB.
- **LOD2** mit 16 108 Dreiecken. Zum Vergleich: LOD0 95 684, LOD1 51 672, LOD3 7 392.
- 8 Materialien mit den Schichten aus `medtop.layers.json`; COLOR_0 bleibt als VEC4.
- Die .cga ist ein Knotenbaum: 21 Knochen mit je einem Netz-Knoten.
- Die Teilnetze der `.cgam` tragen den Netz-Knoten (obere 16 Bit des ersten Worts). Im socpak-Export ist jedes Primitiv genau ein Teilnetz, in derselben Reihenfolge.
- So ist jedes Primitiv seinem Knochen zugeordnet, **20 Knoten `gate_<n>`**.
- Geometrie in geschlossener Stellung, denn das ist die Ruhelage des Modells; `door_open` beginnt dort.
- Knoten-Ursprung ist die Lage des Knochens.

**4. Bewegung** aus beiden .caf (IVO, Format in `ivo-caf.mjs`):
- Positionen als Float-Vektoren (`c0`) oder quantisiert (`c2`: Skalierung, Versatz, u16 je Schlüssel). Schlüsselzeiten als u16 oder Bitfeld über die 450 Bilder.
- Knochen über CRC32 des Namens, 20 von 22 erkannt; die zwei übrigen sind Wurzelknoten ohne Bewegung.
- Gelesen sind 33 bis 135 Schlüssel je Knoten. `parts[].keys` hat je 31 Stützstellen `[t s, x, y, z]`, linear zwischen den Spielschlüsseln; t gilt bei Geschwindigkeit 1,2.
- **Alle Tor-Teile verschieben sich nur.** Die vier Hydraulikzylinder (`anim_door_*_cyl_*`) drehen zusätzlich. Ihre Drehspur ist ein 48-Bit-Quaternion, das ich nicht dekodiert habe; `quat` bleibt dort (0, 0, 0, 1).
- **Plattform:** Der Knochen `anim_pad001` in `ht_hangar_ship_elev_med_door_close.caf` fährt in 294 Schlüsseln sanft von 0 auf −36 m, `door_open` zurück. Das steht in `anim.pad`: 2,1 s → −2,7 m, 4,2 s → −9,3 m, 6,25 s → −18 m, 12,5 s → −36 m.

| Knoten | Knochen | Dreiecke | zu (x / y / z) | auf | Bewegung beim Schließen | beim Öffnen |
|---|---|---|---|---|---|---|
| `gate_0` | anim_cog_l001 | 60 | 0 / 0 / 0 | 28,625 / 0 / 0 | 0,833–10,833 s | 2,083–12,083 s |
| `gate_1` | anim_cog_r001 | 32 | 0 / 0 / 0 | -28,625 / 0 / 0 | 0,833–10,833 s | 2,083–12,083 s |
| `gate_2` | anim_door_corner_013 | 32 | 28,125 / -2 / -43,125 | 28,125 / -2 / -33,125 | 0,417–2,917 s | 10–12,5 s |
| `gate_3` | anim_door_corner_014 | 32 | 27,125 / -2 / -44,125 | 17,125 / -2 / -44,125 | 0,417–2,917 s | 10–12,5 s |
| `gate_4` | anim_door_corner_015 | 32 | -28,125 / -2 / 43,125 | -28,125 / -2 / 33,125 | 0,417–2,917 s | 10–12,5 s |
| `gate_5` | anim_door_corner_016 | 32 | -27,125 / -2 / 44,125 | -17,125 / -2 / 44,125 | 0,417–2,917 s | 10–12,5 s |
| `gate_6` | anim_door_l_019 | 1630 | 16 / 0 / 0 | 28,125 / 0 / 0 | 0,417–4,167 s | 8,75–12,5 s |
| `gate_7` | anim_door_l_020 | 717 | 8 / 0 / 0 | 28,625 / 0 / 0 | 0,833–10,833 s | 2,083–12,083 s |
| `gate_8` | anim_door_l_021 | 3378 | 0 / 0 / 0 | 28,125 / 0 / 0 | 0,833–10,833 s | 2,083–12,083 s |
| `gate_9` | anim_door_l_cyl_007 | 138 | 0 / -1,596 / -15,5 | 28,125 / -1,596 / -15,5 | 0,833–9,583 s | 3,333–12,083 s | Drehung nicht dekodiert
| `gate_10` | anim_door_l_cyl_008 | 138 | 0 / -1,596 / 15,5 | 28,125 / -1,596 / 15,5 | 0,833–9,583 s | 3,333–12,083 s | Drehung nicht dekodiert
| `gate_11` | anim_door_r_02 | 1630 | -16 / 0 / 0 | -28,125 / 0 / 0 | 0,417–4,167 s | 8,75–12,5 s |
| `gate_12` | anim_door_r_023 | 552 | -8 / 0 / 0 | -28,625 / 0 / 0 | 0,833–10,833 s | 2,083–12,083 s |
| `gate_13` | anim_door_r_024 | 3233 | 0 / 0 / 0 | -28,125 / 0 / 0 | 0,833–10,833 s | 2,083–12,083 s |
| `gate_14` | anim_door_r_cyl_007 | 196 | 0 / -1,596 / -15,5 | -28,25 / -1,596 / -15,5 | 0,833–9,583 s | 3,333–12,083 s | Drehung nicht dekodiert
| `gate_15` | anim_door_r_cyl_008 | 196 | 0 / -1,596 / 15,5 | -28,25 / -1,596 / 15,5 | 0,833–9,583 s | 3,333–12,083 s | Drehung nicht dekodiert
| `gate_16` | anim_door_s_003 | 1736 | 0 / 0 / 32 | 0 / 0 / 44,125 | 0,417–4,167 s | 8,75–12,5 s |
| `gate_17` | anim_door_s_004 | 1736 | 0 / 0 / -32 | 0 / 0 / -44,125 | 0,417–4,167 s | 8,75–12,5 s |
| `gate_18` | anim_latch_l_002 | 304 | 1,235 / -0,318 / -24,791 | 30,36 / -0,318 / -24,791 | 0,833–12,083 s | 0,833–12,083 s |
| `gate_19` | anim_latch_r_002 | 304 | -1,234 / -0,318 / -24,791 | -30,359 / -0,318 / -24,791 | 0,833–12,083 s | 0,833–12,083 s |

**Was sich bewegt:**
- Je Seite drei Flügel. Geschlossen liegen sie bei x = 0, ±8 und ±16 und treffen sich in der Mitte; offen schieben sie sich teleskopartig auf x ≈ ±28,1 bis ±28,6, unter die Bodenkante.
- Die Stirnplatten fahren von z ±32 auf ±44,1.
- Die vier Eckstücke fahren 10 m nach außen.
- Riegel, Zahnräder und Zylinder bewegen sich mit.

**5. Ablauf.**
- Die Sequenzen `sq_hngr_medtop_doorclose_paddown` (31,67 s) und `sq_hngr_medtop_dooropen_padup` (33 s) steuern nur Licht, Hologramm und Ton. **Wann Tor und Plattform losgehen, steht nicht in ihnen.**
- Tor und Plattform tragen aber gleich benannte Animationen gleicher Länge, je 450 Bilder bei 30 Bildern/s, `DoorAnimationSpeed` 1,2, also 12,5 s:
  - `door_close`: Das Tor schließt, die Plattform fährt hinab.
  - `door_open`: Das Tor öffnet, die Plattform fährt hinauf.
- Abgeleitet: **Beide laufen gleichzeitig.**
  - **Schließen:** Ecken, Stirnplatten und Außenflügel laufen von 0,4 bis 4,2 s, die inneren Flügel von 0,8 bis 10,8 s. Die Plattform ist dann bei etwa −34 m, unten ist sie bei 12,5 s.
  - **Öffnen:** spiegelbildlich. Die inneren Flügel laufen von 2,1 bis 12,1 s, die äußeren zuletzt von 8,75 bis 12,5 s, während die Plattform steigt.
- Das ist genau der Ablauf, den Krisz will: Das Tor schließt über der sinkenden Plattform und öffnet über der steigenden.
- Ereignisse (`.animevents`, Zeit 0 bis 1) lösen nur Ton aus:
  - Tor: `Play_MCLF_HT_Hangar_Ship_Elev_Door_M_Close`/`_Open` und Alarm bei 0, Alarm aus bei 0,999.
  - Plattform: Fahrton bei 0, aus bei 0,932.

**6. Datei und Manifest:**
- `public/hangar/lift/medtop-tor.json`, `v: 1`. Sie enthält `source`, `place`, `parts[]` mit `closed`/`open`/`keys` sowie `anim.close`/`open`/`pad` und `order` (wörtlich mit Quelle).
- Manifest: `lift.medtop.gate: { url, json, bytes, v }`.

**Nebenbei behoben:** `build-hangar-assets.mjs` hätte beim Schreiben des Manifests den Schlüssel `weapons` gelöscht: Seine Quellen (`.cache/hangar-src/weapons/`) liegen nicht auf diesem Rechner, und ohne Quellordner verwarf der Build die Einträge. Jetzt übernimmt er dann die bisherigen Einträge, und Schlüssel, die er nicht kennt, bleiben stehen.

**Sicht:** Ich habe das Tor über dem Schacht gerendert, geschlossen, halb und offen. Geschlossen deckt es die Öffnung bündig mit dem Boden; offen ist nichts mehr zu sehen. Die Bilder sind nicht committet.

## Einbau Cloud

Cloud 2026-10-18, `buildGate()` in `assets/hangar-viewer.js`, Prüfung `verify:hangar-hall` [15].

**Auf unser Feld:**
- Quer bleibt das Spielmaß. Die zwei inneren Flügel je Seite (`gate_7`/`gate_8`, `gate_12`/`gate_13`) decken genau ±16,2 m, so breit wie unser Feld (±16 m). Sie fahren im Spiel erst ab x 16,5 m in die Mitte, vorher liegen sie unter unserem Hallenboden.
- Längs ist das Tor um 96/88 gestreckt (`shaft.inner` aus `medtop.json`).
- Ein Teil zählt, wenn es irgendwann mehr als `HALL_GATE.reach` (0,25 m) ins Feld reicht und offen ganz draußen liegt. Das sind 14 Teile.
- Entfallen sind:
  - die äußeren Flügel `gate_6`/`gate_11` (nur 0,1 m im Feld);
  - die Eckstücke `gate_3`/`gate_5` (nie im Feld);
  - die Eckstücke `gate_2`/`gate_4`: Sie schieben sich beim Öffnen 10 m in die Öffnung und stünden der Plattform im Weg.
- 12 720 Dreiecke.
- 5 Zeichenbefehle: je Material ein BatchedMesh. Die vier Lacke teilen eine Karte und sind eins, ihre Helligkeit geht in `hgShade`.
- Lacke heller als im Export (seit 18.10. abends): Die Lacke des Spiels sind fast schwarz (linear 0,007 bis 0,06). Geschlossen las sich das Tor neben dem weißen Hallenboden als schwarzes Loch (Krisz, Bild 20:28). `GATE_PAINT` (5) hebt die dunklen, nicht leuchtenden Materialien an; `GATE_TONE` (0,5) rückt die vier Lacke zusammen (Abstand zum hellsten hoch 0,5), damit der rechte innere Flügel (`gate_13`, fast ganz der dunkelste Lack) nicht schwarz bleibt. Geometrie, Karten und Muster bleiben die des Spiels.
- Vier Materialien tragen dieselben Bilder wie die gleichnamigen des Schachts. Der Viewer nimmt deren Texturen, das spart die zweite Kopie im Grafikspeicher.

**Ablauf** (Krisz 16:57):
1. Das Tor schließt, sobald die Oberkante des alten Schiffs 0,4 m unter dem Tor ist (`HALL_GATE.clear`, Unterkante −2,56 m).
2. Es deckt das Feld `HALL_GATE.lead` (200 ms) vor dem Halt der Plattform ganz. Dafür dauert die Fahrt hinab, wo nötig, länger als 1,9 s (`liftDownMs`). Bis 18.10. abends war das Tor erst 0,1 bis 0,3 s nach dem Halt zu, unten sah man das Feld mit Schiff und Gerät im offenen Schacht (Krisz, Bild 20:28).
3. Getauscht wird erst unter dem geschlossenen Tor.
4. Beim Hochfahren öffnet es sofort. Die Fahrt beginnt später, falls die Oberkante des neuen Schiffs sonst vor dem offenen Tor ankäme.

Jede Bahn dauert 1,3 s statt 12,5 s (`HALL_GATE.ms`, bis 18.10. abends 1,6 s). Ganz gedeckt ist das Feld ab 11,25 s der 12,5-s-Schließbahn des Spiels, hier also nach etwa 1,17 s (`G.cover`, in Spielzeit: früheste Zeit, zu der ein Raster aus 0,25-m-Zellen ganz unter Teilen liegt, die bis an den Boden reichen); danach rasten nur noch die Riegel `gate_18`/`gate_19` ein. Kehrt das Tor unterwegs um, überblendet es von der aktuellen Lage auf die nächstliegende Stelle der neuen Bahn.

Die Plattform fährt mit Tor auf der Kurve `anim.pad` des Spiels.

Ist das Tor ganz zu, werden Schacht, Feld und Schiff darunter nicht gezeichnet.

**Gemessen** (Testbrowser, `torzeit.mjs`), Stand PR #128 (1,6 s je Bahn, Fahrt hinab immer 1,9 s):

| Wechsel | Tor beginnt zu schließen, nach Fahrtbeginn | Tor offen vor der Oberkante des neuen Schiffs |
|---|---|---|
| Carrack → Gladius | 0,64 s | 0,42 s |
| Cutlass → Carrack | 0,73 s | 0,26 s |
| Gladius → Cutlass | – | 0,13 s |

Der Tausch war in allen drei Fällen verdeckt, das Feld aber erst nach dem Halt gedeckt. Bis zum Tausch dauerte es 0,3 bis 0,4 s länger.

Stand 18.10. abends (1,3 s je Bahn, Fahrt hinab nach `liftDownMs`):

| Wechsel | Fahrt hinab | Tor beginnt zu schließen | Feld gedeckt vor dem Halt | Tor offen vor der Oberkante des neuen Schiffs |
|---|---|---|---|---|
| Cutlass → Carrack | 2,22 s | 0,85 s | 0,20 s | 0,56 s |
| Carrack → Gladius | 2,06 s | 0,69 s | 0,20 s | 0,72 s |

Tausch in beiden Fällen verdeckt. Bild: `hangar/v45-schachttor-hell-vorher-nachher.png` im Projektordner.

Sichturteil: WINDOWS 90 (89 erledigt durch Krisz' Bilder vom 18.10. 20:28).

**Offen für den nächsten PC-Lauf:** Die vier Zylinder (`gate_9`, `gate_10`, `gate_14`, `gate_15`) haben im Spiel eine Drehspur (48-Bit-Quaternionen in der .caf), die der Auszug nicht dekodiert; sie fahren hier nur mit. Sie liegen 1,6 m unter den Flügeln und fahren mit ihnen, von der Kamera über dem Boden also nicht zu sehen. Mitnehmen, wenn der PC ohnehin an das Tor geht.

## Torschlitz (18.10. abends)

Krisz, 21:46, mit zwei Bildern vom ausgelieferten Stand: „das was den schaft zu macht kommt einfach so aus der wand heraus, nicht belivable at all“. Auf den Bildern schiebt sich die Stirnplatte am Ende des Schachts unter der Bodenkante heraus, aus einer hellen, geschlossenen Wand.

**Ursache.** Die Randleiste des Spiels (`rim`, `rim_8`, `rim_corner`) ist unter dem Hallenboden eine 3 m tiefe Nische: Decke 0,25 m unter dem Boden, Sohle 3,75 m, vorn je eine Lippe. In ihr liegt das offene Tor. Am 16.10. (Krisz: „aus papier“) wurde die Nische auf 0,5 m verflacht und die Bodenplatte bekam eine 1 m hohe Stirn. Damit fuhr das Tor aus der Stirn und aus einer hell beleuchteten Rückwand 0,5 m dahinter. Die Stirnplatten `gate_16`/`gate_17` lagen offen dazu genau in der Mündung (0,14 m hinter unserer Wand), ihre Front las sich als Stück Wand.

**Im Spiel** decken die Rahmenstücke `gate_2` bis `gate_5` diese Mündung. Sie fahren beim Öffnen 10 m in die Öffnung und verengen den 56 × 88 m großen Spielschacht auf etwa 34 × 66 m. In unser 32 × 96 m großes Feld passen sie nicht, sie bleiben weg.

**Geändert** (`assets/hangar-viewer.js`):

- `SHAFT_RIM_DEPTH` 3: Die Nische ist wieder so tief wie im Spiel.
- `SHAFT_SLOT_LIP` 0,25: Die Stirn der Bodenplatte (`shaftEdge`) reicht nur bis an die Decke der Nische (0,27 m), darunter ist der Schlitz.
- `SHAFT_POCKET` [0,1, 1,8, 3,3, 0,2]: Hinter der Wandebene wird es unter dem Boden dunkel, von 0,1 m bis 1,8 m auf 20 % Restlicht (`hgPocketK` im Hallenshader, Uniform `hgPocket`). Hinter der Rückwand der Nische (ab 3,3 m) wirkt es nicht mehr. Das gilt für alle Hallenmaterialien, auch für das Tor: Es kommt aus dem Dunkel. Ganz schwarz las sich die Nische im Testbild als Loch.
- `GATE_STOW`: Offen liegt jedes Teil mit Bahn mindestens 2 m hinter der Wandebene. Betroffen sind nur die Stirnplatten (`gate_16`, `gate_17`, je +1,97 m). Die Flügel liegen offen ohnehin 12 m hinter unserer Wand. Ihre Bahn wird vom geschlossenen Stand aus gestreckt; Zeiten und geschlossene Lage bleiben, wie sie sind.

Dreiecke, Zeichenaufrufe und Texturen bleiben unverändert (eine Rechnung mehr je Bildpunkt in den Hallenmaterialien).

**Nachgemessen** (Testbrowser, `torzeit2.mjs`, 1,3 s je Bahn): Cutlass → Carrack: Tor beginnt 0,85 s nach Fahrtbeginn, Feld 0,20 s vor dem Halt gedeckt, Tausch verdeckt, Tor offen 0,56 s vor der Oberkante des neuen Schiffs. Carrack → Gladius: 0,69 s, 0,20 s, verdeckt, 0,72 s. Gleich wie vor dem Umbau. Der erste Wechsel nach dem Laden ist im Testbrowser nicht messbar (Bilder von mehreren Sekunden).

**Offen** (Sichturteil, WINDOWS 91): Liest sich der Schlitz als Gehäuse? Wirkt die 0,27 m dünne Bodenkante wieder „wie aus Papier“? Geschlossen liegt das Tor 0,14 m unter dem Boden (Maß des Spiels). Stört diese Stufe?
