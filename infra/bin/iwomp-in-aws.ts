#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { IwompStack } from '../lib/iwomp-stack';
import { IwompProjectsStack } from '../lib/iwomp-projects-stack';
import { IwompPoliciesStack } from '../lib/iwomp-policies-stack';

// Common configurations for all stacks
const props: cdk.StackProps = {
    tags: {
        'Application': 'iwomp-in-aws',
    }
};

const app = new cdk.App();

// Extra policies for the pipeline to do interesting things
const policiesStack = new IwompPoliciesStack(app, 'iwomp-policies', props);

// The actual pipeline
const iwompConfig = {
    topicDisplayName: 'iwomp-in-aws',
    configPath: 'iwomp-in-aws',
    ecrRepoName: 'iwomp-in-aws',
    workerPolicies: [
        policiesStack.workerPolicy,
    ],
};
new IwompStack(app, 'iwomp', iwompConfig, props);

// Demo projects for the pipeline
new IwompProjectsStack(app, 'iwomp-projects', iwompConfig.configPath, props);
