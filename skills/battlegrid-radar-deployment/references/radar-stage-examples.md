# Radar stage examples

Complete `stage_radar_deployment_draft` inputs, one per construction in **Shaping a Radar rule**. Each is
checked in CI against the live stage schema and composed into a policy the aggregate accepts, so its
shape is current.

Every `<UPPER_SNAKE>` value is a placeholder. Replace it with the id a read returned:

- `<COIN_ID>` comes from `get_coin_metadata`.
- `<AGENT_ID>` comes from your agent list.
- `<OTHER_AGENT_ID>` is a second agent from your agent list, where an example deploys two.

Every example addresses the player's Main team's deployment of the coin. For another team's deployment,
add its `teamId` (from `list_radar_deployments` or `get_account_state.teams`) beside `coinId`.

Never send a placeholder as written, and never invent an id. `draftVersion` is the version
`get_radar_deployment_draft` returned: 0 when the deployment has no draft. Each axis you send is written whole, and an axis
you omit keeps the value the draft already has.

## On duty whenever no rule matches — the default slot

On a coin with no rules, the default slot is on duty at every instant. This is the construction for "put this agent
on this coin" with no condition named.

```json stage_radar_deployment_draft
{
  "coinId": "<COIN_ID>",
  "draftVersion": 0,
  "axes": {
    "DEFAULT_SLOT": { "defaultSlot": { "agentId": "<AGENT_ID>", "minConviction": null } }
  }
}
```

## On duty only in named regimes

A regime condition names the market structures its rule is on duty in — `bull_trend`, `bear_trend`, `bull_range`,
`bear_range` — and two more settings, both required:

- `volatilities` — the volatility levels (`contracting`, `normal`, `expanding`) the rule runs in, each listed once.
  All three place no volatility constraint; that is the setting to send unless the player narrows it.
- `duringWarnings` — what the rule does while the reading carries a warning (a crash, or momentum diverging in a
  trend): `run` keeps it on duty, `pause` stands it down until the warning clears, `only` puts it on duty only while
  a warning holds. `run` is the setting to send unless the player says otherwise.

`minConviction` on the rule is the trade bar (0–1, or null to inherit the agent's). `minConviction` inside the
regime condition is the regime-reading floor, and must be a level one of the selected regimes can emit at one of the
selected volatilities.

```json stage_radar_deployment_draft
{
  "coinId": "<COIN_ID>",
  "draftVersion": 0,
  "axes": {
    "RULES": {
      "rules": [
        {
          "agentId": "<AGENT_ID>",
          "minConviction": null,
          "conditions": [
            {
              "kind": "regime",
              "regimes": ["bull_trend", "bull_range"],
              "minConviction": "high",
              "volatilities": ["contracting", "normal", "expanding"],
              "duringWarnings": "run"
            }
          ]
        }
      ]
    }
  }
}
```

## In a bear trend, standing down during warnings

A crash continues a bear trend as often as it ends one, so whether a warning stops the rule is the player's call.
Here the agent works the bear trend and stands down while a crash or a momentum divergence holds.

```json stage_radar_deployment_draft
{
  "coinId": "<COIN_ID>",
  "draftVersion": 0,
  "axes": {
    "RULES": {
      "rules": [
        {
          "agentId": "<AGENT_ID>",
          "minConviction": null,
          "conditions": [
            {
              "kind": "regime",
              "regimes": ["bear_trend"],
              "volatilities": ["contracting", "normal", "expanding"],
              "duringWarnings": "pause"
            }
          ]
        }
      ]
    }
  }
}
```

## On duty only in named hours and days

Hours are UTC, 0–23. Days run 0 (Sunday) to 6. Each is listed once. For a named exchange session —
including the London and Tokyo opens, the London–New York overlap and the Asia trading session — stage the
`hours` `get_radar_market_hours` serves for it rather than a set of your own; the example below is a shape, not a
session. For weekends, stage the served `weekends` `hours` and `days` together. No session close is served: a close
is staged only as hours the player names.

```json stage_radar_deployment_draft
{
  "coinId": "<COIN_ID>",
  "draftVersion": 0,
  "axes": {
    "RULES": {
      "rules": [
        {
          "agentId": "<AGENT_ID>",
          "minConviction": null,
          "conditions": [
            { "kind": "hours", "hours": [13, 14, 15, 16, 17, 18, 19, 20], "days": [1, 2, 3, 4, 5] }
          ]
        }
      ]
    }
  }
}
```

## In named regimes during named hours — one condition of each kind

This rule trades either trend, but only while volatility is expanding, and only in the US session hours.

```json stage_radar_deployment_draft
{
  "coinId": "<COIN_ID>",
  "draftVersion": 0,
  "axes": {
    "RULES": {
      "rules": [
        {
          "agentId": "<AGENT_ID>",
          "minConviction": 0.6,
          "conditions": [
            { "kind": "hours", "hours": [13, 14, 15, 16], "days": [1, 2, 3, 4, 5] },
            {
              "kind": "regime",
              "regimes": ["bull_trend", "bear_trend"],
              "volatilities": ["expanding"],
              "duringWarnings": "run"
            }
          ]
        }
      ]
    }
  }
}
```

## Rules plus a default slot

Every rule that matches is on duty, and the first rule listed is offered the coin's fire first. The default slot is
on duty only while no rule matches, so here the second agent is on duty whenever the coin is in neither of the
first agent's regimes.

```json stage_radar_deployment_draft
{
  "coinId": "<COIN_ID>",
  "draftVersion": 0,
  "axes": {
    "RULES": {
      "rules": [
        {
          "agentId": "<AGENT_ID>",
          "minConviction": null,
          "conditions": [
            {
              "kind": "regime",
              "regimes": ["bear_trend", "bear_range"],
              "volatilities": ["contracting", "normal", "expanding"],
              "duringWarnings": "run"
            }
          ]
        }
      ]
    },
    "DEFAULT_SLOT": { "defaultSlot": { "agentId": "<OTHER_AGENT_ID>", "minConviction": null } }
  }
}
```

## Clear the default slot on a deployed coin

This stages only `DEFAULT_SLOT`, so the deployed rules stay as they are. Send `RULES` only when the rules change, and
then send the complete list: a rule you do not resend is deleted. `draftVersion` here is the version your read
returned.

```json stage_radar_deployment_draft
{
  "coinId": "<COIN_ID>",
  "draftVersion": 3,
  "axes": {
    "DEFAULT_SLOT": { "defaultSlot": null }
  }
}
```
