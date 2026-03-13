# DEV Guide (hub_frontend)

## Responsibility

`hub_frontend` is the operator-facing UI.

It is responsible for:

- presenting instance status
- helping users trigger/inspect execution-related flows
- rendering config/help content returned by backend

## Runtime architecture

- Framework: Next.js (App Router)
- UI stack: React + TypeScript + SWR + Tailwind
- Build output: `out/` (served by `hub_backend`)

## Data dependencies

Frontend only depends on `hub_backend` HTTP APIs:

- `/api/instances`
- `/api/network/interfaces`
- `/api/config`
- `/api/execute`

No direct dependency on plugin runtime.

## Decoupling constraints

- Do not import backend Python internals.
- Do not encode WS protocol details in frontend.
- Keep API type definitions centralized in `lib/types.ts`.

## Running locally

```bash
cd hub_frontend
npm install
npm run dev
```

If backend is not same-origin during dev:

```bash
NEXT_PUBLIC_HUB_URL=http://127.0.0.1:10086 npm run dev
```

Build static output:

```bash
npm run build
```

## Change guidance

When adding/changing API usage:

1. update `lib/types.ts`
2. update `lib/api.ts`
3. update consuming components/pages
4. validate against live backend responses

Keep UI resilient to partial backend data (missing/empty values).
