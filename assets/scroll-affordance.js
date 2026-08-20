/* Breite Bildlauf-Kaesten bedienbar machen. Drei Dinge:
 *
 * 1. ZIEHEN mit der Maus, in beide Richtungen. Eine Bildlaufleiste sagt nur,
 *    DASS es weitergeht — treffen muss man sie trotzdem, und am Desktop ist
 *    das ein 8-px-Streifen am unteren Rand. Mit gedrueckter Maustaste laesst
 *    sich der Kasten jetzt direkt schieben, mit Schwung am Ende. Waagerecht
 *    scrollt der Kasten, senkrecht die Seite (siehe panY()).
 * 2. Die weiche KANTE rechts, solange dort noch etwas steht (siehe unten).
 * 3. Die weiche KANTE unten, fuer die Bildlauf-Kaesten aus assets/mobile-ux.css
 *    Abschnitt 5d (.vb-scrollbox). Die bestehende Kante unter Punkt 2 ist
 *    WAAGERECHT (Klasse `is-more`, Maske `90deg`), diese ist SENKRECHT
 *    (Klasse `is-more-y`, Maske `180deg`, eigene Liste SEL_VFADE). Ein Kasten
 *    steht hoechstens in EINER der beiden Listen — zwei Masken auf demselben
 *    Element liessen sich nur ueber mask-composite ueberlagern, und genau
 *    darum steht .dp-tablewrap (beide Achsen) in keiner waagerechten Liste.
 *
 * Beruehrung bleibt unangetastet: dort scrollt der Browser selbst, samt
 * Schwung. Angefasst wird nur Maus und Stift.
 *
 * window.VBScrollAffordance() sucht erneut — noetig fuer Kaesten, die es beim
 * Laden noch nicht gibt (.uif-table-wrapper entsteht erst im Item-Modal).
 */
