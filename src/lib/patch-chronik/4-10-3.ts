/* ============================================================
   4-10-3.ts — Inhalt der Chronik zu Alpha 4.10.3. Jede Zahl kommt aus dem
   Vergleich 4.10.2 -> 4.10.3, aus den Preisdaten (UEX Corp) oder aus
   src/data/patch-vergleich/ergaenzt/4.10.3.json; was nur die Patch Notes
   oder der Comm-Link sagen, steht als Satz mit Link darauf.
   Herkunft der Bilder: assets/patch-4-10-3/HERKUNFT.md.
   ============================================================ */
import { getCollection } from 'astro:content';
import { href, type Locale } from '../../i18n/ui';
import { feldLabel, seite, vergleichZu, type Eintrag } from '../patchVergleich';
import { aenderungsListen, auftragName, rangSpanne, RANG_LEITER, wertTextFuer, type Karte, type Reiter } from '../patch-4-10-3/aenderungen';
import BILDER from '../../data/patch-4-10-3/bilder-rsi.json';
import PREISE from '../../data/vehicle-prices.json';
import { vRoleCig } from '../../i18n/vehicleText';
import ERGAENZT from '../../data/patch-vergleich/ergaenzt/4.10.3.json';
import PATCH from '../../data/patches/4-10-3.json';
import PATCHES_EN from '../../data/patches-en.json';
import { bild, zahlAusVergleich, zahlText, type Beleg, type Chronik, type KaufbarKarte, type Liste, type ListenZeile, type NeuesSchiff, type Satz, type Verweis, type Wert } from './chronik';

const RSI = '/assets/patch-4-10-3/rsi';
/** Comm-Link „Alpha 4.10.3: Vanduul Incursion“: InterSec ruft in Nyx um Hilfe gegen die Vanduul. */
const INCURSION = 'https://robertsspaceindustries.com/en/comm-link/transmission/21420-Star-Citizen-Alpha-4103-Vanduul-Incursion';
/** Ziel von „More info“ im RSI-Banner zur IAE 2956 (New Babbage, Free Fly bis 27. November). */
const IAE = 'https://iae2956.com/';
const UEX = 'https://uexcorp.space';

/** Wo die Schiffe zum ersten Mal fuer aUEC stehen, so wie die Patch Notes 21429 sie nennen („Ships on Sale for aUEC“). */
const LAEDEN: Record<string, string[]> = {
  'aegs-tiburon': ['New Deal, Lorville'],
  'misc-starlite': ['New Deal, Lorville', "Teach's Ship Shop, Levski"],
  'drak-ironclad': ["Teach's Ship Shop, Levski"],
  'drak-pitbull': ["Teach's Ship Shop, Levski", 'Rundown Station, Pyro'],
  'drak-ironclad-assault': ['Rundown Station, Pyro'],
  'glsn-basher': ['Rundown Station, Pyro'],
  'orig-m80': ['Astro Armada, Area18'],
  'gama-tyilui': ['Astro Armada, Area18'],
};

/** Herstellerkurzform vor dem Schiffsnamen, wie in den Patch Notes („Drake Pitbull“, „Grey's Market Basher“). */
const KURZ: Record<string, string> = { 'Roberts Space Industries': 'RSI', 'Musashi Industrial and Starflight Concern': 'MISC', "Grey's Market": "Grey's Market" };
const vollerName = (name: string, hersteller: string | null) => {
  if (!hersteller) return name;
  const k = KURZ[hersteller] ?? hersteller.split(' ')[0];
  return name.startsWith(`${k} `) ? name : `${k} ${name}`;
};

