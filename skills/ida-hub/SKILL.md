---
name: ida-hub
description: IDA Pro reverse engineering assistant that interacts with a remote IDA Hub Server over HTTP API. Used for binary analysis, function analysis, string search, cross-references, decompilation, and related reverse engineering tasks.
---

# IDA Hub Skill

Interact with a remote IDA Hub Server over HTTP API to perform reverse engineering tasks.

## When to Use

This skill is suitable for:

- Querying remote IDA instances and selecting a target database
- Performing read-only reverse engineering tasks: functions, strings, xrefs, pseudocode, and current cursor context
- Collecting, filtering, and aggregating results on the IDA side first, then returning only summaries and key evidence

The default goal is not to retrieve the full raw dataset, but to organize data inside IDA first and return structured results.

## Execution Context

- When the user says "this project", "current binary", "this file", or "IDA database", they refer to the database currently opened in the remote IDA instance.
- Code runs inside the IDA process and accesses the database through the `db` object (ida-domain API).
- Use `print()` to emit results. Output is returned in the `output` field of `/api/execute`.
- `/api/*` endpoints require `Authorization: Bearer <token>`.

Available runtime objects:

- `db` — ida-domain database object (primary interface)
- `idaapi` — Native IDA API module
- `idautils` — IDA utility helpers module
- `idc` — IDA core functions module
- `ida_kernwin` — IDA UI interaction helpers (cursor, navigation, etc.)

## Environment Requirements

The default path does not require `curl` or `jq`.

Recommended environment:
- Local Python 3
- `requests`

Use `curl` / `jq` only as a fallback or for quick diagnostics.

## Quick Reference — Common Tasks

These are the most frequently used operations. Use these snippets directly — do NOT guess or experiment with API names.

> **CRITICAL: The `db` object does NOT have a `decompile` method.** Decompilation uses `ida_hexrays.decompile(ea)`. The `func_t` object has no `.name` or `.address` attribute — use `db.functions.get_name(func)` and `func.start_ea` instead. See snippets below for correct usage.

### Decompile a function

```python
import ida_hexrays, ida_lines

func = db.functions.get_at(0x704c)
if func:
    cfunc = ida_hexrays.decompile(func.start_ea)
    for sline in cfunc.get_pseudocode():
        print(ida_lines.tag_remove(sline.line))
```

> **Key point:** Decompilation uses `ida_hexrays.decompile(ea)`, NOT `db.functions.decompile()`. The `db` object has no decompile method.

### Search functions by name

```python
import json
results = []
for func in db.functions:
    name = db.functions.get_name(func)
    if "fid" in name.lower():
        results.append({"name": name, "start": f"0x{func.start_ea:08X}"})
print(json.dumps(results, indent=2))
```

### Search strings by keyword

```python
import json
results = []
for s in db.strings:
    text = str(s)
    if "fid" in text.lower():
        results.append({"addr": f"0x{s.address:08X}", "text": text})
print(json.dumps(results[:20], indent=2))
```

### Get cross-references (callers / callees)

```python
import json

# Who calls this address?
callers = []
for ea in db.xrefs.calls_to_ea(0x704c):
    func = db.functions.get_at(ea)
    name = db.functions.get_name(func) if func else "unknown"
    callers.append({"from": f"0x{ea:08X}", "func": name})
print("Callers:", json.dumps(callers, indent=2))

# What does this function call?
callees = []
for ea in db.xrefs.calls_from_ea(0x704c):
    func = db.functions.get_at(ea)
    name = db.functions.get_name(func) if func else "unknown"
    callees.append({"to": f"0x{ea:08X}", "func": name})
print("Callees:", json.dumps(callees, indent=2))
```

### List all named locations

```python
import json
for ea, name in db.names:
    print(f"0x{ea:08X}: {name}")
```

### Get function disassembly

```python
func = db.functions.get_at(0x704c)
if func:
    lines = db.functions.get_disassembly(func)
    for line in lines:
        print(line)
```

