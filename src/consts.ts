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

// Discord — die EINE Quelle für den Einladungslink. Der Server ist die
// Werkstatt hinter der Seite: Fehler melden, mitbestimmen was als Nächstes
// gebaut wird. KEIN allgemeiner Star-Citizen-Community-Server — davon gibt es
// genug, und gegen die anzutreten hieße, überall Zweiter zu sein. Der Text an
// jeder Verwendungsstelle muss diesen engen Zweck sagen, sonst kommen Leute
// mit falscher Erwartung.
//
// ⚠ Der Code ist an DIESE Einladung gebunden (permanent, Ziel #welcome). Sie
// wird von `discord/build.mjs` am Leben gehalten — verschwindet sie, legt der
// Builder eine NEUE mit ANDEREM Code an und der Link hier zeigt ins Leere.
// Dagegen prüft `node discord/verify-invite.mjs` (kein Token nötig). Bewusst
// NICHT im CI-Tor: der Lauf braucht Netz, und ein Discord-Ausfall darf keinen
// Deploy reißen — nach jedem `discord/npm run build` von Hand laufen lassen.
// ⚠ Wer die Einladung ANLEGT, dessen Name steht auf der Beitrittsseite („X hat
// dich eingeladen") — änderbar ist er nicht. Diese hier ist bewusst von Hand
// im Client angelegt, damit dort ein Mensch steht und nicht der Bot; die
// vorige stammte von der längst gelöschten Test-App `test5` und trug deren
// Namen. Beim Anlegen zwingend „Ablaufen nach: Nie" wählen — Discords Vorgabe
// ist ein Ablaufdatum, und ein solcher Link stirbt nach vier Wochen lautlos.
export const DISCORD = {
  invite: 'https://discord.gg/czWY7r34aN',
  /** Servername, wie ihn Discord auf der Einladungsseite zeigt */
  serverName: 'Verse-Base',
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

// Benutzerkonten — Supabase (Projekt „verse-base", AWS eu-central-1/Frankfurt).
// Die Site bleibt statisch: Auth + Profil + Favoriten laufen clientseitig gegen
// die Supabase-API. Der Publishable Key ist ÖFFENTLICH (dafür gemacht, im
// Browser zu stehen) — Datenzugriff schützt Row Level Security, nicht der Key.
// Volles supabase-js wird NUR auf den /account/-Seiten gebundelt; alle anderen
// Seiten nutzen das schlanke /assets/account-lite.js (Nav-Status, Favoriten).
export const SUPABASE = {
  url: 'https://trgjhmbnodoarnfmlcqx.supabase.co',
  publishableKey: 'sb_publishable_AN3O0va6kEsCmHr6zDcwRQ_8sT68W3J',
  /** localStorage-Schlüssel der supabase-js-Session (Projekt-Ref-gebunden) */
  storageKey: 'sb-trgjhmbnodoarnfmlcqx-auth-token',
} as const;
