# AGENTS.md

Guidelines for AI coding agents working in this repository.

## What this repo is

A pnpm monorepo of [pi coding agent](https://github.com/earendil-works/pi) extensions. Each package under `packages/` is a self-contained pi extension that can be installed by users into their pi config.

## Packages

### `pi-fence` (`packages/pi-fence`)
Hooks into pi's `tool_call` / `tool_result` events to detect decorative fence/divider comments being written (e.g. `// ---- section ----`, `// ===== Title =====`). Operates in three modes controlled by the `pi-fence-mode` flag:

- **warn** (default) — appends a warning to the tool result after writing
- **block** — returns `{ block: true }` before the write happens
- **remove** — strips the fence comments from the content before writing

Uses [tree-sitter](https://tree-sitter.github.io/) to parse comment nodes. Supports JS/TS, Python, Go, and Rust.

### `pi-caveman` (`packages/pi-caveman`)
Makes the agent respond in caveman mode — cuts ~75% of output tokens while keeping full technical accuracy. Injects a level-specific instruction file into the system prompt at session start. Level is controlled by the `pi-caveman` flag (`lite`, `full`, `ultra`, or `off`; default: `full`).

### `pi-plan` (`packages/pi-plan`)
Adds a `review-plan` tool that writes a named markdown plan to `~/.pi/plan/<repo>/<name>.md`, opens it in Zed, commits it to a git repo inside `~/.pi/plan/`, and shows an interactive terminal widget so the user can confirm, request changes, or reply freely before the agent proceeds.

### `pi-sem` (`packages/pi-sem`) — private
Wraps the [`sem`](https://github.com/piotr-oles/sem) CLI as four pi tools: `sem_context`, `sem_entities`, `sem_impact`, `sem_diff`. Gives the model semantic understanding of code structure without reading entire files.

## Tech stack

- **Runtime**: Node.js ≥ 22.19.0, ESM throughout (`"type": "module"`)
- **Language**: TypeScript 5, strict
- **Package manager**: pnpm 10 with workspaces
- **Linter/formatter**: Biome
- **Tests**: Vitest
- **Releases**: Changesets (`pi-fence`, `pi-caveman`, and `pi-plan` are published; `pi-sem` is private)

## Development commands

```bash
pnpm install                  # install workspace deps
pnpm test                     # run all tests across packages
pnpm typecheck                # tsc --noEmit across packages
pnpm fix                      # check and auto-fix
```

## Conventions

### No fence/divider comments
`pi-fence` itself is active in this repo. Do not write decorative separator comments like:

```ts
// ---- helpers ----
// ===== Section =====
// *** utilities ***
```

Use named functions, classes, or blank lines to separate logical sections instead.

### ESM imports require `.js` extensions
All local imports must use `.js` extensions (compiled output convention), even though the source files are `.ts`:

```ts
import { isFenceComment } from "./fence.js";  // correct
import { isFenceComment } from "./fence.ts";  // wrong
import { isFenceComment } from "./fence";     // wrong
```

### Biome for formatting and linting
Do not configure Prettier or ESLint. All formatting and linting goes through Biome (`biome.json` at root).

## Extension entry point contract

Each package's `src/index.ts` must `export default` a function with the signature:

```ts
export default function myExtension(pi: ExtensionAPI): void { ... }
```

This is what pi loads from the `"pi": { "extensions": [...] }` field in `package.json`.

## Testing approach

Tests live in `src/` (or `src/tests/` for `pi-sem`) inside each package. Vitest is the test runner.

`pi-fence` uses the [`@marcfargas/pi-test-harness`](https://www.npmjs.com/package/@marcfargas/pi-test-harness) package to simulate pi events against the extension.

`pi-caveman` uses simple unit tests that verify instruction files load correctly and contain the expected directives.

`pi-sem` uses three layers:
- **Unit** — tool logic with `exec` mocked via `vi.fn()`
- **Integration** — real pi runtime + mocked `sem` subprocess
- **Smoke** — `npm pack` → install → load in real pi

## Adding a new package

1. `mkdir packages/<name>`
2. `packages/<name>/package.json` — include:
   - `"type": "module"`
   - `"pi": { "extensions": ["./src/index.ts"] }`
   - scripts: `test`, `typecheck`, `check`, `fix`
3. `packages/<name>/tsconfig.json` — extend `../../tsconfig.base.json`
4. `packages/<name>/src/index.ts` — default-export a function `(pi: ExtensionAPI) => void`
5. CI picks it up automatically via `pnpm -r`

For publishable packages, also add `"publishConfig": { "access": "public" }` and `"files"` to `package.json`. Private packages set `"private": true`.

## CI

`.github/workflows/ci.yml` — runs `test`, `typecheck`, `check` on every PR.  
`.github/workflows/release.yml` — Changesets release flow on `main`: opens a Version Packages PR while changesets are pending, publishes to npm once merged.
