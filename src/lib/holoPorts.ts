// Komponenten-Hologramm: was assets/holo-viewer.js fuer EIN Schiff bekommt.
// Aus ShipDetail.astro herausgeloest (15.11.2026), damit die Schiffsseite und
// die Patchseite ("Patch am Hologramm") dieselbe Rechnung teilen. Rein: liest
// nur die eingebauten Datenstaende, keine Seite, kein Astro-Kontext.
//
// Positionsquelle ist das echte Spielmesh (src/data/holo-meshes.json): das
// gerenderte Mesh und die Hardpoints (ship-hardpoints.json, COMPILED_BONES)
// teilen denselben Raum -> Marker EXAKT, nur feste Achsvertauschung
// cry->glTF (x, z, -y). P-3 (16-01-PLAN.md, Variante C): drei der vier
// Triebwerksarten (thruster_main/retro/vtol) umgehen den Stock-Loadout-Join
// unten und bekommen IMMER einen Marker, auch ohne Stock-Item — Triebwerke
// sind Geometrie, kein Ausruestungsplatz, es gibt fuer sie kein Stock-Item,
// das der Join finden koennte. thruster_mav (die vielen kleinen Manoevrier-
// triebwerke) bleibt aussen vor: unter Variante C waere ihre Einzelgruppe
// (40 Marker am dichtesten Schiff, drak-corsair) ueber der am Bildpunkt
// belegten 20er-Obergrenze aus Task 1/2 dieses Plans.
import type { CollectionEntry } from 'astro:content';
import holoMeshesSnapshot from '../data/holo-meshes.json';
import shipHardpointsSnapshot from '../data/ship-hardpoints.json';
import shipLoadoutsSnapshot from '../data/ship-loadouts.json';
import { useTranslations, href, type Locale } from '../i18n/ui';
import { itemInfo } from './holoItems';
import { HOLO_ICON } from './holoIcons';
import { fanOut, hullBox, toGltf, type Cry, type Vec3 } from './hangar/ports';

type VehicleData = CollectionEntry<'vehicles'>['data'];

export type HoloPort = {
  k: string; g: string; p: number[];
  label: string | null; size: number | null;
  /** lab: dauerhaft sichtbare Beschriftung (nur Kern-Komponenten) */
  lab?: string;
  /** Item-Finder-Anreicherung (Kategorie / günstigster Preis / Kauforte / Item-ID) */
  cat?: string; price?: number; shops?: number; iid?: string;
  /** np: nicht physicalisiert · est: Position geschätzt · dim: gedämpfter Marker-Stil */
  np?: boolean; est?: boolean; dim?: boolean;
  /** badge: Vorbehalt, den der Callout selbst trägt (np/est) — ohne Klick lesbar */
  badge?: string;
};

export type HoloDaten = {
  url: string | null; mesh: { c: number[]; s: number[] } | null; ax: number[] | null;
  ports: HoloPort[]; groups: readonly string[]; defaultOn: string[]; kinds: Record<string, string>;
  grpLabels: Record<string, string>; icons: Record<string, string>; loc: string; finder: string;
  masse: { laenge: string; hoehe: string } | null;
};

/** FleetYards liefert vereinzelt "<= PLACEHOLDER =>" als Komponentennamen
 *  (z. B. Javelin, ROC-DS) — solche Einträge tragen keine Information. */
export const realName = (it: { name: string }) => !/placeholder|<=|=>|\bTBD\b/i.test(it.name ?? '');

