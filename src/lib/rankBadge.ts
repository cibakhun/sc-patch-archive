// Discord-Rang als kleines Abzeichen (Freundesliste, Dock, Vorschläge,
// Pilotenseite). Name, Farbe und Zeichen kommen aus derselben Leiter wie im
// Bot (discord/bot/src/ranks.mjs); die Seite liest nur discord_level,
// discord_rank (= rank_key) und discord_prestige aus den Profil-Views. Die
// Views geben die drei nur heraus, solange das Konto Discord verknüpft hat und
// auf dem Server ist, sonst null: dann gibt es kein Abzeichen.
import { RANKS, PRESTIGE, rankForLevel } from '../../discord/bot/src/ranks.mjs';

export type RankFields = {
  discord_level?: number | null;
  discord_rank?: string | null;
  discord_prestige?: number | null;
};

type Rank = { key: string; name: string; color: string; insignia: string; level: number };

export function rankOf(p: RankFields | null | undefined): { rank: Rank; level: number; prestige: number } | null {
  if (!p || p.discord_level == null) return null;
  const rank = (RANKS as Rank[]).find((r) => r.key === p.discord_rank) || (rankForLevel(p.discord_level) as Rank);
  return { rank, level: p.discord_level, prestige: Math.max(0, p.discord_prestige || 0) };
}

/** Kurzer Text für title/aria: „Ace · Lv 52 · Ascended ✦2". */
export function rankTitle(p: RankFields | null | undefined): string {
  const r = rankOf(p);
  if (!r) return '';
  return `${r.rank.name} · Lv ${r.level}${r.prestige ? ` · ${PRESTIGE.name} ${PRESTIGE.star}${r.prestige}` : ''}`;
}

/**
 * Abzeichen in Rangfarbe: Zeichen + Name + Level. `compact` lässt den Namen
 * weg (Dock, enge Zeilen); der volle Rang steht dann im title.
 */
export function rankBadge(p: RankFields | null | undefined, compact = false): HTMLElement | null {
  const r = rankOf(p);
  if (!r) return null;
  const el = document.createElement('span');
  el.className = 'rk-badge' + (compact ? ' rk-badge--c' : '');
  el.style.setProperty('--rc', r.rank.color);
  el.title = 'Discord · ' + rankTitle(p);
  const ins = document.createElement('i');
  ins.setAttribute('aria-hidden', 'true');
  ins.textContent = r.rank.insignia;
  el.appendChild(ins);
  if (!compact) {
    const nm = document.createElement('span');
    nm.className = 'rk-nm';
    nm.textContent = r.rank.name;
    el.appendChild(nm);
  }
  const lv = document.createElement('span');
  lv.className = 'rk-lv';
  lv.textContent = compact ? String(r.level) : `Lv ${r.level}`;
  el.appendChild(lv);
  if (r.prestige) {
    const st = document.createElement('em');
    st.textContent = PRESTIGE.star + (r.prestige > 1 ? r.prestige : '');
    st.style.setProperty('--pc', PRESTIGE.color);
    el.appendChild(st);
  }
  // Für Screenreader ein Satz statt Zeichen-Salat.
  el.setAttribute('aria-label', 'Discord · ' + rankTitle(p));
  el.setAttribute('role', 'img');
  return el;
}
