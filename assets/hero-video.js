// hero-video.js — Ambient-Loop hinter dem Hero (selbst gehostete, stumme
// Trailer-Ausschnitte aus /assets/loops). Eigenständig, da die Patch-Seiten
// detail.js nicht laden. Bedingungen: kein prefers-reduced-motion, kein
// Save-Data, Desktop-Viewport — sonst bleibt das Standbild, nichts lädt nach.
(function () {
  'use strict';
  var hero = document.querySelector('.hero__photo[data-bgvid]');
  if (!hero) return;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;
  if (innerWidth < 1000) return;

  var v = document.createElement('video');
  v.className = 'hero__vid';
  v.muted = true; v.loop = true; v.playsInline = true;
  v.setAttribute('muted', 'muted'); v.setAttribute('playsinline', '');
  v.setAttribute('aria-hidden', 'true'); v.setAttribute('tabindex', '-1');
  v.preload = 'auto';
  // Styles inline, nicht via Stylesheet: die Patch-Seiten laden detail.css
  // nicht — ohne das füllt das Video den Hero nicht (rendert in Eigengröße).
  v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.4s ease';
  if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
  v.addEventListener('canplaythrough', function () {
    v.play().then(function () {
      v.style.opacity = '1';
      hero.classList.add('hero__photo--vid');
      hero.style.animation = 'none'; // Ken-Burns aus, sobald das Video läuft
    }).catch(function () { /* Standbild bleibt */ });
  }, { once: true });
  hero.appendChild(v);
  // Format-Weiche: VP9/WebM ist ~50 % kleiner und läuft in jedem Chromium/
  // Firefox; Safari bekommt das H.264-MP4. Als Blob laden statt streamen:
  // die Dateien sind klein (<1 MB) und nicht jeder Static-Server liefert
  // saubere Range-Responses (astro preview ließ das <video> sonst endlos
  // in networkState LOADING hängen).
  var src = hero.getAttribute('data-bgvid');
  if (v.canPlayType('video/webm; codecs="vp9"')) src = src.replace(/\.mp4$/, '.webm');
  fetch(src)
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); })
    .then(function (b) { v.src = URL.createObjectURL(b); })
    .catch(function () { /* Standbild bleibt */ });

  // Offscreen pausieren (CPU/Akku), beim Zurückscrollen weiterlaufen lassen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) {
        if (es[i].isIntersecting) { v.play().catch(function () {}); } else { v.pause(); }
      }
    }, { threshold: 0.05 }).observe(hero);
  }
})();
