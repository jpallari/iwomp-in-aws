#!/usr/bin/env bash
#
# Trigger a pipeline job
#
set -euo pipefail

# Project name
IWOMPINAWS_PROJECT="${IWOMPINAWS_PROJECT:-"${1:-}"}"

# Git branch
GIT_BRANCH=${GIT_BRANCH:-"${2:-}"}
if [ -z "${GIT_BRANCH:-}" ]; then
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi

# Topic ARN
IWOMPINAWS_TOPIC_ARN="${IWOMPINAWS_TOPIC_ARN:-"${3:-}"}"
if [ -z "${IWOMPINAWS_TOPIC_ARN:-}" ]; then
    IWOMPINAWS_TOPIC_ARN=$(\
        aws cloudformation describe-stacks \
            --stack-name iwomp \
            --query 'Stacks[0].Outputs[?OutputKey==`JobTopicArn`].OutputValue' \
            --output text \
    )
fi

# Trigger!
exec aws sns publish \
    --topic-arn "$IWOMPINAWS_TOPIC_ARN" \
    --message "{\"project\": \"$IWOMPINAWS_PROJECT\", \"branch\": \"$GIT_BRANCH\"}"
