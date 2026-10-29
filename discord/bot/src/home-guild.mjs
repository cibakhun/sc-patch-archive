// ═══════════════════════════════════════════════════════════════════════════
//  home-guild.mjs — die EINE Gilde, deren Rollen und Mitgliedschaften der Bot
//  nach verse-base.com spiegeln darf, und die Testpilot-Rolle darin.
//
//  Alles, was in die Datenbank der Website schreibt (role-sync.mjs,
//  role-reconcile.mjs, rank-sync.mjs, retention.mjs), fragt vorher hier.
//  Gespiegelt wird ausschliesslich die Heim-Gilde; Ereignisse aus jeder
//  anderen Gilde werden verworfen.
//
//  Heim-Gilde, in dieser Reihenfolge:
//    1. HOME_GUILD_ID   — die ausdrueckliche Angabe
//    2. GUILD_ID        — dieselbe Bedeutung, so hiess sie bisher (.env.example)
//    3. discord/site-invite.mjs — der Server, auf den die Website zeigt
//  Eine gesetzte, aber ungueltige Angabe faellt NICHT auf die naechste Stufe
//  zurueck: dann bleibt der Spiegel aus (fail closed), und der Start sagt es.
//
//  Testpilot-Rolle: TESTER_ROLE_ID, wenn gesetzt. Sonst per Name aus dem
//  Blueprint in der Heim-Gilde gesucht und danach nur noch ueber die ID
//  verglichen — eine Umbenennung bricht den Spiegel nicht. Gibt es den Namen
//  zweimal, bleibt der Spiegel aus, bis TESTER_ROLE_ID gesetzt ist. Die
//  @everyone-Rolle (ID = Server-ID) wird nie angenommen. Verschwindet die
//  festgehaltene Rolle, wird neu gesucht (role-reconcile.mjs).
// ═══════════════════════════════════════════════════════════════════════════
import { GUILD_ID as SITE_GUILD_ID } from '../../site-invite.mjs';

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * @returns {{ id: string|null, source: string, error?: string, warning?: string }}
 * `id: null` heisst: Spiegel aus. `error` erklaert, warum.
 * `warning`: Heim-Gilde gilt, aber GUILD_ID weicht von HOME_GUILD_ID ab.
 */
export function resolveHomeGuild(env = process.env) {
  const home = (env.HOME_GUILD_ID || '').trim();
  const legacy = (env.GUILD_ID || '').trim();
  if (home) {
    if (!SNOWFLAKE.test(home)) return { id: null, source: 'HOME_GUILD_ID', error: `HOME_GUILD_ID ist keine Discord-ID ("${home}")` };
    if (legacy && legacy !== home) {
      return { id: home, source: 'HOME_GUILD_ID', warning: `GUILD_ID (${legacy}) weicht von HOME_GUILD_ID ab — es gilt HOME_GUILD_ID` };
    }
    return { id: home, source: 'HOME_GUILD_ID' };
  }
  if (legacy) {
    if (!SNOWFLAKE.test(legacy)) return { id: null, source: 'GUILD_ID', error: `GUILD_ID ist keine Discord-ID ("${legacy}")` };
    return { id: legacy, source: 'GUILD_ID' };
  }
  if (SNOWFLAKE.test(SITE_GUILD_ID || '')) return { id: SITE_GUILD_ID, source: 'discord/site-invite.mjs' };
  return { id: null, source: 'keine', error: 'weder HOME_GUILD_ID noch GUILD_ID gesetzt, und site-invite.mjs nennt keine Gilde' };
}

/** true nur fuer die Heim-Gilde. Ohne Heim-Gilde ist NICHTS zu Hause. */
export function isHomeGuild(ctx, guildOrId) {
  const id = typeof guildOrId === 'string' ? guildOrId : guildOrId?.id;
  return !!ctx?.home?.id && id === ctx.home.id;
}

/**
 * Die Testpilot-Rolle in der Heim-Gilde.
 * @returns {{ id: string|null, source: string, error?: string }}
 */
export function resolveTesterRole(guild, roleName, env = process.env) {
  const configured = (env.TESTER_ROLE_ID || '').trim();
  if (configured) {
    if (!SNOWFLAKE.test(configured)) return { id: null, source: 'TESTER_ROLE_ID', error: `TESTER_ROLE_ID ist keine Discord-ID ("${configured}")` };
    // Discord gibt @everyone die ID des Servers, und jedes Mitglied traegt sie.
    if (configured === guild.id) return { id: null, source: 'TESTER_ROLE_ID', error: 'TESTER_ROLE_ID ist die @everyone-Rolle (= Server-ID), nicht die Testpilot-Rolle' };
    const role = guild.roles.cache.get(configured);
    if (!role) return { id: null, source: 'TESTER_ROLE_ID', error: `TESTER_ROLE_ID ${configured} gibt es auf ${guild.name} nicht` };
    if (role.managed) return { id: null, source: 'TESTER_ROLE_ID', error: `TESTER_ROLE_ID ${configured} ist eine verwaltete Rolle (Bot/Integration)` };
    return { id: role.id, source: 'TESTER_ROLE_ID' };
  }
  if (!roleName) return { id: null, source: 'Blueprint', error: 'Rolle "tester" nicht im Blueprint gefunden' };
  const hits = [...guild.roles.cache.values()].filter((r) => r.name === roleName && !r.managed && r.id !== guild.id);
  if (hits.length === 1) return { id: hits[0].id, source: `Name "${roleName}"` };
  if (!hits.length) return { id: null, source: `Name "${roleName}"`, error: `Rolle "${roleName}" existiert nicht auf ${guild.name}` };
  return {
    id: null,
    source: `Name "${roleName}"`,
    error: `Rolle "${roleName}" gibt es ${hits.length}x auf ${guild.name} (${hits.map((r) => r.id).join(', ')}) — TESTER_ROLE_ID setzen`,
  };
}
