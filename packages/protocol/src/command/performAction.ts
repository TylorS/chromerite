import { Schema } from 'effect'
import { Action } from '../model/action'
import { SessionId } from '../model/session'

export class PerformActionFailure extends Schema.TaggedError<PerformActionFailure>()(
  'PerformActionFailure',
  {
    id: SessionId,
    reason: Schema.String,
  },
) {}

export class PerformActionTimedOut extends Schema.TaggedError<PerformActionTimedOut>()(
  'PerformActionTimedOut',
  {
    id: SessionId,
    timeout: Schema.DurationFromMillis,
  },
) {}

export const ActionUpdate = Schema.TaggedStruct('update', {
  domMutated: Schema.Boolean,
  networkUtilized: Schema.Boolean,
  storageUpdated: Schema.Boolean,
})
export type ActionUpdate = typeof ActionUpdate.Type

export const NavigationUpdate = Schema.TaggedStruct('navigation', {
  navigatedTo: Schema.URL,
})
export type NavigationUpdate = typeof NavigationUpdate.Type

export const Update = Schema.Union(ActionUpdate, NavigationUpdate)
export type Update = typeof Update.Type

export class PerformAction extends Schema.TaggedRequest<PerformAction>()('PerformAction', {
  payload: {
    id: SessionId,
    action: Action,
    timeout: Schema.optional(Schema.DurationFromMillis),
  },
  failure: Schema.Union(PerformActionFailure, PerformActionTimedOut),
  success: Update,
}) {}
