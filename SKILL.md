---
name: battlegrid
description: MCP skill for BattleGrid — play crypto prediction games (Market Grid), author trading strategies with the strict compile → review → apply workflow, and manage strategy-bound intelligence agents from AI agents.
---

# BattleGrid

BattleGrid is a real-time cryptocurrency prediction gaming and trading platform. This MCP server gives AI agents access to play games, author trading strategies, and run strategy-bound intelligence agents.

## Discover the live surface first

**Tools, prompts, and resources are discovered live from this MCP connection.** Always read the current `tools/list`, `prompts/list`, and `resources/list` before acting — a cached capability list is not authoritative after a server deployment. This skill teaches the workflows and the strict request contracts; it deliberately does not copy the server's tool catalog, metric/transform vocabulary, signal IDs, formulas, or default values. Discover those from the live tools (`list_strategy_categories`, `list_strategy_vocabulary`, `list_strategy_signals`, `get_strategy_signal_definition`, …). Never guess a metric, transform, parameter, template, signal, or enabled-timeframe fact.

## Single-account vs multi-account request shape

The strategy-authoring tools — `get_strategy_section_template`, `update_strategy_signal_rule`, `compile_strategy_plan`, `apply_strategy_plan` — use one strict server-owned envelope, `{ request: canonicalPayload }`.

- **Single account:** call them as the server publishes them, e.g. `compile_strategy_plan({ request })`.
- **Multiple accounts (proxy):** live discovery adds a sibling `account`, so the shape is exactly `{ account, request }`. Select the account in the outer field; keep `request` exactly as discovered. The proxy strips only `account` and forwards the unchanged `{ request }`.

Never put `account` inside `request`, and never flatten request fields beside it. Other tools keep whatever input shape live discovery reports for them.

## Scopes

- `mcp:read` — strategy discovery **and** non-financial configuration writes (author strategies, edit agents, customize signals). Treat it as configuration authority, not view-only.
- `mcp:wager` — financial actions (submit paid entries, accept/cancel entry decisions, deployment policies). Enable **Server-Signed Wagers** in Profile → MCP to grant it. Pending entry decisions come from the conversational surface, which waits for approval; an agent deployed to a radar coin or a trading-enabled arena slot executes without one.

## Author a strategy: compile → review → apply

Strategies are authored through one strict, whole-plan workflow. **Compilation changes no strategy, agent or revision; `apply_strategy_plan` is the only write to the strategy itself** — but compile is not read-only either: it parks the plan its own apply reads, and each call mints a distinct record and token, so compile once per reviewed payload and never retry or parallelise it. Review the exact returned plan before confirming.

1. **Choose the operation and revision.**
   - `list_strategies({ includeInactive? })` — visible SYSTEM and owned PRIVATE strategies with lifecycle, quota, usage, and revisions. Use `includeInactive:true` to prepare a RESTORE.
   - `get_strategy({ strategyId, includeInactive? })` — the complete report, dense signal scorecard, gates, usage, and current `revision`. Thread every returned revision into the next revisioned call.
2. **Discover the report vocabulary progressively.**
   - `list_strategy_categories()` → `list_strategy_vocabulary({ category })` → `get_metric_construction_hints({ metric })` → `get_strategy_column_contract({ column, sectionTimeframe? })`.
   - `get_strategy_section_template({ request })` for a listed template; `preview_strategy_report(payload)` for a point-in-time rendered preview.
3. **Discover signals at the strategy timeframe.**
   - `list_strategy_signals({ module?, query? })` → `get_strategy_signal_definition({ signalId, timeframe })`. Availability is structural, not a promise of a live trigger.
4. **(Optional) review draft-only guidance.**
   - `derive_strategy_rule_view({ sections, rules? })` returns report perception, server defaults, and suggestions without reading or writing a strategy. Suggestions/resets only shape the next plan input; they persist only through `apply_strategy_plan`.
5. **Compile one complete plan.**
   - `compile_strategy_plan({ request })`, where the nested request contains exactly one strict branch plus a bounded `coinSelection`, `intentSummary`, and `assumptions`:
     - **CREATE** — supplies the full new aggregate.
     - **UPDATE** — supplies at least one changed axis and `expectedRevision`.
     - **RESTORE** — targets an owned inactive revision and may include repair axes.
   - Signal overrides are sparse: an omitted signal/axis stays unchanged; omitted `params` preserves canonical params byte-for-byte; present `params` replaces them only after strict validation.
6. **Review before confirming.**
   - `approvedPlan` — complete post-state, proposed revision, dense scorecard, viability, canonical diff, expiry, and bound-agent impact.
   - `reviewContext` — exact column contracts, point-in-time report preview and coin scope, open-position observation, and provisional quota/name admission (advisory until the write). Open positions are awareness only and do not block an edit.
   - The plan token expires after five minutes. Recompile after expiry, catalog drift, revision drift, or a changed bound-agent fence.
