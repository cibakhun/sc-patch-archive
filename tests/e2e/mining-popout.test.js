// Automatisierter Nachweis der ausgelagerten Spalte (16.08.2026).
//
// Warum ueberhaupt: die Auslagerung verschiebt die Presetzeile und BEIDE
// Listen per adoptNode in ein FREMDES Dokument. Alles Sichtbare funktioniert
// danach weiter — aber nur, weil zwei unscheinbare Stellen in
// assets/mining-workbench.js das auffangen:
//
//   1. $() faellt auf das Fremddokument zurueck. document.getElementById
//      dieser Seite findet den verschobenen Knoten NICHT mehr; ohne den
//      Rueckfall liefe renderPins() beim naechsten Anheften in null.
//   2. Die vier delegierten Handler haengen ueber onDoc() in einer Liste und
//      werden im Fremddokument zusaetzlich angemeldet. Ereignisse steigen
//      NICHT von einem Fenster ins andere auf; ohne das waere drueben jeder
//      Knopf tot.
//
// Beides sind Zeilen, die ein spaeterer Umbau fuer ueberfluessig halten
// koennte — sie sehen aus wie Umstaendlichkeit. Der Schaden faellt erst im
// ausgelagerten Zustand an, den keine andere Pruefung betritt. Genau dafuer
// steht diese Datei. Sie misst Verhalten (das ECHTE Skript in einem node:vm
// gegen das Mock-DOM), sie liest keinen Quelltext.
//
// NICHT hier: der Document-Picture-in-Picture-Zweig. Den gibt es in node
// nicht; das Mock-Fenster traegt kein `documentPictureInPicture`, das Skript
// waehlt deshalb die window.open-Rueckfallebene — dieselbe, die Firefox und
// Safari bekommen. Der PiP-Zweig ist am 16.08.2026 im echten Chrome
// nachgewiesen worden (Auslagern, Anheften drueben, Loesen drueben,
// Zurueckholen ueber Kreuz und ueber den Platzhalter-Knopf).
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeMiningDomContext, flush } from './helpers/mining-dom.js';

const CODE = fs.readFileSync(path.resolve('assets/mining-workbench.js'), 'utf8');

async function boot(opts) {
  const ctx = makeMiningDomContext(opts);
  vm.runInContext(CODE, vm.createContext(ctx));
  await flush();
  return ctx;
}

/** Legt die Spalte ins Fremdfenster und gibt dessen Attrappe zurueck. */
async function auslagern(ctx) {
  ctx.fire(ctx.elements['wb-pop'], 'click');
  await flush();
  assert.equal(ctx.popWindows.length, 1, 'erwartet genau ein geoeffnetes Fremdfenster');
  return ctx.popWindows[0];
}

/* Der Anheft-Knopf eines Erzes, egal in welchem Dokument die Liste gerade
   steht. ⚠ Der Selektor MUSS den Wert mitnennen: matches() in
   helpers/dom-mock.js kennt nur `[attr='wert']`, ein blosses `[data-pin]`
   trifft dort nichts und gaebe still eine leere Liste. */
function pinKnopf(wurzel, name) {
  return wurzel.querySelectorAll(`[data-pin="${name}"]`)[0];
}

/** Heftet ein Erz ueber den Knopf auf seiner Kachel an (Spalte 1, in der Seite). */
function anheften(ctx, name) {
  const btn = pinKnopf(ctx.elements['wb-list'], name);
  assert.ok(btn, `Anheft-Knopf auf der Kachel "${name}" fehlt`);
  ctx.fire(btn, 'click');
}

function ersteMineralien(ctx, n) {
  return ctx.elements['wb-list'].querySelectorAll('.wb__tile')
    .slice(0, n).map((t) => t.getAttribute('data-min'));
}

