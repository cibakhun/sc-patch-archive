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

export function powerSuitRecords(db, byId) {
  const fehlt = [];
  for (const [id, cls] of Object.entries(POWER_SUITS)) {
    const r = db.records.find((x) => x.name === `EntityClassDefinition.${cls}`);
    if (r) byId.set(id, r); else fehlt.push(`${id} (${cls})`);
  }
  return fehlt;
}
