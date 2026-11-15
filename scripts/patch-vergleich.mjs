#!/usr/bin/env node
/* ============================================================
   patch-vergleich.mjs — was sich zwischen zwei Datenstaenden wirklich
   geaendert hat: Schiffe, Items, Bauplaene, Auftraege und neu kaufbare
   Schiffe, je Zeile mit Feld, vorher und nachher.

     node scripts/patch-vergleich.mjs --von 4.10.2 --nach 4.10.3
     node scripts/patch-vergleich.mjs --alle

   Schreibt src/data/patch-vergleich/<von>__<nach>.json und
   src/data/patch-vergleich/uebersicht.json. Gelesen wird ueber git
   (Schiene B, Betreiber-Maschine); verify:patch-vergleich prueft das
   Ergebnis ohne git.

   Der Vorher-Stand eines Paares ist der Elternstand des Datenlauf-Commits
   des Nachfolgers, nicht der Datenlauf des Vorgaengers. Zwischen zwei
   Laeufen aendert sich oft das Werkzeug (neue Felder, neue Requisiten,
   Masse aus der Implementierung): der Elternstand traegt dasselbe
   Werkzeug auf den alten Spieldaten, und nur so bleibt im Vergleich die
   Spielaenderung uebrig. LADEN prueft je Datei die Changelist, damit ein
   halb gehobener Elternstand auffaellt.
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUSGABE = resolve(ROOT, 'src/data/patch-vergleich');
const ARBEITSBAUM = 'ARBEITSBAUM';

/* ---------- Staende und Paare ---------- */

/** Changelists je Spielfassung. 4.9.0 und 4.10.2 haben je einen Hotfix-Build, den einzelne Dateien tragen. */
const STAENDE = {
  '4.9.0': { cls: ['12326004', '12344265'] },
  '4.10.0': { cls: ['12519617'] },
  '4.10.1': { cls: ['12660092'] },
  '4.10.2': { cls: ['12881860', '12913470'] },
  '4.10.3': { cls: ['13165946'] },
};

/** lauf: der Datenlauf-Commit von `nach`. vorher = lauf^, nachher = lauf (beim juengsten der Arbeitsbaum). */
const PAARE = [
  { von: '4.9.0', nach: '4.10.0', vorher: '2948bf54^', nachher: '2948bf54' },
  { von: '4.10.0', nach: '4.10.1', vorher: '8f44c69a^', nachher: '8f44c69a' },
  { von: '4.10.1', nach: '4.10.2', vorher: 'd678af9f^', nachher: 'd678af9f' },
  // nachher = Arbeitsbaum: nach dem Lauf 74f9a2ee kamen Spieldaten nach (ATLS-Varianten db84ce3c, Preise der acht neu kaufbaren Schiffe b9845b16).
  { von: '4.10.2', nach: '4.10.3', vorher: '74f9a2ee^', nachher: ARBEITSBAUM },
];

const DATEIEN = {
  vehicles: { pfad: 'src/data/vehicles.json', cl: (j) => j.gameVersion },
  items: { pfad: 'assets/universal-items.json', cl: (j) => j.gameVersion },
  crafting: { pfad: 'assets/crafting-db.json', cl: (j) => j.version },
  missions: { pfad: 'src/data/missions.json', cl: (j) => j.meta?.patch },
  prices: { pfad: 'src/data/vehicle-prices.json', cl: null },
};

function git(...args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 1 << 30 });
}

