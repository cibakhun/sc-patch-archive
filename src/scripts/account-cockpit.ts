// Übersicht der Kontoseite als Cockpit: Discord-Rang, Profil-Check, letzte
// Nachrichten und Gespeichertes (Favoriten + Hangar-Loadouts). Eigenes Modul
// neben account-dashboard.ts: liest selbst aus Supabase und hört auf die
// Ereignisse der übrigen Teile (vb:friends, vb:chat-unread, vb:discord,
// vb:profile-check), statt in deren Ablauf einzugreifen.
//
// Rang und Leiter kommen aus derselben Datei wie im Discord-Bot
// (discord/bot/src/ranks.mjs), damit Seite und Server nie verschiedene
// Namen oder Farben zeigen.
import { supabase, FAV_PATH } from '../lib/supabase';
import { RANKS, rankForLevel, nextRank, prestigeStars } from '../../discord/bot/src/ranks.mjs';
import { progress } from '../../discord/bot/src/leveling.mjs';
import { encodeLayout } from '../../assets/hangar-layouts.js';

type Copy = Record<string, any>;
type Prof = { id: string; handle: string | null; display_name: string | null; avatar_url: string | null; avatar_icon: string | null; avatar_color: string | null };
type Msg = { id: number; sender_id: string; receiver_id: string; body: string; created_at: string; read_at: string | null };
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
  const people = new Map<string, Prof>();

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
    if (hrefTo) { b.href = hrefTo; b.target = '_blank'; b.onclick = null; }
    else { b.removeAttribute('href'); b.removeAttribute('target'); b.onclick = (e) => { e.preventDefault(); action(); }; }
    ($('ckRankName') as HTMLElement).textContent = C.rank;
    $('ckRankIns')!.textContent = '◆';
    rankEl.style.setProperty('--rc', '#5865f2');
    $('ckRankLv')!.hidden = true;
    $('ckPrestige')!.hidden = true;
  };

  const renderRank = (row: RankRow | null) => {
    if (dcLinked === false) {
      showCta('nolink', C.noLink, C.noLinkBtn, () => (document.getElementById('btnDiscordLink') as HTMLButtonElement | null)?.click());
      return;
    }
    if (!row || row.in_guild === false) {
      showCta('noguild', C.noGuild, C.noGuildBtn, () => {}, invite);
      return;
    }
    if (!row.stats_at || row.level == null) {
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
    lv.textContent = fill(C.lv, { n: level });
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
  const loadRank = async () => {
    const { data } = await supabase.from('discord_role_state')
      .select('in_guild, level, xp, prestige, rank_key, messages, voice_seconds, server_rank, server_members, stats_at')
      .maybeSingle();
    rankRow = (data as RankRow) || null;
    renderRank(rankRow);
  };
  document.addEventListener('vb:discord', (e) => {
    dcLinked = !!(e as CustomEvent).detail?.linked;
    renderRank(rankRow);
    if (dcLinked) loadRank();
  });

  /* ----------------------------------------------------- Profil-Check --- */
  document.addEventListener('vb:profile-check', (e) => {
    const items = ((e as CustomEvent).detail || []) as Array<{ k: string; ok: boolean; tab: string; el: string }>;
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
  });

  /* -------------------------------------------------------- Avatare --- */
  const avatar = (p: Prof | undefined, fallback: string) => {
    const s = document.createElement('span');
    s.className = 'ck-av';
    const col = p?.avatar_color || '#2dd4ff';
    s.style.color = col;
    s.style.borderColor = col;
    if (p?.avatar_url) {
      const img = document.createElement('img');
      img.src = p.avatar_url; img.alt = ''; img.loading = 'lazy';
      s.appendChild(img);
    } else s.textContent = p?.avatar_icon || (p?.display_name || p?.handle || fallback).charAt(0).toUpperCase();
    return s;
  };
  const nameOf = (p: Prof | undefined) => p?.display_name || p?.handle || '?';
  const ago = (iso: string) => {
    const m = Math.max(0, (Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return C.now;
    if (m < 60) return fill(C.min, { n: Math.round(m) });
    if (m < 60 * 24) return fill(C.hrs, { n: Math.round(m / 60) });
    if (m < 60 * 24 * 7) return fill(C.days, { n: Math.round(m / 1440) });
    return new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  };

  /* ----------------------------------------------------- Nachrichten --- */
  let chatTimer = 0;
  const loadChats = async () => {
    if (!me) return;
    const { data, error } = await supabase.from('direct_messages')
      .select('id, sender_id, receiver_id, body, created_at, read_at')
      .order('id', { ascending: false }).limit(120);
    if (error) return;
    const last = new Map<string, Msg>();
    const unread = new Map<string, number>();
    for (const m of (data || []) as Msg[]) {
      const other = m.sender_id === me ? m.receiver_id : m.sender_id;
      if (!last.has(other)) last.set(other, m);
      if (m.receiver_id === me && !m.read_at) unread.set(other, (unread.get(other) || 0) + 1);
    }
    const missing = [...last.keys()].filter((id) => !people.has(id));
    if (missing.length) {
      const { data: ps } = await supabase.from('social_profiles')
        .select('id, handle, display_name, avatar_url, avatar_icon, avatar_color').in('id', missing);
      for (const p of (ps || []) as Prof[]) people.set(p.id, p);
    }
    const ul = $('ckChats')!;
    const rows = [...last.entries()].slice(0, 8);
    ul.replaceChildren(...rows.map(([id, m]) => {
      const p = people.get(id);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ck-chat';
      b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('vb:chat-open', { detail: id })));
      const t = document.createElement('span');
      t.className = 'ck-chat__t';
      const nm = document.createElement('b');
      nm.textContent = nameOf(p);
      const tm = document.createElement('time');
      tm.dateTime = m.created_at;
      tm.textContent = ago(m.created_at);
      const head = document.createElement('span');
      head.className = 'ck-chat__h';
      head.append(nm, tm);
      const snip = document.createElement('small');
      snip.textContent = (m.sender_id === me ? C.you + ': ' : '') + m.body.replace(/\s+/g, ' ');
      t.append(head, snip);
      b.append(avatar(p, '?'), t);
      const n = unread.get(id) || 0;
      if (n) {
        const u = document.createElement('span');
        u.className = 'ck-unread';
        u.textContent = n > 99 ? '99+' : String(n);
        b.appendChild(u);
        b.classList.add('has-unread');
      }
      li.appendChild(b);
      return li;
    }));
    $('ckChatsEmpty')!.hidden = rows.length > 0;
    const total = [...unread.values()].reduce((a, b) => a + b, 0);
    const nEl = $('ckChatsN')!;
    nEl.textContent = String(total);
    nEl.hidden = total <= 0;
  };
  const chatsSoon = () => { clearTimeout(chatTimer); chatTimer = window.setTimeout(loadChats, 400); };
  document.addEventListener('vb:chat-unread', chatsSoon);
  document.addEventListener('vb:friends', (e) => {
    const d = (e as CustomEvent).detail || {};
    for (const f of (d.friends || []) as Array<{ p?: Prof } | Prof>) {
      const p = ((f as { p?: Prof }).p || f) as Prof;
      if (p && p.id) people.set(p.id, p);
    }
    chatsSoon();
  });

  /* ---------------------------------------------- Gespeichertes ------- */
  const shipLabel = (slug: string) => {
    const t = String(slug || '').toLowerCase().split('-').filter(Boolean);
    if (t.length > 1 && /^[a-z]{3,4}$/.test(t[0])) t.shift();
    return t.map((w) => (/^(i|ii|iii|iv|v|vi)$/.test(w) || /^[a-z]+\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  };
  const hangarBase = lang === 'de' ? '/de/hangar.html' : '/hangar.html';
  const favPath = (kind: string, slug: string) => {
    const base = (FAV_PATH as Record<string, string>)[kind];
    return base ? `${lang === 'de' ? '/de' : ''}${base}${encodeURIComponent(slug)}.html` : '#';
  };
  // Wie im Bereich Favoriten: Zeichen + Farbe je Art (für Kacheln ohne Bild)
  const KIND_IC: Record<string, { ic: string; c: string }> = {
    ship: { ic: 'ic-ship', c: 'var(--accent)' },
    mineral: { ic: 'ic-gem', c: 'var(--gold)' },
    mission: { ic: 'ic-target', c: 'var(--accent-2)' },
    item: { ic: 'ic-item', c: '#a855f7' },
    patch: { ic: 'ic-tag', c: 'var(--ok)' },
    topic: { ic: 'ic-hash', c: 'var(--muted)' },
  };
  const loadSaved = async () => {
    const [thumbs, favRes, layRes] = await Promise.all([
      fetch('/assets/ship-thumbs.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<Record<string, string>>,
      supabase.from('favorites').select('id, kind, slug, label, created_at').order('created_at', { ascending: false }).limit(12),
      supabase.from('hangar_layouts').select('id, entry, updated_at').eq('deleted', false).order('updated_at', { ascending: false }).limit(12),
    ]);
    type Tile = { href: string; img: string; name: string; kind: string; ic: string; c: string; isLayout: boolean; ts: number };
    const tiles: Tile[] = [];
    const layouts = ((layRes.data || []) as Array<{ entry: any; updated_at: string }>).filter((l) => l.entry && l.entry.ship);
    for (const l of layouts) {
      const e = l.entry;
      let code = '';
      try { code = encodeLayout(e); } catch { /* altes Format: nur das Schiff öffnen */ }
      tiles.push({
        href: `${hangarBase}?ship=${encodeURIComponent(e.ship)}${code ? '&layout=' + code : ''}`,
        img: thumbs[e.ship] || '', name: e.name || shipLabel(e.ship), kind: C.layout, ic: 'ic-ship', c: 'var(--gold)', isLayout: true, ts: Date.parse(l.updated_at) || 0,
      });
    }
    for (const f of (favRes.data || []) as Array<{ kind: string; slug: string; label: string | null; created_at: string }>) {
      const meta = KIND_IC[f.kind] || { ic: 'ic-star', c: 'var(--accent)' };
      tiles.push({
        ic: meta.ic, c: meta.c,
        href: favPath(f.kind, f.slug), img: f.kind === 'ship' ? thumbs[f.slug] || '' : '', name: f.label || f.slug,
        kind: (C.kinds || {})[f.kind] || f.kind, isLayout: false, ts: Date.parse(f.created_at) || 0,
      });
    }
    tiles.sort((a, b) => b.ts - a.ts);
    const n = $('ckStatLayouts');
    if (n) n.textContent = String(layouts.length);
    const ul = $('ckFavs')!;
    ul.replaceChildren(...tiles.slice(0, 12).map((t) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'ck-tile' + (t.isLayout ? ' is-layout' : '') + (t.img ? '' : ' no-img');
      a.href = t.href;
      a.style.setProperty('--kc', t.c);
      if (t.img) a.style.backgroundImage = `url('${t.img}')`;
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
      k.textContent = t.kind;
      const b = document.createElement('b');
      b.textContent = t.name;
      a.append(k, b);
      li.appendChild(a);
      return li;
    }));
    $('ckFavsEmpty')!.hidden = tiles.length > 0;
  };

  /* ----------------------------------------------------------- Start --- */
  (async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    me = user.id;
    if (dcLinked === null) dcLinked = !!(user.identities || []).some((i) => i.provider === 'discord');
    await Promise.all([loadRank(), loadChats(), loadSaved()]);
  })();
}
