/* ============================================================
   hall-deko.mjs — Lage der Hallendeko in einer Halle fester Größe: steht
   jedes Stück frei, auf Boden oder auf einem anderen, und bleibt der Weg
   des Aufzugs und der Fahrzeuge frei?

   WARUM ES DAS GIBT (15.11.2026): Die Halle von Revel & York misst im
   Browser einen Grundriss, und buildDeko lässt weg, was in Wand oder
   Einrichtung stünde (verify:hangar-hall [17] rechnet das nach). Eine
   Halle fester Größe misst keinen: Ihr Modell hat 1,8 Mio. Dreiecke, und
   der Grundriss kostete beim Laden Zeit, die der Hangar nicht hat („braucht
   viel zu viele Ressourcen“). Dort stellt der Viewer jedes Stück so hin,
   wie WORK_DEKO_FEST es nennt. Dass keines in einer Wand steckt, über einem
   Loch schwebt oder dem Aufzug im Weg steht, prüft darum das Tor am
   ausgelieferten Modell (verify:hangar-hallen [5]) mit den Funktionen hier.

   Ein Stück ist ein Quader: Mitte der Grundfläche c [x, z] im Modellraum,
   Drehung a um y (Bogenmaß, wie makeRotationY: das eigene +x zeigt nach
   (cos a, -sin a)), halbe Breite hx und halbe Tiefe hz, Unterkante y und
   Oberkante top über dem Hallenboden. So legt layDeko im Viewer jedes
   Stück, und so liefert dekoGlieder des Viewers sie dem Tor.

   Reine Funktionen: kein Dateizugriff, kein Netz.
   ============================================================ */

/**
 * Lose Bodenkabel, Kabelstränge und Bodenschläuche: Ihre Enden liegen frei (Krisz am 22.10.2026: „kabel
 * connected nicht“). In der Halle von Revel & York steckt jede Leitung mit beiden Enden in einem Gerät
 * (verify:hangar-hall [17] nimmt die Regel von hier); eine Halle fester Größe stellt bisher keine.
 */
export const LOSE_LEITUNG = /cable_(floor|straight|bend|corner|small)|cables_|hose_floor_1_[a-e]$/;

/** Ecken der Grundfläche im Modellraum */
export const ecken = (m) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
  const x = u * m.hx, z = v * m.hz;
  return [m.c[0] + x * Math.cos(m.a) + z * Math.sin(m.a), m.c[1] - x * Math.sin(m.a) + z * Math.cos(m.a)];
});

/** Punkt (x, z) des Modellraums im Rahmen des Stücks (seine Mitte im Ursprung) */
export const lokal = (m, x, z) => {
  const dx = x - m.c[0], dz = z - m.c[1], ca = Math.cos(m.a), sa = Math.sin(m.a);
  return [dx * ca - dz * sa, dx * sa + dz * ca];
};

/** liegt (x, z) in der Grundfläche von m, tol m darüber hinaus */
export const drin = (m, x, z, tol = 0) => {
  const [lx, lz] = lokal(m, x, z);
  return Math.abs(lx) <= m.hx + tol && Math.abs(lz) <= m.hz + tol;
};

/** kleinste Überdeckung zweier Grundflächen in m über ihre vier Trennachsen (<= 0: getrennt) */
export function ueberdeckung(p, q) {
  const cp = ecken(p), cq = ecken(q);
  let min = Infinity;
  for (const a of [p.a, p.a + Math.PI / 2, q.a, q.a + Math.PI / 2]) {
    const ux = Math.cos(a), uz = -Math.sin(a), pr = (cs) => cs.map(([x, z]) => x * ux + z * uz);
    const pp = pr(cp), qq = pr(cq);
    min = Math.min(min, Math.min(Math.max(...pp), Math.max(...qq)) - Math.max(Math.min(...pp), Math.min(...qq)));
  }
  return min;
}

/**
 * Nach oben zeigende Flächen eines Knotens im Rahmen seines Stücks (Mitte
 * der Grundfläche im Ursprung, Unterkante bei 0), aus seinen Dreiecken.
 * @param {{ pos: ArrayLike<number>, idx: ArrayLike<number>|null }[]} teile  je Teil des Knotens seine Ecken
 *   (x, y, z) und sein Index; ohne Index sind je drei Ecken ein Dreieck
 * @returns {{ size: number[], tris: number, oben: Float32Array }} oben: je Dreieck neun Zahlen
 */
