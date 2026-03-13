# ida-hub-agent-skills

For English, see: [README.md](README.md)

这是一个面向 IDA Pro 的分布式逆向工作流：

- 多个 IDA 实例统一接入 Hub
- Agent 通过 Hub API 调用实例能力
- 以 Skill 化方式在指定 IDA 实例中执行 Python 分析代码

## 适用人群

- 使用 IDA Pro 做逆向分析的工程师
- 需要集中管理多实例的团队
- 希望通过 Agent + API 做自动化分析的场景

## 工作方式

- `IDA 插件 <-> Hub`：WebSocket（`/ws`）
- `Agent <-> Hub`：HTTP（`/api/instances`、`/api/execute`、`/api/config`）
- `前端 <-> Hub`：HTTP（`/api/*`）

默认约定：

- Hub：`0.0.0.0:10086`
- IDA 插件默认连接：`127.0.0.1:10086`

## 快速开始

### 1. 启动 Hub 后端

```bash
cd hub_backend
uv sync --group dev
uv run ida-chat-hub
```

检查：

- `http://127.0.0.1:10086/healthz`
- `http://127.0.0.1:10086/docs`

### 2. （可选）构建前端

```bash
cd hub_frontend
npm install
npm run build
```

如果存在 `hub_frontend/out`，Hub 会自动托管该目录。

### 3. 安装 IDA 插件

复制到 IDA 的 `plugins` 目录：

- `ida_plugins/ida_multi_chat_entry.py`
- `ida_plugins/ida_multi_chat/`

在 IDA Python 环境安装插件依赖：

```bash
pip install -r ida_plugins/requirements.txt
```

然后重启 IDA。

插件侧详细说明见：

- [ida_plugins/README.md](ida_plugins/README.md)
- [ida_plugins/README_CN.md](ida_plugins/README_CN.md)

### 4. API 验证

```bash
curl -s "http://127.0.0.1:10086/api/instances"
```

```bash
curl -s -X POST "http://127.0.0.1:10086/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id":"<INSTANCE_ID>","code":"print(42)"}'
```

## 仓库结构

```text
ida_claw/
├── ida_plugins/      # IDA 插件
├── hub_backend/      # FastAPI Hub
├── hub_frontend/     # Next.js 前端
├── skills/           # Agent 技能与参考
├── 设计文档/         # 架构与设计文档
└── ref/              # 外部参考资料
```

## 常见问题

- `404 Instance not found`
  - 先从 `/api/instances` 确认 `instance_id`
- `504 Execute timed out`
  - 缩小脚本执行范围，或提高 `IDA_HUB_EXECUTE_TIMEOUT`
- 插件菜单未显示
  - 确认插件文件已放到 IDA `plugins` 目录并重启 IDA

## Hub 环境变量

- `IDA_HUB_HOST`（默认 `0.0.0.0`）
- `IDA_HUB_PORT`（默认 `10086`）
- `IDA_HUB_DEBUG`（默认 `false`）
- `IDA_HUB_EXECUTE_TIMEOUT`（默认 `30.0`）
- `IDA_HUB_WEB_ROOT`（可选）
- `IDA_HUB_CORS_ORIGINS`（逗号分隔）

## 进一步阅读

- `设计文档/总体架构需求.md`
- `设计文档/IDA插件设计.md`
- `设计文档/HUB后端.md`
- `设计文档/HUB前端.md`
- `设计文档/skill设计.md`
- `skills/README.md`
