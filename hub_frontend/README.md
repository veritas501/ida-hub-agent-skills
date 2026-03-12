# hub_frontend

Hub 的 Next.js 前端项目（App Router + TypeScript + Tailwind + SWR）。

## 开发

```bash
cd hub_frontend
npm install
npm run dev
```

如果前端单独运行（不是由 Hub 后端托管），请指定 Hub 地址：

```bash
NEXT_PUBLIC_HUB_URL=http://127.0.0.1:10086 npm run dev
```

## 构建

```bash
npm run build
```

静态导出目录为 `hub_frontend/out`，可由 Hub 后端托管。
