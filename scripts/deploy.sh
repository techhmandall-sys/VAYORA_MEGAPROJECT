#!/bin/sh
# Puts VAYORA online on this server, or updates it: run it again after pulling new code. The first
# run downloads the road map and takes a while. See "Putting VAYORA online" in docs/DEPLOYMENT.md.
#
#   sh scripts/deploy.sh
set -eu
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env here. Copy .env.production.example to .env and fill in the first block." >&2
  exit 1
fi

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --wait
domain=$(grep '^VAYORA_DOMAIN=' .env | cut -d= -f2)
echo "VAYORA is running at https://$domain"
