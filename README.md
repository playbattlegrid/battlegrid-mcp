# @battlegrid/mcp-server

[![npm version](https://img.shields.io/npm/v/@battlegrid/mcp-server)](https://www.npmjs.com/package/@battlegrid/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for [BattleGrid](https://battlegrid.trade) — play crypto prediction games, author trading strategies, and manage intelligence agents from AI agents.

It is a thin, authenticated **stdio proxy** to BattleGrid's remote MCP server (Stripe `@stripe/mcp` pattern — no business logic). It discovers tools, prompts, and resources live from the server and re-exposes them to local MCP clients (Claude Desktop, Claude Code, Cursor). Capabilities are always **discovered live** — this package never hardcodes the tool catalog.

## v3 — breaking major (strategy authoring)

**v3 is a breaking major that pairs with the BattleGrid server's strategy-authoring release.** Upgrade the package and the server major together.

- **Strict authoring envelopes.** `get_strategy_section_template`, `update_strategy_signal_rule`, `compile_strategy_plan`, and `apply_strategy_plan` publish one strict server-owned object, `{ request: canonicalPayload }`. In multi-account mode the proxy adds `account` **only** as a sibling of `request`, producing exactly `{ account, request }`; on a call it strips only `account` and forwards the unchanged `{ request }`. It never descends into, flattens, or reconstructs the nested request.
- **`create_strategy` is retired.** Direct strategy creation no longer exists. Author strategies with the compile → review → apply workflow below, and bind them to agents at agent-creation time (`create_intelligence_agent({ …, strategyId })`). There is no alias, shim, or flat-payload fallback.
- **Rediscover after deployment.** Publishing the package does **not** refresh a running proxy's cached capability snapshot. After the server cutover, restart/reconnect the proxy process and re-run `tools/list`, `prompts/list`, and `resources/list`.

> Earlier majors: **v1.x** single/multi-account stdio proxy; **v2.0.0** moved the default `BATTLEGRID_API_URL` to the `/mcp` suffix. See [Rediscovery & versioning](#rediscovery--versioning).

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
5. **Apply only the exact reviewed plan.** After explicit user approval, call `apply_strategy_plan({ request: { plan, planToken, confirm: true } })`. Build `plan` from the compiled `approvedPlan` by copying, byte-identical: `operation`; `postState.id` as `strategyId`; `expiresAt`; `expectedRevision` for UPDATE/RESTORE; `explicitRuleOverrides` as `rules`; and from `postState` — `name`, `description`, `tagline`, `timeframe`, `regimeAutoDerive`, `regimeTimeframe`, `marketReadText`, `sections` (including every generated `custom:` key), `minAggregateScore`, `minRequiredCount`, `minAtrPct`. Send nothing else — the server re-derives the scorecard, diff, viability, mismatches, seed, revision, and bound-agent impact, and rejects `diff`, `viability`, `mismatches`, `signalRules`, `creationSeed`, `proposedRevision`, `bindingImpact`, `authoringCatalogDigest`, and `reviewContext` as unknown keys. Changed configuration propagates to every bound agent immediately.

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

- **Package/server major pairing.** This package's major version pairs with the BattleGrid server's strategy-authoring major. Run matching majors.
- **Rediscover after a server cutover.** Package publication does not refresh a running proxy's cached startup snapshot. Restart/reconnect the proxy and re-run `tools/list`, `prompts/list`, and `resources/list` after the server deploys.
- **Restart after key rotation.** API keys are read once at process startup; rotate a key, then restart the proxy.

| Version | Changes |
|---------|---------|
| 1.x | Single/multi-account stdio proxy, identity discovery, connection retry, capability discovery |
| 2.0.0 | Default `BATTLEGRID_API_URL` moved to the `/mcp` suffix |
| 3.0.0 | Strategy-authoring major: strict `{ account, request }` authoring envelopes with strip-only-account routing, compile → review → apply workflow, strategy-bound agent creation, and removal of the retired `create_strategy` operation |
| **3.0.1** | Docs only — `apply_strategy_plan` now takes `{ plan, planToken, confirm }` instead of `{ approvedPlan, … }`; the server re-derives every planner-derived field and rejects resubmitted ones as unknown keys. No proxy behavior change |

## Maintainer release procedure

> [`.github/workflows/publish.yml`](.github/workflows/publish.yml) is the executable release authority. If this recipe and the workflow diverge, correct them together before creating a release tag.

Publishing runs only in GitHub-hosted Actions. Never run `npm publish` from the BattleGrid application VM or a maintainer workstation. The maintainer's shell prepares and pushes one immutable tag; the workflow checks out that pinned commit, tests, builds, packs, and publishes it with npm provenance.

### Release environments and prerequisites

| Responsibility | Environment |
|---|---|
| Confirm npm publishing trust | npmjs.com package settings |
| Verify the release and push its tag | Clean `battlegrid-mcp` checkout with GitHub write access |
| Build, test, pack, and publish | GitHub-hosted `ubuntu-latest`, Node 24 |
| Verify registry publication | Any shell |

Before tagging:

- Merge the complete release into `main`; never release a feature-branch commit.
- Use Node 22 or 24 locally. CI uses Node 24; odd-numbered Node releases are not supported by the test toolchain.
- Ensure `package.json`, `package-lock.json`, and `src/index.ts`'s exported `VERSION` all contain the intended version.
- Confirm npm's Trusted Publisher for `@battlegrid/mcp-server` is GitHub Actions with organization `playbattlegrid`, repository `battlegrid-mcp`, workflow filename `publish.yml`, no environment name, and `npm publish` allowed. The workflow uses short-lived OIDC credentials; do not add a long-lived `NPM_TOKEN`.

### Verify and tag the merged commit

Run from a clean `battlegrid-mcp` checkout, substituting the intended unused version:

```bash
release_version=3.0.1
release_tag="mcp-server@${release_version}"

git fetch origin --tags
git switch main
git pull --ff-only origin main

test -z "$(git status --porcelain)"
test "$(node -p "require('./package.json').version")" = "$release_version"
test "$(node -p "require('./package-lock.json').version")" = "$release_version"
test "$(node -p "require('fs').readFileSync('src/index.ts','utf8').match(/VERSION = '([^']+)'/)[1]")" = "$release_version"
test -z "$(git tag --list "$release_tag")"

npm ci
npm test
npm run build
npm pack --dry-run

release_commit="$(git rev-parse HEAD)"
git tag -a "$release_tag" "$release_commit" -m "Publish @battlegrid/mcp-server $release_version"
git show --no-patch --decorate "$release_tag"
git push origin "$release_tag"
```

A tag matching `mcp-server@*` starts the [publish workflow](https://github.com/playbattlegrid/battlegrid-mcp/actions/workflows/publish.yml). Wait for that exact tag run to complete successfully before querying npm; a temporary registry `E404` while the workflow is still running is not a publication failure.

The workflow fails closed unless the tag version, package version, lockfile version, and source handshake version are identical. It then runs the test suite, TypeScript build, and package dry run before `npm publish --access public --provenance`.

### Verify publication

```bash
npm view "@battlegrid/mcp-server@${release_version}" version dist.integrity \
  --json --registry=https://registry.npmjs.org/

npm view @battlegrid/mcp-server dist-tags \
  --json --registry=https://registry.npmjs.org/

npm view "@battlegrid/mcp-server@${release_version}" dist.attestations \
  --json --registry=https://registry.npmjs.org/
```

Require the exact version, `latest` pointing at that version, and a provenance attestation. Record the release tag and commit. Restart/reconnect running proxies and rediscover `tools/list`, `prompts/list`, and `resources/list`; publication alone does not refresh their startup cache.

If publishing fails, inspect the tag's workflow before taking action. An `ENEEDAUTH` failure means the npm Trusted Publisher fields do not match the workflow. Fix the publisher configuration and rerun the failed job without moving the tag. Never retarget or reuse a published tag, and never mutate a tagged release with `npm audit fix`; dependency remediation goes through a new reviewed commit and version.

## Skills

Install the BattleGrid skill for AI agent instructions:

```bash
npx skills add playbattlegrid/battlegrid-mcp
```

## License

[MIT](LICENSE)
