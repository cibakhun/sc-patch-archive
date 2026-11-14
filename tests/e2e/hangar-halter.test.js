// Der Stellvertreter der Hangar-Buehne (assets/hangar-overview.js:
// buehnenHalter). Anlass: Hallenwechsel ohne Neuladen, 14.11.2026. Die Seite
// spricht nur mit dem Stellvertreter; beim Wechsel der Halle wird die Buehne
// abgebaut und neu aufgebaut, und er gibt der neuen, was die Seite der alten
// gesagt hat.
// Geprueft wird das Verhalten selbst, nicht der Wortlaut: Horcher und
// Einstellungen kommen bei der neuen Buehne an, eine abgebaute erreicht die
// Seite nicht mehr, und waehrend des Wechsels (keine Buehne) folgt die
// Antwort von sound() dem letzten setSound. Das Letzte hat CodeRabbit an
// PR #371 gefunden: Der Knopf dreht um, was sound() nennt, und ohne Buehne
// nannte sound() den Stand von vorher. Der Ton liess sich dort an-, aber
// nicht wieder ausschalten, und die neue Buehne bekam ihn eingeschaltet.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buehnenHalter } from '../../assets/hangar-overview.js';

// Eine Buehne, wie der Viewer sie gibt: nur was der Stellvertreter beruehrt
function buehne(name, log) {
  let ton = false, stufe = 'hoch';
  const horcher = {};
  return {
    name,
    setSound(on) { ton = !!on; log.push(`${name}.setSound(${ton})`); },
    sound: () => ({ on: ton, can: true }),
    setQuality(q) { stufe = q; log.push(`${name}.setQuality(${q})`); },
    quality: () => stufe,
    onFrame(fn) { horcher.frame = fn; log.push(`${name}.onFrame`); },
    show(id) { log.push(`${name}.show(${id})`); return `${name}:${id}`; },
    dispose() { log.push(`${name}.dispose`); },
    melde(x) { horcher.frame?.(x); },
    keinRuf: 7,
  };
}
// Der Knopf der Seite (tonSchalter): dreht um, was sound() nennt
const knopf = (v) => { const on = !v.sound().on; v.setSound(on); return on; };

describe('Stellvertreter der Hangar-Buehne', () => {
  test('reicht Rufe an die stehende Buehne durch und gibt ihre Antwort zurueck', () => {
    const log = [], h = buehnenHalter(), a = buehne('a', log);
    const v = h.auf(a);
    assert.equal(v, h.v, 'auf() gibt den Stellvertreter zurueck');
    assert.equal(v.show('gladius'), 'a:gladius');
    assert.deepEqual(v.sound(), { on: false, can: true });
    assert.equal(v.gibtEsNicht, undefined, 'was die Buehne nicht kann, kann auch der Stellvertreter nicht');
    assert.equal(v.keinRuf, undefined, 'nur Rufe, keine Werte');
    assert.equal(v.then, undefined, 'kein Versprechen: await haelt ihn sonst fuer eines');
  });

  test('gibt der neuen Buehne Horcher und letzte Einstellungen der alten', () => {
    const log = [], h = buehnenHalter(), a = buehne('a', log), b = buehne('b', log);
    const v = h.auf(a), gehoert = [];
    v.onFrame((x) => gehoert.push(x));
    v.setQuality('mittel');
    v.setQuality('niedrig');
    h.ab();
    assert.equal(log.at(-1), 'a.dispose', 'ab() baut die stehende Buehne ab');
    log.length = 0;
    h.auf(b);
    assert.deepEqual(log, ['b.onFrame', 'b.setQuality(niedrig)'], 'Horcher und nur die letzte Einstellung');
    b.melde('von b');
    assert.deepEqual(gehoert, ['von b']);
  });

  test('eine abgebaute Buehne erreicht die Seite nicht mehr', () => {
    const log = [], h = buehnenHalter(), a = buehne('a', log), b = buehne('b', log);
    const v = h.auf(a), gehoert = [];
    v.onFrame((x) => gehoert.push(x));
    a.melde('a steht');
    h.ab();
    a.melde('a ist abgebaut');
    h.auf(b);
    a.melde('a ist abgebaut, b steht');
    b.melde('b steht');
    assert.deepEqual(gehoert, ['a steht', 'b steht']);
  });

  test('ohne Buehne: merkt sich Rufe, laesst den Rest fallen, antwortet mit dem Letzten', () => {
    const log = [], h = buehnenHalter(), a = buehne('a', log), b = buehne('b', log);
    const v = h.auf(a);
    assert.equal(v.quality(), 'hoch');
    h.ab();
    log.length = 0;
    assert.equal(v.show('carrack'), undefined, 'show ohne Buehne faellt');
    assert.equal(v.quality(), 'hoch', 'die letzte Antwort');
    v.setQuality('mittel');
    assert.deepEqual(log, [], 'nichts erreicht die abgebaute Buehne');
    h.auf(b);
    assert.deepEqual(log, ['b.setQuality(mittel)']);
  });

  test('der Ton laesst sich waehrend des Hallenwechsels ein- und wieder ausschalten', () => {
    const log = [], h = buehnenHalter(), a = buehne('a', log), b = buehne('b', log);
    const v = h.auf(a);
    assert.equal(v.sound().on, false);
    h.ab();
    assert.equal(knopf(v), true, 'erster Druck ohne Buehne: an');
    assert.deepEqual(v.sound(), { on: true, can: true }, 'sound() folgt dem setSound, can bleibt');
    assert.equal(knopf(v), false, 'zweiter Druck ohne Buehne: wieder aus');
    assert.equal(v.sound().on, false);
    log.length = 0;
    h.auf(b);
    assert.deepEqual(log, ['b.setSound(false)'], 'die neue Buehne bekommt die letzte Wahl');
    assert.equal(v.sound().on, false);
  });

  test('der Ton von vorher gilt weiter, bis jemand drueckt', () => {
    const log = [], h = buehnenHalter(), a = buehne('a', log), b = buehne('b', log);
    const v = h.auf(a);
    assert.equal(knopf(v), true);
    assert.equal(v.sound().on, true);
    h.ab();
    assert.equal(v.sound().on, true, 'ohne Buehne: der Stand von vorher');
    h.auf(b);
    assert.equal(v.sound().on, true, 'die neue Buehne laeuft mit Ton');
    assert.equal(knopf(v), false);
    assert.equal(b.sound().on, false);
  });
});
