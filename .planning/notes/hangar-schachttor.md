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

## Flache Fahrzeuge (18.10. nachts)

Das Tor ging zu, sobald die Oberkante des Schiffs 0,4 m unter ihm war (`gateClearY`). Das Gerät am Wartungsplatz fährt aber mit, und bei rund 20 Fahrzeugen ist es höher als sie: Werkzeugschrank 2,31 m, Generator 2,19 m; Nox 1,33 m, Pulse 1,5 m, X1 1,55 m, ATLS 1,6 m, Dragonfly 2 m, PTV 2,2 m. Gemessen (Testbrowser, `torzeit3.mjs`, Nox → Gladius, hoch): Das Tor begann zu schließen, als die Oberkante des Schranks 0,57 m über der Unterkante des Tors stand.

Jetzt hält `layDienst` die Oberkante des höchsten gestellten Geräts fest (`info.dienstTop`, in der Konsole „höchstes Gerät“), und `gateClearY` wartet auf das Höhere von Schiff und Gerät. Das gilt beim Absenken (Schließen) und beim Auffahren (Öffnen, `liftUp`). Nachgemessen: Tor beginnt bei Feld −5,28 m, Gerät 0,40 m unter dem Tor; das Feld ist trotzdem 0,27 s vor dem Halt gedeckt.

Ohne Wartungsplatz (niedrig, kleine Bildschirme) bleibt alles, wie es war.

## Alle Seiten zugleich (19.10.)

Krisz, 00:05: „wenn der platform runterfährt und die schacht zu geht kommen erst die 2 kurzen seiten und erst dann die 2 langen. alle sollen gleichzeitig starten aber die gesamt länge von der animation hat gepasst“.

**Ursache.** Gemessen auf den Bahnen, die der Viewer fährt (`parts[].keys` in `medtop-tor.json`, 31 Stützstellen, linear dazwischen; die Tabelle unter „Befund PC“ nennt dagegen die Schlüssel des Spiels): Alle Teile verlassen ihre Lage schon zwischen 0 und 0,417 s. Die Flügel kommen aber aus 28 m Abstand zur Mitte und liegen bis zu unserer Wand bei 16 m unter dem Boden; die Stirnplatten sind nach `GATE_STOW` gleich im Feld. Sichtbar (bewegt und im Feld) auf der Schließbahn, in Spielsekunden: Stirnplatten (`gate_16`/`gate_17`) 0,94 bis 4,16 s, innere Flügel (`gate_8`/`gate_13`) 4,17 bis 11,24 s, mittlere Flügel (`gate_7`/`gate_12`) ab 7,06 s. Die äußeren Flügel `gate_6`/`gate_11` erreichen unser Feld nie und fehlen. Bei 1,3 s je Bahn also 0,1 bis 0,43 s, dann 0,43 bis 1,17 s. Die Öffnungsbahn ist die Schließbahn rückwärts (Abweichung höchstens 0,001).

**Geändert** (`buildGate`): Teile mit derselben Fahrachse und -richtung bilden eine Seite (x+, x−, z+, z−). Je Seite und Bahn wird der Abschnitt gesucht, in dem Teile der Seite bis an den Boden (wie beim Decken) bewegt im Feld sind, solange das Feld zwischen zwei Stützstellen nicht ganz gedeckt ist; so zählen die Riegel nach dem Schließen nicht mit. Dieser Abschnitt wird stückweise linear auf den aller Seiten zusammen gelegt, der Rest der Bahn davor und danach gerafft. Ergebnis zu: alle Seiten 0,93 bis 11,25 s; auf: 1,23 bis 11,57 s. `cover` (11,25 s) wird wie bisher vorher an den Stützstellen des Spiels gemessen und bleibt, die Dauer der Fahrt hinab damit auch. Die Konsole meldet die Abschnitte unter „Seiten zugleich“.

**Nachgesehen** (Testbrowser in Zeitlupe, Blick von oben mit weitem Winkel): vorher sind die Stirnplatten nach 0,57 s zu und die Flügel kommen erst; nachher fahren bei 0,37 s und 0,54 s Flügel und Stirnplatten gemeinsam ein. Bild `hangar-schachttor/schachttor-vorher-nachher.png` im Projektordner.

