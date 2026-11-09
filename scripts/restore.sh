#!/bin/sh
# Replaces the volume contents with an archive. Stop the service first:
#   docker compose --profile full stop full
set -eu
ARCHIVE="${1:?usage: restore.sh <archive.tar.gz> [volume]}"
VOLUME="${2:-realityproof_realityproof_data}"
export MSYS_NO_PATHCONV=1
ARCHIVE_DIR="$(cd "$(dirname "$ARCHIVE")" && (pwd -W 2>/dev/null || pwd))"
ARCHIVE_NAME="$(basename "$ARCHIVE")"
docker run --rm -v "$ARCHIVE_DIR":/backup:ro alpine:3 tar -tzf "/backup/$ARCHIVE_NAME" > /dev/null
docker run --rm -v "$VOLUME":/data -v "$ARCHIVE_DIR":/backup:ro alpine:3 \
  sh -c 'find /data -mindepth 1 -delete && tar -xzf "/backup/$0" -C /data && chown -R 1000:1000 /data' "$ARCHIVE_NAME"
echo "Restored $ARCHIVE_NAME into $VOLUME. Start the service and check /ready."
