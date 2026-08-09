# Build the static Astro site in CI (plenty of RAM), then serve it with nginx.
# Coolify pulls this prebuilt image — no build on the memory-constrained server.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vorschau-Build (deploy-staging.yml setzt STAGING=1): macht die ganze Seite
# unindexierbar und blendet die "VORSCHAU"-Marke ein. Siehe src/lib/seo.ts.
# Leer beim normalen Live-Build — dort aendert sich dadurch nichts.
ARG STAGING=""
ENV STAGING=$STAGING
RUN npm run build

# Qualitaetstor VOR dem Auslieferungs-Image. Hier statt als eigener CI-Schritt,
# weil dist/ an dieser Stelle schon existiert — ein Schritt in deploy-image.yml
# muesste die Seite ein ZWEITES Mal bauen (~3 Min) und wuerde trotzdem nicht
# genau das pruefen, was gleich ins Image wandert.
#
# WELCHE Pruefer hier laufen, steht seit dem 09.08.2026 NICHT mehr in dieser
# Zeile, sondern in scripts/lib/gate-registry.mjs — Schiene A. Grund: die
# Torliste existierte vorher genau einmal, naemlich hier; package.json wusste
# nichts von ihr, lokal gab es keinen Begriff von "dem Tor", und ein neues
# Pruefskript konnte lose liegen bleiben. Genau so entstanden neun Pruefer
# ohne Tor, von denen zwei ROT waren, ohne dass es jemand wusste. `npm run
# gate` faehrt jetzt dieselbe Kette hier wie auf dem Entwicklungsrechner, und
# verify:wiring (erste Strecke) reisst, sobald Verzeichnis, Dateibestand und
# package.json auseinanderlaufen. Konzept: docs/maschinelle-validierung.md.
#
# Jede Strecke traegt ihre Begruendung im Verzeichnis. Das gemeinsame Muster
# dahinter: sie alle fangen Fehler, die NICHTS sichtbar brechen — die Seite
# baut, laedt und funktioniert, sie ist nur wieder schlechter (falsche
# Bauteilgroesse, gerissene Skala, Kontrast-Rueckfall, halbe Sprachfassung,
# still verworfene Hellmodus-Farbe). Ein Mensch entdeckt so etwas Wochen
# spaeter oder nie.
#
# Umgebung hier: kein git, kein Netz, keine Data.p4k. Wer eine Strecke
# anhaengt, die eines davon braucht, gehoert auf Schiene B (gate:data) —
# verify-wiring Zusicherung 4 erzwingt die Deklaration.
#
# Schlaegt eine Strecke fehl, entsteht kein Image und Coolify zieht weiter
# den letzten guten Stand.
RUN npm run gate

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Custom server config: security headers (HSTS et al.) + real 404 page.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# Die Vorschau darf nicht in die Live-Statistik zaehlen. Cloudflare haengt den
# Web-Analytics-Zaehler ZONENWEIT ins HTML, also auch auf staging.verse-base.com;
# abschalten laesst er sich nur fuer die ganze Zone. Ohne die zwei Hosts blockt
# die CSP ihn dort aber genau so, wie sie es vom 28. bis 31.07.2026 versehentlich
# live tat — der Zaehler laedt nicht, die Vorschau taucht in keiner Zahl auf.
# In der Konsole der Vorschau steht dann ein CSP-Verstoss fuer den Beacon: der
# ist gewollt und kein Fehler. Das grep ist die Gegenprobe zum sed — greift es
# nicht mehr (z. B. weil die Direktive umbenannt wurde), entsteht kein Image.
ARG STAGING=""
RUN if [ -n "$STAGING" ]; then \
      sed -i '/^map \$http_cookie \$vb_rum_/,/^}/ s|^\( *default *\).*;|\1"";|' /etc/nginx/conf.d/default.conf; \
      ! sed -n '/^map \$http_cookie \$vb_rum_/,/^}/p' /etc/nginx/conf.d/default.conf | grep -q 'default .*https'; \
    fi

# Fail the build (in CI) on an invalid config, instead of only finding out when
# the container fails to start on the server.
RUN nginx -t
EXPOSE 80
