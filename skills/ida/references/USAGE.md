# IDA Domain API Usage

Scripts execute inside the IDA process via `/api/execute`. Use the `db` variable to access
the open database and `print()` to return results.

**For the complete API reference, see [API_REFERENCE.md](API_REFERENCE.md).**

---

## Script Organization

### Default Pattern: Collect → Filter → Aggregate → Summarize

Every remote script should follow this pipeline:

1. **Collect** — iterate or query the relevant entity handler.
2. **Filter** — keep only what matches the task criteria.
3. **Aggregate** — sort, deduplicate, count, group.
4. **Summarize** — `print()` a compact result (Top N, count, JSON summary).

Avoid `for ...: print(...)` over unbounded collections.

### Recommended Output Shapes

| Shape | When to use |
|---|---|
| `count` only | "How many X match?" |
| `top_matches[:N]` | "Which X are most relevant?" |
| `json.dumps(summary)` | Structured multi-field result |
| One-line per item (capped) | Short list with address + name |

### Example: Bounded Output Template

```python
import json

rows = []
for item in collection:
    if condition(item):
        rows.append(extract(item))

rows.sort(key=sort_key, reverse=True)
summary = {
    "total": len(rows),
    "top": rows[:10],
}
print(json.dumps(summary, indent=2, ensure_ascii=False))
```

---

## Task Templates

### List All Functions (Summarized)

```python
import json

funcs = []
for func in db.functions:
    name = db.functions.get_name(func)
    funcs.append({
        "name": name,
        "start": f"0x{func.start_ea:08X}",
        "size": func.end_ea - func.start_ea,
    })

funcs.sort(key=lambda f: f["size"], reverse=True)
summary = {
    "module": db.module,
    "total_functions": len(funcs),
    "largest_10": funcs[:10],
}
print(json.dumps(summary, indent=2, ensure_ascii=False))
```

### Find Function and Show Call Graph

```python
target = "main"
func = db.functions.get_function_by_name(target)
if not func:
    print(f"NOT_FOUND: {target}")
else:
    callers = db.functions.get_callers(func)
    callees = db.functions.get_callees(func)
    caller_names = [db.functions.get_name(c) for c in callers]
    callee_names = [db.functions.get_name(c) for c in callees]
    print(f"function={target} start=0x{func.start_ea:08X}")
    print(f"callers({len(callers)}): {', '.join(caller_names[:20])}")
    print(f"callees({len(callees)}): {', '.join(callee_names[:20])}")
```

### Search Strings with Budget

```python
import re

pattern = re.compile(r"https?://[\w./\-?&=]+", re.IGNORECASE)
matches = []
for s in db.strings:
    try:
        text = str(s)
    except Exception:
        continue
    if pattern.search(text):
        matches.append({"address": f"0x{s.address:08X}", "text": text})

print(f"url_count={len(matches)}")
for m in matches[:15]:
    print(f"  {m['address']}: {m['text']}")
```

### Cross-References to Address

```python
target = 0x00401000
refs = []
for xref in db.xrefs.to_ea(target):
    func = db.functions.get_at(xref.from_ea)
    func_name = db.functions.get_name(func) if func else "?"
    refs.append({
        "from": f"0x{xref.from_ea:08X}",
        "type": xref.type.name,
        "function": func_name,
    })

print(f"xrefs_to_0x{target:08X}: {len(refs)}")
for r in refs[:20]:
    print(f"  {r['from']} ({r['type']}) in {r['function']}")
```

### Decompile Function

```python
func = db.functions.get_function_by_name("main")
if not func:
    print("NOT_FOUND: main")
else:
    try:
        lines = db.functions.get_pseudocode(func)
        # Print decompiled output directly — this is already bounded per function
        print("\n".join(lines))
    except RuntimeError as e:
        print(f"Decompilation failed: {e}")
```

### Analyze Function Complexity (Top N)

```python
import json

results = []
for func in db.functions:
    flowchart = db.functions.get_flowchart(func)
    if not flowchart:
        continue
    blocks = len(flowchart)
    edges = sum(b.count_successors() for b in flowchart)
    cc = edges - blocks + 2
    if cc > 5:
        results.append({
            "name": db.functions.get_name(func),
            "address": f"0x{func.start_ea:08X}",
            "blocks": blocks,
            "cyclomatic": cc,
        })

results.sort(key=lambda r: r["cyclomatic"], reverse=True)
print(json.dumps({"high_complexity": results[:15]}, indent=2))
```

### Search Byte Patterns

```python
pattern = b"\x55\x48\x89\xE5"  # push rbp; mov rbp, rsp
hits = db.bytes.find_binary_sequence(pattern)
print(f"prologue_hits={len(hits)}")
for addr in hits[:20]:
    func = db.functions.get_at(addr)
    name = db.functions.get_name(func) if func else "?"
    print(f"  0x{addr:08X} -> {name}")
```

---

## Tips

- **Error handling** — Always use try-except for decompilation and string operations.
- **Check for None** — Functions like `get_function_by_name()` return None if not found.
- **Use db.functions methods** — Call methods on `db.functions`, not on the func object:
  ```python
  # Wrong: func.get_callers()
  # Right: db.functions.get_callers(func)
  ```
- **String iteration** — Handle encoding errors gracefully:
  ```python
  for s in db.strings:
      try:
          content = str(s)
      except Exception:
          continue
  ```
- **Output budget** — Always cap printed output. Prefer `[:N]` slicing or `json.dumps(summary)`.

---

## Troubleshooting

**AttributeError: 'Xrefs' has no attribute 'get_xrefs_to':**
Use `db.xrefs.to_ea(addr)` not `db.xrefs.get_xrefs_to(addr)`.

**AttributeError on func_t object:**
Call methods on `db.functions`, not on the func object.

**UnicodeDecodeError when reading strings:**
Wrap string access in try-except blocks.

**When encountering API errors:**
Check the [API_REFERENCE.md](API_REFERENCE.md) for the correct method signatures.
