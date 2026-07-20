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
export const everyonePermissions = [
  'ViewChannel', 'CreateInstantInvite',
  'SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads',
  'EmbedLinks', 'AttachFiles', 'AddReactions',
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
export const categories = [
  {
    key: 'cat-start', name: '⁘ START HERE',
    channels: [
      { key: 'welcome', name: '📜・welcome', type: 'announcement', readonly: true, topic: 'Welcome aboard. What VerseBase is, and how to get moving.' },
      { key: 'rules', name: '📏・rules', type: 'text', readonly: true, topic: 'The house rules. Read once, fly right.' },
      { key: 'start-here', name: '🧭・start-here', type: 'text', readonly: true, topic: 'Server map + every verse-base.com tool, linked.' },
      { key: 'announcements', name: '📣・announcements', type: 'announcement', readonly: true, topic: 'Server news. Opt into 📢 Announcement Pings in onboarding.' },
      { key: 'patch-notes', name: '🩹・patch-notes', type: 'announcement', readonly: true, topic: 'Star Citizen patch drops, mirrored from the archive. Opt into 🔔 Patch Pings.' },
      { key: 'roles-info', name: '🎭・pick-your-roles', type: 'text', readonly: true, topic: 'How to grab interest, ping, language & pronoun roles any time.' },
    ],
  },
  {
    key: 'cat-verse', name: '🌌 THE VERSE',
    channels: [
      { key: 'general', name: '💬・general', type: 'text', topic: 'Main hangar. All-purpose chat.' },
      { key: 'introductions', name: '👋・introductions', type: 'text', topic: 'New here? Say hi — handle, playstyle, home system.' },
      { key: 'screenshots', name: '📸・screenshots', type: 'text', topic: 'Your best shots of the ’verse. Images & clips welcome.' },
      { key: 'clips', name: '🎬・clips', type: 'text', topic: 'Highlight reels, montages, that one impossible save.' },
      { key: 'memes', name: '😂・memes', type: 'text', topic: '30k survivors welcome. Keep it light.' },
      { key: 'off-topic', name: '🪐・off-topic', type: 'text', topic: 'Everything that isn’t Star Citizen.' },
      { key: 'bot-commands', name: '🤖・bot-commands', type: 'text', topic: 'Slash-command spam lives here.', slowmode: 3 },
    ],
  },
  {
    key: 'cat-tools', name: '🛠 TOOLS & DATA',
    channels: [
      { key: 'mining', name: '⛏・mining', type: 'text', topic: `Minerals, refining, calculators → ${SITE}/topics/mining.html` },
      { key: 'trading', name: '💰・trading', type: 'text', topic: `Commodity routes & live prices → ${SITE}/item-finder.html` },
      { key: 'crafting', name: '🔧・crafting-salvage', type: 'text', topic: `Blueprints, planner & dismantling → ${SITE}/topics/crafting.html` },
      { key: 'ships', name: '🚀・ships', type: 'text', topic: `Data sheets, specs & the 3D holo viewer → ${SITE}/schiffe.html` },
      { key: 'missions', name: '📜・missions', type: 'text', topic: `Rewards & reputation → ${SITE}/missionen.html` },
      { key: 'wikelo-ch', name: '🐟・wikelo-emporium', type: 'text', topic: `Banu trades & the Emporium → ${SITE}/topics/wikelo-emporium.html` },
      { key: 'guides', name: '📚・guides', type: 'forum', topic: 'Community guides & resources. Post one per thread.' },
    ],
  },
  {
    key: 'cat-crew', name: '🤝 CREW UP',
    channels: [
      { key: 'lfg', name: '🔎・looking-for-group', type: 'text', topic: 'Find a crew or fill a seat. Ping the playstyle roles.' },
      { key: 'trade-deals', name: '💱・trade-deals', type: 'text', topic: 'Buy / sell / haul. Post the route and the split.' },
      { key: 'org-recruitment', name: '🛡・org-recruitment', type: 'text', topic: 'Recruiting for your org? Pitch it here. One post, no spam.', slowmode: 30 },
      { key: 'events-chat', name: '📅・events', type: 'text', topic: 'Community events & fleet ops. Check the Events tab up top.' },
    ],
  },
  {
    key: 'cat-voice', name: '🔊 VOICE CHANNELS',
    channels: [
      { key: 'v-landing', name: '🛬 Landing Zone', type: 'voice', topic: 'General voice.' },
      { key: 'v-mining', name: '⛏ Mining Op', type: 'voice' },
      { key: 'v-trade', name: '💰 Trade Run', type: 'voice' },
      { key: 'v-combat', name: '🚀 Combat Wing', type: 'voice' },
      { key: 'v-chill', name: '🎧 Chill Lounge', type: 'voice' },
      { key: 'stage-briefing', name: '📻 Briefing Room', type: 'stage', topic: 'Events, AMAs & fleet briefings.' },
      { key: 'v-afk', name: '💤 AFK', type: 'voice' },
    ],
  },
  {
    key: 'cat-staff', name: '🛡 FLIGHT DECK', private: true, overwrites: STAFF_VIEW,
    channels: [
      { key: 'staff-chat', name: '🗝・staff-chat', type: 'text', topic: 'Crew coordination.' },
      { key: 'mod-log', name: '🧾・mod-log', type: 'text', topic: 'Moderation trail.' },
      { key: 'bot-config', name: '⚙・bot-config', type: 'text', topic: 'Bot commands & configuration.' },
      { key: 'staff-updates', name: '📥・community-updates', type: 'text', topic: 'Discord’s admin & Community notices land here.' },
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

// ── Welcome screen (the invite splash) ─────────────────────────────────────
export const welcomeScreen = {
  enabled: true,
  description: 'The Star Citizen compendium, now with a crew. Tools, patch intel & people who fly.',
  channels: [
    { channel: 'start-here', emoji: '🧭', description: 'Server map + every tool' },
    { channel: 'rules', emoji: '📏', description: 'The house rules' },
    { channel: 'patch-notes', emoji: '🩹', description: 'Every patch, mirrored' },
    { channel: 'mining', emoji: '⛏', description: 'Minerals & calculators' },
    { channel: 'general', emoji: '💬', description: 'Say hi' },
  ],
};

// ── Onboarding (native role/interest selection — no 24/7 bot needed) ────────
export const onboarding = {
  enabled: true,
  defaultChannels: [
    'welcome', 'rules', 'start-here', 'announcements', 'patch-notes', 'roles-info',
    'general', 'introductions', 'screenshots', 'mining', 'trading', 'ships',
    'missions', 'lfg', 'guides',
  ],
  prompts: [
    {
      title: 'What do you fly for?',
      type: 'multi', required: false,
      options: [
        { title: 'Mining', description: 'Rocks, gems & refining', emoji: '⛏', roles: ['miner'], channels: ['mining'] },
        { title: 'Trading', description: 'Routes, cargo & margins', emoji: '💰', roles: ['trader'], channels: ['trading'] },
        { title: 'Crafting & Salvage', description: 'Blueprints & scrap', emoji: '🔧', roles: ['industrialist'], channels: ['crafting'] },
        { title: 'Combat', description: 'PvP, bounties & fleet ops', emoji: '🚀', roles: ['combat-pilot'], channels: [] },
        { title: 'Exploration', description: 'Deep space & discovery', emoji: '🧭', roles: ['explorer'], channels: [] },
        { title: 'Missions', description: 'Contracts & reputation', emoji: '📜', roles: ['contractor'], channels: ['missions'] },
        { title: 'Banu Trades', description: 'Wikelo’s Emporium', emoji: '🐟', roles: ['wikelo'], channels: ['wikelo-ch'] },
      ],
    },
    {
      title: 'Where should we ping you?',
      type: 'multi', required: false,
      options: [
        { title: 'Patch drops', description: 'New Star Citizen patches', emoji: '🔔', roles: ['patch-watch'], channels: ['patch-notes'] },
        { title: 'Announcements', description: 'Server news', emoji: '📢', roles: ['announce-ping'], channels: ['announcements'] },
        { title: 'Events', description: 'Community events & ops', emoji: '🎉', roles: ['event-ping'], channels: ['events-chat'] },
      ],
    },
    {
      title: 'Pick your language',
      type: 'single', required: false,
      options: [
        { title: 'English', emoji: '🇬🇧', roles: ['lang-en'], channels: [] },
        { title: 'Deutsch', emoji: '🇩🇪', roles: ['lang-de'], channels: [] },
      ],
    },
    {
      title: 'Pronouns (optional)',
      type: 'multi', required: false,
      options: [
        { title: 'they/them', roles: ['pn-they'], channels: [] },
        { title: 'she/her', roles: ['pn-she'], channels: [] },
        { title: 'he/him', roles: ['pn-he'], channels: [] },
        { title: 'ask me', roles: ['pn-ask'], channels: [] },
      ],
    },
  ],
};

// ── Seed content (posted + pinned once; re-runs skip already-seeded channels)
// Each entry is a list of embeds. Default colour is the brand cyan.
export const seed = {
  welcome: [
    {
      title: '⬡ Welcome to VerseBase',
      color: C.cyan,
      description: [
        `This is the community hangar for **[verse-base.com](${SITE})** — the unofficial Star Citizen compendium.`,
        '',
        'Item prices & locations, mining tools, a crafting database, Wikelo trades, ship data sheets with a 3D holo viewer, and the full patch archive of the Alpha 4 era — all game-accurate, and now with people to fly alongside.',
        '',
        '**Get moving:**',
        '🧭 Read <#start-here> for the map + every tool',
        '📏 Skim the <#rules>',
        '🎭 Pick your roles in onboarding (or <#roles-info>)',
        '👋 Drop a line in <#introductions>',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  rules: [
    {
      title: '📏 The House Rules',
      color: C.blue,
      description: 'Short version: be decent, keep it on-topic, fly right.',
      fields: [
        { name: '1 · Respect the crew', value: 'No harassment, hate, slurs or personal attacks. Treat people the way you’d want on your own ship.' },
        { name: '2 · English first', value: 'This server runs in English so everyone can follow along. Deutsch is welcome in DMs and among 🇩🇪 members.' },
        { name: '3 · Use the right channel', value: 'Keep tools talk in <#mining>, <#trading>, <#ships> and friends. It keeps threads findable.' },
        { name: '4 · No spam or ads', value: 'No unsolicited DMs, invites, referral links or self-promo outside <#org-recruitment>.' },
        { name: '5 · Keep it SFW & legal', value: 'No NSFW, no piracy, no cheats/exploits, no account or credit trading. Follow Discord’s ToS and CIG’s rules.' },
        { name: '6 · No drama-farming', value: 'Disagree fine, dogpile no. Staff (🛰 Navigators, ⭐ Fleet Command) have the final call.' },
      ],
      footer: 'Breaking these can mean a mute, kick or ban. Ping a Navigator if you need help.',
    },
  ],
  'start-here': [
    {
      title: '🧭 Start Here — the VerseBase map',
      color: C.cyan,
      description: 'Everything on the server, and the tool behind each channel.',
      fields: [
        { name: '🛠 Tools & Data', value: `Each channel pairs with a live tool on the site:\n⛏ <#mining> — [Minerals & calculators](${SITE}/topics/mining.html)\n💰 <#trading> — [Prices & locations](${SITE}/item-finder.html)\n🔧 <#crafting> — [Blueprints & planner](${SITE}/topics/crafting.html)\n🚀 <#ships> — [Data sheets & holo viewer](${SITE}/schiffe.html)\n📜 <#missions> — [Rewards & reputation](${SITE}/missionen.html)\n🐟 <#wikelo-ch> — [Wikelo’s Emporium](${SITE}/topics/wikelo-emporium.html)` },
        { name: '🤝 Crew up', value: 'Find a group in <#lfg>, deals in <#trade-deals>, and events in <#events-chat>. Voice is one click down the list.' },
        { name: '🎭 Your roles', value: 'Re-open **Onboarding** (top of the channel list → "Channels & Roles") any time to add or drop interest, ping, language and pronoun roles.' },
        { name: '🌐 The whole compendium', value: `[verse-base.com](${SITE}) · [Patch archive](${SITE}/archiv.html) · [Evolution timeline](${SITE}/evolution.html) · [Downloads](${SITE}/downloads.html)` },
      ],
      footer: 'VerseBase • verse-base.com',
    },
  ],
  'patch-notes': [
    {
      title: '🩹 Patch feed is live',
      color: C.gold,
      description: [
        'Every Star Citizen patch gets mirrored here from the archive, so you never miss a drop.',
        '',
        `Browse the full history — the entire Alpha 4 era — on the **[patch archive](${SITE}/archiv.html)**, or trace how each system evolved patch-by-patch on the **[evolution timeline](${SITE}/evolution.html)**.`,
        '',
        'Want the ping when a patch lands? Grab **🔔 Patch Pings** in onboarding.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  'roles-info': [
    {
      title: '🎭 Pick your roles',
      color: C.tradePurple,
      description: [
        'Roles colour your name, unlock interest channels and control which pings you get. Grab as many or as few as you like — nothing is required.',
        '',
        '**How:** open **Channels & Roles** at the very top of the channel list (or re-run onboarding) and toggle what fits.',
        '',
        '**⛏ Playstyle** — Miner · Trader · Industrialist · Combat Pilot · Explorer · Contractor · Wikelo Regular',
        '**🔔 Pings** — Patch drops · Announcements · Events',
        '**🌐 Language** — English · Deutsch',
        '**🙂 Pronouns** — they/them · she/her · he/him · ask me',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
};
