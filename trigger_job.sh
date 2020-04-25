#!/bin/sh
set -eu

if [ -z "${GIT_BRANCH:-}" ]; then
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi

exec aws sns publish \
    --topic-arn "$CDK_CD_TOPIC_ARN" \
    --message "{\"project\": \"$CDK_CD_PROJECT\", \"branch\": \"$GIT_BRANCH\"}"
