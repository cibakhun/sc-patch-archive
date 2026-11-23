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
// Halle; ein Link dorthin holt stattdessen das Schiff aufs Feld) und fremde
// Adressen (die Kopfzeilen des Servers erlauben im Fenster nur die eigene
// Seite; sie oeffnen einen eigenen Tab). Das Konto steht seit der dritten
// Runde im Fenster, siehe unten.
//
// Anmeldung: Setzt sich die Kamera vor den Monitor, meldet das Terminal erst
// den Besucher an (Krisz 14.11.2026: „son user anmeldung kurz loadin animation
// beim bildschirm also wenn man sich davor hockt, und dann soll dargestellt
// werden dass der echte user angemeldet wird mit versebase zeug“). Die Blende
// (#hgx-term-login) beginnt mit derselben Marke an derselben Stelle, die der
// Monitor der Halle in Ruhe zeigt, fragt das Konto der Seite (window.VBAccount,
// assets/account-lite.js) und nennt, wer vor dem Terminal sitzt: das eigene
// Profil mit Bild und Namen, oder den Gast. Danach steht dasselbe in der
// Leiste (#hgx-term-who). Meldet sich jemand an oder ab, hier oder in einem
// anderen Tab, meldet das Terminal ihn von selbst nach (vb-account-session).
//
// Zweite Runde (Krisz 14.11.2026: „nicht schlecht. es geht aber besser alles“):
// Der Grund der Blende ist das Sperrbild, das der Monitor der Halle selbst
// zeigt (hooks.bild, gezeichnet von leitFenster in assets/hangar-viewer.js):
// ein Bild aus einer Quelle, also ohne Sprung vom Glas auf die Seite. Die
// Karte nennt ausser Namen und Bild, was VerseBase von dem weiss, der davor
// sitzt: seine Flotte, das Schiff auf dem Feld, seit wann er dabei ist
// (termFakten). Am Ende sagt die Blende der Halle, wer angemeldet ist
// (hooks.wer): Der Monitor nennt die Sitzung, wenn die Kamera wieder geht.
//
// Dritte Runde (Krisz 15.11.2026: „die anmeldung soll noch smoother animiert,
// länger gemacht insgesamt, konto seite direkt auf das bildschirm einbauen,
// dafür soll anmelde animation nur beim 1x mal pro session kommen. wenn kein
// konto angemeldet ist soll man da direkt registrieren können und gleich
// anmelden können“). Der Bildschirm ist damit der Ort, an dem man sich
// anmeldet, registriert und sein Konto fuehrt:
// - Die Kontoseiten stehen im Fenster wie jede andere Seite (termRoute), der
//   Knopf der Leiste fuehrt dorthin. E-Mail und Passwort laufen ganz im
//   Fenster. Discord laesst sich nicht rahmen: Die Kontoseiten merken am
//   Kennzeichen data-vb-terminal, dass sie im Fenster stehen, und oeffnen
//   dafuer ein eigenes kleines Fenster (src/lib/im-terminal.ts).
// - Die Blende kommt einmal je Sitzung des Browsers (TERM_AN): beim ersten
//   Hinsetzen, und wieder, wenn sich wirklich jemand an- oder abmeldet. Sonst
//   zeigt das Hinsetzen sofort die Seite, die Leiste fragt das Konto leise.
// - Ohne Konto bleibt das Sperrbild stehen und bietet drei Wege: anmelden,
//   Konto erstellen, als Gast weiter (#hgx-term-lwahl). Mit Konto beginnt
//   der Bildschirm in einer neuen Sitzung auf der Kontoseite.
// - Die Blende laeuft laenger und in weicheren Schritten (TERM_LOGIN, Stil in
//   HangarPage.astro): erst das ruhende Sperrbild, dann die Pruefung, die
//   Karte, die Fakten nacheinander, zuletzt oeffnet sie sich langsamer.
//   Steht die Seite schon offen (jemand meldet sich im Fenster an oder ab),
//   faehrt die Blende erst zu, statt in einem Bild da zu sein.
// - Meldet sich jemand auf der Anmeldeseite im Fenster an, fuehrt erst die
//   Seite ihre Anmeldung zu Ende (zweiter Faktor): Die Begruessung kommt,
//   wenn sie weitergeht (termAnmeldung), nicht ueber der Frage nach dem Code.
//
// Vierte Runde, der Ueberblick (Krisz 23.11.2026: „unseren bildschirm control
// panel mal richtig ausbauen und gleich politur runde starten“; Etappe 2 des
// Konzepts „VerseBase in der Halle“): Der Bildschirm beginnt nicht mehr auf
// einer Seite der Website, sondern auf seinem eigenen Ueberblick
// (#hgx-ts, src/components/hangar/TermStart.astro). Er liegt im Fenster ueber
// der Seite und steht sofort, ohne zu laden:
// - wer davor sitzt, die Suche der Seite, Uhr und Tag;
// - die Orte der Halle (ein Klick faehrt die Kamera: hooks.ort), die Flotte
//   (ein Klick holt das Schiff aufs Feld: hooks.ship), mit Konto die eigenen
//   Zahlen (Raffinerie mit Countdown, Crafting, Freunde, Gespeichertes);
// - der neueste Patch und die Werkzeuge, die je ihre Seite oeffnen.
// Der erste Knopf der Leiste fuehrt zurueck zum Ueberblick; im Verlauf des
// Fensters und im Gedaechtnis der Sitzung steht er als TERM_START. Waehlt man
// eine Seite, bleibt der Ueberblick stehen, bis die Seite bedienbar ist (kein
// leeres Fenster dazwischen). Die Suche des Ueberblicks ist die der Website
// (assets/search-overlay.js); ihre Treffer kommen ueber window.vbSucheWeg auf
// den Schirm, auch die des Dialogs (Strg+K), solange das Terminal offen ist.
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
/** Wer in dieser Sitzung des Browsers am Terminal schon angemeldet wurde: die Kennung des Kontos, TERM_GAST fuer den Gast */
export const TERM_AN = 'hg-term-an';
export const TERM_GAST = '-';
/** So viele Seiten merkt sich der Pfeil zurueck */
export const TERM_STACK = 40;
/** Der Ueberblick im Verlauf des Fensters und im Gedaechtnis der Sitzung: keine Adresse, das Terminal selbst */
export const TERM_START = 'start:';
/** So lange (ms) gelten die Zahlen des Kontos im Ueberblick; danach holt ihn das naechste Zeigen neu */
export const TERM_DATEN_MS = 60000;
/** Hoechstens so lange (ms) bleibt der Ueberblick vor einer Seite stehen, die er oeffnet; danach zeigt das Fenster, wie weit sie ist */
export const TERM_WECHSEL_MS = 12000;
/** Unter dieser Hoehe (Layout-Pixel) steht der Ueberblick in der engen Fassung (data-niedrig) */
export const TERM_NIEDRIG_H = 660;

/**
 * Womit das Terminal in diesem Seitenaufruf beginnt: mit der Seite, die es
 * in dieser Sitzung zuletzt zeigte, sonst mit dem Ueberblick. Eine Seite gilt
 * nur als Pfad dieser Website in der Sprache der Halle, und nur, wenn sie ins
 * Fenster gehoert.
 *   termErste(null, 'https://x.test/de/hangar.html') === TERM_START
 *   termErste('/de/items.html?q=x', 'https://x.test/de/hangar.html') === '/de/items.html?q=x'
 *   termErste('/items.html', 'https://x.test/de/hangar.html') === TERM_START   (andere Sprache)
 *   termErste('//x.evil/de/items.html', 'https://x.test/de/hangar.html') === TERM_START
 *   termErste('/de/hangar.html?ship=x', 'https://x.test/de/hangar.html') === TERM_START
 * @param {string|null} last Wert aus TERM_KEY @param {string} here Adresse der Halle
 * @returns {string} TERM_START oder ein Pfad
 */
export function termErste(last, here) {
  if (typeof last !== 'string' || !last || last === TERM_START) return TERM_START;
  let pfad;
  try { pfad = new URL(here).pathname; } catch { return TERM_START; }
  const de = (p) => /^\/de(\/|$)/.test(p);
  return /^\/(?!\/)/.test(last) && termRoute(last, here).art === 'innen' && de(last) === de(pfad) ? last : TERM_START;
}

/**
 * Restzeit als Countdown wie im Raffinerie-Tracker, auf die Sekunde
 * aufgerundet: Was noch nicht fertig ist, zeigt nie 00:00:00.
 *   termRest(3 * 3600e3 + 12 * 60e3 + 45e3) === '03:12:45'
 *   termRest(2 * 86400e3 + 61e3) === '2d 00:01:01'
 *   termRest(400) === '00:00:01'
 *   termRest(-5) === '00:00:00'
 * @param {number} ms @returns {string}
 */
