// Layout-Werkstatt im Hangar (/hangar.html, /de/hangar.html): Waffen und
// Bauteile eines Schiffs tauschen, das Layout im Browser speichern und als
// Link teilen. Der Controller der Seite (assets/hangar-overview.js) laedt
// dieses Modul erst, wenn jemand die Werkstatt oeffnet oder ein Link mit
// ?layout= kommt, und ruft initWorkshop(doc, bridge).
//
// Der Controller besitzt Zustand und Adresse. Das Layout in Arbeit steht dort
// als lo (URL-Form ?layout=<code>): offen ist die Werkstatt genau dann, wenn
// lo gesetzt ist, und jede Aenderung schreibt den Code neu. Neuladen,
// Zurueck und "Link kopieren" der Seite tragen das Layout so ohne eigenes
// Zutun mit. Der Slot in der Auswahl folgt hp, dem Hardpoint des Controllers:
// sein Marker hebt sich hervor, und ein Klick auf einen Marker oeffnet den Slot.
//
// Daten: /hangar-layouts.json (src/lib/hangar/layouts.ts). Woerter: #hgl-msg
// (src/components/hangar/LayoutWorkshop.astro), keines steht hier.
//
// Gespeichert wird in localStorage unter 'vb.layouts.v1'. Ein Layout ist
// { id, ship, name, slots: { <slot>: <bauteil> }, racks?: { <slot>: <halter> },
// paint?, created, updated }; slots nennt nur Abweichungen von der Serie,
// racks die getauschten Raketenhalterungen (dann steht die Rakete des Slots
// immer ausdruecklich in slots), paint die Lackierung, wenn es nicht der
// Serienlack ist. Dasselbe Format traegt spaeter den
// Kennwert-Ueberblick, den Vergleich zweier Layouts und einen Abgleich mit
// dem Konto. Beim Import passiert nichts; die Tests rufen die reinen Funktionen.

export const LAYOUT_VERSION = 1;
export const STORE_KEY = 'vb.layouts.v1';
export const MAX_SAVED = 200;
export const MAX_NAME = 60;
const SHIP_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SLOT_RE = /^[a-z0-9][a-z0-9_.-]{0,99}$/;
const ITEM_RE = /^[a-z0-9][a-z0-9~._-]{0,119}$/;
const PAINT_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const CODE_RE = /^[A-Za-z0-9_-]{1,4000}$/;

/* ---------------------------------------------------------- Link-Code --- */

/** UTF-8-Text nach base64url ohne Fuellzeichen. */
export function toB64url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Umkehrung von toB64url; null bei kaputtem Code. */
export function fromB64url(code) {
  try {
    const bin = atob(String(code).replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

const cleanName = (name) => (typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '');
/** Kennung einer Lackierung oder null (Serienlack). */
const cleanPaint = (p) => (typeof p === 'string' && PAINT_RE.test(p) ? p : null);

/** Nur wohlgeformte Schluessel, sortiert: gleiche Layouts ergeben gleiche Codes. */
function cleanSlotMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of Object.keys(raw).sort()) {
    const v = raw[k];
    if (SLOT_RE.test(k) && typeof v === 'string' && ITEM_RE.test(v)) out[k] = v;
  }
  return out;
}

/**
 * Layout nach Link-Code: base64url von [1, name, slots] und, wenn nicht
 * Serienlack, der Lackierung als viertem Feld; getauschte Raketenhalterungen
 * als fuenftes (die Lackierung steht dann als '' davor, wenn es der
 * Serienlack ist). Aeltere Seiten lesen die hinteren Felder nicht und zeigen
 * den Rest. Das Schiff steht daneben in ?ship=, damit ein leeres Layout auf
 * jedes Schiff passt.
 *   encodeLayout({ name: '', slots: {} }) === 'WzEsIiIse31d'
 * @param {{ name?: string, slots?: Record<string, string>, racks?: Record<string, string>, paint?: string|null }} lo @returns {string}
 */
export function encodeLayout(lo) {
  const v = [LAYOUT_VERSION, cleanName(lo.name), cleanSlotMap(lo.slots)];
  const paint = cleanPaint(lo.paint);
  const racks = cleanSlotMap(lo.racks);
  const hasRacks = Object.keys(racks).length > 0;
  if (paint || hasRacks) v.push(paint ?? '');
  if (hasRacks) v.push(racks);
  return toB64url(JSON.stringify(v));
}

/** Das leere Layout: Serie, ohne Namen. Oeffnet die Werkstatt fuer jedes Schiff. */
export const EMPTY_CODE = encodeLayout({ name: '', slots: {} });

/**
 * Link-Code nach Layout; null, wenn der Code nicht von encodeLayout stammen kann.
 * @param {string} code @returns {{ name: string, slots: Record<string, string>, racks?: Record<string, string>, paint?: string }|null}
 */
export function decodeLayout(code) {
  if (typeof code !== 'string' || !CODE_RE.test(code)) return null;
  const text = fromB64url(code);
  if (text == null) return null;
  let v;
  try { v = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(v) || v[0] !== LAYOUT_VERSION || typeof v[1] !== 'string') return null;
  const paint = cleanPaint(v[3]);
  const racks = cleanSlotMap(v[4]);
  return { name: cleanName(v[1]), slots: cleanSlotMap(v[2]), ...(Object.keys(racks).length ? { racks } : {}), ...(paint ? { paint } : {}) };
}

/* ---------------------------------------------------------- Datenmodell --- */

/**
 * Die Slots eines Schiffs aus /hangar-layouts.json als Objekte. racks: die
 * Halterungen, die das Spiel an diesem Raketenport erlaubt, Serie zuerst;
 * null, wenn es keine Wahl gibt.
 * @param {ReadonlyArray<readonly [string, string, number, string|0, string, number, string[]?]>} rows
 */
export function shipSlots(rows) {
  return (rows ?? []).map(([key, type, size, stock, group, count, racks]) =>
    ({ key, type, size, stock: stock || null, group, count, racks: Array.isArray(racks) && racks.length > 1 ? racks : null }));
}

/** Passt das Bauteil in den Slot? Dieselbe Art, dieselbe Groesse (bei Raketen: derselbe Untertyp). */
export function fits(item, slot) {
  return !!item && item[2] === slot.type && item[3] === slot.size;
}

/**
 * Der Slot, wie die gewaehlte Halterung ihn formt: Art, Groesse und Anzahl
 * der Raketen kommen von ihr. Ohne Wahl, mit der Serienhalterung oder einer
 * Halterung, die hier nicht passt, der Slot selbst.
 * racks: { <halter>: [nameEn, nameDe|0, groesse, plaetze, raketengroesse, art, hersteller|0, preis|0] }
 */
export function rackSlot(slot, rack, racks) {
  const r = rack && rack !== slot.racks?.[0] && slot.racks?.includes(rack) ? racks?.[rack] : null;
  return r ? { ...slot, type: r[5], size: r[4], count: r[3] } : slot;
}

/**
 * Die Rakete fuer eine neu gewaehlte Halterung: die bisherige, wenn sie
 * passt, sonst die staerkste mit demselben Verfolgungssignal, sonst die
 * staerkste ueberhaupt; null, wenn keine passt.
 */
export function rackMissile(slot, items, prefer) {
  const keys = candidates(slot, items);
  if (prefer && keys.includes(prefer)) return prefer;
  const trk = items[prefer]?.[8]?.trk;
  return keys.find((k) => trk && items[k][8]?.trk === trk) ?? keys[0] ?? null;
}

/**
 * Bringt Abweichungen in die gueltige Form fuer dieses Schiff: unbekannte
 * Slots, unpassende Halterungen und unpassende Bauteile fallen weg (und
 * zaehlen als dropped), ein Eintrag gleich der Serie faellt still weg. Mit
 * getauschter Halterung steht die Rakete immer ausdruecklich da; fehlt sie
 * oder passt sie nicht, waehlt rackMissile eine (zaehlt als dropped, wenn
 * eine da war).
 * @returns {{ slots: Record<string, string>, racks: Record<string, string>, dropped: number }}
 */
export function cleanSlots(raw, slots, items, rawRacks = null, racks = null) {
  const byKey = new Map(slots.map((s) => [s.key, s]));
  const outR = {};
  let dropped = 0;
  for (const [k, v] of Object.entries(rawRacks ?? {})) {
    const slot = byKey.get(k);
    if (!slot?.racks?.includes(v) || !racks?.[v]) { dropped++; continue; }
    if (v !== slot.racks[0]) outR[k] = v;
  }
  const out = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const slot = byKey.get(k);
    if (!slot || !fits(items[v], rackSlot(slot, outR[k], racks))) { dropped++; continue; }
    if (v !== slot.stock || outR[k]) out[k] = v;
  }
  for (const k of Object.keys(outR)) {
    if (out[k]) continue;
    const slot = byKey.get(k);
    const m = rackMissile(rackSlot(slot, outR[k], racks), items, slot.stock);
    if (m) out[k] = m;
    else { delete outR[k]; dropped++; }
  }
  return { slots: cleanSlotMap(out), racks: cleanSlotMap(outR), dropped };
}

