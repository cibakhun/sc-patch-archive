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
#   test:e2e       — Verhalten des Item-Finders + Integritaet der Item-DB
#   _verify        — jede lokale href/src/url() in dist/ zeigt auf eine Datei
#   verify:vendor  — das handkopierte three.js passt zur devDependency
#   audit:csp      — die Content-Security-Policy in nginx/default.conf deckt
#                    alles ab, was der Build wirklich laedt. Muss HIER laufen:
#                    eine zu enge CSP bricht nicht beim Deploy, sondern still
#                    im Browser des Besuchers.
#   verify:crafting — die Bauteil-Kennwerte auf den Crafting-Karten stimmen mit
#                    den Spieldaten ueberein, und gleichnamige Blueprints, die
#                    in Wahrheit verschiedene Items sind, bleiben gesperrt. Muss
#                    HIER laufen: eine neue Namenskollision nach einem Datenlauf
#                    bricht nichts sichtbar — sie zeigt still die Groesse eines
#                    fremden Items.
#   verify:typo    — Schriftgrad/Laufweite/Uebergangsdauer kommen site-weit aus
#                    der Skala in assets/theme.css statt aus seitenlokalen
#                    Einzelwerten (Phase 2, TYPO-01/02). Muss HIER laufen:
#                    eine gerissene Skala bricht nichts sichtbar — die Seite
#                    baut, laedt und funktioniert, sie sieht nur wieder aus wie
#                    vorher. Derselbe Ausfallmodus wie bei verify:crafting oben.
# Schlaegt eins davon fehl, entsteht kein Image und Coolify zieht weiter den
# letzten guten Stand.
RUN npm run test:e2e && node scripts/_verify.mjs && npm run verify:vendor && npm run audit:csp && npm run verify:crafting && npm run verify:typo

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
