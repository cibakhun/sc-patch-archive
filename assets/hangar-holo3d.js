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
//   Projektor am Boden (Leiste, Lichtvorhang bis zur Tafel, Lichtfleck).
//   Nichts verdeckt sie: Rumpf, Wände, Decke und Deko liegen im Bild immer
//   unter ihnen (Krisz 10.11.2026, Ironclad-Tafel von der Geometrie
//   angeschnitten: „das soll nicht passieren“). Ihre Größe
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
// - Steht in der Ausrüstung ein Slot offen, zeigt die rechte Tafel statt des
//   Schiffs das Datenblatt des Bauteils (drawItem; Krisz 11.11.2026: „ja so
//   ungefähr einbauen“): das Teil unter dem Zeiger in der Auswahl, sonst das
//   eingebaute. Über ihr schwebt das Bauteil selbst als Hologramm (partHolo),
//   aus demselben Modell, das die Werkstatt ans Schiff setzt.
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
// Blickt die Kamera steiler als so nach unten (rad; Startansicht etwa 0,22),
// schweben die Tafeln wie über dem Rumpf fest im Bild: am Boden lagen sie von
// oben flach, schief und halb unter der Seitenleiste (Ironclad, 10.11.2026)
const STEEP = 0.55;
// Eine Tafel am Boden schaut zur Kamera: im Grundriss dreht sie sich zum
// Kamerapunkt hin (Krisz 11.11.2026: „die sollen richtung kamera schauen“).
// Bis dahin drehte sie sich um 0,12 rad zur falschen Seite, von der Bildmitte
// weg: im Bild war die innere Kante die höhere, die Tafel schaute am
// Betrachter vorbei. Ganz zugewandt wird sie am Bildrand nicht: dort steht sie
// 30 Grad und mehr neben der Blickachse, ihre Zeilen liefen so schräg
// zusammen, dass die kleine Schrift litt, und sie ragte aus ihrem Streifen
// (Bilder vom 11.11.2026). Die Grenze ist deshalb, was man sieht: im Bild darf
// die äußere Kante um höchstens FACE_RISE höher stehen als die innere. Das
// sind am Gladius 0,22 rad und am weiten Blick der großen Schiffe (Ironclad,
// 64 Grad) 0,14 rad, mit denselben schrägen Zeilen.
export const FACE_RISE = 0.065;
// Drehung um die Hochachse für eine Tafel am Bodenpunkt at. f: Blickrichtung
// der Kamera, c: ihr Ort, reach: halbe Breite der Tafel im Bild, geteilt durch
// die Bildweite (Pixel je Meter in einem Meter Abstand). Ohne Szene gerechnet,
// damit verify:hangar [21] die Richtung am ausgelieferten Modul nachrechnet.
export function panelYaw(f, c, at, reach) {
  const flat = Math.atan2(-f.x, -f.z);
  const to = Math.atan2(c.x - at.x, c.z - at.z);
  const turn = Math.atan2(Math.sin(to - flat), Math.cos(to - flat));
  // Die Kanten einer um t gedrehten Tafel stehen in der Tiefe 1 ± e vor der
  // Kamera, e = reach * n * sin t / Breite(t), Breite(t) = cos t + side * sin t
  // (panelSpread), n = Anteil des Blicks am Boden. Im Bild verhalten sich ihre
  // Höhen wie (1 + e) / (1 - e); das soll 1 + FACE_RISE nicht übersteigen.
  // Nach t aufgelöst:
  const n = Math.hypot(f.x, f.z) || 1;
  const px = at.x - c.x, py = at.y - c.y, pz = at.z - c.z;
  const depth = Math.max(1, px * f.x + py * f.y + pz * f.z);
  const side = Math.abs(pz * f.x - px * f.z) / depth;
  const k = reach > 0 ? FACE_RISE / ((2 + FACE_RISE) * reach * n) : Infinity;
  const max = k * side < 1 ? Math.atan(k / (1 - k * side)) : Math.PI / 2;
  return flat + Math.max(-max, Math.min(max, turn));
}
// Um wie viel breiter zeigt das Bild eine so gedrehte Fläche als eine quer
// zum Blick? Neben der Blickachse zieht die Projektion alles, was sich der
// Kamera zuwendet, in die Breite. Durch diesen Wert geteilt, bleibt die Tafel
// im Bild so breit wie gezeichnet und in ihrem Streifen; ihre Höhe bleibt.
export function panelSpread(f, c, at, yaw) {
  const n = Math.hypot(f.x, f.z) || 1;
  const rx = -f.z / n, rz = f.x / n;                // rechts im Bild, am Boden
  const ux = Math.cos(yaw), uz = -Math.sin(yaw);    // Breite der Tafel
  const px = at.x - c.x, py = at.y - c.y, pz = at.z - c.z;
  const depth = Math.max(1, px * f.x + py * f.y + pz * f.z);
  return Math.max(0.5, ux * rx + uz * rz - ((px * rx + pz * rz) / depth) * (ux * f.x + uz * f.z));
}
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
// Kürzt vorn: beim Tippen bleibt das Ende mit der Schreibmarke sichtbar
function fitTail(g, s, max, o) {
  if (measure(g, s, o) <= max) return s;
  let t = s;
  while (t.length > 1 && measure(g, `…${t}`, o) > max) t = t.slice(1);
  return `…${t.trimStart()}`;
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
// { name, line, tiles: [{ label, value, unit, rank, tone?, pct }], note, buttons: [{ label, act, main? }] }
const TILES_W = 370;
drawTiles.W = TILES_W;
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
    // Rang in der Klasse, oder was das Layout ändert (tone: Bernstein mehr, Rot weniger)
    if (t.rank) text(g, t.rank, x + tw - 12, y + 21, t.tone ? { f: RAJ, w: 700, s: 13, c: toneOf(t.tone === 'up' ? 1 : -1), al: 'right' } : { f: BAR, s: 12.5, c: C.mut, al: 'right' });
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
drawSystems.W = SYS_W;
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

// ─── Ausrüstung: die Layout-Werkstatt auf der Tafel ──────────────────────
// Krisz 10.11.2026: Loadout direkt in die Übersicht, „eine zentrale
// Bedienoberfläche“, mit dem, was die Werkstatt schon kann: Zeichen je
// Bauteilart im Sockel mit Größe, leichter Farbton je Art, Bernstein für
// Getauschtes, ▲▼ zum eingebauten Teil, Wertbalken. Was zu sehen ist, liefert
// die Werkstatt selbst (assets/hangar-layouts.js, board()), die Seite ergänzt
// je Zeile den Punkt ihres Ports (ps) und Links (holoLoadout); geklickt wird
// als lo|<was>|<womit>, und die Werkstatt führt es aus (act()).
// d = { title, chip, name, nameEdit, icons: { art: Pfad }, cats: [{ id, label, n, on }], cat,
//   groups: [{ title, total, delta, dir, rows: [{ key, n, type, dt, size, name, sub, was, figure, unit, delta, dir, changed, ps }] }],
//   pick: { key, head, count, racks: { label, info, list: [{ id, top, sub, tag, on }] } | null,
//           opts: [{ id, name, sub, type, dt, figure, delta, dir, bar, tag, on }], revert, links } | null,
//   paints: { title, list: [{ id, name, cols, note, on }] } | null, empty,
//   state: { s, text, sub }, note, toast, btns: [{ id, label, main, off }],
//   menu: [{ label, sub, on, act } | { head } | { note } | { sep } | { label, href }] }
// ui = { scroll, pscroll, menu, maxH, reveal, pReveal } gehört der Tafel:
// was gerollt ist und ob das Menü der Layouts offen steht.
const LO_W = 356;
const LO = { p: 12, top: 40, tabs: 34, gh: 26, rh: 42, was: 14, foot: 68, oh: 36, opts: 6, ch: 60 };
const AMBER = '#f5a623', DOWN = '#ff9b8a', INK = '#04121d';
// Farbton je Bauteilart: Energiewaffen blauviolett, ballistische sandhell,
// Raketen und Bomben glutrot, Schild blau, Generator gelb, Kühler eisig,
// Quantum violett, Radar grün. Nur ein Unterton; Bernstein bleibt dem
// Getauschten vorbehalten.
const TINT = {
  'gun.e': '#9aa6ff', 'gun.p': '#e9dcbd', gun: '#c4d4e6',
  missile: '#ff9d7c', torpedo: '#ff9d7c', gmissile: '#ff9d7c', bomb: '#ff9d7c',
  shield: '#78b6ff', power: '#f0e384', cooler: '#a2ecf5', quantum: '#c8a4ff', radar: '#8fe3b3',
};
const tintOf = (type, dt) => TINT[`${type}.${dt}`] ?? TINT[type] ?? C.cy;
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const toneOf = (dir) => (dir > 0 ? AMBER : dir < 0 ? DOWN : C.mut);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const paths = new Map();
// Zeichen der Werkstatt (Pfad im 24er-Raster) in ein Feld der Kante size
function icon(g, d, x, y, size, color) {
  if (!d) return;
  let p = paths.get(d);
  if (!p) { p = new Path2D(d); paths.set(d, p); }
  g.save(); g.translate(x, y); g.scale(size / 24, size / 24);
  g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
  g.stroke(p); g.restore();
}
const RK1 = { f: RAJ, w: 700, s: 13 }, RK2 = { f: BAR, s: 11 };
const MI = { f: RAJ, w: 700, s: 14 }, MS = { f: BAR, s: 11.5 }, MN = { f: BAR, s: 12 };
// Auswahl unter der offenen Zeile: Kopf, Halterungen, Liste, Knöpfe
function loPick(g, pk, y0) {
  const x0 = LO.p + 6, x1 = LO_W - LO.p - 4;
  const out = { y: y0, x0, x1 };
  let y = y0 + 22;
  if (pk.racks) {
    out.rackLabel = y + 10; y += 18;
    out.racks = [];
    let x = x0, row = 0;
    for (const r of pk.racks.list) {
      const sub = [r.sub, r.tag].filter(Boolean).join(' · ');
      const w = Math.max(58, Math.ceil(Math.max(measure(g, r.top, RK1), measure(g, sub, RK2))) + 18);
      if (x > x0 && x + w > x1) { x = x0; row += 1; }
      out.racks.push({ x, y: y + row * 40, w, h: 35, r, sub });
      x += w + 6;
    }
    y += (row + 1) * 40;
    out.rackInfo = y + 9; y += 20;
  }
  const n = pk.opts.length, vis = Math.min(n, LO.opts);
  out.opts = { x: x0, y, w: x1 - x0, h: vis * LO.oh, total: n * LO.oh };
  y += vis * LO.oh + 6;
  out.pills = [];
  let x = x0, row = 0;
  const add = (label, act) => {
    const w = Math.ceil(measure(g, label, lSt)) + 24;
    if (x > x0 && x + w > x1) { x = x0; row += 1; }
    out.pills.push({ x, w, row, label, act });
    x += w + 6;
  };
  if (pk.revert) add(pk.revert, `lo|revert|${pk.key}`);
  for (const l of pk.links ?? []) add(l.label, `href|${l.href}`);
  if (out.pills.length) { out.pillY = y; y += (row + 1) * 34; }
  out.h = y - y0 + 4;
  return out;
}
// Menü der Layouts unter dem Namensknopf
function loMenu(g, items) {
  const w = 256, x = LO_W - LO.p - w, y0 = 38;
  let y = y0 + 6;
  const rows = [];
  for (const it of items) {
    if (it.sep) { rows.push({ y, h: 9, it }); y += 9; continue; }
    if (it.head) { rows.push({ y, h: 22, it }); y += 22; continue; }
    if (it.note) { const lines = wrap2(g, it.note, w - 28, MN); rows.push({ y, h: lines.length * 15 + 8, it, lines }); y += lines.length * 15 + 8; continue; }
    rows.push({ y, h: 30, it }); y += 30;
  }
  return { x, y: y0, w, h: y - y0 + 6, rows };
}
function loLayout(g, d, ui) {
  const W = LO_W, { p } = LO;
  const yBody = LO.top + (d.cats.length ? LO.tabs : 0) + 4;
  const items = [];
  let y = 0, pick = null;
  for (const gr of d.groups) {
    items.push({ t: 'group', y, h: LO.gh, gr }); y += LO.gh;
    for (const r of gr.rows) {
      const it = { t: 'row', y, h: LO.rh + (r.changed ? LO.was : 0), r, open: d.pick?.key === r.key };
      items.push(it); y += it.h;
      if (it.open) { pick = loPick(g, d.pick, y); pick.row = it; y += pick.h; }
    }
    y += 4;
  }
  if (d.paints) {
    items.push({ t: 'group', y, h: LO.gh, gr: { title: d.paints.title } }); y += LO.gh;
    const cw = (W - 2 * p - 8) / 2;
    d.paints.list.forEach((pt, i) => items.push({ t: 'paint', x: p + (i % 2) * (cw + 8), y: y + Math.floor(i / 2) * (LO.ch + 8), w: cw, h: LO.ch, pt }));
    y += Math.ceil(d.paints.list.length / 2) * (LO.ch + 8);
  }
  if (d.empty) { items.push({ t: 'empty', y, h: 44 }); y += 44; }
  const contentH = y + 2;
  const menu = ui.menu ? loMenu(g, d.menu) : null;
  let H = yBody + Math.min(contentH, Math.max(150, (ui.maxH ?? 640) - yBody - LO.foot)) + LO.foot;
  if (menu) H = Math.max(H, menu.y + menu.h + 10);
  const hBody = H - yBody - LO.foot, max = Math.max(0, contentH - hBody);
  // eine frisch geöffnete Zeile samt Auswahl ins Bild rollen, die eingebaute Zeile in die Mitte ihrer Liste
  if (ui.reveal && pick && pick.row.r.key === ui.reveal) {
    const top = pick.row.y - 2, bottom = pick.y + pick.h + 4;
    if (top < ui.scroll || bottom > ui.scroll + hBody) ui.scroll = Math.min(top, Math.max(ui.scroll, bottom - hBody));
  }
  ui.scroll = clamp(ui.scroll ?? 0, 0, max);
  if (pick) {
    const pmax = Math.max(0, pick.opts.total - pick.opts.h);
    // das eingebaute Teil in die Mitte, auf ganze Zeilen
    if (ui.pReveal) { const i = d.pick.opts.findIndex((o) => o.on); ui.pscroll = i < 0 ? 0 : Math.max(0, i - Math.floor((LO.opts - 1) / 2)) * LO.oh; }
    ui.pscroll = clamp(ui.pscroll ?? 0, 0, pmax);
    pick.pmax = pmax;
  }
  return { W, H, yBody, hBody, contentH, max, items, pick, menu, footY: H - LO.foot };
}
function drawLoadout(g, d, hover, ui = {}) {
  const L = loLayout(g, d, ui), W = LO_W, { p } = LO;
  if (!g.canvas.dataset.h) return L.H;
  ui.reveal = null; ui.pReveal = false; ui.zones = { body: null, opts: null };
  const hits = [];
  card(g, W, L.H);
  head(g, d.title, p, 24);
  // Name des Layouts oben rechts: öffnet das Menü; beim Umbenennen ein Eingabefeld
  {
    const st = { f: RAJ, w: 700, s: 13.5, c: d.nameEdit && !d.name ? C.mut : C.txt };
    const label = d.nameEdit ? fitTail(g, d.name, 176, st) : fit(g, d.chip, 176, st);
    const lw = Math.max(74, Math.ceil(measure(g, label, st)) + (d.nameEdit ? 26 : 40)), x = W - p - lw, y = 8, on = hover === 'ui|menu' || ui.menu;
    g.save(); rr(g, x, y, lw, 26, 6);
    g.fillStyle = on ? 'rgba(143,211,255,.18)' : 'rgba(143,211,255,.08)'; g.fill();
    g.lineWidth = d.nameEdit ? 1.5 : 1; g.strokeStyle = d.nameEdit ? AMBER : on ? 'rgba(212,241,255,.75)' : 'rgba(143,211,255,.35)'; g.stroke(); g.restore();
    // ganz markiert, solange noch nichts getippt ist: die erste Taste ersetzt den Namen
    if (d.nameEdit === 'all' && label) { g.save(); g.fillStyle = rgba(AMBER, 0.28); g.fillRect(x + 10, y + 5, Math.ceil(measure(g, label, st)) + 4, 16); g.restore(); }
    const tw = text(g, label, x + 12, y + 18, st);
    if (d.nameEdit) { g.save(); g.fillStyle = AMBER; g.fillRect(x + 13 + tw, y + 6, 1.5, 14); g.restore(); }
    else { g.save(); g.strokeStyle = C.cy; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + lw - 20, y + 11); g.lineTo(x + lw - 15, y + 16); g.lineTo(x + lw - 10, y + 11); g.stroke(); g.restore(); }
    hits.push({ x, y, w: lw, h: 26, act: 'ui|menu' });
  }
  // Reiter wie im Spiel: Waffen, Systeme, Lackierung; die Zahl nennt die Tausche darin
  if (d.cats.length) {
    const y = LO.top, tw = (W - 2 * p) / d.cats.length;
    d.cats.forEach((c, i) => {
      const x = p + i * tw, act = `lo|cat|${c.id}`, hot = hover === act && !c.on;
      const st = { f: RAJ, w: 700, s: 13, ls: '0.12em', c: c.on || hot ? C.txt : C.mut, al: 'center' };
      if (c.on) st.glow = 'rgba(110,200,255,.6)';
      const lab = c.label.toLocaleUpperCase(), lw = measure(g, lab, st), bw = c.n ? 20 : 0;
      text(g, lab, x + tw / 2 - bw / 2, y + 19, st);
      if (c.n) {
        const bx = x + tw / 2 - bw / 2 + lw / 2 + 12;
        g.save(); g.beginPath(); g.arc(bx, y + 14, 7.5, 0, Math.PI * 2); g.fillStyle = AMBER; g.shadowColor = AMBER; g.shadowBlur = 5 * S; g.fill(); g.restore();
        text(g, String(c.n), bx, y + 18, { f: RAJ, w: 700, s: 11, c: INK, al: 'center' });
      }
      g.save(); rr(g, x + 6, y + 28, tw - 12, c.on ? 2.5 : 1, 1); g.fillStyle = c.on ? C.cy : hot ? 'rgba(212,241,255,.6)' : 'rgba(143,211,255,.25)';
      if (c.on) { g.shadowColor = C.cy; g.shadowBlur = 8 * S; }
      g.fill(); g.restore();
      hits.push({ x, y, w: tw, h: LO.tabs - 2, act });
    });
  }
  // ── Liste: rollt zwischen Reitern und Fuß ──
  const yB = L.yBody, hB = L.hBody, oy = yB - ui.scroll;
  // Knopf in der Liste: nur, was im Fenster liegt
  const hit = (x, y, w, h, act, y0 = yB, y1 = yB + hB) => {
    const t = Math.max(y, y0), b = Math.min(y + h, y1);
    if (b - t > 4) hits.push({ x, y: t, w, h: b - t, act });
  };
  g.save(); g.beginPath(); g.rect(0, yB, W, hB); g.clip();
  for (const it of L.items) {
    const y = oy + it.y;
    if (y > yB + hB || y + it.h + (it.open ? L.pick.h : 0) < yB) continue;
    if (it.t === 'group') {
      text(g, it.gr.title.toLocaleUpperCase(), p, y + 18, { f: RAJ, w: 700, s: 11.5, c: C.cy, ls: '0.14em', glow: 'rgba(110,200,255,.6)' });
      let rx = W - p;
      if (it.gr.delta) rx -= text(g, it.gr.delta, rx, y + 18, { f: RAJ, w: 700, s: 12.5, c: toneOf(it.gr.dir), al: 'right' }) + 8;
      if (it.gr.total) text(g, it.gr.total, rx, y + 18, { f: RAJ, w: 700, s: 13.5, c: C.txt, al: 'right' });
    } else if (it.t === 'row') {
      const r = it.r, act = `lo|slot|${r.key}`, hot = hover === act, tint = tintOf(r.type, r.dt), mark = r.changed ? AMBER : tint;
      if (r.changed) { g.save(); rr(g, 4, y + 1, W - 8, it.h - 2, 6); g.fillStyle = 'rgba(245,166,35,.07)'; g.fill(); g.restore(); }
      if (it.open || hot) {
        g.save(); rr(g, 4, y + 1, W - 8, it.h - 2 + (it.open ? L.pick.h : 0), 6);
        g.fillStyle = it.open ? 'rgba(143,211,255,.11)' : 'rgba(143,211,255,.15)'; g.fill();
        if (it.open) { g.lineWidth = 1; g.strokeStyle = 'rgba(143,211,255,.5)'; g.stroke(); }
        g.restore();
      }
      // getauscht: Bernsteinkante links wie in der Werkstatt
      if (r.changed) { g.save(); rr(g, 4, y + 6, 3, it.h - 12, 1.5); g.fillStyle = AMBER; g.shadowColor = AMBER; g.shadowBlur = 5 * S; g.fill(); g.restore(); }
      else if (hot) { g.save(); rr(g, 4, y + 8, 3, it.h - 16, 1.5); g.fillStyle = '#d4f1ff'; g.shadowColor = C.cy; g.shadowBlur = 6 * S; g.fill(); g.restore(); }
      // Nummer wie am Port
      const cy = y + 21;
      g.save(); g.beginPath(); g.arc(p + 12, cy, 9.5, 0, Math.PI * 2);
      if (it.open) { g.fillStyle = C.cy; g.shadowColor = C.cy; g.shadowBlur = 8 * S; g.fill(); }
      else { g.lineWidth = hot ? 2.2 : 1.4; g.strokeStyle = hot ? '#ffffff' : C.cy; g.stroke(); }
      g.restore();
      text(g, String(r.n), p + 12, cy + 4.5, { f: RAJ, w: 700, s: 12, al: 'center', c: it.open ? INK : C.txt });
      // Sockel: Zeichen der Art im Farbton, darunter die Größe
      const sx = p + 28, sy = y + 5;
      g.save(); rr(g, sx, sy, 30, 30, 7);
      const sg = g.createRadialGradient(sx + 15, sy + 9, 0, sx + 15, sy + 9, 22);
      sg.addColorStop(0, rgba(mark, 0.2)); sg.addColorStop(1, rgba(mark, 0.05));
      g.fillStyle = sg; g.fill();
      if (r.changed) { g.shadowColor = AMBER; g.shadowBlur = 5 * S; }
      g.lineWidth = 1; g.strokeStyle = rgba(mark, r.changed ? 0.8 : 0.5); g.stroke(); g.restore();
      icon(g, d.icons?.[r.type] ?? d.icons?.gun, sx + 6, sy + 4, 18, mark);
      {
        const st = { f: RAJ, w: 700, s: 9.5 }, w = Math.ceil(measure(g, r.size, st)) + 8;
        g.save(); rr(g, sx + 15 - w / 2, sy + 24, w, 12, 3); g.fillStyle = '#071c30'; g.fill(); g.lineWidth = 1; g.strokeStyle = rgba(mark, 0.6); g.stroke(); g.restore();
        text(g, r.size, sx + 15, sy + 33.5, { ...st, c: r.changed ? AMBER : C.sub, al: 'center' });
      }
      const tx = p + 66, fw = Math.max(measure(g, r.figure, { f: RAJ, w: 700, s: 15 }), measure(g, r.unit, { f: BAR, s: 11.5 }));
      const nSt = { f: RAJ, w: 700, s: 15 }, room = W - p - tx - fw - 10;
      text(g, fit(g, r.name, room, nSt), tx, y + 18, nSt);
      text(g, fit(g, r.sub, room, { f: BAR, s: 12 }), tx, y + 33, { f: BAR, s: 12, c: C.mut });
      text(g, r.figure, W - p, y + 18, { f: RAJ, w: 700, s: 15, al: 'right', glow: GLOW });
      text(g, r.unit, W - p, y + 33, { f: BAR, s: 11.5, c: C.mut, al: 'right' });
      if (r.changed) {
        const dw = r.delta ? text(g, r.delta, W - p, y + 47, { f: RAJ, w: 700, s: 12, c: toneOf(r.dir), al: 'right' }) + 8 : 0;
        text(g, fit(g, r.was, W - p - tx - dw, { f: BAR, s: 11.5 }), tx, y + 47, { f: BAR, s: 11.5, c: '#cfae74' });
      }
      hit(4, y, W - 8, it.h, act);
      if (!it.open) continue;
      // Auswahl: was hier passt, das eingebaute und das Serienteil benannt
      const P = L.pick, pk = d.pick, py = oy;
      text(g, `${pk.head} · ${pk.count}`.toLocaleUpperCase(), P.x0, py + P.y + 15, { f: RAJ, w: 700, s: 10.5, c: C.mut, ls: '0.12em' });
      if (P.racks) {
        text(g, pk.racks.label.toLocaleUpperCase(), P.x0, py + P.rackLabel, { f: RAJ, w: 700, s: 10.5, c: C.mut, ls: '0.12em' });
        for (const b of P.racks) {
          const ract = `lo|rack|${pk.key}|${b.r.id}`, rh = hover === ract, by = py + b.y;
          g.save(); rr(g, b.x, by, b.w, b.h, 6);
          g.fillStyle = b.r.on ? 'rgba(143,211,255,.18)' : rh ? 'rgba(143,211,255,.10)' : 'rgba(143,211,255,.04)'; g.fill();
          g.lineWidth = 1; g.strokeStyle = b.r.on ? '#d4f1ff' : rh ? 'rgba(212,241,255,.6)' : 'rgba(143,211,255,.3)'; g.stroke(); g.restore();
          text(g, b.r.top, b.x + 9, by + 15, { ...RK1, c: b.r.on ? C.txt : C.sub });
          text(g, b.sub, b.x + 9, by + 28, { ...RK2, c: C.mut });
          if (!b.r.on) hit(b.x, by, b.w, b.h, ract);
        }
        text(g, fit(g, pk.racks.info, P.x1 - P.x0, { f: BAR, s: 11.5 }), P.x0, py + P.rackInfo, { f: BAR, s: 11.5, c: C.mut });
      }
      const O = P.opts, oy0 = py + O.y, v0 = Math.max(yB, oy0), v1 = Math.min(yB + hB, oy0 + O.h);
      ui.zones.opts = v1 > v0 ? { x: O.x, y: v0, w: O.w, h: v1 - v0, max: P.pmax } : null;
      g.save(); g.beginPath(); g.rect(O.x - 2, oy0, O.w + 4, O.h); g.clip();
      pk.opts.forEach((o, i) => {
        const yy = oy0 + i * LO.oh - ui.pscroll;
        if (yy + LO.oh < oy0 || yy > oy0 + O.h) return;
        const oact = `lo|opt|${pk.key}|${o.id}`, oh = hover === oact, ot = tintOf(o.type, o.dt);
        if (o.on || oh) {
          g.save(); rr(g, O.x, yy + 1, O.w - (P.pmax ? 6 : 0), LO.oh - 3, 5);
          g.fillStyle = o.on ? 'rgba(143,211,255,.16)' : 'rgba(143,211,255,.10)'; g.fill();
          if (oh) { g.lineWidth = 1; g.strokeStyle = 'rgba(212,241,255,.7)'; g.stroke(); }
          g.restore();
        }
        const right = O.x + O.w - (P.pmax ? 12 : 6), nx = O.x + 20;
        g.save(); g.beginPath(); g.arc(O.x + 10, yy + 11, 3.5, 0, Math.PI * 2); g.fillStyle = ot; g.shadowColor = ot; g.shadowBlur = 4 * S; g.fill(); g.restore();
        if (o.delta) text(g, o.delta, right, yy + 15, { f: RAJ, w: 700, s: 12, al: 'right', c: toneOf(o.dir) });
        text(g, o.figure, right - 56, yy + 15, { f: RAJ, w: 700, s: 13.5, al: 'right', c: C.txt });
        const nmSt = { f: RAJ, w: 700, s: 13.5, c: o.on ? C.txt : C.sub };
        const tagW = o.tag ? measure(g, o.tag, { f: BAR, s: 10.5 }) + 16 : 0;
        const nameRoom = right - 56 - measure(g, o.figure, { f: RAJ, w: 700, s: 13.5 }) - 8 - nx;
        const nw = text(g, fit(g, o.name, nameRoom - tagW, nmSt), nx, yy + 15, nmSt);
        if (o.tag) {
          const tw = tagW - 6, tgx = nx + nw + 6;
          g.save(); rr(g, tgx, yy + 4, tw, 14, 7); g.lineWidth = 1; g.strokeStyle = o.on ? 'rgba(212,241,255,.75)' : 'rgba(143,211,255,.35)'; g.stroke(); g.restore();
          text(g, o.tag, tgx + tw / 2, yy + 14.5, { f: BAR, s: 10.5, c: o.on ? C.txt : C.mut, al: 'center' });
        }
        text(g, fit(g, o.sub, right - nx, { f: BAR, s: 11 }), nx, yy + 28, { f: BAR, s: 11, c: C.mut });
        // Wertbalken bis zum stärksten passenden Teil
        g.save(); g.fillStyle = 'rgba(143,211,255,.14)'; g.fillRect(nx, yy + LO.oh - 4.5, right - nx, 2);
        g.fillStyle = rgba(ot, 0.85); g.fillRect(nx, yy + LO.oh - 4.5, Math.max(2, (right - nx) * clamp(o.bar, 0, 1)), 2); g.restore();
        // das eingebaute Teil ist kein Knopf, meldet sich aber unter dem Zeiger: sein Datenblatt (lo|peek)
        hit(O.x, yy, O.w, LO.oh, o.on ? `lo|peek|${pk.key}|${o.id}` : oact, v0, v1);
      });
      g.restore();
      if (P.pmax) {
        const th = Math.max(18, O.h * (O.h / O.total)), ty = oy0 + (O.h - th) * (ui.pscroll / P.pmax);
        g.save(); rr(g, O.x + O.w - 3, oy0, 3, O.h, 1.5); g.fillStyle = 'rgba(143,211,255,.12)'; g.fill();
        rr(g, O.x + O.w - 3, ty, 3, th, 1.5); g.fillStyle = 'rgba(143,211,255,.6)'; g.fill(); g.restore();
      }
      for (const b of P.pills) {
        const by = py + P.pillY + b.row * 34, rev = b.act.startsWith('lo|revert');
        const r2 = pill(g, b.x + b.w, by, b.label, { c: rev ? AMBER : C.cy, border: rev ? rgba(AMBER, 0.55) : 'rgba(143,211,255,.45)', hover: hover === b.act });
        hit(r2.x, r2.y, r2.w, r2.h, b.act);
      }
    } else if (it.t === 'paint') {
      // Lackierung: drei Töne (Haupt, Zweit, Akzent) als Farbfeld, die gewählte mit Rahmen und Haken
      const pt = it.pt, act = `lo|paint|${pt.id}`, hot = hover === act;
      g.save(); rr(g, it.x, y, it.w, it.h, 7);
      g.fillStyle = pt.on ? 'rgba(143,211,255,.16)' : hot ? 'rgba(143,211,255,.10)' : 'rgba(143,211,255,.04)'; g.fill();
      g.lineWidth = pt.on ? 1.5 : 1; g.strokeStyle = pt.on ? '#d4f1ff' : hot ? 'rgba(212,241,255,.6)' : 'rgba(143,211,255,.25)'; g.stroke(); g.restore();
      const sx = it.x + 7, sw = it.w - 14, sy = y + 7, sh = 24;
      g.save(); rr(g, sx, sy, sw, sh, 4); g.clip();
      g.fillStyle = pt.cols[0]; g.fillRect(sx, sy, sw / 2, sh);
      g.fillStyle = pt.cols[1]; g.fillRect(sx + sw / 2, sy, sw / 4, sh);
      g.fillStyle = pt.cols[2]; g.fillRect(sx + sw * 0.75, sy, sw / 4 + 1, sh);
      g.restore();
      g.save(); rr(g, sx, sy, sw, sh, 4); g.lineWidth = 1; g.strokeStyle = 'rgba(230,246,255,.22)'; g.stroke(); g.restore();
      const nSt = { f: RAJ, w: 700, s: 12.5, c: pt.on ? C.txt : C.sub };
      text(g, fit(g, pt.name, sw - (pt.on ? 14 : 0), nSt), sx, y + 46, nSt);
      if (pt.note) text(g, fit(g, pt.note, sw, { f: BAR, s: 10 }), sx, y + 56, { f: BAR, s: 10, c: C.mut });
      if (pt.on) text(g, '✓', it.x + it.w - 8, y + 46, { f: RAJ, w: 700, s: 13, c: C.cy, al: 'right' });
      else hit(it.x, y, it.w, it.h, act);
    } else if (it.t === 'empty') {
      wrap2(g, d.empty, W - 2 * p, { f: BAR, s: 13 }).forEach((l, i) => text(g, l, p, y + 20 + i * 17, { f: BAR, s: 13, c: C.mut }));
    }
  }
  g.restore();
  ui.zones.body = { x: 0, y: yB, w: W, h: hB, max: L.max };
  if (L.max) {
    const th = Math.max(24, hB * (hB / L.contentH)), ty = yB + (hB - th) * (ui.scroll / L.max);
    g.save(); rr(g, W - 5, ty, 3, th, 1.5); g.fillStyle = 'rgba(143,211,255,.55)'; g.fill(); g.restore();
    // weiche Kanten, wo die Liste weiterläuft
    for (const [on, y0, y1] of [[ui.scroll > 1, yB, yB + 14], [ui.scroll < L.max - 1, yB + hB, yB + hB - 14]]) {
      if (!on) continue;
      const f = g.createLinearGradient(0, y0, 0, y1); f.addColorStop(0, 'rgba(6,24,42,.92)'); f.addColorStop(1, 'rgba(6,24,42,0)');
      g.save(); g.fillStyle = f; g.fillRect(2, Math.min(y0, y1), W - 4, 14); g.restore();
    }
  }
  // Meldung der Werkstatt (Gespeichert, Link kopiert) oder der Hinweis am geteilten Layout
  const msgTxt = d.toast || d.note;
  if (msgTxt) {
    const st = { f: BAR, s: 12.5, c: C.txt }, lines = wrap2(g, msgTxt, W - 2 * p - 20, st), h = lines.length * 16 + 12, y = L.footY - h - 6;
    g.save(); rr(g, p, y, W - 2 * p, h, 6); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 10 * S; g.fillStyle = 'rgba(8,26,44,.98)'; g.fill();
    g.shadowBlur = 0; g.lineWidth = 1.2; g.strokeStyle = d.toast ? AMBER : rgba(AMBER, 0.55); g.stroke(); g.restore();
    lines.forEach((l, i) => text(g, l, p + 10, y + 18 + i * 16, st));
  }
  // ── Fuß: Stand des Layouts, Speichern, Teilen, Serie ──
  {
    const y = L.footY, s = d.state;
    g.save(); g.fillStyle = 'rgba(143,211,255,.22)'; g.fillRect(p, y + 2, W - 2 * p, 1); g.restore();
    let x = p;
    if (s.s === 'saved') x += text(g, '✓', x, y + 22, { f: RAJ, w: 700, s: 13, c: AMBER }) + 5;
    else { g.save(); g.beginPath(); g.arc(x + 4, y + 17.5, 3.5, 0, Math.PI * 2); g.fillStyle = s.s === 'changed' ? AMBER : C.mut; if (s.s === 'changed') { g.shadowColor = AMBER; g.shadowBlur = 5 * S; } g.fill(); g.restore(); x += 14; }
    const st = { f: BAR, w: 500, s: 12.5, c: C.txt };
    x += text(g, fit(g, s.text, W - p - x, st), x, y + 22, st);
    if (s.sub) text(g, fit(g, ` · ${s.sub}`, W - p - x, { f: BAR, s: 12.5 }), x, y + 22, { f: BAR, s: 12.5, c: s.s === 'saved' ? AMBER : C.mut });
    // Knöpfe von links: Speichern trägt die Fläche
    const bSt = { f: RAJ, w: 700, s: 13.5 };
    let total = -6;
    for (const b of d.btns) total += Math.ceil(measure(g, b.label, bSt)) + 24 + 6;
    while (total > W - 2 * p && bSt.s > 11) { bSt.s -= 0.5; total = -6; for (const b of d.btns) total += Math.ceil(measure(g, b.label, bSt)) + 24 + 6; }
    let bx = p;
    const by = y + 31;
    for (const b of d.btns) {
      const w = Math.ceil(measure(g, b.label, bSt)) + 24, act = `lo|${b.id}`, hot = hover === act && !b.off;
      g.save(); if (b.off) g.globalAlpha = 0.4;
      rr(g, bx, by, w, 28, 14);
      if (b.main) { g.fillStyle = hot ? '#d4f1ff' : C.cy; g.shadowColor = C.cy; g.shadowBlur = (hot ? 12 : 7) * S; g.fill(); }
      else { if (hot) { g.fillStyle = 'rgba(143,211,255,.16)'; g.fill(); } g.lineWidth = 1; g.strokeStyle = hot ? 'rgba(212,241,255,.75)' : 'rgba(143,211,255,.38)'; g.stroke(); }
      g.restore();
      g.save(); if (b.off) g.globalAlpha = 0.4;
      text(g, b.label, bx + w / 2, by + 19, { ...bSt, c: b.main ? INK : hot ? C.txt : C.sub, al: 'center' });
      g.restore();
      if (!b.off) hits.push({ x: bx, y: by, w, h: 28, act });
      bx += w + 6;
    }
  }
  // ── Menü der Layouts, über allem ──
  if (L.menu) {
    const M = L.menu;
    hits.push({ x: 0, y: 0, w: W, h: L.H, act: 'ui|shut' });
    hits.push({ x: W - p - 200, y: 8, w: 200, h: 26, act: 'ui|menu' });
    g.save(); rr(g, M.x, M.y, M.w, M.h, 7); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 18 * S;
    g.fillStyle = 'rgba(6,24,42,.98)'; g.fill(); g.shadowBlur = 0; g.lineWidth = 1.2; g.strokeStyle = 'rgba(143,211,255,.6)'; g.stroke(); g.restore();
    M.rows.forEach((row, i) => {
      const it = row.it, y = row.y;
      if (it.sep) { g.save(); g.fillStyle = 'rgba(143,211,255,.22)'; g.fillRect(M.x + 10, y + 4, M.w - 20, 1); g.restore(); return; }
      if (it.head) { text(g, it.head.toLocaleUpperCase(), M.x + 14, y + 16, { f: RAJ, w: 700, s: 10.5, c: C.mut, ls: '0.14em' }); return; }
      if (it.note) { row.lines.forEach((l, j) => text(g, l, M.x + 14, y + 15 + j * 15, { ...MN, c: C.mut })); return; }
      const act = it.href ? `href|${it.href}` : it.act[0] === 'rename' ? 'ui|rename' : `lo|${it.act.join('|')}`, hot = hover === act;
      if (it.on || hot) { g.save(); rr(g, M.x + 5, y, M.w - 10, row.h - 2, 5); g.fillStyle = hot ? 'rgba(143,211,255,.18)' : 'rgba(143,211,255,.11)'; g.fill(); g.restore(); }
      if (it.on) text(g, '✓', M.x + 14, y + 19, { f: RAJ, w: 700, s: 13, c: C.cy });
      const sw = it.sub ? measure(g, it.sub, MS) + 10 : 0;
      const st = { ...MI, c: it.href || it.act?.[0] === 'saveNew' ? C.cy : C.txt };
      text(g, fit(g, it.label, M.w - 44 - sw, st), M.x + 30, y + 19, st);
      if (it.sub) text(g, it.sub, M.x + M.w - 12, y + 19, { ...MS, c: C.mut, al: 'right' });
      hits.push({ x: M.x + 5, y, w: M.w - 10, h: row.h - 2, act });
    });
  }
  return hits;
}
drawLoadout.W = LO_W;

