// Server entry point — 启动 Hono HTTP + WebSocket 服务
// 检测到前端构建产物时自动托管静态文件

import { serveStatic } from "hono/bun";
import { createApp } from "./app.js";
import { websocket } from "./routes/ws.js";
import { createLogger } from "@ida-claw/shared";
import path from "node:path";
import fs from "node:fs";

const logger = createLogger("server");

/**
 * 定位前端构建产物目录。
 * 编译二进制中 import.meta.dirname 指向虚拟路径 (/$bunfs/root)，
 * 因此使用 process.execPath 定位二进制所在目录。
 */
function resolveWebDist(): string | null {
  const execDir = path.dirname(process.execPath);           // 二进制所在目录
  const srcDir = import.meta.dirname;                       // 源码目录 (开发模式)
  const candidates = [
    path.resolve(execDir, "web"),                           // 独立二进制: dist/web/
    path.resolve(srcDir, "web"),                            // 同级 (fallback)
    path.resolve(srcDir, "../web"),                         // bundle 模式: web/
    path.resolve(srcDir, "../../web/dist"),                 // monorepo: apps/api/src → apps/web/dist
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

async function main() {
  const { app, state } = await createApp();
  const { config } = state;

  const webDist = resolveWebDist();
  if (webDist) {
    const indexHtml = fs.readFileSync(path.join(webDist, "index.html"), "utf-8");

    app.use(
      "/*",
      serveStatic({ root: webDist, rewriteRequestPath: (p) => p }),
    );
    // SPA fallback — 未匹配的非 API/WS 路径返回缓存的 index.html
    app.get("*", (c) => {
      const accept = c.req.header("accept") ?? "";
      if (accept.includes("text/html")) {
        return c.html(indexHtml);
      }
      return c.notFound();
    });
  }

  Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
    websocket,
  });

  logger.info(`IDA Chat Hub listening on http://${config.host}:${config.port}`, {
    database: config.db,
    debug: config.debug,
    webDist: webDist ?? "<disabled>",
  });
}

main().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
