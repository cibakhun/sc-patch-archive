/* ============================================================
   scroll-lock.js — EINE Sperre fuer alle Overlays.

   Ausgangslage (gemessen): die Seite kannte DREI verschiedene
   Arten, den Hintergrund festzuhalten, wenn ein Overlay offen ist:

     SearchOverlay.astro   document.documentElement.style.overflow = 'hidden'
     SiteNav.astro (Menue) html.is-deck-open { overflow: hidden !important }
     item-finder-app.js    document.body.style.overflow = 'hidden'
     offcanvas.js          document.body.style.position = 'fixed'  <- richtig

   Nur die letzte haelt auf iOS Safari wirklich: `overflow: hidden`
   auf <html> oder <body> wird dort in der Praxis uebergangen, der
   Hintergrund scrollt unter dem Overlay weg und man steht nach dem
   Schliessen an einer anderen Stelle. Genau deshalb steht in
   offcanvas.js die position:fixed-Variante — sie war nur nie
   verallgemeinert worden.

   Diese Datei ist die eine Stelle. Sie zaehlt mit (refcount), damit
   sich zwei gleichzeitig offene Ebenen — etwa Suche ueber einem
   offenen Filterschub — nicht gegenseitig entsperren.
   ============================================================ */
(function () {
  'use strict';

  var depth = 0;
  var scrollY = 0;

  function lock() {
    depth++;
    if (depth > 1) return; // schon gesperrt, nur mitzaehlen
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = -scrollY + 'px';
    document.body.style.width = '100%';
    // Marker fuer alles, was ueber den Overlays liegen wuerde. Die wandernde
    // Hero-Wortmarke der Startseite (.hero__mark) muss ueber der Kopfleiste
    // liegen (z-index 9600), damit sie dort landen kann — und laege damit
    // auch ueber Suche (9600) und Menue (9500). Diese Sperre ist die eine
    // Stelle, die jedes Overlay durchlaeuft, also haengt der Marker hier.
    document.documentElement.classList.add('is-locked');
  }

  function unlock() {
    if (depth === 0) return;
    depth--;
    if (depth > 0) return; // eine aeussere Ebene haelt die Sperre noch
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.documentElement.classList.remove('is-locked');
    // exakt dorthin zurueck, wo der Nutzer war — sonst springt die Seite
    // beim Schliessen nach oben.
    window.scrollTo(0, scrollY);
  }

  window.VBScrollLock = { lock: lock, unlock: unlock };
})();
