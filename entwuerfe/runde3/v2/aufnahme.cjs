const { chromium } = require('G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/dc-main/node_modules/playwright-core');
const sharp = require('G:/Projects/games/Star Citizen/sc-patch-archive/.claude/worktrees/dc-main/node_modules/sharp');

const URL = 'http://localhost:8502/entwuerfe/runde3/v2/';
const OUT = 'C:/Users/mkris/AppData/Local/Temp/claude/d5ba845f90123901/b445774b-7852-42b1-a806-ba95b3fbeb40/scratchpad/artifact-staging/bilder/runde3-v2-';

async function laden(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.evaluate(async () => {
    for (const img of document.images) { img.loading = 'eager'; }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
    window.scrollTo(0, 0);
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  });
  await page.waitForTimeout(300);
  return page.evaluate(() => ({
    hoehe: document.documentElement.scrollHeight,
    breite: document.documentElement.scrollWidth,
    kaputt: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
    bilder: new Set([...document.images].map((i) => i.currentSrc.replace(/-\d+\.webp$|\.webp$/, ''))).size,
    verboten: (document.body.innerText.match(/Data\.p4k|DataCore|scmdb|datamined|Spieldaten|Datenquelle/gi) || []),
  }));
}

async function ganz(page, datei, breite) {
  const buf = await page.screenshot({ fullPage: true, type: 'png' });
  await sharp(buf).resize({ width: breite }).jpeg({ quality: 62 }).toFile(datei);
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await phone.newPage();
  console.log('phone', JSON.stringify(await laden(p)));
  await p.screenshot({ path: OUT + 'phone-erster.jpg', type: 'jpeg', quality: 80 });
  for (let i = 1; i < 6; i++) {
    await p.evaluate((y) => window.scrollTo(0, y), 844 * i);
    await p.waitForTimeout(150);
    await p.screenshot({ path: i === 1 ? OUT + 'phone-zweiter.jpg' : `${OUT}phone-screen${i + 1}.jpg`, type: 'jpeg', quality: 70 });
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await ganz(p, OUT + 'phone-ganz.jpg', 390);

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await desk.newPage();
  console.log('desktop', JSON.stringify(await laden(d)));
  await d.screenshot({ path: OUT + 'desktop-erster.jpg', type: 'jpeg', quality: 80 });
  await ganz(d, OUT + 'desktop-ganz.jpg', 1440);

  await p.evaluate(() => { document.querySelector('#salvage details').open = true; document.querySelector('#salvage').scrollIntoView(); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + 'phone-offen.jpg', type: 'jpeg', quality: 70 });
  await browser.close();
})();
