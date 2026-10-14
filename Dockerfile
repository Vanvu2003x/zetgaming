FROM node:24-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY public ./public
COPY scripts ./scripts
COPY storefront ./storefront
COPY views ./views

RUN npm run build

ENV NODE_ENV=production
ENV PORT=4173
ENV DB_PATH=/app/data/topup.sqlite
EXPOSE 4173

CMD ["node", "server.mjs"]
