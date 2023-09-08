#!/bin/bash
set -e

cp start_nginx.sh dist/start_nginx.sh
cp stop_nginx.sh dist/stop_nginx.sh
cp prepare_certs_renewal_hooks.bash dist/prepare_certs_renewal_hooks.bash