const express = require('express');
const aws = require ('aws-sdk');

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
  movies.forEach(async movie => {
    await docClient.put({
      TableName: MOVIES_TABLE,
      Item: {
        year: movie.year,
        title: movie.title,
        plot: movie.info?.plot ?? 'No plot provided.',
      }
    });
  });
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

app.post('/movies', async (req, res) => {
  const data = await getBucketJSON(MOVIES_OBJECT);
  await createTable();
  await insertMovies(data);

  res.status(204).end();
});

app.get('/movies/:year/:title', async (req, res) => {
  const results = await findMovies(req.params.year, req.params.title);
  res.json(results);
});

app.delete('/movies', async (req, res) => {
  await deleteTable();

  res.status(204).end();
});

app.listen(3000, () => {
  console.log('Listening on port 3000');
});
