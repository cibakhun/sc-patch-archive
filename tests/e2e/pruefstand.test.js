// Pruefstand (scripts/lib/pruefstand.mjs) — eine Seite ohne Browser laden,
// ihre Skripte ausfuehren und bedienen.
//
// Anlass 04.11.2026: verify:clienttext prueft seitdem jede Seitenart mit dem
// Pruefstand. Was er nicht sieht, prueft das Tor nicht — deshalb hier die
// Zusagen, auf die sich das Tor verlaesst, an einer Mini-Seite:
//   - geschrieben wird gemerkt (Text, Attribute, neues Markup), statischer
//     Text gehoert nicht dazu,
//   - fetch() liest dist/, fremde Hosts sind "offline",
//   - erkunde() bedient Knoepfe, Auswahllisten und Suchfelder, aber nichts
//     Verstecktes,
//   - ein Abbruch oder eine Endlosschleife wird Befund statt Stillstand,
//   - umgehaengte Knoten werden nicht neu gelesen (Laufzeit), geaenderter
//     Text in ihnen schon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { oeffneSeite, erkunde, texteAus, seitenArten } from '../../scripts/lib/pruefstand.mjs';

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'pruefstand-'));
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'assets', 'daten.json'), JSON.stringify({ n: 3 }));
fs.writeFileSync(path.join(dist, 'assets', 'werkzeug.js'), `
  var out = document.getElementById('out');
  fetch('/assets/daten.json').then(function (r) { return r.json(); }).then(function (j) { out.textContent = j.n + ' Treffer'; });
  fetch('https://example.org/x').catch(function () { document.getElementById('netz').textContent = 'offline'; });
  document.getElementById('los').addEventListener('click', function () { out.setAttribute('aria-label', 'geklickt'); });
  document.getElementById('wahl').addEventListener('change', function (e) { out.textContent = 'Wahl ' + e.target.value; });
  document.getElementById('suche').addEventListener('input', function (e) { document.getElementById('netz').textContent = 'Suche ' + e.target.value; });
  document.getElementById('versteckt').addEventListener('click', function () { throw new Error('versteckt geklickt'); });
  document.addEventListener('click', function (e) { var k = e.target.closest('.karte'); if (k) k.querySelector('b').textContent = 'offen'; });
`);
const seite = (body, extra = '') => `<!doctype html><html lang="de"><head></head><body><main>${body}</main>${extra}</body></html>`;
fs.writeFileSync(path.join(dist, 'werkzeug.html'), seite(
  `<p>Statischer Text</p><div id="out"></div><div id="netz"></div>
   <button id="los">Los</button>
   <select id="wahl"><option value="a">A</option><option value="b">B</option></select>
   <input type="search" id="suche">
   <div hidden><button id="versteckt">X</button></div>
   <div class="karte"><b>zu</b></div>`,
  '<script src="/assets/werkzeug.js"></script>',
));
fs.writeFileSync(path.join(dist, 'kaputt.html'), seite('', '<script>undefinedFunction();</script><script>for(;;){}</script>'));

const opts = { dist, esbuild };

test('schreibt, laedt aus dist/, fremder Host offline', async () => {
  const p = await oeffneSeite({ ...opts, seite: 'werkzeug.html' });
  await p.settle(1000);
  const texte = p.ernte().flatMap((el) => texteAus(el, p.seitenLang).map((x) => x.t));
  assert.ok(texte.includes('3 Treffer'), texte.join(' | '));
  assert.ok(texte.includes('offline'), texte.join(' | '));
  assert.ok(!texte.includes('Statischer Text'));
  assert.ok(p.statisch.has('de|Statischer Text'));
  p.schliesse();
});

test('erkunde bedient, was ein Mensch bedienen kann', async () => {
  const p = await oeffneSeite({ ...opts, seite: 'werkzeug.html' });
  await p.settle(1000);
  p.ernte();
  const gesehen = new Set();
  const z = await erkunde(p, { beiErnte: (els) => { for (const el of els) for (const x of texteAus(el, p.seitenLang)) gesehen.add(x.t); } });
  for (const t of ['geklickt', 'Wahl b', 'Suche zzqx', 'offen']) assert.ok(gesehen.has(t), `${t} fehlt: ${[...gesehen].join(' | ')}`);
  assert.ok(z.aktionen >= 5);
  assert.deepEqual(p.fehler, [], 'der versteckte Knopf darf nicht geklickt werden');
  p.schliesse();
});

test('Abbruch und Endlosschleife werden Befund', async () => {
  const p = await oeffneSeite({ ...opts, seite: 'kaputt.html' });
  assert.equal(p.fehler.length, 2, p.fehler.join(' | '));
  assert.match(p.fehler[0], /undefinedFunction is not defined/);
  assert.match(p.fehler[1], /kein Ende nach/);
  p.schliesse();
});

test('umgehaengte Knoten nicht neu lesen, geaenderten Text schon', async () => {
  fs.writeFileSync(path.join(dist, 'sortieren.html'), seite('<ul id="l"></ul>', `<script>
    var l = document.getElementById('l');
    for (var i = 0; i < 3; i++) { var li = document.createElement('li'); li.textContent = 'Karte ' + i; l.appendChild(li); }
    window.sortiere = function () { var k = Array.prototype.slice.call(l.children).reverse(); k.forEach(function (x) { l.appendChild(x); }); };
    window.aendere = function () { l.firstChild.textContent = 'neu'; };
  </script>`));
  const p = await oeffneSeite({ ...opts, seite: 'sortieren.html' });
  assert.equal(p.ernte().length, 3);
  p.imKontext(() => p.window.sortiere(), 'sortieren');
  assert.equal(p.ernte().length, 0);
  p.imKontext(() => p.window.aendere(), 'aendern');
  const els = p.ernte();
  assert.equal(els.length, 1);
  assert.equal(els[0].textContent, 'neu');
  p.schliesse();
});

test('seitenArten fasst gleiche Skripte zusammen', () => {
  fs.writeFileSync(path.join(dist, 'werkzeug2.html'), fs.readFileSync(path.join(dist, 'werkzeug.html'), 'utf8').replace('Statischer Text', 'Anderer Text'));
  const arten = seitenArten(dist);
  const w = arten.find((a) => a.seite === 'werkzeug.html');
  assert.equal(w.anzahl, 2);
  assert.ok(!arten.some((a) => a.seite === 'werkzeug2.html'));
});
