import { Schema } from 'effect'

export const CssLocator = Schema.TaggedStruct('css', {
  selector: Schema.String,
})
export type CssLocator = typeof CssLocator.Type

export const Locator = Schema.Union(CssLocator)
export type Locator = typeof Locator.Type
