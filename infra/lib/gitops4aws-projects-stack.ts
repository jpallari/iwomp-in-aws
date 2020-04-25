import * as cdk from '@aws-cdk/core';
import * as ssm from '@aws-cdk/aws-ssm';

export class GitOpsProjectsStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, configPath?: string, props?: cdk.StackProps) {
        super(scope, id, props);
        configPath = configPath || 'gitops4aws';

        new ssm.StringParameter(this, 'demo', {
            parameterName: `/${configPath}/demo`,
            stringValue: JSON.stringify({
                gitUrl: "https://github.com/Lepovirta/cdk-demo",
                gitBranch: "master",
                command: "./deploy.sh",
            }),
        });
    }
}
