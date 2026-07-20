# VerseBase — Rank & Leveling Bot

A full-depth XP/rank system for the VerseBase Discord, built as an **always-on
gateway bot** (discord.js). Members earn XP from chatting and hanging out in
voice, climb a deep Star-Citizen-themed rank ladder with auto-assigned role
rewards, and can prestige at the top. Everything is persisted in SQLite and
fully configurable from inside Discord.

> **Why always-on (not Cloudflare Workers)?** A leveling system has to see
> messages and voice activity, which only a Gateway connection delivers.
> Workers receive slash commands but never message/voice events, so XP-from-
> activity is impossible there. This bot runs as a small Node process next to
> the site. It needs **no privileged intents** (it never reads message content —
> only that a message happened).

This complements the one-shot server **builder** in [`../`](../): the builder
creates the channels/roles once; this bot runs continuously for ranks.

---

## Features

- **Text XP** — 15–25 XP per message with a 60s anti-spam cooldown (all tunable).
- **Voice XP** — per-minute XP for members in voice; ignores AFK, solo, and
  self-muted/deafened members (configurable). Survives restarts (stateless sweep).
- **Multipliers** — global event boost (double-XP weekend), server-booster bonus,
  per-role and per-channel multipliers, and a permanent prestige bonus. They stack.
- **No-XP channels** — blacklist spam/bot channels.
- **Deep rank ladder** — 12 ranks from *Drifter* to *Frontier Legend*, each a
  colored role the bot **self-provisions** and assigns on rank-up.
- **Prestige** — prestige at max level for a permanent XP bonus and a ✦ role.
- **Rank card** — a themed PNG (`/rank`) rendered with the site's own fonts, with
  a rich embed fallback if the image renderer isn't available.
- **Leaderboard** — paginated, with medals and Prev/Next buttons.
- **Full admin** — `/rank-admin` covers XP edits, level sets, all config, gated
  behind *Manage Server*.
- **Announcements** — themed rank-up posts (fixed channel / where they leveled /
  off), optional DM, optional only-on-rank-change.

### The rank ladder

| Level | Rank | | Level | Rank |
|------:|------|-|------:|------|
| 0 | 🌑 Drifter        | | 40 | 🎖️ Veteran |
| 5 | ⛏️ Prospect       | | 50 | ⭐ Ace |
| 10 | 🛰️ Rookie Pilot  | | 65 | 🔥 Vanguard |
| 15 | ⬡ Citizen        | | 80 | 🗺️ Pathfinder |
| 20 | 🧭 Wayfarer       | | 90 | 🏆 Trailblazer |
| 30 | 🚀 Journeyman     | | 100 | 👑 Frontier Legend |

Prestige adds ✦ **Ascended** tiers on top. Edit the whole ladder in
[`src/ranks.mjs`](src/ranks.mjs).

---

## Setup

### 1. Bot application
Use the same application as the rest of VerseBase (or make one at
<https://discord.com/developers/applications>). Copy the **Bot token**. No
privileged intents are required — leave them off.

### 2. Invite it (with Manage Roles)
Replace `YOUR_APP_ID` with your Application ID:

```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot+applications.commands&permissions=2416036864
```

That grant = View Channels, Send Messages, Embed Links, Attach Files, Read
History, **Manage Roles**, Use Application Commands.

> After inviting, drag the bot's role **near the top** of Settings → Roles.
> The bot can only create/assign rank roles that sit *below* its own.

### 3. Configure & run

```bash
cd discord/bot
cp .env.example .env      # then paste DISCORD_TOKEN (and GUILD_ID for instant commands)
npm install
npm run selftest          # optional: 27 offline checks
npm run register          # push slash commands (instant if GUILD_ID is set)
npm start                 # go live
```

On first launch the bot creates the rank roles and starts the voice sweep.

---

## Deploy (keep it running)

**pm2**
```bash
npm i -g pm2
pm2 start src/index.mjs --name verse-rank
pm2 save && pm2 startup
```

**systemd** (`/etc/systemd/system/verse-rank.service`)
```ini
[Unit]
Description=VerseBase rank bot
After=network.target
[Service]
WorkingDirectory=/path/to/discord/bot
ExecStart=/usr/bin/node src/index.mjs
Restart=always
[Install]
WantedBy=multi-user.target
```

**Docker** — Node 20+ base, `npm ci --omit=dev` (add build tools for
better-sqlite3), mount a volume at `./data` so the database survives redeploys.

---

## Commands

| Command | Who | What |
|---|---|---|
| `/rank [user]` | everyone | Rank card — level, rank, XP bar, server position |
| `/leaderboard [page]` | everyone | Top members, medals, Prev/Next buttons |
| `/ranks` | everyone | The full ladder with your position highlighted |
| `/prestige` | everyone | Prestige once you hit the max level |
| `/rank-admin …` | Manage Server | Everything below |

**`/rank-admin`**
- `xp give|set|level|reset <user> …` — adjust a member's XP/level
- `announce mode|channel|only-ranks|dm …` — where/how level-ups are posted
- `multiplier global|booster|role|channel …` — XP multipliers (channel `0` disables)
- `noxp add|remove <channel>` — exclude channels from XP
- `text-xp [min] [max] [cooldown]` — text XP amounts
- `voice-xp <per-minute>` — voice XP rate
- `view` — show the current configuration

---

## How XP works

- **Text:** each message (outside cooldown, outside no-XP channels) grants a
  random amount in `[min,max]`, multiplied by any active multipliers.
- **Voice:** every 60s the bot grants `perMinute` XP to each eligible member in
  voice, times their multipliers.
- **Multiplier** = `global × booster? × (highest role factor) × channel factor ×
  (1 + prestigeBonus × stars)`. A channel factor of `0` disables XP there.
- **Curve:** Mee6-style — XP to go from level *L* to *L+1* is `5L² + 50L + 100`.

Defaults live in [`src/config.mjs`](src/config.mjs); per-server overrides are
stored in the database via `/rank-admin`.

---

## Rank card fonts

Image cards use the site's fonts, copied into [`assets/fonts/`](assets/fonts):
`orbitron-700`, `rajdhani-600`, `barlow-500`. If `@napi-rs/canvas` fails to
install, or `card.image` is off, `/rank` falls back to a rich embed. Point
`CARD_FONT_DIR` at another folder to override.

---

## Data & backup

Everything lives in `data/leveling.db` (SQLite, WAL mode). Back it up by copying
the `data/` folder while the bot is stopped, or with SQLite's online backup. It's
git-ignored.

## Troubleshooting

- **Roles not assigned / "role sync failed"** — the bot's role must be above the
  rank roles and it needs *Manage Roles*. Drag it up and restart.
- **Commands don't appear** — run `npm run register`. Global commands take up to
  an hour; set `GUILD_ID` in `.env` for instant guild commands.
- **No image on `/rank`** — `@napi-rs/canvas` didn't install; the embed fallback
  is used. Reinstall with build tools present, or leave it — the embed is fine.
- **Voice XP not granted** — needs ≥2 non-bot members in the channel by default
  (`voice.requireOthers`), and not the AFK channel.
