# VerseBase — Discord server builder

The whole **VerseBase** community server, defined in code and built via the Discord API.
Edit [`blueprint.mjs`](./blueprint.mjs), run one command, and the server matches it — roles,
channels, permissions, Community features, onboarding, the welcome screen, branding and
seed content. It's **idempotent**: run it as often as you like and it updates in place
instead of making duplicates.

No always-on bot to host. A one-shot builder logs in, applies the blueprint, and logs out.
Role/interest selection is handled by Discord's **native onboarding**, so nothing needs to
keep running afterwards.

```
discord/
├─ blueprint.mjs   ← the entire server as data (edit this)
├─ build.mjs       ← the engine (validate + build)
├─ make-icon.mjs   ← generates the server icon (zero deps)
├─ assets/         ← verse-base-icon.png (generated)
├─ .env            ← your bot token (git-ignored; you create this)
└─ .env.example    ← template
```

---

## What gets built

- **19 roles** — staff (⭐ Fleet Command, 🛰 Navigators, 🤖 Flight Computer), self-assign
  playstyle roles colour-matched to each site tool (⛏ Miner, 💰 Trader, 🔧 Industrialist,
  🚀 Combat Pilot, 🧭 Explorer, 📜 Contractor, 🐟 Wikelo Regular), ping opt-ins, language
  and pronoun roles.
- **6 categories · 35 channels** — Start Here, The Verse, Tools & Data (each channel paired
  with its verse-base.com tool), Crew Up, Voice, and a private staff Flight Deck.
- **Community features** — rules & community-updates channels, medium verification, media
  scanning, mention-only default notifications.
- **Native onboarding** — new members pick playstyle / ping / language / pronoun roles.
- **Welcome screen**, **server icon** (the site's hexagon mark) and **pinned seed posts**
  (welcome, rules, server map, patch feed, roles guide).

---

## Setup — three things only you can do (~3 min)

> You need to be signed into Discord already. Claude can't log in for you.

### 1. Create the empty server
In Discord: the **`+`** on the left → **Create My Own** → **For me and my friends** →
name it anything (the builder renames it to *VerseBase*). Done.

### 2. Create the bot + copy its token
1. Go to <https://discord.com/developers/applications> → **New Application** → name it `VerseBase`.
2. Open the **Bot** tab → **Reset Token** → **Copy**.
3. In this folder, copy `.env.example` to `.env` and paste the token:
   ```
   DISCORD_TOKEN=your-token-here
   ```
4. *(Optional but tidy)* On the **Bot** tab, turn **off** "Public Bot" so only you can invite it.

No privileged intents are required — leave them off.

### 3. Invite the bot to your server (with Administrator)
Open this URL, replacing `YOUR_APPLICATION_ID` with the **Application ID** from the
Developer Portal's **General Information** tab:

```
https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot+applications.commands&permissions=8
```

Pick your new server, keep **Administrator** ticked, authorise.

---

## Build

From this `discord/` folder:

```bash
npm install         # once
npm run icon        # generate assets/verse-base-icon.png (optional; already committed)
npm run validate    # offline sanity check of the blueprint
npm run build       # log in and build the server
```

You'll see a step-by-step log. When it finishes, the server is live. **Re-run `npm run build`
any time** after editing the blueprint — it reconciles the live server to match.

---

## Customise

Everything lives in [`blueprint.mjs`](./blueprint.mjs):

- **Add a channel** → add an entry to a category's `channels` array (give it a unique `key`).
- **Add a role** → add to `roles` (top → bottom order). Reference its `key` from onboarding
  options or channel `overwrites`.
- **Change onboarding** → edit `onboarding.prompts`.
- **Reword the pinned posts** → edit `seed`, then re-run `npm run build`. The builder finds
  its own **pinned** seed post and updates it in place (or replaces it) — no manual deletion.
  Other bot messages (like the rank bot's patch auto-posts, which are never pinned) are left
  untouched.

`npm run validate` catches broken references (a channel that points at a missing role, a typo
in a permission name) before you ever hit the API.

---

## Notes & troubleshooting

- **Roles look out of order.** Run **`npm run order`** — it sorts every role into the
  intended hierarchy (staff → ranks → playstyles → pings → language → pronouns) one role at a
  time. It's a separate step because (a) Discord's *bulk* reorder API returns a misleading
  "Missing Permissions" even when the bot's role is on top, and (b) the rank roles are created
  by the always-on bot, so they only exist to be ordered after that bot has run. Make sure the
  bot's own role sits above the roles it manages (it does by default).
- **Onboarding / welcome screen skipped.** They require Community mode. The builder turns it
  on first, but if that step failed, fix it (Server Settings → Enable Community) and re-run.
- **"Bot is in multiple servers."** Set `GUILD_ID` in `.env` (right-click the server →
  Copy Server ID, with Developer Mode on).
- **Banner image** needs server Boost Level 2 and can't be set by the builder — add it by hand
  once you have boosts.
- **Never commit `.env`.** It holds the bot token and is git-ignored. If it ever leaks, hit
  **Reset Token** in the Developer Portal.
