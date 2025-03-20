import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'

export const RequestId = Schema.String.pipe(Schema.brand('RequestId'))
export type RequestId = typeof RequestId.Type

export class HttpRequestStarted extends Schema.TaggedClass<HttpRequestStarted>()(
  'HttpRequestStarted',
  {
    sessionId: SessionId,
    requestId: RequestId,
    url: Schema.String,
    method: Schema.String,
    headers: Schema.Record({ key: Schema.String, value: Schema.String }),
    timestamp: Schema.DateFromNumber,
  },
) {}
