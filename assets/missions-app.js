/* Missions-Browser — Filtern/Sortieren der serverseitig gerenderten Karten.
   Kein Fetch: die Daten stecken schon als data-Attribute im DOM (wie schiffe.astro).
   Vanilla, kein Framework, laeuft ohne Buildschritt. */
(function () {
  'use strict';
  var CFG = window.__MX || {};
  var T = CFG.t || {};

  var grid = document.getElementById('mx-grid');
  var bar = document.getElementById('mx-bar');
  if (!grid || !bar) return;

  var q = document.getElementById('mx-q');
  var selType = document.getElementById('mx-type');
  var selGiver = document.getElementById('mx-giver');
  var selFaction = document.getElementById('mx-faction');
  var selLoc = document.getElementById('mx-loc');
  var selLegal = document.getElementById('mx-legal');
  var selSort = document.getElementById('mx-sort');
  var reset = document.getElementById('mx-reset');
  var out = document.getElementById('mx-count');
  var none = document.getElementById('mx-none');

  // Karten einmal einlesen; ab dann nur noch Zahlen/Strings vergleichen.
  var cards = [].slice.call(grid.children).map(function (el) {
    return {
      el: el,
      search: el.getAttribute('data-search') || '',
      name: el.getAttribute('data-name') || '',
      type: (el.getAttribute('data-type') || '').split(' ').filter(Boolean),
      giver: (el.getAttribute('data-giver') || '').split(' ').filter(Boolean),
      faction: (el.getAttribute('data-faction') || '').split(' ').filter(Boolean),
      loc: (el.getAttribute('data-loc') || '').split(' ').filter(Boolean),
      legal: el.getAttribute('data-legal') || '',
      reward: +(el.getAttribute('data-reward') || 0),
      count: +(el.getAttribute('data-count') || 0),
    };
  });

  var has = function (arr, v) { return !v || arr.indexOf(v) !== -1; };
  // Mehrwortsuche: jedes Token muss vorkommen (UND), damit "bounty hurston" greift.
  function matchQ(c, toks) {
    for (var i = 0; i < toks.length; i++) if (c.search.indexOf(toks[i]) === -1) return false;
    return true;
  }

  function apply() {
    var toks = (q.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    var vType = selType.value, vGiver = selGiver.value, vFaction = selFaction.value;
    var vLoc = selLoc.value, vLegal = selLegal.value;
    var n = 0;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      // "both" (Familie hat legale UND illegale Angebote) passt auf beide Filter
      var okLegal = !vLegal || c.legal === vLegal || c.legal === 'both';
      var ok = okLegal && has(c.type, vType) && has(c.giver, vGiver)
        && has(c.faction, vFaction) && has(c.loc, vLoc) && matchQ(c, toks);
      c.el.hidden = !ok;
      if (ok) n++;
    }
    if (out) out.textContent = n + ' ' + (T.results || 'results');
    if (none) none.hidden = n !== 0;
    sort();
  }

  function sort() {
    var mode = selSort.value;
    var vis = cards.filter(function (c) { return !c.el.hidden; });
    vis.sort(function (a, b) {
      if (mode === 'name') return a.name.localeCompare(b.name);
      if (mode === 'reward') return (b.reward - a.reward) || a.name.localeCompare(b.name);
      return (b.count - a.count) || a.name.localeCompare(b.name);
    });
    // Reihenfolge in einem Rutsch setzen; DocumentFragment vermeidet 432 Reflows.
    var frag = document.createDocumentFragment();
    for (var i = 0; i < vis.length; i++) frag.appendChild(vis[i].el);
    grid.appendChild(frag);
  }

  var timer = null;
  function debounced() { clearTimeout(timer); timer = setTimeout(apply, 110); }

  q.addEventListener('input', debounced);
  [selType, selGiver, selFaction, selLoc, selLegal, selSort].forEach(function (s) {
    s.addEventListener('change', apply);
  });
  if (reset) {
    reset.addEventListener('click', function () {
      q.value = '';
      [selType, selGiver, selFaction, selLoc, selLegal].forEach(function (s) { s.value = ''; });
      selSort.value = 'count';
      apply();
    });
  }

  // Deeplink: /missionen.html?type=bounty&q=hurston
  (function fromUrl() {
    var p = new URLSearchParams(location.search);
    var map = { q: q, type: selType, giver: selGiver, faction: selFaction, loc: selLoc, legal: selLegal, sort: selSort };
    var any = false;
    for (var k in map) {
      var v = p.get(k);
      if (v == null) continue;
      // Nur setzen, wenn das Select den Wert wirklich kennt — sonst leert der
      // Browser die Auswahl und alles waere gefiltert.
      if (map[k].tagName === 'SELECT' && !map[k].querySelector('option[value="' + CSS.escape(v) + '"]')) continue;
      map[k].value = v;
      any = true;
    }
    if (any && bar.scrollIntoView) bar.scrollIntoView({ block: 'start' });
  })();

  apply();
})();
