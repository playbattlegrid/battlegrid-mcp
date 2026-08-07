# AGENTS.md — BattleGrid MCP Server

Machine-readable agent discovery file for `@battlegrid/mcp-server` (thin stdio proxy to BattleGrid's remote MCP server).

## Platform

| Field | Value |
|-------|-------|
| Name | BattleGrid |
| Website | https://battlegrid.trade |
| Protocol | Model Context Protocol (MCP) |
| Transport | stdio (npm package), streamable-http (remote) |
| Package version | Tracks the **deployed** server MCP contract line (MAJOR.MINOR); the patch is the proxy's own space. Read the live line from `GET https://mcp.battlegrid.trade/mcp/version` rather than this file — `scripts/assert-deployed-contract.mjs` gates publishing on that comparison, so a number restated here can only go stale. |

## Authentication

| Field | Value |
|-------|-------|
| Method | API Key (stdio) / OAuth 2.1 (remote, ChatGPT Desktop) |
| Format | `bg_live_*` |
| Header | `Authorization: Bearer <API_KEY>` |
| Obtain | https://battlegrid.trade → Profile → MCP tab |
| Scopes | `mcp:read` (discovery + non-financial config writes), `mcp:wager` (financial actions) |

## Connection

### Option A: npm / stdio

```bash
# Single account
BATTLEGRID_API_KEY=bg_live_xxx npx @battlegrid/mcp-server
# Multiple accounts
BATTLEGRID_API_KEYS=bg_live_aaa,bg_live_bbb npx @battlegrid/mcp-server
```

### Option B: Remote / streamable-http

```
URL: https://mcp.battlegrid.trade/mcp
Header: Authorization: Bearer bg_live_xxx
```

## Capabilities — discovered live

Tools, prompts, and resources are **discovered live** from the connected server via `tools/list`, `prompts/list`, and `resources/list`. This package does not hardcode the catalog, formulas, signal IDs, or defaults. After a server deployment, restart/reconnect the proxy and re-run discovery — a cached snapshot is not authoritative.

Capability areas exposed by the server include: Market Grid game play, market context, account state, leaderboards, intelligence agents + automation, strategy discovery/authoring, and trading signals/decisions.

## Multi-account request envelope

When multiple keys resolve, the proxy injects a required `account` enum into every tool as a **sibling** of the existing input. The strict strategy-authoring tools (`get_strategy_section_template`, `update_strategy_signal_rule`, `compile_strategy_plan`, `apply_strategy_plan`) publish `{ request: canonicalPayload }`; multi-account discovery makes that exactly `{ account, request }`. The proxy strips only `account` and forwards the unchanged `{ request }`. Never nest `account` inside `request`.

## Strategy authoring

Author strategies with the strict workflow: `compile_strategy_plan({ request })` (CREATE / UPDATE / RESTORE — read-only) → review the returned `approvedPlan` + `reviewContext` → `apply_strategy_plan({ request: { plan, planToken, confirm: true } })` (the only write), where `plan` carries only the compiled plan's non-derivable inputs — `operation`, `postState.id` as `strategyId`, `expiresAt`, `expectedRevision` for UPDATE/RESTORE, `explicitRuleOverrides` as `rules`, and the authored `postState` fields including normalized `sections` and the required `conditions` axis (contract v5.0.0). Each condition is `{ conditionKey, name, definition, verdict }`, where `verdict` is required and nullable — `UP` | `DOWN` | `NEITHER`, or an explicit `null` for a building block — and declaration order is the precedence: the first condition that resolves TRUE and carries a non-null verdict decides. The separate `conditionVerdicts` array was retired in v5.0.0 and is rejected with a message naming this replacement. Every derived field (`diff`, `viability`, `mismatches`, `signalRules`, `creationSeed`, `proposedRevision`, `bindingImpact`, `authoringCatalogDigest`) is re-derived server-side and rejected as an unknown key if resubmitted. Bind a strategy to an agent at creation via `create_intelligence_agent({ …, strategyId })`. The direct `create_strategy` operation is **retired** and absent from discovery.

## Skills

```bash
npx skills add playbattlegrid/battlegrid-mcp
```

## Rate limits

| Limit | Value |
|-------|-------|
| Operations | 50 ops/day |
| Wager spend | $500 USD/day |
