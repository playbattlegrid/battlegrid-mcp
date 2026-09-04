---
name: battlegrid-strategy-examples
description: Full-surface composition patterns for the strategy studio — validated desk-grade examples of custom report sections, benchmark sections, condition trees with verdicts and enforcement gates, tiered signal weights, routing gates, ATR trade levels, and position management. Activate beside strategy-authoring whenever a strategy is being composed or upgraded beyond a basic template.
---

# Strategy Studio — full-power composition patterns

`strategy-authoring` owns the flow (evidence → locked spec → discover → compile → review →
apply). This skill owns **what to compose**: a default build — a few platform sections, no
conditions, untouched weights — wastes the studio. The playbooks below are compiled in CI, so their
shapes are binding in the sense that matters — they are checked, not merely asserted. Loose tokens
elsewhere in this file are not covered by that gate, and vocabulary moves with deploys, so discovery
in the conversation stays the authority — prefer what `list_strategy_vocabulary`,
`get_strategy_column_contract`, and `get_strategy_signal_definition` return over anything
printed here, and read exact headers from a preview's `conditionColumns` before conditioning on
them.

## The full-power checklist

Before compiling a CREATE, every "no" here is a decision to state, not an omission:

1. At least one **custom section** whose columns encode the thesis — not only platform modules.
2. **Conditions** encode the entry logic: building blocks (`verdict: null`) + verdict carriers,
   and at least one `required: true` condition vetoing obvious disqualifiers **before any
   billing or LLM call**.
3. **Every signal meant to score is named in `rules`** with a deliberate tier — unnamed signals
   keep server defaults (typically Off). Verify in the compiled scorecard, never assume.
4. **Gates** (`minAggregateScore`, `minRequiredCount`, `minAtrPct`) are computed against the
   chosen weight budget, not guessed.
5. **Trade levels + position management** match the setup's geometry and holding period.
6. `marketReadText` states standing orders with `{...}` markers so live values render inline.

## Header grammar (system-generated — never named by the author)

| Transform | Header | Validated example |
|---|---|---|
| `value` | `<code>` | `bbWidthPct`, `RVOL`, `rate` |
| `trajectory` w4 | `<code>_t3…_t1`, `_now`, `_trend` (rising/falling/flat) | `RSI14_now`, `RSI14_trend` |
| `distance` | `dist_<code>` (signed % from price) | `dist_SMA50` |
| `spread` | `<base>_<operand>_spread` | `mark_oracle_spread` |
| `aggregate` wN | `<code>_mean<N>` | `rate_mean24` |
| `rank` | `<code>_rank_<hi\|lo\|far\|near>` — ordinal, `lte N` = top-N | `bbWidthPct_rank_lo` |
| `efficiency` wN | `<code>_er` (1 straight, ~0 chop) | `close_ltf_er` |
| `maxShare` wN | `<code>_maxShare` | `volBase_ltf_maxShare` |
| `classifyZone` / `classifyState` | `<code>_zone` / `<code>_state` | `RSI14_zone`, `ADX_state` |

Non-anchor rungs affix `_ltf` (lower) / `_htf` (regime): `MAalign_htf`,
`zones_htf_support_dist`. Chains are bounded at two: inner `distance`/`spread` → outer
`trajectory`/`aggregate`/`efficiency`/`maxShare`/`rank` (`EMA5 spread EMA13 × trajectory` →
`EMA5_EMA13_spread_now` + `_trend`).

