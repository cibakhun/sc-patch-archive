/* ============================================================================
   VerseBase — PATCH ARCHIVE  ·  "Stellar Cartography"  (assets/archive.js)

   Independent behaviours, each guarded so a missing node never takes the rest
   of the page down:
     1. sticky offset  — measure the fixed SiteNav so the control bar clears it
     2. era morph      — scroll position drives --era/--era-2 + the "you are
                         here" readout + the ribbon band + the starfield tint
     3. spine draw     — one class per node; the rail charge + card reveal are CSS
     4. reveals        — section heads fade up once
     5. counters       — the telemetry numerals count up once
     6. filter         — live text + type filtering over the flight path + index
     7. back-to-top    — appears past one viewport
     8. starfield      — a parallax, twinkling, era-tinted canvas backdrop

   No scroll listeners drive the drawing work — IntersectionObserver does, which
   keeps the timeline smooth on long pages. The starfield reads scrollY inside
   its own rAF (a cheap property read, never a forced layout).
   ========================================================================== */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var $ = function (s, c) {
    return (c || document).querySelector(s);
  };
  var $$ = function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };

  /* ── 1. Sticky offset ────────────────────────────────────────────────────
     The control bar has to clear the fixed SiteNav, whose height differs
     between the compact and wide layouts. Measure instead of guessing. */
  var topbar = $('#topbar');
  function stick() {
    if (!topbar) return;
    // px, not rem: the root font-size is 112.5%, so a rem conversion here would
    // silently add ~15px of dead space under the bar.
    root.style.setProperty('--stick', topbar.offsetHeight + 8 + 'px');
  }
  stick();
  addEventListener('resize', stick, { passive: true });

  /* ── 2. Era morph ──────────────────────────────────────────────────────── */
  var eras = $$('.era');
  var eraNow = $('#eraNow');
  var bands = $$('.ribbon__band');
  var setStarTint = null; // wired by the starfield below, if it runs
  var activeEra = -1;

  function applyEra(i) {
    if (i === activeEra) return;
    activeEra = i;
    var el = eras[i];
    if (!el) return;
    var c = el.dataset.accent;
    var c2 = el.dataset.accent2 || c;
    root.style.setProperty('--era', c);
    root.style.setProperty('--era-2', c2);
    if (eraNow) eraNow.textContent = el.dataset.label || '';
    // Pair by chapter, never by index: the flight path reads newest-first while
    // the ribbon plots oldest-left, so eras[i] and bands[i] are opposite ends of
    // the voyage.
    var chapter = el.dataset.chapter;
    bands.forEach(function (b) {
      b.classList.toggle('is-now', b.dataset.chapter === chapter);
    });
    if (setStarTint) setStarTint(c);
  }

  // Which chapter owns the screen: the one containing the viewport's midline —
  // the rule the reader's eye uses. Computed from geometry rather than from
  // whichever observer entry happened to be last in the batch, because at a
  // chapter boundary two blocks straddle the trigger band and callback order is
  // not document order.
  function pickEra() {
    var mid = innerHeight / 2;
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < eras.length; i++) {
      if (eras[i].hidden) continue; // a filtered-out chapter has a zero rect at origin
      var r = eras[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) {
        best = i;
        break;
      }
      var d = r.top > mid ? r.top - mid : mid - r.bottom;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    applyEra(best);
  }

  if (eras.length) {
    pickEra();
    var eraIO = new IntersectionObserver(pickEra, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    eras.forEach(function (el) {
      eraIO.observe(el);
    });
  }

  /* ── 3. Spine draw + 4. generic reveals ─────────────────────────────────── */
  var nodes = $$('.node');
  if (nodes.length) {
    if (reduce) {
      nodes.forEach(function (el) {
        el.classList.add('lit');
      });
    } else {
      var nodeIO = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            e.target.classList.add('lit');
            nodeIO.unobserve(e.target);
          });
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0 }
      );
      nodes.forEach(function (el) {
        nodeIO.observe(el);
      });
    }
  }

  var revealIO = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        revealIO.unobserve(e.target);
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0 }
  );
  $$('.reveal').forEach(function (el) {
    revealIO.observe(el);
  });

  /* ── 5. Counters ───────────────────────────────────────────────────────── */
  $$('.count[data-to]').forEach(function (el) {
    var to = parseFloat(el.getAttribute('data-to')) || 0;
    if (reduce) {
      el.textContent = String(to);
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var dur = 1100;
        var t0 = 0;
        requestAnimationFrame(function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        });
      },
      { threshold: 0.6 }
    );
    io.observe(el);
  });

  /* ── 6. Filter ─────────────────────────────────────────────────────────── */
  var q = $('#q');
  var clearBtn = $('#qx');
  var countOut = $('#count');
  var empty = $('#empty');
  var chips = $$('.chipbtn');
  var trows = $$('.trow');
  var tgroups = $$('.tgroup');
  var countTpl = countOut ? countOut.getAttribute('data-tpl') || '%n% / %t%' : '';
  var type = 'all';

  function esc(s) {
    return s.replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }
  // Highlight every occurrence of the query. Text comes from our own build, but
  // it is escaped anyway — the <mark> is the only markup we inject.
  function hl(text, needle) {
    if (!needle) return esc(text);
    var out = '';
    var low = text.toLowerCase();
    var i = 0;
    var at;
    while ((at = low.indexOf(needle, i)) !== -1) {
      out += esc(text.slice(i, at)) + '<mark>' + esc(text.slice(at, at + needle.length)) + '</mark>';
      i = at + needle.length;
    }
    return out + esc(text.slice(i));
  }

  // Cache the original strings once so repeated filtering never re-parses
  // already-highlighted markup.
  var cache = nodes.map(function (el) {
    var name = $('.node__name a', el);
    var ver = $('.node__ver', el);
    return {
      el: el,
      hay: el.getAttribute('data-search') || '',
      kind: el.getAttribute('data-type') || '',
      name: name,
      nameText: name ? name.textContent : '',
      ver: ver,
      verText: ver ? ver.textContent : '',
    };
  });

  function applyFilter() {
    var needle = (q ? q.value : '').trim().toLowerCase();
    var shown = 0;

    cache.forEach(function (c) {
      var ok = (type === 'all' || c.kind === type) && (!needle || c.hay.indexOf(needle) !== -1);
      c.el.hidden = !ok;
      if (ok) shown++;
      if (c.name) c.name.innerHTML = hl(c.nameText, needle);
      if (c.ver) c.ver.innerHTML = hl(c.verText, needle);
    });

    // An era chapter with nothing left in it would leave a dangling heading.
    eras.forEach(function (el) {
      el.hidden = !$$('.node', el).some(function (e) {
        return !e.hidden;
      });
    });

    // The topic index answers the same query — a search for "mining" should
    // surface the deep dive as readily as the patch.
    trows.forEach(function (r) {
      r.hidden = !!needle && (r.getAttribute('data-search') || '').indexOf(needle) === -1;
    });
    tgroups.forEach(function (g) {
      g.hidden = !$$('.trow', g).some(function (r) {
        return !r.hidden;
      });
    });

    if (countOut) countOut.textContent = countTpl.replace('%n%', shown).replace('%t%', cache.length);
    if (empty) empty.classList.toggle('on', shown === 0);
    if (clearBtn) clearBtn.hidden = !needle;

    // Filtering reflows the whole flight path, so the chapter under the midline
    // has almost certainly changed — the observer won't fire for a layout shift.
    if (eras.length) pickEra();
  }

  if (q) {
    q.addEventListener('input', applyFilter);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && q.value) {
        e.stopPropagation();
        q.value = '';
        applyFilter();
      }
    });
  }
  if (clearBtn)
    clearBtn.addEventListener('click', function () {
      if (q) {
        q.value = '';
        q.focus();
      }
      applyFilter();
    });
  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      type = b.getAttribute('data-type') || 'all';
      chips.forEach(function (o) {
        o.setAttribute('aria-pressed', String(o === b));
      });
      applyFilter();
    });
  });
  var resetBtn = $('#reset');
  if (resetBtn)
    resetBtn.addEventListener('click', function () {
      if (q) q.value = '';
      type = 'all';
      chips.forEach(function (o) {
        o.setAttribute('aria-pressed', String(o.getAttribute('data-type') === 'all'));
      });
      applyFilter();
      if (q) q.focus();
    });

  // Jumping from the ribbon to a patch the filter is hiding would scroll to
  // nothing — drop the filter first, then let the anchor do its work.
  $$('.ribbon__tick').forEach(function (a) {
    a.addEventListener('click', function () {
      var id = a.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (target && target.hidden && resetBtn) resetBtn.click();
    });
  });

  /* ── 7. Back to top ────────────────────────────────────────────────────── */
  var top = $('#totop');
  if (top) {
    var ticking = false;
    addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          top.classList.toggle('on', scrollY > innerHeight);
          ticking = false;
        });
      },
      { passive: true }
    );
    top.addEventListener('click', function (e) {
      e.preventDefault();
      scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ── 8. Starfield ──────────────────────────────────────────────────────────
     Three depth layers of twinkling stars over the void. Nearer layers are
     bigger, brighter and parallax more with scroll. A third of the field takes
     the era tint, so the morph reads as a shift in mood, not a colour wash. */
  var cv = $('#stars');
  if (cv && cv.getContext) {
    var ctx = cv.getContext('2d');
    var w = 0;
    var h = 0;
    var dpr = 1;
    var stars = [];
    var tint = { r: 255, g: 90, b: 31 };
    var running = false;

    // FX-Gatter (Partikel-Ambiente): fxOn() liest die vorab in <head> gesetzte
    // data-fx-Flagge (Layout.astro), analog zu assets/detail.js.
    function fxOn() {
      return document.documentElement.getAttribute('data-fx') === 'on';
    }

    setStarTint = function (hex) {
      var m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
      if (!m) return;
      var n = parseInt(m[1], 16);
      tint = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };
    if (eras[0]) setStarTint(eras[0].dataset.accent);

    function build() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.width = Math.floor(innerWidth * dpr);
      h = cv.height = Math.floor(innerHeight * dpr);
      cv.style.width = innerWidth + 'px';
      cv.style.height = innerHeight + 'px';
      // Density scales with area so a phone doesn't pay for a desktop's count.
      var n = Math.min(260, Math.round((innerWidth * innerHeight) / 8200));
      stars = [];
      for (var i = 0; i < n; i++) {
        var depth = Math.random(); // 0 = far, 1 = near
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: depth,
          r: (0.4 + depth * 1.7) * dpr,
          // slow autonomous drift, faster for nearer stars
          vy: (0.02 + depth * 0.06) * dpr,
          vx: (Math.random() - 0.5) * 0.03 * dpr,
          tw: Math.random() * 6.28,
          tws: Math.random() * 0.02 + 0.006,
          hot: Math.random() < 0.32,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var scroll = (scrollY || 0) * dpr;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.tw += s.tws;
        s.y += s.vy;
        s.x += s.vx;
        // wrap the autonomous drift
        if (s.y > h + 4) { s.y = -4; s.x = Math.random() * w; }
        if (s.x < -4) s.x = w + 4;
        else if (s.x > w + 4) s.x = -4;
        // scroll parallax: nearer layers shift more. mod keeps the field infinite.
        var py = s.y - scroll * (0.04 + s.z * 0.22);
        py = ((py % h) + h) % h;
        var a = (0.25 + s.z * 0.45) * (0.55 + 0.45 * Math.sin(s.tw));
        ctx.globalAlpha = a;
        if (s.hot) {
          ctx.fillStyle = 'rgb(' + tint.r + ',' + tint.g + ',' + tint.b + ')';
        } else {
          ctx.fillStyle = s.z > 0.7 ? '#dce8ff' : '#9fb4dc';
        }
        ctx.beginPath();
        ctx.arc(s.x, py, s.r, 0, 6.284);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function frame() {
      if (!running) return;
      draw();
      requestAnimationFrame(frame);
    }

    build();
    addEventListener('resize', build, { passive: true });

    if (reduce) {
      draw(); // a single static field, no animation loop
    } else {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          running = false;
        } else if (!running && fxOn()) {
          running = true;
          requestAnimationFrame(frame);
        }
      });
      document.addEventListener('vbfxchange', function (e) {
        if (!e.detail.on) {
          running = false;
        } else if (!running && !document.hidden) {
          running = true;
          requestAnimationFrame(frame);
        }
      });
      if (fxOn()) {
        running = true;
        frame();
      }
    }
  }
})();
