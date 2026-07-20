// ═══════════════════════════════════════════════════════════════════════════
//  card.mjs — the /rank card. Renders a VerseBase-themed PNG via
//  @napi-rs/canvas when available (registering the site's own fonts), and
//  gracefully falls back to a rich embed with a unicode progress bar otherwise.
// ═══════════════════════════════════════════════════════════════════════════
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { levelForXp, progress } from './leveling.mjs';
import { rankForLevel, nextRank, rankIndex, prestigeStars, RANKS } from './ranks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = process.env.CARD_FONT_DIR || join(here, '..', 'assets', 'fonts');

let canvasMod;      // resolved @napi-rs/canvas module or null
let canvasTried = false;
let fontsReady = false;

async function getCanvas() {
  if (canvasTried) return canvasMod;
  canvasTried = true;
  try {
    canvasMod = await import('@napi-rs/canvas');
    registerFonts(canvasMod);
  } catch {
    canvasMod = null; // not installed / failed to build → embed fallback
  }
  return canvasMod;
}

function registerFonts({ GlobalFonts }) {
  if (fontsReady || !GlobalFonts) return;
  const reg = (file, family) => {
    const p = join(FONT_DIR, file);
    if (existsSync(p)) { try { GlobalFonts.registerFromPath(p, family); } catch { /* ignore */ } }
  };
  reg('orbitron-700-latin.woff2', 'VBDisplay');
  reg('rajdhani-600-latin.woff2', 'VBUI');
  reg('barlow-500-latin.woff2', 'VBBody');
  fontsReady = true;
}

const DISPLAY = 'VBDisplay, "Arial", sans-serif';
const UI = 'VBUI, "Arial", sans-serif';
const BODY = 'VBBody, "Arial", sans-serif';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/**
 * Returns a message payload ({ files?, embeds }) for a member's rank.
 * ctx = { db }
 */
export async function buildRankCard(ctx, { member, row, position, totalUsers }) {
  const config = ctx.db.getConfig(member.guild.id);
  if (config.card.image) {
    const canvas = await getCanvas();
    if (canvas) {
      try {
        const file = await renderImageCard(canvas, { member, row, position, totalUsers });
        return { files: [file] };
      } catch (e) {
        console.warn('[card] image render failed, using embed:', e.message);
      }
    }
  }
  return { embeds: [buildEmbedCard({ member, row, position, totalUsers })] };
}

function hexPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}
function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, h / 2, w / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
// Vector 5-point star (canvas has no emoji font, so prestige is drawn).
function star(g, cx, cy, outerR, innerR, color) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

