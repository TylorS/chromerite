import { FileSystem } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { ValidPlatform, currentPlatform } from './platform.js'

const chromeBinaryPaths: Record<ValidPlatform, readonly string[]> = {
  windows: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome Beta\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome Canary\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome Beta\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome Canary\\Application\\chrome.exe',
  ],
  macos: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome-beta',
    '/usr/bin/google-chrome-unstable',
    '/usr/bin/google-chrome-dev',
  ],
}

export class UnableToFindBinaryPath extends Schema.TaggedError<UnableToFindBinaryPath>()(
  'UnableToFindBinaryPath',
  {
    platform: ValidPlatform,
    paths: Schema.Array(Schema.String),
  },
) {}

const findBinaryPath = (paths: readonly string[]) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    for (const path of paths) {
      const exists = yield* fs.exists(path).pipe(Effect.catchAll(() => Effect.succeed(false)))
      if (exists) return path
    }

    return yield* new UnableToFindBinaryPath({ platform: currentPlatform, paths })
  })

export const findChromeBinaryPath = findBinaryPath(chromeBinaryPaths[currentPlatform])
