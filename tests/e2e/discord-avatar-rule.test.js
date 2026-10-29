// Ein Discord-Profilbild wird an drei Stellen geprueft: von der Regel
// profiles_avatar_url_source (20261030140000), von handle_new_user beim
// Anlegen eines Kontos (20261030132000) und von dcAvatarOf im Konto
// (src/scripts/account-dashboard.ts). Lassen die beiden Uebernahmen etwas
// durch, das die Regel ablehnt, scheitert das Anlegen des Kontos bzw. der
// gemeinsame Patch mit dem Anzeigenamen (23514). Darum muessen alle drei
// dasselbe Muster tragen.
//
// Die Migrationen werden ueber ihren Inhalt gefunden, nicht ueber den
// Dateinamen: nach dem Einspielen tragen sie die Live-Version im Namen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MIG = path.join(ROOT, 'supabase', 'migrations');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8').replace(/\r\n/g, '\n');

const MIGRATIONS = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();

/** Juengste Migration, deren Text das Muster traegt. */
function latest(re, was) {
  const hits = MIGRATIONS.filter((f) => re.test(read(MIG, f)));
  assert.ok(hits.length > 0, `keine Migration ${was}`);
  return hits.at(-1);
}

const RULE_FILE = latest(/add constraint profiles_avatar_url_source check/, 'legt profiles_avatar_url_source an');
const rule = read(MIG, RULE_FILE);

/** Discord-Muster aus der Regel profiles_avatar_url_source. */
function rulePattern() {
  const m = rule.match(/add constraint profiles_avatar_url_source check \(([\s\S]*?)\),\n/);
  assert.ok(m, 'Regel profiles_avatar_url_source nicht gefunden');
  const dc = m[1].match(/avatar_url ~ '(\^https:\/\/cdn\\\.discordapp[^']*)'/);
  assert.ok(dc, 'Discord-Teil der Regel nicht gefunden');
  return dc[1];
}


const SAMPLES = {
  ok: [
    'https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3d4e5f6.png',
    'https://cdn.discordapp.com/avatars/123456789012345678/a_1b2c3d4e5f6.gif',
    'https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3d4e5f6.webp?size=256',
  ],
  nein: [
    'https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3d4e5f6',
    'https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3d4e5f6.png?size=256&x=<y>',
    'https://cdn.discordapp.com/avatars/abc/a1b2c3d4e5f6.png',
    'https://cdn.discordapp.com/avatars/123456789012345678/../../attachments/x.png',
    'https://cdn.discordapp.com/embed/avatars/1.png',
    'https://cdn.discordapp.com.evil.example/avatars/123456789012345678/a.png',
  ],
};

test('Discord-Muster der Regel: Selbstauskunft und Stichproben', () => {
  const re = new RegExp(rulePattern());
  for (const u of SAMPLES.ok) assert.ok(re.test(u), `Regel muesste annehmen: ${u}`);
  for (const u of SAMPLES.nein) assert.ok(!re.test(u), `Regel muesste ablehnen: ${u}`);
  console.log(`# Regel aus ${RULE_FILE}: ${SAMPLES.ok.length} angenommen, ${SAMPLES.nein.length} abgelehnt`);
});

test('handle_new_user uebernimmt das Discord-Bild nur nach dem Muster der Regel', () => {
  const file = latest(/create or replace function public\.handle_new_user\(\)/, 'legt handle_new_user an');
  const src = read(MIG, file);
  const fn = src.slice(src.indexOf('create or replace function public.handle_new_user()'));
  const body = fn.slice(0, fn.indexOf('$function$;') + 1);
  assert.ok(body.includes(`dc_avatar ~ '${rulePattern()}'`), `${file}: Discord-Bild nicht nach dem Muster der Regel geprueft`);
  assert.ok(!/dc_avatar\s+(i?like|similar)/i.test(body), `${file}: Discord-Bild noch per LIKE geprueft`);
  console.log(`# handle_new_user aus ${file}`);
});

test('die Regel laeuft nur nach der neuen handle_new_user-Fassung', () => {
  const doubled = `dc_avatar ~ ''${rulePattern()}'''`;
  const pre = rule.slice(rule.indexOf('0. Vorbedingung'), rule.indexOf('1. Wertebereiche'));
  assert.ok(pre.includes(doubled), 'Vorbedingung in der Regel-Migration prueft nicht genau das Muster der Regel');
  assert.match(pre, /raise exception/);
});

test('dcAvatarOf im Konto nimmt genau das Muster der Regel', () => {
  const ts = read(ROOT, 'src', 'scripts', 'account-dashboard.ts');
  const m = ts.match(/const DC_AVATAR_RE = \/(.+)\/;\n/);
  assert.ok(m, 'DC_AVATAR_RE nicht gefunden');
  assert.equal(m[1].replace(/\\\//g, '/'), rulePattern(), 'Muster im Konto weicht von der Regel ab');
  assert.match(ts, /const dcAvatarOf = [\s\S]{0,200}DC_AVATAR_RE\.test\(u\) \? u : ''/);
  const re = new RegExp(m[1]);
  for (const u of SAMPLES.ok) assert.ok(re.test(u), u);
  for (const u of SAMPLES.nein) assert.ok(!re.test(u), u);
});
