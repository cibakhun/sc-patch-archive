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
 * 4. Ein Kasten, der gerade NICHTS zu rollen hat, laesst das Rad durch (siehe
 *    SEL_DURCH). Seine Sperre gegen das Weiterrollen gilt nur, solange er
 *    selbst rollt.
 *
 * Beruehrung bleibt beim Ziehen unangetastet: dort scrollt der Browser selbst,
 * samt Schwung. Angefasst wird nur Maus und Stift.
 *
 * window.VBScrollAffordance() sucht erneut — noetig fuer Kaesten, die es beim
 * Laden noch nicht gibt (.uif-table-wrapper entsteht erst im Item-Modal).
 */
(function () {
  // Ziehen bekommt jeder Kasten. Die Kante nicht: die Evolutions-Matrix
  // bringt ihre eigene mit, die auf ihre klebende System-Spalte Ruecksicht
  // nimmt (src/pages/evolution.astro).
  // .sd__jump__in stand hier bis D-01 in BEIDEN Listen. Die Kapitel-
  // Sprungleiste gibt es nicht mehr — die Rail der Schiffskonsole ist an ihre
  // Stelle getreten und bringt ihre eigene waagerechte Form unter 900px mit
  // (.holo__rail in ShipDetail.astro).
  var SEL_DRAG =
    '.do__tablewrap,.md__tblWrap,.pj-tblscroll,.uif-table-wrapper,.sd__paints,.evo__scroll';
  /* ⚠⚠ .holo__rail NACHGETRAGEN 21.08.2026. Der Kommentar oben hielt fest, die
     Rail "bringt ihre eigene waagerechte Form mit" — das stimmt (unter 900px
     flex-wrap:nowrap + overflow-x:auto), nur bekam sie nie einen HINWEIS
     darauf. Gemessen bei 390px: die Blende ist 1128px breit in 390px Fenster,
     also liegen fuenf der acht Gruppen ausserhalb des Bildes — und theme.css
     blendet mit `*{scrollbar-width:none!important}` jede Leiste aus. Die
     Hauptnavigation der Seite war auf dem Telefon zu zwei Dritteln unsichtbar.
     Bewusst NUR in dieser Liste und NICHT in SEL_DRAG: am Schreibtisch bricht
     die Blende um statt zu schieben, ein Maus-Ziehen waere dort wirkungslos
     und koennte Klicks auf die Eintraege stoeren. Auch keine sichtbare
     Bildlaufleiste wie bei den Tabellen in mobile-ux.css 5c — eine 8px-Leiste
     unter den Registerkarten liegt mitten im Bild der Buehne. Die weiche Kante
     traegt hier allein. */
  var SEL_FADE =
    '.do__tablewrap,.md__tblWrap,.pj-tblscroll,.uif-table-wrapper,.sd__paints,.holo__rail,.as-jump';
  // Senkrechte Kante fuer die Bildlauf-Kaesten aus Task 6/mobile-ux.css 5d.
  // .holo__readout (Schiffskonsole) traegt die Klasse .vb-scrollbox bewusst
  // NICHT — deren max-height:calc(100vh…) wuerde die Hoehenbindung an die
  // Buehne zerreissen, beide sitzen in derselben Grid-Zeile —, gehoert aber in
  // genau dieselbe Behandlung und steht deshalb hier namentlich. Zweiter
  // Pflichteintrag dazu in mobile-ux.css Abschnitt 5d.
  // .snav-deck__frame (Hauptmenue) kam am 30.08.2026 dazu. Gemessen bei
  // 390x844: 19 Eintraege, 1361 px Inhalt in 844 px Rahmen — sechs Zeilen
  // standen unter der Kante, im Querformat (844x390) fuenfzehn. Der Rahmen
  // traegt overflow-y:auto, also WAR er scrollbar; nur sagte das niemandem
  // etwas, weil assets/theme.css jede Bildlaufleiste ausblendet. Genau die
  // Falle, die der Kopfkommentar von mobile-ux.css 5c fuer Tabellen
  // beschreibt — hier traf sie das Menue jeder einzelnen Seite.
  var SEL_VFADE = '.vb-scrollbox,.holo__readout,.snav-deck__frame';
  // Kaesten mit `overscroll-behavior: contain`, die im Seitenfluss stehen.
  // Die Sperre soll verhindern, dass am Ende der Liste die Seite weiterrollt.
  // Chrome wendet sie aber auch auf einen Rollkasten an, der gar nichts zu
  // rollen hat: das Rad darueber rollt dann NICHTS, weder Kasten noch Seite
  // (15.11.2026, Krisz: ueber der Missionsliste eines Rezepts liess sich die
  // Crafting-Seite nicht scrollen; gemessen in Chrome 153, dieselbe tote
  // Zone ueber jeder kurzen Trefferliste). Solange ein Kasten in einer Achse
  // keinen Ueberlauf hat, traegt er deshalb data-rad-durch mit dieser Achse,
  // und assets/mobile-ux.css (Abschnitt 5d) nimmt die Sperre dort zurueck.
  // PFLICHT: wer einem Kasten im Seitenfluss overflow:auto UND
  // overscroll-behavior:contain gibt, traegt ihn hier ein.
  var SEL_DURCH =
    '.vb-scrollbox,.cdb-res-list,.calc-mat-list,.cbm__mis,.mm__terms,.cdb-plan-shop,' +
    '.cdb-sidebar,.calc-sidebar,.uif-sidebar,.cdb-modal__box,' +
    // Werkzeug-Standard (src/lib/werkzeugStandard.ts): Leiste und Blatt.
    '.wz-rail,.wz-blatt__box';

  var faders = [];
  var vfaders = [];

  function syncFade(el) {
    el.classList.toggle('is-more', el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
  }
  // Spiegelbild von syncFade: senkrecht statt waagerecht.
  function syncVFade(el) {
    el.classList.toggle('is-more-y', el.scrollHeight - el.clientHeight - el.scrollTop > 2);
  }
  // Steht der Kasten in einer festgestellten Ebene (Dialog, Blatt, Schublade),
  // gibt er das Rad nur weiter, wenn darin ueber ihm noch ein Rollkasten
  // steht. Sonst ist er selbst die Grenze der Ebene, und das Rad ginge an die
  // Seite dahinter.
  function darfDurch(el) {
    var innen = false;
    for (var n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      var s = getComputedStyle(n);
      if (n !== el && /auto|scroll/.test(s.overflowY + ' ' + s.overflowX)) innen = true;
      if (s.position === 'fixed') return innen;
    }
    return true;
  }
  // `kurz`: steht das Ergebnis schon am Kasten, bleibt die Frage nach der
  // Ebene aus (der Weg ueber die Zeigerereignisse laeuft bei jeder Bewegung
  // der Maus). Ob ein Kasten in einer festgestellten Ebene liegt, aendert
  // sich nur mit der Fensterbreite, und dort misst syncAll ganz.
  function syncDurch(el, kurz) {
    var achsen = '';
    if (el.scrollWidth - el.clientWidth <= 1) achsen = 'x';
    if (el.scrollHeight - el.clientHeight <= 1) achsen += (achsen ? ' ' : '') + 'y';
    if (kurz && achsen && el.getAttribute('data-rad-durch') === achsen) return;
    if (achsen && !darfDurch(el)) achsen = '';
    if (achsen) {
      if (el.getAttribute('data-rad-durch') !== achsen) el.setAttribute('data-rad-durch', achsen);
    } else if (el.hasAttribute('data-rad-durch')) {
      el.removeAttribute('data-rad-durch');
    }
  }
  // Vom Ziel eines Ereignisses aufwaerts: jeder Kasten der Liste, in dem es
  // steckt. Laeuft, BEVOR gerollt wird (Zeiger kommt, Finger setzt auf, Fokus
  // wandert hinein) und beim Rad selbst, falls sich der Inhalt unter dem
  // ruhenden Zeiger geaendert hat.
  function syncDurchAb(ziel) {
    var el = ziel && ziel.closest ? ziel.closest(SEL_DURCH) : null;
    while (el) {
      if (durchKaesten.indexOf(el) < 0) durchKaesten.push(el);
      syncDurch(el, true);
      el = el.parentElement ? el.parentElement.closest(SEL_DURCH) : null;
    }
  }
  // Die Kaesten der Liste, EINMAL gesucht statt bei jedem Messen. Gemessen
  // wird nach jedem Klick und jeder Eingabe (siehe unten); die Suche geht
  // dagegen durchs ganze Dokument, auf der Crafting-Seite durch gut 40.000
  // Elemente. Bei jedem Klick gesucht, verdoppelte das die Laufzeit von
  // verify:clienttext auf dieser Seite (61 statt 30 s, Zeitbudget gerissen,
  // 15.11.2026). Gesucht wird beim Laden, bei jedem window.VBScrollAffordance()
  // und wenn sich das Fenster aendert. Einen Kasten, der erst spaeter
  // entsteht, traegt syncDurchAb nach, sobald Zeiger, Finger, Fokus oder Rad
  // ihn erreichen, also bevor er rollen muss.
  var durchKaesten = [];
  function sucheDurch() {
    durchKaesten = Array.prototype.slice.call(document.querySelectorAll(SEL_DURCH));
  }
  function syncAll() {
    for (var i = 0; i < faders.length; i++) syncFade(faders[i]);
    for (var k = 0; k < vfaders.length; k++) syncVFade(vfaders[k]);
    for (var d = durchKaesten.length - 1; d >= 0; d--) {
      if (durchKaesten[d].isConnected === false) durchKaesten.splice(d, 1);
      else syncDurch(durchKaesten[d]);
    }
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

  // Messen (scrollWidth & Co.) erst im naechsten Bild. scan() laeuft beim
  // Laden VOR dem ersten Zeichnen; jede Messung dort erzwang ein komplettes
  // Layout der halbfertigen Seite, das der Browser fuers erste Bild gleich
  // noch einmal machte. Im rAF-Rueckruf faellt die Messung mit dem ohnehin
  // faelligen Layout zusammen. Im Item-Modal hilft es doppelt: scan() laeuft
  // dort, waehrend das Modal noch display:none ist — gemessen wird jetzt erst,
  // wenn es steht.
  var pending = [];
  var queued = false;
  var nextFrame = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
  function queueSync() {
    if (queued) return;
    queued = true;
    nextFrame(function () {
      queued = false;
      var list = pending;
      pending = [];
      for (var i = 0; i < list.length; i++) markDraggable(list[i]);
      syncAll();
    });
  }

  function scan() {
    var drag = document.querySelectorAll(SEL_DRAG);
    for (var i = 0; i < drag.length; i++) {
      var el = drag[i];
      if (el.hasAttribute('data-dragscroll')) continue;   // schon versorgt
      el.setAttribute('data-dragscroll', '');
      draggables.push(el);
      enableDrag(el);
      pending.push(el);
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
    sucheDurch();
    queueSync();
  }

  window.VBScrollAffordance = scan;
  window.addEventListener('resize', function () { sucheDurch(); onResize(); });
  ['pointerover', 'touchstart', 'focusin', 'wheel'].forEach(function (typ) {
    document.addEventListener(typ, function (e) { syncDurchAb(e.target); }, { capture: true, passive: true });
  });
  // Ein Klick oder eine Eingabe aendert oft den Inhalt eines Kastens, waehrend
  // der Zeiger darueber ruht (Filter, Suche, Rezeptwahl). Danach neu messen:
  // im naechsten Bild, und einmal spaeter fuer alles, was verzoegert zeichnet
  // (entprellte Suche, nachgeladene Daten). Gemessen werden die bekannten
  // Kaesten (durchKaesten), gesucht wird hier nicht.
  var spaeter = 0;
  ['click', 'input', 'change'].forEach(function (typ) {
    document.addEventListener(typ, function () {
      queueSync();
      clearTimeout(spaeter);
      spaeter = setTimeout(queueSync, 400);
    }, { capture: true, passive: true });
  });
  // Die Anzeigeschriften laden nach und aendern die Tabellenbreite.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  scan();
})();
