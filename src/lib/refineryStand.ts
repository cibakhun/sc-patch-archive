// Stand der Ausbeute je Raffinerie-Station.
//
// Die Aufschlaege je Station und Erz liegen serverseitig; sie stehen als
// eingefrorene, von Hand gepflegte Konstanten in assets/mining-frozen.json
// (frozen_from) und laufen von dort unveraendert in mining-model.json und
// refinery-data.json. Ein Datenlauf hebt die uebrigen Werte auf den neuen
// Patch, diese nicht. Refinery und Mining-Datenbank nennen deshalb den
// eigenen Stand dieser Werte, statt sie unter dem juengeren Spielstand der
// Seite stehen zu lassen (Bestandsaufnahme C, 06.11.2026).
//
// Nur fuer den Seitenbau (Frontmatter): nicht aus Client-Skripten
// importieren, sonst landet die ganze Datei im Bundle.
import FROZEN from '../../assets/mining-frozen.json';

/** "4.10.1-live.12660092" -> "4.10.1". Ohne lesbare Fassung bricht der Bau. */
export function ausbeuteStand(): string {
  const m = /(\d+\.\d+\.\d+)/.exec((FROZEN as { frozen_from?: string }).frozen_from ?? '');
  if (!m) throw new Error('refineryStand: assets/mining-frozen.json traegt in frozen_from keine Fassung X.Y.Z');
  return m[1];
}
