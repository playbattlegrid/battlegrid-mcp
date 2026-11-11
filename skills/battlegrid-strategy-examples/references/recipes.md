# Recipes — copy-adaptable fragments

Column objects for a custom section's `columns[]`, condition fragments for `conditions[]`, and the
coin-selection and discovery shapes an author reaches for while writing a payload.

**Shapes are binding. Tokens are illustrations** — re-discover every metric, transform and parameter
against the live tools (`list_strategy_categories`, `list_strategy_vocabulary`,
`get_metric_construction_hints`, `get_strategy_column_contract`) before staging. A recipe is a
worked shape, never a substitute for discovery.

Read `## Header grammar` and `## Conditions` in the skill body first: how a column's header is
generated, how event columns resolve, what `{abs: …}` binds, and which classifications are states
rather than events all live there. This document assumes them.

**Contents**
- Column recipes
- Cross detection
- Recency and structure
- Candle at a swing and liquidity-pool sweeps
- Board-relative rank recipes
- Cross-venue and perp/spot basis
- Crowd positioning
- Market and stablecoin subjects
- Coin selection
- Discovery fields worth reading

## Column recipes

| Intent | Column | Header it generates |
|---|---|---|
| Live traded price | `{ "metric": "LAST", "transformId": "value", "timeframe": { "rel": "anchor" } }` | `last` |
| Momentum build-up | `{ "metric": "RSI14", "transformId": "trajectory", "timeframe": { "rel": "anchor" }, "window": 4 }` | `RSI14_t3…_now`, `RSI14_trend` |
| Closed-bar-only trajectory | add `"bars": "closed"` to any trajectory | same, drawn from closed bars |
| Extension from trend | `{ "metric": "SMA50", "transformId": "distance", "timeframe": { "rel": "anchor" } }` | `dist_SMA50` (signed %) |
| Touch of the 20 EMA within half an ATR | `{ "metric": "EMA20", "transformId": "levelInteraction", "timeframe": { "rel": "anchor" }, "touchAtr": 0.5 }` | `EMA20_lvl_a0.5` — a column carries a buffer or an ATR multiple, never both |
| Touch of VWAP within 10 bps | `{ "metric": "VWAP", "transformId": "levelInteraction", "timeframe": { "rel": "anchor" }, "buffer": 10 }` | `VWAP_lvl_b10` |
| Funding paid over a day | `{ "metric": "FUNDING_RATE", "transformId": "aggregate", "timeframe": { "rel": "anchor" }, "window": 24 }` | `rate_mean24` |
| Chop filter on the entry rung | `{ "metric": "CLOSE", "transformId": "efficiency", "timeframe": { "rel": "lower" }, "window": 4, "bars": "closed" }` | `close_ltf_er` (≥0.6 directional; 4 changes, the last 5 closes) |
| One-bar volume concentration | `{ "metric": "VOLUME", "transformId": "maxShare", "timeframe": { "rel": "lower" }, "window": 4, "bars": "closed" }` | `volBase_ltf_maxShare` |
| Room to structure | `{ "metric": "STRUCT_ZONES", "transformId": "nearestZoneDist", "timeframe": { "rel": "regime" }, "side": "resistance" }` | `zones_htf_resist_dist` |
| Last **closed** daily read | `{ "metric": "RSI14", "transformId": "value", "timeframe": { "abs": "1d" }, "bars": "closed" }` | `RSI14_1d` — the newest completed daily bar |
| Price in BTC (relative value) | `{ "metric": "CLOSE", "transformId": "relativeTo", "timeframe": { "rel": "anchor" } }` | `close_BTC_rel` — SOL ÷ BTC, TradingView's `SOLUSDT/BTCUSDT` |
| Stretched vs ETH | `{ "metric": "CLOSE", "transformId": "relativeTo", "chainedTransformId": "zscore", "timeframe": { "rel": "anchor" }, "instrument": "ETH", "window": 20 }` | `close_ETH_rel_z20` — the ratio's z-score; above 2 is rich vs ETH |
| Momentum lead over BTC | `{ "metric": "RSI14", "transformId": "relativeTo", "timeframe": { "rel": "anchor" } }` | `RSI14_BTC_rel` — RSI minus BTC's RSI, in points |

## Cross detection

`crossDetect` is the transform that turns a pair into an EVENT column — it prints on the crossing bar
and is null otherwise:

```json
{ "metric": "MACD_HIST", "transformId": "crossDetect", "timeframe": { "rel": "anchor" } }
```

