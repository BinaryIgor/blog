#/!bin/bash
site_dir=${SITE_DIR:-"$PWD/../../dist"}
db_path="/tmp/analytics.db"

rm -r -f dist
mkdir dist

cp -r ../../src dist/src
cp ../../package.json dist/package.json
cp ../../package-lock.json dist/package-lock.json
cp ../../run_server_app.bash dist/run_server_app.bash

docker build -t binary-igor-blog-api .

docker rm binary-igor-blog-api

exec docker run --name binary-igor-blog-api \
    -e "POSTS_PATH=/blog/posts.json" \
    -e "DB_PATH=/blog-db/analytics.db" \
    -v "${site_dir}:/blog" \
    -v "${db_path}:/blog-db/analytics.db" \
    --network host binary-igor-blog-api