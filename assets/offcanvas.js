/* ============================================================
   offcanvas.js — EIN Verhalten fuer alle ausfahrenden Panels.

   Ausgangslage (gemessen bei 375 px auf /topics/crafting.html und
   /topics/mining.html): beide Apps bringen ein eigenes, identisches
   Off-Canvas-Panel mit, und beiden fehlte dasselbe:

     - kein Verdunkler  -> das Panel schwebte ohne Trennung ueber der
                           Seite, und es gab kein Tippen-daneben zum
                           Schliessen. Der einzige Ausweg war das kleine
                           Kreuz oben rechts.
     - keine Scroll-Sperre -> der Hintergrund scrollte unter dem
                           offenen Panel weg; nach dem Schliessen stand
                           man woanders.
     - kein Esc, kein Wischen.

   Statt das in beiden Apps zu wiederholen, steht es hier einmal.

   ANKOPPLUNG, bewusst ohne Eingriff in die App-Logik: die Apps
   schalten weiterhin selbst die Klasse `is-open` auf ihrem Panel. Ein
   MutationObserver sieht das und ergaenzt Verdunkler, Sperre und die
   Schliess-Wege. Das Panel muss dafuer nur `data-offcanvas` tragen und
   eine id haben; die zugehoerige Schaltflaeche `data-offcanvas-toggle`
   mit derselben id, damit aria-expanded mitlaeuft.

   Greift NUR, wenn das Panel gerade wirklich ausfaehrt (position:
   fixed). Am Desktop steht dieselbe Spalte sticky im Fluss — dort darf
   nichts gesperrt und nichts verdunkelt werden.
   ============================================================ */
(function () {
  'use strict';

  var OPEN = 'is-open';
  var scrim = null;
  var active = null; // aktuell offenes Panel

  /* Zwei Bedingungen, beide noetig:
     - position:fixed — das Panel faehrt wirklich ueber die Seite (die
       Filterspalten stehen am Desktop sticky IM Fluss).
     - <= 820 px — dieselbe Grenze wie in mobile-ux.css. Der Planer-Schub
       ist auch am Desktop fixed; dort soll sich nichts aendern, er hat
       Esc und Klick-daneben bereits selbst. */
  function isDrawerMode(panel) {
    return window.innerWidth <= 820 && getComputedStyle(panel).position === 'fixed';
  }

  function toggleFor(panel) {
    return panel.id ? document.querySelector('[data-offcanvas-toggle="' + panel.id + '"]') : null;
  }

  /* Die Sperre selbst steht seit dem Vereinheitlichen in
     assets/scroll-lock.js — dieselbe position:fixed-Technik wie vorher,
     nur eben an EINER Stelle und mit Zaehler, damit zwei offene Ebenen
     (Suche ueber offenem Filterschub) sich nicht gegenseitig entsperren.
     Vorher kannte die Seite drei verschiedene Sperren. */
  function lock() {
    if (window.VBScrollLock) window.VBScrollLock.lock();
  }

  function unlock() {
    if (window.VBScrollLock) window.VBScrollLock.unlock();
  }

  function close() {
    if (!active) return;
    var panel = active;
    panel.classList.remove(OPEN);
    // teardown laeuft ueber den Observer (siehe unten) — nicht doppelt hier
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  // Wischen nach links schliesst. Nur horizontale Gesten, und erst ab
  // 45 px, damit ein Scrollversuch im Panel nicht als Wisch zaehlt.
  var tx = 0, ty = 0;
  function onTouchStart(e) {
    if (!e.touches || !e.touches[0]) return;
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (dx < -45 && Math.abs(dx) > Math.abs(dy) * 1.5) close();
  }

  function setup(panel) {
    active = panel;
    // z-index eine Stufe unter dem Panel: der Verdunkler deckt die Seite,
    // nie das Panel selbst.
    var z = parseInt(getComputedStyle(panel).zIndex, 10);
    scrim.style.zIndex = (isNaN(z) ? 9250 : z) - 1;
    lock();
    // Schlichtes Setzen der Klasse — bewusst ohne den `void
    // scrim.offsetWidth`, der hier vorher stand, und bewusst ohne
    // requestAnimationFrame.
    //
    // Vorgeschichte, damit niemand den Reflow-Kniff gutgemeint wieder
    // einbaut: bei der Messung sah es zunaechst so aus, als bliebe der
    // Verdunkler dauerhaft bei opacity 0 — die CSSTransition stand auf
    // playState "running" mit currentTime fest bei 0. Das war jedoch ein
    // ARTEFAKT der Messumgebung: in der benutzten eingebetteten Ansicht
    // lief ueberhaupt kein Rendering-Zyklus (0 rAF-Frames in 800 ms), und
    // ohne Frames kann keine Transition fortschreiten. In einem normalen
    // Browser ist der Effekt NICHT nachgewiesen.
    //
    // Geblieben ist trotzdem eine echte Verbesserung: der Verdunkler wird
    // jetzt EINMAL beim Start erzeugt (siehe init) statt beim ersten
    // Oeffnen. Damit haengt sein Uebergang nicht mehr daran, dass ein
    // gerade erst eingefuegtes Element im selben Arbeitsschritt schon
    // eine laufende Zeitachse hat — die Klasse von Problemen, gegen die
    // der Reflow-Kniff ueberhaupt gedacht war, entsteht so gar nicht
    // erst. rAF waere hier das falsche Mittel: es laeuft in gedrosselten
    // und eingebetteten Ansichten nicht zuverlaessig, und ein
    // Verdunkler, der dort ausbleibt, waere schlimmer als einer ohne
    // Uebergang.
    //
    // PREIS dieser Umstellung: das Element liegt jetzt dauerhaft im DOM.
    // Es MUSS deshalb pointer-events:none tragen, solange `is-open`
    // fehlt — sonst faengt ein unsichtbarer Vollbild-Kasten jeden Tipp
    // der Seite ab. Die Regel steht in mobile-ux.css.
    scrim.classList.add(OPEN);
    document.addEventListener('keydown', onKey);
    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchend', onTouchEnd, { passive: true });
    var t = toggleFor(panel);
    if (t) t.setAttribute('aria-expanded', 'true');
    // Fokus ins Panel, damit Tastatur und Screenreader nicht hinter dem
    // Verdunkler weiterlaufen.
    var first = panel.querySelector('button, [href], input, select, textarea');
    if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
  }

  function teardown(panel) {
    active = null;
    if (scrim) scrim.classList.remove(OPEN);
    unlock();
    document.removeEventListener('keydown', onKey);
    panel.removeEventListener('touchstart', onTouchStart);
    panel.removeEventListener('touchend', onTouchEnd);
    var t = toggleFor(panel);
    if (t) {
      t.setAttribute('aria-expanded', 'false');
      try { t.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function watch(panel) {
    new MutationObserver(function () {
      var open = panel.classList.contains(OPEN) && isDrawerMode(panel);
      if (open && active !== panel) setup(panel);
      else if (!open && active === panel) teardown(panel);
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    var panels = document.querySelectorAll('[data-offcanvas]');
    if (!panels.length) return;
    // Der Verdunkler entsteht hier, nicht beim ersten Oeffnen — siehe die
    // Begruendung in setup(). Er kostet nichts: opacity 0 und
    // pointer-events:none, solange `is-open` fehlt.
    scrim = document.createElement('div');
    scrim.className = 'vb-offcanvas-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    scrim.addEventListener('click', close);
    document.body.appendChild(scrim);
    for (var i = 0; i < panels.length; i++) watch(panels[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
