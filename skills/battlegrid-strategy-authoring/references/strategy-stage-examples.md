# Strategy stage examples

Each example is the tool's whole input: `strategyId` and `draftVersion` sit at the top level beside `axes`, never
inside `axes`. Every example below is checked in CI against the live
`stage_strategy_draft` schema; a create example is also checked for the axes a new strategy needs. Its shape is
current.

These examples show the input's shape and the small axes. A full composition (report sections, conditions, trade
levels) is in `strategy-examples`' playbooks, which have their own compile gate.

Every `<UPPER_SNAKE>` value is a placeholder: `<STRATEGY_ID>` is the id a read returned. Never send a placeholder as
written, and never invent an id. `draftVersion` is the version `get_strategy_draft` returned: 0 when there was no
draft, and for a new create draft. Each axis you send is written whole, and an axis you omit keeps the value the draft
already has.

## Open a create draft

Omit `strategyId`. The response carries the minted id, which every later call names. A new strategy needs IDENTITY
and TIMEFRAME_PROFILE before it can be created.

```json stage_strategy_draft
{
  "draftVersion": 0,
  "axes": {
    "IDENTITY": {
      "name": "Squeeze Breakout",
      "description": "Enters when a volatility squeeze resolves upward on rising volume.",
      "tagline": "Buys the release of a tight range"
    },
    "TIMEFRAME_PROFILE": { "timeframe": "1h" }
  }
}
```

## Change an existing strategy's trade levels

TRADE_LEVEL_POLICY is sent whole: all four dials and the bracket, even when only one changes. `minAtrPct` is the ATR%
volatility floor a coin must clear before any condition is read; the next three are the stop-loss band and the
reward-to-risk floor; `tradeBracket` holds, per trade direction, the one stop and the one exit plan every trade in that
direction is built from — there is no list, and nothing chooses among setups. An ATR stop must sit inside the band (at
or above `minStopLossAtrMultiple`, at or below `maxStopLossAtrMultiple`), or the save refuses it. An exit plan is 1–4
targets, nearest first, each closing a whole-number `closePct` of the position; whatever the plan does not close is the
runner, which only Trailing exits, so a plan that leaves one needs `trailingEnabled`. A last target closing `0` is the
trail objective: it places no order and only sets how far the runner's trail measures. An all-R plan must pay at least
`minRiskRewardRatio`, or the save refuses it. A level stop or target names a level the strategy's report yields — here
the platform support/resistance section's Donchian edge. The LONG bracket below is a 1.5 × ATR stop with a scale-out
(half at 1R, half at 3R — it pays 2R); the SHORT bracket is a stop 0.25 × ATR beyond the upper channel edge with a
runner plan (half at 2R, the rest trailed towards 6R — it pays 2R: the trail objective earns nothing).

```json stage_strategy_draft
{
  "strategyId": "<STRATEGY_ID>",
  "draftVersion": 2,
  "axes": {
    "TRADE_LEVEL_POLICY": {
      "minStopLossAtrMultiple": 1,
      "maxStopLossAtrMultiple": 2,
      "minRiskRewardRatio": 1.5,
      "minAtrPct": 0.8,
      "tradeBracket": {
        "LONG": {
          "stop": { "kind": "ATR", "atrMultiple": 1.5 },
          "exitPlan": {
            "targets": [
              { "method": { "kind": "R_MULTIPLE", "multiple": 1 }, "closePct": 50 },
              { "method": { "kind": "R_MULTIPLE", "multiple": 3 }, "closePct": 50 }
            ]
          }
        },
        "SHORT": {
          "stop": {
            "kind": "LEVEL",
            "level": { "metric": "DONCHIAN_UPPER", "timeframe": { "rel": "anchor" }, "bars": null, "offset": 0, "knobs": {}, "windowExtreme": null },
            "bufferAtrMultiple": 0.25
          },
          "exitPlan": {
            "targets": [
              { "method": { "kind": "R_MULTIPLE", "multiple": 2 }, "closePct": 50 },
              { "method": { "kind": "R_MULTIPLE", "multiple": 6 }, "closePct": 0 }
            ]
          }
        }
      }
    }
  }
}
```
