import { Schema } from 'effect'
import { Session, SessionId } from '../model/session.js'

export class StopSessionFailure extends Schema.TaggedError<StopSessionFailure>()(
  'StopSessionFailure',
  {
    id: SessionId,
    reason: Schema.String,
  },
) {}

export class StopSessionTimedOut extends Schema.TaggedError<StopSessionTimedOut>()(
  'StopSessionTimedOut',
  {
    id: SessionId,
    timeout: Schema.DurationFromMillis,
  },
) {}

export class StopSession extends Schema.TaggedRequest<StopSession>()('StopSession', {
  payload: {
    id: SessionId,
    timeout: Schema.optional(Schema.DurationFromMillis),
  },
  failure: Schema.Union(StopSessionFailure, StopSessionTimedOut),
  success: Session,
}) {}
