# ── Base: Node + Python (pylint + semgrep) ────────────────────────────────────
FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir pylint==3.2.0 semgrep==1.75.0

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Deps: install node_modules ────────────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json           apps/api/
COPY packages/shared/package.json    packages/shared/

RUN pnpm install --frozen-lockfile

# ── Build: compile TypeScript ─────────────────────────────────────────────────
FROM deps AS build

COPY . .

RUN pnpm --filter @cr/shared build \
 && pnpm --filter @cr/api exec prisma generate \
 && pnpm --filter @cr/api build

# ── Runtime: minimal production image ─────────────────────────────────────────
FROM base AS runtime

WORKDIR /app

COPY --from=build /app/node_modules             ./node_modules
COPY --from=build /app/packages                 ./packages
COPY --from=build /app/apps/api/dist            ./apps/api/dist
COPY --from=build /app/apps/api/node_modules    ./apps/api/node_modules
COPY --from=build /app/apps/api/prisma          ./apps/api/prisma
COPY --from=build /app/apps/api/package.json    ./apps/api/package.json

ENV NODE_ENV=production
EXPOSE 8080

# Run migrations then start; Render injects DATABASE_URL at runtime.
# Use the bundled Prisma CLI so npx does not download a newer Node-incompatible version.
CMD ["sh", "-c", "cd apps/api && ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node dist/server.js"]