export function knotenFlaechen(teile) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let tris = 0;
  for (const { pos, idx } of teile) {
    tris += (idx ? idx.length : pos.length / 3) / 3;
    for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[i + a]); hi[a] = Math.max(hi[a], pos[i + a]); }
  }
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2, oben = [];
  for (const { pos, idx } of teile) {
    const n = idx ? idx.length : pos.length / 3, v = (t, a) => pos[(idx ? idx[t] : t) * 3 + a];
    for (let t = 0; t + 2 < n; t += 3) {
      const ux = v(t + 1, 0) - v(t, 0), uy = v(t + 1, 1) - v(t, 1), uz = v(t + 1, 2) - v(t, 2), wx = v(t + 2, 0) - v(t, 0), wy = v(t + 2, 1) - v(t, 1), wz = v(t + 2, 2) - v(t, 2);
      const ny = uz * wx - ux * wz, len = Math.hypot(uy * wz - uz * wy, ny, ux * wy - uy * wx);
      if (len < 1e-10 || ny / len < OBEN) continue;
      for (let k = 0; k < 3; k++) oben.push(v(t + k, 0) - cx, v(t + k, 1) - lo[1], v(t + k, 2) - cz);
    }
  }
  return { size: hi.map((h, a) => h - lo[a]), tris, oben: Float32Array.from(oben) };
}
/** ab dieser Neigung trägt eine Fläche (Anteil der Normalen nach oben; 0,7 sind 45 Grad) */
export const OBEN = 0.7;

// Höhe des Dreiecks (neun Zahlen ab o) über dem Punkt (x, z), null daneben
function hoeheIm(t, o, x, z) {
  const ax = t[o], ay = t[o + 1], az = t[o + 2], bx = t[o + 3], by = t[o + 4], bz = t[o + 5], cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(d) < 1e-12) return null;
  const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
  const E = -1e-6;
  return u >= E && v >= E && w >= E ? u * ay + v * by + w * cy : null;
}

/** Messpunkte auf der Grundfläche von m im Modellraum: Raster n × n, um rand (Anteil) eingerückt */
export function messpunkte(m, n = 5, rand = 0.1) {
  const out = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    const u = n === 1 ? 0 : (2 * i) / (n - 1) - 1, v = n === 1 ? 0 : (2 * k) / (n - 1) - 1, x = u * m.hx * (1 - rand), z = v * m.hz * (1 - rand);
    out.push([m.c[0] + x * Math.cos(m.a) + z * Math.sin(m.a), m.c[1] - x * Math.sin(m.a) + z * Math.cos(m.a)]);
  }
  return out;
}

/**
 * Wie viele tragende Flächen von q liegen unter m: Dreiecke von q, die nach
 * oben zeigen und die dünne Scheibe unter der Unterkante von m schneiden
 * (seine Grundfläche, ringsum um rand eingerückt, tol m dick nach oben und
 * unten). Gemessen wird die Fläche, nicht ein Punkt: Die Gabel eines Staplers
 * ist 15 cm breit, zwischen Messpunkten fiele sie durch.
 * @param {Float32Array|undefined} oben  tragende Flächen von q im Rahmen seines Stücks (knotenFlaechen)
 * @returns {number} Zahl der Dreiecke
 */
export function getragen(m, q, oben, { tol = 0.06, rand = 0.05 } = {}) {
  if (!oben?.length) return 0;
  const h = [m.hx * (1 - rand), tol, m.hz * (1 - rand)], cq = Math.cos(q.a), sq = Math.sin(q.a), cm = Math.cos(m.a), sm = Math.sin(m.a);
  // Ecke aus dem Rahmen von q in den Modellraum und in den Rahmen der Scheibe
  const zu = (o) => {
    const x = q.c[0] + oben[o] * cq + oben[o + 2] * sq - m.c[0], z = q.c[1] - oben[o] * sq + oben[o + 2] * cq - m.c[1];
    return [x * cm - z * sm, q.y + oben[o + 1] - m.y, x * sm + z * cm];
  };
  let n = 0;
  for (let o = 0; o < oben.length; o += 9) if (dreieckImQuader(h, zu(o), zu(o + 3), zu(o + 6))) n++;
  return n;
}

/** Fahrspur vor einem Fahrzeug (seine Front ist das eigene -z): laenge m ab der Front, rand m breiter je Seite */
export const fahrspurVor = (v, { laenge, rand }) => {
  const d = v.hz + laenge / 2;
  return { c: [v.c[0] - d * Math.sin(v.a), v.c[1] - d * Math.cos(v.a)], a: v.a, hx: v.hx + rand, hz: laenge / 2 };
};

/**
 * Lage der Stücke untereinander und zum Feld des Aufzugs.
 * @param {object[]} stuecke  { name, node, zone, c, a, hx, hz, y, top, auf, fahrzeug }
 *   auf: steht nicht am Boden seiner Zone, sondern auf einem anderen Stück
 * @param {object} o
 * @param {(node: string) => Float32Array|undefined} o.oben  tragende Flächen je Knoten (knotenFlaechen)
 * @param {{ from: number[], to: number[] }|null} o.feld      Feld des Aufzugs im Modellraum
 * @param {number} o.abstand   Abstand zum Feld in m, der frei bleibt
 * @param {{ laenge: number, rand: number }} o.spur  Fahrspur vor jedem Fahrzeug
 * @returns {{ imFeld: string[], ineinander: string[], schwebt: string[], imSpur: string[], zahlen: object }}
 */
