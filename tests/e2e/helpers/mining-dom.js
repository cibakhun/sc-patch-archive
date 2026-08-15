// tests/e2e/helpers/mining-dom.js — Steuerbares Mock-DOM fuer den
// Rundlauf-Nachweis der Mining-Werkbank-Fundort-Merkliste (Phase 9, Plan 01,
// Task 2).
//
// Eigenstaendig, wie tests/e2e/helpers/ships-dom.js -- dom-mock.js ist fest
// auf die Item-Finder-Element-Ids (uif-*) verdrahtet und wird hier bewusst
// NICHT erweitert; MockElement wird wiederverwendet, soweit ihre API traegt
// (getAttribute/setAttribute/appendChild/addEventListener/dispatchEvent/
// querySelector(All)/value/textContent/innerHTML/style).
//
// Vier Dinge fehlen der geerbten Element-Klasse und entstehen hier neu:
//   1. closest() -- mining-workbench.js ruft es fuer '.wb', '[data-pin]',
//      '.wb__tile', '[data-sys]', '[data-seg]', '[data-locpin]', seit Phase 10
//      (10-01) zusaetzlich '[data-preset]', '[data-pre-pick]',
//      '[data-pre-rename]', seit Phase 12 zusaetzlich '[data-back]',
//      '[data-loc]', '[data-ore]', 'button' -- '[data-tab]' ist seit Plan 02
//      entfallen, die Reiterleiste gibt es nicht mehr. matches() aus
//      dom-mock.js ist nicht exportiert; ein kleiner eigener Vergleich fuer
//      Klasse und Attribut-Anwesenheit reicht fuer alle Aufrufwege --
//      Attributselektoren OHNE Wert (wie '[data-loc]') deckt die bestehende
//      Regex bereits generisch ab, keine neue Selektorform noetig.
//   2. fire(el, typ, init) -- die meisten Handler haengen delegiert am
//      document, die Preset-Knoepfe direkt am Element. fire() ruft erst die
//      Handler des Elements (MockElement.dispatchEvent deckt das ab), danach
//      die des Dokuments mit target = el. init (optional, Phase 12, Plan 02)
//      reicht zusaetzliche Event-Felder wie `key` bis zum delegierten
//      keydown-Handler durch -- ohne den Parameter blieb e.key immer
//      undefined und Enter/Leertaste-Faelle (T-12-11) waren nicht pruefbar.
//   3. localStorage als Objekt im vm-Kontext (get/set/remove).
//   4. window.VBAccount als Attrappe -- session() liefert eine vorgetaeuschte
//      Sitzung, loginHref() eine Zeichenkette, rest(sess, method, path,
//      body, prefer) fuehrt ein winziges In-Memory-"mining_sig_presets", damit
//      preSave() -> preLoad() -> renderPresetList() einen ECHTEN Rundlauf
//      machen kann und nicht nur ein einmalig zurueckgegebenes Fixture
//      beantwortet. calls[] protokolliert jeden Aufruf fuer die
//      Form-Zusicherungen (on_conflict, Prefer-Kopfzeile, Rumpf).
//      Seit Phase 10 (10-01): ok()/bad() tragen ein status-Feld (200/500),
//      und ein PATCH-Zweig bedient sowohl das Umbenennen (Rumpf {name}, mit
//      409 bei bereits vergebenem Zielnamen) als auch das gezielte Ersetzen
//      von `minerals`/`locations` einer einzelnen Zeile (fuer Plan 01 Task 3).
//
// Nutzlast: aus dem ECHTEN assets/mining-db.json + assets/mining-model.json
// gebaut, unabhaengig von src/components/MiningWorkbench.astro noch einmal
// zusammengesetzt (Zweitschreibung -- ein Fehler in der Astro-Nutzlast soll
// sich hier nicht hinter derselben Quelle verstecken koennen). EIN
// synthetischer Fundort mit HTML-Sonderzeichen ist bewusst an "Gold"
// angehaengt: kein Name im echten Bestand traegt heute ein '&', '<', '>'
// oder '"' (gemessen 15.08.2026, siehe scripts/verify-mining.mjs Zusicherung
// fuer '|'), ohne diesen kuenstlichen Eintrag koennte der Escaping-Nachweis
// (T-09-01) den Weg durch esc() gar nicht durchlaufen -- locPinValid()
// verwirft jeden unbekannten Fundort, bevor er dorthin kommt.
import fs from 'node:fs';
import path from 'node:path';
import { MockElement } from './dom-mock.js';

