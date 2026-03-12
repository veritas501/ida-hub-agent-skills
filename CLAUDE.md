# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

IDA Chat 分布式架构改造项目，实现多个 IDA Pro 实例的统一管理。Claude Code 通过 HTTP API 与运行在 Windows 上的 Hub Server 交互。

## 架构

```
Windows 主机 (局域网)                    Linux 主机
┌───────────────────────────────────┐   ┌─────────────────┐
│  Hub Server (FastAPI)             │   │  Claude Code    │
│  单端口 :10086                      │◄──►│  (curl/python)  │
│  ├── /        → 前端 SPA          │   └─────────────────┘
│  ├── /api/*   → HTTP API          │
│  ├── /ws      → WebSocket (IDA)   │
│  └── /docs    → API 文档          │
└───────────────────────────────────┘
        ▲ WebSocket
        │
┌───────┴───────┐
│ IDA 实例 1..N │  (手动连接，默认 localhost:10086)
└───────────────┘
```

## 设计文档

| 文档 | 说明 |
|------|------|
| `docs/总体架构需求.md` | 系统架构、通信协议、部署流程 |
| `docs/HUB后端.md` | FastAPI 后端、实例注册表、WebSocket 处理 |
| `docs/HUB前端.md` | Next.js 前端、静态导出、单端口部署 |
| `docs/IDA插件设计.md` | IDA 插件、线程安全执行、db 对象 |
| `docs/skill设计.md` | Claude Code Skill、代理循环模式 |

## HTTP API

| 端点 | 说明 |
|------|------|
| `GET /api/instances` | 列出已连接的 IDA 实例 |
| `POST /api/execute` | 在指定实例执行 Python 代码 |
| `GET /api/config` | 获取 Claude Code 配置（供前端展示） |
| `WS /ws` | IDA 实例 WebSocket 连接 |

## 代理循环模式

```
Claude Code 输出代码 → Hub 转发 → IDA 执行 → 返回结果 → Claude Code 继续
```

Agent 自主决定查询时机，持续执行直到任务完成。

## 代码执行机制

IDA 插件使用 `ida_kernwin.execute_sync()` 确保线程安全：

```
WebSocket 后台线程               主线程
        │                          │
        │ 收到 execute 消息        │
        │                          │
        │ execute_sync() ─────────►│ exec(code, context)
        │                          │ 捕获 stdout
        │◄───── 返回结果 ──────────│
```

执行上下文：`db` (ida-domain), `ida_kernwin`, `idaapi`, `idautils`, `idc`

## API 调用示例

```bash
# 列出实例
curl http://192.168.1.100:10086/api/instances

# 执行代码
curl -X POST http://192.168.1.100:10086/api/execute \
  -H 'Content-Type: application/json' \
  -d '{"instance_id": "xxx", "code": "print(len(db.functions))"}'
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | FastAPI, uvicorn, websockets, pydantic |
| 前端 | Next.js 14 (静态导出), React 18 |
| IDA 插件 | websocket-client, ida-domain |
| 通信 | WebSocket (IDA↔Hub) + HTTP API (Claude↔Hub) |

## 开发命令

```bash
# 启动 Hub Server（单端口）
cd hub && python run.py --host 0.0.0.0 --port 10086

# 构建前端（输出到 hub/web/out/）
cd hub/web && npm run build

# 访问
# http://localhost:10086/       → 前端
# http://localhost:10086/docs   → API 文档
```
