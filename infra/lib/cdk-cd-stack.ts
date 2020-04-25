import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaES from '@aws-cdk/aws-lambda-event-sources';
import * as logs from '@aws-cdk/aws-logs';
import * as sns from '@aws-cdk/aws-sns';

interface CdkCdProps {
  topicDisplayName?: string,
  configPath?: string,
  ecrRepoName?: string,
}

export class CdkCdStack extends cdk.Stack {
  launchUser: iam.IUser;
  inputTopic: sns.ITopic;
  containerRepo: ecr.IRepository;

  constructor(scope: cdk.Construct, id: string, cdProps: CdkCdProps, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Default values for props
    const configPath = cdProps.configPath || 'cdk-cd';
    const configPathArn = cdk.Arn.format({
      service: 'ssm',
      resource: `parameter/${configPath}/*`
    }, this);

    // User that can queue jobs
    this.launchUser = new iam.User(this, 'user');

    // Queue for incoming jobs
    this.inputTopic = new sns.Topic(this, 'topic', {
      displayName: cdProps.topicDisplayName,
    })
    this.inputTopic.grantPublish(this.launchUser);

    // Repository for the CD worker container image
    const containerImageRepo = new ecr.Repository(this, 'repo', {
      repositoryName: cdProps.ecrRepoName,
    });

    // CD worker job
    const worker = new codebuild.Project(this, 'worker', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: ['aws-cdk-cd'],
          },
        },
      }),
      description: 'CDK CD worker job',
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromEcrRepository(containerImageRepo),
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          'CONFIGPATH': {value: configPath},
        }
      },
    });
    worker.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [configPathArn],
      actions: ['ssm:GetParameter'],
    }));
    worker.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: ['sqs:*', 'cloudformation:*'] // Allowing CD to manage SQS as a demo
    }));

    // CD worker launcher
    const launcher = new lambda.Function(this, 'launcher', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      deadLetterQueueEnabled: false,
      description: "CDK CD launcher",
      environment: {
        'CONFIGPATH': configPath,
        'WORKER_PROJECT_NAME': worker.projectName,
      },
      events: [],
      logRetention: logs.RetentionDays.FIVE_DAYS,
      maxEventAge: cdk.Duration.hours(6),
      retryAttempts: 2,
      timeout: cdk.Duration.seconds(5),
    });
    launcher.addEventSource(new lambdaES.SnsEventSource(this.inputTopic));
    launcher.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [worker.projectArn],
      actions: ['codebuild:StartBuild']
    }))
    launcher.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [configPathArn],
      actions: ['ssm:GetParameter'],
    }));
  }
}
