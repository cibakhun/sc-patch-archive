// Rechenfaelle fuer compositeOver()/flattenStack() (Phase 3, Plan 1, Task 2).
//
// Warum ueberhaupt: WCAG rechnet (L1+.05)/(L2+.05). Dieses Verhaeltnis bleibt
// NICHT erhalten, wenn man beide Seiten gleichmaessig Richtung einer dritten
// Farbe mischt — man darf also nicht "beide Seiten gleich eintrueben und
// annehmen, das Verhaeltnis stimmt noch". Vordergrund und Hintergrund muessen
// jeder fuer sich durch den ganzen Schichtstapel geschickt und ERST DANACH
// ins Verhaeltnis gesetzt werden. Diese Tests halten genau diesen Unterschied
// fest — sie liefen ROT, bevor compositeOver/flattenStack existierten (RED
// vor GREEN, TDD-Gatter dieses Plans).
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { compositeOver, flattenStack, contrast, luminance, parseColor } from '../../scripts/lib/theme-color.mjs';

describe('compositeOver(top, bottom) — Standard-Auflegeoperator ("source-over")', () => {
  test('Alpha 1 liefert die obere Farbe unveraendert zurueck (deckt vollstaendig)', () => {
    const top = { r: 0.2, g: 0.4, b: 0.6, alpha: 1 };
    const bottom = { r: 0.9, g: 0.1, b: 0.1, alpha: 1 };
    const out = compositeOver(top, bottom);
    assert.strictEqual(out.r, top.r);
    assert.strictEqual(out.g, top.g);
    assert.strictEqual(out.b, top.b);
    assert.strictEqual(out.alpha, 1);
  });

  test('Alpha 0 liefert die untere Farbe unveraendert zurueck', () => {
    const top = { r: 0.2, g: 0.4, b: 0.6, alpha: 0 };
    const bottom = { r: 0.9, g: 0.1, b: 0.1, alpha: 1 };
    const out = compositeOver(top, bottom);
    assert.strictEqual(out.r, bottom.r);
    assert.strictEqual(out.g, bottom.g);
    assert.strictEqual(out.b, bottom.b);
    assert.strictEqual(out.alpha, 1);
  });

  test('Alpha 0.5 Schwarz ueber Weiss liefert 0.5 je Kanal und alpha:1', () => {
    const black = { r: 0, g: 0, b: 0, alpha: 0.5 };
    const white = { r: 1, g: 1, b: 1, alpha: 1 };
    const out = compositeOver(black, white);
    assert.ok(Math.abs(out.r - 0.5) < 1e-9, `r sollte 0.5 sein, war ${out.r}`);
    assert.ok(Math.abs(out.g - 0.5) < 1e-9, `g sollte 0.5 sein, war ${out.g}`);
    assert.ok(Math.abs(out.b - 0.5) < 1e-9, `b sollte 0.5 sein, war ${out.b}`);
    assert.strictEqual(out.alpha, 1);
  });

  test('nimmt CSS-Farbstrings direkt entgegen (ueber parseColor())', () => {
    const out = compositeOver('rgba(0,0,0,0.5)', '#ffffff');
    assert.ok(Math.abs(out.r - 0.5) < 1e-9);
    assert.strictEqual(out.alpha, 1);
  });
});

