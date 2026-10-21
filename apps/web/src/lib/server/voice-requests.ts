import { z } from "zod";

import { DEMO_SNAPSHOT_MAX_BYTES, persistedDemoStateSchema } from "../demo-state-schema";
import { hasVoiceNotification, voiceModeSchema } from "../voice-artifacts";

export const VOICE_REQUEST_MAX_BYTES = DEMO_SNAPSHOT_MAX_BYTES;

export const voiceSessionRequestSchema = z.object({
  snapshot: persistedDemoStateSchema,
  sdp: z.string().min(1).max(65_536),
  mode: voiceModeSchema.optional(),
  notificationId: z.string().min(1).max(200).optional(),
}).strict().refine(({ snapshot, notificationId }) => hasVoiceNotification(snapshot, notificationId), "That notification is no longer available.");

export const voiceToolRequestSchema = z.object({
  snapshot: persistedDemoStateSchema,
  name: z.string().min(1).max(80),
  arguments: z.union([z.string().max(8_192), z.record(z.string(), z.unknown())]).optional(),
  mode: voiceModeSchema.optional(),
  notificationId: z.string().min(1).max(200).optional(),
}).strict().refine(({ snapshot, notificationId }) => hasVoiceNotification(snapshot, notificationId), "That notification is no longer available.");