/**
 * Alle Bauteile, die in den Slot passen, staerkster Kennwert zuerst, bei
 * Gleichstand nach Namen.
 * @returns {string[]}
 */
export function candidates(slot, items) {
  return Object.keys(items)
    .filter((k) => fits(items[k], slot))
    .sort((a, b) => items[b][7] - items[a][7] || items[a][0].localeCompare(items[b][0], 'en'));
}

/**
 * Abstand eines Kennwerts zum eingebauten Teil in ganzen Prozent; null ohne
 * Bezug. deltaPct(110, 100) === 10, deltaPct(5, 0) === null.
 */
export function deltaPct(value, base) {
  if (!Number.isFinite(value) || !Number.isFinite(base) || base <= 0) return null;
  return Math.round(((value - base) / base) * 100);
}

/** Gruppen, deren Summe etwas sagt: Feuerkraft, Raketenschaden, Leistung, Kuehlung, Schild. */
export const SUMMED = new Set(['pilot', 'manned', 'remote', 'missile', 'bomb', 'power', 'cooler', 'shield']);
/** Arten im Reiter Waffen: Bordwaffen und alles, was eine Halterung abfeuert. */
export const WEAPON_TYPES = new Set(['gun', 'missile', 'torpedo', 'gmissile', 'bomb']);

/**
 * Summe des Kennwerts je Gruppe, jetzt und in Serie (Kennwert mal Stueckzahl;
 * jetzt mit der Anzahl der gewaehlten Halterung). Slots ohne bekanntes Teil
 * zaehlen 0.
 * @returns {Map<string, { now: number, stock: number }>}
 */
export function groupTotals(slots, layout, items, rackSel = null, racks = null) {
  const out = new Map();
  for (const s of slots) {
    if (!SUMMED.has(s.group)) continue;
    const t = out.get(s.group) ?? { now: 0, stock: 0 };
    const now = layout[s.key] ?? s.stock;
    t.now += (items[now]?.[7] ?? 0) * rackSlot(s, rackSel?.[s.key], racks).count;
    t.stock += (items[s.stock]?.[7] ?? 0) * s.count;
    out.set(s.group, t);
  }
  return out;
}

/** Gleicher Inhalt: Schiff, Name, Abweichungen, Halterungen und Lackierung. */
export function sameLayout(a, b) {
  return !!a && !!b && a.ship === b.ship && cleanName(a.name) === cleanName(b.name)
    && JSON.stringify(cleanSlotMap(a.slots)) === JSON.stringify(cleanSlotMap(b.slots))
    && JSON.stringify(cleanSlotMap(a.racks)) === JSON.stringify(cleanSlotMap(b.racks))
    && cleanPaint(a.paint) === cleanPaint(b.paint);
}

/** Wie viele Slots vom Serienstand abweichen; eine Halterung samt Rakete zaehlt einmal, die Lackierung als eigener Slot. */
export function changeCount(lo) {
  return new Set([...Object.keys(lo.slots ?? {}), ...Object.keys(lo.racks ?? {})]).size + (lo.paint ? 1 : 0);
}

/* ---------------------------------------------------------- Ablage --- */

function cleanEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !/^[a-z0-9]{4,32}$/.test(e.id) || !SHIP_RE.test(e.ship)) return null;
  const created = Number.isFinite(e.created) ? e.created : 0;
  const paint = cleanPaint(e.paint);
  const racks = cleanSlotMap(e.racks);
  return { id: e.id, ship: e.ship, name: cleanName(e.name), slots: cleanSlotMap(e.slots), ...(Object.keys(racks).length ? { racks } : {}), ...(paint ? { paint } : {}), created, updated: Number.isFinite(e.updated) ? e.updated : created };
}

/**
 * Gespeicherte Layouts in einem Speicher mit getItem/setItem (localStorage).
 * Jede Leseoperation liest neu: ein zweiter Tab schreibt mit. Ein Speicher,
 * der wirft (privates Fenster, voll), liefert eine leere Liste, und save()
 * meldet false.
 * @param {Pick<Storage, 'getItem'|'setItem'>|null} storage @param {() => number} [now]
 */
export function createStore(storage, now = Date.now) {
  const read = () => {
    let raw = null;
    try { raw = storage?.getItem(STORE_KEY) ?? null; } catch { return []; }
    let v;
    try { v = raw ? JSON.parse(raw) : null; } catch { return []; }
    const list = Array.isArray(v?.layouts) ? v.layouts.map(cleanEntry).filter(Boolean) : [];
    return list;
  };
  const write = (list) => {
    try {
      storage.setItem(STORE_KEY, JSON.stringify({ v: LAYOUT_VERSION, layouts: list.slice(0, MAX_SAVED) }));
      return true;
    } catch {
      return false;
    }
  };
  return {
    /** Neueste zuerst. */
    list: () => read().sort((a, b) => b.updated - a.updated),
    get: (id) => read().find((e) => e.id === id) ?? null,
    /** Legt an oder ersetzt (gleiche id); liefert den Eintrag oder null. */
    save(entry) {
      const list = read();
      const at = list.findIndex((e) => e.id === entry.id);
      const t = now();
      const e = cleanEntry({ ...entry, created: at >= 0 ? list[at].created : t, updated: t });
      if (!e) return null;
      if (at >= 0) list.splice(at, 1);
      list.unshift(e);
      return write(list) ? e : null;
    },
    remove(id) {
      const list = read();
      const at = list.findIndex((e) => e.id === id);
      if (at < 0) return null;
      const [gone] = list.splice(at, 1);
      return write(list) ? gone : null;
    },
    /** Ein geloeschtes Layout zurueck, mit seinen alten Zeitstempeln. */
    restore(entry) {
      const list = read().filter((e) => e.id !== entry.id);
      const e = cleanEntry(entry);
      if (!e) return false;
      list.push(e);
      list.sort((a, b) => b.updated - a.updated);
      return write(list);
    },
  };
}

export const newId = (rnd = Math.random) => Array.from({ length: 10 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(rnd() * 36)]).join('');

