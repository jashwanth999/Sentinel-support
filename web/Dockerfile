FROM node:18-alpine AS base

WORKDIR /usr/src/web

COPY package.json package-lock.json* ./

# Proper conditional check using sh -c
RUN /bin/sh -c "if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi"

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
