// verify-patch-angaben.mjs — nennt jede Datenseite den Patch-Stand ihrer Daten?
//
// WARUM ES DEN GIBT: Am 03.11.2026 standen alle Datendateien auf 4.10.2, und
// verify:datastand war gruen. Trotzdem hiess die Mining-Datenbank in Titel,
// Beschreibung und Vorschau "Star Citizen 4.9" (JSON-LD: "Alpha 4.8.0"), der
// Item Finder zeigte "Patch 4.9" samt Brotkrume auf die 4.9-Seite, und Wikelo
// hiess "Star Citizen 4.1", waehrend derselbe Text "Spielversion: Alpha 4.10.2"
// sagte. Der Fracturing-Rechner nannte fuer dieselbe Mining-Datei 4.10.2, das
// Item-Verzeichnis fuer dieselbe Item-Datei 4.10.
//
// Woher die beiden Angaben stammten: eine Seite hat zwei Wege, einen Stand zu
// nennen. Der eine leitet ihn aus der Kennung der Datendatei ab (ITEM_PATCH,
// craftPatch, Refinery, Schiffs-Etikett), der andere ist ein Literal im
// Seitencode. Ein Datenlauf hebt die Datei, das Literal bleibt stehen.
//
// Warum es niemand sah: verify:datastand haelt die Datendateien GEGENEINANDER
// und liest keine einzige Seite — es prueft die Quelle, nicht das Artefakt
// (Grundsatz 7). audit:site liest alle Seiten, aber keine Versionsangaben.
// Derselbe Fehler war am 27.08.2026 schon einmal da (5.237 Item-Seiten sagten
// "Star Citizen 4.9", Literal in src/lib/items.ts) und wurde an genau der
// einen Stelle repariert; der Item Finder eine Datei daneben behielt sein
// "4.9". Dazu fallen abgeleitete Angaben STILL aus: die Mining-Werkbank nahm
// "Alpha 4.10.2 · Live-Daten" entgegen und zeigte es nie, und das
// Schiffs-Etikett erkannte die Kennungsform "4.9.0-LIVE.12232306" nicht und
// liess das Feld leer.
//
// WAS ES PRUEFT (liest nur dist/ und committete JSON — Schiene A):
//   1  Bestand: jede Familie hat einen lesbaren Datenstand mit Fassung X.Y.Z.
//   2  Jede Seite einer Datenfamilie wird ihrem Datenstand zugeordnet; jede
//      Stand-Angabe darauf (Titel, Beschreibung, Vorschau-Tags, JSON-LD,
//      sichtbarer Text) muss zur Fassung passen: X.Y oder X.Y.Z der Daten.
//      Sonst FEHLER — "Angabe aus der Kennung ableiten" ist immer richtig.
//   3  Schiffe: jede Schiffsseite traegt ihre Spielversion, und die passt zum
//      Stempel IHRES Datensatzes; jeder Stempel passt zum Kopf von
//      vehicles.json, ausser benannten Ausnahmen.
//   4  Ausnahmen mit Anlass und Zombie-Waechter (Grundsatz 6).
//   5  Selbstauskunft und Klinken je Familie (Grundsatz 2 und 5).
//
// Eine Stand-Angabe ist eine Versionsnummer hinter einem Wort, das den
// Spielstand meint: "Star Citizen", "Patch", "Spielversion", "Game version".
// Ein nacktes "Alpha 4.2.0" ist Geschichte (Patch-Rueckgrat der Schiffe,
// "seit Alpha 4.1") und bleibt frei, ebenso Brotkrumen: sie fuehren zur
// Patch-Seite, aus der ein Thema stammt (Wikelo -> 4.1.0), und sind damit
// Navigation, keine Stand-Angabe — als FEHLER waeren sie ein Fehlalarm.
// Was nicht gerendert wird, sieht dieses Tor nicht: es prueft das Artefakt.
//
//   node scripts/verify-patch-angaben.mjs
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const rd = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));

const fail = [];
const warn = [];

/* ---------- Datenstaende ---------- */

