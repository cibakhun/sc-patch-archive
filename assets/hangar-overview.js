// Controller der Hangarseite (/hangar.html, /de/hangar.html). Er besitzt den
// Zustand der Seite und seine URL-Form, holt die Buchtdokumente je Schiff
// (/hangar-bay/<id>.html, gebaut von src/lib/hangar/bay.ts) und setzt ihre
// Regionen ein, und er steuert den Viewer der Szene ueber die Naht in
// #hg-stage (src/lib/hangar/stage.ts, .planning/notes/hangar-naht.md).
//
// Er uebersetzt nichts: jedes Wort kommt als gebautes Markup oder als Vorlage
// aus #hgx-msg. Zahlen formatiert er nur dort, wo sie von der Auswahl des
// Besuchers abhaengen: Trefferzahl des Docks, Flottenzeile (fillMessage),
// Vergleichszellen und Werte der sortierten Karten (compareCell, figureText;
// Einheit und Stellen stehen gebaut an den Zeilen der Vergleichstabelle).
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
 *   lo: string|null, station: 'uebersicht'|'loadout', flat: boolean, fleetOnly: boolean, sort: string, q: string,
 *   pur: string, grp: string, size: string[], crew: string, cargo: number, price: number, maker: string,
 * }} HangarState
 */
/**
 * Wogegen parseState prueft. boot() liest es aus dem gebauten DOM, damit der
 * Client keine zweite Liste von Schiffen, Tabs, Sortierungen, Zwecken,
 * Unterrollen oder Filterstufen fuehrt. Der erste Tab und die erste
 * Sortierung sind die Vorgabe. grps nennt Unterrollen als 'zweck:rolle'.
 * @typedef {{
 *   ids: ReadonlySet<string>, defaultShip: string, tabs: readonly string[], sorts: readonly string[],
 *   purs: ReadonlySet<string>, grps: ReadonlySet<string>, sizes: readonly string[], crews: ReadonlySet<string>,
 *   cargos: ReadonlySet<number>, prices: ReadonlySet<number>, makers: ReadonlySet<string>,
 * }} StateContext
 */

export const MAX_COMPARE = 3;
const PORT_RE = /^[a-z0-9_]{1,100}$/;
// lo ist das Layout in der Werkstatt (assets/hangar-layouts.js), als dessen
// Link-Code; null heisst Serie ohne Namen. Welche Slots und Bauteile der Code
// nennt, prueft erst die Werkstatt mit ihren Daten. EMPTY_LAYOUT ist dort
// EMPTY_CODE und faellt hier auf null, damit Serie keine Adresse kostet; der
// Test haelt beide gleich.
const LAYOUT_RE = /^[A-Za-z0-9_-]{1,4000}$/;
export const EMPTY_LAYOUT = 'WzEsIiIse31d';
// Stationen (ROADMAP Phase 22) in der Folge ihrer Leiste. Ab 761 px steht
// die Uebersicht als Hologramm in der Halle und traegt die Werkstatt in sich
// (Tafel „Ausruestung“, Krisz 10.11.2026: „eine zentrale bedieneroberflaeche“);
// welche Station gewaehlt ist, zaehlt dann nicht. flat (?tafel=1, „Als
// Tafel“) legt die Tafeln rechts ab wie am Telefon: dort waehlt station
// zwischen Schiffsdaten und Werkstatt, die Werkstatt (Loadout) bleibt die
// Vorgabe wie vor den Stationen. Das alte ?pane=ship heisst Uebersicht.
export const STATIONS = ['uebersicht', 'loadout'];
export const STATION_DEFAULT = 'loadout';

// Orte der Halle (13.11.2026): Schiffsfeld, Werkhalle, Leitstand. Wo das
// Fahrzeug steht, sagt es selbst (Schiff: Feld, Bodenfahrzeug: Werkhalle,
// models[id][3]); der Zustand nennt nur, ob die Kamera im Leitstand vor dem
// Terminal steht (?ort=leit). Das gibt es nur bei einem Schiff: Aus der
// Werkhalle fuehrt der Weg erst zurueck aufs Feld.
/**
 * Der Ort, an dem die Buehne fuer diesen Zustand steht.
 *   placeOf({ ship: 'anvl-ballista', ort: 'halle' }, new Set(['anvl-ballista'])) === 'werk'
 * @param {{ ship: string, ort: string }} s @param {ReadonlySet<string>} werk Ids der Bodenfahrzeuge
 * @returns {'halle'|'werk'|'leit'}
 */
export const placeOf = (s, werk) => (s.ort === 'leit' ? 'leit' : werk.has(s.ship) ? 'werk' : 'halle');
/**
 * Das Fahrzeug, das ein Ort zeigt: Wer schon passt, bleibt. Sonst das zuletzt
 * dort gezeigte (memo), sonst das Startschiff bzw. das erste Bodenfahrzeug
 * der Liste. null, wenn es fuer den Ort keines gibt.
 *   placeShip('werk', 'aegs-gladius', { werk: 'anvl-ballista' }, { ids: ['aegs-gladius', 'anvl-ballista'], werk: new Set(['anvl-ballista']), defaultShip: 'aegs-gladius' }) === 'anvl-ballista'
 * @param {'halle'|'werk'|'leit'} to @param {string} ship das gezeigte Fahrzeug
 * @param {{ halle?: string, werk?: string }} memo
 * @param {{ ids: readonly string[], werk: ReadonlySet<string>, defaultShip: string }} c ids in der Folge der Liste
 * @returns {string|null}
 */
export function placeShip(to, ship, memo, c) {
  const ground = to === 'werk', fits = (id) => c.ids.includes(id) && c.werk.has(id) === ground;
  if (fits(ship)) return ship;
  const last = ground ? memo?.werk : memo?.halle;
  if (fits(last)) return last;
  if (!ground && fits(c.defaultShip)) return c.defaultShip;
  return c.ids.find(fits) ?? null;
}

/**
 * Bringt einen beliebigen Zustandsentwurf in die gueltige Form. Unbekannte Ids
 * fallen weg, cmp wird entdoppelt und auf drei gekappt, unbekannte Tabs und
 * Sortierungen fallen auf die Vorgabe. Ein Hardpoint gibt es nur auf einem
 * Ausstattungs-Tab; ob die Bucht ihn kennt, entscheidet erst die Bucht. Der
 * Vergleich steht offen erst ab zwei Schiffen; cmp[0] ist seine Basis.
 * @param {Partial<HangarState>} s @param {StateContext} ctx @returns {HangarState}
 */
export function normalize(s, ctx) {
  const tab = ctx.tabs.includes(s.tab) ? s.tab : ctx.tabs[0];
  const pur = ctx.purs.has(s.pur) ? s.pur : '';
  const cmp = [...new Set((s.cmp ?? []).filter((id) => ctx.ids.has(id)))].slice(0, MAX_COMPARE);
  const ship = ctx.ids.has(s.ship) ? s.ship : ctx.defaultShip;
  return {
    ship,
    tab,
    hp: tab !== ctx.tabs[0] && typeof s.hp === 'string' && PORT_RE.test(s.hp) ? s.hp : null,
    cmp,
    view: s.view === 'compare' && cmp.length >= 2 ? 'compare' : 'stage',
    lo: typeof s.lo === 'string' && LAYOUT_RE.test(s.lo) && s.lo !== EMPTY_LAYOUT ? s.lo : null,
    station: STATIONS.includes(s.station) ? s.station : STATION_DEFAULT,
    flat: s.flat === true,
    // In den Leitstand nur von einem Schiff aus (ctx.werk: die Bodenfahrzeuge)
    ort: s.ort === 'leit' && !ctx.werk?.has(ship) ? 'leit' : 'halle',
    fleetOnly: s.fleetOnly === true,
    sort: ctx.sorts.includes(s.sort) ? s.sort : ctx.sorts[0],
    q: String(s.q ?? '').trim().slice(0, 80),
    pur,
    // Eine Unterrolle gibt es nur unter ihrem Zweck.
    grp: pur && ctx.grps.has(`${pur}:${s.grp}`) ? s.grp : '',
    size: ctx.sizes.filter((z) => (s.size ?? []).includes(z)),
    crew: ctx.crews.has(s.crew) ? s.crew : '',
    cargo: ctx.cargos.has(Number(s.cargo)) ? Number(s.cargo) : 0,
    price: ctx.prices.has(Number(s.price)) ? Number(s.price) : 0,
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
    lo: p.get('layout'),
    station: p.get('station') ?? (p.get('pane') === 'ship' ? 'uebersicht' : null),
    flat: p.get('tafel') === '1',
    ort: p.get('ort'),
    fleetOnly: p.get('fleet') === '1',
    sort: p.get('sort'),
    q: p.get('q') ?? '',
    pur: p.get('pur') ?? '',
    grp: p.get('grp') ?? '',
    size: (p.get('size') ?? '').split(','),
    crew: p.get('crew') ?? '',
    cargo: p.get('cargo'),
    price: p.get('price'),
    maker: p.get('maker') ?? '',
  }, ctx);
}

/**
 * HangarState nach '?…', Vorgaben weggelassen, feste Schluesselfolge (ship,
 * tab, hp, cmp, view, layout, station, tafel, ort, fleet, sort, q, pur, grp, size, crew,
 * cargo, price, maker): gleiche Zustaende
 * ergeben gleiche URLs. scope 'share' (Link kopieren) nennt immer das Schiff
 * und laesst die persoenlichen Dock-Filter weg; der Empfaenger hat eine andere
 * Flotte. Das Layout der Werkstatt reist mit: es ist, was geteilt werden soll.
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
  // base64url braucht keine Maskierung.
  if (s.lo) out.push(`layout=${s.lo}`);
  if (!share) {
    // Wer ein Layout teilt, teilt die Werkstatt: die Ansicht bleibt beim Empfaenger Vorgabe.
    if (s.station !== STATION_DEFAULT) put('station', s.station);
    if (s.flat) put('tafel', '1');
    // Wo die Kamera steht, ist Sache dessen, der schaut: nicht im geteilten Link
    if (s.ort === 'leit') put('ort', 'leit');
    if (s.fleetOnly) put('fleet', '1');
    if (s.sort !== ctx.sorts[0]) put('sort', s.sort);
    if (s.q) put('q', s.q);
    if (s.pur) put('pur', s.pur);
    if (s.grp) put('grp', s.grp);
    if (s.size.length) out.push(`size=${s.size.join(',')}`);
    if (s.crew) put('crew', s.crew);
    if (s.cargo) put('cargo', s.cargo);
    if (s.price) put('price', s.price);
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

/**
 * Eine Zelle des Vergleichs: der Wert in der Genauigkeit und Einheit des
 * Kennwert-Verzeichnisses, darunter die vorzeichenbehaftete Abweichung zur
 * Basis und ihr Ton nach der Richtung von "besser" (better: 1 mehr, -1 weniger,
 * 0 keine). Ohne Basis, ohne einen der Werte oder bei 0 gibt es keine
 * Abweichung. Die Spalte der Basis selbst ruft mit base = null.
 *   compareCell(1150, 1193, { digits: 0, unit: 'm/s', better: 1 }, 'en-US')
 *   -> { value: '1,150 m/s', delta: '-43 m/s', tone: 'down' }
 * @param {number|null} value @param {number|null} base
 * @param {{ digits: number, unit: string, better: number }} row @param {string} loc
 * @returns {{ value: string, delta: string|null, tone: 'up'|'down'|'flat'|null }}
 */
export function compareCell(value, base, row, loc) {
  const out = { value: figureText(value, row, loc), delta: null, tone: null };
  if (value == null || base == null) return out;
  const d = roundTo(value - base, row.digits);
  if (d === 0) return out;
  out.delta = withUnit(new Intl.NumberFormat(loc, { signDisplay: 'exceptZero' }).format(d), row.unit);
  out.tone = row.better === 0 ? 'flat' : Math.sign(d) === row.better ? 'up' : 'down';
  return out;
}

/**
 * Die Teile einer Bucht je Gruppe, so wie die Tabs Waffen und Systeme sie
 * zeigen: Stueckzahl, Groesse und Name je Zeile, gelesen aus dem Markup von
 * ShipBay.astro (.hgx-grp[data-g] .hgx-slot mit .hgx-sz und .hgx-nm; der
 * Name traegt ab zwei Stueck das Praefix „2× “, die Unterzeile steht in
 * <small>). Ohne Groesse steht dort ein Punkt, hier ''.
 *   bayParts(panel).get('pilot')
 *   -> [{ n: 1, size: 'S3', name: 'Mantis GT-220 Gatling' }, { n: 2, size: 'S3', name: 'CF-337 Panther Repeater' }]
 * @param {ParentNode} panel
 * @returns {Map<string, { n: number, size: string, name: string }[]>}
 */
