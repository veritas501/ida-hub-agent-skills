# IDA Multi Chat 插件 - 快速入门

For English version, see: [README.md](README.md)

本目录包含用于连接 IDA Pro 与 Hub 服务端的插件。

## 插件功能

插件加载后，你可以在 IDA 中：

- 通过菜单连接/断开 Hub 服务端
- 接收 Hub 下发的 Python 代码
- 在当前 IDA 数据库上下文中执行代码

IDA 菜单路径：

- `Edit -> IDA Multi Chat -> Connect`
- `Edit -> IDA Multi Chat -> Disconnect`
- `Edit -> IDA Multi Chat -> Settings`

## 前置条件

- IDA Pro（启用 Python）
- 已启动 Hub 服务端（默认端口：`10086`）
- IDA 所在主机可访问 Hub 主机

Python 依赖：

- `websocket-client>=1.7.0`
- `ida-domain`

## 安装步骤

1. 将以下内容复制到 IDA 的 `plugins` 目录：

- `ida_multi_chat_entry.py`
- `ida_multi_chat/`

2. 在 IDA 的 Python 环境中安装依赖：

```bash
pip install -r requirements.txt
```

## 首次连接

1. 先启动 Hub 服务端。
2. 打开 IDA。
3. 直接点击 `Connect`（如果 Hub 使用默认地址 `127.0.0.1:10086`）。
4. 可选：进入 `Edit -> IDA Multi Chat -> Settings`，设置 Hub `Host` 和 `Port`，点击 `Save`。

默认配置：

- Host: `127.0.0.1`
- Port: `10086`
- Reconnect interval: `5.0` 秒
- Auto connect: 关闭

## 验证是否生效

- 在 IDA Output 窗口中可看到带 `[IDA Multi Chat]` 前缀的日志。
- 在 Hub 侧 `/api/instances` 可看到该实例。

## 配置文件位置

插件配置会持久化到：

- `ida_multi_chat/.hub_config.json`

## 常见问题

- 菜单未显示：
  - 确认 `ida_multi_chat_entry.py` 和 `ida_multi_chat/` 都在 IDA `plugins` 目录。
  - 复制后重启 IDA。
- 连接失败：
  - 检查 Settings 中 Hub 主机和端口。
  - 检查网络连通性和防火墙。
- 执行超时或无返回：
  - 先确认该 IDA 实例仍在 Hub `/api/instances` 中。
  - 先用更小脚本重试。
