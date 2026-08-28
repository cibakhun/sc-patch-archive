// wikelo-kuration-zuordnung.mjs — ordnet die 63 handgepflegten Wikelo-
// Kuration-Eintraege (Bild/Ausstattung/Reputationstext) den 69 Spieldaten-
// Vertraegen aus assets/wikelo-gamefiles.json zu. Drei deterministische
// Stufen, jede mit beidseitiger Eindeutigkeit als Bedingung — greedy
// "erster gewinnt" ist ausdruecklich verboten, weil er genau die
// Fehlzuordnung erzeugt, gegen die diese Stufenordnung gebaut ist
// (Phase 20, 20-02-PLAN.md, Task 1).
//
// Reines Diagnosewerkzeug — schreibt selbst KEINE Datei. Gehoert deshalb
// nach scripts/probes/ und NICHT in scripts/lib/gate-registry.mjs
// (verify:wiring bindet nur verify-*.mjs und audit-*.mjs).
//
//   node scripts/probes/wikelo-kuration-zuordnung.mjs --hand <pfad-zum-handbestand>
//   node scripts/probes/wikelo-kuration-zuordnung.mjs --hand <pfad> --schreiben
//
// Der Handbestand ist der 63-Eintraege-Stand VOR Plan 01
// (z. B. per "git show <commit>:assets/wikelo-trades.json > <datei>").
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const A = resolve(ROOT, 'assets');

const args = process.argv.slice(2);
const handIdx = args.indexOf('--hand');
const HAND_PATH = handIdx >= 0 ? args[handIdx + 1] : null;
const SCHREIBEN = args.includes('--schreiben');

