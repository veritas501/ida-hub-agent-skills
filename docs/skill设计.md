# Claude Code Skill 设计文档

## 1. 概述

为 Claude Code 提供 IDA Hub 交互能力，通过 HTTP API 与 Hub Server 通信，实现远程逆向分析。

## 2. 设计理念

借鉴 ida-chat-plugin 的**代理循环（Agentic Loop）**模式：

```
Claude Code 输出代码 → Hub Server 转发 → IDA 执行 → 返回结果 → Claude Code 继续分析
```

Agent 自主决定何时需要查询数据库，持续执行直到任务完成。

## 3. Skill 文件位置

```
~/.claude/skills/ida/skill.md
```

## 4. Skill 定义

```markdown
# IDA Hub Skill

通过 HTTP API 与远程 IDA Hub Server 交互，执行逆向分析任务。

## 上下文说明

- 当用户说"这个项目"、"当前二进制"、"这个文件"时，指 IDA 中打开的数据库
- 代码在 IDA 进程中执行，通过 `db` 对象访问数据库
- 使用 `print()` 输出结果，结果会返回给你

## 首次使用

**重要**：你不知道 Hub Server 的地址，必须询问用户：

> "请提供 IDA Hub Server 的地址（如 http://192.168.1.100:10086），你可以从 Hub 前端的 Config 页面复制。"

用户会从 Hub Web 界面的 `/config` 页面复制配置信息。

## 环境要求

- `curl` 命令
- `jq` 命令（JSON 格式化）

## 使用方式

/ida <command> [args]

**注意**：命令中的 `${IDA_HUB_URL}` 需要替换为用户提供的实际地址。

## 命令

### /ida list

列出所有已连接的 IDA 实例。

```bash
curl -s "<HUB_URL>/api/instances" | jq .
```

### /ida exec <instance_id> <code>

在指定实例执行 Python 代码。

```bash
curl -s -X POST "<HUB_URL>/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id": "<INSTANCE_ID>", "code": "<CODE>"}' | jq .
```

**注意**：将 `<HUB_URL>` 替换为用户提供的 Hub 地址。

## 代理循环

这是一个自主循环：
1. 你输出代码
2. 代码在 IDA 中执行
3. 你看到执行结果（或错误）
4. 根据结果决定下一步操作
5. 持续直到任务完成

## 使用示例

# 首次使用：询问用户 Hub 地址
# 用户从 Hub 前端 /config 页面复制地址

# 列出实例
curl -s "http://192.168.1.100:10086/api/instances" | jq .

# 获取函数数量（替换 instance_id）
curl -s -X POST "http://192.168.1.100:10086/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id": "a1b2c3d4", "code": "print(len(db.functions))"}' | jq .
```

## 5. 执行上下文

代码在 IDA 进程中执行，提供以下上下文：

| 变量 | 类型 | 说明 |
|------|------|------|
| `db` | Database | ida-domain 数据库对象 |
| `idaapi` | module | IDA API |
| `idautils` | module | IDA 工具函数 |
| `idc` | module | IDA 核心函数 |

### 5.1 Database 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `db.path` | str | 输入文件路径 |
| `db.module` | str | 模块名 |
| `db.base_address` | ea_t | 镜像基址 |
| `db.architecture` | str | 处理器架构 |
| `db.bitness` | int | 位数（32 或 64） |

### 5.2 Entity Handlers

| 处理器 | 说明 |
|--------|------|
| `db.functions` | 函数操作 |
| `db.instructions` | 指令操作 |
| `db.segments` | 段操作 |
| `db.bytes` | 字节操作 |
| `db.strings` | 字符串操作 |
| `db.names` | 名称操作 |
| `db.comments` | 注释操作 |
| `db.entries` | 入口点操作 |
| `db.xrefs` | 交叉引用操作 |
| `db.types` | 类型操作 |

## 6. 常用 API 模式

### 6.1 函数操作

