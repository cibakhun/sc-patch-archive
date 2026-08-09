// ═════════════════════════════════════════════════════════════════════════
//  blueprint.mjs — the entire VerseBase Discord server, as data.
//
//  This file is the single source of truth. Edit it and re-run `npm run build`
//  to evolve the live server: the builder is idempotent, so it updates what
//  changed and creates what's missing without making duplicates.
//
//  ── SCOPE — read this before adding anything ───────────────────────────────
//  This server exists for ONE thing: verse-base.com itself — bug reports,
//  ideas, questions about the tools, and what's being built next.
//
//  It is deliberately NOT a general Star Citizen community server. SC news,
//  org recruiting, LFG, CCU trading and general game chat all have large,
//  established servers that do them far better than a side-channel here ever
//  could. Competing with them means being second-best at everything and first
//  at nothing; staying narrow means this server is the only place that does
//  what it does — direct line to the tools and the person building them.
//
//  So the test for every new channel, role or feature is: **does this serve
//  the site, or feedback about it?** If not, it belongs on someone else's
//  server, however nice the idea is. Point people there warmly and move on.
//  ───────────────────────────────────────────────────────────────────────────
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
//  tool's own accent used as an embed accent.
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
  name: 'Verse-Base',            // applied by the builder — keep it the live name
  // Shown on the invite splash and in Discovery (Community servers only).
  description: 'The workshop behind verse-base.com — report bugs, shape what gets built next · Die Werkstatt hinter verse-base.com — Fehler melden, mitbestimmen was als Nächstes kommt',
  systemChannel: 'general',      // where join / boost messages land
  // No AFK channel: one voice room doesn't need somewhere to be parked.
  // The builder treats null as "leave the guild's current setting alone".
  afkChannel: null,
  afkTimeout: 3600,              // seconds
  // A never-expiring invite the builder keeps alive for the website / signatures.
  inviteChannel: 'welcome',
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
//
// NOTE: #bug-reports deliberately lifts the gate per-channel (see its overwrites) —
// a bug report without a screenshot is half a bug report, and the first thing a
// new member wants to do here is show you what broke.
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
// Playstyle/interest roles (Miner, Trader, Combat Pilot, …) were removed with
// the channels they coloured: they gated nothing, and picking a playstyle is a
// thing you do on a community server, not on a feedback server.
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

  // Notification opt-ins. Deliberately NOT mentionable: these reach everyone who
  // opted in, so a single member shouldn't be able to broadcast to all of them.
  // Staff (MentionEveryone) and the bot's patch auto-post can still ping them.
  { key: 'patch-watch', name: '🔔 Patch Pings', color: C.pingCyan, hoist: false, mentionable: false, permissions: [] },
  { key: 'announce-ping', name: '📢 Announcement Pings', color: C.pingBlue, hoist: false, mentionable: false, permissions: [] },
  // 🧪 Testers get pinged when something needs trying before it ships. This is
  // the one interest role that survives, because it's about the site's work.
  { key: 'tester', name: '🧪 Test Pilots', color: C.craftOrange, hoist: false, mentionable: false, permissions: [] },

  // Language
  { key: 'lang-en', name: '🇬🇧 English', color: null, hoist: false, mentionable: false, permissions: [] },
  { key: 'lang-de', name: '🇩🇪 Deutsch', color: null, hoist: false, mentionable: false, permissions: [] },

  // Pronouns (optional)
  { key: 'pn-they', name: 'they/them', color: null, hoist: false, mentionable: false, permissions: [] },
  { key: 'pn-she', name: 'she/her', color: null, hoist: false, mentionable: false, permissions: [] },
  { key: 'pn-he', name: 'he/him', color: null, hoist: false, mentionable: false, permissions: [] },
  { key: 'pn-ask', name: 'ask me', color: null, hoist: false, mentionable: false, permissions: [] },
];

