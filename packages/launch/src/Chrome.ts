import { Command, FetchHttpClient, FileSystem, HttpClient } from '@effect/platform'
import type { Signal } from '@effect/platform/CommandExecutor'
import { Duration, Effect, Layer, Schema, Sink, Stream } from 'effect'
import { findChromeBinaryPath } from './findBinaryPath.js'

export interface LaunchOptions {
  readonly executablePath: string
  readonly userDataDir: string
  readonly headless: boolean
  readonly port: number
  readonly args: Array<string>
}

let DEFAULT_PORT = 9222

const makeTmpDir = FileSystem.FileSystem.pipe(
  Effect.flatMap((fs) => fs.makeTempDirectoryScoped({ prefix: 'browserite-chrome-' })),
)

export const launch = (input: Partial<LaunchOptions> = {}) =>
  Effect.gen(function* () {
    const executablePath = input.executablePath ?? (yield* findChromeBinaryPath)
    const args = input.args ?? []
    const port = input.port ?? DEFAULT_PORT++
    const userDataDir = input.userDataDir ?? (yield* makeTmpDir)

    // To enable CDP connections
    args.push(`--remote-debugging-port=${port}`)

    // So it doesn't utilize your default user
    args.push(`--user-data-dir=${userDataDir}`)

    /* To start without user input */
    args.push('--no-first-run')
    args.push('--no-default-browser-check')
    args.push('--disable-default-apps')
    args.push('--no-service-autorun')
    args.push('--password-store=basic')

    /* For faster screenshots */
    args.push('--hide-scrollbars')
    args.push('--disable-extensions')

    // Headless mode
    if (input.headless) {
      args.push('--headless')
    }

    const cmd = Command.make(executablePath, ...args)
    const process = yield* Command.start(cmd)

    // Wait for DevTools to be ready
    yield* Stream.decodeText(process.stderr).pipe(
      Stream.dropUntil((line) => line.trim().startsWith('DevTools listening on')),
      Stream.take(1),
      Stream.runDrain,
      Effect.timeout(Duration.seconds(10)),
      Effect.catchAllCause(() => new DevtoolsNotRunningError()),
    )

    // Get the browser info
    const response = yield* HttpClient.get(`http://localhost:${port}/json/version`)
    const json = yield* response.json
    const { webSocketDebuggerUrl, ...rest } = json as { webSocketDebuggerUrl: string }

    yield* Effect.logDebug('Chrome', rest)

    return {
      _tag: 'Chrome',
      process,
      devtoolsUrl: webSocketDebuggerUrl,
    } as const
  })

export class Chrome extends Effect.Service<Chrome>()('Chrome', {
  scoped: launch(),
  dependencies: [FetchHttpClient.layer],
  accessors: true,
}) {
  static readonly layer = (input: Partial<LaunchOptions>) => Layer.scoped(Chrome, launch(input))
  static readonly stdin = Sink.unwrap(Chrome.use(({ process }) => process.stdin))
  static readonly stderr = Stream.unwrap(Chrome.use(({ process }) => process.stderr))
  static readonly stdout = Stream.unwrap(Chrome.use(({ process }) => process.stdout))
  static readonly exitCode = Chrome.use(({ process }) => process.exitCode)
  static readonly isRunning = Chrome.use(({ process }) => process.isRunning)
  static readonly pid = Chrome.use(({ process }) => process.pid)
  static readonly kill = (signal?: Signal) => Chrome.use(({ process }) => process.kill(signal))
}

export class DevtoolsNotRunningError extends Schema.TaggedError<DevtoolsNotRunningError>()(
  'DevtoolsNotRunningError',
  {},
) {}
