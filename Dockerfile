#
# Build step for the aws-cdk-cd utility
# 
FROM golang:1.14 as builder

WORKDIR /project

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build the app
COPY main.go ./
RUN CGO_ENABLED=0 go build -o aws-cdk-cd

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
COPY --from=builder /project/aws-cdk-cd /usr/bin/aws-cdk-cd
ENTRYPOINT [ "aws-cdk-cd" ]
