#!/usr/bin/env node
/* ============================================================
   build-hangar-sound.mjs — die Originalklänge des Hangars fürs Web

   Krisz, 20.10.2026 abends, nach drei abgelehnten Fassungen aus dem
   Browser-Synthesizer: „okay nehme die audios und mache die animation
   passend dazu“. Eingang sind die Klänge, die der PC-Auftrag aus dem
   Spiel nach .cache/hangar-sound/ holt (liste.json nennt je Datei
   Auslöser, Takt und Messwerte; nur dort, nicht im Repo). Ausgang:
   public/hangar/ton/*.mp3, die der Viewer (hangarSound) lädt, sobald
   jemand den Ton einschaltet.

   Was hier passiert, und warum:
   - Pegel: alle Dateien gleich um TRIM dB leiser. Mehrere liegen mit
     Spitzen über 0 dBFS (Gleitkomma beim Auspacken); das Verhältnis
     untereinander bleibt, wie es im Spiel abgemischt ist.
   - Schnitt auf den flotten Takt (seit 21.10.2026, Krisz: „gesamt
     animation ist viel zu langsam“; vorher lief alles 15 s im Takt der
     ganzen Aufnahmen): Ein Klang besteht aus Stücken der Aufnahme
     (teile, Sekunden der Quelle), XG s leistungsgleich überblendet, das
     erste FI s eingeblendet, das Ende `aus` s ausgeblendet. Tor: der
     Anlauf vom Anfang, dann das Ende mit dem Anschlag; Plattform: Anfahren
     und Halt ohne den langen Vorlauf. `schlag` ist die Stelle der Quelle,
     die auf die Bewegung fällt (Halt: Stillstand, Tor: Ende der Bahn). Wo
     sie im Schnitt landet, steht im Viewer (SND_HIT), der den Klang danach
     ansetzt; passt es nicht mehr, endet das Skript mit Fehler.
   - Dampf ist raus (Krisz, 21.10.2026: „dampf sound ist super crappy“):
     Der mittlere Hangar hat keinen eigenen, die aus anderen Hangars und
     von Türen passten nicht.
   - Schleife der Plattform: Die Datei endet nicht dort, wo sie wieder
     anfängt (die letzten 60 ms klingen aus und sind still; die Marken
     der Schleife gehen beim Auspacken verloren). Gesucht wird darum die
     Stelle E, deren letzte XF s dem Anfang am ähnlichsten sind
     (Korrelation), und dort leistungsgleich auf den Anfang überblendet:
     Schleife = x[XF..E], ihr Ende mündet in x[0..XF]. Davor kommt das
     Ende, dahinter der Anfang der Schleife (PAD s). Der Viewer schleift
     zwischen PAD und PAD + Länge: Weil der Inhalt dort periodisch ist,
     ist die Naht auch dann sauber, wenn ein Dekoder den Anfang um die
     Verzögerung des MP3-Kodierers versetzt (Browser tun das verschieden).
     Länge und PAD schreibt das Skript aus; sie stehen im Viewer
     (SND_LOOP). Passen sie nicht mehr zur neuen Datei, endet das Skript
     mit Fehler: Sonst schliffe der Viewer ins Polster oder ließe einen
     Teil der Aufnahme aus.
   - MP3 (VBR), weil jeder Browser es per decodeAudioData liest; Ogg und
     Opus liest Safari nicht verlässlich. Ohne Kopf-Metadaten.

   Aufruf (braucht ffmpeg mit libmp3lame):
     node scripts/build-hangar-sound.mjs [--from .cache/hangar-sound] [--to public/hangar/ton]
   ============================================================ */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = resolve(arg('--from', '.cache/hangar-sound'));
const TO = resolve(arg('--to', 'public/hangar/ton'));
const TRIM = -2;      // dB für alle: höchste Spitze +0,6 dBFS -> -1,4 dBFS
const PAD = 0.5;      // s vor und hinter der Schleife
const Q = '5';        // libmp3lame VBR-Stufe (etwa 130 kbit/s Stereo)
const XF = 0.1;       // s Überblendung an der Naht der Schleife
const XG = 0.1;       // s Überblendung zwischen den Stücken eines Schnitts
const FI = 0.02;      // s Einblenden am Anfang eines Schnitts (kein Knacken)
const V = 'assets/hangar-viewer.js';

