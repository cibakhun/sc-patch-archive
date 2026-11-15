/* ============================================================
   hologramm.ts — der Inhalt der Vorschauseite „Patch am Hologramm"
   (src/components/patch-konzepte/Hologramm.astro).

   Zwei Herkuenfte, nie vermischt:
     berechnet  aus dem Datenvergleich 4.10.2 -> 4.10.3
                (src/data/patch-vergleich/4.10.2__4.10.3.json)
     ergaenzt   von Hand, faktengeprueft, aus
                src/data/patch-vergleich/ergaenzt/4.10.3.json
   verify:patch-vergleich haelt die Ergaenzungen gegen den Vergleich: fuehrt
   der Vergleich einen Wert selbst, reisst das Tor.

   Nur fuer den Seitenbau (Frontmatter).
   ============================================================ */
import { existsSync } from 'node:fs';
import { getCollection } from 'astro:content';
import { holoDaten, type HoloDaten } from '../holoPorts';
import { vergleichZu, feldLabel, seite, type Eintrag, type Wert } from '../patchVergleich';
import { items, pageItemIds } from '../items';
import { missionBySlug, bpCount } from '../missions';
import ERGAENZT from '../../data/patch-vergleich/ergaenzt/4.10.3.json';

const LANG = 'de' as const;
const n = (x: number) => x.toLocaleString('de-DE');

/* ---------- Typen ---------- */

export type Herkunft = 'berechnet' | 'ergaenzt';
/** Ort am Rumpf: alle Marker einer Bauteilart (k) oder nur bestimmte (i, Indizes in holo.ports). */
export type Ort = { k: string } | { i: number[] };
export type Wechsel = {
  key: string;
  label: string;
  vorher: string | null;
  nachher: string;
  /** Kurzform fuer die Beschriftung am Rumpf */
  kurz: string;
  /** null: kein Einbauort am Rumpf, steht nur in der Kennwert-Leiste */
  ort: Ort | null;
  herkunft: Herkunft;
  /** Seite des Dings, um das es geht (Basisform) */
  link: string | null;
};
export type Gruppe = 'neu' | 'geaendert' | 'kaufbar';
export type BuehnenSchiff = {
  id: string;
  name: string;
  gruppe: Gruppe;
  /** Art der Aenderung in Worten (Kopf der Leiste) */
  art: string;
  stand: string;
  seite: string;
  holo: HoloDaten;
  still: string | null;
  wechsel: Wechsel[];
};
export type Karte = {
  key: string;
  /** Mikro-Etikett: Art des Dings */
  art: string;
  name: string;
  link: string | null;
  /** Vorher -> nachher je Wert, oder Kennwerte eines neuen Dings */
  zeilen: { label: string; vorher: string | null; nachher: string }[];
  herkunft: Herkunft;
  /** Farbgruppe der Schiffsseite: core cyan, arms gold, prop accent-2, other violett */
  g: 'core' | 'arms' | 'prop' | 'other';
};
export type ReiterId = 'neu' | 'geaendert' | 'kaufbar' | 'auftraege' | 'bauplaene' | 'entfernt';
export type Reiter = { id: ReiterId; titel: string; satz: string; karten: Karte[]; extra?: Lackierungen };
export type Lackierungen = { anzahl: number; uebersicht: string; jeSchiff: { name: string; link: string | null; anzahl: number }[] };

/* ---------- Ergaenzungen ---------- */

type Ergaenzung = {
  id: string; kind: 'ship' | 'thema'; ziel: string | null; feld: string; label: string;
  vorher: string | null; nachher: string; reiter: ReiterId; link?: string;
};
const ERG = ERGAENZT as { nach: string; beleg: { t: string; h: string }; eintraege: Ergaenzung[] };
export const BELEG = ERG.beleg;

/* ---------- Feld -> Bauteilart am Rumpf ---------- */

