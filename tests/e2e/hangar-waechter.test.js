// Der Waechter gegen die Neu-Lade-Schleife der Hangar-Buehne
// (assets/hangar-overview.js: waechterStand, waechterAbbruch, waechterOffen).
// Anlass: Krisz, 12.11.2026, „Auf dem Handy laedt es die ganze Zeit neu“.
// Geprueft wird die Regel selbst: Jede Folge von Abbruechen endet nach
// hoechstens vier Laeufen bei 'aus', ein einzelner Abbruch aendert nichts,
// und nichts Gemerktes hebt eine Stufe an.
// Seit 13.11.2026 („Das Handy versucht es immer noch die ganze Zeit zu
// laden“): Am Telefon senkt schon der erste Abbruch (sofort, drei Laeufe),
// und der Stand fuehrt eine Spur der Abbrueche fuer die Meldung.
// Seit 14.11.2026 („Ne immer noch Dauer Neulade Loop“): Der Vermerk steht
// auch im Speicher des Geraets, am Telefon zaehlen die Starts, und unter
// jedem Deckel laeuft dort die leichte Buehne.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WAECHTER, waechterStand, waechterAbbruch, waechterText, waechterOffen, waechterVerlauf, waechterLaeufe, waechterLaeufeText, waechterAnlauf, waechterAnlaufText, waechterBefund, waechterLeicht, waechterGeraet } from '../../assets/hangar-overview.js';
import { fitSize, limiter } from '../../assets/hangar-viewer.js';

