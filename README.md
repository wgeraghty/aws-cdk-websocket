# TypeScript CDK WebSocket with REST API and SDK@V3 Layer

A minimal WebSocket example stack.  Resources created:

* API Gateway WebSocket API
* API Gateway REST API
* DynamoDB Table
* Lambdas and lambda layer

## Lambda Layer

The `lambda-layer/package.zip` file needs to be created before deploying.

Bundled packages controlled by `lambda-layer/nodejs/package.json`

Run `./build.sh` in the `lambda-layer/` folder.

## Source

Main stack in `lib/websocket-stack.ts`

Lambda code in `src/`

## Testing

Chrome Simple WebSocket Client Extension: https://chrome.google.com/webstore/detail/simple-websocket-client/pfdhoblngboilpfeibdedpjgfnlcodoo

Connect to `${WebsocketStack.WebSocketStageUrl}` with a WebSocket client.

Open `${WebSocketStack.BroadcastUri}` in a browser.

You should see `{"now":"2022-03-05T03:19:53.765Z"}` in the WebSocket client but with the current date-time.

Send valid json from one client and all clients should see it.  The input is only restricted to json due to _OnDefault using `JSON.parse(event.body)` before broadcasting.

## Lambdas

* `src/_OnConnect` is called by the API Gateway WebSocket on connect.  Returning an error prevents the connection.
* `src/_OnDisconnect` is called by the API Gateway WebSocket on disconnect.
* `src/_OnDefault` is called by the API Gateway WebSocket as the default route handler if `routeSelectionExpression` does not resolve to another handler.  In this example it just broadcasts any valid json to all connections.

## Note

WebSocket connections have a 10 minute idle disconnect and a 2 hour maximum connection time.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
