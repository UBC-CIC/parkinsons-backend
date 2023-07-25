import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { AuthorizationType, EndpointType, LambdaIntegration, MethodLoggingLevel, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { AssetCode, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { ParkinsonsSurveyDataStorageStack } from './data-storage-stack';
import { ParkinsonsSurveyVPCStack } from './vpc-stack';
import { CfnWebACL, CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';


export class ParkinsonsSurveyLambdaStack extends Stack {
  public readonly presignedURLFunction: Function;
  public readonly presignedURLLambdaRole: Role;

  constructor(scope: Construct, id: string, vpcStack: ParkinsonsSurveyVPCStack, dataStorage: ParkinsonsSurveyDataStorageStack, props?: StackProps) {
    super(scope, id, props);
    this.presignedURLLambdaRole = new Role(this, 'PresignedURLLambdaRole', {
      roleName: 'PresignedURLLambdaRole',
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
                `${dataStorage.rawDataBucket.bucketArn}/*`
              ]
            }),
          ]
        }),
      },
    });

    this.presignedURLFunction = new Function(this, 'presignedURLFunction', {
      functionName: "ParkinsonsSurveyLambdaStack-GetURL",
      description: "Generates pre-signed URL to give mobile app access to S3.",
      code: new AssetCode('build/src'),
      handler: 'get-presigned-url.handler',
      runtime: Runtime.NODEJS_18_X,
      role: this.presignedURLLambdaRole,
      memorySize: 3008,
      timeout: Duration.seconds(300),
      logRetention: RetentionDays.THREE_MONTHS,
      vpc: vpcStack.vpc,
      securityGroups: [
        vpcStack.lambdaSecurityGroup
      ],
      environment: {
        APIKEY_SECRET_NAME: `APIKey`,
        UPLOAD_BUCKET: dataStorage.rawDataBucket.bucketName,
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



    // Store the gateway ARN for use with our WAF stack 
    const apiGatewayARN = `arn:aws:apigateway:${Stack.of(this).region}::/restapis/${gateway.restApiId}/stages/${gateway.deploymentStage.stageName}`


    // Waf Firewall
    const webAcl = new CfnWebACL(this, 'waf', {
      description: 'waf for Parkinson API Gateway',
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: { 
        sampledRequestsEnabled: true, 
        cloudWatchMetricsEnabled: true,
        metricName: 'parkinsons-survey-firewall'
      },
      rules: [
        {
          name: 'AWS-AWSManagedRulesCommonRuleSet',
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            }
          },
          overrideAction: { none: {}},
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesCommonRuleSet'
          }
        },
        {
          name: 'LimitRequests1000',
          priority: 2,
          action: {
            block: {}
          },
          statement: {
            rateBasedStatement: {
              limit: 1000,
              aggregateKeyType: "IP"
            }
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'LimitRequests1000'
          }
        },
    ]
    })

    // Associate the WAF with the API endpoint
    new CfnWebACLAssociation(this, `WebAclAssociation`, {
      resourceArn: apiGatewayARN,
      webAclArn: webAcl.attrArn
  });
  }

}

