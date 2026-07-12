// Externe Verifikation der Hardpoint-Extraktion — VOR dem Mesh-Rollout.
//
// Prüft jedes Schiff gegen von den Spieldateien UNABHÄNGIGE Quellen:
//  A) Hüllenmaße (extrahierte .cga-AABB) vs. SC-Wiki-Maße (vehicles.json).
//     Fängt falsche Hüllen-Zuordnung UND Skalierungsfehler. Wiki-Maße stammen
//     aus einer anderen Pipeline als die Geometrie -> echter Cross-Check.
//  B) Komponenten-Anzahl je Kategorie (extrahierte Bones) vs. Wiki-Loadout.
//     Fängt falsche Hülle (fremdes Schiff hat andere Komponenten).
//  C) 3D-Positionen vs. FleetYards' EIGENE StarFab-Holos (unabhängige
//     Extraktion) für die ~10 granularen Schiffe — Ground-Truth der Methode.
//
// Usage:  node scripts/verify-hardpoints.mjs
import { readFileSync, existsSync } from 'node:fs';

const hp = JSON.parse(readFileSync(new URL('../src/data/ship-hardpoints.json', import.meta.url), 'utf8'));
const veh = JSON.parse(readFileSync(new URL('../src/data/vehicles.json', import.meta.url), 'utf8'));
const vById = new Map(veh.vehicles.map((v) => [v.id, v]));

const CORE = ['power', 'shield', 'cooler', 'quantum', 'radar'];
const KIND_WIKI = {
  power: (c) => c.powerPlants, shield: (c) => c.shields, cooler: (c) => c.coolers,
  quantum: (c) => c.quantumDrives, radar: (c) => c.radars,
};

/* ---------- A) + B) für alle Schiffe ---------- */
const rows = [];
for (const [id, s] of Object.entries(hp.ships)) {
  const v = vById.get(id);
  if (!v) continue;
  // extrahierte Maße: cry-Hull [x=Breite, y=Länge, z=Höhe]
  const box = s.hull ?? s.bbox;
  const ex = { w: Math.abs(box[1][0] - box[0][0]), l: Math.abs(box[1][1] - box[0][1]), h: Math.abs(box[1][2] - box[0][2]) };
  const wiki = { w: v.widthM, l: v.lengthM, h: v.heightM };
  // Abweichung je Achse (nur wo Wiki-Maß vorhanden)
  const devs = [];
  for (const k of ['l', 'w', 'h']) if (wiki[k]) devs.push(Math.abs(ex[k] - wiki[k]) / wiki[k]);
  const maxDev = devs.length ? Math.max(...devs) : null;

  // Komponenten-Anzahl je Kern-Kategorie. PRIMÄR = echte Komponenten-Mounts;
  // Steuer-/Cockpit-/Gunner-Hardpoints (controller_cooler, cockpit_radar,
  // radar_gunner …) sind KEINE verbauten Komponenten -> ausschließen.
  const SECONDARY = /controller|cockpit|gunner|copilot|screen|_screen|remote/i;
  const compDiff = [];
  for (const k of CORE) {
    const wikiN = (KIND_WIKI[k](v.components) ?? []).reduce((a, it) => a + it.count, 0);
    const exN = s.hp.filter((h) => h.k === k && !SECONDARY.test(h.n)).length;
    if (wikiN !== exN) compDiff.push(`${k}:${wikiN}≠${exN}`);
  }

  // Achs-Scramble-Test: passen die SORTIERTEN Maße zueinander? Wenn nicht,
  // ist die Hülle falsch (fremdes Schiff), nicht nur anders vermessen.
  const sortDev = (() => {
    if (!wiki.l || !wiki.w || !wiki.h) return null;
    const a = [ex.l, ex.w, ex.h].sort((x, y) => x - y);
    const b = [wiki.l, wiki.w, wiki.h].sort((x, y) => x - y);
    return Math.max(...a.map((x, i) => Math.abs(x - b[i]) / b[i]));
  })();

  const shared = !/^exact$/.test(s.match);
  // Längen-Abweichung allein (zuverlässigste Achse; Höhe/Breite streuen wegen
  // Fahrwerk/Antennen in den Wiki-Maßen)
  const lenDev = wiki.l ? Math.abs(ex.l - wiki.l) / wiki.l : null;
  rows.push({ id, match: s.match, shared, ex, wiki, maxDev, lenDev, sortDev, compDiff, dims: `L${ex.l.toFixed(0)}/${wiki.l ?? '?'} B${ex.w.toFixed(0)}/${wiki.w ?? '?'} H${ex.h.toFixed(0)}/${wiki.h ?? '?'}` });
}

// FALSCHE HÜLLE = die sortierten Maße passen grob nicht (fremdes Schiff).
// Höhe/Breite streuen systematisch (Wiki misst mit Fahrwerk/Antennen), daher
// ist der Sortier-Test robuster als achsweise Abweichung.
const WRONG_TOL = 0.30;
const wrongHull = rows.filter((r) => !r.shared && r.sortDev != null && r.sortDev > WRONG_TOL);
const compFlags = rows.filter((r) => !r.shared && r.compDiff.length);
const sharedRows = rows.filter((r) => r.shared);
const exactRows = rows.filter((r) => !r.shared);

