FROM node:18-alpine AS base

WORKDIR /usr/src/api

COPY package.json package-lock.json* ./

# Run condition properly in a shell
RUN /bin/sh -c "if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; else npm install --production --no-audit --no-fund; fi"

COPY ./src ./src
COPY package*.json ./

ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/index.js"]

