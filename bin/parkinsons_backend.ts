#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ParkinsonsSurveyLambdaStack as ParkinsonsSurveyLambdaStack } from '../lib/lambda-stack';
import { ParkinsonsSurveyDataStorageStack as ParkinsonsSurveyDataStorageStack } from '../lib/data-storage-stack';
import { ParkinsonsSurveyVPCStack as ParkinsonsSurveyVPCStack } from '../lib/vpc-stack';


const app = new cdk.App();
const vpcStack = new ParkinsonsSurveyVPCStack(app, 'ParkinsonsSurveyVPCStack');
const dataStorageStack = new ParkinsonsSurveyDataStorageStack(app, 'ParkinsonsSurveyDataStorageStack', vpcStack);
new ParkinsonsSurveyLambdaStack(app, 'ParkinsonsSurveyLambdaStack', vpcStack, dataStorageStack);
