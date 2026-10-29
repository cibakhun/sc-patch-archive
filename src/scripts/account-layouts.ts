// Hangar-Loadouts auf der Kontoseite: dieselbe Ablage wie im Hangar
// (assets/hangar-layouts.js, accountStore). Der Spiegel im Browser ist sofort
// da, sync() gleicht mit hangar_layouts ab, Löschen läuft als Grabstein und
// lässt sich mit restore() zurückholen. Cockpit (Übersicht) und Bereich
// „Gespeichert" lesen beide von hier und malen bei 'vb:layouts' neu.
import { accountStore, encodeLayout } from '../../assets/hangar-layouts.js';
import { FAV_PATH } from '../lib/supabase';

let storage: Storage | null = null;
try { storage = window.localStorage; } catch { storage = null; }

export const layouts = accountStore({
  storage,
  account: null, // window.VBAccount (account-lite.js), zur Laufzeit gelesen
  onChange: () => document.dispatchEvent(new CustomEvent('vb:layouts')),
});

export type LayoutEntry = {
  id: string; ship: string; name: string; slots: Record<string, string>;
  racks?: Record<string, string>; paint?: string; created: number; updated: number;
};

/** Neueste zuerst, nur Einträge mit Schiff. */
export const layoutList = (): LayoutEntry[] => (layouts.store.list() as LayoutEntry[]).filter((e) => e && e.ship);

/** Schiffsname aus dem Slug, wie account-lite.js (Herstellerkürzel weg). */
export function shipLabel(slug: string): string {
  const t = String(slug || '').toLowerCase().split('-').filter(Boolean);
  if (t.length > 1 && /^[a-z]{3,4}$/.test(t[0])) t.shift();
  return t.map((w) => (/^(i|ii|iii|iv|v|vi)$/.test(w) || /^[a-z]+\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

let started = false;
/** Einmal je Seite: Abgleich anstoßen (Gast: tut nichts). */
export function startLayouts() {
  if (started) return;
  started = true;
  if ((window as any).VBAccount) layouts.sync();
  else window.addEventListener('vb-account-ready', () => layouts.sync(), { once: true });
  // Ein zweiter Tab (Hangar) speichert: hier neu malen.
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('vb.layouts.v1')) document.dispatchEvent(new CustomEvent('vb:layouts'));
  });
}

/* ------------------------------------------------ Links und Zeichen --- */

/** Zeichen + Farbe je Favoriten-Art (wie die Karten im Bereich Gespeichert). */
export const KIND_IC: Record<string, { ic: string; c: string }> = {
  ship: { ic: 'ic-ship', c: 'var(--accent)' },
  mineral: { ic: 'ic-gem', c: 'var(--gold)' },
  mission: { ic: 'ic-target', c: 'var(--accent-2)' },
  item: { ic: 'ic-item', c: '#a855f7' },
  patch: { ic: 'ic-tag', c: 'var(--ok)' },
  topic: { ic: 'ic-hash', c: 'var(--muted)' },
};

const pre = (lang: string) => (lang === 'de' ? '/de' : '');

/** Seite eines Favoriten; FAV_PATH sind Vorlagen mit %s. */
export function favHref(kind: string, slug: string, lang: string): string {
  const tpl = (FAV_PATH as Record<string, string>)[kind] || '/index.html';
  return pre(lang) + tpl.replace('%s', encodeURIComponent(slug).replace(/%2F/gi, '/'));
}

function layoutQuery(e: LayoutEntry): string {
  let code = '';
  try { code = encodeLayout(e); } catch { /* altes Format: nur das Schiff */ }
  return `?ship=${encodeURIComponent(e.ship)}${code ? '&layout=' + code : ''}`;
}
/** Hangar mit genau diesem Layout. */
export const hangarLink = (e: LayoutEntry, lang: string) => `${pre(lang)}/hangar.html${layoutQuery(e)}`;
/** Advanced Loadout mit genau diesem Layout. */
export const advancedLink = (e: LayoutEntry, lang: string) => `${pre(lang)}/hangar-loadout.html${layoutQuery(e)}`;
