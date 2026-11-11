// loot-orte.mjs — Welche Ortsart steckt hinter einer Loot-Belegung, und wie
// heisst sie fuer Spieler?
//
// scripts/datamine-loot.mjs (PC, Patch-Day) schreibt src/data/loot-fundorte.json:
// je Item die Belegungen, die es an echten Orten entstehen lassen koennen, und
// je Belegung die Himmelskoerper, auf denen sie steht. Die Belegungen tragen
// interne Namen („V3SlotPreset_DistributionCentres_HighSecurtiy"). Hier werden
// sie zu Ortsarten gebuendelt, die ein Spieler kennt („Verteilzentren"), mit
// deutschem und englischem Namen. Bewusst NICHT im Datenlauf: so laesst sich
// die Benennung verbessern, ohne das Spiel erneut auszulesen.
//
// wendeFundorteAn() traegt das Ergebnis in assets/universal-items.json ein
// (Kopf `fundorte`, je Item `fund`). Die Seite und der Item Finder machen daraus
// Loot-Zeilen mit dem Status „bestätigt" (src/lib/items.ts, assets/item-finder-app.js).
//
// verify:loot-fundorte haelt beides zusammen: jede Belegung der Daten hat hier
// eine Ortsart oder steht benannt unter VERSTECKT; jeder Name hier kommt in den
// Daten noch vor (Zombie-Waechter); jeder Himmelskoerper hat einen Namen.

/**
 * Ortsarten in Anzeige-Reihenfolge. `belegungen` sind die Namen aus
 * src/data/loot-fundorte.json (Record-Name ohne Struktur-Praefix).
 * Die Namen sind Eigennamen der Spielwelt oder Gattungen, keine Quellenangabe.
 */
