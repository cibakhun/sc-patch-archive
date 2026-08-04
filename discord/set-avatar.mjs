// ═════════════════════════════════════════════════════════════════════════
//  set-avatar.mjs — puts assets/verse-bot-avatar.png on the bot itself, so the
//  profile picture is code like everything else here instead of a manual
//  upload in the Developer Portal.
//
//  Discord keeps TWO images for a bot and both matter:
//    · the bot USER avatar   (PATCH /users/@me)        → messages, member list
//    · the APPLICATION icon  (PATCH /applications/@me) → profile popout, invite
//                                                        dialog, App Directory
//  Setting only the first leaves the old icon showing wherever Discord reaches
//  for the application instead of the user, so this script always sets both.
//
//  Three REST calls, so it uses plain `fetch` — no dependencies, no gateway
//  login, no intents. Runs before `npm install` if it has to.
//
//    npm run avatar:apply                → both, from assets/verse-bot-avatar.png
//    npm run avatar:apply -- --dry-run   → report what it would send, change nothing
//    npm run avatar:apply -- --file assets/verse-bot-avatar-xp-ring.png
//    npm run avatar:apply -- --avatar-only | --icon-only
//
//  Needs DISCORD_TOKEN (.env next to this file, the same one build.mjs uses).
// ═════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API = 'https://discord.com/api/v10';
// Both routes are constants — no ids to interpolate.
const USER_ROUTE = '/users/@me';
const APP_ROUTE = '/applications/@me';

// ── env — this file's own .env, plus the main checkout's when run from a worktree ──
for (const dir of [__dirname, join(__dirname, '..', '..', '..', '..', 'discord')]) {
  const p = join(dir, '.env');
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^['"]|['"]$/g, '');
    if (!(m[1] in process.env) && v) process.env[m[1]] = v;
  }
}

// ── output ─────────────────────────────────────────────────────────────────
const clr = (c, s) => `\x1b[${c}m${s}\x1b[0m`;
const step = (s) => console.log(clr('36;1', `\n▸ ${s}`));
const ok = (s) => console.log(clr('32', `  ✓ ${s}`));
const info = (s) => console.log(clr('90', `  · ${s}`));
const warn = (s) => console.log(clr('33', `  ! ${s}`));
const fail = (s) => { console.error(clr('31;1', `\n✗ ${s}\n`)); process.exit(1); };

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const doAvatar = !argv.includes('--icon-only');
const doIcon = !argv.includes('--avatar-only');
const flagValue = (name) => {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('-')) return argv[i + 1];
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
};

const fileArg = flagValue('--file') ?? 'assets/verse-bot-avatar.png';
const imgPath = isAbsolute(fileArg) ? fileArg : join(__dirname, fileArg);
const show = (p) => (relative(process.cwd(), p) || p).replace(/\\/g, '/');

// ── the image ──────────────────────────────────────────────────────────────
if (!existsSync(imgPath)) {
  fail(`No image at ${show(imgPath)}\n  Generate one first:  npm run avatar`
    + `\n  Or compare the variants:  npm run avatar -- --all`);
}
const bytes = readFileSync(imgPath);
if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${show(imgPath)} is not a PNG.`);
// Discord's ceiling is 10 MB; ours is a fraction of that, so this only ever
// catches a wrong --file.
if (bytes.length > 10 * 1024 * 1024) fail(`${show(imgPath)} is ${(bytes.length / 1048576).toFixed(1)} MB — Discord's limit is 10 MB.`);
const dataUri = `data:image/png;base64,${bytes.toString('base64')}`;
const kb = `${(bytes.length / 1024).toFixed(1)} KB`;

step('Image');
info(`${show(imgPath)} — ${kb}, modified ${statSync(imgPath).mtime.toISOString().slice(0, 16).replace('T', ' ')}`);
if (!doAvatar) info('--icon-only: the bot user avatar stays as it is');
if (!doIcon) info('--avatar-only: the application icon stays as it is');

if (DRY) {
  step('Dry run — nothing sent');
  if (doAvatar) info(`would PATCH ${USER_ROUTE} { avatar: <${kb} PNG> }`);
  if (doIcon) info(`would PATCH ${APP_ROUTE} { icon: <${kb} PNG> }`);
  console.log('');
  process.exit(0);
}

// ── token ──────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) fail('DISCORD_TOKEN missing. Copy .env.example → .env and set it (the same token build.mjs uses).');

async function call(method, route, body) {
  const res = await fetch(API + route, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      // Discord asks bots to identify themselves on every REST call.
      'User-Agent': 'DiscordBot (https://verse-base.com, 1.0.0) VerseBase-set-avatar',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (res.ok) return json;
  const err = new Error(json.message || `HTTP ${res.status}`);
  err.status = res.status;
  err.retryAfter = json.retry_after ?? (res.headers.get('retry-after') ? Number(res.headers.get('retry-after')) : undefined);
  err.code = json.code;
  throw err;
}

// ── who are we? ────────────────────────────────────────────────────────────
step('Bot');
let me;
try {
  me = await call('GET', USER_ROUTE);
} catch (e) {
  fail(`Could not read ${USER_ROUTE}: ${e.message}`
    + (e.status === 401 ? '\n  401 — the token is wrong or was reset in the Developer Portal.' : ''));
}
info(`${me.username}${me.discriminator && me.discriminator !== '0' ? `#${me.discriminator}` : ''} — application ${me.id}`);
info(`current avatar: ${me.avatar ?? clr('33', "none (Discord's default)")}`);

const cdn = (kind, id, hash) => `https://cdn.discordapp.com/${kind}/${id}/${hash}.png`;

/** PATCHes one route and reports whether the stored hash actually moved. */
async function apply(label, route, body, field, kind, before) {
  try {
    const res = await call('PATCH', route, body);
    const after = res?.[field] ?? null;
    if (before !== undefined && before === after) info(`${label} unchanged — already this image`);
    else ok(`${label} set${after ? ` — ${cdn(kind, res.id ?? me.id, after)}` : ''}`);
    return true;
  } catch (e) {
    // Avatar changes are rate-limited per bot; the wait is minutes, not hours.
    if (e.retryAfter) warn(`${label} rate-limited — retry in ${Math.ceil(e.retryAfter)}s`);
    else warn(`${label} failed: ${e.message}${e.code ? ` (code ${e.code})` : ''}`);
    return false;
  }
}

step('Applying');
let allGood = true;
if (doAvatar) allGood = await apply('Bot avatar', USER_ROUTE, { avatar: dataUri }, 'avatar', 'avatars', me.avatar) && allGood;
if (doIcon) allGood = await apply('Application icon', APP_ROUTE, { icon: dataUri }, 'icon', 'app-icons') && allGood;

console.log('');
if (!allGood) fail('Not everything went through — see the warnings above.');
ok("Done. Discord's CDN caches avatars, so your own client may need a minute (or Ctrl+R) to show it.");
console.log('');
