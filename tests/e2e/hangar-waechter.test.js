// Der Waechter gegen die Neu-Lade-Schleife der Hangar-Buehne
// (assets/hangar-overview.js: waechterStand, waechterAbbruch, waechterOffen).
// Anlass: Krisz, 12.11.2026, „Auf dem Handy laedt es die ganze Zeit neu“.
// Geprueft wird die Regel selbst: Jede Folge von Abbruechen endet nach
// hoechstens vier Laeufen bei 'aus', ein einzelner Abbruch aendert nichts,
// und nichts Gemerktes hebt eine Stufe an.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WAECHTER, waechterStand, waechterAbbruch, waechterText, waechterOffen } from '../../assets/hangar-overview.js';

const T0 = Date.UTC(2026, 10, 12, 18, 0, 0);
const MIN = 60e3;
const leer = () => waechterStand(null, T0);
// Was ein Lauf unter dem Deckel laedt: die gewollte Stufe, hoechstens der Deckel
const laeuft = (gewollt, deckel) => (deckel && WAECHTER.stufen.indexOf(deckel) < WAECHTER.stufen.indexOf(gewollt) ? deckel : gewollt);
// Schleife: jeder Lauf bricht ab; liefert die Stufen der Laeufe bis 'aus'
function schleife(gewollt, abstand, bekannt = true, hoechstens = 20) {
  let stand = leer(), now = T0;
  const laeufe = [];
  for (let i = 0; i < hoechstens; i++) {
    stand = waechterStand(waechterText(stand), now);
    if (stand.deckel === 'aus') return laeufe;
    const stufe = laeuft(gewollt, stand.deckel);
    laeufe.push(stufe);
    now += abstand;
    stand = waechterAbbruch(waechterStand(waechterText(stand), now), now, bekannt ? stufe : null);
  }
  return [...laeufe, 'ENDLOS'];
}

describe('Hangar-Waechter: Abbrueche senken die Stufe, bis die Buehne aus bleibt', () => {
  test('eine Schleife endet nach vier Laeufen, von jeder Stufe aus spaetestens', () => {
    assert.deepEqual(schleife('hoch', MIN), ['hoch', 'hoch', 'mittel', 'niedrig']);
    assert.deepEqual(schleife('mittel', MIN), ['mittel', 'mittel', 'niedrig']);
    assert.deepEqual(schleife('niedrig', MIN), ['niedrig', 'niedrig']);
  });

  test('auch wenn der Lauf abbricht, bevor seine Stufe feststeht', () => {
    assert.deepEqual(schleife('hoch', MIN, false), ['hoch', 'hoch', 'mittel', 'niedrig']);
    // unbekannt gilt als hoechste: ein Geraet auf niedrig braucht dann zwei Laeufe mehr
    assert.deepEqual(schleife('niedrig', MIN, false), ['niedrig', 'niedrig', 'niedrig', 'niedrig']);
  });

  test('der erste Abbruch wird nur vermerkt', () => {
    const s = waechterAbbruch(leer(), T0, 'hoch');
    assert.deepEqual(s, { ab: T0, deckel: null, seit: 0 });
  });

  test('zwei Abbrueche weiter auseinander als die Frist senken nichts', () => {
    const erst = waechterAbbruch(leer(), T0, 'hoch');
    const spaeter = T0 + WAECHTER.zweimal;
    const s = waechterAbbruch(waechterStand(waechterText(erst), spaeter), spaeter, 'hoch');
    assert.deepEqual(s, { ab: spaeter, deckel: null, seit: 0 });
    // eine Millisekunde frueher zaehlt er als zweiter
    const knapp = spaeter - 1;
    assert.equal(waechterAbbruch(waechterStand(waechterText(erst), knapp), knapp, 'hoch').deckel, 'mittel');
  });

  test('der Deckel geht nie nach oben', () => {
    const tief = { ab: T0, deckel: 'niedrig', seit: T0 };
    // ein Lauf meldet faelschlich eine hoehere Stufe: der Deckel bleibt unten
    assert.equal(waechterAbbruch(tief, T0 + MIN, 'hoch').deckel, 'niedrig');
    assert.equal(waechterAbbruch({ ab: T0, deckel: 'aus', seit: T0 }, T0 + MIN, 'hoch').deckel, 'aus');
    // und sinkt unter der gelaufenen Stufe weiter
    assert.equal(waechterAbbruch(tief, T0 + MIN, 'niedrig').deckel, 'aus');
  });

  test('der Deckel verfaellt nach seiner Frist, der Vermerk nach der seinen', () => {
    const raw = waechterText({ ab: T0, deckel: 'niedrig', seit: T0 });
    assert.deepEqual(waechterStand(raw, T0 + MIN), { ab: T0, deckel: 'niedrig', seit: T0 });
    assert.deepEqual(waechterStand(raw, T0 + WAECHTER.zweimal), { ab: null, deckel: 'niedrig', seit: T0 });
    assert.deepEqual(waechterStand(raw, T0 + WAECHTER.deckel), { ab: null, deckel: null, seit: 0 });
  });

  test('Kaputtes, Fremdes und Zeiten aus der Zukunft zaehlen nicht', () => {
    const nichts = { ab: null, deckel: null, seit: 0 };
    for (const raw of [null, '', 'null', '{', '[]', '7', '"aus"', JSON.stringify({ v: WAECHTER.v + 1, ab: T0, deckel: 'aus', seit: T0 })]) {
      assert.deepEqual(waechterStand(raw, T0 + MIN), nichts, String(raw));
    }
    const von = (o) => waechterStand(JSON.stringify({ v: WAECHTER.v, ...o }), T0);
    assert.deepEqual(von({ ab: T0 + MIN, deckel: 'aus', seit: T0 + MIN }), nichts);
    assert.deepEqual(von({ ab: 'gestern', deckel: 'ultra', seit: T0 }), nichts);
    // 'hoch' ist kein Deckel
    assert.deepEqual(von({ ab: null, deckel: 'hoch', seit: T0 }), nichts);
    assert.deepEqual(von({ ab: null, deckel: 'mittel', seit: null }), nichts);
  });
});

describe('Hangar-Waechter: Vermerk „Lauf offen“', () => {
  const vermerk = (o) => JSON.stringify({ t: T0, id: 'a1', stufe: 'mittel', ...o });

  test('ein frischer Vermerk nennt Lauf und Stufe', () => {
    assert.deepEqual(waechterOffen(vermerk({}), T0 + MIN), { id: 'a1', stufe: 'mittel' });
    assert.deepEqual(waechterOffen(vermerk({ stufe: null }), T0 + MIN), { id: 'a1', stufe: null });
    assert.deepEqual(waechterOffen(vermerk({ stufe: 'ultra' }), T0 + MIN), { id: 'a1', stufe: null });
  });

  test('alt, aus der Zukunft, ohne Kennung oder kaputt: kein Abbruch', () => {
    assert.equal(waechterOffen(vermerk({}), T0 + WAECHTER.frisch), null);
    assert.equal(waechterOffen(vermerk({ t: T0 + 2 * MIN }), T0 + MIN), null);
    assert.equal(waechterOffen(vermerk({ id: '' }), T0 + MIN), null);
    assert.equal(waechterOffen(vermerk({ id: 7 }), T0 + MIN), null);
    for (const raw of [null, '', '{', 'null', '[]']) assert.equal(waechterOffen(raw, T0), null, String(raw));
  });
});
