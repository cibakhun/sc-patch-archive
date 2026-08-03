// Supabase Edge Function `stripe-webhook`
//
// Nimmt Stripes Zahlungsbestaetigungen entgegen und traegt sie in die Tabelle
// `donations` ein. Der Trigger auf der Tabelle zaehlt sie von dort auf den
// oeffentlich sichtbaren Stand (support_progress.stripe_cents).
//
// WARUM verify_jwt = false: Stripe kann kein Supabase-Token schicken. Die
// Authentifizierung laeuft ausschliesslich ueber den Stripe-Signature-Kopf,
// geprueft HIER unten. Das ist kein Notbehelf, sondern das von Stripe
// vorgesehene Vertrauensmodell: wer das Signaturgeheimnis nicht hat, kann kein
// gueltiges Ereignis faelschen.
//
// DIE ZWEI STELLEN, AN DENEN SO ETWAS ERFAHRUNGSGEMAESS BRICHT:
//   1. Der ROHTEXT des Aufrufs muss geprueft werden, nicht ein wieder
//      zusammengesetztes JSON. Deshalb `await req.text()` GANZ oben, und
//      danach nie wieder `req.json()`.
//   2. Im Edge-Runtime muss die ASYNCHRONE Pruefung genommen werden
//      (`constructEventAsync`). Die synchrone Variante braucht Node-Krypto,
//      die es hier nicht gibt.
//
// Doppelzustellung ist bei Stripe NORMAL — bleibt eine Antwort aus oder kommt
// zu spaet, liefert Stripe erneut. Abgefangen wird das nicht hier, sondern von
// der Eindeutigkeitsbedingung auf stripe_event_id in der Datenbank. Ein
// zweiter Versuch laeuft dort auf einen Konflikt und wird still uebergangen.
import Stripe from 'npm:stripe@^22';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const API_VERSION = '2026-07-29.dahlia';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !signingSecret) {
    console.error('Geheimnisse fehlen: STRIPE_SECRET_KEY und/oder STRIPE_WEBHOOK_SECRET');
    return new Response('not configured', { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('missing signature', { status: 400 });
  }

  // ROHTEXT zuerst. Ab hier wird der Koerper nicht mehr angefasst.
  const raw = await req.text();

  const stripe = new Stripe(secret, { apiVersion: API_VERSION });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, signingSecret);
  } catch (err) {
    // Ungueltige Signatur ist der Regelfall bei einem Angriffsversuch —
    // knapp antworten, nichts verraten.
    console.error('Signaturpruefung fehlgeschlagen:', err instanceof Error ? err.message : err);
    return new Response('invalid signature', { status: 400 });
  }

  // Nur der eine Ereignistyp. Es gibt bewusst KEINE monatliche Zahlung in
  // dieser Ausbaustufe, deshalb auch kein invoice.paid — und damit auch nicht
  // die Falle, dass die Erstzahlung eines Abos doppelt gezaehlt wird, weil
  // checkout.session.completed UND invoice.paid dafuer feuern.
  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ ignored: event.type }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Unbezahlte Sitzungen zaehlen nicht. `payment_status` ist die verlaessliche
  // Angabe — eine abgeschlossene Sitzung ist nicht zwingend eine bezahlte.
  if (session.payment_status !== 'paid') {
    return new Response(JSON.stringify({ ignored: 'unpaid' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const amount = session.amount_total;
  if (typeof amount !== 'number' || amount <= 0) {
    console.error('Sitzung ohne brauchbaren Betrag:', session.id);
    return new Response('bad amount', { status: 400 });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { error } = await db.from('donations').insert({
    stripe_event_id: event.id,
    stripe_session_id: session.id,
    stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    amount_cents: amount,
    currency: (session.currency ?? 'eur').toLowerCase(),
    livemode: event.livemode,
  });

  if (error) {
    // 23505 = Eindeutigkeitsverletzung: dasselbe Ereignis kam schon an. Das ist
    // KEIN Fehler, sondern der Beweis, dass die Sicherung greift. Mit 200
    // antworten, sonst liefert Stripe endlos weiter.
    if ((error as { code?: string }).code === '23505') {
      return new Response(JSON.stringify({ duplicate: event.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Einfuegen fehlgeschlagen:', error.message);
    // 500 ist hier richtig: Stripe soll es erneut versuchen.
    return new Response('insert failed', { status: 500 });
  }

  return new Response(JSON.stringify({ received: event.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
