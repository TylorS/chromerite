import { Schema } from 'effect'
import { SessionId } from '../model/session.js'

export class SessionStarted extends Schema.TaggedClass<SessionStarted>()('SessionStarted', {
  sessionId: SessionId,
  browserInfo: Schema.Struct({
    name: Schema.String,
    version: Schema.String,
    userAgent: Schema.String,
  }),
  timestamp: Schema.DateFromNumber,
}) {}