const cache = new Map();
function laden(ref, version) {
  const key = `${ref}|${version}`;
  if (cache.has(key)) return cache.get(key);
  const commit = git('rev-parse', ref === ARBEITSBAUM ? 'HEAD' : ref).trim();
  const geaendert = ref === ARBEITSBAUM
    ? git('status', '--porcelain', '--', ...Object.values(DATEIEN).map((d) => d.pfad)).trim().split('\n').filter(Boolean)
    : [];
  const daten = {};
  const cl = {};
  for (const [name, d] of Object.entries(DATEIEN)) {
    const text = ref === ARBEITSBAUM ? readFileSync(resolve(ROOT, d.pfad), 'utf8') : git('show', `${ref}:${d.pfad}`);
    const j = JSON.parse(text);
    if (d.cl) {
      const marke = String(d.cl(j) ?? '');
      const treffer = STAENDE[version].cls.find((c) => marke.includes(c));
      if (!treffer) throw new Error(`${ref}:${d.pfad} traegt "${marke}", erwartet eine Changelist von ${version} (${STAENDE[version].cls.join(', ')})`);
      cl[name] = treffer;
    }
    daten[name] = j;
  }
  const stand = {
    version,
    ref: ref === ARBEITSBAUM ? 'Arbeitsbaum' : ref,
    commit: commit.slice(0, 12),
    ...(geaendert.length ? { ungesichert: geaendert.map((z) => z.slice(3)) } : {}),
    cl,
    preiseVom: String(daten.prices.fetchedAt ?? '').slice(0, 10),
  };
  const ergebnis = { stand, daten };
  cache.set(key, ergebnis);
  return ergebnis;
}

/* ---------- Regeln: welche Felder zaehlen ---------- */

const mal = (xs) => (xs ?? []).map((x) => `${x.count ?? 1}× ${x.name}${x.size != null ? ` (S${x.size})` : ''}`).sort();
const zahl = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const SCHADEN = ['physical', 'energy', 'distortion', 'thermal', 'stun', 'biochemical'];
const SCHADEN_DE = { physical: 'physisch', energy: 'Energie', distortion: 'Verzerrung', thermal: 'thermisch', stun: 'Betäubung', biochemical: 'biochemisch' };

/**
 * Bis 4.10.1 gab es Bauplaene mit gleicher guid und anderen Zutaten (FoxFire:
 * Torite statt Tungsten). Der zweite heisst <guid>#2, geordnet nach Zutaten,
 * damit dieselbe Variante in beiden Staenden denselben Schluessel bekommt.
 */
function bauplaeneMitSchluessel(liste) {
  const zutaten = (b) => JSON.stringify(b.ingredients ?? []);
  const gruppen = Map.groupBy(liste, (b) => b.entity_guid);
  return [...gruppen.values()].flatMap((g) => g.sort((a, b) => zutaten(a).localeCompare(zutaten(b)))
    .map((b, i) => ({ ...b, schluessel: i ? `${b.entity_guid}#${i + 1}` : b.entity_guid })));
}

/**
 * Je Art: Schluessel (stabil ueber Patches), Name, Seiten-Slug und die Felder,
 * die als Aenderung zaehlen. Nicht drin, mit Absicht: Beschreibungen,
 * Fremdwerte (Pledge, Abmessungen, Bilder, Hoechstcrew, Status, UEX-Preise,
 * Fundorte, Shops), Signaturen, Temperaturen, Resistenzen.
 * toleranz: absolute Grenze, darunter ist es Rundungsrauschen der Extraktion.
 */
