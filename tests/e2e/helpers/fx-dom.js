// Steuerbares Mock-DOM fuer den FX-Gatter-Nachweis (Task 3, 01.1-01). Eigen-
// staendig — tests/e2e/helpers/dom-mock.js ist fest auf die Item-Finder-
// Element-IDs verdrahtet und wird hier bewusst NICHT erweitert.
//
// makeFxContext(opts) liefert ein Objekt, das direkt als node:vm-Kontext
// dient (vm.createContext(ctx)): alle Eigenschaften, die assets/detail.js
// als blanke Bezeichner erwartet (document, matchMedia, getComputedStyle,
// IntersectionObserver, requestAnimationFrame, addEventListener,
// innerWidth/innerHeight), liegen auf oberster Ebene. `pump(n)` und
// `dispatch(type, detail)` sind Test-Werkzeuge obendrauf — sie stoeren
// assets/detail.js nicht, weil das Skript diese Namen nie referenziert.
//
// opts:
//   fx        — 'on' | 'off' (gespeicherte Wahl, wie sie Layout.astro als
//               data-fx-Attribut vorab gesetzt haette). Default 'off'.
//   reduce    — true|false, Ergebnis von matchMedia('(prefers-reduced-motion…)').
//               Default false.
//   accent    — Hex-Farbe fuer --accent (steuert accentIsWarm() im Ember-
//               Zweig). Default ein warmer Ton, damit der Ember-Zweig in
//               den Testfaellen erreichbar ist.
//   hasStars  — true|false: liefert getElementById('stars') eine Leinwand-
//               Attrappe oder null. Default true.
export function makeFxContext(opts = {}) {
  const {
    fx = 'off',
    reduce = false,
    accent = '#ff5a1f',
    hasStars = true,
  } = opts;

  // ---- Leinwand-Attrappe: clearRect/beginPath/arc/fill sind leere
  // Funktionen, globalAlpha/fillStyle einfach beschreibbare Felder. ----
  function makeCanvasMock() {
    return {
      id: '',
      width: 0,
      height: 0,
      getContext() {
        return {
          clearRect() {},
          beginPath() {},
          arc() {},
          fill() {},
          globalAlpha: 1,
          fillStyle: '',
        };
      },
    };
  }

  const starsEl = hasStars ? makeCanvasMock() : null;
  if (starsEl) starsEl.id = 'stars';

  // ---- document.documentElement: traegt data-fx, Style-Eigenschaften
  // (fuer den entfernten --mx/--my-Fall reicht ein einfaches setProperty). ----
  const attrs = { 'data-fx': fx };
  const documentElement = {
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    style: {
      _props: {},
      setProperty(name, value) {
        this._props[name] = value;
      },
    },
  };

  // ---- document.addEventListener sammelt Horcher pro Ereignistyp;
  // dispatch(type, detail) ruft sie synchron mit { detail } auf. ----
  const docListeners = new Map();
  function docAddEventListener(type, fn) {
    if (!docListeners.has(type)) docListeners.set(type, []);
    docListeners.get(type).push(fn);
  }
  function dispatch(type, detail) {
    const fns = docListeners.get(type) || [];
    fns.slice().forEach((fn) => fn({ detail }));
  }

  const document = {
    documentElement,
    body: { appendChild() {} },
    getElementById(id) {
      if (id === 'stars') return starsEl;
      return null; // 'topbar', 'lb' u.a. — existieren in diesem Testkontext nicht
    },
    createElement(tag) {
      if (tag === 'canvas') return makeCanvasMock();
      return { style: {}, setAttribute() {}, getAttribute() { return null; }, appendChild() {} };
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener: docAddEventListener,
  };

  // ---- requestAnimationFrame: zaehlt statt sofort zu rufen, legt den
  // Rueckruf in eine Warteschlange. pump(n) arbeitet bis zu n davon ab —
  // so lassen sich "laeuft weiter" und "ist beendet" unterscheiden, ohne
  // echte Zeit zu verbrauchen. ----
  let calls = 0;
  const queue = [];
  function requestAnimationFrame(cb) {
    calls += 1;
    queue.push(cb);
    return calls;
  }
  function pump(n) {
    for (let i = 0; i < n && queue.length; i++) {
      const cb = queue.shift();
      cb(0);
    }
  }

  function matchMedia(query) {
    return {
      matches: /reduced-motion/.test(query) ? !!reduce : false,
      addEventListener() {},
      addListener() {},
    };
  }

  function getComputedStyle() {
    return {
      getPropertyValue(name) {
        if (name === '--accent') return accent;
        if (name === '--accent-2') return '#d4af37';
        return '';
      },
    };
  }

  class IntersectionObserver {
    observe() {}
    unobserve() {}
  }

  return {
    // Von assets/detail.js als blanke Bezeichner erwartet:
    document,
    documentElement,
    matchMedia,
    getComputedStyle,
    IntersectionObserver,
    requestAnimationFrame,
    addEventListener() {}, // Fensterebene (scroll/resize/keydown) — reines No-op
    innerWidth: 1024,
    innerHeight: 768,
    console,
    // Test-Werkzeuge:
    get calls() {
      return calls;
    },
    pump,
    dispatch,
  };
}
