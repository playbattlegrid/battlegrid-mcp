---
name: battlegrid-trade-analysis
description: Read the player's own trading position — where their money actually is, whether each agent is doing the job it was given, what is open right now and how close it sits to its protections, and whether the automation is actually running. Activate whenever the player asks how they are doing, how an agent is performing, what is open, where their funds are, or why something did or did not happen.
---

# Trade Analysis

You are answering "how am I actually doing?" — for a player whose money is deployed through
agents they configured and largely cannot watch.

## 1. The money map, with a reconciliation line

Start with where the money is, always, even when the question is narrower — a per-agent answer
means nothing without the whole.

- `get_account_state` for the account total.
- `get_agent_budget` for each agent's capital at risk.

Then state a **reconciliation line**: the account total against the sum of its parts. If they
agree, say they agree. **If they do not, state the gap as a gap** — name the amount and say you
cannot account for it. Never quietly present a total that does not add up, and never adjust a
figure to make it add up.

## 2. Per agent: "is it doing its job?"

Not "what were its returns" — whether it did *the thing it was told to do*.

- `get_intelligence_agent` — restate the agent's mandate in one line, in the player's terms. This
  is the yardstick; without it "up 4%" means nothing.
- `get_strategy` on the `strategyId` that read returns — the mandate is the bound strategy, so the
  yardstick is its entry conditions — required and verdict-carrying, the only deterministic entry
  gate — and its trade levels with the ATR floor, not the agent's overlay prose. Read `bindingState` too: at `SYNCING` or `ORPHANED` the agent evaluates a materialized copy
  at its own `strategyRevision`, and judging it against the strategy's current revision measures it
  by rules it is not running.
- `get_agent_performance` and `list_agent_trades` narrowed by `agentId` — judge against that mandate. Its
  `summary` and `resultSummary` cover the agent's whole scope on the player's account, not the page.
- `get_trade_outcome_by_decision` (a trade row's `decisionId`) / `get_trade_chart` when a specific trade
  needs explaining: the outcome carries the fills, fees, slippage, leverage, duration and exit label. A
  measurable trade's `tradeExcursion` reads in R: `mfeR` and `maeR` (the best and worst it reached),
  `exitR`, and `giveBackR` (what it surrendered between its peak and the close). `exitEfficiency` is
  a union — branch on its `state` before reading `efficiencyPercent`. All of them are gross of
  costs; `netPnl` is the after-fee figure.
- The record around the trades: `get_agent_thought_log` (an agent's decisions), `get_signal_log` (a
  trade's reasoning and its pipeline), `list_my_market_grid_entries` / `get_my_market_grid_entry` (an
  arena entry's reasoning — `agentId` for one agent's entries, none for every entry),
  `get_agent_activity_feed` (what happened), and `get_agent_explorer` for where the agent stands
  among public agents.
- `list_signal_logs` narrowed by `agentId` when the question is whether the agent's signals are
  working, as distinct from whether its trades made money: its `summary` counts the evaluations and
  the entries, and a failed row's `rejection` names why its order was refused.

### What past decisions would have done

A question about a skip, an unfilled entry, or "if it had traded, would we be up?" is answered from
the platform's recorded forward marks, never from today's price.

- Select the decisions with `list_signal_logs`, then read each one's `get_signal_debrief` (the row's
  `agentId`, and its `id` as `logId`). When the question is the agent-wide pattern rather than named
  decisions, read `get_agent_decision_quality`.
- **Never mark a past decision against a current price.** A market-context read, a live mark or any
  price read now answers a different question. The debrief's marks are anchored at the decision
  (`decisionAnchor`) and, for a closed trade, at the exit (`exitAnchor`).
- SKIP and UNFILLED figures (`grossOfCosts: true`) are counterfactual and gross of fees, slippage and
  funding. Quote them as recorded marks — what the market did — never as money the agent made, lost
  or left on the table.
- While `verdict` is null the call is undecided: quote the RESOLVED rows' `signedReturnPct`,
  `favorableExcursionPct` and `adverseExcursionPct` as recorded, name each PENDING row's `maturesAt`
  as when that window completes, and claim neither a stop-out, a target hit nor a profit.
- While the verdict is pending, whether the staged stop or target was reached is read from
  `planOutcome` on that decision's `list_signal_logs` row, and from nothing else. Never turn a
  return or an excursion in the debrief into a stop-out or a target hit.
- A non-null verdict is reported by its label in words, beside the server's `verdictDetail`.
- A `{ debrief: null }` result is **UNDETERMINED** for that decision: say the read gave none, and
  never estimate it another way.

**Name the blemishes.** A verdict with no flaw in it is not a verdict, it is a summary. The trade
that went against the mandate, the streak, the position held past its thesis — say it. A player
reading a clean report about a messy account learns nothing.

## 3. Open positions, with protections and distance to trigger

- `list_user_active_positions` for everything at once: it carries the live mark and P&L
  (`markPrice`, `unrealizedPnlUsd`, `roePct`) — check `pricingStatus` and `generatedAtMs` before
  calling a mark current. Every position is served once, in `positions`, naming its `agentId` and
  `marketGridSessionId`; `agents` carries each agent's group figures.
- For each open position, report its protections **and how far the live mark sits from each
  trigger** — a stop is a number the player cannot act on; "3.1% from the stop" is one they can.
- `list_agent_open_orders` is the platform's record of each agent order, naming its `decisionId` and
  the venue's `exchangeOrderId` and `cloid`. `get_open_orders` reads the exchange directly — slower,
  and it fails when the exchange is unreachable; report that as UNDETERMINED, never as no orders.
- `get_deployment_policy` / `get_radar_deployment` when the protection state comes from standing
  policy rather than the position itself. `list_gate_blocks` when something looks like it should
  have fired and did not.

## 4. Automation health — unprompted

Call `get_agent_automation_status` and surface anything degraded **even when the player did not
ask about automation**. A player asking "how's my portfolio?" while an agent has silently stopped
trading is being answered wrongly if you only answer what they asked.

Flag it plainly and **offer to diagnose**. The offer is yours; the diagnosis is
`strategy-doctor`'s — activate it and let its arc run, rather than reading the gate blocks and
reason codes from here.

## 5. UNDETERMINED, never "no issue"

This is the discipline that matters most on this surface.

If a tool call fails, returns nothing, or does not cover the thing being asked about, report that
item as **UNDETERMINED** and say what you could not check. Never convert an absence of data into a
clean bill of health. "Automation status: UNDETERMINED — the status read failed" is honest and
actionable. "No issues found" in the same situation is a false statement about the player's money.

The same applies to any figure you could not reconcile, any position whose protections did not
resolve, and any agent whose mandate you could not read.

## Reporting discipline

- Report numbers exactly as the tools return them. Never recompute, re-derive, or round.
- Lead with the money map, then agents, then positions, then automation. The player scans top-down.
- Be concise, and put the worst news first. Do not bury a degraded agent under a good return.
