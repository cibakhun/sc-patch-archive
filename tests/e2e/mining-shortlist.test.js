// Automatisierter Rundlauf-Nachweis der Mining-Werkbank-Fundort-Merkliste
// (Phase 9, Plan 01 Task 2 + Plan 02 Task 1) — deckt D-04, D-05, D-06, D-07,
// O-2, O-3, T-09-01 und T-09-07 ab.
//
// Warum ueberhaupt: die haertere Anforderung dieser Phase ist die
// verlustfreie Migration des Preset-Altbestands (D-04), nicht die Optik.
// Ein manueller Blick ins Browser-Fenster kann nicht beweisen, dass ein
// Preset OHNE `locations`-Feld weiterhin ladbar bleibt, dass ein Paar den
// Rundlauf Speichern -> Laden -> Anwenden ueberlebt, oder dass ein
// Fundort-Paar niemals in die Signaturenliste faellt. Dieser Test fuehrt das
// ECHTE assets/mining-workbench.js in einem node:vm-Kontext gegen ein
// steuerbares Mock-DOM aus (tests/e2e/helpers/mining-dom.js) und behauptet
// genau diese Zusagen als node:test-Faelle.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeMiningDomContext, flush } from './helpers/mining-dom.js';

const SCRIPT_PATH = path.resolve('assets/mining-workbench.js');
const CODE = fs.readFileSync(SCRIPT_PATH, 'utf8');

function run(opts) {
  const ctx = makeMiningDomContext(opts);
  vm.runInContext(CODE, vm.createContext(ctx));
  return ctx;
}

async function runAsync(opts) {
  const ctx = run(opts);
  await flush();
  return ctx;
}

function selectMineral(ctx, name) {
  const tile = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile')
    .find((t) => t.getAttribute('data-min') === name);
  assert.ok(tile, `Kachel fuer "${name}" nicht im Mock-DOM gefunden`);
  ctx.fire(tile, 'click');
}

/** Die Preset-Zeile mit passendem data-preset in #wb-preset-list, oder null
 *  (Phase 10, Plan 01, D-05: Liste statt <select>). Gesucht ueber die
 *  Zeilenklasse .wb__pre-item, nicht ueber einen Attributselektor -- der
 *  Mock-Parser in dom-mock.js kennt keine wertlosen "[attr]"-Selektoren
 *  (siehe Kopfkommentar mining-dom.js Punkt 1). */
function presetRow(ctx, name) {
  return ctx.document.getElementById('wb-preset-list').querySelectorAll('.wb__pre-item')
    .find((row) => row.getAttribute('data-preset') === name) || null;
}

/** Klick auf die Namensflaeche einer Preset-Zeile -- der Ersatz fuer das
 *  fruehere `ctx.elements['wb-preset'].value = name` (D-05). Bauplan:
 *  selectMineral() oben. */
function selectPreset(ctx, name) {
  const row = presetRow(ctx, name);
  assert.ok(row, `Preset-Zeile fuer "${name}" nicht im Mock-DOM gefunden`);
  const btn = row.querySelector('.wb__pre-name');
  assert.ok(btn, `Auswahlknopf in der Preset-Zeile "${name}" nicht gefunden`);
  ctx.fire(btn, 'click');
}

/** Der Umbenennen-Knopf (Stift) einer Preset-Zeile. Ueber das Attribut
 *  gefiltert statt per Reihenfolge -- Task 3 fuegt einen weiteren Knopf mit
 *  derselben Klasse .wb__pre-a VOR dem Stift ein (Ueberschreiben). */
function renameBtn(ctx, name) {
  const row = presetRow(ctx, name);
  if (!row) return null;
  return row.querySelectorAll('.wb__pre-a').find((b) => b.getAttribute('data-pre-rename') !== null) || null;
}

/** Der Loeschknopf (Muelleimer) einer Preset-Zeile (Phase 10, Plan 01, Task 2, D-01). */
function deleteBtn(ctx, name) {
  const row = presetRow(ctx, name);
  return row ? row.querySelector('.wb__pre-a--del') : null;
}

/** Die beschriftete Rueckfrage-Schaltflaeche, sobald sie fuer diese Zeile steht (sonst null). */
function askBtn(ctx, name) {
  const row = presetRow(ctx, name);
  return row ? row.querySelector('.wb__pre-ask') : null;
}

/** Der Ueberschreiben-Knopf (Ablage-Pfeil) einer Preset-Zeile (Phase 10, Plan 01, Task 3, D-02 Form 2). */
function updateBtn(ctx, name) {
  const row = presetRow(ctx, name);
  if (!row) return null;
  return row.querySelectorAll('.wb__pre-a').find((b) => b.getAttribute('data-pre-update') !== null) || null;
}

/** Die Zaehlzeile, zugleich der Aufklapp-Griff (D-02 Form 3). */
function openBtn(ctx, name) {
  const row = presetRow(ctx, name);
  return row ? row.querySelector('.wb__pre-cnt') : null;
}

/** Die aufgeklappte Ansicht einer Preset-Zeile, oder null, solange sie zu ist. */
function entryBody(ctx, name) {
  const row = presetRow(ctx, name);
  return row ? row.querySelector('.wb__pre-body') : null;
}

/** Der Entfernen-Knopf eines einzelnen Erzes in der aufgeklappten Ansicht. */
function rmMinBtn(ctx, name, mineral) {
  const body = entryBody(ctx, name);
  if (!body) return null;
  return body.querySelectorAll('button').find((b) => b.getAttribute('data-pre-rmmin') === mineral) || null;
}

/** Der Entfernen-Knopf eines einzelnen Fundort-Paares in der aufgeklappten Ansicht. */
function rmLocBtn(ctx, name, pair) {
  const body = entryBody(ctx, name);
  if (!body) return null;
  return body.querySelectorAll('button').find((b) => b.getAttribute('data-pre-rmloc') === pair) || null;
}

function tilePinBtn(ctx, name) {
  const tile = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile')
    .find((t) => t.getAttribute('data-min') === name);
  return tile ? tile.querySelector('.wb__pin') : null;
}

/** Der Nadelknopf einer Fundort-Zeile in #wb-locs, gefunden ueber den
 *  entschluesselten data-locpin-Wert (nicht ueber CSS-Attributselektoren --
 *  die traegt der Mock-Parser nicht, siehe mining-dom.js Kopfkommentar). */
function locPinBtn(ctx, ore, loc) {
  const key = `${ore}||${loc}`;
  return ctx.document.getElementById('wb-locs').querySelectorAll('.wb__lpin')
    .find((b) => b.getAttribute('data-locpin') === key) || null;
}

function realLocOf(ctx, ore) {
  const loc = ctx.byName[ore].locs.find((l) => l.p !== ctx.SPECIAL_LOC);
  assert.ok(loc, `Erz "${ore}" hat im Testbestand keinen echten Fundort`);
  return loc.p;
}

/** Zweitgeschrieben aus nPct() in assets/mining-workbench.js (payload.lang ist
 *  in mining-dom.js immer 'de') -- derselbe Rundungs- und Komma-Weg, damit der
 *  erwartete Text hier unabhaengig von der Produktionsfunktion entsteht. */
function nPctForTest(v) {
  return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',');
}

/** Sammelt bis zu `limit` echte, in `ctx.byName` verankerte Fundort-Paare (nie
 *  den synthetischen T-09-01-Sonderfundort) — fuer die 128er-Grenzprobe (T-09-07). */
function collectRealPairs(ctx, limit) {
  const out = [];
  for (const name in ctx.byName) {
    const m = ctx.byName[name];
    for (let i = 0; i < m.locs.length && out.length < limit; i++) {
      if (m.locs[i].p === ctx.SPECIAL_LOC) continue;
      out.push(`${name}||${m.locs[i].p}`);
    }
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------
// Phase 12, Plan 01, Task 1 — Fundort-Ansicht: Zeilen/Kopf finden, echte
// Fundorte mit bestimmten Eigenschaften aus dem Testbestand ziehen statt sie
// zu erfinden.
// ---------------------------------------------------------------------

/** Eine Fundort-Zeile in #wb-locs, gefunden ueber den entschluesselten
 *  data-loc-Wert (nicht ueber CSS-Attributselektoren mit Sonderzeichen --
 *  derselbe Grund wie bei locPinBtn() oben). */
function locRow(ctx, loc) {
  return ctx.document.getElementById('wb-locs').querySelectorAll('.wb__row2')
    .find((row) => row.getAttribute('data-loc') === loc) || null;
}

/** Eine Erzzeile INNERHALB der geoeffneten Fundort-Ansicht (#wb-locview),
 *  gefunden ueber den entschluesselten data-ore-Wert -- Phase 12, Plan 02,
 *  Task 1 (D-02). */
function oreRow(ctx, name) {
  return ctx.document.getElementById('wb-locview').querySelectorAll('.wb__row2')
    .find((row) => row.getAttribute('data-ore') === name) || null;
}

/** Eine Merklistenzeile in #wb-locpins, gefunden ueber den entschluesselten
 *  data-loc-Wert -- Phase 12, Plan 02, Task 2 (D-03). */
function locPinRow(ctx, loc) {
  return ctx.document.getElementById('wb-locpins').querySelectorAll('.wb__pin-item')
    .find((row) => row.getAttribute('data-loc') === loc) || null;
}

/** Eine Kachel in Spalte 1, gefunden ueber data-min -- wie selectMineral()
 *  oben, aber ohne den Klick zu feuern (Phase 12, Plan 02, Task 3, D-09). */
function tileByName(ctx, name) {
  return ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile')
    .find((t) => t.getAttribute('data-min') === name) || null;
}

/** Zweitgeschrieben aus locIndex in assets/mining-workbench.js -- fuer
 *  Testzwecke, um reale Fundorte mit bestimmten Eigenschaften (mehrere Erze,
 *  mehrere Methoden, Spuren gemischt mit Vollzeilen) im Mock-Bestand zu
 *  FINDEN statt sie zu erfinden. Der synthetische SPECIAL_LOC bleibt aussen
 *  vor, wie bei collectRealPairs() oben. */
function buildLocIndexForTest(ctx) {
  const idx = {};
  for (const name in ctx.byName) {
    const m = ctx.byName[name];
    for (const l of m.locs) {
      if (l.p === ctx.SPECIAL_LOC) continue;
      (idx[l.p] || (idx[l.p] = [])).push(Object.assign({ n: name }, l));
    }
  }
  return idx;
}

function methodGroupCount(entries) {
  const seen = new Set();
  for (const e of entries) seen.add(e.mi === 'ship' ? 'ship' : (e.mi === 'roc' ? 'roc' : 'hand'));
  return seen.size;
}

/** Der Fundort mit den meisten Erzen im Mock-Payload (auch fuer T-12-09
 *  wiederverwendet). */
function biggestLoc(ctx) {
  const idx = buildLocIndexForTest(ctx);
  let best = null;
  for (const p in idx) if (!best || idx[p].length > idx[best].length) best = p;
  return { name: best, entries: idx[best] };
}

/** Ein Fundort mit GENAU n Methodengruppen (D-05: 1 oder 3, nie 2). */
function findLocWithGroups(ctx, n) {
  const idx = buildLocIndexForTest(ctx);
  for (const p in idx) if (methodGroupCount(idx[p]) === n) return { name: p, entries: idx[p] };
  return null;
}

/** Ein Fundort, der sowohl eine Spurenzeile (Hoechstanteil <= 10) als auch
 *  eine Vollzeile (> 10) traegt -- fuer T-12-06 (D-07). */
function findLocWithTraceAndFull(ctx) {
  const idx = buildLocIndexForTest(ctx);
  for (const p in idx) {
    const hasTrace = idx[p].some((e) => (e.ms || 0) <= 10);
    const hasFull = idx[p].some((e) => (e.ms || 0) > 10);
    if (hasTrace && hasFull) return { name: p, entries: idx[p] };
  }
  return null;
}

function newPreset(ctx, name) {
  ctx.fire(ctx.elements['wb-pre-new'], 'click');
  ctx.elements['wb-pre-name'].value = name;
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
}

function lastPostBody(ctx) {
  const posts = ctx.account.calls.filter((c) => c.method === 'POST');
  assert.ok(posts.length, 'kein POST-Aufruf protokolliert');
  return posts[posts.length - 1];
}

function lastPatchCall(ctx) {
  const patches = ctx.account.calls.filter((c) => c.method === 'PATCH');
  assert.ok(patches.length, 'kein PATCH-Aufruf protokolliert');
  return patches[patches.length - 1];
}

function countCalls(ctx, method) {
  return ctx.account.calls.filter((c) => c.method === method).length;
}

// ---------------------------------------------------------------------
// D-04: ein VOR dieser Phase gespeichertes Preset laedt weiterhin.
// ---------------------------------------------------------------------

test('Preset in der alten Form (kein locations-Feld) laedt: Signaturen vollstaendig, Merkliste leer, kein Fehler', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'Alt', minerals: ['Gold'] }] } });

  const names = ctx.document.getElementById('wb-preset-list').querySelectorAll('.wb__pre-item')
    .map((row) => row.getAttribute('data-preset'));
  assert.ok(names.includes('Alt'), `Preset "Alt" steht nicht in der Liste (gefunden: ${names.join(', ')})`);

  selectPreset(ctx, 'Alt');

  assert.match(
    ctx.document.getElementById('wb-pins').textContent,
    /Gold/,
    'Signaturenliste sollte Gold aus dem Altbestand zeigen'
  );
  assert.strictEqual(
    ctx.document.getElementById('wb-locpins').textContent,
    ctx.T.locPinsEmpty,
    'Merkliste sollte fuer ein Preset ohne locations-Feld leer sein, nicht abstuerzen'
  );
});

