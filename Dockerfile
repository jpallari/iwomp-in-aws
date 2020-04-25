#
# Build step for the worker utility
# 
FROM golang:1.14 as builder

WORKDIR /project

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build the app
COPY main.go ./
RUN CGO_ENABLED=0 go build -o iwomp-in-aws

#
# Final container for the app
#
FROM node:14-slim

# Install system packages
RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install CDK
RUN npm install -g aws-cdk

# Non-root user
RUN groupadd -g 10101 cdk && \
    useradd -m -d /project -g cdk -u 10101 cdk
USER cdk:cdk
WORKDIR /project

# Runner script
COPY --from=builder /project/iwomp-in-aws /usr/bin/iwomp-in-aws
ENTRYPOINT [ "iwomp-in-aws" ]
