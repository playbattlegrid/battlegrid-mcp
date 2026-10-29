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
- Board-relative rank recipes
- Cross-venue and perp/spot basis
- Crowd positioning
- Coin selection
- Discovery fields worth reading

## Column recipes

| Intent | Column | Header it generates |
|---|---|---|
| Live traded price | `{ "metric": "LAST", "transformId": "value", "timeframe": { "rel": "anchor" } }` | `last` |
| Momentum build-up | `{ "metric": "RSI14", "transformId": "trajectory", "timeframe": { "rel": "anchor" }, "window": 4 }` | `RSI14_t3…_now`, `RSI14_trend` |
| Closed-bar-only trajectory | add `"bars": "closed"` to any trajectory | same, drawn from closed bars |
| Extension from trend | `{ "metric": "SMA50", "transformId": "distance", "timeframe": { "rel": "anchor" } }` | `dist_SMA50` (signed %) |
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

`CROWD_UPBIAS` is the platform's own crowd read — the share of recent settled sessions predicting UP,
as a percentage:

```json
{ "metric": "CROWD_UPBIAS", "transformId": "value", "timeframe": { "rel": "anchor" } }
```

Header `upBias`. It is a fade input, not a trend input: it says what the board expects, which is the
thing a crowded-positioning playbook trades against.

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