const ZAHLWORT: Record<Locale, string[]> = {
  de: ['Null', 'Ein', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Elf', 'Zwölf'],
  en: ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'],
};

export async function chronik4103(lang: Locale): Promise<Chronik> {
  const de = lang === 'de';
  const T = (d: string, e: string) => (de ? d : e);
  const L = (p: string) => href(p, lang);
  const n = (x: number) => zahlText(x, lang);
  const wertText = wertTextFuer(lang);
  const v = vergleichZu('4.10.3');
  if (!v) throw new Error('chronik 4.10.3: Vergleich fehlt');
  const reiter = await aenderungsListen(lang);
  const liste = (id: Reiter['id']) => {
    const r = reiter.find((x) => x.id === id);
    if (!r) throw new Error(`chronik 4.10.3: Liste ${id} fehlt`);
    return r;
  };
  const fahrzeuge = new Map((await getCollection('vehicles')).map((x) => [x.id, x.data]));
  const fz = (id: string) => {
    const d = fahrzeuge.get(id);
    if (!d) throw new Error(`chronik 4.10.3: Fahrzeug ${id} fehlt`);
    return d;
  };
  const schiff = (id: string): Beleg => ({ t: vollerName(fz(id).name, fz(id).manufacturer), h: L(`/schiffe/${id}.html`) });
  const verweis = (t: string, h: string | null): Verweis => ({ t, h: h ? L(h) : null });
  const notes: Beleg = { t: 'Patch Notes', h: PATCH.notesUrl };
  const notesZu: Beleg = { t: T(`Patch Notes zu ${PATCH.version}`, `patch notes for ${PATCH.version}`), h: PATCH.notesUrl };
  if (ERGAENZT.beleg.h !== PATCH.notesUrl) throw new Error('chronik 4.10.3: Ergaenzung und Patch-Datei nennen verschiedene Patch Notes');
  const STAND = T(`Stand ${v.nach.version} · Vergleich mit ${v.von.version}`, `As of ${v.nach.version} · compared with ${v.von.version}`);
  const E = v.eintraege;

  /* ---- Vanduul: die eine geaenderte Waffe ---- */
  const STRIKER = 'vanduul-mauler-striker-repeater';
  const strikerAlt = E.find((e) => e.kind === 'item' && e.slug === STRIKER);
  if (!strikerAlt || !('felder' in strikerAlt)) throw new Error('chronik 4.10.3: STRIKER fehlt im Vergleich');
  const geaendert = new Set(strikerAlt.felder.map((f) => f.feld));
  /* Munition fehlt hier bewusst: laut Patch Notes tragen Vanduul-KI-Schiffe mehr davon. */
  const unveraendert = ['fireRate', 'speed', 'range']
    .filter((f) => f in v.felder.item && !geaendert.has(f))
    .map((f) => feldLabel(v, 'item', f, lang).replace(/\s*\(.*\)$/, ''))
    .map((l, i) => (de || i === 0 ? l : l.toLowerCase()));
  /* Weniger Lebenspunkte und mehr Munition stehen nur in den Patch Notes, nicht in unseren Daten. */
  const vanduulKi = ERGAENZT.eintraege.find((e) => e.id === 'vanduul-ki');
  if (!['weniger Lebenspunkten', 'mehr Munition', 'schnellere Nachladung'].every((s) => vanduulKi?.nachher.includes(s))) {
    throw new Error('chronik 4.10.3: Ergaenzung vanduul-ki nennt Lebenspunkte oder Munition nicht mehr');
  }
  const schuss = zahlAusVergleich(v, 'item', STRIKER, 'damage.energy');
  const dps = zahlAusVergleich(v, 'item', STRIKER, 'dps');
  const pfeil = (z: { vorher: number | null; wert: number }) => (z.vorher == null ? n(z.wert) : `${n(z.vorher)} → ${n(z.wert)}`);

  /* ---- InterSec: neue Auftraege nach dem Rang, ab dem sie angeboten werden ---- */
  const INTERSEC = 'InterSec Defense Solutions';
  const auftraege = E.filter((e) => e.kind === 'mission' && e.change === 'new'
    && 'werte' in e && (e.werte.find((w) => w.feld === 'giverNames')?.wert as string[] | undefined)?.includes(INTERSEC));
  const einstieg = new Map(auftraege.map((e) => [e.id, rangSpanne(e.slug!).von]));
  const raenge = RANG_LEITER.filter((rang) => auftraege.some((e) => einstieg.get(e.id) === rang)).map((rang) => ({
    titel: rang,
    eintraege: auftraege.filter((e) => einstieg.get(e.id) === rang).map((e) => verweis(auftragName(e.slug!), seite(e))),
  }));
  const slugs = new Set(auftraege.map((e) => e.slug));
  const neueBauplaene = E.filter((e) => e.kind === 'blueprint' && e.change === 'new');
  const ausAuftraegen = neueBauplaene.filter((e) => 'werte' in e
    && ((e.werte.find((w) => w.feld === 'missions')?.wert as string[] | undefined) ?? []).some((s) => slugs.has(s)));

  /* ---- Neue Schiffe: Kennwerte aus dem Vergleich, Beschreibung nach den Patch Notes ---- */
  const neuWert = (id: string, feld: string): Wert => {
    const e = E.find((x) => x.kind === 'ship' && x.id === id);
    if (!e || e.change !== 'new' || !('werte' in e)) throw new Error(`chronik 4.10.3: ${id} ist kein neues Schiff im Vergleich`);
    const w = e.werte.find((x) => x.feld === feld);
    if (!w) throw new Error(`chronik 4.10.3: ${id}.${feld} fehlt`);
    return { k: feldLabel(v, 'ship', feld, lang).replace(/\s*\(.*\)$/, ''), v: wertText(w.wert, feld) };
  };
  const modul = (slug: string): Wert => {
    const e = E.find((x) => x.kind === 'item' && x.slug === slug);
    if (!e) throw new Error(`chronik 4.10.3: Modul ${slug} fehlt`);
    const s = seite(e);
    const w = (feld: string) => ('werte' in e ? e.werte.find((x) => x.feld === feld)?.wert : undefined);
    const groesse = w('size');
    const hp = w('health');
    const v = [groesse != null ? `${T('Gr.', 'size')} ${groesse}` : null, hp != null ? wertText(hp, 'health') : null].filter(Boolean).join(' · ');
    if (!v) throw new Error(`chronik 4.10.3: Modul ${slug} ohne Groesse und Lebenspunkte`);
    return { k: e.name, v, h: s ? L(s) : null };
  };
  const frachtmodul = ERGAENZT.eintraege.find((e) => e.id === 'galaxy-frachtmodul');
  if (!frachtmodul?.link) throw new Error('chronik 4.10.3: Ergaenzung galaxy-frachtmodul fehlt oder hat keine Seite');
  const galaxy: NeuesSchiff = {
    id: 'rsi-galaxy', name: schiff('rsi-galaxy'), hersteller: fz('rsi-galaxy').manufacturer ?? '', bild: rsiBild('rsi-galaxy', lang),
    text: [
      [T('Die Galaxy ist ein großes Schiff für mehrere Personen, gebaut um ein austauschbares Mittelmodul. Das Frachtmodul bringt einen Lastenaufzug und Konsolen für Traktorstrahlen zum Be- und Entladen; das Med-Bay-Modul macht den Raum zum Feldlazarett mit Medbetten der Stufen 1, 2 und 3.',
        'The Galaxy is a large multi-crew ship built around a swappable central module. The cargo module adds an industrial lift and tractor beam consoles for loading and unloading; the med bay module turns the bay into a field hospital with tier 1, 2 and 3 medbeds.')],
    ],
    reiter: [
      { id: 'galaxy-werte', titel: T('Kennwerte', 'Specs'), werte: [neuWert('rsi-galaxy', 'hullHp'), neuWert('rsi-galaxy', 'shieldHp'), neuWert('rsi-galaxy', 'cargoSCU'),
        { k: T('Fracht mit Frachtmodul (Patch Notes)', 'Cargo with cargo module (patch notes)'), v: de ? frachtmodul.nachher : frachtmodul.en.nachher, h: L(frachtmodul.link) },
        neuWert('rsi-galaxy', 'crewMin'), neuWert('rsi-galaxy', 'scmSpeed')] },
      { id: 'galaxy-ausstattung', titel: T('Ausstattung', 'Loadout'), werte: [neuWert('rsi-galaxy', 'missileRacks'), neuWert('rsi-galaxy', 'radars')] },
      { id: 'galaxy-module', titel: T('Module', 'Modules'), werte: ['galaxy-cargo-module', 'galaxy-med-bay-module', 'galaxy-stock-module'].map(modul) },
    ],
    stempel: [`${T(`Stand ${v.nach.version}`, `As of ${v.nach.version}`)} · ${T('Beschreibung und Frachtmodul nach den ', 'Description and cargo module from the ')}`, notesZu],
  };
  const liberator: NeuesSchiff = {
    id: 'anvl-liberator', name: schiff('anvl-liberator'), hersteller: fz('anvl-liberator').manufacturer ?? '', bild: rsiBild('anvl-liberator', lang),
    text: [
      [T('Die Liberator ist ein schwerer Träger für Schiffe und Bodenfahrzeuge. Bodenfahrzeuge fahren über die Heckrampe in den Fahrzeugraum; Schiffe stehen im Innenhangar oder auf den Landeplätzen, teils im Rumpf, teils oben außen. Alles, was in der Liberator parkt, kann die Landedienste nutzen: Reparatur, Munition und Treibstoff.',
        'The Liberator is a heavy carrier for ships and ground vehicles. Ground vehicles load through the rear ramp into the vehicle bay; ships fit inside the interior hangar or set down on the landing pads, some within the hull and some along the upper exterior. Anything parked inside the Liberator can use landing services to repair, rearm and refuel.')],
    ],
    reiter: [
      { id: 'liberator-werte', titel: T('Kennwerte', 'Specs'), werte: ['hullHp', 'shieldHp', 'cargoSCU', 'crewMin', 'scmSpeed'].map((f) => neuWert('anvl-liberator', f)) },
      { id: 'liberator-ausstattung', titel: T('Ausstattung', 'Loadout'), werte: ['turretDps', 'turretWeapons', 'missileRacks', 'radars'].map((f) => neuWert('anvl-liberator', f)) },
    ],
    stempel: [`${T(`Stand ${v.nach.version}`, `As of ${v.nach.version}`)} · ${T('Beschreibung nach den ', 'Description from the ')}`, notesZu],
  };

  /* ---- IAE 2956: Kleidung und Lackierungen aus dem Vergleich ---- */
  const neueItems = E.filter((e) => e.kind === 'item' && e.change === 'new');
  const kleidung = neueItems.filter((e) => /^(IAE 2956 |2956 Best in Show )/.test(e.name));
  const lackierungen = neueItems.filter((e) => / 2956 Best In Show Livery$/.test(e.name));
  if (kleidung.length !== 3 || lackierungen.length !== 4) throw new Error(`chronik 4.10.3: IAE-Gegenstaende ${kleidung.length}/${lackierungen.length} statt 3/4`);
  const itemVerweis = (e: Eintrag) => verweis(e.name, seite(e));

  /* ---- Zum ersten Mal fuer aUEC: Laeden nach den Patch Notes, Preise ab UEX ---- */
  if (!PREISE.source.startsWith('UEX Corp')) throw new Error(`chronik 4.10.3: Preisquelle ist ${PREISE.source}, nicht UEX Corp`);
  const preiseVom = de ? v.nach.preiseVom.split('-').reverse().join('.') : v.nach.preiseVom;
  const kaufbarIds = E.filter((e) => e.kind === 'price' && e.change === 'new').map((e) => e.id);
  const ohneLaden = kaufbarIds.filter((id) => !LAEDEN[id]);
  if (ohneLaden.length || kaufbarIds.length !== Object.keys(LAEDEN).length) throw new Error(`chronik 4.10.3: Laeden und Preisdaten passen nicht (${ohneLaden.join(', ')})`);
  const preisAb = (id: string) => {
    const e = E.find((x) => x.kind === 'price' && x.id === id);
    if (!e || e.kind !== 'price' || e.change !== 'new') throw new Error(`chronik 4.10.3: Preis ${id} fehlt`);
    const ab = n(Math.min(...e.angebote.map((a) => a.preis)));
    return T(`ab ${ab} aUEC`, `from ${ab} aUEC`);
  };
  /* Eine Station dieses Namens fuehren die Spieldaten nicht; UEX Corp listet den Haendler unter anderen Stationen. */
  const laden = (l: string) => (l === 'Rundown Station, Pyro' ? T('Rundown Station, Pyro (laut Patch Notes)', 'Rundown Station, Pyro (per the patch notes)') : l);
  const karten: KaufbarKarte[] = Object.keys(LAEDEN).map((id) => ({
    name: schiff(id), rolle: vRoleCig(id, fz(id), lang) ?? '', bild: rsiBild(id, lang), laeden: LAEDEN[id].map(laden), preis: preisAb(id),
  }));
  const preisStempel: Satz = [T('Preise: ', 'Prices: '), { t: 'UEX Corp', h: UEX }, T(`, Stand ${preiseVom}. In Pyro listet UEX Corp Buy and Fly in Ruin Station, Checkmate und Orbituary.`, `, as of ${preiseVom}. In Pyro, UEX Corp lists Buy and Fly at Ruin Station, Checkmate and Orbituary.`)];

  /* ---- Bestehende Schiffe: Zeilen der Liste „Geändert“, nach Thema ---- */
  const felderVon = (id: string) => {
    const e = E.find((x) => x.kind === 'ship' && x.id === id);
    return e && 'felder' in e ? e.felder : [];
  };
  const groesse = (s: string) => Number(/\(S(\d+)\)$/.exec(s)?.[1]);
  /* Radar groesser geworden (nicht nur neu benannt): Groesse aus „1× Surveyor-Max (S3)“. */
  const radarGroesser = (id: string) => felderVon(id).some((x) => x.feld === 'radars' && Array.isArray(x.vorher) && Array.isArray(x.nachher)
    && groesse(x.nachher[0]) > groesse(x.vorher[0]));
  const geaendertKarten = liste('geaendert').karten;
  /* Entfernte Fahrzeuge stehen nicht mehr im Katalog: sie behalten ihren Namen ohne Seite. */
  const nameVon = (k: Karte) => (k.schiff && fahrzeuge.has(k.schiff) ? schiff(k.schiff) : verweis(k.name, k.link));
  const ergId = (k: Karte) => (k.key.startsWith('erg:') ? k.key.slice(4) : null);
  /* „Status“ (entferntes Fahrzeug) und „Patch Notes“ (Ergaenzung ohne Schiff) sagen schon die Art der Zeile; es bleibt nur der Wert.
     Die Einheit steht einmal: „Fracht (SCU)“ mit „64 SCU“ wird „Fracht 64 SCU“; eine nackte Zahl bekommt die Einheit aus der Bezeichnung.
     Ein neuer Wert 0 sagt nichts (0 SCU Fracht bei den ATLS) und faellt weg. */
  const werteAus = (k: Karte): Wert[] => k.zeilen
    .filter((z) => z.vorher != null || !/^0(\s|$)/.test(z.nachher))
    .map((z) => {
      if (z.label === 'Status' || z.label === 'Patch Notes') return { k: '', v: z.nachher };
      const v = z.vorher ? `${z.vorher} → ${z.nachher}` : z.nachher;
      const m = /^(.*?)\s*\(([^)]*)\)$/.exec(z.label);
      if (!m) return { k: z.label, v };
      return { k: m[1], v: /^[\d.,\s→]+$/.test(v) ? `${v} ${m[2]}` : v };
    });
  const zeileAus = (k: Karte) => ({ name: nameVon(k), werte: werteAus(k) });
  type Thema = 'radar' | 'bergung' | 'waffen' | 'weitere';
  const thema = (k: Karte): Thema | null => {
    const id = ergId(k);
    if (id === 'vanduul-ki' || id === 'torpedos-scharf' || k.link === `/items/${STRIKER}.html`) return null;
    if (id?.startsWith('einbau-')) return 'radar';
    if (id?.startsWith('puffer-')) return 'bergung';
    if (k.key.startsWith('ship:') && k.schiff && radarGroesser(k.schiff)) return 'radar';
    if (k.key.startsWith('ship:') && k.schiff && felderVon(k.schiff).some((x) => x.feld === 'turretWeapons' || x.feld === 'turretDps')) return 'waffen';
    return 'weitere';
  };
  /* Zeilen je Schiff zusammenlegen (Perseus: Radar aus dem Vergleich, Einbauort aus den Patch Notes). */
  const gruppe = (t: Thema) => {
    const zeilen = new Map<string, { name: Verweis; werte: Wert[] }>();
    for (const k of geaendertKarten.filter((x) => thema(x) === t)) {
      const z = zeileAus(k);
      const key = k.schiff ?? k.key;
      zeilen.set(key, { name: z.name, werte: [...(zeilen.get(key)?.werte ?? []), ...z.werte] });
    }
    return [...zeilen.values()];
  };
  const umbenannt = liste('entfernt').karten.filter((k) => k.key.startsWith('ship:')).map(zeileAus);
  const torpedo = ERGAENZT.eintraege.find((e) => e.id === 'torpedos-scharf');
  if (!torpedo) throw new Error('chronik 4.10.3: Ergaenzung torpedos-scharf fehlt');
  /** Ein Satz, den nur eine Quelle traegt: der Link steht klein am Ende („… nach (Patch Notes).“). */
  const mitQuelle = (satz: string, quelle: Beleg): Satz => [`${satz} (`, quelle, ').'];

  /* ---- Alle Aenderungen: die Listen des Vergleichs, mit den Korrekturen dieser Seite ---- */
  const zeile = (k: Karte): ListenZeile => ({
    art: k.herkunft === 'ergaenzt' && k.art !== 'Patch Notes' ? `${k.art} · Patch Notes` : k.art,
    name: nameVon(k),
    /* „Fahrzeug entfernt“ sagt schon die Art; die Zeile „Status“ wiederholte es nur. */
    werte: werteAus({ ...k, zeilen: k.zeilen.filter((z) => z.label !== 'Status') }),
  });
  const auftragsKarten = liste('auftraege').karten.filter((k) => k.herkunft !== 'ergaenzt');
  const ruf = ERGAENZT.eintraege.find((e) => e.id === 'high-risk-ruf');
  if (!ruf || auftragsKarten.length !== auftraege.length) throw new Error('chronik 4.10.3: Auftragsliste und InterSec-Zaehlung passen nicht');
  const venture = liste('entfernt').karten.filter((k) => /^Venture /.test(k.name)).length;
  const lack = liste('neu').extra;
  if (!lack) throw new Error('chronik 4.10.3: Liste neu ohne Lackierungen');
  const listen: Liste[] = [
    {
      ...listeAus(liste('neu')),
      nachsatz: [T(`Dazu ${n(lack.anzahl)} neue Lackierungen für ${n(lack.jeSchiff.length)} Schiffe, `, `Plus ${n(lack.anzahl)} new liveries for ${n(lack.jeSchiff.length)} ships, `),
        { t: T('alle Lackierungen', 'all liveries'), h: L(lack.uebersicht) }, '.'],
    },
    { ...listeAus(liste('geaendert')), nachsatz: null },
    {
      id: 'liste-kaufbar', titel: T('Neu kaufbar', 'Newly buyable'), nachsatz: preisStempel,
      zeilen: karten.map((k) => ({ art: k.rolle, name: k.name, werte: [{ k: T('Laden', 'Shop'), v: k.laeden.join(' · ') }, { k: T('Preis', 'Price'), v: k.preis }] })),
    },
    {
      id: 'liste-auftraege', titel: liste('auftraege').titel, zeilen: auftragsKarten.map(zeile),
      nachsatz: mitQuelle(de
        ? `High-Risk-Target-Kopfgelder bringen jetzt ${ruf.nachher} statt ${ruf.vorher} Ruf bei der Bounty Hunters Guild`
        : `High Risk Target bounties now award ${ruf.en.nachher} instead of ${ruf.en.vorher} Bounty Hunters Guild reputation`, notes),
    },
    { ...listeAus(liste('bauplaene')), nachsatz: null },
    {
      ...listeAus(liste('entfernt')),
      nachsatz: venture ? [T(`Die Venture-Rüstungen „Infrared“ und „Starwalker“ haben die Namen getauscht. Was in ${v.von.version} „Infrared“ hieß, heißt jetzt „Starwalker“, und umgekehrt.`,
        `The Venture armour sets "Infrared" and "Starwalker" swapped names. What was "Infrared" in ${v.von.version} is now "Starwalker", and the other way round.`)] : null,
    },
  ];
  function listeAus(r: Reiter): Omit<Liste, 'nachsatz'> {
    return { id: `liste-${r.id}`, titel: r.titel, zeilen: r.karten.map(zeile) };
  }

  return {
    lang,
    version: PATCH.version,
    abschnitte: [
      {
        art: 'auftakt', id: 'auftakt',
        titel: 'Vanduul Incursion',
        unterzeile: `Alpha ${PATCH.version} · ${de ? PATCH.dateDisplay : (PATCHES_EN as { patches: Record<string, { dateDisplayEn: string }> }).patches['4-10-3'].dateDisplayEn}`,
        satz: [T('Die Vanduul greifen in Nyx an, und ', 'The Vanduul attack in Nyx, and '), { t: T('InterSec sucht Piloten', 'InterSec is looking for pilots'), h: INCURSION }, '.'],
        bild: rsiBild('vanduul-angriff', lang),
        notes: { t: T('Offizielle Patch Notes', 'Official patch notes'), h: PATCH.notesUrl },
      },
      {
        art: 'wort', id: 'vanduul', wort: 'MAULER',
        waffe: verweis("Vanduul Mauler 'STRIKER' Repeater", `/items/${STRIKER}.html`),
        zahl: pfeil(schuss),
        was: T('Schaden pro Schuss', 'damage per shot'),
        traeger: T('Ihn tragen der Mauler und eine namenlose KI-Korvette der Vanduul.', 'The Mauler and an unnamed Vanduul AI corvette carry it.'),
        werte: [
          { k: T('Schaden pro Sekunde', 'Damage per second'), v: pfeil(dps) },
          ...(unveraendert.length ? [{ k: T('Unverändert', 'Unchanged'), v: unveraendert.join(', ') }] : []),
        ],
        stempel: [STAND],
        notiz: mitQuelle(T('Der Mauler hat dafür weniger Lebenspunkte, und Vanduul-KI-Schiffe tragen mehr Munition und laden sie schneller nach',
          'The Mauler has less health in return, and Vanduul AI ships carry more ammunition and reload it faster'), notesZu),
      },
      {
        art: 'liste', id: 'intersec',
        titel: T(`${INTERSEC}: ${n(auftraege.length)} neue Aufträge in Nyx`, `${INTERSEC}: ${n(auftraege.length)} new contracts in Nyx`),
        text: [
          mitQuelle(T('InterSec bietet langfristige, wiederholbare Aufträge gegen die Vanduul und die Shattered Blade an', 'InterSec offers long-term, repeatable contracts against both the Vanduul and the Shattered Blade'),
            { t: T('Comm-Link „Vanduul Incursion“', 'Comm-Link "Vanduul Incursion"'), h: INCURSION }),
          [{ t: T(`${n(ausAuftraegen.length)} der ${n(neueBauplaene.length)} neuen Baupläne`, `${n(ausAuftraegen.length)} of the ${n(neueBauplaene.length)} new blueprints`), h: '#liste-bauplaene' },
            T(' gibt es als Belohnung aus diesen Aufträgen.', ' are rewards from these contracts.')],
        ],
        listeTitel: T('Neu ab dem Rang', 'New from rank'),
        gruppen: raenge,
        stempel: [STAND],
      },
      { art: 'schiffe', id: 'neue-schiffe', titel: T('Neue Schiffe: RSI Galaxy und Anvil Liberator', 'New ships: RSI Galaxy and Anvil Liberator'), schiffe: [galaxy, liberator] },
      {
        art: 'bild-text', id: 'iae-2956', titel: 'IAE 2956',
        satz: mitQuelle(T('Die Intergalactic Aerospace Expo 2956 läuft in New Babbage, und bis zum 27. November 2026 ist Star Citizen kostenlos spielbar',
          'The Intergalactic Aerospace Expo 2956 runs in New Babbage, and Star Citizen is free to play until 27 November 2026'), { t: 'RSI', h: IAE }),
        bild: rsiBild('iae-2956-stadt', lang),
        gruppen: [
          { titel: T('Kleidung', 'Clothing'), eintraege: kleidung.map(itemVerweis) },
          { titel: T('Lackierungen „2956 Best In Show“', '"2956 Best In Show" liveries'), eintraege: lackierungen.map(itemVerweis) },
        ],
        stempel: [T(`Stand ${v.nach.version}`, `As of ${v.nach.version}`)],
      },
      {
        art: 'karten', id: 'kaufbar',
        titel: T(`${ZAHLWORT.de[karten.length] ?? n(karten.length)} Schiffe zum ersten Mal für aUEC`, `${ZAHLWORT.en[karten.length] ?? n(karten.length)} ships for aUEC for the first time`),
        satz: mitQuelle(T('Diese bereits flugfähigen Schiffe lassen sich zum ersten Mal im Spiel für aUEC kaufen', 'These already flyable ships can be bought in game for aUEC for the first time'), notes),
        karten,
        stempel: preisStempel,
      },
      {
        art: 'bestand', id: 'bestehende-schiffe', titel: T('Änderungen an bestehenden Schiffen', 'Changes to existing ships'),
        gruppen: [
          { titel: T('Radar der Größe 3', 'Size 3 radars'), zeilen: gruppe('radar') },
          { titel: T('Bergung', 'Salvage'), zeilen: gruppe('bergung') },
          { titel: T('Bewaffnung', 'Weapons'), zeilen: gruppe('waffen') },
          { titel: T('Weitere Änderungen', 'Other changes'), zeilen: [...gruppe('weitere'), ...umbenannt] },
        ],
        ausQuelle: {
          titel: [T('Aus den ', 'From the '), notesZu],
          punkte: [
            [T('Auch die ', 'The '), schiff('aegs-hammerhead'), T(' und die ', ' and the '), schiff('aegs-tiburon'), T(' tragen jetzt Radare der Größe 3.', ' now carry size 3 radars too.')],
            [T('Bei allen fünf Bergungsschiffen ist das Zerlegungsfeld größer, und die Ausrichtung verzeiht mehr, sodass sich ein Schnitt am Rumpf leichter halten lässt.',
              'On all five salvage ships the disintegration field is larger and the alignment falloff more forgiving, so holding a cut on a hull is easier.')],
            [de ? `Torpedos der Größen 5 und 7 sind jetzt ${torpedo.nachher}.` : `Size 5 and 7 torpedoes are now ${torpedo.en.nachher}.`],
            [T('Pilot und Kopilot der ', 'The pilot and copilot of the '), schiff('espr-prowler-utility'),
              T(' öffnen die Frachttore jetzt, ohne die Heckrampe zu senken.', ' can now open the cargo bay doors without lowering the rear ramp.')],
            [T('Die HUD-Hologramme der Schiffe sind in der Farbe ihres Herstellers getönt.', 'Ship HUD holograms are tinted to match the vehicle manufacturer.')],
          ],
        },
        stempel: [STAND, T('. Bergungspuffer und Einbauorte aus den Patch Notes.', '. Salvage buffers and component locations from the patch notes.')],
      },
      {
        art: 'reiter', id: 'alle-aenderungen', titel: T(`Alle Änderungen von ${v.von.version} auf ${v.nach.version}`, `All changes from ${v.von.version} to ${v.nach.version}`),
        listen: listen.map((l) => ({ ...l, titel: `${l.titel} (${n(l.zeilen.length)})` })),
        stempel: [STAND, T(`. ${n(ERGAENZT.eintraege.length)} Werte nach den `, `. ${n(ERGAENZT.eintraege.length)} values from the `), notesZu, T(', so markiert.', ', marked as such.')],
        weiter: [{ t: `← Alpha ${v.von.version}`, h: L(`/patches/sc-${v.von.version.replace(/\./g, '-')}.html`) }, { t: T('Patch-Archiv', 'Patch archive'), h: L('/archiv.html') }],
      },
    ],
  };
}

/** Offizielles Bild aus assets/patch-4-10-3/rsi mit dem Alt-Text aus dessen Herkunftsliste. */
function rsiBild(key: string, lang: Locale) {
  const b = (BILDER.bilder as { key: string; alt: Record<Locale, string> }[]).find((x) => x.key === key);
  if (!b) throw new Error(`chronik 4.10.3: RSI-Bild ${key} fehlt in bilder-rsi.json`);
  return bild(`${RSI}/${key}`, b.alt[lang]);
}
