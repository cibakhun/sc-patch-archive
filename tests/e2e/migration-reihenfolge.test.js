// Laufen die Migrationen in ihrer Reihenfolge auf einer LEEREN Datenbank?
//
// ANLASS (Gesamtaudit 05.11.2026): 20261030100000_rechte_nur_nach_bedarf.sql
// gibt es in zwei Fassungen. Auf main vergibt sie (seit bc117ceb, 01.11.2026)
// Rechte auf public.profile_badges und public.notification_settings — beide
// legen erst 20261030170000 und 20261030180000 an. Auf der Live-Datenbank
// ging das, weil 170000/180000 dort VOR 100000 eingespielt wurden. Auf jeder
// frischen Datenbank (supabase db reset, das geplante zweite Projekt fuer die
// Vorschau) bricht die Migration mit "relation does not exist" ab. Kein Tor
// hat Migrationen je gegen ihre eigene Reihenfolge gelesen.
//
// Geprueft wird statisch: jede Anweisung, die ein Objekt unter public.
// voraussetzt (grant, revoke, alter table/view, create policy … on,
// create trigger … on, comment on), darf nur auf ein Objekt zeigen, das eine
// Migration mit gleichem oder frueherem Zeitstempel anlegt. Objekte, die keine
// Migration anlegt (Supabase selbst, auth.*, storage.*), bleiben aussen vor.
// Kommentare zaehlen nicht; Funktionsrumpfe ($$ … $$) auch nicht, weil sie erst
// beim Aufruf aufgeloest werden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORDNER = resolve(ROOT, 'supabase/migrations');

/** SQL ohne Kommentare und ohne Dollar-Rumpfe. */
export function ohneRumpf(sql) {
  return sql
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

const NAME = String.raw`(?:"?public"?\.)"?([a-z_][a-z0-9_]*)"?`;
const ANLEGEN = new RegExp(
  String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:unlogged\s+)?(?:materialized\s+)?(?:table|view|function|sequence|type)\s+(?:if\s+not\s+exists\s+)?${NAME}`,
  'gi',
);
const VORAUSSETZEN = [
  new RegExp(String.raw`\b(?:grant|revoke)\b[^;]*?\bon\s+(?:table\s+|function\s+|sequence\s+)?${NAME}`, 'gi'),
  new RegExp(String.raw`\balter\s+(?:table|view|function|sequence)\s+(?:if\s+exists\s+)?(?:only\s+)?${NAME}`, 'gi'),
  new RegExp(String.raw`\bcreate\s+policy\b[^;]*?\bon\s+${NAME}`, 'gi'),
  new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\b[^;]*?\bon\s+${NAME}`, 'gi'),
  new RegExp(String.raw`\bcomment\s+on\s+(?:table|view|function|column)\s+${NAME}`, 'gi'),
  new RegExp(String.raw`\balter\s+policy\b[^;]*?\bon\s+${NAME}`, 'gi'),
  // DROP POLICY/TRIGGER IF EXISTS gibt bei fehlender Tabelle nur einen
  // Hinweis aus (PostgreSQL ab 9.4); ohne IF EXISTS bricht es ab.
  new RegExp(String.raw`\bdrop\s+(?:policy|trigger)\s+(?!if\s+exists\b)[^;]*?\bon\s+${NAME}`, 'gi'),
];

/**
 * dateien: [{ name, sql }] in Laufreihenfolge.
 * Rueckgabe: Befunde "<datei>: <objekt> (angelegt erst in <datei>)". Innerhalb
 * einer Datei zaehlt die Stelle: PostgreSQL fuehrt die Anweisungen der Reihe
 * nach aus.
 */
