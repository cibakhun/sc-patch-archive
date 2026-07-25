// Ruestungs-Sets aus den Spieldaten — Dreier-Kette statt einer Quelle.
//
// WARUM DREI QUELLEN: Das Spiel fuehrt zwar eine eigene Set-Taxonomie
// (`Armor.FPS.Set.<Hersteller>.<Set>`), die ist aber weder vollstaendig noch
// fehlerfrei. Belegter Praxisfall „Dust Devil" (6 Teile):
//   - 2 Teile tragen `Armor.FPS.Set.Doomsday.Overlord`  -> falsches Set
//   - 4 Teile tragen ueberhaupt keinen Set-Tag
// Ein rein tag-basierter Set-Finder wuerde also zwei Teile unter dem falschen
// Set einsortieren und vier gar nicht. Deshalb:
//
//   1) DATEISTAMM gruppiert   — `srvl_armor_heavy_legs_02_01_01` -> `srvl_armor_heavy#02`
//      Slot-Wort + Varianten-Ziffern abschneiden. Deckt ~84 % der Teile ab und
//      fasst die Dust-Devil-Teile korrekt zusammen.
//   2) `item_name*_short` BENENNT — `item_name_srvl_armor_heavy_armor_02_short = Dust Devil`.
//      Diese Schluessel tragen den Set-Anzeigenamen und kennen 14 Sets, die der
//      Tag gar nicht fuehrt (Morozov-*, Palatino, Chiron, Outback, Wrecker, …).
//   3) SET-TAG ergaenzt die Hersteller-Ebene und dient als GEGENPROBE.
//   4) ANZEIGENAMEN teilen und benennen — gemessen noetig, weil der Dateistamm
//      teils zu grob ist: `qrt_combat_heavy#02` enthaelt „Ana"- UND „Bokto"-Teile,
//      `cds_combat_light#02` „FBL-8a" und „CSP-68L". Innerhalb einer Stamm-Gruppe
//      wird deshalb nach dem fuehrenden Wort der Item-Namen geclustert; der
//      gemeinsame Wort-Praefix eines Clusters (ohne Slot-Wort) ist der Set-Name.
//      Das ist KEINE Namens-Heuristik im verbotenen Sinn: geraten wird nichts,
//      die Namen sind game-authored und dienen nur zum Trennen und Beschriften.
//
// Bei Widerspruch gewinnen Stamm + `_short`; abweichende Tags landen im
// Build-Log (`conflicts`), nicht in der UI — so faellt ein neues Fehl-Tag nach
// einem Patch beim naechsten Build auf, statt still live zu gehen.
//
// Zum Schluss werden Cluster mit gleichem Set-Namen zusammengefasst: dasselbe Set
// verteilt sich oft ueber mehrere Dateistaemme (Venture lag auf zwei Staemmen).

// Slot-Woerter, die zwischen Set-Stamm und Varianten-Nummer stehen. `armor`/`combat`
// sind mit drin, weil die `_short`-Schluessel genau die als Platzhalter benutzen.
const SLOT_WORDS = 'helmet|core|torso|arms|legs|backpack|undersuit|armor|armour|suit|combat';
const STEM_RE = new RegExp(`^(.*?)_(?:${SLOT_WORDS})_(\\d+)(?:_\\d+)*$`, 'i');
const SHORT_RE = new RegExp(`^item_name_?(.+?)_(?:${SLOT_WORDS})_(\\d+)(?:_\\d+)*_short$`, 'i');
const SET_TAG_PREFIX = 'Armor.FPS.Set.';
// CIG-Konvention fuer unfertige Eintraege; dieselbe Logik wie in build-universal-db.
const PLACEHOLDER = /placeholder|<=|=>|^\(?ph\)?\s*[-–]?\s|^\s*$/i;

/** `srvl_armor_heavy_legs_02_01_01` -> `srvl_armor_heavy#02` (oder null). */
export function stemOf(fileBase) {
  const m = STEM_RE.exec(String(fileBase || '').toLowerCase());
  return m ? `${m[1]}#${m[2]}` : null;
}