const T0 = Date.UTC(2026, 10, 12, 18, 0, 0);
const MIN = 60e3;
const leer = () => waechterStand(null, T0);
// Was ein Lauf unter dem Deckel laedt: die gewollte Stufe, hoechstens der Deckel
const laeuft = (gewollt, deckel) => (deckel && WAECHTER.stufen.indexOf(deckel) < WAECHTER.stufen.indexOf(gewollt) ? deckel : gewollt);
// Schleife: jeder Lauf bricht ab; liefert die Stufen der Laeufe bis 'aus'
function schleife(gewollt, abstand, bekannt = true, hoechstens = 20, was = undefined) {
  let stand = leer(), now = T0;
  const laeufe = [];
  for (let i = 0; i < hoechstens; i++) {
    stand = waechterStand(waechterText(stand), now);
    if (stand.deckel === 'aus') return laeufe;
    const stufe = laeuft(gewollt, stand.deckel);
    laeufe.push(stufe);
    now += abstand;
    stand = waechterAbbruch(waechterStand(waechterText(stand), now), now, bekannt ? stufe : null, was);
  }
  return [...laeufe, 'ENDLOS'];
}
// Stand ohne die Spur (die pruefen eigene Tests)
const kern = ({ ab, deckel, seit }) => ({ ab, deckel, seit });
// Wort der Seite fuer die Art 'start' (die uebrigen Worte stehen bei der Spur)
const wortStart = (k) => ({ start: 'neu gestartet' })[k] ?? '';

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
    assert.deepEqual(kern(s), { ab: T0, deckel: null, seit: 0 });
  });

  test('am Telefon (sofort) senkt schon der erste: drei Laeufe, dann aus', () => {
    const tel = { sofort: true };
    assert.deepEqual(kern(waechterAbbruch(leer(), T0, 'hoch', tel)), { ab: T0, deckel: 'mittel', seit: T0 });
    assert.deepEqual(schleife('hoch', MIN, true, 20, tel), ['hoch', 'mittel', 'niedrig']);
    assert.deepEqual(schleife('mittel', MIN, true, 20, tel), ['mittel', 'niedrig']);
    assert.deepEqual(schleife('niedrig', MIN, true, 20, tel), ['niedrig']);
    // auch Tage auseinander: am Telefon zaehlt keine Frist
    assert.deepEqual(schleife('hoch', 3 * 864e5, true, 20, tel), ['hoch', 'mittel', 'niedrig']);
    // unbekannte Stufe gilt als hoechste, unter einem Deckel als der Deckel
    assert.equal(waechterAbbruch(leer(), T0, null, tel).deckel, 'mittel');
    assert.equal(waechterAbbruch({ ab: null, deckel: 'niedrig', seit: T0, spur: [] }, T0 + MIN, null, tel).deckel, 'aus');
  });

  test('zwei Abbrueche weiter auseinander als die Frist senken nichts', () => {
    const erst = waechterAbbruch(leer(), T0, 'hoch');
    const spaeter = T0 + WAECHTER.zweimal;
    const s = waechterAbbruch(waechterStand(waechterText(erst), spaeter), spaeter, 'hoch');
    assert.deepEqual(kern(s), { ab: spaeter, deckel: null, seit: 0 });
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
    assert.deepEqual(waechterStand(raw, T0 + MIN), { ab: T0, deckel: 'niedrig', seit: T0, spur: [] });
    assert.deepEqual(waechterStand(raw, T0 + WAECHTER.zweimal), { ab: null, deckel: 'niedrig', seit: T0, spur: [] });
    assert.deepEqual(waechterStand(raw, T0 + WAECHTER.deckel), { ab: null, deckel: null, seit: 0, spur: [] });
  });

  test('Kaputtes, Fremdes und Zeiten aus der Zukunft zaehlen nicht', () => {
    const nichts = { ab: null, deckel: null, seit: 0, spur: [] };
    // auch der Stand der Fassung davor: Seit v 2 ist die Halle am Telefon leichter, alte Deckel verfallen
    assert.ok(WAECHTER.v >= 2);
    for (const raw of [null, '', 'null', '{', '[]', '7', '"aus"', JSON.stringify({ v: WAECHTER.v + 1, ab: T0, deckel: 'aus', seit: T0 }), JSON.stringify({ v: WAECHTER.v - 1, ab: T0, deckel: 'aus', seit: T0 })]) {
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
  const vermerk = (o) => JSON.stringify({ v: WAECHTER.v, t: T0, id: 'a1', stufe: 'mittel', ...o });

  test('ein frischer Vermerk nennt Lauf und Stufe', () => {
    assert.deepEqual(waechterOffen(vermerk({}), T0 + MIN), { id: 'a1', t: T0, stufe: 'mittel', phase: null });
    assert.deepEqual(waechterOffen(vermerk({ stufe: null }), T0 + MIN), { id: 'a1', t: T0, stufe: null, phase: null });
    assert.deepEqual(waechterOffen(vermerk({ stufe: 'ultra' }), T0 + MIN), { id: 'a1', t: T0, stufe: null, phase: null });
  });

  test('und wie weit der Lauf war', () => {
    for (const phase of WAECHTER.phasen) assert.equal(waechterOffen(vermerk({ phase }), T0 + MIN).phase, phase);
    assert.equal(waechterOffen(vermerk({ phase: 'fertig' }), T0 + MIN).phase, null);
    assert.equal(waechterOffen(vermerk({ phase: 7 }), T0 + MIN).phase, null);
  });

  test('der Zeitgeber haelt den Vermerk eines sichtbaren Laufs frisch', () => {
    // der Vermerk wird alle WAECHTER.puls erneuert: Er darf dazwischen nicht alt werden
    assert.ok(WAECHTER.puls > 0 && WAECHTER.puls * 2 <= WAECHTER.frisch);
    assert.deepEqual(waechterOffen(vermerk({}), T0 + WAECHTER.puls), { id: 'a1', t: T0, stufe: 'mittel', phase: null });
  });

  test('ein Vermerk einer anderen Fassung zaehlt nicht', () => {
    // Ein Lauf der Halle von vor dem Update darf der neuen keinen Deckel
    // setzen: Am Telefon senkt schon der erste Abbruch, und ein alter
    // Vermerk auf niedrig stellte die Ansicht fuer 30 Tage ab.
    const alt = JSON.stringify({ t: T0, id: 'a1', stufe: 'niedrig' });
    assert.equal(waechterOffen(alt, T0 + MIN), null);
    assert.equal(waechterOffen(vermerk({ v: WAECHTER.v - 1 }), T0 + MIN), null);
    assert.equal(waechterOffen(vermerk({ v: WAECHTER.v + 1 }), T0 + MIN), null);
    assert.equal(waechterOffen(vermerk({ v: String(WAECHTER.v) }), T0 + MIN), null);
  });

  test('alt, aus der Zukunft, ohne Kennung oder kaputt: kein Abbruch', () => {
    assert.equal(waechterOffen(vermerk({}), T0 + WAECHTER.frisch), null);
    assert.equal(waechterOffen(vermerk({ t: T0 + 2 * MIN }), T0 + MIN), null);
    assert.equal(waechterOffen(vermerk({ id: '' }), T0 + MIN), null);
    assert.equal(waechterOffen(vermerk({ id: 7 }), T0 + MIN), null);
    for (const raw of [null, '', '{', 'null', '[]']) assert.equal(waechterOffen(raw, T0), null, String(raw));
  });
});

describe('Hangar-Waechter: Spur der Abbrueche', () => {
  const wort = (k) => ({ hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig', laden: 'beim Laden', bauen: 'beim Aufbau', steht: 'nach dem Laden', seite: 'Seite beendet', kontext: 'Grafik verloren' })[k] ?? '';

  test('jeder Abbruch haengt Stufe, Phase und Art an, auch der nur vermerkte', () => {
    const a = waechterAbbruch(leer(), T0, 'hoch', { phase: 'bauen', wie: 'seite' });
    assert.deepEqual(a.spur, [{ t: T0, s: 'hoch', p: 'bauen', w: 'seite' }]);
    assert.equal(a.deckel, null);
    const b = waechterAbbruch(waechterStand(waechterText(a), T0 + MIN), T0 + MIN, 'hoch', { phase: 'steht', wie: 'kontext' });
    assert.deepEqual(b.spur.map((e) => [e.s, e.p, e.w]), [['hoch', 'bauen', 'seite'], ['hoch', 'steht', 'kontext']]);
    assert.deepEqual(waechterVerlauf(b.spur, wort), ['Hoch, beim Aufbau, Seite beendet', 'Hoch, nach dem Laden, Grafik verloren']);
  });

  test('Unbekanntes faellt aus der Zeile, nicht die Zeile aus der Spur', () => {
    const a = waechterAbbruch(leer(), T0, null, { phase: 'irgendwann', wie: 'seite' });
    assert.deepEqual(a.spur, [{ t: T0, s: null, p: null, w: 'seite' }]);
    assert.deepEqual(waechterVerlauf(a.spur, wort), ['Seite beendet']);
    // ohne ein einziges Wort bleibt keine leere Zeile
    assert.deepEqual(waechterVerlauf([{ t: T0, s: null, p: null, w: null }], wort), []);
    assert.deepEqual(waechterVerlauf(undefined, wort), []);
  });

  test('die Spur geht durch den Speicher, bleibt kurz und lebt mit dem Stand', () => {
    let stand = leer();
    for (let i = 0; i < WAECHTER.spur + 3; i++) {
      const now = T0 + i * MIN;
      stand = waechterStand(waechterText(waechterAbbruch(stand, now, 'niedrig', { phase: 'laden', wie: 'seite' })), now);
    }
    assert.equal(stand.spur.length, WAECHTER.spur);
    assert.equal(stand.spur.at(-1).t, T0 + (WAECHTER.spur + 2) * MIN);
    // Kaputtes in der Spur faellt weg, der Stand bleibt
    const raw = JSON.stringify({ v: WAECHTER.v, ab: T0, deckel: 'mittel', seit: T0, spur: [7, null, { t: 'x' }, { t: T0 + 2 * MIN, s: 'hoch' }, { t: T0, s: 'hoch', p: 'steht', w: 'kontext', mehr: 1 }] });
    assert.deepEqual(waechterStand(raw, T0 + MIN), { ab: T0, deckel: 'mittel', seit: T0, spur: [{ t: T0, s: 'hoch', p: 'steht', w: 'kontext' }] });
    // ohne Abbruch in der Frist und ohne Deckel ist sie leer
    const nur = waechterText(waechterAbbruch(leer(), T0, 'hoch', { phase: 'bauen', wie: 'seite' }));
    assert.equal(waechterStand(nur, T0 + MIN).spur.length, 1);
    assert.deepEqual(waechterStand(nur, T0 + WAECHTER.zweimal), { ab: null, deckel: null, seit: 0, spur: [] });
  });

  test('der Knopf der Meldung behaelt sie: ein Versuch in der niedrigen Stufe, dann wieder aus', () => {
    let stand = leer();
    for (const [i, stufe] of ['hoch', 'mittel', 'niedrig'].entries()) stand = waechterAbbruch(stand, T0 + i * MIN, stufe, { sofort: true, phase: 'bauen', wie: 'seite' });
    assert.equal(stand.deckel, 'aus');
    const versuch = waechterStand(waechterText({ ab: null, deckel: 'niedrig', seit: T0 + 5 * MIN, spur: stand.spur }), T0 + 5 * MIN);
    assert.equal(versuch.deckel, 'niedrig');
    assert.equal(versuch.spur.length, 3);
    const wieder = waechterAbbruch(versuch, T0 + 6 * MIN, 'niedrig', { sofort: true, phase: 'steht', wie: 'kontext' });
    assert.equal(wieder.deckel, 'aus');
    assert.equal(waechterVerlauf(wieder.spur, wort).length, 4);
  });
});

// Seit v 3 steht der Vermerk auch im Speicher des Geraets, und am Telefon
// zaehlen die Starts. Anlass: Baut der Browser die Registerkarte nach dem
// Ende der Seite neu auf, ist ihr Speicher leer, und ohne Vermerk zaehlte
// kein Abbruch (nachgestellt: 7 Laeufe in 55 s, kein Ende).
describe('Hangar-Waechter: offene Laeufe im Speicher des Geraets', () => {
  const lauf = (id, t, o = {}) => ({ id, t, stufe: 'hoch', phase: 'laden', ...o });

  test('gehen durch den Speicher, aelteste zuerst', () => {
    const text = waechterLaeufeText([lauf('b', T0 + 5), lauf('a', T0, { stufe: null, phase: 'bauen' })]);
    assert.deepEqual(waechterLaeufe(text, T0 + MIN), [lauf('a', T0, { stufe: null, phase: 'bauen' }), lauf('b', T0 + 5)]);
  });

  test('Altes, Kuenftiges, Kaputtes und andere Fassungen fallen weg', () => {
    const text = waechterLaeufeText([lauf('alt', T0 - WAECHTER.frisch), lauf('neu', T0), lauf('morgen', T0 + 2 * MIN)]);
    assert.deepEqual(waechterLaeufe(text, T0 + MIN).map((e) => e.id), ['neu']);
    const fremd = JSON.stringify({ v: WAECHTER.v - 1, l: { a: { t: T0, s: 'hoch', p: 'laden' } } });
    assert.deepEqual(waechterLaeufe(fremd, T0 + MIN), []);
    for (const raw of [null, '', '{', 'null', '[]', '{"v":3}', JSON.stringify({ v: WAECHTER.v, l: [] }), JSON.stringify({ v: WAECHTER.v, l: { a: null, b: 7 } })]) assert.deepEqual(waechterLaeufe(raw, T0), [], String(raw));
    const schief = JSON.stringify({ v: WAECHTER.v, l: { a: { t: T0, s: 'ultra', p: 'fertig' } } });
    assert.deepEqual(waechterLaeufe(schief, T0 + MIN), [{ id: 'a', t: T0, stufe: null, phase: null }]);
  });

  test('die Liste bleibt kurz', () => {
    const viele = Array.from({ length: WAECHTER.laeufe + 5 }, (_, i) => lauf(`l${i}`, T0 + i));
    const rest = waechterLaeufe(waechterLaeufeText(viele), T0 + MIN);
    assert.equal(rest.length, WAECHTER.laeufe);
    assert.equal(rest.at(-1).id, `l${WAECHTER.laeufe + 4}`);
  });
});

describe('Hangar-Waechter: was ein Start zaehlt', () => {
  test('ein toter Lauf ist ein Abbruch der Seite, der juengste gilt, gezaehlt wird einer', () => {
    assert.deepEqual(waechterBefund({ tot: [{ t: T0, stufe: 'hoch', phase: 'laden' }, { t: T0 + 9, stufe: 'mittel', phase: 'bauen' }] }), { stufe: 'mittel', phase: 'bauen', wie: 'seite' });
    assert.deepEqual(waechterBefund({ tot: [{ t: T0, stufe: null, phase: null }], anlauf: [T0, T0 + 1, T0 + 2], telefon: true }), { stufe: null, phase: null, wie: 'seite' });
  });

  test('ohne Vermerk zaehlen am Telefon die Starts, anderswo nicht', () => {
    const zwei = Array.from({ length: WAECHTER.anlauf.zahl }, (_, i) => T0 + i * MIN);
    assert.deepEqual(waechterBefund({ anlauf: zwei, telefon: true }), { stufe: null, phase: null, wie: 'start' });
    assert.equal(waechterBefund({ anlauf: zwei, telefon: false }), null);
    assert.equal(waechterBefund({ anlauf: zwei.slice(1), telefon: true }), null);
    assert.equal(waechterBefund({}), null);
    assert.equal(waechterBefund(), null);
  });

  test('die Starts gehen durch den Speicher und verfallen mit der Frist', () => {
    const text = waechterAnlaufText([T0 + MIN, T0]);
    assert.deepEqual(waechterAnlauf(text, T0 + 2 * MIN), [T0, T0 + MIN]);
    assert.deepEqual(waechterAnlauf(text, T0 + WAECHTER.anlauf.frist), [T0 + MIN]);
    assert.deepEqual(waechterAnlauf(text, T0 + MIN + WAECHTER.anlauf.frist), []);
    assert.deepEqual(waechterAnlauf(JSON.stringify({ v: WAECHTER.v - 1, t: [T0] }), T0 + MIN), []);
    assert.deepEqual(waechterAnlauf(JSON.stringify({ v: WAECHTER.v, t: [T0, 'x', null, T0 + 5 * MIN] }), T0 + MIN), [T0]);
    for (const raw of [null, '', '{', 'null', '[]', '{"v":3}']) assert.deepEqual(waechterAnlauf(raw, T0), [], String(raw));
  });

  // Ein Telefon, dessen Browser nach jedem Ende alles vergisst, was die
  // Registerkarte wusste, und an dem kein Vermerk ueberlebt: nur die Starts
  // bleiben. Jeder Lauf bricht ab, bevor er steht.
  test('eine Schleife ohne jeden Vermerk endet trotzdem: hoechstens drei Laeufe je Stufe', () => {
    let stand = leer(), anlauf = [], now = T0;
    const laeufe = [];
    for (let i = 0; i < 40 && stand.deckel !== 'aus'; i++) {
      now += 20e3;
      const was = waechterBefund({ tot: [], anlauf: waechterAnlauf(waechterAnlaufText(anlauf), now), telefon: true });
      if (was) {
        stand = waechterAbbruch(waechterStand(waechterText(stand), now), now, was.stufe, { sofort: true, phase: was.phase, wie: was.wie });
        anlauf = [];
      }
      if (stand.deckel === 'aus') break;
      laeufe.push(waechterLeicht(stand.deckel, true) ? `leicht ${stand.deckel}` : 'voll');
      anlauf.push(now);
    }
    assert.equal(stand.deckel, 'aus');
    assert.deepEqual(laeufe, ['voll', 'voll', 'leicht mittel', 'leicht mittel', 'leicht niedrig', 'leicht niedrig']);
    assert.deepEqual(waechterVerlauf(stand.spur, wortStart), ['neu gestartet', 'neu gestartet', 'neu gestartet']);
  });

  test('die Ruhe passt in die Frist: drei Laeufe, die gerade nicht stehen, liegen darin', () => {
    assert.ok(WAECHTER.anlauf.zahl >= 1);
    assert.ok(WAECHTER.anlauf.ruhe >= 30e3, 'der Speicher faellt erst eine halbe Minute nach dem Laden');
    assert.ok((WAECHTER.anlauf.zahl + 1) * (WAECHTER.anlauf.ruhe + 60e3) <= WAECHTER.anlauf.frist);
    assert.ok(WAECHTER.arten.includes('start'));
  });
});

describe('Hangar am Telefon: leichte Buehne unter jedem Deckel', () => {
  test('am Telefon mit Deckel, sonst nie', () => {
    for (const d of ['mittel', 'niedrig']) {
      assert.equal(waechterLeicht(d, true), true, d);
      assert.equal(waechterLeicht(d, false), false, d);
    }
    for (const d of [null, undefined, 'aus', 'ultra']) assert.equal(waechterLeicht(d, true), false, String(d));
  });

  test('vom ersten Abbruch an: volle Halle, dann leicht, leicht, aus', () => {
    let stand = leer();
    const laeufe = [];
    for (let i = 0; i < 10 && stand.deckel !== 'aus'; i++) {
      laeufe.push(waechterLeicht(stand.deckel, true) ? 'leicht' : 'voll');
      stand = waechterAbbruch(stand, T0 + i * MIN, stand.deckel ?? 'hoch', { sofort: true, phase: 'bauen', wie: 'seite' });
    }
    assert.deepEqual(laeufe, ['voll', 'leicht', 'leicht']);
  });

  test('die Zeile mit dem Geraet nennt System und Bildschirm', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    assert.equal(waechterGeraet(iphone, { w: 390, h: 844, dpr: 3 }), 'iPhone, iOS 17.5, 390 × 844 @3');
    assert.equal(waechterGeraet(iphone, { w: 844, h: 390, dpr: 3 }), 'iPhone, iOS 17.5, 390 × 844 @3');
    assert.equal(waechterGeraet('Mozilla/5.0 (iPad; CPU OS 16_7 like Mac OS X) AppleWebKit/605.1.15', { w: 820, h: 1180, dpr: 2 }), 'iPad, iOS 16.7, 820 × 1180 @2');
    assert.equal(waechterGeraet('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36', { w: 412, h: 915, dpr: 2.625 }), 'Android 14, 412 × 915 @2.63');
    assert.equal(waechterGeraet('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', { w: 1920, h: 1080, dpr: 1 }), '1080 × 1920 @1');
    assert.equal(waechterGeraet('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), '');
    assert.equal(waechterGeraet(undefined, { w: 0, h: 0 }), '');
  });
});

// Am Telefon packt der Viewer die Bilder gleich klein aus, wenige zugleich
// (assets/hangar-viewer.js: fitSize, limiter). Anlass: 818 MB ausgepackte
// Bilder zugleich beim Laden, in jeder Stufe.
describe('Hangar am Telefon: Bilder klein auspacken', () => {
  test('fitSize: laengere Kante auf den Deckel, Seitenverhaeltnis bleibt, nie groesser', () => {
    assert.deepEqual(fitSize(1024, 1024, 256), [256, 256]);
    assert.deepEqual(fitSize(1024, 512, 256), [256, 128]);
    assert.deepEqual(fitSize(300, 1200, 256), [64, 256]);
    assert.deepEqual(fitSize(4096, 1, 512), [512, 1]);
    assert.equal(fitSize(256, 256, 256), null);
    assert.equal(fitSize(64, 32, 256), null);
    // ohne Masse (Platzhalter, kaputtes Bild) bleibt es, wie es ist
    assert.equal(fitSize(0, 0, 256), null);
    assert.equal(fitSize(undefined, undefined, 256), null);
  });

  test('limiter: hoechstens n zugleich, in der Reihenfolge des Eintreffens, Fehler geben ihren Platz frei', async () => {
    const lim = limiter(3), folge = [];
    let jetzt = 0, hoechst = 0;
    const lauf = (k) => lim(async () => {
      jetzt++; hoechst = Math.max(hoechst, jetzt); folge.push(k);
      await new Promise((r) => setTimeout(r, (k * 7) % 5));
      jetzt--;
      if (k % 4 === 1) throw new Error(`Probe ${k}`);
      return k * 2;
    });
    const aus = await Promise.allSettled(Array.from({ length: 14 }, (_, k) => lauf(k)));
    assert.equal(hoechst, 3);
    assert.deepEqual(folge, Array.from({ length: 14 }, (_, k) => k));
    assert.deepEqual(aus.map((r) => (r.status === 'fulfilled' ? r.value : 'x')), Array.from({ length: 14 }, (_, k) => (k % 4 === 1 ? 'x' : k * 2)));
    // danach ist wieder Platz
    assert.equal(await lim(async () => 'frei'), 'frei');
    // n unter 1 heisst eins nach dem anderen, nicht keins
    assert.equal(await limiter(0)(async () => 'geht'), 'geht');
  });
});
