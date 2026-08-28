// Drei Sichten auf dieselben Angebote: Spieldaten (neu), Gegenquelle, Handliste.
//   node scripts/probes/wikelo-dreivergleich.mjs
import { readFileSync } from 'node:fs';

const API = 'https://starcitizen.tools/api.php';
const kopf = { 'user-agent': 'verse-base-abgleich/1.0' };
const hol = async (u) => (await fetch(u, { headers: kopf, signal: AbortSignal.timeout(30000) })).json();
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const spiel = JSON.parse(readFileSync('assets/wikelo-gamefiles.json', 'utf8'));
const hand = (() => { const w = JSON.parse(readFileSync('assets/wikelo-trades.json', 'utf8')); return Array.isArray(w) ? w : Object.values(w).find(Array.isArray); })();

/* ---------- Gegenquelle ---------- */
const KAT = ['Wikelo ship contracts', 'Wikelo ground vehicle contracts', 'Wikelo weapon contracts',
  'Wikelo armor contracts', 'Wikelo currency contracts'];
const titel = [];
for (const k of KAT) {
  const d = await hol(`${API}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(k)}&cmlimit=200&format=json`);
  for (const m of d.query?.categorymembers ?? []) titel.push(m.title);
}
const lies = (text) => {
  const teile = text.split('|').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < teile.length - 1; i++) {
    const m = /^(\d+)x$/.exec(teile[i]);
    if (m && !/^\d+ Unit/.test(teile[i + 1])) out.push({ n: Number(m[1]), name: teile[i + 1] });
  }
  return out;
};
const wiki = new Map();
for (const t of titel) {
  try {
    const d = await hol(`${API}?action=parse&page=${encodeURIComponent(t)}&prop=text&format=json`);
    const html = d.parse?.text?.['*'] ?? '';
    const i = html.lastIndexOf('id="Orders"'); const j = html.indexOf('id="Rewards"', i);
    if (i < 0) continue;
    const flach = (s) => s.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
    wiki.set(t, lies(flach(html.slice(i, j > 0 ? j : i + 2500))));
  } catch { /* Seite ueberspringen */ }
}

console.log(`Spieldaten: ${spiel.contracts.length} Vertraege · Gegenquelle: ${wiki.size} · Handliste: ${hand.length}\n`);

/* ---------- Spieldaten <-> Gegenquelle, ueber den Vertragstitel ---------- */
const spielNachTitel = new Map(spiel.contracts.filter((c) => c.titel).map((c) => [norm(c.titel), c]));
let gleich = 0; const abw = []; const nurWiki = []; const nurSpiel = [];
for (const [t, orders] of wiki) {
  const s = spielNachTitel.get(norm(t));
  if (!s) { nurWiki.push(t); continue; }
  const a = s.orders.map((o) => `${o.min}x${norm(o.name)}`).sort();
  const b = orders.map((o) => `${o.n}x${norm(o.name)}`).sort();
  if (JSON.stringify(a) === JSON.stringify(b)) gleich++;
  else abw.push({ t, spiel: s.orders.map((o) => `${o.min}x ${o.name}`), wiki: orders.map((o) => `${o.n}x ${o.name}`) });
}
for (const c of spiel.contracts) if (c.titel && ![...wiki.keys()].some((t) => norm(t) === norm(c.titel))) nurSpiel.push(c.titel);

console.log('=== Spieldaten gegen Gegenquelle (Titel + Mengen) ===');
console.log(`  deckungsgleich: ${gleich} | abweichend: ${abw.length} | nur Gegenquelle: ${nurWiki.length} | nur Spieldaten: ${nurSpiel.length}`);
for (const a of abw.slice(0, 6)) {
  console.log(`\n  ${a.t}`);
  console.log(`    spiel: ${a.spiel.join(' · ')}`);
  console.log(`    wiki : ${a.wiki.join(' · ')}`);
}
if (nurSpiel.length) console.log(`\n  nur in den Spieldaten: ${nurSpiel.slice(0, 12).join(' | ')}`);
if (nurWiki.length) console.log(`  nur in der Gegenquelle: ${nurWiki.slice(0, 12).join(' | ')}`);

/* ---------- Handliste gegen Spieldaten ---------- */
console.log('\n=== Handliste gegen Spieldaten (ueber die Belohnung) ===');
const spielNachReward = new Map();
for (const c of spiel.contracts) for (const r of c.rewardItems ?? []) spielNachReward.set(norm(r), c);
let handTreffer = 0, handGleich = 0; const handAbw = [];
for (const e of hand) {
  const bel = e.get || e.name;
  let c = spielNachReward.get(norm(bel));
  if (!c) { const k = norm(bel); for (const [rk, rv] of spielNachReward) if (k.length > 4 && (rk.includes(k) || k.includes(rk))) { c = rv; break; } }
  if (!c) continue;
  handTreffer++;
  const roh = (e.mats || []).filter((m) => m && m !== '—');
  if (e.favor) roh.push(`${e.favor}× Wikelo Favor`);
  const uns = roh.map((m) => norm(m.replace(/^\d+\s*[x×]\s*/i, ''))).sort();
  const sp = c.orders.map((o) => norm(o.name)).sort();
  if (JSON.stringify(uns) === JSON.stringify(sp)) handGleich++;
  else handAbw.push({ bel, uns: roh, spiel: c.orders.map((o) => `${o.min}x ${o.name}`) });
}
console.log(`  zugeordnet: ${handTreffer} von ${hand.length} | Waren deckungsgleich: ${handGleich} | abweichend: ${handAbw.length}`);
for (const a of handAbw.slice(0, 6)) {
  console.log(`\n  ${a.bel}`);
  console.log(`    hand : ${a.uns.join(' · ')}`);
  console.log(`    spiel: ${a.spiel.join(' · ')}`);
}
