#/!bin/bash
site_dir=${SITE_DIR:-"$PWD/../dist"}
db_dir="/tmp/analytics"

bash prepare_docker_context.bash

docker build -t binaryigor-blog-api .

docker rm binaryigor-blog-api

exec docker run --name binaryigor-blog-api \
    -e "POSTS_PATH=/blog/posts.json" \
    -e "DB_PATH=/blog-db/analytics.db" \
    -e "DB_BACKUP_PATH=/blog-db/analytics_backup.db" \
    -v "${site_dir}:/blog" \
    -v "${db_dir}:/blog-db" \
    --network host binaryigor-blog-api