### Read bytes at address

```python
addr = 0x704c
data = db.bytes.get_bytes(addr, 64)
print(data.hex())
```

### Rename a function

```python
# Rename by address
func = db.functions.get_at(0x6FB8)
if func:
    ok = db.functions.set_name(func, "get_serial_number")
    print(f"Rename: {'ok' if ok else 'failed'}")
```

### Rename a local variable

```python
import ida_hexrays
ok = ida_hexrays.rename_lvar(0x704c, "v2", "serial_number")
print(f"Rename lvar: {'ok' if ok else 'failed'}")
```

### Set function signature / type

```python
import idc
ok = idc.SetType(0x6FB8, "unsigned __int64 __fastcall get_serial_number(_QWORD *out_sn)")
print(f"SetType: {'ok' if ok else 'failed'}")
```

### Add a comment

```python
# Regular comment at address
db.comments.set_at(0x704c, "Gets FID via SN + JTAG_ID KDF")
```

### Combined analysis example (recommended pattern)

One script for a complete function analysis — search, decompile, callers, callees, related strings:

```python
import json, ida_hexrays, ida_lines

TARGET = "get_fid"  # Change this

# 1. Find the function
target_ea = None
for func in db.functions:
    name = db.functions.get_name(func)
    if TARGET in name.lower():
        target_ea = func.start_ea
        print(f"Found: {name} @ 0x{target_ea:X}")
        break

if not target_ea:
    print(f"Function '{TARGET}' not found")
else:
    # 2. Decompile
    try:
        cfunc = ida_hexrays.decompile(target_ea)
        print("\n=== Pseudocode ===")
        for sline in cfunc.get_pseudocode():
            print(ida_lines.tag_remove(sline.line))
    except Exception as e:
        print(f"Decompile failed: {e}")

    # 3. Callers
    print(f"\n=== Callers ===")
    for caller in db.xrefs.get_callers(target_ea):
        print(f"  0x{caller.ea:08X} in {caller.name} ({caller.xref_type.name})")

    # 4. Callees (functions this function calls)
    print(f"\n=== Callees ===")
    for ea in db.xrefs.calls_from_ea(target_ea):
        func = db.functions.get_at(ea)
        name = db.functions.get_name(func) if func else "?"
        print(f"  0x{ea:08X} {name}")

    # 5. Related strings
    print(f"\n=== Related Strings ===")
    for s in db.strings:
        if TARGET.lower() in str(s).lower():
            print(f"  0x{s.address:08X}: {s}")

    # 6. Rename sub_* functions based on analysis (proactive improvement)
    print(f"\n=== Applying Renames ===")
    renames = {
        0x6FB8: "get_serial_number",      # was sub_6FB8
        0xA01C: "snprintf_wrapper",         # was sub_A01C
        0xA6F0: "strlen_wrapper",           # was sub_A6F0
    }
    for ea, new_name in renames.items():
        func = db.functions.get_at(ea)
        if func:
            old = db.functions.get_name(func)
            if db.functions.set_name(func, new_name):
                print(f"  0x{ea:X}: {old} -> {new_name}")

    # 7. Add key comment
    db.comments.set_at(target_ea, "FID = KDF(SN + JTAG_ID, label='*#*#cardapp#*#*')")
    print("  Comment added")
```

## Shortest Path to Success — `run_script.py` CLI

This plugin includes a CLI tool `run_script.py` (located at `../../run_script.py`). It has zero external dependencies and uses only Python standard library.

**Important:** Copy `run_script.py` to your working directory (e.g., `.ida_tmp/`) before using it. Do not reference the original file directly from the skill directory.

### Setup

```bash
# Copy to your working directory
mkdir -p .ida_tmp
cp <path_to_skill>/../../run_script.py .ida_tmp/
```

### Usage

