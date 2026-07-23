// ═════════════════════════════════════════════════════════════════════════
//  blueprint.mjs — the entire VerseBase Discord server, as data.
//
//  This file is the single source of truth. Edit it and re-run `npm run build`
//  to evolve the live server: the builder is idempotent, so it updates what
//  changed and creates what's missing without making duplicates.
//
//  Pure data — no imports — so `npm run validate` can check it before you
//  ever install anything. Permission names are the discord.js
//  PermissionFlagsBits keys (e.g. "ManageMessages"); the builder resolves them
//  and warns on anything unknown, so newer names degrade gracefully.
//
//  Bilingual: Discord can't show static channel content per-user, so shared
//  text (topics, seed posts, onboarding, welcome screen) carries BOTH languages
//  inline — English first, then Deutsch, on a "·" or a divider line. The always-
//  on bot renders per-user replies in the caller's language instead (see bot/).
//
//  Brand colours mirror verse-base.com: the signature cyan, plus each site
//  tool's own accent mapped onto its matching role/channel.
// ═════════════════════════════════════════════════════════════════════════

export const SITE = 'https://verse-base.com';

// Brand palette (from the site's :root CSS vars)
export const C = {
  cyan: '#2dd4ff',     // --accent (signature)
  blue: '#6ea8ff',     // --accent-2
  gold: '#d4af37',     // --gold
  miningTeal: '#2fbfa4',
  tradePurple: '#a78bfa',
  craftOrange: '#ff5e1a',
  combatRed: '#e5484d',
  exploreBlue: '#3da5d9',
  missionAmber: '#f5a524',
  wikeloTeal: '#1fb8a6',
  pingCyan: '#7dd3fc',
  pingBlue: '#93c5fd',
  pingGold: '#fcd34d',
};

// ── Guild-level settings ───────────────────────────────────────────────────
export const guild = {
  name: 'VerseBase',
  systemChannel: 'general',      // where join / boost messages land
  afkChannel: 'v-afk',
  afkTimeout: 3600,              // seconds
};

// Baseline permissions for @everyone. Anything not listed is denied.
// (Notably absent: MentionEveryone and every Manage* permission.)
//
// NEWCOMER ANTI-SPAM GATE: EmbedLinks and AttachFiles are deliberately NOT here.
// Brand-new members can chat immediately, but can't post link embeds, images or
// file attachments until they reach the starter rank Prospect (level 5) — the
// always-on bot grants those two permissions to every rank role from Prospect up
// (see bot/src/ranks.mjs → rankPermissions, and bot/src/roles.mjs). This stops
// drive-by image/embed spam from throwaway accounts without hurting real talk.
// Moderators keep them via the 🛰 Navigators role below; admins via Administrator.
// To relax the gate, add 'EmbedLinks'/'AttachFiles' back to this list.
export const everyonePermissions = [
  'ViewChannel', 'CreateInstantInvite',
  'SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads',
  'AddReactions',
  'UseExternalEmojis', 'UseExternalStickers', 'ReadMessageHistory',
  'Connect', 'Speak', 'Stream', 'UseVAD', 'RequestToSpeak',
  'UseApplicationCommands', 'ChangeNickname',
  'SendVoiceMessages', 'SendPolls',
];

