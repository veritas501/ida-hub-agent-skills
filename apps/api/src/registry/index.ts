// InstanceRegistry — manages connected IDA instances and pending execute requests.
// Port of hub_backend/src/ida_chat_hub/registry.py

import type { WSContext } from "hono/ws";
import {
  WSCloseCode,
  WSMessageType,
  createLogger,
} from "@ida-claw/shared";
import type {
  InstanceInfo,
  InstanceMeta,
  ExecuteResultMessage,
} from "@ida-claw/shared";

const logger = createLogger("registry");

interface ConnectedInstance {
  instanceId: string;
  ws: WSContext;
  info: InstanceMeta;
  connectedAt: Date;
  userId: number;
}

interface PendingFuture {
  resolve: (result: ExecuteResultMessage) => void;
  reject: (err: Error) => void;
}

export class InstanceRegistry {
  private instances = new Map<string, ConnectedInstance>();
  private pending = new Map<string, PendingFuture>(); // key: `${instanceId}:${requestId}`

  private pendingKey(instanceId: string, requestId: string): string {
    return `${instanceId}:${requestId}`;
  }

  register(
    instanceId: string,
    ws: WSContext,
    info: Record<string, unknown> | undefined,
    userId: number,
  ): void {
    const old = this.instances.get(instanceId);
    const meta: InstanceMeta = {
      module: String(info?.module ?? "unknown"),
      db_path: String(info?.db_path ?? ""),
      architecture: String(info?.architecture ?? "unknown"),
      platform: String(info?.platform ?? "unknown"),
    };

    this.instances.set(instanceId, {
      instanceId,
      ws,
      info: meta,
      connectedAt: new Date(),
      userId,
    });

    if (old && old.ws !== ws) {
      logger.warn("Instance replaced", { instanceId });
      old.ws.close(WSCloseCode.REPLACED, "Replaced by newer session");
    }

    logger.info("Instance registered", { instanceId, userId });
  }

  unregister(instanceId: string): void {
    this.instances.delete(instanceId);

    // Reject all pending futures for this instance
    for (const [key, future] of this.pending) {
      if (key.startsWith(`${instanceId}:`)) {
        this.pending.delete(key);
        future.reject(new DisconnectError(instanceId));
      }
    }

    logger.info("Instance unregistered", { instanceId });
  }

  get(instanceId: string, userId: number): ConnectedInstance | null {
    const item = this.instances.get(instanceId);
    if (!item || item.userId !== userId) return null;
    return item;
  }

  getAnyInstanceId(userId: number): string | null {
    for (const item of this.instances.values()) {
      if (item.userId === userId) return item.instanceId;
    }
    return null;
  }

  listAll(userId: number): InstanceInfo[] {
    const result: InstanceInfo[] = [];
    for (const item of this.instances.values()) {
      if (item.userId !== userId) continue;
      result.push({
        instance_id: item.instanceId,
        module: item.info.module,
        db_path: item.info.db_path,
        architecture: item.info.architecture,
        platform: item.info.platform,
        connected_at: item.connectedAt.toISOString(),
      });
    }
    return result;
  }

  async executeCode(
    instanceId: string,
    code: string,
    requestId: string,
    timeout: number,
    userId: number,
  ): Promise<ExecuteResultMessage> {
    const target = this.instances.get(instanceId);
    if (!target || target.userId !== userId) {
      throw new KeyError(instanceId);
    }

    const key = this.pendingKey(instanceId, requestId);

    const promise = new Promise<ExecuteResultMessage>((resolve, reject) => {
      this.pending.set(key, { resolve, reject });
    });

    try {
      logger.info("Dispatch execute", { instanceId, requestId });
      target.ws.send(
        JSON.stringify({
          type: WSMessageType.EXECUTE,
          request_id: requestId,
          code,
        }),
      );
    } catch (err) {
      this.pending.delete(key);
      logger.error("Dispatch execute failed", { instanceId, requestId, err });
      throw err;
    }

    // Race with timeout — 正常完成时清理 timer 避免泄漏
    let timerId: ReturnType<typeof setTimeout>;
    const timer = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new TimeoutError(`Execute timed out after ${timeout}s`));
      }, timeout * 1000);
    });

    try {
      return await Promise.race([promise, timer]);
    } finally {
      clearTimeout(timerId!);
      this.pending.delete(key);
    }
  }

  handleResponse(instanceId: string, result: ExecuteResultMessage): boolean {
    const key = this.pendingKey(instanceId, result.request_id);
    const future = this.pending.get(key);
    if (!future) {
      logger.warn("Execute response dropped (no pending future)", {
        instanceId,
        requestId: result.request_id,
      });
      return false;
    }

    future.resolve(result);
    logger.info("Execute response received", {
      instanceId,
      requestId: result.request_id,
      success: result.success,
    });
    return true;
  }
}

/** Error thrown when an instance is not found. */
export class KeyError extends Error {
  constructor(instanceId: string) {
    super(instanceId);
    this.name = "KeyError";
  }
}

/** Error thrown on execute timeout. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/** Error thrown when an instance disconnects during execution. */
export class DisconnectError extends Error {
  constructor(instanceId: string) {
    super(`Instance disconnected: ${instanceId}`);
    this.name = "DisconnectError";
  }
}
