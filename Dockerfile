# ---- Build stage --------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install ALL deps (incl. dev) to compile TypeScript.
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies for a slim runtime node_modules.
RUN npm prune --omit=dev

# ---- Runtime stage ------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as the built-in non-root `node` user.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package*.json ./

USER node
EXPOSE 3000

# dist/src/main.js because src/ is the configured sourceRoot.
CMD ["node", "dist/src/main.js"]
