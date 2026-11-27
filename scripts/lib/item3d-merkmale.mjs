// Items in 3D: was der Bäcker an einem Spielmaterial kennt.
//
// Jedes Merkmal, das das Bild eines Items im Spiel bestimmen kann, steht hier
// mit seiner Behandlung im Bäcker (scripts/item3d/bake.mjs):
//   ja      gebacken wie im Spiel, soweit ein ruhendes Modell das zeigt
//   naeh    genähert: sichtbar anders als im Spiel; der Grund steht dabei
//   ohne    ohne Wirkung auf ein ruhendes Modell (Höhenrelief, Bewegung)
//   weg     bewusst weggelassen; der Grund steht dabei
//   fehler  das Modell wäre falsch (Loch, Teil am falschen Ort): hält an
// Was hier fehlt, ist „unbekannt“ und hält ebenfalls an: Ein Item mit einem
// solchen Merkmal kommt nicht in die Liste der Seite, bis es eingeordnet ist
// (scripts/item3d/manifest.mjs; Tor verify:item3d-befunde prüft die Liste
// gegen diese Tabelle).
//
// Anlass (23./24.11.2026): Der Schalter %DECALS war dem Bäcker unbekannt, sein
// Aufdruck wurde als Farbkarte gelesen, und die Prism "Irradiated" kam
// verchromt heraus. Die Suche danach fand dieselbe Art Fehler mehrfach: Bilder
// nach dem Dateinamen statt nach ihrem Platz gewählt (eine Schillerkarte als
// Farbe, eine Glanzkarte übergangen), Glanzwerte als Endwerte statt als
// Faktoren der Glanzkarte, Aufdrucke deckend gebacken, Teilnetze ohne
// Material (Löcher), Bildformate still übergangen. Jede dieser Arten ist
// unten als Merkmal geführt, damit sie gezählt und nicht vergessen wird.
//
// Bildplätze gelten nach ihrer Nummer, nicht nach dem Dateinamen: dieselbe
// Endung steht je Material auf verschiedenen Plätzen (_diff auf TexSlot4 als
// Glanzkarte, auf TexSlot5 als Schillerkarte).
//
// Bewusst nicht einzeln geführt: Feinwerte (PublicParams). Sie stellen nur
// ein, was ein Schalter oder Platz einschaltet; ein neuer Effekt kommt im
// Spiel mit einem neuen Schalter, und der hält hier an.

export const ARTEN = ['ja', 'naeh', 'ohne', 'weg', 'fehler', 'unbekannt'];
// Arten, die ein Item anhalten
export const HALT = new Set(['fehler', 'unbekannt']);

const J = 'ja', N = 'naeh', O = 'ohne', W = 'weg', F = 'fehler';
const m = (art, rolle, grund) => ({ art, rolle: rolle ?? null, grund: grund ?? null });

const GLAS = 'getöntes, durchscheinendes Glas; Brechung, Risse, Beschlag, Schmutz und Dünnfilm fehlen';
const SCHIRM = 'Bildschirm ohne Inhalt, als Fläche in seiner Grundfarbe';
const AUFDRUCK_UV2 = 'Aufdruck fehlt: er liegt im Spiel auf einer 2. UV, die das Netz nicht hat (auf der 1. UV gelegt sitzt er falsch, Venture-Unteranzug)';

