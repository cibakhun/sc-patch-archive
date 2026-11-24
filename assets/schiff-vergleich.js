// schiff-vergleich.js — Schiffe nebeneinander vergleichen, auf der Schiffsliste.
//
// Bis zu drei Schiffe markieren, ab zwei oeffnet "Vergleichen" eine Tabelle:
// eine Spalte je Schiff, das erste ist die Basis, unter jedem Wert die
// Abweichung zur Basis, eingefaerbt nach besser oder schlechter. Zeilen,
// Einheiten und die Richtung von "besser" stehen in der Datei, die der
// Vergleich beim ersten Oeffnen holt (/schiffe-vergleich.json bzw.
// /de/schiffe-vergleich.json); hier steht keine eigene Liste der Kennwerte.
//
// Die Auswahl steht in der Adresse (?cmp=a,b, offen mit &view=compare), ein
// Vergleich ist damit ein Link. Die Filter der Liste schreiben ihre eigenen
// Schluessel und lassen diese stehen, und umgekehrt.
//
// Beim Import keine Seiteneffekte: die reinen Funktionen laufen in node
// (tests/e2e/schiff-vergleich.test.js), start(document) verdrahtet die Seite.

export const MAX_COMPARE = 3;

/**
 * Auswahl aus der Adresse: bekannte Ids, ohne Doppel, hoechstens drei;
 * offen nur ab zwei Schiffen.
 *   leseVergleich('?cmp=aegs-gladius,anvl-arrow&view=compare', ids)
 *   -> { cmp: ['aegs-gladius', 'anvl-arrow'], offen: true }
 * @param {string} search @param {ReadonlySet<string>} ids
 */
export function leseVergleich(search, ids) {
  const p = new URLSearchParams(search || '');
  const cmp = [...new Set((p.get('cmp') || '').split(',').map((s) => s.trim()).filter((id) => ids.has(id)))].slice(0, MAX_COMPARE);
  return { cmp, offen: p.get('view') === 'compare' && cmp.length >= 2 };
}

/**
 * Schreibt cmp und view in eine Adresse und laesst alle anderen Schluessel
 * stehen. Ergebnis mit '?' oder leer.
 *   schreibeVergleich('?maker=Anvil', ['a', 'b'], true) === '?maker=Anvil&cmp=a%2Cb&view=compare'
 * @param {string} search @param {readonly string[]} cmp @param {boolean} offen
 */
