import { Schema } from 'effect'
import { SessionId } from '../../model/session.js'

export class StorageMutated extends Schema.TaggedClass<StorageMutated>()('StorageMutated', {
  id: SessionId,
  storage: Schema.String,
}) {}
