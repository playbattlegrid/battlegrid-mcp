# TradingView ports — familiar processes in studio vocabulary

Per-script port recipes. Each ports the PROCESS (regime filter -> setup state -> trigger -> stop
engine) and names its substitutions where the catalog lacks a primitive.

**Contents**
- Squeeze Momentum [LazyBear] / TTM Squeeze
- Supertrend / UT Bot / Chandelier Exit
- MACD + 200 MA filter
- Golden / Death Cross
- RSI-2 (Connors)
- VWAP reversion
- Donchian / Turtle breakout
- ICT / SMC (FVG + order blocks)
- Pivot highs / lows, HH-HL structure and break of structure
- Any pivot length (`leftBars` / `rightBars`)
- Swing Highs/Lows & Candle Patterns [LuxAlgo]
- Liquidity pools and their sweeps
- Chaikin Money Flow
- Now native, formerly substituted
- Statistics over a series' own history

## TradingView ports — familiar processes, studio vocabulary

Players often ask for strategies by the name of a popular TradingView script. Port the
**process** (regime filter → setup state → trigger → stop engine), and where the catalog lacks
the primitive, name the substitution in the spec-lock question — never present a substitute as
the thing itself. Most TV strategies run on the daily chart: carry that with the
daily-strategy pattern above (pinned-1d thesis with `"bars": "closed"` at offset 0 on an intraday anchor), which
binds decisions to daily closes while the studio keeps managing risk intraday.

Event-column behaviour, state-vs-event, previous-UTC-day-level binding and the squeeze's anchor calibration are
rules about the columns themselves, not about porting — they live in the skill body's
`## Header grammar` and `## Conditions`. Read those first; this document is the per-script recipes.

- **Squeeze Momentum [LazyBear] / TTM Squeeze** → `KC_SQUEEZE is "on"` is the native one-condition
  read: the Bollinger pair sitting inside the Keltner channel, at the script's own multiplier.
  The four boundaries stay addressable, so `BB_UPPER spread KC_UPPER` and
  `BB_LOWER spread KC_LOWER` still express the same reading at a threshold you choose. Release
  direction from the MACD trajectory, `bollinger_squeeze` Critical-required.
  Its selectivity is anchor-dependent — see `## Conditions` in the skill body before gating on it.
  (`bbWidthPct_rank_lo` + `ADX14 lt 20` remains a serviceable board-relative compression proxy, but it
  is no longer the only option.)
- **Supertrend / UT Bot / Chandelier Exit** → `ST_LINE` and `ST_DIR` are native, so the regime
  half is a direct port: `ST_DIR is "bullish"` as the persistent state, `dist_ST_LINE` for
  distance to the plotted stop. The plotted trailing line is still best executed by the studio's
  own stop engine — `trailingTriggerR: 0` (trail from entry), giveback ~30–40 (tight factor) or
  45–55 (loose/chandelier) — because a trailing stop is a position-management mechanism, not a
  column. `ST_DIR` is a persisting state, so its FLIP is read with `enters`, natively:
  `ST_DIR enters "bullish"` is TRUE on the one completed bar the direction turned, and
  `ST_DIR exits "bullish"` on the bar it turned back — see `## Conditions` in the skill body.
- **MACD + 200 MA filter** → `ABOVE_200` building block (`dist_SMA200 gt 0`) referenced by a
  carrier with `MACDhist_cross is "Bullish"`; swing-trend geometry.
- **Golden / Death Cross** → `SMA50 spread SMA200 × trajectory` gives state and freshness:
  `SMA50_SMA200_spread_now gt 0` AND `_trend is "rising"`; optional breadth gate on
  `mktBreadth gte 0` in a section bound to the market at `crypto` (`"marketScope": "crypto"`, any
  scope the trade needs — two scopes are two sections; see `recipes.md`, *Market and stablecoin
  subjects*); position-persona geometry. `SMA50 × SMA200` is
  the canonical definition and stays the default port; `EMA50` is available as the crypto variant
  when a player asks for it by name.
- **RSI-2 (Connors)** → `RSI2` is native, so this ports exactly: `RSI2 lte 10` gated by required
  `ABOVE_200`; the source's fast exit is time — timeDecay ON (180/60, 15→50, stale 20). Keep the literal `lte 10` as the GATE:
  `RSI2 × classifyZone` exists and reads on the same Connors bands, but a zone label is a fixed
  reading while the literal is a threshold the author can see and tune. Use the zone as a report
  column, never as the substitute for the gate.
