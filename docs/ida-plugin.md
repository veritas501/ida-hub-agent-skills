# IDA 插件设计文档

## 1. 概述

IDA Pro 插件，负责连接 Hub Server 并执行远程下发的 Python 代码。

## 2. 文件结构

```
ida_claw/
└── ida_plugins/
    ├── ida_multi_chat_entry.py        # 插件入口（轻量）
    └── ida_multi_chat/
        ├── __init__.py                # PLUGIN_ENTRY 导出
        ├── plugin.py                  # 菜单与生命周期
        ├── hub_client.py              # Hub WebSocket 客户端
        ├── core.py                    # 主线程安全执行器
        └── config_persistence.py      # 配置持久化
```

## 3. 连接行为

- **默认不连接**：插件加载后默认不自动连接 Hub
- **手动连接**：通过菜单按钮连接/断开
- **可选自动连接**：`Settings` 中可开启 `auto_connect`
- **自动连接失败策略**：启动阶段自动连接失败时不进行无限重连
- **配置持久化**：参数保存在插件目录的 JSON 文件中

## 4. 菜单设计

### 4.1 菜单项

| 菜单项 | 快捷键 | 说明 |
|--------|--------|------|
| Connect | - | 连接到 Hub Server |
| Disconnect | - | 断开当前连接 |
| Settings | - | 打开参数配置对话框 |

### 4.2 菜单状态

| 状态 | Connect | Disconnect | Settings |
|------|---------|------------|----------|
| 未连接 | ✓ 启用 | ✗ 禁用 | ✓ 启用 |
| 已连接 | ✗ 禁用 | ✓ 启用 | ✓ 启用 |
| 连接中 | ✗ 禁用 | ✗ 禁用 | ✓ 启用 |

## 5. 配置管理

### 5.1 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `host` | `127.0.0.1` | Hub Server 主机地址 |
| `port` | `10086` | Hub Server 端口 |
| `reconnect_interval` | `5.0` | 重连间隔（秒） |
| `auto_connect` | `false` | 插件加载后是否自动连接 |

### 5.2 URL 拼接规则

```
WebSocket URL = ws://{host}:{port}/ws
```

示例：
- `ws://127.0.0.1:10086/ws`
- `ws://192.168.1.100:10086/ws`

### 5.3 配置持久化

**文件位置**：`<插件目录>/.hub_config.json`

**文件格式**：
```json
{
    "host": "127.0.0.1",
    "port": 10086,
    "reconnect_interval": 5.0,
    "auto_connect": false
}
```

### 5.4 配置对话框 Form

```
┌─────────────────────────────────────┐
│  Hub Settings                       │
├─────────────────────────────────────┤
│                                     │
│  Host:        [127.0.0.1        ]   │
│  Port:        [10086            ]   │
│                                     │
│  Advanced Settings                  │
│  Reconnect:   [5.0   ] seconds      │
│  Auto Connect [ ]                   │
│                                     │
│            [Save]  [Cancel]         │
└─────────────────────────────────────┘
```

## 6. Hub 客户端设计 (ida_multi_chat/hub_client.py)

### 6.1 核心类

| 类名 | 职责 |
|------|------|
| `HubConfig` | 连接配置（host、port、重连间隔、auto_connect） |
| `IDAHubClient` | WebSocket 客户端，处理连接、注册、消息收发 |

### 6.2 主要方法

| 方法 | 说明 |
|------|------|
| `connect()` | 建立到 Hub 的 WebSocket 连接 |
| `disconnect()` | 断开连接 |
| `_build_ws_url()` | 从 host:port 拼接 WebSocket URL |
| `_get_instance_info()` | 获取当前 IDA 实例信息（用于注册） |
| `_handle_execute()` | 处理 Hub 下发的执行请求 |
| `_execute_code()` | 执行 Python 代码并捕获输出 |
| `_create_context()` | 创建代码执行上下文（db、idaapi 等） |

