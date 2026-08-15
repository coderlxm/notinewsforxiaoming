# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV HUSKY=0

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/lu-dashboard/package.json ./apps/lu-dashboard/package.json
RUN pnpm install --frozen-lockfile --filter @notinews/lu-dashboard...

COPY apps/lu-dashboard ./apps/lu-dashboard
RUN pnpm --filter @notinews/lu-dashboard build \
  && pnpm --filter @notinews/lu-dashboard deploy --prod --legacy /release

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV LU_DASHBOARD_PORT=8787

WORKDIR /app

COPY --from=builder /release ./

RUN printf '%s\n' \
  "fetch('http://127.0.0.1:8787/api/session')" \
  "  .then((response) => { if (!response.ok) process.exit(1); })" \
  "  .catch((error) => { console.error(error); process.exit(1); });" \
  > /usr/local/bin/lu-dashboard-healthcheck.mjs \
  && chown -R node:node /app

USER node

EXPOSE 8787

CMD ["node", "dist/server/server.js"]
