# sem-pi

A [pi coding agent](https://github.com/earendil-works/pi) extension that exposes [sem](https://github.com/piotr-oles/sem) as agent tools — giving the model semantic understanding of code structure without reading entire files.

[![CI](https://github.com/piotr-oles/sem-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/piotr-oles/sem-pi/actions/workflows/ci.yml)

## Tools

| Tool | Description |
|------|-------------|
| `sem_context` | Get token-budgeted context for a named entity (function, class, method, variable). Returns the entity's full source plus key dependencies within a token budget. Much cheaper than reading the whole file when you only need to understand one symbol. |
| `sem_entities` | List all code entities in a file or directory — a compact tree of symbols with type and line range. Use to discover what exists before diving in. |
| `sem_impact` | Show the impact of changing an entity: direct dependencies, direct dependents, transitive blast radius, and affected tests. Use before modifying anything to understand what else might break. |
| `sem_diff` | Semantic diff grouped by entity rather than raw line diffs. Supports working tree, staged, and commit ranges. |

## Requirements

- [pi coding agent](https://github.com/earendil-works/pi) ≥ 0.74
- [sem](https://github.com/piotr-oles/sem) on `PATH`

## Installation

```bash
pi ext add piotr-oles/sem-pi
```

Or add it to your pi config directly:

```json
{
  "extensions": ["piotr-oles/sem-pi"]
}
```

## Usage examples

Once installed, the tools are available to the model in any pi session. You can also invoke them explicitly:

```
# Understand what a function does without reading the whole file
> Get me the context for the AuthService class with a 3000-token budget

# Discover the structure of a module before editing it
> List all entities in src/auth/

# Check the blast radius before refactoring
> What would be impacted if I change the login() function?

# See what actually changed, semantically
> Show me the semantic diff of my staged changes
```

## Development

```bash
pnpm install
pnpm test          # unit + integration + smoke (all ~2 s)
pnpm test:watch    # watch mode
pnpm test:coverage # coverage report
```

### Test layers

| Layer | Count | What it tests |
|-------|-------|---------------|
| **Unit** | ~90 tests | Tool logic, argument construction, output parsing — `exec` mocked with `vi.fn()` |
| **Integration** | 7 tests | Real pi runtime + real tool registration + mocked `sem` subprocess |
| **Smoke** | 1 test | `npm pack` → install → load in real pi runtime; all 4 tools present |

The integration and smoke tests use [`@marcfargas/pi-test-harness`](https://github.com/marcfargas/pi-test-harness). The type-check step (`tsc --noEmit`) runs against the real `@earendil-works/pi-coding-agent` types so any API drift is caught at compile time, not runtime.

## License

MIT
