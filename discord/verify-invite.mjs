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
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Der Server, auf den die Einladung zeigen MUSS. Faellt sie auf einen anderen
// Server, ist das kein Schoenheitsfehler, sondern ein Fremdlink im Fuss jeder
// Seite — deshalb Exit 1 und nicht nur ein Hinweis.
const GUILD_ID = '1528576072638271518';
const GUILD_NAME = 'Verse-Base';

const argv = process.argv.slice(2);
const flag = (n) => argv.indexOf(n) >= 0;
const value = (n) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : null);

/* ---------- Code aus der einen Quelle holen ---------- */
// Bewusst per Regex statt per Import: consts.ts ist TypeScript, und dieses
// Skript soll ohne Bauschritt aus dem discord/-Verzeichnis laufen.
function codeAusConsts() {
  const src = readFileSync(resolve(ROOT, 'src/consts.ts'), 'utf8');
  const m = src.match(/invite:\s*'https:\/\/discord\.gg\/([A-Za-z0-9-]+)'/);
  if (!m) {
    console.error('FEHLER  src/consts.ts enthaelt kein DISCORD.invite in der erwarteten Form.');
    console.error('        Erwartet: invite: \'https://discord.gg/<code>\'');
    process.exit(2);
  }
  return m[1];
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

console.log(`\n  Server   ${inv.guild?.name}`);
console.log(`  Kanal    #${inv.channel?.name}`);
console.log(`  Ablauf   ${inv.expires_at ?? 'nie (permanent)'}`);
if (typeof inv.approximate_member_count === 'number') {
  console.log(`  Mitglieder ${inv.approximate_member_count}`);
}

if (fehler.length) {
  console.error('\nROT');
  for (const f of fehler) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nGRUEN  Die Einladung auf der Website lebt und zeigt auf den richtigen Server.');