// Shader: art des Ganzen, Schalter (StringGenMask) und Bildplätze mit Rolle.
// Die Rolle ist der Name, unter dem der Bäcker das Bild eines Platzes nimmt.
export const SHADER = {
  LayerBlend_V2: {
    art: J,
    schalter: {
      BLEND_MAP: m(J), NORMAL_MAP: m(J),
      DECALS: m(N, null, AUFDRUCK_UV2),
      OPACITY_MAP: m(N, null, 'Ausschnitte nach Deckkraftkarte fehlen, Fläche bleibt geschlossen'),
      HEIGHT_MAP: m(O, null, 'Höhenrelief'),
      IRIDESCENCE: m(N, null, 'Schillern ohne Blickwinkel: die vorherrschende Farbe des Verlaufs (geometrischer Median) auf den metallischen Flächen'),
      STENCIL_AS_STICKER: m(W, null, 'Schablonen-Logo in Palettenfarbe fehlt'),
      WEAR_DIRT_AO_VERTEX: m(N, null, 'Abnutzung und Schmutz aus Eckfarben fehlen'),
    },
    plaetze: {
      TexSlot1: m(N, 'aufdruck1', 'Aufdruck-Farbe (mit %DECALS) fehlt'),
      TexSlot2: m(N, 'aufdruckNormale', 'Normalen des Aufdrucks fehlen'),
      TexSlot3: m(J, 'normale'),
      TexSlot4: m(N, 'aufdruckGlanz', 'Glanz des Aufdrucks fehlt'),
      TexSlot5: m(N, 'schillern', 'Schillerverlauf, auf seine vorherrschende Farbe verdichtet (mit %IRIDESCENCE)'),
      TexSlot6: m(W, 'schablone', 'Schablonen-Logo'),
      TexSlot7: m(N, 'schillern2', 'zweiter Schillerverlauf fehlt'),
      TexSlot8: m(O, 'hoehe'),
      TexSlot9: m(N, 'aufdruck', AUFDRUCK_UV2),
      TexSlot11: m(J, 'abnutzung'),
      TexSlot12: m(J, 'mischung'),
      TexSlot13: m(J, 'hal'),
      TexSlot14: m(N, 'deckkraft', 'Ausschnitte fehlen'),
      TexSlot15: m(N, 'zusatz', 'Zusatzkarte (Verdeckung/Leuchten) nicht eingerechnet'),
    },
  },
  Illum: {
    art: J,
    schalter: {
      NORMAL_MAP: m(J), SPECULAR_MAP: m(J),
      DECAL: m(J, null, 'Fläche ist ein Aufdruck: durchscheinend obenauf, nichtmetallisch'),
      DECAL_OPACITY_MAP: m(J, null, 'Deckkraft aus dem Alphakanal der Farbkarte'),
      PARALLAX_OCCLUSION_MAPPING: m(O, null, 'Höhenrelief'),
      SILHOUETTE_PARALLAX_OCCLUSION_MAPPING: m(O, null, 'Höhenrelief'),
      VERTCOLORS: m(N, null, 'Eckfarben nicht eingerechnet'),
      BLENDLAYER: m(N, null, 'zweite Schicht über Mischmaske fehlt'),
      ALPHAGLOW: m(N, null, 'Leuchten fehlt'),
      ANIM_GLOW: m(O, null, 'Leuchtanimation'),
      HOLOGRAPHIC_PROJECTION: m(N, null, 'Hologramm als Fläche in Grundfarbe'),
      LUT_TINTING: m(N, null, 'Farbverlauf-Tönung fehlt'),
      TERRAIN_BLENDING: m(O, null, 'Übergang zum Gelände'),
      // Seit 27.11.2026 (Essen, Werkzeuge, Sonstiges): Belege je Schalter und
      // Platz aus den Materialien (Dateiendungen _detail/_udm, _sss/_opac,
      // _glow_gradient/_glow_colour/_glow_pulse), Zuordnung nur nach Platz.
      DETAIL_MAPPING: m(N, null, 'Feinstruktur der Detailkarte fehlt'),
      ALPHAMASK_DETAILMAP: m(N, null, 'Feinstruktur der Detailkarte fehlt'),
      TRANSMITTANCE_LIGHTING: m(N, null, 'Durchscheinen bei Gegenlicht fehlt (Essen, Blätter)'),
      USE_DAMAGE_MAP: m(O, null, 'Schadensbild: ein neues Item ist unbeschädigt'),
      DISPLACEMENT_MAPPING: m(O, null, 'Höhenrelief'),
      PHONG_TESSELLATION: m(O, null, 'Glättung aus der Nähe'),
      WIND_BENDING_MAIN: m(O, null, 'Bewegung im Wind'),
      WIND_BENDING_DETAIL: m(O, null, 'Bewegung im Wind'),
      OCEAN_SWAY: m(O, null, 'Schaukeln'),
      CONFORM_TO_TERRAIN: m(O, null, 'Anpassung an den Boden'),
    },
    plaetze: {
      TexSlot1: m(J, 'farbe'),
      TexSlot2: m(J, 'normale'),
      TexSlot3: m(N, 'normale2', 'Normalen der zweiten Schicht'),
      TexSlot4: m(J, 'glanzfarbe', 'Glanzfarbe je Texel, mal Specular'),
      TexSlot6: m(N, 'detail', 'Detailkarte (Feinstruktur) fehlt'),
      TexSlot7: m(N, 'leuchtverlauf', 'Leuchten fehlt (Verlauf der Leuchtanimation)'),
      TexSlot8: m(O, 'hoehe'),
      TexSlot9: m(N, 'farbe2', 'Farbe der zweiten Schicht'),
      TexSlot10: m(N, 'glanzfarbe2', 'Glanz der zweiten Schicht'),
      TexSlot11: m(O, 'hoehe2'),
      TexSlot12: m(N, 'mischmaske', 'Maske der zweiten Schicht'),
      TexSlot13: m(N, 'detail2', 'Detailkarte der zweiten Schicht fehlt'),
      TexSlot15: m(N, 'leuchtfarbe', 'Leuchten fehlt (Farbe der Leuchtanimation)'),
      TexSlot16: m(O, 'leuchtpuls', 'Takt der Leuchtanimation'),
      TexSlot17: m(N, 'durchscheinen', 'Durchscheinen bei Gegenlicht fehlt'),
    },
  },
  MeshDecal: {
    art: J,
    schalter: {
      DIFFUSE_MAP: m(J),
      PARALLAX_OCCLUSION_MAPPING: m(O, null, 'Höhenrelief'),
      STENCIL_MAP: m(W, null, 'Schablonen-Logo in Palettenfarbe fehlt'),
      STENCIL_AS_STICKER: m(W, null, 'Schablonen-Logo in Palettenfarbe fehlt'),
      VERTCOLORS: m(N, null, 'Eckfarben nicht eingerechnet'),
      USE_DAMAGE_MAP: m(O, null, 'Schadensbild'),
      // Beschriftung, die das Spiel zur Laufzeit in ein Bild rendert (Name
      // der Ware auf Frachtkisten): Platz 1 heißt dann $RenderToTexture, es
      // gibt keine Datei, der Aufdruck fällt als „ohne Bild“ weg.
      USE_RTT_UV_FOR_DIFFUSE: m(W, null, 'Beschriftung zur Laufzeit gerendert: fehlt'),
      VERTDATA: m(N, null, 'Eckdaten des Aufdrucks nicht eingerechnet'),
    },
    plaetze: {
      TexSlot1: m(J, 'farbe'),
      TexSlot2: m(N, 'glanzfarbe', 'Glanz des Aufdrucks genähert'),
      TexSlot3: m(N, 'normale', 'Normalen des Aufdrucks fehlen'),
      TexSlot4: m(O, 'hoehe'),
      TexSlot5: m(N, 'schmutz', 'Schmutz-/Abnutzungsmaske'),
      TexSlot6: m(N, 'mischung', 'Mischmaske des Aufdrucks'),
      TexSlot7: m(W, 'schablone', 'Schablonen-Logo'),
      TexSlot8: m(W, 'schablone2', 'Schablonen-Logo'),
      TexSlot9: m(W, 'schablone3', 'Schablonen-Logo'),
      TexSlot10: m(N, 'abnutzung', 'Abnutzung des Aufdrucks'),
      TexSlot11: m(N, 'glanzfarbe2', 'Glanz des Aufdrucks'),
    },
  },
  // Ganz genähert: jeder Schalter und Platz gilt als genähert, die Rolle der
  // Plätze steht trotzdem fest (nur „farbe“ wird genommen).
  GlassPBR: { art: N, grund: GLAS },
  DisplayScreen: { art: N, grund: SCHIRM },
  Monitor: { art: N, grund: SCHIRM },
  UIMesh: { art: N, grund: SCHIRM },
  UIPlane: { art: N, grund: SCHIRM },
  ScopePBR: { art: N, grund: 'Zielfernrohr-Glas als Fläche in Grundfarbe' },
  HumanSkin_V2: { art: N, grund: 'Haut als Farbkarte ohne Streuung', plaetze: { TexSlot1: m(N, 'farbe'), TexSlot2: m(N, 'normale') } },
  HairPBR: { art: N, grund: 'Haarkarten als geschlossene Fläche', plaetze: { TexSlot1: m(N, 'farbe') } },
  Eye: { art: N, grund: 'Auge als Farbkarte ohne Tiefe', plaetze: { TexSlot1: m(N, 'farbe'), TexSlot2: m(N, 'normale') } },
  NoDraw: { art: O, grund: 'unsichtbar' },
};

