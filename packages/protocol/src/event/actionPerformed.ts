import { Schema } from 'effect'
import { SessionId } from '../model/session.js'
import { ActionId } from './actionFailed.js'

export class ActionPerformed extends Schema.TaggedClass<ActionPerformed>()('ActionPerformed', {
  sessionId: SessionId,
  actionId: ActionId,
  result: Schema.optional(Schema.Unknown),
  timestamp: Schema.DateFromNumber,
}) {}