**Timeframe references are two families.** *Relative* (`anchor`/`lower`/`regime`) re-resolve
when the strategy timeframe changes — `regime` is the anchor's ladder successor (1d for a 4h
anchor). *Pinned* (`{abs: "<tf>"}`) is fixed, ignores anchor retunes, suffixes the literal
(`RSI14_1d`, `dist_SMA200_1d`, `MAalign_1d` — validated), and binds to discovery's
`rankedTimeframes`, a **superset** of the authorable anchor set — `{abs: "1d"}` is valid while
`1d` is not an anchor. `offset: 1` on a pinned `value` column reads the last **closed** bar of
that timeframe (`RSI14[t - 1]`) — the deterministic daily-close read; offset 0 reads the
forming bar (provisional), and offset does not change the header, so one offset per
`metric × timeframe` per section. **Daily-strategy pattern:** anchor 4h, pinned-1d thesis
columns at `offset: 1`, `required: true` daily conditions gating every carrier, anchor-rung
columns only for entry timing and risk — daily inputs then move once per daily close while
stops and time decay keep managing intraday. **Benchmark sections** (`benchmarkTicker: "BTC"`,
required-nullable on every custom section) read the benchmark's values on every row — the
standard market-leader regime gate. Platform `sectionKey`s are their literal keys
(`includeMtfConfluence`). Custom `sectionKey`s are the **server's** to issue, and which of the two
things you do depends on the operation: on a **CREATE, omit `sectionKey` entirely** — supplying one
is refused, since a new strategy owns no custom sections yet; on an **UPDATE or RESTORE, send back
the keys `get_strategy` returned** for the sections you are keeping. Either way you never invent
one. To section-qualify a duplicated header, read the key from a preview's `conditionColumns` or
from the qualified candidates a `CONDITION_COLUMN_AMBIGUOUS` refusal offers.

## Conditions

`{ conditionKey, name, definition, verdict, required, exit, clock, closes }` — all eight
required, no defaults. Clauses: numeric/rank headers take `lt|lte|gte|gt|between`;
classification/direction headers take `is|in` with the served vocabulary. Groups:
`ALL | ANY | NOT | N_OF` (with `n`), depth ≤ 2. `conditionRef` composes named conditions (no
cycles; forward refs legal). `sectionKey: null` is sugar for a report-unique header only.
Verdicts: first TRUE carrier **in declaration order** decides UP/DOWN/NEITHER — order carriers
most-specific first; building blocks carry `null`. `required: true` = FALSE blocks compose-trade
before billing. Evaluation is three-valued: UNRESOLVED never collapses to FALSE; forming-bar
reads are provisional.

**The evidence clock.** `clock: "LIVE"` reads the forming bar; `clock: "CLOSE"` reads settled
bars, and `closes` is how many consecutive closed bars must read TRUE (1–5) — always `1` under
LIVE, which has exactly one frame. A CLOSE clock is legal **only** over a header resolved from
this coin's own candle series at offset 0. Frame-inert operands are refused
(`CONDITION_CLOCK_OPERAND_ILLEGAL`): perp-payload scalars, published rolling changes, ranks, zone
entities, MDS regime labels, enrichment metrics, session scalars, and any clause authored at a
non-zero offset. A closed frame cannot move them, so "held for N closes" would describe reads
that never happened. The remedy is a split, not a re-clock: move that clause into its own LIVE
condition and `conditionRef` it. **Worked liquidity floor:** `LIQUID_FLOOR` is LIVE because
`vol24hUsd` is a bundle scalar; the carrier that refs it may be CLOSE over its own candle-series
clauses.

**The lane a strategy is deployed to.** Report-level scalars split by LANE, and the split is not a
quality of the header — it is which reader runs. Market breadth and the reference pairs are ordinary
market-wide reads with no session dimension, so they resolve everywhere. The five **session-field**
scalars (`fieldPlayers`, `fieldUpBias`, `fieldBiasDir`, `captConc`, `picksSpread`) describe a game
session the agent is playing in, and **radar runs outside one** — so a radar deployment whose
strategy reads one is refused outright (`CONDITION_OPERAND_UNSERVED_IN_LANE`), naming the scalars it
can read instead. The refusal lands at DEPLOY rather than at save, because a strategy carries no lane
of its own: the same strategy is legal, and reads those scalars correctly, on an arena agent.

