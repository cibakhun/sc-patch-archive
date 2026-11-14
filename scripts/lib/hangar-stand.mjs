// Spielstand der Hangar-Modelle in der Form, die die Seite liest.
//
// build-hangar-assets schreibt je Modell die Changelist seines Rohexports als
// `game` (Stempel von extract-hangar-sources). Die Fassung dazu kennt nur das
// Launcher-Protokoll auf dem Rechner mit dem Spiel; der Seitenbau hat es
// nicht. Deshalb steht sie als `gameVersion` ("4.10.2-live.12913470") im
// Manifest. Ein Modell ohne `gameVersion` gilt auf der Seite als „Stand nicht
// belegt".
import { launcherFassung } from './p4k.mjs';

/** Traegt `gameVersion` nach, wo `game` (Changelist) steht und sie fehlt. */
export function standNachtragen(manifest) {
  let neu = 0;
  const offen = new Set();
  for (const teil of Object.values(manifest)) {
    if (!teil || typeof teil !== 'object') continue;
    for (const e of Object.values(teil)) {
      // gear.game und Decals tragen unter `game` Objekte, keine Changelist
      if (!e || typeof e !== 'object' || e.gameVersion || !/^\d+$/.test(String(e.game ?? ''))) continue;
      const f = launcherFassung(String(e.game));
      if (f) { e.gameVersion = `${f}-live.${e.game}`; neu++; } else offen.add(String(e.game));
    }
  }
  return { neu, offen: [...offen] };
}
