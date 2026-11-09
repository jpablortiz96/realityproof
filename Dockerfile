# Builds the web app and API into one image. The AG Studio licence key is optional and,
# being a VITE_ variable, ends up in the browser bundle: never pass a server secret here.
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile
COPY packages ./packages
COPY apps ./apps
# Node sizes its heap from the container's memory, which is too small for the web build on a
# 2 GB host. Measured: 1.6 GB RAM plus 2 GB swap builds in about 2 minutes with this setting.
ENV NODE_OPTIONS=--max-old-space-size=3072
ARG VITE_AG_STUDIO_LICENSE_KEY=""
ENV VITE_AG_STUDIO_LICENSE_KEY=$VITE_AG_STUDIO_LICENSE_KEY
RUN pnpm build

# Production dependencies of the API only: the web app ships as its built bundle.
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --prod --filter @realityproof/api...

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV PRIVATE_STORAGE_DIR=/data/private-evidence
COPY --from=deps /app ./
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY evidence ./evidence
COPY scripts/docker-entrypoint.sh /usr/local/bin/realityproof-entrypoint
# A checkout or ZIP made on Windows can carry CRLF, which would stop the container from starting.
RUN sed -i 's/\r$//' /usr/local/bin/realityproof-entrypoint && chmod 755 /usr/local/bin/realityproof-entrypoint && mkdir -p /data/private-evidence && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["realityproof-entrypoint"]
CMD ["node", "apps/api/dist/server.js"]
