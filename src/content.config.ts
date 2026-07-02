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
    era: z.enum(['Pyro-Ära', 'Sturm & Stahl', 'Onyx & Heilung', 'Neue Horizonte', 'Tactical Strike']),
    type: z.enum(['major', 'point']),
    /** factual one-liner — no marketing filler */
    tagline: z.string(),
    summary: z.string(),
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

export const collections = { patches, ships };
