// Items in 3D: lädt die gebackenen Dateien (m/, t/) in den R2-Speicher.
//
//   node scripts/item3d/upload.mjs <out> --env <r2.env> [--bucket versebase-items] [--parallel 12] [--dry] [--ziel-bestaetigen]
//
// r2.env (bleibt auf dem PC, nie ins Repo): R2_KEY_ID=…, R2_SECRET=…, R2_ENDPOINT=https://<konto>.r2.cloudflarestorage.com
// Alle Dateinamen enthalten ihren Inhalt als Kennung, darum dürfen Browser sie
// für immer zwischenspeichern. Schon hochgeladene stehen in <out>/hochgeladen.txt;
// zu welchem Ziel (Bucket und Endpunkt, dieser nur als Kennung) die Liste
// gehört, steht in <out>/hochgeladen.ziel. Ein anderes Ziel wird abgelehnt,
// statt fremde Nachweise zu übernehmen; manifest.mjs prüft Bucket und
// Endpunkt. Eine alte hochgeladen.txt ohne Zielvermerk wird nur mit
// --ziel-bestaetigen dem aktuellen Ziel zugeordnet.
import { readFileSync, existsSync, appendFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, createHmac } from 'node:crypto';

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const schalter = (k) => { const i = argv.indexOf(k); if (i < 0) return false; argv.splice(i, 1); return true; };
const DRY = schalter('--dry'), BESTAETIGT = schalter('--ziel-bestaetigen');
const ENV = flag('--env', null), BUCKET = flag('--bucket', 'versebase-items'), PAR = Number(flag('--parallel', 12));
const [OUT] = argv;
if (!OUT || !ENV) { console.error('Aufruf: node scripts/item3d/upload.mjs <out> --env <r2.env>'); process.exit(2); }
const env = Object.fromEntries(readFileSync(ENV, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
for (const k of ['R2_KEY_ID', 'R2_SECRET', 'R2_ENDPOINT']) if (!env[k]) { console.error(`${k} fehlt in ${ENV}`); process.exit(2); }
const endpoint = new URL(env.R2_ENDPOINT);
if (endpoint.protocol !== 'https:') { console.error(`R2_ENDPOINT muss https sein (ist ${endpoint.protocol})`); process.exit(2); }

const hex = (b) => createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => createHmac('sha256', k).update(s).digest();
async function put(key, body, type) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const path = `/${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const payload = hex(body);
  const headers = {
    'cache-control': 'public, max-age=31536000, immutable',
    'content-type': type,
    host: endpoint.host,
    'x-amz-content-sha256': payload,
    'x-amz-date': amzDate,
  };
  const names = Object.keys(headers).sort();
  const canon = ['PUT', path, '', ...names.map((n) => `${n}:${headers[n]}`), '', names.join(';'), payload].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, hex(canon)].join('\n');
  const kSign = hmac(hmac(hmac(hmac(`AWS4${env.R2_SECRET}`, day), 'auto'), 's3'), 'aws4_request');
  const sig = createHmac('sha256', kSign).update(toSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${env.R2_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}`;
  // Weiterleitungen nicht folgen: der signierte Inhalt geht nur an den Endpunkt
  const res = await fetch(`${endpoint.origin}${path}`, { method: 'PUT', headers: { ...headers, authorization: auth }, body, redirect: 'error' });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

const doneFile = join(OUT, 'hochgeladen.txt');
const zielFile = join(OUT, 'hochgeladen.ziel');
const ZIEL = { bucket: BUCKET, endpunkt: hex(endpoint.host).slice(0, 12) };
const zielPruefen = () => {
  const alt = JSON.parse(readFileSync(zielFile, 'utf8'));
  if (alt.bucket !== ZIEL.bucket || alt.endpunkt !== ZIEL.endpunkt) {
    console.error(`hochgeladen.txt in ${OUT} gehört zu einem anderen Ziel (Bucket ${alt.bucket}, Endpunkt ${alt.endpunkt}; jetzt ${ZIEL.bucket}, ${ZIEL.endpunkt}). Für ein neues Ziel einen eigenen Ausgabeordner nehmen.`);
    process.exit(2);
  }
};
if (existsSync(zielFile)) zielPruefen();
else if (!DRY) {
  // Eine Liste ohne Zielvermerk (aus der Zeit vor dem Vermerk) gilt nur nach
  // ausdrücklicher Bestätigung als Nachweis für dieses Ziel.
  if (existsSync(doneFile) && !BESTAETIGT) {
    console.error(`hochgeladen.txt ohne Zielvermerk: gehört sie zu ${ZIEL.bucket} (${ZIEL.endpunkt}), mit --ziel-bestaetigen übernehmen; sonst die Datei beiseitelegen und neu hochladen.`);
    process.exit(2);
  }
  if (existsSync(doneFile)) console.log(`hochgeladen.txt ohne Zielvermerk: wird ${ZIEL.bucket} (${ZIEL.endpunkt}) zugeordnet (bestätigt)`);
  // anlegen nur, wenn noch keiner da ist: ein gleichzeitiger Lauf mit anderem
  // Ziel kann den Vermerk nicht überschreiben
  try { writeFileSync(zielFile, `${JSON.stringify(ZIEL)}\n`, { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; zielPruefen(); }
}
const done = new Set(existsSync(doneFile) ? readFileSync(doneFile, 'utf8').split(/\r?\n/).filter(Boolean) : []);
const type = (f) => (f.endsWith('.glb') ? 'model/gltf-binary' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream');
// Nur was die jüngste Zeile je Item in manifest.jsonl nennt: ein neu gebackenes
// Teil lässt seine alte Datei liegen, die braucht niemand mehr. Texturen zuerst,
// damit ein Modell nie vor seinen Bildern oben steht.
const letzte = new Map();
for (const l of readFileSync(join(OUT, 'manifest.jsonl'), 'utf8').split(/\r?\n/)) if (l.trim()) { const z = JSON.parse(l); letzte.set(z.id, z); }
const tex = new Set(), mod = new Set();
for (const z of letzte.values()) { mod.add(z.file); for (const h of z.tex) tex.add(`t/${h}.webp`); }
const files = [...tex, ...mod].filter((f) => !done.has(f));
for (const f of files) if (!existsSync(join(OUT, f))) { console.error(`fehlt: ${f}`); process.exit(2); }
console.log(`${letzte.size} Items, ${files.length} Dateien hochzuladen (${done.size} schon oben, ${(files.reduce((s, f) => s + statSync(join(OUT, f)).size, 0) / 1048576).toFixed(0)} MB)${DRY ? ' — Probe, nichts wird gesendet' : ''}`);
if (DRY) process.exit(0);
let n = 0, bytes = 0, bad = 0;
const t0 = Date.now();
async function run() {
  for (;;) {
    const f = files.shift();
    if (!f) return;
    const body = readFileSync(join(OUT, f));
    let ok = false;
    for (let a = 1; a <= 4 && !ok; a++) {
      try { await put(f, body, type(f)); ok = true; } catch (e) { if (a === 4) { console.log(`! ${f}: ${e.message}`); bad++; } else await new Promise((r) => setTimeout(r, 1000 * a * a)); }
    }
    if (!ok) continue;
    appendFileSync(doneFile, `${f}\n`);
    n++; bytes += body.length;
    if (n % 200 === 0) console.log(`${n} Dateien, ${(bytes / 1048576).toFixed(0)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
await Promise.all(Array.from({ length: PAR }, run));
console.log(`fertig: ${n} hochgeladen (${(bytes / 1048576).toFixed(0)} MB), ${bad} fehlgeschlagen`);
process.exit(bad ? 1 : 0);
