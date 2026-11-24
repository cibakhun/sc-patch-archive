// Karten unter Chat-Nachrichten (Freundesleiste im Konto): eine Nachricht mit
// einem Link auf ein Schiffsblatt, ein Itemblatt oder ein Loadout zeigt
// darunter eine Karte mit Bild, Art und Namen. Welche Links zählen, sagt
// src/lib/chatLinks.ts; hier entsteht nur das Bild dazu.
//
// Die Karte steht sofort mit fester Höhe da (Art + Name aus der Kennung) und
// wird ergänzt, sobald die Daten da sind. So springt das Protokoll nicht, wenn
// ein Bild später kommt, und ohne Netz bleibt eine brauchbare Karte stehen.
// Daten: Schiffe aus dem Suchindex der Sprache und den Schiffsbildern, Items
// aus ihrem eigenen Blatt (Name und Kategorie), Loadouts aus dem Link selbst.
// Alles einmal je Seite geladen und im Speicher gehalten.
import { cssUrl } from '../lib/cssUrl';
import { chatLinkPath, findChatLinks, splitChatText, type ChatLink } from '../lib/chatLinks';
import { HANGAR_ON } from '../lib/hangarFlag';
import { changeCount, decodeLayout } from '../../assets/hangar-layouts.js';

export interface CardCopy {
  ship: string; item: string; loadout: string;
  stock: string; change1: string; changes: string;
}

type ShipInfo = { name: string; maker: string; role: string };
type Fill = { kind?: string; name?: string; sub?: string; img?: string };

const NS = 'http://www.w3.org/2000/svg';
const MAX_CARDS = 3;

