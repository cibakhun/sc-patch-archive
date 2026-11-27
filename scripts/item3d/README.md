# Items in 3D: Bäcker und Wächter

Die Modelle hinter „In 3D ansehen“ (nur im Vorschau-Bau) entstehen auf dem
Betreiber-Rechner aus der Spielinstallation und liegen in einem eigenen
Speicher (`base` in `src/data/item-3d.json`), nicht im Repo.

| Datei | Aufgabe |
|---|---|
| `liste.mjs` | die Backliste aus dem **ganzen Katalog**: jedes Item bekommt genau ein Schicksal (zu backen oder ohne Record, mit Grund) |
| `bake.mjs` | ein Item zu einem GLB backen; meldet je Item alle Merkmale seines Spielmaterials |
| `batch.mjs` | Massenlauf über die Backliste, Arbeiter parallel, Bauprotokoll `<out>/manifest.jsonl`; `--zensus <datei>` zählt nur Merkmale, ohne zu backen |
| `upload.mjs` | neue Dateien in den Speicher laden (Zugang aus einer lokalen `r2.env`, nie im Repo) |
| `manifest.mjs` | aus dem Bauprotokoll die Liste der Seite und den Befundbericht schreiben |
| `../lib/item3d-merkmale.mjs` | **die Tabelle**: was der Bäcker an einem Material kennt |

## Der ganze Katalog, keine Hand-Listen

Bis 27.11.2026 wurde aus zwei Hand-Listen gebacken, eine für Rüstung, eine
für Waffen. Kleidung, Werkzeuge, Verbrauchsgüter und Sonstiges standen auf
keiner, und niemand merkte es: eine Lücke ohne Liste wirft keinen Fehler.
Darum baut `liste.mjs` die Backliste aus `assets/universal-items.json`. Den
Record nimmt sie aus dem Katalog oder, wo der Katalog keine Spieldaten führt,
über den Namen aus dem Datenlauf (`assets/items-gamefiles.json`, nur ein
eindeutiger Treffer zählt). `batch.mjs` nimmt nur Listen dieses Formats an.

Ob ein Item ein Modell hat, entscheidet der Bäcker, nicht die Liste: eine
neue Art im Spiel wird ohne Zutun gebacken, und hat sie kein Modell
(Lackierung, Charakter-Farbe, Schiffsregler), steht das mit Grund im
Bauprotokoll. `manifest.mjs` schreibt in den Befundbericht unter
`abdeckung` für jedes Katalog-Item, das weder in der Liste noch angehalten
ist, den Grund (ohne Record, ohne Modell, gescheitert, offen). Das Tor zählt
das je Katalog-Bereich und hat dort Klinken.

## Die Tabelle entscheidet, nicht der Bäcker

Jedes Merkmal eines Spielmaterials (Shader, Schalter wie `%DECALS`,
Bildplatz `TexSlotN`, Wert, Kachelung, Bildformat, Bauvorgang) wird in
`scripts/lib/item3d-merkmale.mjs` eingeordnet:

- **ja**: umgesetzt
- **naeh**: genähert, mit Grund
- **ohne**: im Standbild ohne Wirkung
- **weg**: bewusst weggelassen
- **fehler**: Bau kaputt, Item hält an
- **unbekannt**: nicht in der Tabelle, Item hält an

Unbekannt heißt: kein eigener Eintrag in der Tabelle. Das gilt für Schalter,
Bildplätze, Werte und Kachelungen der Shader, die der Bäcker wirklich backt
(Einordnung `ja`: `LayerBlend_V2`, `Illum`, `MeshDecal`). Shader, die er als
Ganzes nur nähert oder weglässt (`GlassPBR`, `DisplayScreen`, `Monitor`,
`UIMesh`, `UIPlane`, `ScopePBR`, `HumanSkin_V2`, `HairPBR`, `Eye`: `naeh`;
`NoDraw`: `ohne`), geben ihre Einordnung an alles weiter, was sie nicht
einzeln führen: ein neuer Schalter an einem Bildschirm ändert an der
Näherung nichts und hält darum nicht an. Ein neuer Shader ist dagegen
immer unbekannt. Genannt werden alle Merkmale trotzdem, im Befundbericht
und in der Zählung (`--zensus`).