// Werte am Teilmaterial. Nur Werte, die etwas ändern, werden Merkmal (der
// Bäcker meldet Glow/Emissive nur, wenn beide leuchten; Opacity nur unter 1;
// AlphaTest nur über 0).
export const WERTE = {
  Diffuse: m(J), Specular: m(J), Shininess: m(J),
  MatSubTemplate: m(O, null, 'Name der Vorlage; die Werte stehen am Material'),
  Leuchten: m(N, null, 'Leuchten (Emissive mal Glow) nicht eingerechnet'),
  Opacity: m(N, null, 'Durchsicht fehlt außer bei Glas und Aufdrucken'),
  AlphaTest: m(N, null, 'Ausschnitte nach Alphatest fehlen'),
};

// Bildbewegung je Platz (<TexMod>)
export const TEXMOD = {
  Kachelung: m(J, null, 'feste Kachelung (TileU/TileV) eingerechnet'),
  Versatz: m(J, null, 'fester Versatz (OffsetU/OffsetV) eingerechnet'),
  KachelungNormale: m(N, null, 'gekachelte oder versetzte Normalenkarte weggelassen'),
  Drehung: m(N, null, 'feste Drehung des Bilds fehlt'),
  Bewegung: m(O, null, 'Bildbewegung (Oszillator)'),
};

