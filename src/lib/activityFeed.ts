// „Letzte Aktivität" in der Konto-Übersicht: mehrere Quellen (Refinery,
// Loadouts, Favoriten, Freunde, Anfragen) zu einer Liste, neueste zuerst.
// Jede Quelle bringt höchstens `per` Einträge mit, damit eine fleißige Quelle
// (zehn Refinery-Aufträge) die anderen nicht aus der Liste drückt.

export interface FeedItem {
  html: string;
  ts: number;
}

export function mergeFeed(sources: Record<string, readonly FeedItem[]>, per: number, max: number): FeedItem[] {
  const byTs = (a: FeedItem, b: FeedItem) => (b.ts || 0) - (a.ts || 0);
  return Object.values(sources)
    .flatMap((list) => list.slice().sort(byTs).slice(0, per))
    .sort(byTs)
    .slice(0, max);
}
