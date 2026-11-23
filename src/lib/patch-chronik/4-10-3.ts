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
import RENDERS from '../../data/patch-4-10-3/bilder-render.json';
import PREISE from '../../data/vehicle-prices.json';
import { vRoleCig } from '../../i18n/vehicleText';
import ERGAENZT from '../../data/patch-vergleich/ergaenzt/4.10.3.json';
import PATCH from '../../data/patches/4-10-3.json';
import PATCHES_EN from '../../data/patches-en.json';
import { db as ITEMS, itemById } from '../items';
import { holoDaten } from '../holoDaten';
import HANGAR from '../../data/hangar-assets.json';
import HARDPOINTS from '../../data/ship-hardpoints.json';
import { toGltf, type Cry } from '../hangar/ports';
import { bild, bildAus, zahlAusVergleich, zahlText, type AmSchiff, type Beleg, type BestandZeile, type Chronik, type Kachel, type KaufbarKarte, type Liste, type ListenZeile, type NeuesSchiff, type Satz, type Verweis, type Wert } from './chronik';

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
  const zahlPaar = (z: { vorher: number | null; wert: number }) => ({ vorher: z.vorher == null ? null : n(z.vorher), wert: n(z.wert) });

  /* ---- InterSec: neue Auftraege nach dem Rang, ab dem sie angeboten werden ---- */
  const INTERSEC = 'InterSec Defense Solutions';
  const auftraege = E.filter((e) => e.kind === 'mission' && e.change === 'new'
    && 'werte' in e && (e.werte.find((w) => w.feld === 'giverNames')?.wert as string[] | undefined)?.includes(INTERSEC));
  const einstieg = new Map(auftraege.map((e) => [e.id, rangSpanne(e.slug!).von]));
  const stufen = RANG_LEITER.map((rang) => ({
    rang,
    eintraege: auftraege.filter((e) => einstieg.get(e.id) === rang).map((e) => verweis(auftragName(e.slug!), seite(e))),
  }));
  const slugs = new Set(auftraege.map((e) => e.slug));
  const neueBauplaene = E.filter((e) => e.kind === 'blueprint' && e.change === 'new');
  const auftraegeVon = (e: Eintrag) => ('werte' in e ? (e.werte.find((w) => w.feld === 'missions')?.wert as string[] | undefined) ?? [] : []);
  const ausAuftraegen = neueBauplaene.filter((e) => auftraegeVon(e).some((s) => slugs.has(s)));

  const torpedo = ERGAENZT.eintraege.find((e) => e.id === 'torpedos-scharf');
  if (!torpedo) throw new Error('chronik 4.10.3: Ergaenzung torpedos-scharf fehlt');

  /* ---- Ausruestung: Skarnov, die Raider-Camo-Bauplaene, Deterrent, Lephari, Torpedos ---- */
  const item = (slug: string) => {
    const e = E.find((x) => x.kind === 'item' && x.slug === slug);
    if (!e) throw new Error(`chronik 4.10.3: Gegenstand ${slug} fehlt im Vergleich`);
    return e;
  };
  /* Die Spieldaten der Gegenstaende fuehren den Slug als id. */
  const spiel = (slug: string) => {
    const i = itemById.get(slug);
    if (!i?.game) throw new Error(`chronik 4.10.3: Gegenstand ${slug} fehlt in den Spieldaten`);
    return i.game;
  };
  const kennzahl = (slug: string, feld: 'dps' | 'magazine' | 'shieldHp') => {
    const z = spiel(slug).stats?.[feld];
    if (typeof z !== 'number') throw new Error(`chronik 4.10.3: ${slug}.${feld} fehlt in den Spieldaten`);
    return z;
  };
  const hiessVorher = (e: Eintrag) => {
    if (e.change !== 'renamed' || !('nameVorher' in e)) throw new Error(`chronik 4.10.3: ${e.name} ist nicht umbenannt`);
    return e.nameVorher;
  };
  const skarnov = E.filter((e) => e.kind === 'item' && e.change === 'new' && /^skarnov(-[a-z-]+)?-rifle$/.test(e.slug ?? ''));
  const skarnovId = 'skarnov-rifle';
  if (skarnov.length !== 5 || skarnov.some((e) => kennzahl(e.slug ?? '', 'dps') !== kennzahl(skarnovId, 'dps') || kennzahl(e.slug ?? '', 'magazine') !== kennzahl(skarnovId, 'magazine'))) {
    throw new Error(`chronik 4.10.3: ${skarnov.length} Skarnov-Ausfuehrungen oder ungleiche Werte`);
  }
  const skarnovSpiel = spiel(skarnovId);
  const bpVerweis = (e: Eintrag) => verweis(e.name, seite(e));
  const ohneAuftrag = neueBauplaene.filter((e) => !ausAuftraegen.includes(e));
  if (ohneAuftrag.length !== 1 || ohneAuftrag[0].name !== 'Deterrent') throw new Error(`chronik 4.10.3: Bauplaene ohne Auftrag: ${ohneAuftrag.map((e) => e.name).join(', ')}`);
  const zielAuftrag = (bp: Eintrag): Beleg => zielVon(auftraegeVon(bp)[0]);
  function zielVon(s: string): Beleg {
    const m = auftraege.find((e) => e.slug === s);
    const h = m && seite(m);
    if (!m || !h) throw new Error(`chronik 4.10.3: Auftrag ${s} fehlt unter den InterSec-Auftraegen oder hat keine Seite`);
    return { t: auftragName(m.slug!), h: L(h) };
  }
  const skarnovBp = ausAuftraegen.filter((e) => /^Skarnov /.test(e.name));
  const camoBp = ausAuftraegen.filter((e) => /Raider Camo/.test(e.name));
  const batterie = ausAuftraegen.filter((e) => !camoBp.includes(e));
  if (batterie.length !== 1 || !/^Skarnov Rifle Battery/.test(batterie[0].name)) throw new Error(`chronik 4.10.3: neben Raider Camo: ${batterie.map((e) => e.name).join(', ')}`);
  /* Je Auftrag die Baupläne, die er vergibt; im Namen fällt „Raider Camo“ weg, die Kachel heißt schon so. */
  const kurz = (e: Eintrag) => verweis(e.name.replace(/ Raider Camo$/, ''), seite(e));
  const camoJeAuftrag = auftraege.map((m) => ({ titel: zielVon(m.slug!) as Verweis, eintraege: ausAuftraegen.filter((e) => auftraegeVon(e).includes(m.slug!)).map(kurz) }))
    .filter((z) => z.eintraege.length);
  if (camoJeAuftrag.reduce((s, z) => s + z.eintraege.length, 0) !== ausAuftraegen.length) throw new Error('chronik 4.10.3: Bauplaene mehreren Auftraegen zugeordnet');
  const deterrent = item('deterrent');
  const deterrentSpiel = spiel('deterrent');
  const lephari = item('lephari');
  const lephariSpiel = spiel('lephari');
  const lephariBp = E.find((e) => e.kind === 'blueprint' && e.id === lephari.id);
  const lephariLaden = itemById.get('lephari')?.obtain.find((o) => o.kind === 'shop');
  if (!lephariBp || !lephariLaden?.price) throw new Error('chronik 4.10.3: Lephari ohne umbenannten Bauplan oder Laden');
  const lephariPreis = lephariLaden.price;
  const radarNachher = (id: string) => {
    const e = E.find((x) => x.kind === 'ship' && x.id === id);
    return e && 'felder' in e ? e.felder.find((f) => f.feld === 'radars')?.nachher : undefined;
  };
  const galaxyRadar = E.find((x) => x.kind === 'ship' && x.id === 'rsi-galaxy');
  if (!(galaxyRadar && 'werte' in galaxyRadar && JSON.stringify(galaxyRadar.werte.find((w) => w.feld === 'radars')?.wert).includes('Lephari'))
    || !['rsi-zeus-es', 'rsi-constellation-mk5-centaurus'].every((id) => JSON.stringify(radarNachher(id)).includes('Lephari'))) {
    throw new Error('chronik 4.10.3: Lephari steckt nicht mehr in Galaxy, Zeus ES und Centaurus');
  }
  const itemPreiseVom = de ? ITEMS.pricesAsOf.split('-').reverse().join('.') : ITEMS.pricesAsOf;
  const kacheln = (): Kachel[] => [
    {
      titel: verweis(deterrent.name, seite(deterrent)), bild: rsiBild('rsi-polaris', lang), unterschrift: [schiff('rsi-polaris')], breit: false,
      zeile: T(`Schildgenerator der Größe ${deterrentSpiel.size}, bisher „${hiessVorher(deterrent)}“`,
        `Size ${deterrentSpiel.size} shield generator, formerly "${hiessVorher(deterrent)}"`),
      werte: [{ k: T('Schild', 'Shield'), v: `${n(kennzahl('deterrent', 'shieldHp'))} HP` }],
      liste: [{ titel: { t: T('Neuer Bauplan', 'New blueprint'), h: null }, eintraege: [bpVerweis(ohneAuftrag[0])] }],
      satz: [T('Gebaut für die ', 'Built for the '), schiff('rsi-polaris'), '.'],
    },
    {
      titel: verweis(lephari.name, seite(lephari)), bild: renderBild('rsi-galaxy', lang), unterschrift: [schiff('rsi-galaxy'), T(', Modell', ', model')], breit: false,
      zeile: T(`Radar der Größe ${lephariSpiel.size} von ${lephariSpiel.manufacturer}`, `Size ${lephariSpiel.size} radar by ${lephariSpiel.manufacturer}`),
      werte: [{ k: T('Preis', 'Price'), v: T(`ab ${n(lephariPreis)} aUEC`, `from ${n(lephariPreis)} aUEC`) }, { k: T('Laden', 'Shop'), v: lephariLaden.loc.replace(' - ', ', ') }],
      liste: [{ titel: { t: T('Bauplan', 'Blueprint'), h: null }, eintraege: [bpVerweis(lephariBp)] }],
      satz: [T('Neu verbaut in der ', 'Newly fitted to the '), schiff('rsi-galaxy'), T('. In der ', '. On the '), schiff('rsi-zeus-es'), T(' und der ', ' and the '), schiff('rsi-constellation-mk5-centaurus'),
        T(` steckte es schon und hatte keinen Namen. Der Bauplan hieß bisher „${hiessVorher(lephariBp)}“.`, ` it was already fitted, without a name. The blueprint was called "${hiessVorher(lephariBp)}".`)],
    },
    {
      titel: verweis(item('skarnov-rifle').name, seite(item('skarnov-rifle'))), bild: null, unterschrift: null, breit: false,
      zeile: T(`Neues Energiegewehr der Größe ${skarnovSpiel.size}, in ${ZAHLWORT.de[skarnov.length].toLowerCase()} Ausführungen mit denselben Werten`,
        `New size ${skarnovSpiel.size} energy rifle, in ${ZAHLWORT.en[skarnov.length].toLowerCase()} versions with the same stats`),
      werte: [
        { k: T('Schaden pro Sekunde', 'Damage per second'), v: n(kennzahl(skarnovId, 'dps')) },
        { k: T('Batterie', 'Battery'), v: T(`${n(kennzahl(skarnovId, 'magazine'))} Schuss`, `${n(kennzahl(skarnovId, 'magazine'))} shots`) },
      ],
      liste: [{ titel: { t: T('Ausführungen', 'Versions'), h: null }, eintraege: [...skarnov].sort((a, b) => Number(b.slug === skarnovId) - Number(a.slug === skarnovId)).map((e) => verweis(e.name, seite(e))) }],
      satz: [T('Den Bauplan für „Raider Camo“ und die Batterie gibt der Auftrag ', 'The blueprints for "Raider Camo" and its battery come from the contract '), zielAuftrag(skarnovBp[0]), '.'],
    },
    {
      titel: { t: 'Raider Camo', h: null }, bild: null, unterschrift: null, breit: false,
      zeile: T(`${n(camoBp.length)} Baupläne in Raider Camo, dazu die Batterie der Skarnov. Je Auftrag, was er vergibt:`,
        `${n(camoBp.length)} Raider Camo blueprints, plus the Skarnov battery. What each contract awards:`),
      werte: [], liste: camoJeAuftrag, satz: null,
    }
  ];

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
  /* Fracht ab Werk und Mindestbesatzung aus dem Vergleich; dass sie die Patch Notes ebenso nennen (64 SCU), prueft der Bau. */
  const galaxyFracht = neuWert('rsi-galaxy', 'cargoSCU');
  const galaxyCrew = neuWert('rsi-galaxy', 'crewMin');
  if (galaxyFracht.v !== '64 SCU') throw new Error(`chronik 4.10.3: Galaxy-Fracht ${galaxyFracht.v}, die Patch Notes nennen 64 SCU`);
  const mitModul = de ? frachtmodul.nachher : frachtmodul.en.nachher;
  const galaxySeite = fz('rsi-galaxy').pledgeUrl;
  if (!galaxySeite) throw new Error('chronik 4.10.3: Galaxy ohne RSI-Schiffsseite');
  const frachtModul = modul('galaxy-cargo-module');
  const medModul = modul('galaxy-med-bay-module');
  const stockModul = modul('galaxy-stock-module');
  const alsBeleg = (w: Wert): Beleg | string => (w.h ? { t: w.k, h: w.h } : w.k);
  const lephariSeite = seite(lephari);
  if (!lephariSeite) throw new Error('chronik 4.10.3: Lephari ohne Seite');
  const galaxy: NeuesSchiff = {
    id: 'rsi-galaxy', name: schiff('rsi-galaxy'), hersteller: fz('rsi-galaxy').manufacturer ?? '', bild: rsiBild('rsi-galaxy', lang),
    text: [
      [T('Die Galaxy ist ein großes Schiff für mehrere Personen, gebaut um ein austauschbares Mittelmodul, mit dem sie die Rolle wechselt. Ab Werk fasst sie ', 'The Galaxy is a large multi-crew ship built around a swappable central module that changes its role. As delivered it holds '),
        T(`${galaxyFracht.v} Fracht. Das `, `${galaxyFracht.v} of cargo. The `), alsBeleg(frachtModul),
        T(` bringt sie auf ${mitModul} und fügt einen Lastenaufzug und Konsolen für Traktorstrahlen zum Be- und Entladen hinzu. Das `, ` takes it to ${mitModul} and adds an industrial lift and tractor beam consoles for loading and unloading. The `),
        alsBeleg(medModul), T(' macht aus der Mitte ein Feldlazarett mit Medbetten der Stufen 1, 2 und 3 (', ' turns the bay into a field hospital with tier 1, 2 and 3 medbeds ('), notesZu, ').'],
      [T(`Ihre Mindestbesatzung beträgt ${galaxyCrew.v} Personen. Als Radar trägt sie das neue `, `It needs a crew of at least ${galaxyCrew.v}, and its radar is the new size ${lephariSpiel.size} `),
        { t: lephari.name, h: L(lephariSeite) }, T(` der Größe ${lephariSpiel.size}, und im Heck hat sie laut `, '. According to the '),
        { t: T('RSI-Schiffsseite', 'RSI ship page'), h: galaxySeite },
        T(' einen Hangar für kleine Schiffe und Bodenfahrzeuge.', ', its rear hangar holds small ships and ground vehicles.')],
    ],
    reiter: [
      { id: 'galaxy-werte', titel: T('Kennwerte', 'Specs'), werte: [neuWert('rsi-galaxy', 'hullHp'), neuWert('rsi-galaxy', 'shieldHp'), galaxyFracht,
        { k: T('Fracht mit Frachtmodul (Patch Notes)', 'Cargo with cargo module (patch notes)'), v: mitModul, h: L(frachtmodul.link) },
        galaxyCrew, neuWert('rsi-galaxy', 'scmSpeed')] },
      { id: 'galaxy-ausstattung', titel: T('Ausstattung', 'Loadout'), werte: [neuWert('rsi-galaxy', 'missileRacks'), neuWert('rsi-galaxy', 'radars'),
        { k: T(`Mittelmodul ab Werk: ${stockModul.k}`, `Central module as delivered: ${stockModul.k}`), v: stockModul.v, h: stockModul.h }] },
    ],
    module: {
      titel: T('Module für die Mitte', 'Modules for the central bay'),
      kacheln: ([[frachtModul, 'rsi-galaxy-modul-fracht'], [medModul, 'rsi-galaxy-modul-medizin']] as const).map(([w, bildKey]): Kachel => (
        { titel: { t: w.k, h: w.h ?? null }, bild: rsiBild(bildKey, lang), unterschrift: null, zeile: w.v, werte: [], liste: [], satz: null, breit: false })),
    },
    zweitbild: rsiBild('rsi-galaxy-flug', lang),
    stempel: [`${T(`Stand ${v.nach.version}`, `As of ${v.nach.version}`)} · ${T('Beschreibung nach den ', 'Description from the ')}`, notesZu, T(' und der ', ' and the '), { t: T('RSI-Schiffsseite', 'RSI ship page'), h: galaxySeite }],
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
    module: null, zweitbild: null,
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
  type SchiffZeile = { name: Verweis; werte: Wert[] };
  const zeileAus = (k: Karte): SchiffZeile => ({ name: nameVon(k), werte: werteAus(k) });
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
  /* Zahl vorher und nachher aus „240 SCU → 448 SCU“ oder der Groesse aus „Surveyor · Gr. 2 → Surveyor-Max · Gr. 3“,
     in beiden Sprachen gleich gelesen: DE „46,8“ und „Gr. 2“, EN „46.8“ und „size 2“. */
  const tausender = de ? /\./g : /,/g;
  const zahlVon = (s: string) => {
    const gr = /(?:Gr\.|size) (\d+)$/.exec(s) ?? /^([\d.,]+)(\s\S+)?$/.exec(s);
    return gr ? Number(gr[1].replace(tausender, '').replace(',', '.')) : null;
  };
  const paar = (v: string) => {
    const [a, b] = v.split(' → ');
    const vorher = a != null && b != null ? zahlVon(a) : null;
    const nachher = b != null ? zahlVon(b) : null;
    return vorher != null && nachher != null && vorher !== nachher ? { vorher, nachher } : null;
  };
  /* Ein Balken je Wert mit Zahl vorher und nachher; max ist der groesste Wert der Gruppe.
     Ein Bauteil mit Groesse („… · Gr. 2 → … · Gr. 3“) bekommt keinen: dort sagt der Text schon alles. */
  const mitBalken = (zeilen: BestandZeile[]) => {
    const zahl = (w: Wert) => (w.v.includes('·') ? null : paar(w.v));
    const max = new Map<string, number>();
    for (const z of zeilen) for (const w of z.werte) { const p = zahl(w); if (p) max.set(w.k, Math.max(max.get(w.k) ?? 0, p.vorher, p.nachher)); }
    return zeilen.map((z) => ({ ...z, werte: z.werte.map((w) => { const p = zahl(w); return p ? { ...w, balken: { ...p, max: max.get(w.k)! } } : w; }) }));
  };
  /* Zeilen je Schiff zusammenlegen (Perseus: Radar aus dem Vergleich, Einbauort aus den Patch Notes). */
  const gruppe = (t: Thema): SchiffZeile[] => {
    const zeilen = new Map<string, SchiffZeile>();
    for (const k of geaendertKarten.filter((x) => thema(x) === t)) {
      const z = zeileAus(k);
      const key = k.schiff ?? k.key;
      zeilen.set(key, { ...z, werte: [...(zeilen.get(key)?.werte ?? []), ...z.werte] });
    }
    return [...zeilen.values()];
  };
  /* Schiffe mit gleicher Aenderung teilen sich eine Zeile (Vanguard Hoplite und Warden, Centaurus und Zeus ES). */
  const einzeln = (z: SchiffZeile): BestandZeile => ({ namen: [z.name], werte: z.werte });
  const zusammen = (zeilen: BestandZeile[]): BestandZeile[] => {
    const nach = new Map<string, BestandZeile>();
    for (const z of zeilen) {
      const key = JSON.stringify(z.werte);
      const da = nach.get(key);
      if (da) da.namen.push(...z.namen);
      else nach.set(key, { namen: [...z.namen], werte: z.werte });
    }
    return [...nach.values()];
  };
  const radarZeilen = gruppe('radar');
  const waffenZeilen = gruppe('waffen');

  /* Radar: alle fuenf von Groesse 2 auf 3, ein Balken. Welches Radar vorher und nachher, steht daneben;
     die Einbauorte nach den Patch Notes stehen als Satz unter der Zeile. */
  const radarWert = (z: SchiffZeile) => {
    const w = z.werte.find((x) => x.v.includes('→'));
    const m = w && /^(.+?) · (?:Gr\.|size) (\d+) → (.+?) · (?:Gr\.|size) (\d+)$/.exec(w.v);
    if (!w || !m) throw new Error(`chronik 4.10.3: Radar von ${z.name.t} nicht lesbar`);
    return { k: w.k, modelle: `${m[1]} → ${m[3]}`, von: Number(m[2]), auf: Number(m[4]) };
  };
  const radare = radarZeilen.map((z) => ({ z, r: radarWert(z) }));
  const [{ r: radar0 }] = radare;
  if (radare.length !== 5 || radare.some(({ r }) => r.von !== radar0.von || r.auf !== radar0.auf)) throw new Error('chronik 4.10.3: Radare nicht alle gleich gewachsen');
  const jePaar = new Map<string, string[]>();
  for (const { z, r } of radare) jePaar.set(r.modelle, [...(jePaar.get(r.modelle) ?? []), z.name.t]);
  const modellPaare = [...jePaar].sort((a, b) => b[1].length - a[1].length);
  const gr = (x: number) => T(`Gr. ${x}`, `size ${x}`);
  const radarZeile: BestandZeile = {
    namen: radare.map(({ z }) => z.name),
    werte: [
      { k: radar0.k, v: `${gr(radar0.von)} → ${gr(radar0.auf)}`, balken: { vorher: radar0.von, nachher: radar0.auf, max: radar0.auf } },
      { k: '', v: modellPaare.map(([modelle, s], i) => (i === 0 ? modelle : `${T('bei der', 'on the')} ${s.join(', ')} ${modelle}`)).join(', ') },
    ],
  };
  const einbau = (id: string) => {
    const e = ERGAENZT.eintraege.find((x) => x.id === id);
    if (!e) throw new Error(`chronik 4.10.3: Ergaenzung ${id} fehlt`);
    return de ? e.nachher : e.en.nachher;
  };
  if (einbau('einbau-starlancer-max') !== einbau('einbau-starlancer-tac')) throw new Error('chronik 4.10.3: Starlancer MAX und TAC mit verschiedenem Einbauort');
  const radarNotiz: Satz = [
    T('Bei der ', 'On the '), schiff('misc-starlancer-max'), T(' und der ', ' and '), schiff('misc-starlancer-tac'),
    T(` sitzt das Radar jetzt ${einbau('einbau-starlancer-max')}, bei der `, ` the radar now sits ${einbau('einbau-starlancer-max')}; on the `), schiff('rsi-perseus'),
    T(` das Radar-Relais ${einbau('einbau-perseus')}. Auch die `, ` the radar relay is ${einbau('einbau-perseus')}. The `), schiff('aegs-hammerhead'), T(' und die ', ' and the '), schiff('aegs-tiburon'),
    T(` tragen jetzt Radare der Größe ${radar0.auf} (`, ` now carry size ${radar0.auf} radars too (`), notes, ').',
  ];

  /* Bergungspuffer: ein kleines Diagramm, ein Balken je Schiff. */
  const bergung = mitBalken(gruppe('bergung').map((z) => einzeln({ ...z, werte: z.werte.map((w) => ({ ...w, k: '' })) })));
  if (bergung.length !== 5 || bergung.some((z) => !z.werte[0]?.balken)) throw new Error('chronik 4.10.3: Bergungspuffer nicht fuer fuenf Schiffe');

  /* Weitere: die fuenf neuen HM6-Namen in einer Zeile, die entfernten Fahrzeuge in einer. */
  const ausListe = liste('entfernt').karten.filter((k) => k.key.startsWith('ship:')).map(zeileAus);
  const entfernt = ausListe.filter((z) => z.werte.length === 1 && z.werte[0].k === '');
  const umbenannt = ausListe.filter((z) => !entfernt.includes(z));
  if (umbenannt.length !== 5 || umbenannt.some((z) => z.werte.length !== 1 || !/^(.+) → HM6 \1$/.test(z.werte[0].v))) throw new Error('chronik 4.10.3: Umbenennungen nicht nur um „HM6“ ergaenzt');
  if (!entfernt.length || entfernt.some((z) => z.werte[0].v !== entfernt[0].werte[0].v)) throw new Error('chronik 4.10.3: entfernte Fahrzeuge nicht gleich vermerkt');
  const notizZeile = (s: Verweis, v: string): BestandZeile => ({ namen: [s], werte: [{ k: T('laut Patch Notes', 'per the patch notes'), v, h: PATCH.notesUrl }] });
  /* Das geaenderte Teil am Modell: nur Schiffe, deren Modell sauber aussieht und deren Teil einen Einbauort hat.
     Ohne Ort bleiben der Bergungspuffer (ein Lager, kein Bauteil) und die Vanguard Warden; Starlancer und Sentinel zeigen Fehler in ihren Modellen.
     Ein Turm hat eigene Netze im Modell (glTF-Extras „swap“ = Name des Einbauorts), die rot werden. Ein Radar sitzt als
     Kasten im Rumpf und hat dort kein Netz: gezeigt wird das neue Radar selbst, rot an seinem Einbauort, ueber dem Rumpf. */
  const TEIL = {
    radar: { alt: T('das neue Radar rot an seinem Platz im Rumpf', 'the new radar in red where it sits inside the hull'), innen: true },
    turret: { alt: T('die Waffen des Turms rot', "the turret's guns in red"), innen: false },
  };
  const KOMPONENTEN = (HANGAR as unknown as { components: Record<string, { url: string; v: string }> }).components;
  const amSchiff = ([['anvl-carrack', 'radar', radarZeilen], ['aegs-vanguard-hoplite', 'turret', waffenZeilen]] as const).map(([id, teil, zeilen]): AmSchiff => {
    const punkte = holoDaten(fz(id), id, lang)?.ports.filter((p) => p.k === teil).map((p) => p.p) ?? [];
    const modell = (HANGAR as unknown as { ships: Record<string, { url: string; v: string }> }).ships[id];
    const zeile = zeilen.find((z) => z.name.t === schiff(id).t);
    const wert = zeile?.werte.find((w) => w.v.includes('→'));
    if (!punkte.length || !modell || !wert) throw new Error(`chronik 4.10.3: ${id} ohne Einbauort, Modell oder Wert`);
    const hardpoints = ((HARDPOINTS as unknown as { ships: Record<string, { hp: { n: string; k: string; p: Cry }[] }> }).ships[id]?.hp ?? [])
      .filter((h) => h.k === teil && punkte.some((p) => Math.hypot(...toGltf(h.p).map((x, i) => x - p[i])) < 0.5)).map((h) => h.n);
    /* „Surveyor · Gr. 2 → Surveyor-Max · Gr. 3“: das Modell des neuen Bauteils heisst wie sein Name. */
    const neu = wert.v.split('→')[1]?.split('·')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? '';
    const bauteil = TEIL[teil].innen ? KOMPONENTEN[neu] : null;
    if (!hardpoints.length || bauteil === undefined) throw new Error(`chronik 4.10.3: ${id} ohne Namen des Einbauorts oder ohne Modell fuer ${neu}`);
    return { name: schiff(id).t, aenderung: `${wert.k} ${wert.v}`, modell: `${modell.url}?v=${modell.v}`, punkte, hardpoints,
      bauteil: bauteil && `${bauteil.url}?v=${bauteil.v}`,
      /* Ruhestellung aus demselben Viewer (scripts/render-am-schiff.mjs): bis zum Klick kein WebGL. */
      bild: bildAus([800, 1200].map((w) => ({ w, src: `/assets/patch-4-10-3/render/${id}-am-schiff${w === 800 ? '-800' : ''}.webp` })), `${schiff(id).t}, ${TEIL[teil].alt}`) };
  });
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
        art: 'wort', id: 'vanduul', bild: rsiBild('vanduul-angriff', lang), wort: 'MAULER',
        waffe: verweis("Vanduul Mauler 'STRIKER' Repeater", `/items/${STRIKER}.html`),
        zahl: zahlPaar(schuss),
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
        art: 'leiter', id: 'intersec',
        titel: T(`${INTERSEC}: ${n(auftraege.length)} neue Aufträge in Nyx`, `${INTERSEC}: ${n(auftraege.length)} new contracts in Nyx`),
        text: [
          mitQuelle(T('InterSec bietet langfristige, wiederholbare Aufträge gegen die Vanduul und die Shattered Blade an', 'InterSec offers long-term, repeatable contracts against both the Vanduul and the Shattered Blade'),
            { t: T('Comm-Link „Vanduul Incursion“', 'Comm-Link "Vanduul Incursion"'), h: INCURSION }),
          [{ t: T(`${n(ausAuftraegen.length)} der ${n(neueBauplaene.length)} neuen Baupläne`, `${n(ausAuftraegen.length)} of the ${n(neueBauplaene.length)} new blueprints`), h: '#ausruestung' },
            T(' gibt es als Belohnung aus diesen Aufträgen.', ' are rewards from these contracts.')],
        ],
        bild: rsiBild('vncl-stinger', lang),
        bildSatz: [T('Vanduul im Angriff. Gejagt werden unter anderem „Super Stingers“ (', 'Vanduul on the attack. Among the targets are "Super Stingers" ('), zielVon('seek-and-destroy-super-stingers'), T(') und Mauler (', ') and Maulers ('), zielVon('draw-out-maulers'), ').'],
        leiterTitel: T('Neue Aufträge je Rang', 'New contracts by rank'),
        stufen,
        stempel: [STAND],
      },
      {
        art: 'raster', id: 'ausruestung', titel: T('Ausrüstung', 'Equipment'),
        satz: null,
        kacheln: kacheln(),
        stempel: [STAND, T(`. Preis Lephari: `, `. Lephari price: `), { t: 'UEX Corp', h: UEX }, T(`, Stand ${itemPreiseVom}.`, `, as of ${itemPreiseVom}.`)],
      },
      { art: 'schiffe', id: 'neue-schiffe', titel: T('Neue Schiffe: RSI Galaxy und Anvil Liberator', 'New ships: RSI Galaxy and Anvil Liberator'), schiffe: [galaxy, liberator] },
      {
        art: 'halle', id: 'iae-2956', titel: 'IAE 2956',
        satz: mitQuelle(T('Die Intergalactic Aerospace Expo 2956 läuft in New Babbage, und bis zum 27. November 2026 ist Star Citizen kostenlos spielbar',
          'The Intergalactic Aerospace Expo 2956 runs in New Babbage, and Star Citizen is free to play until 27 November 2026'), { t: 'RSI', h: IAE }),
        tafeln: [
          { bild: rsiBild('iae-2956-halle', lang), listen: [] },
          { bild: rsiBild('iae-2956-stadt', lang), listen: [
            { titel: T('Lackierungen „2956 Best In Show“', '"2956 Best In Show" liveries'), eintraege: lackierungen.map(itemVerweis) },
            { titel: T('Kleidung', 'Clothing'), eintraege: kleidung.map(itemVerweis) },
          ] },
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
        amSchiff: { los: T('Modell drehen', 'Turn the model'), hinweis: T('Ziehen dreht das Modell.', 'Drag to turn the model.'), schiffe: amSchiff },
        gruppen: [
          { titel: T(`Radar der Größe ${radar0.auf}`, `Size ${radar0.auf} radars`), diagramm: false, zeilen: [radarZeile], notiz: radarNotiz },
          { titel: T('Bergungspuffer', 'Salvage buffer'), diagramm: true, zeilen: bergung,
            notiz: mitQuelle(T('Bei allen fünf ist das Zerlegungsfeld größer, und die Ausrichtung verzeiht mehr, sodass sich ein Schnitt am Rumpf leichter halten lässt',
              'On all five the disintegration field is larger and the alignment falloff more forgiving, so holding a cut on a hull is easier'), notes) },
          { titel: T('Bewaffnung', 'Weapons'), diagramm: false, notiz: null, zeilen: [...zusammen(mitBalken(waffenZeilen.map(einzeln))),
            notizZeile({ t: T('Torpedos der Größen 5 und 7', 'Size 5 and 7 torpedoes'), h: null }, de ? torpedo.nachher : torpedo.en.nachher)] },
          { titel: T('Weitere Änderungen', 'Other changes'), diagramm: false, zeilen: [
            ...zusammen(gruppe('weitere').flatMap((z) => z.werte.map((w) => einzeln({ name: z.name, werte: [w] })))),
            notizZeile(schiff('espr-prowler-utility'), T('Pilot und Kopilot öffnen die Frachttore, ohne die Heckrampe zu senken', 'Pilot and copilot can open the cargo bay doors without lowering the rear ramp')),
            { namen: umbenannt.map((z) => z.name), werte: [{ k: '', v: T('umbenannt, vorher ohne „HM6“ im Namen', 'renamed, previously without "HM6" in the name') }] },
            { namen: entfernt.map((z) => z.name), werte: entfernt[0].werte },
          ], notiz: mitQuelle(T('Die HUD-Hologramme der Schiffe sind in der Farbe ihres Herstellers getönt', 'Ship HUD holograms are tinted to match the vehicle manufacturer'), notes) },
        ],
        stempel: [STAND, T('. Bergungspuffer und Einbauorte nach den ', '. Salvage buffers and component locations from the '), notesZu, '.'],
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

/** Modell eines geaenderten Schiffs (scripts/render-patch-bilder.mjs), wenn es eines gibt. */
function renderBild(id: string, lang: Locale) {
  const r = RENDERS.bilder.find((x) => x.key === id);
  return r ? bildAus(r.groessen.map((g) => ({ w: g.w, src: g.src })), r.alt[lang]) : null;
}

/** Offizielles Bild aus assets/patch-4-10-3/rsi mit dem Alt-Text aus dessen Herkunftsliste. */
function rsiBild(key: string, lang: Locale) {
  const b = (BILDER.bilder as { key: string; alt: Record<Locale, string> }[]).find((x) => x.key === key);
  if (!b) throw new Error(`chronik 4.10.3: RSI-Bild ${key} fehlt in bilder-rsi.json`);
  return bild(`${RSI}/${key}`, b.alt[lang]);
}
