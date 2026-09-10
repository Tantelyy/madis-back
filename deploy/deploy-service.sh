#!/bin/sh
set -eu
umask 077

DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$DEPLOY_DIR"

# GitHub concurrency groups do not span repositories. Serialize updates on
# the VPS so two repositories cannot rewrite .versions.env simultaneously.
exec 9>.deploy.lock
flock -w 600 9

SERVICE=${1:-}
IMAGE=${2:-}

case "$SERVICE" in
  backend) IMAGE_KEY=BACKEND_IMAGE; REPOSITORY=ghcr.io/tantelyy/madis-back ;;
  frontend) IMAGE_KEY=FRONTEND_IMAGE; REPOSITORY=ghcr.io/tantelyy/madis-front ;;
  ml-service) IMAGE_KEY=ML_IMAGE; REPOSITORY=ghcr.io/tantelyy/madis-fastapi ;;
  *) echo "Unknown service: $SERVICE" >&2; exit 2 ;;
esac

COMMIT=${IMAGE#"$REPOSITORY:sha-"}
if [ "$COMMIT" = "$IMAGE" ] || ! printf '%s\n' "$COMMIT" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "Refusing unexpected image reference: $IMAGE" >&2
  exit 2
fi

if [ ! -f .env ] || [ ! -f .versions.env ]; then
  echo "Missing /opt/madis/.env or .versions.env; complete the VPS bootstrap first." >&2
  exit 3
fi

compose() {
  docker compose --env-file .env --env-file .versions.env -f compose.yml "$@"
}

compose config --quiet
CONTAINER_ID=$(compose ps -q "$SERVICE")
if [ -z "$CONTAINER_ID" ]; then
  echo "No running $SERVICE container; finish the manual bootstrap first." >&2
  exit 3
fi
# Capture the actual running image, even if its original tag was 'latest'.
PREVIOUS_IMAGE=$(docker inspect --format '{{.Image}}' "$CONTAINER_ID")

docker pull "$IMAGE"

VERSIONS_TMP=$(mktemp .versions.env.XXXXXX)
grep -v "^${IMAGE_KEY}=" .versions.env > "$VERSIONS_TMP" || true
printf '%s=%s\n' "$IMAGE_KEY" "$IMAGE" >> "$VERSIONS_TMP"
mv "$VERSIONS_TMP" .versions.env

rollback() {
  echo "Deployment failed; rolling $SERVICE back to $PREVIOUS_IMAGE" >&2
  ROLLBACK_TMP=$(mktemp .versions.env.XXXXXX)
  grep -v "^${IMAGE_KEY}=" .versions.env > "$ROLLBACK_TMP" || true
  printf '%s=%s\n' "$IMAGE_KEY" "$PREVIOUS_IMAGE" >> "$ROLLBACK_TMP"
  mv "$ROLLBACK_TMP" .versions.env
  if ! compose up -d --no-deps --pull never --wait --wait-timeout 180 "$SERVICE"; then
    echo "Rollback did not become healthy; inspect the logs and database migrations." >&2
    return 1
  fi
}

if compose up -d --no-deps --pull never --wait --wait-timeout 180 "$SERVICE"; then
  echo "$SERVICE is healthy on $IMAGE"
  exit 0
fi

compose logs --tail=100 "$SERVICE" >&2 || true
rollback
exit 1