An event column is a trigger inside a carrier, never a standing state; pair it with a persistent
state for regime. The skill body's `## Header grammar` states that rule and is the authority on it —
a condition that reads a `crossDetect` column as a state reads FALSE on nearly every bar, because a null reads FALSE.

## Recency and structure

"How long since", "the first time in N bars" and "how many lower highs" are holds over a clause — no
transform counts bars since an event, and no column is built over a condition. Each recipe below is a
whole condition; adapt its clause, its numbers and its `required`, and keep its shape.

**Counting.** Bars since A counts the bar being decided as 0, so "A within n" — the clause held
`{ "atLeast": 1, "of": n }` — is "bars since A is at most n − 1". This counts bars since a clause read
TRUE; it is not a swing pivot's age, which `fractalHiAgo` / `fractalLoAgo` count differently (see
`tradingview-ports.md`).

**Absence.** A read that ran and found no value reads FALSE (the skill body, `## Conditions`), so a `NOT`
over it reads TRUE on a coin with no value — a listing younger than its indicator's warm-up, for one.
Every recipe that holds a `NOT` therefore sits inside an `ALL` with a member that needs the value, so a
recipe copied as a required gate reads FALSE, never TRUE, when the value is missing.

**Bars since A is under n** — RSI was oversold within the last 5 closes:

```json
{ "conditionKey": "OVERSOLD_WITHIN_5", "name": "Oversold within 5 closes", "verdict": null, "required": true, "exitSide": null,
  "definition": { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "lt", "value": 30, "hold": { "atLeast": 1, "of": 5 } } }
```

**Bars since A is at least n** — RSI has not been oversold for 5 closes. The `NOT` alone would read TRUE
on a coin with no RSI, so `RSI14_now gte 0` requires the value to be there:

```json
{ "conditionKey": "NOT_OVERSOLD_FOR_5", "name": "Not oversold for 5 closes", "verdict": null, "required": true, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "gte", "value": 0, "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "group", "op": "NOT", "hold": { "atLeast": 1, "of": 1 }, "members": [
      { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "lt", "value": 30, "hold": { "atLeast": 1, "of": 5 } } ] } ] } }
```

**Bars since A is between a and b** — RSI was last oversold 3 to 6 closes ago: within `b + 1` = 7, and
not within `a` = 3. The `NOT` reads TRUE with no value, and the first member then reads FALSE:

```json
{ "conditionKey": "OVERSOLD_3_TO_6_BARS_AGO", "name": "Oversold 3 to 6 closes ago", "verdict": null, "required": true, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "lt", "value": 30, "hold": { "atLeast": 1, "of": 7 } },
    { "kind": "group", "op": "NOT", "hold": { "atLeast": 1, "of": 1 }, "members": [
      { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "lt", "value": 30, "hold": { "atLeast": 1, "of": 3 } } ] } ] } }
```

**The first cross above L in N bars** — RSI crossed above 50 on the decided bar, and read at or below 50
on the 5 closes before it: the cross, and `lte 50` on at least `N − 1` of the newest `N` = 6 closes (the
decided bar itself reads above 50). A cross is an edge, so it holds Once; the level clause carries the
count:

```json
{ "conditionKey": "FIRST_CROSS_ABOVE_50_IN_6", "name": "First cross above 50 in 6 closes", "verdict": null, "required": true, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "crossesAbove", "value": 50, "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "lte", "value": 50, "hold": { "atLeast": 5, "of": 6 } } ] } }
```

**The first A in N bars, for an A that is not an edge** — RSI is oversold now and was not oversold on 2
or more of the newest 6 closes, so this is its first oversold close in 6. With no value the first member
reads FALSE:

```json
{ "conditionKey": "FIRST_OVERSOLD_IN_6", "name": "First oversold close in 6", "verdict": null, "required": true, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "lt", "value": 30, "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "group", "op": "NOT", "hold": { "atLeast": 1, "of": 1 }, "members": [
      { "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "lt", "value": 30, "hold": { "atLeast": 2, "of": 6 } } ] } ] } }
```

**k lower highs in N bars** — the published swing high stepped down on at least 2 of the newest 8 closes,
over a `{ "metric": "SWING_FRACTAL_HIGH", "transformId": "value", "timeframe": { "rel": "anchor" } }`
column (header `fractalHi`). `decreased` is not an edge, so it counts like any clause; it counts each
step down of the decided pivot, which is a lower high against the pivot before it:

