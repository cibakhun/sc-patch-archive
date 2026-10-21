# Hangar: Halle schwer dekorieren, mit Bedeutung (2026-10-21)

Auslöser für die PC-Sitzung: **„Hangar-Deko“**.

Anlass, Krisz 2026-10-21 14:00 (Projekt-Thread „Hangar-Deko mit
Spiel-Assets“): „okay mehr assets auch für hintergrund also nicht alles muss
um das schiff direkt herumstehen, wir dekorieren mal bisschen das hangar,
also nicht nur bisschen sondern heavy, hol viele assets, sowie wir das schon
gemacht haben mit semantik undso damit wir sie logischer platzieren können“.

Lesart:
- Die ganze Halle wird ausgestattet, nicht nur der Wartungsplatz am Schiff:
  die Streifen zwischen Feldrand und Wand (je Längsseite 12–16 m breit,
  96 m lang), die Stirnseiten, die Wände selbst.
- Viele neue Requisiten aus dem Spiel, mit Bedeutung wie im Katalog
  ([`hangar-katalog.md`](hangar-katalog.md) K2,
  [`hangar-requisiten.md`](hangar-requisiten.md) R1), damit die Cloud sie in
  Zonen stellt, die ein Spieler versteht: Lager, Fracht, Munition und
  Bauteile, Energie und Technik, Gas und Treibstoff, Werkstatt,
  Crew-Ecke, Sicherheit an der Wand.

Es gelten die Regeln von dort: Geometrie und Texturen aus dem Spiel; keine
Bilder, keine Roh-Exporte und kein `.mtl`-XML im Repo (es ist öffentlich);
ausgeliefert werden nur gebaute, verkleinerte Dateien.

## Was die Cloud heute hat (Katalog v2)

256 Requisiten in 14 Kategorien, davon nutzt der Wartungsplatz rund 60.
Was für eine große Halle fehlt, ist alles, was Fläche und Höhe füllt und
sofort nach Star Citizen aussieht: Frachtkisten in SCU-Größen, Regale,
Spinde und Crew-Möbel, Bauteile, große Maschinen, Wandleitungen,
Bodenmarkierungen für Zonen. Werkzeugwände und Stützen gibt es laut R2 im
Spiel nicht als Requisit; das gilt weiter.

Die Arbeitsplätze im Katalog nennen ihre Mitglieder, aber nicht, auf
welcher Seite die Wand steht. Für Plätze an der Wand braucht die Cloud das.

## Auftrag PC

1. Eigener Worktree oder Branch `pc/hangar-deko` von
   `origin/claude/project-thread-0h9tau` (dort liegt diese Notiz). Die
   Spielquellen liegen wie zuletzt unter `.cache` des Hangar-Worktrees.

### D1. Mehr Fundorte

2. Zu den 111 Hangar-socpaks aus K1 dazu, soweit es sie gibt:
   - Verteilzentren und Lagerhallen (Hallen mit Regalreihen und
     Frachtstapeln);
   - Frachtdecks und Hangars der Stationen;
   - Hangars und Frachtbereiche der Landezonen;
   - Ladenflächen für Schiffsteile (Dumper's Depot, Teach's, Cousin Crow's
     o. ä.), wegen der Bauteile.
   Je Fundort zählen wie in K1 (Brushes aus der .soc, Entities aus dem XML).

### D2. Neue Requisiten (mindestens 80, je Kategorie mindestens 5)

3. Neue Kategorien, je eine Datei `public/hangar/props/<kategorie>.glb`:
   - **`fracht`**: Frachtkisten in den SCU-Größen 1, 2, 4, 8, 16, 24, 32 im
     Standardlook, dazu zwei, drei Varianten, die in Frachtdecks häufig
     stehen; Frachtpaletten und -gitter.
   - **`regal`**: Schwerlast- und Palettenregale, Wandregale, Regalreihen,
     wo das Spiel sie bestückt hat auch die bestückte Fassung.
   - **`crew`**: Spinde, Bänke, Tische, Hocker und Stühle, Wasserspender,
     Kaffee- oder Getränkeautomat, Mülleimer. Sitze waren bisher
     ausgeschlossen (`NOT_PROP`); hier gehören sie dazu.
   - **`bauteile`**: Schiffsbauteile als Gegenstand, je ein Kraftwerk,
     Kühler, Schildgenerator und Quantenantrieb in S1 bis S3 (Geometrie des
     Items), dazu Kisten und Ständer für Bauteile und Triebwerke, wo es sie
     gibt.
   - **`maschine`**: große Geräte: der ATLS-Lastenanzug geparkt (falls als
     Requisit oder Fahrzeug ohne Fahrer exportierbar), Schlepper oder
     Zugmaschine, Hub- und Scherenbühnen, fahrbare Arbeitsbühnen und
     Gerüste, Brücken- oder Portalkran mit Haken, Tankwagen.
   - **`wand`**: was an Wänden hängt: Rohr- und Kabeltrassen, Schalt- und
     Verteilerkästen, Steuerpulte, Monitore und Infotafeln, Warn- und
     Hinweisschilder.
   - **`decke`**: Kabeltrassen, Lüftungsrohre, Hängeleuchten der
     Werkstatt, Kettenzüge.
