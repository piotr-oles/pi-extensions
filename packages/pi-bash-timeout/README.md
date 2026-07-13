# @piotr-oles/pi-bash-timeout

Pi Agent extension that gives the `bash` tool a sane default timeout and tells the model about the timeout policy.

It intercepts the host `bash` tool via the `tool_call` event and injects a default `timeout` (in seconds) when the model omits it or passes a non-positive value. It also appends a "Bash Tool Timeout Policy" section to the system prompt via `before_agent_start` so the model sets explicit timeouts for long-running commands.

Ported from [`code-yeongyu/pi-bash-timeout`](https://github.com/code-yeongyu/pi-bash-timeout) and adapted to this repo (pi flags, upstream `isToolCallEventType` guard, in-place input mutation, colocated tests).

## Behavior

| Case | Result |
|------|--------|
| `timeout` omitted | inject default |
| `timeout <= 0` | treated as missing, inject default |
| `timeout` in range | preserved |
| `timeout` above max | preserved (max is advisory, not a hard cap) |

Non-`bash` tool calls are never touched.

## Configuration

Both pi flags and env vars are supported. Precedence: **flag > env var > built-in default**. Invalid or non-positive values are ignored and fall through to the next source.

| Setting | Flag | Env var | Default |
|---------|------|---------|---------|
| Default timeout (s) | `pi-bash-timeout-default` | `PI_BASH_DEFAULT_TIMEOUT_SECONDS` | `120` |
| Advisory max (s) | `pi-bash-timeout-max` | `PI_BASH_MAX_TIMEOUT_SECONDS` | `600` |

The max value only appears in prompt guidance; explicit `timeout` values are never capped. If `max` resolves lower than `default`, it is raised to `default`.

Env var names match `senpi-mono` for compatibility.

## License

MIT
