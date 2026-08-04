// Data backbone: typed patch data (the "Dossier" register).
// Design rule: Dossier uniform, Kino individuell — pages compose their own
// dramaturgy, but every fact renders from this validated layer.
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const fact = z.object({
  label: z.string(),
  value: z.string(),
  /** carried over from PATCH-DATA.md "(unbestätigt)" markers */
  unverified: z.boolean().optional(),
});

const patches = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/patches' }),
  schema: z.object({
    version: z.string(),
    codename: z.string(),
    /** ISO date for sorting/JSON-LD */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateDisplay: z.string(),
    era: z.enum(['Pyro-Ära', 'Sturm & Stahl', 'Onyx & Heilung', 'Neue Horizonte', 'Tactical Strike', 'Frontier']),
    type: z.enum(['major', 'point']),
    /** factual one-liner — no marketing filler */
    tagline: z.string(),
    summary: z.string(),
    /** Landing-"Aktuell"-Kachel + Social-Card: das Leitbild dieses Patches.
     *  Fällt sonst auf die Konvention /assets/trailer-<id>.jpg zurück. */
    heroImage: z.string().optional(),
    /** offizielle CIG-Patch-Notes (Comm-Link; Point-Releases z. T. Spectrum-Thread) —
     *  rendert im Dossier als "Offizielle Patch Notes (RSI)"-Link */
    notesUrl: z.string().url().optional(),
    palette: z.object({
      bg: z.string(),
      accent: z.string(),
      accent2: z.string().optional(),
      /** warm accent → ember-field eligible (see detail.js accentIsWarm) */
      warm: z.boolean(),
    }),
    trailer: z
      .object({
        yt: z.string(),
        /** false = borrowed from the 4.x series trailer (point releases) */
        own: z.boolean(),
        title: z.string().optional(),
      })
      .optional(),
    /** the "Auf einen Blick" panel — hard numbers first */
    keyFacts: z.array(fact).min(3),
    features: z.array(
      z.object({
        name: z.string(),
        /** Evolution-matrix row, e.g. "Server-Technik", "Medical", "Mining" */
        system: z.string().optional(),
        kind: z.enum(['tech', 'gameplay', 'location', 'event', 'ship-system', 'balance', 'qol']).optional(),
        desc: z.string(),
        facts: z.array(fact).optional(),
        /** slug of the deep-dive page under /topics/ (without .html) */
        topicSlug: z.string().optional(),
        unverified: z.boolean().optional(),
        /** Evergreen-System, das VOR diesem Patch existierte (z. B. Mining seit 3.2).
         *  Die Herkunfts-Zeile der Topic-Seite zeigt dann "Abgelegt unter" statt
         *  "Eingeführt in" — das Dossier ist hier nur archiviert, nicht debütiert. */
        evergreen: z.boolean().optional(),
      })
    ),
    ships: z
      .array(
        z.object({
          name: z.string(),
          manufacturer: z.string(),
          role: z.string(),
          status: z.string().optional(),
          notes: z.string().optional(),
          unverified: z.boolean().optional(),
        })
      )
      .default([]),
    events: z
      .array(
        z.object({
          name: z.string(),
          desc: z.string(),
          period: z.string().optional(),
        })
      )
      .default([]),
    /** e.g. "~130 Bugfixes" / ">200 Bugfixes (61 aus dem Issue Council)" */
    fixesNote: z.string().optional(),
    wipe: z.string().optional(),
    /** all deep-dive pages belonging to this patch */
    topics: z.array(z.object({ slug: z.string(), title: z.string() })).default([]),
  }),
});

// FleetYards ship specs — snapshot written by `npm run sync:ships`
// (scripts/sync-ships.mjs). The site renders only this committed snapshot.
const ships = defineCollection({
  loader: file('src/data/ships.json', {
    parser: (text) => JSON.parse(text).ships,
  }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    /** the exact ship name used in the patch data — the join key */
    matchedFrom: z.string(),
    manufacturer: z.string().nullable(),
    classification: z.string().nullable(),
    focus: z.string().nullable(),
    productionStatus: z.string().nullable(),
    cargoSCU: z.number().nullable(),
    crewMin: z.number().nullable(),
    crewMax: z.number().nullable(),
    lengthM: z.number().nullable(),
    sizeLabel: z.string().nullable(),
    priceUSD: z.number().nullable(),
    fleetyardsUrl: z.string(),
    patches: z.array(z.string()),
  }),
});

// Full vehicle catalog — game-sourced, written by `npm run datamine:vehicles`
// (scripts/datamine-vehicles.mjs, Data.p4k extraction, 01.4-05). Ten fields
// with no game-file source stay frozen in src/data/vehicle-external.json
// (msrpUSD, pledgeUrl, dimensions, image, crewMax, statusEn/De, fociDe) and
// are merged in at generation time — including the four ARGO-ATLS overrides
// (D-13), which is why several fields below stay nullable/defaulted even
// though buildVehicle() itself always fills them.
/** an equipped item on a port: name + size class + how many are fitted */
const fitted = z.object({
  name: z.string(),
  size: z.number().nullable(),
  count: z.number(),
});
/** a fitted weapon: name/size/count/dps as displayed, plus the game-internal
 *  item class (`cls`) — the join key scripts/verify-weapon-sizes.mjs uses
 *  instead of the (non-unique) display name (display-name-not-a-key). */
const weaponFitted = z.object({
  name: z.string(),
  size: z.number().nullable().optional(),
  count: z.number(),
  dps: z.number().nullable(),
  cls: z.string().optional(),
});

