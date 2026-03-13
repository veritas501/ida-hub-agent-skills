# ida-chat-hub (Backend)

中文文档请见: [README_CN.md](README_CN.md)

FastAPI backend for the IDA Hub workflow.

It provides:

- HTTP APIs for instance listing and remote code execution
- WebSocket endpoint for IDA plugin connections
- optional static hosting for `../hub_frontend/out`

## Quick start

### 1. Install dependencies

```bash
cd hub_backend
uv sync --group dev
```

### 2. Start server

```bash
uv run ida-chat-hub
```

Default bind:

- Host: `0.0.0.0`
- Port: `10086`

### 3. Verify service

- `http://127.0.0.1:10086/healthz`
- `http://127.0.0.1:10086/docs`

## Main endpoints

- `GET /api/instances`
- `POST /api/execute`
- `GET /api/network/interfaces`
- `GET /api/config?ip=<selected_ip>`
- `WS /ws`

## Example calls

```bash
curl -s "http://127.0.0.1:10086/api/instances"
```

```bash
curl -s -X POST "http://127.0.0.1:10086/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id":"<INSTANCE_ID>","code":"print(42)"}'
```

## Environment variables

- `IDA_HUB_HOST` (default: `0.0.0.0`)
- `IDA_HUB_PORT` (default: `10086`)
- `IDA_HUB_DEBUG` (default: `false`)
- `IDA_HUB_EXECUTE_TIMEOUT` (default: `30.0`)
- `IDA_HUB_CORS_ORIGINS` (comma-separated origins)
- `IDA_HUB_DEV_MODE` (default: `false`) - enable dev proxy mode
- `IDA_HUB_DEV_PROXY_URL` (default: `http://127.0.0.1:3000`) - Next.js dev server URL

## Frontend integration

Frontend static files are served from (in priority order):
1. Packaged static files (`src/ida_chat_hub/static/`) - for pip installed distribution
2. Repo-level `../hub_frontend/out/` - for local development

### Development mode (hot reload)

Set `IDA_HUB_DEV_MODE=1` to proxy frontend requests to Next.js dev server.

## Run tests

```bash
cd hub_backend
uv run pytest
```

## Troubleshooting

- `404 Instance not found`
  - target instance is not connected, check `/api/instances`
- `504 Execute timed out`
  - script took too long, simplify code or raise `IDA_HUB_EXECUTE_TIMEOUT`
- frontend not shown on `/`
  - make sure `hub_frontend/out` exists or build frontend with `python scripts/build_frontend.py`
- dev proxy returns 502
  - ensure Next.js dev server is running (`npm run dev` in hub_frontend)
