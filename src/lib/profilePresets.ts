export interface BannerPreset {
  id: string;
  name: string;
  url: string;
}

export interface AvatarPreset {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface CitizenRole {
  id: string;
  labelDe: string;
  labelEn: string;
  icon: string;
}

export const BANNER_PRESETS: BannerPreset[] = [
  { id: 'pyro', name: 'Pyro System Nebula', url: '/assets/t-pyro-2.jpg' },
  { id: 'hangar', name: 'Fleet Hangar', url: '/assets/t-hangar-1.jpg' },
  { id: 'polaris', name: 'Capital Bridge', url: '/assets/t-polaris-1.jpg' },
  { id: 'deepspace', name: 'Deep Space Belt', url: '/assets/t-nyx-1.jpg' },
  { id: 'alien', name: 'Alien Artifact', url: '/assets/t-alien-1.jpg' },
  { id: 'refinery', name: 'Refinery Hub', url: '/assets/img-refinery.jpg' },
];

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'helmet', name: 'Pilot Helmet', icon: '🪖', color: '#2dd4ff' },
  { id: 'aegis', name: 'Aegis Vanguard', icon: '🛡️', color: '#38bdf8' },
  { id: 'drake', name: 'Drake Skull', icon: '☠️', color: '#f43f5e' },
  { id: 'quantum', name: 'Quantum Core', icon: '⚛️', color: '#a855f7' },
  { id: 'miner', name: 'Mining Specialist', icon: '⛏️', color: '#f59e0b' },
  { id: 'medic', name: 'Fleet Medic', icon: '✚', color: '#10b981' },
  { id: 'explorer', name: 'Deep Explorer', icon: '🌌', color: '#6366f1' },
  { id: 'command', name: 'Fleet Commander', icon: '🛰️', color: '#ec4899' },
];

export const CITIZEN_ROLES: CitizenRole[] = [
  { id: 'bounty_hunter', labelDe: 'Kopfgeldjäger', labelEn: 'Bounty Hunter', icon: '🎯' },
  { id: 'miner', labelDe: 'Bergbau-Spezialist', labelEn: 'Mining Specialist', icon: '⛏️' },
  { id: 'salvager', labelDe: 'Bergung & Salvage', labelEn: 'Salvage Specialist', icon: '🦾' },
  { id: 'trader', labelDe: 'Händler & Fracht-Pilot', labelEn: 'Hauler & Trader', icon: '📦' },
  { id: 'commander', labelDe: 'Flottenkommandant', labelEn: 'Fleet Commander', icon: '🛰️' },
  { id: 'explorer', labelDe: 'Erkunder & Kartograf', labelEn: 'Explorer & Cartographer', icon: '🌌' },
  { id: 'medic', labelDe: 'Sanitäter & Search & Rescue', labelEn: 'Search & Rescue Medic', icon: '🚑' },
  { id: 'pirate', labelDe: 'Gesetzloser / Outlaw', labelEn: 'Outlaw / Pirate', icon: '🏴‍☠️' },
];

export const STATUS_STATES = {
  online: { labelDe: 'Online', labelEn: 'Online', color: '#38bdf8', pulse: false },
  ingame: { labelDe: 'In-Verse (Star Citizen)', labelEn: 'In-Verse (Star Citizen)', color: '#22c55e', pulse: true },
  mission: { labelDe: 'Auf Mission', labelEn: 'On Mission', color: '#eab308', pulse: true },
  away: { labelDe: 'Abwesend (AFK)', labelEn: 'Away (AFK)', color: '#f97316', pulse: false },
  offline: { labelDe: 'Offline', labelEn: 'Offline', color: '#64748b', pulse: false },
};
