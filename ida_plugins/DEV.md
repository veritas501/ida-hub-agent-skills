# DEV Guide (ida_plugins)

## Responsibility

`ida_plugins` is the IDA-side execution runtime.

It is responsible for:

- connecting to Hub via WebSocket
- registering current IDA instance metadata
- executing hub-delivered Python in IDA main thread
- returning execution result (`success/output/error`)

## Runtime architecture

- Entry file: `ida_multi_chat_entry.py`
- Main plugin implementation: `ida_multi_chat/plugin.py`
- Hub client/protocol: `ida_multi_chat/hub_client.py`
- Main-thread executor: `ida_multi_chat/core.py`
- Config persistence: `ida_multi_chat/config_persistence.py`

## Integration points

### Upstream (Hub backend)

- Connects to `ws://<host>:<port>/ws`
- Protocol messages:
  - send: `register`, `execute_result`
  - receive: `register_ack`, `execute`

### Downstream (IDA runtime)

- Uses IDA APIs and ida-domain objects in main-thread-safe execution path.
- Script context includes `db`, `idaapi`, `idautils`, `idc`, `ida_kernwin`.

## Decoupling constraints

- Do not import backend/frontend modules.
- Keep plugin behavior driven by protocol + local config only.
- Keep entry module thin; place logic inside package modules.

## Local verification checklist

- menu exists under `Edit -> IDA Multi Chat`
- can connect/disconnect manually
- instance appears in `/api/instances`
- `POST /api/execute` returns expected output/error

## Safe change guidance

For any protocol-affecting change, update all participants together:

- plugin `hub_client.py`
- backend ws/routes/models
- skills examples
- frontend API usage (if schema visible in UI)
