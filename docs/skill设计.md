# Claude Code Skill 设计文档

## 1. 概述

为 Claude Code 提供 IDA Hub 交互能力，通过 HTTP API 与 Hub Server 通信。

## 2. Skill 文件位置

```
~/.claude/skills/ida/skill.md
```

## 3. Skill 定义

```markdown
# IDA Hub Skill

通过 HTTP API 与远程 IDA Hub Server 交互，执行逆向分析任务。

## 使用方式

/ida <command> [args]

## 命令

- `/ida list` - 列出所有已连接的 IDA 实例
- `/ida info <instance_id>` - 获取实例数据库信息
- `/ida exec <instance_id> <code>` - 执行 Python 代码

## 示例

/ida list
/ida info a1b2c3d4
/ida exec a1b2c3d4 "print(len(db.functions))"
/ida exec a1b2c3d4 "for func in db.functions:\n    print(db.functions.get_name(func))"
```

## 4. 环境变量配置

在 `~/.bashrc` 或 `~/.zshrc` 中配置：

```bash
export IDA_HUB_URL="http://192.168.1.100:8765"
```

## 5. 命令实现

### 5.1 /ida list

**功能**: 列出所有已连接的 IDA 实例

**实现**:
```bash
curl -s "${IDA_HUB_URL:-http://localhost:8765}/api/instances" | jq .
```

**输出示例**:
```json
{
  "instances": [
    {
      "instance_id": "a1b2c3d4",
      "module": "calc.exe",
      "architecture": "x86_64",
      "functions_count": 150,
      "connected_at": "2026-03-12T10:30:00Z"
    }
  ]
}
```

### 5.2 /ida info \<instance_id\>

**功能**: 获取指定实例的数据库详细信息

**实现**:
```bash
curl -s "${IDA_HUB_URL:-http://localhost:8765}/api/db-info/$INSTANCE_ID" | jq .
```

**输出示例**:
```json
{
  "instance_id": "a1b2c3d4",
  "module": "calc.exe",
  "path": "C:\\analyses\\calc.exe.i64",
  "architecture": "x86_64",
  "bitness": 64,
  "base_address": "0x140000000",
  "functions_count": 150,
  "strings_count": 500,
  "segments": [".text", ".data", ".rdata"]
}
```

### 5.3 /ida exec \<instance_id\> \<code\>

**功能**: 在指定实例执行 Python 代码

**实现**:
```bash
# URL 编码的 JSON payload
PAYLOAD=$(echo "{\"instance_id\": \"$INSTANCE_ID\", \"code\": \"$CODE\"}" | jq -c .)

curl -s -X POST "${IDA_HUB_URL:-http://localhost:8765}/api/execute" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" | jq .
```

**输出示例**:
```json
{
  "success": true,
  "output": "150\n",
  "error": null
}
```

## 6. Python 辅助脚本

创建 `~/bin/ida_client.py` 供 Claude Code 调用：

```python
#!/usr/bin/env python3
"""IDA Hub Client - Claude Code 辅助工具"""

import os
import sys
import json
import requests

HUB_URL = os.environ.get("IDA_HUB_URL", "http://localhost:8765")

def list_instances():
    """列出所有实例"""
    resp = requests.get(f"{HUB_URL}/api/instances")
    resp.raise_for_status()
    return resp.json()

def get_info(instance_id: str):
    """获取实例信息"""
    resp = requests.get(f"{HUB_URL}/api/db-info/{instance_id}")
    resp.raise_for_status()
    return resp.json()

def execute(instance_id: str, code: str):
    """执行代码"""
    resp = requests.post(
        f"{HUB_URL}/api/execute",
        json={"instance_id": instance_id, "code": code}
    )
    resp.raise_for_status()
    return resp.json()

def main():
    if len(sys.argv) < 2:
        print("Usage: ida_client.py <command> [args]")
        print("Commands: list, info <id>, exec <id> <code>")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "list":
        result = list_instances()
    elif cmd == "info" and len(sys.argv) >= 3:
        result = get_info(sys.argv[2])
    elif cmd == "exec" and len(sys.argv) >= 4:
        result = execute(sys.argv[2], sys.argv[3])
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
```

## 7. Skill 完整实现

```markdown
# IDA Hub Skill

通过 HTTP API 与远程 IDA Hub Server 交互。

## 环境要求

- `curl` 命令
- `jq` 命令（JSON 格式化）
- 环境变量 `IDA_HUB_URL`（可选，默认 http://localhost:8765）

## 使用方式

/ida <command> [args]

## 命令

### /ida list

列出所有已连接的 IDA 实例。

```bash
curl -s "${IDA_HUB_URL:-http://localhost:8765}/api/instances" | jq .
```

### /ida info <instance_id>

获取实例数据库详细信息。

```bash
curl -s "${IDA_HUB_URL:-http://localhost:8765}/api/db-info/$INSTANCE_ID" | jq .
```

### /ida exec <instance_id> <code>

在指定实例执行 Python 代码。

```bash
PAYLOAD=$(cat <<EOF
{"instance_id": "$INSTANCE_ID", "code": "$CODE"}
EOF
)

curl -s -X POST "${IDA_HUB_URL:-http://localhost:8765}/api/execute" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" | jq .
```

## 使用示例

# 列出实例
/ida list

# 查看实例信息
/ida info a1b2c3d4

# 获取函数数量
/ida exec a1b2c3d4 "print(len(db.functions))"

# 遍历函数
/ida exec a1b2c3d4 "for f in db.functions: print(hex(f.start_ea), db.functions.get_name(f))"

# 搜索字符串
/ida exec a1b2c3d4 "for s in db.strings: print(hex(s.ea), s)"
```

## 8. 常用代码片段

### 8.1 函数分析

```python
# 列出所有函数名和地址
for func in db.functions:
    print(hex(func.start_ea), db.functions.get_name(func))

# 获取函数信息
func = db.functions.get_at(0x140001000)
print(func.name, func.size, func.flags)
```

### 8.2 字符串搜索

```python
# 搜索包含 "password" 的字符串
for s in db.strings:
    if "password" in str(s).lower():
        print(hex(s.ea), s)
```

### 8.3 交叉引用

```python
# 获取地址的交叉引用
for xref in db.xrefs.get_xrefs_to(0x140001000):
    print(hex(xref.frm), hex(xref.to), xref.type)
```

### 8.4 反汇编

```python
# 反汇编指定地址
for insn in db.disasm(0x140001000, 20):
    print(hex(insn.ea), insn.mnem, insn.op_str)
```

## 9. 错误处理

| HTTP 状态码 | 说明 | 处理建议 |
|-------------|------|----------|
| 404 | 实例不存在 | 检查 instance_id，使用 /ida list 确认 |
| 504 | 执行超时 | 代码执行时间过长，简化代码或分步执行 |
| 500 | 服务器错误 | 检查 Hub Server 日志 |

## 10. 安全考虑

- Hub Server 默认绑定 0.0.0.0，仅在可信局域网使用
- 无认证机制，不要暴露到公网
- 代码在 IDA 进程中执行，具有完整 IDA API 权限
