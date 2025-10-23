#/!bin/bash
db_dir="/tmp/analytics"

bash prepare_build_context.bash

docker build -t binaryigor-api .

docker rm binaryigor-api

exec docker run --name binaryigor-api \
    -e "DB_PATH=/blog-db/analytics.db" \
    -e "DB_BACKUP_PATH=/blog-db/analytics_backup.db" \
    -e "BUTTON_DOWN_API_KEY=__API_KEY__" \
    -v "${db_dir}:/blog-db" \
    --network host binaryigor-api