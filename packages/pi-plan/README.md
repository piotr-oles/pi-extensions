# pi-plan

A [pi coding agent](https://github.com/earendil-works/pi) extension that adds a `plan` tool — lets the agent save a named markdown plan to disk, open it in Zed for review, and wait for user confirmation before proceeding.

## Install

```bash
pi install npm:@piotr-oles/pi-plan
```

## Usage

The extension registers a `plan` tool the agent can call when proposing a multi-step implementation plan. Instruct the agent to use it:

```
Use plan tool when proposing a multi-step implementation plan that requires user review.
```

Or reference it in a prompt template / skill file to enforce it project-wide.

## How it works

When the agent calls `plan`:

1. Writes the markdown plan to `~/.pi/plan/<repo>/<name>.md`
2. Opens the file in Zed
3. Commits the file to a git repo inside `~/.pi/plan/` (one repo shared across all projects)
4. Shows an interactive widget in the terminal with three options:
   - **Notify about changes** — re-reads the file, commits the new version, sends a `git diff` of your edits back to the agent
   - **Confirm the plan** — commits the file and tells the agent to proceed (diff included if you edited it)
   - **Other** — type a free-form message to continue the conversation

Plan content is rendered as formatted markdown in the terminal as the agent writes it.

## Diff format

Changes are reported using native `git diff` output (hunk headers and `+`/`-` lines), with file path metadata stripped. This gives the agent precise, unambiguous context about what you changed.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```

To test changes manually, pass the source entry point directly to pi:

```bash
pi -ne -e packages/pi-plan/src/index.ts
```