/** Welche Felder des Vergleichs an welcher Bauteilart des Hologramms sitzen. */
const FELD_ART: Record<string, string> = {
  radars: 'radar', shields: 'shield', coolers: 'cooler', powerPlants: 'power', quantumDrives: 'quantum',
  turretWeapons: 'turret', turretDps: 'turret', fixedWeapons: 'weapon', pilotDps: 'weapon',
  missileRacks: 'missile', missileCount: 'missile', cmLaunchers: 'countermeasure', h2Fuel: 'fuel', qtFuel: 'fuel',
};
/** Kurzname der Bauteilart fuer die Beschriftung am Rumpf. */
const KURZ: Record<string, string> = {
  radars: 'Radar', shields: 'Schild', coolers: 'Kühler', powerPlants: 'Kraftwerk', quantumDrives: 'Quantenantrieb',
  turretWeapons: 'Turmwaffen', turretDps: 'Turm-DPS', fixedWeapons: 'Waffen', pilotDps: 'Pilot-DPS',
  missileRacks: 'Raketen', missileCount: 'Raketen', cmLaunchers: 'Täuschkörper', h2Fuel: 'Wasserstoff', qtFuel: 'Quantentreibstoff',
};

/* „2× SW16BR3 “Shredder” Repeater (S3)" */
type Teil = { anzahl: number; name: string; gr: number | null };
const TEIL = /^(\d+)× (.+?)(?: \(S(\d+)\))?$/;
function teil(s: string): Teil {
  const m = TEIL.exec(s);
  return m ? { anzahl: +m[1], name: m[2], gr: m[3] != null ? +m[3] : null } : { anzahl: 1, name: s, gr: null };
}
/** Interner Klassenname statt Spielname (RADR_WLOP_S03_Lephari): das Ding hatte keinen Namen. */
const INTERN = /^[A-Z]{3,}_[A-Z0-9]+_/;
const teilText = (t: Teil) => `${t.anzahl > 1 ? `${t.anzahl}× ` : ''}${t.name}${t.gr != null ? ` · Gr. ${t.gr}` : ''}`;

const itemNachName = new Map(items.map((i) => [i.name.toLowerCase(), i.id]));
const itemSeite = (name: string) => {
  const id = itemNachName.get(name.toLowerCase());
  return id && pageItemIds.has(id) ? `/items/${id}.html` : null;
};

function wertText(w: Wert): string {
  if (w == null) return '–';
  if (Array.isArray(w)) return w.map((s) => teilText(teil(s))).join(', ');
  if (typeof w === 'number') return n(w);
  if (typeof w === 'boolean') return w ? 'ja' : 'nein';
  return w;
}

/** Eine Feldaenderung als Wechsel, mit Kurzform fuer den Rumpf. */
function feldWechsel(v: NonNullable<ReturnType<typeof vergleichZu>>, schiff: string, feld: string, vorher: Wert, nachher: Wert): Omit<Wechsel, 'ort'> {
  const label = feldLabel(v, 'ship', feld, LANG);
  const kurz0 = KURZ[feld] ?? label;
  let kurz = `${kurz0} ${wertText(vorher)} → ${wertText(nachher)}`;
  let vt: string | null = wertText(vorher);
  let nt = wertText(nachher);
  let link: string | null = null;
  if (Array.isArray(vorher) && Array.isArray(nachher) && vorher.length === 1 && nachher.length === 1) {
    const a = teil(vorher[0]), b = teil(nachher[0]);
    link = itemSeite(b.name);
    const umbenannt = v.eintraege.some((e) => e.kind === 'item' && e.change === 'renamed' && e.name === b.name && e.nameVorher === a.name);
    if (INTERN.test(a.name)) { kurz = `${kurz0} neu benannt: ${b.name}`; vt = 'ohne Namen'; }
    else if (umbenannt) kurz = `${kurz0} neu benannt: ${a.name} → ${b.name}`;
    else if (a.anzahl !== b.anzahl && a.name === b.name) kurz = `${kurz0} ${a.anzahl} → ${b.anzahl}`;
    else if (a.gr != null && b.gr != null && a.gr !== b.gr) kurz = `${kurz0} Gr. ${a.gr} → ${b.gr}`;
    else kurz = `${kurz0}: ${a.name} → ${b.name}`;
  }
  if (feld === 'turretDps' || feld === 'pilotDps') kurz = `${n(vorher as number)} → ${n(nachher as number)} DPS`;
  return { key: `${schiff}:${feld}`, label, vorher: vt, nachher: nt, kurz, herkunft: 'berechnet', link };
}

