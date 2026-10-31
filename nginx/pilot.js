/* ============================================================
   pilot.js — eigene Link-Vorschau je Pilot (Runde 4 der
   Kontoseite, „Teilen und Einladen", 31.10.2026).

   Wer /de/pilot/<handle> in Discord (oder Telegram, WhatsApp, X …)
   postet, bekam bisher die Karte der leeren Profilseite: „Pilot |
   VerseBase", ein allgemeiner Satz, das Standardbild. Die Seite ist
   statisch und laedt das Profil erst im Browser — der Abrufer der
   Vorschau fuehrt kein JS aus. Deshalb setzt nginx hier, bevor die
   Datei rausgeht, die Vorschau-Kopfzeilen auf den Piloten:

     <title>, description, og:title, og:description, og:url,
     og:image (+ :alt), twitter:card, twitter:image, theme-color
     (Discord faerbt den Rand der Karte damit: Profilfarbe).

   Bild: das Titelbild des Profils (gross), sonst das Profilbild
   (klein, als Daumen neben dem Text), sonst bleibt das Standardbild.

   Eine Ausfuhr, page(r), js_content-Handler fuer /de/pilot.html und
   /pilot.html (dorthin schreibt `location /de/pilot/` intern um, der
   Handle steht in ?h=). Das Tor davor bleibt eine nginx-Zeile in der
   location (verify-gate Zusicherung 7), hier wird nichts geprueft.

   Ausfallsicher in jede Richtung: unbekannter Handle, Netzfehler,
   Zeitueberlauf (1,5 s), unlesbare Antwort — immer die unveraenderte
   Seite, die dann wie bisher selbst im Browser laedt. Gelesen wird
   nur die oeffentliche Sicht public_profiles mit dem oeffentlichen
   Schluessel (derselbe steht im Seiten-JS, src/consts.ts; ein Test
   haelt beide gleich). Alles aus dem Profil geht escaped in Attribute,
   Bild-Adressen nur von dieser Seite oder https.
   ============================================================ */

import fs from 'fs';

const ROOT = '/usr/share/nginx/html';
// Rueckfall, wenn der Container die Variablen nicht traegt (Live-Seite):
// oeffentlich, steht ohnehin in jedem Seitenbuendel (src/consts.ts).
const SUPABASE_URL = 'https://trgjhmbnodoarnfmlcqx.supabase.co';
const SUPABASE_PUBLISHABLE = 'sb_publishable_AN3O0va6kEsCmHr6zDcwRQ_8sT68W3J';
// Wie die Seite selbst (PilotPage.astro): klein geschrieben, 3–24 Zeichen.
const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
const FETCH_TIMEOUT_MS = 1500;
const COLS = 'handle,display_name,bio,banner_url,avatar_url,avatar_color,org_name';

const TEXT = {
  de: { tail: ' | VerseBase', fallback: 'Pilotenprofil auf VerseBase: Status, Rolle, Flotte und Favoriten.' },
  en: { tail: ' | VerseBase', fallback: 'Pilot profile on VerseBase: status, role, fleet and favourites.' },
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Eine Zeile, hoechstens n Zeichen, am Wortende gekuerzt.
function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

// Bild-Adresse fuer og:image: Pfad auf dieser Seite -> absolut, sonst nur https.
function imageUrl(origin, u) {
  const v = String(u || '').trim();
  if (/^\/[A-Za-z0-9._~\/-]+$/.test(v) && v.indexOf('//') === -1) return origin + v;
  if (/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/[^\s"'<>]*$/.test(v)) return v;
  return '';
}

// Ersetzt den content="" eines vorhandenen <meta …>; fehlt der Tag, bleibt alles.
function setMeta(html, attr, name, value) {
  const re = new RegExp('(<meta ' + attr + '="' + name.replace(/[.:]/g, '\\$&') + '" content=")[^"]*(")');
  return html.replace(re, (m, a, b) => a + esc(value) + b);
}

/* Die Seite mit den Vorschau-Kopfzeilen eines Piloten. Rein (ohne Netz),
   damit tests/e2e/pilot-og.test.js sie in node:vm durchspielen kann. */
function withPilot(html, p, de) {
  const T = de ? TEXT.de : TEXT.en;
  const handle = String(p.handle || '').toLowerCase();
  if (!HANDLE_RE.test(handle)) return html;
  const ogUrl = /<meta property="og:url" content="(https:\/\/[A-Za-z0-9.-]+)\//.exec(html);
  if (!ogUrl) return html;
  const origin = ogUrl[1];
  const name = clip(p.display_name, 60) || handle;
  const title = name + ' (@' + handle + ')' + T.tail;
  const org = clip(p.org_name, 60);
  const desc = clip((org ? org + ' · ' : '') + (clip(p.bio, 240) || T.fallback), 280);

  let out = html.replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(title) + '</title>');
  out = setMeta(out, 'name', 'description', desc);
  out = setMeta(out, 'property', 'og:title', title);
  out = setMeta(out, 'property', 'og:description', desc);
  out = setMeta(out, 'property', 'og:url', origin + (de ? '/de' : '') + '/pilot/' + handle);
  out = setMeta(out, 'property', 'og:image:alt', name);

  const banner = imageUrl(origin, p.banner_url);
  const avatar = imageUrl(origin, p.avatar_url);
  const img = banner || avatar;
  if (img) {
    out = setMeta(out, 'property', 'og:image', img);
    out = setMeta(out, 'name', 'twitter:image', img);
    // Profilbild ist quadratisch und klein: als Daumen, nicht als Breitbild.
    if (!banner) out = setMeta(out, 'name', 'twitter:card', 'summary');
  }
  const col = String(p.avatar_color || '');
  if (/^#[0-9a-fA-F]{6}$/.test(col)) out = setMeta(out, 'name', 'theme-color', col);
  return out;
}

function profile(handle) {
  const url = (process.env.VB_SUPABASE_URL || SUPABASE_URL).trim();
  const key = (process.env.VB_SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE).trim();
  let timer = null;
  const zeit = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), FETCH_TIMEOUT_MS);
  });
  const abruf = ngx
    .fetch(url + '/rest/v1/public_profiles?select=' + COLS + '&handle=eq.' + handle + '&limit=1', {
      headers: { apikey: key, Accept: 'application/json' },
    })
    .then((reply) => (reply.status === 200 ? reply.json() : null))
    .then((rows) => {
      clearTimeout(timer);
      return rows && rows.length ? rows[0] : null;
    });
  return Promise.race([abruf, zeit]);
}

async function page(r) {
  const de = r.uri.indexOf('/de/') === 0;
  let html;
  try {
    html = fs.readFileSync(ROOT + (de ? '/de/pilot.html' : '/pilot.html'), 'utf8');
  } catch (e) {
    r.error('pilot.page: Datei fehlt: ' + e);
    r.return(404);
    return;
  }
  const h = String((r.args && r.args.h) || '').trim().toLowerCase();
  if (HANDLE_RE.test(h)) {
    try {
      const p = await profile(h);
      if (p) html = withPilot(html, p, de);
    } catch (e) {
      r.warn('pilot.page: Profil nicht geladen, Seite ohne eigene Vorschau: ' + e);
    }
  }
  r.headersOut['Content-Type'] = 'text/html; charset=utf-8';
  r.return(200, html);
}

/* njs erlaubt fuer js_import nur einen Default-Export (siehe gate.js). */
export default { page, withPilot };