test('Preset mit locations: null verhaelt sich wie ein Preset ohne das Feld', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'AltNull', minerals: ['Gold'], locations: null }] } });

  selectPreset(ctx, 'AltNull');

  assert.match(ctx.document.getElementById('wb-pins').textContent, /Gold/);
  assert.strictEqual(ctx.document.getElementById('wb-locpins').textContent, ctx.T.locPinsEmpty);
});

// ---------------------------------------------------------------------
// D-05/D-06: Fundort anheften -> Rundlauf in die Merkliste.
// ---------------------------------------------------------------------

test('Fundort anheften traegt das Paar in die Merkliste als "Erz — Fundort"', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Gold');

  selectMineral(ctx, 'Gold');
  const btn = locPinBtn(ctx, 'Gold', loc);
  assert.ok(btn, `Nadelknopf fuer Gold@${loc} nicht gefunden`);
  ctx.fire(btn, 'click');

  const box = ctx.document.getElementById('wb-locpins');
  assert.strictEqual(box.querySelectorAll('.wb__pin-item').length, 1, 'erwartet genau einen Eintrag in der Merkliste');
  assert.match(box.textContent, /Gold/);
  assert.match(box.textContent, new RegExp(loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const fresh = locPinBtn(ctx, 'Gold', loc);
  assert.strictEqual(fresh.getAttribute('aria-pressed'), 'true', 'Nadel sollte nach dem Anheften aria-pressed=true tragen');
  assert.ok(fresh.classList.contains('is-on'), 'Nadel sollte nach dem Anheften .is-on tragen');
});

// ---------------------------------------------------------------------
// D-04/D-07: ein Preset traegt Signaturen UND Fundort-Paare, ein Wechsel
// tauscht die Merkliste, statt sie aufzusummieren.
// ---------------------------------------------------------------------

test('Preset speichern: POST traegt on_conflict + Prefer + BEIDE Listen im Rumpf', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Quantainium');

  selectMineral(ctx, 'Quantainium');
  ctx.fire(tilePinBtn(ctx, 'Quantainium'), 'click'); // Signatur anheften
  ctx.fire(locPinBtn(ctx, 'Quantainium', loc), 'click'); // Fundort anheften

  newPreset(ctx, 'Rundlauf-Preset');
  await flush();

  const post = lastPostBody(ctx);
  assert.strictEqual(post.path, 'mining_sig_presets?on_conflict=user_id,name');
  assert.strictEqual(post.prefer, 'resolution=merge-duplicates,return=minimal');
  assert.strictEqual(post.body.length, 1);
  assert.strictEqual(post.body[0].name, 'Rundlauf-Preset');
  // Array.from(): post.body[] entstand IM vm-Kontext, sein Array-Prototyp ist
  // damit ein anderer als der dieser Datei -- assert.deepStrictEqual scheitert
  // sonst an der Realm-Grenze, obwohl der Inhalt gleich ist. Array.from()
  // baut das Array im Realm dieser Datei neu, der eigentliche Vergleich
  // bleibt unveraendert streng.
  assert.deepStrictEqual(Array.from(post.body[0].minerals), ['Quantainium']);
  assert.deepStrictEqual(Array.from(post.body[0].locations), [`Quantainium||${loc}`]);
});

test('Merkliste leeren, dasselbe Preset erneut waehlen -> das Paar ist wieder da (D-07)', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Quantainium');

  selectMineral(ctx, 'Quantainium');
  ctx.fire(locPinBtn(ctx, 'Quantainium', loc), 'click');
  newPreset(ctx, 'Zweiter-Rundlauf');
  await flush();

  // Merkliste leeren: dieselbe Nadel noch einmal druecken.
  ctx.fire(locPinBtn(ctx, 'Quantainium', loc), 'click');
  assert.strictEqual(
    ctx.document.getElementById('wb-locpins').textContent,
    ctx.T.locPinsEmpty,
    'Vorbedingung: Merkliste sollte nach dem zweiten Klick leer sein'
  );

  // Dasselbe Preset erneut waehlen.
  selectPreset(ctx, 'Zweiter-Rundlauf');

  const box = ctx.document.getElementById('wb-locpins');
  assert.strictEqual(box.querySelectorAll('.wb__pin-item').length, 1, 'das Paar sollte nach erneutem Waehlen wieder da sein');
  assert.match(box.textContent, /Quantainium/);
});

test('Preset A und Preset B im Wechsel: die Merkliste zeigt je Wechsel genau die Paare DIESES Presets, nie die Vereinigung', async () => {
  // Kurzlebiger Sondier-Kontext nur, um zwei echte Fundortnamen zu kennen,
  // bevor die eigentlichen Preset-Zeilen feststehen -- verworfen danach.
  const probe = run({ account: { rows: [] } });
  const quantLoc = realLocOf(probe, 'Quantainium');
  const goldLoc = realLocOf(probe, 'Gold');

  const ctx = await runAsync({
    account: {
      rows: [
        { name: 'A', minerals: [], locations: [`Quantainium||${quantLoc}`] },
        { name: 'B', minerals: [], locations: [`Gold||${goldLoc}`] },
      ],
    },
  });

  selectPreset(ctx, 'A');
  let box = ctx.document.getElementById('wb-locpins');
  assert.strictEqual(box.querySelectorAll('.wb__pin-item').length, 1, 'Preset A sollte genau einen Eintrag zeigen');
  assert.match(box.textContent, /Quantainium/);
  assert.doesNotMatch(box.textContent, /Gold/, 'Preset A darf Golds Paar nicht zeigen (keine Vereinigung)');

  selectPreset(ctx, 'B');
  box = ctx.document.getElementById('wb-locpins');
  assert.strictEqual(box.querySelectorAll('.wb__pin-item').length, 1, 'Preset B sollte genau einen Eintrag zeigen');
  assert.match(box.textContent, /Gold/);
  assert.doesNotMatch(box.textContent, /Quantainium/, 'Preset B darf Quantainiums Paar nicht zeigen (keine Vereinigung)');
});

// ---------------------------------------------------------------------
// D-05, Nebenbedingung 2: kein Nadelknopf in der Stationsliste, keiner bei
// Erzen ohne Fundorte (O-2).
// ---------------------------------------------------------------------

test('Erz MIT Fundorten: #wb-locs traegt Nadelknoepfe, #wb-refs traegt keinen einzigen', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, 'Quantainium');

  const locPins = ctx.document.getElementById('wb-locs').querySelectorAll('.wb__lpin');
  const refPins = ctx.document.getElementById('wb-refs').querySelectorAll('.wb__lpin');
  assert.ok(locPins.length > 0, 'erwartet mindestens einen Nadelknopf in #wb-locs');
  assert.strictEqual(refPins.length, 0, '#wb-refs (Beste Stationen) darf keinen Nadelknopf tragen');
});

test('Carinite (ohne Fundorte, O-2): #wb-locs traegt null Nadelknoepfe und die Meldung "keine Fundorte"', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  assert.strictEqual(ctx.byName.Carinite.locs.length, 0, 'Vorbedingung: Carinite sollte im Testbestand fundortlos sein');

  selectMineral(ctx, 'Carinite');

  const box = ctx.document.getElementById('wb-locs');
  assert.strictEqual(box.querySelectorAll('.wb__lpin').length, 0);
  assert.strictEqual(box.textContent, ctx.T.noLocs);
});

// ---------------------------------------------------------------------
// Ein Paar, dessen Erz oder Fundort ein Patch entfernt hat, faellt beim
// Laden still heraus statt die Liste zu vergiften.
// ---------------------------------------------------------------------

test('ein Paar mit unbekanntem Erz ODER unbekanntem Fundort faellt beim Laden still heraus', async () => {
  const probe = run({ account: { rows: [] } });
  const quantLoc = realLocOf(probe, 'Quantainium');

  const ctx = await runAsync({
    account: {
      rows: [{
        name: 'Mix', minerals: [],
        locations: [`Quantainium||${quantLoc}`, 'Quantainium||Ort-den-es-nicht-gibt', 'Geistererz||Irgendwo'],
      }],
    },
  });

  selectPreset(ctx, 'Mix');

  const box = ctx.document.getElementById('wb-locpins');
  assert.strictEqual(box.querySelectorAll('.wb__pin-item').length, 1, 'nur das gueltige Paar sollte uebrig bleiben');
  assert.match(box.textContent, /Quantainium/);
  assert.doesNotMatch(box.textContent, /Ort-den-es-nicht-gibt/);
  assert.doesNotMatch(box.textContent, /Geistererz/);
});

// ---------------------------------------------------------------------
// T-09-01: ein Fundortname mit HTML-Sonderzeichen landet escaped im Markup.
// ---------------------------------------------------------------------

test('T-09-01: ein Fundortname mit HTML-Sonderzeichen landet escaped im Markup (kein injiziertes Element, voller Text erhalten)', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, 'Gold');

  const btn = locPinBtn(ctx, 'Gold', ctx.SPECIAL_LOC);
  assert.ok(btn, 'Nadelknopf fuer den synthetischen Sonderzeichen-Fundort nicht gefunden');
  ctx.fire(btn, 'click');

  // War der Text NICHT escaped, haette der Mock-HTML-Parser das eingebettete
  // "<Danger>" als eigenes Element interpretiert (er sucht nach '<' als
  // Tag-Anfang) -- ein Fund hier waere der Beweis einer Injektionsluecke.
  const locsBox = ctx.document.getElementById('wb-locs');
  assert.strictEqual(locsBox.querySelectorAll('danger').length, 0, 'unescapter Text haette ein <danger>-Element erzeugt (#wb-locs)');

  const shortlistBox = ctx.document.getElementById('wb-locpins');
  assert.strictEqual(shortlistBox.querySelectorAll('danger').length, 0, 'unescapter Text haette ein <danger>-Element erzeugt (#wb-locpins)');

  const nameSpan = shortlistBox.querySelector('.nm');
  assert.ok(nameSpan, 'Name-Spanne in der Merkliste nicht gefunden');
  // dom-mock.js bildet Text IMMER als eigenes #TEXT-Kindelement ab (so
  // repraesentiert dieser Mock Textknoten) -- "kein verschachteltes Element"
  // heisst hier: jedes Kind ist #TEXT, keines traegt einen echten Tag-Namen
  // (der bei unescapetem "<Danger>" entstanden waere).
  assert.ok(
    nameSpan.children.every((c) => c.tagName === '#TEXT'),
    `die Name-Spanne sollte nur Textknoten tragen, gefunden: ${nameSpan.children.map((c) => c.tagName).join(', ')}`
  );
  assert.strictEqual(nameSpan.textContent, `Gold — ${ctx.SPECIAL_LOC}`, 'der volle Originaltext sollte nach dem Escape/Decode-Rundlauf erhalten sein');

  // Das Anfuehrungszeichen im Fundortnamen ist die haerteste Probe: blieb es
  // beim Rendern unescaped, waere der Attributwert beim Zurueckparsen am
  // ersten rohen '"' abgeschnitten -- der volle Schluessel kaeme nicht zurueck.
  const freshBtn = locPinBtn(ctx, 'Gold', ctx.SPECIAL_LOC);
  assert.ok(freshBtn, 'Nadelknopf nach dem Anheften nicht mehr auffindbar (Attributwert vermutlich abgeschnitten)');
  assert.strictEqual(freshBtn.getAttribute('data-locpin'), `Gold||${ctx.SPECIAL_LOC}`);
});