// Alle Hardpoint-Ebenen sind verfügbar; standardmäßig sichtbar sind nur
// Komponenten + Bewaffnung, den Rest (Antrieb, Sonstiges) schaltet der Nutzer
// per Filter selbst zu — nichts wird künstlich entfernt.
const HOLO_GRP: Record<string, string> = {
  power: 'core', shield: 'core', cooler: 'core', quantum: 'core', radar: 'core',
  turret: 'arms', missile: 'arms', weapon: 'arms',
  thruster_main: 'prop', thruster_retro: 'prop', thruster_vtol: 'prop', thruster_mav: 'prop',
  fuel: 'other', countermeasure: 'other',
};
const HOLO_GRP_ORDER = ['core', 'arms', 'prop', 'other'] as const;
const HOLO_DEFAULT_ON = ['core', 'arms'];
// P-3 (16-01-PLAN.md Task 1, Variante C — gemessen gegen das ausgelieferte
// holodata gegengeprueft, 908 Schiff-Gruppen-Paare, 0 Abweichungen): diese
// Triebwerksarten umgehen unten den Stock-Loadout-Join und bekommen IMMER
// einen Marker, auch ohne Stock-Item. thruster_mav bleibt aussen vor, siehe
// Kommentar am Kopf dieser Datei.
const HOLO_BYPASS_STOCK_JOIN = new Set(['thruster_main', 'thruster_retro', 'thruster_vtol']);

/** Das Hologramm eines Fahrzeugs, oder null, wenn es kein Spielmesh mit
 *  Hardpoints hat oder kein einziger Marker entsteht. */
