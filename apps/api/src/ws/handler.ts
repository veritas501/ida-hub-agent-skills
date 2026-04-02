// WebSocket connection handler — 每连接有状态管理
// 适配 Hono Bun WebSocket 回调 API
//
// 注意：Hono/Bun 的 upgradeWebSocket 回调中，onOpen 和 onMessage 收到的
// WSContext 是不同对象引用，但 ws.raw（Bun 原生 ServerWebSocket）是稳定的。
// 因此用 Map<ServerWebSocket, ConnState> 存储连接状态。

import type { WSContext } from "hono/ws";
import type { ServerWebSocket } from "bun";
import {
  WSCloseCode,
  WSMessageType,
  wsRegisterSchema,
  wsExecuteResultSchema,
  createLogger,
  getUserByToken,
} from "@ida-claw/shared";
import type { DB, ExecuteResultMessage } from "@ida-claw/shared";
import type { InstanceRegistry } from "../registry/index.js";

const REGISTER_TIMEOUT_MS = 10_000;
const logger = createLogger("ws");

interface ConnState {
  userId: number;
  username: string;
  instanceId: string;
  registered: boolean;
  registerTimer: ReturnType<typeof setTimeout> | null;
  token?: string;
}

// Per-connection state, keyed by Bun native ServerWebSocket (stable reference)
const connState = new Map<ServerWebSocket, ConnState>();

/** Create the onOpen callback for upgradeWebSocket. */
export function createWSOnOpen() {
  return (_evt: Event, ws: WSContext): void => {
    const url = new URL(ws.url ?? "", "http://localhost");
    const token = url.searchParams.get("token") ?? "";

    if (!token) {
      ws.close(WSCloseCode.AUTH_FAILED, "Missing token");
      return;
    }

    const state: ConnState = {
      userId: -1,
      username: "",
      instanceId: "",
      registered: false,
      registerTimer: setTimeout(() => {
        if (!state.registered) {
          logger.warn("Register timeout");
          ws.close(WSCloseCode.REGISTER_TIMEOUT, "Register timeout");
        }
      }, REGISTER_TIMEOUT_MS),
      token,
    };

    // 使用 ws.raw 作为 key，它在 onOpen/onMessage/onClose 之间引用一致
    connState.set(ws.raw as ServerWebSocket, state);
  };
}

/** Create the onMessage callback for upgradeWebSocket. */
export function createWSOnMessage(registry: InstanceRegistry, db: DB) {
  return async (evt: MessageEvent, ws: WSContext): Promise<void> => {
    const state = connState.get(ws.raw as ServerWebSocket);
    if (!state) return;

    const raw = typeof evt.data === "string" ? evt.data : null;
    if (!raw) return;

    const payload = parseJSON(raw);
    if (!payload) return;

    // Phase 1: Authenticate (deferred to first message since getUserByToken is async)
    if (state.userId === -1) {
      const token = state.token ?? "";
      const user = await getUserByToken(db, token);
      if (!user) {
        ws.close(WSCloseCode.AUTH_FAILED, "Invalid token");
        return;
      }
      state.userId = user.id;
      state.username = user.username;
      delete state.token;
      logger.info("WebSocket authenticated", { username: state.username });
    }

    // Phase 2: Register (first typed message after auth)
    if (!state.registered) {
      if (payload.type !== WSMessageType.REGISTER) {
        ws.close(WSCloseCode.REGISTER_REQUIRED, "First message must be register");
        return;
      }

      const parsed = wsRegisterSchema.safeParse(payload);
      if (!parsed.success || !parsed.data.instance_id?.trim()) {
        ws.close(WSCloseCode.REGISTER_REQUIRED, "Invalid instance_id");
        return;
      }

      state.instanceId = parsed.data.instance_id.trim();
      state.registered = true;
      if (state.registerTimer) {
        clearTimeout(state.registerTimer);
        state.registerTimer = null;
      }

      registry.register(
        state.instanceId,
        ws,
        parsed.data.info,
        state.userId,
      );

      ws.send(JSON.stringify({
        type: WSMessageType.REGISTER_ACK,
        instance_id: state.instanceId,
      }));
      logger.info("Register ack sent", { instanceId: state.instanceId });
      return;
    }

    // Phase 3: Handle execute_result
    if (payload.type !== WSMessageType.EXECUTE_RESULT) {
      logger.debug("Ignore ws message", { instanceId: state.instanceId, type: payload.type });
      return;
    }

    const resultParsed = wsExecuteResultSchema.safeParse(payload);
    if (!resultParsed.success) {
      logger.warn("Invalid execute_result payload", { instanceId: state.instanceId, payload });
      return;
    }

    const result: ExecuteResultMessage = resultParsed.data;
    registry.handleResponse(state.instanceId, result);
  };
}

/** Create the onClose callback for upgradeWebSocket. */
export function createWSOnClose(registry: InstanceRegistry) {
  return (_evt: CloseEvent, ws: WSContext): void => {
    const state = connState.get(ws.raw as ServerWebSocket);
    if (!state) return;

    if (state.registerTimer) {
      clearTimeout(state.registerTimer);
    }

    if (state.instanceId) {
      registry.unregister(state.instanceId);
      logger.info("WebSocket disconnected", { instanceId: state.instanceId });
    }

    connState.delete(ws.raw as ServerWebSocket);
  };
}

function parseJSON(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