// ── Roles (top → bottom in the list) ───────────────────────────────────────
export const roles = [
  {
    key: 'fleet-command', name: '⭐ Fleet Command', color: C.cyan,
    hoist: true, mentionable: false, permissions: ['Administrator'],
    reason: 'Server administrators',
  },
  {
    key: 'navigators', name: '🛰 Navigators', color: C.blue,
    hoist: true, mentionable: true,
    permissions: [
      'KickMembers', 'BanMembers', 'ModerateMembers', 'ManageMessages',
      'ManageThreads', 'ManageNicknames', 'MuteMembers', 'DeafenMembers',
      'MoveMembers', 'ViewAuditLog', 'MentionEveryone', 'ManageEvents',
      // Mods are exempt from the newcomer gate — they always keep these.
      'EmbedLinks', 'AttachFiles',
    ],
    reason: 'Moderators',
  },
  {
    key: 'flight-computer', name: '🤖 Flight Computer', color: C.gold,
    hoist: true, mentionable: false, permissions: [],
    reason: 'Display role for bots / integrations',
  },

  // Interest roles — self-assigned in onboarding. Colours = the matching
  // verse-base.com tool accents.
  { key: 'miner', name: '⛏ Miner', color: C.miningTeal, hoist: false, mentionable: true, permissions: [] },
  { key: 'trader', name: '💰 Trader', color: C.tradePurple, hoist: false, mentionable: true, permissions: [] },
  { key: 'industrialist', name: '🔧 Industrialist', color: C.craftOrange, hoist: false, mentionable: true, permissions: [] },
  { key: 'combat-pilot', name: '🚀 Combat Pilot', color: C.combatRed, hoist: false, mentionable: true, permissions: [] },
  { key: 'explorer', name: '🧭 Explorer', color: C.exploreBlue, hoist: false, mentionable: true, permissions: [] },
  { key: 'contractor', name: '📜 Contractor', color: C.missionAmber, hoist: false, mentionable: true, permissions: [] },
  { key: 'wikelo', name: '🐟 Wikelo Regular', color: C.wikeloTeal, hoist: false, mentionable: true, permissions: [] },

  // Notification opt-ins
  { key: 'patch-watch', name: '🔔 Patch Pings', color: C.pingCyan, hoist: false, mentionable: true, permissions: [] },
  { key: 'announce-ping', name: '📢 Announcement Pings', color: C.pingBlue, hoist: false, mentionable: true, permissions: [] },
  { key: 'event-ping', name: '🎉 Event Pings', color: C.pingGold, hoist: false, mentionable: true, permissions: [] },

  // Language
  { key: 'lang-en', name: '🇬🇧 English', color: null, hoist: false, mentionable: false, permissions: [] },
  { key: 'lang-de', name: '🇩🇪 Deutsch', color: null, hoist: false, mentionable: false, permissions: [] },

  // Pronouns (optional)
  { key: 'pn-they', name: 'they/them', color: null, hoist: false, mentionable: false, permissions: [] },
  { key: 'pn-she', name: 'she/her', color: null, hoist: false, mentionable: false, permissions: [] },
  { key: 'pn-he', name: 'he/him', color: null, hoist: false, mentionable: false, permissions: [] },
  { key: 'pn-ask', name: 'ask me', color: null, hoist: false, mentionable: false, permissions: [] },
];

