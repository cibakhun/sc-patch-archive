// Übersicht der Kontoseite als Cockpit: Discord-Rang, Profil-Check und
// Gespeichertes (Favoriten + Hangar-Loadouts). Eigenes Modul neben
// account-dashboard.ts: liest selbst aus Supabase und hört auf die
// Ereignisse der übrigen Teile (vb:discord, vb:profile-check), statt in
// deren Ablauf einzugreifen. Die letzten Nachrichten stehen in der
// Freundesleiste (FriendsDock.astro), nicht hier.
//
// Rang und Leiter kommen aus derselben Datei wie im Discord-Bot
// (discord/bot/src/ranks.mjs), damit Seite und Server nie verschiedene
// Namen oder Farben zeigen.
import { supabase } from '../lib/supabase';
import { cssUrl } from '../lib/cssUrl';
import { RANKS, rankForLevel, nextRank, prestigeStars } from '../../discord/bot/src/ranks.mjs';
import { progress, totalXpForLevel, xpToNext } from '../../discord/bot/src/leveling.mjs';
import { layoutList, startLayouts, shipLabel, KIND_IC, favHref, hangarLink } from './account-layouts';

type Copy = Record<string, any>;
type RankRow = {
  in_guild: boolean | null; level: number | null; xp: number | null; prestige: number | null; rank_key: string | null;
  messages: number | null; voice_seconds: number | null; server_rank: number | null; server_members: number | null; stats_at: string | null;
};

const root = document.getElementById('ck');
if (root) boot(root);

