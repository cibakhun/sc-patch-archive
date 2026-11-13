#!/usr/bin/env node
/* ============================================================
   build-hangar-ktx — komprimierte Zwillinge der Hangar-Bilder bauen
   ------------------------------------------------------------
   Schreibt zu jedem Bild, das ein GLB unter public/hangar/ benutzt, die
   Datei public/hangar/ktx/<kennung>.ktx2 (Bauweise und Schlüssel-Wert-Daten:
   scripts/lib/hangar-ktx.mjs). Läuft beliebig oft: gebaut wird nur, was
   fehlt oder nach einem anderen Rezept gebaut ist; Zwillinge ohne Bild
   gehen. Nach jedem Lauf, der Schiffe oder Halle neu baut
   (build-hangar-assets, build-hangar-alle, pool-hangar-textures), gehört
   dieser Lauf dazu, sonst reißt verify:hangar-ktx.

     node scripts/build-hangar-ktx.mjs --basisu <pfad zu basisu> [--zugleich 4] [--nur N]

   Zwei Werkzeuge von außen, beide nicht Teil des Projekts:
   - basisu (Basis Universal, Kodierer). Am 13.11.2026 das npm-Paket
     basisu@1.16.3 in einem Ordner außerhalb des Repos (npm install basisu),
     daraus bin/linux/x64_sse/basisu. Gebaut wird im Cloud-Rechner (Krisz
     13.11.2026: „Im Claude rechner"), nicht auf seinem PC.
   - ein Chrome für das Farbmittel (CHROME_PATH oder einer der üblichen
     Orte, wie check:hangar-shader). Das Mittel maß der Viewer bisher am
     ausgepackten Bild, mit createImageBitmap auf 8 × 8 verkleinert. Der
     Rechenweg des Browsers (Mip-Kette, Alpha über die Zeichenfläche) lässt
     sich mit sharp nicht nachstellen: im Mittel 5 % daneben, bei den
     dunkelsten Karten bis 47 %, und genau die hebt albedoFloor an. Darum
     misst hier derselbe Code im selben Browser.

   Rezept (Fassung D der Probe vom 13.11.2026):
     n  -uastc -uastc_level 2 -linear      (Normal-Karten, mit Zstandard)
     c  -q 128 -mip_srgb                   (Farbe, Leuchten)
     d  -q 128 -linear                     (Metall/Rau, AO, Masken)
   alle mit -ktx2 -mipmap. Die WebP gehen ohne Verlust über PNG hinein.
   ============================================================ */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { BAU, KTX_NAME, KTX_ORDNER, bestand, ktxKopf, ktxMitKv } from './lib/hangar-ktx.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const HANGAR = join(ROOT, 'public', 'hangar'), ZIEL = join(HANGAR, KTX_ORDNER);
const argv = process.argv.slice(2);
const flag = (n, d) => {
  if (!argv.includes(n)) return d;
  const v = argv[argv.indexOf(n) + 1];
  if (v === undefined || v === '' || v.startsWith('--')) { console.error(`\n${n}: der Wert fehlt\n`); process.exit(2); }
  return v;
};
const BASISU = flag('--basisu', process.env.BASISU);
const ZUGLEICH = Number(flag('--zugleich', '4')), NUR = Number(flag('--nur', '0'));
if (!Number.isInteger(ZUGLEICH) || ZUGLEICH < 1 || !Number.isInteger(NUR) || NUR < 0) { console.error('\n--zugleich und --nur erwarten eine ganze Zahl\n'); process.exit(2); }

const REZEPT = {
  n: ['-uastc', '-uastc_level', '2', '-linear'],
  c: ['-q', '128', '-mip_srgb'],
  d: ['-q', '128', '-linear'],
};
const mb = (n) => (n / 1048576).toFixed(1);
const run = (cmd, a) => new Promise((res, rej) => execFile(cmd, a, { maxBuffer: 1 << 24 }, (err, so, se) => (err ? rej(new Error(`${err.message}\n${so}\n${se}`.slice(0, 600))) : res(so))));
const schreib = (file, buf) => { writeFileSync(`${file}.neu`, buf); renameSync(`${file}.neu`, file); };