// Dieselben Kennungsfelder wie in verify:datastand, dazu die Fahrzeuge.
const STAENDE = {
  'Item-Katalog': { file: 'assets/universal-items.json', get: (j) => j?.gameVersion },
  Crafting: { file: 'assets/crafting-db.json', get: (j) => j?.version },
  Mining: { file: 'assets/mining-db.json', get: (j) => j?.game_version },
  Missionen: { file: 'src/data/missions.json', get: (j) => j?.meta?.patch },
  Fahrzeuge: { file: 'src/data/vehicles.json', get: (j) => j?.gameVersion },
  Refinery: { file: 'assets/refinery-data.json', get: (j) => j?.meta?.gameVersion },
  Wikelo: { file: 'assets/wikelo-trades.meta.json', get: (j) => j?.gameVersion },
  // Halo und QT-Anker tragen dieselbe Kennung (src/data/precision-jump.ts bricht
  // den Bau sonst ab, verify:datastand haelt beide); die Halo-Datei steht fuer
  // die Familie.
  'Präzisionssprung': { file: 'assets/aaron-halo-gamefiles.json', get: (j) => j?.gameVersion },
};

// Seitenfamilien: Pfad in dist/ ohne "de/"-Praefix -> Datenstand. Was hier
// nicht steht (Patch-Seiten, Themen einzelner Patches, Startseite), nennt
// Patches als Geschichte und ist nicht Gegenstand dieses Tors.
const FAMILIEN = [
  { stand: 'Item-Katalog', match: (p) => p === 'items.html' || p.startsWith('items/') || p === 'armor-sets.html' || p === 'item-finder.html' },
  { stand: 'Crafting', match: (p) => p === 'crafting.html' || p.startsWith('crafting/') || p === 'topics/crafting.html' },
  { stand: 'Mining', match: (p) => p === 'topics/mining.html' || p === 'fracturing.html' },
  { stand: 'Missionen', match: (p) => p === 'missionen.html' || p.startsWith('missionen/') },
  { stand: 'Fahrzeuge', match: (p) => p === 'schiffe.html' || p.startsWith('schiffe/') },
  { stand: 'Refinery', match: (p) => p === 'refinery.html' },
  { stand: 'Wikelo', match: (p) => p === 'topics/wikelo-emporium.html' },
  { stand: 'Präzisionssprung', match: (p) => p === 'precision-jump.html' },
];

// Benannte Ausnahmen (Grundsatz 6). Jede traegt ihren Anlass als vollen Satz
// und eine Pruefung, ob der Anlass noch besteht — sonst reisst das Tor.
//
// Familien ohne pruefbaren Datenstand: ihre Angaben werden gemeldet, aber
// nicht beurteilt.
// Derzeit leer. Bis 05.11.2026 stand hier der Praezisionssprung („tragen keine
// Client-Kennung … bis ein Datenlauf die Kennung mitschreibt"); die Nachvermessung
// gegen 4.10.2 hat die Kennung geliefert, die Familie steht jetzt in STAENDE.
// Die Mechanik bleibt fuer den naechsten Fall.
const OHNE_KENNUNG = {};

// Fahrzeug-Datensaetze, deren Stempel bewusst vom Kopf von vehicles.json
// abweicht. Schluessel = Fahrzeug-id, Wert = Anlass und der EINE Stempel,
// den der Anlass erlaubt (ein anderer oder fehlender Stempel ist FEHLER).
const ATLS_ANLASS = 'Die ATLS-Varianten haben im DataCore keinen Fahrzeug-Record (sie sind ein Power Suit) und werden seit D-13 als eingefrorener Wiki-Satz aus vehicle-external.json übernommen, samt dessen Stempel 4.9.0.';
const STEMPEL_AUSNAHMEN = Object.fromEntries(
  ['argo-atls', 'argo-atls-geo', 'argo-atls-geo-collector-grad01', 'argo-atls-geo-collector-grad03'].map((id) => [id, { anlass: ATLS_ANLASS, stempel: '4.9.0' }]),
);

// Klinken (Grundsatz 5), Messlauf 04.11.2026 gegen den korrigierten Stand
// (Live-Bau und Vorschau gleich): Items 11.046 Seiten / 66.274 Angaben,
// Crafting 3.344 / 16.480, Mining 4 / 14, Missionen 2.776 / 0, Schiffe
// 464 / 464, Refinery 2 / 1, Wikelo 2 / 8, Praezisionssprung 2 / 2.
// Die grossen Familien liegen knapp darunter, damit ein Datenlauf, der ein
// paar Items streicht, nicht reisst — die Klinke soll das LEERLAUFEN fangen
// (eine Familie, deren Angaben verschwinden, saehe sonst gruen aus), nicht
// den Bestand zaehlen; das tut verify:metrics. Die kleinen Familien stehen
// genau auf dem Messwert: dort ist jede einzelne Angabe die Aussage.
// Nur nach OBEN; nach unten nur per Commit, dessen Botschaft die Ursache nennt.
const KLINKEN = {
  'Item-Katalog': { seiten: 11000, angaben: 66000 },
  Crafting: { seiten: 3300, angaben: 16400 },
  Mining: { seiten: 4, angaben: 14 },
  Missionen: { seiten: 2700, angaben: 0 },
  Fahrzeuge: { seiten: 464, angaben: 464 },
  Refinery: { seiten: 2, angaben: 1 },
  Wikelo: { seiten: 2, angaben: 8 },
  // 05.11.2026: 2 -> 4, die Unterzeile nennt jetzt ebenfalls den Patch aus den Daten.
  'Präzisionssprung': { seiten: 2, angaben: 4 },
};