// ---------------------------------------------------------------------
// Phase 9, Plan 02, Task 1 — O-3: Werte je Eintrag aus dem Katalog.
// ---------------------------------------------------------------------

test('Merklisten-Eintrag zeigt System, Chance, Hoechstanteil und Ø-Anteil aus dem Katalog, nicht aus dem gespeicherten Paar (O-3, T-09-06)', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Quantainium');
  const cat = ctx.byName.Quantainium.locs.find((l) => l.p === loc);
  assert.ok(cat, 'Katalog-Eintrag fuer Quantainium/loc nicht gefunden');

  selectMineral(ctx, 'Quantainium');
  ctx.fire(locPinBtn(ctx, 'Quantainium', loc), 'click');

  const box = ctx.document.getElementById('wb-locpins');
  const meta = box.querySelector('.wb__lmeta');
  assert.ok(meta, 'erwartet eine Wertezeile (.wb__lmeta) im Merklisten-Eintrag');

  /* Seit 15.08.2026 anders aufgeteilt: die <em> traegt die RANGBILDENDE Zahl (`ef`,
     dieselbe, die den Balken zeichnet), damit die Liste sichtbar der Ordnung folgt,
     der sie gehorcht; Chance und Hoechstanteil stehen in der <span> neben dem System.
     Vorher standen ch/ms rechts, sortiert wurde nach ef — die Liste sah dadurch
     unsortiert aus (Silicon: 69,5 → 36 → 36 → 51,5 %). Geprueft bleibt, worum es
     dem Test geht: JEDER Wert stammt aus dem Katalog, keiner aus dem Paar. */
  const sysSpan = meta.querySelector('span');
  assert.ok(sysSpan, 'Wertezeile sollte Ortsart, System und Detailwerte in einer <span> tragen');
  /* Die Ortsart steht seit 15.08. vorn: ohne sie sahen Guertel und Planet in
     derselben Liste gleich aus, obwohl es zwei Anflugarten sind. Auch sie kommt
     aus dem Katalog (cat.t), nicht aus dem gespeicherten Paar. */
  const TYPE_LBL = { planet: 'tPlanet', moon: 'tMoon', belt: 'tBelt', lagrange: 'tLagrange', cluster: 'tCluster', cave: 'tCave', event: 'tEvent', special: 'tSpecial' };
  const art = TYPE_LBL[cat.t] ? ctx.T[TYPE_LBL[cat.t]] : null;
  const ort = art ? `${art} · ${cat.s}` : cat.s;
  const teile = [];
  if (cat.ch != null) teile.push(`${nPctForTest(cat.ch)} % ${ctx.T.chance}`);
  if (cat.ms != null) teile.push(`${ctx.T.upTo} ${nPctForTest(cat.ms)} %`);
  assert.strictEqual(sysSpan.textContent, teile.length ? `${ort} · ${teile.join(' · ')}` : ort);

  const valuesEm = meta.querySelector('em');
  assert.ok(valuesEm, 'Wertezeile sollte die rangbildende Zahl in einer <em> tragen');
  const expected = cat.ef != null ? `${nPctForTest(cat.ef)} %`
    : cat.ch != null ? `${nPctForTest(cat.ch)} %` : '—';
  assert.strictEqual(valuesEm.textContent, expected);
});

// ---------------------------------------------------------------------
// Phase 9, Plan 02, Task 1 — Loesen an beiden Enden (D-05/D-06).
// ---------------------------------------------------------------------

test('Loesen ueber den ×-Knopf in der Merkliste raeumt auch das is-on der Nadel in der Fundort-Zeile ab', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');
  ctx.fire(locPinBtn(ctx, 'Gold', loc), 'click');

  const pinnedFirst = locPinBtn(ctx, 'Gold', loc);
  assert.ok(pinnedFirst.classList.contains('is-on'), 'Vorbedingung: Nadel sollte nach dem Anheften is-on tragen');

  const box = ctx.document.getElementById('wb-locpins');
  // Tag-Selektor statt Attributselektor: der Mock-Parser aus dom-mock.js traegt
  // keine "[attr]"-Selektoren ohne Wert (siehe Kopfkommentar mining-dom.js Punkt 1);
  // "button" trifft ueber die Regex-Gruppe fuer Tag-Namen zuverlaessig.
  const xBtn = box.querySelector('button');
  assert.ok(xBtn, 'Loesch-Knopf in der Merkliste nicht gefunden');
  assert.strictEqual(xBtn.getAttribute('data-locpin'), `Gold||${loc}`, 'derselbe Schluessel wie die Nadel');
  ctx.fire(xBtn, 'click');

  assert.strictEqual(
    ctx.document.getElementById('wb-locpins').textContent,
    ctx.T.locPinsEmpty,
    'Merkliste sollte nach dem Loesen ueber den x-Knopf leer sein'
  );
  const freshPin = locPinBtn(ctx, 'Gold', loc);
  assert.ok(freshPin, 'Nadel sollte nach dem Loesen weiterhin auffindbar sein');
  assert.ok(!freshPin.classList.contains('is-on'), 'Nadel sollte NICHT mehr is-on tragen');
  assert.strictEqual(freshPin.getAttribute('aria-pressed'), 'false');
});

test('ein angeheftetes Paar bleibt in der Merkliste stehen, wenn ein ANDERES Erz gewaehlt wird (D-06)', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Quantainium');
  selectMineral(ctx, 'Quantainium');
  ctx.fire(locPinBtn(ctx, 'Quantainium', loc), 'click');

  selectMineral(ctx, 'Gold');

  const box = ctx.document.getElementById('wb-locpins');
  assert.strictEqual(box.querySelectorAll('.wb__pin-item').length, 1, 'das Paar sollte nach dem Erzwechsel weiterhin stehen');
  assert.match(box.textContent, /Quantainium/);
});

// ---------------------------------------------------------------------
// Phase 9, Plan 02, Task 1 — Grenze mit Ansage (T-09-07).
// ---------------------------------------------------------------------

test('Merkliste bei 128 Paaren voll: ein weiteres Anheften wird abgewiesen und ueber #wb-pre-msg gemeldet (T-09-07)', async () => {
  const probe = run({ account: { rows: [] } });
  const pairs = collectRealPairs(probe, 128);
  assert.strictEqual(pairs.length, 128, `Testbestand sollte mindestens 128 echte Paare liefern (gefunden: ${pairs.length})`);

  const ctx = await runAsync({ account: { rows: [{ name: 'Voll', minerals: [], locations: pairs }] } });
  selectPreset(ctx, 'Voll');

  const before = ctx.document.getElementById('wb-locpins').querySelectorAll('.wb__pin-item').length;
  assert.strictEqual(before, 128, 'Vorbedingung: Merkliste sollte 128 Eintraege zeigen');

  // Ein Paar, das NICHT in `pairs` steckt -- durchsucht denselben Bestand wie
  // collectRealPairs(), nur weiter, bis eines uebrig bleibt.
  let extra = null;
  for (const name in ctx.byName) {
    const m = ctx.byName[name];
    for (let i = 0; i < m.locs.length && !extra; i++) {
      if (m.locs[i].p === ctx.SPECIAL_LOC) continue;
      const key = `${name}||${m.locs[i].p}`;
      if (!pairs.includes(key)) extra = { ore: name, loc: m.locs[i].p };
    }
    if (extra) break;
  }
  assert.ok(extra, 'kein ungenutztes Paar fuer die Grenzprobe gefunden');

  selectMineral(ctx, extra.ore);
  const btn = locPinBtn(ctx, extra.ore, extra.loc);
  assert.ok(btn, `Nadelknopf fuer ${extra.ore}@${extra.loc} nicht gefunden`);
  ctx.fire(btn, 'click');

  const after = ctx.document.getElementById('wb-locpins').querySelectorAll('.wb__pin-item').length;
  assert.strictEqual(after, 128, 'Merkliste sollte bei 128 Paaren nicht weiter wachsen');
  assert.ok(!btn.classList.contains('is-on'), 'die abgewiesene Nadel sollte nicht is-on tragen');

  const msg = ctx.document.getElementById('wb-pre-msg');
  assert.strictEqual(msg.hidden, false, 'Meldungszeile sollte nach der Abweisung sichtbar sein');
  assert.strictEqual(msg.textContent, ctx.T.locPinsFull);
});

// ---------------------------------------------------------------------
// Phase 9, Plan 02, Task 1 — Zaehler in der Reiter-Beschriftung.
// Phase 10, Plan 02, Task 1 — der Traeger wechselt von der Reiter-
// Beschriftung (wb-tab-loc, jetzt entfallen) zur eigenen Ueberschrift der
// gestapelten Merkliste (wb-lpinsh, D-03); die geprueft Anforderung bleibt
// woertlich dieselbe: die Zahl erscheint erst ab einem Eintrag.
// ---------------------------------------------------------------------

test('Ueberschrift der Fundort-Merkliste nennt die Zahl der Paare erst, sobald welche da sind', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const head = ctx.elements['wb-lpinsh'];
  assert.ok(head, 'wb-lpinsh nicht im Mock-DOM registriert');
  assert.strictEqual(head.textContent, ctx.T.locations, 'ohne Eintraege traegt die Ueberschrift nur die Beschriftung');

  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');
  ctx.fire(locPinBtn(ctx, 'Gold', loc), 'click');

  assert.strictEqual(head.textContent, `${ctx.T.locations} · 1`);

  ctx.fire(locPinBtn(ctx, 'Gold', loc), 'click');
  assert.strictEqual(head.textContent, ctx.T.locations, 'nach dem Loesen des letzten Eintrags nur noch die Beschriftung');
});

// ---------------------------------------------------------------------
// Phase 10, Plan 02, Task 1 — beide Listen stehen gleichzeitig sichtbar
// (D-03): keine der beiden traegt mehr `hidden`, beide sind ueber ihre id
// auffindbar, und die Signaturen-Ueberschrift traegt denselben Zaehler wie
// die Merklisten-Ueberschrift (nur fuer angeheftete Erze statt Fundorte).
// ---------------------------------------------------------------------

test('Signaturenliste und Fundort-Merkliste sind nach dem Zeichnen beide vorhanden, keine traegt hidden', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const pins = ctx.elements['wb-pins'];
  const locpins = ctx.elements['wb-locpins'];
  assert.ok(pins, 'wb-pins nicht im Mock-DOM registriert');
  assert.ok(locpins, 'wb-locpins nicht im Mock-DOM registriert');
  assert.notStrictEqual(pins.hidden, true, 'Signaturenliste sollte nicht hidden sein');
  assert.notStrictEqual(locpins.hidden, true, 'Fundort-Merkliste sollte nicht hidden sein');
});

test('Ueberschrift der Signaturenliste nennt die Zahl der angehefteten Erze erst, sobald welche da sind, und wieder nicht nach dem letzten Loesen', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const head = ctx.elements['wb-pinsh'];
  assert.ok(head, 'wb-pinsh nicht im Mock-DOM registriert');
  assert.strictEqual(head.textContent, ctx.T.signatures, 'ohne angeheftete Erze traegt die Ueberschrift nur die Beschriftung');

  const btn = tilePinBtn(ctx, 'Gold');
  ctx.fire(btn, 'click');
  assert.strictEqual(head.textContent, `${ctx.T.signatures} · 1`);

  ctx.fire(btn, 'click');
  assert.strictEqual(head.textContent, ctx.T.signatures, 'nach dem Loesen des letzten Erzes nur noch die Beschriftung');
});

