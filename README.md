# ida_claw

面向 IDA Pro 的分布式执行与管理方案：多个 IDA 实例连接到 Hub，外部 Agent 通过 HTTP API 将 Python 代码下发到指定实例执行。

## 核心能力

- 多实例管理：统一接入多个 IDA Pro 实例
- 远程执行：通过 `/api/execute` 在目标 IDA 实例执行代码
- 单端口服务：Hub 后端托管 API、WebSocket、前端静态页面（默认 `10086`）
- 交互闭环：`Agent -> Hub -> IDA -> Hub -> Agent`

## 架构概览

- IDA Plugin <-> Hub：WebSocket（`/ws`）
- Frontend <-> Hub：HTTP（`/api/*`）
- Agent（Codex/Claude Code）<-> Hub：HTTP（`/api/instances`、`/api/execute`、`/api/config`）

默认建议：

- Hub 监听：`0.0.0.0:10086`
- 插件默认连接：`127.0.0.1:10086`（避免 `localhost` 在部分环境解析异常）

## 仓库结构

```text
ida_claw/
├── ida_plugins/             # IDA 插件（当前重点）
│   ├── ida_multi_chat_entry.py
│   ├── requirements.txt
│   └── ida_multi_chat/
│       ├── plugin.py
│       ├── hub_client.py
│       ├── core.py
│       └── config_persistence.py
├── hub_backend/             # FastAPI Hub 后端
│   ├── pyproject.toml
│   ├── src/ida_chat_hub/
│   └── tests/
├── hub_frontend/            # Next.js 前端
├── skills/                  # Agent 技能定义
├── 设计文档/                # 设计文档
├── ref/                     # 参考实现/API 资料
├── HANDOFF.md               # 阶段交接说明
└── CLAUDE.md                # Agent 协作约束（AGENTS.md 软链指向）
```

## 快速启动

### 1) 启动 Hub 后端

```bash
cd hub_backend
uv sync --group dev
uv run ida-chat-hub
```

启动后可访问：

- `http://127.0.0.1:10086/`（若存在 `hub_frontend/out` 将返回前端，否则返回服务信息）
- `http://127.0.0.1:10086/docs`
- `http://127.0.0.1:10086/healthz`

### 2) 构建/运行前端（可选）

开发模式：

```bash
cd hub_frontend
npm install
npm run dev
```

构建静态站点（供 Hub 托管）：

```bash
cd hub_frontend
npm run build
```

构建产物位于 `hub_frontend/out`，Hub 默认会自动尝试托管该目录。

### 3) 安装并启用 IDA 插件

将以下内容放入 IDA 插件目录：

- `ida_plugins/ida_multi_chat_entry.py`
- `ida_plugins/ida_multi_chat/`

在 IDA Python 环境安装依赖：

```bash
pip install -r ida_plugins/requirements.txt
```

重启 IDA 后，菜单路径：

- `Edit -> IDA Multi Chat -> Connect`
- `Edit -> IDA Multi Chat -> Disconnect`
- `Edit -> IDA Multi Chat -> Settings`

## API 快速示例

列出实例：

```bash
curl -s "http://127.0.0.1:10086/api/instances"
```

执行代码：

```bash
curl -s -X POST "http://127.0.0.1:10086/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id":"<INSTANCE_ID>","code":"print(42)"}'
```

获取配置文案：

```bash
curl -s "http://127.0.0.1:10086/api/config"
```

## 插件执行上下文

Hub 下发的 Python 代码在 IDA 进程中执行，常用变量：

- `db`（ida-domain Database）
- `idaapi`
- `idautils`
- `idc`
- `ida_kernwin`

说明：涉及 IDA API/ida-domain 的采集优先在主线程执行（插件通过 `execute_sync` 调度）。

## 环境变量（Hub）

- `IDA_HUB_HOST`（默认 `0.0.0.0`）
- `IDA_HUB_PORT`（默认 `10086`）
- `IDA_HUB_DEBUG`（默认 `false`）
- `IDA_HUB_EXECUTE_TIMEOUT`（默认 `30.0` 秒）
- `IDA_HUB_WEB_ROOT`（可选，覆盖默认静态目录）
- `IDA_HUB_CORS_ORIGINS`（逗号分隔）

## 当前状态

- IDA 插件首版已实现并可联通 Hub 协议
- Hub 后端/前端骨架已落地，可用于实例管理与代码执行
- 详细阶段信息见 `HANDOFF.md`

## 常见排查

- `404 Instance not found`：先调用 `/api/instances` 确认 `instance_id`
- `504 Execute timed out`：缩短脚本执行时间或提高 `IDA_HUB_EXECUTE_TIMEOUT`
- IDA 无菜单项：检查插件路径与依赖安装是否完整
- 页面为空：确认是否已构建 `hub_frontend/out`

## 关键文档

- `设计文档/总体架构需求.md`
- `设计文档/IDA插件设计.md`
- `设计文档/HUB后端.md`
- `设计文档/HUB前端.md`
- `设计文档/skill设计.md`
- `skills/README.md`
- `HANDOFF.md`
