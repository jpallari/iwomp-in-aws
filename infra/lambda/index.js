// Lambda handler for launching pipeline jobs based on SNS messages.
// Incoming messages are validated using the projects stored in SSM parameters.
'use strict';

const aws = require('aws-sdk');
const ssm = new aws.SSM();
const codebuild = new aws.CodeBuild();

exports.handler = async function(event) {
    if (!event.Records[0]) {
        throw new Error('No SNS event found');
    }
    const message = parseMessage(event.Records[0].Sns.Message);
    try {
        await validateProject(message.project);
    } catch (e) {
        throw new Error(`Invalid project ${message.project}: ${e.message}`)
    }
    await launchWorkerJob(message);
    return 'ok';
};

function parseMessage(message) {
    const json = JSON.parse(message);
    if (!json.project) {
        throw new Error('No project name provided');
    }
    if (!json.branch) {
        throw new Error('No branch provided');
    }
    return json
}

async function validateProject(project) {
    const ssmPath = `/${process.env.CONFIGPATH}/${project}`
    const params = {
        Name: ssmPath,
        WithDecryption: true
    }
    const parameter = await ssm.getParameter(params).promise();
    const json = JSON.parse(parameter.Parameter.Value);
    if (!json.gitUrl) {
        throw new Error('No Git URL set')
    }
}

async function launchWorkerJob(message) {
    console.log(`Triggering job for project ${message.project} on branch ${message.branch}`);
    const params = {
        projectName: process.env.WORKER_PROJECT_NAME,
        environmentVariablesOverride: [
            {
                name: 'PROJECTNAME',
                value: message.project,
            },
            {
                name: 'GITBRANCH',
                value: message.branch,
            },
        ],
    };
    const data = await codebuild.startBuild(params).promise();
    console.log(`Job started: ${data.build.id}`);
    return data;
}
