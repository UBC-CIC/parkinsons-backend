import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';


export class VPCStack extends Stack {
    public readonly vpc: ec2.Vpc;
    public readonly cidrStr: string;
    public readonly lambdaSecurityGroup: SecurityGroup;


  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpcName = "parkinsons-VPC";

    this.cidrStr = '12.0.0.0/16';


    this.vpc = new ec2.Vpc(this, vpcName, {
        vpcName: vpcName,
        ipAddresses: ec2.IpAddresses.cidr(this.cidrStr),
        maxAzs: 2,
        natGateways: 0,
        subnetConfiguration: [
          {
            name: 'private-subnet',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
        ],
        gatewayEndpoints: {
          S3: {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [{
              subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            }]
          }
        },
      });
      
      this.lambdaSecurityGroup = new SecurityGroup(this, 'ParkinsonsLambdaSG', {
        vpc: this.vpc,
        securityGroupName: "ParkinsonsLambdaSG",
    });

      this.vpc.addInterfaceEndpoint("Secrets-Manager-Endpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        securityGroups: [this.lambdaSecurityGroup],
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      });

      

  }
}
