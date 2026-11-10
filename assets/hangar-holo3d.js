// Stationen als Hologramme in der Halle (ROADMAP Phase 22, H1; Entwürfe
// Boards 5 bis 7, Freigabe Krisz 10.11.2026: „okay baus mal“).
//
// Der Viewer (assets/hangar-viewer.js) lädt dieses Modul erst, wenn die Seite
// eine Station mit 3D-Ansicht zeigt (opts.holo.module), und reicht ihm seine
// Bühne: Szene, Kamera, Ruhelage des Schiffs. Wörter und Zahlen kommen fertig
// von der Seite (assets/hangar-overview.js, holoData); hier wird nur
// gezeichnet und gestellt.
//
// Wie es gebaut ist (aus den Aufnahmen vom 09.11. übernommen):
// - Tafeln sind Canvas-Bilder auf Ebenen im Raum. Sie stehen auf einem
//   Projektor am Boden (Leiste, Lichtvorhang bis zur Tafel, Lichtfleck), das
//   Schiff verdeckt sie, der Boden spiegelt sie (hohe Stufe). Ihre Größe
//   folgt dem Abstand: am Bild bleibt eine Tafel so breit wie entworfen, die
//   Schrift also lesbar, ob man nah oder weit steht.
// - Sie schauen in Blickrichtung, je 0,12 rad zur Mitte gedreht und 0,1 rad
//   nach hinten geneigt; zum Punkt der Kamera gedreht wären sie am Bildrand
//   verzerrt.
// - Ihr Platz am Boden kommt aus dem Bild: links und rechts unten, frei von
//   Seitenleiste, Knöpfen und Stationen-Leiste (setSafe der Seite). Beim
//   Drehen bleiben sie stehen; steht die Kamera wieder still und sind sie
//   aus ihrem Platz geraten, gleiten sie über den Boden zurück.
// - Die Halle dunkelt ab (Stationsmodus): ein Schleier über allem, was vor
//   ihm gezeichnet ist (renderOrder), die Hologramme kommen danach. Im
//   Spiegelbild des Bodens fehlt er (mirror()).
// - Maße liegen als Lichtlinien auf dem Boden, an den beiden Seiten des
//   Hüllquaders, die zur Kamera zeigen; Komponenten als Nummern am Port,
//   durch den Rumpf sichtbar.
//
// Knöpfe auf den Tafeln (Vergleich, Alle Werte) gibt es auch als Knöpfe der
// Seite; für Tastatur und Vorleser zählt die Seite, die Tafeln sind Bild.

import * as THREE from 'three';

const C = { cy: '#8fd3ff', line: '#5cc4ff', txt: '#e6f6ff', mut: '#93b6cc', sub: '#c4dcea', on: '#7fe0a8' };
const RAJ = "'Rajdhani', 'Barlow', system-ui, sans-serif";
const ORB = "'Orbitron', 'Rajdhani', system-ui, sans-serif";
const BAR = "'Barlow', system-ui, sans-serif";
const FONTS = ['700 16px Rajdhani', '600 16px Rajdhani', '900 16px Orbitron', '400 16px Barlow', '500 16px Barlow'];
const PAD = 24;           // Rand der Tafelbilder für den Schein (CSS-Pixel)
const S = 2;              // Bildpunkte je CSS-Pixel
const LIFT = 0.45;        // Unterkante der Tafel über dem Projektor (m)
const TILT = 0.1;         // nach hinten geneigt (rad)
const YAW_IN = 0.12;      // zur Bildmitte gedreht (rad)
// Schleier über der Halle, Ziel wie in den Entwürfen: etwa 72 % Helligkeit
// am fertigen Bild. Auf „hoch“ liegt er vor Tonabbildung und Ausgabe (linear,
// dort sind 0,5 etwa die 72 %; 0,28 sahen kaum dunkler aus), auf den kleineren
// Stufen zeichnet er direkt ins fertige Bild: dort sind es 0,28. Gemessen
// 10.11.2026: 0,5 halbierten auf „niedrig“ die Helligkeit.
const DIM_LIN = 0.5, DIM_OUT = 0.28;
const FADE_MS = 360, GLIDE_MS = 420, REST_MS = 280, HOP_MS = 180;
// Steht die Kamera über dem Rumpf (Carrack, Idris: kein freier Boden in den
// unteren Bildecken), schwebt die Tafel ohne Projektor so weit vor der Kamera
// und folgt ihr wie eine Anzeige im Helm (gesehen 10.11.2026: ohne das
// fehlten beide Tafeln, sie standen unter der Kamera).
const FLOAT_M = 3;
// Zeichenfolge: erst Halle und Schiff, dann der Schleier, dann alles hier.
// Nichts hier schreibt Tiefe; die Tafeln kommen zuletzt, weil sie nah an der
// Kamera stehen und Maße oder Nummern dahinter verdecken sollen.
const RO = { dim: 800, glow: 802, floor: 803, beam: 804, line: 806, sprite: 808, panel: 810 };

// ─── Zeichnen ────────────────────────────────────────────────────────────
const ls = (g, v) => { if ('letterSpacing' in g) g.letterSpacing = v; };
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Text an (x, y) Grundlinie; o: f Familie, w Gewicht, s Größe, c Farbe, ls Sperrung, al Ausrichtung, glow
function text(g, s, x, y, o) {
  g.save();
  g.font = `${o.w ?? 400} ${o.s}px ${o.f ?? BAR}`;
  g.fillStyle = o.c ?? C.txt; g.textAlign = o.al ?? 'left'; g.textBaseline = 'alphabetic';
  ls(g, o.ls ?? '0px');
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = 10 * S; }
  g.fillText(s, x, y);
  const w = g.measureText(s).width;
  g.restore();
  return w;
}
function measure(g, s, o) {
  g.save(); g.font = `${o.w ?? 400} ${o.s}px ${o.f ?? BAR}`; ls(g, o.ls ?? '0px');
  const w = g.measureText(s).width; g.restore(); return w;
}
// Kürzt mit … auf die Breite
function fit(g, s, max, o) {
  if (measure(g, s, o) <= max) return s;
  let t = s;
  while (t.length > 1 && measure(g, `${t}…`, o) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}
// Bricht in höchstens zwei Zeilen
function wrap2(g, s, max, o) {
  const words = s.split(' ');
  let a = '';
  while (words.length && measure(g, a ? `${a} ${words[0]}` : words[0], o) <= max) a = a ? `${a} ${words.shift()}` : words.shift();
  return words.length ? [a, fit(g, words.join(' '), max, o)] : [a];
}
const GLOW = 'rgba(140,215,255,.55)';
// Der Rahmen eines Hologramms: Schein, Verlauf, Scanlinien, Rand, helle Ecke
function card(g, w, h) {
  g.save();
  rr(g, 0, 0, w, h, 7);
  g.shadowColor = 'rgba(80,180,255,.40)'; g.shadowBlur = 22 * S;
  const fill = g.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, 'rgba(9,34,58,.97)'); fill.addColorStop(1, 'rgba(5,20,36,.95)');
  g.fillStyle = fill; g.fill();
  g.restore();
  g.save();
  rr(g, 0, 0, w, h, 7); g.clip();
  g.shadowColor = 'rgba(80,180,255,.55)'; g.shadowBlur = 18 * S; g.lineWidth = 8; g.strokeStyle = 'rgba(80,180,255,.16)';
  rr(g, -3, -3, w + 6, h + 6, 9); g.stroke();
  g.shadowBlur = 0; g.fillStyle = 'rgba(150,220,255,.07)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  g.restore();
  g.save();
  rr(g, 0.75, 0.75, w - 1.5, h - 1.5, 7); g.lineWidth = 1.5; g.strokeStyle = 'rgba(140,215,255,.80)'; g.stroke();
  g.beginPath(); g.moveTo(0.5, 16); g.lineTo(0.5, 7); g.arcTo(0.5, 0.5, 7, 0.5, 7); g.lineTo(16, 0.5);
  g.lineWidth = 2.5; g.strokeStyle = '#d4f1ff'; g.stroke();
  g.restore();
}
function head(g, s, x, y) { text(g, s.toLocaleUpperCase(), x, y, { f: RAJ, w: 700, s: 12, c: C.cy, ls: '0.14em', glow: 'rgba(110,200,255,.6)' }); }
function pill(g, x, y, label, o) {
  const st = { f: RAJ, w: 700, s: 13.5, c: o.c };
  const w = Math.ceil(measure(g, label, st)) + 24, h = 28;
  g.save();
  rr(g, x - w, y, w, h, h / 2);
  if (o.hover) { g.fillStyle = 'rgba(143,211,255,.16)'; g.fill(); }
  g.lineWidth = 1; g.strokeStyle = o.border; g.stroke();
  g.restore();
  text(g, label, x - w / 2, y + 19, { ...st, al: 'center' });
  return { x: x - w, y, w, h };
}

