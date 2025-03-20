import { Chrome } from '@browserite/launch'
import { Socket } from '@effect/platform'
import { layerWebSocketConstructorGlobal } from '@effect/platform/Socket'
import { Deferred, Duration, Effect, flow, Schema, Stream } from 'effect'
import type { Protocol } from './protocol.js'

type Events = Protocol.Events
type CommandNames = keyof Protocol.CommandParameters

export type CdpEvent = {
  [K in keyof Events]: {
    readonly method: K
    readonly params: Events[K]
  }
}[keyof Events]

const BasicEventShape = Schema.Struct({
  method: Schema.String,
  params: Schema.optional(Schema.Unknown),
})

const BasicResponseShape = Schema.Struct({
  id: Schema.Number,
  result: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

const BasicFailureShape = Schema.Struct({
  id: Schema.Number,
  error: Schema.Struct({
    code: Schema.Number,
    message: Schema.String,
  }),
})

const BasicMessageShape = Schema.Union(
  BasicEventShape.pipe(Schema.attachPropertySignature('_tag', 'event')),
  BasicResponseShape.pipe(Schema.attachPropertySignature('_tag', 'response')),
  BasicFailureShape.pipe(Schema.attachPropertySignature('_tag', 'failure')),
)

export class UnknownResponseFailure extends Schema.TaggedError<UnknownResponseFailure>()(
  'UnknownResponseFailure',
  {
    msg: BasicMessageShape,
  },
) {}

export class DecodeMessageFailure extends Schema.TaggedError<DecodeMessageFailure>()(
  'DecodeMessageFailure',
  {
    cause: Schema.Unknown,
  },
) {}

export class ResponseFailure extends Schema.TaggedError<ResponseFailure>()('ResponseFailure', {
  code: Schema.Number,
  message: Schema.String,
}) {}

export type CdpFailure = UnknownResponseFailure | DecodeMessageFailure | ResponseFailure

class SimpleSubscription<A> {
  private readonly subscribers: Set<(value: A) => void> = new Set()

  subscribe(subscriber: (value: A) => void) {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  publish(value: A) {
    for (const subscriber of this.subscribers) {
      subscriber(value)
    }
  }

  size() {
    return this.subscribers.size
  }
}

const decodeMessage = Schema.decodeUnknown(Schema.parseJson(BasicMessageShape), {
  errors: 'all',
  onExcessProperty: 'preserve',
})

export const makeCdp = Effect.gen(function* () {
  const { devtoolsUrl } = yield* Chrome
  const socket = yield* Socket.makeWebSocket(devtoolsUrl, { openTimeout: Duration.seconds(10) })
  const errorsSubscription = new SimpleSubscription<CdpFailure>()
  const errors = Stream.async<CdpFailure>((emit) =>
    Effect.sync(errorsSubscription.subscribe((x) => emit.single(x))),
  )
  const eventsSubscription = new SimpleSubscription<CdpEvent>()
  const events = yield* Stream.async<CdpEvent>((emit) =>
    Effect.sync(eventsSubscription.subscribe((x) => emit.single(x))),
  ).pipe(Stream.share({ capacity: 'unbounded' }))
  const responses = new Map<number, Deferred.Deferred<any, CdpFailure>>()
  const textDecoder = new TextDecoder()

  yield* socket
    .run(
      Effect.fn('processMessage')(
        function* (data) {
          const msg = yield* decodeMessage(textDecoder.decode(data)).pipe(
            Effect.mapError((cause) => new DecodeMessageFailure({ cause })),
          )
          switch (msg._tag) {
            case 'event':
              return eventsSubscription.publish({
                method: msg.method,
                ...(msg.params !== undefined ? { params: msg.params } : {}),
              } as CdpEvent)
            case 'response': {
              const response = responses.get(msg.id)
              if (response === undefined) {
                return yield* new UnknownResponseFailure({ msg })
              }
              return yield* Deferred.succeed(response, msg.result)
            }
            case 'failure': {
              const response = responses.get(msg.id)
              if (response === undefined) {
                return yield* new UnknownResponseFailure({ msg })
              }
              return yield* Deferred.fail(
                response,
                new ResponseFailure({ code: msg.error.code, message: msg.error.message }),
              )
            }
          }
        },
        Effect.catchAll((error) => Effect.sync(() => errorsSubscription.publish(error))),
      ),
    )
    .pipe(
      Effect.tapBoth({
        onFailure: (error) => Effect.logError('CDP connection error', { error }),
        onSuccess: () => Effect.log('CDP connection opened'),
      }),
      Effect.forkScoped,
      Effect.interruptible,
    )

  const write = flow(yield* socket.writer, Effect.withSpan('Cdp.write'))

  let requestId = 0
  const send = <K extends CommandNames>(
    method: K,
    ...[params, sessionId]: [keyof Protocol.CommandParameters[K]] extends [never]
      ? [{}?, sessionId?: string]
      : [Protocol.CommandParameters[K], sessionId?: string]
  ) =>
    Effect.gen(function* () {
      const id = requestId++
      const response = yield* Deferred.make<Protocol.CommandReturnValues[K], CdpFailure>()
      responses.set(id, response)
      const payload = { id, method, params, sessionId }
      yield* write(JSON.stringify(payload))
      return yield* response
    }).pipe(Effect.withSpan('Cdp.send'))

  const on = <K extends keyof Events, A, E, R>(
    method: K,
    handler: (params: Events[K]) => Effect.Effect<A, E, R>,
    options?: Parameters<typeof Stream.flatMap>[2],
  ): Stream.Stream<A, E, R> =>
    events.pipe(
      Stream.filter((e) => e.method === method),
      Stream.flatMap((e) => handler(e.params as Events[K]), options),
      Stream.withSpan('Cdp.on', {
        attributes: {
          method,
          ...options,
        },
      }),
    )

  const once = <K extends keyof Events, B extends Events[K] = Events[K]>(
    method: K,
    predicate?: ((x: Events[K]) => x is B) | ((x: Events[K]) => boolean),
  ): Effect.Effect<B> =>
    events.pipe(
      Stream.filter((e) =>
        predicate === undefined
          ? e.method === method
          : e.method === method && predicate(e.params as unknown as Events[K]),
      ),
      Stream.take(1),
      Stream.runCollect,
      Effect.map(([ev]) => ev.params as unknown as B),
      Effect.withSpan('Cdp.once', {
        attributes: {
          method,
        },
      }),
    )

  const close = (code: WebsocketStatus, reason: string) =>
    write(new Socket.CloseEvent(code, reason)).pipe(
      Effect.tap(() => Effect.log('CDP connection closed')),
    )

  return {
    send,
    events,
    errors,
    on,
    once,
    close,
  } as const
}).pipe(Effect.withSpan('Cdp.make'))

export const WebsocketStatus = {
  Done: 1000,
  Error: 1001,
  ProtocolError: 1002,
  UnsupportedData: 1003,
  NoStatusReceived: 1005,
  AbnormalClosure: 1006,
  InvalidFramePayloadData: 1007,
  PolicyViolation: 1008,
  MessageTooBig: 1009,
  MissingExtension: 1010,
  InternalError: 1011,
  ServiceRestart: 1012,
  TryAgainLater: 1013,
  BadGateway: 1014,
  TlsHandshake: 1015,
} as const
export type WebsocketStatus = (typeof WebsocketStatus)[keyof typeof WebsocketStatus]

export class Cdp extends Effect.Service<Cdp>()('Cdp', {
  scoped: makeCdp,
  dependencies: [layerWebSocketConstructorGlobal],
  accessors: false,
}) {
  static readonly events = Stream.unwrap(Cdp.use((cdp) => cdp.events))

  static readonly send = <K extends CommandNames>(
    method: K,
    ...params: [keyof Protocol.CommandParameters[K]] extends [never]
      ? [{}?, sessionId?: string]
      : [Protocol.CommandParameters[K], sessionId?: string]
  ) =>
    Cdp.use((cdp) => cdp.send(method, ...params)).pipe(
      Effect.withSpan('Cdp.send', {
        attributes: {
          method,
          params: params?.[0],
          sessionId: params?.[1],
        },
      }),
    )

  static readonly on = <K extends keyof Events, A, E, R>(
    method: K,
    handler: (params: Events[K]) => Effect.Effect<A, E, R>,
  ) => Stream.unwrap(Cdp.use((cdp) => cdp.on(method, handler)))

  static readonly once = <K extends keyof Events, A, E, R>(method: K) =>
    Cdp.use((cdp) => cdp.once(method))
}
