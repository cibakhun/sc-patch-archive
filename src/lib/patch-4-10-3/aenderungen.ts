/* ============================================================
   aenderungen.ts — die Listen aller Aenderungen von 4.10.2 auf 4.10.3,
   die Rangleiter der Auftraege und das Wertformat dazu.

   Zwei Herkuenfte, nie vermischt:
     berechnet  aus dem Datenvergleich 4.10.2 -> 4.10.3
                (src/data/patch-vergleich/4.10.2__4.10.3.json)
     ergaenzt   von Hand, faktengeprueft, aus
                src/data/patch-vergleich/ergaenzt/4.10.3.json
   verify:patch-vergleich haelt die Ergaenzungen gegen den Vergleich: fuehrt
   der Vergleich einen Wert selbst, reisst das Tor.

   Nur fuer den Seitenbau (Frontmatter).
   ============================================================ */
import { getCollection } from 'astro:content';
import type { Locale } from '../../i18n/ui';
import { auftragHeute, vergleichZu, feldLabel, seite, type Eintrag, type Wert } from '../patchVergleich';
import { bpCount, kurztitel } from '../missions';
import ERGAENZT from '../../data/patch-vergleich/ergaenzt/4.10.3.json';

/* ---------- Typen ---------- */

export type Herkunft = 'berechnet' | 'ergaenzt';
export type Karte = {
  key: string;
  /** Art des Dings in Worten („Fahrzeug“, „Bauplan neu“) */
  art: string;
  name: string;
  link: string | null;
  /** Vorher -> nachher je Wert, oder Kennwerte eines neuen Dings */
  zeilen: { label: string; vorher: string | null; nachher: string }[];
  herkunft: Herkunft;
  /** Fahrzeug-id, wenn die Karte ein Schiff ist */
  schiff?: string;
};
export type ReiterId = 'neu' | 'geaendert' | 'auftraege' | 'bauplaene' | 'entfernt';
export type Lackierungen = { anzahl: number; uebersicht: string; jeSchiff: { name: string; link: string | null; anzahl: number }[] };
export type Reiter = { id: ReiterId; titel: string; karten: Karte[]; extra?: Lackierungen };

/* ---------- Ergaenzungen ---------- */

type ErgText = { label: string; vorher?: string | null; nachher: string };
type Ergaenzung = {
  id: string; kind: 'ship' | 'thema'; ziel: string | null; feld: string; label: string;
  vorher: string | null; nachher: string; reiter: ReiterId; link?: string; en: ErgText;
};
const ERG = ERGAENZT as { nach: string; eintraege: Ergaenzung[] };
/** Die Ergaenzung in der Sprache der Seite. */
const ergText = (x: Ergaenzung, lang: Locale): Required<ErgText> =>
  lang === 'en' ? { label: x.en.label, vorher: x.en.vorher === undefined ? x.vorher : x.en.vorher, nachher: x.en.nachher } : { label: x.label, vorher: x.vorher, nachher: x.nachher };

/* ---------- Werte ---------- */

/* „2× SW16BR3 “Shredder” Repeater (S3)" */
type Teil = { anzahl: number; name: string; gr: number | null };
const TEIL = /^(\d+)× (.+?)(?: \(S(\d+)\))?$/;
function teil(s: string): Teil {
  const m = TEIL.exec(s);
  return m ? { anzahl: +m[1], name: m[2], gr: m[3] != null ? +m[3] : null } : { anzahl: 1, name: s, gr: null };
}
/** Einheit je Zahlenfeld, damit kein Wert nackt dasteht. */
const EINHEIT: Record<string, string> = {
  cargoSCU: 'SCU', h2Fuel: 'SCU', qtFuel: 'SCU', massKg: 'kg', scmSpeed: 'm/s', maxSpeed: 'm/s', boostForward: 'm/s', qtSpeedMs: 'm/s', speed: 'm/s',
  qtRangeM: 'm', range: 'm', pitch: '°/s', yaw: '°/s', roll: '°/s', pilotDps: 'DPS', turretDps: 'DPS', dps: 'DPS', fireRate: 'RPM',
  hullHp: 'HP', shieldHp: 'HP', health: 'HP', craft_time_seconds: 's', rewardMin: 'aUEC', rewardMax: 'aUEC',
};
/** Interner Klassenname statt Spielname (RADR_WLOP_S03_Lephari): das Ding hatte keinen Namen. */
const INTERN = /^[A-Z]{3,}_[A-Z0-9]+_/;

/** Ein Vergleichswert als Text: Zahl mit Einheit, Bauteile als „2× Name · Gr. 3“. */
export function wertTextFuer(lang: Locale): (w: Wert, feld?: string) => string {
  const de = lang === 'de';
  const n = (x: number) => x.toLocaleString(de ? 'de-DE' : 'en-US');
  const gr = de ? 'Gr.' : 'size';
  const teilText = (t: Teil) => `${t.anzahl > 1 ? `${t.anzahl}× ` : ''}${t.name}${t.gr != null ? ` · ${gr} ${t.gr}` : ''}`;
  return (w, feld) => {
    if (w == null) return '–';
    if (Array.isArray(w)) return w.map((s) => teilText(teil(s))).join(', ');
    if (typeof w === 'number') return feld && EINHEIT[feld] ? `${n(w)} ${EINHEIT[feld]}` : n(w);
    if (typeof w === 'boolean') return w ? (de ? 'ja' : 'yes') : (de ? 'nein' : 'no');
    return w;
  };
}

