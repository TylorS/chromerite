import { Schema } from 'effect'
import { SessionId } from '../model/session.js'

export const ActionId = Schema.String.pipe(Schema.brand('ActionId'))
export type ActionId = typeof ActionId.Type

export class ActionFailed extends Schema.TaggedClass<ActionFailed>()('ActionFailed', {
  sessionId: SessionId,
  actionId: ActionId,
  error: Schema.Struct({
    name: Schema.String,
    message: Schema.String,
    stack: Schema.optional(Schema.String),
  }),
  timestamp: Schema.DateFromNumber,
}) {}
