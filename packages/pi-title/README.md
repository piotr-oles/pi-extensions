# pi-title

Pi Agent extension that generates short session title from user messages.

On each agent turn, extension calls active model in background and sets concise, specific title (up to 40 characters) — no user action needed.

## Usage

Install via pi config:

```bash
pi install npm:@piotr-oles/pi-title
```

## Behavior

- Hooks `before_agent_start` — fires every turn until title is locked in.
- Title locks once total accumulated user prompt content (current + previous messages) reaches 40 chars.
- Generates title in background — agent starts immediately, no added latency.
- Uses same model and API key as active session.
- Sets session name via `pi.setSessionName()`.
- If model unavailable, throws and shows notification.

## `/title` command

Run `/title` anytime to regenerate title from recent prompts:

```
/title
```

Aborts any in-progress auto-generation, calls model with recent session context, and notifies when done.

## Title generation

Prompt instructs model to produce single sentence-case title (max 40 chars, no quotes), specific to task, file, or topic. When session already has title, model refines it if newer prompts add context.

Examples:

| First message | Generated title |
|---|---|
| "Add dark mode toggle to the settings page" | Add dark mode to settings page |
| "Why is the auth middleware throwing 401?" | Debug 401 in auth middleware |
| "Refactor UserService to use repository pattern" | Refactor UserService repository |

## Development

Test changes manually by passing source entry point to pi with `-e` flag:

```bash
pi -ne -e packages/pi-title/src/index.ts
```
