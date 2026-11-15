/** Fassung X.Y.Z aus einer Kennung („sc-alpha-4.10.2@12881860", „4.10.2-live.…", „PUBLIC-4.10.2-…"). Ohne Fassung bricht der Bau. */
export function fassung(kennung: unknown, wo: string): string {
  const m = typeof kennung === 'string' ? /(\d+\.\d+\.\d+)/.exec(kennung) : null;
  if (!m) throw new Error(`datenstand: ${wo} traegt keine Fassung X.Y.Z (${JSON.stringify(kennung)})`);
  return m[1];
}