// Roles the builder assigns to real members, rather than just creating.
// The server owner rules by ownership anyway, but without the role the hoisted
// staff group, the private Flight Deck and the AutoMod exemptions have no members.
export const roleAssignments = {
  owner: ['fleet-command'],   // the guild owner
  bot: ['flight-computer'],   // the bot itself (display role, staff-category access)
};

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
      { key: 'welcome', name: '📜・welcome', type: 'announcement', readonly: true, topic: 'What this server is for, and what it deliberately isn’t · Wofür dieser Server da ist — und wofür bewusst nicht' },
      { key: 'rules', name: '📏・rules', type: 'text', readonly: true, topic: 'The house rules. Read once, fly right · Die Serverregeln. Einmal lesen, sauber fliegen' },
      { key: 'start-here', name: '🧭・start-here', type: 'text', readonly: true, topic: 'Server map, every verse-base.com tool, and how to pick your roles · Server-Karte, alle Tools und wie du deine Rollen wählst' },
    ],
  },
  {
    key: 'cat-releases', name: '📡 RELEASES',
    channels: [
      { key: 'announcements', name: '📣・announcements', type: 'announcement', readonly: true, topic: 'What shipped on verse-base.com · opt into 📢 Announcement Pings · Was auf verse-base.com live ging · 📢-Pings aktivieren' },
      // The patch feed stays: it isn't news-aggregation, it's the site's own
      // patch archive posting its output. It's a tool doing its job in public.
      { key: 'patch-notes', name: '🩹・patch-notes', type: 'announcement', readonly: true, topic: 'Every patch, mirrored from the archive · opt into 🔔 Patch Pings · Jeder Patch, aus dem Archiv gespiegelt · 🔔 Patch-Pings' },
    ],
  },
  {
    key: 'cat-build', name: '🔧 BUILD & FEEDBACK',
    channels: [
      {
        key: 'bug-reports', name: '🐞・bug-reports', type: 'forum',
        topic: 'Something wrong on the site? One thread per bug — say the page, what you did, what you expected · Etwas kaputt? Ein Thread pro Fehler — Seite, was du getan hast, was du erwartet hast',
        // A forum, not a text channel: each bug gets its own thread with a
        // status tag, so nothing scrolls away unanswered. Tags are matched by
        // name on re-runs, so already-tagged threads keep theirs.
        tags: ['Item Finder', 'Ships', 'Crafting', 'Mining', 'Patch archive', 'Account', 'Discord bot', 'Mobile', 'Data error', 'Fixed'],
        // The newcomer gate is lifted HERE only: a bug report needs a screenshot,
        // and the person most likely to file one is brand new.
        overwrites: {
          everyone: { allow: ['EmbedLinks', 'AttachFiles'] },
        },
      },
      { key: 'suggestions', name: '💡・suggestions', type: 'text', topic: 'Ideas for verse-base.com — one per post, react to vote · Ideen für verse-base.com — eine pro Post, mit Reaktion abstimmen', slowmode: 30 },
      { key: 'support', name: '🛟・support', type: 'text', topic: `Stuck on a tool or the bot? Ask here · Hängst du an einem Tool oder dem Bot? Frag hier → ${SITE}` },
      // One channel replaces the eight per-tool channels. With a server this
      // size, eight rooms meant eight quiet rooms; the per-tool split now lives
      // in the #bug-reports forum tags, where it actually earns its keep.
      { key: 'tools', name: '🧰・tools', type: 'text', topic: `Using the tools — item finder, ships, mining, crafting, jump calc · Die Tools nutzen → ${SITE}` },
      { key: 'bot-commands', name: '🤖・bot-commands', type: 'text', topic: 'Home for /rank, /ship, /price & friends — earns no XP, so spam freely · Zuhause für /rank, /ship, /price & Co. — bringt kein XP, also leg los', slowmode: 3, noXp: true },
    ],
  },
  {
    key: 'cat-hangar', name: '💬 HANGAR',
    channels: [
      { key: 'general', name: '💬・general', type: 'text', topic: 'Everything else — say hi, talk shop, share a find · Alles andere — Hallo sagen, fachsimpeln, Fundstücke teilen' },
      { key: 'v-landing', name: '🛬 Landing Zone', type: 'voice' },
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
      // Blocks other servers' invite links (poaching / raid bait). There is no
      // longer an #org-recruitment carve-out — org recruiting isn't what this
      // server is for, so the rule now applies everywhere without exception.
      regexPatterns: ['(?:discord(?:app)?\\.com/invite|discord\\.gg|discord\\.me|dsc\\.gg|discord\\.io)/\\S+'],
      exemptChannels: [],
      customMessage: 'Invite links aren’t allowed here. Looking for an SC community, org or LFG server? Ask in #general and someone will point you at a good one.',
    },
    { name: 'VerseBase • Hate speech', trigger: 'KeywordPreset', presets: ['Slurs'], block: true, alert: true },
  ],
};

