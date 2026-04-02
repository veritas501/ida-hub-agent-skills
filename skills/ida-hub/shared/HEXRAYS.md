# Hex-Rays API Quick Reference

面向 `ida_hexrays.py` 的实战速查文档，风格对齐当前主题化 API 参考：
- 任务导向
- 高信息密度
- 代码模板优先
- 不展开 SWIG 全量符号细节

---

## Table of Contents

- [初始化与环境](#初始化与环境)
- [反编译入口](#反编译入口)
- [伪代码读取与输出](#伪代码读取与输出)
- [函数签名与变量重命名](#函数签名与变量重命名)
- [cfunc / ctree 分析](#cfunc--ctree-分析)
- [microcode / mba 分析](#microcode--mba-分析)
- [Hexrays Hooks 事件](#hexrays-hooks-事件)
- [常用对象速查](#常用对象速查)
- [任务到 API 映射](#任务到-api-映射)
- [常见错误与排查](#常见错误与排查)

---

## 初始化与环境

```python
import ida_hexrays

ok = ida_hexrays.init_hexrays_plugin()
if not ok:
    raise RuntimeError("Hex-Rays 初始化失败")
```

查看版本：

```python
import ida_hexrays
print(ida_hexrays.get_hexrays_version())
```

---

## 反编译入口

### 按地址反编译（最常用）

```python
import ida_hexrays

cfunc = ida_hexrays.decompile(ea)
```

### 按 `func_t` 反编译

```python
import ida_funcs
import ida_hexrays

pfn = ida_funcs.get_func(ea)
cfunc = ida_hexrays.decompile_func(pfn)
```

### 批量反编译

```python
import ida_hexrays

ok = ida_hexrays.decompile_many("/tmp/pseudo.c", funcaddrs, 0)
```

### 反编译缓存控制

```python
import ida_hexrays

ida_hexrays.mark_cfunc_dirty(ea)   # 单函数缓存失效
ida_hexrays.clear_cached_cfuncs()  # 全局缓存清理
```

---

## 伪代码读取与输出

```python
import ida_hexrays
import ida_lines

cfunc = ida_hexrays.decompile(ea)
for sline in cfunc.get_pseudocode():
    print(ida_lines.tag_remove(sline.line))
```

说明：
- `get_pseudocode()` 返回带 tag 的行对象。
- 导出纯文本时建议 `ida_lines.tag_remove()`。

---

## 函数签名与变量重命名

### 参数名/函数原型（稳定）

```python
import idc

idc.SetType(ea, "int __fastcall foo(void *ctx, int in_len, char *out_buf)")
```

### 局部变量重命名

```python
import ida_hexrays

ok = ida_hexrays.rename_lvar(ea, "v6", "result")
print("rename ok?", ok)
```

### 用户变量信息修改（高级）

```python
# 入口：ida_hexrays.modify_user_lvar_info(...)
# 用于批量设置 lvar 的名称/类型/注释等
```

建议顺序：
1. `SetType()` 修正签名与参数
2. `rename_lvar()` 语义化局部变量
3. `mark_cfunc_dirty()` + `decompile()` 回读验证

---

## cfunc / ctree 分析

核心对象：
- `cfunc_t`：反编译函数对象
- `cinsn_t`：语句节点
- `cexpr_t`：表达式节点
- `citem_t`：公共基类

### ctree 访问器模板

```python
import ida_hexrays

class MyVisitor(ida_hexrays.ctree_visitor_t):
    def __init__(self):
        super().__init__(ida_hexrays.CV_FAST)

    def visit_expr(self, e):
        # 处理表达式
        return 0

cfunc = ida_hexrays.decompile(ea)
v = MyVisitor()
v.apply_to(cfunc.body, None)
```

典型用途：
- 定位调用表达式
- 提取条件分支结构
- 统计特定语法节点

---

## microcode / mba 分析

### 生成微码 IR

```python
import ida_hexrays

mba = ida_hexrays.gen_microcode(mbr, None, None, 0, ida_hexrays.MMAT_GLBOPT3)
```

核心对象：
- `mba_t`：函数级微码容器
- `mblock_t`：基本块
- `minsn_t`：微码指令
- `mop_t`：操作数
- `mlist_t`：寄存器/内存集合

实践建议：
- IR 级处理后做一致性校验（如 `mba.verify(...)`）

---

## Hexrays Hooks 事件

### 基础模板

```python
import ida_hexrays

class MyHooks(ida_hexrays.Hexrays_Hooks):
    def hxe_func_printed(self, cfunc):
        # 伪代码打印后
        return 0

hooks = MyHooks()
hooks.hook()
# hooks.unhook()
```

要点：
- 回调返回值语义依事件而定。
- 长时运行脚本要管理好 `hook()/unhook()` 生命周期。

---

## 常用对象速查

| API | 作用 |
|---|---|
| `init_hexrays_plugin()` | 初始化反编译插件 |
| `get_hexrays_version()` | 获取版本字符串 |
| `decompile(ea)` | 按地址反编译 |
| `decompile_func(pfn)` | 按 `func_t` 反编译 |
| `decompile_many(...)` | 批量反编译导出 |
| `mark_cfunc_dirty(ea)` | 刷新单函数缓存 |
| `clear_cached_cfuncs()` | 清全局缓存 |
| `rename_lvar(ea, old, new)` | 局部变量重命名 |
| `modify_user_lvar_info(...)` | 修改用户变量信息 |
| `ctree_visitor_t` | ctree 遍历基类 |
| `gen_microcode(...)` | 生成微码 |
| `Hexrays_Hooks` | 事件 Hook 基类 |

---

## 任务到 API 映射

| 任务 | 推荐 API |
|---|---|
| 导出伪代码文本 | `decompile` + `cfunc.get_pseudocode` |
| 修正参数命名 | `idc.SetType` |
| 重命名局部变量 | `rename_lvar` |
| 批量变量元信息调整 | `modify_user_lvar_info` |
| 遍历语法树定位调用点 | `ctree_visitor_t.apply_to` |
| 做 IR 级分析 | `gen_microcode` + `mba_t` |
| 监听反编译生命周期 | `Hexrays_Hooks` + `hxe_*` |

---

## 常见错误与排查

### `init_hexrays_plugin()` 返回 False
- 未安装/未授权对应架构反编译器
- 插件加载状态异常

### `decompile()` 失败
- 地址不是有效函数入口
- 函数边界/类型信息异常

### `rename_lvar()` 返回 False
- 变量被优化折叠，不可独立命名
- 新名称冲突
- 当前函数反编译状态无效

### 修改后伪代码没变化
- 调用 `mark_cfunc_dirty(ea)` 后再 `decompile()`

---

## 关联文档

- 主 API 风格参考：`API_REFERENCE_CORE.md` / `API_REFERENCE_TYPES.md` / `API_REFERENCE_ENUMS.md`
- 任务用法与脚本输出规范：`USAGE.md`
