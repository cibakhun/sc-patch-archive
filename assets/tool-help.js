/* ============================================================
   tool-help.js — EIN Skript fuer alle Werkzeug-Erklaerungen.

   Zwei getrennte Ablaeufe:

   1. Erstbesuch (laeuft sofort und einmalig beim Laden): liest den
      Speicher-Eintrag "vb.help.seen", oeffnet jeden noch nicht
      vermerkten Zweck-Abschnitt und schreibt den Eintrag danach EIN
      Mal zurueck. Kein Horcher, keine Wiederholung, kein Nachladen.

   2. Element-Hilfe (weiter unten zwischen den beiden Marken
      eingerahmt): existiert erst ab dem Klick auf den Knopf
      ".js-tool-help". Umrandet die erklaerten Bedienelemente der
      aktuellen Ansicht ueber eine einzelne eingefuegte Formatregel
      und zeigt beim Verweilen darauf jeweils eine einzelne
      Erklaerung. Ein Tastendruck beendet die Erklaerung wieder
      vollstaendig — danach ist der Zustand derselbe wie vor dem
      ersten Klick.

   Vor dem ersten Klick existiert ausser dem EINEN delegierten
   Klick-Horcher fuer den Umschalt-Knopf nichts von alldem — das ist
   die Kostenfreiheit aus DOC-06/D-11, maschinell nachgehalten in
   scripts/verify-help.mjs.

   Bekannte Grenze der Umrandung: sie liest bei jedem Verweilen live
   nach, welches Element gerade getroffen ist, statt sich Knoten zu
   merken — deshalb ueberlebt sie jeden Neuaufbau des Markups, auch
   wenn ein Werkzeug seine Filterchips per Zuweisung neu befuellt
   (DOC-03).

   Stil wie assets/offcanvas.js: IIFE, ohne Bundler, ohne
   Abhaengigkeiten.
   ============================================================ */
