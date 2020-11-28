#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const aws = require ('aws-sdk');

// async error handling helper
function aw(fn) {
  return function (req, res, next) {
    fn(req, res, next).catch(next);
  };
}

const PORT = process.env.PORT ?? 3000;
const MOVIES_OBJECT = {
  Bucket: 'csu44000assignment220',
  Key: 'moviedata.json',
};

aws.config.update({
  region: 'eu-west-1'
});

const dynamodb = new aws.DynamoDB();
const s3 = new aws.S3();

async function getBucketJSON(params) {
  const res = await s3.getObject(params).promise();
  return JSON.parse(res.Body);
}

function createTable() {
  return dynamodb.createTable({
    TableName: 'movies',
    KeySchema: [
      { AttributeName: 'year', KeyType: 'HASH' },   // Partition key
      { AttributeName: 'title', KeyType: 'RANGE' }, // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: 'year', AttributeType: 'N' },
      { AttributeName: 'title', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  }).promise();
}

const app = express();
// Fix CORS errors when using development server to serve frontend
app.use(cors());

app.get('/data', aw(async (req, res) => {
  res.json(await getBucketJSON(MOVIES_OBJECT));
}));

app.use((err, req, res, next) => {
  res.status(500).json(err);
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
