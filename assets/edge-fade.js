/* Breite Bildlauf-Kaesten: sagen, dass rechts noch etwas steht.
 *
 * assets/theme.css blendet site-weit JEDE Bildlaufleiste aus; assets/mobile-ux.css
 * holt sie fuer genau diese Kaesten zurueck. Hier kommt das zweite Signal dazu:
 * eine weiche Kante, die NUR steht, solange rechts wirklich noch etwas kommt —
 * am Ende angekommen verschwindet sie, statt weiter etwas zu behaupten.
 *
 * Als Maske umgesetzt, nicht als Farbverlauf: die Kaesten sind durchsichtig und
 * stehen je nach Seite auf einer anderen Hintergrundfarbe, ein deckender Verlauf
 * waere in einer der Paletten falsch. Eine Maske blendet aus, was darunter liegt.
 *
 * Die Auswahl steht hier und nicht als Attribut im Markup: die Kaesten liegen in
 * fuenf verschiedenen Komponenten, so bleibt es EINE Stelle. `.evo__scroll` fehlt
 * bewusst — die Evolutions-Matrix bringt ihre eigene Kante mit, die auf ihre
 * klebende System-Spalte Ruecksicht nimmt.
 *
 * window.VBEdgeFade() sucht erneut. Noetig fuer Kaesten, die es beim Laden noch
 * nicht gibt: .uif-table-wrapper entsteht erst beim Oeffnen des Item-Modals.
 */
(function () {
  var SEL = '.do__tablewrap,.md__tblWrap,.pj-tblscroll,.uif-table-wrapper,.sd__paints';
  var boxes = [];

  function sync(el) {
    el.classList.toggle('is-more', el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
  }
  function syncAll() {
    for (var i = 0; i < boxes.length; i++) sync(boxes[i]);
  }

  // Die Maske aendert keine Groesse -> der Beobachter kann sich nicht selbst
  // wieder ausloesen. Beobachtet wird auch das Kind: im Item-Finder wachsen
  // die Zeilen nach, ohne dass der Kasten selbst seine Groesse aendert.
  var ro = window.ResizeObserver ? new window.ResizeObserver(syncAll) : null;

  function scan() {
    var found = document.querySelectorAll(SEL);
    for (var i = 0; i < found.length; i++) {
      var el = found[i];
      if (el.hasAttribute('data-edgefade')) continue; // schon versorgt
      el.setAttribute('data-edgefade', '');
      boxes.push(el);
      el.addEventListener('scroll', (function (n) {
        return function () { sync(n); };
      })(el), { passive: true });
      if (ro) {
        ro.observe(el);
        if (el.firstElementChild) ro.observe(el.firstElementChild);
      }
    }
    syncAll();
  }

  window.VBEdgeFade = scan;
  window.addEventListener('resize', syncAll);
  // Die Anzeigeschriften laden nach und aendern die Tabellenbreite.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncAll);
  scan();
})();
