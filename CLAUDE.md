# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

IDA Chat 分布式架构改造项目，实现多个 IDA Pro 实例的统一管理。Claude Code 通过 HTTP API 与运行在 Windows 上的 Hub Server 交互。

## 架构

```
Windows 主机                          Linux 主机
┌─────────────────────┐              ┌─────────────────┐
│  Hub Server         │   HTTP API   │  Claude Code    │
│  FastAPI (:8765)    │◄────────────►│  (curl/python)  │
│  Next.js (:3000)    │              └─────────────────┘
└─────────────────────┘
        ▲ WebSocket
        │
┌───────┴───────┐
│ IDA 实例 1..N │
└───────────────┘
```

## 核心组件

| 目录 | 说明 |
|------|------|
| `hub/server/` | FastAPI 后端（实例注册表、API 路由、WebSocket 处理） |
| `hub/web/` | Next.js 前端（Dashboard、Config 页面） |
| `ida_hub_client.py` | IDA 客户端（WebSocket 连接 Hub） |
| `ida_chat_plugin.py` | IDA 插件入口 |

## HTTP API

| 端点 | 说明 |
|------|------|
| `GET /api/instances` | 列出已连接的 IDA 实例 |
| `POST /api/execute` | 在指定实例执行 Python 代码 |
| `GET /api/db-info/{id}` | 获取数据库信息 |
| `GET /api/config` | 获取 Claude Code 配置 |
| `WS /ws` | IDA 实例 WebSocket 连接 |

## 开发命令

```bash
# 启动 Hub Server
cd hub && python run.py --host 0.0.0.0 --port 8765

# 启动前端开发服务器
cd hub/web && npm run dev

# 查看 API 文档
# 浏览器访问 http://localhost:8765/docs
```

## API 调用示例

```bash
# 列出实例
curl http://localhost:8765/api/instances

# 执行代码
curl -X POST http://localhost:8765/api/execute \
  -H 'Content-Type: application/json' \
  -d '{"instance_id": "xxx", "code": "print(len(db.functions))"}'
```

## 技术栈

- **后端**: FastAPI, uvicorn, websockets, pydantic
- **前端**: Next.js 14, React 18
- **通信**: WebSocket（IDA↔Hub）+ HTTP API（Claude↔Hub）
