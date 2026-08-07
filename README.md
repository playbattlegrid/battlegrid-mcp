# @battlegrid/mcp-server

[![npm version](https://img.shields.io/npm/v/@battlegrid/mcp-server)](https://www.npmjs.com/package/@battlegrid/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for [BattleGrid](https://battlegrid.trade) — play crypto prediction games, author trading strategies, and manage intelligence agents from AI agents.

It is a thin, authenticated **stdio proxy** to BattleGrid's remote MCP server (Stripe `@stripe/mcp` pattern — no business logic). It discovers tools, prompts, and resources live from the server and re-exposes them to local MCP clients (Claude Desktop, Claude Code, Cursor). Capabilities are always **discovered live** — this package never hardcodes the tool catalog.

## v11 — breaking cutover (v6 → v11)

**v11 pairs with the BattleGrid server's MCP contract v11.x — currently v11.0.0.** The package version tracks the server's wire contract, because the proxy announces `battlegrid@<package version>` in its own stdio handshake — the number a client reads has to be the contract it will actually reach. Upgrade the package and the server together: the major carries the breaking cutover described below, and the minor tracks additive contract moves that leave every existing call working.

This release absorbs **six** breaking contract majors at once. The published package went from `5.0.0` straight to `11.0.0`, so no `6.x` through `10.x` client exists to upgrade from — the breaks are therefore grouped by **what you will observe**, with the contract version that introduced each, so a client hitting a specific rejection can find it here.

**The proxy itself is unchanged.** It embeds no schemas, pins no contract version, and forwards `{ request }` verbatim. Every break below lands on whatever *authors* the payload or *reads* the result, never on the proxy.

### Rejected input — something you author is no longer accepted

- **Challenge participation is no longer a field you set** (10.0.0). `create_agent` and `update_agent` stop accepting `arenaChallengeEnabled`, and a deployment policy's slot rules and per-coin rules stop accepting `challengeEnabled`. All four schemas are `.strict()`, so a client still sending any of them is **rejected**, not silently ignored. Challenge participation is now *identical* to effective trade permission, resolved per coin: to stop an agent taking challenges at a venue, turn that venue's trading off — at the slot, or per coin for finer grain — using fields you already have.
- **`VOLUME_RATIO` is retired and replaced by `RVOL`** (6.0.0). `MetricKeySchema` auto-derives from the server's metric catalog, so the published enum simply stops accepting the old key: a column authored with `metric: 'VOLUME_RATIO'` is rejected against the enum. **No alias exists** — deliberately. The catalog audit adjudicated the old name as a name-level lie (the value is current volume ÷ its 20-period average, a *multiple*), and the correction was made at the root rather than grandfathered. If you hit an enum rejection naming `VOLUME_RATIO`, this note is the match.
- **`BB_WIDTH` can no longer be ranked** (8.0.0). `{ metric: 'BB_WIDTH', transformId: 'rank' }` is now rejected. `BBwidth` is a price-unit spread (`upper − lower`) that had falsely declared `percent`, and that declaration was the only thing admitting it to exchange-wide ranking — the ordinal it produced sorted by token denomination rather than by compression. It re-declares `signedPrice` and leaves the ranked contract. **Rank `BB_WIDTH_PCT` (`bbWidthPct`) instead**, which ships in the same release: the capability moved, it was not removed.

### Silently non-matching — a generated header you match on moved

This is the failure mode with no error attached to it. Nothing is rejected; your matcher simply stops finding the column.

- **`vol` → `RVOL`** (6.0.0), and with it **`vol_trend` → `RVOL_trend`** and **`vol_rank_hi` → `RVOL_rank_hi`**. The header code moves with the metric key, because every generated header over that metric derives from the code alone.
- **`BBwidth_rank_lo` no longer exists** (8.0.0) — it was the header of the ranked pairing retired above.

### Moved or reshaped output — a field you read is somewhere else

- **`estimatedTokenCount` is gone** (7.0.0). `preview_strategy_report` and `compile_strategy_plan` no longer carry it; the same number now sits one level deeper as **`budgetUsage.estimatedTokens.used`**, paired with the `cap` that governs it — so a client reading the count changes one path and gains the ceiling it was never told. `tokenCountModel` is unchanged. Discovery grows to match: `list_strategy_vocabulary` and the report catalog add `budgets.estimatedTokens` and a `previewExecutionLimits` object carrying the serialized-result byte cap and the preview deadline. Those two are published **cap-only** and deliberately have no `used` companion.
- **`approvedPlan.mismatches` changed on both axes** (9.0.0). Both report-coverage codes are renamed off "module", because the module is no longer the unit of coverage:

  | Was | Is now |
  |---|---|
  | `ACTIVE_SIGNAL_MODULE_NOT_IN_REPORT` | `ACTIVE_SIGNAL_DATA_NOT_IN_REPORT` |
  | `REPORT_MODULE_SIGNAL_OFF` | `REPORT_DATA_SIGNAL_OFF` |

  Each mismatch also carries a **required** `data: CoverageDatum[]` — the `(metric, rung)` pairs the mismatch is about: every MISSING datum for the not-in-report code, the PRESENT data for the signal-off code, empty for `REQUIRED_SIGNAL_UNAVAILABLE`. A client switching exhaustively on the old code strings stops matching. Behaviourally, coverage is now decided by whether the report renders a signal's declared metrics at the **rung** that signal reads, not by whether its module appears anywhere — so expect warnings you never saw before, and the disappearance of warnings no composition could clear. Mismatches remain advisory and non-blocking; nothing about apply gates on them.
- **`IntelligenceAgentDTO` drops `arenaChallengeEnabled`** (10.0.0) — the read side of the input removal above. `ResolvedSlotRulesDTO.challengeEnabled` **stays and keeps its shape**; it is now derived server-side, carrying the same value and provenance as `tradingEnabled`, so a client reading the resolved bundle needs no change.
- **`range` is no longer a tuple** (11.0.0). The closed positional pair `[min, max]` becomes the half-open object **`{ min: number; max?: number }`**. It travels through `ScalarSchema`, so this lands on `list_strategy_vocabulary`, `query_report_catalog`, and `get_metric_construction_hints` alike.

  **This one fails silently.** A client reading `range[0]` / `range[1]` gets `undefined` with no error raised — read `range.min` / `range.max` instead, and treat a missing `max` as unbounded above. The tuple could not state the truth about the volume/trade-count family, which is non-negative and unbounded above, and `Infinity` serializes to `null` on the wire. Those six metrics now declare `{ min: 0 }`, and as a consequence their **`far`/`near` rank orderings are no longer offered** — on a non-negative value that pair is a synonym pair under the magnitude gate's documented semantics.

### Widened enum — new members your own copy rejects

- **The published `unit` enum gains `ratio` and `fraction`** (8.0.0), and `RVOL`, `BUY_PRESSURE`, `BB_PCT_B` now emit them instead of `percent` — none of the three is a percentage, and `percent` appended a false `%`. This is a break in the opposite direction from the others: nothing you send is rejected, but a client holding **its own closed copy** of the unit enum rejects the new members. Easy to mistake for a purely additive change. Values are **not** rescaled — `buyPres` and `pctB` stay 0–1, so persisted thresholds comparing against `0.5` keep their meaning.

### What you do NOT need to do

- **No stored strategy needs client action.** Every persisted reference of both kinds — metric keys in section-column rows and revision snapshots, and everything addressing a column by its generated header — was migrated server-side by `20260805120000_rename_volume_ratio_to_rvol.sql`. This is a **client-literal problem only**; there is no stored record to repair.

### Additive in the same span

Nothing here is a break, but a client that enumerates these vocabularies will want them:

- **Four metric keys** join the catalog — `SPOT_CVD`, `PERP_SPOT_FLOW`, `PERP_SPOT_STRENGTH`, `PERP_SPOT_CONFIRMS` — and `includePerpSpotFlow` joins the context-source key set as its 23rd member, opt-in (5.2.0).
- **Two prompt-section `kind`s** join the union: `perp-spot-flow` (5.2.0) and `session-field` (5.1.0). Only a client that switches exhaustively on `kind` needs a default branch; one that renders `content` generically needs nothing.
- **The transform vocabulary grows 15 → 17** (11.0.0) — `efficiency` and `maxShare` join, and both join the chain-outer enum that `chainSuccessors` is served as. Only a client that switches exhaustively on `transformId` needs new branches; one that renders the served labels generically needs nothing.
- **The deployment-policy resolution DTO gains `agentTradingMode`** (10.0.0) — the preview previously reported trade rules for an agent whose *account-level* trading was off, and the account gate is not part of rule resolution. Read it to tell "this rule permits the trade" from "this account can trade at all".
- **`PlatformSectionDTO` gains `columns`** (6.1.0) — a platform section's composition in the same wire shape a custom section's columns already travel in, empty for a registry-declared special. **Not a copy source**, which is where it differs from the identically-shaped `CustomSectionTemplateDTO.columns`: six platform columns pair a metric with `classifyState`, a deliberate composability exclusion that authoring rejects at construction. A client that round-trips these into a custom section will be refused, and that refusal is correct.

## v5 — breaking major (conditions/verdicts fusion)

Retained for authors upgrading from 4.x. Everything below still describes the current contract.

- **`conditionVerdicts` no longer exists.** The verdict now rides the condition that decides it, and precedence is the conditions' own declaration order rather than a separate ordered map:

  ```jsonc
  // v4 — two parallel arrays joined by string key
  {
    "conditions":        [ { "conditionKey": "UP_FADE", "name": "…", "definition": { /* … */ } } ],
    "conditionVerdicts": [ { "when": "UP_FADE", "then": "UP" } ]
  }

  // v5 — one array; the verdict rides its condition
  {
    "conditions": [ { "conditionKey": "UP_FADE", "name": "…", "definition": { /* … */ }, "verdict": "UP" } ]
  }
  ```

  `verdict` is **required and nullable**, never optional: a building block that decides nothing spells its absence as an explicit `null`, never by omitting the key. An omitted `verdict` is a rejected payload, not a defaulted one.

- **A submitted `conditionVerdicts` is REJECTED, not ignored.** Deliberately — a v4 client that forwards the retired field is told what replaced it instead of getting an anonymous unrecognized-key rejection:

  > `conditionVerdicts` was retired in contract 5.0.0 — a condition now carries its own `verdict` (`UP` | `DOWN` | `NEITHER`, or `null` for a building block). Move each mapping onto the condition it named and resubmit.

- **The authorable verdict domain narrowed to three.** `conditionGrammar.verdicts` advertised `['UP','DOWN','NEITHER','UNRESOLVED']` and now advertises `['UP','DOWN','NEITHER']`. `UNRESOLVED` is an *evaluation outcome* — "a deciding condition could not be evaluated" — never an authored intent, so advertising it offered a value the schema then rejected. Any client mirroring the advertised enum into its own validation must narrow with it.

- **The evaluated per-coin verdict is nullable.** Resolution is first-TRUE-decides over the verdict-carrying conditions in declaration order, and its four outcomes are all distinct claims — collapsing any pair loses information a reader needs:

  | Evaluated verdict | Means |
  |---|---|
  | `UP` / `DOWN` / `NEITHER` as a **decision** | The first verdict-carrying condition that resolved TRUE declared it |
  | `NEITHER` as a **fallthrough** | Every verdict-carrying condition resolved FALSE |
  | `UNRESOLVED` | No carrier fired and at least one could not be evaluated — "could not be read", not "read as no setup" |
  | `null` | The strategy declares no verdict-carrying condition at all — it expresses no direction |

  `null` is new in v5; it previously surfaced as `NEITHER`. A client that renders the verdict must handle it without collapsing it into `NEITHER`.

- **The proxy itself is unchanged.** It embeds no schemas, pins no contract version, and forwards `{ request }` verbatim, so the whole break lands on whatever builds the apply projection. Apply takes an allowlisted projection of `approvedPlan`, never the object itself (`diff`, `viability`, `mismatches`, `signalRules`, `creationSeed`, `proposedRevision`, `bindingImpact`, `authoringCatalogDigest` are rejected as unknown keys, and so are the `postState` fields apply does not accept: `id`, `scope`, `systemKey`, `visibility`, `cadence`, `isActive`, `forkedFromStrategyId`). The exact field list is step 5 of **Strategy authoring (compile → review → apply)** below. A client that forwards post-state fields generically — stripping the derived keys rather than enumerating the kept ones — picks the fusion up without an edit; one that enumerates the fields it copies must drop `conditionVerdicts` from that list.

The v3 authoring contract below is unchanged and still current:

- **Strict authoring envelopes.** `get_strategy_section_template`, `update_strategy_signal_rule`, `compile_strategy_plan`, and `apply_strategy_plan` publish one strict server-owned object, `{ request: canonicalPayload }`. In multi-account mode the proxy adds `account` **only** as a sibling of `request`, producing exactly `{ account, request }`; on a call it strips only `account` and forwards the unchanged `{ request }`. It never descends into, flattens, or reconstructs the nested request.
- **`create_strategy` is retired.** Direct strategy creation no longer exists. Author strategies with the compile → review → apply workflow below, and bind them to agents at agent-creation time (`create_intelligence_agent({ …, strategyId })`). There is no alias, shim, or flat-payload fallback.
- **Rediscover after deployment.** Publishing the package does **not** refresh a running proxy's cached capability snapshot. After the server cutover, restart/reconnect the proxy process and re-run `tools/list`, `prompts/list`, and `resources/list`.

> Earlier majors: **v1.x** single/multi-account stdio proxy; **v2.0.0** moved the default `BATTLEGRID_API_URL` to the `/mcp` suffix; **v3.0.0** the strategy-authoring major; **v4.0.0** made `conditions` and `conditionVerdicts` required on the apply post-state; **v5.0.0** fused the conditions/verdicts split (section above). **v6.0.0** through **v11.0.0** were never published as separate package versions — they are absorbed by the v11 cutover at the top. See [Rediscovery & versioning](#rediscovery--versioning).

## Quick Start

### Single account (stdio transport)

```bash
BATTLEGRID_API_KEY=bg_live_xxx npx @battlegrid/mcp-server
```

### Multiple accounts (stdio transport)

```bash
BATTLEGRID_API_KEYS=bg_live_alice_key,bg_live_bob_key npx @battlegrid/mcp-server
```

When multiple keys are provided, the server discovers each account's identity and injects a required `account` parameter into every tool so the AI agent can choose which account to act as.

### Remote server (streamable-http transport)

```
https://mcp.battlegrid.trade/mcp
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

Use `BATTLEGRID_API_KEYS` (comma-separated) for multiple accounts.

### ChatGPT Desktop

ChatGPT Desktop connects via **OAuth 2.1** — no npm package or API key needed. ChatGPT handles the OAuth flow automatically.

1. Open ChatGPT Desktop → **Settings** → **MCP Servers** → **Add Server**
2. Enter the MCP endpoint URL: `https://mcp.battlegrid.trade/mcp`
3. Select **OAuth** as the authentication method
4. ChatGPT discovers OAuth endpoints, registers as a client (Dynamic Client Registration), and opens BattleGrid's consent page
5. Log in to BattleGrid and click **Authorize**

| | Claude Desktop / Cursor | ChatGPT Desktop |
|---|---|---|
| **Transport** | stdio proxy (`@battlegrid/mcp-server`) | Direct HTTPS |
| **Auth** | API key (`bg_live_*`) | OAuth 2.1 (Bearer token) |
| **Setup** | npm package + env vars | URL + OAuth consent |
| **Multi-account** | `BATTLEGRID_API_KEYS` env var | One OAuth grant per account |

## Account management

### Single account

Set `BATTLEGRID_API_KEY` with one API key. All tool calls use that account, and the tools are exactly the server-native shapes — the authoring tools take the strict `{ request }` envelope with no `account` field.

### Multiple accounts

Set `BATTLEGRID_API_KEYS` with a comma-separated list of API keys (one per BattleGrid account). On startup the proxy:

1. Calls `GET /mcp/identity` for each key to discover the account username
2. Injects a required `account` enum parameter into every tool — as a **sibling** of the existing input, never nested inside it
3. Routes each tool call to the correct account using the matching Bearer token, stripping only `account` before forwarding

For the strict authoring tools, the multi-account input is exactly `{ account, request }`:

```json
{
  "name": "compile_strategy_plan",
  "inputSchema": {
    "type": "object",
    "properties": {
      "account": {
        "type": "string",
        "enum": ["alice", "bob"],
        "description": "Which BattleGrid account to use for this action"
      },
      "request": {
        "oneOf": [
          { "properties": { "operation": { "const": "CREATE" } } },
          { "properties": { "operation": { "const": "UPDATE" } } },
          { "properties": { "operation": { "const": "RESTORE" } } }
        ]
      }
    },
    "required": ["account", "request"],
    "additionalProperties": false
  }
}
```

The proxy consumes only the outer `account` and forwards the unchanged `{ request }` upstream. Never put `account` inside `request`, and never flatten request fields beside it.

If a key fails identity discovery (revoked, invalid), it is skipped with a warning. If all keys fail, the process exits. `BATTLEGRID_API_KEYS` takes precedence over `BATTLEGRID_API_KEY` when both are set.

### Getting an API key

1. Go to [battlegrid.trade](https://battlegrid.trade) → **Profile** → **MCP** tab
2. Generate an API key (format: `bg_live_*`)
3. Copy the key immediately — it is shown only once

Each account supports one active key at a time. Generating a new key automatically revokes the previous one — restart any running proxy process afterward, since keys are read once at startup.

For paid games and autonomous wagering, enable **Server-Signed Wagers** in the MCP tab (`mcp:wager` scope). Strategy discovery and non-financial configuration writes only need `mcp:read`.

## Strategy authoring (compile → review → apply)

Strategies are authored through one strict, whole-plan workflow. **Compilation writes nothing; `apply_strategy_plan` is the only write.** Always review the exact returned plan before confirming.

1. **Choose the operation and revision.** `list_strategies` (add `includeInactive:true` when preparing a RESTORE) and `get_strategy` return the current `revision`; thread it into the next revisioned call.
2. **Discover the report vocabulary live.** Walk `list_strategy_categories` → `list_strategy_vocabulary` → `get_metric_construction_hints` → `get_strategy_column_contract`, and use `get_strategy_section_template` / `preview_strategy_report`. Do not guess metric, transform, parameter, template, or enabled-timeframe facts — they are server-discovered.
3. **Compile one complete plan.** Call `compile_strategy_plan({ request })` where the nested request is exactly one strict branch plus a bounded `coinSelection`, `intentSummary`, and `assumptions`:
   - **CREATE** supplies the full new strategy.
   - **UPDATE** supplies at least one changed axis and `expectedRevision`.
   - **RESTORE** targets an owned inactive revision (with any repair axes).
4. **Review before confirming.** Inspect the returned `approvedPlan` (complete post-state, proposed revision, diff, bound-agent impact, expiry) and `reviewContext` (column contracts, point-in-time report preview, open positions, quota/name admission). The plan token expires after five minutes; recompile after expiry or drift.
5. **Apply only the exact reviewed plan.** After explicit user approval, call `apply_strategy_plan({ request: { plan, planToken, confirm: true } })`. Build `plan` from the compiled `approvedPlan` by copying, byte-identical: `operation`; `postState.id` as `strategyId`; `expiresAt`; `expectedRevision` for UPDATE/RESTORE; `explicitRuleOverrides` as `rules`; and from `postState` — `name`, `description`, `tagline`, `timeframe`, `regimeAutoDerive`, `regimeTimeframe`, `marketReadText`, `sections` (including every generated `custom:` key), `conditions` (each carrying its own required, nullable `verdict`), `minAggregateScore`, `minRequiredCount`, `minAtrPct`. Send nothing else — the server re-derives the scorecard, diff, viability, mismatches, seed, revision, and bound-agent impact, and rejects `diff`, `viability`, `mismatches`, `signalRules`, `creationSeed`, `proposedRevision`, `bindingImpact`, `authoringCatalogDigest`, and `reviewContext` as unknown keys. `conditionVerdicts` is rejected too, with a message naming its replacement — the verdict belongs on the condition. Changed configuration propagates to every bound agent immediately.

`update_strategy_signal_rule({ request })` is the thin, focused one-rule edit. In multi-account mode every one of these calls uses the `{ account, request }` sibling envelope.

**Strategy-bound agents.** Bind a strategy to an intelligence agent at creation time — `create_intelligence_agent({ …, strategyId })` (discover `strategyId` via `list_strategies`). Rebinding via `update_intelligence_agent` requires `confirm:true`. There is no direct `create_strategy` operation.

## Capabilities

Tools, prompts, and resources are **discovered live** from the connected server via `tools/list`, `prompts/list`, and `resources/list`. This package intentionally does not copy the server's catalog, formulas, signal IDs, or defaults — inspect the live connection for the authoritative, current surface. Broadly, the server exposes game play (Market Grid), market context, account state, leaderboards, intelligence agents and automation, strategy discovery/authoring, and trading signals/decisions.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BATTLEGRID_API_KEYS` | One of these | Comma-separated API keys for multiple accounts |
| `BATTLEGRID_API_KEY` | One of these | Single API key (fallback if `BATTLEGRID_API_KEYS` not set) |
| `BATTLEGRID_API_URL` | No | Override server URL (default: `https://mcp.battlegrid.trade/mcp`) |

## Rediscovery & versioning

- **Package/server contract-line pairing.** This package's `MAJOR.MINOR` pairs with the BattleGrid server's published MCP contract version (`MCP_CONTRACT_VERSION`). The pairing is not decorative: the proxy re-announces itself as `battlegrid@<package version>` to the local client, under the same server name the remote handshake uses, so a package left behind tells clients a contract number that no longer exists — and a package *ahead* tells them one that does not exist yet. **The line, not just the major:** the contract ships additive changes as minors (`5.1.0`, `5.2.0`, `6.1.0`), so matching majors alone would let the package advertise a minor the server does not serve. Only the PATCH is the package's own space. The publish workflow enforces this against the deployed endpoint; it is not left to memory.
- **Rediscover after a server cutover.** Package publication does not refresh a running proxy's cached startup snapshot. Restart/reconnect the proxy and re-run `tools/list`, `prompts/list`, and `resources/list` after the server deploys.
- **Restart after key rotation.** API keys are read once at process startup; rotate a key, then restart the proxy.

| Version | Changes |
|---------|---------|
| 1.x | Single/multi-account stdio proxy, identity discovery, connection retry, capability discovery |
| 2.0.0 | Default `BATTLEGRID_API_URL` moved to the `/mcp` suffix |
| 3.0.0 | Strategy-authoring major: strict `{ account, request }` authoring envelopes with strip-only-account routing, compile → review → apply workflow, strategy-bound agent creation, and removal of the retired `create_strategy` operation |
| 3.0.1 | Docs only — `apply_strategy_plan` now takes `{ plan, planToken, confirm }` instead of `{ approvedPlan, … }`; the server re-derives every planner-derived field and rejects resubmitted ones as unknown keys. No proxy behavior change |
| 4.0.0 | Realigns the package major with the server's MCP contract v4.0.0, which broke on the conditions axis: `apply_strategy_plan` requires `conditions` and `conditionVerdicts` on the plan post-state. No proxy code change — the version is the client-facing signal, and the proxy's handshake carries it |
| 5.0.0 | Pairs with the server's MCP contract v5.0.0, the conditions/verdicts fusion: `conditionVerdicts` is retired and rejected with a message naming its replacement, each condition carries a required nullable `verdict`, precedence is the conditions' declaration order, the advertised authorable verdict domain narrows to `UP`/`DOWN`/`NEITHER`, and the evaluated per-coin verdict is nullable. No proxy code change — the version is the client-facing signal, and the proxy's handshake carries it |
| **5.1.0** | Pairs with the server's MCP contract v5.1.0, which is **additive**: `session-field` joins the prompt-section `kind` union — a section whose rows are not coins, carrying facts about the field as a whole. Nothing is removed and nothing previously accepted is rejected, so a 5.0.x client keeps working for every call it already makes; only a client that switches exhaustively on section `kind` needs a default branch, while one that renders `content` generically needs nothing. No proxy code change — the proxy copies `sections` opaquely and never enumerates kinds |
| 5.2.0 | Server contract v5.2.0, **additive**: four `MetricKey`s join the published catalog vocabulary (`SPOT_CVD`, `PERP_SPOT_FLOW`, `PERP_SPOT_STRENGTH`, `PERP_SPOT_CONFIRMS`), `includePerpSpotFlow` joins the context-source key set as its 23rd member (opt-in — no existing agent's report changes), and `perp-spot-flow` joins the prompt-section `kind` union. Same client impact as 5.1.0: only an exhaustive switch on `kind` needs a default branch. Never published as a package version |
| 6.0.0 | Server contract v6.0.0, **breaking**: `VOLUME_RATIO` is retired and replaced by `RVOL`, and its generated header code moves `vol` → `RVOL` at the same time. `MetricKeySchema` auto-derives from the catalog, so the published enum simply stops accepting the old key — an input-acceptance narrowing, the same shape as the v4 and v5 breaks. Two distinct failure modes: authoring a column with `metric: 'VOLUME_RATIO'` is rejected against the enum, and matching rendered headers on `vol` (or `vol_trend` / `vol_rank_hi`) silently stops matching. No alias survives, deliberately. Every persisted reference was migrated server-side, so only client-side literals need action. Never published as a package version |
| 6.1.0 | Server contract v6.1.0, **additive**: `PlatformSectionDTO` gains `columns` — a platform section's composition in the same wire shape a custom section's columns already travel in, empty for a registry-declared special. **Not a copy source**: six platform columns pair a metric with `classifyState`, a deliberate composability exclusion that authoring rejects at construction, so a client that round-trips these into a custom section is refused — correctly. Never published as a package version |
| 7.0.0 | Server contract v7.0.0, **breaking**: the strategy-report preview limits became discoverable and the bare token count was removed. `preview_strategy_report` and `compile_strategy_plan` no longer carry `estimatedTokenCount`; the same number sits one level deeper as `budgetUsage.estimatedTokens.used`, paired with the `cap` that governs it — so a client reading the count changes one path and gains the ceiling it was never told. `tokenCountModel` is unchanged. Discovery adds `budgets.estimatedTokens` and a `previewExecutionLimits` object (serialized-result byte cap, preview deadline), both published cap-only. Never published as a package version |
| 8.0.0 | Server contract v8.0.0, **breaking**, on two axes. `BB_WIDTH × rank` is no longer authorable: `BBwidth` is a price-unit spread that falsely declared `percent`, which was the only thing admitting it to exchange-wide ranking, so it re-declares `signedPrice` and leaves the ranked contract — `{metric: 'BB_WIDTH', transformId: 'rank'}` is rejected and `BBwidth_rank_lo` stops matching, with `BB_WIDTH_PCT` (`bbWidthPct`) shipping as the comparable replacement. Separately the published `unit` enum **widens** with `ratio` and `fraction`, and `RVOL`, `BUY_PRESSURE`, `BB_PCT_B` emit them instead of `percent` — a break for a client holding its own closed copy of that enum, which is the opposite direction from an input narrowing. Values are not rescaled: `buyPres` and `pctB` stay 0–1. Never published as a package version |
| **9.0.0** | Server contract v9.0.0, **breaking**: `compile_strategy_plan`'s `approvedPlan.mismatches` changes on both axes. Both report-coverage codes are renamed off "module" (`ACTIVE_SIGNAL_MODULE_NOT_IN_REPORT` → `ACTIVE_SIGNAL_DATA_NOT_IN_REPORT`, `REPORT_MODULE_SIGNAL_OFF` → `REPORT_DATA_SIGNAL_OFF`), and each mismatch carries a required `data: CoverageDatum[]` — the `(metric, rung)` pairs it is about. A client switching exhaustively on the old code strings stops matching. Coverage is now decided by whether the report renders a signal's declared metrics at the rung that signal reads, so expect warnings never seen before and the disappearance of warnings no composition could clear; mismatches stay advisory and non-blocking. Never published as a package version |
| 10.0.0 | Server contract v10.0.0, **breaking**: challenge participation stops being a declared setting anywhere and becomes identical to effective trade permission, resolved per coin. `create_agent`/`update_agent` stop accepting `arenaChallengeEnabled`, and a deployment policy's slot and per-coin rule shapes stop accepting `challengeEnabled` — all four are `.strict()`, so a client still sending them is rejected rather than ignored, the same input-acceptance narrowing that made v4, v5, v6 and v8 majors. `IntelligenceAgentDTO` drops `arenaChallengeEnabled`; `ResolvedSlotRulesDTO.challengeEnabled` stays and keeps its shape, now derived server-side with the same value and provenance as `tradingEnabled`. The resolution DTO also gains `agentTradingMode` — the preview previously reported trade rules for an agent whose account-level trading was off. Never published as a package version |
| **11.0.0** | Server contract v11.0.0, **breaking**: a catalogued numeric output's `range` changes shape — the closed positional tuple `[min, max]` becomes the half-open object `{ min: number; max?: number }`, travelling through `ScalarSchema` into `list_strategy_vocabulary`, `query_report_catalog` and `get_metric_construction_hints`. A client reading `range[0]`/`range[1]` gets `undefined` **with no error**, which is the silent failure mode a version exists to prevent. The driver: the tuple could not state the truth about the volume/trade-count family — non-negative and unbounded above — and `Infinity` serializes to `null` on the wire; those six metrics now declare `{ min: 0 }` and no longer offer `far`/`near` rank orderings, which on a non-negative value are a synonym pair. Additive alongside it: the transform vocabulary grows 15 → 17 (`efficiency`, `maxShare`), both joining the chain-outer enum served as `chainSuccessors`. **This is the package version paired to the current server contract.** No proxy code change — the version is the client-facing signal, and the proxy's handshake carries it |

## Maintainer release procedure

> [`.github/workflows/publish.yml`](.github/workflows/publish.yml) is the executable release authority. If this recipe and the workflow diverge, correct them together before merging a version change.

Publishing runs only in GitHub-hosted Actions. Never run `npm publish` from the BattleGrid application VM or a maintainer workstation.

**A version change on `main` is the release.** Merge a pull request that changes `package.json`'s version and the workflow does the rest: it confirms that version is not already on the registry, verifies every value expressing it agrees, asserts the deployed server serves that contract major, tests, builds, packs, publishes with npm provenance, and tags what shipped. There is no manual tag step — the tag is an output of a successful publish, not its prerequisite.

That inversion is deliberate. Publication used to be triggered by a tag, which meant a version bump with no tag published nothing **and reported nothing** — how `5.1.0` came to be declared in this repository and absent from the registry, caught by no check at all.

### Release environments and prerequisites

| Responsibility | Environment |
|---|---|
| Confirm npm publishing trust | npmjs.com package settings |
| Prepare and merge the version change | Pull request against `main` |
| Check, build, publish, and tag | GitHub-hosted `ubuntu-latest`, Node 24 |
| Verify registry publication | Any shell |

**The deploy check needs no credential.** `scripts/assert-deployed-contract.mjs` reads `GET /mcp/version`, which the server serves **unauthenticated by design** — the contract version is announced to every connected client and committed to the app repo's `docs/architecture/mcp-manifest.json`, so it is not a secret. Requiring auth would have meant this workflow holding a BattleGrid API key, and every such key carries `mcp:wager` (there is no read-only variant), i.e. authority to submit wagers and close live positions in order to read a version number. The check fails closed on a mismatch, an unreachable endpoint, a non-200, or an unreadable body — but there is no secret to provision, scope, rotate, or leak.

Also confirm npm's Trusted Publisher for `@battlegrid/mcp-server` is GitHub Actions with organization `playbattlegrid`, repository `battlegrid-mcp`, workflow filename `publish.yml`, no environment name, and `npm publish` allowed. The workflow uses short-lived OIDC credentials; do not add a long-lived `NPM_TOKEN`.

### Preparing the version change

- **Read the target version from the generated manifest, never from prose.** The number this package pairs to is `server.contractVersion` in `battlegrid-app`'s `docs/architecture/mcp-manifest.json` — generated by `buildMcpManifest` and CI-verified, on a freshly fetched `origin/main` (a stale ref reports a superseded contract silently). **A contract version quoted in an issue, a pull request, or any other hand-written text is not the target.** During active contract development that number changes on merge, so prose carries a value that was true when written and is unverifiable when read. Every pairing before v9 was sourced from prose, and the v9 pairing was filed against a contract three majors stale.
- **Move all four values together** — `package.json`, both `package-lock.json` version fields (the root `version` and the self-referencing `packages[""].version`), and the exported `VERSION` in `src/index.ts`. The workflow compares all four against each other and fails closed on any disagreement.
- **Merge the version change only after the server is deployed.** The deploy assertion is a safety net, not a routine step: with the ordering right it never fires, and a red workflow on `main` means something is genuinely wrong rather than that you are waiting. Merging early blocks the publish until the deploy lands, then re-run the job — nothing was published and no tag exists to move.

### Which releases need a server deploy

The deploy assertion compares the **contract line** — `MAJOR.MINOR` — not the full version and not the major alone.

- **A contract pairing** — the server's contract moved, so the package follows. This needs the deploy to land first. Note this includes **minor** moves: the contract ships additive changes as minors (`5.1.0`, `5.2.0` and `6.1.0` were all additive), and the proxy announces the full version it publishes, so a package minor ahead of the server would advertise additive features the deployed endpoint does not serve.
- **A proxy-only release** — a fix in this package's own code, a dependency bump, a documentation correction. Move the **PATCH**, which is the package's own space: the contract has never carried a non-zero patch, so a patch bump makes no claim about the server and needs no deploy. This is the historical norm, not an edge case — `1.0.1`, `1.0.2`, `1.1.2`, `1.1.4` and `3.0.1` were all proxy-only, and `3.0.1` is recorded in the version table above as *"Docs only — … No proxy behavior change"*.

Comparing full versions would reject every one of those patch releases; comparing majors alone would let the package advertise a contract minor the server does not serve. The contract line is the boundary that is actually true.

### Verify publication

The workflow publishes and tags on its own; these confirm what landed.

```bash
release_version="$(node -p "require('./package.json').version")"

npm view "@battlegrid/mcp-server@${release_version}" version dist.integrity \
  --json --registry=https://registry.npmjs.org/

npm view @battlegrid/mcp-server dist-tags \
  --json --registry=https://registry.npmjs.org/

npm view "@battlegrid/mcp-server@${release_version}" dist.attestations \
  --json --registry=https://registry.npmjs.org/
```

Require the exact version, `latest` pointing at that version, and a provenance attestation. Confirm the workflow created `mcp-server@${release_version}` and that `gitHead` on the published version is the merge commit. Restart/reconnect running proxies and rediscover `tools/list`, `prompts/list`, and `resources/list`; publication alone does not refresh their startup cache.

There is no separate registry-reconciliation step to remember. "Is this version already published?" is the workflow's own first question — it decides whether the run publishes at all — so a bump can no longer sit in the repository unpublished and unreported the way `5.1.0` did.

**The server-side release canary is not evidence about this package.** `battlegrid-app`'s `server/scripts/release-canary-mcp.ts` connects to the deployed endpoint and compares `client.getServerVersion()` against the server's own imported `MCP_CONTRACT_VERSION` — **both sides are server-side, and it never queries npm.** It passes with this package at any version, including one that was never published. Package-side evidence is exactly three things: the workflow's version-integrity gate, the registry checks above (plus `gitHead` matching the release commit and the handshake constant in the published `dist/index.js`), and a **reconnect** showing `battlegrid@<version>` in the stdio handshake.

Note the deploy assertion in the workflow is a *different* check from that canary and does not share its limitation: it reads the deployed handshake and compares it against **this package's** version, so both sides are not server-side.

If a run fails, inspect it before taking action. An `ENEEDAUTH` failure means the npm Trusted Publisher fields do not match the workflow — fix the publisher configuration and re-run the job. A failed deploy assertion means the server has not deployed that contract major yet; deploy, then re-run. In both cases nothing was published and no tag was created, so there is nothing to move or reuse. Never mutate a published release with `npm audit fix`; dependency remediation goes through a new reviewed commit and version.

## Skills

Install the BattleGrid skill for AI agent instructions:

```bash
npx skills add playbattlegrid/battlegrid-mcp
```

## License

[MIT](LICENSE)
