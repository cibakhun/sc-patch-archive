// searchUi.ts — Beschriftungen und Index-Adressen der Suche, EINMAL definiert.
//
// Zwei Huellen zeigen dieselbe Suche: SiteNav rendert das Overlay-Markup
// (src/components/SearchOverlay.astro), die schlanke DataShell nur einen Knopf,
// aus dem assets/data-search.js das Markup erst beim Antippen baut. Beide
// lesen ihre Texte hier, damit die zwei Fassungen nicht auseinanderlaufen.
//
// searchRootData     -> data-* am Overlay (#scs), gelesen von
//                       assets/search-overlay.js
// searchChromeLabels -> die Texte, die SearchOverlay.astro direkt ins Markup
//                       schreibt; die DataShell bekommt beides als
//                       /search-ui.json (bzw. /de/…), das assets/data-search.js
//                       erst beim ersten Antippen holt. So traegt jede der
//                       ~14.000 Datenseiten nur den Knopf und drei Adressen.
import { href, useTranslations, type Locale } from '../i18n/ui';

/** Arten eines Treffers; die Anzeige-Beschriftung kommt aus search.kind.<art>. */
export const SEARCH_KINDS = [
  'werkzeug', 'schiff', 'mission', 'patch', 'thema', 'feature', 'event', 'item', 'bauplan',
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export function searchRootData(lang: Locale): Record<string, string> {
  const t = useTranslations(lang);
  const out: Record<string, string> = {
    'data-index': href('/search-index.json', lang),
    'data-index-more': href('/search-index-more.json', lang),
    'data-empty-title': t('search.empty.title'),
    'data-empty-query': t('search.empty.query'),
    'data-empty-hint': t('search.empty.hint'),
    // Statuszeilen (07.11.2026): Laden und Scheitern der Index-Teile.
    'data-loading': t('search.loading'),
    'data-loading-more': t('search.loadingMore'),
    'data-failed-title': t('search.failed.title'),
    'data-failed-hint': t('search.failed.hint'),
    'data-failed-more': t('search.failed.more'),
    'data-retry': t('search.retry'),
    // Gruppierte Treffer (09.11.2026, Skizze 016) — fuer Dialog und
    // Startseiten-Feld dieselben Texte.
    'data-count': t('search.count'),
    'data-g-tools': t('search.group.tools'),
    'data-g-ships': t('search.group.ships'),
    'data-g-items': t('search.group.items'),
    'data-g-recipes': t('search.group.recipes'),
    'data-g-missions': t('search.group.missions'),
    'data-g-patches': t('search.group.patches'),
    'data-more': t('search.more'),
    'data-craft': t('search.craft'),
    'data-jump': t('search.jump'),
    'data-start-hint': t('search.startHint'),
    'data-hint-pick': t('search.pick'),
    'data-hint-open': t('search.open'),
    'data-hint-craft': t('search.craftHint'),
  };
  for (const k of SEARCH_KINDS) out[`data-k-${k}`] = t(`search.kind.${k}` as Parameters<typeof t>[0]);
  return out;
}

/** Texte, die SearchOverlay.astro direkt ins Markup schreibt — fuer den Nachbau. */
export function searchChromeLabels(lang: Locale): Record<string, string> {
  const t = useTranslations(lang);
  return {
    dialog: t('search.dialog'),
    placeholder: t('search.placeholder'),
    term: t('search.term'),
    sys: t('search.sys'),
    close: t('search.close'),
    results: t('search.results'),
    pick: t('search.pick'),
    open: t('search.open'),
    dismiss: t('search.dismiss'),
    craft: t('search.craftHint'),
  };
}

/** Inhalt von /search-ui.json bzw. /de/search-ui.json (assets/data-search.js). */
export function searchUiJson(lang: Locale): { root: Record<string, string>; l: Record<string, string> } {
  return { root: searchRootData(lang), l: searchChromeLabels(lang) };
}
