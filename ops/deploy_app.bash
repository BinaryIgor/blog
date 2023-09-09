#!/bin/bash
set -e

APP_DIR=${1}
if [ -z $APP_DIR ]; then
    echo "Single argument with APP_DIR is required!"
    exit 1
fi

scripts_dir=${PWD}

source ci_config.env

cd ${APP_DIR}

if [ ! -e ci_config.env ]; then
    echo "Required ci_config.env file doesn't exist!"
    exit 1
fi
source ci_config.env

deploy_dir="$DEPLOY_DIR/$APP"
previous_deploy_dir="$deploy_dir/previous"
latest_deploy_dir="$deploy_dir/latest"
app_package_dir="$APP_DIR/dist"

echo "Deploying $APP to a $REMOTE_HOST host, preparing deploy directories.."

ssh ${REMOTE_HOST} "rm -r -f $previous_deploy_dir;
     mkdir -p $latest_deploy_dir;
     cp -r $latest_deploy_dir $previous_deploy_dir;"

echo
echo "Dirs prepared, copying package, this can take a while..."

scp -r dist/* ${REMOTE_HOST}:${latest_deploy_dir}

echo
echo "Package copied!"

if [ -n "${PRE_DEPLOY_SCRIPT}" ]; then
    echo "Running pre $PRE_DEPLOY_SCRIPT deploy script.."
    ssh ${REMOTE_HOST} "cd ${latest_deploy_dir}; bash ${PRE_DEPLOY_SCRIPT};"
    echo
    echo "Pre deploy scrip was run!"
fi     

echo
echo "Loading and running app, this can take a while.."

ssh ${REMOTE_HOST} "cd $latest_deploy_dir; bash load_and_run_app.bash"

echo
echo "App loaded, checking its logs and status after 5s.."
sleep 5
echo

ssh ${REMOTE_HOST} "docker logs $APP"
echo
echo "App status:"
ssh ${REMOTE_HOST} "docker container inspect -f '{{ .State.Status }}' $APP"

echo "App deployed!"
echo "In case of problems you can rollback to previous deployment: $previous_deploy_dir"