```python
# 遍历所有函数
for func in db.functions:
    name = db.functions.get_name(func)
    print(f"{name}: 0x{func.start_ea:08X}")

# 按名称查找
func = db.functions.get_function_by_name("main")

# 按地址查找
func = db.functions.get_at(0x401000)

# 获取调用关系
callers = db.functions.get_callers(func)
callees = db.functions.get_callees(func)

# 获取伪代码
pseudo = db.functions.get_pseudocode(func)
```

### 6.2 字符串操作

```python
# 遍历所有字符串
for s in db.strings:
    print(f"0x{s.address:08X}: {s}")

# 范围内字符串
for s in db.strings.get_between(0x401000, 0x500000):
    print(s)
```

### 6.3 交叉引用

```python
# 引用到某地址
for xref in db.xrefs.to_ea(0x401000):
    print(f"From 0x{xref.from_ea:08X}")

# 从某地址的引用
for xref in db.xrefs.from_ea(0x401000):
    print(f"To 0x{xref.to_ea:08X}")

# 代码引用
for ea in db.xrefs.code_refs_to_ea(0x401000):
    print(f"Code ref from 0x{ea:08X}")

# 调用关系
for ea in db.xrefs.calls_to_ea(0x401000):
    print(f"Called from 0x{ea:08X}")
```

### 6.4 字节操作

```python
# 读取
byte_val = db.bytes.get_byte_at(0x401000)
dword_val = db.bytes.get_dword_at(0x401000)
data = db.bytes.get_bytes_at(0x401000, 100)

# 搜索
ea = db.bytes.find_bytes_between(b"\x55\x8B\xEC")
all_matches = db.bytes.find_binary_sequence(b"\x90\x90")
```

### 6.5 段操作

```python
for seg in db.segments:
    name = db.segments.get_name(seg)
    size = db.segments.get_size(seg)
    print(f"{name}: 0x{seg.start_ea:08X} ({size} bytes)")
```

## 7. IDA UI 交互（仅 IDA 内执行时可用）

当用户说"当前位置"、"选中的代码"等时，使用 `ida_kernwin`：

| 函数 | 说明 |
|------|------|
| `ida_kernwin.get_screen_ea()` | 获取光标地址 |
| `ida_kernwin.jumpto(ea)` | 跳转到地址 |
| `ida_kernwin.read_range_selection(None)` | 获取选中范围 |

```python
import ida_kernwin

# 获取当前位置
ea = ida_kernwin.get_screen_ea()
print(f"Current address: 0x{ea:X}")

# 获取选中范围
result = ida_kernwin.read_range_selection(None)
if result[0]:
    start_ea, end_ea = result[1], result[2]
    print(f"Selection: 0x{start_ea:X} - 0x{end_ea:X}")
```

## 8. API 调用流程

```
Claude Code                 Hub Server                IDA Instance
    │                           │                          │
    │  POST /api/execute        │                          │
    │──────────────────────────►│                          │
    │                           │   WebSocket Request      │
    │                           │─────────────────────────►│
    │                           │                          │
    │                           │                          │ Execute Code
    │                           │                          │
    │                           │   WebSocket Response     │
    │                           │◄─────────────────────────│
    │  HTTP Response            │                          │
    │◄──────────────────────────│                          │
```

## 9. 错误处理

| HTTP 状态码 | 说明 | 处理建议 |
|-------------|------|----------|
| 404 | 实例不存在 | 使用 /ida list 确认 instance_id |
| 504 | 执行超时 | 简化代码或分步执行 |
| 500 | 服务器错误 | 检查 Hub Server 日志 |

代码执行错误会在响应的 `error` 字段返回堆栈信息。

## 10. 配置来源

用户从 Hub 前端 `/config` 页面获取：
- Hub Server URL
- instance_id（从实例列表中获取）
- 可选：预生成的 curl 命令模板

## 11. 安全考虑

- Hub Server 绑定 0.0.0.0，仅在可信局域网使用
- 无认证机制，不要暴露到公网
- 代码在 IDA 进程中执行，具有完整 IDA API 权限

## 12. 参考

完整 API 参考：
- `ida-domain` 文档：https://github.com/nickcano/ida-domain
- IDA Python API：https://hex-rays.com/products/ida/support/idapython_docs/
