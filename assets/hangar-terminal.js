// Terminal im Leitstand des Hangars (/hangar.html, /de/hangar.html): die
// Seite selbst in einem Fenster auf dem Schirm der Halle, darueber eine
// Leiste, die zwischen ihren Bereichen umschaltet. Halle und Schiff bleiben
// dabei geladen (Krisz 13.11.2026: „da oben ist ein menü wo man so hin und
// her switchen kann ohne seite nezuladen“). Der Controller der Seite
// (assets/hangar-overview.js) laedt dieses Modul erst, wenn die Kamera zum
// ersten Mal in den Leitstand faehrt, und ruft initTerminal(box, hooks).
//
// Wer was besitzt:
// - Die Buehne (assets/hangar-viewer.js) kennt den Schirm und nennt sein
//   Rechteck im Bild; der Controller reicht es an place(rect) weiter, null
//   heisst: die Kamera steht nicht davor.
// - Das Markup steht in src/components/hangar/HangarPage.astro (#hgx-term):
//   Leiste mit echten Links ins Fenster, das Fenster ohne Adresse. Woerter
//   stehen dort, keines hier.
// - Dieses Modul gibt dem Fenster seine Adresse, richtet jede Seite darin
//   ein (dress) und haelt die Leiste aktuell.
//
// Eingerichtet wird von aussen, die Seiten selbst wissen nichts vom
// Terminal: Fenster und Halle haben denselben Ursprung, also setzt dress()
// ein Stilblatt in das Dokument der Seite (Kopfzeile der Seite weg, ihr
// Platz frei). Ein eigener Seitenmodus haette jede Seite der Website
// angefasst.
//
// Verlauf: Was im Fenster geschieht, bleibt im Fenster. Links und die Leiste
// ersetzen die Adresse (location.replace), statt Eintraege im Verlauf des
// Browsers zu stapeln: sonst fuehrte dessen Zurueck-Knopf erst durch alle
// Seiten des Terminals, auch wenn man laengst wieder am Schiff steht. Den
// Weg zurueck im Fenster fuehrt der Pfeil der Leiste (stack).
//
// Nicht ins Fenster gehoeren: der Hangar selbst (eine zweite Halle in der
// Halle; ein Link dorthin holt stattdessen das Schiff aufs Feld), das Konto
// (die Anmeldung fuehrt ueber fremde Seiten, die sich nicht rahmen lassen)
// und fremde Adressen (die Kopfzeilen des Servers erlauben im Fenster nur
// die eigene Seite). Die beiden letzten oeffnen einen eigenen Tab.
//
// Beim Import passiert nichts; die Pruefung (scripts/verify-hangar-orte.mjs)
// ruft die reinen Funktionen.

/** Breite in CSS-Pixeln, ab der die Seite als volles Schreibtisch-Fenster steht */
export const TERM_MIN_W = 1184;
/** Kleinster Massstab, bevor die Seite lieber schmaler steht als noch kleiner */
export const TERM_MIN_K = 0.75;
/** Schmalste Breite der Seite im Fenster: knapp ueber ihrer Telefonansicht (bis 820 px) */
export const TERM_NARROW_W = 840;
export const TERM_KEY = 'hg-term';
/** So viele Seiten merkt sich der Pfeil zurueck */
export const TERM_STACK = 40;

/**
 * Kasten des Terminals fuer das Rechteck des Schirms im Bild. Ist der Schirm
 * schmaler als TERM_MIN_W, steht die Seite in voller Breite und verkleinert
 * (k), damit sie ihr Layout behaelt. Unter TERM_MIN_K wuerde die Schrift
 * unlesbar (halbes Fenster auf dem Monitor: 0,55 gemessen), dann steht die
 * Seite stattdessen schmaler, bis hinab zu TERM_NARROW_W; erst darunter wird
 * weiter verkleinert, denn die Telefonansicht passt nicht auf den Schirm.
 *   termFrame(1336, 696) → { w: 1336, h: 696, k: 1 }
 *   termFrame(888, 462)  → { w: 1184, h: 616, k: 0.75 }
 *   termFrame(660, 520)  → { w: 880, h: 693, k: 0.75 }
 *   termFrame(420, 300)  → { w: 840, h: 600, k: 0.5 }
 * @param {number} w @param {number} h Rechteck im Bild in CSS-Pixeln
 * @returns {{ w: number, h: number, k: number }} Groesse des Kastens und sein Massstab
 */
