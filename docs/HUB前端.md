# HUB 前端设计文档

## 1. 概述

基于 Next.js 14 (App Router) 的 Web 管理界面，提供 IDA 实例可视化管理。

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
│   ├── config/
│   │   └── page.tsx         # 配置页面
│   └── instance/
│       └── [id]/
│           └── page.tsx     # 实例详情页面
├── components/
│   ├── InstanceCard.tsx     # 实例卡片组件
│   ├── InstanceList.tsx     # 实例列表组件
│   ├── CodeEditor.tsx       # 代码编辑器
│   ├── ConfigPanel.tsx      # 配置面板
│   └── Header.tsx           # 页头组件
├── lib/
│   ├── api.ts               # API 客户端
│   └── types.ts             # TypeScript 类型
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## 4. 页面设计

### 4.1 Dashboard 页面 (`/`)

```
┌─────────────────────────────────────────────────────────────────┐
│  IDA Hub Server                              [Refresh] [Config] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Connected Instances (2)                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🟢 calc.exe.i64                                           │ │
│  │    ID: a1b2c3d4 | x86_64 | 150 functions                  │ │
│  │    Path: C:\analyses\calc.exe.i64                         │ │
│  │                                          [Execute] [Info] │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🟢 malware.dll                                            │ │
│  │    ID: e5f6g7h8 | x86 | 89 functions                      │ │
│  │    Path: C:\analyses\malware.dll.i64                      │ │
│  │                                          [Execute] [Info] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Server Info                                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Hub URL: http://192.168.1.100:8765                        │ │
│  │ Uptime: 2h 30m                                            │ │
│  │ Requests: 156                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 实例详情页面 (`/instance/[id]`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                                      calc.exe.i64       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Instance Info                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ID:           a1b2c3d4                                    │ │
│  │ Architecture: x86_64                                      │ │
│  │ Base Address: 0x140000000                                 │ │
│  │ Functions:    150                                         │ │
│  │ Strings:      500                                         │ │
│  │ Segments:     .text, .data, .rdata                        │ │
│  │ Connected:    2026-03-12 10:30:00                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Execute Code                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ print(len(db.functions))                                  │ │
│  │ for func in db.functions:                                 │ │
│  │     print(hex(func.start_ea))                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                          [Execute] [Clear]       │
│                                                                 │
│  Output                                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 150                                                       │ │
│  │ 0x140001000                                               │ │
│  │ 0x140001100                                               │ │
│  │ ...                                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 配置页面 (`/config`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code Configuration                         [Copy All]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Quick Commands (click to copy)                                 │
│                                                                 │
│  List instances:                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ curl http://192.168.1.100:8765/api/instances              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Execute code (replace INSTANCE_ID):                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ curl -X POST http://192.168.1.100:8765/api/execute \      │ │
│  │   -H 'Content-Type: application/json' \                   │ │
│  │   -d '{"instance_id": "INSTANCE_ID", "code": "CODE"}'     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Python Helper (save as ida_client.py):                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ import requests                                            │ │
│  │ HUB_URL = "http://192.168.1.100:8765"                      │ │
│  │                                                            │ │
│  │ def list_instances():                                      │ │
│  │     return requests.get(f"{HUB_URL}/api/instances").json()│ │
│  │                                                            │ │
│  │ def execute(instance_id, code):                            │ │
│  │     return requests.post(f"{HUB_URL}/api/execute",        │ │
│  │         json={"instance_id": instance_id, "code": code}   │ │
│  │     ).json()                                               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5. 核心组件实现

### 5.1 类型定义 (`lib/types.ts`)

```typescript
export interface InstanceInfo {
  instance_id: string;
  module: string;
  db_path: string;
  architecture: string;
  bitness: number;
  functions_count: number;
  strings_count: number;
  segments: string[];
  connected_at: string;
}

export interface InstancesResponse {
  instances: InstanceInfo[];
}

