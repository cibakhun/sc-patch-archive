/* Der Abschlusslauf als EIN Node-Prozess.

   ⚠⚠ Die Bash-Fassung (lauf-abschluss.sh) ist am 31.08.2026 zweimal
   gestorben — nicht an einem Messfehler, sondern an der Fork-Erschoepfung
   der Git-Bash unter Windows:
       cygheap read copy failed … fork: Resource temporarily unavailable
   Nach einer langen Sitzung mit vielen Kindprozessen kann die Shell keine
   neuen mehr starten. Ein Node-Prozess, der seine Sonden per spawn
   nacheinander aufruft, umgeht das.

   node .planning/sketches/tools/lauf-abschluss.mjs                       */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';

const ZIEL = '.planning/sketches/tools/out/abschluss.txt';
const aus = createWriteStream(ZIEL, { flags: 'w' });

const SCHRITTE = [
  { titel: '1. Ueberschrift unter der Kante (784 Seiten x 4 Aufloesungen)',
    skript: 'probe-h1-sichtbar.mjs',
    env: { PAGES_FILE: 'pages-massiv.json', VP_LIST: '844x390,932x430,320x568,390x844', PORT_NR: '4331' } },
  { titel: '2. Wortbruch in Ueberschriften (784 x 3)',
    skript: 'mess-wortbruch.mjs',
    env: { PAGES_FILE: 'pages-massiv.json', VP_LIST: '320x568,360x640,390x844', PORT_NR: '4332' } },
  { titel: '3. Abgeschnittene Auswahlfelder (784 x 3)',
    skript: 'probe-abgeschnittenes-feld.mjs',
    env: { PAGES_FILE: 'pages-massiv.json', VP_LIST: '320x568,390x844,844x390', PORT_NR: '4333' } },
  { titel: '4. Ellipsen, die wirklich greifen (784 x 2)',
    skript: 'mess-ellipse.mjs',
    env: { PAGES_FILE: 'pages-massiv.json', VP_LIST: '320x568,360x640', PORT_NR: '4334' } },
  { titel: '5. Still gekappter Inhalt (784 x 2)',
    skript: 'probe-still-gekappt.mjs',
    env: { PAGES_FILE: 'pages-massiv.json', VP_LIST: '320x568,390x844', PORT_NR: '4335' } },
  { titel: '6. Tabfallen (Stichprobe)',
    skript: 'mess-tabfalle.mjs',
    env: { VP_LIST: '320x568,390x844', PORT_NR: '4336' },
    args: ['/missionen.html', '/schiffe.html', '/crafting.html', '/topics/crafting.html',
           '/topics/mining.html', '/items.html', '/archiv.html', '/index.html',
           '/de/missionen.html', '/de.html', '/armor-sets.html', '/evolution.html'] },
];

const schreib = (s) => new Promise((r) => (aus.write(s) ? r() : aus.once('drain', r)));

for (const s of SCHRITTE) {
  await schreib(`\n### ${s.titel}\n`);
  process.stderr.write(`>>> ${s.titel}\n`);
  const zeilen = [];
  const code = await new Promise((fertig) => {
    const k = spawn(process.execPath, ['.planning/sketches/tools/' + s.skript, ...(s.args || [])],
      { env: { ...process.env, ...s.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let puffer = '';
    k.stdout.on('data', (d) => {
      puffer += d;
      const teile = puffer.split('\n');
      puffer = teile.pop();
      for (const z of teile) zeilen.push(z);
    });
    /* stderr ist nur Fortschritt — aber ein Absturz steht auch dort und
       darf nicht verschwiegen werden. */
    let fehlerText = '';
    k.stderr.on('data', (d) => { fehlerText += d; });
    k.on('close', (c) => {
      if (puffer) zeilen.push(puffer);
      if (c !== 0) zeilen.push('  ⚠ ABGEBROCHEN mit Rueckgabewert ' + c + ':\n' + fehlerText.slice(-900));
      fertig(c);
    });
    k.on('error', (e) => { zeilen.push('  ⚠ START FEHLGESCHLAGEN: ' + e.message); fertig(-1); });
  });
  /* Nur den Schluss jedes Berichts — die Sonden fassen selbst zusammen. */
  await schreib(zeilen.slice(-30).join('\n') + '\n');
  process.stderr.write(`<<< fertig (${code})\n`);
}
await schreib('\n=== ABSCHLUSSLAUF BEENDET ===\n');
aus.end();