/** global.ini -> Map(stem -> Set-Anzeigename) aus den `item_name*_short`-Schluesseln. */
export function shortNamesByStem(iniMap) {
  const out = new Map();
  for (const [k, v] of iniMap) {
    const m = SHORT_RE.exec(k);
    if (!m || PLACEHOLDER.test(v)) continue;
    const stem = `${m[1]}#${m[2]}`.toLowerCase();
    if (!out.has(stem)) out.set(stem, v.trim());
  }
  return out;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Slot-Woerter, wie sie im ANZEIGENAMEN vorkommen („Venture Legs", „Dust Devil Armor Core")
const SLOT_DISPLAY = /^(armor|armour|helmet|core|arms|legs|undersuit|backpack|suit|torso)$/i;

/** Gemeinsamer fuehrender Wort-Praefix mehrerer Anzeigenamen, ohne Slot-Wort am Ende. */
function commonNamePrefix(names) {
  const toks = names.map((n) => n.trim().split(/\s+/));
  const maxLen = Math.min(4, ...toks.map((t) => t.length));
  const out = [];
  for (let i = 0; i < maxLen; i++) {
    const w = toks[0][i];
    if (toks.every((t) => t[i] && t[i].toLowerCase() === w.toLowerCase())) out.push(w);
    else break;
  }
  while (out.length > 1 && SLOT_DISPLAY.test(out[out.length - 1])) out.pop();
  if (!out.length || (out.length === 1 && SLOT_DISPLAY.test(out[0]))) return null;
  return out.join(' ');
}

/**
 * Ordnet Ruestungsteile zu Sets.
 * @param {Array<{key:string,name:string,gameType:string,file:string,tagPaths:string[],manufacturer?:string|null}>} parts
 * @returns {{sets: object[], setIdByKey: Map<string,string>, conflicts: object[], stats: object}}
 */
export function resolveArmorSets(parts, shortByStem) {
  // --- 1) gruppieren: Dateistamm zuerst, sonst ersatzweise ueber den Set-Tag ---
  const groups = new Map(); // groupKey -> { stem, parts[], tagCount: Map }
  let stemmed = 0, viaTag = 0, ungrouped = 0;
  for (const p of parts) {
    const setTag = p.tagPaths.find((t) => t.startsWith(SET_TAG_PREFIX) && t.length > SET_TAG_PREFIX.length) || null;
    const stem = stemOf(p.file);
    let gk = null;
    if (stem) { gk = `s:${stem}`; stemmed++; }
    else if (setTag) { gk = `t:${setTag}`; viaTag++; }
    else { ungrouped++; continue; }
    let g = groups.get(gk);
    if (!g) groups.set(gk, g = { stem, parts: [], tagCount: new Map() });
    g.parts.push(p);
    if (setTag) g.tagCount.set(setTag, (g.tagCount.get(setTag) || 0) + 1);
  }

  // --- 2) innerhalb jeder Gruppe nach Anzeigenamen clustern und benennen ---
  const clusters = [];  // { name, source, mfr, stem, parts[] }
  const conflicts = [];
  let namedByShort = 0, namedByPrefix = 0, namedByTag = 0, unnamed = 0, split = 0;

  for (const [gk, g] of groups) {
    const short = g.stem ? shortByStem.get(g.stem) || null : null;
    // haeufigstes Set-Tag der Gruppe (Mehrheitsentscheid, nicht erstes Vorkommen)
    let topTag = null, topN = 0;
    for (const [t, n] of g.tagCount) if (n > topN) { topTag = t; topN = n; }
    const tagParts = topTag ? topTag.slice(SET_TAG_PREFIX.length).split('.') : [];
    const tagSetName = tagParts.length ? tagParts[tagParts.length - 1] : null;
    const tagMfr = tagParts.length > 1 ? tagParts[0] : null;

    // nach fuehrendem Wort clustern
    const byWord = new Map();
    for (const p of g.parts) {
      const w = norm(p.name.trim().split(/\s+/)[0]);
      (byWord.get(w) || byWord.set(w, []).get(w)).push(p);
    }
    if (byWord.size > 1) split++;

    for (const [word, cparts] of byWord) {
      const prefix = commonNamePrefix(cparts.map((p) => p.name));
      // `_short` gilt nur fuer den Cluster, zu dem der Name auch passt
      const shortFits = short && (norm(short).startsWith(word) || word.startsWith(norm(short)));
      // Ein EINZELNES Teil hat keinen echten gemeinsamen Praefix — sein voller Name
      // waere der „Set-Name" („Sangar Helmet (Modified)"). Da gewinnt der game-authored
      // Tag. Erst ab zwei Teilen ist der gemeinsame Praefix eine belastbare Aussage.
      const prefixReliable = prefix && cparts.length >= 2;
      let name = null, source = null;
      if (shortFits) { name = short; source = 'short'; namedByShort++; }
      else if (prefixReliable) { name = prefix; source = 'prefix'; namedByPrefix++; }
      else if (tagSetName) { name = tagSetName; source = 'tag'; namedByTag++; }
      else if (prefix) { name = prefix; source = 'prefix'; namedByPrefix++; }
      else { unnamed++; continue; }

      // Gegenprobe gegen den EIGENEN Set-Tag des Clusters (nicht den der Gruppe —
      // nach dem Aufteilen ist ein abweichender Gruppen-Tag ja gerade erwartbar).
      const cTags = new Map();
      for (const p of cparts) for (const t of p.tagPaths) {
        if (t.startsWith(SET_TAG_PREFIX) && t.length > SET_TAG_PREFIX.length) cTags.set(t, (cTags.get(t) || 0) + 1);
      }
      let cTop = null, cTopN = 0;
      for (const [t, n] of cTags) if (n > cTopN) { cTop = t; cTopN = n; }
      const cTagName = cTop ? cTop.slice(SET_TAG_PREFIX.length).split('.').pop() : null;
      if (cTagName && norm(name) !== norm(cTagName)) {
        conflicts.push({
          group: gk, name, source, tagPath: cTop,
          tagCoverage: `${cTopN}/${cparts.length}`,
          sample: cparts.slice(0, 3).map((p) => p.name),
        });
      }

      // Hersteller: der Wert AM ITEM ist der lokalisierte Anzeigename („Clark Defense
      // Systems"); der Tag traegt nur die zusammengezogene Kurzform („ClarkeDefense").
      // Fuer die Anzeige gewinnt daher das Item, der Tag ist Rueckfallebene.
      let mfr = null;
      const c = new Map();
      for (const p of cparts) if (p.manufacturer) { const m = p.manufacturer.trim(); c.set(m, (c.get(m) || 0) + 1); }
      let best = 0;
      for (const [m, n] of c) if (n > best) { mfr = m; best = n; }
      if (!mfr) mfr = tagMfr;
      clusters.push({ name, source, mfr: mfr || null, stem: g.stem || null, parts: cparts, tag: cTop });
    }
  }

  // --- 2b) Einzelgaenger absorbieren ---
  // Ein Cluster mit 1–2 Teilen, der denselben Set-Tag traegt wie ein deutlich
  // groesserer Cluster, ist praktisch immer eine Variante davon („TruDef-Pro Legs
  // Scorched" neben 57× „TrueDef-Pro …"). Ohne diesen Schritt entstuenden
  // Ein-Teil-Sets neben dem echten Set.
  const biggestByTag = new Map();
  for (const c of clusters) {
    if (!c.tag || c.parts.length < 3) continue;
    const b = biggestByTag.get(c.tag);
    if (!b || c.parts.length > b.parts.length) biggestByTag.set(c.tag, c);
  }
  let absorbed = 0;
  const kept = [];
  for (const c of clusters) {
    const host = c.tag && c.parts.length <= 2 ? biggestByTag.get(c.tag) : null;
    if (host && host !== c) { host.parts = host.parts.concat(c.parts); absorbed++; continue; }
    kept.push(c);
  }
  clusters.length = 0;
  clusters.push(...kept);

  // --- 3) gleiche Set-Namen zusammenfuehren (ein Set liegt oft auf mehreren Staemmen) ---
  const merged = new Map();
  for (const c of clusters) {
    const key = norm(c.name);
    const m = merged.get(key);
    if (!m) { merged.set(key, { ...c, stems: c.stem ? [c.stem] : [] }); continue; }
    m.parts = m.parts.concat(c.parts);
    if (!m.mfr && c.mfr) m.mfr = c.mfr;
    if (c.stem && !m.stems.includes(c.stem)) m.stems.push(c.stem);
    // Quelle: die belastbarste gewinnt (short > prefix > tag)
    const rank = { short: 3, prefix: 2, tag: 1 };
    if (rank[c.source] > rank[m.source]) m.source = c.source;
  }

  // --- 4) Sets ausformen ---
  const sets = [];
  const setIdByKey = new Map();
  const usedIds = new Set();
  for (const m of merged.values()) {
    let id = slug(m.name) || slug(m.stems[0] || 'set');
    if (usedIds.has(id)) { let n = 2; while (usedIds.has(`${id}-${n}`)) n++; id = `${id}-${n}`; }
    usedIds.add(id);

    const slots = {};
    for (const p of m.parts) {
      const slot = p.gameType.replace(/^Char_Armor_/, '');
      (slots[slot] ||= []).push(p.name);
      setIdByKey.set(p.key, id);
    }
    for (const k of Object.keys(slots)) slots[k].sort((a, b) => a.localeCompare(b, 'en'));

    // Gewichtsklasse des Sets = haeufigste unter den Teilen. „Undersuit" bleibt
    // dabei aussen vor, sonst zieht ein einzelner Unteranzug die Klasse eines
    // Kampf-Sets nach unten. ABER: manche Sets bestehen NUR aus Teilen, die das
    // Spiel als Undersuit fuehrt (Flughelm-Reihen wie A23) — die haetten sonst
    // gar keine Klasse. Deshalb Rueckfallebene mit Undersuit statt null.
    const wc = new Map(), wcAll = new Map();
    for (const p of m.parts) {
      const w = p.tagPaths.find((t) => t.startsWith('Armor.FPS.Type.'));
      if (!w) continue;
      const v = w.slice('Armor.FPS.Type.'.length);
      wcAll.set(v, (wcAll.get(v) || 0) + 1);
      if (v !== 'Undersuit') wc.set(v, (wc.get(v) || 0) + 1);
    }
    const top = (map) => { let k = null, n = 0; for (const [a, b] of map) if (b > n) { k = a; n = b; } return k; };
    const weight = top(wc) ?? top(wcAll);

    sets.push({
      id, name: m.name, manufacturer: m.mfr || null, weight, source: m.source,
      parts: m.parts.length, slots,
      coreSlots: ['Helmet', 'Torso', 'Arms', 'Legs'].filter((s) => slots[s]).length,
    });
  }

  sets.sort((a, b) => (a.manufacturer || 'zzz').localeCompare(b.manufacturer || 'zzz', 'en') || a.name.localeCompare(b.name, 'en'));
  return {
    sets, setIdByKey, conflicts,
    stats: {
      partsIn: parts.length, grouped: stemmed + viaTag, viaStem: stemmed, viaTagOnly: viaTag, ungrouped,
      groups: groups.size, splitGroups: split, clusters: clusters.length, absorbed,
      sets: sets.length, namedByShort, namedByPrefix, namedByTag, unnamedClusters: unnamed,
      complete: sets.filter((s) => s.coreSlots === 4).length,
      conflicts: conflicts.length,
    },
  };
}
