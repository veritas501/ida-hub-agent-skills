// Bearer token authentication middleware for Hono.

import { createMiddleware } from "hono/factory";
import type { DB } from "@ida-claw/shared";
import { getUserByToken } from "@ida-claw/shared";

/** Authenticated user context stored in Hono variables. */
export interface AuthUser {
  userId: number;
  username: string;
  token: string;
}

/**
 * Create a Hono middleware that extracts and validates the Bearer token.
 * On success, sets `c.var.user` to an AuthUser.
 */
export function authMiddleware(db: DB) {
  return createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
    const authHeader = c.req.header("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const token = authHeader.slice(7);
    const user = await getUserByToken(db, token);
    if (!user) {
      return c.json({ error: "Invalid token" }, 401);
    }

    c.set("user", {
      userId: user.id,
      username: user.username,
      token: user.token,
    });
    await next();
  });
}
