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
//   6  Datenstand-Baustein am Seitenende: jede Zeile gegen ihre Datendatei
//      (seit 06.11.2026, Erlaeuterung beim Block).
//   7  Patch-Dossier: die Schiffstabelle zeigt die Werte der eigenen
//      Schiffsseite, die Quellenzeile darunter nennt deren Stand (seit
//      06.11.2026, Erlaeuterung beim Block).
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
// 06.11.2026: der Datenstand-Baustein [6] nennt auf jeder Datenseite die
// Spielversion — Items 66.274 -> 77.322, Crafting 16.480 -> 20.196, Mining
// 14 -> 16, Missionen 0 -> 2.774 (bisher ohne jede Angabe), Refinery 1 -> 3.
// Die Klinken ziehen nach oben nach.
const KLINKEN = {
  'Item-Katalog': { seiten: 11000, angaben: 77000 },
  Crafting: { seiten: 3300, angaben: 20000 },
  Mining: { seiten: 4, angaben: 16 },
  Missionen: { seiten: 2700, angaben: 2700 },
  Fahrzeuge: { seiten: 464, angaben: 464 },
  Refinery: { seiten: 2, angaben: 3 },
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

/* ---------- [6] Datenstand-Baustein ---------- */
//
// Seit 06.11.2026 (Bestandsaufnahme C, Freigabe Krisz) traegt jede Datenseite
// am Ende den Baustein „Datenstand" (src/components/Datenstand.astro, Zeilen
// aus src/lib/datenstand.ts): je Wertegruppe Herkunft und Stand. Dieser Block
// liest ihn im gebauten Stand und haelt jede Zeile gegen IHRE Datendatei —
// unabhaengig vom Seitencode (eigene Monatsnamen, eigene Fassungsvergleiche).
//
// FEHLER (Handlung immer richtig: neu bauen bzw. Zeile aus der Datei ableiten):
//   · eine Seite der Liste traegt den Baustein nicht oder doppelt,
//   · nach dem Baustein steht bis zur naechsten Fusszeile noch sichtbarer
//     Inhalt (er gehoert ans Ende des Inhalts),
//   · eine Pflichtzeile fehlt, eine fremde Zeile steht drin,
//   · eine Wertegruppe steht auf der Seite, ihre Zeile fehlt (oder umgekehrt):
//     Kaufpreise und Fundorte an den Marken data-stand-q bzw. den Preisfeldern,
//     auf Schiffsseiten Lackierungen, Varianten, Leihschiffe und 3D-Huelle an
//     ihrem Markup. Nicht nachgerechnet: Wiki-Zeile und Bildquelle der
//     Schiffsseiten (beide haengen an Feldern, die nur der Seitencode
//     zusammenfuehrt; ihre Form wird trotzdem geprueft),
//   · Art, Wert oder sichtbarer Text einer Zeile passen nicht zur Datei —
//     Wertegruppe, Quellname, Link und Wortlaut je Sprache, wortgleich,
//   · „älterer Stand" steht ohne Tatsache da oder fehlt trotz Tatsache,
//   · ein ISO-Datum steht im sichtbaren Text (Datum in Seitensprache),
//   · eine Detailseite (Item, Blueprint, Mission, Schiff) traegt nicht genau
//     einen Link „Falschen Wert melden“ auf das Formular ihrer Sprache mit
//     ihrem eigenen Pfad, oder eine andere Seite traegt einen.
// NIE FEHLER: das Alter einer Fremdquelle (Grundsatz 3) — es wird nur
// genannt. Eine Altersgrenze waere eine erfundene Schwelle.

const MONATE = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const datumIn = (iso, lang) => {
  const [y, m, d] = iso.split('-').map(Number);
  return lang === 'de' ? `${d}. ${MONATE.de[m - 1]} ${y}` : `${MONATE.en[m - 1]} ${d}, ${y}`;
};
const vor = (a, b) => {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
};
const isoDatum = (v) => (typeof v === 'string' ? /^\d{4}-\d{2}-\d{2}/.exec(v)?.[0] ?? null : null);

const STAND_GRUPPEN = [
  { name: 'Item-Seiten', match: (p) => p === 'items.html' || p.startsWith('items/') || p === 'armor-sets.html', pflicht: ['items'], erlaubt: ['items', 'uex-items', 'fundorte'], bedingt: ['uex-items', 'fundorte'] },
  // Der Finder rendert seine Karten im Browser; er zeigt alle drei Gruppen.
  { name: 'Item-Finder', match: (p) => p === 'item-finder.html', pflicht: ['items', 'uex-items', 'fundorte'], erlaubt: ['items', 'uex-items', 'fundorte'] },
  { name: 'Blueprint-Seiten', match: (p) => p === 'crafting.html' || p.startsWith('crafting/'), pflicht: ['crafting'], erlaubt: ['crafting'] },
  { name: 'Missionsseiten', match: (p) => p.startsWith('missionen/'), pflicht: ['missionen'], erlaubt: ['missionen'] },
  { name: 'Schiffsseiten', match: (p) => p.startsWith('schiffe/'), pflicht: ['fahrzeug', 'uex-schiffe'], erlaubt: ['fahrzeug', 'uex-schiffe', 'huelle', 'fleetyards', 'wiki', 'bild'], bedingt: ['huelle', 'fleetyards'] },
  { name: 'Refinery', match: (p) => p === 'refinery.html', pflicht: ['refinery', 'uex-erze', 'ausbeute'], erlaubt: ['refinery', 'uex-erze', 'ausbeute'] },
  { name: 'Mining-Datenbank', match: (p) => p === 'topics/mining.html', pflicht: ['mining', 'ausbeute'], erlaubt: ['mining', 'ausbeute'] },
];
// Klinken je Gruppe (Grundsatz 5), Messlauf 06.11.2026 im Live-Bau der
// Baustein-Aenderung. Nur nach OBEN; nach unten nur per Commit mit Ursache.
const STAND_KLINKEN = {
  // Gemessen: Items 11.044, Blueprints 3.342, Missionen 2.774, Schiffe 462,
  // Refinery 2, Mining 2, Item-Finder 2 (seit der Review-Korrektur). Grosse
  // Gruppen knapp darunter (ein Datenlauf darf ein paar Seiten streichen),
  // kleine genau auf dem Messwert.
  'Item-Seiten': 11000, 'Item-Finder': 2, 'Blueprint-Seiten': 3300, Missionsseiten: 2700, Schiffsseiten: 462, Refinery: 2, 'Mining-Datenbank': 2,
};
// Detailseiten mit Melde-Link (C2, 06.11.2026), Messlauf im Live-Bau der
// Melde-Aenderung: 17.190 (Items, Blueprints, Schiffe, Missionen, je DE und
// EN). Knapp darunter, ein Datenlauf darf ein paar Seiten streichen.
const MELDE_KLINKE = 17000;
const MELDE_DETAIL = /^(?:items|crafting|schiffe|missionen)\/[^/]+\.html$/;
const MELDE_TEXT = { de: 'Falschen Wert melden', en: 'Report a wrong value' };
let meldeSeiten = 0;

// Wortlaut je Zeile und Sprache, unabhaengig von src/lib/datenstand.ts
// gefuehrt: das Tor soll eine falsch etikettierte Zeile fangen, nicht den
// Seitencode noch einmal ausfuehren. [de, en].
const STAND_WAS = {
  items: ['Spielwerte', 'Game values'], 'uex-items': ['Kaufpreise', 'Purchase prices'], fundorte: ['Fundorte', 'Loot locations'],
  crafting: ['Rezepte und Drop-Chancen', 'Recipes and drop chances'], missionen: ['Missionsdaten', 'Mission data'],
  fahrzeug: ['Werte und Bewaffnung', 'Stats and loadout'], 'uex-schiffe': ['Ingame-Preise', 'In-game prices'],
  huelle: ['3D-Hülle', '3D hull'], wiki: ['Pledge-Preis, Maße, Crew, Status', 'Pledge price, dimensions, crew, status'], bild: ['Bild', 'Image'],
  refinery: ['Spielwerte', 'Game values'], mining: ['Spielwerte', 'Game values'],
  'uex-erze': ['Erzpreise', 'Ore prices'], ausbeute: ['Ausbeute je Station', 'Yield per station'],
};
// FleetYards-Zeile: die Wertegruppe zaehlt auf, was die Seite von dort zeigt.
const FY_TEILE = [['lackierungen', 'Lackierungen', 'paints'], ['varianten', 'Varianten', 'variants'], ['leihschiffe', 'Leihschiffe', 'loaners'], ['huelle', '3D-Hülle', '3D hull']];
const UEX_NAME = ['UEX Corp', 'https://uexcorp.space'];
const STAND_NAME = { 'uex-items': UEX_NAME, 'uex-schiffe': UEX_NAME, 'uex-erze': UEX_NAME, fleetyards: ['FleetYards', 'https://fleetyards.net'], wiki: ['starcitizen.tools', 'https://starcitizen.tools'] };
// Zeilen ohne Stand: fester Text (bild nennt die Bildquelle des Datensatzes).
const STAND_QUELLTEXT = { fundorte: ['eigene Recherche', 'own research'], huelle: ['eigene Aufbereitung', 'processed in-house'] };
const SERIE_TITEL = { varianten: ['Varianten der Baureihe', 'Variants of the series'], leihschiffe: ['Loaner (bis zur Flugfreigabe)', 'Loaners (until flight-ready)'] };

console.log('\n[6] Datenstand-Baustein: jede Zeile gegen ihre Datendatei');
const standSoll = {};
const standFehler = [];
const standSeiten = Object.fromEntries(STAND_GRUPPEN.map((g) => [g.name, 0]));
const standZeilen = {};
try {
  const items = rd('assets/universal-items.json');
  const ext = rd('src/data/vehicle-external.json');
  const ref = rd('assets/refinery-data.json');
  const quellen = {
    items: { art: 'spiel', wert: fassung['Item-Katalog'], datei: 'assets/universal-items.json gameVersion' },
    crafting: { art: 'spiel', wert: fassung.Crafting, datei: 'assets/crafting-db.json version' },
    missionen: { art: 'spiel', wert: fassung.Missionen, datei: 'src/data/missions.json meta.patch' },
    fahrzeug: { art: 'spiel', wert: null, datei: 'Stempel des Fahrzeug-Datensatzes (src/data/vehicles.json)' },
    mining: { art: 'spiel', wert: fassung.Mining, datei: 'assets/mining-db.json game_version' },
    refinery: { art: 'spiel', wert: fassung.Refinery, datei: 'assets/refinery-data.json meta.gameVersion' },
    'uex-items': { art: 'fremd', wert: isoDatum(items.pricesAsOf), datei: 'assets/universal-items.json pricesAsOf', name: 'UEX Item-Preise' },
    'uex-schiffe': { art: 'fremd', wert: isoDatum(rd('src/data/vehicle-prices.json').fetchedAt), datei: 'src/data/vehicle-prices.json fetchedAt', name: 'UEX Schiffspreise' },
    'uex-erze': { art: 'fremd', wert: isoDatum(ref.meta?.priceDate), datei: 'assets/refinery-data.json meta.priceDate', name: 'UEX Erzpreise' },
    fleetyards: { art: 'fremd', wert: isoDatum(rd('src/data/ship-extras.json').fetchedAt), datei: 'src/data/ship-extras.json fetchedAt', name: 'FleetYards' },
    wiki: { art: 'schnappschuss', wert: /fetchedAt (\d{4}-\d{2}-\d{2})/.exec(ext.source ?? '')?.[1] ?? null, datei: 'src/data/vehicle-external.json source', name: 'Wiki-Schnappschuss' },
    ausbeute: { art: 'hand', wert: fassungAus(rd('assets/mining-frozen.json').frozen_from), datei: 'assets/mining-frozen.json frozen_from' },
    fundorte: { art: 'quelle', wert: null },
    huelle: { art: 'quelle', wert: null },
    bild: { art: 'quelle', wert: null },
  };
  for (const [k, q] of Object.entries(quellen)) {
    standSoll[k] = q;
    if (q.art !== 'quelle' && k !== 'fahrzeug' && !q.wert) fail.push(`[6] ${k}: ${q.datei} liefert keinen Stand — der Baustein liefe gegen nichts`);
  }
} catch (e) {
  fail.push(`[6] Datendateien fuer den Datenstand nicht lesbar — ${e.message}`);
}

if (existsSync(DIST) && Object.keys(standSoll).length) {
  const vehicles = rd('src/data/vehicles.json');
  const kopfFahrzeug = fassungAus(vehicles.gameVersion);
  const stempel = new Map(vehicles.vehicles.map((v) => [v.id, fassungAus(v.gameVersion)]));
  // Tags weg, bis nichts mehr wegfaellt: ein verschachtelter Rest wie
  // "<scr<b></b>ipt>" bliebe nach einem einzigen Durchgang stehen.
  const ohneTags = (h) => {
    let s = h;
    let vorher;
    do {
      vorher = s;
      s = s.replace(/<[^>]+>/g, '');
    } while (s !== vorher);
    return s;
  };
  const sichtbar = (h) => entities(ohneTags(h)).replace(/\s+/g, ' ').trim();
  for (const file of htmlDateien(DIST)) {
    const rel = relative(DIST, file).split(sep).join('/');
    const pfad = rel.replace(/^de\//, '');
    const g = STAND_GRUPPEN.find((x) => x.match(pfad));
    if (!g) continue;
    const lang = rel.startsWith('de/') ? 'de' : 'en';
    const html = readFileSync(file, 'utf8');
    // Seiten ohne eigenen Inhalt (Weiterleitungen) tragen keinen Baustein.
    if (/<meta http-equiv="refresh"/i.test(html.slice(0, 2000))) continue;
    standSeiten[g.name]++;
    const bloecke = [...html.matchAll(/<section class="vb-stand[^"]*"[^>]*>([\s\S]*?)<\/section>/g)];
    if (bloecke.length !== 1) { standFehler.push(`${rel}: ${bloecke.length === 0 ? 'kein' : bloecke.length + '×'} Datenstand-Baustein (Soll: genau einer)`); continue; }
    const innen = bloecke[0][1];
    const L = lang === 'de';
    const sp = L ? 0 : 1;
    // Lage: der Baustein schliesst den Inhalt ab. Bis zur naechsten
    // Fusszeile (Datenhuelle: ihr eigener Fuss, sonst footer.site-attr) steht
    // nichts Sichtbares mehr; Skripte und Daten zaehlen nicht.
    const nachher = html.slice(bloecke[0].index + bloecke[0][0].length);
    const fussAb = nachher.search(/<footer\b|<\/body>/);
    const rest = sichtbar((fussAb >= 0 ? nachher.slice(0, fussAb) : nachher)
      // Endtags auch mit Leerraum oder Attributen („</script >"), sonst
      // bliebe ein so geschlossenes Skript als sichtbarer Text stehen.
      .replace(/<script\b[\s\S]*?<\/script\b[^>]*>/gi, ' ').replace(/<style\b[\s\S]*?<\/style\b[^>]*>/gi, ' ').replace(/<template\b[\s\S]*?<\/template\b[^>]*>/gi, ' '));
    if (rest) standFehler.push(`${rel}: nach dem Datenstand steht noch Inhalt („${rest.slice(0, 60)}") — der Baustein gehoert ans Ende des Inhalts`);
    const text = sichtbar(innen);
    const iso = /\b\d{4}-\d{2}-\d{2}\b/.exec(text);
    if (iso) standFehler.push(`${rel}: ISO-Datum ${iso[0]} im sichtbaren Datenstand — Datum in Seitensprache setzen`);
    const zeilen = [...innen.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => ({
      quelle: /\bdata-stand="([^"]*)"/.exec(m[1])?.[1] ?? null,
      art: /\bdata-stand-art="([^"]*)"/.exec(m[1])?.[1] ?? null,
      wert: /\bdata-stand-wert="([^"]*)"/.exec(m[1])?.[1] ?? null,
      was: sichtbar(/<span class="vb-stand__was"[^>]*>([\s\S]*?)<\/span>/.exec(m[2])?.[1] ?? ''),
      link: /<a\b[^>]*\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(m[2]),
      text: sichtbar(m[2]),
    }));
    // Welche bedingten Zeilen die Seite braucht, aus dem, was sie zeigt.
    const aussen = html.slice(0, bloecke[0].index) + nachher;
    const soll = new Set();
    let fyTeile = [];
    if (g.bedingt?.includes('uex-items')) {
      if (/\sdata-stand-q="uex-items"/.test(aussen) || /class="dp-price"/.test(aussen)) soll.add('uex-items');
      if (/\sdata-stand-q="fundorte"/.test(aussen)) soll.add('fundorte');
    }
    if (g.bedingt?.includes('fleetyards')) {
      let holo = null;
      const hj = /<script type="application\/json" id="holodata"[^>]*>([\s\S]*?)<\/script>/.exec(html);
      if (hj) { try { holo = JSON.parse(hj[1]); } catch { standFehler.push(`${rel}: #holodata nicht lesbar`); } }
      const zeigt = {
        lackierungen: /class="sd__paints"/.test(aussen),
        varianten: aussen.includes(`<h4 class="sd__sub">${SERIE_TITEL.varianten[sp]}</h4>`),
        leihschiffe: aussen.includes(`<h4 class="sd__sub">${SERIE_TITEL.leihschiffe[sp]}</h4>`),
        // ohne eigenes Modell (mesh) zeigt die Bühne die Hülle von FleetYards
        huelle: !!holo?.url && !holo.mesh,
      };
      if (holo?.mesh) soll.add('huelle');
      fyTeile = FY_TEILE.filter(([k]) => zeigt[k]).map((t) => t[1 + sp]);
      if (fyTeile.length) soll.add('fleetyards');
    }
    const gesehen = new Set();
    const spielWert = zeilen.find((z) => standSoll[z.quelle]?.art === 'spiel')?.wert ?? null;
    for (const z of zeilen) {
      standZeilen[z.quelle] = (standZeilen[z.quelle] ?? 0) + 1;
      const q = standSoll[z.quelle];
      if (!q) { standFehler.push(`${rel}: Zeile mit unbekannter Quelle ${JSON.stringify(z.quelle)} — in src/lib/datenstand.ts und hier eintragen`); continue; }
      if (!g.erlaubt.includes(z.quelle)) standFehler.push(`${rel}: Zeile „${z.quelle}" gehoert nicht auf ${g.name}`);
      if (gesehen.has(z.quelle)) standFehler.push(`${rel}: Zeile „${z.quelle}" doppelt`);
      gesehen.add(z.quelle);
      if (g.bedingt?.includes(z.quelle) && !soll.has(z.quelle)) standFehler.push(`${rel}: Zeile „${z.quelle}" steht im Datenstand, die Seite zeigt diese Werte aber nicht`);
      if (z.art !== q.art) standFehler.push(`${rel}: Zeile „${z.quelle}" ist als ${z.art} ausgezeichnet, Soll ${q.art}`);
      let sollWert = q.wert;
      if (z.quelle === 'fahrzeug') sollWert = stempel.get(pfad.slice('schiffe/'.length, -'.html'.length)) ?? null;
      let aelterSoll = false;
      // Wertegruppe, Quellname und Link
      let was = STAND_WAS[z.quelle]?.[sp] ?? null;
      if (z.quelle === 'fleetyards') { const w = fyTeile.join(', '); was = w.charAt(0).toUpperCase() + w.slice(1); }
      if (was && z.was !== `${was}:`) standFehler.push(`${rel}: Zeile „${z.quelle}" heisst „${z.was}", Soll „${was}:"`);
      const name = STAND_NAME[z.quelle] ?? null;
      if (name) {
        const istName = z.link ? sichtbar(z.link[2]) : null;
        if (istName !== name[0] || z.link?.[1] !== name[1]) standFehler.push(`${rel}: Zeile „${z.quelle}" nennt die Quelle ${JSON.stringify(istName)} → ${JSON.stringify(z.link?.[1] ?? null)}, Soll „${name[0]}" → ${name[1]}`);
      } else if (z.link) standFehler.push(`${rel}: Zeile „${z.quelle}" traegt einen Link, Soll ohne`);
      // Wortlaut nach der Wertegruppe
      let kern = null;
      if (q.art === 'spiel') {
        kern = `${L ? 'Spielversion' : 'Game version'} ${sollWert}`;
        aelterSoll = z.quelle === 'fahrzeug' && !!sollWert && !!kopfFahrzeug && vor(sollWert, kopfFahrzeug);
      } else if (q.art === 'fremd') {
        kern = sollWert ? `${name?.[0]}, ${L ? 'Stand' : 'as of'} ${datumIn(sollWert, lang)}` : null;
      } else if (q.art === 'schnappschuss') {
        kern = sollWert ? `${name?.[0]}, ${L ? 'Schnappschuss vom' : 'snapshot of'} ${datumIn(sollWert, lang)}` : null;
        aelterSoll = true;
      } else if (q.art === 'hand') {
        kern = `${L ? 'von Hand gepflegt, Stand' : 'maintained by hand, as of'} ${sollWert}`;
        aelterSoll = !!spielWert && !!sollWert && vor(sollWert, spielWert);
      } else if (STAND_QUELLTEXT[z.quelle]) {
        kern = STAND_QUELLTEXT[z.quelle][sp];
      }
      if (q.art !== 'quelle') {
        if (sollWert == null) { standFehler.push(`${rel}: Zeile „${z.quelle}" ohne Sollwert (${q.datei})`); continue; }
        if (z.wert !== sollWert) standFehler.push(`${rel}: Zeile „${z.quelle}" nennt ${JSON.stringify(z.wert)}, ${q.datei} steht auf ${sollWert}`);
      }
      const marke = L ? 'älterer Stand' : 'older data';
      const aelterIst = z.text.endsWith(marke);
      if (aelterIst !== aelterSoll) standFehler.push(`${rel}: Zeile „${z.quelle}" ${aelterIst ? 'traegt „älterer Stand" ohne Tatsache' : 'liegt hinter den Spielwerten der Seite, das Etikett „älterer Stand" fehlt'} — „${z.text}"`);
      const istKern = (aelterIst ? z.text.slice(0, -marke.length) : z.text).trim().slice(z.was.length).trim();
      if (kern != null ? istKern !== kern : !istKern) standFehler.push(`${rel}: Zeile „${z.quelle}" zeigt „${z.text}", Soll „${z.was} ${kern ?? '(Bildquelle)'}"`);
    }
    for (const p of g.pflicht) if (!gesehen.has(p)) standFehler.push(`${rel}: Pflichtzeile „${p}" fehlt im Datenstand`);
    for (const p of soll) if (!gesehen.has(p)) standFehler.push(`${rel}: die Seite zeigt ${p === 'uex-items' ? 'Kaufpreise' : p === 'fundorte' ? 'Loot-Fundorte' : p === 'huelle' ? 'die eigene 3D-Hülle' : `Werte von FleetYards (${fyTeile.join(', ')})`}, die Zeile „${p}" fehlt im Datenstand`);
    // Link „Falschen Wert melden“: genau einer auf Detailseiten, sonst keiner.
    const melde = [...innen.matchAll(/<a\b[^>]*\sdata-ev-melden\b[^>]*>([\s\S]*?)<\/a>/g)];
    if (MELDE_DETAIL.test(pfad)) {
      if (melde.length !== 1) standFehler.push(`${rel}: ${melde.length} Links „Falschen Wert melden" im Datenstand (Soll: genau einer auf Detailseiten)`);
      else {
        meldeSeiten++;
        // href wie der Browser ihn liest: Astro schreibt & als &#38;.
        const ziel = (/\shref="([^"]*)"/.exec(melde[0][0])?.[1] ?? null)?.replace(/&(?:amp|#38|#x26);/gi, '&') ?? null;
        const sollZiel = `${lang === 'de' ? '/de' : ''}/feedback.html?wert=/${rel}`;
        if (ziel !== sollZiel) standFehler.push(`${rel}: Link „Falschen Wert melden" zeigt auf ${JSON.stringify(ziel)}, Soll ${JSON.stringify(sollZiel)}`);
        if (sichtbar(melde[0][1]) !== MELDE_TEXT[lang]) standFehler.push(`${rel}: Link „Falschen Wert melden" heisst „${sichtbar(melde[0][1])}", Soll „${MELDE_TEXT[lang]}"`);
      }
    } else if (melde.length) standFehler.push(`${rel}: Link „Falschen Wert melden" auf einer Seite, die keine Detailseite ist`);
  }
  for (const f of standFehler.slice(0, 40)) fail.push(`[6] ${f}`);
  if (standFehler.length > 40) fail.push(`[6] … und ${standFehler.length - 40} weitere Befunde derselben Art`);

  for (const g of STAND_GRUPPEN) {
    const k = STAND_KLINKEN[g.name] ?? 0;
    console.log(`    ${g.name.padEnd(17)} Seiten ${String(standSeiten[g.name]).padStart(6)} (Klinke ${k})`);
    if (standSeiten[g.name] < k) fail.push(`[6] ${g.name}: nur ${standSeiten[g.name]} Seiten mit Datenstand geprueft, Klinke ${k} — Zuordnung oder Build kaputt; Ursache klaeren, nicht die Klinke senken`);
  }
  console.log(`    Detailseiten mit Link „Falschen Wert melden": ${meldeSeiten} (Klinke ${MELDE_KLINKE})`);
  if (meldeSeiten < MELDE_KLINKE) fail.push(`[6] nur ${meldeSeiten} Detailseiten mit Link „Falschen Wert melden", Klinke ${MELDE_KLINKE} — Ursache klaeren, nicht die Klinke senken`);
  console.log(`    Zeilen je Quelle: ${Object.entries(standZeilen).map(([q, n]) => `${q} ${n}`).join(', ') || '—'}`);
  // Alter der Fremdquellen: nur genannt, nie bewertet (Grundsatz 3).
  let gebaut = null;
  try { gebaut = isoDatum(JSON.parse(readFileSync(resolve(DIST, 'build.json'), 'utf8')).gebautAm); } catch { /* ohne Baustempel: Alter gegen heute */ }
  const bezug = gebaut ?? new Date().toISOString().slice(0, 10);
  for (const [k, q] of Object.entries(standSoll)) {
    if (!q.name || !q.wert) continue;
    const tage = Math.round((Date.parse(bezug) - Date.parse(q.wert)) / 864e5);
    console.log(`    Stand ${q.name.padEnd(18)} ${q.wert}, ${tage} Tage vor ${gebaut ? 'dem Bau' : 'heute'} (nur zur Kenntnis)`);
  }
}

