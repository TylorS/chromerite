import { Schema } from 'effect'
import { SessionId } from '../model/session.js'

export class WaitForSettledFailure extends Schema.TaggedError<WaitForSettledFailure>()(
  'WaitForSettledFailure',
  {
    id: SessionId,
    reason: Schema.String,
  },
) {}

export class WaitForSettled extends Schema.TaggedRequest<WaitForSettled>()('WaitForSettled', {
  payload: {
    id: SessionId,
    domSettled: Schema.optional(Schema.DurationFromMillis),
    networkIdle: Schema.optional(Schema.DurationFromMillis),
    timeout: Schema.optional(Schema.DurationFromMillis),
  },
  failure: WaitForSettledFailure,
  success: Schema.Struct({
    domUpdated: Schema.Boolean,
    networkUtilized: Schema.Boolean,
    storageUpdated: Schema.Boolean,
  }),
}) {}
