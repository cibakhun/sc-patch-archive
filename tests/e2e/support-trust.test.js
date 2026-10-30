// Haelt die Vertrauensgrenze der Spenden-Anbindung fest.
//
// Diese Phase bringt die ERSTE supabase/config.toml des Projekts mit. Sie
// schaltet fuer zwei neue Functions die JWT-Pruefung des Gateways ab, weil ein
// anonymer Besucher und Stripes Server kein Session-Token schicken koennen.
//
// Das Risiko liegt NICHT bei den zwei neuen Functions, sondern bei den drei
// alten: register (Kontoanlage), delete-account (Kontoloeschung) und
// verify-rsi (RSI-Verifizierung) laufen live. delete-account und verify-rsi
// verlangen ein Session-JWT. Steht eine von ihnen versehentlich mit false in
// dieser Datei, waere sie ohne Anmeldung aufrufbar — und nichts im Bau, im
// Verify-Lauf oder im Seiten-Audit wuerde das bemerken. Deshalb dieser Test.
// (delete-account steht seit dem 30.10.2026 ausdruecklich mit true hier,
// verify-rsi weiter gar nicht.)
//
// Er prueft ABSCHNITTSKOEPFE, nicht blosses Vorkommen: die Namen der drei
// bestehenden Functions stehen als Prosa im Kommentarblock der Datei (genau
// dort wird ja erklaert, WARUM sie fehlen). Eine Suche nach dem blossen Wort
// wuerde daran haengenbleiben und immer Alarm schlagen.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const CONFIG = 'supabase/config.toml';
const raw = fs.readFileSync(path.resolve(CONFIG), 'utf8');

/** Alle [functions.<name>]-Abschnittskoepfe, Kommentarzeilen ignoriert. */
function functionSections(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('#'))
    .map((l) => /^\s*\[functions\.([^\]]+)\]\s*$/.exec(l))
    .filter(Boolean)
    .map((m) => m[1]);
}

/** verify_jwt-Wert eines Abschnitts, oder undefined. */
function verifyJwtOf(text, name) {
  const re = new RegExp(
    `\\[functions\\.${name.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}\\]([\\s\\S]*?)(?=\\n\\[|$)`
  );
  const block = re.exec(text);
  if (!block) return undefined;
  const m = /^\s*verify_jwt\s*=\s*(true|false)\s*$/m.exec(block[1]);
  return m ? m[1] : undefined;
}

