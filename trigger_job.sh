#!/bin/sh
#
# Trigger a pipeline job
#
set -eu

if [ -z "${GIT_BRANCH:-}" ]; then
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi

exec aws sns publish \
    --topic-arn "$IWOMPINAWS_TOPIC_ARN" \
    --message "{\"project\": \"$IWOMPINAWS_PROJECT\", \"branch\": \"$GIT_BRANCH\"}"
