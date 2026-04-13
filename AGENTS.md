# AGENTS.md — BattleGrid MCP Server

Machine-readable agent discovery file for `@battlegrid/mcp-server`.

## Platform

| Field | Value |
|-------|-------|
| Name | BattleGrid |
| Website | https://battlegrid.trade |
| Protocol | Model Context Protocol (MCP) |
| Transport | stdio (npm), streamable-http (remote) |

## Authentication

| Field | Value |
|-------|-------|
| Method | API Key |
| Format | `bg_live_*` |
| Header | `Authorization: Bearer <API_KEY>` |
| Obtain | https://battlegrid.trade → Profile → MCP tab |

## Connection

### Option A: npm / stdio

```bash
BATTLEGRID_API_KEY=bg_live_xxx npx @battlegrid/mcp-server
```

### Option B: Remote / streamable-http

```
URL: https://mcp.battlegrid.trade/mcp
Header: Authorization: Bearer bg_live_xxx
```

## Capabilities

### Tools (28)

**Market Grid (7)**
- `list_market_grid_sessions` — List Market Grid game sessions with optional filtering by status and limit
- `get_market_grid_session` — Get detailed information about a specific Market Grid session
- `check_market_grid_submission` — Check if the authenticated user has already submitted a grid
- `submit_market_grid` — Submit a Market Grid prediction (requires mcp:wager scope)
- `get_market_grid_results` — Get results for a settled Market Grid session
- `get_market_grid_player_grid` — Get the authenticated user's submitted grid for a Market Grid session
- `update_market_grid` — Update an existing Market Grid prediction before the session locks

**Coin Grid (6)**
- `list_coin_grid_sessions` — List Coin Grid game sessions with optional filtering by status and limit
- `get_coin_grid_session` — Get detailed information about a specific Coin Grid session
- `check_coin_grid_submission` — Check if the authenticated user has already submitted a grid
- `submit_coin_grid` — Submit a Coin Grid prediction (requires mcp:wager scope)
- `get_coin_grid_results` — Get results for a settled Coin Grid session
- `get_coin_grid_player_grid` — Get the authenticated user's submitted grid for a Coin Grid session

**Account (6)**
- `get_account_balance` — Get the authenticated user's total play balance (USDC spot + perps withdrawable)
- `get_user_profile` — Get a user's profile information (defaults to authenticated user)
- `get_user_stats` — Get a user's game statistics including level, rank, XP progress, and win/loss records
- `list_user_favorites` — List the authenticated user's canonical preset favorites
- `add_user_favorite_preset` — Add a preset to the authenticated user's favorites
- `remove_user_favorite_preset` — Remove a preset from the authenticated user's favorites

**Leaderboard (3)**
- `get_leaderboard` — Get the global leaderboard ranked by metric (PROFIT, VOLUME, or SCORE) and timeframe
- `get_market_grid_leaderboard` — Get the Market Grid unified leaderboard showing all 3 KPIs per player
- `get_hall_of_fame` — Get the Hall of Fame achievement leaders across categories

**Market Data (4)**
- `get_coin_overview` — Get real-time overview snapshot for a coin including price, volume, and market metrics
- `get_recent_candles` — Get recent OHLCV candle data for a coin
- `get_top_ranked_coins` — Get the top performing coins ranked by absolute change, volatility, or volume
- `list_game_presets` — List all active game presets showing available game configurations

**Intelligence Agent (2)**
- `list_intelligence_agents` — List all intelligence agents accessible to the authenticated user
- `get_intelligence_agent` — Get full configuration for a specific intelligence agent

### Prompts (5)

- `play-market-grid` — End-to-end workflow for playing a Market Grid prediction game
- `play-coin-grid` — End-to-end workflow for playing a Coin Grid prediction game
- `analyze-market` — Deep market analysis for informed predictions
- `check-performance` — Review your game results, stats, and leaderboard standing
- `strategy-guide` — Learn BattleGrid game mechanics, rules, and strategies

### Resources (3)

- `battlegrid://rules/overview` — Comprehensive game rules for Market Grid and Coin Grid
- `battlegrid://reference/grid-format` — Grid format reference with JSON examples and validation rules
- `battlegrid://guide/quick-start` — BattleGrid Quick Start Guide

## Skills

```bash
npx skills add playbattlegrid/battlegrid-mcp
```

## Rate Limits

| Limit | Value |
|-------|-------|
| Operations | 50 ops/day |
| Wager spend | $500 USD/day |