**The exit role.** `exit: true` makes a settled TRUE reading close open positions its verdict
opposes — UP exits SHORTs, DOWN exits LONGs, a NEITHER or `null` verdict exits both. Legal only
under `clock: "CLOSE"`: a LIVE reading is the forming bar, and an exit fired on one is an
intrabar exit. Orthogonal to `required` — the two act on disjoint lifecycles, pre-entry versus
open — so a condition may carry both, either, or neither.

## Entry

`{ trigger, confirmTf, closes, bandAtrMultiple, levelSource, levelOffsetAtrMultiple,
validForBars }` — all seven required on every CREATE, no defaults. This axis is replaced WHOLE
on save, so an omitted key would silently revert an author's discipline rather than be refused.

**The trigger decides WHEN, and for two of them WHERE, an entry is taken.**

- `AT_SIGNAL` — fire the moment the radar observes the qualification flip, at whatever bar is on
  the tape, keeping the platform's flat wall-clock entry window. Today's behaviour.
- `ON_CANDLE_CLOSE` — the flip ARMS the pair; the entry is taken only after a close on
  `confirmTf` that still reads the conditions true and has not displaced beyond the band.
- `STOP_THROUGH_LEVEL` — a TRIGGER order rests at the authored level ± offset and the exchange
  book is the watcher; the entry is taken when price trades through, not when the platform
  notices.
- `ON_RETEST` — a LIMIT order rests at the broken level, waiting for a return to it. Not filling
  is a correct outcome, not a failure.

`confirmTf` is the bar whose close confirms. Exactly two values are legal: the strategy's own
timeframe and the rung below it — one only, when the strategy sits on the ladder floor. It is
NOT the authorable main-candle set; a rung further down names a bar nothing else in the strategy
observes and makes the radar sweep on every one of its closes.

`closes` (1–5) is how many consecutive confirming closes are required, and `bandAtrMultiple` is
the veto width: the entry is VOIDED when the confirming close has moved at or beyond that many
ATR against the armed verdict. Strictly greater than zero — zero is not "no filter" but a filter
that voids on any adverse move — and at or below the platform's own entry-deviation gate, since
a wider band cannot refuse anything the platform will not refuse anyway.

`levelSource` is one of `SWING_HIGH`, `SWING_LOW`, `BOLLINGER_UPPER`, `BOLLINGER_LOWER`,
resolved once at decision time. `levelOffsetAtrMultiple` (0–2) is an UNSIGNED magnitude — the
direction is implied by the trigger and the verdict, so a signed value would invert the
trigger's meaning. `validForBars` (1–24) denominates validity in the strategy's OWN bars rather
than minutes, because a 1h setup waiting for a retest has not failed after fifteen minutes.

**The legality matrix runs one way.** All seven keys are always present, so the question is
never "is it set" but "is it set to something that MEANS anything under this trigger".
`closes` ≠ 1 is refused under any trigger but `ON_CANDLE_CLOSE`; `levelOffsetAtrMultiple` ≠ 0 is
refused under a non-level trigger. Leave a dial at its inert value rather than setting one the
platform will ignore.

## Report sections

`{ kind, sectionKey, title, benchmarkTicker, notes, columns }` — the custom section shape. A
section carries no `timeframe`: its relative columns resolve against the strategy timeframe, and a
column reaches any other timeframe by pinning it (`timeframe: { abs: '4h' }`). `benchmarkTicker` and `notes` are **required-nullable**: send an explicit `null` rather
than omitting them, because the section is rebuilt whole on save and an omitted key clears the
author's value silently. On a CREATE, omit `sectionKey` — it is derived from the section itself.

## Signal rules

`{ signalId, allocation, required, params }` — one entry per signal you want scoring.
`allocation` is the tier (0–3) and `params` replaces canonical defaults only when present.

## Signal weights and gate math

Tiers: 0 Off · 1 Normal · 2 Important · 3 Critical.

```
aggregateScore = Σ(score × allocation) / Σ(allocation)   over triggered signals
```

