// Die Fassung zu einer Changelist kennt nur das Launcher-Protokoll auf dem
// Rechner mit dem Spiel; der Seitenbau hat es nicht. Deshalb steht sie als
// `gameVersion` im Manifest.
import { launcherFassung } from './p4k.mjs';

export function standNachtragen(manifest) {
  let neu = 0;
  const offen = new Set();
  for (const teil of Object.values(manifest)) {
    if (!teil || typeof teil !== 'object') continue;
    for (const e of Object.values(teil)) {
      if (!e || typeof e !== 'object' || e.gameVersion || !/^\d+$/.test(String(e.game ?? ''))) continue;
      const f = launcherFassung(String(e.game));
      if (f) { e.gameVersion = `${f}-live.${e.game}`; neu++; } else offen.add(String(e.game));
    }
  }
  return { neu, offen: [...offen] };
}
