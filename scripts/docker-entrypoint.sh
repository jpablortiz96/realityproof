#!/bin/sh
# The read-only public demo signs only short-lived passport links, so it can start without
# configuration on a random secret. Any other mode must be given its own.
set -eu
if [ "${PUBLIC_DEMO_MODE:-false}" = "true" ] && [ -z "${AUTH_TOKEN_SECRET:-}" ]; then
  AUTH_TOKEN_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  export AUTH_TOKEN_SECRET
fi
exec "$@"
