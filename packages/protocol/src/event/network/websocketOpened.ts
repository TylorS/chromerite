import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'

export const WebsocketId = Schema.String.pipe(Schema.brand('WebsocketId'))
export type WebsocketId = typeof WebsocketId.Type

export class WebsocketOpened extends Schema.TaggedClass<WebsocketOpened>()('WebsocketOpened', {
  sessionId: SessionId,
  websocketId: WebsocketId,
  url: Schema.String,
  protocols: Schema.Array(Schema.String),
  timestamp: Schema.DateFromNumber,
}) {}