/* ---------------------------------------------------------- Werkstatt --- */

/**
 * Verdrahtet die Werkstatt. bridge kommt vom Controller:
 *   state()        der Zustand der Seite (ship, tab, hp, lo, …)
 *   set(patch)     aendert ihn (und damit die Adresse)
 *   shipName(id)   Name des Schiffs von seiner Dock-Karte
 *   say(text)      hoefliche Live-Region der Seite
 * Liefert render(state); der Controller ruft es nach jeder Aenderung von
 * ship, hp, lo oder pane. lo null ist Serie ohne Namen (EMPTY_CODE).
 * @param {Document} doc
 */
export function initWorkshop(doc, bridge) {
  const $ = (id) => doc.getElementById(id);
  const aside = $('hgl');
  const main = doc.getElementById('main');
  const loc = main.dataset.loc;
  const de = aside.dataset.lang === 'de';
  const nf = new Intl.NumberFormat(loc);
  const pr = new Intl.PluralRules(loc);
  const m = (k) => doc.querySelector(`#hgl-msg [data-m="${k}"]`)?.textContent ?? k;
  const fill = (tpl, vals) => tpl.replace(/\{(\w+)\}/g, (x, k) => (k in vals ? String(vals[k]) : x));
  const plural = (base, n) => fill(m(`${base}.${pr.select(n) === 'one' ? 'one' : 'other'}`), { n: nf.format(n) });
  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  const store = createStore(storage);

  const nameIn = $('hgl-name');
  const slotsHost = $('hgl-slots');
  const list = $('hgl-list');
  const toast = $('hgl-toast');
  const undoBtn = $('hgl-undo');
  const copyField = $('hgl-copyfield');

  /** @type {{ items: Record<string, any[]>, ships: Record<string, any[]>, racks?: Record<string, any[]>, models?: Record<string, string> }|null} */
  let data = null;
  let loading = null;
  // Das Layout in Arbeit, sein Code (wie in der Adresse) und die Slots seines Schiffs.
  let draft = { ship: '', name: '', slots: {} };
  let code = null;
  let slots = [];
  let savedId = null;
  let pendingSaved = null;
  let openKey = null;
  let firstAdopt = true;
  let view = 'build';

  const itemName = (k) => {
    const it = data.items[k];
    return it ? (de && it[1]) || it[0] : m('slot.unknown');
  };
  const portOf = (key) => `hardpoint_${key.split('.')[0]}`;
  const tabOf = (slot) => (WEAPON_TYPES.has(slot.type) ? 'weapons' : 'systems');
  const dmg = () => m('unit.damage');
  const UNIT = { gun: () => 'DPS', missile: dmg, torpedo: dmg, gmissile: dmg, bomb: dmg, power: () => m('unit.power'), cooler: () => m('unit.cooling'), shield: () => 'HP', quantum: () => 'Mm/s', radar: () => m('unit.sensitivity') };
  const CLS = { Military: 'cls.military', Civilian: 'cls.civilian', Industrial: 'cls.industrial', Stealth: 'cls.stealth', Competition: 'cls.competition' };
  function subLine(k, withPrice) {
    const it = data.items[k];
    if (!it) return '';
    // Waffen: Hersteller und Schadensart; Raketen: Hersteller und Verfolgungssignal.
    const parts = it[2] === 'gun'
      ? [it[4] || null, it[8]?.dt ? m(`dt.${it[8].dt}`) : null]
      : WEAPON_TYPES.has(it[2])
        ? [it[4] || null, it[8]?.trk ? m(`trk.${it[8].trk}`) : null]
        : [it[5] ? (CLS[it[5]] ? m(CLS[it[5]]) : it[5]) : null, it[6] ? fill(m('grade'), { g: it[6] }) : null];
    if (withPrice) parts.push(it[9] ? fill(m('pick.price'), { n: nf.format(it[9]) }) : m('pick.noshop'));
    return parts.filter(Boolean).join(' · ');
  }
  const current = (slot) => draft.slots[slot.key] ?? slot.stock;
  // Der Slot mit der gewaehlten Halterung (Anzahl und Groesse der Raketen).
  const eff = (slot) => rackSlot(slot, draft.racks?.[slot.key], data.racks);
  const isChanged = (slot) => slot.key in draft.slots || !!draft.racks?.[slot.key];
  // Die Lackierung zaehlt wie im Spiel als eigener Slot.
  const changedCount = () => changeCount(draft);
  const rackName = (k) => {
    const r = data.racks?.[k];
    return r ? (de && r[1]) || r[0] : m('slot.unknown');
  };
  const placeholder = () => fill(m('name.placeholder'), { ship: bridge.shipName(draft.ship) });

  /** Element mit Attributen; Kinder als Knoten oder Text, nie als Markup. */
  function el(tag, attrs, ...kids) {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs ?? {})) if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
    e.append(...kids.filter((x) => x != null && x !== false));
    return e;
  }

  function ensureData() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      $('hgl-loading').hidden = false;
      $('hgl-failed').hidden = true;
      loading = fetch(aside.dataset.src, { credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok || r.redirected) throw new Error(`Werkstatt: HTTP ${r.status}`);
          return r.json();
        })
        .then((d) => {
          if (d?.v !== LAYOUT_VERSION || !d.items || !d.ships) throw new Error('Werkstatt: fremde Datei');
          data = d;
          $('hgl-loading').hidden = true;
          return d;
        })
        .catch((e) => {
          loading = null;
          $('hgl-loading').hidden = true;
          $('hgl-failed').hidden = false;
          throw e;
        });
    }
    return loading;
  }
  $('hgl-retry').addEventListener('click', () => ensureData().then(() => render(bridge.state())).catch(() => {}));

  // Ein Layout setzen, wie es aus der Adresse kommt (Neuladen, Zurueck,
  // geteilter Link, Schiffswechsel, ein geoeffnetes gespeichertes Layout).
  function adopt(state) {
    const raw = decodeLayout(state.lo) ?? { name: '', slots: {} };
    if (state.ship !== draft.ship) $('hgl-scroll').scrollTop = 0;
    slots = shipSlots(data.ships[state.ship]);
    const { slots: clean, racks: rk, dropped: lost } = cleanSlots(raw.slots, slots, data.items, raw.racks, data.racks);
    // eine Lackierung, die dieses Schiff nicht kennt, faellt weg wie ein unpassendes Teil
    const paint = raw.paint && data.paints?.[state.ship]?.list.some((r) => r[0] === raw.paint) ? raw.paint : null;
    const dropped = lost + (raw.paint && !paint ? 1 : 0);
    draft = { ship: state.ship, name: raw.name, slots: clean, ...(Object.keys(rk).length ? { racks: rk } : {}), ...(paint ? { paint } : {}) };
    code = encodeLayout(draft);
    const pending = pendingSaved ? store.get(pendingSaved) : null;
    const match = pending && sameLayout(pending, draft) ? pending : store.list().find((e) => sameLayout(e, draft));
    savedId = match ? match.id : null;
    pendingSaved = null;
    $('hgl-shared').hidden = !(firstAdopt && changedCount() > 0 && !savedId);
    firstAdopt = false;
    buildSlots();
    paintHead();
    paintSaved();
    if (dropped) showToast(plural('msg.dropped', dropped));
    if (code !== (state.lo ?? EMPTY_CODE)) bridge.set({ lo: code });
  }

  /** Nach jeder eigenen Aenderung: Code neu, Adresse neu. */
  let urlTimer = 0;
  function commit({ soon = false, patch = {} } = {}) {
    code = encodeLayout(draft);
    $('hgl-shared').hidden = true;
    clearTimeout(urlTimer);
    // Tippen im Namen schreibt die Adresse erst nach einer Pause (WebKit wirft
    // nach 100 replaceState-Aufrufen in 10 s).
    if (soon) urlTimer = setTimeout(() => bridge.set({ lo: code }), 350);
    else bridge.set({ ...patch, lo: code });
    paintHead();
  }

  /* ---- Kopf: Name und Stand ---- */
  function paintHead() {
    if (doc.activeElement !== nameIn) nameIn.value = draft.name;
    nameIn.placeholder = placeholder();
    const n = changedCount();
    const saved = savedId ? store.get(savedId) : null;
    const isSaved = !!saved && sameLayout(saved, draft);
    const st = $('hgl-state');
    st.dataset.s = isSaved ? 'saved' : n ? 'changed' : 'stock';
    $('hgl-state-txt').textContent = n ? plural('state.changed', n) : m('state.stock');
    const sub = $('hgl-state-sub');
    sub.textContent = isSaved ? `· ${m('state.saved')}` : n || draft.name ? `· ${m('state.unsaved')}` : '';
    sub.className = isSaved ? 'is-saved' : '';
    const none = !slots.length && !hasPaints();
    $('hgl-save').disabled = none;
    $('hgl-share').disabled = none;
    $('hgl-reset').disabled = none || n === 0;
  }
  nameIn.addEventListener('input', () => {
    draft.name = cleanName(nameIn.value);
    commit({ soon: true });
  });
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  nameIn.addEventListener('blur', () => { nameIn.value = draft.name; });
  $('hgl-dice').addEventListener('click', (e) => {
    const names = m('name.fun').split('|').filter((x) => x && x !== draft.name);
    draft.name = names[Math.floor(Math.random() * names.length)] ?? draft.name;
    nameIn.value = draft.name;
    const b = e.currentTarget;
    b.classList.remove('is-roll');
    void b.offsetWidth;
    b.classList.add('is-roll');
    commit();
  });

  /* ---- Slots ---- */
  const GROUPS = ['pilot', 'manned', 'remote', 'missile', 'bomb', 'power', 'cooler', 'shield', 'quantum', 'radar'];
  const slotEls = new Map();
  // Zeichen je Bauteilart, wie die Sockel im Ausruestungsmenue eines Spiels:
  // Fadenkreuz, Rakete, Schild, Blitz, Kuehlrippen, Sprung, Peilung.
  const MISSILE = 'M14.5 4.5l5-1-1 5-8.8 8.8-4-4zM9.7 17.3l-2.2 3.2-1-3-3-1 3.2-2.2M14 10h.01';
  const ICON = {
    gun: 'M12 4.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zM12 2v5M12 17v5M2 12h5M17 12h5',
    missile: MISSILE, torpedo: MISSILE, gmissile: MISSILE, bomb: 'M10.5 8.5a6 6 0 110 12 6 6 0 010-12zM14.5 9.5l2.5-2.5M17 4v2M19.5 6.5h-2',
    shield: 'M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6z',
    power: 'M13 2.5L5 13.5h6l-1 8 8-11h-6z',
    cooler: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5',
    quantum: 'M4.5 6l6 6-6 6M12 6l6 6-6 6',
    radar: 'M4 13a8 8 0 0116 0M7.5 13a4.5 4.5 0 019 0M12 13l4-6M12 14.5a1.5 1.5 0 100-3',
  };
  const SVG = 'http://www.w3.org/2000/svg';
  function ico(type) {
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'hgl-ico');
    const path = doc.createElementNS(SVG, 'path');
    path.setAttribute('d', ICON[type] ?? ICON.gun);
    svg.append(path);
    return svg;
  }
  // Was in einen Slot passt, je Art und Groesse einmal gerechnet: daraus der
  // Rang eines Teils und der Bestwert der Kampfwerte.
  const candCache = new Map();
  const fitting = (e) => {
    const k = `${e.type}|${e.size}`;
    if (!candCache.has(k)) candCache.set(k, candidates(e, data.items));
    return candCache.get(k);
  };
  // Bestwert eines Slots aus Teilen, die es im Laden gibt (Preis bekannt):
  // Beute- und Sonderteile ohne Laden setzen sonst eine Latte, die kaum
  // jemand erreicht. Ohne kaufbares Teil gilt das staerkste ueberhaupt.
  const bestOf = (e) => {
    const c = fitting(e);
    const k = c.find((x) => data.items[x][9] > 0) ?? c[0];
    return k ? data.items[k][7] : 0;
  };

  function buildSlots() {
    slotEls.clear();
    // Ohne tauschbare Bauteile (Bodenfahrzeuge, Frachtmodule) bleibt die
    // Lackierung, wenn das Schiff welche hat.
    if (!slots.length) {
      sumHost.hidden = true;
      slotsHost.replaceChildren(el('p', { class: 'hgl-empty' }, m('noslots')), ...[paintSection()].filter(Boolean));
      paintPaints();
      paintCat();
      paintMods();
      paintModel();
      return;
    }
    const groups = GROUPS.map((g) => {
      const mine = slots.filter((s) => s.group === g);
      if (!mine.length) return null;
      const total = el('b', { 'data-total': g });
      const gd = el('i', { class: 'hgl-gd', 'data-gd': g });
      return el('section', { class: 'hgl-grp', 'data-cat': tabOf(mine[0]) },
        el('h3', {}, el('span', {}, m(`grp.${g}`)), SUMMED.has(g) ? gd : null, SUMMED.has(g) ? total : null),
        el('ul', {}, ...mine.map(slotEl)));
    }).filter(Boolean);
    slotsHost.replaceChildren(...groups, ...[paintSection()].filter(Boolean));
    for (const s of slots) paintSlot(s);
    paintPaints();
    paintCat();
    paintTotals();
    syncOpen();
  }

  function slotEl(slot) {
    const id = `hgl-pick-${slot.key.replace(/[^a-z0-9_-]/g, '-')}`;
    const btn = el('button', { type: 'button', class: 'hgl-slot__btn', 'aria-expanded': 'false', 'aria-controls': id, 'data-key': slot.key },
      el('span', { class: 'hgl-sock' }, ico(slot.type), el('b', { class: 'hgl-sz' }, `S${slot.size}`)),
      el('span', { class: 'hgl-nm' }, el('strong', {}), el('small', { class: 'hgl-sub' }), el('small', { class: 'hgl-was', hidden: true }),
        el('span', { class: 'hgl-tier' }, el('i', {}))),
      el('span', { class: 'hgl-fig' }),
      el('span', { class: 'hgl-chev', 'aria-hidden': 'true' }, '›'));
    const pick = el('div', { class: 'hgl-pick', id, hidden: true });
    const li = el('li', { class: 'hgl-slot', 'data-type': slot.type, 'data-key': slot.key }, btn, pick);
    slotEls.set(slot.key, li);
    return li;
  }

  const times = (n) => (n > 1 ? `${n}× ` : '');
  function paintSlot(slot, flash = false) {
    const li = slotEls.get(slot.key);
    if (!li) return;
    const now = current(slot);
    const it = data.items[now];
    const e = eff(slot);
    const changed = isChanged(slot);
    li.toggleAttribute('data-changed', changed);
    li.dataset.type = e.type;
    const name = `${times(e.count)}${itemName(now)}`;
    li.querySelector('.hgl-sz').textContent = `S${e.size}`;
    if (li.dataset.ico !== e.type) {
      li.querySelector('.hgl-ico').replaceWith(ico(e.type));
      li.dataset.ico = e.type;
    }
    // Rang unter allem, was passt: der Balken unter dem Namen misst am Besten.
    const cands = fitting(e);
    const best = bestOf(e);
    const tier = li.querySelector('.hgl-tier');
    const rank = cands.indexOf(now) + 1;
    tier.hidden = !(it && best > 0 && cands.length > 1);
    tier.firstChild.style.setProperty('--w', `${it && best > 0 ? Math.min(100, Math.round((it[7] / best) * 100)) : 0}%`);
    tier.title = rank ? fill(m('slot.rank'), { r: nf.format(rank), n: nf.format(cands.length) }) : '';
    tier.classList.toggle('is-top', !!it && best > 0 && it[7] >= best);
    li.querySelector('strong').textContent = name;
    // Mit getauschter Halterung nennt die Unterzeile sie zuerst.
    const rk = draft.racks?.[slot.key];
    li.querySelector('.hgl-sub').textContent = [rk ? rackShort(rk) || rackName(rk) : null, subLine(now, false)].filter(Boolean).join(' · ');
    const was = li.querySelector('.hgl-was');
    was.hidden = !changed;
    was.textContent = changed ? fill(m('slot.was'), { name: slot.stock ? `${times(slot.count)}${itemName(slot.stock)}` : m('slot.unknown') }) : '';
    const fig = li.querySelector('.hgl-fig');
    fig.replaceChildren(it ? nf.format(it[7]) : '–', el('small', {}, UNIT[e.type]()));
    li.querySelector('.hgl-slot__btn').setAttribute('aria-label', `${fill(m('slot.swap'), { slot: `S${e.size} ${name}` })}`);
    if (flash) {
      li.classList.remove('is-flash');
      void li.offsetWidth;
      li.classList.add('is-flash');
    }
  }

  /* ---- Reiter: Waffen | Systeme ---- */
  // Wie die Kategorien im Spiel: die Liste zeigt nur die Gruppen des Reiters,
  // und am Schiff tragen nur seine getauschten Teile ihren Namen. Der Reiter
  // ist tab des Controllers (Uebersicht zaehlt als Waffen), damit Reiter,
  // Slot- und Markerklicks dieselbe Wahl teilen. Hat das Schiff nur eine
  // Kategorie (unbewaffnet), entfaellt die Leiste.
  // Der Reiter Lackierung hat keinen Zustand im Controller (kein Ausstattungs-
  // Tab, keine Marker): paintMode, bis jemand Waffen oder Systeme waehlt oder
  // ein Klick am Schiff den tab des Controllers aendert.
  const catBar = $('hgl-cats');
  const catBtns = [...catBar.querySelectorAll('[role="tab"]')];
  let cat = null;
  let paintMode = false;
  let seenTab = null;
  const hasPaints = () => !!data?.paints?.[draft.ship];
  function wantCat() {
    if ((paintMode || !slots.length) && hasPaints()) return 'paint';
    const want = bridge.state().tab === 'systems' ? 'systems' : 'weapons';
    const other = want === 'weapons' ? 'systems' : 'weapons';
    return slots.some((s) => tabOf(s) === want) || !slots.some((s) => tabOf(s) === other) ? want : other;
  }
  function paintCat() {
    const next = wantCat();
    const moved = next !== cat;
    cat = next;
    const present = new Set(slots.map(tabOf));
    if (hasPaints()) present.add('paint');
    const bar = present.size > 1;
    catBar.hidden = !bar;
    for (const b of catBtns) {
      const on = b.dataset.cat === cat;
      b.hidden = !present.has(b.dataset.cat);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    if (bar) {
      slotsHost.setAttribute('role', 'tabpanel');
      slotsHost.setAttribute('aria-labelledby', `hgl-c-${cat}`);
    } else {
      slotsHost.removeAttribute('role');
      slotsHost.removeAttribute('aria-labelledby');
    }
    for (const sec of slotsHost.querySelectorAll('.hgl-grp')) sec.hidden = sec.dataset.cat !== cat;
    if (moved) paintMods();
  }
  function paintCatCounts() {
    for (const b of catBtns) {
      const n = b.dataset.cat === 'paint' ? (draft.paint ? 1 : 0) : slots.filter((s) => tabOf(s) === b.dataset.cat && isChanged(s)).length;
      b.querySelector('[data-cat-n]').textContent = n ? nf.format(n) : '';
    }
  }
  function pickCat(to) {
    if (to === cat) return;
    openKey = null;
    paintMode = to === 'paint';
    bridge.set(paintMode ? { hp: null } : { tab: to, hp: null });
    paintCat();
    syncOpen();
  }
  catBar.addEventListener('click', (e) => {
    const b = e.target.closest('[role="tab"]');
    if (b) pickCat(b.dataset.cat);
  });
  catBar.addEventListener('keydown', (e) => {
    const vis = catBtns.filter((b) => !b.hidden);
    const i = vis.findIndex((b) => b.dataset.cat === cat);
    const n = vis.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    pickCat(vis[to].dataset.cat);
    vis[to].focus();
  });

  /* ---- Lackierung ---- */
  // Serienlack zuerst, dann die Lackierungen des Schiffs mit ihren drei Toenen.
  // Muster (eigene Texturen im Spiel) zeigt die Vorschau nicht, nur die Farben.
  function paintSection() {
    const sp = data.paints?.[draft.ship];
    if (!sp) return null;
    const rows = [['', m('paint.stock'), ...sp.base, 0], ...sp.list];
    return el('section', { class: 'hgl-grp', 'data-cat': 'paint' },
      el('h3', {}, el('span', {}, m('grp.paint'))),
      el('ul', { class: 'hgl-paints' }, ...rows.map(([id, name, a, b, c, pattern]) => el('li', {},
        el('button', { type: 'button', class: 'hgl-paint', 'data-paint': id, 'aria-pressed': 'false' },
          el('span', { class: 'hgl-sw', 'aria-hidden': 'true' }, ...[a, b, c].map((col) => el('i', { style: `background:${col}` }))),
          el('span', { class: 'hgl-nm' }, el('strong', {}, name), pattern ? el('small', { class: 'hgl-sub' }, m('paint.pattern')) : null),
          el('span', { class: 'hgl-tick', 'aria-hidden': 'true' }))))));
  }
  function paintPaints() {
    for (const b of slotsHost.querySelectorAll('.hgl-paint')) b.setAttribute('aria-pressed', String(b.dataset.paint === (draft.paint ?? '')));
  }
  function pickPaint(id) {
    if ((draft.paint ?? '') === id) return;
    if (id) draft.paint = id;
    else delete draft.paint;
    commit();
    paintPaints();
    paintTotals();
    const row = data.paints[draft.ship].list.find((r) => r[0] === id);
    bridge.say(row ? row[1] : m('paint.stock'));
  }
  // Am Modell: die Toene der Lackierung samt Serienpalette, nach der der
  // Viewer die Palettenmaterialien erkennt; null = Serienlack.
  function paintModel() {
    const sp = data.paints?.[draft.ship];
    const row = draft.paint && sp?.list.find((r) => r[0] === draft.paint);
    bridge.paint?.(draft.ship, row ? { cols: row.slice(2, 5), base: sp.base } : null);
  }

  // Marker am Schiff im Werkstatt-Modus: nur die Hardpoints mit Slot im
  // gewaehlten Reiter (keine Gegenmassnahmen, keine Fracht). Getauschte
  // Bordwaffen gross und mit dem Namen des neuen Teils; Raketen, Torpedos,
  // Bomben und Komponenten bleiben schlichte Punkte ohne Namen, auch
  // getauscht (Krisz: Name und Hervorhebung nur bei Bordwaffen). Der
  // Namenszettel der Seite (b) traegt das Serienteil und faellt deshalb
  // bei diesen ganz weg. Als Stilregeln statt als
  // Klassen, weil der Controller die Marker bei jedem Schiffswechsel neu
  // einsetzt (Region marks) und die Regeln das ueberleben; #main hebt sie
  // ueber die Tab-Regel der Seite und die Grundregel der Werkstatt
  // (LayoutWorkshop.astro).
  const modStyle = doc.head.appendChild(el('style', { id: 'hgl-mods' }));
  const cssStr = (t) => `"${String(t).replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ')}"`;
  function paintMods() {
    const byPort = new Map();
    for (const s of slots) {
      if (tabOf(s) !== cat) continue;
      const sel = `#main.hg[data-pane="layout"] .hgx-mk[data-tab="${cat}"][data-port="${CSS.escape(portOf(s.key))}"]`;
      const p = byPort.get(sel) ?? { gun: false, names: [] };
      byPort.set(sel, p);
      if (s.type !== 'gun') continue;
      p.gun = true;
      const k = draft.slots[s.key];
      if (k) p.names.push(itemName(k));
    }
    modStyle.textContent = [...byPort].map(([sel, { gun, names }]) => (!names.length ? `${sel}{display:block}${gun ? '' : `${sel} b{display:none}`}`
      : `${sel}{display:block;width:22px;height:22px;margin:-11px 0 0 -11px;opacity:1;background:var(--hg-amber);box-shadow:0 0 0 3px color-mix(in srgb,var(--hg-amber) 35%,transparent),0 0 18px var(--hg-amber)}`
      + `${sel} b{display:none}${sel}::after{content:${cssStr([...new Set(names)].join(' + '))}}`)).join('\n');
    // Am Modell: getauschte Bordwaffen, deren 3D-Modell es gibt (der Viewer
    // laesst Ports ohne Tauschteile von selbst in Serie)
    const fits = [];
    for (const s of slots) {
      const k = draft.slots[s.key];
      const url = k && s.type === 'gun' ? data.models?.[k] : null;
      if (url) fits.push({ port: portOf(s.key), item: Number(s.key.split('.')[1] ?? 0), url });
    }
    bridge.fit?.(draft.ship, fits);
  }

  function paintTotals() {
    paintMods();
    paintModel();
    paintCatCounts();
    const totals = groupTotals(slots, draft.slots, data.items, draft.racks, data.racks);
    for (const [g, t] of totals) {
      const unit = g === 'pilot' || g === 'manned' || g === 'remote' ? 'DPS' : g === 'missile' || g === 'bomb' ? dmg() : UNIT[g]();
      const b = slotsHost.querySelector(`[data-total="${g}"]`);
      if (b) b.textContent = `${nf.format(Math.round(t.now))} ${unit}`;
      const gd = slotsHost.querySelector(`[data-gd="${g}"]`);
      if (!gd) continue;
      const d = Math.round(t.now - t.stock);
      gd.textContent = d ? new Intl.NumberFormat(loc, { signDisplay: 'exceptZero' }).format(d) : '';
      gd.className = `hgl-gd ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}`;
    }
    paintSum(totals);
  }

  // Kampfwerte im Kopf: Feuerkraft aller Bordwaffen und Tuerme, Raketen und
  // Bomben, Schild. Der Balken laeuft bis zum Bestwert, den die Slots fassen
  // (je Slot das staerkste kaufbare Teil, bestOf), der Strich steht auf der
  // Serie. Liegt ein Beuteteil darueber, ist der Balken voll.
  const SUMS = { fire: ['pilot', 'manned', 'remote'], ord: ['missile', 'bomb'], shield: ['shield'] };
  const sumHost = $('hgl-sum');
  function paintSum(totals) {
    let shown = 0;
    for (const [k, groups] of Object.entries(SUMS)) {
      const tile = sumHost.querySelector(`[data-sum="${k}"]`);
      let now = 0, stock = 0, top = 0;
      for (const g of groups) {
        const t = totals.get(g);
        if (t) { now += t.now; stock += t.stock; }
      }
      for (const s of slots) {
        if (!groups.includes(s.group)) continue;
        const e = eff(s);
        top += bestOf(e) * e.count;
      }
      tile.hidden = !(now > 0 || stock > 0);
      if (tile.hidden) continue;
      shown++;
      tile.querySelector('b').textContent = nf.format(Math.round(now));
      // Raketen ohne Einheit: "Schaden" passt nicht neben die Zahl, die Kachel sagt es.
      tile.querySelector('small').textContent = k === 'fire' ? 'DPS' : k === 'shield' ? 'HP' : '';
      const d = Math.round(now - stock);
      const di = tile.querySelector('.hgl-stat__d');
      di.textContent = d ? new Intl.NumberFormat(loc, { signDisplay: 'exceptZero' }).format(d) : '';
      di.className = `hgl-stat__d ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}`;
      const scale = Math.max(top, now, stock, 1);
      const bar = tile.querySelector('.hgl-stat__bar');
      bar.style.setProperty('--now', `${Math.round((now / scale) * 100)}%`);
      bar.style.setProperty('--stock', `${Math.round((stock / scale) * 100)}%`);
    }
    sumHost.hidden = !shown;
    sumHost.dataset.n = String(shown);
  }

  // Auswahl eines Slots: folgt hp des Controllers. Ein Port mit mehreren
  // Items behaelt den gewaehlten Slot, solange hp sein Port bleibt.
  function syncOpen() {
    const hp = bridge.state().hp;
    if (!hp) openKey = null;
    else if (!openKey || portOf(openKey) !== hp) openKey = slots.find((s) => portOf(s.key) === hp)?.key ?? null;
    for (const s of slots) {
      const li = slotEls.get(s.key);
      const on = s.key === openKey;
      if (li.classList.contains('is-open') === on) continue;
      li.classList.toggle('is-open', on);
      li.querySelector('.hgl-slot__btn').setAttribute('aria-expanded', String(on));
      const pick = li.querySelector('.hgl-pick');
      pick.hidden = !on;
      if (on) {
        buildPicker(s, pick);
        revealSlot(li);
      } else pick.replaceChildren();
    }
  }

  function revealSlot(li) {
    const host = $('hgl-scroll');
    if (host.scrollHeight <= host.clientHeight) return;
    const r = li.getBoundingClientRect(), h = host.getBoundingClientRect();
    // Die Reiter kleben oben in der Liste: der Slot gehoert darunter, nicht dahinter.
    const cats = $('hgl-cats'), top = h.top + (cats.hidden ? 0 : cats.offsetHeight);
    if (r.top < top || r.bottom > h.bottom) host.scrollTop += r.top - top - 8;
  }

  // Halterungen eines Raketenports: je eine Taste mit Anzahl und Groesse der
  // Raketen, darunter Name und Preis der gewaehlten; die Serie traegt ihr Etikett.
  function rackBar(slot) {
    const on = draft.racks?.[slot.key] ?? slot.racks[0];
    // kleine Raketen zuerst, bei gleicher Groesse die mit mehr Plaetzen
    const order = [...slot.racks].sort((a, b) => data.racks[a][4] - data.racks[b][4] || data.racks[b][3] - data.racks[a][3]);
    const btns = order.map((k) => {
      const r = data.racks[k];
      const tags = [k === slot.racks[0] && k !== on ? el('em', {}, m('slot.stock')) : null];
      return el('button', { type: 'button', class: 'hgl-rack', 'data-rack': k, 'aria-pressed': String(k === on), title: rackName(k) },
        el('b', {}, `${r[3]}× S${r[4]}`), el('small', {}, rackShort(k)), ...tags);
    });
    const r = data.racks[on];
    const info = [rackName(on), r?.[7] ? fill(m('pick.price'), { n: nf.format(r[7]) }) : m('pick.noshop')].join(' · ');
    return el('div', { class: 'hgl-racks', role: 'group', 'aria-label': m('rack.label') },
      el('span', { class: 'hgl-racks__h' }, m('rack.label')),
      el('div', { class: 'hgl-racks__row' }, ...btns),
      el('small', { class: 'hgl-racks__info' }, info));
  }
  // Kurzname einer Halterung fuer die Taste: ohne Art, Bauweise und Belegung ("MSD-322", "Gatac").
  const rackShort = (k) => (data.racks[k]?.[0] ?? '')
    .replace(/\b\d+\s*x\s*S?\d+\b/gi, '')
    .replace(/\b(missile|torpedo|bomb)\b/gi, '').replace(/\b(racks?|launchers?)\b/gi, '')
    .replace(/\s+-\s*$/, '').replace(/\s{2,}/g, ' ').trim();

  function buildPicker(slot, pick) {
    const keys = candidates(eff(slot), data.items);
    const now = current(slot);
    const base = data.items[now]?.[7] ?? null;
    const max = Math.max(1, ...keys.map((k) => data.items[k][7]));
    const q = el('input', { type: 'search', class: 'hgl-q', placeholder: m('pick.search'), 'aria-label': m('pick.searchLabel'), autocomplete: 'off' });
    const count = el('span', { class: 'hgl-n', 'aria-live': 'polite' });
    const ul = el('ul', { class: 'hgl-opts' });
    const empty = el('p', { class: 'hgl-msgline', hidden: true }, m('pick.empty'));
    const opts = keys.map((k) => {
      const it = data.items[k];
      const d = k === now ? null : deltaPct(it[7], base);
      const tags = [k === now ? el('em', { class: 'is-fit' }, m('slot.fitted')) : null, k === slot.stock && k !== now ? el('em', {}, m('slot.stock')) : null];
      const b = el('button', { type: 'button', class: 'hgl-opt', 'data-item': k, 'aria-pressed': String(k === now) },
        el('span', { class: 'hgl-opt__nm' }, itemName(k), ...tags),
        el('span', { class: 'hgl-opt__sub' }, subLine(k, true)),
        el('span', { class: 'hgl-opt__fig' }, nf.format(it[7])),
        el('span', { class: `hgl-opt__d ${d == null ? '' : d > 0 ? 'is-up' : d < 0 ? 'is-down' : 'is-flat'}` }, d == null ? '' : `${new Intl.NumberFormat(loc, { signDisplay: 'exceptZero' }).format(d)} %`),
        el('span', { class: 'hgl-opt__bar', 'aria-hidden': 'true' }, el('i', { style: `--w:${Math.round((it[7] / max) * 100)}%` })));
      const li = el('li', { 'data-q': `${it[0]} ${it[1] || ''} ${it[4] || ''}`.toLowerCase() }, b);
      return li;
    });
    ul.append(...opts);
    const filter = () => {
      const s = q.value.trim().toLowerCase();
      let n = 0;
      for (const li of opts) { const ok = !s || li.dataset.q.includes(s); li.hidden = !ok; if (ok) n++; }
      count.textContent = plural('pick.count', n);
      empty.hidden = n > 0;
    };
    q.addEventListener('input', filter);
    filter();
    const revert = el('button', { type: 'button', class: 'hgl-revert', hidden: !isChanged(slot) || !slot.stock }, m('slot.revert'));
    revert.addEventListener('click', () => equip(slot, slot.stock, slot.racks?.[0]));
    pick.replaceChildren(...[slot.racks ? rackBar(slot) : null].filter(Boolean), el('div', { class: 'hgl-pickbar' }, q, count), ul, empty, revert);
    // Die gewaehlte Zeile in Sicht, ohne die Seite zu rollen.
    const on = ul.querySelector('[aria-pressed="true"]');
    if (on) ul.scrollTop = on.parentElement.offsetTop - ul.clientHeight / 2 + on.offsetHeight / 2;
  }

  /** Setzt die Halterung eines Slots (undefined: bleibt); mit getauschter Halterung steht die Rakete ausdruecklich da. */
  function setRack(slot, rack) {
    if (rack === undefined || !slot.racks) return;
    const racks = { ...(draft.racks ?? {}) };
    if (rack === slot.racks[0]) delete racks[slot.key];
    else racks[slot.key] = rack;
    if (Object.keys(racks).length) draft.racks = cleanSlotMap(racks);
    else delete draft.racks;
  }
  function setItem(slot, item) {
    if (item === slot.stock && !draft.racks?.[slot.key]) delete draft.slots[slot.key];
    else draft.slots[slot.key] = item;
    draft.slots = cleanSlotMap(draft.slots);
  }

  // Eine andere Halterung: die Rakete folgt (rackMissile), die Auswahl bleibt
  // offen, damit gleich die Rakete gewaehlt werden kann.
  function equipRack(slot, rack) {
    if ((draft.racks?.[slot.key] ?? slot.racks[0]) === rack) return;
    const prev = current(slot);
    setRack(slot, rack);
    const next = rackMissile(eff(slot), data.items, prev) ?? rackMissile(eff(slot), data.items, slot.stock);
    if (!next) return;
    setItem(slot, next);
    bridge.say(fill(m('msg.fitted'), { item: `${rackName(rack)}, ${times(eff(slot).count)}${itemName(next)}` }));
    commit();
    paintSlot(slot, true);
    paintTotals();
    const li = slotEls.get(slot.key);
    if (li && openKey === slot.key) {
      buildPicker(slot, li.querySelector('.hgl-pick'));
      li.querySelector(`.hgl-rack[data-rack="${CSS.escape(rack)}"]`)?.focus({ preventScroll: true });
    }
  }

  function equip(slot, item, rack) {
    if (!item) return;
    setRack(slot, rack);
    setItem(slot, item);
    bridge.say(fill(m('msg.fitted'), { item: itemName(item) }));
    // Zu: die Auswahl schliesst, die Kamera faehrt zurueck, der Slot leuchtet.
    openKey = null;
    commit({ patch: { hp: null } });
    paintSlot(slot, true);
    paintTotals();
    slotEls.get(slot.key)?.querySelector('.hgl-slot__btn').focus({ preventScroll: true });
  }

  slotsHost.addEventListener('click', (e) => {
    const pb = e.target.closest('.hgl-paint');
    if (pb) { pickPaint(pb.dataset.paint); return; }
    const rb = e.target.closest('.hgl-rack');
    if (rb) {
      const slot = slots.find((s) => s.key === rb.closest('.hgl-slot').dataset.key);
      if (slot) equipRack(slot, rb.dataset.rack);
      return;
    }
    const opt = e.target.closest('.hgl-opt');
    if (opt) {
      const slot = slots.find((s) => s.key === opt.closest('.hgl-slot').dataset.key);
      if (slot) equip(slot, opt.dataset.item);
      return;
    }
    const btn = e.target.closest('.hgl-slot__btn');
    if (!btn) return;
    const slot = slots.find((s) => s.key === btn.dataset.key);
    if (!slot) return;
    if (openKey === slot.key) {
      openKey = null;
      bridge.set({ hp: null });
    } else {
      openKey = slot.key;
      bridge.set({ tab: tabOf(slot), hp: portOf(slot.key) });
    }
    syncOpen();
    if (openKey === slot.key) slotEls.get(slot.key).querySelector('.hgl-q')?.focus({ preventScroll: true });
  });
  // Pfeile in der Auswahl: Suche -> erste Zeile, dann Zeile fuer Zeile.
  slotsHost.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const pick = e.target.closest('.hgl-pick');
    if (!pick) return;
    const opts = [...pick.querySelectorAll('li:not([hidden]) .hgl-opt')];
    if (!opts.length) return;
    e.preventDefault();
    const i = opts.indexOf(e.target);
    const to = e.key === 'ArrowDown' ? (i < 0 ? 0 : Math.min(opts.length - 1, i + 1)) : i <= 0 ? -1 : i - 1;
    (to < 0 ? pick.querySelector('.hgl-q') : opts[to]).focus();
  });
  // Der Hardpoint unter dem Zeiger leuchtet am Schiff.
  const hot = (key) => {
    const port = key ? portOf(key) : null;
    for (const mk of doc.querySelectorAll('.hgx-mk')) mk.classList.toggle('is-hot', !!port && mk.dataset.port === port);
  };
  slotsHost.addEventListener('pointerover', (e) => hot(e.target.closest('.hgl-slot')?.dataset.key ?? null));
  slotsHost.addEventListener('pointerleave', () => hot(null));
  slotsHost.addEventListener('focusin', (e) => hot(e.target.closest('.hgl-slot')?.dataset.key ?? null));
  slotsHost.addEventListener('focusout', () => hot(null));

  /* ---- Speichern, Teilen, Serie ---- */
  function save() {
    if (!slots.length && !hasPaints()) return;
    const entry = store.save({ id: savedId && store.get(savedId) ? savedId : newId(), ship: draft.ship, name: draft.name || placeholder(), slots: draft.slots, racks: draft.racks, paint: draft.paint });
    if (!entry) { showToast(m('msg.full')); return; }
    savedId = entry.id;
    if (!draft.name) {
      draft.name = entry.name;
      commit();
    }
    $('hgl-shared').hidden = true;
    paintHead();
    paintSaved();
    done($('hgl-save'));
    showToast(m('msg.saved'));
  }
  $('hgl-save').addEventListener('click', save);

  const linkFor = (lo) => `${location.origin}${location.pathname}?ship=${encodeURIComponent(lo.ship)}&layout=${encodeLayout(lo)}`;
  async function share(lo, btn) {
    const url = linkFor(lo);
    try {
      await navigator.clipboard.writeText(url);
      copyField.hidden = true;
      done(btn);
      showToast(m('msg.copied'));
    } catch {
      copyField.value = url;
      copyField.hidden = false;
      copyField.focus();
      copyField.select();
      showToast(m('msg.copyFallback'));
    }
  }
  $('hgl-share').addEventListener('click', (e) => share(draft, e.currentTarget));

  $('hgl-reset').addEventListener('click', () => {
    draft.slots = {};
    delete draft.racks;
    delete draft.paint;
    openKey = null;
    commit({ patch: { hp: null } });
    for (const s of slots) paintSlot(s, true);
    paintPaints();
    paintTotals();
    syncOpen();
    showToast(m('msg.reset'));
  });

  function done(btn) {
    btn.classList.add('is-done');
    setTimeout(() => btn.classList.remove('is-done'), 1400);
  }
  let toastTimer = 0;
  let undo = null;
  function showToast(text, onUndo = null) {
    $('hgl-toast-txt').textContent = text;
    undo = onUndo;
    undoBtn.hidden = !onUndo;
    toast.classList.add('is-on');
    bridge.say(text);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.classList.remove('is-on'); undo = null; }, onUndo ? 6000 : 2600);
  }
  undoBtn.addEventListener('click', () => {
    const f = undo;
    undo = null;
    toast.classList.remove('is-on');
    f?.();
  });

  /* ---- Ansichten: Bauen und Meine Layouts ---- */
  // Ein Schalter im Kopf: gedrueckt zeigt die Tafel die gespeicherten
  // Layouts, ein zweiter Klick (oder Oeffnen eines Layouts) fuehrt zum Bauen.
  const savedBtn = $('hgl-v-saved');
  function setView(v) {
    view = v;
    savedBtn.setAttribute('aria-pressed', String(v === 'saved'));
    $('hgl-build').hidden = v !== 'build';
    $('hgl-saved').hidden = v !== 'saved';
    if (v === 'saved') paintSaved();
  }
  savedBtn.addEventListener('click', () => setView(view === 'saved' ? 'build' : 'saved'));

  function paintSaved() {
    const all = store.list();
    $('hgl-count').textContent = nf.format(all.length);
    if (view !== 'saved') return;
    if (!all.length) {
      list.replaceChildren(el('li', { class: 'hgl-empty' }, m('saved.empty')));
      return;
    }
    const here = all.filter((e) => e.ship === draft.ship);
    const rest = all.filter((e) => e.ship !== draft.ship);
    list.replaceChildren(...[...here, ...rest].map((e) => {
      const n = changeCount(e);
      const isHere = e.ship === draft.ship;
      return el('li', { class: `hgl-card${isHere ? ' is-here' : ''}${e.id === savedId ? ' is-current' : ''}`, 'data-id': e.id },
        el('h4', {}, e.name || fill(m('name.placeholder'), { ship: bridge.shipName(e.ship) }), isHere ? el('span', { class: 'hgl-card__tag' }, m('saved.here')) : null),
        el('p', {}, el('b', {}, bridge.shipName(e.ship)), ` · ${n ? plural('state.changed', n) : m('saved.stock')}`),
        el('span', { class: 'hgl-card__acts' },
          el('button', { type: 'button', class: 'hgl-mini is-main', 'data-open': e.id }, m('saved.open')),
          el('button', { type: 'button', class: 'hgl-mini', 'data-share': e.id }, m('saved.share')),
          el('button', { type: 'button', class: 'hgl-mini', 'data-del': e.id, 'aria-label': fill(m('saved.deleteLabel'), { name: e.name }), title: m('saved.delete') }, '×')));
    }));
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const entry = store.get(b.dataset.open || b.dataset.share || b.dataset.del);
    if (!entry) { paintSaved(); return; }
    if (b.dataset.open) {
      pendingSaved = entry.id;
      setView('build');
      bridge.set({ ship: entry.ship, lo: encodeLayout(entry), hp: null });
    } else if (b.dataset.share) share(entry, b);
    else if (b.dataset.del) {
      const gone = store.remove(entry.id);
      if (!gone) return;
      if (savedId === gone.id) savedId = null;
      paintSaved();
      paintHead();
      (list.querySelector('button') ?? savedBtn).focus();
      showToast(fill(m('msg.deleted'), { name: gone.name }), () => {
        store.restore(gone);
        paintSaved();
        paintHead();
      });
    }
  });
  // Ein zweiter Tab speichert mit: Liste und Stand ziehen nach.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || !data) return;
    paintSaved();
    paintHead();
  });

  /* ---- Takt des Controllers ---- */
  function render(state) {
    const open = state.pane === 'layout';
    aside.hidden = !open;
    if (!open) {
      hot(null);
      return;
    }
    if (!data) {
      ensureData().then(() => render(bridge.state())).catch(() => {});
      return;
    }
    // Ein neuer tab (Klick am Schiff, Slot, Reiter) beendet den Reiter Lackierung.
    if (state.tab !== seenTab) {
      if (seenTab !== null) paintMode = false;
      seenTab = state.tab;
    }
    if (state.ship !== draft.ship || (state.lo ?? EMPTY_CODE) !== code) adopt(state);
    else {
      paintCat();
      syncOpen();
    }
  }

  return { render };
}