```json
{ "conditionKey": "TWO_LOWER_HIGHS_IN_8", "name": "Two lower highs in 8 closes", "verdict": null, "required": true, "exitSide": null,
  "definition": { "kind": "clause", "column": { "sectionKey": null, "header": "fractalHi" }, "op": "decreased", "hold": { "atLeast": 2, "of": 8 } } }
```

## Candle at a swing and liquidity-pool sweeps

A candle pattern AT a swing, and a sweep OF a liquidity pool, are compositions of shipped columns — no
one column reads either whole. Each recipe below is a whole condition; adapt its verdict and its `required`,
and keep its shape.

| Intent | Column | Header |
|---|---|---|
| Swing low age at a 21/21 pair | `{ "metric": "SWING_FRACTAL_LOW_BARS_AGO", "transformId": "value", "timeframe": { "rel": "anchor" }, "leftBars": 21, "rightBars": 21 }` | `fractalLoAgo_l21r21` |
| Swing high age at a 21/21 pair | `{ "metric": "SWING_FRACTAL_HIGH_BARS_AGO", "transformId": "value", "timeframe": { "rel": "anchor" }, "leftBars": 21, "rightBars": 21 }` | `fractalHiAgo_l21r21` |
| Pin bar of the bar 21 back | `{ "metric": "CANDLE_PIN", "transformId": "value", "timeframe": { "rel": "anchor" }, "offset": 21 }` | `pin_o21` |
| Engulfing of the bar 21 back | `{ "metric": "CANDLE_ENGULFING", "transformId": "value", "timeframe": { "rel": "anchor" }, "offset": 21 }` | `engulf_o21` |
| Buyside pool interaction | `{ "metric": "LIQUIDITY_POOL_ABOVE", "transformId": "levelInteraction", "timeframe": { "rel": "anchor" } }` | `poolAbove_lvl` |
| Sellside pool interaction | `{ "metric": "LIQUIDITY_POOL_BELOW", "transformId": "levelInteraction", "timeframe": { "rel": "anchor" } }` | `poolBelow_lvl` |
| Closed back under the buyside pool the last bar retired | `{ "metric": "LIQUIDITY_POOL_ABOVE_RECLAIMED", "transformId": "value", "timeframe": { "rel": "anchor" } }` | `poolAboveRecl` |
| Closed back over the sellside pool the last bar retired | `{ "metric": "LIQUIDITY_POOL_BELOW_RECLAIMED", "transformId": "value", "timeframe": { "rel": "anchor" } }` | `poolBelowRecl` |

**Candle at a swing** — LuxAlgo's *Swing Highs/Lows & Candle Patterns* at its length 21: a swing pivot of
21 bars each side, and the candle pattern of the pivot bar itself, Pine's `[21]`. A pivot is decided on
the bar that completes its right side, where the swing age reads the pair's `rightBars`, so on that bar
the pivot bar is `rightBars` bars back and the pattern column reads it at that offset. **The offset
equals the swing pair's `rightBars` and changes with it**: a 10/5 pair reads `fractalLoAgo_l10r5 between 5 5`
beside `pin_o5`. The age never reads below `rightBars`, so `between 21 21` is "decided on this bar": the
condition reads TRUE once per pivot, on its deciding bar — where LuxAlgo draws the label back on the pivot
bar, the condition never paints back. The patterns are the `candlePatterns` rules (the skill body,
`## Bar geometry`), each judged against the ten bars before the pivot bar. LuxAlgo's script tests bullish
and bearish engulfing with one identical condition; `engulf` reads `bullish` for a white body over a black
one and `bearish` for the mirror, so that defect never arises here. An offset column and a column off the
2/2 pair each hold Once.

A hammer at the swing low:

```json
{ "conditionKey": "HAMMER_AT_SWING_LOW", "name": "Hammer at a 21/21 swing low", "verdict": "UP", "required": false, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "fractalLoAgo_l21r21" }, "op": "between", "low": 21, "high": 21, "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "clause", "column": { "sectionKey": null, "header": "pin_o21" }, "op": "is", "label": "lower_wick", "hold": { "atLeast": 1, "of": 1 } } ] } }
```

A shooting star at the swing high, the mirror:

```json
{ "conditionKey": "SHOOTING_STAR_AT_SWING_HIGH", "name": "Shooting star at a 21/21 swing high", "verdict": "DOWN", "required": false, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "fractalHiAgo_l21r21" }, "op": "between", "low": 21, "high": 21, "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "clause", "column": { "sectionKey": null, "header": "pin_o21" }, "op": "is", "label": "upper_wick", "hold": { "atLeast": 1, "of": 1 } } ] } }
```

