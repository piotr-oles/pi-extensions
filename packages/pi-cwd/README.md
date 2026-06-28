# pi-cwd

Pi Agent extension that reminds you to use relative paths to reduce context usage.

When agent uses absolute paths in `read`, `write`, `edit`, or `bash` tool calls, extension reacts according to configured mode.

## Usage

Install via pi config:

```bash
pi install npm:@piotr-oles/pi-cwd
```

## Modes

Controlled by `pi-cwd-mode` flag or `PI_CWD_MODE` env variable. Flag takes precedence.

| Mode | Behavior |
|------|----------|
| `warn` (default) | Appends tip to tool result reminding agent to use relative paths |
| `block` | Blocks tool call before execution and asks agent to retry with relative path |

## Detection

- **read/write/edit**: Checks if `path` parameter starts with cwd path.
- **bash**: Checks if command includes absolute cwd path.
