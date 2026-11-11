// Aussehen der Crafting-Werkbank (Prototyp, nur Vorschau-Bau), vierte Runde.
// Krisz 11.11.2026 zur dritten Runde: „sher gut. jetzt möchte ich dass du mal
// das design auf dem höchsten niveou bringst“, „also grafik ui animations etc“.
//
// Arbeitsteilung: werkbankCss.ts stellt (Spalten, Hoehen, Schubladen), diese
// Datei gestaltet. Sie steht im selben <style> dahinter und gewinnt bei
// gleichem Gewicht. Die bisherige Crafting-Seite und der Live-Bau sehen sie nie.
//
// Leitlinien:
//   - Eine Flaechensprache: Haarlinien statt dreier Rahmenfarben. Orange heisst
//     „daran arbeitest du“ (Auswahl, Werte), Blau heisst Planer.
//   - Zeichen statt Schriftzeichen: jede Bauteilart hat ihr Symbol
//     (werkbankGlyphs.ts, data-g), Bedienzeichen kommen als Maske (--i-*).
//   - Bewegung erklaert, was passiert (Rezept wechselt, Stueck fliegt in den
//     Planer, Wert folgt dem Regler). Kurz, nur transform/opacity, und aus bei
//     prefers-reduced-motion.
export const WERKBANK_DESIGN_CSS = `
/* ===== 0 Grundwerte ===== */
.cdb--wb{
  --e0:#121216;--e1:#1b1b20;--e2:#212127;--e3:#292931;
  --hl:rgba(238,241,245,.08);--hl2:rgba(238,241,245,.16);--hl3:rgba(238,241,245,.28);
  --o:var(--accent,#FF5E1A);--b:var(--accent-2,#1FA2FF);
  --tx:var(--text,#eef1f5);--mu:var(--muted,#9ba2ae);--mu2:#878e9b;
  --ctl:2.45rem;--kc:var(--o);
  --out:cubic-bezier(.16,1,.3,1);--feder:cubic-bezier(.34,1.5,.5,1);
  font-variant-numeric:tabular-nums;
  background:
    linear-gradient(180deg,transparent 0,var(--bg,#16161a) 34rem),
    linear-gradient(rgba(238,241,245,.035) 1px,transparent 1px) 0 -1px/100% 44px,
    linear-gradient(90deg,rgba(238,241,245,.035) 1px,transparent 1px) -1px 0/44px 100%;
}
.cdb--wb [data-cat="Vehiclegear"]{--kc:var(--b)}
.cdb--wb [data-cat="Ammo"]{--kc:#dcb440}
/* Zeichen als Maske: .wi (Bedienzeichen, --wi) und .wg (Bauteilart, --g). */
.cdb--wb .wi,.cdb--wb .wg{display:inline-block;flex:none;width:1em;height:1em;background:currentColor;-webkit-mask:var(--wi) center/contain no-repeat;mask:var(--wi) center/contain no-repeat;vertical-align:-.14em}
.cdb--wb .wg{-webkit-mask-image:var(--g);mask-image:var(--g)}
.cdb--wb button{-webkit-tap-highlight-color:transparent}
.cdb--wb :focus-visible{outline:2px solid var(--b);outline-offset:2px}

/* ===== 1 Kopfzeile: Reiter, Prototyp, Hilfe ===== */
.cdb--wb > .cdb-tabs{gap:.2rem;margin-bottom:.55rem;padding-bottom:0}
.cdb--wb .cdb-tab-btn{position:relative;padding:.6rem .9rem .72rem;border-bottom:0;border-radius:6px;letter-spacing:var(--ls-4);transition:color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-tab-btn::after{content:"";position:absolute;left:.9rem;right:.9rem;bottom:.16rem;height:2px;border-radius:2px;background:var(--o);box-shadow:0 0 12px color-mix(in srgb,var(--o) 70%,transparent);transform:scaleX(0);opacity:0;transition:transform var(--dur-slow) var(--out),opacity var(--dur-fast) linear}
.cdb--wb .cdb-tab-btn.active::after{transform:scaleX(1);opacity:1}
.cdb--wb .cdb-tab-btn:hover{color:var(--tx);background:rgba(255,255,255,.035)}
.cdb--wb .cdb-tab-btn.active{color:var(--o);border-color:transparent}
.cdb--wb .cr-proto b{background:color-mix(in srgb,var(--b) 13%,transparent);color:var(--b);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--b) 42%,transparent);padding:.14rem .5rem}
.cdb--wb .cr-proto a{border-bottom-color:transparent;transition:border-color var(--dur-fast) var(--ease-ui)}
.cdb--wb > #cdb-tab-db-content > .tool-help > .tool-help__summary{gap:.45rem;transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb > #cdb-tab-db-content > .tool-help > .tool-help__summary::before{content:"";width:1.1em;height:1.1em;background:var(--o);-webkit-mask:var(--i-help) center/contain no-repeat;mask:var(--i-help) center/contain no-repeat;transform:none}
@media (min-width:821px){
  .cdb--wb > #cdb-tab-db-content > .tool-help > .tool-help__summary{border:1px solid var(--hl);border-radius:999px;padding:.4rem .85rem .4rem .6rem}
  .cdb--wb > #cdb-tab-db-content > .tool-help > .tool-help__summary:hover,
  .cdb--wb > #cdb-tab-db-content > .tool-help[open] > .tool-help__summary{border-color:var(--hl3);background:rgba(255,255,255,.035)}
  .cdb--wb > #cdb-tab-db-content > .tool-help > .tool-help__body{top:calc(100% + .45rem);border:1px solid var(--hl2);border-radius:12px;background:var(--e1);box-shadow:0 30px 70px -20px #000,0 0 0 1px rgba(0,0,0,.4);transform-origin:100% 0}
  .cdb--wb > #cdb-tab-db-content > .tool-help[open] > .tool-help__body{animation:wb-pop var(--dur-base) var(--out)}
}

/* ===== 2 Bedienleiste ===== */
.cdb--wb > #cdb-tab-db-content > .cdb-bar{gap:.5rem;margin-bottom:.8rem;padding:.5rem;border:1px solid var(--hl);border-radius:12px;background:var(--e1);box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 18px 40px -30px #000}
.cdb--wb .cdb-filter-toggle{display:inline-flex;align-items:center;gap:.5rem;height:var(--ctl);padding:0 .95rem 0 .8rem;border:1px solid var(--hl2);border-radius:8px;background:var(--e2);font-size:var(--fs-7);letter-spacing:var(--ls-5);transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-filter-toggle::before{content:"";width:1.1em;height:1.1em;background:currentColor;-webkit-mask:var(--i-filter) center/contain no-repeat;mask:var(--i-filter) center/contain no-repeat}
.cdb--wb .cdb-filter-toggle:hover{border-color:var(--hl3);background:var(--e3)}
.cdb--wb .cdb-filter-toggle:active,.cdb--wb .cdb-planner-open:active,.cdb--wb .cbm__plan:active,.cdb--wb .cdb-plan-clear:active{transform:scale(.97)}
/* Zahl der gesetzten Filter (crafting-app.js setzt data-n). */
.cdb--wb .cdb-filter-toggle[data-n]{border-color:color-mix(in srgb,var(--o) 60%,transparent);color:var(--o)}
.cdb--wb .cdb-filter-toggle[data-n]::after{content:attr(data-n);display:grid;place-items:center;min-width:1.25rem;height:1.25rem;padding:0 .3rem;border-radius:999px;background:var(--o);color:var(--ink,#16161a);font-size:var(--fs-3);font-weight:800;animation:wb-knall var(--dur-slow) var(--feder)}
.cdb--wb .cdb-search-wrap{position:relative}
.cdb--wb .cdb-search-wrap::before{content:"";position:absolute;left:.8rem;top:50%;width:1.05rem;height:1.05rem;margin-top:-.525rem;background:var(--mu);-webkit-mask:var(--i-search) center/contain no-repeat;mask:var(--i-search) center/contain no-repeat;pointer-events:none;transition:background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-search-wrap:focus-within::before{background:var(--o)}
.cdb--wb .cdb-search{height:var(--ctl);padding:0 .9rem 0 2.5rem;border:1px solid var(--hl2);border-radius:8px;background:var(--e0);font-size:var(--fs-8);transition:border-color var(--dur-fast) var(--ease-ui),box-shadow var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-search::placeholder{color:var(--mu2)}
.cdb--wb .cdb-search:hover{border-color:var(--hl3)}
.cdb--wb .cdb-search:focus{outline:none;border-color:var(--o);box-shadow:0 0 0 3px color-mix(in srgb,var(--o) 24%,transparent)}
.cdb--wb .cdb-sort{gap:.55rem}
.cdb--wb .cdb-sort select{height:var(--ctl);padding:0 2.1rem 0 .8rem;border:1px solid var(--hl2);border-radius:8px;background:var(--e2) var(--bi-chev) right .6rem center/1rem no-repeat;-webkit-appearance:none;appearance:none;font-size:var(--fs-7);cursor:pointer;transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-sort select:hover{border-color:var(--hl3);background-color:var(--e3)}
.cdb--wb .cdb-viewtog{height:var(--ctl);padding:3px;gap:2px;border:1px solid var(--hl2);border-radius:8px;background:var(--e0);overflow:visible}
.cdb--wb .cdb-view{display:grid;place-items:center;width:calc(var(--ctl) - 8px);height:100%;padding:0;border-radius:5px;background:transparent;color:var(--mu);transition:color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),box-shadow var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-view::before{content:"";width:1.05rem;height:1.05rem;background:currentColor;-webkit-mask:var(--i-grid) center/contain no-repeat;mask:var(--i-grid) center/contain no-repeat}
.cdb--wb .cdb-view[data-view="list"]::before{-webkit-mask-image:var(--i-list);mask-image:var(--i-list)}
.cdb--wb .cdb-view:hover{color:var(--tx)}
.cdb--wb .cdb-view[aria-pressed="true"]{background:color-mix(in srgb,var(--o) 17%,transparent);color:var(--o);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--o) 55%,transparent)}
.cdb--wb .cdb-planner-open{height:var(--ctl);padding:0 1rem;border-radius:8px;background:color-mix(in srgb,var(--b) 10%,var(--e2));font-size:var(--fs-7);transition:background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-planner-open::before{content:"";width:1.1em;height:1.1em;background:currentColor;-webkit-mask:var(--i-fab) center/contain no-repeat;mask:var(--i-fab) center/contain no-repeat}
.cdb--wb .cdb-planner-open:hover{background:color-mix(in srgb,var(--b) 20%,var(--e2))}
.cdb--wb .cdb-sync{border-color:var(--hl);background:transparent}
@media (min-width:821px){
  .cdb--wb .cdb-sync{height:var(--ctl);padding:0 .9rem}
}
@media (min-width:821px) and (max-width:1179px){
  .cdb--wb .cdb-planner-open{display:inline-flex;align-items:center;gap:.5rem}
}

/* ===== 3 Liste ===== */
.cdb--wb .cdb-count-row{display:flex;align-items:baseline;gap:.6rem;margin-bottom:.6rem;font-size:var(--fs-3);letter-spacing:var(--ls-11);text-transform:uppercase;color:var(--mu)}
.cdb--wb .cdb-count-row b{display:inline-block;font-family:var(--font-display,inherit);font-size:var(--fs-11);letter-spacing:var(--ls-3);color:var(--o)}
.cdb--wb .cdb-count-row b.is-tick{animation:wb-tick var(--dur-slow) var(--out)}
.cdb--wb .cdb-count-row::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--hl2),transparent)}
.cdb--wb .cdb-grid{gap:.7rem}
/* Gerollte Liste: weiche Oberkante (is-oben setzt crafting-app.js). Die
   Unterkante kommt von der Seite (is-more-y, mobile-ux.css); stehen beide an,
   braucht es eine Maske fuer beide, zwei Masken ueberschrieben einander. */
.cdb--wb .cdb-grid.is-oben{-webkit-mask-image:linear-gradient(180deg,transparent,#000 26px);mask-image:linear-gradient(180deg,transparent,#000 26px)}
.cdb--wb .cdb-grid.is-oben[data-edgefade-y].is-more-y{-webkit-mask-image:linear-gradient(180deg,transparent,#000 26px,#000 calc(100% - 40px),transparent);mask-image:linear-gradient(180deg,transparent,#000 26px,#000 calc(100% - 40px),transparent)}
.cdb--wb .cbp{position:relative;gap:.5rem;padding:.8rem .85rem .85rem;border:1px solid var(--hl);border-radius:8px;background:linear-gradient(180deg,#24242a,#1f1f25);transition:border-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui),box-shadow var(--dur-base) var(--ease-ui)}
/* Kante in der Farbe der Gruppe: waechst beim Ueberfahren und bei Auswahl. */
.cdb--wb .cbp::before{content:"";position:absolute;left:0;top:.7rem;bottom:.7rem;width:2px;border-radius:0 2px 2px 0;background:var(--kc);transform:scaleY(0);transform-origin:50% 0;transition:transform var(--dur-base) var(--out)}
.cdb--wb .cbp:hover{border-color:var(--hl3);border-top-color:var(--hl3);transform:translateY(-2px);box-shadow:0 14px 28px -18px #000}
.cdb--wb .cbp:hover::before,.cdb--wb .cbp.is-sel::before{transform:scaleY(1)}
.cdb--wb .cbp[data-cat]{border-top-color:var(--hl)}
.cdb--wb .cbp[data-cat]:hover{border-top-color:var(--hl3)}
.cdb--wb .cbp.is-owned{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--o) 40%,transparent)}
.cdb--wb .cbp.is-sel,.cdb--wb .cbp.is-sel:hover{border-color:var(--o);background:linear-gradient(100deg,color-mix(in srgb,var(--o) 15%,#222228),#222228 62%);box-shadow:0 0 0 1px var(--o),0 16px 34px -18px color-mix(in srgb,var(--o) 65%,transparent)}
.cdb--wb .cbp.is-sel::before{background:var(--o)}
/* Lichtstreif ueber die frisch gewaehlte Kachel (einmal). */
.cdb--wb .cbp.is-sel::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.09) 50%,transparent 70%) -60% 0/250% 100% no-repeat;animation:wb-streif .7s var(--out) both;pointer-events:none}
/* Kopf der Kachel: Zeichen der Bauteilart im getoenten Feld, dann Gruppe. */
.cdb--wb .cbp__top{position:relative;align-items:center;gap:.6rem;min-height:30px}
.cdb--wb .cbp[data-g] .cbp__top{padding-left:calc(30px + .6rem)}
.cdb--wb .cbp[data-g] .cbp__top::before{content:"";position:absolute;left:0;top:50%;width:30px;height:30px;margin-top:-15px;border-radius:7px;background:color-mix(in srgb,var(--kc) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--kc) 28%,transparent);transition:background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbp[data-g] .cbp__top::after{content:"";position:absolute;left:5px;top:50%;width:20px;height:20px;margin-top:-10px;background:var(--kc);-webkit-mask:var(--g) center/contain no-repeat;mask:var(--g) center/contain no-repeat}
.cdb--wb .cbp:hover .cbp__top::before{background:color-mix(in srgb,var(--kc) 22%,transparent)}
.cdb--wb .cbp__cat{display:flex;flex-direction:column;gap:.1rem;margin-right:auto;font-size:var(--fs-1);line-height:1.2;color:var(--kc)}
.cdb--wb .cbp__cat em{margin-left:0;color:var(--mu)}
.cdb--wb .cbp__btns{gap:.3rem}
.cdb--wb .cbp__own,.cdb--wb .cbp__add{width:28px;height:28px;border:1px solid var(--hl2);border-radius:7px;background:rgba(0,0,0,.25);color:var(--mu);font-size:0;transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbp__own::before,.cdb--wb .cbp__add::before{content:"";width:15px;height:15px;background:currentColor;-webkit-mask:var(--i-star) center/contain no-repeat;mask:var(--i-star) center/contain no-repeat}
.cdb--wb .cbp__add::before{-webkit-mask-image:var(--i-plus);mask-image:var(--i-plus)}
.cdb--wb .cbp__own:hover{color:var(--o);border-color:color-mix(in srgb,var(--o) 70%,transparent);background:color-mix(in srgb,var(--o) 10%,transparent)}
.cdb--wb .cbp__add:hover{color:var(--b);border-color:color-mix(in srgb,var(--b) 70%,transparent);background:color-mix(in srgb,var(--b) 12%,transparent)}
.cdb--wb .cbp__own:active,.cdb--wb .cbp__add:active{transform:scale(.9)}
.cdb--wb .cbp__own[aria-pressed="true"]{color:var(--o);border-color:color-mix(in srgb,var(--o) 70%,transparent);background:color-mix(in srgb,var(--o) 14%,transparent)}
.cdb--wb .cbp__own[aria-pressed="true"]::before{-webkit-mask-image:var(--i-starf);mask-image:var(--i-starf)}
.cdb--wb .cbp__add.in-plan{color:var(--b);border-color:color-mix(in srgb,var(--b) 70%,transparent);background:color-mix(in srgb,var(--b) 14%,transparent)}
.cdb--wb .cbp__add.in-plan::before{-webkit-mask-image:var(--i-check);mask-image:var(--i-check)}
.cdb--wb .cbp__own.is-knall::before,.cdb--wb .cbp__add.is-knall::before{animation:wb-knall .42s var(--feder)}
.cdb--wb .cbp__name{font-size:var(--fs-9);line-height:1.18;text-wrap:balance;transition:color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbp:hover .cbp__name a{color:var(--tx)}
.cdb--wb .cbp__meta{align-items:center;gap:.85rem;font-size:var(--fs-4);color:var(--mu)}
.cdb--wb .cbp__meta span{display:inline-flex;align-items:center;gap:.3rem}
.cdb--wb .cbp__meta span::before{content:"";width:13px;height:13px;background:currentColor;opacity:.8;-webkit-mask:var(--i-clock) center/contain no-repeat;mask:var(--i-clock) center/contain no-repeat}
.cdb--wb .cbp__meta .cbp__n::before{-webkit-mask-image:var(--i-parts);mask-image:var(--i-parts)}
.cdb--wb .cbp__meta .cbp__mis::before{-webkit-mask-image:var(--i-mission);mask-image:var(--i-mission);opacity:1}
.cdb--wb .cbp__spec{gap:.3rem;margin:0}
.cdb--wb .cbp__spec li{padding:.12rem .45rem;border:0;border-radius:4px;background:rgba(255,255,255,.07);font-size:var(--fs-3);font-weight:700;letter-spacing:var(--ls-5)}
.cdb--wb .cbp__spec li.tone{background:color-mix(in srgb,var(--b) 15%,transparent);color:var(--b)}
/* Zutaten unter einer gestrichelten Linie: oben, was entsteht, unten, was es kostet. */
.cdb--wb .cbp__res{gap:.2rem .3rem;margin:.1rem 0 0;padding-top:.55rem;border-top:1px dashed var(--hl2)}
.cdb--wb .cbp__res li{border:0;border-radius:4px;background:transparent;padding:.05rem .1rem;font-size:var(--fs-4);color:#c3c8d1}
.cdb--wb .cbp__res li:not(:last-child)::after{content:"";display:inline-block;width:3px;height:3px;margin-left:.45rem;border-radius:50%;background:var(--mu2);vertical-align:middle}
.cdb--wb .cbp__res li:has(.cbp__mine){padding:.05rem .1rem}
.cdb--wb .cbp__mine{display:inline;padding:0;border-bottom:1px solid transparent;border-radius:0;transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbp__mine:hover,.cdb--wb .cbp__mine:focus-visible{background:none;border-bottom-color:var(--b)}
.cdb--wb .cbp__mine:hover::after,.cdb--wb .cbp__mine:focus-visible::after{content:none}
.cdb--wb .cbp__res li.more{color:var(--mu2)}
/* Listenansicht: eine Zeile je Rezept, Zeichen links, Angaben rechts. */
.cdb--wb .cdb-grid.is-list{gap:.4rem}
.cdb--wb .cdb-grid.is-list .cbp{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name top" "info meta";align-items:center;gap:.3rem 1rem;padding:.6rem .8rem .6rem 3.4rem}
.cdb--wb .cdb-grid.is-list .cbp__top{grid-area:top;position:static;padding-left:0;min-height:0;justify-content:flex-end}
.cdb--wb .cdb-grid.is-list .cbp[data-g] .cbp__top::before{left:.75rem}
.cdb--wb .cdb-grid.is-list .cbp[data-g] .cbp__top::after{left:calc(.75rem + 5px)}
.cdb--wb .cdb-grid.is-list .cbp__cat{display:none}
.cdb--wb .cdb-grid.is-list .cbp__name{grid-area:name;flex:none;font-size:var(--fs-8)}
.cdb--wb .cdb-grid.is-list .cbp__meta{grid-area:meta;justify-content:flex-end}
.cdb--wb .cdb-grid.is-list .cbp__spec{grid-area:info;flex:none}
.cdb--wb .cdb-grid.is-list .cbp__res{display:none}
.cdb--wb .cdb-grid.is-list .cbp:not(:has(.cbp__spec)) .cbp__name{grid-row:1 / span 2}
.cdb--wb .cdb-empty{padding:3rem 1rem;border:1px dashed var(--hl2);border-radius:10px}

/* ===== 4 Rezept (Mitte) ===== */
.cdb--wb .cdb-modal__box{padding:0;border:1px solid var(--hl2);border-radius:12px;background:var(--e1);box-shadow:0 30px 70px -40px #000}
/* Die Mitte ist je nach Fenster 366 bis 580 px breit: Kennwerte und
   Knopfzeile richten sich nach ihr, nicht nach dem Fenster. */
.cdb--wb .cdb-modal__body{position:relative;container:wbm / inline-size}
@container wbm (max-width:470px){
  .cdb--wb .wbr-kenn .wi{display:none}
}
@container wbm (max-width:400px){
  .cdb--wb .wbr-kenn:has(> :nth-child(4)){grid-template-columns:1fr 1fr}
  .cdb--wb .wbr-kenn:has(> :nth-child(4)) > div:nth-child(3){border-left:0}
  .cdb--wb .wbr-kenn:has(> :nth-child(4)) > div:nth-child(n+3){border-top:1px solid var(--hl)}
  .cdb--wb .wbr-kenn .wi{display:inline-block}
}
@container wbm (max-width:440px){
  .cdb--wb .cbm__meta > .cbm__xlink{flex-basis:100%}
}
.cdb--wb .cdb-modal__x,.cdb--wb .cdb-x{z-index:6;display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--hl2);border-radius:8px;background:rgba(0,0,0,.35);color:var(--mu);font-size:0;transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
/* Das X klebt oben rechts in der Mitte, auch wenn das Rezept darunter rollt
   (als absolut gestelltes Kind rollte es mit dem Inhalt weg). Der negative
   Rand nimmt ihm die Hoehe wieder, der Kopf beginnt also ganz oben. */
.cdb--wb .cdb-modal__x{position:sticky;top:.75rem;right:auto;margin:.75rem .75rem calc(-32px - .75rem) auto}
.cdb--wb .cdb-modal__x::before,.cdb--wb .cdb-x::before{content:"";width:15px;height:15px;background:currentColor;-webkit-mask:var(--i-close) center/contain no-repeat;mask:var(--i-close) center/contain no-repeat}
.cdb--wb .cdb-modal__x:hover,.cdb--wb .cdb-x:hover{color:var(--tx);border-color:var(--hl3);background:var(--e3)}
.cdb--wb .cdb-modal__x:active,.cdb--wb .cdb-x:active{transform:scale(.92)}
.cdb--wb .cdb-modal__back{z-index:6;top:.75rem;right:3.3rem}
/* Kopf: Emblem der Bauteilart vor einem Bauplanraster, daneben Pfad und Name. */
.cdb--wb .wbr-kopf{position:relative;display:flex;align-items:center;gap:1.1rem;padding:1.35rem 1.4rem 1.2rem;border-bottom:1px solid var(--hl);border-radius:12px 12px 0 0;overflow:hidden;background:
  radial-gradient(70% 150% at 0 0,color-mix(in srgb,var(--kc) 17%,transparent),transparent 72%),
  linear-gradient(rgba(238,241,245,.045) 1px,transparent 1px) 0 0/100% 22px,
  linear-gradient(90deg,rgba(238,241,245,.045) 1px,transparent 1px) 0 0/22px 100%,
  #1f1f25}
.cdb--wb .wbr-kopf::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,var(--kc),transparent 55%)}
.cdb--wb .wbr-emb{position:relative;flex:none;display:grid;place-items:center;width:84px;height:84px;color:var(--kc)}
.cdb--wb .wbr-emb .wb-ring{position:absolute;inset:0;width:100%;height:100%}
.cdb--wb .wbr-emb .wg,.cdb--wb .wbr-emb .wi{width:40px;height:40px;filter:drop-shadow(0 0 10px color-mix(in srgb,var(--kc) 55%,transparent))}
.cdb--wb .wbr-kopf--pool{--kc:var(--b)}
.cdb--wb .wb-ring__a{stroke:var(--hl3);stroke-width:1;stroke-dasharray:2 7;transform-origin:50% 50%;animation:wb-dreh 70s linear infinite}
.cdb--wb .wb-ring__b{stroke:currentColor;stroke-width:1.2;opacity:.55}
.cdb--wb .wb-ring__c{stroke:currentColor;stroke-width:1.5;stroke-linecap:round;opacity:.9}
.cdb--wb .wbr-kopf__t{min-width:0;flex:1}
.cdb--wb .cbm__cat{padding-right:5.2rem;font-size:var(--fs-1);letter-spacing:var(--ls-12);color:var(--kc)}
.cdb--wb .cbm__name{margin:.3rem 0 0;font-size:clamp(1.25rem,1.9vw,1.65rem);line-height:1.12;text-wrap:balance}
.cdb--wb .wbr-chips{list-style:none;display:flex;flex-wrap:wrap;gap:.3rem;margin:.6rem 0 0;padding:0}
.cdb--wb .wbr-chips li{padding:.14rem .5rem;border-radius:4px;background:rgba(255,255,255,.08);font-size:var(--fs-3);font-weight:700;letter-spacing:var(--ls-5);color:var(--tx)}
.cdb--wb .wbr-chips li.tone{background:color-mix(in srgb,var(--b) 16%,transparent);color:var(--b)}
/* Kennwerte als Zeile gleich grosser Felder. */
.cdb--wb .wbr-kenn{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(5.6rem,100%),1fr));border-bottom:1px solid var(--hl);background:rgba(0,0,0,.16)}
.cdb--wb .wbr-kenn > div{display:flex;flex-direction:column;gap:.25rem;min-width:0;padding:.7rem .6rem .75rem 1.1rem;border-left:1px solid var(--hl)}
.cdb--wb .wbr-kenn > div:first-child{border-left:0}
.cdb--wb .wbr-kenn span{display:inline-flex;align-items:center;gap:.35rem;overflow:hidden;font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-8);text-transform:uppercase;white-space:nowrap;color:var(--mu)}
.cdb--wb .wbr-kenn b{font-family:var(--font-display,inherit);font-size:var(--fs-11);font-weight:800;line-height:1.1;color:var(--tx)}
.cdb--wb .wbr-inh{padding:1.1rem 1.4rem 1.6rem}
.cdb--wb .cbm__meta{gap:.5rem;margin:0}
.cdb--wb .cbm__plan{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;order:-1;flex:1 1 100%;height:2.7rem;margin:0;padding:0 1.1rem;border-radius:8px;background:var(--b);color:#041019;font-size:var(--fs-7);letter-spacing:var(--ls-4);box-shadow:0 10px 24px -12px color-mix(in srgb,var(--b) 80%,transparent);transition:background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui),box-shadow var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbm__plan:hover{background:color-mix(in srgb,var(--b) 86%,#fff);box-shadow:0 14px 28px -12px color-mix(in srgb,var(--b) 90%,transparent)}
.cdb--wb .cbm__plan.is-ok{background:color-mix(in srgb,var(--b) 20%,var(--e2));color:var(--b);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--b) 60%,transparent)}
.cdb--wb .cbm__plan .wi{width:1.05em;height:1.05em}
.cdb--wb .cbm__plan.is-ok .wi{animation:wb-knall .42s var(--feder)}
.cdb--wb .cbm__xlink{flex:1 1 9.5rem;justify-content:space-between;gap:.6rem;min-height:2.4rem;padding:.3rem .8rem .3rem .9rem;border-color:var(--hl2);border-radius:8px;color:var(--tx);font-size:var(--fs-5);line-height:1.25;text-align:left;transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbm__xlink .wi{margin-left:auto;color:var(--b);transition:transform var(--dur-base) var(--out)}
.cdb--wb .cbm__xlink .cic{flex:none;color:var(--mu)}
.cdb--wb .cbm__xlink:hover{border-color:color-mix(in srgb,var(--b) 70%,transparent);background:color-mix(in srgb,var(--b) 10%,transparent);color:var(--b)}
.cdb--wb .cbm__xlink:hover .wi--arrow{transform:translateX(3px)}
/* Abschnittstitel: Marke, Text, Zaehler, Linie. */
.cdb--wb .cbm__h{display:flex;align-items:center;gap:.6rem;margin:1.6rem 0 .7rem;padding:0;border:0;font-size:var(--fs-2);letter-spacing:var(--ls-12);color:var(--tx)}
.cdb--wb .cbm__h::before{content:"";flex:none;width:3px;height:.95rem;border-radius:2px;background:var(--o)}
.cdb--wb .cbm__h::after{content:"";flex:1;height:1px;background:var(--hl)}
.cdb--wb .cbm__c{padding:.05rem .45rem;border-radius:999px;background:rgba(255,255,255,.08);font-size:var(--fs-2);letter-spacing:0;color:var(--mu)}
/* Zutat: Bauteil und Wirkung oben, Material, dann der Regler in einer Zeile. */
.cdb--wb .cbm__ings{gap:.55rem}
.cdb--wb .cbm__ing{padding:.8rem .9rem .85rem;border:1px solid var(--hl);border-radius:10px;background:var(--e2);transition:border-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbm__ing:hover,.cdb--wb .cbm__ing:focus-within{border-color:var(--hl2)}
.cdb--wb .wbi-kopf{display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-bottom:.45rem}
.cdb--wb .cbm__slot{margin:0;font-size:var(--fs-1);letter-spacing:var(--ls-12);color:var(--mu)}
.cdb--wb .wbi-wirk{display:inline-flex;flex-wrap:wrap;justify-content:flex-end;gap:.25rem}
.cdb--wb .wbi-wirk span{display:inline-flex;align-items:center;gap:.3rem;padding:.1rem .45rem;border-radius:4px;background:color-mix(in srgb,var(--b) 13%,transparent);font-size:var(--fs-2);font-weight:700;color:var(--b)}
.cdb--wb .cbm__opt{align-items:baseline;gap:.4rem .7rem;font-size:var(--fs-9)}
.cdb--wb .cbm__opt .on{font-weight:700}
.cdb--wb .cbm__opt .oq{margin-left:auto;font-size:var(--fs-7);color:var(--tx)}
.cdb--wb .cbm__opt .omq{padding:.05rem .4rem;border-radius:4px;background:rgba(255,255,255,.06);font-size:var(--fs-2);letter-spacing:var(--ls-5)}
.cdb--wb a.cdb-mine{border-bottom:1px solid transparent}
.cdb--wb a.cdb-mine:hover,.cdb--wb a.cdb-mine:focus-visible{border-bottom-color:var(--b)}
.cdb--wb .cdb-mine__ico{display:inline-block;width:.85em;height:.85em;margin-left:.3rem;background:currentColor;font-size:inherit;opacity:.5;overflow:hidden;color:inherit;text-indent:-9em;vertical-align:-.08em;-webkit-mask:var(--i-pick) center/contain no-repeat;mask:var(--i-pick) center/contain no-repeat;transition:opacity var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbm__sim{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.8rem;margin-top:.65rem;padding-top:.6rem;border-top:1px dashed var(--hl2)}
.cdb--wb .wbq-l{font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-11);text-transform:uppercase;color:var(--mu)}
.cdb--wb .cbm__qnum{width:4.2em;height:1.9rem;padding:0 .4rem;border:1px solid var(--hl2);border-radius:6px;background:var(--e0);font-size:var(--fs-7);text-align:center;transition:border-color var(--dur-fast) var(--ease-ui),box-shadow var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbm__qnum:focus-visible{outline:none}
/* Regler: gefuellte Spur bis zum Griff (--v 0..1 setzt crafting-app.js),
   Teilstriche bei 0, 250, 500, 750, 1000. */
.cdb--wb .cbm__slider{--v:.5;--p:calc(9px + (100% - 18px) * var(--v));-webkit-appearance:none;appearance:none;width:100%;height:28px;margin:0;background:linear-gradient(90deg,var(--hl3) 1px,transparent 1px) 9px 100%/calc((100% - 19px) / 4) 4px repeat-x;cursor:pointer}
.cdb--wb .cbm__slider::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--o) var(--p),rgba(255,255,255,.1) var(--p))}
.cdb--wb .cbm__slider::-moz-range-track{height:6px;border-radius:3px;background:rgba(255,255,255,.1)}
.cdb--wb .cbm__slider::-moz-range-progress{height:6px;border-radius:3px;background:var(--o)}
.cdb--wb .cbm__slider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-6px;border:4px solid var(--o);border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.5);transition:box-shadow var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbm__slider::-moz-range-thumb{width:10px;height:10px;border:4px solid var(--o);border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.cdb--wb .cbm__slider:hover::-webkit-slider-thumb{box-shadow:0 0 0 6px color-mix(in srgb,var(--o) 20%,transparent),0 2px 6px rgba(0,0,0,.5)}
.cdb--wb .cbm__slider:active::-webkit-slider-thumb{transform:scale(1.12);box-shadow:0 0 0 9px color-mix(in srgb,var(--o) 24%,transparent),0 2px 6px rgba(0,0,0,.5)}
.cdb--wb .cbm__slider:focus-visible{outline:none}
.cdb--wb .cbm__slider:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px var(--e2),0 0 0 5px var(--b)}
.cdb--wb .cbm__slider:focus-visible::-moz-range-thumb{box-shadow:0 0 0 3px var(--e2),0 0 0 5px var(--b)}
/* Simulierte Werte: Name, Basis → Ergebnis, darunter ein Balken ueber die
   ganze Spanne des Reglers mit Marke bei der Basis. */
.cdb--wb .cbm__out{gap:.45rem}
.cdb--wb .wbo{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.4rem .8rem;align-items:baseline;padding:.6rem .8rem .7rem;border:1px solid var(--hl);border-radius:8px;background:var(--e2)}
.cdb--wb .wbo__k{font-size:var(--fs-7);color:var(--tx)}
.cdb--wb .wbo__v{display:inline-flex;align-items:baseline;gap:.45rem;font-size:var(--fs-7);white-space:nowrap}
.cdb--wb .wbo__v .wi{width:.8em;height:.8em;color:var(--mu2);vertical-align:0}
.cdb--wb .wbo__v .cbm__b1{font-size:var(--fs-9);font-weight:800;color:var(--tx)}
.cdb--wb .wbo__v em{min-width:3.6em;padding:.05rem .35rem;border-radius:4px;background:color-mix(in srgb,var(--b) 14%,transparent);font-size:var(--fs-3);font-style:normal;font-weight:700;text-align:center;color:var(--b)}
.cdb--wb .wbo__v em.is-null{background:rgba(255,255,255,.06);color:var(--mu)}
.cdb--wb .wbo__bar{grid-column:1 / -1;position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.08)}
.cdb--wb .wbo__fill{position:absolute;top:0;bottom:0;left:var(--a,50%);width:var(--w,0%);border-radius:3px;background:var(--b);box-shadow:0 0 10px color-mix(in srgb,var(--b) 60%,transparent);transition:left 140ms var(--ease-ui),width 140ms var(--ease-ui)}
.cdb--wb .wbo__null{position:absolute;top:-3px;bottom:-3px;left:var(--n,50%);width:2px;margin-left:-1px;border-radius:1px;background:var(--tx)}
.cdb--wb .cbm__note{margin:.7rem 0 0;padding-left:.7rem;border-left:2px solid var(--hl2);font-size:var(--fs-4);line-height:1.55}
.cdb--wb .cbm__hint{margin:0 0 .6rem;font-style:normal}
/* Item-Werte: Bezeichnung klein oben, Wert darunter. */
.cdb--wb .cbm__stats{grid-template-columns:repeat(auto-fill,minmax(min(8.2rem,100%),1fr));gap:.45rem}
.cdb--wb .cbm__st{flex-direction:column;justify-content:flex-start;gap:.2rem;padding:.55rem .75rem .6rem;border:1px solid var(--hl);border-radius:8px;background:var(--e2)}
.cdb--wb .cbm__st span{font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-10);text-transform:uppercase}
.cdb--wb .cbm__st b{font-size:var(--fs-9)}
/* Missionen und Pool: Zeilen mit Zeichen, Trefferquote als Marke. */
.cdb--wb .cbm__mis{gap:.3rem;max-height:none}
.cdb--wb .cbm__mis li,.cdb--wb .cbm__pool li{padding:0 .7rem 0 0;border:1px solid var(--hl);border-radius:8px;background:var(--e2);transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbm__mis li:hover,.cdb--wb .cbm__pool li:hover{border-color:color-mix(in srgb,var(--b) 55%,transparent);background:color-mix(in srgb,var(--b) 7%,var(--e2))}
.cdb--wb .cbm__mlink{gap:.6rem;padding:.6rem .7rem;font-size:var(--fs-7)}
.cdb--wb .cbm__mlink::before{content:"";width:1em;height:1em;background:var(--b);-webkit-mask:var(--i-mission) center/contain no-repeat;mask:var(--i-mission) center/contain no-repeat}
.cdb--wb .cbm__mlink:hover{background:none}
.cdb--wb .cbm__mis b,.cdb--wb .cbm__pool b{padding:.08rem .4rem;border-radius:4px;background:color-mix(in srgb,var(--o) 14%,transparent);font-size:var(--fs-3);color:var(--o)}
.cdb--wb .cbm__blink{flex-direction:row;align-items:center;gap:.7rem;padding:.55rem .7rem}
.cdb--wb .cbm__blink:hover{background:none}
.cdb--wb .cbm__blink .wg{width:1.15rem;height:1.15rem;color:var(--kc)}
.cdb--wb .cbm__blink .pt{display:flex;flex-direction:column;gap:.1rem;min-width:0}
.cdb--wb .cbm__blink .pc{font-size:var(--fs-1)}
.cdb--wb .cbm__back{display:inline-flex;align-items:center;gap:.45rem;height:2.1rem;margin:0 0 1rem;padding:0 .8rem 0 .65rem;border-color:var(--hl2);border-radius:8px;font-size:var(--fs-5);transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cbm__back .wi{transition:transform var(--dur-base) var(--out)}
.cdb--wb .cbm__back:hover .wi{transform:translateX(-3px)}
/* Kleine Leiste, die beim Rollen oben in der Mitte stehen bleibt: Name und
   „Zum Planer“ sind dann noch da (crafting-app.js setzt is-rollt). */
.cdb--wb .wbr-fest{position:sticky;top:0;z-index:5;height:0}
.cdb--wb .wbr-fest__in{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:.7rem;padding:.55rem 3.4rem .55rem 1rem;border-bottom:1px solid var(--hl2);border-radius:12px 12px 0 0;background:var(--e1);box-shadow:0 14px 24px -18px #000;transform:translateY(-105%);opacity:0;pointer-events:none;transition:transform var(--dur-slow) var(--out),opacity var(--dur-base) linear}
.cdb--wb .is-rollt .wbr-fest__in{transform:none;opacity:1;pointer-events:auto}
.cdb--wb .wbr-fest .wg{width:1.25rem;height:1.25rem;color:var(--kc)}
.cdb--wb .wbr-fest__n{flex:1;min-width:0;overflow:hidden;font-family:var(--font-display,inherit);font-size:var(--fs-7);font-weight:800;text-overflow:ellipsis;white-space:nowrap;color:var(--tx)}
.cdb--wb .wbr-fest__p{display:inline-flex;align-items:center;gap:.35rem;height:1.9rem;padding:0 .7rem;border:0;border-radius:7px;background:var(--b);color:#041019;font-family:var(--font-ui,inherit);font-size:var(--fs-4);font-weight:800;cursor:pointer}
.cdb--wb .is-rollt .cdb-modal__x{top:.4rem}
/* Rezeptwechsel: der Inhalt kommt gestaffelt von unten. */
.cdb--wb .cdb-modal__body.is-neu .wbr-kopf__t,.cdb--wb .cdb-modal__body.is-neu .wbr-kenn > div,.cdb--wb .cdb-modal__body.is-neu .wbr-inh > *{animation:wb-auf .42s var(--out) both}
.cdb--wb .cdb-modal__body.is-neu .wbr-kenn > div:nth-child(2){animation-delay:40ms}
.cdb--wb .cdb-modal__body.is-neu .wbr-kenn > div:nth-child(3){animation-delay:80ms}
.cdb--wb .cdb-modal__body.is-neu .wbr-kenn > div:nth-child(4){animation-delay:120ms}
.cdb--wb .cdb-modal__body.is-neu .wbr-inh > :nth-child(1){animation-delay:90ms}
.cdb--wb .cdb-modal__body.is-neu .wbr-inh > :nth-child(2){animation-delay:130ms}
.cdb--wb .cdb-modal__body.is-neu .wbr-inh > :nth-child(3){animation-delay:170ms}
.cdb--wb .cdb-modal__body.is-neu .wbr-inh > :nth-child(4){animation-delay:210ms}
.cdb--wb .cdb-modal__body.is-neu .wbr-inh > :nth-child(n+5){animation-delay:250ms}
.cdb--wb .cdb-modal__body.is-neu .wbr-emb .wg{animation:wb-emb .5s var(--feder) both}
.cdb--wb .cdb-modal__body.is-neu .wb-ring__b{stroke-dasharray:277;animation:wb-zieh .7s var(--out) both}
/* Leere Mitte: Bauplan im Fadenkreuz. */
.cdb--wb .cdb-wb-leer{gap:.55rem;padding:2rem 1.4rem}
.cdb--wb .cdb-wb-leer__i{position:relative;width:132px;height:132px;margin-bottom:.9rem;border:0;background:radial-gradient(closest-side,color-mix(in srgb,var(--o) 16%,transparent),transparent)}
.cdb--wb .cdb-wb-leer__i .wb-ring{position:absolute;inset:0;width:100%;height:100%;color:var(--o)}
.cdb--wb .cdb-wb-leer__i .cic{width:40px;height:40px;filter:drop-shadow(0 0 12px color-mix(in srgb,var(--o) 60%,transparent))}
.cdb--wb .cdb-wb-leer__k{font-size:var(--fs-2);letter-spacing:var(--ls-14)}
.cdb--wb .cdb-wb-leer__t{font-size:var(--fs-14)}
.cdb--wb .cdb-modal.is-leer .cdb-modal__box{background:
  radial-gradient(60% 50% at 50% 45%,rgba(255,94,26,.05),transparent),
  linear-gradient(rgba(238,241,245,.03) 1px,transparent 1px) 0 0/100% 22px,
  linear-gradient(90deg,rgba(238,241,245,.03) 1px,transparent 1px) 0 0/22px 100%,
  var(--e1)}
.cdb--wb .cdb-modal.is-leer .cdb-wb-leer{animation:wb-ein .5s var(--out) both}

/* ===== 5 Planer ===== */
.cdb--wb .cdb-drawer{background:var(--e1)}
.cdb--wb .cdb-drawer__hd{gap:.5rem;padding:.9rem .9rem;border-bottom:1px solid var(--hl);background:linear-gradient(180deg,color-mix(in srgb,var(--b) 9%,var(--e1)),var(--e1));font-size:var(--fs-9)}
.cdb--wb .wbp-t{display:flex;align-items:center;gap:.6rem;min-width:0;font-size:clamp(.8rem,1.1vw,1.05rem);white-space:nowrap}
.cdb--wb .wbp-t::before{content:"";flex:none;width:1.25rem;height:1.25rem;background:var(--b);-webkit-mask:var(--i-fab) center/contain no-repeat;mask:var(--i-fab) center/contain no-repeat}
.cdb--wb .wbp-n{display:grid;place-items:center;min-width:1.5rem;height:1.5rem;padding:0 .4rem;border-radius:999px;background:var(--b);color:#041019;font-family:var(--font-ui,inherit);font-size:var(--fs-4);font-weight:800}
.cdb--wb .wbp-n[hidden]{display:none}
.cdb--wb .wbp-n.is-tick{animation:wb-knall .42s var(--feder)}
.cdb--wb .cdb-plan-list{gap:.35rem;padding:.8rem .8rem .6rem}
.cdb--wb .cdb-plan-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;grid-template-areas:"g n n n" "g z rm c";align-items:center;gap:.4rem .5rem;padding:.6rem .55rem .55rem .65rem;border:1px solid var(--hl);border-radius:8px;background:var(--e2);transition:border-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-plan-item:hover{border-color:var(--hl2)}
.cdb--wb .cdb-plan-item > .wg{grid-area:g;align-self:start;box-sizing:content-box;width:1.15rem;height:1.15rem;padding:.35rem;border-radius:7px;-webkit-mask:none;mask:none;background:color-mix(in srgb,var(--kc) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--kc) 28%,transparent);position:relative}
.cdb--wb .cdb-plan-item > .wg::before{content:"";position:absolute;inset:.35rem;background:var(--kc);-webkit-mask:var(--g) center/contain no-repeat;mask:var(--g) center/contain no-repeat}
.cdb--wb .pi__n{grid-area:n;font-size:var(--fs-6);font-weight:600;line-height:1.25}
.cdb--wb .pi__z{grid-area:z;display:inline-flex;align-items:center;gap:.3rem;font-size:var(--fs-4);white-space:nowrap;color:var(--mu)}
.cdb--wb .pi__z::before{content:"";width:12px;height:12px;background:currentColor;opacity:.8;-webkit-mask:var(--i-clock) center/contain no-repeat;mask:var(--i-clock) center/contain no-repeat}
/* Stueckzahl als ein Feld: minus, Zahl, plus. */
.cdb--wb .pi__ctrl{grid-area:c;gap:0;border:1px solid var(--hl2);border-radius:7px;background:rgba(0,0,0,.25)}
.cdb--wb .pi__ctrl button,.cdb--wb .cdb-plan-item .pi__rm{display:grid;place-items:center;width:26px;height:24px;padding:0;border:0;border-radius:6px;background:none;color:var(--mu);font-size:0;cursor:pointer;transition:color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.cdb--wb .pi__ctrl button::before,.cdb--wb .cdb-plan-item .pi__rm::before{content:"";width:13px;height:13px;background:currentColor;-webkit-mask:var(--i-plus) center/contain no-repeat;mask:var(--i-plus) center/contain no-repeat}
.cdb--wb .pi__ctrl [data-dec]::before{-webkit-mask-image:var(--i-minus);mask-image:var(--i-minus)}
.cdb--wb .cdb-plan-item .pi__rm{grid-area:rm;height:26px;opacity:.6}
.cdb--wb .cdb-plan-item .pi__rm::before{-webkit-mask-image:var(--i-trash);mask-image:var(--i-trash)}
.cdb--wb .cdb-plan-item:hover .pi__rm,.cdb--wb .cdb-plan-item .pi__rm:focus-visible{opacity:1}
.cdb--wb .pi__ctrl button:hover{color:var(--tx);background:rgba(255,255,255,.08)}
.cdb--wb .cdb-plan-item .pi__rm:hover{color:#ff7a7a}
.cdb--wb .pi__ctrl button:active,.cdb--wb .cdb-plan-item .pi__rm:active{transform:scale(.88)}
.cdb--wb .pi__ctrl span{display:inline-block;min-width:1.7em;font-size:var(--fs-7)}
.cdb--wb .cdb-plan-item.is-neu{animation:wb-zeile .45s var(--out) both}
.cdb--wb .cdb-plan-item.is-puls .pi__ctrl span{animation:wb-knall .36s var(--feder)}
/* Kam das Stueck geflogen, wartet die Zeile, bis der Punkt da ist. */
.cdb--wb .cdb-plan-item.is-spaet,.cdb--wb .cdb-plan-item.is-spaet .pi__ctrl span{animation-delay:.32s}
/* Leerer Planer: drei leere Plaetze, die nach unten ausblenden, darunter
   der Hinweis. */
.cdb--wb .cdb-plan-empty{display:grid;gap:.9rem;padding:.1rem 0 0;font-size:var(--fs-6);line-height:1.5;text-align:center;color:var(--mu)}
.cdb--wb .wbp-leer{display:grid;gap:.4rem}
.cdb--wb .wbp-leer i{display:block;height:3rem;border:1px dashed var(--hl2);border-radius:8px}
.cdb--wb .wbp-leer i:first-child{background:var(--bi-plus) center/1rem no-repeat}
.cdb--wb .wbp-leer i:nth-child(2){opacity:.6}
.cdb--wb .wbp-leer i:nth-child(3){opacity:.3}
.cdb--wb .cdb-plan-sum{padding:.9rem 1rem 1rem;border-top:1px solid var(--hl);background:rgba(0,0,0,.16);transition:opacity var(--dur-base) linear}
.cdb--wb .cdb-drawer:has(.cdb-plan-empty) .cdb-plan-time-row,.cdb--wb .cdb-drawer:has(.cdb-plan-empty) .cdb-plan-sum h4,.cdb--wb .cdb-drawer:has(.cdb-plan-empty) .cdb-plan-clear{opacity:.4}
.cdb--wb .cdb-plan-time-row{align-items:baseline;margin-bottom:.9rem;font-size:var(--fs-1);letter-spacing:var(--ls-11)}
.cdb--wb .cdb-plan-time-row b{display:inline-block;font-family:var(--font-display,inherit);font-size:var(--fs-13);letter-spacing:var(--ls-3);text-transform:none;color:var(--tx)}
.cdb--wb .cdb-plan-time-row b.is-tick{animation:wb-tick var(--dur-slow) var(--out)}
.cdb--wb .cdb-plan-sum h4{display:flex;align-items:center;gap:.6rem;margin:0 0 .45rem;font-size:var(--fs-1);letter-spacing:var(--ls-11);color:var(--b)}
.cdb--wb .cdb-plan-sum h4::after{content:"";flex:1;height:1px;background:var(--hl)}
.cdb--wb .cdb-plan-shop{gap:0;margin-bottom:.9rem}
.cdb--wb .ps__row{padding:.38rem .1rem;border-bottom:1px solid var(--hl);border-radius:0;background:none;font-size:var(--fs-5)}
.cdb--wb .ps__row:last-child{border-bottom:0}
.cdb--wb .ps__row b{font-weight:700;color:var(--tx)}
.cdb--wb .ps__row.is-neu{animation:wb-auf .4s var(--out) both}
.cdb--wb .cdb-sync--drawer{margin:.2rem 0 .6rem}
.cdb--wb .cdb-plan-clear{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;height:2.2rem;border-color:var(--hl2);border-radius:8px;font-size:var(--fs-5);transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-plan-clear::before{content:"";width:1em;height:1em;background:currentColor;-webkit-mask:var(--i-trash) center/contain no-repeat;mask:var(--i-trash) center/contain no-repeat}
.cdb--wb .cdb-plan-clear:hover{border-color:#ff7a7a;color:#ff7a7a}
@media (min-width:1180px){
  .cdb--wb > .cdb-drawer{border:1px solid var(--hl2);border-radius:12px;box-shadow:0 30px 70px -40px #000}
  .cdb--wb > .cdb-drawer .cdb-drawer__hd{border-radius:12px 12px 0 0}
}
/* Das Stueck, das von der Kachel in den Planer fliegt (crafting-app.js). */
.wb-flug{position:fixed;left:0;top:0;z-index:9700;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--accent-2,#1FA2FF);box-shadow:0 0 0 4px rgba(31,162,255,.25),0 0 22px 6px rgba(31,162,255,.55);pointer-events:none;will-change:transform,opacity}

/* ===== 6 Filter-Schublade ===== */
.cdb--wb .cdb-sidebar{padding:0 1rem 1.2rem;border:0;border-right:1px solid var(--hl2);background:var(--e1)}
.cdb--wb .cdb-side-hd{position:sticky;top:0;z-index:2;margin:0 -1rem .9rem;padding:.9rem 1rem;border-bottom:1px solid var(--hl);background:var(--e1);font-family:var(--font-display,inherit);font-size:var(--fs-9)}
.cdb--wb .cdb-fgroup{margin-bottom:1rem;padding-bottom:.9rem;border-bottom-color:var(--hl)}
.cdb--wb .cdb-fgroup h4{display:flex;align-items:center;gap:.5rem;font-size:var(--fs-1);letter-spacing:var(--ls-12);color:var(--mu)}
.cdb--wb .cdb-fgroup h4::before{content:"";width:3px;height:.85rem;border-radius:2px;background:var(--o)}
.cdb--wb .cdb-cat-details{border-bottom-color:var(--hl)}
.cdb--wb .cdb-cat-summary::after{content:"";width:.9rem;height:.9rem;background:var(--mu);-webkit-mask:var(--i-chev) center/contain no-repeat;mask:var(--i-chev) center/contain no-repeat}
.cdb--wb .cdb-check{gap:.6rem;padding:.3rem .35rem;border-radius:6px;font-size:var(--fs-7);transition:background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-check:hover{background:rgba(255,255,255,.04)}
.cdb--wb .cdb-check input{-webkit-appearance:none;appearance:none;display:grid;place-items:center;width:17px;height:17px;margin:0;border:1px solid var(--hl3);border-radius:5px;background:var(--e0);cursor:pointer;transition:background-color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .cdb-check input::before{content:"";width:11px;height:11px;background:var(--ink,#16161a);transform:scale(0);-webkit-mask:var(--i-check3) center/contain no-repeat;mask:var(--i-check3) center/contain no-repeat;transition:transform var(--dur-base) var(--feder)}
.cdb--wb .cdb-check input:checked{border-color:var(--o);background:var(--o)}
.cdb--wb .cdb-check input:checked::before{transform:none}
.cdb--wb .cdb-check span{display:flex;flex:1;align-items:baseline;justify-content:space-between;gap:.5rem}
.cdb--wb .cdb-check--top em,.cdb--wb .cdb-check em{margin-left:auto;padding:0 .4rem;border-radius:999px;background:rgba(255,255,255,.06);font-size:var(--fs-2);font-style:normal;font-weight:600;color:var(--mu)}
.cdb--wb .cdb-res-search{height:2.2rem;border-color:var(--hl2);border-radius:8px;background:var(--e0)}
.cdb--wb .cdb-res-list{border-color:var(--hl);border-radius:8px;background:rgba(0,0,0,.2)}
.cdb--wb .cdb-reset{height:2.4rem;padding:0;border-color:var(--hl2);border-radius:8px;transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui)}

/* ===== 6b Zerlege-Rechner (zweiter Reiter): dieselbe Flaechensprache ===== */
.cdb--wb .calc-layout{gap:1rem}
.cdb--wb .calc-sidebar{padding:1rem;border:1px solid var(--hl2);border-radius:12px;background:var(--e1);box-shadow:0 30px 70px -40px #000}
.cdb--wb .calc-sidebar h4{display:flex;align-items:center;gap:.5rem;margin:0 0 .7rem;font-size:var(--fs-1);letter-spacing:var(--ls-12);color:var(--tx)}
.cdb--wb .calc-sidebar h4::before{content:"";flex:none;width:3px;height:.85rem;border-radius:2px;background:var(--o)}
.cdb--wb .calc-fgroup{border-bottom-color:var(--hl)}
.cdb--wb .calc-fgroup label,.cdb--wb .calc-fgroup > div:not([class]){font-size:var(--fs-5)!important}
.cdb--wb .calc-mat-list{margin-top:.5rem;padding:.3rem;border-color:var(--hl);border-radius:8px;background:rgba(0,0,0,.2)}
.cdb--wb .calc-mat-list .calc-check:has(input:checked){background:color-mix(in srgb,var(--o) 12%,transparent);color:var(--tx)}
.cdb--wb #calc-yield-val{font-family:var(--font-display,inherit);font-size:var(--fs-9);font-weight:800;color:var(--o)}
/* Derselbe Regler wie im Rezept (--v setzt crafting-app.js). */
.cdb--wb #calc-yield-rate{--v:.5;--p:calc(9px + (100% - 18px) * var(--v));-webkit-appearance:none;appearance:none;height:24px;margin:0;background:none;cursor:pointer}
.cdb--wb #calc-yield-rate::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--o) var(--p),rgba(255,255,255,.1) var(--p))}
.cdb--wb #calc-yield-rate::-moz-range-track{height:6px;border-radius:3px;background:rgba(255,255,255,.1)}
.cdb--wb #calc-yield-rate::-moz-range-progress{height:6px;border-radius:3px;background:var(--o)}
.cdb--wb #calc-yield-rate::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-6px;border:4px solid var(--o);border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.cdb--wb #calc-yield-rate::-moz-range-thumb{width:10px;height:10px;border:4px solid var(--o);border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.cdb--wb #calc-yield-rate:focus-visible{outline:none}
.cdb--wb #calc-yield-rate:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px var(--e1),0 0 0 5px var(--b)}
.cdb--wb #calc-yield-rate:focus-visible::-moz-range-thumb{box-shadow:0 0 0 3px var(--e1),0 0 0 5px var(--b)}
.cdb--wb .calc-results-wrap h2{font-size:var(--fs-13)!important}
.cdb--wb #calc-results-count{padding:.2rem .7rem;border:1px solid var(--hl);border-radius:999px;font-size:var(--fs-5)!important}
.cdb--wb .calc-search-row{position:relative;margin-bottom:1rem}
.cdb--wb .calc-search-row::before{content:"";position:absolute;left:.8rem;top:50%;z-index:1;width:1.05rem;height:1.05rem;margin-top:-.525rem;background:var(--mu);-webkit-mask:var(--i-search) center/contain no-repeat;mask:var(--i-search) center/contain no-repeat;pointer-events:none;transition:background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .calc-search-row:focus-within::before{background:var(--o)}
.cdb--wb .calc-grid{gap:.6rem}
/* Der Hinweis „Material waehlen“ traegt seine Farben im style-Attribut
   (crafting-app.js, auch fuer die bisherige Seite), daher !important. */
.cdb--wb .calc-grid > div[style]{padding:3rem 1.5rem!important;border-color:var(--hl2)!important;border-radius:10px!important;background:transparent!important}
.cdb--wb .calc-card{gap:1rem;padding:1rem 1.1rem;border:1px solid var(--hl);border-radius:10px;background:linear-gradient(180deg,#24242a,#1f1f25);transition:border-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui),box-shadow var(--dur-base) var(--ease-ui)}
.cdb--wb .calc-card:hover{border-color:var(--hl3);box-shadow:0 14px 28px -18px #000}
.cdb--wb .calc-card.incompatible{border-color:rgba(239,68,68,.22);background:rgba(239,68,68,.03)}
.cdb--wb .calc-card__title{font-size:var(--fs-10)}
.cdb--wb .calc-card__meta{font-size:var(--fs-5)}
.cdb--wb .calc-card__meta strong{color:var(--tx)}
.cdb--wb .calc-card__yield-tag{padding:.14rem .5rem;border:0;border-radius:4px;background:rgba(255,255,255,.07);font-size:var(--fs-4)}
.cdb--wb .calc-card__yield-tag.target{background:color-mix(in srgb,var(--b) 15%,transparent);color:var(--b)}
.cdb--wb .calc-card__right{border-left-color:var(--hl)}
.cdb--wb .calc-card__bp{border-color:var(--hl2);border-radius:8px;color:var(--tx);transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.cdb--wb .calc-card__bp:hover{border-color:color-mix(in srgb,var(--b) 70%,transparent);background:color-mix(in srgb,var(--b) 10%,transparent);color:var(--b)}
@media (min-width:821px){
  .cdb--wb .calc-layout{grid-template-columns:280px 1fr}
}

/* ===== 7 Auftakt und Bewegung ===== */
/* Einmal beim Laden (crafting-app.js setzt wb-auftakt fuer eine Sekunde):
   Leiste, erste Kacheln, Mitte und Planer kommen nacheinander. */
.cdb--wb.wb-auftakt > .cdb-tabs,.cdb--wb.wb-auftakt .cdb-bar{animation:wb-ein .45s var(--out) both}
.cdb--wb.wb-auftakt .cdb-bar{animation-delay:50ms}
.cdb--wb.wb-auftakt .cdb-count-row{animation:wb-ein .45s var(--out) 100ms both}
.cdb--wb.wb-auftakt .cbp:nth-child(-n+10){animation:wb-auf .5s var(--out) both}
.cdb--wb.wb-auftakt .cbp:nth-child(2){animation-delay:30ms}
.cdb--wb.wb-auftakt .cbp:nth-child(3){animation-delay:60ms}
.cdb--wb.wb-auftakt .cbp:nth-child(4){animation-delay:90ms}
.cdb--wb.wb-auftakt .cbp:nth-child(5){animation-delay:120ms}
.cdb--wb.wb-auftakt .cbp:nth-child(6){animation-delay:150ms}
.cdb--wb.wb-auftakt .cbp:nth-child(7){animation-delay:180ms}
.cdb--wb.wb-auftakt .cbp:nth-child(8){animation-delay:210ms}
.cdb--wb.wb-auftakt .cbp:nth-child(n+9){animation-delay:240ms}
@media (min-width:821px){
  .cdb--wb.wb-auftakt > .cdb-modal .cdb-modal__box{animation:wb-ein .55s var(--out) 120ms both}
}
@media (min-width:1180px){
  .cdb--wb.wb-auftakt > .cdb-drawer{animation:wb-ein .55s var(--out) 190ms both}
}
@keyframes wb-ein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@keyframes wb-auf{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes wb-pop{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
@keyframes wb-knall{0%{transform:scale(.4)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes wb-tick{0%{transform:translateY(-.25em);opacity:.3}100%{transform:none;opacity:1}}
@keyframes wb-streif{from{background-position:120% 0}to{background-position:-60% 0}}
@keyframes wb-dreh{to{transform:rotate(360deg)}}
@keyframes wb-emb{from{opacity:0;transform:scale(.6) rotate(-12deg)}to{opacity:1;transform:none}}
@keyframes wb-zieh{from{stroke-dashoffset:277}to{stroke-dashoffset:0}}
@keyframes wb-zeile{0%{opacity:0;transform:translateX(14px);border-color:var(--b)}60%{border-color:var(--b)}100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
  .cdb--wb *,.cdb--wb *::before,.cdb--wb *::after,.cdb--wb.wb-auftakt *{animation:none!important;transition:none!important}
  .wb-flug{display:none}
}

/* ===== 8 Telefon ===== */
@media (max-width:820px){
  .cdb--wb > #cdb-tab-db-content > .cdb-bar{padding:.5rem}
  .cdb--wb .cdb-search-wrap{flex:1 1 9rem}
  .cdb--wb .cdb-sort{flex:1 1 auto}
  .cdb--wb .cdb-sort select{width:100%}
  .cdb--wb .cdb-modal{padding:.5rem;background:rgba(8,8,11,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  .cdb--wb .cdb-modal:not(.is-leer) .cdb-modal__box{animation:wb-blatt .34s var(--out) both}
  /* Das Fenster hat .5rem Rand, und eine klebende Leiste haelt unterhalb
     davon: sie reicht deshalb nach oben bis an die Fensterkante, sonst
     liefe der Inhalt in dem Streifen darueber sichtbar weiter. */
  .cdb--wb .wbr-fest__in{top:calc(-.5rem - 1px);padding-top:calc(1.05rem + 1px);border-radius:0}
  .cdb--wb .wbr-kopf{gap:.8rem;padding:1.1rem 1rem 1rem}
  .cdb--wb .wbr-emb{width:64px;height:64px}
  .cdb--wb .wbr-emb .wg{width:30px;height:30px}
  .cdb--wb .wbr-kenn > div{padding:.6rem .6rem .65rem 1rem}
  .cdb--wb .wbr-inh{padding:1rem 1rem 1.4rem}
  .cdb--wb .cbm__plan{flex:1 1 100%}
  .cdb--wb .cbm__xlink{flex:1 1 auto;justify-content:center}
  .cdb--wb .cdb-planner-open{border-radius:10px;background:color-mix(in srgb,var(--b) 16%,var(--e1));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
}
@keyframes wb-blatt{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
`;
