/* ============================================================
   pruefstand.mjs — eine ausgelieferte Seite OHNE Browser bedienen.

   WARUM ES DEN GIBT: Was die Werkzeuge erst im Browser zusammensetzen
   (Blueprint-Fenster, Fundortlisten, Ertragsvergleich, Trefferzahlen,
   Vorlesetexte), sieht kein Tor, das dist/ als Text liest. Bis zum
   04.11.2026 gab es dafuer genau eine Pruefung (verify:clienttext, nur der
   Item Finder, mit einem eigenen Mini-DOM). Jedes weitere Werkzeug haette
   ein weiteres Mini-DOM gebraucht — tests/e2e/helpers/ hat schon sieben.

   WAS ES TUT: laedt eine Seite aus dist/ in ein echtes DOM (linkedom),
   fuehrt ihre Skripte in node:vm aus — Inline-Skripte, /assets/*.js und
   die Astro-Module aus /_astro/ (mit esbuild zu einem Stueck gebuendelt) —
   in Seitenreihenfolge, mit fetch() gegen dist/ statt gegen das Netz, mit
   einer Uhr, die nur auf Zuruf laeuft, und mit einer Text-Senke: jedes
   Element, in das ein Skript Text schreibt, wird gemerkt. erkunde() bedient
   danach, was bedienbar ist (Auswahllisten, Regler, Haken, Knoepfe, Reiter,
   und alles, was die Skripte per closest('…')/matches('…') als Klickziel
   ansprechen), und meldet nach jedem Schritt die beschriebenen Bereiche.

   Schiene A: kein Netz (fremde Hosts antworten "offline", wie ohne
   Verbindung), kein git, kein Browser. Kindprozess nur esbuilds Dienst,
   wenn eine Seite ein Modul laedt.
   ============================================================ */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';

const NICHT_AUSFUEHREN = new Set(['application/ld+json', 'application/json', 'importmap', 'text/template', 'speculationrules']);
/* Skripte, die der Pruefstand bewusst NICHT ausfuehrt (benannt, Grundsatz 6). */
export const AUSGELASSEN = [
  { pfad: '/vendor/umami/', anlass: 'Besucherzaehler: sendet nur an den Zaehl-Host, schreibt keinen sichtbaren Text' },
];
/* Zeitlimit fuer jeden synchronen Lauf (Skriptstart, Ereignis, Zeitgeber):
   eine Endlosschleife ist ein Befund, kein haengendes Tor. */
const ZEITLIMIT_MS = 5000;

/* Dateien aus dist/ einmal je Lauf lesen: dieselben Daten (Rezepte,
   Spieldaten) laden viele Seiten. */
const DATEIEN = new Map();
const lies = (pfad) => { if (!DATEIEN.has(pfad)) DATEIEN.set(pfad, readFileSync(pfad, 'utf8')); return DATEIEN.get(pfad); };

/* ---------- linkedom einmal ergaenzen ----------
   linkedom teilt seine Klassen ueber alle Dokumente. Die Ergaenzungen
   stehen deshalb hier EINMAL, und die Text-Senke fragt ueber das Dokument,
   zu welcher Seite ein Element gehoert. */
