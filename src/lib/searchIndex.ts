// Build-time Suchindex über die Datenschicht — EINMAL PRO SPRACHE gebaut.
//
// Vorher gab es genau einen Index (deutscher Inhalt, präfixlose URLs). Seit
// Englisch die Standardsprache ist, war das doppelt falsch: die englische
// Seite suchte auf deutschen Texten ("Mehrzweck · Groß"), und die deutschen
// Seiten schickten Treffer auf die (jetzt englischen) Wurzel-URLs.
//
// Jetzt: /search-index.json (EN, Wurzel = Standardsprache) und
// /de/search-index.json (DE, URLs mit /de-Präfix). Beide Endpunkte sind dünne
// Wrapper um diesen Builder; das Overlay lädt den Index seiner Seite über das
// data-index-Attribut. Übersetzt wird nichts Neues — der Builder nutzt die
// vorhandenen Resolver (mergePatchEn/eraLabel für Patches, vType/vSize/vFoci
// für Fahrzeuge) und href() für die URLs.
//
// Eintrag (kurze Keys, ~35 KB): k = kind (stabiler Schlüssel, Anzeige-Label
// mappt das Overlay über data-k-*), b = badge, t = title, s = snippet,
// u = url, x = extra keywords, c = Weg ins Crafting-Werkzeug („Herstellen“,
// nur bei Items mit Rezept; seit 09.11.2026, Skizze 016).
//
// Ein Ding, ein Treffer (Skizze 016, freigegeben 09.11.2026): ein Item mit
// Rezept steht EINMAL im Register, mit „Herstellen“ daneben — vorher standen
// Item und Bauplan als zwei gleich klingende Treffer untereinander (1.547 von
// 1.608 Bauplaenen). Ebenso ein Fahrzeug: der Treffer fuehrt aufs
// Schiffsdatenblatt, nicht zusaetzlich auf das gleichnamige Item.
import { getCollection } from 'astro:content';
import { href, useTranslations, type Locale } from '../i18n/ui';
import { mergePatchEn, eraLabel } from '../i18n/patchText';
import { vType, vSize, vFoci } from '../i18n/vehicleText';
import { missions, repSummary, uec } from './missions';
import { patchesFor } from './patchSpine';
import { altName, displayName, itemPath, leafCategory, pageItemIds, pageItems, rootCategory } from './items';
import {
  blueprintListLabels, blueprintPath, blueprints, craftEntryPath, craftLeaf, craftRoot, itemForBlueprint, recipeForItem,
} from './crafting';
import { categoryLabel } from '../i18n/itemText';
import { priceInfo, aUEC } from './shipExtras';
import { shipIdForVehicleItem } from './vehicleItems';

export type SearchEntry = { k: string; b: string; t: string; s: string; u: string; x: string; c?: string };

// Werkzeuge: dieselben Ziele und Unterzeilen wie im Navigationsdeck
// (src/components/SiteNav.astro), ohne Konto/Service. Der Hangar fehlt mit
// Absicht: live gibt es ihn nicht (HAS_HANGAR), und neue Links dorthin
// entstehen in dieser Phase keine. x traegt Suchwoerter beider Sprachen; es
// wird nie angezeigt.
function toolEntries(lang: Locale): SearchEntry[] {
  const t = useTranslations(lang);
  const tool = (title: string, sub: string, path: string, x: string): SearchEntry => ({
    k: 'werkzeug', b: '', t: title, s: sub, u: href(path, lang), x,
  });
  return [
    tool('Item Finder', t('nav.deck.sub.items'), '/item-finder.html', 'items finder preise prices shops loot fundorte kaufen buy'),
    tool(t('nav.missions'), t('nav.deck.sub.missions'), '/missionen.html', 'missions missionen contracts auftraege reputation ruf belohnung reward'),
    tool('Crafting', t('nav.deck.sub.crafting'), '/topics/crafting.html', 'crafting blueprints bauplaene blaupausen planner planer herstellen'),
    tool('Fracturing', t('nav.deck.sub.fracturing'), '/fracturing.html', 'fracturing bruchrechner mining laser module gadgets brechen'),
    tool('Refinery', t('nav.deck.sub.refinery'), '/refinery.html', 'refinery raffinerie jobs auftraege tracker'),
    tool('Mining', t('nav.deck.sub.mining'), '/topics/mining.html', 'mining bergbau minerals mineralien erze ores scans'),
    tool('Precision Jump', t('nav.deck.sub.jump'), '/precision-jump.html', 'aaron halo quantum quantensprung routen routes'),
    tool("Wikelo's Emporium", t('nav.deck.sub.wikelo'), '/topics/wikelo-emporium.html', 'wikelo banu trades tausch handel'),
    tool(t('nav.ships'), t('nav.deck.sub.ships'), '/schiffe.html', 'ships schiffe vergleich compare specs'),
    tool(t('nav.archive'), t('nav.deck.sub.archive'), '/archiv.html', 'patches archiv archive versionen versions'),
    tool(t('nav.evolution'), t('nav.deck.sub.evolution'), '/evolution.html', 'evolution systeme systems'),
  ];
}

