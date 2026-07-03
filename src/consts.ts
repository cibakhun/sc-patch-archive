// Single source of truth for site-wide metadata.
export const SITE = {
  name: 'Star Citizen Patch-Archiv',
  url: 'https://cibakhun.github.io/sc-patch-archive',
  defaultDescription:
    'Star Citizen Patches von Alpha 4.0.0 bis 4.8.2 — ein Fan-Archiv.',
  locale: 'de',
} as const;

// i18n Stufe 1: Schiff-IDs, für die bereits eine EN-Route existiert.
// DE-Seiten dieser IDs geben hreflang aus; die EN-Route baut genau diese.
// Stufe 2 erweitert das auf alle Fahrzeuge (dann entfällt die Whitelist).
export const I18N_EN_SHIPS: readonly string[] = ['aegs-hammerhead'];
