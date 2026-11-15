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
import type { Locale } from '../../i18n/ui';
import { holoDaten, type HoloDaten } from '../holoPorts';
import { vergleichZu, feldLabel, seite, type Eintrag, type Wert, type PatchVergleich } from '../patchVergleich';
import { items, pageItemIds } from '../items';
import { missionBySlug, bpCount } from '../missions';
import ERGAENZT from '../../data/patch-vergleich/ergaenzt/4.10.3.json';

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

type ErgText = { label: string; vorher?: string | null; nachher: string };
type Ergaenzung = {
  id: string; kind: 'ship' | 'thema'; ziel: string | null; feld: string; label: string;
  vorher: string | null; nachher: string; reiter: ReiterId; link?: string; en: ErgText;
};
const ERG = ERGAENZT as { nach: string; beleg: { t: string; h: string }; eintraege: Ergaenzung[] };
export const BELEG = ERG.beleg;
/** Die Ergaenzung in der Sprache der Seite. */
const ergText = (x: Ergaenzung, lang: Locale): Required<ErgText> =>
  lang === 'en' ? { label: x.en.label, vorher: x.en.vorher === undefined ? x.vorher : x.en.vorher, nachher: x.en.nachher } : { label: x.label, vorher: x.vorher, nachher: x.nachher };

/* ---------- Feld -> Bauteilart am Rumpf ---------- */

