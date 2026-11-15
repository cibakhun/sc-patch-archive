/* ============================================================
   render-patch-bilder.mjs — Schiffsbilder einer Patchseite aus den Hangar-Modellen.

   WARUM: Die Patchseite 4.10.3 braucht je Schiff ein gleichartiges Bild und
   eine Holo-Fassung, ohne fremde Werbebilder. Dieselbe Ansicht wie die
   Dock-Karten (render-hangar-cards.mjs), nur groesser, dazu ein Holo aus
   derselben Kamera und eine Kopfszene aus den Vanduul-Modellen.

   WAS: je Schiff des Satzes unter assets/<satz>/render/
     <id>.webp, <id>-640.webp            schraeg von vorn, transparent
     <id>-holo.webp, <id>-holo-640.webp  Holo, deckungsgleich zum Bild
   die Szene als <szene>.webp (1920) und <szene>-1200.webp, und das Verzeichnis
   src/data/<satz>/bilder-render.json. Die Dock-Karten bleiben unberuehrt.

   WIE (Schiene C, braucht Chromium mit WebGL):
     node scripts/render-patch-bilder.mjs --satz patch-4-10-3
     node scripts/render-patch-bilder.mjs --satz patch-4-10-3 --only rsi-galaxy,vanduul-szene
     node scripts/render-patch-bilder.mjs --satz patch-4-10-3 --nur-verzeichnis   (nur Alt-Texte/JSON)
   Rund 5 min fuer den ganzen Satz (SwiftShader).
   ============================================================ */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { openRenderer, dropSpecks, png, VIEW, CARD } from './render-hangar-cards.mjs';

const ROOT = process.cwd();
const BILD = { w: 1120, h: 630, klein: 640 };
const RENDER = { w: 2240, h: 1260 };
const WEBP = { quality: 80, alphaQuality: 85, effort: 6 };
// Beim Holo traegt die Deckkraft das ganze Bild: mit 85 waere es fast doppelt so schwer, ohne sichtbaren Gewinn.
const WEBP_HOLO = { quality: 78, alphaQuality: 70, effort: 6 };

const SAETZE = {
  'patch-4-10-3': {
    schiffe: ['rsi-galaxy', 'anvl-liberator', 'aegs-tiburon', 'misc-starlite', 'drak-ironclad', 'drak-pitbull', 'drak-ironclad-assault',
      'glsn-basher', 'orig-m80', 'gama-tyilui', 'anvl-carrack', 'anvl-carrack-expedition', 'misc-starlancer-max', 'misc-starlancer-tac',
      'rsi-perseus', 'aegs-hammerhead', 'aegs-reclaimer', 'argo-moth', 'drak-vulture', 'misc-fortune', 'rsi-salvation', 'aegs-vanguard',
      'aegs-vanguard-hoplite', 'aegs-vanguard-sentinel', 'aegs-vanguard-harbinger', 'rsi-polaris', 'drak-corsair', 'anvl-ballista',
      'anvl-spartan', 'anvl-centurion', 'rsi-constellation-phoenix', 'vncl-blade', 'vncl-glaive', 'vncl-scythe', 'vncl-stinger'],
    ohneModell: ['argo-atls-geo-collector-grad02', 'argo-atls-ikti', 'argo-atls-geo-ikti', 'argo-atls-geo-ikti-ntls', 'vncl-mauler'],
    szene: {
      key: 'vanduul-szene', thema: 'vanduul-incursion', w: 1920, klein: 1200,
      alt: { de: 'Vanduul-Schiffe im Anflug: eine Scythe vorn, weitere Vanduul-Schiffe dahinter vor einem dunklen Nebel', en: 'Vanduul ships on approach: a Scythe up front, more Vanduul ships behind it against a dark nebula' },
      schiffe: [
        // Alle in derselben Lage wie die Karten (az 140, el 18 von der Kamera aus), die Begleiter weiter hinten links.
        { id: 'vncl-scythe', pos: [0, 0, 0], rot: [0, 0, 6] },
        { id: 'vncl-glaive', pos: [-41.5, -4.1, 101.7], rot: [0, 0, 5] },
        { id: 'vncl-stinger', pos: [-16, -43.4, 160.2], rot: [0, 0, -4] },
        { id: 'vncl-glaive', pos: [-119.6, -23.2, 172.8], rot: [0, 0, -6] },
      ],
      view: {
        cam: [34, 14.7, -41.5], target: [9.4, -0.8, -0.1], fov: 32, exposure: 1.25, env: 0.22,
        lights: [[0xa8d4ff, 6, [1, 3, 5]], [0xff4a26, 1.8, [3, -2, -2]], [0x8a9ab8, 1.4, [-2, 3, -3]]],
      },
    },
  },
};

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] ?? '' : null; };
const satzName = arg('--satz');
const satz = SAETZE[satzName];
if (!satz) { console.error(`render-patch-bilder: --satz ${Object.keys(SAETZE).join('|')} angeben`); process.exit(2); }
const alle = [...satz.schiffe, ...(satz.szene ? [satz.szene.key] : [])];
const only = arg('--only')?.split(',').filter(Boolean) ?? null;
const unknown = (only ?? []).filter((id) => !alle.includes(id));
if (unknown.length) { console.error(`render-patch-bilder: unbekannte Id ${unknown.join(', ')}`); process.exit(2); }
const todo = only ?? alle;
const nurVerzeichnis = process.argv.includes('--nur-verzeichnis');