export function pruefeLage(stuecke, { oben, feld, abstand = 0, spur }) {
  const imFeld = [], ineinander = [], schwebt = [], imSpur = [];
  const zahlen = { stuecke: stuecke.length, amBoden: 0, gestapelt: 0, paare: 0, getragen: 0, fahrspuren: 0, feld: 0 };
  if (feld) {
    const F = { c: [(feld.from[0] + feld.to[0]) / 2, (feld.from[1] + feld.to[1]) / 2], a: 0, hx: (feld.to[0] - feld.from[0]) / 2 + abstand, hz: (feld.to[1] - feld.from[1]) / 2 + abstand };
    for (const m of stuecke) { zahlen.feld++; if (ueberdeckung(m, F) > 0.01) imFeld.push(m.name); }
  }
  // worauf ein Stück liegt: Ein anderes derselben Zone hat unter ihm eine tragende Fläche
  const liegtAuf = new Map();
  for (const m of stuecke) {
    if (!m.auf) { zahlen.amBoden++; continue; }
    zahlen.gestapelt++;
    const traeger = [];
    for (const q of stuecke) {
      if (q === m || q.zone !== m.zone || q.y >= m.y) continue;
      // gezählt werden die Dreiecke von q, nicht seine Hülle: Ein offener Rahmen endet auf der Höhe von m
      // und trägt in seiner Mitte doch nichts (bis 21.11.2026 reichte Oberkante plus Mitte in der Hülle)
      const g = getragen(m, q, oben(q.node));
      if (g >= 1) traeger.push({ q, g });
    }
    liegtAuf.set(m, traeger);
    if (!traeger.length) schwebt.push(`${m.name} auf ${+(m.y).toFixed(2)} m`);
    else zahlen.getragen++;
  }
  const traegt = (q, m) => (liegtAuf.get(m) ?? []).some((t) => t.q === q);
  // traegt q das Stück m, auch über ein Stück dazwischen (die Kiste auf der Palette auf der Gabel)
  const traegtMittelbar = (q, m, tiefe = 0) => traegt(q, m) || (tiefe < 6 && (liegtAuf.get(m) ?? []).some((t) => traegtMittelbar(q, t.q, tiefe + 1)));
  for (let i = 0; i < stuecke.length; i++) for (let k = i + 1; k < stuecke.length; k++) {
    const p = stuecke[i], q = stuecke[k];
    if (Math.min(p.top, q.top) - Math.max(p.y, q.y) < 0.05) continue;
    if (p.top - p.y < 0.35 && q.top - q.y < 0.35) continue;
    zahlen.paare++;
    if (traegtMittelbar(p, q) || traegtMittelbar(q, p)) continue;
    const ov = ueberdeckung(p, q);
    if (ov >= 0.02) ineinander.push(`${p.name} mit ${q.name} ${ov.toFixed(2)} m`);
  }
  for (const v of stuecke.filter((m) => m.fahrzeug)) {
    const S = fahrspurVor(v, spur);
    zahlen.fahrspuren++;
    for (const m of stuecke) if (m !== v && !traegtMittelbar(v, m) && ueberdeckung(m, S) > 0.01) imSpur.push(`${m.name} vor ${v.name}`);
  }
  return { imFeld, ineinander, schwebt, imSpur, zahlen };
}

/* ---------- gegen das Modell der Halle ---------- */

// Dreieck gegen achsparallelen Quader um den Ursprung (halbe Kanten h), nach Akenine-Möller
function dreieckImQuader(h, v0, v1, v2) {
  const e = [[v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]], [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]], [v0[0] - v2[0], v0[1] - v2[1], v0[2] - v2[2]]];
  const vs = [v0, v1, v2];
  for (let a = 0; a < 3; a++) {
    const lo = Math.min(v0[a], v1[a], v2[a]), hi = Math.max(v0[a], v1[a], v2[a]);
    if (lo > h[a] || hi < -h[a]) return false;
  }
  for (const f of e) for (let a = 0; a < 3; a++) {
    // Achse = Einheitsachse a × Kante f
    const ax = a === 0 ? [0, -f[2], f[1]] : a === 1 ? [f[2], 0, -f[0]] : [-f[1], f[0], 0];
    const p = vs.map((v) => v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2]);
    const r = h[0] * Math.abs(ax[0]) + h[1] * Math.abs(ax[1]) + h[2] * Math.abs(ax[2]);
    if (Math.min(...p) > r || Math.max(...p) < -r) return false;
  }
  const n = [e[0][1] * e[1][2] - e[0][2] * e[1][1], e[0][2] * e[1][0] - e[0][0] * e[1][2], e[0][0] * e[1][1] - e[0][1] * e[1][0]];
  const d = n[0] * v0[0] + n[1] * v0[1] + n[2] * v0[2], r = h[0] * Math.abs(n[0]) + h[1] * Math.abs(n[1]) + h[2] * Math.abs(n[2]);
  return Math.abs(d) <= r;
}

