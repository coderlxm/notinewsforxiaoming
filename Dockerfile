FROM node:24-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

FROM node:24-bookworm-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/data ./data

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV NODE_OPTIONS=--dns-result-order=ipv4first

RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo "Asia/Shanghai" > /etc/timezone

CMD ["npx", "tsx", "src/resident.ts"]