/** Name aus der Kennung, bis die Daten da sind (Herstellerkürzel weg). */
export function nameFromSlug(slug: string, ship: boolean): string {
  const t = String(slug || '').split('-').filter(Boolean);
  if (ship && t.length > 1 && /^[a-z]{3,4}$/.test(t[0])) t.shift();
  return t.map((w) => (/^(i|ii|iii|iv|v|vi)$/.test(w) || /^[a-z]+\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

/** Kurzform für die Freundesliste: Links werden „Loadout · Gladius“. */
export function previewText(body: string, copy: CardCopy): string {
  const links = findChatLinks(body, HANGAR_ON);
  if (!links.length) return body;
  return splitChatText(body, links)
    .map((p) => (typeof p === 'string' ? p : `${kindLabel(p, copy)} · ${nameFromSlug(p.slug, p.kind !== 'item')}`))
    .join('');
}

const kindLabel = (l: ChatLink, c: CardCopy) => (l.kind === 'ship' ? c.ship : l.kind === 'item' ? c.item : c.loadout);

// ---- Daten (einmal je Seite) -------------------------------------------
let shipIdx: Promise<Map<string, ShipInfo>> | null = null;
let thumbs: Promise<Record<string, string>> | null = null;
const items = new Map<string, Promise<Fill | null>>();

const getJson = <T>(url: string, fallback: T): Promise<T> =>
  fetch(url).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback) as Promise<T>;

function ships(lang: 'de' | 'en'): Promise<Map<string, ShipInfo>> {
  if (!shipIdx) {
    shipIdx = getJson<unknown>(lang === 'de' ? '/de/search-index.json' : '/search-index.json', []).then((raw) => {
      const m = new Map<string, ShipInfo>();
      if (!Array.isArray(raw)) return m;
      for (const e of raw as Array<Record<string, unknown>>) {
        if (!e || e.k !== 'schiff' || typeof e.u !== 'string') continue;
        const hit = /\/schiffe\/([a-z0-9-]+)\.html$/.exec(e.u);
        if (hit) m.set(hit[1], { name: String(e.t || ''), maker: String(e.b || ''), role: String(e.x || '') });
      }
      return m;
    });
  }
  return shipIdx;
}

function shipThumbs(): Promise<Record<string, string>> {
  if (!thumbs) thumbs = getJson<Record<string, string>>('/assets/ship-thumbs.json', {});
  return thumbs;
}

async function shipFill(slug: string, lang: 'de' | 'en'): Promise<Fill> {
  const [idx, th] = await Promise.all([ships(lang), shipThumbs()]);
  const s = idx.get(slug);
  return { name: s?.name, sub: s ? [s.maker, s.role].filter(Boolean).join(' · ') : undefined, img: th[slug] };
}

// Ein Itemblatt ist klein (rund 25 kB); Name aus der Überschrift, die
// Kategorie aus dem letzten Pfad-Glied vor dem Blatt selbst.
function itemFill(slug: string, lang: 'de' | 'en'): Promise<Fill | null> {
  const path = chatLinkPath({ start: 0, end: 0, kind: 'item', slug }, lang);
  let p = items.get(path);
  if (!p) {
    p = fetch(path).then(async (r) => {
      if (!r.ok) return null;
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const name = doc.querySelector('main h1')?.textContent?.trim();
      const crumbs = doc.querySelectorAll('.dp-crumbs a');
      const sub = crumbs.length ? crumbs[crumbs.length - 1].textContent?.trim() : undefined;
      return name ? { name, sub } : null;
    }).catch(() => null);
    items.set(path, p);
  }
  return p;
}

// ---- Bauen ---------------------------------------------------------------
function icon(id: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', '#' + id);
  svg.appendChild(use);
  return svg;
}

function span(cls: string, text = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  if (text) s.textContent = text;
  return s;
}

function card(l: ChatLink, lang: 'de' | 'en', c: CardCopy): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'fc-card fc-card--' + l.kind;
  a.href = chatLinkPath(l, lang);
  const pic = span('fc-card__img');
  pic.appendChild(icon(l.kind === 'item' ? 'ic-item' : l.kind === 'loadout' ? 'ic-sliders' : 'ic-ship'));
  const txt = span('fc-card__txt');
  const kind = span('fc-card__k', kindLabel(l, c));
  const name = span('fc-card__n', nameFromSlug(l.slug, l.kind !== 'item'));
  const sub = span('fc-card__s');
  txt.append(kind, name, sub);
  a.append(pic, txt);

  // Loadout: Name und Zahl der Änderungen stehen im Link selbst.
  const lo = l.kind === 'loadout' && l.layout ? decodeLayout(l.layout) : null;
  if (l.kind === 'loadout') {
    if (lo?.name) name.textContent = lo.name;
    const n = lo ? changeCount(lo) : 0;
    sub.textContent = n ? (n === 1 ? c.change1 : c.changes.replace('%n%', String(n))) : c.stock;
  }

  const put = (f: Fill | null) => {
    if (!f) return;
    if (l.kind === 'loadout') {
      if (f.name) {
        kind.textContent = `${c.loadout} · ${f.name}`;
        if (!lo?.name) name.textContent = f.name;
      }
    } else {
      if (f.name) name.textContent = f.name;
      if (f.sub) sub.textContent = f.sub;
    }
    const bild = cssUrl(f.img);
    if (bild) {
      pic.textContent = '';
      pic.style.backgroundImage = bild;
      pic.classList.add('has-img');
    }
  };
  (l.kind === 'item' ? itemFill(l.slug, lang) : shipFill(l.slug, lang)).then(put, () => {});
  a.setAttribute('aria-label', `${kind.textContent}: ${name.textContent}`);
  return a;
}

/**
 * Nachrichtentext als Absatz mit Links, dazu bis zu drei Karten (jedes Ziel
 * einmal). Ohne erkannten Link: reiner Text und keine Karten.
 */
export function renderChatBody(body: string, lang: 'de' | 'en', c: CardCopy): { text: HTMLParagraphElement; cards: HTMLElement | null } {
  const p = document.createElement('p');
  const links = findChatLinks(body, HANGAR_ON);
  if (!links.length) {
    p.textContent = body;
    return { text: p, cards: null };
  }
  for (const part of splitChatText(body, links)) {
    if (typeof part === 'string') { p.append(part); continue; }
    const a = document.createElement('a');
    a.href = chatLinkPath(part, lang);
    // Ohne https:// und lange Loadout-Codes gekürzt: die Karte darunter zeigt,
    // was es ist.
    const raw = body.slice(part.start, part.end).replace(/^https?:\/\//, '');
    a.textContent = raw.length > 56 ? raw.slice(0, 48) + '…' : raw;
    p.append(a);
  }
  const seen = new Set<string>();
  const box = document.createElement('div');
  box.className = 'fc-cards';
  for (const l of links) {
    const key = chatLinkPath(l, lang);
    if (seen.has(key) || seen.size >= MAX_CARDS) continue;
    seen.add(key);
    box.appendChild(card(l, lang, c));
  }
  return { text: p, cards: box };
}