test('Ein angeheftetes Erz erzeugt so viele Vielfachen-Felder wie seine Seltenheit erlaubt, keines mit Hervorhebungsklasse', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const gold = ctx.byName['Gold'];
  assert.ok(gold && gold.sig, 'Vorbedingung: Gold traegt eine Signatur im Testbestand');

  ctx.fire(tilePinBtn(ctx, 'Gold'), 'click');

  const item = ctx.elements['wb-pins'].querySelector('.wb__pin-item');
  assert.ok(item, 'Pin-Eintrag fuer Gold nicht gefunden');
  // Der Mock-Selektor-Parser (dom-mock.js) kennt keine Nachfahren-Kombination
  // (".wb__mult i"), deshalb ueber den Tagnamen allein suchen -- im
  // Pin-Eintrag stehen ausschliesslich die Vielfachen-Felder als <i>.
  const mults = item.querySelectorAll('i');
  const MAXCLUSTER = { common: 6, uncommon: 5, rare: 4, epic: 3, legendary: 2 };
  const expected = MAXCLUSTER[gold.rarity] || 4;
  assert.strictEqual(mults.length, expected, 'Zahl der Vielfachen-Felder sollte der Seltenheit entsprechen');
  assert.ok(mults.every((el) => !el.classList.contains('is-hit')), 'kein Vielfachen-Feld sollte is-hit tragen');
});

// ---------------------------------------------------------------------
// Phase 10, Plan 01, Task 1 — sichtbare Preset-Liste statt <select> (D-05)
// und Umbenennen durch alle Schichten (D-02, Form 1).
// ---------------------------------------------------------------------

test('Presetliste zeigt jedes gespeicherte Preset als eigene Zeile mit data-preset', async () => {
  const ctx = await runAsync({
    account: { rows: [{ name: 'Erste', minerals: ['Gold'] }, { name: 'Zweite', minerals: [] }] },
  });

  const names = ctx.document.getElementById('wb-preset-list').querySelectorAll('.wb__pre-item')
    .map((row) => row.getAttribute('data-preset'));
  assert.deepStrictEqual(names.slice().sort(), ['Erste', 'Zweite']);
});

test('Klick auf eine Preset-Zeile wendet sie an und markiert genau diese Zeile mit is-sel', async () => {
  const ctx = await runAsync({
    account: { rows: [{ name: 'A', minerals: ['Gold'] }, { name: 'B', minerals: [] }] },
  });

  selectPreset(ctx, 'A');

  assert.ok(presetRow(ctx, 'A').classList.contains('is-sel'), 'Preset A sollte nach der Auswahl is-sel tragen');
  assert.ok(!presetRow(ctx, 'B').classList.contains('is-sel'), 'Preset B sollte NICHT is-sel tragen');
});

test('Umbenennen schickt genau EINEN PATCH-Aufruf (Pfad und Rumpf tragen den alten bzw. neuen Namen), keinen POST/DELETE', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'Alt', minerals: ['Gold'] }] } });

  const btn = renameBtn(ctx, 'Alt');
  assert.ok(btn, 'Umbenennen-Knopf fuer "Alt" nicht gefunden');
  ctx.fire(btn, 'click');
  assert.strictEqual(ctx.elements['wb-pre-name'].value, 'Alt', 'Namensfeld sollte beim Umbenennen den ALTEN Namen tragen');

  ctx.elements['wb-pre-name'].value = 'Neu';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();

  const patch = lastPatchCall(ctx);
  assert.strictEqual(patch.path, 'mining_sig_presets?name=eq.Alt');
  assert.deepStrictEqual(Object.keys(patch.body), ['name']);
  assert.strictEqual(patch.body.name, 'Neu');
  assert.strictEqual(countCalls(ctx, 'PATCH'), 1, 'Umbenennen sollte genau einen PATCH ausloesen');
  assert.strictEqual(countCalls(ctx, 'POST'), 0, 'Umbenennen darf keinen POST ausloesen');
  assert.strictEqual(countCalls(ctx, 'DELETE'), 0, 'Umbenennen darf keinen DELETE ausloesen');

  const names = ctx.document.getElementById('wb-preset-list').querySelectorAll('.wb__pre-item')
    .map((row) => row.getAttribute('data-preset'));
  assert.ok(names.includes('Neu'), `Preset sollte nach dem Umbenennen unter "Neu" stehen (gefunden: ${names.join(', ')})`);
  assert.ok(!names.includes('Alt'), 'der alte Name sollte nicht mehr in der Liste stehen');
});

test('Umbenennen auf einen bereits vergebenen Namen meldet presetNameTaken, die Zeile behaelt ihren alten Namen', async () => {
  const ctx = await runAsync({
    account: { rows: [{ name: 'Alt', minerals: ['Gold'] }, { name: 'Belegt', minerals: [] }] },
  });

  ctx.fire(renameBtn(ctx, 'Alt'), 'click');
  ctx.elements['wb-pre-name'].value = 'Belegt';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();

  const msg = ctx.document.getElementById('wb-pre-msg');
  assert.strictEqual(msg.hidden, false, 'Meldungszeile sollte nach dem 409 sichtbar sein');
  assert.strictEqual(msg.textContent, ctx.T.presetNameTaken);
  assert.ok(presetRow(ctx, 'Alt'), 'Preset "Alt" sollte nach dem gescheiterten Umbenennen weiterhin unter dem alten Namen stehen');
  assert.strictEqual(countCalls(ctx, 'POST'), 0, 'ein 409 darf keinen zweiten Schreibversuch als POST ausloesen');
});

test('War das umbenannte Preset ausgewaehlt, traegt danach die Zeile mit dem NEUEN Namen is-sel', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'Alt', minerals: ['Gold'] }] } });

  selectPreset(ctx, 'Alt');
  assert.ok(presetRow(ctx, 'Alt').classList.contains('is-sel'), 'Vorbedingung: Alt sollte ausgewaehlt sein');

  ctx.fire(renameBtn(ctx, 'Alt'), 'click');
  ctx.elements['wb-pre-name'].value = 'Neu';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();

  const row = presetRow(ctx, 'Neu');
  assert.ok(row, 'Preset sollte nach dem Umbenennen unter "Neu" auffindbar sein');
  assert.ok(row.classList.contains('is-sel'), 'die umbenannte Zeile sollte weiterhin is-sel tragen');
});

test('T-10-01: ein Preset-Name mit HTML-Sonderzeichen landet escaped im Markup (kein injiziertes Element, voller Text erhalten)', async () => {
  const specialName = 'Preset & <Danger> "Quote"';
  const ctx = await runAsync({ account: { rows: [{ name: specialName, minerals: ['Gold'] }] } });

  const box = ctx.document.getElementById('wb-preset-list');
  assert.strictEqual(box.querySelectorAll('danger').length, 0, 'unescapter Text haette ein <danger>-Element erzeugt');

  const row = box.querySelectorAll('.wb__pre-item')[0];
  assert.ok(row, 'Preset-Zeile nicht gefunden');
  assert.strictEqual(row.getAttribute('data-preset'), specialName, 'Attributwert sollte nach dem Escape/Decode-Rundlauf vollstaendig erhalten sein');

  const nameBtn = row.querySelector('.wb__pre-name');
  assert.ok(nameBtn, 'Namensknopf nicht gefunden');
  assert.strictEqual(nameBtn.textContent, specialName, 'der volle Originaltext sollte als Text lesbar bleiben');

  // Die harte Probe: der Name bleibt als data-preset-Wert auffindbar, das
  // Anfuehrungszeichen darin haette den Attributwert sonst beim Zurueckparsen
  // abgeschnitten.
  assert.ok(presetRow(ctx, specialName), 'Preset-Zeile nach dem Rundlauf ueber den vollen Namen nicht mehr auffindbar');
});

test('Namensfeld ist nach "neu" leer und nach "umbenennen" mit dem alten Namen vorbelegt', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'Bestehend', minerals: ['Gold'] }] } });

  ctx.fire(ctx.elements['wb-pre-new'], 'click');
  assert.strictEqual(ctx.elements['wb-pre-name'].value, '', 'Namensfeld sollte nach "neu" leer sein');
  ctx.fire(ctx.elements['wb-pre-cancel'], 'click');

  ctx.fire(renameBtn(ctx, 'Bestehend'), 'click');
  assert.strictEqual(ctx.elements['wb-pre-name'].value, 'Bestehend', 'Namensfeld sollte nach "umbenennen" den alten Namen tragen');
});

// ---------------------------------------------------------------------
// Phase 10, Plan 01, Task 2 — Loeschen fragt zurueck, unterscheidbar von
// Abbrechen (D-01).
// ---------------------------------------------------------------------

test('Erster Klick auf den Loeschknopf loest keinen DELETE aus, die Zeile zeigt danach presetDelAsk', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'A', minerals: ['Gold'] }] } });

  const btn = deleteBtn(ctx, 'A');
  assert.ok(btn, 'Loeschknopf fuer "A" nicht gefunden');
  ctx.fire(btn, 'click');

  assert.strictEqual(countCalls(ctx, 'DELETE'), 0, 'der erste Klick darf keinen DELETE ausloesen');
  const ask = askBtn(ctx, 'A');
  assert.ok(ask, 'Zeile sollte nach dem ersten Klick die beschriftete Rueckfrage zeigen');
  assert.strictEqual(ask.textContent, ctx.T.presetDelAsk);
});

test('Zweiter Klick (auf die beschriftete Schaltflaeche) loest genau EIN DELETE aus', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'A', minerals: ['Gold'] }] } });

  ctx.fire(deleteBtn(ctx, 'A'), 'click');
  ctx.fire(askBtn(ctx, 'A'), 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'DELETE'), 1, 'der zweite Klick sollte genau einen DELETE ausloesen');
  const del = ctx.account.calls.filter((c) => c.method === 'DELETE')[0];
  assert.strictEqual(del.path, 'mining_sig_presets?name=eq.A');
  assert.ok(!presetRow(ctx, 'A'), 'Preset "A" sollte nach dem Loeschen nicht mehr in der Liste stehen');
});

test('Klick auf eine andere Stelle der Werkbank bricht die Rueckfrage ab; ein weiterer erster Klick loest weiterhin kein DELETE aus', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'A', minerals: ['Gold'] }] } });

  ctx.fire(deleteBtn(ctx, 'A'), 'click');
  assert.ok(askBtn(ctx, 'A'), 'Vorbedingung: Rueckfrage sollte stehen');

  selectMineral(ctx, 'Gold'); // ein Klick "daneben" innerhalb der Werkbank

  assert.ok(!askBtn(ctx, 'A'), 'Rueckfrage sollte nach dem Klick daneben abgeraeumt sein');
  assert.strictEqual(countCalls(ctx, 'DELETE'), 0);

  ctx.fire(deleteBtn(ctx, 'A'), 'click');
  assert.strictEqual(countCalls(ctx, 'DELETE'), 0, 'der erste Klick nach dem Abbruch darf weiterhin nicht loeschen');
  assert.ok(askBtn(ctx, 'A'), 'die Rueckfrage sollte erneut erscheinen');
});

test('Rueckfrage bei Preset A, Klick auf den Loeschknopf von Preset B: die Rueckfrage wandert zu B, A wird nicht geloescht', async () => {
  const ctx = await runAsync({
    account: { rows: [{ name: 'A', minerals: ['Gold'] }, { name: 'B', minerals: [] }] },
  });

  ctx.fire(deleteBtn(ctx, 'A'), 'click');
  assert.ok(askBtn(ctx, 'A'), 'Vorbedingung: Rueckfrage sollte bei A stehen');

  ctx.fire(deleteBtn(ctx, 'B'), 'click');

  assert.ok(!askBtn(ctx, 'A'), 'A sollte die Rueckfrage nicht mehr tragen');
  assert.ok(askBtn(ctx, 'B'), 'B sollte jetzt die Rueckfrage tragen');
  assert.ok(presetRow(ctx, 'A'), 'A sollte weiterhin in der Liste stehen');
  assert.strictEqual(countCalls(ctx, 'DELETE'), 0);
});

// ---------------------------------------------------------------------
// Phase 10, Plan 01, Task 3 — Ueberschreiben und Ausduennen (D-02, Form 2+3).
// ---------------------------------------------------------------------