/* ---------- [7] Patch-Dossier: Schiffswerte wie auf der Schiffsseite ---------- */
//
// Seit 06.11.2026 (C1b, Freigabe Krisz „Wie empfohlen"): die Schiffstabelle im
// Dossier der Patch-Seiten zeigt Crew, Fracht und Pledge-Preis aus dem eigenen
// Katalog (src/data/vehicles.json), formatiert wie auf der Schiffsseite. Davor
// kamen sie aus einem FleetYards-Schnappschuss und widersprachen der eigenen
// Schiffsseite in 27 von 88 Werten (Hammerhead 40 gegen 64 SCU, MOTH 32 gegen
// 224 SCU, Idris-M Mindestcrew 8 gegen 28).
//
// FEHLER (Handlung immer richtig: Wert aus vehicles.json ableiten, neu bauen):
//   · eine Zeile mit eigener Schiffsseite zeigt einen anderen Wert als der
//     Datensatz dieser Seite (Crew „min–max", Fracht in Seitensprache, Pledge
//     in Dollar),
//   · eine Zeile ohne eigene Schiffsseite zeigt einen Wert (eine Tabelle, eine
//     Quelle — fuer sie bleibt nur der Link),
//   · die Quellenzeile unter der Tabelle fehlt, obwohl die Tabelle eigene
//     Werte zeigt, oder steht ohne sie da; sie nennt eine andere Spielversion
//     als die Stempel der gezeigten Datensaetze, die Wiki-Zeile fehlt, obwohl
//     ein Pledge-Preis oder eine Hoechstcrew dasteht (oder umgekehrt), ein
//     Wortlaut, Datum oder Etikett weicht ab, oder FleetYards steht als
//     Quelle der Werte da.
const DOSSIER_SEITE = /^(?:de\/)?patches\/[^/]+\.html$/;
// Klinken, Messlauf 06.11.2026 im Live-Bau der Aenderung: 34 Patch-Seiten
// mit Schiffstabelle (17 je Sprache), 64 Zeilen, davon 56 mit eigener
// Schiffsseite. Nur nach OBEN; nach unten nur per Commit mit Ursache.
const DOSSIER_KLINKEN = { seiten: 34, zeilen: 64, eigene: 56 };
const DOSSIER_TEXT = {
  vorsatz: ['Schiffswerte wie auf den Schiffsseiten.', 'Ship values as on the ship pages.'],
  fahrzeug: ['Fracht, Mindestcrew', 'Cargo, minimum crew'],
  wiki: ['Pledge-Preis, Höchstcrew', 'Pledge price, maximum crew'],
};
console.log('\n[7] Patch-Dossier: Schiffswerte gegen den eigenen Katalog');
if (existsSync(DIST)) {
  const dz = { seiten: 0, zeilen: 0, eigene: 0 };
  const dFehler = [];
  try {
    const vehicles = rd('src/data/vehicles.json');
    const kopf = fassungAus(vehicles.gameVersion);
    const byId = new Map(vehicles.vehicles.map((v) => [v.id, v]));
    const ext = rd('src/data/vehicle-external.json');
    const wikiDatum = /fetchedAt (\d{4}-\d{2}-\d{2})/.exec(ext.source ?? '')?.[1] ?? null;
    if (!wikiDatum) dFehler.push('src/data/vehicle-external.json nennt kein fetchedAt — die Wiki-Zeile liefe gegen nichts');
    const nackt = (h) => {
      let x = h;
      let vorher;
      do { vorher = x; x = x.replace(/<[^>]+>/g, ''); } while (x !== vorher);
      return entities(x).replace(/\s+/g, ' ').trim();
    };
    const crew = (v) => (v.crewMin == null && v.crewMax == null ? '—'
      : v.crewMin != null && v.crewMax != null && v.crewMax !== v.crewMin ? `${v.crewMin}–${v.crewMax}` : `${v.crewMin ?? v.crewMax}`);
    for (const file of htmlDateien(DIST)) {
      const rel = relative(DIST, file).split(sep).join('/');
      if (!DOSSIER_SEITE.test(rel)) continue;
      const html = readFileSync(file, 'utf8');
      const tab = /<table class="do__table"[^>]*>([\s\S]*?)<\/table>/.exec(html);
      if (!tab) continue;
      dz.seiten++;
      const lang = rel.startsWith('de/') ? 'de' : 'en';
      const sp = lang === 'de' ? 0 : 1;
      const loc = lang === 'de' ? 'de-DE' : 'en-US';
      const body = /<tbody[^>]*>([\s\S]*?)<\/tbody>/.exec(tab[1])?.[1] ?? '';
      const gezeigt = [];
      let wikiGezeigt = false;
      for (const tr of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
        dz.zeilen++;
        const td = [...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
        if (td.length !== 6) { dFehler.push(`${rel}: Tabellenzeile mit ${td.length} Zellen, Soll 6`); continue; }
        const name = nackt(td[0]).replace(/[↗*]/g, '').trim();
        const ist = [nackt(td[2]), nackt(td[3]), nackt(td[4])];
        const eigen = /<a class="do__shiplink" href="(?:\/de)?\/schiffe\/([^"/]+)\.html"/.exec(td[0]);
        if (!eigen) {
          if (ist.some((x) => x !== '—')) dFehler.push(`${rel}: ${name} hat keine eigene Schiffsseite, zeigt aber Werte (${ist.join(' / ')}) — Soll „—", nur der Link`);
          continue;
        }
        const v = byId.get(eigen[1]);
        if (!v) { dFehler.push(`${rel}: ${name} verlinkt /schiffe/${eigen[1]}.html, den vehicles.json nicht kennt`); continue; }
        dz.eigene++;
        gezeigt.push(v);
        if (v.msrpUSD != null || v.crewMax != null) wikiGezeigt = true;
        const soll = [
          crew(v),
          v.cargoSCU != null ? `${v.cargoSCU.toLocaleString(loc)} SCU` : '—',
          v.msrpUSD != null ? `$${v.msrpUSD.toLocaleString('en-US')}` : '—',
        ];
        ['Crew', 'Fracht', 'Pledge'].forEach((was, i) => {
          if (ist[i] !== soll[i]) dFehler.push(`${rel}: ${name} ${was} „${ist[i]}", der Datensatz ${v.id} (wie die Schiffsseite) sagt „${soll[i]}"`);
        });
      }
      // Quellenzeile unter der Tabelle
      const nachTab = html.slice(tab.index + tab[0].length, tab.index + tab[0].length + 4000);
      const src = /^\s*(?:<\/div>\s*)?<p class="do__specsrc"[^>]*>([\s\S]*?)<\/p>/.exec(nachTab);
      if (!gezeigt.length) {
        if (src) dFehler.push(`${rel}: Quellenzeile unter einer Tabelle ohne eigene Werte`);
        continue;
      }
      if (!src) { dFehler.push(`${rel}: die Tabelle zeigt eigene Werte, die Quellenzeile darunter fehlt`); continue; }
      const text = nackt(src[1]);
      if (/fleetyards/i.test(text)) dFehler.push(`${rel}: Quellenzeile nennt FleetYards — die Werte kommen aus dem eigenen Katalog`);
      if (!text.startsWith(DOSSIER_TEXT.vorsatz[sp])) dFehler.push(`${rel}: Quellenzeile beginnt „${text.slice(0, 40)}", Soll „${DOSSIER_TEXT.vorsatz[sp]}"`);
      const iso = /\b\d{4}-\d{2}-\d{2}\b/.exec(text);
      if (iso) dFehler.push(`${rel}: ISO-Datum ${iso[0]} in der Quellenzeile — Datum in Seitensprache setzen`);
      // Je Angabe ein <span data-stand…>; ihr Text reicht bis zur naechsten
      // Angabe (Trenner „·" faellt weg) bzw. bis zum Ende der Zeile.
      const starts = [...src[1].matchAll(/<span\b([^>]*\bdata-stand="[^"]*"[^>]*)>/g)];
      const teile = starts.map((m, i) => {
        const stueck = src[1].slice(m.index + m[0].length, i + 1 < starts.length ? starts[i + 1].index : undefined);
        return {
          quelle: /\bdata-stand="([^"]*)"/.exec(m[1])?.[1],
          art: /\bdata-stand-art="([^"]*)"/.exec(m[1])?.[1] ?? null,
          wert: /\bdata-stand-wert="([^"]*)"/.exec(m[1])?.[1] ?? null,
          link: /<a\b[^>]*\shref="([^"]*)"/.exec(stueck)?.[1] ?? null,
          text: nackt(stueck).replace(/\s*·\s*$/, ''),
        };
      });
      const fassungen = [...new Set(gezeigt.map((v) => fassungAus(v.gameVersion)))];
      const marke = sp === 0 ? 'älterer Stand' : 'older data';
      const sollTeile = fassungen.map((f) => ({
        quelle: 'fahrzeug', art: 'spiel', wert: f, link: null,
        text: `${DOSSIER_TEXT.fahrzeug[sp]}: ${sp === 0 ? 'Spielversion' : 'Game version'} ${f}${kopf && vor(f, kopf) ? ` ${marke}` : ''}`,
      }));
      if (wikiGezeigt && wikiDatum) sollTeile.push({
        quelle: 'wiki', art: 'schnappschuss', wert: wikiDatum, link: 'https://starcitizen.tools',
        text: `${DOSSIER_TEXT.wiki[sp]}: starcitizen.tools, ${sp === 0 ? 'Schnappschuss vom' : 'snapshot of'} ${datumIn(wikiDatum, lang)} ${marke}`,
      });
      const key = (x) => `${x.quelle}|${x.wert}`;
      const istMap = new Map(teile.map((x) => [key(x), x]));
      if (teile.length !== istMap.size) dFehler.push(`${rel}: Quellenzeile nennt eine Angabe doppelt`);
      for (const sx of sollTeile) {
        const ix = istMap.get(key(sx));
        if (!ix) { dFehler.push(`${rel}: Quellenzeile ohne „${sx.text}" (${sx.quelle} ${sx.wert})`); continue; }
        if (ix.text !== sx.text) dFehler.push(`${rel}: Quellenzeile zeigt „${ix.text}", Soll „${sx.text}"`);
        if (ix.art !== sx.art) dFehler.push(`${rel}: Quellenzeile ${sx.quelle} ${sx.wert} hat data-stand-art ${JSON.stringify(ix.art)}, Soll "${sx.art}"`);
        if (ix.link !== sx.link) dFehler.push(`${rel}: Quellenzeile ${sx.quelle} verlinkt ${JSON.stringify(ix.link)}, Soll ${JSON.stringify(sx.link)}`);
        istMap.delete(key(sx));
      }
      for (const ix of istMap.values()) dFehler.push(`${rel}: Quellenzeile nennt „${ix.text}" (${ix.quelle} ${ix.wert}), die Tabelle zeigt dazu keine Werte`);
    }
  } catch (e) {
    dFehler.push(`Datendateien nicht lesbar — ${e.message}`);
  }
  for (const f of dFehler.slice(0, 30)) fail.push(`[7] ${f}`);
  if (dFehler.length > 30) fail.push(`[7] … und ${dFehler.length - 30} weitere Befunde derselben Art`);
  console.log(`    Patch-Seiten mit Schiffstabelle ${dz.seiten} (Klinke ${DOSSIER_KLINKEN.seiten})   Zeilen ${dz.zeilen} (Klinke ${DOSSIER_KLINKEN.zeilen})   davon mit eigener Schiffsseite ${dz.eigene} (Klinke ${DOSSIER_KLINKEN.eigene})`);
  for (const [k, n] of Object.entries(DOSSIER_KLINKEN)) {
    if (dz[k] < n) fail.push(`[7] Patch-Dossier: nur ${dz[k]} ${k === 'seiten' ? 'Seiten' : k === 'zeilen' ? 'Zeilen' : 'Zeilen mit eigener Schiffsseite'} geprueft, Klinke ${n} — Zuordnung oder Build kaputt; Ursache klaeren, nicht die Klinke senken`);
  }
}

/* ---------- Schlusszeile ---------- */

for (const w of warn) console.log(`WARNUNG: ${w}`);
if (fail.length) {
  console.error(`\nFAIL (${fail.length}):\n` + fail.map((f) => `  · ${f}`).join('\n') + '\n');
  process.exit(1);
}
const angabenGesamt = Object.values(zaehler).reduce((n, z) => n + z.angaben, 0);
console.log(`\nOK — ${seitenGesamt} Datenseiten, ${angabenGesamt} Stand-Angaben geprueft, 0 Widersprueche · ${Object.keys(STEMPEL_AUSNAHMEN).length + Object.keys(OHNE_KENNUNG).length} Ausnahmen · ${warn.length} Warnungen\n`);