// Bildformate der benutzten Bilder (Kennung aus dem DDS-Kopf)
export const BILDFORMATE = {
  bc1: m(J), bc2: m(J), bc3: m(J), bc4: m(J), bc4s: m(J), bc5: m(J), bc5s: m(J), bc7: m(J),
  r8: m(J), rgba8: m(J), bgra8: m(J), roh8: m(J), roh16: m(J), roh24: m(J), roh32: m(J),
  bc6h: m(N, null, 'HDR-Bild (BC6H) wird nicht entpackt: Fläche ohne dieses Bild'),
  fehlt: m(N, null, 'Bild fehlt im Spielarchiv: Fläche ohne dieses Bild'),
};

// Befunde des Baus selbst (Netz, Material, Lage)
export const BAU = {
  Schichten: m(J, null, 'Schichtmaterial nach Mischkarte gebacken'),
  'Schicht ohne Datei sichtbar': m(N, null, 'eine Schicht ohne Materialdatei deckt sichtbar Fläche: dort grau'),
  'Teilmaterial aus eigenem Material': m(J, null, 'das Material der Variante hat zu wenige Teilmaterialien; die fehlenden kommen aus dem eigenen Material des Netzes'),
  'fremdes Material verworfen': m(J, null, 'das Material der Variante gehört nicht zu diesem Netz (andere Teilnamen); das eigene gilt'),
  'Magazin fehlt': m(N, null, 'Knoten für das Serienmagazin fehlt: Magazin bleibt weg'),
  'Aufdruck ohne Deckkraft': m(N, null, 'Aufdruck ohne Deckkraft im Bild: weggelassen statt als Rechteck'),
  'Aufdruck ohne Bild': m(N, null, 'Aufdruck ohne Farbkarte: weggelassen'),
  'Kleinteil ohne Material': m(N, null, 'Teilnetz unter 0,1 % der Dreiecke ohne Material: fehlt im Modell, unsichtbar klein'),
  'Teilnetz ohne Material': m(F, null, 'Teilnetz ohne Material: es fehlte im Modell (Loch)'),
  'Material fehlt': m(F, null, 'Materialdatei fehlt: Teile ohne Material'),
  'Netz fehlt': m(F, null, 'Netzdatei eines Teils fehlt'),
  'Knochen fehlt': m(F, null, 'Knochen für ein Teil fehlt: es läge im Ursprung'),
  'Knoten fehlt': m(F, null, 'Knoten eines Teilnetzes fehlt: es läge im Ursprung'),
  'Bild nicht lesbar': m(F, null, 'Bild ließ sich nicht entpacken'),
  // Färbeart einer Schicht (PublicParams TintMode der Schichtdatei) und ihr
  // Palettenplatz (PaletteTint). Andere Werte sind unbekannt und halten an.
  // Gegen Spielbilder geprüft: Pembroke „RSI Graphite“ (Lack mit heller
  // Palettenspiegelung ist dunkelgrau, nicht Metall), Oracle-Helm und Lynx.
  // Palette und Tönung der Schicht wirken multipliziert (Oracle-Helm,
  // Lynx: im Spiel dunkelgrau, mit der Palette allein weiß).
  'Färbeart 0': m(J, null, 'Waffenstoff: Farbe aus Palette mal Tönung, Spiegelung aus der Palette'),
  'Färbeart 1': m(J, null, 'Lack, Stoff, Gummi: Palette mal Tönung färbt die Grundfarbe, die Spiegelung bleibt die der Schicht'),
  'Färbeart 2': m(J, null, 'Metall: Palette mal Tönung färbt die Spiegelung'),
  'Palettenplatz 1': m(J, null, 'Palette, Eintrag A'),
  'Palettenplatz 2': m(J, null, 'Palette, Eintrag B'),
  'Palettenplatz 3': m(J, null, 'Palette, Eintrag C'),
  // Das Item nennt keine Palette. Die DefaultPalette des Materials gilt im
  // Spiel nicht (Monolith „Shadowflux“ wäre oliv, ist grau-blau; bei Morozov
  // „Iceflow“ zeigt sie auf einen Record, den es nicht gibt).
  'Palettenplatz ohne Palette': m(N, null, 'Item ohne Palette: die Schicht behält ihre eigene Tönung'),
  // Anbauteil (Serienmagazin) ohne eigene Palette: es trägt die der Waffe,
  // wie der Hauptteil. Nicht gegen Spielbilder geprüft, daher Näherung.
  'Palette vom Träger': m(N, null, 'Anbauteil ohne eigene Palette trägt die Palette der Waffe'),
  // Ausführungen eines Netzes (SubGeometry mit Tag, eigener Farbe oder
  // eigenem Material) werden über das Ende des Record-Namens gewählt.
  'Ausführung nicht gefunden': m(F, null, 'das Netz hat Ausführungen, keine passt zum Record: das Modell zeigte die Grundausführung'),
  // Detailstufe: Stufe 1, außer sie behält weniger als ein Viertel der
  // Dreiecke (Schachfiguren hatten dort 18 Dreiecke).
  'Stufe 1 zu grob': m(J, null, 'Stufe 0 gebacken, Stufe 1 war nur ein Klotz'),
  // Darstellung: beide Handschuhe nebeneinander statt in Armhaltung, sonst
  // sind sie im Bild zwei Punkte. Form und Material unverändert.
  'Handschuhe nebeneinander': m(J, null, 'beide Handschuhe zur Mitte gerückt'),
  // Teil einer .cga an einem Knoten, dessen Vorfahren gestellt sind: Lage über
  // die ganze Kette (bis 27.11.2026 nur gegen den Elternknoten, der Sack der
  // Erz-Kapseln hing quer neben dem Gehäuse).
  Knotenkette: m(J, null, 'Teil an verschachteltem Knoten: Lage über die Kette der Elternknoten'),
};