test('Ein Klick auf die Zaehlzeile klappt die Preset-Zeile auf, ohne sie anzuwenden (kein preApply, kein Netzwerkaufruf)', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'A', minerals: ['Gold'], locations: [] }] } });

  const pinsBefore = ctx.document.getElementById('wb-pins').textContent;
  const locBefore = ctx.document.getElementById('wb-locpins').textContent;
  const callsBefore = ctx.account.calls.length;

  const btn = openBtn(ctx, 'A');
  assert.ok(btn, 'Zaehlzeile fuer "A" nicht gefunden');
  ctx.fire(btn, 'click');

  assert.strictEqual(ctx.document.getElementById('wb-pins').textContent, pinsBefore, 'Signaturenliste sollte unveraendert bleiben');
  assert.strictEqual(ctx.document.getElementById('wb-locpins').textContent, locBefore, 'Fundort-Merkliste sollte unveraendert bleiben');
  assert.strictEqual(ctx.account.calls.length, callsBefore, 'Aufklappen darf keinen neuen Netzwerkaufruf ausloesen');
  assert.ok(entryBody(ctx, 'A'), 'die aufgeklappte Ansicht sollte jetzt stehen');
});

test('Die aufgeklappte Ansicht zeigt jedes gespeicherte Erz und Fundort-Paar mit je einem Entfernen-Knopf', async () => {
  const probe = run({ account: { rows: [] } });
  const loc = realLocOf(probe, 'Quantainium');

  const ctx = await runAsync({
    account: { rows: [{ name: 'A', minerals: ['Gold'], locations: [`Quantainium||${loc}`] }] },
  });

  ctx.fire(openBtn(ctx, 'A'), 'click');

  assert.ok(rmMinBtn(ctx, 'A', 'Gold'), 'Entfernen-Knopf fuer das Erz Gold nicht gefunden');
  assert.ok(rmLocBtn(ctx, 'A', `Quantainium||${loc}`), 'Entfernen-Knopf fuer das Fundort-Paar nicht gefunden');
});

test('Ein Erz aus einer aufgeklappten Preset-Zeile entfernen schickt genau ein PATCH mit dem Feld minerals; die Arbeitslisten bleiben unveraendert', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'A', minerals: ['Gold', 'Quantainium'], locations: [] }] } });

  const pinsBefore = ctx.document.getElementById('wb-pins').textContent;
  const locBefore = ctx.document.getElementById('wb-locpins').textContent;

  ctx.fire(openBtn(ctx, 'A'), 'click');
  const before = countCalls(ctx, 'PATCH');
  ctx.fire(rmMinBtn(ctx, 'A', 'Gold'), 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'PATCH'), before + 1, 'genau ein neuer PATCH-Aufruf');
  const patch = lastPatchCall(ctx);
  assert.strictEqual(patch.path, 'mining_sig_presets?name=eq.A');
  assert.deepStrictEqual(Object.keys(patch.body), ['minerals']);
  assert.deepStrictEqual(Array.from(patch.body.minerals), ['Quantainium']);

  assert.strictEqual(ctx.document.getElementById('wb-pins').textContent, pinsBefore, 'Arbeitsstand (Signaturenliste) sollte unveraendert bleiben');
  assert.strictEqual(ctx.document.getElementById('wb-locpins').textContent, locBefore, 'Arbeitsstand (Merkliste) sollte unveraendert bleiben');
});

test('Ein Fundort-Paar aus einer aufgeklappten Preset-Zeile entfernen schickt genau ein PATCH mit dem Feld locations; die Arbeitslisten bleiben unveraendert', async () => {
  const probe = run({ account: { rows: [] } });
  const quantLoc = realLocOf(probe, 'Quantainium');
  const goldLoc = realLocOf(probe, 'Gold');

  const ctx = await runAsync({
    account: { rows: [{ name: 'A', minerals: [], locations: [`Quantainium||${quantLoc}`, `Gold||${goldLoc}`] }] },
  });

  const pinsBefore = ctx.document.getElementById('wb-pins').textContent;
  const locBefore = ctx.document.getElementById('wb-locpins').textContent;

  ctx.fire(openBtn(ctx, 'A'), 'click');
  ctx.fire(rmLocBtn(ctx, 'A', `Quantainium||${quantLoc}`), 'click');
  await flush();

  const patch = lastPatchCall(ctx);
  assert.strictEqual(patch.path, 'mining_sig_presets?name=eq.A');
  assert.deepStrictEqual(Object.keys(patch.body), ['locations']);
  assert.deepStrictEqual(Array.from(patch.body.locations), [`Gold||${goldLoc}`]);
  assert.strictEqual(countCalls(ctx, 'DELETE'), 0);

  assert.strictEqual(ctx.document.getElementById('wb-pins').textContent, pinsBefore);
  assert.strictEqual(ctx.document.getElementById('wb-locpins').textContent, locBefore);
});

test('Nach dem Entfernen eines Eintrags bleibt dieselbe Zeile aufgeklappt und zeigt den Eintrag nicht mehr', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'A', minerals: ['Gold', 'Quantainium'], locations: [] }] } });

  ctx.fire(openBtn(ctx, 'A'), 'click');
  ctx.fire(rmMinBtn(ctx, 'A', 'Gold'), 'click');
  await flush();

  const body = entryBody(ctx, 'A');
  assert.ok(body, 'die Zeile sollte weiterhin aufgeklappt sein');
  assert.doesNotMatch(body.textContent, /Gold/, 'das entfernte Erz sollte nicht mehr in der Ansicht stehen');
  assert.match(body.textContent, /Quantainium/, 'das verbleibende Erz sollte weiterhin stehen');
});

test('Ueberschreiben schickt den bestehenden Upsert unter demselben Namen mit dem AKTUELLEN Arbeitsstand, kein DELETE, kein zweiter Aufruf', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'A', minerals: ['Gold'], locations: [] }] } });
  const loc = realLocOf(ctx, 'Quantainium');

  selectMineral(ctx, 'Quantainium');
  ctx.fire(tilePinBtn(ctx, 'Quantainium'), 'click');
  ctx.fire(locPinBtn(ctx, 'Quantainium', loc), 'click');

  const postsBefore = countCalls(ctx, 'POST');
  const btn = updateBtn(ctx, 'A');
  assert.ok(btn, 'Ueberschreiben-Knopf fuer "A" nicht gefunden');
  ctx.fire(btn, 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'POST'), postsBefore + 1, 'genau ein neuer POST-Aufruf');
  const post = lastPostBody(ctx);
  assert.strictEqual(post.path, 'mining_sig_presets?on_conflict=user_id,name');
  assert.strictEqual(post.prefer, 'resolution=merge-duplicates,return=minimal');
  assert.strictEqual(post.body[0].name, 'A');
  assert.deepStrictEqual(Array.from(post.body[0].minerals), ['Quantainium']);
  assert.deepStrictEqual(Array.from(post.body[0].locations), [`Quantainium||${loc}`]);
  assert.strictEqual(countCalls(ctx, 'DELETE'), 0);

  const msg = ctx.document.getElementById('wb-pre-msg');
  assert.strictEqual(msg.textContent, ctx.T.presetUpdated, 'die Rueckmeldung sollte "ueberschrieben" sagen, nicht "gespeichert"');
});

test('Ist ein Preset nach dem Ausduennen leer, bleibt die Zeile stehen und die aufgeklappte Ansicht zeigt presetNoEntries', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'A', minerals: ['Gold'], locations: [] }] } });

  ctx.fire(openBtn(ctx, 'A'), 'click');
  ctx.fire(rmMinBtn(ctx, 'A', 'Gold'), 'click');
  await flush();

  assert.ok(presetRow(ctx, 'A'), 'die Zeile sollte nach dem Ausduennen weiterhin in der Liste stehen');
  const body = entryBody(ctx, 'A');
  assert.ok(body, 'die Ansicht sollte weiterhin aufgeklappt sein');
  assert.strictEqual(body.textContent, ctx.T.presetNoEntries);
});

// ---------------------------------------------------------------------
// Code-Review Phase 10 (10-REVIEW.md) — HIGH: Lost-Update bei zwei raschen
// Entfernungen aus demselben Feld desselben Presets (preRemoveEntry() las
// bislang IMMER aus dem stale lokalen `presets`-Cache; ohne Sperre gewinnt
// der zuletzt ankommende PATCH und ueberschreibt den anderen vollstaendig).
// ---------------------------------------------------------------------

test('REVIEW HIGH: zwei rasche Entfernungen aus DEMSELBEN Feld desselben Presets serialisieren sich — der zweite Klick waehrend des laufenden PATCH wird ignoriert, kein Lost-Update', async () => {
  const ctx = await runAsync({
    account: { rows: [{ name: 'A', minerals: ['Gold', 'Quantainium', 'Aphorite'], locations: [] }] },
  });

  ctx.fire(openBtn(ctx, 'A'), 'click');
  // Beide Knoepfe VOR dem ersten Klick einsammeln: renderPresetList() zeichnet
  // die aufgeklappte Ansicht erst nach preLoad() (also erst nach `flush()`)
  // neu -- bis dahin bleiben beide Referenzen gueltig, genau wie beim
  // Doppelklick-Bedienfall aus dem Befund.
  const btnGold = rmMinBtn(ctx, 'A', 'Gold');
  const btnQuant = rmMinBtn(ctx, 'A', 'Quantainium');
  assert.ok(btnGold && btnQuant, 'Entfernen-Knoepfe fuer Gold und Quantainium nicht gefunden');

  ctx.fire(btnGold, 'click');   // Klick 1: berechnet next aus dem noch unveraenderten Cache
  ctx.fire(btnQuant, 'click');  // Klick 2: OHNE Sperre wuerde dieser denselben stale Cache lesen
  await flush();

  assert.strictEqual(countCalls(ctx, 'PATCH'), 1,
    'der zweite Klick auf dasselbe (name, field) waehrend des laufenden ersten PATCH darf keinen zweiten PATCH ausloesen');
  const patch = lastPatchCall(ctx);
  assert.deepStrictEqual(Array.from(patch.body.minerals), ['Quantainium', 'Aphorite'],
    'der einzige PATCH sollte GENAU Klick 1 (Gold entfernen) umsetzen, nichts von Klick 2 verlieren');

  // Serverseitig (und nach dem folgenden preLoad()) ist NUR Gold weg -- die
  // Buchse fuer Quantainium erfordert einen ERNEUTEN Klick, verliert aber
  // nichts wortlos.
  const body = entryBody(ctx, 'A');
  assert.doesNotMatch(body.textContent, /Gold/, 'Gold sollte nach dem einzigen PATCH entfernt sein');
  assert.match(body.textContent, /Quantainium/, 'Quantainium darf NICHT wortlos verschwinden -- der zweite Klick wurde ignoriert, nicht heimlich mit ausgefuehrt');
});

test('REVIEW HIGH: nach Abschluss des ersten PATCH ist das Feld wieder frei -- ein erneuter Klick loest den naechsten PATCH aus', async () => {
  const ctx = await runAsync({
    account: { rows: [{ name: 'A', minerals: ['Gold', 'Quantainium'], locations: [] }] },
  });

  ctx.fire(openBtn(ctx, 'A'), 'click');
  ctx.fire(rmMinBtn(ctx, 'A', 'Gold'), 'click');
  await flush();
  assert.strictEqual(countCalls(ctx, 'PATCH'), 1);

  // preOpen blieb ueber den PATCH/preLoad()-Umlauf hinweg 'A' -- die Zeile
  // ist bereits aufgeklappt, ein erneuter Klick auf die Zaehlzeile wuerde sie
  // JETZT zuklappen (Umschalter). Der Entfernen-Knopf steht direkt bereit.
  ctx.fire(rmMinBtn(ctx, 'A', 'Quantainium'), 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'PATCH'), 2, 'die Sperre darf nur waehrend des laufenden PATCH gelten, nicht dauerhaft');
  const body = entryBody(ctx, 'A');
  assert.strictEqual(body.textContent, ctx.T.presetNoEntries);
});

test('REVIEW HIGH: Entfernungen aus VERSCHIEDENEN Feldern desselben Presets ueberlappen weiterhin ungebremst (keine globale Sperre)', async () => {
  const probe = run({ account: { rows: [] } });
  const loc = realLocOf(probe, 'Quantainium');

  const ctx = await runAsync({
    account: { rows: [{ name: 'A', minerals: ['Gold'], locations: [`Quantainium||${loc}`] }] },
  });

  ctx.fire(openBtn(ctx, 'A'), 'click');
  const btnMin = rmMinBtn(ctx, 'A', 'Gold');
  const btnLoc = rmLocBtn(ctx, 'A', `Quantainium||${loc}`);
  assert.ok(btnMin && btnLoc, 'Entfernen-Knoepfe nicht gefunden');

  ctx.fire(btnMin, 'click'); // Feld "minerals" wird gesperrt
  ctx.fire(btnLoc, 'click'); // ANDERES Feld ("locations") desselben Presets -- muss trotzdem sofort senden
  await flush();

  assert.strictEqual(countCalls(ctx, 'PATCH'), 2, 'zwei verschiedene Felder desselben Presets duerfen ueberlappen');
  const body = entryBody(ctx, 'A');
  assert.strictEqual(body.textContent, ctx.T.presetNoEntries, 'beide Entfernungen sollten durchgekommen sein');
});

