import { Schema } from 'effect'
import { SessionId } from '../model/session.js'

export class AddInitScriptFailure extends Schema.TaggedError<AddInitScriptFailure>()(
  'AddInitScriptFailure',
  {
    id: SessionId,
    reason: Schema.String,
  },
) {}

export class AddInitScriptTimedOut extends Schema.TaggedError<AddInitScriptTimedOut>()(
  'AddInitScriptTimedOut',
  {
    timeout: Schema.DurationFromMillis,
  },
) {}

export class AddInitScript extends Schema.TaggedRequest<AddInitScript>()('AddInitScript', {
  payload: {
    id: SessionId,
    script: Schema.String,
    timeout: Schema.optional(Schema.DurationFromMillis),
  },
  failure: Schema.Union(AddInitScriptFailure, AddInitScriptTimedOut),
  success: Schema.Void,
}) {}
