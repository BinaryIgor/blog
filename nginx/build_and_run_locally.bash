#/!bin/bash
site_dir=${SITE_DIR:-"$PWD/../dist"}

docker build -t binary-igor-blog .

docker rm binary-igor-blog

exec docker run --name binary-igor-blog \
    -v "$PWD/certs/selfsigned.crt:/etc/letsencrypt/live/binaryigor.com/fullchain.pem" \
    -v "$PWD/certs/selfsigned.key:/etc/letsencrypt/live/binaryigor.com/privkey.pem" \
    -v "${site_dir}:/usr/share/nginx/site:ro" \
    --network host binary-igor-blog