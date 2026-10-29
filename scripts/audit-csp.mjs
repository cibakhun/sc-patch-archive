// Hält die Content-Security-Policy an dem fest, was die Seite WIRKLICH lädt.
//
// Anlass: die erste Fassung der Richtlinie entstand aus Stichproben von fünf
// Seiten. Dabei fehlten `api.fleetyards.net` (3.564 Schiffsbilder), das externe
// YouTube-`iframe_api`-Skript und alles, was der 3D-Viewer braucht — `blob:`
// für Worker und Texturen sowie 'wasm-unsafe-eval' für den Draco-Dekomprimierer.
// Eine CSP bricht nicht beim Deploy, sondern still im Browser des Besuchers;
// deshalb wird sie hier gegen den fertigen Build gemessen statt gelesen.
//
// Läuft im Qualitätstor des Dockerfile mit. Findet es eine Quelle, die die
// Richtlinie nicht deckt, entsteht kein Image.
//
// Seit 29.10.2026 steht 'unsafe-inline' nicht mehr in script-src: jedes
// Inline-Skript ist per sha256 freigegeben. Die Hashes rechnet der Bau
// (scripts/_write-csp-hashes.mjs) nach dist/_csp/, nginx liest sie per
// include. Dieses Tor löst die Kopfzeile deshalb so auf, wie nginx sie
// ausliefert — mit den include-Dateien aus dist/ — und sichert zu (FEHLER):
//   · jede include-Datei der Richtlinie liegt in dist/ (sonst fiele nginx
//     still auf 'unsafe-inline' zurück) und dist/ landet laut Dockerfile
//     genau dort, wo nginx sucht;
//   · script-src trägt kein 'unsafe-inline', kein 'unsafe-eval', kein `*`
//     und keine reine Schema-Quelle (https:, http:, data:), und JEDES
//     ausgeführte Inline-Skript aus dist/ hat seinen Hash darin;
//   · jede Seite mit data-img-fail-Bildern trägt den Bild-Hörer aus
//     Layout.astro VOR dem ersten solchen Bild (sonst bleibt das kaputte
//     Bildsymbol stehen, wo früher onerror half);
//   · jeder Inline-Handler (onclick=…) ist eine benannte Ausnahme
//     (HANDLER_AUSNAHMEN, mit Zombie-Wächter) und in script-src-attr
//     freigegeben; ohne Handler steht dort 'none';
//   · kein javascript:-Link, kein Inline-Skript in <svg> (dessen Hash
//     ließe sich hier nicht sicher rechnen);
//   · der Zähl-Host (data-host-url) steht in connect-src und NICHT in
//     script-src — das Zählskript kommt vom eigenen Ursprung;
//   · kein add_header außerhalb des server-Blocks (eine location mit
//     eigenem add_header verwirft alle Sicherheits-Kopfzeilen).
// Selbstauskunft mit Klinken; ausgeliefert prüft es check:headers.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  zerlege, zaehleScriptTagsRoh, cspHash, leseMapWert, CSP_ORDNER,
} from './lib/csp-inline.mjs';

const CONF = 'nginx/default.conf';
const DIST = 'dist';
if (!existsSync(DIST)) { console.error('dist/ fehlt — erst npm run build.'); process.exit(2); }

// Untergrenzen (Grundsatz 5, nur nach OBEN). Stand 29.10.2026: 18.222
// Seiten, rund 136.000 ausgeführte Inline-Skripte in 63 Fassungen. Die
// Klinken bewachen nicht die Seitenzahl (das tut verify:metrics), sondern
// melden, wenn die Inline-Erkennung leerläuft und das Tor nichts mehr misst.
const MIN_SEITEN = 17000;
const MIN_INLINE_SKRIPTE = 100000;

