// @ida-claw/shared — unified re-export

// Types
export type {
  InstanceInfo,
  ExecuteRequest,
  ExecuteResponse,
  AgentConfigResponse,
  IDAConfigResponse,
  IPv4InterfaceItem,
  NetworkInterfacesResponse,
  UserTokenResponse,
  ExecuteResultMessage,
  InstanceMeta,
} from "./types/api.js";

export { EXECUTE_CODE_MAX_CHARS } from "./types/api.js";

export {
  WSCloseCode,
  WSMessageType,
} from "./types/ws.js";

export type {
  WSCloseCode as WSCloseCodeType,
  WSMessageType as WSMessageTypeType,
  WSRegisterMessage,
  WSRegisterAckMessage,
  WSExecuteMessage,
  WSExecuteResultMessage,
} from "./types/ws.js";

// Validators
export {
  registerSchema,
  loginSchema,
  executeRequestSchema,
  wsRegisterSchema,
  wsExecuteResultSchema,
} from "./validators/index.js";

export type {
  RegisterInput,
  LoginInput,
  ExecuteRequestInput,
  WSRegisterInput,
  WSExecuteResultInput,
} from "./validators/index.js";

// DB
export { initDB, createUser, verifyLogin, getUserByToken } from "./db/index.js";
export type { DB, UserRow } from "./db/index.js";
export { users } from "./db/schema.js";

// Config
export { getConfig } from "./config.js";
export type { Config } from "./config.js";

// Logger
export { createLogger } from "./logger.js";
