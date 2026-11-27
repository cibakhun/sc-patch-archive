// Werkzeug-Standard der Seite: Gestalt und Bewegung einer Werkbank, als
// Baukasten fuer jede Seite, die einen Bestand durchsuchbar macht.
//
// Anlass: Krisz 24.11.2026 zu Items und Item Finder: „Schon von der Funktion
// her zusammen bauen zu 1 aber wir können die Möglichkeit nutzen um eine
// richtig geile neuen Standart einführen auf unsere Seite. Wir haben schon
// crafting überarbeitet das ist schon sehr gut gelungen. Mindestens genau so
// gute Arbeit nochmal“.
//
// Herkunft: die Crafting-Werkbank (werkbankCss.ts, werkbankDesign.ts) hat
// Flaechensprache, Zeichen und Bewegung in sechs Runden gefunden. Dort haengt
// alles am Markup von CraftingApp. Hier steht dieselbe Sprache ohne diese
// Bindung: eigene Klassen (.wz-*), eigene Spalten, und was an einer Seite
// haengt (Farben, Texte, Inhalte), steht bei der Seite. Die Items-Werkbank
// ist die erste Seite darauf.
//
// Aufbau:
//   ab 1180 px   Leiste | Treffer | Blatt   (drei Spalten, jede rollt fuer sich)
//   821–1179     Treffer | Blatt, die Gruppen als Chips ueber den Treffern
//   bis 820      Treffer allein, das Blatt kommt von unten
// Auf Fenstern unter 720 px Hoehe laeuft die Seite im Fluss, und das Blatt
// klebt unter der Kopfleiste.
//
// Leitlinien (aus der Crafting-Werkbank uebernommen):
//   - Eine Flaechensprache: Haarlinien statt Rahmenfarben. Die Akzentfarbe
//     (--akz) heisst „das hast du gewaehlt“, die Wertfarbe (--wert) heisst
//     „das ist eine Zahl, auf die es ankommt“ (Preise, Kennwerte).
//   - Zeichen statt Schriftzeichen (werkzeugZeichen.ts, data-g, --i-*).
//   - Bewegung erklaert, was passiert. Nur transform und opacity, kurz, aus
//     bei prefers-reduced-motion. Kein Schein, der dem Zeiger folgt.
//   - Zwei Tempo-Stellschrauben: --zt fuer Auftritte, --zo fuer alles, was
//     sich oft wiederholt; das Skript liest beide.

// Auftakt der Kacheln: Verzug in Lesereihenfolge, der gegen AUF_ENDE auslaeuft
// (gleiche Kurve wie werkbankDesign.ts). Klein: die ersten 12, gross (breit
// oder hoch): bis 96 Kacheln.
const AUF_KACHELN = 96;
const AUF_KLEIN = 12;
const AUF_GROSS_AB = '(min-width:1500px),(min-height:1000px)';
const AUF_ENDE = 420;
const AUF_TAU = 13;
const AUFTAKT_VERZUG = (() => {
  const wert = (k: number) => Math.round((AUF_ENDE * (1 - Math.exp(-(k - 1) / AUF_TAU))) / 6) * 6;
  const regeln: string[] = [];
  let von = 2;
  for (let k = 3; k <= AUF_KACHELN + 1; k++) {
    if (k <= AUF_KACHELN && wert(k) === wert(von)) continue;
    const bis = k - 1;
    const wahl = von === bis ? `:nth-child(${von})` : `:nth-child(n+${von}):nth-child(-n+${bis})`;
    regeln.push(`.wz-gitter.wz-auf > .wz-k${wahl}{--v:${wert(von)}ms}`);
    von = k;
  }
  return regeln.join('\n');
})();

