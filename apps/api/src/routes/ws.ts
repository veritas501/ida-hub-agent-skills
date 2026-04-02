// WebSocket route — 使用 Hono Bun 适配器的 WebSocket 支持

import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import type { DB } from "@ida-claw/shared";
import type { InstanceRegistry } from "../registry/index.js";
import {
  createWSOnOpen,
  createWSOnMessage,
  createWSOnClose,
} from "../ws/handler.js";

const { upgradeWebSocket, websocket } = createBunWebSocket();

export { websocket };

/**
 * 注册 WebSocket 路由到 Hono app。
 * websocket 对象需传递给 Bun.serve() 作为 WebSocket handler。
 */
export function setupWSRoute(app: Hono, registry: InstanceRegistry, db: DB): void {
  app.get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen: createWSOnOpen(),
      onMessage: createWSOnMessage(registry, db),
      onClose: createWSOnClose(registry),
    })),
  );
}
