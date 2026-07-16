// Zentrale Inline-SVG-Icons — eine Quelle für SSR (Astro, via set:html) und
// Client-JS (via window.__CRAFT.icons / window.__UIF.icons durchgereicht).
// currentColor + 1em: Farbe und Größe erben vom umgebenden Text; das inline
// vertical-align richtet die Icons auch außerhalb von Flex-Containern aus
// (bewusst kein CSS nötig — Astro-scoped Styles greifen auf set:html nicht).

// Bauplan: Blatt mit Bauteil im Fadenkreuz + Konstruktionslinien.
export const ICON_BLUEPRINT =
  '<svg class="cic" width="1em" height="1em" style="vertical-align:-0.12em;flex:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/>' +
  '<circle cx="9.5" cy="9.5" r="2.5"/>' +
  '<path d="M9.5 5.4v1.6M9.5 11.5v1.6M5.4 9.5H7M12 9.5h1.6"/>' +
  '<path d="M6.5 17h11M15.5 5.5v6"/>' +
  '</svg>';

// Zerlegen: Item in zwei Hälften auseinandergezogen, Bruchlinie + Pfeile.
export const ICON_DISMANTLE =
  '<svg class="cic" width="1em" height="1em" style="vertical-align:-0.12em;flex:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9.5 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h3.5"/>' +
  '<path d="M14.5 4.5H18A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3.5"/>' +
  '<path d="M12 6v2M12 11v2M12 16v2"/>' +
  '<path d="M8.3 10.2 6.5 12l1.8 1.8M15.7 10.2 17.5 12l-1.8 1.8"/>' +
  '</svg>';
