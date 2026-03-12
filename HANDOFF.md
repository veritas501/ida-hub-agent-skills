# Handoff - IDA Multi Chat Plugin -> Hub Development

## 1. 当前状态

当前仓库已完成 **IDA 插件部分** 的首版实现，Hub 部分尚未开始编码。

最近两次提交：

- `a9c2d09` `feat: add ida multi chat plugin`
- `c0bd98f` `chore: add repo gitignore and agent link`

当前工作区干净（`git status` 无输出）。

## 2. 插件交付内容

插件目录结构（已提交）：

```text
ida_plugins/
├── ida_multi_chat_entry.py
├── requirements.txt
└── ida_multi_chat/
    ├── __init__.py
    ├── config_persistence.py
    ├── core.py
    ├── hub_client.py
    └── plugin.py
```

关键说明：

- 入口文件为 `ida_multi_chat_entry.py`（薄入口）
- 主逻辑在 `ida_multi_chat/plugin.py`
- 执行模型为 `WebSocket 后台线程收消息 + ida_kernwin.execute_sync 主线程执行代码`
- 配置文件落在：`ida_plugins/ida_multi_chat/.hub_config.json`
- 依赖写在：`ida_plugins/requirements.txt`

## 3. 菜单与入口策略

采用了参考 `ref/gepetto` 的挂载方式：**每个 action 使用完整菜单路径直接挂载**。

当前菜单路径：

- `Edit/IDA Multi Chat/Connect`
- `Edit/IDA Multi Chat/Disconnect`
- `Edit/IDA Multi Chat/Settings`

插件类属性（兼容 IDA 9.2）：

- `wanted_name = "IDA Multi Chat"`（不能为空，否则会报 `Missing or invalid attribute 'wanted_name'`）
- `flags = idaapi.PLUGIN_KEEP | getattr(idaapi, "PLUGIN_HIDE", 0)`

日志策略：

- 所有日志前缀统一由 `_log()` 注入：`[IDA Multi Chat]`
- 调用点不重复拼前缀

## 4. 重要实现约束（已按要求收敛）

`ida_multi_chat` 包内已移除 `ImportError` 兜底，假设运行环境就是 IDA：

- `core.py` 直接导入：`idaapi / idc / idautils / ida_kernwin / ida_domain`
- `hub_client.py` 直接导入：`idaapi / idc / websocket`

这意味着：

- 如果 IDA Python 环境缺依赖，会在导入阶段直接报错（符合当前明确要求）

## 5. 运行依赖

`ida_plugins/requirements.txt`：

- `websocket-client>=1.7.0`
- `ida-domain`

建议在 IDA 自带 Python 环境执行安装。

## 6. 已知风险与待验证点

- 未在真实 Hub 后端联调（目前仅完成插件侧协议实现）
- `ida-domain` 的 `Database` 构造方式做了兼容探测（`Database()` / `current()` / `open()`），仍建议在目标 IDA 版本实测
- IDA 菜单显示在不同版本可能存在差异，当前实现已按 `ref/gepetto` 路径方式统一

## 7. Hub 开发建议起步顺序

建议按以下顺序落地，减少返工：

1. 先建 `hub/server` 最小骨架：`main.py`, `models.py`, `registry.py`, `ws_handler.py`, `routes.py`
2. 先实现 `WS /ws` 注册通道：接收 `register`，回 `register_ack`
3. 实现 `GET /api/instances`，先把注册表打通
4. 实现 `POST /api/execute`：
   - Hub -> IDA: `{"type":"execute","request_id","code"}`
   - IDA -> Hub: `{"type":"execute_result","request_id","success","output","error"}`
5. 最后补 `GET /api/config` 和前端集成

## 8. Hub 与插件协议对齐点（必须保持一致）

IDA -> Hub：

- `register`
- `execute_result`

Hub -> IDA：

- `register_ack`
- `execute`

字段关键约束：

- `instance_id`: 字符串（当前插件默认 8 位 hex）
- `request_id`: 必须原样透传，作为 execute/result 匹配键
- `output` / `error`: 文本字段，不要省略 key（可为 `null`）

## 9. 下一位开发者的第一步检查清单

- 在 Windows IDA 插件目录确认仅放：
  - `ida_multi_chat_entry.py`
  - `ida_multi_chat/`
- 安装依赖后重启 IDA，确认 `Edit/IDA Multi Chat/*` 三个菜单项出现
- 启动最小 Hub（只做 register/ack），验证插件可连接并拿到 `instance_id`

