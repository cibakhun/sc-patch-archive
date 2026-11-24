#!/usr/bin/env node
/* ============================================================
   plattform.mjs — haelt die Auth- und Storage-Version der Quelle fest und
   bindet den Probe-Stack an genau diese Versionen.
   Ablauf: docs/betrieb/datenbank-backup.md („Plattform-Stand der Quelle")

   WARUM ES DAS GIBT: Supabase hebt Auth und Storage im gehosteten Projekt
   selbst an. Am 17.11.2026 kam so eine neue Spalte in auth.one_time_tokens
   dazu; der lokale Probe-Stack der angehefteten CLI kannte sie nicht, das
   Zurueckspielen brach ab, und acht Tage lang entstand kein Archiv. Ein
   Probe-Stack mit NEUERER Version waere genauso falsch: der Vergleich saehe
   dann Spalten, die die Quelle nicht hat. Die Probe muss auf dem Stand der
   Quelle laufen. `supabase link` macht fuer die lokale Entwicklung dasselbe
   (supabase/.temp/gotrue-version und storage-version); der Backup-Lauf hat
   aber bewusst kein Zugangstoken fuer die Verwaltungs-API, deshalb fragt
   er die beiden oeffentlichen Versions-Endpunkte selbst.

   DREI BEFEHLE:

     node scripts/backup/plattform.mjs quelle <plattform.json> <api-url>
       Fragt <api-url>/auth/v1/health (mit VB_QUELLE_APIKEY, dem
       oeffentlichen Publishable bzw. Anon Key) und <api-url>/storage/v1/version
       und schreibt beide Versionen. Scheitert eine Abfrage: WARNUNG, die
       Probe nimmt dann die Version der CLI. Nie FEHLER — die Sicherung selbst
       haengt nicht davon ab, und ob die Probe passt, entscheidet der Vergleich.

     node scripts/backup/plattform.mjs binden <plattform.json> <stack>/supabase/.temp
       Schreibt gotrue-version und storage-version, die `supabase start`
       statt der Versionen der CLI nimmt. Nur Versionen der Form v1.2.3.

     node scripts/backup/plattform.mjs abgleich <katalog.json der Quelle> <stand.json der Probe>
       Vergleicht die Migrationslisten von auth und storage. Eine Abweichung
       ist WARNUNG mit Namen: reisst das Zurueckspielen gleich danach, steht
       die Ursache schon da (vorher stand nur „column … does not exist").

   Kein git, kein Kindprozess. Netz nur im Befehl quelle.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const DIENSTE = [
  { name: 'auth', datei: 'gotrue-version', titel: 'Auth' },
  { name: 'storage', datei: 'storage-version', titel: 'Storage' },
];
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** "1.98.5" und "v1.98.5" -> "v1.98.5"; alles andere -> null */
export function versionLesen(roh) {
  if (typeof roh !== 'string') return null;
  const v = roh.trim().replace(/^(?=\d)/, 'v');
  return VERSION.test(v) ? v : null;
}

async function holen(url, kopf, art) {
  let letzter = '';
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const r = await fetch(url, { headers: kopf, signal: AbortSignal.timeout(15000) });
      if (!r.ok) { letzter = `HTTP ${r.status}`; if (r.status < 500) break; continue; }
      return art === 'json' ? await r.json() : await r.text();
    } catch (e) {
      letzter = e?.name === 'TimeoutError' ? 'Zeitueberschreitung' : String(e?.cause?.code ?? e?.message ?? e);
    }
  }
  throw new Error(letzter);
}

