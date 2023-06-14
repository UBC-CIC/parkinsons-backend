import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager"

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

exports.handler = async (event: any) => {
  const secretsClient = new SecretsManagerClient({})
  const secret = await secretsClient.send(
      new GetSecretValueCommand({
          SecretId: process.env.APIKEY_SECRET_NAME,
      }) 
  )
  
  const secretValues = JSON.parse(secret.SecretString ?? '{}')
  const storedAPIKey = secretValues.api_key;

  console.log(event.body);
  const eventBody = JSON.parse(event.body);
  console.log('EVENTBODY: ' + eventBody);
  const inputAPIKey = eventBody.APIKey;

  if(storedAPIKey == inputAPIKey) {
    const uploadURL = await getUploadURL(event);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Authorization, *',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
      },
      body: JSON.stringify(uploadURL),
    };
  } else {
    return {
      statusCode: 403,
      body: 'API Key Invalid', 
    }
  }
};

const getUploadURL = async function(event: any) {

  // const apiRequestId = event.requestContext.requestId;
  // const contentType = event.queryStringParameters.contentType;
  // const extension = getExtension(contentType);
  // const s3Key = `${apiRequestId}.${extension}`;


  const eventBody = JSON.parse(event.body)
  const s3Key = eventBody.S3Key;


  // Get signed URL from S3
  const putObjectParams = {
    Bucket: process.env.UPLOAD_BUCKET,
    Key: s3Key,
    ContentType: 'application/json',
  };
  const command = new PutObjectCommand(putObjectParams);

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: parseInt(process.env.URL_EXPIRATION_SECONDS || '300') });

  return {
    uploadURL: signedUrl,
    key: s3Key,
  };
};