# ─────────────────────────────────────────────────────────────────────────────
#  VerseBase rank/data bot — built in CI (GitHub Actions), pulled by Coolify.
#
#  Build context is the REPO ROOT (so the image can bundle the site's data
#  snapshot + manufacturer logos). Build from the repo root:
#     docker build -f discord/bot/Dockerfile -t verse-base-rank-bot .
#
#  The token is NEVER baked in — it comes from the DISCORD_TOKEN env var at
#  runtime (set it as a secret in Coolify). The SQLite DB lives on a volume.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

# better-sqlite3 / @napi-rs/canvas ship prebuilt linux-x64 binaries; the build
# toolchain is only a fallback in case a prebuild is ever unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies against the bot's own manifest.
COPY discord/bot/package.json discord/bot/package-lock.json ./
RUN npm ci --omit=dev

# Bot source (src/ + assets/fonts for the rank card). node_modules/.env/data are
# excluded by .dockerignore, so nothing local is copied over.
COPY discord/bot/ ./

# Bundle the game-data snapshot + manufacturer logos read at runtime.
COPY src/data /app/gamedata
COPY assets/manufacturers /app/logos

ENV NODE_ENV=production \
    DATA_DIR=/app/gamedata \
    LOGO_DIR=/app/logos \
    DB_PATH=/app/data/leveling.db

# Persistent SQLite lives here — mount a Coolify volume at /app/data.
RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME /app/data

CMD ["node", "src/index.mjs"]
