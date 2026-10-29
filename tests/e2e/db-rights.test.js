// Haelt das Urteil von verify:db-rights fest, ohne Datenbank.
//
// verify:db-rights laeuft auf Schiene B (braucht ein Zugriffstoken und Netz)
// und damit nie im Auslieferungs-Tor. Was hier im Tor laeuft, ist der Kern
// des Vergleichs (pruefe) und das Soll selbst: Ist supabase/rights.expected.json
// in sich stimmig, und reisst der Vergleich genau dort, wo er soll?
//
// Die Momentaufnahmen in diesem Test sind SYNTHETISCH: sie entstehen aus dem
// Soll selbst und werden je Fall gezielt verfaelscht. Kein Live-Stand, keine
// Kundendaten.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  pruefe, fingerabdruck, ladeAbfrage, leseMomentaufnahme, KLINKE_OBJEKTE, ROLLEN, SOLL_DATEI,
} from '../../scripts/verify-db-rights.mjs';

const soll = JSON.parse(fs.readFileSync(path.resolve(SOLL_DATEI), 'utf8'));

/** Eine Momentaufnahme, die genau dem Soll entspricht (wie live, PG 17). */
function ausSoll(server = '170006') {
  const rows = [{ kind: 'server', obj: server, anon: '', authenticated: '', public: '' }];
  for (const [key, e] of Object.entries(soll.objekte)) {
    const i = key.indexOf(' ');
    const r = { kind: key.slice(0, i), obj: key.slice(i + 1) };
    for (const g of ROLLEN) {
      let p = [...(e[g] ?? [])];
      if (Number(server) < 170000) p = p.filter((x) => x !== 'MAINTAIN');
      r[g] = p.sort().join(',');
    }
    rows.push(r);
  }
  return rows;
}
const zeile = (rows, key) => rows.find((r) => `${r.kind} ${r.obj}` === key);

describe('verify:db-rights — das Soll', () => {
  test('mindestens so viele Eintraege wie die Klinke, jeder mit Rechten begruendet', () => {
    const n = Object.keys(soll.objekte).length;
    assert.ok(n >= KLINKE_OBJEKTE, `nur ${n} Soll-Eintraege, Klinke ${KLINKE_OBJEKTE}`);
    const erg = pruefe(ausSoll(), soll);
    assert.deepStrictEqual(erg.fehler, []);
    assert.deepStrictEqual(erg.warnungen, []);
    assert.strictEqual(erg.zahlen.objekte, n);
  });

  test('anon schreibt nirgends, und kein TRUNCATE/REFERENCES/TRIGGER fuer anon oder authenticated', () => {
    for (const [key, e] of Object.entries(soll.objekte)) {
      if (e.ausnahme !== undefined || !/^(table|view|column|sequence) /.test(key)) continue;
      for (const p of e.anon ?? []) assert.strictEqual(p, 'SELECT', `${key}: anon ${p}`);
      for (const g of ['anon', 'authenticated']) {
        for (const p of e[g] ?? []) {
          assert.ok(!['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'].includes(p), `${key}: ${g} ${p}`);
        }
      }
    }
  });

  test('Standardrechte von postgres geben anon/authenticated/PUBLIC nichts', () => {
    for (const art of ['tables', 'sequences', 'functions']) {
      const e = soll.objekte[`default public ${art} von postgres`];
      assert.ok(e, `Soll-Eintrag default public ${art} von postgres fehlt`);
      for (const g of ROLLEN) assert.deepStrictEqual(e[g] ?? [], [], `${art}: ${g}`);
    }
  });

  test('die Abfrage liefert genau die Spalten, die der Vergleich liest', () => {
    const sql = ladeAbfrage();
    for (const s of ['as anon', 'as authenticated', 'as public', 'order by kind collate "C", obj collate "C"', "'server' as kind"]) {
      assert.ok(sql.includes(s), `supabase/rights.snapshot.sql: "${s}" fehlt`);
    }
    assert.ok(!/;\s*$/.test(sql), 'Abfrage endet mit Semikolon');
  });
});

