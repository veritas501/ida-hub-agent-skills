# IDA References Index

本目录存放 `skills/ida/SKILL.md` 的参考资料。

目标：
- 让 agent 快速判断“应该先读哪篇”
- 降低在多个文档之间来回跳转的成本
- 明确每篇文档的职责边界，避免重复维护

## 推荐阅读顺序

### 1. 先确定你在做什么

- **刚接手任务，不确定怎么落地** → 先读 [USAGE.md](USAGE.md)
- **已经知道目标，要找可直接改造的脚本模板** → 先读 [ANALYSIS_PATTERNS.md](ANALYSIS_PATTERNS.md)
- **任务依赖当前光标、选区、跳转、UI 状态** → 先读 [IDA.md](IDA.md)
- **任务涉及伪代码、ctree、microcode、局部变量、Hex-Rays** → 先读 [HEXRAYS.md](HEXRAYS.md)
- **只是不确定某个 ida-domain API 怎么用** → 按主题直接进入 `API_REFERENCE_*.md`

## 文档边界

### [USAGE.md](USAGE.md)

关注：
- helper / `.ida_tmp/` 工作流
- 脚本组织方式
- 输出预算
- 常见排障

不负责：
- 大量案例模板
- API 完整索引

### [ANALYSIS_PATTERNS.md](ANALYSIS_PATTERNS.md)

关注：
- 高频只读分析案例
- 可直接改造的远程复合脚本模板
- 字符串 / xref / 调用关系 / 当前上下文 / 批量摘要等模式

不负责：
- 通用工作流讲解
- 系统性排障说明

### API Reference Topics

关注：
- ida-domain API 按主题拆分后的参考文件
- 方法签名
- 常用对象与枚举

不负责：
- 任务分解策略
- 具体分析 playbook

主题拆分：
- [API_REFERENCE_CORE.md](API_REFERENCE_CORE.md)：`Database`、`Functions`、`Instructions`、`Operands`、`FlowChart`
- [API_REFERENCE_MEMORY.md](API_REFERENCE_MEMORY.md)：`Segments`、`Heads`、`Bytes`
- [API_REFERENCE_SYMBOLS.md](API_REFERENCE_SYMBOLS.md)：`Strings`、`Names`、`Comments`、`Entries`、`Xrefs`
- [API_REFERENCE_TYPES.md](API_REFERENCE_TYPES.md)：`Types`、`Signature Files`
- [API_REFERENCE_ENUMS.md](API_REFERENCE_ENUMS.md)：`Enums Reference`

### [IDA.md](IDA.md)

关注：
- `ida_kernwin` 相关 UI 上下文交互
- 当前地址、选中范围、跳转、历史回退、highlight

适合：
- “当前函数”
- “我现在看到的地方”
- “跳到某个地址/函数”
- “处理选区”

### [HEXRAYS.md](HEXRAYS.md)

关注：
- Hex-Rays 初始化
- 伪代码读取
- 局部变量重命名
- ctree / microcode / hook

适合：
- 伪代码分析
- 变量重命名与签名修正
- 更深入的反编译语义分析

## 最短决策表

| 需求 | 先读 |
|---|---|
| 不知道怎么组织脚本 | `USAGE.md` |
| 需要案例模板 | `ANALYSIS_PATTERNS.md` |
| 需要查 API | `API_REFERENCE_*.md` |
| 依赖当前光标或选区 | `IDA.md` |
| 依赖 Hex-Rays 伪代码能力 | `HEXRAYS.md` |

## 维护约定

- 通用流程与排障放 `USAGE.md`
- 案例模板放 `ANALYSIS_PATTERNS.md`
- API 细节按主题拆分到 `API_REFERENCE_CORE.md`、`API_REFERENCE_MEMORY.md`、`API_REFERENCE_SYMBOLS.md`、`API_REFERENCE_TYPES.md`、`API_REFERENCE_ENUMS.md`
- UI 交互放 `IDA.md`
- 反编译专题放 `HEXRAYS.md`

如果新增内容无法明确归类，优先检查是否会与现有文档重复，再决定放置位置。