Weights are relative — build a pyramid: 1–2 Critical (thesis, usually `required`), 2–4
Important (independent confirmation, different modules), 1–3 Normal (context), rest Off so
noise cannot dilute the average. Gate check: with 3/2/2/1 weights, Critical + one Important at
score 1.0 → (3+2)/8 = 0.625, so a 0.6 gate means "thesis plus one confirmation".
`simulate_aggregate_score` does this arithmetic from compiled values at review time.
`required: true` counts the signal toward `minRequiredCount` when triggered; at
`allocation: 0` it is rejected (contract 34). `params` replace canonical defaults only when
present — read `get_strategy_signal_definition({ signalId, timeframe })` before tuning (e.g.
`rsi_overbought {"threshold": 65}` for a fade book; `volume_surge {"multiplier": 1.5}`).
`derive_strategy_rule_view` shows which signals a draft report feeds — weighting a signal the
report never feeds is dead weight.

## Routing gates

`{ minAggregateScore, minRequiredCount, minAtrPct }` — whether a scored setup may route to a
trade at all. `minAggregateScore` 0–1 · `minRequiredCount` 0–20 · `minAtrPct` is the dead-market
floor, with bounds from `get_trading_config_catalog`.

## Trade levels

`{ minStopLossAtrMultiple, maxStopLossAtrMultiple, minRiskRewardRatio }` — where stops and
targets may sit. `minStopLossAtrMultiple < maxStopLossAtrMultiple` (≤ the 3×ATR structural cap),
`minRiskRewardRatio` within the served range. Sizing is risk-budget based — a wider stop means a
smaller position, never more risk.

## Position management

`{ breakEvenEnabled, breakEvenTriggerR, trailingEnabled, trailingTriggerR, trailingGivebackPct,
trailingBufferPct, timeDecayEnabled, timeDecayGracePeriodMinutes, timeDecayIntervalMinutes,
timeDecayTightenPct, timeDecayMaxTightenPct, timeDecayStaleThresholdTpProgressPct,
decisionInvalidationExitEnabled }` — how the stop moves after entry, and when a position is
closed for reasons other than its stop.

Validated bounds: break-even trigger 0.5–2R; trailing trigger 0–2R step 0.01 (0 = trail from
entry), giveback 25–55%, buffer 0.01–1%; timeDecay grace ≥ interval, tighten 0.1–50% to max
1–100%, stale threshold 0–100% of TP progress. Per-mechanism flags; no umbrella switch.

`decisionInvalidationExitEnabled` is the post-fill invalidation exit: a **closed**
strategy-timeframe candle beyond the decision's invalidation level closes the position
reduce-only. Bar-close only — the protective stop still owns intrabar moves.

Persona presets: scalper (5m/15m) stops 0.5–1.2 ATR, RR 1.5, BE 0.7R, trail 0.9R/giveback 30,
timeDecay ON (45/15, tighten 15→60, stale 30) · intraday mean-revert (1h) 1.0–2.5 ATR, RR 1.5,
BE 0.8R, no trail, timeDecay ON (120/60, 10→40, stale 25) · swing breakout (4h) 0.75–1.75 ATR,
RR 2, BE 1R, trail 1.2R/giveback 35 · swing trend (4h) 1.0–2.5 ATR, RR 2, BE 1R, trail
1.5R/giveback 45–55, no timeDecay.

## Playbooks (validated compositions)

*Validated* is a gate, not a claim: every playbook below is compiled against the live catalog by
`strategy-playbooks.compile.test.ts`, which fails the build if one stops assembling or if a header
its conditions name stops resolving. Edit a playbook and the gate re-checks it; move the grammar
underneath one and the gate catches that too.

### 1 · Volatility Compression Breakout — 4h swing

