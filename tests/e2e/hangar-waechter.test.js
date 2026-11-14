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
// Seit 14.11.2026 (Krisz waehlte „Volle Halle fuers Handy abspecken“): Die
// Worker, die die Geometrie auspacken, enden ohne Arbeit, und grosse Stuecke
// nehmen ihren Worker mit (Entpacker in assets/hangar-viewer.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WAECHTER, waechterStand, waechterAbbruch, waechterText, waechterOffen, waechterVerlauf, waechterLaeufe, waechterLaeufeText, waechterAnlauf, waechterAnlaufText, waechterAnspruch, waechterBefund, waechterLeicht, waechterGeraet } from '../../assets/hangar-overview.js';
import { fitSize, limiter, ENTPACKER, Entpacker } from '../../assets/hangar-viewer.js';

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
    assert.deepEqual(waechterOffen(vermerk({}), T0 + MIN), { id: 'a1', t: T0, stufe: 'mittel', phase: null, geraet: false });
    assert.deepEqual(waechterOffen(vermerk({ stufe: null }), T0 + MIN), { id: 'a1', t: T0, stufe: null, phase: null, geraet: false });
    assert.deepEqual(waechterOffen(vermerk({ stufe: 'ultra' }), T0 + MIN), { id: 'a1', t: T0, stufe: null, phase: null, geraet: false });
  });

  test('und ob der Lauf auch im Speicher des Geraets steht', () => {
    assert.equal(waechterOffen(vermerk({ g: 1 }), T0 + MIN).geraet, true);
    for (const g of [0, '1', true, null]) assert.equal(waechterOffen(vermerk({ g }), T0 + MIN).geraet, false, String(g));
  });

  test('und wie weit der Lauf war', () => {
    for (const phase of WAECHTER.phasen) assert.equal(waechterOffen(vermerk({ phase }), T0 + MIN).phase, phase);
    assert.equal(waechterOffen(vermerk({ phase: 'fertig' }), T0 + MIN).phase, null);
    assert.equal(waechterOffen(vermerk({ phase: 7 }), T0 + MIN).phase, null);
  });

  test('der Zeitgeber haelt den Vermerk eines sichtbaren Laufs frisch', () => {
    // der Vermerk wird alle WAECHTER.puls erneuert: Er darf dazwischen nicht alt werden
    assert.ok(WAECHTER.puls > 0 && WAECHTER.puls * 2 <= WAECHTER.frisch);
    assert.deepEqual(waechterOffen(vermerk({}), T0 + WAECHTER.puls), { id: 'a1', t: T0, stufe: 'mittel', phase: null, geraet: false });
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
    for (const raw of [null, '', '{', 'null', '[]', JSON.stringify({ v: WAECHTER.v }), JSON.stringify({ v: WAECHTER.v, l: [] }), JSON.stringify({ v: WAECHTER.v, l: { a: null, b: 7 } })]) assert.deepEqual(waechterLaeufe(raw, T0), [], String(raw));
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
  const start = (i, t) => ({ id: `s${i}`, t });

  test('ein toter Lauf ist ein Abbruch der Seite, der juengste gilt, gezaehlt wird einer', () => {
    assert.deepEqual(waechterBefund({ tot: [{ t: T0, stufe: 'hoch', phase: 'laden' }, { t: T0 + 9, stufe: 'mittel', phase: 'bauen' }] }), { stufe: 'mittel', phase: 'bauen', wie: 'seite' });
    assert.deepEqual(waechterBefund({ tot: [{ t: T0, stufe: null, phase: null }], anlauf: [start(0, T0), start(1, T0 + 1), start(2, T0 + 2)], telefon: true }), { stufe: null, phase: null, wie: 'seite' });
  });

  test('ohne Vermerk zaehlen am Telefon die Starts, anderswo nicht', () => {
    const zwei = Array.from({ length: WAECHTER.anlauf.zahl }, (_, i) => start(i, T0 + i * MIN));
    assert.deepEqual(waechterBefund({ anlauf: zwei, telefon: true }), { stufe: null, phase: null, wie: 'start' });
    assert.equal(waechterBefund({ anlauf: zwei, telefon: false }), null);
    assert.equal(waechterBefund({ anlauf: zwei.slice(1), telefon: true }), null);
    assert.equal(waechterBefund({}), null);
    assert.equal(waechterBefund(), null);
  });

  // Review zu PR 363, nachgestellt: drei Hangarseiten nacheinander in neuen
  // Registerkarten, keine bricht ab, und die dritte bekam die leichte Buehne.
  test('Starts, deren Lauf in einer anderen Registerkarte lebt, zaehlen nicht', () => {
    const drei = Array.from({ length: WAECHTER.anlauf.zahl + 1 }, (_, i) => start(i, T0 + i * MIN));
    assert.equal(waechterBefund({ anlauf: drei, lebt: ['s0', 's1'], telefon: true }), null);
    assert.equal(waechterBefund({ anlauf: drei.slice(0, WAECHTER.anlauf.zahl), lebt: ['s0'], telefon: true }), null);
    // ein lebender Lauf nimmt den toten ihre Zahl nicht
    assert.deepEqual(waechterBefund({ anlauf: drei, lebt: ['s0'], telefon: true }), { stufe: null, phase: null, wie: 'start' });
    assert.deepEqual(waechterBefund({ anlauf: drei, lebt: ['fremd'], telefon: true }), { stufe: null, phase: null, wie: 'start' });
  });

  test('die Starts gehen mit ihrer Kennung durch den Speicher und verfallen mit der Frist', () => {
    const text = waechterAnlaufText([start(1, T0 + MIN), start(0, T0)]);
    assert.deepEqual(waechterAnlauf(text, T0 + 2 * MIN), [start(0, T0), start(1, T0 + MIN)]);
    assert.deepEqual(waechterAnlauf(text, T0 + WAECHTER.anlauf.frist), [start(1, T0 + MIN)]);
    assert.deepEqual(waechterAnlauf(text, T0 + MIN + WAECHTER.anlauf.frist), []);
    assert.deepEqual(waechterAnlauf(JSON.stringify({ v: WAECHTER.v - 1, s: [['a', T0]] }), T0 + MIN), []);
    assert.deepEqual(waechterAnlauf(JSON.stringify({ v: WAECHTER.v, s: [['a', T0], ['', T0], [7, T0], ['b', 'x'], null, T0, ['c', T0 + 5 * MIN]] }), T0 + MIN), [{ id: 'a', t: T0 }]);
    // die Liste von vor dem Review (nur Zeiten) gilt nicht mehr
    assert.deepEqual(waechterAnlauf(JSON.stringify({ v: WAECHTER.v, t: [T0] }), T0 + MIN), []);
    for (const raw of [null, '', '{', 'null', '[]', JSON.stringify({ v: WAECHTER.v })]) assert.deepEqual(waechterAnlauf(raw, T0), [], String(raw));
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
      anlauf.push(start(i, now));
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

// Review zu PR 363: Starten zwei Registerkarten im selben Augenblick, lesen
// beide denselben toten Lauf aus dem Speicher des Geraets. Gezaehlt wird er
// von der, die ihn dort noch vorfindet.
describe('Hangar-Waechter: wem ein toter Lauf gehoert', () => {
  const lauf = (id, o = {}) => ({ id, t: T0, stufe: 'mittel', phase: 'bauen', ...o });

  test('ein Lauf aus dem Speicher des Geraets zaehlt nur, solange er dort steht', () => {
    const tot = [lauf('x')];
    assert.deepEqual(waechterAnspruch({ tot, imGeraet: [lauf('x'), lauf('y')] }), tot);
    assert.deepEqual(waechterAnspruch({ tot, imGeraet: [lauf('y')] }), []);
    assert.deepEqual(waechterAnspruch({ tot, imGeraet: [] }), []);
    assert.deepEqual(waechterAnspruch({ tot: [lauf('x'), lauf('z')], imGeraet: [lauf('z')] }), [lauf('z')]);
  });

  test('zwei Starts im selben Augenblick: der zweite findet ihn nicht mehr', () => {
    let imGeraet = [lauf('x')];
    const zaehlt = [];
    for (const name of ['erste', 'zweite']) {
      // beide haben x vor der Frage an den Kanal gelesen
      const meine = waechterAnspruch({ tot: [lauf('x')], imGeraet });
      imGeraet = imGeraet.filter((e) => e.id !== 'x');
      if (waechterBefund({ tot: meine })) zaehlt.push(name);
    }
    assert.deepEqual(zaehlt, ['erste']);
  });

  test('der Vermerk der eigenen Registerkarte zaehlt ohne den Speicher des Geraets immer', () => {
    const offen = lauf('a', { geraet: false });
    assert.deepEqual(waechterAnspruch({ tot: [offen], offen, imGeraet: null }), [offen]);
    assert.deepEqual(waechterAnspruch({ tot: [offen], offen, imGeraet: [] }), [offen]);
    const gespiegelt = lauf('a', { geraet: true });
    assert.deepEqual(waechterAnspruch({ tot: [gespiegelt], offen: gespiegelt, imGeraet: null }), [gespiegelt]);
  });

  test('stand er auch im Speicher des Geraets und ist dort weg, hat ihn ein anderer Start gezaehlt', () => {
    const offen = lauf('a', { geraet: true });
    assert.deepEqual(waechterAnspruch({ tot: [offen], offen, imGeraet: [] }), []);
    assert.deepEqual(waechterAnspruch({ tot: [offen], offen, imGeraet: [lauf('a')] }), [offen]);
  });

  test('ohne Tote und ohne Angaben bleibt es leer', () => {
    assert.deepEqual(waechterAnspruch({ tot: [], offen: lauf('a'), imGeraet: [lauf('a')] }), []);
    assert.deepEqual(waechterAnspruch({}), []);
    assert.deepEqual(waechterAnspruch(), []);
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

// Worker, die nur zaehlen: was sie zu tun bekamen und ob sie beendet sind.
// fertig(id) antwortet wie der echte mit einer (leeren) Geometrie.
function zaehlWorker() {
  const alle = [];
  class Zaehler {
    constructor() { this.tot = false; this.post = []; alle.push(this); }
    postMessage(m) { if (m?.type === 'decode') this.post.push(m.id); }
    terminate() { this.tot = true; }
    fertig(id) { this.onmessage({ data: { type: 'decode', id, geometry: { index: null, attributes: [] } } }); }
    scheitert(id) { this.onmessage({ data: { type: 'error', id, error: 'Probe' } }); }
  }
  return { alle, Zaehler };
}
const ruck = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

describe('Hangar: Entpacker der Geometrie geben ihren Speicher zurueck', () => {
  // je Test: eigene Worker, eigene Uhr (der Zeitgeber der Ruhe wird gefangen)
  function buehne(telefon) {
    const { alle, Zaehler } = zaehlWorker();
    const echt = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, info: console.info };
    const uhr = { fn: null, ms: null };
    globalThis.Worker = Zaehler;
    globalThis.setTimeout = (fn, ms) => { uhr.fn = fn; uhr.ms = ms; return 7; };
    globalThis.clearTimeout = () => { uhr.fn = null; uhr.ms = null; };
    console.info = () => {};
    const e = new Entpacker(telefon);
    e._initDecoder = () => Promise.resolve();
    const ab = () => { e.dispose(); Object.assign(globalThis, { Worker: echt.Worker, setTimeout: echt.setTimeout, clearTimeout: echt.clearTimeout }); console.info = echt.info; };
    return { e, alle, uhr, ab };
  }

  test('Zahlen: am Telefon weniger Worker, die Grenze fuer grosse Stuecke bei 1 MB', () => {
    assert.ok(ENTPACKER.telefon >= 1 && ENTPACKER.telefon <= 2 && ENTPACKER.telefon <= ENTPACKER.faeden);
    assert.ok(ENTPACKER.faeden <= 4);
    assert.equal(ENTPACKER.gross, 1 << 20);
    assert.ok(ENTPACKER.ruhe > 0 && ENTPACKER.ruhe <= 1500);
    const { e: tel, ab: a1 } = buehne(true), { e: pc, ab: a2 } = buehne(false);
    try {
      assert.equal(tel.workerLimit, ENTPACKER.telefon);
      assert.equal(pc.workerLimit, ENTPACKER.faeden);
    } finally { a1(); a2(); }
  });

  test('Ruhe: Worker ohne Arbeit enden nach der Frist, das naechste Stueck startet neue', async () => {
    const { e, alle, uhr, ab } = buehne(false);
    try {
      const w = [];
      for (let id = 1; id <= 6; id++) w.push(await e._getWorker(id, 1000 * id));
      assert.equal(alle.length, ENTPACKER.faeden);
      // solange einer arbeitet, laeuft keine Frist
      for (let id = 1; id <= 5; id++) e._releaseTask(w[id - 1], id);
      assert.equal(uhr.fn, null);
      e._releaseTask(w[5], 6);
      assert.equal(uhr.ms, ENTPACKER.ruhe);
      uhr.fn();
      assert.equal(alle.filter((x) => !x.tot).length, 0);
      assert.equal(e.workerPool.length, 0);
      assert.deepEqual({ gestartet: e.stat.gestartet, beendet: e.stat.beendet, stuecke: e.stat.stuecke }, { gestartet: 4, beendet: 4, stuecke: 6 });
      // danach geht es mit einem neuen Worker weiter
      const neu = await e._getWorker(7, 500);
      assert.equal(alle.length, ENTPACKER.faeden + 1);
      assert.equal(neu.tot, false);
      assert.deepEqual(e.workerPool, [neu]);
    } finally { ab(); }
  });

  test('Ruhe: ein neues Stueck vor Ablauf der Frist haelt sie an, ein Worker mit Arbeit bleibt', async () => {
    const { e, alle, uhr, ab } = buehne(true);
    try {
      const a = await e._getWorker(1, 100);
      e._releaseTask(a, 1);
      assert.equal(uhr.ms, ENTPACKER.ruhe);
      const b = await e._getWorker(2, 100);
      assert.equal(uhr.fn, null);
      // von Hand gerufen: nur der ohne Arbeit geht
      assert.equal(e.ruhe(), alle.length - 1);
      assert.equal(b.tot, false);
      assert.deepEqual(e.workerPool, [b]);
      e._releaseTask(b, 2);
      assert.equal(uhr.ms, ENTPACKER.ruhe);
    } finally { ab(); }
  });

  test('ein grosses Stueck nimmt seinen Worker aus dem Pool; er endet erst, wenn alles von ihm fertig ist', async () => {
    const { e, alle, ab } = buehne(false);
    try {
      // vier Worker, jeder mit einem kleinen Stueck; das grosse geht an den mit der kleinsten Last
      const w = [];
      for (let id = 1; id <= 4; id++) w.push(await e._getWorker(id, 5000 - id));
      const g = await e._getWorker(5, ENTPACKER.gross);
      assert.equal(g, w[3]);
      assert.equal(e.workerPool.includes(g), false);
      assert.equal(e.workerPool.length, 3);
      // das naechste kleine Stueck geht an einen aus dem Pool, nicht an den, der geht;
      // ein weiterer Worker startet nicht, solange der noch lebt
      const k = await e._getWorker(6, 10);
      assert.notEqual(k, g);
      assert.equal(e.workerPool.includes(k), true);
      assert.equal(alle.length, 4);
      e._releaseTask(g, 5);
      assert.equal(g.tot, false, 'sein kleines Stueck laeuft noch');
      e._releaseTask(g, 4);
      assert.equal(g.tot, true);
      assert.equal(e.stat.gross, 1);
      // knapp darunter bleibt der Worker
      const n = await e._getWorker(7, ENTPACKER.gross - 1);
      assert.equal(e.workerPool.includes(n), true);
    } finally { ab(); }
  });

  test('grosse Stuecke: am Telefon eines nach dem anderen, am PC zugleich; ein Fehler haelt die Reihe nicht an', async () => {
    for (const telefon of [true, false]) {
      const { e, alle, ab } = buehne(telefon);
      try {
        const aus = [0, 1, 2].map(() => e.decodeGeometry(new ArrayBuffer(ENTPACKER.gross), {}));
        const klein = e.decodeGeometry(new ArrayBuffer(64), {});
        await ruck();
        const gross = () => alle.filter((w) => w._geht);
        assert.equal(gross().reduce((n, w) => n + w.post.length, 0), telefon ? 1 : 3, `telefon ${telefon}`);
        // das kleine Stueck wartet nicht auf die grossen
        const kw = alle.find((w) => !w._geht);
        assert.equal(kw.post.length, 1);
        kw.fertig(kw.post.shift());
        assert.ok((await klein).isBufferGeometry);
        // das erste grosse scheitert, die anderen kommen trotzdem dran
        let runde = 0;
        for (; runde < 4 && gross().some((w) => w.post.length); runde++) {
          for (const w of gross()) for (const id of w.post.splice(0)) { if (runde === 0 && w === gross()[0]) w.scheitert(id); else w.fertig(id); }
          await ruck();
        }
        const erg = await Promise.allSettled(aus);
        assert.deepEqual(erg.map((r) => r.status), ['rejected', 'fulfilled', 'fulfilled'], `telefon ${telefon}`);
        assert.equal(runde, telefon ? 3 : 1, `telefon ${telefon}`);
        assert.equal(gross().length, 3);
        assert.equal(gross().filter((w) => !w.tot).length, 0);
      } finally { ab(); }
    }
  });

  // Befund aus dem Review der PR #364: three fragt vor jedem neuen Worker nur
  // den Pool. Der Worker eines grossen Stuecks steht nicht mehr darin, laeuft
  // aber noch; ohne Abzug lebten am Telefon drei statt zwei.
  test('die Grenze gilt fuer alle lebenden Worker: der aus dem Pool genommene zaehlt mit, bis er endet', async () => {
    for (const telefon of [true, false]) {
      const { e, alle, ab } = buehne(telefon);
      const grenze = telefon ? ENTPACKER.telefon : ENTPACKER.faeden;
      const leben = () => alle.filter((w) => !w.tot).length;
      try {
        // der Pool ist voll, jeder Worker hat ein kleines Stueck
        const w = [];
        for (let id = 1; id <= grenze; id++) w.push(await e._getWorker(id, 5000 - id));
        assert.equal(leben(), grenze);
        // ein grosses Stueck nimmt einen mit; das naechste kleine startet keinen weiteren
        const g = await e._getWorker(90, ENTPACKER.gross);
        assert.equal(g, w[grenze - 1]);
        const k = await e._getWorker(91, 10);
        assert.equal(leben(), grenze, `telefon ${telefon}: ${leben()} Worker leben`);
        assert.equal(e.workerPool.includes(k), true);
        assert.equal(e.workerLimit, grenze - 1);
        // endet er, ist sein Platz wieder frei
        e._releaseTask(g, 90);
        e._releaseTask(g, grenze);
        assert.equal(g.tot, true);
        assert.equal(e.workerLimit, grenze);
        await e._getWorker(92, 10);
        assert.equal(leben(), grenze);
        assert.equal(alle.length, grenze + 1);
      } finally { ab(); }
    }
  });

  test('die Grenze haelt auch, wenn alles im selben Augenblick kommt', async () => {
    for (const telefon of [true, false]) {
      const { e, alle, ab } = buehne(telefon);
      const grenze = telefon ? ENTPACKER.telefon : ENTPACKER.faeden;
      try {
        // ein grosses und zwoelf kleine Stuecke, ohne dazwischen zu warten;
        // sechs weitere kleine, waehrend das grosse noch laeuft
        const aus = [e.decodeGeometry(new ArrayBuffer(ENTPACKER.gross), {})];
        for (let i = 0; i < 12; i++) aus.push(e.decodeGeometry(new ArrayBuffer(64 + i), {}));
        let hoechstens = 0;
        await ruck();
        assert.equal(alle.filter((w) => w._geht && !w.tot).length, 1);
        for (let i = 0; i < 6; i++) aus.push(e.decodeGeometry(new ArrayBuffer(128 + i), {}));
        await ruck();
        for (let runde = 0; runde < 20 && alle.some((w) => w.post.length); runde++) {
          hoechstens = Math.max(hoechstens, alle.filter((w) => !w.tot).length);
          // je Runde ein Stueck je Worker, wie ein Worker sie abarbeitet
          for (const w of alle) if (w.post.length) w.fertig(w.post.shift());
          await ruck();
          hoechstens = Math.max(hoechstens, alle.filter((w) => !w.tot).length);
        }
        await Promise.all(aus);
        assert.ok(hoechstens >= 1 && hoechstens <= grenze, `telefon ${telefon}: ${hoechstens} Worker zugleich`);
        assert.equal(alle.filter((w) => w._geht && !w.tot).length, 0);
      } finally { ab(); }
    }
  });

  test('am PC bleibt dem Pool ein Worker, auch wenn mehr grosse Stuecke laufen, als die Grenze zaehlt', async () => {
    const { e, alle, ab } = buehne(false);
    try {
      for (let id = 1; id <= ENTPACKER.faeden + 1; id++) await e._getWorker(id, ENTPACKER.gross);
      assert.equal(e.workerPool.length, 0);
      assert.equal(e.workerLimit, 1);
      const k = await e._getWorker(50, 10), k2 = await e._getWorker(51, 10);
      assert.equal(k, k2);
      assert.equal(alle.filter((w) => !w.tot).length, ENTPACKER.faeden + 2);
    } finally { ab(); }
  });

  // Der Worker eines grossen Stuecks kann noch ein kleines hinter sich haben.
  // Solange er lebt, haelt er den Speicher seines grossen Stuecks (bis 187 MB).
  test('am Telefon wartet das naechste grosse Stueck, bis der Worker des vorigen beendet ist', async () => {
    const { e, alle, ab } = buehne(true);
    try {
      const k1 = e.decodeGeometry(new ArrayBuffer(64), {}), k2 = e.decodeGeometry(new ArrayBuffer(65), {});
      await ruck();
      assert.equal(alle.length, 2);
      const g1 = e.decodeGeometry(new ArrayBuffer(ENTPACKER.gross), {}), g2 = e.decodeGeometry(new ArrayBuffer(ENTPACKER.gross + 1), {});
      await ruck();
      const x = alle.find((w) => w._geht);
      assert.deepEqual(x.post, [1, 3], 'das erste grosse Stueck liegt hinter einem kleinen');
      // das grosse ist fertig, das kleine desselben Workers noch nicht
      const tu = (w, id) => { w.post.splice(w.post.indexOf(id), 1); w.fertig(id); };
      tu(x, 3);
      assert.ok((await g1).isBufferGeometry);
      await ruck();
      assert.equal(x.tot, false);
      assert.equal(alle.reduce((n, w) => n + w.post.filter((id) => id >= 4).length, 0), 0, 'das zweite grosse Stueck ist schon unterwegs');
      assert.equal(alle.filter((w) => !w.tot).length, ENTPACKER.telefon);
      // erst mit dem Ende des Workers geht es weiter
      tu(x, 1);
      assert.ok((await k1).isBufferGeometry);
      await ruck();
      assert.equal(x.tot, true);
      assert.equal(alle.filter((w) => !w.tot).length, ENTPACKER.telefon);
      const z = alle.find((w) => w.post.includes(4));
      assert.ok(z && z._geht && z !== x);
      for (const w of alle) for (const id of w.post.splice(0)) w.fertig(id);
      await ruck();
      assert.ok((await g2).isBufferGeometry && (await k2).isBufferGeometry);
      assert.equal(alle.filter((w) => w._geht && !w.tot).length, 0);
    } finally { ab(); }
  });

  test('dispose beendet auch die Worker, die schon aus dem Pool genommen sind', async () => {
    const { e, alle, ab } = buehne(false);
    try {
      await e._getWorker(1, 10);
      await e._getWorker(2, ENTPACKER.gross);
      assert.equal(alle.filter((w) => !w.tot).length, 2);
      e.dispose();
      assert.equal(alle.filter((w) => !w.tot).length, 0);
      assert.equal(e.lebend.size, 0);
    } finally { ab(); }
  });

  test('dispose: ein grosses Stueck, das am Telefon noch wartet, startet danach keinen Worker mehr', async () => {
    const { e, alle, ab } = buehne(true);
    try {
      e.decodeGeometry(new ArrayBuffer(ENTPACKER.gross), {});
      e.decodeGeometry(new ArrayBuffer(ENTPACKER.gross + 1), {});
      await ruck();
      assert.equal(alle.length, 1);
      // das erste ist fertig, sein Worker hat aber noch ein kleines Stueck: das zweite wartet auf sein Ende
      const x = alle[0];
      await e._getWorker(77, 10).then((w) => assert.notEqual(w, x));
      x._taskCosts[78] = 10; x._taskLoad += 10;
      x.fertig(x.post[0]);
      await ruck();
      assert.equal(x.tot, false);
      assert.equal(e.wartet.length, 1);
      const vorher = alle.length;
      e.dispose();
      await ruck();
      assert.equal(alle.length, vorher, 'nach dispose ist ein Worker gestartet');
      assert.equal(alle.filter((w) => !w.tot).length, 0);
    } finally { ab(); }
  });
});
