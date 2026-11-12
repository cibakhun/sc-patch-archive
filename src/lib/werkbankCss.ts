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
//
// Dritte Runde (Krisz 11.11.2026: „wir können das so machen das das tool die
// ganze seite füllt, überschrift und sowas brauchen wir eig gar nicht“): kein
// Kopfband mehr (crafting.astro), die Werkbank nimmt die volle Breite, Reiter,
// Prototyp-Zeile und Hilfe teilen sich eine Zeile, und auf hohen Fenstern
// reichen die drei Spalten bis an den unteren Rand.
export const WERKBANK_CSS = `
/* --wb-bar, --wb-count und --wb-y misst crafting-app.js (Hoehe der
   Bedienleiste, der Zaehlzeile ueber der Liste, Oberkante der Spalten auf
   der Seite); die Werte hier sind nur der Startwert. --wb-h ist die Hoehe,
   die unter den Spalten-Oberkanten bis zum unteren Fensterrand bleibt. */
.cdb--wb{--wb-bar:4.4rem;--wb-count:2.6rem;--wb-top:calc(var(--nav-h,68px) + var(--wb-bar) + .5rem);--wb-h:calc(100dvh - var(--wb-y,calc(var(--nav-h,68px) + var(--wb-bar) + 3.5rem)) - .9rem);max-width:none;padding-inline:clamp(.75rem,1.6vw,1.5rem)}
/* Reiterzeile: Reiter, dahinter die Prototyp-Zeile (CraftingProtoNote
   kompakt); ab 821 px steht rechts daneben die Hilfe. */
.cdb--wb > .cdb-tabs{margin-bottom:.35rem;border-bottom:0;align-items:center}
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
  .cdb--wb{display:grid;grid-template-columns:minmax(280px,1fr) clamp(400px,44vw,560px);grid-template-areas:"kopf kopf" "bar bar" "list bp";column-gap:1.4rem;align-items:start}
  /* Reiter und Hilfe teilen sich die Kopfzeile (dieselbe Rasterzelle, links
     und rechts). Der Innenabstand rechts haelt den Platz der Hilfe frei;
     wird es eng, bricht die Prototyp-Zeile unter die Reiter um. */
  .cdb--wb > .cdb-tabs{grid-area:kopf;padding-right:min(22rem,42%)}
  .cdb--wb > #cdb-tab-db-content:not([hidden]){display:contents}
  /* Hilfe rechts in der Kopfzeile; aufgeklappt legt sie sich als Tafel
     ueber die Spalten, statt sie nach unten zu schieben. Klick daneben und
     Esc schliessen sie (crafting-app.js). */
  .cdb--wb > #cdb-tab-db-content > .tool-help{grid-area:kopf;justify-self:end;align-self:start;position:relative;z-index:40;margin:.25rem 0 0;border-color:transparent;background:none;overflow:visible}
  .cdb--wb > #cdb-tab-db-content > .tool-help > .tool-help__summary{padding:.45rem .7rem;font-size:var(--fs-7);color:var(--muted,#9ba2ae);white-space:nowrap}
  .cdb--wb > #cdb-tab-db-content > .tool-help > .tool-help__summary:hover,
  .cdb--wb > #cdb-tab-db-content > .tool-help[open] > .tool-help__summary{color:var(--text,#eef1f5)}
  .cdb--wb > #cdb-tab-db-content > .tool-help > .tool-help__body{position:absolute;top:calc(100% + .3rem);right:0;width:min(560px,calc(100vw - 2rem));max-height:calc(100dvh - var(--nav-h,68px) - 6rem);overflow:auto;background:var(--surface,#232329);border:1px solid var(--line,rgba(255,94,26,.3));border-radius:8px;box-shadow:0 16px 40px rgba(0,0,0,.55)}
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
  /* Kacheln ab 225 px (bisherige Seite: 240): bei 1280 px passen so zwei
     nebeneinander in die Listenspalte statt einer. Die Listenansicht
     (.is-list, eine Spalte) bleibt, wie sie ist. */
  .cdb--wb .cdb-grid:not(.is-list){grid-template-columns:repeat(auto-fill,minmax(min(225px,100%),1fr))}
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
  /* Mitte bis an den unteren Rand, auch leer und mit kurzem Rezept. */
  .cdb--wb > .cdb-modal .cdb-modal__box{height:var(--wb-h);max-height:none}
  .cdb--wb > .cdb-modal.is-leer .cdb-modal__box{display:grid;align-content:center}
  .cdb--wb .cdb-grid.vb-scrollbox{max-height:calc(var(--wb-h) - var(--wb-count))}
}
@media (min-width:1180px){
  /* Mitte und Planer wachsen mit dem Fenster, die Liste nimmt den Rest:
     ab etwa 1400 px zwei Kacheln nebeneinander. */
  .cdb--wb{grid-template-columns:minmax(280px,1fr) clamp(440px,34vw,580px) clamp(250px,20vw,300px);grid-template-areas:"kopf kopf kopf" "bar bar bar" "list bp plan"}
  .cdb--wb > .cdb-drawer{grid-area:plan;position:sticky;top:var(--wb-top);right:auto;z-index:auto;width:auto;height:auto;max-height:calc(100dvh - var(--wb-top) - 1rem);transform:none;border:1px solid var(--accent-2,#1FA2FF);border-radius:8px;transition:none}
  .cdb--wb .cdb-drawer__hd [data-planner-close]{display:none}
  .cdb--wb .cdb-planner-open{display:none}
}
@media (min-width:1180px) and (min-height:720px){
  .cdb--wb > .cdb-drawer{position:relative;top:auto;height:var(--wb-h);max-height:none}
}
@media (max-width:820px){
  .cdb--wb{padding-bottom:5.2rem}
  /* Die Hilfe steht hier als Kasten unter der Reiterzeile: etwas Luft. */
  .cdb--wb > .cdb-tabs{margin-bottom:.9rem}
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
