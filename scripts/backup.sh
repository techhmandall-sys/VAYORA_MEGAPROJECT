#!/bin/sh
# Copies the databases of a running VAYORA into backups/<date>/. Redis holds nothing worth keeping.
# Copy that folder off the server: a backup on the machine it protects is no backup. "Restoring a
# backup" in docs/DEPLOYMENT.md says how to put one back.
#
#   sh scripts/backup.sh
set -eu
cd "$(dirname "$0")/.."

compose="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
folder="backups/$(date +%Y-%m-%d-%H%M)"
mkdir -p "$folder"

$compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$folder/postgres.dump"
$compose exec -T mongo mongodump --quiet --archive --gzip > "$folder/mongo.archive.gz"

echo "Saved $folder:"
ls -lh "$folder"
