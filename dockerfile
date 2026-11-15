FROM node:26-slim AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --prod

COPY . .

FROM gcr.io/distroless/nodejs26-debian13

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 3000

CMD ["server.js"]