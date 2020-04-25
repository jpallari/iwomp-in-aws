#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { GitOpsStack } from '../lib/gitops4aws';
import { GitOpsProjectsStack } from '../lib/gitops4aws-projects-stack';
import { GitOpsPoliciesStack } from '../lib/gitops4aws-policies-stack';

const props: cdk.StackProps = {
    tags: {
        'Application': 'gitops4aws',
    }
};

const app = new cdk.App();
const policiesStack = new GitOpsPoliciesStack(app, 'gitops4aws-policies', props);
const gitopsConfig = {
    topicDisplayName: 'gitops4aws',
    configPath: 'gitops4aws',
    ecrRepoName: 'gitops4aws',
    workerPolicies: [
        policiesStack.workerPolicy,
    ],
};
new GitOpsStack(app, 'gitops4aws', gitopsConfig, props);
new GitOpsProjectsStack(app, 'gitops4aws-projects', gitopsConfig.configPath, props);