Custom `Squeeze Scan` (no `sectionKey` — this is a CREATE): `BB_WIDTH_PCT value` + `rank lo`, `ADX value`,
`RVOL value`, `BB_PCT_B value`, `CLOSE_CHANGE value`, `NOTIONAL_VOLUME_1D value`; plus platform
`includeStructureZones`. (No `includeBollingerBands`: it renders `bbWidthPct` and
`bbWidthPct_rank_lo` a second time, which makes both of `SQUEEZE_ON`'s clauses ambiguous, and the
custom section already carries them.) Conditions: `LIQUID_FLOOR` (required —
`vol24hUsd gte 25000000`); `SQUEEZE_ON` building block (`bbWidthPct_rank_lo lte 10` AND
`ADX lt 20`); `BREAK_UP` verdict UP (ref SQUEEZE_ON + `closeChg gt 0` + `RVOL gte 1.5` +
`pctB gte 0.85`); `BREAK_DOWN` verdict DOWN (mirror with `pctB lte 0.15`). Rules:
`bollinger_squeeze` 3 required · `volume_surge` 2 required `{"multiplier":1.5}` ·
`volatility_atr_expanding` 2 · `sr_resistance_break` 2 · `sr_support_break` 2 ·
`bollinger_upper_touch` 1 · `bollinger_lower_touch` 1 · `trend_adx_ranging` 1. Gates
0.55 / 2 / 0.8. Levels 0.75–1.75 ATR, RR 2. PM: BE 1R; trail 1.2R giveback 35 buffer 0.3.
Market Read: "Trade only expansions out of compression: {SQUEEZE_ON} must read TRUE… skip
anything failing {LIQUID_FLOOR}."

### 2 · Crowded-Positioning Fade — 1h intraday

Custom `Positioning`: `FUNDING_RATE value`→`rate`, `aggregate w24`→`rate_mean24`,
`FUNDING_ANN value`→`ann`, `OI_CHG value`→`oiChg`, `OI_PX_REGIME value`→`oiRegime` (vocab:
new longs / new shorts / short covering / long liquidation), `MARK spread ORACLE`→
`mark_oracle_spread`, `RSI14 value`, `CHG_24H value`→`chg24h`; plus `includeCvd`. Conditions:
`NO_LIQUIDATION_TAPE` required NOT-veto (`NOT [oiRegime is "long liquidation"]`);
`CROWDED_LONGS` building block (`ann gte 25` + `oiChg gte 3` + `oiRegime is "new longs"`);
`FADE_SHORT` verdict DOWN (ref + `RSI14 gte 65` + `chg24h gte 5`); mirrored `SQUEEZED_SHORTS`
/ `SQUEEZE_LONG` verdict UP. Rules: `funding_extreme_positive`/`_negative` 3 required
`{"thresholdPct":0.001}` · `oi_surge` 2 `{"thresholdPct":0.03}` · `rsi_overbought` 2
`{"threshold":65}` · `rsi_oversold` 2 `{"threshold":35}` · `cvd_bear_divergence` 2 ·
`cvd_bull_divergence` 2 · `mfi_overbought` 1 · `mfi_oversold` 1. Gates 0.6 / 1 / 0.5. Levels
1.0–2.5 ATR, RR 1.5. PM: BE 0.8R, no trail, timeDecay ON (120/60, 10→40, stale 25).

### 3 · Relative-Strength Rotation with a Benchmark Gate — 4h cross-sectional

