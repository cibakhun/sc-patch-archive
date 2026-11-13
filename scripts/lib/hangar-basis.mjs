/* ============================================================
   hangar-basis.mjs — laesst den Umwandler der komprimierten
   Hangar-Texturen (basis_transcoder.js + .wasm, vendortes three) in Node
   laufen, wahlweise so, wie die Richtlinie der Seite es verlangt: ohne
   Code aus Zeichenketten.

   WARUM ES DAS GIBT: Die Seite erlaubt kein 'unsafe-eval' (nginx,
   Content-Security-Policy), und ein Worker aus einem Blob erbt die
   Richtlinie seiner Seite. Der Umwandler, wie three ihn ausliefert, baut
   beim Start seine Aufrufer mit `new Function(...)` (embind, zwei
   Stellen). Unter der Richtlinie wirft das einen EvalError im Worker,
   der Worker antwortet nie, und der Hangar blieb am 13.11.2026 beim
   Laden stehen — in der Vorschau von astro (ohne Richtlinie) lief alles,
   gezeigt hat es erst ein Lauf gegen den echten nginx. Die Kopie unter
   public/vendor/three/ traegt deshalb zwei benannte Korrekturen
   (scripts/verify-vendor-three.mjs, PATCHED): dieselbe Logik als feste
   Funktionen, wie emscripten sie mit DYNAMIC_EXECUTION=0 selbst baut.

   Node kann die Richtlinie nachstellen: ein vm-Kontext mit
   codeGeneration.strings = false wirft bei eval und new Function genau
   den EvalError des Browsers. verify:hangar-ktx laesst den ausgelieferten
   Umwandler so echte Zwillinge umwandeln und vergleicht das Ergebnis Byte
   fuer Byte mit dem des unveraenderten Umwandlers aus node_modules/three
   (der darf Zeichenketten ausfuehren).

   Die Aufrufe sind die des Workers in KTX2Loader.js (transcode()).
   ============================================================ */
import vm from 'node:vm';
import { createHash } from 'node:crypto';

// TranscoderFormat in KTX2Loader.js: was der Viewer am PC verlangt
export const BASIS_FORMATE = { BC7: 7, ASTC: 10 };

const WANDLE = `(function (M, ab, format) {
  const f = new M.KTX2File(new Uint8Array(ab));
  try {
    if (!f.isValid()) throw new Error('keine gueltige KTX2-Datei');
    const art = f.isUASTC() ? 'uastc' : f.isETC1S() ? 'etc1s' : f.isHDR() ? 'hdr' : '?';
    const breite = f.getWidth(), hoehe = f.getHeight(), stufen = f.getLevels(), alpha = f.getHasAlpha(), dfd = f.getDFDFlags();
    f.getLayers(); f.getFaces();
    if (!f.startTranscoding()) throw new Error('startTranscoding scheitert');
    const teile = [];
    for (let mip = 0; mip < stufen; mip++) {
      const info = f.getImageLevelInfo(mip, 0, 0);
      const dst = new Uint8Array(f.getImageTranscodedSizeInBytes(mip, 0, 0, format));
      if (!f.transcodeImage(dst, mip, 0, 0, format, 0, -1, -1)) throw new Error('transcodeImage scheitert in Stufe ' + mip);
      teile.push([info.origWidth, info.origHeight, dst]);
    }
    return { art, breite, hoehe, stufen, alpha, dfd, teile };
  } finally { f.close(); f.delete(); }
})`;

/** Startet den Umwandler in einem eigenen Kontext. zeichenketten = false
 *  stellt die Richtlinie der Seite nach. Wirft, wenn der Start scheitert
 *  (der EvalError steht dann in der Meldung). */
export async function basisStart(glue, wasm, { zeichenketten = false, warteMs = 20000 } = {}) {
  const fehler = [];
  const melde = (...a) => fehler.push(a.map((x) => (x && x.stack) || String(x)).join(' '));
  const welt = { console: { log() {}, info() {}, debug() {}, warn: melde, error: melde }, TextDecoder, TextEncoder, performance, setTimeout, clearTimeout, URL, importScripts() {} };
  welt.self = welt;
  welt.location = { href: 'http://hangar.invalid/basis_transcoder.js' };
  const ctx = vm.createContext(welt, { codeGeneration: { strings: zeichenketten, wasm: true } });
  const BASIS = vm.runInContext(`${glue}\n;BASIS`, ctx, { filename: 'basis_transcoder.js' });
  const wandle = vm.runInContext(WANDLE, ctx, { filename: 'hangar-basis-wandle.js' });
  // Wie der Worker: scheitert der Start (embind wirft beim Anmelden der
  // Klassen), kommt onRuntimeInitialized nie. Deshalb mit Frist.
  let frist;
  const M = await Promise.race([
    Promise.resolve().then(() => BASIS({ wasmBinary: new Uint8Array(wasm) })),
    new Promise((_, nein) => { frist = setTimeout(() => nein(new Error(`der Umwandler startet nicht (${warteMs / 1000} s)${fehler.length ? `: ${fehler[0].slice(0, 300)}` : ''}`)), warteMs); }),
  ]).finally(() => clearTimeout(frist));
  M.initializeBasis();
  if (M.KTX2File === undefined) throw new Error('der Umwandler kennt KTX2File nicht');
  return {
    /** Wandelt eine KTX2-Datei um: Kennzahlen und ein SHA-256 ueber alle Stufen. */
    wandle(buf, format) {
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const r = wandle(M, ab, format);
      const h = createHash('sha256');
      let bytes = 0;
      for (const [w, hh, dst] of r.teile) { h.update(`${w}x${hh}:`); h.update(Buffer.from(dst.buffer, dst.byteOffset, dst.byteLength)); bytes += dst.byteLength; }
      return { art: r.art, breite: r.breite, hoehe: r.hoehe, stufen: r.stufen, alpha: !!r.alpha, bytes, sha: h.digest('hex') };
    },
  };
}
