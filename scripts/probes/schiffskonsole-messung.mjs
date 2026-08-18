/* ============================================================
   schiffskonsole-messung.mjs — die drei bindenden Punkte P-1/P-2/P-3 aus
   15-UI-SPEC.md § 3a AM GERENDERTEN BILDPUNKT bzw. AM AUSGELIEFERTEN
   ARTEFAKT belegt, nicht aus der Konfiguration behauptet.

   EINE SONDE, KEIN TOR: liegt in scripts/probes/, wird von keinem
   npm-Ziel gerufen und haengt an keiner Strecke der Torkette (npm run
   gate) — scripts/verify-wiring.mjs prueft nur scripts/verify-*.mjs und
   scripts/audit-*.mjs, eine Datei unter scripts/probes/ beruehrt seine
   Bijektion nicht.

   WARUM UEBERHAUPT: der Spike vom 18.08.2026 hat am laufenden Viewer
   gemessen, dass die heutige Kamera das Konzept "Konsole" nicht traegt
   (15-UI-SPEC.md § 3a): bei 860px Ansichtsbreite fuellt das Schiff rund
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
     dieser Task darf nur die zwei in 15-01-PLAN.md Task 1 genannten
     Dateien beruehren. Aendert sich visibleText() dort, muss diese
     Kopie von Hand nachgezogen werden — an dieser Stelle vermerkt).
     Vollstaendig ab Task 1 dieses Plans.

     Familie B (Browser, playwright-core) — misst am GERENDERTEN
     Bildpunkt: Fuellgrad (d), Markergroesse (e), Dauer-Labels (f),
     Buehnenbreite (g). Kommt erst in Task 2 dieses Plans hinzu (P-3 ist
     Vorbedingung: erst die Markerdichte festlegen, dann am Bildpunkt
     messen, ob sie bei dieser Dichte noch gefunden wird).

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
/* Drei P-3-Kandidaten aus 15-01-PLAN.md Task 1 — welche Triebwerksarten
   den Stock-Loadout-Join umgehen (siehe ShipDetail.astro Z. 287-293). */
const VARIANTEN = {
  B: { bypass: new Set() }, // Ist-Zustand: Join gilt fuer ALLE Arten
  A: { bypass: new Set(THRUSTER_KINDS) }, // alle vier Triebwerksarten umgehen ihn
  C: { bypass: new Set(['thruster_main', 'thruster_retro', 'thruster_vtol']) }, // thruster_mav bleibt draussen
};
const MAX_EINZELGRUPPE = 20; // P-3-Entscheidungsregel Schritt 2 (15-01-PLAN.md)
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
   in 15-CONTEXT.md), nicht nur ein Unterausschnitt. ---------- */
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
/* Vom Planer am 18.08.2026 gegen genau diese Datei gemessen (15-01-PLAN.md
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

  const carrackDist = distCountsEn.get(CARRACK_ID);
  melde(
    'a-carrack-exakt',
    !!carrackDist && carrackDist.core === 8 && carrackDist.arms === 4 && carrackDist.other === 5 && carrackDist.prop === 0,
    `Soll core=8/arms=4/other=5/prop=0 (15-UI-SPEC.md § 3a: "17 von 60"); Ist ${carrackDist ? JSON.stringify(carrackDist) : 'Carrack nicht gefunden'}`
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

  // Gegenprobe: Variante B (Ist-Zustand) MUSS je Schiff+Gruppe exakt dem
  // ausgelieferten holodata gleichen (15-01-PLAN.md, "GEGENPROBE, nicht optional").
  let vergliechenePaare = 0, abweichungen = [];
  for (const [id, delivered] of distCountsEn) {
    const b = varStats.B.proSchiff.get(id);
    if (!b) { abweichungen.push(`${id}: aus der Quelle nicht berechenbar (kein Mesh/Hardpoint/Vehicle-Eintrag)`); continue; }
    for (const g of HOLO_GRP_ORDER) {
      vergliechenePaare++;
      if (b[g] !== delivered[g]) abweichungen.push(`${id}/${g}: ausgeliefert ${delivered[g]}, aus der Quelle (Variante B) ${b[g]}`);
    }
  }
  melde(
    'b-gegenprobe',
    abweichungen.length === 0 && vergliechenePaare >= 400,
    `Soll: 0 Abweichungen ueber >=400 verglichene Schiff-Gruppen-Paare; Ist ${vergliechenePaare} Paare verglichen, ${abweichungen.length} Abweichung(en)` +
      (abweichungen.length ? ` — ${abweichungen.slice(0, 5).join(' | ')}` : '')
  );

  // P-3-Entscheidungsregel (15-01-PLAN.md, drei Schritte):
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
        ? ' — AUSSERHALB der Toleranz, Erklaerung siehe 15-01-SUMMARY.md (Bericht statt Urteil: Messgruppe c faellt hier nicht durch, das Soll-Feld dokumentiert nur die Ausgangserwartung)'
        : '')
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
   FAMILIE B — Messung am gerenderten Bildpunkt (Browser). Kommt in Task 2
   dieses Plans hinzu; P-3 muss zuerst entschieden sein (Familie A oben),
   weil sie festlegt, mit welcher Markerdichte diese Familie rechnen muss.
   ============================================================ */
async function runBrowserMessung() {
  console.error('\nFamilie B (Browsermessung: Fuellgrad/Markergroesse/Dauerlabels/Buehnenbreite) ist in dieser Welle noch nicht gebaut — sie folgt in Task 2 dieses Plans, NACHDEM P-3 aus Familie A entschieden ist (--census). Bis dahin nur `--census` aufrufen.\n');
  process.exit(2);
}

if (CENSUS) {
  await runCensus();
} else {
  await runBrowserMessung();
}