const REGELN = {
  ship: {
    liste: (d) => d.vehicles.vehicles,
    schluessel: (v) => v.id,
    slug: (v) => v.id,
    name: (v) => v.name,
    felder: [
      ['crewMin', 'Mindestcrew', 'Minimum crew', (v) => zahl(v.crewMin)],
      ['sizeClass', 'Größenklasse', 'Size class', (v) => zahl(v.sizeClass)],
      ['hullHp', 'Hülle (HP)', 'Hull (HP)', (v) => zahl(v.hullHp)],
      ['shieldHp', 'Schild (HP)', 'Shield (HP)', (v) => zahl(v.shieldHp)],
      ['scmSpeed', 'SCM (m/s)', 'SCM (m/s)', (v) => zahl(v.scmSpeed)],
      ['maxSpeed', 'Max (m/s)', 'Max (m/s)', (v) => zahl(v.maxSpeed)],
      ['boostForward', 'Boost vorwärts (m/s)', 'Forward boost (m/s)', (v) => zahl(v.boostForward)],
      ['pitch', 'Nicken (°/s)', 'Pitch (°/s)', (v) => zahl(v.pitch)],
      ['yaw', 'Gieren (°/s)', 'Yaw (°/s)', (v) => zahl(v.yaw)],
      ['roll', 'Rollen (°/s)', 'Roll (°/s)', (v) => zahl(v.roll)],
      ['massKg', 'Masse (kg)', 'Mass (kg)', (v) => zahl(v.massKg), 1],
      ['cargoSCU', 'Fracht (SCU)', 'Cargo (SCU)', (v) => zahl(v.cargoSCU)],
      ['oreSCU', 'Erz (SCU)', 'Ore (SCU)', (v) => zahl(v.oreSCU)],
      ['qtSpeedMs', 'Quantengeschwindigkeit (m/s)', 'Quantum speed (m/s)', (v) => zahl(v.qtSpeedMs), 1],
      ['qtRangeM', 'Quantenreichweite (m)', 'Quantum range (m)', (v) => zahl(v.qtRangeM), 1000],
      ['qtFuel', 'Quantentreibstoff', 'Quantum fuel', (v) => zahl(v.qtFuel)],
      ['h2Fuel', 'Wasserstoff', 'Hydrogen fuel', (v) => zahl(v.h2Fuel)],
      ['insClaimMin', 'Versicherung, Anspruch (min)', 'Insurance claim (min)', (v) => zahl(v.insClaimMin)],
      ['pilotDps', 'Pilot-DPS', 'Pilot DPS', (v) => zahl(v.pilotDps), 0.5],
      ['turretDps', 'Turm-DPS', 'Turret DPS', (v) => zahl(v.turretDps), 0.5],
      ['missileCount', 'Raketen', 'Missiles', (v) => zahl(v.missileCount)],
      ['cmLaunchers', 'Täuschkörperwerfer', 'Countermeasure launchers', (v) => zahl(v.cmLaunchers)],
      ['fixedWeapons', 'Waffen', 'Weapons', (v) => mal(v.fixedWeapons)],
      ['turretWeapons', 'Turmwaffen', 'Turret weapons', (v) => mal(v.turretWeapons)],
      ['missileRacks', 'Raketenbestückung', 'Missile loadout', (v) => mal(v.missileRacks)],
      ['powerPlants', 'Kraftwerk', 'Power plant', (v) => mal(v.components?.powerPlants)],
      ['shields', 'Schildgenerator', 'Shield generator', (v) => mal(v.components?.shields)],
      ['coolers', 'Kühler', 'Cooler', (v) => mal(v.components?.coolers)],
      ['quantumDrives', 'Quantenantrieb', 'Quantum drive', (v) => mal(v.components?.quantumDrives)],
      ['radars', 'Radar', 'Radar', (v) => mal(v.components?.radars)],
    ],
  },
  item: {
    // Nur Items aus dem Spiel: Katalog-Eintraege ohne guid kommen aus Fremdquellen.
    liste: (d) => d.items.items.filter((i) => i.game?.guid),
    schluessel: (i) => i.game.guid,
    nebenschluessel: (i) => [...(i.game.guidAliases ?? []), ...(i.game.variants ?? []).map((v) => v.guid).filter(Boolean)],
    slug: (i) => i.id,
    name: (i) => i.name,
    felder: [
      ['size', 'Größe', 'Size', (i) => zahl(i.game.size)],
      ['grade', 'Grade', 'Grade', (i) => i.game.grade ?? null],
      ['class', 'Klasse', 'Class', (i) => i.game.class ?? null],
      ['dps', 'DPS', 'DPS', (i) => zahl(i.game.stats?.dps), 0.5],
      ...SCHADEN.map((t) => [`damage.${t}`, `Schaden je Schuss, ${SCHADEN_DE[t]}`, `Damage per shot, ${t}`, (i) => zahl(i.game.stats?.damage?.[t]), 0.05]),
      ['fireRate', 'Feuerrate (/min)', 'Fire rate (/min)', (i) => zahl(i.game.stats?.fireRate)],
      ['range', 'Reichweite (m)', 'Range (m)', (i) => zahl(i.game.stats?.range), 1],
      ['speed', 'Projektilgeschwindigkeit (m/s)', 'Projectile speed (m/s)', (i) => zahl(i.game.stats?.speed), 1],
      ['ammoLoad', 'Munition', 'Ammo', (i) => zahl(i.game.stats?.ammoLoad)],
      ['magazine', 'Magazin', 'Magazine', (i) => zahl(i.game.stats?.magazine)],
      ['health', 'Lebenspunkte', 'Health', (i) => zahl(i.game.stats?.health), 1],
      ['shieldHp', 'Schild (HP)', 'Shield (HP)', (i) => zahl(i.game.stats?.shieldHp), 1],
      ['regen', 'Schild-Regeneration', 'Shield regen', (i) => zahl(i.game.stats?.regen)],
      ['powerOutput', 'Leistung', 'Power output', (i) => zahl(i.game.stats?.powerOutput)],
      ['coolingRate', 'Kühlrate', 'Cooling rate', (i) => zahl(i.game.stats?.coolingRate)],
      ['driveSpeed', 'Quantengeschwindigkeit (m/s)', 'Quantum speed (m/s)', (i) => zahl(i.game.stats?.driveSpeed), 1],
      ['spoolTime', 'Anlaufzeit (s)', 'Spool time (s)', (i) => zahl(i.game.stats?.spoolTime)],
      ['fuelCapacity', 'Tankinhalt', 'Fuel capacity', (i) => zahl(i.game.stats?.fuelCapacity)],
      ['armTime', 'Scharfschaltzeit (s)', 'Arm time (s)', (i) => zahl(i.game.stats?.armTime)],
      ['blastRadius', 'Explosionsradius (m)', 'Blast radius (m)', (i) => zahl(i.game.stats?.blastRadius)],
      ['lockRange', 'Aufschaltreichweite (m)', 'Lock range (m)', (i) => zahl(i.game.stats?.lockRange), 1],
      ['lockTime', 'Aufschaltzeit (s)', 'Lock time (s)', (i) => zahl(i.game.stats?.lockTime)],
    ],
  },
  blueprint: {
    liste: (d) => bauplaeneMitSchluessel(d.crafting.blueprints),
    schluessel: (b) => b.schluessel,
    name: (b) => b.name,
    felder: [
      ['craft_time_seconds', 'Herstellzeit (s)', 'Craft time (s)', (b) => zahl(b.craft_time_seconds)],
      ['tiers', 'Stufen', 'Tiers', (b) => zahl(b.tiers)],
      ['ingredients', 'Zutaten', 'Ingredients', (b) => (b.ingredients ?? []).map((s) => `${s.slot}: ${(s.options ?? []).map((o) => `${o.name} ${o.quantity_scu ?? '?'} SCU${o.min_quality ? ` (ab Q${o.min_quality})` : ''}`).join(' / ')}`).sort()],
      ['missions', 'Aufträge mit diesem Bauplan', 'Contracts rewarding it', (b) => [...new Set((b.missions ?? []).map((m) => m.id))].sort()],
    ],
  },
  mission: {
    liste: (d) => d.missions.missions,
    schluessel: (m) => m.slug,
    slug: (m) => m.slug,
    name: (m) => m.title,
    felder: [
      ['ranks', 'Ränge', 'Ranks', (m) => (m.ranks?.length ? [m.ranks.join(' → ')] : [])],
      ['rewardMin', 'Belohnung ab (aUEC)', 'Reward from (aUEC)', (m) => zahl(m.rewardMin)],
      ['rewardMax', 'Belohnung bis (aUEC)', 'Reward up to (aUEC)', (m) => zahl(m.rewardMax)],
      ['shareable', 'Teilbar', 'Shareable', (m) => m.shareable ?? null],
      // Bis 4.10.2 stand fuer "unbelegt" 1 oder -1, ab dem 4.10.3-Lauf null (Erzeuger seit 661a69c8).
      ['maxPlayers', 'Höchstzahl Spieler', 'Max players', (m) => (m.maxPlayers > 1 ? m.maxPlayers : null)],
      ['lawful', 'Legal', 'Lawful', (m) => m.lawful ?? null],
      ['blueprints', 'Baupläne als Belohnung', 'Blueprint rewards', (m) => [...new Set((m.blueprints ?? []).flatMap((p) => p.blueprints.map((b) => b.name)))].length],
      ['giverNames', 'Auftraggeber', 'Contractor', (m) => [...(m.giverNames ?? [])].sort()],
    ],
  },
};

