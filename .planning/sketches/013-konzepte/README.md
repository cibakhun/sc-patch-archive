# Attrappen 013 — drei Konzepte für die Schiffs-Datenkarte

**Wegwerf-Entwürfe.** Anlass: Betreiber-Befund vom 18.08.2026 zu Attrappe 012
(„RSI-nah, weiche Kärtchen"): *„ich stelle mir vor dass man so eine
datenblatt seite so unfassbar kreativ machen kann. momentan sind wir auf
kreativitätstufe 0."*

Der Befund stimmt. Attrappe 012 war eine **Aufräumaktion**, keine Idee — RSI
kopiert und leiser gedreht. Die drei Konzepte hier unterscheiden sich nicht in
der Farbe, sondern in der **Art**.

Die gemeinsame Grundeinsicht: **die Daten eines Schiffs sind räumlich.**
126 m, ein Frachtraum, acht Hardpoints an bestimmten Stellen — das sind keine
Tabellenzeilen, das sind Eigenschaften eines Körpers. Und VerseBase hat etwas,
das RSI und die Wiki nicht haben: die echten Spielmeshes mit den echten
Port-Positionen, 227/227 Schiffe (siehe `holo-components-page`).

Alle drei zeigen dieselben echten Carrack-Daten, damit der Vergleich fair ist.

---

## A — „Riss" (`a-riss.html`)

**Verschiebung der Bildsprache.** Die Seite ist keine Sammlung von Karten,
sondern EINE technische Zeichnung, an der die Daten als Beschriftung hängen:
Maßketten mit echten Pfeilen, Auszüge mit Führungslinien auf die tatsächlichen
Positionen, Rasterpapier, Schriftkopf mit Blattnummer und Maßstab, Stückliste
mit Positionsnummern. Ein Datenblatt sieht endlich aus wie ein Datenblatt.

- **Stärke:** eigenständig, ohne Vorbild in diesem Feld, und formal *ehrlich* —
  das ist die angemessene Form für genau diesen Inhalt.
- **Kostet:** eine zweite Formensprache neben dem Rest der Seite.
- ⚠ Der Grundriss ist hier die **echte Hüllkurve aus L×B×H** (126×74×30), kein
  erfundener Umriss. In Produktion liefert die Silhouette der vorhandene Mesh.

## B — „Konsole" (`b-konsole.html`)

**Verschiebung des Bedienmodells.** Das Schiff IST die Navigation. Keine
Kapitelleiste — man wählt links ein System, das Schiff markiert, WO dieses
System sitzt, und rechts erscheint die Auslesung. Ein Klick auf einen Marker
führt ins Item-Finder-Bauteil.

- **Stärke:** ⭐ das kann **nur VerseBase**. Die Port-Positionen liegen aus dem
  Spielmesh vor. RSI und die Wiki haben diese Daten nicht und können es nicht
  nachbauen.
- **Kostet:** ohne JavaScript nur eingeschränkt bedienbar — und D-01 aus Phase 14
  („nichts hinter einem Klick") muss beantwortet werden: es *ist* eine Auswahl.
  Vertretbar nur, wenn alle Systeme untereinander auch als Volltext existieren.
- ⚠ Attrappe: Marker auf geschätzten Bildkoordinaten. Produktion nimmt die echten.

## C — „Maßstab" (`c-massstab.html`)

**Verschiebung der Informationsarchitektur.** Die Seite beantwortet nicht „was
ist dieses Schiff", sondern die Frage, die man beim Lesen wirklich hat: *„ist
es das richtige?"* Vergleich ist kein Werkzeug auf der Seite — Vergleich IST die
Seite. Kein Wert steht allein; jeder steht neben der Flotte und neben einem
angehefteten Rivalen. 126 m wird als Silhouette gegen Mensch, Jäger und
Zerstörer gezeigt, nicht als Zahl. Unten ein ausformuliertes Urteil dafür/dagegen.

- **Stärke:** trifft die tatsächliche Leseabsicht. Macht aus der Seite ein
  Werkzeug statt eines Steckbriefs.
- **Kostet:** die Rivalen-Wahl braucht Zustand; „spricht dafür/dagegen" muss
  entweder abgeleitet oder redaktionell gepflegt werden — und redaktionell
  gepflegt heißt 227 × 2 Sprachen.
- ⚠ Der Maßstabsbalken beginnt bei ALLEN Schiffen an derselben Nulllinie. Ein
  erster Entwurf staffelte sie versetzt — das sah besser aus und machte das
  Lineal darunter zur Lüge.

---

## Was die drei nicht sind

Keiner der drei ist fertig. Jeder zeigt die **Idee** auf ein bis zwei
Bildschirmen, nicht die vollständige Seite. Ausgespart: Hologramm-Bühne,
Video-/Bilder-Umschalter, Merken-Knopf, Kontogebundenes, Hellmodus, Lackierungen,
Varianten, ähnliche Schiffe, Quellenangaben.

Die drei schließen sich **nicht** gegenseitig aus. A liefert die Bildsprache,
B das Bedienmodell, C die Architektur — eine Kombination ist möglich und
vermutlich stärker als jedes einzelne.
