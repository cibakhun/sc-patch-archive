// HTML-Maskierung fuer Text, der in ein innerHTML-Template geht — fuer
// Elementinhalt UND fuer Attributwerte, egal ob in doppelten oder einfachen
// Anfuehrungszeichen. Deshalb alle fuenf Zeichen, auch der Apostroph.
//
// Eine Wahrheit fuer die gebuendelten Skripte (src/). Die klassischen Skripte
// unter assets/ und die is:inline-Skripte der Patchseiten koennen nichts
// importieren; sie tragen je eine Kopie mit demselben Zeichensatz, und
// verify:script-json haelt alle Kopien auf diesem Stand.
//
// Wo kein Markup gebraucht wird, ist textContent/append die bessere Wahl
// (siehe RefineryDashboard.astro) — dort gibt es nichts zu maskieren.
const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