// Ziel <- Quelle (Präfix vor der Kennung), Art: 0 ganz, 'schleife', oder
// ein Schnitt { teile: [[von, bis] s der Quelle, ...], aus: s, schlag: s der Quelle }
const PLAN = [
  // tiefer Anlauf-Schlag bei 0,15 s: ab 0,1 s, er kommt mit der Bewegung
  ['platte-start', 'platte_start_', { teile: [[0.1, 4.2]], aus: 0.2 }],
  ['platte-lauf', 'platte_lauf_loop_', 'schleife'],
  // anschwellender Schlag, Spitze bei 1,42 s: ab dem Anschwellen (0,72 s)
  ['platte-halt', 'platte_stopp_einrasten_', { teile: [[0.72, 3.45]], aus: 0.15, schlag: 1.42 }],
  // Entriegeln (0,22 s), dann der schwere Lauf vor dem tiefen Anschlag bei 15,68 s
  ['tor-auf', 'tor_auf_', { teile: [[0.22, 0.84], [14.9, 16.75]], aus: 0.15, schlag: 15.68 }],
  // lauter Anlauf, dann das Auslaufen vor dem Schlag bei 13,29 s (Teile
  // treffen sich), danach ausgeblendet; der leise Riegel bei 15,15 s fällt weg
  ['tor-zu', 'tor_zu_', { teile: [[0.04, 0.62], [12.47, 14.1]], aus: 0.45, schlag: 13.29 }],
  ['warnton', 'tor_alarm_piep_', 0],
];

if (!existsSync(FROM)) {
  console.error(`build-hangar-sound: ${FROM} fehlt. Die Klänge holt der PC-Auftrag aus dem Spiel (siehe liste.json dort).`);
  process.exit(1);
}
const liste = JSON.parse(readFileSync(join(FROM, 'liste.json'), 'utf8'));
const findSrc = (pre) => liste.dateien.find((d) => d.datei.startsWith(pre))?.datei;
const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const MP3 = ['-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '1', '-c:a', 'libmp3lame', '-q:a', Q];

// Quelle als Stereo-Gleitkomma (verschränkt) mit ihrer Abtastrate
function decode(src) {
  const sr = Number(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', src]).toString().trim());
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-f', 'f32le', '-ac', '2', '-'], { maxBuffer: 1 << 28 });
  return { sr, x: new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4) };
}
const encode = (z, sr, out) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(sr), '-ac', '2', '-i', 'pipe:0', '-af', `volume=${TRIM}dB`, ...MP3, out], { input: Buffer.from(z.buffer, z.byteOffset, z.byteLength) });

// Schnitt (siehe Kopf): Stücke aneinander, gibt die Stelle des Schlags zurück
function splice(src, out, { teile, aus, schlag }) {
  const { sr, x } = decode(src), n = x.length / 2, F = Math.round(XG * sr);
  const parts = teile.map(([a, b]) => [Math.round(a * sr), Math.min(n, Math.round(b * sr))]);
  const len = parts.reduce((s, [a, b]) => s + b - a, 0) - F * (parts.length - 1);
  const z = new Float32Array(len * 2);
  let at = 0, hit = null;
  parts.forEach(([a, b], p) => {
    const m = b - a;
    for (let i = 0; i < m; i++) for (let ch = 0; ch < 2; ch++) {
      let g = 1;
      if (p > 0 && i < F) g = Math.sin(((i + 0.5) / F) * Math.PI / 2);
      if (p < parts.length - 1 && i >= m - F) g = Math.cos(((i - (m - F) + 0.5) / F) * Math.PI / 2);
      z[2 * (at + i) + ch] += g * x[2 * (a + i) + ch];
    }
    if (schlag != null && schlag * sr >= a && schlag * sr < b) hit = (at + schlag * sr - a) / sr;
    at += m - F;
  });
  const fi = Math.round(FI * sr), fo = Math.round(aus * sr);
  for (let i = 0; i < len; i++) {
    const g = Math.min(1, (i + 0.5) / fi, (len - i - 0.5) / fo);
    if (g < 1) { z[2 * i] *= g; z[2 * i + 1] *= g; }
  }
  encode(z, sr, out);
  return hit;
}

