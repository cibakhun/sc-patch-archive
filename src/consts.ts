// Single source of truth for site-wide metadata.
//
// WICHTIG (Deploy): Die interne Verlinkung der Site ist durchgehend root-relativ
// (/patches/…, /assets/…) und funktioniert NUR bei Deploy an einer Domain-Wurzel
// (Cloudflare Pages, eigene Domain, GitHub-USER-Page). `url` darf deshalb KEIN
// Pfad-Präfix tragen — beim Wechsel des Deploy-Ziels nur die Domain hier und
// `site` in astro.config.mjs anpassen (canonical/hreflang/og hängen daran).
export const SITE = {
  name: 'Star Citizen Patch-Archiv',
  url: 'https://cibakhun.github.io',
  defaultDescription:
    'Star Citizen Patch-Archiv: alle Patches von Alpha 4.0.0 bis 4.8.2 mit Schiffs-Datenbank, Evolution-Matrix, Mining-, Crafting- und Item-Daten — game-akkurat, zweisprachig, ein Fan-Projekt.',
  locale: 'de',
} as const;
