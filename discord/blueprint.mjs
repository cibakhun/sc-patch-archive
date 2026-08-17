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
//
// ── ON EMOJI ───────────────────────────────────────────────────────────────
// Names carry no emoji. Discord already draws a glyph for every channel type
// (#, speaker, forum, lock) and paints every role in its own colour — an emoji
// on top of that repeats what the interface just said. When every line is
// decorated, decoration stops being a signal and becomes texture.
//
// Two exceptions, both functional: the language roles keep their flags (a
// language picker is scanned, not read) and the #bug-reports forum tags keep
// theirs (a filter row is scanned too). Everything else earns attention through
// position, colour and wording.
// ───────────────────────────────────────────────────────────────────────────
export const roles = [
  {
    key: 'fleet-command', name: 'Fleet Command', color: C.cyan,
    hoist: true, mentionable: false, permissions: ['Administrator'],
    reason: 'Server administrators',
  },
  {
    key: 'navigators', name: 'Navigators', color: C.blue,
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
    key: 'flight-computer', name: 'Flight Computer', color: C.gold,
    hoist: true, mentionable: false, permissions: [],
    reason: 'Display role for bots / integrations',
  },

  // Notification opt-ins. Deliberately NOT mentionable: these reach everyone who
  // opted in, so a single member shouldn't be able to broadcast to all of them.
  // Staff (MentionEveryone) and the bot's patch auto-post can still ping them.
  { key: 'patch-watch', name: 'Patch Pings', color: C.pingCyan, hoist: false, mentionable: false, permissions: [] },
  { key: 'announce-ping', name: 'Announcement Pings', color: C.pingBlue, hoist: false, mentionable: false, permissions: [] },
  // 🧪 Testers get pinged when something needs trying before it ships. This is
  // the one interest role that survives, because it's about the site's work.
  { key: 'tester', name: 'Test Pilots', color: C.craftOrange, hoist: false, mentionable: false, permissions: [] },

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
    key: 'cat-start', name: 'START HERE',
    channels: [
      { key: 'welcome', name: 'welcome', type: 'announcement', readonly: true, topic: 'What this server is for, and what it deliberately isn’t · Wofür dieser Server da ist — und wofür bewusst nicht' },
      { key: 'rules', name: 'rules', type: 'text', readonly: true, topic: 'The house rules. Read once, fly right · Die Serverregeln. Einmal lesen, sauber fliegen' },
      { key: 'start-here', name: 'start-here', type: 'text', readonly: true, topic: 'Server map, every verse-base.com tool, and how to pick your roles · Server-Karte, alle Tools und wie du deine Rollen wählst' },
    ],
  },
  {
    key: 'cat-releases', name: 'RELEASES',
    channels: [
      { key: 'announcements', name: 'announcements', type: 'announcement', readonly: true, topic: 'What shipped on verse-base.com · Was auf verse-base.com live ging' },
      // The patch feed stays: it isn't news-aggregation, it's the site's own
      // patch archive posting its output. It's a tool doing its job in public.
      { key: 'patch-notes', name: 'patch-notes', type: 'announcement', readonly: true, topic: 'Every patch, mirrored from the archive · Jeder Patch, aus dem Archiv gespiegelt' },
    ],
  },
  {
    key: 'cat-build', name: 'BUILD & FEEDBACK',
    channels: [
      {
        key: 'bug-reports', name: 'bug-reports', type: 'forum',
        topic: 'Something wrong on the site? One thread per bug — the page, what you did, what you expected · Etwas kaputt? Ein Thread pro Fehler — Seite, Vorgehen, Erwartung',
        // A forum, not a text channel: each bug gets its own thread with a
        // status tag, so nothing scrolls away unanswered. Tags are matched by
        // name on re-runs, so already-tagged threads keep theirs.
        //
        // Tags DO carry emoji — a filter row is scanned, not read, and a shape
        // is faster to find than a word. This is the exception that proves the
        // rule at the top of this file.
        tags: [
          { name: 'Item Finder', emoji: '🔎' }, { name: 'Ships', emoji: '🚀' },
          { name: 'Crafting', emoji: '🔧' }, { name: 'Mining', emoji: '⛏' },
          { name: 'Patch archive', emoji: '🩹' }, { name: 'Account', emoji: '👤' },
          { name: 'Discord bot', emoji: '🤖' }, { name: 'Mobile', emoji: '📱' },
          { name: 'Data error', emoji: '📊' }, { name: 'Fixed', emoji: '✅' },
        ],
        layout: 'gallery',   // screenshots on the card beat a wall of titles
        sort: 'activity',
        // The newcomer gate is lifted HERE only: a bug report needs a screenshot,
        // and the person most likely to file one is brand new.
        overwrites: {
          everyone: { allow: ['EmbedLinks', 'AttachFiles'] },
        },
      },
      // 17.08.2026: #suggestions und #support zu EINEM #feedback verschmolzen.
      // Dieselbe Begruendung wie bei den acht Werkzeug-Kanaelen darunter: zwei
      // Tueren fuer dieselbe Sache ergeben bei dieser Servergroesse zwei halb
      // leere Raeume. Eine Idee und ein „ich haenge fest" landen ohnehin beim
      // selben Menschen.
      //
      // ⚠ Der Umzug laeuft ueber renames{} weiter unten: #suggestions wird
      //   UMBENANNT und behaelt damit seinen Verlauf. Ohne diesen Eintrag baute
      //   der Builder ein leeres #feedback daneben und liesse das Original
      //   verwaist zurueck.
      // ⚠ #support steht danach noch live, aber NICHT mehr im Blueprint. Das
      //   ist Absicht: build.mjs loescht keine Kanaele, und Loeschen naehme die
      //   Beitraege mit. Stilllegen (sperren + Wegweiser) ist Handarbeit,
      //   nachzulesen im Abschluss dieser Aenderung.
      { key: 'feedback', name: 'feedback', type: 'text', topic: 'Ideas, questions, anything about verse-base.com — one topic per post · Ideen, Fragen, alles zu verse-base.com — ein Thema pro Post', slowmode: 30 },
      // One channel replaces the eight per-tool channels. With a server this
      // size, eight rooms meant eight quiet rooms; the per-tool split now lives
      // in the #bug-reports forum tags, where it actually earns its keep.
      { key: 'tools', name: 'tools', type: 'text', topic: 'Using the tools — item finder, ships, mining, crafting, jump calc · Die Tools nutzen' },
      { key: 'bot-commands', name: 'bot-commands', type: 'text', topic: 'Home for /rank, /ship, /price & friends — earns no XP, so spam freely · Zuhause für /rank, /ship, /price & Co. — bringt kein XP, also leg los', slowmode: 3, noXp: true },
    ],
  },
  {
    key: 'cat-hangar', name: 'HANGAR',
    channels: [
      { key: 'general', name: 'general', type: 'text', topic: 'Everything else — say hi, talk shop, share a find · Alles andere — Hallo sagen, fachsimpeln, Fundstücke teilen' },
      { key: 'v-landing', name: 'Landing Zone', type: 'voice' },
    ],
  },
  {
    key: 'cat-staff', name: 'FLIGHT DECK', private: true, overwrites: STAFF_VIEW,
    channels: [
      { key: 'staff-chat', name: 'staff-chat', type: 'text', topic: 'Crew coordination · Crew-Koordination' },
      { key: 'mod-log', name: 'mod-log', type: 'text', topic: 'Moderation trail · Moderations-Protokoll' },
      { key: 'bot-config', name: 'bot-config', type: 'text', topic: 'Bot commands & configuration · Bot-Befehle & Konfiguration' },
      { key: 'staff-updates', name: 'community-updates', type: 'text', topic: 'Discord’s admin & Community notices land here · Discord-Admin- & Community-Hinweise landen hier' },
    ],
  },
];

