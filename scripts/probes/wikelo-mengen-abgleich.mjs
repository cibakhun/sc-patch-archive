// Gleicht die handgepflegte Tauschliste gegen die Wiki ab — Angebot fuer
// Angebot, Menge fuer Menge.
//
// Die Wiki rendert Orders/Rewards ueber Vorlagen aus ihrer eigenen Datenbank;
// im Quelltext der Seite stehen sie NICHT. Deshalb wird die gerenderte Seite
// geholt (action=parse&prop=text) und die Tabelle daraus gelesen.
//
//   node scripts/probes/wikelo-mengen-abgleich.mjs
import { readFileSync } from 'node:fs';

const API = 'https://starcitizen.tools/api.php';
const kopf = { 'user-agent': 'verse-base-abgleich/1.0' };
const hol = async (u) => (await fetch(u, { headers: kopf, signal: AbortSignal.timeout(30000) })).json();

const KATEGORIEN = ['Wikelo ship contracts', 'Wikelo ground vehicle contracts',
  'Wikelo weapon contracts', 'Wikelo armor contracts', 'Wikelo currency contracts'];

const titel = [];
for (const k of KATEGORIEN) {
  const d = await hol(`${API}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(k)}&cmlimit=200&format=json`);
  for (const m of d.query?.categorymembers ?? []) titel.push(m.title);
}
console.log(`Wiki-Vertraege: ${titel.length}`);

/** "30x|Wikelo Favor|1 Unit|3x|Carinite (Pure)|…" -> [{n:30,name:'Wikelo Favor'}, …] */
function lies(text) {
  const teile = text.split('|').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < teile.length - 1; i++) {
    const m = /^(\d+)x$/.exec(teile[i]);
    if (m && !/^\d+ Unit/.test(teile[i + 1])) out.push({ n: Number(m[1]), name: teile[i + 1] });
  }
  return out;
}

const wiki = new Map();
let fehler = 0;
for (const t of titel) {
  try {
    const d = await hol(`${API}?action=parse&page=${encodeURIComponent(t)}&prop=text&format=json`);
    const html = d.parse?.text?.['*'] ?? '';
    const i = html.lastIndexOf('id="Orders"');
    const j = html.indexOf('id="Rewards"', i);
    if (i < 0) { fehler++; continue; }
    const flach = (s) => s.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
    const orders = lies(flach(html.slice(i, j > 0 ? j : i + 2500)));
    const rewards = j > 0 ? lies(flach(html.slice(j, j + 1500))) : [];
    wiki.set(t, { orders, rewards });
  } catch { fehler++; }
}
console.log(`gelesen: ${wiki.size}, nicht lesbar: ${fehler}`);

const unser = JSON.parse(readFileSync('assets/wikelo-trades.json', 'utf8'));
const liste = Array.isArray(unser) ? unser : Object.values(unser).find(Array.isArray);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Join ueber die BELOHNUNG: unsere `get` gegen die Rewards-Zeile der Wiki.
const wikiNachBelohnung = new Map();
for (const [t, d] of wiki) for (const r of d.rewards) wikiNachBelohnung.set(norm(r.name), { titel: t, ...d });

let getroffen = 0, gleich = 0;
const abweichend = [], ohneTreffer = [];
for (const e of liste) {
  // ⚠ Nur die fuenf Waehrungs-Eintraege tragen `get`; die uebrigen 58 nennen
  // die Belohnung in `name`. Der erste Anlauf jointe nur ueber `get` und
  // fand deshalb 5 von 63.
  const belohnung = e.get || e.name;
  let w = wikiNachBelohnung.get(norm(belohnung));
  if (!w) {
    // Die Wiki fuehrt Herstellerpraefixe ("RSI Constellation Taurus …"),
    // unsere Liste den Kurznamen. Teilstring in beide Richtungen.
    const k = norm(belohnung);
    for (const [wk, wv] of wikiNachBelohnung) {
      if (k.length > 4 && (wk.includes(k) || k.includes(wk))) { w = wv; break; }
    }
  }
  if (!w) { ohneTreffer.push(belohnung); continue; }
  getroffen++;
  // ⚠ Unsere Liste fuehrt die Favor-Kosten im EIGENEN Feld `favor`, die Wiki
  // mischt sie unter die Materialien. Ohne das Zusammenfuehren meldet jeder
  // zweite Eintrag faelschlich "Wikelo Favor fehlt".
  const unsRoh = (e.mats || []).filter((m) => m && m !== '—');
  if (e.favor) unsRoh.push(`${e.favor}× Wikelo Favor`);
  const unsMats = unsRoh.map((m) => norm(m.replace(/^\d+\s*[x×]\s*/i, '')));
  const wikiMats = w.orders.map((o) => norm(o.name));
  const fehlend = wikiMats.filter((m) => !unsMats.some((u) => u.includes(m) || m.includes(u)));
  const zuviel = unsMats.filter((u) => !wikiMats.some((m) => u.includes(m) || m.includes(u)));
  if (!fehlend.length && !zuviel.length) gleich++;
  else abweichend.push({ get: belohnung, titel: w.titel, uns: unsRoh, wiki: w.orders.map((o) => `${o.n}x ${o.name}`) });
}

console.log(`\nunsere Eintraege: ${liste.length} | ueber die Belohnung getroffen: ${getroffen} | Materialien deckungsgleich: ${gleich}`);
console.log(`abweichend: ${abweichend.length} | kein Wiki-Treffer: ${ohneTreffer.length}`);
for (const a of abweichend.slice(0, 12)) {
  console.log(`\n  ${a.get}   (Wiki: ${a.titel})`);
  console.log(`    uns : ${(a.uns || []).join(' · ')}`);
  console.log(`    wiki: ${a.wiki.join(' · ')}`);
}
if (ohneTreffer.length) console.log(`\n  ohne Wiki-Treffer: ${ohneTreffer.slice(0, 15).join(' | ')}`);
