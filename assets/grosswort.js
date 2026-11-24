/* Grosswoerter einpassen statt trennen.
   Die Wort-Kacheln (.tile.word b) und die Bandwoerter (.shot .big, .band .big)
   der Patch- und Themenseiten sind Schaubilder aus wenigen Grossbuchstaben.
   Mit der seitenweiten Silbentrennung (Layout.astro) zerfielen sie auf dem
   Handy in „SER- / VER“ oder „CON- / TESTE / D“, am Desktop noch in
   „CONTESTE / D“: das Wort ist breiter als sein Kasten.
   Hier wird stattdessen gemessen: Ist das laengste Wort (an Bindestrichen
   darf weiter umbrochen werden) breiter als der Kasten, wird die Schrift
   so weit verkleinert, dass es in eine Zeile passt, und die Trennung fuer
   dieses Element abgeschaltet. Kleinere Woerter behalten ihre Groesse.
   Ohne Skript bleibt die Silbentrennung als Rueckfall stehen. */
(function () {
  'use strict';
  var SEL = '.tile.word b, .shot .big, .band .big';
  var els = document.querySelectorAll(SEL);
  if (!els.length) return;
  var ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return;

  function teile(text, gross) {
    if (gross) text = text.toUpperCase();
    var out = [];
    text.split(/\s+/).forEach(function (w) {
      if (!w) return;
      // Nach einem Bindestrich darf der Browser umbrechen, ohne zu trennen.
      w.replace(/[-‐–]/g, '$&\n').split('\n').forEach(function (t) {
        if (t) out.push(t);
      });
    });
    return out;
  }

  function messen() {
    var plan = [];
    var i, el;
    for (i = 0; i < els.length; i++) els[i].style.fontSize = '';
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (!el.getClientRects().length) continue;
      var cs = getComputedStyle(el);
      var px = parseFloat(cs.fontSize);
      // Gemessen wird am Kasten des Elternteils: in zentrierten Kacheln ist
      // das Element selbst nur so breit wie sein Inhalt und liefe sonst
      // unbemerkt ueber den Rand.
      var vater = el.parentElement, vs = getComputedStyle(vater);
      var kasten = vater.getBoundingClientRect().width
        - (parseFloat(vs.borderLeftWidth) || 0) - (parseFloat(vs.borderRightWidth) || 0)
        - (parseFloat(vs.paddingLeft) || 0) - (parseFloat(vs.paddingRight) || 0)
        - (parseFloat(cs.marginLeft) || 0) - (parseFloat(cs.marginRight) || 0)
        - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (!px || kasten <= 0) continue;
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + px + 'px ' + cs.fontFamily;
      var abstand = parseFloat(cs.letterSpacing) || 0;
      var rand = 2 * (parseFloat(cs.webkitTextStrokeWidth) || 0);
      var breit = 0;
      teile(el.innerText || el.textContent || '', cs.textTransform === 'uppercase').forEach(function (t) {
        var w = ctx.measureText(t).width + abstand * t.length + rand;
        if (w > breit) breit = w;
      });
      // 3 % Luft: ein Wort, das auf den Zehntelpixel genau passt, bricht der
      // Browser beim Runden trotzdem um (gemessen: DECONPEN 174,72 px im
      // 174,8-px-Kasten bei 1024 px Fensterbreite).
      var luft = kasten * 0.97;
      var ziel = breit > luft ? Math.floor(px * luft / breit * 10) / 10 : 0;
      plan.push([el, ziel]);
    }
    for (i = 0; i < plan.length; i++) {
      el = plan[i][0];
      el.style.webkitHyphens = 'manual';
      el.style.hyphens = 'manual';
      el.style.fontSize = plan[i][1] ? plan[i][1] + 'px' : '';
      if (plan[i][1]) el.setAttribute('data-eingepasst', '');
      else el.removeAttribute('data-eingepasst');
    }
  }

  var wartet = 0;
  function spaeter() {
    if (wartet) return;
    wartet = requestAnimationFrame(function () { wartet = 0; messen(); });
  }

  messen();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(messen);
  addEventListener('load', messen);
  addEventListener('resize', spaeter, { passive: true });
})();
