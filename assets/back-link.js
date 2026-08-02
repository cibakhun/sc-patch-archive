/* Zurück-Element (SiteNav.astro) + Brotkrumen (DataShell.astro): Basis ist
 * immer ein echtes <a href>, das ohne JS funktioniert und nie falsch sein
 * kann. Dieses Skript wertet nur auf, WIE der Klick wirkt — nicht WOHIN er
 * geht.
 *
 * Kommt der Nutzer nachweislich von genau der Elternseite (gleiche Herkunft,
 * document.referrer.pathname === data-back-path), wird aus dem normalen
 * Link ein history.back(): der Nutzer bekommt Scrollposition und
 * clientseitigen Filterzustand der Liste zurück. In jedem anderen Fall
 * (Google, Querverweis, kein Referrer) navigiert der Link ganz normal — das
 * Ziel im href ist in jedem Fall identisch, es gibt keinen Grammatikbruch.
 *
 * Zusätzlich hinterlässt jede Seite mit [data-back-self] ihre eigene
 * Herkunfts-Notiz unter sessionStorage['vb:from'] (Pfad + Kurzname). Der
 * parser-blockierende Leser in SiteNav.astro liest diese Notiz VOR dem
 * ersten Bild der nächsten Seite. REIHENFOLGE IST TRAGEND: dieses Skript
 * läuft mit defer und überschreibt die Notiz deshalb garantiert erst,
 * NACHDEM der Leser der vorherigen Seite sie bereits gelesen hat.
 */
(function () {
  /* Zweimal eingebunden werden ist erlaubt: SiteNav laedt das Skript nur auf
   * Blattseiten, der Item-Finder ist aber eine NABE mit Modal und bringt es
   * deshalb selbst mit. Auf einer Blattseite mit Modal kaeme es damit doppelt —
   * und zwei Klick-Zuhoerer auf demselben Link wuerden zweimal history.back()
   * ausloesen, also einen Schritt zu weit. Ein Riegel statt einer Regel,
   * welche Seite es laden darf. */
  if (window.__vbBackLink) return;
  window.__vbBackLink = 1;

  function noteOrigin() {
    try {
      var self = document.querySelector('[data-back-self]');
      if (!self) return;
      sessionStorage.setItem('vb:from', JSON.stringify({
        p: location.pathname,
        u: location.pathname + location.search,
        l: self.getAttribute('data-back-self'),
      }));
    } catch (err) { /* sessionStorage kann in abgeschotteten Kontexten werfen */ }
  }
  noteOrigin();
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) noteOrigin(); // aus dem bfcache zurückgeholt -> Skript lief nicht erneut
  });

  /* Zurück-Pfeil in den Datenblatt-Modalen (Mining, Crafting, Item-Finder).
   *
   * Der Leisten-Link steht ganz oben am Fensterrand; wer in einem Modal liest,
   * schaut dorthin nicht. Der Pfeil sitzt deshalb am Modal selbst, oben links
   * gegenüber dem Schließen-Kreuz.
   *
   * Er erscheint NUR, wenn der Leser in SiteNav.astro den Leisten-Link auf eine
   * tatsächliche Herkunft umgeschrieben hat (Merkmal data-back-origin) — also
   * wenn man von einer anderen Seite hereingesprungen ist. Sonst wäre er bloß
   * ein zweites Schließen-Kreuz.
   *
   * Der Klick delegiert an genau diesen Leisten-Link, statt das Verhalten
   * nachzubauen: dadurch gibt es EINE Wahrheit darüber, ob zurückgesprungen
   * (history.back, Scroll und Filter zurück) oder normal navigiert wird. */
  // Herkunft selbst aufloesen, mit denselben Toren wie der Leser in
  // SiteNav.astro. Nicht am Leisten-Link ablesen: Nabenseiten tragen keinen
  // (der Item-Finder ist eine, und crafting-app.js verlinkt mit ?item= genau
  // dorthin hinein). Der Leisten-Link bleibt trotzdem die erste Wahl fuers
  // Verhalten, wo es ihn gibt — eine Wahrheit statt zwei.
  function resolveOrigin() {
    var ref;
    try { ref = new URL(document.referrer); } catch (e) { return null; }
    if (ref.origin !== location.origin) return null;
    if (ref.pathname === location.pathname) return null;
    var note;
    try { note = JSON.parse(sessionStorage.getItem('vb:from')); } catch (e) { return null; }
    if (!note || note.p !== ref.pathname) return null;
    // protokoll-relative Ziele (//fremde.example) sind eine offene Weiterleitung
    if (typeof note.u !== 'string' || note.u.charAt(0) !== '/' || note.u.charAt(1) === '/') return null;
    return note;
  }

  var arrows = document.querySelectorAll('[data-modal-back]');
  if (arrows.length) {
    var origin = resolveOrigin();
    if (origin) {
      var navBack = document.querySelector('.snav__back[data-back-origin]');
      for (var a = 0; a < arrows.length; a++) {
        (function (btn) {
          btn.hidden = false;
          var pre = btn.getAttribute('data-back-aria');
          var label = pre ? pre + ' ' + origin.l : origin.l;
          btn.setAttribute('aria-label', label);
          btn.title = label;
          btn.addEventListener('click', function () {
            // Wo es den Leisten-Link gibt, entscheidet ER — sonst gaebe es zwei
            // Stellen, die ueber history.back() vs. normale Navigation urteilen.
            if (navBack) { navBack.click(); return; }
            history.back();
          });
        })(arrows[a]);
      }
    }
  }

  var links = document.querySelectorAll('a[data-backlink]');
  if (!links.length) return;

  for (var i = 0; i < links.length; i++) {
    (function (el) {
      var backPath = el.getAttribute('data-back-path');
      if (!backPath) return;
      if (backPath === location.pathname) return; // Selbstbezug: tiefste Krume zeigt auf sich selbst
      if (history.length <= 1) return; // kein eigener History-Eintrag zum Zurückspringen

      var ref;
      try {
        ref = new URL(document.referrer);
      } catch (err) {
        return; // leerer/ungueltiger Referrer -> normale Navigation
      }
      if (ref.origin !== location.origin) return; // fremde Herkunft
      if (ref.pathname !== backPath) return; // kommt nicht von der Elternseite

      el.addEventListener('click', function (e) {
        // Modifizierte Klicks (neuer Tab/Fenster) und Mittelklick unangetastet
        // lassen -- sonst bricht "in neuem Tab oeffnen".
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        history.back();
      });
    })(links[i]);
  }
})();
