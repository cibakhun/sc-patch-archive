/* ============================================================================
   VerseBase — PATCH ARCHIVE  (assets/archive.js)

   Five independent behaviours, each guarded so a missing node never takes the
   rest of the page down:
     1. era morph      — scroll position drives --era/--era-2 + the "you are
                         here" readout + the ribbon band highlight
     2. spine draw     — one class per entry; the rail and card reveal are CSS
     3. counters       — the masthead stats count up once
     4. filter         — live text + type filtering over spine and topic index
     5. chrome         — sticky offset measurement and back-to-top

   No scroll listeners for the drawing work: IntersectionObserver does it, which
   keeps the timeline smooth on long pages.
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
    // px, not rem: the site's root font-size is 112.5%, so a rem conversion here
    // would silently add ~15px of dead space under the bar.
    root.style.setProperty('--stick', topbar.offsetHeight + 8 + 'px');
  }
  stick();
  addEventListener('resize', stick, { passive: true });

  /* ── 2. Era morph ──────────────────────────────────────────────────────── */
  var eras = $$('.era');
  var eraNow = $('#eraNow');
  var bands = $$('.ribbon__band');
  var setDustColor = null; // wired by the canvas below, if it runs
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
    bands.forEach(function (b, k) {
      b.classList.toggle('is-now', k === i);
    });
    if (setDustColor) setDustColor(c);
  }

  // Which chapter owns the screen: the one containing the viewport's midline —
  // the same rule the reader's eye uses. Computed from geometry rather than
  // from whichever observer entry happened to be last in the batch, because at
  // a chapter boundary two blocks straddle the trigger band and callback order
  // is not document order (that mismatch showed up as the readout naming the
  // previous era while the page had already recoloured for the next one).
  function pickEra() {
    var mid = innerHeight / 2;
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < eras.length; i++) {
      // A chapter filtered out of view has a zero-height rect at the origin and
      // would otherwise look like the closest match to everything.
      if (eras[i].hidden) continue;
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
    // The observer is only a trigger: between a chapter crossing the band and
    // the next crossing, the answer cannot change, so this stays far cheaper
    // than a scroll handler.
    var eraIO = new IntersectionObserver(pickEra, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    eras.forEach(function (el) {
      eraIO.observe(el);
    });
  }

  /* ── 3. Spine draw + generic reveals ───────────────────────────────────── */
  var ents = $$('.ent');
  if (ents.length) {
    if (reduce) {
      ents.forEach(function (el) {
        el.classList.add('lit');
      });
    } else {
      var entIO = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            e.target.classList.add('lit');
            entIO.unobserve(e.target);
          });
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
      );
      ents.forEach(function (el) {
        entIO.observe(el);
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
    { threshold: 0.12 }
  );
  $$('.reveal').forEach(function (el) {
    revealIO.observe(el);
  });

  /* ── 4. Counters ───────────────────────────────────────────────────────── */
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

  /* ── 5. Filter ─────────────────────────────────────────────────────────── */
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
  var cache = ents.map(function (el) {
    var name = $('.card__name a', el);
    var ver = $('.card__ver', el);
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
      el.hidden = !$$('.ent', el).some(function (e) {
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

    // Filtering reflows the whole spine, so the chapter under the midline has
    // almost certainly changed — the observer won't fire for a layout shift.
    if (eras.length) pickEra();
  }

  if (q) {
    q.addEventListener('input', applyFilter);
    // Esc clears while the field has focus — expected of a search box.
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

  /* ── 6. Back to top ────────────────────────────────────────────────────── */
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

  /* ── 7. Ambient dust ───────────────────────────────────────────────────── */
  var cv = $('#dust');
  if (cv && !reduce) {
    var ctx = cv.getContext('2d');
    var w = 0;
    var h = 0;
    var dpr = 1;
    var motes = [];
    var tint = { r: 255, g: 90, b: 31 };
    var running = true;

    setDustColor = function (hex) {
      var m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
      if (!m) return;
      var n = parseInt(m[1], 16);
      tint = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };
    if (eras[0]) setDustColor(eras[0].dataset.accent);

    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.width = Math.floor(innerWidth * dpr);
      h = cv.height = Math.floor(innerHeight * dpr);
      cv.style.width = innerWidth + 'px';
      cv.style.height = innerHeight + 'px';
      // Density scales with area so a phone doesn't pay for a desktop's count.
      var n = Math.min(110, Math.round((innerWidth * innerHeight) / 14000));
      motes = [];
      for (var i = 0; i < n; i++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: (Math.random() * 1.5 + 0.35) * dpr,
          vx: (Math.random() - 0.5) * 0.11 * dpr,
          vy: -(Math.random() * 0.14 + 0.03) * dpr,
          a: Math.random() * 6.28,
          sp: Math.random() * 0.012 + 0.004,
          // A third of the field takes the era tint; the rest stays starlight,
          // so the morph reads as a shift in mood, not a colour filter.
          hot: Math.random() < 0.34,
        });
      }
    }

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.x += m.vx;
        m.y += m.vy;
        m.a += m.sp;
        if (m.y < -4) {
          m.y = h + 4;
          m.x = Math.random() * w;
        }
        if (m.x < -4) m.x = w + 4;
        else if (m.x > w + 4) m.x = -4;
        var o = 0.16 + Math.abs(Math.sin(m.a)) * 0.5;
        ctx.globalAlpha = o;
        ctx.fillStyle = m.hot ? 'rgb(' + tint.r + ',' + tint.g + ',' + tint.b + ')' : '#9fb0d0';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, 6.284);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }

    size();
    addEventListener('resize', size, { passive: true });
    // Stop burning frames on a tab nobody is looking at.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    });
    frame();
  }
})();
