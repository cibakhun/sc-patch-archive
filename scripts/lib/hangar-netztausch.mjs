// Vertauschte Netze im Rohexport (.planning/notes/hangar-huellkopie.md,
// Ursache 2).
//
// Anlass: Krisz, 10.11.2026, Ursa Medivac: „madivac ist komplett broken“.
// Neben der zweiten Hülle fehlten zwei der sechs Reifen, und an ihrer
// Stelle saß ein unterer Querlenker. Ursache: Wird dieselbe .cga mehrfach
// gesetzt (sechs Radaufhängungen), zählt der Export die Netze des nächsten
// Exemplars um eins zu früh. Dessen erstes Netz überschreibt das letzte des
// vorigen. Im Ursa trägt der Knoten tyre von wheel4 das Netz 106. Es heißt
// bottom_arm und ist der Querlenker von wheel5. Der Reifen von wheel4 steht
// nirgends mehr in der Datei.
//
// Erkennen: Ein Netz, das zwei verschieden benannte Knoten benutzen und das
// den Namen des einen trägt, gehört dem anderen nicht. Der Export nennt jedes
// Netz nach seinem Knoten (Teile eines Containers nach ihrer Datei, die dann
// kein Knoten trägt). Stand 4.10.2, alle 231 Rohexporte: 217 Schiffe,
// 4 892 Knoten.
//
// Reparieren: Ein heiles Geschwister-Exemplar derselben Datei trägt das
// richtige Netz, beim Ursa wheel6 für wheel4 (beide wheelRR_medivac). Gesucht
// wird ein Knoten gleichen Namens, dessen Netz seinen Namen trägt, mit der
// längsten gleichen Ahnenkette, mindestens dem gleichen Elternknoten. Er gibt
// eine Kopie seines Netzes ab. Dass ein verschobener Nachbar dasselbe Netz
// mitbenutzt, schließt ihn nicht aus: Das Netz gehört trotzdem ihm. Beispiel
// Gladius: Die Rakete im ersten Werfer trägt den Werferkörper des zweiten,
// die Rakete im zweiten Werfer ihr eigenes Netz, das dort auch bone1b
// mitbenutzt. Mit dem strengeren Maßstab (kein Mitbenutzer) blieben über alle
// Rohexporte 1 354 Knoten ohne Ersatz, darunter 284 Raketen auf 61 Schiffen.
// So sind es 735, davon 26 Raketen (Stand 4.10.2, 11.11.2026).
// Fehlt ein solcher Knoten, verliert das Opfer sein falsches Netz: Ein
// fremdes Teil an falscher Stelle ist immer falsch, ein fehlendes Kleinteil
// fällt meist nicht auf.

const nameOf = (x) => x?.getName() ?? '';
const nodeUsers = (mesh) => mesh.listParents().filter((p) => p.propertyType === 'Node');

// Knoten, deren Netz einem anders benannten Knoten gehört: [{ node, mesh, fix, score }]
export function findSwapped(doc) {
  const nodes = doc.getRoot().listNodes();
  const byName = new Map();
  for (const n of nodes) { const k = nameOf(n); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(n); }
  const healthy = (n) => { const m = n.getMesh(); return !!m && nameOf(m) === nameOf(n); };
  const hits = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    const users = nodeUsers(mesh);
    if (users.length < 2 || !users.some((u) => nameOf(u) === nameOf(mesh))) continue;
    for (const node of users) {
      if (nameOf(node) === nameOf(mesh)) continue;
      let fix = null, score = 0;
      for (const c of byName.get(nameOf(node)) ?? []) {
        if (c === node || !healthy(c)) continue;
        let k = 0, x = node.getParentNode(), y = c.getParentNode();
        while (x && y && nameOf(x) === nameOf(y)) { k++; x = x.getParentNode(); y = y.getParentNode(); }
        if (k > score) { score = k; fix = c; }
      }
      hits.push({ node, mesh, fix, score });
    }
  }
  return hits;
}

const triCount = (mesh) => mesh.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3, 0);

// eigene Kopie des Netzes: Primitive und Accessoren geklont, Materialien geteilt
function cloneMesh(doc, mesh, name) {
  const out = doc.createMesh(name);
  for (const p of mesh.listPrimitives()) {
    const q = p.clone();
    for (const sem of q.listSemantics()) q.setAttribute(sem, p.getAttribute(sem).clone());
    if (p.getIndices()) q.setIndices(p.getIndices().clone());
    out.addPrimitive(q);
  }
  return out;
}

// Ersetzen, wo ein Geschwister-Exemplar das Netz trägt, sonst das falsche
// Netz abnehmen. Liefert Zahlen für Manifest und Protokoll.
export function repairSwapped(doc) {
  const hits = findSwapped(doc);
  // abgenommen: die Knoten ohne Ersatz, für markSwapParts (leerer Anker)
  const out = { nodes: hits.length, fixed: 0, dropped: 0, trisWrong: 0, names: {}, abgenommen: new Set() };
  for (const h of hits) {
    out.trisWrong += triCount(h.mesh);
    if (h.fix) { h.node.setMesh(cloneMesh(doc, h.fix.getMesh(), nameOf(h.node))); out.fixed++; }
    else { h.node.setMesh(null); out.abgenommen.add(h.node); out.dropped++; }
    out.names[nameOf(h.node)] = (out.names[nameOf(h.node)] ?? 0) + 1;
  }
  out.trisWrong = Math.round(out.trisWrong);
  return out;
}