export interface ExecuteRequest {
  instance_id: string;
  code: string;
}

export interface ExecuteResponse {
  success: boolean;
  output?: string;
  error?: string;
}

export interface DbInfoResponse {
  instance_id: string;
  module: string;
  path: string;
  architecture: string;
  bitness: number;
  base_address: string;
  functions_count: number;
  strings_count: number;
  segments: string[];
}

export interface ConfigResponse {
  hub_url: string;
  curl_examples: Record<string, string>;
  python_helper: string;
}
```

### 5.2 API 客户端 (`lib/api.ts`)

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765';

export async function fetchInstances(): Promise<InstancesResponse> {
  const res = await fetch(`${API_BASE}/api/instances`);
  if (!res.ok) throw new Error('Failed to fetch instances');
  return res.json();
}

export async function executeCode(request: ExecuteRequest): Promise<ExecuteResponse> {
  const res = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error('Failed to execute code');
  return res.json();
}

export async function fetchDbInfo(instanceId: string): Promise<DbInfoResponse> {
  const res = await fetch(`${API_BASE}/api/db-info/${instanceId}`);
  if (!res.ok) throw new Error('Failed to fetch db info');
  return res.json();
}

export async function fetchConfig(): Promise<ConfigResponse> {
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}
```

### 5.3 实例卡片组件 (`components/InstanceCard.tsx`)

```typescript
'use client';

import Link from 'next/link';
import { InstanceInfo } from '@/lib/types';

interface Props {
  instance: InstanceInfo;
}

export function InstanceCard({ instance }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <h3 className="font-medium">{instance.module}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            ID: {instance.instance_id} | {instance.architecture} | {instance.functions_count} functions
          </p>
          <p className="text-sm text-gray-400 truncate max-w-md">
            {instance.db_path}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/instance/${instance.instance_id}`}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Execute
          </Link>
          <Link
            href={`/instance/${instance.instance_id}?tab=info`}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Info
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### 5.4 Dashboard 页面 (`app/page.tsx`)

```typescript
'use client';

import useSWR from 'swr';
import { fetchInstances } from '@/lib/api';
import { InstanceCard } from '@/components/InstanceCard';

export default function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR('instances', fetchInstances, {
    refreshInterval: 5000, // 每5秒刷新
  });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">IDA Hub Server</h1>
        <div className="flex gap-2">
          <button
            onClick={() => mutate()}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Refresh
          </button>
          <a
            href="/config"
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Config
          </a>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-3">
          Connected Instances ({data?.instances.length ?? 0})
        </h2>

        {isLoading && <p>Loading...</p>}
        {error && <p className="text-red-500">Failed to load instances</p>}

        <div className="space-y-3">
          {data?.instances.map((instance) => (
            <InstanceCard key={instance.instance_id} instance={instance} />
          ))}
        </div>

        {data?.instances.length === 0 && (
          <p className="text-gray-500">No instances connected</p>
        )}
      </section>
    </main>
  );
}
```

### 5.5 配置页面 (`app/config/page.tsx`)

```typescript
'use client';

import useSWR from 'swr';
import { fetchConfig } from '@/lib/api';

export default function ConfigPage() {
  const { data, isLoading } = useSWR('config', fetchConfig);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) return <p>Loading...</p>;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Claude Code Configuration</h1>
        <button
          onClick={() => {
            const all = [
              data?.curl_examples.list_instances,
              data?.curl_examples.execute,
              data?.python_helper,
            ].join('\n\n');
            copyToClipboard(all);
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Copy All
        </button>
      </header>

      <section className="space-y-6">
        <div>
          <h3 className="font-medium mb-2">List instances:</h3>
          <pre
            className="bg-gray-100 p-3 rounded cursor-pointer hover:bg-gray-200"
            onClick={() => copyToClipboard(data?.curl_examples.list_instances || '')}
          >
            {data?.curl_examples.list_instances}
          </pre>
        </div>

        <div>
          <h3 className="font-medium mb-2">Execute code (replace INSTANCE_ID):</h3>
          <pre
            className="bg-gray-100 p-3 rounded cursor-pointer hover:bg-gray-200 whitespace-pre-wrap"
            onClick={() => copyToClipboard(data?.curl_examples.execute || '')}
          >
            {data?.curl_examples.execute}
          </pre>
        </div>

        <div>
          <h3 className="font-medium mb-2">Python Helper (save as ida_client.py):</h3>
          <pre
            className="bg-gray-100 p-3 rounded cursor-pointer hover:bg-gray-200 whitespace-pre-wrap"
            onClick={() => copyToClipboard(data?.python_helper || '')}
          >
            {data?.python_helper}
          </pre>
        </div>
      </section>
    </main>
  );
}
```

