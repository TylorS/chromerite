import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'
import { WebsocketId } from './websocketOpened.js'

export class WebsocketFailed extends Schema.TaggedClass<WebsocketFailed>()('WebsocketFailed', {
  sessionId: SessionId,
  websocketId: WebsocketId,
  error: Schema.Struct({
    name: Schema.String,
    message: Schema.String,
    stack: Schema.optional(Schema.String),
  }),
  timestamp: Schema.DateFromNumber,
}) {}
