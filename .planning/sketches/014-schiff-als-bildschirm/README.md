# Attrappen 014 — das Schiff als Bildschirm

**Wegwerf-Entwürfe.** Anlass: Betreiber-Befund vom 20.08.2026, nachdem D-01
geliefert war (die Konsole ersetzt die Kapitel, 454 Seiten, 0 Doppelungen):
*„wir kommen dem ganzen immer näher, sind aber noch weit entfernt … noch
meilen weit weg davon."*

Der Befund stimmt. Was am 20.08. geliefert wurde, hat eine **Doppelung
beseitigt** — es hat die Seite nicht in eine Konsole verwandelt. Konzept B aus
Runde 013 hieß *„das Schiff IST die Navigation"*. Gemessen am Ergebnis ist das
noch nicht eingelöst:

| Versprechen | Ist-Zustand am 20.08. |
| --- | --- |
| Das Schiff ist die Navigation | Navigiert wird über die **Liste links**; das Schiff illustriert die Auswahl |
| Die Konsole ist der Bildschirm | Sie ist ein **450-px-Band**; darunter beginnt sofort wieder ein Dokument |
| Das Schiff ist der Gegenstand | Titel und Herstellerlogo liegen **auf dem Rumpf** — er ist Hintergrund für Text |
| Acht Gruppen in einer Konsole | Vier davon (Ausstattung, Kaufen, Leistung, Umfeld) haben mit dem Rumpf **nichts zu tun**; er wartet daneben |

Die drei Entwürfe hier greifen jeweils an einer anderen Stelle an — sie sind
nach **Eingriffstiefe** sortiert, nicht nach Vorliebe. Alle drei zeigen
dieselben echten Carrack-Daten.

---

## A — „Vollbild" (`a-vollbild.html`)

**Die kleinste Verschiebung: dieselbe Konsole, aber sie ist der Bildschirm.**
Drei Eingriffe — die Konsole füllt das Fenster; der Name sitzt als Schild
**neben** dem Schiff statt darauf; die Auslesung ist keine dauerhafte dritte
Spalte mehr, sondern eine Karte, die **an der gewählten Stelle** aufgeht.
Darunter beginnt kein angeschnittenes Dokument, sondern eine angekündigte
zweite Ansicht.

- **Stärke:** aus dem heutigen Stand in einer Welle erreichbar. Kein neues
  Bedienmodell, keine neue Datenquelle.
- **Kostet:** ⚠ die volle Höhe **reißt P-1** — gemessen fällt der Füllgrad bei
  1440×900 auf 54,6 % gegen die 70-%-Klinke, weil eine höhere als breite Bühne
  von einem 2,13:1 flachen Schiff nie zu füllen ist (Ledger id 40). Ohne eine
  Neufassung dieser Kennzahl ist A nicht baubar.
- **Löst nicht:** vier der acht Gruppen machen das Schiff weiterhin
  bedeutungslos.

## B — „Das Schiff antwortet" (`b-antwortet.html`)

**Die eigentliche Verschiebung.** Das Schiff wechselt nicht den Marker-Filter,
sondern seinen **Zustand** — es beantwortet jede der acht Fragen selbst:
Maßkette bei Ausstattung, Landeplatz mit Preisschild bei Kaufen,
Geisterrisse der Varianten bei Umfeld. Gezeigt ist absichtlich der schwerste
Fall: **Leistung**, reine Statistik, wird als Überlagerung des Rumpfes mit der
Flottensilhouette zu einer Aussage, die man *sieht* statt liest.

- **Stärke:** ⭐ löst als einziger Entwurf den eigentlichen Bruch — danach gibt
  es keine Gruppe mehr, bei der der Rumpf wartet. Und es ist wieder etwas, das
  **nur VerseBase** kann: Median über 227 echte Meshes.
- **Kostet:** sieben Zustände statt einem. Jeder braucht eine eigene
  Darstellung, und die Silhouetten-Überlagerung braucht eine Median-Berechnung,
  die es noch nicht gibt.
- ⚠ Attrappe: vereinfachte Umrisse von Hand. In Produktion liefert die
  Silhouette das vorhandene Mesh.

## C — „Hangar" (`c-hangar.html`)

**Die radikalste.** Keine Spalten, kein Panel, keine Liste — ein Raum, und man
steht darin. Die Werte hängen als Beschriftungen **im Raum** an den Stellen, zu
denen sie gehören, mit Führungslinien zum Rumpf. Die Systemwahl ist keine
Navigation mehr, sondern eine **Blende** wie ein Helmvisier: sie schaltet um,
*was beschriftet ist*, und führt nirgendwohin.

- **Stärke:** löst das Motiv am konsequentesten ein. Der Rumpf ist nicht mehr
  Inhalt *einer* Spalte, er ist die Seite.
- **Kostet:** ⚠⚠ gibt die Spaltenstruktur auf, an der heute Rail, Auslesung
  **und das gesamte No-JS-Verhalten (D-02)** hängen. Ohne Skript müsste eine
  gleichwertige Liste darunter stehen — bei ~17.000 indexierbaren Seiten und
  Zulauf fast nur aus der Suche ist das keine Kür, sondern die
  Existenzgrundlage. Im Entwurf als Fußzeile angedeutet, nicht gelöst.
- ⚠ Attrappe: Beschriftungspositionen geschätzt; das Foto hat eine sichtbare
  Rechteckkante, in Produktion steht dort ein freigestellter 3D-Rumpf.

---

## Was die drei gemeinsam sagen

Alle drei nehmen dem Rumpf die Rolle „Bild im Kopfbereich" und geben ihm die
Rolle „Gegenstand, den man untersucht". Sie unterscheiden sich darin, **wie
weit die Seite dafür aufgegeben wird**: A behält die Bauform und dreht die
Proportion, B behält die Bauform und ändert die Aufgabe des Rumpfes, C gibt die
Bauform auf.

**A und B schließen sich nicht aus** — B ist der Inhalt, A die Fläche. C ist
eine Entscheidung gegen die heutige Struktur und müsste die D-02-Frage vorher
beantworten.

Offen und nicht von einer Skizze zu entscheiden: **P-1**. Solange der Füllgrad
gegen die kürzere Bühnenkante gemessen wird, ist jede bildschirmhohe Bühne bei
flachen Schiffen rechnerisch ein Rückschritt — obwohl das Schiff darin größer
aussieht als je zuvor. Das ist Ledger id 40 und gehört vor jeden Bau geklärt.