/* ---------- Werkzeuge ---------- */

const FASSUNG_RX = /\d+\.\d+\.\d+/;
const fassungAus = (kennung) => (typeof kennung === 'string' ? kennung.match(FASSUNG_RX)?.[0] ?? null : null);
const passt = (angabe, fassung) => angabe === fassung || angabe === fassung.split('.').slice(0, 2).join('.');

const V = String.raw`(\d+\.\d+(?:\.\d+)?)(?![\d.]*\d)`;
const ANGABE_RX = [
  ['Star Citizen', new RegExp(String.raw`Star Citizen(?: Alpha)?\s+${V}`, 'g')],
  ['Patch', new RegExp(String.raw`\b[Pp]atch\s+${V}`, 'g')],
  ['Spielversion', new RegExp(String.raw`Spielversion:?\s+(?:Alpha\s+)?${V}`, 'g')],
  ['Spielversion', new RegExp(String.raw`Game version:?\s+(?:Alpha\s+)?${V}`, 'g')],
];

const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
const entities = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);

const angabenIn = (text) => {
  const out = [];
  for (const [art, rx] of ANGABE_RX) for (const m of text.matchAll(rx)) {
    out.push({ art, ver: m[1], ctx: text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10).replace(/\s+/g, ' ').trim() });
  }
  return out;
};

const META_KEYS = new Set(['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description']);

// Alle Stand-Angaben einer Seite, je mit Fundort.
const angabenDerSeite = (html, rel) => {
  const out = [];
  const head = html.slice(0, Math.max(0, html.indexOf('</head>')));
  const title = head.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  if (title) for (const a of angabenIn(entities(title))) out.push({ ...a, wo: 'Titel' });
  for (const tag of head.matchAll(/<meta\b[^>]*>/g)) {
    const t = tag[0];
    const key = t.match(/\b(?:name|property)="([^"]+)"/)?.[1];
    const content = t.match(/\bcontent="([^"]*)"/)?.[1];
    if (!key || content == null || !META_KEYS.has(key)) continue;
    for (const a of angabenIn(entities(content))) out.push({ ...a, wo: key });
  }
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let ld;
    try { ld = JSON.parse(block[1]); } catch (e) {
      warn.push(`${rel}: JSON-LD nicht lesbar (${e.message.slice(0, 60)}) — Angaben darin ungeprueft`);
      continue;
    }
    const walk = (o) => {
      if (Array.isArray(o)) { for (const x of o) walk(x); return; }
      if (!o || typeof o !== 'object') return;
      for (const [k, v] of Object.entries(o)) {
        if (typeof v !== 'string') { walk(v); continue; }
        if (k === 'headline' || k === 'description' || k === 'name' || k === 'alternativeHeadline') {
          for (const a of angabenIn(v)) out.push({ ...a, wo: `JSON-LD ${k}` });
        }
      }
    };
    walk(ld);
  }
  const bodyStart = html.indexOf('<body');
  const body = (bodyStart >= 0 ? html.slice(bodyStart) : html)
    // Gross/klein und Leerraum im schliessenden Tag egal, damit kein Skript-
    // oder Stilblock als "sichtbarer Text" durchrutscht; "</script-x>" im
    // Skript beendet den Block nicht.
    .replace(/<script\b[\s\S]*?<\/script(?:\s[^>]*)?>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style(?:\s[^>]*)?>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template(?:\s[^>]*)?>/gi, ' ')
    .replace(/<!--[\s\S]*?--!?>/g, ' ');
  const text = entities(body.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  for (const a of angabenIn(text)) out.push({ ...a, wo: 'Text' });
  return out;
};

const htmlDateien = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.html')) out.push(p);
    }
  };
  walk(dir);
  return out;
};

/* ---------- Lauf ---------- */

console.log('\n=== verify:patch-angaben — nennt jede Datenseite den Stand ihrer Daten? ===');
console.log('Artefakt: dist/ (gebaute Seiten) + committete Datendateien');

