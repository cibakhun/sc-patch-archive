/* Sprachhinweis (06.10.2026): wer mit deutschem Browser auf einer englischen
   Seite landet, bekommt die deutsche Fassung angeboten — und umgekehrt jeder
   andere auf einer deutschen Seite die englische.

   Anlass, gemessen in Umami (90 Tage bis 06.10.2026): von den Besuchern aus
   Deutschland stiegen 429 auf einer ENGLISCHEN Seite ein und nur 125 auf der
   deutschen, obwohl 362 von ihnen Deutsch als Browsersprache fuehren. Bing
   rankt die englische Fassung (Standardsprache auf der Wurzel); die deutsche
   gibt es zu fast jeder Seite, sie wird nur nicht gefunden.

   Bewusst KEINE Weiterleitung: Suchmaschinen sollen jede Fassung unter ihrer
   eigenen Adresse sehen, und wer Englisch lesen will, soll das duerfen.

   Der Hinweis erscheint nur
   · beim Einstieg — kommt der Aufruf von verse-base.com selbst, ist die
     Sprache schon gewaehlt (auch ueber den DE/EN-Umschalter),
   · wenn es das Gegenstueck gibt: <link rel="alternate" hreflang> aus
     Layout.astro, das nur bei echten Uebersetzungspaaren steht,
   · nicht fuer Automaten (navigator.webdriver): Crawler und die eigenen
     Messwerkzeuge sehen die Seite so, wie sie im HTML steht,
   · und nach dem Schliessen ein Jahr lang nicht mehr (localStorage).
   DOM und CSS entstehen erst, wenn alle Bedingungen erfuellt sind — fuer
   alle anderen kostet die Datei einen Aufruf und sonst nichts. */
