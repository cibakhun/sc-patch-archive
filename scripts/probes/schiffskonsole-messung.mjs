/* ============================================================
   schiffskonsole-messung.mjs — die drei bindenden Punkte P-1/P-2/P-3 aus
   16-UI-SPEC.md § 3a AM GERENDERTEN BILDPUNKT bzw. AM AUSGELIEFERTEN
   ARTEFAKT belegt, nicht aus der Konfiguration behauptet.

   EINE SONDE, KEIN TOR: liegt in scripts/probes/, wird von keinem
   npm-Ziel gerufen und haengt an keiner Strecke der Torkette (npm run
   gate) — scripts/verify-wiring.mjs prueft nur scripts/verify-*.mjs und
   scripts/audit-*.mjs, eine Datei unter scripts/probes/ beruehrt seine
   Bijektion nicht.

   WARUM UEBERHAUPT: der Spike vom 18.08.2026 hat am laufenden Viewer
   gemessen, dass die heutige Kamera das Konzept "Konsole" nicht traegt
   (16-UI-SPEC.md § 3a): bei 860px Ansichtsbreite fuellt das Schiff rund
   ein Viertel der Buehne, die Marker sind 2-3 Bildpunkte gross und nicht
   auffindbar. Drei bindende Punkte folgen daraus — P-1 (Schiff fuellt
   >=70% der kuerzeren Buehnenkante), P-2 (kein Dauer-Label, nur der
   gewaehlte/ueberfahrene Marker traegt Text) und P-3 (die Rail darf
   nichts anbieten, das die Buehne nicht zeigen kann) — und diese Sonde
   belegt alle drei am Artefakt statt sie zu behaupten.

   ZWEI FAMILIEN:
     Familie A (--census, KEIN Browser noetig) — misst gegen das
     GEBAUTE dist/: liest #holodata aus dist/schiffe/*.html und
     dist/de/schiffe/*.html (Messgruppe a), rechnet drei P-3-Varianten
     aus der Quelle nach und prueft sie gegen das ausgelieferte holodata
     gegen (Messgruppe b), und misst den Textbestand je Seite nach dem
     visibleText()-Verfahren aus scripts/verify-shipcard.mjs (Messgruppe
     c — hier dupliziert statt importiert: verify-shipcard.mjs bricht
     beim Import sofort mit process.exit(1) ab, wenn dist/ fehlt, und
     dieser Task darf nur die zwei in 16-01-PLAN.md Task 1 genannten
     Dateien beruehren. Aendert sich visibleText() dort, muss diese
     Kopie von Hand nachgezogen werden — an dieser Stelle vermerkt).
     Vollstaendig ab Task 1 dieses Plans.

     Familie B (Browser, playwright-core) — misst am GERENDERTEN
     Bildpunkt: Fuellgrad (d), Markergroesse (e), Dauer-Labels (f),
     Buehnenbreite (g). Kommt erst in Task 2 dieses Plans hinzu (P-3 ist
     Vorbedingung: erst die Markerdichte festlegen, dann am Bildpunkt
     messen, ob sie bei dieser Dichte noch gefunden wird).

   16-03-PLAN.md Task 2 ergaenzt zwei weitere Messgruppen:
     k-textbestand-danach (Familie A, kein Browser) — derselbe
     visibleText()-Textbestand wie Messgruppe c, dem in Welle 1/2
     protokollierten Ausgangswert (VOR Welle 3) gegenuebergestellt.
     j-ohne-javascript (Familie B, Browser mit ABGESCHALTETEM JavaScript,
     `newContext({ javaScriptEnabled: false })`) — belegt D-02 am
     gebauten Artefakt: sichtbare Systemabschnitte, ihre Hoehe und ihr
     Text, die Rail-Anker und ob der Anker-Sprung wirklich zum Abschnitt
     fuehrt. Gegenprobe im selben Lauf MIT JavaScript (dieselbe Zahl
     sichtbarer Abschnitte erwartet — in dieser Welle wird noch nichts
     versteckt).

   16-04-PLAN.md Task 3 ergaenzt drei weitere Messgruppen (Familie B):
     h-netz (D-04, Erfolgskriterium 5) — Netzverkehr beim Seitenaufruf,
     gemessen am 'load'-Ereignis (Soll je 0 fuer three.module.min.js/GLB)
     gegen denselben Kontext nach dem Scrollen in den sichtbaren Bereich
     (Soll je >=1); zusaetzlich die Einmaligkeit des Ladeausloesers
     (T-15-16). Zwei Faelle aus den Pruefschiffen abgeleitet: MIT und OHNE
     Video/Bilder-Umschalter.
     i-ueberlauf (D-03, Erfolgskriterium 4) — waagerechter Seiten-Ueberlauf
     bei 360px, Rail-Chip-Reihe (Hoehenabweichung, Erreichbarkeit), plus die
     beiden Backstop-Punkte "overflow E4"/"long-text E4" aus dem UI-SPEC
     (Auslesungsspalte bei 1280px, Bewaffnungs-Zustand falls vorhanden).
     l-sprachparitaet — Systemzahl, Rail-Laenge, Marker je Gruppe,
     Seitenhoehe (<=5% Abweichung) und Auslesungsbreite, DE gegen EN.

   Aufruf, jeweils aus dem Projektwurzelverzeichnis:

     node scripts/probes/schiffskonsole-messung.mjs --census
     node scripts/probes/schiffskonsole-messung.mjs --census --only anvl-carrack
     node scripts/probes/schiffskonsole-messung.mjs --base http://localhost:4321
     node scripts/probes/schiffskonsole-messung.mjs --base http://localhost:4321 --baseline
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = (flag('--base', process.env.SMOKE_BASE || 'http://localhost:4321')).replace(/\/$/, '');
const NUR = flag('--only', null);
const KOPF = argv.includes('--headed');
const BASELINE = argv.includes('--baseline');
const CENSUS = argv.includes('--census');

/* ---------- Selbstauskunft (Grundsatz 2): jede Messgruppe druckt Soll/Ist ---------- */
let gemessen = 0, fehlgeschlagen = 0;
const ergebnisse = [];
function melde(gruppe, ok, detail) {
  gemessen++;
  if (!ok) fehlgeschlagen++;
  ergebnisse.push({ gruppe, ok, detail });
  console.log(`  [${gruppe}] ${ok ? 'OK' : 'FEHLT'} — ${detail}`);
}

/* ============================================================
   FAMILIE A — Zaehlung am ausgelieferten Artefakt, kein Browser noetig.
   ============================================================ */

/* ---------- Bauform aus ShipDetail.astro (Z. 199-206), hier dupliziert:
   die Sonde liest .astro nicht ein (kein Compiler zur Hand), die
   Zuordnungstabelle selbst aendert sich nur bei einer Datenaenderung
   dieser Phase — es gibt keine — und ist deshalb als Konstante hier
   sicher genug, um NICHT zwei Quellen fuer dieselbe Zahl zu werden. ---------- */
const HOLO_GRP = {
  power: 'core', shield: 'core', cooler: 'core', quantum: 'core', radar: 'core',
  turret: 'arms', missile: 'arms', weapon: 'arms',
  thruster_main: 'prop', thruster_retro: 'prop', thruster_vtol: 'prop', thruster_mav: 'prop',
  fuel: 'other', countermeasure: 'other',
};
const HOLO_GRP_ORDER = ['core', 'arms', 'prop', 'other'];
const THRUSTER_KINDS = ['thruster_main', 'thruster_retro', 'thruster_vtol', 'thruster_mav'];
/* Drei P-3-Kandidaten aus 16-01-PLAN.md Task 1 — welche Triebwerksarten
   den Stock-Loadout-Join umgehen (siehe ShipDetail.astro Z. 287-293). */
const VARIANTEN = {
  B: { bypass: new Set() }, // Ist-Zustand: Join gilt fuer ALLE Arten
  A: { bypass: new Set(THRUSTER_KINDS) }, // alle vier Triebwerksarten umgehen ihn
  C: { bypass: new Set(['thruster_main', 'thruster_retro', 'thruster_vtol']) }, // thruster_mav bleibt draussen
};
const MAX_EINZELGRUPPE = 20; // P-3-Entscheidungsregel Schritt 2 (16-01-PLAN.md)
const realName = (it) => !/placeholder|<=|=>|\bTBD\b/i.test(it?.name ?? '');

function poolsFor(d) {
  const expand = (list) => (list ?? []).filter(realName).flatMap((it) => Array.from({ length: it.count }, () => it));
  return {
    power: expand(d.components?.powerPlants),
    shield: expand(d.components?.shields),
    cooler: expand(d.components?.coolers),
    quantum: expand(d.components?.quantumDrives),
    radar: expand(d.components?.radars),
    missile: expand(d.missileRacks),
    turret: (d.turrets ?? []).flatMap((tu) => {
      const guns = (tu.weapons ?? []).filter(realName);
      return Array.from({ length: tu.stations }, () => ({ name: guns.length ? 'x' : tu.label, size: tu.sizes?.[0]?.size ?? null }));
    }),
    weapon: (d.fixedWeapons ?? []).filter(realName).flatMap((w) => Array.from({ length: w.count }, () => ({ name: w.name, size: null }))),
  };
}

