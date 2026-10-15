/* perf.js — Leichtgang fuer schwache Geraete und Ruhe ausserhalb des Bildes.
   Laeuft auf jeder Seite (Layout.astro, defer). Zwei Aufgaben, streng
   getrennt:

   1. FUER ALLE: Endlos-Animationen (Ken-Burns, V-Marken, Marquees, Pulse)
      ruhen, solange ihr Element nicht im Bild ist. Sichtbar aendert sich
      nichts — wer hinsieht, sieht sie laufen. Vorher liefen auf der
      Startseite rund 60 Compositor-Bilder je Sekunde, auch wenn der Hero
      laengst weggescrollt war (gemessen 15.10.2026: GPU im Leerlauf 98,6 %).
      Mechanik: das Element bekommt `data-vb-anim-off`, die Regel dazu steht
      in Layout.astro (animation-play-state: paused). NICHT ueber
      Animation.pause(): danach ignoriert der Browser animation-play-state
      aus dem CSS, und das Anhalten der Laufbaender beim Ueberfahren
      (a11y.css, detail.css) waere tot.

   2. NUR IM LEICHTGANG (html[data-perf="lite"]): alle Endlos-Animationen
      bleiben stehen, egal wo. Endliche Animationen (Einblenden u. ae.)
      laufen weiter — ein angehaltenes Einblenden hiesse unsichtbarer Inhalt.
      Den Schalter setzt das Kopf-Skript in Layout.astro (Save-Data,
      schwache Hardware, ?perf=lite). Hier kommen die beiden Pruefungen dazu,
      die man im Kopf nicht machen kann, ohne jede Seite zu bremsen:
        · Software-WebGL (SwiftShader, llvmpipe …) — ein Grafikkontext
          kostet Zeit, deshalb einmal je Sitzung und im Leerlauf;
        · eine kurze Bildtakt-Messung nach dem Laden: liegt der Median
          ueber 40 ms (unter 25 Bildern/s), schaltet die Seite im Lauf um.
          Nicht 28 ms: Energiesparmodi (Chrome, iOS) deckeln auf 30 Bilder/s,
          Median 33 ms — ein starkes Geraet im Sparmodus behielte sonst
          nicht sein Bild.
      Beides nur, wenn der Besucher nichts erzwungen hat (data-perf-auto).
      Das Ergebnis haelt die Sitzung (sessionStorage), damit die naechste
      Seite schon VOR dem ersten Bild im richtigen Gang steht.

   Ereignis: 'vbperfchange' auf document, detail { lite: true, why }.
   Der Holo-Viewer und hero-video.js hoeren darauf. */
