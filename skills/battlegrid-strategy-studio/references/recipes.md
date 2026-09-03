# Strategy Studio recipes — copy-adaptable fragments

Validated against the live server 2026-08-28; shapes binding, tokens illustrative — re-discover
before compiling. Column recipes are objects for a custom section's `columns[]`; condition
recipes drop into `conditions[]`.

## Column recipes

| Intent | Column | Header it generates |
|---|---|---|
| Live traded price | `{ "metric": "LAST", "transformId": "value", "timeframe": { "rel": "anchor" } }` | `last` |
| Momentum build-up | `{ "metric": "RSI14", "transformId": "trajectory", "timeframe": { "rel": "anchor" }, "window": 4 }` | `RSI14_t3…_now`, `RSI14_trend` |
| Closed-bar-only trajectory (no forming-bar noise) | add `"bars": "closed"` to any trajectory | same, drawn from closed bars |
| Extension from trend | `{ "metric": "SMA50", "transformId": "distance", "timeframe": { "rel": "anchor" } }` | `dist_SMA50` (signed %) |
| Perp premium | `{ "metric": "MARK", "transformId": "spread", "timeframe": { "rel": "anchor" }, "inputs": [{ "metric": "ORACLE" }] }` | `mark_oracle_spread` |
| Cross-venue basis | `MARK spread SPOT_CLOSE_BN` (or `SPOT_CLOSE_CB`) | `mark_bnClose_spread` |
| Funding paid over a day | `{ "metric": "FUNDING_RATE", "transformId": "aggregate", "timeframe": { "rel": "anchor" }, "window": 24 }` | `rate_mean24` |
| Board-wide standing | `{ "metric": "ATR_PCT", "transformId": "rank", "timeframe": { "rel": "anchor" }, "ordering": "hi" }` | `atrPct_rank_hi` (1 = most volatile) |
| Biggest movers, sign-agnostic | `CLOSE_CHANGE rank far` | `closeChg_rank_far` |
| Most extended from VWAP on the board | `{ "metric": "VWAP", "transformId": "distance", "chainedTransformId": "rank", "timeframe": { "rel": "anchor" }, "ordering": "far" }` | `dist_VWAP_rank_far` (confirm via contract) |
| EMA ribbon compression trend | `{ "metric": "EMA5", "transformId": "spread", "chainedTransformId": "trajectory", "timeframe": { "rel": "anchor" }, "inputs": [{ "metric": "EMA13" }], "window": 4 }` | `EMA5_EMA13_spread_now`, `_trend` |
| Chop filter on the entry rung | `{ "metric": "CLOSE", "transformId": "efficiency", "timeframe": { "rel": "lower" }, "window": 5, "bars": "closed" }` | `close_ltf_er` (≥0.6 = directional) |
| One-bar volume concentration | `{ "metric": "VOLUME", "transformId": "maxShare", "timeframe": { "rel": "lower" }, "window": 4, "bars": "closed" }` | `volBase_ltf_maxShare` |
| Room to structure | `{ "metric": "STRUCT_ZONES", "transformId": "nearestZoneDist", "timeframe": { "rel": "regime" }, "side": "resistance" }` | `zones_htf_resist_dist` |
| Crowd fade input | `{ "metric": "CROWD_UPBIAS", "transformId": "value", "timeframe": { "rel": "anchor" } }` | `upBias` (%, last 4 settled sessions) |
| Daily trend state on any anchor | `{ "metric": "MA_ALIGN", "transformId": "value", "timeframe": { "abs": "1d" } }` | `MAalign_1d` |
| Last **closed** daily read (deterministic) | `{ "metric": "RSI14", "transformId": "value", "timeframe": { "abs": "1d" }, "offset": 1 }` | `RSI14_1d` — formula `RSI14[t - 1]` |
| Daily extension from the 200 | `{ "metric": "SMA200", "transformId": "distance", "timeframe": { "abs": "1d" } }` | `dist_SMA200_1d` |
| Daily-structure breakout state | `{ "metric": "PRICE_ZONE", "transformId": "value", "timeframe": { "abs": "1d" } }` | `zone_1d` — `is "breakout high"` / `"breakdown low"` |
| Room to the daily swing high | `{ "metric": "SWING_HIGH", "transformId": "distance", "timeframe": { "abs": "1d" } }` | `dist_swingHi_1d` (signed %; `gte 0` = above it) |

