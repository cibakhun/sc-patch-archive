/* ============================================================
   csp-inline.mjs — findet in gebautem HTML, was die Content-Security-
   Policy als "inline" bewertet, und rechnet die Hashes so, wie der
   Browser sie rechnet.

   Genutzt vom Erzeuger (scripts/_write-csp-hashes.mjs, letzter Schritt
   von `npm run build`) und vom Tor (scripts/audit-csp.mjs). Kein Netz,
   kein git, kein Kindprozess.

   Warum ein kleiner Tokenizer statt eines Regex: ein Hash, der um ein
   Zeichen daneben liegt, blockt das Skript im Browser still. Die
   Stellen, an denen ein Regex danebengreift, gibt es im HTML-Standard
   wirklich:
     - ein `>` in einem Attributwert in Anfuehrungszeichen beendet das
       Start-Tag nicht;
     - in <style>, <textarea>, <title>, <noscript> usw. ist `<script`
       nur Text, ebenso in Kommentaren;
     - der Inhalt eines <script> endet am ersten `</script` mit einem
       Trenner dahinter — ausser in der alten `<!-- <script>`-
       Schreibweise ("double escaped"), dort erst am zweiten;
     - vor dem Zerlegen macht der Browser aus CRLF und CR ein LF;
     - in Attributwerten sind Zeichenreferenzen (&amp; &#39; …) schon
       aufgeloest, wenn der Browser den Handler hasht; in <script> nicht.
   Welche <script> ueberhaupt ausgefuehrt werden (und damit einen Hash
   brauchen), folgt "prepare the script element": klassisch (kein type,
   leerer type oder ein JavaScript-MIME-Typ), module, importmap und
   speculationrules; alles andere (application/json, ld+json, …) ist ein
   Datenblock und unterliegt der CSP nicht. Ein leeres Inline-Skript
   laeuft nicht und braucht keinen Hash; eines mit src ist extern.
   ============================================================ */
import { createHash } from 'node:crypto';

const JS_MIME = new Set([
  'application/ecmascript', 'application/javascript', 'application/x-ecmascript',
  'application/x-javascript', 'text/ecmascript', 'text/javascript', 'text/javascript1.0',
  'text/javascript1.1', 'text/javascript1.2', 'text/javascript1.3', 'text/javascript1.4',
  'text/javascript1.5', 'text/jscript', 'text/livescript', 'text/x-ecmascript', 'text/x-javascript',
]);
// Elemente, deren Inhalt der Tokenizer als Text liest (RAWTEXT/RCDATA;
// <noscript> bei eingeschaltetem JavaScript, <plaintext> bis zum Ende).
const ROHTEXT = new Set(['style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript']);
const TRENNER = /[\t\n\f\r />]/;
const NAMEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** sha256 im CSP-Format, ueber UTF-8 wie der Browser. */
export const cspHash = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** Zeilenenden wie die Vorverarbeitung des HTML-Parsers. */
export const normalisiere = (html) => html.replace(/\r\n?/g, '\n');

/**
 * Zeichenreferenzen in einem Attributwert aufloesen. Unbekannte benannte
 * Referenzen kommen als `unbekannt` zurueck — der Hash waere dann geraten.
 */
export function dekodiere(wert) {
  const unbekannt = [];
  const text = wert.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);?/g, (ganz, ref) => {
    if (ref[0] === '#') {
      const cp = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '�';
    }
    if (Object.hasOwn(NAMEN, ref) && ganz.endsWith(';')) return NAMEN[ref];
    unbekannt.push(ganz);
    return ganz;
  });
  return { text, unbekannt };
}

function istEndTag(html, p, name) {
  return html[p] === '<' && html[p + 1] === '/' &&
    html.slice(p + 2, p + 2 + name.length).toLowerCase() === name && TRENNER.test(html[p + 2 + name.length] ?? '');
}
function istScriptStart(html, p) {
  return html[p] === '<' && html.slice(p + 1, p + 7).toLowerCase() === 'script' && TRENNER.test(html[p + 7] ?? '');
}

