---
name: battlegrid
description: MCP skill for playing BattleGrid crypto prediction games — Market Grid and Coin Grid — from AI agents
---

# BattleGrid

BattleGrid is a real-time cryptocurrency prediction gaming platform. Players predict whether coins will go UP or DOWN over fixed timeframes, competing for rankings and USDC payouts. This MCP server gives AI agents full access to play games, analyze markets, and track performance.

## Game Types

### Market Grid

You receive a pool of coins (3–10) and predict UP or DOWN for each one over a fixed timeframe. Exactly one coin must be your **Captain** — it gets a 2x score multiplier. Choose your highest-conviction prediction as captain.

### Coin Grid

Focus on a single coin's price candles. Predict UP or DOWN for each individual candle interval. Paid USDC entry required.

## Session Lifecycle

Every game session follows this lifecycle:

1. **PENDING** — Session created, accepting submissions. Submit your grid during this phase.
2. **LIVE** — Game in progress. Price data is being tracked. No new submissions.
3. **SETTLING** — Timeframe ended, calculating final scores and rankings.
4. **SETTLED** — Results are final. Rankings, scores, and payouts are available.
5. **CANCELLED** — Session was cancelled (rare). Entry fees are refunded.

## How to Play

### Step 1: Find a Game

```
list_market_grid_sessions({ status: "PENDING" })
```

Look for sessions with a $0 entry fee to start risk-free.

### Step 2: Inspect the Session

```
get_market_grid_session({ sessionId: "..." })
```

Note the coin pool, entry fee, timeframe, and payout structure.

### Step 3: Research the Coins

```
get_coin_overview({ coinSymbol: "BTC" })
get_recent_candles({ coinSymbol: "BTC", timeframe: "1h", limit: 24 })
get_top_ranked_coins({ metric: "abs_change" })
```

Check trends, volume, and recent price action for each coin in the pool.

### Step 4: Check for Existing Submission

```
check_market_grid_submission({ sessionId: "..." })
```

If you already submitted, use `update_market_grid` to modify your predictions (if the session allows updates).

### Step 5: Submit Your Grid

```
submit_market_grid({
  sessionId: "...",
  grid: [
    { coinId: "uuid-1", position: 0, prediction: "UP", isCaptain: true },
    { coinId: "uuid-2", position: 1, prediction: "DOWN", isCaptain: false },
    { coinId: "uuid-3", position: 2, prediction: "UP", isCaptain: false }
  ]
})
```

### Step 6: Check Results

```
get_market_grid_results({ sessionId: "..." })
```

After the session settles, see your ranking, score, and payout.

## Grid Rules

### Market Grid Cell Format

```json
{
  "coinId": "uuid-from-session-coin-pool",
  "position": 0,
  "prediction": "UP",
  "isCaptain": true
}
```

**Validation rules:**
- Grid size must match the session's coin pool size
- Each `coinId` must appear exactly once
- Positions must be sequential (0, 1, 2, ...)
- Exactly one cell must have `isCaptain: true`

### Coin Grid Cell Format

```json
{
  "position": 0,
  "candleIndex": 3,
  "prediction": "UP"
}
```

**Validation rules:**
- No duplicate positions
- No duplicate candleIndices
- Grid size must match the session's expected dimensions

## Prediction Strategy

### Analysis Steps

1. **Check top movers**: `get_top_ranked_coins({ metric: "abs_change" })` — find coins with strong directional moves
2. **Check volatility**: `get_top_ranked_coins({ metric: "volatility" })` — find the most volatile coins
3. **Study trends**: `get_recent_candles({ coinSymbol: "BTC", timeframe: "1h", limit: 24 })` — spot momentum
4. **Get overview**: `get_coin_overview({ coinSymbol: "BTC" })` — current price, volume, market metrics

### Captain Selection

Pick the coin with your highest conviction as captain for the 2x multiplier. Strong trending coins with clear momentum are better captain picks than choppy sideways coins.

### Tips

- Strong trends are more reliable than choppy markets
- Don't predict all UP or all DOWN — diversify based on individual coin analysis
- Check `get_recent_candles` with multiple timeframes (5m, 1h) for confirmation
- Use `list_game_presets` to see available game configurations and choose games that match your strategy

## Paid Games

### Before Playing Paid Games