// Inline-Handler, die (noch) im Build stehen dürfen — je mit Anlass.
// Alles andere gehört als Listener in assets/ bzw. als data-img-fail an
// das Bild (Hörer im Kopf von Layout.astro). Verschwindet der Handler aus
// dist/, verliert der Eintrag seinen Anlass und das Tor reißt
// (Zombie-Wächter) — dann den Eintrag entfernen.
const HANDLER_AUSNAHMEN = [
  {
    tag: 'img', attr: 'onerror',
    wert: "if(this.srcset){this.removeAttribute('srcset');return}if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute('data-fb')}else{this.dataset.bad='1';this.style.display='none'}",
    anlass: 'Galerie-Rückfallkette in src/components/ShipDetail.astro — Umbau auf data-img-fail="chain" steht aus (Datei in dieser Runde gesperrt)',
  },
  {
    tag: 'img', attr: 'onerror',
    wert: "this.closest('figure').style.display='none'",
    anlass: 'Lackierungs-Kacheln in src/components/ShipDetail.astro — Umbau auf data-img-fail="figure" steht aus (Datei in dieser Runde gesperrt)',
  },
];

// ---------------------------------------------------------------- Richtlinie --
const conf = readFileSync(CONF, 'utf8');
const m = /add_header\s+Content-Security-Policy\s+"([^"]+)"/.exec(conf);
if (!m) { console.error(`Keine Content-Security-Policy in ${CONF} gefunden.`); process.exit(2); }

// nginx-Variablen in der Kopfzeile aufloesen. Der Widerspruch gegen die
// Reichweitenmessung haengt an zwei map-Bloecken ($vb_rum_script /
// $vb_rum_connect): traegt der Browser das Opt-out-Cookie, liefern sie leer
// aus, sonst die Analytics-Hosts. Fuer die Pruefung zaehlt der Normalfall, also
// die `default`-Zeile des Blocks. Ohne das meldet die Pruefung die Hosts als
// ungedeckt, obwohl die Richtlinie sie ausliefert — und der Build stirbt an
// einer Meldung, die nicht stimmt.
function mapDefault(varName) {
  const block = new RegExp(`map\\s+\\$http_cookie\\s+\\$${varName}\\s*\\{([^}]*)\\}`).exec(conf);
  const def = block && /default\s+([^;]+);/.exec(block[1]);
  if (!def) return [];
  return def[1].trim().replace(/^"|"$/g, '').split(/\s+/).filter(Boolean);
}

// Die Hash-Maps (`map "csp" $vb_script_… { default …; include …; }`)
// liefert nginx aus der include-Datei, solange es sie gibt, sonst aus
// `default` (Rückfall). Geprüft wird, was das Image ausliefert: die Datei
// aus dist/ an der Stelle, an die das Dockerfile dist/ kopiert.
const fehler = [];
const wurzel = /^\s*root\s+(\S+);/m.exec(conf)?.[1]?.replace(/\/$/, '');
const dockerZiel = existsSync('Dockerfile')
  ? /^COPY\s+--from=\S+\s+\S*\/dist\/?\s+(\S+)\s*$/m.exec(readFileSync('Dockerfile', 'utf8'))?.[1]?.replace(/\/$/, '')
  : undefined;
if (!wurzel) fehler.push(`${CONF}: keine root-Zeile gefunden — ohne sie lässt sich nicht sagen, wo nginx die Hash-Dateien sucht`);
if (dockerZiel !== undefined && dockerZiel !== wurzel)
  fehler.push(`Dockerfile kopiert dist/ nach ${dockerZiel ?? '(keine COPY-Zeile für dist/ gefunden)'}, nginx liest aus ${wurzel} — die Hash-Dateien kämen nicht an`);
