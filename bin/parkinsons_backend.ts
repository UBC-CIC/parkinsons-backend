#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack';
import { DataStorageStack } from '../lib/data-storage-stack';
import { VPCStack } from '../lib/vpc-stack';
import { GlueStack } from '../lib/glue-stack';


const app = new cdk.App();
const vpcStack = new VPCStack(app, 'VPCStack');
const dataStorageStack = new DataStorageStack(app, 'DataStorageStack', vpcStack);
new LambdaStack(app, 'LambdaStack', vpcStack, dataStorageStack);
new GlueStack(app, 'GlueStack', dataStorageStack.processedDataBucket);