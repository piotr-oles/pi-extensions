# pi-cwd

Pi Coding Agent extension that forces agent to use relative paths to reduce context usage.

When agent uses absolute paths in `read`, `write`, `edit`, or `bash` tool calls, extension blocks that call and reminds agent to use relative paths.

## Usage

Install via pi config:

```bash
pi install npm:@piotr-oles/pi-cwd
```

## Detection

- **read/write/edit**: Checks if `path` parameter starts with cwd path.
- **bash**: Checks if command includes absolute cwd path.
