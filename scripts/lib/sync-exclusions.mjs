/* ============================================================
   sync-exclusions.mjs — benannte Ausnahmen fuer verify-sync.mjs.

   Vorbild: scripts/lib/layer-registry.mjs EXCLUSIONS. Derselbe Warnsatz
   gilt hier: eine Ausnahme OHNE Begruendungstext ist eine Luecke, kein
   Ausschluss — CONTEXT.md § Specific Ideas. verify-sync.mjs selbst traegt
   KEINE Ausnahme im eigenen Code; jede Sonderregel steht benannt und
   begruendet hier.

   Zwei Modi:
     - 'multiset-children' — X-langsw-order, siehe unten.
     - 'cut-region' — schneidet mit cutRegion() (scripts/verify-sync.mjs,
       Plan 01) eine benannte HTML-Region aus EINER Seite EINES Paars heraus,
       bevor tokenize() laeuft. Der Anker (`openTagPattern`) haengt an
       Quelltext, der die Ausnahme selbst begruendet (Ueberschriftentext oder
       Wrapper-Klasse) — verschwindet die Fundstelle, greift die Ausnahme
       nicht mehr, und der Zombie-Waechter (Zusicherung 5 in verify-sync.mjs)
       meldet sie.

   Seit Plan 02 (D-03 "erst beheben, dann scharf" ist jetzt vollzogen) DREI
   Eintraege: die Item-Beschreibungsluecke (78 Paare) ist in Plan 02 Task 1
   BEHOBEN worden (D-05, src/lib/items.ts) und braucht deshalb KEINE
   Ausnahme — nur Onepager-DE-only und Impressum-MStV bleiben als bewusste,
   quellbelegte Abweichungen bestehen.
   ============================================================ */

