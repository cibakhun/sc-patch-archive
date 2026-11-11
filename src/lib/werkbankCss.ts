// Stil der Crafting-Werkbank (Prototyp, Skizze 016-3). Nur die Vorschau-
// Seite /topics/crafting-werkbank.html traegt ihn (CraftingApp werkbank),
// die bisherige Crafting-Seite und der Live-Bau sehen ihn nie.
//
// Aufbau, alles aus dem bestehenden Markup von CraftingApp umgestellt:
//   ab 1180 px   Liste | Rezept | Planer   (drei Spalten, Mitte und Planer kleben)
//   821–1179 px  Liste | Rezept            (Planer wie bisher als Schublade)
//   bis 820 px   wie die bisherige Seite: Kacheln, das Rezept im Fenster,
//                der Planer ueber eine feste Leiste unten
//
// Zweite Runde (Krisz 11.11.2026: „die alte war iwi besser vom gefühl her
// und auch wesentlich polished er“, gewaehlt: Werkbank nachpolieren): die
// Werkbank traegt jetzt die Kacheln, die Bedienleiste und das Rezeptfenster
// der bisherigen Seite. Eigene Regeln stehen hier nur noch fuer die Stellung,
// das Aussehen kommt aus CraftingApp. Vorher: kompakte Zeilen, Leiste in der
// schmalen Listenspalte, eigener Kasten fuer die Mitte, Vollbild am Telefon.
export const WERKBANK_CSS = `
/* --wb-bar und --wb-count misst crafting-app.js (Hoehe der Bedienleiste,
   der Zaehlzeile darueber); die Werte hier sind nur der Startwert. --wb-h
   ist die Hoehe, die unter Kopfleiste und Bedienleiste bleibt. */
.cdb--wb{--wb-bar:4.4rem;--wb-count:2.6rem;--wb-top:calc(var(--nav-h,68px) + var(--wb-bar) + .5rem);--wb-h:calc(100dvh - var(--nav-h,68px) - var(--wb-bar) - 1rem);max-width:min(1480px,100%)}
.cdb-wb-leer{display:grid;justify-items:center;align-content:center;gap:.5rem;min-height:min(420px,calc(100dvh - var(--wb-top) - 6rem));padding:1.5rem 1rem;text-align:center}
.cdb-wb-leer__i{display:grid;place-items:center;width:64px;height:64px;margin-bottom:.4rem;border:1px solid var(--line,rgba(255,94,26,.3));border-radius:50%;color:var(--accent,#FF5E1A);background:color-mix(in srgb,var(--accent,#FF5E1A) 8%,transparent)}
.cdb-wb-leer__i .cic,.cdb-wb-leer__i svg{width:28px;height:28px}
.cdb-wb-leer__k{margin:0;font-family:var(--font-ui,inherit);font-weight:700;letter-spacing:var(--ls-10);text-transform:uppercase;font-size:var(--fs-4);color:var(--accent,#FF5E1A)}
.cdb-wb-leer__t{margin:0;font-family:var(--font-display,inherit);font-weight:800;font-size:var(--fs-12,1.6rem);line-height:1.1;color:var(--text,#eef1f5)}
.cdb-wb-leer__x{margin:0;max-width:40ch;color:var(--muted,#9ba2ae);font-size:var(--fs-8);line-height:1.55}
.cdb--wb .cdb-modal.is-leer .cdb-modal__x{display:none}

/* Die gewaehlte Kachel: ganze Kante Orange und ein Hauch Orange dahinter. */
.cdb--wb .cbp.is-sel{border-color:var(--accent,#FF5E1A);box-shadow:inset 0 0 0 1px var(--accent,#FF5E1A);background:color-mix(in srgb,var(--accent,#FF5E1A) 9%,var(--surface,#232329))}
.cdb--wb .cbp.is-sel .cbp__name a{color:#fff}
/* Namen nur an Wortgrenzen umbrechen: in der Listenspalte sind die Kacheln
   schmaler als auf der bisherigen Seite, und die Silbentrennung (hyphens:auto,
   geerbt) machte aus „Greatsword“ ein „Gre-atsword“ (gesehen bei 1440 px). */
.cdb--wb .cbp__name{hyphens:manual}

@media (min-width:821px){
  /* Kopf (Hilfe, Bedienleiste) ueber die ganze Breite wie auf der
     bisherigen Seite, darunter die Spalten. display:contents hebt die
     Kinder des Reiters ins Raster; hidden gewinnt weiter (theme.css). */
  .cdb--wb{display:grid;grid-template-columns:minmax(280px,1fr) clamp(400px,44vw,560px);grid-template-areas:"tabs tabs" "help help" "bar bar" "list bp";column-gap:1.4rem;align-items:start}
  .cdb--wb > .cdb-tabs{grid-area:tabs}
  .cdb--wb > #cdb-tab-db-content:not([hidden]){display:contents}
  .cdb--wb > #cdb-tab-db-content > .tool-help{grid-area:help}
  .cdb--wb > #cdb-tab-db-content > .cdb-bar{grid-area:bar}
  .cdb--wb > #cdb-tab-db-content > .cdb-layout{grid-area:list;min-width:0}
  .cdb--wb > #cdb-tab-dismantle-content{grid-column:1/-1}
  .cdb--wb > .cdb-toast{grid-column:1/-1}
  .cdb--wb:has(#cdb-tab-dismantle-content:not([hidden])) > .cdb-modal,
  .cdb--wb:has(#cdb-tab-dismantle-content:not([hidden])) > .cdb-drawer{display:none}
  /* Filter als Schublade von links (wie am Telefon), die Liste bekommt die
     Breite. Verdunkler, Esc, Sperre und inert im geschlossenen Zustand
     kommen von offcanvas.js (data-offcanvas-immer am Panel). */
  .cdb--wb .cdb-layout{grid-template-columns:1fr}
  .cdb--wb .cdb-filter-toggle{display:inline-block}
  .cdb--wb .cdb-sidebar{position:fixed;top:0;left:0;z-index:9650;width:min(340px,88%);height:100%;max-height:none;border-radius:0;transform:translateX(-100%)}
  .cdb--wb .cdb-sidebar.is-open{transform:translateX(0);box-shadow:0 0 40px rgba(0,0,0,.6)}
  /* Kopf mit ✕ wie am Telefon: ohne ihn hatte die Schublade am Schreibtisch
     keinen sichtbaren Weg zu (nur Esc und Klick daneben). */
  .cdb--wb .cdb-side-hd{display:flex}
  html.cdb-ready .cdb--wb .cdb-sidebar{transition:transform var(--dur-slow) var(--ease-ui)}
  /* Mitte: das Fenster der bisherigen Seite, nur im Fluss statt darueber,
     und klebend unter der Bedienleiste. inset VOR top: die Kurzform setzt
     top sonst wieder auf auto. */
  .cdb--wb > .cdb-modal{grid-area:bp;position:sticky;inset:auto;top:var(--wb-top);z-index:auto;display:block;padding:0;background:none;overflow:visible}
  .cdb--wb > .cdb-modal .cdb-modal__box{max-width:none;max-height:calc(100dvh - var(--wb-top) - 1rem);overflow:auto;overscroll-behavior:contain}
  .cdb--wb .cdb-modal__back{top:.6rem;left:auto;right:3.1rem;width:32px;height:32px}
  /* Platz fuer ✕ und den Zurueck-Pfeil daneben (der steht hier rechts). */
  .cdb--wb .cbm__cat{padding-right:3.6rem}
}
/* Auf hohen Fenstern ist die Liste ein eigenes Scrollfeld (.vb-scrollbox,
   mobile-ux.css). Dann stehen die drei Spalten gleich hoch unter der
   Bedienleiste, jede rollt fuer sich, und nichts klebt: eine klebende Leiste
   legte sich sonst beim Weiterrollen ueber den Kopf von Rezept und Planer
   (gesehen 11.11.2026 bei 1440 px). Auf flachen Fenstern laeuft die Liste im
   Seitenfluss, dort kleben Leiste, Mitte und Planer wie zuvor. */
@media (min-width:821px) and (min-height:720px){
  .cdb--wb > #cdb-tab-db-content > .cdb-bar{position:relative;top:auto;backdrop-filter:none;background:none}
  .cdb--wb > .cdb-modal{position:relative;top:auto}
  .cdb--wb > .cdb-modal .cdb-modal__box{max-height:var(--wb-h)}
  .cdb--wb .cdb-grid.vb-scrollbox{max-height:calc(var(--wb-h) - var(--wb-count))}
}
@media (min-width:1180px){
  /* Mitte und Planer wachsen mit dem Fenster, die Liste nimmt den Rest:
     ab etwa 1400 px zwei Kacheln nebeneinander. */
  .cdb--wb{grid-template-columns:minmax(280px,1fr) clamp(440px,34vw,580px) clamp(250px,20vw,300px);grid-template-areas:"tabs tabs tabs" "help help help" "bar bar bar" "list bp plan"}
  .cdb--wb > .cdb-drawer{grid-area:plan;position:sticky;top:var(--wb-top);right:auto;z-index:auto;width:auto;height:auto;max-height:calc(100dvh - var(--wb-top) - 1rem);transform:none;border:1px solid var(--accent-2,#1FA2FF);border-radius:8px;transition:none}
  .cdb--wb .cdb-drawer__hd [data-planner-close]{display:none}
  .cdb--wb .cdb-planner-open{display:none}
}
@media (min-width:1180px) and (min-height:720px){
  .cdb--wb > .cdb-drawer{position:relative;top:auto;max-height:var(--wb-h)}
}
/* Breiter als der Seitenrahmen, sobald Platz ist: die drei Spalten nutzen
   ein grosses Fenster aus (bis 1760 px). .cdb steht mittig im vollen <main>. */
@media (min-width:1600px){
  .cdb--wb{max-width:1760px}
}
@media (max-width:820px){
  .cdb--wb{padding-bottom:5.2rem}
  .cdb--wb > .cdb-modal.is-leer{display:none}
  /* Offenes Rezept: die Planer-Leiste weicht, sie schien sonst durch den
     halbdurchsichtigen Hintergrund des Fensters. */
  .cdb--wb:has(> .cdb-modal:not(.is-leer)) .cdb-planner-open{display:none}
  /* Planer: feste Leiste unten, oeffnet die Schublade. Der Knopf steht in
     .cdb-bar, und deren backdrop-filter machte sie zum Bezugsrahmen fuer
     position:fixed (die Leiste sass dann mitten in der Seite, gemessen
     09.11.2026 bei 390 px). Hier steht die Leiste ohnehin im Fluss. */
  .cdb--wb .cdb-bar{backdrop-filter:none}
  .cdb--wb .cdb-planner-open{position:fixed;left:.75rem;right:.75rem;bottom:calc(.75rem + env(safe-area-inset-bottom,0px));z-index:9000;display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;background:var(--bg-2,#1d1d22);box-shadow:0 8px 28px rgba(0,0,0,.55)}
}
`;
