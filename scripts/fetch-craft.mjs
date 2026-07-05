// fetch-craft.mjs — Snapshot der sc-craft.tools Blueprint-DB.
// Zieht alle ownable Blueprints (Version LIVE 4.8) + Ressourcen + Versionen,
// trimmt die Felder und schreibt deterministisch nach public/assets/crafting-db.json.
//
//   node scripts/fetch-craft.mjs
//
// Quelle: https://sc-craft.tools/ (BETA-Community-DB, aus CIG-Spieldateien) — patch-volatil.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Kanonisches Media-Verzeichnis ist /assets (wird per _sync-assets.mjs nach
// public/assets gespiegelt; public/assets ist gitignored).
const OUT = resolve(__dirname, '..', 'assets', 'crafting-db.json');

const BASE = 'https://sc-craft.tools';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, Accept: 'application/json,*/*' };

// Datum wird via Umgebungsvariable gestempelt (Skript soll deterministisch bleiben).
const SNAP_DATE = process.env.SNAP_DATE || '2026-07-05';

async function getJSON(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

const r = (n, p = 4) => (n == null ? null : Math.round(Number(n) * 10 ** p) / 10 ** p);

// Nur die für die Seite genutzten Felder behalten; GUIDs/loc_keys wegwerfen.
function trimIngredient(ing) {
  const out = { slot: ing.slot ?? ing.name ?? null };
  if (Array.isArray(ing.options)) {
    out.options = ing.options.map((o) => ({
      name: o.name,
      quantity_scu: r(o.quantity_scu ?? o.quantity),
      min_quality: o.min_quality ?? null,
    }));
  }
  if (Array.isArray(ing.quality_effects) && ing.quality_effects.length) {
    out.quality_effects = ing.quality_effects.map((q) => ({
      stat: q.stat,
      quality_min: q.quality_min,
      quality_max: q.quality_max,
      modifier_at_min: r(q.modifier_at_min),
      modifier_at_max: r(q.modifier_at_max),
      multiplicative: q.type === 'multiplicative' || !!q.multiplicative,
    }));
  }
  return out;
}

function trimBlueprint(b) {
  const out = {
    name: b.name,
    category: b.category ?? null,
    craft_time_seconds: b.craft_time_seconds ?? null,
  };
  if (b.tiers != null) out.tiers = b.tiers;
  if (b.item_stats && typeof b.item_stats === 'object' && Object.keys(b.item_stats).length)
    out.item_stats = b.item_stats;
  if (Array.isArray(b.ingredients) && b.ingredients.length)
    out.ingredients = b.ingredients.map(trimIngredient);
  if (Array.isArray(b.missions) && b.missions.length)
    out.missions = b.missions.map((m) => ({
      id: m.mission_id ?? null,
      name: m.name,
      drop_chance: m.drop_chance == null ? null : r(m.drop_chance),
    }));
  return out;
}

async function fetchAllBlueprints(version) {
  const limit = 100;
  let page = 1;
  const all = [];
  let total = Infinity;
  while (all.length < total) {
    const url = `${BASE}/api/blueprints?page=${page}&limit=${limit}&version=${encodeURIComponent(
      version
    )}&ownable=true`;
    const data = await getJSON(url);
    const items = data.blueprints || data.data || data.items || [];
    if (data.pagination && typeof data.pagination.total === 'number') total = data.pagination.total;
    if (!items.length) break;
    all.push(...items);
    process.stdout.write(`\r  blueprints ${all.length}/${Number.isFinite(total) ? total : '?'}   `);
    page++;
    if (page > 100) break; // Sicherheitsnetz
  }
  process.stdout.write('\n');
  return all;
}

function pickLiveVersion(versions) {
  const arr = Array.isArray(versions) ? versions : versions.versions || versions.data || [];
  // Bevorzuge einen LIVE-Eintrag zu 4.8; sonst der erste.
  const norm = arr.map((v) => (typeof v === 'string' ? { name: v } : v));
  const live = norm.find((v) => /live/i.test(v.name || v.version || '') && /4\.8/.test(v.name || v.version || ''));
  const any48 = norm.find((v) => /4\.8/.test(v.name || v.version || ''));
  const chosen = live || any48 || norm[0];
  return { chosen: chosen?.version || chosen?.name, all: norm };
}

async function main() {
  console.log('Versionen …');
  const versionsRaw = await getJSON(`${BASE}/api/versions`);
  const { chosen, all: versionList } = pickLiveVersion(versionsRaw);
  const version = chosen || 'LIVE 4.8';
  console.log(`  gewählte Version: ${version}`);

  console.log('Blueprints …');
  const rawBps = await fetchAllBlueprints(version);
  const blueprints = rawBps.map(trimBlueprint).sort((a, b) => a.name.localeCompare(b.name));

  console.log('Ressourcen …');
  const resourcesRaw = await getJSON(`${BASE}/api/resources`);
  const resArr = Array.isArray(resourcesRaw)
    ? resourcesRaw
    : resourcesRaw.resources || resourcesRaw.data || [];
  const resources = resArr
    .map((r) => {
      const out = { name: r.name };
      if (r.used_in_blueprints != null) out.used_in_blueprints = r.used_in_blueprints;
      // Mining-Standorte nur behalten, falls vorhanden.
      if (r.locations) out.locations = r.locations;
      if (r.mining_locations) out.mining_locations = r.mining_locations;
      return out;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    source: 'sc-craft.tools',
    source_url: 'https://sc-craft.tools/',
    source_note:
      'Snapshot der Community-DB sc-craft.tools (BETA, aus CIG-Spieldateien). Patch-volatil — ingame prüfen.',
    version,
    snapshot_date: SNAP_DATE,
    counts: { blueprints: blueprints.length, resources: resources.length },
    versions: versionList.map((v) => v.version || v.name).filter(Boolean),
    blueprints,
    resources,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
  console.log(`\nGeschrieben: ${OUT}`);
  console.log(`  ${blueprints.length} Blueprints, ${resources.length} Ressourcen, ~${kb} KB`);
}

main().catch((e) => {
  console.error('\nFEHLER:', e.message);
  process.exit(1);
});
