// Request logging middleware using consola.

import { createMiddleware } from "hono/factory";
import { createLogger } from "@ida-claw/shared";

const logger = createLogger("http");

export const loggingMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  logger.info(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});