// Eine Tafel: Größe in CSS-Pixeln, draw(g, hover) zeichnet und liefert die
// Knöpfe [{ x, y, w, h, act }] in CSS-Pixeln der Tafel.
function sheetCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + 2 * PAD) * S); c.height = Math.ceil((h + 2 * PAD) * S);
  return c;
}

// Übersicht rechts: Name, Steckbrief, vier Kacheln mit Rang, Knöpfe; d =
// { name, line, tiles: [{ label, value, unit, rank, pct }], note, buttons: [{ label, act, main? }] }
const TILES_W = 370;
function drawTiles(g, d, hover) {
  const W = TILES_W, p = 14, gap = 8, tw = (W - 2 * p - gap) / 2, th = 77;
  const nameSt = { f: ORB, w: 900, s: 21, ls: '0.06em', glow: GLOW };
  const lineSt = { f: BAR, w: 400, s: 14, c: C.sub };
  const noteSt = { f: BAR, w: 400, s: 12.5, c: C.mut };
  const y0 = p + 21, yl = y0 + 20, yt = yl + 16;
  const rows = Math.ceil(d.tiles.length / 2);
  const yf = yt + rows * th + (rows - 1) * gap + 12;
  // Knöpfe von rechts, Notiz links davon in bis zu zwei Zeilen
  const btns = [];
  let bx = W - p;
  const placeBtn = [];
  for (const b of [...d.buttons].reverse()) {
    const st = { f: RAJ, w: 700, s: 13.5 };
    const bw = Math.ceil(measure(g, b.label, st)) + 24;
    placeBtn.push({ ...b, x: bx - bw, w: bw });
    bx -= bw + 6;
  }
  const note = wrap2(g, d.note, bx - p - 6, noteSt);
  const H = yf + Math.max(28, note.length * 16) + 12;
  if (!g.canvas.dataset.h) return H;   // erst messen
  card(g, W, H);
  text(g, fit(g, d.name.toLocaleUpperCase(), W - 2 * p, nameSt), p, y0, nameSt);
  text(g, fit(g, d.line, W - 2 * p, lineSt), p, yl, lineSt);
  d.tiles.forEach((t, i) => {
    const x = p + (i % 2) * (tw + gap), y = yt + Math.floor(i / 2) * (th + gap);
    g.save(); rr(g, x, y, tw, th, 6); g.fillStyle = 'rgba(143,211,255,.07)'; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(143,211,255,.22)'; g.stroke(); g.restore();
    text(g, t.label.toLocaleUpperCase(), x + 12, y + 21, { f: RAJ, w: 700, s: 11.5, c: C.cy, ls: '0.14em', glow: 'rgba(110,200,255,.6)' });
    if (t.rank) text(g, t.rank, x + tw - 12, y + 21, { f: BAR, s: 12.5, c: C.mut, al: 'right' });
    // Zahl und Einheit in einer Zeile; zu lang wird die Zahl kleiner, nie gekürzt
    const uSt = { f: RAJ, w: 700, s: 14, c: C.sub }, uw = t.unit ? measure(g, t.unit, uSt) + 5 : 0;
    const vSt = { f: ORB, w: 900, s: 27, glow: GLOW };
    while (vSt.s > 16 && measure(g, t.value, vSt) > tw - 24 - uw) vSt.s -= 1;
    const vw = text(g, fit(g, t.value, tw - 24 - uw, vSt), x + 12, y + 56, vSt);
    if (t.unit) text(g, t.unit, x + 12 + vw + 5, y + 56, uSt);
    g.save(); rr(g, x + 12, y + th - 15, tw - 24, 5, 2); g.fillStyle = 'rgba(143,211,255,.16)'; g.fill();
    if (t.pct > 0) { rr(g, x + 12, y + th - 15, Math.max(5, (tw - 24) * Math.min(1, t.pct)), 5, 2); g.fillStyle = C.cy; g.shadowColor = C.cy; g.shadowBlur = 6 * S; g.fill(); }
    g.restore();
  });
  note.forEach((l, i) => text(g, l, p, yf + 14 + i * 16 + (note.length === 1 ? 4 : 0), noteSt));
  for (const b of placeBtn) {
    const on = hover === b.act;
    const r = pill(g, b.x + b.w, yf, b.label, { c: b.main ? C.cy : C.mut, border: b.main ? 'rgba(143,211,255,.55)' : 'rgba(143,211,255,.3)', hover: on });
    btns.push({ ...r, act: b.act });
  }
  return btns;
}

