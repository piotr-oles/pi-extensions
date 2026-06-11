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
| `~/.pi/agents/<name>.md` | Global — available in all projects |
| `.pi/agents/<name>.md` | Project — available in current project only |

A project template overrides a global template with the same name.

**Example** `.pi/agents/coder.md`:

```markdown
---
description: Specialist for writing and editing code
model: anthropic/claude-opus-4-5
thinking: low
max_turns: 30
excluded_tools: edit, write
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
| `excluded_tools` | string | Comma-separated list of tool names to block for this agent. |

If no matching template is found the agent falls back to `general-purpose`, or a plain default if that is also absent.

## Tools

### `subagent`

Spawns a subagent to handle a task.

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Name of the agent template to use. |
| `description` | string | Short description of the task (shown in UI). |
| `prompt` | string | Task prompt sent to the subagent. |

Returns immediately with an agent ID. The parent is notified via a follow-up message when the subagent completes. Use `subagent_check` to retrieve the output.

### `subagent_check`

Check status and retrieve results from a background agent.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | string | ID returned by `subagent`. |
| `wait` | boolean | Block until the agent completes before returning. Default: `false`. |

### `subagent_steer`

Inject a steering message into a running background agent to redirect its work without restarting it.

| Parameter | Type | Description |
|---|---|---|
| `agent_id` | string | ID of a currently running agent. |
| `message` | string | Message to inject into the agent's conversation. |

## How it works

1. On `session_start` and on the `agents` command, templates are reloaded from disk.
2. When `subagent` is called, the extension creates an `AgentConfig` from the resolved template plus any per-call overrides, then starts an isolated pi session.
3. The subagent session inherits the parent's model registry and working directory but gets its own system prompt built from the template's `instructions`.
4. The `subagent`, `subagent_check`, and `subagent_steer` tools are always excluded from subagent sessions — subagents cannot spawn further subagents.
5. A concurrency queue limits how many agents run simultaneously; excess agents are queued and started as slots free up.

## Flags

```bash
pi --pi-subagents-max-concurrent 4    # max agents running at once (default: 4)
pi --pi-subagents-grace-turns 5       # extra turns after max-turns is hit (default: 5)
pi --pi-subagents-default-max-turns 0 # default turn limit, 0 = unlimited (default: 0)
```

Or via environment variables:

```bash
PI_SUBAGENTS_MAX_CONCURRENT=2 pi
PI_SUBAGENTS_GRACE_TURNS=3 pi
PI_SUBAGENTS_DEFAULT_MAX_TURNS=20 pi
```

## `agents` command

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
