# Items in 3D: Bäcker und Wächter

Die Modelle hinter „In 3D ansehen“ (nur im Vorschau-Bau) entstehen auf dem
Betreiber-Rechner aus der Spielinstallation und liegen in einem eigenen
Speicher (`base` in `src/data/item-3d.json`), nicht im Repo.

| Datei | Aufgabe |
|---|---|
| `bake.mjs` | ein Item zu einem GLB backen; meldet je Item alle Merkmale seines Spielmaterials |
| `batch.mjs` | Massenlauf über eine Item-Liste, Arbeiter parallel, Bauprotokoll `<out>/manifest.jsonl`; `--zensus <datei>` zählt nur Merkmale, ohne zu backen |
| `upload.mjs` | neue Dateien in den Speicher laden (Zugang aus einer lokalen `r2.env`, nie im Repo) |
| `manifest.mjs` | aus dem Bauprotokoll die Liste der Seite und den Befundbericht schreiben |
| `../lib/item3d-merkmale.mjs` | **die Tabelle**: was der Bäcker an einem Material kennt |

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

Ein Item mit einem anhaltenden Merkmal kommt nicht in die Liste, auch wenn
sein Modell gebacken ist. Ein neuer Patch mit einem neuen Schalter erzeugt so
kein falsches Modell, sondern eine Lücke mit Namen. Anlass war die Prism
„Irradiated“: `%DECALS` war unbekannt, und das Modell wurde Chrom.

Bildplätze werden nur über ihre Nummer gelesen, nie über den Dateinamen. Der
Dateiname führte vorher zu falschen Glanz-, Farb- und Normalbildern.

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
node scripts\item3d\batch.mjs --p4k <Data.p4k> --list <items.json> --out <out> --zensus zensus.jsonl
# Merkmale "unbekannt"? Erst einordnen (Tabelle + Bäcker), dann backen:
node scripts\item3d\batch.mjs --p4k <Data.p4k> --list <items.json> --out <out>
node scripts\item3d\upload.mjs <out> --env <r2.env>
node scripts\item3d\manifest.mjs <out> src\data\item-3d.json
npm run verify:item3d-befunde
```

Eine geänderte Tabelle ändert den Eingabe-Hash jedes Items, und der nächste
Lauf backt neu. Das Tor `verify:item3d-befunde` (Schiene A) prüft die Liste
gegen die Tabelle dieses Checkouts:

1. Liste und Bericht stammen aus demselben Lauf.
2. Kein gelistetes Item trägt ein anhaltendes Merkmal.
3. Kein Merkmal wurde seit dem Lauf umgeordnet.
4. Jede benannte Ausnahme ist noch in Gebrauch.
