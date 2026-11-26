// Sonde: Liegt eine klebende Leiste unter einer anderen?
//
// Anlass (24.11.2026): Auf /de/armor-sets.html klebte die Hersteller-
// Sprungleiste (.as-jump) mit top:0 unter der ebenfalls bei top:0 klebenden
// Kopfleiste (.dp-bar, z-index 20). Ihre erste Knopfreihe lag beim Scrollen
// hinter der Kopfleiste und war nicht anklickbar. Diese Sonde sucht dasselbe
// Muster auf allen Seitenarten statt nur auf der einen, an der es auffiel.
//
// Je Seite und Fenstergroesse:
//   1. Alle sichtbaren Elemente mit position:sticky/fixed. Klebt eines in
//      einem eigenen Rollbereich (Tabellenkopf in einer Scrollbox), zaehlt es
//      nur mit: es kann die Kopfleiste der Seite nicht treffen.
//   2. Jede am Fenster klebende Leiste (auch Filterspalte) mit festem `top` wird so weit
//      gescrollt, dass sie klebt, und dann gefragt: liegt an der Mitte eines
//      ihrer sichtbaren Bedienelemente (Link, Knopf, Feld) etwas anderes
//      obenauf (elementFromPoint)? Dann ist es nicht anklickbar: `verdeckt`.
//      Umgekehrt `deckt`: die Leiste liegt auf Bedienelementen einer anderen.
//      Wie weit sich nur die Kaesten ueberlappen (Innenabstand), steht als
//      Auskunft daneben und ist kein Befund.
//   3. Traegt die Leiste Sprunglinks (#…), wird jeder dritte angesprungen
//      und gemessen, ob das Ziel unter den klebenden Leisten verschwindet.
//   Jede Seite mit versteckter Zurueck-Marke laeuft ein zweites Mal mit
//   sichtbarer Marke (+Marke): so sieht sie aus, wer von der Elternseite
//   kommt, und der Freiraum unter der Navigation waechst (--nav-h 104/116).
//
//   node scripts/probes/klebeleisten-messung.mjs --base http://localhost:4400
//        [--dist dist] [--seiten /de/armor-sets.html,/missions.html]
//        [--fenster 1280x900,390x844] [--bilder <ordner>] [--json <datei>]
//
// Ohne --seiten nimmt sie aus dist/ jede Seite der obersten Ebene (EN und
// DE) und je Unterordner die ersten zwei: dieselben Vorlagen rendern dort
// tausendfach. Browser: CHROME_PATH oder ein installierter Chrome/Chromium.
// Schreibt nichts in den Arbeitsbaum ausser --bilder/--json.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const BASE = (arg('base') || '').replace(/\/$/, '');
if (!BASE) { console.error('--base fehlt (laufende Vorschau, z. B. http://localhost:4400)'); process.exit(2); }
const DIST = arg('dist', 'dist');
const BILDER = arg('bilder');
const JSON_AUS = arg('json');
const FENSTER = arg('fenster', '1920x1080,1280x900,1024x768,390x844')
  .split(',').map((s) => s.trim().split('x').map(Number)).map(([width, height]) => ({ width, height }));
const PARALLEL = Number(arg('parallel', '3'));

const KANDIDATEN = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);
const BROWSER = KANDIDATEN.find((p) => existsSync(p));
if (!BROWSER) { console.error('Kein Browser gefunden (CHROME_PATH setzen)'); process.exit(2); }

