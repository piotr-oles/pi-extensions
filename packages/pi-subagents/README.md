# pi-subagents

A [pi coding agent](https://github.com/earendil-works/pi) extension that lets the agent spawn specialized subagents — each running in its own isolated session with its own model, tools, and instructions.

## Install

```bash
pi install npm:@piotr-oles/pi-subagents
```

## Agent templates

Define agents as markdown files with YAML frontmatter. Two locations are supported:

| Location | Scope |
|---|---|
| `~/.pi/agents/subagents/<name>.md` | Global — available in all projects |
| `.pi/subagents/<name>.md` | Project — available in current project only |

A project template overrides a global template with the same name.

**Example** `.pi/subagents/coder.md`:

```markdown
---
description: Specialist for writing and editing code
model: anthropic/claude-opus-4-5
thinking: low
max_turns: 30
included_tools: bash, read, edit, write
---

You are an expert software engineer. Focus only on the assigned task.
Write clean, well-tested code. Do not ask for clarification — make reasonable assumptions.
```

**Frontmatter fields:**

| Field | Type | Description |
|---|---|---|
| `description` | string | Short description shown in the UI. Defaults to the filename. |
| `model` | string | Model to use (e.g. `anthropic/claude-haiku-4-5`). Inherits from parent session if omitted. |
| `thinking` | string | Thinking level: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`. |
| `max_turns` | number | Hard turn limit. When reached the agent is given grace turns to wrap up. |
| `grace_turns` | number | Extra turns after `max_turns` before the agent is force-stopped. |
| `enabled` | boolean | Set to `false` to disable this agent type without deleting the file. |
| `included_tools` | string | Comma-separated list of tool names available to this agent. Omit to inherit all tools from the parent session. |
| `included_skills` | string | Comma-separated list of skill names available to this agent. Omit to inherit all skills. |
| `included_subagents` | string | Comma-separated list of subagent template names this agent may spawn. |

If no matching template is found the agent falls back to `general-purpose`, or a plain default if that is also absent.

## Tools

### `subagent`

Spawns a subagent to handle a task, or follows up on a previously completed one.

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Name of the agent template to use. Required for both spawn and follow-up. |
| `id` | string | ID of a done subagent to follow-up. Omit when spawning fresh. |
| `description` | string | Short description of the task (shown in UI). |
| `prompt` | string | Task prompt sent to the subagent. |

Blocks until the subagent completes and returns its result inline. To follow up on a finished subagent, call `subagent` again with the `id` returned in the previous result plus a new `prompt`.

## How it works

1. On `session_start`, templates are reloaded from disk.
2. When `subagent` is called, the extension resolves the template, builds an `AgentConfig`, and starts an isolated pi session.
3. The subagent session inherits the parent's model registry and working directory but gets its own system prompt built from the template's instructions.
4. The `subagent` tool is always excluded from subagent sessions — subagents cannot spawn further subagents.
5. A concurrency queue limits how many agents run simultaneously; excess agents are queued and started as slots free up.

## Flags

```bash
pi --pi-subagents-max-concurrent 4    # max agents running at once (default: 4)
```

Or via environment variable:

```bash
PI_SUBAGENTS_MAX_CONCURRENT=2 pi
```

## `subagent:templates` command

Opens an interactive menu listing all loaded agent templates with their source (global `◦` / project `•`) and model. Run via the pi command palette.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```

To test changes manually, pass the source entry point directly to pi:

```bash
pi -ne -e packages/pi-subagents/src/index.ts
```
