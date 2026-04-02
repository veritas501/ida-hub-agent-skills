# IDA Domain API Usage

Scripts execute inside the IDA process via `/api/execute`. Use the `db` variable to access
the open database and `print()` to return results.

**For the API reference, see the topic files: [API_REFERENCE_CORE.md](API_REFERENCE_CORE.md), [API_REFERENCE_MEMORY.md](API_REFERENCE_MEMORY.md), [API_REFERENCE_SYMBOLS.md](API_REFERENCE_SYMBOLS.md), [API_REFERENCE_TYPES.md](API_REFERENCE_TYPES.md), and [API_REFERENCE_ENUMS.md](API_REFERENCE_ENUMS.md).**

**For full Hex-Rays Python API index coverage (L1) and key semantic workflows (L2), see [HEXRAYS.md](HEXRAYS.md).**

---

## Script Organization

### How to Use These Templates

The code blocks in this file are **remote execution logic templates** for `/api/execute`.
In normal use, put them into a local task script under `.ida_tmp/` and call them through the helper from `SKILL.md`.

Before first use, prefer getting the recommended helper configuration from `/api/agent_config` so that `BASE_URL`, `TOKEN`, and example `INSTANCE_ID` match the current Hub deployment.

Recommended workflow:
- One task, one script
- Iterate by editing the current task script
- Reuse `.ida_tmp/ida_hub.py` for transport and execution
- Ensure the helper sends `Authorization: Bearer <token>` on every `/api/*` request
- Use temporary probes only during exploration or quick validation

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

## Scope

This file focuses on **how** to organize transport, scripts, output budget, and troubleshooting.

If you need ready-to-adapt analysis cases, prefer:
- [ANALYSIS_PATTERNS.md](ANALYSIS_PATTERNS.md) for strings/xrefs/callgraph/current-cursor/high-volume summaries
- [IDA.md](IDA.md) for UI-driven tasks
- [HEXRAYS.md](HEXRAYS.md) for pseudocode, ctree, microcode, and local variable workflows

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

**401 Unauthorized:**
The Hub API requires `Authorization: Bearer <token>` on `/api/*`. Regenerate or copy the current helper from `/api/agent_config`, or re-login to get a valid token.

**400 Bad Request on `/api/agent_config` or `/api/ida_config`:**
The `ip` query parameter is invalid. Use a valid IPv4 address.

**404 Instance not found:**
Re-run `list_instances()` and verify that `INSTANCE_ID` belongs to the current user session.

**422 Unprocessable Entity:**
Check that the request body still contains both `instance_id` and `code`, and that the code length does not exceed the backend limit.

**503 / connection error:**
The IDA instance may be disconnected. Check plugin connectivity before retrying.

**504 Execute timed out:**
Shrink the search scope, split the task into phases, or reduce output volume.

**AttributeError: 'Xrefs' has no attribute 'get_xrefs_to':**
Use `db.xrefs.to_ea(addr)` not `db.xrefs.get_xrefs_to(addr)`.

**AttributeError on func_t object:**
Call methods on `db.functions`, not on the func object.

**UnicodeDecodeError when reading strings:**
Wrap string access in try-except blocks.

**When encountering API errors:**
Check the relevant `API_REFERENCE_*.md` file for the correct method signatures.
