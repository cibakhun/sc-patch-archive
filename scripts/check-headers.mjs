/* ============================================================
   check-headers.mjs — Schiene C: tragen die AUSGELIEFERTEN Antworten die
   Sicherheits-Kopfzeilen, und passt die ausgelieferte Content-Security-
   Policy zu den ausgelieferten Seiten?

   `npm run check:headers`  -> gegen https://staging.verse-base.com
   `node scripts/check-headers.mjs --base <url> [--weich]`
                               (Live: --base https://verse-base.com)

   WARUM ES DEN GIBT (29.10.2026): audit:csp prueft nginx/default.conf und
   dist/ — also das, was ins Image geht. Was der Besucher bekommt, kann
   davon abweichen: ein add_header in einer location verwirft die Kopf-
   zeilen des server-Blocks, eine fehlende include-Datei laesst die
   Richtlinie auf ihren Rueckfall fallen, und vor dem Ursprung sitzt
   Cloudflare, das Kopfzeilen setzen, entfernen und Skripte in das HTML
   haengen kann. Das sieht nur, wer die ausgelieferte Seite fragt
   (Grundsatz 7).

   Stichproben (fest, weil jede Antwortart ihren eigenen Weg durch nginx
   nimmt): Wurzel, robots.txt, gate.html, zwei feste Weiterleitungen und
   zwei Adressen, die es nicht gibt. Live antworten sie mit 200, 301 und
   404; auf der Vorschau leitet das Testpilot-Tor die gesperrten mit 302
   auf /gate.html um — dann gibt es dort kein 404, und das Tor sagt es.
   Gefolgt wird keiner Weiterleitung: die Kopfzeilen der 301/302 selbst
   werden geprueft.

   Drei Zusicherungen, jede mit Soll/Ist:

     1  Jede Antwort traegt Strict-Transport-Security (max-age mindestens
        ein Jahr), Content-Security-Policy, X-Frame-Options (DENY oder
        SAMEORIGIN), X-Content-Type-Options: nosniff und eine Referrer-
        Policy, die keine volle Adresse an Fremde gibt. Fehlt eine
        davon, ist das FEHLER.
     2  Die Richtlinie selbst: script-src ohne 'unsafe-inline' und mit
        Hashes, script-src-attr gesetzt, object-src 'none', base-uri und
        frame-ancestors vorhanden. 'unsafe-inline' in script-src heisst,
        dass nginx auf den Rueckfall gefallen ist (dist/_csp/ fehlt im
        Image) — FEHLER.
     3  Jedes ausgefuehrte Inline-Skript und jeder Inline-Handler der
        ausgelieferten HTML-Antworten hat seinen Hash in der Richtlinie
        GENAU DIESER Antwort. Sonst blockt der Browser es. Ein Skript,
        das erkennbar Cloudflare eingehaengt hat (cdn-cgi, __CF), ist
        WARNUNG: die Abhilfe liegt im Cloudflare-Dashboard, und ob die
        Funktion gebraucht wird, entscheidet ein Mensch.

   WARNUNG (blockt nicht): Permissions-Policy oder Cross-Origin-Opener-
   Policy fehlt.

   Selbstauskunft: Ziel, ausgelieferte Kennung aus /build.json, Zahl der
   Antworten je Status, gepruefte HTML-Antworten und Inline-Skripte.
   Untergrenzen als Sperrklinken — nur nach OBEN (Grundsatz 5).

   --weich: Nichterreichbarkeit (Cloudflare weist Rechenzentren mit
   401/403/429 ab, oder das Netz fehlt) wird WARNUNG statt FEHLER — "ich
   komme nicht hin" ist kein Befund ueber die Kopfzeilen (Grundsatz 3).
   Lokal laeuft es streng, wie check:staging.
   ============================================================ */
import { zerlege } from './lib/csp-inline.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = flag('--base', 'https://staging.verse-base.com').replace(/\/$/, '');
const WEICH = argv.includes('--weich');