export function termRest(ms) {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${d > 0 ? `${d}d ` : ''}${p(h)}:${p(m)}:${p(sec)}`;
}

/**
 * Die Kachel „Raffinerie“: wie viele Auftraege laufen, wie viele abholbereit
 * sind, und der naechste, der fertig wird (Station kurz, Restzeit, Anteil
 * 0..1). Gezaehlt wird nur, was ein lesbares ready_at hat; ein anderer Status
 * als active zaehlt nicht.
 *   termRaffinerie([{ station: 'ARC-L1 Wide Forest Station', started_at: '2026-11-23T08:00:00Z', ready_at: '2026-11-23T12:00:00Z' }], Date.parse('2026-11-23T10:00:00Z'))
 *     → { aktiv: 1, fertig: 0, naechster: { station: 'ARC-L1', rest: 7200000, anteil: 0.5 } }
 * @param {unknown} jobs Zeilen aus refinery_jobs @param {number} jetzt
 * @returns {{ aktiv: number, fertig: number, naechster: { station: string, rest: number, anteil: number }|null }}
 */
export function termRaffinerie(jobs, jetzt = Date.now()) {
  let aktiv = 0, fertig = 0, best = null;
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || typeof j !== 'object' || (j.status !== undefined && j.status !== 'active')) continue;
    const am = typeof j.ready_at === 'string' ? Date.parse(j.ready_at) : NaN;
    if (!Number.isFinite(am)) continue;
    if (am <= jetzt) { fertig++; continue; }
    aktiv++;
    if (!best || am < best.am) best = { am, ab: typeof j.started_at === 'string' ? Date.parse(j.started_at) : NaN, station: j.station };
  }
  if (!best) return { aktiv, fertig, naechster: null };
  const name = typeof best.station === 'string' ? best.station.trim() : '';
  const station = /^([A-Z]{3}-L\d)\b/.exec(name)?.[1] ?? ([...name].length > 40 ? `${[...name].slice(0, 39).join('')}…` : name);
  const span = best.am - best.ab;
  const anteil = Number.isFinite(span) && span > 0 ? Math.min(1, Math.max(0, (jetzt - best.ab) / span)) : 0;
  return { aktiv, fertig, naechster: { station, rest: best.am - jetzt, anteil } };
}

/**
 * Die Kachel „Crafting“: Blueprints im Besitz und im Planer (Menge ueber 0).
 *   termCrafting([{ owned: true, plan_qty: 0 }, { owned: false, plan_qty: 3 }, { owned: true, plan_qty: 1 }]) → { besitz: 2, plan: 2 }
 *   termCrafting(null) → { besitz: 0, plan: 0 }
 * @param {unknown} rows Zeilen aus crafting_entries @returns {{ besitz: number, plan: number }}
 */
export function termCrafting(rows) {
  let besitz = 0, plan = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r?.owned === true) besitz++;
    if (Number.isInteger(r?.plan_qty) && r.plan_qty > 0) plan++;
  }
  return { besitz, plan };
}

/**
 * Die Kachel „Freunde“, gezaehlt wie am Konto-Knopf der Seite
 * (assets/account-lite.js): offene Anfragen an mich, ungelesene Nachrichten
 * nur von Freunden (die eines Ex-Freundes stehen in keiner Liste mehr und
 * liessen sich nie wegklicken).
 *   termFreunde([{ id: 1 }], [{ sender_id: 'a' }, { sender_id: 'x' }], [{ user_id: 'ich', friend_id: 'a' }], 'ich') → { anfragen: 1, ungelesen: 1 }
 * @param {unknown} anfragen @param {unknown} ungelesen @param {unknown} freunde @param {string} ich
 * @returns {{ anfragen: number, ungelesen: number }}
 */
export function termFreunde(anfragen, ungelesen, freunde, ich) {
  const mine = new Set();
  for (const f of Array.isArray(freunde) ? freunde : []) {
    if (!ich || !f) continue;
    if (f.user_id === ich) mine.add(f.friend_id);
    else if (f.friend_id === ich) mine.add(f.user_id);
  }
  const n = Array.isArray(ungelesen) ? ungelesen.filter((m) => m && typeof m.sender_id === 'string' && mine.has(m.sender_id)).length : 0;
  return { anfragen: Array.isArray(anfragen) ? anfragen.length : 0, ungelesen: n };
}

/**
 * Die Kachel „Gespeichert“, gezaehlt wie der Bereich „Gespeichert“ am Konto
 * (src/scripts/account-saved.ts): die Loadouts des Hangars (geloeschte
 * nicht) und die Favoriten. Wer nur Loadouts hat, sah vorher eine 0, und die
 * Kontoseite zeigte daneben drei. Fehlt eine der beiden Listen, zaehlt die
 * Kachel nicht halb: null, dann steht „Gerade nicht erreichbar“ da.
 *   termGespeichert([{ id: 'a' }, { id: 'b', deleted: true }], [{ id: 1 }]) → { loadouts: 1, favoriten: 1 }
 *   termGespeichert(null, [{ id: 1 }]) → null
 * @param {unknown} loadouts @param {unknown} favoriten
 * @returns {{ loadouts: number, favoriten: number } | null}
 */
export function termGespeichert(loadouts, favoriten) {
  if (!Array.isArray(loadouts) || !Array.isArray(favoriten)) return null;
  return {
    loadouts: loadouts.filter((r) => r && typeof r === 'object' && r.deleted !== true).length,
    favoriten: favoriten.filter((r) => r && typeof r === 'object').length,
  };
}

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
  if (/^\/hangar[-/.]/.test(path)) return { art: 'tab' };
  return { art: 'innen' };
}

/**
 * Gehoert ein Pfad zum Konto (das Konto selbst, Anmelden, Registrieren,
 * Passwort)? Dann ist in der Leiste der Knopf des Kontos der aktive Bereich.
 *   termKonto('/de/account.html') === true
 *   termKonto('/account/login.html') === true
 *   termKonto('/accounting.html') === false
 * @param {string} pathname @returns {boolean}
 */
export function termKonto(pathname) {
  return /^\/account(?:[/.]|$)/.test(ohneSprache(String(pathname ?? '')));
}

/**
 * Ist das eine Seite, auf der man sich anmeldet oder registriert? Entsteht
 * dort eine Sitzung, ist die Anmeldung erst fertig, wenn die Seite weitergeht
 * (sie fragt vorher den zweiten Faktor).
 *   termAnmeldung('/de/account/login.html') === true
 *   termAnmeldung('/account/register.html') === true
 *   termAnmeldung('/de/account.html') === false
 * @param {string} pathname @returns {boolean}
 */
export function termAnmeldung(pathname) {
  return /^\/account\/(?:login|register)(?:\.html)?$/.test(ohneSprache(String(pathname ?? '')));
}

/**
 * Der Bereich der Leiste, zu dem ein Pfad gehoert: der laengste passende
 * Anfang gewinnt, die Sprache zaehlt nicht mit.
 *   termTool('/de/topics/crafting.html', [{ key: 'crafting', pre: ['/topics/crafting'] }, { key: 'archiv', pre: ['/topics/'] }]) === 'crafting'
 * @param {string} pathname @param {ReadonlyArray<{ key: string, pre: readonly string[] }>} tools
 * @returns {string|null}
 */
export function termTool(pathname, tools) {
  const path = ohneSprache(pathname);
  let best = null, len = 0;
  for (const t of tools) for (const p of t.pre) if (p.length > len && path.startsWith(p)) { best = t.key; len = p.length; }
  return best;
}

/**
 * Dauer der Anmeldung in ms: boot = das Sperrbild steht ruhig, wie eben noch
 * auf dem Glas, auth = „Anmeldung …“ mindestens so lange, hold = die Karte
 * steht, frist = so lange wartet sie hoechstens auf das Konto, aus = die
 * Blende oeffnet sich (so lang wie der Uebergang von .hgx-term__login im Stil
 * der Seite), wink = so lange zeigt der Knopf der Leiste einem Gast den Weg
 * zum Konto. Seit der dritten Runde laenger (Krisz 15.11.2026: „länger
 * gemacht insgesamt“), dafuer nur einmal je Sitzung: Eine kurze Fassung fuer
 * das Wiederkommen gibt es nicht mehr.
 */
export const TERM_LOGIN = { boot: 520, auth: 1700, hold: 2300, frist: 3200, aus: 720, wink: 2400 };
/** So jung (ms) ist ein Konto, das eben erst entstanden ist: Es wird mit „Willkommen“ begruesst, jedes aeltere mit „Willkommen zurück“ */
export const TERM_NEU = 10 * 60 * 1000;

/**
 * Der Gruss der Karte: 'hallo' fuer ein Konto, das eben erst entstanden ist
 * (am Bildschirm registriert), sonst 'zurueck'. Ohne lesbaren Zeitstempel
 * oder mit einem aus der Zukunft bleibt es beim schlichten 'hallo'.
 *   termGruss('2026-11-15T16:00:00Z', Date.UTC(2026, 10, 15, 16, 4)) === 'hallo'
 *   termGruss('2026-03-02T10:00:00Z', Date.UTC(2026, 10, 15)) === 'zurueck'
 *   termGruss('', Date.now()) === 'hallo'
 * @param {string} seit Zeitstempel des Kontos (created_at) @param {number} jetzt
 * @returns {'hallo'|'zurueck'}
 */
export function termGruss(seit, jetzt = Date.now()) {
  const ms = typeof seit === 'string' && seit ? new Date(seit).getTime() : NaN;
  return ms <= jetzt && jetzt - ms > TERM_NEU ? 'zurueck' : 'hallo';
}

/**
 * Kommt die Blende beim Hinsetzen? Einmal je Sitzung: nur, wenn in dieser
 * Sitzung noch niemand angemeldet wurde (schon === null) oder inzwischen ein
 * anderer davor sitzt als der, den sie zuletzt begruesst hat.
 *   termBlende(null, '') === true            (erstes Hinsetzen, Gast)
 *   termBlende('-', '') === false            (der Gast von eben)
 *   termBlende('-', 'u1') === true           (inzwischen angemeldet)
 *   termBlende('u1', 'u1') === false
 * @param {string|null} schon Wert aus TERM_AN @param {string} konto Kennung der gespeicherten Sitzung, '' ohne
 * @returns {boolean}
 */
export function termBlende(schon, konto) {
  return schon === null || schon === undefined || schon !== (konto || TERM_GAST);
}
/** Schriften des Sperrbilds (leitFenster): geladen, bevor die Blende es zeichnet */
export const TERM_FONTS = ['700 16px Orbitron', '600 16px Rajdhani', '700 16px Rajdhani'];

/**
 * Wer vor dem Terminal sitzt, aus der Profilzeile des Kontos. Geprueft wird
 * alles, was spaeter in Stil oder Adresse landet: das Bild nur ueber https,
 * die Farbe nur als #rrggbb, das Zeichen hoechstens vier Zeichen lang.
 *   termIdent('u1', { display_name: 'Ada', handle: 'ada' }) → { uid: 'u1', name: 'Ada', sub: '@ada', bild: '', zeichen: 'A', farbe: '#2dd4ff' }
 *   termIdent('u1', null) → { uid: 'u1', name: '', … }   (Konto ohne lesbares Profil: die Leiste nennt es „Konto“)
 *   termIdent(null, null) → null   (Gast)
 * @param {string|null} uid @param {Record<string, unknown>|null} p Zeile aus profiles
 */
export function termIdent(uid, p) {
  if (!uid) return null;
  const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const handle = text(p?.handle, 40).replace(/^@+/, ''), anzeige = text(p?.display_name, 60);
  const name = anzeige || (handle ? `@${handle}` : '');
  let bild = '';
  try { const u = new URL(text(p?.avatar_url, 600)); if (u.protocol === 'https:') bild = u.href; } catch { /* kein Bild */ }
  const farbe = /^#[0-9a-f]{6}$/i.test(text(p?.avatar_color, 7)) ? text(p?.avatar_color, 7) : '#2dd4ff';
  const zeichen = [...text(p?.avatar_icon, 16)].slice(0, 4).join('') || [...name.replace(/^@/, '')][0]?.toUpperCase() || '◆';
  return { uid: String(uid), name, sub: anzeige && handle ? `@${handle}` : '', bild, zeichen, farbe };
}

/**
 * Was die Karte der Anmeldung unter dem Namen nennt: hoechstens drei Zeilen
 * [Bezeichnung, Wert]. roh kommt von der Seite (Flotte von VBFleet, das Schiff
 * auf dem Feld, die Hangargroesse), seit aus der Sitzung des Kontos. Ohne
 * Konto steht statt „Dabei seit“ die Halle. Was fehlt oder nicht stimmen
 * kann, faellt weg, statt leer oder falsch dazustehen.
 *   const T = { flotte: 'Flotte', schiff1: '1 Schiff', schiffn: '{n} Schiffe', leer: 'noch leer', feld: 'Auf dem Feld', halle: 'Halle', seit: 'Dabei seit' };
 *   termFakten({ flotte: 7, schiff: 'Gladius', halle: 'Small-Hangar' }, T, '2026-03-02T10:00:00Z', 'de')
 *     → [['Flotte', '7 Schiffe'], ['Auf dem Feld', 'Gladius'], ['Dabei seit', 'März 2026']]
 *   termFakten({ flotte: 0, schiff: 'Gladius', halle: 'Small-Hangar' }, T, '', 'de')
 *     → [['Flotte', 'noch leer'], ['Auf dem Feld', 'Gladius'], ['Halle', 'Small-Hangar']]
 * @param {{ flotte?: unknown, schiff?: unknown, halle?: unknown }|null} roh
 * @param {Record<string, string|undefined>} t Woerter aus dem Markup (data-f-…)
 * @param {string} seit Zeitstempel des Kontos (created_at), '' ohne Konto
 * @param {string} lang 'de' oder 'en' @param {number} jetzt
 * @returns {Array<[string, string]>}
 */
export function termFakten(roh, t, seit, lang, jetzt = Date.now()) {
  const out = [], loc = String(lang ?? '').toLowerCase().startsWith('de') ? 'de-DE' : 'en-GB';
  const text = (v) => (typeof v === 'string' ? v.trim().slice(0, 48) : '');
  const n = roh?.flotte;
  if (t?.flotte && Number.isInteger(n) && n >= 0) {
    const wert = n === 0 ? t.leer : n === 1 ? t.schiff1 : (t.schiffn ?? '').replace('{n}', new Intl.NumberFormat(loc).format(n));
    if (wert) out.push([t.flotte, wert]);
  }
  const schiff = text(roh?.schiff), halle = text(roh?.halle);
  if (t?.feld && schiff) out.push([t.feld, schiff]);
  // ein Beitritt vor 2024 oder in der Zukunft ist keiner (kaputte Uhr, fremder Wert)
  const d = typeof seit === 'string' && seit ? new Date(seit) : null, ms = d ? d.getTime() : NaN;
  if (t?.seit && ms >= Date.UTC(2024, 0, 1) && ms <= jetzt) out.push([t.seit, new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)]);
  else if (t?.halle && halle) out.push([t.halle, halle]);
  return out;
}

// Stil fuer die Seite im Fenster. Die Kopfzeile der Seite (#topbar) und die
// Marke des Vorschau-Baus (Layout.astro, fest oben links) weichen: Beides
// traegt im Leitstand die Halle. --nav-h ist der Platz, den die Seiten unter
// der Kopfzeile frei lassen.
export const TERM_CSS = [
  // --nav-h: die Kopfzeile der Seite; --nav: dieselbe im Konto (account-dossier.css: .dsr{padding-top:var(--nav)}),
  // ohne sie stand die Kontoseite 64 px unter der Leiste des Terminals (23.11.2026)
  'html[data-vb-terminal]{--nav-h:0px!important;--nav:0px!important;scroll-padding-top:0!important}',
  'html[data-vb-terminal] #topbar,html[data-vb-terminal] body>div[lang][style*="2147483647"]{display:none!important}',
  // Schlanke Datenseiten (DataShell): der Pfad bleibt als Wegweiser stehen,
  // Startlink, Suchknopf und Sprachschalter traegt die Leiste des Fensters.
  'html[data-vb-terminal] .dp-bar>.dp-home,html[data-vb-terminal] .dp-bar>.dp-search,html[data-vb-terminal] .dp-bar>.dp-lang{display:none!important}',
  // Anmelden, Registrieren, Passwort (AccountShell.astro): Auf dem Schirm der
  // Halle zaehlt das Formular. Der hohe Kopf der Seite mit Bild schrumpft zu
  // einer Zeile mit dem Titel, damit Felder und Knopf ohne Scrollen dastehen,
  // auch im breitesten Fenster (zwei zu eins, etwa 550 px Hoehe fuer die Seite).
  'html[data-vb-terminal] .hero--acct{min-height:0!important;padding-top:.9rem!important;padding-bottom:.35rem!important}',
  'html[data-vb-terminal] .hero--acct .hero__photo,html[data-vb-terminal] .hero--acct .lead,html[data-vb-terminal] .hero--acct .eyebrow{display:none!important}',
  'html[data-vb-terminal] .hero--acct h1{margin:0!important;font-size:clamp(1.35rem,2.2vw,1.8rem)!important;line-height:1.15!important}',
  'html[data-vb-terminal] .hero--acct h1 .thin{display:inline!important;font-size:inherit!important;margin-right:.45em}',
  'html[data-vb-terminal] .hero--acct+.acwrap{padding-bottom:1rem!important}',
  'html[data-vb-terminal] .hero--acct+.acwrap .acx-card{padding:1.05rem 1.6rem!important}',
  'html[data-vb-terminal] .hero--acct+.acwrap .acx-field{margin-bottom:.85rem!important}',
  'html[data-vb-terminal] .hero--acct+.acwrap .acx-actions{margin-top:1rem!important}',
  'html[data-vb-terminal] .hero--acct+.acwrap .acx-links{margin-top:.9rem!important}',
  // Anmelden: der Schirm ist breit, nicht hoch. E-Mail links, Discord rechts
  // daneben (in der Folge des Dokuments), die Links darunter ueber beide Spalten.
  'html[data-vb-terminal] .hero--acct+.acwrap:has(#loginForm){max-width:880px!important}',
  'html[data-vb-terminal] .acx-card:has(>#loginForm){display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:2rem;align-items:start}',
  'html[data-vb-terminal] .acx-card:has(>#loginForm)>*{grid-column:1/-1}',
  'html[data-vb-terminal] .acx-card>#loginForm{grid-column:1;grid-row:3/span 2;padding-right:2rem;border-right:1px solid rgb(255 255 255/.12)}',
  'html[data-vb-terminal] .acx-card:has(>#loginForm)>.acx-divider{display:none}',
  'html[data-vb-terminal] .acx-card>#discordBtn{grid-column:2;grid-row:3;margin-top:1.5rem!important}',
  'html[data-vb-terminal] .acx-card:has(>#loginForm)>.dce{grid-column:2;grid-row:4}',
  'html[data-vb-terminal] .acx-card:has(>#loginForm)>.acx-links{grid-row:5}',
  // Registrieren: Discord links (der schnellste Weg, in der Folge des
  // Dokuments zuerst), rechts daneben die vier Felder in zwei Spalten.
  'html[data-vb-terminal] .hero--acct+.acwrap:has(#regForm){max-width:1080px!important}',
  'html[data-vb-terminal] .acx-card:has(>#regForm){display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2.2fr);column-gap:2rem;align-items:start}',
  'html[data-vb-terminal] .acx-card:has(>#regForm)>*{grid-column:1/-1}',
  'html[data-vb-terminal] .acx-card>#regDiscordBtn{grid-column:1;grid-row:1;margin-top:1.5rem!important}',
  'html[data-vb-terminal] .acx-card>#regDiscordStatus{grid-column:1;grid-row:2}',
  'html[data-vb-terminal] .acx-card:has(>#regForm)>.acx-or{display:none}',
  'html[data-vb-terminal] .acx-card>#regForm{grid-column:2;grid-row:1/span 3;padding-left:2rem;border-left:1px solid rgb(255 255 255/.12)}',
  'html[data-vb-terminal] .acx-card:has(>#regForm)>.acx-links{grid-row:4}',
  'html[data-vb-terminal] #regForm{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:1.4rem}',
  'html[data-vb-terminal] #regForm>:not(.acx-field){grid-column:1/-1}',
  // Der Hinweis zum Namen bleibt eine Zeile (neben ihm ist unter der E-Mail
  // Platz), der Satz zum Datenschutz steht neben dem Knopf statt darunter.
  'html[data-vb-terminal] #regForm .acx-hint{white-space:nowrap}',
  'html[data-vb-terminal] #regForm .acx-actions{flex-wrap:nowrap}',
  'html[data-vb-terminal] #regForm .acx-privacy{flex:1;min-width:0;font-size:var(--fs-7);line-height:1.45}',
].join('');

/**
 * @param {HTMLElement} box #hgx-term
 * @param {{ ship?: (id: string|null) => void, bild?: (cv: HTMLCanvasElement, o: { uhr: string }) => boolean, fakten?: () => { flotte?: number, schiff?: string, halle?: string }|null, wer?: (id: { name: string, zeichen: string, farbe: string }|null) => void, orte?: () => { feld?: string, halle?: string, werk?: string }|null, ort?: (to: 'halle'|'werk') => void, flotte?: () => Array<{ id: string, name: string, feld?: boolean }> }} hooks
 *   ship: ein Link zum Hangar wurde im Fenster gewaehlt, oder ein Schiff der Flotte im Ueberblick; bild: zeichnet das Sperrbild des Monitors auf die Leinwand der Blende (true: gezeichnet);
 *   fakten: was die Seite fuer die Karte weiss; wer: wer jetzt angemeldet ist (null: Gast), fuer das Bild auf dem Monitor;
 *   orte: was an den Orten der Halle steht (Schiff auf dem Feld, Hangargroesse, Fahrzeug der Werkhalle); ort: ein Ort im Ueberblick wurde gewaehlt;
 *   flotte: die Schiffe der Flotte, die die Seite kennt, mit Namen (feld: steht gerade auf dem Feld)
 * @returns {{ place: (rect: { l: number, t: number, r: number, b: number }|null) => void, auffrischen: () => void }}
 */
export function initTerminal(box, hooks = {}) {
  const doc = box.ownerDocument, win = doc.defaultView;
  const frame = box.querySelector('iframe');
  const links = [...box.querySelectorAll('a[data-term]')];
  const back = box.querySelector('#hgx-term-back'), search = box.querySelector('#hgx-term-search'), ext = box.querySelector('#hgx-term-ext');
  const startBtn = box.querySelector('#hgx-term-start'), ts = box.querySelector('#hgx-ts');
  const tools = links.map((a) => ({ key: a.dataset.term, pre: (a.dataset.pre ?? '').split(' ').filter(Boolean), href: a.href }));
  const home = tools.find((t) => t.key === box.dataset.home)?.href ?? tools[0]?.href;
  const here = win.location.href;
  const stack = [];
  const loadMsg = box.querySelector('#hgx-term-load'), loadText = loadMsg?.textContent ?? '';
  // seen: das eingerichtete Dokument; gone: eines, das gerade geht (pagehide)
  let seen = null, gone = null, poll = 0, started = false, offTimer = 0, fails = 0;
  // zeigt: 'start' (der Ueberblick steht vorn), 'seite' (die Seite im Fenster), '' (noch nichts);
  // ziel: Der Ueberblick oeffnet eine Seite und wartet, bis ein anderes Dokument als dieses bedienbar ist
  // (undefined: er wartet auf nichts, null: es stand noch keines im Fenster)
  let zeigt = '', ziel, zielTimer = 0;
  // unterwegs: eine Navigation des Fensters ist angefordert, ihr Dokument noch nicht da
  let unterwegs = false;

  const frameDoc = () => { try { return frame.contentDocument; } catch { return null; } };
  const urlOf = (d) => `${d.location.pathname}${d.location.search}${d.location.hash}`;
  // dieselbe Seite: Pfad und Abfrage, der Anker zaehlt nicht
  const page = (url) => { if (url === TERM_START) return url; try { const u = new URL(url, here); return `${u.pathname}${u.search}`; } catch { return url; } };
  // die juengste Seite im Verlauf des Fensters (der Ueberblick ist keine)
  const letzteSeite = () => stack.findLast((u) => u !== TERM_START) ?? home;
  const remember = () => {
    let v = null;
    if (zeigt === 'start') v = TERM_START;
    else { const d = frameDoc(); if (d && d === seen) v = urlOf(d); }
    if (v === null) return;
    try { win.sessionStorage.setItem(TERM_KEY, v); } catch { /* ohne Speicher beginnt das Terminal beim Ueberblick */ }
  };
  // Ziel von „In eigenem Tab öffnen“: die Seite, die im Fenster steht; vor dem Ueberblick die Startseite der Website
  const syncExt = () => {
    if (!ext) return;
    if (zeigt === 'start') { if (ts?.dataset.site) ext.href = new URL(ts.dataset.site, here).href; return; }
    const d = frameDoc();
    if (d && d === seen) ext.href = d.location.href;
  };
  const mark = (pathname) => {
    const key = termTool(pathname, tools);
    for (const a of links) {
      if (a.dataset.term === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    // das Konto ist kein Bereich der Leiste: Sein Knopf rechts ist dann der aktive
    const k = box.querySelector('#hgx-term-who');
    if (k && termKonto(pathname)) k.setAttribute('aria-current', 'page');
    else k?.removeAttribute('aria-current');
    startBtn?.removeAttribute('aria-current');
  };
  // Der Ueberblick ist der aktive Bereich: sein Knopf vorn in der Leiste, kein Reiter, nicht das Konto
  const markStart = () => {
    for (const a of links) a.removeAttribute('aria-current');
    box.querySelector('#hgx-term-who')?.removeAttribute('aria-current');
    startBtn?.setAttribute('aria-current', 'page');
  };

  // Eine Seite einrichten, sobald ihr Dokument steht: Stil, Klicks, Leiste.
  // false: die Seite gehoert nicht ins Fenster und ist schon abgewiesen.
  function dress(d) {
    const w = d.defaultView, r = termRoute(d.location.href, here);
    if (r.art === 'hangar' || (r.art === 'tab' && /^\/hangar/.test(ohneSprache(d.location.pathname)))) {
      // per Skript oder Formular doch beim Hangar gelandet: zurueck, das Schiff aufs Feld
      const last = letzteSeite();
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
    w.addEventListener('pagehide', () => { gone = d; box.classList.remove('is-ready'); watch(); nachAnmeldung(); });
    w.addEventListener('pageshow', (e) => { if (e.persisted && gone === d) { gone = null; watch(); } });
    seen = d;
    fails = 0;
    unterwegs = false;
    if (loadMsg) loadMsg.textContent = loadText;
    box.removeAttribute('data-fehler');
    const url = urlOf(d);
    // Laedt die Seite hinter dem Ueberblick neu, ohne dass er sie geoeffnet
    // hat, bleibt er oben im Verlauf: Der Pfeil fuehrt von ihm zu ihr.
    const vorn = zeigt === 'start' && ziel === undefined && stack.at(-1) === TERM_START ? stack.pop() : null;
    if (!stack.length || page(stack.at(-1)) !== page(url)) stack.push(url);
    else stack[stack.length - 1] = url;
    if (vorn) stack.push(vorn);
    if (stack.length > TERM_STACK) stack.shift();
    back.disabled = stack.length < 2;
    if (vorn) markStart();
    else mark(d.location.pathname);
    remember();
    syncExt();
    return true;
  }
  // Das Dokument im Fenster ist bedienbar. Wartet der Ueberblick auf eine
  // Seite, die er geoeffnet hat, und ist es diese (nicht die von vorher), tritt
  // er zurueck.
  function bereit() {
    box.classList.add('is-ready');
    if (ziel !== undefined && seen && seen !== ziel && seen !== gone) zeigeSeite();
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
    unterwegs = true;
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
      if (done) bereit();
      // eine fremde oder abgewiesene Adresse liefert kein Dokument: dann endet das Nachsehen von selbst
      if (done || win.performance.now() - t0 > 30000) { win.clearInterval(poll); poll = 0; }
    }, 30);
  }
  // Die alte Seite bleibt stehen, bis die neue kommt (pagehide), wie in jedem
  // Browser. Vom Ueberblick aus bleibt er stehen, bis die neue bedienbar ist.
  function go(url) {
    const d = frameDoc(), steht = !!d && d === seen && d !== gone && page(url) === page(urlOf(d));
    let anker = '';
    try { anker = new URL(url, here).hash; } catch { /* dann ohne Anker */ }
    // Dieselbe Seite steht schon im Fenster, nur hinter dem Ueberblick: gleich zeigen, statt sie neu zu laden
    if (steht && (!anker || anker === d.location.hash)) {
      // Wie jeder Klick im Browser beendet sie eine Navigation, die noch
      // unterwegs ist: sonst kaeme deren Seite spaeter doch noch nach vorn
      // (Kachel B, gleich danach Kachel A).
      if (unterwegs) {
        try { frame.contentWindow.stop(); } catch { /* dann kommt die andere Seite */ }
        unterwegs = false;
      }
      // Wie beim Einrichten (dress): Sie kommt in den Verlauf, wenn sie nicht
      // schon oben steht. Der Pfeil fuehrt dann zum Ueberblick zurueck.
      if (!stack.length || page(stack.at(-1)) !== page(url)) {
        stack.push(urlOf(d));
        if (stack.length > TERM_STACK) stack.shift();
      }
      back.disabled = stack.length < 2;
      if (zeigt !== 'seite') zeigeSeite();
      return;
    }
    if (zeigt === 'start') {
      ziel = seen;
      box.setAttribute('data-wechsel', '');
      win.clearTimeout(zielTimer);
      zielTimer = win.setTimeout(zeigeSeite, TERM_WECHSEL_MS);
    }
    // Nur der Anker ist anders (Konto #friends, Raffinerie #tracker): Die
    // Seiten lesen ihn beim Laden, also nach dem Ersetzen einmal neu laden.
    unterwegs = true;
    try {
      frame.contentWindow.location.replace(url);
      if (steht) frame.contentWindow.location.reload();
    } catch { frame.src = url; }
    try { mark(new URL(url, here).pathname); } catch { /* die Leiste folgt, sobald die Seite steht */ }
    watch();
  }
  // Der Ueberblick tritt nach vorn. merken: als Eintrag im Verlauf des
  // Fensters (nicht, wenn der Pfeil zu ihm zurueckfuehrt).
  function zeigeStart(merken = true) {
    if (!ts) return false;
    win.clearTimeout(zielTimer);
    ziel = undefined;
    box.removeAttribute('data-wechsel');
    if (merken && stack.at(-1) !== TERM_START) {
      stack.push(TERM_START);
      if (stack.length > TERM_STACK) stack.shift();
    }
    back.disabled = stack.length < 2;
    zeigt = 'start';
    box.dataset.zeigt = 'start';
    // hinter dem Ueberblick ist die Seite nicht zu bedienen, auch nicht mit der Tabulatortaste
    frame.inert = true;
    markStart();
    remember();
    syncExt();
    startMalen();
    return true;
  }
  // Die Seite im Fenster tritt nach vorn (der Ueberblick blendet aus)
  function zeigeSeite() {
    win.clearTimeout(zielTimer);
    ziel = undefined;
    box.removeAttribute('data-wechsel');
    if (zeigt === 'seite') return;
    const fokus = !!ts?.contains(doc.activeElement);
    zeigt = 'seite';
    box.dataset.zeigt = 'seite';
    frame.inert = false;
    stopTakt();
    const d = frameDoc();
    if (d && d === seen) mark(d.location.pathname);
    else startBtn?.removeAttribute('aria-current');
    remember();
    syncExt();
    // Stand der Fokus im Ueberblick, geht er auf den Bereich der Leiste, der jetzt gilt (der Ueberblick wird unsichtbar)
    if (fokus) (box.querySelector('.hgx-term__bar [aria-current="page"]') ?? back)?.focus({ preventScroll: true });
  }
  // Nach jedem fertigen Laden: Steht ein Dokument da, das dress() nie sah,
  // jetzt einrichten. Steht keines da (fremde Adresse oder vom Browser
  // abgewiesen, etwa weil der Server das Rahmen verbietet), einmal zurueck
  // zur letzten Seite; scheitert auch die, sagt das Fenster, wie es
  // weitergeht (data-fail), statt endlos neu zu laden.
  frame.addEventListener('load', () => {
    if (!started) return;
    unterwegs = false;
    const d = frameDoc();
    if (!d) {
      box.classList.remove('is-ready');
      if (fails++ < 1) go(letzteSeite());
      else {
        if (loadMsg) loadMsg.textContent = loadMsg.dataset.fail ?? loadText;
        box.setAttribute('data-fehler', '');
        // Wartet der Ueberblick auf diese Seite, sagt jetzt das Fenster, wie es weitergeht
        if (ziel !== undefined) zeigeSeite();
      }
      return;
    }
    if (d.location.href === 'about:blank') return;
    if (d !== seen && d.documentElement) dress(d);
    if (d === seen) { gone = null; bereit(); }
  });

  function start() {
    started = true;
    // Eine neue Sitzung beginnt beim Ueberblick (Etappe 2 des Konzepts,
    // 23.11.2026): Er nennt, wer davor sitzt, und fuehrt zu allem. Bis dahin
    // begann sie mit Konto auf der Kontoseite (Krisz 15.11.2026: „man meldet
    // sich an seinem bildschirm an, man hat so alles im überblick“): Das
    // Konto steht jetzt im Ueberblick, sein Knopf fuehrt dorthin. Danach gilt,
    // was zuletzt auf dem Schirm stand (termErste).
    let last = null;
    try { last = win.sessionStorage.getItem(TERM_KEY); } catch { /* ohne Speicher der Ueberblick */ }
    const erste = termErste(last, here);
    if (erste === TERM_START && zeigeStart()) return;
    zeigt = 'seite';
    box.dataset.zeigt = 'seite';
    const ziel0 = erste === TERM_START ? home : erste;
    if (ziel0) go(ziel0);
  }

  // Die Leiste: Bereiche wechseln im Fenster. Mit Strg, Umschalt oder der
  // mittleren Taste bleibt es ein gewoehnlicher Link.
  box.querySelector('.hgx-term__nav')?.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-term]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(a.href);
  });
  startBtn?.addEventListener('click', () => zeigeStart());
  back?.addEventListener('click', () => {
    if (stack.length < 2) return;
    stack.pop();
    back.disabled = stack.length < 2;
    const to = stack.at(-1);
    if (to === TERM_START) zeigeStart(false);
    else go(to);
  });
  // Die Suche: Vor dem Ueberblick ist es seine eigene (das Feld oben in der
  // Mitte). Auf einer Seite die der Seite: Seiten mit voller Navigation
  // oeffnet jeder Ausloeser mit data-scs-open (assets/search-overlay.js), die
  // schlanken Datenseiten holen sie erst ueber ihren eigenen Knopf
  // (data-scs-boot, assets/data-search.js). Beide Knoepfe sind im Fenster
  // ausgeblendet, ein Klick per Skript erreicht sie trotzdem. Der Fokus geht
  // mit ins Fenster.
  const hsIn = ts?.querySelector('#hs-in');
  function suchen() {
    if (zeigt === 'start' && hsIn) {
      hsIn.focus({ preventScroll: true });
      hsIn.select?.();
      return;
    }
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
  }
  search?.addEventListener('click', suchen);
  // Strg+K, solange das Terminal offen ist: die Suche des Schirms, nicht der
  // Dialog der Hangarseite (der laege ueber der Halle). In der Einfangphase,
  // vor der Seitensuche. Steht die Blende, gilt die Taste der Seite.
  win.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key !== 'k' && e.key !== 'K')) return;
    if (!box.classList.contains('is-on') || box.hidden || !zeigt || (login && !login.hidden)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    suchen();
  }, true);
  // Treffer der Suche der Hangarseite (das Feld des Ueberblicks und der
  // Dialog): solange das Terminal offen ist, auf den Schirm. Ein Treffer im
  // Hangar holt das Schiff aufs Feld. Sonst entscheidet die Suche selbst
  // (assets/search-overlay.js, weiter).
  win.vbSucheWeg = (url) => {
    if (!box.classList.contains('is-on') || box.hidden) return false;
    const r = termRoute(url, here);
    if (r.art === 'hangar') { hooks.ship?.(r.ship); return true; }
    if (r.art !== 'innen') return false;
    go(url);
    return true;
  };
  // „In eigenem Tab öffnen“ meint die Seite, die gerade im Fenster steht.
  // Nachgezogen wird, bevor der Link auf irgendeinem Weg ausgeloest wird:
  // Mittelklick und das Kontextmenue kennen kein click, und eine Seite kann
  // ihre Adresse aendern, ohne neu zu laden (Anker, Filter in der Abfrage).
  for (const ev of ['pointerenter', 'pointerdown', 'focus', 'contextmenu', 'click']) ext?.addEventListener(ev, syncExt);
  win.addEventListener('pagehide', remember);

  // ---- Anmeldung ----------------------------------------------------------
  const who = box.querySelector('#hgx-term-who'), login = box.querySelector('#hgx-term-login');
  const lwahl = box.querySelector('#hgx-term-lwahl');
  const lstep = box.querySelector('#hgx-term-lstep-b'), lname = box.querySelector('#hgx-term-lname'), lsub = box.querySelector('#hgx-term-lsub');
  const lid = box.querySelector('#hgx-term-lid'), lhallo = box.querySelector('#hgx-term-lhallo'), lfakt = box.querySelector('#hgx-term-lfakt'), lbild = box.querySelector('#hgx-term-lbild');
  const ruhig = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  // wer: zuletzt gezeigt (undefined: noch nie gefragt, null: Gast); lauf zaehlt die Anmeldungen, damit eine ueberholte nichts mehr setzt
  // frage: die Antwort des Kontos, auf die die laufende Anmeldung wartet;
  // gefragt: fuer welches Konto sie gestellt wurde (null: die Antwort steht in der Leiste)
  // an: wen die Blende in dieser Sitzung zuletzt begruesst hat (Kennung des Kontos oder TERM_GAST), null: noch niemanden
  // wartet: Auf der Anmeldeseite im Fenster ist eine Sitzung entstanden, die Begruessung steht noch aus (nachAnmeldung)
  let wer, lauf = 0, loginTimer = 0, frage = null, gefragt = null, winkTimer = 0, schriften = null, an = null, wartet = false;
  try { an = win.sessionStorage.getItem(TERM_AN); } catch { /* ohne Speicher gilt das Gedaechtnis dieses Seitenaufrufs */ }
  const merke = (id) => {
    an = id ? id.uid : TERM_GAST;
    try { win.sessionStorage.setItem(TERM_AN, an); } catch { /* s. o. */ }
  };
  // das Konto der gespeicherten Sitzung, ohne Netz ('' ohne Sitzung)
  const kontoJetzt = () => { try { return String(win.VBAccount?.peek?.()?.user?.id ?? ''); } catch { return ''; } };

  // Bild oder Zeichen in einen Kreis (.hgx-term__av): Laedt das Bild nicht
  // (fremder Host, den die Seite nicht zulaesst, oder es ist fort), bleibt das Zeichen.
  function avatarInto(av, id) {
    if (!av) return;
    const z = av.querySelector('span'), img = av.querySelector('img');
    av.style.setProperty('--av', id?.farbe ?? '');
    if (z) z.textContent = id?.zeichen ?? '◆';
    if (!img) return;
    img.hidden = true;
    img.onload = img.onerror = null;
    if (!id?.bild) { img.removeAttribute('src'); return; }
    img.onload = () => { img.hidden = false; };
    img.onerror = () => { img.hidden = true; };
    img.referrerPolicy = 'no-referrer';
    img.src = id.bild;
  }
  // Die Leiste nennt, wer angemeldet ist, und fuehrt zum Konto oder zur Anmeldung
  function showWho(id) {
    if (!who) return;
    const label = who.querySelector('b'), name = id ? id.name || who.dataset.lAcct : who.dataset.lLogin;
    who.dataset.who = id ? 'user' : 'guest';
    who.href = id ? who.dataset.dash : who.dataset.login;
    if (label) label.textContent = name ?? '';
    who.setAttribute('aria-label', id ? (who.dataset.aUser ?? '').replace('{name}', name ?? '') : who.dataset.aGuest ?? '');
    avatarInto(who.querySelector('.hgx-term__av'), id);
    passeLeiste();
  }
  // Die Leiste traegt die groesste Form, in der kein Bereich abgeschnitten
  // wird: ohne Spielversion (1), dazu ohne Namen des Kontos (2), dazu
  // „Überblick“ nur als Zeichen (3). Gemessen wird, was der Browser setzt
  // (Breite des Kastens, Sprache, Name des Kontos, Schrift).
  function passeLeiste() {
    const nav = box.querySelector('.hgx-term__nav');
    if (!nav || box.hidden) return;
    for (const stufe of ['', '1', '2', '3']) {
      if (stufe) box.dataset.leiste = stufe;
      else box.removeAttribute('data-leiste');
      if (nav.scrollWidth <= nav.clientWidth + 1) return;
    }
  }
  // Die Antwort des Kontos gilt: merken, in die Leiste, die Frage ist erledigt
  // und der Monitor der Halle erfaehrt, wessen Sitzung es ist (hooks.wer)
  const setze = (id) => {
    wer = id; gefragt = null;
    showWho(id);
    // der Ueberblick nennt dasselbe, und mit einem anderen Konto andere Zahlen
    if (ts) { malIch(); malKonto(); }
    try { hooks.wer?.(id ? { name: id.name || who?.dataset.lAcct || '', zeichen: id.zeichen, farbe: id.farbe } : null); } catch { /* das Bild der Halle ist Zugabe */ }
  };
  // Das Konto fragen: die Sitzung der Seite, dann die eigene Profilzeile.
  // Ohne Konto-Skript, ohne Sitzung oder ohne Antwort in der Frist: Gast.
  async function ident() {
    const acct = win.VBAccount;
    if (!acct?.session) return null;
    const sess = await acct.session().catch(() => null), uid = sess?.user?.id;
    if (!uid) return null;
    const stop = new win.AbortController(), frist = win.setTimeout(() => stop.abort(), TERM_LOGIN.frist);
    try {
      const r = await acct.rest(sess, 'GET', `profiles?select=display_name,handle,avatar_url,avatar_icon,avatar_color&id=eq.${encodeURIComponent(uid)}`, null, null, stop.signal);
      const rows = r.ok ? await r.json() : [];
      return mitSeit(termIdent(uid, Array.isArray(rows) ? rows[0] ?? null : null), sess);
    } catch {
      // angemeldet, aber das Profil kam nicht: Das Konto bleibt ein Konto
      return mitSeit(termIdent(uid, null), sess);
    } finally { win.clearTimeout(frist); }
  }
  // seit wann es das Konto gibt, steht in der Sitzung (termFakten prueft den Wert)
  const mitSeit = (id, sess) => { if (id) id.seit = typeof sess?.user?.created_at === 'string' ? sess.user.created_at : ''; return id; };
  const uhr = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  // Grund der Blende: das Sperrbild des Monitors, in den Pixeln, die der
  // Kasten gerade auf dem Schirm einnimmt (er steht skaliert im Bild). Ohne
  // Buehne oder wenn das Zeichnen scheitert, bleibt die Wortmarke als Schrift.
  function bildMalen() {
    if (!login || !lbild) return;
    let ok = false;
    try {
      const r = login.getBoundingClientRect(), dpr = Math.min(2, win.devicePixelRatio || 1);
      const w = Math.round(Math.min(2800, r.width * dpr)), h = Math.round((w * r.height) / Math.max(1, r.width));
      if (hooks.bild && w > 8 && h > 8) {
        lbild.width = w; lbild.height = h;
        ok = hooks.bild(lbild, { uhr: uhr() }) === true;
      }
    } catch { ok = false; }
    login.toggleAttribute('data-bild', ok);
  }
  // Die Karte: Bild, Gruss, Name, darunter die Zeilen aus termFakten
  function karte(da) {
    // „Willkommen“ gilt dem Konto, das eben erst entstanden ist, jedem anderen „Willkommen zurück“
    const kennt = !!da && termGruss(da.seit) === 'zurueck';
    avatarInto(login.querySelector('.hgx-term__av'), da);
    lid?.style.setProperty('--av', da?.farbe ?? '');
    // die Karte des Gasts steht enger, unter ihr folgen die drei Wege (Stil in HangarPage.astro)
    lid?.classList.toggle('hgx-term__lid--gast', !da);
    if (lhallo) lhallo.textContent = da ? (kennt ? login.dataset.lZurueck : login.dataset.lHallo) ?? '' : '';
    if (lname) lname.textContent = da ? da.name || who?.dataset.lAcct || '' : login.dataset.lGast ?? '';
    if (lsub) lsub.textContent = da ? da.sub : login.dataset.lGastsub ?? '';
    if (!lfakt) return;
    let roh = null;
    try { roh = hooks.fakten?.() ?? null; } catch { roh = null; }
    const D = login.dataset, zeilen = termFakten(roh, { flotte: D.fFlotte, schiff1: D.fSchiff1, schiffn: D.fSchiffn, leer: D.fLeer, feld: D.fFeld, halle: D.fHangar, seit: D.fSeit }, da?.seit ?? '', doc.documentElement.lang);
    lfakt.replaceChildren(...zeilen.map(([k, v], i) => {
      const li = doc.createElement('li'), a = doc.createElement('span'), b = doc.createElement('b');
      li.style.setProperty('--i', String(i));
      a.textContent = k; b.textContent = v;
      li.append(a, b);
      return li;
    }));
  }
  const warte = (ms) => new Promise((ok) => { loginTimer = win.setTimeout(ok, ms); });
  // Blende zu; loginOff bricht dazu ab, was noch laeuft (die Kamera geht)
  function loginZu() {
    win.clearTimeout(loginTimer);
    if (login) { login.hidden = true; login.removeAttribute('data-step'); }
  }
  function loginOff() {
    lauf++;
    loginZu();
  }
  // Die Blende oeffnet sich und gibt die Seite frei; gast: der Knopf der Leiste zeigt danach kurz den Weg zum Konto
  async function auf(n, gast) {
    const still = !!ruhig?.matches;
    win.clearTimeout(loginTimer);
    login.dataset.step = 'out';
    await warte(still ? 0 : TERM_LOGIN.aus);
    if (n !== lauf) return;
    loginZu();
    if (gast && who && !still) {
      who.classList.add('is-hint');
      winkTimer = win.setTimeout(() => who.classList.remove('is-hint'), TERM_LOGIN.wink);
    }
  }
  // Die Blende: das Sperrbild, „Anmeldung …“, dann wer es ist. Ein Konto gibt
  // sie nach der Karte von selbst frei; beim Gast bleibt sie stehen, bis er
  // einen der drei Wege waehlt (#hgx-term-lwahl).
  // seite: Die Seite steht gerade offen im Fenster (jemand hat sich darin an-
  // oder abgemeldet). Dann faehrt die Blende erst zu, statt in einem Bild da
  // zu sein. Beim Hinsetzen steht sie sofort: Auf dem Glas stand dasselbe Bild.
  async function signIn(seite = false) {
    const n = ++lauf, still = !!ruhig?.matches;
    win.clearTimeout(loginTimer);
    win.clearTimeout(winkTimer);
    who?.classList.remove('is-hint');
    gefragt = kontoJetzt();
    const echt = (frage = ident()), bald = Promise.race([echt, new Promise((ok) => win.setTimeout(() => ok(undefined), TERM_LOGIN.frist + 200))]);
    // Kommt die Antwort erst nach der Frist (die Sitzung wird gerade erneuert),
    // zieht die Leiste still nach, solange keine neuere Anmeldung laeuft
    bald.then((id) => { if (id === undefined) echt.then((spaet) => { if (n === lauf || (frage === echt && wer === undefined)) setze(spaet); }); });
    if (!login) { const id = await bald; if (n === lauf && id !== undefined) { setze(id); merke(id); } return; }
    login.removeAttribute('data-who');
    // zu: von der offenen Seite her, auch aus einer Blende, die eben aufgeht (dann von dort, wo sie steht)
    const zu = !still && (login.hidden ? seite : login.dataset.step === 'out');
    if (login.hidden) { login.dataset.step = zu ? 'out' : 'boot'; login.hidden = false; }
    bildMalen();
    // Die Schriften des Bilds kommen beim ersten Mal vielleicht erst jetzt: dann noch einmal
    schriften ??= doc.fonts?.load ? Promise.all(TERM_FONTS.map((f) => doc.fonts.load(f))).then(() => true, () => false) : Promise.resolve(false);
    schriften.then((da) => { if (da && n === lauf && !login.hidden) bildMalen(); });
    // erst ein Layout mit dem Anfang, sonst fallen der Weg der Blende und der Lauf des Balkens aus
    void login.offsetWidth;
    if (zu) {
      login.dataset.step = 'zu';
      await warte(TERM_LOGIN.aus);
      if (n !== lauf) return;
    }
    login.dataset.step = 'boot';
    // das Sperrbild steht einen Augenblick ruhig, so wie eben noch auf dem Glas (nach dem Zufahren kuerzer)
    if (!still) { await warte(zu ? Math.round(TERM_LOGIN.boot / 2) : TERM_LOGIN.boot); if (n !== lauf) return; }
    login.dataset.step = 'auth';
    const [id] = await Promise.all([bald, still ? 0 : warte(TERM_LOGIN.auth)]);
    if (n !== lauf) return;
    // keine Antwort in der Frist: wer zuletzt hier sass, bleibt stehen
    if (id !== undefined) setze(id);
    const da = wer ?? null;
    if (id === undefined) showWho(da);
    karte(da);
    if (lstep) lstep.textContent = (da ? login.dataset.lUser : login.dataset.lGuest) ?? '';
    login.dataset.who = da ? 'user' : 'guest';
    login.dataset.step = da ? 'user' : 'guest';
    // begruesst: In dieser Sitzung kommt die Blende fuer ihn nicht wieder
    merke(da);
    if (!da) return;
    await warte(zeitHalten());
    if (n !== lauf) return;
    auf(n, false);
  }
  // wie lange die Karte steht; ohne Bewegung kuerzer, sie ist dann sofort ganz da
  const zeitHalten = () => (ruhig?.matches ? Math.round(TERM_LOGIN.hold / 2) : TERM_LOGIN.hold);
  // Hingesetzt: einmal je Sitzung die Blende, sonst gleich die Seite. Die
  // Leiste fragt das Konto dann leise, ohne Blende.
  function hinsetzen() {
    if (termBlende(an, kontoJetzt())) { signIn(); return; }
    // Steht vom Sitzen davor noch eine Blende, geht sie zu: Wer waehrend der
    // Karte aufsteht und sich in derselben Drittelsekunde wieder setzt, hat
    // ihr mit place(null) den Abschluss genommen, und loginOff kam nicht mehr.
    if (login && !login.hidden) loginZu();
    const n = ++lauf;
    gefragt = kontoJetzt();
    const echt = (frage = ident());
    echt.then((id) => { if (n === lauf || (frage === echt && wer === undefined)) setze(id); });
  }
  // Ein Klick ueberspringt den Rest: Die Blende ist eine Begruessung, keine
  // Sperre. Wer es ist, sagt die Leiste, sobald das Konto geantwortet hat:
  // dieselbe Frage, auf die die Blende gewartet haette, nicht der Stand davor.
  // Die drei Wege des Gasts behandeln ihren Klick selbst (lwahl).
  function ueberspringen() {
    // beim Gast haelt die Blende, bis er einen der drei Wege waehlt: Ein Klick daneben soll sie ihm nicht nehmen
    if (!login || login.hidden || login.dataset.step === 'out' || login.dataset.step === 'guest') return;
    const n = ++lauf, gast = login.dataset.who === 'guest';
    win.clearTimeout(loginTimer);
    (frage ?? ident()).then((id) => { if (n === lauf) { setze(id); merke(id); } });
    auf(n, gast);
  }
  login?.addEventListener('pointerdown', (e) => {
    if (lwahl?.contains(e.target)) return;
    ueberspringen();
  });
  // Die drei Wege des Gasts: Anmelden und Konto erstellen sind echte Links ins
  // Fenster (mit Strg oder der mittleren Taste oeffnen sie wie jeder Link einen
  // eigenen Tab), „Als Gast weiter“ gibt nur die Seite frei.
  lwahl?.addEventListener('click', (e) => {
    const el = e.target.closest?.('a[href],button');
    if (!el || !lwahl.contains(el) || login.hidden || login.dataset.step === 'out') return;
    if (el.tagName === 'A') {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(el.href);
    }
    const n = ++lauf;
    auf(n, el.tagName !== 'A');
  });
  // Der Knopf der Leiste fuehrt ins Fenster: zum Konto, ohne Konto zur Anmeldung
  who?.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(who.href);
  });
  // An- oder abgemeldet, in diesem oder einem anderen Tab: Sitzt jemand vor
  // dem Terminal und ist es ein anderes Konto als eben, meldet es neu an.
  // Eine nur erneuerte Sitzung desselben Kontos aendert nichts.
  win.addEventListener('vb-account-session', () => {
    if (wer === undefined && gefragt === null) return;
    // laeuft gerade eine Frage, zaehlt das Konto, fuer das sie gestellt wurde, sonst das zuletzt gezeigte
    if (kontoJetzt() === (gefragt ?? wer?.uid ?? '')) return;
    // Niemand sitzt davor: Das naechste Hinsetzen fragt neu. Eine Antwort, die
    // noch aussteht, galt dem Konto davor und setzt nichts mehr (frage).
    if (!box.classList.contains('is-on')) { wer = undefined; gefragt = null; frage = null; return; }
    // Die Sitzung ist auf der Anmeldeseite im Fenster entstanden, die Seite
    // steht offen: Sie fuehrt die Anmeldung erst zu Ende (zweiter Faktor) und
    // geht dann weiter. Die Blende laege sonst ueber der Frage nach dem Code.
    if (kontoJetzt() && login?.hidden && beimAnmelden()) { wartet = true; return; }
    signIn(true);
  });
  const beimAnmelden = () => { const d = frameDoc(); return !!d && d === seen && d !== gone && termAnmeldung(d.location.pathname); };
  // Die Anmeldeseite im Fenster geht (weiter zum Konto, oder jemand verlaesst
  // sie): jetzt die Begruessung, wenn das Konto inzwischen ein anderes ist.
  // Hat er die Frage nach dem Code abgebrochen, ist er wieder abgemeldet und
  // nichts geschieht.
  function nachAnmeldung() {
    if (!wartet) return;
    wartet = false;
    if (!box.classList.contains('is-on') || kontoJetzt() === (gefragt ?? wer?.uid ?? '')) return;
    signIn(true);
  }

  // ---- Ueberblick ---------------------------------------------------------
  // Gefuellt wird, was nur die laufende Seite weiss: wer davor sitzt
  // (dieselbe Antwort wie die Leiste), Uhr und Tag, was an den Orten der
  // Halle steht, die Flotte und mit Konto seine Zahlen. Die Woerter stehen im
  // Markup (data-… an #hgx-ts), keines hier.
  const T = ts?.dataset ?? {};
  const loc = /^de/i.test(doc.documentElement.lang ?? '') ? 'de-DE' : 'en-GB';
  const nf = new Intl.NumberFormat(loc), tagFmt = new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short' });
  const tsEl = (id) => ts?.querySelector(`#${id}`) ?? null;
  const zahlenEl = tsEl('hgx-ts-zahlen'), gastEl = tsEl('hgx-ts-gast');
  const fuell = (s, n) => String(s ?? '').replace('{n}', nf.format(n));
  // takt: Uhr und Countdown der Raffinerie, solange der Ueberblick vorn steht;
  // daten: die Zahlen des Kontos { uid, t, ref, craft, freunde, fav } (undefined: noch nicht da, null: nicht erreichbar);
  // datenLauf zaehlt die Abrufe, damit ein ueberholter nichts mehr setzt; breit: Breite des Kastens beim letzten Kuerzen der Flotte
  let takt = 0, daten = null, datenLauf = 0, datenStop = null, breit = 0, schlag = 0;

  function startMalen() {
    if (!ts) return;
    malIch();
    malUhr();
    malOrte();
    malFlotte();
    malKonto();
    if (!takt) takt = win.setInterval(tick, 1000);
  }
  function stopTakt() {
    if (takt) win.clearInterval(takt);
    takt = 0;
  }
  function tick() {
    if (zeigt !== 'start' || !box.classList.contains('is-on')) { stopTakt(); return; }
    malUhr();
    malRef();
    // Steht der Ueberblick laenger, verfallen die Zahlen des Kontos (TERM_DATEN_MS):
    // alle zehn Schlaege nachsehen, malKonto holt nur, wenn sie alt sind (Review PR #407)
    if (++schlag % 10 === 0) malKonto();
  }
  // Wer davor sitzt: wie die Leiste. Bevor das Konto geantwortet hat, steht
  // bei einer gespeicherten Sitzung schlicht „Konto“, nicht kurz der Gast.
  function malIch() {
    const ich = tsEl('hgx-ts-ich');
    if (!ich) return;
    const id = wer ?? null, offen = wer === undefined && !!kontoJetzt();
    ich.href = (id || offen ? ich.dataset.dash : ich.dataset.login) ?? ich.href;
    avatarInto(ich.querySelector('.hgx-term__av'), id);
    const gruss = tsEl('hgx-ts-gruss'), name = tsEl('hgx-ts-name'), sub = tsEl('hgx-ts-sub');
    if (gruss) gruss.textContent = id ? (termGruss(id.seit) === 'zurueck' ? T.lZurueck : T.lHallo) ?? '' : '';
    if (name) name.textContent = id || offen ? id?.name || T.lAcct || '' : T.lGast ?? '';
    if (sub) sub.textContent = id || offen ? id?.sub || T.lKontosub || '' : T.lGastsub ?? '';
  }
  function malUhr() {
    const u = tsEl('hgx-ts-uhr'), t = tsEl('hgx-ts-tag'), jetzt = uhr();
    if (u && u.textContent !== jetzt) u.textContent = jetzt;
    if (t) t.textContent = tagFmt.format(new Date());
  }
  // Die Orte: was dort steht, sonst die Zeile aus dem Markup
  function malOrte() {
    let o = null;
    try { o = hooks.orte?.() ?? null; } catch { o = null; }
    const text = (v) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');
    for (const b of ts.querySelectorAll('[data-ort]')) {
      const s = b.querySelector('[data-ts-ort]'), was = b.dataset.ort;
      if (!s) continue;
      s.dataset.vor ??= s.textContent;
      const jetzt = was === 'halle' ? [text(o?.feld), text(o?.halle)].filter(Boolean).join(' · ') : was === 'werk' ? text(o?.werk) : '';
      s.textContent = jetzt || s.dataset.vor;
      if (was !== 'leit') b.title = (T.lOrtA ?? '').replace('{ort}', b.querySelector('b')?.textContent ?? '');
    }
  }
  // Die Flotte als Chips: das Schiff auf dem Feld zuerst, dann nach Namen
  function malFlotte() {
    const ul = tsEl('hgx-ts-chips'), leer = tsEl('hgx-ts-fleer'), fn = tsEl('hgx-ts-fn');
    if (!ul) return;
    let liste = [];
    try { liste = hooks.flotte?.() ?? []; } catch { liste = []; }
    liste = (Array.isArray(liste) ? liste : []).filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && s.name.trim());
    liste.sort((a, b) => Number(b.feld === true) - Number(a.feld === true) || a.name.localeCompare(b.name, loc));
    const n = liste.length;
    if (fn) fn.textContent = n === 0 ? T.fLeer ?? '' : n === 1 ? T.fSchiff1 ?? '' : fuell(T.fSchiffn, n);
    ul.replaceChildren(...liste.map((s) => {
      const li = doc.createElement('li'), b = doc.createElement('button'), sp = doc.createElement('span');
      b.type = 'button';
      b.className = 'hgx-ts__chip';
      b.dataset.id = s.id;
      b.title = (T.lHol ?? '').replace('{name}', s.name.trim());
      if (s.feld === true) b.setAttribute('aria-current', 'true');
      sp.textContent = s.name.trim();
      b.append(sp);
      li.append(b);
      return li;
    }));
    ul.hidden = !n;
    if (leer) leer.hidden = n > 0;
    breit = box.offsetWidth;
    kappen(ul);
  }
  // Passen nicht alle Schiffe in die Zeilen der Flotte, stehen die letzten als „+n“ (ihre Namen im Titel)
  function kappen(ul) {
    if (ul.hidden || ul.scrollHeight <= ul.clientHeight + 1) return;
    const li = doc.createElement('li'), m = doc.createElement('span'), chips = [...ul.children], weg = [];
    m.className = 'hgx-ts__chip hgx-ts__chip--mehr';
    li.append(m);
    ul.append(li);
    for (let i = chips.length - 1; i > 0 && ul.scrollHeight > ul.clientHeight + 1; i--) {
      chips[i].hidden = true;
      weg.unshift(chips[i].textContent);
      m.textContent = fuell(T.lMehr, weg.length);
    }
    if (!weg.length) li.remove();
    else m.title = weg.join(', ');
  }
  // Mit Konto die Zahlen, ohne die Einladung zum Konto. Geholt wird, wenn
  // der Ueberblick vorn steht und die Zahlen aelter als TERM_DATEN_MS sind.
  function malKonto() {
    if (!zahlenEl || !gastEl) return;
    const uid = wer ? wer.uid : wer === undefined ? kontoJetzt() : '';
    zahlenEl.hidden = !uid;
    gastEl.hidden = !!uid;
    if (!uid) {
      datenStop?.abort();
      datenLauf++;
      daten = null;
      return;
    }
    if (daten?.uid !== uid) {
      datenStop?.abort();
      datenLauf++;
      daten = { uid, t: 0 };
    }
    malZahlen();
    if (zeigt === 'start' && !daten.laedt && Date.now() - daten.t >= TERM_DATEN_MS) holen(uid);
  }
  async function holen(uid) {
    const acct = win.VBAccount;
    if (!acct?.session || !acct.rest || !daten) return;
    datenStop?.abort();
    const stop = (datenStop = new win.AbortController()), n = ++datenLauf, D = daten;
    D.laedt = true;
    const frist = win.setTimeout(() => stop.abort(), 8000);
    try {
      const sess = await acct.session().catch(() => null);
      if (n !== datenLauf || String(sess?.user?.id ?? '') !== uid) return;
      const q = encodeURIComponent(uid);
      const get = (pfad) => acct.rest(sess, 'GET', pfad, null, null, stop.signal)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((x) => (Array.isArray(x) ? x : Promise.reject(new Error('Form'))))
        .catch(() => null);
      const [ref, craft, anf, dm, fav, lo] = await Promise.all([
        get(`refinery_jobs?select=station,started_at,ready_at,status&status=eq.active&user_id=eq.${q}&order=ready_at&limit=50`),
        get(`crafting_entries?select=owned,plan_qty&user_id=eq.${q}&limit=5000`),
        get(`friend_requests?select=id&receiver_id=eq.${q}&status=eq.pending&limit=100`),
        get(`direct_messages?select=sender_id&receiver_id=eq.${q}&read_at=is.null&limit=500`),
        get(`favorites?select=id&user_id=eq.${q}&limit=1000`),
        get(`hangar_layouts?select=id,deleted&deleted=is.false&user_id=eq.${q}&limit=1000`),
      ]);
      // die Freunde nur, wenn es Ungelesenes gibt: Sie entscheiden, welche Nachrichten zaehlen
      const fr = dm?.length ? await get('friends?select=user_id,friend_id&limit=1000') : [];
      if (n !== datenLauf) return;
      daten = { uid, t: Date.now(), ref, craft: craft && termCrafting(craft), freunde: anf && dm && fr ? termFreunde(anf, dm, fr, uid) : null, fav: termGespeichert(lo, fav) };
      if (zeigt === 'start') malZahlen();
    } finally {
      win.clearTimeout(frist);
      if (D === daten) D.laedt = false;
    }
  }
  function setzeZahl(a, wert, unter, ton) {
    const b = a.querySelector('b'), s = a.querySelector('small');
    if (b && b.textContent !== wert) b.textContent = wert;
    if (s && s.textContent !== unter) s.textContent = unter;
    if (ton) a.dataset.ton = ton;
    else delete a.dataset.ton;
  }
  function malZahlen() {
    if (!zahlenEl || !daten) return;
    for (const a of zahlenEl.querySelectorAll('a[data-z]')) {
      const k = a.dataset.z, v = daten[k];
      if (k === 'ref') { malRef(); continue; }
      let wert = '—', unter = '', ton = '';
      if (v === null) unter = T.lNichtda ?? '';
      else if (v !== undefined && k === 'craft') {
        if (!v.besitz && !v.plan) { wert = T.lCraftLeer ?? ''; ton = 'leer'; }
        else { wert = fuell(T.lCraftBesitz, v.besitz); unter = fuell(T.lCraftPlan, v.plan); }
      } else if (v !== undefined && k === 'freunde') {
        const anf = v.anfragen ? (v.anfragen === 1 ? T.lAnfrage1 : fuell(T.lAnfragen, v.anfragen)) : '';
        const msg = v.ungelesen ? (v.ungelesen === 1 ? T.lNachricht1 : fuell(T.lNachrichten, v.ungelesen)) : '';
        if (!anf && !msg) { wert = T.lRuhig ?? ''; ton = 'leer'; }
        else { wert = anf || msg; unter = anf ? msg : ''; ton = 'an'; }
      } else if (v !== undefined && k === 'fav') {
        // Eine nackte 0 las sich in der Schrift der Zahlen wie ein Zeichen
        // („Ø“); leer sagt die Kachel es in Worten wie ihre Nachbarn.
        const n = v.loadouts + v.favoriten;
        if (!n) { wert = T.lFavLeer ?? ''; ton = 'leer'; }
        else {
          wert = n >= 1000 ? `${nf.format(1000)}+` : nf.format(n);
          const lo = v.loadouts ? (v.loadouts === 1 ? T.lFavLo1 : fuell(T.lFavLon, v.loadouts)) : '';
          const fa = v.favoriten ? (v.favoriten === 1 ? T.lFavFa1 : fuell(T.lFavFan, v.favoriten)) : '';
          unter = [lo, fa].filter(Boolean).join(' · ');
        }
      }
      setzeZahl(a, wert ?? '', unter ?? '', ton);
    }
  }
  // Die Raffinerie: fertige zuerst, sonst der naechste Auftrag mit Countdown und Fortschritt
  function malRef() {
    const a = zahlenEl?.querySelector('a[data-z="ref"]');
    if (!a || !daten) return;
    const lauf = a.querySelector('.hgx-ts__lauf');
    let wert = '—', unter = '', ton = '', anteil = -1;
    if (daten.ref === null) unter = T.lNichtda ?? '';
    else if (daten.ref) {
      const r = termRaffinerie(daten.ref, Date.now()), aktiv = r.aktiv ? fuell(T.lRefAktiv, r.aktiv) : '';
      if (r.fertig) {
        wert = r.fertig === 1 ? T.lRefFertig1 ?? '' : fuell(T.lRefFertign, r.fertig);
        unter = [T.lRefAlle, aktiv].filter(Boolean).join(' · ');
        ton = 'an';
      } else if (r.naechster) {
        wert = termRest(r.naechster.rest);
        unter = [r.naechster.station, aktiv].filter(Boolean).join(' · ');
        anteil = r.naechster.anteil;
      } else { wert = T.lRefLeer ?? ''; ton = 'leer'; }
    }
    setzeZahl(a, wert, unter, ton);
    if (lauf) {
      lauf.hidden = anteil < 0;
      if (anteil >= 0) lauf.style.setProperty('--w', `${(anteil * 100).toFixed(2)}%`);
    }
  }
  // Ein Ort faehrt die Kamera, ein Schiff der Flotte kommt aufs Feld, jeder
  // Link des Ueberblicks oeffnet seine Seite auf dem Schirm. Mit Strg, Umschalt
  // oder der mittleren Taste bleibt ein Link ein gewoehnlicher Link.
  ts?.addEventListener('click', (e) => {
    const t = e.target;
    const ort = t.closest?.('[data-ort]');
    if (ort && ts.contains(ort)) {
      if (ort.dataset.ort !== 'leit' && !ort.hasAttribute('aria-current')) hooks.ort?.(ort.dataset.ort);
      return;
    }
    const chip = t.closest?.('button.hgx-ts__chip[data-id]');
    if (chip && ts.contains(chip)) { hooks.ship?.(chip.dataset.id); return; }
    const a = t.closest?.('a[href][target="hgx-term-frame"]');
    if (!a || !ts.contains(a) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(a.href);
  });

  function place(rect) {
    win.clearTimeout(offTimer);
    if (!rect) {
      remember();
      stopTakt();
      // die Anmeldung endet mit der Blende des Kastens, nicht davor
      lauf++;
      wartet = false;
      win.clearTimeout(loginTimer);
      box.classList.remove('is-on');
      // Nach der Blende ganz aus dem Layout: Eine Seite, die nicht zu sehen
      // ist, soll neben der Halle weder zeichnen noch Bilder rechnen.
      offTimer = win.setTimeout(() => { box.hidden = true; loginOff(); }, 340);
      return;
    }
    const l = Math.round(rect.l), t = Math.round(rect.t);
    const f = termFrame(rect.r - rect.l, rect.b - rect.t);
    box.style.width = `${f.w}px`;
    box.style.height = `${f.h}px`;
    box.style.transform = `translate(${l}px,${t}px) scale(${f.k})`;
    // Hoehe fuer den Stil des Ueberblicks (Liste der Suche, enge Fassung)
    box.style.setProperty('--term-h', `${f.h}px`);
    box.toggleAttribute('data-niedrig', f.h < TERM_NIEDRIG_H);
    if (box.hidden) {
      box.hidden = false;
      // erst ein Layout ohne .is-on, sonst faellt die Blende aus
      void box.offsetWidth;
    }
    const neu = !box.classList.contains('is-on');
    box.classList.add('is-on');
    passeLeiste();
    if (!started) start();
    // Wieder hingesetzt: der Ueberblick auf den Stand von jetzt (Orte, Flotte, Zahlen)
    else if (neu && zeigt === 'start') startMalen();
    // ein anderes Rechteck: Die Flotte bricht anders um
    else if (zeigt === 'start' && box.offsetWidth !== breit) malFlotte();
    // hingesetzt (nicht bei jedem neuen Rechteck, etwa wenn das Fenster des Browsers waechst)
    if (neu) hinsetzen();
  }
  // Die Seite meldet, dass sich etwas geaendert hat (die Flotte): der Ueberblick folgt, wenn er vorn steht
  const auffrischen = () => {
    if (zeigt !== 'start' || !ts) return;
    malOrte();
    malFlotte();
  };
  // Kommt die Schrift der Leiste erst nach dem ersten Messen, misst sie neu
  doc.fonts?.ready?.then(() => passeLeiste(), () => {});
  return { place, auffrischen };
}
