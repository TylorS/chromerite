import { Schema } from 'effect'
import { ProxySettings } from '../model/proxy.js'
import { Session } from '../model/session.js'
import { UserProfileName } from '../model/user-profile.js'

export class StartSessionFailure extends Schema.TaggedError<StartSessionFailure>()(
  'StartSessionFailure',
  {
    reason: Schema.String,
  },
) {}

export class StartSessionTimedOut extends Schema.TaggedError<StartSessionTimedOut>()(
  'StartSessionTimedOut',
  {
    timeout: Schema.DurationFromMillis,
  },
) {}

export class StartSession extends Schema.TaggedRequest<StartSession>()('StartSession', {
  payload: {
    entryUrl: Schema.URL,
    proxy: Schema.optional(ProxySettings),
    userProfileName: Schema.optional(UserProfileName),
    updateUserProfile: Schema.optional(Schema.Boolean),
    waitFor: Schema.optional(Schema.Literal('navigation', 'loaded')),
    timeout: Schema.optional(Schema.DurationFromMillis),
  },
  failure: Schema.Union(StartSessionFailure, StartSessionTimedOut),
  success: Session,
}) {}
