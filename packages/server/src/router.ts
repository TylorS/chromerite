import {
  AddInitScript,
  Evaluate,
  Navigate,
  PerformAction,
  StartSession,
  StopSession,
  TakeScreenshot,
  TakeSnapshot,
  WaitForSettled,
} from '@browserite/protocol'
import { Rpc, RpcRouter } from '@effect/rpc'
import { toHttpApp } from '@effect/rpc-http/HttpRpcRouter'
import { SessionManager } from './session-manager.js'

export const ProtocolRouter = RpcRouter.make(
  Rpc.effect(StartSession, SessionManager.startSession),
  Rpc.effect(StopSession, SessionManager.stopSession),
  Rpc.effect(AddInitScript, SessionManager.addInitScript),
  Rpc.effect(WaitForSettled, SessionManager.waitForSettled),
  Rpc.effect(PerformAction, SessionManager.performAction),
  Rpc.effect(Navigate, SessionManager.navigate),
  Rpc.effect(Evaluate, SessionManager.evaluate),
  Rpc.effect(TakeSnapshot, SessionManager.takeSnapshot),
  Rpc.effect(TakeScreenshot, SessionManager.takeScreenshot),
)

export const PROTOCOL_SPAN_PREFIX = 'ChromeriteProtocol'

export const ProtocolHandler = RpcRouter.toHandlerNoStream(ProtocolRouter, {
  spanPrefix: PROTOCOL_SPAN_PREFIX,
})

export const ProtocolHttpApp = toHttpApp(ProtocolRouter, {
  spanPrefix: PROTOCOL_SPAN_PREFIX,
})
