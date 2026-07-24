FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack enable
RUN pnpm install 

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]