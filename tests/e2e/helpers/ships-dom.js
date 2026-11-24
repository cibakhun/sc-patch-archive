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
  en: { results: 'results', nodata: 'without slot data', andup: 'S{n} and up', any: 'Any size', off: 'Pick a component first', show: 'Show {n} results', none: 'No matches' },
  de: { results: 'Treffer', nodata: 'ohne Steckplatz-Daten', andup: 'ab S{n}', any: 'Beliebige Größe', off: 'Erst Bauteil wählen', show: '{n} Treffer anzeigen', none: 'Keine Treffer' },
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

// Der Flottencontainer muss Karten umhaengen koennen (sort() ruft
// fleet.insertBefore(karte, leerHinweis)) — die generische MockElement-API
// kennt nur appendChild.
class MockFleetElement extends MockElement {
  constructor(id) {
    super('div', id);
  }
  insertBefore(child, ref) {
    const alt = this.children.indexOf(child);
    if (alt !== -1) this.children.splice(alt, 1);
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at === -1) this.children.push(child);
    else this.children.splice(at, 0, child);
    child.parentNode = this;
    return child;
  }
}

// Auswahlfeld mit echten <option>-Kindern: das Inline-Skript prueft beim
// Lesen der Adresse, ob ein Wert als Option existiert (unbekannte Werte
// fallen auf den Ausgangswert zurueck).
function selectMit(id, values) {
  const sel = new MockSelectElement(id);
  for (const v of values) {
    const o = new MockElement('option');
    o.value = v;
    sel.appendChild(o);
  }
  sel.value = values[0] ?? '';
  return sel;
}

// Sortierschluessel wie in ShipsOverview.astro — zweitgeschrieben (siehe oben).
const SORT_KEYS = ['name', 'pledge', 'pledge-asc', 'game', 'game-asc', 'cargo', 'crew'];

// opts.lang: 'en' | 'de' -- setzt die drei Beschriftungen am Flottencontainer
// und den server-gerenderten Ausgangstext des Zaehlers.
// opts.search: Adresszusatz beim Laden ('?maker=orig&sort=game-asc'). Das
// Skript liest ihn einmal und filtert/sortiert nur, wenn er etwas verlangt.
// Jede spaetere Aenderung schreibt es per history.replaceState zurueck; der
// Nachbau haelt location.search nach und merkt sich jeden Aufruf (ctx.urls).
export function makeShipsDomContext(opts = {}) {
  const lang = opts.lang === 'de' ? 'de' : 'en';
  const L = LABELS[lang];
  const hp = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-hardpoints.json'), 'utf8'));
  const comp = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-components.json'), 'utf8'));
  const ids = Object.keys(hp.ships);

  const CAREERS = ['combat', 'transport', 'exploration', 'industry'];
  const FAMS = ['fighter', 'freighter', 'explorer', 'salvage'];
  const makers = [...new Set(ids.map((id) => id.split('-')[0]))].sort();
  const elements = {
    'sf-q': new MockElement('input', 'sf-q'),
    'sf-maker': selectMit('sf-maker', ['', ...makers]),
    'sf-career': selectMit('sf-career', ['', ...CAREERS]),
    'sf-rolefam': selectMit('sf-rolefam', ['', ...FAMS]),
    // Phase 6 belegt sf-size mit der Schiffs-Groessenklasse — NICHT mit der
    // Bauteilgroesse. Die heisst sf-compsize.
    'sf-size': selectMit('sf-size', ['', '1', '2', '3', '4', '5', '6']),
    'sf-sig': selectMit('sf-sig', ['', '1', '2']),
    'sf-feat': selectMit('sf-feat', ['', 'cargo', 'ground']),
    'sf-sort': selectMit('sf-sort', SORT_KEYS),
    'sf-comp': selectMit('sf-comp', ['', ...CAT_ORDER]),
    'sf-compsize': new MockSelectElement('sf-compsize'),
    'sf-count': new MockElement('span', 'sf-count'),
    'sf-empty': new MockElement('p', 'sf-empty'),
    'sf-fleet': new MockFleetElement('sf-fleet'),
    // Filter-Schublade bis 820 px (UX-Audit TF V26/M4)
    'sf-mehr': new MockElement('div', 'sf-mehr', 'sdb__mehr'),
    'sf-toggle': new MockElement('button', 'sf-toggle'),
    'sf-close': new MockElement('button', 'sf-close'),
    'sf-show': new MockElement('button', 'sf-show'),
    'sf-reset': new MockElement('button', 'sf-reset'),
    // Knopf in der leeren Liste (Heuristik P18)
    'sf-empty-reset': new MockElement('button', 'sf-empty-reset'),
  };
  elements['sf-toggle'].setAttribute('aria-expanded', 'false');
  elements['sf-show'].setAttribute('data-tpl', L.show);
  elements['sf-show'].setAttribute('data-none', L.none);
  elements['sf-show'].textContent = L.show.replace('{n}', String(ids.length));
  // sf-compsize traegt im ausgelieferten HTML genau einen Leereintrag plus das
  // disabled-Attribut, bevor eine Bauteilart gewaehlt ist (D-11).
  const emptySizeOpt = new MockElement('option');
  emptySizeOpt.setAttribute('value', '');
  elements['sf-compsize'].appendChild(emptySizeOpt);
  elements['sf-compsize'].disabled = true;
  // Leereintrag nennt den Grund, solange das Feld gesperrt ist (HE B30).
  elements['sf-compsize'].setAttribute('data-any', L.any);
  elements['sf-compsize'].setAttribute('data-off', L.off);
  emptySizeOpt.textContent = L.off;
  // Die Sprache steckt am Flottencontainer, nicht im Skript.
  elements['sf-fleet'].setAttribute('data-results-label', L.results);
  elements['sf-fleet'].setAttribute('data-nodata-label', L.nodata);
  elements['sf-fleet'].setAttribute('data-andup-label', L.andup);
  // Server-gerenderter Ausgangstext des Zaehlers (siehe Kommentar oben).
  elements['sf-count'].textContent = `${ids.length} ${L.results}`;

  // Deterministisch abgeleitete Werte je Karte -- reichen aus, um die
  // Zusammenarbeit mit den bestehenden Feldern zu pruefen (D-12), ohne die
  // echten vehicles.json-Daten laden zu muessen.
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
  // Der Leerhinweis steht im echten HTML als letztes Kind des Containers.
  elements['sf-fleet'].appendChild(elements['sf-empty']);

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

  const location = { href: '', pathname: '/schiffe.html', search: opts.search || '', hash: '' };
  const urls = [];
  const history = {
    state: null,
    replaceState(state, _title, url) {
      urls.push(url);
      const ohneHash = String(url).replace(/#.*$/, '');
      const i = ohneHash.indexOf('?');
      location.search = i === -1 ? '' : ohneHash.slice(i);
    },
  };

  return {
    document,
    location,
    history,
    URLSearchParams,
    console,
    urls,
    // Test-Werkzeuge (nicht vom Inline-Skript referenziert):
    elements,
    cardsById,
    ids,
    labels: L,
    hardpoints: hp,
    components: comp,
  };
}

export { encodeComp, CAT_ORDER, LABELS, SORT_KEYS };
