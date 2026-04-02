// Protected API routes — require Bearer token auth.

import { Hono } from "hono";
import {
  executeRequestSchema,
  createLogger,
} from "@ida-claw/shared";
import type { Config, DB, IPv4InterfaceItem } from "@ida-claw/shared";
import type { InstanceRegistry } from "../registry/index.js";
import { KeyError, TimeoutError, DisconnectError } from "../registry/index.js";
import { authMiddleware, type AuthUser } from "../middleware/auth.js";
import { encodeIDAConfig } from "../lib/ida-config.js";
import { buildAgentConfigMarkdown } from "../lib/agent-config.js";
import { validateIPv4 } from "../lib/network.js";

const logger = createLogger("api");

export function createAPIRoutes(
  registry: InstanceRegistry,
  config: Config,
  interfaces: IPv4InterfaceItem[],
  defaultIp: string,
  db: DB,
) {
  type AuthEnv = { Variables: { user: AuthUser } };
  const router = new Hono<AuthEnv>();

  // 仅 /api/* 路径需要认证
  router.use("/api/*", authMiddleware(db));

  // GET /api/instances
  router.get("/api/instances", (c) => {
    const user = c.get("user");
    const instances = registry.listAll(user.userId);
    logger.info("List instances", { count: instances.length, username: user.username });
    return c.json(instances);
  });

  // GET /api/network/interfaces
  router.get("/api/network/interfaces", (c) => {
    logger.info("List network interfaces", { count: interfaces.length, defaultIp });
    return c.json({ interfaces, default_ip: defaultIp });
  });

  // POST /api/execute
  router.post("/api/execute", async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const parsed = executeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }

    const { instance_id, code } = parsed.data;
    const requestId = crypto.randomUUID().replace(/-/g, "");

    logger.info("Execute requested", {
      instanceId: instance_id,
      requestId,
      codeLen: code.length,
      username: user.username,
    });

    try {
      const result = await registry.executeCode(
        instance_id,
        code,
        requestId,
        config.timeout,
        user.userId,
      );

      logger.info("Execute completed", {
        instanceId: instance_id,
        requestId,
        success: result.success,
      });

      return c.json({
        success: result.success,
        output: result.output ?? null,
        error: result.error ?? null,
        request_id: requestId,
      });
    } catch (err) {
      if (err instanceof KeyError) {
        logger.warn("Execute rejected (instance not found)", { instanceId: instance_id, requestId });
        return c.json({ error: `Instance not found: ${err.message}` }, 404);
      }
      if (err instanceof TimeoutError) {
        logger.warn("Execute timeout", { instanceId: instance_id, requestId });
        return c.json({ error: "Execute timed out" }, 504);
      }
      if (err instanceof DisconnectError) {
        logger.warn("Execute connection error", { instanceId: instance_id, requestId });
        return c.json({ error: err.message }, 503);
      }
      logger.error("Execute failed", { err, instanceId: instance_id, requestId });
      return c.json({ error: `Execute failed: ${(err as Error).message}` }, 500);
    }
  });

  // GET /api/agent_config
  router.get("/api/agent_config", (c) => {
    const user = c.get("user");
    const ipParam = c.req.query("ip");
    const selectedIp = validateIPv4(ipParam ?? defaultIp) ?? defaultIp;

    const hubUrl = `http://${selectedIp}:${config.port}`;
    const exampleId = registry.getAnyInstanceId(user.userId);
    const markdown = buildAgentConfigMarkdown(hubUrl, exampleId, user.token);

    logger.info("Get agent config", {
      selectedIp,
      port: config.port,
      hasInstance: exampleId !== null,
    });

    return c.json({
      result: markdown,
      selected_ip: selectedIp,
      port: config.port,
    });
  });

  // GET /api/ida_config
  router.get("/api/ida_config", (c) => {
    const user = c.get("user");
    const ipParam = c.req.query("ip");
    const selectedIp = validateIPv4(ipParam ?? defaultIp) ?? defaultIp;

    logger.info("Get ida config", { selectedIp, port: config.port });

    return c.json({
      selected_ip: selectedIp,
      port: config.port,
      ida_config: encodeIDAConfig(selectedIp, config.port, user.token),
    });
  });

  return router;
}
