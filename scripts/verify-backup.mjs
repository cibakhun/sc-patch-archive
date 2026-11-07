#!/usr/bin/env node
/* ============================================================
   verify-backup.mjs — prueft eine Datenbanksicherung auf Vollstaendigkeit
   und ihre Wiederherstellung auf Gleichheit mit der Quelle.
   Ablauf: docs/betrieb/datenbank-backup.md

   WARUM ES DEN GIBT: Live lief bis November 2026 auf dem Free-Plan ohne ein
   einziges Backup (Plan "Supabase: Staging und Production trennen",
   04.11.2026). Eine Sicherung, die nie zurueckgespielt wurde, ist
   Dekoration — und ein Dump, der "durchlief", sagt nichts darueber, ob er
   alles enthaelt: der offizielle Schema-Dump der CLI laesst z. B. die
   Trigger auf auth.users und die Storage-Policies aus, und eine
   Wiederherstellung in ein neues Projekt erbt dessen Standardrechte (anon
   und authenticated bekaemen ALL auf jede Tabelle), ohne dass ein Fehler
   erscheint. Beides faellt nur auf, wenn man die wiederhergestellte
   Datenbank Objekt fuer Objekt mit der Quelle vergleicht. Das tut dieses
   Skript.

   ZWEI BEFEHLE:

     node scripts/verify-backup.mjs inhalt <sicherung>
       Liest data.sql/history_data.sql (COPY-Bloecke) und katalog.json der
       Quelle, schreibt manifest.json (Zeilen und Pruefsumme je Tabelle,
       Sequenzstaende, sha256 je Datei).
       FEHLER: eine Tabelle der Quelle fehlt im Dump; eine Tabelle hat in
       der Quelle Zeilen und im Dump keine; eine eigene Tabelle fehlt in
       schema.sql; ein eigener Trigger/eine Policy in auth/storage fehlt in
       zusatz.sql; eine Klinke ist unterschritten.
       WARNUNG: Zeilenzahl zwischen Katalog und Dump verschieden (zwischen
       beiden Lesungen wurde geschrieben — normal fuer Sitzungstabellen).

     node scripts/verify-backup.mjs vergleich <sicherung> <probe>
       <probe> enthaelt katalog.json und data.sql/history_data.sql, gezogen
       aus der WIEDERHERGESTELLTEN Datenbank (wiederherstellen-probe.sh).
       FEHLER: eine Datei der Sicherung hat nicht mehr die sha256 aus dem
       Manifest; ein Objekt, ein Recht oder eine Policy der Quelle fehlt in der
       Probe oder ist anders; die Probe hat ein Recht mehr; eine Tabelle hat
       andere Zeilen (Zahl oder Inhalt, sortiert gehasht); ein Sequenzstand
       weicht ab. Benannte Ausnahmen (AUSNAHMEN) tragen ihren Anlass und
       reissen, wenn der Anlass verschwindet (Zombie-Waechter).

   Ohne Argumente: Exit 2 "nicht geprueft" — nie still gruen.
   Liest nur Dateien. Kein Netz, kein git, kein Kindprozess.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';

const fehler = [];
const warnungen = [];
const md5 = (s) => createHash('md5').update(s).digest('hex');
const sha256Datei = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));

/* ---------- Grenzen ---------- */

// Tabellen, deren Daten der offizielle Dump bewusst auslaesst (Plattform-
// Buchfuehrung, die jedes neue Projekt selbst mitbringt), plus die
// Migrationshistorie, die als eigener Teil (history_data.sql) kommt.
const NICHT_IM_DATENDUMP = new Set([
  'auth.schema_migrations',
  'storage.migrations',
  'storage.buckets_vectors',
  'storage.vector_indexes',
  'supabase_functions.migrations',
]);
// Tabellen, in denen zwischen Katalog und Dump laufend geschrieben wird.
// Eine andere Zahl dort ist nie ein Befund.
const BEWEGLICH = /^auth\.(refresh_tokens|sessions|flow_state|audit_log_entries|one_time_tokens|mfa_challenges|mfa_amr_claims)$/;

