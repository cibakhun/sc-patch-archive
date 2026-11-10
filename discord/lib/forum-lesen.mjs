// ═════════════════════════════════════════════════════════════════════════
//  forum-lesen.mjs — reine Logik für vorschlaege.mjs (kein Netz, keine Abhängigkeit).
//
//  Getrennt vom Abruf, damit sich Filter und Reihenfolge offline prüfen lassen
//  (vorschlaege.test.mjs). Alles hier arbeitet auf den rohen JSON-Objekten der
//  Discord-REST-API (Thread-Kanäle eines Forums, Forum-Kanal mit available_tags).
// ═════════════════════════════════════════════════════════════════════════

// Discord-Kanaltyp 15 = GUILD_FORUM.
export const FORUM_TYP = 15;

// Tag-Namen so, wie blueprint.mjs sie anlegt. Der Builder ordnet Tags über den
// Namen zu und benennt sie nie um (Kommentar dort), also tragen die Namen.
export const TAG_VORSCHLAG = 'Suggestion';
export const TAG_ERLEDIGT = 'Done';
export const TAG_GEPLANT = 'Planned';

// Erstellzeit eines Threads. Ältere Threads (vor 2022-01-09) haben kein
// create_timestamp; dann trägt die Snowflake-ID die Zeit.
export function erstelltAm(thread) {
  const t = thread?.thread_metadata?.create_timestamp;
  if (t) return new Date(t);
  return snowflakeZeit(thread.id);
}

export function snowflakeZeit(id) {
  return new Date(Number((BigInt(id) >> 22n) + 1420070400000n));
}

// id → Name für die Tags eines Forums.
export function tagKarte(forum) {
  const karte = new Map();
  for (const t of forum?.available_tags ?? []) karte.set(t.id, t.name);
  return karte;
}

// Die Namen der Tags, die ein Thread trägt (unbekannte IDs als „?<id>").
export function tagsVon(thread, karte) {
  return (thread.applied_tags ?? []).map((id) => karte.get(id) ?? `?${id}`);
}

// Filtert die Threads eines Forums.
//   tag    Name des Pflicht-Tags (z. B. 'Suggestion'); null = alle Posts.
//   alle   true: auch erledigte (Done) und gesperrte Posts.
// Offen heißt: trägt den Tag, nicht „Done", nicht gesperrt. „Planned" bleibt
// offen — das Team hat zugesagt, gebaut ist es noch nicht.
// „Planned" und „Done" setzt nur das Team, und zwar auf Ideen. Ein Post mit
// einem davon zählt deshalb als Vorschlag, auch wenn 💡 Suggestion fehlt —
// sonst fiele eine angenommene Idee aus der Liste, sobald jemand den Tag
// tauscht (so am 10.11.2026 beim ersten echten Lauf).
// Reihenfolge: älteste zuerst (Warteschlange), bei Gleichstand nach ID.
export function filtereOffene(threads, forum, { tag = 'Suggestion', alle = false } = {}) {
  const karte = tagKarte(forum);
  const gesehen = new Set();
  const treffer = [];
  for (const th of threads) {
    if (th.parent_id !== forum.id) continue;
    if (gesehen.has(th.id)) continue; // aktive + archivierte Liste können sich überschneiden
    gesehen.add(th.id);
    const tags = tagsVon(th, karte);
    const gesperrt = Boolean(th.thread_metadata?.locked);
    const erledigt = tags.includes(TAG_ERLEDIGT);
    const teamMarke = erledigt || tags.includes(TAG_GEPLANT);
    if (tag && !tags.includes(tag) && !(tag === TAG_VORSCHLAG && teamMarke)) continue;
    if (!alle && (erledigt || gesperrt)) continue;
    treffer.push({
      id: th.id,
      titel: th.name,
      tags,
      erstellt: erstelltAm(th),
      archiviert: Boolean(th.thread_metadata?.archived),
      gesperrt,
      erledigt,
      geplant: tags.includes(TAG_GEPLANT),
      // message_count zählt den Startbeitrag laut Discord-Doku nicht mit.
      antworten: th.message_count ?? 0,
      autorId: th.owner_id ?? null,
    });
  }
  treffer.sort((a, b) => a.erstellt - b.erstellt || (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  return treffer;
}

// Daumen hoch/runter aus den Reaktionen des Startbeitrags.
export function stimmen(nachricht) {
  let hoch = 0, runter = 0;
  for (const r of nachricht?.reactions ?? []) {
    if (r.emoji?.name === '👍') hoch = r.count;
    if (r.emoji?.name === '👎') runter = r.count;
  }
  return { hoch, runter };
}

// Anzeigename eines Autors: globaler Name, sonst Nutzername.
export function autorName(autor) {
  if (!autor) return 'unbekannt';
  return autor.global_name || autor.username || autor.id;
}

// Discord liefert content leer, wenn der lesenden App der Message Content
// Intent fehlt — auch über REST. Ohne diesen Hinweis sähe ein fehlender
// Schalter aus wie lauter leere Posts.
export function inhaltFehlt(nachricht) {
  return Boolean(nachricht) && !nachricht.content && !(nachricht.attachments?.length) && !(nachricht.embeds?.length);
}

export function kurz(text, max = 220) {
  const einzeilig = String(text ?? '').replace(/\s+/g, ' ').trim();
  return einzeilig.length > max ? einzeilig.slice(0, max - 1) + '…' : einzeilig;
}

// NODE_USE_ENV_PROXY (fetch über HTTPS_PROXY) gibt es ab Node 22.21 in der
// 22er-Reihe und ab 24.5; 23.x und ältere gingen am Proxy vorbei.
export function proxyFaehig(version) {
  const [a, b] = String(version).replace(/^v/, '').split('.').map(Number);
  return (a === 22 && b >= 21) || (a === 24 && b >= 5) || a >= 25;
}