(function () {
  // Ziehen bekommt jeder Kasten. Die Kante nicht: die Evolutions-Matrix
  // bringt ihre eigene mit, die auf ihre klebende System-Spalte Ruecksicht
  // nimmt (src/pages/evolution.astro).
  var SEL_DRAG =
    '.do__tablewrap,.md__tblWrap,.pj-tblscroll,.uif-table-wrapper,.sd__paints,.evo__scroll,.sd__jump__in';
  var SEL_FADE =
    '.do__tablewrap,.md__tblWrap,.pj-tblscroll,.uif-table-wrapper,.sd__paints,.sd__jump__in';
  // Senkrechte Kante fuer die Bildlauf-Kaesten aus Task 6/mobile-ux.css 5d.
  var SEL_VFADE = '.vb-scrollbox';

  var faders = [];
  var vfaders = [];

  function syncFade(el) {
    el.classList.toggle('is-more', el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
  }
  // Spiegelbild von syncFade: senkrecht statt waagerecht.
  function syncVFade(el) {
    el.classList.toggle('is-more-y', el.scrollHeight - el.clientHeight - el.scrollTop > 2);
  }
  function syncAll() {
    for (var i = 0; i < faders.length; i++) syncFade(faders[i]);
    for (var k = 0; k < vfaders.length; k++) syncVFade(vfaders[k]);
  }

  // Weder Maske noch Zeiger-Klasse aendern eine Groesse -> der Beobachter kann
  // sich nicht selbst wieder ausloesen. Beobachtet wird auch das Kind: im
  // Item-Finder wachsen die Zeilen nach, ohne dass der Kasten sich aendert.
  var ro = window.ResizeObserver ? new window.ResizeObserver(onResize) : null;
  var draggables = [];
  function onResize() {
    syncAll();
    for (var i = 0; i < draggables.length; i++) markDraggable(draggables[i]);
  }
  function scrollbarX(el) { return el.scrollWidth - el.clientWidth > 2; }
  function scrollbarY(el) { return el.scrollHeight - el.clientHeight > 2; }
  // Gilt fuer Greifzeiger UND Verhalten — beides muss dieselbe Antwort geben,
  // sonst zieht ein Kasten ohne Greifzeiger trotzdem.
  function istZiehbar(el) { return scrollbarX(el) || scrollbarY(el); }
  function markDraggable(el) {
    el.classList.toggle('can-drag', istZiehbar(el));
  }

  // Obergrenze fuer die Wurfgeschwindigkeit in px/ms. Ohne sie schleudert ein
  // einzelner Ruck — oder ein Messwert ueber eine verschluckte Bildwiederholung
  // hinweg — die Tabelle in einem Satz ans Ende.
  var MAXV = 2;
  function clampV(v) {
    return v > MAXV ? MAXV : v < -MAXV ? -MAXV : v;
  }

  function enableDrag(el) {
    var startX = 0, startY = 0, startL = 0, startT = 0, startPageY = 0;
    var down = false, dragging = false, pid = null, vertInside = false;
    var vx = 0, vy = 0, lastX = 0, lastY = 0, lastT = 0, lastMoveT = 0, raf = 0;

    // Senkrecht scrollt meist nicht der Kasten, sondern die Seite: die Matrix
    // ist breiter als das Fenster, aber ihre 19 Zeilen stehen im normalen
    // Seitenfluss. Wer sie anfasst, will sie in BEIDE Richtungen bewegen —
    // also geht der senkrechte Anteil an die Seite, sobald der Kasten selbst
    // nichts zu scrollen hat (.md__tblWrap mit Deckelhoehe hat es).
    function panY(zielOderDelta, absolut) {
      if (vertInside) {
        el.scrollTop = absolut ? zielOderDelta : el.scrollTop + zielOderDelta;
      } else {
        var y = absolut ? zielOderDelta : window.scrollY + zielOderDelta;
        window.scrollTo({ top: y, behavior: 'auto' });
      }
    }

    function stopGlide() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    // Nach dem Loslassen noch etwas weiterlaufen. Ohne das fuehlt sich das
    // Ziehen an, als bliebe die Tabelle an den Fingern kleben.
    //
    // Der Auslauf betraegt rund `Geschwindigkeit x 16 x 0,92/0,08` Pixel, also
    // hoechstens ~370 px bei voller Wurfgeschwindigkeit und ~115 px bei
    // gemaechlichem Ziehen. Genug, um Schwung zu spueren, zu wenig, um an
    // einer bestimmten Spalte vorbeizuschiessen.
    function glide() {
      var dx = vx * 16, dy = vy * 16;
      (function step() {
        dx *= 0.92; dy *= 0.92;
        if (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) { raf = 0; return; }
        el.scrollLeft -= dx;
        panY(-dy);
        raf = requestAnimationFrame(step);
      })();
    }

    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;          // Beruehrung: nativ ist besser
      if (e.button !== 0) return;                      // nur die linke Taste
      if (e.target.closest('input,textarea,select,[contenteditable]')) return;
      // Gibt es nichts zu schieben, wird auch nicht gezogen — sonst kaperte
      // das Ziehen die Textauswahl in Tabellen, die ohnehin ganz hineinpassen.
      if (!istZiehbar(el)) return;
      stopGlide();
      // Jede Interaktion faengt sauber an. Ohne das ueberlebt die Klick-Sperre
      // ihren Zug: endet ein Zug ohne folgenden Klick — Zeiger ausserhalb
      // losgelassen, Klick vom Browser verworfen —, bliebe das Merkmal stehen
      // und verschluckte den NAECHSTEN, ganz normalen Klick.
      el.removeAttribute('data-dragged');
      down = true; dragging = false; pid = e.pointerId;
      startX = lastX = e.clientX; startY = lastY = e.clientY;
      startL = el.scrollLeft; startT = el.scrollTop; startPageY = window.scrollY;
      vertInside = scrollbarY(el);
      lastT = lastMoveT = e.timeStamp; vx = vy = 0;
    });

    el.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== pid) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!dragging) {
        // Schwelle: darunter bleibt es ein Klick. Sonst liesse sich keine
        // Zelle mehr oeffnen, ohne die Tabelle zu verschieben.
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        dragging = true;
        el.classList.add('is-dragging');
        try { el.setPointerCapture(pid); } catch (err) {}
      }
      el.scrollLeft = startL - dx;
      panY((vertInside ? startT : startPageY) - dy, true);
      // Unter 1 ms ist der Quotient Rauschen — dann lieber den alten Messwert
      // behalten, als durch fast Null zu teilen.
      var dt = e.timeStamp - lastT;
      if (dt >= 1) {
        vx = clampV((e.clientX - lastX) / dt);
        vy = clampV((e.clientY - lastY) / dt);
        lastX = e.clientX; lastY = e.clientY; lastT = lastMoveT = e.timeStamp;
      }
      e.preventDefault();
    });

    function release(e) {
      if (!down || (e && e.pointerId !== pid)) return;
      down = false;
      if (dragging) {
        dragging = false;
        el.classList.remove('is-dragging');
        try { el.releasePointerCapture(pid); } catch (err) {}
        // Der Klick kommt direkt nach dem Loslassen — er darf nicht mehr
        // durchgehen, sonst oeffnet jedes Ziehen ueber eine Zelle deren Panel.
        el.setAttribute('data-dragged', '');
        // Wer vor dem Loslassen kurz stehenbleibt, will genau dort halten —
        // nicht noch einen halben Bildschirm weiterrutschen.
        if (e && e.timeStamp - lastMoveT > 80) vx = vy = 0;
        // Ein waagerechter Wisch hat fast immer ein bisschen Zittern nach
        // oben oder unten. Ohne das hier zoege jeder Zug durch die Matrix
        // auch die Seite ein Stueck mit. Nur die klar untergeordnete Achse
        // faellt weg — echte Diagonalzuege bleiben diagonal.
        if (Math.abs(vy) < Math.abs(vx) * 0.25) vy = 0;
        if (Math.abs(vx) < Math.abs(vy) * 0.25) vx = 0;
        glide();
      }
      pid = null;
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('click', function (e) {
      if (!el.hasAttribute('data-dragged')) return;
      el.removeAttribute('data-dragged');
      e.stopPropagation();
      e.preventDefault();
    }, true);

    // Bilder und Text ziehen sonst der Browser weg, statt zu schieben.
    el.addEventListener('dragstart', function (e) {
      if (down) e.preventDefault();
    });

    // Eigenes Scrollen (Rad, Tastatur, Bildlaufleiste) beendet den Schwung.
    el.addEventListener('wheel', stopGlide, { passive: true });
  }

  function scan() {
    var drag = document.querySelectorAll(SEL_DRAG);
    for (var i = 0; i < drag.length; i++) {
      var el = drag[i];
      if (el.hasAttribute('data-dragscroll')) continue;   // schon versorgt
      el.setAttribute('data-dragscroll', '');
      draggables.push(el);
      enableDrag(el);
      markDraggable(el);
      if (ro) {
        ro.observe(el);
        if (el.firstElementChild) ro.observe(el.firstElementChild);
      }
    }
    var fade = document.querySelectorAll(SEL_FADE);
    for (var j = 0; j < fade.length; j++) {
      var f = fade[j];
      if (f.hasAttribute('data-edgefade')) continue;
      f.setAttribute('data-edgefade', '');
      faders.push(f);
      f.addEventListener('scroll', (function (n) {
        return function () { syncFade(n); };
      })(f), { passive: true });
    }
    // Senkrechte Kante, eigener Riegel (data-edgefade-y) gegen Doppellade —
    // ein Kasten kann in SEL_FADE UND SEL_VFADE stehen wuerde es sie geben,
    // hier steht bewusst keiner in beiden Listen (s. Kopfkommentar).
    var vfade = document.querySelectorAll(SEL_VFADE);
    for (var m = 0; m < vfade.length; m++) {
      var v = vfade[m];
      if (v.hasAttribute('data-edgefade-y')) continue;
      v.setAttribute('data-edgefade-y', '');
      vfaders.push(v);
      v.addEventListener('scroll', (function (n) {
        return function () { syncVFade(n); };
      })(v), { passive: true });
    }
    syncAll();
  }

  window.VBScrollAffordance = scan;
  window.addEventListener('resize', onResize);
  // Die Anzeigeschriften laden nach und aendern die Tabellenbreite.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  scan();
})();
