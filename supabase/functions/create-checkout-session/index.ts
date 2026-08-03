// Supabase Edge Function `create-checkout-session`
//
// Legt eine von Stripe gehostete Bezahlseite an und gibt deren URL zurueck. Die
// Seite leitet dann per `location.href` dorthin weiter — NICHT per Formular:
// ein POST an Stripe fiele unter die `form-action`-Direktive der CSP und wuerde
// still blockiert (siehe nginx/default.conf).
//
// OHNE SESSION AUFRUFBAR. Das ist Absicht (Spenden soll ohne Konto gehen) und
// haengt an `verify_jwt = false` in supabase/config.toml. Was danach noch
// schuetzt:
//   * Das Gateway verlangt weiterhin den apikey-Kopf.
//   * Der Betrag wird HIER geklemmt, nicht im Browser. Ein manipulierter Client
//     kann keinen beliebigen Betrag erzwingen.
//   * CORS ist auf die eigenen Herkuenfte begrenzt statt auf `*` — anders als
//     bei verify-rsi, wo das noch offen steht.
//   * Die Rueckkehr-URL wird NICHT aus der Anfrage uebernommen, sondern aus der
//     geprueften Herkunft gebaut. Sonst waere das eine offene Weiterleitung.
//
// Der Schluessel in STRIPE_SECRET_KEY ist ein EINGESCHRAENKTER Schluessel
// (rk_…) mit genau einem Recht: Checkout Sessions schreiben. Ein abgegriffener
// Secret Key koennte Rueckerstattungen ausloesen und Auszahlungen umleiten —
// dieser kann eine Bezahlseite anlegen und sonst nichts.
import Stripe from 'npm:stripe@^22';

/** Gepinnt: ohne feste Version aendert Stripe das Antwortformat unter uns weg. */
const API_VERSION = '2026-07-29.dahlia';

/** Betragsgrenzen in Cent. Gilt serverseitig, egal was der Browser schickt. */
const MIN_CENTS = 100;
const MAX_CENTS = 50000;

/**
 * Erlaubte Herkuenfte. Bewusst eine Liste statt `*`: das haelt fremde Seiten
 * davon ab, diesen Endpunkt aus dem Browser ihrer Besucher aufzurufen. Gegen
 * ein direktes curl hilft es nicht — dagegen hilft die Betragsklemme oben.
 */
const ALLOWED_ORIGINS = [
  'https://verse-base.com',
  'https://staging.verse-base.com',
];

/**
 * Feste Marke fuer das Stripe-Dashboard. Der Zufallssuffix wird EINMAL
 * vergeben und bleibt stehen — pro Aufruf neu gewuerfelt waere er als Filter
 * wertlos.
 */
const INTEGRATION_ID = 'versebase-support-qkzmrtwd';

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) {
    // Kein Schluessel hinterlegt: ehrlich scheitern statt so tun, als ginge es.
    return json({ error: 'not_configured' }, 503, origin);
  }

  let body: { amount_cents?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400, origin);
  }

  // Betragspruefung. Ganzzahlig, in Grenzen, keine Sonderwerte — parseInt waere
  // hier zu gutmuetig ("12abc" -> 12).
  const cents = Number(body.amount_cents);
  if (!Number.isInteger(cents) || cents < MIN_CENTS || cents > MAX_CENTS) {
    return json({ error: 'amount_out_of_range', min: MIN_CENTS, max: MAX_CENTS }, 400, origin);
  }

  const lang = body.lang === 'de' ? 'de' : 'en';
  // Rueckkehrziel aus der GEPRUEFTEN Herkunft bauen, nie aus der Anfrage
  // uebernehmen — sonst koennte jemand Besucher auf eine fremde Seite leiten.
  const base = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const path = lang === 'de' ? '/de/support.html' : '/support.html';

  const stripe = new Stripe(secret, { apiVersion: API_VERSION });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // payment_method_types wird BEWUSST nicht gesetzt. Ohne den Parameter
      // waehlt Stripe die Zahlarten dynamisch — fuer deutsche Unterstuetzer
      // heisst das SEPA, Klarna, Apple Pay und Google Pay ohne eine Zeile Code.
      // Ein hartverdrahtetes ['card'] schaltet das alles ab, still.
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: cents,
          product_data: {
            name: lang === 'de' ? 'VerseBase unterstuetzen' : 'Support VerseBase',
            description: lang === 'de'
              ? 'Freiwillige Unterstuetzung, ohne Gegenleistung.'
              : 'Voluntary support, nothing in return.',
          },
        },
      }],
      integration_identifier: INTEGRATION_ID,
      success_url: `${base}${path}?danke=1`,
      cancel_url: `${base}${path}`,
      locale: lang === 'de' ? 'de' : 'en',
    });

    if (!session.url) {
      return json({ error: 'no_session_url' }, 502, origin);
    }
    return json({ url: session.url }, 200, origin);
  } catch (err) {
    // Fehlertext NICHT durchreichen: er kann Kontodetails enthalten.
    console.error('checkout session failed:', err instanceof Error ? err.message : err);
    return json({ error: 'stripe_error' }, 502, origin);
  }
});
