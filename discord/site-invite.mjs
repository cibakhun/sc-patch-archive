/* ============================================================
   site-invite.mjs — welchen Einladungscode zeigt die WEBSITE?

   Die eine Quelle dafuer ist `DISCORD.invite` in src/consts.ts. Drei Skripte
   muessen ihn kennen und duerfen ihn nicht je fuer sich raten:
     build.mjs          haelt genau diese Einladung am Leben
     verify-invite.mjs  prueft, dass sie lebt und richtig zeigt
     prune-invite.mjs   raeumt andere weg

   Bewusst per Regex statt per Import: consts.ts ist TypeScript, und diese
   Skripte laufen ohne Bauschritt direkt aus discord/.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Der Server, auf den die Website zeigen MUSS. */
export const GUILD_ID = '1528576072638271518';
export const GUILD_NAME = 'Verse-Base';

/**
 * Liest den Einladungscode, den die Website verlinkt.
 * @returns {string|null} der Code, oder null wenn consts.ts ihn nicht hergibt
 */
export function siteInviteCode() {
  try {
    const src = readFileSync(resolve(ROOT, 'src/consts.ts'), 'utf8');
    const m = src.match(/invite:\s*'https:\/\/discord\.gg\/([A-Za-z0-9-]+)'/);
    return m ? m[1] : null;
  } catch {
    // Ein Worktree ohne src/ ist denkbar — dann kein harter Abbruch, die
    // Aufrufer entscheiden selbst, wie wichtig ihnen der Code ist.
    return null;
  }
}
