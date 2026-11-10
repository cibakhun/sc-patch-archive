// Hüllkopien in den Innenraum-Containern (.planning/notes/hangar-huellkopie.md).
//
// Anlass: Krisz, 10.11.2026, Screenshot des Ursa Medivac: „madivac ist
// komplett broken“. Rote Hülle und eine braune zweite Hülle übereinander,
// die zweite 1,5 m nach vorn und 0,6 m zur Seite versetzt, ein Rad schien
// zu schweben. Ursache: Der Container medivac_int setzt unter seinen 25
// Teilen auch RSI_Ursa_Rover.cga, die Rumpfdatei des Fahrzeugs selbst.
// StarBreaker legt dafür die ganze Rumpfdatei in den Container, und mit dem
// Versatz des Containers (placeContainers) steht sie als zweite Karosserie
// neben der echten; ihre Farbe ist die Palette des Containers
// (rsi_ursa_default, braun). Im Spiel gibt es diese zweite Hülle nicht.
//
// Dieselbe Art Platzierung tragen die Rohexporte von neun Schiffen (Stand
// 4.10.2, Suche über alle 231): Ursa Medivac, Argo SRV (6), Crusader
// Intrepid, Drake Corsair, Guardian, Guardian QI, Guardian MX (die Hülle
// des Guardian), Aurora Mk II (5), Zeus CL (2). Sichtbar war bisher nur der
// Medivac: Bei den anderen fällt der Innenraum im Rumpf weg (dropInterior),
// und die begehbare Innenraum-Datei wirft Teile außerhalb der Hülle ab
// (keepInteriorOnly). Verloren geht mit der Kopie nichts: Gehört die Datei
// dem Schiff selbst, trägt der Rumpf jedes ihrer Teile schon an der
// richtigen Stelle; eine fremde Fahrzeughülle gehört nicht in einen Innenraum.

// Pfad einer Geometriedatei vergleichbar machen: Schrägstriche, Kleinschrift,
// ohne führendes Data/ (scene.json: Data/Objects/…, Rohexport: objects\…)
export const cgaKey = (p) => String(p ?? '').replace(/\\/g, '/').toLowerCase().replace(/^\/+/, '').replace(/^data\//, '');

// Rumpfdateien aller Fahrzeuge der zerlegten Exporte (ships-dec/Packages/*/
// scene.json, root_entity.geometry_path), damit auch die Hülle eines
// Schwesterschiffs auffällt (Guardian MX setzt die des Guardian)
export function bodyFiles(index, readScene) {
  const out = new Set();
  for (const e of Object.values(index ?? {})) {
    const pkg = e?.package ?? (e?.record ? `${e.record.replace(/_/g, ' ')}_LOD1_TEX1` : null);
    const scene = pkg ? readScene(pkg) : null;
    const g = scene?.root_entity?.geometry_path;
    if (g) out.add(cgaKey(g));
  }
  return out;
}

// Knoten unter interior_*-Containern, deren Netz eine Fahrzeug-Rumpfdatei
// ist: die eigene (extras.geometry_path an der Schiffswurzel) oder eine aus
// bodies. Der Rohexport nennt jedes Netz nach seiner Datei.
export function findBodyCopies(doc, bodies = new Set()) {
  const hits = [];
  for (const scene of doc.getRoot().listScenes()) for (const top of scene.listChildren()) {
    const own = new Set([top, ...top.listChildren()].map((c) => c.getExtras()?.geometry_path).filter(Boolean).map(cgaKey));
    for (const c of top.listChildren()) {
      if (!/^interior_/i.test(c.getName())) continue;
      c.traverse((n) => {
        const k = n.getMesh() ? cgaKey(n.getMesh().getName()) : '';
        if (k.endsWith('.cga') && (own.has(k) || bodies.has(k))) hits.push({ node: n, container: c.getName(), file: k, own: own.has(k) });
      });
    }
  }
  return hits;
}