export const EXCLUSIONS = [
  {
    id: 'X-langsw-order',
    mode: 'multiset-children',
    /* Klassenname des Behaelters, der in der geordneten Folge STEHEN
       BLEIBT — nur seine Kinder (siehe childPrefix) fallen heraus. */
    container: 'langsw',
    /* Jede Klasse mit diesem Praefix gehoert zur "aktuellen" Instanz und
       wird je Instanz als Menge (Klasse -> Anzahl) verglichen statt in
       der geordneten Folge. */
    childPrefix: 'langsw__',
    reason:
      'src/components/LangSwitcher.astro rendert LOCALES in fester Reihenfolge — welcher ' +
      'Steckplatz span.langsw__cur (aktuelle Sprache) bzw. a.langsw__opt (die andere Sprache) ' +
      'traegt, haengt an der Sprache der SEITE, nicht an einer festen Position. Die EN-Fassung ' +
      'einer Seite rendert an dieser Stelle [span.cur, span.sep, a.opt], die DE-Fassung ' +
      'DERSELBEN Seite [a.opt, span.sep, span.cur] — das ist keine Drift, sondern das, was ein ' +
      '"aktuelle Sprache zuerst"-Bedienelement zur Bauzeit zwangslaeufig tut (04-RESEARCH.md § ' +
      'Die decisive measurement: 1.627 von 1.712 abweichenden Paaren, 95 %, exakt dieses Muster). ' +
      'Deshalb wird NICHT die ganze .langsw-Instanz seitenweit ausgenommen — das wuerde auch ' +
      'einen echten Defekt verbergen (fehlendes hreflang, verschwundene Sprachoption, ein ' +
      'Umschalter, der auf einer Fassung gar nicht mehr rendert). Stattdessen faellt nur die ' +
      'Kinderfolge (alles mit einer langsw__-Klasse) aus der geordneten Sequenz und wird JE ' +
      'INSTANZ als Menge verglichen ({cur:1, opt:1, sep:1}); der Behaelter div.langsw selbst ' +
      'bleibt in der Folge stehen. Ein fehlendes, verschobenes oder verdoppeltes Kind faellt damit ' +
      'weiterhin auf — belegt durch Bruch C der Negativkontrolle (04-01-SUMMARY.md).',
  },
  {
    id: 'X-onepager-de-only',
    mode: 'cut-region',
    /* Welche EN-Pfade betroffen sind (EN-Pfad-Stamm, siehe 04-02-PLAN.md
       <residue_argument>) — nur diese beiden Themenseiten tragen den
       bedingten Onepager-Verweis. */
    match: (enPath) =>
      enPath === 'dist/topics/4-0-0-contested-zones.html' ||
      enPath === 'dist/topics/4-2-0-storm-breaker.html',
    /* Nur die DEUTSCHE Fassung traegt den Block — sie wird geschnitten,
       nicht die englische (die hat ihn nie gerendert). */
    side: 'de',
    /* Anker: die section.opl-wrap OEFFNET den Block; tagName 'section'
       laesst cutRegion() bis zur zugehoerigen </section> schneiden
       (Depth-Zaehlung, siehe scripts/verify-sync.mjs cutRegion()). */
    openTagPattern: () => /<section\s+class="opl-wrap reveal"[^>]*>/,
    tagName: 'section',
    reason:
      'src/components/topics/4-0-0-contested-zones.astro Zeilen ~178-186 und ' +
      'src/components/topics/4-2-0-storm-breaker.astro (dieselbe Stelle, wortgleicher ' +
      'Quellkommentar): {de && <OnepagerLink …>} — den Onepager gibt es nur auf Deutsch ' +
      '(public/onepager/contested-zones/, public/onepager/storm-breaker/), die EN-Fassung hat ' +
      'ihn noch nie verlinkt und soll das ausdruecklich auch nicht anfangen. Daran haengen auch ' +
      'die vier ungepaarten Dateien aus Zusicherung 1 (dist/onepager/*/index.html, ' +
      'dist/downloads/onepager-*.html) — dieselbe bewusste EN-Luecke, nur auf Dateiebene statt ' +
      'auf Abschnittsebene. Anker ist section.opl-wrap (OnepagerLink.astro Zeile 16); ' +
      'verschwindet die Bedingung oder die Klasse, trifft diese Ausnahme auf kein Paar mehr zu ' +
      'und der Zombie-Waechter (Zusicherung 5) schlaegt an.',
  },
  {
    id: 'X-impressum-mstv',
    mode: 'cut-region',
    match: (enPath) => enPath === 'dist/impressum.html',
    /* Nur DE traegt den Abschnitt — die deutsche Rechtsgrundlage hat kein
       englisches Gegenstueck (und soll keins bekommen, siehe reason). */
    side: 'de',
    /* Anker ist der WORTLAUT der Ueberschrift, nicht nur das Tag — verankert
       an der Fundstelle, die diese Ausnahme rechtlich begruendet. tagName
       'p' laesst cutRegion() ab dem <h2>-Start bis zum ERSTEN folgenden
       </p> schneiden (kein <p> steht zwischen Ueberschrift und Absatz),
       also GENAU Ueberschrift + unmittelbar folgender Absatz — nicht mehr. */
    openTagPattern: () => /<h2>Verantwortlich für den Inhalt nach § 18 Abs\. 2 MStV<\/h2>/,
    tagName: 'p',
    reason:
      'src/pages/de/impressum.astro Zeilen 43-44: "Verantwortlich fuer den Inhalt nach § 18 ' +
      'Abs. 2 MStV" samt Absatz ist eine Pflichtangabe des deutschen Medienstaatsvertrags, die ' +
      'das englische Recht nicht kennt und die deshalb bewusst nur auf der deutschen Seite ' +
      'steht (src/pages/impressum.astro hat kein Gegenstueck). Der Anker haengt am WORTLAUT der ' +
      'Ueberschrift statt nur am Tag: verschwindet oder aendert sich der Abschnitt, trifft die ' +
      'Ausnahme ins Leere und der Zombie-Waechter (Zusicherung 5) meldet sie, statt sie ' +
      'stillschweigend leerlaufen zu lassen. Das zusaetzliche p.muted auf der ENGLISCHEN Seite ' +
      '(die Erklaerung "German law … requires this provider identification") ist NICHT hierueber ' +
      'abgedeckt — es war unbelegte Drift und wurde in Task 2 durch ein deutsches Gegenstueck in ' +
      'src/pages/de/impressum.astro behoben (04-02-SUMMARY.md), nicht ausgenommen.',
  },
];
