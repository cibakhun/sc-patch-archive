export interface BannerPreset {
  id: string;
  name: string;
  url: string;
  thumb: string;
}

export interface AvatarPreset {
  id: string;
  name: string;
  symbol: string;
  defaultColor: string;
}

export interface AccentColor {
  id: string;
  name: string;
  hex: string;
}

export interface CitizenRole {
  id: string;
  labelDe: string;
  labelEn: string;
  symbol: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { id: 'cyan', name: 'Quantum Cyan', hex: '#2dd4ff' },
  { id: 'blue', name: 'Aegis Blue', hex: '#38bdf8' },
  { id: 'crimson', name: 'Drake Red', hex: '#f43f5e' },
  { id: 'purple', name: 'Nebula Purple', hex: '#a855f7' },
  { id: 'amber', name: 'Mining Gold', hex: '#f59e0b' },
  { id: 'emerald', name: 'Medic Green', hex: '#10b981' },
];

export const BANNER_PRESETS: BannerPreset[] = [
  { id: 'pyro', name: 'Pyro System Nebula', url: '/assets/t-pyro-2.jpg', thumb: '/assets/t-pyro-2.jpg' },
  { id: 'hangar', name: 'Fleet Hangar', url: '/assets/t-hangar-1.jpg', thumb: '/assets/t-hangar-1.jpg' },
  { id: 'polaris', name: 'Capital Bridge', url: '/assets/t-polaris-1.jpg', thumb: '/assets/t-polaris-1.jpg' },
  { id: 'deepspace', name: 'Deep Space Belt', url: '/assets/t-nyx-1.jpg', thumb: '/assets/t-nyx-1.jpg' },
  { id: 'alien', name: 'Alien Artifact', url: '/assets/t-alien-1.jpg', thumb: '/assets/t-alien-1.jpg' },
  { id: 'refinery', name: 'Refinery Hub', url: '/assets/img-refinery.jpg', thumb: '/assets/img-refinery.jpg' },
];

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'helmet', name: 'Pilot Helmet', symbol: '◆', defaultColor: '#2dd4ff' },
  { id: 'aegis', name: 'Aegis Vanguard', symbol: '▲', defaultColor: '#38bdf8' },
  { id: 'drake', name: 'Drake Emblem', symbol: '✕', defaultColor: '#f43f5e' },
  { id: 'quantum', name: 'Quantum Core', symbol: '❖', defaultColor: '#a855f7' },
  { id: 'miner', name: 'Mining Laser', symbol: '⬢', defaultColor: '#f59e0b' },
  { id: 'medic', name: 'Fleet Medic', symbol: '✚', defaultColor: '#10b981' },
  { id: 'explorer', name: 'Deep Explorer', symbol: '◈', defaultColor: '#6366f1' },
  { id: 'command', name: 'Fleet Commander', symbol: '★', defaultColor: '#ec4899' },
];

export const CITIZEN_ROLES: CitizenRole[] = [
  { id: 'bounty_hunter', labelDe: 'Kopfgeldjäger', labelEn: 'Bounty Hunter', symbol: '◆' },
  { id: 'miner', labelDe: 'Bergbau-Spezialist', labelEn: 'Mining Specialist', symbol: '⬢' },
  { id: 'salvager', labelDe: 'Bergung & Salvage', labelEn: 'Salvage Specialist', symbol: '⚙' },
  { id: 'trader', labelDe: 'Händler & Fracht-Pilot', labelEn: 'Hauler & Trader', symbol: '◈' },
  { id: 'commander', labelDe: 'Flottenkommandant', labelEn: 'Fleet Commander', symbol: '★' },
  { id: 'explorer', labelDe: 'Erkunder & Kartograf', labelEn: 'Explorer & Cartographer', symbol: '▲' },
  { id: 'medic', labelDe: 'Sanitäter & Search & Rescue', labelEn: 'Search & Rescue Medic', symbol: '✚' },
  { id: 'pirate', labelDe: 'Gesetzloser / Outlaw', labelEn: 'Outlaw / Pirate', symbol: '✕' },
];

export const STATUS_STATES = {
  online: { labelDe: 'Online', labelEn: 'Online', color: '#38bdf8', pulse: false },
  ingame: { labelDe: 'In-Verse (Star Citizen)', labelEn: 'In-Verse (Star Citizen)', color: '#22c55e', pulse: true },
  mission: { labelDe: 'Auf Mission', labelEn: 'On Mission', color: '#eab308', pulse: true },
  away: { labelDe: 'Abwesend (AFK)', labelEn: 'Away (AFK)', color: '#f97316', pulse: false },
  offline: { labelDe: 'Offline', labelEn: 'Offline', color: '#64748b', pulse: false },
};