/** Welche Felder des Vergleichs an welcher Bauteilart des Hologramms sitzen. */
const FELD_ART: Record<string, string> = {
  radars: 'radar', shields: 'shield', coolers: 'cooler', powerPlants: 'power', quantumDrives: 'quantum',
  turretWeapons: 'turret', turretDps: 'turret', fixedWeapons: 'weapon', pilotDps: 'weapon',
  missileRacks: 'missile', missileCount: 'missile', cmLaunchers: 'countermeasure', h2Fuel: 'fuel', qtFuel: 'fuel',
};
/** Kurzname der Bauteilart fuer die Beschriftung am Rumpf. */
const KURZ: Record<string, Record<Locale, string>> = {
  radars: { de: 'Radar', en: 'Radar' }, shields: { de: 'Schild', en: 'Shield' }, coolers: { de: 'Kühler', en: 'Cooler' },
  powerPlants: { de: 'Kraftwerk', en: 'Power plant' }, quantumDrives: { de: 'Quantenantrieb', en: 'Quantum drive' },
  turretWeapons: { de: 'Turmwaffen', en: 'Turret guns' }, turretDps: { de: 'Turm-DPS', en: 'Turret DPS' },
  fixedWeapons: { de: 'Waffen', en: 'Guns' }, pilotDps: { de: 'Pilot-DPS', en: 'Pilot DPS' },
  missileRacks: { de: 'Raketen', en: 'Missiles' }, missileCount: { de: 'Raketen', en: 'Missiles' },
  cmLaunchers: { de: 'Täuschkörper', en: 'Countermeasures' }, h2Fuel: { de: 'Wasserstoff', en: 'Hydrogen' }, qtFuel: { de: 'Quantentreibstoff', en: 'Quantum fuel' },
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

const itemNachName = new Map(items.map((i) => [i.name.toLowerCase(), i.id]));
const itemSeite = (name: string) => {
  const id = itemNachName.get(name.toLowerCase());
  return id && pageItemIds.has(id) ? `/items/${id}.html` : null;
};

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

export async function hologrammInhalt(lang: Locale): Promise<HologrammInhalt> {
  const de = lang === 'de';
  const T = (d: string, e: string) => (de ? d : e);
  const n = (x: number) => x.toLocaleString(de ? 'de-DE' : 'en-US');
  const gr = T('Gr.', 'size');
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

  const teilText = (t: Teil) => `${t.anzahl > 1 ? `${t.anzahl}× ` : ''}${t.name}${t.gr != null ? ` · ${gr} ${t.gr}` : ''}`;
  const wertText = (w: Wert): string => {
    if (w == null) return '–';
    if (Array.isArray(w)) return w.map((s) => teilText(teil(s))).join(', ');
    if (typeof w === 'number') return n(w);
    if (typeof w === 'boolean') return w ? T('ja', 'yes') : T('nein', 'no');
    return w;
  };

  /** Eine Feldaenderung als Wechsel, mit Kurzform fuer den Rumpf. */
  const feldWechsel = (vg: PatchVergleich, schiff: string, feld: string, vorher: Wert, nachher: Wert): Omit<Wechsel, 'ort'> => {
    const label = feldLabel(vg, 'ship', feld, lang);
    const kurz0 = KURZ[feld]?.[lang] ?? label;
    let kurz = `${kurz0} ${wertText(vorher)} → ${wertText(nachher)}`;
    let vt: string | null = wertText(vorher);
    const nt = wertText(nachher);
    let link: string | null = null;
    if (Array.isArray(vorher) && Array.isArray(nachher) && vorher.length === 1 && nachher.length === 1) {
      const a = teil(vorher[0]), b = teil(nachher[0]);
      link = itemSeite(b.name);
      const umbenannt = vg.eintraege.some((e) => e.kind === 'item' && e.change === 'renamed' && e.name === b.name && e.nameVorher === a.name);
      if (INTERN.test(a.name)) { kurz = `${kurz0} ${T('neu benannt', 'renamed')}: ${b.name}`; vt = T('ohne Namen', 'unnamed'); }
      else if (umbenannt) kurz = `${kurz0} ${T('neu benannt', 'renamed')}: ${a.name} → ${b.name}`;
      else if (a.anzahl !== b.anzahl && a.name === b.name) kurz = `${kurz0} ${a.anzahl} → ${b.anzahl}`;
      else if (a.gr != null && b.gr != null && a.gr !== b.gr) kurz = `${kurz0} ${gr} ${a.gr} → ${b.gr}`;
      else kurz = `${kurz0}: ${a.name} → ${b.name}`;
    }
    if (feld === 'turretDps' || feld === 'pilotDps') kurz = `${n(vorher as number)} → ${n(nachher as number)} DPS`;
    return { key: `${schiff}:${feld}`, label, vorher: vt, nachher: nt, kurz, herkunft: 'berechnet', link };
  };

  /* Lephari-Regel: ein „neues" Item, dessen Bauplan (gleiche guid) nur umbenannt
     wurde, ist ein altes Ding mit neuem Namen. */
  const bpUmbenannt = new Set(alle('blueprint', 'renamed').map((e) => e.id));
  const neuBenanntItem = (e: Eintrag) => e.kind === 'item' && e.change === 'new' && bpUmbenannt.has(e.id);

  /* ---- Buehne ---- */
  const ergZu = (id: string) => ERG.eintraege.filter((x) => x.kind === 'ship' && x.ziel === id);
  const ergWechsel = (x: Ergaenzung): Wechsel => {
    const t = ergText(x, lang);
    return {
      key: x.id, label: t.label, vorher: t.vorher, nachher: t.nachher,
      kurz: t.vorher ? `${t.label} ${t.vorher} → ${t.nachher}` : `${t.label}: ${t.nachher}`,
      ort: null, herkunft: 'ergaenzt', link: x.link ?? null,
    };
  };
  const still = (id: string) => {
    const p = `/assets/patch-4-10-3/render/${id}-holo.webp`;
    return existsSync(`assets${p.slice('/assets'.length)}`) ? p : null;
  };
  const schiffe: BuehnenSchiff[] = [];
  const ohneHolo: HologrammInhalt['ohneHolo'] = [];
  const stelle = (id: string, gruppe: Gruppe, art: string, stand: string, wechsel: (holo: HoloDaten) => Wechsel[]) => {
    const d = fz(id);
    const holo = holoDaten(d, lang);
    if (!holo) { ohneHolo.push({ name: d.name, link: `/schiffe/${id}.html` }); return; }
    schiffe.push({ id, name: d.name, gruppe, art, stand, seite: `/schiffe/${id}.html`, holo, still: still(id), wechsel: [...wechsel(holo), ...ergZu(id).map(ergWechsel)] });
  };
  const STAND_NACH = T(`Stand ${v.nach.version}`, `As of ${v.nach.version}`);
  const STAND_PAAR = `${v.von.version} → ${v.nach.version}`;
  const ART = { neu: T('Neu im Spiel', 'New in game'), geaendert: T('Geändert', 'Changed'), benannt: T('Neu benannt', 'Renamed'), kaufbar: T('Neu für aUEC', 'New for aUEC') };
  const NEU_FELDER = ['crewMin', 'hullHp', 'shieldHp', 'scmSpeed', 'cargoSCU'];
  // Galaxy zuerst: Standardschiff der Buehne
  const neu = alle('ship', 'new').sort((a, b) => +(b.id === 'rsi-galaxy') - +(a.id === 'rsi-galaxy'));
  for (const e of neu) {
    if (e.change !== 'new' || e.kind === 'price') continue;
    stelle(e.id, 'neu', ART.neu, STAND_NACH, () => NEU_FELDER.flatMap((f) => {
      const w = e.werte.find((x) => x.feld === f);
      return w ? [{ key: `${e.id}:${f}`, label: feldLabel(v, 'ship', f, lang), vorher: null, nachher: wertText(w.wert), kurz: '', ort: null, herkunft: 'berechnet' as const, link: null }] : [];
    }));
  }
  for (const e of alle('ship', 'changed')) {
    if (e.change !== 'changed') continue;
    stelle(e.id, 'geaendert', ART.geaendert, STAND_PAAR, (holo) => e.felder.map((f) => ({ ...feldWechsel(v, e.id, f.feld, f.vorher, f.nachher), ort: ortAm(holo, f.feld, f.nachher) })));
  }
  for (const e of alle('ship', 'renamed')) {
    if (e.change !== 'renamed') continue;
    stelle(e.id, 'geaendert', ART.benannt, STAND_PAAR, () => [{ key: `${e.id}:name`, label: 'Name', vorher: e.nameVorher, nachher: e.name, kurz: '', ort: null, herkunft: 'berechnet', link: null }]);
  }
  const imVergleich = new Set(E.filter((e) => e.kind === 'ship').map((e) => e.id));
  for (const id of [...new Set(ERG.eintraege.filter((x) => x.kind === 'ship' && x.ziel && !imVergleich.has(x.ziel)).map((x) => x.ziel!))]) {
    stelle(id, 'geaendert', ART.geaendert, STAND_PAAR, () => []);
  }
  const preiseVom = de ? v.nach.preiseVom.split('-').reverse().join('.') : v.nach.preiseVom;
  for (const e of alle('price', 'new')) {
    if (e.kind !== 'price' || e.change !== 'new') continue;
    const min = Math.min(...e.angebote.map((a) => a.preis));
    const orte = [...new Set(e.angebote.map((a) => (a.system === 'Pyro' ? 'Pyro' : a.ort)))];
    stelle(e.id, 'kaufbar', ART.kaufbar, T(`Preise vom ${preiseVom}`, `Prices from ${preiseVom}`), () => [
      { key: `${e.id}:preis`, label: T('Kaufpreis ab', 'Price from'), vorher: null, nachher: `${n(min)} aUEC`, kurz: '', ort: null, herkunft: 'berechnet', link: null },
      { key: `${e.id}:orte`, label: T('Kaufbar in', 'Sold in'), vorher: null, nachher: orte.join(', '), kurz: '', ort: null, herkunft: 'berechnet', link: null },
    ]);
  }

  /* ---- Reiter ---- */
  const karte = (e: Eintrag, art: string, zeilen: Karte['zeilen'], g: Karte['g']): Karte => ({ key: `${e.kind}:${e.id}`, art, name: e.name, link: seite(e), zeilen, herkunft: 'berechnet', g });
  const ergKarte = (x: Ergaenzung, art: string, g: Karte['g']): Karte => {
    const t = ergText(x, lang);
    return {
      key: `erg:${x.id}`, art, name: x.ziel ? fz(x.ziel).name : t.label,
      link: x.ziel ? `/schiffe/${x.ziel}.html` : x.link ?? null,
      zeilen: [{ label: x.ziel ? t.label : 'Patch Notes', vorher: t.vorher, nachher: t.nachher }], herkunft: 'ergaenzt', g,
    };
  };
  /* Groesse nur, wo sie etwas sagt: bei Kleidung und Lackierungen steht sie immer auf 1. */
  const werteZeilen = (e: Eintrag, felder: string[]) => (e.change === 'new' && 'werte' in e ? e.werte : [])
    .filter((w, _, ws) => felder.includes(w.feld) && (w.feld !== 'size' || e.kind !== 'item' || ws.some((x) => x.feld === 'class' || x.feld === 'health')))
    .map((w) => ({ label: feldLabel(v, e.kind as 'item', w.feld, lang), vorher: null, nachher: wertText(w.wert) }));
  const auftraegeText = (x: Wert) => T(`${(x as string[]).length} Aufträge`, `${(x as string[]).length} contracts`);
  const felderZeilen = (e: Eintrag) => ('felder' in e ? e.felder : []).map((f) => {
    const w = feldWechsel(v, e.id, f.feld, f.vorher, f.nachher);
    return { label: feldLabel(v, e.kind as 'item', f.feld, lang), vorher: f.feld === 'missions' ? auftraegeText(f.vorher) : w.vorher, nachher: f.feld === 'missions' ? auftraegeText(f.nachher) : w.nachher };
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
  const A = { fz: T('Fahrzeug', 'Vehicle'), ge: T('Gegenstand', 'Item'), notes: 'Patch Notes' };
  const reiter: Reiter[] = [
    {
      id: 'neu', titel: T('Neu', 'New'), satz: T('Neue Fahrzeuge und Gegenstände, mit ihren Werten aus 4.10.3.', 'New vehicles and items, with their 4.10.3 values.'),
      karten: [
        ...alle('ship', 'new').map((e) => karte(e, A.fz, werteZeilen(e, ['crewMin', 'hullHp', 'shieldHp', 'cargoSCU']), 'core')),
        ...ERG.eintraege.filter((x) => x.reiter === 'neu').map((x) => ergKarte(x, A.fz, 'core')),
        ...neuItems.filter((e) => !istLackierung(e)).map((e) => karte(e, A.ge, werteZeilen(e, ['size', 'class', 'dps', 'shieldHp', 'health']), 'other')),
      ],
      extra: { anzahl: lack.length, uebersicht: '/items/category/vehiclegear-liveries.html', jeSchiff: [...jeSchiff.values()].sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name)) },
    },
    {
      id: 'geaendert', titel: T('Geändert', 'Changed'), satz: T('Andere Werte als in 4.10.2.', 'Values that differ from 4.10.2.'),
      karten: [
        ...alle('ship', 'changed').map((e) => karte(e, A.fz, felderZeilen(e), 'core')),
        ...alle('item', 'changed').map((e) => karte(e, A.ge, felderZeilen(e), 'arms')),
        ...ERG.eintraege.filter((x) => x.reiter === 'geaendert').map((x) => ergKarte(x, x.ziel ? A.fz : A.notes, x.ziel ? 'core' : 'arms')),
      ],
    },
    {
      id: 'kaufbar', titel: T('Neu kaufbar', 'Newly buyable'), satz: T('Zum ersten Mal im Spiel für aUEC zu kaufen.', 'Buyable in game for aUEC for the first time.'),
      karten: alle('price', 'new').map((e) => {
        const a = e.kind === 'price' && e.change === 'new' ? e.angebote : [];
        const orte = [...new Map(a.map((x) => [x.system === 'Pyro' ? 'Pyro' : x.ort, x])).values()];
        return karte(e, A.fz, orte.map((x) => ({ label: x.system === 'Pyro' ? 'Pyro, Buy and Fly' : `${x.ort}, ${x.haendler}`, vorher: null, nachher: `${n(x.preis)} aUEC` })), 'arms');
      }),
    },
    {
      id: 'auftraege', titel: T('Aufträge', 'Contracts'), satz: T('Neue Aufträge mit dem Rang, ab dem sie angeboten werden.', 'New contracts with the rank they are offered from.'),
      karten: [
        ...alle('mission', 'new').map((e) => {
          const r = rangSpanne(e.slug!);
          const m = missionBySlug.get(e.slug!);
          const bp = m ? bpCount(m) : 0;
          return karte(e, (m?.giverNames?.[0] as string | undefined) ?? T('Auftrag', 'Contract'), [
            { label: T('Rang', 'Rank'), vorher: null, nachher: r.von === r.bis ? T(`nur ${r.von}`, `${r.von} only`) : `${r.von} ${T('bis', 'to')} ${r.bis}` },
            { label: T('Baupläne als Belohnung', 'Blueprint rewards'), vorher: null, nachher: bp ? T(`${bp} möglich`, `${bp} possible`) : T('keine', 'none') },
          ], 'arms');
        }),
        ...ERG.eintraege.filter((x) => x.reiter === 'auftraege').map((x) => ergKarte(x, A.notes, 'arms')),
      ],
    },
    {
      id: 'bauplaene', titel: T('Baupläne', 'Blueprints'), satz: T('Neue und geänderte Baupläne.', 'New and changed blueprints.'),
      karten: [
        ...alle('blueprint', 'new').map((e) => karte(e, T('Bauplan neu', 'New blueprint'), werteZeilen(e, ['craft_time_seconds']).map((z) => ({ ...z, label: T('Herstellzeit', 'Craft time'), nachher: `${z.nachher} s` })), 'prop')),
        ...alle('blueprint', 'changed').map((e) => karte(e, T('Bauplan geändert', 'Changed blueprint'), felderZeilen(e), 'prop')),
      ],
    },
    {
      id: 'entfernt', titel: T('Entfernt und umbenannt', 'Removed and renamed'), satz: T('Was es nicht mehr gibt und was einen neuen Namen trägt.', 'What is gone and what carries a new name.'),
      karten: [
        ...alle('ship', 'removed').map((e) => karte(e, T('Fahrzeug entfernt', 'Vehicle removed'), [{ label: 'Status', vorher: T('eigenes Fahrzeug', 'own vehicle'), nachher: T('entfernt', 'removed') }], 'other')),
        ...[...alle('ship', 'renamed'), ...alle('item', 'renamed'), ...alle('blueprint', 'renamed')].map((e) =>
          karte(e, e.kind === 'ship' ? A.fz : e.kind === 'item' ? A.ge : T('Bauplan', 'Blueprint'), [{ label: 'Name', vorher: e.change === 'renamed' ? e.nameVorher : null, nachher: e.name }], 'other')),
        ...alle('item', 'new').filter(neuBenanntItem).map((e) => karte(e, A.ge, [{ label: 'Name', vorher: T('ohne Namen', 'unnamed'), nachher: e.name }], 'other')),
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
  for (const e of alle('ship', 'new')) if (!flotte[e.id]) flotte[e.id] = { name: e.name, seite: `/schiffe/${e.id}.html`, art: ART.neu, zeilen: [] };
  for (const [key, { name, link, anzahl }] of jeSchiff) {
    const id = link?.match(/^\/schiffe\/(.+)\.html$/)?.[1];
    if (!id || id !== key) continue;
    const z = T(`${anzahl} neue Lackierung${anzahl > 1 ? 'en' : ''}`, `${anzahl} new ${anzahl > 1 ? 'liveries' : 'livery'}`);
    if (flotte[id]) flotte[id].zeilen.push(z);
    else flotte[id] = { name, seite: link!, art: T('Neue Lackierung', 'New livery'), zeilen: [z] };
  }

  return {
    stand: { von: v.von.version, nach: v.nach.version },
    schiffe, ohneHolo, reiter, raenge, flotte,
    ergaenztAnzahl: ERG.eintraege.length,
  };
}
