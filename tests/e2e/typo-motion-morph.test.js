// Regressionstor fuer die scroll-verknuepfte Wortmarken-Wandlung aus Phase 1
// (MARK-03/MARK-06), nachdem Phase 2 Plan 01 Kopfleiste und Startseite auf die
// neue Schrift-/Bewegungsskala umgestellt hat (02-02-PLAN.md Task 1).
//
// Begruendungskette (steht hier, nicht nur im Plan, weil sie sonst beim
// naechsten Lesen wie eine willkuerliche Zusicherung wirkt):
//
//   measureMorph() in src/components/SiteNav.astro (Zeile ~1810) berechnet
//   die Wandlung zur LAUFZEIT aus zwei gemessenen Werten:
//     fa = getComputedStyle(.hero__mark h1).fontSize
//     fb = getComputedStyle(.snav__brand span).fontSize   (Laufweite: --dx
//          haengt an der gerenderten BREITE der Wortmarke, die wiederum aus
//          font-size + letter-spacing von .snav__brand folgt)
//     --s (Massstab)  = fb / fa
//     --dx (Wegstrecke) = gerenderte Breite der Wortmarke, letter-spacing-abhaengig
//
//   Der Code selbst rechnet immer korrekt neu (er ist NICHT das Risiko) --
//   das Risiko ist, dass jemand einen der beiden EINGANGSWERTE verschiebt und
//   die Wandlung dadurch FUNKTIONAL korrekt bleibt, aber ihre Choreografie
//   (wann beginnt die Ueberlappung, wie schnell schrumpft der Text) driftet.
//   Die 55%/75%-Fortschrittsmarken aus 01-SUMMARY.md sind an das ALTE
//   Verhaeltnis 1rem (Wortmarke) zu clamp(2.9rem,12vw,8.5rem) (Hero) angepasst.
//
//   Dieser Test pinnt deshalb NICHT das Verhalten von measureMorph() (das ist
//   Code, kein Wert), sondern die zwei Werte, aus denen es rechnet:
//     1. den Schriftgrad-Token, aus dem .snav__brand liest (--fs-10 = 1rem)
//     2. den Laufweiten-Token, aus dem .snav__brand liest (--ls-15 = 0.18em)
//     3. dass .hero__mark h1 UNVERAENDERT seine woertliche clamp()-Formel +
//        letter-spacing traegt (keine Skalen-Migration -- benannte Ausnahme,
//        02-RESEARCH.md Open Question 2 / 01-SUMMARY.md)
//     4. dass .snav__brand seinen Wert wirklich UEBER die Tokens bezieht
//        (var(--fs-10)/var(--ls-15)) -- sonst waere Zusicherung 1+2 nur ein
//        Test auf einen unveraenderten Altzustand, kein Beweis der Migration.
//
//   Er ersetzt NICHT die menschliche Sichtpruefung aus Task 2 (Erfolgs-
//   kriterium 3 ist ein Sichturteil, kein Skript kann "liest sich als ein
//   Bewegungsbild" entscheiden) -- er macht sie nur einmalig noetig statt bei
//   jeder kuenftigen der ~90 verbleibenden Dateien in Pläne 03-06.
//
// Geprueft wird der GEBAUTE Stand (dist/assets/theme.css, dist/_astro/*.css,
// dist/index.html, dist/de.html), nicht die Quelle -- dieselbe Begruendung
// wie bei scripts/verify-typo-motion.mjs: gepruft gehoert, was ausgeliefert
// wird, nicht was im Editor steht.
//
// Negativkontrolle (von Hand ausgefuehrt, siehe 02-02-SUMMARY.md fuer das
// Protokoll): --fs-10 in assets/theme.css testweise auf 0.95rem gesetzt,
// `npm run build` + dieser Test liefen erneut -- Zusicherung 1 und 3 (die
// Migrationsprobe) schlugen fehl wie erwartet, danach zurueckgesetzt. Ein
// Test, der nie rot war, beweist nichts.

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

function walkCss(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) out = out.concat(walkCss(p));
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

let themeCss = '';
let bundledCssFiles = [];
let enHtml = '';
let deHtml = '';

