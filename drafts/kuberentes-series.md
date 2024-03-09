# Let's replace Kubernetes with a few scripts/tools - build app
# Let's replace Kubernetes with a few scripts/tools - secrets
# Let's replace Kubernetes with a few scripts/tools - deploy app
# Let's replace Kubernetes with a few scripts/tools - service discovery

## Build App

Based on what we said earlier, to build a ready to deploy app, we need to:
* containerize the app and build its image
* have some kind of *config file* that describes its config params, environment variables, secrets, init/helper scripts etc.
* have a *build script* that uses a *config file* for a given *environment* (local, dev, stage, prod etc.) to build app image and and create its *package* - self-contained, ready to be deployed artifact of our app

Let's say that we have an app called *some-custom-app*. Here is the example json config file that describes its config/requirements (*${variable}* is a variable reference, which can interpreted by our *build script*):
```
{
  "dir": "apps/some-custom-app",
  "build_cmd": "bash build_cmd.bash".
  "volumes": [
    "${secrets-path}:/secrets:ro",
    "${static-files}:/static:ro"
  ],
  "env": {
    "JVM_OPTS": "-Xmx750m",
    "SERVER_PORT": "8080",
    "ENV": "prod",
    "DB_URL": "jdbc:postgresql://main-db:5432/simple-stack-system",
    "DB_USER": "simple-stack-system",
    "DB_PASSWORD": "file:/secrets/db-password.txt",
    "JWT_TOKEN_KEY": "file:/secrets/jwt-token-key.txt",
    "SMTP_SERVER_TOKEN": "file:/secrets/smtp-server-token.txt"
  },
  "secrets": [
    "db-password",
    "jwt-token-key",
    "smtp-server-token'
  ],
  "network": "host",
  "memory": "1000M",
  "cpus": 1
}
```

Then, let's say that *build_cmd.bash* just builds a Docker image:
```
#!/bin/bash
# CI_TAG is injected by another script and could be a commit hash or now() timestamp for example
# if we need to compile/package our app before building its container, we can run things like
# mvn clean install, npm install & npm run build and so on
docker build . -t "some-custom-app:${CI_TAG}"
```

Then, depending whether we run this *build script* locally or on a dedicated build machine (both approaches can be valid, depending on our needs), we have a prepared image of our app on the machine, where we have run our build script.

We have build our app image locally, so its available on the machine, where we execute the *build script*. Depending on your needs, this script can be executed on a local machine or on dedicated *build machine*. In the early days of a system and where you have one person/team, it is completely fine to start with the approach, where:
```
build_machine = local_machine
```

There can be potential problems down the line with this approach, but it is definitely enough at the start. In the long term, we can have security-related concerns and there also can be issues with builds reproducibility, because of the difference between various, local machines.

That is the first that our *build script* needs to accomplish - build our app image; but as we said that is not enough. It then, based on our app *config file*, needs to create an app *package* that contains all needed information to deploy our application to whatever *environment* we want to deploy it. That package could consists of just a container image + set of scripts. As a bare minimum, we need to have to scripts:
* *load_and_run_app* - loads an app container, either from a local file or private image registry 
* *run_app* - runs app image loaded in the previous step with proper parameters, volumes, environment variables etc. Can also run some additional pre and post app run scripts, depending on our app needs - we can implement zero downtime deployment in that way, for example

Our *load_and_run_app* script can just be:
```
#!/bin/bash
echo "Loading some-custom-app:20240211134902 image, this can take a while..."

docker load < some-custom-app.tar.gz

# ...instead of loading image from local file we can also do:
# docker login ${private-image-registry-url}
# docker pull ${private-image-registry-url}/some-custom-app:20240211134902

echo "Image loaded, running it..."
exec bash run_app.bash
```
And *run_app*:
```
#!/bin/bash
found_container=$(docker ps -q -f name="some-custom-app")
if [ "$found_container" ]; then
  echo "Stopping previous some-custom-app version..."
  docker stop some-custom-app --time 30
fi

echo "Removing previous container...."
docker rm some-custom-app

echo
echo "Starting new some-custom-app version..."
echo

# /home/simple-stack-system/.secrets is a directory with secrets
docker run -d --restart unless-stopped \
-v "/home/simple-stack-system/.secrets:/secrets:ro" \
-v "/home/simple-stack-system/static:/static" \
-e "JVM_OPTS=-Xmx750m" \
-e "SERVER_PORT=8080" \
-e "ENV=dev" \
-e "DB_URL=jdbc:postgresql://main-db:5432/simple-stack-system" \
-e "DB_USER=simple-stack-system" \
-e "DB_PASSWORD=file:/secrets/db-password.txt" \
-e "JWT_TOKEN_KEY=file:/secrets/jwt-token-key.txt" \
-e "SMTP_SERVER_TOKEN=file:/secrets/smtp-server-token.txt" \
--memory "1000M" \
--cpus 1 \
--network "host" \
--name some-custom-app \
some-custom-app:20240203201257
```
Now, we have an app *package* that consists of:
* container (docker) image
* *load_and_run_app* script
* *run_app* script

We can then independently decide to:
* simply deploy this package from the machine where we run *build script* by just using *ssh/scp* protocol
* upload container image to a private image registry and/or upload scripts to remote storage/volume/service like AWS S3, Digital Ocean Spaces or <a href="https://docs.gitlab.com/ee/user/packages/generic_packages/" target="blank">Gitlab package repository</a>; in that case, we need to pull these files during the deployment process

Is also worth emphasizing, what we assume when using this approach. We assume, that on every machine there is a *simple-stack-system* user - that is a part of machine preparation procedure, among other things, like installing and configuring Docker for example. Thanks to that, we can make other assumptions that can greatly simplify our work:
* in */home/simple-stack-system/deploy* we can have directories, scoped per app, with lately deployed packages, which give both history and an ability to quickly rollback to previous version/versions
* in */home/simple-stack-system/.secrets* we can store secrets that are then read by our applications
* in */home/simple-stack-system/logs* we can store logs from all running on this machine containers

...and so on, we can add other conventions, as many as we need - same for every machine - that can greatly simplify the whole build & deploy process.


### Zero downtime App
Here is the example, not that complicated actually (maybe move it to a separate section?)

## Deploy App

Most things that we need to deploy an app, we have covered and prepared in <a href="#build-app">the previous section</a>, so we will mainly build on that. What does it mean to deploy an app?

On a desired machine or machines, we need to:
* download prepared previously app *package* and possibly its dependencies - container image and secrets for example
* run the *package*, stopping previous app version or executing zero downtime deployment
* if, for whatever reason, we can not deploy new app version, we need to rollback to a previous version

To do that, we need to have a *deploy script*. This deploy script, can be executed either from our local machine or a build machine. The requirement is that whatever machine will execute this script, it needs to be able to `ssh` into the desired machine or machines. So again, depending on our security needs and/or team size, it might be fine to do this from our local machine, it might not. But regardless of our choice, let's say that we have a *deploy machine* (local machine or build machine from the previous example). As you might also remember, on each machine we have *deploy user*, *simple-stack-system* in our case and the */home/simple-stack-system/deploy* directory, where we store our deployments history. Let's say, that we are about to deploy *some-custom-app* to *machine-1*.