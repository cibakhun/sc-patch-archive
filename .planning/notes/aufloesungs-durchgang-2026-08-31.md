# Auflösungs-Durchgang, zweiter Teil — 31.08.2026

Der erste Teil (30.08.) hat gemessen: waagerechter Überlauf 25 → 0,
stumme Bildlaufkästen 0, Felder unter 16 px 0, Fremdschriften 0. Alles
grün. Der Betreiber hat trotzdem gesagt, es gebe „genug Stellen, die auf
dem Handy kaputt sind" — und das war richtig.

Dieser Teil hat deshalb **hingesehen** statt nur gezählt.

## Das Werkzeug, das den Unterschied machte

`aufloesungsbogen.mjs`: **eine Seite, alle Auflösungen nebeneinander**,
jede Aufnahme in einem echten Fenster. Sechs schmale (320×568 bis
932×430) oder acht breite (768×1024 bis 2560×1440) Spalten in einem
Bild, jede beschriftet. Ein Blick genügt, um zu sehen, wo eine Seite bei
einer Breite anders bricht als bei der nächsten.

Damit sind 26 Seitentypen einzeln angesehen worden: Startseite, Archiv,
Patch, zwei Themenseiten, Missionsliste und -detail, Schiffsliste und
-detail, Bauplanliste und -detail, Item-Verzeichnis und -detail,
Item-Finder, Evolution, Rüstungssets, Mining-Werkbank,
Fracturing-Rechner, Downloads, Feedback, Unterstützen, Precision Jump,
Impressum, 404, Pilot, Anmeldung, Tester-Tor — dazu deutsche Fassungen.

## Was gefunden wurde

### Das Grundmuster: der untere Anschlag eines `clamp()`

Viermal dieselbe Ursache in vier verschiedenen Dateien.
`clamp(3.4rem, 14vw, 11rem)` liest sich wie „wächst mit dem Fenster", ist
aber auf **jedem** Telefon eine feste Zahl: 14vw sind bei 320 px nur
44,8 px, also gewinnt der untere Anschlag mit 61,2 px. Die vw-Komponente
derselben Formel wäre schon richtig gewesen.

| Ort | Anschlag | Folge |
|---|---|---|
| Themen-Titel (20 Seiten) | `3.4rem` = 61,2 px | „Contest / ed Zones" — Bruch mitten im Wort |
| Schiffs-Bühne | `460px` | höher als ein 390-px-Bildschirm; Schiffsname zu 28 % sichtbar |
| Missions-Titel | `1.9rem` = 34,2 px | „SURVEILLAN / CE" |
| One-Pager-Titel | `2.1rem` bei 12vw | „STORMBREA / KER" |

Dazu die statische Kandidatensuche `suche-clamp-anschlag.mjs`: 78 weitere
Formeln, deren Skalierung bei 320 px ausgehebelt ist. Nachgeschlagen sind
die sechs größten Schrift-Fälle allesamt **Zahlen oder Einzelzeichen**
(Versionsnummer, Schrittnummer, Fehlercode) — dort ist ein fester Boden
genau richtig. Die Liste sagt, **wo** die Skalierung außer Kraft ist,
nicht ob es weh tut.

### Der teuerste Einzelfund: 13.872 Seiten

