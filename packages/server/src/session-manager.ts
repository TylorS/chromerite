import { Cdp, type CdpEvent } from '@browserite/cdp'
import { Chrome } from '@browserite/launch'
import * as Protocol from '@browserite/protocol'
import { layerWebSocketConstructorGlobal } from '@effect/platform/Socket'
import { DateTimes } from '@typed/id'
import {
  Cause,
  Context,
  Duration,
  Effect,
  ExecutionStrategy,
  Exit,
  type FiberId,
  Layer,
  Option,
  Scope,
  Stream,
} from 'effect'

type SessionEntry = Protocol.Session & {
  cdp: Cdp
  browserContextId: string
  targetId: string
  fiberId: FiberId.FiberId
  scope: Scope.CloseableScope
  openRequests: Set<string>
  lastUsed: number
}

const REQUEST_FINISHED_METHODS = new Set([
  'Network.responseReceived',
  'Network.loadingFailed',
  'Network.loadingFinished',
  'Network.requestServedFromCache',
] as const)

type SetValue<T> = T extends Set<infer R> ? R : never

type REQUEST_FINISHED_EVENT = Extract<
  CdpEvent,
  {
    method: SetValue<typeof REQUEST_FINISHED_METHODS>
  }
>

function isRequestFinishedEvent(event: CdpEvent): event is REQUEST_FINISHED_EVENT {
  return REQUEST_FINISHED_METHODS.has(event.method as REQUEST_FINISHED_EVENT['method'])
}

