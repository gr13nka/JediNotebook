FROM node:20-alpine AS client-build
WORKDIR /app
COPY shared/ shared/
COPY client/package.json client/package-lock.json* client/
RUN cd client && npm install
COPY client/ client/
RUN cd client && npm run build

FROM node:20-alpine
WORKDIR /app
COPY shared/ shared/
COPY server/package.json server/package-lock.json* server/
RUN cd server && npm install
COPY server/ server/
COPY --from=client-build /app/client/dist client/dist/
RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/timer.db
EXPOSE 3000
WORKDIR /app/server
CMD ["npx", "tsx", "src/index.ts"]
