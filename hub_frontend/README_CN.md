# hub_frontend

For English, see: [README.md](README.md)

这是 IDA Hub 的 Next.js 前端管理界面，主要用于：

- 查看连接实例
- 展示执行/配置辅助信息
- 调用 Hub 后端 API

## 快速开始

### 1. 安装依赖

```bash
cd hub_frontend
npm install
```

### 2. 开发模式运行

```bash
npm run dev
```

访问：

- `http://127.0.0.1:3000`

## 后端地址行为

- 若由 Hub 后端托管，前端默认同源调用 API（`/api/*`）。
- 若前端独立开发运行，使用环境变量指定后端：

```bash
NEXT_PUBLIC_HUB_URL=http://127.0.0.1:10086 npm run dev
```

## 构建静态产物

```bash
npm run build
```

静态导出目录：

- `hub_frontend/out`

该目录用于交由 Hub 后端托管。

## 可用脚本

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## 常见问题

- 前端拉不到实例列表
  - 确认后端已启动且可访问
  - 前端独立运行时确认 `NEXT_PUBLIC_HUB_URL` 配置正确
- 构建后页面空白
  - 确认后端正在托管 `hub_frontend/out`
  - 检查浏览器控制台/网络面板是否有静态资源加载失败
