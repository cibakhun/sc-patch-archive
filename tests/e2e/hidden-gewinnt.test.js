// [hidden] gewinnt auf jeder Seite (assets/theme.css).
//
// Anlass (Krisz, 07.11.2026): am Handy zeigte der Crafting-Planer „Synced to
// your account" zusammen mit „Sign in" und „Retry". crafting-app.js setzte
// hidden richtig, aber die UA-Regel [hidden]{display:none} verliert gegen jede
// Autor-Regel, die display setzt, und mobile-ux.css hebt unter 821 px jeden
// <button> (und den Anmelde-Link des Planers) auf inline-flex. Seitdem steht
// in theme.css EINE Regel mit !important für alle.
//
// Was der Browser daraus zeichnet, prüft scripts/browser-smoke.mjs ([6] und
// die Probe des Crafting-Planers). Dieser Test läuft ohne Browser im Tor
// (Schiene A) und hält die Voraussetzung fest: die Regel steht, ungeschachtelt,
// in der Datei, die jede Seite lädt, und kein Stilblatt hebt sie mit eigenem
// !important wieder auf, außer einer benannten Ausnahme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ohneKommentare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Jede Regel als { selektor, block, tiefe }; tiefe 0 = nicht in @media/@supports.
function regeln(css) {
  const out = [];
  const stapel = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      const kopf = css.slice(start, i).trim();
      stapel.push({ kopf, auf: i });
      start = i + 1;
    } else if (c === '}') {
      const offen = stapel.pop();
      if (offen && !offen.kopf.startsWith('@')) {
        out.push({ selektor: offen.kopf, block: css.slice(offen.auf + 1, i), tiefe: stapel.length });
      }
      start = i + 1;
    } else if (c === ';' && !stapel.length) {
      start = i + 1; // @import, @charset
    }
  }
  return out;
}

// Stilblätter: alles unter assets/ und die <style>-Blöcke der Komponenten und Seiten.
function stilblaetter() {
  const liste = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'assets'))) {
    if (f.endsWith('.css')) liste.push([`assets/${f}`, read(`assets/${f}`)]);
  }
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.astro')) {
        const src = read(rel);
        const bloecke = [...src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
        if (bloecke) liste.push([rel, bloecke]);
      }
    }
  };
  walk('src');
  return liste;
}

// Ausnahmen: ein Element mit hidden-Attribut, das bewusst gezeichnet wird.
// Jede nennt ihren Anlass; verschwindet die Regel, reißt der Test
// (Zombie-Wächter), und die Zeile muss raus.
const AUSNAHMEN = [
  {
    datei: 'assets/account-dossier.css',
    selektor: '.dsr .pfx-sec[hidden]',
    anlass: 'Profil-Editor ab 900 px: alle Reiter liegen in derselben Rasterzelle, die verdeckten unsichtbar statt ausgehängt, damit beim Umschalten nichts springt',
  },
];

test('theme.css lässt [hidden] gewinnen: ungeschachtelt, display:none mit !important, until-found ausgenommen', () => {
  const r = regeln(ohneKommentare(read('assets/theme.css'))).filter((x) => /\[hidden\]/.test(x.selektor.replace(/:not\([^)]*\)/g, '')));
  const treffer = r.filter((x) => x.tiefe === 0 && /display\s*:\s*none\s*!important/.test(x.block));
  assert.equal(treffer.length, 1, `erwartet genau eine Regel [hidden]{display:none !important} auf oberster Ebene, gefunden: ${JSON.stringify(r)}`);
  assert.match(treffer[0].selektor, /:not\(\[hidden=['"]?until-found['"]?\]\)/, 'hidden="until-found" blendet der Browser selbst aus und muss für die Textsuche auffindbar bleiben');
});

test('jede Seite lädt theme.css', () => {
  assert.match(read('src/layouts/Layout.astro'), /<link\s+href=\{versioned\('assets\/theme\.css'/);
});

test('kein Stilblatt zeichnet ein [hidden]-Element mit eigenem !important, außer den benannten Ausnahmen', (t) => {
  const funde = [];
  let gelesen = 0;
  for (const [datei, css] of stilblaetter()) {
    for (const { selektor, block } of regeln(ohneKommentare(css))) {
      gelesen++;
      const m = block.match(/display\s*:\s*([a-z-]+)\s*!important/);
      if (!m || m[1] === 'none') continue;
      for (const teil of selektor.split(',').map((s) => s.trim())) {
        if (/\[hidden\]/.test(teil.replace(/:not\([^)]*\)/g, ''))) funde.push({ datei, selektor: teil });
      }
    }
  }
  t.diagnostic(`${gelesen} Regeln gelesen, ${funde.length} zeichnen ein [hidden]-Element mit !important`);
  assert.ok(gelesen > 5000, `nur ${gelesen} Regeln gelesen — liest der Test die Stilblätter noch?`);
  const offen = funde.filter((f) => !AUSNAHMEN.some((a) => a.datei === f.datei && a.selektor === f.selektor));
  assert.deepEqual(offen, [], 'ein Element mit hidden-Attribut bleibt dort sichtbar: als Ausnahme mit Anlass eintragen oder die Regel lassen');
  for (const a of AUSNAHMEN) {
    assert.ok(funde.some((f) => f.datei === a.datei && f.selektor === a.selektor), `Ausnahme ohne Anlass (Zombie): ${a.datei} ${a.selektor} — Zeile entfernen`);
  }
});
