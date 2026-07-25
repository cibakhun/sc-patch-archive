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
├─ order-roles.mjs ← sorts the role hierarchy (npm run order)
├─ audit.mjs       ← read-only health check of the live server (npm run audit)
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
  and pronoun roles. Plus the **12 rank roles + prestige** the always-on bot provisions
  (see [`bot/`](./bot)).
- **6 categories · 41 channels** — Start Here, The Verse (chat, #patch-chat, #suggestions,
  a rank-gated 🎖 #veterans-lounge, #bot-commands), Tools & Data (each channel paired with
  its verse-base.com tool, plus #support), Crew Up, Voice, and a private staff Flight Deck.
- **Coherent permissions** — read-only info/announcement channels (the bot can still post
  its patch feed there); a **newcomer anti-spam gate** (new accounts chat freely but unlock
  links/images/attachments at rank Prospect, level 5); and a **rank-gated veterans’ lounge**
  that opens at Citizen (level 15).
- **AutoMod** — spam, mass-mention, invite-link and slur filters, blocking + logging to
  #mod-log, with staff exempt.
- **Community features** — rules & community-updates channels, medium verification, media
  scanning, mention-only default notifications.
- **Native onboarding** — new members pick playstyle / ping / language / pronoun roles.
- **Welcome screen**, **server icon** (the site's hexagon mark) and **pinned seed posts**
  (welcome, rules, server map, patch feed, roles guide, bot-commands guide, lounge, support…).

> **The two halves fit together.** The builder owns roles, channels, permissions and AutoMod;
> the always-on **bot** (`bot/`) owns XP, ranks and prestige. They share one source of truth:
> the builder reads the bot's rank ladder (`bot/src/ranks.mjs`) to place rank-gated channels
> and to keep role order in sync, and the bot reads channel **names** to know where to stay
> silent (no-XP channels) and where to post level-ups — so no manual `/rank-admin` wiring is
> needed. **Deploy order:** update the bot first (so rank roles carry the gate permissions),
> then `npm run build`, then `npm run order`.

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
npm run order       # sort the role hierarchy (after the bot has created rank roles)
npm run audit       # read-only: diff the live server against the blueprint
```

You'll see a step-by-step log. When it finishes, the server is live. **Re-run `npm run build`
any time** after editing the blueprint — it reconciles the live server to match.

### `npm run audit` — does the live server still match?

A read-only pass that **never writes to Discord**. It fetches the live guild and diffs every
role, permission bit, channel, overwrite, AutoMod rule, onboarding prompt, welcome-screen
entry, emoji and pinned seed post against `blueprint.mjs` and the bot's rank ladder — then
**simulates Discord's own permission resolution** to print what a brand-new member, a
Prospect, a Citizen, a moderator and the bot can actually do in every channel. It also
catches things the blueprint can't describe: foreign global slash commands on the
application, Public Bot left on, invites that expire, staff roles nobody holds, ping roles
anyone can @mention, and stage channels where the audience can put itself on stage.

Findings are `✗ ERROR` (broken), `! WARN` (drifted) or `· INFO`. Add `--json <file>` to dump
them for tooling. Run it after every build, and before opening the server to new members.

---

## Customise

Everything lives in [`blueprint.mjs`](./blueprint.mjs):

- **Add a channel** → add an entry to a category's `channels` array (give it a unique `key`).
  The order of the arrays **is** the order on the server — the builder applies positions.
- **Add a role** → add to `roles` (top → bottom order). Reference its `key` from onboarding
  options or channel `overwrites`.
- **Give a role to someone** → `roleAssignments` (`owner` / `bot`). Creating a role isn't the
  same as anyone holding it: without this the hoisted staff group is empty, the private
  Flight Deck has no humans in it and the AutoMod exemptions apply to nobody.
- **Forum tags** → `tags: [...]` on a forum channel. Existing tags keep their id (matched by
  name), so posts already filed under a tag don't lose it on a re-run.
- **The permanent invite** → `guild.inviteChannel`. Hand-made invites expire after 30 days,
  which quietly kills any link on the website; the builder keeps one never-expiring invite
  alive and prints it.
- **Gate a channel by rank** → add `minRank: '<rankKey>'` (a key from `bot/src/ranks.mjs`,
  e.g. `'citizen'`). @everyone loses view; everyone at that rank and above (and prestiged
  members) gets it. Needs the bot to have created the rank roles first.
- **Exclude a channel from XP** → add `noXp: true`, and mirror its base name in the bot's
  `noXpChannelNames` (`bot/src/config.mjs`). `npm run validate` warns if the two drift apart.
- **Tune the newcomer gate** → it lives across two files: `everyonePermissions` here (drops
  `EmbedLinks`/`AttachFiles`) and `TRUSTED_LEVEL`/`rankPermissions` in `bot/src/ranks.mjs`
  (which rank lifts it). To switch it off, add those two perms back to `everyonePermissions`.
- **Tune AutoMod** → edit the `autoMod` block (rules, mention limit, exempt roles, alert channel).
- **Change onboarding** → edit `onboarding.prompts`.
- **Reword the pinned posts** → edit `seed`, then re-run `npm run build`. The builder finds
  its own **pinned** seed post and updates it in place (or replaces it) — no manual deletion.
  Other bot messages (like the rank bot's patch auto-posts, which are never pinned) are left
  untouched.

`npm run validate` catches broken references (a channel that points at a missing role, a typo
in a permission name, an unknown `minRank` or AutoMod trigger, a no-XP mismatch) before you
ever hit the API.

---

## Notes & troubleshooting

- **Roles look out of order.** Run **`npm run order`** — it sorts every role into the
  intended hierarchy (staff → ranks → playstyles → pings → language → pronouns) one role at a
  time. It's a separate step because (a) Discord's *bulk* reorder API returns a misleading
  "Missing Permissions" even when the bot's role is on top, and (b) the rank roles are created
  by the always-on bot, so they only exist to be ordered after that bot has run. Make sure the
  bot's own role sits above the roles it manages (it does by default).
- **New members can't post links or images.** That's the newcomer anti-spam gate working —
  it lifts at rank Prospect (level 5). Make sure you **updated the bot before building**, so
  the rank roles carry the `EmbedLinks`/`AttachFiles` permissions; otherwise even veterans lose
  them until the bot's next start. To relax the gate, see *Customise* above.
- **#veterans-lounge is staff-only after a build.** The rank roles didn't exist yet. Start the
  bot once (it creates them), then re-run `npm run build` — the gate resolves and members at
  Citizen+ get in. `validate` and the build log both warn when this happens.
- **Onboarding / welcome screen skipped.** They require Community mode. The builder turns it
  on first, but if that step failed, fix it (Server Settings → Enable Community) and re-run.
- **"Bot is in multiple servers."** Set `GUILD_ID` in `.env` (right-click the server →
  Copy Server ID, with Developer Mode on).
- **Banner image** needs server Boost Level 2 and can't be set by the builder — add it by hand
  once you have boosts.
- **Never commit `.env`.** It holds the bot token and is git-ignored. If it ever leaks, hit
  **Reset Token** in the Developer Portal.
- **Stage channels have their own rules.** A Stage *moderator* needs `ManageChannels` +
  `MuteMembers` + `MoveMembers` **in that channel** — 🛰 Navigators get the first one as a
  channel overwrite only, so moderators can run 📻 Briefing Room without server-wide channel
  management. And anyone holding `Speak` can put *themselves* on stage, so @everyone loses
  `Speak` there and keeps `RequestToSpeak` (raise a hand) instead.

---

## Moving the bot to its own application

One application = one bot identity = one set of global slash commands. If the token is shared
with another project, **that project's global commands show up in this server's command
picker for every member**, and the bot's name and profile are whatever that project called
it. `npm run audit` reports both. Migrating is safe — rank roles, the XP database, emoji and
every channel survive, because none of them belong to the application.

**You do these (Claude can't sign in for you):**

1. <https://discord.com/developers/applications> → **New Application** → name it `VerseBase`.
2. **General Information** → set the description and upload `assets/verse-base-icon.png` as
   the app icon. Copy the **Application ID**.
3. **Bot** tab → set **Username** to `Verse-Bot`, upload the same image as the avatar,
   **untick Public Bot**, leave every privileged intent **off** → **Reset Token** → copy it.
4. Paste that token into **both** `discord/.env` and `discord/bot/.env` (keep `GUILD_ID`).
5. Invite it — the old bot stays for now, so the server is never without an admin bot:
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot+applications.commands&permissions=8
   ```
6. Server Settings → **Roles** → drag the new bot's role to the **top**, above ⭐ Fleet Command.
7. Coolify → *VerseBase Bot* → **Environment** → replace `DISCORD_TOKEN` → **Redeploy**.
8. Once the new bot is online: **kick the old bot** from the server.

**Then re-run these — in this order:**

```bash
npm run build    # re-points every bot-role overwrite at the NEW managed role
npm run order    # rebuilds the hierarchy under the new bot role
npm run audit    # lists whatever the swap left behind
```

Step 8 deletes the old bot's managed role, and Discord drops the channel overwrites that
referenced it — the read-only channels and 🎖 veterans-lounge lose their "the bot may post
here" grant until `npm run build` puts it back. Don't skip it.

### Two things the swap leaves behind

**Blank ghost messages.** Deleting the old application **strips the embeds off every message
it ever sent** — the pinned seed posts survive as empty messages, and the builder can't edit
or replace them (different author), so it posts a second copy alongside. `npm run build` and
`npm run audit` both report them. Clear them with:

```bash
node clean-orphaned-messages.mjs --author OLD_APPLICATION_ID            # dry run
node clean-orphaned-messages.mjs --author OLD_APPLICATION_ID --delete   # remove
```

It only ever touches messages that are bot-written, from an account no longer in the server,
not a system notice, and **completely empty** — and it skips the public-updates channel,
because Discord's own "Community Updates" and "automod" accounts look identical to an
orphaned bot. Run the dry run first and read the list.

**The patch feed goes blank too.** The mirrored patch post is one of those stripped messages,
and the bot's database still says that version was posted, so it won't re-post on its own.
Bump `POST_FMT` in [`bot/src/patch-watch.mjs`](./bot/src/patch-watch.mjs) (e.g. `bi2` → `bi3`)
and deploy: the next start re-posts the current patch silently, with no ping.
