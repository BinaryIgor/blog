#!/bin/bash

source ci_config.env

local_backup_path="../backups/analytics_$(date +'%m%d%Y').db"
remote_backup_path="${ASSETS_DIR}/analytics_backup.db"

echo "Getting backup from remote $remote_backup_path to local $local_backup_path..."

scp "$remote_backup_path" ${REMOTE_HOST}:${local_backup_path}

echo "Backup copied and available under: $local_backup_path!"