describe('flattenStack(base, layers) — Schichten in Malreihenfolge auflegen', () => {
  test('legt Schichten in Malreihenfolge auf: die LETZTE liegt oben', () => {
    const base = { r: 1, g: 1, b: 1, alpha: 1 }; // Weiss
    const layer1 = { r: 1, g: 0, b: 0, alpha: 0.5 }; // Rot, unten
    const layer2 = { r: 0, g: 0, b: 1, alpha: 0.5 }; // Blau, liegt oben (Index 1)
    const expected = compositeOver(layer2, compositeOver(layer1, base));
    const out = flattenStack(base, [layer1, layer2]);
    assert.ok(Math.abs(out.r - expected.r) < 1e-9);
    assert.ok(Math.abs(out.g - expected.g) < 1e-9);
    assert.ok(Math.abs(out.b - expected.b) < 1e-9);
    assert.strictEqual(out.alpha, 1);

    // Reihenfolge ist bedeutungstragend: vertauscht ergibt ein anderes Ergebnis.
    const swapped = flattenStack(base, [layer2, layer1]);
    const differs = Math.abs(out.r - swapped.r) > 1e-9 || Math.abs(out.b - swapped.b) > 1e-9;
    assert.ok(differs, 'Malreihenfolge vertauscht muss ein anderes Ergebnis liefern');
  });

  test('leeres Array liefert die Basis mit alpha:1', () => {
    const base = { r: 0.3, g: 0.6, b: 0.9, alpha: 1 };
    const out = flattenStack(base, []);
    assert.strictEqual(out.r, base.r);
    assert.strictEqual(out.g, base.g);
    assert.strictEqual(out.b, base.b);
    assert.strictEqual(out.alpha, 1);
  });

  test('Basis als Zeichenkette wird ueber parseColor() aufgeloest', () => {
    const out = flattenStack('#0c1020', []);
    const expected = parseColor('#0c1020');
    assert.strictEqual(out.r, expected.r);
    assert.strictEqual(out.g, expected.g);
    assert.strictEqual(out.b, expected.b);
    assert.strictEqual(out.alpha, 1);
  });

  test('zwei nacheinander aufgelegte Alpha-0.5-Schichten sind NICHT dasselbe wie eine Alpha-1-Schicht', () => {
    const base = { r: 1, g: 1, b: 1, alpha: 1 }; // Weiss
    const red = { r: 1, g: 0, b: 0 };
    const twice = flattenStack(base, [{ ...red, alpha: 0.5 }, { ...red, alpha: 0.5 }]);
    const once = flattenStack(base, [{ ...red, alpha: 1 }]);
    // Zweimal 0.5 macht die Fläche NICHT vollstaendig undurchsichtig rot
    // (verbleibendes Weiss: (1-.5)*(1-.5)=25%, nicht 0%) — deshalb muss sich
    // der Gruenkanal (0 im deckenden Rot, > 0 bei zweimal halbtransparent)
    // unterscheiden. Genau diesen Unterschied haelt der Befund fest.
    assert.ok(
      Math.abs(twice.g - once.g) > 1e-6,
      `zwei halbtransparente Schichten (g=${twice.g}) muessen sich von einer deckenden Schicht (g=${once.g}) unterscheiden`
    );
    assert.strictEqual(once.g, 0, 'eine deckende rote Schicht loescht den Gruenkanal vollstaendig');
    assert.ok(twice.g > 0, 'zwei halbtransparente rote Schichten lassen noch Gruenanteil (Restweiss) durch');
  });
});

describe('contrast() auf zusammengelegten Schichten vs. rohen CSS-Farben', () => {
  test('Kontrast auf flattenStack-Ergebnisse unterscheidet sich vom Kontrast auf die rohen CSS-Farben, sobald eine deckende Schicht ueber BEIDEN liegt', () => {
    // Echte Projekt-Tokens: Text auf Foto (--on-media-dim) gegen einen
    // dunklen Seitenhintergrund (--bg, Nyx-Rueckfall aus assets/detail.css),
    // mit der echten Vignetten-Alpha (--vignette, Dunkelmodus) als
    // "deckende Schicht ueber allem" — genau der Fall, den Pitfall 3 aus
    // 03-RESEARCH.md beschreibt.
    const text = '#f4f7ff'; // --on-media-dim
    const bg = '#0c1020'; // --bg (detail.css Rueckfall)
    const rawContrast = contrast(text, bg);

    const ambient = { r: 0, g: 0, b: 0, alpha: 0.62 }; // --vignette, Dunkelmodus
    const flatText = flattenStack(parseColor(text), [ambient]);
    const flatBg = flattenStack(parseColor(bg), [ambient]);
    const stackedContrast = contrast(flatText, flatBg);

    const diff = Math.abs(rawContrast - stackedContrast);
    assert.ok(
      diff > 1e-6,
      `Kontrast muss sich unterscheiden, sonst rechnet die Zusammenlegung nichts ein (roh: ${rawContrast.toFixed(4)}, gestapelt: ${stackedContrast.toFixed(4)})`
    );
  });

  test('luminance()/parseColor() bleiben unveraendert exportiert und funktionsfaehig', () => {
    assert.strictEqual(typeof luminance, 'function');
    assert.strictEqual(typeof parseColor, 'function');
    const c = parseColor('#ffffff');
    assert.ok(Math.abs(luminance(c) - 1) < 1e-6);
  });
});
