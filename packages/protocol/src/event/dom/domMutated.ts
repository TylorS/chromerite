import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'
import { Snapshot } from '../../model/snapshot.js'

export class DomMutated extends Schema.TaggedClass<DomMutated>()('DomMutated', {
  sessionId: SessionId,
  added: Schema.Array(Snapshot),
  removed: Schema.Array(Snapshot),
  updatedAttributes: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      oldValue: Schema.NullOr(Schema.String),
      newValue: Schema.NullOr(Schema.String),
    }),
  ),
}) {}
