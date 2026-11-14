// Frischt die Fremdwerte des Fahrzeug-Katalogs aus dem Wiki auf: die zehn
// Felder je Fahrzeug, die in keiner Spieldatei stehen (Block `vehicles` in
// src/data/vehicle-external.json: Pledge-Preis und -Link, Masse, Bild,
// Hoechstcrew, Status, Schwerpunkte). Bis 14.11.2026 war das ein einmal
// eingefrorener Schnappschuss vom 18.07.2026 (build-vehicle-external.mjs).
//
// Quelle: https://api.star-citizen.wiki/api/v2/vehicles (ohne Anmeldung).
// Zuordnung ueber den Slug, der die Fahrzeug-Id ist; einige Gold-Standard-
// Fassungen fuehrt das Wiki als <id>-gs.
//
// Bilder nur vom Host media.starcitizen.tools: nur ihn erlauben die CSP
// (nginx/default.conf, img-src) und die Datenschutzerklaerung. Seit 11/2026
// liefert die API Bilder von cdn.star-citizen.wiki, teils Platzhalter; solche
// bleiben beim alten Bild und werden gemeldet.
//
// Uebernommen wird nur, was plausibel ist. Liefert das Wiki fuer ein Feld
// nichts, wo bisher ein Wert stand, oder springt eine Zahl um mehr als den
// Faktor in GRENZE, bleibt der alte Wert und der Lauf meldet ihn; ein Mensch
// entscheidet.
//
// Benannte Ausnahmen (FALSCH_IM_WIKI): Felder, die das Wiki nachweislich dem
// falschen Fahrzeug zuordnet. Sie werden nicht uebernommen und gemeldet.
//
// Der Zeitstand steht im Feld `source` ("fetchedAt YYYY-MM-DD"), daraus liest
// die Seite das Datum des Schnappschusses.
//
// Aufruf: node scripts/sync-wiki-extern.mjs [--bericht <datei.json>]
//         (npm run sync:wiki-extern; danach datamine:vehicles mischt die Werte ein)
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.star-citizen.wiki/api/v2';
const UA = 'sc-patch-archiv fan site (non-commercial German patch archive)';
const KATALOG = new URL('../src/data/vehicles.json', import.meta.url);
const ZIEL = new URL('../src/data/vehicle-external.json', import.meta.url);
const argOf = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
// Ab welchem Faktor eine Zahl als Sprung gilt (neu/alt oder alt/neu)
const GRENZE = { msrpUSD: 2, lengthM: 1.5, widthM: 1.5, heightM: 1.5, crewMax: 2 };
const FALSCH_IM_WIKI = {
  // Das Wiki fuehrt unter argo-atls-ikti Preis und Store-Link des „ATLS IKTI
  // Akuma" (Nine Tails Shogun Pack). Der ATLS IKTI selbst ist nur ueber einen
  // Wikelo-Vertrag erhaeltlich und hat keinen Store-Eintrag (14.11.2026).
  'argo-atls-ikti': { felder: ['msrpUSD', 'pledgeUrl'], grund: 'Wiki fuehrt hier Preis und Store-Link des ATLS IKTI Akuma' },
  // Die Collector-Lackierungen gibt es nur als Belohnung eines Wikelo-Vertrags
  // (ContractGenerator.TheCollector); das Wiki setzt Preis und Store-Link des
  // Basis-ATLS ein (SKU „ATLS", $40).
  'argo-atls-geo-collector-grad01': { felder: ['msrpUSD', 'pledgeUrl'], grund: 'Wikelo-Belohnung, Wiki fuehrt Preis und Store-Link des Basis-ATLS' },
  'argo-atls-geo-collector-grad03': { felder: ['msrpUSD', 'pledgeUrl'], grund: 'Wikelo-Belohnung, Wiki fuehrt Preis und Store-Link des Basis-ATLS' },
};

const loc = (x) => (x == null ? null : typeof x === 'string' ? x : x.de_DE ?? x.en_EN ?? null);

// MediaWiki-Vorschaubilder sind ueber die Breite adressierbar; ab der
// Originalbreite gibt es keins (404), dann das Original.
function bild(img) {
  if (!img) return null;
  const at = (w) => {
    if (!img.thumbnail_url) return img.original_url ?? null;
    if (img.original_width && w >= img.original_width) return img.original_url ?? img.thumbnail_url;
    return img.thumbnail_url.replace(/\/\d+px-/, `/${w}px-`);
  };
  return { hero: at(1280), thumb: at(320), source: 'starcitizen.tools' };
}

const BILD_HOST = 'media.starcitizen.tools';
const erlaubtesBild = (img) => [img.hero, img.thumb].every((u) => { try { return new URL(u).host === BILD_HOST; } catch { return false; } });