- **VWAP reversion** → `dist_VWAP` band + `dist_VWAP_rank_far lte 5` for board-relative
  stretch; required `NOT [ADX14_state in ["trending","extreme"]]` veto; scalp geometry +
  aggressive timeDecay (`VWAP` anchors daily at 00:00 UTC; `VWAP_WEEK`, `VWAP_MONTH`, `VWAP_TRADING_SESSION` and
  the rolling `VWAP_ROLLING_1H`/`4H`/`24H` are the other anchors, each with ±1/2/3σ bands `_UB<k>`/`_LB<k>` — the
  close's position against a band is `CLOSE × spread(VWAP_LB2)` rather than a hand-computed σ, and the bar's contact
  with it is `VWAP_LB2 × levelInteraction`).
- **Donchian / Turtle breakout** (`close > ta.highest(high, 20)[1]`) → `dist_donchianHiPrior20 crossesAbove 0`
  over `DONCHIAN_UPPER_PRIOR × distance` (the breakout bar; `dist_donchianHiPrior20 gt 0` holds on every
  close of the run) + `RVOL20 gte 1.5`; turtle exits = trend preset (trail from 1R, giveback 50). Mirror with
  `dist_donchianLoPrior20 crossesBelow 0`. The same-bar rail is refused under `distance`: it includes the
  breakout bar's own high, so it can never confirm a close-based break. Its gap, `close_donchianHi20_spread`, is
  never above 0 — do not AND it in. `zone is "breakout high"` reads
  the prior-bar rail: it is the label form of the `dist_donchianHiPrior20 gt 0` state, holds on every close of
  the run, and adds nothing to the crossing; `"breakdown low"` mirrors it.
  **Daily-breakout variant on any anchor:** pin the rail at 1d — `dist_donchianHiPrior20_1d crossesAbove 0`
  (`gt 0` for the held state).
  **Any N-bar breakout (Turtle 55, a 10-bar exit channel):** the prior-bars level is a rolling extreme read
  at offset 1 — `HIGH × rollingMax(55, offset 1)` is `ta.highest(high, 55)[1]`, and chained into `distance`
  it is the breakout column: `dist_high_o1_max55 crossesAbove 0` (the breakout bar; `gt 0` holds on every
  close of the run). Mirror with `LOW × rollingMin(N, offset 1) × distance` → `dist_low_o1_minN crossesBelow 0`.
  At N = 20 it reads exactly the stored `DONCHIAN_UPPER_PRIOR` / `DONCHIAN_LOWER_PRIOR` rails. The offset
  must be at least 1 under `distance` (the save refuses offset 0, whose extreme includes the bar measured),
  and window plus offset must fit the column lookback cap.
  **Literal previous-day levels are native**: `dist_PDH gte 0` composes directly. They are TIMELESS
  and take `{rel: 'anchor'}` — see `## Header grammar` in the skill body. The previous UTC day is the
  00:00–24:00 UTC day, and a level read against a bar of the next day is `null`.
- **Session highs / lows, opening range, IB extensions** → the trading-session levels are native:
  `ASIA_HIGH`, `LONDON_LOW`, `NEW_YORK_OPEN` and their previous instances (`PRIOR_LONDON_HIGH`, …), each
  session fixed in UTC (asia 00–08, london 08–13, newYork 13–21) with no daylight-saving rule, the UTC
  day's opening ranges (`OR15_HIGH`/`OR15_LOW`, `OR30_HIGH`/`OR30_LOW`) and the IB extensions
  (`IB_EXT_UP_150` … `IB_EXT_DOWN_200`). A session window (`TRADING_SESSION in ["london","newYork"]`,
  `DAY_OF_WEEK between 1 and 5`) is an ordinary condition; the glosses state the windows.
- **ICT / SMC (FVG + order blocks)** → `STRUCT_ZONES` is the native zone engine:
  `zones_htf_support_type` (`bullish FVG`/`bullish order block`), `zones_htf_support_dist
  between 0 1.5`, `_age_bars gte 3`, HTF bias required via `MAalign_htf`. A killzone is a session window
  (`TRADING_SESSION`, `UTC_HOUR`) and a sweep of a previous session's extreme is `PRIOR_<S>_HIGH_SWEPT` /
  `_LOW_SWEPT`. Event *sequencing* is an entry condition's root **In order** (`op: "SEQUENCE"`,
  `within` bars — see `## Conditions` in the skill body): sweep → displacement → return to the zone is
  `In order within 12 [ PRIOR_ASIA_LOW_SWEPT step, the displacement step, the zone-touch step ]`, each
  step one bar's reading. What it cannot state is still a grammar limit, not a missing metric: an exit
  that waits on an ordering, an ordering inside another, or a step that counts its own closes — name
  it as one.
