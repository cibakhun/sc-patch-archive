// vehicle-records.mjs — welcher DataCore-Record hinter einer Katalog-Id steht.
//
// WARUM ES DEN GIBT: 4.10.2 hat Constellation (Andromeda, Aquila, Phoenix,
// Taurus) und Hammerhead als "Gold Standard"-Neubau ausgeliefert. Der neue
// Record heisst <Klasse>_GS (RSI_Constellation_Andromeda_GS), der alte bleibt
// im DataCore liegen — als OfflineMode-Fassung bzw. mit @LOC_UNINITIALIZED als
// Anzeigename. recId() macht aus beiden verschiedene Ids, und der Katalog traf
// still den ALTEN Record: Werte, Loadout und Geometrie eines Schiffs, das so
// nicht mehr fliegt. Die _GS-Fassung ist der Spieler-Record (eigene
// Versicherungs-Klasse, eigene Implementierungs-XML, FleetYards fuehrt genau
// diese scIdentifier).
//
// Regel: gibt es zu einer Id einen Record <id>-gs, gewinnt er. Die Katalog-Id
// (und damit jede Seiten-Adresse) bleibt die alte. 4.10.3 hat die Altfassungen
// von Andromeda, Aquila und Hammerhead geloescht; deren -gs-Record steht dann
// allein und traegt die Katalog-Id ebenso. Phoenix Emerald und Hammerhead
// Showdown hatten keinen GS-Record und sind mit 4.10.3 ganz verschwunden
// (Emerald ist seither eine Lackierung).
//
// Benutzt von datamine-vehicles, -ship-loadouts, -ship-components und
// -vehicle-roles — dieselbe Auswahl an allen vier Stellen, sonst passen
// Werte, Loadout und Rolle nicht zueinander.

/** Ueberschreibt in byId jede Id, zu der es einen "<id>-gs"-Record gibt. Gibt die umgehaengten Ids zurueck. */
export function preferGoldStandard(byId) {
  const moved = [];
  for (const id of [...byId.keys()]) {
    if (!id.endsWith('-gs')) continue;
    const base = id.slice(0, -3);
    byId.set(base, byId.get(id));
    moved.push(base);
  }
  return moved;
}
