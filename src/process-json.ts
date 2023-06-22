import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { Parser } from '@json2csv/plainjs';


const s3 = new S3Client({ region: process.env.AWS_REGION });

// Apparently the stream parameter should be of type Readable|ReadableStream|Blob
// The latter 2 don't seem to exist anywhere.
async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

exports.handler = async (event: any) => {
  console.log('EVENTEVENTEVENT');
  console.log(JSON.stringify(event));
  console.log('S3 BODY S3 BODY S3 BODY s3 BODY S3 BODY S3 BODY');
  console.log(event['Records'][0]['s3']);
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(key);
  const getObjParams = {
    Bucket: bucket,
    Key: key,
  };
  try {
    const { Body } = await s3.send(new GetObjectCommand(getObjParams));
    const bodyContents = await streamToString(Body as Readable);
    console.log(bodyContents);

    const jsonObj = JSON.parse(bodyContents);

    // try {
    //   const parser = new Parser();
    //   const csv = parser.parse(jsonObj["surveys"]);
    //   console.log('CSV CSV CSV CSV CSV CSV CSV');
    //   console.log(csv);
    // } catch (err) {
    //   console.error(err);
    // }
    
    for (let surveyId of Object.keys(jsonObj["surveys"])) {
      let survey = jsonObj["surveys"][surveyId];

      let uploadKey = 'trials/trial_id=' + survey["trial_id"] + '/patient_id=' + survey["patient_id"] + '/surveys/' + surveyId + '.json';

      let objBuffer = Buffer.from(JSON.stringify(survey));

      let putSurveyParams = {
        "Bucket": process.env.UPLOAD_BUCKET,
        "Key": uploadKey,
        "Body": objBuffer,
        "ContentType": 'application/json',
      }
      let command = new PutObjectCommand(putSurveyParams);

      try {
        let response = await s3.send(command);
      } catch (error) {
        console.log(error);
      }
    }

    const objBuffer = Buffer.from(JSON.stringify(jsonObj["study_summary"]));

    const uploadKey = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/summaries/' + jsonObj["study_summary"]["study_id"]  + '.json';

    const putSummaryParams = {
      "Bucket": process.env.UPLOAD_BUCKET,
      "Key": uploadKey,
      "Body": objBuffer,
      "ContentType": 'application/json',
    }
    const command = new PutObjectCommand(putSummaryParams);

    try {
      const response = await s3.send(command);
    } catch (error) {
      console.log(error);
    }

    return bodyContents;
  } catch (err) {
    console.log(err);
    const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
    console.log(message);
    throw new Error(message);
  }


};

