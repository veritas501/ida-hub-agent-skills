# DEV Guide (skills)

## Responsibility

`skills` contains Agent-oriented operational knowledge and usage patterns.

It is responsible for:

- documenting stable API-driven workflows
- providing task templates and analysis playbooks (not raw API fragments)
- reducing prompt variance for repeatable execution
- enforcing output budget conventions (summary-first, Top N, bounded print)

Current main skill:

- `skills/ida/`

## Design principles

- **Python helper first**: default path uses a local Python helper, not curl.
- **Composite remote scripts**: default "one task, one script" — collect/filter/aggregate/summarize in IDA, return summary only.
- **Output budget**: all templates cap output; avoid unbounded `for ...: print(...)`.
- **Patchable iteration**: prefer patching local helper or script file over rewriting commands.
- **curl as fallback**: only for quick connectivity checks or user-explicit requests.

## Integration points

- Consumes Hub HTTP APIs:
  - `/api/instances`
  - `/api/execute`
  - `/api/config`
- Indirectly drives IDA execution through Hub routing.

## Decoupling constraints

- Skills should depend on API contracts, not backend/plugin internals.
- Avoid embedding assumptions about private code structure.
- Keep examples robust to minor response format extensions.

## Change guidance

When API/protocol changes:

1. update `skills/ida/SKILL.md`
2. update references under `skills/ida/references/`
3. validate command snippets against running backend

## Quality checklist

- examples follow Collect → Filter → Aggregate → Summarize pipeline
- output is always bounded (Top N, count, json.dumps)
- required placeholders are explicit (`<INSTANCE_ID>`, target names)
- error handling guidance includes 404/503/504 cases
- security notes are present for network exposure scenarios
- curl examples are clearly labeled as fallback/diagnostic