A bullish engulfing at the swing low:

```json
{ "conditionKey": "BULLISH_ENGULFING_AT_SWING_LOW", "name": "Bullish engulfing at a 21/21 swing low", "verdict": "UP", "required": false, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "fractalLoAgo_l21r21" }, "op": "between", "low": 21, "high": 21, "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "clause", "column": { "sectionKey": null, "header": "engulf_o21" }, "op": "is", "label": "bullish", "hold": { "atLeast": 1, "of": 1 } } ] } }
```

A bearish engulfing at the swing high, the mirror:

```json
{ "conditionKey": "BEARISH_ENGULFING_AT_SWING_HIGH", "name": "Bearish engulfing at a 21/21 swing high", "verdict": "DOWN", "required": false, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "fractalHiAgo_l21r21" }, "op": "between", "low": 21, "high": 21, "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "clause", "column": { "sectionKey": null, "header": "engulf_o21" }, "op": "is", "label": "bearish", "hold": { "atLeast": 1, "of": 1 } } ] } }
```

**Sweep of a liquidity pool** — two forms. On ONE candle, the bar's high traded through the nearest
buyside pool above price and its close came back under it: `levelInteraction` over `LIQUIDITY_POOL_ABOVE`
reads `reject_from_below` (sellside: `reject_from_above` on `LIQUIDITY_POOL_BELOW`). Over TWO candles, a
close beyond the pool retires it (`poolAboveOk` reads false on that bar) and the next bar closes back:
from that next bar `poolAbove` already reads the next pool up, so the second bar is read through the
retired pool instead — `LIQUIDITY_POOL_ABOVE_RETIRED` (`poolAboveRetired`) is the pool the previous bar's
close retired, on that one bar only, and `LIQUIDITY_POOL_ABOVE_RECLAIMED` (`poolAboveRecl`) is true when
this bar's close is back at or under it. The "same or next candle" sweep is an `ANY` over the two. The
retired pool is a level, so `poolAboveRetired_lvl is "reject_from_above"` reads a retest that held after
the breakout, and `dist_poolAboveRetired` how far the close sits from it.

```json
{ "conditionKey": "BUYSIDE_POOL_SWEPT", "name": "Swept the buyside pool and closed back under it", "verdict": "DOWN", "required": false, "exitSide": null,
  "definition": { "kind": "clause", "column": { "sectionKey": null, "header": "poolAbove_lvl" }, "op": "is", "label": "reject_from_below", "hold": { "atLeast": 1, "of": 1 } } }
```

```json
{ "conditionKey": "SELLSIDE_POOL_SWEPT", "name": "Swept the sellside pool and closed back over it", "verdict": "UP", "required": false, "exitSide": null,
  "definition": { "kind": "clause", "column": { "sectionKey": null, "header": "poolBelow_lvl" }, "op": "is", "label": "reject_from_above", "hold": { "atLeast": 1, "of": 1 } } }
```

The same or next candle, on either side:

```json
{ "conditionKey": "BUYSIDE_POOL_SWEPT_TWO_BAR", "name": "Swept the buyside pool and closed back under it, on the same or the next candle", "verdict": "DOWN", "required": false, "exitSide": null,
  "definition": { "kind": "group", "op": "ANY", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "poolAbove_lvl" }, "op": "is", "label": "reject_from_below", "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "clause", "column": { "sectionKey": null, "header": "poolAboveRecl" }, "op": "is", "label": "true", "hold": { "atLeast": 1, "of": 1 } } ] } }
```

```json
{ "conditionKey": "SELLSIDE_POOL_SWEPT_TWO_BAR", "name": "Swept the sellside pool and closed back over it, on the same or the next candle", "verdict": "UP", "required": false, "exitSide": null,
  "definition": { "kind": "group", "op": "ANY", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "poolBelow_lvl" }, "op": "is", "label": "reject_from_above", "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "clause", "column": { "sectionKey": null, "header": "poolBelowRecl" }, "op": "is", "label": "true", "hold": { "atLeast": 1, "of": 1 } } ] } }
```

## Board-relative rank recipes

`rank` turns any column into an ordinal across the scanned board. Ordering semantics: `hi` most
positive, `lo` most negative, `far`/`near` by magnitude (offered only where sign matters), and
`lte N` reads as "top N".

