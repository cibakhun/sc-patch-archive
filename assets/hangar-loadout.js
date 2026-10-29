// Advanced Loadout als eigene Seite (/hangar-loadout.html, /de/hangar-loadout.html).
// Krisz 10-21: raus aus dem Hangar und viel einfacher zu bedienen. Links die
// ganze Ausstattung des Schiffs ohne Reiter, rechts der gewaehlte Platz: oben
// der Vergleich (eingebaut gegen Serie, oder eine angeklickte Zeile gegen
// eingebaut), darunter alle passenden Teile mit einem Knopf "Einbauen" je
// Zeile. Jede Zahl hat eine Erklaerung in Worten.
//
// Dieselben Daten (/hangar-layouts.json), derselbe Link-Code (?ship=&layout=)
// und dieselbe Ablage (localStorage 'vb.layouts.v1') wie die Werkstatt im
// Hangar: ein Layout geht ohne Umweg hin und zurueck, "Meine Layouts" sind
// auf beiden Seiten dieselben. Die reinen Funktionen kommen aus
// assets/hangar-layouts.js (data-lib, mit Inhalts-Hash), die Woerter aus
// #lo-msg (src/components/hangar/LoadoutPage.astro).

const doc = document;
const $ = (id) => doc.getElementById(id);
const root = $('lo');
const lib = await import(root.dataset.lib);
const { encodeLayout, decodeLayout, EMPTY_CODE, shipSlots, rackSlot, rackMissile, cleanSlots, candidates, deltaPct, sameLayout, changeCount, accountStore, newId, WEAPON_TYPES } = lib;

const loc = root.dataset.loc;
const de = root.dataset.lang === 'de';
const nf = new Intl.NumberFormat(loc);
const f1 = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 });
const f2 = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 });
const pr = new Intl.PluralRules(loc);
const m = (k) => doc.querySelector(`#lo-msg [data-m="${k}"]`)?.textContent ?? k;
const fill = (tpl, vals) => tpl.replace(/\{(\w+)\}/g, (x, k) => (k in vals ? String(vals[k]) : x));
const plural = (base, n) => fill(m(`${base}.${pr.select(n) === 'one' ? 'one' : 'other'}`), { n: nf.format(n) });
let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
// Gast: dieser Browser; angemeldet: Spiegel des Kontos + Abgleich (assets/hangar-layouts.js).
const acct = accountStore({ storage, account: null, onChange: () => repaintSaved() });
const store = acct.store;
const SHIPS = JSON.parse($('lo-ships').textContent);
const shipById = new Map(SHIPS.map((s) => [s.id, s]));
const shipName = (id) => shipById.get(id)?.name ?? id;

/** Element mit Attributen; Kinder als Knoten oder Text, nie als Markup. */
function el(tag, attrs, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
}

/* ---------------------------------------------------------- Zustand --- */

/** @type {{ items: Record<string, any[]>, ships: Record<string, any[]>, racks?: Record<string, any[]>, paints?: Record<string, any> }} */
let data = null;
let draft = { ship: '', name: '', slots: {} };
let slots = [];
let savedId = null;
let sel = null;        // Schluessel des gewaehlten Platzes oder 'paint'
let prev = null;       // angeklickte Zeile zum Vergleich
let sort = { key: 'main', dir: -1 };
let query = '';
let cmpAll = false;    // Vergleich: auch gleiche Werte zeigen

const GROUPS = ['pilot', 'manned', 'remote', 'missile', 'bomb', 'power', 'cooler', 'shield', 'quantum', 'radar'];
const current = (slot) => draft.slots[slot.key] ?? slot.stock;
const eff = (slot) => rackSlot(slot, draft.racks?.[slot.key], data.racks);
const isChanged = (slot) => slot.key in draft.slots || !!draft.racks?.[slot.key];
const times = (n) => (n > 1 ? `${n}× ` : '');
const placeholder = () => fill(m('name.placeholder'), { ship: shipName(draft.ship) });
const itemName = (k) => {
  const it = data.items[k];
  return it ? (de && it[1]) || it[0] : m('slot.unknown');
};
const rackName = (k) => {
  const r = data.racks?.[k];
  return r ? (de && r[1]) || r[0] : m('slot.unknown');
};
const dmg = () => m('unit.damage');
const UNIT = { gun: () => 'DPS', missile: dmg, torpedo: dmg, gmissile: dmg, bomb: dmg, power: () => m('unit.power'), cooler: () => m('unit.cooling'), shield: () => 'HP', quantum: () => 'Mm/s', radar: () => m('unit.sensitivity') };
const mainEx = (type) => m(`ex.main.${type === 'gun' ? 'gun' : WEAPON_TYPES.has(type) ? 'ord' : type}`);
const CLS = { Military: 'cls.military', Civilian: 'cls.civilian', Industrial: 'cls.industrial', Stealth: 'cls.stealth', Competition: 'cls.competition' };
function subLine(k) {
  const it = data.items[k];
  if (!it) return '';
  const parts = it[2] === 'gun'
    ? [it[4] || null, it[8]?.dt ? m(`dt.${it[8].dt}`) : null]
    : WEAPON_TYPES.has(it[2])
      ? [it[4] || null, it[8]?.trk ? m(`trk.${it[8].trk}`) : null]
      : [it[5] ? (CLS[it[5]] ? m(CLS[it[5]]) : it[5]) : null, it[6] ? fill(m('grade'), { g: it[6] }) : null];
  return parts.filter(Boolean).join(' · ');
}

/* ---------------------------------------------------------- Werte --- */

// Werte, bei denen weniger besser ist: der Pfeil zeigt die Richtung, die Farbe das Urteil.
const LOWER = new Set(['sp.spread', 'sp.heat', 'sp.ovf', 'sp.chd', 'sp.lkT', 'sp.pw', 'sp.em', 'sp.ir', 'sp.spool',
  'sp.arm', 'sp.ign', 'sp.dly', 'sp.down', 'sp.cd', 'sp.fuel', 'sp.full', 'sp.price']);
const DT = [['dP', 'dt.p'], ['dE', 'dt.e'], ['dD', 'dt.d'], ['dT', 'dt.t']];
const alphaOf = (x) => DT.reduce((a, [k]) => a + (x?.[k] ?? 0), 0);
const COL_ORDER = ['sp.alpha', 'dP', 'dE', 'dD', 'dT', 'sp.rate', 'sp.speed', 'sp.range', 'sp.spread', 'sp.mag', 'sp.empty',
  'sp.chg', 'sp.chr', 'sp.chd', 'sp.heat', 'sp.hot', 'sp.cps', 'sp.ovf',
  'sp.trk', 'sp.mspeed', 'sp.lkR', 'sp.lkT', 'sp.lkA', 'sp.blast', 'sp.arm', 'sp.ign', 'sp.life',
  'sp.regen', 'sp.full', 'sp.dly', 'sp.down', 'sp.rP', 'sp.rE', 'sp.rD', 'sp.aP', 'sp.aE', 'sp.aD',
  'sp.cd', 'sp.fuel', 'sp.a1', 'sp.a2', 'sp.spool', 'sp.pw', 'sp.em', 'sp.ir', 'sp.hp', 'sp.price'];