const vehicles = defineCollection({
  loader: file('src/data/vehicles.json', {
    parser: (text) => JSON.parse(text).vehicles,
  }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    manufacturer: z.string().nullable(),
    makerCode: z.string().nullable(),
    typeDe: z.string().nullable(),
    typeEn: z.string().nullable(),
    /** CIG's own, finer role taxonomy (`vehicleRole`) — both languages native,
     *  replaces the old fociDe hand-translation table for role display. */
    roleEn: z.string().nullable().default(null),
    roleDe: z.string().nullable().default(null),
    /** CIG's own hangar/landing-pad class (AttachDef.Size, 1–6) */
    sizeClass: z.number().nullable().default(null),
    sizeDe: z.string().nullable(),
    statusDe: z.string().nullable(),
    statusEn: z.string().nullable(),
    fociDe: z.array(z.string()),
    descriptionDe: z.string().nullable(),
    /** CIG's own English text (Data.p4k) — replaces the back-translation-
     *  from-German layer removed in 01.4-05 (D-07). Carries
     *  a "Manufacturer: …\nFocus: …\n\n" header and literal "\n" sequences;
     *  vDesc()/rendering strips the header and renders the line breaks. */
    descriptionEn: z.string().nullable().default(null),
    crewMin: z.number().nullable(),
    // .default(null): vehicle-external.json fuehrt den Schluessel je Fahrzeug
    // nur, wenn ein Wert vorliegt — fehlender Schluessel != vorhandener null.
    crewMax: z.number().nullable().default(null),
    cargoSCU: z.number().nullable(),
    oreSCU: z.number().nullable(),
    msrpUSD: z.number().nullable().default(null),
    lengthM: z.number().nullable(),
    widthM: z.number().nullable(),
    heightM: z.number().nullable(),
    scmSpeed: z.number().nullable(),
    maxSpeed: z.number().nullable(),
    boostForward: z.number().nullable(),
    pitch: z.number().nullable(),
    yaw: z.number().nullable(),
    roll: z.number().nullable(),
    pilotDps: z.number().nullable(),
    turretDps: z.number().nullable(),
    fixedWeapons: z.array(weaponFitted),
    /** pilot-weapon HARDPOINT max sizes (what is mountable), aggregated per size,
     *  from the vehicle implementation XML's item ports. Paired with the
     *  equipped-weapon sizes below for display. */
    fixedWeaponMounts: z
      .array(z.object({ size: z.number(), count: z.number() }))
      .default([]),
    /** size classes of the ACTUAL equipped pilot weapons, aggregated per size —
     *  a straight rollup of fixedWeapons[].size (game-sourced, D-19), no
     *  longer a name-based back-resolution. */
    fixedWeaponSizes: z
      .array(z.object({ size: z.number(), count: z.number() }))
      .default([]),
    /** weapon hardpoints aggregated per turret category: mount size classes
     *  plus the equipped weapon names (per-station data from the game files) */
    turrets: z.array(
      z.object({
        label: z.string(),
        stations: z.number(),
        sizes: z.array(z.object({ size: z.number(), count: z.number() })),
        weapons: z.array(z.object({ name: z.string(), count: z.number() })),
        payloadTypes: z.array(z.string()),
        dps: z.number().nullable(),
      })
    ),
    /** flat turret-weapon list (mirrors fixedWeapons for turrets); carries
     *  `cls` for the same reason as fixedWeapons, s. o. */
    turretWeapons: z.array(weaponFitted).default([]),
    missileCount: z.number().nullable(),
    missileRacks: z.array(fitted),
    cmLaunchers: z.number(),
    /** equipped core components with size classes, from the port list */
    components: z.object({
      powerPlants: z.array(fitted),
      shields: z.array(fitted),
      coolers: z.array(fitted),
      quantumDrives: z.array(fitted),
      radars: z.array(fitted),
    }),
    hullHp: z.number().nullable(),
    shieldHp: z.number().nullable(),
    qtSpeedMs: z.number().nullable(),
    qtRangeM: z.number().nullable(),
    qtSpoolS: z.number().nullable(),
    qtFuel: z.number().nullable(),
    h2Fuel: z.number().nullable(),
    insClaimMin: z.number().nullable(),
    insExpediteMin: z.number().nullable(),
    insExpediteCost: z.number().nullable(),
    isSpaceship: z.boolean().nullable(),
    isGravlev: z.boolean().nullable(),
    pledgeUrl: z.string().nullable().default(null),
    /** patch-spine: versions in OUR archive that introduced/touched it —
     *  computed in scripts/datamine-vehicles.mjs since 01.4-05 (D-19; moved
     *  out of the now-deleted Wiki vehicle-sync script). */
    patches: z.array(z.string()),
    gameVersion: z.string().nullable(),
    /** ship image — frozen from the Wiki media snapshot (src/data/vehicle-
     *  external.json), no in-game photographic material exists (01.4-02) */
    // .default(null): einige der 216/227 mit Bild eingefrorenen Fahrzeuge
    // führen den Schlüssel `image` in vehicle-external.json gar nicht erst
    // (keine Wiki-Aufnahme vorhanden) — ein fehlender Schlüssel ist für zod
    // etwas anderes als ein vorhandener null-Wert.
    image: z
      .object({
        hero: z.string().nullable(),
        thumb: z.string().nullable(),
        source: z.string().nullable(),
      })
      .nullable()
      .default(null),
  }),
});

export const collections = { patches, ships, vehicles };