(function () {
  'use strict';
  var KEY = 'vb.sprachhinweis';
  var JAHR = 365 * 864e5;
  var T = {
    de: { text: 'Diese Seite gibt es auch auf Deutsch.', los: 'Auf Deutsch lesen', zu: 'Hinweis schließen', name: 'Sprache' },
    en: { text: 'This page is also available in English.', los: 'Read in English', zu: 'Close notice', name: 'Language' },
  };

  function ziel() {
    if (navigator.webdriver) return null;
    var hier = (document.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase();
    var wunsch = ((navigator.languages && navigator.languages[0]) || navigator.language || '').slice(0, 2).toLowerCase();
    if (!wunsch) return null;
    if (hier === 'en' && wunsch === 'de') return 'de';
    if (hier === 'de' && wunsch !== 'de') return 'en';
    return null;
  }

  function vonHier() {
    if (!document.referrer) return false;
    try { return new URL(document.referrer).host === location.host; } catch (e) { return false; }
  }

  function geschlossen() {
    try {
      var t = Number(localStorage.getItem(KEY));
      return t > 0 && Date.now() - t < JAHR;
    } catch (e) { return false; }
  }

  /* Maße und Schrift nur aus der Skala (theme.css § 4), Farben nur aus
     Tokens — damit gilt der Hinweis in beiden Modi und auf jeder Seitenpalette.
     Unten links: rechts unten sitzt auf manchen Seiten „nach oben".
     Zweizeilig und schmal (≤ 22rem): einzeilig war er 584 px breit und lag
     bei 1920 px über dem Anfang einer Überschrift der meistbesuchten Seite —
     so bleibt er auf den Datenseiten im freien Rand links der Spalte. */
  var CSS =
    '.vb-sprache{position:fixed;z-index:900;left:max(1rem,calc((100% - var(--vb-leiste,100%)) / 2));bottom:1rem;' +
    'display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:.55rem .4rem;' +
    'width:max-content;max-width:min(22rem,calc(100% - 2rem));' +
    'padding:.55rem .3rem .8rem .9rem;background:color-mix(in srgb,var(--chrome-solid,#05070d) 92%,transparent);' +
    'border:1px solid var(--line,var(--line-soft));border-left:2px solid var(--accent,#2dd4ff);backdrop-filter:blur(10px);' +
    'box-shadow:0 12px 32px var(--shadow-color,transparent);color:var(--text,#e8eefc);' +
    "font-family:var(--font-body,'Barlow',system-ui,sans-serif);font-size:var(--fs-7);line-height:1.35;" +
    'opacity:0;transform:translateY(.5rem);transition:opacity var(--dur-slow) var(--ease-ui),transform var(--dur-slow) var(--ease-ui)}' +
    '.vb-sprache.ist-da{opacity:1;transform:none}' +
    'html.is-deck-open .vb-sprache{display:none}' +
    '.vb-sprache__text{grid-column:1;grid-row:1;padding-top:.3rem}' +
    ".vb-sprache__los{grid-column:1;grid-row:2;justify-self:start;font-family:var(--font-ui,'Rajdhani',sans-serif);" +
    'font-weight:700;font-size:var(--fs-6);letter-spacing:var(--ls-11);text-transform:uppercase;line-height:1;' +
    'white-space:nowrap;text-decoration:none;color:var(--ink,#05070d);background:var(--accent,#2dd4ff);padding:.6rem .85rem}' +
    '.vb-sprache__los:hover,.vb-sprache__los:focus-visible{filter:brightness(1.12)}' +
    '.vb-sprache__los:focus-visible,.vb-sprache__zu:focus-visible{outline:2px solid var(--accent,#2dd4ff);outline-offset:2px}' +
    '.vb-sprache__zu{grid-column:2;grid-row:1;align-self:start;width:2.45rem;height:2.45rem;display:grid;place-items:center;' +
    'background:transparent;border:0;cursor:pointer;color:var(--muted,#8a99b8);font-size:var(--fs-12);line-height:1}' +
    '.vb-sprache__zu:hover{color:var(--text,#e8eefc)}' +
    '@media (max-width:640px){.vb-sprache{left:.75rem;right:.75rem;bottom:.75rem;width:auto;max-width:none}}' +
    '@media (prefers-reduced-motion:reduce){.vb-sprache{transition:none;transform:none}}';

  function zeige(sprache, pfad) {
    var t = T[sprache];
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var box = document.createElement('aside');
    box.className = 'vb-sprache';
    box.setAttribute('lang', sprache);
    box.setAttribute('aria-label', t.name);

    var text = document.createElement('span');
    text.className = 'vb-sprache__text';
    text.textContent = t.text;

    var los = document.createElement('a');
    los.className = 'vb-sprache__los';
    los.href = pfad;
    los.setAttribute('hreflang', sprache);
    los.textContent = t.los + ' →';

    var zu = document.createElement('button');
    zu.type = 'button';
    zu.className = 'vb-sprache__zu';
    zu.setAttribute('aria-label', t.zu);
    zu.textContent = '×';
    zu.addEventListener('click', function () {
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
      box.remove();
    });

    box.appendChild(text);
    box.appendChild(los);
    box.appendChild(zu);
    document.body.appendChild(box);
    /* Erst nach dem ersten Bild einblenden: der Hinweis soll nicht mit dem
       Seitenaufbau um die Aufmerksamkeit konkurrieren. */
    setTimeout(function () { box.classList.add('ist-da'); }, 700);
  }

  try {
    var sprache = ziel();
    if (!sprache || vonHier() || geschlossen()) return;
    var link = document.querySelector('link[rel="alternate"][hreflang="' + sprache + '"]');
    if (!link) return;
    /* Nur den Pfad übernehmen: auf der Vorschau zeigt hreflang auf die
       Live-Adresse, der Hinweis soll aber auf DIESER Instanz bleiben. */
    var u = new URL(link.getAttribute('href'), location.href);
    zeige(sprache, u.pathname + location.search + location.hash);
  } catch (e) { /* ein Hinweis darf nie eine Seite kaputtmachen */ }
})();
