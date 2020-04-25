#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import { GitOpsStack } from '../lib/gitops4aws';
import { GitOpsProjectsStack } from '../lib/gitops4aws-projects-stack';

const app = new cdk.App();
const cdConfig = {
    topicDisplayName: 'gitops4aws',
    configPath: 'gitops4aws',
    ecrRepoName: 'gitops4aws',
    workerPermissions: [
        {
            effect: iam.Effect.ALLOW,
            resources: ['*'],
            actions: ['sqs:*', 'cloudformation:*'],
        }
    ],
};
const props: cdk.StackProps = {
    tags: {
        'Application': 'gitops4aws',
    }
};
new GitOpsStack(app, 'gitops4aws', cdConfig, props);
new GitOpsProjectsStack(app, 'gitops4aws-projects', undefined, props);
