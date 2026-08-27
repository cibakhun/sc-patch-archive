// Sichtprobe: schiesst eine Patch-Seite in voller Hoehe und in Abschnitten,
// damit man sie ANSEHEN kann statt ihr Markup zu lesen.
//
//   node scripts/probes/patchseite-schuss.mjs <url> <ziel-praefix> [breite]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const url = process.argv[2];
const ziel = process.argv[3] ?? 'schuss';
const breite = Number(process.argv[4] ?? 1280);
if (!url) { console.error('URL fehlt'); process.exit(1); }

mkdirSync(dirname(ziel), { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: breite, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
// Reveal-Animationen ausloesen: einmal durchscrollen, dann zurueck
await page.evaluate(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(600);

const hoehe = await page.evaluate(() => document.documentElement.scrollHeight);
console.log(`Seitenhoehe: ${hoehe} px bei ${breite} px Breite (${(hoehe / 900).toFixed(1)} Bildschirme)`);

// Abschnittsweise, damit die Bilder lesbar bleiben
const schritt = 1800;
let n = 0;
for (let y = 0; y < hoehe; y += schritt) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(250);
  n++;
  await page.screenshot({ path: `${ziel}-${String(n).padStart(2, '0')}.png` });
}
console.log(`${n} Abschnitte geschrieben: ${ziel}-01.png …`);
await browser.close();
