FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (needed for bcrypt) and OpenSSL for Prisma engine detection.
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ---- Runtime ----
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY tsconfig.json ./

EXPOSE 3001

CMD ["node", "dist/main.js"]