// Die Spalten, die je Art ohne "Alle Werte" stehen: was beim Waehlen zaehlt.
const CORE = {
  gun: ['sp.alpha', 'sp.range', 'sp.speed', 'sp.price'],
  missile: ['sp.trk', 'sp.lkR', 'sp.mspeed', 'sp.price'],
  bomb: ['sp.blast', 'sp.arm', 'sp.price'],
  shield: ['sp.regen', 'sp.dly', 'sp.price'],
  power: ['sp.em', 'sp.price'],
  cooler: ['sp.pw', 'sp.ir', 'sp.price'],
  quantum: ['sp.spool', 'sp.fuel', 'sp.price'],
  radar: ['sp.pw', 'sp.em', 'sp.price'],
};
CORE.torpedo = CORE.missile;
CORE.gmissile = CORE.missile;
const exOf = (id) => {
  if (/^d[PEDT]$/.test(id)) return m('ex.sp.alpha');
  if (/^sp\.r[PED]$/.test(id)) return m('ex.sp.res');
  if (/^sp\.a[PED]$/.test(id)) return m('ex.sp.abs');
  return m(`ex.${id}`);
};

/** Jede Zahl eines Teils als [id, Bezeichnung, Text, Einheit, Zahl zum Sortieren und Vergleichen]. */
function specs(k) {
  const it = data.items[k];
  if (!it) return [];
  const x = it[8] ?? {};
  const out = [];
  const add = (id, v, unit = '', label = m(id), fmt = f1) => {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out.push([id, label, fmt.format(v), unit, v]);
  };
  // Spanne "min|max" in Prozent; verglichen wird der Hoechstwert.
  const span = (id, v, label) => {
    if (typeof v !== 'string') return;
    const [a, b] = v.split('|').map(Number);
    out.push([id, label, a === b ? nf.format(b) : `${nf.format(a)}–${nf.format(b)}`, '%', b]);
  };
  const sig = () => { add('sp.pw', x.pw); add('sp.em', x.em); add('sp.ir', x.ir); };
  // Die Aufteilung nach Art lohnt erst bei gemischtem Schaden.
  const split = () => { if (DT.filter(([key]) => x[key] > 0).length > 1) for (const [key, lk] of DT) add(key, x[key], '', m(lk)); };
  if (it[2] === 'gun') {
    add('sp.alpha', alphaOf(x));
    split();
    add('sp.rate', x.rate, m('u.rpm'));
    add('sp.mag', x.mag, m('u.shots'));
    if (x.mag && x.rate) add('sp.empty', (x.mag / x.rate) * 60, 's');
    add('sp.speed', x.spd, 'm/s');
    add('sp.range', x.rng, 'm');
    add('sp.spread', x.spr, '°', m('sp.spread'), f2);
    add('sp.heat', x.hps, '', m('sp.heat'), f2);
    if (x.hps && x.ovh) add('sp.hot', Math.floor(x.ovh / x.hps), m('u.shots'));
    add('sp.cps', x.cps, '/s');
    add('sp.ovf', x.ovf, 's');
    add('sp.chg', x.chg);
    add('sp.chr', x.chr, '/s');
    add('sp.chd', x.chd, 's', m('sp.chd'), f2);
    sig();
  } else if (WEAPON_TYPES.has(it[2])) {
    split();
    if (x.trk) out.push(['sp.trk', m('sp.trk'), m(`trk.${x.trk}`), '', null]);
    add('sp.blast', x.blast, 'm');
    add('sp.arm', x.arm, 's');
    add('sp.ign', x.ign, 's');
    add('sp.life', x.life, 's');
    add('sp.mspeed', x.spd, 'm/s');
    add('sp.lkR', x.lkR, 'm');
    add('sp.lkT', x.lkT, 's');
    add('sp.lkA', x.lkA, '°');
  } else if (it[2] === 'shield') {
    add('sp.regen', x.regen, 'HP/s');
    if (x.regen) add('sp.full', it[7] / x.regen, 's');
    add('sp.dly', x.dly, 's');
    add('sp.down', x.down, 's');
    for (const [t, lk] of [['P', 'dt.p'], ['E', 'dt.e'], ['D', 'dt.d']]) span(`sp.r${t}`, x[`r${t}`], fill(m('sp.res'), { t: m(lk) }));
    for (const [t, lk] of [['P', 'dt.p'], ['E', 'dt.e'], ['D', 'dt.d']]) span(`sp.a${t}`, x[`a${t}`], fill(m('sp.abs'), { t: m(lk) }));
    sig();
  } else if (it[2] === 'quantum') {
    add('sp.cd', x.cd, 's');
    add('sp.fuel', x.fuel);
    add('sp.a1', x.a1, 'Mm/s²');
    add('sp.a2', x.a2, 'Mm/s²');
    add('sp.spool', x.spool, 's');
    sig();
  } else sig();
  add('sp.hp', x.hp, 'HP');
  out.push(['sp.price', m('sp.price'), it[9] ? nf.format(it[9]) : '–', 'aUEC', it[9] || 0]);
  return out.sort((a, b) => COL_ORDER.indexOf(a[0]) - COL_ORDER.indexOf(b[0]));
}

// Summen des ganzen Layouts: Feuerkraft, Salve, Raketen, Schild, Strom, Kuehlung, Quantum.
function tally(pick) {
  const t = { fire: 0, alpha: 0, ord: 0, ordn: 0, shield: 0, regen: 0, power: 0, cool: 0, qt: 0 };
  for (const s of slots) {
    const [k, n] = pick(s);
    const it = data.items[k];
    if (!it) continue;
    const x = it[8] ?? {};
    if (it[2] === 'gun') { t.fire += it[7] * n; t.alpha += alphaOf(x) * n; }
    else if (WEAPON_TYPES.has(it[2])) { t.ord += it[7] * n; t.ordn += n; }
    else if (it[2] === 'shield') { t.shield += it[7] * n; t.regen += (x.regen ?? 0) * n; }
    else if (it[2] === 'power') t.power += it[7] * n;
    else if (it[2] === 'cooler') t.cool += it[7] * n;
    else if (it[2] === 'quantum') t.qt = Math.max(t.qt, it[7]);
  }
  return t;
}
const TOT = [['fire', 'tot.fire', 'DPS'], ['alpha', 'tot.alpha', ''], ['ord', 'tot.ord', ''], ['ordn', 'tot.ordn', ''],
  ['shield', 'tot.shield', 'HP'], ['regen', 'tot.regen', 'HP/s'], ['power', 'tot.power', ''], ['cool', 'tot.cool', ''], ['qt', 'tot.qt', 'Mm/s']];

/** ▲/▼ mit Betrag; die Farbe sagt besser oder schlechter. */
function deltaEl(d, lower = false, fmt = f1, suffix = '') {
  if (!d) return el('span', { class: 'lo-d' });
  const good = (d > 0) !== lower;
  return el('span', { class: `lo-d ${good ? 'is-good' : 'is-bad'}`, title: m(good ? 'lo.better' : 'lo.worse') }, `${d > 0 ? '▲' : '▼'} ${fmt.format(Math.abs(d))}${suffix}`);
}

/* ---------------------------------------------------------- Zeichen --- */

