# Deployment Guide

| Index                                                                    | Description                                 |
| :----------------------------------------------------------------------- | :------------------------------------------ |
| [Dependencies](#dependencies)                                            | Prerequisite dependencies    |
| [Cloning Repository](#step-1-cloning-the-repository)                     | Cloning the project from GitHub to your local machine       |
| [Install Dependencies](#step-2-install-dependencies)                     | Installing required core npm dependencies      |
| [CDK Deployment](#step-3-cdk-deployment-part-1)                   | Deploying the project |

## Dependencies
Before you start deploying, you must have the following dependencies:
- [NodeJS](https://nodejs.org/en/download/)
- [Git](https://git-scm.com/downloads)
- [AWS Account](https://aws.amazon.com/account/) 
- [GitHub Account](https://github.com/) 
- Install the [AWS CLI](https://aws.amazon.com/cli/) tool.
- Install the [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/cli.html) CLI tool.


If you do not currently have a configured AWS Account, configure an account with the following instructions:

- Configure the AWS CLI tool for your AWS Account in the `ca-central-1` region, using a user with programmatic access and the "AdministratorAccess" policy (moving forward, we will assume you have [configured a profile](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/configure/index.html) called `parkinsons-project`):
  > `aws configure --profile parkinsons-project`

If you already have a configured AWS account, you may use your own configured account to deploy. Please note that if you decide to use your own account to deploy, be sure to change our command line commands to use your profile whenever there is a ```--profile``` command.
```
--profile [YOUR_AWS_PROFILE_HERE]
```


## Step 1: Install Dependencies
Ensure you are in the backend directory, then install the core dependencies:
```
npm install
```

If this command gives you an error, run the following commands instead:
```
rm package-lock.json
npm install
```

The run the respective npm build command for your operating system:

For Mac OS
```
npm run build
```

For Windows OS
```
npm run build-windows
```

## Step 2: CDK Deployment
Initialize the CDK stacks (required only if you have not deployed this stack before). 
```
cdk synth --profile parkinsons-project
cdk bootstrap aws://YOUR_AWS_ACCOUNT_ID/ca-central-1 --profile parkinsons-project
```

Deploy the CDK stacks (this will take 30-40 minutes):

```
cdk deploy --all --profile parkinsons-project
```


