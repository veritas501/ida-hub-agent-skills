# HUB 后端设计文档

## 1. 概述

基于 FastAPI 的 HTTP API 服务，负责管理 IDA 实例连接和脚本执行。

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

## 4. 数据模型 (models.py)

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class InstanceInfo(BaseModel):
    """IDA 实例信息（列表项）"""
    instance_id: str
    module: str
    db_path: str
    architecture: str
    connected_at: datetime

class ExecuteRequest(BaseModel):
    """脚本执行请求"""
    instance_id: str
    code: str

class ExecuteResponse(BaseModel):
    """脚本执行响应"""
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None

class ConfigResponse(BaseModel):
    """配置响应"""
    hub_url: str
    curl_examples: dict[str, str]
    python_helper: str

class InstancesResponse(BaseModel):
    """实例列表响应"""
    instances: list[InstanceInfo]

class DbInfoResponse(BaseModel):
    """数据库详细信息响应"""
    instance_id: str
    module: str
    path: str
    architecture: str
    bitness: int
    base_address: str
    functions_count: int
    strings_count: int
    segments: list[str]
```

## 5. 实例注册表 (registry.py)

```python
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
import asyncio

@dataclass
class IDAInstance:
    """IDA 实例连接状态"""
    instance_id: str
    websocket: object  # WebSocket 连接
    info: dict         # 实例元信息
    connected_at: datetime = field(default_factory=datetime.now)
    pending_requests: dict = field(default_factory=dict)  # 请求ID -> Future