/**
 * Benannte Ausnahmen: Unterschiede, die das Werkzeug zwischen Lauf und
 * Arbeitsbaum erzeugt hat, nicht das Spiel. Trifft eine Ausnahme nichts
 * mehr, bricht der Lauf ab (Zombie-Waechter).
 */
const AUSNAHMEN = [
  {
    paar: '4.10.2__4.10.3', kind: 'ship', feld: 'fixedWeapons',
    ids: ['argo-atls', 'argo-atls-geo', 'argo-atls-geo-collector-grad01', 'argo-atls-geo-collector-grad03'],
    anlass: 'db84ce3c liest die ATLS-Varianten erstmals vollstaendig aus; Traktorstrahl und Bergbaulaser hatten sie vorher auch',
  },
];

/* ---------- Vergleich ---------- */

const runde = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x);
function gleich(a, b, toleranz = 0.01) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  // Ein Einzelwert, der auf einer Seite fehlt, ist eine Erfassungsluecke, keine Spielaenderung.
  if (a == null || b == null) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= Math.max(toleranz, 0.001 * Math.max(Math.abs(a), Math.abs(b)));
  return a === b;
}
const leer = (x) => x == null || (Array.isArray(x) && x.length === 0);

/** Felder, die ein Stand gar nicht kennt (Werkzeug lieferte sie noch nicht), fallen fuer das ganze Paar heraus. */
function gemeinsameFelder(regel, alt, neu) {
  const kennt = (liste, f) => liste.some((x) => !leer(f[3](x)));
  return regel.felder.filter((f) => kennt(alt, f) && kennt(neu, f));
}

