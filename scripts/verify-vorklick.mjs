#!/usr/bin/env node
/* verify:vorklick — haelt die Seite an die Zusagen der Datenschutz-
   erklaerung, WANN sie mit welchem Fremdanbieter spricht.

   ANLASS (29.10.2026, Sicherheitsbefund OPS-3): Die Erklaerung sagte
   „YouTube-Videos ... werden erst nach deinem Klick geladen. Vor dem Klick
   findet keine Verbindung zu Google statt." Auf jeder Schiffsseite mit
   Commercial standen aber drei <link rel="preconnect"> zu den YouTube-Hosts
   und ein <script src="https://www.youtube.com/iframe_api"> — und ohne Holo
   lief das Video beim Oeffnen von selbst an. Das stand so in 222 gebauten
   Seiten, und kein Tor hat es gesehen: audit:csp fragt nur, ob die
   Richtlinie einen Host ERLAUBT, nicht, ob die Seite ihn vor dem Klick
   ANSPRICHT.

   GEPRUEFT WIRD AM ARTEFAKT (dist/): jede gebaute HTML-Seite und jede
   CSS-Datei. Gesucht sind Verweise, die der Browser OHNE Zutun laedt oder
   vorbereitet — <script src>, <link href> (preconnect, dns-prefetch,
   preload, prefetch, modulepreload, stylesheet, icon), <iframe>/<embed>/
   <object>, <img>/<source>/<video>/<audio> samt srcset und poster, und
   url()/@import in Stil-Attributen, <style>-Bloecken und CSS-Dateien —
   auf Hosts, fuer die die Erklaerung „erst nach Klick" oder „nie" zusagt:

     YouTube/Google-Video  „erst nach deinem Klick"
     Google Fonts          „keine Verbindung zu Google Fonts"
     Stripe                „erst, wenn du den Knopf drueckst"
     PayPal                „ein Link und sonst nichts"
     Web3Forms             „erst beim Absenden"

   NICHT gemeldet werden <a href> (Navigation, braucht einen Klick) und
   <form action> (braucht ein Absenden), ebenso URLs, die ein Inline-Skript
   erst im Klick-Handler zusammensetzt — genau so soll es sein.

   SELBSTAUSKUNFT + SPERRKLINKEN (Grundsaetze 2 und 5): gezaehlt werden die
   geprueften Seiten UND die Klick-Fassaden fuer YouTube (data-yt, data-lb
   mit yt:, #holoytgo). Faellt eine der beiden Zahlen unter ihre Klinke,
   reisst das Tor: dann laeuft es entweder leer, oder eine Fassade ist
   verschwunden — und mit ihr womoeglich die Klick-Schranke.

   NEGATIVKONTROLLE (Grundsatz 1, vorgefuehrt 29.10.2026): in die gebaute
   dist/schiffe/drak-cutlass-blue.html die beiden alten Zeilen
     <link rel="preconnect" href="https://www.youtube.com" />
     <script id="yt-iframe-api" src="https://www.youtube.com/iframe_api" async>
   zurueckgesetzt -> Exit 1 mit
     FEHLER  2 Verweis(e) auf Fremdanbieter, die vor dem Klick laden (2 Muster):
       YouTube/Google-Video  <script src>       www.youtube.com  (1×, …)
       YouTube/Google-Video  <link preconnect>  www.youtube.com  (1×, …)
   Danach Rueckbau, wieder gruen. Zusaetzlich gegen eine Kunstseite mit je
   einem Fall pro Muster (stylesheet, dns-prefetch, srcset, data-src, Stil-
   url(), CSS-@import, script, iframe, poster): alle neun gemeldet; <a href>,
   <form action>, rel=canonical/alternate, data-yt und eine URL im Inline-
   Skript blieben still.

   Schiene A: liest ausschliesslich dist/ — kein git, kein Netz, kein
   Kindprozess.                                                          */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';

const DIST = 'dist';
const MIN_SEITEN = 18000;    /* Stand 29.10.2026: 18222 */
const MIN_FASSADEN = 340;    /* Stand 29.10.2026: 356 = 222× #holoytgo (Schiffsseiten) + 84× data-yt + 50× data-lb="yt:" */

