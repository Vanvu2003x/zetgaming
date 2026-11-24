FROM node:24-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs ./
COPY backend ./backend
COPY admin ./admin
COPY public ./public
COPY scripts ./scripts
COPY storefront ./storefront
COPY shared ./shared
COPY views ./views

RUN npm run build

ENV NODE_ENV=production
ENV PORT=4173
USER node
EXPOSE 4173 4174 4180

CMD ["node", "server.mjs"]
