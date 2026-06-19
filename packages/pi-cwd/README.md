# pi-cwd

Pi Agent extension that reminds you to use relative paths to reduce context usage.

When agent uses absolute paths in `read`, `write`, `edit`, or `bash` tool calls, extension appends tip to tool response showing current working directory.

## Usage

Install via pi config:

```bash
pi install npm:@piotr-oles/pi-cwd
```

## Behavior

When agent calls tool with absolute path:

```bash
read /Users/john/project/src/file.ts
```

Tool result gets reminder appended:

> Tip: Use relative paths. Current cwd: /Users/john/project

Extension doesn't block tool execution - just reminds agent for next time.

## Detection

- **read/write/edit**: Checks if `path` parameter starts with cwd path.
- **bash**: Checks if command includes absolute cwd path.
