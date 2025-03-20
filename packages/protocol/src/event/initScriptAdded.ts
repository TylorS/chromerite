import { Schema } from 'effect'
import { SessionId } from '../model/session.js'

export class InitScriptAdded extends Schema.TaggedClass<InitScriptAdded>()('InitScriptAdded', {
  sessionId: SessionId,
  // TODO: We should integrate with a service to store this somewhere more useful than as text
  script: Schema.String,
  timestamp: Schema.DateFromNumber,
}) {}
