# Phase 16: Das Schiff ist die Navigation — Kontext

**Erhoben:** 2026-08-18
**Status:** Bereit zur Planung
**Herkunft:** Betreiber-Befund zu Attrappe 012 („kreativitätstufe 0"), danach
drei Konzepte vorgelegt (`.planning/sketches/013-konzepte/`), gewählt: **B —
„Konsole"**. Vier Entscheidungen im selben Gespräch getroffen.

---

## Phasengrenze

**In dieser Phase:** Der Aufbau der Schiffs-Detailseite
(`src/components/ShipDetail.astro`, ein Körper für DE und EN, 227 Seiten je
Sprache) wird zur Konsole: Systemwahl → Markierung am gerenderten Mesh →
Auslesung. Die vier Kapitel aus Phase 14 entfallen als Seitenaufbau.

**Nicht in dieser Phase:**

- **Keine Datenänderung.** Kein Feld neu erhoben, keine Zahl neu berechnet,
  keine Quelle angebunden. Alles Nötige liegt vor.
- **Kein neues Datamine.** `holo-meshes.json` und `ship-hardpoints.json` sind
  vollständig und bleiben unverändert.
- **Die Schiffsübersicht `/schiffe`** ist nicht Gegenstand.
- **Andere Seitentypen** (Items, Crafting, Missionen) sind nicht Gegenstand —
  die Reichweite bleibt bei der Schiffsseite (Betreiber, 18.08.2026).

---

## Umsetzungsentscheidungen

### D-01 — Die Konsole ersetzt die Kapitel (Betreiber, 18.08.2026)

Die vier Kapitel entfallen als Aufbau. Die Konsole IST die Seite.

⚠ **Das ist eine ausdrückliche Lockerung der Sperre aus Phase 14**
(`14-CONTEXT.md` D-01: „Reiter, Akkordeons und jede Form von ‚hinter einem
Klick' sind gesperrt"). Dem Betreiber wurde vorgelegt, dass eine Systemwahl
links eine Interaktion ist und dass die konsequente Fassung mit dem bisherigen
Grundsatz bricht — er hat sie in Kenntnis dessen gewählt. Wer diese Phase
plant, darf D-01 aus Phase 14 **nicht** dagegenhalten; es ist ersetzt.

### D-02 — Alles steht im ausgelieferten HTML; die Konsole blendet nur um

Die Bedingung, unter der D-01 sicher ist. **Keine Auslesung wird nachgeladen,
keine per JavaScript erzeugt.** Ohne JavaScript zeigt die Seite alle Systeme
untereinander als schlichte, lesbare Liste — nicht eine leere Fläche. Die
Konsole ist eine Verbesserung obenauf, kein Ersatz für den Inhalt.

**Begründung, nicht verhandelbar:** ~17.000 indexierbare Seiten, und der Zulauf
kommt praktisch vollständig aus Suche (30 Tage: Bing 67 · DDG 38 · ChatGPT 10 ·
Google 7 — siehe `traffic-source-bing-not-google`). Am 18.08.2026 gemessen
trägt `dist/de/schiffe/anvl-carrack.html` **~5 KB echten Text** im Quelltext;
Stichprobe belegt „CF-447 Rhino Repeater", „Barbican", „456 SCU", „Surveyor"
alle im statischen HTML. Eine im Quelltext leere Schiffsseite fällt aus dem
Index und nimmt den Zulauf mit.

### D-03 — Mobil gestapelt (Betreiber)

Bei 360 px: Modell oben, Systemliste als waagerechte Chip-Reihe darunter,
Auslesung darunter. Dieselbe Idee, andere Anordnung. **Keine zweite
Oberfläche** und kein Ausschluss mobiler Besucher.

### D-04 — Das 3D lädt beim Scrollen in den Blick (Betreiber)

Ein statisches Standbild steht sofort; sobald die Bühne in den sichtbaren
Bereich kommt, lädt das Mesh nach und löst es ab. **Kein Startknopf** — wenn
das Schiff die Navigation ist, darf es nicht hinter einem Knopf liegen. Wer
nie hinunterscrollt, lädt nichts.

### D-05 — Bei schmalen Breiten wird die Bühne hochformatig (Betreiber, 18.08.2026)

**Anlass:** Welle 1 hat S-0 beantwortet und dabei eine Grenze gemessen
(`.planning/WINDOWS.md` id 21). Bei 1280 px trägt die Konsole für alle drei
Prüfschiffe. Bei 360 px trägt sie für kompakte Schiffe (argo-csv-cargo: 76,4 %
Füllgrad), aber **anvl-carrack erreicht nur 55,4 % und drak-ironclad 53,5 %** —
das Schiff wird zum schmalen Streifen, die Marker sind zwar noch als farbige
Punkte erkennbar, aber deutlich mühsamer zu finden.

**Die Ursache ist geometrisch, kein Fehler:** bei fester 3/4-Kameraausrichtung
auf einer **querformatigen** Bühne bindet bei einem sehr langen Schiff die
BREITE, bevor die Höhe — die kürzere Kante, an der P-1 misst — das Zielmaß
erreicht.

**Entscheidung:** Bei schmalen Breiten wird die Bühne **höher als breit**. Damit
ist die Breite die kürzere Kante; ein langes Schiff, diagonal hineingelegt,
füllt sie deutlich besser. Das behebt die Ursache statt das Symptom und kommt
mit **EINER Kamera für alle Schiffe** aus.

⚠ **Zwei Wege wurden vorgelegt und verworfen:**

- *Kamera dreht sich je nach Schiff* (stark gestreckte Schiffe stärker von
  vorn): füllt am besten, aber jedes Schiff stünde in einem anderen Winkel, und
  der Vergleich zweier Schiffsseiten nebeneinander würde schwerer. Das ist eine
  sichtbare, seitenweite Gestaltungsentscheidung, kein Fit-Parameter.
- *Untergrenze für lange Schiffe absenken* (z. B. 50 % ab 3:1 Streckung):
  kleinster Eingriff, aber ein Eingeständnis — auf dem Handy bliebe die Carrack
  ein Streifen.

**Was das kostet und wer es bezahlt:** auf dem Handy nimmt die Bühne mehr
senkrechten Platz. Das ist bewusst in Kauf genommen; die Auslesung steht nach
D-03 ohnehin darunter und rückt entsprechend nach.

**Woran es gemessen wird:** P-1 gilt unverändert (≥ 70 % der kürzeren
Bühnenkante) — jetzt aber gegen eine Bühne, deren kürzere Kante bei schmalen
Breiten die Breite ist. Die Messung läuft mit demselben Werkzeug wie in Welle 1
(`scripts/probes/schiffskonsole-messung.mjs`), an denselben drei Prüfschiffen,
und die Zahlen aus id 21 (55,4 % / 53,5 % / 76,4 %) sind die Vergleichsmarke.
Wird sie verfehlt, ist das ein Befund und keine Nachverhandlung der Marke.

### Claudes Ermessen

- Zuschnitt und Reihenfolge der Systemliste (die Gruppen `core`/`arms`/`prop`/
  `other` existieren, sind aber nicht bindend)
- Ob die Auslesung rechts, unter oder über dem Modell sitzt
- Wie die Marker gestaltet sind, und ob sie beschriftet oder nur bei Auswahl
  beschriftet sind
- Was mit den Kaufdaten, Maßen, Lackierungen und Varianten geschieht — sie
  haben keine Position am Schiff und brauchen einen eigenen Ort
- Ob der Hero in seiner heutigen Form überhaupt bestehen bleibt

---

## Erkenntnisse aus dem Bestand — alles am 18.08.2026 geprüft

### Der Mechanismus existiert bereits

| geprüft | Befund |
| --- | --- |
| Abdeckung | **227 / 227** Schiffe haben Mesh UND Hardpoints |
| Ports je Schiff | Median **48**, min 13, max 130 |
| Carrack | 60 Hardpoints in 14 Arten |
| `three.module.min.js` | 360 KB (Verzeichnis `public/vendor/three/` 1,7 MB) |
| GLB | 227 Dateien, Median 0,37 MB, max 0,63 MB, Carrack 0,28 MB |
| Viewer | `public/assets/holo-viewer.js`, 41.821 Bytes, in Betrieb |

**Datenaufbau** (`src/data/ship-hardpoints.json`, je Schiff):
`{ cga, match, bones, bbox, hull, hp }` — `hp` ist ein Array aus
`{ n: Hardpoint-Name, k: Art, p: [x,y,z] }`. Carrack-`bbox`:
`[[-34,-63.338,-27],[34,49.103,10.153]]`. Arten der Carrack: fuel 5, weapon 7,
radar 2, turret 14, missile 1, thruster_mav 12, thruster_retro 2,
thruster_vtol 4, thruster_main 4, cooler 2, countermeasure 2, power 2,
quantum 1, shield 2.

**`HoloPort`** (`ShipDetail.astro:184`) trägt bereits:
`k`, `g`, `p[]`, `label`, `size`, `lab`, und die Item-Finder-Anreicherung
`cat` / `price` / `shops` / `iid`, dazu die Vorbehalte `np` (nicht
physicalisiert), `est` (Position geschätzt), `dim`, `badge`.

**Gruppierung** (`ShipDetail.astro:200–205`): `HOLO_GRP_ORDER =
['core','arms','prop','other']`, `HOLO_DEFAULT_ON = ['core','arms']`.
Die Umschalter dafür existieren als `.holo__layer`-Knöpfe (Zeile 1312 ff.).

### Wo es heute falsch liegt

Das Hologramm ist **einer von drei Reitern** im Hero („VIDEO | BILDER |
3D-HOLO", `.holo__stage[data-default]`) hinter einem
`.holo__activate`-Startknopf (`ShipDetail.astro:1304`). Die Daten, die es
erklären soll, stehen davon getrennt in den Kapiteln darunter.

### Fallen

- ⚠⚠ **Marker auf einem Foto können nicht funktionieren** — der Kamerawinkel
  eines Fotos ist unbekannt. Die Attrappe
  `.planning/sketches/013-konzepte/b-konsole.html` tut genau das und ist an
  dieser Stelle **irreführend**. Marker gehen nur über dem gerenderten Mesh.
- ⚠ **Phase 14 hinterlässt scharfe Tore**, die angepasst statt umgangen werden:
  `verify:shipcard` (acht Zusicherungen gegen Kapitelgerüst, Sprungleiste,
  Balken, Entdopplung) und die Höhen-Sperrklinke 4.200 px in
  `scripts/probes/schiffskarte-messung.mjs`. Beide sind auf den Kapitel-Aufbau
  gemünzt, den diese Phase auflöst.
- ⚠ `ShipDetail.astro:404` trägt `*{margin:0;padding:0}` — die Zeile
  neutralisiert die site-weite `section`-Polsterungsfalle. Nicht anfassen.
- ⚠ `:global()` verpufft still in `<style is:inline>`.
- ⚠ Bildlauf-Kästen brauchen **sechs** Einträge in **zwei** Dateien:
  drei Regelgruppen in `assets/mobile-ux.css` §5c und `SEL_DRAG` + `SEL_FADE`
  in `assets/scroll-affordance.js`. `assets/theme.css` hat KEINE Liste.
- ⚠ Jede neue sichtbare Zeichenkette braucht DE **und** EN in `src/i18n/ui.ts`.
- ⚠ Datenherkunft (Data.p4k, DataCore, scmdb, „datamined") darf nirgends im
  sichtbaren Text auftauchen — `audit:site` erzwingt das als FEHLER.

---

## Konkrete Vorgaben

1. **Der Textbestand im Quelltext ist die härteste Zusicherung.** Vor dem
   Umbau messen, nachher messen, als Sperrklinke festschreiben. Er darf nicht
   kleiner werden.
2. **Ohne JavaScript prüfen** — nicht durch Lesen des Codes, sondern mit
   abgeschaltetem JavaScript im Browser gegen das gebaute `dist/`.
3. **Nicht nur die Carrack.** Ein Schiff mit 13 Ports und eines mit 130 müssen
   mitgeprüft werden; bei 130 Markern kann die Bühne zum Punktehaufen werden.
4. **Netzverkehr messen, nicht annehmen:** beim Seitenaufruf darf weder
   `three.module.min.js` noch ein GLB angefordert werden.
5. **DE und EN in einem Schritt**, 360 px als untere Prüfbreite.
6. ⚠ **Sichturteil, das kein Skript entscheidet:** erkennt man bei 380 px
   Bühnenbreite auf einem drehbaren Mesh tatsächlich, wo ein Marker sitzt?
   Bei 60 Hardpoints in 14 Arten kann das großartig sein oder ein
   Punktehaufen. Das gehört als benannter Punkt nach `.planning/WINDOWS.md`
   — und sollte so früh wie möglich beantwortet werden, weil die ganze Phase
   daran hängt.