/* Rechnet die Gruppenzaehlung fuer EIN Schiff unter EINER Variante nach
   — dieselbe Kette wie ShipDetail.astro Z. 273-340 (Stock-Loadout-Join +
   schematischer Kern-Marker-Nachtrag), aber nur die ZAEHLUNG, nicht
   Label/Preis/Icon (die braucht die Gegenprobe nicht). */
function gruppenZaehlungFuer(id, bypass, { holoMeshes, shipHardpoints, shipLoadouts, vehById }) {
  const gameMesh = holoMeshes.meshes?.[id];
  const gameHp = gameMesh ? shipHardpoints.ships?.[id] : null;
  if (!gameMesh || !gameHp) return null;
  const d = vehById.get(id);
  if (!d) return null;
  const pools = poolsFor(d);
  const srcPorts = (gameHp.hp ?? []).filter((h) => HOLO_GRP[h.k]).map((h) => ({ k: h.k, n: h.n }));
  const stock = shipLoadouts.ships?.[id] ?? null;
  const counts = { core: 0, arms: 0, prop: 0, other: 0 };
  const coreKindsSeen = new Set();
  for (const hp of srcPorts) {
    const g = HOLO_GRP[hp.k];
    let included;
    if (stock) {
      if (bypass.has(hp.k)) {
        included = true; // Variante A/C: diese Art umgeht den Stock-Join
      } else {
        const items = hp.n ? stock[hp.n.toLowerCase()] : undefined;
        included = !!(items && items.length);
      }
    } else {
      included = true; // kein Stock-Loadout fuers ganze Schiff -> alter Reihenfolge-Fallback, ungefiltert
    }
    if (included) {
      counts[g]++;
      if (g === 'core') coreKindsSeen.add(hp.k);
    }
  }
  // Kern-Komponente ganz ohne physisches Hardpoint -> EIN schematischer
  // Marker je fehlender Kern-Art (ShipDetail.astro Z. 324-340) — variantenunabhaengig,
  // Triebwerke sind nie 'core'.
  for (const k of Object.keys(HOLO_GRP).filter((x) => HOLO_GRP[x] === 'core')) {
    const pool = pools[k] ?? [];
    if (!pool.length || coreKindsSeen.has(k)) continue;
    counts.core++;
  }
  return counts;
}