function zuordnen(regel, alt, neu) {
  const paare = [];
  const neuNach = new Map(neu.map((x) => [regel.schluessel(x), x]));
  const offenAlt = [];
  const belegt = new Set();
  for (const a of alt) {
    const n = neuNach.get(regel.schluessel(a));
    if (n && !belegt.has(n)) { paare.push([a, n]); belegt.add(n); } else offenAlt.push(a);
  }
  let offenNeu = neu.filter((n) => !belegt.has(n));
  // Item-Dedupe zieht gleichnamige Spiel-Items zusammen; welche guid oben steht, kann wechseln.
  if (regel.nebenschluessel && offenAlt.length && offenNeu.length) {
    const alle = (x) => new Set([regel.schluessel(x), ...regel.nebenschluessel(x)]);
    for (const a of [...offenAlt]) {
      const ga = alle(a);
      const n = offenNeu.find((x) => [...alle(x)].some((g) => ga.has(g)));
      if (n) { paare.push([a, n]); offenAlt.splice(offenAlt.indexOf(a), 1); offenNeu = offenNeu.filter((x) => x !== n); }
    }
  }
  return { paare, entfernt: offenAlt, neu: offenNeu };
}

/** Missionsfamilien haben keinen stabilen Schluessel ausser ihren Varianten; ein neuer Titel ist ein neuer Slug. */
function missionsUmbenennungen(alt, neu) {
  const umbenannt = [];
  const keys = (m) => new Set((m.variants ?? []).map((v) => v.key));
  for (const a of [...alt]) {
    const ka = keys(a);
    if (!ka.size) continue;
    const n = neu.find((x) => {
      const kn = keys(x);
      const schnitt = [...ka].filter((k) => kn.has(k)).length;
      return schnitt / new Set([...ka, ...kn]).size >= 0.5;
    });
    if (n) { umbenannt.push([a, n]); alt.splice(alt.indexOf(a), 1); neu.splice(neu.indexOf(n), 1); }
  }
  return umbenannt;
}