Rung suffixes: `{ "rel": "lower" }` → `_ltf`, `{ "rel": "regime" }` → `_htf` (the anchor's
ladder successor — 1d for a 4h anchor), pinned `{ "abs": "<tf>" }` → `_<tf>` (e.g. `_1d`).
Pins bind to discovery's `rankedTimeframes` (a superset of the anchor set), are fixed across
anchor retunes, and `offset` does not change the header — one offset per `metric × timeframe`
per section. `offset` is a `value`-transform parameter only: `distance` rejects it (typed
error), so a level is always measured as it stands now. That is a statement about `offset`, not
about prior-day levels: `PDH`/`PDL` are published structure metrics at the daily anchor and take
`distance` and `crossDetect`, so the literal previous-session extreme is authored as
`dist_PDH_1d` rather than reconstructed from an offset. The daily *swing* levels (`zone_1d`,
`dist_swingHi_1d`) are the tracked pivot — a different level, not a substitute. Conditions
compare a column against a literal, never against another column. Rank ordering semantics:
`hi` most positive, `lo` most negative, `far`/`near` by magnitude (offered only where sign
matters).

## Condition patterns

**Band (between).** RSI pullback zone rather than a single threshold:
`{ "kind": "clause", "column": { "sectionKey": null, "header": "RSI14_now" }, "op": "between", "low": 35, "high": 55 }`
(`sectionKey: null` is legal only while the header is unique report-wide.)

**Label membership (in).** Accept two of a classification's states:
`{ "kind": "clause", "column": { "sectionKey": "includeMtfConfluence", "header": "ADX_htf_state" }, "op": "in", "labels": ["trending", "extreme"] }`

**Veto (NOT + required).** Block the whole compose-trade path on a disqualifier — evaluated
before any billing or LLM call:

```json
{ "conditionKey": "NO_EVENT_RISK", "name": "No liquidation tape", "verdict": null, "required": true,
  "exit": false, "clock": "LIVE", "closes": 1,
  "definition": { "kind": "group", "op": "NOT", "members": [
    { "kind": "clause", "column": { "sectionKey": null, "header": "oiRegime" }, "op": "is", "label": "long liquidation" } ] } }
```

All eight keys are required on every condition — `exit`, `clock` and `closes` included. `clock`
selects the evidence frame (`LIVE` reads the forming bar, `CLOSE` reads settled bars) and `closes`
(1–5) is how many consecutive closed bars must hold; `closes` is always `1` under `LIVE`. `exit:
true` closes open positions the verdict opposes and is legal only under `clock: "CLOSE"`.

**Quorum (N_OF).** Robust confirmation instead of a brittle ALL:

```json
{ "kind": "group", "op": "N_OF", "n": 2, "members": [
  { "kind": "clause", "column": { "sectionKey": null, "header": "buyPres" }, "op": "gte", "value": 0.55 },
  { "kind": "clause", "column": { "sectionKey": null, "header": "RVOL" }, "op": "gte", "value": 1.2 },
  { "kind": "clause", "column": { "sectionKey": null, "header": "closeChg" }, "op": "gt", "value": 0 } ] }
```

**Building block + carriers.** Factor shared state once (`verdict: null`), reference it from
directional carriers; the first TRUE carrier **in declaration order** decides — order carriers
most-specific first.

**Benchmark gate.** Read regime off a `benchmarkTicker` section (all rows are the benchmark's
values) and `conditionRef` it from every carrier — one place to flip the book risk-on/off. Keep that
section to indicators: crowd/session metrics and `rank` transforms are refused on a bound section
(contract 49) — rank the coins on an ordinary section and `conditionRef` the two together.

**Required-count trap.** `required: true` at `allocation: 0` on a *signal rule* is rejected
(contract 34). A required *condition* is independent of signal weights — the two gates stack.

## Entry discipline recipes

The `entry` object is required on every CREATE, all seven keys, no defaults.

| Intent | Object |
|---|---|
| Today's behaviour, unchanged | `{ "trigger": "AT_SIGNAL", "confirmTf": "<strategy tf>", "closes": 1, "bandAtrMultiple": 1.0, "levelSource": "SWING_HIGH", "levelOffsetAtrMultiple": 0, "validForBars": 4 }` |
| Wait for the bar to close, skip a runaway | `{ "trigger": "ON_CANDLE_CLOSE", "confirmTf": "<strategy tf>", "closes": 1, "bandAtrMultiple": 1.0, … }` |
| Two-close confirmation on the lower rung | `{ "trigger": "ON_CANDLE_CLOSE", "confirmTf": "<lower rung>", "closes": 2, "bandAtrMultiple": 0.75, … }` |
| Break of the swing high, half an ATR through | `{ "trigger": "STOP_THROUGH_LEVEL", "levelSource": "SWING_HIGH", "levelOffsetAtrMultiple": 0.5, "validForBars": 8, "closes": 1, … }` |
| Buy the retest of the broken level | `{ "trigger": "ON_RETEST", "levelSource": "SWING_HIGH", "levelOffsetAtrMultiple": 0, "validForBars": 12, "closes": 1, … }` |

