// Controller der Hangarseite (/hangar.html, /de/hangar.html). Er besitzt den
// Zustand der Seite und seine URL-Form, holt die Buchtdokumente je Schiff
// (/hangar-bay/<id>.html, gebaut von src/lib/hangar/bay.ts) und setzt ihre
// Regionen ein, und er steuert den Viewer der Szene ueber die Naht in
// #hg-stage (src/lib/hangar/stage.ts, .planning/notes/hangar-naht.md).
//
// Er uebersetzt nichts: jedes Wort kommt als gebautes Markup oder als Vorlage
// aus #hgx-msg. Zahlen formatiert er nur dort, wo sie von der Auswahl des
// Besuchers abhaengen: Trefferzahl des Docks und Flottenzeile (fillMessage).
// Die Flotte gehoert assets/fleet.js (window.VBFleet); hier wird sie gelesen
// und gezeichnet.
//
// Eine Datei mit Absicht: ein statischer Import eines Geschwistermoduls
// truege kein ?v= und koennte einen Tag lang eine alte Fassung ausfuehren
// (nginx cached JS einen Tag). Der Viewer wird ueber seine versionierte URL
// aus #hg-stage geladen. Beim Import passiert nichts; die Seite ruft
// boot(document), die Tests importieren die reinen Funktionen.

/**
 * Der ganze Zustand der Seite. Ein Besitzer: der Speicher in boot(). Jeder
 * Schluessel hat eine URL-Form, Vorgaben fehlen in der URL.
 * @typedef {{
 *   ship: string, tab: string, hp: string|null, cmp: string[], view: 'stage'|'compare',
 *   fleetOnly: boolean, sort: string, q: string, type: string, maker: string,
 * }} HangarState
 */
/**
 * Wogegen parseState prueft. boot() liest es aus dem gebauten DOM, damit der
 * Client keine zweite Liste von Schiffen, Tabs, Sortierungen, Typen oder
 * Herstellern fuehrt. Der erste Tab und die erste Sortierung sind die Vorgabe.
 * @typedef {{
 *   ids: ReadonlySet<string>, defaultShip: string, tabs: readonly string[],
 *   sorts: readonly string[], types: ReadonlySet<string>, makers: ReadonlySet<string>,
 * }} StateContext
 */

export const MAX_COMPARE = 3;
const PORT_RE = /^[a-z0-9_]{1,100}$/;

/**
 * Bringt einen beliebigen Zustandsentwurf in die gueltige Form. Unbekannte Ids
 * fallen weg, cmp wird entdoppelt und auf drei gekappt, unbekannte Tabs und
 * Sortierungen fallen auf die Vorgabe. Ein Hardpoint gibt es nur auf einem
 * Ausstattungs-Tab; ob die Bucht ihn kennt, entscheidet erst die Bucht.
 * @param {Partial<HangarState>} s @param {StateContext} ctx @returns {HangarState}
 */
export function normalize(s, ctx) {
  const tab = ctx.tabs.includes(s.tab) ? s.tab : ctx.tabs[0];
  const cmp = [...new Set((s.cmp ?? []).filter((id) => ctx.ids.has(id)))].slice(0, MAX_COMPARE);
  return {
    ship: ctx.ids.has(s.ship) ? s.ship : ctx.defaultShip,
    tab,
    hp: tab !== ctx.tabs[0] && typeof s.hp === 'string' && PORT_RE.test(s.hp) ? s.hp : null,
    cmp,
    view: s.view === 'compare' && cmp.length ? 'compare' : 'stage',
    fleetOnly: s.fleetOnly === true,
    sort: ctx.sorts.includes(s.sort) ? s.sort : ctx.sorts[0],
    q: String(s.q ?? '').trim().slice(0, 80),
    type: ctx.types.has(s.type) ? s.type : '',
    maker: ctx.makers.has(s.maker) ? s.maker : '',
  };
}

/**
 * Grenze: location.search und location.hash nach HangarState. Ein altes
 * '#<id>' (die einzige Zustandsform vor dieser Seite) waehlt das Schiff, wenn
 * ?ship fehlt.
 *   parseState('?ship=drak-cutlass-black&tab=weapons', '', ctx)
 *   -> { ship: 'drak-cutlass-black', tab: 'weapons', hp: null, cmp: [], view: 'stage', … }
 * @param {string} search @param {string} hash @param {StateContext} ctx @returns {HangarState}
 */
