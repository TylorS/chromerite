import * as process from 'node:process'
import { Schema } from 'effect'

export const ValidPlatform = Schema.Literal('windows', 'macos', 'linux')
export type ValidPlatform = typeof ValidPlatform.Type

function getValidPlatform(): ValidPlatform {
  if (process.platform === 'win32') {
    return 'windows'
  }
  if (process.platform === 'darwin') {
    return 'macos'
  }
  if (process.platform === 'linux') {
    return 'linux'
  }

  throw new Error(`Unsupported platform: ${process.platform}`)
}

export const currentPlatform = getValidPlatform()