// Benannte Ausnahmen: ein Merkmal, das unter einer Bedingung anders gilt.
// Der Schlüssel ist „<Merkmal> | <Bedingung>“; das Tor verlangt, dass jede
// Ausnahme noch an mindestens einem Item hängt (sonst ist sie tot).
export const AUSNAHMEN = {
  // Waffen-Aufdrucke aus objects/fps_weapons/textures/decal_uv2/: auch dort
  // fehlt die 2. UV, aber auf der 1. UV sitzen sie (Prism Irradiated,
  // Valakkar-Motiv gegen das Spielbild geprüft, 23.11.2026).
  'LayerBlend_V2 %DECALS | Waffe decal_uv2': m(J, null, 'Waffen-Aufdruck auf der 1. UV, gegen Spielbilder geprüft'),
  'LayerBlend_V2 TexSlot9 | Waffe decal_uv2': m(J, 'aufdruck', 'Waffen-Aufdruck auf der 1. UV, gegen Spielbilder geprüft'),
};
// Gilt die Ausnahme „Waffe decal_uv2“? (Bäcker und Tabelle fragen dasselbe)
export const aufdruckAufUv1 = ({ waffe, datei }) => !!waffe && /(^|[\\/])decal_uv2[\\/]/i.test(String(datei ?? ''));

