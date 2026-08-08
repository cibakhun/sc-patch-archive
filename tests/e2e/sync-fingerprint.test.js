// Rechenfaelle fuer tokenize()/splitLangsw()/cutRegion() (Phase 4, Plan 1,
// Task 1). Reine Funktionen, keine Datei-Ein-/Ausgabe — Vorbild
// tests/e2e/layer-compositing.test.js.
//
// Warum ueberhaupt: D-01 verlangt einen Struktur-Fingerabdruck, der
// Reihenfolge sieht (nicht bloss zaehlt) und Textinhalte ignoriert. Diese
// Tests halten genau diese beiden Eigenschaften fest, plus die enge
// (nicht seitenweite) Sprachumschalter-Ausnahme, die den Fingerabdruck
// erst bezahlbar macht.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { tokenize, splitLangsw, cutRegion } from '../../scripts/verify-sync.mjs';

describe('tokenize(html) — Struktur-Fingerabdruck (D-01: Typ + Klassen, ohne Text)', () => {
  test('Element-Typ und Klassen in Autorenreihenfolge, Textinhalt geht nicht ein', () => {
    const html = '<div class="a b"><p>Text</p></div>';
    assert.deepStrictEqual(tokenize(html), ['div.a.b', 'p.']);
  });

  test('unterschiedlich langer Fliesstext bei gleichem Markup ergibt denselben Fingerabdruck', () => {
    const short = '<section class="s"><p class="x">Kurz</p></section>';
    const long =
      '<section class="s"><p class="x">Ein sehr viel laengerer Absatz mit mehreren Saetzen, ' +
      'der auf der deutschen Fassung deutlich mehr Zeichen belegt als auf der englischen.</p></section>';
    assert.deepStrictEqual(tokenize(short), tokenize(long));
  });

  test('schliessende Tags erzeugen kein Token; ein <script>-Rumpf mit <div> darin erzeugt kein Token', () => {
    const html = '<div class="a"><script>const el = document.createElement("div");</script></div>';
    assert.deepStrictEqual(tokenize(html), ['div.a', 'script.']);
  });

  test('D-01-Kern: zwei vertauschte Geschwister-Abschnitte ergeben UNTERSCHIEDLICHE Folgen trotz identischer Vielfachmenge', () => {
    const a = '<section class="one"></section><section class="two"></section>';
    const b = '<section class="two"></section><section class="one"></section>';
    const tokensA = tokenize(a);
    const tokensB = tokenize(b);
    assert.notDeepStrictEqual(tokensA, tokensB, 'vertauschte Reihenfolge muss eine andere Folge ergeben');
    assert.deepStrictEqual(
      [...tokensA].sort(),
      [...tokensB].sort(),
      'die reine Zaehlung (Vielfachmenge) ist dagegen identisch — genau der von D-01 verworfene blinde Fleck'
    );
  });
});

describe('splitLangsw(tokens) — enge Sprachumschalter-Ausnahme (X-langsw-order)', () => {
  test('Kinder (langsw__*) fallen aus der Folge, der Behaelter (div.langsw) bleibt, Menge je Instanz', () => {
    const tokens = ['div.langsw', 'span.langsw__cur', 'span.langsw__sep', 'a.langsw__opt', 'main.'];
    const { seq, instances } = splitLangsw(tokens);
    assert.deepStrictEqual(seq, ['div.langsw', 'main.']);
    assert.deepStrictEqual(instances, [{ langsw__cur: 1, langsw__sep: 1, langsw__opt: 1 }]);
  });

  test('EN- und DE-Anordnung derselben Instanz liefern dieselbe Menge; ein ENTFERNTES a.langsw__opt liefert eine andere', () => {
    const en = ['div.langsw', 'span.langsw__cur', 'span.langsw__sep', 'a.langsw__opt'];
    const de = ['div.langsw', 'a.langsw__opt', 'span.langsw__sep', 'span.langsw__cur'];
    const broken = ['div.langsw', 'span.langsw__sep', 'span.langsw__cur']; // a.langsw__opt fehlt

    const enSplit = splitLangsw(en);
    const deSplit = splitLangsw(de);
    const brokenSplit = splitLangsw(broken);

    assert.deepStrictEqual(enSplit.instances, deSplit.instances, 'EN/DE-Reihenfolge derselben Instanz muss dieselbe Menge ergeben');
    assert.notDeepStrictEqual(
      enSplit.instances,
      brokenSplit.instances,
      'ein fehlendes a.langsw__opt muss eine andere Menge ergeben — der Ausschluss ist eng, nicht blind'
    );
  });

  test('eine Seite ohne div.langsw liefert null Instanzen und eine unveraenderte Folge (DataShell-Fall)', () => {
    const tokens = ['main.dp-main', 'p.dp-desc'];
    const { seq, instances } = splitLangsw(tokens);
    assert.deepStrictEqual(seq, tokens);
    assert.strictEqual(instances.length, 0);
  });
});

describe('cutRegion(html, openTagPattern, tagName) — benannte Regionen vollstaendig herausschneiden', () => {
  test('schneidet <section class="x">…</section> samt verschachteltem <section> darin heraus, Geschwister bleiben stehen', () => {
    const html =
      '<p class="before">before</p>' +
      '<section class="x">outer<section class="inner">inner</section>tail</section>' +
      '<p class="after">after</p>';
    const out = cutRegion(html, /<section class="x"[^>]*>/, 'section');
    assert.strictEqual(out, '<p class="before">before</p><p class="after">after</p>');
  });

  test('kein Treffer fuer das Muster laesst die Eingabe unveraendert', () => {
    const html = '<p class="a">x</p><p class="b">y</p>';
    const out = cutRegion(html, /<section class="nope"[^>]*>/, 'section');
    assert.strictEqual(out, html);
  });
});
