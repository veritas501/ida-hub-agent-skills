# IDA Hub Agent Skiils

![](assets/ida.png)

IDA Hub manages multiple IDA Pro instances centrally. Agents interact with IDA remotely via HTTP API for reverse engineering tasks.

```
IDA Pro ①  ──WebSocket──╮
IDA Pro ②  ──WebSocket──┼──▶  Hub  ◀──HTTP──  Agent
IDA Pro ③  ──WebSocket──╯  ▲
   ...                     │
IDA Pro ⓝ  ──WebSocket─────╯
```

## Quick Start

### 1. Start the Hub (skip if you already have one)

```bash
bun install
bun run build
bun run start
```

Or build a standalone binary (zero dependencies, recommended for distribution):

```bash
bun run bundle:bin  # → apps/api/dist/ida-hub
```

```bash
./ida-hub # default 0.0.0.0:10086
# or
./ida-hub --port 8080
./ida-hub --host 127.0.0.1 --port 8080
./ida-hub --db /path/to/hub.db
./ida-hub --debug
```

### 2. Install the IDA plugin

Copy `ida_plugins/ida_multi_chat_entry.py` and `ida_plugins/ida_multi_chat/` into IDA's `plugins` directory, install dependencies, then restart IDA:

```bash
pip install -r ida_plugins/requirements.txt
```

Get the connection config from the Hub Web UI and connect from IDA. See [ida_plugins/README.md](ida_plugins/README.md) for details.

### 3. Install Agent Skills

```bash
npx skills add -y -g veritas501/ida-hub-agent-skills
```

### 4. Verify

Run `/ida-hub` in your Agent to confirm it works.

## Directory Layout

```
apps/api/          Backend (TypeScript, Bun)
apps/web/          Frontend (React)
packages/shared/   Shared types and utilities
ida_plugins/       IDA plugin (Python)
skills/            Agent skills (npx skills add compatible)
```

## Credits

This project was inspired by [ida-chat-plugin](https://github.com/HexRaysSA/ida-chat-plugin) and built with [Claude Code](https://claude.ai/code) as a pair programming partner.

