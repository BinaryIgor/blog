#/!bin/bash
rm -r -f tmp
mkdir tmp

cp -r ../src tmp/src
cp ../package.json tmp/package.json
cp ../package-lock.json tmp/package-lock.json
cp ../run_server_app.bash tmp/run_server_app.bash