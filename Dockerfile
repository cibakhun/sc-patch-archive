# Build the static Astro site in CI (plenty of RAM), then serve it with nginx.
# Coolify pulls this prebuilt image — no build on the memory-constrained server.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
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
# Schlaegt eins davon fehl, entsteht kein Image und Coolify zieht weiter den
# letzten guten Stand.
RUN npm run test:e2e && node scripts/_verify.mjs && npm run verify:vendor && npm run audit:csp

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Custom server config: security headers (HSTS et al.) + real 404 page.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# Fail the build (in CI) on an invalid config, instead of only finding out when
# the container fails to start on the server.
RUN nginx -t
EXPOSE 80
