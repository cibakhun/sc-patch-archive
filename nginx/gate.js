/* ============================================================
   gate.js — Testpilot-Türsteher (Phase 14 Plan 01/08,
   D-03/D-04/D-06/D-08/D-09/D-10/D-11/D-13/D-23/D-24).

   Erstes Server-JS im nginx-Image. Zwei Ausfuhren, mehr nicht:

     check(r)  js_set-Handler, laeuft bei JEDEM Aufruf. Synchron, ohne
               Netz, ohne Datenbank — liefert nur "1"/"0". "1" in genau
               drei Faellen: das Tor ist am gepinnten Host aus
               ($vb_gate_on != "1", Live-Betrieb D-12); der Pfad steht
               in der Ausnahmeliste (defense-in-depth zur Location-Liste
               in nginx/default.conf — beide muessen zusammenpassen,
               Plan 09 friert das in einem Pruefer ein); oder das Cookie
               vb_gate traegt eine gueltige HMAC-SHA256-Signatur und ein
               exp in der Zukunft. KEIN ngx.fetch hier (D-08) — bei rund
               17.000 Unterseiten waere eine Discord-/Supabase-Anfrage je
               Seitenaufruf weder bezahlbar noch schnell.

     mint(r)   js_content-Handler fuer POST /_gate/mint. Liest die
               Authorization-Kopfzeile und ruft SERVER-ZU-SERVER GENAU
               EINMAL `public.gate_verdict()` auf (Plan 02) — dieselbe
               Kopfzeile durchgereicht, kein Service-Schluessel, die
               Funktion liest ihre Identitaet ausschliesslich aus
               auth.uid(). Das Urteil traegt in einem Aufruf, was vorher
               ein blosser Tabellenblick auf die Rollentabelle war: den
               Admin-Kurzschluss (D-04, jetzt IN der Funktion statt in
               njs), die Testpilot-Rolle aus discord_role_state (D-03),
               die Sperrliste VOR jeder Rolle (D-10) und die
               Fortschreibung von last_staging_seen (D-13). Same-origin
               gemintet (D-24) — ein Set-Cookie aus einer Cross-Origin-
               Antwort gilt fuer die ANTWORTENDE Domain, nicht fuer
               staging.verse-base.com.

   Nutzlastform: base64url(JSON.stringify({ sub, exp })) + "." +
   base64url(HMAC-SHA256(payload, VB_GATE_SECRET)). Kein JWT-Nachbau —
   das Supabase-Signaturverfahren ist im Umbruch (14-RESEARCH.md,
   Assumption A2/State of the Art); der Token wird deshalb NIE selbst
   geparst, sondern einmalig bei /_gate/mint server-zu-server gegen
   PostgREST verifiziert.

   Fehlt VB_GATE_SECRET oder ist es leer: check() liefert "0" und
   mint() antwortet mit 500 — ein Tuersteher ohne Schluessel laesst
   NIEMANDEN durch, statt jeden (T-14-04, fail-closed).

   D-09, und warum das hier fast von selbst stimmt: check() fragt
   niemanden — sie prueft nur eine Signatur. Ein Ausfall von Supabase,
   des Bots oder von Discord beruehrt sie NICHT: wer ein gueltiges
   Cookie hat, kommt weiter durch, bis dessen Laufzeit (300s) endet.
   Betroffen ist ausschliesslich mint(), und dort gilt hart: JEDE
   Antwort ausser einem klaren `allowed: true` — Zeitueberlauf (5s an
   ngx.fetch, eine haengende Gegenstelle darf den nginx-Arbeiter nicht
   binden), Netzfehler, ein Status ungleich 200, eine unlesbare Antwort
   oder ein Urteil ohne eindeutiges `allowed` — fuehrt zu 503 OHNE
   Ausweis. Im Zweifel bleibt das Tor zu. WER DIESE STELLE SPAETER
   "ROBUSTER" MACHEN UND BEI EINEM NETZFEHLER DURCHLASSEN WILL: genau
   das ist die Umkehrung von D-09 — gueltige Ausweise laufen bei einer
   Stoerung weiter, aber KEIN neuer Ausweis wird je aus einem unklaren
   Ausgang gemintet. Bitte nicht aendern, ohne D-09 neu zu verhandeln.
   ============================================================ */

import crypto from 'crypto';

/* Ausnahmeliste — muss mit den `location`-Bloecken in nginx/default.conf
   uebereinstimmen (Plan 09 friert das in scripts/verify-gate.mjs ein).
   /_gate/mint steht zusaetzlich hier, obwohl seine eigene Location nie
   $vb_gate_ok abfragt — defense-in-depth, falls sich das je aendert. */
const EXEMPT_PATHS = [
  '/gate.html',
  '/build.json',
  '/robots.txt',
  '/assets/theme.css',
  '/assets/fonts.css',
  '/_gate/mint',
];
const EXEMPT_PREFIXES = ['/assets/fonts/'];

