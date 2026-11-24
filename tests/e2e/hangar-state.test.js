// Der URL-Zustand des Hangars (assets/hangar-overview.js), mit woertlichen
// URLs: jeder Zustand der Seite ist ein Link, alte '#<id>'-Links landen beim
// richtigen Schiff, und "Link kopieren" nennt immer das Schiff, aber nie die
// persoenlichen Dock-Filter. Dazu die Schiffssuche des Docks (Zweck,
// Filter, Woerter, Tippfehler, Aehnliche). Der Controller hat beim
// Import keine Seiteneffekte, die reinen Funktionen laufen direkt in node.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseState, serializeState, fillMessage, figuresOf, fleetSummary, compareCell, figureText, dockOrder, pickRandom,
  fold, editDistance, parseQuery, findWords, wordScore, dockSearch, shipClass, rankIn, placeOf, placeShip,
  startAmSchirm, START_NENNT,
} from '../../assets/hangar-overview.js';
import { termFrame, termRoute, termTool, termKonto, termAnmeldung, termBlende, termGruss, TERM_GAST, TERM_NEU, TERM_MIN_W, TERM_MIN_K, TERM_NARROW_W } from '../../assets/hangar-terminal.js';

const ctx = {
  ids: new Set(['aegs-gladius', 'anvl-arrow', 'drak-cutlass-black', 'rsi-aurora-mk2']),
  defaultShip: 'aegs-gladius',
  tabs: ['overview', 'weapons', 'systems', 'cargo'],
  sorts: ['name', 'scm', 'max', 'hull', 'shield', 'dps', 'cargo', 'crew', 'len'],
  purs: new Set(['kampf', 'fracht', 'bergbau']),
  grps: new Set(['kampf:leicht', 'kampf:schwer', 'fracht:mittel']),
  sizes: ['klein', 'mittel', 'gross'],
  crews: new Set(['solo', 'klein', 'gross']),
  cargos: new Set([1, 32, 100, 500]),
  prices: new Set([1e6, 3e6, 1e7, 3e7]),
  makers: new Set(['Drake Interplanetary']),
};
const url = (search, hash = '', scope = 'location') => serializeState(parseState(search, hash, ctx), ctx, scope);

describe('Hangar: URL-Zustand', () => {
  test('eine nackte Seite ist das Startschiff im Ueberblick', () => {
    assert.equal(url(''), '');
    assert.deepEqual(parseState('', '', ctx), {
      ship: 'aegs-gladius', tab: 'overview', hp: null, cmp: [], view: 'stage', lo: null, station: 'loadout', flat: false, ort: 'halle',
      fleetOnly: false, sort: 'name', q: '', pur: '', grp: '', size: [], crew: '', cargo: 0, price: 0, maker: '',
    });
  });

  test('alte #id-Links waehlen das Schiff und werden zu ?ship=', () => {
    assert.equal(url('', '#drak-cutlass-black'), '?ship=drak-cutlass-black');
    assert.equal(url('', '#nope'), '');
    assert.equal(url('?ship=anvl-arrow', '#drak-cutlass-black'), '?ship=anvl-arrow');
  });

  test('ein geteilter Link kommt unveraendert zurueck', () => {
    const full = '?ship=drak-cutlass-black&tab=weapons&hp=hardpoint_turret&cmp=drak-cutlass-black,aegs-gladius&view=compare&fleet=1&sort=cargo&q=cutlass'
      + '&pur=kampf&grp=schwer&size=klein,mittel&crew=solo&cargo=100&price=3000000&maker=Drake%20Interplanetary';
    assert.equal(url(full), full);
  });

  test('Vergleichs-Ids sind bekannt, einmalig und hoechstens drei', () => {
    assert.equal(url('?cmp=anvl-arrow,nope,anvl-arrow,aegs-gladius,rsi-aurora-mk2,drak-cutlass-black'), '?cmp=anvl-arrow,aegs-gladius,rsi-aurora-mk2');
    assert.equal(url('?view=compare'), '');
    assert.equal(url('?cmp=anvl-arrow&view=compare'), '?cmp=anvl-arrow');
    assert.equal(url('?cmp=anvl-arrow,aegs-gladius&view=compare'), '?cmp=anvl-arrow,aegs-gladius&view=compare');
  });

  test('einen Hardpoint gibt es nur auf einem Ausstattungs-Tab', () => {
    assert.equal(url('?tab=weapons&hp=hardpoint_gun_nose'), '?tab=weapons&hp=hardpoint_gun_nose');
    assert.equal(url('?hp=hardpoint_gun_nose'), '');
    assert.equal(url('?tab=weapons&hp=<script>'), '?tab=weapons');
  });

  test('unbekannte Werte fallen auf die Vorgabe zurueck', () => {
    assert.equal(url('?ship=nope&tab=nope&sort=nope&pur=nope&grp=nope&size=nope&crew=nope&cargo=99&price=5&maker=nope&fleet=2'), '');
    // ein alter Link mit ?type= (Rolle vor dem Umbau der Suche) faellt weg, statt die Seite zu stoeren
    assert.equal(url('?type=Kampf&ship=anvl-arrow'), '?ship=anvl-arrow');
  });

  test('eine Unterrolle gibt es nur unter ihrem Zweck; Groessen in fester Folge, einmalig', () => {
    assert.equal(url('?grp=schwer'), '');
    assert.equal(url('?pur=fracht&grp=schwer'), '?pur=fracht');
    assert.equal(url('?pur=kampf&grp=schwer'), '?pur=kampf&grp=schwer');
    assert.equal(url('?size=gross,klein,klein,riesig'), '?size=klein,gross');
  });

  test('Link kopieren nennt das Schiff und laesst die Dock-Filter weg', () => {
    assert.equal(url('', '', 'share'), '?ship=aegs-gladius');
    assert.equal(
      url('?ship=drak-cutlass-black&tab=systems&cmp=anvl-arrow&fleet=1&sort=cargo&q=cut&pur=kampf&size=klein&crew=solo&cargo=1&price=1000000&maker=Drake%20Interplanetary', '', 'share'),
      '?ship=drak-cutlass-black&tab=systems&cmp=anvl-arrow',
    );
  });
});

