// Das Register kennt die Woerter der Spieler (24.11.2026, UX-Audit Paket B).
//
// Anlass: „karna gewehr", „Laranite", „Lorville", „Helme" fanden nichts oder
// nicht das Gemeinte (Task-Flows T1/A04-A06, Heuristik B03, IA B9). Die
// Suche selbst (Tippfehler, Reihenfolge, zweiter Weg) prueft
// tests/e2e/suche-status.test.js am echten Skript. Diese Datei prueft die
// Bausteine des Registers aus den echten Modulen:
//   - jede Zeile von GATTUNG an einem Namen aus dem Katalog,
//   - jeder Pfad in TOOL_ALIASES ist eine Seite, die es gibt,
//   - Erze, Orte, Laeden und Listen (src/lib/searchWelt.ts) zeigen auf
//     bestehende Seiten, mit Untergrenzen je Art.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function bundle(entry) {
  const { buildSync } = await import('esbuild');
  const out = buildSync({
    stdin: { contents: `export * from ${JSON.stringify(path.resolve(entry))};`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    // src/lib/patchPages.ts zaehlt Seiten mit import.meta.glob (Vite); hier
    // genuegt eine leere Liste, die Suche braucht davon nichts.
    define: { 'import.meta.glob': 'globalThis.__sucheGlob' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suche-treffer-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}
globalThis.__sucheGlob = () => ({});
const { GATTUNG, TOOL_ALIASES, gattungsWoerter } = await bundle('src/lib/searchAliases.ts');
const { weltEintraege } = await bundle('src/lib/searchWelt.ts');

// Ein Beispiel je Zeile, aus dem Katalog (Name + Kategoriepfad).
const BEISPIEL = {
  gewehr: 'Karna Rifle Weapons',
  'scharfschützengewehr': 'A03 Sniper Rifle Weapons',
  schrotflinte: 'Devastator Shotgun Weapons',
  pistole: 'Arclight Pistol Weapons',
  maschinenpistole: 'Custodian SMG Weapons / SMG',
  maschinengewehr: 'FS-9 LMG Weapons',
  granate: 'MK-4 Frag Grenade Weapons / Grenades',
  messer: 'Kumar Knife Weapons / Melee',
  'rüstung': 'Antium Core Armour / Core',
  unteranzug: 'TCS-4 Undersuit Armour / Undersuits',
  rucksack: 'Pembroke Backpack Armour / Backpacks',
  brustpanzer: 'Antium Core Armour / Core',
  armschutz: 'Antium Arms Armour / Arms',
  beinschutz: 'Antium Legs Armour / Legs',
  handschuhe: 'Venture Gloves Clothing / Gloves',
  schuhe: 'Hardy Boots Clothing / Footwear',
  hemd: 'Field Shirt Clothing / Shirts',
  hose: 'Cargo Pants Clothing / Legwear',
  'mütze': 'Beanie Clothing / Hats',
  schild: 'FR-66 Vehiclegear / Shield',
  'kühler': 'Bracer Vehiclegear / Cooler',
  kraftwerk: 'JS-300 Vehiclegear / Powerplant',
  quantenantrieb: 'Atlas Vehiclegear / Quantumdrive',
  lenkrakete: "'Arrow' I Missile Vehiclegear / Weapons / Missiles",
  rakete: 'Rocket Pod Vehiclegear / Weapons / Rockets',
  'geschützturm': 'Manned Turret Vehiclegear / Weapons / Turrets',
  kanone: 'CF-337 Panther Repeater Vehiclegear / Weapons / Guns',
  lackierung: 'Gladius Dunlevy Livery Vehiclegear / Liveries',
  bergbau: 'Arbor MH1 Mining Laser Vehiclegear / Mining Module',
  bergung: 'Abrade Scraper Module Vehiclegear / Salvage',
  traktorstrahl: 'Tractor Beam Vehiclegear / Tractor Beam',
  treibstoff: 'External Fuel Tank Vehiclegear / External Fuel Tank',
  batterie: 'Karna Rifle Battery (35 cap) Attachment / Magazine',
  'getränk': 'Water Bottle Utility / Drinks',
  essen: 'Burrito Utility / Foods',
  kleidung: 'Hat Clothing',
  'behälter': 'Cargo Box Utility / Containers',
};

describe('Gattungswoerter (src/lib/searchAliases.ts)', () => {
  test('jede Zeile trifft ihr Beispiel aus dem Katalog', () => {
    let geprueft = 0;
    for (const [re, woerter] of GATTUNG) {
      const erstes = woerter.split(' ')[0];
      const bsp = Object.entries(BEISPIEL).find(([w]) => woerter.split(' ').includes(w));
      assert.ok(bsp, `Zeile ${re} (${woerter}) hat kein Beispiel in BEISPIEL`);
      assert.ok(re.test(bsp[1]), `Zeile ${re} trifft ihr Beispiel "${bsp[1]}" nicht`);
      assert.ok(gattungsWoerter(bsp[1]).split(' ').includes(bsp[0]), `"${bsp[1]}" bekommt "${bsp[0]}" nicht (${erstes})`);
      geprueft++;
    }
    console.log(`    Gattungszeilen geprueft: ${geprueft}`);
    assert.ok(geprueft >= 37, `nur ${geprueft} Zeilen — die Tabelle ist geschrumpft`);
  });

  test('kein Wort doppelt, wenn es schon im Namen steht', () => {
    assert.equal(gattungsWoerter('Argus Helmet Armour / Helmets').split(' ').includes('helm'), false,
      '„helm" steht schon in „Helmet" und braucht keinen Eintrag');
    assert.equal(gattungsWoerter('Gladius'), '');
  });

  test('„Core" und „Arms" nur als ganzes Wort', () => {
    assert.equal(gattungsWoerter('Score Board').includes('brustpanzer'), false);
    assert.equal(gattungsWoerter('Firearms').includes('armschutz'), false);
  });
});

describe('Suchwoerter je Werkzeug (TOOL_ALIASES)', () => {
  test('jeder Pfad ist eine Seite, die es gibt', () => {
    const quellen = (p) => [
      path.join('src/pages', p.replace(/\.html$/, '.astro')),
      path.join('src/pages', p.replace(/\.html$/, ''), 'index.astro'),
    ];
    const pfade = Object.keys(TOOL_ALIASES);
    for (const p of pfade) assert.ok(quellen(p).some((f) => fs.existsSync(f)), `${p}: keine Seite unter ${quellen(p).join(' / ')}`);
    console.log(`    Werkzeugpfade geprueft: ${pfade.length}`);
    // 15 bis 26.11.2026; seitdem 14: der Item Finder ist in der Items-Seite
    // aufgegangen, seine Suchwoerter stehen bei /items.html. 14 -> 13 am
    // selben Tag: das Blueprint-Verzeichnis ist nur noch fuer Google da und
    // kein Werkzeug der Suche mehr (Krisz „werkbank ist das einzige für
    // menschen“, verify:nur-werkbank).
    assert.ok(pfade.length >= 13, `nur ${pfade.length} Pfade`);
  });

  test('die Woerter aus dem Audit stehen drin: werkbank, raffinerie, loadout', () => {
    assert.match(TOOL_ALIASES['/topics/crafting.html'], /\bwerkbank\b/);
    assert.match(TOOL_ALIASES['/refinery.html'], /\braffinerie\b/);
    assert.match(TOOL_ALIASES['/schiffe.html'], /\bloadout\b/);
  });
});

for (const lang of ['de', 'en']) {
  describe(`Erze, Orte, Laeden, Listen (${lang})`, () => {
    const alle = weltEintraege(lang);
    const je = (k) => alle.filter((e) => e.k === k);
    const pre = lang === 'de' ? '/de' : '';

    test('Untergrenzen je Art (Selbstauskunft)', () => {
      const z = Object.fromEntries(['erz', 'ort', 'laden', 'liste', 'bauplanliste'].map((k) => [k, je(k).length]));
      console.log(`    ${lang}: ${JSON.stringify(z)}`);
      // Klinken knapp unter dem Stand vom 24.11.2026 (37, 140, 43, 77, 60).
      assert.ok(z.erz >= 35, `Erze ${z.erz}`);
      assert.ok(z.ort >= 120, `Orte ${z.ort}`);
      assert.ok(z.laden >= 30, `Laeden ${z.laden}`);
      assert.ok(z.liste >= 70, `Item-Listen ${z.liste}`);
      assert.ok(z.bauplanliste >= 50, `Blueprint-Listen ${z.bauplanliste}`);
    });

    test('die Beispiele aus dem Audit stehen drin und zeigen aufs richtige Werkzeug', () => {
      const finde = (t) => alle.find((e) => e.t === t);
      assert.equal(finde('Laranite')?.u, `${pre}/topics/mining.html?mineral=Laranite#db`);
      assert.equal(finde('Quantainium')?.w, `${pre}/refinery.html?erz=Quantainium#ertrag`);
      assert.equal(finde('Lorville')?.u, `${pre}/items.html?q=Lorville`);
      const daymar = finde('Daymar');
      assert.equal(daymar?.u, `${pre}/topics/mining.html?fundort=Daymar#db`);
      assert.match(daymar?.w ?? '', /\/missionen\.html\?loc=/);
      assert.equal(finde('Helmets')?.u, `${pre}/items/category/armour-helmets.html`);
    });

    test('jedes Ziel ist eine Seite, die es gibt; kein Ort doppelt', () => {
      const seite = (u) => u.replace(/^\/de\//, '/').replace(/[?#].*$/, '');
      // Blueprint-Listen fuehren seit 26.11.2026 in die Crafting-Werkbank mit
      // dem Kategorie-Filter (?kat=), nicht mehr ins Blueprint-Verzeichnis.
      const bekannt = new Set(['/topics/mining.html', '/refinery.html', '/items.html', '/missionen.html', '/topics/crafting.html']);
      for (const e of alle) {
        for (const u of [e.u, e.w].filter(Boolean)) {
          assert.ok(u.startsWith(`${pre}/`), `${e.t}: ${u} ohne Sprachpraefix`);
          const s = seite(u);
          if (s.startsWith('/items/category/')) continue;
          assert.ok(bekannt.has(s), `${e.t}: unbekanntes Ziel ${u}`);
        }
        assert.equal(!!e.w, !!e.wl, `${e.t}: w und wl nur zusammen`);
        assert.ok(!e.c, `${e.t}: c gehoert dem Herstellen-Weg der Items`);
      }
      const orte = je('ort').map((e) => e.t);
      assert.equal(new Set(orte).size, orte.length, 'ein Ort steht zweimal im Register');
    });
  });
}

// Missionen (Paket B5 mit Paket F, src/lib/searchMissionen.ts): der Name wie
// auf der Missionsseite, gleichnamige Missionen am Zusatz in der Unterzeile
// unterscheidbar. Vorher standen 260 Treffer unter einem Titel, der mit
// anderen gleich lautete, ohne Unterschied in der Zeile.
const { missionEintraege } = await bundle('src/lib/searchMissionen.ts');
const { missions, missionName } = await bundle('src/lib/missions.ts');

for (const lang of ['de', 'en']) {
  describe(`Missionen in der Kopfsuche (${lang})`, () => {
    const alle = missionEintraege(lang);

    test('eine Zeile je Mission, Name wie auf der Seite, ohne Vorlagen-Klammern', () => {
      assert.equal(alle.length, missions.length);
      assert.ok(alle.length >= 1300, `nur ${alle.length} Missionen`);
      missions.forEach((m, i) => {
        assert.equal(alle[i].t, missionName(m).titel, m.slug);
        assert.doesNotMatch(alle[i].t, /[{}]/, m.slug);
        assert.ok(alle[i].u.endsWith(`/missionen/${m.slug}.html`), alle[i].u);
      });
    });

    test('gleich lautende Zeilen (Titel und Unterzeile) unter der Klinke', () => {
      const n = new Map();
      for (const e of alle) n.set(`${e.t}|${e.s}`, (n.get(`${e.t}|${e.s}`) ?? 0) + 1);
      const gleich = [...n.entries()].filter(([, c]) => c > 1);
      const zeilen = gleich.reduce((s, [, c]) => s + c, 0);
      const titel = new Map();
      for (const e of alle) titel.set(e.t, (titel.get(e.t) ?? 0) + 1);
      const gleicherTitel = [...titel.values()].filter((c) => c > 1).reduce((s, c) => s + c, 0);
      console.log(`    ${lang}: ${alle.length} Missionen, ${gleicherTitel} mit gleichem Titel, davon ${zeilen} auch in der Unterzeile gleich`);
      // Klinke: Stand 24.11.2026 sind es 4, zwei Paare „Delivery …", bei
      // denen auch Zusatz, Belohnung und Fraktion gleich sind (die Seite
      // selbst zaehlt 8 Missionen mit gleichem Namen und Zusatz,
      // missionNamenRestDoppelt).
      assert.ok(zeilen <= 4, `${zeilen} Zeilen gleich: ${gleich.map(([k]) => k).slice(0, 5).join(' / ')}`);
    });

    test('Vorlage und Zusatz beider Sprachen bleiben Suchwoerter, ohne Wiederholung', () => {
      assert.ok(alle.some((e) => /\babholort/i.test(e.x)), '„abholort" findet keine Mission');
      assert.ok(alle.some((e) => /\brank\b/i.test(e.x)), '„rank" (aus der Vorlage) findet keine Mission');
      for (const e of alle) {
        const w = e.x.toLowerCase().split(/\s+/).filter(Boolean);
        assert.equal(new Set(w).size, w.length, `${e.t}: Wort doppelt in x`);
        const imTitel = new Set(e.t.toLowerCase().split(/\s+/));
        assert.ok(!w.some((x) => imTitel.has(x)), `${e.t}: x wiederholt den Titel`);
      }
    });
  });
}
