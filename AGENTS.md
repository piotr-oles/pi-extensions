# AGENTS.md

Guidelines for AI coding agents working in this repository.

## What this repo is

A pnpm monorepo of [pi coding agent](https://github.com/earendil-works/pi) extensions. Each package under `packages/` is a self-contained pi extension that can be installed by users into their pi config.

## Packages

### `pi-fence` (`packages/pi-fence`)
Hooks into pi's `tool_call` / `tool_result` events to detect decorative fence/divider comments being written (e.g. `// ---- section ----`, `// ===== Title =====`). Operates in three modes controlled by the `pi-fence-mode` flag:

- **warn** (default) - appends a warning to the tool result after writing
- **block** - returns `{ block: true }` before the write happens
- **remove** - strips the fence comments from the content before writing

Uses [tree-sitter](https://tree-sitter.github.io/) to parse comment nodes. Supports JS/TS, Python, Go, and Rust.

### `pi-caveman` (`packages/pi-caveman`)
Makes the agent respond in caveman mode - cuts ~75% of output tokens while keeping full technical accuracy. Injects a level-specific instruction file into the system prompt at session start. Level is controlled by the `pi-caveman` flag (`lite`, `full`, `ultra`, or `off`; default: `full`).

### `pi-plan` (`packages/pi-plan`)
Adds a `review-plan` tool that writes a named markdown plan to `~/.pi/plan/<repo>/<name>.md`, commits it to a git repo inside `~/.pi/plan/`, and shows an interactive terminal widget so the user can confirm, request changes, or reply freely before the agent proceeds. The widget also offers an **Open in [Editor]** option (Zed, VS Code, Cursor, Windsurf) detected automatically via `TERM_PROGRAM`; selecting it opens the file in the IDE and re-shows the widget without notifying the agent.

### `pi-cwd` (`packages/pi-cwd`)
Detects absolute cwd paths in `read`, `write`, `edit`, and `bash` tool calls. Appends tip to tool result reminding agent to use relative paths and showing current `cwd`. Also injects `PROMPT_INSTRUCTIONS` into system prompt at session start.

Controlled by `pi-cwd` boolean flag (default: `true`).

### `pi-subagents` (`packages/pi-subagents`)
Lets the agent spawn specialized subagents — each in its own isolated session with its own model, tools, skills, and instructions. Templates are markdown files with YAML frontmatter stored in `~/.pi/agents/subagents/<name>.md` (global) or `.pi/subagents/<name>.md` (project). A project template overrides a global one with the same name.

Exposes a single `subagent` tool:
- **spawn**: call with `name`, `description`, `prompt` — blocks until the subagent finishes, returns its result
- **follow-up**: call again with the same `id` from a previous result plus a new `prompt` to continue the session

Subagents cannot spawn further subagents. Concurrency is capped at `pi-subagents-max-concurrent` (default: 4); excess agents queue and start as slots free.

Frontmatter fields: `description`, `model`, `thinking`, `max_turns`, `grace_turns`, `included_tools`, `included_skills`, `included_subagents`, `enabled`.

The `subagent:templates` command opens an interactive terminal menu listing all loaded templates with their source and model.

### `pi-reflag` (`packages/pi-reflag`)
Intercepts `bash` tool calls and rewrites `grep` → `rg` (ripgrep) and `find` → `fd` transparently before execution. Shows a user-visible toast notification on rewrite - agent never sees it.

- **grep → rg**: drops `-r`/`-R`/`-E`, maps long flags, converts `--include`/`--exclude` to `-g` globs, converts BRE patterns to ERE.
- **find → fd**: translates `-name`/`-iname` to `-g` globs (OR patterns become brace expansion), `-type`, `-maxdepth`/`-mindepth`, `-exec`/`-execdir`, `-mtime`/`-size`/`-user`/`-group` and more. Always adds `-H` (fd excludes hidden files by default, find doesn't).
- **xargs**: `xargs grep`/`xargs find` rewrites are also supported.

Skips commands with subshells or variable assignments. Enable verbose logging with `pi-reflag-verbose` flag to see rewrites in the UI.

## Tech stack

- **Runtime**: Node.js ≥ 22.19.0, ESM throughout (`"type": "module"`)
- **Language**: TypeScript 5, strict
- **Package manager**: pnpm 10 with workspaces
- **Linter/formatter**: Biome
- **Tests**: Vitest
- **Releases**: Changesets

## Development commands

```bash
pnpm install                  # install workspace deps
pnpm test                     # run all tests across packages
pnpm typecheck                # tsc --noEmit across packages
pnpm fix                      # check and auto-fix
pnpm validate:release         # dry-run semantic-release for all packages
```

## Git hooks

Pre-commit runs biome check, typecheck, and tests in parallel via Lefthook (`lefthook.yml` at root). Hook config is committed; the `.git/hooks/pre-commit` wrapper is not (lives outside version control).

After clone:

```bash
mkdir -p .git/hooks && printf '#!/usr/bin/env bash\nset -euo pipefail\npnpm lefthook run pre-commit\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Run hooks manually:

```bash
pnpm lefthook run pre-commit
```

> A global `core.hooksPath` may intercept hooks and delegate to `.git/hooks/` via a `run-local-hooks` shim. Lefthook cannot auto-install into a custom hooks path, so the wrapper is created manually.

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

Tests live in `src/` inside each package. Vitest is the test runner.

`pi-fence` uses the [`@marcfargas/pi-test-harness`](https://www.npmjs.com/package/@marcfargas/pi-test-harness) package to simulate pi events against the extension.

## Adding a new package

1. `mkdir packages/<name>`
2. `packages/<name>/package.json` - include:
   - `"type": "module"`
   - `"pi": { "extensions": ["./src/index.ts"] }`
   - scripts: `test`, `typecheck`, `check`, `fix`
3. `packages/<name>/tsconfig.json` - extend `../../tsconfig.base.json`
4. `packages/<name>/src/index.ts` - default-export a function `(pi: ExtensionAPI) => void`
5. CI picks it up automatically via `pnpm -r`

For publishable packages, also add `"publishConfig": { "access": "public" }` and `"files"` to `package.json`. Private packages set `"private": true`.

## CI

`.github/workflows/ci.yml` - runs `test`, `typecheck`, `check`, and dry-run release on every PR.
`.github/workflows/release.yml` - semantic-release on push to `main`; each package releases independently.

## Releases

Releases are automated via semantic-release on push to `main`. Each package releases independently based on commits that touch it.

Conventional commit format is required and enforced by commitlint (commit-msg hook via lefthook):

- `fix:` → patch
- `feat:` → minor
- `feat!:` / `BREAKING CHANGE:` → major
- `chore:`, `docs:`, `refactor:`, `test:` → no release

Tag format: `@piotr-oles/<pkg>@<version>`. Each package gets its own `CHANGELOG.md`.

Dry run (no publish, no tags): `pnpm validate:release`

### Migration note

Before first semantic-release run on a new repo, create tags for existing package versions so semantic-release knows the baseline:

```bash
git tag @piotr-oles/pi-caveman@0.1.0
git tag @piotr-oles/pi-cwd@0.3.0
git tag @piotr-oles/pi-fence@0.1.0
git tag @piotr-oles/pi-plan@0.2.0
git tag @piotr-oles/pi-reflag@0.3.0
git tag @piotr-oles/pi-subagents@0.2.0
git push --tags
```
