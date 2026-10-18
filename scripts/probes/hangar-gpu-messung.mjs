/* ============================================================
   hangar-gpu-messung.mjs — GPU-Zeit des Hangars je Durchgang, im echten
   Chrome auf dem echten Grafikchip.

   EINE SONDE, KEIN TOR (wie alle Dateien unter scripts/probes/): braucht
   Chrome, einen Grafikchip und eine laufende Seite.

   Gemessen wird am Zeichenkontext selbst (EXT_disjoint_timer_query_webgl2),
   nicht am Viewer: jeder Wechsel des Zielbilds (bindFramebuffer) beginnt
   einen neuen Abschnitt, jedes Bild (requestAnimationFrame) ebenso. Der
   Abschnitt trägt die Namen der Shader, die darin zeichnen (three.js setzt
   SHADER_NAME/SHADER_TYPE), die Größe des Zielbilds, Zeichenaufrufe und
   Dreiecke, Shaderwechsel, Texturbindungen, Uniform-Aufrufe und die
   Prozessorzeit, die das Absetzen gekostet hat.

   ⚠ Zwei Fallen, beide am 18.10.2026 erst nach Stunden erkannt:
   · Wartet der Chip auf den Prozessor (der Hangar tat es: 17 ms Skript je
     Bild), misst die Zeitabfrage die Zeit zum ABSETZEN, nicht die Arbeit
     des Chips. Spalte „CPU-ms" daneben zeigt, ob das der Fall ist.
   · Die Auslastung im Task-Manager gilt für den gerade gefahrenen Takt.
     Weniger Arbeit senkt oft nur den Takt, der Prozentwert bleibt. Für
     Vergleiche zählt Takt mal Auslastung (GHz·%), je Variante mindestens
     zwei Läufe im Wechsel: Andere Programme auf dem Chip streuen stark.

     node scripts/probes/hangar-gpu-messung.mjs --base http://localhost:4391
       [--grafik hoch|mittel|niedrig] [--secs 10] [--w 1920 --h 970]
       [--path /hangar] [--headed] [--json out.json] [--nodrag] [--rest]
       [--brief] [--nogl] [--split prog] [--seq] [--profile] [--css '<regeln>'] [--dsf 2]

   Für die Arbeit des Chips je Durchgang: --dsf 2 (doppelte Pixeldichte)
   mit einer Viewer-Kopie im Messmodus (feste Kamera, ohne Takt): Dann ist
   der Chip voll ausgelastet, und die Zeitabfrage misst ihn statt der CPU.
   ============================================================ */
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = flag('--base', 'http://localhost:4391').replace(/\/$/, '');
const PATH = flag('--path', '/hangar');
const GRAFIK = flag('--grafik', 'hoch');
const SECS = Number(flag('--secs', '10'));
const W = Number(flag('--w', '1920')), H = Number(flag('--h', '970'));
// --dsf 2: doppelte Pixeldichte. Dann ist der Chip voll ausgelastet, läuft mit vollem Takt,
// und die Zeitabfrage je Durchgang misst seine Arbeit statt des Wartens auf die CPU.
const DSF = Number(flag('--dsf', '1'));
const JSON_OUT = flag('--json', null);
const HEADED = argv.includes('--headed');
// --split prog: dazu ein Abschnitt je Shaderwechsel (Kosten je Material)
const SPLIT = flag('--split', 'fb');
// --seq: Abschnitte nach ihrer Stelle im Bild statt nach Inhalt (gleich benannte Vollbild-Pässe trennen)
const SEQ = argv.includes('--seq');
// --brief: nur die Summen je Lage; --extra 'a=b&c=d': weitere Adressparameter
const BRIEF = argv.includes('--brief');
const EXTRA = flag('--extra', '');
// --nogl: ohne Eingriff in den Zeichenkontext (nur CPU je Bild und nvidia-smi)
const NOGL = argv.includes('--nogl');

