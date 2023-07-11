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
  console.log('EVENTEVENTEVENT');
  console.log(JSON.stringify(event));
  console.log('S3 BODY S3 BODY S3 BODY s3 BODY S3 BODY S3 BODY');
  console.log(event['Records'][0]['s3']);
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log('KEY KEY KEY');
  console.log(key);
  console.log('BUCKET BUCKET BUCKET');
  console.log(bucket);
  const getObjParams = {
    Bucket: bucket,
    Key: key,
  };
  console.log('111111');

  const { Body } = await s3.send(new GetObjectCommand(getObjParams));
  console.log('2222222');
  const bodyContents = await streamToString(Body as Readable);
  console.log(bodyContents);

  const jsonObj = JSON.parse(bodyContents);


  // SURVEYS CSV UPLOAD

  let surveyColumns: string[] = [];
  console.log('jsonObj["surveys"] jsonObj["surveys"] jsonObj["surveys"]');
  console.log(jsonObj["surveys"]);
  if (jsonObj["surveys"]) {
    const surveyID = Object.keys(jsonObj["surveys"])[0];
    console.log('survey ID survey ID' + surveyID);
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
    console.log('33333333');

    let response = await s3.send(surveyCSVCommand);
    console.log('44444444');

  } catch (error) {
    console.log(error);
  }



  // CREATE GLUE PARTITION FOR SURVEYS CSV

  let surveyCSVLocation = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/file_type=csv_data/study_id=' + jsonObj["study_summary"]["study_id"] + '/content_type=surveys';

  try {
    const getSurveyTableInput = {
      DatabaseName: "parkinsons_database",
      Name: "survey_table",
    }
    const getSurveyTableCommand = new GetTableCommand(getSurveyTableInput);

    console.log('BUCKET NAME BUCKET NAME');
    console.log(process.env.UPLOAD_BUCKET);

    const getTableResponseSurvey = await glue.send(getSurveyTableCommand);
    const storageDescriptorSurvey = getTableResponseSurvey['Table']!['StorageDescriptor']!;
    storageDescriptorSurvey['Location'] = `s3://` + process.env.UPLOAD_BUCKET + `/${surveyCSVLocation}`;

    const surveyInput = { // CreatePartitionRequest
      DatabaseName: "parkinsons_database",
      TableName: "survey_table",
      PartitionInput: { // PartitionInput
        Values: [
          jsonObj["study_summary"]["trial_id"],
          jsonObj["study_summary"]["patient_id"],
          "csv_data",
          jsonObj["study_summary"]["study_id"],
          "surveys",
        ],
        StorageDescriptor: storageDescriptorSurvey,

      }
    }
    const createSurveyPartitionCommand = new CreatePartitionCommand(surveyInput);
    const data = await glue.send(createSurveyPartitionCommand);
  } catch (error) {
    console.log('GLUE ERROR GLUE ERROR');
    console.log(error);
  } finally {
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
    console.log('55555555');

    let response = await s3.send(mediactionsCSVCommand);
    console.log('6666666');

    console.log(response);
  } catch (error) {
    console.log(error);
  }




  // CREATE GLUE PARTITION FOR MEDICATIONS CSV

  let medicationCSVLocation = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/file_type=csv_data/study_id=' + jsonObj["study_summary"]["study_id"] + '/content_type=medications';

  try {
    const getMedicationTableInput = {
      DatabaseName: "parkinsons_database",
      Name: "medication_table",
    }
    const getMedicationTableCommand = new GetTableCommand(getMedicationTableInput);

    console.log('BUCKET NAME BUCKET NAME');
    console.log(process.env.UPLOAD_BUCKET);

    const getTableResponseMedication = await glue.send(getMedicationTableCommand);
    const storageDescriptorMedication = getTableResponseMedication['Table']!['StorageDescriptor']!;
    storageDescriptorMedication['Location'] = `s3://` + process.env.UPLOAD_BUCKET + `/${medicationCSVLocation}`;

    const medicationInput = { // CreatePartitionRequest
      DatabaseName: "parkinsons_database",
      TableName: "medication_table",
      PartitionInput: { // PartitionInput
        Values: [
          jsonObj["study_summary"]["trial_id"],
          jsonObj["study_summary"]["patient_id"],
          "csv_data",
          jsonObj["study_summary"]["study_id"],
          "medications",
        ],
        StorageDescriptor: storageDescriptorMedication,

      }
    }
    const createMedicationPartitionCommand = new CreatePartitionCommand(medicationInput);
    const data = await glue.send(createMedicationPartitionCommand);
  } catch (error) {
    console.log(error);
  } finally {
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
      console.log(error);
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
    console.log(error);
  }

  return bodyContents;
};