Custom `Leadership`: `ROC12 rank hi` + `rank lo`, `RVOL rank hi`,
`EMA5 spread EMA13 × trajectory w4`, `NOTIONAL_VOLUME_1D value`. **Rank `ROC12`, not
`CLOSE_CHANGE`:** `closeChg` is the one magnitude-only rankable code, so `hi`/`lo` on it are
refused, and its legal `far` ordering sorts by |change| — which would put the session's biggest
losers in a "leaders" cohort. Custom `BTC Regime` with
`"benchmarkTicker": "BTC"`: `MA_ALIGN value`→`MAalign`, `ADX value`, `REGIME_TREND value` —
every row reads BTC. Conditions: `BTC_RISK_ON` building block (`MAalign is "bullish"` +
`ADX gte 20` — both read bare, since only this section renders them); `BTC_RISK_OFF`
(`MAalign is "bearish"`); `LEADER` (`roc12_rank_hi lte 5` + `RVOL_rank_hi lte 10` +
`vol24hUsd gte 100000000`); `ROTATE_IN` verdict UP (`ALL[ref BTC_RISK_ON, ref LEADER]`);
`ROTATE_OUT` verdict DOWN (`ALL[ref BTC_RISK_OFF, roc12_rank_lo lte 5]`). Rules:
`comparison_sector_momentum` 3 · `rel_roc_positive`/`_negative` 2 · `ma_ema_aligned_bull`/
`_bear` 2 required · `rel_ppo_bull_cross`/`_bear_cross` 1 · `volume_surge` 1. Gates
0.5 / 1 / 0.6. Levels 1–2 ATR, RR 1.8. PM: BE 1R; trail 1R giveback 45. Ranked cohort ≥ 40 —
rank conditions need a cohort wider than their thresholds.

### 4 · HTF Trend Pullback — 1h, multi-timeframe confluence

Platform `includeMtfConfluence` (`MAalign_ltf/…/_htf`, `RSI14_*_zone`, `ADX_*_state` vocab
weak/developing/trending/extreme), `includeMovingAverages` (`dist_EMA20`, …), `includeRsi`
(`RSI14_now`, `RSI14_zone`). These three render `MAalign` and `RSI14_zone` twice between them, so
every condition below reads a suffixed form — never bare `MAalign` or bare `RSI14_zone`, which
would be ambiguous. Conditions: `HTF_UP` building block (`MAalign_htf is "bullish"` +
`ADX_htf_state in ["trending","extreme"]`); `HTF_DOWN` mirror; `TREND_PRESENT` **required**
`ANY[ref HTF_UP, ref HTF_DOWN]` — chop blocks compose-trade entirely, before billing;
`PULLBACK_LONG` verdict UP (ref HTF_UP + `RSI14_now between 35 55` +
`dist_EMA20 between -3 0.5`); `PULLBACK_SHORT` verdict DOWN (mirror, 45–65 / −0.5–3). Rules:
`mtf_pullback_long`/`_short` 3 required · `htf_ma_aligned_bull`/`_bear` 2 required ·
`htf_trend_adx_trending` 2 · `ma_ema_aligned_bull`/`_bear` 1 · `rsi_oversold` 1
`{"threshold":40}`. Gates 0.6 / 2 / 0.7 (a pullback signal AND an HTF alignment). Levels
1–2.5 ATR, RR 2. PM: BE 1R; trail 1.5R giveback 30 buffer 0.3.

### 5 · Perp/Spot Flow Divergence at Structure — 15m scalp

Platform `includePerpSpotFlow` (`perpSpotFlow` vocab: confirmed_bull / confirmed_bear /
perp_led_fragile / spot_led_accumulation / neutral), `includeStructureZones`
(`zones_htf_support_dist` signed %, support below price is negative; `_age_h`), custom `Tape`
(`BUY_PRESSURE value`→`buyPres` 0–1, `RVOL value`, `CLOSE_CHANGE value`). Conditions:
`SPOT_ACCUM` (`perpSpotFlow is "spot_led_accumulation"`); `NEAR_SUPPORT`
(`zones_htf_support_dist between -2 0` + `zones_htf_support_age_h gte 12`); `DIP_BID` verdict
UP — refs plus an `N_OF(2)` quorum over `buyPres gte 0.55` / `RVOL gte 1.2` / `closeChg gt 0`
(quorum beats a brittle ALL); `FRAGILE_POP` verdict DOWN (`perp_led_fragile` +
`zones_htf_resist_dist between 0 2` + `RVOL gte 1.3`). Rules:
`flow_perp_spot_bull_divergence`/`_bear_divergence` 3 required · `cvd_bull_divergence`/
`_bear_divergence` 2 · `sr_at_support`/`_at_resistance` 2 · `structure_ob_approach` 1 ·
`volume_surge` 1. Gates 0.55 / 1 / 0.4. Levels 0.5–1.2 ATR, RR 1.5. PM: BE 0.7R; trail 0.9R
giveback 30 buffer 0.15; timeDecay ON aggressive (45/15, 15→60, stale 30).

