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

(offen)
