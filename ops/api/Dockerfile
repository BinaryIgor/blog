FROM node:22-alpine

COPY tmp/ /app
COPY run_server_app.sh /app/run_app.sh

WORKDIR /app

RUN npm ci --omit=dev
RUN chmod +x run_app.sh

ENTRYPOINT [ "./run_app.sh" ]