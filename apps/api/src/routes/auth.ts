// Authentication routes: register and login.

import { Hono } from "hono";
import { createUser, verifyLogin, registerSchema, loginSchema, createLogger } from "@ida-claw/shared";
import type { DB } from "@ida-claw/shared";

const logger = createLogger("auth");

export function createAuthRoutes(db: DB): Hono {
  const router = new Hono();

  router.post("/api/auth/register", async (c) => {
    const body = await c.req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }

    try {
      const result = await createUser(db, parsed.data.username, parsed.data.password);
      logger.info("User registered", { username: result.username });
      return c.json({ username: result.username, token: result.token }, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        return c.json({ error: "Username already exists" }, 409);
      }
      throw err;
    }
  });

  router.post("/api/auth/login", async (c) => {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }

    const result = await verifyLogin(db, parsed.data.username, parsed.data.password);
    if (!result) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    logger.info("User logged in", { username: result.username });
    return c.json({ username: result.username, token: result.token });
  });

  return router;
}
