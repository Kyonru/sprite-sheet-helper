FROM node:22-bookworm-slim AS builder

ENV HUSKY=0
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/zustand-inspector/package.json packages/zustand-inspector/package.json
RUN npm ci

COPY . .
RUN npm run build:cli

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-dejavu-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libgbm1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/sprite-sheet-helper

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/dist ./dist
COPY docker/action-entrypoint.sh ./docker/action-entrypoint.sh
COPY docker/cli-entrypoint.sh /usr/local/bin/sprite-sheet-helper

RUN chmod +x /usr/local/bin/sprite-sheet-helper ./docker/action-entrypoint.sh

WORKDIR /work

ENTRYPOINT ["sprite-sheet-helper"]
