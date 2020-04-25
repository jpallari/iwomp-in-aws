#!/usr/bin/env bash
#
# Use the AWS configuration to figure out the ECR hostname.
#
set -euo pipefail

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --output text --query Account)
AWS_REGION=${AWS_DEFAULT_REGION:-}
if [ -z "${AWS_DEFAULT_REGION:-}" ]; then
    AWS_REGION=$(aws configure list | grep region | awk '{print $2}')
fi

echo "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
