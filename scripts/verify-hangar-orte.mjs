/* ============================================================
   verify-hangar-orte.mjs — Tor fuer die Orte der Halle und das Terminal
   im Leitstand (Schiene A, nur mit Hangar).

   WARUM ES DEN GIBT: Seit dem 13.11.2026 nennt die Leiste am Buehnenfuss
   des Hangars drei Orte (Schiffsfeld, Werkhalle, Leitstand), und im
   Leitstand zeigt ein Terminal die Seiten der Website in einem Fenster,
   das genau auf dem Schirm der Halle liegt (Krisz: „da oben ist ein menü
   wo man so hin und her switchen kann ohne seite nezuladen“). Vier Teile
   haengen dafuer nur ueber Namen und Zahlen zusammen: das Markup der
   Seite (HangarPage.astro), der Controller (hangar-overview.js), das
   Terminal (hangar-terminal.js) und die Buehne (hangar-viewer.js). Reisst
   eine Stelle, faehrt die Kamera vor einen leeren Schirm, liegt das
   Fenster neben dem Schirm, fuehrt ein Reiter ins Leere oder laedt das
   Fenster eine zweite Halle — und jede Aufnahme des Schiffsfelds sieht
   trotzdem gut aus.

   Dieses Tor liest das ARTEFAKT: dist/hangar.html und dist/de/hangar.html,
   die ausgelieferten Module unter dist/assets/ (in Node geladen, ihre
   reinen Funktionen gerufen) und die Rahmen-Dateien unter dist/_csp/.

   ZUSICHERUNGEN
     [1] Leiste: beide Hangarseiten tragen in #hgx-st vor den Stationen
         die Gruppe #hgx-orte, anfangs verborgen, mit genau den Orten
         halle, werk, leit in dieser Folge, jeder beschriftet; dazu die
         beiden Ansagen fuer Vorleser.
     [2] Terminal im Markup: #hgx-term anfangs verborgen, sein Modul als
         versionierte URL, deren Version der Inhalt der ausgelieferten
         Datei ist; ein Fenster OHNE Adresse (die Halle laedt keine zweite
         Seite, solange niemand im Leitstand steht) mit Namen und Titel;
         Zurueck-Pfeil, Suche, „eigener Tab“ und der Text fuer den Fall,
         dass sich die Seite nicht rahmen laesst. Dazu die Anmeldung
         (seit 14.11.2026): die Blende #hgx-term-login, anfangs verborgen,
         mit Marke, Schritt, Namen und allen Worten in der Sprache der
         Seite, und in der Leiste #hgx-term-who mit beiden Zielen (Konto,
         Anmeldung) in dist/, eigenem Tab und beiden Namen fuer Vorleser.
         Seit der zweiten Runde (14.11.2026) dazu: die Leinwand fuer das
         Sperrbild, die Karte mit Gruss und Faktenzeilen samt ihren
         Worten ({n} in der Mehrzahl der Flotte), die Wortmarke als
         Schrift fuer den Fall ohne Bild, der Hinweis auf den Klick und
         die beiden Kantenlinien der Blende.
         Seit der dritten Runde (15.11.2026, Krisz: „konto seite direkt
         auf das bildschirm einbauen“, „wenn kein konto angemeldet ist
         soll man da direkt registrieren können und gleich anmelden
         können“): Der Knopf des Kontos zielt ins Fenster statt in einen
         eigenen Tab. Die Blende ist nicht mehr als Ganzes fuer Vorleser
         verborgen, sondern jedes ihrer Schaustuecke einzeln; die Zeile
         des Schritts hat zwei Lagen, die ineinander blenden; unter der
         Karte stehen die drei Wege des Gasts (#hgx-term-lwahl): Anmelden
         und Konto erstellen als Links ins Fenster auf Seiten, die in
         dist/ liegen, „Als Gast weiter“ als Knopf.
     [3] Reiter: mindestens MIN_BEREICHE je Seite, Schluessel einmalig,
         jeder zielt ins Fenster, fuehrt auf eine Seite, die in dist/
         liegt, in der Sprache der Hangarseite, bleibt im Fenster
         (termRoute) und markiert sich selbst (termTool mit seinen
         Pfad-Anfaengen); data-home nennt einen von ihnen.
     [4] Reine Funktionen des ausgelieferten Terminals: Der Kasten deckt
         das Rechteck des Schirms (Breite mal Massstab), steht in voller
         Breite, solange der Massstab TERM_MIN_K haelt, darunter schmaler
         und nie in der Telefonansicht; Links zum Hangar und nach
         draussen verlassen das Fenster, Seiten der Website bleiben (seit
         der dritten Runde auch das Konto); das
         Stilblatt fuer die Seite im Fenster nimmt Kopfzeile und
         Vorschau-Marke heraus. termIdent macht aus der Profilzeile des
         Kontos, wer vor dem Terminal sitzt, und laesst nichts durch, was
         nicht in Stil oder Adresse gehoert; die Anmeldung dauert vier
         bis sechseinhalb Sekunden und kennt keine kurze Fassung mehr
         (TERM_LOGIN, dritte Runde). termFakten macht aus dem, was die Seite weiss
         (Flotte, Schiff auf dem Feld, Beitritt, Halle), hoechstens drei
         Zeilen der Karte, in den Worten und der Zahlschreibung der
         Seite; leitWerVon laesst aufs Glas der Halle nur Namen, Zeichen
         und eine Farbe #rrggbb; leitFenster zeichnet das Sperrbild in
         jedes Fenster, ohne ueber dessen Rand zu gehen, mit Uhr und
         Sitzung, wenn es sie bekommt (gezeichnet auf eine mitschreibende
         Leinwand).
         Dritte Runde: termKonto und termAnmeldung erkennen die Seiten
         des Kontos und die beiden, auf denen eine Sitzung entsteht;
         termGruss gruesst nur ein eben entstandenes Konto mit
         „Willkommen“; termBlende zeigt die Blende einmal je Sitzung und
         Konto. Das Stilblatt legt Anmelden und Registrieren in die
         Breite des Schirms (zwei zu eins, etwa 550 px hoch), geprueft
         gegen das Markup der ausgelieferten Kontoseiten: Ein Muster, das
         dort nichts mehr traefe, reisst.
     [5] Geometrie der Buehne: Fuer viele Fenstergroessen und freie
         Rechtecke steht die Kamera aus leitFit so, dass das Fenster der
         Seite im Bild genau das gemeldete Rechteck ist (nachgerechnet mit
         der Zentralprojektion), im freien Stueck liegt, auf dem Glas des
         Monitors bleibt (HALL_LEIT.schirm ohne Saum; so hoch wie das
         Glas, solange der Bildwinkel nicht begrenzt), der Bildwinkel unter
         LEIT_FOV_MAX bleibt (auch in hohen, schmalen Fenstern, wo das
         Fenster dafuer in Metern kleiner wird) und die Kamera im Raum des
         Leitstands steht, suedlich des Pults
         (HALL_LEIT.raum, mit Abstand zu Glas, Wand, Boden und Decke);
         beide Enden des erlaubten Abstands (HALL_LEIT.d) liegen im Raum.
         Seit der Large-Halle (14.11.2026) sieht nicht mehr jeder Monitor
         nach Sueden: Die Kamera steht auf der Blickachse seines Glases
         (leitAchsen aus schirm.dreh und schirm.neig), und dort wird
         gerechnet. Wo etwas im Raum steht (HALL_LEIT.voll: Pult,
         Stuehle), geraet sie nie hinein, auch nicht an den Enden von d.
     [6] Naht: Die Buehne liefert place, canPlace und onPlace, der
         Controller ruft sie und laedt das Terminal ueber data-js; der
         Zustand ?ort=leit ueberlebt die Adresse, steht nicht im geteilten
         Link und gilt nicht fuer Bodenfahrzeuge.
         Die Buehne setzt das Modell der Halle mit hallOrigin
         (loadRealHall): Damit rechnet [8].
         Sperrbild (zweite Runde): Monitor und Blende zeichnen beide mit
         leitFenster, das Terminal meldet der Buehne die Sitzung
         (setTerminal) und fragt die Seite nach den Fakten der Karte; im
         Stil der Seite oeffnet sich die Blende ueber eine einzige Zahl
         (--hgx-auf, als Prozentwert angemeldet) in der Zeit, nach der das
         Modul sie wegnimmt (TERM_LOGIN.aus), und die Wortmarke als Schrift
         steht, wo sie das Bild zeigt (LEIT_WORT).
         Dritte Runde: Das Terminal kennzeichnet die Seite im Fenster
         (data-vb-terminal), fragt beim Hinsetzen termBlende, merkt sich
         die Begruessung in der Sitzung, haelt sie zurueck, solange die
         Anmeldeseite offen steht (darunter fragt die Seite nach dem
         zweiten Faktor), faehrt die Blende ueber einer offenen Seite
         erst zu (Schritt „zu“) und laesst sie beim Gast stehen. Im Stil
         sind die drei Wege nur beim Gast zu sehen und zu erreichen. Die
         ausgelieferten Skripte der Kontoseiten lesen das Kennzeichen und
         oeffnen fuer Discord ein kleines Fenster, das die Halle nicht
         steuern kann (opener).
     [7] Rahmen: Dieser Bau erlaubt der eigenen Seite das Rahmen
         (dist/_csp/, scripts/lib/rahmen.mjs). Sonst bliebe der Schirm
         leer; audit:csp prueft dieselben Dateien in beide Richtungen.
     [8] Monitor im Modell (seit 14.11.2026): Das Terminal liegt auf dem
         Glas eines Monitors, den das Spiel in den Raum gestellt hat
         (Krisz: „dass unser bildschirmscreen wirklich auf einem
         bildschirm drauf ist der in den control raum sitzt“). In der
         Halle von Revel & York ist es der mittlere am Pult, in den
         Hallen fester Groesse (hg-stage, halls) ein Bildschirm im Modell
         der Halle selbst (HALL_LEIT.schirm.mat nennt das Material seines
         Glases; dann ohne bank): Dort misst das Tor das Glas in den
         Achsen des Monitors nach (gedreht, geneigt). Eine Halle aus
         HALL_LEIT, die der Bau nicht ausliefert, nennt es beim Namen,
         statt zu reissen; dass keine verloren geht, haelt die Klinke.
         Die ausgelieferte Einrichtung der Halle
         (die Datei, die die Seite der Buehne nennt: hg-stage,
         opts.hall.furniture) traegt die Monitore des Pults in der
         Groesse und an der Stelle, die HALL_LEIT.bank nennt, und darin
         eine nach Sueden gewandte Glasflaeche genau dort, wo
         HALL_LEIT.schirm sie nennt. Die Stelle ist absolut gemeint: Der
         Ursprung der Halle im Modell kommt aus der Buehne (hallOrigin:
         Raum, Schiffsfeld, Bodenhoehe aus hg-stage), nicht aus den
         Monitoren selbst. Sonst schwebte das Bild neben dem Monitor,
         oder es staenden wieder zwei Schirme hintereinander. Nicht
         nachgerechnet: was die Buehne nach dem Laden noch bewegt
         (Feldmitte, Zuwachs der Halle); das Pult steht ausserhalb der
         Streifen der Feldmitte, und der Zuwachs traegt Monitor und Bild
         gemeinsam (leitAt). Die Marke der Blende
         (CSS der Seite) steht, wo der Monitor sie in Ruhe zeigt
         (LEIT_MARKE).

   Selbstauskunft mit Klinken (nur nach oben; nach unten nur per Commit
   mit Ursache). Kein git, kein Netz, kein Kindprozess.

   VORGEFUEHRT ROT (13.11.2026), je ein Eingriff am gebauten dist/,
   dreizehn Laeufe:
     a  dist/de/hangar.html: dem Fenster src="/de/archiv.html" gegeben;
        den Reiter Missionen auf /de/missionen-alt.html gebogen;
        data-ort="werk" gestrichen
     b  dist/assets/hangar-terminal.js: TERM_MIN_W auf 0; TERM_MIN_K auf
        0.5; termFrame ohne die schmale Stufe; in termRoute die Zeile fuer
        /hangar.html entfernt; in TERM_CSS die Kopfzeile (#topbar)
        gestrichen
     c  dist/assets/hangar-viewer.js: in leitFit das Vorzeichen von dx
        gedreht; die Klemme auf LEIT_LUFT ausgeschaltet; d auf [2.3, 12]
        geweitet. Der letzte Eingriff blieb im ersten Lauf GRUEN: das
        Raster erreicht das ferne Ende des Abstands nicht. Seither prueft
        [5] beide Enden von d selbst gegen den Raum. Nach dem Review der
        PR (hohe, schmale Fenster): das Schrumpfen des Schirms am
        begrenzten Bildwinkel gestrichen.
     d  dist/_csp/frame-ancestors.conf auf 'none' gestellt
   Die Meldungen stehen in der PR, die dieses Tor eingefuehrt hat.

   VORGEFUEHRT ROT (14.11.2026, Terminal auf dem Monitor und Anmeldung),
   je ein Eingriff am gebauten dist/:
     e  dist/de/hangar.html: der Blende das hidden genommen; data-l-gast
        geleert; dem Link der Leiste data-dash auf /de/konto.html gebogen
        (im ersten Lauf GRUEN: der Eingriff traf das data-dash der
        Kopfzeile der Seite, nicht das des Terminals; am richtigen Link
        rot), dann auf /de/schiffe.html (eine Seite, die im Fenster
        bliebe); in data-a-user das {name} gestrichen
     f  dist/assets/hangar-terminal.js: in termIdent die Pruefung auf
        https gestrichen; TERM_LOGIN.hold auf 6000
     g  dist/assets/hangar-viewer.js: HALL_LEIT.schirm.z auf 58.5 (der
        alte Schirm vor dem Pult); schirm.b auf 3.4; in leitFit den Saum
        gestrichen; LEIT_MARKE.y auf 0.5
     h  Nach dem Review der PR (#365): [8] leitete den Ursprung der Halle
        aus der Mitte der Monitore ab und mass das Glas damit nur gegen
        das Pult. Vorher GRUEN, seither rot: dist/assets/hangar-viewer.js
        HALL_SHIFT.field 4 → 0 (Halle 4 m weiter in x); beide Seiten
        floor 1 → 2 (Halle 1 m tiefer). Dazu: bank und schirm gemeinsam
        um 1 m in x versetzt; in loadRealHall die Hoehe wieder aus
        h.floor gesetzt ([6]); floor nur in dist/de/hangar.html auf 2;
        die Halle der Seiten umbenannt; floor aus hg-stage gestrichen
   Die Meldungen stehen in der PR dieses Umbaus.

   VORGEFUEHRT ROT (14.11.2026, zweite Runde: Sperrbild, Karte, Blende),
   45 Eingriffe am gebauten dist/, jeder fuer sich, alle rot:
     i  dist/de/hangar.html ([2]): data-f-seit geleert; {n} aus
        data-f-schiffn; die Leinwand umbenannt; Wortmarke als Schrift
        und Hinweis auf den Klick geleert; die untere Kantenlinie
        entfernt; die Liste der Fakten umbenannt
     j  dist/assets/hangar-terminal.js ([4] termFakten, TERM_LOGIN): ein
        Beitritt vor 2024 und einer in der Zukunft zugelassen; Namen 80
        statt 48 Zeichen; jede Zahl als Anzahl; die Anzahl ohne
        Zahlschreibung; immer deutsche Schreibung; die Halle trotz
        Beitritt; wink 9000
     k  dist/assets/hangar-viewer.js ([4] leitWerVon, leitFenster): die
        Farbe ungeprueft; ein Name nur aus @ ohne Ersatzzeichen (wirft);
        Name 90 Zeichen; das Bild ohne Beschnitt; die Uhr immer, die Uhr
        nie; der Name der Sitzung ungekuerzt; die Marke in der Mitte der
        Hoehe; die Wortmarke tiefer; restore gestrichen; die Sitzung ohne
        Zeichen
     l  Stil ([6]): die Blende 0,5 s statt TERM_LOGIN.aus, umgekehrt aus
        auf 500; @property gestrichen; die Kantenlinie mit eigener Lage;
        der Ausschnitt mit einer festen Zahl (im ersten Lauf GRUEN: die
        Pruefung suchte nur irgendein var(--hgx-auf) im Ausschnitt; seither
        verlangt sie das ganze Vieleck); die Wortmarke als Schrift 6 cqw
        unter der Marke und mit anderer Sperrung
     m  Naht ([6]): leitDraw ohne leitFenster; setTerminal ohne
        leitWerVon; das Neuzeichnen zur Minute gestrichen; der Import der
        Buehne ohne catch; die Blende ueber die halbe Leinwand; der
        Controller ohne fakten und ohne wer; das Terminal ohne hooks.wer,
        hooks.bild, hooks.fakten
     n  Klinken: der englischen Seite ein Wort der Karte genommen (10
        Karten statt 20); leitFenster nicht mehr exportiert (0 Proben)
   Die Meldungen stehen in der PR der zweiten Runde.

   VORGEFUEHRT ROT (14.11.2026, Terminal der Large-Halle: gedrehter und
   geneigter Monitor im Modell der Halle), je ein Eingriff am gebauten
   dist/ (o: dist/assets/hangar-viewer.js, sieben Laeufe):
     o  HALL_LEIT.util-lrgtop: schirm.dreh gestrichen (der Monitor saehe
        nach Sueden, die Kamera stuende hinter der Rueckwand); neig auf
        -15 (sie stiege unter die Decke); voll bis z 101 und y 19.6
        gezogen (sie saesse im Stuhl); d auf [2, 7]; voll ohne z; dreh
        und neig gestrichen und den Raum geweitet (Klinke der gedrehten
        Monitore); in leitAchsen die dritte Achse verbogen
     p  Der Zweig von [8], der das Glas im Modell der Halle selbst
        nachmisst (schirm.mat), gegen das ausgelieferte Modell der
        Large-Halle, sechs Laeufe: schirm.x um 0,5 m versetzt („das Glas
        des Monitors reicht im Modell quer von -0.833 bis 1.833 …“);
        schirm.mat auf ein Material, das die Halle nicht traegt („kein
        Teil mit dem Material der Monitore“); schirm.b 10 cm breiter;
        neig 15 auf 0 („traegt die Halle kein um 180° gedrehtes, um 0°
        geneigtes Glas“); in beiden Seiten floor 2.501 auf 3.501 (die
        Halle stuende 1 m tiefer, kein Glas an der Stelle); in beiden
        Seiten die Halle der Stufe L umbenannt („nur 1 Halle(n) mit
        nachgemessenem Monitor, Klinke 2“; dieselbe Zeile steht in jedem
        der fuenf Laeufe davor)
   Die Meldungen stehen in der PR der Large-Halle.

   VORGEFUEHRT ROT (15.11.2026, dritte Runde: Kontoseiten im Bildschirm,
   Anmeldung einmal je Sitzung, drei Wege fuer Gaeste), 47 Eingriffe am
   gebauten dist/, jeder fuer sich, alle rot:
     q  dist/de/hangar.html ([2]): die Blende als Ganzes mit aria-hidden;
        die Zeile des Schritts nicht mehr stumm; ihre zweite Lage
        entfernt; den Weg „Konto erstellen“ entfernt; „Anmelden“ in einen
        eigenen Tab; „Konto erstellen“ auf eine Seite, die es nicht gibt;
        den Knopf des Kontos in einen eigenen Tab; „Anmelden“ woandershin
        als die Leiste; die Gruppe der Wege ohne Namen; der englischen
        Seite einen Weg genommen (5 Wege statt 6)
     r  dist/assets/hangar-terminal.js ([4] termRoute, TERM_LOGIN,
        termKonto, termAnmeldung, termGruss, termBlende): das Konto
        verlaesst das Fenster wieder; hold 600 und hold 5000; boot 100;
        die kurze Fassung wieder da; termKonto nimmt /accounting.html;
        termAnmeldung nimmt jede Adresse unter /account/ (im ersten Lauf
        nur ueber die Pruefsumme des Moduls rot: die Proben kannten
        /de/account/ nicht; seither steht die Adresse in den Proben,
        Klinke 36 → 37) und das Konto selbst; termGruss gruesst jeden wie
        neu und jeden wie einen alten Bekannten; termBlende kommt immer
        und kommt nie
     s  Stil der Kontoseiten ([4] TERM_CSS gegen die gebauten Seiten): das
        Bild im Kopf bleibt; die Felder der Registrierung mit 1fr 1fr; der
        Satz zum Datenschutz wieder unter dem Knopf; die Anmeldung in
        einer Spalte; der Discord-Knopf ohne Platz. Dazu drei Eingriffe an
        den Seiten selbst, nach denen der Stil ins Leere griffe: das
        Formular der Registrierung, die Trennlinie der Anmeldung und der
        Hinweis zum Namen umbenannt
     t  Naht und Stil ([6]): das Kennzeichen der Seite im Fenster
        gestrichen; das Hinsetzen fragt termBlende nicht; die Sitzung
        merkt sich die Begruessung nicht; die Begruessung wartet nicht auf
        die Anmeldeseite und wird nicht nachgeholt; ein Klick daneben
        nimmt dem Gast das Sperrbild; die Blende faehrt nicht zu; die Wege
        von Anfang an sichtbar und beim Gast nicht sichtbar; die Kanten
        nur beim Oeffnen; der Hinweis auf den Klick auch beim Gast. In den
        gebauten Skripten der Kontoseiten: das kleine Fenster bleibt mit
        der Halle verbunden; Discord laedt im Rahmen; die Seite hoert
        nicht auf eine Sitzung von woanders; das kleine Fenster der
        Registrierung oeffnet nicht leer; die Seiten fragen nicht nach dem
        Kennzeichen; der Name des kleinen Fensters geaendert
   Die Meldungen stehen in der PR der dritten Runde.

     node scripts/verify-hangar-orte.mjs
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RAHMEN } from './lib/rahmen.mjs';
import { leseMapWert, CSP_ORDNER } from './lib/csp-inline.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Klinken
const MIN_BEREICHE = 7;    // Reiter des Terminals je Seite (13.11.2026: 7)
const MIN_FIT_PROBEN = 1200; // Stellungen der Kamera, die [5] nachrechnet (13.11.2026: 432, mit hohen Fenstern 624; 14.11.2026 mit der Large-Halle 1248)
const MIN_FIT_ENG = 130;     // davon mit begrenztem Bildwinkel: dort schrumpft der Schirm (13.11.2026: 66; 14.11.2026 mit der Large-Halle 144)
const MIN_WEG_PROBEN = 14;  // Links, die [4] durch termRoute schickt
const MIN_WER_PROBEN = 11;  // Profilzeilen, die [4] durch termIdent schickt (14.11.2026: 11)
const MIN_GLAS_HALLEN = 2;  // Hallen, deren Monitor [8] im Modell nachmisst (14.11.2026: 2, Revel & York und Large)
const MIN_GEDREHT = 1;      // Hallen, deren Monitor nicht gerade nach Sueden sieht (14.11.2026: 1, Large-Halle)
const MIN_FAKT_PROBEN = 20;  // Karten der Anmeldung, die [4] durch termFakten schickt (14.11.2026: 10 je Seite)
const MIN_BILD_PROBEN = 20;  // Namen fuer das Glas (leitWerVon) und gezeichnete Sperrbilder (leitFenster) in [4] (14.11.2026: 8 + 12)
const MIN_GAST_WEGE = 6;     // Wege des Gasts auf dem Sperrbild, beschriftet und mit Ziel, in [2] (15.11.2026: 3 je Seite)
const MIN_SITZ_PROBEN = 37;  // Pfade, Zeitstempel und Sitzungen, die [4] durch termKonto, termAnmeldung, termGruss und termBlende schickt (15.11.2026: 9 + 10 + 8 + 10)
const MIN_KONTO_SEITEN = 6;  // Kontoseiten (Anmelden, Registrieren, Konto, je Sprache), deren ausgelieferte Skripte [6] nach dem Kennzeichen des Terminals durchsucht (15.11.2026: 6)

const fehler = [];
const fail = (m) => fehler.push(m);
const say = (m) => console.log(m);

const PAGES = [
  { file: 'hangar.html', de: false },
  { file: 'de/hangar.html', de: true },
].map((p) => ({ ...p, html: existsSync(join(DIST, p.file)) ? readFileSync(join(DIST, p.file), 'utf8') : null }));
if (PAGES.some((p) => p.html === null)) {
  console.error('verify-hangar-orte: dist/hangar.html oder dist/de/hangar.html fehlt — erst als Vorschau bauen (STAGING=1 npm run build).');
  process.exit(1);
}

const attr = (tag, name) => new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>])`).exec(tag);
const wert = (tag, name) => attr(tag, name)?.[1] ?? null;
const hat = (tag, name) => attr(tag, name) !== null;
// Sichtbarer Text einer Beschriftung: Markup heraus, bis nichts mehr faellt
// (ein Durchgang allein kann aus Resten ein neues Tag zusammensetzen)
const text = (s) => {
  let t = s, vorher;
  do { vorher = t; t = t.replace(/<[^>]+>/g, ''); } while (t !== vorher);
  return t.replace(/\s+/g, ' ').trim();
};
const laden = async (rel) => {
  const f = join(DIST, rel);
  if (!existsSync(f)) { fail(`dist/${rel} fehlt`); return null; }
  try { return await import(pathToFileURL(f).href); } catch (e) { fail(`dist/${rel} laedt nicht als Modul (${e.message})`); return null; }
};

const term = await laden('assets/hangar-terminal.js');
const viewer = await laden('assets/hangar-viewer.js');
const ctrl = await laden('assets/hangar-overview.js');
const termSrc = existsSync(join(DIST, 'assets/hangar-terminal.js')) ? readFileSync(join(DIST, 'assets/hangar-terminal.js')) : null;
const termV = termSrc ? createHash('sha1').update(termSrc).digest('hex').slice(0, 8) : '';

/* ---------- [1] Leiste ---------- */
say('[1] Leiste: Orte der Halle vor den Stationen');
const ORTE = ['halle', 'werk', 'leit'];
let orte = 0;
for (const page of PAGES) {
  const bar = /id="hgx-st"[\s\S]*?id="hgx-tafel"/.exec(page.html)?.[0] ?? '';
  const box = /<div[^>]*\bid="hgx-orte"[^>]*>/.exec(bar)?.[0];
  if (!box) { fail(`[1] ${page.file}: in der Stationen-Leiste #hgx-st fehlt die Gruppe #hgx-orte (HangarPage.astro)`); continue; }
  if (!hat(box, 'hidden')) fail(`[1] ${page.file}: #hgx-orte ist nicht anfangs verborgen — ohne 3D und am Telefon stuenden Orte da, die es dort nicht gibt`);
  if (!wert(box, 'aria-label')) fail(`[1] ${page.file}: #hgx-orte hat keinen Namen (aria-label)`);
  for (const n of ['data-an-leit', 'data-an-halle']) if (!wert(box, n)?.trim()) fail(`[1] ${page.file}: #hgx-orte ohne ${n}: Vorleser erfuehren nicht, wo die Kamera steht`);
  if (bar.indexOf('id="hgx-orte"') > bar.indexOf('role="tablist"')) fail(`[1] ${page.file}: die Orte stehen nicht vor den Stationen`);
  const group = bar.slice(bar.indexOf('id="hgx-orte"'), bar.indexOf('role="tablist"'));
  const btns = [...group.matchAll(/<button[^>]*\bdata-ort="([a-z]+)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ ort: m[1], label: text(m[2]) }));
  if (btns.map((b) => b.ort).join() !== ORTE.join()) fail(`[1] ${page.file}: Orte der Leiste (${btns.map((b) => b.ort).join(', ') || '—'}) sind nicht ${ORTE.join(', ')}`);
  for (const b of btns) {
    if (!b.label) fail(`[1] ${page.file}: Ort ${b.ort} ohne Beschriftung`);
    else orte++;
  }
}
say(`    ${orte} beschriftete Orte auf ${PAGES.length} Seiten`);

/* ---------- [2] Terminal im Markup ---------- */
say('[2] Terminal: Kasten, Fenster ohne Adresse, Modul mit Version des Inhalts');
let kaesten = 0, gastWege = 0;
const boxOf = (page) => /<section[^>]*\bid="hgx-term"[^>]*>[\s\S]*?<\/section>/.exec(page.html)?.[0] ?? '';
for (const page of PAGES) {
  const sec = boxOf(page), kopf = /^<section[^>]*>/.exec(sec)?.[0] ?? '';
  if (!sec) { fail(`[2] ${page.file}: #hgx-term fehlt (HangarPage.astro)`); continue; }
  if (!hat(kopf, 'hidden')) fail(`[2] ${page.file}: #hgx-term ist nicht anfangs verborgen`);
  if (!wert(kopf, 'aria-label')) fail(`[2] ${page.file}: #hgx-term hat keinen Namen (aria-label)`);
  const v = /^\/assets\/hangar-terminal\.js\?v=([0-9a-f]{8})$/.exec(wert(kopf, 'data-js') ?? '')?.[1];
  if (!v) fail(`[2] ${page.file}: data-js ist keine versionierte URL von /assets/hangar-terminal.js (${wert(kopf, 'data-js') ?? '—'})`);
  else if (termV && v !== termV) fail(`[2] ${page.file}: Version des Terminal-Moduls ${v}, Inhalt ${termV}: der Cache hielte den alten Stand`);
  const frames = [...sec.matchAll(/<iframe[^>]*>/g)].map((m) => m[0]);
  if (frames.length !== 1) fail(`[2] ${page.file}: #hgx-term hat ${frames.length} Fenster statt einem`);
  else {
    const f = frames[0];
    if (hat(f, 'src') || hat(f, 'srcdoc')) fail(`[2] ${page.file}: das Fenster des Terminals traegt schon im Markup eine Adresse — jede Hangarseite luede dann eine zweite Seite mit, auch ohne Besuch im Leitstand`);
    if (wert(f, 'name') !== 'hgx-term-frame') fail(`[2] ${page.file}: das Fenster heisst nicht hgx-term-frame — die Reiter zielten ins Leere`);
    if (!wert(f, 'title')?.trim()) fail(`[2] ${page.file}: das Fenster hat keinen Titel fuer Vorleser`);
  }
  for (const [id, was] of [['hgx-term-back', 'der Zurueck-Pfeil'], ['hgx-term-search', 'die Suche'], ['hgx-term-ext', '„In eigenem Tab öffnen“'], ['hgx-term-load', 'der Ladehinweis']])
    if (!sec.includes(`id="${id}"`)) fail(`[2] ${page.file}: ${was} (#${id}) fehlt im Terminal`);
  const load = /<p[^>]*\bid="hgx-term-load"[^>]*>/.exec(sec)?.[0] ?? '';
  if (load && !wert(load, 'data-fail')?.trim()) fail(`[2] ${page.file}: #hgx-term-load ohne data-fail: laesst sich die Seite nicht rahmen, stuende dort fuer immer „Seite lädt“`);
  const back = /<button[^>]*\bid="hgx-term-back"[^>]*>/.exec(sec)?.[0] ?? '';
  if (back && !wert(back, 'aria-label')?.trim()) fail(`[2] ${page.file}: der Zurueck-Pfeil hat keinen Namen`);
  // Anmeldung: die Blende und der Platz in der Leiste
  const blende = /<div[^>]*\bid="hgx-term-login"[^>]*>/.exec(sec)?.[0];
  if (!blende) fail(`[2] ${page.file}: die Blende der Anmeldung (#hgx-term-login) fehlt im Terminal`);
  else {
    if (!hat(blende, 'hidden')) fail(`[2] ${page.file}: #hgx-term-login ist nicht anfangs verborgen — die Blende laege ueber der Seite, bis das Modul sie zum ersten Mal schliesst`);
    // dritte Runde: Die Blende traegt die drei Wege des Gasts, also darf sie als Ganzes nicht stumm sein; stumm bleibt, was nur Begruessung ist
    if (hat(blende, 'aria-hidden')) fail(`[2] ${page.file}: #hgx-term-login traegt aria-hidden: die drei Wege des Gasts (#hgx-term-lwahl) waeren fuer Vorleser nicht da`);
    for (const [id, was] of [['hgx-term-lstep', 'der Schritt'], ['hgx-term-lid', 'die Karte']]) {
      const tag = new RegExp(`<[a-z]+[^>]*\\bid="${id}"[^>]*>`).exec(sec)?.[0] ?? '';
      if (tag && wert(tag, 'aria-hidden') !== 'true') fail(`[2] ${page.file}: ${was} der Anmeldung (#${id}) ohne aria-hidden="true": Vorleser laesen die Begruessung vor, den Namen nennt schon die Leiste`);
    }
    for (const n of ['data-l-auth', 'data-l-user', 'data-l-guest', 'data-l-gast', 'data-l-gastsub']) if (!wert(blende, n)?.trim()) fail(`[2] ${page.file}: #hgx-term-login ohne ${n}: der Schritt der Anmeldung stuende ohne Worte da`);
    for (const [id, was] of [['hgx-term-lstep', 'der Schritt'], ['hgx-term-lname', 'der Name'], ['hgx-term-lsub', 'die Zeile unter dem Namen']]) if (!sec.includes(`id="${id}"`)) fail(`[2] ${page.file}: ${was} der Anmeldung (#${id}) fehlt`);
    if (!/class="hgx-term__mark"[^>]*>\s*<svg/.test(sec)) fail(`[2] ${page.file}: die Blende traegt die Marke nicht (.hgx-term__mark mit svg): der Uebergang vom Monitor der Halle spraenge`);
    // zweite Runde: Sperrbild, Karte mit Gruss und Fakten, Hinweis, Kantenlinien
    for (const n of ['data-l-hallo', 'data-l-zurueck', 'data-f-flotte', 'data-f-schiff1', 'data-f-schiffn', 'data-f-leer', 'data-f-feld', 'data-f-hangar', 'data-f-seit']) if (!wert(blende, n)?.trim()) fail(`[2] ${page.file}: #hgx-term-login ohne ${n}: der Karte der Anmeldung fehlte ein Wort`);
    if (!(wert(blende, 'data-f-schiffn') ?? '').includes('{n}')) fail(`[2] ${page.file}: #hgx-term-login data-f-schiffn nennt den Platz fuer die Zahl nicht ({n}): die Flotte stuende ohne Anzahl auf der Karte`);
    if (!/<canvas[^>]*\bid="hgx-term-lbild"/.test(sec)) fail(`[2] ${page.file}: die Leinwand fuer das Sperrbild (canvas#hgx-term-lbild) fehlt: die Blende zeigte ein anderes Bild als der Monitor der Halle`);
    for (const [id, was] of [['hgx-term-lid', 'die Karte'], ['hgx-term-lhallo', 'der Gruss'], ['hgx-term-lfakt', 'die Liste der Fakten']]) if (!sec.includes(`id="${id}"`)) fail(`[2] ${page.file}: ${was} der Anmeldung (#${id}) fehlt`);
    if (!text(/<b[^>]*class="hgx-term__wort"[^>]*>([\s\S]*?)<\/b>/.exec(sec)?.[1] ?? '')) fail(`[2] ${page.file}: die Wortmarke als Schrift (.hgx-term__wort) fehlt: ohne Buehne stuende die Blende ohne Namen der Seite da`);
    if (!text(/<p[^>]*class="hgx-term__lfuss"[^>]*>([\s\S]*?)<\/p>/.exec(sec)?.[1] ?? '')) fail(`[2] ${page.file}: der Hinweis, dass ein Klick die Anmeldung ueberspringt (.hgx-term__lfuss), fehlt`);
    for (const k of ['o', 'u']) if (!sec.includes(`hgx-term__lkante--${k}`)) fail(`[2] ${page.file}: die Kantenlinie der Blende (.hgx-term__lkante--${k}) fehlt`);
    // dritte Runde: Die Zeile des Schritts hat zwei Lagen, die ineinander blenden; die erste traegt „Anmeldung …“ schon im Markup
    const lageA = /<span[^>]*\bid="hgx-term-lstep-a"[^>]*>([\s\S]*?)<\/span>/.exec(sec)?.[1];
    if (lageA === undefined || !sec.includes('id="hgx-term-lstep-b"')) fail(`[2] ${page.file}: die Zeile des Schritts hat ihre zwei Lagen nicht (#hgx-term-lstep-a, #hgx-term-lstep-b): „Anmeldung …“ und das Ergebnis spraengen um, statt ineinander zu blenden`);
    else if (text(lageA) !== text(wert(blende, 'data-l-auth') ?? '')) fail(`[2] ${page.file}: die erste Lage des Schritts nennt „${text(lageA)}“ statt „${text(wert(blende, 'data-l-auth') ?? '')}“ (data-l-auth)`);
    // dritte Runde: die drei Wege des Gasts unter der Karte. Anmelden und Konto erstellen sind Links ins Fenster
    // (ohne Skript und mit Strg wie jeder Link), „Als Gast weiter“ ein Knopf.
    const wahl = /<div[^>]*\bid="hgx-term-lwahl"[^>]*>([\s\S]*?)<\/div>/.exec(sec);
    if (!wahl) fail(`[2] ${page.file}: die drei Wege des Gasts (#hgx-term-lwahl) fehlen auf dem Sperrbild: Ohne Konto bliebe nur der Knopf der Leiste`);
    else {
      const kopfW = /^<div[^>]*>/.exec(wahl[0])[0];
      if (wert(kopfW, 'role') !== 'group' || !wert(kopfW, 'aria-label')?.trim()) fail(`[2] ${page.file}: #hgx-term-lwahl ist keine benannte Gruppe (role="group" mit aria-label)`);
      const wege = [...wahl[1].matchAll(/<(a|button)\b[^>]*\bdata-weg="([a-z]+)"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: /^<[^>]*>/.exec(m[0])[0], art: m[1], weg: m[2], label: text(m[3]) }));
      if (wege.map((w) => `${w.art}:${w.weg}`).join() !== 'a:an,a:neu,button:gast') fail(`[2] ${page.file}: #hgx-term-lwahl traegt ${wege.map((w) => `${w.art}:${w.weg}`).join(', ') || 'nichts'} statt Link „an“, Link „neu“, Knopf „gast“`);
      else for (const w of wege) {
        const wo = `[2] ${page.file}: Weg „${w.weg}“ des Gasts`;
        if (!w.label) { fail(`${wo} ohne Beschriftung`); continue; }
        if (w.art === 'button') {
          if (wert(w.tag, 'type') !== 'button') fail(`${wo} ist kein Knopf vom Typ button`);
          else gastWege++;
          continue;
        }
        const ziel = wert(w.tag, 'href') ?? '', pfad = ziel.replace(/[?#].*$/, '');
        if (wert(w.tag, 'target') !== 'hgx-term-frame') fail(`${wo} zielt nicht ins Fenster (target ${wert(w.tag, 'target') ?? '—'}): Ohne Skript oeffnete er die Seite statt der Halle`);
        else if (!ziel.startsWith(page.de ? '/de/' : '/') || (!page.de && ziel.startsWith('/de/'))) fail(`${wo}: ${ziel} liegt nicht in der Sprache der Seite`);
        else if (!existsSync(join(DIST, pfad))) fail(`${wo}: ${ziel} fuehrt auf keine Seite in dist/`);
        else if (term && term.termRoute(ziel, `https://x.test/${page.file}`).art !== 'innen') fail(`${wo}: ${ziel} bliebe nicht im Fenster (termRoute)`);
        else if (term && typeof term.termAnmeldung === 'function' && !term.termAnmeldung(pfad)) fail(`${wo}: ${ziel} gilt dem Terminal nicht als Seite der Anmeldung (termAnmeldung): Die Begruessung laege ueber der Frage nach dem zweiten Faktor`);
        else gastWege++;
      }
    }
  }
  const wer = /<a[^>]*\bid="hgx-term-who"[^>]*>/.exec(sec)?.[0];
  if (!wer) fail(`[2] ${page.file}: in der Leiste fehlt, wer angemeldet ist (#hgx-term-who)`);
  else {
    // dritte Runde (Krisz 15.11.2026: „konto seite direkt auf das bildschirm einbauen“): Der Knopf fuehrt ins Fenster
    if (wert(wer, 'target') !== 'hgx-term-frame') fail(`[2] ${page.file}: #hgx-term-who zielt nicht ins Fenster (target ${wert(wer, 'target') ?? '—'}): Konto und Anmeldung oeffneten einen eigenen Tab, statt auf dem Bildschirm zu stehen`);
    for (const n of ['data-login', 'data-dash']) {
      const ziel = wert(wer, n) ?? '';
      if (!ziel.startsWith(page.de ? '/de/' : '/') || (!page.de && ziel.startsWith('/de/'))) fail(`[2] ${page.file}: #hgx-term-who ${n}="${ziel}" liegt nicht in der Sprache der Seite`);
      else if (!existsSync(join(DIST, ziel.replace(/[?#].*$/, '')))) fail(`[2] ${page.file}: #hgx-term-who ${n}="${ziel}" fuehrt auf keine Seite in dist/`);
      else if (term && term.termRoute(ziel, `https://x.test/${page.file}`).art !== 'innen') fail(`[2] ${page.file}: #hgx-term-who ${n}="${ziel}" bliebe nicht im Fenster (termRoute)`);
      else if (term && typeof term.termKonto === 'function' && !term.termKonto(ziel.replace(/[?#].*$/, ''))) fail(`[2] ${page.file}: #hgx-term-who ${n}="${ziel}" gilt dem Terminal nicht als Seite des Kontos (termKonto): Der Knopf der Leiste waere dort nicht der aktive Bereich`);
    }
    // die Anmeldung der Leiste und der erste Weg des Gasts sind dieselbe Seite
    const wegAn = /<a[^>]*\bdata-weg="an"[^>]*>/.exec(sec)?.[0];
    if (wegAn && wert(wegAn, 'href') !== wert(wer, 'data-login')) fail(`[2] ${page.file}: „Anmelden“ auf dem Sperrbild fuehrt nach ${wert(wegAn, 'href')}, der Knopf der Leiste nach ${wert(wer, 'data-login')}`);
    if (wert(wer, 'href') !== wert(wer, 'data-login')) fail(`[2] ${page.file}: #hgx-term-who fuehrt ohne Skript nicht zur Anmeldung (href ist nicht data-login)`);
    for (const n of ['data-l-login', 'data-l-acct', 'data-a-guest', 'data-a-user', 'aria-label']) if (!wert(wer, n)?.trim()) fail(`[2] ${page.file}: #hgx-term-who ohne ${n}`);
    if (!(wert(wer, 'data-a-user') ?? '').includes('{name}')) fail(`[2] ${page.file}: #hgx-term-who data-a-user nennt den Platz fuer den Namen nicht ({name}): Vorleser erfuehren nicht, wer angemeldet ist`);
  }
  kaesten++;
}
if (gastWege < MIN_GAST_WEGE) fail(`[2] nur ${gastWege} Wege des Gasts mit Beschriftung und Ziel, Klinke ${MIN_GAST_WEGE}`);
say(`    ${kaesten} von ${PAGES.length} Seiten mit Terminal und Anmeldung, ${gastWege} Wege des Gasts (Klinke ${MIN_GAST_WEGE}), Modulversion ${termV || '—'}`);

/* ---------- [3] Reiter ---------- */
say('[3] Reiter: Ziele in dist/, in der Sprache der Seite, bleiben im Fenster, markieren sich selbst');
let reiter = 0, ziele = 0;
for (const page of PAGES) {
  const sec = boxOf(page);
  const links = [...sec.matchAll(/<a[^>]*\bdata-term="[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map((m) => {
    const tag = /^<a[^>]*>/.exec(m[0])[0];
    return { key: wert(tag, 'data-term'), href: wert(tag, 'href') ?? '', target: wert(tag, 'target'), pre: (wert(tag, 'data-pre') ?? '').split(' ').filter(Boolean), label: text(m[0]) };
  });
  if (links.length < MIN_BEREICHE) fail(`[3] ${page.file}: ${links.length} Reiter, Klinke ${MIN_BEREICHE}`);
  const keys = links.map((l) => l.key);
  if (new Set(keys).size !== keys.length) fail(`[3] ${page.file}: Schluessel der Reiter nicht einmalig (${keys.join(', ')})`);
  const home = wert(/^<section[^>]*>/.exec(sec)?.[0] ?? '', 'data-home');
  if (!keys.includes(home)) fail(`[3] ${page.file}: data-home „${home ?? '—'}“ ist keiner der Reiter (${keys.join(', ')})`);
  const tools = links.map((l) => ({ key: l.key, pre: l.pre }));
  for (const l of links) {
    reiter++;
    const wo = `[3] ${page.file}: Reiter ${l.key}`;
    if (!l.label) fail(`${wo} ohne Beschriftung`);
    if (l.target !== 'hgx-term-frame') fail(`${wo} zielt nicht ins Fenster (target ${l.target ?? '—'})`);
    const pfad = l.href.split(/[?#]/)[0];
    if (!/^\/(?!\/)/.test(pfad)) { fail(`${wo}: ${l.href} ist kein Pfad dieser Seite`); continue; }
    if (/^\/de\//.test(pfad) !== page.de) fail(`${wo}: ${pfad} steht nicht in der Sprache der Hangarseite`);
    if (!existsSync(join(DIST, pfad))) fail(`${wo}: ${pfad} liegt nicht in dist/ — der Reiter fuehrte auf die Fehlerseite`);
    else ziele++;
    if (!l.pre.length) fail(`${wo} ohne data-pre: er markierte sich nie`);
    if (term) {
      const art = term.termRoute(l.href, `https://probe.invalid/${page.file}`).art;
      if (art !== 'innen') fail(`${wo}: ${l.href} bliebe nicht im Fenster (termRoute: ${art})`);
      const key = term.termTool(pfad, tools);
      if (key !== l.key) fail(`${wo}: auf seiner eigenen Seite ${pfad} waere „${key ?? 'keiner'}“ markiert (data-pre ${l.pre.join(' ') || '—'})`);
    }
  }
}
say(`    ${reiter} Reiter, ${ziele} Ziele in dist/ gefunden (Klinke ${MIN_BEREICHE} je Seite)`);

/* ---------- [4] Reine Funktionen des Terminals ---------- */
say('[4] Terminal: Kasten deckt den Schirm, Wege aus dem Fenster, Stil fuer die Seite');
let kastenProben = 0, wegProben = 0, klein = 0;
if (term) {
  const { termFrame, termRoute, TERM_MIN_W, TERM_MIN_K, TERM_NARROW_W, TERM_CSS } = term;
  if (!(TERM_MIN_W >= 1024)) fail(`[4] TERM_MIN_W ${TERM_MIN_W}: unter 1024 px steht die Seite im Fenster nie in voller Breite`);
  if (!(TERM_NARROW_W > 820 && TERM_NARROW_W < TERM_MIN_W)) fail(`[4] TERM_NARROW_W ${TERM_NARROW_W}: bis 820 px zeigt die Seite ihre Telefonansicht, die passt nicht auf den Schirm`);
  if (!(TERM_MIN_K >= 0.7 && TERM_MIN_K < 1)) fail(`[4] TERM_MIN_K ${TERM_MIN_K}: unter 0,7 ist die Schrift der Seite im Fenster nicht mehr lesbar (16 px werden unter 11 px)`);
  for (let w = 320; w <= 2560; w += 37) for (const form of [0.4, 0.5, 0.62, 0.8]) {
    kastenProben++;
    const h = w * form, f = termFrame(w, h);
    const bw = f.w * f.k, bh = f.h * f.k;
    if (!(f.k > 0 && f.k <= 1) || Math.abs(bw - Math.round(w)) > 0.01 || Math.abs(bh - Math.round(h)) > 1)
      { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → ${JSON.stringify(f)}: im Bild ${bw.toFixed(1)} × ${bh.toFixed(1)} px statt ${Math.round(w)} × ${Math.round(h)} px`); break; }
    // volle Breite, solange der Massstab reicht; schmaler erst an der Untergrenze des Massstabs; nie die Telefonansicht
    if (f.w < TERM_NARROW_W) { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → Breite ${f.w} px: unter ${TERM_NARROW_W} px stuende die Seite im Fenster in der Telefonansicht`); break; }
    if (f.k < 1 && f.w > TERM_MIN_W) { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → Breite ${f.w} px bei Massstab ${f.k.toFixed(3)}: breiter als ${TERM_MIN_W} px und trotzdem verkleinert`); break; }
    if (f.w < TERM_MIN_W && f.w > TERM_NARROW_W && Math.abs(f.k - TERM_MIN_K) > 0.002) { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → Breite ${f.w} px bei Massstab ${f.k.toFixed(3)}: schmaler als ${TERM_MIN_W} px steht die Seite nur am kleinsten Massstab ${TERM_MIN_K}`); break; }
    if (f.w === TERM_MIN_W && f.k < TERM_MIN_K - 0.002) { fail(`[4] termFrame(${w}, ${h.toFixed(1)}) → volle Breite bei Massstab ${f.k.toFixed(3)}: unter ${TERM_MIN_K} ist die Schrift der Seite nicht mehr lesbar`); break; }
    if (f.k < TERM_MIN_K - 0.002) klein++;
  }
  const hier = 'https://probe.invalid/de/hangar.html?ort=leit';
  const WEGE = [
    ['/de/schiffe/aegs-gladius.html', 'innen'], ['/items.html#waffen', 'innen'], ['/de/topics/crafting.html?q=x', 'innen'],
    ['/de/archiv.html', 'innen'], ['mailto:hallo@example.org', 'innen'], ['/de/support.html', 'innen'],
    ['/de/hangar.html?ship=anvl-arrow', 'hangar'], ['/hangar.html', 'hangar'], ['https://probe.invalid/hangar.html?ship=x', 'hangar'],
    ['/de/hangar-loadout.html?l=abc', 'tab'], ['/hangar-bay/aegs-gladius', 'tab'],
    // dritte Runde: Das Konto steht im Fenster (Anmelden, Registrieren, das Konto selbst)
    ['/de/account.html', 'innen'], ['/account/login.html?next=%2Fpilot%2Fx', 'innen'], ['/de/account/register.html', 'innen'],
    ['https://robertsspaceindustries.com/', 'tab'], ['//probe.invalid.evil.test/de/schiffe.html', 'tab'], ['http://probe.invalid/de/schiffe.html', 'tab'],
  ];
  for (const [href, soll] of WEGE) {
    wegProben++;
    const ist = termRoute(href, hier);
    if (ist.art !== soll) fail(`[4] termRoute(${href}) → ${ist.art}, Soll ${soll}${soll === 'hangar' ? ': ein Link zum Hangar luede eine zweite Halle ins Fenster' : soll === 'tab' ? ': die Seite gehoert nicht ins Fenster' : ': die Seite verliesse das Terminal'}`);
  }
  if (termRoute('/de/hangar.html?ship=anvl-arrow', hier).ship !== 'anvl-arrow') fail('[4] termRoute nennt das Schiff eines Hangar-Links nicht: „Im Hangar ansehen“ holte es nicht aufs Feld');
  for (const [was, muster] of [['die Kopfzeile der Seite (#topbar)', /#topbar[^{]*\{[^}]*display:none/], ['die Vorschau-Marke', /2147483647[^{]*\{[^}]*display:none/], ['den Platz unter der Kopfzeile (--nav-h)', /--nav-h:0/]])
    if (!muster.test(TERM_CSS ?? '')) fail(`[4] TERM_CSS nimmt ${was} nicht heraus: sie stuende im Fenster unter der Leiste des Terminals`);
  // Die Marke des Vorschau-Baus muss es so auch geben, sonst griffe der Stil ins Leere
  const marke = /<div[^>]*\blang="de"[^>]*style="[^"]*2147483647[^"]*"[^>]*>/.test(PAGES[0].html);
  if (!marke) fail('[4] die Vorschau-Marke aus Layout.astro traegt nicht mehr lang und z-index 2147483647: TERM_CSS faende sie nicht');
  if (!/<nav[^>]*\bid="topbar"/.test(PAGES[0].html)) fail('[4] die Kopfzeile der Seite heisst nicht mehr #topbar: TERM_CSS faende sie nicht');
  // Schlanke Datenseiten (DataShell): der Pfad bleibt, Startlink, Suchknopf
  // und Sprachschalter gehen. Die Suche holt das Terminal ueber den Knopf
  // der Seite (data-scs-boot), also muss es ihn dort geben.
  const daten = existsSync(join(DIST, 'de/items.html')) ? readFileSync(join(DIST, 'de/items.html'), 'utf8') : '';
  const kopf = /<header class="dp-bar"[^>]*>([\s\S]*?)<\/header>/.exec(daten)?.[1] ?? '';
  if (!kopf) fail('[4] dist/de/items.html traegt keine Kopfleiste .dp-bar mehr: TERM_CSS und die Suche des Terminals griffen auf den Datenseiten ins Leere');
  for (const [was, klasse] of [['den Startlink', 'dp-home'], ['den Suchknopf', 'dp-search'], ['den Sprachschalter', 'dp-lang']]) {
    if (!new RegExp(`\\.dp-bar>\\.${klasse}[^{]*\\{[^}]*display:none`).test(TERM_CSS ?? '')) fail(`[4] TERM_CSS nimmt ${was} der Datenseiten (.${klasse}) nicht heraus: er stuende doppelt unter der Leiste des Terminals`);
    if (kopf && !new RegExp(`class="${klasse}"`).test(kopf)) fail(`[4] die Kopfleiste der Datenseiten traegt .${klasse} nicht mehr als Kind: TERM_CSS faende es nicht`);
  }
  if (kopf && !/<nav class="dp-crumbs"/.test(kopf)) fail('[4] die Kopfleiste der Datenseiten traegt den Pfad .dp-crumbs nicht mehr: im Fenster bliebe eine leere Leiste');
  if (kopf && !/<button[^>]*\bdata-scs-boot\b/.test(kopf)) fail('[4] der Suchknopf der Datenseiten traegt data-scs-boot nicht mehr: „Suche“ in der Leiste des Terminals oeffnete dort nichts');
  if (!/\[data-scs-boot\]/.test(String(termSrc ?? '')) || !/data-scs-open/.test(String(termSrc ?? ''))) fail('[4] das Terminal oeffnet die Suche nicht mehr ueber data-scs-boot (Datenseiten) und data-scs-open (uebrige Seiten)');
  // Dritte Runde: Anmelden und Registrieren stehen im Fenster. Ihr Kopf steht dort eng und ohne Bild, das
  // Formular in die Breite gelegt: Sonst laege der Knopf zum Absenden unter dem Rand des Schirms.
  const lesen = (rel) => (existsSync(join(DIST, rel)) ? readFileSync(join(DIST, rel), 'utf8') : '');
  const anmelden = lesen('de/account/login.html'), registrieren = lesen('de/account/register.html');
  if (!anmelden || !registrieren) fail('[4] dist/de/account/login.html oder dist/de/account/register.html fehlt: Die Wege des Gasts fuehrten ins Leere');
  else for (const [was, muster, seite, traeger, name] of [
    ['den hohen Kopf der Kontoseiten', /\.hero--acct\{[^}]*min-height:0/, anmelden, /<section class="[^"]*\bhero--acct\b/, '.hero--acct'],
    ['das Bild im Kopf der Kontoseiten', /\.hero--acct \.hero__photo[^{]*\{[^}]*display:none/, anmelden, /class="[^"]*\bhero__photo\b/, '.hero__photo'],
    ['den Abstand der Karte', /\.hero--acct\+\.acwrap \.acx-card\{[^}]*padding:/, anmelden, /<section class="[^"]*\bhero--acct\b[\s\S]*?<\/section>\s*<div class="acwrap"[\s\S]*?class="acx-card\b/, '.hero--acct + .acwrap mit .acx-card'],
    ['den Abstand der Felder', /\.hero--acct\+\.acwrap \.acx-field\{[^}]*margin-bottom:/, anmelden, /class="acx-field"/, '.acx-field'],
    // Der Schirm ist breit, nicht hoch: Anmelden stellt E-Mail und Discord nebeneinander, Registrieren Discord neben die
    // vier Felder in zwei Spalten. minmax(0, …) haelt die Spalten gleich breit, auch wenn eine Zeile nicht umbricht.
    ['das Nebeneinander von E-Mail und Discord bei der Anmeldung', /\.acx-card:has\(>#loginForm\)\{[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/, anmelden, /<div class="acx-card[^"]*"[^>]*>(?:(?!<div class="acx-card)[\s\S])*?<form[^>]*\bid="loginForm"/, '#loginForm in .acx-card'],
    ['den Platz des Discord-Knopfs neben der Anmeldung', /\.acx-card>#discordBtn\{[^}]*grid-column:2/, anmelden, /<button[^>]*\bid="discordBtn"/, '#discordBtn'],
    ['die Trennlinie ueber dem Discord-Knopf der Anmeldung', /\.acx-card:has\(>#loginForm\)>\.acx-divider\{[^}]*display:none/, anmelden, /<hr class="acx-divider"/, '.acx-divider'],
    ['das Nebeneinander von Discord und Formular bei der Registrierung', /\.acx-card:has\(>#regForm\)\{[^}]*display:grid/, registrieren, /<div class="acx-card[^"]*"[^>]*>(?:(?!<div class="acx-card)[\s\S])*?<form[^>]*\bid="regForm"/, '#regForm in .acx-card'],
    ['den Platz des Formulars neben Discord bei der Registrierung', /\.acx-card>#regForm\{[^}]*grid-column:2/, registrieren, /<button[^>]*\bid="regDiscordBtn"/, '#regDiscordBtn'],
    ['die Zeile „oder mit E-Mail“ der Registrierung', /\.acx-card:has\(>#regForm\)>\.acx-or\{[^}]*display:none/, registrieren, /<p class="acx-or"/, '.acx-or'],
    ['die zwei Spalten der Felder der Registrierung', /#regForm\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/, registrieren, /<form[^>]*\bid="regForm"/, '#regForm'],
    ['die zwei Spalten der Registrierung (was kein Feld ist, laeuft ueber beide)', /#regForm>:not\(\.acx-field\)\{[^}]*grid-column:1\/-1/, registrieren, /<form[^>]*\bid="regForm"[^>]*>\s*<div class="acx-field"/, 'Felder .acx-field als Kinder von #regForm'],
    ['den Umbruch des Hinweises zum Namen', /#regForm \.acx-hint\{[^}]*white-space:nowrap/, registrieren, /<p class="acx-hint"/, '.acx-hint'],
    ['den Satz zum Datenschutz unter dem Knopf der Registrierung', /#regForm \.acx-actions\{[^}]*flex-wrap:nowrap/, registrieren, /<div class="acx-actions"[^>]*>\s*<button[^>]*\bid="rgBtn"[^>]*>(?:(?!<\/div>)[\s\S])*?<span class="acx-privacy"/, '.acx-actions mit #rgBtn und .acx-privacy'],
  ]) {
    if (!muster.test(TERM_CSS ?? '')) fail(`[4] TERM_CSS nimmt ${was} nicht heraus: Anmelden oder Registrieren passte im Fenster nicht ohne Scrollen auf den Schirm`);
    else if (!traeger.test(seite)) fail(`[4] die Kontoseite traegt ${name} nicht mehr so, wie TERM_CSS es sucht: der Stil fuer das Fenster griffe ins Leere`);
  }
}
if (wegProben < MIN_WEG_PROBEN) fail(`[4] nur ${wegProben} Wege geprueft, Klinke ${MIN_WEG_PROBEN}`);
// Anmeldung: wer vor dem Terminal sitzt, und wie lange die Blende steht
let werProben = 0;
if (term) {
  const { termIdent, TERM_LOGIN } = term;
  if (typeof termIdent !== 'function' || !TERM_LOGIN) fail('[4] dist/assets/hangar-terminal.js liefert termIdent oder TERM_LOGIN nicht');
  else {
    const WER = [
      [null, null, null, 'ohne Sitzung sitzt ein Gast da'],
      ['', { display_name: 'Ada' }, null, 'ohne Sitzung sitzt ein Gast da'],
      ['u1', { display_name: 'Ada', handle: 'ada' }, { name: 'Ada', sub: '@ada', zeichen: 'A' }, 'der Anzeigename geht vor, das Handle steht darunter'],
      ['u1', { display_name: '  ', handle: '@@zed' }, { name: '@zed', sub: '', zeichen: 'Z' }, 'ohne Anzeigenamen nennt sich das Konto beim Handle'],
      ['u1', null, { name: '', sub: '', bild: '', zeichen: '◆', farbe: '#2dd4ff' }, 'ein Konto ohne lesbares Profil bleibt ein Konto'],
      ['u1', { display_name: 'Bo', avatar_url: 'https://cdn.discordapp.com/a/b.png', avatar_color: '#A1b2C3', avatar_icon: '✦' }, { bild: 'https://cdn.discordapp.com/a/b.png', farbe: '#A1b2C3', zeichen: '✦' }, 'Bild, Farbe und Zeichen des Profils kommen an'],
      ['u1', { display_name: 'Bo', avatar_url: 'javascript:alert(1)' }, { bild: '' }, 'als Bild gilt nur eine Adresse ueber https'],
      ['u1', { display_name: 'Bo', avatar_url: 'http://bilder.test/a.png' }, { bild: '' }, 'als Bild gilt nur eine Adresse ueber https'],
      ['u1', { display_name: 'Bo', avatar_color: 'red;background:url(//x.test)' }, { farbe: '#2dd4ff' }, 'als Farbe gilt nur #rrggbb, sie landet im Stil'],
      ['u1', { display_name: 'Bo', avatar_icon: 'ABCDEFGH' }, { zeichen: 'ABCD' }, 'das Zeichen bleibt hoechstens vier Zeichen lang'],
      ['u1', { display_name: 7, handle: {}, avatar_url: [], avatar_color: null, avatar_icon: 0 }, { name: '', bild: '', farbe: '#2dd4ff', zeichen: '◆' }, 'was kein Text ist, zaehlt nicht'],
    ];
    for (const [uid, zeile, soll, was] of WER) {
      werProben++;
      let ist;
      try { ist = termIdent(uid, zeile); } catch (e) { fail(`[4] termIdent(${JSON.stringify(uid)}, ${JSON.stringify(zeile)}) wirft (${e.message})`); continue; }
      if (soll === null ? ist !== null : !ist || Object.entries(soll).some(([k, v]) => ist[k] !== v)) fail(`[4] termIdent(${JSON.stringify(uid)}, ${JSON.stringify(zeile)}) → ${JSON.stringify(ist)}: ${was}`);
    }
    // Dritte Runde (Krisz 15.11.2026: „länger gemacht insgesamt“, dafuer „nur beim 1x mal pro session“): die ganze
    // Blende vier bis sechseinhalb Sekunden, und keine kurze Fassung mehr fuer das Wiederkommen. Die Frist reicht fuer eine langsame Leitung.
    const lang = TERM_LOGIN.boot + TERM_LOGIN.auth + TERM_LOGIN.hold + TERM_LOGIN.aus;
    if (!(lang >= 4000 && lang <= 6500)) fail(`[4] TERM_LOGIN: die Anmeldung dauert ${lang} ms (boot + auth + hold + aus), gedacht sind 4 bis 6,5 s — kuerzer ist sie nicht die laengere Fassung, die bestellt ist, laenger steht sie der Seite im Weg`);
    if (!(TERM_LOGIN.boot >= 300 && TERM_LOGIN.boot <= 900)) fail(`[4] TERM_LOGIN.boot ${TERM_LOGIN.boot} ms: das Sperrbild steht 0,3 bis 0,9 s ruhig, bevor die Pruefung beginnt — kuerzer springt es vom Glas weg, laenger wirkt es wie haengengeblieben`);
    if ('kurz' in TERM_LOGIN) fail('[4] TERM_LOGIN.kurz ist wieder da: Die Blende kommt nur einmal je Sitzung, eine kurze Fassung fuer das Wiederkommen gibt es nicht mehr');
    if (!(TERM_LOGIN.wink >= 1000 && TERM_LOGIN.wink <= 4000)) fail(`[4] TERM_LOGIN.wink ${TERM_LOGIN.wink} ms: der Wink zum Konto nach der Anmeldung als Gast dauert 1 bis 4 s (zweimal 1,1 s im Stil)`);
    if (!(TERM_LOGIN.frist >= TERM_LOGIN.auth && TERM_LOGIN.frist <= 5000)) fail(`[4] TERM_LOGIN.frist ${TERM_LOGIN.frist} ms: die Antwort des Kontos bekommt mindestens die Dauer des ersten Schritts (${TERM_LOGIN.auth} ms) und haelt die Blende hoechstens 5 s`);
  }
}
if (werProben < MIN_WER_PROBEN) fail(`[4] nur ${werProben} Profilzeilen durch termIdent geschickt, Klinke ${MIN_WER_PROBEN}`);
// Dritte Runde: was zum Konto gehoert, wo man sich anmeldet, wie die Karte gruesst, wann die Blende kommt
let sitzProben = 0;
if (term) {
  const { termKonto, termAnmeldung, termGruss, termBlende, TERM_GAST, TERM_NEU, TERM_AN } = term;
  if ([termKonto, termAnmeldung, termGruss, termBlende].some((f) => typeof f !== 'function') || typeof TERM_GAST !== 'string' || !TERM_GAST || !(TERM_NEU >= 60e3 && TERM_NEU <= 3600e3) || typeof TERM_AN !== 'string' || !TERM_AN)
    fail('[4] dist/assets/hangar-terminal.js liefert termKonto, termAnmeldung, termGruss, termBlende, TERM_GAST, TERM_AN oder TERM_NEU (1 bis 60 Minuten) nicht');
  else {
    const probe = (name, fn, args, soll, was) => {
      sitzProben++;
      let ist;
      try { ist = fn(...args); } catch (e) { fail(`[4] ${name}(${args.map((a) => JSON.stringify(a)).join(', ')}) wirft (${e.message})`); return; }
      if (ist !== soll) fail(`[4] ${name}(${args.map((a) => JSON.stringify(a)).join(', ')}) → ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}: ${was}`);
    };
    for (const [pfad, soll] of [['/de/account.html', true], ['/account.html', true], ['/account/login.html', true], ['/de/account/register.html', true], ['/account', true], ['/accounting.html', false], ['/de/schiffe.html', false], ['/de/', false], ['', false]])
      probe('termKonto', termKonto, [pfad], soll, soll ? 'die Seite gehoert zum Konto, der Knopf der Leiste waere dort nicht markiert' : 'die Seite gehoert nicht zum Konto');
    for (const [pfad, soll] of [['/de/account/login.html', true], ['/account/login.html', true], ['/account/register.html', true], ['/de/account/register', true], ['/de/account.html', false], ['/account/reset.html', false], ['/account/update-password.html', false], ['/de/account/login.html.bak', false], ['/de/schiffe/account/login.html', false], ['/de/account/', false]])
      probe('termAnmeldung', termAnmeldung, [pfad], soll, soll ? 'dort meldet man sich an: Die Begruessung muss warten, bis die Seite weitergeht (zweiter Faktor)' : 'dort entsteht keine Anmeldung: Die Begruessung bliebe aus, bis jemand die Seite verlaesst');
    const JETZT = Date.UTC(2026, 10, 15, 12), iso = (ms) => new Date(ms).toISOString();
    for (const [seit, soll, was] of [
      [iso(JETZT - 60e3), 'hallo', 'ein Konto von eben wird mit „Willkommen“ begruesst'],
      [iso(JETZT - TERM_NEU + 1000), 'hallo', 'bis TERM_NEU gilt ein Konto als eben entstanden'],
      [iso(JETZT - TERM_NEU - 1000), 'zurueck', 'nach TERM_NEU heisst es „Willkommen zurück“'],
      ['2026-03-02T10:00:00Z', 'zurueck', 'ein altes Konto wird mit „Willkommen zurück“ begruesst'],
      [iso(JETZT + 3600e3), 'hallo', 'ein Zeitstempel aus der Zukunft ist keiner'],
      ['', 'hallo', 'ohne Zeitstempel bleibt es beim schlichten Gruss'],
      ['gestern', 'hallo', 'was kein Datum ist, ist kein Zeitstempel'],
      [null, 'hallo', 'was kein Text ist, ist kein Zeitstempel'],
    ]) probe('termGruss', termGruss, [seit, JETZT], soll, was);
    for (const [schon, konto, soll, was] of [
      [null, '', true, 'beim ersten Hinsetzen der Sitzung kommt die Blende, auch fuer den Gast'],
      [null, 'u1', true, 'beim ersten Hinsetzen der Sitzung kommt die Blende'],
      [undefined, 'u1', true, 'ohne Gedaechtnis kommt die Blende'],
      [TERM_GAST, '', false, 'der Gast wurde in dieser Sitzung schon begruesst: nur einmal je Sitzung'],
      ['u1', 'u1', false, 'das Konto wurde in dieser Sitzung schon begruesst: nur einmal je Sitzung'],
      [TERM_GAST, 'u1', true, 'seit der Begruessung als Gast hat sich jemand angemeldet'],
      ['u1', '', true, 'seit der Begruessung hat sich das Konto abgemeldet'],
      ['u1', 'u2', true, 'jetzt sitzt ein anderes Konto davor'],
      ['', '', true, 'ein leeres Gedaechtnis ist keins: Der Gast steht als TERM_GAST darin'],
      ['u1', null, true, 'ohne Konto sitzt der Gast davor, begruesst wurde ein Konto'],
    ]) probe('termBlende', termBlende, [schon, konto], soll, was);
  }
}
if (sitzProben < MIN_SITZ_PROBEN) fail(`[4] nur ${sitzProben} Proben zu Konto, Anmeldeseite, Gruss und Blende, Klinke ${MIN_SITZ_PROBEN}`);
// Karte der Anmeldung: was die Seite weiss, in hoechstens drei Zeilen, in den Worten der Seite
let faktProben = 0;
if (term) {
  const { termFakten } = term;
  if (typeof termFakten !== 'function') fail('[4] dist/assets/hangar-terminal.js liefert termFakten nicht');
  else for (const page of PAGES) {
    const blende = /<div[^>]*\bid="hgx-term-login"[^>]*>/.exec(boxOf(page))?.[0] ?? '';
    const T = Object.fromEntries(Object.entries({ flotte: 'data-f-flotte', schiff1: 'data-f-schiff1', schiffn: 'data-f-schiffn', leer: 'data-f-leer', feld: 'data-f-feld', halle: 'data-f-hangar', seit: 'data-f-seit' }).map(([k, n]) => [k, wert(blende, n) ?? '']));
    if (Object.values(T).some((v) => !v.trim())) continue; // [2] hat es gemeldet
    const lang = page.de ? 'de' : 'en', JETZT = Date.UTC(2026, 10, 14), okt = '2026-10-03T09:00:00Z';
    const viele = T.schiffn.replace('{n}', page.de ? '1.234' : '1,234'), zwei = T.schiffn.replace('{n}', '2');
    const FAKT = [
      [{ flotte: 0, schiff: '', halle: 'Halle S' }, '', [[T.flotte, T.leer], [T.halle, 'Halle S']], 'eine leere Flotte heisst so; ohne Beitritt steht die Halle da'],
      [{ flotte: 1, schiff: 'Gladius', halle: 'Halle S' }, '', [[T.flotte, T.schiff1], [T.feld, 'Gladius'], [T.halle, 'Halle S']], 'ein Schiff steht in der Einzahl'],
      [{ flotte: 1234, schiff: 'Gladius', halle: 'Halle S' }, okt, [[T.flotte, viele], [T.feld, 'Gladius'], [T.seit, page.de ? 'Oktober 2026' : 'October 2026']], 'die Anzahl steht in der Zahlschreibung der Seite, der Beitritt geht vor der Halle'],
      [{ flotte: 2, schiff: 'Gladius', halle: 'Halle S' }, '2031-01-01T00:00:00Z', [[T.flotte, zwei], [T.feld, 'Gladius'], [T.halle, 'Halle S']], 'ein Beitritt in der Zukunft ist keiner'],
      [{ flotte: 2, schiff: 'Gladius', halle: 'Halle S' }, '2019-05-01T00:00:00Z', [[T.flotte, zwei], [T.feld, 'Gladius'], [T.halle, 'Halle S']], 'ein Beitritt vor 2024 ist keiner'],
      [{ flotte: 2, schiff: 'Gladius', halle: 'Halle S' }, 'gestern', [[T.flotte, zwei], [T.feld, 'Gladius'], [T.halle, 'Halle S']], 'was kein Datum ist, ist kein Beitritt'],
      [{ flotte: -1, schiff: 7, halle: null }, '', [], 'was keine Anzahl und kein Text ist, zaehlt nicht'],
      [{ flotte: 2.5, schiff: '   ', halle: '' }, '', [], 'eine halbe Anzahl und leere Namen zaehlen nicht'],
      [{ flotte: '3', schiff: 'x'.repeat(80), halle: 'Halle S' }, '', [[T.feld, 'x'.repeat(48)], [T.halle, 'Halle S']], 'eine Anzahl als Text zaehlt nicht, ein Name bleibt hoechstens 48 Zeichen lang'],
      [null, okt, [[T.seit, page.de ? 'Oktober 2026' : 'October 2026']], 'ohne Angaben der Seite bleibt der Beitritt'],
    ];
    for (const [roh, seit, soll, was] of FAKT) {
      faktProben++;
      let ist;
      try { ist = termFakten(roh, T, seit, lang, JETZT); } catch (e) { fail(`[4] ${page.file}: termFakten(${JSON.stringify(roh)}, …, ${JSON.stringify(seit)}) wirft (${e.message})`); continue; }
      if (JSON.stringify(ist) !== JSON.stringify(soll)) fail(`[4] ${page.file}: termFakten(${JSON.stringify(roh)}, …, ${JSON.stringify(seit)}) → ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}: ${was}`);
    }
    try { if (termFakten(null, null, '', lang, JETZT).length) fail(`[4] ${page.file}: termFakten ohne Worte liefert Zeilen`); } catch (e) { fail(`[4] ${page.file}: termFakten ohne Angaben und Worte wirft (${e.message}): die Karte der Anmeldung bliebe leer stehen`); }
  }
}
if (faktProben < MIN_FAKT_PROBEN) fail(`[4] nur ${faktProben} Karten durch termFakten geschickt, Klinke ${MIN_FAKT_PROBEN}`);
// Sperrbild: wer aufs Glas der Halle darf, und was leitFenster in ein Fenster zeichnet
let bildProben = 0;
if (viewer) {
  const { leitWerVon, leitFenster, LEIT_MARKE: M, LEIT_WORT: W } = viewer;
  if (typeof leitWerVon !== 'function' || typeof leitFenster !== 'function' || !(M?.b > 0 && M?.y > 0) || !(W?.ab > 0 && W?.h > 0)) fail('[4] dist/assets/hangar-viewer.js liefert leitWerVon, leitFenster, LEIT_MARKE oder LEIT_WORT nicht');
  else {
    const WER = [
      [null, null, 'ohne Sitzung steht niemand auf dem Glas'],
      [{ name: '   ' }, null, 'ohne Namen steht niemand auf dem Glas'],
      [{ name: 7 }, null, 'was kein Text ist, ist kein Name'],
      [{ name: ' Ada ' }, { name: 'Ada', zeichen: 'A', farbe: '#2dd4ff' }, 'ohne Zeichen gilt der Anfangsbuchstabe, ohne Farbe die der Seite'],
      [{ name: '@zed', zeichen: '', farbe: '#A1b2C3' }, { name: '@zed', zeichen: 'Z', farbe: '#A1b2C3' }, 'beim Handle zaehlt der Buchstabe hinter dem @'],
      [{ name: '@' }, { name: '@', zeichen: '◆' }, 'ein Name nur aus @ bekommt das Zeichen der Seite'],
      [{ name: 'Bo', zeichen: 'ABCDEFGH', farbe: 'red;x' }, { zeichen: 'ABCD', farbe: '#2dd4ff' }, 'das Zeichen bleibt hoechstens vier Zeichen lang, als Farbe gilt nur #rrggbb'],
      [{ name: 'x'.repeat(90) }, { name: 'x'.repeat(60) }, 'der Name bleibt hoechstens 60 Zeichen lang'],
    ];
    for (const [roh, soll, was] of WER) {
      bildProben++;
      let ist;
      try { ist = leitWerVon(roh); } catch (e) { fail(`[4] leitWerVon(${JSON.stringify(roh)}) wirft (${e.message})`); continue; }
      if (soll === null ? ist !== null : !ist || Object.entries(soll).some(([k, v]) => ist[k] !== v)) fail(`[4] leitWerVon(${JSON.stringify(roh)}) → ${JSON.stringify(ist)}: ${was}`);
    }
    // Leinwand, die mitschreibt: jede Schrift ist 0,6 em breit je Zeichen; fillText merkt sich hinten die Schriftgroesse in px
    const leinwand = () => {
      const rufe = [], o = { font: '10px x' };
      return new Proxy(o, {
        get: (_, k) => (k === 'rufe' ? rufe
          : k in o ? o[k]
          : k === 'measureText' ? (t) => ({ width: [...String(t)].length * 0.6 * parseFloat(/([\d.]+)px/.exec(o.font)?.[1] ?? '10') })
          : /^create\w+Gradient$/.test(String(k)) ? () => ({ addColorStop() {} })
          : (...a) => { rufe.push(k === 'fillText' ? [k, ...a, parseFloat(/([\d.]+)px/.exec(o.font)?.[1] ?? '10')] : [k, ...a]); }),
        set: (_, k, v) => { o[k] = v; return true; },
      });
    };
    const lang = 'Kommandantin Aurelia von Sternenstaub-Lichtenfels zu Hohenwacht';
    const SICHT = [{}, { uhr: '12:34' }, { uhr: '12:34', wer: { name: 'Testpilot', zeichen: 'T', farbe: '#f5a623' } }, { uhr: '', wer: { name: lang, zeichen: 'KAVS', farbe: '#7dd3a8' } }];
    for (const [x, y, w, h] of [[0, 0, 1600, 900], [130, 40, 1211, 683], [0, 0, 640, 1100]]) for (const o of SICHT) {
      bildProben++;
      const g = leinwand(), wo = `leitFenster im Fenster ${w} × ${h} mit ${JSON.stringify(o)}`;
      try { leitFenster(g, x, y, w, h, o); } catch (e) { fail(`[4] ${wo} wirft (${e.message})`); continue; }
      const rufe = g.rufe, namen = rufe.map((r) => r[0]);
      const erstes = namen.findIndex((n) => /^(fill|stroke|fillRect|fillText|strokeRect|drawImage)$/.test(n)), clip = namen.indexOf('clip'), rect = rufe.find((r) => r[0] === 'rect');
      if (!(clip >= 0 && clip < erstes) || !rect || rect.slice(1).some((v, i) => v !== [x, y, w, h][i])) fail(`[4] ${wo}: zeichnet, bevor es auf sein Fenster beschnitten hat (rect ${JSON.stringify(rect?.slice(1) ?? null)}, clip an Stelle ${clip}, erster Strich an Stelle ${erstes}) — das Sperrbild liefe ueber den Rand aufs Glas`);
      if (namen.filter((n) => n === 'save').length !== namen.filter((n) => n === 'restore').length || namen[0] !== 'save' || namen.at(-1) !== 'restore') fail(`[4] ${wo}: save und restore gehen nicht auf — der Beschnitt bliebe auf der Leinwand stehen`);
      // gesperrte Schrift steht Zeichen fuer Zeichen da; in der Folge der Aufrufe ergibt sie die Worte
      const worte = rufe.filter((r) => r[0] === 'fillText').map((r) => r[1]).join('');
      for (const wort of ['TERMINAL', 'VERSE·BASE']) if (!worte.includes(wort)) fail(`[4] ${wo}: „${wort}“ steht nicht im Bild`);
      if (o.uhr ? !worte.includes(o.uhr) : /\d\d:\d\d/.test(worte)) fail(`[4] ${wo}: die Uhr ${o.uhr ? 'fehlt' : 'steht im Bild, obwohl keine verlangt ist'}`);
      if (o.wer) {
        const rest = worte.slice(worte.indexOf('VERSE·BASE') + 10), name = rest.slice([...o.wer.zeichen].join('').length);
        if (!rest.startsWith(o.wer.zeichen) || !(name === o.wer.name || (name.endsWith('…') && o.wer.name.startsWith(name.slice(0, -1).trimEnd())))) fail(`[4] ${wo}: Zeichen und Name der Sitzung stehen nicht im Bild (gezeichnet „${rest}“)`);
        else if ([...name].length * 0.6 * rufe.findLast((r) => r[0] === 'fillText')[4] > 36 * (w / 100) + 1e-6) fail(`[4] ${wo}: der Name der Sitzung ist ${[...name].length} Zeichen lang und breiter als sein Platz (36 % der Breite)`);
      } else if (worte.length !== 'TERMINAL'.length + 'VERSE·BASE'.length + (o.uhr ?? '').length) fail(`[4] ${wo}: im Bild steht mehr als Terminal, Uhr und Wortmarke („${worte}“)`);
      // Marke und Wortmarke stehen, wo sie die Blende der Seite zeigt (LEIT_MARKE, LEIT_WORT; den Stil dazu vergleichen [6] und [8])
      const punkt = rufe.find((r) => r[0] === 'arc'), v = rufe.find((r) => r[0] === 'fillText' && r[1] === 'V');
      const mx = x + w / 2, my = y + M.y * h, nah = (a, b) => Math.abs(a - b) < 1e-6 * w;
      if (!punkt || !nah(punkt[1], mx) || !nah(punkt[2], my) || !nah(punkt[3], (6 * M.b * w) / 64)) fail(`[4] ${wo}: der Punkt der Marke steht bei ${punkt ? `${punkt[1]}, ${punkt[2]}` : '—'} statt ${mx}, ${my} (LEIT_MARKE)`);
      if (!v || !nah(v[3], my + (W.ab + W.h / 2) * w)) fail(`[4] ${wo}: die Wortmarke steht in der Hoehe ${v?.[3] ?? '—'} statt ${my + (W.ab + W.h / 2) * w} (LEIT_WORT)`);
    }
  }
}
if (bildProben < MIN_BILD_PROBEN) fail(`[4] nur ${bildProben} Proben am Sperrbild, Klinke ${MIN_BILD_PROBEN}`);
say(`    ${kastenProben} Kaesten (${klein} davon so schmal, dass die Seite unter den kleinsten Massstab muss), ${wegProben} Wege (Klinke ${MIN_WEG_PROBEN}), ${werProben} Profilzeilen (Klinke ${MIN_WER_PROBEN}), ${sitzProben} Proben zu Konto und Sitzung (Klinke ${MIN_SITZ_PROBEN}), ${faktProben} Karten (Klinke ${MIN_FAKT_PROBEN}), ${bildProben} Proben am Sperrbild (Klinke ${MIN_BILD_PROBEN})`);

/* ---------- [5] Geometrie der Buehne ---------- */
say('[5] Buehne: Kamera vor dem Monitor, Fenster der Seite im Bild genau das gemeldete Rechteck und auf dem Glas');
let fitProben = 0, fitEng = 0, hallen = 0, gedreht = 0, vollQuader = 0;
if (viewer) {
  const { HALL_LEIT, LEIT_FOV_MAX, leitFit, leitAchsen } = viewer;
  if (typeof leitFit !== 'function' || typeof leitAchsen !== 'function' || !HALL_LEIT || !(LEIT_FOV_MAX > 0)) fail('[5] dist/assets/hangar-viewer.js liefert HALL_LEIT, LEIT_FOV_MAX, leitFit oder leitAchsen nicht mehr');
  else for (const [id, L] of Object.entries(HALL_LEIT)) {
    hallen++;
    const S = L.schirm, R = L.raum;
    if (!R) { fail(`[5] HALL_LEIT.${id} nennt den Raum nicht (raum)`); continue; }
    // Das Fenster der Seite liegt auf dem Glas des Monitors, mit dem Saum als Rand
    if (!(S.saum >= 0.01 && S.saum <= 0.1 && S.b > 4 * S.saum && S.h > 4 * S.saum)) { fail(`[5] HALL_LEIT.${id}.schirm: Saum ${S.saum} m passt nicht zu einem Glas von ${S.b} × ${S.h} m (gedacht: 1 bis 10 cm Rand um das Fenster der Seite)`); continue; }
    const bMax = S.b - 2 * S.saum, hMax = S.h - 2 * S.saum;
    // Die Kamera sitzt suedlich des Pults: zwischen ihr und dem Monitor steht nur die Tischplatte unterhalb des Bilds
    if (L.bank && !(S.z + L.d[0] >= L.bank.z[1] + 0.1)) fail(`[5] ${id}: beim kleinsten Abstand ${L.d[0]} m stuende die Kamera bei z ${(S.z + L.d[0]).toFixed(2)}, das Pult reicht bis z ${L.bank.z[1]} — sie saesse im Tisch`);
    if (!(S.z > R.z[0] && S.z < R.z[1] && S.y > R.y[0] && S.y < R.y[1])) fail(`[5] ${id}: der Schirm (${S.x}, ${S.y}, ${S.z}) steht nicht im Raum des Leitstands`);
    const RAND = 0.25; // so viel Luft bleibt zwischen Kamera und Glas, Wand, Boden, Decke
    // Wohin der Monitor sieht (dreh, neig): Die Kamera steht um d vor seinem Glas auf dieser Achse,
    // nicht einfach suedlich von ihm. Sie steht bei Mitte + dx·X + dy·Y + d·Z.
    const { X, Y, Z } = leitAchsen(S);
    const lot = [X, Y, Z].map((v) => Math.hypot(...v));
    if (lot.some((n) => Math.abs(n - 1) > 1e-9) || Math.abs(X[0] * Z[0] + X[1] * Z[1] + X[2] * Z[2]) > 1e-9 || Math.abs(Y[0] * Z[0] + Y[1] * Z[1] + Y[2] * Z[2]) > 1e-9) { fail(`[5] ${id}: leitAchsen liefert keine drei senkrechten Achsen der Laenge 1 (${JSON.stringify({ X, Y, Z })})`); continue; }
    if (S.dreh || S.neig) gedreht++;
    const kam = (dx, dy, d) => ({ x: S.x + dx * X[0] + dy * Y[0] + d * Z[0], y: S.y + dx * X[1] + dy * Y[1] + d * Z[1], z: S.z + dx * X[2] + dy * Y[2] + d * Z[2] });
    const draussen = (c) => c.x < R.x[0] + RAND || c.x > R.x[1] - RAND || c.y < R.y[0] + RAND || c.y > R.y[1] - RAND || c.z < R.z[0] + RAND || c.z > R.z[1] - RAND;
    // voll: Quader, in denen etwas steht (Pult, Stuehle); auch dort bleibt RAND Luft
    const VOLL = L.voll ?? [];
    if (!Array.isArray(VOLL) || VOLL.some((q) => !['x', 'y', 'z'].every((k) => Array.isArray(q?.[k]) && q[k][1] > q[k][0]))) { fail(`[5] HALL_LEIT.${id}.voll nennt keine Quader (je x, y, z von bis)`); continue; }
    const imVollen = (c) => VOLL.findIndex((q) => c.x > q.x[0] - RAND && c.x < q.x[1] + RAND && c.y > q.y[0] - RAND && c.y < q.y[1] + RAND && c.z > q.z[0] - RAND && c.z < q.z[1] + RAND);
    vollQuader += VOLL.length;
    // Die Grenzen des Abstands selbst: Fuer ein kleines freies Stueck schoepft leitFit sie ganz aus,
    // also muessen beide Enden im Raum liegen. Das Raster unten erreicht das ferne Ende nicht
    // (sein kleinstes Stueck kommt auf rund 7,6 m), eine geweitete Grenze bliebe sonst unbemerkt.
    if (!(Array.isArray(L.d) && L.d[0] > 0 && L.d[1] >= L.d[0])) fail(`[5] HALL_LEIT.${id}.d (${JSON.stringify(L.d)}) nennt keinen Abstand von bis`);
    else {
      const nah = kam(0, 0, L.d[0]), fern = kam(0, 0, L.d[1]), ort = (c) => `(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})`;
      if (draussen(nah) || draussen(fern))
        fail(`[5] ${id}: der Abstand ${L.d.join(' bis ')} m stellt die Kamera bei ${ort(nah)} bis ${ort(fern)}, der Raum des Leitstands reicht mit ${RAND} m Luft nur von x ${(R.x[0] + RAND).toFixed(2)} bis ${(R.x[1] - RAND).toFixed(2)}, y ${(R.y[0] + RAND).toFixed(2)} bis ${(R.y[1] - RAND).toFixed(2)}, z ${(R.z[0] + RAND).toFixed(2)} bis ${(R.z[1] - RAND).toFixed(2)} — in einem kleinen Fenster stuende sie hinter der Rueckwand`);
      else if (imVollen(nah) >= 0 || imVollen(fern) >= 0)
        fail(`[5] ${id}: der Abstand ${L.d.join(' bis ')} m stellt die Kamera bei ${ort(nah)} bis ${ort(fern)}, dort steht etwas (HALL_LEIT.${id}.voll, mit ${RAND} m Luft) — sie saesse in Pult oder Stuhl`);
    }
    let schlimm = null;
    // die letzten vier: hohe, schmale Fenster. Dort stoesst der Bildwinkel an LEIT_FOV_MAX, und der
    // Schirm muss in Metern kleiner werden, sonst ragt er aus dem freien Stueck (Review PR #355:
    // 800 × 1500 mit offener Schiffsauswahl, 25 px ueber den Rand der Buehne).
    for (const [W, H] of [[761, 540], [1024, 600], [1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1080], [2560, 1440], [3440, 1440], [761, 1080], [800, 1500], [900, 1400], [1080, 1920]])
      for (const l of [0, 70, 300, 400]) for (const r of [0, 60]) for (const t of [70, 120]) for (const b of [0, 80, 140]) {
        if (W - l - r < 240 || H - t - b < 180) continue;
        fitProben++;
        // wie leitPose im Viewer: das freie Stueck ist die Buehne ohne Raender, mit dem Rahmen (rand + 6 px) Luft
        const luft = L.rand + 6, frei = { l: l + luft, t: t + luft, r: W - r - luft, b: H - b - luft };
        const f = leitFit(W, H, frei, L);
        const eng = f.fov >= LEIT_FOV_MAX - 1e-6;
        if (eng) fitEng++;
        // Zentralprojektion nachgerechnet: Kamera bei Schirmmitte + (dx, dy, d), Blick nach -z
        const fpx = H / 2 / Math.tan((f.fov * Math.PI) / 360);
        const px = (x) => W / 2 + ((x - f.dx) / f.d) * fpx, py = (y) => H / 2 - ((y - f.dy) / f.d) * fpx;
        const ist = { l: px(-f.b / 2), r: px(f.b / 2), t: py(f.h / 2), b: py(-f.h / 2) };
        const ab = Math.max(...['l', 't', 'r', 'b'].map((k) => Math.abs(ist[k] - f.rect[k])));
        const cam = kam(f.dx, f.dy, f.d);
        const wo = `[5] ${id} bei ${W}×${H}, frei ${JSON.stringify(frei)}`;
        let m = null;
        if (!(ab <= 0.5)) m = `${wo}: der Schirm steht im Bild ${ab.toFixed(1)} px neben dem gemeldeten Rechteck — das Fenster der Seite laege neben dem Schirm`;
        // seitlich bleibt er im freien Stueck; nach oben und unten darf er um die Luft des Rahmens
        // ausweichen, wenn die Kamera sonst an Boden oder Decke stiesse, aber nie unter Kopfzeile oder Leiste
        else if (f.rect.l < frei.l - 0.5 || f.rect.r > frei.r + 0.5 || f.rect.t < frei.t - luft - 0.5 || f.rect.b > frei.b + luft + 0.5) m = `${wo}: der Schirm ragt aus dem freien Stueck (${JSON.stringify(f.rect)})`;
        else if (!(f.fov > 10 && f.fov <= LEIT_FOV_MAX + 1e-6)) m = `${wo}: Bildwinkel ${f.fov.toFixed(1)}°, Grenze ${LEIT_FOV_MAX}°`;
        else if (!(f.d >= L.d[0] - 1e-9 && f.d <= L.d[1] + 1e-9)) m = `${wo}: Abstand ${f.d.toFixed(2)} m ausserhalb ${L.d.join(' bis ')} m`;
        else if (!(f.h / f.b >= L.form[0] - 1e-9 && f.h / f.b <= L.form[1] + 1e-9)) m = `${wo}: Form ${(f.h / f.b).toFixed(2)} ausserhalb ${L.form.join(' bis ')}`;
        // das Fenster bleibt auf dem Glas und ist so hoch wie dieses ohne Saum; kleiner wird es nur, wo der Bildwinkel begrenzt ist
        else if (!(f.b > 0 && f.h > 0 && f.b <= bMax + 1e-9 && f.h <= hMax + 1e-9)) m = `${wo}: das Fenster der Seite (${f.b.toFixed(3)} × ${f.h.toFixed(3)} m) ragt ueber das Glas des Monitors (${bMax.toFixed(3)} × ${hMax.toFixed(3)} m ohne Saum)`;
        // (auf einem Glas, das schmaler ist als das breiteste Fenster, begrenzt stattdessen die Breite)
        else if (!eng && Math.abs(f.h - hMax) > 1e-9 && Math.abs(f.b - bMax) > 1e-9) m = `${wo}: das Fenster der Seite ist ${f.b.toFixed(3)} × ${f.h.toFixed(3)} m bei Bildwinkel ${f.fov.toFixed(1)}°, das Glas des Monitors traegt ${bMax.toFixed(3)} × ${hMax.toFixed(3)} m — es nutzt weder dessen Hoehe noch dessen Breite`;
        else if (draussen(cam))
          m = `${wo}: die Kamera stuende bei (${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.z.toFixed(2)}) ausserhalb des Leitstands oder naeher als ${RAND} m an Glas, Wand, Boden oder Decke`;
        else if (imVollen(cam) >= 0)
          m = `${wo}: die Kamera stuende bei (${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.z.toFixed(2)}) in oder naeher als ${RAND} m an Pult oder Stuhl (HALL_LEIT.${id}.voll[${imVollen(cam)}])`;
        else if ((f.rect.r - f.rect.l) < 0.45 * (frei.r - frei.l) && (f.rect.b - f.rect.t) < 0.45 * (frei.b - frei.t)) m = `${wo}: der Schirm fuellt weniger als die Haelfte des freien Stuecks (${Math.round(f.rect.r - f.rect.l)} × ${Math.round(f.rect.b - f.rect.t)} px)`;
        if (m && !schlimm) schlimm = m;
      }
    if (schlimm) fail(schlimm);
  }
}
if (fitProben < MIN_FIT_PROBEN) fail(`[5] nur ${fitProben} Stellungen nachgerechnet, Klinke ${MIN_FIT_PROBEN}`);
if (fitEng < MIN_FIT_ENG) fail(`[5] nur ${fitEng} Stellungen mit begrenztem Bildwinkel, Klinke ${MIN_FIT_ENG}: Das Raster erreicht den Zweig nicht mehr, in dem das Fenster schrumpft`);
if (gedreht < MIN_GEDREHT) fail(`[5] nur ${gedreht} Halle(n) mit gedrehtem oder geneigtem Monitor, Klinke ${MIN_GEDREHT}: Der Zweig, in dem die Kamera nicht suedlich des Monitors steht, liefe leer`);
say(`    ${fitProben} Stellungen in ${hallen} Halle(n) nachgerechnet (Klinke ${MIN_FIT_PROBEN}), davon ${fitEng} mit begrenztem Bildwinkel (Klinke ${MIN_FIT_ENG}); ${gedreht} Halle(n) mit gedrehtem oder geneigtem Monitor (Klinke ${MIN_GEDREHT}), ${vollQuader} Quader, in die die Kamera nie geraet`);

/* ---------- [6] Naht ---------- */
say('[6] Naht: Buehne, Controller und Terminal rufen einander, ?ort=leit in der Adresse');
let naht = 0, kontoSeiten = 0;
{
  const vSrc = existsSync(join(DIST, 'assets/hangar-viewer.js')) ? readFileSync(join(DIST, 'assets/hangar-viewer.js'), 'utf8') : '';
  const cSrc = existsSync(join(DIST, 'assets/hangar-overview.js')) ? readFileSync(join(DIST, 'assets/hangar-overview.js'), 'utf8') : '';
  const tSrc = String(termSrc ?? '');
  const themeCss = existsSync(join(DIST, 'assets/theme.css')) ? readFileSync(join(DIST, 'assets/theme.css'), 'utf8') : '';
  const NAHT = [
    [vSrc, /\n\s+place: \(name\) =>/, 'die Buehne liefert place nicht mehr'],
    [vSrc, /\n\s+canPlace: \(name\) =>/, 'die Buehne liefert canPlace nicht mehr'],
    [vSrc, /\n\s+onPlace\(fn\) \{/, 'die Buehne liefert onPlace nicht mehr'],
    [cSrc, /viewer\.place\('leit'\)/, 'der Controller schickt die Kamera nicht mehr in den Leitstand (viewer.place)'],
    [cSrc, /\.canPlace\?\.\('leit'\)/, 'der Controller fragt die Buehne nicht mehr nach dem Leitstand (canPlace)'],
    [cSrc, /\.onPlace\?\.\(onPlace\)/, 'der Controller hoert nicht mehr, wo die Kamera steht (onPlace)'],
    [cSrc, /import\(termBox\.dataset\.js\)/, 'der Controller laedt das Terminal nicht mehr ueber data-js'],
    [cSrc, /\.initTerminal\(termBox,/, 'der Controller ruft initTerminal nicht mehr'],
    // Der letzte Wunsch gilt (zwei Review-Runden an PR #355, im Browser nur mit
    // 3D nachzustellen): Jede Stelle, die den Wunsch aendert, zaehlt ihn, und
    // wer gewartet hat, fragt nach, bevor er faehrt. Die Datei der Buehne
    // bearbeiten mehrere Straenge; faellt eine der Zeilen bei einem Merge
    // heraus, faehrt die Kamera wieder gegen den Wunsch, und kein Bild zeigt es.
    [vSrc, /\n\s+place: \(name\) => \{ placeWish\+\+;/, 'place zaehlt den Wunsch der Seite nicht mehr (placeWish++): nach dem Warten fuehre auch ein ueberholter Wunsch los'],
    [vSrc, /placeWish\+\+;\s*(?:\/\/[^\n]*\n\s*)*if \(post\) leitLeave\(true\);/, 'ein Schiffswechsel zaehlt nicht mehr als neuer Wunsch (placeWish++ vor leitLeave(true) in showShip): ein wartender Wunsch fuehre nach dem Wechsel allein in den Leitstand, und „Schiffsfeld“ holte die Kamera nicht zurueck'],
    [vSrc, /await hallSettled;\s*if \(!leitScreen \|\| wish !== placeWish\) return false;/, 'leitGo wartet nicht mehr auf die Halle oder fragt danach nicht nach dem Wunsch: ?ort=leit fiele an einer langsamen Leitung still aufs Feld zurueck'],
    [vSrc, /while \(trip\) await trip\.done;\s*(?:\/\/[^\n]*\n\s*)*if \(wish !== placeWish\) return false;/, 'leitGo fragt nach dem Warten auf eine Fahrt nicht mehr nach dem Wunsch: „Leitstand, Schiffsfeld“ waehrend der Rueckfahrt fuehre wieder hinauf'],
    [vSrc, /if \(me\.state === 'hin' && !\(await me\.arrived\)\) return false;\s*(?:\/\/[^\n]*\n\s*)*if \(wish !== placeWish\) return false;/, 'leitLeave fragt nach der Ankunft nicht mehr nach dem Wunsch: „Schiffsfeld, Leitstand“ waehrend der Hinfahrt fuehre wieder herunter'],
    // Lage der Halle im Modellraum: [8] rechnet mit hallOrigin nach, wo der
    // Monitor des Leitstands steht. Das gilt nur, solange die Buehne das
    // Modell mit derselben Rechnung setzt.
    [vSrc, /const c = h\.room\.center, o = hallSpot\(h\), O = hallOrigin\(h\);\s*model\.position\.set\(-o\[0\], -c\[1\], -o\[2\]\);/, 'loadRealHall setzt das Modell der Halle nicht mehr mit hallSpot und hallOrigin: [8] maesse den Monitor des Leitstands an einer anderen Stelle nach, als die Buehne ihn zeigt'],
    [vSrc, /if \(O\) \{\s*model\.position\.y = -O\[1\];/, 'loadRealHall setzt den Boden der Halle nicht mehr nach hallOrigin: [8] maesse den Monitor des Leitstands in einer anderen Hoehe nach, als die Buehne ihn zeigt'],
    [cSrc, /if \(!ok && my === ortTok && state\.ort === 'leit'/, 'der Controller laesst auch die Antwort auf einen ueberholten Wunsch aufs Feld zurueckstellen (ortTok in applyOrt): „Leitstand, Schiffsfeld, Leitstand“ waehrend der Rueckfahrt endete auf dem Feld'],
    // Sperrbild (zweite Runde): ein Bild aus einer Quelle. Der Monitor
    // der Halle und die Blende der Seite zeichnen beide mit leitFenster;
    // wer sich anmeldet, steht danach auf dem Glas; die Uhr geht weiter.
    [vSrc, /\n\s+leitFenster\(g, fx, fy, fw, fh, \{ uhr: leitUhr\(\), wer: leitWer \}\);/, 'der Monitor der Halle zeichnet sein Fenster nicht mehr mit leitFenster (leitDraw): Glas und Blende zeigten zwei verschiedene Bilder, beim Hinsetzen spraenge es'],
    [vSrc, /\n\s+setTerminal\(wer\) \{ leitWer = leitWerVon\(wer\);/, 'die Buehne liefert setTerminal nicht mehr oder laesst den Namen ungeprueft aufs Glas (leitWerVon)'],
    [vSrc, /if \(Math\.floor\(Date\.now\(\) \/ 60000\) !== S\.min\) leitDraw\(\);/, 'der Monitor zeichnet zur vollen Minute nicht mehr neu (leitStep): die Uhr auf dem Glas bliebe stehen'],
    [cSrc, /import\(stageCfg\.viewer\)\.catch\(\(\) => null\)/, 'der Controller holt das Sperrbild nicht mehr aus der Datei der Buehne, oder ein Fehler dabei risse das Terminal mit (import(stageCfg.viewer).catch)'],
    [cSrc, /buehne\.leitFenster\(cv\.getContext\('2d'\), 0, 0, cv\.width, cv\.height, o\);/, 'der Controller zeichnet die Blende nicht mehr mit leitFenster ueber die ganze Leinwand: sie zeigte ein anderes Bild als der Monitor'],
    [cSrc, /\n\s+fakten: termRoh,/, 'der Controller reicht der Karte der Anmeldung nicht mehr, was die Seite weiss (fakten: termRoh)'],
    [cSrc, /wer: \(id\) => viewer\?\.setTerminal\?\.\(id\)/, 'der Controller sagt der Buehne nicht mehr, wer angemeldet ist (setTerminal): das Glas nennte die Sitzung nie'],
    [tSrc, /hooks\.wer\?\.\(id \? \{ name:/, 'das Terminal meldet nicht mehr, wer angemeldet ist (hooks.wer in setze)'],
    [tSrc, /ok = hooks\.bild\(lbild, \{ uhr: uhr\(\) \}\) === true;/, 'das Terminal laesst das Sperrbild nicht mehr auf seine Leinwand zeichnen (hooks.bild)'],
    [tSrc, /roh = hooks\.fakten\?\.\(\) \?\? null;/, 'das Terminal fragt die Seite nicht mehr nach den Fakten der Karte (hooks.fakten)'],
    // Dritte Runde: Konto im Fenster, Blende einmal je Sitzung. Was davon im
    // Browser nur mit einem echten Konto zu sehen ist, steht hier als Zeile.
    [tSrc, /d\.documentElement\.setAttribute\('data-vb-terminal', ''\);/, 'das Terminal kennzeichnet die Seite im Fenster nicht mehr (data-vb-terminal): Die Kontoseiten wuessten nicht, dass sie gerahmt sind, und schickten das Fenster zu Discord, das sich nicht rahmen laesst'],
    [tSrc, /if \(termBlende\(an, kontoJetzt\(\)\)\) \{ signIn\(\); return; \}/, 'das Hinsetzen fragt nicht mehr, ob die Blende in dieser Sitzung schon lief (termBlende in hinsetzen): Sie kaeme wieder bei jedem Hinsetzen'],
    [tSrc, /win\.sessionStorage\.setItem\(TERM_AN, an\)/, 'das Terminal merkt sich nicht mehr, wen die Blende begruesst hat (TERM_AN in sessionStorage): Nach jedem Neuladen der Halle kaeme sie wieder'],
    [tSrc, /if \(kontoJetzt\(\) && login\?\.hidden && beimAnmelden\(\)\) \{ wartet = true; return; \}/, 'die Begruessung wartet nicht mehr, bis die Anmeldeseite im Fenster weitergeht: Die Blende laege ueber der Frage nach dem zweiten Faktor'],
    [tSrc, /box\.classList\.remove\('is-ready'\); watch\(\); nachAnmeldung\(\); \}\);/, 'verlaesst die Anmeldeseite das Fenster, holt das Terminal die Begruessung nicht mehr nach (nachAnmeldung bei pagehide): Nach der Anmeldung im Fenster bliebe sie aus'],
    [tSrc, /login\.dataset\.step === 'out' \|\| login\.dataset\.step === 'guest'\) return;/, 'ein Klick neben die drei Wege nimmt dem Gast das Sperrbild wieder (ueberspringen im Schritt guest)'],
    [tSrc, /if \(zu\) \{\s*login\.dataset\.step = 'zu';\s*await warte\(TERM_LOGIN\.aus\);/, 'die Blende faehrt vor einer Anmeldung im Fenster nicht mehr zu (Schritt zu, so lang wie TERM_LOGIN.aus): Sie staende in einem Bild ueber der Seite'],
  ];
  for (const [src, muster, was] of NAHT) {
    if (muster.test(src)) naht++;
    else fail(`[6] ${was}`);
  }
  if (term && typeof term.initTerminal !== 'function') fail('[6] dist/assets/hangar-terminal.js liefert initTerminal nicht');
  // Stil der Blende gegen Modul und Buehne: Die Blende oeffnet sich ueber
  // EINE Zahl (--hgx-auf), aus der Ausschnitt und Kantenlinien lesen, in
  // genau der Zeit, nach der das Modul sie wegnimmt (TERM_LOGIN.aus); die
  // Wortmarke als Schrift steht, wo sie das Bild zeigt (LEIT_WORT).
  for (const page of PAGES) {
    const regel = (sel) => new RegExp(`(?:^|[}>\\s])${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`).exec(page.html)?.[1] ?? '';
    const blende = regel('.hgx-term__login'), kante = regel('.hgx-term__lkante'), unten = regel('.hgx-term__lkante--u'), wort = regel('.hgx-term__wort');
    const zeit = /transition:--hgx-auf ([\d.]+)(m?s)\b/.exec(blende), ms = zeit ? Math.round(+zeit[1] * (zeit[2] === 's' ? 1000 : 1)) : NaN;
    if (!/@property --hgx-auf\{[^}]*syntax:\s*["']<percentage>["']/.test(page.html)) fail(`[6] ${page.file}: --hgx-auf ist nicht als Prozentwert angemeldet (@property): die Blende spraenge auf, statt sich zu oeffnen`);
    else if (!(ms === term?.TERM_LOGIN?.aus)) fail(`[6] ${page.file}: die Blende oeffnet sich in ${Number.isNaN(ms) ? '—' : ms} ms (transition:--hgx-auf in .hgx-term__login), das Modul nimmt sie nach ${term?.TERM_LOGIN?.aus ?? '—'} ms weg (TERM_LOGIN.aus): Sie verschwaende halb offen oder laege unsichtbar ueber der Seite`);
    else if (!blende.includes('clip-path:polygon(0 0,100% 0,100% var(--hgx-auf),0 var(--hgx-auf),0 calc(100% - var(--hgx-auf)),100% calc(100% - var(--hgx-auf)),100% 100%,0 100%)') || !/(?:^|;)top:var\(--hgx-auf\)/.test(kante) || !/(?:^|;)top:calc\(100% - var\(--hgx-auf\)\)/.test(unten)) fail(`[6] ${page.file}: Ausschnitt und Kantenlinien der Blende lesen nicht dieselbe Zahl (--hgx-auf): als zwei Uebergaenge liefen sie auseinander, und die Linien laegen im weggeschnittenen Spalt`);
    else naht++;
    const W = viewer?.LEIT_WORT, M = viewer?.LEIT_MARKE;
    const top = /(?:^|;)top:calc\(([\d.]+)% \+ ([\d.]+)cqw\)/.exec(wort), hoch = /(?:^|;)font-size:([\d.]+)cqw/.exec(wort)?.[1];
    // die Sperrung kommt aus der Skala der Seite (verify:typo verlangt das): den Wert der Stufe aus dem ausgelieferten Stilblatt lesen
    const stufe = /(?:^|;)letter-spacing:var\((--ls-\d+)\)/.exec(wort)?.[1];
    const ls = stufe ? new RegExp(`${stufe}:\\s*([\\d.]+)em`).exec(themeCss)?.[1] : /(?:^|;)letter-spacing:([\d.]+)em/.exec(wort)?.[1];
    if (!W || !M) { /* [4] hat es gemeldet */ }
    else if (!top || !(Math.abs(+top[1] / 100 - M.y) < 1e-6 && Math.abs(+top[2] / 100 - W.ab) < 1e-6 && Math.abs(+hoch / 100 - W.h) < 1e-6 && Math.abs(+ls - W.ls) < 1e-6)) fail(`[6] ${page.file}: die Wortmarke als Schrift (.hgx-term__wort) steht bei top ${top ? `${top[1]} % + ${top[2]} cqw` : '—'}, ${hoch ?? '—'} cqw hoch, gesperrt ${ls ?? '—'} em; das Bild zeigt sie bei ${+(M.y * 100).toFixed(2)} % + ${+(W.ab * 100).toFixed(2)} cqw, ${+(W.h * 100).toFixed(2)} cqw hoch, gesperrt ${W.ls} em (LEIT_WORT) — ohne Bild stuende sie woanders als mit`);
    else naht++;
  }
  // Dritte Runde, Stil: Die drei Wege des Gasts sind nur im Schritt guest zu sehen und zu erreichen
  // (visibility, sonst traefe sie die Tastatur hinter der Karte), und die Kanten der Blende stehen auch,
  // waehrend sie zufaehrt.
  for (const page of PAGES) {
    const regel = (sel) => new RegExp(`(?:^|[}>\\s])${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`).exec(page.html)?.[1] ?? '';
    const wahl = regel('.hgx-term__lwahl'), wahlAn = regel('.hgx-term__login[data-step="guest"] .hgx-term__lwahl');
    if (!/(?:^|;)visibility:hidden/.test(wahl) || !/(?:^|;)opacity:0/.test(wahl)) fail(`[6] ${page.file}: die drei Wege des Gasts (.hgx-term__lwahl) sind nicht von Anfang an unsichtbar und unerreichbar (opacity:0, visibility:hidden): Die Tastatur traefe sie waehrend der Anmeldung eines Kontos`);
    else if (!/(?:^|;)visibility:visible/.test(wahlAn) || !/(?:^|;)opacity:1/.test(wahlAn)) fail(`[6] ${page.file}: die drei Wege des Gasts erscheinen im Schritt guest nicht (.hgx-term__login[data-step="guest"] .hgx-term__lwahl): Ohne Konto bliebe das Sperrbild ohne Ausweg stehen`);
    else naht++;
    if (!/\.hgx-term__login:is\(\[data-step="out"\],\[data-step="zu"\]\) \.hgx-term__lkante\{[^}]*opacity:1/.test(page.html)) fail(`[6] ${page.file}: die Kanten der Blende stehen nicht in beiden Fahrten (Schritte out und zu): Beim Zufahren schloesse sie sich ohne ihre Linien`);
    else naht++;
    const fuss = /\.hgx-term__login:is\(([^)]*)\) \.hgx-term__lfuss\{[^}]*opacity:/.exec(page.html)?.[1] ?? '';
    if (!fuss.includes('[data-step="auth"]') || fuss.includes('guest')) fail(`[6] ${page.file}: „Klick überspringt“ steht im Schritt ${fuss || '—'}; gedacht: waehrend der Anmeldung, nicht beim Gast, bei dem ein Klick daneben nichts ueberspringt`);
    else naht++;
  }
  // Dritte Runde, Kennzeichen: Die Kontoseiten lesen data-vb-terminal (src/lib/im-terminal.ts) in den
  // Skripten, die sie wirklich laden. Gesucht wird in den Modulen der Seite und allem, was sie fest einbinden.
  {
    const astro = (rel, gesehen = new Set()) => {
      if (gesehen.has(rel) || gesehen.size > 60) return gesehen;
      const f = join(DIST, rel);
      if (!existsSync(f)) return gesehen;
      gesehen.add(rel);
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:from|import)\s*\(?"\.\/([\w.@-]+\.js)"/g)) astro(`_astro/${m[1]}`, gesehen);
      return gesehen;
    };
    for (const pre of ['', 'de/']) for (const [rel, was, kopf] of [['account/login.html', 'die Anmeldeseite', 'AuthLogin'], ['account/register.html', 'die Registrierung', 'AuthRegister'], ['account.html', 'das Konto', '']]) {
      const file = `${pre}${rel}`, html = existsSync(join(DIST, file)) ? readFileSync(join(DIST, file), 'utf8') : '';
      if (!html) { fail(`[6] dist/${file} fehlt: ${was} stuende nicht im Fenster`); continue; }
      const module = new Set();
      let eigen = '';
      for (const m of html.matchAll(/<script type="module" src="\/(_astro\/[\w.@-]+\.js)"/g)) {
        astro(m[1], module);
        // das Skript der Seite selbst (nicht das von „Anderes Discord-Konto?“ daneben, das dieselben Aufrufe traegt)
        if (kopf && m[1].startsWith(`_astro/${kopf}.astro`) && existsSync(join(DIST, m[1]))) eigen = readFileSync(join(DIST, m[1]), 'utf8');
      }
      const alles = [...module].map((r) => readFileSync(join(DIST, r), 'utf8')).join('\n');
      if (!alles.includes('data-vb-terminal')) fail(`[6] dist/${file}: ${was} fragt in ${module.size} geladenen Modulen nirgends nach dem Kennzeichen des Terminals (data-vb-terminal): Im Fenster schickte „Mit Discord …“ den Rahmen zu Discord, das sich nicht rahmen laesst`);
      else if (kopf && !eigen) fail(`[6] dist/${file}: das Skript von ${kopf}.astro ist nicht unter den Modulen der Seite: Das kleine Fenster fuer Discord liesse sich nicht nachweisen`);
      else if (kopf && !/window\.open\(""/.test(eigen)) fail(`[6] dist/${file}: ${was} oeffnet das kleine Fenster fuer Discord nicht mehr leer und noch im Klick (window.open("", …)): Der Browser hielte es fuer ungebeten`);
      else if (kopf && !/skipBrowserRedirect:\s*(?:!0|true)/.test(eigen)) fail(`[6] dist/${file}: ${was} holt die Adresse fuer Discord nicht, ohne selbst dorthin zu gehen (skipBrowserRedirect): Der Rahmen ginge zu Discord, das kleine Fenster bliebe leer`);
      else if (kopf && !/opener\s*=\s*null/.test(eigen)) fail(`[6] dist/${file}: ${was} trennt das kleine Fenster nicht mehr von sich (opener = null), bevor es eine fremde Adresse laedt`);
      else if (kopf && !/addEventListener\("storage"/.test(eigen)) fail(`[6] dist/${file}: ${was} hoert nicht mehr, dass woanders eine Sitzung entstanden ist (storage): Nach Discord im kleinen Fenster bliebe sie im Bildschirm stehen`);
      else if (kopf && !alles.includes('vb-anmeldung')) fail(`[6] dist/${file}: ${was} kennt den Namen des kleinen Fensters nicht (vb-anmeldung)`);
      else kontoSeiten++;
    }
  }
  if (kontoSeiten < MIN_KONTO_SEITEN) fail(`[6] nur ${kontoSeiten} Kontoseiten mit dem Kennzeichen des Terminals in ihren Skripten, Klinke ${MIN_KONTO_SEITEN}`);
  if (ctrl) {
    const { parseState, serializeState, placeOf, placeShip } = ctrl;
    if (typeof placeOf !== 'function' || typeof placeShip !== 'function') fail('[6] dist/assets/hangar-overview.js liefert placeOf oder placeShip nicht mehr');
    else {
      const werk = new Set(['boden']);
      const ctx = { ids: new Set(['schiff', 'zweites', 'boden']), defaultShip: 'schiff', werk, tabs: ['overview'], sorts: ['name'], purs: new Set(), grps: new Set(), sizes: [], crews: new Set(), cargos: new Set(), prices: new Set(), makers: new Set() };
      const rund = (q, scope = 'location') => serializeState(parseState(q, '', ctx), ctx, scope);
      const PROBEN = [
        ['?ort=leit', 'location', '?ort=leit', 'der Leitstand ueberlebt die Adresse nicht'],
        ['?ship=zweites&ort=leit', 'location', '?ship=zweites&ort=leit', 'der Leitstand ueberlebt die Adresse nicht'],
        ['?ort=keller', 'location', '', 'ein unbekannter Ort bleibt in der Adresse'],
        ['?ship=boden&ort=leit', 'location', '?ship=boden', 'ein Bodenfahrzeug in der Werkhalle kaeme in den Leitstand'],
        ['?ship=zweites&ort=leit', 'share', '?ship=zweites', 'der geteilte Link traegt, wo die Kamera steht'],
      ];
      for (const [q, scope, soll, was] of PROBEN) {
        const ist = rund(q, scope);
        if (ist !== soll) fail(`[6] ${q} (${scope}) wird zu „${ist}“ statt „${soll}“: ${was}`);
        else naht++;
      }
      if (placeOf({ ship: 'boden', ort: 'halle' }, werk) !== 'werk' || placeOf({ ship: 'schiff', ort: 'leit' }, werk) !== 'leit' || placeOf({ ship: 'schiff', ort: 'halle' }, werk) !== 'halle') fail('[6] placeOf nennt den Ort nicht mehr nach Fahrzeug und Zustand');
      else naht++;
      const c = { ids: ['schiff', 'zweites', 'boden'], werk, defaultShip: 'schiff' };
      if (placeShip('werk', 'schiff', {}, c) !== 'boden' || placeShip('halle', 'boden', { halle: 'zweites' }, c) !== 'zweites' || placeShip('leit', 'boden', {}, c) !== 'schiff' || placeShip('halle', 'zweites', {}, c) !== 'zweites')
        fail('[6] placeShip waehlt fuer einen Ort nicht mehr das passende Fahrzeug (gezeigt, zuletzt dort, Vorgabe)');
      else naht++;
    }
  }
}
say(`    ${naht} Nahtstellen und Proben, ${kontoSeiten} Kontoseiten mit dem Kennzeichen des Terminals in ihren Skripten (Klinke ${MIN_KONTO_SEITEN})`);

/* ---------- [7] Rahmen ---------- */
say('[7] Rahmen: dieser Bau erlaubt der eigenen Seite das Fenster');
let rahmen = 0;
for (const e of RAHMEN) {
  const f = join(DIST, CSP_ORDNER, e.datei);
  const ist = existsSync(f) ? leseMapWert(readFileSync(f, 'utf8')) : null;
  if (ist !== e.offen) fail(`[7] dist/${CSP_ORDNER}/${e.datei}: ${ist === null ? 'fehlt oder ist nicht lesbar' : `„${ist}“`}, Soll „${e.offen}“ (${e.wo}) — der Browser wiese die Seite im Fenster ab, der Schirm des Terminals bliebe leer; als Vorschau bauen (STAGING=1 npm run build)`);
  else rahmen++;
}
say(`    ${rahmen} von ${RAHMEN.length} Werten offen fuer die eigene Seite`);

/* ---------- [8] Monitor im Modell ---------- */
say('[8] Monitor: Glas im ausgelieferten Modell, wo HALL_LEIT es nennt; Marke der Blende, wo der Monitor sie zeigt');
let glasHallen = 0, glasFlaeche = 0, glasDreiecke = 0, glasFern = 0;
const glasOhne = [];
if (viewer?.HALL_LEIT) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const draco3d = (await import('draco3d')).default;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const TOL = 0.015; // m: HALL_LEIT nennt Zentimeter, das Modell Millimeter
  // Die Hallen, wie die Seiten sie der Buehne geben (hg-stage, opts.hall): Raum, Bodenhoehe, Einrichtung
  const HALLEN = new Map();
  for (const page of PAGES) {
    let cfg = null;
    try { cfg = JSON.parse(/<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(page.html ?? '')?.[1] ?? 'null'); } catch { /* unten */ }
    const erste = cfg?.opts?.hall ?? null;
    if (!erste?.id) { fail(`[8] ${page.file}: keine Halle in der StageConfig (#hg-stage, opts.hall) — die Lage des Leitstands ist nicht nachzumessen`); continue; }
    // dazu die Hallen fester Groesse (halls: je Stufe eine), in die die Buehne umbaut
    for (const hall of [erste, ...Object.values(cfg.halls ?? {})]) {
      if (!hall?.id) continue;
      const alt = HALLEN.get(hall.id), lage = JSON.stringify([hall.room, hall.floor, hall.furniture?.url, hall.url]);
      if (alt && alt.lage !== lage) fail(`[8] ${page.file}: die Halle ${hall.id} steht anders als in ${alt.file} (Raum, Boden, Modell oder Einrichtung) — die Sprachen zeigten den Monitor an verschiedenen Stellen`);
      else if (!alt) HALLEN.set(hall.id, { hall, lage, file: page.file });
    }
  }
  for (const [id, L] of Object.entries(viewer.HALL_LEIT)) {
    const S = L.schirm, B = L.bank, hall = HALLEN.get(id)?.hall;
    // Eine Halle, die dieser Bau nicht ausliefert (ihr Modell liegt noch nicht im Repo), ist hier nicht
    // nachzumessen: genannt, nicht FEHLER. Dass keine verloren geht, haelt die Klinke MIN_GLAS_HALLEN.
    if (!hall) { glasOhne.push(id); continue; }
    // Wo der Monitor steht: in der Einrichtung der Halle (bank: die Monitore des Pults, Halle von
    // Revel & York) oder im Modell der Halle selbst (schirm.mat: das Material seines Glases)
    if (!B && !S.mat) { fail(`[8] HALL_LEIT.${id} nennt weder die Monitore des Pults (bank) noch das Material des Glases im Modell der Halle (schirm.mat): das Terminal stuende frei im Raum statt auf einem Monitor`); continue; }
    if (B && !hall.furniture?.url) { fail(`[8] ${id}: die Seite nennt keine Einrichtung der Halle (hg-stage, opts.hall.furniture) — ohne sie gibt es keinen Monitor fuer das Terminal`); continue; }
    const quelle = B ? hall.furniture.url : hall.url;
    if (!quelle) { fail(`[8] ${id}: die Seite nennt das Modell der Halle nicht (hg-stage, url) — der Monitor des Terminals ist nicht nachzumessen`); continue; }
    const rel = String(quelle).replace(/^\//, '').replace(/[?#].*$/, ''), file = join(DIST, rel);
    if (!existsSync(file)) { fail(`[8] dist/${rel} fehlt: ohne ${B ? 'die Einrichtung' : 'das Modell'} der Halle gibt es keinen Monitor fuer das Terminal`); continue; }
    let MAT;
    try { MAT = B ? /monitors/i : new RegExp(S.mat, 'i'); } catch { fail(`[8] HALL_LEIT.${id}.schirm.mat (${S.mat}) ist kein Muster fuer ein Material`); continue; }
    let doc;
    try { doc = await io.read(file); } catch (e) { fail(`[8] dist/${rel} laesst sich nicht lesen (${e.message})`); continue; }
    // alle Dreiecke des Monitor-Materials im Modellraum
    const tri = [];
    for (const node of doc.getRoot().listNodes()) for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      if (!MAT.test(prim.getMaterial()?.getName() ?? '')) continue;
      const m = node.getWorldMatrix(), pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), v = [0, 0, 0];
      const at = (i) => { pos.getElement(i, v); return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]; };
      const n = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i + 2 < n; i += 3) tri.push([0, 1, 2].map((k) => at(idx ? idx.getScalar(i + k) : i + k)));
    }
    if (!tri.length) { fail(`[8] dist/${rel}: kein Teil mit dem Material der Monitore (${MAT}) — ${B ? 'das Pult des Leitstands traegt keine Schirme mehr' : 'die Halle traegt diesen Bildschirm nicht mehr'}, das Terminal stuende frei im Raum`); continue; }
    // Lage der Halle im Modellraum: wie die Buehne das Modell setzt (hallOrigin
    // aus Raum, Schiffsfeld und Bodenhoehe), NICHT aus den Monitoren selbst.
    // Bis zum Review an PR #365 stand hier die Mitte der Monitore gegen die
    // Mitte von bank: Eine Halle, die als Ganzes anders steht (HALL_SHIFT.field
    // 4 → 0, floor 1 → 2, beides vorgefuehrt), wanderte damit mit, und alles
    // Folgende bestand weiter, waehrend die Buehne das Bild neben den Monitor
    // legt und es nur in der Konsole meldet.
    const ab = viewer.hallOrigin?.(hall);
    if (!Array.isArray(ab) || !ab.every(Number.isFinite)) { fail(`[8] ${id}: die Buehne nennt den Ursprung der Halle nicht (hallOrigin; Raum ${JSON.stringify(hall.room?.center ?? null)}, Boden ${hall.floor ?? '—'}) — ohne Bodenhoehe im Manifest lotet sie erst am geladenen Modell, und der Monitor ist hier nicht nachzumessen`); continue; }
    let fern = 0;
    if (B) {
      const lo = [0, 1, 2].map((k) => Math.min(...tri.flat().map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...tri.flat().map((p) => p[k])));
      const soll = [B.x, B.y, B.z], mass = (k) => `${(hi[k] - lo[k]).toFixed(3)} m statt ${(soll[k][1] - soll[k][0]).toFixed(2)} m`;
      const schief = [0, 1, 2].filter((k) => Math.abs(hi[k] - lo[k] - (soll[k][1] - soll[k][0])) > 2 * TOL);
      if (schief.length) { fail(`[8] dist/${rel}: die Monitore des Pults messen ${schief.map((k) => `${'xyz'[k]} ${mass(k)}`).join(', ')} (HALL_LEIT.${id}.bank) — das Pult ist ein anderes, die Lage des Glases (schirm) neu vermessen`); continue; }
      const mitte = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2 - ab[k]), sollM = soll.map((r) => (r[0] + r[1]) / 2);
      fern = Math.hypot(...mitte.map((v, k) => v - sollM[k]));
      if (fern > 2 * TOL) { fail(`[8] ${id}: die Monitore des Pults stehen im ausgelieferten Modell bei x ${mitte[0].toFixed(3)}, y ${mitte[1].toFixed(3)}, z ${mitte[2].toFixed(3)} (Hallenmeter, Mitte), HALL_LEIT.${id}.bank nennt x ${sollM[0].toFixed(3)}, y ${sollM[1].toFixed(3)}, z ${sollM[2].toFixed(3)} — das Bild des Terminals stuende ${fern.toFixed(2)} m neben seinem Monitor; die Lage der Halle pruefen (Schiffsfeld, HALL_SHIFT.field, floor) oder HALL_LEIT neu vermessen`); continue; }
    }
    // das Glas: dorthin gewandt, wohin HALL_LEIT es nennt (leitAchsen: ohne Angaben nach Sueden, +z),
    // in der Ebene des Schirms, innerhalb seines Rechtecks. Gerechnet in den Achsen des Monitors:
    // quer (u), am Glas hinauf (v), aus dem Glas heraus (w), um die Mitte, die HALL_LEIT nennt.
    const { X, Y, Z } = viewer.leitAchsen(S), M = [S.x + ab[0], S.y + ab[1], S.z + ab[2]];
    const lokal = (p) => { const q = [p[0] - M[0], p[1] - M[1], p[2] - M[2]]; return [q[0] * X[0] + q[1] * X[1] + q[2] * X[2], q[0] * Y[0] + q[1] * Y[1] + q[2] * Y[2], q[0] * Z[0] + q[1] * Z[1] + q[2] * Z[2]]; };
    let fl = 0, n = 0;
    const r = { u: [Infinity, -Infinity], v: [Infinity, -Infinity] };
    for (const [a, b, c] of tri) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0], len = Math.hypot(nx, ny, nz);
      if (!(len > 1e-10) || (nx * Z[0] + ny * Z[1] + nz * Z[2]) / len < 0.95) continue;
      const q = [a, b, c].map(lokal);
      if (q.some((p) => Math.abs(p[2]) > TOL)) continue;
      const mu = (q[0][0] + q[1][0] + q[2][0]) / 3, mv = (q[0][1] + q[1][1] + q[2][1]) / 3;
      if (Math.abs(mu) > S.b / 2 + 2 * TOL || Math.abs(mv) > S.h / 2 + 2 * TOL) continue;
      fl += len / 2; n++;
      for (const p of q) { r.u[0] = Math.min(r.u[0], p[0]); r.u[1] = Math.max(r.u[1], p[0]); r.v[0] = Math.min(r.v[0], p[1]); r.v[1] = Math.max(r.v[1], p[1]); }
    }
    const wohin = S.dreh || S.neig ? `um ${S.dreh ?? 0}° gedrehtes, um ${S.neig ?? 0}° geneigtes` : 'nach Sueden gewandtes';
    if (!n) { fail(`[8] ${id}: bei (${S.x}, ${S.y}, ${S.z}) traegt ${B ? 'das Pult' : 'die Halle'} kein ${wohin} Glas (HALL_LEIT.${id}.schirm) — das Bild des Terminals hinge in der Luft, oder es staenden wieder zwei Schirme hintereinander`); continue; }
    const kanten = [[r.u[0], -S.b / 2], [r.u[1], S.b / 2], [r.v[0], -S.h / 2], [r.v[1], S.h / 2]];
    if (kanten.some(([ist, sollK]) => Math.abs(ist - sollK) > TOL)) { fail(`[8] ${id}: das Glas des Monitors reicht im Modell quer von ${r.u[0].toFixed(3)} bis ${r.u[1].toFixed(3)} und am Glas hinauf von ${r.v[0].toFixed(3)} bis ${r.v[1].toFixed(3)} (m um die Mitte, die HALL_LEIT.${id}.schirm nennt), dort steht ${(-S.b / 2).toFixed(3)} bis ${(S.b / 2).toFixed(3)} und ${(-S.h / 2).toFixed(3)} bis ${(S.h / 2).toFixed(3)} — das Bild des Terminals laege neben dem Glas`); continue; }
    if (!(fl >= 0.97 * S.b * S.h && fl <= 1.01 * S.b * S.h)) { fail(`[8] ${id}: das Glas misst im Modell ${fl.toFixed(3)} m², HALL_LEIT.${id}.schirm nennt ${S.b} × ${S.h} m (${(S.b * S.h).toFixed(3)} m²) — die Flaeche ist nicht mehr eine geschlossene Scheibe`); continue; }
    if (!(S.ecke >= 0 && S.ecke <= Math.min(S.b, S.h) / 4)) { fail(`[8] HALL_LEIT.${id}.schirm.ecke ${S.ecke} m passt nicht zu einem Glas von ${S.b} × ${S.h} m`); continue; }
    glasHallen++; glasFlaeche += fl; glasDreiecke += n; glasFern = Math.max(glasFern, fern);
  }
  // Die Blende beginnt mit der Marke an der Stelle, an der der Monitor sie in Ruhe zeigt
  const M = viewer.LEIT_MARKE;
  if (!(M?.b > 0 && M?.y > 0)) fail('[8] dist/assets/hangar-viewer.js liefert LEIT_MARKE nicht');
  else for (const page of PAGES) {
    const css = /\.hgx-term__mark\{([^}]*)\}/.exec(page.html)?.[1] ?? '';
    const top = /(?:^|;)top:([\d.]+)%/.exec(css)?.[1], breit = /(?:^|;)width:([\d.]+)cqw/.exec(css)?.[1];
    if (!css) fail(`[8] ${page.file}: der Stil der Marke (.hgx-term__mark) fehlt`);
    else if (!(Math.abs(+top / 100 - M.y) < 1e-6 && Math.abs(+breit / 100 - M.b) < 1e-6 && /(?:^|;)left:50%/.test(css))) fail(`[8] ${page.file}: die Marke der Blende steht bei top ${top ?? '—'} %, Breite ${breit ?? '—'} cqw; der Monitor der Halle zeigt sie bei ${+(M.y * 100).toFixed(2)} % der Hoehe und ${+(M.b * 100).toFixed(2)} % der Breite des Fensters (LEIT_MARKE) — beim Hinsetzen spraenge sie`);
  }
}
if (glasHallen < MIN_GLAS_HALLEN) fail(`[8] nur ${glasHallen} Halle(n) mit nachgemessenem Monitor, Klinke ${MIN_GLAS_HALLEN}`);
say(`    ${glasHallen} Halle(n) nachgemessen (Klinke ${MIN_GLAS_HALLEN}): ${glasDreiecke} Dreiecke Glas, ${glasFlaeche.toFixed(3)} m², Monitore hoechstens ${(glasFern * 1000).toFixed(0)} mm neben HALL_LEIT.bank (erlaubt 30 mm)${glasOhne.length ? `; NICHT nachgemessen, weil dieser Bau die Halle nicht ausliefert: ${glasOhne.join(', ')}` : ''}`);

if (fehler.length) {
  console.error(`\nverify-hangar-orte: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\nverify-hangar-orte: ALLE ZUSICHERUNGEN ERFUELLT ✓');
