// ═══════════════════════════════════════════════════════════════════════════
//  i18n.mjs — the bot's bilingual layer (EN / DE).
//
//  The VerseBase server offers a language choice as a role ("🇬🇧 English" /
//  "🇩🇪 Deutsch"). This module turns that choice into real behaviour: every
//  per-user reply is rendered in the caller's language.
//
//  resolveLocale(member, discordLocale) → 'en' | 'de'
//      role wins → Discord client locale → English default.
//  t(locale, key, vars) → a localized string, `{placeholder}`-interpolated.
//
//  Pure data + string lookup — no imports, no I/O — so selftest can verify key
//  parity offline. Keep EN and DE structurally identical: every key in both.
// ═══════════════════════════════════════════════════════════════════════════

export const LOCALES = ['en', 'de'];
export const DEFAULT_LOCALE = 'en';

/** Locale from a member's language role, or null if they have none. */
export function localeFromMember(member) {
  const cache = member?.roles?.cache;
  if (!cache) return null;
  for (const role of cache.values()) {
    const n = String(role.name || '').toLowerCase();
    if (n.includes('deutsch')) return 'de';
    if (n.includes('english')) return 'en';
  }
  return null;
}

/** Locale from a Discord client locale string ("de", "en-US", …), or null. */
export function localeFromDiscord(locale) {
  return typeof locale === 'string' && locale.toLowerCase().startsWith('de') ? 'de' : null;
}

/** The effective locale for a per-user interaction. Role first, then client. */
export function resolveLocale(member, discordLocale) {
  return localeFromMember(member) || localeFromDiscord(discordLocale) || DEFAULT_LOCALE;
}

