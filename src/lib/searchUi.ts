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
  };
}

/** Inhalt von /search-ui.json bzw. /de/search-ui.json (assets/data-search.js). */
export function searchUiJson(lang: Locale): { root: Record<string, string>; l: Record<string, string> } {
  return { root: searchRootData(lang), l: searchChromeLabels(lang) };
}
