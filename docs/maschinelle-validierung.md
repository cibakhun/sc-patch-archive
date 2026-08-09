# Maschinelle Validierung — Konzept und Umsetzungsweg

> **Referenzdokument in zwei Teilen.** Teil I ist das Konzept: was maschinelle
> Validierung für dieses Projekt bedeutet, welche Bausteine es gibt, welche
> davon hier Sinn ergeben — und welche ausdrücklich nicht, mit Begründung.
> Teil II ist der daraus abgeleitete Umsetzungsweg in Stufen. Der Anhang ist
> die Messgrundlage: am 09.08.2026 wurde auf `46ba9e3` (= `origin/staging`)
> ein frischer Build gefahren und **jeder vorhandene Prüfer einzeln
> ausgeführt und gestoppt** — jede Zahl im Dokument stammt von dort oder aus
> einer benannten Datei, nichts ist geschätzt.

---

# Teil I — Konzept

## 1) Was „maschinelle Validierung" hier bedeutet

**Definition für dieses Projekt:** Jede Prüfung, die eine Maschine ohne
menschliches Zutun ausführen kann und die mit einem harten Ja/Nein endet —
und zwar so verankert, dass sie *von selbst* läuft, nicht wenn jemand daran
denkt.

Die Abgrenzung ist wichtiger als die Definition:

- **Maschinelle Validierung ≠ Tests schreiben.** Das Projekt hat bereits
  ~7.300 Zeilen Prüfcode (17 verify-/audit-Skripte, 234 e2e-Tests). Der
  Messlauf zeigt: Das Problem ist nicht die Menge, sondern dass die Hälfte
  davon an keinem Tor hängt (§ 2).
