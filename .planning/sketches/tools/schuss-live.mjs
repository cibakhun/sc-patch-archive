/* Aufnahmen von der ECHTEN ausgelieferten Seite, nicht vom eigenen dist/.
   Grundsatz 7 aus CLAUDE.md in seiner letzten Stufe: „die ausgelieferte
   Seite statt des Images".

   MSYS_NO_PATHCONV=1 node …/schuss-live.mjs "https://verse-base.com/x@390x844" … */
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const OUT = join(resolve(process.cwd()), '.planning/sketches/tools/out/live');
const CHROME = join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
for (const arg of process.argv.slice(2)) {
  const [url, vp] = arg.split('@');
  const [w, h] = (vp || '390x844').split('x').map(Number);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, colorScheme: 'dark',
    hasTouch: w <= 932, isMobile: w <= 932, deviceScaleFactor: 1,
    /* Ohne echten Browser-Kennzeichner antwortet Cloudflare mit einer
       Prüfseite statt mit der Website. */
    userAgent: w <= 932
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    const titel = await page.title();
    const stand = await page.evaluate(() => {
      const m = document.querySelector('meta[name="build"], meta[name="vb-build"]');
      return m ? m.content : (window.__VB_BUILD || '—');
    });
    const name = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '_' + w + 'x' + h + '.png';
    await page.screenshot({ path: join(OUT, name) });
    console.log('  ' + name + '   „' + titel.slice(0, 44) + '"   Stand ' + stand);
  } catch (e) {
    console.log('  FEHLER ' + url + '  ' + String(e).slice(0, 90));
  }
  await ctx.close();
}
await browser.close();
