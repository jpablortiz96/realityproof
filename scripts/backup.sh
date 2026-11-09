#!/bin/sh
# Copies the workflow state and evidence volume to BACKUP_DIR and keeps the newest KEEP archives.
# The API writes state atomically, so an archive never holds a half-written state file.
set -eu
VOLUME="${1:-realityproof_realityproof_data}"
BACKUP_DIR="${BACKUP_DIR:-$PWD/backups}"
KEEP="${KEEP:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
# Git Bash on Windows would otherwise rewrite the container paths below.
export MSYS_NO_PATHCONV=1
HOST_DIR="$(cd "$BACKUP_DIR" && (pwd -W 2>/dev/null || pwd))"
docker run --rm -v "$VOLUME":/data:ro -v "$HOST_DIR":/backup alpine:3 \
  tar -czf "/backup/realityproof-$STAMP.tar.gz" -C /data .
docker run --rm -v "$HOST_DIR":/backup:ro alpine:3 \
  tar -tzf "/backup/realityproof-$STAMP.tar.gz" > /dev/null
ls -1t "$BACKUP_DIR"/realityproof-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "Backup verified: $BACKUP_DIR/realityproof-$STAMP.tar.gz"
