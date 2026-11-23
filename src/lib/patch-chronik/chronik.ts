/* ============================================================
   chronik.ts — die Form einer Patch-Chronik: eine Folge von Abschnitten,
   jeder mit eigenem Aufbau (src/components/patch-chronik/Chronik.astro).
   Ein Patch liefert sein Inhaltsmodul (src/lib/patch-chronik/<patch>.ts);
   dort stehen alle Texte fertig in der Sprache der Seite und alle Links
   schon mit Sprachpraefix, die Komponenten setzen nur noch zusammen.

   Zahlen tippt kein Inhaltsmodul ab: zahlAusVergleich() liest sie aus dem
   Datenvergleich. Fehlt ein Wert, reisst der Bau.

   Nur fuer den Seitenbau (Frontmatter).
   ============================================================ */
import { existsSync } from 'node:fs';
import type { Locale } from '../../i18n/ui';
import type { PatchVergleich, Wert as VergleichsWert } from '../patchVergleich';

/** Ein Link mit Text; h ist fertig (Sprachpraefix oder absolute Adresse). */
export type Beleg = { t: string; h: string };
/** Text, der verlinkt, wenn es eine Seite gibt. */
export type Verweis = { t: string; h: string | null };
/** Ein Satz aus Text und Links; Leerzeichen stehen im Text. */
export type Satz = (string | Beleg)[];
/** Eine Zeile Kennwert: Bezeichnung, Wert, wahlweise mit Seite; bei einer Zahl vorher und nachher zwei Balken wie auf den Schiffsseiten (max = groesster Wert der Gruppe). */
export type Wert = { k: string; v: string; h?: string | null; balken?: { vorher: number; nachher: number; max: number } };
/** Der eine ruhige Herkunftsvermerk eines Datenblocks. */
export type Stempel = Satz;

export type Bild = {
  /** Die Dateien eines Bildes, nach Breite aufsteigend. */
  quellen: { w: number; src: string }[];
  /** Die grosse Fassung als AVIF, wenn es sie gibt. */
  avif: string | null;
  alt: string;
};

export type NeuesSchiff = {
  id: string; name: Verweis; hersteller: string; bild: Bild; text: Satz[]; reiter: { id: string; titel: string; werte: Wert[] }[]; stempel: Stempel;
  /** Austauschbare Module, je eines mit Seite, Werten und dem, was es kann; dazu ein zweites Bild ueber die volle Breite. */
  module: { titel: string; kacheln: Kachel[] } | null; zweitbild: Bild | null;
};
export type KaufbarKarte = { name: Verweis; rolle: string; bild: Bild; laeden: string[]; preis: string };
/** Eine Zeile im Bestand: alle Schiffe mit derselben Aenderung, dazu deren Werte. */
export type BestandZeile = { namen: Verweis[]; werte: Wert[] };
/** Eine Gruppe im Bestand; als Diagramm steht je Schiff eine Zeile mit Name, Wert und Balken. Die Notiz sagt, was nur eine Quelle traegt. */
export type BestandGruppe = { titel: string; diagramm: boolean; zeilen: BestandZeile[]; notiz: Satz | null };
/** Ein Schiff, an dessen Modell das geaenderte Teil rot ist: Modelldatei der Halle, Einbauorte im glTF-Raum und ihre Namen,
 *  das Modell des Bauteils, wenn es im Rumpf sitzt, das ruhende Bild aus demselben Blickwinkel. */
export type AmSchiff = { name: string; aenderung: string; modell: string; punkte: number[][]; hardpoints: string[]; bauteil: string | null; bild: Bild };
/** Eine Kachel: Name, wahlweise Bild mit Unterschrift, eine Zeile, Werte, Zeilen „Titel: Eintraege“ und ein Satz. */
export type Kachel = { titel: Verweis; bild: Bild | null; unterschrift: Satz | null; zeile: string; werte: Wert[]; liste: { titel: Verweis; eintraege: Verweis[] }[]; satz: Satz | null; breit: boolean };
export type ListenZeile = { art: string; name: Verweis; werte: Wert[] };
export type Liste = { id: string; titel: string; zeilen: ListenZeile[]; nachsatz: Satz | null };

