# IDA Chat 分布式架构总览（FastAPI + Next.js）

## Context（背景）

将 IDA Chat 改造为分布式架构，支持**多个 IDA 实例**的统一管理：
- **IDA Pro** 运行在 Windows 主机上（可能有多个实例）
- **Claude Code** 运行在 Linux 主机上
- **Hub Server** 使用 FastAPI + Next.js，绑定 0.0.0.0，局域网直接访问
- **Claude Code** 通过 curl/python 命令与 HTTP API 交互（不使用 MCP）

---

## 目标架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Windows 主机 (局域网 0.0.0.0)                             │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    IDA Hub Server (FastAPI + Next.js)                 │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────┐    ┌─────────────────────────────────┐  │  │
│  │  │  Next.js Frontend       │    │  FastAPI Backend                │  │  │
│  │  │  (静态导出后由后端托管)   │    │  (HTTP API + WebSocket)         │  │  │
│  │  │  same origin            │    │  :10086                          │  │  │
│  │  │                         │    │                                 │  │  │
│  │  │  • IDA 实例列表         │    │  • /api/instances               │  │  │
│  │  │  • 连接状态             │    │  • /api/execute                 │  │  │
│  │  │  • 配置复制             │    │  • /api/config                  │  │  │
│  │  │  • 日志查看             │    │  • WebSocket /ws                │  │  │
│  │  └─────────────────────────┘    └─────────────────────────────────┘  │  │
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
                                         │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Linux 主机                                         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Claude Code (Skill)                               │  │
│  │                                                                       │  │
│  │  通过 curl/python 命令调用 Hub API:                                    │  │
│  │                                                                       │  │
│  │  # 列出实例                                                           │  │
│  │  curl http://192.168.x.x:10086/api/instances                           │  │
│  │                                                                       │  │
│  │  # 执行脚本                                                           │  │
│  │  curl -X POST http://192.168.x.x:10086/api/execute \                  │  │
│  │    -H "Content-Type: application/json" \                              │  │
│  │    -d '{"instance_id": "xxx", "code": "..."}'                        │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## HTTP API 设计（FastAPI）

### 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/instances` | 列出所有已连接的 IDA 实例 |
| `POST` | `/api/execute` | 在指定实例执行 Python 代码 |
| `GET` | `/api/network/interfaces` | 获取网卡 IPv4 列表与默认 IP |
| `GET` | `/api/config` | 获取 Claude Code 配置（可复制） |
| `WS` | `/ws` | IDA 实例 WebSocket 连接 |

### API Schema

```python
# GET /api/instances
[
  {
    "instance_id": "libminkdescriptor_013",
    "module": "calc.exe",
    "db_path": "C:\\analyses\\calc.exe.i64",
    "architecture": "x86_64",
    "platform": "windows",
    "connected_at": "2026-03-12T10:30:00Z"
  }
]

# POST /api/execute
# Request:
{
  "instance_id": "a1b2c3d4",
  "code": "for func in db.functions:\n    print(func.start_ea)"
}
# Response:
{
  "success": true,
  "output": "0x140001000\n0x140001100\n...",
  "error": null,
  "request_id": "6b1a53be4e584946a1d9f765e07a9f3f"
}

# GET /api/network/interfaces
{
  "interfaces": [
    {"name": "eth0", "ipv4": "192.168.1.100", "is_loopback": false},
    {"name": "lo", "ipv4": "127.0.0.1", "is_loopback": true}
  ],
  "default_ip": "192.168.1.100"
}

# GET /api/config
{
  "result": "# List instances\ncurl http://192.168.1.100:10086/api/instances\n...",
  "selected_ip": "192.168.1.100",
  "port": 10086
}
```

---

## 前端设计（Next.js）

### 页面

| 页面 | 路由 | 功能 |
|------|------|------|
| Dashboard | `/` | 实例列表、状态概览 |
| Instance Detail | `/instance/[id]` | 单个实例详情、脚本执行 |
| Config | `/config` | Claude Code 配置复制 |

### Dashboard 页面

