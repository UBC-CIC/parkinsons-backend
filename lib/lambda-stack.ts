import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { AssetCode, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { VPCStack } from './vpc-stack';
import { AuthorizationType, EndpointType, LambdaIntegration, MethodLoggingLevel, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { DataStorageStack } from './data-storage-stack';


export class LambdaStack extends Stack {
    public readonly presignedURLFunction: Function;
    public readonly lambdaRole: Role;

  constructor(scope: Construct, id: string, vpcStack: VPCStack, dataStorage: DataStorageStack, props?: StackProps) {
    super(scope, id, props);
    this.lambdaRole = new Role(this, 'ParkinsonsLambdaRole', {
        roleName: 'ParkinsonsLambdaRole',
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
                            // Secrets Manager
                            "secretsmanager:GetResourcePolicy",
                            "secretsmanager:GetSecretValue",
                            "secretsmanager:DescribeSecret",
                            "secretsmanager:ListSecretVersionIds",
                            "secretsmanager:ListSecrets"
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
                        dataStorage.storageBucket.bucketArn
                      ]
                  }),
                ]
            }),
        },
    });
  
    this.presignedURLFunction = new Function(this, 'presignedURLFunction', {
      functionName: "GetURL",
      code: new AssetCode('build/src'),
      handler: 'get-presigned-url.handler',
      runtime: Runtime.NODEJS_18_X,
      role: this.lambdaRole,
      memorySize: 4096,
      timeout: Duration.seconds(300),
      logRetention: RetentionDays.THREE_MONTHS,
      vpc: vpcStack.vpc,
      securityGroups: [
        vpcStack.lambdaSecurityGroup
      ],
      environment: {
        APIKEY_SECRET_NAME: `APIKey`,
        UPLOAD_BUCKET: `parkinsons-storage-bucket-867075516558`
      }
    });    
    
    let gateway = new RestApi(this, 'PresignedURLAPI', {
      restApiName: "ParkinsonsAPI",
      endpointTypes: [EndpointType.REGIONAL],
      deployOptions: {
          metricsEnabled: true,
          loggingLevel: MethodLoggingLevel.INFO,
          dataTraceEnabled: true,
          stageName: 'prod',
          methodOptions: {
              "/*/*": {
                  throttlingRateLimit: 100,
                  throttlingBurstLimit: 200
              }
          }
      },
    });

    const getPresignedURLPath = gateway.root.addResource('presigned-url');
    let getPresignedURLIntegration = new LambdaIntegration(this.presignedURLFunction, {
        proxy: true,
    });
    getPresignedURLPath.addMethod('POST', getPresignedURLIntegration, {
        authorizationType: AuthorizationType.NONE
    });
    
  }
}