(function () {
  'use strict';

  if (window.__toolHelpLoaded) return;
  window.__toolHelpLoaded = true;

  var SEEN_KEY = 'vb.help.seen';

  // ---- Erstbesuch: EIN Lesen, EIN Schreiben, danach nichts mehr. ----
  (function openOnFirstVisit() {
    var seen = {};
    try {
      var raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) seen = raw;
    } catch (e) {
      seen = {};
    }

    var changed = false;
    var sections = document.querySelectorAll('details.tool-help');
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      var id = section.getAttribute('data-tool-id');
      if (id && !seen[id]) {
        section.open = true;
        seen[id] = 1;
        changed = true;
      }
    }

    if (changed) {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
      } catch (e) {
        /* Speicher voll oder gesperrt — der Zweck-Abschnitt bleibt trotzdem offen. */
      }
    }
  })();

  var activeBtn = null; // gerade gedrueckter Umschalt-Knopf, oder null

  function setBtnState(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var label = btn.getAttribute(on ? 'data-label-on' : 'data-label-off');
    if (label) btn.textContent = label;
  }

  /* HELP:STAGE2:BEGIN */
  /* Der Elemente-Modus lief bis 16.08.2026 ausschliesslich auf DIESEM
     Dokument: `data-help-on` am <html>, das Stilblatt in dessen <head>, die
     Sprechblase in dessen <body>, die Zeigerhandler an dessen document.
     Seit die Mining-Werkbank ihre rechte Spalte in ein eigenes Fenster
     auslagern kann, reicht das nicht mehr — gemessen an der ausgelieferten
     Seite: mit „Elemente" VOR dem Auslagern bekam das Fremdfenster zwar die
     gestrichelten Ringe (sie reisen im kopierten Stilblatt mit), aber KEINE
     Sprechblase; in der anderen Reihenfolge gar nichts. Der Knopf tat also
     fuer ein Drittel des Werkzeugs sichtbar nichts.
     Deshalb ist der Apparat jetzt pro Dokument angelegt. Fuer jedes Werkzeug
     ohne Fremdfenster aendert sich nichts: die Liste enthaelt dann genau
     dieses eine Dokument, und jeder Zweig unten laeuft einmal. */
  var docs = [document];      // Dokumente, die der Modus bedienen soll
  var stages = [];            // {doc, styleEl, bubbleEl} je AKTIVEM Dokument
  var describedEl = null; // Element, das gerade aria-describedby traegt, oder null

  function stageFor(node) {
    var d = node && node.ownerDocument;
    for (var i = 0; i < stages.length; i++) if (stages[i].doc === d) return stages[i];
    return null;
  }

  var STAGE2_CSS =
    'html[data-help-on] [data-help]{outline:2px dashed var(--accent, #ff5e1a);outline-offset:3px;border-radius:2px;}' +
    '#tool-help__bubble{position:fixed;z-index:9700;margin:0;max-width:min(18rem, calc(100vw - 2rem));' +
    'pointer-events:none;' +
    'padding:.55rem .75rem;border:1px solid var(--line, var(--line-soft));background:var(--surface, #14121c);' +
    'color:var(--text, #e8eefc);font-family:var(--font-ui, system-ui, sans-serif);font-size:var(--fs-6);' +
    'line-height:1.45;box-shadow:0 10px 28px rgba(0,0,0,.38);}' +
    '#tool-help__bubble .tool-help__bubble-eyebrow{display:block;font-size:var(--fs-4);font-weight:700;' +
    'letter-spacing:var(--ls-10);text-transform:uppercase;color:var(--accent, #ff5e1a);margin-bottom:.2rem;}';

  function stageOn(doc) {
    if (!doc || !doc.body || stageForDoc(doc)) return;
    doc.documentElement.setAttribute('data-help-on', '');

    /* ⚠ Auch dann anlegen, wenn das Fremdfenster das Stilblatt beim Oeffnen
       schon mitkopiert hat: zwei identische Regelsaetze schaden nicht, ein
       fehlender schon — und welcher Fall vorliegt, haengt allein daran, in
       welcher Reihenfolge der Nutzer geklickt hat. */
    var styleEl = doc.createElement('style');
    styleEl.textContent = STAGE2_CSS;
    doc.head.appendChild(styleEl);

    /* Die Blase MUSS im selben Dokument stehen wie ihr Anker: sie liegt
       position:fixed und wird gegen DESSEN Sichtfeld gesetzt. Eine Blase im
       Seitendokument waere fuer einen Anker im Fremdfenster unsichtbar. */
    var bubbleEl = doc.createElement('div');
    bubbleEl.id = 'tool-help__bubble';
    bubbleEl.setAttribute('popover', 'auto');
    bubbleEl.setAttribute('role', 'tooltip');
    var eyebrow = doc.createElement('b');
    eyebrow.className = 'tool-help__bubble-eyebrow';
    eyebrow.textContent = (activeBtn && activeBtn.getAttribute('data-bubble-label')) || '';
    var text = doc.createElement('span');
    text.className = 'tool-help__bubble-text';
    bubbleEl.appendChild(eyebrow);
    bubbleEl.appendChild(text);
    doc.body.appendChild(bubbleEl);

    doc.addEventListener('focusin', onPoint);
    doc.addEventListener('mouseover', onPoint);
    doc.addEventListener('mouseout', onLeave);
    doc.addEventListener('focusout', onLeave);
    doc.addEventListener('keydown', onEscape);

    stages.push({ doc: doc, styleEl: styleEl, bubbleEl: bubbleEl });
  }

  function stageForDoc(doc) {
    for (var i = 0; i < stages.length; i++) if (stages[i].doc === doc) return stages[i];
    return null;
  }

  function stageOff(doc) {
    var st = stageForDoc(doc);
    if (!st) return;
    try { doc.documentElement.removeAttribute('data-help-on'); } catch (e) { /* Dokument schon weg */ }
    try { st.styleEl.remove(); } catch (e) { /* egal */ }
    if (st.bubbleEl) {
      if (st.bubbleEl.hasAttribute('popover')) { try { st.bubbleEl.hidePopover(); } catch (e) {} }
      try { st.bubbleEl.remove(); } catch (e) { /* egal */ }
    }
    try {
      doc.removeEventListener('focusin', onPoint);
      doc.removeEventListener('mouseover', onPoint);
      doc.removeEventListener('mouseout', onLeave);
      doc.removeEventListener('focusout', onLeave);
      doc.removeEventListener('keydown', onEscape);
    } catch (e) { /* Dokument schon weg */ }
    stages.splice(stages.indexOf(st), 1);
  }

  function activate() { for (var i = 0; i < docs.length; i++) stageOn(docs[i]); }

  function deactivate() {
    if (describedEl) {
      try { describedEl.removeAttribute('aria-describedby'); } catch (e) { /* Dokument schon weg */ }
      describedEl = null;
    }
    // Ueber eine Kopie laufen: stageOff() kuerzt `stages` waehrenddessen.
    var offen = stages.slice();
    for (var i = 0; i < offen.length; i++) stageOff(offen[i].doc);
  }

  /* Oeffentlicher Zugang fuer Werkzeuge, die Teile ihrer Oberflaeche in ein
     zweites Fenster legen (heute nur die Mining-Werkbank). Bewusst schmal:
     das Werkzeug meldet ein Dokument an und wieder ab, alles Weitere bleibt
     hier. Die Alternative — tool-help.js das Fremdfenster selbst suchen zu
     lassen — haette diese Datei an ein einzelnes Bauteil gebunden. */
  window.VBToolHelp = {
    addDoc: function (doc) {
      if (!doc || docs.indexOf(doc) !== -1) return;
      docs.push(doc);
      if (activeBtn) stageOn(doc); // laeuft der Modus gerade, sofort mitnehmen
    },
    removeDoc: function (doc) {
      var i = docs.indexOf(doc);
      if (i === -1) return;
      if (describedEl && describedEl.ownerDocument === doc) describedEl = null;
      stageOff(doc);
      docs.splice(i, 1);
    },
  };

  // Setzt die Blase an den SICHTBAREN Teil des Ankers und klappt nach
  // oben, wenn unterhalb kein Platz mehr ist (CR-01). Muss NACH
  // showPopover() laufen: davor ist die Blase noch display:none und
  // offsetWidth/offsetHeight waeren 0.
  /* ⚠ Alle Masse aus dem Dokument des ANKERS, nicht aus diesem hier: im
     Fremdfenster sind Sichtfeldbreite und -hoehe voellig andere, und eine
     gegen die Seite gerechnete Blase landete dort weit ausserhalb. */
  function place(el, st) {
    var doc = st.doc;
    var bubbleEl = st.bubbleEl;
    var r = el.getBoundingClientRect();
    var vw = doc.documentElement.clientWidth;
    var vh = doc.documentElement.clientHeight;
    var bw = bubbleEl.offsetWidth;
    var bh = bubbleEl.offsetHeight;
    var anchorTop = Math.max(8, r.top);
    var anchorBottom = Math.min(vh - 8, r.bottom);
    var top = anchorBottom + 8;
    if (bh && top + bh > vh - 8) top = Math.max(8, anchorTop - bh - 8);
    bubbleEl.style.top = (bh ? Math.min(top, vh - bh - 8) : top) + 'px';
    bubbleEl.style.left = (bw ? Math.min(Math.max(8, r.left), vw - bw - 8) : Math.max(8, r.left)) + 'px';
  }

  function onPoint(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-help]') : null;
    if (!el) return;
    var st = stageFor(el);
    if (!st) return;
    var bubbleEl = st.bubbleEl;

    bubbleEl.querySelector('.tool-help__bubble-text').textContent = el.getAttribute('data-help') || '';

    // Beschreibung an den TATSAECHLICH fokussierten Knoten, nicht an die
    // Huelle — sonst hoert eine Bildschirmleseausgabe nichts (CR-03).
    var describe = (e.type === 'focusin' && e.target && e.target.nodeType === 1) ? e.target : el;
    if (describedEl && describedEl !== describe) describedEl.removeAttribute('aria-describedby');
    describe.setAttribute('aria-describedby', bubbleEl.id);
    describedEl = describe;

    try {
      bubbleEl.showPopover();
    } catch (e) {}

    place(el, st);
  }

  // Verlaesst Zeiger oder Fokus den aktuellen Anker in Richtung eines
  // anderen Bereichs, wird die Blase sofort weggenommen — sonst bleibt
  // sie ueber dem naechsten Bedienelement stehen und blockiert es (CR-02).
  function onLeave(e) {
    var from = e.target && e.target.closest ? e.target.closest('[data-help]') : null;
    var to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('[data-help]') : null;
    if (!from || from === to) return;
    if (describedEl) {
      describedEl.removeAttribute('aria-describedby');
      describedEl = null;
    }
    var st = stageFor(from);
    if (st && st.bubbleEl) {
      try {
        st.bubbleEl.hidePopover();
      } catch (err) {}
    }
  }

  function onEscape(e) {
    if (e.key === 'Escape' && activeBtn) {
      setBtnState(activeBtn, false);
      deactivate();
      activeBtn = null;
    }
  }
  /* HELP:STAGE2:END */

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.js-tool-help') : null;
    if (!btn) return;

    var wasActive = btn === activeBtn;
    if (activeBtn) {
      setBtnState(activeBtn, false);
      deactivate();
      activeBtn = null;
    }
    if (!wasActive) {
      activeBtn = btn;
      activate();
      setBtnState(btn, true);
    }
  });
})();
