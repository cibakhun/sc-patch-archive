/* AVIF-Fassungen ausgewählter Bilder (27.10.2026, Performance-Runde).

   Die Startseite lud am Telefon (1,6 Mbit/s) 840 KB Bilder, bevor das
   Titelbild stand: LCP 5,6 s. Dieselben Bilder als AVIF in derselben
   Auflösung wiegen gut die Hälfte (Titelbild 454 → 263 KB). Gezeigt wird
   über image-set(): wer AVIF kann, lädt AVIF, alle anderen das JPG wie
   bisher.

   Erzeugt von scripts/build-avif.mjs nach public/assets/avif/<name>.avif.
   avifSet() fragt die Datei beim Bauen ab und gibt ohne sie null zurück
   (astro dev ohne Build-Kette): Dann bleibt es beim JPG, ein Verweis ins
   Leere entsteht nie — image-set() fiele bei einer fehlenden Datei NICHT
   auf den nächsten Kandidaten zurück, das Bild bliebe leer.

   Kandidaten als Zeichenkette, nicht als url(): Das Bild ist einmal zu
   sehen, nicht zweimal (Media-Wiederholung in audit-site zählt url()). */
import { existsSync } from 'node:fs';

// Dateinamen unter assets/ (kanonisch, siehe _sync-assets.mjs)
export const AVIF_BILDER = [
  't-polaris-5.jpg',      // Titelbild der Startseite
  'trailer-4-0-0.jpg',    // Kacheln der Startseite
  't-perseus-1.jpg',
  't-tsg-4.jpg',
  't-align-1.jpg',
  'img-refinery.jpg',
  't-craft-1.jpg',
  'img-railen.jpg',
  'cz-loot.jpg',
  't-mesh-1.jpg',
];
// q62 bei effort 4: 41–44 dB gegenüber dem JPG, ein Drittel bis zwei
// Drittel kleiner (gemessen an allen zehn Bildern)
export const AVIF_QUALITAET = 62;
export const AVIF_AUFWAND = 4;

/** /assets/x.jpg → /assets/avif/x.avif */
export const avifHref = (href) => `/assets/avif/${href.split('/').pop().replace(/\.[^.]+$/, '')}.avif`;

/** Pfad der AVIF-Fassung, wenn sie gebaut ist, sonst null */
export function avifDa(href) {
  const a = avifHref(href);
  return existsSync(`public${a}`) ? a : null;
}

/** image-set() aus AVIF und Original, oder null ohne AVIF-Fassung */
export function avifSet(href) {
  const a = avifDa(href);
  return a ? `image-set("${a}" type("image/avif"),"${href}" type("image/jpeg"))` : null;
}