// ── Welcome screen (the invite splash) ─────────────────────────────────────
// Discord caps description at 140 chars and each channel line at 50 — kept
// bilingual and compact.
export const welcomeScreen = {
  enabled: true,
  description: 'Bugs, ideas and questions about verse-base.com · Fehler, Ideen und Fragen zu verse-base.com',
  channels: [
    { channel: 'start-here', emoji: '🧭', description: 'Map & tools · Karte & Tools' },
    { channel: 'rules', emoji: '📏', description: 'House rules · Serverregeln' },
    { channel: 'bug-reports', emoji: '🐞', description: 'Report a bug · Fehler melden' },
    { channel: 'suggestions', emoji: '💡', description: 'Ideas · Ideen' },
    { channel: 'patch-notes', emoji: '🩹', description: 'Every patch · Alle Patches' },
  ],
};

// ── Onboarding (native role/interest selection) ────────────────────────────
// Prompt/option titles are bilingual (EN · DE). The playstyle prompt is gone
// with the playstyle roles; what's left is the three things that actually
// change what a member receives: pings, test invites, and language.
export const onboarding = {
  enabled: true,
  defaultChannels: [
    'welcome', 'rules', 'start-here', 'announcements', 'patch-notes',
    'bug-reports', 'suggestions', 'support', 'tools', 'general',
  ],
  prompts: [
    {
      title: 'Where should we ping you? · Wobei sollen wir dich pingen?',
      type: 'multi', required: false,
      options: [
        { title: 'Site updates · Seiten-Updates', description: 'When something new ships · Wenn etwas Neues live geht', emoji: '📢', roles: ['announce-ping'], channels: ['announcements'] },
        { title: 'Patch drops · Patch-Releases', description: 'New Star Citizen patches · Neue Star-Citizen-Patches', emoji: '🔔', roles: ['patch-watch'], channels: ['patch-notes'] },
        { title: 'Test pilot · Testpilot', description: 'Try things before they ship · Neues testen, bevor es live geht', emoji: '🧪', roles: ['tester'], channels: ['tools'] },
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

// ── Seed content (posted + pinned once; re-runs update it in place) ────────
// Each entry is a list of embeds. Default colour is the brand cyan. Content is
// bilingual: an English block, a divider, then the German block.
const DIV = '\n─────────────\n';
export const seed = {
  welcome: [
    {
      title: '⬡ Welcome to VerseBase · Willkommen bei VerseBase',
      color: C.cyan,
      description: [
        `This is the workshop behind **[verse-base.com](${SITE})** — the unofficial Star Citizen compendium.`,
        '',
        '**What this server is for:** telling me what’s broken, what’s missing and what you’d use next — and seeing what’s being built before it ships.',
        '',
        '**What it isn’t:** a general Star Citizen server. For news, org recruiting, LFG or CCU trading there are big, well-run servers that do those properly — ask in <#general> and someone will point you at a good one. Keeping this place narrow is what lets it stay useful.',
        '',
        '**Get moving:**',
        '🧭 Read <#start-here> for the map + every tool',
        '📏 Skim the <#rules>',
        '🐞 Found something broken? <#bug-reports>',
        '💡 Got an idea? <#suggestions>',
        '🎭 Pick your roles in onboarding — including your **language**, which sets the language the bot answers you in',
        DIV,
        `Das ist die Werkstatt hinter **[verse-base.com](${SITE})** — dem inoffiziellen Star-Citizen-Kompendium.`,
        '',
        '**Wofür dieser Server da ist:** mir zu sagen, was kaputt ist, was fehlt und was du als Nächstes brauchen würdest — und zu sehen, was gerade entsteht, bevor es live geht.',
        '',
        '**Wofür nicht:** ein allgemeiner Star-Citizen-Server. Für News, Org-Anwerbung, LFG oder CCU-Handel gibt es große, gut geführte Server, die das richtig machen — frag in <#general>, jemand verweist dich gern. Genau diese Enge hält diesen Ort nützlich.',
        '',
        '**Leg los:**',
        '🧭 Lies <#start-here> für die Karte + alle Tools',
        '📏 Überflieg die <#rules>',
        '🐞 Etwas kaputt gefunden? <#bug-reports>',
        '💡 Eine Idee? <#suggestions>',
        '🎭 Wähl deine Rollen im Onboarding — inkl. deiner **Sprache**, die bestimmt, in welcher Sprache der Bot dir antwortet',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  rules: [
    {
      title: '📏 The House Rules · Die Serverregeln',
      color: C.blue,
      description: 'Short version: be decent, keep it about the site, fly right.\nKurzfassung: sei anständig, bleib bei der Seite, flieg sauber.',
      fields: [
        { name: '1 · Respect the crew · Respektiere die Crew', value: 'No harassment, hate, slurs or personal attacks. Treat people the way you’d want on your own ship.\nKeine Belästigung, kein Hass, keine Beleidigungen oder persönlichen Angriffe. Behandle andere so, wie du es auf deinem eigenen Schiff wollen würdest.' },
        { name: '2 · This server is about the site · Hier geht es um die Seite', value: 'Bugs, ideas, questions about the tools and what’s coming next. General SC chat, news, org recruiting, LFG and CCU trading have dedicated servers that do them better — ask in <#general> and we’ll point you at one.\nFehler, Ideen, Fragen zu den Tools und was als Nächstes kommt. Allgemeiner SC-Plausch, News, Org-Anwerbung, LFG und CCU-Handel haben eigene Server, die das besser können — frag in <#general>, wir verweisen dich gern.' },
        { name: '3 · Any language welcome · Jede Sprache willkommen', value: 'English and Deutsch are both at home here — pick your language role and the bot answers you in it. Use whichever you like; be readable.\nEnglisch und Deutsch sind beide zu Hause — wähl deine Sprachrolle und der Bot antwortet dir darin. Schreib, wie es dir liegt; bleib verständlich.' },
        { name: '4 · One bug, one thread · Ein Fehler, ein Thread', value: 'File bugs in <#bug-reports> as separate threads with the page and what you did. Ideas go to <#suggestions>, one per post. It’s the difference between something getting fixed and something getting lost.\nMelde Fehler in <#bug-reports> als einzelne Threads mit Seite und Vorgehen. Ideen nach <#suggestions>, eine pro Post. Das entscheidet, ob etwas behoben wird oder untergeht.' },
        { name: '5 · No spam or ads · Kein Spam, keine Werbung', value: 'No unsolicited DMs, server invites, referral links or self-promo. Invite links are blocked server-wide.\nKeine ungefragten DMs, Server-Invites, Referral-Links oder Eigenwerbung. Invite-Links sind serverweit gesperrt.' },
        { name: '6 · Keep it SFW & legal · Halte es SFW & legal', value: 'No NSFW, no piracy, no cheats/exploits, no account or credit trading. Follow Discord’s ToS and CIG’s rules.\nKein NSFW, keine Piraterie, keine Cheats/Exploits, kein Konto- oder Credit-Handel. Halte dich an Discords ToS und CIGs Regeln.' },
        { name: '🚦 New arrivals · Neuankömmlinge', value: 'You can chat straight away. **Links, images & attachments** unlock at ⛏ Prospect (level 5) — a few good messages. <#bug-reports> is exempt: screenshots work there from minute one.\nDu kannst sofort schreiben. **Links, Bilder & Anhänge** schalten ab ⛏ Prospect (Level 5) frei — ein paar gute Nachrichten. <#bug-reports> ist ausgenommen: Screenshots gehen dort ab der ersten Minute.' },
      ],
      footer: 'Breaking these can mean a mute, kick or ban · Verstöße können Mute, Kick oder Bann bedeuten',
    },
  ],
  'start-here': [
    {
      title: '🧭 Start Here — the VerseBase map · Der VerseBase-Wegweiser',
      color: C.cyan,
      description: 'A small server on purpose. Here’s every room and what it’s for.\nBewusst ein kleiner Server. Hier ist jeder Raum und wofür er da ist.',
      fields: [
        { name: '🔧 Build & feedback · Bauen & Feedback', value: '🐞 <#bug-reports> — something broken? one thread per bug · etwas kaputt? ein Thread pro Fehler\n💡 <#suggestions> — ideas, one per post, react to vote · Ideen, eine pro Post, per Reaktion abstimmen\n🛟 <#support> — stuck on a tool or the bot · hängst du an einem Tool oder dem Bot\n🧰 <#tools> — using the tools, and the data behind them · die Tools nutzen und die Daten dahinter\n🤖 <#bot-commands> — bot spam welcome, earns no XP · Bot-Spam erwünscht, bringt kein XP' },
        { name: '📡 Releases · Releases', value: '📣 <#announcements> — what shipped on the site · was auf der Seite live ging\n🩹 <#patch-notes> — every Star Citizen patch, mirrored from the archive · jeder Patch, aus dem Archiv gespiegelt' },
        { name: '🛠 The tools themselves · Die Tools selbst', value: `[Item finder](${SITE}/item-finder.html) · [Ships & holo viewer](${SITE}/schiffe.html) · [Mining](${SITE}/topics/mining.html) · [Crafting](${SITE}/topics/crafting.html) · [Missions](${SITE}/missionen.html) · [Wikelo’s Emporium](${SITE}/topics/wikelo-emporium.html) · [Jump calculator](${SITE}/precision-jump.html) · [Patch archive](${SITE}/archiv.html) · [Evolution](${SITE}/evolution.html)` },
        { name: '🏅 Ranks · Ränge', value: 'Chatting earns XP — climb from 🌑 Drifter upward. Check your card with **/rank**, **/leaderboard** & **/ranks** in <#bot-commands>. The Flight Computer also answers **/ship**, **/price**, **/item** and **/patch** in your language.\nMit Chatten sammelst du XP — steig von 🌑 Drifter auf. Deine Karte mit **/rank**, **/leaderboard** & **/ranks** in <#bot-commands>. Der Flight Computer beantwortet auch **/ship**, **/price**, **/item** und **/patch** in deiner Sprache.' },
        { name: '🎭 Your roles · Deine Rollen', value: 'Open **Channels & Roles** at the top of the channel list any time. Pings (site updates · patch drops · 🧪 test pilot), your **language** — which sets the bot’s reply language — and pronouns.\nÖffne **Kanäle & Rollen** oben in der Kanalliste. Pings (Seiten-Updates · Patch-Releases · 🧪 Testpilot), deine **Sprache** — sie bestimmt die Antwortsprache des Bots — und Pronomen.' },
        { name: '🌍 Looking for more Star Citizen? · Mehr Star Citizen?', value: 'This server stays narrow on purpose. For news, orgs, LFG or CCU trading there are excellent dedicated servers — ask in <#general> and someone will name a good one.\nDieser Server bleibt bewusst eng. Für News, Orgs, LFG oder CCU-Handel gibt es hervorragende eigene Server — frag in <#general>, jemand nennt dir einen guten.' },
        { name: '🙏 Credits · Danksagung', value: `The Aaron Halo / Precision Jump calculator was contributed by **Jordessey** — with thanks. · Der Aaron-Halo-/Precision-Jump-Rechner stammt mit Dank von **Jordessey**. → [precision-jump](${SITE}/precision-jump.html)` },
      ],
      footer: 'VerseBase • verse-base.com',
    },
  ],
  'bug-reports': [
    {
      title: '🐞 How to file a bug · So meldest du einen Fehler',
      color: C.combatRed,
      description: [
        'One thread per bug, and tag it so it stays findable. Screenshots work here even if you’re brand new — the level gate is lifted in this channel.',
        '',
        '**A good report has four lines:**',
        '**1. Where** — the page or command (a link is perfect)',
        '**2. What you did** — the clicks or the filter you set',
        '**3. What happened** — including the exact wrong number, if it’s data',
        '**4. What you expected** instead',
        '',
        'Browser and phone-vs-desktop help for layout issues. If it’s a wrong value in the game data, say what the game shows — that’s the half I can’t see from here.',
        '',
        'Threads get tagged **Fixed** when the fix is live, so you can tell what’s still open.',
        DIV,
        'Ein Thread pro Fehler, und vergib einen Tag, damit er auffindbar bleibt. Screenshots gehen hier auch als Neuling — die Level-Sperre ist in diesem Kanal aufgehoben.',
        '',
        '**Eine gute Meldung hat vier Zeilen:**',
        '**1. Wo** — die Seite oder der Befehl (ein Link ist ideal)',
        '**2. Was du getan hast** — die Klicks oder der gesetzte Filter',
        '**3. Was passiert ist** — inkl. der genauen falschen Zahl, wenn es um Daten geht',
        '**4. Was du stattdessen erwartet hast**',
        '',
        'Browser und Handy-vs-Desktop helfen bei Layout-Problemen. Geht es um einen falschen Wert in den Spieldaten, schreib dazu, was das Spiel anzeigt — das ist die Hälfte, die ich von hier aus nicht sehe.',
        '',
        'Threads bekommen den Tag **Fixed**, sobald die Korrektur live ist — so siehst du, was noch offen ist.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  suggestions: [
    {
      title: '💡 Suggestions · Vorschläge',
      color: C.blue,
      description: [
        'Ideas for **verse-base.com** go here. One idea per post so others can react to vote — 👍 for yes, 👎 for no.',
        '',
        'The most useful suggestions say what you were **trying to do** when you wanted it, not just the feature name. Half the tools on the site started as a sentence in a channel like this one.',
        '',
        'Something **broken** rather than missing? That’s <#bug-reports>.',
        DIV,
        'Ideen für **verse-base.com** kommen hier rein. Eine Idee pro Post, damit andere per Reaktion abstimmen können — 👍 für ja, 👎 für nein.',
        '',
        'Die nützlichsten Vorschläge sagen, **was du gerade vorhattest**, als du es gebraucht hast — nicht nur den Namen der Funktion. Die Hälfte der Tools auf der Seite begann als ein Satz in einem Kanal wie diesem.',
        '',
        'Etwas **kaputt** statt fehlend? Das gehört nach <#bug-reports>.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  support: [
    {
      title: '🛟 Support · Hilfe',
      color: C.miningTeal,
      description: [
        'Stuck on a tool or the Discord bot? Ask here — say what you tried, and add a screenshot if you can.',
        '',
        '• **Site & tools** — the item finder, mining, ships, crafting, the jump calc…',
        '• **Your account** — sign-in, profile, favourites, the planner',
        '• **The bot** — ranks, commands, roles not showing up',
        '',
        `Prefer the website? The [feedback form](${SITE}/feedback.html) reaches the same inbox.`,
        DIV,
        'Hängst du an einem Tool oder dem Discord-Bot? Frag hier — schreib, was du versucht hast, und ein Screenshot hilft.',
        '',
        '• **Seite & Tools** — der Item-Finder, Mining, Schiffe, Handwerk, der Sprung-Rechner…',
        '• **Dein Konto** — Anmeldung, Profil, Favoriten, der Planer',
        '• **Der Bot** — Ränge, Befehle, Rollen die nicht auftauchen',
        '',
        `Lieber über die Website? Das [Feedback-Formular](${SITE}/feedback.html) landet im selben Postfach.`,
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
  ],
  tools: [
    {
      title: '🧰 The tools · Die Tools',
      color: C.exploreBlue,
      description: [
        'One room for all of them — asking how something works, comparing numbers, or showing what you got out of it.',
        '',
        `⛏ [Mining](${SITE}/topics/mining.html) · 💰 [Item finder & prices](${SITE}/item-finder.html) · 🔧 [Crafting](${SITE}/topics/crafting.html) · 🚀 [Ships & 3D holo viewer](${SITE}/schiffe.html) · 🧭 [Jump calculator](${SITE}/precision-jump.html) · 📜 [Missions](${SITE}/missionen.html) · 🐟 [Wikelo’s Emporium](${SITE}/topics/wikelo-emporium.html)`,
        '',
        'The bot answers **/ship**, **/price**, **/item** and **/patch** right here, in your language.',
        '',
        'Grab **🧪 Test Pilots** in onboarding if you want the ping when something needs trying before it ships.',
        DIV,
        'Ein Raum für alle — fragen, wie etwas funktioniert, Zahlen vergleichen, oder zeigen, was dabei herauskam.',
        '',
        'Der Bot beantwortet **/ship**, **/price**, **/item** und **/patch** direkt hier, in deiner Sprache.',
        '',
        'Schnapp dir **🧪 Test Pilots** im Onboarding, wenn du den Ping willst, sobald etwas vor dem Release getestet werden soll.',
      ].join('\n'),
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
        '**Flight Computer** — also works in <#tools>:',
        '**/ship** ‹name› · **/price** ‹commodity› · **/item** ‹name› · **/patch** ‹version›',
        DIV,
        'Die Heimat für Bot-Spam — **dieser Kanal bringt kein XP**, also nutze Befehle so viel du willst. Der Flight Computer antwortet in deiner Sprache (im Onboarding einstellen).',
        '',
        '**Ränge & Level** — am besten hier:',
        '**/rank** deine Karte · **/leaderboard** die Server-Spitze · **/ranks** die ganze Leiter · **/prestige** beim Maximallevel',
        '',
        '**Flight Computer** — geht auch in <#tools>:',
        '**/ship** ‹Name› · **/price** ‹Ware› · **/item** ‹Name› · **/patch** ‹Version›',
      ].join('\n'),
      footer: 'VerseBase • Flight Computer',
    },
  ],
};
