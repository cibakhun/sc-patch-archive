// Haelt zwei Einstellungen des Dev-Servers fest (astro.config.mjs):
//
// 1. Der Riegel vor `/__open-in-editor`. Vites Dev-Server bietet den
//    Endpunkt ohne Anmeldung an; er startet auf dem Rechner einen
//    Editor-Prozess. Der Riegel ist ein kleines Plugin in der Konfiguration —
//    genau die Art Zeile, die bei einem Umbau (Astro-7-Migration, neue
//    Vite-Optionen) leise verloren geht, ohne dass ein Build oder eine Seite
//    davon etwas merkt.
// 2. Tunnel-Hosts nur mit VB_TUNNEL. Ohne die Variable bleibt `allowedHosts`
//    leer (Vite-Standard: localhost und IP-Adressen).
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
function run(mw, url) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b ?? ''; },
  };
  let passed = false;
  mw({ url, headers: {} }, res, () => { passed = true; });
  return { passed, res };
}

const GESPERRT = [
  '/__open-in-editor',
  '/__open-in-editor?file=x',
  '/__open-in-editor/x',
  '/__OPEN-IN-EDITOR?file=x',
  '/%5F%5Fopen-in-editor?file=x',
  'http://127.0.0.1:4321/__open-in-editor?file=x',
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

describe('Dev-Server: Tunnel-Hosts nur mit VB_TUNNEL', () => {
  test('4. ohne VB_TUNNEL ist allowedHosts leer', async () => {
    const { default: cfg } = await loadConfig(undefined);
    assert.deepStrictEqual(cfg.server?.allowedHosts, []);
  });

  test('5. VB_TUNNEL=0 schaltet nichts frei', async () => {
    const { default: cfg } = await loadConfig('0');
    assert.deepStrictEqual(cfg.server?.allowedHosts, []);
  });

  test('6. VB_TUNNEL=1 laesst genau die Tunnel-Hosts zu, nie alle', async () => {
    const mod = await loadConfig('1');
    assert.ok(mod.TUNNEL_HOSTS.length > 0);
    assert.deepStrictEqual(mod.default.server?.allowedHosts, mod.TUNNEL_HOSTS);
    assert.notStrictEqual(mod.default.server?.allowedHosts, true);
  });
});
