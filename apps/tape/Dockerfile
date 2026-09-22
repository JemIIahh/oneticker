# The Tape on Fly.io (Paris). Built from the repo root: `fly deploy --config apps/tape/fly.toml`.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/clients/package.json packages/clients/
COPY apps/tape/package.json apps/tape/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
COPY scripts scripts/
RUN pnpm install --frozen-lockfile --filter @oneticker/tape...

COPY packages packages/
COPY apps/tape apps/tape/

ENV NODE_ENV=production TAPE_DB_PATH=/data/tape.sqlite PORT=8787
EXPOSE 8787
CMD ["pnpm", "--filter", "tape", "start"]