// Übersicht links: Komponenten mit Nummer, Art, Größe und Kennwert; d =
// { title, rows: [{ id, n, name, kind, size, figure, unit, ps }], more,
//   sel: [id], detail: { id: { lines: [[k, v]], links: [{ label, href }] } } }
// Jede Zeile ist ein Knopf (sys:<id>); gewählt sind wie auf der Tafel alle
// Zeilen, die den Port state.hp führen (trägt ein Port mehrere Teile, alle).
// Sie klappen mit ihren Werten und Links (go:<id>:<i>) auf.
const SYS_W = 320;
const SYS = { p: 12, rh: 38, y0: 30, lh: 19 };
const kSt = { f: BAR, s: 12.5, c: C.mut }, vSt = { f: RAJ, w: 700, s: 14, c: C.txt };
const lSt = { f: RAJ, w: 700, s: 13.5 };
// Werte und Links der gewählten Zeile: Höhe und Lage der Knöpfe
function detailBox(g, det) {
  const { p, lh } = SYS, x0 = p + 30, x1 = SYS_W - p;
  let h = det.lines.length ? 4 + det.lines.length * lh : 0;
  const pills = [];
  let x = x0, row = 0;
  for (const l of det.links) {
    const w = Math.ceil(measure(g, l.label, lSt)) + 24;
    if (x > x0 && x + w > x1) { x = x0; row += 1; }
    pills.push({ x, w, row });
    x += w + 6;
  }
  if (pills.length) h += 6 + (row + 1) * 34;
  return { h: h + 8, pills };
}
function drawSystems(g, d, hover) {
  const W = SYS_W, { p, rh, y0, lh } = SYS;
  const boxes = new Map(d.rows.filter((r) => d.sel?.includes(r.id) && d.detail?.[r.id]).map((r) => [r.id, detailBox(g, d.detail[r.id])]));
  let H = y0 + d.rows.length * rh + (d.more ? 24 : 0) + 8;
  for (const b of boxes.values()) H += b.h;
  if (!g.canvas.dataset.h) return H;
  card(g, W, H);
  head(g, d.title, p + 30, 22);
  const hits = [];
  let y = y0;
  for (const r of d.rows) {
    const cy = y + rh / 2, det = boxes.get(r.id), on = !!det, hot = hover === `sys:${r.id}`;
    // Fläche: gewählt mit Rahmen um Zeile und Werte, unter dem Zeiger heller
    if (on || hot) {
      g.save(); rr(g, 4, y + 1, W - 8, rh - 2 + (on ? det.h : 0), 6);
      g.fillStyle = on ? 'rgba(143,211,255,.13)' : 'rgba(143,211,255,.17)'; g.fill();
      if (on) { g.lineWidth = 1; g.strokeStyle = 'rgba(143,211,255,.5)'; g.stroke(); }
      g.restore();
      // unter dem Zeiger (hier oder an der Nummer am Schiff): Leiste am Rand
      if (hot) { g.save(); rr(g, 4, y + 7, 3, rh - 14, 1.5); g.fillStyle = '#d4f1ff'; g.shadowColor = C.cy; g.shadowBlur = 6 * S; g.fill(); g.restore(); }
    }
    g.save(); g.beginPath(); g.arc(p + 11, cy, 10.5, 0, Math.PI * 2);
    if (on) { g.fillStyle = C.cy; g.shadowColor = C.cy; g.shadowBlur = 8 * S; g.fill(); }
    else { g.lineWidth = hot ? 2.4 : 1.5; g.strokeStyle = hot ? '#ffffff' : C.cy; g.stroke(); }
    g.restore();
    text(g, String(r.n), p + 11, cy + 4.5, { f: RAJ, w: 700, s: 12.5, al: 'center', c: on ? '#04121d' : C.txt });
    const nSt = { f: RAJ, w: 700, s: 15 };
    const right = r.figure ? 96 : 40;
    text(g, fit(g, r.name, W - 2 * p - 30 - right, nSt), p + 30, cy - 1, nSt);
    text(g, fit(g, r.kind, W - 2 * p - 30 - right, { f: BAR, s: 12 }), p + 30, cy + 14, { f: BAR, s: 12, c: C.mut });
    if (r.figure) {
      text(g, r.figure, W - p, cy - 1, { f: RAJ, w: 700, s: 15, al: 'right', glow: GLOW });
      if (r.unit) text(g, fit(g, r.unit, 90, { f: BAR, s: 11.5 }), W - p, cy + 14, { f: BAR, s: 11.5, c: C.mut, al: 'right' });
    }
    if (r.size) {
      const sx = W - p - (r.figure ? Math.max(measure(g, r.figure, { f: RAJ, w: 700, s: 15 }), r.unit ? measure(g, r.unit, { f: BAR, s: 11.5 }) : 0) + 10 : 0);
      text(g, r.size, sx, cy + 5, { f: RAJ, w: 600, s: 13, c: C.mut, al: 'right' });
    }
    hits.push({ x: 4, y, w: W - 8, h: rh, act: `sys:${r.id}` });
    y += rh;
    if (!on) continue;
    // Werte zweispaltig, darunter die Links als Knöpfe
    const info = d.detail[r.id];
    let yl = y + 4;
    for (const [k, v] of info.lines) {
      const vw = text(g, fit(g, v, 150, vSt), W - p, yl + 13, { ...vSt, al: 'right' });
      text(g, fit(g, k, W - 2 * p - 30 - vw - 10, kSt), p + 30, yl + 13, kSt);
      yl += lh;
    }
    if (det.pills.length) {
      const top = (info.lines.length ? yl : y) + 6;
      det.pills.forEach((b, i) => {
        const act = `go:${r.id}:${i}`, by = top + b.row * 34;
        const hit = pill(g, b.x + b.w, by, info.links[i].label, { c: C.cy, border: 'rgba(143,211,255,.45)', hover: hover === act });
        hits.push({ ...hit, act });
      });
    }
    y += det.h;
  }
  if (d.more) text(g, fit(g, d.more, W - 2 * p, { f: BAR, s: 12.5 }), p, y + 16, { f: BAR, s: 12.5, c: C.mut });
  return hits;
}

// kleines Schild (Maß, Nummer): Text in einem Rahmen, ohne Knöpfe
function drawLabel(g, s, o = {}) {
  const st = { f: RAJ, w: 700, s: o.s ?? 16, glow: GLOW };
  const w = Math.ceil(measure(g, s, st)) + 22, h = Math.round((o.s ?? 16) * 1.6);
  if (!g.canvas.dataset.h) return [w, h];
  g.save();
  rr(g, 0, 0, w, h, 5);
  g.shadowColor = 'rgba(80,180,255,.40)'; g.shadowBlur = 14 * S;
  g.fillStyle = 'rgba(7,28,48,.95)'; g.fill();
  g.shadowBlur = 0; g.lineWidth = 1.5; g.strokeStyle = 'rgba(140,215,255,.80)'; g.stroke();
  g.restore();
  text(g, s, w / 2, h / 2 + (o.s ?? 16) * 0.36, { ...st, al: 'center' });
  return [w, h];
}
// Nummer am Port; mode: '' ruhig, 'hot' unter dem Zeiger (hier oder an der
// Zeile), 'sel' gewählt (gefüllt wie der Kreis der Zeile), 'dim' die übrigen,
// solange eine Zeile gemeint ist. Feste Bildgröße: der Mittelpunkt springt nicht.
function drawNumber(g, n, mode = '') {
  const big = mode === 'hot' || mode === 'sel', r = big ? 14 : 12, c = 16;
  if (!g.canvas.dataset.h) return [32, 32];
  g.save();
  if (mode === 'dim') g.globalAlpha = 0.45;
  g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2);
  g.shadowColor = 'rgba(110,200,255,.8)'; g.shadowBlur = (big ? 16 : 10) * S;
  g.fillStyle = mode === 'sel' ? C.cy : mode === 'hot' ? 'rgba(16,52,82,.96)' : 'rgba(8,25,43,.92)'; g.fill();
  g.shadowBlur = 0;
  if (mode !== 'sel') { g.lineWidth = big ? 2.5 : 2; g.strokeStyle = big ? '#d4f1ff' : C.cy; g.stroke(); }
  g.restore();
  g.save(); if (mode === 'dim') g.globalAlpha = 0.45;
  text(g, String(n), c, c + 5, { f: RAJ, w: 700, s: big ? 15 : 14, al: 'center', c: mode === 'sel' ? '#04121d' : C.txt });
  g.restore();
  return [32, 32];
}

