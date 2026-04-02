# Skills

Agent 技能目录，兼容 `npx skills add`。

## 安装

```bash
npx skills add veritas501/ida-hub-agent-skills
```

## 包含内容

- `ida-hub/` — IDA Hub 逆向工程技能
  - `SKILL.md` — 技能入口
  - `run_script.py` — CLI 执行工具
  - `shared/` — IDA API 参考文档

## 使用

安装后在 Claude Code 中调用：

```
/ida-hub:ida-hub <逆向分析任务>
```