Bounds: `closes` 1–5 and `1` unless `ON_CANDLE_CLOSE`; `bandAtrMultiple` > 0 and ≤ the platform's
`defaultMaxEntryDeviationAtrMultiple`; `levelOffsetAtrMultiple` 0–2 unsigned and `0` unless a level
trigger; `validForBars` 1–24. `confirmTf` is the strategy timeframe or the rung below it, nothing
else. A meaningful value under a trigger that ignores it is REFUSED, not ignored — that is
deliberate, so a dial never silently does nothing.

## Custom section shape

`{ kind, sectionKey, title, benchmarkTicker, notes, columns }`. `benchmarkTicker` and
`notes` are **required-nullable** — send explicit `null` rather than omitting them, because the
section is rebuilt whole on save and an omitted key clears the value. **Omit `sectionKey` on a
CREATE**: the server derives it from the section.

A section carries **no `timeframe`** (48.0.0). Its relative columns resolve against the strategy
timeframe; a column reaches any other timeframe by pinning it — `timeframe: { abs: '4h' }` on the
column, which it could always do.

## Weight matrices (rules)

**Conviction pyramid (default).** 1–2 × Critical (the thesis signals, usually `required`),
2–4 × Important (independent confirmation — different modules, not correlated oscillators),
1–3 × Normal (context), everything else Off. With weights 3/2/2/1 and the Critical + one
Important triggered at score 1.0: aggregate = (3+2)/(3+2+2+1) = 0.625 → a gate of 0.6 means
"thesis + one confirmation, minimum".

**Gate math check.** Before setting `minAggregateScore`, list the trigger combinations that
should route, compute Σ(score×alloc)/Σ(alloc) for the weakest acceptable one, and gate just
below it. `simulate_aggregate_score` does this arithmetic for you from compiled values.

**Directional symmetry.** A both-ways book weights bull/bear siblings identically
(`ma_ema_aligned_bull`/`_bear` both 2-required) and lets conditions decide direction.

**Param tuning.** Always read `get_strategy_signal_definition({ signalId, timeframe })` first;
send the full replacement object. Examples validated as canonical defaults: `volume_surge`
`{"multiplier": 2}`, `rsi_overbought` `{"threshold": 70}`, `funding_extreme_positive`
`{"thresholdPct": 0.0005}`, `trend_adx_trending` `{"threshold": 25}`,
`comparison_btc_decorrelation` `{"maxCorrelation": 0.3}`.

## Trade-level + position-management presets by persona

| Persona (anchor) | Stop band (ATR) | RR | Break-even | Trailing | Time decay |
|---|---|---|---|---|---|
| Scalper (5m/15m) | 0.5 – 1.2 | 1.5 | 0.7R | 0.9R, giveback 30, buffer 0.15 | ON: 45/15 min, tighten 15 → max 60, stale 30 |
| Intraday mean-revert (1h) | 1.0 – 2.5 | 1.5 | 0.8R | off | ON: 120/60 min, tighten 10 → max 40, stale 25 |
| Swing breakout (4h) | 0.75 – 1.75 | 2 | 1R | 1.2R, giveback 35, buffer 0.3 | off |
| Swing trend (4h) | 1.0 – 2.5 | 2 | 1R | 1.5R, giveback 45–55, buffer 0.3 | off |

Post-entry invalidation: `decisionInvalidationExitEnabled: true` closes a filled position when a
**closed** strategy-timeframe candle finishes beyond the decision's invalidation level, reduce-only.
Bar-close only — the protective stop still owns intrabar moves.

Bounds to respect (validated): break-even trigger 0.5–2R; trailing trigger 0–2R step 0.01
(0 = trail from entry); giveback 25–55%; buffer 0.01–1%; grace ≥ interval; stop-band floor <
ceiling ≤ the 3×ATR structural cap; RR within the catalog's served range (0.5–3 today). Wider
stop ⇒ smaller position (risk-budget sizing), never more risk.

## Coin selection patterns

- Focused edit / review: `{ "mode": "explicit", "tickers": ["BTC", "ETH", "SOL"] }`
- Scanning book: `{ "mode": "ranked", "limit": 40, "category": "CRYPTO" }`
- Sector books: `category` from the served list (`L1`, `MEMES`, `DEFI`, `TRADFI`, `STOCKS`,
  `INDICES`, `COMMODITIES`) — e.g. a memes-only fade book previews against `MEMES`.
- Rank-based conditions need a cohort at least as wide as the rank thresholds they test.

## Market Read patterns

- Reference the decision, not just data: `"Act only while {SQUEEZE_ON} is TRUE"` renders the
  condition's outcome *with its evidence*.
- Qualify on collision: `{custom:<uuid>.MAalign}` / `{includeMtfConfluence.MAalign}`.
- After previewing, check `marketReadMarkers[].status` — fix every `unknown` / `ambiguous`
  marker before compiling; `qualifiedForms` lists the exact replacements.
