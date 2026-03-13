# ida-hub-agent-skills

中文文档请见: [README_CN.md](README_CN.md)

A distributed workflow for reverse engineering with IDA Pro:

- connect multiple IDA instances to one Hub
- let Agents call Hub APIs
- run skill-like Python analysis code inside a selected IDA instance

## Who is this for

- reverse engineers using IDA Pro
- teams that want centralized multi-instance control
- Agent workflows that need repeatable, API-driven analysis

## How it works

- `IDA Plugin <-> Hub`: WebSocket (`/ws`)
- `Agent <-> Hub`: HTTP (`/api/instances`, `/api/execute`, `/api/config`)
- `Frontend <-> Hub`: HTTP (`/api/*`)

Default endpoint convention:

- Hub: `0.0.0.0:10086`
- IDA plugin default target: `127.0.0.1:10086`

## Quick start

### 1. Start Hub backend

```bash
cd hub_backend
uv sync --group dev
uv run ida-chat-hub
```

Check:

- `http://127.0.0.1:10086/healthz`
- `http://127.0.0.1:10086/docs`

### 2. (Optional) Build frontend

```bash
cd hub_frontend
npm install
npm run build
```

If `hub_frontend/out` exists, Hub serves it automatically.

### 3. Install IDA plugin

Copy to your IDA `plugins` directory:

- `ida_plugins/ida_multi_chat_entry.py`
- `ida_plugins/ida_multi_chat/`

Install plugin dependencies in IDA Python environment:

```bash
pip install -r ida_plugins/requirements.txt
```

Then restart IDA.

For plugin-level setup details, see:

- [ida_plugins/README.md](ida_plugins/README.md)
- [ida_plugins/README_CN.md](ida_plugins/README_CN.md)

### 4. Verify from API

```bash
curl -s "http://127.0.0.1:10086/api/instances"
```

```bash
curl -s -X POST "http://127.0.0.1:10086/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id":"<INSTANCE_ID>","code":"print(42)"}'
```

## Repository layout

```text
ida_claw/
├── ida_plugins/      # IDA plugin
├── hub_backend/      # FastAPI hub
├── hub_frontend/     # Next.js frontend
├── skills/           # Agent skills and references
├── docs/             # architecture/design docs
└── ref/              # external references
```

## Common issues

- `404 Instance not found`
  - confirm instance id from `/api/instances`
- `504 Execute timed out`
  - reduce script workload or increase `IDA_HUB_EXECUTE_TIMEOUT`
- plugin menu not shown
  - verify plugin files are in IDA `plugins` and restart IDA

## Environment variables (Hub)

- `IDA_HUB_HOST` (default: `0.0.0.0`)
- `IDA_HUB_PORT` (default: `10086`)
- `IDA_HUB_DEBUG` (default: `false`)
- `IDA_HUB_EXECUTE_TIMEOUT` (default: `30.0`)
- `IDA_HUB_CORS_ORIGINS` (comma-separated)
- `IDA_HUB_DEV_MODE` (default: `false`) - enable dev proxy mode
- `IDA_HUB_DEV_PROXY_URL` (default: `http://127.0.0.1:3000`) - Next.js dev server URL

## More docs

- `docs/requirements.md`
- `docs/ida-plugin.md`
- `docs/hub-backend.md`
- `docs/hub-frontend.md`
- `docs/skills.md`
- `skills/README.md`