// Untergrenzen (Stand 29.10.2026, gegen einen nginx-Container mit diesem
// Stand gemessen): 7 Antworten, davon live 4 HTML-Antworten mit Inline-
// Skripten (Wurzel, gate.html, zweimal 404), auf der Vorschau 1 (gate.html).
const MIN_ANTWORTEN = 7;
const MIN_HTML = 1;
// Ein Jahr, wie nginx/default.conf es setzt. Darunter laesst ein Browser
// die HTTPS-Pflicht zu frueh fallen.
const MIN_HSTS = 31536000;
const REFERRER_OK = new Set(['strict-origin-when-cross-origin', 'strict-origin', 'same-origin', 'no-referrer']);

const STICHPROBEN = [
  { pfad: '/', art: 'Startseite (live 200, Vorschau 302 auf das Tor)' },
  { pfad: '/robots.txt', art: 'Ausnahme des Tors, immer 200' },
  { pfad: '/gate.html', art: 'Torseite, eigenes Dokument, 200' },
  { pfad: '/patches', art: 'feste Weiterleitung, 301' },
  { pfad: '/en.html', art: 'feste Weiterleitung, 301' },
  { pfad: '/__vb-kopfzeilen-probe.html', art: 'gibt es nicht (live 404, Vorschau 302)' },
  { pfad: '/assets/fonts/__vb-kopfzeilen-probe.woff2', art: 'gibt es nicht, eigene location (live 404, Vorschau 302)' },
];

const fehler = [];
const warnungen = [];
const fail = (m) => fehler.push(m);
const warn = (m) => warnungen.push(m);

async function holen(pfad) {
  return fetch(`${BASE}${pfad}`, {
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: { 'cache-control': 'no-cache' },
  });
}

/* ---------- Erreichbarkeit vorab (Muster: check-gate.mjs) ---------- */
let vorab;
try {
  const r = await holen('/robots.txt');
  vorab = [401, 403, 429].includes(r.status) ? `Bot-Schutz vor der Domain (HTTP ${r.status})` : null;
} catch (e) {
  vorab = e.cause?.code ?? e.message;
}
if (vorab) {
  const satz = `${BASE} ist von hier aus nicht erreichbar (${vorab}) — keine Aussage ueber die Kopfzeilen.`;
  if (WEICH) {
    console.log(`\n${satz}\n\ncheck-headers: NICHT geprueft — von hier aus nicht erreichbar (--weich)\n`);
    process.exit(0);
  }
  console.error(`\ncheck-headers: 1 FEHLER\n\n  · ${satz}\n`);
  process.exit(1);
}

let kennung = '—';
try {
  const r = await holen('/build.json');
  if (r.ok) {
    const b = await r.json();
    kennung = `${b.kurz ?? String(b.sha ?? '').slice(0, 7)}${b.staging ? ' (Vorschau-Build)' : ' (Live-Build)'}, gebaut ${b.gebautAm ?? '?'}`;
  }
} catch { /* nur Auskunft */ }

console.log(`\n=== check-headers: Sicherheits-Kopfzeilen der ausgelieferten Seite (Schiene C) ===`);
console.log(`Gepruefte Seite: ${BASE}   ausgelieferter Stand: ${kennung}`);
console.log(`Stichproben: ${STICHPROBEN.length}`);

/** Richtlinie in Direktiven zerlegen (Name klein, Quellen wie geliefert). */
function richtlinie(text) {
  const out = new Map();
  for (const teil of text.split(';')) {
    const [name, ...q] = teil.trim().split(/\s+/);
    if (name && !out.has(name.toLowerCase())) out.set(name.toLowerCase(), q);
  }
  return out;
}

const proStatus = new Map();
let htmlGeprueft = 0, skripteGeprueft = 0, handlerGeprueft = 0, ohne404 = 0;
const antworten = [];

