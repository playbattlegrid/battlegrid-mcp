# TradingView ports — popular scripts, translated to the studio

The most-used TradingView community scripts encode processes traders already trust. This file
ports the **process** of each — regime filter → setup state → trigger → stop/exit engine — onto
the studio's validated vocabulary. It never claims formula parity: where an indicator does not
exist in the catalog, the substitution is named (the studio's rule: offer the nearest
expressible thing **labelled as a substitute**, never as the thing itself). Headers below were
validated live on 2026-08-28; re-discover before compiling.

**Event columns caveat (read first).** `crossDetect` and event metrics (`MACD_cross`,
`EMA5_13`) print `Bullish`/`Bearish` only on the bar a cross occurs and are null otherwise —
null resolves a clause UNRESOLVED, not FALSE. Use them as *triggers* inside a carrier, and pair
them with a persistent *state* (the spread's sign, `MAalign`) for regime, exactly as the source
scripts separate trigger from filter.

## 0 · Daily-chart strategies — the pattern that carries every TV daily script

Most TradingView strategies run on the daily chart. The studio's anchors top out intraday
(discovery's `timeframes`), but **pinned timeframes** carry the daily thesis onto any anchor:
`{abs: "1d"}` columns are valid wherever discovery's `rankedTimeframes` includes `1d`
(validated), render with a `_1d` header suffix (`MAalign_1d`, `dist_SMA200_1d`, `RSI14_1d`),
and ignore anchor retunes. Two dials make the port faithful:

- **`offset: 1` on a pinned `value` column reads the last CLOSED daily bar** (`RSI14[t - 1]`,
  validated) — the strategy's daily inputs then change exactly once per daily close, so a
  required condition on them decides "on daily closes" even though the anchor cycle re-checks
  intraday. Offset 0 reads the forming daily bar (marked provisional).
- **A 4h anchor's regime rung is the daily** (ladder successor), so `{rel: "regime"}` columns
  (`MAalign_htf`) and the `htf_*` signals already evaluate on 1d for 4h strategies.

Recipe: anchor 4h → pinned-1d thesis section (trend, RSI, distance-to-MA at `offset: 1`) →
`required: true` daily conditions gating every carrier → anchor-rung columns only for entry
timing and risk. The result is arguably stronger than the TV original: decisions bind to daily
closes while stops, trailing, and time decay keep managing the position intraday.

## Expressibility triage

| TradingView script | Verdict | Port anchor |
|---|---|---|
| Squeeze Momentum [LazyBear] / TTM Squeeze | Process port (Keltner not in catalog — substitute named) | `bbWidthPct` + rank, `bollinger_squeeze`, momentum trajectory |
| Supertrend / UT Bot Alerts | Split port: entry substitute + **native stop engine** | `EMA5_13`, `MAalign`, position-management trailing |
| Chandelier Exit | Direct port of the *mechanism* | trailing from entry (`trailingTriggerR: 0`) |
| MACD + 200 MA filter | Direct process port | `MACD_cross`, `dist_SMA200`, `macd_bull_cross` |
| Golden / Death Cross | Direct process port | `SMA50_SMA200_spread` + `_trend` |
| RSI-2 (Connors) | Named substitute (no RSI-2; RSI7 is the closest series) | `RSI7`, `dist_SMA200`, time decay |
| VWAP reversion | Direct process port | `dist_VWAP`, `dist_VWAP_rank_far` |
| Donchian / Turtle breakout | Process port (N-bar channel → swing structure) | `zone`, `dist_swingHi`, `sr_resistance_break` |
| ICT/SMC: FVG + Order Blocks | Direct process port of the zone logic | `STRUCT_ZONES` columns + `structure_*` signals |
| WaveTrend, QQE, Hull Suite, Ichimoku, Parabolic SAR, Keltner | **Not expressible** — say so; nearest neighbors below | — |

---

## 1 · Squeeze Momentum [LazyBear] (TTM Squeeze) — 4h

**Source process.** Squeeze ON while Bollinger Bands sit inside Keltner Channels (volatility
coiled); wait; when the squeeze releases, enter in the direction of the momentum histogram.

**Port.** Keltner Channels are not in the catalog, so squeeze detection substitutes
*cross-sectional and absolute* Bollinger compression — a stricter, universe-aware read:
`bbWidthPct_rank_lo lte 10` AND `ADX lt 20` as the `SQUEEZE_ON` building block. Momentum
direction comes from the MACD histogram trajectory (`MACD_now gt 0` with `MACD_trend rising`
for longs) instead of the LazyBear linreg histogram. Release = expansion bar with
participation: `RVOL gte 1.5` and `pctB` beyond 0.85 / 0.15. This is Playbook 1
(`playbooks.md`) — it *is* the LazyBear process under studio vocabulary; keep
`bollinger_squeeze` at Critical-required (its `bandwidthPct` param is the absolute half of the
detection) and `volatility_atr_expanding` as the release confirmation.

## 2 · Supertrend / UT Bot Alerts — 1h/4h

**Source process.** An ATR-offset trailing line flips below/above price; entries on the flip,
and the line itself is the stop for the life of the trade.

**Port — the key insight: the studio's stop engine is native, not an indicator.** What the
Pine script simulates with a plotted line, position management executes: enable trailing with
`trailingTriggerR: 0` (trail from entry — the Supertrend/UT Bot behavior), `giveback` as the
ATR-offset analog (30–40 tight like factor-2 Supertrend, 45–55 loose like factor-3), plus the
stop band (`minStopLossAtrMultiple`/`max…`) bounding the initial distance. The *flip entry*
has no direct equivalent (no supertrend metric) — the named substitute is a trend-state change:
`MAalign is "bullish"` (state) with the `EMA5_13 is "Bullish"` cross event as the trigger, and
`ma_ema_bull_cross` / `ma_ema_aligned_bull` Critical/Important-required in `rules`. Say the
substitution out loud when presenting the strategy.

```json
"trailingEnabled": true, "trailingTriggerR": 0, "trailingGivebackPct": 35,
"trailingBufferPct": 0.2, "breakEvenEnabled": false
```

## 3 · Chandelier Exit — any persona

**Source process.** Stop trails the highest high since entry minus `3 × ATR(22)`; never widens.

**Port.** Pure position-management mapping — trail from entry with a giveback sized to the
chandelier distance: `trailingTriggerR: 0`, `trailingGivebackPct` ~45–55 (a 3×ATR pullback on
a typical setup surrenders roughly half its open run — tune against the previewed `atrPct`),
`maxStopLossAtrMultiple` near the structural cap so the initial stop can sit chandelier-wide.
The studio stop also never widens; time decay stays off (chandelier gives trends room).

## 4 · MACD + 200 MA filter — 4h (the classic trend-following combo)

**Source process.** Only long while price is above the 200-period average; enter on a MACD
bullish cross; mirror for shorts below.

**Port.** Regime as a required building block, cross as the carrier's trigger:

```json
[
  { "conditionKey": "ABOVE_200", "name": "Above the 200 SMA",
    "definition": { "kind": "clause", "column": { "sectionKey": null, "header": "dist_SMA200" }, "op": "gt", "value": 0 },
    "verdict": null, "required": false },
  { "conditionKey": "MACD_LONG", "name": "MACD bull cross in uptrend",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "conditionRef", "conditionKey": "ABOVE_200" },
      { "kind": "clause", "column": { "sectionKey": null, "header": "MACD_cross" }, "op": "is", "label": "Bullish" } ] },
    "verdict": "UP", "required": false }
]
```

Columns: `SMA200 distance` → `dist_SMA200`; `MACD crossDetect` → `MACD_cross` (event — TRUE
only on the crossing bar, otherwise UNRESOLVED; that momentariness is faithful to the source,
which also only fires on the cross). Rules: `macd_bull_cross`/`macd_bear_cross` 3 required ·
`ma_sma200_above`/`ma_sma200_below` 2 required · `trend_adx_trending` 1. Gates ~0.6 / 2.
Swing-trend geometry (1–2.5 ATR, RR 2, trail late).

## 5 · Golden Cross / Death Cross regime book — 4h position

**Source process.** SMA50 crossing above SMA200 defines the bull regime; below, the bear.

**Port.** The spread composition gives both the *state* (sign) and the *freshness* (trend):
`SMA50 spread SMA200 × trajectory w4` → `SMA50_SMA200_spread_now` (>0 = golden regime) and
`SMA50_SMA200_spread_trend` (`rising` = the cross is developing, not decaying). Carrier:
`GOLDEN` verdict UP = `spread_now gt 0` AND `trend is "rising"`; add a market-breadth gate —
the always-addressable `mktBreadth_crypto gte 0` (net % of the crypto field closing up) keeps
the book out of single-name traps. Rules: `ma_sma200_above` 3 required, `ma_ema_aligned_bull`
2, `htf_ma_aligned_bull` 2. Position persona: wide stops (1.5–2.5 ATR), RR 2, trail
1.5R/giveback 50.

## 6 · RSI-2 (Larry Connors) — 1h mean reversion

**Source process.** In an uptrend (close > 200 SMA), buy panic dips (RSI(2) < 10); exit fast
(cross of the 5-period average / a few bars).

**Port — named substitute.** The catalog carries no RSI(2); `RSI7` is the fastest RSI series
and `lte 10` on it is a rarer, deeper panic — state that trade-off rather than hiding it.
`DIP_BUY` verdict UP = `dist_SMA200 gt 0` (ref a required `ABOVE_200`) AND `RSI7 lte 10`.
Rules: `rsi_oversold` 3 required `{"threshold": 25}` (RSI14 gate tuned toward the fast-dip
regime — read the signal schema first) · `ma_sma200_above` 2 required · `bollinger_lower_touch`
1. The source's fast exit is time, not price: `timeDecayEnabled: true`, grace 180, interval
60, tighten 15 → max 50, stale 20 — the studio's honest port of "if it hasn't bounced in a few
bars, leave". RR 1.2–1.5, stops 1.5–2.5 ATR (dips need room), break-even 0.8R.

## 7 · VWAP reversion — 15m/1h intraday

**Source process.** Fade stretches away from session VWAP back toward it; stand aside when the
stretch is trend, not noise.

**Port.** `VWAP distance` → `dist_VWAP` (signed %); the board-relative stretch is
`VWAP distance × rank far` → `dist_VWAP_rank_far lte 5` (top-5 most stretched either way).
`FADE_TO_VWAP` verdict from the sign: DOWN when `dist_VWAP gte 2` and `RSI14 gte 65`; UP when
`dist_VWAP lte -2` and `RSI14 lte 35`; veto trend days with a required
`NOT [ADX_state in ["trending","extreme"]]`. Rules: `rsi_overbought`/`rsi_oversold` 2 each,
`bollinger_upper_touch`/`lower_touch` 2, `cvd_bear_divergence`/`bull_divergence` 1. Scalp
geometry + aggressive time decay (VWAP reversion is a session trade — the anchor resets daily
at 00:00 UTC, which the column's own gloss states).

## 8 · Donchian / Turtle breakout — 4h

**Source process.** Buy the N-bar-high breakout, ride with a wide trailing stop, exit on the
opposite channel.

**Port.** The catalog's structural highs replace the fixed N-bar channel: `zone is
"breakout high"` (price beyond the tracked swing high) with `dist_swingHi gte 0` as the
numeric confirmation, `RVOL gte 1.5` for participation, and `sr_resistance_break` 3 required
in rules (its own params define the break). Turtle exits are the trend preset: stops 1.5–2.5
ATR, RR 2+, trail from 1R with giveback 50, no time decay. Mirror with `"breakdown low"` /
`dist_swingLo` / `sr_support_break` for shorts. **Daily variant on any anchor:** pin the same
structure at 1d — `zone_1d is "breakout high"`, `dist_swingHi_1d gte 0` (both validated) —
which is the studio's daily-breakout condition. Note the substitution: the level is the
tracked *daily swing* pivot, not the literal previous-day high — `distance` takes no `offset`
and clauses never compare two columns, so PDH/PDL as exact levels are not addressable (see
the not-expressible table).

## 9 · ICT / Smart Money Concepts: FVG + Order Blocks — 15m/1h

**Source process.** Establish higher-timeframe bias; wait for price to return into a fair
value gap or order block aligned with that bias; enter on the reaction, stop beyond the zone.

**Port — the zone half is native.** `STRUCT_ZONES` *is* the platform's FVG/order-block engine:
`zones_htf_support_type` (`bullish FVG` / `bullish order block`), `zones_htf_support_dist`
(signed %; support below price is negative — `between -1.5 0` = sitting on the zone),
`zones_htf_support_age_h gte 12` (a standing zone, not the last move's shadow). Bias =
`MAalign_htf is "bullish"` as a required building block. Carrier: bias + in-zone + a tape
quorum (`N_OF(2)`: `buyPres gte 0.55`, `RVOL gte 1.2`, `closeChg gt 0`). Rules:
`structure_fvg_approach` / `structure_ob_approach` 3/2 required (their `proximityPct` params
are the "in the zone" dial), `structure_zone_confluence` 2, `sr_at_support` 2. Stops: tight
band (0.5–1.5 ATR) — the zone's far edge is the invalidation, and the studio places stops by
ATR/structure natively. **Not expressible, say so:** liquidity sweeps, displacement legs,
killzone clocks, and Turtle-Soup false-break sequencing (ordering between events is outside
the grammar) — offer this zone-reaction port as the nearest expressible neighbor, labelled.

## Not expressible — and the honest nearest neighbor

| Script | Missing primitive | Nearest expressible neighbor |
|---|---|---|
| WaveTrend [LazyBear] | WT oscillator | `STOCH_K`/`STOCH_D` zones + crosses (`stoch_*` signals) |
| QQE / QQE MOD | smoothed-RSI ATR bands | `RSI7` trajectory + `rsi_*` signals with tuned thresholds |
| Hull Suite | Hull MA | `EMA5/13/20` ribbon (`MAalign`, EMA spread trend) |
| Ichimoku | cloud spans | `MAalign` + `SMA50_SMA200_spread` + `zones_htf_*` levels |
| Parabolic SAR | SAR dots | trailing stop from entry (`trailingTriggerR: 0`) |
| Keltner Channels | ATR envelope | `bbWidthPct` compression + `atrPct` band logic |
| Pivot Points (daily) | session pivots | `VWAP` + `swingHi`/`swingLo` distances |
| Previous-day / previous-week high-low (PDH/PDL) | offset-able levels (`distance` takes no `offset`; clauses are column-vs-literal) | daily swing structure: `zone_1d is "breakout high"`, `dist_swingHi_1d` / `dist_swingLo_1d` |

Never compile a "port" of these under the source's name without the substitution note — a
player who asked for WaveTrend and silently got Stochastic has no way to learn otherwise.