Ein Item mit einem anhaltenden Merkmal kommt nicht in die Liste, auch wenn
sein Modell gebacken ist. Ein neuer Patch mit einem neuen Schalter erzeugt so
kein falsches Modell, sondern eine Lücke mit Namen. Anlass war die Prism
„Irradiated“: `%DECALS` war unbekannt, und das Modell wurde Chrom.

Bildplätze werden nur über ihre Nummer gelesen, nie über den Dateinamen. Der
Dateiname führte vorher zu falschen Glanz-, Farb- und Normalbildern.

Teilnetze mit denselben Karten teilen sich ein gebackenes Bild (einen Satz).
Liegen dabei zwei mit verschiedenem Material auf denselben UV-Flächen, prüft
der Bäcker das auf einem Raster von 256 und gibt dem späteren einen eigenen
Satz; vorher überschrieb es das frühere (Backfassung 6: 719 der gelisteten
Items, darunter Prism, Quartz, Calva). Zum Satz gehören Misch-, Normalen-,
Abnutzungs- und Höhenkarte samt Kachelung, auch bei Materialien ohne
Mischkarte (Backfassung 7: 45 Waffen und 3 Rüstungsteile). Ohne Mischkarte
zeichnet und lädt der Bäcker nur Schicht 1.

Neben den Merkmalen des Materials meldet der Bäcker auch, wie er gebaut hat
(Schlüssel `Bau …`), und die Tabelle ordnet diese genauso ein:

- **Färbeart** (`TintMode` der Schichtdatei, im Spiel nur 0, 1 und 2): sie
  entscheidet, was die Palette an einer Schicht färbt. 0 Waffenstoff: Farbe
  und Spiegelung aus der Palette; 1 Lack, Stoff, Gummi: nur die Grundfarbe;
  2 Metall: nur die Spiegelung. Palette und Tönung der Schicht wirken
  multipliziert (vorher ersetzte die Palette die Tönung, und Pembroke
  „RSI Graphite“ wurde silbern, der Oracle-Helm weiß). Eine neue Färbeart
  hält an.
- **Palettenplatz** 1 bis 3 einer Schicht braucht einen Eintrag in der
  Palette des Items; fehlt der Eintrag, hält das Item an. Die
  `DefaultPalette` mancher Materialien gilt im Spiel nicht (Monolith
  „Shadowflux“ wäre mit ihr oliv, im Spiel ist er grau-blau); ohne Palette
  behält die Schicht ihre eigene Tönung.
- **Ausführung**: hat das Netz Ausführungen (SubGeometry mit Tags) und endet
  der Record auf einen Namen, zu dem keine passt, hält das Item an
  („Ausführung nicht gefunden“). Vorher zeigten 24 Waffen still die
  Grundausführung (z. B. Parallax „Downburst“ statt schwarz-gold).
  Zustände wie `inventorystoredentity`, `tabledisplay` oder `open` sind
  Ansichten, keine Ausführungen, und gelten nicht als Name.
- **Detailstufe**: gebacken wird Stufe 1, außer sie behält weniger als ein
  Viertel der Dreiecke von Stufe 0 („Stufe 1 zu grob“; Schachfiguren hatten
  dort 18 Dreiecke).
- **Knotenkette**: die Lage eines Teils einer `.cga` ist die Kette seiner
  Knoten von der Wurzel her; die Matrix des Knotenbaums gilt gegen den
  Elternknoten. Vorher hing etwa der Sack der Erz-Kapseln quer neben dem
  Gehäuse (395 Items mit verschachtelten Knoten).
- **Handschuhe** werden nebeneinander gestellt statt in Armhaltung, sonst
  sind sie im Bild zwei Punkte.

## Neu backen, wenn sich das Spiel ändert

