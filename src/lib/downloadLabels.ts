// Kuratierte Anzeige-Namen für die Download-Galerie.
// -----------------------------------------------------------------------------
// Wandelt einen rohen Medien-Dateinamen (img-apollo.jpg, t-storm-3.jpg …) in
// einen menschenlesbaren Titel + Untertitel um — statt kryptischer Dateinamen.
// Sprach-neutral wo möglich (Schiffs-/Eigennamen), DE/EN nur wo es zählt.

export type Lang = 'de' | 'en';
export interface MediaLabel {
  title: string; // kuratierter Haupttitel (z. B. "Storm Breaker")
  sub: string; // kurzer Kontext (z. B. "Bild 3", "Render", "Trailer-Standbild")
}

// t-<slug>-<n> -> Themen-Name. Slug = Kürzel aus dem Bild-Set.
const TOPIC: Record<string, { de: string; en: string }> = {
  storm: { de: 'Storm Breaker', en: 'Storm Breaker' },
  xeno: { de: 'XenoThreat', en: 'XenoThreat' },
  onyx: { de: 'Onyx-Facilities', en: 'Onyx Facilities' },
  polaris: { de: 'Polaris-Jagd', en: 'Polaris Hunt' },
  pyro: { de: 'Pyro-System', en: 'Pyro System' },
  mesh: { de: 'Server Meshing', en: 'Server Meshing' },
  med: { de: 'Medical Overhaul', en: 'Medical Overhaul' },
  align: { de: 'Align & Mine', en: 'Align & Mine' },
  craft: { de: 'Crafting', en: 'Crafting' },
  eng: { de: 'Engineering', en: 'Engineering' },
  nyx: { de: 'Nyx-System', en: 'Nyx System' },
  vanduul: { de: 'Vanduul', en: 'Vanduul' },
  supply: { de: 'Supply or Die', en: 'Supply or Die' },
  rd: { de: 'Resource Drive', en: 'Resource Drive' },
  tsg: { de: 'Tactical Strike Groups', en: 'Tactical Strike Groups' },
  def: { de: 'Defend Location', en: 'Defend Location' },
  alien: { de: 'Alien Week', en: 'Alien Week' },
  hh: { de: 'Hammerhead', en: 'Hammerhead' },
  ffp: { de: 'Fight for Pyro', en: 'Fight for Pyro' },
  front: { de: 'Frontier Fighters', en: 'Frontier Fighters' },
  ironclad: { de: 'Ironclad', en: 'Ironclad' },
  hangar: { de: 'Hangar', en: 'Hangar' },
  ruin: { de: 'Ruinen', en: 'Ruins' },
  frontier: { de: 'Frontier Tensions', en: 'Frontier Tensions' },
  basher: { de: "Grey's Market Basher", en: "Grey's Market Basher" },
};

// Bekannte Akronyme/Schreibweisen für die Titelaufbereitung.
const ACRONYM: Record<string, string> = {
  atls: 'ATLS',
  mole: 'MOLE',
  roc: 'ROC',
  cz: 'CZ',
  rsi: 'RSI',
  uee: 'UEE',
};

// Eigennamen, die eine simple Groß-/Kleinschreibung nicht trifft.
const SUBJECT: Record<string, string> = {
  superhornet: 'Super Hornet',
  supplyordie: 'Supply or Die',
  syulen: 'Syulen',
  tyilui: 'Tyilui',
};

function pretty(token: string): string {
  const t = token.toLowerCase();
  if (SUBJECT[t]) return SUBJECT[t];
  if (ACRONYM[t]) return ACRONYM[t];
  // trailing-Zahl abtrennen (apollo2 -> Apollo)
  const m = t.match(/^([a-z]+)(\d+)$/);
  if (m) return pretty(m[1]);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const T = (lang: Lang, de: string, en: string) => (lang === 'de' ? de : en);

/** Roher Dateiname (z. B. "t-storm-3.jpg") -> kuratiertes Label. */
export function mediaLabel(file: string, lang: Lang): MediaLabel {
  const base = file.replace(/\.[^.]+$/, '');

  // t-<slug>-<n>: Themen- & Guide-Bilder
  let m = base.match(/^t-([a-z]+)-(\d+)$/);
  if (m) {
    const topic = TOPIC[m[1]];
    return {
      title: topic ? topic[lang] : pretty(m[1]),
      sub: T(lang, `Bild ${m[2]}`, `Image ${m[2]}`),
    };
  }

  // trailer-<a>-<b>-<c>: Patch-Trailer-Standbilder
  m = base.match(/^trailer-(\d+)-(\d+)-(\d+)$/);
  if (m) {
    return {
      title: `Patch ${m[1]}.${m[2]}.${m[3]}`,
      sub: T(lang, 'Trailer-Standbild', 'Trailer still'),
    };
  }

  // cz-<x>: Contested Zones
  m = base.match(/^cz-(.+)$/);
  if (m) {
    return { title: 'Contested Zones', sub: pretty(m[1]) };
  }

  // vid-isc<n>: Inside Star Citizen
  m = base.match(/^vid-isc(\d+)$/);
  if (m) {
    return {
      title: 'Inside Star Citizen',
      sub: T(lang, `Folge ${m[1]}`, `Episode ${m[1]}`),
    };
  }

  // vid-<x>: Video-Standbilder
  m = base.match(/^vid-(.+)$/);
  if (m) {
    return { title: pretty(m[1]), sub: T(lang, 'Video-Standbild', 'Video still') };
  }

  // img-<x>: Renders / Motive
  m = base.match(/^img-(.+)$/);
  if (m) {
    return { title: pretty(m[1]), sub: T(lang, 'Render', 'Render') };
  }

  // wk-<x>: Wikelo's-Emporium-Assets (Trade-Belohnungen). Kuratiert, wo der
  // Dateiname das Item nicht trägt — dieselben Dateien stehen auf der Wikelo-
  // Seite mit dem echten Item-Namen als Alt-Text; Download-Titel und Trade-Alt
  // müssen vom selben Ding sprechen (Audit: Media-Semantik).
  m = base.match(/^wk-(.+)$/);
  if (m) {
    const WK: Record<string, string> = {
      'a2b': 'A2 Hercules Starlifter',
      'c1': 'C1 Spirit',
      'superhornet': 'F7C-M Super Hornet Mk II',
      'w-kopionskull': 'Parallax "Fun Kopion Skull" Rifle',
      'w-militaryskull': 'Parallax "Fun Military Skull" Rifle',
      // pretty() würde die Modellnummer als trailing-Zahl abschneiden ("R").
      'w-r97': 'R97 "Crimson Camo" Shotgun',
    };
    // Kategorie-Kürzel (a- = Armor, w- = Waffe) trägt keine Information im Titel.
    const tokens = m[1].split('-').filter((t, i) => !(i === 0 && /^[aw]$/.test(t)));
    return {
      title: WK[m[1]] ?? tokens.map(pretty).join(' '),
      sub: T(lang, 'Wikelo’s Emporium', 'Wikelo’s Emporium'),
    };
  }

  // Fallback: Dateiname aufhübschen
  return { title: pretty(base.replace(/[-_]/g, ' ')), sub: '' };
}
