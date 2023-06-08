#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack';
import { DataStorageStack } from '../lib/data-storage-stack';
import { VPCStack } from '../lib/vpc-stack';


const app = new cdk.App();
const vpcStack = new VPCStack(app, 'VPCStack');
new LambdaStack(app, 'LambdaStack', vpcStack);
new DataStorageStack(app, 'DataStorageStack');
