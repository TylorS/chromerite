import { Schema } from 'effect'
import { SessionId } from '../model'
import { Uint8ArrayFromBase64 } from 'effect/Schema'

export class TakeScreenshotFailure extends Schema.TaggedError<TakeScreenshotFailure>()(
  'TakeScreenshotFailure',
  {
    reason: Schema.String,
  },
) {}

export class TakeScreenshotTimedOut extends Schema.TaggedError<TakeScreenshotTimedOut>()(
  'TakeScreenshotTimedOut',
  {
    timeout: Schema.DurationFromMillis,
  },
) {}

export class Clip extends Schema.TaggedClass<Clip>()('Clip', {
  x: Schema.Number,
  y: Schema.Number,
  height: Schema.Number,
  width: Schema.Number,
  scale: Schema.Number,
}) {}

export class ScreenshotFormat extends Schema.Literal('png', 'jpeg', 'webp') {}

export class TakeScreenshot extends Schema.TaggedRequest<TakeScreenshot>()('TakeScreenshot', {
  payload: {
    id: SessionId,
    fullScreen: Schema.optional(Schema.Boolean),
    clip: Schema.optional(Clip),
    format: Schema.optional(ScreenshotFormat),
    timeout: Schema.optional(Schema.DurationFromMillis),
  },
  success: Uint8ArrayFromBase64,
  failure: Schema.Union(TakeScreenshotFailure, TakeScreenshotTimedOut),
}) {}
