// Der Tokenizer hinter den CSP-Hashes (scripts/lib/csp-inline.mjs). Er
// entscheidet, welcher Text eines <script> gehasht wird; liegt er um ein
// Zeichen daneben, blockt der Browser das Skript still. Die Faelle unten
// sind die Stellen, an denen ein Regex danebengreift (Kopfkommentar der
// Bibliothek), plus der Prüfvektor aus der CSP-Spezifikation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zerlege, cspHash, bloecke, leseMapWert, zaehleScriptTagsRoh,
} from '../../scripts/lib/csp-inline.mjs';

const ausgefuehrt = (html) => zerlege(html).skripte.filter((s) => s.hash).map((s) => s.text);

test('Hash im CSP-Format, Prüfvektor der Spezifikation', () => {
  assert.equal(cspHash("alert('Hello, world.');"), "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='");
});

test('welche <script> einen Hash brauchen', () => {
  const z = zerlege(
    '<script>a()</script><script src="/x.js"></script><script type="application/ld+json">{}</script>' +
      '<script type="module">m()</script><script type="importmap">{"imports":{}}</script>' +
      '<script type="text/javascript">t()</script><script></script><script type="speculationrules">{}</script>',
  );
  assert.deepEqual(z.skripte.map((s) => s.art), ['klassisch', 'extern', 'daten', 'modul', 'importmap', 'klassisch', 'klassisch', 'speculationrules']);
  assert.deepEqual(z.skripte.filter((s) => s.hash).map((s) => s.text), ['a()', 'm()', '{"imports":{}}', 't()', '{}']);
  assert.equal(z.scriptTags, 8);
});

test('CRLF und CR werden wie im Browser zu LF', () => {
  assert.deepEqual(ausgefuehrt('<script>a\r\nb\rc</script>'), ['a\nb\nc']);
});

test('Text, der nur wie ein <script> aussieht, ist keins', () => {
  assert.deepEqual(ausgefuehrt('<div title="</script><script>x()</script>">y</div>'), []);
  assert.deepEqual(ausgefuehrt('<!-- <script>x()</script> -->'), []);
  assert.deepEqual(ausgefuehrt('<textarea><script>x()</script></textarea><style>a{}</style>'), []);
  assert.deepEqual(ausgefuehrt('<noscript><script>x()</script></noscript>'), []);
});

test('ein Skript endet erst am echten </script>', () => {
  assert.deepEqual(ausgefuehrt('<script>var s="</scr"+"ipt>";</script>'), ['var s="</scr"+"ipt>";']);
  assert.deepEqual(ausgefuehrt('<script data-x="a>b">y()</script>'), ['y()']);
  assert.deepEqual(ausgefuehrt('<script>a</scriptx>b</script>'), ['a</scriptx>b']);
  // "double escaped": nach <!-- <script> zaehlt das erste </script> nicht
  assert.deepEqual(ausgefuehrt('<script><!--<script></script>x--></script>'), ['<!--<script></script>x-->']);
});

test('doppeltes Attribut: das erste gilt', () => {
  assert.deepEqual(zerlege('<script type="application/json" type="module">{}</script>').skripte.map((s) => s.art), ['daten']);
});

test('Handler: Zeichenreferenzen aufgeloest, unbekannte gemeldet, javascript:-Links gefunden', () => {
  const z = zerlege(`<img onerror="a(&#39;x&#39;)&amp;&amp;b()"><b onclick='c(&quot;y&quot;)'></b><i onclick="d&foo;"></i><a href=" javascript:void(0)">k</a>`);
  assert.deepEqual(z.handler.map((h) => [h.tag, h.attr, h.wert]), [['img', 'onerror', "a('x')&&b()"], ['b', 'onclick', 'c("y")'], ['i', 'onclick', 'd&foo;']]);
  assert.equal(z.handler[0].hash, cspHash("a('x')&&b()"));
  assert.deepEqual(z.handler[2].unbekannt, ['&foo;']);
  assert.equal(z.jsUrls.length, 1);
});

test('Gegenprobe zaehlt dieselben Tags wie der Tokenizer, wenn nichts versteckt ist', () => {
  const html = '<head><script>a()</script><script src="/b.js"></script></head><body><script type="application/json">{}</script></body>';
  assert.equal(zaehleScriptTagsRoh(html), zerlege(html).scriptTags);
});

test('Bloecke fuer nginx: keiner ueber der Grenze, nichts geht verloren', () => {
  const q = Array.from({ length: 200 }, (_, i) => cspHash(String(i)));
  const b = bloecke(q, 3800);
  assert.ok(b.every((x) => x.length <= 3800));
  assert.deepEqual(b.join(' ').split(' '), q);
  assert.throws(() => bloecke(['x'.repeat(10)], 5));
});

test('include-Zeile lesen: genau eine Zeile `csp "…";`, Kommentare egal', () => {
  assert.equal(leseMapWert("# Kopf\ncsp \"'sha256-a' 'sha256-b'\";\n"), "'sha256-a' 'sha256-b'");
  assert.equal(leseMapWert('csp "";\n'), '');
  assert.equal(leseMapWert('csp "a";\ncsp "b";\n'), null);
  assert.equal(leseMapWert('csp "$x";\n'), null);
});