if (!HAND_PATH) {
  console.error(
    'FEHLER: --hand <pfad-zum-handbestand> ist Pflicht (der 63-Eintraege-Stand VOR Plan 01, ' +
      'z. B. per "git show <commit-vor-20-01>:assets/wikelo-trades.json > <datei>").',
  );
  process.exit(1);
}
if (!existsSync(HAND_PATH)) {
  console.error(`FEHLER: Handbestand nicht gefunden unter ${HAND_PATH}`);
  process.exit(1);
}
const GAMEFILES = resolve(A, 'wikelo-gamefiles.json');
if (!existsSync(GAMEFILES)) {
  console.error('FEHLER: assets/wikelo-gamefiles.json fehlt — zuerst "npm run datamine:wikelo" laufen lassen.');
  process.exit(1);
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tok = (s) => norm(s).split(' ').filter(Boolean);
const STOPWORDS = new Set(['set', 'military', 'spec']);
const FAVOR_KLASSE = 'Carryable_1H_CY_banu_favour_Wikelo'; // exakte Gleichheit — "..._Wikelo_special" (Polaris Bit) bleibt Materialzeile

const game = JSON.parse(readFileSync(GAMEFILES, 'utf8'));
const hand = JSON.parse(readFileSync(HAND_PATH, 'utf8'));
const handList = Array.isArray(hand) ? hand : Object.values(hand).find(Array.isArray);
if (!Array.isArray(handList)) {
  console.error('FEHLER: Handbestand ist kein Array bzw. enthaelt keines.');
  process.exit(1);
}
const curatedPath = resolve(A, 'wikelo-curated.json');
const curatedExisting = existsSync(curatedPath) ? JSON.parse(readFileSync(curatedPath, 'utf8')) : null;

/* ---------- Materialzeilen-Normalisierung ---------- */
function matZeileHand(m) {
  // "1× Carinite (Pure)" -> {qty, name}; "—" (Platzhalter) -> null (zaehlt als leer)
  if (!m || m === '—') return null;
  const mm = /^(\d+)\s*[×xX]\s*(.+)$/.exec(String(m).trim());
  if (!mm) return null;
  return { qty: Number(mm[1]), name: mm[2] };
}
function handMaterialien(e) {
  return (e.mats || [])
    .map(matZeileHand)
    .filter(Boolean)
    .map((r) => `${r.qty}x${norm(r.name)}`)
    .sort();
}
function vertragMaterialien(c) {
  return c.orders
    .filter((o) => o.klasse !== FAVOR_KLASSE)
    .map((o) => `${o.min}x${norm(o.name)}`)
    .sort();
}

/* ---------- offene Mengen (werden je Stufe verkleinert) ---------- */
const offeneVertraege = new Map(game.contracts.map((c) => [c.id, c]));
const offeneHand = new Map(handList.map((e, i) => [i, e])); // Index als Schluessel — Handliste hat kein stabiles id-Feld

const handName = (e) => e.get || e.name;
const belohnungen = (c) => (c.rewardItems && c.rewardItems.length ? c.rewardItems.join(', ') : '—');
const vertragBezeichnung = (c) => c.titel ?? c.debugName;

/* ---------- Stufe 1: materialien-exakt ---------- */
function stufe1() {
  const nachSchluesselVertrag = new Map();
  for (const [, c] of offeneVertraege) {
    const mats = vertragMaterialien(c);
    if (!mats.length) continue;
    const k = mats.join('|');
    if (!nachSchluesselVertrag.has(k)) nachSchluesselVertrag.set(k, []);
    nachSchluesselVertrag.get(k).push(c);
  }
  const nachSchluesselHand = new Map();
  for (const [i, e] of offeneHand) {
    const mats = handMaterialien(e);
    if (!mats.length) continue;
    const k = mats.join('|');
    if (!nachSchluesselHand.has(k)) nachSchluesselHand.set(k, []);
    nachSchluesselHand.get(k).push(i);
  }
  return schluesselAufloesen('materialien-exakt', nachSchluesselVertrag, nachSchluesselHand);
}

/* ---------- Stufe 2: belohnungsname-exakt ---------- */
function stufe2() {
  const nachSchluesselVertrag = new Map();
  for (const [, c] of offeneVertraege) {
    const keys = new Set();
    if (c.titel) keys.add(norm(c.titel));
    for (const r of c.rewardItems || []) keys.add(norm(r));
    for (const k of keys) {
      if (!k) continue;
      if (!nachSchluesselVertrag.has(k)) nachSchluesselVertrag.set(k, new Set());
      nachSchluesselVertrag.get(k).add(c);
    }
  }
  // dedupe: Set -> Array je Schluessel
  const nachSchluesselVertragArr = new Map([...nachSchluesselVertrag].map(([k, set]) => [k, [...set]]));
  const nachSchluesselHand = new Map();
  for (const [i, e] of offeneHand) {
    const k = norm(handName(e));
    if (!k) continue;
    if (!nachSchluesselHand.has(k)) nachSchluesselHand.set(k, []);
    nachSchluesselHand.get(k).push(i);
  }
  return schluesselAufloesen('belohnungsname-exakt', nachSchluesselVertragArr, nachSchluesselHand);
}

/* ---------- gemeinsame Aufloesung: Schluessel -> Paar oder Kollision ---------- */
function schluesselAufloesen(name, nachSchluesselVertrag, nachSchluesselHand) {
  const paare = [];
  const kollisionen = [];
  const alleSchluessel = new Set([...nachSchluesselVertrag.keys(), ...nachSchluesselHand.keys()]);
  for (const k of alleSchluessel) {
    const vs = nachSchluesselVertrag.get(k) || [];
    const hs = nachSchluesselHand.get(k) || [];
    if (!vs.length || !hs.length) continue; // kein Treffer auf einer Seite -- kein Kollisionsfall, faellt in die naechste Stufe
    if (vs.length === 1 && hs.length === 1) {
      paare.push({ vertrag: vs[0], handIdx: hs[0], handEintrag: offeneHand.get(hs[0]) });
    } else {
      kollisionen.push({
        stufe: name,
        schluessel: k,
        vertraege: vs.map(vertragBezeichnung),
        handEintraege: hs.map((i) => handName(offeneHand.get(i))),
      });
    }
  }
  for (const p of paare) {
    offeneVertraege.delete(p.vertrag.id);
    offeneHand.delete(p.handIdx);
  }
  return { name, paare, kollisionen };
}

/* ---------- Stufe 3: belohnungsname-teilmenge ---------- */
function stufe3() {
  const kandidatenHand = new Map(); // handIdx -> [contract, ...]
  const kandidatenVertrag = new Map(); // contract.id -> [handIdx, ...]
  for (const [i, e] of offeneHand) {
    const nameTokens = tok(handName(e)).filter((t) => !STOPWORDS.has(t));
    if (!nameTokens.length) continue;
    for (const [id, c] of offeneVertraege) {
      const treffer = (c.rewardItems || []).some((r) => {
        const rTokens = new Set(tok(r));
        return nameTokens.every((t) => rTokens.has(t));
      });
      if (treffer) {
        if (!kandidatenHand.has(i)) kandidatenHand.set(i, []);
        kandidatenHand.get(i).push(c);
        if (!kandidatenVertrag.has(id)) kandidatenVertrag.set(id, []);
        kandidatenVertrag.get(id).push(i);
      }
    }
  }
  const paare = [];
  const kollisionen = [];
  for (const [i, cs] of kandidatenHand) {
    if (cs.length === 1) {
      const c = cs[0];
      const hs = kandidatenVertrag.get(c.id) || [];
      if (hs.length === 1) paare.push({ vertrag: c, handIdx: i, handEintrag: offeneHand.get(i) });
    } else if (cs.length > 1) {
      kollisionen.push({
        stufe: 'belohnungsname-teilmenge',
        schluessel: `handeintrag:${handName(offeneHand.get(i))}`,
        vertraege: cs.map(vertragBezeichnung),
        handEintraege: [handName(offeneHand.get(i))],
      });
    }
  }
  for (const [id, hs] of kandidatenVertrag) {
    if (hs.length > 1) {
      const c = offeneVertraege.get(id);
      kollisionen.push({
        stufe: 'belohnungsname-teilmenge',
        schluessel: `vertrag:${vertragBezeichnung(c)}`,
        vertraege: [vertragBezeichnung(c)],
        handEintraege: hs.map((i) => handName(offeneHand.get(i))),
      });
    }
  }
  for (const p of paare) {
    offeneVertraege.delete(p.vertrag.id);
    offeneHand.delete(p.handIdx);
  }
  return { name: 'belohnungsname-teilmenge', paare, kollisionen };
}

/* ---------- Lauf ---------- */
const stufen = [stufe1(), stufe2(), stufe3()];
const alleKollisionen = stufen.flatMap((s) => s.kollisionen);
const alleZuordnungen = stufen.flatMap((s) => s.paare.map((p) => ({ stufe: s.name, ...p })));

console.log(
  `Wikelo-Kuration-Zuordnung — ${game.contracts.length} Spieldaten-Vertraege, ${handList.length} Handeintraege (${HAND_PATH})\n`,
);

for (const s of stufen) {
  console.log(`=== Stufe: ${s.name} (${s.paare.length} Paare) ===`);
  for (const p of s.paare) {
    console.log(
      `  ${handName(p.handEintrag)}  ->  ${vertragBezeichnung(p.vertrag)}  [${p.vertrag.id}]  Belohnungen: ${belohnungen(p.vertrag)}`,
    );
  }
  console.log('');
}

console.log(`=== Kollisionen (${alleKollisionen.length}) ===`);
if (!alleKollisionen.length) console.log('  keine');
for (const k of alleKollisionen) {
  console.log(`  [${k.stufe}] Schluessel "${k.schluessel}"`);
  console.log(`    Vertraege: ${k.vertraege.join(' | ')}`);
  console.log(`    Handeintraege: ${k.handEintraege.join(' | ')}`);
}
console.log('');

console.log(`=== Offen gebliebene Handeintraege (${offeneHand.size}) ===`);
for (const [, e] of offeneHand) {
  console.log(`  ${handName(e)}  (img: ${e.img ? e.img : 'keins'})`);
}
console.log('');

console.log(`=== Offen gebliebene Spieldaten-Vertraege (${offeneVertraege.size}) ===`);
for (const [, c] of offeneVertraege) {
  console.log(`  ${vertragBezeichnung(c)}  [${c.id}]  debugName: ${c.debugName}  Belohnungen: ${belohnungen(c)}`);
}
console.log('');

const vertraegeZugeordnet = game.contracts.length - offeneVertraege.size;
const handZugeordnet = handList.length - offeneHand.size;
console.log(
  `Selbstauskunft: ${vertraegeZugeordnet} von ${game.contracts.length} Vertraegen zugeordnet, ${handZugeordnet} von ${handList.length} Handeintraegen zugeordnet.`,
);

/* ---------- --schreiben: fertiges trades-Objekt fuer wikelo-curated.json ---------- */
if (SCHREIBEN) {
  const trades = {};
  if (curatedExisting?.trades) {
    // vorhandene Eintraege (z. B. der Saat-Eintrag aus Plan 01) bleiben erhalten,
    // sofern diese Sonde sie nicht selbst neu zuordnet (Neuzuordnung gewinnt).
    for (const [id, v] of Object.entries(curatedExisting.trades)) trades[id] = v;
  }
  for (const z of alleZuordnungen) {
    const e = z.handEintrag;
    const eintrag = { basis: z.stufe };
    if (e.cat != null) eintrag.cat = e.cat;
    if (e.name != null) eintrag.name = e.name;
    if (e.get != null) eintrag.get = e.get;
    if (e.img != null) eintrag.img = e.img;
    if (e.comps != null) eintrag.comps = e.comps;
    if (e.rep != null) eintrag.rep = e.rep;
    trades[z.vertrag.id] = eintrag;
  }
  console.log('\n--- --schreiben: trades-Objekt fuer assets/wikelo-curated.json ---');
  console.log(JSON.stringify(trades, null, 2));
}