export function holoDaten(d: VehicleData, lang: Locale): HoloDaten | null {
  const id = d.id;
  const t = useTranslations(lang);
  const loc = lang === 'en' ? 'en-US' : 'de-DE';
  const gameMesh = (holoMeshesSnapshot as any).meshes?.[id] ?? null;
  const gameHp = gameMesh ? ((shipHardpointsSnapshot as any).ships?.[id] ?? null) : null;
  if (!gameMesh || !gameHp) return null;

  // Loadout-Pools (Name/Größe je Kategorie), von beiden Quellen geteilt
  const expand = (list: { name: string; size: number | null; count: number }[]) =>
    list.filter(realName).flatMap((it) => Array.from({ length: it.count }, () => it));
  const pools: Record<string, { name: string; size: number | null }[]> = {
    power: expand(d.components?.powerPlants ?? []),
    shield: expand(d.components?.shields ?? []),
    cooler: expand(d.components?.coolers ?? []),
    quantum: expand(d.components?.quantumDrives ?? []),
    radar: expand(d.components?.radars ?? []),
    missile: expand(d.missileRacks ?? []),
    turret: (d.turrets ?? []).flatMap((tu) => {
      const guns = tu.weapons.filter(realName);
      return Array.from({ length: tu.stations }, () => ({
        name: guns.length ? guns.map((w) => `${w.count}× ${w.name}`).join(', ') : tu.label,
        size: tu.sizes[0]?.size ?? null,
      }));
    }),
    weapon: (d.fixedWeapons ?? []).filter(realName).flatMap((w) =>
      Array.from({ length: w.count }, () => ({ name: w.name, size: null }))
    ),
  };
  // Gemischte Loadouts (mehrere VERSCHIEDENE Komponenten derselben Art):
  // Bone- und API-Reihenfolge sind unabhängig -> keine geratene 1:1-Zuordnung,
  // stattdessen ehrlich alle Namen am Marker zeigen.
  const mixedLabel: Record<string, string | null> = {};
  for (const [k, pool] of Object.entries(pools)) {
    const names = [...new Set(pool.map((it) => it.name))];
    mixedLabel[k] = names.length > 1 ? names.join(' / ') : null;
  }

  // ?v=<Content-Hash> aus dem Manifest: nginx cached /holo/ 1 Jahr — der
  // Buster laesst Patch-Re-Exporte sofort durchschlagen (vgl. holoViewerSrc)
  const meshUrl: string = gameMesh.v ? `${gameMesh.url}?v=${gameMesh.v}` : gameMesh.url;
  // cry -> glTF, feste Achsvertauschung ohne Kalibrierung: dieselbe Regel wie der Hangar.
  const hull = hullBox((gameHp.hull ?? gameHp.bbox) as [Cry, Cry]);
  const [lo, hi] = hull;
  const meshBox = {
    c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
    s: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  };
  const srcPorts = (gameHp.hp as { k: string; p: Cry; n: string }[])
    .filter((h) => HOLO_GRP[h.k])
    .map((h) => ({ k: h.k, n: h.n, p: [...toGltf(h.p)] as number[] }));

  // Item-Finder-Anreicherung: Kategorie/Preis/Kauforte für einen Item-Namen
  const enrich = (name: string | null | undefined) => {
    const info = itemInfo(name);
    if (!info) return {};
    return { cat: info.cat, shops: info.shops, iid: info.id, ...(info.price != null ? { price: info.price } : {}) };
  };
  // Echtes Stock-Loadout aus dem DataCore: itemPortName -> verbautes Item.
  // itemPortName == Bone-Name -> exakter Join per Namen (keine Reihenfolge-
  // Raterei). Fehlt fuer ein Schiff der Stock-Loadout-Join, greift der
  // Reihenfolge-Fallback ueber die Pools (siehe unten).
  type StockItem = { name: string | null; size: number | null; cat: string; cls: string; count: number };
  const stock: Record<string, StockItem[]> | null = (shipLoadoutsSnapshot as any).ships?.[id] ?? null;

  // Marker -> Loadout joinen
  const holoPorts: HoloPort[] = [];
  const taken: Record<string, number> = {};
  const coreKindsSeen = new Set<string>(); // Kern-Arten, die einen echten Marker bekamen
  for (const hp of srcPorts) {
    const g = HOLO_GRP[hp.k];
    if (stock) {
      // DataCore-Pfad: Marker NUR, wenn der Bone ein echtes Stock-Item trägt —
      // AUSSER die Art umgeht den Join (P-3, HOLO_BYPASS_STOCK_JOIN oben).
      // Bones ohne Item UND ohne Bypass (Controller, Regen-Pools, Waffen-
      // schränke, Phantom-Bones geteilter Varianten-Geometrie) fallen weg —
      // kein namenloser/gestapelter Müll mehr.
      const items = hp.n ? stock[hp.n.toLowerCase()] : undefined;
      if ((!items || !items.length) && !HOLO_BYPASS_STOCK_JOIN.has(hp.k)) continue;
      if (g === 'core') coreKindsSeen.add(hp.k);
      if (items && items.length) {
        // Name aus den Spieldateien; fehlt die Lokalisierung (z.B. fest verbaute
        // Capital-Ship-Komponenten ohne Shop-Namen), auf das Art-Label ausweichen
        // statt den internen Klassennamen (COOL_AEGS_S04_…) zu zeigen.
        const label = items.map((it) => (it.count > 1 ? `${it.count}× ` : '') + (it.name || t(`holo.kind.${hp.k}` as any))).join(' / ');
        const sizes = new Set(items.map((it) => it.size));
        const single = items.length === 1 ? items[0] : null;
        holoPorts.push({
          k: hp.k, g, p: hp.p,
          label,
          size: sizes.size === 1 ? (items[0].size ?? null) : null,
          ...(single?.name ? enrich(single.name) : {}),
          ...(g === 'core' ? { lab: t(`holo.kind.${hp.k}` as any) } : {}),
        });
      } else {
        // Bypass-Fall: kein Stock-Item fuer diesen Triebwerks-Bone (erwartet —
        // Triebwerke sind Geometrie, kein Ausruestungsplatz). Marker traegt nur
        // die Art als Text, keine Item-Finder-Anreicherung (kein Item-Name).
        holoPorts.push({
          k: hp.k, g, p: hp.p,
          label: t(`holo.kind.${hp.k}` as any),
          size: null,
        });
      }
    } else {
      // Kein DataCore-Loadout fuer diesen Bone: alte Reihenfolge-Zuordnung als Fallback.
      const pool = pools[hp.k];
      const item = pool ? pool[(taken[hp.k] = (taken[hp.k] ?? 0) + 1) - 1] : undefined;
      const mixed = mixedLabel[hp.k];
      if (g === 'core') coreKindsSeen.add(hp.k);
      holoPorts.push({
        k: hp.k, g, p: hp.p,
        label: mixed ?? item?.name ?? null,
        size: mixed ? null : item?.size ?? null,
        ...(!mixed ? enrich(item?.name) : {}),
        ...(g === 'core' ? { lab: t(`holo.kind.${hp.k}` as any) } : {}),
      });
    }
  }
  // Kern-Komponente ganz ohne physisches Hardpoint -> schematisch mittig + Vermerk
  const mc = meshBox.c, ms = meshBox.s;
  let stackI = 0;
  for (const k of Object.keys(HOLO_GRP).filter((x) => HOLO_GRP[x] === 'core')) {
    const pool = pools[k] ?? [];
    if (!pool.length || coreKindsSeen.has(k)) continue;
    const off = (stackI++ - 1) * 0.08;
    holoPorts.push({
      k, g: 'core',
      p: [mc[0] + off * ms[0] * 0.3, mc[1], mc[2] + off * ms[2] * 0.3].map((x) => Math.round(x * 100) / 100),
      label: mixedLabel[k] ?? pool[0].name, size: mixedLabel[k] ? null : pool[0].size,
      ...(!mixedLabel[k] ? enrich(pool[0].name) : {}),
      lab: t(`holo.kind.${k}` as any),
      np: true, dim: true, badge: t('holo.badge.np' as any),
    });
  }
  // Ko-lozierte Marker leicht auffächern: einige Schiffe legen mehrere echte
  // Komponenten auf EINEN Maschinenraum-Bone-Punkt (Spielgeometrie, z.B.
  // Hammerhead 7×). Ohne Versatz lägen Sprites + Leader exakt übereinander.
  // Betrifft real nur ~5 Schiffe.
  const pts = holoPorts.map((p) => p.p as unknown as Vec3);
  fanOut(pts, hull);
  holoPorts.forEach((p, i) => {
    if (pts[i] !== (p.p as unknown)) p.p = (pts[i] as Vec3).map((x) => Math.round(x * 1000) / 1000);
  });

  if (!holoPorts.length) return null;
  const present = new Set(holoPorts.map((p2) => p2.g));
  return {
    url: meshUrl,
    mesh: meshBox,
    // ax: gehoert zum Vertrag mit assets/holo-viewer.js (Achsvertauschung
    // fuer kalibrierte Fremdmeshes). Die einzige verbliebene Quelle ist das
    // Spielmesh, das keine eigene Kalibrierung braucht -> immer null.
    ax: null,
    ports: holoPorts,
    groups: HOLO_GRP_ORDER.filter((gr) => present.has(gr)),
    defaultOn: HOLO_DEFAULT_ON.filter((gr) => present.has(gr)),
    kinds: Object.fromEntries([...new Set(holoPorts.map((p2) => p2.k))].map((k) => [k, t(`holo.kind.${k}` as any)])),
    grpLabels: Object.fromEntries(HOLO_GRP_ORDER.map((g) => [g, t(`holo.grp.${g}` as any)])),
    icons: Object.fromEntries([...new Set(holoPorts.map((p2) => p2.k))].filter((k) => HOLO_ICON[k]).map((k) => [k, HOLO_ICON[k]])),
    loc,
    finder: href('/item-finder.html', lang),
    /* Masskette der Gruppe „Ausstattung" (Phase 17): fertige Zeichenketten,
       weil die Sprache und die Einheit hier bekannt sind und im Viewer
       nicht. NUR wenn beide Masse wirklich vorliegen — eine 0 ist kein Mass
       (siehe Begruendung an `dims` in ShipDetail.astro), und eine Kette ohne
       Zahl waere ein Strich, der so tut, als messe er etwas. */
    masse: d.lengthM != null && d.lengthM > 0 && d.heightM != null && d.heightM > 0
      ? { laenge: `${d.lengthM.toLocaleString(loc)} m`, hoehe: `${d.heightM.toLocaleString(loc)} m` }
      : null,
  };
}
