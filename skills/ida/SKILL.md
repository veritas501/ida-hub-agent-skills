---
name: ida
description: IDA Pro 逆向分析助手，通过 HTTP API 与远程 IDA Hub Server 交互。用于二进制分析、函数分析、字符串搜索、交叉引用、反编译等逆向工程任务。
---

# IDA Hub Skill

通过 HTTP API 与远程 IDA Hub Server 交互，执行逆向分析任务。

## 上下文说明

- 当用户说“这个项目”、“当前二进制”、“这个文件”、“IDA 数据库”时，指远程 IDA 实例中打开的数据库。
- 代码在 IDA 进程中执行，通过 `db` 对象访问数据库（ida-domain API）。
- 使用 `print()` 输出结果，结果会回到 `/api/execute` 的 `output` 字段。
- 默认目标不是“拿回原始全集”，而是在 IDA 端完成采集、过滤、聚合后，只回传摘要和必要证据。

## 环境要求

默认路径不要求 `curl` / `jq`。

推荐环境：
- 本地 Python 3
- `requests`

`curl` / `jq` 仅用于 fallback 或快速诊断。

## 首次使用流程

**重要**：你不知道 Hub Server 的地址和实例 ID，必须先询问用户或让用户提供。

推荐首次流程：
1. 获取 Hub 地址：用户从 Hub Web 界面的 `/config` 页面复制（如 `http://192.168.1.100:10086`）。
2. 用本地 Python helper 调 `/api/instances` 列出实例。
3. 根据 `instance_id`、`module`、`db_path` 选择目标实例。
4. 将分析逻辑写成独立 Python 多行脚本，通过 helper 调 `/api/execute`。

## 推荐执行方式

### 默认主路径：写文件到 `.ida_tmp/`

**默认做法**：用 Write 工具把 helper 和分析脚本写到当前工作目录的 `.ida_tmp/` 下，然后用 `python` 执行。

为什么写文件优于内联：
- 重试只需 Edit 改几行，不用重新生成整段代码。
- helper 写一次，后续所有分析脚本直接 `from ida_hub import execute`。
- 脚本文件可读、可 diff、可复用。

对于只有一两行的快速检查（如 `print(42)`），`python -c` 或 heredoc 也可以，不强制写文件。

### 首次：写 helper 文件

用 Write 工具创建 `.ida_tmp/ida_hub.py`：

```python
“””IDA Hub helper — reuse across analysis scripts.”””

import textwrap

import requests

BASE_URL = “http://127.0.0.1:10086”
INSTANCE_ID = “replace-me”  # Get from list_instances()


def list_instances(timeout=10):
    resp = requests.get(f”{BASE_URL}/api/instances”, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def execute(code, timeout=30):
    resp = requests.post(
        f”{BASE_URL}/api/execute”,
        json={“instance_id”: INSTANCE_ID, “code”: textwrap.dedent(code).strip()},
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data[“success”]:
        raise RuntimeError(data.get(“error”) or “Execution failed”)
    return data[“output”]
```

写完后用 Edit 工具把 `BASE_URL` 和 `INSTANCE_ID` 改成实际值。

### 后续：写分析脚本并执行

每个分析任务写一个独立脚本文件到 `.ida_tmp/`，然后用 Bash 执行。

用 Write 工具创建 `.ida_tmp/find_decrypt.py`：

```python
“””Find functions with 'decrypt' in name.”””

import json
import sys

sys.path.insert(0, “.ida_tmp”)
from ida_hub import execute

report = execute(“””
    import json
    rows = []
    for func in db.functions:
        name = db.functions.get_name(func)
        if name and “decrypt” in name.lower():
            rows.append({
                “name”: name,
                “start_ea”: f”0x{func.start_ea:08X}”,
                “size”: func.end_ea - func.start_ea,
            })
    rows.sort(key=lambda item: item[“size”], reverse=True)
    print(json.dumps({“match_count”: len(rows), “top”: rows[:10]}, indent=2))
“””)
print(report)
```

然后用 Bash 执行：`python .ida_tmp/find_decrypt.py`

### 推荐工作流