export const ORTSARTEN = [
  {
    key: 'contested-zones', de: 'Contested Zones', en: 'Contested Zones',
    // Raststationen in Pyro mit umkaempftem Bereich und Belohnungsraeumen
    belegungen: ['ContestedZone_1a', 'ContestedZone_1a_RewardRoom_001', 'ContestedZone_1b_RewardRoom_002', 'GhostArena_01'],
  },
  {
    key: 'verteilzentren', de: 'Verteilzentren', en: 'Distribution centres',
    belegungen: [
      'DistributionCentre_MultiConfig_Warehouse_High', 'DistributionCentre_MultiConfig_Warehouse_Medium', 'DistributionCentre_MultiConfig_Warehouse_Low',
      'V3SlotPreset_DistributionCentres_HighSecurtiy', 'V3SlotPreset_DistributionCentres_MediumSecurity', 'V3SlotPreset_DistributionCentres_LowSecurity',
    ],
  },
  {
    key: 'asd-anlagen', de: 'ASD-Forschungsanlagen', en: 'ASD research facilities',
    belegungen: ['LootGeneration_SlotPreset_ASDDelving', 'V3SlotPreset_ASDDelving', 'V3SlotPreset_ASDDelving_ScienceWing'],
  },
  {
    key: 'asd-labore', de: 'ASD-Labore', en: 'ASD labs',
    // Labor- und Datenstationen an der Oberflaeche von Pyro I und Pyro IV
    belegungen: ['V3SlotPreset_StormBreaker_Lab', 'V3SlotPreset_StormBreaker_Data'],
  },
  {
    key: 'bunker', de: 'Bunker', en: 'Bunkers',
    // unterirdische Anlagen (ugf) auf den Planeten und Monden von Stanton
    belegungen: ['V3SlotPreset_Loot_Military'],
  },
  {
    key: 'kareah', de: 'Security Post Kareah', en: 'Security Post Kareah',
    belegungen: ['LootGeneration_MultiSlotpreset_Kareah'],
  },
  {
    key: 'fob', de: 'Vorposten-Komplexe', en: 'Forward operating bases',
    // Bunker- und Lagerkomplexe auf Aberdeen und Daymar
    belegungen: ['V3SlotPreset_Orbageddon', 'ORB_Warehouse_MultiConfig'],
  },
  {
    key: 'aussenposten', de: 'Außenposten', en: 'Outposts',
    belegungen: [
      'LootGeneration_SlotPreset_TechOutpost', 'LootGeneration_SlotPreset_UGFs',
      'LootGeneration_SlotPreset_ColonialOutpost',
      'LootGeneration_SlotPreset_ColonialOutpost_Indy', 'LootGeneration_SlotPreset_ColonialOutpost_Indy_Medium', 'LootGeneration_SlotPreset_ColonialOutpost_Indy_Small',
      'LootGeneration_SlotPreset_ColonialOutpost_Outlaw', 'LootGeneration_SlotPreset_ColonialOutpost_Outlaw_Medium', 'LootGeneration_SlotPreset_ColonialOutpost_Outlaw_Small',
    ],
  },
  {
    key: 'ruinen', de: 'Verfallene Außenposten', en: 'Abandoned outposts',
    belegungen: ['LootGeneration_SlotPreset_DerelictOutpost', 'LootGeneration_MultiSlotPreset_DerelictOutposts'],
  },
  {
    key: 'drogenlabore', de: 'Drogenlabore', en: 'Drug labs',
    belegungen: ['LootGeneration_SlotPreset_Jumptown'],
  },
  {
    key: 'schrottplaetze', de: 'Schrottplätze', en: 'Junk sites',
    belegungen: ['LootGeneration_MultiSlotpreset_Junksite', 'LootGeneration_SlotPreset_Junksites'],
  },
  {
    key: 'hoehlen', de: 'Höhlen', en: 'Caves',
    belegungen: ['Loot_Caves_Occupied_Rock', 'Loot_Caves_Occupied_Acidic'],
  },
  {
    key: 'wracks', de: 'Wracks und Absturzstellen', en: 'Wrecks and crash sites',
    belegungen: ['LootGeneration_MultiSlotPreset_Derelict', 'LootGeneration_MultiSlotPreset_Derelict_Small', 'V3SlotPreset_WelcomeToNyx'],
  },
  {
    key: 'asteroidenbasen', de: 'Asteroidenbasen', en: 'Asteroid bases',
    belegungen: [
      'AsteroidBase_Dungeon_001', 'AsteroidBase_Encounter_001', 'LootGeneration_SlotPreset_AsteroidBase_Pyro_Encounter',
      'V3SlotPreset_RockCracker', 'V3SlotPreset_RockCracker_Sandbox', 'V3SlotPreset_TSG',
    ],
  },
  {
    key: 'raststationen', de: 'Raststationen', en: 'Rest stops',
    belegungen: ['LootGeneration_MultiSlotpreset_Stations', 'LootGeneration_SlotPreset_Station_Rund_Entry'],
  },
  {
    key: 'station-nyx', de: 'Gesetzlosen-Station', en: 'Outlaw station',
    belegungen: ['V3SlotPreset_Battaglia'],
  },
  {
    key: 'levski', de: 'Levski', en: 'Levski',
    belegungen: ['V3SlotPreset_Harvestable_Levski'],
  },
  {
    key: 'geenterte-schiffe', de: 'Geenterte Schiffe (Missionen)', en: 'Boarded ships (missions)',
    belegungen: ['LootGeneration_SlotPreset'],
  },
  {
    key: 'klescher', de: 'Klescher (Verstecke)', en: 'Klescher prison (stashes)',
    belegungen: ['Cave_Prison_Harvestables'],
  },
  {
    key: 'siege-of-orison', de: 'Siege of Orison (Event)', en: 'Siege of Orison (event)',
    belegungen: ['V3SlotPreset_SOO'],
  },
  {
    key: 'orison-plattformen', de: 'Plattformen über Orison (Event)', en: 'Platforms above Orison (event)',
    belegungen: ['LootGeneration_SlotPreset_FloatingIslands', 'LootGeneration_SlotPreset_FoodandDrink'],
  },
];

/**
 * Belegungen, die bewusst KEINE Zeile bekommen — je mit Anlass. Verliert ein
 * Eintrag seinen Anlass (die Belegung verschwindet aus den Daten), reisst
 * verify:loot-fundorte (Zombie-Waechter).
 */
export const VERSTECKT = {
  // Steht im Siege-of-Orison-Container und in einem Kampf-Overlay ohne
  // Himmelskoerper; ihre Items fuehrt V3SlotPreset_SOO vollstaendig mit. Als
  // eigene Zeile hiesse sie nur „Stanton (im All)" ohne Ort.
  V3SlotPreset_Loot_Generic: 'Ersatzbelegung des Siege-of-Orison-Inhalts, Items stecken schon in V3SlotPreset_SOO',
};

