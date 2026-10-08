// tests/e2e/helpers/web-locks.js — Web Locks für die Browser-Attrappen
// (fleet-dom.js, crafting-dom.js): eine Warteschlange je Name, über alle Tabs.
// Einem geschlossenen Tab teilt der Browser keine Sperre mehr zu, auch keine,
// die er beim Verlassen noch anfragt: die Zuteilung kommt als spätere Aufgabe,
// und die läuft nach pagehide nicht mehr (gemessen, assets/crafting-app.js).
export function makeLocks() {
  const queues = new Map();
  const held = new Map();
  function pump(name) {
    if (held.has(name)) return;
    const next = (queues.get(name) || []).shift();
    if (!next) return;
    held.set(name, next);
    Promise.resolve()
      .then(() => next.cb({ name, mode: 'exclusive' }))
      .then((v) => { release(name, next); next.resolve(v); }, (e) => { release(name, next); next.reject(e); });
  }
  function release(name, entry) {
    if (held.get(name) !== entry) return;
    held.delete(name);
    pump(name);
  }
  return {
    forTab: (tab) => ({
      request: (name, cb) => new Promise((resolve, reject) => {
        if (tab.closed) return;
        if (!queues.has(name)) queues.set(name, []);
        queues.get(name).push({ tab, cb, resolve, reject });
        pump(name);
      }),
    }),
    // Ein abgestürzter Tab gibt seine Sperren frei, wie im Browser.
    closeTab(tab) {
      for (const [name, entry] of [...held]) if (entry.tab === tab) { held.delete(name); pump(name); }
      for (const [name, q] of queues) queues.set(name, q.filter((e) => e.tab !== tab));
    },
  };
}