1. **Check balance**: `get_account_balance()` — verify you have enough USDC
2. **Daily limits**: 50 operations/day, $500 USD/day wager limit
3. **Signer policy**: Enable Server-Signed Wagers in Profile → MCP tab to allow the agent to submit paid entries

### How Paid Games Work

- Entry fees are in USDC, transferred automatically on submission
- Top performers share the prize pool based on the session's payout structure
- Results and payouts are available after the session settles

## Checking Performance

| Tool | Purpose |
|------|---------|
| `get_user_stats` | Overall game statistics, level, rank, XP, win/loss records |
| `get_user_profile` | Profile info, level, rank |
| `get_account_balance` | Current USDC balance |
| `get_leaderboard` | Global rankings by PROFIT, VOLUME, or SCORE |
| `get_market_grid_leaderboard` | Market Grid rankings with all KPIs |
| `get_hall_of_fame` | Achievement leaders (Best Payout, Win Ratio, Best Accuracy, Win Streak) |

## Available Tools

| Category | Tool | Description |
|----------|------|-------------|
| Market Grid | `list_market_grid_sessions` | List sessions with optional status/limit filter |
| Market Grid | `get_market_grid_session` | Get session details (coin pool, timeframe, payouts) |
| Market Grid | `check_market_grid_submission` | Check if you already submitted |
| Market Grid | `submit_market_grid` | Submit predictions |
| Market Grid | `get_market_grid_results` | Get settled session results |
| Market Grid | `get_market_grid_player_grid` | Get your submitted grid |
| Market Grid | `update_market_grid` | Update predictions before lock |
| Coin Grid | `list_coin_grid_sessions` | List sessions with optional status/limit filter |
| Coin Grid | `get_coin_grid_session` | Get session details (coin, grid layout, timeframe) |
| Coin Grid | `check_coin_grid_submission` | Check if you already submitted |
| Coin Grid | `submit_coin_grid` | Submit predictions |
| Coin Grid | `get_coin_grid_results` | Get settled session results |
| Coin Grid | `get_coin_grid_player_grid` | Get your submitted grid |
| Account | `get_account_balance` | Get USDC play balance |
| Account | `get_user_profile` | Get user profile info |
| Account | `get_user_stats` | Get game statistics and XP |
| Account | `list_user_favorites` | List favorite presets |
| Account | `add_user_favorite_preset` | Add a favorite preset |
| Account | `remove_user_favorite_preset` | Remove a favorite preset |
| Leaderboard | `get_leaderboard` | Global leaderboard by metric and timeframe |
| Leaderboard | `get_market_grid_leaderboard` | Market Grid unified leaderboard |
| Leaderboard | `get_hall_of_fame` | Achievement leaders |
| Market Data | `get_coin_overview` | Real-time coin snapshot |
| Market Data | `get_recent_candles` | OHLCV candle data |
| Market Data | `get_top_ranked_coins` | Top coins by change, volatility, or volume |
| Market Data | `list_game_presets` | Available game configurations |
| Intelligence | `list_intelligence_agents` | List accessible intelligence agents |
| Intelligence | `get_intelligence_agent` | Get agent configuration details |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `play-market-grid` | Guided workflow to play a Market Grid game (optional strategy parameter: trend-following, contrarian, volatility, balanced) |
| `play-coin-grid` | Guided workflow to play a Coin Grid game |
| `analyze-market` | Deep market analysis (optional coinSymbol parameter) |
| `check-performance` | Review results, stats, and leaderboard standing |
| `strategy-guide` | Learn game mechanics, rules, and strategies |

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `BATTLEGRID_API_KEY is required` | Missing API key | Set `BATTLEGRID_API_KEY` environment variable |
| `API key must start with "bg_live_"` | Invalid key format | Generate a new key at battlegrid.trade → Profile → MCP tab |
| `Invalid or revoked API key` | Key expired or revoked | Generate a new key |
| `Session not found` | Invalid sessionId | Use `list_*_sessions` to find valid session IDs |
| `Already submitted` | Duplicate submission | Use `update_market_grid` to modify, or call `check_*_submission` first |
| `Session is not PENDING` | Submission window closed | Find a PENDING session instead |
| `Insufficient balance` | Not enough USDC | Check balance with `get_account_balance`, deposit funds |
| `Wager scope required` | Signer policy not enabled | Enable Server-Signed Wagers in Profile → MCP tab |
| `Rate limit exceeded` | Too many operations | Daily limit is 50 ops/day, wait and retry |