function boot(root: HTMLElement) {
  const C: Copy = JSON.parse(root.dataset.copy || '{}');
  const lang = root.dataset.lang === 'de' ? 'de' : 'en';
  const loc = lang === 'de' ? 'de-DE' : 'en-US';
  const invite = root.dataset.invite || '';
  const $ = (id: string) => document.getElementById(id);
  const fill = (s: string, v: Record<string, string | number>) => String(s || '').replace(/%(\w)%/g, (_, k) => String(v[k] ?? ''));
  const nf = new Intl.NumberFormat(loc);
  const compact = new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 });

  let me = '';
  let dcLinked: boolean | null = null;

  /* ------------------------------------------------------------ Rang --- */
  const rankEl = $('ckRank')!;
  const ladder = $('ckLadder')!;
  ladder.replaceChildren(...RANKS.map((r) => {
    const li = document.createElement('li');
    li.style.setProperty('--c', r.color);
    li.title = `${r.insignia} ${r.name} · Lv ${r.level}`;
    return li;
  }));

  const showCta = (state: string, msg: string, btn: string, action: () => void, hrefTo = '') => {
    rankEl.dataset.state = state;
    $('ckRankLive')!.hidden = true;
    $('ckRankStats')!.hidden = true;
    $('ckRankCta')!.hidden = false;
    $('ckRankMsg')!.textContent = msg;
    const b = $('ckRankBtn') as HTMLAnchorElement;
    b.textContent = btn;
    if (hrefTo) { b.href = hrefTo; b.target = '_blank'; b.removeAttribute('role'); b.onclick = null; }
    else {
      // href bleibt (sonst nicht mehr per Tab erreichbar), Klick/Enter löst die Aktion aus.
      b.href = '#'; b.removeAttribute('target'); b.setAttribute('role', 'button');
      b.onclick = (e) => { e.preventDefault(); action(); };
    }
    ($('ckRankName') as HTMLElement).textContent = C.rank;
    $('ckRankIns')!.textContent = '◆';
    rankEl.style.setProperty('--rc', '#5865f2');
    $('ckRankLv')!.hidden = true;
    $('ckPrestige')!.hidden = true;
  };

  const renderRank = (raw: RankRow | null) => {
    const row = preview || raw;
    if (dcLinked === false && !preview) {
      showCta('nolink', C.noLink, C.noLinkBtn, () => (document.getElementById('btnDiscordLink') as HTMLButtonElement | null)?.click());
      return;
    }
    if (row?.in_guild === false) {
      showCta('noguild', C.noGuild, C.noGuildBtn, () => {}, invite);
      return;
    }
    // Noch keine Zeile oder noch kein Abgleich: der Bot kommt in ≤ 5 Minuten.
    if (!row || !row.stats_at || row.level == null) {
      showCta('waiting', C.waiting, C.waitingBtn, () => {}, invite);
      return;
    }
    const level = row.level || 0;
    const rank = RANKS.find((r) => r.key === row.rank_key) || rankForLevel(level);
    const nxt = nextRank(level);
    const pg = progress(row.xp || 0);
    rankEl.dataset.state = 'live';
    rankEl.style.setProperty('--rc', rank.color);
    $('ckRankLive')!.hidden = false;
    $('ckRankStats')!.hidden = false;
    $('ckRankCta')!.hidden = true;
    $('ckRankIns')!.textContent = rank.insignia;
    $('ckRankName')!.textContent = rank.name;
    const lv = $('ckRankLv')!;
    lv.hidden = false;
    lv.textContent = fill(C.lv, { n: level }) + (preview ? ` · ${C.preview}` : '');
    const pres = $('ckPrestige')!;
    pres.textContent = prestigeStars(row.prestige || 0);
    pres.hidden = !pres.textContent;
    const pct = Math.max(0, Math.min(100, Math.round(pg.pct * 100)));
    ($('ckBar') as HTMLElement).style.width = pct + '%';
    $('ckBarWrap')!.setAttribute('aria-valuenow', String(pct));
    $('ckXp')!.textContent = fill(C.xp, { a: nf.format(pg.into), b: nf.format(pg.needed) });
    $('ckNext')!.textContent = nxt ? fill(C.next, { n: nxt.level, r: `${nxt.insignia} ${nxt.name}` }) : C.max;
    const idx = RANKS.findIndex((r) => r.key === rank.key);
    [...ladder.children].forEach((li, i) => li.classList.toggle('is-on', i <= idx));
    $('ckPos')!.innerHTML = row.server_rank
      ? `#${nf.format(row.server_rank)}<small>${row.server_members ? fill(C.of, { n: nf.format(row.server_members) }) : ''}</small>`
      : '—';
    $('ckMsgs')!.textContent = row.messages != null ? compact.format(row.messages) : '—';
    const vs = row.voice_seconds || 0;
    $('ckVoice')!.textContent = vs >= 3600 ? `${compact.format(vs / 3600)} h` : `${Math.round(vs / 60)} min`;
  };

  let rankRow: RankRow | null = null;
  // Vorschau nur für Admins: ?rang=max, ein Rangname (ace) oder ein Level (42),
  // dazu wahlweise &prestige=2. Ändert nur diese Ansicht; Datenbank, Bot-XP und
  // Discord-Rollen bleiben, wie sie sind.
  let preview: RankRow | null = null;
  const loadPreview = async () => {
    const q = new URLSearchParams(location.search);
    const p = (q.get('rang') || '').trim().toLowerCase();
    if (!p) return;
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', me).maybeSingle();
    if ((data as { role?: string } | null)?.role !== 'admin') return;
    const byKey = p === 'max' ? RANKS[RANKS.length - 1] : RANKS.find((r) => r.key === p);
    const level = byKey ? byKey.level : /^\d{1,3}$/.test(p) ? Number(p) : NaN;
    if (!Number.isFinite(level)) return;
    preview = {
      in_guild: true, level, xp: totalXpForLevel(level) + Math.round(xpToNext(level) * 0.6),
      prestige: Math.min(9, Math.max(0, Number(q.get('prestige')) || 0)), rank_key: rankForLevel(level).key,
      messages: rankRow?.messages ?? null, voice_seconds: rankRow?.voice_seconds ?? null,
      server_rank: rankRow?.server_rank ?? null, server_members: rankRow?.server_members ?? null, stats_at: new Date().toISOString(),
    };
  };
  const loadRank = async () => {
    const { data } = await supabase.from('discord_role_state')
      .select('in_guild, level, xp, prestige, rank_key, messages, voice_seconds, server_rank, server_members, stats_at')
      .maybeSingle();
    rankRow = (data as RankRow) || null;
    await loadPreview();
    renderRank(rankRow);
  };
  document.addEventListener('vb:discord', (e) => {
    dcLinked = !!(e as CustomEvent).detail?.linked;
    renderRank(rankRow);
    renderCheck();
    if (dcLinked) loadRank();
  });

  /* ----------------------------------------------------- Profil-Check --- */
  type CheckItem = { k: string; ok: boolean; tab: string; el: string };
  let checkItems: CheckItem[] = [];
  document.addEventListener('vb:profile-check', (e) => {
    checkItems = ((e as CustomEvent).detail || []) as CheckItem[];
    renderCheck();
  });
  function renderCheck() {
    // „Discord" zählt erst mit echter Verbindung, nicht mit einem getippten Namen.
    const items = checkItems.map((i) => (i.k === 'discord' && dcLinked === false ? { ...i, ok: false } : i));
    const ul = $('ckTodo')!;
    ul.replaceChildren(...items.filter((i) => !i.ok).map((i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ck-chip';
      b.textContent = '+ ' + ((C.todo || {})[i.k] || i.k);
      b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('vb:tab', { detail: { tab: i.tab, el: i.el } })));
      li.appendChild(b);
      return li;
    }));
    root.querySelector('.ck-check')?.classList.toggle('is-done', !ul.childElementCount);
  }

  /* ---------------------------------------------- Gespeichertes ------- */
  // Loadouts aus der Hangar-Ablage (account-layouts.ts), Favoriten aus der
  // Tabelle; beide neu bei 'vb:layouts' bzw. 'vb:saved' (Bereich Gespeichert).
  let thumbs: Record<string, string> | null = null;
  type FavRow = { kind: string; slug: string; label: string | null; created_at: string };
  let favRows: FavRow[] = [];
  const renderSaved = () => {
    type Tile = { href: string; img: string; name: string; kind: string; ic: string; c: string; isLayout: boolean; ts: number };
    const th = thumbs || {};
    const los = layoutList();
    const tiles: Tile[] = los.map((e) => ({
      href: hangarLink(e, lang), img: th[e.ship] || '', name: e.name || shipLabel(e.ship), kind: C.layout,
      ic: 'ic-ship', c: 'var(--gold)', isLayout: true, ts: e.updated || 0,
    }));
    for (const f of favRows) {
      const meta = KIND_IC[f.kind] || { ic: 'ic-star', c: 'var(--accent)' };
      tiles.push({
        href: favHref(f.kind, f.slug, lang), img: f.kind === 'ship' ? th[f.slug] || '' : '', name: f.label || f.slug,
        kind: (C.kinds || {})[f.kind] || f.kind, ic: meta.ic, c: meta.c, isLayout: false, ts: Date.parse(f.created_at) || 0,
      });
    }
    tiles.sort((a, b) => b.ts - a.ts);
    const ul = $('ckFavs')!;
    ul.replaceChildren(...tiles.slice(0, 12).map((t) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      const bild = cssUrl(t.img);
      a.className = 'ck-tile' + (t.isLayout ? ' is-layout' : '') + (bild ? '' : ' no-img');
      a.href = t.href;
      a.style.setProperty('--kc', t.c);
      if (bild) a.style.backgroundImage = bild;
      else {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(NS, 'use');
        use.setAttribute('href', '#' + t.ic);
        svg.appendChild(use);
        a.appendChild(svg);
      }
      const k = document.createElement('small');
      k.append(document.createElement('i'), t.kind);
      const b = document.createElement('b');
      b.textContent = t.name;
      a.append(k, b);
      li.appendChild(a);
      return li;
    }));
    $('ckFavsEmpty')!.hidden = tiles.length > 0;
  };
  const loadSaved = async () => {
    const [th, favRes] = await Promise.all([
      fetch('/assets/ship-thumbs.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<Record<string, string>>,
      supabase.from('favorites').select('kind, slug, label, created_at').order('created_at', { ascending: false }).limit(12),
    ]);
    thumbs = th;
    favRows = (favRes.data || []) as FavRow[];
    renderSaved();
  };
  document.addEventListener('vb:layouts', () => { if (thumbs) renderSaved(); });
  document.addEventListener('vb:saved', (e) => { if (me && (e as CustomEvent).detail?.changed) loadSaved(); });

  /* ----------------------------------------------------------- Start --- */
  (async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    me = user.id;
    if (dcLinked === null) dcLinked = !!(user.identities || []).some((i) => i.provider === 'discord');
    startLayouts();
    await Promise.all([loadRank(), loadSaved()]);
  })();
}
