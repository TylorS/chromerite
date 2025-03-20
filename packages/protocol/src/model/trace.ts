import { Schema } from 'effect'

export const TraceId = Schema.String.pipe(Schema.brand('TraceId'))
export type TraceId = typeof TraceId.Type

export const SpanId = Schema.String.pipe(Schema.brand('SpanId'))
export type SpanId = typeof SpanId.Type
