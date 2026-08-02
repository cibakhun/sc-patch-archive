/* Zurück-Element (SiteNav.astro): Basis ist immer ein echtes <a href>, das
 * ohne JS funktioniert und nie falsch sein kann. Dieses Skript wertet nur
 * auf, WIE der Klick wirkt — nicht WOHIN er geht.
 *
 * Kommt der Nutzer nachweislich von genau der Elternseite (gleiche Herkunft,
 * document.referrer.pathname === data-back-path), wird aus dem normalen
 * Link ein history.back(): der Nutzer bekommt Scrollposition und
 * clientseitigen Filterzustand der Liste zurück. In jedem anderen Fall
 * (Google, Querverweis, kein Referrer) navigiert der Link ganz normal — das
 * Ziel im href ist in jedem Fall identisch, es gibt keinen Grammatikbruch.
 */
(function () {
  var links = document.querySelectorAll('a[data-backlink]');
  if (!links.length) return;

  for (var i = 0; i < links.length; i++) {
    (function (el) {
      var backPath = el.getAttribute('data-back-path');
      if (!backPath) return;
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
