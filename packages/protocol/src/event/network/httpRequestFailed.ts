import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'
import { RequestId } from './httpRequestStarted.js'

export class HttpRequestFailed extends Schema.TaggedClass<HttpRequestFailed>()(
  'HttpRequestFailed',
  {
    sessionId: SessionId,
    requestId: RequestId,
    error: Schema.Struct({
      name: Schema.String,
      message: Schema.String,
      stack: Schema.optional(Schema.String),
    }),
    timestamp: Schema.DateFromNumber,
  },
) {}