// ---- 1. closest() -----------------------------------------------------
function localMatches(node, selector) {
  if (!node || typeof node.getAttribute !== 'function') return false;
  if (selector.charAt(0) === '.') {
    return !!(node.classList && node.classList.contains(selector.slice(1)));
  }
  if (selector.charAt(0) === '#') {
    return node.id === selector.slice(1);
  }
  const attrMatch = selector.match(/^\[([a-z0-9-]+)(?:=(['"])(.*?)\2)?\]$/i);
  if (attrMatch) {
    const val = node.getAttribute(attrMatch[1]);
    if (val === null) return false;
    return attrMatch[3] === undefined || val === attrMatch[3];
  }
  return node.tagName === selector.toUpperCase();
}
if (!MockElement.prototype.closest) {
  MockElement.prototype.closest = function closest(selector) {
    let node = this;
    while (node) {
      if (localMatches(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  };
}
// preMode()/wb-pre-ok in assets/mining-workbench.js ruft .focus()/.select()
// auf dem Namensfeld auf -- MockElement kennt beide nicht. No-ops reichen:
// kein Testfall hier prueft, WO der Eingabefokus sichtbar sitzt.
if (!MockElement.prototype.focus) MockElement.prototype.focus = function focus() {};
if (!MockElement.prototype.select) MockElement.prototype.select = function select() {};

// ---- 2. Blasenlauf ------------------------------------------------------
function makeDocEvents() {
  const byType = {};
  return {
    add(type, fn) {
      (byType[type] || (byType[type] = [])).push(fn);
    },
    // init (optional, Phase 12, Plan 02): zusaetzliche Event-Felder wie
    // `key` -- der bestehende keydown-Handler in mining-workbench.js fragt
    // e.key ab (Enter/Leertaste je Fundort-/Erzzeile, T-12-11). Ohne diesen
    // Parameter blieb e.key immer undefined und der Handler kehrte sofort
    // um, bevor irgendein Zweig ueberhaupt erreicht wurde -- rein additiv,
    // kein bestehender zweiargumentiger Aufruf aendert sein Verhalten.
    fire(type, target, init) {
      const ev = {
        type, target, currentTarget: null,
        preventDefault() {}, stopPropagation() {},
        ...(init || {}),
      };
      (byType[type] || []).slice().forEach((fn) => fn(ev));
    },
  };
}

// LS_KEY == LS in assets/mining-workbench.js -- zweitgeschrieben, wie der
// Paar-Trenner '||' und die Elementkennungen unten; eine Aenderung dort muss
// hier sichtbar auffallen statt sich hinter einem gemeinsamen Import zu
// verstecken.
const LS_KEY = 'vb-mining-wb';

// ---- 3. localStorage ------------------------------------------------------
function makeLocalStorage(seedObj) {
  const store = {};
  if (seedObj && typeof seedObj === 'object') {
    store[LS_KEY] = JSON.stringify(seedObj);
  }
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _dump: () => store,
  };
}

// ---- 4. window.VBAccount --------------------------------------------------
function makeAccount(opts = {}) {
  const session = 'session' in opts ? opts.session : { access_token: 'test-token', user: { id: 'test-user' } };
  const rows = (opts.rows || []).map((r) => ({ ...r }));
  const postOk = opts.postOk !== false;
  const calls = [];

  function qs(p) {
    const out = {};
    const i = p.indexOf('?');
    if (i < 0) return out;
    p.slice(i + 1).split('&').forEach((pair) => {
      const eq = pair.indexOf('=');
      out[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    });
    return out;
  }
  const ok = (json) => ({ ok: true, status: 200, json: () => Promise.resolve(json) });
  const bad = (status) => ({ ok: false, status: status || 500, json: () => Promise.resolve(null) });

  return {
    calls,
    rows,
    session: () => Promise.resolve(session),
    loginHref: () => '/account/login.html?next=%2Ftopics%2Fmining',
    rest(sess, method, reqPath, body, prefer) {
      calls.push({ method, path: reqPath, body, prefer });
      if (reqPath.split('?')[0] !== 'mining_sig_presets') return Promise.resolve(bad());
      if (method === 'GET') return Promise.resolve(ok(rows.map((r) => ({ ...r }))));
      if (method === 'POST') {
        if (!postOk) return Promise.resolve(bad());
        (body || []).forEach((entry) => {
          const existing = rows.find((r) => r.name === entry.name);
          if (existing) { existing.minerals = entry.minerals; existing.locations = entry.locations; }
          else rows.push({ name: entry.name, minerals: entry.minerals, locations: entry.locations });
        });
        return Promise.resolve(ok(null));
      }
      if (method === 'PATCH') {
        // Treffer-Check (Review Phase 10, MEDIUM): ein Filter, der null Zeilen
        // trifft, ist bei PostgREST TROTZDEM ein 200 -- niemals ein 404. Der
        // Client kann "echt geaendert" von "nichts getroffen" nur ueber den
        // Prefer-Header return=representation unterscheiden (leeres Array
        // statt einer Zeile). `repr` bildet genau das nach; ohne den Header
        // bleibt der alte, grobe Rundlauf (ok(null)) fuer Aufrufe erhalten,
        // die den Treffer-Check (noch) nicht anfordern.
        const oldName = (qs(reqPath).name || '').replace(/^eq\./, '');
        const row = rows.find((r) => r.name === oldName);
        const repr = prefer === 'return=representation';
        if (!row) return Promise.resolve(ok(repr ? [] : null));
        if (body && typeof body.name === 'string') {
          if (body.name !== oldName && rows.some((r) => r.name === body.name)) {
            return Promise.resolve(bad(409));
          }
          row.name = body.name;
          return Promise.resolve(ok(repr ? [{ ...row }] : null));
        }
        if (body && Object.prototype.hasOwnProperty.call(body, 'minerals')) row.minerals = body.minerals;
        if (body && Object.prototype.hasOwnProperty.call(body, 'locations')) row.locations = body.locations;
        return Promise.resolve(ok(repr ? [{ ...row }] : null));
      }
      if (method === 'DELETE') {
        // Dieselbe Treffer-Check-Logik wie beim PATCH-Zweig oben, siehe dort.
        const name = (qs(reqPath).name || '').replace(/^eq\./, '');
        const repr = prefer === 'return=representation';
        const hit = rows.find((r) => r.name === name);
        const kept = rows.filter((r) => r.name !== name);
        rows.length = 0;
        kept.forEach((r) => rows.push(r));
        return Promise.resolve(ok(repr ? (hit ? [{ ...hit }] : []) : null));
      }
      return Promise.resolve(bad());
    },
  };
}

// ---- Nutzlast (zweitgeschrieben aus den echten Datendateien) --------------
function buildPayload() {
  const db = JSON.parse(fs.readFileSync(path.resolve('assets/mining-db.json'), 'utf8'));
  const model = JSON.parse(fs.readFileSync(path.resolve('assets/mining-model.json'), 'utf8'));
  const elemByName = {};
  for (const e of model.elements) elemByName[e.name] = e;

  const minerals = db.minerals.map((m) => {
    const e = elemByName[m.name] || {};
    return {
      name: m.name, kind: m.kind, rarity: m.rarity || null,
      method: m.method, methods: m.methods || [], refine: !!m.needs_refine,
      systems: m.systems || [],
      locs: (m.locations || []).map((l) => ({
        p: l.location, s: l.system, t: l.type, mi: l.mining, ms: l.maxShare, ch: l.chance, ef: l.eff,
      })),
      sig: e.scanSignature || null,
    };
  });

  // T-09-01-Nachweis: siehe Kopfkommentar. "Gold" ist im echten Bestand
  // gemessen fundortreich (15.08.2026); der synthetische Eintrag traegt
  // absichtlich '&', '<', '>' UND '"' -- genau die vier Zeichen, die esc()
  // in assets/mining-workbench.js abdeckt.
  const gold = minerals.find((m) => m.name === 'Gold');
  const SPECIAL_LOC = 'Rock & <Danger> "Site"';
  if (gold) gold.locs.push({ p: SPECIAL_LOC, s: 'Test', t: 'test', mi: 'ship', ms: 10, ch: 10, ef: 1 });

  // Sprachobjekt: eigene Platzhalter statt der echten Kopie -- der Test soll
  // nicht brechen, wenn morgen ein Werbetexter S.noLocs umformuliert.
  const t = {
    minerals: 'MINERALS', view: 'VIEW', signatures: 'SIGNATURES', locations: 'LOCATIONS',
    search: 'SEARCH', pinHint: 'PIN-HINT',
    presets: 'PRESETS', presetSave: 'SAVE', presetDel: 'DEL',
    presetName: 'NAME', presetCancel: 'CANCEL', presetGuest: 'GUEST', presetLogin: 'LOGIN',
    presetSaved: 'SAVED', presetDeleted: 'DELETED', presetEmpty: 'EMPTY', presetFail: 'FAIL',
    // Phase 10, Plan 01: Liste statt <select> (D-05) + Umbenennen (D-02, Form 1).
    presetNew: 'NEW-PRESET', presetRename: 'RENAME', presetRenamed: 'RENAMED',
    presetNameTaken: 'NAME-TAKEN', presetListEmpty: 'LIST-EMPTY',
    // Phase 10, Plan 01, Task 2: Loeschen fragt zurueck (D-01).
    presetDelAsk: 'DEL-ASK',
    // Phase 10, Plan 01, Task 3: Ueberschreiben und Ausduennen (D-02, Form 2+3).
    presetUpdate: 'UPDATE', presetUpdated: 'UPDATED', presetShow: 'SHOW', presetHide: 'HIDE',
    presetRemoveEntry: 'REMOVE-ENTRY', presetNoEntries: 'NO-ENTRIES',
    none: 'NONE-VAL', pin: 'PIN', unpin: 'UNPIN', noLocs: 'NO-LOCS',
    ship: 'SHIP', hand: 'HAND', roc: 'ROC', refinable: 'REFINABLE',
    bestRef: 'BEST-REF', yieldMod: 'YIELD', worst: 'WORST', yourPick: 'YOUR-PICK',
    usedIn: 'USED-IN', ships: 'SHIPS', openCrafting: 'OPEN-CRAFTING',
    locPinsEmpty: 'NO-LOC-PINS',
    // Phase 9, Plan 02 (O-3/T-09-07): chance/upTo faerbt schon die Fundort-Zeile
    // in der Mitte (#wb-locs), fehlte hier aber bislang -- ohne den Platzhalter
    // haette pctRight() in assets/mining-workbench.js "undefined" statt "UP-TO"
    // in den Text gemischt, ungeprueft, weil kein Testfall den rechten Text
    // bisher wortwoertlich verglich. locPinsFull ist neu (Grenze bei 128).
    chance: 'CHANCE', upTo: 'UP-TO', locPinsFull: 'LOC-PINS-FULL',
    // Phase 12: Fundort-Ansicht (D-01/D-07) -- Zurueck-Knopf-Beschriftung und
    // das Spur-Abzeichen.
    backToOre: 'BACK-TO-ORE', trace: 'TRACE',
  };

  // Echte Stationen + Ertragsprofile: ohne sie liefe rankRefineries() fuer
  // JEDES Erz leer, "Beste Stationen" zeichnete nie eine row2()-Zeile, und
  // der D-05-Nachweis ("kein Nadelknopf in #wb-refs") wuerde nur triviales
  // Nichts pruefen statt den tatsaechlichen sechsstelligen row2()-Aufrufpfad.
  const refineries = model.refineries.map((r) => ({ n: r.name, s: r.system, p: r.profileId }));
  const profiles = model.refineryProfiles;

  return {
    lang: 'de', minerals, refineries, profiles, t,
    rar: {}, craftingPath: '', fracturingPath: '', shipsByMethod: {},
    SPECIAL_LOC,
  };
}

// classList in dom-mock.js kennt add/remove/contains/has, aber kein toggle()
// -- mining-workbench.js ruft `.classList.toggle('is-on', bool)` an drei
// statisch erzeugten Stellen (Kachel, ihr Anheft-Knopf, der grosse
// Anheft-Knopf). Da classList ein Instanz-Objekt ist (kein Prototyp-Feld),
// wird der Patch je erzeugtem Element angehaengt, nicht auf MockElement
// selbst.
function withToggle(elx) {
  if (!elx.classList.toggle) {
    elx.classList.toggle = function toggle(name, force) {
      const has = elx.classList.contains(name);
      const want = force === undefined ? !has : !!force;
      if (want && !has) elx.classList.add(name);
      else if (!want && has) elx.classList.remove(name);
      return want;
    };
  }
  return elx;
}

function mk(tag, id, className) {
  return withToggle(new MockElement(tag, id || '', className || ''));
}

/**
 * makeMiningDomContext(opts) liefert ein Objekt, das direkt als node:vm-
 * Kontext dient (vm.createContext(ctx)): document/window/localStorage/
 * location/URLSearchParams/Intl/setTimeout/clearTimeout/
 * requestAnimationFrame/console liegen auf oberster Ebene, weil
 * assets/mining-workbench.js sie genau so referenziert (blanke Bezeichner
 * bzw. window.VBAccount).
 *
 * opts:
 *   account.rows     — Preset-Zeilen, mit denen VBAccount.rest(GET) startet
 *                       ([{name, minerals, locations}], locations optional/null
 *                       fuer den Altbestands-Nachweis)
 *   account.session   — vorgetaeuschte Sitzung; undefined/null = Gast
 *   account.postOk    — false simuliert einen abgewiesenen Upsert
 *   localStorageSeed  — Rumpf, der unter dem Schluessel LS_KEY vorbelegt wird
 *                       (Altbestands-Nachweis ohne locPins-Feld: dieses Feld
 *                       einfach weglassen)
 *   search            — location.search, Default '' (kein Tieflink-Test hier)
 */
export function makeMiningDomContext(opts = {}) {
  const payload = buildPayload();
  const byName = {};
  for (const m of payload.minerals) byName[m.name] = m;

  const elements = {};
  function reg(elx) { if (elx.id) elements[elx.id] = elx; return elx; }

  const root = reg(mk('section', 'db', 'wb'));

  const dataEl = reg(mk('script', 'wb-data'));
  dataEl.textContent = JSON.stringify(payload);
  root.appendChild(dataEl);

  // Spalte 1 — Kacheln, eine je Mineral, mit dem Anheft-Knopf, den
  // renderList() anfasst (data-pin, aria-pressed).
  const listEl = reg(mk('div', 'wb-list'));
  for (const m of payload.minerals) {
    const tile = mk('div', '', 'wb__tile');
    tile.setAttribute('data-min', m.name);
    const pinBtn = mk('button', '', 'wb__pin');
    pinBtn.setAttribute('data-pin', m.name);
    pinBtn.setAttribute('aria-pressed', 'false');
    tile.appendChild(pinBtn);
    listEl.appendChild(tile);
  }
  root.appendChild(listEl);
  root.appendChild(reg(mk('span', 'wb-count')));

  // Mitte — Kopf + Fundorte + Beste Stationen + Verweise (Task 1, Phase 9).
  root.appendChild(reg(mk('div', 'wb-orehead')));
  root.appendChild(reg(mk('h2', 'wb-name')));
  root.appendChild(reg(mk('div', 'wb-tags')));
  root.appendChild(reg(mk('b', 'wb-sig')));
  const pinselEl = reg(mk('button', 'wb-pinsel'));
  pinselEl.setAttribute('aria-pressed', 'false');
  root.appendChild(pinselEl);
  root.appendChild(reg(mk('span', 'wb-pinsel-txt')));
  root.appendChild(reg(mk('div', 'wb-oreview')));
  root.appendChild(reg(mk('h4', 'wb-loch')));
  root.appendChild(reg(mk('div', 'wb-locs')));
  root.appendChild(reg(mk('div', 'wb-refs')));
  root.appendChild(reg(mk('div', 'wb-links')));

  // Fundort-Kopf + Fundort-Ansicht (Phase 12, Plan 01, Task 1, D-01/D-11):
  // wb-back MUSS als button angelegt werden und data-back tragen, damit der
  // delegierte Handler ihn ueber closest('[data-back]') findet -- genau wie
  // .wb__pin/.wb__lpin es fuer ihre eigenen data-Attribute schon tun.
  root.appendChild(reg(mk('div', 'wb-lochead')));
  const backBtn = reg(mk('button', 'wb-back'));
  backBtn.setAttribute('data-back', '1');
  root.appendChild(backBtn);
  root.appendChild(reg(mk('h2', 'wb-locname')));
  root.appendChild(reg(mk('div', 'wb-locsub')));
  // wb-locview traegt AUSSCHLIESSLICH die bestehende Klasse wb__scroll (Phase
  // 12, Plan 01, Task 2) -- keine neue Bildlaufklasse, sonst muesste sie in
  // assets/theme.css UND assets/mobile-ux.css eingetragen werden.
  root.appendChild(reg(mk('div', 'wb-locview', 'wb__scroll')));

  // Fusszeile.
  root.appendChild(reg(mk('a', 'wb-frac')));
  root.appendChild(reg(mk('span', 'wb-frac-ore')));
  root.appendChild(reg(mk('select', 'wb-ref')));

  // Spalte 3 — Signaturenliste und Fundort-Merkliste, seit Phase 10 (Plan 02,
  // D-03) gestapelt statt hinter Reitern: wb-scan/wb-tab-sig/wb-tab-loc/
  // wb-sig-pane/wb-loc-pane sind entfallen, neu registriert sind wb-pinsh und
  // wb-lpinsh -- renderPins()/renderLocPins() schreiben den jeweiligen
  // Paarzaehler in diese Ueberschriften (guard $()===null davor macht das
  // optional, aber der Zaehler soll hier tatsaechlich geprueft werden koennen).
  root.appendChild(reg(mk('div', 'wb-pins')));
  root.appendChild(reg(mk('div', 'wb-locpins')));
  root.appendChild(reg(mk('h4', 'wb-pinsh')));
  root.appendChild(reg(mk('h4', 'wb-lpinsh')));

  // Presets (Phase 10, Plan 01: sichtbare Liste statt <select>, D-05).
  root.appendChild(reg(mk('div', 'wb-preset-list')));
  root.appendChild(reg(mk('div', 'wb-pre-pick')));
  root.appendChild(reg(mk('div', 'wb-pre-edit')));
  root.appendChild(reg(mk('p', 'wb-pre-msg')));
  root.appendChild(reg(mk('p', 'wb-pre-guest')));
  root.appendChild(reg(mk('input', 'wb-pre-name')));
  root.appendChild(reg(mk('button', 'wb-pre-new')));
  root.appendChild(reg(mk('button', 'wb-pre-cancel')));
  root.appendChild(reg(mk('button', 'wb-pre-ok')));
  root.appendChild(reg(mk('a', 'wb-pre-login')));

  const docEvents = makeDocEvents();
  const document = {
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    createElement: (tag) => new MockElement(tag),
    addEventListener: docEvents.add,
  };

  const account = makeAccount(opts.account);
  const windowObj = { VBAccount: account, document };

  // init (optional): durchgereicht an docEvents.fire() -- siehe Kommentar
  // dort. dispatchEvent() selbst kennt init bereits (dom-mock.js), die
  // delegierten document-Handler brauchten das Feld hier zusaetzlich.
  function fire(el, type, init) {
    el.dispatchEvent(type, init);
    docEvents.fire(type, el, init);
  }

  return {
    // ---- vm-Kontext: was assets/mining-workbench.js als blanke Bezeichner
    // bzw. window.* erwartet ----
    document,
    window: windowObj,
    localStorage: makeLocalStorage(opts.localStorageSeed),
    location: { search: opts.search || '', href: 'http://localhost/topics/mining' },
    URLSearchParams,
    Intl,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (cb) => { cb(0); return 0; },
    addEventListener() {}, // Fensterebene — nie erreicht, window.VBAccount existiert schon beim Laden
    console,
    // ---- Test-Werkzeuge (nicht vom Skript referenziert) ----
    elements,
    byName,
    T: payload.t,
    account,
    fire,
    root,
    SPECIAL_LOC: payload.SPECIAL_LOC,
  };
}

/** Wartet, bis anhaengende Promise-Ketten (session().then(preLoad).then(renderPresetList)
 *  usw.) abgearbeitet sind — ohne echte Zeit zu verbrauchen. */
export async function flush(ticks = 8) {
  for (let i = 0; i < ticks; i++) await Promise.resolve();
  await new Promise((r) => setImmediate(r));
}

export { LS_KEY };