const MISSILE = 'M14.5 4.5l5-1-1 5-8.8 8.8-4-4zM9.7 17.3l-2.2 3.2-1-3-3-1 3.2-2.2M14 10h.01';
const ICON = {
  gun: 'M12 4.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zM12 2v5M12 17v5M2 12h5M17 12h5',
  missile: MISSILE, torpedo: MISSILE, gmissile: MISSILE, bomb: 'M10.5 8.5a6 6 0 110 12 6 6 0 010-12zM14.5 9.5l2.5-2.5M17 4v2M19.5 6.5h-2',
  shield: 'M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6z',
  power: 'M13 2.5L5 13.5h6l-1 8 8-11h-6z',
  cooler: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5',
  quantum: 'M4.5 6l6 6-6 6M12 6l6 6-6 6',
  radar: 'M4 13a8 8 0 0116 0M7.5 13a4.5 4.5 0 019 0M12 13l4-6M12 14.5a1.5 1.5 0 100-3',
  paint: 'M12 3a9 9 0 100 18c1.2 0 1.8-.8 1.8-1.8 0-1.3-1-1.6-1-2.6 0-.9.7-1.6 1.6-1.6H17a4 4 0 004-4C21 6.5 17 3 12 3zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01',
};
function ico(type) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(NS, 'path');
  path.setAttribute('d', ICON[type] ?? ICON.gun);
  svg.append(path);
  return svg;
}
const sock = (type, size) => el('span', { class: 'lo-sock' }, ico(type), size ? el('b', {}, `S${size}`) : null);

/* ---------------------------------------------------------- Adresse --- */

const code = () => encodeLayout(draft);
const query4 = (lo) => `?ship=${encodeURIComponent(lo.ship)}${encodeLayout(lo) === EMPTY_CODE ? '' : `&layout=${encodeLayout(lo)}`}`;
let urlTimer = 0;
function writeUrl(soon = false) {
  clearTimeout(urlTimer);
  const go = () => history.replaceState(null, '', `${location.pathname}${query4(draft)}`);
  if (soon) urlTimer = setTimeout(go, 350); else go();
}

function adopt(ship, lo) {
  const raw = decodeLayout(lo ?? EMPTY_CODE) ?? { name: '', slots: {} };
  slots = shipSlots(data.ships[ship]);
  const { slots: clean, racks: rk, dropped: lost } = cleanSlots(raw.slots, slots, data.items, raw.racks, data.racks);
  const paint = raw.paint && data.paints?.[ship]?.list.some((r) => r[0] === raw.paint) ? raw.paint : null;
  const dropped = lost + (raw.paint && !paint ? 1 : 0);
  draft = { ship, name: raw.name, slots: clean, ...(Object.keys(rk).length ? { racks: rk } : {}), ...(paint ? { paint } : {}) };
  savedId = store.list().find((e) => sameLayout(e, draft))?.id ?? null;
  // Der erste Platz ist gewaehlt: rechts steht nie eine leere Flaeche.
  sel = GROUPS.map((g) => slots.find((x) => x.group === g)).find(Boolean)?.key ?? (data.paints?.[ship] ? 'paint' : null);
  prev = null;
  query = '';
  sort = { key: 'main', dir: -1 };
  writeUrl();
  paintAll();
  if (dropped) toast(plural('msg.dropped', dropped));
}

/* ---------------------------------------------------------- Kopf --- */

const shipSel = $('lo-shipsel');
const nameIn = $('lo-name');
shipSel.replaceChildren(...SHIPS.map((s) => el('option', { value: s.id }, s.maker ? `${s.name} · ${s.maker}` : s.name)));

function paintTop() {
  shipSel.value = draft.ship;
  nameIn.value = draft.name;
  nameIn.placeholder = placeholder();
  const n = changeCount(draft);
  const st = $('lo-state');
  st.dataset.s = n ? 'changed' : 'stock';
  st.textContent = `${n ? plural('state.changed', n) : m('state.stock')} · ${m(savedId ? 'state.saved' : 'state.unsaved')}`;
  $('lo-count').textContent = nf.format(store.list().length);
  $('lo-reset').disabled = n === 0;
  $('lo-back').href = `${root.dataset.hangar}${query4(draft)}`;
  doc.title = `${shipName(draft.ship)} · ${m('lo.title')} | VerseBase`;
}

// Drei kurze Bloecke statt Textkarten: Zahl, ▲/▼ und ein Balken gegen Serie.
// Die Erklaerung steht im Tooltip, nicht als Satz darunter.
const SUMG = [['lo.sumAtk', ['fire', 'alpha', 'ord', 'ordn']], ['lo.sumDef', ['shield', 'regen']], ['lo.sumSys', ['power', 'cool', 'qt']]];
function paintSum() {
  const now = tally((s) => [current(s), eff(s).count]);
  const stock = tally((s) => [s.stock, s.count]);
  const byKey = new Map(TOT.map((r) => [r[0], r]));
  $('lo-sum').replaceChildren(...SUMG.map(([gk, keys]) => {
    const rows = keys.filter((k) => now[k] || stock[k]).map((k) => {
      const [, lk, unit] = byKey.get(k);
      const top = Math.max(now[k], stock[k]) || 1;
      return el('div', { class: 'lo-st', title: m(`ex.${k}`) },
        el('span', { class: 'lo-st__l' }, m(lk)),
        el('b', { class: 'lo-st__v' }, f1.format(Math.round(now[k] * 10) / 10), unit ? el('small', {}, ` ${unit}`) : null),
        deltaEl(Math.round(now[k] - stock[k]), false, nf),
        el('span', { class: `lo-st__bar${now[k] < stock[k] ? ' is-low' : now[k] > stock[k] ? ' is-up' : ' is-even'}`, 'aria-hidden': 'true', style: `--w:${(now[k] / top) * 100}%;--s:${(stock[k] / top) * 100}%` }));
    });
    return rows.length ? el('section', { class: 'lo-sumg' }, el('h3', {}, m(gk)), ...rows) : null;
  }).filter(Boolean));
}

/* ---------------------------------------------------------- Ausstattung --- */

function paintEquip() {
  const parts = GROUPS.map((g) => {
    const rows = slots.filter((s) => s.group === g);
    if (!rows.length) return null;
    return [g, el('section', { class: 'lo-grp', 'data-g': g }, el('h3', {}, m(`grp.${g}`)),
      el('ul', {}, rows.map((slot) => {
        const k = current(slot);
        const e = eff(slot);
        const it = data.items[k];
        const st = data.items[slot.stock];
        const d = it && st && isChanged(slot) ? deltaPct(it[7] * e.count, st[7] * slot.count) : null;
        // Hersteller und Art nur im Tooltip: links steht pro Platz ein Name und eine Zahl.
        return el('li', {}, el('button', { type: 'button', class: `lo-slot${slot.key === sel ? ' is-sel' : ''}${isChanged(slot) ? ' is-changed' : ''}`, 'data-sel': slot.key, 'aria-pressed': String(slot.key === sel), title: subLine(k) },
          sock(e.type, e.size),
          el('span', { class: 'lo-slot__nm' }, el('strong', {}, `${times(e.count)}${itemName(k)}`),
            isChanged(slot) ? el('small', {}, el('em', {}, m('lo.changed'))) : null),
          el('span', { class: 'lo-slot__fig' }, it ? nf.format(it[7]) : '–', el('small', {}, UNIT[e.type]()),
            d ? deltaEl(d, false, nf, ' %') : null),
          el('span', { class: 'lo-chev', 'aria-hidden': 'true' }, '›')));
      })))];
  }).filter(Boolean);
  // Grosskategorien zuerst sichtbar: Waffen, Komponenten, Lackierung als eigene Baender.
  const big = (key, icon, kids) => (kids.length ? el('section', { class: 'lo-big', 'data-big': key },
    el('h2', { class: 'lo-big__h' }, el('span', { class: 'lo-big__i', 'aria-hidden': 'true' }, icon), m(key)), ...kids) : null);
  const WEAP = new Set(['pilot', 'manned', 'remote', 'missile', 'bomb']);
  const groups = [
    big('big.weapons', ico('gun'), parts.filter(([g]) => WEAP.has(g)).map(([, n]) => n)),
    big('big.comp', ico('power'), parts.filter(([g]) => !WEAP.has(g)).map(([, n]) => n)),
  ].filter(Boolean);
  const sp = data.paints?.[draft.ship];
  if (sp) {
    const row = draft.paint && sp.list.find((r) => r[0] === draft.paint);
    const cols = row ? row.slice(2, 5) : sp.base;
    groups.push(big('cat.paint', el('span', { class: 'lo-big__sw' }, cols.map((c) => el('i', { style: `background:${c}` }))), [el('section', { class: 'lo-grp' },
      el('ul', {}, el('li', {}, el('button', { type: 'button', class: `lo-slot${sel === 'paint' ? ' is-sel' : ''}${draft.paint ? ' is-changed' : ''}`, 'data-sel': 'paint', 'aria-pressed': String(sel === 'paint') },
        el('span', { class: 'lo-sock lo-sw' }, cols.map((c) => el('i', { style: `background:${c}` }))),
        el('span', { class: 'lo-slot__nm' }, el('strong', {}, row ? row[1] : m('paint.stock')), el('small', {}, draft.paint ? el('em', {}, m('lo.changed')) : null, m('lo.paintHint'))),
        el('span', { class: 'lo-chev', 'aria-hidden': 'true' }, '›')))))]));
  }
  $('lo-equip-list').replaceChildren(...(groups.length ? groups : [el('p', { class: 'lo-msgline' }, m('noslots'))]));
}

