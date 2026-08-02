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