// ---------------------------------------------------------------------
// Code-Review Phase 10 (10-REVIEW.md) — MEDIUM: kein Treffer-Check bei
// PATCH/DELETE. Ein Filter, der serverseitig null Zeilen trifft, antwortet
// bei PostgREST trotzdem mit 200/204 -- ohne Prefer: return=representation
// und Auswertung der leeren Zeilenmenge meldet die Oberflaeche faelschlich
// Erfolg (Cross-Device-Race: ein anderer Tab hat das Preset bereits
// geloescht, dieser Tab traegt noch den alten, lokal gecachten Stand).
// ---------------------------------------------------------------------

test('REVIEW MEDIUM: Umbenennen eines serverseitig bereits geloeschten Presets (Cross-Device-Race) meldet presetFail, NIE faelschlich presetRenamed', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'X', minerals: ['Gold'], locations: [] }] } });

  ctx.fire(renameBtn(ctx, 'X'), 'click');
  // Tab 2 hat "X" bereits geladen; ein ANDERER Tab loescht es serverseitig,
  // ohne dass dieser Tab je preLoad() lief -- der lokale Cache bleibt stale.
  ctx.account.rows.length = 0;

  ctx.elements['wb-pre-name'].value = 'Y';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'PATCH'), 1, 'der PATCH wird trotzdem gesendet -- der Client weiss vorher nicht, dass die Zeile weg ist');
  const msg = ctx.document.getElementById('wb-pre-msg');
  assert.strictEqual(msg.hidden, false, 'ein wirkungsloser PATCH muss laut scheitern (Projektgrundsatz "scheitert es laut statt still")');
  assert.strictEqual(msg.textContent, ctx.T.presetFail, 'darf NICHT presetRenamed melden, wenn PostgREST null Zeilen getroffen hat');
});

test('REVIEW MEDIUM: Loeschen eines serverseitig bereits verschwundenen Presets meldet presetFail, NIE faelschlich presetDeleted', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'X', minerals: ['Gold'], locations: [] }] } });

  ctx.fire(deleteBtn(ctx, 'X'), 'click');
  ctx.account.rows.length = 0; // derselbe Cross-Device-Fall wie beim Umbenennen oben

  ctx.fire(askBtn(ctx, 'X'), 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'DELETE'), 1);
  const msg = ctx.document.getElementById('wb-pre-msg');
  assert.strictEqual(msg.hidden, false);
  assert.strictEqual(msg.textContent, ctx.T.presetFail, 'darf NICHT presetDeleted melden, wenn null Zeilen getroffen wurden');
});

test('REVIEW MEDIUM: Einzeleintrag-Entfernen an einem serverseitig bereits verschwundenen Preset meldet presetFail, NIE faelschlich presetSaved', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'X', minerals: ['Gold', 'Quantainium'], locations: [] }] } });

  ctx.fire(openBtn(ctx, 'X'), 'click');
  const btn = rmMinBtn(ctx, 'X', 'Gold');
  assert.ok(btn, 'Entfernen-Knopf nicht gefunden');

  ctx.account.rows.length = 0; // Cross-Device-Fall: die Zeile ist server-seitig bereits weg

  ctx.fire(btn, 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'PATCH'), 1);
  const msg = ctx.document.getElementById('wb-pre-msg');
  assert.strictEqual(msg.hidden, false);
  assert.strictEqual(msg.textContent, ctx.T.presetFail, 'darf NICHT presetSaved melden, wenn null Zeilen getroffen wurden');
});

// ---------------------------------------------------------------------
// Code-Review Phase 10 (10-REVIEW.md) — MEDIUM/eq.null-Falle: der Name
// "null" wird bereits bei Anlage/Umbenennen abgewiesen (prospektiver Teil
// des Fixes; der retroaktive Teil ist der Treffer-Check im vorigen Commit).
// ---------------------------------------------------------------------

test('REVIEW eq.null-Falle: Preset-Name "null" (Gross-/Kleinschreibung, mit Leerraum) wird beim Anlegen abgewiesen, kein POST', async () => {
  const ctx = await runAsync({ account: { rows: [] } });

  ctx.fire(ctx.elements['wb-pre-new'], 'click');
  ctx.elements['wb-pre-name'].value = '  Null  ';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'POST'), 0, 'ein Preset namens "null" darf nie angelegt werden');
  const msg = ctx.document.getElementById('wb-pre-msg');
  assert.strictEqual(msg.hidden, false);
  assert.strictEqual(msg.textContent, ctx.T.presetFail);
});

test('REVIEW eq.null-Falle: ein Preset auf den Namen "NULL" umbenennen wird abgewiesen, kein PATCH', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'Alt', minerals: ['Gold'] }] } });

  ctx.fire(renameBtn(ctx, 'Alt'), 'click');
  ctx.elements['wb-pre-name'].value = 'NULL';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();

  assert.strictEqual(countCalls(ctx, 'PATCH'), 0, 'das Umbenennen auf "NULL" darf keinen Aufruf ausloesen');
  const msg = ctx.document.getElementById('wb-pre-msg');
  assert.strictEqual(msg.textContent, ctx.T.presetFail);
  assert.ok(presetRow(ctx, 'Alt'), 'die Zeile sollte weiterhin unter dem alten Namen stehen');
});

// ---------------------------------------------------------------------
// Code-Review Phase 10 (10-REVIEW.md) — LOW: preOpen folgt dem Umbenennen
// nicht (die aufgeklappte Ansicht klappte nach einem Umbenennen unbemerkt zu).
// ---------------------------------------------------------------------

test('REVIEW LOW: war die umbenannte Preset-Zeile aufgeklappt, bleibt sie es unter dem neuen Namen', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'Alt', minerals: ['Gold'], locations: [] }] } });

  ctx.fire(openBtn(ctx, 'Alt'), 'click');
  assert.ok(entryBody(ctx, 'Alt'), 'Vorbedingung: Zeile sollte aufgeklappt sein');

  ctx.fire(renameBtn(ctx, 'Alt'), 'click');
  ctx.elements['wb-pre-name'].value = 'Neu';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();

  assert.ok(entryBody(ctx, 'Neu'), 'die aufgeklappte Ansicht sollte unter dem neuen Namen weiterhin stehen, nicht unbemerkt zuklappen');
});

// ---------------------------------------------------------------------
// Phase 12, Plan 01, Task 1 — Tracer: ein Fundort, hin und zurueck, end-to-
// end durch alle Schichten (D-01, D-02, D-05, D-06, D-07, D-11).
// ---------------------------------------------------------------------

test('T-12-01: Klick auf eine Fundort-Zeile (nicht die Nadel) oeffnet die Fundort-Ansicht mit dem Ortsnamen im Kopf', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');

  const row = locRow(ctx, loc);
  assert.ok(row, `Fundort-Zeile fuer Gold@${loc} nicht gefunden`);
  ctx.fire(row, 'click');

  assert.strictEqual(ctx.elements['wb-lochead'].hidden, false, 'wb-lochead sollte nach dem Klick sichtbar sein');
  assert.strictEqual(ctx.elements['wb-locview'].hidden, false, 'wb-locview sollte nach dem Klick sichtbar sein');
  assert.strictEqual(ctx.elements['wb-orehead'].hidden, true, 'wb-orehead sollte verborgen sein');
  assert.strictEqual(ctx.elements['wb-oreview'].hidden, true, 'wb-oreview sollte verborgen sein');
  assert.strictEqual(ctx.elements['wb-locname'].textContent, loc, '#wb-locname sollte NUR den Ortsnamen tragen (D-11)');
});

test('T-12-02: Klick auf den Zurueck-Knopf stellt die Erz-Ansicht wieder her, das gewaehlte Erz und die Fusszeile bleiben unveraendert', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');
  const fracBefore = ctx.elements['wb-frac-ore'].textContent;

  ctx.fire(locRow(ctx, loc), 'click');
  assert.strictEqual(ctx.elements['wb-lochead'].hidden, false, 'Vorbedingung: Fundort-Ansicht sollte offen sein');

  const back = ctx.elements['wb-back'];
  assert.ok(back, 'Zurueck-Knopf nicht im Mock-DOM registriert');
  ctx.fire(back, 'click');

  assert.strictEqual(ctx.elements['wb-orehead'].hidden, false, 'wb-orehead sollte wieder sichtbar sein');
  assert.strictEqual(ctx.elements['wb-oreview'].hidden, false, 'wb-oreview sollte wieder sichtbar sein');
  assert.strictEqual(ctx.elements['wb-lochead'].hidden, true, 'wb-lochead sollte wieder verborgen sein');
  assert.strictEqual(ctx.elements['wb-locview'].hidden, true, 'wb-locview sollte wieder verborgen sein');
  assert.strictEqual(ctx.elements['wb-frac-ore'].textContent, fracBefore, 'D-10: die Fusszeile bleibt beim zuletzt gewaehlten Erz stehen');
});

test('T-12-03: Klick auf die Nadel INNERHALB einer Fundort-Zeile heftet das Paar an und oeffnet die Fundort-Ansicht NICHT', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');

  const btn = locPinBtn(ctx, 'Gold', loc);
  assert.ok(btn, `Nadelknopf fuer Gold@${loc} nicht gefunden`);
  ctx.fire(btn, 'click');

  assert.strictEqual(ctx.document.getElementById('wb-locpins').querySelectorAll('.wb__pin-item').length, 1, 'das Paar sollte angeheftet sein');
  assert.strictEqual(ctx.elements['wb-lochead'].hidden, true, 'die Fundort-Ansicht darf durch den Nadelklick NICHT geoeffnet werden');
  assert.strictEqual(ctx.elements['wb-orehead'].hidden, false, 'die Erz-Ansicht sollte weiterhin sichtbar sein');
});

test('T-12-04: die Erzliste eines Fundorts ist je Methodengruppe absteigend nach Chance sortiert, der rechte Wert jeder Zeile ist ihre eigene Chance', async () => {
  const probe = run({ account: { rows: [] } });
  const { name: loc, entries } = biggestLoc(probe);
  assert.ok(loc && entries.length >= 2, 'Testbestand sollte einen Fundort mit mindestens zwei Erzen liefern');

  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, entries[0].n);
  ctx.fire(locRow(ctx, loc), 'click');

  const rows = ctx.document.getElementById('wb-locview').querySelectorAll('.wb__row2');
  assert.strictEqual(rows.length, entries.length, 'jede Erzzeile dieses Fundorts sollte gezeichnet sein, keine doppelt');

  // Monoton faellt je METHODENGRUPPE (D-05 gruppiert NACH dem Sortieren, feste
  // Reihenfolge Schiff -> ROC -> Hand -- ueber eine Gruppengrenze hinweg darf
  // die Chance deshalb wieder steigen, siehe Aphorite/Feynmaline im Testbestand).
  const secs = ctx.document.getElementById('wb-locview').querySelectorAll('.wb__sec');
  assert.ok(secs.length >= 1, 'erwartet mindestens eine Methodengruppe');
  for (const sec of secs) {
    let prevCh = Infinity;
    for (const row of sec.querySelectorAll('.wb__row2')) {
      const ore = row.getAttribute('data-ore');
      const entry = entries.find((e) => e.n === ore);
      assert.ok(entry, `Erzzeile "${ore}" hat kein Gegenstueck im echten Bestand`);
      const em = row.querySelector('em');
      assert.ok(em, `Erzzeile "${ore}" traegt keine <em>`);
      assert.strictEqual(em.textContent, nPctForTest(entry.ch) + ' %', `der rechte Wert von "${ore}" sollte seine eigene Chance sein (D-06)`);
      assert.ok(entry.ch <= prevCh + 1e-9, `die Chance-Reihenfolge sollte innerhalb "${sec.querySelector('h4').textContent}" monoton fallen`);
      prevCh = entry.ch;
    }
  }
});