export async function buildSearchIndex(lang: Locale): Promise<SearchEntry[]> {
  const t = useTranslations(lang);
  const patches = (await getCollection('patches')).sort((a, b) =>
    a.data.date.localeCompare(b.data.date)
  );

  // Werkzeuge zuerst: bei gleicher Punktzahl gewinnt die fruehere Zeile, und
  // wer "mining" tippt, sucht eher das Werkzeug als einen Patch-Abschnitt.
  const tools = toolEntries(lang);
  const toolUrls = new Set(tools.map((e) => e.u));
  const out: SearchEntry[] = [...tools];

  for (const p of patches) {
    const d = mergePatchEn(p.id, p.data, lang);
    const purl = href(`/patches/sc-${p.id}.html`, lang);
    out.push({
      k: 'patch',
      b: `Alpha ${d.version}`,
      t: `Alpha ${d.version} — ${d.codename}`,
      s: d.tagline,
      u: purl,
      x: [eraLabel(d.era, lang), d.dateDisplay, d.wipe ?? '', d.fixesNote ?? ''].join(' ').trim(),
    });
    for (const tp of d.topics.filter((tp) => !toolUrls.has(href(`/topics/${tp.slug}.html`, lang))))
      out.push({
        k: 'thema',
        b: `Alpha ${d.version}`,
        t: tp.title,
        s: (d.features.find((f) => f.topicSlug === tp.slug)?.desc ?? d.tagline).slice(0, 140),
        u: href(`/topics/${tp.slug}.html`, lang),
        x: d.codename,
      });
    // features without their own deep-dive page (those are covered by topics)
    for (const f of d.features.filter((f) => !f.topicSlug))
      out.push({
        k: 'feature',
        b: `Alpha ${d.version}`,
        t: f.name,
        s: f.desc.slice(0, 140),
        u: `${purl}#dossier`,
        x: f.system ?? '',
      });
    for (const e of d.events)
      out.push({
        k: 'event',
        b: `Alpha ${d.version}`,
        t: e.name,
        s: e.desc.slice(0, 140),
        u: `${purl}#dossier`,
        x: '',
      });
  }

  // full vehicle catalog (wiki-API snapshot) — canonical ship entries
  // Der guenstigste Kaufpreis im Spiel steht mit im Treffer (Skizze 016):
  // dieselbe Zahl wie oben im Schiffsdatenblatt, das auch ihr Datum nennt.
  const vehicles = await getCollection('vehicles');
  for (const v of vehicles) {
    const buy = priceInfo(v.id)?.buy[0];
    out.push({
      k: 'schiff',
      b: v.data.manufacturer ?? v.data.makerCode ?? t('search.kind.schiff'),
      t: v.data.name,
      s: [v.data.manufacturer, vType(v.data, lang), vSize(v.data, lang), buy ? t('search.ship.from').replace('%p%', aUEC(buy.price, lang)) : null]
        .filter(Boolean)
        .join(' · '),
      u: href(`/schiffe/${v.id}.html`, lang),
      x: [...vFoci(v.data, lang), ...patchesFor(v.data.name).map((p) => `alpha ${p}`)].join(' '),
    });
  }

  // mission families (DataCore snapshot) — one entry per mission, not per offer.
  // Titel/Typen/Geber sind Spieldaten (englisch) und in beiden Sprachen
  // identisch; lokalisiert werden Zahlenformat und Ziel-URL.
  for (const m of missions) {
    const rep = repSummary(m)[0];
    // Platzhalter ohne Klammern indizieren: gesucht wird nach "Rank", nicht "{Rank}"
    const title = m.title.replace(/\{([^}]*)\}/g, '$1');
    out.push({
      k: 'mission',
      b: m.typeNames[0] ?? 'Mission',
      t: title,
      s: [
        m.rewardMax ? `${uec(m.rewardMax, lang)} aUEC` : null,
        rep?.factionName ?? null,
        m.count > 1 ? `${m.count}×` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      u: href(`/missionen/${m.slug}.html`, lang),
      x: [...m.giverNames, ...m.factionNames, ...m.localityNames, ...m.typeNames]
        .join(' ')
        .slice(0, 160),
    });
  }

  return out;
}

