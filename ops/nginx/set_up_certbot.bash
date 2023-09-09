#!/bin/bash
set -e

source ../ci_config.env

ssh $REMOTE_HOST "
echo 'Setting up certbot...'
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
echo
echo 'Certbot configured, generating certs...'
# Standalone mode: certbot will temporarily spin up a webserver on the machine.
sudo certbot certonly --standalone --non-interactive --agree-tos --email iroztropinski@gmail.com -v --domains \"api.binaryigor.com\"

echo
echo 'Certbot set, setting up pre and post renew scripts...'
"

pre_hook_path="/etc/letsencrypt/renewal-hooks/pre/stop_nginx.sh"
post_hook_path="/etc/letsencrypt/renewal-hooks/post/start_nginx.sh"

scp "$PWD/stop_nginx.sh" $REMOTE_HOST:/tmp/stop_nginx.sh
scp "$PWD/start_nginx.sh" $REMOTE_HOST:/tmp/start_nginx.sh

ssh $REMOTE_HOST "sudo mv /tmp/stop_nginx.sh $pre_hook_path; sudo chmod +x $pre_hook_path"
ssh $REMOTE_HOST "sudo mv /tmp/start_nginx.sh $post_hook_path; sudo chmod +x $post_hook_path"

echo
echo "Certs with automatic renewal are set up"