describe('Hangar: Orte der Halle', () => {
  // rsi-aurora-mk2 steht hier fuer ein Bodenfahrzeug (Werkhalle)
  const werk = new Set(['rsi-aurora-mk2']);
  const mit = { ...ctx, werk };
  const ort = (search, scope = 'location') => serializeState(parseState(search, '', mit), mit, scope);
  const c = { ids: ['aegs-gladius', 'anvl-arrow', 'drak-cutlass-black', 'rsi-aurora-mk2'], werk, defaultShip: 'aegs-gladius' };

  test('der Leitstand steht in der Adresse, das Schiffsfeld ist die Vorgabe', () => {
    assert.equal(ort('?ort=leit'), '?ort=leit');
    assert.equal(ort('?ship=anvl-arrow&ort=leit'), '?ship=anvl-arrow&ort=leit');
    assert.equal(ort('?ort=halle'), '');
    assert.equal(ort('?ort=keller'), '');
    assert.equal(parseState('?ort=leit', '', mit).ort, 'leit');
  });

  test('in den Leitstand nur von einem Schiff aus, nicht aus der Werkhalle', () => {
    assert.equal(ort('?ship=rsi-aurora-mk2&ort=leit'), '?ship=rsi-aurora-mk2');
    assert.equal(parseState('?ship=rsi-aurora-mk2&ort=leit', '', mit).ort, 'halle');
  });

  test('wo die Kamera steht, steht nicht im geteilten Link', () => {
    assert.equal(ort('?ship=anvl-arrow&ort=leit', 'share'), '?ship=anvl-arrow');
  });

  test('der Ort folgt dem Fahrzeug, der Leitstand dem Zustand', () => {
    assert.equal(placeOf({ ship: 'aegs-gladius', ort: 'halle' }, werk), 'halle');
    assert.equal(placeOf({ ship: 'rsi-aurora-mk2', ort: 'halle' }, werk), 'werk');
    assert.equal(placeOf({ ship: 'aegs-gladius', ort: 'leit' }, werk), 'leit');
  });

  test('ein Ort zeigt, was passt: das gezeigte, sonst das zuletzt dort gezeigte, sonst die Vorgabe', () => {
    assert.equal(placeShip('halle', 'anvl-arrow', {}, c), 'anvl-arrow');
    assert.equal(placeShip('leit', 'anvl-arrow', {}, c), 'anvl-arrow');
    assert.equal(placeShip('werk', 'anvl-arrow', {}, c), 'rsi-aurora-mk2');
    assert.equal(placeShip('halle', 'rsi-aurora-mk2', { halle: 'drak-cutlass-black' }, c), 'drak-cutlass-black');
    assert.equal(placeShip('halle', 'rsi-aurora-mk2', { halle: 'nope' }, c), 'aegs-gladius');
    assert.equal(placeShip('leit', 'rsi-aurora-mk2', {}, c), 'aegs-gladius');
    assert.equal(placeShip('werk', 'aegs-gladius', {}, { ...c, werk: new Set() }), null);
  });
});

