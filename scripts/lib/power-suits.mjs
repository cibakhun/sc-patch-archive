// Power Suits (ATLS): Fahrzeuge der Site, die das Spiel nicht als Fahrzeug,
// sondern als Power Suit fuehrt (Record unter actor/actors/, ohne
// VehicleComponentParams). Ihre Werte stehen an anderer Stelle im Record
// (SEntityInsuranceProperties.displayParams, AttachDef, Standard-Loadout);
// datamine-ship-loadouts und datamine-vehicles lesen sie mit denselben Regeln
// wie jedes Fahrzeug.
//
// Aufgenommen ist nur, was Spieler wirklich bekommen (Stand 4.10.3, geprueft
// am 14.11.2026): lokalisierter Name im Spiel UND erhaeltlich (Pledge-Store,
// Ingame-Kauf oder Belohnung eines Vertrags).
//   ARGO_ATLS                       Pledge-Store, Ingame-Kauf
//   ARGO_ATLS_GEO                   Pledge-Store, Ingame-Kauf
//   ARGO_ATLS_GEO_Collector_Grad01  Wikelo-Vertrag (TheCollector)
//   ARGO_ATLS_GEO_Collector_Grad02  Wikelo-Vertrag (TheCollector, „Orange Line")
//   ARGO_ATLS_GEO_Collector_Grad03  Wikelo-Vertrag (TheCollector)
//   ARGO_ATLS_IKTI                  Wikelo-Vertrag (TheCollector_Vehicle_ATLS_IKTI)
//   ARGO_ATLS_GEO_IKTI              Wikelo-Vertrag (TheCollector_Vehicle_ATLS_IKTI_GEO)
//   ARGO_ATLS_GEO_IKTI_NTLS         Pledge-Store („ATLS IKTI Akuma", Nine Tails Shogun Pack)
// Nicht aufgenommen: ARGO_ATLS_IKTI_ARGOS („IKTI Rad") — das Spiel fuehrt ihn
// nur als HarvestablePreset (in der Welt platziertes Objekt), weder im Store
// noch als Belohnung noch in Patch Notes.
export const POWER_SUITS = {
  'argo-atls': 'ARGO_ATLS',
  'argo-atls-geo': 'ARGO_ATLS_GEO',
  'argo-atls-geo-collector-grad01': 'ARGO_ATLS_GEO_Collector_Grad01',
  'argo-atls-geo-collector-grad02': 'ARGO_ATLS_GEO_Collector_Grad02',
  'argo-atls-geo-collector-grad03': 'ARGO_ATLS_GEO_Collector_Grad03',
  'argo-atls-ikti': 'ARGO_ATLS_IKTI',
  'argo-atls-geo-ikti': 'ARGO_ATLS_GEO_IKTI',
  'argo-atls-geo-ikti-ntls': 'ARGO_ATLS_GEO_IKTI_NTLS',
};

/** Records der Power Suits in eine Id-Map eintragen (EntityClassDefinition.<Klasse>). */
export function powerSuitRecords(db, byId) {
  const fehlt = [];
  for (const [id, cls] of Object.entries(POWER_SUITS)) {
    const r = db.records.find((x) => x.name === `EntityClassDefinition.${cls}`);
    if (r) byId.set(id, r); else fehlt.push(`${id} (${cls})`);
  }
  return fehlt;
}
