# pi-file-link

Shows local Markdown links in Pi replies as `file://` links. Use Cmd+Click in Zed on macOS or Ctrl+Click on Linux and Windows to open the file.

## Install

Requires Pi 1.6.0 or later.

```bash
pi install npm:@piotr-oles/pi-file-link
```

To try the extension from this repository without installing it in Pi:

```bash
npm install
pi -e ./packages/pi-file-link/src/index.ts
```

## Link format

The extension operates on inline Markdown links in assistant replies. Relative paths use the session working directory.

| Reply Markdown | Link destination (working directory: `/work/repo`) |
| --- | --- |
| `[Source](src/index.ts)` | `file:///work/repo/src/index.ts` |
| `[Line 10](src/index.ts#L10)` | `file:///work/repo/src/index.ts:10` |
| `[Line and column](src/index.ts:10:3)` | `file:///work/repo/src/index.ts:10:3` |

The extension keeps link labels, web links, existing `file://` links, code, images, reference-style links, and plain paths unchanged. It changes only terminal display, not saved messages or model context.
