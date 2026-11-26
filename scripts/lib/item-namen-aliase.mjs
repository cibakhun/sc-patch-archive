// item-namen-aliase.mjs — alte und abweichende Item-Namen, die auf den Namen
// im Spiel zusammengelegt werden.
//
// WARUM ES DIESE TABELLE GIBT (IA C8, 24.11.2026): Der Katalog in
// scripts/build-universal-db.mjs fuehrt seine Quellen ueber den exakten Namen
// zusammen. Preisliste, Shop-Schnappschuss und Loot-Recherche kennen ein Item
// aber manchmal unter einem alten Namen oder in anderer Schreibweise. Dann
// entstanden zwei Seiten fuer dasselbe Ding: eine mit Preisen und Fundorten,
// aber ohne technische Daten, und eine mit Spielwerten, aber ohne Bezugswege.
// Gefunden ueber die Item-Seiten ohne Abschnitt „Technische Daten": 56 davon
// tragen ihre Werte im Spielbestand unter einem anderen Namen (Abgleich gegen
// Data.p4k 4.10.3, Liste in der Projektablage ux-audit/paket-d).
// Krisz hat am 24.11.2026 entschieden: zusammenlegen, die alte Adresse leitet
// per 301 auf die Seite mit dem Spielnamen (nginx/umzuege.conf).
//
// Jedes Paar: [Name in der Quelle, Name im Spiel, Art]. Der Name im Spiel
// steht hier zeichengenau, auch mit geschuetztem Leerzeichen ( ) oder
// doppeltem Leerzeichen, denn so fuehrt ihn der Katalog.
//
// Wer liest: build-universal-db.mjs (entry() und der Katalog-Schritt) und
// scripts/namen-zusammenfuehren.mjs, das den committeten Katalog ohne
// Datenlauf nachzieht. verify:namen-aliase haelt die Tabelle ehrlich: kein
// alter Name steht mehr als eigenes Item, jedes Ziel ist ein Item mit
// Spieldaten, und jeder alte Name kommt noch in einer Quelle vor (sonst ist
// das Paar ein Zombie und wird gestrichen).
export const NAMEN_ALIASE = [
  // Schreibweise: derselbe Name mit anderem Leerzeichen, anderen Anfuehrungszeichen oder Gray/Grey.
  ['Argus Helmet Gold/Gray/Black', 'Argus Helmet Gold/Grey/Black', 'schreibweise'],
  ['Deadrig "Noxious" Shotgun', 'Deadrig \'Noxious\' Shotgun', 'schreibweise'],
  ['Get Up Coffee (Milk)', 'Get Up Coffee  (Milk)', 'schreibweise'],
  ['Hellion Scattergun', 'Hellion\u00a0Scattergun', 'schreibweise'],
  ['Lynx Legs', 'Lynx\u00a0Legs', 'schreibweise'],
  ['Oracle Helmet', 'Oracle\u00a0Helmet', 'schreibweise'],
  ['P8-SC "Midnight" SMG', 'P8-SC\u00a0"Midnight" SMG', 'schreibweise'],
  ['P8-SC "Nightstalker" SMG', 'P8-SC\u00a0"Nightstalker" SMG', 'schreibweise'],
  ['P8-SC "Warhawk" SMG', 'P8-SC\u00a0"Warhawk" SMG', 'schreibweise'],
  ['TCS-4 Undersuit Black/Grey', 'TCS-4 Undersuit\u00a0Black/Grey', 'schreibweise'],
  ['TrueDef-Pro Arms White/Silver/Gray', 'TrueDef-Pro Arms White/Silver/Grey', 'schreibweise'],
  ['TrueDef-Pro Core White/Silver/Gray', 'TrueDef-Pro Core White/Silver/Grey', 'schreibweise'],

  // Umbenannt: alter Name aus Loot-Recherche, Preisliste oder Shop-Schnappschuss, das Spiel fuehrt das Item heute unter neuem Namen.
  ['Ace Interceptor Flight Suit', 'Ace Interceptor Racing Flight Suit', 'umbenannt'],
  ['Aurora CL Ship Armor', 'Aurora Mk I CL Ship Armor', 'umbenannt'],
  ['Aurora ES Ship Armor', 'Aurora Mk I ES Ship Armor', 'umbenannt'],
  ['Aurora LX Ship Armor', 'Aurora Mk I LX Ship Armor', 'umbenannt'],
  ['Aurora MR Ship Armor', 'Aurora Mk I MR Ship Armor', 'umbenannt'],
  ['Azrael Helmet', 'Azrael Racing Helmet', 'umbenannt'],
  ['Azrael Helmet Ruby', 'Azrael Racing Helmet Ruby', 'umbenannt'],
  ['Calva Helmet', 'Calva Racing Helmet', 'umbenannt'],
  ['Calva Helmet Red Festival', 'Calva Helmet Red Racing Festival', 'umbenannt'],
  ['Calva Helmet Year of the Rat', 'Calva Racing Helmet Year of the Rat', 'umbenannt'],
  ['Emod Stabilizer 1', 'Emod Stabilizer1', 'umbenannt'],
  ['Emod Stabilizer 2', 'Emod Stabilizer2', 'umbenannt'],
  ['Emod Stabilizer 3', 'Emod Stabilizer3', 'umbenannt'],
  ['Fortuna Racing Helmet', 'Neutrino Racing Helmet Fortuna', 'umbenannt'],
  ['Giocoso Helmet Azure', 'Giocoso Racing Helmet Azure', 'umbenannt'],
  ['Giocoso Helmet Ivory', 'Giocoso Racing Helmet Ivory', 'umbenannt'],
  ['Giocoso Helmet Obsidian', 'Giocoso Racing Helmet Obsidian', 'umbenannt'],
  ['Mirai Racing Helmet', 'Neutrino Racing Helmet Mirai', 'umbenannt'],
  ['Murray Cup Racing Helmet', 'Neutrino Racing Helmet Murray Cup', 'umbenannt'],
  ['Odyssey II Helmet Alpha', 'Odyssey II Racing Helmet Alpha', 'umbenannt'],
  ['Odyssey II Helmet Blue', 'Odyssey II Racing Helmet Blue', 'umbenannt'],
  ['Odyssey II Helmet Envy', 'Odyssey II Racing Helmet Envy', 'umbenannt'],
  ['Odyssey II Helmet Imperial', 'Odyssey II Racing Helmet Imperial', 'umbenannt'],
  ['Odyssey II Helmet Lovestruck', 'Odyssey II Racing Helmet Lovestruck', 'umbenannt'],
  ['Odyssey II Helmet Obsidian', 'Odyssey II Racing Helmet Obsidian', 'umbenannt'],
  ['Odyssey II Helmet Purple', 'Odyssey II Racing Helmet Purple', 'umbenannt'],
  ['Odyssey II Helmet Slate', 'Odyssey II Racing Helmet Slate', 'umbenannt'],
  ['Odyssey II Helmet Starcrossed', 'Odyssey II Racing Helmet Starcrossed', 'umbenannt'],
  ['OMNI-AFS-Sapphire Helmet', 'OMNI-AFS-Sapphire Flight Helmet', 'umbenannt'],
  ['OMNI-AFS-Sapphire Helmet Alpine', 'OMNI-AFS-Sapphire Flight Helmet Alpine', 'umbenannt'],
  ['OMNI-AFS-Sapphire Helmet Jungle', 'OMNI-AFS-Sapphire Flight Helmet Jungle', 'umbenannt'],
  ['OMNI-AFS-Sapphire Helmet Slate', 'OMNI-AFS-Sapphire Flight Helmet Slate', 'umbenannt'],
  ['Oracle', 'Oracle\u00a0Helmet', 'umbenannt'],
  ['Sol-III Helmet Aviator', 'Sol-III Flight Helmet Aviator', 'umbenannt'],
  ['Star Kitten Racing Helmet', 'Neutrino Racing Helmet Star Kitten', 'umbenannt'],
  ['SW16BR1', 'SW16BR1 “Buzzsaw” Repeater', 'umbenannt'],
  ['SW16BR2', 'SW16BR2 “Sawbuck” Repeater', 'umbenannt'],
  ['SW16BR3', 'SW16BR3 “Shredder” Repeater', 'umbenannt'],
  ['Xanthule Ascension Helmet', 'Xanthule Ascension Flight Helmet', 'umbenannt'],
  ['Xanthule Helmet', 'Xanthule Flight Helmet', 'umbenannt'],
  ['Xanthule Sehya Helmet', 'Xanthule Sehya Flight Helmet', 'umbenannt'],
  ['Xanthule Tahn Helmet', 'Xanthule Tahn Flight Helmet', 'umbenannt'],
  ['Zeus Exploration Suit Helmet', 'Zeus Exploration Helmet', 'umbenannt'],
  ['Zeus Exploration Suit Helmet Solar', 'Zeus Exploration Helmet Solar', 'umbenannt'],
];