// Klinken (Grundsatz 5): Untergrenzen, die ein leerer oder falscher Dump
// reisst. Der Aufrufer setzt sie je Quelle (Live-Lauf hoeher als die Sonde).
// Ein gesetzter, aber unbrauchbarer Wert (leer, 0, "zehn") schaltet die
// Klinke nicht still ab, sondern beendet den Lauf als NICHT GEPRUEFT.
function klinke(name, vorgabe) {
  const roh = process.env[name];
  if (roh === undefined) return vorgabe;
  if (!/^[1-9][0-9]*$/.test(roh.trim())) {
    console.error(`verify-backup: NICHT GEPRUEFT -- ${name}="${roh}" ist keine ganze Zahl ab 1`);
    process.exit(2);
  }
  return Number(roh.trim());
}
const KLINKE_KONTEN = klinke('VB_KLINKE_KONTEN', 1);
const KLINKE_TABELLEN = klinke('VB_KLINKE_TABELLEN', 20);
const KLINKE_OBJEKTE = klinke('VB_KLINKE_OBJEKTE', 200);

// Name so, wie format('%I') ihn in zusatz.sql schreibt: einfache Namen
// ohne, alle anderen mit Anfuehrungszeichen. Als Regex-Baustein.
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sqlName = (n) =>
  /^[a-z_][a-z0-9_$]*$/.test(n) ? `(?:${reEsc(n)}|"${reEsc(n)}")` : `"${reEsc(n.replace(/"/g, '""'))}"`;

/* ---------- COPY-Bloecke lesen ---------- */

const ident = (s) => s.slice(1, -1).replace(/""/g, '"');
function copyBloecke(datei) {
  const tabellen = new Map();
  const sequenzen = new Map();
  if (!existsSync(datei)) return { tabellen, sequenzen, fehlt: true };
  const zeilen = readFileSync(datei, 'utf8').split('\n');
  let aktuell = null;
  for (const z of zeilen) {
    if (aktuell) {
      if (z === '\\.') {
        tabellen.set(aktuell.name, {
          zeilen: aktuell.daten.length,
          md5: md5(aktuell.daten.sort().join('\n')),
          spalten: aktuell.spalten,
        });
        aktuell = null;
      } else aktuell.daten.push(z);
      continue;
    }
    const m = z.match(/^COPY ("(?:[^"]|"")+")\.("(?:[^"]|"")+") \((.*)\) FROM stdin;$/);
    if (m) {
      aktuell = { name: `${ident(m[1])}.${ident(m[2])}`, spalten: m[3], daten: [] };
      continue;
    }
    const s = z.match(/^SELECT pg_catalog\.setval\('(.+)', (\d+), (true|false)\);$/);
    if (s) sequenzen.set(s[1].replace(/""/g, '"'), `${s[2]} ${s[3]}`);
  }
  if (aktuell) fehler.push(`${relative(process.cwd(), datei)}: COPY-Block ${aktuell.name} ohne Ende — Datei abgeschnitten`);
  return { tabellen, sequenzen, fehlt: false };
}

function bloeckeAus(ordner) {
  const a = copyBloecke(join(ordner, 'data.sql'));
  const b = copyBloecke(join(ordner, 'history_data.sql'));
  if (a.fehlt) fehler.push(`${ordner}: data.sql fehlt`);
  if (b.fehlt) fehler.push(`${ordner}: history_data.sql fehlt`);
  return { tabellen: new Map([...a.tabellen, ...b.tabellen]), sequenzen: new Map([...a.sequenzen, ...b.sequenzen]) };
}

/* ---------- inhalt ---------- */