/* Host -> Zusage. Ein Treffer gilt fuer den Host selbst und jede Subdomain. */
const ZUSAGEN = [
  { name: 'YouTube/Google-Video', hosts: ['youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'googlevideo.com', 'youtu.be'] },
  { name: 'Google Fonts', hosts: ['fonts.googleapis.com', 'fonts.gstatic.com'] },
  { name: 'Stripe', hosts: ['stripe.com', 'stripe.network'] },
  { name: 'PayPal', hosts: ['paypal.com', 'paypalobjects.com'] },
  { name: 'Web3Forms', hosts: ['web3forms.com'] },
];
const zusageFuer = (url) => {
  let host;
  try { host = new URL(url.startsWith('//') ? 'https:' + url : url).host.toLowerCase(); } catch { return null; }
  return ZUSAGEN.find((z) => z.hosts.some((h) => host === h || host.endsWith('.' + h))) ?? null;
};

/* Was der Browser ohne Zutun laedt. Jedes Muster liefert [art, url]. */
const URL_RE = String.raw`((?:https?:)?\/\/[^\s"'<>),]+)`;
const tagAttr = (tag, attr) => new RegExp(`<(${tag})\\b[^>]*?\\s(${attr})\\s*=\\s*["']?${URL_RE}`, 'gi');
const MUSTER = [
  { art: (m) => `<${m[1].toLowerCase()} ${m[2].toLowerCase()}>`, re: tagAttr('script|iframe|frame|embed|img|source|video|audio|track|input', 'src') },
  { art: (m) => `<${m[1].toLowerCase()} ${m[2].toLowerCase()}>`, re: tagAttr('object', 'data') },
  { art: (m) => `<${m[1].toLowerCase()} ${m[2].toLowerCase()}>`, re: tagAttr('video', 'poster') },
  /* Lazy-Loader setzen data-src & Co. beim Scrollen um — das braucht keinen
     Klick. Reine Kennungen (data-yt="ID", data-lb="yt:ID") sind keine URL
     und fallen hier nicht hinein. */
  { art: (m) => `<${m[1].toLowerCase()} ${m[2].toLowerCase()}>`, re: tagAttr('[a-z][a-z0-9-]*', 'data-(?:src|srcset|bg|background|poster|fb|fallback|img)[a-z-]*') },
];
/* srcset traegt mehrere URLs — jede einzeln. */
const SRCSET_RE = /<(img|source)\b[^>]*?\ssrcset\s*=\s*["']([^"']*)["']/gi;
const CSS_URL_RE = new RegExp(String.raw`(?:url\(\s*["']?|@import\s+["'])` + URL_RE, 'gi');
/* <link>: rel und href stehen in beliebiger Reihenfolge — erst den Tag
   greifen, dann beide Attribute lesen. Jeder rel-Wert laedt oder baut eine
   Verbindung auf, ausser den reinen Verweis-Arten. */
const LINK_RE = /<link\b[^>]*>/gi;
const NUR_VERWEIS = /^(?:alternate|canonical|author|license|help|next|prev|search|me|bookmark|external|nofollow|noopener|noreferrer|tag)$/i;

if (!existsSync(DIST)) {
  console.error('FEHLER  dist/ fehlt — erst `npm run build`.');
  process.exit(1);
}

const dateien = [];
const lauf = (d) => {
  for (const e of readdirSync(d)) {
    const p = d + '/' + e;
    if (statSync(p).isDirectory()) { lauf(p); continue; }
    if (e.endsWith('.html') || e.endsWith('.css')) dateien.push(p);
  }
};
lauf(DIST);

let seiten = 0, cssDateien = 0, fassaden = 0;
const funde = [];
const melde = (datei, art, url) => {
  const z = zusageFuer(url);
  if (z) funde.push({ datei, art, url, zusage: z.name });
};

for (const datei of dateien) {
  const text = readFileSync(datei, 'utf8');
  if (datei.endsWith('.css')) {
    cssDateien++;
    for (const m of text.matchAll(CSS_URL_RE)) melde(datei, 'url()/@import', m[1]);
    continue;
  }
  seiten++;
  /* Inline-Skripte zuerst ausblenden: ihr Text ist Code, der URLs erst zur
     Laufzeit (im Klick-Handler) zusammensetzt, kein Markup, das der Parser
     laedt. Ein <script src> steht im oeffnenden Tag und bleibt erhalten. */
  const markup = text.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
  fassaden += (markup.match(/\sdata-yt\s*=|\sdata-lb\s*=\s*["']yt:|\sid\s*=\s*["']holoytgo["']/gi) || []).length;
  for (const { art, re } of MUSTER) for (const m of markup.matchAll(re)) melde(datei, art(m), m[3]);
  for (const m of markup.matchAll(SRCSET_RE))
    for (const u of m[2].matchAll(new RegExp(URL_RE, 'g'))) melde(datei, `<${m[1].toLowerCase()} srcset>`, u[1]);
  for (const m of markup.matchAll(CSS_URL_RE)) melde(datei, 'url()/@import', m[1]);
  for (const m of markup.matchAll(LINK_RE)) {
    const tag = m[0];
    const href = new RegExp(String.raw`\shref\s*=\s*["']?` + URL_RE, 'i').exec(tag)?.[1];
    if (!href) continue;
    const rel = (/\srel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
    if (rel.length && rel.every((r) => NUR_VERWEIS.test(r))) continue;
    melde(datei, `<link ${rel.join(' ') || '(ohne rel)'}>`, href);
  }
}

console.log(`verify:vorklick — gegen ${DIST}/: ${seiten} Seiten + ${cssDateien} CSS-Dateien geprueft (Klinke ${MIN_SEITEN}), ${fassaden} YouTube-Klick-Fassaden gezaehlt (Klinke ${MIN_FASSADEN})`);

let rot = false;
if (seiten < MIN_SEITEN) {
  console.error(`FEHLER  nur ${seiten} Seiten gefunden, erwartet mindestens ${MIN_SEITEN}.`);
  console.error('        Entweder ist der Build unvollstaendig, oder dieses Tor laeuft leer.');
  rot = true;
}
if (fassaden < MIN_FASSADEN) {
  console.error(`FEHLER  nur ${fassaden} YouTube-Klick-Fassaden gefunden, erwartet mindestens ${MIN_FASSADEN}.`);
  console.error('        Ist eine Fassade (data-yt, data-lb="yt:…", #holoytgo) verschwunden, fehlt womoeglich');
  console.error('        auch die Klick-Schranke davor. Sinkt die Zahl begruendet, die Klinke per Commit');
  console.error('        senken, dessen Botschaft die Ursache nennt.');
  rot = true;
}

if (funde.length) {
  const muster = {};
  for (const f of funde) {
    let host = f.url;
    try { host = new URL(f.url.startsWith('//') ? 'https:' + f.url : f.url).host; } catch {}
    const k = `${f.zusage.padEnd(21)} ${f.art.padEnd(18)} ${host}`;
    (muster[k] ||= []).push(f.datei.slice(DIST.length));
  }
  console.error(`FEHLER  ${funde.length} Verweis(e) auf Fremdanbieter, die vor dem Klick laden (${Object.keys(muster).length} Muster):`);
  for (const [k, v] of Object.entries(muster).sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
    console.error(`  ${k}  (${v.length}×, z. B. ${v.slice(0, 2).join('  ')})`);
  }
  console.error('');
  console.error('  Die Datenschutzerklaerung sagt fuer diese Anbieter „erst nach Klick" oder „nie".');
  console.error('  Den Verweis in einen Klick-Handler verlegen (Muster: data-yt in den Patch-Seiten,');
  console.error('  #holoytgo in ShipDetail.astro) — oder die Erklaerung UND dieses Tor bewusst aendern.');
  rot = true;
}

if (rot) process.exit(1);
console.log('  OK  keine Seite spricht vor dem Klick mit YouTube, Google Fonts, Stripe, PayPal oder Web3Forms.');
