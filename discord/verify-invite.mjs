/* ============================================================
   verify-invite.mjs — steht die Einladung, die auf der Website steht?

   WARUM ES DAS GIBT: Seit die Seite den Server bewirbt (Fuss, Menue,
   Startseite, Feedback-Seite) haengt sie an EINEM Einladungscode, der in
   src/consts.ts steht. Discord kann eine Einladung verlieren — und
   `build.mjs` legt dann klaglos eine NEUE mit ANDEREM Code an, weil es nur
   prueft, ob ueberhaupt eine permanente existiert. Die Website zeigte danach
   ins Leere, und niemand merkte es: der Betreiber klickt seinen eigenen
   Einladungslink nicht.

   Der Lauf braucht KEIN Token — /invites/<code> ist oeffentlich. Genau das,
   was ein Besucher sieht, wird geprueft.

     node verify-invite.mjs              den Code aus src/consts.ts pruefen
     node verify-invite.mjs --code XXXX  einen beliebigen Code pruefen
     node verify-invite.mjs --gegenprobe fuehrt vor, dass das Tor rot werden
                                         KANN (erfundener Code -> Exit 1)

   Exit 0 = Einladung lebt und zeigt auf den richtigen Server.
   Exit 1 = Einladung tot oder auf einen fremden Server umgebogen.
   Exit 0 mit Hinweis = Netz nicht erreichbar; ungeprueft, aber nicht rot —
     ein Netzausfall darf keinen Deploy reissen (dieselbe Lehre wie bei den
     UEX-Strecken, die aus CI grundsaetzlich nicht erreichbar sind).
   ============================================================ */
import { siteInviteCode, GUILD_ID, GUILD_NAME } from './site-invite.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.indexOf(n) >= 0;
const value = (n) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : null);

function codeAusConsts() {
  const c = siteInviteCode();
  if (!c) {
    console.error('FEHLER  src/consts.ts enthaelt kein DISCORD.invite in der erwarteten Form.');
    console.error('        Erwartet: invite: \'https://discord.gg/<code>\'');
    process.exit(2);
  }
  return c;
}

const gegenprobe = flag('--gegenprobe');
const code = gegenprobe ? 'zzz-diesen-code-gibt-es-nicht' : value('--code') || codeAusConsts();

if (gegenprobe) {
  console.log('GEGENPROBE  erfundener Code — dieser Lauf MUSS mit Exit 1 enden.\n');
}
console.log(`Pruefe  https://discord.gg/${code}`);

/* ---------- fragen ---------- */
let res;
try {
  res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`, {
    headers: { 'User-Agent': 'verse-base-invite-check' },
    signal: AbortSignal.timeout(15000),
  });
} catch (e) {
  console.log(`\nUEBERSPRUNGEN  Discord nicht erreichbar (${e.message}).`);
  console.log('               Die Einladung ist damit UNGEPRUEFT, nicht bestaetigt.');
  process.exit(0);
}

if (res.status === 404) {
  console.error('\nROT  Diese Einladung existiert nicht (mehr).');
  console.error('     Die Website verlinkt damit ins Leere.');
  console.error('     Abhilfe: `npm run build` im discord/-Verzeichnis legt eine neue permanente');
  console.error('     Einladung an — deren Code dann in src/consts.ts eintragen.');
  process.exit(1);
}

if (!res.ok) {
  console.log(`\nUEBERSPRUNGEN  Discord antwortete mit ${res.status} (keine Aussage ueber die Einladung).`);
  process.exit(0);
}

const inv = await res.json();

/* ---------- beurteilen ---------- */
const fehler = [];
if (inv.guild?.id !== GUILD_ID) {
  fehler.push(`zeigt auf Server ${inv.guild?.id} (${inv.guild?.name ?? '?'}), erwartet ${GUILD_ID} (${GUILD_NAME})`);
}
// expires_at !== null heisst: die Einladung laeuft ab. Ein Ablaufdatum auf
// einem Link, der im Fuss JEDER Seite steht, ist eine Zeitbombe.
if (inv.expires_at) {
  fehler.push(`laeuft ab am ${inv.expires_at} — der Link auf der Website muss permanent sein`);
}

console.log(`\n  Server     ${inv.guild?.name}`);
console.log(`  Kanal      #${inv.channel?.name}`);
console.log(`  Ablauf     ${inv.expires_at ?? 'nie (permanent)'}`);
if (typeof inv.approximate_member_count === 'number') {
  console.log(`  Mitglieder ${inv.approximate_member_count}`);
}

/* ---------- Was der Besucher tatsaechlich liest ---------- */
// Discord setzt ueber den Beitritts-Dialog „<Ersteller> hat dich eingeladen".
// Der Name ist NICHT aenderbar — er gehoert zur Einladung. Steht dort etwas
// Fremdes (eine geloeschte Test-App, ein Bot), liest das jeder, der von der
// Website kommt. Kein Exit 1: der Link funktioniert ja — aber es gehoert
// sichtbar in den Bericht, weil man es sonst nie bemerkt.
const inviter = inv.inviter;
if (inviter) {
  console.log(`\n  Beitritts-Dialog zeigt: „${inviter.username} hat dich eingeladen"`);
  if (inviter.bot) {
    console.log(`  HINWEIS  Der Ersteller ist ein Bot bzw. eine Application.`);
    console.log(`           Aendern geht nur, indem ein Mensch eine NEUE Einladung anlegt`);
    console.log(`           (Discord-Client: Rechtsklick auf #welcome -> Einladung, „Nie"`);
    console.log(`           ablaufen, unbegrenzte Nutzungen), deren Code in src/consts.ts`);
    console.log(`           eintraegt und die alte danach zurueckzieht:`);
    console.log(`           node prune-invite.mjs --code ${code} --delete`);
  }
} else {
  console.log('\n  Ersteller  unbekannt (Discord liefert keinen)');
}

if (fehler.length) {
  console.error('\nROT');
  for (const f of fehler) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nGRUEN  Die Einladung auf der Website lebt und zeigt auf den richtigen Server.');
