// wikelo-bridge.js — Item-Finder-Brücke der Wikelo-Seite (kanonische Quelle: /assets).
// Die klickbaren Material-/Belohnungs-Namen sind schon im SSR-Markup markiert
// (data-item = kanonischer DB-Name, via src/lib/wikeloItemMatch.ts) — hier hängt
// nur noch das Verhalten dran: Klick öffnet ein kompaktes Popup mit Bezugsquellen
// (Ort · Art · Preis) plus Deep-Link in den Item Finder. Die ~3-MB-Items-DB wird
// lazy geladen (Hover-Prefetch aufs Grid, spätestens beim ersten Klick).
// Deep-Link ?item=<Name> hebt alle Trades hervor, die das Item geben oder brauchen.
// i18n über window.__WKB (Muster wie window.__UIF / window.__CRAFT).
(function () {
  'use strict';
  var CFG = window.__WKB || {};
  var T = CFG.t || {};
  var LOC = CFG.lang === 'en' ? 'en-US' : 'de-DE';
  function tr(k, d) { return T[k] != null ? T[k] : d; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // "50× MG Scrip" → "MG Scrip" (gleiche Normalisierung wie im Item Finder)
  function parseName(s) { return String(s || '').replace(/^\s*[\d.,]+\s*[x×]\s*/i, '').trim(); }

  var grid = document.getElementById('wk-tc-grid');
  if (!grid) return;

  // ---- Items-DB lazy laden ----
  var ITEMS_BY_NAME = null;
  var itemsPromise = null;
  function loadItems() {
    if (!itemsPromise) {
      itemsPromise = fetch(CFG.itemsUrl || '/assets/universal-items.json')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          ITEMS_BY_NAME = {};
          (j.items || []).forEach(function (it) {
            if (it.name) ITEMS_BY_NAME[it.name.toLowerCase()] = it;
          });
        })
        .catch(function () { ITEMS_BY_NAME = {}; });
    }
    return itemsPromise;
  }
  // Erst bei Interaktions-Absicht laden — passive Leser zahlen die 3 MB nicht.
  ['pointerover', 'touchstart', 'focusin'].forEach(function (ev) {
    grid.addEventListener(ev, function once() {
      grid.removeEventListener(ev, once);
      loadItems();
    }, { passive: true });
  });

  // ---- Klicks auf SSR-markierte Namen (data-item) ----
  function openFor(el) {
    var name = el.getAttribute('data-item');
    if (!name || !modal || !body) return;
    body.innerHTML = '<p class="wkb__note">' + esc(tr('loading', 'Wird geladen…')) + '</p>';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    loadItems().then(function () {
      if (modal.hidden) return; // inzwischen geschlossen
      var it = ITEMS_BY_NAME && ITEMS_BY_NAME[name.toLowerCase()];
      if (it) { renderPopup(it); return; }
      body.innerHTML = '<h2 class="wkb__name">' + esc(name) + '</h2>' +
        '<p class="wkb__note">' + esc(tr('catalogNote', 'Keine verifizierten Shop- oder Loot-Daten für dieses Item.')) + '</p>';
    });
  }
  grid.addEventListener('click', function (e) {
    var el = e.target.closest('[data-item]');
    if (el) { e.preventDefault(); openFor(el); }
  });
  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest('[data-item]');
    if (el) { e.preventDefault(); openFor(el); }
  });

  // ---- Popup (kompakter Item-Finder-Ausschnitt) ----
  var modal = document.getElementById('wkb-modal');
  var body = document.getElementById('wkb-modal-body');
  function closePopup() {
    if (modal && !modal.hidden) { modal.hidden = true; document.body.style.overflow = ''; }
  }
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closePopup(); });
    var x = modal.querySelector('.wkb__x');
    if (x) x.addEventListener('click', closePopup);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopup(); });
  }

  function kindLabel(k) {
    if (k === 'shop') return tr('kindShop', 'Shop');
    if (k === 'vehicle') return tr('kindVehicle', 'Schiffshändler');
    if (k === 'loot') return tr('kindLoot', 'Loot');
    return k;
  }

  function renderPopup(it) {
    var url = (CFG.itemPage || '/item-finder.html') + '?item=' + encodeURIComponent(it.name);
    var html = '<div class="wkb__cat">' + esc(it.category || '') + '</div>' +
      '<h2 class="wkb__name">' + esc(it.name) + '</h2>' +
      '<h3 class="wkb__h">' + esc(tr('sectionObtain', 'Bezugsquellen')) + '</h3>';
    var obtain = (it.obtain || []).slice().sort(function (a, b) {
      var pa = a.price != null ? a.price : Infinity;
      var pb = b.price != null ? b.price : Infinity;
      return pa - pb;
    });
    if (obtain.length) {
      var shown = obtain.slice(0, 5);
      html += '<div class="wkb__rows">' + shown.map(function (o) {
        return '<div class="wkb__row"><span>' + esc(o.loc) + ' · ' + esc(kindLabel(o.kind)) + '</span>' +
          '<b>' + (o.price != null ? Number(o.price).toLocaleString(LOC) + ' aUEC' : '—') + '</b></div>';
      }).join('') + '</div>';
      if (obtain.length > shown.length) {
        html += '<p class="wkb__note">' + esc(tr('more', '+{n} weitere Quellen im Item Finder').replace('{n}', obtain.length - shown.length)) + '</p>';
      }
    } else {
      html += '<p class="wkb__note">' + esc(tr('catalogNote', 'Keine verifizierten Shop- oder Loot-Daten für dieses Item.')) + '</p>';
    }
    html += '<a class="wkb__flink" href="' + esc(url) + '">' + esc(tr('openFinder', 'Im Item Finder öffnen')) + ' &rarr;</a>';
    body.innerHTML = html;
  }

  // ---- Deep-Link: ?item=<Name> hebt passende Trades hervor (ohne Items-DB) ----
  (function () {
    var want = null;
    try { want = new URLSearchParams(location.search).get('item'); } catch (e) { return; }
    if (!want) return;
    var wl = want.toLowerCase();
    var first = null;
    grid.querySelectorAll('.wk-tc').forEach(function (card) {
      var hit = false;
      card.querySelectorAll('.wk-mats li, .wk-get-name').forEach(function (el) {
        var canon = el.getAttribute('data-item'); // kanonischer DB-Name (SSR)
        if (canon && canon.toLowerCase() === wl) hit = true;
        else if (parseName(el.textContent).toLowerCase() === wl) hit = true;
      });
      if (hit) { card.classList.add('wk-hit'); if (!first) first = card; }
    });
    if (first) {
      // Erst nach `load` scrollen — vorher verschieben nachladende Bilder das Layout
      var doScroll = function () { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      if (document.readyState === 'complete') doScroll();
      else window.addEventListener('load', function () { setTimeout(doScroll, 60); }, { once: true });
      loadItems(); // Namen im hervorgehobenen Trade direkt klickbar machen
    }
  })();
})();
