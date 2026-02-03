# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm ci --prefix backend
RUN npm ci --prefix frontend

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/backend/node_modules backend/node_modules
COPY --from=deps /app/frontend/node_modules frontend/node_modules
COPY backend backend
COPY frontend frontend
RUN npm --prefix frontend run build
RUN npm --prefix backend run build
RUN mkdir -p backend/dist/public && cp -R frontend/dist/* backend/dist/public/

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
