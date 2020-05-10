import * as cdk from '@aws-cdk/core';
import * as ssm from '@aws-cdk/aws-ssm';

export class IwompProjectsStack extends cdk.Stack {
    private configPath: string

    constructor(scope: cdk.Construct, id: string, configPath?: string, props?: cdk.StackProps) {
        super(scope, id, props);
        this.configPath = configPath || 'iwomp-in-aws';

        this.projectConfig('demo', {
            gitUrl: "https://github.com/jkpl/cdk-demo",
            command: "./deploy.sh",
        });
    }

    private projectConfig(name: string, config: object): ssm.StringParameter {
        return new ssm.StringParameter(this, `param-${name}`, {
            parameterName: `/${this.configPath}/${name}`,
            stringValue: JSON.stringify(config),
        });
    }
}
