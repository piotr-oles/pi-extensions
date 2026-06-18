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

## Adding a new extension

1. `mkdir packages/<name>`
2. Add a `package.json` with `"type": "module"`, a `"pi": { "extensions": ["./src/index.ts"] }` field, and scripts: `test`, `typecheck`, `check`, `fix`
3. Add a `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `src/index.ts` with a default-exported function `(pi: ExtensionAPI) => void`
5. CI picks it up automatically via `pnpm -r`

For publishable packages add `"publishConfig": { "access": "public" }` and a `"files"` list. Private packages set `"private": true`.

## Releases

Published packages are released via [Changesets](https://github.com/changesets/changesets). To cut a release:

```bash
pnpm changeset   # describe your change, then commit the generated file
```

Once the changeset is merged to `main`, CI opens a **Version Packages** PR that bumps versions and updates changelogs. Merging that PR triggers the publish to npm automatically.

## License

MIT
