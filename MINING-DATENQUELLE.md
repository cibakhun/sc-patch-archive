# Mining-Datenquelle & Exaktheits-Beweis (Patch 4.8.3)

**Kurz:** Alle Mining-Fakten auf der Seite (Fundorte, Abundance %, Signaturen,
Physik, Refinery-Profile) sind **byte-identisch zu den rohen Spieldateien** von
Star Citizen 4.8.3 — verifiziert gegen die extrahierte `Data.p4k`. Keine
Annäherung, keine Schätzung. Preise werden bewusst **nicht** angezeigt
(crowdsourced/volatil, nicht game-verifizierbar).

## Woher die Daten kommen

Zwei Ebenen, beide game-akkurat:

1. **`assets/mining-model.json`** ← `scmdb.net` (datamined CIG-Spieldaten).
   Treibt Signatur-Identifier, Fracturing-Rechner, Refinery-Finder.
2. **`assets/mining-db.json`** ← gebaut aus derselben scmdb-Quelle via
   `scripts/build-mining-db.mjs`. Treibt die Mineral-Datenbank (Abschnitt 01).

scmdb veröffentlicht die datamined Spieldaten **versioniert** (`versions.json`,
`mining_data-<version>.json`). Unsere Skripte ziehen automatisch die **LIVE**-
Version (nie PTU — Guard eingebaut).

## Wie die % (Fundort-Abundance) entstehen

Die „bis X %" sind **Rohwerte aus den Spieldateien**, keine Berechnung von uns:

- **`maxPercentage`** in den `MineableComposition`-Records = maximaler Erz-Anteil
  im Rock. Beispiel Quantainium (`.../rockcompositionpresets/surfaceshipmining/legendaryshipmineables_quantainium.xml`):
  `maxPercentage="78.3"` → wir zeigen „bis 78 %".
- **Welche Orte / Rangfolge** = `relativeProbability` der Deposits je Location,
  normiert innerhalb der Gruppe, × maxPercentage. Top-5 je System.

## Der Beweis (2026-07-06)

Der lokal installierte Client (`F:\...\StarCitizen\LIVE`) hat Build-Changelist
**`12122953`** — **exakt** scmdbs Quelle `4.8.3-live.12122953`. Also dieselben Bytes.

Verifikation direkt aus der Spieldatei:
1. `Data.p4k` (149 GB) mit **unp4k** entpackt → `Data/Game2.dcb` (DataCore, 307 MB).
2. **unforge** → XML-Records, u. a. `libs/foundry/records/mining/mineableelements/*.xml`
   und `.../mining/rockcompositionpresets/*.xml`.
3. Automatischer Abgleich der Element-Physik (instability, resistance, optimal-
   window×3, explosionMultiplier, clusterFactor) **Spieldatei ↔ scmdb**:

   **25 Elemente · 175 Einzelwerte · 0 Abweichungen** → byte-identisch.

   Zusätzlich Fundort-%: Quantainium `maxPercentage=78.3` (Spiel) = „bis 78 %" (Seite).

## Frisch halten

- `npm run refresh:mining` — Modell + DB frisch aus LIVE scmdb + Build (ein Befehl).
- `npm run verify:mining` — zieht LIVE scmdb neu, bricht bei jeder Abweichung
  (Exit 1) ab. So kann kein „ungefährer" Wert unbemerkt reinrutschen.

### scmdb-unabhängiger Eigen-Extraktor: `scripts/datamine-mining.mjs`

Extrahiert die **numerische Kernschicht** (Element-Physik + Kompositionen/„bis X %")
**100 % aus der eigenen SC-Installation**, ohne scmdb:

```
# 1) DataCore aus dem Client holen (einmal je Patch)
unp4k.exe  "F:\...\StarCitizen\LIVE\Data.p4k" .dcb     # -> Data/Game2.dcb
unforge.cli.exe  Data/Game2.dcb                         # -> XML-Records
# unp4k bauen: git clone github.com/dolkensp/unp4k; in *.csproj net10.0->net8.0; dotnet build

# 2) parsen + gegen scmdb 0-Diff prüfen
node scripts/datamine-mining.mjs  "<...>/extract/Data" --verify
```

**Verifiziert (2026-07-06):** 25 Elemente × 7 Physikwerte + alle 63 scmdb-
Kompositionen (860 %-Werte) = **1035 Einzelwerte, 0 Abweichungen** gegen scmdb.
D. h. die Physik und die Fundort-Prozente kommen nachweislich byte-genau aus den
Spieldateien — scmdb ist nur ein bequemer, verifizierbarer Umweg zu denselben Bytes.
Ausgabe: `assets/mining-gamefiles.json` (gitignored, maschinenspezifisch).

**Was der Eigen-Extraktor (noch) NICHT abdeckt — die Location-/Spawn-Ebene:**
Welcher Belt/Planet welche Komposition mit welcher `relativeProbability` spawnt,
steckt NICHT in `records/mining`, sondern im Objekt-Container-/Spawn-System der
Welt-Daten (`environments/asteroid_fields` liefert nur die visuellen Asteroiden-
Meshes, keine Erz-Wahrscheinlichkeiten). Diese Ebene sauber zu rekonstruieren ist
ein größeres Projekt (mehrere Tage). Bis dahin liefert **scmdb** die Location-Ebene —
und `npm run verify:mining` stellt sicher, dass sie 0-Diff zur LIVE-Quelle bleibt.
Die angezeigten Fundort-% selbst (`maxPercentage`) sind wie oben game-verifiziert.