const t0 = Date.now();
const inv = bestand(HANGAR);
if (inv.fehler.length) { for (const f of inv.fehler.slice(0, 20)) console.error('FEHLER', f); console.error(`\n${inv.fehler.length} Fehler im Bestand, nichts gebaut\n`); process.exit(1); }
console.log(`Bestand: ${inv.glbs} GLB, ${inv.verweise} Verweise auf ${inv.bilder.size} verschiedene Bilder (${mb([...inv.bilder.values()].reduce((s, b) => s + b.webp, 0))} MB WebP)`);
mkdirSync(ZIEL, { recursive: true });

// --- 1. kodieren, was fehlt oder nach altem Rezept gebaut ist ---------------
const kvVon = (id) => { const f = join(ZIEL, `${id}.ktx2`); return existsSync(f) ? ktxKopf(readFileSync(f))?.kv ?? null : null; };
const aktuell = (b, kv) => !!kv && kv.HGbau === BAU && kv.HGart === b.art && Number(kv.HGwebp) === b.webp;
let offen = [...inv.bilder].filter(([id, b]) => !aktuell(b, kvVon(id)));
const schonDa = inv.bilder.size - offen.length;
if (NUR) { const schritt = Math.max(1, Math.floor(offen.length / NUR)); offen = offen.filter((_, i) => i % schritt === 0).slice(0, NUR); }
console.log(`Zwillinge: ${schonDa} stehen, ${offen.length} zu bauen${NUR ? ` (--nur ${NUR})` : ''}`);
let gebaut = 0, fehler = 0;
if (offen.length) {
  if (!BASISU || !existsSync(BASISU)) { console.error(`\nDer Kodierer fehlt: --basisu <pfad> (oder BASISU) muss auf basisu zeigen${BASISU ? `, ${BASISU} gibt es nicht` : ''}.\n`); process.exit(2); }
  const werk = mkdtempSync(join(tmpdir(), 'hangar-ktx-'));
  const reihe = offen.slice(), t1 = Date.now();
  try {
    await Promise.all(Array.from({ length: ZUGLEICH }, async () => {
      for (let e; (e = reihe.shift());) {
        const [id, b] = e, png = join(werk, `${id}.png`), roh = join(werk, `${id}.ktx2`);
        try {
          const webp = b.lies();
          const { width, height } = await sharp(webp).metadata();
          await sharp(webp).png({ compressionLevel: 1 }).toFile(png);
          await run(BASISU, ['-ktx2', '-mipmap', '-no_multithreading', ...REZEPT[b.art], '-output_file', roh, png]);
          const k = ktxKopf(readFileSync(roh));
          if (!k || k.breite !== width || k.hoehe !== height || k.stufen < 1) throw new Error(`Ausgabe passt nicht zum Bild (${width} x ${height}, gelesen ${k ? `${k.breite} x ${k.hoehe}, ${k.stufen} Stufen` : 'nichts'})`);
          schreib(join(ZIEL, `${id}.ktx2`), ktxMitKv(readFileSync(roh), { HGart: b.art, HGbau: BAU, HGwebp: b.webp, HGmittel: null }));
          gebaut++;
        } catch (err) { fehler++; console.error(`FEHLER ${id} (${[...b.in][0]}): ${err.message}`); }
        finally { rmSync(png, { force: true }); rmSync(roh, { force: true }); }
        if ((gebaut + fehler) % 250 === 0) console.log(`  ${gebaut + fehler} von ${offen.length} nach ${((Date.now() - t1) / 60000).toFixed(1)} min`);
      }
    }));
  } finally { rmSync(werk, { recursive: true, force: true }); }
  console.log(`Kodiert: ${gebaut}, Fehler ${fehler}, ${((Date.now() - t1) / 60000).toFixed(1)} min`);
}