// ─── Datenblatt des Bauteils: rechte Tafel, solange ein Slot offen steht ──
// Einordnung wie in Detail Pages 2.0 (Richtung B): jeder Wert als Streifen
// seiner Klasse. Jedes Teil der Klasse ein Punkt (mehrere mit demselben Wert:
// ein größerer), dieses hell, das Vergleichsteil als Ring, der Strich ist der
// Median; rechts ist immer besser. Darunter die Wege, die es gibt (Herstellen
// im Orange des Craftings), und was der Tausch am Schiff ändert. Wörter und
// Zahlen kommen fertig von der Werkstatt (assets/hangar-layouts.js, sheetOf).
// d = { key, head, tag, type, dt, size, icon, name, line, lead: [[text, fett]],
//   strips: [{ label, value, unit, short, hint, med, dots: [[x, n]], me, fit, delta, dir }],
//   legend: { me, fit, all }, ways: [{ k, v, u, s, s2, tone, href }], rows,
//   effect: { label, text, delta, dir } | null, buttons: [{ label, main, craft, a, href }], model }
// rows: so viele Wege hat das reichste Teil der Auswahl; die Tafel hält den
// Platz frei, damit sie beim Blättern durch die Liste nicht springt.
// Knöpfe: it|b|<i> (buttons), it|w|<i> (Weg mit Adresse).
const ITEM_W = 370;
const CRAFT = '#ff9a55';
const IT = { p: 14, yHead: 23, ySock: 36, yLead: 100, lh: 17, lead: 3, sh: 40, wr: 28 };
// Text aus Stücken [text, fett] umbrechen; dry: nur zählen
function rich(g, segs, x, y, max, lh, st, dry) {
  let cx = x, cy = y, lines = 1;
  for (const [t, b] of segs) {
    const o = b ? { ...st, w: 600, c: C.txt } : st;
    for (const word of String(t).match(/\S+\s*|\s+/g) ?? []) {
      if (cx > x && cx + measure(g, word.trimEnd(), o) > x + max) { cx = x; cy += lh; lines++; }
      if (!dry && (cx > x || word.trim())) text(g, word, cx, cy, o);
      cx += cx === x && !word.trim() ? 0 : measure(g, word, o);
    }
  }
  return lines;
}
// Der Satz der Einordnung, höchstens IT.lead Zeilen: passt er nicht, endet er nach dem ersten Punkt
function leadOf(g, d, st) {
  const max = ITEM_W - 2 * IT.p;
  if (rich(g, d.lead, 0, 0, max, IT.lh, st, true) <= IT.lead) return d.lead;
  const i = d.lead.findIndex(([t]) => /[.!?]\s*$/.test(t) || /[.!?]\s/.test(t));
  return i < 0 ? d.lead : d.lead.slice(0, i + 1).map(([t, b], j, a) => (j === a.length - 1 ? [t.replace(/([.!?])\s.*$/, '$1'), b] : [t, b]));
}
function drawItem(g, d, hover, ui = {}) {
  const W = ITEM_W, { p, yHead, ySock, yLead, lh, sh, wr } = IT;
  const leadSt = { f: BAR, w: 400, s: 13, c: C.sub };
  const rows = Math.max(d.rows ?? 0, d.ways.length);
  // Höhe: voll, oder knapper, wenn über dem Platz der Tafel nicht genug frei ist
  // (1: ohne den Satz, 2: auch ohne Legende und „Am Schiff“)
  const plan = (lv) => {
    const yStr = lv ? yLead - 8 : yLead + (IT.lead - 1) * lh + 14;
    const yLeg = yStr + d.strips.length * sh + 2;
    const yWay = yLeg + (lv < 2 ? 20 : 4);
    const yEff = yWay + rows * wr + (rows ? 4 : 0);
    const yBtn = yEff + (d.effect && lv < 2 ? 34 : 6);
    return { lv, yStr, yLeg, yWay, yEff, yBtn, H: yBtn + 28 + 13 };
  };
  let L = plan(0);
  for (let lv = 1; lv <= 2 && L.H > (ui.maxH ?? Infinity); lv++) L = plan(lv);
  if (!g.canvas.dataset.h) return L.H;
  const hits = [];
  card(g, W, L.H);
  const tint = tintOf(d.type, d.dt);
  // Kopf: wessen Datenblatt, und sein Stand am Slot
  head(g, d.head, p, yHead);
  if (d.tag) {
    const st = { f: BAR, w: 500, s: 11, c: C.sub }, w = Math.ceil(measure(g, d.tag, st)) + 16;
    g.save(); rr(g, W - p - w, yHead - 14, w, 19, 9.5); g.lineWidth = 1; g.strokeStyle = 'rgba(143,211,255,.45)'; g.stroke(); g.restore();
    text(g, d.tag, W - p - w / 2, yHead - 0.5, { ...st, al: 'center' });
  }
  // Sockel wie in der Liste links, eine Nummer größer
  const sx = p, sy = ySock;
  g.save(); rr(g, sx, sy, 42, 42, 9);
  const sg = g.createRadialGradient(sx + 21, sy + 13, 0, sx + 21, sy + 13, 30);
  sg.addColorStop(0, rgba(tint, 0.26)); sg.addColorStop(1, rgba(tint, 0.06));
  g.fillStyle = sg; g.fill(); g.lineWidth = 1; g.strokeStyle = rgba(tint, 0.6); g.stroke(); g.restore();
  icon(g, d.icon, sx + 9, sy + 6, 24, tint);
  {
    const st = { f: RAJ, w: 700, s: 10.5 }, w = Math.ceil(measure(g, d.size, st)) + 10;
    g.save(); rr(g, sx + 21 - w / 2, sy + 33, w, 14, 3.5); g.fillStyle = '#071c30'; g.fill(); g.lineWidth = 1; g.strokeStyle = rgba(tint, 0.6); g.stroke(); g.restore();
    text(g, d.size, sx + 21, sy + 44, { ...st, c: C.sub, al: 'center' });
  }
  const nx = p + 54, nSt = { f: ORB, w: 900, s: 16, ls: '0.04em', glow: GLOW };
  const nm = d.name.toLocaleUpperCase();
  while (nSt.s > 11.5 && measure(g, nm, nSt) > W - p - nx) nSt.s -= 0.5;
  text(g, fit(g, nm, W - p - nx, nSt), nx, sy + 19, nSt);
  text(g, fit(g, d.line, W - p - nx, { f: BAR, s: 13 }), nx, sy + 38, { f: BAR, s: 13, c: C.sub });
  // Einordnung in einem Satz
  if (!L.lv) rich(g, leadOf(g, d, leadSt), p, yLead, W - 2 * p, lh, leadSt, false);
  // Streifen
  const tx0 = p + 5, tx1 = W - p - 5, tw = tx1 - tx0;
  d.strips.forEach((s, i) => {
    const y = L.yStr + i * sh;
    const lw = text(g, s.label.toLocaleUpperCase(), p, y + 13, { f: RAJ, w: 700, s: 11.5, c: C.cy, ls: '0.14em', glow: 'rgba(110,200,255,.6)' });
    // rechts: Abstand zum Vergleichsteil, davor Zahl und Einheit
    const dSt = s.dir ? { f: RAJ, w: 700, s: 12.5, c: toneOf(s.dir), al: 'right' } : { f: BAR, s: 11.5, c: C.mut, al: 'right' };
    const dw = s.delta ? text(g, s.delta, W - p, y + 13, dSt) + 10 : 0;
    const uSt = { f: BAR, s: 11.5, c: C.mut, al: 'right' };
    const uw = s.unit ? text(g, s.unit, W - p - dw, y + 13, uSt) + 4 : 0;
    const vw = text(g, s.value, W - p - dw - uw, y + 13, { f: RAJ, w: 700, s: 15, al: 'right', glow: GLOW });
    // dazwischen der Platz in der Klasse; „weniger ist besser“ nur, wo es Platz hat
    const room = W - p - dw - uw - vw - 10 - (p + lw + 9), rSt = { f: BAR, s: 11.5, c: C.mut };
    const full = [s.short, s.hint].filter(Boolean).join(' · ');
    const note = measure(g, full, rSt) <= room ? full : s.hint && !s.short ? s.hint : measure(g, `${s.short} ↓`, rSt) <= room && s.hint ? `${s.short} ↓` : s.short;
    if (note) text(g, fit(g, note, Math.max(0, room), rSt), p + lw + 9, y + 13, rSt);
    const ty = y + 27;
    g.save();
    g.fillStyle = 'rgba(143,211,255,.20)'; rr(g, tx0 - 5, ty - 1.5, tw + 10, 3, 1.5); g.fill();
    if (s.me != null) {
      g.fillStyle = 'rgba(190,230,255,.55)'; g.fillRect(tx0 + tw * s.med / 100 - 0.75, ty - 6, 1.5, 12);
      for (const [x, n] of s.dots) { g.beginPath(); g.arc(tx0 + tw * x / 100, ty, 2.5 + Math.min(4, n - 1) * 0.6, 0, Math.PI * 2); g.fillStyle = 'rgba(143,211,255,.62)'; g.fill(); }
      const mx = tx0 + tw * s.me / 100;
      if (s.fit != null) {
        const fx = tx0 + tw * s.fit / 100, same = Math.abs(fx - mx) < 1;
        g.beginPath(); g.arc(fx, ty, same ? 8 : 6, 0, Math.PI * 2); g.lineWidth = 1.5; g.strokeStyle = '#d4f1ff'; g.stroke();
      }
      g.beginPath(); g.arc(mx, ty, 4.6, 0, Math.PI * 2); g.fillStyle = '#f2fbff'; g.shadowColor = C.cy; g.shadowBlur = 8 * S; g.fill();
    }
    g.restore();
  });
  // Legende: dieses Teil, das Vergleichsteil (falls es eines gibt), die Klasse
  if (L.lv < 2) {
    const st = { f: BAR, s: 11, c: C.mut }; let x = p + 4; const y = L.yLeg + 9;
    g.save(); g.beginPath(); g.arc(x, y - 4, 4, 0, Math.PI * 2); g.fillStyle = '#f2fbff'; g.shadowColor = C.cy; g.shadowBlur = 6 * S; g.fill(); g.restore();
    x += 9; x += text(g, d.legend.me, x, y, st) + 14;
    if (d.legend.fit) {
      g.save(); g.beginPath(); g.arc(x + 1, y - 4, 4.6, 0, Math.PI * 2); g.lineWidth = 1.4; g.strokeStyle = '#d4f1ff'; g.stroke(); g.restore();
      x += 10; x += text(g, d.legend.fit, x, y, st) + 14;
    }
    g.save(); g.beginPath(); g.arc(x, y - 4, 2.4, 0, Math.PI * 2); g.fillStyle = 'rgba(143,211,255,.6)'; g.fill(); g.restore();
    x += 7; text(g, fit(g, d.legend.all, W - p - x, st), x, y, st);
  }
  // Wege zum Bauteil; ein Weg mit Adresse ist ein Knopf
  d.ways.forEach((w, i) => {
    const y = L.yWay + i * wr, craft = w.tone === 'craft', col = craft ? CRAFT : C.cy, act = `it|w|${i}`, hot = !!w.href && hover === act;
    g.save(); rr(g, p, y, W - 2 * p, wr - 4, 5);
    g.fillStyle = craft ? `rgba(255,154,85,${hot ? 0.2 : 0.1})` : 'rgba(143,211,255,.06)'; g.fill();
    g.lineWidth = 1; g.strokeStyle = craft ? `rgba(255,154,85,${hot ? 0.85 : 0.5})` : 'rgba(143,211,255,.2)'; g.stroke(); g.restore();
    text(g, w.k.toLocaleUpperCase(), p + 10, y + 17, { f: RAJ, w: 700, s: 11, c: col, ls: '0.13em', glow: craft ? 'rgba(255,154,85,.5)' : 'rgba(110,200,255,.6)' });
    const vw = text(g, w.v, p + 104, y + 17.5, { f: RAJ, w: 700, s: 15, c: C.txt });
    const uw = w.u ? text(g, w.u, p + 104 + vw + 4, y + 17.5, { f: BAR, s: 11.5, c: C.sub }) + 4 : 0;
    const arrow = w.href ? 14 : 0, sx0 = p + 104 + vw + uw + 12;
    // passt der Zusatz nicht ganz, steht seine kurze Fassung da (Kaufen: die Zahl der Orte ohne den Ortsnamen)
    const sSt = { f: BAR, s: 11.5 }, sMax = Math.max(0, W - p - 10 - arrow - sx0);
    const sub = w.s2 && measure(g, w.s, sSt) > sMax ? w.s2 : w.s;
    if (sub) text(g, fit(g, sub, sMax, sSt), W - p - 10 - arrow, y + 17.5, { ...sSt, c: C.mut, al: 'right' });
    if (w.href) { text(g, '›', W - p - 9, y + 18, { f: RAJ, w: 700, s: 15, c: col, al: 'right' }); hits.push({ x: p, y, w: W - 2 * p, h: wr - 4, act }); }
  });
  // Was der Tausch am Schiff ändert
  if (d.effect && L.lv < 2) {
    const y = L.yEff;
    g.save(); g.fillStyle = 'rgba(143,211,255,.20)'; g.fillRect(p, y, W - 2 * p, 1); g.restore();
    const lw = text(g, d.effect.label.toLocaleUpperCase(), p, y + 20, { f: RAJ, w: 700, s: 10.5, c: C.mut, ls: '0.13em' });
    const dw = d.effect.delta ? text(g, d.effect.delta, W - p, y + 20, { f: RAJ, w: 700, s: 12.5, c: toneOf(d.effect.dir), al: 'right' }) : 0;
    text(g, fit(g, d.effect.text, W - 2 * p - lw - dw - 18, { f: BAR, w: 500, s: 12.5 }), p + lw + 9, y + 20, { f: BAR, w: 500, s: 12.5, c: C.txt });
  }
  // Knöpfe: Einbauen trägt die Fläche, das Crafting sein Orange
  const bSt = { f: RAJ, w: 700, s: 13.5 };
  const widths = () => d.buttons.map((b) => Math.ceil(measure(g, b.label, bSt)) + 26);
  while (bSt.s > 11 && widths().reduce((a, b) => a + b + 6, -6) > W - 2 * p) bSt.s -= 0.5;
  let bx = p;
  d.buttons.forEach((b, i) => {
    const w = widths()[i], act = `it|b|${i}`, hot = hover === act;
    g.save(); rr(g, bx, L.yBtn, w, 28, 14);
    if (b.main) { g.fillStyle = hot ? '#d4f1ff' : C.cy; g.shadowColor = C.cy; g.shadowBlur = (hot ? 12 : 7) * S; g.fill(); }
    else {
      if (hot) { g.fillStyle = b.craft ? 'rgba(255,154,85,.16)' : 'rgba(143,211,255,.16)'; g.fill(); }
      g.lineWidth = 1; g.strokeStyle = b.craft ? `rgba(255,154,85,${hot ? 0.9 : 0.6})` : hot ? 'rgba(212,241,255,.75)' : 'rgba(143,211,255,.38)'; g.stroke();
    }
    g.restore();
    text(g, b.label, bx + w / 2, L.yBtn + 19, { ...bSt, c: b.main ? INK : b.craft ? CRAFT : hot ? C.txt : C.sub, al: 'center' });
    hits.push({ x: bx, y: L.yBtn, w, h: 28, act });
    bx += w + 6;
  });
  return hits;
}
drawItem.W = ITEM_W;

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
// changed: der Slot weicht von der Serie ab, der Ring ist bernsteinfarben wie
// die Marke seiner Zeile auf der Tafel
function drawNumber(g, n, mode = '', changed = false) {
  const big = mode === 'hot' || mode === 'sel', r = big ? 14 : 12, c = 16;
  if (!g.canvas.dataset.h) return [32, 32];
  g.save();
  if (mode === 'dim') g.globalAlpha = 0.45;
  g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2);
  g.shadowColor = changed ? rgba(AMBER, 0.85) : 'rgba(110,200,255,.8)'; g.shadowBlur = (big ? 16 : 10) * S;
  g.fillStyle = mode === 'sel' ? C.cy : mode === 'hot' ? 'rgba(16,52,82,.96)' : 'rgba(8,25,43,.92)'; g.fill();
  g.shadowBlur = 0;
  if (changed) { g.lineWidth = 2.5; g.strokeStyle = AMBER; g.stroke(); }
  else if (mode !== 'sel') { g.lineWidth = big ? 2.5 : 2; g.strokeStyle = big ? '#d4f1ff' : C.cy; g.stroke(); }
  g.restore();
  g.save(); if (mode === 'dim') g.globalAlpha = 0.45;
  text(g, String(n), c, c + 5, { f: RAJ, w: 700, s: big ? 15 : 14, al: 'center', c: mode === 'sel' ? '#04121d' : C.txt });
  g.restore();
  return [32, 32];
}

