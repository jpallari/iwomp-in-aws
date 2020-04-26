import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaES from '@aws-cdk/aws-lambda-event-sources';
import * as logs from '@aws-cdk/aws-logs';
import * as sns from '@aws-cdk/aws-sns';

interface IwompProps {
  jobTopicDisplayName?: string,
  configPath?: string,
  ecrRepoName?: string,
  workerPolicies: iam.IManagedPolicy[],
}

export class IwompStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, iwompProps: IwompProps, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const configPath = iwompProps.configPath || 'iwomp-in-aws';
    const configPathArn = this.formatArn({
      service: 'ssm',
      resource: `parameter/${configPath}/*`
    });

    // User that can queue jobs
    const launchUser = new iam.User(this, 'user');

    // Queue for incoming jobs
    const jobTopic = new sns.Topic(this, 'topic', {
      displayName: iwompProps.jobTopicDisplayName,
    })
    jobTopic.grantPublish(launchUser);

    // Repository for the worker container image
    const containerImageRepo = new ecr.Repository(this, 'repo', {
      repositoryName: iwompProps.ecrRepoName,
    });

    // Worker job
    const worker = new codebuild.Project(this, 'worker', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: ['iwomp-in-aws'],
          },
        },
      }),
      description: 'iwomp-in-aws worker',
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
    iwompProps.workerPolicies.forEach((policy) => {
      worker.role?.addManagedPolicy(policy);
    });

    // Worker launcher
    const launcher = new lambda.Function(this, 'launcher', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      deadLetterQueueEnabled: false,
      description: "iwomp-in-aws launcher",
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
    launcher.addEventSource(new lambdaES.SnsEventSource(jobTopic));
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

    // Outputs
    new cdk.CfnOutput(this, 'LaunchUserArn', {
      value: launchUser.userArn,
      description: 'ARN of the user that can launch jobs',
    });
    new cdk.CfnOutput(this, 'JobTopicArn', {
      value: jobTopic.topicArn,
      description: 'ARN of the topic for launching jobs',
    });
    new cdk.CfnOutput(this, 'WorkerEcrUri', {
      value: containerImageRepo.repositoryUri,
      description: 'URI of the worker container image ECR repository',
    });
  }
}