Der dreistufige Brotkrumen der Item- und Bauplanseiten
(„Blueprints › Cannon › 10-Series Greatsword Cannon") brach auf schmalen
Geräten in drei Zeilen um. Weil `.dp-bar` klebt, wuchs damit die
**klebende Kopfleiste auf 171 px** — 30 % eines 320×568-Bildschirms,
dauerhaft belegt. Und trotz drei Zeilen war die letzte Stufe noch mit
Ellipse gekappt: der Umbruch hat nichts gerettet, nur Platz gekostet.

Jetzt bleibt unter 640 px nur die Elternstufe stehen — „‹ Cannon", der
Rückweg. **171 → 80 px, konstant über alle vier gemessenen Breiten.**

### Ein `<select>` bekommt keine Ellipse

Es schneidet hart ab, und der Aufklapp-Pfeil steht hinter dem Wortstumpf.
Auf `/schiffe` waren bei 320 px **6 von 7** Feldern betroffen („All
manufact⌄"), auf `/item-finder` die Sortierung („Na⌄").

**Kein Überlauf-Tor kann das finden**: `select` hat `overflow:hidden` von
Haus aus, sein `scrollWidth` ist gleich `clientWidth` — der Überstand
existiert im Kasten-Modell gar nicht. Neue Sonde
`probe-abgeschnittenes-feld.mjs` misst stattdessen die Textbreite gegen
einen unsichtbaren Klon in derselben Schrift.

### Titel rechnen nur in `vw`, nie in `vh`

Ein quer gehaltenes Telefon ist 932 px breit und 430 px hoch. 13vw sind
dort 121 px Schrift. „Tactical Strike Groups" brauchte drei Zeilen, die
dritte lag unter der Kante — der Titel der Seite war nicht zu lesen.

### Ein geschlossenes Off-Canvas ist eine Tabfalle

Die Filter-Schublade, die in diesem Durchgang gebaut wurde, ist per
`transform` weggeschoben — für den Browser aber weiterhin sichtbar
(`visibility:visible`, `pointer-events:auto`) mit voller Fokus-Reihenfolge.
Mit gedrückter Tab-Taste gemessen: der Fokus wanderte durch **elf
unsichtbare Bedienelemente bei x = −51 px**, und ein Screenreader las die
Filter als Teil der Seite vor. Heilmittel `inert`, bei jeder
Größenänderung neu bewertet.

### Die Erstbesuch-Hilfe: gemessen statt geraten

Erste Reparatur war eine feste Höhengrenze (700 px). Nachgemessen war sie
falsch — der aufgeklappte Abschnitt ist 279 px hoch und steht **zwischen**
Hero und Bedienung:

| Fenster | erste Auswahl vorher | nachher |
|---|---|---|
| 1024×768 | 815 px = 106 % | 593 px = 77 % |
| 1280×720 | 865 px = 120 % | 643 px = 89 % |
| 1440×900 | 937 px = 104 % | 715 px = 79 % |
| 1920×1080 | 937 px = 87 % | unverändert, Hilfe bleibt offen |

Eine höhere Zahl wäre wieder Raten gewesen. Jetzt klappt der Abschnitt
auf, sieht nach, ob dahinter noch Bedienung im Bild liegt, und bleibt nur
dann offen.

### Kleineres

- Tastenkappen „Ctrl K" standen auf Touchgeräten (78 px für einen Hinweis
  auf eine Taste, die es dort nicht gibt) und drückten den Platzhalter der
  Suche auf „Search i…".
- Kennzahl-Etiketten wurden mit Ellipse gekappt: „Missions that drop this
  bl…" verlor 163 px auf 13.872 Seiten. Platz nach unten war da.
