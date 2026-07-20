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
      { key: 'screenshots', name: '📸・screenshots', type: 'text', topic: 'Your best shots of the ’verse — images & clips welcome · Deine besten Aufnahmen aus dem ’Verse — Bilder & Clips willkommen' },
      { key: 'clips', name: '🎬・clips', type: 'text', topic: 'Highlight reels, montages, that one impossible save · Highlight-Clips, Montagen, die eine unmögliche Rettung' },
      { key: 'memes', name: '😂・memes', type: 'text', topic: '30k survivors welcome. Keep it light · 30k-Überlebende willkommen. Locker bleiben' },
      { key: 'off-topic', name: '🪐・off-topic', type: 'text', topic: 'Everything that isn’t Star Citizen · Alles, was nicht Star Citizen ist' },
      { key: 'bot-commands', name: '🤖・bot-commands', type: 'text', topic: 'Slash-command spam lives here · Slash-Command-Spam gehört hierher', slowmode: 3 },
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
    'welcome', 'rules', 'start-here', 'announcements', 'patch-notes', 'roles-info',
    'general', 'introductions', 'screenshots', 'mining', 'trading', 'ships',
    'combat', 'exploration', 'missions', 'lfg', 'guides',
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
        { name: '🛠 Tools & Data', value: `Each channel pairs with a live tool on the site · Jeder Kanal ist mit einem Live-Tool der Seite verknüpft:\n⛏ <#mining> — [Minerals & calculators](${SITE}/topics/mining.html)\n💰 <#trading> — [Prices & locations](${SITE}/item-finder.html)\n🔧 <#crafting> — [Blueprints & planner](${SITE}/topics/crafting.html)\n🚀 <#ships> — [Data sheets & holo viewer](${SITE}/schiffe.html)\n🧭 <#exploration> — [Aaron Halo jump calc](${SITE}/precision-jump.html)\n📜 <#missions> — [Rewards & reputation](${SITE}/missionen.html)\n🐟 <#wikelo-ch> — [Wikelo’s Emporium](${SITE}/topics/wikelo-emporium.html)` },
        { name: '🤝 Crew up · Zusammen fliegen', value: 'Find a group in <#lfg>, deals in <#trade-deals>, and events in <#events-chat>. Voice is one click down.\nGruppe in <#lfg>, Deals in <#trade-deals>, Events in <#events-chat>. Voice ist einen Klick weiter unten.' },
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
};
