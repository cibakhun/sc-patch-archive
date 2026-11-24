// Eigene Fundort-Texte der Loot-Recherche (src/data/loot-items.json) auf
// Deutsch.
// ---------------------------------------------------------------------------
// Sprachregel (docs/sprachregel.md): Was wir selbst schreiben, steht immer in
// der Sprache der Seite. Die Recherche liegt nur englisch vor; bis 24.11.2026
// stand ihr Hinweis („This specific helmet cannot be purchased …“) deshalb
// auf 954 deutschen Itemblaettern englisch, und die Ortsarten („Dead NPC
// Mercenaries“) in der Bezugstabelle von 660 (UX-Audit, Heuristik B02).
//
// Schluessel ist der englische Text, wie er in den Daten steht. Eigennamen
// aus dem Spiel (Orte, Missionen, Shops, Sets) bleiben englisch.
// tests/e2e/sprachregel.test.js haelt die Tabelle deckungsgleich mit den
// Daten: Kommt ein Hinweis oder eine Ortsart dazu, fehlt sein Eintrag hier,
// und der Test sagt welcher.

import type { Locale } from './ui';

/** Hinweis (englisch, wie in loot-items.json) -> deutscher Text. */
export const HINWEISE_DE: Readonly<Record<string, string>> = {
  "This specific helmet cannot be purchased at standard planetary kiosks. It must be stripped from the bodies of fallen mercenaries or found inside high-security Red Loot Boxes in underground bunkers.":
    "Dieser Helm ist an keinem normalen Planetenkiosk zu kaufen. Man muss ihn gefallenen Söldnern abnehmen oder in den roten Hochsicherheits-Lootkisten unterirdischer Bunker finden.",
  "This specific armored core cannot be purchased at standard planetary kiosks. It must be stripped from the bodies of fallen mercenaries or found inside high-security Red Loot Boxes in underground bunkers.":
    "Dieser Rüstungstorso ist an keinem normalen Planetenkiosk zu kaufen. Man muss ihn gefallenen Söldnern abnehmen oder in den roten Hochsicherheits-Lootkisten unterirdischer Bunker finden.",
  "This specific set of armored legs cannot be purchased at standard planetary kiosks. It must be stripped from the bodies of fallen mercenaries or found inside high-security Red Loot Boxes in underground bunkers.":
    "Diese Beinpanzerung ist an keinem normalen Planetenkiosk zu kaufen. Man muss sie gefallenen Söldnern abnehmen oder in den roten Hochsicherheits-Lootkisten unterirdischer Bunker finden.",
  "This specific set of armored arms cannot be purchased at standard planetary kiosks. It must be stripped from the bodies of fallen mercenaries or found inside high-security Red Loot Boxes in underground bunkers.":
    "Diese Armpanzerung ist an keinem normalen Planetenkiosk zu kaufen. Man muss sie gefallenen Söldnern abnehmen oder in den roten Hochsicherheits-Lootkisten unterirdischer Bunker finden.",
  "Different variants have different sources. The rare Pyrotechnic edition drops from the target boss in CheckMate. The base version can be found in HUR-L1.":
    "Die Varianten haben unterschiedliche Quellen. Die seltene Pyrotechnic-Edition lässt der Zielboss in CheckMate fallen. Die Grundversion findet man in HUR-L1.",
  "A specialized flight undersuit. Generally discovered by looting civilian habitation lockers or storage crates inside space stations and derelicts.":
    "Ein spezieller Fliegeranzug. Meist beim Plündern ziviler Wohnspinde oder von Lagerkisten in Raumstationen und Wracks zu finden.",
  "This is a decorative hangar flair item, scale model, or account-bound reward. It is not available to purchase in-game.":
    "Ein Deko-Gegenstand für den Hangar, ein Modell oder eine an das Konto gebundene Belohnung. Im Spiel nicht zu kaufen.",
  "A heavy armor set primarily looted from hostile mercenaries at Distribution Centers or taken off Nine Tails Lieutenants during 'Destroy Contraband' drug bunker missions.":
    "Ein schweres Rüstungsset, das vor allem feindlichen Söldnern in Distribution Centers abgenommen wird oder Nine-Tails-Leutnants in den Drogenbunker-Missionen „Destroy Contraband“.",
  "The base Antium heavy armor is obtained by looting hostile locations. Methods for farming Antium armor include clearing Hawthor orbital lasers around the Santin system and raiding data centers in Pyro.":
    "Die Antium-Grundrüstung bekommt man durch Plündern feindlicher Orte. Bewährt haben sich die Hawthor-Orbitallaser rund um das Santin-System und Überfälle auf Rechenzentren in Pyro.",
  "The Arden-SL armor sets are almost exclusively premium items. The Archangel and Coramor variants are tied to the Subscriber/Pledge store. The Balefire edition was a CitizenCon 2951 exclusive. Players can only find pieces of these sets in-game by pure luck in rare outpost loot crates or by looting a player who brought it from their hangar.":
    "Die Arden-SL-Sets sind fast ausschließlich Premium-Gegenstände. Die Varianten Archangel und Coramor gehören zum Subscriber- bzw. Pledge-Store, die Balefire-Edition war ein Exklusivartikel der CitizenCon 2951. Im Spiel findet man Teile dieser Sets nur mit viel Glück in seltenen Lootkisten von Außenposten oder bei einem Spieler, der sie aus seinem Hangar mitgebracht hat.",
  "High-end combat armor frequently worn by hostile NPC mercenaries defending security depots or distribution centers.":
    "Hochwertige Kampfrüstung, die häufig feindliche NPC-Söldner tragen, wenn sie Security Depots oder Distribution Centers verteidigen.",
  "The 'Executive' or 'Executive Edition' variants of weapons and armor are exclusive rewards granted to Concierge backers, bound directly to their accounts. The only way to obtain them in-game without being a Concierge is by looting another player who brought it from their hangar.":
    "Die Varianten „Executive“ oder „Executive Edition“ von Waffen und Rüstungen sind exklusive Belohnungen für Concierge-Unterstützer und fest an deren Konto gebunden. Ohne Concierge-Status bekommt man sie im Spiel nur, indem man einen Spieler plündert, der sie aus seinem Hangar mitgebracht hat.",
  "Elite or Boss variants of the ADP armor (like Exec, Big Boss, Righteous, Red Alert) are worn by elite level corporate security or bounty bosses. Take them down in bunkers or find them in red bunker crates.":
    "Elite- und Boss-Varianten der ADP-Rüstung (etwa Exec, Big Boss, Righteous, Red Alert) tragen Elite-Konzernwachen oder Kopfgeld-Bosse. Man besiegt sie in Bunkern oder findet die Teile in roten Bunkerkisten.",
  "Specialized sniper rifles that cannot be purchased are commonly fielded by NPC snipers at derelicts, or dropped as very-rare spawns in premium weapon lockers.":
    "Spezielle Scharfschützengewehre, die nicht zu kaufen sind, führen meist NPC-Scharfschützen an Wracks; sehr selten liegen sie auch in hochwertigen Waffenspinden.",
  "Specifically decorated for Crusader Industries. Looted from fallen Crusader Security guards or found in outposts across the Crusader planetary system.":
    "Im Design von Crusader Industries. Zu finden bei gefallenen Crusader-Sicherheitskräften oder in Außenposten rund um Crusader.",
  "This assault rifle variant cannot be purchased at standard planetary kiosks. It must be stripped from the bodies of fallen mercenaries or retrieved from physical weapon racks in secure bunkers.":
    "Diese Sturmgewehr-Variante ist an keinem normalen Planetenkiosk zu kaufen. Man muss sie gefallenen Söldnern abnehmen oder aus Waffenständern in gesicherten Bunkern holen.",
  "RSI Odyssey Flight suits. Base versions are available at Port Tressler, but unique colors are Subscriber Store exclusive.":
    "RSI-Odyssey-Fliegeranzüge. Die Grundversionen gibt es in Port Tressler, besondere Farben nur im Subscriber Store.",
  "Rare undersuit found occasionally in derelict ship crash sites or on dead bodies deep inside cave bounty missions.":
    "Seltener Unteranzug, gelegentlich an Absturzstellen von Schiffen oder bei Leichen tief in Höhlen bei Kopfgeldmissionen zu finden.",
  "The Aztalan armor set is originally a Subscriber Store exclusive item.":
    "Das Aztalan-Rüstungsset war ursprünglich exklusiv im Subscriber Store.",
  "The 'Red Alert' variants are a hostile armor aesthetic. Often looted from dead Nine Tails combatants or from high-tier elite bounty bosses.":
    "Die Varianten „Red Alert“ sind die Optik feindlicher Rüstungen. Oft bei toten Nine-Tails-Kämpfern oder hochrangigen Elite-Kopfgeld-Bossen zu finden.",
  "The highly coveted Artimex armor is worn by Elite Hurston Security Guards and Nine Tails Snipers. Farm Hurston Distribution centers or take 'Defend Site' bunker contracts.":
    "Die begehrte Artimex-Rüstung tragen Elite-Wachen von Hurston Security und Nine-Tails-Scharfschützen. Lohnend sind die Distribution Centers von Hurston oder Bunker-Aufträge „Defend Site“.",
  "Special cosmetic variants of the Arclight pistol like the 'Executive Edition' are exclusive rewards for Concierge backers and cannot be bought in-game. Other colored variants (like Nightstalker or Warhawk) are either subscriber flair or sold at specific planetary security kiosks.":
    "Besondere Optik-Varianten der Arclight-Pistole wie die „Executive Edition“ sind exklusive Belohnungen für Concierge-Unterstützer und im Spiel nicht zu kaufen. Andere Farbvarianten (etwa Nightstalker oder Warhawk) sind Subscriber-Flair oder an bestimmten Sicherheitskiosken auf Planeten zu haben.",
  "Specifically decorated for Hurston Dynamics. Looted from fallen Hurston Security guards or found in 'Defend Site' missions across the Hurston system.":
    "Im Design von Hurston Dynamics. Zu finden bei gefallenen Hurston-Sicherheitskräften oder in Missionen „Defend Site“ rund um Hurston.",
  "This gear is exclusively tied to the XenoThreat dynamic server event. It must be looted from XenoThreat forces or earned as a reputation reward during the event.":
    "Diese Ausrüstung gehört allein zum dynamischen Server-Event XenoThreat. Man erbeutet sie von XenoThreat-Truppen oder bekommt sie während des Events als Rufbelohnung.",
  "This unique helmet is historically tied to the Subscriber Store, but sub-variants can sometimes be found as ultra-rare crate loot.":
    "Dieser besondere Helm stammt ursprünglich aus dem Subscriber Store, einzelne Varianten tauchen aber manchmal als äußerst seltene Kistenbeute auf.",
  "A rare 'Duster' affiliated set. Acquire it by travelling to specific Duster settlements on Hurston (like Rappel) and taking down the NPCs who spawn wearing it.":
    "Ein seltenes Set aus dem Umfeld der Duster. Man reist zu bestimmten Duster-Siedlungen auf Hurston (etwa Rappel) und besiegt die NPCs, die es tragen.",
  "Specialized variants of the A03 Sniper Rifle (like Canuto, Lodestone) are usually subscriber flair or pledge store items. However, some can drop rarely in red loot boxes during mercenary bunker defense missions.":
    "Besondere Varianten des Scharfschützengewehrs A03 (etwa Canuto, Lodestone) sind meist Subscriber-Flair oder Artikel aus dem Pledge-Store. Einige fallen aber selten in roten Lootkisten bei Bunker-Verteidigungsmissionen für Söldner.",
  "Elite or Boss variants of the ADP leg armor are worn by elite level corporate security or bosses. Take them down in bunkers or find them in red bunker crates.":
    "Elite- und Boss-Varianten der ADP-Beinpanzerung tragen Elite-Konzernwachen oder Bosse. Man besiegt sie in Bunkern oder findet die Teile in roten Bunkerkisten.",
  "A heavily modified armor piece. Usually acquired by completing specific missions for the NPC Wikelo (like 'Armour with Horn and String'), who rewards players with random pieces of the Ana set.":
    "Ein stark umgebautes Rüstungsteil. Meist eine Belohnung für bestimmte Aufträge des NPC Wikelo (etwa „Armour with Horn and String“), der zufällige Teile des Ana-Sets vergibt.",
  "A corporate/military variant worn by elite guards defending security complexes.":
    "Eine Konzern- bzw. Militärvariante, die Elite-Wachen in Sicherheitsanlagen tragen.",
  "Elite or specific variants of the ADP armor arms are worn by corporate security guards or bounty bosses. They can also occasionally be found in red bunker loot crates.":
    "Elite- und Sondervarianten der ADP-Armpanzerung tragen Konzernwachen oder Kopfgeld-Bosse. Gelegentlich liegen sie auch in roten Lootkisten in Bunkern.",
  "Elite or Boss variants of the ADP chest armor are worn by elite level corporate security or bosses. Take them down in bunkers or find them in red bunker crates.":
    "Elite- und Boss-Varianten des ADP-Rüstungstorsos tragen Elite-Konzernwachen oder Bosse. Man besiegt sie in Bunkern oder findet die Teile in roten Bunkerkisten.",
  "The Pembroke high-temperature exploration suit. The base version can be bought at industrial armor shops like Lorville (Tammany and Sons), but special colored variants are exclusive to the Subscriber Store.":
    "Der Pembroke-Erkundungsanzug für hohe Temperaturen. Die Grundversion gibt es in Industrie-Rüstungsläden wie in Lorville (Tammany and Sons), besondere Farbvarianten nur im Subscriber Store.",
  "This unique helmet is historically tied to the Subscriber Store or special limited events.":
    "Dieser besondere Helm stammt ursprünglich aus dem Subscriber Store oder aus zeitlich begrenzten Events.",
  "A piece of armor historically tied to the Subscriber Store or special limited events.":
    "Ein Rüstungsteil, das ursprünglich aus dem Subscriber Store oder aus zeitlich begrenzten Events stammt.",
  "The Coda pistol is a powerful magnum. Base variants can be found in long weapon crates at planetary outposts, but specific colored editions are subscriber flair items.":
    "Die Coda-Pistole ist ein durchschlagskräftiger Magnum-Revolver. Grundvarianten liegen in langen Waffenkisten auf Planeten-Außenposten, bestimmte Farbeditionen sind Subscriber-Flair.",
  "A heavily-modified outlaw armor. Primarily acquired by boarding the hijacked 890 Jump during the 'Urgent: Boarding in Progress' mission and looting the hostile hijackers.":
    "Eine stark umgebaute Gesetzlosen-Rüstung. Vor allem zu bekommen, wenn man in der Mission „Urgent: Boarding in Progress“ die gekaperte 890 Jump entert und die feindlichen Entführer plündert.",
  "A unique helmet often worn by specific NPCs at locations like Astor's Clearing on MicroTech or Cutter's Rig. It can also appear in red loot boxes at planetary outposts.":
    "Ein besonderer Helm, den bestimmte NPCs an Orten wie Astor's Clearing auf microTech oder Cutter's Rig tragen. Er kann auch in roten Lootkisten auf Planeten-Außenposten liegen.",
  "Ace Interceptor gear drops from 'Ace Pilots' who randomly spawn during Foxwell Security or Headhunter Patrol missions. You must grind the base Yellow Foxwell missions to unlock the Orange/Red tiers where Ace Pilots actually spawn. Once engaged, 'soft-death' their ship (often a Hornet Mk1) and EVA over to strip the gear from their body before the mission despawns.":
    "Ace-Interceptor-Ausrüstung lassen „Ace Pilots“ fallen, die zufällig bei Patrouillen von Foxwell Security oder den Headhunters auftauchen. Man muss die gelben Grund-Aufträge von Foxwell spielen, um die orange und rote Stufe freizuschalten, in denen Ace Pilots tatsächlich erscheinen. Im Kampf ihr Schiff (oft eine Hornet Mk1) nur außer Gefecht setzen („Soft Death“), dann per EVA hinüber und die Ausrüstung abnehmen, bevor die Mission verschwindet.",
  "The Novikov exploration suit. The base version can be bought at high-end armor shops like Port Tressler or GrimHEX, but special colored variants are exclusive to the Subscriber Store.":
    "Der Novikov-Erkundungsanzug. Die Grundversion gibt es in hochwertigen Rüstungsläden wie in Port Tressler oder GrimHEX, besondere Farbvarianten nur im Subscriber Store.",
  "The 'Big Boss' variants are extremely rare drops worn exclusively by high-tier 'boss' NPCs during bounty missions. You must purposefully strip it from their body, or rarely find it in red loot boxes deep in security bunkers.":
    "Die Varianten „Big Boss“ sind äußerst seltene Beute, die nur hochrangige Boss-NPCs in Kopfgeldmissionen tragen. Man muss sie ihnen gezielt abnehmen oder findet sie selten in roten Lootkisten tief in Sicherheitsbunkern.",
  "The Big Boss variant of the ADP armor is an extremely rare drop. It is worn exclusively by high-tier 'boss' NPCs during bounty missions. You must purposefully strip it from their body, or rarely find it in red loot boxes deep in security bunkers.":
    "Die Big-Boss-Variante der ADP-Rüstung ist äußerst seltene Beute. Nur hochrangige Boss-NPCs in Kopfgeldmissionen tragen sie. Man muss sie ihnen gezielt abnehmen oder findet sie selten in roten Lootkisten tief in Sicherheitsbunkern.",
  "A heavily modified Antium armor piece. Usually acquired by completing specific missions for the NPC Wikelo (like 'Armour with Horn and String'), who rewards players with random pieces of the Ana Endro set.":
    "Ein stark umgebautes Antium-Rüstungsteil. Meist eine Belohnung für bestimmte Aufträge des NPC Wikelo (etwa „Armour with Horn and String“), der zufällige Teile des Ana-Endro-Sets vergibt.",
  "A heavily modified Antium armor piece. Acquired by completing specific missions for the NPC Wikelo, or rarely looted from hostile NPCs defending data centers in Pyro 4.":
    "Ein stark umgebautes Antium-Rüstungsteil. Eine Belohnung für bestimmte Aufträge des NPC Wikelo, selten auch Beute von feindlichen NPCs, die Rechenzentren auf Pyro 4 verteidigen.",
};

