// Steuerbares Mock-DOM fuer den Komponenten-Filter-Nachweis der Schiffsliste
// (Phase 7, Plan 03). Eigenstaendig — tests/e2e/helpers/dom-mock.js ist fest
// auf die Item-Finder-Element-Ids (uif-*) verdrahtet und wird hier bewusst
// NICHT erweitert; die Element-Klasse (MockElement) wird aber wiederverwendet,
// soweit ihre API traegt (getAttribute/setAttribute/appendChild/
// addEventListener/dispatchEvent/querySelectorAll/value/textContent/style).
//
// makeShipsDomContext() liefert ein Objekt, das direkt als node:vm-Kontext
// dient (vm.createContext(ctx)): `document` liegt auf oberster Ebene, weil
// src/components/ships/ShipsOverview.astro sein Inline-Skript genau so
// referenziert (blanke Bezeichner, kein `window.`-Praefix). Alle 227
// Schiffs-Ids aus src/data/ship-hardpoints.json werden zu
// `<article class="fcard">`-Attrappen mit deterministisch abgeleiteten
// data-*-Attributen und einem echten data-comp-Wert aus
// src/data/ship-components.json.
//
// EINE Quelle, zwei Sprachen: seit Phase 6 teilen sich /schiffe.html und
// /de/schiffe.html EINEN Koerper. Die Sprache steckt nicht mehr im Skript,
// sondern in drei data-*-Beschriftungen am Flottencontainer
// (data-results-label/data-nodata-label/data-andup-label) — genau die setzt
// opts.lang hier, damit derselbe Skriptrumpf in beiden Sprachen geprueft
// werden kann.
//
// WICHTIG: die Kodierregel fuer data-comp (Kategorie-Buchstabe + Groesse,
// Sentinel "-" bei fehlenden Steckplatz-Daten) steht hier ABSICHTLICH ein
// zweites Mal, unabhaengig von src/lib/shipComponents.ts::compAttr(). Ein
// Test darf nicht dieselbe Funktion pruefen, mit der er seine eigene
// Erwartung bildet — sonst faellt ein Fehler in compAttr() selbst nie auf.
// Die SSR-Seite der Kodierung (dass `compAttr(id)` tatsaechlich im
// ausgelieferten HTML landet) decken die Bau-Pruefungen der Plaene ab.
import fs from 'node:fs';
import path from 'node:path';
import { MockElement } from './dom-mock.js';

const CAT_ORDER = 'wtmscpqr';

// Beschriftungen wie in ShipsOverview.astro — hier zweitgeschrieben, damit der
// Test nicht dieselbe Quelle als Erwartung benutzt, die er prueft.
const LABELS = {
  en: { results: 'results', nodata: 'without slot data', andup: 'S{n} and up' },
  de: { results: 'Treffer', nodata: 'ohne Steckplatz-Daten', andup: 'ab S{n}' },
};

// Zweite, unabhaengige Kodierung -- siehe Kopfkommentar oben.
function encodeComp(entry) {
  if (!entry) return '-';
  let out = '';
  for (const letter of CAT_ORDER) {
    const size = entry[letter];
    if (size == null) continue;
    out += letter + (size >= 10 ? 'X' : String(size));
  }
  return out || '_';
}

// <select id="sf-compsize"> braucht mehr als die generische MockElement-API:
// das Inline-Skript ruft `.options.length` und `.remove(index)` auf (native
// HTMLSelectElement-Methoden), um die Groessenliste beim Wechsel der
// Bauteilart neu aufzubauen.
class MockSelectElement extends MockElement {
  constructor(id) {
    super('select', id);
  }
  get options() {
    return this.children;
  }
  remove(index) {
    const el = this.children[index];
    if (el) {
      this.children.splice(index, 1);
      el.parentNode = null;
    }
  }
}

