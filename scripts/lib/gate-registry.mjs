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
      'die Bestandszahlen (Items, Fahrzeuge, Blueprints, gebaute Seiten je Bereich, Sitemaps) liegen ueber ihren Klinken — ein Datenlauf darf den Bestand nicht still verkleinern',
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
    checks: 'das handkopierte three.js passt zur devDependency',
  },
  {
    id: 'audit:csp',
    npm: 'audit:csp',
    script: 'scripts/audit-csp.mjs',
    rail: 'A',
    checks: 'die Content-Security-Policy in nginx/default.conf deckt alles ab, was der Build wirklich laedt — eine zu enge CSP bricht nicht beim Deploy, sondern still im Browser des Besuchers',
  },
  {
    // Direkt nach audit:csp — beide betreffen nginx/default.conf.
    id: 'verify:gate',
    npm: 'verify:gate',
    script: 'scripts/verify-gate.mjs',
    rail: 'A',
    checks:
      'die Ausnahmeliste des Testpilot-Tors (nginx/default.conf, GATE-AUSNAHME-Zeilen) traegt jeden Anlass, deckt genau das, was dist/gate.html anfordert, hat keinen erfundenen Eintrag, die Torseite bleibt ungepaart und ohne /_astro/-Buendel, nginx/gate.js traegt kein eingebautes Geheimnis, und der $vb_gate_on-Schalter steht in der Form, auf die der Dockerfile-sed zielt (D-06, D-09, D-12)',
    // Kein env-Feld: kein git, kein Netz, kein Kindprozess — liest
    // ausschliesslich dist/ und die beiden nginx-Dateien als Text.
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
    disabled:
      'AUSGESETZT auf live seit 27.08.2026, NICHT auf staging. Die Schiffs-'
      + 'Detailseite steht auf live bewusst auf ihrem Stand vom 14.08.2026 '
      + '(Betreiberentscheidung: der Umbau aus den Phasen 14/16/17 — vier '
      + 'Kapitel, Konsole, Hangar — ist beta und kam nur durch drei '
      + 'Fast-forward-Live-Pushes ungewollt nach draussen). Dieses Tor prueft '
      + 'GENAU diesen Umbau; gegen die alte Seite meldet es zwangslaeufig rot '
      + 'und wuerde jeden Live-Build verhindern — kein Image, alter Stand '
      + 'bleibt online. Es bleibt auf staging scharf und ist hier nur '
      + 'stillgelegt, bis der Entwurf abgenommen ist und live nachzieht. '
      + 'Schuldenposten: laeuft bei JEDEM Lauf als ausgesetzt mit.',
    npm: 'verify:shipcard',
    script: 'scripts/verify-shipcard.mjs',
    rail: 'A',
    checks:
      'die Schiffs-Detailseite traegt genau ein Kapitelgeruest mit Sprungleiste, keinen Einheitsrahmen mehr, Balken nur beim Leistungsprofil, und jeder Wert steht an genau einer Stelle (D-01/D-02/D-03)',
  },
  {
    id: 'verify:shipconsole',
    disabled:
      'AUSGESETZT auf live seit 27.08.2026, NICHT auf staging. Die Schiffs-'
      + 'Detailseite steht auf live bewusst auf ihrem Stand vom 14.08.2026 '
      + '(Betreiberentscheidung: der Umbau aus den Phasen 14/16/17 — vier '
      + 'Kapitel, Konsole, Hangar — ist beta und kam nur durch drei '
      + 'Fast-forward-Live-Pushes ungewollt nach draussen). Dieses Tor prueft '
      + 'GENAU diesen Umbau; gegen die alte Seite meldet es zwangslaeufig rot '
      + 'und wuerde jeden Live-Build verhindern — kein Image, alter Stand '
      + 'bleibt online. Es bleibt auf staging scharf und ist hier nur '
      + 'stillgelegt, bis der Entwurf abgenommen ist und live nachzieht. '
      + 'Schuldenposten: laeuft bei JEDEM Lauf als ausgesetzt mit.',
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
    id: 'check:gate',
    npm: 'check:gate',
    script: 'scripts/check-gate.mjs',
    rail: 'C',
    checks:
      'die AUSGELIEFERTE Zugriffskontrolle des Testpilot-Tors: gesperrte Stichproben aus dist/ antworten ohne Cookie mit 302 auf /gate.html, jeder Eintrag der Ausnahmeliste aus nginx/default.conf antwortet mit 200, /build.json traegt eine Commit-Kennung (D-07), und ein gewuerfelter Wert in der Bypass-Kopfzeile oeffnet das Tor NICHT (T-14-56/T-14-57)',
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
