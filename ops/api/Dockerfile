FROM node:20-alpine

ENV NODE_ENV=production

COPY tmp/ /app
COPY run_server_app.sh /app/run_app.sh

WORKDIR /app

RUN npm ci --omit=dev
RUN chmod +x run_app.sh

ENTRYPOINT [ "./run_app.sh" ]