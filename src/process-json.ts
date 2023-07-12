import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { stringify } from 'csv-stringify/sync';
import { CreatePartitionCommand, GetTableCommand, Glue, GlueClient } from '@aws-sdk/client-glue';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const glue = new GlueClient({ region: process.env.AWS_REGION });

async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

exports.handler = async (event: any) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  const getObjParams = {
    Bucket: bucket,
    Key: key,
  };

  const { Body } = await s3.send(new GetObjectCommand(getObjParams));
  const bodyContents = await streamToString(Body as Readable);

  const jsonObj = JSON.parse(bodyContents);


  // SURVEYS CSV UPLOAD

  let surveyColumns: string[] = [];
  
  if (jsonObj["surveys"]) {
    const surveyID = Object.keys(jsonObj["surveys"])[0];
    surveyColumns = Object.keys(jsonObj["surveys"][surveyID]);
  }

  let surveyArray = [];
  surveyArray.push(surveyColumns);

  if (jsonObj["surveys"]) {
    for (let surveyId of Object.keys(jsonObj["surveys"])) {
      let row: any[] = [];
      for (let column of surveyColumns) {
        if (typeof jsonObj["surveys"][surveyId][column] === 'boolean') {
          row.push(jsonObj["surveys"][surveyId][column].toString());
        } else {
          row.push(jsonObj["surveys"][surveyId][column]);
        }
      }

      surveyArray.push(row);
    }
  }

  let surveyCSVUploadKey = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/file_type=csv_data/study_id=' + jsonObj["study_summary"]["study_id"] + '/content_type=surveys/surveys.csv';



  let surveyCSVBuffer = Buffer.from(stringify(surveyArray));

  let putSurveyParams = {
    "Bucket": process.env.UPLOAD_BUCKET,
    "Key": surveyCSVUploadKey,
    "Body": surveyCSVBuffer,
    "ContentType": 'text/csv',
  }
  let surveyCSVCommand = new PutObjectCommand(putSurveyParams);

  try {
    let response = await s3.send(surveyCSVCommand);
  } catch (error) {
  }



  // MEDICATIONS CSV UPLOAD

  let medicationsColumns: string[] = ["study_id", "trial_id", "patient_id", "device_id", "medication_time"];

  let medicationsArray = [];
  medicationsArray.push(medicationsColumns);

  if (jsonObj["study_summary"]["medication_times"]) {
    for (let medication_time of jsonObj["study_summary"]["medication_times"]) {
      let row: any[] = [];
      row.push(jsonObj["study_summary"]["study_id"]);
      row.push(jsonObj["study_summary"]["trial_id"]);
      row.push(jsonObj["study_summary"]["patient_id"]);
      row.push(jsonObj["study_summary"]["device_id"]);
      row.push(medication_time);
      medicationsArray.push(row);
    }
  }

  let medicationsCSVUploadKey = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/file_type=csv_data/study_id=' + jsonObj["study_summary"]["study_id"] + '/content_type=medications/medications.csv';

  let medacitonsCSVBuffer = Buffer.from(stringify(medicationsArray));

  let putMedicationsParam = {
    "Bucket": process.env.UPLOAD_BUCKET,
    "Key": medicationsCSVUploadKey,
    "Body": medacitonsCSVBuffer,
    "ContentType": 'text/csv',
  }
  let mediactionsCSVCommand = new PutObjectCommand(putMedicationsParam);

  try {
    let response = await s3.send(mediactionsCSVCommand);
  } catch (error) {

  }



  // SURVEY JSON UPLAOD

  for (let surveyId of Object.keys(jsonObj["surveys"])) {
    let survey = jsonObj["surveys"][surveyId];

    let surveyJSONUploadKey = 'trials/trial_id=' + survey["trial_id"] + '/patient_id=' + survey["patient_id"] + '/file_type=json_data/content_type=surveys/' + surveyId + '.json';

    let surveyJSONBuffer = Buffer.from(JSON.stringify(survey));

    let putSurveyParams = {
      "Bucket": process.env.UPLOAD_BUCKET,
      "Key": surveyJSONUploadKey,
      "Body": surveyJSONBuffer,
      "ContentType": 'application/json',
    }
    let command = new PutObjectCommand(putSurveyParams);

    try {
      let response = await s3.send(command);
    } catch (error) {
    }
  }

  // SUMMARY JSON UPLOAD

  const summaryJSONBuffer = Buffer.from(JSON.stringify(jsonObj["study_summary"]));

  const summaryJSONUploadKey = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/file_type=json_data/content_type=summaries/' + jsonObj["study_summary"]["study_id"] + '.json';

  const putSummaryParams = {
    "Bucket": process.env.UPLOAD_BUCKET,
    "Key": summaryJSONUploadKey,
    "Body": summaryJSONBuffer,
    "ContentType": 'application/json',
  }
  const summaryJSONCommand = new PutObjectCommand(putSummaryParams);

  try {
    const response = await s3.send(summaryJSONCommand);
  } catch (error) {
  }

  return bodyContents;
};