export const makeChromeSessionManager = Effect.gen(function* () {
  const chrome = yield* Chrome
  const sessionScope = yield* Effect.scope
  const forkScope = Scope.fork(sessionScope, ExecutionStrategy.sequential)
  const dateTimes = yield* DateTimes
  const sessions = new Map<Protocol.SessionId, SessionEntry>()

  const makeNewEntry = Effect.fn('SessionManager.makeNewEntry')(function* (
    url: URL,
    cdp: Cdp,
    sessionId: Protocol.SessionId,
    browserContextId: string,
    targetId: string,
    scope: Scope.CloseableScope,
  ) {
    const now = yield* dateTimes.now
    const { traceId, spanId } = yield* Effect.orDie(Effect.currentSpan)
    const entry: SessionEntry = {
      _tag: 'Session',
      id: sessionId,
      createdAt: new Date(now),
      entryUrl: url,
      traceId: Protocol.TraceId.make(traceId),
      spanId: Protocol.SpanId.make(spanId),
      cdp,
      browserContextId,
      targetId,
      fiberId: yield* Effect.fiberId,
      scope,
      lastUsed: now,
      openRequests: new Set(),
      // TODO: Support user profile
      userProfileId: Option.none(),
    }
    sessions.set(entry.id, entry)

    return entry
  })

  const handleEvent = (entry: SessionEntry) =>
    // biome-ignore lint/correctness/useYield: <explanation>
    Effect.fn('handleEvent')(function* (event: CdpEvent) {
      if (event.method === 'Network.requestWillBeSent') {
        entry.openRequests.add(event.params.requestId)
      } else if (isRequestFinishedEvent(event)) {
        entry.openRequests.delete(event.params.requestId)
      }
    })

  const getSessionById = Effect.fn('getSessionById')(function* <E>(
    id: Protocol.SessionId,
    onError: (reason: string) => E,
  ) {
    const entry = sessions.get(id)
    if (entry === undefined) {
      return yield* Effect.fail(onError(`Session ${id} could not be found`))
    }
    entry.lastUsed = yield* dateTimes.now
    return entry
  })

  const startSession = (request: Protocol.StartSession) =>
    forkScope.pipe(
      Effect.flatMap((scope) =>
        Effect.gen(function* () {
          const cdp = yield* buildService(Cdp, scope)
          const { browserContextId } = yield* cdp.send('Target.createBrowserContext', {
            disposeOnDetach: true,
            proxyServer: formatProxyServer(request.proxy),
          })
          const { targetId } = yield* cdp.send('Target.createTarget', {
            browserContextId,
            url: request.entryUrl.href,
          })
          const { sessionId } = yield* cdp.send('Target.attachToTarget', {
            targetId,
            flatten: true,
          })
          const id = Protocol.SessionId.make(sessionId)
          const entry = yield* makeNewEntry(
            request.entryUrl,
            cdp,
            id,
            browserContextId,
            targetId,
            scope,
          )

          // Start listenign to events
          yield* cdp.events.pipe(Stream.runForEach(handleEvent(entry)), Effect.forkIn(scope))

          // Enable all necessary domains
          yield* Effect.all(
            [
              // Enable page and listen for load or navigated events
              cdp
                .send('Page.enable', {}, sessionId)
                .pipe(
                  Effect.flatMap(() =>
                    request.waitFor === 'loaded'
                      ? cdp.once('Page.loadEventFired')
                      : cdp.once('Page.frameNavigated', (e) => e.frame.id === targetId),
                  ),
                ),
              // Enable Network
              cdp.send('Network.enable', {}, sessionId),
              // Enable DOM -> CSS
              cdp
                .send('DOM.enable', { includeWhitespace: 'none' }, sessionId)
                .pipe(Effect.zipRight(cdp.send('CSS.enable', {}, sessionId))),
              // Enable DOMStorage
              cdp.send('DOMStorage.enable', {}, sessionId),
            ],
            {
              concurrency: 'unbounded',
            },
          )

          // Periodically check if we should cleanup this session because nothing has happend for 2 minutes.
          yield* Effect.gen(function* () {
            const now = yield* dateTimes.now
            const diff = Duration.millis(now - entry.lastUsed)
            if (diff.pipe(Duration.greaterThan(Duration.minutes(2)))) {
              yield* Scope.close(entry.scope, Exit.void)
              sessions.delete(id)
            }
          }).pipe(
            Effect.delay(Duration.minutes(1)),
            Effect.forever,
            Effect.forkIn(scope),
            Effect.interruptible,
          )

          return Protocol.Session.make(
            {
              id,
              createdAt: entry.createdAt,
              entryUrl: entry.entryUrl,
              userProfileId: Option.none(),
              traceId: entry.traceId,
              spanId: entry.spanId,
            },
            {
              disableValidation: true,
            },
          )
        }),
      ),
      Effect.mapErrorCause((cause) =>
        Cause.fail(new Protocol.StartSessionFailure({ reason: Cause.pretty(cause) })),
      ),
      (effect) => {
        const timeout = request.timeout ?? Duration.seconds(30)
        return Effect.timeoutFail(effect, {
          duration: timeout,
          onTimeout: () => new Protocol.StartSessionTimedOut({ timeout }),
        })
      },
      Effect.withSpan('SessionManager.startSession'),
      Effect.provideService(Chrome, chrome),
    )

  const stopSession = Effect.fn('SessionManager.stopSession')(
    function* (request: Protocol.StopSession) {
      const entry = sessions.get(request.id)
      if (entry === undefined) {
        yield* Effect.logWarning('Session not found', { id: request.id })
        return yield* new Protocol.StopSessionFailure({
          id: request.id,
          reason: `Session ${request.id} not found`,
        })
      }
      yield* Scope.close(entry.scope, Exit.void)
      sessions.delete(request.id)

      return Protocol.Session.make(
        { ...entry },
        {
          disableValidation: true,
        },
      )
    },
    (effect, request) => {
      const timeout = request.timeout ?? Duration.seconds(30)

      return Effect.timeoutFail(effect, {
        duration: timeout,
        onTimeout: () => new Protocol.StopSessionTimedOut({ id: request.id, timeout }),
      })
    },
  )

  const addInitScript = Effect.fn('SessionManager.addInitScript')(
    function* (request: Protocol.AddInitScript) {
      const entry = yield* getSessionById(
        request.id,
        (reason) =>
          new Protocol.AddInitScriptFailure({
            id: request.id,
            reason,
          }),
      )

      // Add init script
      yield* entry.cdp.send(
        'Page.addScriptToEvaluateOnLoad',
        {
          scriptSource: request.script,
        },
        entry.id,
      )
    },
    (effect, request) =>
      Effect.catchTags(effect, {
        DecodeMessageFailure: (error) =>
          new Protocol.AddInitScriptFailure({
            id: request.id,
            reason: `DecodeMessageFailure: ${error.message}`,
          }),
        ResponseFailure: (error) =>
          new Protocol.AddInitScriptFailure({
            id: request.id,
            reason: `ResponseFailure: ${error.message}`,
          }),
        SocketError: (error) =>
          new Protocol.AddInitScriptFailure({
            id: request.id,
            reason: `SocketError: ${error.message}`,
          }),
        UnknownResponseFailure: (error) =>
          new Protocol.AddInitScriptFailure({
            id: request.id,
            reason: `UnknownResponseFailure: ${error.message}`,
          }),
      }),
    (effect, request) => {
      const timeout = request.timeout ?? Duration.seconds(30)

      return Effect.timeoutFail(effect, {
        duration: timeout,
        onTimeout: () => new Protocol.AddInitScriptTimedOut({ timeout }),
      })
    },
  )

  const waitForSettled = Effect.fn('SessionManager.waitForSettled')(function* (
    request: Protocol.WaitForSettled,
  ) {
    const { cdp, openRequests } = yield* getSessionById(
      request.id,
      (reason) =>
        new Protocol.WaitForSettledFailure({
          id: request.id,
          reason,
        }),
    )

    let networkUtilized = false
    let domUpdated = false
    let storageUpdated = false

    const domSettled = cdp.events.pipe(
      Stream.filter((event) => event.method.startsWith('DOM.')),
      Stream.tap(() => Effect.sync(() => (domUpdated = true))),
      Stream.merge(Stream.succeed(false)),
      Stream.debounce(request.domSettled ?? Duration.millis(100)),
      Stream.take(1),
      Stream.runDrain,
    )

    const networkSettled = cdp.events.pipe(
      Stream.filter((event) => event.method.startsWith('Network.')),
      Stream.map(() => openRequests.size),
      Stream.merge(Stream.sync(() => openRequests.size)),
      Stream.tap((x) => Effect.sync(() => (networkUtilized ||= x > 0))),
      Stream.filter((x) => x === 0),
      Stream.take(1),
      Stream.runDrain,
    )

    yield* Effect.raceAll([
      Effect.zip(domSettled, networkSettled, { concurrent: true }),
      request.timeout !== undefined ? Effect.sleep(request.timeout) : Effect.never,

      // Just running here to get storageUpdated
      cdp.events.pipe(
        Stream.filter((event) => event.method.startsWith('DOMStorage.')),
        Stream.take(1),
        Stream.runForEach(() => Effect.sync(() => (storageUpdated = true))),
        // Never exit to allow the other conditions to control returning
        Effect.zipRight(Effect.never),
      ),
    ])

    return {
      domUpdated,
      networkUtilized,
      storageUpdated,
    }
  })

  const performAction = Effect.fn('SessionManager.performAction')(
    function* (request: Protocol.PerformAction) {
      const { id, cdp } = yield* getSessionById(
        request.id,
        (reason) =>
          new Protocol.PerformActionFailure({
            id: request.id,
            reason,
          }),
      )

      const action = request.action
      if (action._tag === 'Click') {
        switch (action.locator._tag) {
          case 'css': {
            const { nodeId } = yield* cdp.send('DOM.querySelector', {
              nodeId: 0,
              selector: action.locator.selector,
            })
            const response = yield* cdp.send('DOM.getBoxModel', { nodeId }, id)
            const [x, y, width, height] = response.model.content

            yield* cdp.send(
              'Input.dispatchMouseEvent',
              {
                x: x + width / 2,
                y: y + height / 2,
                type: 'mousePressed',
                button: 'left',
              },
              id,
            )

            return Protocol.ActionUpdate.make(
              {
                // TODO: Check for these things
                domMutated: true,
                networkUtilized: false,
                storageUpdated: false,
              },
              {
                disableValidation: true,
              },
            )
          }
        }
      }

      // TODO: Implement other actions

      return yield* Effect.dieMessage(`Not implemented: ${action._tag}`)
    },
    (effect, request) =>
      Effect.catchTags(effect, {
        DecodeMessageFailure: (error) =>
          new Protocol.PerformActionFailure({
            id: request.id,
            reason: `DecodeMessageFailure: ${error.message}`,
          }),
        ResponseFailure: (error) =>
          new Protocol.PerformActionFailure({
            id: request.id,
            reason: `ResponseFailure: ${error.message}`,
          }),
        SocketError: (error) =>
          new Protocol.PerformActionFailure({
            id: request.id,
            reason: `SocketError: ${error.message}`,
          }),
        UnknownResponseFailure: (error) =>
          new Protocol.PerformActionFailure({
            id: request.id,
            reason: `UnknownResponseFailure: ${error.message}`,
          }),
      }),
    (effect, request) => {
      const timeout = request.timeout ?? Duration.seconds(30)

      return Effect.timeoutFail(effect, {
        duration: timeout,
        onTimeout: () => new Protocol.PerformActionTimedOut({ id: request.id, timeout }),
      })
    },
  )

  const navigate = Effect.fn('SessionManager.navigate')(
    function* (request: Protocol.Navigate) {
      const { id, targetId, cdp } = yield* getSessionById(
        request.id,
        (reason) => new Protocol.NavigateFailure({ id: request.id, reason }),
      )

      const { errorText, loaderId } = yield* cdp.send(
        'Page.navigate',
        {
          url: request.url.href,
          referrer: request.referrer,
          frameId: targetId,
        },
        id,
      )

      if (errorText !== undefined) {
        return yield* new Protocol.NavigateFailure({ id: request.id, reason: errorText })
      }

      // Navigating to a new page
      if (loaderId !== undefined) {
        // Wait for the Network.requestWillBeSent event that matches the loaderId
        // to get the corresponding requestId
        const response = yield* cdp
          .once('Network.requestWillBeSent', (params) => params.loaderId === loaderId)
          .pipe(
            // Then wait for the response
            Effect.flatMap((request) =>
              cdp
                .once(
                  'Network.responseReceived',
                  (params) => params.requestId === request.requestId,
                )
                .pipe(
                  Effect.map(({ response }) => ({
                    status: response.status,
                    statusText: response.statusText || DEFAULT_STATUS_TEXTS[response.status] || '',
                    headers: response.headers,
                  })),
                ),
            ),
          )

        return Protocol.NavigateResponse.make(response, {
          disableValidation: true,
        })
      }

      // Same-page navigations
      return Protocol.NavigateResponse.make(
        {
          status: 200,
          statusText: 'SamePageNavigation',
          headers: {},
        },
        {
          disableValidation: true,
        },
      )
    },
    (effect, request) =>
      Effect.catchTags(effect, {
        DecodeMessageFailure: (error) =>
          new Protocol.NavigateFailure({
            id: request.id,
            reason: `DecodeMessageFailure: ${error.message}`,
          }),
        ResponseFailure: (error) =>
          new Protocol.NavigateFailure({
            id: request.id,
            reason: `ResponseFailure: ${error.message}`,
          }),
        SocketError: (error) =>
          new Protocol.NavigateFailure({
            id: request.id,
            reason: `SocketError: ${error.message}`,
          }),
        UnknownResponseFailure: (error) =>
          new Protocol.NavigateFailure({
            id: request.id,
            reason: `UnknownResponseFailure: ${error.message}`,
          }),
      }),
    (effect, request) => {
      const timeout = request.timeout ?? Duration.seconds(30)

      return Effect.timeoutFail(effect, {
        duration: timeout,
        onTimeout: () => new Protocol.NavigateTimedOut({ id: request.id, timeout }),
      })
    },
  )

  const evaluate = Effect.fn('SessionManager.evaluate')(
    function* (request: Protocol.Evaluate) {
      const { id, cdp } = yield* getSessionById(
        request.id,
        (reason) => new Protocol.EvaluateFailure({ id: request.id, reason }),
      )

      const { result } = yield* cdp
        .send(
          'Runtime.evaluate',
          {
            expression: request.script,
            returnByValue: true,
          },
          id,
        )
        .pipe(
          Effect.mapErrorCause((cause) =>
            Cause.fail(
              new Protocol.EvaluateFailure({ id: request.id, reason: Cause.pretty(cause) }),
            ),
          ),
        )

      return result.value
    },
    (effect, request) => {
      const timeout = request.timeout ?? Duration.seconds(30)

      return Effect.timeoutFail(effect, {
        duration: timeout,
        onTimeout: () => new Protocol.EvaluateTimedOut({ id: request.id, timeout }),
      })
    },
  )

  const takeScreenshot = Effect.fn('SessionManager.takeScreenshot')(
    function* (request: Protocol.TakeScreenshot) {
      const { id, cdp } = yield* getSessionById(
        request.id,
        (reason) => new Protocol.TakeScreenshotFailure({ reason }),
      )
      const { data } = yield* cdp
        .send(
          'Page.captureScreenshot',
          {
            captureBeyondViewport: request.fullScreen,
            clip: request.clip,
            format: request.format ?? 'png',
            optimizeForSpeed: true,
            quality: 100,
          },
          id,
        )
        .pipe(
          Effect.mapErrorCause((cause) =>
            Cause.fail(new Protocol.TakeScreenshotFailure({ reason: Cause.pretty(cause) })),
          ),
        )

      return decodeBase64(data)
    },
    (effect, request) => {
      const timeout = request.timeout ?? Duration.seconds(30)

      return Effect.timeoutFail(effect, {
        duration: timeout,
        onTimeout: () => new Protocol.TakeScreenshotTimedOut({ timeout }),
      })
    },
  )

  return {
    _tag: 'SessionManager',
    startSession,
    stopSession,
    addInitScript,
    waitForSettled,
    performAction,
    navigate,
    evaluate,
    takeScreenshot,
  } as const
})

