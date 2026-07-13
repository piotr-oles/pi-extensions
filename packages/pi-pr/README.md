# pi-pr

A [pi coding agent](https://github.com/earendil-works/pi) extension that shows
the current branch's GitHub pull request in the footer: a clickable `#n` link,
the CI status, a conflict alarm when the PR can't merge cleanly, and the review
verdict.


```
approved:          model (branch)  …  #123 ●✓
changes requested: model (branch)  …  #123 ●✗
review pending:    model (branch)  …  #123 ●
conflict:          model (branch)  …  #123 ●‼✗
                                      ^^^^ ^^^
                                      link indicators
```

## What it does

On session start (and every poll interval after) it runs `gh pr view` for the
current branch and renders the result via `ctx.ui.setStatus("pi-pr", …)`, which
coexists with pi's built-in footer.

- **`#n`** — the PR number, wrapped in an OSC 8 hyperlink to the PR URL, colored
  by lifecycle: draft = dim, open = default text, merged = muted, closed = error (red).
- **`●` CI** — aggregated check rollup: success = green, failure = red,
  running = yellow, none = dim. Always rendered (`none` dim so its position
  stays stable).
- **`‼` conflict** — red, shown **only** when the PR has merge conflicts
  (`clean`/`unknown` merge states render nothing).
- **review verdict** — shown **only** when a decision exists: `✓` green when
  approved, `✗` red when changes are requested. `review_required`/`none` render
  nothing.

Glyphs keep a fixed order: CI, then conflict, then review verdict. Only `●`
always shows; the conflict and review glyphs appear/disappear with state.

When there is no PR for the branch, the directory is not a GitHub repo, `gh` is
missing or unauthenticated, or any error occurs, the extension is silent: it
clears its status and shows nothing.

## Requirements

- The [`gh`](https://cli.github.com/) CLI, authenticated (`gh auth login`).
- A terminal that supports OSC 8 hyperlinks for the clickable `#n` (plain text
  otherwise — no breakage).

## Command

- **`/pr`** — open the current branch's PR in the browser (`gh pr view --web`)
  and force an immediate status refresh.

## Flags

- `pi-pr-interval` (default `30`) — poll interval in seconds. Floored at 5s to
  avoid abuse and API rate limits. (Registered as a string flag because pi flags
  are boolean or string only; the value is parsed as a number at use.)

## Notes

- Polling uses a fixed `setInterval` with an overlap guard, so a slow `gh` call
  never piles up. A branch switch is reflected within one interval; `/pr` forces
  an immediate refresh.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```

To test changes manually:

```bash
pi -e packages/pi-pr/src/index.ts
```