console.log('\n[1] Datenstaende');
const fassung = {};
for (const [id, s] of Object.entries(STAENDE)) {
  let kennung = null;
  try { kennung = s.get(rd(s.file)); } catch (e) { fail.push(`${id} (${s.file}): Datei nicht lesbar — ${e.message}`); continue; }
  const f = fassungAus(kennung);
  if (!f) { fail.push(`${id} (${s.file}): Kennung "${kennung}" traegt keine Fassung X.Y.Z — das Tor liefe leer`); continue; }
  fassung[id] = f;
  console.log(`    ${id.padEnd(14)} ${f.padEnd(8)} (${kennung})`);
}

const zaehler = Object.fromEntries(FAMILIEN.map((f) => [f.stand, { seiten: 0, angaben: 0, wo: {}, fassungen: {} }]));
const widersprueche = [];
let seitenGesamt = 0;

if (!existsSync(DIST)) {
  fail.push('dist/ fehlt — erst npm run build; dieses Tor prueft das gebaute Artefakt');
} else {
  const vehicles = rd('src/data/vehicles.json').vehicles;
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const shipPagesOhneVersion = [];

  console.log('\n[2] Stand-Angaben je Seite gegen den Datenstand ihrer Familie');
  for (const file of htmlDateien(DIST)) {
    const rel = relative(DIST, file).split(sep).join('/');
    const pfad = rel.replace(/^de\//, '');
    const fam = FAMILIEN.find((f) => f.match(pfad));
    if (!fam) continue;
    const z = zaehler[fam.stand];
    z.seiten++; seitenGesamt++;
    const html = readFileSync(file, 'utf8');
    const angaben = angabenDerSeite(html, rel);

    // Schiffsseiten: Soll ist der Stempel IHRES Datensatzes.
    let soll = fassung[fam.stand] ?? null;
    let sollQuelle = fam.stand;
    const schiffId = pfad.startsWith('schiffe/') ? pfad.slice('schiffe/'.length, -'.html'.length) : null;
    if (schiffId) {
      const v = vehicleById.get(schiffId);
      if (v) { soll = fassungAus(v.gameVersion) ?? soll; sollQuelle = `Datensatz ${schiffId}`; }
      const label = angaben.some((a) => a.wo === 'Text' && a.art === 'Spielversion');
      if (v && !label) shipPagesOhneVersion.push(rel);
    }

    for (const a of angaben) {
      z.angaben++;
      z.wo[a.wo] = (z.wo[a.wo] ?? 0) + 1;
      z.fassungen[a.ver] = (z.fassungen[a.ver] ?? 0) + 1;
      if (soll == null) continue; // Familie ohne pruefbare Kennung — nur gemeldet
      if (!passt(a.ver, soll)) widersprueche.push({ rel, stand: sollQuelle, soll, ...a });
    }
  }

  for (const w of widersprueche.slice(0, 40)) {
    fail.push(`${w.rel}: ${w.wo} nennt ${w.ver}, die Daten (${w.stand}) stehen auf ${w.soll} — „${w.ctx}“. Angabe aus der Kennung ableiten, nicht von Hand schreiben.`);
  }
  if (widersprueche.length > 40) fail.push(`… und ${widersprueche.length - 40} weitere Widersprueche derselben Art`);

  console.log('\n[3] Schiffe: Spielversion je Seite und Stempel je Datensatz');
  console.log(`    Schiffsseiten ohne sichtbare Spielversion — Soll: 0   Ist: ${shipPagesOhneVersion.length}`);
  for (const p of shipPagesOhneVersion.slice(0, 10)) fail.push(`${p}: zeigt keine Spielversion — das Etikett ist still ausgefallen (Kennungsform nicht erkannt?)`);
  if (shipPagesOhneVersion.length > 10) fail.push(`… und ${shipPagesOhneVersion.length - 10} weitere Schiffsseiten ohne Spielversion`);

  const kopf = fassung.Fahrzeuge;
  let abweichend = 0;
  const ausnahmeGetroffen = new Set();
  const ausnahmeVerletzt = new Set();
  for (const v of vehicles) {
    const f = fassungAus(v.gameVersion);
    if (f === kopf) continue;
    abweichend++;
    const ausnahme = STEMPEL_AUSNAHMEN[v.id];
    if (ausnahme && f === ausnahme.stempel) { ausnahmeGetroffen.add(v.id); continue; }
    if (ausnahme) {
      ausnahmeVerletzt.add(v.id);
      fail.push(`vehicles.json: ${v.id} traegt den Stempel ${JSON.stringify(v.gameVersion ?? null)}, die benannte Ausnahme erlaubt nur ${ausnahme.stempel} — Datensatz pruefen; ist der neue Stempel richtig, Ausnahme anpassen oder entfernen`);
      continue;
    }
    fail.push(`vehicles.json: ${v.id} traegt den Stempel "${v.gameVersion}", der Katalog steht auf ${kopf} — Datensatz neu erzeugen oder als benannte Ausnahme mit Anlass eintragen`);
  }
  console.log(`    Datensaetze: ${vehicles.length}   Stempel abweichend vom Kopf (${kopf}): ${abweichend}   davon benannte Ausnahmen: ${ausnahmeGetroffen.size}`);

  console.log('\n[4] Ausnahmen und Zombie-Waechter');
  for (const id of Object.keys(STEMPEL_AUSNAHMEN)) {
    if (!vehicleById.has(id)) fail.push(`Stempel-Ausnahme "${id}": kein Datensatz mit dieser id — Ausnahme zeigt ins Leere, entfernen`);
    else if (!ausnahmeGetroffen.has(id) && !ausnahmeVerletzt.has(id)) fail.push(`Stempel-Ausnahme "${id}": der Stempel passt wieder zum Katalog — Anlass erledigt, Ausnahme entfernen`);
  }
  console.log(`    Stempel-Ausnahmen: ${Object.keys(STEMPEL_AUSNAHMEN).length}, je mit erlaubtem Stempel ${[...new Set(Object.values(STEMPEL_AUSNAHMEN).map((a) => a.stempel))].join(', ')}   (${ATLS_ANLASS})`);
  for (const [fam, a] of Object.entries(OHNE_KENNUNG)) {
    let besteht = false;
    try { besteht = a.besteht(); } catch (e) { fail.push(`Ausnahme "${fam}": Pruefung nicht ausfuehrbar — ${e.message}`); continue; }
    if (!besteht) fail.push(`Ausnahme "${fam}": die Daten tragen jetzt eine Kennung — Familie in STAENDE aufnehmen, Ausnahme entfernen`);
    const z = zaehler[fam];
    const gesehen = Object.entries(z?.fassungen ?? {}).map(([v, n]) => `${v} ×${n}`).join(', ') || 'keine';
    console.log(`    ${fam}: ohne pruefbare Kennung, Angaben nur gemeldet (${gesehen}) — ${a.anlass}`);
    if (z && z.angaben) warn.push(`${fam}: ${z.angaben} Stand-Angaben (${gesehen}) gegen keine Kennung geprueft — ${a.anlass}`);
  }
}

console.log('\n[5] Selbstauskunft und Klinken');
for (const [fam, z] of Object.entries(zaehler)) {
  const k = KLINKEN[fam] ?? { seiten: 0, angaben: 0 };
  const wo = Object.entries(z.wo).map(([w, n]) => `${w} ${n}`).join(', ') || '—';
  const fs = Object.entries(z.fassungen).map(([v, n]) => `${v} ×${n}`).join(', ') || '—';
  console.log(`    ${fam.padEnd(16)} Seiten ${String(z.seiten).padStart(6)} (Klinke ${k.seiten})   Angaben ${String(z.angaben).padStart(6)} (Klinke ${k.angaben})   genannt: ${fs}`);
  console.log(`    ${''.padEnd(16)} Fundorte: ${wo}`);
  if (z.seiten < k.seiten) fail.push(`${fam}: nur ${z.seiten} Seiten geprueft, Klinke ${k.seiten} — Familien-Zuordnung oder Build kaputt; Ursache klaeren, nicht die Klinke senken`);
  if (z.angaben < k.angaben) fail.push(`${fam}: nur ${z.angaben} Stand-Angaben gefunden, Klinke ${k.angaben} — eine Angabe ist still verschwunden; Ursache klaeren, nicht die Klinke senken`);
}
for (const fam of Object.keys(KLINKEN)) if (!zaehler[fam]) fail.push(`Klinke "${fam}" hat keine Familie — entfernen`);

/* ---------- Schlusszeile ---------- */

for (const w of warn) console.log(`WARNUNG: ${w}`);
if (fail.length) {
  console.error(`\nFAIL (${fail.length}):\n` + fail.map((f) => `  · ${f}`).join('\n') + '\n');
  process.exit(1);
}
const angabenGesamt = Object.values(zaehler).reduce((n, z) => n + z.angaben, 0);
console.log(`\nOK — ${seitenGesamt} Datenseiten, ${angabenGesamt} Stand-Angaben geprueft, 0 Widersprueche · ${Object.keys(STEMPEL_AUSNAHMEN).length + Object.keys(OHNE_KENNUNG).length} Ausnahmen · ${warn.length} Warnungen\n`);
