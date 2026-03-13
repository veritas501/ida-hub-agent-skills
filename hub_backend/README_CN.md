# ida-chat-hub（后端）

For English, see: [README.md](README.md)

这是 IDA Hub 工作流的 FastAPI 后端服务，提供：

- 实例管理与远程执行的 HTTP API
- 供 IDA 插件连接的 WebSocket 端点
- 对 `../hub_frontend/out` 的可选静态托管

## 快速开始

### 1. 安装依赖

```bash
cd hub_backend
uv sync --group dev
```

### 2. 启动服务

```bash
uv run ida-chat-hub
```

默认监听：

- Host：`0.0.0.0`
- Port：`10086`

### 3. 验证服务

- `http://127.0.0.1:10086/healthz`
- `http://127.0.0.1:10086/docs`

## 主要接口

- `GET /api/instances`
- `POST /api/execute`
- `GET /api/network/interfaces`
- `GET /api/config?ip=<selected_ip>`
- `WS /ws`

## 调用示例

```bash
curl -s "http://127.0.0.1:10086/api/instances"
```

```bash
curl -s -X POST "http://127.0.0.1:10086/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id":"<INSTANCE_ID>","code":"print(42)"}'
```

## 环境变量

- `IDA_HUB_HOST`（默认：`0.0.0.0`）
- `IDA_HUB_PORT`（默认：`10086`）
- `IDA_HUB_DEBUG`（默认：`false`）
- `IDA_HUB_EXECUTE_TIMEOUT`（默认：`30.0`）
- `IDA_HUB_WEB_ROOT`（可选，静态目录）
- `IDA_HUB_CORS_ORIGINS`（逗号分隔）

## 前端集成

当存在 `../hub_frontend/out` 时，后端会自动托管前端静态文件。

也可以通过 `IDA_HUB_WEB_ROOT` 覆盖静态目录。

## 运行测试

```bash
cd hub_backend
uv run pytest
```

## 常见问题

- `404 Instance not found`
  - 目标实例未连接，先检查 `/api/instances`
- `504 Execute timed out`
  - 脚本执行过久，缩小任务或调大 `IDA_HUB_EXECUTE_TIMEOUT`
- 访问 `/` 看不到前端
  - 确认 `hub_frontend/out` 已构建，或设置 `IDA_HUB_WEB_ROOT`
