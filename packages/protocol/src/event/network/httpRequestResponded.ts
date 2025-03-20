import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'
import { RequestId } from './httpRequestStarted.js'

export class HttpRequestResponded extends Schema.TaggedClass<HttpRequestResponded>()(
  'HttpRequestResponded',
  {
    sessionId: SessionId,
    requestId: RequestId,
    status: Schema.Number,
    statusText: Schema.String,
    headers: Schema.Record({ key: Schema.String, value: Schema.String }),
    timestamp: Schema.DateFromNumber,
  },
) {}