function werte(felder, x) {
  return felder.map(([feld, , , f]) => ({ feld, wert: runde(f(x)) })).filter((w) => !leer(w.wert));
}

function vergleicheArt(kind, regel, altDaten, neuDaten, ausnahmen) {
  const alt = regel.liste(altDaten);
  const neu = regel.liste(neuDaten);
  const felder = gemeinsameFelder(regel, alt, neu);
  const { paare, entfernt, neu: neuOffen } = zuordnen(regel, alt, neu);
  if (kind === 'mission') paare.push(...missionsUmbenennungen(entfernt, neuOffen));
  const eintrag = (x, extra) => ({ kind, id: regel.schluessel(x), ...(regel.slug ? { slug: regel.slug(x) } : {}), name: regel.name(x), ...extra });
  const out = [];
  for (const [a, n] of paare) {
    const diff = [];
    for (const [feld, , , f, toleranz] of felder) {
      const va = f(a), vn = f(n);
      const ausnahme = ausnahmen.find((x) => x.feld === feld && x.ids.includes(regel.schluessel(n)));
      if (ausnahme && !gleich(va, vn, toleranz)) { ausnahme.treffer = (ausnahme.treffer ?? 0) + 1; continue; }
      if (!gleich(va, vn, toleranz)) diff.push({ feld, vorher: runde(va ?? null), nachher: runde(vn ?? null) });
    }
    const umbenannt = regel.name(a) !== regel.name(n);
    if (umbenannt) out.push(eintrag(n, { change: 'renamed', nameVorher: regel.name(a), ...(regel.slug && regel.slug(a) !== regel.slug(n) ? { slugVorher: regel.slug(a) } : {}), felder: diff }));
    else if (diff.length) out.push(eintrag(n, { change: 'changed', felder: diff }));
  }
  for (const n of neuOffen) out.push(eintrag(n, { change: 'new', werte: werte(felder, n) }));
  for (const a of entfernt) out.push(eintrag(a, { change: 'removed' }));
  return { eintraege: out, felder: felder.map((f) => f[0]), bestand: { vorher: alt.length, nachher: neu.length } };
}

function vergleichePreise(altDaten, neuDaten) {
  const kaufbar = (d) => new Map(Object.entries(d.prices.prices).filter(([, p]) => p.buy?.length));
  const namen = new Map([...altDaten.vehicles.vehicles, ...neuDaten.vehicles.vehicles].map((v) => [v.id, v.name]));
  const alt = kaufbar(altDaten), neu = kaufbar(neuDaten);
  const out = [];
  for (const [id, p] of neu) {
    if (alt.has(id)) continue;
    const angebote = p.buy.map((b) => ({ preis: b.price, haendler: b.shop, ort: b.where, system: b.system }))
      .sort((a, b) => a.preis - b.preis || a.ort.localeCompare(b.ort));
    out.push({ kind: 'price', id, slug: id, name: namen.get(id) ?? id, change: 'new', angebote });
  }
  for (const id of alt.keys()) if (!neu.has(id)) out.push({ kind: 'price', id, slug: id, name: namen.get(id) ?? id, change: 'removed' });
  return { eintraege: out, bestand: { vorher: alt.size, nachher: neu.size } };
}

/* ---------- Ausgabe ---------- */

const KINDS = ['ship', 'price', 'item', 'blueprint', 'mission'];
const CHANGES = ['new', 'renamed', 'changed', 'removed'];

