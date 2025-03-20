import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'

export const LogLevel = Schema.Literal('debug', 'info', 'warn', 'error')
export type LogLevel = typeof LogLevel.Type

export class LogEntryAdded extends Schema.TaggedClass<LogEntryAdded>()('LogEntryAdded', {
  sessionId: SessionId,
  level: LogLevel,
  message: Schema.String,
  data: Schema.optional(Schema.Unknown),
  timestamp: Schema.DateFromNumber,
}) {}