```bash
python .ida_tmp/run_script.py -u <hub_url> -k <token> <instance_id> <script_file>
```

| Parameter | Description |
|---|---|
| `-u` / `--url` | Hub URL (e.g., `http://127.0.0.1:10086`) |
| `-k` / `--token` | Bearer token |
| `instance_id` | Target IDA instance ID |
| `script_file` | Python script file to execute |

### Output Behavior

- Execution error → stderr, exit 1
- Output ≤ 4000 chars → printed to stdout
- Output > 4000 chars → written to temp file, file path printed to stdout (Agent can read via Read tool)

### Recommended Workflow

1. Get `BASE_URL`, `TOKEN`, `INSTANCE_ID` from Hub Web UI or `/api/agent_config`.
2. Copy `run_script.py` to `.ida_tmp/`.
3. Write analysis script to `.ida_tmp/<task>.py` — use `db`, `idaapi`, etc. directly, output via `print()`.
4. Execute:
   ```bash
   python .ida_tmp/run_script.py -u <BASE_URL> -k <TOKEN> <INSTANCE_ID> .ida_tmp/<task>.py
   ```
5. Iterate based on output.

> **Difference from old helper approach:** `run_script.py` is a standalone CLI. No need to write a `.ida_tmp/ida_hub.py` helper file first. Recommended as the primary execution method.

## Fallback — Helper Module

If `run_script.py` is not available, fall back to the helper module approach:

1. Get agent config from Hub Web UI or `/api/agent_config`.
2. Extract: `BASE_URL`, `TOKEN`, an example `INSTANCE_ID`.
3. Write helper to `.ida_tmp/ida_hub.py` in current working directory.
4. Run a smoke test first (e.g., `print(42)` or `print(db.module)`).
5. Create a dedicated task script and iterate.

If the user only has the Hub address but not the agent config, they must also provide a token and target instance information.

## Scripting Best Practices

**Think like a reverse engineer, not a script writer:**

1. **Combine related queries into one script** — If you need to decompile a function AND get its callers AND search for related strings, do it all in ONE script. Do not write a separate script file for each query.
2. **Write reusable utility scripts** — Instead of hardcoding addresses and names, write small CLI tools that accept arguments. For example:
   - A `rename.py` that reads `address:new_name` pairs from args or stdin
   - A `set_type.py` that takes an address and type string
   - A `decompile.py` that takes an address and prints pseudocode
   - Keep these in `.ida_tmp/` and reuse them across the session.
3. **Write once, iterate minimally** — A typical analysis task should be 1-2 scripts total. If you find yourself writing 4+ scripts for a single question, you are doing it wrong.
4. **Avoid API guesswork** — Use the Quick Reference snippets above. If you need an API not listed there, read the relevant `shared/API_REFERENCE_*.md` file BEFORE writing the script, not after it fails.
5. **Handle errors in-script** — Use `try/except` for decompilation and other fallible operations rather than relying on retry with a new script.

### Example: Reusable Rename Tool

Create `.ida_tmp/rename.py` once, then use the Edit tool to update the rename map and re-run:

```python
# .ida_tmp/rename.py — edit RENAMES dict, then run
RENAMES = {
    # address: new_name
    0x6FB8: "get_serial_number",
    0xA01C: "snprintf_wrapper",
    0xA6F0: "strlen_wrapper",
}

for ea, new_name in RENAMES.items():
    func = db.functions.get_at(ea)
    if func:
        old = db.functions.get_name(func)
        if db.functions.set_name(func, new_name):
            print(f"  0x{ea:X}: {old} -> {new_name}")
        else:
            print(f"  0x{ea:X}: rename failed")
    else:
        print(f"  0x{ea:X}: no function")
```

Similarly, build `.ida_tmp/set_types.py` for `idc.SetType()`, `.ida_tmp/rename_lvars.py` for `ida_hexrays.rename_lvar()`, etc. Edit the data dict and re-run as analysis progresses.