describe('verify:db-rights — der Vergleich reisst, wo er soll', () => {
  test('ein Recht ueber dem Soll ist FEHLER', () => {
    const rows = ausSoll();
    zeile(rows, 'table public.profiles').anon = 'UPDATE';
    const erg = pruefe(rows, soll);
    assert.strictEqual(erg.fehler.length, 1);
    assert.match(erg.fehler[0], /table public\.profiles: anon hat UPDATE ueber dem Soll/);
  });

  test('PUBLIC zaehlt wie eine eigene Rolle', () => {
    const rows = ausSoll();
    zeile(rows, 'function public.guard_is_tester()').public = 'EXECUTE';
    assert.match(pruefe(rows, soll).fehler.join('\n'), /guard_is_tester\(\): public hat EXECUTE/);
  });

  test('ein fehlendes Soll-Recht ist nur WARNUNG', () => {
    const rows = ausSoll();
    zeile(rows, 'view public.public_profiles').anon = '';
    const erg = pruefe(rows, soll);
    assert.deepStrictEqual(erg.fehler, []);
    assert.match(erg.warnungen.join('\n'), /public_profiles: anon fehlt SELECT/);
  });

  test('neues Objekt mit Rechten ohne Soll-Eintrag ist FEHLER, ohne Rechte WARNUNG', () => {
    const rows = ausSoll();
    rows.push({ kind: 'table', obj: 'public.neu', anon: 'DELETE,SELECT', authenticated: '', public: '' });
    rows.push({ kind: 'function', obj: 'public.neu_fn()', anon: '', authenticated: '', public: '' });
    const erg = pruefe(rows, soll);
    assert.strictEqual(erg.fehler.length, 1);
    assert.match(erg.fehler[0], /table public\.neu: kein Soll-Eintrag, aber anon: DELETE,SELECT/);
    assert.match(erg.warnungen.join('\n'), /function public\.neu_fn\(\): kein Soll-Eintrag \(ohne Rechte/);
  });

  test('eine Ausnahme ohne Anlass reisst (Zombie-Waechter)', () => {
    const rows = ausSoll();
    zeile(rows, 'default public sequences von supabase_admin').anon = '';
    assert.match(pruefe(rows, soll).fehler.join('\n'), /sequences von supabase_admin: Ausnahme ohne Anlass/);
  });

  test('Standardrechte fuer neue Objekte werden geprueft', () => {
    const rows = ausSoll();
    zeile(rows, 'default public tables von postgres').authenticated = 'DELETE,INSERT,SELECT,UPDATE';
    assert.match(pruefe(rows, soll).fehler.join('\n'), /default public tables von postgres: authenticated hat/);
  });

  test('eine Rolle mit Attribut oder Mitgliedschaft reisst', () => {
    const rows = ausSoll();
    zeile(rows, 'role anon').anon = 'MEMBER:service_role';
    assert.match(pruefe(rows, soll).fehler.join('\n'), /role anon: anon hat MEMBER:service_role/);
  });

  test('unter der Klinke ist FEHLER, nicht Stille', () => {
    const erg = pruefe([], soll);
    assert.strictEqual(erg.fehler.length, 1);
    assert.match(erg.fehler[0], /nur 0 Objekte/);
    assert.deepStrictEqual(erg.warnungen, []);
  });

  test('PG 16 (lokale Replik) kennt kein MAINTAIN und ist trotzdem gruen', () => {
    const erg = pruefe(ausSoll('160015'), soll);
    assert.deepStrictEqual(erg.fehler, []);
    assert.deepStrictEqual(erg.warnungen, []);
  });

  test('Tippfehler und fehlende Begruendung im Soll sind FEHLER', () => {
    const kaputt = structuredClone(soll);
    kaputt.objekte['table public.favorites'].authenticated = ['SELCT'];
    delete kaputt.objekte['table public.refinery_jobs'].warum;
    const fehler = pruefe(ausSoll(), kaputt).fehler.join('\n');
    assert.match(fehler, /favorites": authenticated nennt unbekanntes Recht "SELCT"/);
    assert.match(fehler, /refinery_jobs": Rechte ohne Begruendung/);
  });

  test('Momentaufnahme: Array oder {rows}, Fingerabdruck unabhaengig von der Reihenfolge', () => {
    const rows = ausSoll();
    assert.strictEqual(leseMomentaufnahme(JSON.stringify(rows)).length, rows.length);
    assert.strictEqual(leseMomentaufnahme(JSON.stringify({ rows })).length, rows.length);
    assert.throws(() => leseMomentaufnahme('{"x":1}'));
    assert.strictEqual(fingerabdruck(rows), fingerabdruck([...rows].reverse()));
  });
});
