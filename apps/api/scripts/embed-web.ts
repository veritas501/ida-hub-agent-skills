/**
 * 构建脚本：将前端 dist 产物内联为 TypeScript 模块。
 * 用于 bundle:bin，使编译后的二进制自包含前端资源。
 */
import fs from "node:fs";
import path from "node:path";
import { globSync } from "node:fs";

const webDir = path.resolve(import.meta.dirname, "../web");
const outFile = path.resolve(import.meta.dirname, "../src/generated/embedded-web.ts");

if (!fs.existsSync(path.join(webDir, "index.html"))) {
  console.error("Error: web/index.html not found. Run `turbo run build` first.");
  process.exit(1);
}

// 收集所有前端文件
const files: Record<string, string> = {};

function walk(dir: string, base: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = "/" + path.relative(base, full);
    if (entry.isDirectory()) {
      walk(full, base);
    } else {
      const buf = fs.readFileSync(full);
      // 用 base64 编码二进制文件，文本文件直接存字符串
      const ext = path.extname(entry.name).toLowerCase();
      const isText = [".html", ".css", ".js", ".json", ".svg", ".map", ".txt"].includes(ext);
      if (isText) {
        files[rel] = buf.toString("utf-8");
      } else {
        files[rel] = `__B64__${buf.toString("base64")}`;
      }
    }
  }
}

walk(webDir, webDir);

// 生成 TypeScript 模块
const entries = Object.entries(files)
  .map(([url, content]) => {
    const escaped = JSON.stringify(content);
    return `  ${JSON.stringify(url)}: ${escaped}`;
  })
  .join(",\n");

const code = `// 自动生成 — 由 scripts/embed-web.ts 在构建时产出
// eslint-disable-next-line
export const embeddedWebAssets: Record<string, string> = {
${entries}
};

/** 资源是否为 base64 编码的二进制 */
export function isBase64(content: string): boolean {
  return content.startsWith("__B64__");
}

/** 解码 base64 资源 */
export function decodeBase64(content: string): Uint8Array {
  return Uint8Array.from(atob(content.slice(7)), c => c.charCodeAt(0));
}
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, code, "utf-8");

const count = Object.keys(files).length;
const totalSize = Object.values(files).reduce((s, c) => s + c.length, 0);
console.log(`Embedded ${count} web assets (${(totalSize / 1024).toFixed(1)} KB raw) → src/generated/embedded-web.ts`);