- Der Fracturing-Verweis der Werkbank stand als eine Flex-Zeile; bei
  320 px klebten Titel und Aufforderung zusammen („calculatorWill it
  break?") und der Mineralname stand als „Quant…" da.
- „Datenschutzerklärung" brach als „Datenschutze / rklärung" — jetzt
  Silbentrennung, die Seite trägt `lang="de"`.

## Neues Tor: `verify:sprachpaar-css`

EN- und DE-Fassung derselben Seite müssen dieselben Media-Queries tragen,
gemessen am ausgelieferten `dist/`. **8.721 Seitenpaare**, Sperrklinke
8.000.

Anlass: derselbe Fehler zum zweiten Mal. Am 30.08. fehlte
`.tools{position:static}` in der deutschen Fassung von `/downloads`; am
31.08. blieben die Tastenkappen auf `/de.html` stehen, nachdem
`/index.html` längst repariert war — die deutsche Startseite ist eine
**eigene Quelle**, kein erzeugtes Abbild. `verify:sync` vergleicht die
Gerüstform und kann das nicht sehen.

Vorgeführt rot: eine Media-Query nur in `impressum.astro` eingefügt,
gebaut, Tor gefahren — „1 Seitenpaare mit abweichenden Media-Queries, nur
EN: @media (max-width: 481px)", Rückgabewert 1.

## Was an den Messungen selbst schiefging

Fünf Fehlmessungen, jede hätte falsche Reparaturen ausgelöst. Sie stehen
hier, weil sie die eigentliche Lehre sind.

1. **Der Mini-Server starb mitten im Lauf.** Jedes neue Messwerkzeug
   schrieb den HTTP-Header *vor* dem Lesen der Datei. Wirft `readFile`,
   ist der 200er schon raus, der catch-Zweig wirft
   `ERR_HTTP_HEADERS_SENT` — und der Node-Prozess stirbt. Der Bericht
   endet dann ohne Schlusszeile, und ein leerer Abschnitt liest sich wie
   „nichts gefunden". **Zwei Läufe über 784 Seiten sind so still
   gestorben, und ihr Schweigen wurde als Entwarnung gelesen.**
   16 Werkzeuge repariert.
2. **`el.textContent` klebt Kindelemente zusammen** — daher das
   Phantomwort „ZonesContested" (554 px) auf jeder Themenseite.
3. **`h1.getClientRects()` liefert bei Block-Kindern genau ein Rect**,
   nicht die Zeilen — daher „KEINE Zeile lesbar" für 44 von 44 Seiten,
   deren Titel im Bild vollständig zu lesen waren. Echte Zeilenkästen gibt
   nur eine Range über die Textknoten.
4. **Wortbruch nur an Leerzeichen zu trennen** meldet jedes deutsche
   Kompositum. „Salvage-Überarbeitung" stand im Bild sauber als
   „Salvage- / Überarbeitung & / Refining" — der Browser bricht auch nach
   Bindestrich.
5. **Sperrflächen:** `/archiv` wurde mit 100 % gemeldet (der dekorative
   Sternenhimmel, durchlässig und hinter allem), `/missionen` ebenso (die
   Schublade bei x = −288, ganz außerhalb). Gezählt wird jetzt nur, was
   Klicks abfängt **und** einen eigenen Grund malt **und** waagerecht im
   Bild liegt.

Dazu drei Werkzeugfallen der Umgebung: ein Python-Heredoc las `\2039` als
**Oktal** und schrieb ein Steuerzeichen ins CSS; der Git-Bash-Heredoc
frisst jeden **doppelten** Backslash; JSON-Aufträge scheitern an jedem
Regex-Backslash. Und zweimal ist eine Reparatur **still fehlgeschlagen**,
weil der Suchtext LF trug und die Datei CRLF — der Build war dabei grün,
er hatte ja nichts zu tun. Daher `ersetze2.mjs`: Suche und Ersatz in
reinen Textdateien, CRLF-sicher, mit lautem Abbruch.

## Was offen bleibt — Entscheidungen des Betreibers

- **id 60 — Hero-Höhe auf flachen Fenstern.** Nach dem Umbau der
  Erstbesuch-Hilfe ist bei 1280×720 und 1024×768 auf allen fünf
  Werkzeugseiten die erste Bedienung im Bild. Auf der flachsten
  Auflösung (1181×560) bleiben zwei: `/missionen` bei 104 % (Hero
  381 px) und `/evolution` bei 104 % (Hero 294 px plus 79 px Luft
  darüber). Der Hero ist bereits auf Inhaltsmaß geschrumpft — weiter
  geht es nur, indem Titel, Beschreibungszeile oder Kennzahlenreihe auf
  flachen Fenstern wegfallen. **Welches, ist Gestaltung.**
- **id 61 — Länge der Katalogseiten am Telefon** (unverändert).
- **id 63 — sehr breite Schirme.** Bei 2560×1440 ist die Inhaltsspalte
  auf rund 1060 px begrenzt und zentriert; je rund 470 px bleiben leer,
  das Kartenraster zeigt vier Spalten, wo sechs Platz hätten. Eine
  Höchstbreite ist eine Lesbarkeitsentscheidung — ob **Karten** (keine
  Fließtextzeilen) sie mitmachen müssen, ist Gestaltung.
- **id 64 — zwei bewusst gekappte Kurzformen** (`.fcard__sig` auf
  Schiffskarten, `.wb__ghd__g` in der Werkbank). Beides Aufzählungen ohne
  feste Länge; Umbruch machte Karte bzw. Kopfzeile höher.

## Nicht abgedeckt

- **Angemeldete Ansichten.** Alles wurde als Gast geprüft;
  `/account`, `/refinery` und `/pilot` zeigen dann die Anmeldeseite. Die
  kontogebundene Oberfläche ist ungeprüft — `account-dossier.css` steht
  mit drei Einträgen auf der clamp-Kandidatenliste.
- **Echtes iOS Safari.** Gemessen wurde Chromium mit iPhone-Maßen und
  Touch-Emulation.
- **Hellmodus** (wird laut Betreiber nicht mehr gebaut).
- **Bildpunktvergleich.** „Text auf Text" bleibt eine Lücke: das DOM weiß,
  wo ein Kasten liegt, nicht wo eine Glyphe gemalt wird. Drei Anläufe
  ergaben 47/28/11 Meldungen, davon nachgesehen null echte.