// opts.lang: 'en' | 'de' -- setzt die drei Beschriftungen am Flottencontainer
// und den server-gerenderten Ausgangstext des Zaehlers. Das Inline-Skript ruft
// apply() beim Start NICHT selbst auf; es reagiert nur auf spaetere Eingaben.
export function makeShipsDomContext(opts = {}) {
  const lang = opts.lang === 'de' ? 'de' : 'en';
  const L = LABELS[lang];
  const hp = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-hardpoints.json'), 'utf8'));
  const comp = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-components.json'), 'utf8'));
  const ids = Object.keys(hp.ships);

  const elements = {
    'sf-q': new MockElement('input', 'sf-q'),
    'sf-maker': new MockElement('select', 'sf-maker'),
    'sf-career': new MockElement('select', 'sf-career'),
    'sf-rolefam': new MockElement('select', 'sf-rolefam'),
    // Phase 6 belegt sf-size mit der Schiffs-Groessenklasse — NICHT mit der
    // Bauteilgroesse. Die heisst sf-compsize.
    'sf-size': new MockElement('select', 'sf-size'),
    'sf-sig': new MockElement('select', 'sf-sig'),
    'sf-feat': new MockElement('select', 'sf-feat'),
    'sf-sort': new MockElement('select', 'sf-sort'),
    'sf-comp': new MockElement('select', 'sf-comp'),
    'sf-compsize': new MockSelectElement('sf-compsize'),
    'sf-count': new MockElement('span', 'sf-count'),
    'sf-empty': new MockElement('p', 'sf-empty'),
    'sf-fleet': new MockElement('div', 'sf-fleet'),
  };
  // sf-compsize traegt im ausgelieferten HTML genau einen Leereintrag plus das
  // disabled-Attribut, bevor eine Bauteilart gewaehlt ist (D-11).
  const emptySizeOpt = new MockElement('option');
  emptySizeOpt.setAttribute('value', '');
  elements['sf-compsize'].appendChild(emptySizeOpt);
  elements['sf-compsize'].disabled = true;
  // Die Sprache steckt am Flottencontainer, nicht im Skript.
  elements['sf-fleet'].setAttribute('data-results-label', L.results);
  elements['sf-fleet'].setAttribute('data-nodata-label', L.nodata);
  elements['sf-fleet'].setAttribute('data-andup-label', L.andup);
  // Server-gerenderter Ausgangstext des Zaehlers (siehe Kommentar oben).
  elements['sf-count'].textContent = `${ids.length} ${L.results}`;

  // Deterministisch abgeleitete Werte je Karte -- reichen aus, um die
  // Zusammenarbeit mit den bestehenden Feldern zu pruefen (D-12), ohne die
  // echten vehicles.json-Daten laden zu muessen.
  const CAREERS = ['combat', 'transport', 'exploration', 'industry'];
  const FAMS = ['fighter', 'freighter', 'explorer', 'salvage'];
  const cardsById = {};
  ids.forEach((id, idx) => {
    const card = new MockElement('article', '', 'fcard');
    const maker = id.split('-')[0];
    card.setAttribute('data-q', id);
    card.setAttribute('data-maker', maker);
    card.setAttribute('data-career', CAREERS[idx % CAREERS.length]);
    card.setAttribute('data-rolefam', ` ${FAMS[idx % FAMS.length]} `);
    card.setAttribute('data-size', String((idx % 6) + 1));
    card.setAttribute('data-sig', String(-1));
    card.setAttribute('data-feat', idx % 2 === 0 ? ' cargo ' : ' ground ');
    card.setAttribute('data-href', '/schiffe/' + id + '.html');
    card.setAttribute('data-pledge', String(-1));
    card.setAttribute('data-game', String(-1));
    card.setAttribute('data-cargo', String(-1));
    card.setAttribute('data-crew', String(-1));
    card.setAttribute('data-comp', encodeComp(comp.ships[id]));
    elements['sf-fleet'].appendChild(card);
    cardsById[id] = card;
  });

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },
    createElement(tag) {
      return new MockElement(tag);
    },
    querySelectorAll() {
      return [];
    },
  };

  return {
    document,
    location: { href: '' },
    console,
    // Test-Werkzeuge (nicht vom Inline-Skript referenziert):
    elements,
    cardsById,
    ids,
    labels: L,
    hardpoints: hp,
    components: comp,
  };
}

export { encodeComp, CAT_ORDER, LABELS };
