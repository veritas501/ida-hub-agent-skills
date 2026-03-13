---
name: ida
description: IDA Pro 逆向分析助手，通过 HTTP API 与远程 IDA Hub Server 交互。用于二进制分析、函数分析、字符串搜索、交叉引用、反编译等逆向工程任务。
---

# IDA Hub Skill

通过 HTTP API 与远程 IDA Hub Server 交互，执行逆向分析任务。

## 上下文说明

- 当用户说"这个项目"、"当前二进制"、"这个文件"、"IDA 数据库"时，指远程 IDA 实例中打开的数据库
- 代码在 IDA 进程中执行，通过 `db` 对象访问数据库（ida-domain API）
- 使用 `print()` 输出结果，结果会返回给你

## 环境要求

- `curl` 命令
- `jq` 命令（JSON 格式化）

## 首次使用流程

**重要**：你不知道 Hub Server 的地址和实例 ID，必须先询问用户或让用户提供。

1. **获取 Hub 地址**：用户从 Hub Web 界面的 `/config` 页面复制地址（如 `http://192.168.1.100:10086`）
2. **列出实例**：执行 curl 命令查看已连接的 IDA 实例
3. **选择实例**：根据 `instance_id` 和 `module` 确定目标实例

## 使用方式

### 列出实例

```bash
curl -s "${IDA_HUB_URL}/api/instances" | jq .
```

**注意**：将 `${IDA_HUB_URL}` 替换为用户提供的 Hub 地址。

### 执行代码

```bash
curl -s -X POST "${IDA_HUB_URL}/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id": "<INSTANCE_ID>", "code": "<CODE>"}' | jq .
```

**参数**：
- `<INSTANCE_ID>`: 目标 IDA 实例 ID
- `<CODE>`: 要执行的 Python 代码

**代码转义示例**：
```bash
# 简单代码
curl -s -X POST "http://192.168.1.100:10086/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id": "a1b2c3d4", "code": "print(len(db.functions))"}' | jq .

# 多行代码
curl -s -X POST "http://192.168.1.100:10086/api/execute" \
  -H 'Content-Type: application/json' \
  -d @- << 'EOF' | jq .
{"instance_id": "a1b2c3d4", "code": "for func in db.functions:\n    name = db.functions.get_name(func)\n    print(f'{name}: 0x{func.start_ea:08X}')"}
EOF
```

## 代理循环（Agentic Loop）

这是一个自主循环：

1. 你输出代码（通过 curl 调用）
2. 代码在远程 IDA 中执行
3. 你看到执行结果（或错误）在 JSON 响应的 `output` 或 `error` 字段
4. 根据结果决定下一步操作
5. 持续直到任务完成

**响应格式**：
```json
{
  "success": true,
  "output": "函数列表...",
  "error": null,
  "request_id": "abc123"
}
```

## 执行上下文

代码在 IDA 进程中执行，提供以下上下文：

| 变量 | 类型 | 说明 |
|------|------|------|
| `db` | Database | ida-domain 数据库对象（主要使用） |
| `idaapi` | module | IDA 原生 API |
| `idautils` | module | IDA 工具函数 |
| `idc` | module | IDA 核心函数 |
| `ida_kernwin` | module | IDA UI 交互（获取光标、跳转等） |

---

# 参考文档

当需要更详细的 API 信息时，请读取以下文档：

- **[references/USAGE.md](references/USAGE.md)** - 当需要更多代码模式、技巧和故障排除时读取
- **[references/API_REFERENCE.md](references/API_REFERENCE.md)** - 当需要查找特定 API 方法的完整签名和参数时读取
- **[references/IDA.md](references/IDA.md)** - 当用户提到"当前位置"、"选中范围"、"跳转"等 UI 交互时读取

---

# 快速参考

## Database 属性

| 属性 | 说明 |
|------|------|
| `db.path` | 输入文件路径 |
| `db.module` | 模块名 |
| `db.base_address` | 镜像基址 |
| `db.architecture` | 处理器架构 |
| `db.bitness` | 位数（32 或 64） |

## Entity Handlers

| 处理器 | 说明 |
|--------|------|
| `db.functions` | 函数操作 |
| `db.instructions` | 指令操作 |
| `db.segments` | 段操作 |
| `db.bytes` | 字节操作 |
| `db.strings` | 字符串操作 |
| `db.names` | 名称操作 |
| `db.comments` | 注释操作 |
| `db.xrefs` | 交叉引用操作 |
| `db.types` | 类型操作 |

## 常用模式

### 遍历函数

```python
for func in db.functions:
    name = db.functions.get_name(func)
    print(f"{name}: 0x{func.start_ea:08X}")
```

### 查找函数

```python
func = db.functions.get_function_by_name("main")
if func:
    print(f"Found at 0x{func.start_ea:08X}")
```

### 遍历字符串

```python
for s in db.strings:
    print(f"0x{s.address:08X}: {s}")
```

### 交叉引用

```python
for xref in db.xrefs.to_ea(0x401000):
    print(f"From 0x{xref.from_ea:08X}")
```

### 反编译

```python
func = db.functions.get_function_by_name("main")
if func:
    lines = db.functions.get_pseudocode(func)
    print("\n".join(lines))
```

### IDA UI 交互

```python
import ida_kernwin

# 获取光标位置
ea = ida_kernwin.get_screen_ea()
print(f"Current address: 0x{ea:X}")

# 获取选中范围
result = ida_kernwin.read_range_selection(None)
if result[0]:
    start_ea, end_ea = result[1], result[2]
    print(f"Selection: 0x{start_ea:X} - 0x{end_ea:X}")

# 跳转
ida_kernwin.jumpto(0x401000)
```

---

# 错误处理

| HTTP 状态码 | 说明 | 处理建议 |
|-------------|------|----------|
| 404 | 实例不存在 | 列出实例确认 instance_id |
| 504 | 执行超时 | 简化代码或分步执行 |
| 503 | 连接错误 | IDA 实例可能已断开 |
| 500 | 服务器错误 | 检查 Hub Server 日志 |

---

# 安全注意事项

- Hub Server 绑定 0.0.0.0，仅在可信局域网使用
- 无认证机制，不要暴露到公网
- 代码在 IDA 进程中执行，具有完整 IDA API 权限
- 仅连接可信的 Hub Server