/** Name in der Quelle (klein, getrimmt) -> Name im Spiel. */
export const ALIAS_ZIEL = new Map(NAMEN_ALIASE.map(([von, nach]) => [von.toLowerCase().trim(), nach]));

/** Der Name, unter dem der Katalog ein Item fuehrt: der Spielname, wenn die Quelle einen alten benutzt. */
export function katalogName(name) {
  const t = String(name).trim();
  return ALIAS_ZIEL.get(t.toLowerCase()) ?? t;
}

// Die Adressen, die beim Zusammenlegen verschwunden sind: [alte Item-Id,
// Name im Spiel]. Festgehalten am 24.11.2026 aus dem Lauf von
// scripts/namen-zusammenfuehren.mjs ueber den Katalog davor. Das ist nicht
// immer die Adresse des alten Namens: bei den Zwillingen mit geschuetztem
// Leerzeichen behaelt das zusammengelegte Item die bekannte Id, und die
// Id mit "-2" verschwindet (lynx-legs-2); bei Deadrig und Get Up Coffee trug
// schon der alte Name das "-2". verify:namen-aliase [4] verlangt fuer jede
// Zeile in EN und DE eine Weiterleitung auf die Seite des Spielnamens, und
// das Zusammenfuehr-Skript bricht ab, wenn ein Lauf eine Adresse verliert,
// die hier fehlt. Eintraege bleiben, auch wenn ein Paar oben faellt: die
// Adresse war einmal eine Seite.
export const ALTE_ADRESSEN = [
  ["ace-interceptor-flight-suit", "Ace Interceptor Racing Flight Suit"],
  ["argus-helmet-gold-gray-black", "Argus Helmet Gold/Grey/Black"],
  ["aurora-cl-ship-armor", "Aurora Mk I CL Ship Armor"],
  ["aurora-es-ship-armor", "Aurora Mk I ES Ship Armor"],
  ["aurora-lx-ship-armor", "Aurora Mk I LX Ship Armor"],
  ["aurora-mr-ship-armor", "Aurora Mk I MR Ship Armor"],
  ["azrael-helmet", "Azrael Racing Helmet"],
  ["azrael-helmet-ruby", "Azrael Racing Helmet Ruby"],
  ["calva-helmet", "Calva Racing Helmet"],
  ["calva-helmet-red-festival", "Calva Helmet Red Racing Festival"],
  ["calva-helmet-year-of-the-rat", "Calva Racing Helmet Year of the Rat"],
  ["deadrig-noxious-shotgun-2", "Deadrig 'Noxious' Shotgun"],
  ["emod-stabilizer-1", "Emod Stabilizer1"],
  ["emod-stabilizer-2", "Emod Stabilizer2"],
  ["emod-stabilizer-3", "Emod Stabilizer3"],
  ["fortuna-racing-helmet", "Neutrino Racing Helmet Fortuna"],
  ["get-up-coffee-milk-2", "Get Up Coffee  (Milk)"],
  ["giocoso-helmet-azure", "Giocoso Racing Helmet Azure"],
  ["giocoso-helmet-ivory", "Giocoso Racing Helmet Ivory"],
  ["giocoso-helmet-obsidian", "Giocoso Racing Helmet Obsidian"],
  ["hellion-scattergun-2", "Hellion\u00a0Scattergun"],
  ["lynx-legs-2", "Lynx\u00a0Legs"],
  ["mirai-racing-helmet", "Neutrino Racing Helmet Mirai"],
  ["murray-cup-racing-helmet", "Neutrino Racing Helmet Murray Cup"],
  ["odyssey-ii-helmet-alpha", "Odyssey II Racing Helmet Alpha"],
  ["odyssey-ii-helmet-blue", "Odyssey II Racing Helmet Blue"],
  ["odyssey-ii-helmet-envy", "Odyssey II Racing Helmet Envy"],
  ["odyssey-ii-helmet-imperial", "Odyssey II Racing Helmet Imperial"],
  ["odyssey-ii-helmet-lovestruck", "Odyssey II Racing Helmet Lovestruck"],
  ["odyssey-ii-helmet-obsidian", "Odyssey II Racing Helmet Obsidian"],
  ["odyssey-ii-helmet-purple", "Odyssey II Racing Helmet Purple"],
  ["odyssey-ii-helmet-slate", "Odyssey II Racing Helmet Slate"],
  ["odyssey-ii-helmet-starcrossed", "Odyssey II Racing Helmet Starcrossed"],
  ["omni-afs-sapphire-helmet", "OMNI-AFS-Sapphire Flight Helmet"],
  ["omni-afs-sapphire-helmet-alpine", "OMNI-AFS-Sapphire Flight Helmet Alpine"],
  ["omni-afs-sapphire-helmet-jungle", "OMNI-AFS-Sapphire Flight Helmet Jungle"],
  ["omni-afs-sapphire-helmet-slate", "OMNI-AFS-Sapphire Flight Helmet Slate"],
  ["oracle", "Oracle\u00a0Helmet"],
  ["oracle-helmet-2", "Oracle\u00a0Helmet"],
  ["p8-sc-midnight-smg-2", "P8-SC\u00a0\"Midnight\" SMG"],
  ["p8-sc-nightstalker-smg-2", "P8-SC\u00a0\"Nightstalker\" SMG"],
  ["p8-sc-warhawk-smg-2", "P8-SC\u00a0\"Warhawk\" SMG"],
  ["sol-iii-helmet-aviator", "Sol-III Flight Helmet Aviator"],
  ["star-kitten-racing-helmet", "Neutrino Racing Helmet Star Kitten"],
  ["sw16br1", "SW16BR1 “Buzzsaw” Repeater"],
  ["sw16br2", "SW16BR2 “Sawbuck” Repeater"],
  ["sw16br3", "SW16BR3 “Shredder” Repeater"],
  ["tcs-4-undersuit-black-grey-2", "TCS-4 Undersuit\u00a0Black/Grey"],
  ["truedef-pro-arms-white-silver-gray", "TrueDef-Pro Arms White/Silver/Grey"],
  ["truedef-pro-core-white-silver-gray", "TrueDef-Pro Core White/Silver/Grey"],
  ["xanthule-ascension-helmet", "Xanthule Ascension Flight Helmet"],
  ["xanthule-helmet", "Xanthule Flight Helmet"],
  ["xanthule-sehya-helmet", "Xanthule Sehya Flight Helmet"],
  ["xanthule-tahn-helmet", "Xanthule Tahn Flight Helmet"],
  ["zeus-exploration-suit-helmet", "Zeus Exploration Helmet"],
  ["zeus-exploration-suit-helmet-solar", "Zeus Exploration Helmet Solar"],
];
