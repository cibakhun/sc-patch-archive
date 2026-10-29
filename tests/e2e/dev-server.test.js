// Haelt zwei Einstellungen des Dev-Servers fest (astro.config.mjs):
//
// 1. Der Riegel vor `/__open-in-editor`. Vites Dev-Server bietet den
//    Endpunkt ohne Anmeldung an; er startet auf dem Rechner einen
//    Editor-Prozess. Der Riegel ist ein kleines Plugin in der Konfiguration —
//    genau die Art Zeile, die bei einem Umbau (Astro-7-Migration, neue
//    Vite-Optionen) leise verloren geht, ohne dass ein Build oder eine Seite
//    davon etwas merkt.
// 2. Tunnel-Hosts nur fuer `astro preview` und nur mit VB_TUNNEL. Ohne die
//    Variable bleibt `allowedHosts` leer (Vite-Standard: localhost und
//    IP-Adressen); `astro dev` bekommt die Tunnel-Hosts nie.
// 3. `astro dev` weist Anfragen mit Weiterleitungs-Kopfzeilen ab (Tunnel,
//    der den Host-Header auf localhost umschreibt).
//
// Geprueft wird die echte Konfiguration, nicht eine Abschrift: der Test
// importiert astro.config.mjs und ruft das Plugin mit einem Attrappen-Server
// auf. Dass Vite die Middleware tatsaechlich VOR der eigenen einhaengt, zeigt
// ein Lauf von `astro dev` (curl auf /__open-in-editor -> 403); der braucht
// einen Port und gehoert nicht in diese Suite.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CONFIG = pathToFileURL(path.resolve('astro.config.mjs')).href;

/** Konfiguration frisch auswerten, mit gesetztem oder fehlendem VB_TUNNEL. */
async function loadConfig(tunnel) {
  const before = process.env.VB_TUNNEL;
  if (tunnel === undefined) delete process.env.VB_TUNNEL;
  else process.env.VB_TUNNEL = tunnel;
  try {
    return await import(`${CONFIG}?vb_tunnel=${encodeURIComponent(String(tunnel))}`);
  } finally {
    if (before === undefined) delete process.env.VB_TUNNEL;
    else process.env.VB_TUNNEL = before;
  }
}

/** Middleware des Riegels aus dem Plugin holen (configureServer mit Attrappe). */
function middlewareOf(plugin) {
  const used = [];
  plugin.configureServer({ middlewares: { use: (...args) => used.push(args) } });
  assert.strictEqual(used.length, 1, 'configureServer haengt genau eine Middleware ein');
  assert.strictEqual(used[0].length, 1, 'Middleware ohne Pfad-Praefix (sieht jede Anfrage)');
  return used[0][0];
}

/** Eine Anfrage durch die Middleware schicken. */
function run(mw, url, headers = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b ?? ''; },
  };
  let passed = false;
  mw({ url, headers }, res, () => { passed = true; });
  return { passed, res };
}

const GESPERRT = [
  '/__open-in-editor',
  '/__open-in-editor?file=x',
  '/__open-in-editor/x',
  '/__OPEN-IN-EDITOR?file=x',
  '/%5F%5Fopen-in-editor?file=x',
  'http://127.0.0.1:4321/__open-in-editor?file=x',
  'http://127.0.0.1:4321\\__open-in-editor?file=x',
];
const FREI = ['/', '/robots.txt', '/de/', '/@vite/client', '/src/pages/index.astro?x=/__open-in-editor', '/open-in-editor'];

describe('Dev-Server: Riegel vor /__open-in-editor', async () => {
  const mod = await loadConfig(undefined);
  const plugins = mod.default.vite?.plugins ?? [];
  const plugin = plugins.find((p) => p && p.name === 'vb-block-open-in-editor');

  test('1. Plugin steht in vite.plugins und gilt fuer den Dev-Server', () => {
    assert.ok(plugin, 'vb-block-open-in-editor fehlt in astro.config.mjs vite.plugins');
    assert.strictEqual(plugin.apply, 'serve');
  });

  test(`2. ${GESPERRT.length} Anfrageformen an den Endpunkt bekommen 403`, () => {
    const mw = middlewareOf(plugin);
    for (const url of GESPERRT) {
      const { passed, res } = run(mw, url);
      assert.strictEqual(passed, false, `${url} wurde an Vite durchgereicht`);
      assert.strictEqual(res.statusCode, 403, `${url}: Status ${res.statusCode}`);
      assert.notStrictEqual(res.body, null, `${url}: Antwort nicht beendet`);
    }
  });

  test(`3. ${FREI.length} normale Anfragen laufen unberuehrt weiter`, () => {
    const mw = middlewareOf(plugin);
    for (const url of FREI) {
      const { passed, res } = run(mw, url);
      assert.strictEqual(passed, true, `${url} wurde abgefangen`);
      assert.strictEqual(res.body, null, `${url}: Antwort wurde geschrieben`);
    }
  });
});