### 6.3 连接保活

使用 **WebSocket 协议自带的 Ping/Pong 机制**，无需应用层心跳：

```
websocket-client 配置：
  ping_interval = 30    # 每 30 秒发送 WebSocket Ping
  ping_timeout  = 10    # 10 秒内未收到 Pong 则断开
```

### 6.4 实例信息（注册时发送）

```python
{
    "module": "calc.exe",
    "db_path": "C:\\analyses\\calc.exe.i64",
    "architecture": "x86_64",
    "platform": "windows"
}
```

| 字段 | 说明 |
|------|------|
| `module` | 当前分析的模块名 |
| `db_path` | IDA 数据库文件路径 |
| `architecture` | 目标架构（x86_64、arm、aarch64 等） |
| `platform` | 主机系统类型（`windows`、`linux`、`darwin`） |

## 7. 插件入口与生命周期 (ida_multi_chat_entry.py + ida_multi_chat/plugin.py)

### 7.1 生命周期

```
IDA 启动
    │
    ▼
plugin.init() ──► 加载配置
    │
    ▼
用户点击 Connect
    │
    ▼
hub_client.connect() ──► WebSocket 连接 ──► 发送 register 消息
    │
    ▼
收到 register_ack ──► 连接成功，显示状态
    │
    ▼
用户关闭 IDA
    │
    ▼
plugin.term() ──► hub_client.disconnect()
```

## 7.2 Instance ID 规则

- 当前规则：`<root_filename_stem_normalized>_<3digit_random>`
- 示例：`libminkdescriptor_013`
- 用途：避免同机多开 IDA 时实例 ID 冲突

## 8. 代码执行机制

### 8.1 线程安全约束

**关键问题**：IDA Pro 的所有 API 操作必须在主线程执行。WebSocket 消息在后台线程接收，不能直接调用 IDA API。

**解决方案**：使用 `ida_kernwin.execute_sync()` 将代码执行调度到主线程。

```
WebSocket 线程                    主线程
      │                             │
      │  收到 execute 消息          │
      │                             │
      │  execute_sync(callback) ───►│
      │                             │  执行代码
      │                             │  捕获输出
      │  ◄──── 返回结果 ────────────│
      │                             │
      ▼                             ▼
```

### 8.2 ScriptExecutor 设计

```
┌─────────────────────────────────────────────────────────┐
│                    IDAHubClient                         │
│                                                         │
│  WebSocket 接收 execute 消息                            │
│            │                                            │
│            ▼                                            │
│  script_executor(code)  ◄─── 注入的执行器               │
│            │                                            │
│            ▼                                            │
│  execute_sync(run_script, MFF_FAST)                     │
│            │                                            │
│            ▼                                            │
│  ┌─────────────────────────────────────┐               │
│  │ run_script():                       │               │
│  │   1. 重定向 stdout → StringIO       │               │
│  │   2. exec(code, context)            │  主线程执行    │
│  │   3. 捕获输出/异常                   │               │
│  │   4. 返回结果                       │               │
│  └─────────────────────────────────────┘               │
│            │                                            │
│            ▼                                            │
│  发送 execute_result 消息                               │
└─────────────────────────────────────────────────────────┘
```

### 8.3 执行器接口

```python
# 可注入的执行器签名
ScriptExecutor = Callable[[str], str]

# 输入: Python 代码字符串
# 输出: stdout 捕获的输出（成功时）或错误信息（失败时）
```

### 8.4 执行上下文

代码执行时提供的上下文变量：

| 变量 | 类型 | 说明 |
|------|------|------|
| `db` | `Database` | ida-domain 数据库对象 |
| `idaapi` | module | IDA API |
| `idautils` | module | IDA 工具函数 |
| `idc` | module | IDA 核心函数 |
| `ida_kernwin` | module | IDA UI 交互（获取光标、跳转等） |

### 8.5 执行标志

