# hub_frontend

中文文档请见: [README_CN.md](README_CN.md)

Next.js frontend for IDA Hub management UI.

It provides pages for:

- instance overview
- execution/config helper views
- integration with Hub backend APIs

## Quick start

### 1. Install dependencies

```bash
cd hub_frontend
npm install
```

### 2. Run in development mode

```bash
npm run dev
```

Open:

- `http://127.0.0.1:3000`

## Backend URL behavior

- If hosted by Hub backend, frontend uses same-origin API (`/api/*`).
- If run standalone in dev, set backend URL via env:

```bash
NEXT_PUBLIC_HUB_URL=http://127.0.0.1:10086 npm run dev
```

## Build static output

```bash
npm run build
```

Static export output:

- `hub_frontend/out`

This output is intended to be served by Hub backend.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Troubleshooting

- frontend cannot load instance list
  - ensure backend is running and reachable
  - verify `NEXT_PUBLIC_HUB_URL` when running standalone
- page is blank after build
  - verify backend serves `hub_frontend/out`
  - check browser console/network tab for missing assets
