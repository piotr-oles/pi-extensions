# pi-plan

A [pi coding agent](https://github.com/earendil-works/pi) extension that adds a `review-plan` tool — lets the agent write a named markdown plan to disk and present it in an interactive terminal widget for the user to approve, request changes, or ask a question before execution begins.

## Install

```bash
pi install npm:@piotr-oles/pi-plan
```

## Usage

The extension registers a `review-plan` tool. The intended workflow is:

1. The agent writes the plan file using the built-in `write` tool (path under `~/.pi/plan/<repo>/<name>.md`)
2. The agent calls `review-plan` with the relative path

Instruct the agent to follow this pattern:

```
Write the plan file to ~/.pi/plan/<repo>/<name>.md first, then call review-plan with the relative path.
```

Or reference it in a prompt template / skill file to enforce it project-wide.

## How it works

When the agent calls `review-plan`:

1. Ensures `~/.pi/plan/` is a git repository (initialises it on first use)
2. Commits the plan file with message `create: <name>.md`
3. Hides the working indicator and shows an interactive widget with the following options:
   - **Open in [Editor]** *(shown when running inside Zed, VS Code, Cursor, or Windsurf)* — opens the plan file in your IDE so you can edit it; the widget stays open so you can still approve or request changes afterwards
   - **Request changes** — edit the file then select this; the agent gets a diff of your edits and is told to update the plan, then call `review-plan` again
   - **Approve** — edit the file (optionally) then select this; the agent gets a diff of any edits and is told to proceed with execution
   - **Ask question** — type a free-form question; the agent receives it and can reply before you decide

4. After the user responds, any edits made to the file before selecting are committed (`approve: <name>.md` / `request-changes: <name>.md`) and a diff is computed and sent back to the agent

## Widget responses

| Selection | Agent receives |
|-----------|----------------|
| **Open in [Editor]** | Editor opens; widget re-shows with a `✓ Opened in …` confirmation. Agent is not notified. |
| **Approve** (no edits) | `approve` result, empty diff — told to proceed |
| **Approve** (with edits) | `approve` result + git diff — told to address comments, fix up plan, then proceed |
| **Request changes** (with edits) | `request-changes` result + git diff — told to address comments, update plan, call `review-plan` again |
| **Request changes** (no edits) | `request-changes` result, empty diff — told to ask the user what to change |
| **Ask question** | `question` result with the question text |
| **Esc / cancel** | `cancel` result |

## Git history

All plan versions are tracked in a git repo at `~/.pi/plan/`. Each interaction creates a commit:

- `create: <name>.md` — initial write by the agent
- `approve: <name>.md` — user approved (records any edits made before approving)
- `request-changes: <name>.md` — user requested changes (records edits)

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
