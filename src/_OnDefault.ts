/**************************************/

import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Context } from 'aws-lambda'
import { broadcast } from './broadcast'

/**************************************/

const ddb = new DynamoDB({})

/**************************************/

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const { connectionId } = event.requestContext

    if (!connectionId)
      throw new Error('ConnectionId Missing')

    // TODO: Do something?
    const body = JSON.parse(event.body ?? '')
    console.log(body)
    console.log('Broadcasting...')
    await broadcast(body)

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
