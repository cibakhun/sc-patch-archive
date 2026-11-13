// Der Waechter gegen die Neu-Lade-Schleife der Hangar-Buehne
// (assets/hangar-overview.js: waechterStand, waechterAbbruch, waechterOffen).
// Anlass: Krisz, 12.11.2026, „Auf dem Handy laedt es die ganze Zeit neu“.
// Geprueft wird die Regel selbst: Jede Folge von Abbruechen endet nach
// hoechstens vier Laeufen bei 'aus', ein einzelner Abbruch aendert nichts,
// und nichts Gemerktes hebt eine Stufe an.
// Seit 13.11.2026 („Das Handy versucht es immer noch die ganze Zeit zu
// laden“): Am Telefon senkt schon der erste Abbruch (sofort, drei Laeufe),
// und der Stand fuehrt eine Spur der Abbrueche fuer die Meldung.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WAECHTER, waechterStand, waechterAbbruch, waechterText, waechterOffen, waechterVerlauf } from '../../assets/hangar-overview.js';
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
  const vermerk = (o) => JSON.stringify({ t: T0, id: 'a1', stufe: 'mittel', ...o });

  test('ein frischer Vermerk nennt Lauf und Stufe', () => {
    assert.deepEqual(waechterOffen(vermerk({}), T0 + MIN), { id: 'a1', stufe: 'mittel', phase: null });
    assert.deepEqual(waechterOffen(vermerk({ stufe: null }), T0 + MIN), { id: 'a1', stufe: null, phase: null });
    assert.deepEqual(waechterOffen(vermerk({ stufe: 'ultra' }), T0 + MIN), { id: 'a1', stufe: null, phase: null });
  });

  test('und wie weit der Lauf war', () => {
    for (const phase of WAECHTER.phasen) assert.equal(waechterOffen(vermerk({ phase }), T0 + MIN).phase, phase);
    assert.equal(waechterOffen(vermerk({ phase: 'fertig' }), T0 + MIN).phase, null);
    assert.equal(waechterOffen(vermerk({ phase: 7 }), T0 + MIN).phase, null);
  });

  test('der Zeitgeber haelt den Vermerk eines sichtbaren Laufs frisch', () => {
    // der Vermerk wird alle WAECHTER.puls erneuert: Er darf dazwischen nicht alt werden
    assert.ok(WAECHTER.puls > 0 && WAECHTER.puls * 2 <= WAECHTER.frisch);
    assert.deepEqual(waechterOffen(vermerk({}), T0 + WAECHTER.puls), { id: 'a1', stufe: 'mittel', phase: null });
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
