#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file.tar.gz.enc>"
  exit 1
fi

BACKUP_FILE="$1"

if [ -z "$BACKUP_PASSPHRASE" ]; then
  echo "Error: BACKUP_PASSPHRASE environment variable is required."
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file $BACKUP_FILE not found."
  exit 1
fi

echo "Restoring data/ directory from $BACKUP_FILE..."
openssl enc -d -aes-256-cbc -salt -pbkdf2 -pass pass:"$BACKUP_PASSPHRASE" -in "$BACKUP_FILE" | tar -xzf -

echo "Restore complete."