export const WZ_CSS = `
/* ===== 0 Grundwerte ===== */
.wz{
  --e0:#100f16;--e1:#17151f;--e2:#1d1b26;--e3:#25222f;
  --hl:rgba(238,241,245,.08);--hl2:rgba(238,241,245,.15);--hl3:rgba(238,241,245,.28);
  --akz:var(--accent,#A78BFA);--wert:var(--accent-2,#FFB84D);
  --tx:var(--text,#eef1f5);--mu:var(--muted,#9d9cb0);--mu2:#85849a;--ink:#120f1c;
  --ctl:2.45rem;--kc:var(--akz);
  --out:cubic-bezier(.16,1,.3,1);--feder:cubic-bezier(.34,1.5,.5,1);
  --zt:1.5;--zo:1.3;
  --wz-h:calc(100dvh - var(--wz-y,11rem) - .9rem);
  position:relative;
  padding:0 clamp(.75rem,1.6vw,1.5rem);
  font-variant-numeric:tabular-nums;
  background:
    radial-gradient(70rem 26rem at 18% -6rem,color-mix(in srgb,var(--akz) 9%,transparent),transparent 70%),
    linear-gradient(180deg,transparent 0,var(--bg,#0d0c14) 36rem),
    linear-gradient(rgba(238,241,245,.03) 1px,transparent 1px) 0 -1px/100% 44px,
    linear-gradient(90deg,rgba(238,241,245,.03) 1px,transparent 1px) -1px 0/44px 100%;
}
.wz *,.wz *::before,.wz *::after{box-sizing:border-box}
.wz .wi,.wz .wg{display:inline-block;flex:none;width:1em;height:1em;background:currentColor;-webkit-mask:var(--wi) center/contain no-repeat;mask:var(--wi) center/contain no-repeat;vertical-align:-.14em}
.wz .wg{-webkit-mask-image:var(--g);mask-image:var(--g)}
/* Ruecksetzer ohne Gewicht (:where), damit jede Klasse sie ueberstimmt: ein
   .wz button{font:inherit} schlug sonst jede font-size an Knoepfen. */
:where(.wz) button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;cursor:pointer}
/* Seitenblaetter setzen section{padding:…} (assets/detail.css). */
.wz-liste,.wz-blatt{padding:0}
.wz :focus-visible{outline:2px solid var(--akz);outline-offset:2px}
.wz .wz-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
/* Feld mit Zeichen der Art: getoentes Quadrat, Zeichen in der Gruppenfarbe. */
.wz .wz-z{position:relative;flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:7px;background:color-mix(in srgb,var(--kc) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--kc) 28%,transparent);color:var(--kc);transition:background-color var(--dur-fast) var(--ease-ui)}
.wz .wz-z::after{content:"";width:62%;height:62%;background:currentColor;-webkit-mask:var(--g) center/contain no-repeat;mask:var(--g) center/contain no-repeat}

/* ===== 1 Kopf: Reiter und Hilfe ===== */
.wz-kopf{display:flex;align-items:center;justify-content:space-between;gap:.6rem 1rem;flex-wrap:wrap;margin:0 0 .55rem}
.wz-reiter{display:flex;gap:.2rem;min-width:0}
.wz-reiter__b{position:relative;display:inline-flex;align-items:center;gap:.5rem;padding:.6rem .9rem .72rem;border:0;border-radius:6px;background:none;font-family:var(--font-ui,inherit);font-size:var(--fs-8);font-weight:700;letter-spacing:var(--ls-4);text-transform:uppercase;color:var(--mu);transition:color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.wz-reiter__b .wi{width:1.05em;height:1.05em}
.wz-reiter__b em{padding:.05rem .45rem;border-radius:999px;background:rgba(255,255,255,.06);font-size:var(--fs-3);font-style:normal;letter-spacing:0;color:var(--mu)}
.wz-reiter__b::after{content:"";position:absolute;left:.9rem;right:.9rem;bottom:.16rem;height:2px;border-radius:2px;background:var(--akz);box-shadow:0 0 12px color-mix(in srgb,var(--akz) 70%,transparent);transform:scaleX(0);opacity:0;transition:transform var(--dur-slow) var(--out),opacity var(--dur-fast) linear}
.wz-reiter__b:hover{color:var(--tx);background:rgba(255,255,255,.035)}
.wz-reiter__b[aria-selected="true"]{color:var(--akz)}
.wz-reiter__b[aria-selected="true"] em{background:color-mix(in srgb,var(--akz) 16%,transparent);color:var(--akz)}
.wz-reiter__b[aria-selected="true"]::after{transform:scaleX(1);opacity:1}
.wz-hilfe{position:relative;z-index:40}
.wz-hilfe > summary{display:inline-flex;align-items:center;gap:.45rem;padding:.4rem .85rem .4rem .6rem;border:1px solid var(--hl);border-radius:999px;font-size:var(--fs-7);color:var(--mu);list-style:none;cursor:pointer;white-space:nowrap;transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.wz-hilfe > summary::-webkit-details-marker{display:none}
.wz-hilfe__kurz{display:none}
.wz-hilfe > summary .wi{width:1.1em;height:1.1em;color:var(--akz)}
.wz-hilfe > summary:hover,.wz-hilfe[open] > summary{border-color:var(--hl3);background:rgba(255,255,255,.035);color:var(--tx)}
.wz-hilfe__in{position:absolute;top:calc(100% + .45rem);right:0;width:min(30rem,calc(100vw - 2rem));padding:1rem 1.1rem 1.1rem;border:1px solid var(--hl2);border-radius:12px;background:var(--e1);box-shadow:0 30px 70px -20px #000,0 0 0 1px rgba(0,0,0,.4);transform-origin:100% 0;animation:wz-pop var(--dur-base) var(--out)}
.wz-hilfe__in p{margin:0 0 .7rem;color:var(--mu);font-size:var(--fs-7);line-height:1.55}
.wz-hilfe__in ol{display:grid;gap:.5rem;margin:0;padding:0;list-style:none;counter-reset:wzh}
.wz-hilfe__in li{display:grid;grid-template-columns:1.6rem 1fr;gap:.5rem;align-items:start;font-size:var(--fs-7);line-height:1.5;color:var(--tx);counter-increment:wzh}
.wz-hilfe__in li::before{content:counter(wzh);display:grid;place-items:center;width:1.45rem;height:1.45rem;border-radius:6px;background:color-mix(in srgb,var(--akz) 16%,transparent);font-size:var(--fs-3);font-weight:800;color:var(--akz)}
.wz-hilfe__in kbd{padding:.02rem .35rem;border:1px solid var(--hl2);border-bottom-width:2px;border-radius:4px;background:var(--e0);font-family:inherit;font-size:var(--fs-3)}

/* ===== 2 Bedienleiste ===== */
.wz-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-bottom:.8rem;padding:.5rem;border:1px solid var(--hl);border-radius:12px;background:var(--e1);box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 18px 40px -30px #000}
.wz-knopf{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;height:var(--ctl);padding:0 .95rem 0 .8rem;border:1px solid var(--hl2);border-radius:8px;background:var(--e2);font-size:var(--fs-7);font-weight:700;letter-spacing:var(--ls-5);color:var(--tx);white-space:nowrap;transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.wz-knopf .wi{width:1.1em;height:1.1em}
.wz-knopf:hover{border-color:var(--hl3);background:var(--e3)}
.wz-knopf:active{transform:scale(.97)}
.wz-filterknopf[data-n]{border-color:color-mix(in srgb,var(--akz) 60%,transparent);color:var(--akz)}
.wz-filterknopf[data-n]::after{content:attr(data-n);display:grid;place-items:center;min-width:1.25rem;height:1.25rem;padding:0 .3rem;border-radius:999px;background:var(--akz);color:var(--ink);font-size:var(--fs-3);font-weight:800;animation:wz-knall var(--dur-slow) var(--feder)}
.wz-suche{position:relative;flex:1 1 14rem;min-width:0;margin:0}
.wz-suche > .wi{position:absolute;left:.8rem;top:50%;width:1.05rem;height:1.05rem;margin-top:-.525rem;color:var(--mu);pointer-events:none;transition:color var(--dur-fast) var(--ease-ui)}
.wz-suche:focus-within > .wi{color:var(--akz)}
.wz-suche input{width:100%;height:var(--ctl);padding:0 4.4rem 0 2.5rem;border:1px solid var(--hl2);border-radius:8px;background:var(--e0);font:inherit;font-size:var(--fs-8);color:var(--tx);-webkit-appearance:none;appearance:none;transition:border-color var(--dur-fast) var(--ease-ui),box-shadow var(--dur-fast) var(--ease-ui)}
.wz-suche input::placeholder{color:var(--mu2)}
.wz-suche input::-webkit-search-cancel-button{display:none}
.wz-suche input:hover{border-color:var(--hl3)}
.wz-suche input:focus{outline:none;border-color:var(--akz);box-shadow:0 0 0 3px color-mix(in srgb,var(--akz) 24%,transparent)}
.wz-suche kbd{position:absolute;right:.6rem;top:50%;transform:translateY(-50%);padding:.05rem .4rem;border:1px solid var(--hl2);border-bottom-width:2px;border-radius:5px;font-family:inherit;font-size:var(--fs-3);color:var(--mu2);pointer-events:none;transition:opacity var(--dur-fast) var(--ease-ui)}
.wz-suche:focus-within kbd,.wz-suche.hat-text kbd{opacity:0}
/* Ohne Tastatur keine Tastenmarke: der Platz geht an den Platzhalter. */
@media (hover:none) and (pointer:coarse){.wz-suche kbd{display:none}.wz-suche input{padding-right:2.6rem}}
.wz-leeren{position:absolute;right:.4rem;top:50%;display:none;place-items:center;width:1.8rem;height:1.8rem;margin-top:-.9rem;border:0;border-radius:6px;background:none;color:var(--mu)}
.wz-leeren .wi{width:.95rem;height:.95rem}
.wz-leeren:hover{background:var(--e3);color:var(--tx)}
.wz-suche.hat-text .wz-leeren{display:grid}
.wz-sort select{height:var(--ctl);padding:0 2.1rem 0 .8rem;border:1px solid var(--hl2);border-radius:8px;background:var(--e2) var(--bi-chev) right .6rem center/1rem no-repeat;-webkit-appearance:none;appearance:none;font:inherit;font-size:var(--fs-7);color:var(--tx);cursor:pointer;transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.wz-sort select:hover{border-color:var(--hl3);background-color:var(--e3)}
.wz-ansicht{display:inline-flex;height:var(--ctl);padding:3px;gap:2px;border:1px solid var(--hl2);border-radius:8px;background:var(--e0)}
.wz-ansicht button{display:grid;place-items:center;width:calc(var(--ctl) - 8px);height:100%;padding:0;border:0;border-radius:5px;background:transparent;color:var(--mu);transition:color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),box-shadow var(--dur-fast) var(--ease-ui)}
.wz-ansicht button .wi{width:1.05rem;height:1.05rem}
.wz-ansicht button:hover{color:var(--tx)}
.wz-ansicht button[aria-pressed="true"]{background:color-mix(in srgb,var(--akz) 17%,transparent);color:var(--akz);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--akz) 55%,transparent)}

/* ===== 3 Leiste der Gruppen (ab 1180 px) ===== */
.wz-rail{display:none}
.wz-rail__alle,.wz-gr__kopf,.wz-gr__liste a{display:flex;align-items:center;gap:.6rem;width:100%;border:0;border-radius:8px;background:none;color:var(--tx);text-decoration:none;text-align:left;transition:background-color var(--dur-fast) var(--ease-ui),color var(--dur-fast) var(--ease-ui)}
.wz-rail em,.wz-chips em{margin-left:auto;padding:0 .4rem;border-radius:999px;background:rgba(255,255,255,.06);font-size:var(--fs-2);font-style:normal;font-weight:600;color:var(--mu);transition:background-color var(--dur-fast) var(--ease-ui),color var(--dur-fast) var(--ease-ui)}
.wz-rail__alle{padding:.55rem .6rem;margin-bottom:.35rem;font-size:var(--fs-7);font-weight:700}
.wz-rail__alle .wz-z{--kc:var(--akz)}
.wz-gr{position:relative;border-top:1px solid var(--hl)}
.wz-gr__kopf{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"z n c" "z e c";gap:.05rem .6rem;padding:.48rem .55rem;font-size:var(--fs-7);font-weight:700;line-height:1.2}
.wz-gr__kopf > .wz-z{grid-area:z}
.wz-gr__kopf > span:not([class]){grid-area:n;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wz-rail .wz-gr__kopf > em{grid-area:e;justify-self:start;margin:0;padding:0;background:none;font-size:var(--fs-2);font-weight:600;letter-spacing:var(--ls-5);color:var(--mu)}
.wz-rail .wz-gr__kopf.is-an > em{background:none}
.wz-gr__kopf > .wi{grid-area:c;width:.85rem;height:.85rem;color:var(--mu2);transition:transform var(--dur-base) var(--out)}
.wz-gr__kopf[aria-expanded="true"] > .wi{transform:rotate(180deg)}
.wz-gr__liste{display:none;margin:0 0 .45rem;padding:0 0 0 1.35rem;list-style:none}
.wz-gr.is-offen .wz-gr__liste{display:block;animation:wz-nach calc(.24s*var(--zo)) var(--out)}
.wz-gr__liste a{position:relative;padding:.36rem .6rem .36rem .8rem;font-size:var(--fs-6);line-height:1.25;color:#c9c8d6}
.wz-gr__liste a > span{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.wz-gr__liste a::before{content:"";position:absolute;left:0;top:.45rem;bottom:.45rem;width:2px;border-radius:2px;background:var(--hl2);transition:background-color var(--dur-fast) var(--ease-ui),transform var(--dur-base) var(--out)}
.wz-rail__alle:hover,.wz-gr__kopf:hover,.wz-gr__liste a:hover{background:rgba(255,255,255,.04);color:var(--tx)}
.wz-gr__liste a:hover::before{background:var(--kc)}
/* Gewaehlt: Gruppe in ihrer Farbe, Kategorie mit Kante und Hauch. */
.wz-rail__alle.is-an,.wz-gr__kopf.is-an{background:color-mix(in srgb,var(--kc) 12%,transparent);color:var(--tx)}
.wz-rail__alle.is-an em,.wz-gr__kopf.is-an em{background:color-mix(in srgb,var(--kc) 22%,transparent);color:var(--kc)}
.wz-gr__liste a.is-an{background:color-mix(in srgb,var(--kc) 12%,transparent);color:var(--tx);font-weight:700}
.wz-gr__liste a.is-an::before{background:var(--kc);box-shadow:0 0 10px color-mix(in srgb,var(--kc) 70%,transparent)}
.wz-gr__liste a.is-an em{background:color-mix(in srgb,var(--kc) 22%,transparent);color:var(--kc)}

/* ===== 3b Chips der Gruppen (unter 1180 px) ===== */
.wz-chips{display:grid;gap:.45rem;margin:0 0 .7rem}
.wz-chips__reihe{display:flex;gap:.4rem;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;padding:1px}
.wz-chips__reihe::-webkit-scrollbar{display:none}
.wz-chip{display:inline-flex;align-items:center;gap:.45rem;flex:none;height:2.2rem;padding:0 .75rem 0 .45rem;border:1px solid var(--hl2);border-radius:999px;background:var(--e1);font-size:var(--fs-6);font-weight:700;color:var(--tx);white-space:nowrap;transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.wz-chip .wz-z{width:24px;height:24px;border-radius:999px}
.wz-chip em{margin-left:.15rem}
.wz-chip:hover{border-color:var(--hl3)}
.wz-chip:active{transform:scale(.96)}
.wz-chip.is-an{border-color:color-mix(in srgb,var(--kc) 70%,transparent);background:color-mix(in srgb,var(--kc) 14%,var(--e1))}
.wz-chip.is-an em{background:color-mix(in srgb,var(--kc) 24%,transparent);color:var(--kc)}
.wz-chip--blatt{height:2rem;padding:0 .7rem;font-weight:600;color:#c9c8d6}

/* ===== 4 Treffer ===== */
.wz-liste{min-width:0}
.wz-zahl{display:flex;flex-wrap:wrap;align-items:baseline;gap:.35rem .6rem;margin-bottom:.6rem;font-size:var(--fs-3);letter-spacing:var(--ls-11);text-transform:uppercase;color:var(--mu)}
.wz-zahl b{display:inline-block;font-family:var(--font-display,inherit);font-size:var(--fs-11);letter-spacing:var(--ls-3);color:var(--akz)}
.wz-zahl b.is-tick{animation:wz-tick calc(var(--dur-slow)*var(--zo)) var(--out)}
.wz-zahl::after{content:"";flex:1 1 2rem;height:1px;align-self:center;background:linear-gradient(90deg,var(--hl2),transparent)}
.wz-aktiv{display:contents}
.wz-fchip{display:inline-flex;align-items:center;gap:.35rem;height:1.6rem;padding:0 .3rem 0 .6rem;border:1px solid color-mix(in srgb,var(--kc) 55%,transparent);border-radius:999px;background:color-mix(in srgb,var(--kc) 12%,transparent);font-size:var(--fs-3);font-weight:700;letter-spacing:var(--ls-5);text-transform:none;color:var(--tx);align-self:center;animation:wz-knall var(--dur-base) var(--feder)}
.wz-fchip .wi{width:.8rem;height:.8rem;color:var(--mu)}
.wz-fchip:hover .wi{color:var(--tx)}
.wz-gitter{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(222px,100%),1fr));align-content:start;gap:.7rem;padding:2px 2px 1rem;margin:-2px}
.wz-gitter.is-liste{grid-template-columns:1fr;gap:.4rem}
/* Gerollte Liste: weiche Oberkante (is-oben setzt das Skript); die Unterkante
   kommt von der Seite (is-more-y, mobile-ux.css). Beide zusammen brauchen
   eine Maske, zwei Masken ueberschrieben einander. */
.wz-gitter.is-oben{-webkit-mask-image:linear-gradient(180deg,transparent,#000 26px);mask-image:linear-gradient(180deg,transparent,#000 26px)}
.wz-gitter.is-oben[data-edgefade-y].is-more-y{-webkit-mask-image:linear-gradient(180deg,transparent,#000 26px,#000 calc(100% - 40px),transparent);mask-image:linear-gradient(180deg,transparent,#000 26px,#000 calc(100% - 40px),transparent)}

/* Kachel */
.wz-k{position:relative;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:.45rem;min-width:0;padding:.8rem .85rem .8rem;border:1px solid var(--hl);border-radius:9px;background:linear-gradient(180deg,#211e2b,#1b1925);cursor:pointer;transition:border-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui),box-shadow var(--dur-base) var(--ease-ui)}
.wz-k::before{content:"";position:absolute;left:0;top:.7rem;bottom:.7rem;width:2px;border-radius:0 2px 2px 0;background:var(--kc);transform:scaleY(0);transform-origin:50% 0;transition:transform var(--dur-base) var(--out)}
.wz-k:hover{border-color:var(--hl3);transform:translateY(-2px);box-shadow:0 14px 28px -18px #000}
.wz-k:hover::before,.wz-k.is-sel::before{transform:scaleY(1)}
.wz-k:hover .wz-z{background:color-mix(in srgb,var(--kc) 22%,transparent)}
.wz-k:active:not(:has(button:active)){transform:scale(.988);transition-duration:var(--dur-fast)}
.wz-k.is-sel,.wz-k.is-sel:hover{border-color:var(--akz);background:linear-gradient(100deg,color-mix(in srgb,var(--akz) 15%,#1f1c29),#1f1c29 62%);box-shadow:0 0 0 1px var(--akz),0 16px 34px -18px color-mix(in srgb,var(--akz) 65%,transparent)}
.wz-k.is-sel::before{background:var(--akz)}
.wz-k.is-sel::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.09) 50%,transparent 70%) -60% 0/250% 100% no-repeat;animation:wz-streif calc(.7s*var(--zo)) var(--out) both;pointer-events:none}
@media (hover:hover) and (pointer:fine){
  .wz-k:not(.is-sel)::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(260px circle at 50% 0,color-mix(in srgb,var(--kc) 14%,transparent),transparent 70%);opacity:0;transition:opacity var(--dur-slow) var(--ease-ui);pointer-events:none}
  .wz-k:not(.is-sel):hover::after{opacity:1}
}
.wz-k__kopf{display:flex;align-items:center;gap:.6rem;min-height:30px}
.wz-k__pfad{display:flex;flex-direction:column;gap:.05rem;min-width:0;margin-right:auto;font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-10);line-height:1.2;text-transform:uppercase;color:var(--kc)}
.wz-k__pfad span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wz-k__pfad span + span{font-weight:600;color:var(--mu)}
.wz-k__wert{flex:none;padding:.12rem .45rem;border-radius:4px;background:color-mix(in srgb,var(--wert) 13%,transparent);font-size:var(--fs-3);font-weight:800;letter-spacing:var(--ls-3);color:var(--wert);white-space:nowrap}
.wz-k__name{margin:0;font-family:var(--font-display,inherit);font-size:var(--fs-9);font-weight:800;line-height:1.18;text-wrap:balance;hyphens:manual;overflow-wrap:break-word}
.wz-k__name a{color:inherit;text-decoration:none}
.wz-k__name a:focus-visible{outline:none}
.wz-k:has(.wz-k__name a:focus-visible),.wz-k:focus-visible{outline:2px solid var(--akz);outline-offset:2px}
.wz-k__name mark,.wz-reihe mark{padding:0 .05em;border-radius:3px;background:color-mix(in srgb,var(--akz) 28%,transparent);color:#fff}
.wz-k__alt{margin:-.25rem 0 0;font-size:var(--fs-4);color:var(--mu2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wz-k__meta{margin:0;font-size:var(--fs-4);color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wz-k__tags{display:flex;flex-wrap:wrap;gap:.3rem;margin:0;padding:0;list-style:none}
.wz-tag{display:inline-flex;align-items:center;gap:.3rem;padding:.12rem .45rem;border:0;border-radius:4px;background:rgba(255,255,255,.07);font-size:var(--fs-3);font-weight:700;letter-spacing:var(--ls-5);color:var(--tx);white-space:nowrap}
button.wz-tag{transition:background-color var(--dur-fast) var(--ease-ui),color var(--dur-fast) var(--ease-ui)}
button.wz-tag:hover{background:color-mix(in srgb,var(--akz) 20%,transparent);color:#fff}
.wz-tag .wi{width:.85em;height:.85em}
.wz-tag[data-sel]::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--sel,#9ba2ae);box-shadow:0 0 6px var(--sel,#9ba2ae)}
.wz [data-sel="Common"]{--sel:#a9adb8}
.wz [data-sel="Uncommon"]{--sel:#7BD88F}
.wz [data-sel="Rare"]{--sel:#4DB2FF}
.wz [data-sel="Epic"]{--sel:#B58CFF}
.wz [data-sel="Legendary"]{--sel:#FFB84D}
.wz-k__fuss{display:flex;align-items:baseline;gap:.4rem .7rem;flex-wrap:wrap;margin-top:auto;padding-top:.5rem;border-top:1px dashed var(--hl2);font-size:var(--fs-4)}
.wz-k__preis{font-weight:800;color:var(--wert);white-space:nowrap}
.wz-k__preis small{margin-left:.35rem;font-size:var(--fs-3);font-weight:600;color:var(--mu2)}
.wz-k__preis.is-still{font-weight:600;color:var(--mu)}
.wz-k__ort{display:flex;align-items:baseline;gap:.3rem;min-width:0;margin-left:auto;color:#c3c2d0}
.wz-k__ort > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wz-k__ort .wi{align-self:center;width:.8rem;height:.8rem;color:var(--mu2)}
.wz-k__ort i{flex:none;font-style:normal;font-weight:700;color:var(--mu)}
.wz-k__ort.is-still{color:var(--mu2)}
/* Listenansicht: eine Zeile je Treffer. */
.wz-gitter.is-liste .wz-k{display:grid;grid-template-columns:30px minmax(0,1fr) auto;grid-template-areas:"z name fuss" "z meta fuss";align-items:center;gap:.15rem .8rem;padding:.55rem .8rem}
.wz-gitter.is-liste .wz-k__kopf{display:contents}
.wz-gitter.is-liste .wz-z{grid-area:z}
.wz-gitter.is-liste .wz-k__pfad,.wz-gitter.is-liste .wz-k__tags,.wz-gitter.is-liste .wz-k__alt{display:none}
.wz-gitter.is-liste .wz-k__wert{display:none}
.wz-gitter.is-liste .wz-k__name{grid-area:name;font-size:var(--fs-8);text-wrap:wrap}
.wz-gitter.is-liste .wz-k__meta{grid-area:meta}
.wz-gitter.is-liste .wz-k__fuss{grid-area:fuss;flex-direction:column;align-items:flex-end;gap:.15rem;margin:0;padding:0;border:0;text-align:right}
.wz-gitter.is-liste .wz-k__ort{margin-left:0;max-width:16rem}
/* Platzhalter, solange der Katalog laedt. */
.wz-k--leer{min-height:9.6rem;cursor:default;background:linear-gradient(180deg,#1d1b26,#191722)}
.wz-k--leer::before{display:none}
.wz-k--leer i{display:block;height:.7rem;border-radius:4px;background:rgba(255,255,255,.06);animation:wz-atem 1.1s ease-in-out infinite alternate}
.wz-k--leer i:nth-child(1){width:42%}
.wz-k--leer i:nth-child(2){width:86%;height:1rem;margin-top:.35rem}
.wz-k--leer i:nth-child(3){width:64%}
.wz-k--leer i:nth-child(4){width:100%;margin-top:auto}
.wz-gitter.is-liste .wz-k--leer{display:flex;min-height:3.6rem}
.wz-gitter.is-liste .wz-k--leer i:nth-child(n+3){display:none}
.wz-mehr{grid-column:1 / -1;height:1px}
.wz-leer{grid-column:1 / -1;display:grid;justify-items:center;gap:.5rem;padding:3rem 1rem;border:1px dashed var(--hl2);border-radius:12px;text-align:center}
.wz-leer b{font-family:var(--font-display,inherit);font-size:var(--fs-11);color:var(--tx)}
.wz-leer p{max-width:36ch;margin:0;color:var(--mu);font-size:var(--fs-7);line-height:1.5}
.wz-leer .wz-knopf{margin-top:.4rem}

/* ===== 5 Blatt (Mitte bzw. rechts) ===== */
.wz-blatt{display:none;min-width:0}
.wz-blatt__box{position:relative;border:1px solid var(--hl2);border-radius:12px;background:var(--e1);box-shadow:0 30px 70px -40px #000,inset 0 1px 0 rgba(255,255,255,.05);container:wzb / inline-size}
.wz-blatt__box:focus-visible{outline:none}
.wz-blatt__x,.wz-blatt__zur{position:sticky;top:.75rem;z-index:6;display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid var(--hl2);border-radius:8px;background:rgba(0,0,0,.35);color:var(--mu);transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.wz-blatt__x{margin:.75rem .75rem calc(-32px - .75rem) auto}
.wz-blatt__x .wi,.wz-blatt__zur .wi{width:15px;height:15px}
.wz-blatt__x:hover,.wz-blatt__zur:hover{color:var(--tx);border-color:var(--hl3);background:var(--e3)}
.wz-blatt__x:active,.wz-blatt__zur:active{transform:scale(.92)}
.wz-blatt__zur{display:inline-flex;gap:.4rem;width:auto;max-width:calc(100% - 5rem);height:32px;margin:.75rem 0 calc(-32px - .75rem) .75rem;padding:0 .7rem 0 .55rem;font-size:var(--fs-4);font-weight:700;white-space:nowrap;overflow:hidden}
.wz-blatt__zur span{overflow:hidden;text-overflow:ellipsis}
.wz-blatt__zur[hidden]{display:none}
.wz-blatt__inh.is-frisch{animation:wz-nach calc(.28s*var(--zo)) var(--out)}
/* Weicher Auslauf unten, solange das Blatt rollt. */
.wz-blatt__box::after{content:"";position:sticky;bottom:0;z-index:4;display:block;height:24px;margin-top:-24px;border-radius:0 0 12px 12px;background:linear-gradient(180deg,transparent,var(--e1));pointer-events:none}
/* Kopf: Emblem vor Bauplanraster, Pfad, Name, Merkmale. */
.wzb-kopf{position:relative;display:flex;align-items:center;gap:1.1rem;padding:1.35rem 3.4rem 1.2rem 1.4rem;border-bottom:1px solid var(--hl);border-radius:12px 12px 0 0;overflow:hidden;background:
  radial-gradient(70% 150% at 0 0,color-mix(in srgb,var(--kc) 17%,transparent),transparent 72%),
  linear-gradient(rgba(238,241,245,.045) 1px,transparent 1px) 0 0/100% 22px,
  linear-gradient(90deg,rgba(238,241,245,.045) 1px,transparent 1px) 0 0/22px 100%,
  #1c1a25}
.wz-blatt__box:has(.wz-blatt__zur:not([hidden])) .wzb-kopf{padding-top:3.4rem}
.wzb-kopf::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,var(--kc),transparent 55%)}
.wzb-emb{position:relative;flex:none;display:grid;place-items:center;width:84px;height:84px;color:var(--kc)}
.wzb-emb svg{position:absolute;inset:0;width:100%;height:100%}
.wzb-emb .wg{width:40px;height:40px;filter:drop-shadow(0 0 10px color-mix(in srgb,var(--kc) 55%,transparent))}
.wzb-ring__a{stroke:var(--hl3);stroke-width:1;stroke-dasharray:2 7;transform-origin:50% 50%;animation:wz-dreh 70s linear infinite}
.wzb-ring__b{stroke:currentColor;stroke-width:1.2;opacity:.55;stroke-dasharray:277;animation:wz-zieh calc(.7s*var(--zt)) var(--out) both}
.wzb-ring__c{stroke:currentColor;stroke-width:1.5;stroke-linecap:round;opacity:.9}
.wzb-kopf__t{flex:1;min-width:0}
.wzb-pfad{display:flex;flex-wrap:wrap;gap:.15rem .5rem;margin:0;font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-12);text-transform:uppercase;color:var(--kc)}
.wzb-pfad span{white-space:nowrap}
.wzb-pfad span:not(:last-child)::after{content:"/";margin-left:.5rem;opacity:.5}
.wzb-pfad button{padding:0;border:0;background:none;letter-spacing:inherit;text-transform:inherit;font-weight:inherit;color:inherit;border-bottom:1px solid transparent}
.wzb-pfad button:hover{border-bottom-color:currentColor}
.wzb-name{margin:.3rem 0 0;font-family:var(--font-display,inherit);font-size:clamp(1.25rem,1.9vw,1.65rem);font-weight:800;line-height:1.12;text-wrap:balance;hyphens:manual;overflow-wrap:break-word;color:var(--tx)}
.wzb-alt{margin:.25rem 0 0;font-size:var(--fs-5);color:var(--mu)}
.wzb-chips{display:flex;flex-wrap:wrap;gap:.3rem;margin:.6rem 0 0;padding:0;list-style:none}
/* Kennwerte als Zeile gleich grosser Felder. */
.wzb-kenn{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(6rem,100%),1fr));border-bottom:1px solid var(--hl);background:rgba(0,0,0,.16)}
.wzb-kenn > div{display:flex;flex-direction:column;gap:.25rem;min-width:0;padding:.7rem .6rem .75rem 1.1rem;border-left:1px solid var(--hl)}
.wzb-kenn > div:first-child{border-left:0}
.wzb-kenn span{overflow:hidden;font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-8);text-transform:uppercase;text-overflow:ellipsis;white-space:nowrap;color:var(--mu)}
.wzb-kenn b{font-family:var(--font-display,inherit);font-size:var(--fs-11);font-weight:800;line-height:1.1;color:var(--tx);overflow-wrap:anywhere}
.wzb-kenn b.is-wert{color:var(--wert)}
.wzb-kenn b small{display:inline-block;margin-left:.2rem;font-family:var(--font-ui,inherit);font-size:var(--fs-4);font-weight:700;color:var(--mu);white-space:nowrap}
.wzb-kenn b.is-txt{font-family:var(--font-ui,inherit);font-size:var(--fs-9);line-height:1.25;overflow-wrap:normal;hyphens:auto}
.wzb-inh{padding:1.1rem 1.4rem 1.6rem}
.wzb-akt{display:flex;flex-wrap:wrap;gap:.5rem}
.wzb-haupt{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.45rem;flex:1 1 100%;height:2.7rem;padding:0 1.1rem;border:0;border-radius:8px;overflow:hidden;background:var(--akz);color:var(--ink);font-size:var(--fs-7);font-weight:800;letter-spacing:var(--ls-4);text-decoration:none;box-shadow:0 10px 24px -12px color-mix(in srgb,var(--akz) 80%,transparent);transition:background-color var(--dur-fast) var(--ease-ui),box-shadow var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.wzb-haupt:hover{background:color-mix(in srgb,var(--akz) 86%,#fff);box-shadow:0 14px 28px -12px color-mix(in srgb,var(--akz) 90%,transparent)}
.wzb-haupt:active{transform:scale(.98)}
.wzb-haupt .wi{width:1.05em;height:1.05em}
.wzb-haupt::after{content:"";position:absolute;top:0;bottom:0;left:0;width:38%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.34),transparent);transform:translateX(-130%) skewX(-14deg);pointer-events:none}
@media (hover:hover){
  .wzb-haupt:hover::after{transform:translateX(330%) skewX(-14deg);transition:transform .65s cubic-bezier(.45,0,.3,1)}
}
.wzb-neben{display:inline-flex;align-items:center;gap:.6rem;flex:1 1 11rem;min-height:2.4rem;padding:.3rem .8rem .3rem .9rem;border:1px solid var(--hl2);border-radius:8px;background:none;color:var(--tx);font-size:var(--fs-5);font-weight:700;line-height:1.25;text-align:left;text-decoration:none;transition:color var(--dur-fast) var(--ease-ui),border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.wzb-neben > span{min-width:0;margin-right:auto}
.wzb-neben .wi{color:var(--mu)}
.wzb-neben .wi--arrow{margin-left:auto;color:var(--akz);transition:transform var(--dur-base) var(--out)}
.wzb-neben:hover{border-color:color-mix(in srgb,var(--akz) 70%,transparent);background:color-mix(in srgb,var(--akz) 10%,transparent);color:var(--akz)}
.wzb-neben:hover .wi--arrow{transform:translateX(3px)}
.wzb-h{display:flex;align-items:center;gap:.6rem;margin:1.6rem 0 .7rem;padding:0;font-size:var(--fs-2);font-weight:700;letter-spacing:var(--ls-12);text-transform:uppercase;color:var(--tx)}
.wzb-h::before{content:"";flex:none;width:3px;height:.95rem;border-radius:2px;background:var(--akz)}
.wzb-h::after{content:"";flex:1;height:1px;background:var(--hl)}
.wzb-h em{padding:.05rem .45rem;border-radius:999px;background:rgba(255,255,255,.08);font-size:var(--fs-2);font-style:normal;letter-spacing:0;color:var(--mu)}
/* Bezugsquellen: eine Zeile je Ort, Art als Zeichen, Preis als Marke. */
.wzb-q{list-style:none;display:grid;gap:.35rem;margin:0;padding:0}
.wzb-q li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.7rem;padding:.55rem .7rem;border:1px solid var(--hl);border-radius:8px;background:var(--e2);transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.wzb-q li:hover{border-color:var(--hl2)}
.wzb-q__z{display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.06);color:var(--mu)}
.wzb-q__z .wi{width:16px;height:16px}
.wzb-q li[data-art="shop"] .wzb-q__z,.wzb-q li[data-art="vehicle"] .wzb-q__z{background:color-mix(in srgb,var(--wert) 13%,transparent);color:var(--wert)}
.wzb-q li[data-art="loot"] .wzb-q__z{background:color-mix(in srgb,#7BD88F 14%,transparent);color:#7BD88F}
.wzb-q li[data-art="exclusive"] .wzb-q__z{background:color-mix(in srgb,var(--akz) 15%,transparent);color:var(--akz)}
.wzb-q__t{display:flex;flex-direction:column;gap:.1rem;min-width:0}
.wzb-q__t b{font-size:var(--fs-7);font-weight:700;color:var(--tx);overflow-wrap:anywhere}
.wzb-q__t small{font-size:var(--fs-3);color:var(--mu);line-height:1.4}
.wzb-q__p{display:flex;flex-direction:column;align-items:flex-end;gap:.15rem;text-align:right}
.wzb-q__p b{padding:.08rem .45rem;border-radius:4px;background:color-mix(in srgb,var(--wert) 14%,transparent);font-size:var(--fs-5);font-weight:800;color:var(--wert);white-space:nowrap}
.wzb-q__p .wzb-st{padding:.05rem .4rem;border-radius:4px;background:rgba(255,255,255,.06);font-size:var(--fs-2);font-weight:700;letter-spacing:var(--ls-5);color:var(--mu);white-space:nowrap}
.wzb-q__p .wzb-st.is-ok{background:color-mix(in srgb,#7BD88F 14%,transparent);color:#7BD88F}
.wzb-q__p .wzb-art{font-size:var(--fs-2);font-weight:700;letter-spacing:var(--ls-8);text-transform:uppercase;color:var(--mu2)}
.wzb-note{margin:.7rem 0 0;padding-left:.7rem;border-left:2px solid var(--hl2);font-size:var(--fs-4);line-height:1.55;color:var(--mu)}
.wzb-note--wert{border-left-color:var(--wert)}
/* Werte: Bezeichnung klein oben, Wert darunter. */
.wzb-werte{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(8.6rem,100%),1fr));gap:.45rem}
.wzb-wert{display:flex;flex-direction:column;gap:.2rem;padding:.55rem .75rem .6rem;border:1px solid var(--hl);border-radius:8px;background:var(--e2)}
.wzb-wert span{font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-10);text-transform:uppercase;color:var(--mu)}
.wzb-wert b{font-size:var(--fs-8);font-weight:700;color:var(--tx);overflow-wrap:anywhere}
.wzb-text{margin:0;font-size:var(--fs-7);line-height:1.6;color:#cfcedb;white-space:pre-line}
.wzb-var{display:grid;gap:.6rem}
.wzb-var > div{padding:.7rem .8rem;border:1px solid var(--hl);border-radius:10px;background:rgba(0,0,0,.14)}
.wzb-var h4{margin:0 0 .5rem;font-size:var(--fs-6);font-weight:800;color:var(--tx)}
/* Zeilen, die ein anderes Item oeffnen (Set, Rezept). */
.wzb-zeilen{list-style:none;display:grid;gap:.3rem;margin:0;padding:0}
.wzb-zeile{display:flex;align-items:center;gap:.7rem;width:100%;padding:.45rem .7rem .45rem .5rem;border:1px solid var(--hl);border-radius:8px;background:var(--e2);color:var(--tx);font-size:var(--fs-7);text-align:left;text-decoration:none;transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.wzb-zeile .wz-z{width:26px;height:26px;border-radius:6px}
.wzb-zeile > span:not(.wz-z):not(.wi){display:flex;flex-direction:column;gap:.05rem;min-width:0;margin-right:auto}
.wzb-zeile small{font-size:var(--fs-2);font-weight:700;letter-spacing:var(--ls-8);text-transform:uppercase;color:var(--mu)}
.wzb-zeile > .wi{color:var(--mu2);transition:transform var(--dur-base) var(--out),color var(--dur-fast) var(--ease-ui)}
.wzb-zeile:hover{border-color:color-mix(in srgb,var(--akz) 55%,transparent);background:color-mix(in srgb,var(--akz) 7%,var(--e2))}
.wzb-zeile:hover > .wi{color:var(--akz);transform:translateX(3px)}
.wzb-zeile.is-hier{border-color:color-mix(in srgb,var(--akz) 55%,transparent);background:color-mix(in srgb,var(--akz) 10%,var(--e2))}
.wzb-craft{display:grid;gap:.5rem}
.wzb-craft__kopf{display:flex;flex-wrap:wrap;gap:.4rem}
.wzb-craft ul{list-style:none;display:grid;gap:.3rem;margin:0;padding:0}
.wzb-craft li{display:flex;flex-wrap:wrap;gap:.2rem .6rem;padding:.45rem .7rem;border:1px solid var(--hl);border-radius:8px;background:var(--e2);font-size:var(--fs-6)}
.wzb-craft li b{font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-10);text-transform:uppercase;color:var(--mu)}
.wzb-guide{margin:0;padding:.75rem .9rem;border:1px solid var(--hl);border-left:2px solid var(--wert);border-radius:8px;background:rgba(0,0,0,.14);font-size:var(--fs-6);line-height:1.55;color:#cfcedb}
.wzb-warte{display:flex;align-items:center;gap:.5rem;font-size:var(--fs-5);color:var(--mu)}
.wzb-warte::before{content:"";width:14px;height:14px;border:2px solid var(--hl2);border-top-color:var(--akz);border-radius:50%;animation:wz-dreh .8s linear infinite}

/* Ueberblick (Blatt ohne Auswahl) */
.wzu .wzb-kopf{padding-right:1.4rem}
.wzu__lead{margin:.4rem 0 0;max-width:46ch;font-size:var(--fs-6);line-height:1.5;color:var(--mu)}
.wzu__gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(11.5rem,100%),1fr));gap:.45rem}
.wzu__g{position:relative;display:grid;justify-content:stretch;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"z n" "z c";align-items:center;gap:.05rem .65rem;padding:.6rem .7rem .7rem;border:1px solid var(--hl);border-radius:10px;background:var(--e2);text-align:left;overflow:hidden;transition:border-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui)}
.wzu__g .wz-z{grid-area:z;width:34px;height:34px;border-radius:9px}
.wzu__g b{grid-area:n;font-size:var(--fs-7);font-weight:800;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wzu__g small{grid-area:c;font-size:var(--fs-3);font-weight:700;letter-spacing:var(--ls-5);color:var(--mu)}
.wzu__g i{position:absolute;left:0;bottom:0;height:2px;width:var(--anteil,10%);background:var(--kc);opacity:.75;transform-origin:0 50%}
.wzu__g:hover{border-color:color-mix(in srgb,var(--kc) 60%,transparent);background:color-mix(in srgb,var(--kc) 8%,var(--e2));transform:translateY(-2px)}
.wzu__g:hover .wz-z{background:color-mix(in srgb,var(--kc) 22%,transparent)}
.wzu__g:active{transform:scale(.98)}
.wzu__tipp{display:flex;flex-wrap:wrap;gap:.35rem .9rem;margin:1.1rem 0 0;padding:0;list-style:none;font-size:var(--fs-4);color:var(--mu)}
.wzu__tipp kbd{margin-right:.25rem;padding:.02rem .35rem;border:1px solid var(--hl2);border-bottom-width:2px;border-radius:4px;background:var(--e0);font-family:inherit;font-size:var(--fs-3);color:var(--tx)}

/* ===== 6 Schublade (Filter) ===== */
.wz-schublade{position:fixed;top:0;left:0;z-index:9650;display:flex;flex-direction:column;width:min(340px,88%);height:100%;padding:0 1rem 0;border-right:1px solid var(--hl2);background:var(--e1);transform:translateX(-102%);overflow:auto;overscroll-behavior:contain}
html.wz-bereit .wz-schublade{transition:transform calc(var(--dur-slow)*var(--zt)) var(--out)}
.wz-schublade.is-open{transform:none;box-shadow:0 0 40px rgba(0,0,0,.6)}
.wz-schublade__kopf{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;margin:0 -1rem .9rem;padding:.9rem 1rem;border-bottom:1px solid var(--hl);background:var(--e1);font-family:var(--font-display,inherit);font-size:var(--fs-9);font-weight:800}
.wz-schublade__kopf button{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid var(--hl2);border-radius:8px;background:rgba(0,0,0,.35);color:var(--mu)}
.wz-schublade__kopf button:hover{color:var(--tx);border-color:var(--hl3)}
.wz-fg{margin:0 0 1rem;padding:0 0 .9rem;border:0;border-bottom:1px solid var(--hl)}
.wz-fg:last-of-type{border-bottom:0}
.wz-fg legend,.wz-fg h3{display:flex;align-items:center;gap:.5rem;margin:0 0 .6rem;padding:0;font-size:var(--fs-1);font-weight:700;letter-spacing:var(--ls-12);text-transform:uppercase;color:var(--mu)}
.wz-fg legend::before,.wz-fg h3::before{content:"";width:3px;height:.85rem;border-radius:2px;background:var(--akz)}
.wz-fchips{display:flex;flex-wrap:wrap;gap:.35rem}
.wz-f{display:inline-flex;align-items:center;gap:.4rem;height:2rem;padding:0 .7rem;border:1px solid var(--hl2);border-radius:7px;background:var(--e0);font-size:var(--fs-5);font-weight:700;color:var(--tx);transition:border-color var(--dur-fast) var(--ease-ui),background-color var(--dur-fast) var(--ease-ui),color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.wz-f em{font-size:var(--fs-2);font-style:normal;font-weight:600;color:var(--mu)}
.wz-f:hover{border-color:var(--hl3)}
.wz-f:active{transform:scale(.96)}
.wz-f[aria-pressed="true"]{border-color:var(--akz);background:color-mix(in srgb,var(--akz) 16%,transparent);color:var(--tx)}
.wz-f[aria-pressed="true"] em{color:var(--akz)}
.wz-f[data-sel]::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--sel,#9ba2ae)}
.wz-f.is-null{opacity:.45}
.wz-schublade__fuss{position:sticky;bottom:0;z-index:2;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:.5rem;margin:auto -1rem 0;padding:.75rem 1rem calc(.75rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--hl);background:var(--e1);box-shadow:0 -14px 24px -18px #000}
.wz-zeigen{height:2.4rem;padding:0 .6rem;border:0;border-radius:8px;background:var(--akz);color:var(--ink);font-size:var(--fs-7);font-weight:800;white-space:nowrap;transition:background-color var(--dur-fast) var(--ease-ui),transform var(--dur-fast) var(--ease-ui)}
.wz-zeigen:hover{background:color-mix(in srgb,var(--akz) 86%,#fff)}
.wz-zeigen:active{transform:scale(.97)}
.wz-zeigen.is-leer{background:var(--e3);color:var(--mu)}

/* ===== 7 Spalten ===== */
@media (min-width:821px){
  .wz{display:grid;grid-template-columns:minmax(0,1fr) clamp(380px,42vw,540px);grid-template-areas:"kopf kopf" "bar bar" "chips chips" "liste blatt";column-gap:1.2rem;align-items:start}
  .wz-kopf{grid-area:kopf}
  .wz-bar{grid-area:bar}
  .wz-chips{grid-area:chips}
  .wz-liste{grid-area:liste}
  .wz-blatt{grid-area:blatt;display:block;position:sticky;top:calc(var(--nav-h,68px) + .6rem)}
  .wz-blatt__box{max-height:calc(100dvh - var(--nav-h,68px) - 1.6rem);overflow:auto;overscroll-behavior:contain}
  .wz-blatt__x{display:none}
}
@media (min-width:1180px){
  .wz{grid-template-columns:clamp(228px,17vw,276px) minmax(0,1fr) clamp(420px,33vw,600px);grid-template-areas:"kopf kopf kopf" "bar bar bar" "rail liste blatt";column-gap:clamp(1rem,1.25vw,1.4rem)}
  .wz-chips{display:none}
  .wz-rail{grid-area:rail;display:block;position:sticky;top:calc(var(--nav-h,68px) + .6rem);max-height:calc(100dvh - var(--nav-h,68px) - 1.6rem);overflow:auto;overscroll-behavior:contain;padding:.45rem;border:1px solid var(--hl);border-radius:12px;background:color-mix(in srgb,var(--e1) 70%,transparent);scrollbar-width:thin}
}
/* Hohe Fenster: die Spalten reichen bis an den unteren Rand, jede rollt fuer
   sich (--wz-y misst das Skript: Oberkante der Spalten). */
@media (min-width:821px) and (min-height:720px){
  .wz-blatt,.wz-rail{position:relative;top:auto}
  .wz-blatt__box{height:var(--wz-h);max-height:none}
  .wz-rail{height:var(--wz-h);max-height:none}
  .wz-gitter.vb-scrollbox{max-height:calc(var(--wz-h) - var(--wz-zahl,2.6rem))}
}

/* ===== 8 Telefon ===== */
@media (max-width:820px){
  .wz-kopf{margin-bottom:.6rem}
  .wz-reiter{flex:1 1 auto}
  .wz-reiter__b{flex:1 1 0;justify-content:center;padding:.6rem .4rem .72rem;font-size:var(--fs-7)}
  .wz-hilfe{position:static;flex:0 0 auto;order:2}
  .wz-hilfe > summary{min-height:2.3rem;padding-block:0}
  .wz-hilfe__lang{display:none}
  .wz-hilfe__kurz{display:inline}
  .wz-hilfe__in{left:0;right:0;width:auto}
  .wz-kopf{position:relative}
  .wz-suche{flex:1 1 100%;order:-1}
  .wz-bar .wz-filterknopf{flex:0 0 auto}
  .wz-sort{flex:1 1 0;min-width:0}
  .wz-sort select{width:100%}
  /* Kachel: der Kennwert bricht unter den Pfad, statt ihn abzuschneiden;
     Marken in der Kachel bleiben klein (die Kachel ist die Fingerflaeche). */
  .wz-k__kopf{flex-wrap:wrap;row-gap:.45rem}
  .wz-k__pfad{flex:1 1 calc(100% - 40px)}
  .wz-k__wert{margin-left:0}
  .wz-k .wz-tag{min-height:0}
  .wz-gitter{grid-template-columns:1fr 1fr;gap:.5rem}
  .wz-k{padding:.7rem .7rem .7rem}
  .wz-k__name{font-size:var(--fs-8)}
  /* Das Blatt kommt von unten (is-offen setzt das Skript). */
  .wz-blatt{position:fixed;inset:0;z-index:9660;display:flex;flex-direction:column;justify-content:flex-end;padding:.5rem .5rem 0;background:rgba(8,7,12,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);visibility:hidden;opacity:0;transition:opacity calc(var(--dur-base)*var(--zo)) var(--ease-ui),visibility 0s linear calc(var(--dur-base)*var(--zo))}
  .wz-blatt.is-offen{visibility:visible;opacity:1;transition:opacity calc(var(--dur-base)*var(--zo)) var(--ease-ui)}
  .wz-blatt__box{max-height:calc(100dvh - 2.5rem);overflow:auto;overscroll-behavior:contain;border-radius:16px 16px 0 0;border-bottom:0;padding-bottom:env(safe-area-inset-bottom,0px);transform:translateY(105%);transition:transform calc(var(--dur-slow)*var(--zt)) var(--out)}
  .wz-blatt.is-offen .wz-blatt__box{transform:none}
  .wz-blatt__box::before{content:"";position:sticky;top:0;z-index:7;display:block;width:42px;height:4px;margin:7px auto -11px;border-radius:2px;background:var(--hl3)}
  .wzb-kopf{gap:.8rem;padding:1.3rem 3.2rem 1rem 1rem;border-radius:16px 16px 0 0}
  .wzb-emb{width:64px;height:64px}
  .wzb-emb .wg{width:30px;height:30px}
  .wzb-kenn > div{padding:.6rem .6rem .65rem 1rem}
  .wzb-inh{padding:1rem 1rem 1.4rem}
}
@media (max-width:380px){
  .wz-gitter{grid-template-columns:1fr}
}
/* Vier Kennwerte passen erst ab rund 470 px in eine Reihe; darunter zu
   zweit statt drei und einer allein. */
@container wzb (max-width:470px){
  .wzb-kenn:has(> :nth-child(4)){grid-template-columns:1fr 1fr}
  .wzb-kenn:has(> :nth-child(4)) > div:nth-child(3){border-left:0}
  .wzb-kenn:has(> :nth-child(4)) > div:nth-child(n+3){border-top:1px solid var(--hl)}
}
@container wzb (max-width:400px){
  .wzb-name{font-size:1.2rem}
}

/* ===== 9 Auftakt und Bewegung ===== */
.wz.wz-auftakt > .wz-kopf,.wz.wz-auftakt > .wz-bar{animation:wz-ein calc(.45s*var(--zt)) var(--out) both}
.wz.wz-auftakt > .wz-bar{animation-delay:calc(50ms*var(--zt))}
.wz.wz-auftakt .wz-zahl,.wz.wz-auftakt > .wz-chips{animation:wz-ein calc(.45s*var(--zt)) var(--out) calc(100ms*var(--zt)) both}
.wz.wz-auftakt > .wz-rail{animation:wz-blende calc(.5s*var(--zt)) var(--out) calc(60ms*var(--zt)) both}
.wz.wz-auftakt .wz-rail .wz-gr{animation:wz-seit calc(.45s*var(--zt)) var(--out) both}
${Array.from({ length: 10 }, (_, i) => `.wz.wz-auftakt .wz-rail .wz-gr:nth-of-type(${i + 1}){animation-delay:calc(${90 + i * 28}ms*var(--zt))}`).join('\n')}
@media (min-width:821px){
  .wz.wz-auftakt > .wz-blatt .wz-blatt__box{animation:wz-blende calc(.5s*var(--zt)) var(--out) calc(80ms*var(--zt)) both}
  .wz.wz-auftakt .wzu__g{animation:wz-auf calc(.45s*var(--zt)) var(--out) both}
${Array.from({ length: 10 }, (_, i) => `  .wz.wz-auftakt .wzu__g:nth-child(${i + 1}){animation-delay:calc(${220 + i * 34}ms*var(--zt))}`).join('\n')}
}
/* Kacheln: jede, die beim ersten Bild im Fenster stehen kann (wz-auf setzt
   das Skript, wenn der Katalog da ist, und nimmt sie wieder ab). */
.wz-gitter.wz-auf > .wz-k:nth-child(-n+${AUF_KLEIN}){animation:wz-auf calc(.5s*var(--zt)) var(--out) calc(var(--v,0ms)*var(--zt)) both}
@media ${AUF_GROSS_AB}{
  .wz-gitter.wz-auf > .wz-k:nth-child(-n+${AUF_KACHELN}){animation:wz-auf calc(.5s*var(--zt)) var(--out) calc(var(--v,0ms)*var(--zt)) both}
}
${AUFTAKT_VERZUG}
/* Was die Liste zeigt, hat sich geaendert: einmal kurz neu ansetzen. */
.wz-gitter.is-frisch{animation:wz-frisch calc(.22s*var(--zo)) var(--out)}
/* Nachgeladene Kacheln beim Weiterrollen kommen leise dazu. */
.wz-k.is-nach{animation:wz-nach calc(.3s*var(--zo)) var(--out) both}
@keyframes wz-nach{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes wz-frisch{from{opacity:.3;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes wz-atem{from{opacity:.35}to{opacity:.85}}
@keyframes wz-ein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@keyframes wz-seit{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
@keyframes wz-blende{from{opacity:0}to{opacity:1}}
@keyframes wz-auf{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes wz-pop{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
@keyframes wz-knall{0%{transform:scale(.5)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes wz-tick{0%{transform:translateY(-.25em);opacity:.3}100%{transform:none;opacity:1}}
@keyframes wz-streif{from{background-position:120% 0}to{background-position:-60% 0}}
@keyframes wz-dreh{to{transform:rotate(360deg)}}
@keyframes wz-zieh{from{stroke-dashoffset:277}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){
  .wz *,.wz *::before,.wz *::after,.wz.wz-auftakt *{animation:none!important;transition:none!important}
}
`;
