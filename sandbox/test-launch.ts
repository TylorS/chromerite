import { NodeContext, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer, Stream } from 'effect'
import { Cdp } from '../packages/cdp/src/CDP'
import { Chrome } from '../packages/launch/src/Chrome'
import { writeFileSync } from 'node:fs'

const layer = Cdp.Default.pipe(
  Layer.provide(Chrome.Default),
  Layer.provide(NodeContext.layer),
)

const main = Effect.gen(function* () {
  const start = performance.now()
  const cdp = yield* Cdp
  const { browserContextId, targetId, sessionId } = yield* openSession(cdp, 'https://www.google.com')
  // Now try to take the screenshot
  yield* Effect.logInfo('Taking screenshot...')
  const result = yield* cdp.send('Page.captureScreenshot', { optimizeForSpeed: true }, sessionId)
  writeFileSync('screenshot.png', Buffer.from(result.data, 'base64'))
  yield* Effect.logInfo('Screenshot taken successfully')
  const end = performance.now()
  console.log(`Time taken: ${end - start} milliseconds`)
}).pipe(
  Effect.withSpan('test-launch'),
  Effect.provide(layer),
  Effect.scoped,
)

function openSession(cdp: Cdp, url: string) {
  return Effect.gen(function* () {
    const { browserContextId } = yield* cdp.send('Target.createBrowserContext', {})
    const { targetId } = yield* cdp.send('Target.createTarget', {
      browserContextId,
      url,
    })
    const { sessionId } = yield* cdp.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    })

    yield* Effect.all([
      cdp.send('Page.enable', {}, sessionId),
      cdp.once('Page.loadEventFired'),
    ], {
      concurrency: 'unbounded'
    })

    return {
      sessionId,
      browserContextId,
      targetId,
    }
  })
}

NodeRuntime.runMain(main)
