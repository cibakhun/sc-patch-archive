// Patch-Rückgrat zur Bauzeit: welche Patch-Seiten ein Fahrzeug nennen.
// Die Regel steht in scripts/lib/patch-spine.mjs (dort auch das WARUM);
// hier wird nur der Dateibestand eingelesen. `import.meta.glob` löst Vite beim
// Build auf — eine neu hinzugefügte Patch-Seite verlinkt so beim nächsten
// Build, ohne Datenlauf.
import { buildPatchSpine } from '../../scripts/lib/patch-spine.mjs';

type PatchFile = { version: string; ships?: { name: string }[] };

const files = import.meta.glob<PatchFile>('../data/patches/*.json', { eager: true, import: 'default' });

/** Versionen der Patch-Seiten, die dieses Fahrzeug nennen — älteste zuerst. */
export const patchesFor: (vehicleName: string) => string[] = buildPatchSpine(Object.values(files));
