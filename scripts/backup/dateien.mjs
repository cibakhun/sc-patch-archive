#!/usr/bin/env node
/* ============================================================
   dateien.mjs — Supabase-Storage-Dateien sichern und zurueckspielen.
   Teil der Datenbanksicherung (docs/betrieb/datenbank-backup.md).

     node scripts/backup/dateien.mjs holen <ordner> <storage-basis>
       liest <ordner>/storage-liste.json (aus storage.objects, von
       sichern.sh), laedt jede Datei ueber die OEFFENTLICHE Adresse
       <basis>/storage/v1/object/public/<bucket>/<name>, prueft die Groesse
       gegen die Datenbank und schreibt <ordner>/storage/<bucket>/<name>
       und <ordner>/storage.json (mit sha256).
       Braucht keinen Schluessel: beide Buckets (avatars, banners) sind
       oeffentlich lesbar. Ein nicht oeffentlicher Bucket ist ein FEHLER,
       statt still uebersprungen zu werden.

     VB_ZIEL_SCHLUESSEL=<service-key des ZIELS> \
     node scripts/backup/dateien.mjs hochladen <ordner> <storage-basis>
       laedt jede Datei aus storage.json in das Ziel (upsert), holt sie
       zurueck und vergleicht die sha256. Nur gegen ein Ziel, das man
       wiederherstellen WILL (Probe-Stack oder neues Projekt) — der
       Schluessel ist der des Ziels, nie der von Live.

   Netz: fetch() gegen die genannte Storage-Basis, sonst nichts.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, sep } from 'node:path';

const [, , befehl, ordnerArg, basisArg] = process.argv;
if (!['holen', 'hochladen'].includes(befehl) || !ordnerArg || !basisArg) {
  console.error('Aufruf: dateien.mjs holen|hochladen <ordner> <storage-basis>');
  process.exit(2);
}
const ORDNER = resolve(ordnerArg);
const BASIS = basisArg.replace(/\/+$/, '');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const pfad = (name) => name.split('/').map(encodeURIComponent).join('/');

function sichererPfad(bucket, name) {
  const p = resolve(ORDNER, 'storage', bucket, ...name.split('/'));
  if (!p.startsWith(resolve(ORDNER, 'storage') + sep)) throw new Error(`unzulaessiger Dateiname: ${bucket}/${name}`);
  return p;
}

async function mitWiederholung(fn, versuche = 3) {
  let letzter;
  for (let i = 0; i < versuche; i++) {
    try {
      return await fn();
    } catch (e) {
      letzter = e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw letzter;
}

async function holen() {
  const liste = JSON.parse(readFileSync(join(ORDNER, 'storage-liste.json'), 'utf8'));
  const fehler = [];
  const ergebnis = [];
  for (const o of liste) {
    if (!o.public) {
      fehler.push(`${o.bucket}/${o.name}: Bucket nicht oeffentlich — ohne Schluessel nicht lesbar; Bucket in storage-liste/dateien.mjs nachziehen`);
      continue;
    }
    try {
      const buf = await mitWiederholung(async () => {
        const r = await fetch(`${BASIS}/storage/v1/object/public/${encodeURIComponent(o.bucket)}/${pfad(o.name)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
      });
      if (o.size != null && buf.length !== Number(o.size)) {
        fehler.push(`${o.bucket}/${o.name}: ${buf.length} Bytes geladen, Datenbank sagt ${o.size}`);
        continue;
      }
      const ziel = sichererPfad(o.bucket, o.name);
      mkdirSync(dirname(ziel), { recursive: true });
      writeFileSync(ziel, buf);
      ergebnis.push({ bucket: o.bucket, name: o.name, size: buf.length, mime: o.mime ?? null, sha256: sha(buf) });
    } catch (e) {
      fehler.push(`${o.bucket}/${o.name}: ${e.message}`);
    }
  }
  writeFileSync(join(ORDNER, 'storage.json'), JSON.stringify(ergebnis, null, 2) + '\n');
  const bytes = ergebnis.reduce((a, f) => a + f.size, 0);
  console.log(`  ${ergebnis.length} von ${liste.length} Dateien gesichert, ${bytes} Bytes, Groesse je Datei gegen die Datenbank geprueft`);
  for (const f of fehler) console.error(`  FEHLER ${f}`);
  if (fehler.length) process.exit(1);
}

async function hochladen() {
  const schluessel = process.env.VB_ZIEL_SCHLUESSEL;
  if (!schluessel) {
    console.error('VB_ZIEL_SCHLUESSEL fehlt (Service-Schluessel des ZIELS)');
    process.exit(2);
  }
  const auth = { apikey: schluessel, Authorization: `Bearer ${schluessel}` };
  const liste = JSON.parse(readFileSync(join(ORDNER, 'storage.json'), 'utf8'));
  const fehler = [];
  let ok = 0;
  for (const f of liste) {
    const datei = readFileSync(sichererPfad(f.bucket, f.name));
    const adresse = `${BASIS}/storage/v1/object/${encodeURIComponent(f.bucket)}/${pfad(f.name)}`;
    try {
      await mitWiederholung(async () => {
        const r = await fetch(adresse, {
          method: 'POST',
          headers: { ...auth, 'x-upsert': 'true', 'content-type': f.mime || 'application/octet-stream' },
          body: datei,
        });
        if (!r.ok) throw new Error(`Hochladen HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      });
      const zurueck = await mitWiederholung(async () => {
        const r = await fetch(`${BASIS}/storage/v1/object/authenticated/${encodeURIComponent(f.bucket)}/${pfad(f.name)}`, { headers: auth });
        if (!r.ok) throw new Error(`Zurueckholen HTTP ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
      });
      if (sha(zurueck) !== f.sha256) fehler.push(`${f.bucket}/${f.name}: Pruefsumme nach dem Zurueckholen anders`);
      else ok++;
    } catch (e) {
      fehler.push(`${f.bucket}/${f.name}: ${e.message}`);
    }
  }
  console.log(`  ${ok} von ${liste.length} Dateien hochgeladen und mit gleicher sha256 zurueckgeholt`);
  for (const f of fehler) console.error(`  FEHLER ${f}`);
  if (fehler.length || ok !== liste.length) process.exit(1);
}

await (befehl === 'holen' ? holen() : hochladen());