test('P-01: der Knopf legt Presetzeile und beide Listen ins Fremdfenster', async () => {
  const ctx = await boot({});
  const body = ctx.elements['wb-pop-body'];
  assert.ok(ctx.document.getElementById('wb-pop-body'), 'vorher muss die Huelle in der Seite stehen');

  const w = await auslagern(ctx);

  assert.equal(ctx.document.getElementById('wb-pop-body'), null,
    'nach dem Auslagern darf die Seite die Huelle nicht mehr fuehren');
  assert.equal(w.document.getElementById('wb-pop-body'), body,
    'das Fremddokument muss die Huelle fuehren');
  assert.ok(w.document.getElementById('wb-pins'), 'die Signaturenliste muss mitgekommen sein');
  assert.ok(w.document.getElementById('wb-locpins'), 'die Fundort-Merkliste muss mitgekommen sein');
  assert.ok(w.document.getElementById('wb-preset-list'), 'die Presetzeile muss mitgekommen sein');

  // Der Riegel, gegen den inWb() prueft: ohne einen .wb-Vorfahren drueben
  // steigt jeder delegierte Handler dort sofort wieder aus.
  assert.ok(body.closest('.wb'), 'die Huelle braucht drueben einen .wb-Vorfahren');

  assert.equal(ctx.elements['wb-pop'].hidden, true, 'der Knopf gehoert waehrenddessen verborgen');
  assert.equal(ctx.elements['wb-pop-slot'].hidden, false, 'der Platzhalter gehoert sichtbar');
});

test('P-02: Anheften WAEHREND der Auslagerung schreibt in die ausgelagerte Liste', async () => {
  const ctx = await boot({});
  const [erstes, zweites] = ersteMineralien(ctx, 2);
  const w = await auslagern(ctx);

  // Der eigentliche Nachweis fuer den $()-Rueckfall: die Kachel steht in der
  // SEITE, die Liste im FREMDFENSTER. Faellt $() auf das Fremddokument nicht
  // zurueck, wirft renderPins() hier auf null.innerHTML.
  anheften(ctx, erstes);
  await flush();
  const liste = w.document.getElementById('wb-pins');
  assert.equal(liste.querySelectorAll('.wb__pin-item').length, 1,
    'ein Anheften aus der Seite muss in der ausgelagerten Liste ankommen');

  anheften(ctx, zweites);
  await flush();
  assert.equal(liste.querySelectorAll('.wb__pin-item').length, 2,
    'auch das zweite Anheften muss drueben ankommen');

  // Der Zaehler in der Ueberschrift laeuft ueber dieselbe Stelle.
  assert.match(w.document.getElementById('wb-pinsh').textContent, /2\s*$/,
    'der Zaehler in der ausgelagerten Ueberschrift muss mitziehen');
});

test('P-03: ein Klick IM Fremdfenster erreicht die delegierten Handler', async () => {
  const ctx = await boot({});
  const [erstes] = ersteMineralien(ctx, 1);
  anheften(ctx, erstes);
  await flush();

  const w = await auslagern(ctx);
  const liste = w.document.getElementById('wb-pins');
  const loesen = pinKnopf(liste, erstes);
  assert.ok(loesen, 'die ausgelagerte Zeile muss ihren Loesen-Knopf tragen');

  // Ausdruecklich UEBER das Fremdfenster ausgeloest, nicht ueber ctx.fire():
  // ctx.fire() bediente das Dokument der Seite und wuerde beweisen, was nicht
  // zu beweisen ist. Ereignisse steigen zwischen zwei Fenstern nicht auf.
  w.fireOn(loesen, 'click');
  await flush();
  assert.equal(liste.querySelectorAll('.wb__pin-item').length, 0,
    'der Loesen-Knopf im Fremdfenster muss wirken');
});

test('P-04: der Platzhalter-Knopf holt die Spalte zurueck, der Bestand ueberlebt', async () => {
  const ctx = await boot({});
  const [erstes] = ersteMineralien(ctx, 1);
  anheften(ctx, erstes);
  await flush();
  const w = await auslagern(ctx);

  ctx.fire(ctx.elements['wb-pop-back'], 'click');
  await flush();

  assert.ok(ctx.document.getElementById('wb-pop-body'), 'die Huelle muss wieder in der Seite stehen');
  assert.equal(ctx.elements['wb-pop-body'].parentNode, ctx.elements['wb-pop-slot'].parentNode,
    'sie gehoert zurueck in dieselbe Spalte wie Knopf und Platzhalter');
  assert.equal(ctx.elements['wb-pop'].hidden, false, 'der Knopf gehoert wieder sichtbar');
  assert.equal(ctx.elements['wb-pop-slot'].hidden, true, 'der Platzhalter gehoert wieder verborgen');
  assert.equal(w.closed, true, 'das Fremdfenster gehoert geschlossen');
  assert.equal(ctx.document.getElementById('wb-pins').querySelectorAll('.wb__pin-item').length, 1,
    'das angeheftete Erz muss den Rueckweg ueberleben');
});

