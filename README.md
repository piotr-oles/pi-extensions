# pi-extensions

[![CI](https://github.com/piotr-oles/pi-extensions/actions/workflows/ci.yml/badge.svg)](https://github.com/piotr-oles/pi-extensions/actions/workflows/ci.yml)

A monorepo of [pi coding agent](https://github.com/earendil-works/pi) extensions, built and tested together under `packages/`.

## Packages

| Package | Description |
|---------|-------------|
| [`sem-pi`](packages/sem-pi) | Exposes [sem](https://github.com/piotr-oles/sem) as agent tools — semantic code navigation without reading entire files |

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
2. Add a `package.json` with a `"pi": { "extensions": ["./src/index.ts"] }` field and the standard scripts (`test`, `typecheck`, `check`)
3. Add a `tsconfig.json` extending `../../tsconfig.base.json`
4. CI picks it up automatically via `pnpm -r`

## License

MIT
