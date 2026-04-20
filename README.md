# ki-statusline

A lightweight statusline for **Kiro CLI** — shows session ID, working directory, active agents, and recent events.

> Note: Kiro CLI doesn't expose cost/token/model data like Claude Code does, so this is a simpler statusline focused on session tracking.

## Features

- **Session ID** — current session identifier
- **Directory** — current working directory (last 2 components)
- **Agent tracker** — shows number of active subagents
- **Uptime** — how long the session has been running
- **Recent events** — last tool call or agent stop event
- **Themes** — default, nord, catppuccin, dracula
- **Powerline mode** — beautiful separators (requires Nerd/Powerline font)

## Installation

```bash
git clone https://github.com/sammylin/ki-statusline ~/.ki-statusline
cd ~/.ki-statusline
```

Then configure Kiro to use the hook scripts. Add to your `~/.kiro/settings.json`:

```json
{
  "hooks": {
    "agentSpawn": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node ~/.ki-statusline/hooks/agent-tracker.js spawn" }] }],
    "agentStop": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node ~/.ki-statusline/hooks/agent-tracker.js stop" }] }]
  }
}
```

For statusline display, create a wrapper script:

```bash
#!/bin/bash
# Run kiro and show statusline
~/.ki-statusline/statusline.js &
KIRO_PID=$!
kiro-cli chat "$@"
kill $KIRO_PID 2>/dev/null
```

## Themes

Change `THEME` at top of `statusline.js`:

```javascript
const THEME = 'catppuccin'; // 'default' | 'nord' | 'catppuccin' | 'dracula'
```

## Requirements

- Kiro CLI (kiro.dev)
- Node.js 16+
- Powerline/Nerd font (optional, for pretty separators)

## Architecture

- `statusline.js` — main statusline, reads hook events via stdin, writes ANSI output
- `hooks/agent-tracker.js` — Kiro hook script for agentSpawn/agentStop events
- State stored in `~/.kiro/ki-statusline.json`

## License

MIT
