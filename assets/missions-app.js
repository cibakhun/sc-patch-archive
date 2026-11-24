/* Missions-Browser — Filtern/Sortieren der serverseitig gerenderten Karten.
   Kein Fetch: die Daten stecken schon als data-Attribute im DOM (wie schiffe.astro).
   Vanilla, kein Framework, laeuft ohne Buildschritt. */
(function () {
  'use strict';
  var CFG = window.__MX || {};
  var T = CFG.t || {};
  // Zahlen im Format der Seite: „1366 Treffer" stand neben „3.852" im Kopf.
  var NF = CFG.lang === 'de' ? 'de-DE' : 'en-US';
  var fmt = function (n) { return n.toLocaleString(NF); };

  var grid = document.getElementById('mx-grid');
  var bar = document.getElementById('mx-bar');
  if (!grid || !bar) return;
  // Die Filterleiste ist ein <form role="search">: Enter im Suchfeld laedt
  // die Seite nicht neu. Stand frueher als onsubmit-Attribut am <form>;
  // Inline-Handler laesst die Content-Security-Policy nicht mehr zu.
  bar.addEventListener('submit', function (e) { e.preventDefault(); });

  var q = document.getElementById('mx-q');
  var selType = document.getElementById('mx-type');
  // Eine Auswahl „Für wen" mit Wert „giver:…", „faction:…" oder „guild:…".
  var selFor = document.getElementById('mx-for');
  var selLoc = document.getElementById('mx-loc');
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
  var more = document.getElementById('mx-more');

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

  // halten: nur der Suchindex kam nach, der Treffer nie wegnimmt (er
  // ergaenzt Suchtext). Dann bleiben freigegebene Karten und Rollposition;
  // jede echte Filter- oder Sortieraenderung beginnt wieder bei GRP Karten.
  // Gibt zurueck, ob es eine solche Aenderung war (Stand wie zuletzt, etwa
  // dieselbe Suche noch einmal, zaehlt nicht).
  var zuletzt = null;
  function apply(halten) {
    halten = halten === true;
    var toks = (q.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    var vFor = selFor ? selFor.value : '';
    var kFor = vFor.slice(0, vFor.indexOf(':')), idFor = vFor.slice(vFor.indexOf(':') + 1);
    var vType = selType.value, vLoc = selLoc.value, vLegal = selLegal.value;
    var vGiver = kFor === 'giver' ? idFor : '', vFaction = kFor === 'faction' ? idFor : '';
    var vGuild = kFor === 'guild' ? idFor : '';
    var vBp = selBp ? selBp.value : '';
    var stand = [toks.join(' '), vFor, vType, vLoc, vLegal, vBp, selSort.value].join('\u0001');
    var neu = !halten && stand !== zuletzt;
    // Nur echte Durchgaenge merken: kommt der Index waehrend der Verzoegerung
    // einer neuen Eingabe, filtert apply(true) schon mit ihr, der folgende
    // Durchgang aus debounced() muss sie aber noch als Aenderung erkennen.
    if (!halten) zuletzt = stand;
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
    var txt = fmt(n) + ' ' + (T.results || 'results');
    if (out) out.textContent = txt;
    if (outM) outM.textContent = txt;
    if (none) none.hidden = n !== 0;
    if (halten) {
      // Umsortieren unter dem Leser: die Scroll-Verankerung des Browsers
      // folgte sonst einer umgehaengten Karte, die Seite sprang (gemessen
      // rund 5.000 px). Fuer diesen einen Durchgang aus, Stelle bleibt.
      var root = document.documentElement, y = window.scrollY;
      root.style.overflowAnchor = 'none';
      sort();
      window.scrollTo(0, y);
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.style.overflowAnchor = ''; }); });
    } else if (neu) {
      limit = GRP;
      sort();
      zumAnfang();
    }
    // Gleicher Stand wie zuletzt: Treffer und Reihenfolge sind dieselben,
    // es gibt nichts umzustellen (und keine Stelle anzufassen).
    toUrl();
    return neu;
  }

  // Wer tief in der Liste filtert, sah danach Leere oder die Mitte der neuen
  // Treffer: die Liste schrumpft unter ihm weg. Steht die Seite schon unter
  // dem Rasteranfang, rollt sie zurueck dorthin, die Leiste darueber.
  var nachZu = false;
  function zumAnfang() {
    var cs = getComputedStyle(bar);
    // Schublade (schmal/flach): die Seite ist gesperrt, gerollt wird erst
    // nach dem Schliessen (siehe drawer()).
    if (bar.classList.contains('is-open') && cs.position === 'fixed') { nachZu = true; return; }
    if (cs.position !== 'sticky') return;
    var unten = (parseFloat(cs.top) || 0) + bar.offsetHeight + (parseFloat(cs.marginBottom) || 0);
    var ziel = grid.getBoundingClientRect().top + window.scrollY - unten;
    if (window.scrollY > ziel + 1) window.scrollTo(0, Math.max(0, ziel));
  }

  // Filter und Sortierung in die Adresse (UX-Audit F4): die Seite las
  // ?type= & Co. schon immer, schrieb aber nichts — Neuladen oder Teilen
  // verlor die Auswahl. replaceState, damit jede Taste keinen Verlaufseintrag
  // erzeugt. Die Schluessel sind dieselben, die die Missionsblaetter verlinken.
  function toUrl() {
    if (!window.history || !history.replaceState) return;
    // Fremde Parameter (etwa aus einem geteilten Link) bleiben stehen;
    // ersetzt werden nur die eigenen Schluessel.
    var p = new URLSearchParams(location.search);
    ['q', 'type', 'giver', 'faction', 'guild', 'loc', 'bp', 'legal', 'sort'].forEach(function (k) { p.delete(k); });
    var v = (q.value || '').trim();
    if (v) p.set('q', v);
    if (selType.value) p.set('type', selType.value);
    if (selFor && selFor.value) { var i = selFor.value.indexOf(':'); p.set(selFor.value.slice(0, i), selFor.value.slice(i + 1)); }
    if (selLoc.value) p.set('loc', selLoc.value);
    if (selBp && selBp.value) p.set('bp', selBp.value);
    if (selLegal.value) p.set('legal', selLegal.value);
    if (selSort.value && selSort.value !== 'count') p.set('sort', selSort.value);
    var qs = p.toString();
    var url = location.pathname + (qs ? '?' + qs : '') + location.hash;
    if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', url);
  }

  function sort() {
    var mode = selSort.value;
    var vis = cards.filter(function (c) { return !c.el.hidden; });
    // Feste Sortierregel 'en', wie beim Bauen (MissionsApp.astro): mit der
    // Sprache des Browsers lagen gleichrangige Karten sonst anders.
    var byName = function (a, b) { return a.name.localeCompare(b.name, 'en'); };
    vis.sort(function (a, b) {
      if (mode === 'name') return byName(a, b);
      if (mode === 'reward') return (b.reward - a.reward) || byName(a, b);
      return (b.count - a.count) || byName(a, b);
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

  // Eine Bildlaufebene (UX-Audit F6, Heuristik P11): die Liste laeuft im
  // Seitenfluss, auch am Schreibtisch — der fruehere eigene Kasten (607 px
  // fuer 139.552 px Karten) liess das Mausrad zwischen Kasten und Seite
  // springen. Sie zeigt je einen Block zu GRP Karten; „Weitere anzeigen"
  // gibt den naechsten frei. Filter und Sortierung setzen die Grenze zurueck.
  var limit = GRP;
  function place(vis) {
    var all = vis.length;
    // Karten hinter der Grenze: gefiltert sind sie nicht (hidden bleibt der
    // Filterzustand), sie warten nur — data-spaeter blendet sie aus.
    var later = [];
    if (more && all > limit) { later = vis.slice(limit); vis = vis.slice(0, limit); }
    for (var a = 0; a < vis.length; a++) if (vis[a].el.hasAttribute('data-spaeter')) vis[a].el.removeAttribute('data-spaeter');
    for (var b = 0; b < later.length; b++) later[b].el.setAttribute('data-spaeter', '');
    if (more) {
      var rest = all - vis.length;
      more.hidden = rest <= 0;
      if (rest > 0) {
        more.textContent = (T.more || 'Show %n% more').replace('%n%', fmt(Math.min(GRP, rest)));
        var sm = document.createElement('small');
        sm.textContent = (T.shown || '%a% of %b%').replace('%a%', fmt(vis.length)).replace('%b%', fmt(all));
        more.appendChild(sm);
      }
    }
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
    for (var l = 0; l < later.length; l++) hidden.push(later[l].el);
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
    var est = 0, seen = [], seenKey = '';
    var ro = new ResizeObserver(function (es) {
      var cols = (getComputedStyle(grid).gridTemplateColumns || '').split(' ').length || 1;
      // Spaltenzahl UND Breite: bei gleicher Spaltenzahl aendert eine andere
      // Kartenbreite die Umbrueche und damit die Blockhoehe.
      var key = cols + ':' + grid.clientWidth;
      if (key !== seenKey) { seen = []; seenKey = key; }
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
      if ((q.value || '').trim()) apply(true);
    }).catch(function () {});
  }

  var timer = null;
  function debounced() { clearTimeout(timer); timer = setTimeout(function () { timer = null; apply(); }, 110); }

  var SELECTS = [selType, selFor, selLoc, selBp, selLegal, selSort].filter(Boolean);
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
  if (more) more.addEventListener('click', function () { limit += GRP; sort(); });

  // Deeplink: /missionen.html?type=bounty&q=hurston
  (function fromUrl() {
    var p = new URLSearchParams(location.search);
    var map = { q: q, type: selType, loc: selLoc, bp: selBp, legal: selLegal, sort: selSort };
    var any = false;
    // ?giver= / ?faction= / ?guild= landen in der einen Auswahl „Für wen".
    // Erzeugt wird immer nur einer (Missionsblaetter, toUrl); steht von Hand
    // mehr als einer da, gilt der letzte gueltige in dieser Reihenfolge.
    ['giver', 'faction', 'guild'].forEach(function (kind) {
      var v = p.get(kind);
      if (v == null || !selFor) return;
      var val = kind + ':' + v;
      if (!selFor.querySelector('option[value="' + CSS.escape(val) + '"]')) return;
      selFor.value = val;
      any = true;
    });
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

  // Klebende Leiste weicht aus (UX-Audit F6): am Schreibtisch ist sie zwei
  // Zeilen hoch und laege im Seitenfluss mit der Kopfleiste auf rund einem
  // Viertel der Karten. Beim Rollen nach unten faehrt sie hoch, beim Rollen
  // nach oben kommt sie zurueck; ueber dem Raster bleibt sie stehen. Nur
  // solange sie klebt — schmal oder flach ist sie Schublade.
  (function leisteWeicht() {
    var lastY = window.scrollY, tick = false;
    var pruefe = function () {
      tick = false;
      var y = window.scrollY, d = y - lastY;
      if (Math.abs(d) < 8) return;
      lastY = y;
      var cs = getComputedStyle(bar);
      if (cs.position !== 'sticky') { bar.classList.remove('is-weg'); return; }
      // Liegt die Leiste schon ueber Karten? Gemessen am Raster, das sich
      // nicht mitverschiebt (die Leiste selbst traegt beim Ausweichen ein
      // transform, ihr Rechteck taugt dann nicht).
      var unten = (parseFloat(cs.top) || 0) + bar.offsetHeight + (parseFloat(cs.marginBottom) || 0);
      var ueber = grid.getBoundingClientRect().top < unten - 1;
      bar.classList.toggle('is-weg', ueber && d > 0);
    };
    window.addEventListener('scroll', function () {
      if (!tick) { tick = true; requestAnimationFrame(pruefe); }
    }, { passive: true });
  })();

  // ---- Filter-Schublade (nur schmal/flach; siehe MissionsApp.astro) ----
  // assets/offcanvas.js bringt Esc, Klick auf den Verdunkler und das
  // Wisch-Schliessen mit; das Auf- und Zuklappen selbst macht die App —
  // genauso wie assets/crafting-app.js es fuer .cdb-sidebar tut.
  (function drawer() {
    var panel = document.getElementById('mx-bar');
    var toggle = document.getElementById('mx-filter-toggle');
    if (!panel || !toggle) return;
    var yOffen = 0;
    toggle.addEventListener('click', function () {
      if (!panel.classList.contains('is-open')) yOffen = window.scrollY;
      var open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var zu = document.getElementById('mx-filter-close');
    if (zu) zu.addEventListener('click', function () {
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
    // Wer tief in der Liste die Filter aendert, stand nach dem Schliessen
    // an derselben Stelle, die neuen Treffer begannen weit oben. Jeder Weg
    // zu (✕, Esc, Verdunkler, Wischen) nimmt is-open weg; gerollt wird
    // danach, wenn offcanvas.js die Seite entsperrt und die alte Stelle
    // angefordert hat. Verglichen wird mit der Stelle beim Oeffnen (yOffen):
    // scrollY liest am Telefon direkt nach dem Entsperren noch 0. Ziel ist
    // die Zeile mit Filterknopf und Trefferzahl, auf der dann der Fokus steht.
    // Eine Suche, die beim Schliessen noch in der Verzoegerung von
    // debounced() steckt, laeuft hier mit: sonst kaeme apply() erst nach dem
    // Schliessen, und zumAnfang() saehe keine offene Schublade mehr. Sie
    // laeuft nach der Standardaktion der Taste (Esc leert ein Suchfeld), also
    // mit dem Wert, der danach im Feld steht. Nur der Wechsel offen -> zu
    // zaehlt; am Schreibtisch wechselt auf demselben Element is-weg.
    if (!window.MutationObserver) return;
    var kopf = document.querySelector('.mx__mbar') || grid;
    var oben = function (el) { var y = 0; for (; el; el = el.offsetParent) y += el.offsetTop; return y; };
    var warOffen = false;
    new MutationObserver(function () {
      var offen = panel.classList.contains('is-open');
      if (offen === warOffen) return;
      warOffen = offen;
      if (offen) return;
      var offeneSuche = !!timer;
      if (timer) { clearTimeout(timer); timer = null; }
      setTimeout(function () {
        if (offeneSuche && apply()) nachZu = true;
        if (!nachZu) return;
        nachZu = false;
        var nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
        var ziel = Math.max(0, oben(kopf) - Math.round(nav));
        if (yOffen > ziel + 1) window.scrollTo(0, ziel);
      }, 0);
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  })();

  apply();
})();
