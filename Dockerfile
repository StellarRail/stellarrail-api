FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:20-alpine AS runner
RUN addgroup -S app && adduser -S app -G app && apk add --no-cache dumb-init wget
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/openapi.json ./openapi.json
RUN npm ci --omit=dev
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/api/v1/health/live || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