function isExempt(uri) {
  if (EXEMPT_PATHS.indexOf(uri) !== -1) return true;
  for (let i = 0; i < EXEMPT_PREFIXES.length; i++) {
    if (uri.indexOf(EXEMPT_PREFIXES[i]) === 0) return true;
  }
  return false;
}

/* base64 -> base64url von Hand (statt sich auf digest('base64url') zu
   verlassen, dessen Verfuegbarkeit ueber njs-Versionen hinweg nicht
   sicher ist) — 'base64' + 'utf8' sind der kleinste gemeinsame Nenner
   des njs-crypto-Moduls. */
function toBase64Url(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(base64url) {
  let s = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return s;
}

function hmacBase64Url(secret, data) {
  return toBase64Url(crypto.createHmac('sha256', secret).update(data).digest('base64'));
}

/* Vergleich ueber die VOLLE Laenge, kein Kurzschluss beim ersten
   Unterschied (T-14-01). Laengenunterschiede fliessen als fester
   Zusatzfehler ein, ohne die Schleife vorzeitig zu verlassen. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.indexOf(name + '=') === 0) return p.slice(name.length + 1);
  }
  return null;
}

/* Verifiziert ein vb_gate-Cookie gegen das Geheimnis. Liefert die
   geparste Nutzlast ({ sub, exp }) bei Erfolg, sonst null — nie eine
   Ausnahme nach aussen (check() muss synchron und fehlerfest bleiben). */
function verifyCookie(cookieValue, secret) {
  if (!secret || !cookieValue) return null;
  const dot = cookieValue.lastIndexOf('.');
  if (dot < 1 || dot === cookieValue.length - 1) return null;
  const payloadB64Url = cookieValue.slice(0, dot);
  const sigB64Url = cookieValue.slice(dot + 1);
  const expectedSig = hmacBase64Url(secret, payloadB64Url);
  if (!safeEqual(expectedSig, sigB64Url)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(fromBase64Url(payloadB64Url), 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function check(r) {
  try {
    if (r.variables.vb_gate_on !== '1') return '1';
    if (isExempt(r.uri)) return '1';
    const secret = (process.env.VB_GATE_SECRET || '').trim();
    if (!secret) return '0';
    const cookieVal = readCookie(r.headersIn.Cookie, 'vb_gate');
    if (!cookieVal) return '0';
    return verifyCookie(cookieVal, secret) ? '1' : '0';
  } catch (e) {
    /* Ein unerwarteter Fehler darf das Tor nicht oeffnen — fail-closed. */
    return '0';
  }
}

function jsonResponse(r, status, bodyObj) {
  r.headersOut['Content-Type'] = 'application/json';
  r.return(status, JSON.stringify(bodyObj));
}

/* 5000ms — eine haengende Gegenstelle darf den nginx-Arbeiter nicht binden
   (D-09, siehe Kopfkommentar). njs kennt setTimeout()/clearTimeout(); ein
   Promise.race gegen einen Zeitgeber ist der uebliche Weg, weil der
   ausgehende Netzaufruf (ngx' fetch-Methode) selbst keine eigene
   Zeitueberlauf-Option kennt. */
const MINT_TIMEOUT_MS = 5000;

function mint(r) {
  /* Synchroner Teil in try/catch: ein unerwarteter Fehler hier soll eine
     eigene JSON-500-Antwort liefern, nicht nginx' generische Fehlerseite
     (die die Sonde als blosses "500" ohne Grund sieht, Lauf 32045776329 —
     dort riss r.discardRequestBody(), eine erfundene njs-Methode, jeden
     einzelnen Mint-Aufruf mit einem unbeschrifteten 500). */
  try {
    const secret = (process.env.VB_GATE_SECRET || '').trim();
    const supabaseUrl = (process.env.VB_SUPABASE_URL || '').trim();
    const anonKey = (process.env.VB_SUPABASE_ANON_KEY || '').trim();

    if (!secret || !supabaseUrl || !anonKey) {
      jsonResponse(r, 500, { ok: false, grund: 'tuersteher-nicht-konfiguriert' });
      return;
    }

    const auth = r.headersIn.Authorization;
    if (!auth) {
      jsonResponse(r, 401, { ok: false, grund: 'keine-anmeldung' });
      return;
    }

    /* Antworten darf GENAU EINMAL passieren — Timeout und Netzaufruf laufen
       gegeneinander (Promise.race), und ohne diesen Riegel koennten beide
       Zweige "gleichzeitig" antworten (r.return zweimal). */
    let beantwortet = false;
    const antworten = (status, body) => {
      if (beantwortet) return;
      beantwortet = true;
      jsonResponse(r, status, body);
    };

    let timeoutId = null;
    const zeitgeber = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ zeitueberlauf: true }), MINT_TIMEOUT_MS);
    });

    Promise.race([
      ngx
        .fetch(supabaseUrl + '/rest/v1/rpc/gate_verdict', {
          method: 'POST',
          headers: {
            Authorization: auth,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          /* gate_verdict() ist parameterlos (Identitaet ausschliesslich
             aus auth.uid()) — PostgREST verlangt trotzdem einen Rumpf fuer
             POST /rpc/…, ein leeres Objekt ist der korrekte Leerwert. */
          body: '{}',
        })
        .then((reply) => {
          if (reply.status !== 200) {
            /* Status ungleich 200 heisst: das URTEIL selbst ist gescheitert
               (5xx von PostgREST, ein abgelehntes/abgelaufenes Token faellt
               NICHT hierunter — Supabase liefert dafuer 401/403, s.u.). Kein
               klares allowed:true -> 503, nie ein Ausweis (D-09). */
            return { zeitueberlauf: false, status: reply.status, verdict: null };
          }
          return reply.json().then(
            (verdict) => ({ zeitueberlauf: false, status: 200, verdict }),
            () => ({ zeitueberlauf: false, status: 200, verdict: undefined }), // unlesbare Antwort
          );
        }),
      zeitgeber,
    ])
      .then((ergebnis) => {
        if (beantwortet) return; // Zeitgeber gewann NACHDEM bereits geantwortet wurde
        clearTimeout(timeoutId);

        if (ergebnis.zeitueberlauf) {
          antworten(503, { ok: false, grund: 'supabase-zeitueberlauf' });
          return;
        }
        if (ergebnis.status === 401 || ergebnis.status === 403) {
          /* Supabase weist das Token selbst zurueck (erfunden/abgelaufen) —
             das ist eine klare Ablehnung, kein unklarer Ausgang. */
          antworten(403, { ok: false, grund: 'kein-zugang' });
          return;
        }
        const verdict = ergebnis.verdict;
        if (verdict === null || verdict === undefined || typeof verdict !== 'object') {
          /* jeder sonstige unklare Ausgang: 5xx, unlesbare Antwort, ein
             Objekt, das gar kein Urteil ist — 503, NIE ein Ausweis. */
          antworten(503, { ok: false, grund: 'urteil-unklar' });
          return;
        }
        if (verdict.allowed === false) {
          antworten(403, { ok: false, grund: typeof verdict.grund === 'string' ? verdict.grund : 'kein-zugang' });
          return;
        }
        if (verdict.allowed !== true || typeof verdict.sub !== 'string' || !verdict.sub) {
          /* allowed ist weder true noch false (kaputtes/fremdes JSON) —
             ein Ausweis wird in KEINEM Fall ausgestellt, in dem allowed
             nicht AUSDRUECKLICH true ist. */
          antworten(503, { ok: false, grund: 'urteil-unklar' });
          return;
        }

        const expHint = Number.isFinite(verdict.exp_hint) && verdict.exp_hint > 0 ? verdict.exp_hint : 300;
        const exp = Math.floor(Date.now() / 1000) + expHint;
        const payloadB64Url = toBase64Url(Buffer.from(JSON.stringify({ sub: verdict.sub, exp })).toString('base64'));
        const sig = hmacBase64Url(secret, payloadB64Url);
        const cookieVal = payloadB64Url + '.' + sig;

        r.headersOut['Set-Cookie'] = [
          `vb_gate=${cookieVal}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${expHint}`,
          `vb_gate_exp=${exp}; Path=/; Secure; SameSite=Lax; Max-Age=${expHint}`,
        ];
        antworten(200, { ok: true, exp });
      })
      .catch((e) => {
        if (beantwortet) return;
        clearTimeout(timeoutId);
        /* r.error() ins nginx error.log — die JSON-Antwort bleibt bewusst
           unbeschriftet (keine Interna nach aussen), aber ohne diese Zeile
           war die Fehlerursache aus dem Container nicht ablesbar (Lauf
           32046961882: 502 ohne jeden weiteren Hinweis). Netzfehler ist
           ein unklarer Ausgang -> 503, nie ein Ausweis (D-09). */
        r.error('gate.mint: ngx.fetch fehlgeschlagen: ' + e);
        antworten(503, { ok: false, grund: 'supabase-nicht-erreichbar' });
      });
  } catch (e) {
    r.error('gate.mint: unerwarteter Fehler: ' + e);
    jsonResponse(r, 500, { ok: false, grund: 'tuersteher-fehler' });
  }
}

/* njs erlaubt fuer js_import AUSSCHLIESSLICH einen Default-Export — ein
   benannter Export ("export function check", "export function mint")
   bricht den Bau mit "SyntaxError: Non-default export is not supported"
   (gefunden durch die E2E-Sonde, Lauf 32045452259, RUN nginx -t). Referenz
   in nginx/default.conf bleibt trotzdem gate.check / gate.mint — njs
   loest das ueber den Default-Export auf. */
export default { check, mint };