test('P-05: schliesst der Nutzer das Fenster selbst, kommt die Spalte ebenfalls zurueck', async () => {
  const ctx = await boot({});
  const w = await auslagern(ctx);

  w.close(); // entspricht dem Fensterkreuz — loest pagehide aus
  await flush();

  assert.ok(ctx.document.getElementById('wb-pop-body'),
    'pagehide des Fremdfensters muss die Huelle zurueckholen');
  assert.equal(ctx.elements['wb-pop'].hidden, false, 'der Knopf gehoert wieder sichtbar');
});

test('P-06: zweimal auslagern haengt die Handler nicht doppelt an', async () => {
  const ctx = await boot({});
  const [erstes] = ersteMineralien(ctx, 1);

  const w1 = await auslagern(ctx);
  ctx.fire(ctx.elements['wb-pop-back'], 'click');
  await flush();

  ctx.fire(ctx.elements['wb-pop'], 'click');
  await flush();
  assert.equal(ctx.popWindows.length, 2, 'der zweite Klick muss ein neues Fenster oeffnen');
  const w2 = ctx.popWindows[1];

  anheften(ctx, erstes);
  await flush();
  const liste = w2.document.getElementById('wb-pins');
  assert.equal(liste.querySelectorAll('.wb__pin-item').length, 1,
    'auch im zweiten Fenster muss das Anheften ankommen');

  // Ein einziger Klick drueben darf genau EINMAL wirken. Waeren die Handler
  // des ersten Fensters nie abgemeldet worden, liefe der Zweig doppelt und
  // das Erz waere nach dem Loesen sofort wieder angeheftet (oder umgekehrt).
  w2.fireOn(pinKnopf(liste, erstes), 'click');
  await flush();
  assert.equal(liste.querySelectorAll('.wb__pin-item').length, 0,
    'der Loesen-Knopf im zweiten Fenster muss genau einmal wirken');
  assert.equal(w1.closed, true, 'das erste Fenster darf nicht offen zurueckbleiben');
});

test('P-08: das Symbolsprite kommt als KOPIE mit, die Seite behaelt ihres', async () => {
  // Gemeldeter Fehler (Betreiber, 16.08.2026: „icons fehlen"): die drei
  // Preset-Knoepfe zeichnen ueber <use href="#wb-i-…">, und ein <use> loest
  // gegen sein EIGENES Dokument auf. Ohne Sprite drueben blieben drei leere
  // Kaesten stehen. Verschieben statt kopieren waere die falsche Abhilfe —
  // dann fehlten sie in der Seite, wo dieselben Kennungen die Nadeln der
  // mittleren Spalte speisen. Deshalb hier BEIDE Richtungen behauptet.
  const ctx = await boot({});
  const w = await auslagern(ctx);

  const drueben = w.document.querySelector('.wb__sprite');
  assert.ok(drueben, 'das Fremddokument braucht ein eigenes Sprite');
  const kennungen = drueben.querySelectorAll('symbol').map((s) => s.id).sort();
  assert.deepEqual(kennungen, ['wb-i-edit', 'wb-i-pin', 'wb-i-trash', 'wb-i-update'],
    'die Kopie muss alle Symbolkennungen tragen');

  assert.ok(ctx.document.querySelector('.wb__sprite'),
    'die Seite darf ihr Sprite dabei NICHT verlieren — dort haengen die Nadeln der mittleren Spalte daran');
});

test('P-07: blockiert der Browser das Fenster, bleibt die Spalte stehen', async () => {
  // window.open liefert null — genau das tut ein Popup-Blocker.
  const ctx = await boot({ noPopupWindow: true });
  ctx.fire(ctx.elements['wb-pop'], 'click');
  await flush();

  assert.ok(ctx.document.getElementById('wb-pop-body'),
    'ohne Fenster darf die Huelle die Spalte nicht verlassen');
  assert.equal(ctx.elements['wb-pop'].hidden, false, 'der Knopf gehoert sichtbar zu bleiben');
  assert.equal(ctx.elements['wb-pop-slot'].hidden, true, 'kein Platzhalter ohne Fenster');
  assert.equal(ctx.elements['wb-pre-msg'].hidden, false,
    'der Nutzer muss erfahren, dass der Browser das Fenster geblockt hat');
});
