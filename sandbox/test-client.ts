import { FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Duration, Effect } from "effect";
import { Client } from "../packages/server/src/client.js";

const main = Effect.gen(function*() {
  const [startSessionDuration, session] = yield* Effect.timed(
    Client.startSession({ entryUrl: new URL('https://www.google.com') }),
  )
  yield* Effect.log(`startSession: ${Duration.format(startSessionDuration)}`)

  const [waitForSettledDuration] = yield* Effect.timed(session.waitForSettled())
  yield* Effect.log(`waitForSettled: ${Duration.format(waitForSettledDuration)}`)

  const [takeScreenshotDuration, screenshot] = yield* Effect.timed(
    session.takeScreenshot(),
  )
  yield* Effect.log(`takeScreenshot: ${Duration.format(takeScreenshotDuration)}`)

  const fs = yield* FileSystem.FileSystem

  yield* fs.writeFile('screenshot.png', screenshot)

  const [navigateTime, navigateResponse] = yield* Effect.timed(session.navigate({ url: new URL('http://www.expand.ai') }))
  yield* Effect.log(`navigate: ${Duration.format(navigateTime)}`)
  console.log(navigateResponse.isOk())
}).pipe(
  Effect.provide(Client.Default),
  Effect.provide(NodeContext.layer),
  Effect.scoped,
  Effect.withSpan('test-client'),
)

NodeRuntime.runMain(main)