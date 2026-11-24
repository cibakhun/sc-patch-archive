// waffen-art.mjs — Waffenart einer Handwaffe aus ihrem Namen (UX-Audit P64, 24.11.2026).
//
// „Ähnliche Items“ auf dem Datenblatt der Karna zeigte sieben Devastator-
// Schrotflinten, eine Ravager-Schrotflinte, ein Scharfschützengewehr und zwei
// Pistolen, aber kein einziges anderes Gewehr: Die Rangfolge wog den
// Hersteller (Kastak Arms) höher als die Art. Der Katalog führt für Handwaffen
// keine Art — Kategorie „Weapons“, gameType WeaponPersonal, subType nur
// Small/Medium/Large —, der Name trägt sie aber am Ende („Karna Rifle“,
// „Arrowhead Sniper Rifle“, „Devastator Shotgun“, „F55 LMG“).
//
// Gelesen wird der Name OHNE Ausführung (Anführungszeichen, Klammern), damit
// eine Lackierung nichts verschiebt, und nur bei gameType WeaponPersonal:
// Zubehör wie „Gallant Rifle Red Dot Sight“ oder „Pistol Ammo Box“ trägt
// Waffenwörter im Namen und ist trotzdem keine Waffe.
//
// Eine Quelle für zwei Stellen: relatedItems() in src/lib/items.ts ordnet
// damit, verify:bezugswege [14] prüft das gebaute Blatt dagegen.
// Keine Abhängigkeiten, kein Netz.

/** Reihenfolge zählt: „Sniper Rifle“ ist ein Scharfschützengewehr, kein Gewehr. */
const ARTEN = [
  // Spielzeug („WowBlast Desperado Toy Pistol Red“) steht bei Spielzeug, nicht bei den Pistolen.
  [/\btoy\b/i, 'toy'],
  [/\bsniper\b/i, 'sniper'],
  [/\b(?:grenade|rocket|missile) launcher\b/i, 'launcher'],
  [/\brailgun\b/i, 'railgun'],
  [/\b[lh]mg\b/i, 'mg'],
  [/\bsmg\b/i, 'smg'],
  [/\bshotgun\b/i, 'shotgun'],
  [/\bcrossbow\b/i, 'crossbow'],
  [/\brifle\b/i, 'rifle'],
  [/\bpistol\b/i, 'pistol'],
  [/\bmedical device\b/i, 'medgun'],
];

/**
 * Modell ohne Ausführung: „Karna "Alpine Sunset" Rifle“ und „Coda Pistol
 * (Modified)“ werden zu „Karna Rifle“ und „Coda Pistol“.
 * @param {string} name
 * @returns {string}
 */
export function modellName(name) {
  return String(name)
    .replace(/["“”„][^"“”„]*["“”„]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Art einer Handwaffe ('rifle', 'sniper', 'shotgun' …) oder null, wenn das
 * Item keine Handwaffe ist oder ihr Name keine bekannte Art trägt.
 * @param {{ name: string, game?: { gameType?: string } | null }} item
 * @returns {string | null}
 */
export function waffenArt(item) {
  if (item?.game?.gameType !== 'WeaponPersonal') return null;
  const modell = modellName(item.name);
  for (const [muster, art] of ARTEN) if (muster.test(modell)) return art;
  return null;
}

/** Höchstens so viele Ausführungen eines Modells stehen unter „Ähnliche Items“. */
export const AUSFUEHRUNGEN_JE_MODELL = 3;
