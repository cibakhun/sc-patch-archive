import { createHash } from 'node:crypto';

export const RING_FELDER = ['innerRadiusKm', 'outerRadiusKm', 'depthKm', 'densityScale', 'rngSeed', 'noiseFrequencyRadial', 'noiseAmplitude', 'noiseGranularity', 'noiseRoughness', 'composition'];

export function ringFingerabdruck(ring) {
  const werte = Object.fromEntries(RING_FELDER.map((k) => [k, ring[k]]));
  return createHash('sha256').update(JSON.stringify(werte)).digest('hex').slice(0, 16);
}
