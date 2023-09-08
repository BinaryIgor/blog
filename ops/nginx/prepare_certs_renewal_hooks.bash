#!/bin/bash
set -e

chmod +x stop_nginx.sh
chmod +x start_nginx.sh
sudo cp stop_nginx.sh /etc/letsencrypt/renewal-hooks/pre/stop_nginx.sh
sudo cp start_nginx.sh /etc/letsencrypt/renewal-hooks/post/start_nginx.sh