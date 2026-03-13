# IDA Chat 总体架构需求

## 1. 背景与目标

### 1.1 背景

将 IDA Chat 改造为分布式架构，解决以下问题：
- 支持同时管理**多个 IDA 实例**
- **IDA Pro** 运行在 Windows 主机上（可能有多个实例）
- **Claude Code** 运行在 Linux 主机上
- 需要跨平台、跨网络的统一管理方案

### 1.2 目标

- Claude Code 通过 HTTP API 与 Hub Server 交互（不使用 MCP）
- Hub Server 绑定 0.0.0.0，支持局域网直接访问
- 单点管理多个 IDA 实例
- 提供可视化 Web 管理界面

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Windows 主机 (局域网 0.0.0.0)                             │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    IDA Hub Server (FastAPI)                           │  │
│  │                         :10086 单端口                                   │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  FastAPI 统一服务                                                │  │  │
│  │  │                                                                  │  │  │
│  │  │  静态文件托管 (Next.js out/)     HTTP API                        │  │  │
│  │  │  ├── /              → index.html  ├── /api/instances            │  │  │
│  │  │  ├── /instance/xxx  → SPA 路由    ├── /api/execute              │  │  │
│  │  │  ├── /config        → SPA 路由    └── WebSocket /ws             │  │  │
│  │  │  └── /_next/static  → 静态资源                                  │  │  │
│  │  │                                                                  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                       ↑                               │  │
│  │                        InstanceRegistry                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                        ↑                                    │
│            ┌───────────────────────────┼───────────────────────────┐        │
│            │ WebSocket                 │ WebSocket                 │        │
│            ▼                           ▼                           ▼        │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐    │
│  │   IDA 实例 1     │      │   IDA 实例 2     │      │   IDA 实例 N     │    │
│  │  (calc.exe.i64)  │      │  (malware.dll)  │      │  (kernel.exe)   │    │
│  └─────────────────┘      └─────────────────┘      └─────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                   局域网 HTTP
                                   单端口 :10086
                                         │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Linux 主机                                         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Claude Code (Skill)                               │  │
│  │                                                                       │  │
│  │  通过 curl/python 命令调用 Hub API                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 单端口部署优势

| 特性 | 说明 |
|------|------|
| **简化部署** | 只需启动一个 Python 进程 |
| **无跨域问题** | 前后端同源，无需 CORS 配置 |
| **防火墙友好** | 只需开放一个端口 |
| **相对路径** | API 请求使用 `/api/*`，无需配置基础 URL |

## 3. 通信协议

### 3.1 Claude Code ↔ Hub Server

| 协议 | 用途 | 特点 |
|------|------|------|
| HTTP/REST | API 调用 | 简单可靠，curl/python 直接调用 |
| 无需 MCP | 降低复杂度 | Claude Code 通过 Bash 工具执行 curl |

### 3.2 IDA ↔ Hub Server

| 协议 | 用途 | 特点 |
|------|------|------|
| WebSocket | 双向通信 | IDA 主动连接 Hub，保持长连接 |
| JSON | 消息格式 | 请求/响应序列化 |

### 3.3 Hub Frontend ↔ Backend

| 协议 | 用途 |
|------|------|
| HTTP API | 前端调用后端 REST API |
| 相对路径 | 同源访问，无需跨域配置 |

## 4. 核心数据流

### 4.1 Claude Code 执行脚本流程

```
Claude Code          Hub Server              IDA Instance
    │                    │                        │
    │  POST /api/execute │                        │
    │───────────────────►│                        │
    │                    │   WebSocket Request    │
    │                    │───────────────────────►│
    │                    │                        │
    │                    │                        │ Execute Code
    │                    │                        │
    │                    │   WebSocket Response   │
    │                    │◄───────────────────────│
    │  HTTP Response     │                        │
    │◄───────────────────│                        │
    │                    │                        │
```

### 4.2 IDA 实例注册流程

```
IDA Instance          Hub Server
    │                    │
    │  WS Connect /ws    │
    │───────────────────►│
    │                    │
    │  Register Message  │
    │───────────────────►│
    │                    │  Store in Registry
    │                    │
    │  ACK               │
    │◄───────────────────│
    │                    │
```

## 5. 实例标识设计

每个 IDA 实例需要唯一标识符：

```python
{
    "instance_id": "libminkdescriptor_013",  # 文件名 + 3位随机数
    "module": "calc.exe",           # 模块名
    "db_path": "C:\\analyses\\calc.exe.i64",
    "architecture": "x86_64",
    "platform": "windows",
    "connected_at": "2026-03-12T10:30:00Z"
}
```

## 6. 项目结构

```
ida_claw/
├── hub_backend/                  # FastAPI 后端
│   ├── pyproject.toml
│   └── src/ida_chat_hub/
│       ├── main.py               # 应用入口
│       ├── registry.py           # 实例注册表
│       ├── routes.py             # API 路由
│       ├── ws_handler.py         # WebSocket 处理
│       ├── network.py            # 网卡信息
│       └── models.py             # Pydantic 模型
├── hub_frontend/                 # Next.js 前端（静态导出）
│   ├── app/
│   ├── components/
│   ├── out/                      # 构建输出（FastAPI 托管）
│   ├── package.json
│   └── next.config.js
├── ida_plugins/
│   ├── ida_multi_chat_entry.py   # 插件入口
│   └── ida_multi_chat/           # 插件主体代码
└── docs/                         # Design docs
    ├── requirements.md
    ├── hub-backend.md
    ├── hub-frontend.md
    ├── skills.md
    └── ida-plugin.md
```

## 7. 部署流程

### 7.1 构建前端

```bash
cd hub_frontend
npm install
npm run build          # 输出静态文件到 hub_frontend/out/
```

### 7.2 启动服务

```bash
cd hub_backend
uv run ida-chat-hub
```

### 7.3 访问地址

```
http://192.168.1.100:10086/           → 前端管理界面
http://192.168.1.100:10086/api/       → HTTP API
http://192.168.1.100:10086/docs       → API 文档
ws://192.168.1.100:10086/ws           → WebSocket（IDA 连接）
```

## 8. 非功能需求

| 需求 | 说明 |
|------|------|
| 性能 | API 响应 < 100ms（不含脚本执行时间） |
| 可靠性 | WebSocket 断线自动重连 |
| 安全性 | 局域网内使用，暂不做认证 |
| 可扩展 | 支持未来添加认证、权限控制 |