export function termFrame(w, h, min = TERM_MIN_W) {
  const bw = Math.max(1, Math.round(w)), bh = Math.max(1, Math.round(h));
  const lw = Math.max(bw, Math.min(min, Math.max(TERM_NARROW_W, Math.round(bw / TERM_MIN_K))));
  const k = bw / lw;
  return { w: lw, h: Math.round(bh / k), k };
}

const ohneSprache = (pathname) => pathname.replace(/^\/de(?=\/|$)/, '') || '/';

/**
 * Wohin ein Link aus dem Fenster fuehrt.
 *   termRoute('/de/schiffe/aegs-gladius.html', 'https://x.test/de/hangar.html') → { art: 'innen' }
 *   termRoute('/de/hangar.html?ship=aegs-gladius', 'https://x.test/de/hangar.html') → { art: 'hangar', ship: 'aegs-gladius' }
 *   termRoute('https://robertsspaceindustries.com/', 'https://x.test/hangar.html') → { art: 'tab' }
 * @param {string} href Ziel, auch relativ @param {string} base Adresse der Halle
 * @returns {{ art: 'innen' } | { art: 'tab' } | { art: 'hangar', ship: string|null }}
 */
export function termRoute(href, base) {
  let u, b;
  try { b = new URL(base); u = new URL(href, b); } catch { return { art: 'innen' }; }
  // mailto:, tel: und dergleichen behandelt der Browser selbst
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { art: 'innen' };
  if (u.origin !== b.origin) return { art: 'tab' };
  const path = ohneSprache(u.pathname);
  if (path === '/hangar.html') return { art: 'hangar', ship: u.searchParams.get('ship') };
  // jede andere Seite des Hangars brächte eine zweite Halle ins Fenster
  if (/^\/hangar[-/.]/.test(path) || /^\/account(?:[/.]|$)/.test(path)) return { art: 'tab' };
  return { art: 'innen' };
}

/**
 * Der Bereich der Leiste, zu dem ein Pfad gehoert: der laengste passende
 * Anfang gewinnt, die Sprache zaehlt nicht mit.
 *   termTool('/de/topics/crafting-werkbank.html', [{ key: 'crafting', pre: ['/topics/crafting'] }, { key: 'archiv', pre: ['/topics/'] }]) === 'crafting'
 * @param {string} pathname @param {ReadonlyArray<{ key: string, pre: readonly string[] }>} tools
 * @returns {string|null}
 */
export function termTool(pathname, tools) {
  const path = ohneSprache(pathname);
  let best = null, len = 0;
  for (const t of tools) for (const p of t.pre) if (p.length > len && path.startsWith(p)) { best = t.key; len = p.length; }
  return best;
}

// Stil fuer die Seite im Fenster. Die Kopfzeile der Seite (#topbar) und die
// Marke des Vorschau-Baus (Layout.astro, fest oben links) weichen: Beides
// traegt im Leitstand die Halle. --nav-h ist der Platz, den die Seiten unter
// der Kopfzeile frei lassen.
export const TERM_CSS = [
  'html[data-vb-terminal]{--nav-h:0px!important;scroll-padding-top:0!important}',
  'html[data-vb-terminal] #topbar,html[data-vb-terminal] body>div[lang][style*="2147483647"]{display:none!important}',
  // Schlanke Datenseiten (DataShell): der Pfad bleibt als Wegweiser stehen,
  // Startlink, Suchknopf und Sprachschalter traegt die Leiste des Fensters.
  'html[data-vb-terminal] .dp-bar>.dp-home,html[data-vb-terminal] .dp-bar>.dp-search,html[data-vb-terminal] .dp-bar>.dp-lang{display:none!important}',
].join('');

/**
 * @param {HTMLElement} box #hgx-term
 * @param {{ ship?: (id: string|null) => void }} hooks ship: ein Link zum Hangar wurde im Fenster gewaehlt
 * @returns {{ place: (rect: { l: number, t: number, r: number, b: number }|null) => void }}
 */
