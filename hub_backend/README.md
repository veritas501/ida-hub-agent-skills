# ida-chat-hub

Hub backend service for IDA Chat distributed architecture.

## Development

```bash
cd hub_backend
uv sync
uv run ida-chat-hub
```

By default, Hub will serve static files from `../hub_frontend/out` if that directory exists.

## Environment variables

- `IDA_HUB_HOST` (default: `0.0.0.0`)
- `IDA_HUB_PORT` (default: `10086`)
- `IDA_HUB_DEBUG` (default: `false`)
- `IDA_HUB_EXECUTE_TIMEOUT` (default: `30.0`)
- `IDA_HUB_WEB_ROOT` (optional static web root, overrides default)
- `IDA_HUB_CORS_ORIGINS` (comma-separated origins, default: `http://localhost:3000,http://127.0.0.1:3000`)

## API notes

- `GET /api/network/interfaces`: 返回 IPv4 网卡列表与默认 IP（出口 IP 优先）
- `GET /api/config?ip=<selected_ip>`: 返回 JSON，其中 `result` 字段为 markdown 示例文本
