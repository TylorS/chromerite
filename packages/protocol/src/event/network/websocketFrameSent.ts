import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'
import { WebsocketId } from './websocketOpened.js'

export const WebsocketFrameType = Schema.Literal('text', 'binary')
export type WebsocketFrameType = typeof WebsocketFrameType.Type

export class WebsocketFrameSent extends Schema.TaggedClass<WebsocketFrameSent>()(
  'WebsocketFrameSent',
  {
    sessionId: SessionId,
    websocketId: WebsocketId,
    frameType: WebsocketFrameType,
    data: Schema.String, // Base64 encoded for binary data
    timestamp: Schema.DateFromNumber,
  },
) {}
