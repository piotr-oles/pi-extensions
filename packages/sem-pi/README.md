# sem-pi

A [pi coding agent](https://github.com/earendil-works/pi) extension that exposes [sem](https://github.com/piotr-oles/sem) as agent tools — giving the model semantic understanding of code structure without reading entire files.

## Tools

| Tool | Description |
|------|-------------|
| `sem_context` | Token-budgeted context for a named entity (function, class, method, variable). Returns full source + key deps within budget. Cheaper than reading the whole file when you only need one symbol. |
| `sem_entities` | List all code entities in a file or directory — compact symbol tree with type and line range. Use to discover what exists before diving in. |
| `sem_impact` | Impact of changing an entity: direct deps, dependents, transitive blast radius, affected tests. Use before modifying to understand what breaks. |
| `sem_diff` | Semantic diff grouped by entity rather than raw lines. Supports working tree, staged, and commit ranges. |

## Requirements

- [pi coding agent](https://github.com/earendil-works/pi) ≥ 0.74
- [sem](https://github.com/piotr-oles/sem) on `PATH`

## Installation

```bash
pi ext add piotr-oles/pi-extensions:packages/sem-pi
```

Or add it to your pi config directly:

```json
{
  "extensions": ["piotr-oles/pi-extensions:packages/sem-pi"]
}
```

## Usage examples

```
# Understand a function without reading the whole file
> Get me the context for the AuthService class with a 3000-token budget

# Discover the structure of a module before editing it
> List all entities in src/auth/

# Check blast radius before refactoring
> What would be impacted if I change the login() function?

# See what actually changed, semantically
> Show me the semantic diff of my staged changes
```

## Development

```bash
pnpm install
pnpm test           # unit + integration + smoke (~2 s)
pnpm test:watch     # watch mode
pnpm test:coverage  # coverage report
pnpm typecheck      # tsc --noEmit
pnpm check          # biome ci (lint + format)
pnpm lint:fix       # auto-fix
pnpm format         # auto-format
```

### Test layers

| Layer | Count | What it tests |
|-------|-------|---------------|
| **Unit** | ~90 tests | Tool logic, argument construction, output parsing — `exec` mocked with `vi.fn()` |
| **Integration** | 7 tests | Real pi runtime + real tool registration + mocked `sem` subprocess |
| **Smoke** | 1 test | `npm pack` → install → load in real pi; all 4 tools present |

## License

MIT
