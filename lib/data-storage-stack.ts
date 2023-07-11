import { Aws, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { AccountRootPrincipal, Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { VPCStack } from './vpc-stack';
import { Key } from 'aws-cdk-lib/aws-kms';
import { EventType } from 'aws-cdk-lib/aws-s3';
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { AssetCode, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';


export class DataStorageStack extends Stack {

  public readonly logBucket: Bucket;
  public readonly rawDataBucket: Bucket;
  public readonly processedDataBucket: Bucket;
  public readonly encryptionKey: Key;
  public readonly rawBucketName: string;
  public readonly processedBucketName: string;
  public readonly accessLogsBucketName: string;

  public readonly jsonProcessingFunction: Function;
  public readonly processingLambdaRole: Role;

  constructor(scope: Construct, id: string, vpcStack: VPCStack, props?: StackProps) {
    super(scope, id, props);

    this.rawBucketName = 'parkinsons-raw-data-bucket-' + Aws.ACCOUNT_ID;
    this.processedBucketName = 'parkinsons-processed-data-bucket-' + Aws.ACCOUNT_ID;
    this.accessLogsBucketName = 'parkinsons-access-logs-bucket-' + Aws.ACCOUNT_ID;


    this.encryptionKey = new Key(this, 'Encryption', {
      alias: `parkinsons-kms-key`,
      description: "KMS key for Parkinsons app",
      enableKeyRotation: true,
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            sid: 'DefaultKmsPolicy',
            actions: [
              'kms:*',
            ],
            resources: ['*'],
            effect: Effect.ALLOW,
            principals: [
              new AccountRootPrincipal(),
            ]
          })
        ]
      })
    });

    this.logBucket = new Bucket(this, 's3AccessLogsBucket', {
      bucketName: this.accessLogsBucketName,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
    });

    this.rawDataBucket = new Bucket(this, 'uploadBucket', {
      bucketName: this.rawBucketName,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: this.logBucket,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      versioned: true,
      cors: [
        {
          allowedMethods: [HttpMethods.HEAD, HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['Authorization', '*'],
        },
      ],
    });

    this.processedDataBucket = new Bucket(this, 'processedBucket', {
      bucketName: this.processedBucketName,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: this.logBucket,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      versioned: true,
      cors: [
        {
          allowedMethods: [HttpMethods.HEAD, HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['Authorization', '*'],
        },
      ],
    });


    this.processingLambdaRole = new Role(this, 'ProcessingLambdaRole', {
      roleName: 'ProcessingLambdaRole',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        additional: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'kms:Decrypt',
                'kms:Encrypt',
                'kms:GenerateDataKey',
                // CloudWatch
                'cloudwatch:*',
                'logs:*',
                // VPC
                'ec2:CreateNetworkInterface',
                'ec2:Describe*',
                'ec2:DeleteNetworkInterface',
                // Glue
                'glue:CreatePartition',
                'glue:GetTable'
              ],
              resources: ['*']
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                // S3
                's3:PutObject',
              ],
              resources: [
                `${this.processedDataBucket.bucketArn}/*`
              ]
            }),
            new PolicyStatement({
              actions: ["s3:ListBucket"],
              resources: [`${this.rawDataBucket.bucketArn}/*`]

            }), new PolicyStatement({
              actions: ["s3:GetObject"],
              resources: [`${this.rawDataBucket.bucketArn}/*`]
            })
          ]
        }),
      },
    });

    this.jsonProcessingFunction = new Function(this, 'jsonProcessingFunction', {
      functionName: "ProcessJson",
      code: new AssetCode('build/src'),
      handler: 'process-json.handler',
      runtime: Runtime.NODEJS_18_X,
      role: this.processingLambdaRole,
      memorySize: 3008,
      timeout: Duration.seconds(300),
      logRetention: RetentionDays.THREE_MONTHS,
      vpc: vpcStack.vpc,
      securityGroups: [
        vpcStack.lambdaSecurityGroup
      ],
      environment: {
        UPLOAD_BUCKET: this.processedDataBucket.bucketName,
      }
    });

    this.rawDataBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.jsonProcessingFunction),
      {
        prefix: 'trials/',
        suffix: ".json"
      }
    );

  }

}