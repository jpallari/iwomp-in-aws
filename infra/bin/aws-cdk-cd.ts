#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkCdStack } from '../lib/cdk-cd-stack';
import { CdkProjectsStack } from '../lib/cdk-projects-stack';

const app = new cdk.App();
const cdConfig = {
    topicDisplayName: 'cdk-cd',
    configPath: 'cdk-cd',
    ecrRepoName: 'cdk-cd',
};
const props: cdk.StackProps = {
    tags: {
        'Application': 'cdk-cd',
    }
};
new CdkCdStack(app, 'cdk-cd', cdConfig, props);
new CdkProjectsStack(app, 'cdk-projects', undefined, props);
