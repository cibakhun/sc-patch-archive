# Attrappe 012 — Schiffskarte „Ruhe"

**Wegwerf-Entwurf, kein Produktionscode.** Richtung „RSI-nah: Kärtchen, aber
weich", Betreiberwahl vom 18.08.2026. Reichweite vorerst nur die
Schiffs-Detailseite.

Öffnen: `index.html` direkt im Browser. Daten sind die echten der Carrack aus
dem gebauten `dist/`.

---

## Wogegen der Entwurf antritt — gemessen, nicht geschätzt

Drei Referenzen am selben Tag ausgemessen (Konsent-Schicht nur ausgeblendet,
nicht bedient):

| | RSI | star-citizen.tools | VerseBase heute |
| --- | --- | --- | --- |
| Höhe | 3.586 px / 4,0 Bildschirme | 7.751 px / **8,6** | 4.189 px / 5,8 |
| Datenmenge | sehr wenig (8 Werte, Rest hinter Reitern + 7 Akkordeons) | sehr viel | viel |
| Schriftgrade | **3** | wenige | **14** |
| Versalien | **0** | fast keine | **107 von 243 Textläufen** |
| Eckenradien | 8 / 16 px | weich | **0 px bei 60 von 60 Blöcken** |
| Rahmen | 0 px bei 226 von 227 Elementen | keine | 1–2 px an jedem Block |
| Fließtext | `#a8b3bd` warmes Grau | Grau | `#8a99b8` blaues Grau |

**Die Wiki ist mehr als doppelt so lang wie RSI und liest sich trotzdem ruhig.**
Ruhe kommt also nicht von Kürze, sondern von: Leerraum, wenigen Schriftgraden,
gemischter Schreibung, weichen Flächen statt Rahmen — und genau EINEM lauten
Element.

RSIs Flächenleiter, ausgelesen: `#0a1d29` → `#0f2c3e` → `#143a52` → `#194967`.
Vier eng beieinanderliegende Stufen, kein harter Sprung.

⚠ **Was von RSI NICHT übernommen wird:** Model, Specifications, Avionics,
Propulsions, Thrusters, Systems und Weaponry liegen dort alle zugeklappt hinter
Akkordeons. Das ist genau das, was `14-CONTEXT.md` D-01 gesperrt hat.

---

## Was der Entwurf tut

| | heute | Attrappe |
| --- | --- | --- |
| Höhe (1280 × 720) | 4.189 px / 5,8 Bildschirme | **3.336 px / 4,6** |
| Versalien | 107 | **0** |
| Schriftgrade | 14 | **5** (12 / 15 / 19 / 34 / 46) |
| Flächenstufen | — | 3 (+ 1 für Chips) |
| Eckenradien | 0 px | 8 / 10 / 18 px |
| Sichtbare Rahmen | an jedem Block | **keine** — Flächen und Haarlinien |

**Die Mittel im Einzelnen:**

- **Hero wird eine Karte mit definierter Höhe** statt einer 540-px-Bühne.
  Dadurch passen Hero, Kennwerte-Band und Sprungleiste zusammen über den Falz —
  das löst WINDOWS.md id 14 (Sprungleiste klebt auf der Falzkante, nur 34 px
  Platz) ersatzlos auf, statt es zu verwalten.
- **Kapitel-Unterscheidung leiser:** statt vier farbiger Rahmenoberkanten nur
  noch ein 3-px-Strich links neben dem Titel. Die Trennung trägt der Leerraum
  (64 px zwischen Kapiteln), nicht die Farbe.
- **Wertzeilen mit Haarlinie**, Wert rechtsbündig — die Wiki-Methode, viel
  ruhiger als Kästchenraster und dabei dichter.
- **Balken nur beim Perzentil** (unverändert aus Phase 14, D-02).
- **Ein lautes Element:** der Preis in Gold. Sonst nichts.
- **Die Beschreibung bekommt endlich einen Ort** — sie schließt das Kapitel
  „Leistung" ab, statt heimatlos zwischen zwei Kapiteln zu treiben.
- **Versicherung wandert zu „Kaufen"** unter „Verfügbarkeit" — sie beantwortet
  eine Kauffrage, keine Ausstattungsfrage.

---

## Was die Attrappe NICHT zeigt

Bewusst weggelassen, damit der Entwurf nicht mehr verspricht, als er geprüft hat:

- Hologramm-Bühne, Video-/Bilder-/3D-Umschalter
- Merken-Knopf und alles Kontogebundene
- Grundriss-Zeichnung (Draufsicht) aus „Maße & Fracht"
- Mehr als ein Verkaufsort im Kauf-Kapitel
- Hellmodus (Betreiber baut ihn nicht mehr mit)
- Lackierungs- und Schiffsbilder sind graue Platzhalter

## Offene Fragen an den Betreiber

1. Trägt der leise Kapitelstrich, oder war die farbige Rahmenoberkante aus
   Phase 14 doch das bessere Mittel gegen „zehn gleiche Kästen"?
2. Ist die Sprungleiste als reine Textzeile zu leise geworden?
3. Der Hero verliert die Hologramm-Bühne an Fläche — ist das ein Verlust oder
   ein Gewinn?