for (const s of STICHPROBEN) {
  let r;
  try { r = await holen(s.pfad); } catch (e) { fail(`${s.pfad}: Anfrage fehlgeschlagen (${e.cause?.code ?? e.message})`); continue; }
  const h = r.headers;
  const ort = h.get('location') ?? '';
  proStatus.set(r.status, (proStatus.get(r.status) ?? 0) + 1);
  antworten.push(`${s.pfad} -> ${r.status}${ort ? ` ${ort}` : ''}`);
  if (/404/.test(s.art) && r.status === 302 && /\/gate\.html/.test(ort)) ohne404++;
  const wo = `${s.pfad} (${r.status})`;

  /* ---- [1] die fuenf Kopfzeilen ---- */
  const hsts = h.get('strict-transport-security');
  const maxAge = Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts ?? '')?.[1] ?? NaN);
  if (!hsts) fail(`${wo}: Strict-Transport-Security fehlt`);
  else if (!(maxAge >= MIN_HSTS)) fail(`${wo}: Strict-Transport-Security max-age=${maxAge}, Soll mindestens ${MIN_HSTS}`);
  const csp = h.get('content-security-policy');
  if (!csp) fail(`${wo}: Content-Security-Policy fehlt`);
  const xfo = (h.get('x-frame-options') ?? '').trim().toUpperCase();
  if (!xfo) fail(`${wo}: X-Frame-Options fehlt`);
  else if (xfo !== 'DENY' && xfo !== 'SAMEORIGIN') fail(`${wo}: X-Frame-Options "${xfo}", Soll DENY oder SAMEORIGIN`);
  const xcto = (h.get('x-content-type-options') ?? '').trim().toLowerCase();
  if (xcto !== 'nosniff') fail(`${wo}: X-Content-Type-Options ${xcto ? `"${xcto}"` : 'fehlt'}, Soll nosniff`);
  const rp = h.get('referrer-policy');
  // Mehrere Werte: der letzte, den der Browser kennt, gilt.
  const rpWert = (rp ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean).pop();
  if (!rpWert) fail(`${wo}: Referrer-Policy fehlt`);
  else if (!REFERRER_OK.has(rpWert)) fail(`${wo}: Referrer-Policy "${rpWert}" gibt die volle Adresse an fremde Seiten`);
  if (!h.get('permissions-policy')) warn(`${wo}: Permissions-Policy fehlt`);
  if (!h.get('cross-origin-opener-policy')) warn(`${wo}: Cross-Origin-Opener-Policy fehlt`);

  if (!csp) continue;
  /* ---- [2] die Richtlinie ---- */
  const pol = richtlinie(csp);
  const skriptSrc = pol.get('script-src') ?? pol.get('default-src') ?? [];
  const attrSrc = pol.get('script-src-attr') ?? skriptSrc;
  const mitHash = (liste) => liste.some((q) => /^'sha(256|384|512)-/.test(q));
  if (skriptSrc.includes("'unsafe-inline'"))
    fail(`${wo}: script-src traegt 'unsafe-inline' — nginx steht auf dem Rueckfall, die Hash-Dateien unter /usr/share/nginx/html/_csp/ fehlen im Image`);
  else if (!mitHash(skriptSrc)) fail(`${wo}: script-src ohne einen einzigen Hash`);
  if (!pol.has('script-src-attr')) fail(`${wo}: script-src-attr fehlt — Inline-Handler fielen auf script-src zurueck`);
  if (attrSrc.includes("'unsafe-inline'")) fail(`${wo}: script-src-attr traegt 'unsafe-inline'`);
  if ((pol.get('object-src') ?? []).join(' ') !== "'none'") fail(`${wo}: object-src ist nicht 'none'`);
  if (!pol.has('base-uri')) fail(`${wo}: base-uri fehlt`);
  if (!pol.has('frame-ancestors')) fail(`${wo}: frame-ancestors fehlt`);

  /* ---- [3] Inline-Skripte der ausgelieferten Seite gegen ihre Richtlinie ---- */
  if (!/text\/html/i.test(h.get('content-type') ?? '') || r.status >= 300 && r.status < 400) continue;
  // Ohne Hash in der Liste gilt ein 'unsafe-inline' daneben: dann laeuft
  // jedes Inline-Skript, und der Befund steht schon unter [2].
  const skriptHashModus = mitHash(skriptSrc) || !skriptSrc.includes("'unsafe-inline'");
  const attrHashModus = mitHash(attrSrc) || !attrSrc.includes("'unsafe-inline'");
  const html = await r.text();
  const { skripte, handler } = zerlege(html);
  htmlGeprueft++;
  const erlaubt = new Set(skriptSrc);
  for (const x of skripte) {
    if (!x.hash) continue;
    skripteGeprueft++;
    if (!skriptHashModus || erlaubt.has(x.hash)) continue;
    const kopf = x.text.trim().replace(/\s+/g, ' ').slice(0, 70);
    const cf = /cdn-cgi|__CF\$|cloudflare/i.test(x.text);
    (cf ? warn : fail)(
      `${wo}: Inline-Skript ${x.hash} steht nicht in script-src — der Browser blockt es ("${kopf}…")` +
        (cf ? '; sieht nach einer Cloudflare-Einhaengung aus, dort abschalten oder bewusst hinnehmen' : ''),
    );
  }
  const attrErlaubt = new Set(attrSrc);
  for (const x of handler) {
    handlerGeprueft++;
    if (attrHashModus && (!attrErlaubt.has("'unsafe-hashes'") || !attrErlaubt.has(x.hash)))
      fail(`${wo}: Inline-Handler ${x.attr} an <${x.tag}> (${x.hash}) ist in script-src-attr nicht freigegeben`);
  }
}

