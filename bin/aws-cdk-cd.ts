#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsCdkCdStack } from '../lib/aws-cdk-cd-stack';

const app = new cdk.App();
new AwsCdkCdStack(app, 'AwsCdkCdStack');