// Rolle eines Bildplatzes, oder null (Shader oder Platz unbekannt)
export function rolleVon(shader, platz) {
  return SHADER[shader]?.plaetze?.[platz]?.rolle ?? null;
}

// Ein Merkmal (Schlüssel, wie der Bäcker ihn meldet) einordnen.
//   'Shader <S>' | '<S> %<SCHALTER>' | '<S> TexSlotN' | '<S> Wert <W>'
//   '<S> TexMod <Art>' | 'Format <f>' | 'Bau <Befund>' | '<…> | <Bedingung>'
// -> { art, grund }; art 'unbekannt', wenn die Tabelle es nicht kennt.
export function einordnen(schluessel) {
  const unb = { art: 'unbekannt', grund: null };
  const k = String(schluessel);
  // nur eigene Einträge: Namen aus den Spieldaten wie „constructor“ dürfen
  // nichts vom Objekt-Prototyp erben (sonst art undefined, und nichts hielte an)
  const von = (tab, n) => (tab && Object.hasOwn(tab, n) ? tab[n] : undefined);
  if (k.includes(' | ')) {
    const a = von(AUSNAHMEN, k);
    return a ? { art: a.art, grund: a.grund } : unb;
  }
  let t;
  if ((t = /^Format (\S+)$/.exec(k))) { const e = von(BILDFORMATE, t[1]); return e ? { art: e.art, grund: e.grund } : unb; }
  if ((t = /^Bau (.+)$/.exec(k))) { const e = von(BAU, t[1]); return e ? { art: e.art, grund: e.grund } : unb; }
  if ((t = /^Shader (\S+)$/.exec(k))) { const S = von(SHADER, t[1]); return S ? { art: S.art, grund: S.grund ?? null } : unb; }
  if (!(t = /^(\S+) (.+)$/.exec(k))) return unb;
  const S = von(SHADER, t[1]);
  if (!S) return unb;
  const rest = t[2];
  let e;
  if (rest.startsWith('%')) e = von(S.schalter, rest.slice(1));
  else if (/^TexSlot\d+$/.test(rest)) e = von(S.plaetze, rest);
  else if (rest.startsWith('Wert ')) e = von(WERTE, rest.slice(5));
  else if (rest.startsWith('TexMod ')) e = von(TEXMOD, rest.slice(7));
  else return unb;
  // Ganz genäherte Shader: was sie nicht einzeln führen, ist mitgenähert
  // (bzw. „ohne“ bei NoDraw); nur bei Shadern, die gebacken werden, ist ein
  // fehlender Eintrag unbekannt.
  if (!e) return S.art === J ? unb : { art: S.art, grund: S.grund ?? null };
  return { art: e.art, grund: e.grund };
}

// Hält diese Merkmalsliste ein Item an?
export const haelt = (schluessel) => schluessel.some((k) => HALT.has(einordnen(k).art));