// --- 2. Farbmittel der Grundfarben-Karten im Browser messen -----------------
const ohneMittel = [...inv.bilder].filter(([id, b]) => b.grund && (() => { const kv = kvVon(id); return aktuell(b, kv) && !kv.HGmittel; })());
let gemessen = 0;
if (ohneMittel.length) {
  const KANDIDATEN = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/pw-browsers/chromium', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean);
  const BROWSER = KANDIDATEN.find((p) => existsSync(p));
  if (!BROWSER) { console.error(`\n${ohneMittel.length} Grundfarben-Karten ohne Farbmittel, und kein Browser zum Messen gefunden: CHROME_PATH setzen.\n`); process.exit(2); }
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: BROWSER });
  try {
    const page = await browser.newPage();
    const HOST = 'http://hangar-ktx.localhost';
    await page.route(`${HOST}/**`, (route) => {
      const m = /\/b\/([0-9a-f]{16})$/.exec(new URL(route.request().url()).pathname);
      const b = m && inv.bilder.get(m[1]);
      return b ? route.fulfill({ status: 200, contentType: 'image/webp', body: b.lies() }) : route.fulfill({ status: m ? 404 : 200, contentType: 'text/html', body: '<!doctype html><title>Farbmittel</title>' });
    });
    await page.goto(`${HOST}/`);
    // Wie assets/hangar-viewer.js: embeddedImages() packt mit den Optionen des
    // ImageBitmapLoader aus (premultiplyAlpha none) und ohne Farbumrechnung,
    // imageMean() verkleinert auf 8 × 8 und mittelt linear. Wer dort etwas
    // ändert, ändert es hier mit und baut mit neuem Rezept (BAU).
    const messen = (ids) => page.evaluate(async (liste) => {
      const LIN = Array.from({ length: 256 }, (_, i) => { const v = i / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      const ctx = (globalThis.hgCtx ??= new OffscreenCanvas(8, 8).getContext('2d', { willReadFrequently: true }));
      const out = [];
      for (const id of liste) {
        let bitmap = null, small = null;
        try {
          const blob = await (await fetch(`/b/${id}`)).blob();
          bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
          small = await createImageBitmap(bitmap, { resizeWidth: 8, resizeHeight: 8, resizeQuality: 'medium', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
          ctx.clearRect(0, 0, 8, 8);
          ctx.drawImage(small, 0, 0, 8, 8);
          const d = ctx.getImageData(0, 0, 8, 8).data, c = [0, 0, 0];
          for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) c[k] += LIN[d[i + k]];
          out.push(c.map((v) => v / 64));
        } catch (e) { out.push(String(e?.message ?? e)); }
        finally { bitmap?.close(); small?.close(); }
      }
      return out;
    }, ids);
    for (let at = 0; at < ohneMittel.length; at += 200) {
      const teil = ohneMittel.slice(at, at + 200), werte = await messen(teil.map(([id]) => id));
      teil.forEach(([id], i) => {
        const m = werte[i];
        if (!Array.isArray(m) || m.length !== 3 || !m.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) { fehler++; console.error(`FEHLER ${id}: Farbmittel nicht messbar (${String(m).slice(0, 120)})`); return; }
        const f = join(ZIEL, `${id}.ktx2`);
        schreib(f, ktxMitKv(readFileSync(f), { HGmittel: m.join(',') }));
        gemessen++;
      });
    }
  } finally { await browser.close(); }
  console.log(`Farbmittel gemessen: ${gemessen} von ${ohneMittel.length}`);
}

// --- 3. Zwillinge ohne Bild gehen ------------------------------------------
let fort = 0;
if (!NUR) for (const name of readdirSync(ZIEL)) {
  if (name.endsWith('.neu') || (KTX_NAME.test(name) && !inv.bilder.has(name.slice(0, 16)))) { unlinkSync(join(ZIEL, name)); fort++; }
}

// --- Selbstauskunft ---------------------------------------------------------
const stand = { n: [0, 0], c: [0, 0], d: [0, 0] }; let steht = 0, mitMittel = 0;
for (const [id, b] of inv.bilder) {
  const f = join(ZIEL, `${id}.ktx2`);
  if (!existsSync(f)) continue;
  const buf = readFileSync(f), kv = ktxKopf(buf)?.kv;
  if (!aktuell(b, kv)) continue;
  steht++; stand[b.art][0]++; stand[b.art][1] += buf.length;
  if (kv.HGmittel) mitMittel++;
}
const grund = [...inv.bilder.values()].filter((b) => b.grund).length;
console.log(`\nStand: ${steht} von ${inv.bilder.size} Zwillingen (Rezept ${BAU}), ${mb(stand.n[1] + stand.c[1] + stand.d[1])} MB; Normal ${stand.n[0]} (${mb(stand.n[1])} MB), Farbe ${stand.c[0]} (${mb(stand.c[1])} MB), Daten ${stand.d[0]} (${mb(stand.d[1])} MB); Farbmittel ${mitMittel} von ${grund}; ${fort} ohne Bild entfernt; ${((Date.now() - t0) / 60000).toFixed(1)} min`);
if (fehler || (!NUR && (steht !== inv.bilder.size || mitMittel !== grund))) { console.error(`\nNicht vollständig: ${fehler} Fehler, ${inv.bilder.size - steht} Zwillinge fehlen, ${grund - mitMittel} Farbmittel fehlen\n`); process.exit(1); }
