# Skills 目录说明

本目录用于存放本仓库可复用的 Codex/Agent 技能定义。

## 目录结构

```text
skills/
├── README.md                 # 本说明文件
└── ida/                      # IDA Hub 逆向分析技能
    ├── SKILL.md              # 技能入口（name/description/使用规则）
    └── references/           # 技能参考资料
        ├── API_REFERENCE.md
        ├── IDA.md
        └── USAGE.md
```

## 技能设计约定

每个技能目录建议遵循以下最小结构：

- `SKILL.md`：必须存在，包含技能元信息与执行指引。
- `references/`：按需提供 API 参考、示例、排障文档。

`SKILL.md` 推荐包含：

- Frontmatter：
  - `name`：技能名（目录名建议一致）。
  - `description`：技能用途、触发场景与边界。
- 执行说明：
  - 上下文约定（变量、运行环境、输入输出）。
  - 首次使用流程（必要前置条件）。
  - 常用命令模板与错误处理。
  - 安全约束与风险提示。

## 当前技能

### `ida`

通过 HTTP API 与远程 IDA Hub Server 交互，执行逆向分析任务：

- 列出已连接实例（`/api/instances`）
- 在指定实例执行 Python 代码（`/api/execute`）
- 在 IDA 上下文中使用 `db`（ida-domain）进行函数、字符串、交叉引用、反编译分析

入口文件：`skills/ida/SKILL.md`

## 新增技能流程

1. 新建目录：`skills/<skill_name>/`
2. 编写 `SKILL.md`（先定义边界，再补示例）
3. 按需补充 `references/*.md`
4. 在本 README 的“当前技能”补充条目
5. 自检：
   - 是否仅覆盖当前真实需求（YAGNI）
   - 是否避免重复描述（DRY）
   - 是否职责单一、边界清晰（SOLID）
   - 是否保持指令简洁可执行（KISS）

## 维护建议

- 优先小步迭代技能文档，避免一次性大而全重写。
- 新增命令示例时，优先提供可直接复制执行的最小示例。
- 参考文档只保留“高频且易错”的内容，降低维护成本。