/** Wo am Rumpf: die Marker der Art, deren Beschriftung das neue Bauteil nennt; sonst alle der Art. */
function ortAm(holo: HoloDaten, feld: string, nachher: Wert): Ort | null {
  const k = FELD_ART[feld];
  if (!k) return null;
  const derArt = holo.ports.map((p, i) => ({ p, i })).filter(({ p }) => p.k === k);
  if (!derArt.length) return null;
  const namen = Array.isArray(nachher) ? nachher.map((s) => teil(s).name.toLowerCase()) : [];
  const treffer = derArt.filter(({ p }) => namen.some((nm) => (p.label ?? '').toLowerCase().includes(nm)));
  return treffer.length && treffer.length < derArt.length ? { i: treffer.map(({ i }) => i) } : { k };
}

/* ---------- Raenge ---------- */

/** Rangleiter der Vertragsgilden, wie sie die Auftragsvarianten (rankMin <= rankMax) ergeben. */
export const RANG_LEITER = ['Neutral', 'Jr. Contractor', 'Contractor', 'Sr. Contractor', 'Veteran Contractor', 'Head Contractor', 'Elite Contractor'];
type Variante = { rankMin?: string | null; rankMax?: string | null };
/** Niedrigster und hoechster Rang ueber alle Varianten eines Auftrags; wirft, wenn ein Rang nicht auf der Leiter steht. */
export function rangSpanne(slug: string): { von: string; bis: string } {
  const m = missionBySlug.get(slug) as unknown as { variants?: Variante[] } | undefined;
  const vs = (m?.variants ?? []).filter((x) => x.rankMin || x.rankMax);
  if (!vs.length) throw new Error(`hologramm: Auftrag ${slug} ohne Rang in den Varianten`);
  const stufe = (r: string) => {
    const s = RANG_LEITER.indexOf(r);
    if (s < 0) throw new Error(`hologramm: Rang „${r}" (${slug}) steht nicht auf der Rangleiter`);
    return s;
  };
  const lo = Math.min(...vs.map((x) => stufe(x.rankMin ?? x.rankMax!)));
  const hi = Math.max(...vs.map((x) => stufe(x.rankMax ?? x.rankMin!)));
  return { von: RANG_LEITER[lo], bis: RANG_LEITER[hi] };
}

/* ---------- Der Inhalt ---------- */

export type HologrammInhalt = {
  stand: { von: string; nach: string };
  schiffe: BuehnenSchiff[];
  ohneHolo: { name: string; link: string | null }[];
  reiter: Reiter[];
  raenge: { rang: string; anzahl: number }[];
  /** id -> Aenderungen, fuer „Deine Flotte" */
  flotte: Record<string, { name: string; seite: string; art: string; zeilen: string[] }>;
  ergaenztAnzahl: number;
};