/** Ende des Skript-Inhalts ab `ab` (Index von `</script`), oder html.length. */
function skriptEnde(html, ab) {
  let zustand = 'daten';
  for (let p = ab; p < html.length; p++) {
    const c = html[p];
    if (c !== '<' && c !== '-') continue;
    if (zustand === 'daten') {
      if (html.startsWith('<!--', p)) {
        // Nach "<!--" weitere "-" ueberspringen; folgt ">" ("<!-->",
        // "<!--->"), bleibt es Daten, sonst beginnt der escaped-Teil.
        let q = p + 4;
        while (html[q] === '-') q++;
        if (html[q] === '>') { p = q; continue; }
        zustand = 'escaped'; p = q - 1; continue;
      }
      if (istEndTag(html, p, 'script')) return p;
    } else if (zustand === 'escaped') {
      if (html.startsWith('-->', p)) { zustand = 'daten'; p += 2; continue; }
      if (istEndTag(html, p, 'script')) return p;
      if (istScriptStart(html, p)) { zustand = 'double'; p += 6; continue; }
    } else {
      if (html.startsWith('-->', p)) { zustand = 'daten'; p += 2; continue; }
      if (istEndTag(html, p, 'script')) { zustand = 'escaped'; p += 8; continue; }
    }
  }
  return html.length;
}

/** Start-Tag ab `p` (zeigt auf `<`) zerlegen: Name, Attribute, Index nach `>`. */
function startTag(html, p) {
  const m = /^<([A-Za-z][^\t\n\f\r />]*)/.exec(html.slice(p, p + 64));
  if (!m) return null;
  const name = m[1].toLowerCase();
  const attrs = new Map();
  let i = p + m[0].length;
  const n = html.length;
  while (i < n) {
    while (i < n && /[\t\n\f\r /]/.test(html[i])) i++;
    if (i >= n) break;
    if (html[i] === '>') return { name, attrs, ende: i + 1 };
    let j = i;
    // Ein Attributname darf mit "=" beginnen (Tokenizer-Sonderfall), sonst endet er an Trenner/=.
    if (html[j] === '=') j++;
    while (j < n && !/[\t\n\f\r />=]/.test(html[j])) j++;
    const an = html.slice(i, j).toLowerCase();
    i = j;
    while (i < n && /[\t\n\f\r ]/.test(html[i])) i++;
    let wert = '';
    if (html[i] === '=') {
      i++;
      while (i < n && /[\t\n\f\r ]/.test(html[i])) i++;
      const q = html[i];
      if (q === '"' || q === "'") {
        const e = html.indexOf(q, i + 1);
        const bis = e < 0 ? n : e;
        wert = html.slice(i + 1, bis);
        i = bis + 1;
      } else {
        let e = i;
        while (e < n && !/[\t\n\f\r >]/.test(html[e])) e++;
        wert = html.slice(i, e);
        i = e;
      }
    }
    if (an && !attrs.has(an)) attrs.set(an, wert);   // doppeltes Attribut: das erste gilt
  }
  return { name, attrs, ende: n };
}

/** Art eines <script> nach "prepare the script element". */
export function skriptArt(attrs) {
  if (attrs.has('src')) return 'extern';
  let typ;
  if (attrs.has('type')) typ = dekodiere(attrs.get('type')).text;
  else if (attrs.has('language')) typ = attrs.get('language') === '' ? '' : 'text/' + dekodiere(attrs.get('language')).text;
  else typ = '';
  typ = typ.trim().toLowerCase();
  if (typ === '' || JS_MIME.has(typ.split(';')[0].trim())) return 'klassisch';
  if (typ === 'module') return 'modul';
  if (typ === 'importmap') return 'importmap';
  if (typ === 'speculationrules') return 'speculationrules';
  return 'daten';
}
const AUSGEFUEHRT = new Set(['klassisch', 'modul', 'importmap', 'speculationrules']);

/**
 * Zerlegt ein Dokument. Liefert
 *   skripte:  [{ art, text, hash, svg }]   jedes <script> (auch extern/Daten; hash nur bei ausgefuehrten mit Inhalt)
 *   handler:  [{ tag, attr, wert, hash, unbekannt }]   jedes on…-Attribut, Wert dekodiert
 *   jsUrls:   [{ tag, attr, wert }]        href/src/action/formaction mit javascript:
 *   scriptTags: Zahl der <script>-Start-Tags, die der Tokenizer gesehen hat
 */