function probe(opt) {
  const P = (window.__gpuProbe = { ctxs: [], on: false });
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const gl = getContext.call(this, type, attrs);
    if (gl && type === 'webgl2' && !gl.__probe && !opt.nogl) wrap(gl);
    return gl;
  };
  function wrap(gl) {
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const S = { gl, ext, frames: [], pending: [], frame: null, seg: null, prog: null, names: new WeakMap(), src: new WeakMap(), fbs: new WeakMap(), nfb: 0, vp: '', fb: 'start' };
    gl.__probe = S;
    P.ctxs.push(S);
    const o = {};
    for (const k of ['shaderSource', 'attachShader', 'useProgram', 'bindFramebuffer', 'viewport', 'drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'blitFramebuffer', 'clear']) o[k] = gl[k].bind(gl);
    const nameOf = (src) => (/#define SHADER_NAME (.+)/.exec(src) || /#define SHADER_TYPE (.+)/.exec(src) || [])[1]?.trim();
    gl.shaderSource = (sh, src) => { S.src.set(sh, nameOf(src)); return o.shaderSource(sh, src); };
    gl.attachShader = (p, sh) => { const n = S.src.get(sh); if (n && !S.names.get(p)) S.names.set(p, n); return o.attachShader(p, sh); };
    gl.useProgram = (p) => {
      if (opt.split === 'prog' && S.frame && p !== S.prog) { close(); open(S.fb); }
      if (S.seg && p !== S.prog) S.seg.sw++;
      S.prog = p;
      return o.useProgram(p);
    };
    gl.viewport = (x, y, w, h) => { S.vp = `${w}x${h}`; if (S.seg) S.seg.vp = S.vp; return o.viewport(x, y, w, h); };
    const fbName = (fb) => {
      if (!fb) return 'canvas';
      if (!S.fbs.has(fb)) S.fbs.set(fb, `fb${++S.nfb}`);
      return S.fbs.get(fb);
    };
    const open = (fb) => {
      if (!S.frame || !ext) return;
      S.seg = { fb, vp: S.vp, draws: 0, tris: 0, blits: 0, clears: 0, progs: {}, ms: null, sw: 0, tex: 0, unif: 0, c0: performance.now(), cpu: 0 };
      S.seg.q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, S.seg.q);
      S.frame.segs.push(S.seg);
    };
    const close = () => {
      if (!S.seg) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      S.seg.cpu = performance.now() - S.seg.c0;
      S.pending.push(S.seg);
      S.seg = null;
    };
    gl.bindFramebuffer = (t, fb) => {
      const r = o.bindFramebuffer(t, fb);
      if (t !== gl.READ_FRAMEBUFFER) { S.fb = fbName(fb); if (S.frame) { close(); open(S.fb); } }
      return r;
    };
    const tri = (mode, n) => (mode === gl.TRIANGLES ? n / 3 : mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN ? n - 2 : 0);
    const count = (mode, n, inst = 1) => {
      const s = S.seg;
      if (!s) return;
      s.draws++;
      s.tris += tri(mode, n) * inst;
      const nm = S.names.get(S.prog) || '?';
      s.progs[nm] = (s.progs[nm] || 0) + 1;
    };
    gl.drawArrays = (m, f, n) => { count(m, n); return o.drawArrays(m, f, n); };
    gl.drawElements = (m, n, t, off) => { count(m, n); return o.drawElements(m, n, t, off); };
    gl.drawRangeElements = (m, a, b, n, t, off) => { count(m, n); return o.drawRangeElements(m, a, b, n, t, off); };
    gl.drawArraysInstanced = (m, f, n, i) => { count(m, n, i); return o.drawArraysInstanced(m, f, n, i); };
    gl.drawElementsInstanced = (m, n, t, off, i) => { count(m, n, i); return o.drawElementsInstanced(m, n, t, off, i); };
    gl.blitFramebuffer = (...a) => { if (S.seg) S.seg.blits++; return o.blitFramebuffer(...a); };
    gl.clear = (b) => { if (S.seg) S.seg.clears++; return o.clear(b); };
    const bt = gl.bindTexture.bind(gl);
    gl.bindTexture = (t, x) => { if (S.seg) S.seg.tex++; return bt(t, x); };
    for (const k of Object.getOwnPropertyNames(WebGL2RenderingContext.prototype).filter((n) => /^uniform(Matrix)?\d/.test(n))) {
      const f = gl[k].bind(gl);
      gl[k] = (...a) => { if (S.seg) S.seg.unif++; return f(...a); };
    }
    S.begin = () => { if (!P.on || !ext) return; S.frame = { t: performance.now(), segs: [] }; open('start'); };
    S.end = () => {
      if (!S.frame) return;
      close();
      if (S.frame.segs.some((s) => s.draws || s.blits)) S.frames.push(S.frame);
      else for (const s of S.frame.segs) s.drop = true;
      S.frame = null;
    };
    S.poll = () => {
      if (!ext) return;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (S.pending.length) {
        const s = S.pending[0];
        if (!gl.getQueryParameter(s.q, gl.QUERY_RESULT_AVAILABLE)) break;
        const ns = gl.getQueryParameter(s.q, gl.QUERY_RESULT);
        s.ms = disjoint ? null : ns / 1e6;
        gl.deleteQuery(s.q);
        delete s.q;
        S.pending.shift();
      }
    };
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    for (const S of P.ctxs) S.begin();
    const c0 = performance.now(), on = P.on;
    try { cb(t); } finally { const cpu = performance.now() - c0; for (const S of P.ctxs) { if (S.frame) S.frame.cpu = cpu; S.end(); S.poll(); } if (on && cpu > 0.5) P.cpu.push(cpu); }
  });
  P.start = () => { for (const S of P.ctxs) { S.frames = []; } P.cpu = []; P.on = true; P.t0 = performance.now(); };
  P.stop = () => { P.on = false; P.t1 = performance.now(); };
  P.flush = () => { for (const S of P.ctxs) S.poll(); return P.ctxs.every((S) => !S.pending.length); };
  P.report = () => {
    const secs = (P.t1 - P.t0) / 1000;
    if (!P.ctxs.length) return [{ cpuMsPerFrame: +(P.cpu.reduce((a, b) => a + b, 0) / Math.max(1, P.cpu.length)).toFixed(2), frames: P.cpu.length, secs: +secs.toFixed(2), fps: +(P.cpu.length / secs).toFixed(1), gpuMsPerSec: 0, gpuMsPerFrame: 0, rows: [] }];
    return P.ctxs.map((S) => {
      const frames = S.frames.filter((f) => f.segs.every((s) => s.ms != null || s.drop));
      const groups = new Map();
      let total = 0;
      for (const f of frames) for (let i = 0, j = 0; i < f.segs.length; i++) {
        const s = f.segs[i];
        if (!(s.draws || s.blits || s.clears)) { total += s.ms || 0; continue; }
        j++;
        const progs = Object.entries(s.progs).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}×${c}`).slice(0, 4).join(' ');
        const key = `${opt.seq ? `#${String(j).padStart(2, '0')} ` : ''}${s.vp} ${progs || (s.blits ? 'blit' : 'clear')}`;
        const g = groups.get(key) || { key, n: 0, ms: 0, draws: 0, tris: 0, fbs: new Set(), cpu: 0, sw: 0, tex: 0, unif: 0 };
        g.n++; g.ms += s.ms || 0; g.draws += s.draws; g.tris += s.tris; g.fbs.add(s.fb);
        g.cpu += s.cpu; g.sw += s.sw; g.tex += s.tex; g.unif += s.unif;
        groups.set(key, g);
        total += s.ms || 0;
      }
      const rows = [...groups.values()].sort((a, b) => b.ms - a.ms).map((g) => ({
        pass: g.key, perFrame: +(g.n / frames.length).toFixed(2), msEach: +(g.ms / g.n).toFixed(3),
        msPerSec: +(g.ms / secs).toFixed(1), draws: Math.round(g.draws / g.n), tris: Math.round(g.tris / g.n), fbs: [...g.fbs].join(','),
        cpuEach: +(g.cpu / g.n).toFixed(3), sw: Math.round(g.sw / g.n), tex: Math.round(g.tex / g.n), unif: Math.round(g.unif / g.n),
      }));
      const cpu = frames.reduce((a, f) => a + (f.cpu || 0), 0) / Math.max(1, frames.length);
      const cpuMax = frames.reduce((a, f) => Math.max(a, f.cpu || 0), 0);
      return { cpuMsPerFrame: +cpu.toFixed(2), cpuMax: +cpuMax.toFixed(1), frames: frames.length, secs: +secs.toFixed(2), fps: +(frames.length / secs).toFixed(1), gpuMsPerSec: +(total / secs).toFixed(1), gpuMsPerFrame: +(total / Math.max(1, frames.length)).toFixed(2), rows };
    }).sort((a, b) => b.frames - a.frames);
  };
}

const browser = await chromium.launch({
  channel: 'chrome', headless: !HEADED,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', `--window-size=${W},${H + 120}`],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, bypassCSP: true });
await page.addInitScript(probe, { split: SPLIT, nogl: NOGL, seq: SEQ });
// --xp a,b: Versuchsschalter einer gepatchten Viewer-Kopie (die Seite schreibt die Adresse um, bevor der Viewer lädt)
await page.addInitScript((x) => { window.__XP = x; }, flag('--xp', ''));
// --css '<regeln>': zusätzliche Regeln für die Seite (welche Ebenen beim Zusammensetzen kosten)
if (flag('--css', null)) await page.addInitScript((css) => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }); }, flag('--css', null));
const logs = [];
page.on('console', (m) => { if (m.text().startsWith('[hangar]')) logs.push(m.text()); });
const url = `${BASE}${PATH}${PATH.includes('?') ? '&' : '?'}grafik=${GRAFIK}${EXTRA ? `&${EXTRA}` : ''}`;
await page.goto(url, { waitUntil: 'load' });
await page.bringToFront();
await page.waitForFunction((nogl) => nogl || window.__gpuProbe.ctxs.some((s) => s.gl.canvas.isConnected), NOGL, { timeout: 60000 });
const env = await page.evaluate(() => {
  const S = window.__gpuProbe.ctxs.find((s) => s.gl.canvas.isConnected);
  const gl = S?.gl || document.createElement('canvas').getContext('webgl2'), x = gl.getExtension('WEBGL_debug_renderer_info');
  return { gpu: gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER), timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), focus: document.hasFocus() };
});
console.log(`GPU: ${env.gpu} · Zeitmessung ${env.timer ? 'ja' : 'NEIN'} · Fokus ${env.focus}`);
// --nogl misst nur die CPU je Bild und braucht die Zeitabfrage nicht
if (!env.timer && !NOGL) { await browser.close(); process.exit(2); }
// Halle, Schiff und Crew sind da, und das Nachhallen des Ladens ist vorbei
await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.style.opacity !== '0' && c.width > 100), null, { timeout: 120000 });
await page.waitForTimeout(12000);

// Auslastung, Takt und Leistungsaufnahme des Chips laut Treiber (nur NVIDIA)
function smi() {
  const rows = [];
  let p;
  try { p = spawn('nvidia-smi', ['--query-gpu=utilization.gpu,clocks.gr,power.draw', '--format=csv,noheader,nounits', '-lms', '200']); } catch { return { stop: () => null }; }
  p.on('error', () => {});
  p.stdout.on('data', (d) => { for (const l of String(d).split(/\r?\n/)) { const v = l.split(',').map(Number); if (v.length === 3 && v.every(Number.isFinite)) rows.push(v); } });
  return { stop() { p.kill(); if (!rows.length) return null; const m = (i) => rows.reduce((a, r) => a + r[i], 0) / rows.length; return { util: +m(0).toFixed(1), mhz: Math.round(m(1)), watts: +m(2).toFixed(1), n: rows.length }; } };
}

// GPU-Auslastung allein des Grafikprozesses dieses Browsers, so wie der
// Task-Manager sie zeigt (Leistungszähler „GPU Engine", 3D-Einheit). Andere
// Programme auf dem Chip zählen hier nicht mit, anders als bei nvidia-smi.
function taskmgr() {
  if (process.platform !== 'win32') return { stop: () => null };
  const ps = `$ErrorActionPreference = 'SilentlyContinue'
$g = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match 'playwright' -and $_.CommandLine -match '--type=gpu-process' } | ForEach-Object { [int]$_.ProcessId })
while ($true) {
  $s = (Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage').CounterSamples | Where-Object { $_.InstanceName -match '^pid_(\\d+)_' -and $g -contains [int]$matches[1] }
  [Console]::WriteLine([string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0}', ($s | Measure-Object CookedValue -Sum).Sum))
}`;
  const rows = [];
  const p = spawn('powershell', ['-NoProfile', '-Command', ps]);
  p.on('error', () => {});
  p.stdout.on('data', (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim() && Number.isFinite(+l)) rows.push(+l); });
  return { stop() { p.kill(); const r = rows.slice(1); return r.length ? { util: +(r.reduce((a, b) => a + b, 0) / r.length).toFixed(1), n: r.length } : null; } };
}

async function measure(label, drive) {
  await page.evaluate(() => window.__gpuProbe.start());
  const nv = smi(), tm = taskmgr();
  await drive();
  const chip = nv.stop(), win = tm.stop();
  if (chip && win) chip.taskmgr = win.util;
  await page.evaluate(() => window.__gpuProbe.stop());
  for (let i = 0; i < 50 && !(await page.evaluate(() => window.__gpuProbe.flush())); i++) await page.waitForTimeout(50);
  const [r] = await page.evaluate(() => window.__gpuProbe.report());
  console.log(`\n── ${label}: ${r.fps} Bilder/s, GPU ${r.gpuMsPerSec} ms je Sekunde (${(r.gpuMsPerSec / 10).toFixed(1)} %), ${r.gpuMsPerFrame} ms je Bild (CPU ${r.cpuMsPerFrame} ms, längstes ${r.cpuMax} ms), ${r.frames} Bilder in ${r.secs} s`);
  // Auslastung gilt für den Takt, mit dem der Chip gerade läuft; weniger Arbeit senkt oft nur den Takt.
  // Takt mal Auslastung (GHz·%) ist die Arbeit, unabhängig davon.
  if (chip) console.log(`   Task-Manager (3D, nur dieser Browser): ${chip.taskmgr ?? '?'} % bei ${chip.mhz} MHz = ${chip.taskmgr != null ? (chip.taskmgr * chip.mhz / 1000).toFixed(1) : '?'} GHz·% · nvidia-smi (ganzer Chip): ${chip.util} %, ${chip.watts} W`);
  if (BRIEF) return { label, chip, ...r };
  console.log('  ms/s    ms/Abschn. CPU-ms  je Bild  Aufrufe Progr. Tex.  Unif.  Dreiecke   Durchgang');
  for (const x of (SEQ ? [...r.rows].sort((a, b) => a.pass.localeCompare(b.pass)) : r.rows).slice(0, SPLIT === 'prog' || SEQ ? 40 : 18)) {
    console.log(`  ${String(x.msPerSec).padStart(6)}  ${x.msEach.toFixed(3).padStart(8)}  ${x.cpuEach.toFixed(3).padStart(6)}  ${String(x.perFrame).padStart(6)}  ${String(x.draws).padStart(7)} ${String(x.sw).padStart(5)} ${String(x.tex).padStart(5)} ${String(x.unif).padStart(6)}  ${String(x.tris).padStart(9)}   ${x.pass}`);
  }
  return { label, chip, ...r };
}

const box = await page.evaluate(() => {
  const c = [...document.querySelectorAll('canvas')].find((x) => x.width > 100);
  const r = c.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
});
// Einmal über die Bühne: Der Viewer zählt Leerlauf (ab 2 s, weicheres Bild)
// und Ruhe (ab 20 s, kein Bild) ab der letzten Zeigerbewegung über ihr.
await page.mouse.move(box.x, box.y);
await page.mouse.move(box.x + 20, box.y + 10);
await page.mouse.move(5, 5);
const idleFrom = Date.now();
await page.waitForTimeout(3000);
const out = [];
// --profile: CPU-Profil des Leerlaufs, Eigenzeit je Funktion (wo die Bildzeit der CPU hingeht)
if (argv.includes('--profile')) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(SECS * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const dt = new Map();
  for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
  const self = new Map(), byFile = new Map();
  let all = 0;
  for (const n of profile.nodes) {
    const us = dt.get(n.id) || 0;
    if (!us) continue;
    const f = n.callFrame, file = (f.url || '').split('/').pop().split('?')[0] || f.functionName;
    const k = `${f.functionName || '(anonym)'} ${file}:${f.lineNumber + 1}`;
    self.set(k, (self.get(k) || 0) + us);
    byFile.set(file, (byFile.get(file) || 0) + us);
    if (!/^\((idle|program|garbage collector)\)$/.test(f.functionName)) all += us;
  }
  const ms = (us) => (us / 1000 / SECS).toFixed(1).padStart(7);
  console.log(`\n── CPU-Profil Leerlauf: ${ms(all)} ms je Sekunde im Skript`);
  console.log('  ms/s   Datei');
  for (const [k, us] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`${ms(us)}   ${k}`);
  console.log('  ms/s   Funktion (Eigenzeit)');
  for (const [k, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${ms(us)}   ${k}`);
  await browser.close();
  process.exit(0);
}
out.push(await measure('Leerlauf (Umlauf, Crew)', () => page.waitForTimeout(SECS * 1000)));
// --rest: dazu die Ruhe, ab 23 s nach der letzten Zeigerbewegung über der Bühne
if (argv.includes('--rest')) {
  await page.waitForTimeout(Math.max(0, idleFrom + 23000 - Date.now()));
  out.push(await measure('Ruhe (über 20 s ohne Eingabe)', () => page.waitForTimeout(SECS * 1000)));
}
if (!argv.includes('--nodrag')) out.push(await measure('Drehen (Ziehen mit der Maus)', async () => {
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < SECS * 1000; i++) {
    await page.mouse.move(box.x + Math.sin(i / 20) * box.w * 0.2, box.y + Math.cos(i / 31) * box.h * 0.05);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}));
console.log(`\n${page.url()}\n${logs.filter((l) => /Leistungsstufe|Lampen|Schatten|xp/.test(l)).join('\n')}`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ url, env, w: W, h: H, runs: out, logs }, null, 2));
await browser.close();
