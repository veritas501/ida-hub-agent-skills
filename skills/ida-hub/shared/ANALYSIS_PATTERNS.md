# Analysis Patterns (Playbook)

High-frequency reverse engineering task templates.

This file is the **case library** for reusable remote analysis scripts.
Use these as starting points and adapt the filter/aggregate logic to your task.

Shared workflow, output-budget rules, and troubleshooting live in `USAGE.md`.

---

## Pattern 1: Find String Usages and Their Call Sites

**Task**: Given a keyword, find all matching strings, resolve xrefs to each string,
and report which functions reference them.

```python
import json

KEYWORD = "password"  # <-- change this

rows = []
for s in db.strings:
    try:
        text = str(s)
    except Exception:
        continue
    if KEYWORD.lower() not in text.lower():
        continue

    callers = set()
    for xref in db.xrefs.to_ea(s.address):
        func = db.functions.get_at(xref.from_ea)
        if func:
            callers.add(db.functions.get_name(func))

    rows.append({
        "string": text[:120],
        "address": f"0x{s.address:08X}",
        "callers": sorted(callers)[:10],
    })

rows.sort(key=lambda r: len(r["callers"]), reverse=True)
summary = {
    "keyword": KEYWORD,
    "match_count": len(rows),
    "top_results": rows[:15],
}
print(json.dumps(summary, indent=2, ensure_ascii=False))
```

---

## Pattern 2: Function Call Relationships

**Task**: Given a function name (or imported API), find who calls it and what it calls.

```python
import json

TARGET = "CreateFileW"  # <-- change this

func = db.functions.get_function_by_name(TARGET)
if not func:
    print(f"NOT_FOUND: {TARGET}")
else:
    callers = db.functions.get_callers(func)
    callees = db.functions.get_callees(func)

    caller_info = []
    for c in callers[:20]:
        name = db.functions.get_name(c)
        caller_info.append({"name": name, "address": f"0x{c.start_ea:08X}"})

    callee_info = []
    for c in callees[:20]:
        name = db.functions.get_name(c)
        callee_info.append({"name": name, "address": f"0x{c.start_ea:08X}"})

    result = {
        "target": TARGET,
        "address": f"0x{func.start_ea:08X}",
        "caller_count": len(callers),
        "callers": caller_info,
        "callee_count": len(callees),
        "callees": callee_info,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
```

---

## Pattern 3: Function or Range Summary

**Task**: Summarize a function (or current cursor location): instruction count,
external calls, strings referenced, and cross-references.

```python
import json

# Use a specific function name, or use ida_kernwin.get_screen_ea() for cursor
func = db.functions.get_function_by_name("main")  # <-- change this
if not func:
    print("NOT_FOUND")
else:
    name = db.functions.get_name(func)
    size = func.end_ea - func.start_ea

    # Count instructions
    insn_count = 0
    for _ in db.instructions.get_between(func.start_ea, func.end_ea):
        insn_count += 1

    # Callees (external calls)
    callees = db.functions.get_callees(func)
    callee_names = [db.functions.get_name(c) for c in callees]

    # Strings referenced from this function's range
    strings_in_range = []
    for ea in range(func.start_ea, func.end_ea):
        for xref in db.xrefs.from_ea(ea):
            s = db.strings.get_at(xref.to_ea)
            if s:
                try:
                    strings_in_range.append(str(s)[:80])
                except Exception:
                    pass
    strings_in_range = sorted(set(strings_in_range))

    # Callers (who calls this function)
    callers = db.functions.get_callers(func)

    summary = {
        "name": name,
        "address": f"0x{func.start_ea:08X}",
        "size_bytes": size,
        "instructions": insn_count,
        "caller_count": len(callers),
        "callee_count": len(callees),
        "callees": callee_names[:15],
        "strings": strings_in_range[:15],
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
```

---

## Pattern 4: Batch Results with Summary Export

**Task**: Analyze all functions but only return statistics and the most interesting subset.

```python
import json

stats = {
    "total": 0,
    "named": 0,
    "large": [],       # > 1KB
    "high_xref": [],   # many callers
}

for func in db.functions:
    stats["total"] += 1
    name = db.functions.get_name(func)
    size = func.end_ea - func.start_ea

    if name and not name.startswith("sub_"):
        stats["named"] += 1

    if size > 1024:
        stats["large"].append({"name": name, "size": size, "addr": f"0x{func.start_ea:08X}"})

    callers = db.functions.get_callers(func)
    if len(callers) > 10:
        stats["high_xref"].append({
            "name": name,
            "caller_count": len(callers),
            "addr": f"0x{func.start_ea:08X}",
        })

# Sort and trim
stats["large"].sort(key=lambda x: x["size"], reverse=True)
stats["large"] = stats["large"][:10]
stats["high_xref"].sort(key=lambda x: x["caller_count"], reverse=True)
stats["high_xref"] = stats["high_xref"][:10]
stats["large_count"] = len(stats["large"])
stats["high_xref_count"] = len(stats["high_xref"])

print(json.dumps(stats, indent=2, ensure_ascii=False))
```

---

## Pattern 5: Import / API Usage Audit

**Task**: Find all imported APIs matching a pattern and list their call sites.

```python
import json
import re

API_PATTERN = re.compile(r"(Create|Open|Read|Write)File", re.IGNORECASE)

results = []
for func in db.functions:
    name = db.functions.get_name(func)
    if not name or not API_PATTERN.search(name):
        continue

    callers = db.functions.get_callers(func)
    caller_names = [db.functions.get_name(c) for c in callers[:15]]

    results.append({
        "api": name,
        "address": f"0x{func.start_ea:08X}",
        "caller_count": len(callers),
        "callers": caller_names,
    })

results.sort(key=lambda r: r["caller_count"], reverse=True)
summary = {
    "pattern": API_PATTERN.pattern,
    "api_count": len(results),
    "apis": results[:20],
}
print(json.dumps(summary, indent=2, ensure_ascii=False))
```

---

## Pattern 6: Current Cursor Context

**Task**: Get a summary of what the user is looking at right now.

```python
import json

import ida_kernwin

ea = ida_kernwin.get_screen_ea()
func = db.functions.get_at(ea)

if not func:
    print(json.dumps({"cursor": f"0x{ea:X}", "in_function": False}))
else:
    name = db.functions.get_name(func)
    callers = db.functions.get_callers(func)
    callees = db.functions.get_callees(func)

    summary = {
        "cursor": f"0x{ea:X}",
        "function": name,
        "func_start": f"0x{func.start_ea:08X}",
        "func_size": func.end_ea - func.start_ea,
        "caller_count": len(callers),
        "callee_count": len(callees),
    }
    print(json.dumps(summary, indent=2))
```

---

## Anti-Patterns (Avoid These)

### ❌ Unbounded Print Loop

```python
# BAD — prints every function, potentially thousands of lines
for func in db.functions:
    name = db.functions.get_name(func)
    print(f"{name}: 0x{func.start_ea:08X}")
```

### ✅ Bounded Alternative

```python
# GOOD — collect, sort, print Top N
funcs = []
for func in db.functions:
    funcs.append((db.functions.get_name(func), func.start_ea))
print(f"total={len(funcs)}")
for name, ea in sorted(funcs)[:20]:
    print(f"  {name}: 0x{ea:08X}")
```

### ❌ Multi-Step Where One Script Suffices

```python
# BAD — step 1: get all strings; step 2: filter; step 3: get xrefs
# This wastes 3 round trips and produces large intermediate output
```

### ✅ Single Composite Script

```python
# GOOD — do everything in one script, return only the summary
# See Pattern 1 above
```
