// Bereich „Gespeichert" der Kontoseite: Hangar-Loadouts und Favoriten an
// einem Ort, mit Filter nach Art, Suche und Löschen mit Rückgängig.
//
// Loadouts kommen aus derselben Ablage wie im Hangar (account-layouts.ts):
// Löschen ist dort ein Grabstein, restore() holt das Layout mit seinen alten
// Zeitstempeln zurück, und der Abgleich trägt beides ins Konto. Favoriten
// liegen in der Tabelle favorites; Rückgängig legt die Zeile neu an.
// Nach jeder Änderung: 'vb:saved' (Zahlen im Dashboard, Kacheln im Cockpit).
import { supabase } from '../lib/supabase';
import { cssUrl } from '../lib/cssUrl';
import { changeCount } from '../../assets/hangar-layouts.js';
import { layouts, layoutList, startLayouts, shipLabel, KIND_IC, favHref, hangarLink, advancedLink, type LayoutEntry } from './account-layouts';

type Fav = { id: number; kind: string; slug: string; label: string | null; created_at: string };
const KIND_ORDER = ['ship', 'mission', 'item', 'mineral', 'patch', 'topic'];

const root = document.getElementById('sv');
if (root) boot(root);

function boot(root: HTMLElement) {
  const C: Record<string, any> = JSON.parse(root.dataset.copy || '{}');
  const KIND1: Record<string, string> = JSON.parse(root.dataset.kinds || '{}');
  const lang = root.dataset.lang === 'de' ? 'de' : 'en';
  const loc = lang === 'de' ? 'de-DE' : 'en-US';
  const $ = (id: string) => document.getElementById(id)!;
  const NS = 'http://www.w3.org/2000/svg';
  const icon = (id: string) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  };
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const day = (ts: number) => (ts > 0 ? new Date(ts).toLocaleDateString(loc, { day: 'numeric', month: 'short' }) : '');

  let me = '';
  let favs: Fav[] = [];
  let thumbs: Record<string, string> = {};
  let favsLoaded = false;
  let filter = 'all';
  let q = '';

  /* ------------------------------------------------------------ Toast --- */
  let toastTimer = 0;
  const toast = (msg: string, undo?: () => void) => {
    const t = $('svToast');
    $('svToastMsg').textContent = msg;
    const b = $('svUndo') as HTMLButtonElement;
    b.hidden = !undo;
    b.onclick = undo ? () => { hideToast(); undo(); } : null;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, undo ? 7000 : 2500);
  };
  const hideToast = () => { $('svToast').hidden = true; };

  /* ------------------------------------------------------------ Zahlen --- */
  const announce = (changed = true) => {
    document.dispatchEvent(new CustomEvent('vb:saved', { detail: { favs: favs.length, changed } }));
  };

  /* --------------------------------------- Schaufenster (Pilotenseite) --- */
  // Bis zu drei Loadouts hängen am öffentlichen Profil (profiles.showcase,
  // nur die IDs; die Pilotenseite liest sie über die View public_showcase).
  // null = noch nicht geladen oder Spalte fehlt: dann gibt es keinen Knopf.
  const MAX_PIN = 3;
  let pinned: string[] | null = null;
  // Geschrieben wird der Reihe nach und immer der neueste Stand: zwei schnelle
  // Klicks überholen sich nicht, ein übersprungener Zwischenstand geht mit dem
  // nächsten Schreiben mit. Ein Fehler setzt auf das zurück, was der Server
  // zuletzt bestätigt hat, nicht auf den Stand vor irgendeinem Klick.
  let pinsSaved: string[] = [];
  let pinSeq = 0;
  let pinWrite: Promise<boolean> = Promise.resolve(true);
  const savePins = (next: string[]) => {
    pinned = next;
    render();
    const seq = ++pinSeq;
    pinWrite = pinWrite.then(async () => {
      if (seq !== pinSeq) return true;
      const want = pinned || [];
      let failed = true;
      try {
        const { error } = await supabase.from('profiles').update({ showcase: want }).eq('id', me);
        failed = !!error;
      } catch { /* wie ein Fehler */ }
      if (!failed) { pinsSaved = want; return true; }
      if (seq === pinSeq) { pinned = pinsSaved; render(); }
      toast(C.failed);
      return false;
    });
    return pinWrite;
  };
  // Nur IDs, die es noch gibt (ein gelöschtes Loadout belegt sonst einen Platz).
  const livePins = () => (pinned || []).filter((id) => layoutList().some((l) => l.id === id));

  /* ------------------------------------------------------ Kartenbauer --- */
  const poster = (li: HTMLElement, img: string, ic: string, c: string) => {
    li.style.setProperty('--kc', c);
    const bild = cssUrl(img);
    if (bild) {
      li.classList.add('fav--poster');
      const bg = el('span', 'fav__bg');
      bg.style.backgroundImage = bild;
      bg.setAttribute('aria-hidden', 'true');
      const scrim = el('span', 'fav__scrim');
      scrim.setAttribute('aria-hidden', 'true');
      li.append(bg, scrim);
    } else {
      const fic = el('span', 'fic');
      fic.style.setProperty('--kc', c);
      fic.appendChild(icon(ic));
      li.appendChild(fic);
    }
  };
  const actBtn = (ic: string, label: string, cls = '') => {
    const b = el('button', 'sv-act' + (cls ? ' ' + cls : ''));
    (b as HTMLButtonElement).type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.appendChild(icon(ic));
    return b as HTMLButtonElement;
  };

  const loadoutCard = (e: LayoutEntry) => {
    const li = el('li', 'fav sv-lo');
    poster(li, thumbs[e.ship] || '', 'ic-ship', 'var(--gold)');
    const ship = shipLabel(e.ship);
    const name = e.name || ship;
    const main = el('span', 'fmain');
    main.append(el('span', 'fkind', C.loadout + (e.name ? ' · ' + ship : '')), el('span', 'fname', name));
    const n = changeCount(e);
    main.appendChild(el('span', 'sv-meta', [n ? (n === 1 ? C.change1 : C.changes.replace('%n%', String(n))) : C.stock, day(e.updated)].filter(Boolean).join(' · ')));
    const link = el('a', 'fav__link') as HTMLAnchorElement;
    link.href = hangarLink(e, lang);
    link.title = C.open;
    link.setAttribute('aria-label', `${name} — ${C.open}`);
    const acts = el('div', 'sv-acts');
    const adv = el('a', 'sv-act') as HTMLAnchorElement;
    adv.href = advancedLink(e, lang);
    adv.title = C.advanced;
    adv.setAttribute('aria-label', `${name} — ${C.advanced}`);
    adv.appendChild(icon('ic-sliders'));
    const copy = actBtn('ic-link', C.copy);
    copy.addEventListener('click', async () => {
      const url = location.origin + hangarLink(e, lang);
      try { await navigator.clipboard.writeText(url); toast(C.copied); } catch { window.prompt(C.copy, url); }
    });
    const rm = actBtn('ic-x', C.remove, 'sv-act--rm');
    rm.addEventListener('click', () => {
      const gone = layouts.store.remove(e.id);
      if (!gone) { toast(C.failed); return; }
      // Rückgängig heftet es wieder an, an dieselbe Stelle, wenn noch Platz ist.
      const pinAt = pinned ? pinned.indexOf(e.id) : -1;
      if (pinAt >= 0) savePins(livePins());
      render();
      announce();
      toast(C.removed.replace('%s', name), () => {
        layouts.store.restore(gone);
        const cur = livePins();
        if (pinAt >= 0 && pinned && !cur.includes(e.id) && cur.length < MAX_PIN) {
          savePins([...cur.slice(0, pinAt), e.id, ...cur.slice(pinAt)]);
        }
        render();
        announce();
      });
    });
    acts.append(adv, copy, rm);
    if (pinned) {
      const on = pinned.includes(e.id);
      li.classList.toggle('is-pinned', on);
      const pin = actBtn('ic-pin', on ? C.unpin : C.pin, on ? 'sv-act--on' : '');
      pin.setAttribute('aria-pressed', String(on));
      pin.addEventListener('click', async () => {
        const cur = livePins();
        if (on) { if (await savePins(cur.filter((id) => id !== e.id))) toast(C.unpinned); return; }
        if (cur.length >= MAX_PIN) { toast(C.pinFull); return; }
        if (await savePins([...cur, e.id])) toast(C.pinned);
      });
      acts.prepend(pin);
      if (on) main.prepend(el('span', 'sv-pin', C.onProfile));
    }
    li.append(main, link, acts);
    return li;
  };

  const favCard = (f: Fav) => {
    const meta = KIND_IC[f.kind] || { ic: 'ic-star', c: 'var(--accent)' };
    const li = el('li', 'fav');
    poster(li, f.kind === 'ship' ? thumbs[f.slug] || '' : '', meta.ic, meta.c);
    const name = f.label || f.slug;
    const main = el('span', 'fmain');
    const k = el('span', 'fkind', KIND1[f.kind] || f.kind);
    k.style.setProperty('--kc', meta.c);
    main.append(k, el('span', 'fname', name));
    const link = el('a', 'fav__link') as HTMLAnchorElement;
    link.href = favHref(f.kind, f.slug, lang);
    link.setAttribute('aria-label', name);
    const acts = el('div', 'sv-acts');
    const rm = actBtn('ic-x', C.remove, 'sv-act--rm');
    rm.addEventListener('click', async () => {
      rm.disabled = true;
      favs = favs.filter((x) => x.id !== f.id);
      render();
      const { error } = await supabase.from('favorites').delete().eq('id', f.id);
      if (error) {
        favs = [f, ...favs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        render();
        toast(C.failed);
        return;
      }
      announce();
      toast(C.removed.replace('%s', name), async () => {
        const { data, error: e2 } = await supabase.from('favorites')
          .insert({ user_id: me, kind: f.kind, slug: f.slug, label: f.label })
          .select('id, kind, slug, label, created_at').single();
        if (e2 || !data) { toast(C.failed); return; }
        favs = [data as Fav, ...favs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        render();
        announce();
      });
    });
    acts.appendChild(rm);
    li.append(main, link, acts);
    return li;
  };

  /* ------------------------------------------------------------ Malen --- */
  const match = (...parts: string[]) => !q || parts.some((p) => p.toLowerCase().includes(q));

  const renderFilter = (los: LayoutEntry[]) => {
    const counts: Array<[string, string, number]> = [['all', C.all, los.length + favs.length]];
    if (los.length) counts.push(['loadout', C.loadouts, los.length]);
    for (const k of KIND_ORDER) {
      const n = favs.filter((f) => f.kind === k).length;
      if (n) counts.push([k, (C.kinds || {})[k] || k, n]);
    }
    const other = favs.filter((f) => !KIND_ORDER.includes(f.kind)).length;
    if (other) counts.push(['other', '…', other]);
    if (!counts.some(([k]) => k === filter)) filter = 'all';
    const box = $('svFilter');
    // Nur zwei Einträge (Alle + eine Art) sagen nichts: dann keine Leiste.
    box.hidden = counts.length <= 2;
    box.replaceChildren(...counts.map(([k, label, n]) => {
      const b = el('button', 'sv-chip') as HTMLButtonElement;
      b.type = 'button';
      b.setAttribute('aria-pressed', String(k === filter));
      b.append(label, el('b', '', String(n)));
      b.addEventListener('click', () => { filter = k; render(); });
      return b;
    }));
  };

  function render() {
    const los = layoutList();
    renderFilter(los);
    const showLo = filter === 'all' || filter === 'loadout';
    const loShown = showLo ? los.filter((e) => match(e.name, shipLabel(e.ship))) : [];
    const favShown = filter === 'loadout' ? [] : favs.filter((f) =>
      (filter === 'all' || f.kind === filter || (filter === 'other' && !KIND_ORDER.includes(f.kind)))
      && match(f.label || '', f.slug, KIND1[f.kind] || ''));

    $('svLoadouts').replaceChildren(...loShown.map(loadoutCard));
    $('favList').replaceChildren(...favShown.map(favCard));
    $('svLoN').textContent = loShown.length ? String(loShown.length) : '';
    $('svFavN').textContent = favShown.length ? String(favShown.length) : '';
    $('svLoSec').hidden = !loShown.length;
    $('svFavSec').hidden = !favShown.length;
    const total = los.length + favs.length;
    $('favEmpty').hidden = !(favsLoaded && total === 0);
    $('svNone').hidden = !(total > 0 && !loShown.length && !favShown.length);
    ($('svSearch').closest('.sv-search') as HTMLElement).hidden = total < 6;
    $('svSync').hidden = layouts.state() !== 'error';
    // Für die Mini-Pilotenseite im Profil (account-profile-view.ts): was dort
    // im Hangar stünde. Erst die angehefteten Loadouts, dann Schiffe aus den
    // Favoriten; die übrigen Favoriten zählen für den Abschnitt darunter.
    const tile = (slug: string, name: string) => ({ name, img: thumbs[slug] || '' });
    document.dispatchEvent(new CustomEvent('vb:showcase', { detail: {
      pins: livePins().map((id) => los.find((l) => l.id === id)).filter((e): e is LayoutEntry => !!e).map((e) => tile(e.ship, e.name || shipLabel(e.ship))),
      ships: favs.filter((f) => f.kind === 'ship').map((f) => tile(f.slug, f.label || shipLabel(f.slug))),
      rest: favs.filter((f) => f.kind !== 'ship').length,
    } }));
  }

  ($('svSearch') as HTMLInputElement).addEventListener('input', (e) => {
    q = (e.target as HTMLInputElement).value.trim().toLowerCase();
    render();
  });
  // Abgleich/zweiter Tab: neu malen; die Cockpit-Kacheln hören selbst auf vb:layouts.
  document.addEventListener('vb:layouts', () => { render(); if (favsLoaded) announce(false); });

  /* ------------------------------------------------------------ Start --- */
  (async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    me = user.id;
    startLayouts();
    render();
    const [th, res, sc] = await Promise.all([
      fetch('/assets/ship-thumbs.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<Record<string, string>>,
      supabase.from('favorites').select('id, kind, slug, label, created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('showcase').eq('id', me).maybeSingle(),
    ]);
    thumbs = th || {};
    if (!sc.error) pinned = pinsSaved = Array.isArray(sc.data?.showcase) ? (sc.data!.showcase as unknown[]).map(String) : [];
    favs = (res.data || []) as Fav[];
    favsLoaded = true;
    render();
    announce(false);
  })();
}
