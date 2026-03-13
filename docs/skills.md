# Claude Code Skill 设计文档

## 1. 概述

为 Claude Code 提供 IDA Hub 交互能力，通过 HTTP API 与 Hub Server 通信，实现远程逆向分析。

## 2. 设计理念

默认执行模式：**本地 Python helper + 复合远程分析脚本 + 结构化摘要输出**。

```
Agent 维护本地 helper
  → 编写复合远程脚本（采集→过滤→聚合→摘要）
  → 通过 helper 调 /api/execute
  → 收到结构化摘要
  → 决定下一步或完成
```

核心原则：
- **Python helper 优先**：避免每次重试都重新生成长 `curl` 命令和 JSON 转义。
- **复合远程脚本优先**：默认"一题一脚本"，在 IDA 端完成采集、过滤、聚合后只回传摘要。
- **结构化摘要优先**：不打印全集，默认只输出 Top N、计数、关键地址、必要证据。
- **可 patch 迭代**：优先 patch 本地 helper 或脚本文件来改进，而不是重写长命令。
- **`curl` 仅作 fallback**：快速连通性检查或用户明确要求时才使用。

仅在以下情况拆步执行：
- 目标不确定，第一轮结果决定搜索方向。
- 存在明显超时风险，需先缩小范围。
- 快速确认某个 API / 地址 / 名称是否存在。

## 3. Skill 文件位置

Skill 文件放置在两个位置：

### 用户级别（所有项目可用）

```
~/.claude/skills/ida/SKILL.md
```

### 项目级别（仅本项目可用）

```
.claude/skills/ida/SKILL.md
```

**注意**：文件名必须为 `SKILL.md`（大写），且需要 YAML frontmatter：

```yaml
---
name: ida
description: 描述信息
---
```

## 4. Skill 结构

```text
skills/ida/
├── SKILL.md                          # 技能入口：默认执行策略、helper 模板、输出预算
└── references/
    ├── USAGE.md                      # 任务模板、脚本组织方式、排障
    ├── ANALYSIS_PATTERNS.md          # 高频逆向分析 playbook
    ├── API_REFERENCE.md              # ida-domain API 完整签名
    └── IDA.md                        # IDA UI 交互（光标、选中、跳转）
```

## 5. 执行上下文

代码在 IDA 进程中执行，提供以下上下文：

| 变量 | 类型 | 说明 |
|------|------|------|
| `db` | Database | ida-domain 数据库对象 |
| `idaapi` | module | IDA API |
| `idautils` | module | IDA 工具函数 |
| `idc` | module | IDA 核心函数 |
| `ida_kernwin` | module | IDA UI 交互 |

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

## 6. API 调用流程

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

## 7. 错误处理

| HTTP 状态码 | 说明 | 处理建议 |
|-------------|------|----------|
| 404 | 实例不存在 | 重新列出实例确认 instance_id |
| 504 | 执行超时 | 先缩小范围再重试 |
| 503 | 连接错误 | IDA 实例可能已断开 |
| 500 | 服务器错误 | 检查 Hub Server 日志 |

代码执行错误会在响应的 `error` 字段返回堆栈信息。

## 8. 配置来源

用户从 Hub 前端 `/config` 页面获取：
- Hub Server URL
- Python helper 模板（默认推荐路径）
- instance_id（从实例列表获取）
- curl 快速检查命令（fallback）

## 9. 安全考虑

- Hub Server 绑定 0.0.0.0，仅在可信局域网使用
- 无认证机制，不要暴露到公网
- 代码在 IDA 进程中执行，具有完整 IDA API 权限

## 10. 参考

完整 API 参考：
- `ida-domain` 文档：https://github.com/nickcano/ida-domain
- IDA Python API：https://hex-rays.com/products/ida/support/idapython_docs/
