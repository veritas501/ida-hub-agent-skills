# DEV Guide (Repository Root)

## Scope

This repository implements a distributed IDA workflow with four primary modules:

- `ida_plugins`: IDA-side runtime (connects to Hub and executes code)
- `hub_backend`: central FastAPI service (API + WS + optional static hosting)
- `hub_frontend`: web UI for operators
- `skills`: Agent-facing skill definitions and references

## High-level capabilities

- Multi-instance IDA registration and tracking
- Remote script execution in selected IDA instance
- Single-port hub deployment (`10086` by default)
- Agent/Skill-driven automation through stable HTTP API

## Module boundaries (decoupling)

- `ida_plugins` must not import frontend/backend internals; it only speaks WS JSON protocol.
- `hub_frontend` must not call plugin directly; it only uses HTTP APIs.
- `skills` must not depend on Python package internals of backend/plugin; it should rely on API contracts.
- `hub_backend` is the contract owner for API/WS schemas.

## Integration contracts

### IDA Plugin <-> Hub Backend (WebSocket)

- Endpoint: `WS /ws`
- Plugin -> Hub:
  - `register`
  - `execute_result`
- Hub -> Plugin:
  - `register_ack`
  - `execute`

Required correlation field:

- `request_id` must be echoed from `execute` to `execute_result` unchanged.

### Agent/Frontend <-> Hub Backend (HTTP)

- `GET /api/instances`
- `POST /api/execute`
- `GET /api/network/interfaces`
- `GET /api/config`

## Recommended local workflow

1. Start backend: `cd hub_backend && uv sync --group dev && uv run ida-chat-hub`
2. (Optional) Build frontend: `cd hub_frontend && npm install && npm run build`
3. Install plugin into IDA `plugins` directory and connect to Hub
4. Verify instance list via `GET /api/instances`
5. Execute a tiny script via `POST /api/execute`

## Development rules

- Keep protocol changes backward-compatible when possible.
- If protocol changes are required, update all impacted modules in one PR:
  - backend models/routes/ws handler
  - plugin hub client
  - frontend API types if needed
  - skills examples/docs
- Prefer small, interface-first changes over cross-module refactors.

## Key docs

- `README.md` / `README_CN.md`
- `hub_backend/DEV.md`
- `hub_frontend/DEV.md`
- `ida_plugins/DEV.md`
- `skills/DEV.md`
- `设计文档/*`
