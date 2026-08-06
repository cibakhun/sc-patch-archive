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
  var styleEl = null;
  var bubbleEl = null;

  var STAGE2_CSS =
    'html[data-help-on] [data-help]{outline:2px dashed var(--accent, #ff5e1a);outline-offset:3px;border-radius:2px;}' +
    '#tool-help__bubble{position:fixed;z-index:9700;margin:0;max-width:min(18rem, calc(100vw - 2rem));' +
    'padding:.55rem .75rem;border:1px solid var(--line, var(--line-soft));background:var(--surface, #14121c);' +
    'color:var(--text, #e8eefc);font-family:var(--font-ui, system-ui, sans-serif);font-size:.8rem;' +
    'line-height:1.45;box-shadow:0 10px 28px rgba(0,0,0,.38);}' +
    '#tool-help__bubble .tool-help__bubble-eyebrow{display:block;font-size:.68rem;font-weight:700;' +
    'letter-spacing:.08em;text-transform:uppercase;color:var(--accent, #ff5e1a);margin-bottom:.2rem;}';

  function activate() {
    document.documentElement.setAttribute('data-help-on', '');

    styleEl = document.createElement('style');
    styleEl.textContent = STAGE2_CSS;
    document.head.appendChild(styleEl);

    bubbleEl = document.createElement('div');
    bubbleEl.id = 'tool-help__bubble';
    bubbleEl.setAttribute('popover', 'auto');
    bubbleEl.setAttribute('role', 'tooltip');
    var eyebrow = document.createElement('b');
    eyebrow.className = 'tool-help__bubble-eyebrow';
    eyebrow.textContent = (activeBtn && activeBtn.getAttribute('data-bubble-label')) || '';
    var text = document.createElement('span');
    text.className = 'tool-help__bubble-text';
    bubbleEl.appendChild(eyebrow);
    bubbleEl.appendChild(text);
    document.body.appendChild(bubbleEl);

    document.addEventListener('focusin', onPoint);
    document.addEventListener('mouseover', onPoint);
    document.addEventListener('keydown', onEscape);
  }

  function deactivate() {
    document.documentElement.removeAttribute('data-help-on');

    if (styleEl) {
      styleEl.remove();
      styleEl = null;
    }
    if (bubbleEl) {
      if (bubbleEl.hasAttribute('popover')) {
        try {
          bubbleEl.hidePopover();
        } catch (e) {}
      }
      bubbleEl.remove();
      bubbleEl = null;
    }

    document.removeEventListener('focusin', onPoint);
    document.removeEventListener('mouseover', onPoint);
    document.removeEventListener('keydown', onEscape);
  }

  function onPoint(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-help]') : null;
    if (!el || !bubbleEl) return;

    bubbleEl.querySelector('.tool-help__bubble-text').textContent = el.getAttribute('data-help') || '';
    el.setAttribute('aria-describedby', bubbleEl.id);

    var rect = el.getBoundingClientRect();
    bubbleEl.style.left = Math.max(8, rect.left) + 'px';
    bubbleEl.style.top = rect.bottom + 8 + 'px';

    try {
      bubbleEl.showPopover();
    } catch (e) {}
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
