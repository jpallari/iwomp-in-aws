#!/bin/sh
set -eu

if [ -z "${GIT_BRANCH:-}" ]; then
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi

exec aws sns publish \
    --topic-arn "$GITOPS4AWS_TOPIC_ARN" \
    --message "{\"project\": \"$GITOPS4AWS_PROJECT\", \"branch\": \"$GIT_BRANCH\"}"
