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
  var selGuild = document.getElementById('mx-guild');
  var selBp = document.getElementById('mx-bp');
  var selLegal = document.getElementById('mx-legal');
  var selSort = document.getElementById('mx-sort');
  var reset = document.getElementById('mx-reset');
  var out = document.getElementById('mx-count');
  // Zweite Anzeige ausserhalb der Schublade: unter 821 px faehrt die
  // Filterkonsole als Panel aus (siehe MissionsApp.astro), und mit ihr
  // verschwaende die Trefferzahl. Die Leiste daneben zeigt sie dort.
  var outM = document.getElementById('mx-count-m');
  var none = document.getElementById('mx-none');

  // Karten einmal einlesen; ab dann nur noch Zahlen/Strings vergleichen.
  // name kommt aus dem sichtbaren <h3> (data-name entfiel als HTML-Diät);
  // search startet als sichtbarer Kartentext und wird durch den vollen Index
  // aus /missions-search.json ersetzt, sobald der Fetch unten durch ist.
  // Die Karten stehen in Bloecken zu GRP (.mc-grp, content-visibility:auto —
  // siehe MissionsApp.astro). Die Bloecke sind reine Huellen: gefiltert und
  // sortiert wird ueber alle Karten, verteilt wird erst am Ende (place()).
  var GRP = +grid.getAttribute('data-grp') || 60;
  var groups = [].slice.call(grid.querySelectorAll('.mc-grp'));
  var cards = [].slice.call(groups.length ? grid.querySelectorAll('.mc') : grid.children).map(function (el) {
    var h = el.querySelector('.mc__h');
    var link = el.querySelector('.mc__link');
    var hrefM = link ? /\/missionen\/([^/]+)\.html/.exec(link.getAttribute('href') || '') : null;
    return {
      el: el,
      slug: hrefM ? hrefM[1] : '',
      search: (el.textContent || '').replace(/\s+/g, ' ').toLowerCase(),
      name: h ? h.textContent.trim().toLowerCase() : '',
      type: (el.getAttribute('data-type') || '').split(' ').filter(Boolean),
      giver: (el.getAttribute('data-giver') || '').split(' ').filter(Boolean),
      faction: (el.getAttribute('data-faction') || '').split(' ').filter(Boolean),
      loc: (el.getAttribute('data-loc') || '').split(' ').filter(Boolean),
      guild: (el.getAttribute('data-guild') || '').split(' ').filter(Boolean),
      legal: el.getAttribute('data-legal') || '',
      bp: el.getAttribute('data-bp') === '1',
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
    var vGuild = selGuild ? selGuild.value : '';
    var vBp = selBp ? selBp.value : '';
    var n = 0;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      // "both" (Familie hat legale UND illegale Angebote) passt auf beide Filter
      var okLegal = !vLegal || c.legal === vLegal || c.legal === 'both';
      var ok = okLegal && (!vBp || c.bp) && has(c.type, vType) && has(c.giver, vGiver)
        && has(c.faction, vFaction) && has(c.loc, vLoc) && has(c.guild, vGuild) && matchQ(c, toks);
      c.el.hidden = !ok;
      if (ok) n++;
    }
    var txt = n + ' ' + (T.results || 'results');
    if (out) out.textContent = txt;
    if (outM) outM.textContent = txt;
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
    place(vis);
  }

  // Gleiche Kinder in gleicher Reihenfolge? Dann bleibt das DOM unberuehrt —
  // beim Start ist das der Normalfall (der Server liefert die Vorgabe-
  // Sortierung), und 1.355 umgehaengte Karten kosteten sonst einen vollen
  // Stil- und Layoutdurchgang ueber die ganze Liste.
  function same(parent, els) {
    var kids = parent.children;
    if (kids.length !== els.length) return false;
    for (var i = 0; i < els.length; i++) if (kids[i] !== els[i]) return false;
    return true;
  }

  function place(vis) {
    if (!groups.length) {
      // Reihenfolge in einem Rutsch setzen; DocumentFragment vermeidet 432 Reflows.
      var frag0 = document.createDocumentFragment();
      for (var i0 = 0; i0 < vis.length; i0++) frag0.appendChild(vis[i0].el);
      grid.appendChild(frag0);
      return;
    }
    // Sichtbare Karten der Reihe nach in volle Bloecke — nur so endet jeder
    // Block mit einer vollen Rasterzeile. Ausgeblendete Karten (display:none,
    // belegen keine Zelle) sammelt der letzte Block; ein Block ohne
    // sichtbare Karte wird selbst ausgeblendet, sonst stuende dort sein
    // Platzhalter (contain-intrinsic-size) als leere Flaeche.
    var hidden = [];
    for (var h = 0; h < cards.length; h++) if (cards[h].el.hidden) hidden.push(cards[h].el);
    for (var g = 0; g < groups.length; g++) {
      var want = [];
      for (var k = g * GRP; k < Math.min(vis.length, (g + 1) * GRP); k++) want.push(vis[k].el);
      var n = want.length;
      if (g === groups.length - 1) want = want.concat(hidden);
      var grp = groups[g];
      if (!same(grp, want)) {
        var frag = document.createDocumentFragment();
        for (var w = 0; w < want.length; w++) frag.appendChild(want[w]);
        grp.appendChild(frag);
      }
      grp.hidden = n === 0;
      grp.__n = n;
    }
  }

  // Platzhalterhoehe der Bloecke, die noch nie im Bild waren. Ohne gute
  // Schaetzung stimmt die Gesamthoehe der Liste (und damit der
  // Fortschrittsbalken) erst, wenn jeder Block einmal gerendert wurde.
  // Ausgangspunkt ist der Median eines Blocks je Spaltenzahl (PRIOR, an der
  // Seite ohne Bloecke gemessen, 15.10.2026, 390-1920 px); jeder echt
  // gerenderte volle Block verschiebt den Wert zu seinem Mittel hin. Nicht
  // einfach der erste Block: oben stehen die Missionen mit den meisten
  // Varianten, ihre Karten sind hoeher — der erste Block liegt 13-20 % ueber
  // dem Median, die Liste waere um so viel zu lang geschaetzt. Darum zaehlt
  // der Median wie PRIOR_N Messungen. Ein Block im Platzhalterzustand meldet
  // nur den Platzhalterwert — gemessen wird nur, wenn seine erste Karte
  // wirklich gerendert ist (checkVisibility). Neue Spaltenzahl macht alte
  // Messungen wertlos: dann von vorn. Gelesen wird nur im
  // ResizeObserver-Rueckruf, also nach dem Layout — kein erzwungenes Layout.
  // Browser ohne checkVisibility behalten den Schaetzwert aus dem CSS.
  var PRIOR = [0, 17500, 8900, 6050, 4820, 3900, 3250];
  var PRIOR_N = 3;
  if (groups.length > 1 && window.ResizeObserver && grid.checkVisibility) {
    var est = 0, seen = [], seenCols = 0;
    var ro = new ResizeObserver(function (es) {
      var cols = (getComputedStyle(grid).gridTemplateColumns || '').split(' ').length || 1;
      if (cols !== seenCols) { seen = []; seenCols = cols; }
      for (var i = 0; i < es.length; i++) {
        var t = es[i].target, first = t.firstElementChild;
        var at = seen.indexOf(t);
        if (t.hidden || t.__n !== GRP || !first) {
          // Nach dem Filtern kein voller Block mehr: zaehlt nicht mehr mit.
          if (at !== -1) seen.splice(at, 1);
          continue;
        }
        if (!first.checkVisibility({ contentVisibilityAuto: true })) continue;
        var bs = es[i].borderBoxSize && es[i].borderBoxSize[0];
        var hh = bs ? bs.blockSize : es[i].contentRect.height;
        if (!(hh > 0)) continue;
        t.__h = hh;
        if (at === -1) seen.push(t);
      }
      var prior = PRIOR[Math.min(cols, PRIOR.length - 1)];
      var sum = prior * PRIOR_N;
      for (var k = 0; k < seen.length; k++) sum += seen[k].__h;
      var val = Math.round(sum / (PRIOR_N + seen.length));
      if (val !== est) {
        est = val;
        grid.style.setProperty('--mc-grp-h', val + 'px');
      }
    });
    for (var gi = 0; gi < groups.length; gi++) ro.observe(groups[gi]);
  }

  // Voller Suchindex (Blueprint-Namen, Orte, Titel-Varianten — nichts davon
  // steht sichtbar auf der Karte): einmal laden, 1 Tag Browser-Cache, per
  // ?v=<DB-Stand> versioniert. Bis dahin trägt der Kartentext die Suche.
  if (CFG.searchUrl) {
    fetch(CFG.searchUrl).then(function (r) { return r.json(); }).then(function (idx) {
      for (var i = 0; i < cards.length; i++) {
        var full = idx[cards[i].slug];
        if (full) cards[i].search = cards[i].search + ' ' + full;
      }
      if ((q.value || '').trim()) apply();
    }).catch(function () {});
  }

  var timer = null;
  function debounced() { clearTimeout(timer); timer = setTimeout(apply, 110); }

  var SELECTS = [selType, selGiver, selFaction, selLoc, selGuild, selBp, selLegal, selSort].filter(Boolean);
  q.addEventListener('input', debounced);
  SELECTS.forEach(function (s) { s.addEventListener('change', apply); });
  if (reset) {
    reset.addEventListener('click', function () {
      q.value = '';
      SELECTS.forEach(function (s) { if (s !== selSort) s.value = ''; });
      selSort.value = 'count';
      apply();
    });
  }

  // Deeplink: /missionen.html?type=bounty&q=hurston
  (function fromUrl() {
    var p = new URLSearchParams(location.search);
    var map = { q: q, type: selType, giver: selGiver, faction: selFaction, loc: selLoc,
      guild: selGuild, bp: selBp, legal: selLegal, sort: selSort };
    var any = false;
    for (var k in map) {
      var v = p.get(k);
      if (v == null || !map[k]) continue;
      // Nur setzen, wenn das Select den Wert wirklich kennt — sonst leert der
      // Browser die Auswahl und alles waere gefiltert.
      if (map[k].tagName === 'SELECT' && !map[k].querySelector('option[value="' + CSS.escape(v) + '"]')) continue;
      map[k].value = v;
      any = true;
    }
    if (any && bar.scrollIntoView) bar.scrollIntoView({ block: 'start' });
  })();

  // ---- Filter-Schublade (nur schmal/flach; siehe MissionsApp.astro) ----
  // assets/offcanvas.js bringt Esc, Klick auf den Verdunkler und das
  // Wisch-Schliessen mit; das Auf- und Zuklappen selbst macht die App —
  // genauso wie assets/crafting-app.js es fuer .cdb-sidebar tut.
  (function drawer() {
    var panel = document.getElementById('mx-bar');
    var toggle = document.getElementById('mx-filter-toggle');
    if (!panel || !toggle) return;
    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var zu = document.getElementById('mx-filter-close');
    if (zu) zu.addEventListener('click', function () {
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  })();

  apply();
})();
