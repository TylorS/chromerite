import { Schema } from 'effect'

export const ProxyType = Schema.Literal('http', 'https', 'socks5')
export type ProxyType = typeof ProxyType.Type

export const ProxySettings = Schema.TaggedStruct('ProxySettings', {
  type: ProxyType,
  host: Schema.String,
  port: Schema.Number,
  username: Schema.OptionFromNullishOr(Schema.String, null),
  password: Schema.OptionFromNullishOr(Schema.String, null),
})
export type ProxySettings = typeof ProxySettings.Type
