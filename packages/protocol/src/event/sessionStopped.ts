import { Schema } from 'effect'
import { SessionId } from '../model/session.js'

export class SessionStopped extends Schema.TaggedClass<SessionStopped>()('SessionStopped', {
  sessionId: SessionId,
  reason: Schema.optional(Schema.String),
  timestamp: Schema.DateFromNumber,
}) {}
