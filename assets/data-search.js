// data-search.js — die Suche auf den schlanken Datenseiten (DataShell).
//
// Die ~14.000 Item- und Blueprint-Seiten tragen bewusst kein Inline-Skript
// und kein Overlay-Markup (src/components/DataShell.astro, Kopf). Sie tragen
// nur den Suchknopf in der Kopfleiste mit drei Adressen: Logik (data-js),
// Aussehen (data-css) und Texte (data-ui, /search-ui.json bzw. /de/…, aus
// src/lib/searchUi.ts — dieselbe Quelle wie das Overlay auf den Seiten mit
// voller Navigation).
//
// Diese Datei ist klein und gecacht. Erst beim ersten Antippen (oder Strg+K,
// "/") holt sie alle drei, baut das Overlay-Markup wie SearchOverlay.astro
// und oeffnet es mit assets/search-overlay.js — dieselbe Logik wie ueberall
// sonst. Ab dann gehoeren Tasten und Klicks dem Overlay.
(function () {
  var btn = document.querySelector('[data-scs-boot]');
  if (!btn) return;
  var d = btn.dataset;
  var state = 0; // 0 nichts geladen · 1 laedt · 2 bereit
  var cssReady = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function kbdLine(key, label) {
    var s = el('span');
    s.appendChild(el('kbd', null, key));
    s.appendChild(document.createTextNode(' ' + (label || '')));
    return s;
  }
  // Gleiches Markup wie src/components/SearchOverlay.astro.
  function build(ui) {
    var L = ui.l || {};
    var root = el('div', 'scs');
    root.id = 'scs';
    root.hidden = true;
    var attrs = ui.root || {};
    Object.keys(attrs).forEach(function (k) {
      if (/^data-[a-z-]+$/.test(k)) root.setAttribute(k, attrs[k]);
    });
    var back = el('div', 'scs__back');
    back.setAttribute('data-scs-close', '');
    var panel = el('div', 'scs__panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', L.dialog || '');
    var bar = el('div', 'scs__bar');
    var prompt = el('span', 'scs__prompt', '›');
    prompt.setAttribute('aria-hidden', 'true');
    var input = el('input');
    input.id = 'scs-in';
    input.type = 'search';
    input.placeholder = L.placeholder || '';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', L.term || '');
    var sys = el('span', 'scs__sys', (L.sys || '').replace(/&nbsp;/g, '\u00a0'));
    sys.setAttribute('aria-hidden', 'true');
    var x = el('button', 'scs__x', 'Esc');
    x.type = 'button';
    x.setAttribute('data-scs-close', '');
    x.setAttribute('aria-label', L.close || '');
    bar.appendChild(prompt);
    bar.appendChild(input);
    bar.appendChild(sys);
    bar.appendChild(x);
    var list = el('ul', 'scs__list');
    list.id = 'scs-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', L.results || '');
    var foot = el('div', 'scs__foot');
    foot.appendChild(kbdLine('↑↓', L.pick));
    foot.appendChild(kbdLine('↵', L.open));
    foot.appendChild(kbdLine('Esc', L.dismiss));
    panel.appendChild(bar);
    panel.appendChild(list);
    panel.appendChild(foot);
    root.appendChild(back);
    root.appendChild(panel);
    document.body.appendChild(root);
  }
  function start() {
    if (state === 2) {
      if (window.__scsOpen) window.__scsOpen();
      return;
    }
    if (state === 1) return;
    state = 1;
    btn.setAttribute('aria-busy', 'true');
    // Reihenfolge: Texte holen und Markup bauen, erst dann die Logik laden
    // (sie sucht #scs beim Start). Geoeffnet wird, wenn Logik UND Aussehen da
    // sind — sonst blitzt das Overlay ungestylt auf. Fehlt nur das CSS (Netz),
    // oeffnet es trotzdem. Ein zweiter Versuch (nach Netzfehler) haengt das
    // schon geladene CSS nicht noch einmal an.
    var pending = cssReady ? 1 : 2;
    var done = function () {
      if (--pending > 0) return;
      btn.removeAttribute('aria-busy');
      if (window.__scsOpen) {
        state = 2;
        window.__scsOpen();
      } else {
        state = 0; // Logik kam nicht an: beim naechsten Antippen neu versuchen
      }
    };
    if (!cssReady) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = d.css;
      link.onload = function () {
        cssReady = true;
        done();
      };
      link.onerror = function () {
        link.remove();
        done();
      };
      document.head.appendChild(link);
    }
    fetch(d.ui)
      .then(function (r) {
        if (!r.ok) throw new Error('ui ' + r.status);
        return r.json();
      })
      .then(function (ui) {
        if (!document.getElementById('scs')) build(ui);
        var s = document.createElement('script');
        s.src = d.js;
        s.onload = done;
        s.onerror = done;
        document.head.appendChild(s);
      })
      .catch(function () {
        btn.removeAttribute('aria-busy');
        state = 0;
      });
  }
  btn.addEventListener('click', start);
  document.addEventListener('keydown', function (e) {
    if (state === 2) return; // ab jetzt hoert das Overlay selbst zu
    var t = (e.target && e.target.tagName) || '';
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      start();
    } else if (e.key === '/' && !e.defaultPrevented && !/^(input|textarea|select)$/i.test(t)) {
      e.preventDefault();
      start();
    }
  });
})();