/* ---------- Seitenauswahl ---------- */
function htmlIn(dir) {
  try { return readdirSync(dir).filter((f) => f.endsWith('.html')).sort(); } catch { return []; }
}
function istUmleitung(datei) {
  const kopf = readFileSync(datei, 'utf8').slice(0, 2000);
  return /http-equiv=["']?refresh/i.test(kopf);
}
function seitenAusDist() {
  const out = [];
  for (const sprache of ['', 'de']) {
    const wurzel = join(DIST, sprache);
    for (const f of htmlIn(wurzel)) {
      if (/^(404|500)\.html$/.test(f)) continue;
      const datei = join(wurzel, f);
      if (!istUmleitung(datei)) out.push(`${sprache ? `/${sprache}` : ''}/${f}`);
    }
    for (const d of readdirSync(wurzel).sort()) {
      const pfad = join(wurzel, d);
      if (d === 'de' || d === 'assets' || !statSync(pfad).isDirectory()) continue;
      for (const f of htmlIn(pfad).filter((f) => !istUmleitung(join(pfad, f))).slice(0, 2)) {
        out.push(`${sprache ? `/${sprache}` : ''}/${d}/${f}`);
      }
    }
  }
  return out;
}
const SEITEN = arg('seiten') ? arg('seiten').split(',').map((s) => s.trim()) : seitenAusDist();

/* ---------- Messung im Browser ---------- */
async function messen(page, marke) {
  return page.evaluate(async (marke) => {
    // Zurueck-Marke erzwingen (wie nach einem Klick von der Elternseite):
    // sie haengt unter der Navigation und vergroessert den Freiraum oben.
    if (marke) {
      const back = document.querySelector('.snav__back');
      if (!back || !back.hidden) return null;
      back.hidden = false;
      back.setAttribute('href', '/');
      const l = back.querySelector('[data-back-label]');
      if (l) l.textContent = 'Testseite';
      document.documentElement.classList.add('vb-has-back');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    // Weiches Scrollen (z. B. /missionen) wuerde jeden Sprung erst nach
    // einer Animation ankommen lassen: fuer die Messung aus.
    document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
    document.body.style.setProperty('scroll-behavior', 'auto', 'important');
    const bild = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const name = (el) => {
      if (!el || el.nodeType !== 1) return String(el);
      const id = el.id ? `#${el.id}` : '';
      const kl = [...el.classList].slice(0, 2).map((c) => `.${c}`).join('');
      return `${el.tagName.toLowerCase()}${id}${kl}`;
    };
    const sichtbar = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility !== 'visible' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // Rollbereich, an dem ein sticky-Element klebt: der naechste Vorfahr mit
    // overflow ausser visible/clip. Kein solcher (oder html/body) = Fenster.
    const rollbereich = (el) => {
      for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll|hidden)/.test(cs.overflowX + cs.overflowY)) return p;
      }
      return null;
    };
    const alle = [...document.querySelectorAll('body *')].filter((el) => {
      const pos = getComputedStyle(el).position;
      return (pos === 'sticky' || pos === 'fixed') && sichtbar(el);
    });
    const vh = innerHeight;
    // Leisten = kleben/stehen am Fenster, nicht hoeher als 45 % des Fensters
    // (ganzflaechige Ebenen, Schubladen und Dialoge sind keine Leisten) und
    // anklickbar.
    const amFenster = alle.filter((el) => getComputedStyle(el).position === 'fixed' || !rollbereich(el));
    const imBereich = alle.length - amFenster.length;
    const istLeiste = (el) => {
      const r = el.getBoundingClientRect();
      return r.height < vh * 0.45 && getComputedStyle(el).pointerEvents !== 'none';
    };
    // Gemessen wird jede am Fenster klebende Leiste oder Seitenspalte mit
    // festem top (eine Filterspalte darf hoch sein, nur nicht hoeher als das
    // Fenster: dann klebt sie nie ganz).
    const folger = amFenster.filter((el) => {
      const cs = getComputedStyle(el);
      return cs.position === 'sticky' && cs.top !== 'auto' && cs.pointerEvents !== 'none'
        && el.getBoundingClientRect().height < vh
        && !amFenster.some((o) => o !== el && o.contains(el) && getComputedStyle(o).position === 'sticky');
    });
    const befunde = [];
    for (const el of folger) {
      const topPx = parseFloat(getComputedStyle(el).top) || 0;
      // Lage im Fluss: kurz static, dann zurueck (sticky belegt denselben Platz).
      const alt = el.style.getPropertyValue('position');
      const altPrio = el.style.getPropertyPriority('position');
      el.style.setProperty('position', 'static', 'important');
      const fluss = el.getBoundingClientRect().top + scrollY;
      if (alt) el.style.setProperty('position', alt, altPrio); else el.style.removeProperty('position');
      let geklebt = false;
      for (const extra of [120, 40, 2]) {
        scrollTo(0, Math.max(0, fluss - topPx + extra));
        await bild();
        await warte(60);
        const r = el.getBoundingClientRect();
        if (Math.abs(r.top - topPx) <= 1.5 && scrollY > 0) { geklebt = true; break; }
      }
      const r = el.getBoundingClientRect();
      const b = { leiste: name(el), top: Math.round(topPx), hoehe: Math.round(r.height), geklebt, verdeckt: 0, deckt: 0, ueber: null, unter: null, sprung: null };
      if (!geklebt) { befunde.push(b); continue; }
      // Bedienelemente der Leiste, die gerade im Bild sind: liegt an ihrer
      // Mitte etwas anderes obenauf, sind sie nicht anklickbar. Gezaehlt wird
      // nur der sichtbare Teil (eine seitwaerts rollende Leiste schneidet ab).
      const STEUER = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
      const huelle = (o) => {
        let c = o;
        while (c && c !== document.body && !/^(fixed|sticky)$/.test(getComputedStyle(c).position)) c = c.parentElement;
        return c && c !== document.body ? c : o;
      };
      const pruefe = (box, steuer, gehoert) => {
        const clip = { l: Math.max(box.left, 0), r: Math.min(box.right, innerWidth), t: Math.max(box.top, 0), b: Math.min(box.bottom, vh) };
        let gesehen = 0, zu = 0;
        const wer = new Map();
        for (const d of steuer) {
          const q = d.getBoundingClientRect();
          const l = Math.max(q.left, clip.l), rr = Math.min(q.right, clip.r), t = Math.max(q.top, clip.t), bb = Math.min(q.bottom, clip.b);
          if (rr - l < 4 || bb - t < 4) continue;
          gesehen++;
          const hit = document.elementFromPoint((l + rr) / 2, (t + bb) / 2);
          if (hit && (d.contains(hit) || gehoert(hit))) continue;
          zu++;
          const k = name(hit ? huelle(hit) : hit);
          wer.set(k, (wer.get(k) || 0) + 1);
        }
        return { gesehen, zu, wer: [...wer.keys()].join(', ') };
      };
      // Anklickbar gemeint: sichtbar auch ueber die Vorfahren (ein
      // geschlossenes Menue ist durchsichtig und klickdurchlaessig, seine
      // Links haben trotzdem Kaesten) und nicht pointer-events:none.
      const bedienbar = (d) => sichtbar(d) && getComputedStyle(d).pointerEvents !== 'none'
        && (typeof d.checkVisibility !== 'function' || d.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
      const eigen = pruefe(r, [...el.querySelectorAll(STEUER)].filter(bedienbar), (h) => el.contains(h));
      b.steuer = eigen.gesehen;
      if (eigen.zu) { b.verdeckt = eigen.zu; b.ueber = eigen.wer; }
      // Umgekehrt: deckt die Leiste Bedienelemente anderer Leisten zu?
      for (const o of amFenster) {
        if (o === el || o.contains(el) || el.contains(o) || !sichtbar(o)) continue;
        const q = o.getBoundingClientRect();
        if (q.bottom <= 0 || q.top >= vh) continue;
        const fremd = pruefe({ left: 0, right: innerWidth, top: 0, bottom: vh }, [...o.querySelectorAll(STEUER)].filter(bedienbar), (h) => !el.contains(h));
        if (fremd.zu > b.deckt) { b.deckt = fremd.zu; b.unter = name(o); }
      }
      // Nur zur Auskunft: wie weit ueberlappen sich die Kaesten?
      for (const o of amFenster) {
        if (o === el || o.contains(el) || el.contains(o) || !sichtbar(o) || !istLeiste(o)) continue;
        const q = o.getBoundingClientRect();
        if (q.top <= r.top + 1 && q.bottom > r.top && q.right > r.left && q.left < r.right) b.kasten = Math.max(b.kasten || 0, Math.round(Math.min(q.bottom, r.bottom) - r.top));
      }
      // Sprunglinks: nur einsammeln (jeder dritte). Gesprungen wird je Link
      // auf einer frisch geladenen Seite (sprungMessen): nach den Eingriffen
      // dieser Messung landeten Spruenge auf der Ruestungs-Seite, deren
      // Abschnitte content-visibility:auto tragen, woanders als bei einem
      // Menschen.
      b.sprungLinks = [...el.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute('href')).filter((h) => h.length > 1).filter((_, i) => i % 3 === 0);
      befunde.push(b);
    }
    scrollTo(0, 0);
    return { kleber: alle.length, amFenster: amFenster.length, imBereich, folger: folger.length, befunde };
  }, marke);
}

