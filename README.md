# pi-extensions

A monorepo of [pi coding agent](https://github.com/earendil-works/pi) extensions, built and tested together under `packages/`.

## Packages

| Package | Description |
|---------|-------------|
| [`@piotr-oles/pi-fence`](packages/pi-fence) | Detects and handles decorative fence/divider comments in written code — warn, block, or auto-remove |
| [`@piotr-oles/pi-caveman`](packages/pi-caveman) | Makes the agent respond in caveman mode — cuts ~75% of output tokens while keeping full technical accuracy |
| [`@piotr-oles/pi-plan`](packages/pi-plan) | Adds a `plan` tool — saves a named markdown plan to disk, opens it for review, and waits for user confirmation before proceeding |
| [`@piotr-oles/pi-reflag`](packages/pi-reflag) | Transparently rewrites `grep` → `rg` (ripgrep) and `find` → `fd` before they execute — faster searches, zero agent behavior change |
| [`@piotr-oles/pi-cwd`](packages/pi-cwd) | Reminds agent to use relative paths — detects absolute cwd paths in `read`/`write`/`edit`/`bash` calls and appends a tip to the tool result |
| [`@piotr-oles/pi-subagents`](packages/pi-subagents) | Lets the agent spawn specialized subagents — each running in its own isolated session with its own model, tools, and instructions |

## Development

```bash
pnpm install        # install all workspace dependencies
pnpm test           # run all package tests
pnpm typecheck      # type-check all packages
pnpm check          # lint + format check (biome ci)
pnpm fix            # auto-fix lint and format issues
```

Each package has its own `README.md` with installation and usage instructions.

### Git hooks

Pre-commit hooks run biome check, typecheck, and tests via [Lefthook](https://github.com/evilmartians/lefthook). After cloning, create the hook once:

```bash
mkdir -p .git/hooks && printf '#!/usr/bin/env bash\nset -euo pipefail\npnpm lefthook run pre-commit\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

> The extra setup step is needed because a global `core.hooksPath` intercepts git hooks and delegates to `.git/hooks/` — lefthook cannot auto-install there.

## Adding a new extension

1. `mkdir packages/<name>`
2. Add a `package.json` with `"type": "module"`, a `"pi": { "extensions": ["./src/index.ts"] }` field, and scripts: `test`, `typecheck`, `check`, `fix`
3. Add a `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `src/index.ts` with a default-exported function `(pi: ExtensionAPI) => void`
5. CI picks it up automatically via `pnpm -r`

For publishable packages add `"publishConfig": { "access": "public" }` and a `"files"` list. Private packages set `"private": true`.

## Releases

Releases are fully automated via [semantic-release](https://semantic-release.gitbook.io/) on every push to `main`. Each package releases independently based on commits that touch it.

### Commit convention

[Conventional Commits](https://www.conventionalcommits.org/) are required and enforced by [commitlint](https://commitlint.js.org/) on every commit:

| Commit type | Version bump |
|-------------|-------------|
| `fix:` | patch (`0.0.x`) |
| `feat:` | minor (`0.x.0`) |
| `feat!:` or `BREAKING CHANGE:` footer | major (`x.0.0`) |
| `chore:`, `docs:`, `refactor:`, `test:` | no release |

Scoping is optional but encouraged: `feat(pi-fence): add rust support`.

### What happens on merge

1. CI checks which packages have relevant commits since their last tag
2. For each such package: bumps version, updates `CHANGELOG.md`, publishes to npm, creates a GitHub Release
3. Version bumps are committed back to `main` with `[skip ci]`

Tags follow the format `@piotr-oles/<pkg>@<version>`, e.g. `@piotr-oles/pi-fence@0.2.0`.

### Dry run

```bash
pnpm validate:release   # preview what would release without publishing
```

## License

MIT
