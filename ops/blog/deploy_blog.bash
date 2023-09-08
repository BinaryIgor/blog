#!/bin/bash
set -e
dist_dir="dist"

cd ..

source ci_config.env

cd ..

if [ ! -d "$dist_dir" ]; then
    echo "$dist_dir dir with blog assets doesn't exist"
    exit 1
fi

deploy_dir="$DEPLOY_DIR/$APP"
previous_deploy_dir="$deploy_dir/previous"
latest_deploy_dir="$deploy_dir/latest"
app_package_dir="$APP_DIR/dist"

echo "Deploying blog to a $REMOTE_HOST host, preparing static assets directories.."

ssh ${REMOTE_HOST} "mkdir -p $ASSETS_DIR;
     mkdir -p $BLOG_DIR;
     rm -r -f $BLOG_DEPLOY_DIR;
     mkdir $BLOG_DEPLOY_DIR;"

echo
echo "Dirs prepared, copying blog assets, this can take a while..."

scp -r "${dist_dir}/*" ${REMOTE_HOST}:${BLOG_DEPLOY_DIR}

echo
echo "Assets copied, swapping ${BLOG_DIR} with deployed content of ${BLOG_DEPLOY_DIR}..."

ssh ${REMOTE_HOST} "rm -rf ${BLOG_DIR}/*; mv ${BLOG_DEPLOY_DIR}/* ${BLOG_DIR}"

echo "Blog deployed!"