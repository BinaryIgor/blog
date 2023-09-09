#/!bin/bash
set -e

rm -r -f tmp
mkdir tmp

api_dir=${PWD}

cd ../../

api_tmp=ops/api/tmp

cp -r src $api_tmp
cp package.json $api_tmp/package.json
cp package-lock.json $api_tmp/package-lock.json

cd $api_dir

envsubst < prepare_assets_dir.bash > dist/prepare_assets_dir.bash