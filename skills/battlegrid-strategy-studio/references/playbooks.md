# Strategy Studio playbooks — validated desk-grade examples

Five complete composition patterns, modeled on how systematic desks actually structure these
trades. Every header, vocabulary label, bound, and shape below was validated against the live
server (preview + column contracts) on 2026-08-28. Tokens are still illustrative: re-discover
before compiling, and read exact headers from `preview_strategy_report`'s `conditionColumns`.

Playbook 1 shows the **full** `compile_strategy_plan` CREATE request. Playbooks 2–5 show only
the axes that differ — their envelope (`operation`, `intentSummary`, `assumptions`,
`coinSelection`, identity, timeframe) follows the same shape. Multi-account proxies wrap each as
`{ account, request }`.

---

## 1 · Volatility Compression Breakout (vol desk, 4h swing)

**Thesis.** Coins in the tightest Bollinger compression on the board, with trend strength not yet
developed, break hard when volume arrives. Trade the expansion, direction decided by the break.

**Why this shape.** Cross-sectional `rank` finds compression *relative to the whole universe*
(cheaper and more robust than an absolute width threshold); a building-block condition holds the
squeeze state and two verdict carriers decide direction; a required liquidity floor stops the
agent spending calls on illiquid names; tight stop band + trailing because breakout invalidation
is nearby and winners should run.

```json
{
  "request": {
    "operation": "CREATE",
    "intentSummary": "Cross-sectional volatility-compression breakout: enter expansions out of the tightest Bollinger squeezes on the board, direction decided by the breaking bar, volume-confirmed.",
    "assumptions": [
      "4h anchor: swing cadence, structural zones read on the regime rung",
      "Ranked CRYPTO cohort approximates the live tradable universe"
    ],
    "coinSelection": { "mode": "ranked", "limit": 20, "category": "CRYPTO" },
    "name": "Compression Breakout",
    "tagline": "Tightest bands on the board, traded on expansion",
    "description": "Scans the universe for Bollinger-width compression (bottom-decile rank), requires real participation, and enters the expansion bar in its own direction. Structure zones frame targets.",
    "timeframe": "4h",
    "sections": [
      {
        "kind": "custom",
        "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5",
        "title": "Squeeze Scan",
        "benchmarkTicker": null,
        "columns": [
          { "metric": "BB_WIDTH_PCT", "transformId": "value", "timeframe": { "rel": "anchor" } },
          { "metric": "BB_WIDTH_PCT", "transformId": "rank", "timeframe": { "rel": "anchor" }, "ordering": "lo" },
          { "metric": "ADX", "transformId": "value", "timeframe": { "rel": "anchor" } },
          { "metric": "RVOL", "transformId": "value", "timeframe": { "rel": "anchor" } },
          { "metric": "BB_PCT_B", "transformId": "value", "timeframe": { "rel": "anchor" } },
          { "metric": "CLOSE_CHANGE", "transformId": "value", "timeframe": { "rel": "anchor" } },
          { "metric": "NOTIONAL_VOLUME_1D", "transformId": "value", "timeframe": { "rel": "anchor" } }
        ]
      },
      { "kind": "platform", "sectionKey": "includeBollingerBands" },
      { "kind": "platform", "sectionKey": "includeStructureZones" }
    ],
    "conditions": [
      {
        "conditionKey": "LIQUID_FLOOR",
        "name": "Liquidity floor",
        "definition": { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "vol24hUsd" }, "op": "gte", "value": 25000000 },
        "verdict": null,
        "required": true
      },
      {
        "conditionKey": "SQUEEZE_ON",
        "name": "Volatility compression",
        "definition": {
          "kind": "group", "op": "ALL", "members": [
            { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "bbWidthPct_rank_lo" }, "op": "lte", "value": 10 },
            { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "ADX" }, "op": "lt", "value": 20 }
          ]
        },
        "verdict": null,
        "required": false
      },
      {
        "conditionKey": "BREAK_UP",
        "name": "Upside expansion",
        "definition": {
          "kind": "group", "op": "ALL", "members": [
            { "kind": "conditionRef", "conditionKey": "SQUEEZE_ON" },
            { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "closeChg" }, "op": "gt", "value": 0 },
            { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "RVOL" }, "op": "gte", "value": 1.5 },
            { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "pctB" }, "op": "gte", "value": 0.85 }
          ]
        },
        "verdict": "UP",
        "required": false
      },
      {
        "conditionKey": "BREAK_DOWN",
        "name": "Downside expansion",
        "definition": {
          "kind": "group", "op": "ALL", "members": [
            { "kind": "conditionRef", "conditionKey": "SQUEEZE_ON" },
            { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "closeChg" }, "op": "lt", "value": 0 },
            { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "RVOL" }, "op": "gte", "value": 1.5 },
            { "kind": "clause", "column": { "sectionKey": "custom:a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", "header": "pctB" }, "op": "lte", "value": 0.15 }
          ]
        },
        "verdict": "DOWN",
        "required": false
      }
    ],
    "rules": [
      { "signalId": "bollinger_squeeze", "allocation": 3, "required": true },
      { "signalId": "volume_surge", "allocation": 2, "required": true, "params": { "multiplier": 1.5 } },
      { "signalId": "volatility_atr_expanding", "allocation": 2, "required": false },
      { "signalId": "sr_resistance_break", "allocation": 2, "required": false },
      { "signalId": "sr_support_break", "allocation": 2, "required": false },
      { "signalId": "bollinger_upper_touch", "allocation": 1, "required": false },
      { "signalId": "bollinger_lower_touch", "allocation": 1, "required": false },
      { "signalId": "trend_adx_ranging", "allocation": 1, "required": false }
    ],
    "minAggregateScore": 0.55,
    "minRequiredCount": 2,
    "minAtrPct": 0.8,
    "minStopLossAtrMultiple": 0.75,
    "maxStopLossAtrMultiple": 1.75,
    "minRiskRewardRatio": 2,
    "breakEvenEnabled": true,
    "breakEvenTriggerR": 1,
    "trailingEnabled": true,
    "trailingTriggerR": 1.2,
    "trailingGivebackPct": 35,
    "trailingBufferPct": 0.3,
    "timeDecayEnabled": false,
    "marketReadText": "Trade only expansions out of compression: {SQUEEZE_ON} must read TRUE on the setup bar. Board standing {bbWidthPct_rank_lo}; participation {RVOL} must be at least 1.5x. Longs on {BREAK_UP}, shorts on {BREAK_DOWN}; skip anything failing {LIQUID_FLOOR}. Frame targets against the regime-rung zones ({zones_htf_resist_dist} up, {zones_htf_support_dist} down)."
  }
}
```