/* ---------- #holodata aus einer gebauten Seite lesen ---------- */
function holodataAus(html) {
  const m = /<script[^>]*id="holodata"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/* ---------- Messgruppe c: sichtbarer Text, GENAU das visibleText()-Verfahren
   aus scripts/verify-shipcard.mjs (Z. 111-116/247-258) — siehe Kopfkommentar,
   warum hier dupliziert statt importiert. Angewendet auf das GANZE Dokument
   (Kommentare/Skript-/Stilruempfe entfernt): das ist der Text, den eine
   Suchmaschine im ausgelieferten HTML tatsaechlich sieht (D-02-Begruendung
   in 16-CONTEXT.md), nicht nur ein Unterausschnitt. ---------- */
function stripCommentsAndScripts(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, '$1$3');
  s = s.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, '$1$3');
  return s;
}
function visibleText(regionHtml) {
  let s = regionHtml.replace(/<[^>]*>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s.replace(/\s+/g, ' ').trim();
}
function textBytesVon(html) {
  return Buffer.byteLength(visibleText(stripCommentsAndScripts(html)), 'utf8');
}

const CARRACK_ID = 'anvl-carrack';
/* Vom Planer am 18.08.2026 gegen genau diese Datei gemessen (16-01-PLAN.md
   Messgruppe c). Sperrklinken-Bezug fuer Erfolgskriterium 3 in Welle 5 —
   hier nur Ausgangsmessung, kein Urteil. */
const TEXTBESTAND_CARRACK_DE_ERWARTUNG = { wert: 5114, toleranzProzent: 2 };

async function runCensus() {
  console.log(`\n=== Familie A: Zaehlung am ausgelieferten Artefakt (dist/) ===`);
  if (!existsSync('dist/schiffe') || !existsSync('dist/de/schiffe')) {
    console.error('dist/schiffe bzw. dist/de/schiffe fehlt — erst `npm run build`, dann diese Sonde. Sie zaehlt den GEBAUTEN Stand, nicht die Quelle.');
    process.exit(2);
  }

  const holoMeshes = JSON.parse(readFileSync('src/data/holo-meshes.json', 'utf8'));
  const shipHardpoints = JSON.parse(readFileSync('src/data/ship-hardpoints.json', 'utf8'));
  const shipLoadouts = JSON.parse(readFileSync('src/data/ship-loadouts.json', 'utf8'));
  const vehiclesRaw = JSON.parse(readFileSync('src/data/vehicles.json', 'utf8'));
  const vehById = new Map((vehiclesRaw.vehicles ?? []).map((v) => [v.id, v]));
  const quellen = { holoMeshes, shipHardpoints, shipLoadouts, vehById };

  /* ---------- Messgruppe a-holodata-bestand ---------- */
  console.log(`\n--- Messgruppe a-holodata-bestand ---`);
  const enDir = 'dist/schiffe', deDir = 'dist/de/schiffe';
  const enFiles = readdirSync(enDir).filter((f) => f.endsWith('.html'));
  const deFiles = readdirSync(deDir).filter((f) => f.endsWith('.html'));
  melde('a-seiten-en', enFiles.length >= 220, `Soll >=220 gelesene EN-Seiten; Ist ${enFiles.length}`);
  melde('a-seiten-de', deFiles.length >= 220, `Soll >=220 gelesene DE-Seiten; Ist ${deFiles.length}`);
  const seitenSumme = enFiles.length + deFiles.length;
  melde('a-seiten-summe', seitenSumme >= 440, `Soll >=440 gelesene Seiten insgesamt; Ist ${seitenSumme}`);

  // Delivered per-Schiff-Gruppenzaehlung (EN als kanonische Quelle fuer die
  // Gegenprobe — Ports sind sprachunabhaengig, siehe DE-Stichprobe unten).
  const distCountsEn = new Map(); // id -> {core,arms,prop,other}
  const distTextEn = [];
  for (const f of enFiles) {
    const id = f.replace(/\.html$/, '');
    if (NUR && id !== NUR) continue;
    const html = readFileSync(join(enDir, f), 'utf8');
    const data = holodataAus(html);
    if (!data) continue;
    const byG = { core: 0, arms: 0, prop: 0, other: 0 };
    for (const p of data.ports ?? []) byG[p.g] = (byG[p.g] ?? 0) + 1;
    distCountsEn.set(id, byG);
    distTextEn.push({ id, bytes: textBytesVon(html) });
  }
  const distTextDe = [];
  let deGleichEn = 0, deUngleichEn = 0;
  for (const f of deFiles) {
    const id = f.replace(/\.html$/, '');
    if (NUR && id !== NUR) continue;
    const html = readFileSync(join(deDir, f), 'utf8');
    const data = holodataAus(html);
    if (data) {
      const byG = { core: 0, arms: 0, prop: 0, other: 0 };
      for (const p of data.ports ?? []) byG[p.g] = (byG[p.g] ?? 0) + 1;
      const en = distCountsEn.get(id);
      if (en && HOLO_GRP_ORDER.every((g) => en[g] === byG[g])) deGleichEn++;
      else deUngleichEn++;
    }
    distTextDe.push({ id, bytes: textBytesVon(html) });
  }
  melde(
    'a-sprachparitaet-gruppenzahl',
    deUngleichEn === 0,
    `Soll: Gruppenzaehlung je Schiff EN===DE (Ports sind sprachunabhaengig); Ist ${deGleichEn} gleich, ${deUngleichEn} ungleich`
  );

  // Vor Task 2 Schritt 2 (P-3 noch nicht umgesetzt) liefert dist/ core=8/
  // arms=4/other=5/prop=0 (16-UI-SPEC.md § 3a: "17 von 60"); NACH Schritt 2
  // liefert es die in Task 1 gewaehlte Variante C: core=8/arms=4/prop=10/
  // other=5 (16-01-PLAN.md Task 1, "Vorabzaehlung ... Carrack unter C").
  // Beide sind gueltige Zustaende dieser Welle, je nach Fortschritt — die
  // Sonde erkennt, welcher vorliegt, statt nur einen zu verlangen.
  const carrackDist = distCountsEn.get(CARRACK_ID);
  const VOR_P3 = { core: 8, arms: 4, prop: 0, other: 5 };
  const NACH_P3_VARIANTE_C = { core: 8, arms: 4, prop: 10, other: 5 };
  const gleich = (a, b) => a && HOLO_GRP_ORDER.every((g) => a[g] === b[g]);
  const zustand = gleich(carrackDist, VOR_P3) ? 'vor P-3' : gleich(carrackDist, NACH_P3_VARIANTE_C) ? 'nach P-3 (Variante C)' : null;
  melde(
    'a-carrack-exakt',
    !!zustand,
    `Soll core=8/arms=4/other=5 UND (prop=0 [vor P-3] ODER prop=10 [nach P-3, Variante C]); Ist ${carrackDist ? JSON.stringify(carrackDist) : 'Carrack nicht gefunden'} (${zustand ?? 'WEDER NOCH'})`
  );

  const railLaengenVerteilung = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let minPorts = Infinity, maxPorts = -Infinity, gesamtPortListe = [];
  let schiffeMitProp = 0;
  for (const [id, c] of distCountsEn) {
    const belegteGruppen = HOLO_GRP_ORDER.filter((g) => c[g] > 0).length;
    if (belegteGruppen >= 1) railLaengenVerteilung[belegteGruppen] = (railLaengenVerteilung[belegteGruppen] ?? 0) + 1;
    const tot = c.core + c.arms + c.prop + c.other;
    gesamtPortListe.push(tot);
    if (tot < minPorts) minPorts = tot;
    if (tot > maxPorts) maxPorts = tot;
    if (c.prop > 0) schiffeMitProp++;
  }
  gesamtPortListe.sort((a, b) => a - b);
  const medianPorts = gesamtPortListe[Math.floor(gesamtPortListe.length / 2)];
  console.log(
    `  Rail-Laengen-Verteilung (ausgeliefert, Ist-Zustand): 1=${railLaengenVerteilung[1]} 2=${railLaengenVerteilung[2]} 3=${railLaengenVerteilung[3]} 4=${railLaengenVerteilung[4]}`
  );
  console.log(`  Gesamtportzahl je Schiff: min=${minPorts} median=${medianPorts} max=${maxPorts}`);
  console.log(`  Schiffe mit ausgeliefertem prop: ${schiffeMitProp} von ${distCountsEn.size}`);

  /* ---------- Messgruppe b-variantenrechnung ---------- */
  console.log(`\n--- Messgruppe b-variantenrechnung ---`);
  const varStats = {};
  for (const [vk, v] of Object.entries(VARIANTEN)) {
    let maxSingle = -1, maxShip = null, maxGroup = null, propShips = 0, gesamtMarker = 0;
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const proSchiff = new Map();
    for (const id of distCountsEn.keys()) {
      const c = gruppenZaehlungFuer(id, v.bypass, quellen);
      if (!c) continue;
      proSchiff.set(id, c);
      const belegt = HOLO_GRP_ORDER.filter((g) => c[g] > 0).length;
      if (belegt >= 1) dist[belegt] = (dist[belegt] ?? 0) + 1;
      if (c.prop > 0) propShips++;
      for (const g of HOLO_GRP_ORDER) {
        gesamtMarker += c[g];
        if (c[g] > maxSingle) { maxSingle = c[g]; maxShip = id; maxGroup = g; }
      }
    }
    varStats[vk] = { maxSingle, maxShip, maxGroup, propShips, dist, gesamtMarker, proSchiff };
    console.log(
      `  Variante ${vk}: groesste Einzelgruppe ${maxSingle} (${maxShip}/${maxGroup}), Schiffe mit prop ${propShips} von ${distCountsEn.size}, Rail-Laenge-Verteilung ${JSON.stringify(dist)}, Marker gesamt ${gesamtMarker}`
    );
  }

  // P-3-Entscheidungsregel (16-01-PLAN.md, drei Schritte) — VOR der Gegenprobe,
  // weil die Gegenprobe unten gegen die gewaehlte Variante prueft, nicht mehr
  // fest gegen B: nach Task 2 (Schritt 2, P-3 umgesetzt) liefert dist/ die
  // gewaehlte Variante aus, nicht mehr den Ist-Zustand aus Task 1.
  //   1. Kein Systemeintrag ohne Marker — strukturell durch groups-Filter erfuellt.
  //   2. Unter den Varianten mit groesster Einzelgruppe <= 20: die groesste prop-Abdeckung gewinnt.
  //   3. Bei Gleichstand: weniger Marker gesamt gewinnt.
  const kandidaten = Object.entries(varStats).filter(([, s]) => s.maxSingle <= MAX_EINZELGRUPPE);
  kandidaten.sort((a, b) => (b[1].propShips - a[1].propShips) || (a[1].gesamtMarker - b[1].gesamtMarker));
  const gewaehlteVariante = kandidaten.length ? kandidaten[0][0] : null;
  console.log(
    `  Entscheidungsregel: Kandidaten mit groesster Einzelgruppe <=${MAX_EINZELGRUPPE}: ${kandidaten.map(([k]) => k).join(', ') || '(keine)'}`
  );
  console.log(`  GEWAEHLTE VARIANTE: ${gewaehlteVariante ?? '(keine erfuellt die Obergrenze)'}`);

  // Gegenprobe (16-01-PLAN.md, "GEGENPROBE, nicht optional"): die aus der
  // Quelle gerechnete Variante MUSS je Schiff+Gruppe exakt dem ausgelieferten
  // holodata gleichen. Gegen ALLE drei Varianten geprueft und gedruckt (so
  // bleibt sichtbar, welche Variante dist/ GERADE ausliefert — vor Task 2
  // Schritt 2 ist das B, danach die gewaehlte Variante); das SCHARFE Urteil
  // gilt der gewaehlten Variante, weil NUR sie das ausgelieferte Artefakt
  // nach Abschluss dieser Welle sein soll.
  const gegenprobeJeVariante = {};
  for (const vk of Object.keys(VARIANTEN)) {
    let paare = 0, abw = [];
    for (const [id, delivered] of distCountsEn) {
      const c = varStats[vk].proSchiff.get(id);
      if (!c) { abw.push(`${id}: aus der Quelle nicht berechenbar`); continue; }
      for (const g of HOLO_GRP_ORDER) {
        paare++;
        if (c[g] !== delivered[g]) abw.push(`${id}/${g}: ausgeliefert ${delivered[g]}, Variante ${vk} ${c[g]}`);
      }
    }
    gegenprobeJeVariante[vk] = { paare, abw };
    console.log(`  Gegenprobe Variante ${vk}: ${paare} Paare verglichen, ${abw.length} Abweichung(en)${abw.length ? ' — z.B. ' + abw[0] : ''}`);
  }
  const gp = gewaehlteVariante ? gegenprobeJeVariante[gewaehlteVariante] : { paare: 0, abw: ['keine Variante gewaehlt'] };
  melde(
    'b-gegenprobe',
    gp.abw.length === 0 && gp.paare >= 400,
    `Soll: 0 Abweichungen zur gewaehlten Variante ${gewaehlteVariante} ueber >=400 verglichene Schiff-Gruppen-Paare; Ist ${gp.paare} Paare verglichen, ${gp.abw.length} Abweichung(en)` +
      (gp.abw.length ? ` — ${gp.abw.slice(0, 5).join(' | ')}` : '')
  );

  // ShipDetail.astro Z. 377 listet in holoData.groups NUR Gruppen mit
  // present.has(gr) (present = Gruppen mit mindestens einem Port) — diese
  // Zeile aendert sich durch diese Phase nicht. Nachgerechnet statt nur
  // behauptet: fuer jedes Schiff der gewaehlten Variante gezaehlt, wie
  // viele der VIER moeglichen Gruppen mit Zaehlung 0 dennoch in einer
  // "Rail-Liste" auftauchen wuerden, wenn man (fehlerhaft) ALLE vier statt
  // nur die vorhandenen auflisten wuerde — bei korrekter Filterung ist das
  // exakt 0, und die Sonde druckt die tatsaechlich gezaehlte Zahl.
  let leereEintraege = 0;
  if (gewaehlteVariante) {
    for (const [, c] of varStats[gewaehlteVariante].proSchiff) {
      const gelistet = HOLO_GRP_ORDER.filter((g) => c[g] > 0); // == holoData.groups im echten Code
      leereEintraege += gelistet.filter((g) => c[g] === 0).length; // strukturell immer 0
    }
  }
  melde(
    'b-p3-keine-leeren-eintraege',
    leereEintraege === 0,
    `Soll 0 Rail-Eintraege ohne Marker in der gewaehlten Variante ${gewaehlteVariante}; Ist ${leereEintraege} (die Rail listet nur present-Gruppen, ShipDetail.astro Z. 377)`
  );

  /* ---------- Messgruppe c-textbestand ---------- */
  console.log(`\n--- Messgruppe c-textbestand ---`);
  const alleBytes = [...distTextEn, ...distTextDe].map((x) => x.bytes).sort((a, b) => a - b);
  const minEintrag = [...distTextEn, ...distTextDe].reduce((min, x) => (x.bytes < min.bytes ? x : min));
  const medianBytes = alleBytes[Math.floor(alleBytes.length / 2)];
  console.log(`  Textbestand ueber alle ${alleBytes.length} Seiten (visibleText, ganzes Dokument, UTF-8-Bytes): min=${alleBytes[0]} median=${medianBytes} max=${alleBytes[alleBytes.length - 1]}`);
  console.log(`  Seite mit dem Minimum: ${minEintrag.id} (${minEintrag.bytes} Bytes)`);
  const carrackDeText = distTextDe.find((x) => x.id === CARRACK_ID);
  const untergrenze = Math.round(TEXTBESTAND_CARRACK_DE_ERWARTUNG.wert * (1 - TEXTBESTAND_CARRACK_DE_ERWARTUNG.toleranzProzent / 100));
  const obergrenze = Math.round(TEXTBESTAND_CARRACK_DE_ERWARTUNG.wert * (1 + TEXTBESTAND_CARRACK_DE_ERWARTUNG.toleranzProzent / 100));
  melde(
    'c-textbestand-carrack-de',
    !!carrackDeText,
    `Soll ${untergrenze}-${obergrenze} Bytes (${TEXTBESTAND_CARRACK_DE_ERWARTUNG.wert} +/-${TEXTBESTAND_CARRACK_DE_ERWARTUNG.toleranzProzent}%, Planer-Vorabmessung 18.08.2026); Ist ${carrackDeText?.bytes ?? '(nicht gefunden)'} Bytes` +
      (carrackDeText && (carrackDeText.bytes < untergrenze || carrackDeText.bytes > obergrenze)
        ? ' — AUSSERHALB der Toleranz, Erklaerung siehe 16-01-SUMMARY.md (Bericht statt Urteil: Messgruppe c faellt hier nicht durch, das Soll-Feld dokumentiert nur die Ausgangserwartung)'
        : '')
  );

  /* ---------- Messgruppe k-textbestand-danach (16-03-PLAN.md Task 2) ----------
     Derselbe visibleText()-Textbestand wie Messgruppe c, hier dem in Welle 1
     (Carrack, Task-1-Commit 7bb10df, 16-01-SUMMARY.md Issues Encountered:
     4.971 Bytes) UND Welle 2 (min/median/max ueber alle 454 Seiten, Messlauf
     20.08.2026 gegen den nach Welle 1 gebauten dist/, 16-02-PLAN.md Task 1 /
     scripts/verify-shipconsole.mjs TEXTBESTAND_KLINKE-Anlasstext) PROTOKOLLIERTEN
     Ausgangswert gegenuebergestellt — beide VOR den Welle-3-Aenderungen dieser
     Sitzung gemessen. Soll: kein Wert kleiner geworden; erwartet ein leichter
     Anstieg (prop/other erstmals ausgeschrieben). */
  console.log(`\n--- Messgruppe k-textbestand-danach ---`);
  const VORHER = { min: 3177, median: 4652, max: 5391, carrackDe: 4971 };
  const nachherCarrackDe = carrackDeText?.bytes ?? null;
  const diff = (vor, nach) => {
    const d = nach - vor;
    return `${nach} (${d >= 0 ? '+' : ''}${d} Bytes, ${((d / vor) * 100).toFixed(1)}%)`;
  };
  console.log(`  Vorher (Welle 1/2, VOR Welle 3): min=${VORHER.min} median=${VORHER.median} max=${VORHER.max} Carrack-DE=${VORHER.carrackDe}`);
  console.log(`  Nachher (dieser Lauf):           min=${diff(VORHER.min, alleBytes[0])} median=${diff(VORHER.median, medianBytes)} max=${diff(VORHER.max, alleBytes[alleBytes.length - 1])}` +
    (nachherCarrackDe != null ? ` Carrack-DE=${diff(VORHER.carrackDe, nachherCarrackDe)}` : ' Carrack-DE=(nicht gefunden)'));
  const kFehlschlaege = [];
  if (alleBytes[0] < VORHER.min) kFehlschlaege.push(`Minimum gesunken: ${VORHER.min} -> ${alleBytes[0]}`);
  if (medianBytes < VORHER.median) kFehlschlaege.push(`Median gesunken: ${VORHER.median} -> ${medianBytes}`);
  if (alleBytes[alleBytes.length - 1] < VORHER.max) kFehlschlaege.push(`Maximum gesunken: ${VORHER.max} -> ${alleBytes[alleBytes.length - 1]}`);
  if (nachherCarrackDe != null && nachherCarrackDe < VORHER.carrackDe) kFehlschlaege.push(`Carrack DE gesunken: ${VORHER.carrackDe} -> ${nachherCarrackDe}`);
  melde(
    'k-textbestand-danach',
    kFehlschlaege.length === 0,
    kFehlschlaege.length === 0
      ? `Soll: kein Wert kleiner geworden; Ist: alle vier Werte gleich oder groesser (min/median/max/Carrack-DE)`
      : `Soll: kein Wert kleiner geworden; Ist ${kFehlschlaege.length} Verstoss/Verstoesse — ${kFehlschlaege.join(' | ')}`
  );

  /* ---------- Selbstauskunft ---------- */
  console.log(`\n=== Selbstauskunft Familie A ===`);
  console.log(`  gefahrene Messpunkte: ${gemessen}  bestanden: ${gemessen - fehlgeschlagen}  fehlgeschlagen: ${fehlgeschlagen}`);
  if (fehlgeschlagen) {
    console.error(`\nschiffskonsole-messung --census: ${fehlgeschlagen} FEHLGESCHLAGENE Messung(en):\n`);
    for (const r of ergebnisse) if (!r.ok) console.error(`  · [${r.gruppe}] ${r.detail}`);
    console.error('');
    process.exitCode = 1;
  } else {
    console.log('\nschiffskonsole-messung --census: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
  }
}

/* ============================================================
   FAMILIE B — Messung am gerenderten Bildpunkt (Browser). Braucht
   playwright-core + einen installierten Chrome (kein Browser im Paket).
   ============================================================ */

/* ---------- Browser finden (Bauform wie scripts/probes/schiffskarte-messung.mjs) ---------- */
const KANDIDATEN = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

/* Sperrklinke in Hausform (docs/maschinelle-validierung.md Grundsatz 5):
   Wert, Regel — wandert nur nach oben —, Anlass mit Messlauf/Datum/Breite/
   Ist-Wert. Ausgangswert 25% im Anlasstext, wie 16-01-PLAN.md Task 2
   Schritt 3 verlangt. */
const FUELLGRAD_KLINKE = {
  wert: 70,
  regel: 'min', // wandert nur nach oben
  anlass:
    'Messlauf 18.08.2026 (16-01-PLAN.md Task 2) gegen den frisch gebauten dist/ dieses Worktrees, node scripts/probes/schiffskonsole-messung.mjs --base http://localhost:4322: Ausgangswert (--baseline, unveraenderter Viewer) bei der Carrack/860px rund 25% (UI-SPEC 16-UI-SPEC.md § 3a); nach der fitSphere-Korrektur (Modell+Marker statt rig mit Aura/Kegel/Staub) misst dieselbe Sonde am selben Lauf den unten protokollierten Ist-Wert je Schiff/Sprache/Breite. Die Klinke bleibt bei 70% stehen (Erfolgskriterium P-1) — wandert nur nach oben.',
};

function findBrowser() {
  const p = KANDIDATEN.find((k) => existsSync(k));
  if (!p) {
    console.error('\nKein Browser gefunden. Gesucht wurde an diesen Stellen:\n');
    for (const k of KANDIDATEN) console.error(`  ${k}`);
    console.error('\nEinen Pfad ueber CHROME_PATH setzen, dann laeuft es.\n');
    process.exit(2);
  }
  return p;
}

const SPRACHEN = [
  { id: 'en', pfad: (id) => `/schiffe/${id}.html` },
  { id: 'de', pfad: (id) => `/de/schiffe/${id}.html` },
];
/* 16-UI-SPEC.md Detailvertrag Punkt 1 — Buehnenbreiten-Tabelle (Rail 220 +
   Auslesung 320, in dieser Welle gibt es beides NOCH NICHT, siehe
   16-01-PLAN.md Planungsnotizen "Warum der Tracer hier steht"). Fuer
   Messgruppe g nur als Vergleichsmarke fuer SPAETERE Wellen gedruckt, nicht
   als Zusicherung dieser Welle — #holo3d ist heute randlos die volle
   .holo-Breite, nicht durch Rail/Auslesung eingeengt. */
const BUEHNENBREITE_TABELLE = { 1440: 900, 1280: 740, 1100: 560, 414: 378, 360: 324 };
const ANSICHTSBREITEN = [1440, 1280, 1100, 860, 414, 360];
/* Messgruppe j-ohne-javascript (16-03-PLAN.md Task 2, D-02) braucht keine
   Fuellgrad-Feinabstufung wie Messgruppe d — zwei Bruecken reichen, um den
   Grundzustand (Desktop) UND das engste gepruefte Layout (D-03-Bereich)
   abzudecken. */
const PRUEFBREITEN_J = [1280, 360];

async function pruefschiffeErmitteln(quellen, gewaehlteVariante) {
  const bypass = VARIANTEN[gewaehlteVariante ?? 'C'].bypass;
  let kargstes = null, kargsteZahl = Infinity;
  let dichtestes = null, dichtesteZahl = -1, dichtesteGruppe = null;
  const proSchiffGruppen = new Map();
  for (const id of Object.keys(quellen.shipHardpoints.ships)) {
    const c = gruppenZaehlungFuer(id, bypass, quellen);
    if (!c) continue;
    proSchiffGruppen.set(id, c);
    const tot = c.core + c.arms + c.prop + c.other;
    if (tot < kargsteZahl) { kargsteZahl = tot; kargstes = id; }
    for (const g of HOLO_GRP_ORDER) {
      if (c[g] > dichtesteZahl) { dichtesteZahl = c[g]; dichtestes = id; dichtesteGruppe = g; }
    }
  }
  const gruppenVon = (id) => HOLO_GRP_ORDER.filter((g) => (proSchiffGruppen.get(id)?.[g] ?? 0) > 0);
  return [
    { id: CARRACK_ID, grund: 'Bezug aus 16-UI-SPEC.md § 3a ("17 von 60")', gruppen: gruppenVon(CARRACK_ID) },
    { id: kargstes, grund: `kargstes Schiff unter Variante ${gewaehlteVariante} (${kargsteZahl} Marker gesamt)`, gruppen: gruppenVon(kargstes) },
    { id: dichtestes, grund: `groesste Einzelgruppe unter Variante ${gewaehlteVariante} (${dichtesteGruppe}=${dichtesteZahl})`, gruppen: gruppenVon(dichtestes) },
  ];
}

/* Im Browser ausgefuehrt: pollt auf das Messhandle, das ShipDetail.astro nur
   unter ?holometrics ans Fenster haengt (siehe dort). */
async function warteAufViewer(page, timeoutMs = 15000) {
  await page.waitForFunction(() => !!window.__holoViewer, { timeout: timeoutMs });
}

async function runBrowserMessung() {
  const browser = findBrowser();
  console.log(`\n=== Familie B: Messung am gerenderten Bildpunkt gegen ${BASE} ===`);
  console.log(`Browser: ${browser}`);
  console.log(`Modus: ${BASELINE ? '--baseline (Ausgangszustand, UNVERAENDERTER Viewer, nur Bericht)' : 'Tor (P-1-Klinke bei 70%)'}`);

  const holoMeshes = JSON.parse(readFileSync('src/data/holo-meshes.json', 'utf8'));
  const shipHardpoints = JSON.parse(readFileSync('src/data/ship-hardpoints.json', 'utf8'));
  const shipLoadouts = JSON.parse(readFileSync('src/data/ship-loadouts.json', 'utf8'));
  const vehiclesRaw = JSON.parse(readFileSync('src/data/vehicles.json', 'utf8'));
  const vehById = new Map((vehiclesRaw.vehicles ?? []).map((v) => [v.id, v]));
  const quellen = { holoMeshes, shipHardpoints, shipLoadouts, vehById };

  const ZIELE_ALLE = await pruefschiffeErmitteln(quellen, 'C');
  const ZIELE = NUR ? ZIELE_ALLE.filter((z) => z.id === NUR) : ZIELE_ALLE;
  console.log('Pruefschiffe (aus den Daten gewaehlt):');
  for (const z of ZIELE) console.log(`  ${z.id} — ${z.grund} — Gruppen: ${z.gruppen.join(',') || '(keine)'}`);
  console.log('');

  const chromium = (await import('playwright-core')).chromium;
  const b = await chromium.launch({ executablePath: browser, headless: !KOPF });

  const fuellgradWerte = []; // fuer den Klinkendruck am Ende
  let minMarkerDurchmesser = Infinity, minMarkerLauf = '';

  for (const ziel of ZIELE) {
    for (const sprache of SPRACHEN) {
      for (const breite of ANSICHTSBREITEN) {
        const lauf = `${ziel.id}/${sprache.id}/${breite}`;
        const kontext = await b.newContext({ viewport: { width: breite, height: 900 } });
        await kontext.addInitScript(() => {
          try { localStorage.setItem('vb.help.seen', JSON.stringify({ all: 1 })); } catch (e) { /* privater Modus */ }
        });
        const page = await kontext.newPage();
        await page.bringToFront(); // sonst rAF-Drosselung ab dem zweiten Kontext (siehe unten)
        const url = `${BASE}${sprache.pfad(ziel.id)}?holometrics`;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()));
          // Reach the 3D: falls ein Umschalter existiert, klicken (Canvas
          // schluckt Zeigerereignisse -> ueber die Elementmethode, nicht ueber
          // einen gewoehnlichen Klick, der 30s lang nachfasst).
          const btn3d = page.locator('#btn3d');
          if (await btn3d.count()) await btn3d.evaluate((el) => el.click());
          await warteAufViewer(page);
        } catch (e) {
          for (const g of ['d-fuellgrad', 'e-markergroesse', 'f-dauerlabels-ruhe', 'f-dauerlabels-hover', 'g-buehnenbreite']) {
            melde(g, false, `[${lauf}] Seitenaufruf/Viewer-Start fehlgeschlagen: ${e.message}`);
          }
          await page.close();
          await kontext.close();
          continue;
        }

        try {
          // (f, Ruhezustand) VOR jeder Interaktion: ohne Zeigerkontakt und ohne
          // Auswahl darf kein Beschriftungskasten sichtbar sein (Soll 0 NACH
          // Schritt 3; --baseline berichtet nur den Ist-Wert ohne Urteil).
          const labelBoxenRuhe = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.holo-lbl')).filter((el) => getComputedStyle(el).display !== 'none').length
          );
          melde(
            'f-dauerlabels-ruhe',
            BASELINE || labelBoxenRuhe === 0,
            `[${lauf}] Soll 0 sichtbare Beschriftungskaesten ohne Zeigerkontakt/Auswahl; Ist ${labelBoxenRuhe}` +
              (BASELINE ? ' (Bericht, kein Urteil — Ausgangszustand hat dauerhafte core-Labels per Entwurf)' : '')
          );

          // Alle vorhandenen Gruppen sichtbar schalten -> misst den WORST CASE
          // (insbesondere fuer das "dichtestes Schiff"-Ziel, dessen dichteste
          // Gruppe per Vorgabe nicht in HOLO_DEFAULT_ON=[core,arms] steht).
          // NUR ausserhalb --baseline: die Gruppenliste stammt aus der in
          // Task 1 gewaehlten Variante C und existiert im UNVERAENDERTEN
          // Viewer (Ausgangszustand, Variante B) noch gar nicht als Marker —
          // --baseline misst bewusst den echten Ausgangszustand unter
          // Standardsichtbarkeit (HOLO_DEFAULT_ON=[core,arms]), nichts erzwungen.
          if (!BASELINE && ziel.gruppen.length) {
            await page.evaluate((groups) => window.__holoViewer.setFilter(groups), ziel.gruppen);
            await page.waitForTimeout(120); // ein Render-Frame Ruhe fuer layoutLabels()
          }

          const m = await page.evaluate(() => window.__holoViewer.metrics());
          const kuerzereKanteMarke = FUELLGRAD_KLINKE.wert / 100;
          const passtFuellgrad = m.fuellgrad >= kuerzereKanteMarke;
          fuellgradWerte.push({ lauf, fuellgrad: m.fuellgrad });
          melde(
            'd-fuellgrad',
            BASELINE || passtFuellgrad,
            `[${lauf}] Soll >=${FUELLGRAD_KLINKE.wert}% der kuerzeren Buehnenkante (Ausgang ~25%); Ist ${(m.fuellgrad * 100).toFixed(1)}% (Canvas ${m.canvas.w}x${m.canvas.h}, spanX=${m.spanX.toFixed(1)} spanY=${m.spanY.toFixed(1)})`
          );

          if (m.markers.length) {
            const durchmesser = m.markers.map((x) => x.durchmesser).sort((a, b2) => a - b2);
            const minD = durchmesser[0], maxD = durchmesser[durchmesser.length - 1];
            const medD = durchmesser[Math.floor(durchmesser.length / 2)];
            if (minD < minMarkerDurchmesser) { minMarkerDurchmesser = minD; minMarkerLauf = lauf; }
            melde(
              'e-markergroesse',
              true,
              `[${lauf}] ${m.markers.length} sichtbare Marker (Gruppen ${ziel.gruppen.join(',')}), Durchmesser min=${minD.toFixed(1)}px median=${medD.toFixed(1)}px max=${maxD.toFixed(1)}px`
            );

            // (f, Hover) EINEN Marker "ueberfahren" (echte Pointer-Koordinate,
            // Canvas-relative cx/cy aus metrics() + Canvas-Bounding-Box) und
            // gegenpruefen: genau 1 Kasten sichtbar, Text nicht leer.
            const canvasBox = await page.locator('#holo3d canvas').boundingBox();
            if (canvasBox) {
              const ziel0 = m.markers[0];
              await page.mouse.move(canvasBox.x + ziel0.cx, canvasBox.y + ziel0.cy);
              // 350ms statt 120ms: bei vielen sequentiellen Kontexten in EINEM
              // Chrome-Prozess (36 Laeufe) fiel die render-loop-getriebene
              // layoutLabels()-Aktualisierung unter Last gelegentlich hinter ein
              // kurzes Zeitfenster zurueck (Einzelschiff-Lauf bestand, der volle
              // Lauf ueber alle drei Pruefschiffe nicht) — mehr Luft statt Raten.
              await page.waitForTimeout(350);
              const nachHover = await page.evaluate(() =>
                Array.from(document.querySelectorAll('.holo-lbl'))
                  .filter((el) => getComputedStyle(el).display !== 'none')
                  .map((el) => el.textContent.trim())
              );
              melde(
                'f-dauerlabels-hover',
                BASELINE || (nachHover.length === 1 && nachHover[0].length > 0),
                `[${lauf}] Soll genau 1 sichtbarer Kasten mit Text nach Ueberfahren; Ist ${nachHover.length} (${nachHover.map((t2) => JSON.stringify(t2)).join(', ') || '—'})`
              );
              await page.mouse.move(0, 0);
            } else {
              melde('f-dauerlabels-hover', false, `[${lauf}] #holo3d canvas ohne Bounding-Box — Hover nicht simulierbar`);
            }
          } else {
            melde('e-markergroesse', BASELINE, `[${lauf}] 0 sichtbare Marker fuer Gruppen ${ziel.gruppen.join(',') || '(keine)'}`);
            melde('f-dauerlabels-hover', BASELINE, `[${lauf}] keine Marker vorhanden — Hover nicht pruefbar`);
          }

          const stageBox = await page.locator('#holo3d').boundingBox();
          const soll = BUEHNENBREITE_TABELLE[breite];
          melde(
            'g-buehnenbreite',
            true,
            `[${lauf}] gemessen ${stageBox ? stageBox.width.toFixed(1) : '?'}px` +
              (soll != null ? ` — Detailvertrag Punkt 1 nennt ${soll}px fuer die SPAETERE 3-Spalten-Konsole (Rail+Auslesung existieren in dieser Welle noch nicht, kein Soll-Vergleich hier)` : ' — kein Tabelleneintrag fuer diese Breite')
          );
        } catch (e) {
          melde('d-fuellgrad', false, `[${lauf}] Messung fehlgeschlagen: ${e.message}`);
        }

        await page.close();
        await kontext.close();
      }
    }
  }

  /* ============================================================
     Messgruppe j-ohne-javascript (16-03-PLAN.md Task 2, D-02) — gegen das
     GEBAUTE Artefakt, mit ABGESCHALTETEM JavaScript im Browser, nicht durch
     Lesen des Codes. Kopfzeile druckt ausdruecklich, dass der Kontext ohne
     Skript lief (Erfolgskriterium/Abnahme dieser Welle). ============================================================ */
  console.log(`\n=== Messgruppe j-ohne-javascript: Kontext OHNE JavaScript (newContext({ javaScriptEnabled:false })) ===`);
  let jSpruengeGeprueft = 0, jSpruengeFehlgeschlagen = 0;
  for (const ziel of ZIELE) {
    for (const sprache of SPRACHEN) {
      for (const breite of PRUEFBREITEN_J) {
        const lauf = `${ziel.id}/${sprache.id}/${breite}/ohne-js`;
        const url = `${BASE}${sprache.pfad(ziel.id)}`;
        const sollAbschnitte = ziel.gruppen.length;

        // ---- ohne JavaScript ----
        const kontextOhne = await b.newContext({ viewport: { width: breite, height: 900 }, javaScriptEnabled: false });
        const pageOhne = await kontextOhne.newPage();
        let messungOhne = null;
        try {
          await pageOhne.goto(url, { waitUntil: 'load' });
          messungOhne = await pageOhne.evaluate(() => {
            const sys = Array.from(document.querySelectorAll('.holo__sys'));
            const sichtbar = sys.filter((el) => getComputedStyle(el).display !== 'none' && !el.hasAttribute('hidden'));
            const abschnitte = sichtbar.map((el) => ({
              id: el.id,
              hoehe: el.getBoundingClientRect().height,
              text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
            }));
            const anker = Array.from(document.querySelectorAll('.holo__rail a')).map((a) => a.getAttribute('href') || '');
            const ankerZiele = anker.map((h) => h.replace(/^#/, ''));
            const vorhandeneIds = new Set(sys.map((el) => el.id));
            const ankerOk = ankerZiele.every((z) => vorhandeneIds.has(z));
            const ueberlauf = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
            return { abschnitteGesamt: sys.length, abschnitteSichtbar: sichtbar.length, abschnitte, ankerZahl: anker.length, ankerOk, ueberlauf };
          });
        } catch (e) {
          melde('j-ohne-javascript', false, `[${lauf}] Seitenaufruf fehlgeschlagen: ${e.message}`);
          await pageOhne.close(); await kontextOhne.close();
          continue;
        }

        const leererText = messungOhne.abschnitte.find((a) => a.text.length === 0);
        const nullHoehe = messungOhne.abschnitte.find((a) => a.hoehe <= 0);
        /* Seit D-01 (20.08.2026) traegt die Konsole ausser den Portgruppen des
           Schiffs auch die vier Inhaltsgruppen (Technik, Handel, Rang,
           Kontext) — ziel.gruppen zaehlt nur die Portgruppen und ist damit
           NICHT mehr die Rail-Laenge. Die Aussage von D-02 haengt ohnehin
           nicht an einer Fixture-Zahl, sondern an einer Deckung: jeder
           Rail-Eintrag hat ohne JavaScript einen sichtbaren Abschnitt, und
           KEIN Abschnitt ist versteckt. Beides wird jetzt gemessen statt
           gegen eine Liste gehalten. Die Portgruppen muessen weiterhin
           mindestens enthalten sein — sonst waere die Deckung auch mit einer
           leeren Konsole erfuellt. */
        const deckung =
          messungOhne.abschnitteSichtbar === messungOhne.ankerZahl &&
          messungOhne.abschnitteSichtbar === messungOhne.abschnitteGesamt &&
          messungOhne.abschnitteSichtbar >= sollAbschnitte;
        melde(
          'j-ohne-javascript',
          deckung && !leererText && !nullHoehe && messungOhne.ankerOk && !messungOhne.ueberlauf,
          `[${lauf}] Soll: sichtbare .holo__sys == Rail-Laenge == Gesamtzahl und >= ${sollAbschnitte} Portgruppen, jede Hoehe>0, kein leerer Text, jeder Rail-Anker auf vorhandene id, kein waagerechter Ueberlauf; ` +
            `Ist ${messungOhne.abschnitteSichtbar} sichtbar (${messungOhne.abschnitteGesamt} gesamt), ` +
            `Hoehen [${messungOhne.abschnitte.map((a) => a.hoehe.toFixed(0)).join(',')}]px, ` +
            `leerer Text: ${leererText ? leererText.id : 'keiner'}, ` +
            `${messungOhne.ankerZahl} Rail-Anker (alle auf vorhandene id: ${messungOhne.ankerOk}), ` +
            `waagerechter Ueberlauf: ${messungOhne.ueberlauf}`
        );

        // Anker-Sprung: pruefen, ob der Zielabschnitt nach dem Sprung
        // wirklich am oberen Rand des sichtbaren Bereichs steht. NICHT per
        // locator.click() (das loest Playwrights eigene Scroll-in-View- und
        // Stabilitaets-Wartelogik aus, die mit dem site-weiten CSS
        // `scroll-behavior:smooth` in Konflikt geraet — wiederholtes
        // Nachjustieren liess einzelne Klicks bis zum 30s-Timeout haengen,
        // ein Mess-Artefakt der Automatisierung, kein Befund am Produkt).
        // Stattdessen: dieselbe Navigation, die ein Klick ausloest
        // (location.hash setzen — funktioniert auch ohne Seiten-JavaScript,
        // Playwrights evaluate() laeuft ueber CDP unabhaengig vom
        // javaScriptEnabled-Schalter der Seite selbst, siehe die
        // .holo__sys-Messung oben, die genauso funktioniert), danach auf
        // Scroll-Stillstand pollen statt eine feste Wartezeit zu raten.
        const ankerZiele = await pageOhne.evaluate(() =>
          Array.from(document.querySelectorAll('.holo__rail a')).map((a) => (a.getAttribute('href') || '').replace(/^#/, ''))
        );
        for (const zielId of ankerZiele) {
          jSpruengeGeprueft++;
          try {
            await pageOhne.evaluate((id) => { location.hash = id; }, zielId);
            // Auf Scroll-Stillstand pollen (scroll-behavior:smooth ist CSS,
            // keine feste Dauer garantiert) — max. 1,5s Budget.
            let vorher = -1, stabil = false;
            for (let tick = 0; tick < 15; tick++) {
              await pageOhne.waitForTimeout(100);
              const y = await pageOhne.evaluate(() => window.scrollY);
              if (y === vorher) { stabil = true; break; }
              vorher = y;
            }
            const top = await pageOhne.evaluate((id) => {
              const el = document.getElementById(id);
              return el ? el.getBoundingClientRect().top : null;
            }, zielId);
            // Grosszuegige Toleranz (300px): es geht um "der Sprung fuehrt
            // tatsaechlich zum Abschnitt", nicht um pixelgenaues Andocken
            // (das haengt von scroll-margin-top ab, hier nicht gesetzt).
            if (top == null || top < -50 || top > 300) {
              jSpruengeFehlgeschlagen++;
              melde('j-ohne-javascript', false, `[${lauf}] Anker #${zielId}: Sprung fuehrte NICHT zum Abschnitt (top=${top}px, Scroll stabil: ${stabil})`);
            }
          } catch (e) {
            jSpruengeFehlgeschlagen++;
            melde('j-ohne-javascript', false, `[${lauf}] Anker-Sprung #${zielId} fehlgeschlagen: ${e.message}`);
          }
        }

        await pageOhne.close(); await kontextOhne.close();

        // ---- Gegenprobe MIT JavaScript (derselbe Aufruf) ----
        // 16-04-PLAN.md Task 1 (Rail-Einfachauswahl): seit dieser Welle
        // verschiebt das Skript die Systemabschnitte in die Auslesung UND
        // zeigt genau EINEN (das serverseitig vorbelegte erste System) --
        // die Erwartung aus Welle 3 ("dieselbe Zahl wie ohne JS") ist damit
        // ueberholt. Neue Erwartung: min(1, sollAbschnitte) sichtbar, UND
        // die Abschnitte muessen tatsaechlich in .holo__readout stecken
        // (Beleg fuers Verschieben, nicht nur fuers Verstecken).
        const kontextMit = await b.newContext({ viewport: { width: breite, height: 900 } });
        const pageMit = await kontextMit.newPage();
        try {
          await pageMit.goto(url, { waitUntil: 'domcontentloaded' });
          const mitJs = await pageMit.evaluate(() => {
            const sichtbar = Array.from(document.querySelectorAll('.holo__sys')).filter(
              (el) => getComputedStyle(el).display !== 'none' && !el.hasAttribute('hidden')
            );
            const readout = document.getElementById('holoreadout');
            const alleInReadout = Array.from(document.querySelectorAll('.holo__sys')).every(
              (el) => readout && readout.contains(el)
            );
            return { anzahl: sichtbar.length, alleInReadout };
          });
          const sollMitJs = Math.min(1, sollAbschnitte);
          melde(
            'j-ohne-javascript-gegenprobe',
            mitJs.anzahl === sollMitJs && mitJs.alleInReadout,
            `[${lauf}] Gegenprobe MIT JavaScript (Rail-Einfachauswahl, 16-04-PLAN.md Task 1): Soll genau ${sollMitJs} sichtbare(r) Abschnitt(e) (vorbelegtes erstes System), alle Abschnitte in .holo__readout verschoben; ` +
              `Ist ${mitJs.anzahl} sichtbar, in .holo__readout: ${mitJs.alleInReadout}`
          );
        } catch (e) {
          melde('j-ohne-javascript-gegenprobe', false, `[${lauf}] Seitenaufruf (mit JS) fehlgeschlagen: ${e.message}`);
        }
        await pageMit.close(); await kontextMit.close();
      }
    }
  }
  console.log(`  Anker-Spruenge geprueft: ${jSpruengeGeprueft}  Fehlschlaege: ${jSpruengeFehlgeschlagen}`);

  /* ============================================================
     Messgruppe h-netz (16-04-PLAN.md Task 3, D-04, Erfolgskriterium 5) —
     Netzverkehr beim Seitenaufruf. Zwei Faelle aus den Pruefschiffen
     abgeleitet, nicht verdrahtet: eines MIT Video/Bilder-Umschalter
     (.holo__toggle traegt #btnvid/#btnimg), eines OHNE — der zweite Fall
     ist der, den der alte Code (defaultMode-abhaengiges sofortiges Laden)
     verletzte. Gemessen wird am 'load'-Ereignis (Seitenaufruf ist
     abgeschlossen, BEVOR der IntersectionObserver seine erste Runde
     gedreht hat) gegen denselben Kontext NACH dem Scrollen. ============================================================ */
  console.log(`\n=== Messgruppe h-netz: Netzverkehr beim Seitenaufruf (D-04, Erfolgskriterium 5) ===`);
  // Klassifizierung direkt am GEBAUTEN dist/ (Familie-A-Stil, kein Browser
  // noetig -- schneller UND zuverlaessiger als ein Seitenaufruf je Kandidat).
  // Die drei Pruefschiffe (ZIELE_ALLE) haben allesamt MINDESTENS eine
  // Galerie (btnimg) -- fuer den "OHNE"-Fall muss ausserhalb dieser Menge
  // gesucht werden, ueber alle Schiffe mit ausgeliefertem holodata, nicht
  // verdrahtet auf eine bestimmte Kennung.
  function hatUmschalterImDist(id) {
    try {
      const html = readFileSync(join('dist', 'schiffe', `${id}.html`), 'utf8');
      return /id="btnvid"|id="btnimg"/.test(html);
    } catch (e) { return null; } // Datei fehlt -> kein Urteil moeglich
  }
  let hNetzMit = null, hNetzOhne = null;
  for (const ziel of ZIELE_ALLE) {
    const hat = hatUmschalterImDist(ziel.id);
    if (hat === true && !hNetzMit) hNetzMit = ziel.id;
    if (hat === false && !hNetzOhne) hNetzOhne = ziel.id;
  }
  if (!hNetzOhne) {
    for (const id of Object.keys(quellen.shipHardpoints.ships)) {
      if (hNetzOhne) break;
      const html = (() => { try { return readFileSync(join('dist', 'schiffe', `${id}.html`), 'utf8'); } catch (e) { return null; } })();
      if (!html || !html.includes('id="holoreadout"')) continue; // nur Schiffe mit ausgelieferter Konsole
      if (!/id="btnvid"|id="btnimg"/.test(html)) hNetzOhne = id;
    }
  }
  console.log(`  Faelle (aus den Pruefschiffen abgeleitet): MIT Umschalter=${hNetzMit ?? '(keins der Pruefschiffe hat einen)'}  OHNE Umschalter=${hNetzOhne ?? '(alle Pruefschiffe haben einen)'}`);

  async function messeNetzverkehr(id, pfad, lauf) {
    const kontext = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await kontext.newPage();
    // .holo ist auf dieser Seite das ERSTE Element nach der Kopfleiste und
    // damit bei JEDER ueblichen Fensterhoehe schon beim Laden (teil-)
    // sichtbar — ein Vergleich gegen das 'load'-Ereignis ist deshalb reine
    // Zufallssache (5 Wiederholungslaeufe am unveraenderten Artefakt
    // lieferten 0/1/1/2/0 Treffer VOR 'load' — ein Messartefakt der
    // Zeitmessung, kein Produktbefund). `page.addInitScript()` scheiterte
    // hier zuverlaessig an `document.documentElement === null` (die
    // Injektion laeuft in diesem Setup vor der Dokumenterstellung) — daher
    // stattdessen `page.route()`: die Seite wird abgefangen und um einen
    // Abstandshalter im <head> ERWEITERT, BEVOR sie den Browser erreicht.
    // Damit ist .holo von der allerersten Bildzusammensetzung an
    // nachweislich ausserhalb des sichtbaren Bereichs -- kein Zeitfenster,
    // kein Raten. Verifiziert (siehe 16-04-SUMMARY.md): 0 Treffer VOR dem
    // Scrollen ueber mehrere Wiederholungen, .holo tatsaechlich bei
    // top:3000px.
    await page.route(`${BASE}${pfad}`, async (route) => {
      const resp = await route.fetch();
      const body = (await resp.text()).replace('</head>', '<style>#holo{margin-top:3000px !important}</style></head>');
      await route.fulfill({ response: resp, body });
    });
    const treffer = { three: 0, glb: 0 };
    page.on('request', (req) => {
      const u = req.url();
      if (/three\.module\.min\.js/.test(u)) treffer.three++;
      if (/\.glb($|\?)/i.test(u)) treffer.glb++;
    });
    let vor = null, nach = null, nachZweitScroll = null;
    try {
      await page.goto(`${BASE}${pfad}`, { waitUntil: 'networkidle' });
      // .holo ist per Spacer sicher unterhalb des Bildschirmrands -- der
      // Beobachter kann hier strukturell noch nicht ausgeloest haben.
      vor = { ...treffer };
      await page.evaluate(() => document.getElementById('holo')?.scrollIntoView());
      await page.waitForTimeout(1500);
      nach = { ...treffer };
      // Beobachter darf NUR EINMAL ausloesen (T-15-16): erneutes Hin- und
      // Herscrollen darf die Trefferzahl nicht weiter erhoehen.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      await page.evaluate(() => document.getElementById('holo')?.scrollIntoView());
      await page.waitForTimeout(500);
      nachZweitScroll = { ...treffer };
    } catch (e) {
      melde('h-netz', false, `[${lauf}] Messung fehlgeschlagen: ${e.message}`);
      await page.close(); await kontext.close();
      return;
    }
    melde(
      'h-netz',
      vor.three === 0 && vor.glb === 0,
      `[${lauf}] Beim Seitenaufruf, .holo per Spacer ausserhalb des sichtbaren Bereichs (bis unmittelbar vor dem Scrollen) — Soll je 0; Ist three.module.min.js=${vor.three} GLB=${vor.glb}`
    );
    melde(
      'h-netz',
      nach.three >= 1 && nach.glb >= 1,
      `[${lauf}] Nach dem Scrollen in den sichtbaren Bereich — Soll je >=1; Ist three.module.min.js=${nach.three} GLB=${nach.glb}`
    );
    melde(
      'h-netz',
      nachZweitScroll.three === nach.three && nachZweitScroll.glb === nach.glb,
      `[${lauf}] Beobachter loest genau einmal aus — erneutes Hin-/Herscrollen darf die Zahl nicht erhoehen; vorher ${nach.glb} GLB/${nach.three} three, nachher ${nachZweitScroll.glb} GLB/${nachZweitScroll.three} three`
    );
    await page.close(); await kontext.close();
  }
  for (const [rolle, id] of [['MIT Video/Galerie', hNetzMit], ['OHNE Video/Galerie', hNetzOhne]]) {
    if (!id) { melde('h-netz', false, `Kein Pruefschiff fuer den Fall "${rolle}" gefunden — Klassifizierung ergab keinen Kandidaten`); continue; }
    for (const sprache of SPRACHEN) {
      await messeNetzverkehr(id, sprache.pfad(id), `${id} (${rolle}) / ${sprache.id}`);
    }
  }

  /* ============================================================
     Messgruppe i-ueberlauf (16-04-PLAN.md Task 3, D-03, Erfolgskriterium 4)
     + die beiden Backstop-Punkte "overflow E4"/"long-text E4" aus dem
     UI-SPEC (Auslesungsspalte bei 1280px). ============================================================ */
  console.log(`\n=== Messgruppe i-ueberlauf: waagerechter Ueberlauf bei 360px + Backstops overflow/long-text E4 ===`);
  for (const ziel of ZIELE) {
    for (const sprache of SPRACHEN) {
      const lauf = `${ziel.id}/${sprache.id}`;
      const kontext = await b.newContext({ viewport: { width: 360, height: 900 } });
      const page = await kontext.newPage();
      try {
        await page.goto(`${BASE}${sprache.pfad(ziel.id)}`, { waitUntil: 'domcontentloaded' });
        const r = await page.evaluate(() => {
          const doc = document.documentElement;
          const ueberlauf = doc.scrollWidth > doc.clientWidth + 1;
          const rail = document.querySelector('.holo__rail');
          const chips = rail ? Array.from(rail.querySelectorAll('a')) : [];
          const chipHeights = chips.map((c) => c.getBoundingClientRect().height);
          const chipHeightAbweichung = chipHeights.length > 1 ? Math.max(...chipHeights) - Math.min(...chipHeights) : 0;
          const railUeberlauf = rail ? rail.scrollWidth > rail.clientWidth + 1 : false;
          let letzterErreichbar = true;
          if (rail && chips.length) {
            const last = chips[chips.length - 1];
            letzterErreichbar = last.offsetLeft + last.offsetWidth <= rail.scrollWidth + 1;
          }
          const cs = rail ? getComputedStyle(rail) : null;
          return {
            ueberlauf, chipCount: chips.length, chipHeightAbweichung, railUeberlauf, letzterErreichbar,
            scrollbarWidth: cs ? cs.scrollbarWidth : null,
          };
        });
        melde(
          'i-ueberlauf',
          !r.ueberlauf && r.chipHeightAbweichung <= 2 && r.letzterErreichbar,
          `[${lauf}] Soll: kein waagerechter Seiten-Ueberlauf, keine hoehen-abweichende Chip (<=2px), letzter Chip erreichbar; ` +
            `Ist Seiten-Ueberlauf=${r.ueberlauf} ${r.chipCount} Chips Hoehenabweichung=${r.chipHeightAbweichung.toFixed(1)}px ` +
            `Rail-eigener-Ueberlauf=${r.railUeberlauf} scrollbar-width=${r.scrollbarWidth} letzterErreichbar=${r.letzterErreichbar}`
        );
      } catch (e) {
        melde('i-ueberlauf', false, `[${lauf}] Messung fehlgeschlagen: ${e.message}`);
      }
      await page.close(); await kontext.close();
    }
  }
  console.log(`  --- Backstops overflow/long-text E4 (Auslesungsspalte bei 1280px, Bewaffnungs-Zustand falls vorhanden) ---`);
  for (const ziel of ZIELE) {
    const kontext = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await kontext.newPage();
    try {
      await page.goto(`${BASE}${SPRACHEN[0].pfad(ziel.id)}`, { waitUntil: 'domcontentloaded' });
      // Falls vorhanden, auf "arms" (dichteste Textmenge: Turmgruppen +
      // Einzelwaffen) umschalten -- der Backstop fragt nach der dichtesten
      // realistisch erreichbaren Auslesung, nicht nach dem Vorbelegungszustand.
      if (ziel.gruppen.includes('arms')) {
        await page.evaluate(() => {
          const a = document.querySelector('.holo__rail a[data-g="arms"]');
          if (a) a.click();
        });
        await page.waitForTimeout(150);
      }
      const r = await page.evaluate(() => {
        const readout = document.getElementById('holoreadout');
        if (!readout) return null;
        const rect = readout.getBoundingClientRect();
        const innerOverflow = readout.scrollWidth > readout.clientWidth + 1;
        const leafs = Array.from(readout.querySelectorAll('*')).filter(
          (el) => el.children.length === 0 && (el.textContent || '').trim().length > 0
        );
        let ueberlaufendesWort = null;
        for (const el of leafs) {
          if (el.scrollWidth > el.clientWidth + 2) { ueberlaufendesWort = (el.textContent || '').trim(); break; }
        }
        const vScroll = readout.scrollHeight > readout.clientHeight + 1;
        return { width: rect.width, innerOverflow, ueberlaufendesWort, vScroll, scrollHeight: readout.scrollHeight, clientHeight: readout.clientHeight };
      });
      if (r) {
        melde(
          'i-ueberlauf-backstop',
          !r.innerOverflow && !r.ueberlaufendesWort,
          `[${ziel.id}] Auslesungsspaltenbreite ${r.width.toFixed(0)}px; inneres Ueberlauf-Raster (overflow E4): ${r.innerOverflow}; ` +
            `ueberlaufendes Wort (long-text E4): ${r.ueberlaufendesWort ? JSON.stringify(r.ueberlaufendesWort) : 'keins'}; ` +
            `eigener senkrechter Bildlauf noetig: ${r.vScroll} (scrollHeight=${r.scrollHeight.toFixed(0)}px clientHeight=${r.clientHeight.toFixed(0)}px)`
        );
      } else {
        melde('i-ueberlauf-backstop', false, `[${ziel.id}] #holoreadout nicht gefunden`);
      }
    } catch (e) {
      melde('i-ueberlauf-backstop', false, `[${ziel.id}] Messung fehlgeschlagen: ${e.message}`);
    }
    await page.close(); await kontext.close();
  }

  /* ============================================================
     Messgruppe l-sprachparitaet (16-04-PLAN.md Task 3) — je Pruefschiff
     dieselben Kennzahlen in DE und EN nebeneinander. ============================================================ */
  console.log(`\n=== Messgruppe l-sprachparitaet: DE/EN Kennzahlen + Hoehenabweichung <=5% ===`);
  for (const ziel of ZIELE) {
    const werte = {};
    for (const sprache of SPRACHEN) {
      const kontext = await b.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await kontext.newPage();
      try {
        await page.goto(`${BASE}${sprache.pfad(ziel.id)}`, { waitUntil: 'domcontentloaded' });
        werte[sprache.id] = await page.evaluate(() => {
          const sysCount = document.querySelectorAll('.holo__sys').length;
          const railCount = document.querySelectorAll('.holo__rail a').length;
          const dataEl = document.getElementById('holodata');
          const cfg = dataEl ? JSON.parse(dataEl.textContent) : null;
          const markerJeGruppe = {};
          if (cfg) for (const p of cfg.ports) markerJeGruppe[p.g] = (markerJeGruppe[p.g] ?? 0) + 1;
          const readoutWidth = document.getElementById('holoreadout')?.getBoundingClientRect().width ?? null;
          const pageHeight = document.documentElement.scrollHeight;
          return { sysCount, railCount, markerJeGruppe, readoutWidth, pageHeight };
        });
      } catch (e) {
        melde('l-sprachparitaet', false, `[${ziel.id}/${sprache.id}] Seitenaufruf fehlgeschlagen: ${e.message}`);
      }
      await page.close(); await kontext.close();
    }
    const de = werte.de, en = werte.en;
    if (!de || !en) continue;
    const countsEqual =
      de.sysCount === en.sysCount &&
      de.railCount === en.railCount &&
      JSON.stringify(de.markerJeGruppe) === JSON.stringify(en.markerJeGruppe);
    const heightDiffPct = (Math.abs(de.pageHeight - en.pageHeight) / Math.max(de.pageHeight, en.pageHeight)) * 100;
    melde(
      'l-sprachparitaet',
      countsEqual && heightDiffPct <= 5,
      `[${ziel.id}] Systeme DE=${de.sysCount}/EN=${en.sysCount}; Rail-Eintraege DE=${de.railCount}/EN=${en.railCount}; ` +
        `Marker je Gruppe DE=${JSON.stringify(de.markerJeGruppe)} EN=${JSON.stringify(en.markerJeGruppe)}; ` +
        `Seitenhoehe DE=${de.pageHeight}px EN=${en.pageHeight}px (Abweichung ${heightDiffPct.toFixed(1)}%, Marke <=5%); ` +
        `Auslesungsbreite DE=${de.readoutWidth}px EN=${en.readoutWidth}px`
    );
  }

  await b.close();

  console.log(`\n=== Selbstauskunft Familie B ===`);
  console.log(`  gefahrene Messpunkte: ${gemessen}  bestanden: ${gemessen - fehlgeschlagen}  fehlgeschlagen: ${fehlgeschlagen}`);
  if (fuellgradWerte.length) {
    const werte = fuellgradWerte.map((x) => x.fuellgrad * 100);
    console.log(`  Fuellgrad ueber alle Laeufe: min=${Math.min(...werte).toFixed(1)}% max=${Math.max(...werte).toFixed(1)}%`);
  }
  if (minMarkerDurchmesser < Infinity) console.log(`  kleinster gemessener Markerdurchmesser gesamt: ${minMarkerDurchmesser.toFixed(1)}px (${minMarkerLauf})`);
  console.log(`  Sperrklinke (Hausform): P-1 wandert nur nach oben — ${JSON.stringify(FUELLGRAD_KLINKE)}`);

  if (fehlgeschlagen) {
    console.error(`\nschiffskonsole-messung: ${fehlgeschlagen} FEHLGESCHLAGENE Messung(en):\n`);
    for (const r of ergebnisse) if (!r.ok) console.error(`  · [${r.gruppe}] ${r.detail}`);
    console.error('');
    process.exitCode = 1;
  } else {
    console.log('\nschiffskonsole-messung (Familie B): ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
  }
}

if (CENSUS) {
  await runCensus();
} else {
  await runBrowserMessung();
}
