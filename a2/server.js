#!/usr/bin/env node
const _ = require('lodash');
const express = require('express');
const cors = require('cors');
const aws = require ('aws-sdk');

// why doesn't this just exist...
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
const MOVIES_TABLE = 'movies';

aws.config.update({
  region: 'eu-west-1'
});

const s3 = new aws.S3();
const dynamodb = new aws.DynamoDB();
const docClient = new aws.DynamoDB.DocumentClient();

async function getBucketJSON(params) {
  const res = await s3.getObject(params).promise();
  return JSON.parse(res.Body);
}

function createTable() {
  return dynamodb.createTable({
    TableName: MOVIES_TABLE,
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
function deleteTable() {
  return dynamodb.deleteTable({ TableName: MOVIES_TABLE }).promise();
}

async function insertMovies(movies) {
  const chunked = _.chunk(movies, 25);

  for (let chunk of chunked) {
    const items = _.map(chunk, movie => ({
      PutRequest: {
        Item: {
          year: {
            N: '' + movie.year,
          },
          title: {
            S: movie.title
          },
          plot: {
            S: movie.info?.plot ?? 'No plot provided.'
          },
        }
      }
    }));

    const req = {
      RequestItems: {
        [MOVIES_TABLE]: items
      }
    };
    await dynamodb.batchWriteItem(req).promise();
  }
}

async function findMovies(year, title) {
  const data = await docClient.query({
    TableName: MOVIES_TABLE,
    KeyConditionExpression: '#yr = :yyyy and begins_with(title, :titleStart)',
    ExpressionAttributeNames: {
        '#yr': 'year'
    },
    ExpressionAttributeValues: {
        ':yyyy': parseInt(year),
        ':titleStart': title
    }
  }).promise();

  return data.Items;
}

const app = express();
// Fix CORS errors when using development server to serve frontend
app.use(cors());

app.post('/movies', aw(async (req, res) => {
  const data = await getBucketJSON(MOVIES_OBJECT);

  await createTable();
  await sleep(15000);

  await insertMovies(data);
  res.status(204).end();
}));

app.get('/movies/:year/:title', aw(async (req, res) => {
  const results = await findMovies(req.params.year, req.params.title);
  res.json(results);
}));

app.delete('/movies', aw(async (req, res) => {
  await deleteTable();

  res.status(204).end();
}));

app.use((err, req, res, next) => {
  res.status(500).json(err);
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
