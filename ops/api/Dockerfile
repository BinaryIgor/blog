FROM node:20-alpine

COPY tmp/ /app
COPY run_server_app.sh /app/run_app.sh

WORKDIR /app

RUN npm ci --omit=dev

ENTRYPOINT exec sh run_app.sh