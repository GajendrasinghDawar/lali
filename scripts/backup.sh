#!/bin/bash
set -e

if [ -z "$BACKUP_PASSPHRASE" ]; then
  echo "Error: BACKUP_PASSPHRASE environment variable is required."
  exit 1
fi

mkdir -p backups
BACKUP_FILE="backups/lali-data-$(date +%Y%m%d%H%M%S).tar.gz.enc"

echo "Backing up data/ directory to $BACKUP_FILE..."
tar -czf - data/ | openssl enc -aes-256-cbc -salt -pbkdf2 -pass pass:"$BACKUP_PASSPHRASE" -out "$BACKUP_FILE"

echo "Backup complete: $BACKUP_FILE"