## TradingView ports — familiar processes, studio vocabulary

Players often ask for strategies by the name of a popular TradingView script. Port the
**process** (regime filter → setup state → trigger → stop engine), and where the catalog lacks
the primitive, name the substitution in the spec-lock question — never present a substitute as
the thing itself. Most TV strategies run on the daily chart: carry that with the
daily-strategy pattern above (pinned-1d thesis at `offset: 1` on an intraday anchor), which
binds decisions to daily closes while the studio keeps managing risk intraday. Event columns (`MACD_cross`, `EMA5_13`: Bullish/Bearish) print only on the
crossing bar and are otherwise null → UNRESOLVED; use them as triggers inside a carrier and
pair with a persistent state (spread sign, `MAalign`) for regime — as the source scripts do.

- **Squeeze Momentum [LazyBear] / TTM Squeeze** → `KC_SQUEEZE is "on"` is the native one-condition
  read: the Bollinger pair sitting inside the Keltner channel, at the script's own multiplier.
  The four boundaries stay addressable, so `BB_UPPER spread KC_UPPER` and
  `BB_LOWER spread KC_LOWER` still express the same reading at a threshold you choose. Release
  direction from the MACD trajectory, `bollinger_squeeze` Critical-required.
  **Name the anchor when you port it:** on crypto the squeeze reads *on* about 57% of 1h bars even
  at canonical parameters — σ/ATR runs low here because Bollinger σ is close-to-close while ATR
  captures intrabar range — against about 19% at 15m. It is a selective filter at 15m and below,
  not at 1h. (`bbWidthPct_rank_lo` + `ADX lt 20` remains
  a serviceable board-relative compression proxy, but it is no longer the only option.)
- **Supertrend / UT Bot / Chandelier Exit** → `ST_LINE` and `ST_DIR` are native, so the regime
  half is a direct port: `ST_DIR is "bullish"` as the persistent state, `dist_ST_LINE` for
  distance to the plotted stop. The plotted trailing line is still best executed by the studio's
  own stop engine — `trailingTriggerR: 0` (trail from entry), giveback ~30–40 (tight factor) or
  45–55 (loose/chandelier) — because a trailing stop is a position-management mechanism, not a
  column. **`ST_DIR` is a persisting state, not a flip event**: it reads the same on every bar of
  a trend, so the FLIP still needs an event column beside it (`EMA5_13` cross, or a `ST_DIR`
  trajectory whose `_trend` changes). Name that as a substitution.
- **MACD + 200 MA filter** → `ABOVE_200` building block (`dist_SMA200 gt 0`) referenced by a
  carrier with `MACD_cross is "Bullish"`; rules `macd_bull/bear_cross` 3 required +
  `ma_sma200_above/below` 2 required; swing-trend geometry.
- **Golden / Death Cross** → `SMA50 spread SMA200 × trajectory` gives state and freshness:
  `SMA50_SMA200_spread_now gt 0` AND `_trend is "rising"`; optional breadth gate on
  `mktBreadth_crypto gte 0` — every published scope resolves, not only `all`, because the leg reads
  the `(timeframe, scope)` pairs a condition names; position-persona geometry. `SMA50 × SMA200` is
  the canonical definition and stays the default port; `EMA50` is available as the crypto variant
  when a player asks for it by name.
- **RSI-2 (Connors)** → `RSI2` is native, so this ports exactly: `RSI2 lte 10` gated by required
  `ABOVE_200`; the source's fast exit is time — timeDecay ON (180/60, 15→50, stale 20);
  `rsi_oversold` 3 required with a tuned threshold. Keep the literal `lte 10` as the GATE:
  `RSI2 × classifyZone` exists and reads on the same Connors bands, but a zone label is a fixed
  reading while the literal is a threshold the author can see and tune. Use the zone as a report
  column, never as the substitute for the gate.