const SEITE = new WeakMap(); // document -> Seitenzustand
let ergaenzt = false;
function ergaenze(lw) {
  if (ergaenzt) return;
  ergaenzt = true;
  const noop = () => {};
  const EP = lw.HTMLElement.prototype;
  const ElP = lw.Element.prototype;
  const NP = lw.Node.prototype;
  for (const k of ['scrollIntoView', 'focus', 'blur', 'select', 'setSelectionRange', 'reportValidity', 'setCustomValidity', 'scrollTo', 'scrollBy', 'releasePointerCapture', 'setPointerCapture', 'requestFullscreen', 'showPopover', 'hidePopover']) if (!EP[k]) EP[k] = noop;
  if (!EP.checkValidity) EP.checkValidity = () => true;
  if (!EP.getBoundingClientRect) EP.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  if (!EP.getClientRects) EP.getClientRects = () => [];
  if (!EP.checkVisibility) EP.checkVisibility = () => true;
  if (!EP.animate) EP.animate = () => ({ finished: Promise.resolve(), cancel: noop, finish: noop, play: noop, pause: noop, onfinish: null, addEventListener: noop });
  for (const k of ['offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight', 'scrollTop', 'scrollLeft', 'offsetTop', 'offsetLeft']) {
    if (!(k in EP)) Object.defineProperty(EP, k, { get() { return 0; }, set() {}, configurable: true });
  }
  if (!('offsetParent' in EP)) Object.defineProperty(EP, 'offsetParent', { get() { return this.parentNode; }, configurable: true });
  const FP = lw.HTMLFormElement && lw.HTMLFormElement.prototype;
  if (FP) {
    FP.reset = FP.reset || function () {
      for (const el of this.querySelectorAll('input, textarea, select')) {
        const typ = (el.getAttribute('type') || '').toLowerCase();
        if (typ === 'checkbox' || typ === 'radio') el.checked = el.hasAttribute('checked');
        else if (el.tagName !== 'SELECT') el.value = el.getAttribute('value') || '';
      }
    };
    FP.requestSubmit = FP.requestSubmit || function () { this.dispatchEvent(new lw.Event('submit', { bubbles: true, cancelable: true })); };
    FP.submit = FP.submit || noop;
  }
  const DP = lw.HTMLDialogElement && lw.HTMLDialogElement.prototype;
  if (DP) {
    DP.showModal = DP.showModal || function () { this.setAttribute('open', ''); };
    DP.show = DP.show || function () { this.setAttribute('open', ''); };
    DP.close = DP.close || function () { this.removeAttribute('open'); };
  }
  // <select>: value, selectedIndex, options, add/remove(index) — linkedom
  // kennt nur den Lesezugriff auf value, und remove() ohne Argument.
  const SP = lw.HTMLSelectElement.prototype;
  const opts = (s) => [...s.querySelectorAll('option')];
  const wert = (o) => (o.hasAttribute('value') ? o.getAttribute('value') : o.textContent);
  Object.defineProperty(SP, 'options', { get() { return opts(this); }, configurable: true });
  Object.defineProperty(SP, 'length', { get() { return opts(this).length; }, configurable: true });
  Object.defineProperty(SP, 'value', {
    get() { const o = opts(this); const s = o.find((x) => x.hasAttribute('selected')) || o[0]; return s ? wert(s) : ''; },
    set(v) { let hit = false; for (const x of opts(this)) { if (!hit && wert(x) === String(v)) { hit = true; x.setAttribute('selected', ''); } else x.removeAttribute('selected'); } },
    configurable: true,
  });
  Object.defineProperty(SP, 'selectedIndex', {
    get() { const o = opts(this); const i = o.findIndex((x) => x.hasAttribute('selected')); return i < 0 ? (o.length ? 0 : -1) : i; },
    set(i) { opts(this).forEach((x, k) => (k === +i ? x.setAttribute('selected', '') : x.removeAttribute('selected'))); },
    configurable: true,
  });
  Object.defineProperty(SP, 'selectedOptions', { get() { const o = opts(this); return [o[this.selectedIndex]].filter(Boolean); }, configurable: true });
  const elRemove = ElP.remove;
  SP.remove = function (i) { if (!arguments.length) return elRemove.call(this); const o = opts(this)[i]; if (o) o.remove(); };
  SP.add = function (o, vor) { const ref = typeof vor === 'number' ? opts(this)[vor] : vor; if (ref) ref.before(o); else this.appendChild(o); };
  const OP = lw.HTMLOptionElement.prototype;
  Object.defineProperty(OP, 'value', { get() { return wert(this); }, set(v) { this.setAttribute('value', v); }, configurable: true });
  Object.defineProperty(OP, 'selected', { get() { return this.hasAttribute('selected'); }, set(v) { if (v) this.setAttribute('selected', ''); else this.removeAttribute('selected'); }, configurable: true });
  Object.defineProperty(OP, 'text', { get() { return this.textContent; }, set(v) { this.textContent = v; }, configurable: true });
  Object.defineProperty(OP, 'index', { get() { const s = this.closest('select'); return s ? opts(s).indexOf(this) : 0; }, configurable: true });

  // Text-Senke: welche Elemente hat ein Skript beschrieben?
  const merke = (n) => {
    const doc = n && n.ownerDocument;
    const st = doc && SEITE.get(doc);
    if (!st || !st.laeuft) return;
    const el = n.nodeType === 1 ? n : n.parentNode;
    if (el && el.nodeType === 1) st.schmutz.add(el);
  };
  // Eingefuegte Knoten nur beim ERSTEN Auftritt: ein Werkzeug, das seine
  // 1.608 Karten zum Sortieren nur umhaengt, schreibt keinen neuen Text —
  // die erste Fassung hat dabei jedes Mal das ganze Raster neu gelesen
  // (Crafting 61 s je Sprache). Text, der sich IN einem bekannten Knoten
  // aendert, meldet der Setter (innerHTML, textContent, nodeValue,
  // setAttribute) trotzdem. Ein Fragment gibt seine Kinder ab.
  const merkeNeu = (n) => {
    if (!n || typeof n !== 'object' || !n.nodeType) return;
    if (n.nodeType === 11) { for (const c of n.childNodes) merkeNeu(c); return; }
    const st = SEITE.get(n.ownerDocument);
    if (!st || !st.laeuft || st.bekannt.has(n)) return;
    st.bekannt.add(n);
    merke(n);
  };
  const umschreibe = (proto, prop) => {
    let p = proto, d;
    while (p && !(d = Object.getOwnPropertyDescriptor(p, prop))) p = Object.getPrototypeOf(p);
    if (!d || !d.set) return;
    Object.defineProperty(proto, prop, { get: d.get, set(v) { d.set.call(this, v); merke(this); }, configurable: true });
  };
  for (const prop of ['innerHTML', 'outerHTML', 'textContent', 'innerText', 'value']) umschreibe(EP, prop);
  for (const prop of ['textContent', 'nodeValue', 'data']) umschreibe(lw.Text.prototype, prop);
  for (const m of ['appendChild', 'insertBefore', 'replaceChild']) {
    const o = NP[m];
    if (o) NP[m] = function (n, ...rest) {
      const kinder = n && n.nodeType === 11 ? [...n.childNodes] : null;
      const r = o.call(this, n, ...rest);
      if (kinder) kinder.forEach(merkeNeu); else merkeNeu(n);
      return r;
    };
  }
  // Zeichenketten als Argument (append('3 Treffer')) werden zu neuem Text
  // im Ziel bzw. in dessen Elternteil; insertAdjacent* parst neues Markup.
  const imEltern = new Set(['after', 'before', 'replaceWith']);
  for (const m of ['append', 'prepend', 'replaceChildren', 'after', 'before', 'replaceWith', 'insertAdjacentElement']) {
    const o = ElP[m];
    if (!o) continue;
    ElP[m] = function (...a) {
      const ziel = imEltern.has(m) ? this.parentNode : this;
      const knoten = a.flatMap((x) => (x && x.nodeType === 11 ? [...x.childNodes] : [x]));
      const r = o.apply(this, a);
      for (const x of knoten) if (x && typeof x === 'object' && x.nodeType) merkeNeu(x); else if (x != null && typeof x !== 'object' && ziel) merke(ziel);
      return r;
    };
  }
  for (const m of ['insertAdjacentHTML', 'insertAdjacentText']) {
    const o = ElP[m];
    if (!o) continue;
    ElP[m] = function (wo, inhalt) {
      const r = o.call(this, wo, inhalt);
      merke(/^(beforebegin|afterend)$/i.test(wo) && this.parentNode ? this.parentNode : this);
      return r;
    };
  }
  const setAttr = ElP.setAttribute;
  ElP.setAttribute = function (n, v) { setAttr.call(this, n, v); if (TEXT_ATTRS.includes(n) || n === 'value') merke(this); };
  // Direkt gebundene Hoerer merken (Klickziele fuer erkunde()).
  const tgt = lw.EventTarget ? lw.EventTarget.prototype : NP;
  const ael = tgt.addEventListener;
  tgt.addEventListener = function (t, fn, o) {
    const st = this && this.nodeType === 1 && SEITE.get(this.ownerDocument);
    if (st) { if (!st.gebunden.has(this)) st.gebunden.set(this, new Set()); st.gebunden.get(this).add(t); }
    return ael.call(this, t, fn, o);
  };
  // Leinwand: ein stummer 2D-Kontext (Sternenfeld & Co. zeichnen ins Leere).
  const stumm = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : stumm()), apply: () => stumm(), set: () => true });
  if (lw.HTMLCanvasElement) lw.HTMLCanvasElement.prototype.getContext = function () { return stumm(); };
}