/** Sternsysteme: Wurzel-Praefix -> Anzeigename (Eigenname, beide Sprachen). */
export const SYSTEME = { stanton: 'Stanton', pyro: 'Pyro', nyx: 'Nyx' };

/**
 * Himmelskoerper in Anzeige-Reihenfolge. Schluessel = Wurzel aus den Daten
 * (pu/system/<system>/<koerper>.socpak). Namen wie scripts/datamine-locations.mjs.
 * Die System-Wurzel selbst (`stanton/stantonsystem`) steht hier als '*': der
 * Ort haengt an keinem Himmelskoerper, sondern im All (Station, Asteroidenbasis).
 * Der Datenlauf zaehlt sie nur fuer Container, die kein Himmelskoerper erreicht.
 */
export const KOERPER = {
  'stanton/stanton1': 'Hurston', 'stanton/stanton1a': 'Arial', 'stanton/stanton1b': 'Aberdeen', 'stanton/stanton1c': 'Magda', 'stanton/stanton1d': 'Ita',
  'stanton/stanton2': 'Crusader', 'stanton/stanton2a': 'Cellin', 'stanton/stanton2b': 'Daymar', 'stanton/stanton2c': 'Yela',
  'stanton/stanton3': 'ArcCorp', 'stanton/stanton3a': 'Lyria', 'stanton/stanton3b': 'Wala',
  'stanton/stanton4': 'microTech', 'stanton/stanton4a': 'Calliope', 'stanton/stanton4b': 'Clio', 'stanton/stanton4c': 'Euterpe',
  'stanton/stantonsystem': '*',
  'pyro/pyro1': 'Pyro I', 'pyro/pyro2': 'Pyro II (Monox)', 'pyro/pyro3': 'Pyro III (Bloom)', 'pyro/pyro4': 'Pyro IV', 'pyro/pyro5': 'Pyro V',
  'pyro/pyro5a': 'Pyro V-a (Ignis)', 'pyro/pyro5b': 'Pyro V-b (Vatra)', 'pyro/pyro5c': 'Pyro V-c (Adir)', 'pyro/pyro5d': 'Pyro V-d (Fairo)',
  'pyro/pyro5e': 'Pyro V-e (Fuego)', 'pyro/pyro5f': 'Pyro V-f (Vuur)', 'pyro/pyro6': 'Pyro VI (Terminus)',
  'pyro/pyrosystem': '*',
  'nyx/nyxsystem': '*',
};
const KOERPER_REIHE = new Map(Object.keys(KOERPER).map((k, i) => [k, i]));

const ART_VON = new Map();
for (const a of ORTSARTEN) for (const b of a.belegungen) {
  if (ART_VON.has(b)) throw new Error(`loot-orte: Belegung ${b} steht in zwei Ortsarten (${ART_VON.get(b)}, ${a.key})`);
  ART_VON.set(b, a.key);
}
for (const b of Object.keys(VERSTECKT)) if (ART_VON.has(b)) throw new Error(`loot-orte: Belegung ${b} ist zugleich Ortsart und versteckt`);
const ART_REIHE = new Map(ORTSARTEN.map((a, i) => [a.key, i]));

/** Ortsart-Schluessel einer Belegung, `null` fuer versteckte, `undefined` fuer unbekannte. */
export function ortsartVon(belegung) {
  if (ART_VON.has(belegung)) return ART_VON.get(belegung);
  if (Object.prototype.hasOwnProperty.call(VERSTECKT, belegung)) return null;
  return undefined;
}

/**
 * Die Daten in die Item-Datenbank eintragen (idempotent: vorhandene
 * Eintraege werden erst entfernt).
 *
 *   db.fundorte = { patch, arten: {key: {de, en}}, systeme, profile: [[[artKey, {system: [Koerper…]}], …], …] }
 *   ('*' in der Koerperliste = im All, an keinem Himmelskoerper)
 *   item.fund   = Index in db.fundorte.profile
 *
 * Ein Item der Datenbank kann mehrere Spiel-Items buendeln (game.guid +
 * game.guidAliases): seine Fundorte sind die Vereinigung. Items, die laut Spiel
 * nicht als Loot entstehen koennen (game.lootable === false), bekommen keine
 * Zeile — die Exklusiv-Zeile gewinnt.
 */