**Offen** (Sichturteil, WINDOWS 93): Wirkt das gemeinsame, langsamere Einfahren der Stirnplatten stimmig? Das Öffnen bleibt gleichzeitig (Krisz, 19.10. 21:33: „Ja, so lassen“).

## Torrahmen und Torlack (19.10.)

Auslöser für die PC-Sitzung: **„Hangar-Torrahmen“**. Anlass: Krisz 2026-10-19 13:37 zum Schlitz (#131): „das problem mit der schaft zumachmechanismus war das es nicht belivable ist, es ploppt aus dem nicht rein und textur mässig undso passts auch nicht“, 13:38: „es soll so aussehen wie ein element was da fest verbaut ist und soll halt ein glaubhaftes mechanismus sein“.

**Befund Cloud** (Bildfolge aus der Standardansicht, Cutlass, Stand staging 2992e7e):
- Gezeichnet wird das Tor auf dem ganzen Weg, es springt nicht. Die Flügel liegen offen 12 m hinter unserer Wand, hinter der 3 m tiefen Nische; sie kommen erst bei rund 0,45 s aus dem dunklen Schlitz und queren das Feld in rund 0,7 s. In Ruhe ist vom Tor nichts zu sehen, kein Rahmen, keine Führung. Es kommt also unter einer weißen Bodenkante hervor, ohne dass man vorher sieht, wo es wohnt.
- Die Lacke des Tors heißen `paint_b_primary`/`_secondary`/`_tertiary`. Das sind die Palettenlacke des Spiels; der Schacht nutzt `paint_c_notint` (ohne Palette). Im Export tragen sie die Grundtöne ihrer Schichten (linear 0,007 bis 0,032, fast schwarz), die Farbkarte ist fast einfarbig (0,69 bis 0,78). Im Spiel färbt die Palette des Tor-Entitys sie ein. Die fehlt uns; `GATE_PAINT`/`GATE_TONE` hellen nur auf, daher das stumpfe Grau mit grauen Warnstreifen.
- Die Eckstücke `gate_2` bis `gate_5` sind große Blöcke aus `trim_metal_a`: 13 × 3,55 × 61,6 m bzw. 13 × 3,55 × 93,6 m, Oberkante 0,17 m unter dem Boden. Offen schieben sie sich 10 m in die Öffnung und lassen 34 × 66 m frei, so groß wie die Plattform. Vermutlich ist das im Spiel der sichtbare Rahmen um die Plattform in Ruhe, der beim Schließen unter den Boden zurückfährt, bevor die Flügel kommen. Das wäre genau das „fest verbaute Element“. Unser Feld ist 32 × 96 m, und unser Hallenboden schließt direkt an; die Blöcke sind darum weggelassen.

## Auftrag PC (Hangar-Torrahmen)

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. **Torlack.** Für die Materialien des Tors (`paint_b_primary_041`, `paint_b_secondary_042`, `paint_b_tertiary_043`, `paint_c_notint_044`, `trim_metal_a_030`, `metal_a_046`) je Schicht `PaletteTint` und eigene Tönung nennen. Die Palette des Tors finden: am Entity `LoadingPlatformLoadingGate` in `hangar_medtop_001` (`SGeometryResourceParams`, `TintPaletteTree` oder Palettenverweis wie bei den Schiffen in `datamine-ship-paints.mjs`), sonst am Objektcontainer oder als Vorgabe der Geometrie. Je Eintrag (primär, sekundär, tertiär, dazu Decal-Farben, falls vorhanden) Farbe, Specular, Glanz. Hängt die Palette am Ort des Hangars (mehrere Hangar-Paletten), alle mit Namen und Farben auflisten und sagen, welche zu welchem Ort gehört. Ablage: `medtop-tor.json` → `palette: { source, name, entries: { primary: { rgb, spec, gloss }, … }, layers: { <Material>: <PaletteTint> }, others?: [ … ] }`.
3. **Was in Ruhe um die Öffnung zu sehen ist.** Alle Entities und Netze in `hangar_medtop_001` auflisten, die im Band bis 4 m um den Rand der Toröffnung liegen (Schachtraum: |x| 24 bis 32 oder |z| 40 bis 48, y −4 bis +1): Name, Geometriepfad, Lage, Größe, Materialien, Dreiecke. Gemeint sind Bodenstücke an der Öffnung, Rand- und Rahmenleisten, Schienen, Lichtbänder, Warnmarkierungen und Decals. Dazu die Eckstücke `gate_2` bis `gate_5`: Sind sie sichtbare Geometrie oder Verdecker/Kollision (Materialflags, NoDraw, Proxy)? Was davon sieht ein Spieler bei offenem Tor und oben stehender Plattform? Die sichtbaren Teile exportieren wie den Schacht (Draco, WebP ≤ 1024 px, Schichtmaterialien, COLOR_0 behalten), zusammen höchstens 10 000 Dreiecke in der besten passenden LOD, je Teil ein Knoten im Schachtraum, nach `public/hangar/lift/medtop-rand.glb` und `medtop-rand.json` (`nodes`, `place`, `size`, `tris`, Materialien mit Schichten und Palette), im Manifest unter `lift.medtop.rand`.
4. **Fester Teil des Tors.** Den Knoten `…_non_merged001` (nur LOD0, 104 Dreiecke) als `gate_frame_0` in `medtop-tor.glb` aufnehmen und sagen, was er ist (Schiene, Rahmen, Antrieb). Ist er unsichtbar oder ohne Material, das sagen und weglassen.
5. **Zylinder.** Die Drehspur der vier Zylinder (`gate_9`, `gate_10`, `gate_14`, `gate_15`, 48-Bit-Quaternionen) dekodieren und in `parts[].keys` als Drehung mitgeben; geht es nicht, sagen, woran es scheitert.
6. **Sicht.** Den Hangar um den Schacht so rendern, wie das Spiel ihn baut (Boden, Rand, Tor mit Palette, Plattform): in Ruhe, Tor halb zu, Tor zu. In Worten beschreiben, was am Boden zu sehen ist: woher das Tor kommt (Schlitz, Rahmen, Schienen), welche Farben die Lacke mit der Palette haben, welche Warnmarkierungen es gibt. Keine Bilder und keine Roh-Exporte committen (das Repo ist öffentlich).
7. Selbstauskunft mit der üblichen Kopfzeile: Palette und Quelle, gelistete und exportierte Teile mit Dreiecken, Materialien und Bytes, Zylinderspuren. Vor dem Push `npm run build && npm run gate`; auf den Branch, ohne PR. Einbau, Merge nach staging und die Bildfolge vorher/nachher macht die Cloud.

## Befund PC (Hangar-Torrahmen)

PC-Lauf 2026-10-19. Geändert: `scripts/lib/ivo-caf.mjs` (Drehungen), `scripts/extract-hangar-tor.mjs` (LOD0, Paletten), `scripts/build-hangar-assets.mjs` (`buildTor`: Palette, `gate_frame_0`, Zylinderdrehung; neu `buildRand`).

**2. Torlack.**
- Die Palette hängt am Entity: `LoadingPlatformLoadingGate` trägt `<RenderProxy Wear="0.8" Palette="Libs/Foundry/Records/TintPalettes/Generic/gen_grey_darkgrey_darkblue">`.
- Werte aus dem DataCore (`TintPaletteTree`):

| Eintrag | Farbe (sRGB 0–255) | linear | Specular | Glanz |
|---|---|---|---|---|
| primary (A) | 170 / 170 / 170 | 0.41 / 0.41 / 0.41 | 59 | 255 |
| secondary (B) | 57 / 57 / 57 | 0.037 / 0.037 / 0.037 | 59 | 255 |
| tertiary (C) | 53 / 93 / 123 | 0.032 / 0.109 / 0.201 | 59 | 255 |

- Glas weiß, Decal-Farben R/G/B weiß, keine Decal-Textur.
- `PaletteTint` der Basisschicht:
  - `paint_b_primary_041` = 1 (A), `paint_b_secondary_042` = 2 (B), `paint_b_tertiary_043` = 3 (C).
  - `paint_c_notint_044`, `trim_metal_a_030`, `trim_greebles_a_031`, `metal_a_046`, `glow_a_019` = 0. Diese behalten ihre eigene Tönung, etwa `paint_c_notint` 0,051/0,056/0,063.
  - Die Wear-Schichten haben überall 0. Glanzfaktor der Lacke: 0,95, Wear 0,7.
- **Die drei Lacke sind also Hellgrau, Dunkelgrau und Dunkelblau, nicht fast schwarz.** Der Export trug die „default“-Palette des Containers, daher kamen die Werte 0,007 bis 0,032.
- **Ort:** Alle Hightech-Hangars (sml/med/lrg/xl, top und front) setzen am Tor dieselbe Palette; die Ortsvarianten `_newbab` und `_orison` setzen keine eigene.
- Andere Paletten zum Vergleich (`palette.others`):
  - Plattform der Hightech-Hangars: `gen_grey_darkblue_darkorange` (170 grau / 53,93,123 blau / 197,136,66 orange).
  - Tor und Plattform der Industrie-Hangars `util_a`: `gen_grey_darkgrey_yellow` (123 / 100 / 229,171,91 gelb).
  - Itembanks: `aeroview_hangars_default`.
- Ablage: `medtop-tor.json` → `palette`.

**3. In Ruhe um die Öffnung.** Im Band (|x| 24–32 oder |z| 40–48, y −4…+1) liegen neben Tor und Randleisten:

| Art | Spielmodell | Exemplare | Dreiecke (LOD2) | Materialien |
|---|---|---|---|---|
| landeleuchte | light_landing_1_a | 26 | 884 | decal glow_03, glass_tinted_05, metal_painted_07 |
| logo | aeroview_logo_b | 2 | 440 | painted_metal_primary_021, painted_metal_secondary_022 |
| warnlampe | light_hazard_2_b | 4 | 240 | decal_glow_lod_06, metal_painted_grey_dark_09 |
| stegecke | hangar_walkway_corner_4m_a | 4 | 1240 | grating_atlas_a_027, trim_greebles_a_031, paint_c_notint_044, metal_a_046 |
| bodenleuchte | light_floor_01_b | 2 | 168 | glow_03, metal_paint_grey_05 |
| steg | hangar_walkway_str_08m_a | 16 | 4004 | grating_atlas_a_027, trim_greebles_a_031, paint_c_notint_044, metal_a_046 |

- Dazu das Bodenhologramm `hangar_holo_m_a` über dem Feld, das die Sequenz ein- und ausblendet. Es ist kein fester Rand und bleibt weg.
- Decal-Objekte gibt es im Band keine. Die blauen Leitlinien liegen weiter außen und stehen in `medtop.json` → `deco`.
- **Der Stegring ist der „fest verbaute“ Rahmen:**
  - 16 gerade Gitterstege und 4 Eckstege, 4 m breit, Oberkante 0,25 m unter dem Boden. Sie umrahmen die Öffnung zwischen Schachtkante (±28 / ±44) und Hallenboden (±32 / ±48).
  - Darin liegen die Landeleuchten im Raster, die vier Eck-Warnlampen, zwei Bodenleuchten und zweimal der Schriftzug „AEROVIEW HANGARS“ an den Stirnseiten.
- **Tor-Eckstücke `gate_2`–`gate_5`:** sichtbare Geometrie, kein Verdecker.
  - Material `trim_metal_a_030` (HardSurface, Trimsheet), kein NoDraw, kein Proxy.
  - Je 61,6 × 3,55 × 13 m bzw. 13 × 3,55 × 93,6 m, Oberkante 0,22 m unter dem Boden, also knapp unter dem Steg.
  - In Ruhe (Tor offen, Plattform oben) liegen sie unter Steg und Plattformkante und sind nicht zu sehen. Sie kommen beim Schließen heraus und tragen die schwarz-weißen Chevron-Bänder auf den Diagonalen.
- Export: `public/hangar/lift/medtop-rand.glb` (0,63 MB, LOD2, **6976 Dreiecke**) und `medtop-rand.json` (22 KB). Je Exemplar ein Knoten `rand_<art>_<n>` im Schachtraum; `nodes` mit Lage, Größe, Box, Dreiecken und Materialien, `materials` mit Schichten und `paletteTint`.
  - LOD1 läge ohne Hologramm bei rund 10 000 Dreiecken, knapp über der Grenze.
  - Brushes tragen keine eigene Palette.
- Manifest: `lift.medtop.rand`.

**4. Fester Teil.** `gate_frame_0` ist jetzt in `medtop-tor.glb`: der Knoten `…_non_merged001` aus LOD0, 104 Dreiecke, Material `paint_c_notint_044` (der Schachtlack).
- Box 61,1 × 3,6 × 93,2 m, y −3,75 bis −0,13.
- Das ist das Gehäuse der Tortasche: ein Kasten um die Öffnung unter dem Stegring, in dem das offene Tor liegt. Schienen oder Antrieb sind es nicht; die bewegten Teile tragen ihre Führungen (Riegel, Zylinder, Zahnräder) selbst.
- In Ruhe ist das Gehäuse unter dem Steg nicht zu sehen.

**5. Zylinder.** Die 48-Bit-Quaternionen sind dekodiert (`ivo-caf.mjs`):
- Als 48-Bit-Zahl tragen Bit 46–47 den Index der größten Komponente (x, y, z, w). Die drei übrigen folgen zu je 15 Bit ab Bit 0, Wert (v − 16383) / 23170,475; die größte ergibt sich als √(1 − Σ).
- Alle vier Zylinder (`gate_9`, `gate_10`, `gate_14`, `gate_15`) kippen beim Öffnen von 0° auf −90° um X und beim Schließen zurück, 46 bzw. 47 Schlüssel.
- Die Drehung steht in einem eigenen Feld `parts[].keysRot.close`/`.open` mit Zeilen `[t, qx, qy, qz, qw]` (glTF, 31 Stützstellen wie `keys`), dazu `closed.quat` (0, 0, 0, 1) und `open.quat` (−0,7071, 0, 0, 0,7071). Die Drehung geht um den Knoten-Ursprung.
- Warum nicht in `keys`: `verify:hangar-hall` [15] verlangt dort genau `[t, x, y, z]`. In einem ersten Lauf hatte ich die Drehung an `keys` angehängt; das Tor riss, und die vier Zylinder fielen aus der Zählung „im Feld“. `keys` bleibt deshalb unverändert.
- `gate_frame_0` hat konstante `keys` (0, 0, 0) über beide Bahnen, damit die Prüfung jedes Teil gleich lesen kann.

**6. Sicht.** Ich habe am PC den Schacht wie im Spiel gerendert: Bausatz, Rand, Tor mit Palette und Plattform, in Ruhe, halb zu und zu. Die Bilder sind nicht committet.
- **In Ruhe:**
  - Um die Plattform liegt ein dunkler, 4 m breiter Gitterstegring mit hellen Stahlkanten.
  - Darin sitzen die Landeleuchten als kleine helle Punkte im Raster, an den vier Ecken die Warnlampen, an den Stirnseiten der Schriftzug „AEROVIEW HANGARS“.
  - Vom Tor ist nichts zu sehen, auch kein Schlitz.
- **Halb zu:**
  - Das Tor kommt aus der Fuge zwischen Plattformkante und Stegring: zuerst Eckstücke und Stirnplatten, dann die Flügel.
  - Die großen Flächen sind hellgrau (A), Fugen und Kanten dunkelgrau (B), einzelne Flächen dunkelblau (C).
  - Auf den diagonalen Eckstücken laufen schwarz-weiße Chevron-Warnstreifen.
- **Zu:** Eine hellgraue, gegliederte Fläche mit Mittelfuge, Riegeln und blauen Akzenten liegt bündig im Stegring.
- **Rahmen, Schienen, Antrieb:** Am Boden sind sie nicht zu sehen; der „Rahmen“ ist der Stegring.

**Einbau Cloud danach:** Torlacke aus der Palette statt `GATE_PAINT`/`GATE_TONE`. Den Rand aus Punkt 3 auf unser Feld gestellt und in Ruhe sichtbar; das Tor kommt beim Schließen aus ihm, so wie im Spiel, mit den Eckstücken, wenn sie sichtbar sind. Die Gesamtdauer der Bahn bleibt (Krisz 19.10. 00:05: „die gesamt länge von der animation hat gepasst“).

## Einbau Cloud (Torrahmen, 19.10. abends)

**Torlack.** `GATE_PAINT`/`GATE_TONE` sind weg. `buildGate` setzt die Farbe jedes Palettenlacks direkt aus `info.palette` (`GATE_PALETTE`: Schicht 1/2/3 → primary/secondary/tertiary, `linear`). Die übrigen Materialien behalten ihre eigene Tönung wie im Schacht. Zusammengelegt wird weiter nach Karten (`matKey`, jetzt auch für den Rand); ein farbiger Lack (Sättigung über 0,3, das Blau) bleibt für sich, weil `hgShade` nur einen Helligkeitswert trägt. Konsole: „Lack aus der Palette gen_grey_darkgrey_darkblue: paint_b_primary_041, paint_b_secondary_042, paint_b_tertiary_043, 4 drehen“.

**Zylinder.** `keysRot` wird mit `gateRot` (slerp) gelesen, auch durch den Zeitverzug der gleichzeitigen Seiten (#134) und beim Umkehren (`snapQ`). Gedreht wird um den Knotenursprung.

**Rand (`HALL_RAND`, `buildRand`).**
- Je Art wird ein Exemplar des Spiels genommen, in das Bezugssystem seiner Seite gelegt (a entlang ab der linken Innenecke, w nach außen ab der Schachtkante) und auf unsere vier Seiten gestellt. Die Längsseiten bekommen 4 Stege zu je 24 m, die Querseiten 32 m (Steg 8 m bei 0, Steg 16 m bei 24, dazwischen der Schriftzug bei 16). Dazu kommen die Ecke mit ihrer Landeleuchte an jedem Seitenanfang, Landeleuchten alle 12 m längs und bei 7/25 m quer, und die beiden Bodenleuchten auf ihrer Seite.
- Ergebnis: 42 Teile, 6104 Dreiecke, 10 Materialien, 4 m breit.
- Die Materialien sind die des Rand-GLB, wie die der Halle vorbereitet (Hallenlicht, `hgShade`, Hallenshader). Die Schachtmaterialien gleichen Namens nehmen nur die Schachtlampen und lagen in Ruhe schwarz. Geteilt werden nur ihre Karten (11 Karten).
- Die Warnlampen der Ecken stehen schon im Schacht (`light_1`).
- Der Ring kostet in Ruhe 10 Draw-Calls mehr.

**Hallenboden unter dem Rand.** `hgCut` im Hallenshader spart den Boden zwischen Feldkante (+5 mm) und Außenkante des Stegs (−1 cm) aus. Ausgespart wird alles unter 4,5 cm, und waagrechte Flächen bis 6 cm. Die Fasen der Bodenplatten reichen 3,9 cm hoch und lagen vorher als Strichlinien auf dem Steg. Was auf dem Boden steht, bleibt darüber stehen. Dieselbe Aussparung gilt in den statischen Schattenkarten (`statMat`), damit der Steg nicht im Schatten eines Bodens liegt, den man nicht mehr sieht; im Bild ändert das nur einzelne Pixel. Die alte Stirnkante `shaft.edge` entfällt mit dem Rand.

**Möbel und Werkstatt.**
- `clearRandFurniture`: Möbel am Boden, die in den Rand reichen, rücken senkrecht zur nächsten Feldkante hinaus, plus 0,3 m. Käme eines damit aus der Halle, bleibt es weg. Gerückt wurden `furniture_19_19` 4,4 m, `23_23` 4,7 m, `31_31` 4,4 m, `52_52` 3,8 m und `53_53` 3,9 m; weggelassen keins.
- Ein Rollwagen, der Teil der Hallengeometrie ist (x ≈ 17,4, z ≈ 19,4), bleibt auf dem Steg stehen. Seine unteren 4,5 cm sind ausgespart.
- `placeWorkshop(…, rim)` zählt Abstände ab der Außenkante des Rands, wie die Anordnung des Spiels, deren Feld (56 × 88) denselben Steg hat. Konsole: „4 m Rand frei“.

**Weiter weg:** `gate_2` bis `gate_5` (Eckstücke mit Chevron-Bändern) und `gate_frame_0` (Gehäuse). Offen lägen sie in unserem schmaleren Feld, also im Bild über der Plattform.

**Prüfung** (`verify:hangar-hall`):
- [15] verlangt für jeden `paint_b_*` eine Farbe aus der Palette, Klinke 3. Rot vorgeführt mit `palette.entries.tertiary` aus `dist/…/medtop-tor.json` entfernt: „[15] paint_b_tertiary_043 ist ein Palettenlack, /hangar/lift/medtop-tor.json traegt dafuer keine Farbe …“ und „[15] nur 2 Palettenlacke am Tor tragen die Farbe des Spiels, die Klinke verlangt 3“.
- [16] ist neu und liest `HALL_RAND` aus dem ausgelieferten Viewer gegen GLB und JSON in `dist/`. Geprüft wird:
  - jede Seite ist von 0 bis zur Länge mit Stegen gedeckt, ohne Lücke und ohne Überlappung, bündig mit dem Boden;
  - Ecken, Leuchten und Schriftzug liegen in ihrer Seite und im Rand;
  - gleichnamige Schachtmaterialien tragen dieselben Karten;
  - Klinke 42 Teile, Obergrenze 10 000 Dreiecke, 10 Materialien, 1 MB.
- [16] rot vorgeführt:
  - mit `rand_steg_7` bei 20: „[16] Querseite: rand_steg_7 ueberlappt den Steg davor um 4.00 m; beide flimmerten gegeneinander“ und „… die Stege enden bei 28.00 m, die Seite ist 32 m lang“;
  - mit `rand_landeleuchte_22` bei 33: „[16] Leuchte rand_landeleuchte_22 an a 33: liegt ausserhalb der Seite (0..32 m) oder des Rands (w 0..4 m)“.

**Bild:** `hangar/v48-torrahmen-vorher-nachher.png` im Projektordner. **Offen:** WINDOWS 94.

## Stirnplatten in der Nische (19.10. abends)

Krisz, 21:31, mit zwei Bildern vom Ende des Schachts: „siehstr du wie es einfach aus dem nichts erscheint?“

**Ursache.** Nachgestellt als Bildfolge eines Schiffswechsels (Testbrowser in Zeitlupe, Blick von der Feldmitte auf das ferne Ende, Cutlass, Stand staging 9e37ce2). Die Stirnplatten liegen offen 2 m hinter der Wandebene in der Nische (`GATE_STOW`). Ihre Vorderkante ist ein Fachwerk. Sobald die Plattform unter die Decke der Nische fährt, sieht man von oben in die Nische hinein. Gezeichnet wurde das Tor aber erst ab `gateStart` und nach dem Öffnen wieder nicht mehr (`G.group.visible`). Darum war die Nische zuerst leer, und mit dem ersten Bild des Schließens stand das Fachwerk darin. Nach dem Öffnen verschwand es ebenso mit einem Bild. Die Flügel betrifft das nicht: Sie liegen offen 12 m hinter unserer Wand, hinter der Rückwand der Nische und unter dem Hallenboden.

**Geändert** (Bildschleife): Das Tor ist sichtbar, solange das Feld unterwegs oder unten ist, das Tor fährt oder zu ist. Die Platten liegen damit von Anfang an dunkel in ihrer Nische bereit und fahren von dort aus. Nach dem Öffnen bleiben sie dort liegen, bis die Plattform oben den Schacht wieder deckt. In Ruhe bleibt das Tor aus wie bisher. `gateStart` und `gateFrame` schalten die Sichtbarkeit nicht mehr selbst. Unterwegs kostet das Tor bis zu 6 Zeichenbefehle mehr, auch solange es offen ist.

**Nachgesehen:** dieselbe Bildfolge vorher und nachher, je 4 Zeitpunkte. Bild `hangar-schachttor/stirnplatte-vorher-nachher.png` im Projektordner.

**Offen** (Sichturteil, WINDOWS 95): Kommt beim Wechsel noch etwas aus dem Nichts? Liest sich die dunkle Platte in der Nische als bereitliegendes Teil des Tors?
