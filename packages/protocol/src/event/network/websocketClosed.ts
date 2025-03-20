import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'
import { WebsocketId } from './websocketOpened.js'

export class WebsocketClosed extends Schema.TaggedClass<WebsocketClosed>()('WebsocketClosed', {
  sessionId: SessionId,
  websocketId: WebsocketId,
  code: Schema.Number,
  reason: Schema.String,
  wasClean: Schema.Boolean,
  timestamp: Schema.DateFromNumber,
}) {}