1. 首次：Write `.ida_tmp/ida_hub.py`，Edit 填入实际地址和实例 ID。
2. 每个分析任务：Write `.ida_tmp/<task>.py`，Bash 执行。
3. 迭代：Edit 修改脚本内容，重新执行。不要重写整个文件。
4. 远程脚本里完成采集 → 过滤 → 聚合 → 摘要输出，只回传必要结果。

## Agent loop 默认策略

默认不是”小步试探 + 原始输出回传”，而是：

- 默认”一题一脚本”：Write 脚本文件到 `.ida_tmp/` → Bash 执行 → 看结果。
- 默认先在 IDA 端完成采集、过滤、聚合，再回传摘要。
- 迭代时用 Edit 修改既有脚本文件，而不是重写整个文件或切换到内联执行。

仅在以下情况才拆步：
- 目标还不明确，第一轮结果会决定下一轮搜索路径。
- 任务存在明显超时风险，需要先缩小范围。
- 需要快速确认某个 API、地址、名称是否存在。

## 输出预算

远程脚本默认遵循以下约束：
- 不打印全集。
- 默认只输出摘要、Top N、计数、关键地址、必要证据。
- 对批量结果先排序、去重、裁剪后再打印。
- 如果结果仍然过大，先返回统计信息和下一步建议，而不是直接 `for ...: print(...)` 全量输出。

推荐模式：
- `count`
- `top_matches[:10]`
- `sorted(...)[0:20]`
- `json.dumps(summary, indent=2)`

## Fallback / 诊断路径

只有在快速连通性检查、用户明确要求、或本地 helper 不可用时，再使用 `curl`。

### 列出实例

```bash
curl -s "${IDA_HUB_URL}/api/instances"
```

### 执行代码

```bash
curl -s -X POST "${IDA_HUB_URL}/api/execute" \
  -H 'Content-Type: application/json' \
  -d '{"instance_id": "<INSTANCE_ID>", "code": "print(42)"}'
```

## 响应格式

```json
{
  "success": true,
  "output": "summary...",
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

按需读取：

- **[references/USAGE.md](references/USAGE.md)**：任务模板、推荐脚本组织方式、输出预算与排障。
- **[references/ANALYSIS_PATTERNS.md](references/ANALYSIS_PATTERNS.md)**：高频逆向分析 playbook，适合直接改造成远程复合脚本。
- **[references/API_REFERENCE.md](references/API_REFERENCE.md)**：查具体 API 方法签名与参数。
- **[references/IDA.md](references/IDA.md)**：处理“当前位置”“选中范围”“跳转”等 UI 交互。

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

### 查函数并输出摘要

```python
func = db.functions.get_function_by_name("main")
if not func:
    print("main not found")
else:
    callers = db.functions.get_callers(func)
    callees = db.functions.get_callees(func)
    print(f"name=main start=0x{func.start_ea:08X} callers={len(callers)} callees={len(callees)}")
```

### 限制字符串搜索输出规模

```python
matches = []
for s in db.strings:
    text = str(s)
    if "http" in text.lower():
        matches.append((s.address, text))

print(f"match_count={len(matches)}")
for address, text in matches[:10]:
    print(f"0x{address:08X}: {text}")
```

### IDA UI 交互

```python
import ida_kernwin

ea = ida_kernwin.get_screen_ea()
print(f"Current address: 0x{ea:X}")
```

---

# 错误处理

| HTTP 状态码 | 说明 | 处理建议 |
|-------------|------|----------|
| 404 | 实例不存在 | 重新列出实例并确认 `instance_id` |
| 504 | 执行超时 | 先缩小范围或把任务拆成两步 |
| 503 | 连接错误 | IDA 实例可能已断开 |
| 500 | 服务器错误 | 检查 Hub Server 日志 |

代码执行错误会在响应的 `error` 字段返回堆栈信息。

---

# 安全注意事项

- Hub Server 绑定 `0.0.0.0`，仅在可信局域网使用。
- 无认证机制，不要暴露到公网。
- 代码在 IDA 进程中执行，具有完整 IDA API 权限。
- 仅连接可信的 Hub Server。