/** Ortsart der Recherche -> deutscher Name (Eigennamen unveraendert). */
export const ORTE_DE: Readonly<Record<string, string>> = {
  "Dead NPC Mercenaries": "Tote NPC-Söldner",
  "Red Bunker Crates": "Rote Bunkerkisten",
  "CheckMate Station (Hangar Boss)": "CheckMate-Station (Hangar-Boss)",
  "HUR-L1 Green Glade Station": "HUR-L1 Green Glade Station",
  "High-Tier Mercenary Boss NPCs": "Hochrangige Söldner-Bosse (NPC)",
  "Civilian Locker Rooms": "Zivile Spindräume",
  "Derelict Station Habitations": "Wohnbereiche verlassener Stationen",
  "Subscriber Store": "Subscriber Store",
  "Account Bound Item / Hangar Flair": "Kontogebunden / Hangar-Flair",
  "Hurston Security Depot 1": "Hurston Security Depot 1",
  "Crusader System Bunkers": "Bunker rund um Crusader",
  "Distribution Center Mercenary Missions (Hostile NPCs)": "Söldnermissionen in Distribution Centers (feindliche NPCs)",
  "Nine Tails Lieutenants (Drug Bunkers)": "Nine-Tails-Leutnants (Drogenbunker)",
  "Derelict Wreckages": "Wracks",
  "Data Centers (Pyro 4)": "Rechenzentren (Pyro 4)",
  "Security Depots": "Sicherheitsdepots",
  "Hawthor Orbital Lasers (Santin System)": "Hawthor-Orbitallaser (Santin-System)",
  "RSI Pledge Store / Subscriber Store": "RSI Pledge Store / Subscriber Store",
  "CitizenCon Digital Goodies Pack (Balefire)": "CitizenCon Digital Goodies Pack (Balefire)",
  "Rare Loot Boxes": "Seltene Lootkisten",
  "Hostile NPC Mercenaries": "Feindliche NPC-Söldner",
  "Concierge Backer Reward (Account Bound)": "Concierge-Belohnung (kontogebunden)",
  "Extremely Rare Player Drops": "Äußerst selten bei Spielern",
  "Bunker Weapon Crates": "Waffenkisten in Bunkern",
  "Hostile NPC Snipers": "Feindliche NPC-Scharfschützen",
  "Crusader Security Forces": "Crusader-Sicherheitskräfte",
  "Orison Security Bunkers": "Sicherheitsbunker von Orison",
  "Underground Facility Weapon Racks": "Waffenständer in unterirdischen Anlagen",
  "Port Tressler (Base Variant)": "Port Tressler (Grundvariante)",
  "Derelict Ships (Crash Sites)": "Schiffswracks (Absturzstellen)",
  "Cave Bounty Missions": "Kopfgeldmissionen in Höhlen",
  "Event Rewards": "Event-Belohnungen",
  "Nine Tails Outlaws": "Nine-Tails-Gesetzlose",
  "Hurston Distribution Centers (Elite Guards)": "Distribution Centers von Hurston (Elite-Wachen)",
  "Hurston 'Defend Site' Bunkers": "Hurston-Bunker („Defend Site“)",
  "Ghost Hollow (MicroTech)": "Ghost Hollow (microTech)",
  "Concierge Backer Reward (Executive Edition)": "Concierge-Belohnung (Executive Edition)",
  "Subscriber Store / General Kiosks": "Subscriber Store / gewöhnliche Kioske",
  "Hurston Security Forces": "Hurston-Sicherheitskräfte",
  "Hurston Dynamics Bunkers": "Bunker von Hurston Dynamics",
  "XenoThreat Dynamic Event (Loot/Reward)": "Dynamisches Event XenoThreat (Beute/Belohnung)",
  "Wikelo NPC Reward ('Armour with Horn and String' mission)": "Belohnung von Wikelo (Mission „Armour with Horn and String“)",
  "Rare Loot Spawns (Bunkers)": "Seltene Beute (Bunker)",
  "Rappel (Hurston)": "Rappel (Hurston)",
  "Picker's Field": "Picker's Field",
  "Maker's Point": "Maker's Point",
  "Weeping Cove": "Weeping Cove",
  "RSI Pledge Store": "RSI Pledge Store",
  "Bunker Red Loot Boxes": "Rote Lootkisten in Bunkern",
  "Outpost Weapon Crates": "Waffenkisten in Außenposten",
  "Corporate Elite Security": "Elite-Konzernsicherheit",
  "Lorville / Area18 (Base Variant)": "Lorville / Area18 (Grundvariante)",
  "Rare Loot Spawns": "Seltene Beute",
  "Rare Bunker Crates": "Seltene Bunkerkisten",
  "Planetary Outpost Weapon Crates": "Waffenkisten in Planeten-Außenposten",
  "Subscriber Store (Special Variants)": "Subscriber Store (Sondervarianten)",
  "Red Bunker Loot Boxes": "Rote Lootkisten in Bunkern",
  "Urgent: Boarding In Progress (890 Jump)": "Urgent: Boarding In Progress (890 Jump)",
  "Shadowfall (Pyro System)": "Shadowfall (Pyro-System)",
  "Astor's Clearing (MicroTech)": "Astor's Clearing (microTech)",
  "Cutter's Rig (NPC Spawns)": "Cutter's Rig (NPCs vor Ort)",
  "HDMS Sites / Outpost Red Boxes": "HDMS-Anlagen / rote Kisten in Außenposten",
  "Foxwell Security Patrols (Orange/Red Tier)": "Foxwell-Security-Patrouillen (Stufe Orange/Rot)",
  "Headhunters Patrol Contracts - Ace Pilot Spawns": "Patrouillenaufträge der Headhunters (Ace Pilots)",
  "Port Tressler / GrimHEX (Base Variant)": "Port Tressler / GrimHEX (Grundvariante)",
  "High-Tier Mercenary Bounties (Boss Targets)": "Hochrangige Söldner-Kopfgelder (Boss-Ziele)",
  "Wikelo NPC Reward": "Belohnung von Wikelo",
};

/** Fundort-Hinweis in der Sprache der Seite. */
export function lootHinweis(text: string, lang: Locale): string {
  return lang === 'de' ? HINWEISE_DE[text] ?? text : text;
}

/** Ortsart der Recherche in der Sprache der Seite. */
export function lootOrt(name: string, lang: Locale): string {
  return lang === 'de' ? ORTE_DE[name] ?? name : name;
}
