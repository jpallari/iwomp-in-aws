#!/usr/bin/env bash
#
# Deploy the AWS infrastructure for the pipeline
#
set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR/../infra" || exit 1

npm install
cdk deploy --require-approval=never '*'