**Review focus.** In the compile response: the scorecard should show exactly the eight named
rules scoring (everything else Off); `reviewContext.reportPreview.conditionOutcomes` should show
`SQUEEZE_ON` evidence per coin and the verdict tally; check `marketReadMarkers` all resolve.

---

## 2 · Crowded-Positioning Fade (derivatives desk, 1h intraday)

**Thesis.** When funding is paying one side heavily, open interest is building, and the OI·price
regime says the crowd is adding into an extended move, fade it back toward equilibrium.

**Sections.** Custom `Positioning` (mint key `custom:b2b2…`):
`FUNDING_RATE value` → `rate` · `FUNDING_RATE aggregate w24` → `rate_mean24` (one venue print is
noise; the 24-sample mean is the crowd's bill) · `FUNDING_ANN value` → `ann` · `OI_CHG value` →
`oiChg` · `OI_PX_REGIME value` → `oiRegime` (vocab: `new longs` / `new shorts` /
`short covering` / `long liquidation`) · `MARK spread ORACLE` → `mark_oracle_spread` (perp
premium) · `RSI14 value` · `CHG_24H value` → `chg24h`. Plus platform `includeCvd`.

**Conditions** (building blocks carry no verdict; NOT as a required veto):

```json
[
  { "conditionKey": "NO_LIQUIDATION_TAPE", "name": "Not a liquidation knife",
    "definition": { "kind": "group", "op": "NOT", "members": [
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "oiRegime" }, "op": "is", "label": "long liquidation" } ] },
    "verdict": null, "required": true },
  { "conditionKey": "CROWDED_LONGS", "name": "Longs overpaying and adding",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "ann" }, "op": "gte", "value": 25 },
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "oiChg" }, "op": "gte", "value": 3 },
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "oiRegime" }, "op": "is", "label": "new longs" } ] },
    "verdict": null, "required": false },
  { "conditionKey": "FADE_SHORT", "name": "Fade the crowded long",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "conditionRef", "conditionKey": "CROWDED_LONGS" },
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "RSI14" }, "op": "gte", "value": 65 },
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "chg24h" }, "op": "gte", "value": 5 } ] },
    "verdict": "DOWN", "required": false },
  { "conditionKey": "SQUEEZED_SHORTS", "name": "Shorts overpaying and adding",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "ann" }, "op": "lte", "value": -25 },
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "oiChg" }, "op": "gte", "value": 3 },
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "oiRegime" }, "op": "is", "label": "new shorts" } ] },
    "verdict": null, "required": false },
  { "conditionKey": "SQUEEZE_LONG", "name": "Squeeze the crowded short",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "conditionRef", "conditionKey": "SQUEEZED_SHORTS" },
      { "kind": "clause", "column": { "sectionKey": "custom:b2b2b2b2-c3c3-4d4d-8e5e-f6f6f6f6f6f6", "header": "RSI14" }, "op": "lte", "value": 35 } ] },
    "verdict": "UP", "required": false }
]
```

**Rules** (note the tuned params — read `get_strategy_signal_definition` first):
`funding_extreme_positive` 3 required, params `{"thresholdPct": 0.001}` ·
`funding_extreme_negative` 3 required, params `{"thresholdPct": 0.001}` · `oi_surge` 2, params
`{"thresholdPct": 0.03}` · `rsi_overbought` 2, params `{"threshold": 65}` · `rsi_oversold` 2,
params `{"threshold": 35}` · `cvd_bear_divergence` 2 · `cvd_bull_divergence` 2 ·
`mfi_overbought` 1 · `mfi_oversold` 1.

**Gates & geometry.** `minAggregateScore 0.6`, `minRequiredCount 1` (either funding extreme),
`minAtrPct 0.5`. Levels `1.0–2.5` ATR (mean reversion needs room), RR `1.5`. Position
management: break-even at `0.8R`, trailing off, **timeDecay on** (`grace 120`, `interval 60`,
`tighten 10`, `max 40`, `stale 25`) — a fade that hasn't paid in a couple of hours is wrong.

---

## 3 · Relative-Strength Rotation with a Benchmark Gate (cross-sectional desk, 4h)

**Thesis.** Own the leaders while the market leader trends up; press the laggards when it rolls
over. Selection is cross-sectional (ranks), regime is read off a **benchmark section**.

**Sections.** Custom `Leadership` (key `custom:d4d4…`): `CLOSE_CHANGE rank hi` →
`closeChg_rank_hi` · `CLOSE_CHANGE rank lo` → `closeChg_rank_lo` · `RVOL rank hi` →
`RVOL_rank_hi` · `EMA5 spread EMA13 × trajectory w4` → `EMA5_EMA13_spread_now` / `_trend` ·
`NOTIONAL_VOLUME_1D value` → `vol24hUsd`. Custom `BTC Regime` with `"benchmarkTicker": "BTC"`
(key `custom:c3c3…`): `MA_ALIGN value` → `MAalign` (bullish/bearish/mixed) · `ADX value` ·
`REGIME_TREND value` → `regTrend`. Every row of that section reads BTC, not the evaluated coin.

**Conditions** (refs compose the regime gate with selection; duplicated headers like `ADX`
must be section-qualified — that is why the section keys are minted client-side):

```json
[
  { "conditionKey": "BTC_RISK_ON", "name": "BTC trending up",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "clause", "column": { "sectionKey": "custom:c3c3c3c3-d4d4-4e5e-8f6f-a7a7a7a7a7a7", "header": "MAalign" }, "op": "is", "label": "bullish" },
      { "kind": "clause", "column": { "sectionKey": "custom:c3c3c3c3-d4d4-4e5e-8f6f-a7a7a7a7a7a7", "header": "ADX" }, "op": "gte", "value": 20 } ] },
    "verdict": null, "required": false },
  { "conditionKey": "BTC_RISK_OFF", "name": "BTC rolling over",
    "definition": { "kind": "clause", "column": { "sectionKey": "custom:c3c3c3c3-d4d4-4e5e-8f6f-a7a7a7a7a7a7", "header": "MAalign" }, "op": "is", "label": "bearish" },
    "verdict": null, "required": false },
  { "conditionKey": "LEADER", "name": "Top-5 leader with participation",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "clause", "column": { "sectionKey": "custom:d4d4d4d4-e5e5-4f6f-8a7a-b8b8b8b8b8b8", "header": "closeChg_rank_hi" }, "op": "lte", "value": 5 },
      { "kind": "clause", "column": { "sectionKey": "custom:d4d4d4d4-e5e5-4f6f-8a7a-b8b8b8b8b8b8", "header": "RVOL_rank_hi" }, "op": "lte", "value": 10 },
      { "kind": "clause", "column": { "sectionKey": "custom:d4d4d4d4-e5e5-4f6f-8a7a-b8b8b8b8b8b8", "header": "vol24hUsd" }, "op": "gte", "value": 100000000 } ] },
    "verdict": null, "required": false },
  { "conditionKey": "ROTATE_IN", "name": "Rotate into leadership",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "conditionRef", "conditionKey": "BTC_RISK_ON" },
      { "kind": "conditionRef", "conditionKey": "LEADER" } ] },
    "verdict": "UP", "required": false },
  { "conditionKey": "ROTATE_OUT", "name": "Press laggards in risk-off",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "conditionRef", "conditionKey": "BTC_RISK_OFF" },
      { "kind": "clause", "column": { "sectionKey": "custom:d4d4d4d4-e5e5-4f6f-8a7a-b8b8b8b8b8b8", "header": "closeChg_rank_lo" }, "op": "lte", "value": 5 } ] },
    "verdict": "DOWN", "required": false }
]
```

**Rules.** `comparison_sector_momentum` 3 · `rel_roc_positive` 2 · `rel_roc_negative` 2 ·
`ma_ema_aligned_bull` 2 required · `ma_ema_aligned_bear` 2 required · `rel_ppo_bull_cross` 1 ·
`rel_ppo_bear_cross` 1 · `volume_surge` 1. Gates: `0.5 / 1 / 0.6`. Levels `1–2` ATR, RR `1.8`.
PM: break-even 1R; trailing at 1R with giveback 45 (let rotation winners run); no timeDecay.
`coinSelection` `{"mode":"ranked","limit":40,"category":"CRYPTO"}` — ranks need a wide cohort.

---

## 4 · HTF Trend Pullback (CTA desk, 1h, multi-timeframe confluence)

**Thesis.** Only trade with the higher-timeframe trend; enter on anchor-rung pullbacks to value
while the lower rung has not broken structure. Never spend an LLM call in chop.

**Sections.** Platform `includeMtfConfluence` (headers per rung: `MAalign_ltf` / `MAalign` /
`MAalign_htf`, `RSI14_*_zone`, `ADX_*_state` with vocab weak/developing/trending/extreme),
platform `includeMovingAverages` (`dist_SMA20`, `dist_EMA20`, …), platform `includeRsi`
(`RSI14_now`, `RSI14_zone`). Platform section keys are their literal `sectionKey` — qualify
clauses with e.g. `"sectionKey": "includeMtfConfluence"` where headers collide.

**Conditions** — the `ANY`-of-trends required gate is the key move: chop (neither trend) blocks
compose-trade entirely, before billing:

```json
[
  { "conditionKey": "HTF_UP", "name": "HTF uptrend",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "clause", "column": { "sectionKey": "includeMtfConfluence", "header": "MAalign_htf" }, "op": "is", "label": "bullish" },
      { "kind": "clause", "column": { "sectionKey": "includeMtfConfluence", "header": "ADX_htf_state" }, "op": "in", "labels": ["trending", "extreme"] } ] },
    "verdict": null, "required": false },
  { "conditionKey": "HTF_DOWN", "name": "HTF downtrend",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "clause", "column": { "sectionKey": "includeMtfConfluence", "header": "MAalign_htf" }, "op": "is", "label": "bearish" },
      { "kind": "clause", "column": { "sectionKey": "includeMtfConfluence", "header": "ADX_htf_state" }, "op": "in", "labels": ["trending", "extreme"] } ] },
    "verdict": null, "required": false },
  { "conditionKey": "TREND_PRESENT", "name": "Some HTF trend exists",
    "definition": { "kind": "group", "op": "ANY", "members": [
      { "kind": "conditionRef", "conditionKey": "HTF_UP" },
      { "kind": "conditionRef", "conditionKey": "HTF_DOWN" } ] },
    "verdict": null, "required": true },
  { "conditionKey": "PULLBACK_LONG", "name": "Pullback to value in uptrend",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "conditionRef", "conditionKey": "HTF_UP" },
      { "kind": "clause", "column": { "sectionKey": "includeRsi", "header": "RSI14_now" }, "op": "between", "low": 35, "high": 55 },
      { "kind": "clause", "column": { "sectionKey": "includeMovingAverages", "header": "dist_EMA20" }, "op": "between", "low": -3, "high": 0.5 } ] },
    "verdict": "UP", "required": false },
  { "conditionKey": "PULLBACK_SHORT", "name": "Rally to value in downtrend",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "conditionRef", "conditionKey": "HTF_DOWN" },
      { "kind": "clause", "column": { "sectionKey": "includeRsi", "header": "RSI14_now" }, "op": "between", "low": 45, "high": 65 },
      { "kind": "clause", "column": { "sectionKey": "includeMovingAverages", "header": "dist_EMA20" }, "op": "between", "low": -0.5, "high": 3 } ] },
    "verdict": "DOWN", "required": false }
]
```

**Rules.** `mtf_pullback_long` 3 required · `mtf_pullback_short` 3 required ·
`htf_ma_aligned_bull` 2 required · `htf_ma_aligned_bear` 2 required · `htf_trend_adx_trending`
2 · `ma_ema_aligned_bull` 1 · `ma_ema_aligned_bear` 1 · `rsi_oversold` 1 params
`{"threshold": 40}` (pullback depth, not capitulation). Gates: `minAggregateScore 0.6`,
`minRequiredCount 2` (a pullback signal *and* an HTF alignment), `minAtrPct 0.7`. Levels
`1–2.5` ATR, RR `2`. PM: break-even 1R; trailing 1.5R giveback 30 buffer 0.3; no timeDecay.

---

## 5 · Perp/Spot Flow Divergence at Structure (microstructure desk, 15m scalp)

**Thesis.** When spot flow leads (accumulation) and price sits just above a standing support
zone, buy the dip; when a move is perp-led and fragile into resistance, fade it. Structure comes
from the platform zones section; flow from the perp/spot module.

**Sections.** Platform `includePerpSpotFlow` (`perpSpotFlow` vocab: `confirmed_bull` /
`confirmed_bear` / `perp_led_fragile` / `spot_led_accumulation` / `neutral`; plus
`perpSpotStr`, `spotCVD`), platform `includeStructureZones` (`zones_htf_support_dist` — signed %
from price, support below price is negative; `zones_htf_resist_dist`, `_age_h`, `_type`),
custom `Tape` (key `custom:e5e5…`): `BUY_PRESSURE value` → `buyPres` (0–1) · `RVOL value` ·
`CLOSE_CHANGE value` → `closeChg`.

**Conditions** — `N_OF` requires 2-of-3 tape confirmations instead of a brittle ALL:

```json
[
  { "conditionKey": "SPOT_ACCUM", "name": "Spot-led accumulation",
    "definition": { "kind": "clause", "column": { "sectionKey": "includePerpSpotFlow", "header": "perpSpotFlow" }, "op": "is", "label": "spot_led_accumulation" },
    "verdict": null, "required": false },
  { "conditionKey": "NEAR_SUPPORT", "name": "Sitting on a standing zone",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "clause", "column": { "sectionKey": "includeStructureZones", "header": "zones_htf_support_dist" }, "op": "between", "low": -2, "high": 0 },
      { "kind": "clause", "column": { "sectionKey": "includeStructureZones", "header": "zones_htf_support_age_h" }, "op": "gte", "value": 12 } ] },
    "verdict": null, "required": false },
  { "conditionKey": "DIP_BID", "name": "Buy the dip into support",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "conditionRef", "conditionKey": "SPOT_ACCUM" },
      { "kind": "conditionRef", "conditionKey": "NEAR_SUPPORT" },
      { "kind": "group", "op": "N_OF", "n": 2, "members": [
        { "kind": "clause", "column": { "sectionKey": "custom:e5e5e5e5-f6f6-4a7a-8b8b-c9c9c9c9c9c9", "header": "buyPres" }, "op": "gte", "value": 0.55 },
        { "kind": "clause", "column": { "sectionKey": "custom:e5e5e5e5-f6f6-4a7a-8b8b-c9c9c9c9c9c9", "header": "RVOL" }, "op": "gte", "value": 1.2 },
        { "kind": "clause", "column": { "sectionKey": "custom:e5e5e5e5-f6f6-4a7a-8b8b-c9c9c9c9c9c9", "header": "closeChg" }, "op": "gt", "value": 0 } ] } ] },
    "verdict": "UP", "required": false },
  { "conditionKey": "FRAGILE_POP", "name": "Perp-led pop into resistance",
    "definition": { "kind": "group", "op": "ALL", "members": [
      { "kind": "clause", "column": { "sectionKey": "includePerpSpotFlow", "header": "perpSpotFlow" }, "op": "is", "label": "perp_led_fragile" },
      { "kind": "clause", "column": { "sectionKey": "includeStructureZones", "header": "zones_htf_resist_dist" }, "op": "between", "low": 0, "high": 2 },
      { "kind": "clause", "column": { "sectionKey": "custom:e5e5e5e5-f6f6-4a7a-8b8b-c9c9c9c9c9c9", "header": "RVOL" }, "op": "gte", "value": 1.3 } ] },
    "verdict": "DOWN", "required": false }
]
```

**Rules.** `flow_perp_spot_bull_divergence` 3 required · `flow_perp_spot_bear_divergence` 3
required · `cvd_bull_divergence` 2 · `cvd_bear_divergence` 2 · `sr_at_support` 2 ·
`sr_at_resistance` 2 · `structure_ob_approach` 1 · `volume_surge` 1. Gates: `0.55 / 1 / 0.4`
(15m: lower ATR floor). Levels `0.5–1.2` ATR, RR `1.5` — scalp geometry. PM: break-even
`0.7R`; trailing `0.9R`, giveback 30, buffer 0.15; **timeDecay on and aggressive** (`grace 45`,
`interval 15`, `tighten 15`, `max 60`, `stale 30`). `coinSelection`
`{"mode":"ranked","limit":15,"category":"CRYPTO"}`.

---

## Using a playbook

1. Re-discover the vocabulary; confirm each header via `get_strategy_column_contract` or one
   `preview_strategy_report` over your sections (read `conditionColumns`).
2. Adapt thresholds to the current market — preview shows live values beside each clause, so
   calibrate literals against what the table actually renders.
3. Compile once, read `approvedPlan` (scorecard, diff, viability) and
   `reviewContext.reportPreview` (condition outcomes, verdict tally, budgets), fix, recompile.
4. Apply with `{ "request": { "planToken": "<verbatim>", "confirm": true } }` after review.
