import { Schema } from 'effect';
import { Uint8ArrayFromBase64 } from 'effect/Schema';
import { SessionId } from '../model';

export class ScreenshotTaken extends Schema.TaggedClass<ScreenshotTaken>()('ScreenshotTaken', {
  sessionId: SessionId,
  screenshot: Uint8ArrayFromBase64,
  timestamp: Schema.DateFromNumber,
}) {}
