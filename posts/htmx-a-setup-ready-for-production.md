---
{
    "title": "HTMX: a setup ready for Production",
    "slug": "htmx-a-setup-ready-for-production",
    "publishedAt": "2024-05-04",
    "startedAt": "2025-04-28",
    "excerpt": "HTMX is a promising technology that simplifies many things when building web applications/systems ... That is great when it comes to local development and simple experiments, but what about Production?",
    "researchLog": [ ],
    "writingLog": [ 2.5, 1, 1, 8, 8, 3, 4 ]
}
---

## HTMX

HTMX is a promising technology that simplifies many things when building web applications/systems. Mainly:
* we no longer need to have separate frontend and backend applications - we just have one app that returns HTML pages and fragments, ready to be rendered by the browser, while still having *Single Page Application* user experience
* features and behaviors are modeled and managed in one, single place, instead of being scattered throughout frontend and backend code
* it does not require any additional dependencies and complex tools to build and use
* because of its simplicity, it is extremely easy to learn and use

(*if you are interested, I have described HTMX in more detail [here](/htmx-simpler-web-based-app-or-system.html), and also how it pairs nicely with Web Components [here](/htmx-and-web-components-a-perfect-match.html)*)

That is great when it comes to local development and simple experiments, but what about [Production](/kubernetes-maybe-a-few-bash-python-scripts-is-enough.html)? Let's find out!

## Setup overview

We have three main components:
* **App** - custom application that returns both static, mostly JS and CSS files, and dynamic content - generated HTML pages and fragments with HTMX attributes
* **Db** - PostgreSQL that stores data of the app
* **Nginx** - reverse proxy for the app, which allows to manage HTTPS certificates, do simple rate limiting, compress responses and support *zero downtime deployments*

**They are built and run in Docker.** We deploy them all to a single Virtual Machine - Droplet, on the DigitalOcean infrastructure, generate required secrets (database passwords and JSON Web Token secret key) and set up a certificate to have HTTPS. It is all automated by a few, simple Bash/Python scripts.

### App {#setup-overview-app}

Simple app that has users and allows them to add notes to every day, and also to browse their history. This is how it looks:

<figure>
    <img src="{{ imagesPath }}/htmx-a-setup-ready-for-production/signing-in.png" loading="lazy">
    <figcaption>Signing in</figcaption>
</figure>

<figure>
    <img src="{{ imagesPath }}/htmx-a-setup-ready-for-production/adding-note-to-day.png" loading="lazy">
    <figcaption>Adding note to day</figcaption>
</figure>
<figure>
    <img src="{{ imagesPath }}/htmx-a-setup-ready-for-production/days-history.png" loading="lazy">
    <figcaption>Days history</figcaption>
</figure>

It is written in *Java 21* with the help of *Spring Boot* framework, but these are secondary details, because **the setup rests only on the assumptions that an app**:
1. is build as Docker container
2. starts HTTP server on a random port and exports this information to a simple text file, in the `http://0.0.0.0:16083` format, which is needed for zero downtime deployments
3. has all needed static files, mostly CSS and JS, and returns HTML pages and fragments
4. uses PostgreSQL as a database 
5. issues auth tokens based on the secret provided in `AUTH_TOKEN_KEY` environment variable, in the Base64 format; it should also store them in the *Cookie* and refresh, when possible and necessary