/** allowedHosts so, wie Astro sie fuer den Befehl aufloest (server darf Objekt oder Funktion sein). */
function hostsFor(cfg, command) {
  const server = typeof cfg.server === 'function' ? cfg.server({ command }) : cfg.server;
  return server?.allowedHosts;
}

describe('Dev-Server: Tunnel-Hosts nur fuer astro preview mit VB_TUNNEL', () => {
  test('4. ohne VB_TUNNEL ist allowedHosts fuer dev und preview leer', async () => {
    const { default: cfg } = await loadConfig(undefined);
    assert.deepStrictEqual(hostsFor(cfg, 'dev'), [], 'astro dev');
    assert.deepStrictEqual(hostsFor(cfg, 'preview'), [], 'astro preview');
  });

  test('5. VB_TUNNEL=0 schaltet nichts frei', async () => {
    const { default: cfg } = await loadConfig('0');
    assert.deepStrictEqual(hostsFor(cfg, 'dev'), [], 'astro dev');
    assert.deepStrictEqual(hostsFor(cfg, 'preview'), [], 'astro preview');
  });

  test('6. VB_TUNNEL=1 laesst fuer astro preview genau die Tunnel-Hosts zu, nie alle', async () => {
    const mod = await loadConfig('1');
    assert.ok(mod.TUNNEL_HOSTS.length > 0);
    assert.deepStrictEqual(hostsFor(mod.default, 'preview'), mod.TUNNEL_HOSTS);
    assert.notStrictEqual(hostsFor(mod.default, 'preview'), true);
  });

  test('7. VB_TUNNEL=1 gibt astro dev keine Tunnel-Hosts', async () => {
    const { default: cfg } = await loadConfig('1');
    assert.deepStrictEqual(hostsFor(cfg, 'dev'), [], 'astro dev haengt mit VB_TUNNEL=1 am Tunnel');
  });
});

// Kopfzeilen, wie Node sie liefert (Namen klein). Bewusst hier ausgeschrieben
// und nicht aus PROXY_HEADERS gelesen: eine geleerte Liste soll rot werden,
// nicht still mitziehen.
const VIA_TUNNEL = [
  { 'cf-connecting-ip': '203.0.113.7' },
  { 'cf-ray': '8f00000000000000-FRA' },
  { 'x-forwarded-for': '203.0.113.7' },
  { 'x-forwarded-host': 'abc.trycloudflare.com' },
  { forwarded: 'for=203.0.113.7;proto=https' },
  { 'x-real-ip': '203.0.113.7' },
];
const LOKAL = [
  {},
  { host: 'localhost:4321', 'user-agent': 'Mozilla/5.0', accept: 'text/html' },
  { host: '127.0.0.1:4321', origin: 'http://localhost:4321', referer: 'http://localhost:4321/de/' },
  { host: 'localhost:4321', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', connection: 'keep-alive' },
];

describe('Dev-Server: nur lokal, keine Anfragen ueber Tunnel oder Proxy', async () => {
  const mod = await loadConfig(undefined);
  const plugin = (mod.default.vite?.plugins ?? []).find((p) => p && p.name === 'vb-dev-local-only');

  test('8. Plugin vb-dev-local-only steht in vite.plugins und gilt fuer den Dev-Server', () => {
    assert.ok(plugin, 'vb-dev-local-only fehlt in astro.config.mjs vite.plugins');
    assert.strictEqual(plugin.apply, 'serve');
  });

  test(`9. ${VIA_TUNNEL.length} Weiterleitungs-Kopfzeilen bekommen 403`, () => {
    const mw = middlewareOf(plugin);
    for (const headers of VIA_TUNNEL) {
      const { passed, res } = run(mw, '/', { host: 'localhost:4321', ...headers });
      const name = Object.keys(headers)[0];
      assert.strictEqual(passed, false, `${name}: an Vite durchgereicht`);
      assert.strictEqual(res.statusCode, 403, `${name}: Status ${res.statusCode}`);
      assert.match(String(res.body), /nur lokal[\s\S]*npm run preview/, `${name}: Antwort ohne deutschen Hinweis auf npm run preview`);
      assert.match(String(res.body), /local only[\s\S]*npm run preview/, `${name}: Antwort ohne englischen Hinweis auf npm run preview`);
    }
  });

  test(`10. ${LOKAL.length} lokale Anfragen laufen unberuehrt weiter`, () => {
    const mw = middlewareOf(plugin);
    for (const headers of LOKAL) {
      const { passed, res } = run(mw, '/', headers);
      assert.strictEqual(passed, true, `${JSON.stringify(headers)} wurde abgefangen`);
      assert.strictEqual(res.body, null, `${JSON.stringify(headers)}: Antwort wurde geschrieben`);
    }
  });
});