// ── Renames (old live name → new blueprint name) ───────────────────────────
// EVERYTHING in the builder matches live objects BY NAME, so a rename here is
// not cosmetic: without this table the builder would fail to recognise the old
// channel, create an empty new one beside it and orphan the original with all
// its history. The rename step runs first and is idempotent — once applied, the
// old names no longer exist and every later run skips straight past.
// Safe to delete this block once the live server has been rebuilt.
export const renames = {
  categories: {
    '⁘ START HERE': 'START HERE',
    '📡 RELEASES': 'RELEASES',
    '🔧 BUILD & FEEDBACK': 'BUILD & FEEDBACK',
    '💬 HANGAR': 'HANGAR',
    '🛡 FLIGHT DECK': 'FLIGHT DECK',
  },
  channels: {
    '📜・welcome': 'welcome',
    '📏・rules': 'rules',
    '🧭・start-here': 'start-here',
    '📣・announcements': 'announcements',
    '🩹・patch-notes': 'patch-notes',
    '🐞・bug-reports': 'bug-reports',
    '💡・suggestions': 'suggestions',
    // Kette, und die REIHENFOLGE traegt sie: doRename() laeuft die Eintraege
    // in Einfuegereihenfolge ab. Steht der Kanal live noch als „💡・suggestions",
    // macht der Eintrag darueber daraus „suggestions", und erst dieser hier
    // „feedback". Idempotent: existiert #feedback schon, ueberspringt doRename()
    // beide Schritte, statt einen zweiten Kanal anzulegen.
    'suggestions': 'feedback',
    // ⚠ #support wird NICHT umbenannt — es geht in #feedback auf, aber sein
    //   Verlauf soll nicht unter fremdem Namen weiterlaufen. Der Eintrag hier
    //   putzt nur den alten Emoji-Namen, damit der stillgelegte Kanal sauber
    //   dasteht, bis der Betreiber ueber ihn entscheidet.
    '🛟・support': 'support',
    '🧰・tools': 'tools',
    '🤖・bot-commands': 'bot-commands',
    '💬・general': 'general',
    '🛬 Landing Zone': 'Landing Zone',
    '🗝・staff-chat': 'staff-chat',
    '🧾・mod-log': 'mod-log',
    '⚙・bot-config': 'bot-config',
    '📥・community-updates': 'community-updates',
  },
  roles: {
    '⭐ Fleet Command': 'Fleet Command',
    '🛰 Navigators': 'Navigators',
    '🤖 Flight Computer': 'Flight Computer',
    '🔔 Patch Pings': 'Patch Pings',
    '📢 Announcement Pings': 'Announcement Pings',
    '🧪 Test Pilots': 'Test Pilots',
  },
};

