# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV HUSKY=0

RUN corepack enable \
  && corepack prepare pnpm@11.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS web-builder

COPY web ./web
COPY src/shared ./src/shared
RUN pnpm exec vite build web --config web/vite.config.ts

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV JOURNAL_WEB_HOST=0.0.0.0
ENV JOURNAL_WEB_PORT=3100
ENV JOURNAL_DATA_DIR=/data
ENV JOURNAL_WEB_ROOT=/app/web/dist

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json
COPY --from=web-builder /app/web/dist ./web/dist
COPY src/journal-server ./src/journal-server
COPY src/shared ./src/shared

RUN printf '%s\n' \
  "fetch('http://127.0.0.1:3100/api/health')" \
  "  .then((response) => { if (!response.ok) process.exit(1); })" \
  "  .catch((error) => { console.error(error); process.exit(1); });" \
  > /usr/local/bin/journal-healthcheck.mjs \
  && chown -R node:node /app

USER node

EXPOSE 3100

CMD ["./node_modules/.bin/tsx", "src/journal-server/index.ts"]