export function parseState(search, hash, ctx) {
  const p = new URLSearchParams(search);
  let legacy = '';
  try { legacy = decodeURIComponent(String(hash ?? '').replace(/^#/, '')); } catch { legacy = ''; }
  return normalize({
    ship: p.get('ship') ?? legacy,
    tab: p.get('tab'),
    hp: p.get('hp'),
    cmp: (p.get('cmp') ?? '').split(','),
    view: p.get('view'),
    fleetOnly: p.get('fleet') === '1',
    sort: p.get('sort'),
    q: p.get('q') ?? '',
    type: p.get('type') ?? '',
    maker: p.get('maker') ?? '',
  }, ctx);
}

/**
 * HangarState nach '?…', Vorgaben weggelassen, feste Schluesselfolge (ship,
 * tab, hp, cmp, view, fleet, sort, q, type, maker): gleiche Zustaende ergeben
 * gleiche URLs. scope 'share' (Link kopieren) nennt immer das Schiff und laesst
 * die persoenlichen Dock-Filter weg; der Empfaenger hat eine andere Flotte.
 * @param {HangarState} s @param {StateContext} ctx @param {'location'|'share'} [scope]
 * @returns {string}
 */
export function serializeState(s, ctx, scope = 'location') {
  const share = scope === 'share';
  const out = [];
  const put = (k, v) => out.push(`${k}=${encodeURIComponent(v)}`);
  if (share || s.ship !== ctx.defaultShip) put('ship', s.ship);
  if (s.tab !== ctx.tabs[0]) put('tab', s.tab);
  if (s.hp) put('hp', s.hp);
  // Ids sind [a-z0-9-]: die Kommas bleiben lesbar statt %2C.
  if (s.cmp.length) out.push(`cmp=${s.cmp.join(',')}`);
  if (s.view !== 'stage') put('view', s.view);
  if (!share) {
    if (s.fleetOnly) put('fleet', '1');
    if (s.sort !== ctx.sorts[0]) put('sort', s.sort);
    if (s.q) put('q', s.q);
    if (s.type) put('type', s.type);
    if (s.maker) put('maker', s.maker);
  }
  return out.length ? `?${out.join('&')}` : '';
}

/**
 * Fuellt eine gebaute Vorlage: Mehrzahlform ueber Intl.PluralRules, Zahlen
 * ueber Intl.NumberFormat.
 *   fillMessage({ one: '{n} ship', other: '{n} ships' }, { n: 1227 }, 'en-US') === '1,227 ships'
 * @param {{ one?: string, other: string }} forms @param {Record<string, number|string>} values @param {string} loc
 */
export function fillMessage(forms, values, loc) {
  const nf = new Intl.NumberFormat(loc);
  const tpl = forms[new Intl.PluralRules(loc).select(Number(values.n ?? 0))] ?? forms.other;
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in values ? (typeof values[k] === 'number' ? nf.format(values[k]) : String(values[k])) : m));
}

/**
 * Grenze: data-v einer Dock-Karte in der Schluesselfolge von data-stats
 * (src/lib/hangar/catalog.ts dockFigures). '-' und fehlende Stellen sind
 * unbekannt, eine echte 0 bleibt 0.
 *   figuresOf(['cargo', 'crew', 'price'], '46 2 -') -> { cargo: 46, crew: 2, price: null }
 * @param {readonly string[]} keys @param {string} raw @returns {Record<string, number|null>}
 */
export function figuresOf(keys, raw) {
  const v = String(raw ?? '').split(' ');
  return Object.fromEntries(keys.map((k, i) => {
    const x = v[i] === undefined || v[i] === '-' || v[i] === '' ? NaN : Number(v[i]);
    return [k, Number.isFinite(x) ? x : null];
  }));
}

/**
 * Summen der Flottenzeile aus den Dock-Daten. Ids ohne Karte zaehlen nicht;
 * ein unbekannter Frachtraum oder eine unbekannte Besatzung zaehlt 0, Rollen
 * sind die verschiedenen Rollenfamilien.
 * @param {Iterable<string>} ids
 * @param {ReadonlyMap<string, { stat: Record<string, number|null>, fam: readonly string[] }>} ships
 * @returns {{ n: number, scu: number, crew: number, roles: number }}
 */
export function fleetSummary(ids, ships) {
  let n = 0, scu = 0, crew = 0;
  const fams = new Set();
  for (const id of ids) {
    const s = ships.get(id);
    if (!s) continue;
    n++;
    scu += s.stat.cargo ?? 0;
    crew += s.stat.crew ?? 0;
    for (const f of s.fam) fams.add(f);
  }
  return { n, scu, crew, roles: fams.size };
}

// ---------------------------------------------------------------- die Seite

/** Verdrahtet die Seite; einmal aufgerufen vom Inline-Modul in HangarPage.astro. @param {Document} doc */
export function boot(doc) {
  const $ = (id) => doc.getElementById(id);
  const main = $('main');
  const strip = $('hg-strip');
  const items = [...strip.children];
  const tablist = doc.querySelector('.hgx-tabs');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const host = $('hgx-panelhost');
  const title = doc.querySelector('.hg-title');
  const live = $('hgx-live');
  const bayErr = $('hgx-bayerr');
  const modelErr = $('hgx-modelerr');
  const loc = main.dataset.loc;
  const stageCfg = JSON.parse($('hg-stage').textContent);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const msg = (id) => doc.querySelector(`#hgx-msg [data-msg="${id}"]`).dataset;

  /** @type {StateContext} */
  const ctx = {
    ids: new Set(items.map((li) => li.dataset.id)),
    defaultShip: main.dataset.defaultShip,
    tabs: tabs.map((b) => b.dataset.tab),
    sorts: strip.dataset.sorts.split(' '),
    types: new Set([...$('hg-type').options].map((o) => o.value).filter(Boolean)),
    makers: new Set([...$('hg-maker-f').options].map((o) => o.value).filter(Boolean)),
  };

  // Die Dock-Karten tragen die Zahlen fuer Flotte, Vergleich und Sortierung;
  // einmal gelesen, danach nur noch diese Abbildung.
  const statKeys = strip.dataset.stats.split(' ');
  const dock = new Map(items.map((li) => [li.dataset.id, {
    li,
    name: li.querySelector('.hg-card span').textContent,
    fam: li.dataset.fam ? li.dataset.fam.split(' ') : [],
    stat: figuresOf(statKeys, li.dataset.v),
  }]));

  let state = parseState(location.search, location.hash, ctx);

  function writeUrl() {
    const url = `${location.pathname}${serializeState(state, ctx)}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', url);
  }

  /** Der einzige Weg, den Zustand zu aendern. @param {Partial<HangarState>} patch */
  function setState(patch) {
    const prev = state;
    state = normalize({ ...state, ...patch }, ctx);
    writeUrl();
    render(prev);
  }

  function render(prev) {
    if (prev.ship !== state.ship) {
      syncFleetBtn();
      showShip(state.ship);
    } else {
      if (prev.tab !== state.tab) applyTab();
      if (prev.tab !== state.tab || prev.hp !== state.hp) applyHp();
    }
    if (prev.fleetOnly !== state.fleetOnly) paintFleetFilter();
    if (prev.q !== state.q || prev.type !== state.type || prev.maker !== state.maker || prev.fleetOnly !== state.fleetOnly) applyDock();
  }

  // -------------------------------------------------------------- Buchten
  // Die Bucht ist eine Momentaufnahme; eingesetzt wird immer eine Kopie,
  // weil die eingesetzte Region danach Zustand traegt (offene Zeilen).
  const REGIONS = ['head', 'panel', 'marks'];
  const regionNow = (name) => doc.querySelector(`[data-bay="${name}"]`);
  const cache = new Map();
  const CACHE_MAX = 16;

  function regionsOf(root, id) {
    const out = {};
    for (const name of REGIONS) {
      const el = root.querySelector(`[data-bay="${name}"]`);
      if (!el || el.dataset.id !== id) throw new Error(`Bucht ${id}: Region ${name} fehlt`);
      out[name] = el;
    }
    return out;
  }

  function loadBay(id) {
    const hit = cache.get(id);
    if (hit) {
      cache.delete(id);
      cache.set(id, hit);
      return hit;
    }
    const p = fetch(`${main.dataset.bayBase}${encodeURIComponent(id)}.html`, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`Bucht ${id}: HTTP ${r.status}`);
        return r.text();
      })
      .then((html) => {
        const d = new DOMParser().parseFromString(html, 'text/html');
        // Auf staging liefert das Testpilot-Tor sonst seine eigene Seite aus.
        if (d.querySelector('main[data-bay-id]')?.dataset.bayId !== id) throw new Error(`Bucht ${id}: fremdes Dokument`);
        return regionsOf(d, id);
      });
    p.catch(() => { if (cache.get(id) === p) cache.delete(id); });
    cache.set(id, p);
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return p;
  }
  cache.set(ctx.defaultShip, Promise.resolve(Object.fromEntries(REGIONS.map((n) => [n, regionNow(n).cloneNode(true)]))));

  function prefetchNeighbours(id) {
    if (navigator.connection?.saveData) return;
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 400));
    idle(() => {
      const ids = visibleIds();
      const i = ids.indexOf(id);
      if (i < 0) return;
      for (const d of [-1, 1]) {
        const n = ids[(i + d + ids.length) % ids.length];
        if (n !== id) loadBay(n).catch(() => {});
      }
    });
  }

  let selTok = 0;
  async function showShip(id) {
    const my = ++selTok;
    markCards(id);
    bayErr.hidden = true;
    modelErr.hidden = true;
    viewerShow(id);
    // Erst nach 150 ms dimmen: ein Treffer im Cache soll nicht flackern.
    const busy = setTimeout(() => setBusy(true), 150);
    try {
      const regions = await loadBay(id);
      if (my !== selTok) return;
      for (const name of REGIONS) regionNow(name).replaceWith(doc.importNode(regions[name], true));
      applyTab();
      syncMarks();
      applyHp();
      title.classList.remove('is-swap');
      void title.offsetWidth;
      title.classList.add('is-swap');
      live.textContent = regionNow('head').dataset.announce;
      prefetchNeighbours(id);
    } catch {
      if (my !== selTok) return;
      showBayError(id);
    } finally {
      clearTimeout(busy);
      if (my === selTok) setBusy(false);
    }
  }

  function setBusy(on) {
    host.setAttribute('aria-busy', String(on));
    title.classList.toggle('is-busy', on);
  }

  // Ohne Bucht darf die alte nicht als Daten des neuen Schiffs stehen bleiben:
  // Name und Hersteller kommen von der Dock-Karte, die Ausstattung weicht der
  // Fehlermeldung mit Wiederholen.
  function showBayError(id) {
    const card = cardOf(id);
    const head = regionNow('head');
    head.querySelector('.hg-name').textContent = card?.querySelector('span')?.textContent ?? id;
    head.querySelector('.hg-maker').textContent = card?.querySelector('small')?.textContent ?? '';
    head.querySelector('.hg-role').textContent = '';
    regionNow('panel').hidden = true;
    bayErr.hidden = false;
  }
  $('hgx-bayretry').addEventListener('click', () => showShip(state.ship));

  // -------------------------------------------------------------- Tabs (WAI-ARIA)
  function applyTab() {
    for (const b of tabs) {
      const on = b.dataset.tab === state.tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const k of ctx.tabs) {
      const panel = $(`hgx-tp-${k}`);
      if (panel) panel.hidden = k !== state.tab;
    }
    main.dataset.tabActive = state.tab;
  }
  tablist.addEventListener('click', (e) => {
    const b = e.target.closest('[role="tab"]');
    if (b) setState({ tab: b.dataset.tab, hp: null });
  });
  tablist.addEventListener('keydown', (e) => {
    const i = ctx.tabs.indexOf(state.tab), n = ctx.tabs.length;
    const to = { ArrowLeft: (i - 1 + n) % n, ArrowRight: (i + 1) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setState({ tab: ctx.tabs[to], hp: null });
    tabs[to].focus();
  });

  // -------------------------------------------------------------- Zeilen und Hardpoint
  // hp ist der Port, den die geoeffnete Zeile meint. Traegt ein Port mehrere
  // Items, oeffnen alle Zeilen, die ihn fuehren: der Hardpoint traegt sie alle.
  function applyHp() {
    const panel = $(`hgx-tp-${state.tab}`);
    let found = false;
    for (const li of host.querySelectorAll('.hgx-slot')) {
      const on = !!state.hp && li.closest('[role="tabpanel"]') === panel && li.dataset.ports.split(' ').includes(state.hp);
      found ||= on;
      li.querySelector('.hgx-slot__btn').setAttribute('aria-expanded', String(on));
      li.querySelector('.hgx-d').hidden = !on;
    }
    if (state.hp && !found) {
      state = { ...state, hp: null };
      writeUrl();
    }
    for (const el of regionNow('marks').querySelectorAll('.hgx-mk')) {
      el.classList.toggle('is-sel', !!state.hp && el.dataset.port === state.hp && el.dataset.tab === state.tab);
    }
    if (found) revealOpenRow();
    applyFocus();
  }
  // Ein Link oder ein Markerklick oeffnet eine Zeile, die womoeglich weit
  // unten in der Tafel steht: nur die Tafel rollt, nie die Seite.
  function revealOpenRow() {
    const li = host.querySelector('.hgx-slot__btn[aria-expanded="true"]')?.closest('.hgx-slot');
    if (!li || host.scrollHeight <= host.clientHeight) return;
    const r = li.getBoundingClientRect(), h = host.getBoundingClientRect();
    if (r.top < h.top || r.bottom > h.bottom) host.scrollTop += r.top - h.top - 8;
  }
  // Das Fokusziel einer Zeile ist ihr erster Port mit Punkt in diesem Tab.
  function portFor(li) {
    const ports = li.dataset.ports.split(' ');
    const marked = new Set([...regionNow('marks').querySelectorAll(`.hgx-mk[data-tab="${state.tab}"]`)].map((el) => el.dataset.port));
    return ports.find((p) => marked.has(p)) ?? ports[0];
  }
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('.hgx-slot__btn');
    if (!btn) return;
    setState({ hp: btn.getAttribute('aria-expanded') === 'true' ? null : portFor(btn.closest('.hgx-slot')) });
  });

  // -------------------------------------------------------------- Marker
  // HTML ueber der Leinwand, im Slot der Buehne (Region marks). Sie leben erst,
  // wenn BEIDES zum gewaehlten Schiff gehoert: das Modell steht (show() genau
  // dieser Auswahl ist fertig) und die Region ist eingesetzt. Sonst saessen
  // Punkte des alten Schiffs auf dem neuen.
  let placed = null;
  let pins = null;
  let focused = null;
  const buf = [];

  function syncMarks() {
    const region = regionNow('marks');
    const live = !!viewer && placed === state.ship && region.dataset.id === state.ship;
    region.toggleAttribute('data-live', live);
    if (!live) { pins = null; return; }
    const els = [...region.querySelectorAll('.hgx-mk')];
    const pts = els.map((el) => el.dataset.p.split(' ').map(Number));
    // Die Rumpfmitte reist als letzter Punkt mit: was hinter ihr liegt, dimmt.
    const c = region.dataset.c ? region.dataset.c.split(' ').map(Number) : null;
    pins = { els, pts: c ? [...pts, c] : pts, center: !!c };
  }

  function placeMarks() {
    if (!pins) return;
    const out = viewer.project(pins.pts, buf);
    const c = pins.center ? out[out.length - 1] : null;
    pins.els.forEach((el, i) => {
      const o = out[i];
      if (!o) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = '';
      el.style.transform = `translate(${o.x.toFixed(1)}px,${o.y.toFixed(1)}px)`;
      el.classList.toggle('is-far', !!c && o.d > c.d);
    });
  }

  const pointOf = (port) => regionNow('marks').querySelector(`.hgx-mk[data-tab="${state.tab}"][data-port="${CSS.escape(port)}"]`)?.dataset.p.split(' ').map(Number) ?? null;

  // Kamera auf den Hardpoint aus hp, sobald Modell und Bucht stehen; ohne hp
  // zurueck in die Startansicht. Ein Port ohne Punkt oeffnet nur die Zeile.
  function applyFocus() {
    if (!pins) return;
    const want = state.hp && pointOf(state.hp) ? state.hp : null;
    if (want === focused) return;
    focused = want;
    viewer.focus(want ? pointOf(want) : null);
  }

  function setHot(row) {
    for (const el of regionNow('marks').querySelectorAll('.hgx-mk')) el.classList.toggle('is-hot', !!row && el.dataset.rows.split(' ').includes(row));
  }
  host.addEventListener('pointerover', (e) => setHot(e.target.closest('.hgx-slot')?.dataset.row ?? null));
  host.addEventListener('pointerleave', () => setHot(null));
  host.addEventListener('focusin', (e) => setHot(e.target.closest('.hgx-slot')?.dataset.row ?? null));
  host.addEventListener('focusout', () => setHot(null));

  doc.querySelector('[data-hg-stage]').addEventListener('click', (e) => {
    const mk = e.target.closest('.hgx-mk');
    if (mk) setState({ tab: mk.dataset.tab, hp: mk.dataset.port });
  });
  // Am Fenster, nicht am Dokument: das Menue der Leiste schliesst dort mit
  // Escape und preventDefault, und sein Escape soll den Hardpoint halten.
  doc.defaultView.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.hp && !e.defaultPrevented) setState({ hp: null });
  });

  // -------------------------------------------------------------- Dock
  const cardOf = (id) => strip.querySelector(`.hg-card[data-id="${CSS.escape(id)}"]`);
  const visibleIds = () => items.filter((li) => !li.hidden).map((li) => li.dataset.id);

  function markCards(id) {
    for (const a of strip.querySelectorAll('.hg-card')) a.setAttribute('aria-current', a.dataset.id === id ? 'true' : 'false');
  }
  function scrollToCard(id, behavior = reduce ? 'auto' : 'smooth') {
    const li = cardOf(id)?.parentElement;
    if (li) strip.scrollTo({ left: li.offsetLeft - strip.clientWidth / 2 + li.clientWidth / 2, behavior });
  }
  function select(id, { scroll = true } = {}) {
    if (scroll) scrollToCard(id);
    setState({ ship: id, hp: null });
  }
  function step(d) {
    const ids = visibleIds();
    if (!ids.length) return;
    const i = ids.indexOf(state.ship);
    select(ids[(i < 0 ? 0 : i + d + ids.length) % ids.length]);
  }

  function applyDock() {
    const q = state.q.toLowerCase();
    let n = 0;
    for (const li of items) {
      const ok = (!q || li.dataset.q.includes(q)) && (!state.type || li.dataset.t === state.type)
        && (!state.maker || li.dataset.mk === state.maker) && (!state.fleetOnly || fleetIds.has(li.dataset.id));
      li.hidden = !ok;
      if (ok) n++;
    }
    $('hg-count').textContent = fillMessage(msg('count'), { n }, loc);
    // Leer, weil die Flotte leer ist, sagt etwas anderes als ein zu enger Filter.
    const noFleet = state.fleetOnly && fleetSummary(fleetIds, dock).n === 0;
    $('hgx-empty-fleet').hidden = !noFleet;
    $('hg-empty').hidden = n > 0 || noFleet;
  }
  function syncControls() {
    $('hg-q').value = state.q;
    $('hg-type').value = state.type;
    $('hg-maker-f').value = state.maker;
  }

  strip.addEventListener('click', (e) => {
    const a = e.target.closest('.hg-card');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    select(a.dataset.id, { scroll: false });
  });
  $('hg-prev').addEventListener('click', () => step(-1));
  $('hg-next').addEventListener('click', () => step(1));
  $('hg-q').addEventListener('input', () => setState({ q: $('hg-q').value }));
  $('hg-type').addEventListener('change', () => setState({ type: $('hg-type').value }));
  $('hg-maker-f').addEventListener('change', () => setState({ maker: $('hg-maker-f').value }));

  // Pfeiltasten wechseln das Schiff nur, wenn der Fokus auf der Seite, der
  // Buehne oder einer Dock-Karte liegt (Graft 7): jedes Bedienelement, das
  // Pfeile selbst braucht, behaelt sie, ohne sich hier abmelden zu muessen.
  doc.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const t = e.target;
    if (t !== doc.body && t !== doc.documentElement && !t.closest?.('.hg-card, [data-hg-stage]')) return;
    e.preventDefault();
    step(e.key === 'ArrowLeft' ? -1 : 1);
  });

  window.addEventListener('popstate', () => {
    const prev = state;
    state = parseState(location.search, location.hash, ctx);
    syncControls();
    if (prev.ship !== state.ship) scrollToCard(state.ship);
    render(prev);
  });

  // -------------------------------------------------------------- Flotte
  // Klicks auf [data-fleet-ship] und [data-fleet-retry] bindet fleet.js
  // selbst; hier wird nur der Schnappschuss gezeichnet.
  const fleetBtn = $('hgx-fleet');
  const fleetChip = $('hgx-fleetonly');
  const fleetSum = $('hgx-fleetsum');
  const fleetSync = $('hgx-fleetsync');
  const mergedNote = $('hgx-merged');
  let fleet = { ids: [], mode: 'guest', sync: 'local', error: null, merged: 0 };
  let fleetIds = new Set();
  let mergedSeen = 0;

  // Der Knopf folgt dem gewaehlten Schiff; fleet.js liest Schiff und Name erst
  // beim Klick. aria-pressed sofort, nicht erst nach dem naechsten Bild.
  function syncFleetBtn() {
    fleetBtn.dataset.fleetShip = state.ship;
    fleetBtn.dataset.fleetLabel = dock.get(state.ship).name;
    const on = !!window.VBFleet?.has(state.ship);
    fleetBtn.setAttribute('aria-pressed', String(on));
    fleetBtn.querySelector('.js-fleet-txt').textContent = on ? fleetBtn.dataset.fleetOn : fleetBtn.dataset.fleetOff;
  }

  function paintFleet() {
    const sum = fleetSummary(fleetIds, dock);
    for (const [id, s] of dock) {
      const on = fleetIds.has(id);
      s.li.classList.toggle('is-fleet', on);
      if (on) s.li.firstElementChild.setAttribute('aria-describedby', 'hgx-fleet-mark');
      else s.li.firstElementChild.removeAttribute('aria-describedby');
    }
    $('hgx-fleetn').textContent = new Intl.NumberFormat(loc).format(sum.n);
    $('hgx-fleetempty').hidden = sum.n > 0;
    fleetSum.hidden = sum.n === 0;
    $('hgx-fleetsum-txt').textContent = [
      fillMessage(msg('fleet-ships'), { n: sum.n }, loc),
      fillMessage(msg('fleet-scu'), { n: sum.scu }, loc),
      fillMessage(msg('fleet-crew'), { n: sum.crew }, loc),
      fillMessage(msg('fleet-roles'), { n: sum.roles }, loc),
    ].join(' · ');
    // Wo die Flotte liegt, sagt die Zeile erst, wenn dort etwas liegt oder ein Konto abgleicht.
    fleetSync.hidden = fleet.mode !== 'account' && sum.n === 0;
    for (const el of fleetSync.querySelectorAll('[data-when]')) el.hidden = el.dataset.when !== fleet.sync;
    // Der Hinweis zur Uebernahme steht, bis er weggeklickt ist; ein neuer Seitenaufruf kennt ihn nicht mehr.
    mergedNote.hidden = !(fleet.merged > 0 && fleet.merged !== mergedSeen);
    if (!mergedNote.hidden) $('hgx-merged-txt').textContent = fillMessage(msg('fleet-merged'), { n: fleet.merged }, loc);
  }

  function paintFleetFilter() {
    fleetChip.setAttribute('aria-pressed', String(state.fleetOnly));
    fleetSum.setAttribute('aria-pressed', String(state.fleetOnly));
  }
  fleetChip.addEventListener('click', () => setState({ fleetOnly: !state.fleetOnly }));
  fleetSum.addEventListener('click', () => setState({ fleetOnly: !state.fleetOnly }));
  $('hgx-merged-x').addEventListener('click', () => {
    mergedSeen = fleet.merged;
    mergedNote.hidden = true;
  });

  // Der Anmelde-Link nimmt den Zustand der Seite mit; loginHref() liest die
  // Adresse erst beim Aufruf, deshalb kurz vor dem Folgen.
  const login = $('hgx-login');
  const freshLogin = () => { if (window.VBAccount) login.href = window.VBAccount.loginHref(); };
  for (const ev of ['pointerdown', 'focus', 'click']) login.addEventListener(ev, freshLogin);

  function onFleet(snap) {
    fleet = snap;
    fleetIds = new Set(snap.ids);
    paintFleet();
    syncFleetBtn();
    if (state.fleetOnly) applyDock();
  }

  // -------------------------------------------------------------- Link kopieren
  const copyBtn = $('hgx-copy');
  const copyField = $('hgx-copyfield');
  let copyTimer = 0;
  copyBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}${serializeState(state, ctx, 'share')}`;
    const m = msg('copy');
    try {
      await navigator.clipboard.writeText(url);
      copyField.hidden = true;
      live.textContent = m.ok;
      copyBtn.classList.add('is-done');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => copyBtn.classList.remove('is-done'), 1600);
    } catch {
      copyField.value = url;
      copyField.hidden = false;
      copyField.focus();
      copyField.select();
      live.textContent = m.fallback;
    }
  });

  // -------------------------------------------------------------- Viewer
  let viewer = null;
  const loadEl = $('hg-load');
  const bar = loadEl.querySelector('i');

  // show() loest auch auf, wenn ein neueres show() es ueberholt hat: nur der
  // eigene Zaehler sagt, ob das Modell dieser Auswahl wirklich steht.
  let showTok = 0;
  function viewerShow(id) {
    if (!viewer) return;
    const my = ++showTok;
    placed = null;
    syncMarks();
    // Die Nahansicht eines Hardpoints nicht auf das naechste Schiff tragen.
    if (focused) {
      focused = null;
      viewer.focus(null);
    }
    const [glb, tex, maker] = stageCfg.models[id];
    const t = setTimeout(() => { loadEl.hidden = false; }, 180);
    viewer.show(glb, { maker, tex })
      .then(() => {
        if (my !== showTok) return;
        placed = id;
        syncMarks();
        applyFocus();
      })
      .catch(() => { if (my === showTok) modelErr.hidden = false; })
      .finally(() => {
        clearTimeout(t);
        if (my === showTok) loadEl.hidden = true;
      });
  }

  loadEl.hidden = false;
  import(stageCfg.viewer)
    .then((m) => m.initHangar($('hg-canvas'), { reduceMotion: reduce, ...stageCfg.opts }))
    .then((v) => {
      viewer = v;
      v.onProgress((p) => bar.style.setProperty('--p', `${p}%`));
      v.onFrame(placeMarks);
      $('hg-reset').addEventListener('click', () => {
        if (state.hp) setState({ hp: null });
        else v.resetView();
      });
      // Szenenseitige Skripte hoeren hierauf, statt den Viewer ein zweites Mal zu laden.
      const sec = doc.querySelector('[data-hg-stage]');
      sec.hangarViewer = v;
      sec.dispatchEvent(new CustomEvent('hangar:viewer', { detail: v }));
      viewerShow(state.ship);
    })
    .catch(() => {
      loadEl.hidden = true;
      $('hg-fallback').hidden = false;
    });

  // -------------------------------------------------------------- Start
  writeUrl();
  syncControls();
  syncFleetBtn();
  paintFleetFilter();
  // fleet.js laeuft vor diesem Modul (beide verzoegert, in Dokumentfolge);
  // das Ereignis faengt nur den Fall, dass es spaeter kommt.
  if (window.VBFleet) window.VBFleet.subscribe(onFleet);
  else window.addEventListener('vb-fleet-ready', () => window.VBFleet.subscribe(onFleet), { once: true });
  applyDock();
  scrollToCard(state.ship, 'auto');
  if (state.ship !== ctx.defaultShip) showShip(state.ship);
  else {
    markCards(state.ship);
    applyTab();
    applyHp();
    prefetchNeighbours(state.ship);
  }
}
