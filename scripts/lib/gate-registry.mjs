/* ============================================================
   gate-registry.mjs — EIN Verzeichnis aller Pruefstrecken.

   WARUM ES DEN GIBT: Bis zum 09.08.2026 existierte die Torliste genau
   einmal — als RUN-Zeile im Dockerfile. `package.json` wusste nichts von
   ihr, lokal gab es keinen Begriff von "dem Tor", und ein neues
   Pruefskript konnte lose liegen bleiben, ohne dass irgendetwas meckert.
   Genau so sind neun Pruefer entstanden, die an keinem Tor hingen; ein
   Messlauf am 09.08.2026 fand zwei davon ROT, ohne dass es jemand wusste
   (verify:mining meldete einen echten Patch-Verzug, verify:items einen
   Wiki-Verzug). Konzept: docs/maschinelle-validierung.md, Baustein B3.

   Diese Datei ist ab jetzt die Wahrheit. `scripts/run-gate.mjs` fuehrt
   aus, was hier steht (`npm run gate` / `npm run gate:data`), und
   `scripts/verify-wiring.mjs` haelt Verzeichnis, Dateibestand und
   package.json deckungsgleich. Ein Pruefskript ohne Eintrag ist damit
   selbst ein roter Befund.

   SCHIENEN (docs/maschinelle-validierung.md, § 5):
     A  Auslieferung — laeuft im Docker-Build vor dem Image und lokal vor
        jedem Push. Harte Umgebungsregeln: kein git, kein Netz, keine
        Data.p4k, deterministisch. Rot ⇒ kein Image ⇒ der letzte gute
        Stand bleibt online.
     B  Datenlauf — laeuft lokal auf der Betreiber-Maschine, wo Data.p4k,
        installierter Client und freier UEX-Zugang existieren. Diese
        Pruefungen koennen prinzipbedingt NIE in CI laufen (UEX sperrt
        Rechenzentren: 403, ein Token hilft nicht).
     C  Deploy — fragt die ausgelieferte Seite, nicht den Code.
     null  Werkzeug, kein Pruefer. Braucht `why`.

   FELDER:
     id        Anzeigename (= npm-Skript, wo es eins gibt)
     npm       npm-Skript; run-gate loest daraus den echten Befehl auf
     script    die Datei (Bijektionspruefung in verify-wiring)
     rail      'A' | 'B' | 'C' | null
     checks    was es prueft, in einem Satz
     env       PFLICHT, sobald ein Schiene-A-Skript git/Kindprozess/Netz
               beruehrt: wie ist es gegattert? Faellt das Muster im
               Skript weg, ist die Marke ein Zombie und das Tor reisst
               (verify-wiring Zusicherung 4). Anlass: cf58c76 — ein
               ungegatterter git-Aufruf riss am 08.08.2026 jeden
               staging-Build, und staging lieferte knapp vier Stunden
               still den Vortagsstand aus.
     disabled  Grund, warum diese Strecke MOMENTAN nicht scharf ist.
               Wird bei JEDEM Lauf als Schuldenposten gedruckt — ein
               ausgesetztes Tor darf nicht in Vergessenheit geraten.
     why       Begruendung fuer rail: null
   ============================================================ */

