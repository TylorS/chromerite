import { Schema } from 'effect'

export const UserProfileId = Schema.String.pipe(Schema.brand('UserProfileId'))
export type UserProfileId = typeof UserProfileId.Type

export const UserProfileName = Schema.String.pipe(Schema.brand('UserProfileName'))
export type UserProfileName = typeof UserProfileName.Type

export const UserProfile = Schema.TaggedStruct('UserProfile', {
  id: UserProfileId,
  createdAt: Schema.DateFromNumber,
  name: UserProfileName,
})
