import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';

export class GitOpsPoliciesStack extends cdk.Stack {
    workerPolicy: iam.IManagedPolicy;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Allowing CF and SQS for demo purposes
        this.workerPolicy = new iam.ManagedPolicy(this, 'worker', {
            description: 'gitops4aws worker policy',
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    resources: ['*'],
                    actions: ['cloudformation:*', 'sqs:*'],
                }),
            ],
        });
    }
}