class InstanceRegistry:
    """IDA 实例注册表（单例）"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._instances: dict[str, IDAInstance] = {}
            cls._instance._lock = asyncio.Lock()
        return cls._instance

    async def register(self, instance_id: str, websocket, info: dict) -> None:
        """注册新实例"""
        async with self._lock:
            self._instances[instance_id] = IDAInstance(
                instance_id=instance_id,
                websocket=websocket,
                info=info
            )

    async def unregister(self, instance_id: str) -> None:
        """注销实例"""
        async with self._lock:
            self._instances.pop(instance_id, None)

    async def get(self, instance_id: str) -> IDAInstance | None:
        """获取实例"""
        return self._instances.get(instance_id)

    async def list_all(self) -> list[IDAInstance]:
        """列出所有实例"""
        return list(self._instances.values())

    async def execute_code(self, instance_id: str, code: str, request_id: str) -> dict:
        """向实例发送执行请求并等待结果"""
        instance = await self.get(instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        # 创建 Future 等待响应
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        instance.pending_requests[request_id] = future

        # 发送请求
        await instance.websocket.send_json({
            "type": "execute",
            "request_id": request_id,
            "code": code
        })

        # 等待响应（超时 60s）
        try:
            return await asyncio.wait_for(future, timeout=60.0)
        except asyncio.TimeoutError:
            instance.pending_requests.pop(request_id, None)
            raise TimeoutError("Execute timeout")

    async def handle_response(self, instance_id: str, request_id: str, result: dict) -> None:
        """处理实例返回的响应"""
        instance = await self.get(instance_id)
        if instance and request_id in instance.pending_requests:
            instance.pending_requests[request_id].set_result(result)
            instance.pending_requests.pop(request_id)
```

## 6. WebSocket 处理 (ws_handler.py)

```python
import asyncio
import json
import uuid
from fastapi import WebSocket, WebSocketDisconnect
from .registry import InstanceRegistry

class WebSocketHandler:
    """WebSocket 连接处理器"""

    def __init__(self):
        self.registry = InstanceRegistry()

    async def handle_connection(self, websocket: WebSocket):
        """处理 WebSocket 连接生命周期"""
        await websocket.accept()

        instance_id = None

        try:
            # 等待注册消息
            register_msg = await asyncio.wait_for(
                websocket.receive_json(),
                timeout=10.0
            )

            if register_msg.get("type") != "register":
                await websocket.close(code=4001, reason="First message must be register")
                return

            instance_id = register_msg["instance_id"]
            info = register_msg.get("info", {})

            # 注册实例
            await self.registry.register(instance_id, websocket, info)

            # 发送确认
            await websocket.send_json({
                "type": "register_ack",
                "instance_id": instance_id
            })

            # 消息循环
            while True:
                message = await websocket.receive_json()
                await self._handle_message(instance_id, message)

        except asyncio.TimeoutError:
            await websocket.close(code=4002, reason="Register timeout")
        except WebSocketDisconnect:
            pass
        finally:
            if instance_id:
                await self.registry.unregister(instance_id)

    async def _handle_message(self, instance_id: str, message: dict):
        """处理来自 IDA 实例的消息"""
        msg_type = message.get("type")

        if msg_type == "execute_result":
            # 脚本执行结果
            request_id = message.get("request_id")
            result = {
                "success": message.get("success", False),
                "output": message.get("output"),
                "error": message.get("error")
            }
            await self.registry.handle_response(instance_id, request_id, result)

        elif msg_type == "heartbeat":
            # 心跳响应
            pass

        elif msg_type == "event":
            # 事件通知（如数据库变化）
            await self._handle_event(instance_id, message)

    async def _handle_event(self, instance_id: str, message: dict):
        """处理事件通知"""
        # 预留：可推送给前端或其他订阅者
        pass
```

## 7. HTTP API 路由 (routes.py)

```python
import uuid
from fastapi import APIRouter, HTTPException
from .models import (
    ExecuteRequest, ExecuteResponse, ConfigResponse,
    InstancesResponse, DbInfoResponse, InstanceInfo
)
from .registry import InstanceRegistry

router = APIRouter(prefix="/api")
registry = InstanceRegistry()

@router.get("/instances", response_model=InstancesResponse)
async def list_instances():
    """列出所有已连接的 IDA 实例"""
    instances = await registry.list_all()
    return InstancesResponse(
        instances=[
            InstanceInfo(
                instance_id=inst.instance_id,
                module=inst.info.get("module", "unknown"),
                db_path=inst.info.get("db_path", ""),
                architecture=inst.info.get("architecture", "unknown"),
                connected_at=inst.connected_at
            )
            for inst in instances
        ]
    )

@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(request: ExecuteRequest):
    """在指定实例执行 Python 代码"""
    request_id = str(uuid.uuid4())[:8]

    try:
        result = await registry.execute_code(
            request.instance_id,
            request.code,
            request_id
        )
        return ExecuteResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))

@router.get("/db-info/{instance_id}", response_model=DbInfoResponse)
async def get_db_info(instance_id: str):
    """获取数据库信息"""
    instance = await registry.get(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    info = instance.info
    return DbInfoResponse(
        instance_id=instance_id,
        module=info.get("module", "unknown"),
        path=info.get("db_path", ""),
        architecture=info.get("architecture", "unknown"),
        bitness=info.get("bitness", 64),
        base_address=info.get("base_address", "0x0"),
        functions_count=info.get("functions_count", 0),
        strings_count=info.get("strings_count", 0),
        segments=info.get("segments", [])
    )

@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """获取 Claude Code 配置"""
    from .config import settings

    hub_url = f"http://{settings.host}:{settings.port}"

    return ConfigResponse(
        hub_url=hub_url,
        curl_examples={
            "list_instances": f"curl {hub_url}/api/instances",
            "execute": f"curl -X POST {hub_url}/api/execute -H 'Content-Type: application/json' -d '{{\"instance_id\": \"INSTANCE_ID\", \"code\": \"print(len(db.functions))\"}}'"
        },
        python_helper=f'''import requests
HUB_URL = "{hub_url}"

def list_instances():
    return requests.get(f"{{HUB_URL}}/api/instances").json()

def execute(instance_id, code):
    return requests.post(f"{{HUB_URL}}/api/execute",
        json={{"instance_id": instance_id, "code": code}}
    ).json()
'''
    )
```

## 8. 应用入口 (main.py)

```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .routes import router
from .ws_handler import WebSocketHandler
from .config import settings

app = FastAPI(
    title="IDA Hub Server",
    description="IDA Pro 实例管理服务",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 局域网使用，暂不限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(router)

# WebSocket 端点
ws_handler = WebSocketHandler()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """IDA 实例 WebSocket 连接端点"""
    await ws_handler.handle_connection(websocket)

# 健康检查
@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "hub.server.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
```

## 9. 配置管理 (config.py)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """应用配置"""
    host: str = "0.0.0.0"
    port: int = 8765
    debug: bool = False

    class Config:
        env_prefix = "IDA_HUB_"

settings = Settings()
```

## 10. 启动脚本 (run.py)

```python
#!/usr/bin/env python3
import argparse
import uvicorn

def main():
    parser = argparse.ArgumentParser(description="IDA Hub Server")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址")
    parser.add_argument("--port", type=int, default=8765, help="监听端口")
    parser.add_argument("--reload", action="store_true", help="开发模式热重载")
    args = parser.parse_args()

    uvicorn.run(
        "hub.server.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload
    )

if __name__ == "__main__":
    main()
```

## 11. WebSocket 消息协议

### 11.1 IDA → Hub 消息

| 类型 | 说明 | 结构 |
|------|------|------|
| `register` | 注册实例 | `{"type": "register", "instance_id": "xxx", "info": {...}}` |
| `execute_result` | 执行结果 | `{"type": "execute_result", "request_id": "xxx", "success": true, "output": "..."}` |
| `heartbeat` | 心跳 | `{"type": "heartbeat"}` |
| `event` | 事件通知 | `{"type": "event", "event": "db_changed", "data": {...}}` |

### 11.2 Hub → IDA 消息

| 类型 | 说明 | 结构 |
|------|------|------|
| `register_ack` | 注册确认 | `{"type": "register_ack", "instance_id": "xxx"}` |
| `execute` | 执行请求 | `{"type": "execute", "request_id": "xxx", "code": "..."}` |
| `heartbeat` | 心跳 | `{"type": "heartbeat"}` |

## 12. 错误处理

| 错误码 | 说明 |
|--------|------|
| 4001 | 首条消息必须是 register |
| 4002 | 注册超时 |
| 404 | 实例不存在 |
| 504 | 执行超时 |

## 13. 静态文件服务（托管前端）

FastAPI 托管 Next.js 编译后的静态文件，实现单端口部署。

### 13.1 修改 main.py

```python
from pathlib import Path
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .routes import router
from .ws_handler import WebSocketHandler
from .config import settings

app = FastAPI(
    title="IDA Hub Server",
    description="IDA Pro 实例管理服务",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(router)

# WebSocket 端点
ws_handler = WebSocketHandler()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """IDA 实例 WebSocket 连接端点"""
    await ws_handler.handle_connection(websocket)

# 健康检查
@app.get("/health")
async def health():
    return {"status": "ok"}

# ===== 静态文件服务（托管 Next.js 前端）=====

# 前端静态文件目录
STATIC_DIR = Path(__file__).parent.parent / "web" / "out"

if STATIC_DIR.exists():
    # 挂载静态资源目录 (_next/static, images 等)
    app.mount("/_next", StaticFiles(directory=STATIC_DIR / "_next"), name="next-static")

    # 其他静态文件
    for static_path in ["images", "fonts", "favicon.ico"]:
        full_path = STATIC_DIR / static_path
        if full_path.exists():
            if full_path.is_file():
                # 单文件处理
                pass
            else:
                app.mount(f"/{static_path}", StaticFiles(directory=full_path), name=static_path)

    # SPA 路由回退 - 所有非 API 路由返回 index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """处理前端 SPA 路由"""
        # 跳过 API 和 WebSocket 路径
        if full_path.startswith(("api/", "ws", "health", "docs", "openapi")):
            return None

        # 尝试返回精确匹配的静态文件
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        # SPA 回退：返回 index.html
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)

        return {"error": "Frontend not built"}
```

### 13.2 路由优先级说明

```
请求路径                    → 处理方式
─────────────────────────────────────────
/api/*                      → API 路由（优先）
/ws                         → WebSocket 端点
/health                     → 健康检查
/_next/static/*             → Next.js 静态资源
/images/*, /fonts/*         → 其他静态资源
/instance/xxx               → SPA 路由 → index.html
/config                     → SPA 路由 → index.html
/                           → index.html
```

## 14. 依赖配置 (pyproject.toml)

```toml
[project]
name = "ida-hub-server"
version = "1.0.0"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "websockets>=12.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

## 15. 构建与部署

### 15.1 构建流程

```bash
# 1. 构建前端（生成静态文件到 hub/web/out/）
cd hub/web
npm install
npm run build

# 2. 启动后端（自动加载前端静态文件）
cd ../
python run.py --host 0.0.0.0 --port 8765
```

### 15.2 单端口访问

```
http://192.168.1.100:8765/
├── /                    → 前端 Dashboard 页面
├── /instance/xxx        → 前端实例详情页
├── /config              → 前端配置页
├── /api/instances       → API: 列出实例
├── /api/execute         → API: 执行代码
├── /api/db-info/xxx     → API: 数据库信息
├── /ws                  → WebSocket 连接
└── /docs                → API 文档
```
