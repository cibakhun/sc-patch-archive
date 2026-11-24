/* Filterfeld der Kategorielisten (/items/category/*.html).
 *
 * Filtert die Zeilen der gezeigten Seite nach Name und Bezugsquelle, ohne
 * Neuladen. Auf Listen mit mehreren Seiten fuehrt ein Link mit derselben
 * Suche in den Item Finder (?q=), der alle Items durchsucht. Ohne Skript
 * bleibt das Feld verborgen und die Liste wie bisher.
 * Texte kommen aus data-Attributen in der Sprache der Seite.
 */
(function () {
  'use strict';
  var box = document.querySelector('[data-kf]');
  if (!box) return;
  var q = box.querySelector('input');
  var zahl = box.querySelector('[data-kf-n]');
  var alle = box.querySelector('[data-kf-alle]');
  var zeilen = Array.prototype.slice.call(document.querySelectorAll('.dp-table--liste tbody tr'));
  if (!q || !zeilen.length) return;
  var texte = zeilen.map(function (z) { return (z.textContent || '').toLowerCase().replace(/\s+/g, ' '); });
  var tZahl = box.getAttribute('data-t-zahl') || '{x} / {y}';
  var tAlle = box.getAttribute('data-t-alle') || '{q}';
  var finder = box.getAttribute('data-finder') || '';
  var n = function (x) { return x.toLocaleString(document.documentElement.lang || undefined); };

  function anwenden() {
    var w = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var sichtbar = 0;
    for (var i = 0; i < zeilen.length; i++) {
      var ok = true;
      for (var j = 0; j < w.length && ok; j++) ok = texte[i].indexOf(w[j]) >= 0;
      zeilen[i].hidden = !ok;
      if (ok) sichtbar++;
    }
    zahl.textContent = w.length ? tZahl.replace('{x}', n(sichtbar)).replace('{y}', n(zeilen.length)) : '';
    if (alle) {
      var roh = q.value.trim();
      alle.hidden = !roh;
      if (roh) {
        alle.textContent = tAlle.replace('{q}', roh);
        alle.href = finder + '?q=' + encodeURIComponent(roh);
      }
    }
  }
  q.addEventListener('input', anwenden);
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; anwenden(); }
  });
  box.hidden = false;
  if (q.value) anwenden();
})();
