/**************************************/

import { DynamoDB, ScanCommand } from '@aws-sdk/client-dynamodb'
import { ApiGatewayManagementApi, PostToConnectionCommandOutput } from '@aws-sdk/client-apigatewaymanagementapi'
import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler, Context } from 'aws-lambda'
import { unmarshall } from '@aws-sdk/util-dynamodb'

/**************************************/

const ddb = new DynamoDB({})

const apigwManagementApi = new ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.WSS_ENDPOINT,
})

/**************************************/
/**
 * Calls `postToConnection` for all connectionIds, wrapped in a `Promise.all(...)`
 */

export const postToConnections = async (
  connectionIds: string[],
  data: object
): Promise<PostToConnectionCommandOutput[]> =>
  Promise.all(connectionIds.map(id => postToConnection(id, data)))

/**************************************/

export const postToConnection = async <T extends object>(
  connectionId: string,
  data: T
): Promise<PostToConnectionCommandOutput> => {
  return apigwManagementApi.postToConnection({
    ConnectionId: connectionId,
    Data: Buffer.from(JSON.stringify(data))
  })
    .catch(async err => {
      // Catch and rethrow

      if (err.statusCode === 410) {
        // Intercept GoneException to clean up database
        console.log(`Found stale connection, deleting ${connectionId}`)

        // TODO: Send to a queue instead, to be processed by another lambda
        // so every lambda using postToConnection does not need write access
        await ddb.deleteItem({
          TableName: process.env.TABLE,
          Key: {
            'pk': { S: 'CONNECTION' },
            'sk': { S: connectionId }
          }
        })
      }

      // rethrow
      throw err
    })
}

/**************************************/

export const broadcast = async (data: any) => {
  // TODO: Replace this logic, query pk=CONNECTION?
  console.log('Getting connections...')
  const scan = await ddb.send(new ScanCommand({
    TableName: process.env.TABLE
  }))
  // console.log({ scan })

  const connections = (scan.Items || []).map((value, key) => unmarshall(value))
  // console.log({ connections })

  const connectionIds = connections.map(connection => connection.sk) // connectionId is stored in sortKey
  console.log({ connectionIds })

  console.log('Sending broadcast...')
  await postToConnections(connectionIds, data)
}

/**************************************/

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log(event)

  await broadcast({ now: new Date().toISOString() })

  console.log('Returning Success')
  return {
    statusCode: 200,
    headers: { 'content-type': 'text/plain' },
    body: 'Success'
  }
}

/**************************************/