/* Attribute, die gelesen oder vorgelesen werden. */
export const TEXT_ATTRS = ['alt', 'title', 'aria-label', 'aria-description', 'aria-valuetext', 'placeholder', 'data-tooltip'];

/**
 * Oeffnet `seite` (Pfad relativ zu dist/) und fuehrt ihre Skripte aus.
 * Rueckgabe: Seitenobjekt mit document, settle(), fire(), ernte(), fehler …
 */
export async function oeffneSeite({ dist, seite, query = '', esbuild, buendel = new Map(), sprache }) {
  const html = lies(join(dist, seite));
  const { window: lw, document } = parseHTML(html);
  ergaenze(lw);
  const st = { schmutz: new Set(), gebunden: new Map(), bekannt: new WeakSet(), laeuft: false };
  SEITE.set(document, st);
  const fehler = [];
  const konsole = [];
  const geladen = [];
  const url = new URL('https://verse-base.com/' + seite.replace(/(^|\/)index\.html$/, '$1') + query);
  const seitenLang = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2).toLowerCase();
  const noop = () => {};

  // ---------- Uhr: laeuft nur in settle() ----------
  let jetzt = 0, tid = 0;
  const timer = new Map();
  const setT = (fn, ms = 0, ...a) => { const id = ++tid; if (typeof fn === 'function') timer.set(id, { at: jetzt + Math.max(0, +ms || 0), fn, a }); return id; };
  const setI = (fn, ms = 0, ...a) => { const id = ++tid; const iv = Math.max(10, +ms || 10); if (typeof fn === 'function') timer.set(id, { at: jetzt + iv, fn, a, iv }); return id; };
  const clearT = (id) => { timer.delete(id); };
  const raf = (fn) => setT(() => fn(jetzt), 16);

  const speicher = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
      setItem: (k, v) => { m.set(String(k), String(v)); },
      removeItem: (k) => { m.delete(String(k)); },
      clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null,
      get length() { return m.size; },
    };
  };

  // ---------- Fenster-Ereignisse ----------
  const winL = new Map();
  const winOn = (t, fn) => { if (!fn) return; if (!winL.has(t)) winL.set(t, []); winL.get(t).push(fn); };
  const winOff = (t, fn) => { const l = winL.get(t); if (l) winL.set(t, l.filter((f) => f !== fn)); };
  const winFire = (ev) => {
    for (const fn of (winL.get(ev.type) || []).slice()) {
      try { (typeof fn === 'function' ? fn : fn.handleEvent).call(ctx, ev); } catch (e) { fehler.push(`window-Ereignis ${ev.type}: ${e && e.message}`); }
    }
    return true;
  };

  // ---------- fetch gegen dist/ ----------
  const antwort = (status, body) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status), url: '',
    headers: { get: () => null, has: () => false, forEach: noop },
    json: async () => JSON.parse(body), text: async () => body, clone() { return antwort(status, body); },
  });
  const fetch = async (u) => {
    const ziel = new URL(String(u && u.url ? u.url : u), url);
    if (ziel.origin !== url.origin) throw new TypeError('Failed to fetch (Pruefstand: kein Netz)');
    geladen.push(ziel.pathname);
    const pfad = join(dist, decodeURIComponent(ziel.pathname));
    if (!existsSync(pfad)) return antwort(404, '');
    return antwort(200, lies(pfad));
  };

  // ---------- Kontext ----------
  class TastenEreignis extends lw.Event {
    constructor(t, i = {}) { super(t, i); Object.assign(this, { key: '', code: '', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, button: 0, buttons: 0, clientX: 0, clientY: 0, deltaY: 0 }, i); }
  }
  const ctx = {
    document,
    console: {
      log: noop, info: noop, debug: noop, group: noop, groupEnd: noop, table: noop, time: noop, timeEnd: noop,
      warn: (...a) => konsole.push(['warn', a.map(String).join(' ')]),
      error: (...a) => konsole.push(['error', a.map(String).join(' ')]),
    },
    location: {
      href: url.href, origin: url.origin, protocol: url.protocol, host: url.host, hostname: url.hostname, port: '',
      pathname: url.pathname, search: url.search, hash: url.hash,
      assign: noop, replace: noop, reload: noop, toString() { return url.href; },
    },
    history: { state: null, length: 1, scrollRestoration: 'auto', pushState(s) { this.state = s; }, replaceState(s) { this.state = s; }, back: noop, forward: noop, go: noop },
    navigator: {
      language: sprache || 'en-US', languages: [sprache || 'en-US'], userAgent: 'Mozilla/5.0 (Pruefstand)', platform: 'Linux',
      onLine: true, cookieEnabled: true, maxTouchPoints: 0, hardwareConcurrency: 4, deviceMemory: 8,
      clipboard: { writeText: async () => {}, readText: async () => '' }, sendBeacon: () => true, vibrate: () => false,
    },
    localStorage: speicher(), sessionStorage: speicher(),
    fetch, setTimeout: setT, clearTimeout: clearT, setInterval: setI, clearInterval: clearT,
    requestAnimationFrame: raf, cancelAnimationFrame: clearT,
    requestIdleCallback: (fn) => setT(() => fn({ didTimeout: false, timeRemaining: () => 50 }), 1), cancelIdleCallback: clearT,
    queueMicrotask, structuredClone, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, AbortSignal,
    Blob, Headers, Request, Response, FormData, ReadableStream, Intl, crypto: webcrypto, atob, btoa, escape, unescape,
    // Supabase baut beim Laden einen Echtzeit-Kanal: ein Sockel, der nie verbindet.
    WebSocket: class { constructor() { this.readyState = 3; } send() {} close() {} addEventListener() {} removeEventListener() {} },
    BroadcastChannel: class { postMessage() {} close() {} addEventListener() {} removeEventListener() {} },
    performance: { now: () => jetzt, timeOrigin: 0, mark: noop, measure: noop, getEntriesByType: () => [], getEntriesByName: () => [], clearMarks: noop },
    matchMedia: (q) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(q), media: q, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, onchange: null }),
    getComputedStyle: () => new Proxy({}, { get: (t, k) => (k === 'getPropertyValue' ? () => '' : '') }),
    innerWidth: 1280, innerHeight: 800, outerWidth: 1280, outerHeight: 800, devicePixelRatio: 1,
    scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0, isSecureContext: true,
    screen: { width: 1280, height: 800, availWidth: 1280, availHeight: 800, orientation: { type: 'landscape-primary', addEventListener: noop } },
    scrollTo: noop, scrollBy: noop, scroll: noop, open: () => null, close: noop, print: noop, focus: noop, blur: noop,
    alert: noop, confirm: () => true, prompt: () => null,
    addEventListener: winOn, removeEventListener: winOff, dispatchEvent: winFire,
    CSS: { escape: (s) => String(s).replace(/([^\w-])/g, '\\$1'), supports: () => false },
    // Was beobachtet wird, gilt als sichtbar — sonst rendert kein Werkzeug,
    // das erst beim Hineinscrollen baut.
    IntersectionObserver: class {
      constructor(cb) { this.cb = cb; this.els = new Set(); }
      observe(el) { this.els.add(el); setT(() => { if (this.els.has(el)) this.cb([{ target: el, isIntersecting: true, intersectionRatio: 1, boundingClientRect: {}, rootBounds: {}, intersectionRect: {} }], this); }, 1); }
      unobserve(el) { this.els.delete(el); } disconnect() { this.els.clear(); } takeRecords() { return []; }
    },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: lw.MutationObserver,
    Image: class { constructor() { this.onload = null; this.onerror = null; this.complete = true; this.naturalWidth = 0; } set src(v) { this._s = v; } get src() { return this._s; } decode() { return Promise.resolve(); } addEventListener() {} },
    Option: class { constructor(text = '', value, defSel, sel) { const o = document.createElement('option'); o.textContent = text; if (value !== undefined) o.setAttribute('value', value); if (sel) o.setAttribute('selected', ''); return o; } },
    KeyboardEvent: TastenEreignis, MouseEvent: TastenEreignis, PointerEvent: TastenEreignis, FocusEvent: TastenEreignis,
    PopStateEvent: TastenEreignis, StorageEvent: TastenEreignis, WheelEvent: TastenEreignis, TouchEvent: TastenEreignis,
    HashChangeEvent: TastenEreignis, PageTransitionEvent: TastenEreignis, SubmitEvent: TastenEreignis,
  };
  for (const k of ['Event', 'CustomEvent', 'InputEvent', 'EventTarget', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLAnchorElement', 'HTMLButtonElement', 'HTMLTemplateElement', 'HTMLCanvasElement', 'HTMLDialogElement', 'HTMLImageElement', 'HTMLFormElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Text', 'DocumentFragment', 'DOMParser', 'NodeList', 'HTMLCollection', 'SVGElement', 'ShadowRoot', 'Range', 'customElements']) {
    if (lw[k]) ctx[k] = lw[k];
  }
  ctx.window = ctx; ctx.self = ctx; ctx.top = ctx; ctx.parent = ctx; ctx.frames = ctx; ctx.globalThis = ctx;
  const def = (o, k, get, set) => { try { Object.defineProperty(o, k, { get, set, configurable: true }); } catch { /* schreibgeschuetzt */ } };
  let zustand = 'loading', keks = '';
  def(document, 'defaultView', () => ctx);
  def(document, 'readyState', () => zustand);
  def(document, 'cookie', () => keks, (v) => {
    const [kv] = String(v).split(';');
    const k = kv.split('=')[0].trim();
    keks = keks.split('; ').filter((x) => x && x.split('=')[0] !== k).concat(/=\s*$/.test(kv) ? [] : [kv.trim()]).join('; ');
  });
  def(document, 'activeElement', () => document.body);
  let aktuellesSkript = null;
  def(document, 'currentScript', () => aktuellesSkript);
  def(document, 'visibilityState', () => 'visible');
  def(document, 'hidden', () => false);
  document.hasFocus = () => true;
  document.execCommand = () => false;
  vm.createContext(ctx);

  // Jeder synchrone Lauf mit Zeitlimit. Die Zielfunktion wird im Kontext
  // aufgerufen, damit das Limit auch fuer die Hoerer gilt.
  ctx.__pruefstandRufe = null;
  const RUF = new vm.Script('__pruefstandRufe()');
  const imKontext = (fn, was) => {
    ctx.__pruefstandRufe = fn;
    try { RUF.runInContext(ctx, { timeout: ZEITLIMIT_MS }); } catch (e) {
      fehler.push(`${was}: ${e && /Script execution timed out/.test(e.message) ? `kein Ende nach ${ZEITLIMIT_MS} ms (Endlosschleife?)` : e && e.message}`);
    } finally { ctx.__pruefstandRufe = null; }
  };

  // Text der Seite, BEVOR ein Skript lief: der gehoert audit:site und
  // verify:sprache. Hier zaehlt nur, was die Skripte schreiben.
  const statisch = new Set(texteAus(document.documentElement, seitenLang).map((x) => x.lang + '|' + x.t.replace(/\s+/g, ' ').trim()));

  // ---------- Skripte in Seitenreihenfolge ----------
  const quellen = [];
  const ausgelassen = [];
  const sofort = [], spaeter = [];
  const alle = [...document.querySelectorAll('script')];
  for (const s of alle) {
    const typ = (s.getAttribute('type') || '').toLowerCase();
    if (NICHT_AUSFUEHREN.has(typ)) continue;
    const modul = typ === 'module';
    const src = s.getAttribute('src');
    if (src) {
      const z = new URL(src, url);
      const aus = AUSGELASSEN.find((a) => z.pathname.startsWith(a.pfad));
      if (z.origin !== url.origin || aus) { ausgelassen.push(z.origin === url.origin ? z.pathname : z.href); continue; }
      const pfad = join(dist, decodeURIComponent(z.pathname));
      if (!existsSync(pfad)) { fehler.push(`Skript ${z.pathname} fehlt in dist/`); continue; }
      (modul || s.hasAttribute('defer') ? spaeter : sofort).push({ name: z.pathname, pfad, modul, el: s });
    } else {
      (modul ? spaeter : sofort).push({ name: `${seite}#inline-${alle.indexOf(s)}`, code: s.textContent, modul, el: s });
    }
  }
  const codeVon = async (e) => {
    if (!e.modul) return e.code ?? lies(e.pfad);
    const key = e.pfad || e.code;
    if (!buendel.has(key)) {
      const r = await esbuild.build({
        ...(e.pfad ? { entryPoints: [e.pfad] } : { stdin: { contents: e.code, resolveDir: dist, loader: 'js' } }),
        bundle: true, format: 'iife', platform: 'browser', write: false, logLevel: 'silent', target: 'es2022',
      });
      buendel.set(key, r.outputFiles[0].text);
    }
    return buendel.get(key);
  };
  st.laeuft = true;
  // document.currentScript wie im Browser: das laufende klassische Skript,
  // bei Modulen null (support.html liest seine Texte aus data-* am Tag).
  const fuehreAus = async (e) => {
    const c = await codeVon(e);
    quellen.push(c);
    aktuellesSkript = e.modul ? null : e.el;
    imKontext(() => vm.runInContext(c, ctx, { filename: e.name }), `Skript ${e.name}`);
    aktuellesSkript = null;
  };
  for (const e of sofort) await fuehreAus(e);
  zustand = 'interactive';
  for (const e of spaeter) await fuehreAus(e);
  imKontext(() => document.dispatchEvent(new lw.Event('DOMContentLoaded', { bubbles: true })), 'DOMContentLoaded');
  zustand = 'complete';
  imKontext(() => { winFire(new lw.Event('load')); winFire(new lw.Event('pageshow')); }, 'load');

  const ruhe = () => new Promise((r) => setImmediate(r));
  /** Laesst Versprechen und Zeitgeber bis `horizont` ms Seitenzeit laufen. */
  async function settle(horizont = 1500) {
    const ende = jetzt + horizont;
    for (let runde = 0; runde < 50_000; runde++) {
      for (let i = 0; i < 3; i++) await ruhe();
      let next = null, nid = null;
      for (const [id, t] of timer) if (t.at <= ende && (!next || t.at < next.at)) { next = t; nid = id; }
      if (!next) break;
      jetzt = Math.max(jetzt, next.at);
      if (next.iv) next.at = jetzt + next.iv; else timer.delete(nid);
      imKontext(() => next.fn(...next.a), 'Zeitgeber');
    }
    for (let i = 0; i < 3; i++) await ruhe();
  }

  const beschreibe = (el) => (el && el.tagName
    ? `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''}>`
    : String(el));
  /** Loest ein Ereignis aus, das blubbert (Delegation am document greift). */
  function fire(el, type, init = {}) {
    const Ev = /^(key|click|dblclick|mouse|pointer|wheel|touch)/.test(type) ? TastenEreignis : lw.Event;
    const ev = new Ev(type, { bubbles: true, cancelable: true, ...init });
    imKontext(() => el.dispatchEvent(ev), `${type} auf ${beschreibe(el)}`);
  }

  /** Die obersten Elemente, die seit dem letzten Aufruf beschrieben wurden.
   *  Was gerade nicht im Dokument haengt, wartet eine Ernte lang (ein
   *  Werkzeug baut seine Karte oft erst fertig und haengt sie dann ein);
   *  danach faellt es weg — sonst sammeln sich die Hilfs-divs von esc(). */
  let ernteNr = 0;
  const wartet = new Map();
  function ernte() {
    ernteNr++;
    const els = [...new Set([...st.schmutz, ...wartet.keys()])];
    st.schmutz.clear();
    const drin = new Set(els);
    const oben = [];
    for (const el of els) {
      if (!el.isConnected) {
        if (!wartet.has(el)) wartet.set(el, ernteNr);
        else if (wartet.get(el) < ernteNr - 1) wartet.delete(el);
        continue;
      }
      wartet.delete(el);
      let x = el.parentNode, unter = false;
      while (x && x.nodeType === 1) { if (drin.has(x) && x.isConnected) { unter = true; break; } x = x.parentNode; }
      if (!unter) oben.push(el);
    }
    return oben;
  }

  return {
    seite, document, window: ctx, seitenLang, statisch, quellen, ausgelassen, fehler, konsole, geladen,
    gebunden: st.gebunden, settle, fire, ernte, beschreibe, imKontext,
    schliesse() { st.laeuft = false; timer.clear(); SEITE.delete(document); },
  };
}