| Intent | Column | Header |
|---|---|---|
| Most volatile on the board | `{ "metric": "ATR_PCT", "transformId": "rank", "timeframe": { "rel": "anchor" }, "ordering": "hi" }` | `atrPct_rank_hi` (1 = most volatile) |
| Biggest movers, sign-agnostic | `{ "metric": "CLOSE_CHANGE", "transformId": "rank", "timeframe": { "rel": "anchor" }, "ordering": "far" }` | `closeChg_rank_far` |
| Most extended from VWAP | `{ "metric": "VWAP", "transformId": "distance", "chainedTransformId": "rank", "timeframe": { "rel": "anchor" }, "ordering": "far" }` | `dist_VWAP_rank_far` |

Confirm every rank ordering against `get_metric_construction_hints({ metric }).rankOrderings` — it is
present only where rank is composable on that metric, and is already range-gated server-side. Read
the offered set; never derive one from the metric's native output.

## Cross-venue and perp/spot basis

| Intent | Column | Header |
|---|---|---|
| Perp premium to oracle | `{ "metric": "MARK", "transformId": "spread", "timeframe": { "rel": "anchor" }, "inputs": [{ "metric": "ORACLE" }] }` | `mark_oracle_spread` |
| Basis to Binance spot | `{ "metric": "MARK", "transformId": "spread", "timeframe": { "rel": "anchor" }, "inputs": [{ "metric": "SPOT_CLOSE_BN" }] }` | `mark_bnClose_spread` |
| Basis to Coinbase spot | same with `{ "metric": "SPOT_CLOSE_CB" }` | `mark_cbClose_spread` |

A positive basis that is widening while price stalls is perp-led; the flow playbooks use it as the
fragility read.

## Crowd positioning

The crowd's raw read is `CROWD_UPBIAS`, header `upBias`: the share of this coin's picks that are UP
across recent settled sessions, as a percentage. A share carries no sample size and no baseline, so
on its own it reads one pick at 100% as strongly as twenty, and on a board where everyone leans the
same way it calls every coin crowded.

The crowding read is its two significance scores, each a binomial z in standard errors:

```json
{ "metric": "CROWD_UP_LEAN_Z", "transformId": "value", "timeframe": { "rel": "anchor" } }
{ "metric": "CROWD_UP_EXCESS_Z", "transformId": "value", "timeframe": { "rel": "anchor" } }
```

Headers `upLeanZ` (how one-sided the crowd is on the coin, against 50%) and `upExcessZ` (how far
beyond the rest of the field). A coin is crowded long when both clear the significance threshold their
glosses state, and crowded short on the mirror. Read them as a fade input, not a trend input: they say
what the board expects, which is the thing a crowded-positioning playbook trades against. When the
whole field leans one way, `upExcessZ` is null and no coin stands out.

## Market and stablecoin subjects

A section reads one subject (the skill body, `## Report sections`): the market readings live only on a
section bound to the market at one breadth scope, and the peg only on a section bound to a declared
stablecoin pair. So each recipe here is a whole custom section with the conditions that read it. Every
header is unique to its section, so a clause names it bare (`"sectionKey": null`) on a CREATE. Both
subjects are series from the moment the platform began recording them, so a window reaching before the
first recorded bar reads absent.

**Market regime — trade with the field.** A section bound to the `crypto` scope, reading the share of
crypto coins closing above their own EMA(50), its zone, and net breadth one rung up:

```json
{ "kind": "custom", "title": "Crypto breadth", "benchmarkTicker": null, "marketScope": "crypto", "notes": null,
  "columns": [
    { "metric": "MKT_ABOVE_EMA", "transformId": "value", "timeframe": { "rel": "anchor" } },
    { "metric": "MKT_ABOVE_EMA", "transformId": "classifyZone", "timeframe": { "rel": "anchor" } },
    { "metric": "MKT_NET", "transformId": "value", "timeframe": { "rel": "regime" } } ] }
```

Headers `mktAboveEma` (%), `mktAboveEma_zone` (`risk-off` at 20 or below, `neutral` between, `risk-on`
at 80 or above) and `mktBreadth_htf` (the up share less the down share on the regime timeframe,
signed). The share above EMA holds its reading for runs of bars while net breadth turns almost every
bar, which is why the zone reads the share and the net is read a rung up. Two building blocks, for a
long carrier to reference beside the coin's own trigger; the short side mirrors them (`risk-off`,
`lt 0`):

```json
{ "conditionKey": "FIELD_RISK_ON", "name": "Crypto field risk-on for 3 closes", "verdict": null, "required": false, "exitSide": null,
  "definition": { "kind": "clause", "column": { "sectionKey": null, "header": "mktAboveEma_zone" }, "op": "is", "label": "risk-on", "hold": { "atLeast": 3, "of": 3 } } }
```