export async function hologrammInhalt(): Promise<HologrammInhalt> {
  const v = vergleichZu('4.10.3');
  if (!v) throw new Error('hologramm: Vergleich 4.10.2 -> 4.10.3 fehlt');
  if (ERG.nach !== v.nach.version) throw new Error(`hologramm: Ergaenzungen stehen auf ${ERG.nach}, der Vergleich auf ${v.nach.version}`);
  const fahrzeuge = new Map((await getCollection('vehicles')).map((x) => [x.id, x.data]));
  const fz = (id: string) => {
    const d = fahrzeuge.get(id);
    if (!d) throw new Error(`hologramm: Fahrzeug ${id} fehlt`);
    return d;
  };
  const E = v.eintraege;
  const alle = (kind: Eintrag['kind'], change: Eintrag['change']) => E.filter((e) => e.kind === kind && e.change === change);

  /* Lephari-Regel: ein „neues" Item, dessen Bauplan (gleiche guid) nur umbenannt
     wurde, ist ein altes Ding mit neuem Namen. */
  const bpUmbenannt = new Map(alle('blueprint', 'renamed').map((e) => [e.id, e as Extract<Eintrag, { change: 'renamed' }>]));
  const neuBenanntItem = (e: Eintrag) => e.kind === 'item' && e.change === 'new' && bpUmbenannt.has(e.id);

  /* ---- Buehne ---- */
  const ergZu = (id: string) => ERG.eintraege.filter((x) => x.kind === 'ship' && x.ziel === id);
  const ergWechsel = (x: Ergaenzung): Wechsel => ({
    key: x.id, label: x.label, vorher: x.vorher, nachher: x.nachher,
    kurz: x.vorher ? `${x.label} ${x.vorher} → ${x.nachher}` : `${x.label}: ${x.nachher}`,
    ort: null, herkunft: 'ergaenzt', link: x.link ?? null,
  });
  const still = (id: string) => {
    const p = `/assets/patch-4-10-3/render/${id}-holo.webp`;
    return existsSync(`assets${p.slice('/assets'.length)}`) ? p : null;
  };
  const schiffe: BuehnenSchiff[] = [];
  const ohneHolo: HologrammInhalt['ohneHolo'] = [];
  const stelle = (id: string, gruppe: Gruppe, art: string, stand: string, wechsel: (holo: HoloDaten) => Wechsel[]) => {
    const d = fz(id);
    const holo = holoDaten(d, LANG);
    if (!holo) { ohneHolo.push({ name: d.name, link: `/schiffe/${id}.html` }); return; }
    schiffe.push({ id, name: d.name, gruppe, art, stand, seite: `/schiffe/${id}.html`, holo, still: still(id), wechsel: [...wechsel(holo), ...ergZu(id).map(ergWechsel)] });
  };
  const NEU_FELDER = ['crewMin', 'hullHp', 'shieldHp', 'scmSpeed', 'cargoSCU'];
  // Galaxy zuerst: Standardschiff der Buehne
  const neu = alle('ship', 'new').sort((a, b) => +(b.id === 'rsi-galaxy') - +(a.id === 'rsi-galaxy'));
  for (const e of neu) {
    if (e.change !== 'new' || e.kind === 'price') continue;
    stelle(e.id, 'neu', 'Neu im Spiel', 'Stand 4.10.3', () => NEU_FELDER.flatMap((f) => {
      const w = e.werte.find((x) => x.feld === f);
      return w ? [{ key: `${e.id}:${f}`, label: feldLabel(v, 'ship', f, LANG), vorher: null, nachher: wertText(w.wert), kurz: '', ort: null, herkunft: 'berechnet' as const, link: null }] : [];
    }));
  }
  for (const e of alle('ship', 'changed')) {
    if (e.change !== 'changed') continue;
    stelle(e.id, 'geaendert', 'Geändert', '4.10.2 → 4.10.3', (holo) => e.felder.map((f) => ({ ...feldWechsel(v, e.id, f.feld, f.vorher, f.nachher), ort: ortAm(holo, f.feld, f.nachher) })));
  }
  for (const e of alle('ship', 'renamed')) {
    if (e.change !== 'renamed') continue;
    stelle(e.id, 'geaendert', 'Neu benannt', '4.10.2 → 4.10.3', () => [{ key: `${e.id}:name`, label: 'Name', vorher: e.nameVorher, nachher: e.name, kurz: '', ort: null, herkunft: 'berechnet', link: null }]);
  }
  const imVergleich = new Set(E.filter((e) => e.kind === 'ship').map((e) => e.id));
  for (const id of [...new Set(ERG.eintraege.filter((x) => x.kind === 'ship' && x.ziel && !imVergleich.has(x.ziel)).map((x) => x.ziel!))]) {
    stelle(id, 'geaendert', 'Geändert', '4.10.2 → 4.10.3', () => []);
  }
  for (const e of alle('price', 'new')) {
    if (e.kind !== 'price' || e.change !== 'new') continue;
    const min = Math.min(...e.angebote.map((a) => a.preis));
    const orte = [...new Set(e.angebote.map((a) => (a.system === 'Pyro' ? 'Pyro' : a.ort)))];
    stelle(e.id, 'kaufbar', 'Neu für aUEC', 'Preise vom ' + v.nach.preiseVom.split('-').reverse().join('.'), () => [
      { key: `${e.id}:preis`, label: 'Kaufpreis ab', vorher: null, nachher: `${n(min)} aUEC`, kurz: '', ort: null, herkunft: 'berechnet', link: null },
      { key: `${e.id}:orte`, label: 'Kaufbar in', vorher: null, nachher: orte.join(', '), kurz: '', ort: null, herkunft: 'berechnet', link: null },
    ]);
  }

  /* ---- Reiter ---- */
  const karte = (e: Eintrag, art: string, zeilen: Karte['zeilen'], g: Karte['g']): Karte => ({ key: `${e.kind}:${e.id}`, art, name: e.name, link: seite(e), zeilen, herkunft: 'berechnet', g });
  const ergKarte = (x: Ergaenzung, art: string, g: Karte['g']): Karte => ({
    key: `erg:${x.id}`, art, name: x.ziel ? fz(x.ziel).name : x.label,
    link: x.ziel ? `/schiffe/${x.ziel}.html` : x.link ?? null,
    zeilen: [{ label: x.ziel ? x.label : 'Patch Notes', vorher: x.vorher, nachher: x.nachher }], herkunft: 'ergaenzt', g,
  });
  /* Groesse nur, wo sie etwas sagt: bei Kleidung und Lackierungen steht sie immer auf 1. */
  const werteZeilen = (e: Eintrag, felder: string[]) => (e.change === 'new' && 'werte' in e ? e.werte : [])
    .filter((w, _, alle) => felder.includes(w.feld) && (w.feld !== 'size' || e.kind !== 'item' || alle.some((x) => x.feld === 'class' || x.feld === 'health'))).map((w) => ({ label: feldLabel(v, e.kind as 'item', w.feld, LANG), vorher: null, nachher: wertText(w.wert) }));
  const felderZeilen = (e: Eintrag) => ('felder' in e ? e.felder : []).map((f) => {
    const w = feldWechsel(v, e.id, f.feld, f.vorher, f.nachher);
    return { label: feldLabel(v, e.kind as 'item', f.feld, LANG), vorher: f.feld === 'missions' ? `${(f.vorher as string[]).length} Aufträge` : w.vorher, nachher: f.feld === 'missions' ? `${(f.nachher as string[]).length} Aufträge` : w.nachher };
  });

  const istLackierung = (e: Eintrag) => e.kind === 'item' && /\bLivery$/.test(e.name);
  const neuItems = alle('item', 'new').filter((e) => !neuBenanntItem(e));
  const lack = neuItems.filter(istLackierung);
  const schiffNachName = [...fahrzeuge.values()].map((d) => ({ id: d.id, name: d.name })).sort((a, b) => b.name.length - a.name.length);
  const jeSchiff = new Map<string, { name: string; link: string | null; anzahl: number }>();
  for (const e of lack) {
    const s = schiffNachName.find((x) => e.name.toLowerCase().startsWith(x.name.toLowerCase() + ' '));
    const key = s?.id ?? e.name.replace(/ \S+ Livery$/, '');
    const z = jeSchiff.get(key) ?? { name: s?.name ?? key, link: s ? `/schiffe/${s.id}.html` : seite(e), anzahl: 0 };
    z.anzahl++;
    jeSchiff.set(key, z);
  }
  const reiter: Reiter[] = [
    {
      id: 'neu', titel: 'Neu', satz: 'Neue Fahrzeuge und Gegenstände, mit ihren Werten aus 4.10.3.',
      karten: [
        ...alle('ship', 'new').map((e) => karte(e, 'Fahrzeug', werteZeilen(e, ['crewMin', 'hullHp', 'shieldHp', 'cargoSCU']), 'core')),
        ...ERG.eintraege.filter((x) => x.reiter === 'neu').map((x) => ergKarte(x, 'Fahrzeug', 'core')),
        ...neuItems.filter((e) => !istLackierung(e)).map((e) => karte(e, 'Gegenstand', werteZeilen(e, ['size', 'class', 'dps', 'shieldHp', 'health']), 'other')),
      ],
      extra: { anzahl: lack.length, uebersicht: '/items/category/vehiclegear-liveries.html', jeSchiff: [...jeSchiff.values()].sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name)) },
    },
    {
      id: 'geaendert', titel: 'Geändert', satz: 'Andere Werte als in 4.10.2.',
      karten: [
        ...alle('ship', 'changed').map((e) => karte(e, 'Fahrzeug', felderZeilen(e), 'core')),
        ...alle('item', 'changed').map((e) => karte(e, 'Gegenstand', felderZeilen(e), 'arms')),
        ...ERG.eintraege.filter((x) => x.reiter === 'geaendert').map((x) => ergKarte(x, x.ziel ? 'Fahrzeug' : 'Patch Notes', x.ziel ? 'core' : 'arms')),
      ],
    },
    {
      id: 'kaufbar', titel: 'Neu kaufbar', satz: 'Zum ersten Mal im Spiel für aUEC zu kaufen.',
      karten: alle('price', 'new').map((e) => {
        const a = e.kind === 'price' && e.change === 'new' ? e.angebote : [];
        const orte = [...new Map(a.map((x) => [x.system === 'Pyro' ? 'Pyro' : x.ort, x])).values()];
        return karte(e, 'Fahrzeug', orte.map((x) => ({ label: x.system === 'Pyro' ? 'Pyro, Buy and Fly' : `${x.ort}, ${x.haendler}`, vorher: null, nachher: `${n(x.preis)} aUEC` })), 'arms');
      }),
    },
    {
      id: 'auftraege', titel: 'Aufträge', satz: 'Neue Aufträge mit dem Rang, ab dem sie angeboten werden.',
      karten: [
        ...alle('mission', 'new').map((e) => {
          const r = rangSpanne(e.slug!);
          const m = missionBySlug.get(e.slug!);
          const bp = m ? bpCount(m) : 0;
          return karte(e, (m?.giverNames?.[0] as string | undefined) ?? 'Auftrag', [
            { label: 'Rang', vorher: null, nachher: r.von === r.bis ? `nur ${r.von}` : `${r.von} bis ${r.bis}` },
            { label: 'Baupläne als Belohnung', vorher: null, nachher: bp ? `${bp} möglich` : 'keine' },
          ], 'arms');
        }),
        ...ERG.eintraege.filter((x) => x.reiter === 'auftraege').map((x) => ergKarte(x, 'Patch Notes', 'arms')),
      ],
    },
    {
      id: 'bauplaene', titel: 'Baupläne', satz: 'Neue und geänderte Baupläne.',
      karten: [
        ...alle('blueprint', 'new').map((e) => karte(e, 'Bauplan neu', werteZeilen(e, ['craft_time_seconds']).map((z) => ({ ...z, label: 'Herstellzeit', nachher: `${z.nachher} s` })), 'prop')),
        ...alle('blueprint', 'changed').map((e) => karte(e, 'Bauplan geändert', felderZeilen(e), 'prop')),
      ],
    },
    {
      id: 'entfernt', titel: 'Entfernt und umbenannt', satz: 'Was es nicht mehr gibt und was einen neuen Namen trägt.',
      karten: [
        ...alle('ship', 'removed').map((e) => karte(e, 'Fahrzeug entfernt', [{ label: 'Status', vorher: 'eigenes Fahrzeug', nachher: 'entfernt' }], 'other')),
        ...[...alle('ship', 'renamed'), ...alle('item', 'renamed'), ...alle('blueprint', 'renamed')].map((e) =>
          karte(e, e.kind === 'ship' ? 'Fahrzeug' : e.kind === 'item' ? 'Gegenstand' : 'Bauplan', [{ label: 'Name', vorher: e.change === 'renamed' ? e.nameVorher : null, nachher: e.name }], 'other')),
        ...alle('item', 'new').filter(neuBenanntItem).map((e) => karte(e, 'Gegenstand', [{ label: 'Name', vorher: 'ohne Namen', nachher: e.name }], 'other')),
      ],
    },
  ];

  /* ---- Raenge der neuen Auftraege ---- */
  const zaehl = new Map<string, number>();
  for (const e of alle('mission', 'new')) { const r = rangSpanne(e.slug!).von; zaehl.set(r, (zaehl.get(r) ?? 0) + 1); }
  const raenge = RANG_LEITER.filter((r) => zaehl.has(r)).map((rang) => ({ rang, anzahl: zaehl.get(rang)! }));

  /* ---- Flotte ---- */
  const flotte: HologrammInhalt['flotte'] = {};
  for (const s of schiffe) {
    flotte[s.id] = { name: s.name, seite: s.seite, art: s.art, zeilen: s.wechsel.map((w) => (w.vorher ? `${w.label}: ${w.vorher} → ${w.nachher}` : `${w.label}: ${w.nachher}`)) };
  }
  for (const e of alle('ship', 'new')) if (!flotte[e.id]) flotte[e.id] = { name: e.name, seite: `/schiffe/${e.id}.html`, art: 'Neu im Spiel', zeilen: [] };
  for (const { name, link } of jeSchiff.values()) {
    const id = link?.match(/^\/schiffe\/(.+)\.html$/)?.[1];
    if (!id) continue;
    const z = `${jeSchiff.get(id)!.anzahl} neue Lackierung${jeSchiff.get(id)!.anzahl > 1 ? 'en' : ''}`;
    if (flotte[id]) flotte[id].zeilen.push(z);
    else flotte[id] = { name, seite: link!, art: 'Neue Lackierung', zeilen: [z] };
  }

  return {
    stand: { von: v.von.version, nach: v.nach.version },
    schiffe, ohneHolo, reiter, raenge, flotte,
    ergaenztAnzahl: ERG.eintraege.length,
  };
}
