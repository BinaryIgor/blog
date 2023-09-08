#!/bin/bash
set -e

APP_DIR=${1}
if [ -z $APP_DIR ]; then
    echo "Single argument with APP_DIR is required!"
    exit 1
fi

scripts_dir=${PWD}

cd ..

if [ -e ci_config.env ]; then
    source ci_config.env
fi

cd ${APP_DIR}

if [ ! -e ci_config.env ]; then
    echo "Required ci_config.env file doesn't exist!"
    exit 1
fi
source ci_config.env

tag="${TAG:-latest}"
tagged_image="${APP}:${tag}"

echo "Creating package in dist directory for $tagged_image image..."
echo "Preparing dist dir in $APP_DIR.."

rm -r -f dist
mkdir dist

echo "Building image..."

if [ -n "${PRE_BUILD_SCRIPT}" ]; then
    echo "Running pre $PRE_BUILD_SCRIPT build script.."
    bash ${PRE_BUILD_SCRIPT}
fi

docker build . -t ${tagged_image}

gzipped_image_path="dist/$APP.tar.gz"

echo "Image built, exporting it to $gzipped_image_path, this can take a while..."

docker save ${tagged_image} | gzip > ${gzipped_image_path}

echo "Image exported, preparing scripts..."

export app=$APP
export tag=$tag

export pre_run_cmd="${PRE_RUN_CMD:-}"

extra_run_args="${EXTRA_RUN_ARGS:-}"
export run_cmd="docker run -d $extra_run_args --restart unless-stopped --network host --name $app $tagged_image"

export post_run_cmd="${POST_RUN_CMD:-}"

envsubst '${app} ${tag}' < "$scripts_dir/template_load_and_run_app.bash" > dist/load_and_run_app.bash

envsubst '${app} ${pre_run_cmd} ${run_cmd} ${post_run_cmd}' < "$scripts_dir/template_run_app.bash" > dist/run_app.bash

echo "Package prepared."