- **Maschinelle Validierung ≠ Sichtprüfung.** „Trägt das Motiv noch", „liest
  sich als ein Bewegungsbild" entscheidet kein Skript. Der bestehende Prozess
  (benannte Sichtpunkte in `.planning/WINDOWS.md`, Phase erst nach Abnahme
  „Complete") bleibt — Maschinen machen Sichtrunden seltener nötig und besser
  vorbereitet, nie überflüssig.
- **Ein Tor ist mehr als ein Test.** Ein Test stellt fest; ein Tor
  *verhindert* — hier konkret: schlägt ein Prüfer im Docker-Build fehl,
  entsteht kein Image, und Coolify liefert weiter den letzten guten Stand.
  Damit ein Tor das leisten kann, braucht es Eigenschaften, die ein Test
  nicht braucht: Exit-Disziplin, Fehlalarm-Doktrin, Laufzeitbudget,
  Umgebungsverträglichkeit (§ 4).

**Wogegen richtet sich das Konzept?** Gegen vier Ausfallklassen, die alle
bereits real aufgetreten sind (Belege in § 2):

| Klasse | Kurzform |
|---|---|
| K1 | Ein Prüfer existiert, läuft aber nicht — Befunde bleiben unentdeckt |
| K2 | „HTML korrekt, Browser macht trotzdem etwas anderes" — kein Tor sieht den Browser |
| K3 | Ein Datenlauf verkleinert oder veraltet den Bestand, still |
| K4 | CI grün, aber die ausgelieferte Seite zeigt einen anderen Stand |

Und gegen den eigentlichen Anlass dahinter: **Die Seite wächst, viele
parallele KI-Sitzungen liefern in schwankender Qualität, und der Betreiber
kann nicht mehr alles selbst testen.** Das Gedächtnis des Betreibers ist
heute die Ressource, an der die Prüfkette hängt — und die bei Parallelbetrieb
garantiert reißt. Maschinelle Validierung ersetzt „daran denken" durch
„läuft immer".

## 2) Problemstellung: der gemessene Ist-Stand

Kurzfassung des Anhangs — was am 09.08.2026 auf einem frischen Checkout
tatsächlich vorlag:

**Vorhanden und gut:** Ein hartes Auslieferungs-Tor mit neun Prüfern im
Docker-Build ([Dockerfile:66](../Dockerfile)), alle grün, Kette ≈ 76 s.
Darunter Prüfer, die es in dieser Qualität selten gibt: WCAG-Kontrast aus
echter Pixel-Compositing-Rechnung über 344 Messstellen (`verify:layers`),
Gerüstgleichheit aller 8.678 EN/DE-Seitenpaare (`verify:sync`),
Skalen-Treue über 235.775 Token-Nutzungen (`verify:typo`).

**Die Schieflage:** Neun weitere Prüfer (~1.800 Zeilen) hängen an keinem Tor
— und der Messlauf bewies, was das kostet: **zwei davon waren rot, ohne dass
es jemand wusste.**

- `verify:mining` meldet einen echten **Patch-Verzug**: installierter Client
  `4.9.0-live.12344265`, sämtliche game-sourced Daten der Seite tragen noch
  `12326004`. CIG hat einen Build ausgerollt; keine Maschine hat es gemeldet.
- `verify:items` reißt an 128 Orten, die die Wiki nicht kennt — bei Ansicht
  **Wiki-Verzug** (die neuen Nyx/Pyro-Gateways), kein Fehler unserer Daten.
  Ein Prüfer, der wegen der Trägheit einer Fremdquelle rot zieht, erzeugt
  Fehlalarm-Müdigkeit.
- Nebenfund: `verify-hardpoints.mjs` hat gar keine Exit-Logik (reiner
  Bericht) und kein npm-Skript.

**Die vier Vorfälle, die die Ausfallklassen belegen:**

- **K1:** eben dieser Messlauf (2/9 rot, unbemerkt). `audit:site` — mit 589
  Zeilen der größte Prüfer, Träger der Datenherkunfts-Regel — läuft nur,
  wenn jemand den Befehl tippt.
- **K2:** WINDOWS.md id 9 (09.08.): `verify:layers` meldete „344 Messungen,
  0 unter der Marke", die Browser-Pixelmessung fand `.eyebrow` bei **1,74:1**
  im Hellmodus. Das Tor maß nicht falsch — es zählte die Stelle nicht auf.
  Dieselbe Klasse, alles dokumentierte Vorfälle: `clip-path` über
  `backdrop-filter` (840-ms-Menü), `:global()` in `is:inline` still
  verworfen, `theme.css` killt jede Scrollbar site-weit, stale
  `?v=`-Cache-Busts, klebende Filterspalte ohne `max-height`.
- **K3:** `sync:item-prices` revertete den Katalog einmal um **−834 Items**
  (319 verloren Bezugsquellen), bemerkt Wochen später. Die Gegenregel
  („`collapsedNames` nach jedem Lauf prüfen") lebt seither im Gedächtnis —
  nicht in einer Maschine.
- **K4:** `cf58c76` (08.08.): `verify:theme` rief `git` auf, im Container
  gibt es kein git, jeder staging-Build riss — und **staging lieferte
  stundenlang unbemerkt den Stand vom Vortag**. An anderem Tag hing Coolify
  20 Minuten nach „CI grün".

Strukturell dazu: `claude/*`-Zweige laufen ohne jede CI — die erste
maschinelle Rückmeldung einer Sitzung kommt erst beim Push auf `staging`,
also *nach* der Integration.

## 3) Der Bausteinkatalog: was es gibt, was hier Sinn ergibt

Das ist der Kern des Konzepts. Fünfzehn Bausteine maschineller Validierung,
jeder bewertet nach dem, was er **in diesem Projekt** fangen würde, was er
kostet (Bau + laufend + Fehlalarm-Risiko) und ob er sich lohnt. Die Urteile:
**IST** (vorhanden, weiterführen) · **JA** (bauen) · **SPÄTER** (echter
Kandidat, bewusst zurückgestellt) · **NEIN** (verworfen, mit Begründung).

### B1 — Invarianten-Prüfer gegen die Artefakte · IST

Skripte, die `dist/` und die committeten Daten-JSONs lesen und Zusicherungen
mit Soll/Ist-Zeilen prüfen — die `verify:*`-Familie. Das ist das Fundament
und zugleich die gelebte Praxis des Projekts: Jede größere Phase hat ihren
Prüfer mitgeliefert (Phase 2 → `verify:typo`, Phase 3 → `verify:layers`,
Phase 4 → `verify:sync`/`verify:theme`, Crafting → `verify:crafting` …).

**Warum diese Form hier so gut trägt:** Die Seite ist statisch gebaut — das
Artefakt ist vollständig und deterministisch, also lässt sich fast jede
Eigenschaft als Invariante über `dist/` formulieren, ohne Server, ohne
Fremddienst, ohne Flakes. Und weil gegen den *gebauten* Stand geprüft wird,
fallen auch Fehler auf, die der Build selbst erzeugt (Astro verschluckt
schließende Tags; `:global()` in `is:inline` wird still verworfen).

**Urteil: IST — weiterführen, mit der stehenden Regel, dass jede neue
Feature-Phase ihren Prüfer mitbringt.** Kein Handlungsbedarf am Baustein
selbst; der Handlungsbedarf liegt in B3 (Verkabelung).

### B2 — Das Auslieferungs-Tor im Docker-Build · IST

Prüfer als `RUN`-Schritt zwischen Build und Image: rot ⇒ kein Image ⇒ die
letzte gute Version bleibt online. Härter geht es nicht, und der Ort ist
richtig begründet (dist/ existiert dort bereits; ein separater CI-Schritt
müsste die Seite ein zweites Mal bauen).

**Die konzeptionelle Schwäche heute:** Die Torliste existiert genau einmal —
als Zeile im Dockerfile. `package.json` kennt sie nicht, lokal gibt es keinen
Begriff von „das Tor", und ein neues Prüfskript *kann* lose liegen bleiben,
ohne dass etwas meckert. Genau so sind die neun Streuner entstanden.

**Urteil: IST — behalten; die Schwäche behebt B3.**

### B3 — Tor-Registry und der eine Lieferbegriff (`npm run gate`) · JA

Der Meta-Baustein, und bei vielen parallelen KI-Sitzungen der wichtigste:
**Die Frage „welche Prüfungen gelten?" muss selbst maschinenprüfbar sein.**

Konkret: ein Registry-Modul (`scripts/lib/gate-registry.mjs`), in dem jede
Prüfstrecke mit ihrer Schiene (§ 5) und Begründung steht; ein npm-Skript
`gate`, das die kanonische Kette ist (Dockerfile ruft nur noch
`RUN npm run gate` — Dockerfile, CI und lokale Sitzung können nie wieder
auseinanderlaufen); und ein Wächter `verify:wiring`, der reißt, sobald ein
Prüfskript ohne Registry-Eintrag existiert oder ein Schiene-A-Eintrag nicht
in der Kette hängt.

Damit bekommt „fertig" erstmals eine maschinenprüfbare Bedeutung: **lieferbar
= `npm run gate` grün.** Für den Parallelbetrieb vieler Sitzungen ist das der
größte einzelne Hebel — es ersetzt „jede Sitzung erinnert sich hoffentlich an
die richtigen Befehle" durch einen Begriff.

**Kosten:** ~0,5 Tage, keine laufenden. **Fehlalarm-Risiko:** praktisch null
(prüft Listen gegen Listen). **Urteil: JA — als Erstes.**

### B4 — Kennzahlen-Sperrklinken (Bestandswächter) · JA

Konzept: **Zählbare Bestände dürfen nur bewusst schrumpfen.** Eine committete
Baseline (`data/metrics-baseline.json`) hält für jede Kennzahl Wert, Regel
(exakt / Minimum / Toleranz) und Anlass; ein schneller Prüfer
(`verify:metrics`, < 1 s) liest **ausschließlich committete Artefakte** und
vergleicht. Wächst der Bestand: nichts passiert, Baseline wird gelegentlich
per Commit nachgeführt (der Diff zeigt die Entwicklung). Schrumpft er: Tor
rot, und die einzige legitime Antwort ist ein Baseline-Commit, dessen
Botschaft die Ursache nennt.

Das Muster existiert im Projekt bereits verstreut (`MIN_MATCHED = 223` in
verify-vehicle-roles, `MIN_TOKEN_USAGES = 235775` in verify-typo) — B4
verallgemeinert es und gibt dem Bestand EINEN Ort. Die Kennzahlen liegen
längst maschinenlesbar vor (gemessen am 09.08.): `universal-items.json#counts`
(items 9.168, withObtain 4.574, withGameData 6.642, uexRows 23.705,
armorSets 136), vehicles 227, ship-components 223, vehicle-roles 223+4,
blueprints 1.594, minerals 37, hardpoints 227, dist-Seiten 17.361 (items
5.386 · missionen 1.347 · crafting 1.655 · schiffe 227 · patches 19 ·
topics 22), Sitemaps 6.

**Was es konkret verhindert hätte:** den −834-Items-Vorfall am Tag des
Commits statt Wochen später. **Urteil: JA.** (Die eine Kennzahl, die nur zur
Datamine-Zeit existiert — `counts.collapsedNames` in der unversionierten
Zwischenstufe `assets/items-gamefiles.json` — wandert als Klinke in B5.)

### B5 — Datenlauf-Validierung am Ort der Datenerzeugung · JA

Konzeptpunkt, der dieses Projekt von einer normalen Website unterscheidet:
**Ein Teil der Wahrheit existiert nur auf der Betreiber-Maschine** — die
158-GB-Data.p4k, der installierte Client (`build_manifest.id`), und freier
UEX-Zugang (UEX sperrt Rechenzentren: aus GitHub Actions 403, ein Token hilft
nicht). Prüfungen gegen diese Wahrheit können prinzipbedingt **nie** am
CI-Tor laufen. Sie brauchen ein eigenes, zweites Tor am Ort der
Datenerzeugung: `npm run gate:data`, auszuführen nach jedem
`datamine:*`/`sync:*`-Lauf.

Inhalt: `verify:items` (UEX-Vollabgleich, Wiki-Stichprobe, tote Locations),
`verify:vehicles` (frischer Extraktionslauf gegen committeten Katalog),
`verify:hardpoints` (nach Umbau: Exit-Logik statt Bericht),
`verify:mining`s Client-Abgleich (der Patch-Wecker — hätte den aktuellen
Verzug am Tag des Client-Updates gemeldet) und die `collapsedNames`-Klinke.
Dazu gehört die **festgeschriebene Patch-Tag-Reihenfolge** (Teil II, S1c) —
heute verstreutes Playbook-Wissen.

**Urteil: JA — formalisieren; fast alles existiert schon, es fehlt der
Rahmen.** Wichtige Randbedingung aus dem Messlauf: Prüfteile, die Fremdquellen
messen (Wiki-Lücken, Preis-Drift), werden WARNUNG statt FEHLER — Fremdverzug
ist kein eigener Defekt.

### B6 — Browser-Rauchtest gegen das fertige Image · JA (der einzige Neubau)

Die Antwort auf K2. Konzept: **nicht** „E2E-Suite im Browser" (B8) und
**nicht** „Screenshots vergleichen" (B7), sondern ein *Rauchtest*: die
~15 Leitseiten in echtem Chrome laden und wenige, scharfe Zusicherungen
prüfen, die genau die dokumentierte Fallenklasse treffen:

- keine unbehandelte JS-Ausnahme (`pageerror`);
- kein same-origin-Request ≥ 400 (fängt stale `?v=`-Busts, fehlende Assets);
- kein CSP-Verstoß — und zwar gegen die **echten nginx-Header**, weshalb der
  Test gegen das *fertige Docker-Image* läuft (Container starten, prüfen,
  erst dann pushen), nicht gegen `dist/`-Dateien: die CSP steht in
  [nginx/default.conf:145](../nginx/default.conf) und existiert nur im
  laufenden Container;
- Leitelement der Seite tatsächlich sichtbar (nicht nur im DOM) — fängt
  „JS stirbt still, Seite bleibt leer";
- kein horizontaler Overflow bei 360 px (die wiederkehrende Mobilfalle);
- drei, vier Interaktionsproben an den JS-schwersten Werkzeugen (Item-Finder-
  Suche filtert wirklich; Schiffe-Filter zählt runter; Hilfe öffnet);
- fünf **benannte** Pixel-Kontrast-Stichproben (das Verfahren, das id 9
  fand) — ausdrücklich Stichprobe, nicht Fläche: die Fläche gehört
  `verify:layers`, die Stichprobe ist die Bodenwahrheit dagegen.

Werkzeuglage ist günstig: `playwright-core` (~5 MB, kein Browser-Download)
plus installiertes Chrome ist als Verfahren im Projekt erprobt (Sichtprüfungs-
Harness der Phasen 2–4, samt Hellmodus-Rezept — Details in Teil II, S2);
lokal liegt Chrome unter dem Standardpfad, `ubuntu-latest`-Runner bringen es
vorinstalliert mit. Externe Requests werden abgebrochen und nicht gewertet
(CI hat keinen stabilen Weg ins Netz; Fremd-Ausfälle sind keine Site-Fehler).

**Kosten:** ~1–1,5 Tage Bau; laufend ~1–2 min je CI-Lauf.
**Fehlalarm-Risiko:** beherrschbar, weil die Zusicherungen binär sind (keine
Bild-Ähnlichkeit, keine Timing-Annahmen). **Urteil: JA — der einzige Baustein,
der neu gebaut werden muss, und der einzige Zugang zur Klasse K2.**

### B7 — Visuelle Regression (Screenshot-Vergleiche) · NEIN als Fläche

Vier Varianten, vier Urteile — die Differenzierung ist der Punkt:

| Variante | Urteil | Warum |
|---|---|---|
| Full-Page-Pixeldiffs über die Seite | **NEIN** | 17.361 Seiten, laufend absichtlicher Wandel, Font-/Antialiasing-Rauschen ⇒ Dauerrot, das keiner mehr ansieht. Bei einer designlastigen, aktiv umgebauten Seite ist das der sichere Weg in Fehlalarm-Blindheit |
| Komponenten-Snapshots (einzelne Bauteile) | **NEIN, vorerst** | dasselbe Pflegeproblem, kleiner; und die Bauteile ändern sich hier mit Absicht ständig |
| Struktur-Fingerprints statt Pixel | **GIBT ES SCHON** | `verify:sync` *ist* dieser Baustein — Tag/Klassen-Abfolge je Seitenpaar, nur über die Achse EN↔DE statt vorher↔nachher. Erkenntnis: das Bedürfnis „Struktur darf nicht unbemerkt driften" ist bereits bedient |
| Gezielte Pixel-**Messungen** (Kontrast an benannten Stellen) | **JA** | deterministisch, binär, trifft echte Vorfälle (id 9) — als Teil von B6 |

### B8 — Browser-E2E-Testsuite (Interaktionsflüsse) · NEIN als eigene Suite

Die naheliegende „große Lösung" (Playwright-Testsuite über alle Werkzeuge)
ist hier die falsche: Das Projekt hat mit der `node:vm`-Suite bereits einen
ungewöhnlich guten Ersatz — die **echten Inline-Skripte** der Seiten werden
gegen Mock-DOMs ausgeführt (234 Tests in 11 s, deterministisch, ohne
Browserstart). Was der Suite fehlt, ist nur die Browser-*Umgebung* (CSS-
Wirkung, CSP, Ladefehler) — genau das deckt B6 mit wenigen Proben. Eine
zweite, browserbasierte Verhaltens-Suite würde Pflege und Flake-Risiko
verdoppeln, ohne eine neue Fehlerklasse zu erschließen.

**Urteil: NEIN — `node:vm`-Suite weiterpflegen, Browser-Interaktion auf die
3–4 Proben in B6 begrenzen.**

### B9 — Accessibility-Automatik (axe-core o. ä.) · SPÄTER

Teilweise vorhanden: `audit:site` prüft A11y-Basics (Alt-Texte, Anker,
Sprachumschalter-Ziele), `verify:layers` den Kontrast — die zwei Klassen, in
denen hier real Fehler auftraten. Ein axe-Durchlauf im Rauchtest wäre billig
anzubauen, bringt aber vor allem ARIA-Formalia mit bekannt hoher
Fehlalarmquote. **Urteil: SPÄTER — erst wenn die Stufen 1–3 stehen; dann als
WARNUNG-Stufe im Rauchtest, nie blockierend zum Start.**

### B10 — Performance-Budgets (Lighthouse, Gewichte) · SPÄTER

Ein echter Kandidat, kein verworfener: `audit:site` warnt heute schon vor
Seitengewichten (der Messlauf zeigt die Kandidaten: 7-MB-Items-DB, Wikelo-
PNGs 1,5–1,8 MB), und ein hartes Budget je Seitenklasse wäre als Invariante
über `dist/` trivial torfähig. Zurückgestellt, weil es keine der vier
belegten Ausfallklassen trifft — es wäre ein *neues* Qualitätsziel, und neue
Ziele verwässern die Kette, solange die belegten Lücken offen sind.
**Urteil: SPÄTER, als eigene Entscheidung des Betreibers.**

### B11 — Deploy-Wächter: Build-Stempel + Frische-Prüfung · JA

Die Antwort auf K4. Konzept: Das Artefakt trägt seine Herkunft
(`dist/build.json` mit Commit-SHA — als Docker-`ARG` hereingereicht, denn im
Container gibt es kein git, daran ist cf58c76 gestorben), und ein kleiner
Prüfer (`check:staging` / `check:live`) holt die ausgelieferte `build.json`
und vergleicht mit dem erwarteten Stand. Im Workflow: nach dem
Coolify-Trigger pollen, bis die Seite den frisch gepushten SHA ausliefert —
sonst Workflow rot. Ein hängender Deploy wird damit zum sichtbaren Ereignis
statt zum stillen Zustand.

Zusatznutzen für den Sitzungsbetrieb: Die bestehende Regel „Fertig-Meldung
erst, wenn die ausgelieferte Seite den neuen Stand zeigt" wird von Handarbeit
zu einem Befehl. **Kosten:** ~0,5 Tage. **Urteil: JA.**
(Dauerhaftes synthetisches Monitoring — alle N Minuten gegen live — ist die
optionale Ausbaustufe dahinter; es liefe wegen Cloudflare-Bot-Fight-Mode am
ehesten als Windows-Task auf der Betreiber-Maschine, wofür es mit dem
Spielermarkt-Sammler bereits einen Präzedenzfall gibt. SPÄTER.)

### B12 — Zweig-CI für `claude/*` · Entscheidung des Betreibers

Würde die erste maschinelle Rückmeldung *vor* die Integration ziehen (heute:
erst auf staging). Kosten: je Push ~6–8 CI-Minuten — bei privatem Repo
zählbare Actions-Minuten, bei der aktuellen Sitzungsfrequenz der Grund, warum
das keine Selbstverständlichkeit ist. Das Gegenstück kostet nichts: eine
`CLAUDE.md` (existiert noch nicht) macht `npm run build && npm run gate` zur
Sitzungspflicht vor jedem Push. **Urteil: Sitzungsregel sofort (S3b),
Zweig-CI nur, falls danach trotzdem rote staging-Builds auflaufen.**

### B13 — Supabase-/Konto-Flüsse am Tor · NEIN

Registrierung, Anmeldung, RLS, Edge Functions: Ein Tor gegen einen echten
Fremddienst wird flaky (Netz, Rate-Limits, Testdaten-Hygiene) und bräuchte
Secrets im CI. Konto-Sichtrunden bleiben Handarbeit mit WINDOWS.md-Eintrag —
dafür gibt es den etablierten Prozess (Präzedenz id 2). Was maschinell
bleibt: die statische Seite der Konto-Ansichten läuft durch alle A-Tore, und
`refinery.html`s Abgemeldet-Umleitung prüft der Rauchtest. **Urteil: NEIN am
Tor — bewusst Handprozess.**

### B14 — KI-gestützte Validierung (LLM als Prüfer) · NEIN als Tor

Der Anlass des ganzen Konzepts ist schwankende KI-Qualität — da liegt der
Gedanke nahe, eine zweite KI als Richter einzubauen. Klare Absage als *Tor*:
Ein LLM-Urteil ist nicht deterministisch und nicht reproduzierbar; dasselbe
Artefakt kann heute rot und morgen grün sein. Das verletzt die Grundregeln
(§ 4) und würde das Vertrauen in die Kette zerstören, an dem alles hängt.

Als *Werkzeug* außerhalb der Kette (Cross-Review vor dem Merge, Code-Review-
Durchgänge) bleibt KI-Prüfung sinnvoll — aber das ist Prozess, nicht
maschinelle Validierung. **Der maschinelle Beitrag gegen KI-Varianz ist ein
anderer:** „fertig" wird maschinenprüfbar (`gate` grün + `check:staging`
grün), die Torliste wird selbst bewacht (B3), und Bestände können nicht
still schrumpfen (B4). Tore fangen die *gebrochene* Hälfte der Varianz;
die schlechte-aber-funktionierende Hälfte bleibt bei Review und Sichtrunde.

### B15 — Schema-Wächter für Daten-Artefakte · JA, mit der Spieldaten-DB

Leichte Strukturprüfung der committeten JSONs: Pflichtfelder, Typen,
erlaubte Wertebereiche — heute implizit über die Einzelprüfer verteilt.
Als eigener Baustein wird das erst mit der **nächsten großen Phase**
tragend: Die geplante Spieldaten-Datenbank soll je Feld die Herkunft
mitführen (extrahiert / kuratiert / geliehen). Diese Zusage ist nur haltbar,
wenn eine Maschine sie erzwingt — ein Schema-Wächter, der Felder ohne
Herkunftsmarke ablehnt, gehört deshalb in den Bauplan der DB-Phase, nicht
nachträglich. **Urteil: JA — als Vorgabe an die DB-Phase; bis dahin genügt
B4.** (Dieses Konzept ist damit ausdrücklich das Validierungs-Fundament, auf
dem die DB-Phase aufsetzt.)

### Zusammenfassung des Katalogs

| # | Baustein | Urteil | Klasse |
|---|---|---|---|
| B1 | Invarianten-Prüfer gegen Artefakte | IST | K1–K3 |
| B2 | Auslieferungs-Tor im Docker-Build | IST | alle |
| B3 | Tor-Registry + `npm run gate` | **JA — zuerst** | K1 |
| B4 | Kennzahlen-Sperrklinken | **JA** | K3 |
| B5 | Datenlauf-Tor `gate:data` | **JA** | K3 |
| B6 | Browser-Rauchtest gegen das Image | **JA — einziger Neubau** | K2 |
| B7 | Visuelle Regression (Pixeldiffs) | NEIN als Fläche; Kontrast-Stichproben in B6 | (K2) |
| B8 | Browser-E2E-Suite | NEIN — `node:vm`-Suite + B6-Proben | (K2) |
| B9 | A11y-Automatik (axe) | SPÄTER | — |
| B10 | Performance-Budgets | SPÄTER | — |
| B11 | Build-Stempel + Deploy-Frische | **JA** | K4 |
| B12 | Zweig-CI | Betreiber-Entscheid; Sitzungsregel sofort | K1 |
| B13 | Supabase-Flüsse am Tor | NEIN — Handprozess | — |
| B14 | LLM als Prüfer | NEIN als Tor; Review-Werkzeug ja | — |
| B15 | Schema-/Herkunfts-Wächter | JA — mit der Spieldaten-DB-Phase | K3 |

## 4) Grundsätze für jedes Tor

Destillat aus der eigenen Prüf-Kultur des Projekts (jeder Punkt hat dort
bereits eine Fundstelle) plus den bezahlt gelernten Umgebungsregeln. Diese
sieben Regeln sind die Abnahme-Checkliste für alles, was in Teil II gebaut
wird:

1. **Vorgeführt rot.** Jedes Tor wird mit einer ausgeführten Negativkontrolle
   abgenommen (welcher Bruch, welche Meldung — protokolliert), nicht mit
   einer behaupteten. Hintergrund: `verify-help` meldete einmal grün, nachdem
   jedes `data-help` gelöscht war.
2. **Selbstauskunft der Prüfmenge.** Das Tor druckt, wie viele Einheiten es
   geprüft hat, und reißt, wenn die Zahl unter die Klinke fällt — ein
   leerlaufender Wächter ist sonst von einem echten nicht zu unterscheiden
   ([verify-weapon-sizes.mjs:26](../scripts/verify-weapon-sizes.mjs)).
3. **FEHLER blockt, WARNUNG nicht — und Fehlalarme sind teurer als Lücken.**
   Ein Befund wird erst FEHLER, wenn die Handlungsanweisung dahinter immer
   richtig ist. Fremdquellen-Verzug ist nie FEHLER
   ([audit-site.mjs:33](../scripts/audit-site.mjs): „Wer zweimal einem
   FEHLER nachgeht, der keiner war, sieht beim dritten Mal weg").
4. **Torfähigkeit vor Verkabelung.** Für Schiene A vorab belegen: kein
   `git`-Aufruf (cf58c76), kein Netz (UEX-Sperre), kein p4k-/Client-Zugriff
   (oder best-effort mit `existsSync`-Gatter wie in verify-mining),
   deterministisch, Laufzeit gemessen und im Budget.
5. **Sperrklinken statt Momentwerte.** Untergrenzen wandern nur nach oben;
   nach unten nur per Commit, dessen Botschaft die Ursache nennt.
6. **Ausnahmen benannt, mit Zombie-Wächter.** Jede Ausnahme trägt Anlass und
   Fundstelle; verliert sie den Anlass, reißt das Tor (Muster
   `sync-exclusions.mjs`; `EXCLUSIONS` in verify-theme ist seit 09.08. leer —
   Ausnahmen sind Schulden).
7. **Gegen das Artefakt prüfen, so spät wie möglich — und wissen, welches.**
   `dist/` statt Quelle; das laufende Image statt `dist/`, wo es um
   Header/Rewrites geht (B6); die ausgelieferte Seite statt des Images, wo es
   um Deploy geht (B11). Dazu, seit dem 09.08.2026 teuer gelernt: **es gibt
   zwei Artefakte.** Der Live-Build und der Vorschau-Build (`STAGING=1`)
   unterscheiden sich in der SEO-Oberfläche, und das reicht, damit dieselbe
   Kette lokal grün und in CI rot ist. Ein Tor muss deshalb sagen, woran es
   grün war (`npm run gate` nennt es in der Kopfzeile), und wer Tore oder SEO
   anfasst, baut vor dem Push einmal mit `STAGING=1`.

## 5) Zielarchitektur: drei Schienen, ein Register

Jede Prüfstrecke gehört genau **einer Schiene** an; die Zuordnung steht
maschinenlesbar in der Registry (B3) und wird von `verify:wiring` erzwungen —
„ein Skript liegt lose herum" ist damit selbst ein roter Befund.

```
SCHIENE A — Auslieferung (jeder Push staging/main; auch lokal: npm run gate)
  Sitzung ──► npm run gate ──► push ──► CI-Docker-Build
                                          ├─ RUN npm run gate        rot ⇒ kein Image
                                          ├─ Rauchtest gegen Image   rot ⇒ kein Push   (B6)
                                          └─ push ghcr ──► Coolify
SCHIENE B — Datenlauf (lokal, wo p4k/Client/UEX existieren)
  datamine:* / sync:* ──► npm run gate:data                          (B5)
SCHIENE C — Deploy (gegen die ausgelieferte Seite)
  nach Deploy ──► npm run check:staging  (SHA der Seite == erwarteter SHA)  (B11)
```

Umgebungsregeln je Schiene (alle bereits bezahlt gelernt): Schiene A ohne
git/Netz/p4k, deterministisch, Budget heute 76 s → Ziel ≤ ~3 min inklusive
aller Neuzugänge. Schiene B darf alles, läuft aber nur dort, wo die Wahrheit
liegt. Schiene C fragt ausschließlich die ausgelieferte Seite.

**Mensch bleibt vierte Instanz:** Sichturteile laufen unverändert über
`.planning/WINDOWS.md` (benannte Punkte, Abnahme durch den Betreiber). Die
Schienen liefern ihr die Vorarbeit — sortierte Verdachtslisten statt „schau
mal alles durch".

---

# Teil II — Umsetzungsweg

Drei Stufen, jede für sich lieferbar, zusammen grob 4–5 Arbeitstage. Jeder
Schritt gilt erst als fertig, wenn die sieben Grundsätze aus § 4 belegt sind
(insbesondere: Negativkontrolle vorgeführt, Selbstauskunft vorhanden) und
die Lieferung auf `staging` liegt.

> ## Stand der Umsetzung
>
> | Schritt | Stand |
> |---|---|
> | S1a Registry + `npm run gate` + `verify:wiring` | ✅ **gebaut** 09.08.2026 |
> | S1b Streuner ans Tor | ✅ **gebaut** 09.08.2026 — fünf von sechs |
> | S1d Kennzahlen-Sperrklinke `verify:metrics` | ✅ **gebaut** 09.08.2026 — 19 Kennzahlen, 0,3 s |
> | S1c `gate:data` | 🟡 **teilweise** — Schiene existiert und läuft; `verify:hardpoints` und die Patch-Tag-Reihenfolge stehen aus |
> | S2 Browser-Rauchtest | ✅ **gebaut** 09.08.2026 — 47 Aufrufe, 239 Punkte, ~28 s |
> | S3 Build-Stempel + `check:staging` + `CLAUDE.md` | ✅ **gebaut** 09.08.2026 |
>
> **Gemessen nach S1a/S1b** (`npm run gate`, frischer Build, 09.08.2026):
> 16 von 16 Schritten grün in **156,9 s** — die Vorhersage lag bei ~165 s.
> Das Tor umfasst jetzt 15 scharfe Strecken statt neun; `verify:mining` ist
> die sechzehnte und steht als **Schuldenposten** im Verzeichnis, weil der
> Patch-Verzug es lokal rot zieht (nie ein rotes Tor scharfschalten). Der
> Posten wird bei jedem Lauf gedruckt und kann nicht in Vergessenheit geraten.
>
> **Acht Negativkontrollen vorgeführt** (Grundsatz 1), jede mit Exit 1 und
> anschließend grünem Rückbau:
>
> | Probe | Bruch | Meldung |
> |---|---|---|
> | NK-1 (Z1) | `scripts/verify-probe.mjs` angelegt | „hat keinen Eintrag in scripts/lib/gate-registry.mjs" |
> | NK-2 (Z2) | `verify:fx` in package.json umbenannt | „nennt npm-Skript `verify:fx` — package.json kennt es nicht" |
> | NK-3 (Z4) | `node:child_process` in `verify-fx.mjs` importiert | „berührt Kindprozess, aber der Verzeichnis-Eintrag erklärt es nicht" |
> | NK-4 (Z4) | `env: 'git: …'` an einem Eintrag ohne git-Aufruf | „die Umgebungsmarke nennt git, im Skript kommt es nicht mehr vor — Zombie-Marke" |
> | NK-5 (Z3) | `gate` auf `--rail C` umgebogen | „package.json#gate fährt eine fremde Schiene — das Auslieferungs-Tor ist Schiene A" |
> | NK-M1 | Baseline `fahrzeuge: 228` | „227 statt genau 228 — Änderung nur per bewusstem Baseline-Commit" |
> | NK-M2 | Baseline-Zeile `minerale` gelöscht | „wird gelesen, hat aber keine Baseline-Zeile — ungeprüft ist schlimmer als ungemessen" |
> | NK-M3 | Ableser auf eine nicht existierende Datei gezeigt | „Quelle nicht lesbar … das ist keine Schrumpfung, sondern ein kaputter Ableser" |
>
> Eine neunte ergab sich **ungeplant und ist der beste Beleg von allen**:
> `verify:wiring` meldete das frisch angelegte `verify-metrics.mjs` von selbst,
> bevor es einen Registry-Eintrag hatte — der Wächter fing den eigenen
> Bauvorgang. Genau das ist der Zustand, den es künftig verhindern soll.
>
> **Zwei eigene Fehler, die dabei auffielen und behoben wurden** — beide von
> derselben Sorte, gegen die das Verfahren gebaut ist (etwas meldet grün,
> ohne etwas zu prüfen):
>
> 1. `run-gate.mjs` meldete für eine **leere Schiene** „Tor GRÜN —
>    vollständig bestanden", weil 0 von 0 Schritten fehlschlugen. Schiene C
>    ist heute leer; eine versehentlich leergeräumte Registry hätte dasselbe
>    bewirkt. Jetzt: Abbruch mit „es wurde NICHTS geprüft. Das ist kein
>    bestandenes Tor."
> 2. `verify-wiring` prüfte zwar, dass `gate` über die Registry fährt, aber
>    nicht, **welche Schiene** — `gate` ließ sich unbemerkt auf eine andere
>    umbiegen, und das Dockerfile hätte still etwas anderes geprüft.
>
> Nachgezogen: `README.md` und `docs/astro-7-migration.md` führten je eine
> eigene, mit dem Dockerfile **nicht** deckungsgleiche Prüfkette — beide
> zeigen jetzt auf `npm run gate`.
>
> ### Stufe 2 gebaut — und sie hat sofort einen Fehler gefunden
>
> `scripts/browser-smoke.mjs` (playwright-core + installierter Chrome, **kein**
> Browser-Download) lädt 15 Leitseiten je EN und DE in drei Varianten:
> **47 Aufrufe, 239 Einzelpunkte, ~28 s.** Verdrahtet in `deploy-staging.yml`
> als eigene Schiene C — gebaut wird jetzt mit `load: true`, dann läuft der
> Container, dann der Rauchtest, und **erst nach bestandener Prüfung wird
> gepusht**. Grund: die CSP ist ein nginx-*Header* und existiert nur im
> laufenden Container; `dist/` als Dateibaum kann sie nicht zeigen.
>
> **Erster echter Fund — gefunden und behoben:** Die **deutsche** Patch-Seite
> lief bei 360 px Fensterbreite **31 px über**, die englische nicht
> (`body.scrollWidth` 391 gegen 356). Genau die Klasse, die kein bestehendes
> Tor sehen konnte — `verify:sync` vergleicht die Gerüst*struktur* der
> Sprachpaare, nicht ihre gerenderte Breite.
>
> Die Ursache wurde **gemessen, nicht geraten** (Abschnitte einzeln
> ausgeblendet, bis die Breite fiel): Die Manifest-Zeile ist ein Flex-Streifen
> aus Marke, Bauteilname und Beschreibung. Ohne Umbruch quetscht Flex das
> `<small>` auf 75 px; „Maschendrahtzaun" braucht als Wort 129 px und lief aus
> dem Kasten. Weil das Elternraster `min-width: auto` hat, wuchs der ganze
> Kasten auf die Mindestinhaltsbreite (368 px) und ragte über den Bildschirm.
>
> Behoben mit **einer Zeile** — `@media(max-width:600px){.manifest li{flex-wrap:wrap}}`:
> 391 → 360 px, und die Zeile wird dabei sogar *kürzer* (133 → 98 px), weil
> die Beschreibung eine eigene volle Zeile bekommt statt gequetscht zu werden.
> Bewusst nur bis 600 px: ab 400 px passt es ohnehin, und bei 1280 px läuft
> kein Text aus seinem Kasten — dort wäre der Umbruch eine Änderung ohne
> Anlass (nachgemessen). In DE und EN am gerenderten Bild geprüft. Die
> Ausnahme `X-de-patch-360-ueberlauf` ist damit entfallen; die Ausnahmeliste
> des Rauchtests ist wieder **leer**.
>
> **Zwei weitere hohle Zusicherungen fielen beim Vorführen auf** — beide hätte
> man ohne Grundsatz 1 nie bemerkt:
>
> 1. `documentElement.scrollWidth` kann **niemals** überlaufen, weil die Seite
>    `overflow-x: clip` auf `html` UND `body` setzt. Ein eingeschobenes
>    3000-px-Element blieb unbemerkt. → gemessen wird `body.scrollWidth`.
> 2. Der Ersatzversuch „rechte Kante des breitesten Elements" war zu scharf:
>    er ignoriert beschneidende Elternelemente und meldete das absichtlich
>    übergroße Hero-Motiv (`.hero__photo`, 1510 px) als 115-px-Überlauf — ein
>    Dauer-Fehlalarm auf jeder Seite mit Hero.
>
> Fünf Negativkontrollen vorgeführt: geworfene JS-Ausnahme (Z1), toter
> `/assets/…`-Verweis → 404 (Z2), verstecktes Leitelement (Z4), echtes
> 3000-px-Element (Z5), Ausnahme ohne Anlass (Zombie-Wächter). ⚠ Die
> Z5-Probe schlug beim ersten Anlauf **nicht** an, weil `body::after` auf
> dieser Seite bereits die fixierte Vignette ist — eine Probe über ein
> Pseudo-Element misst dort nichts.
>
> Nebenbefund, nicht behoben: die 404-Seite hat keine `main`-Landmarke (nur
> `h1`). Kleine A11y-Lücke, gehört zu `audit:site` — der Rauchtest prüft sie
> ausdrücklich nicht heimlich mit.
>
> **Zwei CI-Läufe brauchte es, und beide waren lehrreich:**
>
> 1. **Erster Lauf: 47 von 47 Aufrufen rot** — „CSP-Verstoß:
>    `script-src-elem https://stats.verse-base.com/script.js`". Kein Defekt:
>    Der Vorschau-Build leert die nginx-Map `$vb_rum_*`, damit die Vorschau
>    nicht in die Live-Statistik zählt; der Verstoß ist dort *gewollt* und im
>    Dockerfile so beschrieben. Der Rauchtest erkennt jetzt das Artefakt an
>    der gesperrten `robots.txt` und **dreht die Erwartung um**: auf der
>    Vorschau erwartet, auf Live ein FEHLER („die Besucherstatistik lädt
>    nicht"). Beide Zweige mit echten CSP-Headern belegt — Docker lief lokal
>    nicht, also über einen Prüfstand, der `nginx/default.conf` im Wortlaut
>    nachbildet und die `$vb_rum_*`-Platzhalter leer lässt wie das Dockerfile.
> 2. **Zweiter Lauf: `verify:wiring` fing den eigenen Erbauer.** Der CSP-Fix
>    hatte dem Rauchtest ein `fetch()` beigebracht (er holt `robots.txt`),
>    ohne dass der Registry-Eintrag diesen Netzzugriff nannte — Zusicherung 4
>    riss, mit genau der Meldung, für die sie gebaut wurde. Ursache dahinter:
>    Nach dem CSP-Fix wurde **`npm run gate` vor dem Push nicht erneut
>    gefahren**. Die Maschine hat die Regel durchgesetzt, an die sich der
>    Mensch nicht gehalten hat — besser kann ein Wächter seinen Zweck nicht
>    belegen.
>
> ### Stufe 3 gebaut — „ausgeliefert" ist jetzt eine Messung
>
> Bis hierher ließ sich bei Werkzeug-, Tor- oder Datenänderungen **von außen
> nicht feststellen**, ob die Seite den neuen Stand zeigt: Sie sieht identisch
> aus, und „CI grün" ist keine Antwort (siehe `cf58c76` — vier Stunden
> Vortagsstand bei grün wirkender Lage, und der 20-Minuten-Stau bei Coolify).
>
> - `scripts/_write-build-stamp.mjs` hängt am Ende von `npm run build` und
>   schreibt `dist/build.json` mit Commit-Kennung, Vorschau-Flagge und
>   Bauzeit. ⚠ Die Kennung kommt als **Docker-`ARG GIT_SHA`** herein, nicht
>   aus git: Im Build-Container gibt es weder das Programm noch ein
>   Repository — genau daran ist `cf58c76` gestorben. Lokal steht `dev`.
> - `scripts/check-deployed.mjs` (`npm run check:staging` / `check:live`)
>   holt `<base>/build.json`, vergleicht gegen `origin/staging` bzw.
>   `origin/main` und prüft zusätzlich, dass **Vorschau und Live nicht
>   vertauscht** sind. Gegen den heutigen Stand ausgeführt meldet es sauber:
>   „HTTP 404 … die ausgelieferte Fassung ist älter als der Build-Stempel" —
>   richtig, denn die läuft noch ohne ihn.
> - Beide Workflows warten nach dem Coolify-Trigger bis zu 10 Minuten, bis
>   die Domain die neue Kennung ausliefert. Ein hängender Deploy wird damit
>   zum **sichtbaren Ereignis** statt zum stillen Zustand.
>
> **Belegt am echten Deploy:** `staging` lieferte nach dem Push
> `{"sha":"984b79a…","staging":true}` aus, `npm run check:staging` meldete
> „die Seite liefert den erwarteten Stand aus ✓". Zum ersten Mal ist
> „ausgeliefert" damit eine Messung.
>
> **Drei eigene Fehler bei diesem Schritt, alle beim Vorführen gefunden:**
>
> 1. **Der Wartelauf in CI hing.** `fetch()` ohne Zeitlimit läuft nicht in
>    einen Fehler, wenn die Gegenstelle die Verbindung offen hält — der
>    Schritt stand noch, als der Deploy längst durch war. Jetzt mit
>    `AbortSignal.timeout(15000)`. Ein Tor, das hängt, ist schlimmer als
>    eines, das rot wird.
> 2. **Der Stempel wurde einen Tag lang gecacht.** Die nginx-Regel nach
>    Inhaltstyp gibt `application/json` eine Tages-Cache-Zeit — ausgerechnet
>    der Datei, die „ist es draußen?" beantworten soll. Ein Deploy-Check
>    hätte bis zu 24 Stunden den Vorgängerstand bestätigen können. Jetzt
>    `location = /build.json { expires -1; }`. ⚠ Bewusst **ohne**
>    `add_header`: das verwirft in einer `location` die Security-Header des
>    Server-Blocks — genau davor warnt der Kopf der nginx-Datei.
> 3. **„Nicht erreichbar" und „falscher Stand" waren derselbe Fehler.** In
>    CI ist Ersteres nichts, woran jemand etwas ändern kann (Cloudflare steht
>    mit Bot-Schutz davor). Der Workflow läuft deshalb mit `--weich`:
>    unerreichbar ⇒ Warnung und die ehrliche Schlusszeile „NICHT geprüft",
>    falsche Kennung ⇒ weiterhin FEHLER. Lokal bleibt die Prüfung streng.
>    Beide Betriebsarten in beide Richtungen gemessen.
> - `CLAUDE.md` (neu, im Wurzelverzeichnis) trägt die Lieferregeln, damit sie
>   jede Sitzung erreichen statt nur diese.
>
> **Dabei fiel ein Konstruktionsfehler im bestehenden `verify:theme` auf:**
> Seine dritte Zusicherung verlangte einen **komplett sauberen** Arbeitsbaum
> unter `src/` und `assets/` — sie schlug also bei jeder nicht committeten
> Änderung an. Damit wäre die frisch beschlossene Regel „vor jedem Push
> `npm run gate`" praktisch unbrauchbar gewesen: Wer gerade etwas geändert
> hat — also immer, wenn man pushen will — bekam ein rotes Tor ohne Anlass.
> Ein Fehlalarm, der genau dann zuschlägt, wenn man das Tor braucht, wird
> binnen einer Woche übergangen. Die Zusicherung vergleicht jetzt den Baum
> **vor** und **nach** dem Lauf und meldet nur, was der Wächter selbst
> verändert hat — das war ihre eigentliche Absicht.
>
> **Schiene B ist damit ebenfalls fahrbar** (`npm run gate:data`, gemessen
> 09.08.2026): `verify:items` grün in 15,8 s — die 128 Wiki-Lücken sind von
> FEHLER auf **WARNUNG** herabgestuft (Grundsatz 3: Fremdquellen-Verzug ist
> kein Befund über unsere Daten), während die harten Teile scharf bleiben
> (Negativkontrolle: erweitertes Tote-Location-Muster → Exit 1 mit 1.057
> Treffern). `verify:vehicles` hält jetzt mit einer handlungsfähigen Ansage
> („`npm run datamine:loadouts && npm run datamine:vehicles`") statt mit einem
> nackten `ENOENT` — die Zwischenstufe ist unversioniert und fehlt in jedem
> frischen Checkout, was vorher wie ein kaputtes Skript aussah statt wie ein
> noch nicht ausgeführter Arbeitsschritt.
>
> ### Der erste scharfe CI-Lauf riss — und belegte die These des Konzepts
>
> Der erste staging-Build nach dem Umbau schlug fehl: `audit:site` meldete
> dort **1 FEHLER** („Sitemap enthält keine Seiten-`<loc>`-Einträge"), lokal
> war dieselbe Kette Minuten zuvor mit **0 FEHLERN** grün.
>
> **Ursache:** CI baut mit `STAGING=1`. Dieser Vorschau-Build ist site-weit
> `noindex`, seine `robots.txt` sperrt alles, und `src/lib/sitemap.ts` leert
> Index und Teil-Sitemaps *absichtlich* — eine indexierbare Zweitkopie wäre
> Duplicate Content gegen die eigene Domain. `audit:site` kannte diesen Fall
> nicht. Es kannte ihn nicht, **weil es an keinem Tor hing und deshalb in
> seiner ganzen Lebenszeit nie gegen einen Vorschau-Build gelaufen war** —
> Lücke L1/K1, vorgeführt am eigenen Werkzeug.
>
> **Behoben** in `audit-site.mjs`, ohne die Prüfung aufzuweichen: Der
> Vorschau-Build wird am **Artefakt** erkannt (gesperrte `robots.txt` — genau
> das Signal, das `deploy-staging.yml` schon am fertigen Image prüft), nicht
> an `process.env`. Für ihn kehrt sich die Regel **um**: leere Sitemaps sind
> richtig, und beworbene URLs wären der Fehler. Der Prüfer ist damit strenger
> als vorher, nicht nachsichtiger.
>
> **Die erste Fassung dieses Fixes war hohl — und die Negativkontrolle hat es
> aufgedeckt.** Sie prüfte die beworbenen URLs weiterhin über den
> Sitemap-*Index*; im Vorschau-Build ist aber auch der Index leer, also führte
> `partPaths` nirgendwohin, und die neue Zusicherung konnte **gar nicht** rot
> werden. Eine testweise in `sitemap-pages.xml` eingeschleuste URL blieb
> unbemerkt. Die zweite Fassung liest im Vorschau-Fall **alle** `sitemap*.xml`
> direkt. Ohne Grundsatz 1 wäre eine unfälschbar grüne Zusicherung ins Tor
> gewandert — dieselbe Sorte Dekoration wie das `verify-help`, das grün
> meldete, nachdem jedes `data-help` gelöscht war.
>
> Belegt gegen **beide echten Artefakte**, in beide Richtungen:
>
> | Fall | Erwartet | Gemessen |
> |---|---|---|
> | Live-Build, unverändert | grün | Exit 0, 0 FEHLER · 30 INFOS |
> | Live-Sitemaps + Vorschau-Signal (`robots.txt` gesperrt) | **rot** | Exit 1 — „bewirbt trotzdem 17.351 URL(s)" |
> | …nach Rückbau der `robots.txt` | grün | Exit 0 |
> | Echter Vorschau-Build (`STAGING=1`), unverändert | grün | Exit 0, 0 FEHLER · **29 INFOS** — exakt der CI-Zustand |
> | Echter Vorschau-Build mit einer eingeschleusten URL | **rot** | Exit 1 — „bewirbt trotzdem 1 URL(s): sitemap-pages.xml → /probe.html" |
>
> **Zweite Lehre, allgemeiner:** „Tor lokal grün" hieß nicht „Tor in CI grün",
> weil beide gegen *verschiedene Artefakte* liefen. `npm run gate` nennt
> deshalb ab jetzt in seiner Kopfzeile, woran es geprüft hat (`Artefakt:
> Live-Build` bzw. `Vorschau-Build (STAGING=1)`), und `README.md` zeigt den
> Befehl, um den staging-Build lokal nachzustellen. Das ist derselbe
> Grundsatz 7, der Stufe 2 gegen das fertige Image prüfen lässt statt gegen
> `dist/`.
>
> **Dritter Fund, beim Beheben aufgefallen:** Der Live-Workflow hatte kein
> Gegenstück zur Vorschau-Gegenprobe. `deploy-staging.yml` belegt am fertigen
> Image, dass die Vorschau gesperrt ist — für `main` prüfte **niemand das
> Umgekehrte**. Ein Live-Build, der versehentlich mit `STAGING=1` entsteht,
> trüge eine sperrende `robots.txt` und site-weites `noindex`; er würde
> tadellos deployen und die ganze Domain aus dem Index nehmen, ohne dass
> etwas bricht. `deploy-image.yml` hat jetzt das Spiegelbild (robots nicht
> gesperrt, Startseite nicht `noindex`, Sitemap-Index nicht leer).
>
> ⚠ Beim Schreiben dieses Schritts wäre beinahe eine Shell-Falle
> hineingeraten: `grep -q … && exit 1` ist unter `bash -e` **mitten** im
> Skript harmlos, als **letzte Zeile** aber liefert es den Status 1 im guten
> Fall und reißt den Deploy. Nachgemessen und auf die `if`-Form umgestellt —
> eine Zeile, die je nach ihrer Position das Gegenteil bedeutet, gehört nicht
> in ein Tor.
>
> **Und das Tor hat funktioniert:** Es entstand kein Image, staging lieferte
> unverändert den letzten guten Stand weiter (HTTP 200 geprüft). Genau der
> Ausfallmodus, für den die Kette im Dockerfile sitzt.

## Stufe 1 — Verkabeln (≈ 1,5–2 Tage): B3 + B4 + B5

**S1a — Registry + `npm run gate` + `verify:wiring`** (B3, ~0,5 T) — ✅ gebaut

`package.json` erhält `gate` als kanonische Kette; das Dockerfile ruft nur
noch `RUN npm run gate`. Registry-Skizze:

```js
// scripts/lib/gate-registry.mjs — Schiene A/B/C je Prüfstrecke, mit Begründung
export const CHECKS = [
  { npm: 'test:e2e',        rail: 'A' },
  { npm: 'verify',          rail: 'A' },
  // … alle neun Bestands-Tore …
  { npm: 'verify:items',    rail: 'B', why: 'UEX-Netz — aus GitHub Actions gesperrt (403, IP-Block)' },
  { npm: 'verify:vehicles', rail: 'B', why: 'braucht frischen Extraktionslauf (vehicles-gamefiles.json unversioniert)' },
  { script: 'audit-typo-motion.mjs', rail: null, why: 'Erhebungswerkzeug Phase 2, kein Prüfer' },
];
```

`verify:wiring` (selbst Teil von `gate`): jedes `scripts/verify-*.mjs`/
`audit-*.mjs` hat einen Registry-Eintrag und umgekehrt; jedes A-Skript steht
in `gate`, jedes B-Skript in `gate:data`; Selbstauskunft „N Skripte, A/B/C/
Ausnahmen". Negativkontrolle: Probe-Skript anlegen → rot; A-Skript aus der
Kette nehmen → rot.

**S1b — Die sechs torfähigen Streuner in die Kette** (B1→B2, ~0,5–1 T) — ✅ gebaut (fünf scharf, `verify:mining` als Schuldenposten)

| Prüfer | heute (gemessen) | Vorarbeit |
|---|---|---|
| `verify:weapons` | ✅ 0,5 s | keine |
| `verify:vehicle-roles` | ✅ 0,4 s | keine |
| `verify:mining` | ❌ 0,5 s | **erst den Patch-Verzug per Datenlauf beheben** — nie ein rotes Tor scharfschalten; Code-Änderung nicht nötig (Client-Abgleich ist per `existsSync` best-effort und in CI still) |
| `verify:help` | ✅ 10,5 s | npm-Skript auf `--complete` heben (11/11 ist Realität) |
| `verify:fx` | ✅ 11,6 s | keine |
| `audit:site` | ✅ 64,9 s | keine — 0 FEHLER; 4 WARNUNGEN bleiben Warnstufe |

Kettenreihenfolge: Bestand unverändert vorneweg, Neues dahinter schnell →
langsam; `audit:site` als Schlusslicht (trägt als einziges die
Datenherkunfts-Regel — wird nie aus Budgetgründen entfernt). Neues Budget:
76 s + 89 s ≈ **165 s lokal**. Negativkontrolle je Neuzugang (z. B.
`data-help` löschen, Rollen-Zeile tilgen, toten Link einbauen).

**S1c — `gate:data` + Patch-Tag-Reihenfolge** (B5, ~0,5 T)

`verify:items`: Wiki-Lücken-Klasse auf WARNUNG (Messlauf-Beleg: 128 Lücken
sind Wiki-Verzug), Join-Fehler und tote Locations bleiben FEHLER.
`verify-hardpoints.mjs`: npm-Skript, Exit-Logik (Hüllen-Verwechslung
`sortDev > 30 %` — die heutigen 34 Verdachtsfälle vorher einzeln beurteilen),
stale Scratchpad-Pfad (Zeile 98) auf `.cache/` umziehen, Teil C als
„übersprungen: Ground-Truth fehlt" ausweisen. `gate:data` bricht ohne
frische Zwischenstufe mit klarer Meldung ab (Muster `_test-prereqs.mjs`)
statt still grün zu sein. Die Reihenfolge als Kopfkommentar:

```
1. Client updaten, Changelist notieren (build_manifest.id)
2. npm run datamine:items && npm run sync:items        # nie sync:item-prices allein
3. npm run datamine:crafting / :mining / :loadouts / :vehicles / :components / :vehicle-roles
4. npm run gate:data
5. npm run build && npm run gate
6. committen (Kennungs-Diff zeigt die neue Changelist), auf staging
```

**S1d — Kennzahlen-Sperrklinke** (B4, ~0,5 T)

`scripts/verify-metrics.mjs` + `scripts/lib/metrics-baseline.mjs` mit den
Ist-Werten aus § 3/B4 als Startbaseline.

> **Abweichung vom ursprünglichen Zuschnitt:** Die Baseline liegt als
> **`.mjs`-Modul neben der Registry**, nicht als `data/metrics-baseline.json`.
> Grund: Das Projekt hat für genau diese Sorte Tor-Konfiguration bereits ein
> Muster — `scripts/lib/sync-exclusions.mjs` —, und nur im Modul kann jede
> Zeile ihren **Anlass** als Fließtext mitführen. Eine nackte Zahl in einer
> JSON ist nach einem Jahr unantastbar: niemand weiß mehr, warum sie so hoch
> ist, also senkt sie auch niemand mit gutem Gewissen.

19 Kennzahlen, gemessen am 09.08.2026: Item-Katalog (`items` 9.168,
`itemsMitBezugsquelle` 4.574, `itemsMitSpieldaten` 6.642, `uexPreiszeilen`
23.705, `ruestungsSets` 136), Fahrzeuge (227 exakt, 223 mit Bauteilen, 223 mit
Rolle, 227 mit Hardpoints), Crafting/Bergbau (1.594 Blueprints, 37 Minerale)
und der gebaute Stand (17.361 Seiten gesamt, davon 5.386 Items · 1.347
Missionen · 1.655 Crafting · 227 Schiffe · 19 Patches · 22 Themen; 6 Sitemaps
exakt). Laufzeit **0,3 s** — das Tor kann damit ganz vorn stehen und einen
ausgehöhlten Datenbestand melden, bevor 150 s Prüfzeit verbrannt sind.

Zwei Eigenschaften, die es von einer bloßen Zahlenliste unterscheiden:
`null` (Quelle unlesbar) wird als **kaputter Ableser** gemeldet, nicht als
Schrumpfung — ein Ableser, der bei fehlender Datei still 0 liefert, risse
jede Klinke und wäre binnen einer Woche abgeschaltet. Und Ableser und
Baseline müssen **bijektiv** sein: eine gelesene Kennzahl ohne Regel ist
ebenso ein Fehler wie eine Regel ohne Ableser, sonst erodiert die Baseline
still.

Negativkontrolle: Baseline testweise auf 228 Fahrzeuge → rot; Kennzahl aus
der Baseline löschen → rot („Kennzahl ohne Regel").

## Stufe 2 — Sehen (≈ 1–1,5 Tage): B6

`scripts/browser-smoke.mjs` mit Seitenliste als Konfig im Kopf (Leitseiten
je EN **und** DE: Startseite, Item-Finder, Schiffe, Crafting, Archiv, eine
Patch-Seite, Mining-Thema, Missionen, Rüstungssets, Precision Jump, Support,
Downloads, Refinery-Umleitung, ein Item-Detail, der 404-Fall). Zusicherungen
Z1–Z6 wie in B6. Varianten: alles in Dunkel/1280×720; die fünf JS-schwersten
zusätzlich in 360×740 und Hell. Hellmodus ist Admin-only — das erprobte
Rezept der Sichtprüfungen, wörtlich:

```js
await page.goto(url);                       // 1. erst echter Ursprung laden
await page.evaluate(() => {
  sessionStorage.vb_user_role = '{"role":"admin"}';
  localStorage['vb.theme'] = 'light';
  localStorage['vb.help.seen'] = '{"all":1}';   // Erstbesuch-Hilfe verdeckt sonst die Messung
});
await page.reload();                        // 2. neu laden (addInitScript trifft sonst den leeren Ursprung)
await page.evaluate(() =>                   // 3. reconcile() zieht sonst nach ~200 ms zurück
  document.documentElement.setAttribute('data-theme', 'light'));
// Pflicht-Gegenprüfung: steht data-theme wirklich auf light?
```

Workflow-Umbau (deploy-staging.yml, deploy-image.yml analog): bauen mit
`load: true` statt push, Container starten, Rauchtest, **erst dann** pushen —
die robots-Gegenprobe (deploy-staging.yml:58) ist der Präzedenzfall für
„das Image selbst prüfen" und rückt hinter den Rauchtest:

```yaml
- uses: docker/build-push-action@v6
  with: { context: ., load: true, build-args: STAGING=1,
          tags: "ghcr.io/cibakhun/sc-patch-archive:staging" }
- run: docker run -d --rm -p 8080:80 --name smoke ghcr.io/cibakhun/sc-patch-archive:staging
- uses: actions/setup-node@v4
  with: { node-version: 22, cache: npm }
- run: npm ci && node scripts/browser-smoke.mjs --base http://localhost:8080
- run: docker push ghcr.io/cibakhun/sc-patch-archive:staging
```

Lokal läuft dasselbe Skript gegen `npx astro preview` oder eine URL
(`--base https://staging.verse-base.com` — dort ist der Cloudflare-RUM-Beacon
der eine erwartete CSP-Verstoß: benannte Ausnahme mit Zombie-Wächter; gegen
`verse-base.com` aus CI wäre der Bot-Fight-Mode ein Risiko, der Live-Lauf
bleibt lokal). Negativkontrolle: drei vorgeführte Brüche (geworfene
Ausnahme → Z1, toter Asset-Verweis → Z2, verstecktes Leitelement → Z4).

## Stufe 3 — Zustellen (≈ 0,5–0,75 Tage): B11 + B12b

`scripts/_write-build-stamp.mjs` am Ende der Build-Kette schreibt
`dist/build.json` (`sha` aus Docker-`ARG GIT_SHA`, Workflows geben
`${{ github.sha }}` mit; lokal `"dev"`). `scripts/check-deployed.mjs` holt
`<base>/build.json`, vergleicht, meldet Alter; npm-Skripte `check:staging`/
`check:live`. Workflow-Schritt nach dem Coolify-Trigger pollt bis N Minuten
auf den neuen SHA, sonst rot. (Zu verproben: ob Cloudflare den CI-Poll auf
die statische Datei durchlässt; falls nicht, bleibt der Poll lokal — der
Rest des Bausteins behält seinen Wert.)

Dazu die kostenlose Hälfte von B12 — eine `CLAUDE.md` im Wurzelverzeichnis:

```markdown
## Lieferregeln (maschinelle Validierung)
- Vor jedem Push auf staging: `npm run build && npm run gate` — beides grün.
- Nach Datenläufen (datamine:*/sync:*): zusätzlich `npm run gate:data`.
- Fertig-Meldung erst nach grünem `npm run check:staging`.
- Neue Prüfskripte tragen sich in scripts/lib/gate-registry.mjs ein — verify:wiring erzwingt das.
- Jedes neue Tor wird vorgeführt rot (Negativkontrolle im Summary protokolliert).
```

## Reihenfolge und offene Entscheidungen

| Schritt | Aufwand | hängt an |
|---|---|---|
| S1a Registry + gate | 0,5 T | — |
| S1b Streuner ans Tor | 0,5–1 T | S1a; `verify:mining` erst nach Datenlauf |
| S1c gate:data + Patch-Tag | 0,5 T | S1a (Anlass: aktueller Patch-Verzug) |
| S1d Kennzahlen-Klinke | 0,5 T | S1a |
| S2 Browser-Rauchtest | 1–1,5 T | S1a |
| S3 Build-Stempel + CLAUDE.md | 0,5–0,75 T | — |

Beim Betreiber liegen drei Entscheidungen: **(1)** `audit:site` mit seinen
65 s ans Auslieferungs-Tor (Empfehlung: ja — es ist der einzige Träger der
Datenherkunfts-Regel); **(2)** Zweig-CI ja/nein (B12 — Empfehlung: erst
CLAUDE.md-Regel, CI nur bei Bedarf); **(3)** Zeitpunkt des Datenlaufs gegen
Client `12344265` (unabhängig vom Konzept fällig; S1b wartet an einer Stelle
darauf).

---

# Anhang — Messlauf vom 09.08.2026

Umgebung: Windows 11, Node 22.18, frischer Worktree auf `46ba9e3`
(= `origin/staging`), `npm ci` 8 s, `npm run build` 114 s (Astro-Anteil
81,45 s; 17.361 HTML-Dateien in `dist/`). Reihenfolge wie ausgeführt:

| Prüfer | Tor? | Exit | Laufzeit | Kernbefund |
|---|---|---|---|---|
| `test:e2e` | ja | 0 | 11,1 s | 234/234 Tests, 44 Suiten |
| `verify` | ja | 0 | 12,5 s | 0 gebrochene Verweise |
| `verify:vendor` | ja | 0 | 0,5 s | three.js deckungsgleich |
| `audit:csp` | ja | 0 | 10,8 s | 10 externe Quellen, alle abgedeckt |
| `verify:crafting` | ja | 0 | 1,3 s | Chips == Spieldaten, Kollisionssperre hält |
| `verify:typo` | ja | 0 | 12,3 s | 6/6 Zusicherungen, Klinke 235.775 |
| `verify:layers` | ja | 0 | 12,9 s | 7/7, 344 Messstellen |
| `verify:sync` | ja | 0 | 12,0 s | 0 unerklärte Abweichungen / 8.678 Paare |
| `verify:theme` | ja | 0 | 1,7 s | 0 Handänderungen, EXCLUSIONS leer |
| `audit:site` | **nein** | 0 | 64,9 s | 0 FEHLER, 4 WARNUNGEN (u. a. Wikelo-PNGs 1,5–1,8 MB), 30 INFOS |
| `verify:fx` | **nein** | 0 | 11,6 s | 7/7 über 8.678 Paare |
| `verify:help --complete` | **nein** | 0 | 10,5 s | 11/11 Werkzeuge, 6 Zusicherungen |
| `verify:weapons` | **nein** | 0 | 0,5 s | Selbstauskunft gedruckt, 0 Abweichungen |
| `verify:vehicle-roles` | **nein** | 0 | 0,4 s | 223 ≥ Klinke 223 |
| `verify:mining` | **nein** | **1** | 0,5 s | **Datenstand 12326004 ≠ installierter Client 12344265** |
| `verify-hardpoints.mjs` | **nein** | 0* | 0,1 s | *ohne Exit-Logik; Bericht: 34 Hüllen-Verdachtsfälle, 66 Komponenten-Abweichungen/126, Teil C übersprungen (stale Pfad) |
| `verify:items` | **nein** | **1** | 13,4 s | 23.679 Zeilen identisch, 26 Drifts, 0 tote Locations, **128 Orte fehlen im Wiki** (Wiki-Verzug → WARNUNG-Kandidat, S1c) |

Nicht lauffähig ohne frischen Extraktionslauf: `verify:vehicles`
(`vehicles-gamefiles.json` ist unversioniert). Erhebungswerkzeug ohne
Prüf-Charakter: `audit-typo-motion.mjs`.

Prüfcode-Bestand **zum Zeitpunkt der Messung**: 17 verify-/audit-Skripte =
4.438 Zeilen; e2e-Suite samt Helfern, `_verify.mjs` und `_test-prereqs.mjs` =
2.847 Zeilen. (Noch am selben Tag kamen `verify-wiring.mjs` und
`verify-metrics.mjs` dazu — 19; die Klinke `MIN_SCRIPTS` in verify-wiring
führt diese Zahl fort.)

Reproduktion: `npm ci && npm run build`, dann die Befehle der Tabelle.
`verify:items` braucht freien UEX-Zugang (nicht aus GitHub Actions),
`verify:mining`s Client-Abgleich die lokale Spielinstallation.
