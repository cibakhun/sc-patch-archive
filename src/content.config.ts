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

// Full vehicle catalog — snapshot written by `npm run sync:vehicles`
// (scripts/sync-vehicles.mjs, Star Citizen Wiki API v2, German fields native).
/** an equipped item on a port: name + size class + how many are fitted */
const fitted = z.object({
  name: z.string(),
  size: z.number().nullable(),
  count: z.number(),
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
    sizeDe: z.string().nullable(),
    statusDe: z.string().nullable(),
    statusEn: z.string().nullable(),
    fociDe: z.array(z.string()),
    descriptionDe: z.string().nullable(),
    crewMin: z.number().nullable(),
    crewMax: z.number().nullable(),
    cargoSCU: z.number().nullable(),
    oreSCU: z.number().nullable(),
    msrpUSD: z.number().nullable(),
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
    fixedWeapons: z.array(
      z.object({ name: z.string(), count: z.number(), dps: z.number().nullable() })
    ),
    /** pilot-weapon HARDPOINT max sizes (what is mountable), aggregated per size,
     *  from the detail endpoint's `components[].weapons`. Paired with the
     *  equipped-weapon sizes below for display. */
    fixedWeaponMounts: z
      .array(z.object({ size: z.number(), count: z.number() }))
      .default([]),
    /** size classes of the ACTUAL equipped pilot weapons, aggregated per size.
     *  Resolved by enrich-weapon-sizes.mjs from the fitted weapon names via the
     *  WeaponGun items catalog (NOT the hardpoint max size). Optional so the
     *  schema still validates a snapshot synced before the enrich pass ran. */
    fixedWeaponSizes: z
      .array(z.object({ size: z.number(), count: z.number() }))
      .default([]),
    /** true when at least one fitted gun could not be resolved to a size, so the
     *  size list is incomplete (rare; unused today but kept for honest display) */
    fixedWeaponSizesPartial: z.boolean().optional(),
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
    pledgeUrl: z.string().nullable(),
    /** patch-spine: versions in OUR archive that introduced/touched it */
    patches: z.array(z.string()),
    gameVersion: z.string().nullable(),
    /** ship image from the API (starcitizen.tools media), width-graded */
    image: z
      .object({
        hero: z.string().nullable(),
        thumb: z.string().nullable(),
        source: z.string().nullable(),
      })
      .nullable(),
  }),
});

export const collections = { patches, ships, vehicles };
