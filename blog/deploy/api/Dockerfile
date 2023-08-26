FROM node:19

COPY dist/ /app

WORKDIR /app

RUN npm ci --omit=dev

ENTRYPOINT exec bash run_server_app.bash