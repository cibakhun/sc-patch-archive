// Dichtheit der Hallenhülle: Blickstrahlen aus dem Raum, die keine
// undurchsichtige Fläche treffen, sehen im Viewer ins Leere (Hintergrund).
//
// Anlass (2026-10-07): Die Halle in voller Stufe (LOD 0) lag über dem
// Dreiecksbudget, der Build dezimierte sie, und die gelockerte Schwelle riss
// die Längswände auf. Von den Strahlen unten entkamen 2,3 %, bei der Halle
// davor 0,1 %. Gegenprobe: dieselbe Dezimierung auf die heile Halle ergab
// 1,1 %, mit den Löchern an denselben Stellen.
//
// Arbeitet im glTF-Raum der Halle (wie das GLB), gegen das geschriebene
// Artefakt: Glas und andere durchsichtige Flächen zählen nicht als Wand.
import { hallRaycaster } from './hall-lights.mjs';

/** n Richtungen, gleichmäßig auf der Kugel (Fibonacci) */
function sphere(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), t = i * Math.PI * (3 - Math.sqrt(5));
    out.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return out;
}

/**
 * Anteil der Strahlen aus 45 Punkten im Raum (3 Höhen, 3 × 5 über den Boden),
 * die bis `reach` m nichts treffen, und durch welche Raumseite sie gehen
 * (x−/x+ Längswände, z−/z+ Stirnwände, y+ Decke, y− Boden).
 * room: { center: [x, y, z], halfW, halfL, height }
 */
export function hullLeaks(doc, room, { dirs = 1500, reach = 400, rc = hallRaycaster(doc) } = {}) {
  const [cx, cy, cz] = room.center, hw = room.halfW, hl = room.halfL, H = room.height;
  const D = sphere(dirs);
  const walls = { 'x-': 0, 'x+': 0, 'z-': 0, 'z+': 0, 'y+': 0, 'y-': 0 };
  let rays = 0, escaped = 0;
  for (const h of [2, 8, 16]) for (let i = 1; i < 4; i++) for (let j = 1; j < 6; j++) {
    const o = [cx - hw + (2 * hw * i) / 4, cy + h, cz - hl + (2 * hl * j) / 6];
    for (const d of D) {
      rays++;
      if (rc.ray(o, d, reach)) continue;
      escaped++;
      // erste Raumseite, die der Strahl verlässt
      let best = Infinity, side = 'y+';
      const cand = [
        [d[0] > 0 ? (cx + hw - o[0]) / d[0] : d[0] < 0 ? (cx - hw - o[0]) / d[0] : Infinity, d[0] > 0 ? 'x+' : 'x-'],
        [d[2] > 0 ? (cz + hl - o[2]) / d[2] : d[2] < 0 ? (cz - hl - o[2]) / d[2] : Infinity, d[2] > 0 ? 'z+' : 'z-'],
        [d[1] > 0 ? (cy + H - o[1]) / d[1] : d[1] < 0 ? (cy - o[1]) / d[1] : Infinity, d[1] > 0 ? 'y+' : 'y-'],
      ];
      for (const [t, s] of cand) if (t < best) { best = t; side = s; }
      walls[side]++;
    }
  }
  return { rays, escaped, pct: Math.round((escaped / rays) * 10000) / 100, walls };
}