4. **Boden.** Decals für Zonen und Wege, wie sie in Hallen liegen:
   Gelb-Schwarz-Schraffur, Linien, Pfeile, Ziffern, Parkfelder,
   Abflussgitter; dazu weitere Öl-, Reifen- und Schleifspuren. Als
   `public/hangar/props/boden.glb`, Knoten `decal_<name>` wie in
   `werkstatt-boden.glb` (Einheitsquadrat oder Spiel-Mesh, Größe in der
   JSON).
5. Grenzen wie K4: ein Requisit ≤ 8 000 Dreiecke, große ≤ 20 000; je Datei
   ≤ 3 MB; Draco, WebP; Farbe ≤ 1024 px, Normalen und Masken ≤ 512 px.
   Materialien vollständig wie R1 (alle Schichten, Blend-Map,
   Detailkarten unter `schichten/`, `COLOR_0`, Metalle).

### D3. Bedeutung je Requisit

6. Wie K2 (Spielname, Beschreibung, Typ, Tags, Aufstellung, Nachbarn,
   Zweck und Nutzung, `quelle`). Für alle Requisiten, auch die alten 256,
   neu dazu:
   - **`zone`**: wo in einer Halle, gezählt über alle Aufstellungen:
     `feldrand` (≤ 6 m vom Feld), `halle` (weiter weg, frei), `wand`
     (≤ 1,5 m von einer Wand), `ecke` (≤ 3 m von zwei Wänden), `decke`,
     `tor` (≤ 8 m vom Hallentor). Je Zone der Anteil.
   - **`stapel`**: worauf es steht (Boden, Palette, Kiste, Regalboden: Knoten
     und Höhe) und was darauf steht; bei Frachtkisten die übliche
     Stapelhöhe.
   - **`reihen`**: wo es in Reihen steht (Regale, Kisten): Abstand in der
     Reihe, Länge der Reihe, Gangbreite dazwischen.

### D4. Zonen aus den Spielhallen

7. Wie K3, aber größer: Gruppen, deren Requisiten näher als 6 m
   zueinander stehen (Lagerzone mit Regalen, Stapler und Paletten;
   Frachtstapel; Crew-Ecke). Je häufiger Zusammensetzung ein Vertreter aus
   dem Spiel mit Mitgliedern in **Platzkoordinaten mit Wandseite**:
   +z zeigt zur nächsten Wand, z = 0 ist die Wand, Drehung 0 heißt
   Vorderseite des Spiels (−z) zur Halle. Liegt keine Wand näher als 3 m,
   steht `wand: null` und die Achse zeigt zum Feld.
8. Dasselbe nachträglich für die 39 Arbeitsplätze im Katalog: Vertreter in
   Platzkoordinaten mit Wandseite, sonst unverändert.

### D5. Dateien und Abschluss

9. `katalog.json` auf `v: 3`: neue Kategorien, `zone`, `stapel`, `reihen`,
   `zonen` (D4) neben `arbeitsplaetze`. Was `scripts/build-hangar-dienst.mjs`
   liest (`props[].node`, `file`, `size`, `materials`, `schichten`), bleibt,
   wie es ist. Manifest wie bisher, dazu `props.boden`.
10. Am PC alle neuen Dateien als Galerie rendern und ansehen (nicht
    committen): Texturen, Tönung, nichts schwebt, nichts steht im Boden.
11. `npm run build && npm run gate`, normal und mit `STAGING=1`.
12. **Selbstauskunft** hier unter „Befund PC“: je Kategorie Requisiten,
    Dreiecke, Bytes; je Fundort aus D1, was er beigetragen hat; Zonen aus
    D4 mit Zahl und Hallen; was es im Spiel nicht gibt, klar sagen.
13. Push auf `pc/hangar-deko`, ohne PR. Einbau in die Halle, Packen und
    Vorher/Nachher macht die Cloud.

## Cloud (läuft parallel)

- Hallendeko aus dem Katalog v2, ohne auf den PC zu warten: Zonen an den
  Längsseiten und Stirnseiten, Sicherheit an den Wänden, gepackt wie der
  Wartungsplatz (ein Zeichenbefehl für alle flachen Teile).
- Mit dem PC-Stand: die neuen Kategorien in dieselben Zonen.