describe('Vertrauensgrenze: supabase/config.toml', () => {
  const sections = functionSections(raw);

  test('genau die Functions ohne JWT stehen auf false', () => {
    assert.deepStrictEqual(
      sections.filter((fn) => verifyJwtOf(raw, fn) === 'false').sort(),
      ['bot-role-sync', 'create-checkout-session', 'register', 'stripe-webhook'],
      'config.toml muss GENAU die Functions mit false auffuehren, die live OHNE ' +
        'JWT laufen. Eine zu wenig -> der naechste Deploy schaltet sie ab. Eine ' +
        'zu viel -> sie wird ohne Anmeldung erreichbar.'
    );
  });

  test('jeder Abschnitt nennt verify_jwt ausdruecklich', () => {
    for (const fn of sections) {
      assert.ok(
        ['true', 'false'].includes(verifyJwtOf(raw, fn)),
        `[functions.${fn}] ohne verify_jwt: der Deploy nimmt dann den Standard, ` +
          'und niemand sieht beim Lesen, was gilt.'
      );
    }
  });

  // Seit dem 30.10.2026 liegt der Quelltext von delete-account im Repo; die
  // Function steht deshalb AUSDRUECKLICH mit true in der Datei. Ein Eintrag mit
  // false waere genau das Loch, vor dem dieser Test warnt.
  test('delete-account ist aufgefuehrt und steht auf true', () => {
    assert.strictEqual(
      verifyJwtOf(raw, 'delete-account'),
      'true',
      'delete-account laeuft LIVE mit verify_jwt = true. Mit false waere die ' +
        'Kontoloeschung ohne Anmeldung erreichbar.'
    );
  });

  // Am 03.08.2026 gegen die lebende Anlage geprueft: register laeuft seit jeher
  // mit verify_jwt = false (wer sich anmeldet, hat noch keine Sitzung), waehrend
  // INTEGRATIONS.md fuer alle drei ein JWT behauptet. Die Doku lag falsch.
  // Stuende register nicht in der Datei, bekaeme es beim naechsten Deploy den
  // Standard `true` — und die Kontoanmeldung waere still tot.
  test('register ist aufgefuehrt und steht auf false', () => {
    assert.strictEqual(
      verifyJwtOf(raw, 'register'),
      'false',
      'register laeuft live OHNE JWT. Fehlt der Eintrag, setzt der naechste ' +
        'Deploy den Standard true und bricht die Kontoanmeldung.'
    );
  });

  for (const fn of ['verify-rsi']) {
    test(`${fn} bleibt unaufgefuehrt und behaelt damit verify_jwt = true`, () => {
      assert.ok(
        !sections.includes(fn),
        `${fn} steht in config.toml. Diese Function laeuft LIVE und verlangt ` +
          'ein Session-JWT. Ein Eintrag hier wuerde sie ohne Anmeldung ' +
          'erreichbar machen.'
      );
    });
  }

  for (const fn of ['create-checkout-session', 'stripe-webhook', 'bot-role-sync']) {
    test(`${fn} hat verify_jwt = false`, () => {
      assert.strictEqual(
        verifyJwtOf(raw, fn),
        'false',
        `${fn} braucht verify_jwt = false — sonst ist sie fuer anonyme ` +
          'Besucher bzw. fuer Stripe nicht erreichbar'
      );
    });
  }

  // bot-role-sync laeuft ohne Gateway-JWT und muss deshalb SELBST pruefen.
  // Faellt die eigene Pruefung weg, waere die Function fuer jeden offen, der
  // die URL kennt — und sie schreibt mit service_role.
  test('bot-role-sync prueft sein Geheimnis selbst und faellt geschlossen aus', () => {
    const src = fs.readFileSync('supabase/functions/bot-role-sync/index.ts', 'utf8');
    assert.match(src, /Deno\.env\.get\('BOT_ROLE_SYNC_SECRET'\)/, 'liest BOT_ROLE_SYNC_SECRET nicht');
    assert.match(src, /reply\(401,/, 'kein 401 bei falschem Geheimnis');
    assert.match(src, /reply\(503, \{ error: 'not_configured' \}\)/, 'kein geschlossener Ausfall ohne Geheimnis');
    assert.doesNotMatch(src, /\.(insert|upsert|delete)\(/, 'schreibt mehr als UPDATE');
    // Benannte Ausnahme (Raffinerie-DMs, 20261030180000): zwei Funktionen, die
    // nur lesen bzw. nur discord_notified_at setzen. Jede andere rpc reisst,
    // ebenso ein berechneter Name; eine Ausnahme ohne Aufruf auch.
    const RPC_OK = ['refinery_discord_due', 'refinery_discord_sent'];
    assert.doesNotMatch(src, /\.rpc\((?!\s*')/, 'rpc mit berechnetem Namen');
    const rpcs = [...src.matchAll(/\.rpc\(\s*'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(rpcs.filter((n) => !RPC_OK.includes(n)), [], 'ruft eine Funktion ausserhalb der Ausnahme');
    for (const n of RPC_OK) assert.ok(rpcs.includes(n), `Ausnahme ${n} ohne Aufruf: aus RPC_OK streichen`);
    const sql = fs.readFileSync('supabase/migrations/20261030180000_refinery_benachrichtigung.sql', 'utf8');
    const sent = sql.match(/create or replace function public\.refinery_discord_sent[\s\S]*?\$\$([\s\S]*?)\$\$/);
    assert.ok(sent, 'refinery_discord_sent nicht gefunden');
    assert.doesNotMatch(sent[1], /\b(insert|delete)\b/i, 'refinery_discord_sent schreibt mehr als UPDATE');
    assert.match(sent[1], /update public\.refinery_jobs\s+set discord_notified_at = now\(\)\s+where/, 'refinery_discord_sent setzt mehr als discord_notified_at');
    const due = sql.match(/create or replace function public\.refinery_discord_due[\s\S]*?\$\$([\s\S]*?)\$\$/);
    assert.ok(due && /^\s*select\b/i.test(due[1]) && !/\b(insert|update|delete)\b/i.test(due[1]), 'refinery_discord_due liest nicht nur');
  });

  test('project_id ist gesetzt', () => {
    assert.match(
      raw,
      /^\s*project_id\s*=\s*"[^"]+"\s*$/m,
      'project_id fehlt — der Deploy kann daran scheitern (Recherche: LOW ' +
        'confidence, Kosten des Mitfuehrens sind null)'
    );
  });
});

describe('Vertrauensgrenze: keine Geheimnisse im Repo', () => {
  // Praefixe bewusst zerlegt, damit dieser Test nicht sich selbst findet.
  const NEEDLES = [
    ['sk_' + 'test_', 'Stripe Secret Key (Test)'],
    ['sk_' + 'live_', 'Stripe Secret Key (Live)'],
    ['rk_' + 'test_', 'Stripe Restricted Key (Test)'],
    ['rk_' + 'live_', 'Stripe Restricted Key (Live)'],
    ['whsec_', 'Stripe Webhook-Signaturgeheimnis'],
  ];
  const DIRS = ['src', 'assets', 'supabase'];

  function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else out.push(p);
    }
    return out;
  }

  const files = DIRS.flatMap((d) => walk(path.resolve(d)));

  for (const [needle, label] of NEEDLES) {
    test(`${label} steht nirgends im Quellbaum`, () => {
      const hits = files.filter((f) => {
        let text;
        try {
          text = fs.readFileSync(f, 'utf8');
        } catch {
          return false; // Binaerdatei
        }
        return text.includes(needle);
      });
      assert.deepStrictEqual(
        hits.map((f) => path.relative(process.cwd(), f)),
        [],
        `${label} gehoert ausschliesslich in die Supabase-Function-Secrets, ` +
          'niemals in eine Datei unter Versionskontrolle'
      );
    });
  }
});