export function reihenfolgeBefunde(dateien) {
  const angelegt = new Map(); // objekt -> { i: Index der ersten anlegenden Datei, pos: Stelle darin }
  const roh = dateien.map((d) => ({ ...d, sql: ohneRumpf(d.sql) }));
  roh.forEach((d, i) => {
    for (const m of d.sql.matchAll(ANLEGEN)) {
      const o = m[1].toLowerCase();
      if (!angelegt.has(o)) angelegt.set(o, { i, pos: m.index });
    }
  });
  const befunde = [];
  let gelesen = 0;
  roh.forEach((d, i) => {
    for (const re of VORAUSSETZEN) {
      for (const m of d.sql.matchAll(re)) {
        gelesen++;
        const o = m[1].toLowerCase();
        const erst = angelegt.get(o);
        if (!erst) continue;
        if (erst.i > i) befunde.push(`${d.name}: public.${o} (angelegt erst in ${dateien[erst.i].name})`);
        else if (erst.i === i && erst.pos > m.index) befunde.push(`${d.name}: public.${o} (angelegt erst weiter unten in derselben Datei)`);
      }
    }
  });
  return { befunde: [...new Set(befunde)], gelesen, objekte: angelegt.size };
}

test('migrationen: jede setzt nur voraus, was eine fruehere anlegt', () => {
  const dateien = readdirSync(ORDNER)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(ORDNER, name), 'utf8') }));
  const { befunde, gelesen, objekte } = reihenfolgeBefunde(dateien);
  // Klinken (Grundsatz 2/5), gemessen am 05.11.2026: 54 Dateien, 53 angelegte
  // Objekte unter public, 229 voraussetzende Anweisungen (210 vor ALTER/DROP
  // POLICY und DROP TRIGGER).
  assert.ok(dateien.length >= 54, `nur ${dateien.length} Migrationen gelesen`);
  assert.ok(objekte >= 50, `nur ${objekte} angelegte Objekte erkannt — Muster pruefen`);
  assert.ok(gelesen >= 220, `nur ${gelesen} voraussetzende Anweisungen erkannt — Muster pruefen`);
  assert.deepEqual(befunde, [], `Migration setzt ein Objekt voraus, das erst spaeter entsteht:\n  ${befunde.join('\n  ')}`);
});

test('migrationen: das Muster erkennt den Fall vom 05.11.2026', () => {
  const { befunde } = reihenfolgeBefunde([
    { name: '1_rechte.sql', sql: '-- grant select on public.spaeter to anon;\ngrant select on public.profile_badges to anon, authenticated;\ngrant insert (lang) on public.notification_settings to authenticated;' },
    { name: '2_abzeichen.sql', sql: 'create or replace view public.profile_badges with (security_barrier = true) as select 1;' },
    { name: '3_mitteilung.sql', sql: 'create table if not exists public.notification_settings (lang text);\ncreate or replace function public.f() returns void language plpgsql as $$ begin grant select on public.spaeter to anon; end $$;' },
    { name: '4_spaeter.sql', sql: 'create table public.spaeter (x int);' },
  ]);
  assert.deepEqual(befunde, [
    '1_rechte.sql: public.profile_badges (angelegt erst in 2_abzeichen.sql)',
    '1_rechte.sql: public.notification_settings (angelegt erst in 3_mitteilung.sql)',
  ]);
});

test('migrationen: das Muster erkennt die Reihenfolge innerhalb einer Datei und Policy/Trigger-Anweisungen', () => {
  const { befunde } = reihenfolgeBefunde([
    { name: '1_eine.sql', sql: [
      'grant select on public.innen to anon;',
      'create table public.innen (x int);',
      'grant select on public.innen to authenticated;',
    ].join('\n') },
    { name: '2_policy.sql', sql: [
      'alter policy "p" on public.spaet using (true);',
      'drop policy "q" on public.spaet;',
      'drop trigger t on public.spaet;',
      'drop policy if exists "r" on public.spaet;',
      'drop trigger if exists u on public.spaet;',
    ].join('\n') },
    { name: '3_spaet.sql', sql: 'create table public.spaet (x int);' },
  ]);
  assert.deepEqual(befunde, [
    '1_eine.sql: public.innen (angelegt erst weiter unten in derselben Datei)',
    '2_policy.sql: public.spaet (angelegt erst in 3_spaet.sql)',
  ]);
  // Drei der fuenf Anweisungen in 2_policy.sql sind Befunde, IF EXISTS nicht.
  const einzeln = reihenfolgeBefunde([
    { name: 'a.sql', sql: 'drop policy if exists "r" on public.spaet;\ndrop trigger if exists u on public.spaet;' },
    { name: 'b.sql', sql: 'create table public.spaet (x int);' },
  ]);
  assert.deepEqual(einzeln.befunde, []);
});
