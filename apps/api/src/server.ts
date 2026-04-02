// Server entry point — 启动 Hono HTTP + WebSocket 服务
// 优先从文件系统托管前端静态文件，fallback 到编译时内嵌的资源

import { serveStatic } from "hono/bun";
import { createApp } from "./app.js";
import { websocket } from "./routes/ws.js";
import { createLogger } from "@ida-claw/shared";
import path from "node:path";
import fs from "node:fs";
import { embeddedWebAssets, isBase64, decodeBase64 } from "./generated/embedded-web.js";

const logger = createLogger("server");

/** MIME 类型映射 */
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

/**
 * 定位前端构建产物目录。
 * 编译二进制中 import.meta.dirname 指向虚拟路径 (/$bunfs/root)，
 * 因此使用 process.execPath 定位二进制所在目录。
 */
function resolveWebDist(): string | null {
  const execDir = path.dirname(process.execPath);           // 二进制所在目录
  const srcDir = import.meta.dirname;                       // 源码目录 (开发模式)
  const candidates = [
    path.resolve(execDir, "web"),                           // 独立二进制: execDir/web/
    path.resolve(srcDir, "web"),                            // bundle 模式: web/
    path.resolve(srcDir, "../web"),                         // bundle 模式 fallback
    path.resolve(srcDir, "../../web/dist"),                 // monorepo: apps/api/src → apps/web/dist
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

/** 是否有内嵌的前端资源 */
const hasEmbeddedAssets = Object.keys(embeddedWebAssets).length > 0;

/** 从内嵌资源中提供文件 */
function serveEmbedded(c: any): Response | null {
  const urlPath = new URL(c.req.url).pathname;
  const content = embeddedWebAssets[urlPath];
  if (content === undefined) return null;

  const ext = path.extname(urlPath).toLowerCase();
  const mimeType = MIME[ext] ?? "application/octet-stream";

  if (isBase64(content)) {
    return new Response(decodeBase64(content), {
      headers: { "Content-Type": mimeType },
    });
  }
  return new Response(content, {
    headers: { "Content-Type": mimeType },
  });
}

async function main() {
  const { app, state } = await createApp();
  const { config } = state;

  const webDist = resolveWebDist();
  const indexHtml = webDist
    ? fs.readFileSync(path.join(webDist, "index.html"), "utf-8")
    : embeddedWebAssets["/index.html"] ?? null;

  if (webDist) {
    // 文件系统模式：优先使用 serveStatic（高性能）
    app.use("/*", serveStatic({ root: webDist, rewriteRequestPath: (p) => p }));
    // SPA fallback — serveStatic 未命中的 HTML 请求返回 index.html
    app.get("*", (c) => {
      const accept = c.req.header("accept") ?? "";
      if (accept.includes("text/html") && indexHtml) {
        return c.html(indexHtml);
      }
      return c.notFound();
    });
  } else if (hasEmbeddedAssets) {
    // 内嵌模式：从编译时嵌入的资源中提供，未匹配的 HTML 请求返回 index.html
    app.get("*", (c) => {
      const urlPath = new URL(c.req.url).pathname;
      // 1. 尝试匹配内嵌的静态资源
      const content = embeddedWebAssets[urlPath];
      if (content !== undefined) {
        return serveEmbedded(c)!;
      }
      // 2. SPA fallback
      const accept = c.req.header("accept") ?? "";
      if (accept.includes("text/html") && indexHtml) {
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

  const mode = webDist ? "filesystem" : hasEmbeddedAssets ? "embedded" : "disabled";
  logger.info(`IDA Chat Hub listening on http://${config.host}:${config.port}`, {
    database: config.db,
    debug: config.debug,
    webDist: webDist ?? `<${mode}>`,
  });
}

main().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