/* ---------------------------------------------------------- Auswahl --- */

const pick = $('lo-pick');
const selSlot = () => slots.find((s) => s.key === sel) ?? null;

function rackBar(slot) {
  const on = draft.racks?.[slot.key] ?? slot.racks[0];
  const order = [...slot.racks].sort((a, b) => data.racks[a][4] - data.racks[b][4] || data.racks[b][3] - data.racks[a][3]);
  return el('div', { class: 'lo-racks', role: 'group', 'aria-label': m('rack.label') },
    el('span', { class: 'lo-racks__h' }, m('rack.label')),
    el('div', { class: 'lo-racks__row' }, order.map((k) => {
      const r = data.racks[k];
      return el('button', { type: 'button', class: 'lo-rack', 'data-rack': k, 'aria-pressed': String(k === on), title: rackName(k) },
        el('b', {}, `${r[3]}× S${r[4]}`), k === slot.racks[0] ? el('small', {}, m('slot.stock')) : null);
    })),
    el('small', { class: 'lo-racks__info' }, rackName(on)));
}

/** Vergleich zweier Teile als Balken: rechts gruen = besser, links rot = schlechter.
 *  Gleiche Werte treten zurueck; die Erklaerung steht im Tooltip. */
function compareTable(slot, a, b, headA, headB) {
  const type = eff(slot).type;
  const ia = data.items[a];
  const ib = data.items[b];
  const sa = specs(a);
  const sb = b ? specs(b) : [];
  const ids = [...new Set([...sa, ...sb].map((r) => r[0]))].sort((x, y) => COL_ORDER.indexOf(x) - COL_ORDER.indexOf(y));
  const rows = [[UNIT[type](), '', mainEx(type), ia ? nf.format(ia[7]) : '–', ib ? nf.format(ib[7]) : '–', ia?.[7], ib?.[7], false, nf]];
  for (const id of ids) {
    const ra = sa.find((r) => r[0] === id);
    const rb = sb.find((r) => r[0] === id);
    const r = ra ?? rb;
    if (id === 'sp.price' && !(ra?.[4] > 0) && !(rb?.[4] > 0)) continue;
    const fmt = id === 'sp.spread' || id === 'sp.heat' || id === 'sp.chd' ? f2 : f1;
    rows.push([r[1], r[3], exOf(id), ra ? ra[2] : '–', rb ? rb[2] : '–', ra?.[4], rb?.[4], LOWER.has(id), fmt]);
  }
  // Erst was sich aendert, gleiche Werte hinter einem Klick: weniger Zahlen auf einmal.
  const built = rows.map(([label, unit, ex, va, vb, na, nb, lower, fmt], i) => {
    const both = na > 0 && nb > 0;
    const d = both ? na - nb : 0;
    const good = (d > 0) !== lower;
    const rel = both && d ? Math.min(Math.abs(d) / nb, 1) : 0;
    const node = el('div', { class: `lo-dv__r${d ? (good ? ' is-up' : ' is-down') : ' is-same'}${i === 0 ? ' is-key' : ''}`, role: 'row', title: ex },
      el('span', { role: 'rowheader', class: 'lo-dv__l' }, label, unit && unit !== label ? el('small', {}, ` ${unit}`) : null),
      el('span', { role: 'cell', class: 'is-num lo-dv__b' }, vb),
      el('span', { role: 'cell', class: 'is-mid' },
        el('span', { class: `lo-dv__bar${d ? (good ? ' is-good' : ' is-bad') : ''}`, 'aria-hidden': 'true', style: `--r:${rel * 50}%` }),
        d ? deltaEl(d, lower, fmt) : null),
      el('b', { role: 'cell', class: 'is-num' }, va));
    return { node, d, key: i === 0 };
  });
  const top = built.filter((r) => r.key || r.d);
  const rest = built.filter((r) => !r.key && !r.d);
  const fold = top.length > 1 && rest.length > 0;
  const shown = fold && !cmpAll ? top : built;
  return el('div', { class: 'lo-dv', role: 'table', 'aria-label': `${headB} / ${headA}` },
    // Links das Alte (eingebaut bzw. Serie), rechts das Neue: gelesen wird von links nach rechts.
    el('div', { class: 'lo-dv__r lo-dv__h', role: 'row' }, el('span', { role: 'columnheader' }, m('win.value')), el('span', { role: 'columnheader', class: 'is-num' }, headB),
      el('span', { role: 'columnheader', class: 'is-mid' }, m('win.diff')), el('span', { role: 'columnheader', class: 'is-num' }, headA)),
    ...shown.map((r) => r.node),
    fold ? el('button', { type: 'button', class: 'lo-dv__more', 'data-cmpall': '1', 'aria-expanded': String(cmpAll) },
      cmpAll ? m('lo.less') : fill(m('lo.sameN'), { n: nf.format(rest.length) })) : null);
}

function colsFor(keys, type) {
  const seen = new Map();
  for (const k of keys) for (const [id, label, , unit] of specs(k)) if (!seen.has(id)) seen.set(id, { id, label, unit });
  const all = [...seen.values()].sort((a, b) => COL_ORDER.indexOf(a.id) - COL_ORDER.indexOf(b.id));
  return all.filter((c) => CORE[type]?.includes(c.id));
}

