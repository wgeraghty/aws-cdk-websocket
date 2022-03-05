/**************************************/

import { Construct, RemovalPolicy, Stack, StackProps } from '@aws-cdk/core'

import * as CDK from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as ApiGateway from '@aws-cdk/aws-apigateway'
import * as ApiGatewayV2 from '@aws-cdk/aws-apigatewayv2'
import * as DynamoDb from '@aws-cdk/aws-dynamodb'

import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations'

/**************************************/

const createWebSocketLambdaIntegration = (scope: Construct, lambdaName: string, layer: Lambda.LayerVersion, environment: { [key: string]: string } = {}): {
  lambda: Lambda.Function
  integration: WebSocketLambdaIntegration
} => {
  const lambda = new Lambda.Function(scope, lambdaName, {
    runtime: Lambda.Runtime.NODEJS_14_X,
    code: Lambda.Code.fromAsset('src'),
    handler: `${lambdaName}.handler`,
    layers: [layer],
    environment
  })

  return {
    lambda,
    integration: new WebSocketLambdaIntegration(`WebSocket${lambdaName}Integration`, lambda)
  }
}

/**************************************/

export class WebSocketStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // Somewhere to store connections
    const table = new DynamoDb.Table(this, 'WebSockets', {
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'pk',
        type: DynamoDb.AttributeType.STRING
      },
      sortKey: {
        name: 'sk',
        type: DynamoDb.AttributeType.STRING
      }
    })

    // aws-sdk@v3 is not provided in lambda so bundle it up and include it as a layer
    // run ./build.sh in lambda-layer to create package.zip
    const layer = new Lambda.LayerVersion(this, 'NodeJsPackages', {
      removalPolicy: RemovalPolicy.RETAIN,
      code: Lambda.Code.fromAsset(`${__dirname}/../lambda-layer/package.zip`),
      compatibleRuntimes: [Lambda.Runtime.NODEJS_14_X]
    })

    // Have to create the integrations with their lambdas first ...
    const onConnect = createWebSocketLambdaIntegration(this, '_OnConnect', layer, { TABLE: table.tableName })
    const onDisconnect = createWebSocketLambdaIntegration(this, '_OnDisconnect', layer, { TABLE: table.tableName })
    const onDefault = createWebSocketLambdaIntegration(this, '_OnDefault', layer, { TABLE: table.tableName })

    // ... then the api can be created ...
    const webSocketApi = new ApiGatewayV2.WebSocketApi(this, 'WebSocket Stack WS API', {
      connectRouteOptions: { integration: onConnect.integration },
      disconnectRouteOptions: { integration: onDisconnect.integration },
      defaultRouteOptions: { integration: onDefault.integration },
      routeSelectionExpression: '$request.body.action'
    })

    // ... before the permissions can be set.
    // This allows access to ApiGatewayManagementApi
    webSocketApi.grantManageConnections(onConnect.lambda)
    webSocketApi.grantManageConnections(onDisconnect.lambda)
    webSocketApi.grantManageConnections(onDefault.lambda)

    // Allow connections to be added/removed from the table
    table.grantReadWriteData(onConnect.lambda)
    table.grantReadWriteData(onDisconnect.lambda)
    table.grantReadWriteData(onDefault.lambda)

    const webSocketStage = new ApiGatewayV2.WebSocketStage(this, 'WebSocketApiStage', {
      webSocketApi: webSocketApi,
      stageName: 'dev', // TODO: Set this another way
      autoDeploy: true
    })

    // Set WSS endpoint for ApiGatewayManagementApi
    onConnect.lambda.addEnvironment('WSS_ENDPOINT', webSocketStage.callbackUrl)
    onDisconnect.lambda.addEnvironment('WSS_ENDPOINT', webSocketStage.callbackUrl)
    onDefault.lambda.addEnvironment('WSS_ENDPOINT', webSocketStage.callbackUrl)

    // Rest API Gateway is used as a demo "external" event source
    // Setup REST API endpoint to message websockets
    const restApi = new ApiGateway.RestApi(this, 'RestAPI', {
      restApiName: 'WebSocket Stack REST API'
    })

    // Lambda with its integration
    const broadcastLambda = new Lambda.Function(this, 'Broadcast', {
      runtime: Lambda.Runtime.NODEJS_14_X,
      code: Lambda.Code.fromAsset('src'),
      handler: `broadcast.handler`,
      layers: [layer],
      environment: {
        TABLE: table.tableName,
        WSS_ENDPOINT: webSocketStage.callbackUrl // Used by ApiGatewayManagementApi
      }
    })
    const broadcastIntegration = new ApiGateway.LambdaIntegration(broadcastLambda)

    // Map a REST API resource to the lambda/integration
    // CORS: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-apigateway.CorsOptions.html
    const resource = restApi.root.addResource('broadcast') // PATH: /broadcast
    resource.addCorsPreflight({
      allowOrigins: ApiGateway.Cors.ALL_ORIGINS,
      allowMethods: ['*']
    })
    resource.addMethod('GET', broadcastIntegration)

    // Give broadcast access to ApiGatewayManagementApi
    webSocketApi.grantManageConnections(broadcastLambda)
    // Broadcast might also need to remove disconnected connections
    table.grantReadWriteData(broadcastLambda)

    // Outputs
    new CDK.CfnOutput(this, 'WebSocketStageUrl', { value: webSocketStage.url }) // wss://host/stage
    new CDK.CfnOutput(this, 'WebSocketStageCallbackUrl', { value: webSocketStage.callbackUrl }) // https://host/stage for ApiGatewayManagementApi
    new CDK.CfnOutput(this, 'BroadcastUri', { value: `${restApi.url}${resource.path.substring(1)}` })
  }
}

/**************************************/