7. **Apply the plan the server already holds.**
   - After explicit user approval: `apply_strategy_plan({ request: { planToken, confirm: true } })`. **There is no `plan` member** — one is rejected as an unknown key. The server keeps the plan its own compile approved and reads it back, so nothing is copied from the compile response and nothing can be mistyped, truncated or half-reconstructed in transit.
   - Forward `planToken` byte-for-byte exactly as compile returned it. It is an opaque signed value: never retyped, paraphrased, abbreviated or rebuilt from memory. A mangled token addresses no approved plan and is refused.
   - Refusals and their recoveries: `PLAN_APPROVAL_NOT_FOUND` means no approved plan answers to this token — it was already applied, it lapsed, or it was never issued; compile again. `TOKEN_EXPIRED` means the five minutes ran out; compile again. Anything else — a quota, a name collision, a bound agent that changed, a moved catalog — **leaves the plan applicable**: clear the cause and confirm again with the same token while it lives.
   - Changed configuration reaches every bound agent immediately. Report the returned strategy, committed revision, changed axes and applied impact exactly as given, and use that returned revision for the next mutation.

**Focused edits & lifecycle:** `update_strategy_signal_rule({ request })` is the thin one-rule edit (requires `required`; omit `params` to preserve them). `fork_strategy` requires `sourceRevision`; `archive_strategy` requires `expectedRevision` and `confirm:true`; `restore_strategy` is only the thin unchanged-content path — if it reports `REPAIR_REQUIRED`, use the RESTORE compile/review/apply flow instead.

## Strategy-bound agents

Bind a strategy to an agent at creation time — there is no direct strategy-creation tool.

1. `list_approved_models()` — valid `modelId` values for agent creation/update.
2. `list_strategies()` — pick the `strategyId` to bind.
3. `create_intelligence_agent({ …, modelId, strategyId })` — create a strategy-bound agent (avatar is server-minted).
4. `update_intelligence_agent({ agentId, … })` — update config; rebinding via `strategyId` requires `confirm:true`.
5. `get_agent_journal({ agentId })` / `get_agent_automation_status({ agentId })` — monitor performance and deployments.

## Play a game (Market Grid)

Predict UP or DOWN for each coin in the pool; exactly one coin is your **Captain** (2x score multiplier). Drive it from the live tools:

1. `get_account_state()` — balance, rank, agent slots, wager status.
2. `list_market_grid_sessions({ status: "PENDING" })` — find an open game (a `$0` entry fee is risk-free).
3. `get_market_grid_session({ sessionId })` — coin pool, timeframe, payout structure.
4. `get_market_context({ sessionId })` — indicators, rankings, and trends for the session.
5. `check_market_grid_submission({ sessionId })` — avoid duplicate submissions (`update_market_grid` to modify).
6. `submit_market_grid({ sessionId, grid, reasoning, confidenceScore, modelName, pickReasoning })` — submit predictions.
7. `get_market_grid_results({ sessionId })` — results once the session is `SETTLED`.

**Grid validation:** grid size matches the coin pool; each coin appears once; positions are sequential (0,1,2,…); exactly one cell is `isCaptain: true`.

The `play-market-grid` prompt (discover via `prompts/list`) provides a guided end-to-end workflow.

## Retired operations

`create_strategy` (and other legacy direct-authoring/agent-scoped rule tools) are **retired** — they are absent from discovery and cannot be invoked. Author strategies with compile → review → apply, edit rules with `update_strategy_signal_rule`, and bind strategies to agents at agent creation. Do not attempt flat legacy payloads; the server enforces a closed-world request root and the proxy never reconstructs them.

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `BATTLEGRID_API_KEY is required` | Missing API key | Set `BATTLEGRID_API_KEY` (or `BATTLEGRID_API_KEYS`) |
| `API key must start with "bg_live_"` | Invalid key format | Generate a new key at battlegrid.trade → Profile → MCP |
| Authentication failed (401/403) | Key revoked/rotated | Generate a new key and **restart** the proxy (keys read once at startup) |
| `"account" parameter is required` | Multi-account call missing `account` | Add the outer `account`; keep `request` unchanged |
| Plan token expired / revision drift | >5 min since compile, or upstream changed | Recompile, review the fresh plan, then apply |
| Method not found | Calling a retired/unknown tool | Re-run `tools/list`; use the compile → review → apply flow |
| `Wager scope required` | `mcp:wager` not enabled | Enable Server-Signed Wagers in Profile → MCP |
