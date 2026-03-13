# AGENTS.md / CLAUDE.md

本文件用于让后续 Agent 快速理解本仓库用途、结构、约束与常用流程。
说明：仓库中 `AGENTS.md` 为软链接，指向本文件。

## 1. 输出与协作规则

- 必须使用简体中文回复。
- 风格保持专业、简洁、技术导向，优先给出可执行结论。
- 先读后改，避免基于猜测修改代码。
- 代码变更遵循 SOLID、KISS、DRY、YAGNI。
- 搜索优先使用 `rg`。
- 注释语言保持与代码库一致（本仓库代码与文档多数为英文，面向用户回复为中文）。

## 2. 高风险操作确认机制

执行以下操作前，必须得到用户明确确认：
- 删除文件/目录、批量不可逆修改
- `git commit`、`git push`、`git reset --hard`
- 系统配置/权限变更
- 数据库删除或批量更新
- 发送敏感数据到外部服务

确认模板：

```text
⚠️ 危险操作检测！
操作类型：[具体操作]
影响范围：[详细说明]
风险评估：[潜在后果]

请确认是否继续？[需要明确的"是"、"确认"、"继续"]
```

## 3. 仓库主要用途

本项目用于构建 IDA Chat 分布式架构，实现：
- 多个 IDA Pro 实例统一接入 Hub
- Hub 提供 HTTP API 与 Web UI
- 外部 Agent（如 Codex/Claude Code）通过 Hub 下发代码到指定 IDA 实例执行

核心通信关系：
- IDA Plugin ↔ Hub：WebSocket（`/ws`）
- Frontend ↔ Hub：HTTP（`/api/*`）
- Agent ↔ Hub：HTTP（`/api/instances`、`/api/execute` 等）

当前主端口口径：`10086`。

## 4. 主要目录结构（当前仓库）

```text
ida_claw/
├── ida_plugins/              # IDA 插件实现（当前已重点开发）
│   ├── ida_multi_chat_entry.py
│   └── ida_multi_chat/
│       ├── plugin.py
│       ├── hub_client.py
│       ├── core.py
│       └── config_persistence.py
├── hub_backend/              # Hub 后端（FastAPI）
├── hub_frontend/             # Hub 前端（Next.js）
├── 设计文档/                 # 设计与说明文档
├── ref/                      # 参考实现与 API 资料（含 ida-domain 参考）
└── HANDOFF.md                # 阶段性交接文档
```

## 5. 与 IDA 插件相关的关键事实

- 插件入口文件应保持轻量：`ida_plugins/ida_multi_chat_entry.py`。
- 业务逻辑集中在 `ida_plugins/ida_multi_chat/`。
- 菜单路径为 `Edit -> IDA Multi Chat -> Connect / Disconnect / Settings`。
- 连接默认地址应使用 `127.0.0.1:10086`（避免 `localhost` 在部分环境解析异常）。
- `instance_id` 当前规则为“文件名（规范化）+ 3 位随机数”。
- 涉及 IDA API/ida-domain 的采集优先在主线程执行（避免后台线程访问导致数据缺失或异常）。

## 6. 常用开发与排查命令

```bash
# 查看变更
git status --short

# 代码搜索
rg -n "pattern" .

# 格式化（已获批准前缀）
uvx ruff format

# 启动后端（按项目实际入口为准）
cd hub_backend
python run.py --host 0.0.0.0 --port 10086
```

## 7. 关键文档入口

- `设计文档/总体架构需求.md`
- `设计文档/IDA插件设计.md`
- `设计文档/HUB后端.md`
- `设计文档/HUB前端.md`
- `设计文档/skill设计.md`
- `HANDOFF.md`
- `ref/ida-chat-plugin/project/API_REFERENCE.md`（ida-domain API 速查）

## 8. 工作约束补充

- 未经用户明确要求，不主动执行 git 提交/分支操作。
- 若工作区已有用户改动，默认保留，不得擅自回滚。
- 优先做最小必要改动，避免顺手重构。
