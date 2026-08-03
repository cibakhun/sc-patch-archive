// Steuerbares Mock-DOM fuer den Komponenten-Filter-Nachweis der Schiffsliste
// (Phase 5, Plan 03). Eigenstaendig — tests/e2e/helpers/dom-mock.js ist fest
// auf die Item-Finder-Element-Ids (uif-*) verdrahtet und wird hier bewusst
// NICHT erweitert; die Element-Klasse (MockElement) wird aber wiederverwendet,
// soweit ihre API traegt (getAttribute/setAttribute/appendChild/
// addEventListener/dispatchEvent/querySelectorAll/value/textContent/style).
//
// makeShipsDomContext() liefert ein Objekt, das direkt als node:vm-Kontext
// dient (vm.createContext(ctx)): `document` und `location` liegen auf
// oberster Ebene, weil src/pages/schiffe.astro und src/pages/de/schiffe.astro
// ihr Inline-Skript genau so referenzieren (blanke Bezeichner, kein
// `window.`-Praefix). Alle 227 Schiffs-Ids aus src/data/ship-hardpoints.json
// werden zu `<article class="fcard">`-Attrappen mit deterministisch
// abgeleiteten data-*-Attributen (Hersteller/Typ/Status/Archiv) und einem
// echten data-comp-Wert aus src/data/ship-components.json.
//
// WICHTIG: die Kodierregel fuer data-comp (Kategorie-Buchstabe + Groesse,
// Sentinel "-" bei fehlenden Steckplatz-Daten) steht hier ABSICHTLICH ein
// zweites Mal, unabhaengig von src/lib/shipComponents.ts::compAttr(). Ein
// Test darf nicht dieselbe Funktion pruefen, mit der er seine eigene
// Erwartung bildet — sonst faellt ein Fehler in compAttr() selbst nie auf.
// Die SSR-Seite der Kodierung (dass `compAttr(id)` tatsaechlich im
// ausgelieferten HTML landet) wird stattdessen von den Bau-Pruefungen der
// Plaene 05-01 und 05-03 abgedeckt (Regex-Zaehlung gegen dist/*.html).
import fs from 'node:fs';
import path from 'node:path';
import { MockElement } from './dom-mock.js';

const CAT_ORDER = 'wtmscpqr';

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

// <select id="sf-size"> braucht mehr als die generische MockElement-API:
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

// opts.lang: 'en' | 'de' -- steuert NUR den anfaenglichen Zaehlertext
// (`sf-count`), weil der server-gerenderte Text ("N results" / "N Treffer")
// beim Laden bereits steht -- das Inline-Skript ruft apply() beim Start NICHT
// selbst auf, es reagiert nur auf spaetere Eingaben.
export function makeShipsDomContext(opts = {}) {
  const lang = opts.lang === 'de' ? 'de' : 'en';
  const hp = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-hardpoints.json'), 'utf8'));
  const comp = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-components.json'), 'utf8'));
  const ids = Object.keys(hp.ships);

  const elements = {
    'sf-q': new MockElement('input', 'sf-q'),
    'sf-maker': new MockElement('select', 'sf-maker'),
    'sf-type': new MockElement('select', 'sf-type'),
    'sf-status': new MockElement('select', 'sf-status'),
    'sf-archive': new MockElement('select', 'sf-archive'),
    'sf-sort': new MockElement('select', 'sf-sort'),
    'sf-comp': new MockElement('select', 'sf-comp'),
    'sf-size': new MockSelectElement('sf-size'),
    'sf-count': new MockElement('span', 'sf-count'),
    'sf-empty': new MockElement('p', 'sf-empty'),
    'sf-fleet': new MockElement('div', 'sf-fleet'),
  };
  // sf-size traegt im ausgelieferten HTML genau einen Leereintrag plus das
  // disabled-Attribut, bevor eine Bauteilart gewaehlt ist (D-11).
  const emptySizeOpt = new MockElement('option');
  emptySizeOpt.setAttribute('value', '');
  elements['sf-size'].appendChild(emptySizeOpt);
  elements['sf-size'].disabled = true;
  // Server-gerenderter Ausgangstext des Zaehlers (siehe Kommentar oben).
  elements['sf-count'].textContent = lang === 'de' ? `${ids.length} Treffer` : `${ids.length} results`;

  // Deterministisch abgeleitete Werte je Karte -- reichen aus, um die
  // Zusammenarbeit mit den bestehenden Feldern zu pruefen (D-12), ohne die
  // echten vehicles.json-Daten laden zu muessen.
  const TYPES = ['Fighter', 'Freighter', 'Explorer', 'Industrial'];
  const STATUSES = ['flight-ready', 'in-production', 'in-concept'];
  const cardsById = {};
  ids.forEach((id, idx) => {
    const card = new MockElement('article', '', 'fcard');
    const maker = id.split('-')[0];
    card.setAttribute('data-q', id);
    card.setAttribute('data-maker', maker);
    card.setAttribute('data-type', TYPES[idx % TYPES.length]);
    card.setAttribute('data-status', STATUSES[idx % STATUSES.length]);
    card.setAttribute('data-archive', idx % 2 === 0 ? '1' : '');
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
  };

  return {
    document,
    location: { href: '' },
    console,
    // Test-Werkzeuge (nicht vom Inline-Skript referenziert):
    elements,
    cardsById,
    ids,
    hardpoints: hp,
    components: comp,
  };
}

export { encodeComp, CAT_ORDER };
