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
/** Eine Zeile Kennwert: Bezeichnung, Wert, wahlweise mit Seite. */
export type Wert = { k: string; v: string; h?: string | null };
/** Aussagen, die nur eine Quelle macht (keine eigenen Werte): eine kurze Liste unter einem Link. */
export type AusQuelle = { titel: Satz; punkte: Satz[] };
/** Der eine ruhige Herkunftsvermerk eines Datenblocks. */
export type Stempel = Satz;

export type Bild = {
  /** Pfad ohne Breite und Endung, z. B. /assets/patch-4-10-3/rsi/rsi-galaxy */
  basis: string;
  breiten: number[];
  avif: boolean;
  alt: string;
};

export type NeuesSchiff = { id: string; name: Verweis; hersteller: string; bild: Bild; text: Satz[]; reiter: { id: string; titel: string; werte: Wert[] }[]; stempel: Stempel };
export type KaufbarKarte = { name: Verweis; rolle: string; bild: Bild; laeden: string[]; preis: string };
export type BestandZeile = { name: Verweis; werte: Wert[] };
export type ListenZeile = { art: string; name: Verweis; werte: Wert[] };
export type Liste = { id: string; titel: string; zeilen: ListenZeile[]; nachsatz: Satz | null };

export type Abschnitt =
  /** Vollbild: offizieller Name, Patch und Datum, ein belegter Satz, die Patch Notes. */
  | { art: 'auftakt'; id: string; titel: string; unterzeile: string; satz: Satz; bild: Bild; notes: Beleg }
  /** Wortkapitel: ein grosses Wort im Hintergrund, davor die eine grosse Zahl der Seite. */
  | { art: 'wort'; id: string; wort: string; waffe: Verweis; zahl: string; was: string; traeger: string; werte: Wert[]; stempel: Stempel; notiz: Satz }
  /** Text neben einer ruhigen Liste. */
  | { art: 'liste'; id: string; titel: string; text: Satz[]; listeTitel: string; gruppen: { titel: string; eintraege: Verweis[] }[]; stempel: Stempel }
  /** Je Schiff ein Vollbild, darunter Kennwerte in Reitern. */
  | { art: 'schiffe'; id: string; titel: string; schiffe: NeuesSchiff[] }
  /** Text neben Bild. */
  | { art: 'bild-text'; id: string; titel: string; satz: Satz; bild: Bild; gruppen: { titel: string; eintraege: Verweis[] }[]; stempel: Stempel }
  /** Karten mit Bild, Laden und Preis. */
  | { art: 'karten'; id: string; titel: string; satz: Satz; karten: KaufbarKarte[]; stempel: Stempel }
  /** Ruhige Gruppen wie auf den Schiffsseiten, darunter die Aussagen aus den Patch Notes. */
  | { art: 'bestand'; id: string; titel: string; gruppen: { titel: string; zeilen: BestandZeile[] }[]; ausQuelle: AusQuelle; stempel: Stempel }
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
  const breiten = [640, 1200, 1920].filter((b) => existsSync(`.${basis}-${b}.webp`));
  if (!breiten.length) throw new Error(`chronik: Bild ${basis} fehlt`);
  return { basis, breiten, avif: existsSync(`.${basis}-1920.avif`), alt };
}

export const zahlText = (x: number, lang: Locale) => x.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