Remote scripts should follow these defaults:
- Do not print the full dataset.
- Only output summaries, Top N, counts, key addresses, and necessary evidence by default.
- Sort, deduplicate, and trim bulk results before printing.
- If the result is still too large, return statistics and next-step suggestions instead of printing everything with `for ...: print(...)`.

Recommended patterns:
- `count`
- `top_matches[:10]`
- `sorted(...)[0:20]`
- `json.dumps(summary, indent=2)`

## Operation Levels

### Proactive Analysis (Recommended)

A skilled reverse engineer does not just observe — they improve the database as they analyze. While reading and decompiling code, you should proactively:

- **Rename functions** — When you understand what `sub_6FB8` does (e.g., it gets the serial number), rename it to `get_serial_number`.
- **Rename local variables** — When decompilation shows `v2`, `v5`, `v19` and you can infer their purpose, rename them (e.g., `serial_number`, `jtag_id`, `kdf_seed`).
- **Set function signatures** — When you deduce parameter types and return values, apply them with `idc.SetType()`.
- **Add comments** — Annotate key logic, algorithm steps, or non-obvious behavior directly in the disassembly/pseudocode.
- **Recover structures** — When you identify a data layout accessed via offsets, create or apply a struct type.

**Apply these changes as part of the analysis script itself** — do not wait for a separate step. For example, after decompiling `get_fid` and understanding its logic, the same script should rename `sub_6FB8` to `get_serial_number`, rename local variables, and add comments.

After applying changes, briefly mention what you renamed/typed/commented so the user knows what was improved.

### Must Explicitly Confirm: High-risk or Bulk Modifications

- patch bytes / revert bytes
- Delete or recreate functions
- Navigation or batch operations that significantly alter the user's current UI state

### Must Explicitly Confirm: High-risk or Bulk Modifications

- patch bytes / revert bytes
- Delete or recreate functions
- Bulk renaming / bulk comments
- Navigation or batch operations that significantly alter the user's current UI state

## Cross-Instance Analysis

When analyzing external symbols (imported functions, externs, PLT stubs), first evaluate whether cross-instance analysis is necessary.

### When NOT Needed

Skip cross-instance analysis if the external symbol falls into these categories:

- **Well-known libc / system calls** — e.g., `mmap`, `malloc`, `free`, `open`, `read`, `write`, `pthread_create`, `dlopen`. These are standard APIs with known semantics.
- **Self-explanatory function names** — The name clearly conveys purpose and no deeper analysis is needed (e.g., `log_error`, `get_timestamp`, `calculate_checksum`).
- **Common third-party libraries with stable APIs** — e.g., OpenSSL `SSL_read`, zlib `deflate`, SQLite `sqlite3_open`. Unless investigating a bug or vulnerability in the library itself.

In these cases, continue analysis without interrupting the workflow.

### When It IS Needed

Proceed with cross-instance analysis when:

- **Custom / proprietary library** — The external symbol belongs to a non-standard library specific to this project (e.g., `lib_custom_protocol.dll!parse_packet`).
- **Unclear behavior** — The function name is generic or obfuscated, and understanding its internals is critical to the analysis goal.
- **Suspected vulnerability or anti-analysis trick** — Need to verify implementation details in the external module.

### Workflow

1. **Query Hub instance list** — Call `GET /api/instances` to check if the target binary is already loaded on another instance.
2. **Cross-instance execution** — If found, use that `instance_id` to run analysis (decompile, get xrefs, etc.) and bring results back.
3. **Ask the user** — Only if the analysis genuinely requires it AND the instance is not available on the Hub, prompt the user to load the corresponding binary.

Example:
- Analyzing `main.exe`, found call to `crypto_utils.dll!obfuscate_data` (custom DLL) → query Hub → if found, cross-instance decompile → if not found, ask user to load `crypto_utils.dll`
- Analyzing `app.bin`, found call to `libc.so!mmap` → skip, standard API, continue with current context

