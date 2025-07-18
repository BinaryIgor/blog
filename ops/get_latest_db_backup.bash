#!/bin/bash

source ci_config.env

cd ..
mkdir -p backups

local_backup_path="backups/analytics_$(date +'%Y%m%d').db"
remote_backup_path="${ASSETS_DIR}/analytics_backup.db"

echo "Getting backup from remote $remote_backup_path to local $local_backup_path..."

scp ${REMOTE_HOST}:${remote_backup_path} ${local_backup_path}

echo "Backup copied and available under: $local_backup_path!"