## 6. 配置文件

### 6.1 package.json

```json
{
  "name": "ida-hub-web",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "swr": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 6.2 next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8765',
  },
};

module.exports = nextConfig;
```

### 6.3 tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

## 7. 静态导出配置（由 FastAPI 托管）

### 7.1 next.config.js 配置

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出模式
  output: 'export',

  // 输出目录（相对于项目根目录）
  distDir: 'out',

  // 禁用图片优化（静态导出不支持）
  images: {
    unoptimized: true,
  },

  // 环境变量
  env: {
    // API 地址为相对路径，由 FastAPI 统一服务
    NEXT_PUBLIC_API_URL: '',
  },

  // 禁用尾随斜杠重定向
  trailingSlash: false,
};

module.exports = nextConfig;
```

### 7.2 API 客户端调整

由于前端和后端在同一端口，API 请求使用相对路径：

```typescript
// lib/api.ts

// 使用相对路径，由 FastAPI 统一处理
const API_BASE = '/api';

export async function fetchInstances(): Promise<InstancesResponse> {
  const res = await fetch(`${API_BASE}/instances`);
  if (!res.ok) throw new Error('Failed to fetch instances');
  return res.json();
}

export async function executeCode(request: ExecuteRequest): Promise<ExecuteResponse> {
  const res = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error('Failed to execute code');
  return res.json();
}
```

### 7.3 页面路由处理

Next.js 静态导出会为每个路由生成 HTML 文件：

```
out/
├── index.html              # / 路由
├── config/
│   └── index.html          # /config 路由
├── instance/
│   └── [id]/
│       └── index.html      # /instance/[id] 路由（需要客户端路由）
└── _next/
    └── static/             # JS、CSS 等静态资源
```

> **注意**: 动态路由 `[id]` 在静态导出时需要使用客户端路由处理。

## 8. 开发与部署

### 8.1 开发模式（前后端分离）

```bash
# 终端 1: 启动后端
cd hub
python run.py --host 0.0.0.0 --port 8765 --reload

# 终端 2: 启动前端开发服务器
cd hub/web
npm install
npm run dev
# 访问 http://localhost:3000（前端代理到后端 8765）
```

### 8.2 生产部署（单端口）

```bash
# 1. 构建前端静态文件
cd hub/web
npm install
npm run build
# 输出到 hub/web/out/

# 2. 启动后端（自动托管前端）
cd ../
python run.py --host 0.0.0.0 --port 8765

# 3. 访问（单端口）
# http://192.168.1.100:8765/        → 前端页面
# http://192.168.1.100:8765/api/    → API
# http://192.168.1.100:8765/docs    → API 文档
```

### 8.3 完整目录结构

```
hub/
├── server/                   # FastAPI 后端
│   ├── main.py
│   ├── routes.py
│   └── ...
├── web/                      # Next.js 前端源码
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── out/                  # 构建输出（FastAPI 托管）
│   │   ├── index.html
│   │   ├── _next/
│   │   └── ...
│   ├── package.json
│   └── next.config.js
├── pyproject.toml
└── run.py
```