/**
 * Textstellen eines Teilbaums mit ihrer wirksamen Sprache (naechstes
 * lang-Attribut): Textknoten und gelesene Attribute; Skripte, Stile und
 * Vorlagen sind kein Text.
 */
export function texteAus(el, seitenLang) {
  const out = [];
  let lang0 = seitenLang;
  for (let x = el.parentNode; x && x.nodeType === 1; x = x.parentNode) { const l = x.getAttribute('lang'); if (l) { lang0 = l.slice(0, 2).toLowerCase(); break; } }
  const geh = (n, lang) => {
    if (n.nodeType === 3) { const t = n.nodeValue; if (t && t.trim()) out.push({ t, lang }); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE' || tag === 'NOSCRIPT') return;
    const l = n.getAttribute('lang');
    if (l) lang = l.slice(0, 2).toLowerCase();
    for (const a of TEXT_ATTRS) { const v = n.getAttribute(a); if (v && v.trim()) out.push({ t: v, lang, attr: a }); }
    if (tag === 'INPUT' && /^(button|submit|reset)$/i.test(n.getAttribute('type') || '')) { const v = n.getAttribute('value'); if (v && v.trim()) out.push({ t: v, lang, attr: 'value' }); }
    for (const c of n.childNodes) geh(c, lang);
  };
  geh(el, lang0);
  return out;
}

/* ---------- Erkundung ---------- */

/** Klickziele, die die Skripte per Delegation ansprechen: closest('…') / matches('…'). */
export function delegationsZiele(quellen) {
  const sel = new Set();
  for (const q of quellen) for (const m of q.matchAll(/\.(?:closest|matches)\(\s*(['"])((?:(?!\1)[^\\\n])+)\1\s*\)/g)) sel.add(m[2]);
  return [...sel];
}

/* Freitextfelder bekommen zwei Proben: ein Buchstabe (viele Treffer) und
   eine Zeichenfolge ohne Treffer — der "nichts gefunden"-Text ist ein
   klassischer Ort fuer einen vergessenen Rueckfalltext. Kennwort-, Mail-
   und Zahlenfelder nicht (Zahlen bedient der Regler-Zweig). */
const SUCHPROBE_TYPEN = new Set(['text', 'search']);
const SUCHPROBEN = ['a', 'zzqx'];

const ZUSTANDSKLASSE = /^(is-|has-|ist-|js-|on$|off$|active$|open$|sel$|selected$|current$|hidden$|in$|in-)/;
/** Art eines Bedienelements: gleiche Arten werden gemeinsam gezaehlt und gedeckelt. */
export function artVon(el) {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const kl = String(el.className || '').split(/\s+/).filter((c) => c && !ZUSTANDSKLASSE.test(c)).slice(0, 2);
  const da = kl.length ? [] : [...el.attributes].map((a) => a.name).filter((n) => (n.startsWith('data-') && !n.startsWith('data-astro')) || n === 'role').sort();
  const typ = tag === 'input' ? `[type=${(el.getAttribute('type') || 'text').toLowerCase()}]` : '';
  return `${tag}${typ}${kl.map((c) => '.' + c).join('')}${da.map((d) => `[${d}]`).join('')}`;
}

/**
 * Bedient alles Bedienbare unter `wurzel`, Art fuer Art, in bis zu `runden`
 * Runden (was eine Runde neu sichtbar macht, kommt in der naechsten dran).
 * Je Art hoechstens `proArt` Elemente, Arten in `voll` ganz. Nach jedem
 * Schritt: Uhr laufen lassen, beiErnte(elemente, info), dann Escape.
 */
export async function erkunde(p, {
  wurzel = 'main', proArt = 40, voll = [], runden = 3, horizont = 1500, eingaben = {}, ohne = [], budgetMs = 60_000, beiErnte, protokoll,
}) {
  const doc = p.document;
  const root = doc.querySelector(wurzel) || doc.body;
  const ziele = delegationsZiele(p.quellen).filter((s) => { try { doc.querySelector(s); return true; } catch { return false; } });
  const ohneSel = ['header.snav', '.snav', '.snav-deck', 'footer', '.vb-sprache', ...ohne].join(',');
  const raus = (el) => { try { return !!el.closest(ohneSel); } catch { return false; } };
  const sammle = () => {
    const set = new Set();
    for (const el of root.querySelectorAll('select, input, textarea, button, [role=button], [role=tab], summary')) set.add(el);
    for (const el of p.gebunden.keys()) if (root.contains(el)) set.add(el);
    for (const s of ziele) for (const el of root.querySelectorAll(s)) set.add(el);
    // Versteckt heisst: kein Mensch kann es bedienen (FriendsManager blendet
    // "Teilen" ohne navigator.share aus). Was erst eine Aktion sichtbar
    // macht, kommt in der naechsten Runde dran.
    // Ein schlichter Verweis (<a> ohne Kennung, Klasse, data-*) fuehrt im
    // Browser auf eine andere Seite — die laedt der Pruefstand als eigene
    // Seitenart, ein Klick hier kostet nur Zeit (Crafting: 2,7 s je Sprache).
    // Direkt gebundene Verweise bleiben dabei.
    const schlicht = (el) => el.tagName === 'A' && artVon(el) === 'a' && !p.gebunden.has(el);
    return [...set].filter((el) => !raus(el) && !schlicht(el) && !el.hasAttribute('disabled') && !el.closest('[inert], [hidden]'));
  };
  const start = Date.now();
  const erledigt = new Set();
  const z = { arten: 0, aktionen: 0, abgebrochen: false };
  const nach = async (info) => { await p.settle(horizont); beiErnte(p.ernte(), info); };
  const setze = (el, v) => { el.value = String(v); if (el.tagName === 'INPUT') el.setAttribute('value', String(v)); p.fire(el, 'input'); p.fire(el, 'change'); };
  for (let runde = 0; runde < runden && !z.abgebrochen; runde++) {
    const proA = new Map();
    for (const el of sammle()) { const a = artVon(el); if (erledigt.has(a)) continue; if (!proA.has(a)) proA.set(a, []); proA.get(a).push(el); }
    if (!proA.size) break;
    for (const [art, els] of proA) {
      erledigt.add(art);
      z.arten++;
      const tA = Date.now();
      for (const el of voll.includes(art) ? els : els.slice(0, proArt)) {
        if (Date.now() - start > budgetMs) { z.abgebrochen = true; break; }
        if (!el.isConnected) continue;
        const info = { art, runde };
        const tag = el.tagName;
        const typ = (el.getAttribute('type') || '').toLowerCase();
        if (tag === 'SELECT') {
          const alt = el.value;
          for (const o of [...el.querySelectorAll('option')].slice(0, voll.includes(art) ? Infinity : proArt)) { setze(el, o.value); z.aktionen++; await nach(info); }
          setze(el, alt); await nach(info);
        } else if (tag === 'INPUT' && (typ === 'range' || typ === 'number')) {
          const alt = el.value;
          const mn = +(el.getAttribute('min') ?? 0), mx = +(el.getAttribute('max') ?? 100);
          for (const v of [mn, mx, Math.round((mn + mx) / 2)]) { setze(el, v); z.aktionen++; await nach(info); }
          setze(el, alt); await nach(info);
        } else if (tag === 'INPUT' && (typ === 'checkbox' || typ === 'radio')) {
          for (let k = 0; k < (typ === 'checkbox' ? 2 : 1); k++) {
            el.checked = !el.checked;
            p.fire(el, 'click'); p.fire(el, 'input'); p.fire(el, 'change');
            z.aktionen++; await nach(info);
          }
        } else if (tag === 'INPUT' || tag === 'TEXTAREA') {
          const proben = eingaben['#' + el.id] || eingaben[art] || (SUCHPROBE_TYPEN.has(typ || 'text') && !el.hasAttribute('readonly') ? SUCHPROBEN : []);
          if (!proben.length) continue;
          const alt = el.value;
          for (const v of proben) { setze(el, v); p.fire(el, 'keyup'); z.aktionen++; await nach(info); }
          setze(el, alt); await nach(info);
        } else {
          p.fire(el, 'click');
          z.aktionen++;
          await nach(info);
          p.fire(doc, 'keydown', { key: 'Escape', code: 'Escape' });
          await nach(info);
        }
      }
      if (protokoll) protokoll({ art, runde, elemente: els.length, ms: Date.now() - tA });
    }
  }
  return z;
}

/* ---------- Stichprobe: jede Seitenart einmal ----------
   Zwei Seiten gehoeren zur selben Art, wenn sie dieselben Skripte laden
   (Pfad ohne ?v=) und ihre Inline-Skripte dieselbe FORM haben (Text- und
   Zahlwerte herausgenommen: die 7.190 Item- und Crafting-Seiten tragen
   dieselben Skripte mit anderen Daten). Eine neue Werkzeugseite oder ein
   neues Skript auf einer Seitenart ist damit ohne Listenpflege dabei. */
export function seitenArten(dist, { ohne = [] } = {}) {
  const dateien = [];
  const geh = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) geh(p);
      else if (e.name.endsWith('.html')) dateien.push(p.slice(dist.length + 1).replaceAll('\\', '/'));
    }
  };
  geh(dist);
  dateien.sort();
  const arten = new Map();
  for (const seite of dateien) {
    if (ohne.some((o) => seite.startsWith(o.pfad))) continue;
    const html = readFileSync(join(dist, seite), 'utf8');
    const teile = [];
    for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const typ = (/\stype="([^"]*)"/i.exec(attrs) || [])[1] || '';
      if (NICHT_AUSFUEHREN.has(typ.toLowerCase())) continue;
      const src = (/\ssrc="([^"]+)"/i.exec(attrs) || [])[1];
      if (src) { teile.push(src.replace(/[?#].*$/, '')); continue; }
      const form = body.replace(/(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, 'S').replace(/\d+(?:\.\d+)?/g, 'N');
      teile.push('inline:' + createHash('sha1').update(form).digest('hex').slice(0, 10));
    }
    if (!teile.length) continue;
    const lang = ((/<html\b[^>]*\slang="([^"]+)"/i.exec(html) || [])[1] || 'en').slice(0, 2).toLowerCase();
    const key = lang + '|' + teile.sort().join(' ');
    if (!arten.has(key)) arten.set(key, { seite, lang, anzahl: 0 });
    arten.get(key).anzahl++;
  }
  return [...arten.values()];
}