test('T-12-05: ein Fundort mit genau einer Methode zeigt genau eine Gruppenueberschrift, einer mit drei genau drei (D-05)', async () => {
  const probe = run({ account: { rows: [] } });
  const one = findLocWithGroups(probe, 1);
  const three = findLocWithGroups(probe, 3);
  assert.ok(one, 'Testbestand sollte einen Fundort mit genau einer Methode liefern');
  assert.ok(three, 'Testbestand sollte einen Fundort mit genau drei Methoden liefern');

  const ctx = await runAsync({ account: { rows: [] } });

  selectMineral(ctx, one.entries[0].n);
  ctx.fire(locRow(ctx, one.name), 'click');
  assert.strictEqual(
    ctx.document.getElementById('wb-locview').querySelectorAll('h4').length, 1,
    `"${one.name}" sollte genau eine Gruppenueberschrift zeigen`
  );

  selectMineral(ctx, three.entries[0].n);
  ctx.fire(locRow(ctx, three.name), 'click');
  assert.strictEqual(
    ctx.document.getElementById('wb-locview').querySelectorAll('h4').length, 3,
    `"${three.name}" sollte genau drei Gruppenueberschriften zeigen`
  );
});

test('T-12-06: Zeilen mit Hoechstanteil <= 10 tragen is-trace und das Abzeichen, an ihrer nach Chance sortierten Stelle (D-07)', async () => {
  const probe = run({ account: { rows: [] } });
  const mix = findLocWithTraceAndFull(probe);
  assert.ok(mix, 'Testbestand sollte einen Fundort mit Spuren- UND Vollzeilen liefern');

  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, mix.entries[0].n);
  ctx.fire(locRow(ctx, mix.name), 'click');

  const rows = ctx.document.getElementById('wb-locview').querySelectorAll('.wb__row2');
  let sawTrace = false, sawFull = false;
  for (const row of rows) {
    const ore = row.getAttribute('data-ore');
    const entry = mix.entries.find((e) => e.n === ore);
    assert.ok(entry, `Erzzeile "${ore}" hat kein Gegenstueck im echten Bestand`);
    const isTrace = (entry.ms || 0) <= 10;
    assert.strictEqual(row.classList.contains('is-trace'), isTrace, `is-trace sollte fuer "${ore}" ${isTrace} sein`);
    const badge = row.querySelector('.wb__tag');
    if (isTrace) {
      assert.ok(badge, `"${ore}" sollte das Spur-Abzeichen tragen`);
      assert.strictEqual(badge.textContent, ctx.T.trace);
      sawTrace = true;
    } else {
      assert.ok(!badge, `"${ore}" sollte KEIN Abzeichen tragen`);
      sawFull = true;
    }
  }
  assert.ok(sawTrace && sawFull, 'Vorbedingung verlangt beide Faelle nebeneinander in derselben Liste');
});

test('T-12-07: der synthetische Fundort mit HTML-Sonderzeichen laesst sich oeffnen, Name escaped im Kopf und im data-loc-Attributwert, kein injiziertes Element', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, 'Gold');

  const row = locRow(ctx, ctx.SPECIAL_LOC);
  assert.ok(row, 'Fundort-Zeile fuer den synthetischen Sonderzeichen-Fundort nicht gefunden');
  ctx.fire(row, 'click');

  const locsBox = ctx.document.getElementById('wb-locs');
  assert.strictEqual(locsBox.querySelectorAll('danger').length, 0, 'unescapter Text haette ein <danger>-Element erzeugt (#wb-locs)');

  assert.strictEqual(ctx.elements['wb-lochead'].hidden, false, 'die Fundort-Ansicht sollte offen sein');
  assert.strictEqual(ctx.elements['wb-locname'].textContent, ctx.SPECIAL_LOC, 'der volle Originaltext sollte ueber textContent im Kopf stehen');

  const freshRow = locRow(ctx, ctx.SPECIAL_LOC);
  assert.ok(freshRow, 'Fundort-Zeile nach dem Oeffnen nicht mehr auffindbar (Attributwert vermutlich abgeschnitten)');
  assert.strictEqual(freshRow.getAttribute('data-loc'), ctx.SPECIAL_LOC);
});

// ---------------------------------------------------------------------
// Phase 12, Plan 01, Task 2 — Der Falz haelt: Hoehenbilanz und Bildlauf der
// neuen Ansicht. Fuegt keine Funktion hinzu, sichert nur, dass es nichts zu
// messen gibt, das strukturell schon falsch ist.
// ---------------------------------------------------------------------

test('T-12-08: In der Fundort-Ansicht bleibt die Zahl der .wb__pane-Elemente bei drei, #wb-locview traegt NUR wb__scroll', async () => {
  // Statische Markup-Zusicherung: .wb__grid traegt weiterhin genau drei
  // .wb__pane-Kinder -- die Fundort-Ansicht ist ein Geschwister INNERHALB
  // des mittleren Paneels (Task 1), kein viertes Paneel. Der Mock-DOM in
  // mining-dom.js modelliert keine .wb__pane-Elemente (mining-workbench.js
  // greift nie darauf zu), deshalb hier gegen die echte Astro-Quelle -- die
  // drei Positionsregeln der Medienabfragen (Z. 787-814) haengen daran.
  const astroSrc = fs.readFileSync(path.resolve('src/components/MiningWorkbench.astro'), 'utf8');
  const paneCount = (astroSrc.match(/class="wb__pane[ "]/g) || []).length;
  assert.strictEqual(paneCount, 3, 'die Fundort-Ansicht (Task 1) sollte kein viertes .wb__pane erzeugt haben');

  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');
  ctx.fire(locRow(ctx, loc), 'click');

  const locview = ctx.elements['wb-locview'];
  assert.ok(locview, 'wb-locview nicht im Mock-DOM registriert');
  assert.strictEqual(
    locview.className, 'wb__scroll',
    '#wb-locview sollte AUSSCHLIESSLICH wb__scroll tragen -- keine zweite Bildlaufklasse, sonst blendet die globale !important-Regel in assets/theme.css seine Leiste aus'
  );
});

test('T-12-09: Fundort mit den meisten Erzen -- keine Zeile geht beim Gruppieren verloren, keine erscheint doppelt, Gruppenueberschriften entsprechen den tatsaechlich vorkommenden Methoden', async () => {
  const probe = run({ account: { rows: [] } });
  const { name: loc, entries } = biggestLoc(probe);
  assert.ok(loc, 'Testbestand sollte einen groessten Fundort liefern');

  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, entries[0].n);
  ctx.fire(locRow(ctx, loc), 'click');

  const locview = ctx.elements['wb-locview'];
  const headings = locview.querySelectorAll('h4');
  const rows = locview.querySelectorAll('.wb__row2');

  // Kein Eintrag geht beim Gruppieren verloren, keiner erscheint doppelt --
  // auch wenn ein Element in DERSELBEN Komposition mehrfach vorkommt (Adern),
  // fuehren die Daten es trotzdem als EINEN Eintrag je Erz-Ort-Paar, und
  // genau das muss die Ansicht zeigen.
  const oreNames = rows.map((r) => r.getAttribute('data-ore'));
  assert.strictEqual(oreNames.length, entries.length, 'Zeilenzahl sollte exakt der Zahl der Eintraege dieses Ortes entsprechen');
  assert.strictEqual(new Set(oreNames).size, oreNames.length, 'kein Erz sollte doppelt gezeichnet sein');
  for (const name of entries.map((e) => e.n)) {
    assert.ok(oreNames.includes(name), `"${name}" fehlt in der gezeichneten Liste`);
  }

  const distinctGroups = new Set(entries.map((e) => (e.mi === 'ship' ? 'ship' : (e.mi === 'roc' ? 'roc' : 'hand'))));
  assert.strictEqual(headings.length, distinctGroups.size, 'Zahl der Gruppenueberschriften sollte der Zahl der tatsaechlich vorkommenden Methoden entsprechen');
  assert.strictEqual(
    headings.length + rows.length, distinctGroups.size + entries.length,
    'Summe aus Gruppenueberschriften und Zeilen sollte exakt Gruppen + Eintraege sein -- nichts verloren, nichts verdoppelt'
  );
});

// ---------------------------------------------------------------------
// Phase 12, Plan 02, Task 1 — Erzzeile INNERHALB der Fundort-Ansicht fuehrt
// zum Erz (D-02): der Rueckweg, der die Fundort-Ansicht vom Plan-01-Tracer
// zu einem Netz aus beiden Richtungen macht.
// ---------------------------------------------------------------------

test('T-12-10: Fundort oeffnen, auf eine Erzzeile klicken: das gewaehlte Erz ist danach genau dieses Erz, die Erz-Ansicht ist sichtbar, die Fundort-Ansicht verborgen, und der Fusszeilentext nennt das neue Erz', async () => {
  const probe = run({ account: { rows: [] } });
  const { name: loc, entries } = biggestLoc(probe);
  assert.ok(loc && entries.length >= 2, 'Testbestand sollte einen Fundort mit mindestens zwei Erzen liefern');
  const target = entries.find((e) => e.n !== entries[0].n);
  assert.ok(target, 'Testbestand sollte ein zweites, abweichendes Erz am selben Fundort liefern');

  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, entries[0].n);
  ctx.fire(locRow(ctx, loc), 'click');
  assert.strictEqual(ctx.elements['wb-lochead'].hidden, false, 'Vorbedingung: Fundort-Ansicht sollte offen sein');

  const row = oreRow(ctx, target.n);
  assert.ok(row, `Erzzeile fuer "${target.n}" im geoeffneten Fundort nicht gefunden`);
  ctx.fire(row, 'click');

  assert.strictEqual(ctx.elements['wb-name'].textContent, target.n, 'das gewaehlte Erz sollte das angeklickte Erz sein');
  assert.strictEqual(ctx.elements['wb-orehead'].hidden, false, 'der Erz-Kopf sollte sichtbar sein');
  assert.strictEqual(ctx.elements['wb-oreview'].hidden, false, 'die Erz-Ansicht sollte sichtbar sein');
  assert.strictEqual(ctx.elements['wb-lochead'].hidden, true, 'der Fundort-Kopf sollte verborgen sein');
  assert.strictEqual(ctx.elements['wb-locview'].hidden, true, 'die Fundort-Ansicht sollte verborgen sein');
  assert.strictEqual(ctx.elements['wb-frac-ore'].textContent, target.n, 'die Fusszeile sollte das neue Erz nennen (renderDetail() laeuft in jedem Durchlauf)');
});

test('T-12-11: Enter auf einer fokussierten Erzzeile bewirkt dasselbe wie der Klick; ein Klick auf eine Stationszeile in #wb-refs bewirkt weiterhin nichts', async () => {
  const probe = run({ account: { rows: [] } });
  const { name: loc, entries } = biggestLoc(probe);
  assert.ok(loc && entries.length >= 2, 'Testbestand sollte einen Fundort mit mindestens zwei Erzen liefern');
  const target = entries.find((e) => e.n !== entries[0].n);
  assert.ok(target, 'Testbestand sollte ein zweites, abweichendes Erz am selben Fundort liefern');

  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, entries[0].n);
  ctx.fire(locRow(ctx, loc), 'click');

  const row = oreRow(ctx, target.n);
  assert.ok(row, `Erzzeile fuer "${target.n}" nicht gefunden`);
  ctx.fire(row, 'keydown', { key: 'Enter' });

  assert.strictEqual(ctx.elements['wb-name'].textContent, target.n, 'Enter auf der Erzzeile sollte wie der Klick das Erz wechseln');
  assert.strictEqual(ctx.elements['wb-oreview'].hidden, false, 'die Erz-Ansicht sollte nach Enter sichtbar sein');
  assert.strictEqual(ctx.elements['wb-locview'].hidden, true, 'die Fundort-Ansicht sollte nach Enter verborgen sein');

  // Eine Stationszeile in #wb-refs traegt weder data-loc noch data-ore -- ein
  // Klick auf sie darf weder das Erz noch die Ansicht aendern. "Gold" hat im
  // Testbestand zuverlaessig Ertragsprofile (siehe rankRefineries()) --
  // target.n aus biggestLoc() ist dafuer nicht garantiert (elf Edelsteine
  // werden laut Kopfkommentar von yieldFor() nicht raffiniert).
  selectMineral(ctx, 'Gold');
  const refRow = ctx.document.getElementById('wb-refs').querySelectorAll('.wb__row2')[0];
  assert.ok(refRow, 'Vorbedingung: #wb-refs sollte fuer Gold mindestens eine Stationszeile tragen');
  const selBefore = ctx.elements['wb-name'].textContent;
  const viewBefore = ctx.elements['wb-oreview'].hidden;
  ctx.fire(refRow, 'click');
  assert.strictEqual(ctx.elements['wb-name'].textContent, selBefore, 'ein Klick auf eine Stationszeile darf das gewaehlte Erz nicht aendern');
  assert.strictEqual(ctx.elements['wb-oreview'].hidden, viewBefore, 'ein Klick auf eine Stationszeile darf die Ansicht nicht wechseln');
});