const hashMaps = new Map();   // Variable -> { include, datei, wert, rueckfall }
for (const mm of conf.matchAll(/^map\s+"csp"\s+\$(\w+)\s*\{([^}]*)\}/gm)) {
  const [, name, rumpf] = mm;
  const rueckfall = /default\s+"([^"]*)"\s*;/.exec(rumpf)?.[1] ?? '';
  const include = /include\s+(\S+)\s*;/.exec(rumpf)?.[1];
  const eintrag = { include, datei: null, wert: null, rueckfall };
  hashMaps.set(name, eintrag);
  if (!include) { fehler.push(`$${name}: map ohne include-Zeile`); continue; }
  // `script-src-1.con[f]` ist ein Muster, damit nginx ohne die Datei
  // startet; die Datei selbst heißt …conf.
  const pfad = include.replace(/\[(.)\]/g, '$1');
  if (!wurzel || !pfad.startsWith(`${wurzel}/${CSP_ORDNER}/`)) {
    fehler.push(`$${name}: include ${include} liegt nicht unter ${wurzel}/${CSP_ORDNER}/ — dort legt der Bau die Hashes ab`);
    continue;
  }
  eintrag.datei = join(DIST, pfad.slice(wurzel.length + 1));
  if (!existsSync(eintrag.datei)) {
    fehler.push(`$${name}: ${eintrag.datei} fehlt — nginx fiele auf "${rueckfall}" zurück. scripts/_write-csp-hashes.mjs gehört ans Ende von npm run build`);
    continue;
  }
  eintrag.wert = leseMapWert(readFileSync(eintrag.datei, 'utf8'));
  if (eintrag.wert === null) fehler.push(`${eintrag.datei}: keine gültige Zeile \`csp "…";\` — Erzeuger und Tor sind auseinandergelaufen`);
}
const varWert = (name) => {
  const h = hashMaps.get(name);
  if (h) return (h.wert ?? h.rueckfall).split(/\s+/).filter(Boolean);
  if (!new RegExp(`^map\\s+\\S+\\s+\\$${name}\\s*\\{`, 'm').test(conf))
    fehler.push(`Content-Security-Policy nennt $${name}, aber ${CONF} hat dafür keine map — nginx setzte dort einen leeren Wert ein`);
  return mapDefault(name);
};

const policy = Object.fromEntries(
  m[1].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...src] = d.split(/\s+/);
    return [name, src.flatMap((s) => (s.startsWith('$') ? varWert(s.slice(1)) : [s]))];
  }),
);
/** Quellenliste einer Direktive, mit dem Rückfall auf default-src. */
const srcFor = (name) => policy[name] ?? policy['default-src'] ?? [];
const LOADING = ['img-src', 'script-src', 'frame-src', 'media-src', 'connect-src', 'style-src'];
const allows = (name, host) =>
  srcFor(name).some((s) => s === `https://${host}` || s === host);
const covers = (name, host) =>
  name === '(inline-js)' ? LOADING.some((d) => allows(d, host)) : allows(name, host);

// ------------------------------------------------------------------ Messung --
const found = new Map();   // "direktive host" -> {n, sample}
const note = (directive, url, page) => {
  let host;
  try { host = new URL(url).host; } catch { return; }
  if (host === 'verse-base.com') return;              // die eigene Domain
  const k = `${directive}|${host}`;
  if (!found.has(k)) found.set(k, { n: 0, sample: page });
  found.get(k).n++;
};

// Attribut -> Direktive. `preconnect`/`dns-prefetch` fehlen bewusst: die
// unterliegen der CSP nicht (sie holen keine Ressource).
const PATTERNS = [
  ['img-src', /<img[^>]+src="(https?:\/\/[^"]+)"/g],
  ['img-src', /url\((?:'|")?(https?:\/\/[^'")]+)/g],
  ['img-src', /data-(?:img|lb|fallback)[a-z-]*="(?:img:)?(https?:\/\/[^"]+)"/g],
  ['script-src', /<script[^>]+src="(https?:\/\/[^"]+)"/g],
  ['frame-src', /<iframe[^>]+src="(https?:\/\/[^"]+)"/g],
  ['media-src', /<(?:video|audio|source)[^>]+src="(https?:\/\/[^"]+)"/g],
  ['style-src', /<link[^>]+rel="stylesheet"[^>]+href="(https?:\/\/[^"]+)"/g],
  // Umami schickt an data-host-url (fetch, also connect-src); das Skript
  // selbst kommt vom eigenen Ursprung.
  ['connect-src', /\sdata-host-url="(https?:\/\/[^"]+)"/g],
];