Der Bäcker führt Buch über jede Datei, die er für ein Item liest, auch über
Zwischenspeicher-Treffer. Der Massenlauf legt die Liste mit einer Kennung je
Datei ins Bauprotokoll (im Spielarchiv CRC und Größe aus dem Verzeichnis).
Ein Item gilt nur als fertig, wenn Eingabe-Hash, Modelldatei und die
Kennung aller seiner Quelldateien noch stimmen. Ändert ein Patch eine
Schicht, eine Palette oder ein Bild, backt der nächste Lauf genau die Items
neu, die sie benutzen. Vorgeführt mit Rohdaten: nach einer geänderten
Stoffschicht hieß es „5 schon fertig, 4 zu backen (davon 4 mit geänderten
oder ungeprüften Quellen)“, genau die vier Items mit dieser Schicht.

## Ablauf nach einem Patch

```powershell
$env:REPO = '<checkout mit node_modules>'
node scripts\item3d\liste.mjs liste.json
node scripts\item3d\batch.mjs --p4k <Data.p4k> --list liste.json --out <out> --zensus zensus.jsonl
# Merkmale "unbekannt"? Erst einordnen (Tabelle + Bäcker), dann backen:
node scripts\item3d\batch.mjs --p4k <Data.p4k> --list liste.json --out <out>
node scripts\item3d\upload.mjs <out> --env <r2.env>
node scripts\item3d\manifest.mjs <out> src\data\item-3d.json --liste liste.json --env <r2.env>
npm run verify:item3d-befunde
```

Eine geänderte Tabelle ändert den Eingabe-Hash jedes Items, und der nächste
Lauf backt neu. Jede Zeile des Bauprotokolls trägt die Kennung der Tabelle,
mit der sie gebacken ist (`tab`); `manifest.mjs` listet nur Zeilen mit der
Tabelle des eigenen Checkouts, damit die Einordnung im Bericht dieselbe ist
wie beim Backen. Der Upload vermerkt sein Ziel in `<out>/hochgeladen.ziel`
(Bucket, Endpunkt nur als Kennung), nur über https und ohne Weiterleitungen;
eine alte `hochgeladen.txt` ohne Vermerk übernimmt er nur mit
`--ziel-bestaetigen`. Er lädt erst alle Bilder und dann nur die Modelle, deren
Bilder alle oben sind; scheitert ein Bild, bleibt sein Modell bis zum nächsten
Lauf unten, und der Lauf endet rot. `manifest.mjs` nimmt den Nachweis nur für Bucket und
Endpunkt der Seite an (Endpunkt aus `--env`, nur `R2_ENDPOINT` wird gelesen).
Beide Protokolle tragen je Zeile ihre Zeit: scheitert ein Item nach seinem
letzten Erfolg, bleibt sein altes Modell aus der Liste, und jeder weitere
Lauf backt es neu, bis wieder ein Erfolg kommt. Eine Zählung (`--zensus`)
schreibt nie ins Bauprotokoll; fehlt ihr ein Item (auch eines ohne Record),
endet sie rot, Testeinträge des Spiels lässt sie mit Nennung aus.
Endet ein Arbeiter des Massenlaufs mitten in einer Gruppe, wird das laufende
Item als Fehler vermerkt, der Rest neu eingeplant, und was übrig bleibt, macht
den Lauf rot (`UNVOLLSTÄNDIG`, Exit 1).

Das Tor `verify:item3d-befunde` (Schiene A) prüft die Liste
gegen die Tabelle dieses Checkouts:

1. Liste und Bericht stammen aus demselben Lauf (Fingerabdruck über Item
   und Modelldatei, jedes Item mit gültiger Befundliste).
2. Kein gelistetes Item trägt ein anhaltendes Merkmal.
3. Kein Merkmal wurde seit dem Lauf umgeordnet.
4. Jede benannte Ausnahme ist noch in Gebrauch.
5. Jedes Item des Katalogs hat genau ein Schicksal (Liste, angehalten oder
   Lücke mit Grund), und kein Katalog-Bereich fällt unter seine Klinke. Ist
   der Katalog seit dem Lauf ein anderer (Datenlauf), ist das nur eine
   WARNUNG: neue Items warten auf den nächsten Lauf.
