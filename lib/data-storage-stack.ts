import { Aws, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';



export class DataStorageStack extends Stack {

  public readonly logBucket: Bucket;
  public readonly storageBucket: Bucket;
  public readonly storageBucketName: string; 
  public readonly accessLogsBucketName: string; 



  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.storageBucketName = 'parkinsons-storage-bucket-' + Aws.ACCOUNT_ID;
    this.accessLogsBucketName = 'parkinsons-access-logs-bucket-' + Aws.ACCOUNT_ID;

    
    this.logBucket = new Bucket(this, 's3AccessLogsBucket', {
      bucketName: this.accessLogsBucketName,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
    });

    this.storageBucket = new Bucket(this, 'uploadBucket', {
      bucketName: this.storageBucketName,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: this.logBucket,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [HttpMethods.HEAD, HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['Authorization', '*'],
        },
      ],
    });

  }

}