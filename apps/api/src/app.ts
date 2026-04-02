// Hono application factory — 组装所有中间件和路由

import { Hono } from "hono";
import {
  initDB,
  getConfig,
  createLogger,
} from "@ida-claw/shared";
import type { DB, Config, IPv4InterfaceItem } from "@ida-claw/shared";
import { errorHandler } from "./middleware/error-handler.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createAPIRoutes } from "./routes/api.js";
import healthz from "./routes/healthz.js";
import { setupWSRoute } from "./routes/ws.js";
import { InstanceRegistry } from "./registry/index.js";
import {
  listIPv4Interfaces,
  pickDefaultIPv4,
  fetchPublicIPv4,
} from "./lib/network.js";

const logger = createLogger("app");

export interface AppState {
  config: Config;
  db: DB;
  registry: InstanceRegistry;
  interfaces: IPv4InterfaceItem[];
  defaultIp: string;
}

/**
 * 创建并配置 Hono 应用。
 * 返回 app 和初始化状态。
 */
export async function createApp(): Promise<{ app: Hono; state: AppState }> {
  const config = getConfig();
  const db = initDB(config.db);
  const registry = new InstanceRegistry();

  const rawInterfaces = listIPv4Interfaces();
  const [defaultIp, publicIp] = await Promise.all([
    pickDefaultIPv4(rawInterfaces),
    fetchPublicIPv4(),
  ]);
  const interfaces: IPv4InterfaceItem[] = [...rawInterfaces];

  if (publicIp) {
    interfaces.push({
      name: "public_ip",
      ipv4: publicIp,
      is_loopback: false,
    });
  }

  const app = new Hono();

  app.onError(errorHandler);
  app.use("*", loggingMiddleware);

  app.route("/", healthz);
  app.route("/", createAuthRoutes(db));
  app.route("/", createAPIRoutes(registry, config, interfaces, defaultIp, db));

  setupWSRoute(app, registry, db);

  const state: AppState = {
    config,
    db,
    registry,
    interfaces,
    defaultIp,
  };

  logger.info("Hub app initialized", {
    host: config.host,
    port: config.port,
    debug: config.debug,
    defaultIp,
    publicIp: publicIp ?? "<none>",
    interfaces: interfaces.map((i) => `${i.name}:${i.ipv4}`),
  });

  return { app, state };
}