export function initTerminal(box, hooks = {}) {
  const doc = box.ownerDocument, win = doc.defaultView;
  const frame = box.querySelector('iframe');
  const links = [...box.querySelectorAll('a[data-term]')];
  const back = box.querySelector('#hgx-term-back'), search = box.querySelector('#hgx-term-search'), ext = box.querySelector('#hgx-term-ext');
  const tools = links.map((a) => ({ key: a.dataset.term, pre: (a.dataset.pre ?? '').split(' ').filter(Boolean), href: a.href }));
  const home = tools.find((t) => t.key === box.dataset.home)?.href ?? tools[0]?.href;
  const here = win.location.href;
  const stack = [];
  const loadMsg = box.querySelector('#hgx-term-load'), loadText = loadMsg?.textContent ?? '';
  // seen: das eingerichtete Dokument; gone: eines, das gerade geht (pagehide)
  let seen = null, gone = null, poll = 0, started = false, offTimer = 0, fails = 0;

  const frameDoc = () => { try { return frame.contentDocument; } catch { return null; } };
  const urlOf = (d) => `${d.location.pathname}${d.location.search}${d.location.hash}`;
  // dieselbe Seite: Pfad und Abfrage, der Anker zaehlt nicht
  const page = (url) => { try { const u = new URL(url, here); return `${u.pathname}${u.search}`; } catch { return url; } };
  const remember = () => {
    const d = frameDoc();
    if (!d || d !== seen) return;
    try { win.sessionStorage.setItem(TERM_KEY, urlOf(d)); } catch { /* ohne Speicher beginnt das Terminal bei seiner Startseite */ }
  };
  const mark = (pathname) => {
    const key = termTool(pathname, tools);
    for (const a of links) {
      if (a.dataset.term === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  };

  // Eine Seite einrichten, sobald ihr Dokument steht: Stil, Klicks, Leiste.
  // false: die Seite gehoert nicht ins Fenster und ist schon abgewiesen.
  function dress(d) {
    const w = d.defaultView, r = termRoute(d.location.href, here);
    if (r.art === 'hangar' || (r.art === 'tab' && /^\/hangar/.test(ohneSprache(d.location.pathname)))) {
      // per Skript oder Formular doch beim Hangar gelandet: zurueck, das Schiff aufs Feld
      const last = stack.at(-1) ?? home;
      w.stop?.();
      w.location.replace(last);
      if (r.art === 'hangar') hooks.ship?.(r.ship);
      return false;
    }
    d.documentElement.setAttribute('data-vb-terminal', '');
    const st = d.createElement('style');
    st.textContent = TERM_CSS;
    (d.head ?? d.documentElement).append(st);
    // Am Fenster statt am Dokument, in der Blasenphase: so laeuft dies nach
    // allem, was die Seite selbst an Klicks behandelt (eigene Dialoge), und
    // laesst liegen, was sie schon verhindert hat.
    w.addEventListener('click', (e) => onLink(e, w));
    // Die Seite geht: das Fenster zeigt „Seite lädt“, bis die naechste steht.
    // Kommt sie aus dem Zwischenspeicher des Browsers zurueck, steht sie wieder.
    w.addEventListener('pagehide', () => { gone = d; box.classList.remove('is-ready'); watch(); });
    w.addEventListener('pageshow', (e) => { if (e.persisted && gone === d) { gone = null; watch(); } });
    seen = d;
    fails = 0;
    if (loadMsg) loadMsg.textContent = loadText;
    const url = urlOf(d);
    if (!stack.length || page(stack.at(-1)) !== page(url)) stack.push(url);
    else stack[stack.length - 1] = url;
    if (stack.length > TERM_STACK) stack.shift();
    back.disabled = stack.length < 2;
    mark(d.location.pathname);
    remember();
    return true;
  }
  function onLink(e, w) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target?.closest?.('a[href]');
    if (!a || a.hasAttribute('download') || a.target === '_blank') return;
    const r = termRoute(a.href, here);
    if (r.art === 'hangar') { e.preventDefault(); hooks.ship?.(r.ship); return; }
    if (r.art === 'tab') { e.preventDefault(); win.open(a.href, '_blank', 'noopener'); return; }
    if (!/^https?:$/.test(a.protocol)) return;
    e.preventDefault();
    w.location.replace(a.href);
  }

  // Vom Beginn einer Navigation an nachsehen, bis das neue Dokument steht:
  // eingerichtet wird es, sobald es da ist (vor dem ersten Bild), gezeigt,
  // sobald es bedienbar ist. Das load-Ereignis des Fensters kaeme erst nach
  // allen Bildern der Seite.
  function watch() {
    if (poll) return;
    const t0 = win.performance.now();
    poll = win.setInterval(() => {
      const d = frameDoc();
      if (d && d !== seen && d !== gone && d.documentElement && d.location.href !== 'about:blank') dress(d);
      const done = d && d === seen && d !== gone && d.readyState !== 'loading';
      if (done) box.classList.add('is-ready');
      // eine fremde oder abgewiesene Adresse liefert kein Dokument: dann endet das Nachsehen von selbst
      if (done || win.performance.now() - t0 > 30000) { win.clearInterval(poll); poll = 0; }
    }, 30);
  }
  // Die alte Seite bleibt stehen, bis die neue kommt (pagehide), wie in jedem Browser
  function go(url) {
    try { frame.contentWindow.location.replace(url); } catch { frame.src = url; }
    try { mark(new URL(url, here).pathname); } catch { /* die Leiste folgt, sobald die Seite steht */ }
    watch();
  }
  // Nach jedem fertigen Laden: Steht ein Dokument da, das dress() nie sah,
  // jetzt einrichten. Steht keines da (fremde Adresse oder vom Browser
  // abgewiesen, etwa weil der Server das Rahmen verbietet), einmal zurueck
  // zur letzten Seite; scheitert auch die, sagt das Fenster, wie es
  // weitergeht (data-fail), statt endlos neu zu laden.
  frame.addEventListener('load', () => {
    if (!started) return;
    const d = frameDoc();
    if (!d) {
      box.classList.remove('is-ready');
      if (fails++ < 1) go(stack.at(-1) ?? home);
      else if (loadMsg) loadMsg.textContent = loadMsg.dataset.fail ?? loadText;
      return;
    }
    if (d.location.href === 'about:blank') return;
    if (d !== seen && d.documentElement) dress(d);
    if (d === seen) { gone = null; box.classList.add('is-ready'); }
  });

  function start() {
    started = true;
    let first = home;
    try {
      const last = win.sessionStorage.getItem(TERM_KEY);
      // nur ein Pfad dieser Seite in der Sprache der Halle, und nichts, was nicht ins Fenster gehoert
      const de = (p) => /^\/de(\/|$)/.test(p);
      if (last && /^\/(?!\/)/.test(last) && termRoute(last, here).art === 'innen' && de(last) === de(win.location.pathname)) first = last;
    } catch { /* ohne Speicher die Startseite */ }
    if (first) go(first);
  }

  // Die Leiste: Bereiche wechseln im Fenster. Mit Strg, Umschalt oder der
  // mittleren Taste bleibt es ein gewoehnlicher Link.
  box.querySelector('.hgx-term__nav')?.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-term]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(a.href);
  });
  back?.addEventListener('click', () => {
    if (stack.length < 2) return;
    stack.pop();
    back.disabled = stack.length < 2;
    go(stack.at(-1));
  });
  // Die Suche der Seite: Seiten mit voller Navigation oeffnet jeder Ausloeser
  // mit data-scs-open (assets/search-overlay.js), die schlanken Datenseiten
  // holen sie erst ueber ihren eigenen Knopf (data-scs-boot,
  // assets/data-search.js). Beide Knoepfe sind im Fenster ausgeblendet, ein
  // Klick per Skript erreicht sie trotzdem. Der Fokus geht mit ins Fenster.
  search?.addEventListener('click', () => {
    const d = frameDoc();
    if (!d || d !== seen || !d.body) return;
    frame.contentWindow.focus();
    const boot = d.querySelector('[data-scs-boot]');
    if (boot) { boot.click(); return; }
    const b = d.createElement('button');
    b.type = 'button';
    b.hidden = true;
    b.setAttribute('data-scs-open', '');
    d.body.append(b);
    b.click();
    b.remove();
  });
  // „In eigenem Tab öffnen“ meint die Seite, die gerade im Fenster steht
  ext?.addEventListener('click', () => {
    const d = frameDoc();
    if (d && d === seen) ext.href = d.location.href;
  });
  win.addEventListener('pagehide', remember);

  function place(rect) {
    win.clearTimeout(offTimer);
    if (!rect) {
      remember();
      box.classList.remove('is-on');
      // Nach der Blende ganz aus dem Layout: Eine Seite, die nicht zu sehen
      // ist, soll neben der Halle weder zeichnen noch Bilder rechnen.
      offTimer = win.setTimeout(() => { box.hidden = true; }, 340);
      return;
    }
    const l = Math.round(rect.l), t = Math.round(rect.t);
    const f = termFrame(rect.r - rect.l, rect.b - rect.t);
    box.style.width = `${f.w}px`;
    box.style.height = `${f.h}px`;
    box.style.transform = `translate(${l}px,${t}px) scale(${f.k})`;
    if (box.hidden) {
      box.hidden = false;
      // erst ein Layout ohne .is-on, sonst faellt die Blende aus
      void box.offsetWidth;
    }
    box.classList.add('is-on');
    if (!started) start();
  }
  return { place };
}