// ─── Szene ───────────────────────────────────────────────────────────────
function texFrom(draw, size) {
  const c = document.createElement('canvas'); c.width = size[0]; c.height = size[1];
  draw(c.getContext('2d'), size[0], size[1]);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const radial = (stops) => texFrom((g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  for (const [o, a] of stops) r.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = r; g.fillRect(0, 0, w, h);
}, [128, 128]);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function holoLayer(ctx) {
  const { scene, camera, renderer, reduceMotion } = ctx;
  const el = renderer.domElement;
  const root = new THREE.Group(); root.name = 'hg-stationen'; root.visible = false;
  scene.add(root);
  const mats = [];   // [material, Grunddeckkraft]: alle blenden mit
  const own = [];    // Geometrien, Texturen zum Aufräumen beim Wechsel
  // owner: die Tafel, deren eigene Blende (P.k) mitwirkt
  const basic = (o, base = o.opacity ?? 1, owner = null) => {
    const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, ...o });
    mats.push([m, base, owner]); return m;
  };
  const softTex = radial([[0, 0.9], [0.5, 0.35], [1, 0]]);
  // quer zur Linie: außen 0, in der Mitte voll
  const bandTex = texFrom((g, w, h) => {
    const r = g.createLinearGradient(0, 0, 0, h);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }, [4, 64]);
  const beamTex = texFrom((g, w, h) => {
    const r = g.createLinearGradient(0, h, 0, 0);
    r.addColorStop(0, 'rgba(255,255,255,.75)'); r.addColorStop(0.5, 'rgba(255,255,255,.2)'); r.addColorStop(1, 'rgba(255,255,255,.03)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }, [4, 256]);

  // Schleier: ein Rechteck über dem ganzen Bild, nach Halle und Schiff
  const dimMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uA; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, uA); }',
  });
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dimMat);
  dim.frustumCulled = false; dim.renderOrder = RO.dim; dim.visible = false; dim.name = 'hg-stationen-schleier';
  // Zwischenziel = Nachbearbeitung folgt (linear), sonst fertiges Bild
  dim.onBeforeRender = (r) => { dimMat.uniforms.uA.value = (r.getRenderTarget() ? DIM_LIN : DIM_OUT) * alpha; };
  scene.add(dim);

  let want = null;       // { name, data } von der Seite
  let built = null;      // { key, panels, sprites, lines, box }
  let safe = { l: 0, t: 0, r: 0, rects: [] };
  let alpha = 0, alphaTo = 0, fadeAt = 0, alphaFrom = 0;
  let restKey = null, camMoved = 0, settledAt = 0;
  // Lage und Linse der Kamera im letzten Bild: die Shift-Optik (setViewOffset)
  // gleitet nach einer Drehung weiter, ohne dass sich die Kamera rührt, und
  // schob die Tafeln aus ihrem Platz (Ironclad, 10.11.2026)
  const camSig = new Float64Array(32);
  const camChanged = () => {
    camera.updateMatrixWorld();
    const a = camera.matrixWorld.elements, b = camera.projectionMatrix.elements;
    let moved = false;
    for (let i = 0; i < 16; i++) {
      if (Math.abs(a[i] - camSig[i]) > 1e-4) { camSig[i] = a[i]; moved = true; }
      if (Math.abs(b[i] - camSig[16 + i]) > 1e-4) { camSig[16 + i] = b[i]; moved = true; }
    }
    return moved;
  };
  let fontsOk = false;
  let hoverAct = null;   // Knopf unter dem Zeiger: cmp, flat, sys:<Zeile>, go:<Zeile>:<Link>
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const v = new THREE.Vector3(), q = new THREE.Vector3();

  if (document.fonts?.load) Promise.all(FONTS.map((f) => document.fonts.load(f))).then(() => { fontsOk = true; if (built) redrawAll(); ctx.wake(400); }, () => { fontsOk = true; });
  else fontsOk = true;

  const ppm = () => ctx.H() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const camF = () => camera.getWorldDirection(q);
  const depthOf = (p) => v.copy(p).sub(camera.position).dot(camF());

  // Bodenpunkt unter dem Bildpunkt (x, y), oder null (Blick über den Horizont)
  const floorPx = (x, y, fy = 0) => {
    ndc.set((x / ctx.W()) * 2 - 1, -(y / ctx.H()) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const d = ray.ray.direction, o = ray.ray.origin;
    if (d.y > -1e-3) return null;
    const t = (fy - o.y) / d.y;
    return t > 0 ? o.clone().add(d.clone().multiplyScalar(t)) : null;
  };
  const toPx = (p) => { v.copy(p).project(camera); return v.z > 1 ? null : [(v.x + 1) / 2 * ctx.W(), (1 - v.y) / 2 * ctx.H()]; };
  // Punkt auf dem Sehstrahl durch (x, y), d Meter vor der Kamera
  const aheadPx = (x, y, d) => {
    ndc.set((x / ctx.W()) * 2 - 1, -(y / ctx.H()) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(d));
  };
  const floatM = () => Math.max(FLOAT_M, camera.near * 4);

  // ── Tafel ──
  function makePanel(draw, data, side) {
    const cv = sheetCanvas(1, 1), g = cv.getContext('2d');
    const P = { draw, data, side, canvas: cv, g, cssW: 0, cssH: 0, hits: [], pos: null, from: null, to: null, glideAt: 0, k: 1, hop: null };
    P.tex = new THREE.CanvasTexture(cv); P.tex.colorSpace = THREE.SRGBColorSpace;
    P.tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() ?? 1);
    P.tex.minFilter = THREE.LinearMipmapLinearFilter; P.tex.generateMipmaps = true;
    P.group = new THREE.Group();                       // am Boden, gedreht
    P.pivot = new THREE.Group(); P.pivot.position.y = LIFT; P.pivot.rotation.x = -TILT; P.group.add(P.pivot);
    P.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ map: P.tex, side: THREE.FrontSide }, 1, P));
    P.mesh.renderOrder = RO.panel; P.mesh.userData.panel = P; P.pivot.add(P.mesh);
    // Projektor: Leiste, Lichtstreifen, Fleck, Vorhang
    P.proj = new THREE.Group(); P.group.add(P.proj);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.45), basic({ color: 0x0b1622, transparent: true }, 1, P));
    bar.position.y = 0.04; bar.renderOrder = RO.floor; P.proj.add(bar);
    const lite = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.12), basic({ color: C.cy, blending: THREE.AdditiveBlending }, 1, P));
    lite.rotation.x = -Math.PI / 2; lite.position.y = 0.085; lite.renderOrder = RO.floor + 1; P.proj.add(lite);
    P.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ map: softTex, color: C.cy, opacity: 0.25, blending: THREE.AdditiveBlending }, 0.25, P));
    P.glow.rotation.x = -Math.PI / 2; P.glow.position.y = 0.02; P.glow.renderOrder = RO.glow; P.group.add(P.glow);
    P.beam = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1), basic({ map: beamTex, color: C.cy, opacity: 0.4, blending: THREE.AdditiveBlending }, 0.4, P));
    P.beam.renderOrder = RO.beam; P.proj.add(P.beam);
    P.group.visible = false;
    root.add(P.group);
    redraw(P);
    return P;
  }
  function redraw(P) {
    const g = P.g;
    delete P.canvas.dataset.h;
    const H = P.draw(g, P.data, null);
    const w = P.draw === drawTiles ? TILES_W : SYS_W;
    P.cssW = w; P.cssH = H;
    const cw = Math.ceil((w + 2 * PAD) * S), ch = Math.ceil((H + 2 * PAD) * S);
    if (P.canvas.width !== cw || P.canvas.height !== ch) {
      P.canvas.width = cw; P.canvas.height = ch;
      // neue Größe: neue Textur, sonst bliebe die alte Speichergröße
      P.tex.dispose(); P.tex = new THREE.CanvasTexture(P.canvas); P.tex.colorSpace = THREE.SRGBColorSpace;
      P.tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() ?? 1);
      P.mesh.material.map = P.tex; P.mesh.material.needsUpdate = true;
    }
    P.canvas.dataset.h = String(H);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
    g.setTransform(S, 0, 0, S, PAD * S, PAD * S);
    P.hits = P.draw(g, P.data, P.hover ?? null) || [];
    P.tex.needsUpdate = true;
  }
  function redrawAll() { for (const P of built?.panels ?? []) redraw(P); for (const s of built?.sprites ?? []) s.redraw?.(); }
  // Zeiger und Wahl auf Tafeln und Nummern: die Zeile unter dem Zeiger
  // leuchtet an beiden Stellen, die gewählte bleibt gefüllt
  function applyHover() {
    if (!built) return;
    const sysH = hoverAct && /^(sys|go):/.test(hoverAct) ? hoverAct : null;
    const sheetH = hoverAct && !sysH ? hoverAct : null;
    if ((built.sys.hover ?? null) !== sysH) { built.sys.hover = sysH; redraw(built.sys); }
    if ((built.sheet.hover ?? null) !== sheetH) { built.sheet.hover = sheetH; redraw(built.sheet); }
    updateMarks();
  }
  function updateMarks() {
    if (!built) return;
    const d = built.sys.data, sel = new Set((d.sel ?? []).filter((id) => d.detail?.[id] && d.rows.some((r) => r.id === id)));
    const hot = hoverAct?.startsWith('sys:') ? hoverAct.slice(4) : null;
    for (const sp of built.sprites) {
      if (sp.kind !== 'num') continue;
      const mode = sel.has(sp.row) ? 'sel' : sp.row === hot ? 'hot' : sel.size || hot ? 'dim' : '';
      if (mode === sp.st.mode) continue;
      sp.st.mode = mode; sp.redraw();
      sp.obj.renderOrder = RO.sprite + (mode === 'sel' || mode === 'hot' ? 1 : 0);
    }
  }

  // ── Schild als Sprite (Maße, Nummern): bleibt am Bild gleich groß ──
  function makeSprite(drawFn, pos, o = {}) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const sp = { pos: pos.clone(), px: 0, py: 0, kind: o.kind ?? '' };
    // Nummern am Port durch den Rumpf (xray), Maße verdeckt das Schiff
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: !o.xray, fog: false }));
    mats.push([spr.material, 1]);
    spr.renderOrder = RO.sprite; spr.center.set(0.5, o.anchorY ?? 0.5);
    sp.redraw = () => {
      delete cv.dataset.h;
      const [w, h] = drawFn(g);
      cv.width = Math.ceil((w + 2 * 8) * S); cv.height = Math.ceil((h + 2 * 8) * S);
      cv.dataset.h = String(h);
      g.setTransform(S, 0, 0, S, 8 * S, 8 * S);
      drawFn(g);
      sp.px = w + 16; sp.py = h + 16;
      spr.material.map?.dispose();
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      spr.material.map = t; spr.material.needsUpdate = true;
    };
    sp.redraw();
    sp.obj = spr; spr.position.copy(pos); root.add(spr);
    return sp;
  }

  // ── Lichtlinie am Boden, Leuchtfaden im Raum ──
  // Kern deckend gemischt: rein additiv lief Cyan auf dem hellen Hallenboden
  // zu Weiß aus (Aufnahme „niedrig“, 10.11.2026). Der Schein darunter bleibt
  // additiv und schmal.
  function floorBand(a, b, w, op) {
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), basic({ color: C.line, opacity: op }, op));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(len + w * 4, w * 6), basic({ map: bandTex, color: C.cy, opacity: op * 0.35, blending: THREE.AdditiveBlending }, op * 0.35));
    m.rotation.x = -Math.PI / 2; m.renderOrder = RO.line;
    halo.rotation.x = -Math.PI / 2; halo.renderOrder = RO.line - 1; halo.position.y = -0.002;
    const g = new THREE.Group(); g.add(halo, m);
    g.position.copy(a).add(b).multiplyScalar(0.5); g.position.y = 0.035;
    g.rotation.y = -Math.atan2(d.z, d.x);
    root.add(g); return g;
  }
  function thread(a, b, r, op) {
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8, 1, true), basic({ color: C.line, opacity: op }, op));
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.renderOrder = RO.line; root.add(m); return m;
  }

  function clear() {
    if (!built) return;
    root.traverse((o) => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); if (o.material?.map && o.material.map !== softTex && o.material.map !== beamTex && o.material.map !== bandTex) o.material.map.dispose(); o.material?.dispose?.(); } });
    root.clear(); mats.length = 0; built = null; hoverAct = null; el.style.cursor = '';
  }

  // Hüllquader des Schiffs in Weltkoordinaten (aus der Bucht, Modellraum)
  function worldBox(rest, box) {
    const M = rest.model.matrixWorld, out = new THREE.Box3();
    if (box) {
      for (let i = 0; i < 8; i++) out.expandByPoint(v.set(box[i & 1 ? 1 : 0][0], box[i & 2 ? 1 : 0][1], box[i & 4 ? 1 : 0][2]).applyMatrix4(M));
    } else out.setFromObject(rest.group);
    return out;
  }

  // ── Übersicht bauen ──
  function buildShip(rest, d) {
    const sys = makePanel(drawSystems, d.systems, 'left'), sheet = makePanel(drawTiles, d.sheet, 'right');
    const panels = [sys, sheet];
    const sprites = [];
    const M = rest.model.matrixWorld;
    for (const r of d.systems.rows) {
      const seen = [];
      for (const p of r.ps ?? []) {
        const local = new THREE.Vector3(p[0], p[1], p[2]);
        // zwei Ports derselben Zeile dicht beieinander (Schilde der Gladius
        // 0,34 m): eine Nummer, sonst liegen zwei Kreise übereinander
        if (seen.some((q) => q.distanceTo(local) < 1)) continue;
        seen.push(local);
        const st = { mode: '' };
        const sp = makeSprite((g) => drawNumber(g, r.n, st.mode), local.clone().applyMatrix4(M), { xray: true, kind: 'num' });
        sp.local = local; sp.row = r.id; sp.st = st;
        sprites.push(sp);
      }
    }
    const box = worldBox(rest, d.dims.box);
    return { key: d.key, panels, sys, sheet, sprites, box, dims: d.dims, lines: null, model: rest.model };
  }

  // Maßlinien an den beiden Seiten, die zur Kamera zeigen; neu, wenn die
  // Kamera auf eine andere Ecke schaut
  let dimCorner = '';
  function layDims() {
    const B = built.box, d = built.dims, cam = camera.position;
    const sx = cam.x > (B.min.x + B.max.x) / 2 ? 1 : -1, sz = cam.z > (B.min.z + B.max.z) / 2 ? 1 : -1;
    const key = `${sx}${sz}`;
    if (key === dimCorner && built.lines) return;
    dimCorner = key;
    for (const o of built.lines ?? []) {
      root.remove(o);
      o.traverse((n) => { if (n.isMesh || n.isSprite) { n.geometry?.dispose?.(); if (n.material?.map && n.material.map !== softTex && n.material.map !== bandTex) n.material.map.dispose(); const i = mats.findIndex(([m]) => m === n.material); if (i >= 0) mats.splice(i, 1); n.material?.dispose?.(); } });
    }
    const lines = [];
    const off = 1.2, tick = 0.7;
    const xEdge = sx > 0 ? B.max.x + off : B.min.x - off, zEdge = sz > 0 ? B.max.z + off : B.min.z - off;
    const P3 = (x, z, y = 0) => new THREE.Vector3(x, y, z);
    // Länge entlang z (Bugachse in der Halle), Breite entlang x
    const L = [P3(xEdge, B.min.z), P3(xEdge, B.max.z)], Wd = [P3(B.min.x, zEdge), P3(B.max.x, zEdge)];
    for (const [a, b, t] of [[L[0], L[1], [tick, 0]], [Wd[0], Wd[1], [0, tick]]]) {
      lines.push(floorBand(a, b, 0.1, 0.95));
      for (const p of [a, b]) lines.push(floorBand(P3(p.x - t[0], p.z - t[1]), P3(p.x + t[0], p.z + t[1]), 0.1, 0.95));
    }
    // dünne Hilfslinien vom Rumpf zur Maßlinie
    const xs = sx > 0 ? B.max.x : B.min.x, zs = sz > 0 ? B.max.z : B.min.z;
    lines.push(floorBand(P3(xs, B.min.z), P3(xEdge, B.min.z), 0.05, 0.45), floorBand(P3(xs, B.max.z), P3(xEdge, B.max.z), 0.05, 0.45));
    lines.push(floorBand(P3(B.min.x, zs), P3(B.min.x, zEdge), 0.05, 0.45), floorBand(P3(B.max.x, zs), P3(B.max.x, zEdge), 0.05, 0.45));
    // Höhe senkrecht an der hinteren Ecke der Längslinie
    const zFar = sz > 0 ? B.min.z : B.max.z;
    const hb = P3(xEdge, zFar), ht = P3(xEdge, zFar, B.max.y);
    lines.push(thread(hb, ht, 0.05, 0.95));
    const ax = new THREE.Vector3(0, 0, 1).multiplyScalar(0.7);
    lines.push(thread(ht.clone().sub(ax), ht.clone().add(ax), 0.05, 0.95));
    built.sprites = built.sprites.filter((sp) => sp.kind !== 'dim');
    // Schilder: mehrere Plätze an ihrer Linie, placeLabels nimmt den ersten,
    // den keine Tafel verdeckt
    const lab = (s, at) => { const sp = makeSprite((g) => drawLabel(g, s), at[0], { kind: 'dim' }); sp.at = at; lines.push(sp.obj); built.sprites.push(sp); };
    const along = (fs, f) => fs.map(f);
    if (d.len) lab(d.len, along([0.65, 0.5, 0.8, 0.35, 0.2], (t) => P3(xEdge, B.min.z * (1 - t) + B.max.z * t, 0.9)));
    if (d.wid) lab(d.wid, along([0.6, 0.45, 0.75, 0.3, 0.15], (t) => P3(B.min.x * (1 - t) + B.max.x * t, zEdge, 0.9)));
    if (d.hgt) lab(d.hgt, along([0.5, 0.7, 0.3], (t) => P3(xEdge, zFar, B.max.y * t)));
    built.lines = lines;
  }
  function placeLabels() {
    const W = ctx.W(), H = ctx.H(), m = 36;
    const free = (pt) => {
      const px = toPx(pt);
      if (!px || px[0] < (safe.l ?? 0) + m || px[0] > W - (safe.r ?? 0) - m || px[1] < (safe.t ?? 0) + m || px[1] > H - m) return false;
      if ((safe.rects ?? []).some((r) => px[0] > r.l - m && px[0] < r.r + m && px[1] > r.t - m && px[1] < (r.b ?? H) + m)) return false;
      return !built.panels.some((P) => P.group.visible && P.rect && px[0] > P.rect.l - m && px[0] < P.rect.r + m && px[1] > P.rect.t - m && px[1] < P.rect.b + m);
    };
    for (const sp of built.sprites) {
      if (!sp.at) continue;
      // kein freier Platz (Linie läuft aus dem Bild oder hinter eine Tafel):
      // ohne Schild, statt halb unter der Seitenleiste (Carrack, 10.11.2026)
      const at = sp.at.find(free);
      sp.obj.visible = !!at;
      sp.pos.copy(at ?? sp.at[0]);
      sp.obj.position.copy(sp.pos);
    }
  }

  // Liegt der Punkt von der Kamera aus hinter dem Schiff (Sehlinie durch
  // seinen Hüllquader)? Dort verdeckte der Rumpf die Tafel (Ironclad,
  // Aufnahme von Krisz 10.11.2026: Systeme halb hinter dem Rumpf).
  const sight = new THREE.Ray(), hitV = new THREE.Vector3();
  const behindShip = (pt) => {
    const c = camera.position, len = v.copy(pt).sub(c).length();
    if (len < 1e-3) return false;
    sight.set(c, v.divideScalar(len));
    const h = sight.intersectBox(built.box, hitV);
    return !!h && h.distanceTo(c) < len - 0.3;
  };

  // Platz einer Tafel am Boden aus dem Bild: unten links bzw. rechts, frei
  // von Seitenleiste und Knöpfen; nicht im Fußabdruck des Schiffs und nicht
  // hinter ihm
  function target(P) {
    const W = ctx.W(), H = ctx.H(), k = 1;
    const w = P.cssW * k, h = P.cssH * k;
    const x = P.side === 'left' ? safe.l + 18 + w / 2 : W - safe.r - 18 - w / 2;
    const x0 = x - w / 2, x1 = x + w / 2;
    // tiefste freie Höhe unter der Tafel: über Knöpfen der Seite in ihrem Streifen
    let bottom = H - 22;
    for (const r of safe.rects ?? []) if (r.r > x0 && r.l < x1 && r.t > H * 0.45) bottom = Math.min(bottom, r.t - 14);
    if (bottom - h - 40 < (safe.t ?? 0)) return null;
    // Bildfläche der Tafel mit Projektor, für die Schilder (placeLabels)
    P.rect = { l: x0, r: x1, t: bottom - h - 40, b: bottom };
    P.anchor = [x, bottom];
    const B = built.box, m = 1.4;
    const inFoot = (t) => t.x > B.min.x - m && t.x < B.max.x + m && t.z > B.min.z - m && t.z < B.max.z + m;
    const floating = () => { P.float = true; P.rect.t = bottom - h; return aheadPx(x, bottom, floatM()); };
    P.float = false;
    const p = floorPx(x, bottom);
    // kein Boden unter der Stelle oder Kamera über dem Rumpf: schweben
    if (!p || (inFoot(p) && inFoot(camera.position))) return floating();
    // Fuß und Oberkante der Tafel frei sichtbar
    const top = (t) => { const d = Math.max(1, depthOf(t)); return t.clone().setY(LIFT + (h * d) / ppm()); };
    const blocked = (t) => inFoot(t) || behindShip(t) || behindShip(top(t));
    // aus Fußabdruck und Schatten des Schiffs heraus zur Kamera hin
    if (blocked(p)) {
      const c = camera.position, dir = p.clone().sub(c); dir.y = 0;
      const n = dir.length(); dir.normalize();
      let lo = 0, hi = n;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2, t = c.clone().add(dir.clone().multiplyScalar(mid)).setY(0);
        if (blocked(t)) hi = mid; else lo = mid;
      }
      p.copy(c).add(dir.multiplyScalar(lo)); p.y = 0;
      // der freie Boden liegt hinter der Kamera (Carrack: Kamera knapp neben
      // dem Rumpf) oder so viel tiefer im Bild, dass die Tafel über die
      // Knöpfe am Bühnenfuß rutschte (Ironclad nach dem Drehen: Fuß 70 px
      // unter dem Platz, am Bildrand): schweben
      const q = toPx(p);
      if (!q || q[1] > bottom + 24 || depthOf(p) < floatM()) return floating();
    }
    return p;
  }

  // je Bild: Drehung, Größe, Projektor, Gleiten
  function place(P, now) {
    if (!P.pos) return;
    if (P.float) {
      // schwebend: fest im Bild, zur Kamera gedreht, ohne Projektor
      P.from = null;
      P.pos.copy(aheadPx(P.anchor[0], P.anchor[1], floatM()));
      P.group.position.copy(P.pos);
      P.group.quaternion.copy(camera.quaternion);
    } else {
      if (P.to && P.from) {
        const t = reduceMotion ? 1 : ease((now - P.glideAt) / GLIDE_MS);
        P.pos.lerpVectors(P.from, P.to, t);
        if (t >= 1) P.from = null;
      }
      // Sprung: erst aus, dann am neuen Platz ein
      if (P.hop) {
        const t = (now - P.hop.at) / HOP_MS;
        if (t >= 1 && P.hop.to) { P.pos.copy(P.hop.to); P.hop.to = null; }
        setK(P, t < 1 ? 1 - ease(t) : ease(t - 1));
        if (t >= 2) { P.hop = null; setK(P, 1); }
      }
      const f = camF();
      const yaw = Math.atan2(-f.x, -f.z) + (P.side === 'left' ? -YAW_IN : YAW_IN);
      P.group.position.copy(P.pos);
      P.group.rotation.set(0, yaw, 0);
    }
    const fl = !!P.float;
    if (P.proj.visible === fl) {
      P.proj.visible = P.glow.visible = !fl;
      P.pivot.position.y = fl ? 0 : LIFT; P.pivot.rotation.x = fl ? 0 : -TILT;
      // vor der Kamera kann Rumpf zwischen Tafel und Boden liegen: nicht verdecken lassen
      P.mesh.material.depthTest = !fl;
    }
    const d = Math.max(1, depthOf(P.pos));
    const wm = ((P.cssW + 2 * PAD) * d) / ppm(), hm = wm * (P.cssH + 2 * PAD) / (P.cssW + 2 * PAD);
    P.mesh.scale.set(wm, hm, 1);
    // Unterkante des Bilds (mit Rand) knapp unter der Hubhöhe: die Tafel selbst steht auf LIFT
    P.mesh.position.y = hm / 2 - (PAD / (P.cssH + 2 * PAD)) * hm;
    const fw = (P.cssW * d) / ppm() * 0.86;
    P.proj.scale.set(fw, 1, 1);
    P.beam.scale.set(1, LIFT + 0.02, 1); P.beam.position.y = (LIFT + 0.02) / 2;
    P.glow.scale.set(fw * 1.45, fw * 0.64, 1);
  }
  function placeSprite(sp) {
    // Nummern hängen am Port: aus dem Modellraum, falls das Schiff sich noch rührt
    if (sp.local) { sp.pos.copy(sp.local).applyMatrix4(built.model.matrixWorld); sp.obj.position.copy(sp.pos); }
    const d = Math.max(1, depthOf(sp.pos));
    const s = d / ppm();
    sp.obj.scale.set(sp.px * s, sp.py * s, 1);
  }

  function retarget(now, first) {
    for (const P of built.panels) {
      const wasFloat = P.float, wasShown = P.group.visible;
      const t = target(P);
      P.group.visible = !!t;
      if (!t) { P.hop = null; setK(P, 1); continue; }
      if (first || !P.pos || P.float) { P.pos = t.clone(); P.from = null; P.to = t; P.hop = null; setK(P, 1); continue; }
      // nur zurück, wenn sie spürbar aus ihrem Platz geraten ist
      const a = toPx(P.pos), b = toPx(t);
      const off = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : Infinity;
      if (off < 70 && wasShown && !wasFloat) continue;
      P.to = t;
      if (reduceMotion) { P.pos = t.clone(); P.from = null; P.hop = null; setK(P, 1); continue; }
      // kam sie aus dem Schweben, war sie weg, steht sie hinter dem Schiff
      // oder quer durchs Bild: dort aus-, am neuen Platz einblenden, statt
      // durch den Rumpf zu gleiten
      if (wasFloat || !wasShown) { P.pos = t.clone(); P.from = null; P.hop = { at: now - HOP_MS, to: null }; }
      else if (!a || behindShip(P.pos) || off > ctx.W() * 0.4) { P.from = null; P.hop = { at: now, to: t.clone() }; }
      else { P.from = P.pos.clone(); P.glideAt = now; P.hop = null; setK(P, 1); }
    }
    layDims();
    placeLabels();
  }

  function setAlpha(a) {
    for (const [m, base, P] of mats) m.opacity = base * a * (P ? P.k : 1);
    root.visible = a > 0.001; dim.visible = a > 0.001;
  }
  function setK(P, k) {
    if (P.k === k) return;
    P.k = k;
    for (const [m, base, o] of mats) if (o === P) m.opacity = base * alpha * k;
  }

  // ── Zeiger: Knöpfe auf den Tafeln, Zeilen der Systeme, Nummern am Schiff ──
  // liefert den Knopf unter dem Zeiger (act) oder null; eine Tafel deckt,
  // was hinter ihr liegt, ihr durchsichtiger Rand nicht
  function pick(e) {
    if (!built || alpha < 0.5) return null;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    ndc.set((mx / r.width) * 2 - 1, -(my / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const shown = built.panels.filter((P) => P.group.visible && P.k > 0.5);
    for (const h of ray.intersectObjects(shown.map((P) => P.mesh), false)) {
      if (!h.uv) continue;
      const P = h.object.userData.panel;
      const x = h.uv.x * (P.cssW + 2 * PAD) - PAD, y = (1 - h.uv.y) * (P.cssH + 2 * PAD) - PAD;
      if (x < 0 || y < 0 || x > P.cssW || y > P.cssH) continue;
      return P.hits.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.act ?? null;
    }
    // Nummern: die dem Zeiger nächste unter den getroffenen (sie liegen am
    // Rumpf oft dicht beieinander)
    const nums = built.sprites.filter((sp) => sp.kind === 'num' && sp.obj.visible);
    let best = null, bd = Infinity;
    for (const h of ray.intersectObjects(nums.map((sp) => sp.obj), false)) {
      const sp = nums.find((n) => n.obj === h.object), px = sp && toPx(sp.pos);
      const d = px ? Math.hypot(px[0] - mx * (ctx.W() / r.width), px[1] - my * (ctx.H() / r.height)) : Infinity;
      if (d < bd) { bd = d; best = sp; }
    }
    return best ? `sys:${best.row}` : null;
  }
  let downAt = null;
  const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
  const onClick = (e) => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const act = pick(e);
    if (!act) return;
    if (act.startsWith('sys:')) ctx.act({ act: 'sys', row: act.slice(4) });
    else if (act.startsWith('go:')) {
      const rest = act.slice(3), j = rest.lastIndexOf(':');
      const l = built.sys.data.detail?.[rest.slice(0, j)]?.links?.[Number(rest.slice(j + 1))];
      if (l?.href) ctx.act({ act: 'go', href: l.href });
    } else ctx.act({ act });
  };
  const hoverTo = (act) => {
    if (act === hoverAct) return;
    hoverAct = act;
    applyHover();
    el.style.cursor = act ? 'pointer' : '';
    ctx.wake(300);
  };
  const onMove = (e) => { if (!e.buttons) hoverTo(pick(e)); };
  const onLeave = () => hoverTo(null);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('click', onClick);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);

  return {
    set(w) {
      want = w && w.data ? w : null;
      alphaFrom = alpha; alphaTo = want ? 1 : 0; fadeAt = performance.now();
      if (built && want && (built.key !== want.data.key)) { alphaTo = 0; }
      else if (built && want) {
        // dieselbe Station, neue Wörter (Vergleich an/aus, gewählte Zeile):
        // neu zeichnen; die Tafel wächst nach oben, ihr Platz wird neu geprüft
        built.sys.data = want.data.systems; built.sheet.data = want.data.sheet;
        redrawAll();
        updateMarks();
        settledAt = 0;
      }
      ctx.wake(FADE_MS + 100);
    },
    safe(s) { safe = { l: 0, t: 0, r: 0, rects: [], ...s }; settledAt = 0; ctx.wake(300); },
    // Spiegelbild des Bodens („hoch“): ohne Hologramme, ihre Nummern lagen
    // dort als blasse Kreise auf dem Boden (Aufnahme 10.11.2026)
    mirror(on) { const vis = !on && alpha > 0.001; dim.visible = vis; root.visible = vis; },
    tick(now) {
      const rest = ctx.rest();
      const ready = rest && fontsOk;
      // Wechsel: erst ausblenden, dann neu bauen
      const key = want?.data?.key ?? null;
      if (built && (!ready || !want || built.key !== key || rest.key !== restKey)) {
        if (alphaTo !== 0) { alphaFrom = alpha; alphaTo = 0; fadeAt = now; }
        if (alpha <= 0.001) { clear(); dimCorner = ''; }
      }
      if (!built && want && ready) {
        built = buildShip(rest, want.data);
        restKey = rest.key;
        updateMarks();
        retarget(now, true);
        alphaFrom = 0; alphaTo = 1; fadeAt = now;
      }
      // Größe und Drehung je Bild; neuer Platz erst, wenn die Kamera ruht
      let busy = false;
      if (built) {
        if (camChanged()) camMoved = now;
        if (now - camMoved > REST_MS && settledAt < camMoved) { retarget(now, false); settledAt = now; }
        if (!settledAt) { retarget(now, false); settledAt = now; }
        // Bilder weiter, bis die Tafeln nach der Fahrt ihren neuen Platz
        // haben: sonst hielt der Viewer an, bevor REST_MS um war, und die
        // Tafel blieb, wo die Drehung sie gelassen hatte (hinter dem Rumpf)
        if (settledAt < camMoved) busy = true;
        for (const P of built.panels) { place(P, now); if (P.from || P.hop) busy = true; }
        for (const sp of built.sprites) placeSprite(sp);
      }
      const t = reduceMotion ? 1 : Math.min(1, (now - fadeAt) / FADE_MS);
      const a = alphaFrom + (alphaTo - alphaFrom) * ease(t);
      if (Math.abs(a - alpha) > 1e-4 || (built && alpha === 0 && a === 0 && alphaTo === 1)) { alpha = a; setAlpha(alpha); }
      if (t < 1) busy = true;
      if (built && alphaTo === 0 && alpha <= 0.001 && want === null) { clear(); dimCorner = ''; }
      return busy;
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('click', onClick);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      clear(); scene.remove(root); scene.remove(dim);
      dim.geometry.dispose(); dimMat.dispose(); softTex.dispose(); beamTex.dispose(); bandTex.dispose();
    },
  };
}
