# --- build do frontend (mesma origem: API em /api) ---
FROM node:20-slim AS build
WORKDIR /app
ENV VITE_API_URL=/api
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime: Caddy serve o estático e faz proxy de /api ---
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
