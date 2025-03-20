import {
  AddInitScript,
  Evaluate,
  Navigate,
  PerformAction,
  type Session,
  StartSession,
  type StartSessionFailure,
  type StartSessionTimedOut,
  StopSession,
  TakeSnapshot,
  TakeScreenshot,
  WaitForSettled,
} from '@browserite/protocol'
import { FetchHttpClient, HttpClient, HttpClientRequest } from '@effect/platform'
import { type Rpc, RpcResolver } from '@effect/rpc'
import { HttpRpcResolver } from '@effect/rpc-http'
import { Config, Effect, Layer, type Scope } from 'effect'
import type { Simplify } from 'effect/Types'
import type { ProtocolRouter } from './router.js'

type Command =
  | StartSession
  | StopSession
  | AddInitScript
  | WaitForSettled
  | PerformAction
  | Navigate
  | Evaluate
  | TakeSnapshot
  | TakeScreenshot

const makeClient = (fallbackUrl: string) =>
  Effect.gen(function* () {
    const baseUrl = yield* Config.nonEmptyString('CHROMERITE_BASE_URL').pipe(
      Config.orElse(() => Config.succeed(fallbackUrl)),
    )
    const baseClient = yield* HttpClient.HttpClient
    const client = baseClient.pipe(
      HttpClient.filterStatusOk,
      HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
    )
    const makeRequest = RpcResolver.toClient(HttpRpcResolver.make<typeof ProtocolRouter>(client))

    return {
      _tag: 'Client',
      makeRequest,
    } as const
  })

export class Client extends Effect.Service<Client>()('Client', {
  effect: makeClient('http://localhost:7777'),
  dependencies: [FetchHttpClient.layer],
}) {
  static readonly withFallback = (fallbackUrl: string) =>
    Layer.effect(Client, makeClient(fallbackUrl))

  static readonly makeRequest = <C extends Command>(cmd: C) =>
    Client.use((client) => client.makeRequest(cmd))

  static readonly startSession = (
    params: ConstructorParameters<typeof StartSession>[0],
  ): Effect.Effect<
    ClientSession,
    StartSessionFailure | StartSessionTimedOut,
    Scope.Scope | Client
  > =>
    Effect.gen(function* () {
      const client = yield* Client
      const session = yield* client.makeRequest(
        StartSession.make(params, { disableValidation: true }),
      )
      yield* Effect.addFinalizer(() =>
        Effect.ignoreLogged(
          client.makeRequest(StopSession.make({ id: session.id }, { disableValidation: true })),
        ),
      )
      return new ClientSessionImpl(session, client.makeRequest)
    })
}

type OnlyIfNecessary<T> = [
  HasRequiredKeys<T> extends true ? [Simplify<T>] : [Simplify<T>?],
] extends [infer U]
  ? U
  : never

type HasRequiredKeys<T> =
  // Utility type to check if an object type has required keys
  // If T has any required keys, this will be true, otherwise false
  T extends object
    ? { [K in keyof T]-?: undefined extends T[K] ? never : K } extends { [K in keyof T]: never }
      ? false
      : true
    : false

export interface ClientSession extends Session {
  readonly addInitScript: (
    ...params: OnlyIfNecessary<Omit<ConstructorParameters<typeof AddInitScript>[0], 'id'>>
  ) => Rpc.Rpc.Result<AddInitScript>
  readonly waitForSettled: (
    ...params: OnlyIfNecessary<Omit<ConstructorParameters<typeof WaitForSettled>[0], 'id'>>
  ) => Rpc.Rpc.Result<WaitForSettled>
  readonly performAction: (
    ...params: OnlyIfNecessary<Omit<ConstructorParameters<typeof PerformAction>[0], 'id'>>
  ) => Rpc.Rpc.Result<PerformAction>
  readonly navigate: (
    ...params: OnlyIfNecessary<Omit<ConstructorParameters<typeof Navigate>[0], 'id'>>
  ) => Rpc.Rpc.Result<Navigate>
  readonly evaluate: (
    ...params: OnlyIfNecessary<Omit<ConstructorParameters<typeof Evaluate>[0], 'id'>>
  ) => Rpc.Rpc.Result<Evaluate>
  readonly takeSnapshot: (
    ...params: OnlyIfNecessary<Omit<ConstructorParameters<typeof TakeSnapshot>[0], 'id'>>
  ) => Rpc.Rpc.Result<TakeSnapshot>
  readonly takeScreenshot: (
    ...params: OnlyIfNecessary<Omit<ConstructorParameters<typeof TakeScreenshot>[0], 'id'>>
  ) => Rpc.Rpc.Result<TakeScreenshot>
}

class ClientSessionImpl implements ClientSession {
  readonly _tag = 'Session'
  readonly id: Session['id']
  readonly createdAt: Session['createdAt']
  readonly entryUrl: Session['entryUrl']
  readonly traceId: Session['traceId']
  readonly spanId: Session['spanId']
  readonly userProfileId: Session['userProfileId']

  constructor(
    session: Session,
    readonly makeRequest: <C extends Command>(cmd: C) => Rpc.Rpc.Result<C>,
  ) {
    this.id = session.id
    this.createdAt = session.createdAt
    this.entryUrl = session.entryUrl
    this.traceId = session.traceId
    this.spanId = session.spanId
    this.userProfileId = session.userProfileId
  }

  readonly addInitScript: ClientSession['addInitScript'] = (params) =>
    this.makeRequest(AddInitScript.make({ ...params, id: this.id }, { disableValidation: true }))

  readonly waitForSettled: ClientSession['waitForSettled'] = (params) =>
    this.makeRequest(WaitForSettled.make({ ...params, id: this.id }, { disableValidation: true }))

  readonly performAction: ClientSession['performAction'] = (params) =>
    this.makeRequest(PerformAction.make({ ...params, id: this.id }, { disableValidation: true }))

  readonly navigate: ClientSession['navigate'] = (params) =>
    this.makeRequest(Navigate.make({ ...params, id: this.id }, { disableValidation: true }))

  readonly evaluate: ClientSession['evaluate'] = (params) =>
    this.makeRequest(Evaluate.make({ ...params, id: this.id }, { disableValidation: true }))

  readonly takeSnapshot: ClientSession['takeSnapshot'] = (params) =>
    this.makeRequest(TakeSnapshot.make({ ...params, id: this.id }, { disableValidation: true }))

  readonly takeScreenshot: ClientSession['takeScreenshot'] = (params) =>
    this.makeRequest(TakeScreenshot.make({ ...params, id: this.id }, { disableValidation: true }))
}
