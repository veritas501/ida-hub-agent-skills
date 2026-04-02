// 统一日志模块 — 基于 consola，自动检测 TTY 输出格式
import { createConsola } from "consola";

export function createLogger(name: string) {
  return createConsola({
    defaults: { tag: name },
    fancy: false,
  } as Parameters<typeof createConsola>[0]);
}