export type Abschnitt =
  /** Vollbild: offizieller Name, Patch und Datum, ein belegter Satz, die Patch Notes. */
  | { art: 'auftakt'; id: string; titel: string; unterzeile: string; satz: Satz; bild: Bild; notes: Beleg }
  /** Wortkapitel: ein grosses Wort im Hintergrund, davor die eine grosse Zahl der Seite. */
  | { art: 'wort'; id: string; bild: Bild; wort: string; waffe: Verweis; zahl: { vorher: string | null; wert: string }; was: string; traeger: string; werte: Wert[]; stempel: Stempel; notiz: Satz }
  /** Rangleiter: ein Bildband, dann alle Raenge der Reihe nach, je Rang die Auftraege, die er neu freischaltet. */
  | { art: 'leiter'; id: string; titel: string; text: Satz[]; bild: Bild; bildSatz: Satz; leiterTitel: string; stufen: { rang: string; eintraege: Verweis[] }[]; stempel: Stempel }
  /** Kacheln: je Ding ein Name mit Seite, seine Werte, eine kurze Liste, wahlweise ein Satz; breite Kacheln ueber zwei Spalten. */
  | { art: 'raster'; id: string; titel: string; satz: Satz | null; kacheln: Kachel[]; stempel: Stempel }
  /** Je Schiff ein Vollbild, darunter Kennwerte in Reitern. */
  | { art: 'schiffe'; id: string; titel: string; schiffe: NeuesSchiff[] }
  /** Halle: Bildtafeln ueber die volle Breite, auf breiten Schirmen seitlich durchlaufen, sonst untereinander. */
  | { art: 'halle'; id: string; titel: string; satz: Satz; tafeln: { bild: Bild; listen: { titel: string; eintraege: Verweis[] }[] }[]; stempel: Stempel }
  /** Karten mit Bild, Laden und Preis. */
  | { art: 'karten'; id: string; titel: string; satz: Satz; karten: KaufbarKarte[]; stempel: Stempel }
  /** Das Modell mit dem geaenderten Teil, darunter knappe Gruppen gleicher Aenderungen. */
  | { art: 'bestand'; id: string; titel: string; amSchiff: { los: string; hinweis: string; schiffe: AmSchiff[] }; gruppen: BestandGruppe[]; stempel: Stempel }
  /** Alle Aenderungen in Reitern. */
  | { art: 'reiter'; id: string; titel: string; listen: Liste[]; stempel: Stempel; weiter: Beleg[] };

export type Chronik = {
  lang: Locale;
  version: string;
  abschnitte: Abschnitt[];
};

/* ---------- Zahlen aus den Daten ---------- */

const zuZahl = (w: VergleichsWert | undefined, wo: string): number => {
  if (typeof w !== 'number') throw new Error(`chronik: ${wo} ist keine Zahl (${JSON.stringify(w)})`);
  return w;
};

/** Ein Feld eines Eintrags im Vergleich (Slug oder id): vorher und nachher, oder nur der Wert, wenn der Eintrag neu ist. */
export function zahlAusVergleich(v: PatchVergleich, kind: 'ship' | 'item', slug: string, feld: string): { vorher: number | null; wert: number } {
  const e = v.eintraege.find((x) => x.kind === kind && (('slug' in x && x.slug === slug) || x.id === slug));
  const wo = `${v.nach.version} ${kind} ${slug}.${feld}`;
  if (!e) throw new Error(`chronik: ${wo} fehlt im Vergleich`);
  if (e.change === 'new' && 'werte' in e) return { vorher: null, wert: zuZahl(e.werte.find((x) => x.feld === feld)?.wert, wo) };
  if ((e.change === 'changed' || e.change === 'renamed') && 'felder' in e) {
    const f = e.felder.find((x) => x.feld === feld);
    if (!f) throw new Error(`chronik: ${wo} hat sich nicht geaendert`);
    return { vorher: zuZahl(f.vorher, wo), wert: zuZahl(f.nachher, wo) };
  }
  throw new Error(`chronik: ${wo} ist ${e.change}`);
}

/* ---------- Bilder ---------- */

/** Ein Bild unter assets/, in den Breiten, die es dort gibt (<basis>-<breite>.webp). */
export function bild(basis: string, alt: string): Bild {
  const quellen = [640, 1200, 1920].filter((w) => existsSync(`.${basis}-${w}.webp`)).map((w) => ({ w, src: `${basis}-${w}.webp` }));
  if (!quellen.length) throw new Error(`chronik: Bild ${basis} fehlt`);
  return { quellen, avif: existsSync(`.${basis}-1920.avif`) ? `${basis}-1920.avif` : null, alt };
}

/** Ein Bild mit fest benannten Dateien (Renders: <id>.webp und <id>-640.webp). */
export function bildAus(groessen: { w: number; src: string }[], alt: string): Bild {
  const quellen = [...groessen].sort((a, b) => a.w - b.w);
  for (const q of quellen) if (!existsSync(`.${q.src}`)) throw new Error(`chronik: Bild ${q.src} fehlt`);
  if (!quellen.length) throw new Error('chronik: Bild ohne Dateien');
  return { quellen, avif: null, alt };
}

export const zahlText = (x: number, lang: Locale) => x.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