// Einstieg am Bildschirm (Krisz 15.11.2026): Beim ersten Besuch einer Sitzung
// beginnt die Halle im Leitstand, ausser die Adresse nennt selbst etwas. Die
// Regel ist eine reine Funktion; wie Seite und Buehne sie verdrahten, steht
// unten an der Quelle. Vorgefuehrt rot: 32 Eingriffe, jeder reisst den Test,
// der ihn meint (Protokoll bei den Bildern des PR); dazu 8 Eingriffe fuer die
// beiden Tests aus dem Review von PR #388 (rot-review.txt).
describe('Hangar: Einstieg am Bildschirm', () => {
  // Quellen auf LF: unter Windows (core.autocrlf) kommen sie mit CRLF, die
  // Muster unten erwarten \n.
  const seite = fs.readFileSync(new URL('../../assets/hangar-overview.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const buehne = fs.readFileSync(new URL('../../assets/hangar-viewer.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

  test('der erste Besuch einer Sitzung beginnt am Bildschirm, jeder weitere dort, wo die Adresse hinzeigt', () => {
    assert.equal(startAmSchirm('', '', true), true);
    assert.equal(startAmSchirm('', '', false), false);
    // nur ein ausdrueckliches Ja zaehlt: ohne Speicher weiss die Seite nicht, ob es der erste Besuch ist
    for (const v of [undefined, null, 1, 'true']) assert.equal(startAmSchirm('', '', v), false, String(v));
  });

  test('ein Link, der ein Schiff, ein Layout oder einen Vergleich nennt, fuehrt weiter zum Schiff', () => {
    assert.equal(startAmSchirm('?ship=anvl-arrow', '', true), false);
    assert.equal(startAmSchirm('?ship=anvl-arrow&layout=WzEsImEiLHt9XQ', '', true), false);
    assert.equal(startAmSchirm('?layout=WzEsImEiLHt9XQ', '', true), false);
    assert.equal(startAmSchirm('?cmp=anvl-arrow,aegs-gladius&view=compare', '', true), false);
    // das alte '#<id>' waehlt ein Schiff
    assert.equal(startAmSchirm('', '#drak-cutlass-black', true), false);
    // auch ein Schiff, das es nicht mehr gibt, war gemeint
    assert.equal(startAmSchirm('?ship=gibt-es-nicht', '', true), false);
  });

  test('jede Angabe, die die Seite aus der Adresse liest, behaelt ihre Bedeutung; fremde Schluessel nennen nichts', () => {
    for (const k of START_NENNT) {
      assert.equal(startAmSchirm(`?${k}=x`, '', true), false, k);
      assert.equal(startAmSchirm(`?utm_source=x&${k}=`, '', true), false, `${k} ohne Wert`);
    }
    assert.equal(startAmSchirm('?utm_source=discord&fbclid=abc', '', true), true);
    assert.equal(startAmSchirm('?', '', true), true);
    assert.equal(startAmSchirm('', '#', true), true);
  });

  test('die Liste nennt genau die Schluessel, die das Modul aus der Adresse liest', () => {
    // parseState liest ueber p.get('…'), die Schalter der Buehne ueber URLSearchParams(location.search).get('…')
    const kopf = seite.indexOf('export function parseState('), ende = seite.indexOf('\n}\n', kopf);
    assert.ok(kopf > 0 && ende > kopf, 'parseState nicht gefunden');
    const gelesen = new Set([
      ...[...seite.slice(kopf, ende).matchAll(/\bp\.get\('([a-z]+)'\)/g)].map((m) => m[1]),
      ...[...seite.matchAll(/URLSearchParams\(location\.search\)\.get\('([a-z]+)'\)/g)].map((m) => m[1]),
    ]);
    assert.ok(gelesen.size >= 23, `nur ${gelesen.size} Schluessel gefunden: die Probe sieht das Modul nicht mehr`);
    assert.deepEqual([...gelesen].sort(), [...START_NENNT].sort());
    assert.equal(new Set(START_NENNT).size, START_NENNT.length, 'ein Schluessel steht doppelt in der Liste');
    // sonst liest das Modul die Adresse nirgends
    assert.equal((seite.match(/URLSearchParams\(/g) ?? []).length, 5, 'eine neue Stelle liest die Adresse: gehoert ihr Schluessel in START_NENNT?');
  });

  // 18.11.2026: Auf Windows checkt git (core.autocrlf) den Controller mit CRLF aus. Das Geruest suchte die
  // Liste mit einem Muster, das nur \n kannte, fand sie dort nicht, und der Bau riss an /de/hangar.html
  // ("Unexpected token 'S', "START_NENN"... is not valid JSON"). Geprueft wird das Muster des Geruests
  // selbst, an der Quelle des Controllers mit beiden Zeilenenden.
  test('das Geruest findet die Liste im Controller mit LF und mit CRLF', () => {
    const geruest = fs.readFileSync(new URL('../../src/components/hangar/HangarPage.astro', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const stellen = [...geruest.matchAll(/CONTROLLER_SRC\.match\(\/(.+?)\/\)\?\.\[1\]/g)];
    assert.equal(stellen.length, 1, 'das Geruest liest START_NENNT nicht mehr an genau einer Stelle aus der Quelle des Controllers');
    const muster = new RegExp(stellen[0][1]);
    const lf = seite.replace(/\r\n/g, '\n'), crlf = lf.replace(/\n/g, '\r\n');
    assert.ok(crlf.includes('\r\nexport const START_NENNT = ['), 'die Probe mit CRLF traegt keine CRLF');
    for (const [name, quelle] of [['LF', lf], ['CRLF', crlf]]) {
      const roh = muster.exec(quelle)?.[1];
      assert.ok(roh, `mit ${name} findet das Muster des Geruests die Liste nicht: Der Bau der Hangarseite reisst`);
      assert.deepEqual(JSON.parse(roh.replaceAll("'", '"')), START_NENNT, name);
    }
    // Gegenprobe: das alte Muster (nur \n) findet sie mit CRLF nicht
    assert.equal(/\nexport const START_NENNT = (\[[^\]\n]*\]);\n/.exec(crlf), null);
  });

  test('die Seite merkt sich den Besuch in der Sitzung und beginnt nur dort im Leitstand, wo die Halle einen haben wird', () => {
    // erst lesen, dann setzen: Der Besuch gilt ab dem ersten Aufruf, auch wenn er bei einem Schiff begann
    assert.match(seite, /ersterBesuch = sessionStorage\.getItem\(BESUCH_KEY\) === null;\n\s*sessionStorage\.setItem\(BESUCH_KEY, '1'\);/);
    assert.match(seite, /const BESUCH_KEY = 'hg-besuch';/);
    // ohne Speicher kein Einstieg: Die Seite begaenne sonst bei jedem Neuladen wieder am Bildschirm
    assert.match(seite, /\} catch \{ ersterBesuch = false;/);
    assert.match(seite, /if \(startAmSchirm\(location\.search, location\.hash, ersterBesuch\) && guess3d\(\)\) state = normalize\(\{ \.\.\.state, ort: 'leit' \}, ctx\);\n/);
  });

  test('wo der Aufruf im Leitstand beginnt, sitzt die Kamera ohne Fahrt: beim Einstieg wie bei einer Adresse, die den Leitstand nennt', () => {
    // nach der Regel des Einstiegs gelesen, also fuer beide Wege; und nur aus dem Zustand, mit dem die Seite beginnt
    const a = seite.indexOf("if (startAmSchirm(location.search, location.hash, ersterBesuch) && guess3d()) state ="), b = seite.indexOf("let startSitz = state.ort === 'leit';");
    assert.ok(a > 0 && b > a, 'startSitz steht nicht hinter der Regel des Einstiegs');
    assert.equal((seite.slice(a, b).match(/\bstate = /g) ?? []).length, 1, 'zwischen Regel und startSitz aendert etwas den Zustand');
    assert.equal((seite.match(/\bstartSitz = /g) ?? []).length, 3, 'startSitz: einmal gesetzt (Beginn), zweimal zurueckgenommen (applyOrt, commit)');
  });

  test('ohne Fahrt sitzt die Kamera nur beim Einstieg: Der Wunsch gilt einmal, und nur, solange niemand etwas anderes waehlt', () => {
    // der einzige Ruf in den Leitstand reicht den Wunsch weiter und nimmt ihn zurueck
    assert.equal((seite.match(/viewer\.place\('leit'/g) ?? []).length, 1);
    assert.match(seite, /const ship = state\.ship, sitz = startSitz;\n\s*startSitz = false;\n\s*viewer\.place\('leit', sitz\)\.then\(/);
    // jeder andere Zustand nimmt ihn auch zurueck (anderes Schiff, Schiffsfeld, Rueckfall der Buehne)
    assert.match(seite, /state = next;\n\s*\/\/[^\n]*\n\s*if \(state\.ort !== 'leit'\) startSitz = false;\n\s*render\(prev\);/);
    assert.equal((seite.match(/startSitz = true/g) ?? []).length, 0, 'startSitz wird nur aus dem Zustand gesetzt, mit dem die Seite beginnt');
  });

  test('beginnt der Aufruf im Leitstand, wartet das erste Bild laenger auf die Halle, aber nicht ohne Frist', () => {
    // die Seite sagt es der Buehne mit dem ersten Schiff
    assert.match(seite, /viewer\.show\(glb, \{ maker, tex, ort, id, hangar, label: labelOf\(id\), sitz: startSitz \}\)/);
    assert.equal((seite.match(/viewer\.show\(/g) ?? []).length, 1);
    // die Buehne wartet dann SITZ_FRIST statt 6 s, und nur vor dem ersten Bild einer Halle mit Leitstand
    assert.match(buehne, /if \(REAL && !revealed\) \{\n(?:\s*\/\/[^\n]*\n)*\s*await Promise\.race\(\[hallSettled, sleep\(o\.sitz && LEIT \? SITZ_FRIST : 6000\)\]\);/);
    const frist = Number(buehne.match(/\nconst SITZ_FRIST = (\d+);\n/)?.[1]);
    assert.ok(frist >= 15000 && frist <= 60000, `SITZ_FRIST ${frist}: unter 15 s kaeme das Schiff an einer langsamen Leitung doch ohne Halle, ueber 60 s stuende nur der Ladebalken da`);
  });

  test('die Buehne setzt die Kamera nur dann ohne Fahrt, wenn der Wunsch nicht warten musste', () => {
    assert.match(buehne, /place: \(name, sitz = false\) => \{ placeWish\+\+; return name === 'leit' \? leitGo\(sitz === true\) : leitLeave\(\); \},/);
    const a = buehne.indexOf('async function leitGo(sitz = false) {'), z = buehne.indexOf('async function leitLeave(', a);
    assert.ok(a > 0 && z > a, 'leitGo nicht gefunden');
    const go = buehne.slice(a, z);
    assert.match(go, /if \(reduceMotion \|\| sitz\) \{/);
    // vor jedem Warten faellt der Wunsch: Danach steht das Feld im Bild, und ein Sprung waere ein Schnitt
    const vor = go.slice(0, go.indexOf('if (reduceMotion || sitz) {'));
    const warten = [...vor.matchAll(/await [^;]+;/g)].map((m) => m[0]);
    assert.deepEqual(warten, ['await hallSettled;', 'await post.gone;', 'await trip.done;']);
    for (const w of warten) {
      const i = vor.indexOf(w), davor = vor.slice(Math.max(0, i - 40), i);
      assert.match(davor, /sitz = false;\s*$/, `vor „${w}“ faellt der Wunsch nicht`);
    }
  });

  test('am Schreibtisch bleibt die lange Erklaerung der Schiffsauswahl zu und ungesehen (Hinweise statt Textwand); am Telefon geht sie beim ersten Besuch auf wie bisher', () => {
    // assets/tool-help.js laeuft hier wie beim Laden der Seite, mit einem Abschnitt und nachgestellter Ablage
    const hilfe = fs.readFileSync(new URL('../../assets/tool-help.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const lauf = (aus, gesehen) => {
      const sec = { open: false, getAttribute: (n) => (n === 'data-tool-id' ? 'hangar' : null), closest: (sel) => (aus && sel === '[data-help-auto="aus"]' ? {} : null), contains: () => false, compareDocumentPosition: () => 0 };
      let ablage = gesehen ? '{"hangar":1}' : null, schrieb = 0;
      new Function('window', 'document', 'localStorage', 'Node', hilfe)(
        { innerHeight: 900, innerWidth: 1600 },
        { querySelectorAll: (sel) => (sel === 'details.tool-help' ? [sec] : []), addEventListener() {} },
        { getItem: () => ablage, setItem: (k, v) => { ablage = v; schrieb++; } },
        { DOCUMENT_POSITION_FOLLOWING: 4 },
      );
      return { offen: sec.open, gesehen: /"hangar":1/.test(ablage ?? ''), schrieb };
    };
    // das Geruest schiebt sie auf: zu, nicht vermerkt, nichts geschrieben
    assert.deepEqual(lauf(true, false), { offen: false, gesehen: false, schrieb: 0 });
    // ohne die Angabe wie bisher: auf und vermerkt, mit einem Schreiben
    assert.deepEqual(lauf(false, false), { offen: true, gesehen: true, schrieb: 1 });
    // schon gesehen: zu, mit und ohne Angabe
    assert.deepEqual(lauf(false, true), { offen: false, gesehen: true, schrieb: 0 });
    assert.deepEqual(lauf(true, true), { offen: false, gesehen: true, schrieb: 0 });
    // das Geruest sagt es fuer jeden Aufruf am Schreibtisch, vor jedem Zugriff auf den Speicher (Hangar-Politur 22.11.2026)
    const geruest = fs.readFileSync(new URL('../../src/components/hangar/HangarPage.astro', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.match(geruest, /try\{var t=matchMedia\('\(max-width: 760px\), \(pointer: coarse\)'\)\.matches;if\(!t\)m\.dataset\.helpAuto='aus';/);
    assert.equal((geruest.match(/helpAuto/g) ?? []).length, 1, 'data-help-auto wird an einer zweiten Stelle gesetzt');
    // der Controller liest den alten Ort nicht aus dem Dokument: Dort steht der Leitstand schon vor seinem ersten
    // Durchlauf, und eine offene Erklaerung bliebe ueber dem Monitor
    assert.match(seite, /const before = ortGemalt;\n\s*ortGemalt = at;\n\s*main\.dataset\.ort = at;/);
    const ohneKommentar = seite.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.equal((ohneKommentar.match(/main\.dataset\.ort\b/g) ?? []).length, 1, 'main.dataset.ort wird nur geschrieben, nie gelesen');
    assert.match(seite, /if \(leit && before !== 'leit'\) main\.querySelector\('\.hg-dock details\.tool-help\[open\]'\)\?\.removeAttribute\('open'\);/);
  });

  // Review PR #388: Der Controller beginnt nur im Leitstand, wenn er den Besuch auch schreiben konnte. Das
  // Geruest entschied allein nach dem Lesen. Liess sich die Sitzung lesen, aber nicht beschreiben, setzte es
  // den Leitstand und schob die Erklaerung auf, der Controller begann auf dem Feld, und die Erklaerung blieb
  // dort bei jedem Aufruf zu.
  test('laesst sich die Sitzung lesen, aber nicht beschreiben, bleibt es im Geruest wie im Controller beim Feld', () => {
    const geruest = fs.readFileSync(new URL('../../src/components/hangar/HangarPage.astro', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const roh = /<script is:inline set:html=\{`(\(function\(m\)\{[^`]*)`\}><\/script>/.exec(geruest)?.[1] ?? '';
    assert.ok(roh.includes("m.dataset.ort='leit'"), 'das Inline-Skript in <main> nicht gefunden');
    assert.equal(roh.split('${jsonForScript(START_NENNT)}').length, 2, 'die Liste steht nicht mehr genau einmal im Inline-Skript');
    const skript = roh.replace('${jsonForScript(START_NENNT)}', JSON.stringify(START_NENNT));
    // sitzung: 'gut' | 'nurLesen' (Schreiben wirft) | 'zu' (jeder Zugriff wirft)
    const lauf = (q, sitzung, besuch = null) => {
      const m = { dataset: {} }, liegt = new Map(besuch === null ? [] : [['hg-besuch', besuch]]);
      const zu = () => { throw new Error('gesperrt'); };
      new Function('document', 'localStorage', 'sessionStorage', 'location', 'matchMedia', skript)(
        { currentScript: { parentElement: m } },
        { getItem: () => null },
        sitzung === 'zu' ? { getItem: zu, setItem: zu, removeItem: zu } : {
          getItem: (k) => (liegt.has(k) ? liegt.get(k) : null),
          setItem: (k, v) => { if (sitzung === 'nurLesen') zu(); liegt.set(k, String(v)); },
          removeItem: (k) => { liegt.delete(k); },
        },
        { search: q, hash: '' },
        () => ({ matches: false }),
      );
      return { ort: m.dataset.ort ?? null, hilfe: m.dataset.helpAuto ?? null, liegt: [...liegt.keys()] };
    };
    // wie bisher: erster Besuch, die Sitzung nimmt an
    assert.deepEqual(lauf('', 'gut'), { ort: 'leit', hilfe: 'aus', liegt: [] }, 'das Geruest vermerkt den Besuch nicht selbst und raeumt seine Probe weg');
    // der Fall aus dem Review: Feld; die lange Erklaerung bleibt am Schreibtisch trotzdem zu, dort zeigen die
    // kurzen Hinweise (Hangar-Politur 22.11.2026)
    assert.deepEqual(lauf('', 'nurLesen'), { ort: null, hilfe: 'aus', liegt: [] });
    assert.deepEqual(lauf('', 'zu'), { ort: null, hilfe: 'aus', liegt: [] });
    // ein spaeterer Besuch fragt nicht nach dem Schreiben
    assert.deepEqual(lauf('', 'gut', '1'), { ort: null, hilfe: 'aus', liegt: ['hg-besuch'] });
    // nennt die Adresse den Leitstand, fragt niemand den Speicher (der Controller liest ihn dafuer auch nicht)
    for (const sitzung of ['gut', 'nurLesen', 'zu']) assert.deepEqual(lauf('?ort=leit', sitzung), { ort: 'leit', hilfe: 'aus', liegt: [] }, sitzung);
    // der Controller: Scheitert das Schreiben, gilt der Besuch nicht als erster (dieselbe Antwort wie oben)
    assert.match(seite, /try \{\n\s*ersterBesuch = sessionStorage\.getItem\(BESUCH_KEY\) === null;\n\s*sessionStorage\.setItem\(BESUCH_KEY, '1'\);\n\s*\} catch \{ ersterBesuch = false;/);
  });

  // Review PR #388: Die Halle korrigiert die Startansicht, wenn ihre Sonde da ist. Sass die Kamera dann schon im
  // Leitstand (die Halle gebaut, die Sonde haengt, nach SITZ_FRIST beginnt der Aufruf ohne sie), setzte homePos()
  // sie vom Blickpunkt am Monitor aus ins Leere, der Zustand blieb „Leitstand“. Heute nennt die Seite keiner
  // Halle eine Sonde, die Stelle ist also noch nicht zu erreichen; in der echten Halle ist sie nachgestellt.
  test('kommt die Sonde der Halle erst, wenn die Kamera im Leitstand sitzt, bleibt sie dort; korrigiert wird der gemerkte Platz auf dem Feld', () => {
    assert.match(buehne, /\n\s+if \(post\) \{ if \(!post\.saved\.touched\) post\.saved\.p\.copy\(homeDir\(\)\)\.multiplyScalar\(homeDist\(\) \/ hallRoot\.scale\.x\)\.add\(post\.saved\.t\); \}\n\s+else if \(fly\) fly\.b\.radius = Math\.min\(fly\.b\.radius, homeDist\(\)\);\n\s+else if \(!touched\) camera\.position\.copy\(homePos\(\)\);\n/);
    // sonst setzt nur der Aufbau die Kamera so (vor jeder Halle): keine zweite Stelle ohne die Frage nach post
    assert.equal((buehne.match(/camera\.position\.copy\(homePos\(\)\)/g) ?? []).length, 2);
    // der gemerkte Platz steht in Hallenmetern und kommt so zurueck (leitGo, leitLeave)
    assert.match(buehne, /saved: \{ t: controls\.target\.clone\(\)\.divideScalar\(k\), p: camera\.position\.clone\(\)\.divideScalar\(k\), touched, onPoint, panned \}/);
    assert.match(buehne, /controls\.target\.copy\(me\.saved\.t\)\.multiplyScalar\(k\);\n\s*camera\.position\.copy\(me\.saved\.p\)\.multiplyScalar\(k\);/);
    // und die Startansicht ist die Richtung mal Abstand ab dem Ziel
    assert.match(buehne, /const homePos = \(\) => homeDir\(\)\.clone\(\)\.multiplyScalar\(homeDist\(\)\)\.add\(controls\.target\);/);
  });
});

describe('Hangar: Terminal im Leitstand', () => {
  const hier = 'https://staging.example/de/hangar.html?ort=leit';
  const tools = [
    { key: 'schiffe', pre: ['/schiffe.html', '/schiffe/'] },
    { key: 'crafting', pre: ['/topics/crafting', '/crafting/'] },
    { key: 'archiv', pre: ['/archiv.html', '/patches/', '/topics/'] },
  ];

  test('der Kasten steht in voller Breite und verkleinert, bis die Schrift zu klein wuerde', () => {
    assert.deepEqual(termFrame(1336, 696), { w: 1336, h: 696, k: 1 });
    assert.deepEqual(termFrame(888, 462), { w: TERM_MIN_W, h: 616, k: 0.75 });
    assert.deepEqual(termFrame(1005, 525), { w: TERM_MIN_W, h: 619, k: 1005 / TERM_MIN_W });
  });

  test('im schmalen Fenster steht die Seite schmaler statt kleiner, aber nie in der Telefonansicht', () => {
    // halbes Fenster auf dem Monitor: frueher Massstab 0,55, die Schrift unlesbar
    assert.deepEqual(termFrame(660, 520), { w: 880, h: 693, k: 0.75 });
    const f = termFrame(700.4, 380.2);
    assert.equal(f.w, 933);
    assert.ok(Math.abs(f.k - TERM_MIN_K) < 0.001);
    assert.ok(Math.abs(f.w * f.k - 700) < 1e-9 && Math.abs(f.h * f.k - 380) < 1);
    // darunter gibt es nur noch die Telefonansicht: dann lieber kleiner
    assert.deepEqual(termFrame(420, 300), { w: TERM_NARROW_W, h: 600, k: 0.5 });
    assert.ok(TERM_NARROW_W > 820);
  });

  test('Seiten der Website bleiben im Fenster, in jeder Sprache', () => {
    assert.deepEqual(termRoute('/de/schiffe/aegs-gladius.html', hier), { art: 'innen' });
    assert.deepEqual(termRoute('../items.html#waffen', hier), { art: 'innen' });
    assert.deepEqual(termRoute('mailto:hallo@example.org', hier), { art: 'innen' });
  });

  test('ein Link zum Hangar holt das Schiff aufs Feld statt eine zweite Halle zu laden', () => {
    assert.deepEqual(termRoute('/de/hangar.html?ship=anvl-arrow', hier), { art: 'hangar', ship: 'anvl-arrow' });
    assert.deepEqual(termRoute('/hangar.html', hier), { art: 'hangar', ship: null });
    assert.deepEqual(termRoute('/de/hangar-loadout.html?l=abc', hier), { art: 'tab' });
    assert.deepEqual(termRoute('/hangar-bay/aegs-gladius', hier), { art: 'tab' });
  });

  test('Kontoseiten bleiben im Fenster (dritte Runde, 15.11.2026: Konto, Anmelden und Registrieren auf dem Bildschirm)', () => {
    assert.deepEqual(termRoute('/de/account.html', hier), { art: 'innen' });
    assert.deepEqual(termRoute('/account/login.html?next=%2Fde%2Faccount.html', hier), { art: 'innen' });
    assert.deepEqual(termRoute('/de/account/register.html', hier), { art: 'innen' });
    // der Knopf des Kontos ist dort der aktive Bereich; Anmelden und Registrieren halten die Begruessung zurueck
    assert.equal(termKonto('/de/account.html'), true);
    assert.equal(termKonto('/account/login.html'), true);
    assert.equal(termKonto('/accounting.html'), false);
    assert.equal(termKonto('/de/schiffe.html'), false);
    assert.equal(termAnmeldung('/de/account/login.html'), true);
    assert.equal(termAnmeldung('/account/register.html'), true);
    assert.equal(termAnmeldung('/de/account.html'), false);
    assert.equal(termAnmeldung('/de/account/'), false);
    assert.equal(termAnmeldung('/de/account/reset.html'), false);
  });

  test('die Blende kommt einmal je Sitzung, der Gruss gilt dem Alter des Kontos', () => {
    assert.equal(termBlende(null, ''), true);
    assert.equal(termBlende(TERM_GAST, ''), false);
    assert.equal(termBlende(TERM_GAST, 'u1'), true);
    assert.equal(termBlende('u1', 'u1'), false);
    assert.equal(termBlende('u1', ''), true);
    assert.equal(termBlende('u1', 'u2'), true);
    const jetzt = Date.UTC(2026, 10, 15, 16, 4);
    assert.equal(termGruss('2026-11-15T16:00:00Z', jetzt), 'hallo');
    assert.equal(termGruss(new Date(jetzt - TERM_NEU - 1000).toISOString(), jetzt), 'zurueck');
    assert.equal(termGruss('2026-03-02T10:00:00Z', jetzt), 'zurueck');
    // ohne lesbaren Zeitstempel oder mit einem aus der Zukunft: der schlichte Gruss
    assert.equal(termGruss('', jetzt), 'hallo');
    assert.equal(termGruss('gestern', jetzt), 'hallo');
    assert.equal(termGruss('2027-01-01T00:00:00Z', jetzt), 'hallo');
  });

  test('fremde Seiten oeffnen einen eigenen Tab', () => {
    assert.deepEqual(termRoute('https://robertsspaceindustries.com/', hier), { art: 'tab' });
    assert.deepEqual(termRoute('//staging.example.evil.test/de/schiffe.html', hier), { art: 'tab' });
    // gleicher Name, anderes Protokoll: ein anderer Ursprung
    assert.deepEqual(termRoute('http://staging.example/de/schiffe.html', hier), { art: 'tab' });
  });

  test('der Reiter folgt dem Pfad: laengster Anfang gewinnt, die Sprache zaehlt nicht', () => {
    assert.equal(termTool('/de/topics/crafting.html', tools), 'crafting');
    assert.equal(termTool('/topics/4-0-0-pyro-system.html', tools), 'archiv');
    assert.equal(termTool('/de/schiffe/aegs-gladius.html', tools), 'schiffe');
    assert.equal(termTool('/de/feedback.html', tools), null);
    assert.equal(termTool('/de', tools), null);
  });
});

describe('Hangar: Dock-Daten und Flottenzeile', () => {
  test('data-v liest sich in der Folge von data-stats; "-" ist unbekannt, 0 bleibt 0', () => {
    assert.deepEqual(figuresOf(['scm', 'cargo', 'crew', 'price'], '1193 0 1 -'), { scm: 1193, cargo: 0, crew: 1, price: null });
    assert.deepEqual(figuresOf(['dps', 'len'], '1944.5'), { dps: 1944.5, len: null });
  });

  test('die Flottenzeile summiert Fracht und Crew und zaehlt Rollenfamilien, fremde Ids nicht', () => {
    const ships = new Map([
      ['aegs-gladius', { stat: { cargo: 0, crew: 1 }, fam: ['jaeger'] }],
      ['drak-cutlass-black', { stat: { cargo: 46, crew: 2 }, fam: ['frachttransport', 'jaeger'] }],
      ['argo-atls', { stat: { cargo: null, crew: null }, fam: [] }],
    ]);
    assert.deepEqual(
      fleetSummary(['aegs-gladius', 'drak-cutlass-black', 'argo-atls', 'nope'], ships),
      { n: 3, scu: 46, crew: 3, roles: 2 },
    );
    assert.deepEqual(fleetSummary([], ships), { n: 0, scu: 0, crew: 0, roles: 0 });
  });
});

describe('Hangar: Vergleichszellen', () => {
  const speed = { digits: 0, unit: 'm/s', better: 1 };
  test('Abweichung mit Vorzeichen und Einheit, Ton nach der Richtung von "besser"', () => {
    assert.deepEqual(compareCell(1150, 1193, speed, 'en-US'), { value: '1,150 m/s', delta: '-43 m/s', tone: 'down' });
    assert.deepEqual(compareCell(29760, 6110, { digits: 0, unit: 'HP', better: 1 }, 'de-DE'), { value: '29.760 HP', delta: '+23.650 HP', tone: 'up' });
    assert.deepEqual(compareCell(2010960, 2262330, { digits: 0, unit: 'aUEC', better: -1 }, 'en-US'), { value: '2,010,960 aUEC', delta: '-251,370 aUEC', tone: 'up' });
    assert.deepEqual(compareCell(37.5, 21, { digits: 1, unit: 'm', better: 0 }, 'de-DE'), { value: '37,5 m', delta: '+16,5 m', tone: 'flat' });
  });

  test('Rundung auf die Stellen des Kennwerts, keine Abweichung ohne Basis, Wert oder Unterschied', () => {
    assert.deepEqual(compareCell(2797.8, 1944.5, { digits: 1, unit: 'DPS', better: 1 }, 'en-US'), { value: '2,797.8 DPS', delta: '+853.3 DPS', tone: 'up' });
    assert.deepEqual(compareCell(1193, null, speed, 'en-US'), { value: '1,193 m/s', delta: null, tone: null });
    assert.deepEqual(compareCell(null, 1193, speed, 'en-US'), { value: '–', delta: null, tone: null });
    assert.deepEqual(compareCell(3, 3, { digits: 0, unit: '', better: 0 }, 'en-US'), { value: '3', delta: null, tone: null });
  });
});

describe('Hangar: Sortierung und Zufallsschiff', () => {
  const ships = [
    { id: 'aegs-gladius', stat: { cargo: 0, scm: 226 } },
    { id: 'anvl-arrow', stat: { cargo: null, scm: 229 } },
    { id: 'drak-caterpillar', stat: { cargo: 576, scm: 155 } },
    { id: 'drak-cutlass-black', stat: { cargo: 46, scm: 217 } },
    { id: 'rsi-aurora-mk2', stat: { cargo: 46, scm: null } },
  ];
  test('Kennwerte absteigend, ohne Wert ans Ende, Gleichstand in Namensfolge; Name ist die gebaute Folge', () => {
    assert.deepEqual(dockOrder(ships, 'cargo'), ['drak-caterpillar', 'drak-cutlass-black', 'rsi-aurora-mk2', 'aegs-gladius', 'anvl-arrow']);
    assert.deepEqual(dockOrder(ships, 'scm'), ['anvl-arrow', 'aegs-gladius', 'drak-cutlass-black', 'drak-caterpillar', 'rsi-aurora-mk2']);
    assert.deepEqual(dockOrder(ships, 'name'), ['aegs-gladius', 'anvl-arrow', 'drak-caterpillar', 'drak-cutlass-black', 'rsi-aurora-mk2']);
  });

  test('der Wert auf der Karte liest sich wie in der Tafel', () => {
    assert.equal(figureText(576, { digits: 0, unit: 'SCU' }, 'de-DE'), '576 SCU');
    assert.equal(figureText(1944.5, { digits: 1, unit: 'DPS' }, 'de-DE'), '1.944,5 DPS');
    assert.equal(figureText(null, { digits: 0, unit: 'SCU' }, 'en-US'), '–');
  });

  test('das Zufallsschiff kommt aus den sichtbaren und ist nie das gezeigte', () => {
    assert.equal(pickRandom(['a', 'b', 'c'], 'b', () => 0), 'a');
    assert.equal(pickRandom(['a', 'b', 'c'], 'b', () => 0.99), 'c');
    assert.equal(pickRandom(['b'], 'b', () => 0.5), null);
    assert.equal(pickRandom([], 'b', () => 0.5), null);
  });
});

describe('Hangar: Vorlagen aus dem Markup', () => {
  test('Mehrzahlform und Zahlengruppen je Sprache', () => {
    assert.equal(fillMessage({ one: '{n} Schiff', other: '{n} Schiffe' }, { n: 1 }, 'de-DE'), '1 Schiff');
    assert.equal(fillMessage({ one: '{n} Schiff', other: '{n} Schiffe' }, { n: 1227 }, 'de-DE'), '1.227 Schiffe');
    assert.equal(fillMessage({ one: '{n} ship', other: '{n} ships' }, { n: 227 }, 'en-US'), '227 ships');
  });
});

// Ein Ausschnitt des echten Vokabulars (src/lib/hangar/finder.ts vocab()).
const vocab = {
  pur: [
    { k: 'kampf', w: ['kampf', 'combat', 'jäger', 'fighter'] },
    { k: 'fracht', w: ['fracht', 'cargo', 'frachter', 'hauler'] },
    { k: 'bergbau', w: ['bergbau', 'mining', 'miner'] },
    { k: 'erkundung', w: ['erkundung', 'exploration', 'expedition'] },
  ],
  grp: [
    { k: 'kampf:schwer', w: ['schwere jäger', 'schwerer jäger', 'heavy fighter'] },
    { k: 'erkundung:expedition', w: ['expedition'] },
  ],
  size: [{ k: 'klein', w: ['klein', 'small'] }, { k: 'mittel', w: ['mittel', 'medium'] }, { k: 'gross', w: ['groß', 'large'] }],
  crew: [{ k: 'solo', w: ['solo', 'allein'] }],
  maker: [{ k: 'Drake Interplanetary', w: ['drake interplanetary', 'drake', 'drak'] }],
  nick: { cutty: 'cutlass', prospi: 'prospector' },
};
const crew = { solo: { min: 1, max: 1 }, klein: { min: 2, max: 4 }, gross: { min: 5, max: null } };
const ship = (id, name, maker, tags, rest) => ({ id, ...findWords(name, maker, tags), maker, pur: [], grp: [], size: '', stat: {}, ...rest });
const fleet = [
  ship('aegs-gladius', 'Gladius', 'Aegis Dynamics', 'leichter jager kampf klein', { pur: ['kampf'], grp: ['kampf:leicht'], size: 'klein', stat: { crew: 1, cargo: 0, len: 20, dps: 1900, price: 800000 } }),
  ship('anvl-hornet-f7c-mk2', 'F7C Hornet Mk II', 'Anvil Aerospace', 'mittlerer jager kampf klein', { pur: ['kampf'], grp: ['kampf:mittel'], size: 'klein', stat: { crew: 1, cargo: 2, len: 22, dps: 2600, price: 1500000 } }),
  ship('anvl-hornet-f7a-mk2', 'F7A Hornet Mk II', 'Anvil Aerospace', 'mittlerer jager kampf klein', { pur: ['kampf'], grp: ['kampf:mittel'], size: 'klein', stat: { crew: 1, cargo: 0, len: 22, dps: 3000, price: null } }),
  ship('aegs-sabre', 'Sabre', 'Aegis Dynamics', 'mittlerer jager kampf klein', { pur: ['kampf'], grp: ['kampf:mittel'], size: 'klein', stat: { crew: 1, cargo: 0, len: 26, dps: 2500, price: null } }),
  ship('drak-cutlass-black', 'Cutlass Black', 'Drake Interplanetary', 'mittlerer frachter fracht kampf mittel', { pur: ['fracht', 'kampf'], grp: ['fracht:mittel'], size: 'mittel', stat: { crew: 2, cargo: 46, len: 38, dps: 1600, price: 1400000 } }),
  ship('drak-mule', 'Mule', 'Drake Interplanetary', 'fracht fahrzeug', { pur: ['fracht'], size: 'fahrzeug', stat: { crew: 1, cargo: 6, len: 5, price: 50000 } }),
  ship('argo-mole', 'MOLE', 'Argo Astronautics', 'bergbau mittel', { pur: ['bergbau'], size: 'mittel', stat: { crew: 4, cargo: 96, len: 40, price: 4900000 } }),
  ship('misc-prospector', 'Prospector', 'Musashi Industrial and Starflight Concern', 'bergbau klein', { pur: ['bergbau'], size: 'klein', stat: { crew: 1, cargo: 32, len: 24, price: 2000000 } }),
  ship('misc-hull-a', 'Hull A', 'Musashi Industrial and Starflight Concern', 'leichter frachter fracht klein', { pur: ['fracht'], size: 'klein', stat: { crew: 1, cargo: 64, len: 30, price: 1600000 } }),
  ship('rsi-constellation-andromeda', 'Constellation Andromeda', 'Roberts Space Industries', 'kanonenschiff kampf fracht gross', { pur: ['kampf', 'fracht'], size: 'gross', stat: { crew: 4, cargo: 96, len: 61, dps: 4000, price: 7000000 } }),
  ship('rsi-carrack', 'Carrack', 'Anvil Aerospace', 'expedition erkundung gross', { pur: ['erkundung'], grp: ['erkundung:expedition'], size: 'gross', stat: { crew: 6, cargo: 456, len: 126, price: 30000000 } }),
  ship('rsi-pisces-expedition', 'C8X Pisces Expedition', 'Anvil Aerospace', 'erkundung beiboot', { pur: ['erkundung'], size: 'beiboot', stat: { crew: 2, cargo: 4, len: 13, price: 700000 } }),
];
const find = (q, over = {}) => {
  const p = parseQuery(q, vocab);
  return [...dockSearch(fleet, { hits: p.hits, words: p.words, ...over }, crew)].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
};

describe('Hangar: Schiffssuche', () => {
  test('fold spricht dieselben Woerter wie finder.ts: klein, ohne Akzente, ß als ss', () => {
    assert.equal(fold('  Großer  JÄGER '), 'grosser jager');
    assert.equal(fold("San'tok.yāi"), 'santok.yai');
  });

  test('Tippfehler-Abstand mit Vertauschung, Abbruch ueber max', () => {
    assert.equal(editDistance('prospektor', 'prospector'), 1);
    assert.equal(editDistance('carrakc', 'carrack'), 1);
    assert.equal(editDistance('gladius', 'cutlass', 2), 3);
  });

  test('die Suche erkennt Zweck, Crew, Groesse, Hersteller und Zahlen und laesst den Rest als Woerter', () => {
    assert.deepEqual(parseQuery('Bergbau  solo', vocab), {
      hits: [{ kind: 'pur', key: 'bergbau', t: 'bergbau' }, { kind: 'crew', key: 'solo', t: 'solo' }], words: [],
    });
    assert.deepEqual(parseQuery('schwerer Jäger', vocab).hits, [{ kind: 'grp', key: 'kampf:schwer', t: 'schwerer jager' }]);
    assert.deepEqual(parseQuery('ab 100 scu drake', vocab).hits, [{ kind: 'cargo', key: 100, t: 'ab 100 scu' }, { kind: 'maker', key: 'Drake Interplanetary', t: 'drake' }]);
    assert.deepEqual(parseQuery('unter 2 mio', vocab).hits, [{ kind: 'price', key: 2e6, t: 'unter 2 mio' }]);
    assert.deepEqual(parseQuery('under 3', vocab).hits, [{ kind: 'price', key: 3e6, t: 'under 3' }]);
    assert.deepEqual(parseQuery('cutty black', vocab), { hits: [], words: ['cutlass', 'black'] });
  });

  test('ohne Namen finden: Zweck und Crew grenzen ein, Arten verknuepft mit und', () => {
    assert.deepEqual(find('bergbau solo'), ['misc-prospector']);
    assert.deepEqual(find('miner'), ['argo-mole', 'misc-prospector']);
    assert.deepEqual(find('fracht ab 40 scu'), ['drak-cutlass-black', 'misc-hull-a', 'rsi-constellation-andromeda']);
    assert.deepEqual(find('fracht ab 50 scu'), ['misc-hull-a', 'rsi-constellation-andromeda']);
    assert.deepEqual(find('klein mittel bergbau'), ['argo-mole', 'misc-prospector']);
    assert.deepEqual(find('kampf unter 1,5 mio'), ['aegs-gladius', 'anvl-hornet-f7c-mk2', 'drak-cutlass-black']);
  });

  test('ein erkannter Begriff im Namen zaehlt auch, und vorn', () => {
    assert.deepEqual(find('expedition'), ['rsi-pisces-expedition', 'rsi-carrack']);
  });

  test('Name vor Hersteller vor Rolle, Wortanfang und Spitzname, Tippfehler nur wenn sonst nichts trifft', () => {
    assert.deepEqual(find('hornet'), ['anvl-hornet-f7a-mk2', 'anvl-hornet-f7c-mk2']);
    assert.deepEqual(find('f7c'), ['anvl-hornet-f7c-mk2']);
    assert.deepEqual(find('cutty'), ['drak-cutlass-black']);
    assert.deepEqual(find('prospektor'), ['misc-prospector']);
    assert.deepEqual(find('mole'), ['argo-mole']);
    assert.deepEqual(find('mul'), ['drak-mule']);
    const by = (id) => fleet.find((x) => x.id === id);
    assert.equal(wordScore('anvil', by('anvl-hornet-f7c-mk2')), 60);
    assert.equal(wordScore('frachter', by('drak-cutlass-black')), 40);
    assert.equal(wordScore('glad', by('aegs-gladius')), 80);
  });

  test('Filter aus den Pillen gelten hart, die Flotte als Menge', () => {
    assert.deepEqual(find('', { pur: 'kampf', size: ['klein'], crew: 'solo' }), ['aegs-gladius', 'aegs-sabre', 'anvl-hornet-f7a-mk2', 'anvl-hornet-f7c-mk2']);
    assert.deepEqual(find('', { cargo: 100 }), ['rsi-carrack']);
    assert.deepEqual(find('', { price: 1e6 }), ['aegs-gladius', 'drak-mule', 'rsi-pisces-expedition']);
    assert.deepEqual(find('', { crew: 'gross' }), ['rsi-carrack']);
    assert.deepEqual(find('', { grp: 'fracht:mittel' }), ['drak-cutlass-black']);
    assert.deepEqual(find('', { maker: 'Drake Interplanetary', only: new Set(['drak-mule', 'aegs-gladius']) }), ['drak-mule']);
    assert.deepEqual(find('xyzzy'), []);
  });
});

describe('Hangar: Rang in der Klasse (Station Uebersicht)', () => {
  // Wie die Dock-Abbildung: find traegt Unterrollen und Groesse der Karte
  const ship = (id, grp, size, stat) => [id, { id, find: { grp, size }, stat }];
  const fighters = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ship(id, ['kampf:leicht'], 'klein', { scm: [200, 230, 230, 180, null][i], dps: 100 + i }));
  const ships = new Map([
    ...fighters,
    ship('f', ['kampf:schwer'], 'klein', { scm: 150, dps: 900 }),
    ship('g', [], 'gross', { scm: 90, dps: 10 }),
  ]);

  test('Klasse ist die erste Unterrolle, mit zu wenigen Schiffen die Groesse, sonst keine', () => {
    assert.deepEqual(shipClass(ships, 'a'), { kind: 'grp', key: 'kampf:leicht', ids: ['a', 'b', 'c', 'd', 'e'] });
    // nur ein schwerer Jaeger: die Groesse (sechs kleine Schiffe)
    assert.deepEqual(shipClass(ships, 'f'), { kind: 'size', key: 'klein', ids: ['a', 'b', 'c', 'd', 'e', 'f'] });
    assert.equal(shipClass(ships, 'g'), null);
    assert.equal(shipClass(ships, 'nope'), null);
  });

  test('Platz: groesser ist besser, Gleichstand teilt, unbekannte Werte zaehlen nicht', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    assert.deepEqual(rankIn(ships, ids, 'b', 'scm'), { n: 1, of: 5 });
    assert.deepEqual(rankIn(ships, ids, 'c', 'scm'), { n: 1, of: 5 });
    assert.deepEqual(rankIn(ships, ids, 'a', 'scm'), { n: 3, of: 5 });
    assert.deepEqual(rankIn(ships, ids, 'f', 'dps'), { n: 1, of: 6 });
    // ohne eigenen Wert und unter fuenf Werten kein Platz
    assert.equal(rankIn(ships, ids, 'e', 'scm'), null);
    assert.equal(rankIn(ships, ['a', 'b', 'c', 'd'], 'a', 'dps'), null);
  });
});
