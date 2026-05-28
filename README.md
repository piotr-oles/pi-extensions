# pi-extensions

A monorepo of [pi coding agent](https://github.com/earendil-works/pi) extensions, built and tested together under `packages/`.

## Packages

| Package | Description |
|---------|-------------|
| [`pi-fence`](packages/pi-fence) | Detects and handles decorative fence/divider comments in written code — warn, block, or auto-remove |
| [`pi-sem`](packages/pi-sem) *(private)* | Exposes [sem](https://github.com/piotr-oles/sem) as agent tools — semantic code navigation without reading entire files |

## Development

```bash
pnpm install        # install all workspace dependencies
pnpm test           # run all package tests
pnpm typecheck      # type-check all packages
pnpm check          # lint + format check (biome ci)
pnpm lint:fix       # auto-fix lint issues
pnpm format         # auto-format all packages
```

Each package has its own `README.md` with installation and usage instructions.

## Adding a new extension

1. `mkdir packages/<name>`
2. Add a `package.json` with `"type": "module"`, a `"pi": { "extensions": ["./src/index.ts"] }` field, and scripts: `test`, `typecheck`, `check`, `lint:fix`, `format`
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
