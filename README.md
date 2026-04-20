# ki-statusline

A lightweight statusline for **Kiro CLI** — shows session ID, working directory, active agents, quota usage, and recent events.

## Features

- **Session ID** — current session identifier
- **Directory** — current working directory (last 2 components)
- **Agent tracker** — shows number of active subagents
- **Uptime** — how long the session has been running
- **Recent events** — last tool call or agent stop event
- **Quota display** — reads Kiro's local SQLite DB for credits usage, bonus credits, burn rate prediction
- **Plan badge** — shows plan name (Pro/Free/Team)
- **Themes** — default, nord, catppuccin, dracula
- **Powerline mode** — beautiful separators (requires Nerd fonts)

## Configuration

All settings are in `lib/config.js`. Override via:

**Option 1: JSON config** — create `~/.kiro/ki-statusline-config.json`:
```json
{
  "theme": "catppuccin",
  "powerline": true,
  "burnHistorySize": 48,
  "showAgentCount": true,
  "showUptime": true,
  "showLastEvent": true
}
```

**Option 2: Env vars:**
```bash
export KI_STATUSLINE_THEME=dracula
export KI_STATUSLINE_POWERLINE=false
```

## Themes

Available: `default`, `nord`, `catppuccin`, `dracula`

## Installation

```bash
git clone https://github.com/sammylin/ki-statusline ~/.ki-statusline
cd ~/.ki-statusline
npm install  # for better-sqlite3
```

Then configure Kiro hooks in `~/.kiro/settings.json`:

```json
{
  "hooks": {
    "agentSpawn": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node ~/.ki-statusline/hooks/agent-tracker.js spawn" }] }],
    "agentStop": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node ~/.ki-statusline/hooks/agent-tracker.js stop" }] }]
  }
}
```

## Quota Display

ki-statusline reads Kiro's local SQLite DB at:
```
~/.kiro/data/User/globalStorage/state.vscdb
```

Shows:
- Credits usage bar + `used/total`
- Bonus credits (if any)
- Precise reset time with countdown
- Burn rate prediction

## Requirements

- Kiro CLI (kiro.dev)
- Node.js 16+
- `better-sqlite3` npm package
- Nerd font (optional, for pretty separators)

## Architecture

- `statusline.js` — main statusline, reads hook events via stdin, writes ANSI output
- `lib/quota.js` — reads Kiro's local SQLite DB for quota info
- `lib/config.js` — configuration
- `hooks/agent-tracker.js` — Kiro hook script for agentSpawn/agentStop events
- State stored in `~/.kiro/ki-statusline.json`

## License

MIT