// ---------------------------------------------------------------------
// Phase 12, Plan 02, Task 2 — Die Fundort-Merkliste reagiert genauso: eine
// Zeile, zwei Bedeutungen (D-03). Das Loesen-Kreuz behaelt seinen Vorrang.
// ---------------------------------------------------------------------

test('T-12-12: Ein Paar anheften, dann in der Merkliste auf die Zeile (nicht auf das Kreuz) klicken: die Fundort-Ansicht dieses Ortes ist offen, das Paar bleibt angeheftet', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');
  ctx.fire(locPinBtn(ctx, 'Gold', loc), 'click');

  const row = locPinRow(ctx, loc);
  assert.ok(row, `Merklistenzeile fuer Gold||${loc} nicht gefunden`);

  ctx.fire(row, 'click');

  assert.strictEqual(ctx.elements['wb-lochead'].hidden, false, 'die Fundort-Ansicht sollte nach dem Zeilenklick offen sein');
  assert.strictEqual(ctx.elements['wb-locname'].textContent, loc, 'der Kopf sollte den geklickten Fundort zeigen');
  assert.strictEqual(
    ctx.document.getElementById('wb-locpins').querySelectorAll('.wb__pin-item').length, 1,
    'das Paar sollte nach dem Oeffnen weiterhin angeheftet sein'
  );
});

test('T-12-13: Klick auf das Kreuz derselben Zeile loest das Paar, OHNE die Ansicht zu wechseln; der Ortsname mit HTML-Sonderzeichen steht escaped im data-loc-Attributwert', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');
  ctx.fire(locPinBtn(ctx, 'Gold', loc), 'click');

  const crossBtn = locPinBtn(ctx, 'Gold', loc);
  assert.ok(crossBtn, 'Loesen-Kreuz nicht gefunden');
  ctx.fire(crossBtn, 'click');

  assert.strictEqual(
    ctx.document.getElementById('wb-locpins').querySelectorAll('.wb__pin-item').length, 0,
    'das Paar sollte nach dem Kreuz-Klick geloest sein'
  );
  assert.strictEqual(ctx.elements['wb-lochead'].hidden, true, 'die Fundort-Ansicht darf durch den Kreuz-Klick NICHT geoeffnet werden');
  assert.strictEqual(ctx.elements['wb-orehead'].hidden, false, 'die Erz-Ansicht sollte weiterhin sichtbar sein');

  // Sonderzeichen: escaped im data-loc-Attributwert der Merklistenzeile,
  // dieselben vier Zeichen wie bereits bei der Fundort-Zeile (T-12-07).
  ctx.fire(locPinBtn(ctx, 'Gold', ctx.SPECIAL_LOC), 'click');
  const specialRow = locPinRow(ctx, ctx.SPECIAL_LOC);
  assert.ok(specialRow, 'Merklistenzeile fuer den Sonderzeichen-Fundort nicht gefunden');
  assert.strictEqual(specialRow.getAttribute('data-loc'), ctx.SPECIAL_LOC, 'der volle Originaltext sollte ueber getAttribute() (dekodiert) im data-loc stehen');
  assert.strictEqual(
    ctx.document.getElementById('wb-locpins').querySelectorAll('danger').length, 0,
    'unescapter Text haette ein <danger>-Element erzeugt'
  );
});

// ---------------------------------------------------------------------
// Phase 12, Plan 02, Task 3 — Die Kachelspalte zeigt, was an einem offenen
// Fundort vorkommt -- und was nicht (D-09). Filtert nichts, annotiert nur.
// ---------------------------------------------------------------------

test('T-12-14: Fundort oeffnen -- Zahl der markierten Kacheln entspricht der Zahl der Eintraege, alle 37 Kacheln bleiben stehen (D-09)', async () => {
  const probe = run({ account: { rows: [] } });
  const { name: loc, entries } = biggestLoc(probe);

  const ctx = await runAsync({ account: { rows: [] } });
  const total = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile').length;
  selectMineral(ctx, entries[0].n);
  ctx.fire(locRow(ctx, loc), 'click');

  const tiles = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile');
  assert.strictEqual(tiles.length, total, 'die Gesamtzahl der Kacheln sollte unveraendert bleiben -- die Markierung filtert nicht');
  const marked = tiles.filter((t) => t.classList.contains('is-here'));
  assert.strictEqual(marked.length, entries.length, 'die Zahl der markierten Kacheln sollte der Zahl der Eintraege dieses Fundorts entsprechen');
  const markedNames = marked.map((t) => t.getAttribute('data-min'));
  for (const name of entries.map((e) => e.n)) {
    assert.ok(markedNames.includes(name), `"${name}" sollte markiert sein`);
  }
});

test('T-12-15: Zurueck auf die Erz-Ansicht -- keine Kachel traegt mehr is-here; markiert und ausgewaehlt schliessen einander waehrend die Fundort-Ansicht offen ist nicht aus', async () => {
  const probe = run({ account: { rows: [] } });
  const { name: loc, entries } = biggestLoc(probe);
  const target = entries[0];

  const ctx = await runAsync({ account: { rows: [] } });
  selectMineral(ctx, target.n);
  ctx.fire(locRow(ctx, loc), 'click');

  // Ueberlagerung waehrend die Fundort-Ansicht offen ist: die weiterhin
  // gewaehlte Kachel (S.sel aendert sich durch das Oeffnen eines Fundorts
  // nicht) traegt gleichzeitig is-sel UND is-here.
  const selTile = tileByName(ctx, target.n);
  assert.ok(selTile, `Kachel fuer "${target.n}" nicht gefunden`);
  assert.ok(selTile.classList.contains('is-sel'), 'die gewaehlte Kachel sollte is-sel tragen');
  assert.ok(selTile.classList.contains('is-here'), 'die gewaehlte Kachel sollte gleichzeitig is-here tragen -- die beiden Zustaende duerfen sich nicht verdraengen');

  const back = ctx.elements['wb-back'];
  assert.ok(back, 'Zurueck-Knopf nicht im Mock-DOM registriert');
  ctx.fire(back, 'click');

  const tiles = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile');
  const stillMarked = tiles.filter((t) => t.classList.contains('is-here'));
  assert.strictEqual(stillMarked.length, 0, 'nach dem Zurueckspringen sollte keine Kachel mehr is-here tragen');
  assert.ok(tileByName(ctx, target.n).classList.contains('is-sel'), 'die Erzauswahl selbst sollte durch das Zurueckspringen unveraendert bleiben');
});

// ---------------------------------------------------------------------
// Phase 12, Plan 03, Task 1 — Ein Fundort bekommt eine Adresse: der
// Tieflink-Parameter ?fundort= (D-04), dieselbe Bauform wie der bestehende
// ?mineral=-Zweig (T-12-04 ff. fuer den Rest der Bauform, hier nur der neue
// Adresszweig selbst).
// ---------------------------------------------------------------------

test('T-12-16: ?fundort= mit abweichender Gross-/Kleinschreibung und umschliessenden Leerzeichen oeffnet die Fundort-Ansicht dieses Ortes; #wb-locname traegt die kanonische Schreibweise aus den Daten', async () => {
  const probe = run({ account: { rows: [] } });
  const { name: loc } = biggestLoc(probe);
  assert.ok(loc, 'Testbestand sollte einen groessten Fundort liefern');
  const messy = '  ' + loc.toUpperCase() + '  ';

  const ctx = await runAsync({ account: { rows: [] }, search: '?fundort=' + encodeURIComponent(messy) });

  assert.strictEqual(ctx.elements['wb-lochead'].hidden, false, 'die Fundort-Ansicht sollte beim Laden bereits offen sein');
  assert.strictEqual(ctx.elements['wb-locview'].hidden, false, 'wb-locview sollte beim Laden bereits sichtbar sein');
  assert.strictEqual(ctx.elements['wb-orehead'].hidden, true, 'die Erz-Ansicht sollte verborgen sein');
  assert.strictEqual(ctx.elements['wb-oreview'].hidden, true, 'die Erz-Ansicht sollte verborgen sein');
  assert.strictEqual(
    ctx.elements['wb-locname'].textContent, loc,
    '#wb-locname sollte die KANONISCHE Schreibweise aus den Daten tragen, nicht den eingegebenen (grossgeschriebenen, umschlossenen) Wert'
  );
});

test('T-12-17 (Sicherheitsnachweis): ein unbekannter ?fundort=-Wert mit HTML-Sonderzeichen und Skript-Anfang laesst die Erz-Ansicht stehen; der eingegebene Wert erscheint im gesamten gezeichneten Markup an keiner Stelle', async () => {
  const evil = '<script>alert(1)</script>&"\'';

  const ctx = await runAsync({ account: { rows: [] }, search: '?fundort=' + encodeURIComponent(evil) });

  assert.strictEqual(ctx.elements['wb-orehead'].hidden, false, 'die Erz-Ansicht sollte stehen bleiben');
  assert.strictEqual(ctx.elements['wb-oreview'].hidden, false, 'die Erz-Ansicht sollte stehen bleiben');
  assert.strictEqual(ctx.elements['wb-lochead'].hidden, true, 'ein unbekannter Wert darf die Fundort-Ansicht NICHT oeffnen');
  assert.strictEqual(ctx.elements['wb-locview'].hidden, true, 'ein unbekannter Wert darf die Fundort-Ansicht NICHT oeffnen');

  // Sicherheitsnachweis: das gesamte gezeichnete Markup (Text UND
  // Attributwerte) darf den eingegebenen Wert an KEINER Stelle enthalten --
  // weder ganz noch in Fragmenten. Ein unbekannter Wert wird von
  // fromQueryLoc() nirgends geschrieben; dieser Test belegt genau das, statt
  // es nur aus dem Quelltext zu folgern. (Das Mock-DOM traegt selbst ein
  // #wb-data-<script>-Element fuer die JSON-Nutzlast -- ein blosser
  // '<script>'-Teilstring-Test wuerde also grundlos gegen die eigene
  // Testinfrastruktur schlagen; der Nachweis prueft deshalb gezielt den
  // eingegebenen Wert und sein auffaelligstes Fragment.)
  const markup = ctx.root.outerHTML;
  assert.ok(!markup.includes(evil), 'der volle rohe Eingabewert darf im gezeichneten Markup nicht vorkommen');
  assert.ok(!markup.includes('alert(1)'), 'kein Fragment des Werts darf im gezeichneten Markup vorkommen');
});

test('T-12-18: ?mineral= UND ?fundort= gleichzeitig -- der genannte Ort ist offen UND das genannte Erz ist gewaehlt, belegbar am Fusszeilentext', async () => {
  const probe = run({ account: { rows: [] } });
  const { name: loc } = biggestLoc(probe);
  assert.ok(loc, 'Testbestand sollte einen groessten Fundort liefern');
  const mineral = 'Quantainium';
  assert.ok(probe.byName[mineral], 'Testbestand sollte "Quantainium" kennen');

  const search = '?mineral=' + encodeURIComponent(mineral) + '&fundort=' + encodeURIComponent(loc);
  const ctx = await runAsync({ account: { rows: [] }, search });

  assert.strictEqual(ctx.elements['wb-lochead'].hidden, false, 'der genannte Ort sollte offen sein');
  assert.strictEqual(ctx.elements['wb-locname'].textContent, loc, '#wb-locname sollte den genannten Ort tragen');
  assert.strictEqual(
    ctx.elements['wb-frac-ore'].textContent, mineral,
    'die Fusszeile sollte weiterhin das genannte Erz nennen -- die beiden Adresszweige heben sich nicht gegenseitig auf'
  );
});