- **Pivot highs / lows, HH-HL structure and break of structure** (`ta.pivothigh(left, right)` /
  `ta.pivotlow(left, right)`) → `SWING_FRACTAL_HIGH` / `SWING_FRACTAL_LOW` are the native swing levels and
  `SWING_FRACTAL_LABEL` the structure label (`HH`/`HL`/`LH`/`LL`/`none`) — see `## Swing structure` in
  the skill body, which states the default pair, `ta.pivothigh(2, 2)`. Pine's tie rule holds (an equal
  extreme on the left is allowed, on the right it is not), and each level is the stepped, non-repainting
  series — held from the bar that completes the pivot's right side, not plotted back on the pivot bar.
  Break of structure is `dist_fractalHi crossesAbove 0` / `dist_fractalLo crossesBelow 0`; "structure is
  bullish" is `fractalLabel in ["HH","HL"]`. The pivot each latest one is compared with is native too:
  `PRIOR_SWING_FRACTAL_HIGH` / `PRIOR_SWING_FRACTAL_LOW` (`pFractalHi` / `pFractalLo`, Pine's
  `ta.valuewhen(not na(ph), ph, 1)`) are price levels held while the prior pivot is in reach, so
  `dist_pFractalHi crossesAbove 0` is a close through the swing high before the last one. A pivot's age is
  `SWING_FRACTAL_HIGH_BARS_AGO` / `SWING_FRACTAL_LOW_BARS_AGO` (`fractalHiAgo` / `fractalLoAgo`), counted
  from the pivot's own bar: `rightBars` on the bar that completes it, so it reads Pine's
  `ta.barssince(not na(ph)) + rightBars` (`+ 2` at the default), and `fractalLoAgo lte 5` keeps a setup to
  a fresh swing low — the deciding bar and the three after it, which at 5/5 is `fractalLoAgo_l5r5 lte 8`.
