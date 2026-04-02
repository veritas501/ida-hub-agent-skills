[根目录](../CLAUDE.md) > **ida_plugins**

## 模块职责

`ida_plugins` 提供 IDA Pro 侧插件实现，负责：
- 在 IDA 中提供菜单入口与设置界面
- 通过 WebSocket 将本地 IDA 实例注册到 Hub
- 接收 Hub 下发脚本并在 IDA 主线程执行
- 回传执行结果与实例元信息

## 入口与启动

- 入口文件：`ida_multi_chat_entry.py`（`PLUGIN_ENTRY()`）
- 主实现：`ida_multi_chat/plugin.py`（`IDAMultiChatPlugin`）
- 核心执行器：`ida_multi_chat/core.py`（`IDAScriptExecutor`）

## 对外接口

- IDA 菜单路径：`Edit/IDA Multi Chat/Connect|Disconnect|Settings`
- Hub WebSocket：`ws://<host>:<port>/ws?token=<token>`
- 协议消息：`register` / `register_ack` / `execute` / `execute_result`

## 关键依赖与配置

- Python 依赖：`websocket-client`、`ida-domain`（`requirements.txt`）
- 配置持久化：`ida_multi_chat/.hub_config.json`
- 配置编码：`idahub://`（`ida_multi_chat/ida_config.py`）

## 数据模型

- 连接配置：`HubConfig(config_string, reconnect_interval, auto_connect)`
- 执行结果：`ExecutionResult(success, output, error)`
- 实例 ID：由文件名规范化 + 3 位随机数生成

## 测试与质量

- 当前仓库中未发现该模块独立自动化测试目录
- 质量保障主要依赖：
  - `plugin.py` 的菜单/生命周期封装
  - `core.py` 的输出预算与异常回传
  - `hub_client.py` 的注册超时与重连逻辑

## 常见问题 (FAQ)

1. 无法连接 Hub：
   - 检查 `idahub://` 配置是否可解码
   - 确认 Hub `/healthz` 可访问
   - 确认 token 未过期/未填错

2. 执行脚本无输出：
   - 检查脚本是否使用 `print()`
   - 检查输出是否被预算截断（有截断提示）

3. 实例不可见：
   - 检查是否成功收到 `register_ack`
   - 检查 Hub 端用户隔离（token 作用域）

## 相关文件清单

- `ida_multi_chat_entry.py`
- `ida_multi_chat/plugin.py`
- `ida_multi_chat/hub_client.py`
- `ida_multi_chat/core.py`
- `ida_multi_chat/config_persistence.py`
- `ida_multi_chat/ida_config.py`
- `requirements.txt`

## 变更记录 (Changelog)

- 2026-03-16 17:52:54：初始化模块级 AI 上下文文档（入口/接口/配置/测试缺口）。
