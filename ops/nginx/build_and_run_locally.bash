#/!bin/bash
site_dir=${SITE_DIR:-"$PWD/../../dist"}

docker build -t binaryigor-nginx .

docker rm binaryigor-nginx

exec docker run --name binaryigor-nginx \
    -v "$PWD/certs/selfsigned.crt:/etc/letsencrypt/live/api.binaryigor.com/fullchain.pem" \
    -v "$PWD/certs/selfsigned.key:/etc/letsencrypt/live/api.binaryigor.com/privkey.pem" \
    -v "${site_dir}:/usr/share/nginx/site:ro" \
    --network host binaryigor-nginx