function paintPick() {
  if (sel === 'paint') { paintPaintPick(); return; }
  const slot = selSlot();
  if (!slot) { pick.replaceChildren(); return; }
  const e = eff(slot);
  const now = current(slot);
  const keys = candidates(e, data.items);
  if (prev && (!keys.includes(prev) || prev === now)) prev = null;
  const head = el('div', { class: 'lo-pickhead' },
    sock(e.type, e.size),
    el('div', { title: `${m(`grp.${slot.group}`)} · ${fill(m('lo.size'), { s: e.size })}` }, el('h2', {}, `${times(e.count)}${itemName(now)}`), el('small', {}, subLine(now))),
    isChanged(slot) && slot.stock ? el('button', { type: 'button', class: 'lo-btn', 'data-revert': slot.key }, m('slot.revert')) : null);

  // Unter der Liste der Vergleich: angeklickte Zeile gegen eingebaut, sonst eingebaut gegen Serie.
  const cmpHead = prev ? fill(m('lo.vsNow'), { a: itemName(prev) }) : m('lo.vsStock');
  const cmp = el('section', { class: `lo-box lo-cmpbox${prev ? ' is-prev' : ''}`, id: 'lo-cmp' },
    el('div', { class: 'lo-box__h' }, el('h3', {}, cmpHead),
      prev ? el('button', { type: 'button', class: 'lo-btn is-main', 'data-fit': prev }, m('lo.fit')) : null),
    prev ? compareTable(slot, prev, now, m('lo.new'), m('slot.fitted')) : compareTable(slot, now, slot.stock, m('slot.fitted'), m('saved.stock')));

  // Oben alle passenden Teile.
  const cols = colsFor(keys, e.type);
  const base = data.items[now]?.[7] ?? null;
  const best = Math.max(...keys.map((k) => data.items[k]?.[7] ?? 0), 1);
  const val = (k) => (sort.key === 'main' ? data.items[k][7] : specs(k).find(([id]) => id === sort.key)?.[4] ?? null);
  const sorted = sort.key === 'name'
    ? [...keys].sort((a, b) => itemName(a).localeCompare(itemName(b), loc) * sort.dir)
    : [...keys].sort((a, b) => { const va = val(a), vb = val(b); return va == null || vb == null ? (va == null) - (vb == null) : (va - vb) * sort.dir; });
  const q = query.trim().toLowerCase();
  const shown = q ? sorted.filter((k) => `${data.items[k][0]} ${data.items[k][1] || ''} ${data.items[k][4] || ''}`.toLowerCase().includes(q)) : sorted;
  const th = (c, ex, cls = '') => {
    const on = sort.key === c.id;
    return el('th', { scope: 'col', class: `${c.id === 'name' ? '' : 'is-num'} ${cls}`.trim() || null, 'aria-sort': on ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none', title: ex },
      el('button', { type: 'button', class: 'lo-sort', 'data-sort': c.id }, c.label, c.unit && c.unit !== c.label ? el('small', {}, ` ${c.unit}`) : null,
        el('i', { 'aria-hidden': 'true' }, on ? (sort.dir < 0 ? '▼' : '▲') : '')));
  };
  const rows = shown.map((k) => {
    const it = data.items[k];
    const row = specs(k);
    const d = k === now ? null : deltaPct(it[7], base);
    return el('tr', { class: `lo-opt${k === now ? ' is-now' : ''}${k === prev ? ' is-prev' : ''}`, 'data-k': k, tabindex: '0', 'aria-selected': String(k === prev) },
      el('td', { class: 'is-name' }, el('b', {}, itemName(k)), k === slot.stock ? el('em', {}, m('slot.stock')) : null, el('small', {}, subLine(k))),
      el('td', { class: 'is-num is-main' }, el('span', { class: 'lo-mainv' }, nf.format(it[7]), d ? deltaEl(d, false, nf, ' %') : null),
        el('span', { class: 'lo-mainbar', 'aria-hidden': 'true', style: `--w:${(it[7] / best) * 100}%` })),
      cols.map((c) => { const r = row.find(([id]) => id === c.id); return el('td', { class: 'is-num is-col' }, r ? r[2] : '–'); }),
      el('td', { class: 'is-act' }, k === now ? el('span', { class: 'lo-fitted' }, m('slot.fitted')) : el('button', { type: 'button', class: 'lo-btn lo-fit', 'data-fit': k }, m('lo.fit'))));
  });
  const search = el('input', { type: 'search', class: 'lo-q', id: 'lo-q', value: query, placeholder: m('pick.search'), 'aria-label': m('pick.searchLabel'), autocomplete: 'off' });
  const list = el('section', { class: 'lo-box' },
    el('div', { class: 'lo-box__h' }, el('h3', {}, m('lo.pickFor')), el('span', { class: 'lo-n' }, plural('pick.count', shown.length))),
    el('div', { class: 'lo-pickbar' }, search),
    el('div', { class: 'lo-scroll lo-optscroll' }, el('table', { class: 'lo-t lo-opts' },
      el('thead', {}, el('tr', {}, th({ id: 'name', label: m('win.part'), unit: '' }, ''), th({ id: 'main', label: UNIT[e.type](), unit: '' }, mainEx(e.type)), cols.map((c) => th(c, exOf(c.id), 'is-col')), el('th', { scope: 'col', class: 'is-act' }, el('span', { class: 'lo-vh' }, m('lo.fit'))))),
      el('tbody', {}, rows))),
    shown.length ? null : el('p', { class: 'lo-msgline' }, m('pick.empty')));
  pick.replaceChildren(...[el('button', { type: 'button', class: 'lo-tolist', 'data-tolist': '1' }, `‹ ${m('lo.toList')}`), head, slot.racks ? rackBar(slot) : null, list, cmp].filter(Boolean));
}

function paintPaintPick() {
  const sp = data.paints?.[draft.ship];
  if (!sp) { pick.replaceChildren(); return; }
  const rows = [['', m('paint.stock'), ...sp.base, 0], ...sp.list];
  pick.replaceChildren(el('button', { type: 'button', class: 'lo-tolist', 'data-tolist': '1' }, `‹ ${m('lo.toList')}`),
    el('div', { class: 'lo-pickhead' }, sock('paint'), el('div', {}, el('p', {}, m('cat.paint')), el('h2', {}, rows.find((r) => r[0] === (draft.paint ?? ''))?.[1] ?? m('paint.stock')), el('small', {}, m('lo.paintHint')))),
    el('ul', { class: 'lo-paints' }, rows.map(([id, name, a, b, c, pattern]) => el('li', {},
      el('button', { type: 'button', class: 'lo-paint', 'data-paint': id, 'aria-pressed': String(id === (draft.paint ?? '')) },
        el('span', { class: 'lo-paint__sw', 'aria-hidden': 'true' }, [a, b, c].map((col) => el('i', { style: `background:${col}` }))),
        el('strong', {}, name), pattern ? el('small', {}, m('paint.pattern')) : null)))));
}

function paintAll() {
  paintTop();
  paintSum();
  paintEquip();
  paintPick();
}

/* ---------------------------------------------------------- Aendern --- */

function setItem(slot, item) {
  if (item === slot.stock && !draft.racks?.[slot.key]) delete draft.slots[slot.key];
  else draft.slots[slot.key] = item;
  draft.slots = Object.fromEntries(Object.entries(draft.slots).sort(([a], [b]) => (a < b ? -1 : 1)));
}
function setRack(slot, rack) {
  const racks = { ...(draft.racks ?? {}) };
  if (rack === slot.racks[0]) delete racks[slot.key];
  else racks[slot.key] = rack;
  if (Object.keys(racks).length) draft.racks = Object.fromEntries(Object.entries(racks).sort(([a], [b]) => (a < b ? -1 : 1)));
  else delete draft.racks;
}
function changed() {
  savedId = savedId && sameLayout(store.get(savedId), draft) ? savedId : null;
  writeUrl();
  paintAll();
}
function fit(slot, k) {
  setItem(slot, k);
  prev = null;
  changed();
  toast(fill(m('msg.fitted'), { item: itemName(k) }));
}

$('lo-equip-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sel]');
  if (!b) return;
  if (sel !== b.dataset.sel) { sel = b.dataset.sel; prev = null; query = ''; sort = { key: 'main', dir: -1 }; }
  paintEquip();
  paintPick();
  // Auf dem Handy steht die Auswahl unter der Liste: dorthin rollen.
  if (matchMedia('(max-width: 900px)').matches) pick.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

pick.addEventListener('click', (e) => {
  const slot = selSlot();
  const t = e.target;
  const tl = t.closest('[data-tolist]');
  if (tl) { $('lo-equip').querySelector('.lo-slot.is-sel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const pb = t.closest('[data-paint]');
  if (pb) {
    const id = pb.dataset.paint;
    if (id) draft.paint = id; else delete draft.paint;
    changed();
    return;
  }
  if (!slot) return;
  const fb = t.closest('[data-fit]');
  if (fb) { fit(slot, fb.dataset.fit); return; }
  const rv = t.closest('[data-revert]');
  if (rv) {
    if (slot.racks) setRack(slot, slot.racks[0]);
    setItem(slot, slot.stock);
    prev = null;
    changed();
    return;
  }
  const rb = t.closest('[data-rack]');
  if (rb) {
    const was = current(slot);
    setRack(slot, rb.dataset.rack);
    const next = rackMissile(eff(slot), data.items, was) ?? rackMissile(eff(slot), data.items, slot.stock);
    if (next) setItem(slot, next);
    prev = null;
    changed();
    return;
  }
  const sb = t.closest('.lo-sort');
  if (sb) {
    const k = sb.dataset.sort;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'name' || LOWER.has(k) ? 1 : -1 };
    paintPick();
    pick.querySelector(`.lo-sort[data-sort="${CSS.escape(k)}"]`)?.focus();
    return;
  }
  if (t.closest('[data-cmpall]')) {
    cmpAll = !cmpAll;
    paintPick();
    pick.querySelector('[data-cmpall]')?.focus();
    return;
  }
  const row = t.closest('.lo-opt');
  if (row) {
    const k = row.dataset.k;
    prev = k === current(slot) || k === prev ? null : k;
    paintPick();
    // Der Vergleich steht unter der Liste: ist er nicht zu sehen, dorthin.
    const box = $('lo-cmp');
    if (prev && box && box.getBoundingClientRect().top > innerHeight - 120) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
pick.addEventListener('keydown', (e) => {
  const row = e.target.closest?.('.lo-opt');
  if (!row || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  const slot = selSlot();
  if (slot && row.dataset.k !== current(slot)) fit(slot, row.dataset.k);
});
pick.addEventListener('input', (e) => {
  if (e.target.id !== 'lo-q') return;
  query = e.target.value;
  const at = e.target.selectionStart;
  paintPick();
  const q = $('lo-q');
  q.focus();
  q.setSelectionRange(at, at);
});

/* ---------------------------------------------------------- Kopf-Aktionen --- */

shipSel.addEventListener('change', () => {
  const to = shipSel.value;
  if (changeCount(draft) && !savedId && !confirm(m('lo.leave'))) { shipSel.value = draft.ship; return; }
  adopt(to, null);
});
nameIn.addEventListener('input', () => {
  draft.name = nameIn.value.replace(/\s+/g, ' ').slice(0, 60);
  savedId = savedId && sameLayout(store.get(savedId), draft) ? savedId : null;
  writeUrl(true);
  paintTop();
});
nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });

function save() {
  const entry = store.save({ id: savedId && store.get(savedId) ? savedId : newId(), ship: draft.ship, name: draft.name || placeholder(), slots: draft.slots, racks: draft.racks, paint: draft.paint });
  if (!entry) { toast(m('msg.full')); return; }
  savedId = entry.id;
  if (!draft.name) { draft.name = entry.name; writeUrl(); }
  paintTop();
  paintSaved();
  toast(m('msg.saved'));
}
$('lo-save').addEventListener('click', save);

const linkFor = (lo) => `${location.origin}${location.pathname}${query4(lo)}`;
async function share(lo) {
  const url = linkFor(lo);
  try {
    await navigator.clipboard.writeText(url);
    toast(m('msg.copied'));
  } catch {
    const f = $('lo-copyfield');
    f.value = url;
    f.hidden = false;
    f.focus();
    f.select();
    toast(m('msg.copyFallback'));
  }
}
$('lo-share').addEventListener('click', () => share(draft));
$('lo-reset').addEventListener('click', () => {
  draft.slots = {};
  delete draft.racks;
  delete draft.paint;
  prev = null;
  changed();
  toast(m('msg.reset'));
});

/* ---------------------------------------------------------- Meine Layouts --- */

const dlg = $('lo-saved');
function paintSaved() {
  const all = store.list();
  $('lo-count').textContent = nf.format(all.length);
  if (!dlg.open) return;
  if (acct.signedIn()) $('lo-where').replaceChildren(m('saved.account'));
  else $('lo-where').replaceChildren(`${m('saved.guest')} `, el('a', { href: window.VBAccount?.loginHref() ?? `${de ? '/de' : ''}/account/login.html` }, m('saved.login')));
  if (!all.length) { $('lo-list').replaceChildren(el('li', { class: 'lo-empty' }, m('saved.empty'))); return; }
  const here = all.filter((e) => e.ship === draft.ship);
  const rest = all.filter((e) => e.ship !== draft.ship);
  $('lo-list').replaceChildren(...[...here, ...rest].map((e) => {
    const n = changeCount(e);
    return el('li', { class: `lo-saved${e.ship === draft.ship ? ' is-here' : ''}${e.id === savedId ? ' is-current' : ''}` },
      el('div', {}, el('h4', {}, e.name || fill(m('name.placeholder'), { ship: shipName(e.ship) }), e.ship === draft.ship ? el('span', { class: 'lo-tag' }, m('saved.here')) : null),
        el('p', {}, el('b', {}, shipName(e.ship)), ` · ${n ? plural('state.changed', n) : m('saved.stock')}`)),
      el('span', { class: 'lo-saved__acts' },
        el('button', { type: 'button', class: 'lo-btn is-main', 'data-open': e.id }, m('saved.open')),
        el('button', { type: 'button', class: 'lo-btn', 'data-share': e.id }, m('saved.share')),
        el('button', { type: 'button', class: 'lo-btn', 'data-del': e.id, 'aria-label': fill(m('saved.deleteLabel'), { name: e.name }), title: m('saved.delete') }, '×')));
  }));
}
$('lo-savedbtn').addEventListener('click', () => { dlg.showModal(); paintSaved(); });
$('lo-saved-x').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) { dlg.close(); return; }
  const b = e.target.closest('button[data-open], button[data-share], button[data-del]');
  if (!b) return;
  const entry = store.get(b.dataset.open || b.dataset.share || b.dataset.del);
  if (!entry) { paintSaved(); return; }
  if (b.dataset.open) {
    if (changeCount(draft) && !savedId && entry.ship !== draft.ship && !confirm(m('lo.leave'))) return;
    dlg.close();
    adopt(entry.ship, encodeLayout(entry));
    savedId = entry.id;
    paintTop();
  } else if (b.dataset.share) share(entry);
  else {
    const gone = store.remove(entry.id);
    if (!gone) return;
    if (savedId === gone.id) savedId = null;
    paintSaved();
    paintTop();
    toast(fill(m('msg.deleted'), { name: gone.name }), () => { store.restore(gone); paintSaved(); paintTop(); });
  }
});
// Ein zweiter Tab (oder der Hangar) speichert mit; An- und Abmelden wechselt die Ablage.
function repaintSaved() {
  if (!data) return;
  paintSaved();
  paintTop();
}
window.addEventListener('storage', (e) => {
  if (e.key === store.key()) repaintSaved();
  else if (e.key && /^sb-.*-auth-token$/.test(e.key)) { repaintSaved(); acct.sync(); }
});
if (window.VBAccount) acct.sync();
else window.addEventListener('vb-account-ready', () => acct.sync(), { once: true });
doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') acct.sync(); });

/* ---------------------------------------------------------- Hinweis --- */

let toastTimer = 0;
let undo = null;
function toast(text, onUndo = null) {
  const t = $('lo-toast');
  // Im offenen Dialog steht der Hinweis dort, sonst verdeckt ihn der Rand.
  (dlg.open ? dlg : root).append(t);
  $('lo-toast-txt').textContent = text;
  undo = onUndo;
  $('lo-undo').hidden = !onUndo;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('is-on'); undo = null; }, onUndo ? 6000 : 2600);
}
$('lo-undo').addEventListener('click', () => {
  const f = undo;
  undo = null;
  $('lo-toast').classList.remove('is-on');
  f?.();
});

