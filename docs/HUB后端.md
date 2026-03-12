# HUB 后端设计文档

## 1. 概述

基于 FastAPI 的 HTTP API 服务，负责管理 IDA 实例连接和脚本执行。同时托管 Next.js 编译后的静态文件，实现单端口部署。

## 2. 技术选型

| 组件 | 版本 | 说明 |
|------|------|------|
| FastAPI | >=0.109.0 | Web 框架 |
| uvicorn | >=0.27.0 | ASGI 服务器 |
| websockets | >=12.0 | WebSocket 支持 |
| pydantic | >=2.0.0 | 数据验证 |

## 3. 文件结构

```
hub/server/
├── __init__.py
├── main.py           # FastAPI 应用入口
├── config.py         # 配置管理
├── registry.py       # IDA 实例注册表
├── routes.py         # HTTP API 路由
├── ws_handler.py     # WebSocket 处理器
└── models.py         # Pydantic 数据模型
```

## 4. 核心模块

### 4.1 实例注册表 (registry.py)

单例模式，管理所有已连接的 IDA 实例。

| 方法 | 说明 |
|------|------|
| `register(instance_id, websocket, info)` | 注册新实例 |
| `unregister(instance_id)` | 注销实例 |
| `get(instance_id)` | 获取实例 |
| `list_all()` | 列出所有实例 |
| `execute_code(instance_id, code, request_id)` | 发送执行请求并等待结果 |
| `handle_response(instance_id, request_id, result)` | 处理执行结果 |

### 4.2 WebSocket 处理器 (ws_handler.py)

处理 IDA 实例的 WebSocket 连接生命周期。

| 步骤 | 说明 |
|------|------|
| 1. 接受连接 | `await websocket.accept()` |
| 2. 等待注册 | 10 秒内必须收到 `register` 消息 |
| 3. 存储实例 | 调用 `registry.register()` |
| 4. 发送确认 | 返回 `register_ack` |
| 5. 消息循环 | 处理 `execute_result` 等消息 |

### 4.3 HTTP API 路由 (routes.py)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/instances` | 列出所有实例 |
| POST | `/api/execute` | 执行代码 |
| GET | `/api/config` | 获取配置（供 Claude Code 使用） |

### 4.4 静态文件服务 (main.py)

FastAPI 托管 Next.js 编译输出：

| 路径 | 处理 |
|------|------|
| `/_next/*` | Next.js 静态资源 |
| `/api/*` | API 路由 |
| `/ws` | WebSocket 端点 |
| `/*` | SPA 回退到 index.html |

## 5. 数据模型 (models.py)

### 5.1 实例信息

```python
class InstanceInfo(BaseModel):
    instance_id: str
    module: str          # 模块名
    db_path: str         # 数据库路径
    architecture: str    # 架构
    connected_at: datetime
```

### 5.2 请求/响应

```python
class ExecuteRequest(BaseModel):
    instance_id: str
    code: str

class ExecuteResponse(BaseModel):
    success: bool
    output: str | None
    error: str | None

class ConfigResponse(BaseModel):
    hub_url: str
    curl_examples: dict[str, str]
    python_helper: str
```

## 6. WebSocket 消息协议

### 6.1 IDA → Hub

| 类型 | 说明 | 结构 |
|------|------|------|
| `register` | 注册实例 | `{type, instance_id, info}` |
| `execute_result` | 执行结果 | `{type, request_id, success, output, error}` |

### 6.2 Hub → IDA

| 类型 | 说明 | 结构 |
|------|------|------|
| `register_ack` | 注册确认 | `{type, instance_id}` |
| `execute` | 执行请求 | `{type, request_id, code}` |

## 7. 错误处理

| 错误码 | 说明 |
|--------|------|
| 4001 | 首条消息必须是 register |
| 4002 | 注册超时 |
| 404 | 实例不存在 |
| 504 | 执行超时 |

## 8. 配置 (config.py)

```python
class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 10086
    debug: bool = False

    class Config:
        env_prefix = "IDA_HUB_"
```

## 9. 部署

```bash
# 1. 构建前端
cd hub/web && npm run build

# 2. 启动服务（单端口）
cd hub && python run.py --host 0.0.0.0 --port 10086

# 3. 访问
# http://192.168.1.100:10086/        → 前端
# http://192.168.1.100:10086/api/    → API
# http://192.168.1.100:10086/docs    → API 文档
```

## 10. 依赖 (pyproject.toml)

```toml
[project]
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "websockets>=12.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
]
```
