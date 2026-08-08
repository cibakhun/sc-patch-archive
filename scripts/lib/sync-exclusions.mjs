/* ============================================================
   sync-exclusions.mjs — benannte Ausnahmen fuer verify-sync.mjs.

   Vorbild: scripts/lib/layer-registry.mjs EXCLUSIONS. Derselbe Warnsatz
   gilt hier: eine Ausnahme OHNE Begruendungstext ist eine Luecke, kein
   Ausschluss — CONTEXT.md § Specific Ideas. verify-sync.mjs selbst traegt
   KEINE Ausnahme im eigenen Code; jede Sonderregel steht benannt und
   begruendet hier.

   In DIESEM Plan genau EIN Eintrag. D-03 ("erst beheben, dann scharf")
   heisst: die Behebung der ~85 echten Restabweichungen (Onepager-DE-only,
   Impressum-MStV, Item-Beschreibungsluecke) ist Plan 02, nicht dieser Plan
   — sonst misst der Erstbefund nicht mehr den unveraenderten Bestand.
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
];
