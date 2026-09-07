FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN NODE_ENV=production pnpm --filter @workspace/legal-research run build
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

# The container start command runs the application only. Schema changes are
# applied once per deploy by the pre-deploy command in railway.json, not on
# every container start: `drizzle-kit push --force` auto-approves destructive
# statements, so running it on each restart risked dropping columns and data
# in production. The pre-deploy step uses the non-forced `push`, which fails
# the deploy instead of silently discarding data.
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