// Convenience: who can view/talk in the private staff category.
const STAFF_VIEW = {
  everyone: { deny: ['ViewChannel'] },
  'fleet-command': { allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
  'navigators': { allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
  'flight-computer': { allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
};

// ── Categories & channels ──────────────────────────────────────────────────
// type: text | announcement | voice | stage | forum | category
// readonly: @everyone can read + react but not post (staff can post)
// Topics are bilingual (EN · DE); voice/stage topics are ignored by Discord.
export const categories = [
  {
    key: 'cat-start', name: '⁘ START HERE',
    channels: [
      { key: 'welcome', name: '📜・welcome', type: 'announcement', readonly: true, topic: 'Welcome aboard — what VerseBase is, and how to get moving · Willkommen an Bord — was VerseBase ist und wie du loslegst' },
      { key: 'rules', name: '📏・rules', type: 'text', readonly: true, topic: 'The house rules. Read once, fly right · Die Serverregeln. Einmal lesen, sauber fliegen' },
      { key: 'start-here', name: '🧭・start-here', type: 'text', readonly: true, topic: 'Server map + every verse-base.com tool, linked · Server-Karte + alle verse-base.com-Tools, verlinkt' },
      { key: 'announcements', name: '📣・announcements', type: 'announcement', readonly: true, topic: 'Server news · opt into 📢 Announcement Pings · Server-News · 📢-Ankündigungs-Pings aktivieren' },
      { key: 'patch-notes', name: '🩹・patch-notes', type: 'announcement', readonly: true, topic: 'Every patch, mirrored from the archive · opt into 🔔 Patch Pings · Jeder Patch, aus dem Archiv gespiegelt · 🔔 Patch-Pings' },
      { key: 'roles-info', name: '🎭・pick-your-roles', type: 'text', readonly: true, topic: 'Grab interest, ping, language & pronoun roles any time · Interessen-, Ping-, Sprach- & Pronomen-Rollen jederzeit' },
    ],
  },
  {
    key: 'cat-verse', name: '🌌 THE VERSE',
    channels: [
      { key: 'general', name: '💬・general', type: 'text', topic: 'Main hangar — all-purpose chat · Haupt-Hangar — Plausch über alles' },
      { key: 'introductions', name: '👋・introductions', type: 'text', topic: 'New here? Say hi — handle, playstyle, home system · Neu hier? Sag Hallo — Name, Spielstil, Heimatsystem' },
      { key: 'patch-chat', name: '🩹・patch-chat', type: 'text', topic: 'Talk about the latest patch — the read-only feed is #patch-notes · Sprich über den neuesten Patch — der reine Feed ist #patch-notes' },
      { key: 'screenshots', name: '📸・screenshots', type: 'text', topic: 'Your best shots of the ’verse — images & clips welcome · Deine besten Aufnahmen aus dem ’Verse — Bilder & Clips willkommen' },
      { key: 'clips', name: '🎬・clips', type: 'text', topic: 'Highlight reels, montages, that one impossible save · Highlight-Clips, Montagen, die eine unmögliche Rettung' },
      { key: 'memes', name: '😂・memes', type: 'text', topic: '30k survivors welcome. Keep it light · 30k-Überlebende willkommen. Locker bleiben', noXp: true },
      { key: 'off-topic', name: '🪐・off-topic', type: 'text', topic: 'Everything that isn’t Star Citizen · Alles, was nicht Star Citizen ist', noXp: true },
      { key: 'suggestions', name: '💡・suggestions', type: 'text', topic: 'Ideas for the server & verse-base.com — one per post, react to vote · Ideen für den Server & verse-base.com — eine pro Post, mit Reaktion abstimmen', slowmode: 30 },
      // Rank reward: only members at ⬡ Citizen (level 15) or above can see + post here.
      // Change the threshold by editing `minRank` (any rank key from bot/src/ranks.mjs).
      { key: 'veterans-lounge', name: '🎖・veterans-lounge', type: 'text', minRank: 'citizen', topic: 'Regulars’ lounge — unlocks at ⬡ Citizen (level 15) · Stammgäste-Lounge — schaltet ab ⬡ Citizen (Level 15) frei' },
      { key: 'bot-commands', name: '🤖・bot-commands', type: 'text', topic: 'Home for /rank, /leaderboard & friends — earns no XP, so spam freely · Zuhause für /rank, /leaderboard & Co. — bringt kein XP, also leg los', slowmode: 3, noXp: true },
    ],
  },
  {
    key: 'cat-tools', name: '🛠 TOOLS & DATA',
    channels: [
      { key: 'mining', name: '⛏・mining', type: 'text', topic: `Minerals, refining & calculators · Erze, Raffination & Rechner → ${SITE}/topics/mining.html` },
      { key: 'trading', name: '💰・trading', type: 'text', topic: `Commodity routes & live prices · Warenrouten & Live-Preise → ${SITE}/item-finder.html` },
      { key: 'crafting', name: '🔧・crafting-salvage', type: 'text', topic: `Blueprints, planner & dismantling · Baupläne, Planer & Zerlegen → ${SITE}/topics/crafting.html` },
      { key: 'ships', name: '🚀・ships', type: 'text', topic: `Data sheets, specs & the 3D holo viewer · Datenblätter, Werte & 3D-Holo-Viewer → ${SITE}/schiffe.html` },
      { key: 'combat', name: '⚔・combat', type: 'text', topic: `Dogfights, loadouts & fleet ops · ship data sheets · Dogfights, Loadouts & Flottenops · Schiffs-Datenblätter → ${SITE}/schiffe.html` },
      { key: 'exploration', name: '🧭・exploration', type: 'text', topic: `Deep space & the Aaron Halo jump calc by Jordessey · Tiefraum & Aaron-Halo-Rechner von Jordessey → ${SITE}/precision-jump.html` },
      { key: 'missions', name: '📜・missions', type: 'text', topic: `Rewards & reputation · Belohnungen & Reputation → ${SITE}/missionen.html` },
      { key: 'wikelo-ch', name: '🐟・wikelo-emporium', type: 'text', topic: `Banu trades & the Emporium · Banu-Tauschgeschäfte & das Emporium → ${SITE}/topics/wikelo-emporium.html` },
      { key: 'guides', name: '📚・guides', type: 'forum', topic: 'Community guides & resources — one per thread · Community-Guides & Ressourcen — eins pro Thread' },
      { key: 'support', name: '🛟・support', type: 'text', topic: `Stuck on a tool, the bot, or the game? Ask here · Hängst du an einem Tool, dem Bot oder dem Spiel? Frag hier → ${SITE}` },
    ],
  },
  {
    key: 'cat-crew', name: '🤝 CREW UP',
    channels: [
      { key: 'lfg', name: '🔎・looking-for-group', type: 'text', topic: 'Find a crew or fill a seat — ping the playstyle roles · Crew finden oder Platz füllen — Spielstil-Rollen pingen' },
      { key: 'trade-deals', name: '💱・trade-deals', type: 'text', topic: 'Buy / sell / haul — post the route and the split · Kaufen / verkaufen / transportieren — Route & Anteil posten' },
      { key: 'org-recruitment', name: '🛡・org-recruitment', type: 'text', topic: 'Recruiting for your org? One post, no spam · Für deine Org rekrutieren? Ein Post, kein Spam', slowmode: 30 },
      { key: 'events-chat', name: '📅・events', type: 'text', topic: 'Community events & fleet ops — check the Events tab up top · Community-Events & Flottenops — Events-Tab oben' },
    ],
  },
  {
    key: 'cat-voice', name: '🔊 VOICE CHANNELS',
    channels: [
      { key: 'v-landing', name: '🛬 Landing Zone', type: 'voice' },
      { key: 'v-mining', name: '⛏ Mining Op', type: 'voice' },
      { key: 'v-trade', name: '💰 Trade Run', type: 'voice' },
      { key: 'v-combat', name: '🚀 Combat Wing', type: 'voice' },
      { key: 'v-chill', name: '🎧 Chill Lounge', type: 'voice' },
      { key: 'stage-briefing', name: '📻 Briefing Room', type: 'stage' },
      { key: 'v-afk', name: '💤 AFK', type: 'voice' },
    ],
  },
  {
    key: 'cat-staff', name: '🛡 FLIGHT DECK', private: true, overwrites: STAFF_VIEW,
    channels: [
      { key: 'staff-chat', name: '🗝・staff-chat', type: 'text', topic: 'Crew coordination · Crew-Koordination' },
      { key: 'mod-log', name: '🧾・mod-log', type: 'text', topic: 'Moderation trail · Moderations-Protokoll' },
      { key: 'bot-config', name: '⚙・bot-config', type: 'text', topic: 'Bot commands & configuration · Bot-Befehle & Konfiguration' },
      { key: 'staff-updates', name: '📥・community-updates', type: 'text', topic: 'Discord’s admin & Community notices land here · Discord-Admin- & Community-Hinweise landen hier' },
    ],
  },
];

// ── Community configuration ────────────────────────────────────────────────
export const community = {
  rulesChannel: 'rules',
  updatesChannel: 'staff-updates',
  verification: 'Medium',        // require verified email + 5 min membership
  contentFilter: 'AllMembers',   // scan all media
  notifications: 'OnlyMentions', // default: only @mentions ping
};

// ── AutoMod (server-side spam / abuse filters) ─────────────────────────────
// Applied idempotently by the builder through Discord's Auto Moderation API.
// Each rule blocks the offending message and, where a log channel exists, posts
// an alert to #mod-log. Staff roles are exempt. `trigger` maps to discord.js
// AutoModerationRuleTriggerType; unknown/older names are skipped with a warning
// so the rest still apply. Discord allows one Spam / MentionSpam / KeywordPreset
// rule and up to six Keyword rules — this set stays within that.
export const autoMod = {
  enabled: true,
  alertChannel: 'mod-log',
  exemptRoles: ['fleet-command', 'navigators'],
  rules: [
    { name: 'VerseBase • Spam filter', trigger: 'Spam', block: true },
    { name: 'VerseBase • Mention spam', trigger: 'MentionSpam', mentionLimit: 6, block: true, alert: true },
    {
      name: 'VerseBase • Invite links', trigger: 'Keyword', block: true, alert: true,
      // Blocks other servers’ invite links (poaching / raid bait) — except where
      // linking an org’s Discord is the whole point.
      regexPatterns: ['(?:discord(?:app)?\\.com/invite|discord\\.gg|discord\\.me|dsc\\.gg|discord\\.io)/\\S+'],
      exemptChannels: ['org-recruitment'],
      customMessage: 'Invite links aren’t allowed here — share them in #org-recruitment instead.',
    },
    { name: 'VerseBase • Hate speech', trigger: 'KeywordPreset', presets: ['Slurs'], block: true, alert: true },
  ],
};

// ── Welcome screen (the invite splash) ─────────────────────────────────────
// Discord caps description at 140 chars and each channel line at 50 — kept
// bilingual and compact.
export const welcomeScreen = {
  enabled: true,
  description: 'The Star Citizen compendium, now with a crew · Das Star-Citizen-Kompendium, jetzt mit Crew',
  channels: [
    { channel: 'start-here', emoji: '🧭', description: 'Map & tools · Karte & Tools' },
    { channel: 'rules', emoji: '📏', description: 'House rules · Serverregeln' },
    { channel: 'patch-notes', emoji: '🩹', description: 'Every patch · Alle Patches' },
    { channel: 'mining', emoji: '⛏', description: 'Minerals & calc · Erze & Rechner' },
    { channel: 'general', emoji: '💬', description: 'Say hi · Sag Hallo' },
  ],
};

// ── Onboarding (native role/interest selection) ────────────────────────────
// Prompt/option titles are bilingual (EN · DE). Combat and Exploration now map
// to real home channels (they used to grant a role but no channel).
export const onboarding = {
  enabled: true,
  defaultChannels: [
    'welcome', 'rules', 'start-here', 'announcements', 'patch-notes', 'patch-chat', 'roles-info',
    'general', 'introductions', 'screenshots', 'mining', 'trading', 'ships',
    'combat', 'exploration', 'missions', 'lfg', 'guides', 'suggestions', 'support',
  ],
  prompts: [
    {
      title: 'What do you fly for? · Wofür fliegst du?',
      type: 'multi', required: false,
      options: [
        { title: 'Mining · Bergbau', description: 'Rocks, gems & refining · Erze, Edelsteine & Raffination', emoji: '⛏', roles: ['miner'], channels: ['mining'] },
        { title: 'Trading · Handel', description: 'Routes, cargo & margins · Routen, Fracht & Margen', emoji: '💰', roles: ['trader'], channels: ['trading'] },
        { title: 'Crafting & Salvage · Handwerk & Bergung', description: 'Blueprints & scrap · Baupläne & Schrott', emoji: '🔧', roles: ['industrialist'], channels: ['crafting'] },
        { title: 'Combat · Kampf', description: 'PvP, bounties & fleet ops · PvP, Kopfgelder & Flottenops', emoji: '🚀', roles: ['combat-pilot'], channels: ['combat'] },
        { title: 'Exploration · Erkundung', description: 'Deep space & discovery · Tiefraum & Entdeckung', emoji: '🧭', roles: ['explorer'], channels: ['exploration'] },
        { title: 'Missions · Missionen', description: 'Contracts & reputation · Aufträge & Reputation', emoji: '📜', roles: ['contractor'], channels: ['missions'] },
        { title: 'Banu Trades · Banu-Handel', description: 'Wikelo’s Emporium · Wikelos Emporium', emoji: '🐟', roles: ['wikelo'], channels: ['wikelo-ch'] },
      ],
    },
    {
      title: 'Where should we ping you? · Wobei sollen wir dich pingen?',
      type: 'multi', required: false,
      options: [
        { title: 'Patch drops · Patch-Releases', description: 'New Star Citizen patches · Neue Star-Citizen-Patches', emoji: '🔔', roles: ['patch-watch'], channels: ['patch-notes'] },
        { title: 'Announcements · Ankündigungen', description: 'Server news · Server-News', emoji: '📢', roles: ['announce-ping'], channels: ['announcements'] },
        { title: 'Events · Events', description: 'Community events & ops · Community-Events & Ops', emoji: '🎉', roles: ['event-ping'], channels: ['events-chat'] },
      ],
    },
    {
      title: 'Pick your language · Wähle deine Sprache',
      type: 'single', required: false,
      options: [
        { title: 'English', description: 'The bot replies to you in English', emoji: '🇬🇧', roles: ['lang-en'], channels: [] },
        { title: 'Deutsch', description: 'Der Bot antwortet dir auf Deutsch', emoji: '🇩🇪', roles: ['lang-de'], channels: [] },
      ],
    },
    {
      title: 'Pronouns (optional) · Pronomen (optional)',
      type: 'multi', required: false,
      options: [
        { title: 'they/them', roles: ['pn-they'], channels: [] },
        { title: 'she/her', roles: ['pn-she'], channels: [] },
        { title: 'he/him', roles: ['pn-he'], channels: [] },
        { title: 'ask me · frag mich', roles: ['pn-ask'], channels: [] },
      ],
    },
  ],
};

// ── Seed content (posted + pinned once; re-runs skip already-seeded channels)
// Each entry is a list of embeds. Default colour is the brand cyan. Content is
// bilingual: an English block, a divider, then the German block.
const DIV = '\n─────────────\n';
export const seed = {
  welcome: [
    {
      title: '⬡ Welcome to VerseBase · Willkommen bei VerseBase',
      color: C.cyan,
      description: [
        `This is the community hangar for **[verse-base.com](${SITE})** — the unofficial Star Citizen compendium.`,
        '',
        'Item prices & locations, mining tools, a crafting database, Wikelo trades, ship data sheets with a 3D holo viewer, and the full patch archive of the Alpha 4 era — all game-accurate, and now with people to fly alongside.',
        '',
        '**Get moving:**',
        '🧭 Read <#start-here> for the map + every tool',
        '📏 Skim the <#rules>',
        '🎭 Pick your roles in onboarding (or <#roles-info>) — including your **language**, which sets the language the bot answers you in',
        '👋 Drop a line in <#introductions>',
        DIV,
        `Das ist der Community-Hangar für **[verse-base.com](${SITE})** — das inoffizielle Star-Citizen-Kompendium.`,
        '',
        'Item-Preise & Fundorte, Mining-Tools, eine Handwerks-Datenbank, Wikelo-Tauschgeschäfte, Schiffs-Datenblätter mit 3D-Holo-Viewer und das komplette Patch-Archiv der Alpha-4-Ära — alles spielgenau, und jetzt mit Leuten zum Mitfliegen.',
        '',
        '**Leg los:**',
        '🧭 Lies <#start-here> für die Karte + alle Tools',
        '📏 Überflieg die <#rules>',
        '🎭 Wähl deine Rollen im Onboarding (oder <#roles-info>) — inkl. deiner **Sprache**, die bestimmt, in welcher Sprache der Bot dir antwortet',
        '👋 Sag Hallo in <#introductions>',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  rules: [
    {
      title: '📏 The House Rules · Die Serverregeln',
      color: C.blue,
      description: 'Short version: be decent, keep it on-topic, fly right.\nKurzfassung: sei anständig, bleib beim Thema, flieg sauber.',
      fields: [
        { name: '1 · Respect the crew · Respektiere die Crew', value: 'No harassment, hate, slurs or personal attacks. Treat people the way you’d want on your own ship.\nKeine Belästigung, kein Hass, keine Beleidigungen oder persönlichen Angriffe. Behandle andere so, wie du es auf deinem eigenen Schiff wollen würdest.' },
        { name: '2 · Any language welcome · Jede Sprache willkommen', value: 'English and Deutsch are both at home here — pick your language role and the bot answers you in it. Use whichever channel language you like; be readable.\nEnglisch und Deutsch sind beide zu Hause — wähl deine Sprachrolle und der Bot antwortet dir darin. Schreib in der Sprache, die dir liegt; bleib verständlich.' },
        { name: '3 · Use the right channel · Nutze den richtigen Kanal', value: 'Keep tools talk in <#mining>, <#trading>, <#ships> and friends. It keeps threads findable.\nHalte Tool-Themen in <#mining>, <#trading>, <#ships> & Co. So bleiben Threads auffindbar.' },
        { name: '4 · No spam or ads · Kein Spam, keine Werbung', value: 'No unsolicited DMs, invites, referral links or self-promo outside <#org-recruitment>.\nKeine ungefragten DMs, Invites, Referral-Links oder Eigenwerbung außerhalb von <#org-recruitment>.' },
        { name: '5 · Keep it SFW & legal · Halte es SFW & legal', value: 'No NSFW, no piracy, no cheats/exploits, no account or credit trading. Follow Discord’s ToS and CIG’s rules.\nKein NSFW, keine Piraterie, keine Cheats/Exploits, kein Konto- oder Credit-Handel. Halte dich an Discords ToS und CIGs Regeln.' },
        { name: '6 · No drama-farming · Kein Drama-Farming', value: 'Disagree fine, dogpile no. Staff (🛰 Navigators, ⭐ Fleet Command) have the final call.\nUneinigkeit okay, Dogpiling nein. Das Team (🛰 Navigators, ⭐ Fleet Command) hat das letzte Wort.' },
        { name: '🚦 New arrivals · Neuankömmlinge', value: 'Not a rule, just a heads-up: you can chat straight away, but **links, images & attachments** unlock once you reach ⛏ Prospect (level 5) — a few good messages. It keeps spam bots out, not you.\nKeine Regel, nur ein Hinweis: du kannst sofort schreiben, aber **Links, Bilder & Anhänge** schalten ab ⛏ Prospect (Level 5) frei — ein paar gute Nachrichten. Das hält Spam-Bots draußen, nicht dich.' },
      ],
      footer: 'Breaking these can mean a mute, kick or ban · Verstöße können Mute, Kick oder Bann bedeuten',
    },
  ],
  'start-here': [
    {
      title: '🧭 Start Here — the VerseBase map · Der VerseBase-Wegweiser',
      color: C.cyan,
      description: 'Everything on the server, and the tool behind each channel.\nAlles auf dem Server, und das Tool hinter jedem Kanal.',
      fields: [
        { name: '🛠 Tools & Data', value: `Each channel pairs with a live tool on the site — and the bot’s **/ship /price /item /patch** work right here · Jeder Kanal ist mit einem Live-Tool verknüpft — und **/ship /price /item /patch** des Bots gehen direkt hier:\n⛏ <#mining> — [Minerals & calculators](${SITE}/topics/mining.html)\n💰 <#trading> — [Prices & locations](${SITE}/item-finder.html)\n🔧 <#crafting> — [Blueprints & planner](${SITE}/topics/crafting.html)\n🚀 <#ships> — [Data sheets & holo viewer](${SITE}/schiffe.html)\n🧭 <#exploration> — [Aaron Halo jump calc](${SITE}/precision-jump.html)\n📜 <#missions> — [Rewards & reputation](${SITE}/missionen.html)\n🐟 <#wikelo-ch> — [Wikelo’s Emporium](${SITE}/topics/wikelo-emporium.html)\n🛟 <#support> — stuck on a tool, the bot or the game? · hängst du fest? Frag hier` },
        { name: '💬 Chat & crew · Reden & Crew', value: 'Hang out in <#general>, say hi in <#introductions>, talk patches in <#patch-chat>, share shots in <#screenshots>, and drop ideas in <#suggestions>. Crew up in <#lfg>, <#trade-deals> & <#events-chat> — voice is one click down.\nPlausch in <#general>, sag Hallo in <#introductions>, sprich über Patches in <#patch-chat>, teile Aufnahmen in <#screenshots>, und wirf Ideen in <#suggestions>. Crew finden in <#lfg>, <#trade-deals> & <#events-chat> — Voice ist einen Klick weiter unten.' },
        { name: '🏅 Ranks & rewards · Ränge & Belohnungen', value: 'Chatting and hanging in voice earn XP — climb from 🌑 Drifter to 👑 Frontier Legend. Check your card with **/rank**, **/leaderboard** & **/ranks** in <#bot-commands> (it earns no XP, so spam away). 🎖 <#veterans-lounge> unlocks at ⬡ **Citizen (level 15)**.\nMit Chatten und Voice sammelst du XP — steig von 🌑 Drifter zu 👑 Frontier Legend auf. Deine Karte mit **/rank**, **/leaderboard** & **/ranks** in <#bot-commands> (bringt kein XP, also leg los). 🎖 <#veterans-lounge> schaltet ab ⬡ **Citizen (Level 15)** frei.' },
        { name: '🚦 New here? · Neu hier?', value: 'You can chat right away. Posting **links, images & file attachments** unlocks at ⛏ **Prospect (level 5)** — a handful of good messages and you’re there. It quietly keeps spam bots out.\nDu kannst sofort mitreden. **Links, Bilder & Datei-Anhänge** schalten ab ⛏ **Prospect (Level 5)** frei — ein paar gute Nachrichten und du bist da. Das hält Spam-Bots leise draußen.' },
        { name: '🎭 Your roles · Deine Rollen', value: 'Re-open **Channels & Roles** (top of the list) any time to add or drop interest, ping, language & pronoun roles.\nÖffne **Kanäle & Rollen** (oben in der Liste) jederzeit, um Interessen-, Ping-, Sprach- & Pronomen-Rollen zu ändern.' },
        { name: '🌐 The whole compendium · Das ganze Kompendium', value: `[verse-base.com](${SITE}) · [Patch archive / Patch-Archiv](${SITE}/archiv.html) · [Evolution timeline / Evolution](${SITE}/evolution.html) · [Downloads](${SITE}/downloads.html)` },
        { name: '🙏 Credits · Danksagung', value: `The Aaron Halo / Precision Jump calculator was contributed by **Jordessey** — with thanks. · Der Aaron-Halo-/Precision-Jump-Rechner stammt mit Dank von **Jordessey**. → [precision-jump](${SITE}/precision-jump.html)` },
      ],
      footer: 'VerseBase • verse-base.com',
    },
  ],
  'patch-notes': [
    {
      title: '🩹 Patch feed is live · Der Patch-Feed ist aktiv',
      color: C.gold,
      description: [
        'Every Star Citizen patch gets mirrored here from the archive, so you never miss a drop. New patches post in **both English and German**.',
        '',
        `Browse the full history — the entire Alpha 4 era — on the **[patch archive](${SITE}/archiv.html)**, or trace how each system evolved on the **[evolution timeline](${SITE}/evolution.html)**.`,
        '',
        'Want the ping when a patch lands? Grab **🔔 Patch Pings** in onboarding.',
        DIV,
        'Jeder Star-Citizen-Patch wird hier aus dem Archiv gespiegelt, damit du keinen verpasst. Neue Patches erscheinen **auf Englisch und Deutsch**.',
        '',
        `Durchstöbere die ganze Historie — die komplette Alpha-4-Ära — im **[Patch-Archiv](${SITE}/archiv.html)**, oder verfolge die Entwicklung jedes Systems in der **[Evolution](${SITE}/evolution.html)**.`,
        '',
        'Willst du den Ping, wenn ein Patch landet? Schnapp dir **🔔 Patch Pings** im Onboarding.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  'roles-info': [
    {
      title: '🎭 Pick your roles · Wähle deine Rollen',
      color: C.tradePurple,
      description: [
        'Roles colour your name, unlock interest channels and control which pings you get. Grab as many or as few as you like — nothing is required. Your **language** role also sets the language the bot replies to you in.',
        '',
        '**How:** open **Channels & Roles** at the very top of the channel list (or re-run onboarding) and toggle what fits.',
        '',
        '**⛏ Playstyle** — Miner · Trader · Industrialist · Combat Pilot · Explorer · Contractor · Wikelo Regular',
        '**🔔 Pings** — Patch drops · Announcements · Events',
        '**🌐 Language** — English · Deutsch',
        '**🙂 Pronouns** — they/them · she/her · he/him · ask me',
        DIV,
        'Rollen färben deinen Namen, schalten Interessen-Kanäle frei und steuern deine Pings. Nimm so viele oder wenige du willst — nichts ist Pflicht. Deine **Sprach**-Rolle legt außerdem fest, in welcher Sprache der Bot dir antwortet.',
        '',
        '**So geht’s:** Öffne **Kanäle & Rollen** ganz oben in der Kanalliste (oder starte das Onboarding neu) und schalte um, was passt.',
        '',
        '**⛏ Spielstil** — Miner · Trader · Industrialist · Combat Pilot · Explorer · Contractor · Wikelo Regular',
        '**🔔 Pings** — Patch-Releases · Ankündigungen · Events',
        '**🌐 Sprache** — English · Deutsch',
        '**🙂 Pronomen** — they/them · she/her · he/him · frag mich',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  'bot-commands': [
    {
      title: '🤖 Bot commands · Bot-Befehle',
      color: C.gold,
      description: [
        'The home for bot spam — **this channel earns no XP**, so run commands as much as you like. The Flight Computer answers in your language (set it in onboarding).',
        '',
        '**Rank & leveling** — best kept here:',
        '**/rank** your card · **/leaderboard** the server top · **/ranks** the full ladder · **/prestige** at max level',
        '',
        '**Flight Computer** — game data, also works in the tool channels:',
        '**/ship** ‹name› · **/price** ‹commodity› · **/item** ‹name› · **/patch** ‹version›',
        DIV,
        'Die Heimat für Bot-Spam — **dieser Kanal bringt kein XP**, also nutze Befehle so viel du willst. Der Flight Computer antwortet in deiner Sprache (im Onboarding einstellen).',
        '',
        '**Ränge & Level** — am besten hier:',
        '**/rank** deine Karte · **/leaderboard** die Server-Spitze · **/ranks** die ganze Leiter · **/prestige** beim Maximallevel',
        '',
        '**Flight Computer** — Spieldaten, gehen auch in den Tool-Kanälen:',
        '**/ship** ‹Name› · **/price** ‹Ware› · **/item** ‹Name› · **/patch** ‹Version›',
      ].join('\n'),
      footer: 'VerseBase • Flight Computer',
    },
  ],
  'veterans-lounge': [
    {
      title: '🎖 Veterans’ Lounge · Stammgäste-Lounge',
      color: C.gold,
      description: [
        'You made it — this room only opens at ⬡ **Citizen (level 15)** and up. The quieter table for the regulars who keep the ’verse turning.',
        '',
        'No special rules, just the house ones. Prestige keeps your seat: an ✦ Ascended badge stays welcome here even after a reset.',
        DIV,
        'Du hast es geschafft — dieser Raum öffnet erst ab ⬡ **Citizen (Level 15)** aufwärts. Der ruhigere Tisch für die Stammgäste, die das ’Verse am Laufen halten.',
        '',
        'Keine Sonderregeln, nur die des Hauses. Prestige behält deinen Platz: ein ✦ Ascended-Abzeichen bleibt auch nach einem Reset willkommen.',
      ].join('\n'),
      footer: 'VerseBase • earned, not given',
    },
  ],
  suggestions: [
    {
      title: '💡 Suggestions · Vorschläge',
      color: C.blue,
      description: [
        'Ideas for the **server** or for **verse-base.com** go here. One idea per post so others can react to vote — 👍 for yes, 👎 for no.',
        '',
        'Bugs or broken data on the site? Take those to <#support> instead. Big thanks — the site grew from feedback like yours.',
        DIV,
        'Ideen für den **Server** oder für **verse-base.com** kommen hier rein. Eine Idee pro Post, damit andere per Reaktion abstimmen können — 👍 für ja, 👎 für nein.',
        '',
        'Fehler oder kaputte Daten auf der Seite? Ab damit in <#support>. Großen Dank — die Seite ist aus Feedback wie deinem gewachsen.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  support: [
    {
      title: '🛟 Support · Hilfe',
      color: C.miningTeal,
      description: [
        'Stuck on a tool, the Discord bot, or something in-game? Ask here — say what you tried, and add a screenshot if you can.',
        '',
        '• **Site & tools** — mining, trading, ships, the item finder, the jump calc…',
        '• **The bot** — ranks, commands, roles not showing up',
        '• **The game** — the crew is happy to help',
        '',
        `Prefer the website? The [feedback form](${SITE}/feedback.html) reaches the same inbox.`,
        DIV,
        'Hängst du an einem Tool, dem Discord-Bot oder etwas im Spiel? Frag hier — schreib, was du versucht hast, und ein Screenshot hilft.',
        '',
        '• **Seite & Tools** — Mining, Handel, Schiffe, der Item-Finder, der Sprung-Rechner…',
        '• **Der Bot** — Ränge, Befehle, Rollen die nicht auftauchen',
        '• **Das Spiel** — die Crew hilft gern',
        '',
        `Lieber über die Website? Das [Feedback-Formular](${SITE}/feedback.html) landet im selben Postfach.`,
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  'patch-chat': [
    {
      title: '🩹 Patch chat · Patch-Talk',
      color: C.gold,
      description: [
        `Talk through the latest Star Citizen patch here — the read-only feed lives in <#patch-notes>, and the full history is on the [patch archive](${SITE}/archiv.html).`,
        '',
        'Want the ping when a patch drops? Grab 🔔 **Patch Pings** in <#roles-info>. Ask the bot for any version with **/patch** in <#bot-commands>.',
        DIV,
        `Sprich hier über den neuesten Star-Citizen-Patch — der reine Feed steht in <#patch-notes>, und die ganze Historie im [Patch-Archiv](${SITE}/archiv.html).`,
        '',
        'Willst du den Ping, wenn ein Patch landet? Schnapp dir 🔔 **Patch Pings** in <#roles-info>. Frag den Bot mit **/patch** in <#bot-commands> nach jeder Version.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
};