// Inline-Bestand für die Hash-Prüfung.
const inline = {
  seiten: 0, ausgefuehrt: 0, daten: 0, extern: 0,
  hashes: new Map(),     // hash -> { n, seite, kopf }
  handler: new Map(),    // hash -> { n, seite, tag, attr, wert, unbekannt }
  jsUrls: [], svg: [], tokenAbweichung: [],
  imgFailSeiten: 0, imgFailOhneHoerer: [],
};
// Der Bild-Hörer aus Layout.astro (data-img-fail). Erkannt an seinem Kern.
const IMG_HOERER = "getAttribute('data-img-fail')";
const zaehlHosts = new Map();   // host -> erste Seite (data-host-url)

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!p.endsWith('.html')) continue;
    const html = readFileSync(p, 'utf8');
    for (const [directive, re] of PATTERNS)
      for (const hit of html.matchAll(re)) note(directive, hit[1], p);
    for (const hit of html.matchAll(/\sdata-host-url="(https?:\/\/[^"]+)"/g)) {
      try { const h = new URL(hit[1]).host; if (!zaehlHosts.has(h)) zaehlHosts.set(h, p); } catch { /* ungültig: fällt unten auf */ }
    }

    // Was der Browser als inline bewertet — derselbe Tokenizer wie der
    // Erzeuger, dazu eine einfache Textzählung als Gegenprobe.
    const z = zerlege(html);
    inline.seiten++;
    if (zaehleScriptTagsRoh(html) !== z.scriptTags) inline.tokenAbweichung.push(p);
    for (const x of z.skripte) {
      if (x.art === 'extern') { inline.extern++; continue; }
      if (x.art === 'daten') { inline.daten++; continue; }
      if (!x.hash) continue;
      if (x.svg) inline.svg.push(p);
      inline.ausgefuehrt++;
      const e = inline.hashes.get(x.hash);
      if (e) e.n++;
      else inline.hashes.set(x.hash, { n: 1, seite: p, kopf: x.text.trim().replace(/\s+/g, ' ').slice(0, 60) });
    }
    for (const x of z.handler) {
      const e = inline.handler.get(x.hash);
      if (e) e.n++;
      else inline.handler.set(x.hash, { n: 1, seite: p, tag: x.tag, attr: x.attr, wert: x.wert, unbekannt: x.unbekannt });
    }
    for (const j of z.jsUrls) inline.jsUrls.push(`${p}: <${j.tag} ${j.attr}="${j.wert.slice(0, 40)}">`);
    const ersteImgFail = html.search(/\sdata-img-fail=/);
    if (ersteImgFail >= 0) {
      inline.imgFailSeiten++;
      const hoerer = z.skripte.some((x) => x.hash && x.text.includes(IMG_HOERER) && /addEventListener\('error'/.test(x.text));
      const vorne = html.indexOf(IMG_HOERER);
      if (!hoerer || vorne < 0 || vorne > ersteImgFail) inline.imgFailOhneHoerer.push(p);
    }

    // Inline-Skripte bauen ihre URLs erst im Browser zusammen (die Klick-zu-
    // Laden-Fassade steckt den YouTube-<iframe> per innerHTML hinein, die
    // Profilseite ihre Bild-Rückfallkette). Die Attribut-Suche oben sieht davon
    // nichts. WELCHE Direktive greift, lässt sich hier nicht zuverlässig raten —
    // deshalb zählt ein Host als gedeckt, sobald IRGENDEINE Lade-Direktive ihn
    // erlaubt. Das findet weiterhin den Fall, auf den es ankommt: einen Host,
    // den die Richtlinie überhaupt nicht kennt.
    for (const s of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      if (/application\/ld\+json/.test(s[0])) continue;   // JSON-LD lädt nichts
      for (const u of s[1].matchAll(/https?:\/\/[a-z0-9.-]+[^\s'"`,)]*/gi)) {
        if (/schema\.org/.test(u[0])) continue;
        note('(inline-js)', u[0], p);
      }
    }
  }
}
walk(DIST);

// Client-JS baut URLs auch zur Laufzeit zusammen — die statische Suche oben
// sieht das nicht. Diese Muster sind die bekannten Fälle.
for (const f of readdirSync('assets').filter((f) => f.endsWith('.js'))) {
  const js = readFileSync(join('assets', f), 'utf8');
  for (const hit of js.matchAll(/(?:src|href)="(https?:\/\/[^"'+]+)/g))
    note(/iframe/i.test(hit[0]) || /embed/.test(hit[1]) ? 'frame-src' : 'connect-src', hit[1], `assets/${f}`);
}

// ------------------------------------------------------- Laufzeit-Fähigkeiten --
// Blob-Worker und WebAssembly tauchen in keinem Attribut auf, brauchen aber
// eigene Einträge. Quelle ist der Code, der sie benutzt.

// Der Supabase-Host steht in src/consts.ts — von dort liest ihn auch die Seite.
// Abschreiben würde die Prüfung von der Wirklichkeit lösen, sobald das Projekt
// umzieht. Der Block MUSS mitgematcht werden: `url:` steht in consts.ts
// zweimal, und die erste Fundstelle ist SITE.url (verse-base.com). Ohne den
// Blockanker prüfte das Tor auf den falschen Host — und wäre damit dauerhaft
// rot. Genau das hat die Gegenprobe am 17.08.2026 aufgedeckt.
const constsSrc = existsSync('src/consts.ts') ? readFileSync('src/consts.ts', 'utf8') : '';
const supabaseUrl = /export const SUPABASE\s*=\s*\{[^}]*?\burl:\s*'(https:\/\/[^']+)'/.exec(constsSrc)?.[1];
if (!supabaseUrl) { console.error('SUPABASE.url in src/consts.ts nicht gefunden.'); process.exit(2); }

const capChecks = [
  { files: ['public/vendor/three/addons/loaders/DRACOLoader.js'], pattern: /new Worker\(/,
    need: ['worker-src', 'blob:'], why: 'DRACOLoader startet einen Worker aus einem Blob' },
  { files: ['public/vendor/three/addons/loaders/DRACOLoader.js'], pattern: /new Worker\(/,
    need: ['script-src', "'wasm-unsafe-eval'"], why: 'Draco dekomprimiert die Meshes per WebAssembly' },
  { files: ['public/vendor/three/addons/loaders/GLTFLoader.js'], pattern: /createObjectURL/,
    need: ['img-src', 'blob:'], why: 'GLTFLoader legt Texturen als blob:-URL an' },
  { files: ['assets/hero-video.js'], pattern: /createObjectURL/,
    need: ['media-src', 'blob:'], why: 'hero-video.js spielt das Video aus einem Blob' },
  // Hochgeladene Profilbilder/Banner liegen im Supabase-Storage. Ihre URL kommt
  // aus der Datenbank und steht in KEINER gebauten Seite — die Messung oben
  // sieht sie nie. Ohne den Eintrag blockt der Browser sie still: leerer
  // Avatar-Kreis, schwarzes Banner, und der Upload sieht trotzdem erfolgreich
  // aus. Genau so war es bis zum 17.08.2026 auf staging UND live.
  { files: ['src/components/pilot/PilotPage.astro', 'src/scripts/account-dashboard.ts'],
    pattern: /avatar_url/,
    need: ['img-src', supabaseUrl],
    why: 'Profilbilder und Banner werden aus dem Supabase-Storage geladen (URL aus der DB)' },
  // Das Discord-Bild kommt aus den OAuth-Rohdaten der verbundenen Identität
  // (identity_data.avatar_url) und kann als Profilbild übernommen werden —
  // dann zeigen es auch Pilotenseite und Freundesliste. Ohne den Eintrag
  // blockt der Browser es still; so war es nach PR #225 auf staging.
  { files: ['src/scripts/account-dashboard.ts'],
    pattern: /identity_data[^\n]*avatar_url/,
    need: ['img-src', 'https://cdn.discordapp.com'],
    why: 'Discord-Bild der verbundenen Identität (identity_data.avatar_url) liegt auf cdn.discordapp.com' },
  // Der Chat der Kontoseite hört per Supabase Realtime auf neue Nachrichten.
  // Das ist ein Websocket (wss://…/realtime/v1/websocket), und eine
  // https://-Quelle deckt nach CSP3 KEIN wss:// ab. Ohne den Eintrag stünde
  // der Chat still auf dem Rückfall-Takt, ohne dass es jemand merkt.
  { files: ['src/components/account/FriendsDock.astro'],
    pattern: /postgres_changes/,
    need: ['connect-src', supabaseUrl.replace(/^https:/, 'wss:')],
    why: 'der Chat empfängt neue Nachrichten über den Realtime-Websocket von Supabase' },
];

// ------------------------------------------------- Inline-Skripte per Hash --
const quellen = (name) => new Set(policy[name] ?? []);
const skriptSrc = quellen('script-src');
const attrSrc = new Set(policy['script-src-attr'] ?? policy['script-src'] ?? []);
const kurz = (liste, max = 10) => liste.slice(0, max).concat(liste.length > max ? [`… und ${liste.length - max} weitere`] : []);

if (skriptSrc.has("'unsafe-inline'"))
  fehler.push("script-src trägt 'unsafe-inline' — ausgeliefert hieße das: eine HTML-Injektion führt Skript aus. Hashes kommen aus dist/_csp/ (siehe oben)");
// Quellen, die eingeschleustem oder fremdem Code dieselben Rechte geben
// wie dem eigenen. Gilt für script-src bzw. default-src, wenn es fehlt.
const VERBOTEN_IN_SCRIPT_SRC = ["'unsafe-eval'", '*', 'http:', 'https:', 'data:'];
for (const q of srcFor('script-src'))
  if (VERBOTEN_IN_SCRIPT_SRC.includes(q.toLowerCase()))
    fehler.push(`script-src trägt ${q} — damit liefe fremder bzw. eingeschleuster Code wie eigener; die Quelle gezielt benennen`);
// Ohne einen einzigen Hash gilt ein 'unsafe-inline' daneben — dann blockt
// der Browser nichts, und der Befund steht schon in der Zeile darüber.
const mitHash = (menge) => [...menge].some((q) => /^'sha(256|384|512)-/.test(q));
const skriptHashModus = mitHash(skriptSrc) || !skriptSrc.has("'unsafe-inline'");
const attrHashModus = mitHash(attrSrc) || !attrSrc.has("'unsafe-inline'");
if (!attrHashModus) fehler.push("script-src-attr trägt 'unsafe-inline' — Inline-Handler liefen ungeprüft (Rückfall, siehe oben)");
const ohneHash = skriptHashModus ? [...inline.hashes].filter(([h]) => !skriptSrc.has(h)) : [];
for (const z of kurz(ohneHash.map(([h, e]) => `Inline-Skript ${h} (${e.n}×, z. B. ${e.seite}: "${e.kopf}…") steht nicht in script-src — der Browser blockt es; npm run build neu laufen lassen`)))
  fehler.push(z);
const ungenutzt = [...skriptSrc].filter((q) => /^'sha(256|384|512)-/.test(q) && !inline.hashes.has(q));

const ausnahmeNach = new Map(HANDLER_AUSNAHMEN.map((a) => [cspHash(a.wert), a]));
for (const [h, e] of inline.handler) {
  const a = ausnahmeNach.get(h);
  if (!a || a.tag !== e.tag || a.attr !== e.attr)
    fehler.push(`Inline-Handler ${e.attr} an <${e.tag}> (${e.n}×, z. B. ${e.seite}) ohne benannte Ausnahme — als Listener in assets/ umsetzen, bei Bildern data-img-fail (Layout.astro)`);
  if (e.unbekannt.length) fehler.push(`Inline-Handler ${e.attr} an <${e.tag}> (${e.seite}): Zeichenreferenz ${e.unbekannt[0]} unbekannt, der Hash wäre geraten`);
  if (attrHashModus && (!attrSrc.has("'unsafe-hashes'") || !attrSrc.has(h)))
    fehler.push(`Inline-Handler ${e.attr} an <${e.tag}> (${h}) ist in script-src-attr nicht freigegeben — der Browser blockt ihn`);
}
const zombies = HANDLER_AUSNAHMEN.filter((a) => {
  const e = inline.handler.get(cspHash(a.wert));
  return !a.anlass?.trim() || !e || e.tag !== a.tag || e.attr !== a.attr;
});
for (const a of zombies)
  fehler.push(`HANDLER_AUSNAHMEN: ${a.attr} an <${a.tag}> ("${a.wert.slice(0, 40)}…") steht in keiner Seite mehr (oder ohne Anlass) — Eintrag entfernen`);
if (!inline.handler.size && !(attrSrc.size === 1 && attrSrc.has("'none'")))
  fehler.push(`Kein Inline-Handler im Build, script-src-attr steht trotzdem auf "${[...attrSrc].join(' ')}" — Soll 'none'`);
for (const z of kurz(inline.jsUrls)) fehler.push(`javascript:-Link ${z} — läuft unter dieser Richtlinie nicht; als Knopf mit Listener umsetzen`);
for (const z of kurz(inline.imgFailOhneHoerer))
  fehler.push(`${z}: Bild mit data-img-fail, aber der Bild-Hörer aus Layout.astro steht nicht davor — ein kaputtes Bild bliebe stehen; die Seite über Layout.astro bauen`);
for (const z of kurz(inline.svg)) fehler.push(`${z}: ausgeführtes Inline-Skript in <svg> — dort löst der Parser Zeichenreferenzen auf, der Hash ließe sich nicht sicher rechnen; Skript aus dem <svg> nehmen`);
for (const [host, seite] of zaehlHosts) {
  if (srcFor('script-src').some((q) => q === `https://${host}` || q === host))
    fehler.push(`script-src führt den Zähl-Host ${host} (data-host-url, z. B. ${seite}) — das Zählskript kommt vom eigenen Ursprung (public/vendor/umami/), der Host gehört nur nach connect-src`);
}

// add_header-Vererbung: nginx erbt add_header nur, solange ein Block
// keinen eigenen hat. Eine location mit add_header verlöre die Sicherheits-
// Kopfzeilen samt Richtlinie — still, nur für ihre Adressen.
// Anweisungen samt umgebendem Block; Zeichenketten in Anführungszeichen
// (die Richtlinie enthält ";") und Kommentare werden übersprungen.
function nginxAnweisungen(text) {
  const out = [], stapel = [];
  let akt = '', q = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { akt += c; if (c === '\\') akt += text[++i] ?? ''; else if (c === q) q = null; continue; }
    if (c === '#') { while (i < text.length && text[i] !== '\n') i++; akt += ' '; continue; }
    if (c === '"' || c === "'") { q = c; akt += c; continue; }
    if (c === '{') { stapel.push(akt.trim().split(/\s+/)[0]); akt = ''; continue; }
    if (c === '}') { stapel.pop(); akt = ''; continue; }
    if (c === ';') { out.push({ text: akt.trim(), block: stapel.at(-1) ?? 'http' }); akt = ''; continue; }
    akt += c;
  }
  return out;
}
let addHeaderServer = 0, addHeaderAusserhalb = 0;
for (const a of nginxAnweisungen(conf)) {
  if (!/^add_header\s/.test(a.text)) continue;
  const name = a.text.split(/\s+/)[1];
  if (a.block !== 'server') {
    addHeaderAusserhalb++;
    fehler.push(`${CONF}: add_header ${name} in einem ${a.block}-Block — verwirft dort alle Sicherheits-Kopfzeilen des server-Blocks; stattdessen über eine map im server-Block setzen`);
    continue;
  }
  addHeaderServer++;
  if (!/\salways$/.test(a.text)) fehler.push(`${CONF}: add_header ${name} ohne "always" — fehlt dann an 404- und Weiterleitungs-Antworten`);
}

// ------------------------------------------------------------------ Bericht --
const missing = [];
for (const [k, v] of found) {
  const [directive, host] = k.split('|');
  if (!covers(directive, host)) missing.push(`${directive}: ${host} fehlt (${v.n}×, z. B. ${v.sample})`);
}
for (const c of capChecks) {
  const used = c.files.some((f) => existsSync(f) && c.pattern.test(readFileSync(f, 'utf8')));
  if (used && !srcFor(c.need[0]).includes(c.need[1]))
    missing.push(`${c.need[0]}: ${c.need[1]} fehlt — ${c.why}`);
}

function artefakt() {
  const robots = join(DIST, 'robots.txt');
  if (!existsSync(robots)) return `${DIST}/ ohne robots.txt (unvollständiger Build?)`;
  return /^Disallow:\s*\/\s*$/m.test(readFileSync(robots, 'utf8')) ? `${DIST}/ — Vorschau-Build (STAGING=1)` : `${DIST}/ — Live-Build`;
}
console.log(`Geprüftes Artefakt: ${artefakt()} mit ${CONF}`);
console.log(`CSP geprüft gegen ${DIST}/ — ${found.size} externe Quelle(n) gefunden:`);
for (const k of [...found.keys()].sort()) {
  const [directive, host] = k.split('|');
  console.log(`  ${covers(directive, host) ? '✓' : '✗'} ${directive.padEnd(12)} ${host}  (${found.get(k).n}×)`);
}

if (missing.length) {
  console.log(`\nNICHT GEDECKT (${missing.length}):`);
  for (const p of missing) console.log('   ' + p);
  console.log(`\nEintragen in ${CONF} — die Seite würde diese Ressourcen sonst im Browser verlieren.`);
  process.exitCode = 1;
} else {
  console.log('\nAlles, was die Seite lädt, deckt die Richtlinie ab ✓');
}

console.log('\nInline-Skripte per Hash (dist/_csp/ -> nginx include)');
for (const [name, h] of hashMaps)
  console.log(`    $${name.padEnd(19)} ${h.wert !== null ? `${h.datei} — ${h.wert ? h.wert.split(/\s+/).length : 0} Quellausdruck/-ausdrücke` : `FEHLT, Rückfall "${h.rueckfall}"`}`);
console.log(`    Seiten: ${inline.seiten} (Klinke ${MIN_SEITEN})   ausgeführte Inline-Skripte: ${inline.ausgefuehrt} (Klinke ${MIN_INLINE_SKRIPTE}) in ${inline.hashes.size} Fassung(en)   Datenblöcke: ${inline.daten}   externe: ${inline.extern}`);
console.log(`    ohne Hash in script-src — Soll: 0   Ist: ${skriptHashModus ? ohneHash.length : 'nicht messbar (Rückfall)'}`);
console.log(`    Inline-Handler: ${[...inline.handler.values()].reduce((a, e) => a + e.n, 0)} in ${inline.handler.size} Fassung(en)   benannte Ausnahmen: ${HANDLER_AUSNAHMEN.length}   Zombies — Soll: 0   Ist: ${zombies.length}`);
console.log(`    script-src-attr: ${[...attrSrc].map((q) => (q.length > 20 ? q.slice(0, 18) + '…\'' : q)).join(' ')}`);
console.log(`    Seiten mit data-img-fail: ${inline.imgFailSeiten}   ohne Bild-Hörer davor — Soll: 0   Ist: ${inline.imgFailOhneHoerer.length}`);
console.log(`    javascript:-Links: ${inline.jsUrls.length}   Inline-Skripte in <svg>: ${inline.svg.length}   Zähl-Hosts (data-host-url): ${[...zaehlHosts.keys()].join(', ') || '—'}`);
console.log(`    add_header im server-Block: ${addHeaderServer}   außerhalb — Soll: 0   Ist: ${addHeaderAusserhalb}`);
if (inline.seiten < MIN_SEITEN)
  fehler.push(`nur ${inline.seiten} Seiten gelesen, Klinke ${MIN_SEITEN} — Build unvollständig? Ursache klären, nicht die Klinke senken`);
if (inline.ausgefuehrt < MIN_INLINE_SKRIPTE)
  fehler.push(`nur ${inline.ausgefuehrt} ausgeführte Inline-Skripte erkannt, Klinke ${MIN_INLINE_SKRIPTE} — die Erkennung läuft leer; Ursache klären, nicht die Klinke senken`);
if (ungenutzt.length)
  console.log(`    WARNUNG ${ungenutzt.length} Hash(es) in script-src ohne Inline-Skript in dist/ — dist/_csp/ stammt aus einem anderen Bau? npm run build neu`);
if (inline.tokenAbweichung.length)
  console.log(`    WARNUNG ${inline.tokenAbweichung.length} Seite(n), auf denen Tokenizer und Textsuche verschieden viele <script> zählen (z. B. ${inline.tokenAbweichung[0]}) — "<script" in Kommentar oder Text? Sonst den Tokenizer prüfen`);

if (fehler.length) {
  console.log(`\nFEHLER (${fehler.length}):`);
  for (const f of fehler) console.log('   ' + f);
  process.exitCode = 1;
} else {
  console.log('\nJedes Inline-Skript ist per Hash freigegeben, kein unbenannter Handler ✓');
}
