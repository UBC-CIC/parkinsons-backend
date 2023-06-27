import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { stringify } from 'csv-stringify/sync';

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


    // SURVEYS CSV UPLOAD
    
    let surveyColumns: string[] = [];
    console.log('jsonObj["surveys"] jsonObj["surveys"] jsonObj["surveys"]');
    console.log(jsonObj["surveys"]);
    if(jsonObj["surveys"]) {
      const surveyID = Object.keys(jsonObj["surveys"])[0];
      console.log('survey ID survey ID' + surveyID);
      surveyColumns = Object.keys(jsonObj["surveys"][surveyID]);
    }

    let surveyArray = [];
    surveyArray.push(surveyColumns);
  
    if(jsonObj["surveys"]) {
      for (let surveyId of Object.keys(jsonObj["surveys"])) {
        let row: any[] = [];
        for (let column of surveyColumns) {
          if (typeof jsonObj["surveys"][surveyId][column] === 'boolean') {
            row.push(jsonObj["surveys"][surveyId][column].toString());
          } else  {
            row.push(jsonObj["surveys"][surveyId][column]);
          }
        }
        
        surveyArray.push(row);
      }
    }

    let surveyCSVUploadKey = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/csv_data/'+jsonObj["study_summary"]["study_id"]+'-surveys.csv';

    

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
      console.log(error);
    }





    // MEDICATIONS CSV UPLOAD

    let medicationsColumns: string[] = ["study_id","trial_id","patient_id","device_id","medication_time"];
  
    let medicationsArray = [];
    medicationsArray.push(medicationsColumns);
  
    if(jsonObj["study_summary"]["medication_times"]) {
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

    let medicationsCSVUploadKey = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/csv_data/'+jsonObj["study_summary"]["study_id"]+'-medications.csv';

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
      console.log(response);
    } catch (error) {
      console.log(error);
    }



    

    

  



    // SURVEY JSON UPLAOD
    
    for (let surveyId of Object.keys(jsonObj["surveys"])) {
      let survey = jsonObj["surveys"][surveyId];

      let surveyJSONUploadKey = 'trials/trial_id=' + survey["trial_id"] + '/patient_id=' + survey["patient_id"] + '/json_data/surveys/' + surveyId + '.json';

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

    const summaryJSONUploadKey = 'trials/trial_id=' + jsonObj["study_summary"]["trial_id"] + '/patient_id=' + jsonObj["study_summary"]["patient_id"] + '/json_data/summaries/' + jsonObj["study_summary"]["study_id"]  + '.json';

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
  } catch (err) {
    console.log(err);
    const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
    console.log(message);
    throw new Error(message);
  }


};