function inhalt(ordner) {
  for (const f of ['roles.sql', 'schema.sql', 'data.sql', 'zusatz.sql', 'history_schema.sql', 'history_data.sql', 'katalog.json', 'storage.json'])
    if (!existsSync(join(ordner, f))) fehler.push(`${f} fehlt in der Sicherung`);
  if (fehler.length) return;

  const katalog = json(join(ordner, 'katalog.json'));
  const { tabellen, sequenzen } = bloeckeAus(ordner);
  const schema = readFileSync(join(ordner, 'schema.sql'), 'utf8');
  const zusatz = readFileSync(join(ordner, 'zusatz.sql'), 'utf8');

  // 1) jede Tabelle der Quelle hat ihren Datenblock
  let geprueft = 0;
  for (const [tab, n] of Object.entries(katalog.zeilen ?? {})) {
    if (NICHT_IM_DATENDUMP.has(tab)) continue;
    geprueft++;
    const t = tabellen.get(tab);
    if (!t) { fehler.push(`${tab}: fehlt im Dump (Quelle: ${n} Zeilen)`); continue; }
    if (n > 0 && t.zeilen === 0) fehler.push(`${tab}: Quelle ${n} Zeilen, Dump 0`);
    else if (n !== t.zeilen && !BEWEGLICH.test(tab))
      warnungen.push(`${tab}: Katalog ${n} Zeilen, Dump ${t.zeilen} (zwischen beiden Lesungen geschrieben?)`);
  }

  // 2) jede eigene Tabelle steht in schema.sql
  const eigene = (katalog.objekte?.relationen ?? [])
    .map((e) => e.match(/^(\S+)\.(\S+) kind=([rp]) /))
    .filter(Boolean);
  for (const [, ns, rel] of eigene)
    if (!schema.includes(`CREATE TABLE IF NOT EXISTS "${ns}"."${rel}"`)) fehler.push(`${ns}.${rel}: fehlt in schema.sql`);

  // 3) eigene Trigger und Policies in auth/storage stehen in zusatz.sql
  let zusaetze = 0;
  for (const e of katalog.objekte?.trigger ?? []) {
    const m = e.match(/^(auth|storage)\.[^.]+\.(\S+) /);
    if (!m) continue;
    zusaetze++;
    if (!zusatz.includes(`CREATE TRIGGER ${m[2]} `)) fehler.push(`Trigger ${e.split(' ')[0]}: fehlt in zusatz.sql`);
  }
  for (const e of katalog.objekte?.policies ?? []) {
    const m = e.match(/^(auth|storage)\.([^.]+)\.(.+?) (PERMISSIVE|RESTRICTIVE) /);
    if (!m) continue;
    zusaetze++;
    // genau diese Policy an genau dieser Tabelle, nicht nur der Name irgendwo
    const satz = new RegExp(`^CREATE POLICY ${sqlName(m[3])} ON ${m[1]}\\.${sqlName(m[2])} AS ${m[4]} `, 'm');
    if (!satz.test(zusatz)) fehler.push(`Policy ${m[1]}.${m[2]}.${m[3]}: fehlt in zusatz.sql`);
  }
  for (const e of katalog.objekte?.publikation ?? []) {
    zusaetze++;
    const [pub, tab] = e.split(' ');
    const [ns, rel] = tab.split('.');
    if (!zusatz.includes(`ALTER PUBLICATION ${pub} ADD TABLE ${ns}.${rel}`)) fehler.push(`Publikation ${e}: fehlt in zusatz.sql`);
  }

  // 4) Klinken
  const konten = tabellen.get('auth.users')?.zeilen ?? 0;
  const objekte = Object.values(katalog.objekte ?? {}).reduce((a, l) => a + l.length, 0);
  if (konten < KLINKE_KONTEN) fehler.push(`auth.users: ${konten} Konten im Dump, Klinke ${KLINKE_KONTEN} — leere oder falsche Datenbank?`);
  if (geprueft < KLINKE_TABELLEN) fehler.push(`nur ${geprueft} Tabellen geprueft, Klinke ${KLINKE_TABELLEN}`);
  if (objekte < KLINKE_OBJEKTE) fehler.push(`nur ${objekte} Katalogobjekte, Klinke ${KLINKE_OBJEKTE}`);

  // 5) Manifest
  const dateien = {};
  const alle = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? alle(join(d, n)) : [join(d, n)]));
  for (const p of alle(ordner).sort()) {
    const r = relative(ordner, p);
    if (r === 'manifest.json') continue;
    dateien[r] = { bytes: statSync(p).size, sha256: sha256Datei(p) };
  }
  const storage = json(join(ordner, 'storage.json'));
  const manifest = {
    format: 1,
    erstellt: new Date().toISOString(),
    quelle: {
      server_version: katalog.server_version,
      auth_stand: katalog.auth_stand,
      storage_stand: katalog.storage_stand,
      migrationen: katalog.migrationen,
      letzte_migration: katalog.letzte_migration,
    },
    tabellen: Object.fromEntries([...tabellen].sort()),
    sequenzen: Object.fromEntries([...sequenzen].sort()),
    storage: { dateien: storage.length, bytes: storage.reduce((a, f) => a + f.size, 0) },
    dateien,
  };
  writeFileSync(join(ordner, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const zeilenSumme = [...tabellen.values()].reduce((a, t) => a + t.zeilen, 0);
  console.log(`  ${geprueft} Tabellen gegen den Katalog geprueft (Klinke ${KLINKE_TABELLEN}), ${tabellen.size} Datenbloecke, ${zeilenSumme} Zeilen, ${sequenzen.size} Sequenzen`);
  console.log(`  ${eigene.length} eigene Tabellen in schema.sql, ${zusaetze} Zusaetze (auth/storage/Realtime) in zusatz.sql`);
  console.log(`  ${konten} Konten (Klinke ${KLINKE_KONTEN}), ${objekte} Katalogobjekte (Klinke ${KLINKE_OBJEKTE}), ${storage.length} Storage-Dateien, ${Object.keys(dateien).length} Dateien im Manifest`);
}

/* ---------- vergleich ---------- */

// Benannte Ausnahmen: was zwischen Quelle und frischem Ziel legitim anders
// sein darf, je mit Anlass. Stand 05.11.2026: keine. Trifft eine Ausnahme bei
// einem Vergleich nichts, ist sie ein Zombie und reisst.
// Form: { kategorie, nurMehr: true, anlass: '...' } — nurMehr: Eintraege, die
// NUR in der Probe stehen, sind dann WARNUNG; was der Probe fehlt, bleibt FEHLER.
const AUSNAHMEN = [];

function vergleich(quelle, probe) {
  for (const [o, f] of [[quelle, 'manifest.json'], [quelle, 'katalog.json'], [probe, 'katalog.json']])
    if (!existsSync(join(o, f))) fehler.push(`${join(o, f)} fehlt`);
  if (fehler.length) return;
  const manifest = json(join(quelle, 'manifest.json'));

  // 0) Unversehrtheit: jede Datei der Sicherung hat noch die sha256 aus dem
  //    Manifest (nach dem Entschluesseln, vor jedem Zurueckspielen)
  let unversehrt = 0;
  for (const [r, d] of Object.entries(manifest.dateien ?? {})) {
    const p = join(quelle, r);
    if (!existsSync(p)) fehler.push(`${r}: fehlt in der Sicherung`);
    else if (sha256Datei(p) !== d.sha256) fehler.push(`${r}: sha256 weicht vom Manifest ab — Datei veraendert oder beschaedigt`);
    else unversehrt++;
  }
  console.log(`  ${unversehrt} von ${Object.keys(manifest.dateien ?? {}).length} Dateien mit der sha256 aus dem Manifest`);

  const kq = json(join(quelle, 'katalog.json'));
  const kz = json(join(probe, 'katalog.json'));
  const genutzt = new Set();

  // 1) Objekte, Rechte, Policies — Eintrag fuer Eintrag
  let objekte = 0;
  const kategorien = new Set([...Object.keys(kq.objekte), ...Object.keys(kz.objekte)]);
  for (const kat of [...kategorien].sort()) {
    const a = new Set(kq.objekte[kat] ?? []);
    const b = new Set(kz.objekte[kat] ?? []);
    objekte += a.size;
    const fehlen = [...a].filter((x) => !b.has(x));
    const mehr = [...b].filter((x) => !a.has(x));
    const ausnahme = AUSNAHMEN.find((x) => x.kategorie === kat);
    if (ausnahme?.nurMehr && mehr.length) {
      genutzt.add(ausnahme);
      for (const x of mehr) warnungen.push(`${kat}: nur in der Probe: ${x.slice(0, 160)} (Ausnahme: ${ausnahme.anlass.split(';')[0]})`);
    } else for (const x of mehr) fehler.push(`${kat}: nur in der Probe: ${x.slice(0, 300)}`);
    for (const x of fehlen) fehler.push(`${kat}: fehlt in der Probe oder ist dort anders: ${x.slice(0, 300)}`);
  }
  for (const a of AUSNAHMEN)
    if (!genutzt.has(a)) fehler.push(`Ausnahme fuer "${a.kategorie}" trifft nichts mehr — Anlass entfallen, Ausnahme entfernen (Zombie-Waechter)`);

  // 2) Zeilenzahl je Tabelle in der Probe == Dump
  let tabellen = 0;
  for (const [tab, t] of Object.entries(manifest.tabellen)) {
    tabellen++;
    const n = kz.zeilen?.[tab];
    if (n === undefined) fehler.push(`${tab}: Tabelle fehlt in der Probe`);
    else if (n !== t.zeilen) fehler.push(`${tab}: Dump ${t.zeilen} Zeilen, Probe ${n}`);
  }

  // 3) Inhalt je Tabelle (Probe erneut gedumpt, Zeilen sortiert gehasht)
  const { tabellen: zt, sequenzen: zs } = bloeckeAus(probe);
  let inhalte = 0;
  for (const [tab, t] of Object.entries(manifest.tabellen)) {
    const z = zt.get(tab);
    if (!z) { fehler.push(`${tab}: kein Datenblock im Dump der Probe`); continue; }
    if (z.spalten !== t.spalten) fehler.push(`${tab}: Spalten im Dump der Probe anders (${z.spalten.slice(0, 120)})`);
    else if (z.md5 !== t.md5 || z.zeilen !== t.zeilen) fehler.push(`${tab}: Inhalt der Probe weicht ab (${z.zeilen} statt ${t.zeilen} Zeilen oder andere Werte)`);
    else inhalte++;
  }
  // 4) Sequenzstaende
  let seq = 0;
  for (const [s, v] of Object.entries(manifest.sequenzen)) {
    seq++;
    if (zs.get(s) !== v) fehler.push(`Sequenz ${s}: Quelle ${v}, Probe ${zs.get(s) ?? 'fehlt'}`);
  }

  console.log(`  ${objekte} Katalogobjekte in ${kategorien.size} Kategorien Eintrag fuer Eintrag verglichen (Klinke ${KLINKE_OBJEKTE})`);
  console.log(`  ${tabellen} Tabellen: Zeilenzahl, ${inhalte} davon mit gleichem Inhalt; ${seq} Sequenzstaende`);
  if (objekte < KLINKE_OBJEKTE) fehler.push(`nur ${objekte} Katalogobjekte verglichen, Klinke ${KLINKE_OBJEKTE}`);
  if (tabellen < KLINKE_TABELLEN) fehler.push(`nur ${tabellen} Tabellen verglichen, Klinke ${KLINKE_TABELLEN}`);
}

/* ---------- Ablauf ---------- */

const [, , befehl, a, b] = process.argv;
if (befehl === 'inhalt' && a) inhalt(resolve(a));
else if (befehl === 'vergleich' && a && b) vergleich(resolve(a), resolve(b));
else {
  console.error('verify-backup: NICHT GEPRUEFT — Aufruf: verify-backup.mjs inhalt <sicherung> | vergleich <sicherung> <probe>');
  console.error('  (laeuft im Backup-Workflow und in probe-backup.yml, nicht im Auslieferungs-Tor; docs/betrieb/datenbank-backup.md)');
  process.exit(2);
}

for (const w of warnungen) console.log(`  WARNUNG ${w}`);
for (const f of fehler) console.error(`  FEHLER ${f}`);
if (fehler.length) {
  console.error(`\nverify-backup ${befehl}: ROT (${fehler.length} FEHLER, ${warnungen.length} WARNUNG)`);
  process.exit(1);
}
console.log(`\nverify-backup ${befehl}: gruen (${warnungen.length} WARNUNG)`);
