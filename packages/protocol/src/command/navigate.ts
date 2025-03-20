import { Schema } from 'effect'
import { SessionId } from '../model/session.js'

export class NavigateFailure extends Schema.TaggedError<NavigateFailure>()('NavigateFailure', {
  id: SessionId,
  reason: Schema.String,
}) {}

export class NavigateTimedOut extends Schema.TaggedError<NavigateTimedOut>()('NavigateTimedOut', {
  id: SessionId,
  timeout: Schema.DurationFromMillis,
}) {}

export class NavigateResponse extends Schema.TaggedClass<NavigateResponse>()('NavigateResponse', {
  status: Schema.Number,
  statusText: Schema.String,
  headers: Schema.Record({ key: Schema.String, value: Schema.String }),
}) {
  isOk() {
    return this.status > 199 && this.status < 300
  }
}

export class Navigate extends Schema.TaggedRequest<Navigate>()('Navigate', {
  payload: {
    id: SessionId,
    url: Schema.URL,
    referrer: Schema.optional(Schema.String),
    timeout: Schema.optional(Schema.DurationFromMillis),
  },
  failure: Schema.Union(NavigateFailure, NavigateTimedOut),
  success: NavigateResponse,
}) {}