// Zweiter Teil: Items und Blueprints (~7.000 Eintraege, ~120 KB gzip) unter
// /search-index-more.json bzw. /de/search-index-more.json. Das Overlay laedt
// ihn parallel zum ersten Teil und erst beim Oeffnen der Suche
// (assets/search-overlay.js).
//
// Nur Seiten, die es gibt: pageItems (Items mit Datenblatt) und blueprints
// (Blueprints mit eigener Seite) — dieselben Listen, aus denen die Seiten
// entstehen. Groesse nur bei Schiffsteilen und Waffen; bei Kleidung und
// Ruestung sagt "S1" nichts. x traegt den Namen der anderen Sprache, damit die
// deutsche Suche auch den englischen Namen findet und umgekehrt.
//
// Zusammengefuehrt (09.11.2026, Skizze 016):
//  - Ein Item mit Rezept traegt c (Weg ins Crafting-Werkzeug, craftEntryPath)
//    und im x den Rezeptnamen. Das Rezept steht dann nicht noch einmal als
//    eigener Treffer da — ausser es ist nicht das Rezept, auf das c zeigt
//    (zwei Rezepte fuer ein Item, elf Faelle), oder sein Item hat kein
//    Datenblatt. Jedes Rezept bleibt so ueber die Suche erreichbar.
//  - Fahrzeug-Items (Kategorie Vehicle), deren Name genau ein Schiff trifft,
//    entfallen: der Schiffstreffer im ersten Teil fuehrt aufs Datenblatt mit
//    Kaufpreisen und Kauforten. Das Item-Datenblatt verlinkt seinerseits das
//    Schiff (ItemDetail.astro).
const SIZED_ROOTS = new Set(['Vehiclegear', 'Weapons']);

export async function buildSearchIndexMore(lang: Locale): Promise<SearchEntry[]> {
  const out: SearchEntry[] = [];
  const bpLabels = blueprintListLabels(blueprints, lang);
  const bpLabel = new Map(blueprints.map((b, i) => [b.slug, bpLabels[i]]));
  for (const it of pageItems) {
    if (await shipIdForVehicleItem(it)) continue;
    const g = it.game;
    const root = rootCategory(it.category);
    const sizes = SIZED_ROOTS.has(root)
      ? [...new Set(g?.variants?.length ? g.variants.map((v) => v.size) : [g?.size])].filter(
          (n): n is number => typeof n === 'number',
        )
      : [];
    const bp = recipeForItem(it);
    const name = displayName(it, lang);
    const rezept = bp ? bpLabel.get(bp.slug) : null;
    out.push({
      k: 'item',
      b: leafCategory(it.category),
      t: name,
      s: [g?.manufacturer, sizes.length ? sizes.map((n) => `S${n}`).join('/') : null].filter(Boolean).join(' · '),
      u: href(itemPath(it), lang),
      x: [altName(it, lang), categoryLabel(root, lang), rezept && rezept !== name ? rezept : null].filter(Boolean).join(' '),
      ...(bp ? { c: href(craftEntryPath(bp), lang) } : {}),
    });
  }
  // Gleichnamige Blueprints (11 Namen, z. B. BroadSpec) tragen dieselben
  // Unterscheider wie in den Blueprint-Listen (Masse oder laufende Nummer).
  blueprints.forEach((bp, i) => {
    const it = itemForBlueprint(bp);
    if (it && pageItemIds.has(it.id) && recipeForItem(it)?.slug === bp.slug) return;
    out.push({
      k: 'bauplan',
      b: craftLeaf(bp.category),
      t: bpLabels[i],
      s: categoryLabel(craftRoot(bp.category), lang),
      u: href(blueprintPath(bp), lang),
      x: it ? [displayName(it, lang), altName(it, lang)].filter((n) => n && n !== bp.name).join(' ') : '',
      c: href(craftEntryPath(bp), lang),
    });
  });
  return out;
}