function felder(v) {
  const foci = Array.isArray(v.foci) ? v.foci : v.foci ? [v.foci] : [];
  return {
    msrpUSD: v.msrp ?? null,
    pledgeUrl: v.pledge_url ?? null,
    lengthM: v.dimension?.length ?? null,
    widthM: v.dimension?.width ?? null,
    heightM: v.dimension?.height ?? null,
    image: bild(Array.isArray(v.images) ? v.images[0] : v.images),
    crewMax: v.crew?.max ?? null,
    statusEn: v.production_status?.en_EN ?? null,
    statusDe: loc(v.production_status),
    fociDe: foci.map(loc).filter(Boolean),
  };
}

const alle = [];
let wikiVersion = null;
for (let n = 1; ; n++) {
  const r = await fetch(`${API}/vehicles?limit=50&page=${n}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`sync-wiki-extern: ${r.status} ${r.statusText} auf Seite ${n}`);
  const j = await r.json();
  alle.push(...j.data);
  if (n >= j.meta.last_page) break;
  await new Promise((s) => setTimeout(s, 400));
}
if (alle.length < 200) throw new Error(`sync-wiki-extern: nur ${alle.length} Fahrzeuge geliefert — Schnappschuss bleibt, nichts geschrieben`);
for (const v of alle) if (v.version) wikiVersion = v.version;
const bySlug = new Map(alle.map((v) => [v.slug, v]));

const katalog = JSON.parse(readFileSync(KATALOG, 'utf8')).vehicles;
const ext = JSON.parse(readFileSync(ZIEL, 'utf8'));
const heute = new Date().toISOString().slice(0, 10);
const bericht = { geholt: alle.length, wikiVersion, geaendert: [], neu: [], behalten: [], ohneWiki: [] };
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const k of katalog) {
  const w = bySlug.get(k.id) ?? bySlug.get(`${k.id}-gs`);
  if (!w) { bericht.ohneWiki.push(k.id); continue; }
  const neu = felder(w);
  const falsch = FALSCH_IM_WIKI[k.id];
  for (const feld of falsch?.felder ?? []) {
    if (neu[feld] != null) bericht.behalten.push({ id: k.id, feld, vorher: null, wiki: neu[feld], grund: falsch.grund });
    neu[feld] = null;
  }
  const alt = ext.vehicles[k.id];
  if (!alt) {
    if (neu.image && !erlaubtesBild(neu.image)) { bericht.behalten.push({ id: k.id, feld: 'image', vorher: null, wiki: neu.image, grund: 'Bild von einem Host ausserhalb von CSP und Datenschutzerklaerung' }); neu.image = null; }
    ext.vehicles[k.id] = Object.fromEntries(Object.entries(neu).filter(([, x]) => x != null && !(Array.isArray(x) && !x.length)));
    bericht.neu.push({ id: k.id, ...ext.vehicles[k.id] });
    continue;
  }
  for (const [feld, wert] of Object.entries(neu)) {
    const vorher = alt[feld] ?? null;
    if (gleich(vorher, wert)) continue;
    if (feld === 'image' && wert && !erlaubtesBild(wert)) { bericht.behalten.push({ id: k.id, feld, vorher, wiki: wert, grund: 'Bild von einem Host ausserhalb von CSP und Datenschutzerklaerung' }); continue; }
    const leer = wert == null || (Array.isArray(wert) && !wert.length);
    if (leer && falsch?.felder.includes(feld)) { delete alt[feld]; continue; }
    if (leer && vorher != null) { bericht.behalten.push({ id: k.id, feld, vorher, wiki: wert, grund: 'Wiki liefert nichts' }); continue; }
    const g = GRENZE[feld];
    if (g && typeof vorher === 'number' && typeof wert === 'number' && vorher > 0 && (wert <= 0 || Math.max(wert / vorher, vorher / wert) > g)) {
      bericht.behalten.push({ id: k.id, feld, vorher, wiki: wert, grund: `Sprung ueber Faktor ${g}` });
      continue;
    }
    alt[feld] = wert;
    bericht.geaendert.push({ id: k.id, feld, vorher, nachher: wert });
  }
}

ext.source = `src/data/vehicles.json (Wiki-Schnappschuss, fetchedAt ${heute}, Wiki-Datenstand ${wikiVersion ?? 'unbekannt'}) — aufgefrischt von scripts/sync-wiki-extern.mjs`;
ext.generatedAt = heute;
ext.count = Object.keys(ext.vehicles).length;
writeFileSync(ZIEL, JSON.stringify(ext, null, 2) + '\n');

const datei = argOf('--bericht');
if (datei) writeFileSync(datei, JSON.stringify(bericht, null, 1));
const schiffe = new Set(bericht.geaendert.map((x) => x.id));
console.log(`sync-wiki-extern: ${alle.length} Fahrzeuge geholt (${wikiVersion}), ${bericht.geaendert.length} Werte an ${schiffe.size} Fahrzeugen geaendert, ${bericht.neu.length} Fahrzeuge neu, ${bericht.behalten.length} Werte behalten (gemeldet), ohne Wiki-Eintrag: ${bericht.ohneWiki.join(', ') || '—'}`);
for (const b of bericht.behalten) console.log(`  behalten ${b.id}.${b.feld}: ${JSON.stringify(b.vorher)} (Wiki: ${JSON.stringify(b.wiki)}) — ${b.grund}`);
