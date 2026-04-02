# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Distributed IDA Chat architecture: multiple IDA Pro instances connect to a central Hub via WebSocket; external Agents/frontends interact with specific IDA instances through HTTP API.

## Common Commands

```bash
# Install dependencies
bun install

# Development (API + frontend separately)
bun run dev:api    # Hono backend http://0.0.0.0:10086
bun run dev:web    # Vite frontend http://localhost:5173 (proxies /api, /ws → 10086)

# Run source directly (dev/debug)
bun apps/api/src/server.ts --host 0.0.0.0 --port 10086 --debug

# Build (Turborepo topological order: shared → api + web)
bun run build

# Bundle for deployment
bun run bundle       # build + minify JS + embed web assets into apps/api/web/
bun run bundle:bin   # bundle + standalone binary: apps/api/dist/ida-hub
bun run start        # run built artifact dist/server.js

# Clean
bun run clean        # remove all build artifacts
```

**No test framework or linter configured.** Turborepo `test`/`lint` tasks are defined but no-op. Type safety relies on TypeScript strict mode.

## Architecture Overview

```
IDA Plugin ──WebSocket(/ws)──▶ Hub API (apps/api) ◀──HTTP(/api/*)── Agent / Frontend (apps/web)
                                     │
                              packages/shared (types, validators, DB, config, logger)
```

### Monorepo Structure

| Package | Language | Role | Entry |
|---|---|---|---|
| `apps/api` | TypeScript (Bun) | Hono HTTP + WebSocket server | `src/server.ts` → `src/app.ts` |
| `apps/web` | TypeScript/React | Vite SPA frontend | `src/main.tsx` |
| `packages/shared` | TypeScript | Shared types, Zod validators, Drizzle ORM, CLI config, consola logger | `src/index.ts` |
| `ida_plugins` | Python | IDA plugin: WebSocket connection + script execution | `ida_multi_chat_entry.py` |
| `skills` | Markdown | Agent skill docs (`npx skills add` compatible) | `ida-hub/SKILL.md` |

**Module-level CLAUDE.md files:** `ida_plugins/CLAUDE.md` (plugin architecture, data models, FAQ), `skills/CLAUDE.md` (skill installation & maintenance). Read these before modifying the corresponding module.

### Backend Key Paths

- `server.ts`: Bun.serve() startup + static file hosting + SPA fallback
- `app.ts`: middleware/route assembly, DB/Registry/network probe initialization
- `registry/index.ts`: IDA instance registration, execute request dispatch with timeout, user isolation
- `ws/handler.ts`: WebSocket connection state machine (auth → register → execute_result), managed via `WeakMap<WSContext, ConnState>`
- `middleware/auth.ts`: Bearer token authentication

### Frontend Key Paths

- Routing: `react-router-dom` v7, 4 pages (`/login`, `/`, `/ida_config`, `/agent_config`), `AuthGuard` component protects non-login pages
- Data fetching: SWR, Dashboard instance list polls every 5s (`refreshInterval: 5000`)
- i18n: custom `I18nProvider` + `useI18n()` hook, zh/en, type-safe keys, locale stored in `localStorage` (`ida_hub_locale`)
- Auth state: `localStorage` (`ida_hub_token`/`ida_hub_username`), auto-redirect to `/login` on API 401
- API client: centralized in `lib/api.ts`, supports `VITE_HUB_URL` env var for remote Hub address
- Styling: Tailwind CSS v3 + CSS variable design tokens (orange brand color, custom radius/animations/font stacks)

### Database

Single `users` table (SQLite, `bun:sqlite` + Drizzle ORM):

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `username` | TEXT | NOT NULL UNIQUE |
| `password_hash` | TEXT | NOT NULL |
| `token` | TEXT | NOT NULL UNIQUE |
| `created_at` | TEXT | NOT NULL DEFAULT `datetime('now')` |

Schema: `packages/shared/src/db/schema.ts`. No Drizzle migration files — table created imperatively in `initDB()` via `sqlite.exec()`. PRAGMA: `journal_mode = WAL`.

### HTTP API

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, returns token |
| GET | `/api/instances` | List current user's IDA instances |
| POST | `/api/execute` | Execute code on a specific instance |
| GET | `/api/network/interfaces` | List server network interfaces |
| GET | `/api/agent_config` | Get Agent config as Markdown |
| GET | `/api/ida_config` | Get IDA plugin config string |
| GET | `/healthz` | Health check |

### WebSocket Protocol

Connection: `ws://<host>:10086/ws?token=<token>`

Message flow: `register` → `register_ack` → (`execute` ↔ `execute_result`)

Close codes: `4000` REPLACED / `4001` REGISTER_REQUIRED / `4002` REGISTER_TIMEOUT / `4003` AUTH_FAILED

## Configuration

**No environment variables — all config via CLI args** (`node:util parseArgs` + Zod validation):

| Flag | Default | Description |
|---|---|---|
| `--host` | `0.0.0.0` | Listen address |
| `--port` | `10086` | Listen port |
| `--timeout` | `30` | Execute timeout in seconds |
| `--db` | `~/.ida_hub/hub_users.db` | SQLite database path |
| `--debug` | `false` | Enable debug logging |

## Coding Conventions

- TypeScript: strict mode, ESM, type annotations
- `packages/shared` built with `tsc`, re-exports **must** use `.js` extension
- `postcss.config` and `tailwind.config` **must** use `.cjs` extension (`"type": "module"`)
- `bun:sqlite` pragma via `sqlite.exec("PRAGMA ...")`, not `.pragma()`
- Drizzle ORM uses `drizzle-orm/bun-sqlite` driver
- Frontend uses `@/` path alias (Vite resolve.alias → `src/`)
- React components: single responsibility, API calls centralized in `lib/api.ts`
- Python (plugin): type annotations, clear module boundaries
- Code comments: keep consistent with existing codebase language (Chinese)

## AI Usage Guide

- Read before modifying — check module-level `CLAUDE.md` before diving into source
- For cross-component debugging, trace the full chain: Frontend → Hub API → WS → Plugin
- For large output tasks, prefer summaries — avoid returning full datasets from IDA (output budget 200k chars)