/* ---------- Raenge und Auftraege ---------- */

/** Rangleiter der Vertragsgilden, wie sie die Auftragsvarianten (rankMin <= rankMax) ergeben. */
export const RANG_LEITER = ['Neutral', 'Jr. Contractor', 'Contractor', 'Sr. Contractor', 'Veteran Contractor', 'Head Contractor', 'Elite Contractor'];
/** Niedrigster und hoechster Rang ueber alle Varianten eines Auftrags; wirft, wenn ein Rang nicht auf der Leiter steht. */
export function rangSpanne(slug: string): { von: string; bis: string } {
  const m = auftragHeute(slug);
  const vs = (m?.variants ?? []).filter((x) => x.rankMin || x.rankMax);
  if (!vs.length) throw new Error(`aenderungen: Auftrag ${slug} ohne Rang in den Varianten`);
  const stufe = (r: string) => {
    const s = RANG_LEITER.indexOf(r);
    if (s < 0) throw new Error(`aenderungen: Rang „${r}" (${slug}) steht nicht auf der Rangleiter`);
    return s;
  };
  const lo = Math.min(...vs.map((x) => stufe(x.rankMin ?? x.rankMax!)));
  const hi = Math.max(...vs.map((x) => stufe(x.rankMax ?? x.rankMin!)));
  return { von: RANG_LEITER[lo], bis: RANG_LEITER[hi] };
}

/** Anzeigename eines Auftrags: sein Titel im Spiel, im heutigen Datenstand. */
export function auftragName(slug: string): string {
  const m = auftragHeute(slug);
  if (!m || m.noTitle) throw new Error(`aenderungen: Auftrag ${slug} hat im heutigen Datenstand keinen Titel`);
  return kurztitel(m.title);
}

/* ---------- Die Listen ---------- */

/**
 * Alle Aenderungen von 4.10.2 auf 4.10.3 als Listen: neu, geaendert,
 * Auftraege, Bauplaene, entfernt und umbenannt. Neu kaufbare Schiffe
 * stellt die Seite selbst zusammen (Laeden nach den Patch Notes).
 */
