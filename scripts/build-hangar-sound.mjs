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
   - Länge: nur die stille Rest-Sekunde hinten weg (Tor) und ein kurzes
     Ausblenden; der Takt der Bewegung hängt am Anfang der Datei.
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
     (SND_LOOP).
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

// Ziel <- Quelle (Präfix vor der Kennung), Länge s (0 = ganz), Ausblenden s
const PLAN = [
  ['platte-start', 'platte_start_', 4.2, 0.2],
  ['platte-lauf', 'platte_lauf_loop_', 'schleife', 0],
  ['platte-halt', 'platte_stopp_einrasten_', 3.45, 0.15],
  ['tor-auf', 'tor_auf_', 16.8, 0.25],
  ['tor-zu', 'tor_zu_', 16.0, 0.2],
  ['warnton', 'tor_alarm_piep_', 0, 0],
  ['dampf-1', 'dampf_boden_1_', 0, 0],
  ['dampf-2', 'dampf_boden_2_', 0, 0],
  ['dampf-3', 'dampf_boden_3_', 0, 0],
  ['dampf-4', 'dampf_boden_4_', 0, 0],
  ['druckablass', 'druckablass_lang_', 0, 0],
  ['luftstoss', 'tor_luftstoss_', 0, 0],
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

// Schleife bauen (siehe Kopf): dekodieren, Naht suchen, überblenden, polstern
function loop(src, out) {
  const sr = Number(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', src]).toString().trim());
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-f', 'f32le', '-ac', '2', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4), n = x.length / 2;
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
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(sr), '-ac', '2', '-i', 'pipe:0', '-af', `volume=${TRIM}dB`, ...MP3, out], { input: Buffer.from(z.buffer) });
  console.log(`  Schleife: Naht bei ${(E / sr).toFixed(4)} s (Ähnlichkeit ${best.toFixed(3)}), Länge ${(len / sr).toFixed(6)} s, Polster ${PAD} s -> SND_LOOP { start: ${PAD}, len: ${(len / sr).toFixed(6)} }`);
}

mkdirSync(TO, { recursive: true });
let total = 0;
for (const [name, pre, len, fade] of PLAN) {
  const file = findSrc(pre);
  if (!file) { console.error(`build-hangar-sound: liste.json nennt keine Datei ${pre}*`); process.exit(1); }
  const src = join(FROM, file), out = join(TO, `${name}.mp3`), dur = probe(src);
  if (len === 'schleife') loop(src, out);
  else {
    const end = len ? Math.min(len, dur) : dur;
    const af = [`volume=${TRIM}dB`];
    if (len) af.unshift(`atrim=end=${end.toFixed(3)}`, `afade=t=out:st=${(end - fade).toFixed(3)}:d=${fade}`);
    ff(['-i', src, '-af', af.join(','), ...MP3, out]);
  }
  const bytes = statSync(out).size;
  total += bytes;
  console.log(`  ${name.padEnd(14)} ${probe(out).toFixed(3)} s  ${(bytes / 1024).toFixed(1)} KB   <- ${file} (${dur.toFixed(3)} s)`);
}
console.log(`build-hangar-sound: ${PLAN.length} Klänge, ${(total / 1024).toFixed(0)} KB in ${TO}`);
