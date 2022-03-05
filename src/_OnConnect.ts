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

    console.log('Accepted')
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Accepted'
    }
  } catch (error) {
    console.log(error)
    console.log('Denied')

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Denied'
    }
  }
}

/**************************************/
