# DEV Guide (hub_backend)

## Responsibility

`hub_backend` is the system control plane and API contract owner.

It is responsible for:

- managing connected IDA instances
- routing execute requests to specific instance connections
- exposing HTTP APIs for frontend/agents
- hosting frontend static assets (optional)

## Runtime architecture

- Framework: FastAPI
- Entry point: `ida_chat_hub.main:run`
- Registry: in-memory instance/session state
- Transport:
  - HTTP: `/api/*`
  - WebSocket: `/ws`

## Public contracts

### HTTP APIs

- `GET /api/instances`
- `POST /api/execute`
- `GET /api/network/interfaces`
- `GET /api/config`

### WebSocket protocol

- expects first message `register`
- accepts `execute_result`
- sends `register_ack` and `execute`

## Decoupling constraints

- Do not import frontend code.
- Do not rely on plugin implementation details beyond protocol schema.
- Treat plugin and skills as external clients.

## Important implementation notes

- `request_id` is generated server-side for each execute request.
- execute timeout is controlled by `IDA_HUB_EXECUTE_TIMEOUT`.
- if static web root is present, backend serves SPA plus `_next/assets`.

## Local development

```bash
cd hub_backend
uv sync --group dev
uv run ida-chat-hub
```

Test:

```bash
uv run pytest
```

## Frontend serving modes

### Development mode (hot reload)

Set `IDA_HUB_DEV_MODE=1` to proxy frontend requests to Next.js dev server:

```bash
# Terminal 1: Start Next.js dev server
cd hub_frontend
npm run dev

# Terminal 2: Start backend with dev mode
cd hub_backend
IDA_HUB_DEV_MODE=1 uv run ida-chat-hub
```

Environment variables:
- `IDA_HUB_DEV_MODE`: Enable dev mode (default: false)
- `IDA_HUB_DEV_PROXY_URL`: Next.js dev server URL (default: http://127.0.0.1:3000)

### Production mode (static files)

Frontend static files are served from (in priority order):
1. Packaged static files (`src/ida_chat_hub/static/`)
2. Repo-level `hub_frontend/out/`

To embed frontend in the Python package:

```bash
# Build and copy frontend to package
python scripts/build_frontend.py

# Or skip npm build if already built
python scripts/build_frontend.py --skip-npm
```

The static files will be included when building the wheel:

```bash
uv build
```

## When changing APIs/protocol

Update in the same change set:

- backend models/routes/ws logic
- plugin WS handling (`ida_plugins/ida_multi_chat/hub_client.py`)
- frontend API typings/calls (`hub_frontend/lib/*`)
- skill references/examples (`skills/ida/*`)
