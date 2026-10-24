FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@10.28.2

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/api/package.json apps/api/package.json
COPY --chown=node:node packages/ui/package.json packages/ui/package.json
COPY --chown=node:node packages/schemas/package.json packages/schemas/package.json
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .
RUN pnpm build:web
RUN mkdir -p /app/image-vitepress \
    && cp -R knowledge/published/.vitepress/config.ts knowledge/published/.vitepress/theme /app/image-vitepress/

ENV API_HOST=127.0.0.1 \
    API_PORT=3001 \
    KNOWLEDGE_ROOT=/app/knowledge

CMD ["sh", "-c", "cp -R /app/image-vitepress/. /app/knowledge/published/.vitepress/ && pnpm build:web && exec pnpm start"]