// ── Link buttons ───────────────────────────────────────────────────────────
// Attached to seed posts as real Discord components. Link buttons need no
// interaction handler and no listener, so they keep working while the always-on
// bot is down. Five per row; the builder chunks a flat list.
const TOOL_BUTTONS = [
  { label: 'Item Finder', url: `${SITE}/item-finder.html` },
  { label: 'Schiffe · Ships', url: `${SITE}/schiffe.html` },
  { label: 'Mining', url: `${SITE}/topics/mining.html` },
  { label: 'Crafting', url: `${SITE}/topics/crafting.html` },
  { label: 'Jump Calc', url: `${SITE}/precision-jump.html` },
];
const REFERENCE_BUTTONS = [
  { label: 'Patch-Archiv', url: `${SITE}/archiv.html` },
  { label: 'Evolution', url: `${SITE}/evolution.html` },
  { label: 'Missionen', url: `${SITE}/missionen.html` },
  { label: 'Wikelo', url: `${SITE}/topics/wikelo-emporium.html` },
  { label: 'Downloads', url: `${SITE}/downloads.html` },
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
    { channel: 'feedback', emoji: '💡', description: 'Ideas & questions · Ideen & Fragen' },
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
    'bug-reports', 'feedback', 'tools', 'general',
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
//
// ── ON COLOUR ──────────────────────────────────────────────────────────────
// One accent, not a palette. Every card the site posts is cyan; gold belongs to
// the patch stream alone, so the one channel that carries outside news reads
// differently at a glance. The earlier version gave each channel its own colour
// — nine cards, six colours, no meaning. Restraint is what makes an accent an
// accent.
//
// ── ON IMAGERY ─────────────────────────────────────────────────────────────
// Embeds are the only surface in Discord where you control pixels, and the same
// discipline applies: #welcome carries the full hero because it is the front
// door, #start-here carries only the mark. Everywhere else the words do the
// work. An image in every card is the emoji mistake in a bigger format.
// ───────────────────────────────────────────────────────────────────────────
const DIV = '\n─────────────\n';
export const seed = {
  welcome: {
    buttons: [
      { label: 'verse-base.com', url: SITE },
      { label: 'Patch-Archiv', url: `${SITE}/archiv.html` },
      { label: 'Feedback', url: `${SITE}/feedback.html` },
    ],
    embeds: [
    {
      title: '⬡ Welcome to VerseBase · Willkommen bei VerseBase',
      color: C.cyan,
      // The site's own social card: wide, cinematic, and the engine glow lands
      // on the brand cyan. `guild-icon` resolves to the server icon on
      // Discord's CDN — the mark needs no second home.
      image: `${SITE}/assets/og-default.jpg`,
      thumbnail: 'guild-icon',
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
        '💡 Got an idea or a question? <#feedback>',
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
        '💡 Eine Idee oder eine Frage? <#feedback>',
        '🎭 Wähl deine Rollen im Onboarding — inkl. deiner **Sprache**, die bestimmt, in welcher Sprache der Bot dir antwortet',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
    ],
  },
  rules: [
    {
      title: 'The House Rules · Die Serverregeln',
      color: C.cyan,
      description: 'Short version: be decent, keep it about the site, fly right.\nKurzfassung: sei anständig, bleib bei der Seite, flieg sauber.',
      fields: [
        { name: '1 · Respect the crew · Respektiere die Crew', value: 'No harassment, hate, slurs or personal attacks. Treat people the way you’d want on your own ship.\nKeine Belästigung, kein Hass, keine Beleidigungen oder persönlichen Angriffe. Behandle andere so, wie du es auf deinem eigenen Schiff wollen würdest.' },
        { name: '2 · This server is about the site · Hier geht es um die Seite', value: 'Bugs, ideas, questions about the tools and what’s coming next. General SC chat, news, org recruiting, LFG and CCU trading have dedicated servers that do them better — ask in <#general> and we’ll point you at one.\nFehler, Ideen, Fragen zu den Tools und was als Nächstes kommt. Allgemeiner SC-Plausch, News, Org-Anwerbung, LFG und CCU-Handel haben eigene Server, die das besser können — frag in <#general>, wir verweisen dich gern.' },
        { name: '3 · Any language welcome · Jede Sprache willkommen', value: 'English and Deutsch are both at home here — pick your language role and the bot answers you in it. Use whichever you like; be readable.\nEnglisch und Deutsch sind beide zu Hause — wähl deine Sprachrolle und der Bot antwortet dir darin. Schreib, wie es dir liegt; bleib verständlich.' },
        { name: '4 · One bug, one thread · Ein Fehler, ein Thread', value: 'File bugs in <#bug-reports> as separate threads with the page and what you did. Ideas and questions go to <#feedback>, one topic per post. It’s the difference between something getting fixed and something getting lost.\nMelde Fehler in <#bug-reports> als einzelne Threads mit Seite und Vorgehen. Ideen und Fragen nach <#feedback>, ein Thema pro Post. Das entscheidet, ob etwas behoben wird oder untergeht.' },
        { name: '5 · No spam or ads · Kein Spam, keine Werbung', value: 'No unsolicited DMs, server invites, referral links or self-promo. Invite links are blocked server-wide.\nKeine ungefragten DMs, Server-Invites, Referral-Links oder Eigenwerbung. Invite-Links sind serverweit gesperrt.' },
        { name: '6 · Keep it SFW & legal · Halte es SFW & legal', value: 'No NSFW, no piracy, no cheats/exploits, no account or credit trading. Follow Discord’s ToS and CIG’s rules.\nKein NSFW, keine Piraterie, keine Cheats/Exploits, kein Konto- oder Credit-Handel. Halte dich an Discords ToS und CIGs Regeln.' },
        { name: '🚦 New arrivals · Neuankömmlinge', value: 'You can chat straight away. **Links, images & attachments** unlock at ⛏ Prospect (level 5) — a few good messages. <#bug-reports> is exempt: screenshots work there from minute one.\nDu kannst sofort schreiben. **Links, Bilder & Anhänge** schalten ab ⛏ Prospect (Level 5) frei — ein paar gute Nachrichten. <#bug-reports> ist ausgenommen: Screenshots gehen dort ab der ersten Minute.' },
      ],
      footer: 'Breaking these can mean a mute, kick or ban · Verstöße können Mute, Kick oder Bann bedeuten',
    },
  ],
  'start-here': {
    // The nine tool links used to be one dense markdown field. As two rows of
    // real buttons they stop being a paragraph and become an interface.
    buttons: [...TOOL_BUTTONS, ...REFERENCE_BUTTONS],
    embeds: [
    {
      title: 'Start here — the VerseBase map · Der VerseBase-Wegweiser',
      color: C.cyan,
      thumbnail: 'guild-icon',
      description: 'A small server on purpose. Here’s every room and what it’s for.\nBewusst ein kleiner Server. Hier ist jeder Raum und wofür er da ist.',
      fields: [
        // Channel mentions already render with Discord's own channel glyph —
        // prefixing them with an emoji says the same thing twice.
        { name: 'Build & feedback · Bauen & Feedback', value: '<#bug-reports> — something broken? one thread per bug · etwas kaputt? ein Thread pro Fehler\n<#feedback> — ideas, questions, stuck on something — one topic per post · Ideen, Fragen, festgefahren — ein Thema pro Post\n<#tools> — using the tools, and the data behind them · die Tools nutzen und die Daten dahinter\n<#bot-commands> — bot spam welcome, earns no XP · Bot-Spam erwünscht, bringt kein XP' },
        { name: 'Releases', value: '<#announcements> — what shipped on the site · was auf der Seite live ging\n<#patch-notes> — every Star Citizen patch, mirrored from the archive · jeder Patch, aus dem Archiv gespiegelt' },
        { name: 'Ranks · Ränge', value: 'Chatting earns XP — climb from Drifter upward. Check your card with **/rank**, **/leaderboard** & **/ranks** in <#bot-commands>. The Flight Computer also answers **/ship**, **/price**, **/item** and **/patch** in your language.\nMit Chatten sammelst du XP — steig von Drifter auf. Deine Karte mit **/rank**, **/leaderboard** & **/ranks** in <#bot-commands>. Der Flight Computer beantwortet auch **/ship**, **/price**, **/item** und **/patch** in deiner Sprache.' },
        { name: 'Your roles · Deine Rollen', value: 'Open **Channels & Roles** at the top of the channel list any time. Pings (site updates · patch drops · test pilot), your **language** — which sets the bot’s reply language — and pronouns.\nÖffne **Kanäle & Rollen** oben in der Kanalliste. Pings (Seiten-Updates · Patch-Releases · Testpilot), deine **Sprache** — sie bestimmt die Antwortsprache des Bots — und Pronomen.' },
        { name: 'Looking for more Star Citizen? · Mehr Star Citizen?', value: 'This server stays narrow on purpose. For news, orgs, LFG or CCU trading there are excellent dedicated servers — ask in <#general> and someone will name a good one.\nDieser Server bleibt bewusst eng. Für News, Orgs, LFG oder CCU-Handel gibt es hervorragende eigene Server — frag in <#general>, jemand nennt dir einen guten.' },
        { name: 'Credits · Danksagung', value: 'The Aaron Halo / Precision Jump calculator was contributed by **Jordessey** — with thanks.\nDer Aaron-Halo-/Precision-Jump-Rechner stammt mit Dank von **Jordessey**.' },
      ],
      footer: 'VerseBase • verse-base.com',
    },
    ],
  },
  'bug-reports': [
    {
      title: 'How to file a bug · So meldest du einen Fehler',
      color: C.cyan,
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
      title: 'Suggestions · Vorschläge',
      color: C.cyan,
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
  support: {
    buttons: [{ label: 'Feedback-Formular', url: `${SITE}/feedback.html` }],
    embeds: [
    {
      title: 'Support · Hilfe',
      color: C.cyan,
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
        'Lieber über die Website? Das Formular unten landet im selben Postfach.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
    ],
  },
  tools: {
    buttons: TOOL_BUTTONS,
    embeds: [
    {
      title: 'The tools · Die Tools',
      color: C.cyan,
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
        'Schnapp dir **Test Pilots** im Onboarding, wenn du den Ping willst, sobald etwas vor dem Release getestet werden soll.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
    ],
  },
  'patch-notes': {
    buttons: [
      { label: 'Patch-Archiv', url: `${SITE}/archiv.html` },
      { label: 'Evolution', url: `${SITE}/evolution.html` },
    ],
    embeds: [
    {
      title: 'Patch feed is live · Der Patch-Feed ist aktiv',
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
        'Willst du den Ping, wenn ein Patch landet? Schnapp dir **Patch Pings** im Onboarding.',
      ].join('\n'),
      footer: 'VerseBase • verse-base.com',
    },
    ],
  },
  'bot-commands': [
    {
      title: 'Bot commands · Bot-Befehle',
      color: C.cyan,
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
