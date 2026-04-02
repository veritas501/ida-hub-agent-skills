// Global error handler middleware for Hono.

import type { ErrorHandler } from "hono";
import { createLogger } from "@ida-claw/shared";

const logger = createLogger("error-handler");

export const errorHandler: ErrorHandler = (err, c) => {
  const status = "status" in err && typeof err.status === "number" ? err.status : 500;

  if (status >= 500) {
    logger.error("Unhandled error", { err, path: c.req.path });
  }

  return c.json(
    { error: err.message || "Internal Server Error" },
    status as 500,
  );
};
