import { Schema } from 'effect'
import { Locator } from './locator.js'

export const ClickAction = Schema.TaggedStruct('Click', {
  locator: Locator,
  timeout: Schema.optional(Schema.DurationFromMillis),
})

export const ScrollDirection = Schema.Literal('up', 'down', 'left', 'right')
export type ScrollDirection = typeof ScrollDirection.Type

export const ScrollByType = Schema.TaggedStruct('scrollBy', {
  x: Schema.Number,
  y: Schema.Number,
})
export type ScrollByType = typeof ScrollByType.Type

export const ScrollPercentageType = Schema.TaggedStruct('scrollPercentage', {
  direction: ScrollDirection,
  percentage: Schema.Number,
})
export type ScrollPercentageType = typeof ScrollPercentageType.Type

export const ScrollType = Schema.Union(ScrollByType, ScrollPercentageType)
export type ScrollType = typeof ScrollType.Type

export const ScrollAction = Schema.TaggedStruct('Scroll', {
  locator: Locator,
  type: ScrollType,
  timeout: Schema.optional(Schema.DurationFromMillis),
})

export const Action = Schema.Union(ClickAction, ScrollAction)
export type Action = typeof Action.Type
