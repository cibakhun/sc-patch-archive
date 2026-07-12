// Eigener, handgezeichneter Icon-Satz für das Komponenten-Hologramm.
// Technischer Strich-Stil (viewBox 0 0 24 24, stroke, keine Fremd-Bibliothek).
// Bewusst kantig/diegetisch — soll wie eine Bord-Konsole wirken, nicht wie ein
// Standard-Icon-Pack.

/** Gruppen-Icons fürs Ebenen-Panel */
export const HOLO_GRP_ICON: Record<string, string> = {
  // Komponenten — Modul-Chip mit Anschlüssen
  core: 'M8 8h8v8H8z M10.5 3v5 M13.5 3v5 M10.5 16v5 M13.5 16v5 M3 10.5h5 M3 13.5h5 M16 10.5h5 M16 13.5h5',
  // Bewaffnung — Zielkreuz
  arms: 'M12 2v6 M12 16v6 M2 12h6 M16 12h6 M12 7.2a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6z',
  // Antrieb — Schubdüse mit Strahl
  prop: 'M9 3h6l1.6 9H7.4z M10.6 12l-1.4 6 M12 12v6 M13.4 12l1.4 6',
  // Sonstiges — Kanister
  other: 'M6.5 4h8L18 7.5V20H6.5z M14.5 4v3.5H18 M9.5 11.5h5 M9.5 15h5',
};

/** Komponenten-Typ-Icons für die Detailkarte */
export const HOLO_ICON: Record<string, string> = {
  // Generator — Reaktorkern (Sechseck) mit Blitz
  power: 'M12 2l8 5v10l-8 5-8-5V7z M12.6 8l-3 4.5h3.4L11.4 16',
  // Schildgenerator — Schild mit Energie-Bogen
  shield: 'M12 2.5l8 3.1v5.4c0 5-3.3 8.7-8 10.2-4.7-1.5-8-5.2-8-10.2V5.6z M8.4 10.4a5 5 0 007.2 0',
  // Kühler — Radiator-Lamellen
  cooler: 'M6 4v16 M10 4v16 M14 4v16 M18 4v16 M4 9h16 M4 15h16',
  // Quantum-Antrieb — Warp-Orbit
  quantum: 'M12 9.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6z M3 16.5C6.5 19.5 17.5 11.5 21 7.5 M3 7.5C6.5 4.5 17.5 12.5 21 16.5',
  // Radar — Parabol-Bögen mit Sweep
  radar: 'M4 15a8 8 0 0116 0 M7.5 15a4.5 4.5 0 019 0 M12 15V4 M12 15l6-7',
  // Triebwerke — Düse mit Strahl
  thruster_main: 'M9 3h6l1.6 9H7.4z M10.6 12l-1.4 6 M12 12v6 M13.4 12l1.4 6',
  thruster_retro: 'M9 21h6l1.6-9H7.4z M10.6 12l-1.4-6 M12 12V6 M13.4 12l1.4-6',
  thruster_vtol: 'M8 4h8v6l-4 4-4-4z M12 14v6 M9 18l3 2 3-2',
  thruster_mav: 'M12 3v18 M3 12h18 M9 6l3-3 3 3 M9 18l3 3 3-3',
  // Geschützturm — Kuppel mit Läufen
  turret: 'M6 20a6 6 0 0112 0 M9 14V6l3-2 3 2v8 M12 4V2',
  // Raketenaufhängung — Rakete mit Flossen
  missile: 'M12 2.5c1.9 2 3 5 3 8.5l-3 3-3-3c0-3.5 1.1-6.5 3-8.5z M9 14l-2 3.5 M15 14l2 3.5 M12 14v4',
  // Waffen-Hardpoint — Lauf mit Visier
  weapon: 'M3 9h12l3 3-3 3H3z M18 8l3 4-3 4 M7 15v4',
  // Treibstoff — Tank mit Füllstand
  fuel: 'M6.5 4h8L18 7.5V20H6.5z M14.5 4v3.5H18 M9.5 12h5 M9.5 15.5h5',
  // Gegenmaßnahmen — Streu-Impuls
  countermeasure: 'M12 12a2 2 0 100-.01z M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M18 6l-2.5 2.5 M8.5 15.5L6 18',
};
