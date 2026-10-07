# Halle: Spiegelungssonden aus dem Spiel (2026-10-07 abends)

Auslöser für die PC-Sitzung: **„Hallensonden“**. Folgt auf „Halle Tiefe“
(7748b0a): volle Stufe, Einrichtung und Lampen sind drin.

## Stand (Cloud)

- Die Lampenliste kommt jetzt ausgerichtet an (`v: 2`): Spots aus dem
  Z-oben-Raum nach glTF umgerechnet (x, z, −y), Flächenlichter an ihrer Fläche
  ausgerichtet. Der Build macht das ab jetzt selbst
  (`scripts/lib/hall-lights.mjs`, aufgerufen in `hallLights`).
  Nachgeprüft per Strahl: 24 von 26 montierten Spots zeigen von ihrer Fläche
  weg, 220 von 385 Flächenlichtern sitzen an einer Fläche.
- Der Viewer rendert die Spiegelungen bisher selbst: eine Umgebungskugel aus
  der geladenen Halle in Schiffsmitte. Das ist eine Annäherung. Im Spiel
  kommen Spiegelungen und Streulicht aus den Umgebungssonden der Halle, mit
  dem echten Licht des Spiels aufgenommen.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. Die Umgebungssonden der Halle finden: Entities im socpak der Halle (und
   in Kind-Containern) mit Würfelkarte, etwa `EnvironmentProbe` bzw. Namen wie
   `probe_*`. Je Sonde: Name, Position (glTF-Raum der Halle, wie die Lampen),
   Ausdehnung der Box, Priorität/Abschwächung, falls genannt, und die Pfade
   der Würfelkarten (spiegelnd `_cm`, diffus `_cm_diff` o. ä.).
3. Die Würfelkarten dekodieren (HDR, meist BC6H), höchste Stufe ≤ 512 px je
   Seite, und als **Equirect-HDR** schreiben (Radiance `.hdr`, RGBE,
   1024 × 512 für spiegelnd; diffus darf 128 × 64 sein). Seitenreihenfolge
   und Achsen (Z oben im Spiel) so drehen, dass +Y oben ist und die Karte zur
   Halle im GLB passt: ein Fenster oder eine Lampe der Halle muss in der
   Karte in derselben Richtung liegen wie im GLB von der Sondenposition aus.
4. Ablage: `public/hangar/hall/revelyork-single.probes/<sonde>.hdr` und eine
   Liste `public/hangar/hall/revelyork-single.probes.json`:
   `{ "probes": [{ "name": "…", "pos": [x,y,z], "box": [hx,hy,hz],
   "spec": "<sonde>.hdr", "diff": "<sonde>_diff.hdr", "priority": n }] }`.
5. Selbstauskunft im Build: Anzahl Sonden, Größe je Karte, mittlere
   Helligkeit je Karte (soll > 0 und nicht einfarbig sein).
6. Größe gesamt möglichst ≤ 4 MB.
7. Build + Gate (normal und STAGING=1), committen, pushen. Kein PR: Den
   Viewer (Sonde statt selbst gerenderter Umgebungskugel) und die
   Sichtprüfung macht die Cloud.