(function () {
  'use strict';
  var d = document.documentElement;
  var ATTR = 'data-vb-anim-off';

  function isLite() { return d.getAttribute('data-perf') === 'lite'; }

  /* ---------- 1. Endlos-Animationen verfolgen ---------- */
  var tracked = [];          // Elemente, die eine Endlos-Animation tragen
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  var offscreen = typeof WeakMap === 'function' ? new WeakMap() : null;

  function paint(el) {
    var off = isLite() || (offscreen && offscreen.get(el) === true);
    if (off) { if (!el.hasAttribute(ATTR)) el.setAttribute(ATTR, ''); }
    else if (el.hasAttribute(ATTR)) el.removeAttribute(ATTR);
  }

  // rootMargin: ein Stueck vor dem Rand wieder anlaufen lassen, damit die
  // Bewegung schon steht, wenn das Element ins Bild kommt.
  var io = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) {
        if (offscreen) offscreen.set(es[i].target, !es[i].isIntersecting);
        paint(es[i].target);
      }
    }, { rootMargin: '200px 0px' })
    : null;

  function track(el) {
    if (!el || el.nodeType !== 1) return;
    if (seen) { if (seen.has(el)) return; seen.add(el); }
    else if (tracked.indexOf(el) !== -1) return;
    tracked.push(el);
    if (io) io.observe(el);
    paint(el);
  }

  function infinite(a) {
    try { return a.effect && a.effect.getTiming().iterations === Infinity; } catch (e) { return false; }
  }

  function scan() {
    if (!document.getAnimations) return;
    var list = document.getAnimations();
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      // Nur CSS-Animationen: Uebergaenge enden von selbst, und die
      // WAAPI-Animationen der Seiten-Skripte steuern sich selbst.
      if (!a.animationName || !infinite(a)) continue;
      track(a.effect.target);
    }
  }

  // Spaeter startende Animationen (Element erst sichtbar geschaltet, Hover
  // vorbei) melden sich ueber animationstart. Dort steht nur der Name; ob
  // sie endlos laeuft, sagt erst die Animation selbst.
  document.addEventListener('animationstart', function (e) {
    var el = e.target;
    if (!el || !el.getAnimations) return;
    var list;
    try { list = el.getAnimations({ subtree: true }); } catch (err) { list = el.getAnimations(); }
    var pseudo = e.pseudoElement || '';
    for (var i = 0; i < list.length; i++) {
      var a = list[i], fx = a.effect;
      if (!fx || fx.target !== el || (fx.pseudoElement || '') !== pseudo) continue;
      if (a.animationName === e.animationName && infinite(a)) { track(el); return; }
    }
  }, true);

  // Endet die Endlos-Animation eines Elements (Klasse gewechselt, Element
  // ausgeblendet), faellt es aus der Liste — sonst hielte das Merkmal eine
  // Einblend-Animation an, die an ihre Stelle tritt, und im Leichtgang
  // bliebe das Element auf deren erstem Bild stehen (womoeglich unsichtbar).
  // Laeuft spaeter wieder eine Endlos-Animation an, meldet animationstart
  // es neu an.
  function untrack(el) {
    var i = tracked.indexOf(el);
    if (i !== -1) tracked.splice(i, 1);
    if (seen) seen.delete(el);
    if (offscreen) offscreen.delete(el);
    if (io) io.unobserve(el);
    if (el.hasAttribute(ATTR)) el.removeAttribute(ATTR);
  }
  document.addEventListener('animationcancel', function (e) {
    var el = e.target;
    if (!el || !el.getAnimations || tracked.indexOf(el) === -1) return;
    var list;
    try { list = el.getAnimations({ subtree: true }); } catch (err) { list = el.getAnimations(); }
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.effect && a.effect.target === el && a.animationName && infinite(a)) return;
    }
    untrack(el);
  }, true);

  function repaintAll() { for (var i = 0; i < tracked.length; i++) paint(tracked[i]); }

  // Erst nach dem naechsten Bild: document.getAnimations() bringt vorher den
  // Stil auf Stand und zog so das Layout der Seite in diese Aufgabe — auf
  // der Patch-Seite wuchs sie mit der Rechnung dafuer von 260 auf 410 ms
  // (Desktop, 4-fache CPU-Drossel). Nach dem Bild ist der Stil sauber, die
  // Abfrage kostet nichts. Was bis dahin anlaeuft, meldet animationstart.
  if (window.requestAnimationFrame) requestAnimationFrame(function () { setTimeout(scan, 0); });
  else setTimeout(scan, 0);

  /* ---------- 2. Leichtgang zur Laufzeit ---------- */
  function store(v) { try { sessionStorage.setItem('vb.perf.auto', v); } catch (e) {} }

  function goLite(why) {
    if (isLite()) return;
    d.setAttribute('data-perf', 'lite');
    d.setAttribute('data-perf-why', why);
    store('lite');
    repaintAll();
    document.dispatchEvent(new CustomEvent('vbperfchange', { detail: { lite: true, why: why } }));
  }

  // Fuer Messwerkzeuge und die Konsole: welcher Gang, und warum.
  window.VBPerf = {
    lite: isLite,
    why: function () { return d.getAttribute('data-perf-why') || (isLite() ? 'forced' : ''); },
  };

  if (!d.hasAttribute('data-perf-auto') || isLite()) return;

  var SOFT = /swiftshader|llvmpipe|softpipe|software|basic render/i;
  function glCheck() {
    var cached = null;
    try { cached = sessionStorage.getItem('vb.perf.gl'); } catch (e) {}
    if (cached) return cached === 'soft';
    var soft = false;
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        var name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
        soft = SOFT.test(name);
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) {}
    try { sessionStorage.setItem('vb.perf.gl', soft ? 'soft' : 'hw'); } catch (e) {}
    return soft;
  }

  // Bildtakt: 40 Bilder, Median der Abstaende. Der Median, nicht der
  // Mittelwert — eine einzelne lange Aufgabe nach dem Laden (JSON parsen,
  // Bild dekodieren) soll ein schnelles Geraet nicht in den Leichtgang
  // druecken. Bei verstecktem Tab misst rAF nichts Brauchbares: dann nicht.
  function probe() {
    if (document.hidden) return;
    var last = 0, gaps = [];
    function step(t) {
      if (document.hidden) return;
      if (last) gaps.push(t - last);
      last = t;
      if (gaps.length < 40) { requestAnimationFrame(step); return; }
      gaps.sort(function (a, b) { return a - b; });
      var med = gaps[gaps.length >> 1];
      if (med > 40) goLite('frames');
      else store('full');
    }
    requestAnimationFrame(step);
  }

  function later(fn, ms) {
    setTimeout(function () {
      if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 2000 });
      else fn();
    }, ms);
  }

  function start() {
    later(function () {
      if (isLite()) return;
      if (glCheck()) { goLite('webgl'); return; }
      var done = null;
      try { done = sessionStorage.getItem('vb.perf.auto'); } catch (e) {}
      if (done !== 'full') probe();
    }, 800);
  }

  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
