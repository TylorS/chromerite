import { Chrome } from '@browserite/launch'
import { HttpRouter, HttpServer } from '@effect/platform'
import { NodeContext, NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { logger } from '@effect/platform/HttpMiddleware'
import { layerWebSocketConstructorGlobal } from '@effect/platform/Socket'
import { Config, Effect, Layer } from 'effect'
import { createServer } from 'node:http'
import { ProtocolHttpApp } from './router.js'
import { SessionManager } from './session-manager.js'

export const ProtocolServer = HttpRouter.empty.pipe(
  HttpRouter.post('/', ProtocolHttpApp),
  HttpServer.serve(logger),
  HttpServer.withLogAddress,
  Layer.provide(SessionManager.Default),
  Layer.provide(Chrome.Default),
  Layer.provide([NodeContext.layer, layerWebSocketConstructorGlobal]),
)

const HttpServerLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const port = yield* Config.integer('CHROMERITE_PORT').pipe(
      Config.orElse(() => Config.succeed(7777)),
    )

    return NodeHttpServer.layer(createServer, { port })
  }),
)

export const launchProtocolServer = ProtocolServer.pipe(
  Layer.provide(HttpServerLive),
  Layer.launch,
  Effect.scoped,
)

NodeRuntime.runMain(launchProtocolServer)

// runProtocolServer()