export class SessionManager extends Effect.Service<SessionManager>()('SessionManager', {
  scoped: makeChromeSessionManager,
  accessors: true,
  dependencies: [DateTimes.Default, layerWebSocketConstructorGlobal],
}) {}

function formatProxyServer(proxy: Protocol.ProxySettings | undefined) {
  if (proxy === undefined) {
    return undefined
  }

  let auth = ''

  if (proxy.username !== undefined) {
    auth += `${proxy.username}`
  }

  if (proxy.password !== undefined) {
    auth += `:${proxy.password}`
  }

  if (auth.length > 0) {
    auth += '@'
  }

  return `http://${auth}${proxy.host}:${proxy.port}`
}

function decodeBase64(data: string) {
  const decoded = atob(data)
  const length = decoded.length
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = decoded.charCodeAt(i)
  }
  return bytes
}

const DEFAULT_STATUS_TEXTS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a teapot",
  422: 'Unprocessable Entity',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  510: 'Not Extended',
  511: 'Network Authentication Required',
}

function buildService<ID, S, E, R>(
  service: Context.Tag<ID, S> & {
    readonly Default: Layer.Layer<ID, E, R>
  },
  scope: Scope.Scope,
) {
  return Layer.buildWithScope(service.Default, scope).pipe(Effect.map(Context.unsafeGet(service)))
}
