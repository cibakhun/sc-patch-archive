// miningShips.ts — Mining-Fahrzeuge aus der eigenen Schiff-DB (vehicles.json).
// Liefert Karten-Daten + Link auf das echte Datenblatt /schiffe/<id>.html.
// Keine erfundenen Schiffsdaten: Bild, Fracht, Crew stammen aus vehicles.json.
import raw from '../data/vehicles.json';
import { href as langHref, type Locale } from '../i18n/ui';

type Lang = Locale;
const vehicles: any[] = (raw as any).vehicles || [];

// id (= Slug der Detailseite) -> Mining-Rolle. Reihenfolge = Anzeige-Reihenfolge.
const MINING: { id: string; roleDe: string; roleEn: string }[] = [
  { id: 'misc-prospector', roleDe: 'Solo-Schiff', roleEn: 'Solo ship' },
  { id: 'argo-mole', roleDe: 'Multicrew-Schiff', roleEn: 'Multicrew ship' },
  { id: 'drak-golem', roleDe: 'Starter-Schiff', roleEn: 'Starter ship' },
  { id: 'grin-roc', roleDe: 'Fahrzeug', roleEn: 'Vehicle' },
  { id: 'grin-roc-ds', roleDe: 'Fahrzeug (2 Sitze)', roleEn: 'Vehicle (2-seat)' },
];

/**
 * Rollen-Label je Sprache, Schlüssel = Schiffs-Slug. roleDe/roleEn oben bleiben
 * als Fallback stehen; hier stehen nur die zusätzlichen Sprachen.
 */
const ROLE: Partial<Record<Locale, Record<string, string>>> = {
  hu: {
    'misc-prospector': 'Egyszemélyes hajó',
    'argo-mole': 'Többszemélyes hajó',
    'drak-golem': 'Kezdőhajó',
    'grin-roc': 'Jármű',
    'grin-roc-ds': 'Jármű (2 üléses)',
  },
};

export function buildMiningShips(lang: Lang) {
  return MINING.map((mn) => {
    const v = vehicles.find((x) => x.id === mn.id);
    if (!v) return null;
    const crewLo = Math.min(v.crewMin ?? 1, v.crewMax ?? 1);
    const crewHi = Math.max(v.crewMin ?? 1, v.crewMax ?? 1);
    const ore = Number(v.oreSCU) || 0;
    return {
      id: v.id,
      name: v.name as string,
      mfr: (v.manufacturer as string) || '',
      role: ROLE[lang]?.[mn.id] ?? (lang === 'de' ? mn.roleDe : mn.roleEn),
      ore: ore ? `${ore} SCU` : null,
      crew: crewLo === crewHi ? `${crewLo}` : `${crewLo}–${crewHi}`,
      img: (v.image && (v.image.thumb || v.image.hero)) || null,
      href: langHref(`/schiffe/${v.id}.html`, lang),
    };
  }).filter(Boolean) as {
    id: string; name: string; mfr: string; role: string;
    ore: string | null; crew: string; img: string | null; href: string;
  }[];
}