function vergleiche(paar) {
  const alt = laden(paar.vorher, paar.von);
  const neu = laden(paar.nachher, paar.nach);
  const ausnahmen = AUSNAHMEN.filter((x) => x.paar === `${paar.von}__${paar.nach}`);
  const eintraege = [];
  const bestand = {};
  const felder = {};
  for (const [kind, regel] of Object.entries(REGELN)) {
    const r = vergleicheArt(kind, regel, alt.daten, neu.daten, ausnahmen.filter((x) => x.kind === kind));
    eintraege.push(...r.eintraege);
    bestand[kind] = r.bestand;
    felder[kind] = Object.fromEntries(regel.felder.filter((f) => r.felder.includes(f[0])).map(([feld, de, en]) => [feld, { de, en }]));
  }
  for (const x of ausnahmen) {
    if (x.treffer !== x.ids.length) throw new Error(`Ausnahme ${x.paar} ${x.kind}.${x.feld} traf ${x.treffer ?? 0} von ${x.ids.length} (${x.anlass}): Anlass pruefen oder Ausnahme loeschen`);
  }
  const p = vergleichePreise(alt.daten, neu.daten);
  eintraege.push(...p.eintraege);
  bestand.price = p.bestand;
  // Bestand der Items zaehlt den ganzen Katalog (wie die Seite), Eintraege nur Spiel-Items.
  bestand.itemKatalog = { vorher: alt.daten.items.items.length, nachher: neu.daten.items.items.length };

  eintraege.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || CHANGES.indexOf(a.change) - CHANGES.indexOf(b.change)
    || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id));
  const zaehler = Object.fromEntries(KINDS.map((k) => [k, Object.fromEntries(CHANGES.map((c) => [c, eintraege.filter((e) => e.kind === k && e.change === c).length]))]));
  return {
    schema: 1,
    von: alt.stand,
    nach: neu.stand,
    bestand,
    zaehler,
    felder,
    ausnahmen: ausnahmen.map(({ kind, feld, ids, anlass }) => ({ kind, feld, ids, anlass })),
    eintraege,
  };
}

/** Eine Zeile je Eintrag: lesbare Diffs im Repo, ohne die Datei aufzublaehen. */
function serialisiere(v) {
  const { eintraege, ...kopf } = v;
  const k = JSON.stringify(kopf, null, 2).replace(/\n}$/, '');
  return `${k},\n  "eintraege": [\n${eintraege.map((e) => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]\n}\n`;
}

function uebersicht() {
  const paare = readdirSync(AUSGABE).filter((n) => /^[\d.]+__[\d.]+\.json$/.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((n) => {
      const v = JSON.parse(readFileSync(resolve(AUSGABE, n), 'utf8'));
      return { von: v.von.version, nach: v.nach.version, datei: n, bestand: v.bestand, zaehler: v.zaehler };
    });
  writeFileSync(resolve(AUSGABE, 'uebersicht.json'), `${JSON.stringify({ schema: 1, paare }, null, 2)}\n`);
  return paare.length;
}

const args = process.argv.slice(2);
const wert = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const gewaehlt = args.includes('--alle')
  ? PAARE
  : PAARE.filter((p) => p.von === wert('--von') && p.nach === wert('--nach'));
if (!gewaehlt.length) {
  console.error(`Aufruf: --von <v> --nach <v> oder --alle. Bekannte Paare: ${PAARE.map((p) => `${p.von}→${p.nach}`).join(', ')}`);
  process.exit(2);
}
mkdirSync(AUSGABE, { recursive: true });
for (const paar of gewaehlt) {
  const v = vergleiche(paar);
  const datei = `${paar.von}__${paar.nach}.json`;
  writeFileSync(resolve(AUSGABE, datei), serialisiere(v));
  const zeile = KINDS.map((k) => `${k} ${CHANGES.map((c) => v.zaehler[k][c]).join('/')}`).join('  ');
  console.log(`${paar.von} → ${paar.nach} (${v.von.ref} → ${v.nach.ref}${v.nach.ungesichert ? `, ungesichert: ${v.nach.ungesichert.join(' ')}` : ''})\n  neu/umbenannt/geaendert/entfernt: ${zeile}\n  → src/data/patch-vergleich/${datei}`);
}
console.log(`uebersicht.json: ${uebersicht()} Paare`);