export async function aenderungsListen(lang: Locale): Promise<Reiter[]> {
  const T = (d: string, e: string) => (lang === 'de' ? d : e);
  const wertText = wertTextFuer(lang);
  const v = vergleichZu('4.10.3');
  if (!v) throw new Error('aenderungen: Vergleich 4.10.2 -> 4.10.3 fehlt');
  if (ERG.nach !== v.nach.version) throw new Error(`aenderungen: Ergaenzungen stehen auf ${ERG.nach}, der Vergleich auf ${v.nach.version}`);
  const fahrzeuge = new Map((await getCollection('vehicles')).map((x) => [x.id, x.data]));
  const fz = (id: string) => {
    const d = fahrzeuge.get(id);
    if (!d) throw new Error(`aenderungen: Fahrzeug ${id} fehlt`);
    return d;
  };
  const E = v.eintraege;
  const alle = (kind: Eintrag['kind'], change: Eintrag['change']) => E.filter((e) => e.kind === kind && e.change === change);

  /** Eine Feldaenderung als Text; ein Bauteil, das vorher nur einen internen Namen trug, heisst „ohne Namen“. */
  const feldTexte = (feld: string, vorher: Wert, nachher: Wert) => {
    const ohneNamen = Array.isArray(vorher) && Array.isArray(nachher) && vorher.length === 1 && nachher.length === 1 && INTERN.test(teil(vorher[0]).name);
    return { vorher: ohneNamen ? T('ohne Namen', 'unnamed') : wertText(vorher, feld), nachher: wertText(nachher, feld) };
  };

  /* Lephari-Regel: ein „neues" Item, dessen Bauplan (gleiche guid) nur umbenannt
     wurde, ist ein altes Ding mit neuem Namen. */
  const bpUmbenannt = new Set(alle('blueprint', 'renamed').map((e) => e.id));
  const neuBenanntItem = (e: Eintrag) => e.kind === 'item' && e.change === 'new' && bpUmbenannt.has(e.id);

  const karte = (e: Eintrag, art: string, zeilen: Karte['zeilen']): Karte => ({ key: `${e.kind}:${e.id}`, art, name: e.name, link: seite(e), zeilen, herkunft: 'berechnet', ...(e.kind === 'ship' ? { schiff: e.id } : {}) });
  const ergKarte = (x: Ergaenzung, art: string): Karte => {
    const t = ergText(x, lang);
    return {
      key: `erg:${x.id}`, art, name: x.ziel ? fz(x.ziel).name : t.label,
      link: x.ziel ? `/schiffe/${x.ziel}.html` : x.link ?? null,
      zeilen: [{ label: x.ziel ? t.label : 'Patch Notes', vorher: t.vorher, nachher: t.nachher }], herkunft: 'ergaenzt',
      ...(x.ziel ? { schiff: x.ziel } : {}),
    };
  };
  /* Groesse nur, wo sie etwas sagt: bei Kleidung und Lackierungen steht sie immer auf 1. */
  const werteZeilen = (e: Eintrag, felder: string[]) => (e.change === 'new' && 'werte' in e ? e.werte : [])
    .filter((w, _, ws) => felder.includes(w.feld) && (w.feld !== 'size' || e.kind !== 'item' || ws.some((x) => x.feld === 'class' || x.feld === 'health')))
    .map((w) => ({ label: feldLabel(v, e.kind as 'item', w.feld, lang), vorher: null, nachher: wertText(w.wert, w.feld) }));
  const auftraegeText = (x: Wert) => T(`${(x as string[]).length} Aufträge`, `${(x as string[]).length} contracts`);
  const felderZeilen = (e: Eintrag) => ('felder' in e ? e.felder : []).map((f) => {
    const w = feldTexte(f.feld, f.vorher, f.nachher);
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
  return [
    {
      id: 'neu', titel: T('Neu', 'New'),
      karten: [
        ...alle('ship', 'new').map((e) => karte(e, A.fz, werteZeilen(e, ['crewMin', 'hullHp', 'shieldHp', 'cargoSCU']))),
        ...ERG.eintraege.filter((x) => x.reiter === 'neu').map((x) => ergKarte(x, A.fz)),
        ...neuItems.filter((e) => !istLackierung(e)).map((e) => karte(e, A.ge, werteZeilen(e, ['size', 'class', 'dps', 'shieldHp', 'health']))),
      ],
      extra: { anzahl: lack.length, uebersicht: '/items/category/vehiclegear-liveries.html', jeSchiff: [...jeSchiff.values()].sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name)) },
    },
    {
      id: 'geaendert', titel: T('Geändert', 'Changed'),
      karten: [
        ...alle('ship', 'changed').map((e) => karte(e, A.fz, felderZeilen(e))),
        ...alle('item', 'changed').map((e) => karte(e, A.ge, felderZeilen(e))),
        ...ERG.eintraege.filter((x) => x.reiter === 'geaendert').map((x) => ergKarte(x, x.ziel ? A.fz : A.notes)),
      ],
    },
    {
      id: 'auftraege', titel: T('Aufträge', 'Contracts'),
      karten: alle('mission', 'new').map((e) => {
        const r = rangSpanne(e.slug!);
        const m = auftragHeute(e.slug!);
        const bp = m ? bpCount(m) : 0;
        return { ...karte(e, (m?.giverNames?.[0] as string | undefined) ?? T('Auftrag', 'Contract'), [
          { label: T('Rang', 'Rank'), vorher: null, nachher: r.von === r.bis ? T(`nur ${r.von}`, `${r.von} only`) : `${r.von} ${T('bis', 'to')} ${r.bis}` },
          { label: T('Baupläne als Belohnung', 'Blueprint rewards'), vorher: null, nachher: bp ? T(`${bp} möglich`, `${bp} possible`) : T('keine', 'none') },
        ]), name: auftragName(e.slug!) };
      }),
    },
    {
      id: 'bauplaene', titel: T('Baupläne', 'Blueprints'),
      karten: [
        ...alle('blueprint', 'new').map((e) => karte(e, T('Bauplan neu', 'New blueprint'), werteZeilen(e, ['craft_time_seconds']).map((z) => ({ ...z, label: T('Herstellzeit', 'Craft time') })))),
        ...alle('blueprint', 'changed').map((e) => karte(e, T('Bauplan geändert', 'Changed blueprint'), felderZeilen(e))),
      ],
    },
    {
      id: 'entfernt', titel: T('Entfernt und umbenannt', 'Removed and renamed'),
      karten: [
        ...alle('ship', 'removed').map((e) => karte(e, T('Fahrzeug entfernt', 'Vehicle removed'), [{ label: 'Status', vorher: T('eigenes Fahrzeug', 'own vehicle'), nachher: T('entfernt', 'removed') }])),
        ...[...alle('ship', 'renamed'), ...alle('item', 'renamed'), ...alle('blueprint', 'renamed')].map((e) =>
          karte(e, e.kind === 'ship' ? A.fz : e.kind === 'item' ? A.ge : T('Bauplan', 'Blueprint'), [{ label: 'Name', vorher: e.change === 'renamed' ? e.nameVorher : null, nachher: e.name }])),
        ...alle('item', 'new').filter(neuBenanntItem).map((e) => karte(e, A.ge, [{ label: 'Name', vorher: T('ohne Namen', 'unnamed'), nachher: e.name }])),
      ],
    },
  ];
}
