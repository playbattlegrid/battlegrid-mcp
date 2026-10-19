# Proposal shapes

A proposal is one lever's **one axis, whole**: `{ kind, targetId, axes, baseRevision }`, where `axes` holds exactly
one key — the axis — whose value is the complete axis in the kind's own draft vocabulary. "Whole" means every member
the axis carries, each at its current value except the one you change: an omitted member is not "unchanged", it is a
proposal the assessment refuses or a value the owner would lose. So every proposal starts from the target's current
values, read in the same review.

`targetId` and `baseRevision` come from `get_officer_review_context`'s `targets`: the strategy id, the agent id or the
Radar coin id, and that target's `committedRevision`. A proposal against a target the review context does not list
is outside your scope.

Every value below is a placeholder; replace it with what the reads served. Never send an id you did not read.

## Strategy — `kind: 'strategy'`, `targetId` the strategy id

Read the current values with `get_strategy`. One of four axes:

### `TRADE_LEVEL_POLICY`

All four members, every one a number: `minAtrPct` (the volatility floor, percent), `minStopLossAtrMultiple` and
`maxStopLossAtrMultiple` (the hard stop's band, in ATR), `minRiskRewardRatio` (the target's floor over the stop).

```json
{
  "kind": "strategy",
  "targetId": "<STRATEGY_ID>",
  "baseRevision": 12,
  "axes": {
    "TRADE_LEVEL_POLICY": {
      "minAtrPct": 0.6,
      "minStopLossAtrMultiple": 1.2,
      "maxStopLossAtrMultiple": 2.5,
      "minRiskRewardRatio": 1.8
    }
  }
}
```

### `POSITION_MANAGEMENT`

The exit policy, all thirteen members: `breakEvenEnabled`, `breakEvenTriggerR`, `trailingEnabled`,
`trailingTriggerR`, `trailingGivebackPct`, `trailingBufferPct`, `timeDecayEnabled`, `timeDecayGracePeriodMinutes`,
`timeDecayIntervalMinutes`, `timeDecayTightenPct`, `timeDecayMaxTightenPct`, `timeDecayStaleThresholdTpProgressPct`,
`decisionInvalidationExitEnabled`. A mechanism switched off keeps its dial values: send them as read.

### `CONDITIONS`

`{ conditions: [...] }` — **every** condition of the strategy, in the order the strategy read serves them, each
`{ conditionKey, name, definition, verdict, required, exitSide }` exactly as read, with your one change: a condition
removed, or one existing condition's `required` or `verdict` changed. A dropped condition that another condition
references is refused by the assessment. Composing a new condition column is authoring work, outside a review:
record the finding and name the authoring flow as the owner's step.

### `ENTRY`

`{ entry: { trigger } }` for a trigger that takes no dials, or `{ entry: { trigger, levelOffsetAtrMultiple,
validForBars } }` for a level trigger — the trigger the strategy read serves, or the one you propose, with every dial
it honours and none it does not.

## Agent — `kind: 'agent'`, `targetId` the agent id

### `TRADING_CONFIG`

`{ tradingConfig: { ... } }` — the agent's complete trading configuration from `get_intelligence_agent`, less the two
members the server derives (`strategyTimeframe`, `regimeTimeframe`): `minAllocationUsd`, `maxDailyTrades`,
`balanceThresholdUsd`, `maxLeverage`, `maxSlippageBps`, `maxConcurrentExposureUsd`, `maxCumulativeDrawdownUsd`,
`maxDailyLossUsd` and `positionSizePresets` (the whole preset ladder), each inside the bounds
`get_trading_config_catalog` serves. Change the one rail the finding names; send the rest as read.

## Radar deployment — `kind: 'radar-deployment'`, `targetId` the coin id

### `RULES`

`{ rules: [...] }` — **every** rule slot of the coin's policy from `get_radar_deployment`, in priority order (the
first is priority 1), the catch-all default excluded. Each rule is `{ agentId, minConviction, conditions }` as read,
with the one rule that routes this agent changed. A rule's conditions are a non-empty list of:

- `{ kind: 'regime', regimes: [...] }`, with an optional `minConviction` — the regimes the rule is on duty in, by
  stored value (`bull_expansion`, `bear_expansion`, `bull_ranging`, `bear_ranging`, `contraction`, `volatile`);
  excluding a losing regime is this list without it;
- `{ kind: 'hours', hours: [...], days: [...] }` — UTC hours 0–23 and UTC weekdays 0 (Sunday) – 6, both non-empty.

```json
{
  "kind": "radar-deployment",
  "targetId": "<COIN_ID>",
  "baseRevision": 4,
  "axes": {
    "RULES": {
      "rules": [
        {
          "agentId": "<AGENT_ID>",
          "minConviction": null,
          "conditions": [
            { "kind": "regime", "regimes": ["bull_expansion", "bull_ranging", "contraction"] }
          ]
        },
        {
          "agentId": "<OTHER_AGENT_ID>",
          "minConviction": 0.6,
          "conditions": [
            { "kind": "hours", "hours": [13, 14, 15, 16], "days": [1, 2, 3, 4, 5] }
          ]
        }
      ]
    }
  }
}
```

The catch-all default is a different axis and is never part of a Radar proposal.