- **Any pivot length ports exactly — `ta.pivothigh(5, 5)` is the swing column at 5/5, not a
  substitution.** The seven swing metrics (the two levels, the two prior pivots, the two ages and the
  label) declare `leftBars` / `rightBars`: default 2/2, minimum 1, `bound: 'depth'`. Stage Pine's two
  lengths on the swing column beside its transform knobs, and leave the pair off for 2/2 — an explicit
  2/2 is the same column. This column is the distance to `ta.pivothigh(5, 5)`'s held level, with the same
  tie rule and held step:
  `{ "metric": "SWING_FRACTAL_HIGH", "transformId": "distance", "timeframe": { "rel": "anchor" }, "leftBars": 5, "rightBars": 5 }`.
  Off 2/2 the header carries `_l<left>r<right>` after the code: `dist_fractalHi_l5r5`, `fractalLabel_l5r5`,
  `fractalLoAgo_l5r5` (`fractalHi_l5r5_1h` pinned to 1h).
  The pair reads `left + right + 1` bars to decide one pivot and must fit the readable depth; a wider pair
  is refused with `REPORT_COLUMN_DEPTH_EXCEEDED` on `leftBars`, and each side's served `maximum` is the
  bound (`strategy-authoring`'s knob rules). Off 2/2 the server computes the pivots over the column's own
  bars, so two refusals follow:
  - `rank`, `relativeTo` and the depth-bounded windows (the averages and the statistics) read the stored
    2/2 and refuse an off-default pair — stage a pair only on a transform whose entry serves
    `metricParametersAccepted: true`;
  - a condition over the column admits one bar: a hold over more than one close is refused
    (`CONDITION_HOLD_ILLEGAL`), so is an **In order** step over it (`CONDITION_SEQUENCE_WINDOW_INVALID`),
    and every prior-bar operator (`crossesAbove`, `crossesBelow`, `increased`, `decreased`, `enters`,
    `exits`) is refused with `CONDITION_OPERATOR_UNSUPPORTED`, leaving `lt`, `lte`, `gte`, `gt`, `between`,
    `is` and `in`.

  So at 5/5 the levels, the label, the prior pivots and the ages port as states
  (`fractalLabel_l5r5 in ["HH","HL"]`, `fractalLoAgo_l5r5 lte 8`), and the one-bar break the default pair
  reads as `dist_fractalHi crossesAbove 0` reads at 5/5 as the state `dist_fractalHi_l5r5 gt 0`: the close
  stands above the last 5/5 swing high, from the break until the close falls back or the level steps to
  the next swing. That edge-for-state reading is what the spec-lock question names; the pivot length
  itself is the script's own and is never named as a substitution.
- **Swing Highs/Lows & Candle Patterns [LuxAlgo]** (length 21, the pattern read at Pine's `[21]`, the
  pivot bar) → the swing age at the 21/21 pair pinned to 21 beside the candle pattern at offset 21:
  `fractalLoAgo_l21r21 between 21 21` AND `pin_o21 is "lower_wick"` is the hammer at a swing low, and
  `engulf_o21` the engulfing. The offset equals the pair's `rightBars` and changes with it. The condition
  reads TRUE on the bar that decides the pivot, where the script draws its label back on the pivot bar;
  the patterns are the `candlePatterns` rules, so the script's identical bullish and bearish engulfing
  test never arises. Whole conditions: `recipes.md`, *Candle at a swing and liquidity-pool sweeps*.
- **Liquidity pools and their sweeps** (LuxAlgo Liquidity Swings' close retirement over SMC's equal
  pivots) → `LIQUIDITY_POOL_ABOVE` / `LIQUIDITY_POOL_BELOW` (`poolAbove` / `poolBelow`) are native. A
  one-candle sweep is `poolAbove_lvl is "reject_from_below"`, mirrored with `poolBelow_lvl is
  "reject_from_above"`. A sweep over two bars — the outbreak's close retires the pool, the next close
  comes back — is `poolAboveRecl is "true"` (`poolBelowRecl`), and the retired pool itself is
  `poolAboveRetired` / `poolBelowRetired`, a level a retest reads with `levelInteraction`. Whole
  conditions: `recipes.md`, *Candle at a swing and liquidity-pool sweeps*.
- **Chaikin Money Flow** (TradingView's built-in "Chaikin Money Flow" script, length 20; Pine has no
  `ta.cmf`) → `CMF20` is native: each bar's volume weighted by where it closed in its range, summed over
  20 closed bars and divided by their volume, −1 to +1. `CMF20 gt 0` is the accumulation state and
  `CMF20_cross is "Bullish"` the zero-line cross; a flat bar weighs 0, and a window that traded no volume
  reads no value, so a clause over it reads FALSE. It reads closed bars only, never the forming one.
- **Now native, formerly substituted** — WaveTrend (`WT1`/`WT2`), QQE (`QQE_RSI_MA`/`QQE_STOP`),
  Hull (`HMA20`), Ichimoku (`ICHI_CONV`/`ICHI_BASE`/`ICHI_SPAN_A`/`ICHI_SPAN_B`/`ICHI_LAG`),
  Parabolic SAR (`PSAR`), Keltner (`KC_UPPER`/`KC_LOWER`, its basis is `EMA20`), the MACD and PPO lines
  and signals (`MACD_LINE`/`MACD_SIGNAL`, `PPO_LINE`/`PPO_SIGNAL` — the line's zero cross is
  `MACD_LINE × crossDetect`, and the signal-line cross is `MACD_HIST × crossDetect`, the histogram being
  line minus signal), the 15-bar rate of change (`ROC15`), the Donchian break memory
  (`DONCHIAN_BROKEN_HI`/`DONCHIAN_BROKEN_LO`, and as of the bar before — Pine's `brk[1]` —
  `DONCHIAN_BROKEN_HI_PRIOR`/`DONCHIAN_BROKEN_LO_PRIOR`, the level a retest or failed-breakout clause reads), daily pivots of
  all six Pivot Points Standard types (Traditional `PIVOT_P`/`PIVOT_R1`–`R5`/`PIVOT_S1`–`S5`, then
  `PIVOT_FIB_*`, `PIVOT_CLASSIC_*`, `PIVOT_CAM_*`, `PIVOT_WOODIE_*`, `PIVOT_DM_*` — a level one type shares
  with Traditional is read from the Traditional key) and the same six types on the previous ISO week,
  UTC month, UTC quarter and UTC year (`PIVOT_WEEK_*`, `PIVOT_MONTH_*`, `PIVOT_QUARTER_*` and `PIVOT_YEAR_*`:
  the daily key with `WEEK_`, `MONTH_`, `QUARTER_` or `YEAR_` after `PIVOT_`, so `timeframe.change("W")`'s R1
  is `PIVOT_WEEK_R1` and `timeframe.change("3M")`'s is `PIVOT_QUARTER_R1`), Williams %R (`WILLR14`), Stoch RSI
  (`STOCH_RSI_K`/`STOCH_RSI_D` — TradingView's "Stoch RSI" %K and %D at 3, 3, 14, 14, on 0–100), the TTM squeeze (`KC_SQUEEZE`), Connors RSI-2 (`RSI2`), the 8/9/21/50 EMAs
  (`EMA8`/`EMA9`/`EMA21`/`EMA50` — `ta.ema(close, 8)` is `EMA8`, its distance `dist_EMA8`), literal
  previous-UTC-day levels (`PDH`/`PDL`/`PDO`), fractal swing structure
  (`SWING_FRACTAL_HIGH`/`SWING_FRACTAL_LOW`/`SWING_FRACTAL_LABEL`, the prior pivots
  `PRIOR_SWING_FRACTAL_HIGH`/`PRIOR_SWING_FRACTAL_LOW` and their ages
  `SWING_FRACTAL_HIGH_BARS_AGO`/`SWING_FRACTAL_LOW_BARS_AGO`), and Chaikin Money Flow (`CMF20`). Port
  these directly — do not offer a substitute for a primitive the catalog serves.
- **Statistics over a series' own history** — the windowed transforms port the common Pine idioms
  one for one, over any metric with a series and over a `distance` or `spread`:
  - the `er` function of the common Pine libraries, `math.abs(x - x[n]) / math.sum(math.abs(x - x[1]), n)`,
    is `x × efficiency` at window `n` — the window counts CHANGES, so `er(close, 10)` is window 10 and
    reads 11 bars;
  - the z-score idiom `(x - ta.sma(x, n)) / ta.stdev(x, n)` is `x × zscore` at window `n`
    (`RSI14_z20`), population σ as `ta.stdev` defaults to, banded at ±1 and ±2;
  - `ta.stdev(x, n)` is `x × stddev` (`close_sd20`, in the input's own units);
  - `ta.ema(x, n)`, `ta.rma(x, n)` and `ta.wma(x, n)` are `x × ema`, `x × rma` and `x × wma` at window `n`
    (`close_ema200`, `close_rma14`, `close_wma34`), and `ta.sma(x, n)` is `x × aggregate` — a stored EMA or SMA
    code is the exact source at its own length;
  - `ta.rsi(x, n)` and `ta.cci(x, n)` are `x × rsi` and `x × cci` at window `n` (`hlc3_rsi21`, `close_cci50`),
    each null over a window whose values are all equal; the stored `RSI14`, `RSI7`, `RSI2` and `CCI20` (on HLC3)
    are the exact source at their own length, and `EMA50 × rsi` is the RSI of the stored 50-bar average;
  - one of those over another is a chain, the inner's length on `window` and the outer's on `chainedWindow`:
    `ta.rsi(ta.ema(x, n), m)` is `x × ema(n) × rsi(m)` (`close_ema200_rsi14`), `ta.cci(ta.sma(x, n), m)` is
    `x × aggregate(n) × cci(m)`, and the built-in RSI's smoothing line `ta.sma(ta.rsi(x, n), m)` is
    `x × rsi(n) × aggregate(m)`. The outer may be any average or statistic; the chained outer's catalog entry names
    the key it bounds (`windowParameter`) and serves `innerWindowMaximum` for the inner. Under an average or an RSI
    the chain is the windowed composite, within a few RSI points of a full-history chart on a slow average;
  - `ta.percentrank(x, n)` is `x × pctl` at window `n` — the `n` bars BEFORE the newest, ties at or below;
  - `ta.highest(x, n)` / `ta.lowest(x, n)` are `x × rollingMax` / `x × rollingMin` (`high_max20`
    is `DONCHIAN_UPPER`'s same-bar rail);
  - a linear-regression slope over `n` bars (TA-Lib's `LINEARREG_SLOPE`) is `x × linregSlope`, the
    least-squares slope per bar — not Pine's `ta.linreg(x, n, 0) - ta.linreg(x, n, 1)`, which differs
    two fits.

  Each reads null where its newest or oldest bar holds no value, or where fewer bars exist than the
  window reads.
