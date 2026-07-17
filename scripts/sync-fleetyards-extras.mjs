// FleetYards extras sync — 3D holo files, paints/skins, variants and loaners
// for the ship data sheets. Same blueprint as the other syncs: fetch ->
// normalize -> committed snapshot; the live site never calls the API.
//
// Usage:  npm run sync:extras   (manual "build button" — run on patch day)
// Source: https://api.fleetyards.net/v1 (public, CORS *):
//   /models?perPage=200&page=n   list carries scIdentifier/name/slug/holo/hasPaints/loaners
//   /models/{slug}/paints        [{name, media.storeImage.url}]
//   /models/{slug}/variants      {items:[...]}  (paginated object!)
//
// Join: FY `scIdentifier` ("aegs_gladius_pir") == unsere vehicle-id mit "-"
// statt "_". Beide Kataloge leiten ihre IDs aus demselben RSI-internen
// Bezeichner ab -> exakter, sprachfreier Schlüssel. Der frühere Join lief über
// den Anzeigenamen und verlor 12 Schiffe an redaktionelle Wortdreher ("A2
// Hercules" vs. unser "A2 Hercules Starlifter", "Ares Inferno" vs. "Ares Star
// Fighter Inferno"). Gemessen gegen den Katalog: Name 200, slug 150,
// scIdentifier 212 Treffer — bei null Widersprüchen und als echte Obermenge
// von beidem, deshalb ist hier kein Namens-Fallback und keine Alias-Liste mehr.
//
// Holo files are Draco-compressed glTF blobs served with
// Access-Control-Allow-Origin:* — the viewer loads them client-side on demand.
// Fail-safe: fewer than 40 matched ships never overwrites the snapshot.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.fleetyards.net/v1';
const OUT = new URL('../src/data/ship-extras.json', import.meta.url);
const UA = 'sc-patch-archiv fan site (non-commercial German patch archive)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json();
}

// Lack-/BIS-Editionen: das Spiel führt sie als eigenständige Fahrzeuge, FleetYards
// nur als Lackierung des Basisschiffs — ein eigenes Holo existiert dort nicht.
// Die Geometrie ist dieselbe (Maße + DPS bei allen 13 gegen die Basis geprüft),
// und holo-viewer.js ersetzt beim Laden JEDES Material durch das Holo-Material:
// der Lack wird ohnehin verworfen, das Bild ist pixelgleich zum eigenen Mesh.
// Sie erben deshalb das Holo der Basis, nachvollziehbar über `holoFrom`.
// Bewusst NICHT hier: anvl-lightning-f8 (F8A) — FY führt nur die F8C, und das
// ist eine andere Variante, keine Lackierung.
const PAINT_BASE = {
  // FY hat zwar ein eigenes Modell samt Holo für die Gladius Pirate Edition,
  // aber dessen Mesh ist kaputt skaliert (Extents 5–7x der Hull, in sich
  // inkonsistent -> Kalibrierung nur conf:low). Die Pirate ist eine Lackierung
  // der Gladius (Hull identisch), deshalb erzwungen aufs intakte Basis-Mesh
  // (kalibriert high). Steht darum auch in FORCE_BASE.
  'aegs-gladius-pir': 'aegs-gladius',
  'orig-600i-bis2951': 'orig-600i',
  'argo-atls-geo-collector-grad01': 'argo-atls-geo',
  'argo-atls-geo-collector-grad03': 'argo-atls-geo',
  'anvl-ballista-dunestalker': 'anvl-ballista',
  'anvl-ballista-snowblind': 'anvl-ballista',
  'anvl-carrack-expedition': 'anvl-carrack',
  'drak-caterpillar-pirate': 'drak-caterpillar',
  'rsi-constellation-phoenix-emerald': 'rsi-constellation-phoenix',
  'anvl-hornet-f7cm-mk2-heartseeker': 'anvl-hornet-f7cm-mk2',
  'aegs-hammerhead-showdown': 'aegs-hammerhead',
  'cnou-mustang-alpha-citizencon2018': 'cnou-mustang-alpha',
  'krig-p72-archimedes-emerald': 'krig-p72-archimedes',
  'aegs-reclaimer-showdown': 'aegs-reclaimer',
};

const cat = JSON.parse(await readFile(new URL('../src/data/vehicles.json', import.meta.url), 'utf8'));
const catIds = new Set(cat.vehicles.map((v) => v.id));

/** FY-Modell -> unsere vehicle-id, oder null wenn wir das Schiff nicht führen */
const ourId = (m) => {
  const id = String(m?.scIdentifier ?? '').toLowerCase().replace(/_/g, '-');
  return catIds.has(id) ? id : null;
};

