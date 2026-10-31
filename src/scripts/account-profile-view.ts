// Profil-Bereich der Kontoseite: links das Formular in vier Reitern, rechts
// die eigene Pilotenseite im Kleinen. Die Werte kommen aus updateCard() in
// account-dashboard.ts (Ereignis vb:profile-view), gespeichert wird dort.
// Dieses Modul zeichnet nur: Reiter, Vorschau, die Erklärungen hinter dem (i)
// und den Hinweis „Nicht gespeichert".
import { SOCIALS } from '../lib/socials';
import { cssUrl } from '../lib/cssUrl';

interface ProfileView {
  name: string; handle: string; savedHandle: string;
  icon: string; color: string; avatar: string; banner: string;
  state: string; stateColor: string; pulse: boolean; statusText: string;
  role: string; verified: boolean; rsi: string; org: string; bio: string;
  socials: Record<string, string>;
  tester: boolean; complete: boolean; since: string; showFavs: boolean; favs: number;
}

// Gleiche Regel wie beim Speichern: ohne gültiges Handle keine öffentliche Seite
const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

const root = document.getElementById('mp');
const form = document.getElementById('profileForm');
if (root && form) boot(root, form);

function boot(root: HTMLElement, form: HTMLElement) {
  const lang: 'de' | 'en' = root.dataset.lang === 'en' ? 'en' : 'de';
  let C: Record<string, string> = {};
  try { C = JSON.parse(root.dataset.copy || '{}'); } catch { /* Texte fehlen: Vorschau bleibt ohne Beschriftung */ }
  const $ = (id: string) => document.getElementById(id);
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  // ---- Reiter im Formular ----
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.pfx-tab')];
  const secs = [...form.querySelectorAll<HTMLElement>('.pfx-sec')];
  const pick = (key: string, focus = false) => {
    if (!secs.some((x) => x.dataset.pfsec === key)) return;
    tabs.forEach((t) => {
      const on = t.dataset.pfsec === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    secs.forEach((x) => { x.hidden = x.dataset.pfsec !== key; });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(t.dataset.pfsec || ''));
    t.addEventListener('keydown', (e) => {
      const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -2;
      if (n === -2) return;
      e.preventDefault();
      pick(tabs[(n + tabs.length) % tabs.length].dataset.pfsec || '', true);
    });
  });
  // Sprung auf ein Feld (Profil-Check im Cockpit, Klick in die Vorschau,
  // Fehler beim Speichern): erst dessen Reiter zeigen. Der Sprung selbst
  // (Bereich, Scrollen, Fokus) läuft in account-dashboard.ts.
  document.addEventListener('vb:tab', (e) => {
    const id = (e as CustomEvent).detail?.el as string | undefined;
    const sec = id ? document.getElementById(id)?.closest<HTMLElement>('.pfx-sec') : null;
    if (sec?.dataset.pfsec) pick(sec.dataset.pfsec);
  });

  // ---- Vorschau: Klick auf einen Teil öffnet das Feld dazu ----
  root.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-goto]');
    if (!t || !root.contains(t)) return;
    document.dispatchEvent(new CustomEvent('vb:tab', { detail: { tab: 'profile', el: t.dataset.goto } }));
  });

  // Erklärungen hinter dem (i): account-tips.ts (gilt für die ganze Kontoseite).

  // ---- „Nicht gespeichert": nur echte Eingaben zählen, nicht das Befüllen ----
  const dirtyEl = $('pfDirty');
  const setDirty = (on: boolean) => {
    if (dirtyEl) dirtyEl.hidden = !on;
    form.classList.toggle('is-dirty', on);
  };
  const onEdit = (e: Event) => {
    if (!e.isTrusted) return;
    const t = e.target as HTMLInputElement;
    // Ein gewähltes Bild zählt erst, wenn es hochgeladen ist (Zuschnitt kann abbrechen)
    if (t.type === 'file') { uploadPending = true; return; }
    setDirty(true);
  };
  let uploadPending = false;
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
  form.addEventListener('drop', (e) => { if (e.isTrusted) uploadPending = true; });
  form.addEventListener('click', (e) => {
    if (e.isTrusted && (e.target as Element).closest('.banner-thumb-card,.avatar-thumb-card,.color-swatch,#pfAvatarDiscord')) setDirty(true);
  });
  document.addEventListener('vb:profile-saved', () => setDirty(false));

  // ---- Zeichnen ----
  let last: ProfileView | null = null;
  const txt = (id: string, v: string) => { const el = $(id); if (el) el.textContent = v; };
  const render = (v: ProfileView) => {
    if (uploadPending && last && (v.avatar !== last.avatar || v.banner !== last.banner)) { uploadPending = false; setDirty(true); }
    last = v;

    const path = HANDLE_RE.test(v.handle) ? (lang === 'de' ? '/de/pilot/' : '/pilot/') + v.handle : '';
    txt('mpUrlTxt', path ? (location.host || 'verse-base.com') + path : C.noHandle || '');
    $('mpUrl')?.classList.toggle('is-off', !path);
    const open = $('mpOpen') as HTMLAnchorElement | null;
    if (open) {
      // Öffnen erst, wenn genau dieses Handle gespeichert ist; sonst führte
      // der Knopf auf eine Seite, die es (noch) nicht gibt.
      open.hidden = !path || v.handle !== v.savedHandle;
      if (!open.hidden) open.href = path;
    }
    txt('mpReg', path ? 'VB-' + v.handle.toUpperCase() : 'VB-—');

    const banner = $('mpBanner');
    if (banner) banner.style.backgroundImage = cssUrl(v.banner) || '';

    const av = $('mpAv');
    if (av) av.style.color = v.color;
    const img = $('mpAvImg') as HTMLImageElement | null;
    const ic = $('mpAvTxt');
    if (img && ic) {
      if (v.avatar) { if (img.getAttribute('src') !== v.avatar) img.src = v.avatar; img.hidden = false; ic.hidden = true; }
      else { img.hidden = true; ic.hidden = false; ic.textContent = v.icon; }
    }
    const dot = $('mpDot');
    if (dot) { dot.style.background = v.stateColor; dot.classList.toggle('pulse', v.pulse); }

    txt('mpName', v.name);
    const ver = $('mpVer');
    if (ver) ver.hidden = !v.verified;
    txt('mpHandle', '@' + (v.handle || 'citizen'));
    const role = $('mpRole');
    if (role) { role.hidden = !v.role; role.textContent = v.role; }
    txt('mpState', v.state);
    txt('mpStatusTxt', v.statusText);
    const bio = $('mpBio');
    if (bio) { bio.hidden = !v.bio; bio.textContent = v.bio; }

    const soc = $('mpSoc');
    if (soc) {
      const on = SOCIALS.filter((s) => v.socials[s.key]);
      soc.hidden = !on.length;
      soc.innerHTML = on.map((s) => `<span class="soc-link" style="--soc:${s.color}" title="${esc(s.label + ': ' + v.socials[s.key])}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${s.path}"/></svg></span>`).join('');
    }

    // Abzeichen wie auf der Pilotenseite: RSI, Testpilot, komplett, seit; dann Org und RSI-Name
    const b: string[] = [];
    if (v.verified) b.push(`<span class="mp-badge mp-badge--ok"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-check"/></svg>${esc(C.verified || '')}</span>`);
    if (v.tester) b.push(`<span class="mp-badge mp-badge--tester"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-star"/></svg>${esc(C.tester || '')}</span>`);
    if (v.complete) b.push(`<span class="mp-badge mp-badge--done"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-check"/></svg>${esc(C.complete || '')}</span>`);
    if (v.since) {
      const d = new Date(v.since);
      if (!isNaN(+d)) b.push(`<span class="mp-badge">${esc((C.since || '') + ' ' + d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { month: 'long', year: 'numeric' }))}</span>`);
    }
    if (v.org) b.push(`<button type="button" class="mp-badge mp-badge--link" data-goto="pfOrg"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-org"/></svg>${esc(v.org)}</button>`);
    if (v.rsi) b.push(`<span class="mp-badge mp-badge--link"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-ext"/></svg>RSI: ${esc(v.rsi)}</span>`);
    const badges = $('mpBadges');
    if (badges) badges.innerHTML = b.join('');

    renderShowcase();
  };

  // Hangar und Favoriten wie auf der Pilotenseite: angeheftete Loadouts
  // (Gold), dann Schiffe aus den Favoriten. Ohne „Favoriten zeigen" bleiben
  // nur die Loadouts; die übrigen Favoriten stehen dann als „verborgen" da.
  type Tile = { name: string; img: string };
  let show: { pins: Tile[]; ships: Tile[]; rest: number } | null = null;
  const MAX_TILES = 4;
  const renderShowcase = () => {
    if (!show || !last) return;
    const favsOn = last.showFavs;
    const tiles = [...show.pins.map((t) => ({ ...t, pin: true })), ...(favsOn ? show.ships : []).map((t) => ({ ...t, pin: false }))];
    const box = $('mpTiles');
    if (box) {
      const more = tiles.length - MAX_TILES;
      box.innerHTML = tiles.slice(0, more > 0 ? MAX_TILES - 1 : MAX_TILES).map((t) => {
        const bg = cssUrl(t.img);
        return `<span class="mp-tile${t.pin ? ' is-pin' : ''}"${bg ? ` style="--img:${esc(bg)}"` : ''}><b>${esc(t.name)}</b></span>`;
      }).join('') + (more > 0 ? `<span class="mp-tile mp-tile--more">+${more + 1}</span>` : '');
      box.hidden = !tiles.length;
    }
    txt('mpHangarN', tiles.length ? String(tiles.length) : '');
    const empty = $('mpHangarEmpty');
    if (empty) empty.hidden = tiles.length > 0;

    txt('mpFavN', favsOn && show.rest ? String(show.rest) : '');
    const off = $('mpFavOff');
    if (off) off.hidden = favsOn;
    $('mpFavs')?.classList.toggle('is-off', !favsOn);
  };
  document.addEventListener('vb:showcase', (e) => { show = (e as CustomEvent).detail; renderShowcase(); });
  document.addEventListener('vb:profile-view', (e) => render((e as CustomEvent).detail as ProfileView));
}
