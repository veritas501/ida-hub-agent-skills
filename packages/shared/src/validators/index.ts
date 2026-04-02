import { z } from "zod";
import { EXECUTE_CODE_MAX_CHARS } from "../types/api.js";
import { WSMessageType } from "../types/ws.js";

// --- Auth ---

export const registerSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// --- API ---

export const executeRequestSchema = z.object({
  instance_id: z.string().min(1),
  code: z.string().max(EXECUTE_CODE_MAX_CHARS),
});

// --- WS ---

export const wsRegisterSchema = z.object({
  type: z.literal(WSMessageType.REGISTER),
  instance_id: z.string().min(1),
  info: z.record(z.unknown()).optional(),
});

export const wsExecuteResultSchema = z.object({
  type: z.literal(WSMessageType.EXECUTE_RESULT),
  request_id: z.string().min(1),
  success: z.boolean(),
  output: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

// --- Inferred types ---

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ExecuteRequestInput = z.infer<typeof executeRequestSchema>;
export type WSRegisterInput = z.infer<typeof wsRegisterSchema>;
export type WSExecuteResultInput = z.infer<typeof wsExecuteResultSchema>;