## User Intent to Recommended Entry Point

- **"Analyze the current function / current cursor / what I am looking at"** → read `../../shared/IDA.md` first
- **"Find strings, xrefs, call relationships, suspicious functions"** → read `../../shared/ANALYSIS_PATTERNS.md` first
- **"How should I organize scripts / control output / troubleshoot"** → read `../../shared/USAGE.md` first
- **"How do I call a specific ida-domain API"** → go directly to the relevant `../../shared/API_REFERENCE_*.md`
- **"Pseudocode, ctree, microcode, Hex-Rays variable renaming"** → read `../../shared/HEXRAYS.md` first

## Fallback / Diagnostic Path

Only use `curl` when doing a quick connectivity check, when the user explicitly asks for it, or when the local helper is unavailable.

### List Instances

```bash
curl -s "${IDA_HUB_URL}/api/instances" \
  -H 'Authorization: Bearer ${IDA_HUB_TOKEN}'
```

### Execute Code

```bash
curl -s -X POST "${IDA_HUB_URL}/api/execute" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ${IDA_HUB_TOKEN}' \
  -d '{"instance_id": "<INSTANCE_ID>", "code": "print(42)"}'
```

## Response Format

Successful `/api/execute` response:

```json
{
  "success": true,
  "output": "summary...",
  "error": null,
  "request_id": "abc123"
}
```

## Error Handling

| HTTP Status | Meaning | Suggested Handling |
|-------------|---------|-------------------|
| 400 | Invalid parameters | Check request parameters |
| 401 | Missing auth or invalid token | Get a new token from `/api/agent_config` |
| 404 | Instance not found | List instances and confirm `instance_id` |
| 422 | Validation failed | Check `instance_id`, `code`, and length limits |
| 503 | Connection error | IDA instance may have disconnected |
| 504 | Execution timeout | Narrow scope or split the task |
| 500 | Server error | Check Hub Server logs |

Code execution failures return stack traces in the `error` field.

## Security Notes

- The Bearer token carries permissions scoped to the current user. Do not leak it into untrusted environments.
- Even with authentication, the Hub Server should only be used in a trusted local network.
- Do not expose the Hub to the public internet unless additional reverse proxying, TLS, and stronger access controls are in place.
- Code runs inside the IDA process and has full IDA API privileges.
- Only connect to trusted Hub Servers.

---

# Reference Documents

Start with the main index: **[../../shared/README.md](../../shared/README.md)**

Read on demand:

- **[../../shared/USAGE.md](../../shared/USAGE.md)**: script organization, output budgeting, troubleshooting
- **[../../shared/ANALYSIS_PATTERNS.md](../../shared/ANALYSIS_PATTERNS.md)**: common RE playbooks and templates
- **[../../shared/API_REFERENCE_CORE.md](../../shared/API_REFERENCE_CORE.md)**: `Database`, `Functions`, `Instructions`, `Operands`, `FlowChart`
- **[../../shared/API_REFERENCE_MEMORY.md](../../shared/API_REFERENCE_MEMORY.md)**: `Segments`, `Heads`, `Bytes`
- **[../../shared/API_REFERENCE_SYMBOLS.md](../../shared/API_REFERENCE_SYMBOLS.md)**: `Strings`, `Names`, `Comments`, `Entries`, `Xrefs`
- **[../../shared/API_REFERENCE_TYPES.md](../../shared/API_REFERENCE_TYPES.md)**: `Types`, `Signature Files`
- **[../../shared/API_REFERENCE_ENUMS.md](../../shared/API_REFERENCE_ENUMS.md)**: common enum definitions
- **[../../shared/IDA.md](../../shared/IDA.md)**: current location, selected ranges, navigation, UI interactions
- **[../../shared/HEXRAYS.md](../../shared/HEXRAYS.md)**: pseudocode, ctree, microcode, Hex-Rays hooks
