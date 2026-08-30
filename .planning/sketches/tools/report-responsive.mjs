/* Kurzbericht aus out/responsive.json — Aufruf: node … [abschnitt] */
import { readFile } from 'node:fs/promises';
const R = JSON.parse(await readFile('.planning/sketches/tools/out/responsive.json', 'utf8'));
const only = process.argv[2] || 'all';
const show = (k) => only === 'all' || only === k;
const MOB = (vp) => Number(vp.split('x')[0]) <= 820;

const err = R.filter((r) => r.error);
if (err.length) console.log(`FEHLER beim Laden: ${err.length}`, err.slice(0, 3));
console.log(`Messungen: ${R.length}  Seiten: ${new Set(R.map((r) => r.url)).size}  Viewports: ${new Set(R.map((r) => r.vp)).size}`);

/* 1) waagerechter Ueberlauf */
if (show('over')) {
  const ov = R.filter((r) => r.overflowPx > 1);
  console.log(`\n=== 1) WAAGERECHTER UEBERLAUF: ${ov.length} von ${R.length} ===`);
  const byPage = {};
  for (const r of ov) (byPage[r.url] ||= []).push(`${r.vp}:+${r.overflowPx}`);
  for (const [u, v] of Object.entries(byPage).sort((a, b) => b[1].length - a[1].length))
    console.log(`  ${u}\n      ${v.join('  ')}`);
  console.log(`  --- Verursacher ---`);
  const cnt = {};
  for (const r of R) for (const w of r.wide || []) {
    (cnt[w.sel] ||= { n: 0, over: 0, pages: new Set(), vps: new Set() });
    const c = cnt[w.sel]; c.n++; c.over = Math.max(c.over, w.over); c.pages.add(r.url); c.vps.add(r.vp);
  }
  Object.entries(cnt).sort((a, b) => b[1].over - a[1].over).slice(0, 30).forEach(([k, v]) =>
    console.log(`  +${v.over}px  ${v.n}x [${[...v.vps].join(',')}]  ${k}\n        (${[...v.pages].slice(0, 3).join(' ')})`));
}

/* 2) Seitenhoehe */
if (show('hoehe')) {
  console.log(`\n=== 2) SEITENHOEHE (mobil, > 25000px) ===`);
  const tall = R.filter((r) => MOB(r.vp) && r.meta && r.meta.scrollH > 25000)
    .sort((a, b) => b.meta.scrollH - a.meta.scrollH);
  const seen = new Set();
  for (const r of tall) {
    const k = r.url + r.vp;
    if (seen.has(k)) continue; seen.add(k);
    console.log(`  ${(r.meta.scrollH / 1000).toFixed(1)}k px  ${r.vp}  ${r.url}`);
  }
  if (!tall.length) console.log('  keine');
}

/* 3) Fallen / Raumfresser */
if (show('fallen')) {
  const traps = R.flatMap((r) => (r.traps || []).map((t) => ({ ...t, url: r.url, vp: r.vp })));
  console.log(`\n=== 3) FALLEN / RAUMFRESSER: ${traps.length} ===`);
  const tk = {};
  for (const t of traps) {
    const k = `${t.kind} ${t.sel || t.detail || ''}`;
    (tk[k] ||= { n: 0, pct: 0, pages: new Set(), vps: new Set() });
    tk[k].n++; tk[k].pct = Math.max(tk[k].pct, t.pct || 0); tk[k].pages.add(t.url); tk[k].vps.add(t.vp);
  }
  Object.entries(tk).sort((a, b) => b[1].n - a[1].n).slice(0, 30).forEach(([k, v]) =>
    console.log(`  ${v.n}x ${v.pct}%v [${[...v.vps].slice(0, 8).join(',')}] ${k}\n        (${[...v.pages].slice(0, 3).join(' ')})`));
}

/* 4) Fingerkuppen */
if (show('ziele')) {
  const tiny = R.filter((r) => MOB(r.vp)).flatMap((r) => (r.tiny || []).filter((t) => !t.inline).map((t) => ({ ...t, url: r.url, vp: r.vp })));
  console.log(`\n=== 4) ZU KLEINE ZIELE (<40px, mobil): ${tiny.length} ===`);
  const bk = {};
  for (const t of tiny) {
    const k = t.sel.split(' > ').slice(-2).join(' > ');
    (bk[k] ||= { n: 0, min: 999, pages: new Set() });
    bk[k].n++; bk[k].min = Math.min(bk[k].min, t.w, t.h); bk[k].pages.add(t.url);
  }
  Object.entries(bk).sort((a, b) => b[1].n - a[1].n).slice(0, 30).forEach(([k, v]) =>
    console.log(`  ${v.n}x  min ${v.min}px  ${k}   (${[...v.pages].slice(0, 2).join(' ')})`));
}

/* 5) Kleine Schrift */
if (show('schrift')) {
  const sf = R.filter((r) => MOB(r.vp)).flatMap((r) => (r.smallFont || []).map((t) => ({ ...t, url: r.url })));
  console.log(`\n=== 5) SCHRIFT < 11.5px (mobil): ${sf.length} Vorkommen ===`);
  const fk = {};
  for (const t of sf) {
    const k = `${t.px}px ${t.sel.split(' > ').slice(-2).join(' > ')}`;
    (fk[k] ||= { n: 0, pages: new Set() }); fk[k].n++; fk[k].pages.add(t.url);
  }
  Object.entries(fk).sort((a, b) => b[1].n - a[1].n).slice(0, 25).forEach(([k, v]) =>
    console.log(`  ${v.n}x  ${k}   (${[...v.pages].slice(0, 2).join(' ')})`));
}

/* 6) abgeschnitten */
if (show('schnitt')) {
  const cl = R.flatMap((r) => (r.clipped || []).map((t) => ({ ...t, url: r.url, vp: r.vp })));
  console.log(`\n=== 6) ABGESCHNITTEN (overflow:hidden, kein ellipsis): ${cl.length} ===`);
  const ck = {};
  for (const t of cl) {
    const k = t.sel.split(' > ').slice(-2).join(' > ');
    (ck[k] ||= { n: 0, cut: 0, pages: new Set(), vps: new Set(), txt: t.txt });
    ck[k].n++; ck[k].cut = Math.max(ck[k].cut, t.cut); ck[k].pages.add(t.url); ck[k].vps.add(t.vp);
  }
  Object.entries(ck).sort((a, b) => b[1].cut - a[1].cut).slice(0, 25).forEach(([k, v]) =>
    console.log(`  -${v.cut}px ${v.n}x [${[...v.vps].slice(0, 6).join(',')}] ${k}  «${v.txt}»\n        (${[...v.pages].slice(0, 2).join(' ')})`));
}
