# DEV Guide (skills)

## Responsibility

`skills` contains Agent-oriented operational knowledge and usage patterns.

It is responsible for:

- documenting stable API-driven workflows
- providing command templates and analysis patterns
- reducing prompt variance for repeatable execution

Current main skill:

- `skills/ida/`

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

- examples are copy-paste runnable
- required placeholders are explicit (`<INSTANCE_ID>`, `<CODE>`)
- error handling guidance includes 404/503/504 cases
- security notes are present for network exposure scenarios