```
┌─────────────────────────────────────────────────────────────────┐
│  IDA Hub Server                              [Refresh] [Config] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Connected Instances (2)                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🟢 calc.exe.i64                                           │ │
│  │    ID: a1b2c3d4 | x86_64 | 150 functions                  │ │
│  │    Path: C:\analyses\calc.exe.i64                         │ │
│  │                                          [Execute] [Info] │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🟢 malware.dll                                            │ │
│  │    ID: e5f6g7h8 | x86 | 89 functions                      │ │
│  │    Path: C:\analyses\malware.dll.i64                      │ │
│  │                                          [Execute] [Info] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Server Info                                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Hub URL: http://192.168.1.100:10086                        │ │
│  │ Uptime: 2h 30m                                            │ │
│  │ Requests: 156                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Config 页面（配置复制）

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code Configuration                         [Copy All]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Quick Commands (click to copy)                                 │
│                                                                 │
│  List instances:                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ curl http://192.168.1.100:10086/api/instances              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Execute code (replace INSTANCE_ID):                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ curl -X POST http://192.168.1.100:10086/api/execute \      │ │
│  │   -H 'Content-Type: application/json' \                   │ │
│  │   -d '{"instance_id": "INSTANCE_ID", "code": "CODE"}'     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Python Helper (save as ida_client.py):                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ import requests                                            │ │
│  │ HUB_URL = "http://192.168.1.100:10086"                      │ │
│  │                                                            │ │
│  │ def list_instances():                                      │ │
│  │     return requests.get(f"{HUB_URL}/api/instances").json()│ │
│  │                                                            │ │
│  │ def execute(instance_id, code):                            │ │
│  │     return requests.post(f"{HUB_URL}/api/execute",        │ │
│  │         json={"instance_id": instance_id, "code": code}   │ │
│  │     ).json()                                               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Claude Code Skill 设计

**文件: `~/.claude/skills/ida/skill.md`**

```markdown
# IDA Hub Skill

通过 HTTP API 与远程 IDA Hub Server 交互。

## 使用方式

/ida <command> [args]

## 命令

- `/ida list` - 列出所有已连接的 IDA 实例
- `/ida exec <instance_id> <code>` - 执行 Python 代码

## 示例

/ida list
/ida exec a1b2c3d4 "print(len(db.functions))"
/ida exec a1b2c3d4 "for func in db.functions:\n    print(db.functions.get_name(func))"
```

**Skill 实现** (通过 Bash 工具调用):

```python
# skill 执行逻辑
HUB_URL = "http://192.168.1.100:10086"  # 从环境变量或配置读取

# /ida list
curl -s http://$HUB_URL/api/instances | jq .

# /ida exec <id> <code>
curl -s -X POST http://$HUB_URL/api/execute \
  -H 'Content-Type: application/json' \
  -d "{\"instance_id\": \"$INSTANCE_ID\", \"code\": \"$CODE\"}"
```

## 项目结构

```
ida_claw/
├── hub_backend/                  # Hub 后端
│   ├── pyproject.toml
│   └── src/ida_chat_hub/
├── hub_frontend/                 # Hub 前端
│   ├── app/
│   ├── components/
│   └── package.json
├── ida_plugins/
│   ├── ida_multi_chat_entry.py
│   └── ida_multi_chat/
└── ...
```

---

## 启动流程

```bash
# 1. 启动 Hub Server (Windows)
cd hub_backend
uv run ida-chat-hub

# 2. IDA 连接
#    在 IDA 插件中配置 Hub 地址，点击连接

# 3. Claude Code 使用
/ida list
/ida exec <id> "print(db.module)"
```

---

## 验证步骤

1. **启动 Hub Server**
   ```bash
   cd hub_backend && uv run ida-chat-hub
   # 访问 http://127.0.0.1:10086/docs 查看 API 文档
   ```

2. **IDA 连接测试**
   - 打开 IDA，加载插件
   - 点击 "Connect to Hub"
   - 检查前端页面是否显示实例

3. **API 测试**
   ```bash
   # 列出实例
   curl http://127.0.0.1:10086/api/instances

   # 执行脚本
   curl -X POST http://127.0.0.1:10086/api/execute \
     -H 'Content-Type: application/json' \
     -d '{"instance_id": "xxx", "code": "print(len(db.functions))"}'
   ```

4. **前端测试**
   - 访问 http://127.0.0.1:10086
   - 检查实例列表显示
   - 测试配置复制功能

---

## 依赖

### Python (FastAPI)
```toml
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "websockets>=12.0",
    "pydantic>=2.0.0",
]
```

### Node.js (Next.js)
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```