// Schleife bauen (siehe Kopf): dekodieren, Naht suchen, überblenden, polstern
function loop(src, out) {
  const { sr, x } = decode(src), n = x.length / 2;
  const mid = new Float32Array(n);
  for (let i = 0; i < n; i++) mid[i] = (x[2 * i] + x[2 * i + 1]) / 2;
  // hörbares Ende: danach nur Ausklang und Stille
  let last = n - 1;
  while (last > 0 && Math.abs(mid[last]) < 1e-3) last--;
  const F = Math.round(XF * sr), lo = Math.round(Math.max(1, last / sr - 1.5) * sr);
  let ref = 0;
  for (let i = 0; i < F; i++) ref += mid[i] * mid[i];
  let best = -2, E = 0;
  for (let e = lo; e <= last - Math.round(0.02 * sr); e++) {
    let d = 0, q = 0;
    for (let i = 0; i < F; i++) { const v = mid[e - F + i]; d += v * mid[i]; q += v * v; }
    const c = d / Math.sqrt(q * ref + 1e-12);
    if (c > best) { best = c; E = e; }
  }
  // y = x[F..E], die letzten F Samples gehen leistungsgleich in x[0..F] über
  const len = E - F, y = new Float32Array(len * 2);
  for (let i = 0; i < len; i++) for (let ch = 0; ch < 2; ch++) {
    const j = F + i, k = i - (len - F);
    let v = x[2 * j + ch];
    if (k >= 0) { const a = (k + 0.5) / F; v = v * Math.cos(a * Math.PI / 2) + x[2 * k + ch] * Math.sin(a * Math.PI / 2); }
    y[2 * i + ch] = v;
  }
  const P = Math.round(PAD * sr), z = new Float32Array((len + 2 * P) * 2);
  z.set(y.subarray((len - P) * 2), 0);
  z.set(y, P * 2);
  z.set(y.subarray(0, P * 2), (P + len) * 2);
  encode(z, sr, out);
  console.log(`  Schleife: Naht bei ${(E / sr).toFixed(4)} s (Ähnlichkeit ${best.toFixed(3)}), Länge ${(len / sr).toFixed(6)} s, Polster ${PAD} s -> SND_LOOP { start: ${PAD}, len: ${(len / sr).toFixed(6)} }`);
  return len / sr;
}

mkdirSync(TO, { recursive: true });
const viewer = existsSync(V) ? readFileSync(V, 'utf8') : '';
let hits = null;
try { hits = JSON.parse((/const SND_HIT = (\{[^}]*\});/.exec(viewer)?.[1] ?? 'null').replace(/'/g, '"')); } catch { hits = null; }
let total = 0;
for (const [name, pre, art] of PLAN) {
  const file = findSrc(pre);
  if (!file) { console.error(`build-hangar-sound: liste.json nennt keine Datei ${pre}*`); process.exit(1); }
  const src = join(FROM, file), out = join(TO, `${name}.mp3`), dur = probe(src);
  let note = '';
  if (art === 'schleife') {
    // die Marken der Schleife stehen im Viewer: dort muss die neue Länge hin
    const got = loop(src, out);
    const m = /const SND_LOOP = \{ start: ([\d.]+), len: ([\d.]+) \};/.exec(viewer);
    if (!m || Number(m[1]) !== PAD || Math.abs(Number(m[2]) - got) > 2e-6) {
      console.error(`build-hangar-sound: ${V} schleift ${m ? `ab ${m[1]} über ${m[2]} s` : '(SND_LOOP nicht gefunden)'}, die neue Datei braucht SND_LOOP = { start: ${PAD}, len: ${got.toFixed(6)} }. Dort eintragen, sonst schleift der Viewer ins Polster.`);
      process.exitCode = 1;
    }
  } else if (art) {
    // der Schlag steht im Viewer (SND_HIT): dort setzt er den Klang an
    const hit = splice(src, out, art);
    if (art.schlag != null) {
      note = `, Schlag bei ${hit?.toFixed(3) ?? '?'} s`;
      if (hit == null || !(Math.abs((hits?.[name] ?? NaN) - hit) <= 1e-3)) {
        console.error(`build-hangar-sound: ${name} schlägt bei ${hit == null ? `(${art.schlag} s liegt in keinem Stück)` : `${hit.toFixed(3)} s`} an, ${V} nennt ${hits ? `SND_HIT['${name}'] = ${hits[name]}` : '(SND_HIT nicht gefunden)'}. Dort eintragen, sonst setzt der Viewer den Klang daneben an.`);
        process.exitCode = 1;
      }
    }
  } else ff(['-i', src, '-af', `volume=${TRIM}dB`, ...MP3, out]);
  const bytes = statSync(out).size;
  total += bytes;
  console.log(`  ${name.padEnd(14)} ${probe(out).toFixed(3)} s  ${(bytes / 1024).toFixed(1)} KB   <- ${file} (${dur.toFixed(3)} s${note})`);
}
console.log(`build-hangar-sound: ${PLAN.length} Klänge, ${(total / 1024).toFixed(0)} KB in ${TO}`);
