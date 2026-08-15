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

// ---------------------------------------------------------------------
// D-04: ein VOR dieser Phase gespeichertes Preset laedt weiterhin.
// ---------------------------------------------------------------------

test('Preset in der alten Form (kein locations-Feld) laedt: Signaturen vollstaendig, Merkliste leer, kein Fehler', async () => {
  const ctx = await runAsync({ account: { rows: [{ name: 'Alt', minerals: ['Gold'] }] } });

  const options = ctx.elements['wb-preset'].children.map((o) => o.getAttribute('value'));
  assert.ok(options.includes('Alt'), `Preset "Alt" steht nicht in der Auswahl (gefunden: ${options.join(', ')})`);

  ctx.elements['wb-preset'].value = 'Alt'; // fires 'change' -> preApply('Alt')

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

  ctx.elements['wb-preset'].value = 'AltNull';

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
  ctx.elements['wb-preset'].value = 'Zweiter-Rundlauf';

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

  ctx.elements['wb-preset'].value = 'A';
  let box = ctx.document.getElementById('wb-locpins');
  assert.strictEqual(box.querySelectorAll('.wb__pin-item').length, 1, 'Preset A sollte genau einen Eintrag zeigen');
  assert.match(box.textContent, /Quantainium/);
  assert.doesNotMatch(box.textContent, /Gold/, 'Preset A darf Golds Paar nicht zeigen (keine Vereinigung)');

  ctx.elements['wb-preset'].value = 'B';
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

  ctx.elements['wb-preset'].value = 'Mix';

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

test('Merklisten-Eintrag zeigt System, Chance und Hoechstanteil aus dem Katalog, nicht aus dem gespeicherten Paar (O-3, T-09-06)', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const loc = realLocOf(ctx, 'Quantainium');
  const cat = ctx.byName.Quantainium.locs.find((l) => l.p === loc);
  assert.ok(cat, 'Katalog-Eintrag fuer Quantainium/loc nicht gefunden');

  selectMineral(ctx, 'Quantainium');
  ctx.fire(locPinBtn(ctx, 'Quantainium', loc), 'click');

  const box = ctx.document.getElementById('wb-locpins');
  const meta = box.querySelector('.wb__lmeta');
  assert.ok(meta, 'erwartet eine Wertezeile (.wb__lmeta) im Merklisten-Eintrag');

  const sysSpan = meta.querySelector('span');
  assert.ok(sysSpan, 'Wertezeile sollte das System in einer <span> tragen');
  assert.strictEqual(sysSpan.textContent, cat.s);

  const valuesEm = meta.querySelector('em');
  assert.ok(valuesEm, 'Wertezeile sollte Chance/Hoechstanteil in einer <em> tragen');
  let expected = cat.ch != null ? `${nPctForTest(cat.ch)} %` : '—';
  if (cat.ms != null) expected += ` · ${ctx.T.upTo} ${nPctForTest(cat.ms)} %`;
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
  ctx.elements['wb-preset'].value = 'Voll'; // fires 'change' -> preApply('Voll')

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
// ---------------------------------------------------------------------

test('Reiter-Beschriftung "Fundorte" nennt die Zahl der Paare erst, sobald welche da sind', async () => {
  const ctx = await runAsync({ account: { rows: [] } });
  const tabBtn = ctx.elements['wb-tab-loc'];
  assert.ok(tabBtn, 'wb-tab-loc nicht im Mock-DOM registriert');
  assert.strictEqual(tabBtn.textContent, ctx.T.locations, 'ohne Eintraege traegt der Reiter nur die Beschriftung');

  const loc = realLocOf(ctx, 'Gold');
  selectMineral(ctx, 'Gold');
  ctx.fire(locPinBtn(ctx, 'Gold', loc), 'click');

  assert.strictEqual(tabBtn.textContent, `${ctx.T.locations} · 1`);
});
