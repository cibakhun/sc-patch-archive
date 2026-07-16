// Single source of truth for site-wide metadata.
//
// WICHTIG (Deploy): Die interne Verlinkung der Site ist durchgehend root-relativ
// (/patches/…, /assets/…) und funktioniert NUR bei Deploy an einer Domain-Wurzel
// (Cloudflare Pages, eigene Domain, GitHub-USER-Page). `url` darf deshalb KEIN
// Pfad-Präfix tragen — beim Wechsel des Deploy-Ziels nur die Domain hier und
// `site` in astro.config.mjs anpassen (canonical/hreflang/og hängen daran).
export const SITE = {
  name: 'VerseBase',
  url: 'https://verse-base.com',
  // Fallback-Description pro Sprache (Layout wählt nach URL-Locale). Vorher
  // ein einziger DE-String — der landete auch auf EN-Seiten ohne eigene
  // description und als WebSite-JSON-LD-Text der EN-Ausgabe.
  defaultDescription: {
    de: 'VerseBase — das inoffizielle Star-Citizen-Kompendium: Item Finder, Mining-Tools, Crafting-Datenbank, Wikelo-Trades, Schiffs-Datenbank und das komplette Patch-Archiv von Alpha 4.0.0 bis 4.9.0. Game-akkurat, zweisprachig, ein Fan-Projekt.',
    en: 'VerseBase — the unofficial Star Citizen compendium: item finder, mining tools, crafting database, Wikelo trades, ship database and the complete patch archive from Alpha 4.0.0 to 4.9.0. Game-accurate, bilingual, a fan project.',
  },
  /** site-weites Social-Preview-Fallback (1200×630) — Seiten ohne eigenes ogImage */
  ogDefault: '/assets/og-default.jpg',
} as const;

// Feedback-Formular — die Site bleibt statisch (kein eigenes Backend). Der
// Versand läuft über Web3Forms (https://web3forms.com): der Browser POSTet an
// deren API, Web3Forms schickt die Nachricht per Mail an das Zielkonto und
// setzt Reply-To automatisch auf die (optionale) Absender-Mail des Users.
//
// SETUP: Key bei https://web3forms.com kostenlos mit der Zieladresse
// (krysx141@gmail.com) anfordern — er kommt sofort per Mail — und hier
// eintragen. Der Access-Key ist NICHT geheim (er darf im Client stehen); er
// bindet nur die Zieladresse und lässt sich jederzeit neu ausstellen.
// Solange der Platzhalter steht, läuft das Formular im Demo-Modus: es validiert
// und zeigt die Erfolgs-UI, verschickt aber NICHTS.
export const FEEDBACK = {
  web3formsKey: 'ccda7527-0c29-43d2-90c3-bde065ecdf09',
  endpoint: 'https://api.web3forms.com/submit',
  /** landet im Betreff der Mail an das Zielkonto */
  subject: 'Neues Feedback · VerseBase',
} as const;

/** true, solange kein echter Web3Forms-Key hinterlegt ist (Demo-Modus). */
export const FEEDBACK_DEMO = FEEDBACK.web3formsKey === 'REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY';
