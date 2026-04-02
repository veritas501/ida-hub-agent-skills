// WebSocket message types and close codes — shared between api and ida_plugins.

export const WSCloseCode = {
  REPLACED: 4000,
  REGISTER_REQUIRED: 4001,
  REGISTER_TIMEOUT: 4002,
  AUTH_FAILED: 4003,
} as const;

export type WSCloseCode = (typeof WSCloseCode)[keyof typeof WSCloseCode];

export const WSMessageType = {
  REGISTER: "register",
  REGISTER_ACK: "register_ack",
  EXECUTE: "execute",
  EXECUTE_RESULT: "execute_result",
} as const;

export type WSMessageType = (typeof WSMessageType)[keyof typeof WSMessageType];

export interface WSRegisterMessage {
  type: typeof WSMessageType.REGISTER;
  instance_id: string;
  info?: Record<string, unknown>;
}

export interface WSRegisterAckMessage {
  type: typeof WSMessageType.REGISTER_ACK;
  instance_id: string;
}

export interface WSExecuteMessage {
  type: typeof WSMessageType.EXECUTE;
  request_id: string;
  code: string;
}

export interface WSExecuteResultMessage {
  type: typeof WSMessageType.EXECUTE_RESULT;
  request_id: string;
  success: boolean;
  output?: string | null;
  error?: string | null;
}
