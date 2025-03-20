import { Schema } from 'effect'
import { SpanId, TraceId } from './trace.js'
import { UserProfileId } from './user-profile.js'

export const SessionId = Schema.String.pipe(Schema.brand('SessionId'))
export type SessionId = typeof SessionId.Type

export const Session = Schema.TaggedStruct('Session', {
  id: SessionId,
  createdAt: Schema.DateFromNumber,
  entryUrl: Schema.URL,
  userProfileId: Schema.OptionFromNullishOr(UserProfileId, null),
  traceId: TraceId,
  spanId: SpanId,
})
export type Session = typeof Session.Type
export type SessionEncoded = typeof Session.Encoded