// full model list (paginated)
const models = [];
for (let page = 1; ; page++) {
  const r = await get(`/models?perPage=200&page=${page}`);
  const items = Array.isArray(r) ? r : (r.items ?? []);
  models.push(...items);
  if (items.length < 200) break;
  await sleep(120);
}
console.log(`FleetYards: ${models.length} Modelle geladen.`);

const bySlug = new Map(models.map((m) => [m.slug, m]));
/** Querverweise (loaners/variants) tragen teils nur {slug,name} -> über die Liste auflösen */
const refId = (ref) => ourId(ref) ?? ourId(bySlug.get(ref.slug));

const extras = {};
const misses = [];
for (const m of models) {
  const id = ourId(m);
  if (!id) {
    misses.push(m.name);
    continue;
  }
  extras[id] = {
    fySlug: m.slug,
    holo: m.holo ?? null,
    storeImage: m.media?.storeImage?.url ?? null,
    paints: [],
    variants: [],
    loaners: (m.loaners ?? []).map((l) => ({ name: l.name, id: refId(l) })),
    _hasPaints: !!m.hasPaints,
  };
}

// paints + variants for matched ships (variants only via per-model endpoint)
const ids = Object.keys(extras);
let done = 0;
for (const id of ids) {
  const e = extras[id];
  try {
    if (e._hasPaints) {
      const p = await get(`/models/${e.fySlug}/paints`);
      const items = Array.isArray(p) ? p : (p.items ?? []);
      e.paints = items
        .map((x) => ({ name: x.name, image: x.media?.storeImage?.url ?? null }))
        .filter((x) => x.image);
      await sleep(100);
    }
    const v = await get(`/models/${e.fySlug}/variants`);
    const vitems = Array.isArray(v) ? v : (v.items ?? []);
    e.variants = vitems.map((x) => ({ name: x.name, id: refId(x) }));
  } catch (err) {
    console.warn(`  warn ${e.fySlug}: ${err.message}`);
  }
  delete e._hasPaints;
  done++;
  if (done % 40 === 0) console.log(`  ...${done}/${ids.length}`);
  await sleep(100);
}

// Lack-Editionen erben das Holo ihrer Basis (siehe PAINT_BASE).
// FORCE_BASE: hier gewinnt die Basis auch DANN, wenn FY ein eigenes Holo hat
// (bekannt kaputte FY-Meshes, Begründung am PAINT_BASE-Eintrag).
const FORCE_BASE = new Set(['aegs-gladius-pir']);
let inherited = 0;
for (const [id, baseId] of Object.entries(PAINT_BASE)) {
  if (!catIds.has(id)) {
    console.warn(`  warn PAINT_BASE: "${id}" steht nicht mehr im Katalog — Eintrag entfernen?`);
    continue;
  }
  if (extras[id]?.holo && !FORCE_BASE.has(id)) continue; // FY führt das Schiff selbst -> Vorrang
  const base = extras[baseId];
  if (!base?.holo) {
    console.warn(`  warn PAINT_BASE: Basis "${baseId}" hat kein Holo — "${id}" bleibt ohne.`);
    continue;
  }
  extras[id] = {
    // FY kennt die Edition gar nicht -> kein fySlug, keine eigene Quellseite.
    // Führt FY sie doch (nur ohne Holo-Datei), bleiben deren echte Felder stehen.
    fySlug: null,
    storeImage: null,
    paints: [],
    variants: [],
    loaners: [],
    ...extras[id],
    holo: base.holo,
    holoFrom: baseId,
  };
  inherited++;
}

const holoCount = Object.values(extras).filter((e) => e.holo).length;
const withPaints = Object.values(extras).filter((e) => e.paints.length).length;
const withVariants = Object.values(extras).filter((e) => e.variants.length).length;
const matched = Object.keys(extras).length;
console.log(
  `Gematcht: ${matched}/${cat.vehicles.length} Schiffe · Holo: ${holoCount} (davon ${inherited} von der Basis geerbt) · mit Paints: ${withPaints} · mit Varianten: ${withVariants}`
);
if (misses.length) console.log(`Nicht gematcht (FY-Namen, erwartbar bei Konzept-/Sondermodellen): ${misses.length}`);
const noHolo = cat.vehicles.filter((v) => !extras[v.id]?.holo);
if (noHolo.length) console.log(`Ohne Holo: ${noHolo.map((v) => v.id).join(', ')}`);

if (ids.length < 40) {
  console.error(`FAIL-SAFE: nur ${ids.length} Schiffe gematcht — Snapshot NICHT überschrieben.`);
  process.exit(1);
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString().slice(0, 10),
      source: 'FleetYards.net',
      matched,
      holoCount,
      holoInherited: inherited,
      extras,
    },
    null,
    1
  )
);
console.log('Snapshot geschrieben: src/data/ship-extras.json');