export const CHECKS = [
  // ---------------------------------------------------------------
  // Schiene A — das Auslieferungs-Tor.
  // Reihenfolge = Laufreihenfolge: erst der Meta-Waechter, dann der
  // Bestand in seiner gewachsenen Ordnung (vertraut, schnellste
  // Diagnose), dann die Neuzugaenge schnell -> langsam.
  // ---------------------------------------------------------------
  {
    id: 'verify:wiring',
    npm: 'verify:wiring',
    script: 'scripts/verify-wiring.mjs',
    rail: 'A',
    checks: 'Verzeichnis, Dateibestand und package.json sind deckungsgleich; kein Pruefskript liegt lose herum',
  },
  {
    id: 'verify:metrics',
    npm: 'verify:metrics',
    script: 'scripts/verify-metrics.mjs',
    rail: 'A',
    checks:
      'die Bestandszahlen (Items, Fahrzeuge, Blueprints, Wikelo-Vertraege und -Warenposten, gebaute Seiten je Bereich, Sitemaps) liegen ueber ihren Klinken — ein Datenlauf darf den Bestand nicht still verkleinern',
  },
  {
    id: 'test:e2e',
    npm: 'test:e2e',
    script: 'tests/e2e/',
    rail: 'A',
    checks: 'Verhalten der echten Inline-Skripte gegen ein Mock-DOM (node:vm) plus Integritaet der Item-DB',
  },
  {
    id: 'verify',
    npm: 'verify',
    script: 'scripts/_verify.mjs',
    rail: 'A',
    checks: 'jede lokale href/src/url() in dist/ zeigt auf eine Datei, die es gibt',
  },
  {
    id: 'verify:vendor',
    npm: 'verify:vendor',
    script: 'scripts/verify-vendor-three.mjs',
    rail: 'A',
    checks: 'das handkopierte three.js passt zur devDependency und ist Datei fuer Datei (SHA-256) bitgleich zu node_modules/three, bis auf benannte Korrekturen',
  },
  {
    // Direkt nach verify:vendor — beide betreffen die Herkunft fremden Codes.
    // Liest .github/ mit: deshalb steht .github NICHT mehr in .dockerignore.
    id: 'verify:supply-chain',
    npm: 'verify:supply-chain',
    script: 'scripts/verify-supply-chain.mjs',
    rail: 'A',
    checks: 'Pakete nur von registry.npmjs.org mit sha512, Actions per Commit-SHA und Basis-Images per Digest angeheftet, jeder Workflow mit eigenen Rechten und Checkouts ohne hinterlegtes Token, kein Compiler im Bot-Laufzeit-Image, Dependabot zieht alles nach',
  },
  {
    id: 'audit:csp',
    npm: 'audit:csp',
    script: 'scripts/audit-csp.mjs',
    rail: 'A',
    checks: 'die Content-Security-Policy in nginx/default.conf deckt alles ab, was der Build wirklich laedt — eine zu enge CSP bricht nicht beim Deploy, sondern still im Browser des Besuchers; dazu: jedes ausgefuehrte Inline-Skript aus dist/ hat seinen Hash in der Richtlinie, wie nginx sie mit den include-Dateien aus dist/_csp/ ausliefert, script-src ohne \'unsafe-inline\', \'unsafe-eval\', * und reine Schema-Quellen, jeder Inline-Handler ist eine benannte Ausnahme (Zombie-Waechter), jede Seite mit data-img-fail traegt den Bild-Hoerer davor, der Zaehl-Host steht nur in connect-src, und kein add_header ausserhalb des server-Blocks oder ohne always',
  },
  {
    // Direkt nach audit:csp — beide betreffen nginx/default.conf.
    id: 'verify:gate',
    npm: 'verify:gate',
    script: 'scripts/verify-gate.mjs',
    rail: 'A',
    checks:
      'die Ausnahmeliste des Testpilot-Tors (nginx/default.conf, GATE-AUSNAHME-Zeilen) traegt jeden Anlass, deckt genau das, was dist/gate.html anfordert, hat keinen erfundenen Eintrag, die Torseite bleibt ungepaart und ohne /_astro/-Buendel, nginx/gate.js traegt kein eingebautes Geheimnis, der $vb_gate_on-Schalter steht in der Form, auf die der Dockerfile-sed zielt, jeder location-Block fragt das Tor ab, ist eine benannte Ausnahme oder leitet nur weiter, und die Vorschau sendet Cache-Control private ohne eigenes add_header in einer location (D-06, D-09, D-12)',
    // Kein env-Feld: kein git, kein Netz, kein Kindprozess — liest
    // ausschliesslich dist/ und die beiden nginx-Dateien als Text.
  },
  {
    // Direkt nach verify:gate — dieselben beiden nginx-Dateien.
    id: 'verify:redirects',
    npm: 'verify:redirects',
    script: 'scripts/verify-redirects.mjs',
    rail: 'A',
    checks:
      'jede Weiterleitung in nginx/default.conf bleibt auf dieser Seite: server-weiter Riegel gegen Steuerzeichen und Rueckstriche, keine roh eingesetzte Pfadvariable, jedes umleitende rewrite gegen eine Angriffsliste nachgespielt, die alte /en/-Adresse jeder gebauten Seite leitet auf sie, und $vb_next ist prozentkodiert und gibt die angefragte Adresse samt Query zurueck, auch nach einem internen rewrite wie /pilot/<handle> (gate.next in node:vm ausgefuehrt)',
    // Kein env-Feld: kein git, kein Netz, kein Kindprozess — liest
    // dist/ (nur die Dateinamen) und die beiden nginx-Dateien als Text.
  },
  {
    // Direkt nach verify:gate, weil beide dasselbe Muster haben: sie messen
    // eine Datei, die voellig normal AUSSIEHT, waehrend ein Werkzeug an ihr
    // scheitert.
    id: 'verify:windows',
    npm: 'verify:windows',
    script: 'scripts/verify-windows.mjs',
    rail: 'A',
    checks:
      '.planning/WINDOWS.md bleibt fuer gsd-tools lesbar — geprueft mit gsd-cores EIGENEM parseLedger (keine zweite, nachgebaute Auslegung), dazu die drei Muster, die es am 20.08.2026 je einmal zerlegt haben: kind "sight" (kein gueltiger Wert), CRLF (bricht die Frontmatter) und null statt Zeichenkette bei description/reason. Ein unlesbares Register liefert GAR KEINE Eintraege, nicht die uebrigen — der Ausfall ist total und faellt beim Lesen der Datei nicht auf',
    // Kein env-Feld: kein git, kein Netz, kein Kindprozess — liest eine
    // Textdatei und laedt ein lokales Modul.
  },
  {
    id: 'verify:crafting',
    npm: 'verify:crafting',
    script: 'scripts/verify-crafting-specs.mjs',
    rail: 'A',
    checks: 'die Kennwerte auf den Crafting-Karten stimmen mit den Spieldaten ueberein, und gleichnamige Blueprints, die in Wahrheit verschiedene Items sind, bleiben gesperrt',
  },
  {
    id: 'verify:typo',
    npm: 'verify:typo',
    script: 'scripts/verify-typo-motion.mjs',
    rail: 'A',
    checks: 'Schriftgrad, Laufweite und Uebergangsdauer kommen site-weit aus der Skala in assets/theme.css statt aus seitenlokalen Einzelwerten',
  },
  {
    id: 'verify:responsive',
    npm: 'verify:responsive',
    script: 'scripts/verify-responsive.mjs',
    rail: 'A',
    checks:
      'Spaltenrezepte koennen unter ihre eigene Mindestbreite schrumpfen (minmax(min(x,100%),…)) und jede eigenstaendige Seite unter public/ traegt eigene Mobilregeln — beides gemessene Ursachen abgeschnittener Seiten auf 320px',
  },
  {
    id: 'verify:sprachpaar-css',
    npm: 'verify:sprachpaar-css',
    script: 'scripts/verify-sprachpaar-css.mjs',
    rail: 'A',
    checks:
      'EN- und DE-Fassung derselben Seite tragen dieselben Media-Queries — Seiten-CSS ist je Sprache dupliziert und ist zweimal nachweislich auseinandergelaufen, ohne dass verify:sync (das die Geruestform vergleicht) es sah',
  },
  {
    id: 'verify:layers',
    npm: 'verify:layers',
    script: 'scripts/verify-layers.mjs',
    rail: 'A',
    checks: 'WCAG-AA-Kontrast an jeder Stelle, an der eine dekorative Schicht am Hintergrund von Text beteiligt ist — aus echten Bildpunkten gerechnet, nicht aus CSS abgeleitet',
  },
  {
    id: 'verify:sync',
    npm: 'verify:sync',
    script: 'scripts/verify-sync.mjs',
    rail: 'A',
    checks: 'EN und DE tragen dieselbe Geruestform ueber alle gebauten Seitenpaare',
  },
  {
    id: 'verify:shipcard',
    npm: 'verify:shipcard',
    script: 'scripts/verify-shipcard.mjs',
    rail: 'A',
    checks:
      'die Schiffs-Detailseite traegt genau ein Kapitelgeruest mit Sprungleiste, keinen Einheitsrahmen mehr, Balken nur beim Leistungsprofil, und jeder Wert steht an genau einer Stelle (D-01/D-02/D-03)',
  },
  {
    id: 'verify:patch-ships',
    npm: 'verify:patch-ships',
    script: 'scripts/verify-patch-ships.mjs',
    rail: 'A',
    checks:
      'jedes Schiff einer Patch-Seite trifft einen Katalogeintrag oder eine benannte Ausnahme (sonst WARNUNG), und jede verknuepfte Schiffsseite in dist/ (EN+DE) traegt den Verweis auf ihre Patch-Seiten (sonst FEHLER) — das Patch-Rueckgrat rechnet seit 08.10.2026 der Build, nicht mehr der Datenlauf',
  },
  {
    id: 'verify:shipconsole',
    npm: 'verify:shipconsole',
    script: 'scripts/verify-shipconsole.mjs',
    rail: 'A',
    checks:
      'die Schiffs-Konsole (Rail, Systemabschnitte, Marker-Zaehlung, Textbestand) steht vollstaendig im ausgelieferten HTML, ohne JavaScript sichtbar, mit Bijektion Rail<->System und Sprachparitaet (Phase 16, D-01/D-02/P-1/P-2/P-3)',
    // SCHARF seit 16-05-PLAN.md Task 1: bei der Anlage (15-02) noch AUSGESETZT
    // (vorgefuehrt rot gegen den nach Welle 1 gebauten Stand, Meldung siehe
    // 16-02-SUMMARY.md — Konsole existierte damals noch nicht), Wellen 3/4
    // haben den Zielzustand gebaut. Vor der Scharfschaltung erneut gruen
    // gelaufen (alle acht Zusicherungen, Zombie-Waechter meldet "0
    // Ausnahmen registriert" -- explizit, keine stille Leere), Praezedenz
    // verify:shipcard (14-01 -> 14-04): erst beheben/gruen, dann scharf.
  },
  {
    // Direkt nach den beiden Schiffstoren: dieselbe Datenfamilie, und unter
    // einer Sekunde schnell genug, dass ein gebrochener Hangar-Join vor dem
    // langen audit:site auffaellt. Kein env-Feld: kein git, kein Netz, kein
    // Kindprozess — liest nur dist/.
    id: 'verify:hangar',
    npm: 'verify:hangar',
    script: 'scripts/verify-hangar.mjs',
    rail: 'A',
    checks:
      'die 454 Hangar-Buchten sind vollstaendig und stimmig: eine Id-Menge in Dock, Modellliste und beiden Sprachen, Marker auf dem Rumpf und die Achsregel gegen die Schiffslaenge, Zeilen mit Kennwerten ueber ihren Klinken, Groessendeckel, die Viewer-Naht und die Import-Map vor dem ersten Modul-Skript; getauschte Bordwaffen: jedes Werkstatt-Modell liegt versioniert in dist/, die Schiffs-GLBs tragen ihre Serienwaffen als Tauschteile mit Befestigungsmatrix (Klinken fuer Modelle und Ports); Lackierungen: Form und Toene je Schiff, und die Palettenmaterialien der Schiffe mit Lack tragen die Serienpalette, sonst faerbt eine Lackierung nichts um (Klinken fuer Schiffe, Lackierungen, umfaerbbare Schiffe); Bildablage der Schiffe: kein Bild mehr eingebettet, jeder Verweis liegt in dist/hangar/tex und heisst nach seinem Inhalt, Deckel fuer die Gesamtgroesse und je Datei (Klinke Schiffe mit Ablage); Schiffswahl: jede Karte mit eigenem Bild und Umriss in dist/ (Version = Inhalt, Klinke), Suchwoerter unter fold() stabil, jeder Zweck, jede Unterrolle und Groesse eine Stufe der Pillen, und Proben je Sprache durch die ausgelieferte Suche ueber die Karten aus dist/ (Spitzname, Zweck mit Crew, Fracht, Preis, Tippfehler, Unterrolle; Klinke)',
  },
  {
    id: 'verify:theme',
    npm: 'verify:theme',
    script: 'scripts/verify-theme-gen.mjs',
    rail: 'A',
    checks: 'kein erzeugter Hellmodus-Block ist von Hand veraendert; die echten Generatoren laufen dafuer gegen eine Ablagekopie unter os.tmpdir()',
    env: 'git + Kindprozess: die Generatoren laufen per execFileSync(process.execPath, …) gegen eine tmp-Kopie (nie gegen den Arbeitsbaum); der git-Aufruf in workTreeStatus() faengt ENOENT ab und liefert null — im Build-Container gibt es weder git noch einen Arbeitsbaum, Zusicherung 3 wird dort sichtbar uebersprungen (cf58c76)',
  },
  {
    id: 'verify:vehicle-roles',
    npm: 'verify:vehicle-roles',
    script: 'scripts/verify-vehicle-roles.mjs',
    rail: 'A',
    checks: 'die Rollen-Momentaufnahme ist in sich stimmig und die Join-Rate faellt nicht unter die Klinke (223 von 227)',
  },
  {
    id: 'verify:weapons',
    npm: 'verify:weapons',
    script: 'scripts/verify-weapon-sizes.mjs',
    rail: 'A',
    checks: 'die Waffengroessen im Fahrzeug-Katalog stimmen mit dem Stock-Loadout ueberein — Join ueber die Item-Klasse, nie ueber den Anzeigenamen',
  },
  {
    id: 'verify:help',
    npm: 'verify:help',
    script: 'scripts/verify-help.mjs',
    rail: 'A',
    checks: 'die Hilfe-Mechanik kostet vor dem Klick nichts, setzt kein Markup per innerHTML, ist in DE und EN deckungsgleich und deckt alle elf Werkzeuge ab',
  },
  {
    id: 'verify:fx',
    npm: 'verify:fx',
    script: 'scripts/verify-fx.mjs',
    rail: 'A',
    checks: 'der Mauszeiger-Schein ist getilgt, der FX-Umschalter-Vertrag haelt, und beide Sprachfassungen tragen ihn gleich',
  },
  {
    // Neuzugang (29.10.2026), schnell (wenige Sekunden): liest src/, assets/
    // und dist/ als Text. Kein env-Feld: kein git, kein Netz, kein
    // Kindprozess im Skript — die Helfer aus src/lib/ werden wie bei
    // verify:crafting mit esbuild gebuendelt und importiert.
    id: 'verify:ausgabe',
    npm: 'verify:ausgabe',
    script: 'scripts/verify-ausgabe.mjs',
    rail: 'A',
    checks:
      'Ausgabekodierung: JSON in <script>-Bloecken laeuft ueber jsonForScript (src/lib/safeJson.ts; maskiert <, U+2028, U+2029 und ist fuer Daten ohne diese Zeichen byte-gleich mit JSON.stringify), kein set:html-Ausdruck ruft JSON.stringify auf (benannte Ausnahmen mit Zombie-Waechter), jede HTML-Maskierer-Kopie deckt & < > " \' ab, und in dist/ ist jeder application/(ld+)json- und window.__X-Block gueltiges JSON ohne rohes < (Klinken fuer Helferstellen, Maskierer und Bloecke)',
  },
  {
    // Neuzugang, vor dem langen audit:site: dekodiert die ausgelieferte
    // Halle (gut 10 MB, wenige Sekunden). Kein env-Feld: kein git, kein
    // Netz, kein Kindprozess — liest dist/ und fuer [12] dazu das Manifest
    // src/data/hangar-assets.json (nennt es die Werkstatt, muss die Seite
    // sie mitgeben).
    id: 'verify:hangar-hall',
    npm: 'verify:hangar-hall',
    script: 'scripts/verify-hangar-hall.mjs',
    rail: 'A',
    checks:
      'jede Ausnahme der echten Halle (HALL_DROP im ausgelieferten Viewer) gehoert zur Halle der Seite, trifft in jeder ausgelieferten Hallenstufe mindestens ihre Klinke an Dreiecken, nur ganze Teile, und nimmt hoechstens 2 % der Halle; die Moebel kommen mit (Klinke), nicht doppelt, und aus der ausgelieferten vollen Stufe; die Naehte jeder Hallenstufe halten (klaffende Randecken unter ihrer Obergrenze, dichte ueber ihrer Klinke); was der leichteren Stufe an Glas und Rohren fehlt, bringt die Moebeldatei aus der vollen (Klinke), ersetzt jedes Material der leichteren Stufe unter der Regel und nichts im Bereich einer Ausnahme; was die leichtere Stufe an einer Stelle ganz weglaesst, setzt die Moebeldatei dazu (Klinke je Bereich, gegen die ausgelieferte leichtere Stufe gerechnet, nichts ganz oder teilweise auf ihr aufliegend, nichts im Bereich einer Ausnahme); Ergaenzung und Fuellung tragen je Material einen Attributsatz der leichteren Stufe; am Telefon (ohne Moebeldatei) bringt eine eigene kleine Datei aus genau der ausgelieferten Moebeldatei dieselben Teile der Ergaenzung und Fuellung (je Primitive gleich in Schluessel, Material, Attributen und Geometrie), ohne Moebel und Texturen, und der Viewer laedt sie dort; unter dem Aufzugsfeld steht der Schacht aus dem Spiel (HALL_SHAFT): die Seite gibt genau den genannten Bausatz samt Lampenliste mit, jedes Wandteil liegt in seinem Rahmen (Laenge und Hoehe ab 0), Laengs- und Querwand sind ohne Luecke bedeckt, die Randleiste reicht bis ans Ende, jede Rippe traegt genau eine Warnlampe, Dreiecke zwischen Klinke und Obergrenze, Lampen ueber ihrer Klinke, jedes Teil mit Texturkoordinaten, die Wear-Schicht (wear_0) vorhanden und genug Dreiecke mit ihrer Maske (Klinke), das Beiwerk aus SHAFT_DECO mit Knoten und genug Exemplaren (Klinke), mit seinen Dreiecken unter der Obergrenze; die Werkstatt aus anderen Spielhallen kommt mit (Seite gibt sie mit, wenn das Manifest sie nennt, Dateien in dist/, jeder Platz der Anordnung und jede Spur auf dem Feld aus WORK_FIELD hat seinen Knoten, Decals flach, Klinken fuer Geraet, Decals, Plaetze und Feldspuren, Obergrenzen fuer Dreiecke und Bytes; der Feldboden aus WORK_PAD hat Knoten und Kachel, und genug fahrende Dreiecke tragen seine Materialien); das Schachttor schliesst die Oeffnung ohne Spalt und liegt offen draussen, seine Palettenlacke tragen die Farbe des Spiels (Klinke); der feste Rand des Spiels liegt um das Feld (HALL_RAND): Stege decken jede Seite ohne Luecke und Ueberlappung buendig mit dem Boden, Ecken, Leuchten und Schriftzug im Rand, gleichnamige Schachtmaterialien mit denselben Karten, Teile ueber der Klinke, Dreiecke, Materialien und Bytes unter der Obergrenze; die Hallendeko (WORK_DEKO) gehoert zur Halle der Seite, jede Zone mit Stufe, Wand, Bezugspunkt und Herkunft aus dem Katalog, ihr Satz passt zu Block und Quellen, jedes Stueck im Raum, frei von Feld samt Rand, feste Stuecke frei voneinander (flache unter 0,35 m und Spuren duerfen sich ueberlagern; was im Fach eines Regals steht, steht auf einem aus der Geometrie gemessenen Regalboden und passt unter den naechsten), frei von Wand und Einrichtung im Grundriss, im Band und darueber bis zur eigenen Hoehe, auch in groesseren Hallen (Massstab bis 6, ohne dabei in die Stuecke anderer Zonen zu geraten), Gestapeltes liegt auf, Klinken fuer Zonen, Glieder, Spuren, Arten, Regalfaecher, Schichten und die Selbstauskunft der Grundrissprobe, Obergrenzen fuer Materialien, Dreiecke je Stufe und Bytes',
  },
  {
    // Neuzugang (25.10.2026), vor dem langen audit:site: dekodiert die
    // Geometrie-Fassungen, die die Seite aufs Fahrwerk stellt (rund 60 MB
    // Draco). Kein env-Feld: kein git, kein Netz, kein Kindprozess — liest
    // dist/ und fuer [4] das Manifest src/data/hangar-assets.json.
    id: 'verify:hangar-gear',
    npm: 'verify:hangar-gear',
    script: 'scripts/verify-hangar-gear.mjs',
    rail: 'A',
    checks: 'jedes Schiff, das die Hangarseite aufs Fahrwerk stellt, steht mit der Ebene des ausgelieferten Viewers auf Ecken seiner Datei (kein Bein schwebt, kein Teil steckt tiefer als die Grenze im Boden), Fahrzeuge ohne Fahrwerk stehen waagrecht auf ihrer tiefsten Ecke, jedes andere Schiff hat einen Grund aus dem Manifest, Klinken fuer beide Arten',
  },
  {
    id: 'verify:hangar-cockpit',
    npm: 'verify:hangar-cockpit',
    script: 'scripts/verify-hangar-cockpit.mjs',
    rail: 'A',
    checks: 'durch die Haube jedes Schiffs der Hangarseite sieht man nicht durch das Schiff in die Halle: Strahlen durch das Haubenglas, die hinter einer Rueckseite nichts mehr treffen, was der Viewer zeichnet, je Schiff unter seiner Klinke (Krisz 29.10.2026: Gladius von innen hohl)',
  },
  {
    // Neuzugang (30.10.2026), vor dem langen audit:site: entpackt die
    // Crew-Figur (1,7 MB Draco) und laedt das ausgelieferte Crew-Modul in
    // Node (three aus node_modules), Sekunden. Kein env-Feld: kein git, kein
    // Netz, kein Kindprozess — liest dist/ und das Manifest
    // src/data/hangar-crew.json.
    id: 'verify:hangar-crew',
    npm: 'verify:hangar-crew',
    script: 'scripts/verify-hangar-crew.mjs',
    rail: 'A',
    checks:
      'die Hangarseite gibt die Crew mit Skelett mit (Figur des Manifests und Modul versioniert in dist/); die Figur ist ein Netz mit Haut, Gelenke wie die Knochenliste, jede Ecke an hoechstens 4 Knochen mit Summe 1, Teilmaterial in der Farbtafel, Texturkoordinaten im Atlas, Farbtafel passend zu Stellungen und Teilmaterialien, unter den Obergrenzen fuer Bytes, Dreiecke und Knochen; der Animationsblock ist stimmig (Clips, Spuren an Knochen, Bilder in der Dauer, Einheitsquaternionen, Bahnen der Wurzel); jeder Clip, den das Modul spielen kann, steht in der Datei, mit Dauer nur Schleifen; jeder Einhaengepunkt des Materials steht im Shader von three.js; Wege im Raster des Moduls nur ueber freie Zellen (Probelauf); die Verkabelung im ausgelieferten Viewer (Arbeitsplaetze, Aufstandspunkte, Uebergabe, Ladezweig); Klinken fuer Clips und Farbstellungen (Krisz 30.10.2026: „bau npcs komplett aus“)',
  },
  {
    // Neuzugang (29.10.2026, Sicherheitsbefund OPS-3), vor dem langen
    // audit:site: liest jede gebaute Seite einmal als Text, wenige Sekunden.
    // Kein env-Feld: kein git, kein Netz, kein Kindprozess — nur dist/.
    id: 'verify:vorklick',
    npm: 'verify:vorklick',
    script: 'scripts/verify-vorklick.mjs',
    rail: 'A',
    checks:
      'keine gebaute Seite laedt oder verbindet sich vor einem Klick mit einem Anbieter, fuer den die Datenschutzerklaerung „erst nach Klick" oder „nie" zusagt (YouTube, Google Fonts, Stripe, PayPal, Web3Forms) — weder per script/iframe/img/srcset/poster/data-src noch per link preconnect/preload/stylesheet oder CSS-url(); Inline-Skripte und JS-Dateien duerfen diese Hosts nur an benannten Klick-Bindungen nennen (mit Zombie-Waechter); Klinken fuer Seitenzahl und YouTube-Klick-Fassaden',
  },
  {
    // Neuzugang (29.10.2026), vor dem langen audit:site: liest die
    // gebauten Seiten als Text (gut 2 s). Kein env-Feld: kein git, kein
    // Netz, kein Kindprozess — node:vm fuehrt nur den Haken aus dist/ aus.
    id: 'verify:zaehler',
    npm: 'verify:zaehler',
    script: 'scripts/verify-zaehler.mjs',
    rail: 'A',
    checks:
      'die Reichweitenmessung laeuft auf jeder Layout-Seite ausser den benannten Konto- und Anmeldeseiten (Ausnahmeliste mit Anlass und Zombie-Waechter: jede Ausnahme existiert und laedt den Zaehler nicht), keine Seite unter account/ laedt ihn, jeder Zaehler-Tag schliesst Fragment und Abfrage aus und hat seinen Haken auf der Seite, und der ausgelieferte Haken schneidet Abfrage und Fragment von Adresse und Herkunft ab, als volle Adresse wie als Pfad und liefert mit dem Widerspruchs-Cookie null (in node:vm ausgefuehrt); das Zaehlskript kommt als gepinnte Kopie vom eigenen Ursprung (Pruefsumme im Kopf) und schickt in node:vm genau einen POST an data-host-url, mit Widerspruchs-Cookie oder auf fremdem Hostnamen keinen; Klinken fuer Layout-Seiten, Zaehler-Seiten, Haken-Fassungen und Zaehler-Kopien; Skripte fremder Hosts auf Kontoseiten als WARNUNG',
  },
  {
    id: 'audit:site',
    npm: 'audit:site',
    script: 'scripts/audit-site.mjs',
    rail: 'A',
    checks: 'Publish-Audit ueber alle gebauten Seiten: tote Links und Anker, Sprachumschalter-Ziele, Sitemap gegen Build, Platzhalter, Mojibake, A11y-Basics — und die Datenherkunfts-Regel, die es als einziges Tor traegt',
  },
  {
    id: 'verify:mining',
    npm: 'verify:mining',
    script: 'scripts/verify-mining.mjs',
    rail: 'A',
    checks: 'die Mining-Daten sind in sich stimmig und kein interner Klassenname wird ausgeliefert; der Abstand zum installierten Client wird gemeldet, blockt aber nicht',
    env: 'Data.p4k nur als Pfadableitung: der Client-Abgleich haengt hinter existsSync(build_manifest.id) und wird ohne lokale Spielinstallation still uebersprungen — das Skript oeffnet das Archiv selbst nie',
    // 27.08.2026 — NACHGELASSEN, Grundsatz 5 verlangt die Ursache im Klartext:
    // der Client-Abgleich war ein FEHLER und ist jetzt eine WARNUNG. Am
    // 26.08. kam 4.10.0 (CL 12519617) auf die Betreiber-Maschine, waehrend
    // alle sechs Datenstaende auf 4.9.0/12344265 stehen. Ab diesem Moment war
    // `npm run gate` lokal rot und jeder Push blockiert — bei gruener CI, weil
    // im Container kein Client liegt. Ein Tor, das nur auf einer Maschine
    // reisst, meldet "veraltet", nicht "kaputt": das ist Grundsatz 3, und
    // Schiene A darf ohnehin keine Spielinstallation voraussetzen
    // (Grundsatz 4). verify:datastand bewertet dieselbe Tatsache seit seiner
    // Anlage als WARNUNG — die beiden Tore widersprachen sich.
    // Die Aussage geht NICHT verloren: sie steht jetzt zweimal als WARNUNG
    // (hier und in verify:datastand) und der Datenlauf gehoert auf Schiene B.
    // SCHARF seit 11.08.2026. Der Schuldenposten vom 09.08. ist abgetragen:
    // `npm run sync:mining` gegen die installierte Data.p4k hat die Daten von
    // 4.9.0-live.12326004 auf 12344265 gehoben, der Pruefer laeuft gruen
    // (38 Elemente, 211 Komp., 14 Laser, 37 Minerale, 45 Bodies).
    // Bemerkenswert und fuer den naechsten Patch-Tag wissenswert: zwischen den
    // beiden Changelists hat sich an den Mining-Daten NICHTS geaendert —
    // Resistenz, Instabilitaet, Dichte, Signaturen, Seltenheit, Laser-DPS,
    // Fundortzahl (273) und Koerper (45) sind byte-gleich. Es war ein
    // Etikettenverzug, kein Datenverzug. Der Pruefer hat trotzdem recht
    // gehabt, ihn zu melden: ob die Werte gleich bleiben, weiss man erst
    // NACH dem Lauf.
  },
  {
    // Direkt nach verify:mining — beide bilden dieselbe Torfamilie
    // (Patch-Kennung gegen Verzug), aber verify:mining prueft EINEN
    // Datenstand gegen den EINEN installierten Client, dieses Tor haelt
    // ALLE Datenstaende committeter Kennungen GEGENEINANDER — der Vergleich,
    // der missions.json 18.261 Changelists unbemerkt zurueckfallen liess.
    id: 'verify:datastand',
    npm: 'verify:datastand',
    script: 'scripts/verify-datastand.mjs',
    rail: 'A',
    checks:
      'die committeten Patch-Kennungen aller Datenstaende (Missionen, Mining, Crafting, Item-Katalog, Refinery, Zerlegung, Wikelo) stimmen im Kreuzvergleich ueberein und liegen ueber ihrer Klinke',
    env: 'Data.p4k nur als Pfadableitung: der Client-Abgleich haengt hinter existsSync(build_manifest.id) und wird ohne lokale Spielinstallation still uebersprungen — das Skript oeffnet das Archiv selbst nie',
    // SCHARF seit Anlage (18-04-PLAN.md): die Wellen 1 bis 3 haben den
    // Zielzustand bereits hergestellt (alle sechs maschinellen Datenstaende
    // auf CL 12344265), das Tor lief beim ersten Lauf gruen.
    // 28.08.2026 (20-03-PLAN.md, D-04): Wikelo ist aus HANDPFLEGE in STANDS
    // gewandert — die Kennung kommt jetzt aus scripts/build-wikelo-trades.mjs
    // (Datenlauf) statt aus einer menschlichen Sichtung. Damit ist
    // Register-Eintrag id 51 aufloesbar.
  },

  // ---------------------------------------------------------------
  // Schiene B — der Datenlauf. Laeuft NUR lokal (npm run gate:data),
  // nach jedem datamine:*/sync:*-Lauf.
  // ---------------------------------------------------------------
  {
    id: 'verify:items',
    npm: 'verify:items',
    script: 'scripts/verify-item-prices.mjs',
    rail: 'B',
    checks: 'Voll-Abgleich aller Shop-Zeilen gegen UEX live, Stichprobe gegen die Wiki, Audit auf tote Locations',
    env: 'Netz: fetch() gegen api.uexcorp.space und die Wiki-API — UEX sperrt Rechenzentren (403, Cloudflare); aus GitHub Actions ist diese Pruefung prinzipbedingt nicht erreichbar, ein API-Token hilft nicht',
  },
  {
    id: 'verify:vehicles',
    npm: 'verify:vehicles',
    script: 'scripts/verify-vehicles.mjs',
    rail: 'B',
    checks: 'Feld fuer Feld: was ein frischer Extraktionslauf gegenueber dem committeten Katalog aendert',
    env: 'liest src/data/vehicles-gamefiles.json — die Zwischenstufe ist unversioniert und entsteht erst durch npm run datamine:vehicles',
  },
  {
    id: 'verify:vehicle-gap',
    npm: 'verify:vehicle-gap',
    script: 'scripts/verify-vehicle-gap.mjs',
    rail: 'B',
    checks:
      'flugfaehige /spaceships/- und /groundvehicles/-Records im DataCore (nach dem isVariantJunk-Filter aus datamine-vehicles.mjs) ohne Katalog-Eintrag und ohne benannte Ausnahme — WARNUNG; FEHLER nur bei Zombie-Ausnahmen oder Leser unter der Klinke',
    env: 'Data.p4k: oeffnet das Archiv selbst (DataCore + englische Lokalisierung) — gibt es nur auf dem Betreiber-Rechner, deshalb Schiene B. Anlass: Sabre Raven EX und S-65 Stingray fehlten still im zirkulaer geschlossenen Katalog (07.10.2026)',
  },
  {
    id: 'datamine:paints',
    npm: 'datamine:paints',
    script: 'scripts/datamine-ship-paints.mjs',
    rail: 'B',
    checks:
      'zieht je Hangar-Schiff die Lackierungen mit ihren Palettenfarben A/B/C nach src/data/ship-paints.json und reisst, wenn der Leser kein Schiff oder keine Lackierung findet',
    env: 'Data.p4k: oeffnet das Archiv selbst (DataCore + englische Lokalisierung) — gibt es nur auf dem Betreiber-Rechner, deshalb Schiene B',
  },
  {
    // Kein Datenlauf, aber dieselbe Umgebung: Zugang, den es nur auf dem
    // Betreiber-Rechner gibt. Anlass: 20261029123218 (Profil-Views fuer
    // Anonyme beschreibbar, Ursache Supabase-Standardrechte) und
    // 20261030100000 (Rechte nur nach Bedarf). Vorgefuehrt rot gegen den
    // Live-Stand vor der Migration, gruen gegen die lokale Replik danach.
    id: 'verify:db-rights',
    npm: 'verify:db-rights',
    script: 'scripts/verify-db-rights.mjs',
    rail: 'B',
    checks:
      'die wirksamen Datenbankrechte von anon, authenticated und PUBLIC (Tabellen, Views, Sequenzen, Funktionen, Spalten, Schemas, Standardrechte fuer neue Objekte, Rollenattribute) gehen nicht ueber supabase/rights.expected.json hinaus (sonst FEHLER), fehlende Soll-Rechte sind WARNUNG, benannte Ausnahmen tragen ihren Anlass (Zombie-Waechter), Klinke fuer die Zahl der geprueften Objekte',
    env:
      'Netz: fetch() gegen https://api.supabase.com (Management API, POST /v1/projects/<ref>/database/query/read-only, Abfrage aus supabase/rights.snapshot.sql) mit SUPABASE_ACCESS_TOKEN aus der Umgebung — ein persoenliches Zugriffstoken des Betreibers, das es weder im Build-Container noch in CI gibt, deshalb Schiene B. Ohne Token: Exit 2 "nicht geprueft", nie still gruen. Offline: --snapshot <datei> mit dem JSON-Ergebnis derselben Abfrage.',
  },

  // ---------------------------------------------------------------
  // Schiene C — gegen das LAUFENDE Artefakt, nicht gegen Dateien.
  // ---------------------------------------------------------------
  {
    id: 'smoke',
    npm: 'smoke',
    script: 'scripts/browser-smoke.mjs',
    rail: 'C',
    checks:
      'die Leitseiten in einem echten Browser: keine JS-Ausnahme, keine eigene Ressource >= 400, kein CSP-Verstoss, Leitelement wirklich sichtbar, kein waagerechter Ueberlauf, und die Werkzeuge filtern wirklich',
    env:
      'Netz: laedt die Seiten ueber http gegen das Ziel aus --base/SMOKE_BASE und holt vorab dessen robots.txt per fetch(), um Vorschau- von Live-Build zu unterscheiden. Braucht ausserdem einen laufenden Server UND einen installierten Browser — beides gibt es im Build-Container (node:22-alpine) nicht, deshalb Schiene C statt A. Laeuft im Workflow gegen den frisch gebauten Container (vor dem Push), lokal gegen astro preview oder eine URL. FREMDE Hosts werden abgebrochen und nicht gewertet: CI hat keinen verlaesslichen Weg ins Netz, und der Ausfall eines Dritten ist kein Fehler dieser Seite.',
  },

  {
    id: 'check:hangar-shader',
    npm: 'check:hangar-shader',
    script: 'scripts/check-hangar-shader.mjs',
    rail: 'C',
    checks:
      'kein Bildshader des 3D-Hangars braucht mehr als 16 Texturen (die Grenze von Chrome unter Windows; darueber linkt das Programm dort nicht und sein Material bleibt unsichtbar): auf hoch mit ganzer Hallendeko je gelinktem Programm selbst gezaehlt, kein Programm linkt nicht, die Zeile des Viewers ist da, Klinken fuer Programme und Programme mit Schichttafel',
    env:
      'Browser und laufender Server: laedt <base>/hangar.html in einem installierten Chromium mit Software-WebGL und vorgetaeuschter Grafikkarte (sonst zeigt die Seite ihren Rueckfall) und wartet, bis die Hallendeko steht (in Software-WebGL einige Minuten). Beides gibt es im Build-Container nicht, deshalb Schiene C. Anlass: Wartungsplatz und Hallendeko waren auf staging unter Windows unsichtbar, waehrend jede Aufnahme mit Software-WebGL (32 Texturen erlaubt) und der Rauchtest (sieht nur den Rueckfall) gruen waren (Krisz, 21.10.2026).',
  },

  {
    id: 'check:staging',
    npm: 'check:staging',
    script: 'scripts/check-deployed.mjs',
    rail: 'C',
    checks:
      'die Vorschau-Domain liefert wirklich den zuletzt gebauten Stand aus (dist/build.json gegen origin/staging) und traegt einen Vorschau-Build, keinen Live-Build',
    env:
      'Netz: fetch() gegen <base>/build.json. Kindprozess + git: execFileSync("git", ["rev-parse", …]) ermittelt die Soll-Kennung — das laeuft auf dem Entwicklungsrechner, NICHT im Build-Container (dort gibt es weder git noch ein Repository, siehe cf58c76). Faellt der Aufruf aus, wird nur berichtet statt geurteilt.',
  },

  {
    id: 'check:headers',
    npm: 'check:headers',
    script: 'scripts/check-headers.mjs',
    rail: 'C',
    checks:
      'die AUSGELIEFERTEN Antworten (eine je location-Block, 200, 301, auf der Vorschau 302, live 404) tragen Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options und Referrer-Policy; die Richtlinie steht auf Hashes statt \'unsafe-inline\' (sonst ist nginx auf den Rueckfall gefallen), ohne \'unsafe-eval\', * und reine Schema-Quellen in script-src, mit default-src, object-src \'none\' und base-uri/frame-ancestors \'self\' oder \'none\', und jedes Inline-Skript der ausgelieferten HTML-Antworten hat seinen Hash in der Richtlinie genau dieser Antwort',
    env:
      'Netz: fetch() gegen <base>/… mit redirect:"manual" (die Kopfzeilen der 301/302 selbst zaehlen) — nur eine laufende Seite zeigt, was Cloudflare und nginx wirklich ausliefern, deshalb Schiene C. Dieselbe Cloudflare-Sperre gegen Rechenzentrums-IPs wie bei check:gate (401/403/429): --weich macht daraus eine WARNUNG, vom Entwicklungsrechner aus laeuft es streng.',
  },

  {
    id: 'check:gate',
    npm: 'check:gate',
    script: 'scripts/check-gate.mjs',
    rail: 'C',
    checks:
      'die AUSGELIEFERTE Zugriffskontrolle des Testpilot-Tors: gesperrte Stichproben aus dist/ antworten ohne Cookie mit 302 auf /gate.html mit no-store und ohne Cache-Zeit, /pilot/<handle>?probe=1 behaelt Pfad und Query als next=, jeder Eintrag der Ausnahmeliste aus nginx/default.conf antwortet mit 200, /build.json traegt eine Commit-Kennung (D-07), ein gewuerfelter Wert in der Bypass-Kopfzeile oeffnet das Tor NICHT (T-14-56/T-14-57), und mit dem echten Bypass traegt die Antwort Cache-Control private',
    env:
      'Netz: fetch() gegen <base>/…, redirect:"manual" (der 302 muss SICHTBAR bleiben, nicht gefolgt werden) — dieselbe Cloudflare-Sperre gegen Rechenzentrums-IPs wie bei check:staging (401/403/429), deshalb --weich im Workflow, streng vom Entwicklungsrechner aus. Sonst beruehrt es nichts ausserhalb der Umgebung: die Stichproben kommen ausschliesslich aus dist/ und aus dem Text von nginx/default.conf, nicht aus einer zweiten, handgepflegten Liste.',
  },

  // ---------------------------------------------------------------
  // Werkzeuge — keine Pruefer, brauchen `why`.
  // ---------------------------------------------------------------
  {
    id: 'audit-typo-motion',
    script: 'scripts/audit-typo-motion.mjs',
    rail: null,
    checks: 'zaehlt Schriftgrade, Laufweiten und Uebergaenge im Quellbestand',
    why: 'Erhebungswerkzeug aus Phase 2 (Grundlage der Skala), kein Pruefer — es faellt kein Urteil und hat bewusst keinen Exit-Code',
  },
  {
    id: 'measure-hangar-cockpit',
    script: 'scripts/measure-hangar-cockpit.mjs',
    rail: null,
    checks: 'misst je Schiffsmodell eines Ordners, wie viele Blicke durch das Haubenglas auf eine Rueckseite treffen (hohl) und wie viele dahinter in die Halle gehen (durch)',
    why:
      'Erhebungswerkzeug fuer .planning/notes/hangar-cockpit-hohl.md (Krisz, 29.10.2026: Gladius von innen hohl): vergleicht Rohexport und Web-Fassung auf dem PC, auch ausserhalb von dist/. ' +
      'Dieselbe Rechnung (scripts/lib/cockpit-rays.mjs) prueft verify:hangar-cockpit als Tor gegen die ausgelieferten Modelle.',
  },
  {
    id: 'verify-hardpoints',
    script: 'scripts/verify-hardpoints.mjs',
    rail: null,
    checks: 'vergleicht Huellenmasse und Komponentenzahlen der Hardpoint-Extraktion gegen unabhaengige Quellen',
    why:
      'HEUTE ein Bericht, kein Pruefer: kein process.exit, kein npm-Skript, und der Ground-Truth-Pfad fuer Teil C zeigt in ein geloeschtes Sitzungsverzeichnis. ' +
      'Wird in Stufe 1c zum Schiene-B-Pruefer umgebaut (Exit-Logik ab Huellen-Verwechslung, Pfad nach .cache/) — die heutigen 34 Verdachtsfaelle muessen davor einzeln beurteilt werden.',
  },
];

/** Die Strecken einer Schiene, in Laufreihenfolge. */
export const rail = (r) => CHECKS.filter((c) => c.rail === r);

/** Strecken, die momentan ausgesetzt sind — Schuldenposten, immer sichtbar. */
export const disabled = () => CHECKS.filter((c) => c.disabled);

/** Was tatsaechlich laeuft: die Schiene ohne ihre ausgesetzten Strecken. */
export const plan = (r) => rail(r).filter((c) => !c.disabled);
