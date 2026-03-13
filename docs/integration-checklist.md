# Hub 前后端联调检查清单

## 1. 前置检查

- 已安装 Node.js 18+ 与 Python 3.11+
- `hub_frontend` 已执行依赖安装
- `hub_backend` 已执行 `uv sync`

## 2. 构建前端静态资源

```bash
cd "hub_frontend"
npm run build
```

预期结果：

- 生成目录 `hub_frontend/out`
- 包含 `index.html`、`config.html`、`_next/`

## 3. 启动 Hub 后端

```bash
cd "hub_backend"
uv run ida-chat-hub
```

预期结果：

- 启动日志显示 `web_root=` 指向 `hub_frontend/out`
- `GET /healthz` 返回 `{"status":"ok"}`

## 4. 页面与静态托管验证

- 访问 `http://127.0.0.1:10086/` 返回前端 Dashboard 页面
- 访问 `http://127.0.0.1:10086/config` 返回配置页面
- 打开浏览器开发者工具确认 `/_next/*` 资源返回 200

## 5. API 联调验证

### 5.1 无实例时

- Dashboard 显示“当前没有已连接的 IDA 实例”
- `GET /api/instances` 返回空数组

### 5.2 有实例时

- IDA 插件连接 Hub 后，Dashboard 列表出现实例卡片
- 卡片中能看到 `instance_id/module/architecture/platform`

### 5.3 执行代码

- 在 Dashboard 卡片中点 `Execute`
- 输入 `print(42)` 后执行
- 页面显示成功结果，输出包含 `42`

## 6. 故障排查

- 页面 404：确认 `hub_frontend/out` 是否存在且已重新 build
- 页面是 JSON 而非前端：确认未误设置 `IDA_HUB_WEB_ROOT`
- 执行超时：检查 IDA 插件是否在线，Hub `IDA_HUB_EXECUTE_TIMEOUT` 是否过小
- WebSocket 断线：检查插件配置 `host/port` 与 Hub 实际监听地址
