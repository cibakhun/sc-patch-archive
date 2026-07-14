# Build the static Astro site in CI (plenty of RAM), then serve it with nginx.
# Coolify pulls this prebuilt image — no build on the memory-constrained server.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Custom server config: security headers (HSTS et al.) + real 404 page.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# Fail the build (in CI) on an invalid config, instead of only finding out when
# the container fails to start on the server.
RUN nginx -t
EXPOSE 80