export function zerlege(rohHtml) {
  const html = normalisiere(rohHtml);
  const skripte = [], handler = [], jsUrls = [];
  let svgTiefe = 0, scriptTags = 0;
  const n = html.length;
  let p = 0;
  while (p < n) {
    const lt = html.indexOf('<', p);
    if (lt < 0) break;
    p = lt;
    if (html.startsWith('<!--', p)) {
      // Kommentar: "<!-->" und "<!--->" sind schon zu Ende, sonst bis
      // "-->" oder "--!>".
      if (html.startsWith('<!-->', p)) { p += 5; continue; }
      if (html.startsWith('<!--->', p)) { p += 6; continue; }
      const a = html.indexOf('-->', p + 4), b = html.indexOf('--!>', p + 4);
      const e = a < 0 ? b : b < 0 ? a : Math.min(a, b);
      p = e < 0 ? n : e + (e === b ? 4 : 3);
      continue;
    }
    if (html.startsWith('<![CDATA[', p)) {
      const e = html.indexOf(']]>', p + 9);
      p = e < 0 ? n : e + 3;
      continue;
    }
    if (html[p + 1] === '!' || html[p + 1] === '?') {
      const e = html.indexOf('>', p + 2);
      p = e < 0 ? n : e + 1;
      continue;
    }
    if (html[p + 1] === '/') {
      const m = /^<\/([A-Za-z][^\t\n\f\r />]*)/.exec(html.slice(p, p + 64));
      if (m && (m[1].toLowerCase() === 'svg' || m[1].toLowerCase() === 'math')) svgTiefe = Math.max(0, svgTiefe - 1);
      const e = html.indexOf('>', p + 2);
      p = e < 0 ? n : e + 1;
      continue;
    }
    const tag = startTag(html, p);
    if (!tag) { p++; continue; }
    p = tag.ende;
    const selbstschliessend = html[tag.ende - 2] === '/';
    if ((tag.name === 'svg' || tag.name === 'math') && !selbstschliessend) svgTiefe++;

    for (const [an, w] of tag.attrs) {
      if (/^on[a-z]+$/.test(an)) {
        const { text, unbekannt } = dekodiere(w);
        handler.push({ tag: tag.name, attr: an, wert: text, hash: cspHash(text), unbekannt });
      } else if (/^(?:href|src|action|formaction|xlink:href)$/.test(an) && /^\s*javascript:/i.test(dekodiere(w).text)) {
        jsUrls.push({ tag: tag.name, attr: an, wert: w });
      }
    }

    if (tag.name === 'script') {
      scriptTags++;
      const ende = skriptEnde(html, p);
      const text = html.slice(p, ende);
      const art = skriptArt(tag.attrs);
      const laeuft = AUSGEFUEHRT.has(art) && text !== '';
      skripte.push({ art, text, hash: laeuft ? cspHash(text) : null, svg: svgTiefe > 0 });
      const zu = html.indexOf('>', ende);
      p = ende >= n ? n : (zu < 0 ? n : zu + 1);
      continue;
    }
    if (tag.name === 'plaintext') break;
    if (ROHTEXT.has(tag.name) && svgTiefe === 0) {
      let e = p;
      while (e < n && !istEndTag(html, e, tag.name)) {
        const nx = html.indexOf('<', e + 1);
        e = nx < 0 ? n : nx;
      }
      p = e;
    }
  }
  return { skripte, handler, jsUrls, scriptTags };
}

/** Anzahl <script-Start-Tags nach einfacher Textsuche (Gegenprobe zum Tokenizer). */
export const zaehleScriptTagsRoh = (html) => (html.match(/<script[\t\n\f\r />]/gi) ?? []).length;

/**
 * Verteilt Quellausdruecke auf Bloecke, deren Text (mit Leerzeichen)
 * hoechstens `max` Zeichen hat. nginx liest keinen Parameter ab 4 KB.
 */
export function bloecke(quellen, max = 3800) {
  const out = [];
  let akt = '';
  for (const q of quellen) {
    if (q.length > max) throw new Error(`Quellausdruck laenger als ${max} Zeichen: ${q.slice(0, 40)}…`);
    if (akt && akt.length + 1 + q.length > max) { out.push(akt); akt = ''; }
    akt = akt ? `${akt} ${q}` : q;
  }
  if (akt) out.push(akt);
  return out;
}

/* ---------- Ablage unter dist/_csp/ (geteilt von Erzeuger und Tor) ---------- */
export const CSP_ORDNER = '_csp';
export const SKRIPT_BLOECKE = 3;
export const skriptDatei = (i) => `script-src-${i}.conf`;
export const ATTR_DATEI = 'script-src-attr.conf';
export const MAP_SCHLUESSEL = 'csp';

/** Eine Zeile `csp "<wert>";` in einer include-Datei lesen. */
export function leseMapWert(text) {
  const zeilen = text.split('\n').map((z) => z.trim()).filter((z) => z && !z.startsWith('#'));
  const m = zeilen.length === 1 && new RegExp(`^${MAP_SCHLUESSEL}\\s+"([^"$]*)";$`).exec(zeilen[0]);
  return m ? m[1] : null;
}