export function bayParts(panel) {
  const out = new Map();
  for (const grp of panel.querySelectorAll('.hgx-grp[data-g]')) {
    out.set(grp.dataset.g, [...grp.querySelectorAll('.hgx-slot')].map((li) => {
      const nm = li.querySelector('.hgx-nm');
      const raw = nm ? [...nm.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : '';
      const m = /^(\d+)× (.+)$/.exec(raw);
      const size = li.querySelector('.hgx-sz')?.textContent.trim() ?? '';
      return { n: m ? Number(m[1]) : 1, size: size === '·' ? '' : size, name: m ? m[2] : raw };
    }));
  }
  return out;
}

const roundTo = (x, digits) => Math.round(x * 10 ** digits) / 10 ** digits;
const withUnit = (s, unit) => (unit ? `${s} ${unit}` : s);

/**
 * Ein Kennwert in Genauigkeit und Einheit des Verzeichnisses, wie die Tafel
 * ihn druckt (src/lib/hangar/catalog.ts formatStat); unbekannt ist der Strich.
 *   figureText(29760, { digits: 0, unit: 'HP' }, 'de-DE') === '29.760 HP'
 * @param {number|null} x @param {{ digits: number, unit: string }} row @param {string} loc
 */
export function figureText(x, row, loc) {
  return x == null ? '–' : withUnit(new Intl.NumberFormat(loc).format(roundTo(x, row.digits)), row.unit);
}

/**
 * Die Klasse eines Schiffs fuer den Rang der Uebersicht: seine erste
 * Unterrolle der Schiffswahl ('kampf:leicht'), mit weniger als min Schiffen
 * seine Groesse, darunter keine (dann steht kein Rang). Klassen kommen aus
 * den Daten der Karten (data-g, data-sz), nie aus Anzeigenamen.
 *   shipClass(dock, 'aegs-gladius') -> { kind: 'grp', key: 'kampf:leicht', ids: [...] }
 * @param {ReadonlyMap<string, { id: string, find: { grp: readonly string[], size: string } }>} ships
 * @param {string} id @param {number} [min]
 * @returns {{ kind: 'grp'|'size', key: string, ids: string[] }|null}
 */
export function shipClass(ships, id, min = 5) {
  const me = ships.get(id);
  if (!me) return null;
  const all = [...ships.values()];
  for (const [kind, key, has] of [['grp', me.find.grp[0], (s) => s.find.grp.includes(me.find.grp[0])], ['size', me.find.size, (s) => s.find.size === me.find.size]]) {
    if (!key) continue;
    const ids = all.filter(has).map((s) => s.id);
    if (ids.length >= min) return { kind, key, ids };
  }
  return null;
}

/**
 * Platz eines Schiffs unter ids fuer einen Kennwert, groesser ist besser;
 * Gleichstand teilt den Platz. Nur Schiffe mit bekanntem Wert zaehlen, unter
 * min von ihnen gibt es keinen Platz.
 *   rankIn(dock, ['a', 'b', 'c', 'd', 'e'], 'b', 'scm') -> { n: 2, of: 5 }
 * @param {ReadonlyMap<string, { stat: Record<string, number|null> }>} ships
 * @param {readonly string[]} ids @param {string} id @param {string} key @param {number} [min]
 * @returns {{ n: number, of: number }|null}
 */
export function rankIn(ships, ids, id, key, min = 5) {
  const x = ships.get(id)?.stat[key];
  if (x == null) return null;
  const vals = ids.map((i) => ships.get(i)?.stat[key]).filter((v) => v != null);
  if (vals.length < min) return null;
  return { n: 1 + vals.filter((v) => v > x).length, of: vals.length };
}

/**
 * Reihenfolge des Docks. 'name' ist die gebaute Namensfolge; ein Kennwert
 * sortiert absteigend, Schiffe ohne den Wert ans Ende, Gleichstand in
 * Namensfolge.
 *   dockOrder([{ id: 'a', stat: { cargo: 46 } }, { id: 'b', stat: { cargo: null } }, { id: 'c', stat: { cargo: 96 } }], 'cargo')
 *   -> ['c', 'a', 'b']
 * @param {ReadonlyArray<{ id: string, stat: Record<string, number|null> }>} ships  in Namensfolge
 * @param {string} key @returns {string[]}
 */
export function dockOrder(ships, key) {
  const rows = ships.map((s, i) => ({ id: s.id, i, v: key === 'name' ? null : s.stat[key] ?? null }));
  if (key !== 'name') rows.sort((a, b) => (a.v === null) - (b.v === null) || (b.v ?? 0) - (a.v ?? 0) || a.i - b.i);
  return rows.map((r) => r.id);
}

/**
 * Zufallsschiff unter den sichtbaren Karten, nie das gezeigte; null, wenn
 * kein anderes sichtbar ist. rnd liefert [0, 1), wie Math.random.
 * @param {readonly string[]} ids @param {string} current @param {() => number} [rnd]
 * @returns {string|null}
 */
export function pickRandom(ids, current, rnd = Math.random) {
  const pool = ids.filter((id) => id !== current);
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}

// ---- Schiffssuche (Krisz 29.10.2026: „man kann ohne manufacturer name oder
// schiff name kaum nach etwas suchen“). Das Vokabular (Zwecke, Unterrollen,
// Groessen, Crew, Hersteller, Spitznamen) baut src/lib/hangar/finder.ts und
// legt es als JSON in #hgx-vocab; hier steht nur, wie gelesen und gesucht wird.

/**
 * Klein, ohne Akzente, ß als ss, Apostrophe weg; dieselbe Faltung wie fold()
 * in src/lib/hangar/finder.ts, mit der data-q gebaut ist (verify-hangar [19]).
 *   fold('  Großer  JÄGER ') === 'grosser jager'
 * @param {string} s
 */
export function fold(s) {
  return String(s ?? '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’`´]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Tippfehler-Abstand (Levenshtein mit Vertauschung benachbarter Zeichen). Er
 * bricht ab, sobald er max sicher uebersteigt, und liefert dann max + 1.
 *   editDistance('prospektor', 'prospector') === 1
 * @param {string} a @param {string} b @param {number} [max]
 */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return Math.min(prev[b.length], max + 1);
}

/** Wie viele Tippfehler ein Wort dieser Laenge haben darf. */
const slack = (n) => (n >= 8 ? 2 : n >= 4 ? 1 : 0);

const amount = (n, unit) => Number(String(n).replace(',', '.')) * (/^(k|tsd)/.test(unit ?? '') ? 1e3 : /^(m|mio|mil)/.test(unit ?? '') ? 1e6 : 1);

/**
 * Liest die Suche. Was das Vokabular kennt (Zweck, Unterrolle, Groesse, Crew,
 * Hersteller) und Zahlen mit Einheit („100 scu“, „unter 2 mio“) werden
 * Treffer einer Art (hits); der Rest bleibt als Woerter fuer Name, Hersteller
 * und Rolle (words). Laengere Wendungen gehen vor („schwerer jäger“ vor
 * „jäger“). Spitznamen werden zum Wort im Namen („cutty“ -> „cutlass“). Ein
 * Treffer behaelt seinen Text (t, gefaltet), damit die Seite ihn als Chip
 * zeigen und wieder aus der Suche nehmen kann.
 *   parseQuery('bergbau solo', vocab)
 *   -> { hits: [{ kind: 'pur', key: 'bergbau', t: 'bergbau' }, { kind: 'crew', key: 'solo', t: 'solo' }], words: [] }
 * @param {string} q
 * @param {{ pur?: {k:string,w:string[]}[], grp?: {k:string,w:string[]}[], size?: {k:string,w:string[]}[], crew?: {k:string,w:string[]}[], maker?: {k:string,w:string[]}[], nick?: Record<string,string> }} vocab
 * @returns {{ hits: { kind: string, key: string|number, t: string }[], words: string[] }}
 */
export function parseQuery(q, vocab) {
  let s = ` ${fold(q)} `;
  const hits = [];
  s = s.replace(/(?:\s(?:ab|uber|ueber|mind|mindestens|min|over|from|at least)\s*|\s|>=?)\s*(\d+(?:[.,]\d+)?)\s*(k|tsd)?\s*\+?\s*scu(?=\s)/g, (m, n, u) => {
    hits.push({ kind: 'cargo', key: amount(n, u), t: m.trim() });
    return ' ';
  });
  s = s.replace(/\s(?:unter|bis|max|maximal|under|below|<=?)\s*(\d+(?:[.,]\d+)?)\s*(k|tsd|m|mio|millionen|million|mil)?\s*(?:auec)?(?=\s)/g, (m, n, u) => {
    // „unter 3“ ohne Einheit meint Millionen: kein Schiff kostet unter 1000 aUEC.
    hits.push({ kind: 'price', key: amount(n, u ?? (Number(n) < 1000 ? 'm' : '')), t: m.trim() });
    return ' ';
  });
  const phrases = [];
  for (const kind of ['grp', 'pur', 'size', 'crew', 'maker']) for (const e of vocab[kind] ?? []) for (const w of e.w) phrases.push({ kind, key: e.k, w: fold(w) });
  phrases.sort((a, b) => b.w.length - a.w.length);
  for (const p of phrases) {
    const at = p.w ? s.indexOf(` ${p.w} `) : -1;
    if (at < 0) continue;
    if (!hits.some((h) => h.kind === p.kind && h.key === p.key)) hits.push({ kind: p.kind, key: p.key, t: p.w });
    s = `${s.slice(0, at)} ${s.slice(at + p.w.length + 1)}`;
  }
  const words = s.split(' ').filter(Boolean).map((w) => fold(vocab.nick?.[w] ?? w));
  return { hits, words };
}

/**
 * Ein Schiff, wie die Suche es liest: Name und Hersteller als gefaltete
 * Woerter (Bindestrich-Teile einzeln dazu, „f7c-m“ trifft „f7c“), data-q als
 * Rollenwoerter beider Sprachen.
 *   findWords('F7C-M Super Hornet', 'Anvil Aerospace', 'jager schwerer')
 *   -> { name: ['f7c-m', 'super', 'hornet', 'f7c', 'm'], makerW: ['anvil', 'aerospace'], tags: ['jager', 'schwerer'], full: 'f7c-m super hornet anvil aerospace' }
 * @param {string} name @param {string} maker @param {string} tags
 */
export function findWords(name, maker, tags) {
  const raw = fold(name).split(' ').filter(Boolean);
  return {
    name: [...new Set([...raw, ...raw.flatMap((w) => w.split(/[-/.]/))])].filter(Boolean),
    makerW: fold(maker).split(' ').filter(Boolean),
    tags: String(tags ?? '').split(' ').filter(Boolean),
    full: fold(`${name} ${maker}`),
  };
}

/**
 * Eine Dock-Karte als Eintrag der Suche: aus ihren Attributen (data-mk,
 * data-q, data-p, data-g, data-sz), dem Namen und den Kennwerten. Dieselbe
 * Abbildung liest verify-hangar [19] aus dem gebauten dist/.
 * @param {{ id: string, name: string, mk?: string, q?: string, p?: string, g?: string, sz?: string }} a
 * @param {Record<string, number|null>} stat
 * @returns {FindShip}
 */
export function findShip(a, stat) {
  const words = (v) => (v ? v.split(' ') : []);
  return { id: a.id, ...findWords(a.name, a.mk ?? '', a.q ?? ''), maker: a.mk ?? '', pur: words(a.p), grp: words(a.g), size: a.sz ?? '', stat };
}

/**
 * Trifft ein Wort ein Schiff, und wie gut? Name vor Hersteller vor Rolle;
 * ganzes Wort vor Wortanfang vor Teilstueck vor Tippfehler. 0 = nein.
 * Tippfehler zaehlen nur mit typos (dockSearch fragt erst ohne).
 *   wordScore('cutlass', findWords('Cutlass Black', 'Drake Interplanetary', ''), false) === 100
 * @param {string} w @param {{ name: string[], makerW: string[], tags: string[], full: string }} ship @param {boolean} [typos]
 */
export function wordScore(w, ship, typos = true) {
  let best = 0;
  const k = slack(w.length);
  for (const [list, whole, start, typo] of [[ship.name, 100, 80, 35], [ship.makerW, 60, 45, 20], [ship.tags, 40, 30, 15]]) {
    for (const x of list) {
      if (x === w) best = Math.max(best, whole);
      else if (x.startsWith(w)) best = Math.max(best, start);
      else if (w.length >= 3 && x.includes(w)) best = Math.max(best, start - 20);
      else if (typos && k && Math.min(editDistance(w, x, k), editDistance(w, x.slice(0, w.length), k)) <= k) best = Math.max(best, typo);
    }
  }
  if (!best && w.length >= 3 && ship.full.includes(w)) best = 40;
  return best;
}

/**
 * Die Treffer des Docks mit ihrer Guete (Id -> Punkte, nur Treffer). Die
 * Filter aus Kacheln und Pillen grenzen hart ein. Treffer der Suche einer Art
 * gelten als „oder“ („klein mittel“), verschiedene Arten als „und“; ein
 * erkanntes Wort zaehlt auch, wenn es im Namen steht („expedition“ findet die
 * Pisces Expedition, auch wenn sie keine Expeditionsrolle hat). Jedes freie
 * Wort muss treffen; Tippfehler zaehlen nur fuer ein Wort, das ohne sie gar
 * nichts traefe (sonst faende „mole“ auch die Mule).
 * @param {ReadonlyArray<FindShip>} ships
 * @param {FindSpec} f
 * @param {Readonly<Record<string, { min: number, max: number|null }>>} crew  Stufen der Crew je Schluessel
 * @returns {Map<string, number>}
 *
 * @typedef {{ id: string, name: string[], makerW: string[], tags: string[], full: string, maker: string,
 *   pur: readonly string[], grp: readonly string[], size: string, stat: Record<string, number|null> }} FindShip
 * @typedef {{ pur?: string, grp?: string, size?: readonly string[], crew?: string, cargo?: number, price?: number,
 *   maker?: string, only?: ReadonlySet<string>|null, hits?: ReturnType<typeof parseQuery>['hits'], words?: readonly string[] }} FindSpec
 */
export function dockSearch(ships, f, crew) {
  const inCrew = (s, k) => {
    const c = crew[k];
    const n = s.stat.crew;
    return !!c && n != null && n >= c.min && (c.max == null || n <= c.max);
  };
  const cargoOk = (s, n) => s.stat.cargo != null && s.stat.cargo >= n;
  const priceOk = (s, n) => s.stat.price != null && s.stat.price <= n;
  const fits = (s, h) => (h.kind === 'pur' ? s.pur.includes(h.key) : h.kind === 'grp' ? s.grp.includes(h.key)
    : h.kind === 'size' ? s.size === h.key : h.kind === 'crew' ? inCrew(s, h.key) : h.kind === 'maker' ? s.maker === h.key
      : h.kind === 'cargo' ? cargoOk(s, h.key) : h.kind === 'price' ? priceOk(s, h.key) : false);
  const named = (s, h) => h.kind !== 'cargo' && h.kind !== 'price' && h.t.split(' ').every((x) => s.name.includes(x));
  const kinds = new Map();
  for (const h of f.hits ?? []) kinds.set(h.kind, [...(kinds.get(h.kind) ?? []), h]);
  const base = [];
  for (const s of ships) {
    if ((f.pur && !s.pur.includes(f.pur)) || (f.grp && !s.grp.includes(f.grp)) || (f.size?.length && !f.size.includes(s.size))
      || (f.crew && !inCrew(s, f.crew)) || (f.cargo && !cargoOk(s, f.cargo)) || (f.price && !priceOk(s, f.price))
      || (f.maker && s.maker !== f.maker) || (f.only && !f.only.has(s.id))) continue;
    let score = 0;
    let ok = true;
    for (const group of kinds.values()) {
      const v = Math.max(...group.map((h) => (named(s, h) ? 100 : fits(s, h) ? 10 : 0)));
      if (!v) { ok = false; break; }
      score += v;
    }
    if (ok) base.push([s, score]);
  }
  const per = (f.words ?? []).map((w) => {
    const exact = base.map(([s]) => wordScore(w, s, false));
    return exact.some(Boolean) ? exact : base.map(([s]) => wordScore(w, s, true));
  });
  const out = new Map();
  base.forEach(([s, score], i) => {
    let sum = score;
    for (const m of per) {
      if (!m[i]) return;
      sum += m[i];
    }
    out.set(s.id, sum);
  });
  return out;
}

// Waechter gegen die Neu-Lade-Schleife der Buehne (Krisz, 12.11.2026: „Auf
// dem Handy laedt es die ganze Zeit neu“). Die Halle kann ein Geraet
// ueberfordern: Der Browser nimmt der Seite dann den Zeichenkontext oder
// beendet sie und laedt sie neu, und der naechste Lauf endet genauso. Bis
// dahin lud die Seite nach jedem verlorenen Kontext von selbst neu, in
// derselben Stufe.
//
// Ein Abbruch ist: der Zeichenkontext geht verloren, oder die Seite startet,
// waehrend ihr voriger Lauf in dieser Registerkarte noch als offen vermerkt
// ist (sie wurde weder verlassen noch in den Hintergrund gelegt). Der erste
// Abbruch wird nur vermerkt, er kann Zufall sein (Treiber zurueckgesetzt,
// Browser abgestuerzt). Der zweite binnen WAECHTER.zweimal senkt den Deckel
// eine Stufe unter die, die lief; jeder weitere in der Frist wieder eine.
// Unter 'niedrig' steht 'aus': die Seite startet die Buehne nicht mehr und
// bietet einen Knopf an. So endet jede Schleife nach hoechstens vier
// Laeufen. Der Deckel gilt WAECHTER.deckel lang auf diesem Geraet; wer im
// Grafik-Schalter eine Stufe waehlt, hebt ihn auf.
//
// Wird die Halle spuerbar leichter, WAECHTER.v erhoehen: alte Deckel
// verfallen dann sofort.
//
// Seit 13.11.2026 (Krisz: „Das Handy versucht es immer noch die ganze Zeit
// zu laden und iwann kommt die Meldung“), v 2:
// - Am Telefon senkt schon der erste Abbruch (sofort). Dort beendet der
//   Browser eine Seite im Vordergrund so gut wie nur aus Speichernot, und
//   jeder Lauf, der nur zaehlt, ist eine halbe Minute Warten fuer nichts.
//   Eine Schleife endet dort nach hoechstens drei Laeufen.
// - Der Stand fuehrt eine Spur der letzten Abbrueche: Stufe, wie weit der
//   Lauf war (WAECHTER.phasen) und was abbrach (WAECHTER.arten: die Seite
//   wurde beendet oder der Zeichenkontext ging verloren). Die Meldung zeigt
//   sie als Zeile (waechterVerlauf). Vom Telefon kommt sonst nichts zurueck,
//   keine Konsole, kein Protokoll, und ohne sie laesst sich von aussen nicht
//   sagen, ob das Laden oder das Stehen das Geraet ueberfordert.
export const WAECHTER = { v: 2, stufen: ['niedrig', 'mittel', 'hoch'], zweimal: 30 * 60e3, frisch: 30 * 60e3, puls: 5 * 60e3, deckel: 30 * 864e5, spur: 6, phasen: ['laden', 'bauen', 'steht'], arten: ['seite', 'kontext'] };
const DECKEL = ['aus', ...WAECHTER.stufen];
const istZeit = (t, now, frist) => Number.isFinite(t) && t <= now && now - t < frist;
const eins = (liste, x) => (liste.includes(x) ? x : null);
// Ein Eintrag der Spur: t wann, s Stufe, p Phase, w was abbrach; Unbekanntes wird null
const spurEintrag = (e, now) => (e && typeof e === 'object' && istZeit(e.t, now, WAECHTER.deckel)
  ? { t: e.t, s: eins(WAECHTER.stufen, e.s), p: eins(WAECHTER.phasen, e.p), w: eins(WAECHTER.arten, e.w) }
  : null);
const spurVon = (liste, now) => (Array.isArray(liste) ? liste : []).map((e) => spurEintrag(e, now)).filter(Boolean).slice(-WAECHTER.spur);

/**
 * Gemerkter Stand aus dem Speicher des Geraets, Abgelaufenes und Kaputtes
 * faellt weg. ab: Zeit des letzten Abbruchs in der Frist oder null; deckel:
 * 'mittel' | 'niedrig' | 'aus' oder null, seit: seit wann; spur: die letzten
 * Abbrueche (sie lebt mit dem Stand: ohne Abbruch in der Frist und ohne
 * Deckel ist sie leer).
 * @param {string|null} raw
 * @param {number} now
 */
export function waechterStand(raw, now) {
  const leer = { ab: null, deckel: null, seit: 0, spur: [] };
  let o = null;
  try { o = JSON.parse(raw ?? 'null'); } catch { return leer; }
  if (!o || typeof o !== 'object' || o.v !== WAECHTER.v) return leer;
  const deckel = DECKEL.indexOf(o.deckel) >= 0 && o.deckel !== 'hoch' && istZeit(o.seit, now, WAECHTER.deckel);
  const ab = istZeit(o.ab, now, WAECHTER.zweimal) ? o.ab : null;
  return { ab, deckel: deckel ? o.deckel : null, seit: deckel ? o.seit : 0, spur: ab !== null || deckel ? spurVon(o.spur, now) : [] };
}

/**
 * Stand nach einem Abbruch. stufe: in welcher Stufe der abgebrochene Lauf
 * geladen hatte; null, wenn er abbrach, bevor sie feststand (dann gilt der
 * Deckel, ohne Deckel die hoechste). was.sofort: schon der erste Abbruch
 * senkt (Telefon); was.phase und was.wie gehen in die Spur.
 * @param {{ ab: number|null, deckel: string|null, seit: number, spur?: object[] }} stand
 * @param {number} now
 * @param {string|null} stufe
 * @param {{ sofort?: boolean, phase?: string|null, wie?: string|null }} [was]
 */
export function waechterAbbruch(stand, now, stufe, { sofort = false, phase = null, wie = null } = {}) {
  const spur = [...spurVon(stand.spur, now), spurEintrag({ t: now, s: stufe, p: phase, w: wie }, now)].slice(-WAECHTER.spur);
  if (stand.ab === null && !sofort) return { ...stand, ab: now, spur };
  const lief = WAECHTER.stufen.includes(stufe) ? stufe : stand.deckel && stand.deckel !== 'aus' ? stand.deckel : 'hoch';
  const tiefer = DECKEL[Math.max(0, DECKEL.indexOf(lief) - 1)];
  // nie nach oben: ein Deckel unter der gelaufenen Stufe bleibt
  const deckel = stand.deckel && DECKEL.indexOf(stand.deckel) < DECKEL.indexOf(tiefer) ? stand.deckel : tiefer;
  return { ab: now, deckel, seit: now, spur };
}

/** @param {{ ab: number|null, deckel: string|null, seit: number, spur?: object[] }} stand */
export const waechterText = (stand) => JSON.stringify({ v: WAECHTER.v, ab: stand.ab, deckel: stand.deckel, seit: stand.seit, spur: stand.spur ?? [] });

/**
 * Die Spur als Zeilen fuer die Meldung, eine je Abbruch, aelteste zuerst:
 * „Hoch, beim Aufbau der Halle, Seite beendet“. wort(k) gibt das Wort der
 * Seite zu einer Stufe, Phase oder Art, '' wenn sie keins hat; Unbekanntes
 * faellt aus der Zeile.
 * @param {object[]} spur
 * @param {(k: string) => string} wort
 */
export const waechterVerlauf = (spur, wort) => (spur ?? [])
  .map((e) => [e.s, e.p, e.w].map((k) => (k ? wort(k) : '')).filter(Boolean).join(', '))
  .filter(Boolean);

/**
 * Der Vermerk „Lauf offen“ einer Registerkarte: { id, stufe, phase } oder
 * null, wenn keiner da ist, er kaputt ist, aelter als WAECHTER.frisch (dann
 * liegt der Lauf zu lange zurueck, um an der Halle zu haengen) oder von
 * einer anderen Fassung des Waechters stammt (v): Ein Lauf der schwereren
 * Halle von vorher darf der neuen keinen Deckel setzen, am Telefon senkt
 * schon der erste Abbruch. phase: wie weit der Lauf war, null bei einem
 * Vermerk ohne.
 * @param {string|null} raw
 * @param {number} now
 */
export function waechterOffen(raw, now) {
  let o = null;
  try { o = JSON.parse(raw ?? 'null'); } catch { return null; }
  if (!o || typeof o !== 'object' || o.v !== WAECHTER.v || typeof o.id !== 'string' || !o.id || !istZeit(o.t, now, WAECHTER.frisch)) return null;
  return { id: o.id, stufe: eins(WAECHTER.stufen, o.stufe), phase: eins(WAECHTER.phasen, o.phase) };
}

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
  // Die hoefliche Live-Region (#hgx-live). Derselbe Satz zweimal hintereinander
  // aendert sonst nichts im DOM und bliebe stumm; das angehaengte geschuetzte
  // Leerzeichen macht ihn zur Aenderung.
  const say = (text) => { live.textContent = live.textContent === text ? `${text}\u00a0` : text; };

  const opts = (f) => [...doc.querySelectorAll(`.hgx-opt[data-f="${f}"]`)].map((b) => b.dataset.v);
  /** @type {StateContext} */
  const ctx = {
    ids: new Set(items.map((li) => li.dataset.id)),
    defaultShip: main.dataset.defaultShip,
    tabs: tabs.map((b) => b.dataset.tab),
    sorts: [...$('hgx-sort').options].map((o) => o.value),
    purs: new Set(opts('pur')),
    grps: new Set([...doc.querySelectorAll('#hgx-subs [data-of]')].map((b) => `${b.dataset.of}:${b.dataset.grp}`)),
    sizes: opts('size'),
    crews: new Set(opts('crew')),
    cargos: new Set(opts('cargo').map(Number)),
    prices: new Set(opts('price').map(Number)),
    makers: new Set(opts('maker')),
    // Bodenfahrzeuge stehen in der Werkhalle (StageConfig.models, Ort)
    werk: new Set(Object.keys(stageCfg.models).filter((id) => stageCfg.models[id][3] === 'werk')),
  };

  // Die Dock-Karten tragen die Zahlen fuer Flotte, Vergleich und Sortierung
  // und die Woerter der Suche; einmal gelesen, danach nur noch diese Abbildung.
  const statKeys = strip.dataset.stats.split(' ');
  const words = (v) => (v ? v.split(' ') : []);
  const dock = new Map(items.map((li) => {
    const name = li.querySelector('.hg-card__n').textContent;
    const stat = figuresOf(statKeys, li.dataset.v);
    const fp = words(li.dataset.fp).map(Number);
    const find = findShip({ ...li.dataset, name }, stat);
    return [li.dataset.id, { id: li.dataset.id, li, name, fam: words(li.dataset.fam), stat, find, fp: fp.length === 2 ? { w: fp[0], l: fp[1] } : null }];
  }));
  const pool = [...dock.values()].map((s) => s.find);

  // Leistungsstufe von Hand: ?grafik=hoch|mittel|niedrig (auto = Automatik)
  // oder die gemerkte Wahl aus dem Grafik-Schalter der Buehne
  const GRAFIK_KEY = 'hg-grafik';
  function grafikWahl() {
    const q = new URLSearchParams(location.search).get('grafik');
    if (q) return q === 'auto' ? null : q;
    try { return localStorage.getItem(GRAFIK_KEY); } catch { return null; }
  }
  // Jetzt lesen: writeUrl() schreibt die Adresse aus dem Zustand neu,
  // ohne ?grafik=
  const GRAFIK = grafikWahl();
  // Feldboden zum Vergleich: ?boden=beton, ?boden=asphalt oder ?boden=lack
  // statt des gewaehlten (WORK_PAD im Viewer). Anders als ?grafik= bleibt
  // er in der Adresse (urlOf), damit Neuladen und Kopieren ihn behalten.
  const BODEN = new URLSearchParams(location.search).get('boden');
  let state = parseState(location.search, location.hash, ctx);

  // Auf- und Zuklappen des Docks. Gemerkt wird nur der Klick auf den Schalter
  // (das Inline-Skript in HangarPage.astro liest ihn vor dem ersten Bild). Ein
  // Filter klappt es ohne Merken auf: zugeklappt lenkte er die Pfeiltasten
  // und den Zufall, ohne dass man ihn sieht.
  const DOCK_KEY = 'hg-dock';
  const dockTog = $('hgx-docktog');
  const narrowed = () => !!(state.q || state.pur || state.size.length || state.crew || state.cargo || state.price || state.maker);
  const filtered = () => narrowed() || state.fleetOnly;
  function setDock(open, remember) {
    const was = main.dataset.dock !== 'closed';
    main.dataset.dock = open ? 'open' : 'closed';
    dockTog.setAttribute('aria-expanded', String(open));
    if (!open && was) hideQv();
    if (!remember) return;
    try {
      if (open) localStorage.setItem(DOCK_KEY, 'open');
      else localStorage.removeItem(DOCK_KEY);
    } catch { /* ohne Speicher gilt die Wahl bis zum Neuladen */ }
  }
  dockTog.addEventListener('click', () => setDock(main.dataset.dock === 'closed', true));

  // Markiert den Verlaufseintrag, den das Oeffnen des Vergleichs anlegt:
  // Schliessen geht dorthin zurueck, statt einen zweiten Eintrag zu stapeln.
  const CMP_ENTRY = 'hgx-cmp';
  // Nur ein Eintrag, den DIESES Dokument anlegte, wird per back() verlassen:
  // nach einem Neuladen gehoert der Eintrag davor zum alten Dokument, back()
  // laedt dann neu und verwirft, was im Dialog geaendert wurde.
  let pushedHere = false;
  const urlOf = (s) => {
    const q = serializeState(s, ctx);
    return `${location.pathname}${BODEN ? `${q ? `${q}&` : '?'}boden=${encodeURIComponent(BODEN)}` : q}`;
  };

  // Die Adresse folgt dem Zustand, so gut es geht: WebKit wirft nach 100
  // replaceState-Aufrufen in 10 s. Die Seite steht dann trotzdem richtig, nur
  // die Adresse hinkt nach. Tippen in der Suche schreibt sie erst nach einer Pause.
  const URL_PAUSE_MS = 400;
  let urlTimer = 0;
  function writeUrl(push = false) {
    clearTimeout(urlTimer);
    const url = urlOf(state);
    try {
      if (push) {
        history.pushState(CMP_ENTRY, '', url);
        pushedHere = true;
      } else if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url);
    } catch { /* siehe oben */ }
  }

  /**
   * Zustand aendern. push legt einen Verlaufseintrag an; das tut nur das
   * Oeffnen des Vergleichs, damit Zurueck ihn schliesst.
   * @param {Partial<HangarState>} patch @param {boolean} [push]
   */
  function setState(patch, push = false) {
    // Ein Layout gehoert zu seinem Schiff: wer das Schiff wechselt, beginnt dort mit der Serie.
    if (patch.ship && patch.ship !== state.ship && !('lo' in patch)) patch = { ...patch, lo: null };
    // Wer im Leitstand ein anderes Schiff waehlt, will es sehen: zurueck aufs Feld
    if (patch.ship && patch.ship !== state.ship && !('ort' in patch)) patch = { ...patch, ort: 'halle' };
    commit(normalize({ ...state, ...patch }, ctx), push ? 'push' : 'replace');
  }
  /**
   * Der einzige Schreiber des Zustands: erst zeichnen, dann die Adresse. Ein
   * Wurf beim Schreiben der Adresse laesst so keinen Zustand ohne Bild zurueck.
   * 'keep' laesst die Adresse, wie sie ist (popstate hat sie schon gesetzt).
   * @param {HangarState} next @param {'push'|'replace'|'keep'} how
   */
  function commit(next, how) {
    const prev = state;
    state = next;
    render(prev);
    if (how === 'keep') return;
    if (how === 'replace' && prev.q !== state.q) {
      clearTimeout(urlTimer);
      urlTimer = setTimeout(writeUrl, URL_PAUSE_MS);
    } else writeUrl(how === 'push');
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
    const finding = ['q', 'pur', 'grp', 'crew', 'cargo', 'price', 'maker', 'fleetOnly'].some((k) => prev[k] !== state[k]) || prev.size.join() !== state.size.join();
    if (finding) {
      applyDock();
      if (filtered()) setDock(true, false);
      // Neue Treffer beginnen oben.
      rail.scrollTop = 0;
    } else if (prev.sort !== state.sort) applySort();
    if (prev.ship !== state.ship && !finding) paintRandom();
    const cmpChanged = prev.cmp.join() !== state.cmp.join();
    if (prev.ship !== state.ship) rememberPlace();
    if (prev.lo !== state.lo || prev.ship !== state.ship || prev.tab !== state.tab || prev.hp !== state.hp || prev.station !== state.station || prev.flat !== state.flat || prev.ort !== state.ort) paintStation();
    else if (cmpChanged) paintHolo();
    // Bei einem Wechsel des Schiffs holt die Buehne die Kamera selbst zurueck (viewer.show)
    if (prev.ort !== state.ort && prev.ship === state.ship) applyOrt();
    if (cmpChanged || prev.ship !== state.ship) paintTray();
    if (prev.view !== state.view || (cmpChanged && state.view === 'compare')) paintView();
  }

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
        // Auf staging leitet das Testpilot-Tor auf seine eigene Seite um.
        if (!r.ok || r.redirected) throw new Error(`Bucht ${id}: HTTP ${r.status}${r.redirected ? ' nach Umleitung' : ''}`);
        return r.text();
      })
      .then((html) => {
        const d = new DOMParser().parseFromString(html, 'text/html');
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

  function showShip(id) {
    markCards(id);
    modelErr.hidden = true;
    meldungPlatz();
    viewerShow(id);
    showBay(id);
  }

  let selTok = 0;
  async function showBay(id) {
    const my = ++selTok;
    bayErr.hidden = true;
    // Erst nach 150 ms dimmen: ein Treffer im Cache soll nicht flackern. Der
    // Zeitgeber eines ueberholten Abrufs dimmt nichts mehr; sein finally
    // nimmt das Dimmen nicht zurueck, das gehoert dem neuen.
    const busy = setTimeout(() => { if (my === selTok) setBusy(true); }, 150);
    try {
      const regions = await loadBay(id);
      if (my !== selTok) return;
      for (const name of REGIONS) regionNow(name).replaceWith(doc.importNode(regions[name], true));
      // der neue Titel kann hoeher sein als der alte: Platz einer sichtbaren Meldung nachmessen
      meldungPlatz();
      applyTab();
      syncMarks();
      applyHp();
      title.classList.remove('is-swap');
      void title.offsetWidth;
      title.classList.add('is-swap');
      viewer?.label?.(id, labelOf(id));
      say(regionNow('head').dataset.announce);
      paintHolo();
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
    viewer?.label?.(id, labelOf(id));
    regionNow('panel').hidden = true;
    bayErr.hidden = false;
    meldungPlatz();
  }
  // Nur die Bucht: das Modell steht, seine Einfahrt soll nicht noch einmal laufen.
  $('hgx-bayretry').addEventListener('click', () => showBay(state.ship));

  // Tabs nach dem WAI-ARIA-Muster: Pfeile, Pos1 und Ende wechseln, nur der
  // gewaehlte Tab steht in der Tab-Folge.
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

  // hp ist der Port, den die geoeffnete Zeile meint. Traegt ein Port mehrere
  // Items, oeffnen alle Zeilen, die ihn fuehren: der Hardpoint traegt sie alle.
  function applyHp() {
    // Ob die Bucht den Hardpoint kennt, sagt erst die Bucht dieses Schiffs; bis
    // sie da ist, steht noch die des vorigen.
    if (regionNow('panel').dataset.id !== state.ship) return;
    const panel = $(`hgx-tp-${state.tab}`);
    const rows = [...host.querySelectorAll('.hgx-slot')];
    const open = new Set(state.hp ? rows.filter((li) => li.closest('[role="tabpanel"]') === panel && li.dataset.ports.split(' ').includes(state.hp)) : []);
    if (state.hp && !open.size) {
      setState({ hp: null });
      return;
    }
    for (const li of rows) {
      li.querySelector('.hgx-slot__btn').setAttribute('aria-expanded', String(open.has(li)));
      li.querySelector('.hgx-d').hidden = !open.has(li);
    }
    for (const el of regionNow('marks').querySelectorAll('.hgx-mk')) {
      el.classList.toggle('is-sel', !!state.hp && el.dataset.port === state.hp && el.dataset.tab === state.tab);
    }
    if (open.size) revealOpenRow();
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
  function portFor(li, tab = state.tab) {
    const ports = li.dataset.ports.split(' ');
    const marked = new Set([...regionNow('marks').querySelectorAll(`.hgx-mk[data-tab="${tab}"]`)].map((el) => el.dataset.port));
    return ports.find((p) => marked.has(p)) ?? ports[0];
  }
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('.hgx-slot__btn');
    if (!btn) return;
    setState({ hp: btn.getAttribute('aria-expanded') === 'true' ? null : portFor(btn.closest('.hgx-slot')) });
  });

  // HTML ueber der Leinwand, im Slot der Buehne (Region marks). Sie leben erst,
  // wenn BEIDES zum gewaehlten Schiff gehoert: das Modell steht (show() genau
  // dieser Auswahl ist fertig) und die Region ist eingesetzt. Sonst saessen
  // Punkte des alten Schiffs auf dem neuen.
  let placed = null;
  let pins = null;
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
    // gleich setzen: In der Ruhe (20 s ohne Eingabe) zeichnet der Viewer kein Bild, das es täte
    placeMarks();
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

  // Keine Kamerafahrt zum gewaehlten Hardpoint (Krisz, 2026-10-18: keine
  // automatische Kameradrehung): hp hebt nur seinen Marker hervor (is-sel),
  // die Kamera bewegt allein, wer sie zieht. viewer.focus() bleibt Teil der
  // Naht, die Oberflaeche ruft es nicht mehr.

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
  // Bei offenem Vergleich gehoert Escape dem Dialog (cancel), nicht dem Hardpoint.
  doc.defaultView.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.hp && !e.defaultPrevented && !dlg.open) setState({ hp: null });
  });

  const cardOf = (id) => strip.querySelector(`.hg-card[data-id="${CSS.escape(id)}"]`);
  // Titelblock als Hologramm ueber dem Fahrzeug (hangar-viewer.js, buildHolo):
  // der Text aus der Bucht, solange sie noch laedt Name und Hersteller von
  // der Dock-Karte. Oben das Herstellerlogo (opts.logos je Kuerzel, aus
  // HangarApp.astro) statt der Seitenueberschrift (Krisz 25.10.2026: „HANGAR“
  // kann raus)
  const logoOf = (id) => stageCfg.opts?.logos?.[stageCfg.models[id]?.[2]] ?? null;
  function labelOf(id) {
    const head = regionNow('head');
    if (head?.dataset.id === id) {
      const txt = (sel) => head.querySelector(sel)?.textContent.trim() ?? '';
      return { logo: logoOf(id), maker: txt('.hg-maker'), name: txt('.hg-name'), role: txt('.hg-role') };
    }
    const card = cardOf(id);
    return { logo: logoOf(id), maker: card?.querySelector('small')?.textContent.trim() ?? '', name: card?.querySelector('span')?.textContent.trim() ?? id, role: '' };
  }
  // In der Folge des Docks, also der Sortierung: Pfeile und Vorabruf folgen ihr.
  const visibleIds = () => [...strip.children].filter((li) => !li.hidden).map((li) => li.dataset.id);
  const visibleCards = () => [...strip.children].filter((li) => !li.hidden).map((li) => li.firstElementChild);

  function markCards(id) {
    for (const a of strip.querySelectorAll('.hg-card')) a.setAttribute('aria-current', a.dataset.id === id ? 'true' : 'false');
  }
  // Die Liste rollt in der Rolle des Docks (ab 761 px die Spalte links,
  // schmal ein Kasten unter der Tafel). Gerollt wird nur, wenn die Zeile
  // nicht ohnehin zu sehen ist, und nie unter den klebenden Kopf der Liste.
  const rail = $('hg-rail');
  function scrollToCard(id, behavior = reduce ? 'auto' : 'smooth') {
    const li = cardOf(id)?.parentElement;
    if (!li || li.hidden || !rail.clientHeight || rail.scrollHeight <= rail.clientHeight) return;
    const head = rail.querySelector('.hgx-listhead').offsetHeight;
    const top = li.offsetTop;
    const bottom = top + li.offsetHeight;
    if (top < rail.scrollTop + head) rail.scrollTo({ top: top - head - 6, behavior });
    else if (bottom > rail.scrollTop + rail.clientHeight) rail.scrollTo({ top: bottom - rail.clientHeight + 6, behavior });
  }
  function select(id, { scroll = true } = {}) {
    if (scroll) scrollToCard(id);
    hideQv();
    setState({ ship: id, hp: null });
  }
  function step(d) {
    const ids = visibleIds();
    if (!ids.length) return;
    const i = ids.indexOf(state.ship);
    select(ids[(i < 0 ? 0 : i + d + ids.length) % ids.length]);
  }

  // ---- Suche, Zweck und Filter -------------------------------------------
  const vocab = JSON.parse($('hgx-vocab').textContent);
  const crewDefs = Object.fromEntries(vocab.crew.map((c) => [c.k, c]));
  const nf = new Intl.NumberFormat(loc);
  const compact = new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 });
  let parsed = { q: null, hits: [], words: [] };
  const parse = () => {
    if (parsed.q !== state.q) parsed = { q: state.q, ...parseQuery(state.q, vocab) };
    return parsed;
  };
  /** Die Suche, wie der Zustand sie verlangt; over ersetzt einzelne Filter (fuer die Zahlen an Kacheln und Stufen). */
  const specOf = (over = {}) => {
    const p = parse();
    return {
      pur: state.pur, grp: state.grp ? `${state.pur}:${state.grp}` : '', size: state.size, crew: state.crew, cargo: state.cargo,
      price: state.price, maker: state.maker, only: state.fleetOnly ? fleetIds : null, hits: p.hits, words: p.words, ...over,
    };
  };
  const countOf = (over) => dockSearch(pool, specOf(over), crewDefs).size;
  let scores = new Map();

  function applyDock() {
    scores = dockSearch(pool, specOf(), crewDefs);
    for (const li of items) li.hidden = !scores.has(li.dataset.id);
    const n = scores.size;
    $('hg-count').textContent = fillMessage(msg('count'), { n }, loc);
    // Leer, weil die Flotte leer ist, sagt etwas anderes als ein zu enger Filter.
    const noFleet = state.fleetOnly && fleetSummary(fleetIds, dock).n === 0;
    $('hgx-empty-fleet').hidden = !noFleet;
    $('hg-empty').hidden = n > 0 || noFleet;
    applySort();
    paintFind();
    paintRandom();
  }

  // Die Karten wandern im DOM. Mit Suchwoertern und der Vorgabe 'name' stehen
  // die besten Treffer oben (die Option heisst dann „Beste Treffer“); nach
  // einem Kennwert sortiert traegt jede Karte ihren Wert (data-sv), damit
  // die Folge sich selbst erklaert.
  const sortSel = $('hgx-sort');
  function applySort() {
    const key = state.sort;
    const row = key === 'name' ? null : rowOf.get(key);
    let order = dockOrder(items.map((li) => dock.get(li.dataset.id)), key);
    const best = key === 'name' && !!state.q;
    if (best) {
      const at = new Map(order.map((id, i) => [id, i]));
      order = [...order].sort((a, b) => (scores.get(b) ?? -1) - (scores.get(a) ?? -1) || at.get(a) - at.get(b));
    }
    strip.append(...order.map((id) => dock.get(id).li));
    for (const s of dock.values()) {
      const v = row ? s.stat[key] : null;
      if (v == null) delete s.li.firstElementChild.dataset.sv;
      else s.li.firstElementChild.dataset.sv = figureText(v, row, loc);
    }
    const first = sortSel.options[0];
    first.textContent = best ? first.dataset.best : first.dataset.name;
  }

  const subs = $('hgx-subs');
  const subBtns = [...subs.querySelectorAll('[data-grp]')];
  const pills = [...doc.querySelectorAll('.hgx-pill')];
  const pops = [...doc.querySelectorAll('.hgx-pop')];
  const optBtns = [...doc.querySelectorAll('.hgx-opt')];
  const listTitle = $('hgx-listtitle');
  const listAll = listTitle.textContent;
  const optLabel = (f, v) => optBtns.find((b) => b.dataset.f === f && b.dataset.v === String(v))?.querySelector('span').textContent ?? String(v);
  const vocabLabel = (kind, key) => vocab[kind]?.find((e) => e.k === key)?.l ?? String(key);
  const hitLabel = (h) => {
    const m = msg('find');
    if (h.kind === 'cargo') return fillMessage({ other: m.cargo }, { n: nf.format(h.key) }, loc);
    if (h.kind === 'price') return fillMessage({ other: m.price }, { n: compact.format(h.key) }, loc);
    return vocabLabel(h.kind, h.key);
  };
  const facetValue = (f) => (f === 'size' ? state.size : state[f]);
  const facetOn = (f) => (f === 'size' ? state.size.length > 0 : !!state[f]);

  /**
   * Nimmt einen erkannten Begriff aus der Suche, im Wortlaut des Besuchers:
   * gesucht wird die Wortfolge, deren Faltung der Begriff ist.
   */
  function dropFromQuery(t) {
    const raw = state.q.split(/\s+/).filter(Boolean);
    const want = t.split(' ').length;
    for (let i = 0; i + want <= raw.length; i++) {
      if (fold(raw.slice(i, i + want).join(' ')) === t) return [...raw.slice(0, i), ...raw.slice(i + want)].join(' ');
    }
    return fold(state.q).replace(t, ' ').replace(/\s+/g, ' ').trim();
  }

  // Chips, Unterrollen, Pillen und Titel der Liste aus dem Zustand.
  function paintFind() {
    const m = msg('find');
    const p = parse();
    const chips = [];
    for (const h of p.hits) {
      const name = hitLabel(h);
      chips.push(el('li', {}, name, el('button', { type: 'button', class: 'hgx-x', 'data-drop': 'q', 'data-t': h.t, 'aria-label': fillMessage({ other: m.remove }, { name }, loc) }, '×')));
    }
    $('hgx-active-list').replaceChildren(...chips);
    const facets = pills.some((b) => facetOn(b.dataset.facet));
    $('hgx-active').hidden = !chips.length && !facets && !state.q;
    const ofPur = subBtns.filter((b) => b.dataset.of === state.pur);
    subs.hidden = !ofPur.length;
    if (!subs.hidden) {
      for (const b of subBtns) {
        b.hidden = !!b.dataset.of && b.dataset.of !== state.pur;
        if (b.hidden) continue;
        b.setAttribute('aria-pressed', String(b.dataset.grp === state.grp));
        b.querySelector('.hgx-n').textContent = nf.format(countOf({ grp: b.dataset.grp ? `${state.pur}:${b.dataset.grp}` : '' }));
      }
    }
    for (const b of pills) {
      const f = b.dataset.facet;
      const on = facetOn(f);
      b.classList.toggle('is-on', on);
      const pv = b.querySelector('.hgx-pv');
      pv.hidden = !on;
      pv.textContent = on ? (f === 'size' ? state.size.map((z) => optLabel('size', z)).join(', ') : optLabel(f, state[f])) : '';
    }
    for (const b of optBtns) {
      const v = facetValue(b.dataset.f);
      b.setAttribute('aria-pressed', String(Array.isArray(v) ? v.includes(b.dataset.v) : String(v) === b.dataset.v));
    }
    const open = pops.find((x) => !x.hidden);
    if (open) countOpts(open);
    listTitle.textContent = narrowed() || state.fleetOnly ? fillMessage(msg('find-hits'), { n: scores.size }, loc) : listAll;
  }

  // Die Zahl je Stufe: wie viele Schiffe blieben, gaelte statt der Wahl
  // dieser Pille diese Stufe.
  function countOpts(pop) {
    const f = pop.dataset.facet;
    for (const b of pop.querySelectorAll('.hgx-opt')) {
      const v = b.dataset.v;
      const n = countOf({ [f]: f === 'size' ? [v] : f === 'cargo' || f === 'price' ? Number(v) : v, ...(f === 'pur' && { grp: '' }) });
      b.querySelector('.hgx-n').textContent = nf.format(n);
      b.classList.toggle('is-zero', n === 0);
    }
  }
  function openPop(f) {
    for (const pop of pops) {
      const on = pop.dataset.facet === f && pop.hidden;
      if (on) countOpts(pop);
      pop.hidden = !on;
    }
    for (const b of pills) b.setAttribute('aria-expanded', String(!pops.find((x) => x.dataset.facet === b.dataset.facet).hidden));
  }
  for (const b of pills) b.addEventListener('click', () => openPop(b.dataset.facet));
  for (const b of optBtns) b.addEventListener('click', () => {
    const f = b.dataset.f;
    const v = b.dataset.v;
    if (f === 'size') {
      setState({ size: state.size.includes(v) ? state.size.filter((z) => z !== v) : [...state.size, v] });
      return;
    }
    const now = String(state[f]) === v;
    // Ein neuer Zweck beginnt ohne Unterrolle.
    setState({ [f]: now ? (f === 'cargo' || f === 'price' ? 0 : '') : f === 'cargo' || f === 'price' ? Number(v) : v, ...(f === 'pur' && { grp: '' }) });
    openPop(null);
    $(`hgx-pill-${f}`).focus({ preventScroll: true });
  });
  // Zu geht eine Tafel mit Escape, einem Klick daneben oder dem Fokus woanders.
  doc.addEventListener('pointerdown', (e) => {
    if (!e.target.closest?.('.hgx-pop, .hgx-pill')) openPop(null);
  });
  $('hgx-active').parentElement.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = pops.find((x) => !x.hidden);
    if (!open) return;
    e.preventDefault();
    openPop(null);
    $(`hgx-pill-${open.dataset.facet}`).focus({ preventScroll: true });
  });
  $('hgx-active').parentElement.addEventListener('focusout', (e) => {
    if (!e.relatedTarget?.closest?.('.hgx-find')) openPop(null);
  });

  $('hgx-active-list').addEventListener('click', (e) => {
    const x = e.target.closest('[data-drop]');
    if (!x) return;
    setState({ q: dropFromQuery(x.dataset.t) });
    $('hg-q').value = state.q;
    $('hg-q').focus({ preventScroll: true });
  });
  $('hgx-reset').addEventListener('click', () => {
    setState({ q: '', pur: '', grp: '', size: [], crew: '', cargo: 0, price: 0, maker: '' });
    $('hg-q').value = '';
    openPop(null);
    $('hg-q').focus({ preventScroll: true });
  });
  for (const b of subBtns) b.addEventListener('click', () => {
    setState({ grp: b.dataset.grp });
    b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  });

  // ---- Schnellansicht (ab 761 px, nur mit Maus oder Tastatur) ------------
  // Zeigt das Schiff unter der Maus oder dem Fokus der Liste neben dem Dock:
  // Kennzahlen mit der Abweichung zum Schiff in der Halle und beide
  // Draufsichten im selben Massstab. Ein Wechsel in der Halle dauert
  // Sekunden; ansehen kostet hier nichts. Mit der Maus traegt die Karte
  // „In die Halle“, „+ Vergleich“ und den Stern der Flotte.
  const qv = $('hgx-qv');
  const qvWide = window.matchMedia('(min-width: 761px)');
  const dockEl = main.querySelector('.hg-dock');
  let qvId = null;
  let qvAnchor = null;
  let qvTimer = 0;
  const topSrc = (id) => {
    const src = dock.get(id).li.querySelector('img')?.getAttribute('src') ?? '';
    return /\/hangar\/cards\/[^/?]+\.webp/.test(src) ? src.replace('/hangar/cards/', '/hangar/cards/top/') : null;
  };
  // Knoepfe der Karte; den Stern zeichnet fleet.js nach data-fleet-ship.
  function paintQvActs() {
    if (!qvId) return;
    const go = qv.querySelector('[data-qv="go"]');
    go.disabled = qvId === state.ship;
    qv.querySelector('[data-qv="cmp"]').setAttribute('aria-pressed', String(state.cmp.includes(qvId)));
    const fav = qv.querySelector('[data-fleet-ship]');
    fav.dataset.fleetLabel = dock.get(qvId).name;
    fav.dataset.fleetShip = qvId;
  }
  function fillQv(id) {
    const s = dock.get(id);
    const hall = dock.get(state.ship);
    paintQvActs();
    qv.querySelector('.hgx-qv__pic').src = s.li.querySelector('img')?.getAttribute('src') ?? '';
    qv.querySelector('.hgx-qv__maker').textContent = s.li.querySelector('small').textContent;
    qv.querySelector('.hgx-qv__name').textContent = s.name;
    qv.querySelector('.hgx-qv__role').textContent = s.li.querySelector('.hg-card__s em')?.textContent ?? '';
    for (const box of qv.querySelectorAll('.hgx-qv__figs [data-k]')) {
      const k = box.dataset.k;
      const row = rowOf.get(k);
      const cell = compareCell(s.stat[k] ?? null, id === state.ship ? null : hall.stat[k] ?? null, row, loc);
      const b = box.querySelector('b');
      b.textContent = cell.value;
      // Preise kurz: „8,4 Mio.“ mit kleiner Einheit passt in die Spalte,
      // „8.398.000 aUEC“ nicht.
      if (k === 'price' && s.stat.price != null) {
        b.textContent = compact.format(s.stat.price);
        b.append(Object.assign(doc.createElement('small'), { textContent: row.unit }));
        if (cell.delta) cell.delta = `${s.stat.price > hall.stat.price ? '+' : '-'}${compact.format(Math.abs(s.stat.price - hall.stat.price))}`;
      }
      const d = box.querySelector('i');
      d.textContent = cell.delta ?? '';
      d.className = cell.tone ? `is-${cell.tone}` : '';
    }
    const size = qv.querySelector('.hgx-qv__size');
    const both = [[s, 'this'], [hall, 'hall']];
    size.hidden = !s.fp || !hall.fp || !topSrc(s.id) || !topSrc(hall.id);
    if (size.hidden) return;
    const figs = qv.querySelector('.hgx-qv__sils');
    const same = id === state.ship;
    const box = { w: figs.clientWidth / (same ? 1 : 2) - 12, h: figs.clientHeight - 44 };
    const scale = Math.min(box.h / Math.max(s.fp.l, same ? 0 : hall.fp.l), box.w / Math.max(s.fp.w, same ? 0 : hall.fp.w));
    for (const [x, who] of both) {
      const fig = figs.querySelector(`[data-who="${who}"]`);
      fig.hidden = who === 'hall' && same;
      if (fig.hidden) continue;
      const sil = fig.querySelector('.hgx-sil');
      sil.style.setProperty('--w', `${Math.max(3, x.fp.w * scale).toFixed(1)}px`);
      sil.style.setProperty('--h', `${Math.max(3, x.fp.l * scale).toFixed(1)}px`);
      sil.style.setProperty('--m', `url("${topSrc(x.id)}")`);
      const [name, len] = fig.querySelectorAll('figcaption span');
      name.textContent = who === 'hall' || same ? fillMessage({ other: msg('find').here }, { name: x.name }, loc) : x.name;
      len.textContent = figureText(x.stat.len ?? x.fp.l, rowOf.get('len'), loc);
    }
  }
  function placeQv() {
    if (qv.hidden || !qvAnchor?.isConnected) return;
    const d = dockEl.getBoundingClientRect();
    const r = qvAnchor.getBoundingClientRect();
    const h = qv.offsetHeight;
    const top = Math.min(Math.max(r.top - d.top + r.height / 2 - h / 2, 0), Math.max(0, d.height - h));
    qv.style.setProperty('--qv-top', `${Math.round(top)}px`);
  }
  function showQv(anchor) {
    clearTimeout(qvTimer);
    const id = anchor.dataset.id;
    if (!qvWide.matches || main.dataset.dock === 'closed' || dlg.open || !dock.has(id)) return;
    qvAnchor = anchor;
    if (qv.hidden || qvId !== id) {
      qvId = id;
      qv.hidden = false;
      fillQv(id);
    }
    placeQv();
  }
  function hideQv() {
    clearTimeout(qvTimer);
    qv.hidden = true;
    qvId = null;
    qvAnchor = null;
  }
  // Mit der Maus zeigt die Karte das Schiff, auf dem der Zeiger ruht:
  // vorbeifahren zeigt nichts, und wer schraeg ueber andere Zeilen zu den
  // Knoepfen der Karte faehrt, behaelt sein Schiff.
  rail.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(qvTimer);
    const a = e.target.closest('.hg-card');
    if (!a) return;
    if (!qv.hidden && a.dataset.id === qvId) { qvAnchor = a; return; }
    qvTimer = setTimeout(() => showQv(a), qv.hidden ? 220 : 110);
  }, { passive: true });
  const leave = (e) => {
    if (e.pointerType !== 'mouse' || e.relatedTarget?.closest?.('#hgx-qv, #hg-rail')) return;
    clearTimeout(qvTimer);
    qvTimer = setTimeout(hideQv, 160);
  };
  rail.addEventListener('pointerleave', (e) => {
    if (e.relatedTarget?.closest?.('#hgx-qv')) clearTimeout(qvTimer);
    leave(e);
  });
  qv.addEventListener('pointerenter', () => clearTimeout(qvTimer));
  qv.addEventListener('pointerleave', leave);
  qv.addEventListener('click', (e) => {
    const b = e.target.closest('[data-qv]');
    if (!b || !qvId) return;
    if (b.dataset.qv === 'go') {
      const id = qvId;
      hideQv();
      select(id, { scroll: false });
    } else toggleCompare(qvId);
  });
  rail.addEventListener('focusin', (e) => {
    const a = e.target.closest('.hg-card');
    if (a?.matches(':focus-visible')) showQv(a);
  });
  rail.addEventListener('focusout', (e) => {
    if (!e.relatedTarget?.closest?.('.hg-card')) hideQv();
  });
  rail.addEventListener('scroll', placeQv, { passive: true });
  qvWide.addEventListener('change', hideQv);

  function paintRandom() {
    $('hgx-random').disabled = !visibleIds().some((id) => id !== state.ship);
  }
  $('hgx-random').addEventListener('click', () => {
    const id = pickRandom(visibleIds(), state.ship);
    if (id) select(id);
  });

  // Die Blase am Zeichen (.hgx-tip) steht linksbuendig am Knopf. Wo sie so
  // aus dem Fenster liefe, steht sie rechtsbuendig (is-end): Auch
  // unsichtbar zaehlt sie zur Breite der Seite, am Zufallsknopf am
  // Zeilenende machte sie die Seite bei 360 px 32 px breiter als das Fenster.
  // Neu gemessen, sobald die Kopfzeile anders umbricht.
  const tips = [...main.querySelectorAll('.hgx-tip')];
  const fitTips = () => {
    for (const t of tips) t.classList.remove('is-end');
    const w = doc.documentElement.clientWidth;
    for (const t of tips) { const r = t.getBoundingClientRect(); if (r.width && r.right > w - 4) t.classList.add('is-end'); }
  };
  new ResizeObserver(fitTips).observe(dockTog.parentElement);

  function syncControls() {
    $('hg-q').value = state.q;
    sortSel.value = state.sort;
  }

  strip.addEventListener('click', (e) => {
    const a = e.target.closest('.hg-card');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    select(a.dataset.id, { scroll: false });
  });
  // Die Unterrollen laufen waagerecht weiter: das Mausrad schiebt sie, am Rand
  // gibt es an die Rolle weiter.
  subs.addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const max = subs.scrollWidth - subs.clientWidth;
    if (max <= 1 || (e.deltaY < 0 && subs.scrollLeft <= 0) || (e.deltaY > 0 && subs.scrollLeft >= max - 1)) return;
    e.preventDefault();
    subs.scrollBy({ left: e.deltaY * (e.deltaMode === 1 ? 40 : 1) * 1.5, behavior: reduce ? 'auto' : 'smooth' });
  }, { passive: false });
  const q = $('hg-q');
  q.addEventListener('input', () => setState({ q: q.value }));
  sortSel.addEventListener('change', () => setState({ sort: sortSel.value }));

  // Tastatur: / sucht, aus der Suche fuehrt ↓ in die Liste, Enter nimmt den
  // ersten Treffer, Escape leert die Suche. In der Liste blaettern ↑ ↓ den
  // Fokus (die Schnellansicht folgt), Enter waehlt wie ein Klick.
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      const first = visibleCards()[0];
      if (!first) return;
      e.preventDefault();
      first.focus();
    } else if (e.key === 'Enter') {
      const first = visibleIds()[0];
      if (!first) return;
      e.preventDefault();
      select(first);
    } else if (e.key === 'Escape' && q.value) {
      e.preventDefault();
      q.value = '';
      setState({ q: '' });
    }
  });
  strip.addEventListener('keydown', (e) => {
    const a = e.target.closest('.hg-card');
    if (!a || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === 'Escape') { hideQv(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const cards = visibleCards();
    const i = cards.indexOf(a);
    const next = cards[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') q.focus();
  });
  // In der Einfangphase am Fenster: vor der Seitensuche (SearchOverlay.astro),
  // die / sonst fuer sich nimmt und eine verhinderte Vorgabe stehen laesst.
  // Strg+K bleibt die Seitensuche.
  doc.defaultView.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.altKey || e.ctrlKey || e.metaKey || dlg.open) return;
    const t = e.target;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest?.('[role="dialog"]:not([hidden])')) return;
    e.preventDefault();
    setDock(true, false);
    q.focus();
    q.select();
  }, true);

  // Pfeiltasten wechseln das Schiff nur, wenn der Fokus auf der Seite, der
  // Buehne oder einer Dock-Karte liegt: jedes Bedienelement, das Pfeile selbst
  // braucht, behaelt sie, ohne sich hier abmelden zu muessen.
  doc.addEventListener('keydown', (e) => {
    // Ein Klick auf Text im offenen Vergleich legt den Fokus auf den Body; das
    // Schiff hinter dem Dialog wechselt trotzdem nicht.
    if (dlg.open || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const t = e.target;
    if (t !== doc.body && t !== doc.documentElement && !t.closest?.('.hg-card, [data-hg-stage]')) return;
    // Im Feld fuer den Link (ohne Zwischenablage) bewegen die Pfeile den Cursor.
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    e.preventDefault();
    // Eine gehaltene Taste wechselt einmal, nicht dreissigmal je Sekunde mit je
    // einem Abruf und einer neuen Adresse.
    if (e.repeat) return;
    hintSeen();
    step(e.key === 'ArrowLeft' ? -1 : 1);
  });

  window.addEventListener('popstate', () => {
    closing = false;
    const prevShip = state.ship;
    let next = parseState(location.search, location.hash, ctx);
    // Ein Schliessen aus dem Vergleich ging einen Eintrag zurueck; was im
    // Dialog geaendert wurde (Basis, entfernte Schiffe, gewaehltes Schiff), kommt mit.
    const carried = carry;
    carry = null;
    if (carried) next = normalize({ ...next, ...carried, view: 'stage' }, ctx);
    commit(next, carried ? 'replace' : 'keep');
    syncControls();
    if (prevShip !== state.ship) scrollToCard(state.ship);
  });

  // Klicks auf [data-fleet-ship] und [data-fleet-retry] bindet fleet.js
  // selbst; hier wird nur der Schnappschuss gezeichnet.
  const fleetBtn = $('hgx-fleet');
  const fleetChip = $('hgx-fleetonly');
  const fleetSum = $('hgx-fleetsum');
  const fleetLine = $('hgx-fleetline');
  const fleetSync = $('hgx-fleetsync');
  const mergedNote = $('hgx-merged');
  let fleet = { ids: [], mode: 'guest', sync: 'local', error: null, merged: 0 };
  let fleetIds = new Set();

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
    // Der Hinweis zur Uebernahme steht, bis er weggeklickt ist, auch nach einer
    // Anmeldung auf einem Datenblatt: fleet.js haelt die Zahl im Spiegel des Kontos.
    const wasHidden = mergedNote.hidden;
    mergedNote.hidden = !(fleet.merged > 0);
    if (!mergedNote.hidden) {
      const text = fillMessage(msg('fleet-merged'), { n: fleet.merged }, loc);
      $('hgx-merged-txt').textContent = text;
      if (wasHidden) say(text);
    }
    paintFleetLine();
  }

  // Die Zeile im Dock steht, solange das Dock nur die Flotte zeigt. Eine
  // Uebernahme oder ein Fehler im Abgleich braucht den Besucher: dann steht
  // sie von selbst, auch bei zugeklapptem Dock (is-alert).
  function paintFleetLine() {
    const alert = fleet.merged > 0 || fleet.sync === 'error';
    fleetLine.classList.toggle('is-alert', alert);
    fleetLine.hidden = !(alert || (state.fleetOnly && (!fleetSum.hidden || !fleetSync.hidden)));
  }

  // Die Live-Region sagt nur an, was der Besucher hier geklickt hat. Ein
  // Abgleich mit einem anderen Tab oder Geraet aendert die Flotte still; der
  // Zaehler im Dock und die Sterne der Karten zeigen ihn. Dieser Hoerer am
  // Knopf laeuft vor dem von fleet.js am Dokument, und fleet.js meldet den
  // Klick noch im selben Ereignis.
  let clicked = null;
  fleetBtn.addEventListener('click', () => {
    clicked = fleetBtn.dataset.fleetShip;
    setTimeout(() => { clicked = null; }, 0);
  });
  function announceFleet(before, after) {
    if (!clicked || before.has(clicked) === after.has(clicked)) return;
    const m = msg('fleet-note');
    say(fillMessage({ other: after.has(clicked) ? m.added : m.removed }, { name: dock.get(clicked).name }, loc));
    clicked = null;
  }

  function paintFleetFilter() {
    fleetChip.setAttribute('aria-pressed', String(state.fleetOnly));
    paintFleetLine();
  }
  fleetChip.addEventListener('click', () => setState({ fleetOnly: !state.fleetOnly }));
  $('hgx-merged-x').addEventListener('click', () => {
    mergedNote.hidden = true;
    window.VBFleet?.dismissMerged();
  });

  // Der Anmelde-Link nimmt den Zustand der Seite mit; loginHref() liest die
  // Adresse erst beim Aufruf, deshalb kurz vor dem Folgen.
  const login = $('hgx-login');
  const freshLogin = () => { if (window.VBAccount) login.href = window.VBAccount.loginHref(); };
  for (const ev of ['pointerdown', 'focus', 'click']) login.addEventListener(ev, freshLogin);

  function onFleet(snap) {
    const before = fleetIds;
    fleet = snap;
    fleetIds = new Set(snap.ids);
    paintFleet();
    syncFleetBtn();
    if (state.fleetOnly) applyDock();
    announceFleet(before, fleetIds);
  }

  // Spalten aus den Dock-Daten, keine Bucht; cmp[0] ist die Basis. Jedes
  // Schliessen aus dem Dialog geht ueber closeCompare(), damit der Eintrag,
  // den das Oeffnen anlegte, wieder verschwindet und Zurueck nichts doppelt.
  const cmpToggle = $('hgx-cmp-toggle');
  const cmpOpen = $('hgx-cmp-open');
  const tray = $('hgx-tray');
  const trayMsg = $('hgx-tray-msg');
  const dlg = $('hgx-cmp');
  const cmpTable = $('hgx-cmp-table');
  // Einheit, Stellen und Richtung je Kennwert, gebaut an den Zahlenzeilen der
  // Tabelle; die Werte auf den sortierten Dock-Karten lesen dieselben.
  const cmpRows = [...cmpTable.querySelectorAll('tbody tr')];
  const rowOf = new Map(cmpRows.filter((tr) => tr.dataset.k).map((tr) => [tr.dataset.k, { digits: Number(tr.dataset.d), unit: tr.dataset.u, better: Number(tr.dataset.better) }]));
  const sizeLabel = new Map(vocab.size.map((e) => [e.k, e.l]));
  let carry = null;
  let opener = null;

  /** Element mit Attributen; Kinder als Knoten oder Text, nie als Markup. */
  function el(tag, attrs, ...kids) {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...kids);
    return e;
  }
  const removeBtn = (id, m) => el('button', { type: 'button', class: 'hgx-x', 'data-cmp-remove': id, 'aria-label': fillMessage({ other: m.remove }, { name: dock.get(id).name }, loc) }, '×');

  function paintTray() {
    const m = msg('cmp');
    tray.hidden = !state.cmp.length;
    trayMsg.hidden = true;
    $('hgx-tray-list').replaceChildren(...state.cmp.map((id) => el('li', {}, el('span', {}, dock.get(id).name), removeBtn(id, m))));
    $('hgx-tray-hint').hidden = state.cmp.length !== 1;
    cmpOpen.hidden = state.cmp.length < 2;
    cmpOpen.textContent = fillMessage(msg('cmp-open'), { n: state.cmp.length }, loc);
    cmpToggle.setAttribute('aria-pressed', String(state.cmp.includes(state.ship)));
    paintQvActs();
  }

  function paintCompare() {
    const m = msg('cmp');
    const [base] = state.cmp;
    // Der Neuaufbau nimmt den fokussierten Knopf mit; danach steht der Fokus
    // wieder auf demselben Knopf derselben Spalte, sonst auf der ersten.
    const f = dlg.contains(doc.activeElement) ? doc.activeElement : null;
    const again = f?.dataset.cmpBase ? `[data-cmp-base="${f.dataset.cmpBase}"]` : f?.dataset.cmpShow ? `[data-cmp-show="${f.dataset.cmpShow}"]` : null;
    const head = cmpTable.tHead.rows[0];
    while (head.cells.length > 1) head.deleteCell(-1);
    for (const id of state.cmp) {
      const s = dock.get(id);
      head.append(el('th', { scope: 'col', class: id === base ? 'is-base' : '' },
        el('button', { type: 'button', class: 'hgx-cmp__name', 'data-cmp-base': id, 'aria-pressed': String(id === base), 'aria-describedby': 'hgx-cmp-basedesc' }, s.name),
        el('small', { class: 'hgx-cmp__maker' }, s.li.dataset.mk),
        ...(id === base ? [el('span', { class: 'hgx-cmp__badge' }, m.base)] : []),
        el('span', { class: 'hgx-cmp__acts' }, el('button', { type: 'button', class: 'hgx-linkbtn', 'data-cmp-show': id }, m.show), removeBtn(id, m)),
      ));
    }
    const cls = (id) => (id === base ? 'is-base' : '');
    for (const tr of cmpRows) {
      if (tr.classList.contains('hgx-cmp__sec')) {
        tr.cells[0].colSpan = state.cmp.length + 1;
        continue;
      }
      while (tr.cells.length > 1) tr.deleteCell(-1);
      // Wortzeilen (Fokus, Groesse) aus dem Dock, ohne Abweichung.
      if (tr.dataset.t) {
        for (const id of state.cmp) {
          const li = dock.get(id).li;
          const text = tr.dataset.t === 'role' ? li.querySelector('.hg-card__s em')?.textContent : sizeLabel.get(li.dataset.sz);
          tr.append(el('td', { class: cls(id) }, el('span', { class: 'hgx-cmp__v' }, text || '–')));
        }
        continue;
      }
      // Hardpoints und Bauteile kommen aus den Buchten (paintParts).
      if (tr.dataset.g) {
        for (const id of state.cmp) tr.append(el('td', { class: `${cls(id)} is-wait`.trim() }, m.loading));
        continue;
      }
      const row = rowOf.get(tr.dataset.k);
      const b = dock.get(base).stat[tr.dataset.k];
      for (const id of state.cmp) {
        const c = compareCell(dock.get(id).stat[tr.dataset.k], id === base ? null : b, row, loc);
        const td = el('td', { class: cls(id) }, el('span', { class: 'hgx-cmp__v' }, c.value));
        if (c.delta) {
          const word = c.tone === 'up' ? m.better : c.tone === 'down' ? m.worse : null;
          td.append(el('span', { class: `hgx-delta is-${c.tone}` }, c.delta, ...(word ? [el('span', { class: 'hgx-sr' }, ` ${word}`)] : [])));
        }
        tr.append(td);
      }
    }
    paintParts();
    if (f && !f.isConnected) ((again && cmpTable.querySelector(again)) || dlg.querySelector('.hgx-cmp__name') || $('hgx-cmp-close')).focus();
  }

  // Bewaffnung und Systeme je Schiff aus seiner Bucht (dieselben Gruppen wie
  // in den Tabs Waffen und Systeme), geholt ueber den Cache des Hallenwechsels.
  // Eine Zeile, die keines der Schiffe fuehrt (Bomben, PDC), faellt weg;
  // eine Bucht, die nicht kommt, zeigt den Strich statt ewig „Laedt“.
  let partsTok = 0;
  function paintParts() {
    const my = ++partsTok;
    const ids = state.cmp;
    Promise.allSettled(ids.map((id) => loadBay(id))).then((res) => {
      if (my !== partsTok) return;
      const parts = res.map((r) => (r.status === 'fulfilled' ? bayParts(r.value.panel) : null));
      for (const tr of cmpRows) {
        if (!tr.dataset.g) continue;
        const lists = parts.map((p) => p?.get(tr.dataset.g) ?? []);
        tr.hidden = parts.every(Boolean) && lists.every((l) => !l.length);
        lists.forEach((list, i) => {
          const td = tr.cells[i + 1];
          td.classList.remove('is-wait');
          td.replaceChildren(...(list.length
            ? list.map((x) => el('span', { class: 'hgx-cmp__hp' }, el('b', {}, `${x.n}×${x.size ? ` ${x.size}` : ''}`), ' ', el('span', {}, x.name)))
            : ['–']));
        });
      }
      for (const body of cmpTable.tBodies) {
        const rows = [...body.rows].filter((tr) => !tr.classList.contains('hgx-cmp__sec'));
        body.hidden = rows.length > 0 && rows.every((tr) => tr.hidden);
        const jump = dlg.querySelector(`[data-cmp-jump="${body.dataset.sec}"]`);
        if (jump) jump.hidden = body.hidden;
      }
    });
  }

  function paintView() {
    if (state.view === 'compare') {
      paintCompare();
      if (!dlg.open) {
        opener = doc.activeElement;
        dlg.showModal();
      }
    } else if (dlg.open) {
      dlg.close();
      // Zurueck auf den Oeffner; der kann mit dem Korb verschwunden sein.
      [opener, cmpOpen, cmpToggle].find((b) => b && b !== doc.body && b.isConnected && b.getClientRects().length > 0)?.focus();
      opener = null;
    }
  }

  // back() kommt erst mit popstate an. Ein zweites Schliessen davor (Escape
  // und Knopf, ein Doppelklick) ginge einen Eintrag weiter zurueck und
  // womoeglich aus der Seite hinaus.
  let closing = false;
  function closeCompare(patch = {}) {
    if (closing) return;
    if (history.state === CMP_ENTRY && pushedHere) {
      closing = true;
      carry = { cmp: state.cmp, ...patch };
      history.back();
    } else setState({ ...patch, view: 'stage' });
  }

  // Vom Knopf an der Buehne fuer das Schiff in der Halle, von der
  // Schnellansicht fuer das gezeigte.
  function toggleCompare(id) {
    if (state.cmp.includes(id)) setState({ cmp: state.cmp.filter((x) => x !== id) });
    else if (state.cmp.length < MAX_COMPARE) setState({ cmp: [...state.cmp, id] });
    else {
      trayMsg.hidden = false;
      say(trayMsg.textContent);
    }
  }
  cmpToggle.addEventListener('click', () => toggleCompare(state.ship));
  tray.addEventListener('click', (e) => {
    const x = e.target.closest('[data-cmp-remove]');
    if (!x) return;
    setState({ cmp: state.cmp.filter((id) => id !== x.dataset.cmpRemove) });
    // Der Knopf ist mit seinem Chip weg: weiter zum naechsten, sonst zum Schalter.
    (tray.querySelector('[data-cmp-remove]') ?? cmpToggle).focus();
  });
  cmpOpen.addEventListener('click', () => setState({ view: 'compare' }, true));
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeCompare();
  });
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cmpJump) {
      // Unter den klebenden Kopf der Spalten, nicht dahinter.
      const sec = cmpTable.querySelector(`tbody[data-sec="${b.dataset.cmpJump}"]`);
      const box = sec?.closest('.hgx-cmp__scroll');
      if (box && !sec.hidden) box.scrollTo({ top: sec.offsetTop - cmpTable.tHead.offsetHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } else if (b.id === 'hgx-cmp-close') closeCompare();
    else if (b.dataset.cmpShow) closeCompare({ ship: b.dataset.cmpShow, hp: null });
    else if (b.dataset.cmpBase && b.dataset.cmpBase !== state.cmp[0]) setState({ cmp: [b.dataset.cmpBase, ...state.cmp.filter((id) => id !== b.dataset.cmpBase)] });
    else if (b.dataset.cmpRemove) {
      const cmp = state.cmp.filter((id) => id !== b.dataset.cmpRemove);
      if (cmp.length < 2) closeCompare({ cmp });
      else setState({ cmp });
    }
  });

  const copyBtn = $('hgx-copy');
  const copyField = $('hgx-copyfield');
  let copyTimer = 0;
  copyBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}${serializeState(state, ctx, 'share')}`;
    const m = msg('copy');
    try {
      await navigator.clipboard.writeText(url);
      copyField.hidden = true;
      say(m.ok);
      copyBtn.classList.add('is-done');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => copyBtn.classList.remove('is-done'), 1600);
    } catch {
      copyField.value = url;
      copyField.hidden = false;
      copyField.focus();
      copyField.select();
      say(m.fallback);
    }
  });

  // Die Tafel rechts: Werkstatt (Vorgabe) oder Schiffsdaten. Die Werkstatt
  // laedt ihre Datei erst, wenn sie zu sehen ist, ueber ihre versionierte URL
  // wie der Viewer. Sie bekommt eine schmale Bruecke statt des Speichers:
  // lesen, aendern, Schiffsnamen, Ansage.
  const stBtns = [...doc.querySelectorAll('#hgx-st [data-station]')];
  const tafelBtn = $('hgx-tafel');
  let workshop = null;
  let workshopLoad = null;
  const bridge = {
    state: () => state,
    set: (patch) => setState(patch),
    shipName: (id) => dock.get(id)?.name ?? id,
    say,
    // Getauschte Bordwaffen ans Modell: gilt fuer das genannte Schiff und
    // wird nach jedem Laden erneut angelegt (applyFit in viewerShow)
    fit: (ship, list) => { fitting = { ship, list }; applyFit(); },
    // Lackierung ans Modell ({ cols, base } oder null), ebenso je Schiff
    paint: (ship, p) => { painting = { ship, p }; applyPaintSel(); },
    // Steht die Uebersicht als Hologramm, zeichnet die Halle die Werkstatt
    // (holoData liest workshop.board()); changed: ihr Stand ist neu
    holo: () => holoOn(),
    changed: () => paintHolo(),
  };
  let fitting = { ship: '', list: [] };
  let fitKey = '';
  function applyFit() {
    if (!viewer?.fit || placed !== fitting.ship) return;
    const key = `${placed}|${JSON.stringify(fitting.list)}`;
    if (key === fitKey) return;
    fitKey = key;
    viewer.fit(fitting.list).catch(() => {});
  }
  let painting = { ship: '', p: null };
  let paintKey = '';
  function applyPaintSel() {
    if (!viewer?.paint || placed !== painting.ship) return;
    const key = `${placed}|${JSON.stringify(painting.p)}`;
    if (key === paintKey) return;
    paintKey = key;
    viewer.paint(painting.p);
  }
  // Stationen: kann die Buehne die Uebersicht als Hologramm in die Halle
  // stellen (viewer.canStation: echte Halle, ab 761 px), ist sie die eine
  // Oberflaeche: Datenblatt rechts, links die Werkstatt als Tafel
  // „Ausruestung“. Die Tafeln der Seite weichen, die Station Loadout faellt
  // aus der Leiste. Mit „Als Tafel“, am Telefon, ohne 3D, drinnen und bei
  // Bodenfahrzeugen in der Werkhalle waehlt die Leiste wie bisher, was rechts
  // steht (Loadout: die Werkstatt, Uebersicht: die Schiffsdaten).
  // Bis die Buehne antwortet, gilt die Vorhersage (dieselben Bedingungen wie
  // im Viewer): sonst stuende beim Laden erst die flache Werkstatt da und
  // wiche nach Sekunden dem Hologramm. Ohne Buehne (noStage) gilt die Tafel.
  let stage3d = null;
  const guess3d = () => !!(stageCfg.opts?.hall?.url && stageCfg.opts.hall.room && stageCfg.opts.holo?.module)
    && !doc.defaultView.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  // Drinnen (data-walk) stellt der Viewer keine Station auf: dann die Tafel
  // und im Leitstand keine: dort steht das Terminal im Bild
  const canHolo = () => (stage3d ?? guess3d()) && stageCfg.models[state.ship]?.[3] !== 'werk' && main.dataset.walk !== 'on' && state.ort !== 'leit';
  const holoOn = () => canHolo() && !state.flat;
  // Orte (placeOf): die Leiste nennt Schiffsfeld, Werkhalle und Leitstand,
  // sobald die Buehne einen Leitstand hat (viewer.canPlace, bis sie
  // antwortet die Vorhersage wie bei den Stationen); nicht drinnen. Steht
  // die Uebersicht als Hologramm, ersetzen die Orte ihren einen Reiter; im
  // Leitstand gibt es weder Reiter noch Tafel.
  const ortBox = $('hgx-orte');
  const ortBtns = [...(ortBox?.querySelectorAll('[data-ort]') ?? [])];
  let stageOrte = null;
  const canOrte = () => !!ortBox && (stageOrte ?? guess3d()) && main.dataset.walk !== 'on';
  const placeNow = () => placeOf(state, ctx.werk);
  // Fuss der Buehne: Passt die Leiste nicht in den freien Streifen zwischen
  // Schiffsauswahl und Tafel (offene Auswahl im schmalen Fenster, flache
  // Tafel), geben erst die Orte, dann auch Reiter und „Als Tafel“ ihre Namen
  // ab und zeigen nur ihr Zeichen: data-eng 1 | 2 an #hgx-st. Der Name bleibt
  // im Dokument (Vorleser) und steht als title am Knopf. Links im Streifen
  // stehen die Zeichen der Buehne (#hg-tools, zwei bis vier): Der Platz
  // zaehlt erst rechts von ihnen, und laege die Leiste in der Mitte des
  // Streifens ueber ihnen, rueckt sie daneben (padding-left). Gemessen statt
  // an Fensterbreiten geknuepft, weil Sprache, Korb, Tafel und die Zahl der
  // Zeichen den Bedarf aendern. Passt auch die kleinste Form nicht (beide
  // Spalten offen im schmalen Fenster), bleibt sie stehen wie zuvor.
  // Anlass 13.11.2026: Mit den drei Orten lief die Leiste bei 800 px neben
  // der offenen Auswahl 132 px aus dem Fenster, „Als Tafel“ war nicht mehr
  // zu erreichen; bei 1280 px mit flacher Tafel lag sie ueber dem Ton-Knopf.
  const stBar = $('hgx-stagebar'), stBox = $('hgx-st'), stTools = $('hg-tools');
  function fitBar() {
    if (!stBar || !stBox) return;
    stBar.style.paddingLeft = '';
    const bar = stBar.getBoundingClientRect(), t = stTools?.getBoundingClientRect();
    const ab = t && t.width && t.top < bar.bottom && t.bottom > bar.top ? Math.max(bar.left, t.right + 12) : bar.left;
    const pad = ab > bar.left ? `${Math.ceil(ab - bar.left)}px` : '';
    let eng = '', passt = false;
    for (const v of ['', '1', '2']) {
      eng = v;
      if (v) stBox.dataset.eng = v;
      else delete stBox.dataset.eng;
      stBar.style.paddingLeft = pad;
      passt = stBar.scrollWidth <= stBar.clientWidth;
      if (passt) break;
    }
    // in der Mitte des Streifens bleibt sie, solange sie dort frei steht
    stBar.style.paddingLeft = '';
    if (passt && pad && stBox.getBoundingClientRect().left < ab) stBar.style.paddingLeft = pad;
    for (const b of stBox.querySelectorAll('button')) {
      if (eng === '2' || (eng === '1' && b.closest('.hgx-st__orte'))) b.title = b.textContent.trim();
      else b.removeAttribute('title');
    }
  }
  if (stBar && stBox) {
    // border-box: der eigene Einzug (padding-left) loest keine neue Meldung aus
    const ro = new ResizeObserver(fitBar);
    ro.observe(stBar, { box: 'border-box' });
    if (stTools) ro.observe(stTools);
    // Orte, Reiter, „Als Tafel“ und der Korb kommen und gehen ueber hidden
    new MutationObserver(fitBar).observe(stBar, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    doc.fonts?.ready.then(fitBar);
  }
  let stageSafe = null;
  function paintStation() {
    main.dataset.station = state.station;
    const holo = holoOn(), orte = canOrte(), at = placeNow(), leit = at === 'leit';
    if (ortBox) {
      ortBox.hidden = !orte;
      for (const b of ortBtns) {
        const on = b.dataset.ort === at;
        if (on) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      }
    }
    const before = main.dataset.ort;
    main.dataset.ort = at;
    for (const b of stBtns) {
      const on = holo ? b.dataset.station === 'uebersicht' : b.dataset.station === state.station;
      b.hidden = leit || (holo && (!on || orte));
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    stBtns[0].parentElement.hidden = stBtns.every((b) => b.hidden);
    tafelBtn.hidden = !canHolo();
    tafelBtn.setAttribute('aria-pressed', String(state.flat));
    const was = main.dataset.st3d === '1';
    if (holo) main.dataset.st3d = '1';
    else delete main.dataset.st3d;
    if (was !== holo || before !== at) stageSafe?.();
    // erst die Werkstatt, dann die Halle: holoData liest ihren Stand
    if (workshop) workshop.render(state);
    else if (state.station === 'loadout' || holo) {
      workshopLoad ??= import(main.dataset.layoutJs).then((m) => { workshop = m.initWorkshop(doc, bridge); });
      workshopLoad.then(() => { workshop.render(state); paintHolo(); }, () => { workshopLoad = null; });
    }
    paintHolo();
  }
  stBtns[0]?.parentElement.addEventListener('click', (e) => {
    const b = e.target.closest('[data-station]');
    if (b) setState({ station: b.dataset.station, hp: null });
  });
  stBtns[0]?.parentElement.addEventListener('keydown', (e) => {
    const vis = stBtns.filter((b) => !b.hidden);
    const i = vis.findIndex((b) => b.getAttribute('aria-selected') === 'true'), n = vis.length;
    const to = { ArrowLeft: (i - 1 + n) % n, ArrowRight: (i + 1) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setState({ station: vis[to].dataset.station, hp: null });
    vis[to].focus();
  });
  tafelBtn.addEventListener('click', () => setState({ flat: !state.flat }));

  // Orte: Ein Klick waehlt, was dort steht (placeShip), und ob die Kamera in
  // den Leitstand faehrt. Je Ort merkt sich die Registerkarte das zuletzt
  // gezeigte Fahrzeug (hg-orte): Schiffsfeld und Werkhalle fuehren dorthin
  // zurueck, wo man war.
  const ORTE_KEY = 'hg-orte';
  let ortMemo = {};
  try { ortMemo = JSON.parse(sessionStorage.getItem(ORTE_KEY) ?? '{}') ?? {}; } catch { ortMemo = {}; }
  function rememberPlace() {
    ortMemo = { ...ortMemo, [ctx.werk.has(state.ship) ? 'werk' : 'halle']: state.ship };
    try { sessionStorage.setItem(ORTE_KEY, JSON.stringify(ortMemo)); } catch { /* ohne Speicher gilt das Startschiff */ }
  }
  // Auch das Fahrzeug, mit dem die Seite beginnt, ist ein Ort, an dem man
  // war: Ohne diesen Eintrag fuehrte „Schiffsfeld“ nach einem Direktlink auf
  // ein anderes Schiff und einem Abstecher in die Werkhalle zum Startschiff
  // der Seite statt zurueck (Review PR #355).
  rememberPlace();
  function goPlace(to) {
    if (to === placeNow()) return;
    const ship = placeShip(to, state.ship, ortMemo, { ids: items.map((li) => li.dataset.id), werk: ctx.werk, defaultShip: ctx.defaultShip });
    if (!ship) return;
    setState({ ship, ort: to === 'leit' ? 'leit' : 'halle', hp: null });
  }
  ortBox?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ort]');
    if (b) goPlace(b.dataset.ort);
  });
  // Escape fuehrt aus dem Leitstand zurueck aufs Feld (nicht, wenn es schon
  // etwas anderes geschlossen hat, und nicht aus dem Fenster der Seite heraus:
  // dort gehoert die Taste der Seite)
  doc.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || state.ort !== 'leit' || state.view === 'compare') return;
    setState({ ort: 'halle' });
  });
  // Die Kamera folgt dem Zustand: hinauf erst, wenn das Schiff steht
  // (viewerShow ruft dann erneut), zurueck sofort. Kann die Buehne nicht
  // (false), faellt der Zustand zurueck aufs Feld. Das darf nur die Antwort
  // auf den juengsten Wunsch: Auch ein ueberholter loest mit false auf
  // („Leitstand, Schiffsfeld, Leitstand“ waehrend der Rueckfahrt), und seine
  // Antwort naehme sonst den juengeren zurueck (Review PR #355).
  let ortTok = 0;
  function applyOrt() {
    if (!viewer?.place) return;
    const my = ++ortTok;
    if (state.ort !== 'leit') { viewer.place('halle'); return; }
    if (placed !== state.ship) return;
    const ship = state.ship;
    viewer.place('leit').then((ok) => {
      if (!ok && my === ortTok && state.ort === 'leit' && state.ship === ship) setState({ ort: 'halle' });
    }, () => {});
  }
  // Das Terminal im Leitstand (assets/hangar-terminal.js): geladen, wenn die
  // Kamera zum ersten Mal hinauffaehrt. Die Buehne nennt das Rechteck des
  // Schirms im Bild (viewer.onPlace), das Fenster der Seite liegt genau
  // darauf, solange die Kamera davor steht.
  const termBox = $('hgx-term');
  let terminal = null, terminalLoad = null, termRect = null, warOben = false;
  function onPlace(e) {
    if (e.ort === 'leit') main.dataset.fahrt = e.state;
    else delete main.dataset.fahrt;
    // Ansage fuer Vorleser, wenn die Kamera oben steht und wenn sie zurueck ist
    const oben = e.ort === 'leit' && e.state === 'an';
    if (oben && !warOben) say(ortBox?.dataset.anLeit ?? '');
    else if (e.ort !== 'leit' && warOben) say(ortBox?.dataset.anHalle ?? '');
    if (oben || e.ort !== 'leit') warOben = oben;
    termRect = oben ? e.rect : null;
    if (!termBox) return;
    // Geht das Fenster zu, waehrend der Fokus in ihm steht, wandert er auf den
    // Ort in der Leiste statt in einem verborgenen Rahmen zu bleiben.
    if (!oben && termBox.contains(doc.activeElement)) (ortBox?.querySelector('[aria-current="true"]') ?? ortBtns[0])?.focus({ preventScroll: true });
    if (terminal) { terminal.place(termRect); return; }
    if (e.ort !== 'leit' || terminalLoad) return;
    terminalLoad = import(termBox.dataset.js).then((m) => {
      terminal = m.initTerminal(termBox, {
        // Ein Link zum Hangar auf dem Schirm („Im Hangar ansehen“): Das Schiff
        // kommt aufs Feld, ohne die Halle neu zu laden; ohne bekanntes Schiff
        // fuehrt er nur zurueck aufs Feld.
        ship: (id) => setState(id && ctx.ids.has(id) ? { ship: id, ort: 'halle', hp: null } : { ort: 'halle' }),
      });
      terminal.place(termRect);
    }, () => { terminalLoad = null; });
  }

  // Die Uebersicht als Hologramm (viewer.station): Woerter und Zahlen aus der
  // eingesetzten Bucht und den Dock-Karten, fertig gesetzt; der Viewer
  // zeichnet nur. null, solange die Bucht des Schiffs fehlt. Kacheln wie in
  // den Entwuerfen (Tafel 7): Tempo, Feuerkraft, Schild, Rumpf mit dem Platz
  // in der Klasse; links die Systeme mit Nummern, die am Port wiederkehren.
  const HOLO_TILES = [['scm', 'speed'], ['dps', 'fire'], ['shield', 'shield'], ['hull', 'hull']];
  // Kachel -> Gruppe der Werkstatt, deren Summe sie zeigt (groupTotals)
  const HOLO_LAYOUT = { dps: 'pilot', shield: 'shield' };
  const HOLO_SYS_MAX = 8, HOLO_DETAIL_MAX = 6;
  const textOf = (n) => (n?.nodeType === 3 ? n.textContent.trim() : '');
  const nums = (v) => String(v ?? '').trim().split(/\s+/).map(Number);
  function holoData() {
    const id = state.ship, me = dock.get(id);
    const head = regionNow('head'), panel = regionNow('panel'), marks = regionNow('marks');
    if (!me || [head, panel, marks].some((r) => r?.dataset.id !== id) || panel.hidden) return null;
    const m = msg('holo');
    const cls = shipClass(dock, id);
    // Die Werkstatt auf der Tafel „Ausruestung“; null, solange sie laedt oder
    // ihre Daten fehlen: dann stehen links wie zuvor die Systeme.
    const lo = workshop?.board() ?? null;
    const nf = new Intl.NumberFormat(loc);
    const tiles = HOLO_TILES.map(([k, w]) => {
      const row = rowOf.get(k) ?? { digits: 0, unit: '' };
      const x = me.stat[k];
      const r = cls && rankIn(dock, cls.ids, id, k);
      // Was das Layout aendert: Feuerkraft (Pilotenwaffen) und Schild mit
      // dem Abstand zur Serie statt des Rangs, der nur fuer die Serie gilt
      const t = lo?.totals[HOLO_LAYOUT[k]];
      const d = t && Number.isFinite(x) ? Math.round(t.now) - Math.round(t.stock) : 0;
      if (d) {
        const p = x > 0 ? Math.round((Math.abs(d) / x) * 100) : 0;
        return {
          label: m[w], value: figureText(x + d, { digits: row.digits, unit: '' }, loc), unit: row.unit,
          rank: `${d > 0 ? '▲' : '▼'} ${p ? `${nf.format(p)} %` : nf.format(Math.abs(d))}`, tone: d > 0 ? 'up' : 'down',
          pct: r ? (r.of - r.n + 1) / r.of : 0,
        };
      }
      return {
        label: m[w], value: figureText(x, { digits: row.digits, unit: '' }, loc), unit: x == null ? '' : row.unit,
        rank: r ? fillMessage({ other: m.rank }, r, loc) : '', pct: r ? (r.of - r.n + 1) / r.of : 0,
      };
    });
    const maker = head.querySelector('.hg-maker')?.textContent ?? '', role = head.querySelector('.hg-role')?.textContent ?? '';
    const sheet = {
      name: head.querySelector('.hg-name')?.textContent ?? me.name,
      line: [maker, role].filter(Boolean).join(' · '),
      tiles,
      note: cls ? fillMessage({ other: cls.kind === 'grp' ? m.cls : m.size }, { cls: vocabLabel(cls.kind, cls.key) }, loc) : m.none,
      buttons: [
        { label: state.cmp.includes(id) ? m.cmpOn : m.cmp, act: 'cmp' },
        { label: m.all, act: 'flat', main: true },
      ],
    };
    // Komponenten der Systeme, je Zeile die Punkte ihrer Ports (Region marks)
    const at = new Map();
    for (const mk of marks.querySelectorAll('.hgx-mk[data-tab="systems"]')) {
      const p = nums(mk.dataset.p);
      if (p.length !== 3 || !p.every(Number.isFinite)) continue;
      for (const r of (mk.dataset.rows ?? '').split(' ')) if (r) at.set(r, [...(at.get(r) ?? []), p]);
    }
    const slots = [...panel.querySelectorAll('#hgx-tp-systems .hgx-slot')];
    const shown = slots.slice(0, HOLO_SYS_MAX);
    // gewählt wie auf der Tafel (applyHp): alle Zeilen, die den Port
    // state.hp führen; aufgeklappt mit ihren Werten und Links
    const selLis = state.tab === 'systems' && state.hp ? shown.filter((li) => li.dataset.ports.split(' ').includes(state.hp)) : [];
    const systems = {
      title: m.sys,
      sel: selLis.map((li) => li.dataset.row),
      detail: Object.fromEntries(selLis.map((li) => [li.dataset.row, {
        lines: [...li.querySelectorAll('.hgx-d dl > dt')].slice(0, HOLO_DETAIL_MAX).map((dt) => [dt.textContent.trim(), dt.nextElementSibling?.textContent.trim() ?? '']),
        links: [...li.querySelectorAll('.hgx-links a')].map((a) => ({ label: `${a.textContent.trim()} ›`, href: a.getAttribute('href') })),
      }])),
      rows: shown.map((li, i) => {
        const nm = li.querySelector('.hgx-nm'), v = li.querySelector('.hgx-v');
        return {
          id: li.dataset.row, n: i + 1, name: textOf(nm?.firstChild), kind: nm?.querySelector('small')?.textContent ?? '',
          size: li.querySelector('.hgx-sz')?.textContent ?? '', figure: textOf(v?.firstChild), unit: v?.querySelector('small')?.textContent ?? '',
          ps: at.get(li.dataset.row) ?? [],
        };
      }),
      more: slots.length > HOLO_SYS_MAX ? fillMessage({ other: m.more }, { n: slots.length - HOLO_SYS_MAX }, loc) : '',
    };
    const dim = (k) => {
      const t = panel.querySelector(`#hgx-tp-overview .hgx-tile[data-k="${k}"] dd`)?.textContent ?? '';
      return t === '–' ? '' : t;
    };
    const b = nums(marks.dataset.box);
    const box = b.length === 6 && b.every(Number.isFinite) ? [b.slice(0, 3), b.slice(3)] : null;
    // item: das Datenblatt des Bauteils am offenen Slot (Werkstatt, sheetOf);
    // steht es, zeigt die rechte Tafel das Bauteil statt des Schiffs
    return { key: id, sheet, item: lo?.sheet ?? null, systems, loadout: lo && holoLoadout(lo, panel, marks), dims: { box, len: dim('len'), wid: dim('wid'), hgt: dim('hgt') } };
  }
  // Die Tafel „Ausruestung“: der Stand der Werkstatt, dazu je Zeile der Punkt
  // ihres Ports am Schiff (Region marks) und am offenen Serienteil die Links
  // seiner Zeile in der Bucht (Item Finder, Item-Seite).
  function holoLoadout(lo, panel, marks) {
    const { totals, sheet, ...out } = lo;
    const at = new Map();
    for (const mk of marks.querySelectorAll(`.hgx-mk[data-tab="${lo.cat}"]`)) {
      const p = nums(mk.dataset.p);
      if (p.length === 3 && p.every(Number.isFinite)) at.set(mk.dataset.port, p);
    }
    out.groups = lo.groups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, ps: at.has(r.port) ? [at.get(r.port)] : [] })) }));
    const open = lo.pick && lo.groups.flatMap((g) => g.rows).find((r) => r.key === lo.pick.key);
    if (open && !open.changed) {
      const li = [...panel.querySelectorAll(`#hgx-tp-${lo.cat} .hgx-slot`)].find((el) => (el.dataset.ports ?? '').split(' ').includes(open.port));
      out.pick = { ...lo.pick, links: [...(li?.querySelectorAll('.hgx-links a') ?? [])].map((a) => ({ label: `${a.textContent.trim()} ›`, href: a.getAttribute('href') })) };
    }
    return out;
  }
  let holoKey = '';
  function paintHolo() {
    if (!viewer?.station) return;
    const data = holoOn() ? holoData() : null;
    const key = data ? JSON.stringify(data) : '';
    if (key === holoKey) return;
    holoKey = key;
    viewer.station(data ? { name: 'uebersicht', data } : null);
  }
  // Knoepfe auf den Tafeln in der Halle. sys: eine Zeile der Systeme oder
  // ihre Nummer am Schiff, wie ein Klick auf die Zeile der Tafel (auf- und
  // zuklappen, state.hp im Reiter Systeme); go: ein Link der offenen Zeile.
  function onStationAct({ act, row, href, a }) {
    if (act === 'cmp') toggleCompare(state.ship);
    // „Alle Werte“: die Schiffsdaten als Tafel
    else if (act === 'flat') setState({ flat: true, station: 'uebersicht' });
    // ein Klick auf der Tafel „Ausruestung“: die Werkstatt fuehrt ihn aus
    else if (act === 'lo') {
      if (a?.[0] === 'rename') startRename();
      else workshop?.act(a);
    } else if (act === 'sys') {
      const li = [...regionNow('panel').querySelectorAll('#hgx-tp-systems .hgx-slot')].find((el) => el.dataset.row === row);
      if (!li) return;
      const open = state.tab === 'systems' && !!state.hp && li.dataset.ports.split(' ').includes(state.hp);
      setState(open ? { hp: null } : { tab: 'systems', hp: portFor(li, 'systems') });
    } else if (act === 'go' && href) doc.defaultView.location.assign(href);
  }

  // Name des Layouts auf der Tafel tippen: ein echtes Eingabefeld ausserhalb
  // des Bilds nimmt die Tasten (auch Einfuegen und Eingabehilfen), die Tafel
  // zeigt den Text. Enter, Escape oder ein Klick daneben beenden.
  let nameBox = null;
  function startRename() {
    if (!workshop) return;
    if (!nameBox) {
      nameBox = doc.createElement('input');
      nameBox.type = 'text';
      nameBox.maxLength = 60;
      nameBox.autocomplete = 'off';
      nameBox.spellcheck = false;
      nameBox.tabIndex = -1;
      nameBox.setAttribute('aria-label', $('hgl-name')?.getAttribute('aria-label') ?? '');
      Object.assign(nameBox.style, { position: 'absolute', left: '0', top: '0', width: '1px', height: '1px', padding: '0', border: '0', opacity: '0', pointerEvents: 'none', fontSize: '16px' });
      nameBox.addEventListener('input', () => workshop.act(['name', nameBox.value]));
      nameBox.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== 'Escape') return;
        e.preventDefault();
        nameBox.blur();
      });
      nameBox.addEventListener('blur', () => workshop.act(['nameEdit', false]));
      $('hg-canvas').parentElement.append(nameBox);
    }
    nameBox.value = workshop.board()?.name ?? '';
    workshop.act(['nameEdit', 'all']);
    nameBox.focus({ preventScroll: true });
    nameBox.select();
  }

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
    const [glb, tex, maker, ort] = stageCfg.models[id];
    // Der Balken beginnt fuer jedes Schiff bei null. Wie bei der Bucht zeigt
    // der Zeitgeber eines ueberholten show() nichts mehr an; sein finally
    // blendet nur aus, was ihm gehoert.
    bar.style.setProperty('--p', '0%');
    // Nur ein leiser Balken ohne Wort, und erst wenn das Laden spuerbar
    // dauert: ein schneller Wechsel zeigt gar nichts.
    const t = setTimeout(() => { if (my === showTok) loadEl.hidden = false; }, 1200);
    viewer.show(glb, { maker, tex, ort, id, label: labelOf(id) })
      .then(() => {
        if (my !== showTok) return;
        placed = id;
        laufPhase('steht');
        fitKey = '';
        paintKey = '';
        syncMarks();
        applyFit();
        applyPaintSel();
        // der Leitstand aus der Adresse oder von der Werkhalle aus: jetzt steht das Schiff
        if (state.ort === 'leit') applyOrt();
      })
      .catch((e) => {
        if (my !== showTok) return;
        grund(modelErr, e);
        modelErr.hidden = false;
        meldungPlatz();
        console.warn('[hangar] Modell nicht geladen', e);
      })
      .finally(() => {
        clearTimeout(t);
        if (my === showTok) loadEl.hidden = true;
      });
  }

  // Waechter gegen die Neu-Lade-Schleife (waechterStand, waechterAbbruch oben).
  // Der Stand liegt im Speicher des Geraets, der Vermerk „Lauf offen“ in dem
  // der Registerkarte: er steht, solange die Buehne laeuft und die Seite
  // sichtbar ist, und geht beim Verlassen und im Hintergrund. Findet ein
  // Start ihn vor, ist der vorige Lauf abgebrochen, es sei denn, die
  // Registerkarte wurde verdoppelt (der Vermerk wird mitkopiert): dann
  // meldet sich der noch laufende Lauf ueber den Kanal.
  const STAND_KEY = 'vb.hangar.waechter', OFFEN_KEY = 'vb.hangar.offen';
  const lies = (wo, key) => { try { return wo().getItem(key); } catch { return null; } };
  function standSchreiben(stand) {
    try {
      if (stand.ab === null && stand.deckel === null) localStorage.removeItem(STAND_KEY);
      else localStorage.setItem(STAND_KEY, waechterText(stand));
      return true;
    } catch { return false; }
  }
  // Telefon wie SMALL im Viewer (schmal oder Touch): dort senkt schon der
  // erste Abbruch (WAECHTER oben).
  const TELEFON = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const WIE = { seite: 'Seite neu gestartet', kontext: 'Zeichenkontext verloren' };
  // Ein Abbruch in der Stufe stufe: vermerken, und was der Besucher von Hand
  // gewaehlt hatte, gilt nicht weiter, wenn der Deckel darunter liegt.
  // wie: 'seite' oder 'kontext', phase: wie weit der Lauf war (beides fuer die Spur).
  function abbruch(stufe, wie, phase) {
    const vor = waechterStand(lies(() => localStorage, STAND_KEY), Date.now());
    const stand = waechterAbbruch(vor, Date.now(), stufe, { sofort: TELEFON, phase, wie });
    const ok = standSchreiben(stand);
    if (stand.deckel && GRAFIK && (stand.deckel === 'aus' || WAECHTER.stufen.indexOf(GRAFIK) > WAECHTER.stufen.indexOf(stand.deckel))) {
      try { localStorage.removeItem(GRAFIK_KEY); } catch { /* dann gilt der Deckel ueber der Wahl */ }
    }
    console.warn(`[hangar] Abbruch der Buehne (${WIE[wie] ?? wie}, Stufe ${stufe ?? 'unbekannt'}, ${phase ?? 'Phase unbekannt'}): ${stand.deckel === vor.deckel ? 'vermerkt' : `Deckel ${stand.deckel}`}${ok ? '' : ', ohne Speicher nicht gemerkt'}`);
    return ok ? stand : null;
  }
  let lauf = null;
  let kanal = null;
  try { kanal = typeof BroadcastChannel === 'function' ? new BroadcastChannel('vb.hangar.lauf') : null; } catch { kanal = null; }
  kanal?.addEventListener('message', (e) => {
    if (lauf && e.data?.frage === lauf.id) kanal.postMessage({ lebt: lauf.id });
  });
  // Fragt, ob der Lauf id in einer anderen Registerkarte noch laeuft
  const lebtNoch = (id) => new Promise((done) => {
    if (!kanal) { done(false); return; }
    const t = setTimeout(() => { kanal.removeEventListener('message', on); done(false); }, 300);
    const on = (e) => {
      if (e.data?.lebt !== id) return;
      clearTimeout(t);
      kanal.removeEventListener('message', on);
      done(true);
    };
    kanal.addEventListener('message', on);
    kanal.postMessage({ frage: id });
  });
  const offenWeg = () => { try { sessionStorage.removeItem(OFFEN_KEY); } catch { /* ohne Speicher gab es keinen Vermerk */ } };
  function offenSetzen() {
    if (!lauf || doc.hidden) return;
    try { sessionStorage.setItem(OFFEN_KEY, JSON.stringify({ v: WAECHTER.v, t: Date.now(), id: lauf.id, stufe: lauf.stufe, phase: lauf.phase })); } catch { /* ohne Speicher zaehlt nur der verlorene Kontext */ }
  }
  function laufEnde() { lauf = null; offenWeg(); }
  // Wie weit der Lauf ist (WAECHTER.phasen), nur vorwaerts: 'laden' bis die
  // Dateien da sind, 'bauen' bis das erste Schiff steht, dann 'steht'.
  function laufPhase(phase) {
    if (!lauf || WAECHTER.phasen.indexOf(phase) <= WAECHTER.phasen.indexOf(lauf.phase)) return;
    lauf.phase = phase;
    offenSetzen();
  }
  // Seit wann die Seite sichtbar ist (0: im Hintergrund, 1: seit dem Start).
  // Einer Seite im Hintergrund nimmt das Telefon den Zeichenkontext auch ohne
  // Not, und sie erfaehrt es erst beim Zurueckkommen: Das ist kein Abbruch
  // (imVordergrund). Ein Verlust gleich nach dem Start zaehlt dagegen.
  let sichtbarSeit = doc.hidden ? 0 : 1;
  const imVordergrund = () => sichtbarSeit > 0 && Date.now() - sichtbarSeit >= 5000;
  window.addEventListener('pagehide', offenWeg);
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    sichtbarSeit = doc.hidden ? 0 : Date.now();
    offenSetzen();
  });
  doc.addEventListener('visibilitychange', () => {
    sichtbarSeit = doc.hidden ? 0 : Date.now();
    if (doc.hidden) offenWeg(); else offenSetzen();
  });
  // Der Vermerk bleibt frisch, solange der Lauf zu sehen ist: Sonst gaelte
  // er nach WAECHTER.frisch als alt, und ein Abbruch nach langem Ansehen
  // zaehlte nicht. offenSetzen tut ohne Lauf und im Hintergrund nichts.
  setInterval(offenSetzen, WAECHTER.puls);
  // Deckel fuer diesen Start: null, eine Stufe oder 'aus'. Zaehlt vorher den
  // Abbruch des vorigen Laufs, wenn dessen Vermerk noch steht. Konnte er
  // nicht gemerkt werden (der Speicher des Geraets nimmt nichts an, der der
  // Registerkarte schon), bleibt die Buehne fuer dieses Laden aus: Sonst
  // zaehlte kein Abbruch, und die Schleife liefe weiter. Der Knopf oder ein
  // Neuladen von Hand versucht es wieder, einmal je Mal.
  async function waechterStart() {
    const offen = waechterOffen(lies(() => sessionStorage, OFFEN_KEY), Date.now());
    if (offen && !(await lebtNoch(offen.id))) {
      offenWeg();
      if (!abbruch(offen.stufe, 'seite', offen.phase)) return 'aus';
    }
    return waechterStand(lies(() => localStorage, STAND_KEY), Date.now()).deckel;
  }

  // Ohne Buehne gibt es nichts zu drehen: Zuruecksetzen und Bedienhinweis gehen mit.
  // why waehlt den Text (data-blocked, -soft, -failed an #hg-fallback), ohne
  // passenden Text bleibt der allgemeine; die Konsole nennt die Ursache.
  const fallback = $('hg-fallback');
  // Kleine Zeilen unter einer Meldung der Buehne (eine je Eintrag); ersetzt die vorigen
  function notiz(el, zeilen) {
    el.querySelector('.hgx-spur')?.remove();
    if (!zeilen.length) return;
    const box = doc.createElement('small');
    box.className = 'hgx-spur';
    for (const z of zeilen) {
      const row = doc.createElement('span');
      row.textContent = z;
      box.append(row);
    }
    el.append(box);
  }
  // Der technische Grund eines Fehlers als kleine Zeile unter der Meldung:
  // Vom Telefon kommt keine Konsole zurueck, und „konnte nicht geladen
  // werden“ allein sagt nicht, woran es lag. Adressen kuerzt er auf den
  // Dateinamen.
  function grund(el, e) {
    const text = String(e?.message ?? e ?? '').replace(/\bhttps?:\/\/[^\s"'<>]*\/([^\s"'<>/?#]+)[^\s"'<>]*/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 140);
    notiz(el, text && el.dataset.grund ? [`${el.dataset.grund} ${text}`] : []);
  }
  // Schmal stehen die Meldungen der Buehne an ihrem Fuss und der Titelblock
  // oben. Mit Knopf, Verlauf oder Grund ist eine Meldung hoeher als der Platz
  // dazwischen und laege ueber den Knoepfen des Titels: Dann waechst die
  // Buehne um das, was fehlt, und geht mit der Meldung wieder zurueck.
  // offset* wie bei cover(): der Titel faehrt beim Wechsel mit translateY ein.
  // Liest nur das Dokument (keine Namen von weiter unten): showShip() ruft
  // sie auch.
  function meldungPlatz() {
    const fb = $('hg-fallback'), buehne = fb.parentElement, title = doc.querySelector('.hg-title');
    buehne.style.minHeight = '';
    if (!title || !window.matchMedia('(max-width: 760px)').matches) return;
    const oben = title.offsetTop + title.offsetHeight - $('hg-canvas').offsetTop + 12;
    let need = 0;
    for (const el of [fb, $('hgx-modelerr')]) {
      // unten: Abstand zum Fuss der Buehne, wie ihn das Stilblatt setzt
      if (el && !el.hidden) need = Math.max(need, oben + el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0));
    }
    if (need > buehne.offsetHeight) buehne.style.minHeight = `${Math.ceil(need)}px`;
  }
  window.addEventListener('resize', meldungPlatz, { passive: true });
  function noStage(why, detail) {
    loadEl.hidden = true;
    delete main.dataset.holo;
    laufEnde();
    // ohne Buehne keine Stationen in der Halle: die Tafeln der Seite gelten
    // und keine Orte: ein ?ort=leit aus der Adresse faellt zurueck aufs Feld
    if (stage3d !== false || stageOrte !== false) {
      stage3d = false; stageOrte = false;
      queueMicrotask(() => { if (state.ort === 'leit') setState({ ort: 'halle' }); else paintStation(); });
    }
    if (why && fallback.dataset[why]) fallback.textContent = fallback.dataset[why];
    // Vom Waechter abgestellt: ein Knopf versucht es in der niedrigen Stufe,
    // darunter die Spur der Abbrueche (sie bleibt ueber den Versuch stehen)
    if (why === 'crash' && fallback.dataset.retry) {
      const stand = waechterStand(lies(() => localStorage, STAND_KEY), Date.now());
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'hgx-retry';
      b.textContent = fallback.dataset.retry;
      // Ohne Speicher laedt der Knopf trotzdem neu: ein Versuch je Druck
      b.addEventListener('click', () => {
        standSchreiben({ ab: null, deckel: 'niedrig', seit: Date.now(), spur: stand.spur });
        location.reload();
      });
      fallback.append(b);
      const stufenWort = (k) => $('hgx-gfx')?.querySelector(`option[value="${k}"]`)?.textContent ?? '';
      const zeilen = waechterVerlauf(stand.spur, (k) => (WAECHTER.stufen.includes(k) ? stufenWort(k) : fallback.dataset[`spur${k[0].toUpperCase()}${k.slice(1)}`] ?? ''));
      if (zeilen.length && fallback.dataset.spur) notiz(fallback, [fallback.dataset.spur, ...zeilen]);
    }
    // Nicht gestartet: der Grund in Kurzform darunter
    if (why === 'failed') grund(fallback, detail);
    fallback.hidden = false;
    meldungPlatz();
    $('hg-reset').hidden = true;
    const hint = doc.querySelector('.hg-hint');
    if (hint) hint.hidden = true;
    console.warn(`[hangar] ohne 3D-Ansicht: ${why || 'kein WebGL2'}`, detail ?? '');
  }
  // Ohne GPU zeichnet der Browser WebGL in Software: gemessen knapp 11 s je
  // Bild (SwiftShader, 1280x720), und die ganze Seite steht, Panel und Dock
  // mit. Dann gilt der Rueckfall, Werte, Dock und Flotte bleiben bedienbar.
  // failIfMajorPerformanceCaveat lehnt den Software-Rueckfall ab; ein per
  // Schalter erzwungener SwiftShader meldet sich nur ueber seinen Namen.
  // Der Name des Chips geht an den Viewer: Er waehlt danach die
  // Leistungsstufe (pickQuality in hangar-viewer.js).
  const SOFT_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;
  let gpuName = '';
  // Was der Buehne fehlt: '' nichts, 'none' WebGL2 kennt der Browser nicht,
  // 'blocked' WebGL2 gibt es, aber keinen Kontext. So antwortet Chrome, wenn
  // die Seite den Grafiktreiber einmal zurueckgesetzt hat: Er sperrt sie bis
  // zum Neustart des Browsers („Web page caused context loss and was
  // blocked“). Gibt es den Kontext nur ohne den Vorbehalt: 'soft', wenn der
  // Name nach Software klingt, sonst 'caveat' (ein Chip, den der Browser nur
  // bremst, etwa ein Treiber auf seiner Sperrliste; allgemeiner Text).
  let gpuWhy = '';
  const chipOf = (gl) => {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  };
  function gpuMiss() {
    if (typeof WebGL2RenderingContext === 'undefined') return 'none';
    try {
      const c = doc.createElement('canvas');
      c.addEventListener('webglcontextcreationerror', (e) => { gpuWhy = e.statusMessage || gpuWhy; });
      const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
      if (!gl) {
        const any = doc.createElement('canvas').getContext('webgl2');
        if (!any) return 'blocked';
        gpuWhy = chipOf(any);
        return SOFT_GL.test(gpuWhy) ? 'soft' : 'caveat';
      }
      gpuName = gpuWhy = chipOf(gl);
      return SOFT_GL.test(gpuName) ? 'soft' : '';
    } catch (e) {
      gpuWhy = String(e?.message || e);
      return 'blocked';
    }
  }
  // Grafik-Schalter: Automatisch zeigt dahinter die Stufe, die gerade
  // laeuft (sinkt sie beim Nachregeln, wandert die Anzeige mit). Eine Wahl
  // gilt ab dem naechsten Laden, weil Lampen, Texturen und Moebel beim Laden
  // entstehen; die Seite laedt deshalb gleich neu.
  function grafikSchalter(v) {
    const wrap = $('hgx-gfx-wrap'), sel = $('hgx-gfx');
    if (!wrap || !sel || typeof v.quality !== 'function') return;
    const auto = sel.querySelector('option[value="auto"]');
    const autoText = auto.textContent;
    const textOf = (l) => sel.querySelector(`option[value="${l}"]`)?.textContent ?? l;
    // Unter einem Deckel des Waechters laeuft nicht die gewaehlte Stufe: dann steht Automatisch da
    const wahl = v.quality().forced ? GRAFIK : null;
    sel.value = v.quality().levels.includes(wahl) ? wahl : 'auto';
    // Von Hand gewaehlt, steht hinter Automatisch nichts: welche Stufe es waere, weiss erst ein Laden ohne Wahl
    // Die Blase am Zeichen nennt, was gerade gilt, wie die offene Liste.
    const paint = (q) => {
      auto.textContent = q.forced ? autoText : `${autoText} · ${textOf(q.level)}`;
      $('hgx-gfx-now').textContent = sel.selectedOptions[0]?.textContent ?? '';
    };
    paint(v.quality());
    v.onQuality(paint);
    wrap.hidden = false;
    sel.addEventListener('change', () => {
      try {
        if (sel.value === 'auto') localStorage.removeItem(GRAFIK_KEY);
        else localStorage.setItem(GRAFIK_KEY, sel.value);
      } catch { /* ohne Speicher gilt die Wahl nur ueber die Adresse */ }
      // Eine Wahl von Hand hebt den Deckel des Waechters auf
      standSchreiben({ ab: null, deckel: null, seit: 0 });
      const u = new URL(location.href);
      if (!canStore()) {
        if (sel.value === 'auto') u.searchParams.delete('grafik'); else u.searchParams.set('grafik', sel.value);
        location.replace(u.href);
      } else location.reload();
    });
  }
  // Ton-Schalter: Geraeusche von Plattform, Tor und Dampf an oder aus,
  // gemerkt unter hg-ton (nur 'an' wird gespeichert). Vorgabe aus, bis die
  // Geraeusche aus dem Spiel kommen statt gerechnet (Krisz, 20.10.2026:
  // „wtf sind das denn für geräusche?“).
  const TON_KEY = 'hg-ton';
  const tonAn = () => { try { return localStorage.getItem(TON_KEY) === 'an'; } catch { return false; } };
  function tonSchalter(v) {
    const btn = $('hgx-snd');
    if (!btn || typeof v.sound !== 'function' || !v.sound().can) return;
    const paint = (on) => {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      $('hgx-snd-now').textContent = on ? btn.dataset.on : btn.dataset.off;
    };
    paint(v.sound().on);
    btn.hidden = false;
    btn.addEventListener('click', () => {
      const on = !v.sound().on;
      v.setSound(on);
      paint(on);
      try {
        if (on) localStorage.setItem(TON_KEY, 'an');
        else localStorage.removeItem(TON_KEY);
      } catch { /* ohne Speicher gilt die Wahl bis zum Neuladen */ }
    });
  }
  // Einsteigen (hangar-viewer.js enter/leave): sichtbar, solange das gezeigte
  // Schiff einen begehbaren Innenraum hat; drinnen heisst der Knopf
  // Aussteigen, und statt des Bedienhinweises steht der zum Gehen
  // (data-walk). Ein Klick waehrend des Ladens steigt gleich wieder aus.
  function walkSchalter(v) {
    const btn = $('hgx-walk');
    if (!btn || typeof v.onWalk !== 'function') return;
    const txt = $('hgx-walk-now');
    v.onWalk((s) => {
      btn.hidden = !s.can && !s.on;
      btn.setAttribute('aria-pressed', s.on ? 'true' : 'false');
      txt.textContent = s.busy ? btn.dataset.load : s.on ? btn.dataset.out : btn.dataset.in;
      const was = main.dataset.walk === 'on';
      if (s.on) main.dataset.walk = 'on';
      else delete main.dataset.walk;
      if (was !== !!s.on) paintStation();
    });
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-pressed') === 'true') v.leave();
      else { hintSeen(); v.enter(); }
    });
  }
  function canStore() {
    try { localStorage.setItem('hg-probe', '1'); localStorage.removeItem('hg-probe'); return true; } catch { return false; }
  }
  // Der Bedienhinweis geht beim ersten Anfassen der Halle oder dem ersten
  // Schiffswechsel per Pfeiltaste und bleibt weg
  // (das Inline-Skript in HangarPage.astro liest hg-hint vor dem ersten Bild).
  const HINT_KEY = 'hg-hint';
  function hintSeen() {
    if (main.dataset.hint === 'seen') return;
    main.dataset.hint = 'seen';
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ohne Speicher kommt er beim naechsten Laden wieder */ }
  }
  for (const ev of ['pointerdown', 'wheel']) $('hg-canvas').addEventListener(ev, hintSeen, { once: true, passive: true });

  // Erst der Waechter, dann der Zeichenkontext: Was er abgestellt hat,
  // fasst die Grafik gar nicht erst an.
  const startBuehne = async () => {
    const deckel = await waechterStart();
    if (deckel === 'aus') { noStage('crash'); return; }
    const miss = gpuMiss();
    if (miss) { noStage(miss, gpuWhy); return; }
    loadEl.hidden = false;
    // Lauf offen, die Stufe folgt, sobald der Viewer sie gewaehlt hat
    lauf = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, stufe: null, phase: 'laden' };
    offenSetzen();
    import(stageCfg.viewer)
      .then((m) => m.initHangar($('hg-canvas'), { reduceMotion: reduce, ...stageCfg.opts, gpu: gpuName, quality: GRAFIK, cap: deckel, pad: BODEN, sound: tonAn() }))
      .then((v) => {
        viewer = v;
        if (lauf) { lauf.stufe = v.quality().start; offenSetzen(); }
        // ab 90 % sind die Dateien da, der Rest ist Auspacken, Uebersetzen und Hochladen
        v.onProgress((p) => {
          bar.style.setProperty('--p', `${p}%`);
          if (p >= 90) laufPhase('bauen');
        });
        v.onFrame(placeMarks);
        // Kontext weg: die Meldung steht ueber der Buehne, und der Waechter
        // zaehlt einen Abbruch. Kommt der Kontext zurueck, laedt die Seite
        // neu (wie beim Grafik-Schalter): Umgebung und Hallenschatten
        // entstehen nur beim Laden, der Zustand steht in der Adresse. Der
        // naechste Lauf startet unter dem Deckel des Waechters, also nach
        // dem zweiten Verlust eine Stufe tiefer und zuletzt gar nicht mehr.
        // Konnte der Abbruch nicht gemerkt werden (kein Speicher), bleibt die
        // Meldung stehen: ungezaehlt neu zu laden waere wieder die Schleife.
        // Ein Verlust im Hintergrund zaehlt nicht (sichtbarSeit): er laedt
        // neu, ohne den Deckel zu senken, aber erst, wenn die Seite wieder zu
        // sehen ist. Im Hintergrund neu zu laden waere dort die Schleife, und
        // der naechste Lauf im Vordergrund zaehlt wieder.
        let neuLaden = false;
        const neuWennSichtbar = () => {
          if (doc.hidden) doc.addEventListener('visibilitychange', neuWennSichtbar, { once: true });
          else location.reload();
        };
        v.onLost((lost) => {
          if (lost) {
            delete main.dataset.holo;
            fallback.textContent = fallback.dataset.lost;
            fallback.hidden = false;
            meldungPlatz();
            // Ladebalken, Knoepfe und Bedienhinweis der Buehne gehen mit
            // (data-lost in HangarPage.astro): Sie steuern nichts mehr, am
            // Telefon lagen die Knoepfe ueber der Meldung, und was noch laedt,
            // blendete sie sonst wieder ein.
            main.dataset.lost = 'on';
            const stufe = lauf?.stufe ?? v.quality().start, phase = lauf?.phase ?? null;
            laufEnde();
            if (imVordergrund()) neuLaden = !!abbruch(stufe, 'kontext', phase);
            else {
              neuLaden = true;
              console.warn('[hangar] Zeichenkontext im Hintergrund verloren, nicht als Abbruch gezaehlt');
            }
            return;
          }
          if (neuLaden) neuWennSichtbar();
        });
        // Schmal (Umbruch wie in HangarPage.astro) liegt der Titelblock samt
        // Knoepfen ueber dem oberen Teil der Buehne: das Schiff rueckt darunter.
        // offset* statt getBoundingClientRect: beim Wechsel faehrt der Titel
        // mit translateY ein (hg-swap), gemessen wird in diesem Augenblick.
        const title = doc.querySelector('.hg-title'), canvas = $('hg-canvas'), narrow = window.matchMedia('(max-width: 760px)');
        const cover = () => v.setCover(narrow.matches && title ? title.offsetTop + title.offsetHeight - canvas.offsetTop : 0);
        if (title) new ResizeObserver(cover).observe(title);
        narrow.addEventListener('change', cover);
        cover();
        // Steht das Hologramm, weicht der Titelblock der Seite (fuer Vorleser
        // bleibt er da); findet es am stehenden Fahrzeug keinen Platz, kommt
        // er zurueck, damit der Name sichtbar bleibt. Es bleibt im Bild unter der Kopfzeile, links neben
        // der Tafel der Seite und neben den Knoepfen auf der Buehne. Vom
        // Titelblock zaehlt nur, was danach bleibt: die Knopfreihe oben an
        // seinem Platz. Sonst fand das Hologramm neben dem ganzen Block oft
        // keinen Platz und erschien nie, und der Block wich nie.
        // Ab 761 px liegt links die Schiffsauswahl ueber der Buehne, offen oder
        // als schmale Spalte; schmal steht sie unter der Tafel und zaehlt nicht.
        const side = doc.querySelector('.hg-side'), dockEl = doc.querySelector('.hg-dock'), nav = $('topbar'), acts = title?.querySelector('.hgx-actions');
        const hint = $('hg-hint'), keep = [$('hg-tools'), hint, $('hgx-tray'), $('hgx-st')];
        const safe = () => {
          const c = canvas.getBoundingClientRect();
          const on = (el) => {
            if (el === hint && main.dataset.hint === 'seen') return null;
            const r = el?.getBoundingClientRect();
            return r && r.width && r.height && r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top ? r : null;
          };
          const p = on(side), d = on(dockEl), b = on(nav), t = on(title), a = t && on(acts);
          const rects = keep.map(on);
          if (a) rects.push({ left: a.left, right: a.right, top: t.top, bottom: t.top + a.height });
          v.setSafe?.({
            l: d ? d.right - c.left + 14 : 0, t: b ? b.bottom - c.top + 14 : 0, r: p ? c.right - p.left + 14 : 0,
            rects: rects.filter(Boolean).map((r) => ({ l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top })),
          });
        };
        v.onHolo?.((on) => {
          if (on) main.dataset.holo = 'on';
          else delete main.dataset.holo;
          safe();
        });
        stageSafe = safe;
        for (const el of [side, dockEl, canvas, title, ...keep]) if (el) new ResizeObserver(safe).observe(el);
        window.addEventListener('scroll', safe, { passive: true });
        // der Bedienhinweis geht nach dem ersten Anfassen aus (data-hint)
        new MutationObserver(safe).observe(main, { attributes: true, attributeFilter: ['data-hint'] });
        safe();
        $('hg-reset').addEventListener('click', () => {
          if (state.hp) setState({ hp: null });
          else v.resetView();
        });
        grafikSchalter(v);
        tonSchalter(v);
        walkSchalter(v);
        // Stationen in 3D, wenn die Buehne sie kann
        stage3d = v.canStation?.() === true;
        v.onStation?.(onStationAct);
        // Orte, wenn sie einen Leitstand hat; sonst gilt die Adresse nicht
        stageOrte = stage3d && v.canPlace?.('leit') === true;
        v.onPlace?.(onPlace);
        if (!stageOrte && state.ort === 'leit') setState({ ort: 'halle' });
        viewerShow(state.ship);
        paintStation();
      })
      .catch((e) => noStage('failed', e));
  };
  startBuehne().catch((e) => noStage('failed', e));

  writeUrl();
  syncControls();
  setDock(main.dataset.dock !== 'closed' || filtered(), false);
  syncFleetBtn();
  paintFleetFilter();
  // fleet.js laeuft vor diesem Modul (beide verzoegert, in Dokumentfolge);
  // das Ereignis faengt nur den Fall, dass es spaeter kommt.
  if (window.VBFleet) window.VBFleet.subscribe(onFleet);
  else window.addEventListener('vb-fleet-ready', () => window.VBFleet.subscribe(onFleet), { once: true });
  paintTray();
  paintStation();
  if (state.view === 'compare') paintView();
  applyDock();
  // Mit einem Filter aus der Adresse steht das gezeigte Schiff oft weiter
  // unten in der Liste; ohne steht oben „Wofür?“, und dort bleibt die Rolle.
  if (narrowed()) scrollToCard(state.ship, 'auto');
  if (state.ship !== ctx.defaultShip) showShip(state.ship);
  else {
    markCards(state.ship);
    applyTab();
    applyHp();
    prefetchNeighbours(state.ship);
  }
}
