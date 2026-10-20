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

Read the current values with `get_strategy`. One of five axes:

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

### `REPORT`

`{ sections: [...] }` — **every** section of the strategy's report, in the order `get_strategy` serves them, with
your one change: a platform section added or removed. Each section is a reference: a platform section is
`{ kind: 'platform', sectionKey }`, its key one `list_strategy_categories` serves; a custom section is
`{ kind: 'custom', sectionKey }`, its `custom:<uuid>` key as `get_strategy` serves it, and nothing else — the submit
takes its title, columns, benchmark and note from the committed report, so a review never edits one. A custom key the
report does not carry is refused. A report that drops a section a condition reads is refused by the assessment: keep
it, or propose the condition change first. Composing a new custom section is authoring work, outside a review.

```json
{
  "kind": "strategy",
  "targetId": "<STRATEGY_ID>",
  "baseRevision": 12,
  "axes": {
    "REPORT": {
      "sections": [
        { "kind": "platform", "sectionKey": "includePriceAction" },
        { "kind": "custom", "sectionKey": "custom:<SECTION_UUID>" },
        { "kind": "platform", "sectionKey": "includeVolume" }
      ]
    }
  }
}
```

## Agent — `kind: 'agent'`, `targetId` the agent id

Read the current values with `get_intelligence_agent`. One of four axes:

### `TRADING_CONFIG`

`{ tradingConfig: { ... } }` — the agent's complete trading configuration from `get_intelligence_agent`, less the two
members the server derives (`strategyTimeframe`, `regimeTimeframe`): `minAllocationUsd`, `maxDailyTrades`,
`balanceThresholdUsd`, `maxLeverage`, `maxSlippageBps`, `maxConcurrentExposureUsd`, `maxCumulativeDrawdownUsd`,
`maxDailyLossUsd` and `positionSizePresets` (the whole preset ladder), each inside the bounds
`get_trading_config_catalog` serves. Change the one rail the finding names; send the rest as read. A rail refusal
names its rail as `tradingConfigMember` on the review read.

### `BEHAVIOR`

`{ behavior: { risk, outlook, conviction } }` — all three members, the ones you do not change as read: `risk` one of
`CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`; `outlook` one of `OPTIMIST`, `REALIST`, `PESSIMIST`; `conviction` one of
`CAUTIOUS`, `MEASURED`, `BOLD`.

### `MODEL`

`{ modelId }` — a `modelId` `list_approved_models` serves now. The model sets what each decision costs: cite the
agent's LLM spend against its net as the finding.

### `STRATEGY_BINDING`

`{ strategyId }` — an active strategy `list_strategies` serves: one the owner authored, or a library strategy. Never
another user's, never an archived one. A rebind carries nothing else: the strategy and regime timeframes follow the
new strategy, and each open position keeps the rules it opened under.

```json
{
  "kind": "agent",
  "targetId": "<AGENT_ID>",
  "baseRevision": 14,
  "axes": { "STRATEGY_BINDING": { "strategyId": "<STRATEGY_ID>" } }
}
```

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

Every agent a rule names is an agent the coin already routes: placing an agent on a coin is the owner's step, and the
submit refuses a proposal naming any other.

### `DEFAULT_SLOT`

`{ defaultSlot: { agentId, minConviction } }` — the catch-all that takes the coin when no rule is on duty, its agent one
the coin already routes; or `{ defaultSlot: null }` to remove the catch-all. Read it with `get_radar_deployment`.