/* ---------- Bericht ---------- */
console.log('\nAntworten');
for (const a of antworten) console.log(`    ${a}`);
const statusZeile = [...proStatus].sort((a, b) => a[0] - b[0]).map(([s, n]) => `${s}: ${n}`).join('   ');
console.log(`    je Status — ${statusZeile || '—'}`);
if (ohne404) console.log(`    ${ohne404} Adresse(n) ohne Datei leitet das Testpilot-Tor auf /gate.html um (Vorschau) — 404 ist dort nicht erreichbar`);
const n = [...proStatus.values()].reduce((a, b) => a + b, 0);
console.log('\n[1] Fuenf Sicherheits-Kopfzeilen an jeder Antwort');
console.log(`[2] Richtlinie: script-src per Hash, script-src-attr, object-src, base-uri, frame-ancestors`);
console.log(`[3] Inline-Skripte der HTML-Antworten gegen die Richtlinie derselben Antwort`);
console.log(`    HTML-Antworten: ${htmlGeprueft}   Inline-Skripte: ${skripteGeprueft}   Inline-Handler: ${handlerGeprueft}`);

console.log('\nSelbstauskunft');
console.log(`    Antworten: ${n} (Klinke ${MIN_ANTWORTEN})   HTML-Antworten: ${htmlGeprueft} (Klinke ${MIN_HTML})`);
if (n < MIN_ANTWORTEN) fail(`nur ${n} Antworten geprueft, Klinke ${MIN_ANTWORTEN} — Ursache klaeren, nicht die Klinke senken`);
if (htmlGeprueft < MIN_HTML) fail(`keine HTML-Antwort geprueft (Klinke ${MIN_HTML}) — [3] ist leer gelaufen`);
if (![...proStatus.keys()].some((s) => s >= 200 && s < 300)) fail('keine 2xx-Antwort unter den Stichproben');
if (![...proStatus.keys()].some((s) => s >= 300 && s < 400)) fail('keine Weiterleitung unter den Stichproben');

for (const w of warnungen) console.log(`    WARNUNG ${w}`);
if (fehler.length) {
  console.error(`\ncheck-headers: ${fehler.length} FEHLER\n`);
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log(`\ncheck-headers: ALLE ZUSICHERUNGEN ERFUELLT ✓${warnungen.length ? ` (${warnungen.length} WARNUNG)` : ''}\n`);