const OUT = path.join(ROOT, 'assets', satzName, 'render');
const DATA = path.join(ROOT, 'src/data', satzName, 'bilder-render.json');
const WEB = `/assets/${satzName}/render`;
const vehicles = JSON.parse(readFileSync(path.join(ROOT, 'src/data/vehicles.json'), 'utf8')).vehicles;

const HERSTELLER_KURZ = { 'Roberts Space Industries': 'RSI', 'Anvil Aerospace': 'Anvil', 'Aegis Dynamics': 'Aegis', 'Drake Interplanetary': 'Drake', 'Origin Jumpworks': 'Origin', 'Argo Astronautics': 'Argo', 'Gatac Manufacture': 'Gatac' };

/** „RSI Galaxy“, „MISC Starlite“: Hersteller vorn, ausser der Name traegt ihn schon. */
function anzeige(id) {
  const v = vehicles.find((x) => x.id === id);
  if (!v) throw new Error(`${id} fehlt in vehicles.json`);
  // Die Modelle der Seite zeigen Vanduul-Schiffe; die Daten fuehren sie als Esperia-Nachbau.
  if (id.startsWith('vncl-')) return `Vanduul ${v.name.replace(/^Vanduul /, '')}`;
  if (v.name.startsWith(`${v.makerCode} `)) return v.name;
  return `${HERSTELLER_KURZ[v.manufacturer] ?? v.manufacturer} ${v.name}`;
}

const groessen = (key, w, h, klein) => [
  { w, h, src: `${WEB}/${key}.webp` },
  { w: klein, h: Math.round((h * klein) / w), src: `${WEB}/${key}-${klein}.webp` },
];

async function schreibe(key, bild, w, h, klein, webp) {
  const gross = await sharp(bild).webp(webp).toBuffer();
  const kl = await sharp(bild).resize(klein, Math.round((h * klein) / w), { kernel: 'lanczos3' }).webp(webp).toBuffer();
  await writeFile(path.join(OUT, `${key}.webp`), gross);
  await writeFile(path.join(OUT, `${key}-${klein}.webp`), kl);
  return gross.length + kl.length;
}

/**
 * Holo auf Schwarz -> Licht auf transparent: Deckkraft = hellster Kanal, Farbe
 * zurueckgeteilt. Nur wo das bereinigte Foto etwas zeigt (leicht geweitet),
 * damit dieselben losen Teile fehlen.
 */
