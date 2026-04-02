# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目愿景

IDA Chat 分布式架构项目：多个 IDA Pro 实例通过 WebSocket 统一接入 Hub，外部 Agent/前端通过 HTTP API 与指定 IDA 实例交互。

## 常用命令

```bash
# 安装依赖
bun install

# 开发（API + 前端分别启动）
bun run dev:api    # Hono 后端 http://0.0.0.0:10086
bun run dev:web    # Vite 前端 http://localhost:5173（代理 /api、/ws → 10086）

# 直接运行源码（开发调试）
bun apps/api/src/server.ts --host 0.0.0.0 --port 10086 --debug

# 构建（Turborepo 按依赖顺序: shared → api + web）
bun run build

# 独立二进制分发（零依赖）
bun run bundle:bin   # 产物: apps/api/dist/ida-hub
```

**当前无测试框架和 lint 工具配置。** 类型安全依赖 TypeScript strict 模式。

## 架构总览

```
IDA Plugin ──WebSocket(/ws)──▶ Hub API (apps/api) ◀──HTTP(/api/*)── Agent / Frontend (apps/web)
                                     │
                              packages/shared（类型、验证、DB、配置、日志）
```

### Monorepo 结构

| 模块 | 语言 | 职责 | 入口 |
|---|---|---|---|
| `apps/api` | TypeScript (Bun) | Hono HTTP + WebSocket 服务 | `src/server.ts` → `src/app.ts` |
| `apps/web` | TypeScript/React | Vite SPA 前端 | `src/main.tsx` |
| `packages/shared` | TypeScript | 共享类型、Zod 验证、Drizzle ORM、CLI 配置、consola 日志 | `src/index.ts` |
| `ida_plugins` | Python | IDA 插件：WebSocket 接入 + 脚本执行 | `ida_multi_chat_entry.py` |
| `skills` | Markdown | Agent 技能文档（`npx skills add` 兼容） | `ida-hub/SKILL.md` |

### 后端关键路径

- `server.ts`：Bun.serve() 启动 + 静态文件托管 + SPA fallback
- `app.ts`：组装中间件/路由、初始化 DB/Registry/网络探测
- `registry/index.ts`：IDA 实例注册、execute 请求派发与超时、用户隔离
- `ws/handler.ts`：WebSocket 连接状态机（auth → register → execute_result），用 `WeakMap<WSContext, ConnState>` 管理
- `middleware/auth.ts`：Bearer token 认证

### HTTP API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册用户 |
| POST | `/api/auth/login` | 登录获取 token |
| GET | `/api/instances` | 列出当前用户的 IDA 实例 |
| POST | `/api/execute` | 向指定实例执行代码 |
| GET | `/api/network/interfaces` | 列出服务端网络接口 |
| GET | `/api/agent_config` | 获取 Agent 配置 Markdown |
| GET | `/api/ida_config` | 获取 IDA 插件配置字符串 |
| GET | `/healthz` | 健康检查 |

### WebSocket 协议

连接: `ws://<host>:10086/ws?token=<token>`

消息流: `register` → `register_ack` → (`execute` ↔ `execute_result`)

关闭码: `4000` REPLACED / `4001` REGISTER_REQUIRED / `4002` REGISTER_TIMEOUT / `4003` AUTH_FAILED

## 配置设计

**不使用环境变量，所有配置通过 CLI 参数传入**（`node:util parseArgs` + Zod 验证）：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--host` | `0.0.0.0` | 监听地址 |
| `--port` | `10086` | 监听端口 |
| `--timeout` | `30` | 执行超时秒数 |
| `--db` | `~/.ida_hub/hub_users.db` | SQLite 数据库路径 |
| `--debug` | `false` | 启用调试日志 |

## 编码规范

- TypeScript：严格模式、ESM、类型注解
- `packages/shared` 用 `tsc` 构建，re-export **必须**使用 `.js` 后缀
- `postcss.config` 和 `tailwind.config` **必须**使用 `.cjs` 扩展名（`"type": "module"`）
- `bun:sqlite` 的 pragma 设置用 `sqlite.exec("PRAGMA ...")` 而非 `.pragma()`
- Drizzle ORM 使用 `drizzle-orm/bun-sqlite` 驱动
- 前端使用 `@/` 路径别名（Vite resolve.alias → `src/`）
- React 组件职责单一，API 统一收口到 `lib/api.ts`
- Python（插件）：类型注解、清晰模块边界
- 代码注释语言与现有代码库保持一致（中文）

## AI 使用指引

- 先读后改，优先定位模块级 `CLAUDE.md` 再进入源码
- 涉及接口联调时，按链路顺序排查：Frontend → Hub API → WS → Plugin
- 对大输出任务优先摘要化，避免在 IDA 端回传全集（输出预算 200k 字符）
