// Dreht eine Halle um die Hochachse (glTF y), bevor der Build sie liest:
// die eine Wurzel des Exports bekommt die Drehung von links. Jeder Schritt
// danach, der mit Weltmatrizen rechnet (Aufzug, Lampen, Einrichtung) oder im
// Raum eines Netzes (Aufkleber, Schrift), sieht die Halle gedreht. Wofür
// (Small: Landefläche quer zur Schiffsachse des Viewers) steht an HALL_DREH
// in scripts/build-hangar-assets.mjs.

// Drehung um y als Spaltenmatrix (glTF): +90° bringt +x nach -z.
export function drehY(grad) {
  const w = (grad * Math.PI) / 180, c = Math.round(Math.cos(w) * 1e12) / 1e12 + 0, s = Math.round(Math.sin(w) * 1e12) / 1e12 + 0;
  return [c, 0, -s + 0, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

const mal = (a, b) => { const m = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return m; };

// grad 0 oder ohne Angabe: nichts. Liefert grad. Eine Halle mit mehr als
// einer Wurzel bricht ab: Die Drehung träfe sonst nur einen Teil.
export function hallDrehen(doc, grad = 0) {
  if (!Number.isFinite(grad)) throw new Error(`Drehung der Halle: ${grad} ist keine Zahl`);
  if (grad === 0) return 0;
  const oben = doc.getRoot().listScenes().flatMap((sc) => sc.listChildren());
  if (oben.length !== 1) throw new Error(`Drehung der Halle: erwartet ist eine Wurzel, gefunden ${oben.length}`);
  oben[0].setMatrix(mal(drehY(grad), oben[0].getMatrix()));
  return grad;
}