| 标志 | 说明 |
|------|------|
| `MFF_FAST` | 快速执行，不等待 UI 刷新 |
| `MFF_READ` | 只读操作 |
| `MFF_WRITE` | 写操作（会刷新 UI） |

### 8.6 执行流程

```
1. WebSocket 收到 {"type": "execute", "request_id": "xxx", "code": "..."}
                    │
                    ▼
2. 调用 script_executor(code)
                    │
                    ▼
3. execute_sync() 调度到主线程
                    │
                    ▼
4. 主线程执行:
   ├── old_stdout = sys.stdout
   ├── sys.stdout = StringIO()
   ├── try:
   │       exec(code, {"db": db, "ida_kernwin": ida_kernwin, ...})
   │       output = sys.stdout.getvalue()
   │   except Exception as e:
   │       output = f"Error: {e}"
   │   finally:
   │       sys.stdout = old_stdout
                    │
                    ▼
5. 发送 {"type": "execute_result", "request_id": "xxx", "success": bool, "output": "..."}
```

## 9. db 对象 (ida-domain)

使用 `ida-domain` 库提供的统一 API，而不是直接使用 IDA 原生 API。

### 9.1 Database 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `db.path` | str | 输入文件路径 |
| `db.module` | str | 模块名 |
| `db.base_address` | ea_t | 镜像基址 |
| `db.architecture` | str | 处理器架构 |
| `db.bitness` | int | 位数（32 或 64） |

### 9.2 Entity Handlers

| 处理器 | 说明 |
|--------|------|
| `db.functions` | 函数操作 |
| `db.instructions` | 指令操作 |
| `db.segments` | 段操作 |
| `db.bytes` | 字节操作 |
| `db.strings` | 字符串操作 |
| `db.names` | 名称操作 |
| `db.xrefs` | 交叉引用操作 |

### 9.3 常用模式

```python
# 遍历函数
for func in db.functions:
    name = db.functions.get_name(func)
    print(f"{name}: 0x{func.start_ea:08X}")

# 按名称查找
func = db.functions.get_function_by_name("main")

# 交叉引用
for xref in db.xrefs.to_ea(0x401000):
    print(f"From 0x{xref.from_ea:08X}")

# 字符串
for s in db.strings:
    print(f"0x{s.address:08X}: {s}")
```

## 10. WebSocket 消息协议

### 10.1 发送消息（IDA → Hub）

| 类型 | 触发时机 | 结构 |
|------|----------|------|
| `register` | 连接建立时 | `{"type": "register", "instance_id": "xxx", "info": {...}}` |
| `execute_result` | 代码执行完成 | `{"type": "execute_result", "request_id": "xxx", "success": bool, "output": "...", "error": "..."}` |

### 10.2 接收消息（Hub → IDA）

| 类型 | 处理方式 | 结构 |
|------|----------|------|
| `register_ack` | 标记连接成功 | `{"type": "register_ack", "instance_id": "xxx"}` |
| `execute` | 执行代码并返回结果 | `{"type": "execute", "request_id": "xxx", "code": "..."}` |

## 11. 错误处理

| 错误 | 原因 | 处理 |
|------|------|------|
| Connection refused | Hub 未启动 | 提示用户检查 Hub Server |
| Register timeout | 网络延迟 | 自动重连 |
| WebSocket closed | 连接断开 | 自动重连机制 |
| Execute error | 代码执行异常 | 返回错误信息和堆栈 |

## 12. 依赖

```bash
pip install websocket-client ida-domain
```

> 注意：IDA Pro 自带的 Python 环境需要手动安装此依赖。

## 13. 安装

复制文件到 IDA 插件目录：

```
C:\Program Files\IDA 8.3\plugins\
或
%APPDATA%\Hex-Rays\IDA Pro\plugins\
```

## 14. 安全注意事项

- 代码在 IDA 进程中执行，具有完整 IDA API 权限
- 仅连接可信的 Hub Server
- 不要在不受信任的网络环境中使用
