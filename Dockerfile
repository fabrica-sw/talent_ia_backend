# Stage 1: Build Backend Bundle
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
EXPOSE 3000
CMD ["node", "dist/server.cjs"]