```json
{ "conditionKey": "FIELD_BROADENING", "name": "More of the field up than down, a rung up", "verdict": null, "required": false, "exitSide": null,
  "definition": { "kind": "clause", "column": { "sectionKey": null, "header": "mktBreadth_htf" }, "op": "gt", "value": 0, "hold": { "atLeast": 1, "of": 1 } } }
```

**Stablecoin peg — stand down while USDT is off its dollar.** A section bound to `USDT_USD`, reading its
deviation from par, the peg zone, the deviation's path, and its rotation against USDC:

```json
{ "kind": "custom", "title": "USDT peg", "benchmarkTicker": "USDT_USD", "marketScope": null, "notes": null,
  "columns": [
    { "metric": "PAR_DEV", "transformId": "value", "timeframe": { "rel": "anchor" } },
    { "metric": "PAR_DEV", "transformId": "classifyZone", "timeframe": { "rel": "anchor" } },
    { "metric": "PAR_DEV", "transformId": "trajectory", "timeframe": { "rel": "anchor" }, "window": 4 },
    { "metric": "PAR_DEV", "transformId": "relativeTo", "timeframe": { "rel": "anchor" }, "instrument": "USDC_USDT" } ] }
```

Headers `parDev` (the close's signed % from its par of 1), `parDev_zone` (`at par` inside ±0.20%,
`drifting` from there to under ±1.00%, `depegged` at ±1.00% or beyond), `parDev_t3…parDev_now` with
`parDev_trend`, and `parDev_USDC_USDT_rel` — USDT/USD's deviation less USDC/USDT's, in points, which
reads strongly negative when money leaves USDT for USDC. The relation must name the other pair: a
pair-bound section has no `BTC` default. A required gate that stands every entry down while USDT is
off its peg, since a depeg moves every USDT-quoted price at once, and a rotation building block:

```json
{ "conditionKey": "USDT_AT_PAR", "name": "USDT holding its dollar", "verdict": null, "required": true, "exitSide": null,
  "definition": { "kind": "clause", "column": { "sectionKey": null, "header": "parDev_zone" }, "op": "is", "label": "at par", "hold": { "atLeast": 1, "of": 1 } } }
```

```json
{ "conditionKey": "ROTATING_TO_USDC", "name": "Money rotating from USDT into USDC", "verdict": null, "required": false, "exitSide": null,
  "definition": { "kind": "group", "op": "ALL", "hold": { "atLeast": 1, "of": 1 }, "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "parDev_USDC_USDT_rel" }, "op": "lte", "value": -0.3, "hold": { "atLeast": 1, "of": 1 } },
    { "kind": "clause", "column": { "sectionKey": null, "header": "parDev_trend" }, "op": "is", "label": "falling", "hold": { "atLeast": 1, "of": 1 } } ] } }
```

## Coin selection

`coinSelection` is required on every `preview_strategy_report` call — it is the cohort the preview
renders over, never strategy state — and is discriminated on `mode`:

```json
{ "mode": "ranked", "limit": 25, "category": "DEFI" }
{ "mode": "explicit", "tickers": ["BTC", "ETH", "SOL"] }
```

`ranked` is top-N by 24h volume with an optional sector filter; `explicit` names a ticker set
validated against the active universe. The sector vocabulary is
`ALL` / `CRYPTO` / `L1` / `MEMES` / `DEFI` / `TRADFI` / `STOCKS` / `INDICES` / `COMMODITIES` —
discover the live set rather than assuming this list has not moved. An explicit set is capped; the
refusal names the cap.

## Discovery fields worth reading

Two answers are frequently fetched and then left unread, and each has cost a refusal that a
single already-served field would have prevented:

- `get_strategy_column_contract({ column }).outputs[].conditionOperators` — an empty array means that
  rendered header has no comparison semantics and **cannot appear in a condition clause at all**.
  Legality is per rendered header, not per column: a trajectory's slot header and its `_trend` header
  answer differently.
- `get_metric_construction_hints({ metric }).rankOrderings` and `.qualifiedForms` — the composable
  rank orderings, and the section-qualified forms available when a header is duplicated report-wide.
- `get_trading_config_catalog()` carries the platform defaults an omitted dial inherits, including
  `defaultMaxEntryDeviationAtrMultiple` — the band an entry is still admitted within. Read it before
  authoring an entry band, rather than restating a number the platform already owns.
