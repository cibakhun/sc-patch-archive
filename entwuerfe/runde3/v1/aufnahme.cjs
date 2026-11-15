// node entwuerfe/runde3/v1/aufnahme.cjs  (Server muss auf :8501 laufen)
const { chromium } = require('G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/dc-main/node_modules/playwright-core');
const sharp = require('sharp');
const OUT = 'C:/Users/mkris/AppData/Local/Temp/claude/d5ba845f90123901/b445774b-7852-42b1-a806-ba95b3fbeb40/scratchpad/artifact-staging/bilder/runde3-v1-';
const URL = 'http://localhost:8501/entwuerfe/runde3/v1/';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const fehler = [];
  for (const [name, opt] of [
    ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['desktop', { viewport: { width: 1440, height: 900 } }],
  ]) {
    const ctx = await browser.newContext({ ...opt, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('response', (r) => { if (r.status() >= 400) fehler.push(`${r.status()} ${r.url()}`); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await page.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); })));
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight,
      w: document.documentElement.scrollWidth,
      imgs: document.images.length,
      kaputt: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
    }));
    console.log(name, JSON.stringify(info));
    await sharp(await page.screenshot()).jpeg({ quality: 82 }).toFile(OUT + name + '-erster.jpg');
    if (name === 'phone') {
      await page.evaluate(() => window.scrollTo(0, 844));
      await page.waitForTimeout(150);
      await sharp(await page.screenshot()).resize(780).jpeg({ quality: 82 }).toFile(OUT + 'phone-zweiter.jpg');
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    const ganz = await page.screenshot({ fullPage: true });
    await sharp(ganz).resize(opt.viewport.width).jpeg({ quality: 72 }).toFile(OUT + name + '-ganz.jpg');
    await ctx.close();
  }
  console.log('fehlerhafte Antworten:', fehler.length ? fehler : 'keine');
  await browser.close();
})();
