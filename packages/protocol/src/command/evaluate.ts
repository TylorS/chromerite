import { Schema } from 'effect'
import { SessionId } from '../model/session.js'

export class EvaluateFailure extends Schema.TaggedError<EvaluateFailure>()('EvaluateFailure', {
  id: SessionId,
  reason: Schema.String,
}) {}

export class EvaluateTimedOut extends Schema.TaggedError<EvaluateTimedOut>()('EvaluateTimedOut', {
  id: SessionId,
  timeout: Schema.DurationFromMillis,
}) {}

export class Evaluate extends Schema.TaggedRequest<Evaluate>()('Evaluate', {
  payload: {
    id: SessionId,
    script: Schema.String,
    timeout: Schema.optional(Schema.DurationFromMillis),
  },
  failure: Schema.Union(EvaluateFailure, EvaluateTimedOut),
  success: Schema.Unknown,
}) {}
