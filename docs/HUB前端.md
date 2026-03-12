# HUB 前端设计文档

## 1. 概述

基于 Next.js 14 (App Router) 的 Web 管理界面，编译后由 FastAPI 托管，实现单端口部署。

## 2. 技术选型

| 组件 | 版本 | 说明 |
|------|------|------|
| Next.js | ^14.0.0 | React 框架 (App Router) |
| React | ^18.0.0 | UI 库 |
| TypeScript | ^5.0.0 | 类型安全 |
| Tailwind CSS | ^3.0.0 | 样式框架 |
| SWR | ^2.0.0 | 数据获取 |

## 3. 文件结构

```
hub/web/
├── app/
│   ├── layout.tsx           # 根布局
│   ├── page.tsx             # Dashboard 页面
│   ├── globals.css          # 全局样式
│   └── config/
│       └── page.tsx         # 配置页面
├── components/
│   ├── InstanceCard.tsx     # 实例卡片
│   ├── InstanceList.tsx     # 实例列表
│   └── Header.tsx           # 页头
├── lib/
│   ├── api.ts               # API 客户端
│   └── types.ts             # TypeScript 类型
├── package.json
├── next.config.js
└── tailwind.config.js
```

## 4. 页面设计

### 4.1 Dashboard (`/`)

```
┌─────────────────────────────────────────────────────────────────┐
│  IDA Hub Server                              [Refresh] [Config] │
├─────────────────────────────────────────────────────────────────┤
│  Connected Instances (2)                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🟢 calc.exe.i64                                           │ │
│  │    ID: a1b2c3d4 | x86_64                                  │ │
│  │                                          [Execute] [Info] │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 配置页 (`/config`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code Configuration                         [Copy All]  │
├─────────────────────────────────────────────────────────────────┤
│  List instances:                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ curl http://192.168.1.100:8765/api/instances              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Execute code:                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ curl -X POST http://192.168.1.100:8765/api/execute ...    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Python Helper:                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ import requests                                            │ │
│  │ HUB_URL = "http://192.168.1.100:8765"                      │ │
│  │ ...                                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 5. 核心组件

### 5.1 InstanceCard

显示单个 IDA 实例信息：

| 属性 | 类型 | 说明 |
|------|------|------|
| `instance` | InstanceInfo | 实例数据 |

| 操作 | 说明 |
|------|------|
| Execute | 打开代码执行对话框 |
| Info | 显示实例详细信息 |

### 5.2 API 客户端 (lib/api.ts)

| 函数 | 说明 |
|------|------|
| `fetchInstances()` | 获取实例列表 |
| `executeCode(request)` | 执行代码 |
| `fetchConfig()` | 获取配置 |

## 6. 数据类型 (lib/types.ts)

```typescript
interface InstanceInfo {
  instance_id: string;
  module: string;
  db_path: string;
  architecture: string;
  connected_at: string;
}

interface ExecuteRequest {
  instance_id: string;
  code: string;
}

interface ExecuteResponse {
  success: boolean;
  output?: string;
  error?: string;
}
```

## 7. 静态导出配置

### next.config.js

```javascript
const nextConfig = {
  output: 'export',    // 静态导出
  distDir: 'out',      // 输出目录
  images: {
    unoptimized: true, // 静态导出不支持图片优化
  },
};
```

### API 请求

使用相对路径，前后端同源：

```typescript
const API_BASE = '/api';  // 相对路径
```

## 8. 部署

```bash
# 开发模式
cd hub/web && npm run dev

# 构建（输出到 hub/web/out/）
npm run build

# 由 FastAPI 托管，访问
# http://192.168.1.100:8765/
```
