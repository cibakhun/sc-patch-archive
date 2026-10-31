/* Traegt die Sichturteile des Auflösungs-Durchgangs vom 31.08.2026 nach
   und schliesst id 62, weil der Betreiber sie entschieden hat.          */
import { readFileSync, writeFileSync } from 'node:fs';
const P = '.planning/WINDOWS.md';
const roh = readFileSync(P, 'utf8');
const m = roh.match(/```(?:json)?\r?\n([\s\S]*?)```/);
const arr = JSON.parse(m[1]);
const jetzt = '2026-08-31T15:10:00.000Z';

const e62 = arr.find((x) => x.id === 62);
if (e62 && e62.status === 'open') {
  e62.status = 'fixed';
  e62.reason = 'Betreiber hat die Erstbesuch-Hilfe am 31.08.2026 ausdruecklich als eine von vier Baustellen benannt. Umgesetzt in assets/tool-help.js: openOnFirstVisit steigt unterhalb von 700px Fensterhoehe aus (MIN_HOEHE_FUER_AUTO). Bewusst OHNE die Seite als gesehen zu markieren -- wer die Seite spaeter an einem hohen Fenster oeffnet, bekommt die Hilfe dort noch einmal angeboten. Auf dem Telefon (390x844) bleibt sie wie bisher aufgeklappt, dort war der Effekt vertretbar.';
  e62.resolved_at = jetzt;
}

const neu = [
  {
    id: 63,
    kind: 'unrun-verify',
    phase: 'aufloesung',
    file: 'src/components/ships/ShipsOverview.astro',
    line: null,
    description: 'Gestaltungsurteil offen (Auflösungs-Durchgang 31.08.2026): auf sehr breiten Schirmen bleibt viel Flaeche ungenutzt. Gemessen bei 2560x1440 auf /schiffe.html: die Inhaltsspalte ist auf rund 1060px begrenzt und zentriert, links und rechts stehen je rund 470px leer; das Kartenraster zeigt vier Spalten, obwohl der Platz fuer sechs reicht. Das ist KEIN Fehler -- eine Hoechstbreite ist eine Lesbarkeitsentscheidung, und Zeilen ueber 1100px sind schwer zu verfolgen. Ob die KARTEN (die keine Fliesstextzeilen sind) diese Grenze mitmachen muessen, ist ein Gestaltungsurteil und wurde deshalb nicht selbst entschieden. Betrifft gleichermassen /crafting, /items, /missionen. Messwerkzeug: .planning/sketches/tools/aufloesungsbogen.mjs mit dem Satz "breit".',
    status: 'open',
    reason: '',
    recorded_at: jetzt,
    resolved_at: null,
  },
  {
    id: 64,
    kind: 'unrun-verify',
    phase: 'aufloesung',
    file: 'src/components/ships/ShipsOverview.astro',
    line: null,
    description: 'Sichturteil offen (Auflösungs-Durchgang 31.08.2026): zwei Textstellen werden auf schmalen Geraeten weiterhin mit Ellipse gekappt, und zwar bewusst -- gemessen mit .planning/sketches/tools/mess-ellipse.mjs, das nur meldet, wo die Ellipse WIRKLICH greift. (a) .fcard__sig auf drei Schiffskarten bei 360px: "IR Signature 0.75 - EM Sig..." fehlen 18-19px, eine technische Zusatzzeile. (b) .wb__ghd__g in der Mining-Werkbank bei 360px: "ROC - ROC-DS - no tier" fehlen 40px, die Geraeteliste in Kurzform. Beide sind Aufzaehlungen ohne feste Laenge; ein Umbruch wuerde die Karte bzw. die Kopfzeile hoeher machen. Die vergleichbaren Faelle mit fester, kurzer Beschriftung (.dp-key b auf 13.872 Seiten, .wb__lbl im Fracturing-Verweis) sind in diesem Durchgang auf Umbruch umgestellt worden. Ob diese beiden nachziehen sollen, haengt davon ab, wie wichtig die vollstaendige Angabe ist -- eine Produktentscheidung.',
    status: 'open',
    reason: '',
    recorded_at: jetzt,
    resolved_at: null,
  },
];
for (const n of neu) if (!arr.some((x) => x.id === n.id)) arr.push(n);

const text = JSON.stringify(arr, null, 2);
writeFileSync(P, roh.replace(m[1], text + '\n'), 'utf8');
console.log('Eintraege jetzt: ' + arr.length + '   offene: ' + arr.filter((x) => x.status === 'open').length);
