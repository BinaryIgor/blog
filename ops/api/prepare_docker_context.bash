#/!bin/bash
set -e

rm -r -f tmp
mkdir tmp

cd ../../

api_tmp=ops/api/tmp

cp -r src $api_tmp
cp package.json $api_tmp/package.json
cp package-lock.json $api_tmp/package-lock.json