async function lichtAufTransparent(buf, foto) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const maske = await sharp(foto).ensureAlpha().extractChannel(3).blur(2).threshold(1).raw().toBuffer();
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const a = Math.max(data[i], data[i + 1], data[i + 2]);
    if (!a || !maske[j / 4]) continue;
    out[j] = Math.round((data[i] * 255) / a); out[j + 1] = Math.round((data[i + 1] * 255) / a); out[j + 2] = Math.round((data[i + 2] * 255) / a); out[j + 3] = a;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

const leer = (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

async function schiff(R, id) {
  const r = await R.page.evaluate(([u, az, el, w, h]) => window.pair(u, az, el, w, h), [`/hangar/ships/${id}.glb`, VIEW.az, VIEW.el, RENDER.w, RENDER.h]);
  const shot = await dropSpecks(png(r.shot), 0.02);
  const { data: trimmed, info } = await sharp(shot.buf).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const region = { left: -info.trimOffsetLeft, top: -info.trimOffsetTop, width: info.width, height: info.height };
  const k = Math.min((BILD.w * (1 - 2 * CARD.pad)) / info.width, (BILD.h * (1 - 2 * CARD.pad)) / info.height);
  const size = [Math.max(1, Math.round(info.width * k)), Math.max(1, Math.round(info.height * k))];
  const fit = async (b) => leer(BILD.w, BILD.h).composite([{ input: await sharp(b).resize(...size, { kernel: 'lanczos3' }).toBuffer(), gravity: 'centre' }]).png().toBuffer();
  const holo = await sharp(await lichtAufTransparent(png(r.holo), shot.buf)).extract(region).toBuffer();
  const bytes = await schreibe(id, await fit(trimmed), BILD.w, BILD.h, BILD.klein, WEBP) + await schreibe(`${id}-holo`, await fit(holo), BILD.w, BILD.h, BILD.klein, WEBP_HOLO);
  return { bytes, dropped: shot.dropped };
}

/** Dunkler Raum mit schwachem Nebel und Sternen, deterministisch. */
function himmel(W, H) {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sterne = Array.from({ length: 260 }, () => `<circle cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * H).toFixed(1)}" r="${(0.4 + rnd() ** 3 * 1.4).toFixed(2)}" fill="#fff" opacity="${(0.15 + rnd() * 0.55).toFixed(2)}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<radialGradient id="a" cx="0.72" cy="0.28" r="0.6"><stop offset="0" stop-color="#3a1630" stop-opacity="0.85"/><stop offset="0.55" stop-color="#1a0b1e" stop-opacity="0.45"/><stop offset="1" stop-color="#05060a" stop-opacity="0"/></radialGradient>
<radialGradient id="b" cx="0.18" cy="0.78" r="0.55"><stop offset="0" stop-color="#0d2a3e" stop-opacity="0.7"/><stop offset="1" stop-color="#05060a" stop-opacity="0"/></radialGradient>
<radialGradient id="c" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/></radialGradient>
</defs>
<rect width="100%" height="100%" fill="#05060a"/><rect width="100%" height="100%" fill="url(#a)"/><rect width="100%" height="100%" fill="url(#b)"/>${sterne}<rect width="100%" height="100%" fill="url(#c)"/>
</svg>`);
}

async function szene(R, sz) {
  const H = Math.round((sz.w * 9) / 16);
  const items = sz.schiffe.map((s) => ({ url: `/hangar/ships/${s.id}.glb`, pos: s.pos, rot: s.rot }));
  const ships = png(await R.page.evaluate(([i, v, w, h]) => window.scene(i, v, w, h), [items, sz.view, sz.w, H]));
  const bild = await sharp(himmel(sz.w, H)).composite([{ input: ships }]).png().toBuffer();
  const gross = await sharp(bild).webp({ quality: 78, effort: 6 }).toBuffer();
  const kl = await sharp(bild).resize(sz.klein, Math.round((H * sz.klein) / sz.w), { kernel: 'lanczos3' }).webp({ quality: 78, effort: 6 }).toBuffer();
  await writeFile(path.join(OUT, `${sz.key}.webp`), gross);
  await writeFile(path.join(OUT, `${sz.key}-${sz.klein}.webp`), kl);
  return gross.length + kl.length;
}

function eintraege(id) {
  if (satz.szene?.key === id) {
    const sz = satz.szene, H = Math.round((sz.w * 9) / 16);
    return [{ key: id, art: 'szene', thema: sz.thema, alt: sz.alt, groessen: groessen(id, sz.w, H, sz.klein) }];
  }
  const name = anzeige(id);
  return [
    { key: id, art: 'render', thema: id, alt: { de: `Modell der ${name}, schräg von vorn`, en: `Model of the ${name}, front three-quarter view` }, groessen: groessen(id, BILD.w, BILD.h, BILD.klein) },
    { key: `${id}-holo`, art: 'holo', thema: id, alt: { de: `Hologramm der ${name}, schräg von vorn`, en: `Hologram of the ${name}, front three-quarter view` }, groessen: groessen(`${id}-holo`, BILD.w, BILD.h, BILD.klein) },
  ];
}

await mkdir(OUT, { recursive: true });
await mkdir(path.dirname(DATA), { recursive: true });
const prev = existsSync(DATA) ? JSON.parse(await readFile(DATA, 'utf8')).bilder : [];
const bilder = new Map(prev.map((b) => [b.key, b]));
const ordnung = alle.flatMap((id) => (id === satz.szene?.key ? [id] : [id, `${id}-holo`]));
const saveData = () => writeFile(DATA, `${JSON.stringify({ bilder: [...bilder.values()].sort((a, b) => ordnung.indexOf(a.key) - ordnung.indexOf(b.key)) }, null, 2)}\n`);

if (nurVerzeichnis) {
  for (const id of todo) if (satz.szene?.key === id || existsSync(path.join(OUT, `${id}.webp`))) for (const e of eintraege(id)) bilder.set(e.key, e);
  await saveData();
  console.log(`render-patch-bilder: nur Verzeichnis, ${bilder.size} Eintraege in ${path.relative(ROOT, DATA)}`);
  process.exit(0);
}

const R = await openRenderer('render-patch-bilder');
const t00 = Date.now();
let done = 0, failed = 0;
for (const id of todo) {
  const istSzene = id === satz.szene?.key;
  if (!istSzene && !existsSync(path.join(ROOT, 'public/hangar/ships', `${id}.glb`))) { console.log(`  fehlt  ${id} (kein Hangar-Modell)`); failed++; continue; }
  // Frische Seite je 10 Schiffe: die Bilder sind viermal so grosz wie die Karten.
  if (done % 10 === 0 || istSzene) await R.fresh();
  const t0 = Date.now();
  try {
    const r = istSzene ? { bytes: await szene(R, satz.szene), dropped: 0 } : await schiff(R, id);
    for (const e of eintraege(id)) bilder.set(e.key, e);
    await saveData();
    done++;
    console.log(`  ${id.padEnd(32)} ${String(Date.now() - t0).padStart(6)} ms  ${(r.bytes / 1024).toFixed(0)} KB${r.dropped ? `  ${r.dropped} lose Teile weg` : ''}`);
  } catch (e) {
    failed++;
    console.log(`  FEHLER ${id}: ${String(e).slice(0, 200)}`);
    await R.fresh();
  }
}
await R.close();
await saveData();
console.log(`\nrender-patch-bilder: ${done} gerendert, ${failed} fehlgeschlagen in ${((Date.now() - t00) / 1000).toFixed(0)} s, ${bilder.size} Eintraege in ${path.relative(ROOT, DATA)}`);
console.log(`  ohne Modell: ${satz.ohneModell.join(', ')}`);
if (failed) process.exit(1);
