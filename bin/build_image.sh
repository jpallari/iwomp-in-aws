#!/usr/bin/env bash
#
# Build the container image for the worker.
#
set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR/.." || exit 1

DOCKER_CMD="docker"
if hash podman 2>/dev/null; then
    DOCKER_CMD="podman"
fi
ECR_HOST="$("$SCRIPT_DIR/ecr_host.sh")"
IMAGE_TAG="$ECR_HOST/${1:-gitops4aws}"

"$DOCKER_CMD" build -t "$IMAGE_TAG" .
