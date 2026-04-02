[根目录](../CLAUDE.md) > **skills**

Agent 技能目录，通过 `npx skills add` 安装到 Claude Code 等 Agent 中。

## 安装

```bash
npx skills add veritas501/ida-hub-agent-skills
```

## 结构

```
skills/
└── ida-hub/
    ├── SKILL.md          # 技能入口
    ├── run_script.py     # CLI 执行工具
    └── shared/           # IDA API 参考文档
```

## 维护注意

- 技能内容约束 Agent 只使用 Hub HTTP API（`/api/instances`、`/api/execute` 等），不依赖后端内部实现
- SKILL.md 的 frontmatter 必须有 `name` 和 `description`，否则 `npx skills add` 无法发现
- 更新技能时先核对后端 `/api/agent_config` 返回内容，保持一致
