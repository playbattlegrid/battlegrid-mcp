# @battlegrid/mcp-server

[![npm version](https://img.shields.io/npm/v/@battlegrid/mcp-server)](https://www.npmjs.com/package/@battlegrid/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for [BattleGrid](https://battlegrid.trade) — play crypto prediction games from AI agents.

## Quick Start

### Single account (stdio transport)

```bash
BATTLEGRID_API_KEY=bg_live_xxx npx @battlegrid/mcp-server
```

### Multiple accounts (stdio transport)

```bash
BATTLEGRID_API_KEYS=bg_live_alice_key,bg_live_bob_key npx @battlegrid/mcp-server
```

When multiple keys are provided, the server discovers each account's identity and injects an `account` parameter into every tool so the AI agent can choose which account to act as.

### Remote server (streamable-http transport)

```
https://mcp.battlegrid.trade
```

No npm install required — connect directly from any MCP client that supports streamable-http.

## Configuration

### Claude Desktop

**Single account:**

```json
{
  "mcpServers": {
    "battlegrid": {
      "command": "npx",
      "args": ["@battlegrid/mcp-server"],
      "env": {
        "BATTLEGRID_API_KEY": "bg_live_xxx"
      }
    }
  }
}
```

**Multiple accounts:**

```json
{
  "mcpServers": {
    "battlegrid": {
      "command": "npx",
      "args": ["@battlegrid/mcp-server"],
      "env": {
        "BATTLEGRID_API_KEYS": "bg_live_alice_key,bg_live_bob_key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add battlegrid -- npx @battlegrid/mcp-server
```

Set your API key(s):

```bash
# Single account
export BATTLEGRID_API_KEY=bg_live_xxx

# Multiple accounts
export BATTLEGRID_API_KEYS=bg_live_alice_key,bg_live_bob_key
```

### Cursor

**Single account:**

```json
{
  "mcpServers": {
    "battlegrid": {
      "command": "npx",
      "args": ["@battlegrid/mcp-server"],
      "env": {
        "BATTLEGRID_API_KEY": "bg_live_xxx"
      }
    }
  }
}
```

**Multiple accounts:**

```json
{
  "mcpServers": {
    "battlegrid": {
      "command": "npx",
      "args": ["@battlegrid/mcp-server"],
      "env": {
        "BATTLEGRID_API_KEYS": "bg_live_alice_key,bg_live_bob_key"
      }
    }
  }
}
```

## Account Management

### Single Account

Set `BATTLEGRID_API_KEY` with one API key. All tool calls use that account — no extra parameters needed.

### Multiple Accounts

Set `BATTLEGRID_API_KEYS` with a comma-separated list of API keys (one per BattleGrid account). On startup the server:

1. Calls `GET /mcp/identity` for each key to discover the account username
2. Injects a required `account` enum parameter into every tool
3. Routes each tool call to the correct account using the matching Bearer token

The AI agent sees tools like this:

```json
{
  "name": "get_account_balance",
  "inputSchema": {
    "properties": {
      "account": {
        "type": "string",
        "enum": ["alice", "bob"],
        "description": "Which BattleGrid account to use for this action"
      }
    },
    "required": ["account"]
  }
}
```

If a key fails identity discovery (revoked, invalid), it is skipped with a warning. If all keys fail, the process exits.

`BATTLEGRID_API_KEYS` takes precedence over `BATTLEGRID_API_KEY` when both are set.

### Getting an API Key

1. Go to [battlegrid.trade](https://battlegrid.trade) → **Profile** → **MCP** tab
2. Generate an API key (format: `bg_live_*`)
3. Copy the key immediately — it is shown only once

Each account supports one active key at a time. Generating a new key automatically revokes the previous one.

For paid games, enable **Server-Signed Wagers** in the MCP tab to allow the agent to submit entries on your behalf.

## Skills

Install the BattleGrid skill for AI agent instructions:

```bash
npx skills add playbattlegrid/battlegrid-mcp
```

## Capabilities

### Tools (28)

| Category | Tools |
|----------|-------|
| **Market Grid** (7) | `list_market_grid_sessions`, `get_market_grid_session`, `check_market_grid_submission`, `submit_market_grid`, `get_market_grid_results`, `get_market_grid_player_grid`, `update_market_grid` |
| **Coin Grid** (6) | `list_coin_grid_sessions`, `get_coin_grid_session`, `check_coin_grid_submission`, `submit_coin_grid`, `get_coin_grid_results`, `get_coin_grid_player_grid` |
| **Account** (6) | `get_account_balance`, `get_user_profile`, `get_user_stats`, `list_user_favorites`, `add_user_favorite_preset`, `remove_user_favorite_preset` |
| **Leaderboard** (3) | `get_leaderboard`, `get_market_grid_leaderboard`, `get_hall_of_fame` |
| **Market Data** (4) | `get_coin_overview`, `get_recent_candles`, `get_top_ranked_coins`, `list_game_presets` |
| **Intelligence Agent** (2) | `list_intelligence_agents`, `get_intelligence_agent` |

### Prompts (5)

| Prompt | Description |
|--------|-------------|
| `play-market-grid` | End-to-end workflow for playing a Market Grid prediction game |
| `play-coin-grid` | End-to-end workflow for playing a Coin Grid prediction game |
| `analyze-market` | Deep market analysis for informed predictions |
| `check-performance` | Review your game results, stats, and leaderboard standing |
| `strategy-guide` | Learn BattleGrid game mechanics, rules, and strategies |

### Resources (3)

| Resource | URI |
|----------|-----|
| Game Rules | `battlegrid://rules/overview` |
| Grid Format Reference | `battlegrid://reference/grid-format` |
| Quick Start Guide | `battlegrid://guide/quick-start` |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BATTLEGRID_API_KEYS` | One of these | Comma-separated API keys for multiple accounts |
| `BATTLEGRID_API_KEY` | One of these | Single API key (fallback if `BATTLEGRID_API_KEYS` not set) |
| `BATTLEGRID_API_URL` | No | Override server URL (default: `https://mcp.battlegrid.trade`) |

## License

[MIT](LICENSE)