// ─── Bauteil als Hologramm über dem Datenblatt ───────────────────────────
// Das Modell des Teils (dieselbe .glb, die die Werkstatt ans Schiff setzt),
// dunkel mit hellem Rand und Scanlinien statt mit Lack: Form zählt, nicht
// Farbe. Es liegt im Bild über allem (Tiefenbereich ganz vorn, siehe
// partMesh), verdeckt sich aber selbst richtig (Vorlauf nur in die Tiefe).
// Helligkeit aus dem Farbbild des Teils, damit Platten und Fugen lesbar bleiben.
const PART_VERT = `
uniform mat3 uvT;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() {
  vUv = (uvT * vec3(uv, 1.0)).xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const PART_FRAG = `
uniform sampler2D map; uniform float hasMap; uniform vec3 uC; uniform float uA;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  float f = pow(1.0 - abs(dot(n, normalize(vV))), 2.2);
  float lum = 0.12;
  if (hasMap > 0.5) lum = dot(texture2D(map, vUv).rgb, vec3(0.299, 0.587, 0.114));
  lum = clamp(lum * 1.8, 0.0, 1.0);
  float scan = 0.78 + 0.22 * step(0.5, fract(gl_FragCoord.y / 3.0));
  float top = 0.5 + 0.5 * n.y;
  vec3 col = vec3(0.003, 0.014, 0.034) + uC * (0.02 + 0.13 * lum + 0.06 * top) * scan + uC * f * 0.9 + vec3(1.0) * pow(f, 6.0) * 0.45;
  gl_FragColor = vec4(col, 0.96 * uA);
  #include <colorspace_fragment>
}`;
const PART_PRE = 'void main() { gl_FragColor = vec4(0.0); }';
// Lage im Bild: Bordwaffen leicht von vorn oben, der Lauf zur Bildmitte;
// Komponenten (Kästen) etwas steiler, damit Deckel und zwei Seiten zu sehen sind
const PART_POSE = { gun: [0.16, 0.45], box: [0.3, 0.6] };
const PART_KEEP = 6;      // so viele Modelle bleiben geladen (zuletzt gezeigte)
const PART_WAIT = 140;    // erst laden, wenn der Zeiger so lange (ms) auf einem Teil ruht
const PART_IN = 220;      // Einblenden (ms)

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
  // forceSinglePass: Doppelseitig Durchsichtiges zeichnet three sonst in zwei
  // Zügen (Rück-, dann Vorderseite) und sucht vor jedem Zug das
  // Shaderprogramm neu, hier für 30 Teile zweimal je Bild (13.11.2026). Am
  // Bild ändert ein Zug nichts: Diese Materialien sind einfarbig oder liegen
  // auf einer Fläche, schreiben keine Tiefe, und was additiv mischt, hängt
  // ohnehin nicht an der Reihenfolge. Ein Material mit Karte auf einem
  // gewölbten Körper bräuchte wieder beide Züge.
  const basic = (o, base = o.opacity ?? 1, owner = null) => {
    const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, forceSinglePass: true, ...o });
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
    const P = { draw, data, side, canvas: cv, g, cssW: 0, cssH: 0, hits: [], pos: null, from: null, to: null, glideAt: 0, k: 1, hop: null, ui: { scroll: 0, pscroll: 0, menu: false } };
    P.tex = new THREE.CanvasTexture(cv); P.tex.colorSpace = THREE.SRGBColorSpace;
    P.tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() ?? 1);
    P.tex.minFilter = THREE.LinearMipmapLinearFilter; P.tex.generateMipmaps = true;
    P.group = new THREE.Group();                       // am Boden, gedreht
    P.pivot = new THREE.Group(); P.pivot.position.y = LIFT; P.pivot.rotation.x = -TILT; P.group.add(P.pivot);
    P.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ map: P.tex, side: THREE.FrontSide, depthTest: false }, 1, P));
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
    // so hoch, wie über ihrem Platz frei ist; was nicht passt, rollt (Ausrüstung)
    const w = P.draw.W, room = roomOf(P, w);
    P.ui.maxH = room.bottom - 40 - room.top - 6;
    const H = P.draw(g, P.data, null, P.ui);
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
    P.hits = P.draw(g, P.data, P.hover ?? null, P.ui) || [];
    P.tex.needsUpdate = true;
  }
  // Freier Streifen einer Tafel der Breite w im Bild: Mitte, Ränder, tiefste
  // Unterkante (über Knöpfen der Seite) und höchste Oberkante (unter Kopfzeile
  // und Knöpfen am Titel). shift: um so viele Pixel zur Bildmitte gerückt
  function roomOf(P, w, shift = 0) {
    const W = ctx.W(), H = ctx.H();
    const x = P.side === 'left' ? safe.l + 18 + w / 2 + shift : W - safe.r - 18 - w / 2 - shift;
    const x0 = x - w / 2, x1 = x + w / 2;
    let bottom = H - 22, top = safe.t ?? 0;
    for (const r of safe.rects ?? []) {
      if (r.r <= x0 || r.l >= x1) continue;
      if (r.t > H * 0.45) bottom = Math.min(bottom, r.t - 14);
      else if ((r.b ?? 0) < H * 0.45) top = Math.max(top, r.b + 10);
    }
    return { x, x0, x1, bottom, top };
  }
  function redrawAll() { for (const P of built?.panels ?? []) redraw(P); for (const s of built?.sprites ?? []) s.redraw?.(); }
  // Zeiger und Wahl auf Tafeln und Nummern: die Zeile unter dem Zeiger
  // leuchtet an beiden Stellen, die gewählte bleibt gefüllt
  function applyHover() {
    if (!built) return;
    const leftH = hoverAct && /^(sys:|go:|lo\||ui\||href\|)/.test(hoverAct) ? hoverAct : null;
    const sheetH = hoverAct && !leftH ? hoverAct : null;
    if ((built.left.hover ?? null) !== leftH) { built.left.hover = leftH; redraw(built.left); }
    if ((built.sheet.hover ?? null) !== sheetH) { built.sheet.hover = sheetH; redraw(built.sheet); }
    updateMarks();
  }
  // Nummern am Schiff: gewählt ist die offene Zeile (Ausrüstung) bzw. sind
  // die aufgeklappten (Systeme), heiß die unter dem Zeiger
  function updateMarks() {
    if (!built) return;
    const d = built.left.data, lo = built.left.draw === drawLoadout;
    const sel = new Set(lo ? (d.open ? [`lo|slot|${d.open}`] : []) : (d.sel ?? []).filter((id) => d.detail?.[id] && d.rows.some((r) => r.id === id)).map((id) => `sys:${id}`));
    const hot = hoverAct && /^(sys:|lo\|slot\|)/.test(hoverAct) ? hoverAct : null;
    for (const sp of built.sprites) {
      if (sp.kind !== 'num') continue;
      const mode = sel.has(sp.act) ? 'sel' : sp.act === hot ? 'hot' : sel.size || hot ? 'dim' : '';
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
    // das Bauteil-Hologramm gehört dem Vorrat (partStore), nicht der Tafel: vor dem Aufräumen abnehmen
    partOff(); partWant = null;
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
  // Links die Ausrüstung (Werkstatt), solange sie fehlt die Systeme der Bucht
  const leftOf = (d) => (d.loadout ? [drawLoadout, d.loadout] : [drawSystems, d.systems]);
  // Rechts das Schiff; steht in der Ausrüstung ein Slot offen, sein Bauteil
  const rightOf = (d) => (d.loadout && d.item ? [drawItem, d.item] : [drawTiles, d.sheet]);
  function buildShip(rest, d) {
    const left = makePanel(...leftOf(d), 'left'), sheet = makePanel(...rightOf(d), 'right');
    const b = { key: d.key, panels: [left, sheet], left, sheet, sprites: [], box: worldBox(rest, d.dims.box), dims: d.dims, lines: null, model: rest.model, numKey: '' };
    // Schein hinter dem Bauteil-Hologramm, mit der Tafel gebaut und aufgeräumt
    b.partGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ map: softTex, color: C.cy, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false }, 0, sheet));
    b.partGlow.renderOrder = RO.panel; b.partGlow.visible = false; b.partGlow.position.z = -0.02;
    sheet.pivot.add(b.partGlow);
    return b;
  }

  // ── Bauteil als Hologramm über dem Datenblatt (siehe PART_VERT) ──
  // Vorrat der zuletzt gezeigten Modelle: url -> { url, p, turn, size, own, used }.
  // Jedes Modell wird einmal hergerichtet (Mitte, Drehung, eigenes Material)
  // und hängt, solange es gezeigt wird, an der rechten Tafel.
  const partStore = new Map();
  const partA = { value: 0 };                       // Deckkraft, für alle Materialien dieselbe
  const partC = { value: new THREE.Color(0x86d4ff) };
  const glc = renderer.getContext();
  let part = null;        // { e: Eintrag, at: Beginn des Einblendens }
  let partWant = null;    // { url, pose } der Tafel, oder null
  let partTimer = 0;
  // Vor allem im Bild: Tiefenbereich ganz vorn, danach wieder der ganze
  const partFront = () => glc.depthRange(0, 0.02), partBack = () => glc.depthRange(0, 1);
  function partPrep(scene, pose) {
    const own = { geo: new Set(), tex: new Set(), mat: [] };
    const keep = new Set(), drop = [], meshes = [];
    scene.traverse((o) => { if (o.isMesh) (o.visible ? meshes : drop).push(o); });
    for (const o of drop) o.removeFromParent();
    const texOf = (m) => Object.values(m).filter((t) => t?.isTexture);
    for (const o of meshes) for (const m of [].concat(o.material)) if (m.map) keep.add(m.map.source);
    const pre = new THREE.ShaderMaterial({ vertexShader: PART_VERT, fragmentShader: PART_PRE, uniforms: { uvT: { value: new THREE.Matrix3() } }, colorWrite: false, transparent: true, depthWrite: true, depthTest: true, fog: false });
    own.mat.push(pre);
    const made = new Map();
    for (const o of meshes) {
      const src = [].concat(o.material)[0];
      own.geo.add(o.geometry);
      if (!made.has(src)) {
        const map = src?.map ?? null;
        if (map) { map.updateMatrix(); own.tex.add(map); }
        // Bilder, die das Hologramm nicht braucht (Normalen, Glanz), gleich freigeben
        for (const m of [].concat(o.material)) { for (const t of texOf(m)) if (t !== map && !keep.has(t.source)) { t.dispose(); t.source?.data?.close?.(); } m.dispose(); }
        const mat = new THREE.ShaderMaterial({
          vertexShader: PART_VERT, fragmentShader: PART_FRAG, transparent: true, depthWrite: false, depthTest: true, fog: false, side: THREE.FrontSide,
          uniforms: { map: { value: map }, hasMap: { value: map ? 1 : 0 }, uvT: { value: map ? map.matrix.clone() : new THREE.Matrix3() }, uC: partC, uA: partA },
        });
        own.mat.push(mat); made.set(src, mat);
      }
      o.material = made.get(src);
      o.renderOrder = RO.panel + 2; o.castShadow = false; o.receiveShadow = false;
      const dm = new THREE.Mesh(o.geometry, pre); dm.renderOrder = RO.panel + 1; o.add(dm);
      for (const x of [o, dm]) { x.frustumCulled = false; x.onBeforeRender = partFront; x.onAfterRender = partBack; }
    }
    // Mitte in den Ursprung. Die Teile liegen in den Achsen des Spiels (x quer,
    // y nach vorn, z nach oben; so setzt sie auch der Anker am Schiff): oben
    // bleibt oben, und die längere der beiden liegenden Seiten kommt quer ins
    // Bild, bei einer Waffe der Lauf nach links zum Schiff. Darauf die Pose.
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene), c = box.getCenter(new THREE.Vector3()), s0 = box.getSize(new THREE.Vector3());
    scene.position.sub(c);
    const up = new THREE.Group(); up.add(scene); up.rotation.x = -Math.PI / 2;
    const inner = new THREE.Group(); inner.add(up); inner.rotation.y = s0.y > s0.x ? Math.PI / 2 : 0;
    const turn = new THREE.Group(); turn.add(inner); turn.rotation.set(pose[0], pose[1], 0);
    turn.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(turn).getSize(new THREE.Vector3());
    return { turn, size, own, n: meshes.length };
  }
  function partFree(e) {
    if (!e.own) return;
    for (const gm of e.own.geo) gm.dispose();
    for (const t of e.own.tex) { t.dispose(); t.source?.data?.close?.(); }
    for (const m of e.own.mat) m.dispose();
    e.own = null; e.turn = null;
  }
  function partLoad(url, pose) {
    let e = partStore.get(url);
    if (!e) {
      e = { url, turn: null, size: null, own: null, used: 0, dead: false };
      e.p = Promise.resolve().then(() => ctx.part(url)).then((scene) => {
        const r = partPrep(scene, pose);
        if (e.dead) { e.own = r.own; partFree(e); return e; }
        Object.assign(e, r);
        return e;
      });
      // ein Modell, das nicht lädt, bleibt weg (die Tafel steht ohne es), und der nächste Versuch beginnt neu
      e.p.catch((err) => { partStore.delete(url); console.warn('[hangar] Bauteil-Hologramm nicht geladen', url, err); });
      partStore.set(url, e);
    }
    e.used = performance.now();
    // Vorrat klein halten: die am längsten nicht gezeigten gehen
    const rest = [...partStore.values()].filter((o) => o !== e && o !== part?.e).sort((a, b) => a.used - b.used);
    while (partStore.size > PART_KEEP && rest.length) { const o = rest.shift(); o.dead = true; partStore.delete(o.url); partFree(o); }
    return e;
  }
  function partOff() {
    clearTimeout(partTimer); partTimer = 0;
    if (part?.e.turn) part.e.turn.removeFromParent();
    part = null;
    if (built?.partGlow) built.partGlow.visible = false;
  }
  // Was die rechte Tafel zeigt, bestimmt das Bauteil: nach jedem neuen Stand
  function partSync() {
    const d = built?.sheet.draw === drawItem ? built.sheet.data : null;
    const want = d?.model && ctx.part ? { url: d.model, pose: PART_POSE[d.type === 'gun' ? 'gun' : 'box'] } : null;
    if (want?.url === partWant?.url) return;
    partWant = want;
    partOff();
    if (!want) return;
    const show = () => {
      partTimer = 0;
      const e = partLoad(want.url, want.pose);
      e.p.then(() => {
        if (partWant?.url !== e.url || !built || !e.turn) return;
        partOff();
        part = { e, at: performance.now() };
        built.sheet.pivot.add(e.turn);
        ctx.wake(PART_IN + 200);
      }, () => {});
    };
    // schon geladen: sofort; sonst erst, wenn der Zeiger kurz ruht (beim Überfahren der Liste lädt nichts)
    if (partStore.get(want.url)?.turn) show(); else partTimer = setTimeout(show, PART_WAIT);
  }
  // je Bild: Größe und Platz über der Tafel; d = Tiefe der Tafel, ch = ihre Höhe (m)
  function partPlace(P, d, now) {
    if (!part || P !== built.sheet) return false;
    const e = part.e, glow = built.partGlow, mpp = d / ppm();
    // frei über der Tafel bis unter Kopfzeile und Knöpfe der Seite
    const free = (P.rect ? P.rect.t : 0) - roomOf(P, P.cssW).top - 14;
    const bw = P.cssW * 0.84, bh = Math.min(P.cssW * 0.42, free - 12);
    const ok = bh >= 56 && P.group.visible;
    e.turn.visible = ok; glow.visible = ok;
    if (!ok) return false;
    const k = Math.min(bw / e.size.x, bh / e.size.y) * mpp;
    const t = reduceMotion ? 1 : ease((now - part.at) / PART_IN);
    e.turn.scale.setScalar(k * (0.94 + 0.06 * t));
    const y = P.cssH * mpp + 12 * mpp + (e.size.y * k) / 2;
    e.turn.position.set(-P.cssW * 0.05 * mpp, y, 0);
    glow.position.set(e.turn.position.x, y, -0.02);
    glow.scale.set(e.size.x * k * 1.5, Math.max(e.size.y * k * 1.9, e.size.x * k * 0.5), 1);
    part.t = t;
    return t < 1;
  }
  // Nummern an den Ports der Zeilen links; neu, wenn Reiter oder Zeilen wechseln
  function syncNums(d) {
    const rows = d.loadout
      ? d.loadout.groups.flatMap((g) => g.rows.map((r) => ({ act: `lo|slot|${r.key}`, n: r.n, ps: r.ps, ch: !!r.changed })))
      : d.systems.rows.map((r) => ({ act: `sys:${r.id}`, n: r.n, ps: r.ps }));
    const key = JSON.stringify(rows);
    if (key === built.numKey) return;
    built.numKey = key;
    for (const sp of built.sprites) {
      if (sp.kind !== 'num') continue;
      root.remove(sp.obj);
      sp.obj.material.map?.dispose();
      const i = mats.findIndex(([m]) => m === sp.obj.material);
      if (i >= 0) mats.splice(i, 1);
      sp.obj.material.dispose();
    }
    built.sprites = built.sprites.filter((sp) => sp.kind !== 'num');
    const M = built.model.matrixWorld, all = [];
    for (const r of rows) {
      const seen = [];
      for (const p of r.ps ?? []) {
        const local = new THREE.Vector3(p[0], p[1], p[2]);
        // zwei Ports derselben Zeile dicht beieinander (Schilde der Gladius
        // 0,34 m): eine Nummer, sonst liegen zwei Kreise übereinander
        if (seen.some((q) => q.distanceTo(local) < 1)) continue;
        seen.push(local);
        // Ports verschiedener Zeilen am selben Fleck: die Nummern nebeneinander
        const near = all.filter((q) => q.distanceTo(local) < 0.6).length;
        all.push(local);
        const st = { mode: '' };
        const sp = makeSprite((g) => drawNumber(g, r.n, st.mode, r.ch), local.clone().applyMatrix4(M), { xray: true, kind: 'num' });
        sp.local = local; sp.act = r.act; sp.st = st; sp.dx = near * 27;
        sp.obj.center.x = 0.5 - sp.dx / sp.px;
        sp.obj.material.opacity = alpha;
        built.sprites.push(sp);
      }
    }
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
  // hinter ihm. shift: um so viele Pixel zur Bildmitte gerückt
  function target(P, shift = 0) {
    const w = P.cssW, h = P.cssH;
    // tiefste freie Höhe unter der Tafel: über Knöpfen der Seite in ihrem Streifen
    const { x, x0, x1, bottom } = roomOf(P, w, shift);
    if (bottom - h - 40 < (safe.t ?? 0)) return null;
    // Bildfläche der Tafel mit Projektor, für die Schilder (placeLabels)
    P.rect = { l: x0, r: x1, t: bottom - h - 40, b: bottom };
    P.anchor = [x, bottom];
    const B = built.box, m = 1.4;
    const inFoot = (t) => t.x > B.min.x - m && t.x < B.max.x + m && t.z > B.min.z - m && t.z < B.max.z + m;
    const floating = () => {
      P.float = true; P.rect = { l: x0, r: x1, t: bottom - h, b: bottom }; P.anchor = [x, bottom];
      return aheadPx(x, bottom, floatM());
    };
    P.float = false;
    const p = floorPx(x, bottom);
    // kein Boden unter der Stelle, Kamera über dem Rumpf oder steil von oben: schweben
    if (!p || (inFoot(p) && inFoot(camera.position)) || -camF().y > Math.sin(STEEP)) return floating();
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
    // ganz im freien Bild: von schräg oben kippt die Tafel am Bildrand und
    // lag halb unter der Seitenleiste (Ironclad, 10.11.2026). Ragt sie seitlich
    // hinaus, rückt sie einmal um das Stück zur Mitte; reicht das nicht oder
    // ragt sie oben oder unten hinaus: schweben
    const o = overhang(P, p, bottom + 24);
    if (o > 0 && o < 200 && !shift) { const t = target(P, o + 8); if (t && !P.float) return t; }
    if (o !== 0) return floating();
    return p;
  }
  // Stellung einer Tafel am Bodenpunkt at. Eine Stelle für place() und
  // overhang(): die Probe muss die Tafel so stellen, wie sie nachher steht.
  const yawOf = (P, at) => panelYaw(camF(), camera.position, at, P.cssW / 2 / ppm());
  const spread = (at, yaw) => panelSpread(camF(), camera.position, at, yaw);
  // Wie weit ragt die Tafel, stünde sie am Bodenpunkt t (wie place() sie
  // stellt), seitlich über Seitenleiste oder Rand (Pixel, 0 = gar nicht)?
  // Infinity, wenn eine Ecke über dem Kopf, unter yMax oder hinter der Kamera läge.
  const probe = new THREE.Object3D(), probeIn = new THREE.Object3D(), corner = new THREE.Vector3();
  probe.add(probeIn);
  function overhang(P, t, yMax) {
    const yaw = yawOf(P, t);
    probe.position.copy(t);
    probe.rotation.set(0, yaw, 0);
    probeIn.position.set(0, LIFT, 0); probeIn.rotation.set(-TILT, 0, 0);
    probe.updateMatrixWorld(true);
    const d = Math.max(1, depthOf(t)), wm = (P.cssW * d) / ppm() / spread(t, yaw), hm = (P.cssH * d) / ppm();
    const L = (safe.l ?? 0) - 4, R = ctx.W() - (safe.r ?? 0) + 4;
    let over = 0;
    for (const [cx, cy] of [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]]) {
      const px = toPx(probeIn.localToWorld(corner.set(cx * wm, cy * hm, 0)));
      if (!px || px[1] < (safe.t ?? 0) - 4 || px[1] > yMax) return Infinity;
      over = Math.max(over, L - px[0], px[0] - R);
    }
    return Math.ceil(over);
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
      P.group.position.copy(P.pos);
      P.group.rotation.set(0, yawOf(P, P.pos), 0);
    }
    const fl = !!P.float;
    if (P.proj.visible === fl) {
      P.proj.visible = P.glow.visible = !fl;
      P.pivot.position.y = fl ? 0 : LIFT; P.pivot.rotation.x = fl ? 0 : -TILT;
    }
    const d = Math.max(1, depthOf(P.pos));
    // schwebend steht sie quer zum Blick; am Boden gleicht kx die Breite aus (spread)
    const kx = fl ? 1 : 1 / spread(P.pos, P.group.rotation.y);
    const wm = ((P.cssW + 2 * PAD) * d) / ppm() * kx, hm = ((P.cssH + 2 * PAD) * d) / ppm();
    P.mesh.scale.set(wm, hm, 1);
    // Unterkante des Bilds (mit Rand) knapp unter der Hubhöhe: die Tafel selbst steht auf LIFT
    P.mesh.position.y = hm / 2 - (PAD / (P.cssH + 2 * PAD)) * hm;
    const fw = (P.cssW * d) / ppm() * 0.86 * kx;
    P.proj.scale.set(fw, 1, 1);
    P.beam.scale.set(1, LIFT + 0.02, 1); P.beam.position.y = (LIFT + 0.02) / 2;
    P.glow.scale.set(fw * 1.45, fw * 0.64, 1);
    if (partPlace(P, d, now)) P.partBusy = true; else P.partBusy = false;
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
      // nur zurück, wenn sie spürbar aus ihrem Platz geraten ist oder dort
      // nicht mehr ganz im Bild steht: wird sie höher (Datenblatt statt
      // Schiffswerte), ragt ihre äußere obere Ecke sonst über den Rand
      const a = toPx(P.pos), b = toPx(t);
      const off = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : Infinity;
      if (off < 70 && wasShown && !wasFloat && overhang(P, P.pos, P.anchor[1] + 24) === 0) continue;
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
  // Deckkraft des Bauteil-Hologramms: mit der Station, seiner Tafel und dem eigenen Einblenden
  function partAlpha() {
    const k = part && built ? alpha * built.sheet.k * (part.t ?? 0) : 0;
    partA.value = k;
    if (built?.partGlow) built.partGlow.material.opacity = 0.2 * k;
  }
  function setK(P, k) {
    if (P.k === k) return;
    P.k = k;
    for (const [m, base, o] of mats) if (o === P) m.opacity = base * alpha * k;
  }

  // ── Zeiger: Knöpfe auf den Tafeln, Zeilen der Systeme, Nummern am Schiff ──
  // liefert den Knopf unter dem Zeiger (act) oder null; eine Tafel deckt,
  // was hinter ihr liegt, ihr durchsichtiger Rand nicht
  // Tafel unter dem Zeiger mit dem Punkt in ihren CSS-Pixeln, oder null
  function panelAt(e) {
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
      return { P, x, y };
    }
    return null;
  }
  function pick(e) {
    if (!built || alpha < 0.5) return null;
    const at = panelAt(e);
    if (at) {
      // der zuletzt gezeichnete Knopf liegt oben (Menü über der Liste)
      for (let i = at.P.hits.length - 1; i >= 0; i--) {
        const b = at.P.hits[i];
        if (at.x >= b.x && at.x <= b.x + b.w && at.y >= b.y && at.y <= b.y + b.h) return b.act;
      }
      return null;
    }
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    // Nummern: die dem Zeiger nächste unter den getroffenen (sie liegen am
    // Rumpf oft dicht beieinander)
    const nums = built.sprites.filter((sp) => sp.kind === 'num' && sp.obj.visible);
    let best = null, bd = Infinity;
    for (const h of ray.intersectObjects(nums.map((sp) => sp.obj), false)) {
      const sp = nums.find((n) => n.obj === h.object), px = sp && toPx(sp.pos);
      const d = px ? Math.hypot(px[0] + (sp.dx ?? 0) - mx * (ctx.W() / r.width), px[1] - my * (ctx.H() / r.height)) : Infinity;
      if (d < bd) { bd = d; best = sp; }
    }
    return best ? best.act : null;
  }
  let downAt = null;
  const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
  const onClick = (e) => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const act = pick(e);
    // das Menü der Layouts schließt mit jedem Klick, auch daneben
    const ui = built?.left.ui, menu = !!ui?.menu;
    if (menu) { ui.menu = false; redraw(built.left); settledAt = 0; ctx.wake(300); }
    if (!act) return;
    if (act === 'ui|menu') { if (!menu) { ui.menu = true; redraw(built.left); settledAt = 0; ctx.wake(300); } }
    else if (act === 'ui|rename') ctx.act({ act: 'lo', a: ['rename'] });
    else if (act.startsWith('ui|')) return;
    else if (act.startsWith('it|')) {
      // Datenblatt des Bauteils: Knopf (Einbauen, Crafting, Item-Seite) oder Weg mit Adresse
      const [, kind, i] = act.split('|'), d = built.sheet.draw === drawItem ? built.sheet.data : null;
      const t = kind === 'b' ? d?.buttons?.[Number(i)] : d?.ways?.[Number(i)];
      if (t?.a) ctx.act({ act: 'lo', a: t.a });
      else if (t?.href) ctx.act({ act: 'go', href: t.href });
    } else if (act.startsWith('lo|')) ctx.act({ act: 'lo', a: act.split('|').slice(1) });
    else if (act.startsWith('href|')) ctx.act({ act: 'go', href: act.slice(5) });
    else if (act.startsWith('sys:')) ctx.act({ act: 'sys', row: act.slice(4) });
    else if (act.startsWith('go:')) {
      const rest = act.slice(3), j = rest.lastIndexOf(':');
      const l = built.left.data.detail?.[rest.slice(0, j)]?.links?.[Number(rest.slice(j + 1))];
      if (l?.href) ctx.act({ act: 'go', href: l.href });
    } else ctx.act({ act });
  };
  const hoverTo = (act) => {
    if (act === 'ui|shut') act = null;
    if (act === hoverAct) return;
    hoverAct = act;
    applyHover();
    // das eingebaute Teil der Auswahl meldet sich nur (lo|peek), es ist kein Knopf
    const pk = act ? /^lo\|(opt|peek)\|([^|]+)\|(.+)$/.exec(act) : null;
    el.style.cursor = act && pk?.[1] !== 'peek' ? 'pointer' : '';
    // Zeiger auf einem Teil der offenen Auswahl: sein Datenblatt auf die rechte Tafel
    if (pk) ctx.act({ act: 'lo', a: ['peek', pk[2], pk[3]] });
    ctx.wake(300);
  };
  const onMove = (e) => { if (!e.buttons) hoverTo(pick(e)); };
  const onLeave = () => hoverTo(null);
  // Rad über der Ausrüstung rollt ihre Liste (über der Auswahl zuerst die),
  // statt die Kamera zu fahren. Vor dem Viewer: der hört am Canvas selbst.
  const wheelHost = el.parentElement ?? el;
  const onWheel = (e) => {
    if (e.target !== el) return;
    const at = panelAt(e);
    if (!at || at.P.draw !== drawLoadout) return;
    e.preventDefault(); e.stopPropagation();
    const ui = at.P.ui, z = ui.zones ?? {}, dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    const inOpts = z.opts && at.x >= z.opts.x && at.x <= z.opts.x + z.opts.w && at.y >= z.opts.y && at.y <= z.opts.y + z.opts.h;
    const to = clamp(ui.pscroll + dy, 0, z.opts?.max ?? 0);
    if (inOpts && to !== ui.pscroll) ui.pscroll = to;
    else if (z.body?.max) ui.scroll = clamp(ui.scroll + dy, 0, z.body.max);
    else return;
    redraw(at.P);
    hoverTo(pick(e));
    ctx.wake(300);
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('click', onClick);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  wheelHost.addEventListener('wheel', onWheel, { capture: true, passive: false });

  // Neue Wörter für dieselbe Station. Links wechselt die Tafel zur
  // Ausrüstung, sobald die Werkstatt geladen hat; ein neuer Reiter beginnt
  // oben, eine frisch geöffnete Zeile rollt mit ihrer Auswahl ins Bild.
  function applyData(d) {
    const L = built.left, [draw, data] = leftOf(d);
    if (draw === drawLoadout) {
      const was = L.draw === drawLoadout ? L.data : null;
      if (was?.cat !== data.cat) { L.ui.scroll = 0; L.ui.menu = false; }
      if (data.open && data.open !== was?.open) { L.ui.reveal = data.open; L.ui.pReveal = true; }
      else if (data.pick && was?.pick && data.pick.opts.length !== was.pick.opts.length) L.ui.pReveal = true;
    }
    L.draw = draw; L.data = data;
    const R = built.sheet;
    [R.draw, R.data] = rightOf(d);
    partSync();
    syncNums(d);
  }

  return {
    set(w) {
      want = w && w.data ? w : null;
      alphaFrom = alpha; alphaTo = want ? 1 : 0; fadeAt = performance.now();
      if (built && want && (built.key !== want.data.key)) { alphaTo = 0; }
      else if (built && want) {
        // dieselbe Station, neue Wörter (Vergleich an/aus, gewählte Zeile,
        // ein Tausch in der Ausrüstung): neu zeichnen; die Tafel wächst nach
        // oben, ihr Platz wird neu geprüft
        applyData(want.data);
        redrawAll();
        updateMarks();
        settledAt = 0;
      }
      ctx.wake(FADE_MS + 100);
    },
    // neues freies Bild: die Ausrüstung richtet ihre Höhe danach
    safe(s) { safe = { l: 0, t: 0, r: 0, rects: [], ...s }; if (built) redraw(built.left); settledAt = 0; ctx.wake(300); },
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
        partWant = null; partSync();
        syncNums(want.data);
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
        for (const P of built.panels) { place(P, now); if (P.from || P.hop || P.partBusy) busy = true; }
        for (const sp of built.sprites) placeSprite(sp);
      }
      const t = reduceMotion ? 1 : Math.min(1, (now - fadeAt) / FADE_MS);
      const a = alphaFrom + (alphaTo - alphaFrom) * ease(t);
      if (Math.abs(a - alpha) > 1e-4 || (built && alpha === 0 && a === 0 && alphaTo === 1)) { alpha = a; setAlpha(alpha); }
      partAlpha();
      if (t < 1) busy = true;
      if (built && alphaTo === 0 && alpha <= 0.001 && want === null) { clear(); dimCorner = ''; }
      return busy;
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('click', onClick);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      wheelHost.removeEventListener('wheel', onWheel, { capture: true });
      clear(); scene.remove(root); scene.remove(dim);
      for (const e of partStore.values()) { e.dead = true; partFree(e); }
      partStore.clear();
      dim.geometry.dispose(); dimMat.dispose(); softTex.dispose(); beamTex.dispose(); bandTex.dispose();
    },
  };
}