/* Ein Sprung auf frisch geladener Seite: Link klicken wie ein Mensch, dann
   pruefen, ob das Ziel unter den oben klebenden Leisten liegt. Unterkante
   zaehlt mit, was aus einer Leiste heraushaengt (Zurueck-Marke). */
async function sprungMessen(page, leiste, href, marke) {
  return page.evaluate(async ({ leiste, href, marke }) => {
    const bild = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
    document.body.style.setProperty('scroll-behavior', 'auto', 'important');
    if (marke) {
      const back = document.querySelector('.snav__back');
      if (back && back.hidden) {
        back.hidden = false;
        back.setAttribute('href', '/');
        const l = back.querySelector('[data-back-label]');
        if (l) l.textContent = 'Testseite';
        document.documentElement.classList.add('vb-has-back');
      }
    }
    const el = document.querySelector(leiste);
    const link = el && [...el.querySelectorAll('a')].find((a) => a.getAttribute('href') === href);
    const ziel = document.getElementById(decodeURIComponent(href.slice(1)));
    if (!link || !ziel) return null;
    link.click();
    await bild();
    await new Promise((r) => setTimeout(r, 500));
    const vh = innerHeight;
    const name = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${[...e.classList].slice(0, 2).map((c) => `.${c}`).join('')}`;
    const zu = (e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility === 'visible' && r.width > 0 && r.height > 0
        && cs.pointerEvents !== 'none' && (typeof e.checkVisibility !== 'function' || e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
    };
    // Nur was horizontal ueber dem Ziel liegt, kann es verdecken: eine
    // klebende Filterspalte links neben dem Ziel zaehlt nicht mit.
    const zr = ziel.getBoundingClientRect();
    const ueberZiel = (q) => q.right > zr.left && q.left < zr.right;
    let kante = 0, wo = '';
    for (const o of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(o).position;
      if (pos !== 'sticky' && pos !== 'fixed') continue;
      if (!zu(o)) continue;
      const q = o.getBoundingClientRect();
      if (q.height >= vh * 0.45 || !(q.top <= 2 + (parseFloat(getComputedStyle(o).top) || 0) && q.bottom < vh * 0.6)) continue;
      if (ueberZiel(q) && q.bottom > kante) { kante = q.bottom; wo = name(o); }
      for (const k of o.querySelectorAll('a[href], button, input, select, summary')) {
        const w = k.getBoundingClientRect();
        if (w.height && ueberZiel(w) && w.top < vh * 0.5 && w.bottom < vh * 0.6 && w.bottom > kante && zu(k)) { kante = w.bottom; wo = name(k); }
      }
    }
    return { zt: Math.round(zr.top), kante: Math.round(kante), wo };
  }, { leiste, href, marke });
}

/* ---------- Lauf ---------- */
/* page.goto wirft bei 404 oder 500 nicht: ohne diese Pruefung zaehlte eine
   Fehlerseite ohne Leisten als gemessen und befundfrei. Ein HTTP-Fehler
   geht in den Fehlerzweig des Arbeiters (fehlgeschlagen++). null kommt nur
   bei einer Navigation im selben Dokument und ist hier kein Fehler. */
async function laden(page, url) {
  const antwort = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  if (antwort && antwort.status() >= 400) throw new Error(`HTTP ${antwort.status()} fuer ${url}`);
  return antwort;
}
const browser = await chromium.launch({ executablePath: BROWSER, headless: true });
if (BILDER) mkdirSync(BILDER, { recursive: true });
const ergebnisse = [];
let seitenGeprueft = 0;
let fehlgeschlagen = 0;
const auftraege = [];
for (const f of FENSTER) for (const s of SEITEN) auftraege.push({ f, s });

async function arbeiter() {
  const ctx = await browser.newContext({ viewport: auftraege[0].f, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  let page = await ctx.newPage();
  while (auftraege.length) {
    const { f, s } = auftraege.shift();
    try {
     for (const marke of [false, true]) {
      await page.setViewportSize(f);
      await laden(page, BASE + s);
      await page.waitForTimeout(400);
      const m = await messen(page, marke);
      if (!m) continue;
      seitenGeprueft++;
      const fenster = `${f.width}x${f.height}`;
      const seite = marke ? `${s} +Marke` : s;
      for (const b of m.befunde) {
        if (b.geklebt && b.sprungLinks?.length) {
          const sp = { geprueft: 0, versteckt: 0, schlimmst: 0, kanteVon: '' };
          for (const href of b.sprungLinks) {
            await laden(page, BASE + s);
            await page.waitForTimeout(300);
            const j = await sprungMessen(page, b.leiste, href, marke);
            if (!j) continue;
            sp.geprueft++;
            if (j.zt < j.kante - 2) {
              sp.versteckt++;
              if (j.kante - j.zt > sp.schlimmst) { sp.schlimmst = j.kante - j.zt; sp.kanteVon = j.wo; }
            }
          }
          b.sprung = sp;
          await laden(page, BASE + s);
          if (marke) await messen(page, true).catch(() => null);
        }
        delete b.sprungLinks;
        const problem = !b.geklebt ? null
          : b.verdeckt ? `${b.verdeckt} von ${b.steuer} Bedienelementen liegen unter ${b.ueber} (Kasten ${b.kasten || 0} px)`
          : b.deckt ? `deckt ${b.deckt} Bedienelement(e) von ${b.unter} zu`
          : b.sprung?.versteckt ? `Sprungziel ${b.sprung.versteckt}/${b.sprung.geprueft} bis ${b.sprung.schlimmst} px unter ${b.sprung.kanteVon}`
          : null;
        ergebnisse.push({ fenster, seite, ...b, problem });
        if (problem && BILDER) {
          const datei = join(BILDER, `${fenster}_${seite.replace(/[^a-z0-9]+/gi, '_')}_${b.leiste.replace(/[^a-z0-9]+/gi, '_')}.png`.replace(/_+/g, '_'));
          // Fuer das Bild die Leiste wieder klebend zeigen.
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return;
            const top = parseFloat(getComputedStyle(el).top) || 0;
            el.style.setProperty('position', 'static', 'important');
            const y = el.getBoundingClientRect().top + scrollY;
            el.style.removeProperty('position');
            scrollTo(0, Math.max(0, y - top + 120));
          }, b.leiste);
          await page.waitForTimeout(150);
          await page.screenshot({ path: datei });
        }
      }
     }
    } catch (e) {
      fehlgeschlagen++;
      console.log(`  ! ${f.width}x${f.height} ${s}: ${String(e.message).split('\n')[0]}`);
      try { await page.close(); } catch {}
      page = await ctx.newPage();
    }
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: Math.max(1, PARALLEL) }, arbeiter));
await browser.close();

/* ---------- Bericht ---------- */
const geklebt = ergebnisse.filter((e) => e.geklebt);
const probleme = ergebnisse.filter((e) => e.problem);
console.log(`Klebeleisten-Sonde gegen ${BASE}`);
console.log(`  ${SEITEN.length} Seiten x ${FENSTER.length} Fenster, dazu jede Seite mit Zurueck-Marke noch einmal = ${seitenGeprueft} Messungen, ${fehlgeschlagen} Aufrufe fehlgeschlagen`);
console.log(`  ${ergebnisse.length} am Fenster klebende Leisten gefunden, ${geklebt.length} davon zum Kleben gebracht`);
const ohne = ergebnisse.filter((e) => !e.geklebt);
if (ohne.length) {
  const z = new Map();
  for (const e of ohne) z.set(`${e.seite} ${e.leiste}`, (z.get(`${e.seite} ${e.leiste}`) || 0) + 1);
  console.log(`  nicht zum Kleben gebracht (Behaelter zu kurz oder Leiste unten): ${[...z.keys()].slice(0, 12).join(' | ')}${z.size > 12 ? ' …' : ''}`);
}
const gruppen = new Map();
for (const e of geklebt) {
  const k = e.leiste;
  if (!gruppen.has(k)) gruppen.set(k, { seiten: new Set(), fenster: new Set(), probleme: [] });
  const g = gruppen.get(k);
  g.seiten.add(e.seite);
  g.fenster.add(e.fenster);
  if (e.problem) g.probleme.push(e);
}
console.log('\nJe Leiste (geklebt gemessen):');
for (const [k, g] of [...gruppen].sort((a, b) => b[1].probleme.length - a[1].probleme.length)) {
  console.log(`  ${g.probleme.length ? 'PROBLEM' : 'ok     '} ${k}  auf ${g.seiten.size} Seite(n), Fenster ${[...g.fenster].join(' ')}`);
  for (const p of g.probleme.slice(0, 8)) console.log(`          ${p.fenster} ${p.seite}: ${p.problem}`);
  if (g.probleme.length > 8) console.log(`          … ${g.probleme.length - 8} weitere`);
}
console.log(`\n${probleme.length} Befund(e) in ${new Set(probleme.map((p) => p.leiste)).size} Leiste(n).`);
if (JSON_AUS) writeFileSync(JSON_AUS, JSON.stringify(ergebnisse, null, 1));