console.log(`\n=== A) Hüllenmaße vs. SC-Wiki (${exactRows.length} exakte Zuordnungen) ===`);
const medLen = exactRows.filter((r) => r.lenDev != null).map((r) => r.lenDev).sort((a, b) => a - b);
console.log(`Median Längen-Abweichung: ${(medLen[medLen.length >> 1] * 100).toFixed(1)}%  (Länge = zuverlässigste Achse)`);
console.log(`Schiffe mit Längen-Abweichung <15%: ${exactRows.filter((r) => r.lenDev != null && r.lenDev < 0.15).length}/${exactRows.length}`);
if (wrongHull.length) {
  console.log(`\nVERDÄCHTIG (sortierte Maße >${WRONG_TOL * 100}% daneben — evtl. falsche Hülle):`);
  for (const r of wrongHull.sort((a, b) => b.sortDev - a.sortDev))
    console.log(`  ${r.id.padEnd(34)} sortDev ${(r.sortDev * 100).toFixed(0)}%  [${r.dims}]`);
} else console.log('keine Hüllen-Verwechslungen erkannt.');

console.log(`\n=== B) Komponenten-Anzahl (PRIMÄR, ohne Steuer-/Cockpit-Hardpoints) vs. Wiki ===`);
console.log(`Schiffe mit exakter Übereinstimmung: ${exactRows.length - compFlags.length}/${exactRows.length}`);
if (compFlags.length) {
  console.log(`Rest-Abweichungen (${compFlags.length}):`);
  for (const r of compFlags.slice(0, 40)) console.log(`  ${r.id.padEnd(34)} ${r.compDiff.join(' ')}`);
}

console.log(`\n=== geteilte Hüllen (Varianten auf Basis-cga, Maß-Abweichung erwartbar): ${sharedRows.length} ===`);
for (const r of sharedRows.sort((a, b) => (b.maxDev ?? 0) - (a.maxDev ?? 0)).slice(0, 12))
  console.log(`  ${r.id.padEnd(34)} ${r.maxDev != null ? (r.maxDev * 100).toFixed(0) + '%' : '—'}  ${r.match}`);

/* ---------- C) Positions-Ground-Truth vs. FleetYards ---------- */
const GT = new URL('../.cache/holo-gltf/', import.meta.url);
const GTSUM = 'C:/Users/mkris/AppData/Local/Temp/claude/G--Projects-sc-patch-archive/7bd68f3e-a685-431c-b870-13ea995d1bad/scratchpad/verify-granular-summary.json';
console.log(`\n=== C) Positionen vs. FleetYards-StarFab (unabhängige Extraktion) ===`);
if (existsSync(GTSUM)) {
  const gt = JSON.parse(readFileSync(GTSUM, 'utf8'));
  const norm = (s) => s.toLowerCase().replace(/\.\d+$/, '').replace(/^[0-9a-f]{6}_/, '');
  // FleetYards-StarFab-Holos sind PRO SCHIFF unterschiedlich hochskaliert
  // (300i-Mesh ~88 m für ein 27-m-Schiff). Roh-Koordinaten sind daher nicht
  // vergleichbar; erst uniforme Skala + Translation fitten, dann Residuum
  // messen. Kleines Residuum = gleiche relative Anordnung = korrekte Layout.
  for (const [slug, d] of Object.entries(gt)) {
    if (!d.sample) continue;
    const ship = hp.ships[slug];
    if (!ship) continue;
    const mine = new Map(ship.hp.map((h) => [norm(h.n), [-h.p[1], h.p[2], -h.p[0]]])); // cry -> StarFab (-y,z,-x)
    const pairs = [];
    for (const [name, fp] of Object.entries(d.sample)) {
      const m = mine.get(norm(name));
      if (m && Array.isArray(fp)) pairs.push([m, fp]);
    }
    if (pairs.length < 3) continue;
    // Schwerpunkte + uniforme Skala (Verhältnis der RMS-Radien)
    const cen = (sel) => pairs.reduce((a, p) => [a[0] + p[sel][0], a[1] + p[sel][1], a[2] + p[sel][2]], [0, 0, 0]).map((v) => v / pairs.length);
    const ca = cen(0), cb = cen(1);
    let ra = 0, rb = 0;
    for (const p of pairs) {
      ra += (p[0][0] - ca[0]) ** 2 + (p[0][1] - ca[1]) ** 2 + (p[0][2] - ca[2]) ** 2;
      rb += (p[1][0] - cb[0]) ** 2 + (p[1][1] - cb[1]) ** 2 + (p[1][2] - cb[2]) ** 2;
    }
    const s = Math.sqrt(rb / ra);
    let maxErr = 0;
    for (const p of pairs) {
      const pred = [ca[0] + (p[0][0] - ca[0]) * s, ca[1] + (p[0][1] - ca[1]) * s, ca[2] + (p[0][2] - ca[2]) * s]
        .map((v, k) => v - ca[k] + cb[k]);
      maxErr = Math.max(maxErr, Math.hypot(pred[0] - p[1][0], pred[1] - p[1][1], pred[2] - p[1][2]));
    }
    // Residuum relativ zur FY-Meshgröße (Radius) — <5% = gleiche Anordnung
    console.log(`  ${slug.padEnd(30)} ${pairs.length} HP, FY-Skala ${s.toFixed(2)}×, Layout-Residuum ${(maxErr / Math.sqrt(rb / pairs.length) * 100).toFixed(1)}% des Mesh-Radius`);
  }
} else {
  console.log('  (FleetYards-Ground-Truth-Cache nicht gefunden — separater Fetch nötig)');
}

console.log(`\n--- Zusammenfassung: ${wrongHull.length} Hüllen-Verdachtsfälle, ${compFlags.length} Komponenten-Abweichungen von ${exactRows.length} exakten Zuordnungen ---`);