- **VWAP reversion** → `dist_VWAP` band + `dist_VWAP_rank_far lte 5` for board-relative
  stretch; required `NOT [ADX_state in ["trending","extreme"]]` veto; scalp geometry +
  aggressive timeDecay (VWAP anchors daily at 00:00 UTC).
- **Donchian / Turtle breakout** → `zone is "breakout high"` + `dist_swingHi gte 0` +
  `RVOL gte 1.5`; `sr_resistance_break` 3 required; turtle exits = trend preset (trail from
  1R, giveback 50). Mirror with `"breakdown low"`. **Daily-breakout variant on any anchor:**
  pin the structure at 1d — `zone_1d is "breakout high"`, `dist_swingHi_1d gte 0` (validated).
  **Literal previous-day levels are native**: `PDH` and `PDL` are catalogued price levels, so
  `dist_PDH gte 0` composes directly. They are ANCHORED to `1d` — bind `{abs: '1d'}`, which is the
  only reference the save path accepts on them, and read them from any anchor that way. `distance`
  still rejects an `offset` and a clause still compares a column against a literal; neither of
  those shapes is what a previous-day level needed.
- **ICT / SMC (FVG + order blocks)** → `STRUCT_ZONES` is the native zone engine:
  `zones_htf_support_type` (`bullish FVG`/`bullish order block`), `zones_htf_support_dist
  between -1.5 0`, `_age_h gte 12`, HTF bias required via `MAalign_htf`; rules
  `structure_fvg_approach`/`structure_ob_approach` required (their `proximityPct` is the
  in-zone dial). Liquidity sweeps, displacement, killzones and event *sequencing* are shapes the
  grammar does not have — a clause compares one column against a literal, so an ordered sequence
  of events cannot be stated at all. That is a grammar limit, not a missing metric; name it as
  one.
- **Now native, formerly substituted** — WaveTrend (`WT1`/`WT2`), QQE (`QQE_RSI_MA`/`QQE_STOP`),
  Hull (`HMA20`), Ichimoku (`ICHI_CONV`/`ICHI_BASE`/`ICHI_SPAN_A`/`ICHI_SPAN_B`/`ICHI_LAG`),
  Parabolic SAR (`PSAR`), Keltner (`KC_UPPER`/`KC_MID`/`KC_LOWER`), daily pivots
  (`PIVOT_P`/`PIVOT_R1`–`R3`/`PIVOT_S1`–`S3`), Williams %R (`WILLR14`), Stochastic RSI
  (`STOCH_RSI14`), the TTM squeeze (`KC_SQUEEZE`), Connors RSI-2 (`RSI2`), the 9/21/50 EMAs
  (`EMA9`/`EMA21`/`EMA50`), and literal previous-day levels (`PDH`/`PDL`). Port these directly —
  do not offer a substitute for a primitive the catalog serves.

## Not expressible — the catalog keys this needs

The one place a claim that the catalog LACKS something may live, and every row names the key it
denies so the claim can be checked. A claim about the grammar's shape (a clause compares one
column against a literal; `distance` rejects an `offset`) belongs in prose above — those are
permanent. A claim that a metric is absent belongs here, or nowhere.

| Script / primitive | Key the catalog would need | Nearest expressible neighbour |
|---|---|---|
| 100-period SMA | `SMA100` | the shipped 50- or 200-period simple average, whichever the thesis leans on |

## Using a playbook

Discover → confirm headers (`get_strategy_column_contract`, or one `preview_strategy_report`
whose `conditionColumns` lists every addressable header with operators and vocabulary) →
calibrate literals against the previewed live values → compile once → review the compiled
scorecard, condition outcomes, verdict tally, and `marketReadMarkers` (fix `unknown` /
`ambiguous` markers) → apply per the strategy-authoring flow. Coin selection is call context,
not strategy state: explicit tickers for focused work, `ranked` (with an optional category) for
scanning books.
