// Stil der Crafting-Werkbank (Prototyp, Skizze 016-3). Nur die Vorschau-
// Seite /topics/crafting-werkbank.html traegt ihn (CraftingApp werkbank),
// die bisherige Crafting-Seite und der Live-Bau sehen ihn nie.
//
// Aufbau, alles aus dem bestehenden Markup von CraftingApp umgestellt:
//   ab 1180 px   Liste | Rezept | Planer   (drei Spalten, Mitte und Planer kleben)
//   821–1179 px  Liste | Rezept            (Planer wie bisher als Schublade)
//   bis 820 px   Liste; das Rezept als Ebene darueber mit „← Liste“,
//                der Planer ueber eine feste Leiste unten
// Die Crafting-Identitaet bleibt: Graphit, Orange, Blau, Orbitron-Namen,
// Karten mit Akzentkante. Neu ist nur die Stellung.
export const WERKBANK_CSS = `
.cdb--wb{--wb-top:calc(var(--nav-h,68px) + .8rem);max-width:min(1480px,100%)}
.cdb-wb-zur{display:none}
.cdb-wb-leer{display:grid;gap:.45rem;padding:2.2rem .4rem 1.6rem;text-align:left}
.cdb-wb-leer__k{margin:0;font-family:var(--font-ui,inherit);font-weight:700;letter-spacing:var(--ls-10);text-transform:uppercase;font-size:var(--fs-4);color:var(--accent,#FF5E1A)}
.cdb-wb-leer__t{margin:0;font-family:var(--font-display,inherit);font-weight:800;font-size:var(--fs-12,1.6rem);line-height:1.1;color:var(--text,#eef1f5)}
.cdb-wb-leer__x{margin:0;max-width:46ch;color:var(--muted,#9ba2ae);font-size:var(--fs-8);line-height:1.55}
.cdb--wb .cdb-modal.is-leer .cdb-modal__x{display:none}

/* Liste: kompakte Zeilen statt Kacheln (Kategorie, Name, Werte; ★/＋
   rechts), die gewaehlte mit Orange-Kante. Raster/Liste umschalten entfaellt,
   es gibt nur diese eine Liste. Die Knopfspalte ist vorab reserviert: die
   Knoepfe setzt das Skript erst nach dem ersten Bild ein. Schaetzwerte fuer
   content-visibility = mittlere Inhaltshoehe ohne Innenabstand und Rahmen
   (gemessen 09.11.2026 an 400 Zeilen: 78 px bei 1024-1280, 88-92 px bei
   360-390). */
.cdb--wb .cdb-viewtog{display:none}
.cdb--wb .cdb-grid{grid-template-columns:1fr;gap:.3rem}
.cdb--wb .cdb-grid .cbp{--wb-knopf:56px;display:grid;grid-template-columns:auto minmax(0,1fr) minmax(var(--wb-knopf),auto);grid-template-areas:"cat cat btns" "name name btns" "meta spec spec";column-gap:.7rem;row-gap:.2rem;align-items:center;padding:.5rem .6rem .5rem .7rem;border-top-width:1px;border-left:3px solid transparent;contain-intrinsic-size:auto 78px}
.cdb--wb .cbp:hover{transform:none;border-left-color:var(--accent-2,#1FA2FF)}
.cdb--wb .cbp__top{display:contents}
.cdb--wb .cbp__cat{grid-area:cat}
.cdb--wb .cbp__btns{grid-area:btns;justify-self:end}
.cdb--wb .cbp__name{grid-area:name;font-size:var(--fs-9)}
.cdb--wb .cbp__meta{grid-area:meta;gap:.6rem;white-space:nowrap}
.cdb--wb .cbp__spec{grid-area:spec;margin:0;min-width:0}
.cdb--wb .cbp__res{display:none}
.cdb--wb .cbp.is-sel{border-color:var(--accent,#FF5E1A);border-left-color:var(--accent,#FF5E1A);background:color-mix(in srgb,var(--accent,#FF5E1A) 12%,var(--surface,#232329))}
.cdb--wb .cbp.is-sel .cbp__name a{color:#fff}

@media (min-width:821px){
  .cdb--wb{display:grid;grid-template-columns:minmax(300px,360px) minmax(0,1fr);grid-template-areas:"tabs tabs" "list bp";column-gap:1.2rem;align-items:start}
  .cdb--wb > .cdb-tabs{grid-area:tabs}
  .cdb--wb > #cdb-tab-db-content{grid-area:list;min-width:0}
  .cdb--wb > #cdb-tab-dismantle-content{grid-column:1/-1}
  .cdb--wb > .cdb-toast{grid-column:1/-1}
  .cdb--wb:has(#cdb-tab-dismantle-content:not([hidden])) > .cdb-modal,
  .cdb--wb:has(#cdb-tab-dismantle-content:not([hidden])) > .cdb-drawer{display:none}
  /* Filter als Schublade von links (wie am Telefon), die Liste bekommt die
     Breite. Verdunkler, Esc, Sperre und inert im geschlossenen Zustand
     kommen von offcanvas.js (data-offcanvas-immer am Panel). */
  .cdb--wb .cdb-layout{grid-template-columns:1fr}
  .cdb--wb .cdb-filter-toggle{display:inline-block}
  .cdb--wb .cdb-sidebar{position:fixed;top:0;left:0;z-index:9250;width:min(340px,88%);height:100%;max-height:none;border-radius:0;transform:translateX(-100%)}
  .cdb--wb .cdb-sidebar.is-open{transform:translateX(0);box-shadow:0 0 40px rgba(0,0,0,.6)}
  html.cdb-ready .cdb--wb .cdb-sidebar{transition:transform var(--dur-slow) var(--ease-ui)}
  /* Mitte: das Rezept steht im Fluss und klebt unter der Kopfleiste.
     inset VOR top: die Kurzform setzt top sonst wieder auf auto. */
  .cdb--wb > .cdb-modal{grid-area:bp;position:sticky;inset:auto;top:var(--wb-top);z-index:auto;display:block;padding:0;background:none;overflow:visible;margin-top:.7rem}
  .cdb--wb > .cdb-modal .cdb-modal__box{max-width:none;max-height:calc(100dvh - var(--wb-top) - 1rem);overflow:auto;overscroll-behavior:contain;background:var(--surface,#232329);border:1px solid var(--line,rgba(255,94,26,.22));border-top:2px solid var(--accent,#FF5E1A);border-radius:6px}
  .cdb--wb .cdb-modal__back{top:.6rem;left:auto;right:3.1rem;width:32px;height:32px}
}
@media (min-width:1180px){
  .cdb--wb{grid-template-columns:minmax(290px,340px) minmax(0,1fr) minmax(270px,310px);grid-template-areas:"tabs tabs tabs" "list bp plan"}
  .cdb--wb > .cdb-drawer{grid-area:plan;position:sticky;top:var(--wb-top);right:auto;z-index:auto;width:auto;height:auto;max-height:calc(100dvh - var(--wb-top) - 1rem);margin-top:.7rem;transform:none;border:1px solid var(--accent-2,#1FA2FF);border-radius:6px;transition:none}
  .cdb--wb .cdb-drawer__hd [data-planner-close]{display:none}
  .cdb--wb .cdb-planner-open{display:none}
}
@media (max-width:820px){
  .cdb--wb{padding-bottom:5.2rem}
  /* ★/＋ sind hier 44 px breit (mobile-ux.css). Der Name braucht keine
     eigene Fingerkuppen-Hoehe: die ganze Zeile oeffnet das Rezept. */
  .cdb--wb .cdb-grid .cbp{--wb-knopf:94px;contain-intrinsic-size:auto 90px}
  .cdb--wb .cbp__name a{padding-block:.15rem}
  .cdb--wb > .cdb-modal.is-leer{display:none}
  /* Das Rezept als ganze Ebene ueber der Liste, mit Weg zurueck oben links */
  .cdb--wb > .cdb-modal{padding:0;background:var(--bg,#16161a)}
  .cdb--wb > .cdb-modal .cdb-modal__box{min-height:100%;max-width:none;border:0;border-top:2px solid var(--accent,#FF5E1A);border-radius:0;padding-top:3.6rem}
  .cdb--wb .cdb-wb-zur{display:inline-flex;align-items:center;gap:.3rem;position:absolute;top:.6rem;left:.6rem;min-height:44px;padding:0 .9rem;background:var(--veil);border:1px solid var(--line,rgba(255,94,26,.3));border-radius:6px;color:var(--text,#eef1f5);font-family:var(--font-ui,inherit);font-weight:700;letter-spacing:var(--ls-9);cursor:pointer}
  .cdb--wb .cdb-modal__back{display:none}
  /* Planer: feste Leiste unten, oeffnet die Schublade. Der Knopf steht in
     .cdb-bar, und deren backdrop-filter machte sie zum Bezugsrahmen fuer
     position:fixed (die Leiste sass dann mitten in der Seite, gemessen
     09.11.2026 bei 390 px). Hier steht die Leiste ohnehin im Fluss. */
  .cdb--wb .cdb-bar{backdrop-filter:none}
  .cdb--wb .cdb-planner-open{position:fixed;left:.75rem;right:.75rem;bottom:calc(.75rem + env(safe-area-inset-bottom,0px));z-index:9000;display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;background:var(--bg-2,#1d1d22);box-shadow:0 8px 28px rgba(0,0,0,.55)}
}
`;