async function renderImageCard({ createCanvas, loadImage }, { member, row, position, totalUsers }) {
  const W = 934, H = 282, PAD = 24;
  const level = levelForXp(row.xp);
  const rank = rankForLevel(level);
  const p = progress(row.xp);
  const nxt = nextRank(level);
  const tier = rankIndex(rank) + 1;

  const canvas = createCanvas(W, H);
  const g = canvas.getContext('2d');

  // clip to a rounded card
  roundRect(g, 0, 0, W, H, 28); g.clip();

  // background
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0c1626'); bg.addColorStop(1, '#05070d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // faint hexagon watermark on the right
  g.save();
  g.globalAlpha = 0.10; g.strokeStyle = rank.color; g.lineWidth = 16;
  hexPath(g, W - 150, H / 2, 150); g.stroke();
  g.globalAlpha = 0.9; g.fillStyle = rank.color;
  g.beginPath(); g.arc(W - 150, H / 2, 16, 0, Math.PI * 2); g.fill();
  g.restore();

  // left accent bar
  g.fillStyle = rank.color; g.fillRect(0, 0, 8, H);

  // avatar
  const ar = 82, ax = 46, ay = H / 2;
  try {
    const avatar = await loadImage(member.displayAvatarURL({ extension: 'png', size: 256 }));
    g.save();
    g.beginPath(); g.arc(ax + ar, ay, ar, 0, Math.PI * 2); g.closePath(); g.clip();
    g.drawImage(avatar, ax, ay - ar, ar * 2, ar * 2);
    g.restore();
  } catch { /* no avatar — ring still drawn */ }
  g.beginPath(); g.arc(ax + ar, ay, ar + 4, 0, Math.PI * 2);
  g.strokeStyle = rank.color; g.lineWidth = 5; g.stroke();

  const tx = 260;

  // name (+ prestige stars)
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff'; g.font = `700 42px ${DISPLAY}`;
  const name = truncate(member.displayName, 16);
  g.fillText(name, tx, 88);
  if (row.prestige > 0) {
    const nameW = g.measureText(name).width;
    let sx = tx + nameW + 26;
    for (let s = 0; s < row.prestige; s++) { star(g, sx, 73, 11, 4.6, '#ffd479'); sx += 27; }
  }

  // rank line
  g.fillStyle = rank.color; g.font = `600 32px ${UI}`;
  g.fillText(rank.name, tx, 132);

  // tier + position
  g.fillStyle = '#8ea0be'; g.font = `500 21px ${BODY}`;
  const posText = position ? `   ·   #${position} of ${totalUsers}` : '';
  g.fillText(`Rank tier ${tier}/${RANKS.length}${posText}`, tx, 166);

  // big LEVEL (right aligned)
  g.textAlign = 'right';
  g.fillStyle = '#9fb2cc'; g.font = `700 22px ${UI}`;
  g.fillText('LEVEL', W - 40, 66);
  g.fillStyle = rank.color; g.font = `700 88px ${DISPLAY}`;
  g.fillText(String(level), W - 40, 150);
  g.textAlign = 'left';

  // progress bar
  const bx = tx, by = 196, bw = W - tx - 40, bh = 26;
  roundRect(g, bx, by, bw, bh, bh / 2);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
  const fillW = Math.max(bh, Math.round(bw * p.pct));
  roundRect(g, bx, by, fillW, bh, bh / 2);
  const fg = g.createLinearGradient(bx, 0, bx + bw, 0);
  fg.addColorStop(0, rank.color); fg.addColorStop(1, '#ffffff');
  g.fillStyle = fg; g.fill();

  // xp + next-rank labels
  g.fillStyle = '#c6d2e6'; g.font = `500 20px ${BODY}`;
  g.fillText(`${fmt(p.into)} / ${fmt(p.needed)} XP`, bx, by + bh + 28);
  g.textAlign = 'right';
  g.fillText(nxt ? `Next: ${nxt.name} · Lv ${nxt.level}` : 'MAX RANK', bx + bw, by + bh + 28);
  g.textAlign = 'left';

  return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'rank.png' });
}

function bar(pct, len = 20) {
  const filled = Math.max(0, Math.min(len, Math.round(pct * len)));
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function buildEmbedCard({ member, row, position, totalUsers }) {
  const level = levelForXp(row.xp);
  const rank = rankForLevel(level);
  const p = progress(row.xp);
  const nxt = nextRank(level);
  const tier = rankIndex(rank) + 1;

  const embed = new EmbedBuilder()
    .setColor(rank.color)
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL({ size: 128 }) })
    .setTitle(`${rank.insignia} ${rank.name}${row.prestige ? '  ' + prestigeStars(row.prestige) : ''}`)
    .setDescription(`\`${bar(p.pct)}\`  **${Math.round(p.pct * 100)}%**`)
    .addFields(
      { name: 'Level', value: `**${level}**`, inline: true },
      { name: 'XP', value: `${fmt(p.into)} / ${fmt(p.needed)}`, inline: true },
      { name: 'Server rank', value: position ? `#${position} / ${totalUsers}` : '—', inline: true },
      { name: 'Rank tier', value: `${tier} of ${RANKS.length}`, inline: true },
      { name: 'Lifetime XP', value: fmt(row.total_xp), inline: true },
      { name: 'Next rank', value: nxt ? `${nxt.insignia} ${nxt.name} · Lv ${nxt.level}` : 'MAX', inline: true },
    )
    .setFooter({ text: 'VerseBase • rank system' });
  return embed;
}