These assumptions can be met by virtually any programming language. We just need to have an HTTP server, started on chosen by us port, and serve both static and dynamic content; we also need to have a relational database client and generate some kind of auth tokens, preferably [JWT](https://jwt.io/).

Getting back to our app implementation, for frontend-related things we have: 
* all CSS and JS files located in `app/static` dir 
* **[Tailwind for CSS](https://tailwindcss.com/)** - as a result, we have single CSS file generated based on `app/static/styles.css` and `app/tailwind.config.js` files
* **Web Components** - for more JavaScript-dependent and reusable fragments of our pages
* HTML is generated only in the app code, we do not use any template engine; if needed, we also have some [scoped, inline JavaScript there](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/app/src/main/java/com/binaryigor/htmxproductionsetup/user/UserController.java#L47) - most of it is defined in `*Controller.java` and `HTMX.java` files
* translations are defined in the `Translations.java` file; they are used to render HTML in a language set by the user
* input validation is done purely on the server, but we do have live feedback, as we are entering it

\
**For authentication/authorization, we generate a single JSON Web Token, for every user login, valid for 48 hours** (configurable). We store it in the *HTTP cookie* and regenerate automatically every hour (also configurable). If there is no cookie with a valid token or it has expired, we just redirect users to the `/sign-in` page (check out [SecurityFilter.java](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/app/src/main/java/com/binaryigor/htmxproductionsetup/auth/SecurityFilter.java) for more details). Thanks to this approach, we do not need to write any client-side JavaScript code to handle auth flow nor configure anything in *HTMX*; and when signing out, we just remove this cookie and the token is gone. 

### Db {#setup-overview-db}

PostgreSQL - simple, good relational database. One thing worth mentioning here is that the app is a *modular monolith*; as a consequence, every module has its own database schema to have proper module separation. Schemas are created and managed by *App*, but essentially we just have two tables:
```
CREATE SCHEMA "user";

CREATE TABLE "user"."user" (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  language TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE SCHEMA day;

CREATE TABLE day.day (
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  note TEXT,

  PRIMARY KEY(user_id, date)
);
```

### Nginx {#setup-overview-nginx}

Reverse proxy for the app. From the outside, it supports only HTTPS communication and it runs on the same machine as *App*, so the communication between these two components is always on the localhost. It has the following functions:
1. **HTTPS communication** -  we have a certificate issued by [Let's Encrypt](https://letsencrypt.org/) with the help of [Certbot](https://certbot.eff.org/) tool that allows to set up auto-renewable certificates 
2. **Rate Limiting** - limiting access to endpoints based on maximum allowed requests per second rate, per client IP address
3. **Compression (gzip) of responses from the app** - mostly CSS, JS and HTML ones to make them smaller, therefore faster
4. **Zero Downtime Deployments**:
    1. we have `current_url.txt` file with the url of a current *App* instance
    2. before starting *Nginx*, we update [its config](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/nginx/template_nginx.conf#L123) based on the `current_url.txt` file
    3. after deploying a new instance of the app, we make *Nginx* reload its config based on the new `current_url.txt` file, so that it always points to the latest app instance
    4. to have zero downtime, when deploying a new *App* version, we temporarily run it in two instances - each on a different, random port; once the new instance is up and ready, we switch *Nginx* config to this new instance, wait a few seconds, and kill the previous one


### Infrastructure {#setup-overview-infrastructure}

We have a Droplet (Virtual Machine), running on DigitalOcean's infrastructure. This setup is not DigitalOcean-specific though; **all we need is a linux-based machine with**:
* SSH access
* Docker
* special *deploy* user that has SSH access, passwordless sudo and privileges to run Docker
* basic firewall - *optional, but highly recommended* - blocked ports other than 22 (ssh), 80 (http) and 443 (https), for example

Needless to say, if you choose not to use DigitalOcean, you have to automate or set it up on your own. We do use it, and we have a single script that sets this all up for us.

**We also have HTTPS setup with auto-renewable certificates** - for that, you need to have a domain.

Lastly, required secrets are generated and stored on our remote machine as plain text files, in a dedicated directory. Before starting *App*, we simply do:
```
export AUTH_TOKEN_KEY=$(cat /home/deploy/.secrets/auth-token-key.txt)
export DB_PASSWORD=$(cat /home/deploy/.secrets/db-password.txt)
```
...to read them and have available as environment variables.

## Local development

No production setup is complete without a great local development experience. What do we need in our case?
* run the Java app locally
* it needs to have a Postgres database, so we also need to run it locally - we will do this in Docker
* we use Tailwind for CSS - to have live-generated, up-to-date CSS, we have to run just one, additional script; outside of that, all static resources are served from `app/static` dir and HTML is generated dynamically

I wanted to avoid having a *package.json* file and *Node.js* environment only because we use Tailwind. Therefore, in the repo we have *tailwindcss executable*, downloaded according to the [official docs](https://tailwindcss.com/blog/standalone-cli) (there is tailwindcss-linux-x64 version; in case of problems, download a version compatible with your OS). This is required because of [how Tailwind works](https://tailwindcss.com/docs/installation): it scans configured files to find out what CSS classes are needed; it then generates a target CSS file. To have it live-generated, from `app` dir run:
```
bash start_tailwindcss_watch.bash 

Rebuilding...

Done in 473ms.
```
According to [tailwind.config.js](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/app/tailwind.config.js), we watch for any changes in Java files, where the HTML is created, and static files; when changes occur, a new CSS file as `static/live-styles.css` is generated. This changing file is returned by *App* started with the *dev profile* - more on that below.

**To start Postgres database locally**, go to `db` dir and run:
```
bash build_and_run_locally.bash 
```
In `config_local.env` file, we have a variable:
```
export DATABASE_VOLUME="/tmp/htmx-production-setup-db-volume"
```
This is where local database volume will be created. It is a temporary directory, so we will lose data everytime we reboot our local machine; if this behavior is not desired, we should change this path to a persistent one.

**To run the app locally and see changes quickly**, we need to have Java 21 + compatible Maven version. If we just want to build and run *App* locally, having Docker is enough, since the app can be built inside it; however, for every change we would need to recompile it all inside Docker, which is quite slow. For the optimal local development experience, set up Java 21 with a compatible Maven version. Once you have it, in your *IDE* of choice, just start `HtmxProductionSetupApp.java` with:
* working directory - `app`: needed to serve content of `static` dir locally, from files, not a *classpath* as we do in production
* dev profile - the easiest way to do this is to run the app with environment variable `SPRING_PROFILES_ACTIVE=dev`

That is all - it will make *App* serve static resources from `static` directory live, without any cache; it will also connect to the local database on `localhost:5432` address, without a password; *JWT tokens* will be signed with hardcoded secret from `application-dev.yml` file. To edit some HTML and see changes, just go to any of `*Controller.java` files; change something there, rebuild and restart the app in your *IDE* - the whole cycle should take no more than 4 to 5 seconds. To be honest, most of the overhead comes from using *Spring Boot* framework, but it simplifies many things; by switching to a more lightweight alternative, we would just wait 1 to 2 seconds, instead of 4 to 5. In any case, I have concluded that waiting these additional ~ 3 seconds is a price worth paying for all the ready-to-use solutions that this framework brings.

## Infrastructure setup

As said, to follow through and have everything automated by a few scripts, you need to have a DigitalOcean account and a domain. If you do not have the former, you need to prepare a compatible Virtual Machine that is mostly described by [prepare_infra.py](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/scripts/prepare_infra.py) and [init_machine.bash](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/scripts/init_machine.bash) scripts. Assuming that we have a DigitalOcean account and a domain, let's prepare the infrastructure!

### Droplet/Virtual Machine {#infrastructure-setup-droplet-virtual-machine}

From `scripts` directory, run:
```
bash init_python_env.bash
# activate venv environment
source venv/bin/activate
export DO_API_TOKEN="<your DigitalOcean API token>"
export SSH_KEY_FINGERPRINT="<ssh key fingerprint of your local machine, uploaded to DigitalOcean>"
python3 prepare_infra.py
```

This will create our machine and prepare it by installing Docker, creating the *deploy* user with required permissions, mostly passwordless sudo and Docker access, and setting up the firewall. After all of that is done, which should take just a few minutes, we are able to *ssh* into this new machine, deploy our applications and scripts, and perform any needed operation there.

### HTTPS and Nginx {#infrastructure-setup-https-and-nginx}

First and foremost, set up a `DNS A` record - it should point to the IP address of previously created Droplet/Virtual Machine. 

Then, in the root dir, we have `config_prod.env` file with variables:
```
export DOMAIN="htmx-nonexistentdomain.com"
export DOMAIN_EMAIL="igor@htmx-nonexistentdomain.com"
```
Make sure to change them to your domain and email address accordingly! Email is required by *Certbot* to notify us about the state of our certificates.

Assuming that we have the `DNS A` record and have changed `DOMAIN` and `DOMAIN_EMAIL` values, we can create HTTPS certs with the help of *Let's Encrypt* and *Certbot*. From `scripts` dir, let's run:
```
bash set_up_https_cert.bash
```
This will:
* build and deploy single-use *nginx-https-setup* nginx - it is needed to meet the initial *Let's Enrypt* challenge; we use [HTTP-01 challenge](https://letsencrypt.org/docs/challenge-types/#http-01-challenge), which is based on exposing a simple text file with random token
* install [Certbot](https://certbot.eff.org)
* use it to generate a certificate
* stop *nginx-https-setup*

At this point, we have a ready-to-be-used HTTPS certificate, in `/etc/letsencrypt` directory, with auto-renewal taken care of by *Certbot*. 

We are now ready to deploy our target *Nginx*; go to `scripts` again and run:
```
export ENV=prod
export APP=nginx
bash build_and_package_app.bash
```
In `nginx/dist` directory, **we have a deployable package - just gzipped Docker image and a bunch of bash scripts to coordinate the whole deployment process**. On the target machine (our Droplet), generated scripts will:
1. load prepared Docker image from gzipped file
2. stop previous *Nginx* Docker container, if it is running
3. remove previous *Nginx* Docker container
4. if a `current_url.txt` file with the information about *App* url exists (we always start it on a random port), we use this information to update *Nginx* config
5. create and start new *Nginx* Docker container
6. check if the app that *Nginx* is proxying is healthy by calling its health-check endpoint (`/actuator/health` for us) a few times, through *Nginx*

We will repeat a very similar process when deploying *App* and *Db*. For now, the last step will fail because we have not deployed the app just yet; *Nginx* is ready for that and will start nevertheless, with appropriate information about its inability to proxy the app. To see this in action, let's do (also from `scripts`):
```
export APP=nginx
bash deploy_app.bash

...

Dirs prepared, copying package, this can take a while...

...

Package copied, loading and running app, this can take a while...
Loading htmx-production-setup-nginx:latest image, this can take a while...
Loaded image: htmx-production-setup-nginx:latest
Image loaded, running it...
Removing previous container...
Error response from daemon: No such container: htmx-production-setup-nginx

Starting new htmx-production-setup-nginx version...

Current app url file doesn't exist, skipping!
4b96b1240562b3e05dea6a304a71788a18be02e8f43eca3335250d79e941895c
Checking proxied app connection...
curl: (7) Failed to connect to 0.0.0.0 port 80 after 5 ms: Connection refused
Warning: Problem : connection refused. Will retry in 1 seconds. 10 retries left.
curl: (22) The requested URL returned error: 502
Warning: Problem : HTTP error. Will retry in 1 seconds. 9 retries left.

...

Warning: Problem : HTTP error. Will retry in 1 seconds. 1 retries left.
curl: (22) The requested URL returned error: 502

Proxied connection checked, see if it is what it should be!
```

As said, 502 Bad Gateway errors are there because we have not deployed *App* yet, which is hidden behind *Nginx*; we will do this in the next steps. For now, we can verify that HTTPS works:
```
curl https://<your-domain>
{ "error": "AppUnavailable", "message": "App is not available" }
```
We can also check that the certificate is auto-renewable:
```
ssh deploy@<your-domain>

sudo certbot renew --dry-run

Saving debug log to /var/log/letsencrypt/letsencrypt.log

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Processing /etc/letsencrypt/renewal/<your-domain>.conf
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Simulating renewal of an existing certificate for <your-domain>

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Congratulations, all simulated renewals succeeded: 
  /etc/letsencrypt/live/<your-domain>/fullchain.pem (success)
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Hook 'post-hook' ran with output:
 2024/05/01 18:40:43 [notice] 28#28: signal process started
```
As a `post-hook` we have:
```
docker exec ${nginx_container} nginx -s reload 2>&1
```
...that just makes *Nginx* reload its config and use a newly generated certificate.

We right now have *Nginx* with HTTPS setup. Before deploying the app, let's take care of two last pieces of our infrastructure - database and secrets.

### Database and secrets {#infrastructure-setup-database-and-secrets}

Let's build *Db*; from `scripts`:
```
export ENV=prod
export APP=db
bash build_and_package_app.bash
```
As with *Nginx*, in `db/dist` directory, we have a deployable package - just gzipped Docker image and a bunch of bash scripts. 

Let's deploy it:
```
export APP=db
bash deploy_app.bash
```

\
We right now have a working database; let's change its default passwords and set up a secret for *JWT tokens* that *App* will issue. From `scripts`, run:
```
python3 generate_secrets.py 

Go to needed directory and simply run:

echo "xHToxjzEiiL0lGMCE9Hy1YMfNeNi++64o3IucthTwXM=" > auth-token-key.txt
echo "zpfEX7FR4UvZzkve0VmdH4SkGnirSruNzWc06iBRpxFbwrfo" > db-root-password.txt
echo "wCBytG25v69CAfzoIHOuQ0uDiciAlCtQLPOXpz4qaRpRvnh3" > db-password.txt
```
As the output suggests, we need to go to a desired directory and just copy-paste these commands there:
```
ssh deploy@<your-domain>

# secrets path from config_prod.env
mkdir /home/deploy/.secrets
cd /home/deploy/.secrets

<copy-paste commands from the generate_secrets.py output>

ls -l
total 12
-rw-rw-r-- 1 deploy deploy 45 May 1 18:49 auth-token-key.txt
-rw-rw-r-- 1 deploy deploy 49 May 1 18:49 db-password.txt
-rw-rw-r-- 1 deploy deploy 49 May 1 18:49 db-root-password.txt
```
Now, as we have secrets, let's change db passwords by running `db/change_db_passwords.bash` on our remote machine:
```
# just copy-paste these commands and run them from /home/deploy/.secrets dir

new_root_db_password=$(cat db-root-password.txt)
app_db_user="htmx_app"
app_db_name="htmx_app"
app_db_password=$(cat db-password.txt)

connect_to_db="docker exec -it htmx-production-setup-db psql -U postgres -d postgres -c"
$connect_to_db "ALTER USER postgres WITH password '$new_root_db_password'"
$connect_to_db "ALTER USER ${app_db_user} WITH password '$app_db_password'"
```

We now have both a working db and secrets prepared - everything is ready to deploy *App*!

## Zero Downtime Deployment

Let's build *App*; from `scripts`:
```
export ENV=prod
export APP=app

# To build everything inside Docker, run:
# export BUILD_IN_DOCKER=true

bash build_and_package_app.bash
```
As with *Nginx* and *Db*, in `app/dist` directory, we have a deployable package - just gzipped Docker image and a bunch of bash scripts. In this case, they are a little more complicated, since we need to coordinate zero downtime deployment - more on that below.

Let's deploy it:
```
export APP=app
bash deploy_app.bash
```
We should see something like this:
```
Dirs prepared, copying package, this can take a while...
current_url.txt                                                                                                                                  100%   21     0.7KB/s   00:00    
htmx-production-setup-app.tar.gz                                                                                                                 100%  191MB   5.4MB/s   00:35    
load_and_run_app.bash                                                                                                                            100%  271     9.0KB/s   00:00    
run_app.bash       

...

App started, will check if it is running after 5s...
App is running, checking its health-check...

...

curl: (7) Failed to connect to 0.0.0.0 port 13307 after 7 ms: Connection refused
Warning: Problem : connection refused. Will retry in 3 seconds. 10 retries left.

...

{"status":"UP"}  

htmx-production-setup-app app is healthy!

Replacing config with new app url: http://0.0.0.0:13307...
Config updated!

Reloading nginx config..

2024/05/01 19:07:10 [notice] 34#34: signal process started

Nginx is running with new app url (http://0.0.0.0:13307)!

Checking proxied app connection...
{"status":"UP"}

Proxied app is healthy!

Nginx updated and running with new app version, cleaning previous after a few seconds!

Stopping previous htmx-production-setup-app-backup container...
htmx-production-setup-app-backup
Removing previous container...
htmx-production-setup-app-backup
New htmx-production-setup-app container is up and running!

App loaded, checking its logs and status after 5s...


  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::                (v3.2.4)

2024-05-01T19:06:57.400Z  INFO 1 --- [htmx-production-setup-app] [           main] c.b.h.HtmxProductionSetupApp             : Starting HtmxProductionSetupApp v1.0-SNAPSHOT using Java 21.0.2 with PID 1 (/htmx-production-setup-app.jar started by root in /)
2024-05-01T19:06:57.408Z  INFO 1 --- [htmx-production-setup-app] [           main] c.b.h.HtmxProductionSetupApp             : The following 1 profile is active: "prod"
2024-05-01T19:07:01.574Z  INFO 1 --- [htmx-production-setup-app] [           main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat initialized with port 13307 (http)

...

App status:
running
App deployed!
In case of problems you can rollback to the previous deployment: /home/deploy/deploy/app/previous
```

\
**From now on, we can deploy app changes with zero downtime.** We touched on it briefly when describing *Nginx*, but let's expand on it: 
* *App* is proxied by *Nginx*
* *App* runs on a random port, so that we can have it in multiple instances, on the same machine
* when deploying a new *App* version, we:
  * rename currently running *App* container to `app-backup` container
  * start new *App* container, while keeping old one running as `app-backup`
  * *Nginx* is still pointing to the old *App* container, named `app-backup` now
  * make sure that the new *App* container is healthy by waiting a few seconds, and then issuing http requests to its health-check endpoint
  * **if *App* is not healthy** - we stop it and rename the previous `app-backup` container back to `app` and fail the deployment; old version was running and used by *Nginx* all this time, so that is all we have to do
  * **if *App* is healthy** - we make *Nginx* use the new *App* container by updating its config; we then wait a few seconds, so that pending http requests have a chance to complete, and then we just stop the old *App* container and remove it

It is all defined in [template_run_zero_downtime_app.bash](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/scripts/template_run_zero_downtime_app.bash) and in [template_update_app_url.bash](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/nginx/template_update_app_url.bash); versions with specific values are available after building *App* and *Nginx* as `app/dist/run_app.bash` and `nginx/dist/update_app_url.bash` accordingly.

We can right now go to `https://<your-domain>` and sign in as ([DemoDataInitializer.java](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/app/src/main/java/com/binaryigor/htmxproductionsetup/DemoDataInitializer.java)):
```
igor@gmail.com:ComplexPassword12
other@gmail.com:ComplexOtherPassword12
```
Then, make any visible change in the `*Controller.java` files, where HTML responses are generated. After that, build and deploy the app, as we did above: while deploying, keep refreshing *App* in the browser and see - we do not have any downtime!

## Conclusion

As we have seen, HTMX is absolutely ready to be used in Production: 
* by serving static assets and HTML responses directly from the app, it is quite straightforward to implement *zero downtime deployment* without using any complex tools - just with plain old Nginx as a reverse proxy
* *Web Components* make it very easy to have reusable and more JavaScript-dependent parts of UI pages defined in a single place
* there is only a couple of JavaScript files (3), mostly Web Components, and a single CSS file, mostly generated by Tailwind; we do not need to use any additional tools to build static, frontend assets - we just add a random hash to this few file names and update all references to them using [single, simple script](https://github.com/BinaryIgor/code-examples/blob/master/htmx-production-setup/app/build_and_package.bash)
* by saving *JSON Web Tokens* in the *Cookie*, we do not need to have any client-side code to handle authentication/authorization flow - it is all handled by the server

**Taking it all into consideration, I highly recommend using HTMX in production, as a tool to build simpler and more maintainable systems.**

<div id="post-extras">
  <div class="post-delimiter">---</div>

  ### Notes and resources
  1. Code repo: https://github.com/BinaryIgor/code-examples/tree/master/htmx-production-setup
  2. Same concept, presentend on the video: https://www.youtube.com/watch?v=eO6bVRH-jT0
  3. My other HTMX articles/posts:
      1. [HTMX: simpler web-based app/system](/htmx-simpler-web-based-app-or-system.html)
      2. [HTMX and Web Components: a Perfect Match](/htmx-and-web-components-a-perfect-match.html)
  4. To make this post more digestible, I have skipped a few, non-HTMX specific things like:
      1. backing up the database - I have made a video about that: https://www.youtube.com/watch?v=l46yS2G4kkg
      2. informing users about a new app version - we should have something like a *version.json* file with the current version of the app, poll it from the client (browser) side and refresh the page, or rather ask the user to refresh it, if a new version is available
      3. collecting metrics and logs from Docker containers - I have also made a video about that: https://www.youtube.com/watch?v=68PzQNsuSWc
  5. DigitalOcean: https://www.digitalocean.com
  6. Getting started with glorious Tailwind CSS: https://tailwindcss.com/docs/installation
</div>