export function schreibeVergleich(search, cmp, offen) {
  const p = new URLSearchParams(search || '');
  if (cmp.length) p.set('cmp', cmp.join(','));
  else p.delete('cmp');
  if (offen && cmp.length >= 2) p.set('view', 'compare');
  else p.delete('view');
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Markieren und Entmarkieren. Volle Auswahl nimmt nichts mehr auf.
 *   umschalten(['a', 'b', 'c'], 'd') -> { cmp: ['a', 'b', 'c'], voll: true }
 * @param {readonly string[]} cmp @param {string} id
 */
export function umschalten(cmp, id) {
  if (cmp.includes(id)) return { cmp: cmp.filter((x) => x !== id), voll: false };
  if (cmp.length >= MAX_COMPARE) return { cmp: [...cmp], voll: true };
  return { cmp: [...cmp, id], voll: false };
}

/** Ein Schiff wird Basis: es rueckt an die erste Stelle, die anderen behalten ihre Folge. */
export const alsBasis = (cmp, id) => (cmp.includes(id) ? [id, ...cmp.filter((x) => x !== id)] : [...cmp]);

const roundTo = (x, digits) => Math.round(x * 10 ** digits) / 10 ** digits;
const withUnit = (s, unit) => (unit ? `${s} ${unit}` : s);

/**
 * Ein Kennwert in Genauigkeit und Einheit seiner Zeile; unbekannt ist der Strich.
 *   figureText(29760, { digits: 0, unit: 'HP' }, 'de-DE') === '29.760 HP'
 * @param {number|null|undefined} x @param {{ digits: number, unit: string }} row @param {string} loc
 */
export function figureText(x, row, loc) {
  return x == null ? '–' : withUnit(new Intl.NumberFormat(loc).format(roundTo(x, row.digits)), row.unit);
}

/**
 * Zelle mit Abweichung zur Basis. tone: 'up' besser, 'down' schlechter,
 * 'flat' anders ohne Richtung (Laenge, Masse); keine Abweichung ohne Basis
 * oder ohne beide Werte.
 *   compareCell(1150, 1193, { digits: 0, unit: 'm/s', better: 1 }, 'en-US')
 *   -> { value: '1,150 m/s', delta: '-43 m/s', tone: 'down' }
 * @param {number|null|undefined} value @param {number|null|undefined} base
 * @param {{ digits: number, unit: string, better: number }} row @param {string} loc
 */
export function compareCell(value, base, row, loc) {
  const out = { value: figureText(value, row, loc), delta: null, tone: null };
  if (value == null || base == null) return out;
  const d = roundTo(value - base, row.digits);
  if (d === 0) return out;
  out.delta = withUnit(new Intl.NumberFormat(loc, { signDisplay: 'exceptZero' }).format(d), row.unit);
  out.tone = row.better === 0 ? 'flat' : Math.sign(d) === row.better ? 'up' : 'down';
  return out;
}

/**
 * Hat eines der Schiffe einen Wert in dieser Zeile? Zeilen und Abschnitte
 * ohne jeden Wert blendet die Tabelle aus (ein Jaeger gegen einen Frachter
 * braucht keine Zeile "Mining-Laser").
 * @param {{ art: string, key: string }} z @param {readonly object[]} schiffe
 */
export function zeileHatWert(z, schiffe) {
  return schiffe.some((s) => {
    if (z.art === 'text') return !!s.text?.[z.key];
    if (z.art === 'zahl') return s.zahl?.[z.key] != null;
    return !!s.teile?.[z.key]?.length;
  });
}

/**
 * Eine Teilezeile wie im Datenblatt: "2× S3", dann der Name; ohne Anzahl
 * (eine Notiz) nur der Text.
 *   teilKopf([2, 'S3', 'CF-337 Panther Repeater']) === '2× S3'
 * @param {[number, string, string]} t
 */
export function teilKopf(t) {
  if (!t[0]) return '';
  return `${t[0]}×${t[1] ? ` ${t[1]}` : ''}`;
}

/* ---------------- Seite ---------------- */

function el(doc, tag, attrs, ...kids) {
  const n = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}

/** @param {Document} doc */
export function start(doc) {
  const root = doc.getElementById('sv');
  const fleet = doc.getElementById('sf-fleet');
  if (!root || !fleet) return;
  const win = doc.defaultView;
  const loc = doc.documentElement.lang === 'de' ? 'de-DE' : 'en-US';
  const m = root.dataset;
  const $ = (id) => doc.getElementById(id);
  const tray = $('sv-tray');
  const trayList = $('sv-tray-list');
  const hint = $('sv-tray-hint');
  const openBtn = $('sv-open');
  const clearBtn = $('sv-clear');
  const dlg = $('sv-dlg');
  const table = $('sv-table');
  const jump = $('sv-jump');
  const wait = $('sv-wait');
  const scroll = $('sv-scroll');

  const karten = new Map();
  for (const c of fleet.querySelectorAll('.fcard[data-id]')) karten.set(c.dataset.id, c);
  const ids = new Set(karten.keys());
  const name = (id) => karten.get(id)?.querySelector('.fcard__name')?.textContent.trim() || id;

  let { cmp, offen } = leseVergleich(win.location.search, ids);
  let daten = null;
  let laden = null;
  let vollTimer = 0;

  const adresse = () => {
    const qs = schreibeVergleich(win.location.search, cmp, offen);
    try {
      win.history.replaceState(win.history.state, '', win.location.pathname + qs + (win.location.hash || ''));
    } catch { /* Safari drosselt replaceState bei sehr vielen Aufrufen */ }
  };

  const holen = () => {
    if (!laden) {
      laden = win.fetch(m.src, { credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then((j) => (daten = j))
        .catch((e) => {
          laden = null;
          throw e;
        });
    }
    return laden;
  };

  function malKarten() {
    for (const [id, c] of karten) {
      const b = c.querySelector('.fcard__cmp');
      if (!b) continue;
      const an = cmp.includes(id);
      b.setAttribute('aria-pressed', String(an));
      c.classList.toggle('is-cmp', an);
    }
  }

  function malLeiste(voll) {
    tray.hidden = !cmp.length;
    doc.body.classList.toggle('has-sv-tray', cmp.length > 0);
    trayList.replaceChildren(...cmp.map((id) => el(doc, 'li', {},
      el(doc, 'span', { text: name(id) }),
      el(doc, 'button', { type: 'button', class: 'sv-x', 'data-sv-remove': id, 'aria-label': m.remove.replace('{name}', name(id)), text: '×' }),
    )));
    hint.textContent = voll ? m.full : cmp.length === 1 ? m.hint : '';
    hint.hidden = !hint.textContent;
    openBtn.hidden = cmp.length < 2;
    openBtn.textContent = m.open.replace('{n}', String(cmp.length));
  }

  function malTabelle() {
    if (!daten) return;
    const schiffe = cmp.map((id) => daten.schiffe[id]).filter(Boolean);
    const base = schiffe[0];
    const f = doc.activeElement;
    const wieder = f && dlg.contains(f) && f.dataset.svBase ? `[data-sv-base="${f.dataset.svBase}"]` : null;

    const kopf = el(doc, 'tr', {}, el(doc, 'th', { scope: 'col' }, el(doc, 'span', { class: 'sv-sr', text: m.stat })));
    cmp.forEach((id, i) => {
      const s = daten.schiffe[id];
      if (!s) return;
      kopf.append(el(doc, 'th', { scope: 'col', class: i === 0 ? 'is-base' : null },
        el(doc, 'button', { type: 'button', class: 'sv-name', 'data-sv-base': id, 'aria-pressed': String(i === 0), title: i === 0 ? null : m.makebase, text: s.name }),
        el(doc, 'small', { class: 'sv-maker', text: s.maker }),
        // Das Basis-Schild haelt in jeder Spalte seinen Platz, sonst stehen
        // die Namen der Spalten auf verschiedener Hoehe.
        el(doc, 'span', { class: i === 0 ? 'sv-badge' : 'sv-badge is-leer', 'aria-hidden': i === 0 ? null : 'true', text: m.base }),
        el(doc, 'span', { class: 'sv-acts' },
          el(doc, 'a', { href: s.href, text: m.sheet }),
          el(doc, 'button', { type: 'button', class: 'sv-x', 'data-sv-remove': id, 'aria-label': m.remove.replace('{name}', s.name), text: '×' })),
      ));
    });
    const teile = [el(doc, 'thead', {}, kopf)];
    const spr = [];
    for (const a of daten.abschnitte) {
      const zeilen = a.zeilen.filter((z) => zeileHatWert(z, schiffe));
      if (!zeilen.length) continue;
      const body = el(doc, 'tbody', { 'data-sec': a.key },
        el(doc, 'tr', { class: 'sv-sec' }, el(doc, 'th', { scope: 'rowgroup', colspan: schiffe.length + 1, id: `sv-sec-${a.key}`, text: a.label })));
      for (const z of zeilen) {
        const tr = el(doc, 'tr', {}, el(doc, 'th', { scope: 'row', text: z.label }));
        schiffe.forEach((s, i) => {
          const cls = i === 0 ? 'is-base' : null;
          if (z.art === 'text') {
            tr.append(el(doc, 'td', { class: cls }, el(doc, 'span', { class: 'sv-v', text: s.text?.[z.key] || '–' })));
          } else if (z.art === 'zahl') {
            const c = compareCell(s.zahl?.[z.key], i === 0 ? null : base.zahl?.[z.key], z, loc);
            const td = el(doc, 'td', { class: cls }, el(doc, 'span', { class: 'sv-v', text: c.value }));
            if (c.delta) {
              const wort = c.tone === 'up' ? m.better : c.tone === 'down' ? m.worse : null;
              td.append(el(doc, 'span', { class: `sv-delta is-${c.tone}` }, c.delta, wort ? el(doc, 'span', { class: 'sv-sr', text: ` ${wort}` }) : null));
            }
            tr.append(td);
          } else {
            const list = s.teile?.[z.key] ?? [];
            tr.append(el(doc, 'td', { class: cls },
              ...(list.length
                ? list.map((t) => el(doc, 'span', { class: 'sv-hp' }, teilKopf(t) ? el(doc, 'b', { text: teilKopf(t) }) : null, teilKopf(t) ? ' ' : null, el(doc, 'span', { text: t[2] })))
                : [el(doc, 'span', { class: 'sv-v', text: '–' })])));
          }
        });
        body.append(tr);
      }
      teile.push(body);
      spr.push(el(doc, 'a', { href: `#sv-sec-${a.key}`, 'data-sv-jump': a.key, text: a.label }));
    }
    table.replaceChildren(...teile);
    jump.replaceChildren(...spr);
    if (wieder) (dlg.querySelector(wieder) || $('sv-close')).focus();
  }

  function oeffnen() {
    if (cmp.length < 2) return;
    offen = true;
    adresse();
    if (!dlg.open) dlg.showModal();
    if (daten) {
      wait.hidden = true;
      malTabelle();
      return;
    }
    wait.hidden = false;
    wait.textContent = m.loading;
    holen().then(() => {
      wait.hidden = true;
      malTabelle();
    }, () => {
      wait.textContent = m.error;
    });
  }

  function setze(neu, voll = false) {
    cmp = neu;
    if (cmp.length < 2 && dlg.open) dlg.close();
    if (cmp.length < 2) offen = false;
    adresse();
    malKarten();
    malLeiste(voll);
    if (dlg.open) malTabelle();
  }

  fleet.addEventListener('click', (e) => {
    const b = e.target.closest('.fcard__cmp');
    if (!b) return;
    e.stopPropagation();
    const card = b.closest('.fcard');
    const r = umschalten(cmp, card.dataset.id);
    setze(r.cmp, r.voll);
    if (r.voll) {
      win.clearTimeout(vollTimer);
      vollTimer = win.setTimeout(() => malLeiste(false), 4000);
    }
    // Vorladen, sobald ein Vergleich absehbar ist.
    if (cmp.length >= 2) holen().catch(() => {});
  }, true);

  const entfernen = (e) => {
    const x = e.target.closest('[data-sv-remove]');
    if (!x) return false;
    const id = x.getAttribute('data-sv-remove');
    setze(cmp.filter((c) => c !== id));
    return true;
  };
  tray.addEventListener('click', entfernen);
  openBtn.addEventListener('click', oeffnen);
  clearBtn.addEventListener('click', () => setze([]));
  $('sv-close').addEventListener('click', () => dlg.close());
  // Den Fokus gibt der Browser beim Schliessen selbst an den Oeffner zurueck.
  dlg.addEventListener('close', () => {
    offen = false;
    adresse();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) { dlg.close(); return; }
    if (entfernen(e)) {
      if (dlg.open) (dlg.querySelector('.sv-name') || $('sv-close')).focus();
      return;
    }
    const b = e.target.closest('[data-sv-base]');
    if (b) { setze(alsBasis(cmp, b.getAttribute('data-sv-base'))); return; }
    const j = e.target.closest('[data-sv-jump]');
    if (j) {
      e.preventDefault();
      const ziel = dlg.querySelector(`tbody[data-sec="${j.getAttribute('data-sv-jump')}"]`);
      // Ein ausdrueckliches behavior uebergeht die CSS-Regel fuer reduzierte
      // Bewegung, also hier selbst fragen.
      const ruhig = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (ziel) scroll.scrollTo({ top: ziel.offsetTop - (table.tHead?.offsetHeight ?? 0), behavior: ruhig ? 'auto' : 'smooth' });
    }
  });

  malKarten();
  malLeiste(false);
  if (offen) oeffnen();
}
