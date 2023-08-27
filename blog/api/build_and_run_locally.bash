#/!bin/bash
site_dir=${SITE_DIR:-"$PWD/../dist"}
db_path="/tmp/analytics.db"

bash prepare_docker_context.bash

docker build -t binaryigor-blog-api .

docker rm binaryigor-blog-api

exec docker run --name binaryigor-blog-api \
    -e "POSTS_PATH=/blog/posts.json" \
    -e "DB_PATH=/blog-db/analytics.db" \
    -v "${site_dir}:/blog" \
    -v "${db_path}:/blog-db/analytics.db" \
    --network host binaryigor-blog-api