// Randfall (Task 1, Behavior-Punkt 6): fehlt dist/, bricht der Test mit
// klarer Meldung ab statt grün durchzulaufen oder mit einem nackten ENOENT
// zu crashen. `before()` wirft synchron -- node:test markiert dann ALLE
// Tests dieser Datei als fehlgeschlagen mit genau dieser Meldung.
before(() => {
  if (!existsSync(DIST)) {
    throw new Error(
      'typo-motion-morph.test.js: dist/ fehlt. Erst `npm.cmd run build`, dann diesen Test ' +
        'laufen lassen -- er prueft den GEBAUTEN Stand, nicht die Quelle.'
    );
  }
  themeCss = readFileSync(join(DIST, 'assets/theme.css'), 'utf8');
  bundledCssFiles = walkCss(join(DIST, '_astro')).map((p) => readFileSync(p, 'utf8'));
  enHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
  deHtml = readFileSync(join(DIST, 'de.html'), 'utf8');
});

describe('Messeingang 1: Schriftgrad-Token der Wortmarke (--fs-10, geht in --s ein)', () => {
  test('dist/assets/theme.css definiert --fs-10 exakt als 1rem', () => {
    assert.ok(
      themeCss.includes('--fs-10: 1rem'),
      '--fs-10 ist nicht mehr exakt 1rem -- das Verhaeltnis fb/fa (--s) in measureMorph() ' +
        'wuerde damit von den 55%/75%-Fortschrittsmarken aus 01-SUMMARY.md abweichen'
    );
  });
});

describe('Messeingang 2: Laufweiten-Token der Wortmarke (--ls-15, geht in --dx ein)', () => {
  test('dist/assets/theme.css definiert --ls-15 exakt als 0.18em', () => {
    assert.ok(
      themeCss.includes('--ls-15: 0.18em'),
      '--ls-15 ist nicht mehr exakt 0.18em -- die gerenderte Breite von .snav__brand ' +
        '(und damit --dx) wuerde sich verschieben'
    );
  });
});

describe('Migrationsprobe: .snav__brand liest wirklich ueber die Tokens, nicht ueber einen zufaellig passenden Altwert', () => {
  test('.snav__brand{...} im gebauten Buendel traegt font-size:var(--fs-10) UND letter-spacing:var(--ls-15)', () => {
    const hit = bundledCssFiles.some((css) =>
      /\.snav__brand(\[[^\]]*\])?\{[^}]*font-size:var\(--fs-10\)[^}]*letter-spacing:var\(--ls-15\)/.test(css)
    );
    assert.ok(
      hit,
      '.snav__brand referenziert font-size/letter-spacing nicht (mehr) ueber var(--fs-10)/var(--ls-15) ' +
        'in dist/_astro/*.css -- entweder die Migration wurde rueckgaengig gemacht, oder Zusicherung 1+2 ' +
        'pruefen zufaellig nur einen unveraenderten Altzustand statt die echte Kopplung'
    );
  });
});

describe('.hero__mark h1 bleibt die benannte Ausnahme -- keine Skalen-Migration', () => {
  for (const [label, html] of [
    ['EN', () => enHtml],
    ['DE', () => deHtml],
  ]) {
    test(`${label}: traegt weiterhin die woertliche clamp()-Formel, nicht var(...)`, () => {
      const doc = html();
      assert.ok(
        doc.includes('font-size:clamp(2.9rem,12vw,8.5rem)'),
        `${label}: .hero__mark h1 traegt nicht mehr clamp(2.9rem,12vw,8.5rem) woertlich -- ` +
          'wurde die Hero-Ausnahme spaeter doch auf Tokens umgestellt? (02-RESEARCH.md Open Question 2)'
      );
      assert.ok(
        !doc.includes('.hero__mark h1{font-size:var('),
        `${label}: .hero__mark h1 liest font-size jetzt ueber var(...) -- die Hero-Ausnahme wurde ` +
          'aufgehoben, das aendert das fa in measureMorph() und braucht eine neue Sichtpruefung + Messreihe'
      );
    });

    test(`${label}: traegt weiterhin letter-spacing:-.02em woertlich`, () => {
      const doc = html();
      assert.ok(
        doc.includes('font-size:clamp(2.9rem,12vw,8.5rem);letter-spacing:-.02em'),
        `${label}: .hero__mark h1 traegt letter-spacing:-.02em nicht mehr unmittelbar nach der clamp()-Formel`
      );
    });

    test(`${label}: 360px-Regel (MARK-07) bleibt bei font-size:2.5rem stehen`, () => {
      const doc = html();
      assert.ok(
        doc.includes('@media(max-width:360px){.hero__mark h1{font-size:2.5rem}}'),
        `${label}: die 360px-Sonderregel fuer .hero__mark h1 (MARK-07) fehlt oder wurde veraendert`
      );
    });
  }
});