/* ---------------------------------------------------------- Start --- */

/* ---------------------------------------------------------- Verbindungen --- */

// Was angeklickt ist, haengt sichtbar an dem, was es geoeffnet hat: gewaehlter Platz
// -> Panel rechts, angeklicktes Teil -> Vergleich. Eine Lasche (Rahmen ums Angeklickte
// plus Steg ueber die Luecke) liegt als eigene Ebene darueber und gleitet beim Wechsel
// weich zum neuen Ziel; der Panelrahmen bekommt an der Stelle eine Kerbe (--nt/--nh).
const linkLayer = el('div', { class: 'lo-links', 'aria-hidden': 'true' });
const tabs = { 'is-a': el('span', { class: 'lo-tab is-a' }), 'is-b': el('span', { class: 'lo-tab is-b' }) };
linkLayer.append(tabs['is-a'], tabs['is-b']);
root.append(linkLayer);
const wide = matchMedia('(min-width:1100px) and (min-height:600px)');
let linkQueued = false;
let linkSnap = false;  // Scrollen/Groesse: Lasche folgt sofort, ohne Gleiten
// Einzug je Lasche (1 = voll da, 0 = ganz im Panel). Er folgt dem Scrollziel ueber eine
// leicht unterdaempfte Feder: auch ein grosser Mausrad-Schritt laeuft fluessig ab, und
// beim Herausfahren federt die Kante einen Hauch nach.
const pull = { 'is-a': { k: 0, v: 0, t: 0, src: null, yc: 0, bump: null }, 'is-b': { k: 0, v: 0, t: 0, src: null, yc: 0, bump: null } };
const SPRING_W = 11;    // 1/s, Eigenfrequenz (~0,55 s je Schwingung)
const SPRING_Z = 0.7;   // Daempfung < 1: leichtes Ueberschwingen (~5 %)
const calm = matchMedia('(prefers-reduced-motion:reduce)');
// Gegenreaktion des grossen Rahmens: dockt die Kante ein, gibt seine linke Kante genau
// an der Andockstelle kurz nach innen nach (eine weiche Delle, oben und unten auslaufend)
// und federt zurueck; der Rest des Rahmens bleibt still. Die Delle ist ein eigener
// Strich ueber der Kerbe, waehrend die Kerbe die echte Kante an der Stelle ausblendet.
const NS = 'http://www.w3.org/2000/svg';
const dentSvg = document.createElementNS(NS, 'svg');
dentSvg.setAttribute('class', 'lo-dent');
const dents = { 'is-a': document.createElementNS(NS, 'path'), 'is-b': document.createElementNS(NS, 'path') };
dentSvg.append(dents['is-a'], dents['is-b']);
linkLayer.append(dentSvg);
const DENT_MS = 620;   // Dauer der Delle
const DENT_PX = 10;    // Amplitude; sichtbarer Ausschlag nach innen ~6 px
const DENT_H = 130;    // Laenge des nachgebenden Kantenstuecks
// Der Panelrahmen (::before) liegt im eigenen Rand des Panels: der Vergleich hat 1 px Rand,
// ohne Abzug saesse seine Kante 1 px neben dem Bogen der Lasche (Stufe an der Naht).
function frameRect(panel) {
  const r = panel.getBoundingClientRect();
  const x = panel.clientLeft, y = panel.clientTop;
  return { left: r.left + x, top: r.top + y, right: r.right - x, bottom: r.bottom - y, height: r.height - 2 * y };
}
function paintDent(cls, panel, o, now) {
  const st = pull[cls];
  const path = dents[cls];
  const t = st.bump ? now - st.bump.t0 : Infinity;
  if (t >= DENT_MS) { st.bump = null; path.removeAttribute('d'); panel.style.removeProperty('--nw'); return false; }
  const p = frameRect(panel);
  const fw = parseFloat(getComputedStyle(root).getPropertyValue('--lo-fw')) || 4;
  const corner = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0;
  const h = Math.min(DENT_H, p.height - 2 * corner);
  const yc = Math.min(p.bottom - corner - h / 2, Math.max(p.top + corner + h / 2, st.bump.yc));
  // Gedaempfte Schwingung: erst nach innen, dann ein Hauch nach aussen, dann Ruhe.
  const d = DENT_PX * Math.exp(-t / 170) * Math.sin(Math.PI * Math.min(1, t / 90) / 2 + Math.max(0, t - 90) / 115);
  const x = p.left - o.left + fw / 2;
  const y0 = yc - h / 2 - o.top;
  const y1 = yc + h / 2 - o.top;
  const ym = yc - o.top;
  path.setAttribute('d', `M${x} ${y0}C${x} ${y0 + h * 0.3} ${x + d} ${ym - h * 0.18} ${x + d} ${ym}C${x + d} ${ym + h * 0.18} ${x} ${y1 - h * 0.3} ${x} ${y1}`);
  panel.classList.add('is-snap');
  panel.style.setProperty('--nt', `${yc - h / 2 - p.top}px`);
  panel.style.setProperty('--nh', `${h}px`);
  // Nur den Rahmenstrich ausblenden, nicht den Lichtsaum innen: sonst stuende neben der
  // Delle ein dunkler Streifen.
  panel.style.setProperty('--nw', `${fw}px`);
  return true;
}
function paintLinks(now = performance.now()) {
  linkQueued = false;
  let again = false;
  const o = root.getBoundingClientRect();
  const pairs = [
    ['is-a', $('lo-equip-list').querySelector('.lo-slot.is-sel'), $('lo-equip'), pick],
    ['is-b', pick.querySelector('.lo-opt.is-prev'), pick.querySelector('.lo-optscroll'), $('lo-cmp')],
  ];
  for (const p of [pick, ...pick.querySelectorAll('.lo-cmpbox')]) if (!pairs.some((x) => x[3] === p && x[1])) p.classList.remove('is-linked');
  for (const [cls, src, box, panel] of pairs) {
    const tab = tabs[cls];
    const st = pull[cls];
    const shown = tab.classList.contains('is-on');
    // Ohne Ziel sofort weg: ausgeblendet stuende sie kurz als Geisterrahmen ueber neuem Inhalt.
    if (!wide.matches || !src || !box || !panel || !panel.childElementCount) { tab.classList.add('is-solid'); tab.classList.remove('is-on'); st.k = 0; st.v = 0; st.src = null; st.bump = null; dents[cls].removeAttribute('d'); continue; }
    const r = src.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const p = frameRect(panel);
    // Angeheftete Kategorie-Baender und Tabellenkoepfe verdecken den oberen Rand der Liste: jedes Band,
    // das oben klebt, verdeckt bis zu seiner Unterkante (Spielraum fuer Zoom-Rundung).
    const pinned = Math.max(b.top, ...[...box.querySelectorAll('.lo-big__h, thead th')].map((h) => h.getBoundingClientRect()).filter((h) => h.top <= b.top + 4).map((h) => h.bottom));
    const visT = Math.max(pinned, p.top);
    const visB = Math.min(b.bottom, p.bottom);
    let top = Math.max(r.top, visT);
    let bot = Math.min(r.bottom, visB);
    panel.classList.add('is-linked');
    // Rausgescrollt: die senkrechte Kante gleitet gerade nach rechts, bis sie auf der
    // Panelkante liegt; dann schliesst sich der Panelrahmen. Ziel ist der Anteil, der
    // von der zweiten Haelfte des Platzes noch zu sehen ist.
    const seen = r.height ? Math.max(0, bot - top) / r.height : 0;
    const goal = Math.min(1, Math.max(0, (seen - 0.5) / 0.5));
    const rest = st.v === 0;
    let dt = Math.min(rest ? 17 : 64, Math.max(0, now - st.t)) / 1000;
    st.t = now;
    // Neu gewaehlt, waehrend eine Lasche steht: sie gleitet hinueber (Ziel sofort). Neu gewaehlt
    // ohne Lasche: sie waechst aus dem Panelrahmen heraus wie beim Wieder-Hereinscrollen,
    // gespiegelt zum Einziehen. Derselbe Platz kommt wieder herein: ebenso herausfedern.
    const fresh = src !== st.src;
    if (fresh || calm.matches) { st.k = fresh && !shown && !calm.matches ? 0 : goal; st.v = 0; st.src = src; }
    for (; dt > 0; dt -= 0.008) {
      const h = Math.min(dt, 0.008);
      st.v += (-SPRING_W * SPRING_W * (st.k - goal) - 2 * SPRING_Z * SPRING_W * st.v) * h;
      st.k += st.v * h;
    }
    if (Math.abs(goal - st.k) < 0.003 && Math.abs(st.v) < 0.02) { st.k = goal; st.v = 0; } else again = true;
    const k = Math.min(1.1, st.k);
    const snap = linkSnap || st.k !== goal || (shown && goal < 1);
    // Ohne Lasche folgt die Kerbe sofort: ein Gleiten liesse sie kurz als Luecke offen.
    panel.classList.toggle('is-snap', !!snap || k < 0.01 || !shown);
    if (k < 0.01) {
      if (shown && !calm.matches) st.bump = { t0: now, yc: st.yc };
      tab.classList.toggle('is-solid', shown);  // sofort weg, die Delle uebernimmt die Kante
      tab.classList.remove('is-on');
      if (paintDent(cls, panel, o, now)) again = true; else panel.style.setProperty('--nh', '0px');
      continue;
    }
    if (st.bump) { st.bump = null; dents[cls].removeAttribute('d'); }
    panel.style.removeProperty('--nw');
    // Erscheint die Lasche, steht sie sofort voll da: ein Einblenden liesse die schon
    // offene Kerbe kurz als Luecke im Rahmen sehen.
    tab.classList.toggle('is-solid', !shown);
    // Noch nachlaufend, aber schon ganz draussen: am Listenrand als kurze Lasche weiter
    // einziehen; nie flacher als 16 px, sonst wirkt sie wie ein Strich.
    const hMin = 16 + 28 * k;
    if (bot - top < hMin) {
      if (r.top < visT) { top = visT; bot = visT + hMin; } else { bot = visB; top = visB - hMin; }
    }
    const h = bot - top;
    // Tiefe der Ausbuchtung; Ecken und Viertelboegen werden nur flacher (elliptisch),
    // nie eckig: senkrecht bleiben sie rund, waagrecht passen sie in die Tiefe.
    const cs = getComputedStyle(root);
    const fr = parseFloat(cs.getPropertyValue('--lo-fr')) || 14;
    const depth = (p.left - Math.max(r.left, b.left)) * k;
    const fx = Math.min(fr, depth / 3);
    const rx = Math.min(22, depth - fx);
    const ry = Math.min(22, h / 2);
    const corner = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0;
    const filT = top - fr >= p.top + corner;
    const filB = bot + fr <= p.bottom - corner;
    // Kerbe je 1,5 px kuerzer als der Bogen: Panelkante und Bogen ueberlappen, so dass
    // bei Bruchteil-Pixeln (Windows-Skalierung) kein Spalt aufgeht.
    panel.style.setProperty('--nt', `${top - p.top - (filT ? fr : 0) + 1.5}px`);
    panel.style.setProperty('--nh', `${Math.max(0, h + (filT ? fr : 0) + (filB ? fr : 0) - 3)}px`);
    // Erstes Erscheinen springt (nur Einblenden), danach gleitet die Lasche.
    tab.classList.toggle('is-jump', !!snap || !shown);
    tab.classList.toggle('is-nofil-t', !filT);
    tab.classList.toggle('is-nofil-b', !filB);
    tab.style.setProperty('--lo-fx', `${fx}px`);
    tab.style.setProperty('--lo-rx', `${rx}px`);
    tab.style.setProperty('--lo-ry', `${ry}px`);
    // left/top statt transform: so gleitet die Lasche im selben Takt wie die Kerbe im
    // Panelrahmen; ein Compositor-transform eilte ihr vor, wenn das Panel neu aufbaut.
    tab.style.left = `${p.left - depth - o.left}px`;
    tab.style.top = `${top - o.top}px`;
    tab.style.width = `${depth - fx}px`;
    tab.style.height = `${h}px`;
    st.yc = top + h / 2;
    tab.classList.add('is-on');
  }
  linkSnap = false;
  if (again) queueLinks();
}
function queueLinks(e) {
  if (e?.type === 'scroll' || e?.type === 'resize') linkSnap = true;
  if (linkQueued) return;
  linkQueued = true;
  requestAnimationFrame(paintLinks);
}
const linkWatch = new MutationObserver(() => queueLinks());
linkWatch.observe(pick, { childList: true });
linkWatch.observe($('lo-equip-list'), { childList: true });
root.addEventListener('scroll', queueLinks, true);
addEventListener('resize', queueLinks);

async function boot() {
  $('lo-failed').hidden = true;
  $('lo-loading').hidden = false;
  try {
    const r = await fetch(root.dataset.src, { credentials: 'same-origin' });
    if (!r.ok || r.redirected) throw new Error(`Loadout: HTTP ${r.status}`);
    const d = await r.json();
    if (d?.v !== 1 || !d.items || !d.ships) throw new Error('Loadout: fremde Datei');
    data = d;
  } catch {
    $('lo-loading').hidden = true;
    $('lo-failed').hidden = false;
    return;
  }
  $('lo-loading').hidden = true;
  // Nur Schiffe mit Daten in der Auswahl.
  for (const o of [...shipSel.options]) if (!data.ships[o.value]) o.remove();
  const p = new URLSearchParams(location.search);
  const want = p.get('ship');
  const ship = want && data.ships[want] ? want : data.ships[root.dataset.ship] ? root.dataset.ship : shipSel.options[0]?.value;
  root.dataset.ready = '1';
  adopt(ship, p.get('layout'));
}
$('lo-retry').addEventListener('click', boot);
boot();
