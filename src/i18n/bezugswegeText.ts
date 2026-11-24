// Texte fuer „So bekommst du es" (Item-Blatt) und „Woher kommt der Bauplan?"
// (Blueprint-Seite), UX-Audit Paket D1/D2, 24.11.2026.
//
// Eigene Datei statt ITEM_UI: Paket C arbeitet parallel an den Texttabellen
// in itemText.ts; dieser Block ist neu und gehoert nur zu diesen zwei
// Abschnitten. Gleiche Regeln wie dort: jeder Schluessel in beiden Sprachen,
// ein fehlender bricht den Bau ab (bwT), Spielnamen bleiben englisch.
import type { Locale } from './ui';

export const BEZUGSWEGE_UI = {
  de: {
    title: 'So bekommst du es',
    lead: 'Alle Wege zu diesem Item, die wir kennen. Details stehen weiter unten.',
    none: 'Für dieses Item kennen wir keinen Weg im Spiel.',
    tip: 'Weißt du, wie man es bekommt?',
    report: 'Hinweis melden',
    // Kaufen
    buy: 'Kaufen',
    buyFrom: 'ab {p}',
    buyStellen: '{n} Verkaufsstellen',
    buyStelle: '1 Verkaufsstelle',
    buyStellenIn: '{n} Verkaufsstellen in {sys}',
    buyStelleIn: '1 Verkaufsstelle in {sys}',
    buyGroup: '{sys} · {n} Stellen · ab {p}',
    buyGroupOne: '{sys} · 1 Stelle · {p}',
    buyNoSystem: 'Ohne Systemangabe',
    buyAll: 'Alle Verkaufsstellen',
    // Finden
    find: 'Finden',
    findConfirmed: 'An {n} Ortsarten bestätigt',
    findConfirmedOne: 'An einer Ortsart bestätigt',
    findResearch: 'Unbestätigt: {n} Orte',
    findResearchOne: 'Unbestätigt: ein Ort',
    findUnknown: 'Kann als Loot auftauchen, der Fundort ist nicht belegt.',
    findAll: 'Alle Fundorte',
    // Herstellen
    craft: 'Herstellen',
    craftMissions: 'Den Bauplan gibt es für diese Missionen:',
    craftMissionsOne: 'Den Bauplan gibt es für diese Mission:',
    craftMore: '+ {n} weitere',
    craftUnknown: 'Bauplan-Quelle unbekannt: keine Mission nennt ihn als Belohnung.',
    craftWikelo: 'Den Bauplan tauscht Wikelo.',
    craftOpen: 'Zum Bauplan',
    // Wikelo
    wikelo: 'Bei Wikelo tauschen',
    wikeloOne: 'Wikelo gibt es für ein Tauschgeschäft.',
    wikeloMany: 'Wikelo gibt es für {n} Tauschgeschäfte.',
    wikeloOpen: 'Zum Tauschgeschäft',
    // Ab Werk
    stock: 'Ab Werk',
    stockOne: 'Serienmäßig auf {name}.',
    stockMany: 'Serienmäßig auf {n} Schiffen und Fahrzeugen, z. B. {names}.',
    stockAll: 'Alle Schiffe',
    // Sonderweg
    special: 'Sonderweg',

    /* -- Blueprint-Seite ohne Missionsquelle (D2) -- */
    bpSourceTitle: 'Woher kommt der Bauplan?',
    bpSourceUnknown: 'Quelle unbekannt.',
    bpSourceUnknownText: 'Keine Mission im Spielstand {patch} nennt diesen Bauplan als Belohnung. Wie man ihn sonst bekommt, wissen wir noch nicht.',
    bpSourceWikelo: 'Wikelo tauscht diesen Bauplan',
    bpSourceWikeloText: 'Keine Mission im Spielstand {patch} nennt diesen Bauplan als Belohnung, aber Wikelo tauscht ihn.',
    bpNextTitle: 'Was du stattdessen tun kannst',
    bpNextItem: 'Das fertige Item gibt es auch ohne Bauplan: {wege}.',
    bpNextItemBuy: 'kaufen ab {p}',
    bpNextItemFind: 'als Loot finden',
    bpNextItemStock: 'ab Werk auf Schiffen',
    bpNextItemWikelo: 'bei Wikelo tauschen',
    bpNextItemOpen: 'So bekommst du das Item',
    bpNextReport: 'Weißt du, woher der Bauplan kommt? Ein Hinweis mit dieser Seite hilft allen.',
  },
  en: {
    title: 'How to get it',
    lead: 'Every way to this item that we know. Details follow below.',
    none: 'We know no way to get this item in the game.',
    tip: 'Do you know how to get it?',
    report: 'Send a hint',
    buy: 'Buy',
    buyFrom: 'from {p}',
    buyStellen: '{n} vendors',
    buyStelle: '1 vendor',
    buyStellenIn: '{n} vendors in {sys}',
    buyStelleIn: '1 vendor in {sys}',
    buyGroup: '{sys} · {n} vendors · from {p}',
    buyGroupOne: '{sys} · 1 vendor · {p}',
    buyNoSystem: 'No system given',
    buyAll: 'All vendors',
    find: 'Find',
    findConfirmed: 'Confirmed at {n} location types',
    findConfirmedOne: 'Confirmed at one location type',
    findResearch: 'Unconfirmed: {n} places',
    findResearchOne: 'Unconfirmed: one place',
    findUnknown: 'Can appear as loot; no location is confirmed.',
    findAll: 'All locations',
    craft: 'Craft',
    craftMissions: 'The blueprint is a reward of these missions:',
    craftMissionsOne: 'The blueprint is a reward of this mission:',
    craftMore: '+ {n} more',
    craftUnknown: 'Blueprint source unknown: no mission lists it as a reward.',
    craftWikelo: 'Wikelo trades the blueprint.',
    craftOpen: 'Open blueprint',
    wikelo: 'Trade with Wikelo',
    wikeloOne: 'Wikelo gives it for one trade.',
    wikeloMany: 'Wikelo gives it for {n} trades.',
    wikeloOpen: 'Open trade',
    stock: 'Stock',
    stockOne: 'Fitted as standard on the {name}.',
    stockMany: 'Fitted as standard on {n} ships and vehicles, e.g. {names}.',
    stockAll: 'All ships',
    special: 'Special',

    bpSourceTitle: 'Where does the blueprint come from?',
    bpSourceUnknown: 'Source unknown.',
    bpSourceUnknownText: 'No mission in game version {patch} lists this blueprint as a reward. We do not know yet how else to get it.',
    bpSourceWikelo: 'Wikelo trades this blueprint',
    bpSourceWikeloText: 'No mission in game version {patch} lists this blueprint as a reward, but Wikelo trades it.',
    bpNextTitle: 'What you can do instead',
    bpNextItem: 'The finished item is available without the blueprint: {wege}.',
    bpNextItemBuy: 'buy from {p}',
    bpNextItemFind: 'find as loot',
    bpNextItemStock: 'stock on ships',
    bpNextItemWikelo: 'trade with Wikelo',
    bpNextItemOpen: 'How to get the item',
    bpNextReport: 'Do you know where the blueprint comes from? A hint with this page helps everyone.',
  },
} as const;

export type BezugswegeKey = keyof (typeof BEZUGSWEGE_UI)['de'];

/** t = bwT(lang): wie itemT, ein fehlender Schluessel bricht den Bau ab. */
export function bwT(lang: Locale) {
  return (key: BezugswegeKey): string => {
    const s = (BEZUGSWEGE_UI[lang] as Record<string, string>)?.[key];
    if (s == null) throw new Error(`bezugswegeText.ts: Schluessel "${String(key)}" fehlt fuer ${lang}`);
    return s;
  };
}

// tsc prueft: EN fuehrt jeden DE-Schluessel (verify:typen).
const _enVollstaendig: Record<BezugswegeKey, string> = BEZUGSWEGE_UI.en;
void _enVollstaendig;