async function quelle(datei, api) {
  const basis = api.replace(/\/+$/, '');
  const schluessel = process.env.VB_QUELLE_APIKEY?.trim();
  const kopf = schluessel ? { apikey: schluessel } : {};
  const stand = { auth: null, storage: null, abgefragt: new Date().toISOString() };
  const zeilen = [];

  if (!schluessel) zeilen.push('  WARNUNG Auth: nicht abgefragt (VB_QUELLE_APIKEY fehlt) — die Probe nimmt die Version der CLI');
  else {
    try {
      const v = versionLesen((await holen(`${basis}/auth/v1/health`, kopf, 'json'))?.version);
      if (v) stand.auth = v;
      else zeilen.push('  WARNUNG Auth: Antwort ohne lesbare Version — die Probe nimmt die Version der CLI');
    } catch (e) {
      zeilen.push(`  WARNUNG Auth: Version nicht abrufbar (${e.message}) — die Probe nimmt die Version der CLI`);
    }
  }
  try {
    const v = versionLesen(await holen(`${basis}/storage/v1/version`, kopf, 'text'));
    if (v) stand.storage = v;
    else zeilen.push('  WARNUNG Storage: Antwort ohne lesbare Version — die Probe nimmt die Version der CLI');
  } catch (e) {
    zeilen.push(`  WARNUNG Storage: Version nicht abrufbar (${e.message}) — die Probe nimmt die Version der CLI`);
  }

  writeFileSync(datei, JSON.stringify(stand, null, 2) + '\n');
  console.log(`  Auth ${stand.auth ?? 'unbekannt'}, Storage ${stand.storage ?? 'unbekannt'}`);
  for (const z of zeilen) console.log(z);
}

function binden(datei, temp) {
  if (!existsSync(datei)) {
    console.log('  WARNUNG keine plattform.json in der Sicherung (aeltere Sicherung) — die Probe nimmt die Versionen der CLI');
    return;
  }
  const stand = json(datei);
  const gebunden = [];
  mkdirSync(temp, { recursive: true });
  for (const d of DIENSTE) {
    const v = versionLesen(stand[d.name]);
    if (!v) continue;
    writeFileSync(join(temp, d.datei), v);
    gebunden.push(`${d.titel} ${v}`);
  }
  console.log(gebunden.length
    ? `  gebunden an die Quelle: ${gebunden.join(', ')}`
    : '  WARNUNG Quelle ohne bekannte Versionen — die Probe nimmt die Versionen der CLI');
}

function abgleich(katalogDatei, standDatei) {
  const q = json(katalogDatei);
  const p = json(standDatei);
  const listen = [
    ['Auth', q.auth_migrationen, p.auth_migrationen],
    ['Storage', q.storage_migrationen, p.storage_migrationen],
  ];
  for (const [titel, a, b] of listen) {
    if (!Array.isArray(a)) { console.log(`  ${titel}: Quelle ohne Migrationsliste (aeltere Sicherung) — nicht abgeglichen`); continue; }
    if (!Array.isArray(b)) { console.log(`  WARNUNG ${titel}: Migrationsliste der Probe fehlt — nicht abgeglichen`); continue; }
    const pb = new Set(b), qa = new Set(a);
    const fehlen = a.filter((x) => !pb.has(x));
    const mehr = b.filter((x) => !qa.has(x));
    const liste = (l) => l.slice(-5).join(', ') + (l.length > 5 ? ` (und ${l.length - 5} weitere)` : '');
    if (!fehlen.length && !mehr.length) { console.log(`  ${titel}: ${a.length} Migrationen wie die Quelle`); continue; }
    if (fehlen.length)
      console.log(`  WARNUNG ${titel}: die Probe kennt ${fehlen.length} Migration(en) der Quelle nicht: ${liste(fehlen)} — `
        + 'die Probe ist aelter als die Quelle; reisst das Zurueckspielen gleich, ist das die Ursache '
        + '(plattform.json der Sicherung pruefen, sonst SUPABASE_CLI anheben)');
    if (mehr.length)
      console.log(`  WARNUNG ${titel}: die Probe hat ${mehr.length} Migration(en), die die Quelle nicht hat: ${liste(mehr)} — `
        + 'die Probe ist neuer als die Quelle; der Vergleich sieht dann womoeglich Spalten, die die Quelle nicht hat');
  }
}

const [, , befehl, a, b] = process.argv;
if (befehl === 'quelle' && a && b) await quelle(a, b);
else if (befehl === 'binden' && a && b) binden(a, b);
else if (befehl === 'abgleich' && a && b) abgleich(a, b);
else {
  console.error('plattform.mjs: Aufruf: quelle <plattform.json> <api-url> | binden <plattform.json> <.temp-ordner> | abgleich <katalog.json> <stand.json>');
  process.exit(2);
}