function get(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Localized string for `key`, `{var}`-interpolated. Falls back to EN, then key. */
export function t(locale, key, vars) {
  const loc = LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  let s = get(STRINGS[loc], key);
  if (s == null) s = get(STRINGS[DEFAULT_LOCALE], key);
  if (s == null) return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
//  String catalog. EN and DE must stay structurally identical (selftest checks).
// ═══════════════════════════════════════════════════════════════════════════
export const STRINGS = {
  en: {
    common: {
      notFoundSuggest: 'No exact match for **{q}**. Did you mean: {list}?',
      notFoundNone: 'Nothing found for **{q}**.',
      notHere: 'That member isn’t in this server.',
      on: 'on', off: 'off', yes: 'yes', no: 'no', dash: '—',
    },
    ship: {
      author: 'Ship · {mfr}', unknown: 'Unknown',
      type: 'Type', size: 'Size', status: 'Status', crew: 'Crew',
      cargo: 'Cargo', length: 'Length', pledge: 'Pledge', focus: 'Focus',
      footer: 'VerseBase • game-accurate data sheet',
      open: 'Open on verse-base.com ↗',
    },
    price: {
      author: 'Commodity · UEX{mineral}', mineral: ' · mineral',
      bestSell: 'Best sell', buy: 'Buy', kind: 'Kind', sellLoc: 'Best sell location',
      perUnit: 'aUEC/unit', footer: 'VerseBase • prices from UEX',
      openFinder: 'Open in Item Finder ↗', wiki: 'Wiki ↗',
    },
    item: {
      author: 'Item · UEX', whereBuy: 'Where to buy',
      noLoc: 'No known sale locations.', footer: 'VerseBase • {n} location(s)',
      openFinder: 'Open in Item Finder ↗',
    },
    patch: {
      authorEra: 'Patch · {era} era', author: 'Patch',
      released: 'Released', type: 'Type', keyFacts: 'Key facts',
      highlights: 'Highlights', wipe: 'Wipe', footer: 'VerseBase • patch archive',
      archive: 'Patch archive ↗', official: 'Official notes ↗',
      newDrop: 'a new patch just dropped',
    },
    lb: {
      title: '{guild} — Leaderboard',
      empty: 'No one has earned XP yet. Start chatting!',
      footer: 'Page {page}/{pages} · {total} ranked members · VerseBase',
      prev: 'Prev', next: 'Next',
    },
    ladder: {
      title: '⬡ VerseBase Rank Ladder', you: 'you', youField: 'You',
      nextRank: 'Next rank', atLevel: 'at Level {level}',
      footer: 'Earn XP by chatting and hanging out in voice · VerseBase',
      youValue: '{ins} {name} · Level {level}',
    },
    prestige: {
      disabled: 'Prestige is disabled on this server.',
      tooLow: 'You can prestige at **Level {atLevel}** — you’re at **{level}**. Keep going!',
      maxed: 'You’ve reached the maximum prestige ({stars}). Legendary.',
      title: '✦ Prestige {stars}!',
      desc: '{user} ascended to **Prestige {stars}**.\nLevel reset to 1 — with a permanent **+{pct}% XP** bonus.',
    },
    card: {
      level: 'LEVEL', rankTier: 'Rank tier {tier}/{total}', posOf: '#{pos} of {total}',
      next: 'Next: {name} · Lv {level}', maxRank: 'MAX RANK',
      eLevel: 'Level', eXp: 'XP', eServerRank: 'Server rank', eRankTier: 'Rank tier',
      eLifetime: 'Lifetime XP', eNextRank: 'Next rank', tierOf: '{tier} of {total}', max: 'MAX',
    },
    levelup: {
      newRankTitle: '{ins}  New rank — {name}',
      newRankDesc: '{user} hit **Level {level}** and earned the **{name}** rank.\n_{blurb}_',
      title: '⬡  Level {level}',
      desc: '{user} leveled up to **Level {level}**.',
      prestige: 'Prestige', nextRank: 'Next rank', nextVal: '{ins} {name} · Lv {level}',
    },
    dm: {
      rankChanged: 'You reached **Level {level}** in **{guild}** and earned the **{ins} {name}** rank! 🎉',
      level: 'You reached **Level {level}** in **{guild}**.',
    },
    admin: {
      needPerm: 'You need the **Manage Server** permission.',
      unknown: 'Unknown subcommand.',
      xpGive: 'Gave **{amount} XP** to {user} — now Level {level} (was {before}).',
      xpSet: 'Set {user}’s XP to **{amount}** (Level {level}).',
      xpLevel: 'Set {user} to **Level {level}**.',
      xpReset: 'Reset {user} to zero.',
      annMode: 'Announcements: **{mode}**.',
      annChannel: 'Level-ups will post in {ch}.',
      annOnlyRanks: 'Only-on-rank-change: **{v}**.',
      annDm: 'Rank-up DMs: **{v}**.',
      multGlobal: 'Global multiplier: **×{v}**.',
      multBooster: 'Booster multiplier: **×{v}**.',
      multRoleClear: 'Cleared multiplier for {role}.',
      multRole: 'Multiplier for {role}: **×{v}**.',
      multChannel: 'Multiplier for {ch}: **×{v}**{disabled}.',
      xpDisabled: ' (XP disabled)',
      noxpAdd: 'Added {ch} to the no-XP list.',
      noxpRemove: 'Removed {ch} from the no-XP list.',
      textXp: 'Text XP: **{min}–{max}** per message, **{cd}s** cooldown.',
      voiceXp: 'Voice XP: **{v}/min**.',
      viewTitle: '⚙ Rank system configuration',
      vTextXp: 'Text XP', vVoiceXp: 'Voice XP', vMultipliers: 'Multipliers',
      vAnnounce: 'Announcements', vNoXp: 'No-XP channels', vPrestige: 'Prestige',
      vTextXpVal: '{min}–{max} / msg · {cd}s cooldown',
      vVoiceXpVal: '{perMin} / min · needs ≥2 in channel: {req}',
      vMultVal: 'global ×{global} · booster ×{booster} · {roles} role, {channels} channel',
      vAnnVal: 'mode: {mode} · channel: {channel} · only-ranks: {onlyRanks} · dm: {dm}',
      vPrestigeVal: 'at Level {atLevel} · +{pct}%/star · max {max}',
      modeChannel: 'fixed channel', modeCurrent: 'where they leveled', modeOff: 'off',
    },
    err: { generic: 'Something went wrong handling that.' },
  },

  de: {
    common: {
      notFoundSuggest: 'Keine exakte Übereinstimmung für **{q}**. Meintest du: {list}?',
      notFoundNone: 'Nichts gefunden für **{q}**.',
      notHere: 'Dieses Mitglied ist nicht auf diesem Server.',
      on: 'an', off: 'aus', yes: 'ja', no: 'nein', dash: '—',
    },
    ship: {
      author: 'Schiff · {mfr}', unknown: 'Unbekannt',
      type: 'Typ', size: 'Größe', status: 'Status', crew: 'Besatzung',
      cargo: 'Fracht', length: 'Länge', pledge: 'Pledge', focus: 'Fokus',
      footer: 'VerseBase • spielgenaues Datenblatt',
      open: 'Auf verse-base.com öffnen ↗',
    },
    price: {
      author: 'Ware · UEX{mineral}', mineral: ' · Mineral',
      bestSell: 'Bester Verkauf', buy: 'Kauf', kind: 'Art', sellLoc: 'Bester Verkaufsort',
      perUnit: 'aUEC/Einheit', footer: 'VerseBase • Preise von UEX',
      openFinder: 'Im Item-Finder öffnen ↗', wiki: 'Wiki ↗',
    },
    item: {
      author: 'Gegenstand · UEX', whereBuy: 'Wo kaufen',
      noLoc: 'Keine bekannten Verkaufsorte.', footer: 'VerseBase • {n} Ort(e)',
      openFinder: 'Im Item-Finder öffnen ↗',
    },
    patch: {
      authorEra: 'Patch · Ära {era}', author: 'Patch',
      released: 'Veröffentlicht', type: 'Typ', keyFacts: 'Eckdaten',
      highlights: 'Highlights', wipe: 'Wipe', footer: 'VerseBase • Patch-Archiv',
      archive: 'Patch-Archiv ↗', official: 'Offizielle Notes ↗',
      newDrop: 'ein neuer Patch ist da',
    },
    lb: {
      title: '{guild} — Bestenliste',
      empty: 'Noch niemand hat XP gesammelt. Fang an zu schreiben!',
      footer: 'Seite {page}/{pages} · {total} gewertete Mitglieder · VerseBase',
      prev: 'Zurück', next: 'Weiter',
    },
    ladder: {
      title: '⬡ VerseBase Rang-Leiter', you: 'du', youField: 'Du',
      nextRank: 'Nächster Rang', atLevel: 'ab Level {level}',
      footer: 'Sammle XP durch Chatten und Voice-Zeit · VerseBase',
      youValue: '{ins} {name} · Level {level}',
    },
    prestige: {
      disabled: 'Prestige ist auf diesem Server deaktiviert.',
      tooLow: 'Prestige gibt es ab **Level {atLevel}** — du bist bei **{level}**. Weiter so!',
      maxed: 'Du hast das maximale Prestige erreicht ({stars}). Legendär.',
      title: '✦ Prestige {stars}!',
      desc: '{user} ist zu **Prestige {stars}** aufgestiegen.\nLevel auf 1 zurückgesetzt — mit dauerhaftem **+{pct}% XP**-Bonus.',
    },
    card: {
      level: 'LEVEL', rankTier: 'Rang-Stufe {tier}/{total}', posOf: '#{pos} von {total}',
      next: 'Nächster: {name} · Lv {level}', maxRank: 'MAX-RANG',
      eLevel: 'Level', eXp: 'XP', eServerRank: 'Server-Rang', eRankTier: 'Rang-Stufe',
      eLifetime: 'Gesamt-XP', eNextRank: 'Nächster Rang', tierOf: '{tier} von {total}', max: 'MAX',
    },
    levelup: {
      newRankTitle: '{ins}  Neuer Rang — {name}',
      newRankDesc: '{user} hat **Level {level}** erreicht und den Rang **{name}** freigeschaltet.\n_{blurb}_',
      title: '⬡  Level {level}',
      desc: '{user} ist auf **Level {level}** aufgestiegen.',
      prestige: 'Prestige', nextRank: 'Nächster Rang', nextVal: '{ins} {name} · Lv {level}',
    },
    dm: {
      rankChanged: 'Du hast in **{guild}** **Level {level}** erreicht und den Rang **{ins} {name}** freigeschaltet! 🎉',
      level: 'Du hast in **{guild}** **Level {level}** erreicht.',
    },
    admin: {
      needPerm: 'Du brauchst die Berechtigung **Server verwalten**.',
      unknown: 'Unbekannter Unterbefehl.',
      xpGive: '{user} **{amount} XP** gegeben — jetzt Level {level} (vorher {before}).',
      xpSet: '{user}s XP auf **{amount}** gesetzt (Level {level}).',
      xpLevel: '{user} auf **Level {level}** gesetzt.',
      xpReset: '{user} auf null zurückgesetzt.',
      annMode: 'Ansagen: **{mode}**.',
      annChannel: 'Level-ups werden in {ch} gepostet.',
      annOnlyRanks: 'Nur bei Rang-Wechsel: **{v}**.',
      annDm: 'Rang-up-DMs: **{v}**.',
      multGlobal: 'Globaler Multiplikator: **×{v}**.',
      multBooster: 'Booster-Multiplikator: **×{v}**.',
      multRoleClear: 'Multiplikator für {role} entfernt.',
      multRole: 'Multiplikator für {role}: **×{v}**.',
      multChannel: 'Multiplikator für {ch}: **×{v}**{disabled}.',
      xpDisabled: ' (XP deaktiviert)',
      noxpAdd: '{ch} zur Kein-XP-Liste hinzugefügt.',
      noxpRemove: '{ch} von der Kein-XP-Liste entfernt.',
      textXp: 'Text-XP: **{min}–{max}** pro Nachricht, **{cd}s** Cooldown.',
      voiceXp: 'Voice-XP: **{v}/min**.',
      viewTitle: '⚙ Rang-System-Konfiguration',
      vTextXp: 'Text-XP', vVoiceXp: 'Voice-XP', vMultipliers: 'Multiplikatoren',
      vAnnounce: 'Ansagen', vNoXp: 'Kein-XP-Kanäle', vPrestige: 'Prestige',
      vTextXpVal: '{min}–{max} / Nachr. · {cd}s Cooldown',
      vVoiceXpVal: '{perMin} / min · braucht ≥2 im Kanal: {req}',
      vMultVal: 'global ×{global} · Booster ×{booster} · {roles} Rolle, {channels} Kanal',
      vAnnVal: 'Modus: {mode} · Kanal: {channel} · nur-Ränge: {onlyRanks} · DM: {dm}',
      vPrestigeVal: 'ab Level {atLevel} · +{pct}%/Stern · max {max}',
      modeChannel: 'fester Kanal', modeCurrent: 'wo sie aufsteigen', modeOff: 'aus',
    },
    err: { generic: 'Beim Verarbeiten ist etwas schiefgelaufen.' },
  },
};