/**
 * Dreiecke der Halle in Zellen der Kantenlänge zelle (m) über x und z ablegen,
 * nur die im Bereich (x0, z0, x1, z1) und im Höhenband (y0, y1).
 */
export function hallenRaster({ zelle = 2, bereich, band }) {
  const [x0, z0, x1, z1] = bereich, nx = Math.max(1, Math.ceil((x1 - x0) / zelle)), nz = Math.max(1, Math.ceil((z1 - z0) / zelle));
  const zellen = new Map(), tris = [];
  return {
    zelle, bereich, band, nx, nz, zellen, tris,
    /** ein Dreieck im Modellraum dazu: a, b, c je [x, y, z] */
    dazu(a, b, c) {
      const ylo = Math.min(a[1], b[1], c[1]), yhi = Math.max(a[1], b[1], c[1]);
      if (yhi < band[0] || ylo > band[1]) return;
      const xl = Math.min(a[0], b[0], c[0]), xh = Math.max(a[0], b[0], c[0]), zl = Math.min(a[2], b[2], c[2]), zh = Math.max(a[2], b[2], c[2]);
      if (xh < x0 || xl > x1 || zh < z0 || zl > z1) return;
      const id = tris.length / 9;
      tris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      const i0 = Math.max(0, Math.floor((xl - x0) / zelle)), i1 = Math.min(nx - 1, Math.floor((xh - x0) / zelle)), k0 = Math.max(0, Math.floor((zl - z0) / zelle)), k1 = Math.min(nz - 1, Math.floor((zh - z0) / zelle));
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
        const key = k * nx + i;
        if (!zellen.has(key)) zellen.set(key, []);
        zellen.get(key).push(id);
      }
    },
    /** Nummern der Dreiecke, deren Zellen das Rechteck (xl, zl, xh, zh) berührt */
    nahe(xl, zl, xh, zh) {
      const out = new Set();
      const i0 = Math.max(0, Math.floor((xl - x0) / zelle)), i1 = Math.min(nx - 1, Math.floor((xh - x0) / zelle)), k0 = Math.max(0, Math.floor((zl - z0) / zelle)), k1 = Math.min(nz - 1, Math.floor((zh - z0) / zelle));
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) for (const id of zellen.get(k * nx + i) ?? []) out.add(id);
      return out;
    },
  };
}

/**
 * Dreiecke der Halle, die den Quader von m zwischen den Höhen y0 und y1
 * (Modellraum) schneiden; der Quader ist ringsum um spiel m kleiner.
 * @returns {number}
 */
export function hallImQuader(m, y0, y1, raster, spiel = 0.02) {
  if (!(y1 > y0)) return 0;
  const cs = ecken(m), xs = cs.map((v) => v[0]), zs = cs.map((v) => v[1]);
  const h = [m.hx - spiel, (y1 - y0) / 2, m.hz - spiel], cy = (y0 + y1) / 2, ca = Math.cos(m.a), sa = Math.sin(m.a), T = raster.tris;
  if (!(h[0] > 0 && h[2] > 0)) return 0;
  const zu = (o) => { const dx = T[o] - m.c[0], dz = T[o + 2] - m.c[1]; return [dx * ca - dz * sa, T[o + 1] - cy, dx * sa + dz * ca]; };
  let n = 0;
  for (const id of raster.nahe(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs))) {
    const o = id * 9;
    if (dreieckImQuader(h, zu(o), zu(o + 3), zu(o + 6))) n++;
  }
  return n;
}

/**
 * Anteil der Messpunkte von m, unter denen die Halle auf der Höhe hoehe
 * (tol m darum) eine Fläche nach oben hat: der Boden, auf dem m steht.
 * raster trägt nur nach oben zeigende Dreiecke dieses Höhenbands.
 * @returns {{ auf: number, von: number }}
 */
export function bodenUnter(m, hoehe, raster, { n = 5, tol = 0.08 } = {}) {
  const T = raster.tris, pts = messpunkte(m, n);
  let auf = 0;
  for (const [x, z] of pts) {
    for (const id of raster.nahe(x, z, x, z)) {
      const h = hoeheIm(T, id * 9, x, z);
      if (h != null && Math.abs(h - hoehe) <= tol) { auf++; break; }
    }
  }
  return { auf, von: pts.length };
}
