import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(readFileSync(join(hier, '../inhalt-de.json'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (h) => (h.startsWith('/') ? `https://verse-base.com/de${h}` : h);
const a = (l, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(url(l.h))}">${esc(l.t)}</a>`;
const rich = (teile) => teile.map((t) => (typeof t === 'string' ? esc(t) : t.b ? `<b>${esc(t.b)}</b>` : a(t))).join('');
const liste = (v) => v.map((x) => (typeof x === 'string' ? esc(x) : a(x))).join(', ');
const zahl = (n) => n.toLocaleString('de-DE');
const alt = Object.fromEntries(j.bilder.map((b) => [`${b.art}:${b.key}`, b.alt]));

function bild(art, key) {
  if (art === 'rsi') {
    const p = `/assets/patch-4-10-3/rsi/${key}`;
    return `<img src="${p}-640.webp" srcset="${p}-640.webp 640w, ${p}-1200.webp 1200w" sizes="(min-width: 900px) 25vw, 80vw" alt="${esc(alt[`rsi:${key}`])}" loading="lazy" decoding="async">`;
  }
  if (art === 'szene') return `<img src="/assets/patch-4-10-3/render/${key}-1200.webp" alt="${esc(alt[`szene:${key}`])}" loading="lazy" decoding="async">`;
  const p = `/assets/patch-4-10-3/render/${key}`;
  return `<img class="modell" src="${p}-640.webp" alt="${esc(alt[`render:${key}`])}" loading="lazy" decoding="async">`;
}

function karte({ id, art, key, name, zahl: z, unter, inhalt }) {
  return `<article class="karte" role="listitem"${id ? ` id="${id}"` : ''}>
  <details>
    <summary>
      <span class="karte__bild">${bild(art, key)}</span>
      <span class="karte__text">
        <span class="karte__name">${name}</span>
        <span class="karte__zahl">${z}</span>
        <span class="karte__unter">${unter}</span>
      </span>
      <span class="karte__mehr" aria-hidden="true"></span>
    </summary>
    <div class="karte__inhalt">${inhalt}</div>
  </details>
</article>`;
}

function reihe({ id, stand, titel, satz, karten, dicht = false }) {
  return `<section class="reihe" id="${id}" aria-labelledby="${id}-t">
  <header class="reihe__kopf">
    <p class="stand">${stand}</p>
    <h2 id="${id}-t">${titel}</h2>
    <p class="reihe__satz">${satz}</p>
  </header>
  <div class="schiene${dicht ? ' schiene--dicht' : ''}" role="list" style="--n:${Math.min(karten.length, 4)}">
${karten.join('\n')}
  </div>
</section>`;
}

const zeile = (k, v) => `<li><span class="k">${k}</span><span class="v">${v}</span></li>`;
const zeilen = (xs) => `<ul class="werte">${xs.join('')}</ul>`;

/* Aufträge */
const auftragBild = { Flotten: 'vanduul-szene', Mauler: 'vncl-stinger', 'Shattered Blade': 'vncl-scythe', 'An Bord': 'vncl-blade' };
const auftragName = { Flotten: 'Verbände abfangen', Mauler: 'Mauler und Stinger', 'Shattered Blade': 'Dreifrontenkampf', 'An Bord': 'Entern und Bergen' };
const skarnov = j.ausruestung.karten.find((k) => k.id === 'skarnov');
const camo = j.ausruestung.karten.find((k) => k.id === 'raider-camo');
const auftragKarten = j.auftraege.gruppen.map((g) => {
  const bp = g.auftraege.reduce((s, x) => s + x.bauplaene, 0);
  let inhalt = `<p>${esc(g.text)}</p><ul class="auftraege">${g.auftraege
    .map((x) => `<li>${a(x.link)}<span>${esc(x.rang)}${x.bauplaene ? ` · ${x.bauplaene} Baupläne` : ''}${x.belohnung ? ` · ${a(x.belohnung)}` : ''}</span></li>`)
    .join('')}</ul>`;
  if (g.typ === 'An Bord') {
    inhalt += `<h4>Skarnov und Raider Camo</h4><p>${rich(skarnov.text)}</p>${zeilen([
      ...skarnov.liste.map((l) => zeile(esc(l.k), liste(l.v))),
      ...camo.liste.map((l) => zeile(`Raider Camo · ${esc(l.k)}`, liste(l.v))),
    ])}`;
  }
  return karte({
    art: g.typ === 'Flotten' ? 'szene' : 'rsi',
    key: auftragBild[g.typ],
    name: esc(auftragName[g.typ]),
    zahl: `${g.auftraege.length} Aufträge`,
    unter: bp ? `${bp} Baupläne als Belohnung` : esc(g.typ),
    inhalt,
  });
});

/* Neue Schiffe */
const schiffZahl = { 'rsi-galaxy': ['720 SCU', 'mit Frachtmodul, sonst 64'], 'anvl-liberator': ['Träger', 'für Schiffe und Fahrzeuge'] };
const ersteZwei = (t) => t.split(/(?<=\.)\s+/).slice(0, 2).join(' ');
const schiffKarten = j.neueSchiffe.map((s) =>
  karte({
    art: 'rsi',
    key: s.id,
    name: `${esc(s.hersteller.split(' ')[0] === 'Roberts' ? 'RSI' : s.hersteller.split(' ')[0])} ${a(s.link)}`,
    zahl: schiffZahl[s.id][0],
    unter: schiffZahl[s.id][1],
    inhalt: `<p>${esc(ersteZwei(s.text))}</p>${zeilen(s.werte.map((w) => zeile(esc(w.k), rich(w.v))))}${
      s.module.length ? `<p class="klein">Module: ${liste(s.module)}</p>` : ''
    }<p class="klein">Vergleich mit ${a(s.vergleich.schiff)}: ${s.vergleich.werte.map((w) => `${esc(w.k)} ${esc(w.dieses)} zu ${esc(w.jenes)}`).join(' · ')}</p>`,
  }),
);

/* aUEC */
const auecKarten = j.auec.schiffe.map((s) => {
  const billig = Math.min(...s.angebote.map((o) => o.preis));
  return karte({
    art: 'rsi',
    key: s.id,
    name: a(s.link),
    zahl: `${s.angebote.length > 1 ? '<small>ab </small>' : ''}${zahl(billig)}<small>&nbsp;aUEC</small>`,
    unter: esc(s.hersteller),
    inhalt: zeilen(s.angebote.map((o) => zeile(esc(o.haendler), `${esc(o.ort)} · <b>${zahl(o.preis)} aUEC</b>`))) + `<p class="klein">Preise vom ${new Date(s.preiseVom).toLocaleDateString('de-DE')}</p>`,
  });
});

/* Werte */
const w = Object.fromEntries(j.werte.map((x) => [x.id, x]));
const wertZeile = (z) => {
  const wer = [...z.schiffe.map(a), ...z.was.map((x) => (typeof x === 'string' ? esc(x) : a(x)))].join(', ');
  const vor = z.vorher ? liste(z.vorher.v) : z.schon ? 'schon' : 'neu';
  const nach = liste(z.nachher.v);
  return zeile(wer, z.vorher || z.schon ? `${vor} → <b>${nach}</b>` : `<b>${nach}</b>`);
};
const balken = (zs) => {
  const max = Math.max(...zs.map((z) => z.nachher.zahl));
  return `<ul class="balken">${zs
    .map(
      (z) => `<li><span class="k">${z.schiffe.map(a).join(', ')}</span><span class="spur"><i style="width:${(z.vorher.zahl / max) * 100}%"></i><b style="width:${(z.nachher.zahl / max) * 100}%"></b></span><span class="v">${z.vorher.v[0]} → <b>${z.nachher.v[0]}</b></span></li>`,
    )
    .join('')}</ul>`;
};
const notiz = (x) => (x.notiz?.length ? `<p class="klein">${x.notiz.map((n) => (typeof n === 'string' ? esc(n) : rich([n]))).join('')}</p>` : '');
const notizRich = (x) => (x.notiz?.length ? `<p class="klein">${rich(x.notiz)}</p>` : '');
const wertKarten = [
  karte({ id: 'radar', art: 'render', key: 'anvl-carrack', name: 'Radar', zahl: 'Gr. 2 → 3', unter: 'Carrack, Perseus, Starlancer', inhalt: zeilen(w.radar.zeilen.map(wertZeile)) + notiz(w.radar) }),
  karte({ id: 'salvage', art: 'render', key: 'aegs-reclaimer', name: `Salvage · ${a(w.salvage.zeilen[0].schiffe[0])}`, zahl: '240 → 448<small>&nbsp;SCU</small>', unter: 'Puffer, auch MOTH und Vulture', inhalt: `<p class="klein">Salvage-Puffer in SCU, hell vorher, gold nachher.</p>${balken(w.salvage.zeilen)}${notiz(w.salvage)}` }),
  karte({ id: 'kampf', art: 'rsi', key: 'vncl-glaive', name: `Kampf · ${a({ t: 'Mauler „STRIKER“', h: '/items/vanduul-mauler-striker-repeater.html' })}`, zahl: '64 → 250', unter: 'Energieschaden je Schuss', inhalt: zeilen(w.kampf.zeilen.map(wertZeile)) + notiz(w.kampf) }),
  karte({ id: 'vanguard', art: 'render', key: 'aegs-vanguard', name: 'Vanguard', zahl: '400 → 750', unter: 'Turm-DPS Warden und Hoplite, nicht in den Notes', inhalt: zeilen(w.vanguard.zeilen.map(wertZeile)) + notizRich(w.vanguard) }),
];

/* Ausrüstung */
const k = Object.fromEntries(j.ausruestung.karten.map((x) => [x.id, x]));
const ausKarten = [
  karte({ id: 'iae-2956', art: 'rsi', key: 'iae-2956-halle', name: 'IAE 2956', zahl: '4 Lackierungen', unter: '„2956 Best In Show“, dazu Kleidung', inhalt: zeilen(k['iae-2956'].liste.map((l) => zeile(esc(l.k), liste(l.v)))) + `<p class="klein">Dazu Sammelmünzen der Best-in-Show-Schiffe mit Vitrine.</p>` }),
  karte({ id: 'deterrent', art: 'render', key: 'rsi-polaris', name: `${a({ t: 'Deterrent', h: '/items/deterrent.html' })} · ${a({ t: 'Lephari', h: '/items/lephari.html' })}`, zahl: 'Gr. 4', unter: 'Schild, bis 4.10.2 „Glacis“', inhalt: `<p>${rich(k.deterrent.text)}</p>${zeilen(k.deterrent.liste.map((l) => zeile('Bauplan', liste(l.v))))}` }),
  karte({ id: 'namen', art: 'render', key: 'anvl-ballista', name: 'Namen · HM6', zahl: '3 umbenannt', unter: 'Ballista, Spartan, Centurion', inhalt: `<p>${rich(k.namen.text)}</p>` }),
];

/* Dossier */
const b = j.bestand;
const dossier = `<details class="dossier" id="akte">
  <summary><span class="stand">4.10.2 → 4.10.3</span><span class="dossier__t">Dossier</span><span class="dossier__s">Bestand und neue Fahrzeuge</span></summary>
  <div class="dossier__inhalt">
    <h3>Bestand</h3>
    ${zeilen(b.zeilen.map((z) => zeile(a(z.was), `${zahl(z.vorher)} → <b>${zahl(z.nachher)}</b>`)))}
    <h3>Neue Schiffe und Fahrzeuge</h3>
    <p class="klein">${rich(b.notiz)}</p>
  </div>
</details>`;

const chips = [
  ['#auftraege', '12 Vanduul-Aufträge'],
  ['#schiffe', 'Galaxy · Liberator'],
  ['#auec', '8 Schiffe für aUEC'],
  ['#werte', 'Radar · Salvage · Mauler'],
  ['#ausruestung', '+17 Baupläne'],
];

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Star Citizen ${j.version} · ${esc(j.codename)} · VerseBase</title>
<link rel="preload" as="image" href="/assets/patch-4-10-3/rsi/vanduul-angriff-1200.webp">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/theme.css">
<link rel="stylesheet" href="./seite.css">
</head>
<body>
<header class="leiste">
  <a class="leiste__zurueck" href="https://verse-base.com/de/archiv.html">← Archiv</a>
  <a class="leiste__logo" href="https://verse-base.com/de/">VERSE·BASE</a>
</header>
<main>
<section class="held">
  <img class="held__bild" src="/assets/patch-4-10-3/rsi/vanduul-angriff-1200.webp" srcset="/assets/patch-4-10-3/rsi/vanduul-angriff-640.webp 640w, /assets/patch-4-10-3/rsi/vanduul-angriff-1200.webp 1200w, /assets/patch-4-10-3/rsi/vanduul-angriff-1920.webp 1920w" sizes="100vw" alt="${esc(alt['rsi:vanduul-angriff'])}" fetchpriority="high">
  <div class="held__text">
    <p class="eyebrow">${esc(j.kopf.eyebrow)}</p>
    <h1>${esc(j.kopf.titel)}</h1>
    <p class="codename">${esc(j.kopf.codename[0])}<span>${esc(j.kopf.codename[1])}</span></p>
    <p class="satz">${esc(j.kopf.satz)}</p>
    <nav class="chips" aria-label="Inhalt">${chips.map(([h, t]) => `<a class="chip" href="${h}">${t}</a>`).join('')}</nav>
  </div>
</section>
${reihe({ id: 'auftraege', stand: 'Neu in 4.10.3', titel: 'Vanduul Incursion', satz: `12 Aufträge von ${a({ t: 'InterSec', h: '/missionen.html' })} in Nyx, ab Jr. Contractor bis Head Contractor. Die meisten lassen sich teilen.`, karten: auftragKarten })}
${reihe({ id: 'schiffe', stand: 'Neu in 4.10.3', titel: 'Neue Schiffe', satz: `Ein Modulschiff mit Wechselmodul und ein Träger für Schiffe und Fahrzeuge.`, karten: schiffKarten })}
${reihe({ id: 'auec', stand: 'Stand 4.10.3 · Preise vom 14.11.2026', titel: 'Jetzt für aUEC', satz: `Acht Schiffe, die schon flogen, lassen sich zum ersten Mal im Spiel kaufen. Die Zahl ist der günstigste Preis.`, karten: auecKarten, dicht: true })}
${reihe({ id: 'werte', stand: '4.10.2 → 4.10.3', titel: 'Geänderte Werte', satz: `Vorher und nachher, jede Karte führt zu den betroffenen Schiffen und Teilen.`, karten: wertKarten })}
${reihe({ id: 'ausruestung', stand: 'Neu in 4.10.3', titel: 'Ausrüstung', satz: `${a({ t: '17 neue Baupläne', h: '/crafting.html' })}. Skarnov und Raider Camo stehen beim Auftrag ${a({ t: 'Entern und Bergen', h: '#auftraege' })}.`, karten: ausKarten })}
${dossier}
</main>
<footer class="fuss">
  <nav class="fuss__nav">
    ${a({ t: `← ${j.vorgaenger.titel}`, h: j.vorgaenger.h })}
    ${a(j.notes)}
  </nav>
  <p class="fuss__recht">Bilder aus offiziellen Quellen © Cloud Imperium Games, Fan-Content-Nutzung.</p>
</footer>
</body>
</html>
`;

writeFileSync(join(hier, 'index.html'), html);
console.log(`index.html: ${html.length} Zeichen, ${(html.match(/<article class="karte"/g) || []).length} Karten`);
