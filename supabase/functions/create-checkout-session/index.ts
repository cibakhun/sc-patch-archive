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
          // ACHTUNG: das hier LIEST DER UNTERSTUETZER auf Stripes Bezahlseite.
          // Die Kommentare in dieser Datei sind aus Gewohnheit umlautfrei; diese
          // zwei Zeichenketten duerfen es NICHT sein. Am 03.08.2026 stand hier
          // "VerseBase unterstuetzen" — und genau so stand es dann auch gross
          // ueber dem Betrag auf der Bezahlseite.
          product_data: {
            name: lang === 'de' ? 'VerseBase unterstützen' : 'Support VerseBase',
            description: lang === 'de'
              ? 'Freiwillige Unterstützung, ohne Gegenleistung.'
              : 'Voluntary support, nothing in return.',
          },
        },
      }],
      // MANAGED PAYMENTS AUS. Nicht aus Bequemlichkeit — es ist die inhaltlich
      // richtige Angabe.
      //
      // Stripe schaltet das auf neuen Konten von sich aus EIN. Es ist dafuer
      // gedacht, dass Stripe beim Verkauf DIGITALER PRODUKTE als
      // Vertragspartner auftritt und die Umsatzsteuer einzieht und abfuehrt.
      // Dafuer verlangt es an jedem Posten einen Produkt-Steuercode aus Stripes
      // Warensystematik (Software, Spiele, E-Books, Onlinekurse, Hosting …).
      //
      // Hier wird nichts verkauft: die Seite sagt ausdruecklich "freiwillig,
      // ohne Gegenleistung, keine Rechnung, kein Vertrag, keine Vorteile im
      // Konto". Es gibt kein Produkt, dem ein Steuercode zustuende — irgendeinen
      // zu waehlen, damit der Aufruf durchgeht, wuerde den Vorgang als
      // Produktverkauf ausweisen, der er nicht ist, und Stripe faelschlich zum
      // Vertragspartner einer Lieferung machen, die niemand erbringt.
      //
      // Gefunden am 03.08.2026: OHNE diese Zeile scheitert JEDER Aufruf mit
      // StripeInvalidRequestError "the product tax code is missing". Die Zeile
      // ist also nicht optional, sie ist die Voraussetzung dafuer, dass der
      // Knopf ueberhaupt etwas tut.
      managed_payments: { enabled: false },
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
    // Der Fehler-TEXT bleibt drin: er kann Kontodetails tragen ("your account
    // cannot …", Betraege, Kontonamen). Die KENNUNGEN gehen raus.
    //
    // Warum das kein Leichtsinn, sondern das Ergebnis einer Sackgasse ist:
    // Am 03.08.2026 antwortete diese Function auf jeden Aufruf mit 502, und es
    // gab keinen Weg, herauszufinden warum — `console.error` landet in einem
    // Log, das ueber die API nur mit Verzoegerung von Stunden zu lesen ist, und
    // die Antwort verriet nichts. type/code/param sind generische Stripe-Bezeichner
    // (etwa "StripeAuthenticationError" / "resource_missing" / "line_items"),
    // keine Kontodaten — und sie sind der Unterschied zwischen "kaputt" und
    // "weiss, welcher Parameter".
    const e = err as { type?: string; code?: string; param?: string; message?: string };
    console.error('checkout session failed:', e.message ?? err);
    return json({
      error: 'stripe_error',
      type: e.type ?? null,
      code: e.code ?? null,
      param: e.param ?? null,
    }, 502, origin);
  }
});
