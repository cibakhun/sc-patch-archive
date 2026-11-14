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
     nurMitHangar  true: prueft den Hangar und laeuft nur gegen einen Bau,
               der ihn enthaelt (Vorschau, STAGING=1). Gegen den Live-Bau
               meldet run-gate die Strecke als "ohne Hangar" statt sie
               auszufuehren; dass dort wirklich kein Hangar steht, prueft
               verify:hangar-schalter (scripts/lib/hangar-switch.mjs).
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
    checks: 'die Content-Security-Policy in nginx/default.conf deckt alles ab, was der Build wirklich laedt — eine zu enge CSP bricht nicht beim Deploy, sondern still im Browser des Besuchers; dazu: jedes ausgefuehrte Inline-Skript aus dist/ hat seinen Hash in der Richtlinie, wie nginx sie mit den include-Dateien aus dist/_csp/ ausliefert, script-src ohne \'unsafe-inline\', \'unsafe-eval\', * und reine Schema-Quellen, jeder Inline-Handler ist eine benannte Ausnahme (Zombie-Waechter), jede Seite mit data-img-fail traegt den Bild-Hoerer davor, der Zaehl-Host steht nur in connect-src, kein add_header ausserhalb des server-Blocks oder ohne always, und die Rahmen-Regel je Bau (scripts/lib/rahmen.mjs): die drei nginx-Maps fallen ohne Datei auf zu, die Dateien aus dist/_csp/ tragen genau den Wert des geprueften Artefakts (Vorschau mit Hangar: nur die eigene Seite, Live: niemand), X-Frame-Options und frame-ancestors folgen ihnen',
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
    // Neuzugang (31.10.2026, Krisz: live alles ausser dem Hangar): direkt vor
    // den Hangar-Strecken, weil erst diese Pruefung es zulaessig macht, dass
    // run-gate sie gegen den Live-Bau weglaesst. Liest jede gebaute Seite
    // einmal als Text, wenige Sekunden. Kein env-Feld: kein git, kein Netz,
    // kein Kindprozess — nur dist/.
    id: 'verify:hangar-schalter',
    npm: 'verify:hangar-schalter',
    script: 'scripts/verify-hangar-schalter.mjs',
    rail: 'A',
    checks:
      'der Hangar steht genau im Vorschau-Bau: live keine Hangar-Seiten, -Ordner, -Modelle und -Skripte in dist/ und keine Seite, die eine Hangar-Seite verlinkt oder etwas aus /hangar/ laedt; in der Vorschau beide Sprachen, die Buchtdokumente (Klinke) und die Modelle (Klinke), und das Menue fuehrt hin; Klinke fuer gelesene Seiten',
  },
  {
    // Neuzugang (04.11.2026, Plan Supabase-Trennung, Phase 3): direkt nach
    // dem Hangar-Schalter, derselbe STAGING-Schalter am Artefakt. Liest jede
    // Textdatei in dist/ einmal, wenige Sekunden. Kein env-Feld: kein git,
    // kein Netz, kein Kindprozess — nur dist/ und die Ziel-Tabelle.
    id: 'verify:supabase-ziel',
    npm: 'verify:supabase-ziel',
    script: 'scripts/verify-supabase-ziel.mjs',
    rail: 'A',
    checks:
      'der Bau spricht genau ein Supabase-Projekt an, und zwar das seines Ziels (Vorschau-Bau "vorschau", sonst "live", Tabelle scripts/lib/supabase-ziel.mjs): dist/build.json nennt Ziel und Ref passend zur Tabelle, jede Textdatei in dist/ nennt nur dessen Host, Sitzungsschluessel und Publishable Key und keinen geheimen Schluessel, und account-lite.js, die CSP-Dateien, gate.html, ein Client-Bundle und die Datenschutzerklaerung tragen es; Klinken fuer gelesene und tragende Dateien',
  },
  {
    // Direkt nach den beiden Schiffstoren: dieselbe Datenfamilie, und unter
    // einer Sekunde schnell genug, dass ein gebrochener Hangar-Join vor dem
    // langen audit:site auffaellt. Kein env-Feld: kein git, kein Netz, kein
    // Kindprozess — liest nur dist/.
    id: 'verify:hangar',
    npm: 'verify:hangar',
    nurMitHangar: true,
    script: 'scripts/verify-hangar.mjs',
    rail: 'A',
    checks:
      'die 454 Hangar-Buchten sind vollstaendig und stimmig: eine Id-Menge in Dock, Modellliste und beiden Sprachen, Marker auf dem Rumpf und die Achsregel gegen die Schiffslaenge, Zeilen mit Kennwerten ueber ihren Klinken, Groessendeckel, die Viewer-Naht und die Import-Map vor dem ersten Modul-Skript; getauschte Bordwaffen: jedes Werkstatt-Modell liegt versioniert in dist/, die Schiffs-GLBs tragen ihre Serienwaffen als Tauschteile mit Befestigungsmatrix (Klinken fuer Modelle und Ports); Lackierungen: Form und Toene je Schiff, und die Palettenmaterialien der Schiffe mit Lack tragen die Serienpalette, sonst faerbt eine Lackierung nichts um (Klinken fuer Schiffe, Lackierungen, umfaerbbare Schiffe); Bildablage der Schiffe: kein Bild mehr eingebettet, jeder Verweis liegt in dist/hangar/tex und heisst nach seinem Inhalt, Deckel fuer die Gesamtgroesse und je Datei (Klinke Schiffe mit Ablage); Schiffswahl: jede Karte mit eigenem Bild und Umriss in dist/ (Version = Inhalt, Klinke), Suchwoerter unter fold() stabil, jeder Zweck, jede Unterrolle und Groesse eine Stufe der Pillen, und Proben je Sprache durch die ausgelieferte Suche ueber die Karten aus dist/ (Spitzname, Zweck mit Crew, Fracht, Preis, Tippfehler, Unterrolle; Klinke); Datenblatt des Bauteils in der Halle: Naht zwischen Werkstatt, Controller, Modul und Viewer, die Rang-Rechnung des ausgelieferten Werkstatt-Skripts besteht feste Proben, und jeder Weg des Blatts (Herstellen, Item-Seite) zeigt in beiden Sprachen auf eine gebaute Seite (Klinken fuer Teile mit Laden, Rezept, Item-Seite und fuer die Proben); Hangargroessen: vier feste Stufen im Viewer mit den abgenommenen Maszen, jedes Schiff der Halle steht in der Stufe seiner Groessenklasse oder einer benannten Ausnahme und ganz auf dem Feld, und die Zeile mit der Stufe erreicht Titelblock und Hologramm (Klinken fuer Schiffe je Stufe, Naht und Woerter)',
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
    // Neuzugang 04.11.2026 — direkt nach verify:weapons, dieselbe Datei.
    // Anlass: die Gladius Valiant stand am 29.10.2026 auf 0 kg; gefangen hat
    // es nur die Deckungs-Klinke in verify:vehicles auf Schiene B. Bewusst
    // KEIN Ausreisser-Test: gemessen haetten die echten Fehler der letzten
    // Laeufe (Andromeda-Huelle, X1-Force-DPS) ihn nicht ausgeloest
    // (z = 1,3 und -0,5), Begruendung im Skriptkopf.
    id: 'verify:fahrzeugwerte',
    npm: 'verify:fahrzeugwerte',
    script: 'scripts/verify-fahrzeugwerte.mjs',
    rail: 'A',
    checks:
      'im Fahrzeug-Katalog ist keine Zahl NaN oder negativ, jedes Fahrzeug hat Huelle und Masse groesser 0 (benannte Ausnahmen mit Zombie-Waechter), Piloten- und Turm-DPS sind die Summe ihrer Waffen, die Raketenzahl die Summe der Werfer und SCM nicht ueber der Hoechstgeschwindigkeit; Nullen, die Bauteile nicht erklaeren, als WARNUNG',
    // VORGEFUEHRT ROT am 04.11.2026 gegen eine Kopie des Katalogs mit dem
    // Fehler vom 29.10. (Gladius Valiant 0 kg) und einem Steuerzeichen im
    // Zahlwert (Arrow scmSpeed "2\u000030"): 2 FEHLER. Gegen den echten
    // Katalog gruen (231 Fahrzeuge, 5.896 Zahlwerte, 572 Summen, 4 ATLS-
    // Ausnahmen, 7 WARNUNGEN). Grenze, ehrlich vermerkt: eine doppelt
    // gezaehlte Waffe mit mitgezaehlter DPS (X1 Force, 4.10.2-Lauf) bleibt
    // gruen — die Summe stimmt ja; das faengt nur der Abgleich mit einer
    // zweiten Quelle im Datenlauf.
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
    nurMitHangar: true,
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
    nurMitHangar: true,
    script: 'scripts/verify-hangar-gear.mjs',
    rail: 'A',
    checks: 'jedes Schiff, das die Hangarseite aufs Fahrwerk stellt, steht mit der Ebene des ausgelieferten Viewers auf Ecken seiner Datei (kein Bein schwebt, kein Teil steckt tiefer als die Grenze im Boden), Fahrzeuge ohne Fahrwerk stehen waagrecht auf ihrer tiefsten Ecke, jedes andere Schiff hat einen Grund aus dem Manifest, Klinken fuer beide Arten',
  },
  {
    id: 'verify:hangar-cockpit',
    npm: 'verify:hangar-cockpit',
    nurMitHangar: true,
    script: 'scripts/verify-hangar-cockpit.mjs',
    rail: 'A',
    checks: 'durch die Haube jedes Schiffs der Hangarseite sieht man nicht durch das Schiff in die Halle: Strahlen durch das Haubenglas, die hinter einer Rueckseite nichts mehr treffen, was der Viewer zeichnet, je Schiff unter seiner Klinke (Krisz 29.10.2026: Gladius von innen hohl)',
  },
  {
    // Neuzugang (31.10.2026): mit Fingerabdruck-Klinke wie verify:hangar-cockpit
    // 2 s; nach einem Neubau misst es mit allen Kernen (231 Schiffe gut 2
    // Minuten auf 4 Kernen). Kein env-Feld: kein git, kein Netz, kein
    // Kindprozess (Worker-Faeden) — liest dist/. [5] seit 10.11.2026,
    // vorgefuehrt rot mit dem alten Medivac (interior_part_23, 1,5 m ueber
    // der Huelle, ohne Ausnahme; dazu die Klinke mitRagt 6 statt 5).
    id: 'verify:hangar-lage',
    npm: 'verify:hangar-lage',
    nurMitHangar: true,
    script: 'scripts/verify-hangar-lage.mjs',
    rail: 'A',
    checks: 'jeder begehbare Innenraum der Hangarseite liegt im Rumpf (Anteil der Dreiecke ausserhalb je Schiff unter seiner Klinke, ab 1 % nur mit benannter Ausnahme) und mit Dreiecken am Pilotensitz (ohne Sitzangabe nur mit benannter Ausnahme), kein Rumpf hat Teile, die getrennt neben ihm haengen, und kein Innenraumteil im Rumpf ragt mehr als 0,5 m ueber dessen Huelle, beides nur mit benannter Ausnahme (Krisz 30.10.2026: jedes Schiff innen und aussen ansehen; 10.11.2026: Ursa Medivac mit zweiter Huelle aus dem Innenraum-Container)',
  },
  {
    // Neuzugang (30.10.2026), vor dem langen audit:site: entpackt die
    // Crew-Figur (1,7 MB Draco) und laedt das ausgelieferte Crew-Modul in
    // Node (three aus node_modules), Sekunden. Kein env-Feld: kein git, kein
    // Netz, kein Kindprozess — liest dist/ und das Manifest
    // src/data/hangar-crew.json.
    id: 'verify:hangar-crew',
    npm: 'verify:hangar-crew',
    nurMitHangar: true,
    script: 'scripts/verify-hangar-crew.mjs',
    rail: 'A',
    checks:
      'die Hangarseite gibt die Crew mit Skelett mit (Figur des Manifests und Modul versioniert in dist/); die Figur ist ein Netz mit Haut, Gelenke wie die Knochenliste, jede Ecke an hoechstens 4 Knochen mit Summe 1, Teilmaterial in der Farbtafel, Texturkoordinaten im Atlas, Farbtafel passend zu Stellungen und Teilmaterialien, unter den Obergrenzen fuer Bytes, Dreiecke und Knochen; der Animationsblock ist stimmig (Clips, Spuren an Knochen, Bilder in der Dauer, Einheitsquaternionen, Bahnen der Wurzel); jeder Clip, den das Modul spielen kann, steht in der Datei, mit Dauer nur Schleifen; jeder Einhaengepunkt des Materials steht im Shader von three.js; Wege im Raster des Moduls nur ueber freie Zellen (Probelauf); die Verkabelung im ausgelieferten Viewer (Arbeitsplaetze, Aufstandspunkte, Uebergabe, Ladezweig); Klinken fuer Clips und Farbstellungen (Krisz 30.10.2026: „bau npcs komplett aus“)',
  },
  {
    // Neuzugang (13.11.2026), nach den uebrigen Hangar-Toren: liest die
    // gebauten Hangarseiten als Text und laedt die ausgelieferten Module
    // (Viewer fuer die reine Rechnung leitFit, Terminal fuer seine reinen
    // Funktionen) in Node, unter einer Sekunde. Kein env-Feld: kein git, kein
    // Netz, kein Kindprozess — liest nur dist/. VORGEFUEHRT ROT in dreizehn
    // Laeufen, je ein Eingriff in dist/ (Liste im Kopf des Skripts, Meldungen
    // in der PR): unter anderem Ortsleiste ohne Werkhalle, ein Bereich der
    // Umschaltleiste auf eine Seite, die es nicht gibt, ein Link zum Hangar,
    // der im Fenster bliebe, die Kamera ohne Abstand zur Decke und
    // frame-ancestors.conf auf 'none'.
    id: 'verify:hangar-orte',
    npm: 'verify:hangar-orte',
    nurMitHangar: true,
    script: 'scripts/verify-hangar-orte.mjs',
    rail: 'A',
    checks:
      'Orte der Halle und Terminal im Leitstand: die Hangarseite traegt in beiden Sprachen die Ortsleiste mit Schiffsfeld, Werkhalle und Leitstand samt Ansagen und das Fenster des Terminals mit versioniertem Modul und leerem Rahmen; jeder Bereich der Umschaltleiste zeigt auf eine gebaute Seite derselben Sprache, bleibt im Fenster und markiert sich selbst (Klinke Bereiche je Seite); die reinen Funktionen des ausgelieferten Terminal-Moduls bestehen feste Proben (Massstab, Wege nach innen, in einen neuen Tab und zurueck in den Hangar, Zuordnung zum Bereich); die Kamera vor dem Schirm: leitFit aus dem ausgelieferten Viewer legt den Schirm fuer ein Raster von Fenstergroessen in das freie Rechteck und bleibt mit Abstand im Raum des Leitstands (Klinke Proben); die Naht zwischen Seite, Controller, Terminal und Viewer; und die Rahmen-Dateien des Baus lassen die eigene Seite zu',
  },
  {
    // Neuzugang (13.11.2026) hinter verify:hangar-orte: komprimierte
    // Zwillinge der Hangar-Bilder (KTX2). Liest jedes GLB unter dist/hangar/
    // (nur Kopf und JSON-Teil), die Bilder der Ablage und die Zwillinge,
    // gut 15 s. Kein env-Feld: kein git, kein Netz, kein Kindprozess, kein
    // Browser. Vorgeführt rot in neun Fällen: ein Zwilling gelöscht, eine
    // fremde Datei im Ordner, der Zwilling eines anderen Bildes, falsche
    // Art, falsches Rezept, Grundfarben-Karte ohne Farbmittel, abgeschnittene
    // Datei, anderes Rezept im Viewer, Umwandler nicht in dist/.
    id: 'verify:hangar-ktx',
    npm: 'verify:hangar-ktx',
    nurMitHangar: true,
    script: 'scripts/verify-hangar-ktx.mjs',
    rail: 'A',
    checks:
      'komprimierte Hangar-Texturen: jedes Bild, das ein GLB unter dist/hangar/ benutzt, hat genau einen Zwilling unter dist/hangar/ktx/ und der Ordner trägt nichts anderes; jeder Zwilling ist eine lesbare KTX2-Datei im Basis-Format, so groß wie sein WebP, mit Mip-Stufen, der Art des Bestands (Normal-Karten UASTC, sonst ETC1S), dem Rezept und der Byte-Zahl seines WebP; jede Grundfarben-Karte trägt ihr Farbmittel; der ausgelieferte Viewer hängt dasselbe Rezept an die URL, liest die Schlüssel wie das Tor und findet Loader und Umwandler in dist/',
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
      'die Reichweitenmessung laeuft auf jeder Layout-Seite ausser den benannten Konto- und Anmeldeseiten (Ausnahmeliste mit Anlass und Zombie-Waechter: jede Ausnahme existiert und laedt den Zaehler nicht), keine Seite unter account/ laedt ihn, jeder Zaehler-Tag schliesst Fragment und Abfrage aus und hat seinen Haken auf der Seite, und der ausgelieferte Haken schneidet Abfrage und Fragment von Adresse und Herkunft ab, als volle Adresse wie als Pfad und liefert mit dem Widerspruchs-Cookie null (in node:vm ausgefuehrt); das Zaehlskript kommt als gepinnte Kopie vom eigenen Ursprung (Pruefsumme im Kopf) und schickt in node:vm genau einen POST an data-host-url, mit Widerspruchs-Cookie oder auf fremdem Hostnamen keinen, und kein Mess-Skript (Zaehler-Kopie, Ereignis-Skript) liegt unter einem Pfad, den Werbeblocker-Standardlisten sperren (Wort umami, EasyPrivacy); und [7] die Messereignisse: jede gezaehlte Seite laedt assets/ereignisse.js nach dem Zaehler und keine andere, die Liste in der Datei gleicht dem SOLL in scripts/lib/ereignisse.mjs (Freigabe 06.11.2026), Marken data-ev-* nur auf Werkzeugseiten und nur mit freigegebenen Filternamen (jeder Name in Gebrauch), jeder Aufruf von vbEreignis nennt ein freigegebenes Ereignis, jede Detailseite (Item, Blueprint, Schiff, Mission) traegt genau einen Link „Falschen Wert melden" mit data-ev-melden auf das Formular ihrer Sprache mit ihrem eigenen Pfad (?wert=) und keine andere Seite einen, das Ereignis extern (Klick nach draussen) kennt nur Hosts, auf die der gebaute Stand verlinkt (Zombie-Waechter), und Ziel-Marken data-ev-extern nur mit freigegebenem Ziel, Hilfe-Marken data-ev-hilfe nur mit freigegebener Art, Trefferbereiche data-ev-treffer nur auf Werkzeugseiten, jeder Aufruf von vbEreignis mit merken (auch in _astro/) nur mit einem Wert aus MERKEN und jeder Wert in Gebrauch, und 47 Proben in node:vm mit Zaehler und Haken (feste Werte, kein Titel, keine Herkunft, keine Einzelseiten-Adresse, bei Links nach draussen nur die Art des Ziels, nur echte Bedienung, einmal je Aufruf, nichts mit Widerspruchs-Cookie oder auf fremdem Host); Klinken fuer Layout-Seiten, Zaehler-Seiten, Haken-Fassungen, Zaehler-Kopien, Ereignis-Seiten, Ereignis-Marken, Ereignis-Laeufe, Melde-Links, Ziel-Marken, Hilfe-Marken, Trefferbereiche, Video-Fassaden und Bild-Ausloeser; Skripte fremder Hosts auf Kontoseiten als WARNUNG',
    // [6] Werbeblocker-Muster (Neuzugang 10.11.2026), VORGEFUEHRT ROT gegen
    // den Live-Bau der Umbenennung: support.html zeigt in dist/ wieder auf
    // /vendor/umami/script.js (Datei dorthin kopiert) -> "Pfad trifft das
    // Werbeblocker-Muster /umami/i … gesperrt — Soll: 0 Ist: 1", exit 1.
    // [7] Messereignisse (Neuzugang 06.11.2026), VORGEFUEHRT ROT gegen den
    // Live-Bau der Ereignis-Aenderung, je ein Eingriff in dist/:
    // Ereignis-Skript auf support.html entfernt -> "laedt den Zaehler, aber
    // nicht assets/ereignisse.js"; Liste in der Datei um ein Feld q erweitert
    // -> "weicht vom SOLL ab" + Probe "0 gesendet, Soll 1"; p.title = ''
    // gestrichen -> 8 Proben "Seitentitel geht mit"; data-ev-filter="typ-name"
    // -> "steht nicht in FILTER"; isTrusted-Pruefung gestrichen -> Probe
    // "Filter aus ?Parametern: 1 gesendet, Soll 0"; Rechner-Marken auf
    // fracturing.html entfernt -> Klinke 102 < 104 (Klinke seit der
    // Review-Korrektur 112).
    // Melde-Links (C2, Neuzugang 06.11.2026), VORGEFUEHRT ROT gegen den
    // Live-Bau der Melde-Aenderung, je ein Eingriff in dist/: Link einer
    // Item-Seite auf den Pfad einer anderen Item-Seite -> "Melde-Link zeigt
    // auf ..., Soll ... eigener Pfad"; data-ev-melden auf items.html -> "auf
    // einer Seite, die keine Detailseite ist"; Ereignis in
    // assets/ereignisse.js umbenannt (wert-meldung) -> "weicht vom SOLL ab";
    // Detailseiten-Pruefung vor senden('wert-melden') gestrichen -> Probe
    // "Wert melden von einer Werkzeugseite (keine Detailseite): 1
    // Ereignis(se) gesendet, Soll 0". Danach wiederhergestellt und gruen.
    // Ereignis extern (Neuzugang 11.11.2026), VORGEFUEHRT ROT gegen den
    // Live-Bau der Aenderung, je ein Eingriff: data-ev-extern am Stripe-Knopf
    // in dist/support.html gestrichen -> "nur 1 Ziel-Marken data-ev-extern,
    // Klinke 2"; dist/assets/ereignisse.js schickt den Host statt der Art ->
    // 4 Proben "0 Ereignis(se) gesendet, Soll 1" (die Liste verwirft jede
    // Adresse); discord.gg in der Datei auf „sonst“ -> "EXTERN_HOSTS weicht
    // vom SOLL ab" + Probe "Daten … ziel sonst statt discord"; youtu.be ins
    // SOLL ohne Link im Bau -> "nennt youtu.be, aber keine gezaehlte Seite
    // verlinkt dorthin (Zombie)". Danach wiederhergestellt und gruen.
    // Bedienung auf der Seite (Neuzugang 11.11.2026, treffer-offen, merken,
    // video, bilder, hilfe), VORGEFUEHRT ROT gegen den Live-Bau, je ein
    // Eingriff: Hilfe-Marke auf de/missionen.html gestrichen -> Klinke 43 <
    // 44; Knopf in der Trefferkarte zaehlt mit -> Probe "3 gesendet, Soll 2";
    // Schliessen der Hilfe zaehlt mit -> Probe "1 gesendet, Soll 0";
    // fleet.js meldet was: 'flotten' -> "kein Wert aus MERKEN" + "MERKEN
    // flotte: kein Aufruf"; data-ev-treffer auf support.html -> "kein
    // gezaehltes Werkzeug, die Marke waere tot". Danach gruen.
    // Review-Korrektur (CodeRabbit, 11.11.2026), VORGEFUEHRT ROT: Kuerzung
    // der Pilotenprofile gestrichen -> Probe "url /de/pilot/probe-handle
    // statt /de/pilot/"; auxclick-Horcher gestrichen -> 2 Proben "0
    // gesendet". Danach gruen.
  },
  {
    id: 'audit:site',
    npm: 'audit:site',
    script: 'scripts/audit-site.mjs',
    rail: 'A',
    checks: 'Publish-Audit ueber alle gebauten Seiten: tote Links und Anker, Sprachumschalter-Ziele, Sitemap gegen Build, Platzhalter, Rohtext je Textstelle (NaN, undefined, null neben Vergleichs- und Mengenzeichen, rohe {Spielplatzhalter}, ungefuellte %schluessel%, interne Rangschluessel; Klinke fuer die Zahl der Textstellen), Platzhalterwert "-1" als ganzer Textknoten, Mojibake, A11y-Basics — und die Datenherkunfts-Regel, die es als einziges Tor traegt',
    // Platzhalterwert "-1" (Neuzugang 04.11.2026), VORGEFUEHRT ROT gegen den
    // Live-Bau von origin/staging d76478f2: 182 Missionsseiten (91 je
    // Sprache) mit "Spieler je Instanz: -1". Die erste Fassung meldete dazu
    // 2 Raffinerie-Zellen "−1" (U+2212, bewusst gesetztes Delta neben "+2")
    // und wurde auf den ASCII-Bindestrich verengt, den String(-1) liefert.
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
  {
    // Neuzugang 10.11.2026, neben verify:datastand (dieselbe Familie: eine
    // Datendatei gegen ihre Verwendung). Anlass: Vorschlag aus #feedback
    // „Loot-only Items – Find Locations" — Item-Seiten und Item Finder zeigen
    // seit dieser Lieferung bestaetigte Fundorte (Ortsart + Himmelskoerper).
    // Die Kette Datenlauf -> Ortsarten-Zuordnung -> Katalog kann an jedem
    // Glied still reissen und sieht dann aus wie „kein Fundort".
    // Kein git, kein Netz, kein Kindprozess: committete JSON und dist/.
    id: 'verify:loot-fundorte',
    npm: 'verify:loot-fundorte',
    script: 'scripts/verify-loot-fundorte.mjs',
    rail: 'A',
    checks:
      'jede Belegung aus src/data/loot-fundorte.json hat eine Ortsart mit Spielernamen oder steht benannt unter VERSTECKT, jede Zuordnung in scripts/lib/loot-orte.mjs kommt in den Daten noch vor (Zombie-Waechter), jeder Himmelskoerper hat einen Namen; assets/universal-items.json steht auf dem Stand der Rechnung (Kopf fundorte, fund je Item, Kennzahlen), kein Fundort an einem Item, das laut Spiel kein Loot ist, und dist/ traegt denselben Stand (Kopf, Zahl und `fund` je Item); Klinken fuer Belegungen, Spiel-Items, Katalog-Items mit Fundort und Ortsarten',
    // VORGEFUEHRT ROT am 10./11.11.2026 am Stand dieser Lieferung, drei
    // Gegenproben, je Datei zurueckgespielt und per sha256 geprueft:
    // (1) vor dem Bau gegen das alte dist/: 1 FEHLER „dist/assets/universal-
    //     items.json weicht ab" (dist/: 0 Items mit Profil, assets/: 3.068);
    // (2) Belegung V3SlotPreset_Loot_Military in den Daten umbenannt (wie ein
    //     Patch es taete): 3 FEHLER — neue Belegung ohne Ortsart, Zuordnung
    //     bunker zeigt ins Leere, Ortsart bunker ohne Belegung;
    // (3) im Katalog `fund` an Gamma LL entfernt und an einem Item mit
    //     lootable false gesetzt: 2 FEHLER — 2 Items weichen von der Rechnung
    //     ab, 1 Fundort an einem Item, das laut Spiel kein Loot ist.
    // Gruen danach: 54 Belegungen, 3.068 Katalog-Items, 20 Ortsarten.
    // [7] je Item (Nachpruefung von #338 durch CodeRabbit, PR #343,
    // 11.11.2026): Kopf und Zahl allein liessen ein vertauschtes Profil
    // durch. VORGEFUEHRT ROT: in dist/ `fund` von quantainium-water-bottle
    // (0) und a03-sniper-rifle (1) getauscht, Kopf und Zahl gleich: 1 FEHLER
    // „2 Item(s) mit anderem Fundort-Profil". Zurueckgespielt, gruen: 9.412
    // Items je Item verglichen, 0 abweichend.
  },
  {
    // Direkt nach verify:datastand — dasselbe Thema, die andere Seite der
    // Kette: verify:datastand haelt die Datendateien gegeneinander, dieses Tor
    // haelt die GEBAUTEN SEITEN gegen ihre Datendatei (Grundsatz 7). Anlass:
    // am 03.11.2026 war verify:datastand gruen (alles 4.10.2), waehrend die
    // Mining-Datenbank "Star Citizen 4.9" hiess, der Item Finder "Patch 4.9"
    // zeigte und Wikelo "Star Citizen 4.1" — von Hand geschriebene Literale,
    // die kein Datenlauf mithebt. Kein git, kein Netz, kein Kindprozess: nur
    // dist/ und committete JSON.
    id: 'verify:patch-angaben',
    npm: 'verify:patch-angaben',
    script: 'scripts/verify-patch-angaben.mjs',
    rail: 'A',
    checks:
      'jede Stand-Angabe ("Star Citizen X", "Patch X", "Spielversion X") in Titel, Beschreibung, Vorschau-Tags, JSON-LD und Text der Datenseiten (Items, Crafting, Mining, Missionen, Schiffe, Refinery, Wikelo) passt zur Kennung ihrer Datendatei, jede Schiffsseite zeigt die Spielversion ihres Datensatzes, und jeder Fahrzeug-Stempel passt zum Katalogkopf; jede Datenseite (Items, Item Finder, Blueprints, Crafting-Werkzeug, Missionen, Schiffe, Refinery, Mining, Fracturing) traegt genau einen Datenstand-Baustein und keine alte Fusszeile „Daten-Stand" am Ende ihres Inhalts, dessen Zeilen nach Quelle, Art, Wert, Wertegruppe, Quellname und Link, wortgleichem Text und Etikett „älterer Stand" zur Datendatei passen (Pflichtzeilen, bedingte Zeilen genau dort, wo die Seite die Werte zeigt: Kaufpreise von UEX, Kaufpreise aus dem eigenen Shop-Schnappschuss, Fundorte, FleetYards-Teile, 3D-Hülle; jedes Item-Datenblatt markiert so viele Bezugszeilen als Shop-Schnappschuss und so viele als bestaetigten Fundort, wie der Katalog fuehrt, und jedes Item mit Fundort-Profil hat ein Datenblatt; mining-model.json und mining-db.json auf derselben Fassung; keine fremden oder doppelten Zeilen, kein ISO-Datum im Text; Alter der Fremdquellen nur genannt), und auf Item-, Blueprint-, Missions- und Schiffsseiten genau ein Link „Falschen Wert melden" im Baustein auf das Formular ihrer Sprache mit dem eigenen Pfad, auf allen anderen Datenseiten keiner; und [7] die Schiffstabelle im Patch-Dossier: jede Zeile mit eigener Schiffsseite zeigt Crew, Fracht und Pledge-Preis ihres Datensatzes in vehicles.json (formatiert wie die Schiffsseite), Zeilen ohne eigene Seite zeigen keine Werte, und die Quellenzeile darunter nennt genau die Spielversion der gezeigten Datensaetze und den Wiki-Schnappschuss (je mit Art, Wert, Text und Link) (nur wo Pledge-Preis oder Hoechstcrew dastehen), nie FleetYards; Ausnahmen benannt mit Zombie-Waechter, Klinken je Familie, je Seitengruppe, fuer Melde-Links und fuer das Dossier',
    // VORGEFUEHRT ROT am 04.11.2026 gegen den ausgelieferten Stand 4f4f4ddd
    // (Live-Bau): 35 FEHLER — Mining-Titel/Beschreibung/Vorschau "4.9" und
    // JSON-LD "4.8.0" (DE+EN), Item Finder "Patch 4.9" (DE+EN), Wikelo-Titel
    // "4.1" und JSON-LD "4.1.0", Crafting-JSON-LD "4.7.0", acht ATLS-
    // Schiffsseiten ohne Spielversion. SCHARF seit derselben Lieferung, die
    // die Seiten korrigiert hat (Angaben aus der Kennung, patchFromKennung in
    // src/lib/patchPages.ts). Gegenprobe danach: Item-Kennung in
    // assets/universal-items.json auf 4.11.0 gehoben, ohne neu zu bauen — rot,
    // genau der Fall "Datenlauf hebt die Datei, die Seite bleibt".
    // [6] Datenstand-Baustein (Neuzugang 06.11.2026), VORGEFUEHRT ROT gegen
    // den Live-Bau der Baustein-Aenderung, je ein Eingriff in dist/:
    // Baustein auf einer Item-Seite entfernt -> "kein Datenstand-Baustein";
    // UEX-Datum im Text auf 12. Oktober -> "zeigt ..., Soll enthaelt as of
    // October 11, 2026"; Spielversion einer Schiffsseite auf 4.10.1 ->
    // "nennt 4.10.1, Stempel ... steht auf 4.10.2" + Textbefund; Etikett am
    // Wiki-Schnappschuss gestrichen -> "das Etikett älterer Stand fehlt";
    // Etikett an die Spielwerte-Zeile gesetzt -> "traegt älterer Stand ohne
    // Tatsache"; Pflichtzeile items gestrichen -> "Pflichtzeile fehlt";
    // ISO-Datum in den Text -> "ISO-Datum 2026-10-11 im sichtbaren
    // Datenstand"; Bild-Zeile doppelt -> "doppelt". Danach wiederhergestellt
    // und gruen.
    // Nachgeschaerft nach dem Review zu #306 (06.11.2026), VORGEFUEHRT ROT
    // gegen den Live-Bau der Korrektur: Absatz nach dem Baustein -> "nach dem
    // Datenstand steht noch Inhalt"; Fundorte-Zeile auf einer Liste mit
    // Loot-Ort gestrichen -> "die Seite zeigt Loot-Fundorte, die Zeile
    // fundorte fehlt"; Fundorte-Zeile auf einer Seite ohne Loot -> "steht im
    // Datenstand, die Seite zeigt diese Werte aber nicht"; Wertegruppe
    // umbenannt -> "heisst Prices:, Soll Purchase prices:"; UEX-Link
    // umgebogen -> "nennt die Quelle ... Soll UEX Corp -> uexcorp.space";
    // UEX-Datum auf 12. Oktober -> "zeigt ..., Soll ... October 11, 2026"
    // (jetzt wortgleich statt enthaelt); Huellen-Zeile auf einer Schiffsseite
    // mit eigenem Modell gestrichen -> "zeigt die eigene 3D-Hülle, die Zeile
    // huelle fehlt"; Lackierungen aus der FleetYards-Zeile gestrichen ->
    // "heisst variants:, Soll Paints, variants:"; Fundorte-Zeile im Item
    // Finder gestrichen -> "Pflichtzeile fehlt". Danach wiederhergestellt und
    // gruen.
    // Bestaetigte Fundorte je Datenblatt (Nachpruefung von #338 durch
    // CodeRabbit, PR #343, 11.11.2026): vorher nur Seiten gezaehlt, und die
    // Kategorielisten fuellten die Zahl auf. VORGEFUEHRT ROT gegen den
    // Live-Bau: auf de/items/gamma-ll-1x-holographic.html eine von 9
    // bestaetigten Zeilen ohne Marke -> „8 Zeile(n) als bestätigter Fundort,
    // der Katalog ... fuehrt 9" (die alte Zaehlung blieb dabei gruen: 6.276
    // Seiten gegen Soll 6.136). Zurueckgespielt, gruen: 3.068 Items, 6.136
    // Datenblaetter, 66.830 Zeilen.
    // Melde-Link im Baustein (C2, 06.11.2026), VORGEFUEHRT ROT gegen den
    // Live-Bau der Melde-Aenderung: Link auf einer Item-Seite entfernt -> "0
    // Links ... (Soll: genau einer auf Detailseiten)"; Link auf eine fremde
    // Seite -> "zeigt auf ..., Soll ..."; Linktext "Report" -> "heisst
    // Report, Soll Report a wrong value"; Link auf items.html -> "auf einer
    // Seite, die keine Detailseite ist". Danach wiederhergestellt und gruen.
    // [7] Patch-Dossier (C1b, Neuzugang 06.11.2026), VORGEFUEHRT ROT gegen
    // den Live-Bau der Dossier-Aenderung, je ein Eingriff in dist/: Fracht
    // einer Zeile 2.200 -> 2.100 SCU -> "Fracht „2.100 SCU", der Datensatz
    // ... sagt „2.200 SCU""; Wert in einer Zeile ohne eigene Schiffsseite ->
    // "hat keine eigene Schiffsseite, zeigt aber Werte"; Quellenzeile
    // entfernt -> "die Quellenzeile darunter fehlt"; Spielversion der
    // Quellenzeile auf 4.10.1 -> "ohne ... 4.10.2" + "nennt ... 4.10.1, die
    // Tabelle zeigt dazu keine Werte"; Wiki-Angabe gestrichen -> "ohne
    // „Pledge-Preis, Höchstcrew ..."; FleetYards in die Zeile -> "nennt
    // FleetYards" + "beginnt ..."; Etikett älterer Stand gestrichen -> "zeigt
    // ..., Soll ... älterer Stand"; Tabelle einer Seite umbenannt -> Klinken
    // 33 < 34, 62 < 64, 54 < 56. Danach wiederhergestellt und gruen.
    // Nach dem Review von #308 prueft [7] auch data-stand-art (Spielversion
    // "spiel", Wiki "schnappschuss"), VORGEFUEHRT ROT: Art der Spielversion
    // auf "wert" -> "hat data-stand-art "wert", Soll "spiel""; Art der
    // Wiki-Angabe entfernt -> "hat data-stand-art null, Soll
    // "schnappschuss"". Danach wiederhergestellt und gruen.
    // Reste aus C1 (06.11.2026): Shop-Schnappschuss als eigene Zeile, Crafting-
    // Werkzeug und Fracturing mit Baustein. VORGEFUEHRT ROT gegen den Live-Bau
    // der Aenderung, je ein Eingriff: Schnappschuss-Zeilen eines Datenblatts
    // als uex-items markiert -> "0 Bezugszeile(n) als Shop-Schnappschuss
    // markiert, der Katalog ... fuehrt 1" + "steht im Datenstand, die Seite
    // zeigt diese Werte aber nicht" + "Zeile uex-items fehlt"; Marke am Preis
    // entfernt -> "die Seite zeigt Kaufpreise, die Zeile uex-items fehlt";
    // Schnappschuss-Zeile auf einer Kategorieliste und im Finder gestrichen ->
    // "zeigt Kaufpreise aus dem eigenen Shop-Schnappschuss, die Zeile fehlt";
    // Text der Zeile geaendert -> "zeigt ..., Soll ..."; alte Fusszeile in
    // fracturing.html -> "Fusszeile Daten-Stand neben dem Datenstand";
    // Baustein auf topics/crafting.html entfernt -> "kein Datenstand-
    // Baustein"; Ausbeute-Zeile in de/fracturing.html -> "gehoert nicht auf
    // Fracturing"; de/fracturing.html umbenannt -> "nur 1 Seiten ..., Klinke
    // 2"; mining-model.json auf 4.10.1 -> "steht auf 4.10.1, mining-db.json
    // auf 4.10.2". Danach wiederhergestellt und gruen.
  },

  {
    // Neuzugang 04.11.2026 — direkt nach den Patch-Angaben: dieselbe Frage
    // ("stimmt, was die Seite sagt?"), andere Achse (Sprache statt Stand).
    // Anlass: alle 231 deutschen Schiffsseiten zeigten Leistungsprofil,
    // Quantum, Versicherung und Kaufpreise englisch und im englischen
    // Zahlformat, 284 deutsche Seiten insgesamt englische Oberflaechentexte;
    // verify:sync vergleicht nur die Geruestform, audit:site nur <html lang>.
    // Kein git, kein Netz. Liest dist/, src/ und die i18n-Kataloge; die
    // Kataloge buendelt esbuild (wie bei verify:crafting und verify:ausgabe),
    // das ist der einzige Kindprozess (esbuilds eigener Dienst, kein
    // node:child_process im Skript) und schreibt einen Temp-Ordner, der danach
    // geloescht wird.
    id: 'verify:sprache',
    npm: 'verify:sprache',
    script: 'scripts/verify-sprache.mjs',
    rail: 'A',
    checks:
      'jede gebaute Seite spricht ihre Sprache: kein mehrwortiger Katalogtext der anderen Sprache, Zahlen im eigenen Format (eindeutige Formen), Datum und Dezimalzahl (als ganze Stelle oder mit Einheit mitten im Text) im eigenen Format, kein Katalogschluessel als Text, kein interner Bezeichner aus den Spieldaten im sichtbaren Text (offene Stellen als benannte Ausnahmen mit Zombie-Waechter), kein "The The" aus einer Satzvorlage, kein deutsches Funktionswort, kein Wort mit Umlaut und kein deutsches Bedien-/Zeitwort auf EN-Seiten (fester Text im Markup, den kein Katalog kennt; Eigennamen als benannte Ausnahme), und in src/ keine stille Standardsprache (lang = \'en\' / = DEFAULT_LOCALE; assertLocale statt Vorgabe); deutsches Katalog-Einzelwort auf EN-Seiten als WARNUNG mit benannten Ausnahmen; Klinken fuer Seiten, Textstellen, Katalogtexte und Quelldateien',
    // VORGEFUEHRT ROT am 04.11.2026 gegen den Live-Bau von origin/staging
    // d76478f2: 3.027 Befunde — 2.202 Katalogtexte der anderen Sprache
    // (deutsche Kategorielisten "Promotional item — not obtainable in-game",
    // deutsche Schiffsseiten "Claim time", "Quantum speed" …), 805 englische
    // Zahlen auf deutschen Schiffsseiten ("1,508,220 aUEC"), 4 "The The",
    // 16 stille Standardsprachen in src/. Gruen nach der Korrektur derselben
    // Lieferung. Regel 4 (Rohschluessel) vorgefuehrt am gruenen Bau mit
    // zwei eingesetzten Textknoten "ship.sheet.title" (/de/schiffe/…) und
    // "breadcrumbItems" (/item-finder.html): 2 FEHLER, beide Formen
    // (Punkt-Schluessel und camelCase-Katalogschluessel). Den Weg dorthin
    // versperrt seit derselben Lieferung der Bau selbst: t()/itemT() brechen
    // bei unbekanntem Schluessel ab (tests/e2e/i18n-strikt.test.js, gegen
    // den alten Rueckfall rot: "Missing expected exception").
    // Regel 7 (deutsches Funktionswort auf EN-Seite) kam in derselben
    // Lieferung dazu, rot am eigenen Zwischenbau: 1 FEHLER, „0 Items
    // gefunden" als Startwert des Zerlege-Rechners auf /topics/crafting.html
    // — ueber 8.880 EN-Seiten der einzige Fund.
    // Gegenprobe gegen den Stand vor PR #289 (4f4f4ddd, Live-Bau): 3.033
    // FEHLER, dieselben Klassen plus 5 deutsche Zweitnamen auf EN-Item-
    // Seiten ohne lang-Attribut (seitdem lang="de" am Zweitnamen).
    // Regeln 8-10 (Datum, Dezimalzahl, deutsches Wort auf EN) kamen am
    // 04.11.2026 mit der Inhaltsvalidierung der Werkzeuge dazu. VORGEFUEHRT
    // ROT gegen den Live-Bau von origin/staging 286f28c6: 460 FEHLER — 34
    // Daten ("9. Oktober 2026" in der Zeitleiste von 31 EN-Schiffsseiten,
    // "28. Jan – 28. Feb 2025" und "16.09.2026 bis 4.10.2" als Event-
    // Zeitraum der EN-Patch-Seiten), 394 Dezimalzahlen auf DE-Seiten ("0.01
    // SCU" Item-Volumen, "8.75 m" in der Schiffsliste, "0.2 s" auf 4.10.2),
    // 32 deutsche Woerter auf EN ("Stabilität & Save Stanton II", "saisonal",
    // "Ressource suchen..."). Gruen nach der Korrektur derselben Lieferung;
    // die eine Ausnahme (Schlossstraße, Anbieteranschrift) ist in Gebrauch.
    // Positiv- und Gegenbeispiele je Ausdruck: tests/e2e/textregeln.test.js.
    // Luecken aus der Staging-Abnahme am selben Abend: Regel 9 sah nur die
    // ganze Stelle, Regel 11 (interner Bezeichner) gab es nicht. Erweitert
    // VORGEFUEHRT ROT gegen den Vorschau-Bau von 0db33536: 1.275 FEHLER
    // Dezimalzahl — 691 auf /de/schiffe ("L 20 m · B 15 m · H 6.5 m",
    // "Grundriss 6.5 m lang", "Agilität: 97.0 °/s Ø" im aria-label), 584
    // englische Spieltexte auf DE-Itemseiten ohne lang="en" ("Carrying
    // Capacity: 8.0 µSCU"). Regel 11 im selben Lauf: 9.154 Stellen in genau
    // den drei benannten offenen Klassen (Angebote-Spalte "Eintrag" 7.512,
    // Orte als Code 1.624, Platzhalter-Bauteile 18), sonst keine.
  },
  {
    // Neuzugang 04.11.2026, gleich danach: dieselben Textregeln, aber fuer
    // den Text, den die Werkzeuge erst im Browser bauen — Teil 1 der Item
    // Finder vollstaendig, Teil 2 (seit der Inhaltsvalidierung am selben
    // Abend) jede Seitenart bedient, mit dem Pruefstand
    // scripts/lib/pruefstand.mjs (linkedom-DOM, Skripte in node:vm). Kein
    // git, kein Netz — fuehrt die ausgelieferten Skripte aus und liest
    // dist/; fuer die Kataloge und die Astro-Module wie verify:sprache
    // esbuild (dessen Dienst ist der einzige Kindprozess, Temp-Ordner wird
    // geloescht). Laufzeit gut 95 s, davon 55 s der Crafting-Rechner.
    id: 'verify:clienttext',
    npm: 'verify:clienttext',
    script: 'scripts/verify-clienttext.mjs',
    rail: 'A',
    checks:
      'der Item Finder rendert aus dem ausgelieferten Skript, Katalog und Datenstand jede Karte, jedes Modal (mit Crafting-Abschnitt) und jedes Set beider Sprachen; dazu laedt der Pruefstand je Sprache eine Seite jeder Seitenart (gleiche Skripte, gleiche Inline-Form), fuehrt ihre Skripte aus und bedient Auswahllisten, Regler, Haken, Knoepfe, Reiter, Suchfelder und die Klickziele der Skripte; jeder geschriebene Text und jedes gelesene Attribut ohne Rohtext (NaN, undefined, null neben Zeichen, {Platzhalter} beider Schreibweisen, Vorlagenrest, ungerundete Zahl, "-1" als Wert), ohne Katalogtext oder deutsches Wort der anderen Sprache, mit Zahl, Dezimalzahl und Datum im eigenen Format, ohne Rohschluessel und ohne internen Bezeichner aus den Spieldaten; kein Skript bricht beim Laden oder Bedienen ab; jeder woertliche tr()-Schluessel des Item Finders und des Crafting-Rechners steht im Katalog beider Sprachen, und jeder beim Rendern gefragte (auch zusammengesetzte) Schluessel steht in beiden oder in keinem; Klinken fuer Items, Modals mit Crafting, Sets, Textstellen, Schluessel, Seitenarten, Bedienschritte, geschriebene Texte und je Werkzeug',
    // VORGEFUEHRT ROT am 04.11.2026 mit dem Skript vor dem Schild-Fix
    // (ab3ada96^:assets/item-finder-app.js) gegen den aktuellen Bau: 122
    // "Physical NaN% · Distortion NaN%" (61 Schilde je Sprache) — der Fehler
    // vom 03.11.2026, den bis dahin keine Pruefung sehen konnte. Gegen
    // origin/staging d76478f2 dazu 597 englische Bezugsarten im Tooltip der
    // deutschen Karten. Gruen nach der Korrektur. Gegenprobe gegen den
    // ganzen Stand vor PR #289 (4f4f4ddd, Skript und Bau): 719 FEHLER =
    // 122 NaN + 597 Bezugsarten.
    // Laufzeit-Paritaet (Review 04.11.2026, zusammengesetzte Schluessel wie
    // tr('slot' + k)): rot am gruenen Bau mit "slotTorso" aus dem EN-Katalog
    // von dist/item-finder.html entfernt — 1 FEHLER "tr('slotTorso') beim
    // Rendern gefragt, steht nur im DE-Katalog"; die woertliche Regel 5 sah
    // ihn nicht. Gruen mit dem unveraenderten Bau.
    // Teil 2 VORGEFUEHRT ROT gegen den Live-Bau von origin/staging 286f28c6:
    // 526 FEHLER — 20 Missionstitel mit Spielplatzhaltern im Blueprint-
    // Fenster des Crafting-Rechners ("Wanted: {TargetName}"), 199 deutsche
    // Vorlesetexte auf EN-Seiten ("Bild öffnen: Pyro", "… Trailer
    // abspielen" aus assets/detail.js und assets/a11y.js), 297 Dezimalzahlen
    // im Finder-Modal der DE-Seite ("4.2 SCU"), 10 Abbrueche (Pruefstand
    // ohne document.currentScript und form.reset, ein versteckter Knopf
    // geklickt — im Pruefstand behoben). Gruen nach der Korrektur.
    // Rohtext-Erweiterung, Abbruch und Werkzeug-Klinke rot am gruenen Bau
    // mit einer Hardlink-Kopie von dist/, darin eingesetzt: Qualitaetsrechner
    // ohne Rundung, mit 1e21 und mit '${k}' in einfachen Anfuehrungszeichen,
    // Trefferzahl ohne .replace('{count}'), und mining-workbench.js wirft
    // beim Start: 20 FEHLER — "110.00000000000001", "1e+23", "${",
    // "{count} kompatible Items gefunden", "-82.5" (Dezimalpunkt auf DE),
    // 2 Abbrueche, /topics/mining.html 3 und /de/topics/mining.html 8 Texte
    // unter der Klinke 1.000, Summe 9.464 unter 10.500. Pruefstand-Zusagen:
    // tests/e2e/pruefstand.test.js.
    // Vorschau-Bau (STAGING=1) am selben Tag: 4 Abbrueche auf den Hangar-
    // Seiten (Import "/assets/hangar-overview.js?v=…", top-level await mit
    // import(root.dataset.lib) in hangar-loadout.js), danach 6 mit <dialog>
    // ohne showModal/close — Luecken des Pruefstands, dort behoben; gruen
    // mit unveraendertem Bau.
    // Dezimalzahl mitten im Text und interner Bezeichner (Luecken aus der
    // Staging-Abnahme, Regeln aus scripts/lib/textregeln.mjs) VORGEFUEHRT
    // ROT gegen den Live-Bau desselben Abends: 726 FEHLER — 100 Stellen von
    // 25 Lackierungen mit dem Logo-Schluessel als Hersteller im Finder
    // ("Paint_Defender_Silver_Red_Logo"), 605 englische Spieltexte im
    // DE-Modal ohne lang="en" ("Carrying Capacity: 8.0 µSCU"), 21
    // "Kreuzungsfaktor 0.810 · 35.9° von radial" auf /de/precision-jump.html.
    // Gruen nach der Korrektur derselben Lieferung.
    // Woertliche Schluessel des Crafting-Rechners (Regel 5 auch fuer
    // assets/crafting-app.js gegen window.__CRAFT.t) VORGEFUEHRT ROT am
    // 11.11.2026 gegen den Bau von a57d76df: 4 FEHLER — tr('category') und
    // tr('calcLocation') in keinem der beiden Kataloge; die Ergebniskarten
    // des Zerlege-Rechners zeigten auf der englischen Seite "Kategorie: … ·
    // Kaufort: …", auch live. Teil 2 sah es nicht: die Karten entstehen erst
    // mit angekreuztem Material und geladener Rezept-DB, und keines der
    // Woerter traegt einen Umlaut. Gruen mit beiden Schluesseln im Katalog.
  },
  {
    // Neuzugang 04.11.2026, ans Ende von Schiene A: mit ~90 s die langsamste
    // Strecke, und sie braucht dist/ nicht. Anlass: tsconfig.json stand seit
    // Beginn auf strict, aber kein Tor fuhr einen Typcheck; der erste Lauf fand
    // 93 Fehler, darunter einen sichtbaren (Suchfeld ohne Platzhalter im
    // Zerlege-Rechner). Benannte Abweichung von Grundsatz 7 (gegen das
    // Artefakt pruefen): Typen gibt es im gebauten Stand nicht mehr, also
    // bleibt nur die Quelle.
    // Kein git, kein Netz, kein Kindprozess: astro sync und der Pruefer von
    // @astrojs/check laufen im eigenen Prozess. Speicher: bis ~3 GB, das
    // npm-Skript hebt Nodes Grenze (Vorgabe ~2 GB, darunter bricht V8 ab).
    id: 'verify:typen',
    npm: 'verify:typen',
    script: 'scripts/verify-typen.mjs',
    rail: 'A',
    checks:
      'astro check ueber das Programm aus tsconfig.json (.astro samt <script>, .ts, JS mit @ts-check) meldet 0 Fehler; tsconfig.json erbt von astro/tsconfigs/strict und schaltet kein strict-Glied ab; kein @ts-ignore/@ts-nocheck/@ts-expect-error in src/ und astro.config.mjs ausser als benannte Ausnahme; jeder exclude-Eintrag ist eine benannte Ausnahme mit Zombie-Waechter (supabase/functions: Deno-Laufzeit, deren deno check kein Tor faehrt); jede .astro- und .ts-Datei unter src/ steht im geprueften Programm; Klinken fuer Dateien gesamt, .astro und .ts; Warnungen gezaehlt, nicht blockierend',
    // VORGEFUEHRT ROT am 04.11.2026 gegen den Stand von PR #292 (8f24ff7a,
    // Fehlerbild gleich origin/staging d76478f2) mit diesem Skript: 93 FEHLER
    // in 21 Dateien — 30 in supabase/functions (Deno), 63 in src/, darunter
    // das Suchfeld ohne Platzhalter (CraftingApp.astro, TS2339) und der
    // Aufruf vor der Deklaration (account-dashboard.ts, TS2448). Dazu der
    // Zombie "supabase/functions steht nicht in exclude". Gruen nach der
    // Korrektur derselben Lieferung (0 Fehler, 661 Dateien).
    // Regeln einzeln, am gruenen Stand in einem Lauf: noImplicitAny:false in
    // tsconfig.json, ein @ts-ignore in src/lib/sitemap.ts, ein unbenanntes
    // exclude "src/pages/de/downloads.astro", supabase/functions umbenannt und
    // ein Typfehler in MissionDetail.astro — 6 FEHLER: abgeschaltetes strict-
    // Glied, Unterdrueckung, unbenannte Ausnahme, Zombie-Ausnahme, 31
    // Typfehler (1 + die 30 der nun mitgeprueften Deno-Funktionen) und die
    // Datei, die still aus dem Programm fiel.
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
  {
    // Anlass: Gesamtaudit 05.11.2026. Edge Functions rollt kein Workflow aus,
    // und Repository und Anlage wichen voneinander ab (Einzelheiten im Bericht
    // des Audits). Vorgefuehrt rot gegen eine Momentaufnahme der Anlage (Exit 1)
    // und gegen einen flachen Klon (Exit 2, nicht geprueft).
    id: 'verify:functions',
    npm: 'verify:functions',
    script: 'scripts/verify-functions.mjs',
    rail: 'B',
    checks:
      'jede Edge Function aus supabase/functions laeuft auf der Anlage, ihr letzter Commit ist nicht juenger als der letzte Deploy, und verify_jwt entspricht supabase/config.toml (Standard true) — sonst FEHLER; Functions nur auf der Anlage sind WARNUNG; Klinke fuer die Zahl der Functions',
    env:
      'Netz und git: fetch() gegen https://api.supabase.com (Management API, GET /v1/projects/<ref>/functions) mit SUPABASE_ACCESS_TOKEN aus der Umgebung — dasselbe persoenliche Zugriffstoken wie verify:db-rights, das es weder im Build-Container noch in CI gibt — und git log (Kindprozess per execFileSync) fuer den letzten Commit je Function-Verzeichnis; deshalb Schiene B. Ohne Token oder ohne git: Exit 2 "nicht geprueft", nie still gruen. Offline: --snapshot <datei> mit der Function-Liste als JSON.',
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
      'die Leitseiten in einem echten Browser: keine JS-Ausnahme, keine eigene Ressource >= 400, kein CSP-Verstoss (alle drei auch nach dem Aufbau der Seite, waehrend der Proben und in Seiten in einem Rahmen), jedes eigene Stilblatt geladen (auch in Seiten, die eine Probe im Rahmen wieder verlaesst), Leitelement wirklich sichtbar, kein waagerechter Ueberlauf, und die Werkzeuge filtern wirklich',
    env:
      'Netz: laedt die Seiten ueber http gegen das Ziel aus --base/SMOKE_BASE und holt vorab dessen robots.txt per fetch(), um Vorschau- von Live-Build zu unterscheiden. Braucht ausserdem einen laufenden Server UND einen installierten Browser — beides gibt es im Build-Container (node:22-alpine) nicht, deshalb Schiene C statt A. Laeuft im Workflow gegen den frisch gebauten Container (vor dem Push), lokal gegen astro preview oder eine URL. FREMDE Hosts werden abgebrochen und nicht gewertet: CI hat keinen verlaesslichen Weg ins Netz, und der Ausfall eines Dritten ist kein Fehler dieser Seite.',
  },

  {
    id: 'check:hangar-shader',
    npm: 'check:hangar-shader',
    script: 'scripts/check-hangar-shader.mjs',
    rail: 'C',
    checks:
      'kein Bildshader des 3D-Hangars braucht mehr als 16 Texturen (die Grenze von Chrome unter Windows; darueber linkt das Programm dort nicht und sein Material bleibt unsichtbar): auf hoch mit ganzer Hallendeko je gelinktem Programm selbst gezaehlt, kein Programm linkt nicht, die Zeile des Viewers ist da, Klinken fuer Programme und Programme mit Schichttafel. Dazu die Freigabe der Bilder nach dem Hochladen (13.11.2026, rund 1 GB Arbeitsspeicher in der hohen Stufe): der Viewer verlangt auf dem gefahrenen Weg kein freigegebenes Bild noch einmal (sonst zeigte die Flaeche eine Farbe statt ihrer Karte), und er gibt mindestens so viele Bilder frei wie die Klinke. Dazu die Freigabe der Geometrie der Halle nach dem Hochladen (13.11.2026, 159 MB Arbeitsspeicher in der hohen Stufe): auf dem gefahrenen Weg liest niemand einen freigegebenen Puffer noch einmal (sonst rechnete er mit einem leeren), und der Viewer gibt mindestens so viele MB frei wie die Klinke. Dazu die Shader der Vollbildpaesse (13.11.2026): Verdeckung, Entrauscher und Schein sind vorab im Hintergrund uebersetzt, das Probebild zeichnet jeden Pass mit einem Programm, das es vorher schon gab (sonst steht die Seite beim Laden 1,2 s, und kein Bild sieht anders aus)',
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
      'Netz: fetch() gegen <base>/build.json; weist der Bot-Schutz das ab (401/403/429), gegen <base>/build.txt (derselbe Stempel unter einer Endung, die Cloudflare als statisch fuehrt); kommt /build.txt aus Cloudflares Zwischenspeicher, zaehlt die Antwort nicht. Kindprozess + git: execFileSync("git", ["rev-parse", …]) ermittelt die Soll-Kennung — das laeuft auf dem Entwicklungsrechner, NICHT im Build-Container (dort gibt es weder git noch ein Repository, siehe cf58c76). Faellt der Aufruf aus, wird nur berichtet statt geurteilt.',
  },

  {
    id: 'check:headers',
    npm: 'check:headers',
    script: 'scripts/check-headers.mjs',
    rail: 'C',
    checks:
      'die AUSGELIEFERTEN Antworten (eine je location-Block, 200, 301, auf der Vorschau 302, live 404) tragen Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options und Referrer-Policy; die Richtlinie steht auf Hashes statt \'unsafe-inline\' (sonst ist nginx auf den Rueckfall gefallen), ohne \'unsafe-eval\', * und reine Schema-Quellen in script-src, mit default-src, object-src \'none\' und base-uri/frame-ancestors \'self\' oder \'none\', und jedes Inline-Skript der ausgelieferten HTML-Antworten hat seinen Hash in der Richtlinie genau dieser Antwort',
    env:
      'Netz: fetch() gegen <base>/… mit redirect:"manual" (die Kopfzeilen der 301/302 selbst zaehlen) — nur eine laufende Seite zeigt, was Cloudflare und nginx wirklich ausliefern, deshalb Schiene C. Dieselbe Cloudflare-Sperre gegen Rechenzentrums-IPs wie bei check:gate (401/403/429): --weich macht daraus eine WARNUNG, vom Entwicklungsrechner aus laeuft es streng. ZWEI ZIELE, wie check:staging/check:live beim selben Pruefer: npm-Skript check:headers fragt die Vorschau, check:headers:live die Live-Domain. Nur die Vorschau laeuft im Workflow mit (deploy-staging.yml, dort kommt der Runner durch). Vor verse-base.com sperrt Cloudflare den Runner nicht bloss, es antwortet auch SELBST — in Lauf 41294060039 kamen 10 von 14 Stichproben mit 403 zurueck und die vier uebrigen vom Cloudflare-Rand statt von nginx, was drei falsche FEHLER ergab. --weich deckt das nicht ab (es entschuldigt nur, was gar nicht durchkommt), deshalb ist der Schritt am 01.11.2026 aus deploy-image.yml entfernt worden und check:headers:live laeuft von Hand.',
  },

  {
    id: 'check:gate',
    npm: 'check:gate',
    script: 'scripts/check-gate.mjs',
    rail: 'C',
    checks:
      'die AUSGELIEFERTE Zugriffskontrolle des Testpilot-Tors: gesperrte Stichproben aus dist/ antworten ohne Cookie mit 302 auf /gate.html mit no-store und ohne Cache-Zeit, /pilot/<handle>?probe=1 behaelt Pfad und Query als next=, jeder Eintrag der Ausnahmeliste aus nginx/default.conf antwortet mit 200, /build.json traegt eine Commit-Kennung (D-07) und /build.txt dieselbe mit Cache-Control no-cache, ein gewuerfelter Wert in der Bypass-Kopfzeile oeffnet das Tor NICHT (T-14-56/T-14-57), und mit dem echten Bypass traegt die Antwort Cache-Control private',
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
    id: 'measure-hangar-innenlage',
    script: 'scripts/measure-hangar-innenlage.mjs',
    rail: null,
    checks: 'misst je begehbarem Innenraum (oder je Container eines Rohexports), wie viele Dreiecke ausserhalb des Rumpfs liegen, und sucht den Versatz, mit dem er hineinpasst',
    why:
      'Erhebungswerkzeug fuer .planning/notes/hangar-innenlage.md (Krisz, 30.10.2026: Innenraeume dabei, jedes Schiff innen und aussen ansehen): Roentgenbilder zeigten Innenraeume, die aus dem Rumpf ragen. ' +
      'Laeuft auf dem PC auch gegen Rohexporte (--roh), um die Lage der Container zu klaeren. Dieselbe Rechnung (scripts/lib/hangar-lage.mjs) prueft verify:hangar-lage als Tor gegen die ausgelieferten Modelle.',
  },
  {
    id: 'measure-hangar-inseln',
    script: 'scripts/measure-hangar-inseln.mjs',
    rail: null,
    checks: 'sucht je Rumpf (oder je Rohexport) Teile, die mehr als 1 m vom Rumpf getrennt ausserhalb seines Huellquaders in der Luft haengen, und nennt Material und (roh) Knotenpfad',
    why:
      'Erhebungswerkzeug fuer .planning/notes/hangar-inseln.md (Krisz, 30.10.2026: jedes Schiff innen und aussen ansehen): Hornet-Fluegelwaffen, ein Feuerloescherschrank ueber dem Avenger und Kleinteile unter der 300i-Reihe hingen frei in der Luft. ' +
      'Laeuft auf dem PC auch gegen Rohexporte (--roh, --mit-ausgeblendet), um zu sehen, ob der Bau ein verbindendes Teil weglaesst. Dieselbe Rechnung (scripts/lib/hangar-lage.mjs) prueft verify:hangar-lage als Tor gegen die ausgelieferten Modelle.',
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
  {
    // Anlass: Live lief auf dem Free-Plan ohne ein einziges Backup
    // (docs/betrieb/datenbank-backup.md). Vorgefuehrt rot am 05.11.2026 mit
    // sechs Gegenproben (ohne vorbereitung.sql, ohne zusatz.sql, eine Zeile
    // entfernt, Rolle ohne BYPASSRLS, Klinke, falsches Projekt); die Sonde
    // probe-backup.yml fuehrt drei davon in jedem Lauf erneut vor
    // (Pruefsumme, Inhalt der Probe, Katalog).
    id: 'verify:backup',
    npm: 'verify:backup',
    script: 'scripts/verify-backup.mjs',
    rail: null,
    checks:
      'eine Datenbanksicherung ist vollstaendig (jede Tabelle der Quelle mit Datenblock, eigene Tabellen in schema.sql, eigene Trigger und Policies in auth/storage sowie die Realtime-Publikation in zusatz.sql, Klinken fuer Konten, Tabellen und Katalogobjekte) und ihre Wiederherstellung gleicht der Quelle (sha256 jeder Datei gegen das Manifest, jedes Katalogobjekt samt Rechten und Policies, Zeilenzahl und sortiert gehashter Inhalt je Tabelle, Sequenzstaende)',
    why:
      'Pruefer ohne Torkette: er braucht einen frischen Dump und eine wiederhergestellte Probe, die es nur im Backup-Lauf gibt (scripts/backup/lauf.sh — taeglich im privaten Backup-Repo gegen Live, bei jeder Aenderung an Skripten oder Migrationen in .github/workflows/probe-backup.yml gegen eine erfundene Quelle). ' +
      'Dort urteilt er per Exit-Code, und ohne Gruen entsteht kein Archiv. Ohne Argumente Exit 2 "nicht geprueft". Liest nur Dateien.',
  },
];

/** Die Strecken einer Schiene, in Laufreihenfolge. */
export const rail = (r) => CHECKS.filter((c) => c.rail === r);

/** Strecken, die momentan ausgesetzt sind — Schuldenposten, immer sichtbar. */
export const disabled = () => CHECKS.filter((c) => c.disabled);

/** Was tatsaechlich laeuft: die Schiene ohne ihre ausgesetzten Strecken. */
export const plan = (r) => rail(r).filter((c) => !c.disabled);