export function wendeFundorteAn(db, fd) {
  delete db.fundorte;
  for (const it of db.items) delete it.fund;

  const profilBelegungen = fd.profile;
  const zahl = { items: 0, gesperrt: 0, nurVersteckt: 0, zeilen: 0 };
  const profilIdx = new Map();
  const profile = [];
  const unbekannt = new Set();

  for (const it of db.items) {
    const g = it.game;
    if (!g?.guid) continue;
    const bel = new Set();
    for (const id of [g.guid, ...(g.guidAliases ?? [])]) {
      const p = fd.items[id];
      if (p == null) continue;
      for (const b of profilBelegungen[p]) bel.add(b);
    }
    if (!bel.size) continue;
    if (g.lootable === false) { zahl.gesperrt++; continue; }
    // Ortsart -> Wurzeln
    const arten = new Map();
    for (const b of bel) {
      const art = ortsartVon(b);
      if (art === undefined) { unbekannt.add(b); continue; }
      if (art === null) continue;
      if (!arten.has(art)) arten.set(art, new Set());
      for (const w of Object.keys(fd.belegungen[b]?.wurzeln ?? {})) arten.get(art).add(w);
    }
    if (!arten.size) { zahl.nurVersteckt++; continue; }
    const zeilen = [...arten].sort((a, b) => ART_REIHE.get(a[0]) - ART_REIHE.get(b[0])).map(([art, ws]) => {
      const wo = {};
      for (const w of [...ws].sort((a, b) => (KOERPER_REIHE.get(a) ?? 1e9) - (KOERPER_REIHE.get(b) ?? 1e9) || a.localeCompare(b))) {
        const sys = w.split('/')[0];
        if (!wo[sys]) wo[sys] = [];
        const name = KOERPER[w];
        if (name === undefined) throw new Error(`loot-orte: Himmelskoerper ${w} hat keinen Namen — in KOERPER eintragen`);
        wo[sys].push(name);
      }
      return [art, wo];
    });
    const k = JSON.stringify(zeilen);
    if (!profilIdx.has(k)) { profilIdx.set(k, profile.length); profile.push(zeilen); }
    it.fund = profilIdx.get(k);
    zahl.items++;
    zahl.zeilen += zeilen.length;
  }
  if (unbekannt.size) throw new Error(`loot-orte: ${unbekannt.size} Belegung(en) ohne Ortsart — in ORTSARTEN oder VERSTECKT eintragen: ${[...unbekannt].sort().join(', ')}`);

  // Kennzahlen: ein Item mit bestaetigtem Fundort hat eine Bezugsquelle, auch
  // wenn seine Zeilen erst beim Laden entstehen (tests/e2e/db.test.js 3, 12).
  if (db.counts) {
    const mitQuelle = db.items.filter((i) => i.obtain.length || i.fund != null).length;
    db.counts.withObtain = mitQuelle;
    db.counts.catalogOnly = db.items.length - mitQuelle;
    db.counts.withFundort = zahl.items;
  }

  const genutzt = new Set(profile.flatMap((p) => p.map(([art]) => art)));
  db.fundorte = {
    patch: fd.meta.patch,
    arten: Object.fromEntries(ORTSARTEN.filter((a) => genutzt.has(a.key)).map((a) => [a.key, { de: a.de, en: a.en }])),
    systeme: SYSTEME,
    profile,
  };
  return { ...zahl, profile: profile.length, arten: genutzt.size };
}

/**
 * Feste Schreibweise von src/data/loot-fundorte.json: eine Zeile je Belegung,
 * Profil und Item, damit ein neuer Datenlauf als lesbarer Diff ankommt.
 * Der Datenlauf und jede Gegenprobe schreiben mit derselben Funktion.
 */
export function schreibeFundorte(fd) {
  const j = (v) => JSON.stringify(v);
  const block = (obj, fn) => Object.keys(obj).map((k) => `    ${j(k)}: ${fn(obj[k])}`).join(',\n');
  return [
    '{',
    `  "meta": ${j(fd.meta)},`,
    '  "belegungen": {',
    block(fd.belegungen, j),
    '  },',
    '  "profile": [',
    fd.profile.map((p) => `    ${j(p)}`).join(',\n'),
    '  ],',
    '  "items": {',
    block(fd.items, j),
    '  }',
    '}',
    '',
  ].join('\n');
}
