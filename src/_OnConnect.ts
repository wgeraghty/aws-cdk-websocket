/**************************************/

import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Context } from 'aws-lambda'

/**************************************/

const ddb = new DynamoDB({})

/**************************************/

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  console.log(event)

  try {
    const { connectionId } = event.requestContext

    if (!connectionId)
      throw new Error('ConnectionId Missing')

    console.log(`Storing Connection: ${connectionId}`)
    await ddb.putItem({
      TableName: process.env.TABLE,
      Item: {
        'pk': { S: 'CONNECTION' },
        'sk': { S: connectionId }
      }
    })

    // NOTE: ApiGatewayManagementApi.postToConnection(...) will not work for this
    // connection until after this lambda has returned

    // A 200 status code allows the connection to open
    // Any additional data sent here isn't relayed to the client
    console.log('Accepted')
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Accepted'
    }
  } catch (error) {
    console.log(error)
    console.log('Denied')

    // An error status code prevents the connection
    // Any additional data sent here isn't relayed to the client
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Denied'
    }
  }
}

/**************************************/
